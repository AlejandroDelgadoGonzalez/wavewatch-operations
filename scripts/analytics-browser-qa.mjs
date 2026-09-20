import assert from "node:assert/strict";
import { mkdir, readFile } from "node:fs/promises";
import { chromium } from "playwright";
import park from "../data/blue_current_staffing.json" with { type: "json" };
import { createAnalyticsDataset } from "../analytics/dataset.ts";
import { analyticsView, sortHandoffs } from "../analytics/metrics.ts";
import { analyticsCsv } from "../analytics/export.ts";
import { EMPTY_FILTERS } from "../analytics/model.ts";

const dataset = createAnalyticsDataset();
const browser = await chromium.launch({
  headless: true,
  ...(process.env.BROWSER_CHANNEL
    ? { channel: process.env.BROWSER_CHANNEL }
    : {}),
});
const page = await browser.newPage({
  viewport: { width: 1440, height: 1000 },
  reducedMotion: "reduce",
});
const errors = [];
page.on("console", (m) => {
  if (m.type() === "error") errors.push(m.text());
});
page.on("pageerror", (e) => errors.push(e.message));
page.on("requestfailed", (r) =>
  errors.push(`${r.url()}: ${r.failure()?.errorText}`),
);
const output = "outputs/analytics-qa";
await mkdir(output, { recursive: true });
const nav = (name) =>
  page
    .getByRole("navigation")
    .getByRole("button", { name, exact: true })
    .click();
const reset = () =>
  page.getByRole("button", { name: "Reset Filters", exact: true }).click();
async function verify(filters = { ...EMPTY_FILTERS }) {
  const view = analyticsView(dataset, park, filters),
    m = view.overall;
  const formatted = (value, suffix = "") =>
    value === null ? "—" : `${value.toFixed(1)}${suffix}`;
  assert.equal(
    await page.getByTestId("analytics-count").innerText(),
    `${m.total} of ${dataset.handoffs.length} handoffs in this selection`,
  );
  assert.equal(
    await page.getByTestId("analytics-rate").innerText(),
    formatted(m.onTimeRate, "%"),
  );
  assert.equal(
    await page.getByTestId("analytics-transition").innerText(),
    formatted(m.averageTransition, " min"),
  );
  assert.equal(
    await page.getByTestId("analytics-delay").innerText(),
    formatted(m.averageDelay, " min"),
  );
  assert.equal(
    await page.getByTestId("analytics-delayed").innerText(),
    String(m.delayed),
  );
  if (m.total && (await page.locator('[data-chart="average"]').count())) {
    assert.equal(
      await page.locator('[data-chart="average"] .chart-target').count(),
      view.rotations.length,
    );
    assert.equal(
      await page.locator('[data-chart="share"] .chart-target').count(),
      view.rotations.length,
    );
    assert.equal(
      await page.locator(".daily-bars .chart-target").count(),
      view.daily.length,
    );
    assert.equal(
      await page.locator(".trend-values .chart-target").count(),
      view.daily.length,
    );
    for (let i = 0; i < view.buckets.length; i++)
      assert.equal(
        await page
          .locator(".distribution-bars .chart-target strong")
          .nth(i)
          .innerText(),
        String(view.buckets[i].count),
      );
    const insights = await page
      .getByRole("region", { name: "Weekly Insights" })
      .innerText();
    for (const insight of view.insights) assert.ok(insights.includes(insight));
  }
  return view;
}
async function shot(name, fullPage = false) {
  await page.screenshot({ path: `${output}/${name}.png`, fullPage });
  assert.ok(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth + 1,
    ),
    `${name}: horizontal page overflow`,
  );
}
try {
  await page.goto(process.env.QA_URL || "http://127.0.0.1:3001", {
    waitUntil: "networkidle",
  });
  const liveClock = await page.getByTestId("clock").innerText();
  await nav("Data & Analytics");
  await page.getByTestId("analytics").waitFor();
  assert.equal(await page.getByTestId("clock").count(), 0);
  await verify();
  await shot("overview-desktop", true);
  for (const day of dataset.days) {
    await page
      .getByLabel("Analytics day", { exact: true })
      .selectOption(day.date);
    await verify({ ...EMPTY_FILTERS, day: day.date });
  }
  await shot("sunday-smooth-desktop");
  await page
    .getByLabel("Analytics day", { exact: true })
    .selectOption("2026-09-12");
  await verify({ ...EMPTY_FILTERS, day: "2026-09-12" });
  await shot("saturday-delays-desktop", true);
  await reset();
  for (const zone of new Set(park.rotations.map((r) => r.zone))) {
    await page.getByLabel("Analytics zone", { exact: true }).selectOption(zone);
    await verify({ ...EMPTY_FILTERS, zone });
  }
  await reset();
  for (const group of new Set(park.rotations.map((r) => r.role))) {
    await page
      .getByLabel("Analytics employee group", { exact: true })
      .selectOption(group);
    await verify({ ...EMPTY_FILTERS, group });
  }
  await reset();
  const rotation = park.rotations[0];
  await page.locator('[data-chart="average"] button').first().click();
  assert.equal(
    await page.getByLabel("Analytics rotation", { exact: true }).inputValue(),
    rotation.id,
  );
  await verify({ ...EMPTY_FILTERS, rotation: rotation.id });
  assert.equal(
    await page
      .getByRole("region", { name: "Rotation handoff history", exact: true })
      .count(),
    1,
  );
  await shot("rotation-desktop", true);
  await reset();
  const employee = dataset.handoffs.find(
    (r) => r.rotation_id === rotation.id,
  ).next_break_employee_id;
  await page
    .getByLabel("Analytics employee", { exact: true })
    .selectOption(employee);
  await verify({ ...EMPTY_FILTERS, employee });
  assert.equal(
    await page
      .getByRole("heading", { name: "Associated Handoffs", exact: true })
      .count(),
    1,
  );
  assert.ok(
    (await page.getByTestId("analytics").innerText()).includes(
      "cannot be attributed to an individual employee",
    ),
  );
  await shot("employee-desktop", true);
  const combined = {
    ...EMPTY_FILTERS,
    employee,
    rotation: rotation.id,
    zone: rotation.zone,
    group: rotation.role,
    day: dataset.days[0].date,
    query: `  ${rotation.name.toUpperCase()}  `,
  };
  await page
    .getByLabel("Analytics rotation", { exact: true })
    .selectOption(combined.rotation);
  await page
    .getByLabel("Analytics zone", { exact: true })
    .selectOption(combined.zone);
  await page
    .getByLabel("Analytics employee group", { exact: true })
    .selectOption(combined.group);
  await page
    .getByLabel("Analytics day", { exact: true })
    .selectOption(combined.day);
  await page.getByLabel("Search analytics records").fill(combined.query);
  const selected = await verify(combined);
  assert.ok(selected.records.length);
  await page
    .getByRole("button", { name: "Data Explorer", exact: true })
    .click();
  await page.getByLabel("Sort handoffs").selectOption("delay-desc");
  const downloadPromise = page.waitForEvent("download");
  await page.getByRole("button", { name: "Export CSV", exact: true }).click();
  const download = await downloadPromise;
  await download.saveAs(`${output}/filtered.csv`);
  assert.equal(
    await readFile(`${output}/filtered.csv`, "utf8"),
    analyticsCsv(sortHandoffs(selected.records, "delay-desc"), park),
  );
  await page.getByLabel("Search analytics records").fill("no-matching-record");
  await verify({ ...combined, query: "no-matching-record" });
  assert.equal(
    await page.getByRole("heading", { name: "No matching handoffs" }).count(),
    1,
  );
  await page
    .getByRole("button", { name: "Clear analytics filters", exact: true })
    .click();
  await verify();
  for (const sort of [
    "time-asc",
    "time-desc",
    "delay-desc",
    "transition-desc",
    "rotation",
  ]) {
    await page.getByLabel("Sort handoffs").selectOption(sort);
    const first = sortHandoffs(dataset.handoffs, sort)[0];
    const cells = page.locator(".analytics tbody tr").first().locator("td");
    assert.equal(await cells.nth(0).innerText(), first.operating_day);
    assert.ok((await cells.nth(1).innerText()).startsWith(first.rotation_id));
    assert.equal(await cells.nth(8).innerText(), `${first.delay_minutes} min`);
  }
  await page.getByRole("button", { name: "Next page", exact: true }).click();
  assert.ok(
    (await page.locator(".explorer-pagination").innerText()).includes(
      "Page 2 of",
    ),
  );
  await reset();
  assert.ok(
    (await page.locator(".explorer-pagination").innerText()).includes(
      "Page 1 of",
    ),
  );
  await shot("explorer-desktop", true);
  await page
    .getByRole("button", { name: "Week Overview", exact: true })
    .click();
  const coordinator = park.employees.find((e) =>
    ["Area Coordinator", "Base Coordinator", "Operations Lead"].includes(
      e.jobRole,
    ),
  );
  assert.ok(coordinator);
  await page
    .getByLabel("Analytics employee", { exact: true })
    .selectOption(coordinator.employeeId);
  await verify({ ...EMPTY_FILTERS, employee: coordinator.employeeId });
  await reset();
  for (const width of [1440, 900, 390]) {
    await page.setViewportSize({ width, height: width === 390 ? 844 : 1000 });
    await page.evaluate(() => scrollTo(0, 0));
    await shot(`overview-${width}`);
    for (const point of await page.locator(".trend-values button").all()) {
      await page.mouse.move(0, 0);
      await point.focus();
      const tip = point.locator("..").getByRole("tooltip");
      await tip.waitFor();
      const bounds = await tip.boundingBox();
      assert.ok(
        bounds.x >= 0 && bounds.x + bounds.width <= width + 1,
        `Tooltip clipped at ${width}px`,
      );
      await page.keyboard.press("Escape");
      await tip.waitFor({ state: "hidden" });
    }
    const target = page.locator(".trend-values button").first();
    await page.mouse.move(0, 0);
    await target.focus();
    const tooltip = target.locator("..").getByRole("tooltip");
    assert.ok((await tooltip.innerText()).includes("Allowed: 15 min"));
    await shot(`tooltip-${width}`);
    await page.keyboard.press("Escape");
    await tooltip.waitFor({ state: "hidden" });
    await page.mouse.move(0, 0);
    await target.hover();
    await tooltip.waitFor();
    await page.mouse.move(0, 0);
    await page.keyboard.press("Enter");
    assert.equal(
      await page.getByLabel("Analytics day", { exact: true }).inputValue(),
      dataset.days[0].date,
    );
    await verify({ ...EMPTY_FILTERS, day: dataset.days[0].date });
    await reset();
    await page
      .getByLabel("Analytics zone", { exact: true })
      .selectOption("Blue Peak");
    await verify({ ...EMPTY_FILTERS, zone: "Blue Peak" });
    await shot(`zone-${width}`, true);
    await reset();
    await page
      .getByRole("button", { name: "Data Explorer", exact: true })
      .click();
    await page.locator(".analytics thead").scrollIntoViewIfNeeded();
    await shot(`explorer-${width}`);
    await page.locator(".table-scroll").focus();
    await page.keyboard.press("ArrowRight");
    await page.waitForFunction(() => document.querySelector(".analytics .table-scroll").scrollLeft > 0);
    await page
      .getByRole("button", { name: "Week Overview", exact: true })
      .click();
    // Every native form control and interactive chart has an accessible name.
    assert.equal(
      await page
        .locator(
          ".analytics input:not([aria-label]), .analytics select:not([aria-label])",
        )
        .count(),
      0,
    );
  }
  await nav("Operations");
  assert.equal(await page.getByTestId("clock").innerText(), liveClock);
  await nav("Data & Analytics");
  await verify();
  assert.deepEqual(
    errors,
    [],
    "No console, hydration, failed-request or runtime errors",
  );
  console.log(
    "Analytics compiled-preview QA passed: generated KPIs and five charts, all filters and combinations, insights, day/rotation drilldown, associated employee history, empty/reset, five sorts, pagination, exact filtered CSV, keyboard/hover tooltips, isolated live clock, 1440/900/390px and no page overflow or runtime errors.",
  );
} finally {
  await browser.close();
}
