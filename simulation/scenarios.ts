import type {
  Config,
  Park,
  ScenarioId,
  SimulationEvent,
} from "../domain/model.ts";
import { createSchedule, minuteOf, POLICY } from "../domain/schedule.ts";

export const SCENARIOS: {
  id: ScenarioId;
  name: string;
  description: string;
}[] = [
  {
    id: "normal",
    name: "Normal Operating Day",
    description:
      "All recorded breaks follow the Python reference schedule. At 6 PM closing, the final bump is 4:55 PM and the Extra-cycle bump is 5:25 PM (ROT-001).",
  },
  {
    id: "delayed",
    name: "Delayed Handoff",
    description:
      "SW-CC-01 receives one 8-minute handoff variation. With a 6 PM closing, its second employee starts at 12:18 PM instead of 12:10 PM. Other rotations stay on schedule (ROT-002).",
  },
  {
    id: "seeded",
    name: "Seeded Dynamic Day",
    description:
      "A seeded generator adds occasional 1–4 minute handoff variations. These synthetic parameters create timing variation, not operational policies. The same seed replays the same day.",
  },
];
export function randomGenerator(seed: number) {
  let value = seed >>> 0;
  return () => {
    value = (Math.imul(1664525, value) + 1013904223) >>> 0;
    return value / 4294967296;
  };
}

/** The simulator knows the fictional truth. Its private queue is never a dashboard forecast. */
export function createSourceEvents(
  park: Park,
  config: Config,
): SimulationEvent[] {
  const result: SimulationEvent[] = [];
  const random = randomGenerator(config.seed);
  const add = (
    event: Omit<SimulationEvent, "id" | "classification" | "source">,
  ) => {
    result.push({
      ...event,
      id: `source/${result.length}`,
      classification: "Confirmed",
      source: "simulator",
    });
  };
  for (const employee of park.employees)
    add({
      minute: minuteOf(employee.arrivalTime),
      type: "clock_in",
      employeeId: employee.employeeId,
      rotationId:
        employee.rotationId === "N/A" ? undefined : employee.rotationId,
      zone: employee.zone,
      payload: {},
    });
  add({ minute: 600, type: "park_open", payload: {} });
  add({ minute: minuteOf(config.closing), type: "park_close", payload: {} });
  add({
    minute: minuteOf(config.closing) + 30,
    type: "shift_end",
    payload: {},
  });
  for (const rotation of park.rotations) {
    const breaks = createSchedule(
      park.employees.filter((e) => e.rotationId === rotation.id),
      config.closing,
    );
    let previousEnd = 0;
    breaks.forEach((row, index) => {
      const variation =
        index > 0 &&
        config.scenario === "delayed" &&
        rotation.id === "SW-CC-01" &&
        index === 1
          ? 8
          : index > 0 && config.scenario === "seeded" && random() < 0.18
            ? 1 + Math.floor(random() * 4)
            : 0;
      const start =
        (index ? previousEnd + POLICY.transitionMinutes : row.baseline) +
        variation;
      add({
        minute: start,
        type: "break_started",
        rotationId: rotation.id,
        zone: rotation.zone,
        employeeId: row.employeeId,
        payload: { breakIndex: index },
      });
      // The fictional source records only FIRST break ends. WaveWatch infers second ends.
      if (row.number === 1)
        add({
          minute: start + row.duration,
          type: "break_ended",
          rotationId: rotation.id,
          zone: rotation.zone,
          employeeId: row.employeeId,
          payload: { breakIndex: index },
        });
      previousEnd = start + row.duration;
    });
  }
  return result.sort(
    (a, b) =>
      a.minute - b.minute ||
      Number(a.id.split("/")[1]) - Number(b.id.split("/")[1]),
  );
}
