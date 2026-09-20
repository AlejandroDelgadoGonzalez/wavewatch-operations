import type { Park, ParkState, SwapPosition } from "../domain/model.ts";

export function positionOf(
  state: ParkState,
  employeeId: string,
): SwapPosition | null {
  const rotationId = state.membership[employeeId];
  const slot =
    state.rotations[rotationId]?.assignments.indexOf(employeeId) ?? -1;
  return slot < 0 ? null : { employeeId, rotationId, slot };
}

/** Prototype data-integrity constraints, not real-world qualification policy. */
export function swapError(
  park: Park,
  state: ParkState,
  first: SwapPosition,
  second: SwapPosition,
): string | null {
  if (state.closed || state.ended)
    return "Swaps are unavailable after park closing.";
  if (first.employeeId === second.employeeId)
    return "Choose a different employee.";
  const a = park.employees.find((e) => e.employeeId === first.employeeId);
  const b = park.employees.find((e) => e.employeeId === second.employeeId);
  if (!a || !b) return "Unknown employee.";
  for (const expected of [first, second]) {
    const current = positionOf(state, expected.employeeId);
    if (
      !current ||
      current.rotationId !== expected.rotationId ||
      current.slot !== expected.slot
    )
      return "Assignment changed or employee is not assigned. Close and try again.";
  }
  if (first.rotationId === second.rotationId)
    return "Choose someone from another rotation.";
  if (a.jobRole !== b.jobRole) return "The prototype requires the same role.";
  if (a.arrivalTime !== b.arrivalTime)
    return "The prototype requires the same arrival time to preserve break plans.";
  if (first.slot !== second.slot)
    return "Both employees must be at the same position in their rotation cycle.";
  const remaining = (p: SwapPosition) =>
    state.rotations[p.rotationId].breaks
      .filter((row) => row.employeeId === p.employeeId && row.actual === null)
      .map((row) => [row.number, row.duration]);
  for (const p of [first, second]) {
    if (
      state.rotations[p.rotationId].breaks.some(
        (row) =>
          row.employeeId === p.employeeId &&
          row.actual !== null &&
          row.end === null,
      )
    )
      return "Wait until both employees have finished their current break.";
  }
  if (JSON.stringify(remaining(first)) !== JSON.stringify(remaining(second)))
    return "Remaining break plans must match before swapping.";
  return null;
}
