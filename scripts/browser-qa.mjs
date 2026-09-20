import assert from "node:assert/strict";
import { mkdir } from "node:fs/promises";
import { chromium } from "playwright";
import park from "../data/blue_current_staffing.json" with { type: "json" };

// Optional browser dependency: npm install --no-save --package-lock=false playwright
// Run against a separately started local app. BROWSER_CHANNEL=msedge is useful on Windows.
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
page.on("console", (message) => {
  if (message.type() === "error") errors.push(`Console: ${message.text()}`);
});
page.on("pageerror", (error) => errors.push(error.message));
page.on("requestfailed", (request) =>
  errors.push(`${request.url()}: ${request.failure()?.errorText}`),
);
const output = "outputs/v2-qa";
await mkdir(output, { recursive: true });
const nav = (name) =>
  page
    .getByRole("navigation")
    .getByRole("button", { name, exact: true })
    .click();
const clock = () => page.getByTestId("clock").textContent();
async function checkpoint(name) {
  await nav("Simulation Lab");
  await page.getByRole("button", { name: new RegExp(`^${name}`) }).click();
}
async function shot(name) {
  await page.screenshot({ path: `${output}/${name}.png` });
  assert.ok(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth + 1,
    ),
    `${name}: page overflows horizontally`,
  );
}
async function verifySearchFilters(width) {
  await page.setViewportSize({ width, height: width === 390 ? 844 : 1000 });
  await nav("Operations");
  const search = page.getByLabel("Search rotations or employees");
  assert.equal(
    await search.getAttribute("placeholder"),
    "Find an employee, rotation, attraction, or stand…",
  );
  for (const name of [
    "North Platform",
    "North Center",
    "North Transition",
    "Activity Island",
  ]) {
    await search.fill(`  ${name.toUpperCase()}  `);
    assert.equal(await page.locator(".rotation-card").count(), 1);
    assert.match(
      await page.locator(".rotation-card").textContent(),
      new RegExp(name),
    );
  }
  await search.fill("  north platform  ");
  await page
    .getByLabel("Zone filter", { exact: true })
    .selectOption("Tidal Bay");
  await page
    .getByLabel("Role filter", { exact: true })
    .selectOption("Deep Water Lifeguard");
  assert.equal(await page.locator(".rotation-card").count(), 1);
  await page
    .getByLabel("Role filter", { exact: true })
    .selectOption("Slide Operator");
  assert.equal(await page.locator(".rotation-card").count(), 0);
  await page
    .getByLabel("Role filter", { exact: true })
    .selectOption("Deep Water Lifeguard");
  await page
    .getByLabel("Zone filter", { exact: true })
    .selectOption("Current Cove");
  assert.equal(await page.locator(".rotation-card").count(), 0);
  await page
    .getByLabel("Zone filter", { exact: true })
    .selectOption("Tidal Bay");
  await page.locator(".filters").scrollIntoViewIfNeeded();
  await shot(`filters-${width}-board`);
  await nav("Team");
  const teamSearch = page.getByLabel("Find team member"),
    role = page.getByLabel("Team role filter"),
    zone = page.getByLabel("Team zone filter"),
    sort = page.getByLabel("Sort by");
  assert.equal(await teamSearch.inputValue(), "");
  assert.equal(await role.inputValue(), "All roles");
  assert.equal(await zone.inputValue(), "All zones");
  assert.deepEqual(await role.locator("option").allTextContents(), [
    "All roles",
    "Coordinator",
    "Shallow Water Lifeguard",
    "Deep Water Lifeguard",
    "Slide Operator",
  ]);
  assert.deepEqual(await zone.locator("option").allTextContents(), [
    "All zones",
    "Current Cove",
    "Tidal Bay",
    "Rapids Ridge",
    "Blue Peak",
    "Parkwide",
  ]);
  for (const [value, count] of Object.entries({
    "All roles": 74,
    Coordinator: 6,
    "Shallow Water Lifeguard": 32,
    "Deep Water Lifeguard": 12,
    "Slide Operator": 24,
  })) {
    await role.selectOption(value);
    assert.equal(await page.locator("tbody tr").count(), count);
    assert.equal(
      await page.getByTestId("team-count").textContent(),
      `Showing ${count} of 74 employees`,
    );
    if (value === "Coordinator")
      for (const job of [
        "Area Coordinator",
        "Base Coordinator",
        "Operations Lead",
      ])
        assert.match(
          await page.locator("tbody").textContent(),
          new RegExp(job),
        );
  }
  await role.selectOption("All roles");
  for (const value of [
    "All zones",
    "Current Cove",
    "Tidal Bay",
    "Rapids Ridge",
    "Blue Peak",
    "Parkwide",
  ]) {
    await zone.selectOption(value);
    assert.equal(
      await page.locator("tbody tr").count(),
      park.employees.filter((e) => value === "All zones" || e.zone === value)
        .length,
    );
  }
  await role.selectOption("Coordinator");
  assert.equal(await page.locator("tbody tr").count(), 2);
  await page.locator(".full-panel > header").scrollIntoViewIfNeeded();
  await shot(`filters-${width}-team`);
  if (width === 390) {
    const controls = await page
      .locator(
        ".team-filters input, .team-filters select, .team-filters > button",
      )
      .evaluateAll((nodes) =>
        nodes.map((node) => {
          const r = node.getBoundingClientRect();
          return { top: r.top, bottom: r.bottom, left: r.left, right: r.right };
        }),
      );
    assert.ok(
      controls.every(
        (r, i) =>
          r.left >= 0 &&
          r.right <= 390 &&
          (!i || r.top >= controls[i - 1].bottom),
      ),
      "Mobile Team controls must stack without clipping",
    );
  }
  await role.selectOption("Shallow Water Lifeguard");
  await zone.selectOption("Current Cove");
  await teamSearch.fill("  N  ");
  const minute = (value) => {
    const [, h, m, suffix] = value.match(/(\d+):(\d+) (AM|PM)/);
    return (+h % 12) * 60 + +m + (suffix === "PM" ? 720 : 0);
  };
  for (const value of ["name", "arrival"]) {
    await sort.selectOption(value);
    const expected = park.employees
      .filter(
        (e) =>
          e.jobRole === "Shallow Water Lifeguard" &&
          e.zone === "Current Cove" &&
          `${e.employeeName} ${e.employeeId}`.toLowerCase().includes("n"),
      )
      .sort(
        (a, b) =>
          (value === "arrival"
            ? minute(a.arrivalTime) - minute(b.arrivalTime)
            : 0) ||
          a.employeeName.localeCompare(b.employeeName, "en") ||
          a.employeeId.localeCompare(b.employeeId, "en"),
      );
    assert.deepEqual(
      await page.locator("tbody tr td:first-child small").allTextContents(),
      expected.map((e) => e.employeeId),
    );
  }
  await nav("Operations");
  assert.equal(await search.inputValue(), "  north platform  ");
  assert.equal(
    await page.getByLabel("Zone filter", { exact: true }).inputValue(),
    "Tidal Bay",
  );
  assert.equal(
    await page.getByLabel("Role filter", { exact: true }).inputValue(),
    "Deep Water Lifeguard",
  );
  await search.fill("Activity Island");
  await page
    .getByLabel("Zone filter", { exact: true })
    .selectOption("Current Cove");
  await page
    .getByLabel("Role filter", { exact: true })
    .selectOption("Shallow Water Lifeguard");
  await nav("Team");
  assert.equal(await teamSearch.inputValue(), "  N  ");
  assert.equal(await role.inputValue(), "Shallow Water Lifeguard");
  assert.equal(await zone.inputValue(), "Current Cove");
  assert.equal(await sort.inputValue(), "arrival");
  await teamSearch.fill("no-such-employee");
  assert.equal(await page.locator("tbody tr").count(), 0);
  assert.equal(
    await page.getByTestId("team-count").textContent(),
    "Showing 0 of 74 employees",
  );
  assert.equal(
    await page.getByRole("heading", { name: "No matching employees" }).count(),
    1,
  );
  await page
    .getByRole("button", { name: "Reset filters", exact: true })
    .focus();
  await page.keyboard.press("Enter");
  assert.equal(await page.locator("tbody tr").count(), 74);
  assert.equal(await teamSearch.inputValue(), "");
  assert.equal(await role.inputValue(), "All roles");
  assert.equal(await zone.inputValue(), "All zones");
  assert.equal(await sort.inputValue(), "name");
  await teamSearch.focus();
  for (const control of [
    role,
    zone,
    sort,
    page.getByRole("button", { name: "Reset filters", exact: true }),
  ]) {
    await page.keyboard.press("Tab");
    assert.equal(
      await control.evaluate((e) => e === document.activeElement),
      true,
    );
  }
  await nav("Operations");
  assert.equal(await search.inputValue(), "Activity Island");
  assert.equal(await page.locator(".rotation-card").count(), 1);
  await search.fill("");
  await page
    .getByLabel("Zone filter", { exact: true })
    .selectOption("All zones");
  await page
    .getByLabel("Role filter", { exact: true })
    .selectOption("All roles");
}
try {
  await page.goto(process.env.QA_URL ?? "http://localhost:3000", {
    waitUntil: "networkidle",
  });
  await verifySearchFilters(1440);
  await verifySearchFilters(390);
  await page.setViewportSize({ width: 1440, height: 1000 });
  assert.equal(await page.locator(".rotation-card").count(), 17);
  for (const rotation of park.rotations) {
    const card = page.getByRole("button", {
      name: `Inspect ${rotation.name}`,
      exact: true,
    });
    assert.equal(await card.locator("ol.card-assignments > li").count(), 4);
    assert.deepEqual(await card.locator("li > span").allTextContents(), [
      ...rotation.stands.map((s) => s.name),
      "Breaker",
    ]);
    const bounds = await card.locator("li").evaluateAll((rows) =>
      rows.map((row) => {
        const b = row.getBoundingClientRect();
        return { top: b.top, bottom: b.bottom, left: b.left };
      }),
    );
    assert.ok(
      bounds.every(
        (row, i) =>
          !i ||
          (row.top >= bounds[i - 1].bottom && row.left === bounds[0].left),
      ),
    );
  }
  await page.getByLabel("Zone filter").selectOption("Tidal Bay");
  assert.equal(await page.locator(".rotation-card").count(), 4);
  assert.doesNotMatch(
    await page.locator("main").textContent(),
    /Breaker (Bay|East|West|Deep)/,
  );
  await page.getByLabel("Zone filter").selectOption("All zones");
  assert.equal(await clock(), "7:30 AM");
  await page
    .getByRole("button", { name: "Start simulation", exact: true })
    .click();
  await page.waitForFunction(
    () =>
      document.querySelector('[data-testid="clock"]').textContent !== "7:30 AM",
  );
  await page.getByRole("button", { name: "Pause", exact: true }).click();
  const paused = await clock();
  await page.waitForTimeout(1200);
  assert.equal(await clock(), paused);
  await page.getByRole("button", { name: "+1 min", exact: true }).click();
  assert.notEqual(await clock(), paused);
  await page.getByLabel("Simulation speed").selectOption("15");
  await page.getByRole("button", { name: "Resume", exact: true }).click();
  await page.waitForTimeout(1100);
  await page.getByRole("button", { name: "Pause", exact: true }).click();
  await page.getByRole("button", { name: "Restart", exact: true }).click();
  assert.equal(await clock(), "7:30 AM");
  await checkpoint("Before opening");
  await nav("Operations");
  await shot("01-pre-opening");
  await checkpoint("First break");
  await nav("Operations");
  await page.locator(".rotation-card").first().click();
  assert.match(
    await page.locator("#rotation-detail").textContent(),
    /On break/,
  );
  await shot("02-active-break");
  for (const employee of park.employees.filter(
    (e) => e.rotationId === "SW-CC-01",
  )) {
    const row = page
      .locator(".position-list > div")
      .filter({ hasText: employee.employeeName });
    assert.match(await row.textContent(), new RegExp(employee.arrivalTime));
  }
  for (const stand of park.rotations[0].stands)
    assert.match(
      await page.locator(".position-list").textContent(),
      new RegExp(`${stand.extension}`),
    );
  assert.match(
    await page.locator(".bump-time").first().textContent(),
    /Actual: Pending/,
  );
  await checkpoint("Handoff overdue");
  await nav("Operations");
  await page
    .getByRole("button", { name: "Inspect Tidal East", exact: true })
    .click();
  assert.match(
    await page.locator(".timeline-row").first().textContent(),
    /Nia Torres/,
  );
  assert.match(
    await page.locator(".timeline-row").nth(2).textContent(),
    /Adrian Morgan/,
  );
  assert.match(
    await page.locator(".bump-time").first().textContent(),
    /Expected: 15 min · Actual: 15 min/,
  );
  assert.match(
    await page.locator(".bump-time").first().textContent(),
    /11:55 AM → 12:10 PM/,
  );
  assert.equal(
    await page
      .locator(".bump-time")
      .first()
      .locator(".evidence.confirmed")
      .count(),
    1,
  );
  await page.getByRole("button", { name: "Restart", exact: true }).click();
  await checkpoint("First break");
  await nav("Operations");
  await page
    .getByRole("button", { name: "Inspect Tidepool Loop", exact: true })
    .click();
  const change = page.getByRole("button", {
    name: "Change Ethan Johnson",
    exact: true,
  });
  // Active-break and empty paths; native dialog traps/restores keyboard focus.
  await page
    .getByRole("button", { name: "Change Maya Nguyen", exact: true })
    .click();
  const dialog = page.getByRole("dialog");
  assert.equal(await dialog.locator('input[type="radio"]:enabled').count(), 0);
  assert.match(await dialog.textContent(), /No eligible candidates/);
  await page.keyboard.press("Escape");
  assert.equal(
    await page
      .getByRole("button", { name: "Change Maya Nguyen", exact: true })
      .evaluate((e) => e === document.activeElement),
    true,
  );
  await change.click();
  await page.getByLabel("Find swap candidate").fill("not-a-person");
  assert.match(await dialog.textContent(), /No assigned employees match/);
  assert.equal(
    await dialog.getByRole("button", { name: "Review swap" }).isDisabled(),
    true,
  );
  await page.getByLabel("Find swap candidate").fill("Adrian Morgan");
  const candidate = dialog.getByRole("radio", { name: /Adrian Morgan/ });
  await candidate.focus();
  await page.keyboard.press("Space");
  assert.equal(await candidate.isChecked(), true);
  for (let i = 0; i < 9; i++) {
    await page.keyboard.press("Tab");
    assert.equal(
      await dialog.evaluate((e) => e.contains(document.activeElement)),
      true,
    );
  }
  await dialog.getByRole("button", { name: "Review swap" }).click();
  assert.match(await dialog.textContent(), /Ethan Johnson/);
  assert.match(await dialog.textContent(), /Adrian Morgan/);
  await dialog.getByRole("button", { name: "Cancel", exact: true }).click();
  assert.equal(
    await change.evaluate((e) => e === document.activeElement),
    true,
  );
  assert.match(
    await page.locator(".position-list").textContent(),
    /Ethan Johnson/,
  );
  await change.click();
  await page.getByLabel("Find swap candidate").fill("Adrian Morgan");
  await dialog.getByRole("radio", { name: /Adrian Morgan/ }).check();
  await dialog.getByRole("button", { name: "Review swap" }).click();
  await page.setViewportSize({ width: 390, height: 844 });
  await shot("10-mobile-swap-review");
  await dialog.getByRole("button", { name: "Confirm swap" }).click();
  assert.match(
    await page.locator(".position-list").textContent(),
    /Adrian Morgan/,
  );
  assert.doesNotMatch(
    await page.locator(".position-list").textContent(),
    /Ethan Johnson/,
  );
  await shot("11-mobile-detail");
  await page.setViewportSize({ width: 1440, height: 1000 });
  await nav("Team");
  await page.getByLabel("Find team member").fill("Ethan Johnson");
  assert.match(await page.locator("tbody").textContent(), /SW-BB-01/);
  assert.match(await page.locator("tbody").textContent(), /Tidal Bay/);
  await page
    .getByLabel("Team role filter")
    .selectOption("Shallow Water Lifeguard");
  await page.getByLabel("Team zone filter").selectOption("Current Cove");
  assert.equal(await page.locator("tbody tr").count(), 0);
  await page.getByLabel("Team zone filter").selectOption("Tidal Bay");
  assert.equal(await page.locator("tbody tr").count(), 1);
  assert.match(await page.locator("tbody").textContent(), /SW-BB-01/);
  await page.getByLabel("Find team member").fill("Adrian Morgan");
  assert.equal(await page.locator("tbody tr").count(), 0);
  await page.getByLabel("Team zone filter").selectOption("Current Cove");
  assert.equal(await page.locator("tbody tr").count(), 1);
  await page
    .getByRole("button", { name: "Reset filters", exact: true })
    .click();
  await page.getByLabel("Find team member").fill("Ethan Johnson");
  for (const sort of ["name", "arrival"]) {
    await page.getByLabel("Sort by").selectOption(sort);
    assert.equal(await page.locator("tbody tr").count(), 1);
    await page.getByLabel("Find team member").fill("");
    const ids = await page
      .locator("tbody tr td:first-child small")
      .allTextContents();
    const minute = (value) => {
      const [, h, m, suffix] = value.match(/(\d+):(\d+) (AM|PM)/);
      return (+h % 12) * 60 + +m + (suffix === "PM" ? 720 : 0);
    };
    const expected = park.employees
      .slice()
      .sort(
        (a, b) =>
          (sort === "arrival"
            ? minute(a.arrivalTime) - minute(b.arrivalTime)
            : 0) ||
          a.employeeName.localeCompare(b.employeeName, "en") ||
          a.employeeId.localeCompare(b.employeeId, "en"),
      )
      .map((e) => e.employeeId);
    assert.deepEqual(ids, expected);
    await page.getByLabel("Find team member").fill("Ethan Johnson");
  }
  await page.getByLabel("Find team member").fill("");
  await nav("Activity");
  assert.equal(await page.getByText(/^Employee swap recorded:/).count(), 1);
  await checkpoint("Handoff overdue");
  await nav("Operations");
  assert.match(await page.locator(".off-stand").textContent(), /Adrian Morgan/);
  assert.match(
    await page
      .getByRole("button", { name: "Inspect Tidal East", exact: true })
      .textContent(),
    /Ethan Johnson/,
  );
  await page
    .getByRole("button", { name: "Inspect Tidal East", exact: true })
    .click();
  assert.match(await page.locator(".off-stand").textContent(), /Ethan Johnson/);
  await page
    .getByRole("button", { name: "Inspect Tidepool Loop", exact: true })
    .click();
  await shot("12-swapped-rotations");
  await nav("Simulation Lab");
  await page.getByLabel("Scenario", { exact: true }).selectOption("delayed");
  await page.getByRole("button", { name: "Apply & restart scenario" }).click();
  await checkpoint("Handoff overdue");
  await nav("Operations");
  assert.match(
    await page.locator("#attention-panel").textContent(),
    /Expected break not recorded/,
  );
  await shot("03-overdue-handoff");
  await checkpoint("ROT-002 record");
  await nav("Operations");
  const detail = page.locator("#rotation-detail");
  assert.match(await detail.textContent(), /8-minute handoff delay/);
  assert.match(await detail.textContent(), /5:03 PM/);
  assert.match(await detail.textContent(), /bump removed/);
  assert.match(
    await detail.locator(".bump-time").first().textContent(),
    /Expected: 15 min · Actual: 23 min \(\+8 min\)/,
  );
  assert.match(
    await detail.locator(".bump-time").first().textContent(),
    /Cause unknown/,
  );
  assert.equal(
    await detail.locator(".timeline-row:not(.bump-time) .delay-text").count(),
    0,
  );
  await shot("04-delayed-timeline");
  await detail.screenshot({ path: `${output}/04-detail.png` });
  await detail.evaluate((element) => {
    element.scrollTop = 630;
  });
  await detail.screenshot({ path: `${output}/04-timeline.png` });
  await detail.evaluate((element) => {
    element.scrollTop = 0;
  });
  await page.getByRole("button", { name: "Close rotation detail" }).click();
  await page.getByLabel("Search rotations or employees").fill("Jordan Morales");
  assert.equal(await page.locator(".rotation-card").count(), 1);
  await page.getByLabel("Search rotations or employees").fill("");
  await page.getByLabel("Zone filter").selectOption("Blue Peak");
  assert.equal(await page.locator(".rotation-card").count(), 6);
  await page.getByLabel("Zone filter").selectOption("All zones");
  await checkpoint("Final break end");
  assert.equal(await clock(), "4:48 PM");
  await checkpoint("Extra cycle");
  assert.equal(await clock(), "5:03 PM");
  await nav("Operations");
  await page.locator(".rotation-card").first().click();
  assert.match(await detail.textContent(), /Expected Extra/);
  await shot("05-extra-cycle");
  await checkpoint("Near closing");
  await nav("Operations");
  await shot("06-near-closing");
  await page.setViewportSize({ width: 900, height: 1000 });
  await shot("07-tablet");
  await page.setViewportSize({ width: 390, height: 844 });
  await page.evaluate(() => scrollTo(0, 0));
  await shot("08-mobile");
  await nav("Simulation Lab");
  await shot("09-mobile-lab");
  await page
    .getByLabel("Discovery note")
    .fill("Explore how to record a coverage request.");
  await page
    .getByRole("button", { name: "Record experimental observation" })
    .click();
  await nav("Activity");
  assert.match(
    await page.locator(".feed").textContent(),
    /Experimental Simulation Event/,
  );
  await page.getByLabel("Evidence", { exact: true }).selectOption("Calculated");
  assert.ok((await page.locator(".feed .evidence.confirmed").count()) === 0);
  await checkpoint("Complete day");
  assert.equal(await clock(), "6:30 PM");
  await page.setViewportSize({ width: 1440, height: 1000 });
  await nav("Simulation Lab");
  await page.getByLabel("Scenario", { exact: true }).selectOption("normal");
  await page.getByRole("button", { name: "Apply & restart scenario" }).click();
  await checkpoint("Final break end");
  assert.equal(await clock(), "4:40 PM");
  await checkpoint("Extra cycle");
  assert.equal(await clock(), "4:55 PM");
  await nav("Operations");
  assert.match(await detail.textContent(), /5:25 PM/);
  await nav("Simulation Lab");
  for (const [closing, expected] of [
    ["5:00 PM", "4:10 PM"],
    ["7:00 PM", "5:25 PM"],
    ["8:00 PM", "5:55 PM"],
  ]) {
    await page.getByLabel("Park closing").selectOption(closing);
    await page
      .getByRole("button", { name: "Apply & restart scenario" })
      .click();
    await checkpoint("Final break end");
    assert.equal(await clock(), expected);
  }
  await page.getByLabel("Scenario", { exact: true }).selectOption("seeded");
  await page.getByLabel("Park closing").selectOption("6:00 PM");
  await page.getByLabel("Seed", { exact: true }).fill("42");
  await page.getByRole("button", { name: "Apply & restart scenario" }).click();
  await checkpoint("Complete day");
  if (process.env.QA_PRODUCTION === "1") {
    assert.equal(
      await page
        .getByText("Development inspector · future simulator events")
        .count(),
      0,
    );
  }
  await nav("Activity");
  await page
    .getByLabel("Evidence", { exact: true })
    .selectOption("All evidence");
  const seededHistory = await page.locator(".feed").textContent();
  await nav("Simulation Lab");
  await page.getByRole("button", { name: "Apply & restart scenario" }).click();
  await checkpoint("Complete day");
  await nav("Activity");
  assert.equal(await page.locator(".feed").textContent(), seededHistory);
  await nav("Team");
  assert.equal(await page.locator("tbody tr").count(), 74);
  await page.getByLabel("Find team member").fill("Maya Nguyen");
  assert.equal(await page.locator("tbody tr").count(), 1);
  await page
    .getByRole("navigation")
    .getByRole("button", { name: "About", exact: true })
    .focus();
  await page.keyboard.press("Enter");
  assert.match(
    await page.locator(".about").textContent(),
    /not intended for real-world safety-critical/,
  );
  assert.deepEqual(errors, [], "Browser runtime errors");
  console.log(
    "Browser QA passed: all 17 vertical cards, stand/arrival/extension mapping, Tidal Bay, 15/15 and 15/23 Bump Time, swap cancel/invalid/confirm and subsequent bumps, Team live membership/sorts/search, modal keyboard focus, ROT-001/002, all closings, seeded replay, controls, desktop/tablet/mobile; no page errors.",
  );
} finally {
  await browser.close();
}
