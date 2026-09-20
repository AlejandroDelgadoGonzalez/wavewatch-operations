import park from "../data/blue_current_staffing.json" with { type: "json" };
import { DEMO_SEED, generateWeek } from "./generate.ts";
import { transformDay } from "./transform.ts";
import type { AnalyticsDataset } from "./model.ts";

export function createAnalyticsDataset(seed = DEMO_SEED): AnalyticsDataset {
  const completed = generateWeek(park, seed);
  return {
    seed,
    days: completed.map(({ date, scenario, seed, closing }) => ({
      date,
      scenario,
      seed,
      closing,
    })),
    handoffs: completed.flatMap(transformDay),
  };
}
let demo: AnalyticsDataset | undefined;
/** Lazy, isolated demo cache. It never reads or changes the live engine. */
export function getDemoWeek() {
  return (demo ??= createAnalyticsDataset());
}
