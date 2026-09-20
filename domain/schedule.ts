import contract from "../data/simulation_contract.json" with { type: "json" };
import type { Break, Closing, Employee } from "./model.ts";

export const POLICY = contract;
export const CLOSINGS = Object.keys(contract.breakPlans) as Closing[];
export const minuteOf = (text: string): number => {
  const match = /^(\d{1,2}):(\d{2}) (AM|PM)$/.exec(text);
  if (!match) throw new Error(`Invalid time: ${text}`);
  return ((+match[1] % 12) + (match[3] === "PM" ? 12 : 0)) * 60 + +match[2];
};
export const formatTime = (minute: number): string =>
  `${Math.floor(minute / 60) % 12 || 12}:${String(minute % 60).padStart(2, "0")} ${minute >= 720 ? "PM" : "AM"}`;
export function createSchedule(
  employees: Employee[],
  closing: Closing,
): Break[] {
  const reference = contract.reference[closing].timeline;
  return reference.map((row, index) => {
    const employee = employees.find((e) => e.arrivalTime === row.arrival);
    if (!employee) throw new Error(`Missing arrival ${row.arrival}`);
    return {
      id: `${employee.rotationId}/break/${index}`,
      employeeId: employee.employeeId,
      number: row.break_number,
      duration: row.duration_minutes,
      baseline: minuteOf(row.expected_start),
      expected: minuteOf(row.expected_start),
      actual: null,
      end: null,
      endClassification: "Expected",
      delay: 0,
    };
  });
}
export function postSchedule(breaks: Break[], closing: Closing) {
  const last = breaks[breaks.length - 1];
  const finalBump =
    (last.actual ?? last.expected) + last.duration + contract.transitionMinutes;
  const interval = contract.postBreakIntervals[closing];
  const postBumps: number[] = [];
  if (interval)
    for (
      let time = finalBump + interval;
      time <= minuteOf(closing) - contract.minimumMinutesAfterBump;
      time += interval
    )
      postBumps.push(time);
  return { finalBump, postBumps };
}
export const rotate = <T>(assignments: T[]): T[] => [
  assignments[3],
  ...assignments.slice(0, 3),
];
