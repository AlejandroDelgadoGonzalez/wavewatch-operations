import { mkdir, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import park from "../data/blue_current_staffing.json" with { type: "json" };
import { createAnalyticsDataset } from "../analytics/dataset.ts";
import { analyticsCsv } from "../analytics/export.ts";
import { generateWeek, DEMO_SEED } from "../analytics/generate.ts";

const destination = resolve("outputs/analytics");
await mkdir(destination, { recursive: true });
const dataset = createAnalyticsDataset();
await writeFile(
  resolve(destination, "blue_current_demo_week.json"),
  JSON.stringify(dataset, null, 2) + "\n",
);
await writeFile(
  resolve(destination, "blue_current_demo_week.csv"),
  analyticsCsv(dataset.handoffs, park),
);
await writeFile(
  resolve(destination, "completed_days.json"),
  JSON.stringify(generateWeek(park, DEMO_SEED), null, 2) + "\n",
);
console.log(
  `Exported ${dataset.days.length} completed days and ${dataset.handoffs.length} handoffs to ${destination}; seed ${dataset.seed}.`,
);
