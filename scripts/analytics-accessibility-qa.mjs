import assert from "node:assert/strict";
import { mkdir, writeFile } from "node:fs/promises";
import { chromium } from "playwright";

// Optional isolated QA dependency: npm install --prefix outputs/qa-tools --no-save --package-lock=false axe-core@4.10.3
const browser = await chromium.launch({
  headless: true,
  channel: process.env.BROWSER_CHANNEL || "msedge",
});
const page = await browser.newPage();
const reports = [];
try {
  await page.goto(process.env.QA_URL || "http://127.0.0.1:3001", {
    waitUntil: "networkidle",
  });
  await page
    .getByRole("navigation")
    .getByRole("button", { name: "Data & Analytics", exact: true })
    .click();
  await page.addScriptTag({
    path: "outputs/qa-tools/node_modules/axe-core/axe.min.js",
  });
  for (const width of [1440, 900, 390]) {
    await page.setViewportSize({ width, height: 1000 });
    for (const state of ["overview", "employee", "explorer", "empty"]) {
      await page
        .getByRole("button", { name: "Reset Filters", exact: true })
        .click();
      await page
        .getByRole("button", {
          name: state === "explorer" ? "Data Explorer" : "Week Overview",
          exact: true,
        })
        .click();
      if (state === "employee")
        await page
          .getByLabel("Analytics employee", { exact: true })
          .selectOption("BCAP-0001");
      if (state === "empty")
        await page
          .getByLabel("Search analytics records")
          .fill("nonexistent-record");
      const result = await page.evaluate(async () =>
        window.axe.run(document, {
          runOnly: { type: "tag", values: ["wcag2a", "wcag2aa", "wcag21aa"] },
        }),
      );
      reports.push({
        width,
        state,
        violations: result.violations.map((v) => ({
          id: v.id,
          impact: v.impact,
          help: v.help,
          nodes: v.nodes.map((n) => ({
            target: n.target,
            summary: n.failureSummary,
          })),
        })),
        incomplete: result.incomplete.map((v) => v.id),
      });
    }
  }
  await mkdir("outputs/analytics-qa", { recursive: true });
  await writeFile(
    "outputs/analytics-qa/accessibility.json",
    JSON.stringify(reports, null, 2),
  );
  assert.deepEqual(
    reports.filter((r) => r.violations.length),
    [],
    "Automated WCAG checks",
  );
  console.log(
    "Analytics accessibility QA passed: axe WCAG 2 A/AA and 2.1 AA checks across overview, employee, explorer and empty states at 1440/900/390px. Manual review remains necessary.",
  );
} finally {
  await browser.close();
}
