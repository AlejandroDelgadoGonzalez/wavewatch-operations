import type { Closing, Park, SimulationEvent } from "../domain/model.ts";
import {
  createSchedule,
  minuteOf,
  POLICY,
  postSchedule,
} from "../domain/schedule.ts";
import { SimulationEngine } from "../simulation/engine.ts";
import {
  createSourceEvents,
  randomGenerator,
} from "../simulation/scenarios.ts";
import type { CompletedDay } from "./model.ts";

export const DEMO_SEED = 20260919;
export const WEEK_START = "2026-09-07";
// Scenario inputs, not precomputed outcomes or operational severity thresholds.
export const DAY_PROFILES: {
  name: string;
  probability: number;
  closing: Closing;
}[] = [
  { name: "Quiet Monday", probability: 0.02, closing: "5:00 PM" },
  { name: "Scattered delays", probability: 0.09, closing: "6:00 PM" },
  { name: "Mixed midweek", probability: 0.16, closing: "6:00 PM" },
  { name: "Smooth Thursday", probability: 0.04, closing: "7:00 PM" },
  { name: "Busy Friday", probability: 0.24, closing: "6:00 PM" },
  { name: "Variable Saturday", probability: 0.32, closing: "8:00 PM" },
  { name: "Calmer Sunday", probability: 0.07, closing: "7:00 PM" },
];

export function generateWeek(park: Park, seed = DEMO_SEED): CompletedDay[] {
  if (!Number.isInteger(seed) || seed < 0 || seed > 0xffffffff)
    throw new Error("Analytics seed must be an unsigned 32-bit integer.");
  const choose = randomGenerator(seed);
  const recurring = new Set<number>();
  while (recurring.size < Math.min(2, park.rotations.length))
    recurring.add(Math.floor(choose() * park.rotations.length));
  return DAY_PROFILES.map((profile, dayIndex) => {
    const daySeed = (seed + Math.imul(dayIndex + 1, 2654435761)) >>> 0;
    const date = new Date(`${WEEK_START}T00:00:00Z`);
    date.setUTCDate(date.getUTCDate() + dayIndex);
    const config = {
      scenario: "normal" as const,
      closing: profile.closing,
      seed: daySeed,
    };
    const factory = (): SimulationEvent[] => {
      const random = randomGenerator(daySeed);
      const starts = new Map<string, number>();
      park.rotations.forEach((rotation, rotationIndex) => {
        const plan = createSchedule(
          park.employees.filter((e) => e.rotationId === rotation.id),
          profile.closing,
        );
        // Bound generated positive offsets so the demo contains complete days, not censored breaks.
        let budget = Math.min(
          40,
          minuteOf(profile.closing) -
            postSchedule(plan, profile.closing).finalBump -
            5,
        );
        let previousEnd = 0;
        plan.forEach((row, index) => {
          let variation = 0;
          if (index) {
            const probability =
              profile.probability +
              (recurring.has(rotationIndex) && [1, 2, 4, 5].includes(dayIndex)
                ? 0.28
                : 0);
            if (random() < probability && budget > 0) {
              variation = Math.min(
                budget,
                random() < 0.09
                  ? 11 + Math.floor(random() * 6)
                  : 1 + Math.floor(random() * 5),
              );
              budget -= variation;
            } else variation = -Math.floor(random() * 4);
          }
          const start = index
            ? previousEnd + POLICY.transitionMinutes + variation
            : row.baseline;
          starts.set(`${rotation.id}/${index}`, start);
          previousEnd = start + row.duration;
        });
      });
      return createSourceEvents(park, config)
        .map((event) => {
          if (!event.rotationId || event.payload.breakIndex === undefined)
            return event;
          const start = starts.get(
            `${event.rotationId}/${event.payload.breakIndex}`,
          )!;
          if (event.type === "break_started")
            return { ...event, minute: start };
          const plan = createSchedule(
            park.employees.filter((e) => e.rotationId === event.rotationId),
            profile.closing,
          );
          return {
            ...event,
            minute: start + plan[event.payload.breakIndex].duration,
          };
        })
        .sort(
          (a, b) =>
            a.minute - b.minute ||
            Number(a.id.split("/")[1]) - Number(b.id.split("/")[1]),
        );
    };
    const engine = new SimulationEngine(park, config, factory);
    engine.advanceTo(minuteOf(profile.closing) + 30);
    const state = engine.getSnapshot().state;
    if (
      !state.ended ||
      Object.values(state.rotations).some(
        (r) => r.breaks.some((b) => b.end === null) || !r.finalApplied,
      )
    )
      throw new Error("Demo day has incomplete breaks or return activity.");
    return {
      date: date.toISOString().slice(0, 10),
      scenario: profile.name,
      seed: daySeed,
      closing: profile.closing,
      state,
    };
  });
}
