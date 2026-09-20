import { POLICY } from "../domain/schedule.ts";
import type { CompletedDay, Handoff } from "./model.ts";

export function transitionTiming(previousEnd: number, nextStart: number) {
  if (
    !Number.isFinite(previousEnd) ||
    !Number.isFinite(nextStart) ||
    nextStart < previousEnd
  )
    throw new Error("Invalid handoff endpoints.");
  const actual = nextStart - previousEnd;
  return {
    expected_transition_minutes: POLICY.transitionMinutes,
    actual_transition_minutes: actual,
    delay_minutes: Math.max(0, actual - POLICY.transitionMinutes),
    on_time: actual <= POLICY.transitionMinutes,
  };
}

/** Normalize completed observations; do not manufacture missing first-break ends. */
export function transformDay(day: CompletedDay): Handoff[] {
  if (!day.state.ended)
    throw new Error("Analytics requires a completed operating day.");
  const records: Handoff[] = [];
  for (const rotation of Object.values(day.state.rotations)) {
    rotation.breaks.slice(1).forEach((next, index) => {
      const previous = rotation.breaks[index];
      if (previous.end === null || next.actual === null) return;
      const observation = day.state.events.find(
        (e) =>
          e.type === "break_started" &&
          e.rotationId === rotation.id &&
          e.payload.breakIndex === index + 1,
      );
      if (!observation)
        throw new Error("Break-start source observation is missing.");
      records.push({
        operating_day: day.date,
        event_id: `${day.date}/${observation.id}`,
        rotation_id: rotation.id,
        previous_break_employee_id: previous.employeeId,
        next_break_employee_id: next.employeeId,
        previous_break_end: previous.end,
        ...transitionTiming(previous.end, next.actual),
        expected_next_break_start: previous.end + POLICY.transitionMinutes,
        actual_next_break_start: next.actual,
        evidence:
          previous.endClassification === "Confirmed" &&
          observation.classification === "Confirmed"
            ? "Confirmed"
            : "Calculated",
        data_classification: "Synthetic Simulation Data",
        break_number: next.number,
        park_closing_time: day.closing,
        scenario: day.scenario,
        simulation_seed: day.seed,
      });
    });
  }
  return records.sort(
    (a, b) =>
      a.actual_next_break_start - b.actual_next_break_start ||
      a.rotation_id.localeCompare(b.rotation_id),
  );
}
