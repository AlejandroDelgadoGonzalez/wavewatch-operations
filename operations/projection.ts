import type {
  Classification,
  Config,
  Park,
  ParkState,
  RotationState,
  SimulationEvent,
} from "../domain/model.ts";
import {
  createSchedule,
  postSchedule,
  rotate,
  POLICY,
} from "../domain/schedule.ts";
import { swapError } from "./swaps.ts";

export function initialState(
  park: Park,
  config: Config,
  now: number,
): ParkState {
  return {
    now,
    clockIns: {},
    membership: Object.fromEntries(
      park.employees.map((e) => [e.employeeId, e.rotationId]),
    ),
    events: [],
    processedIds: [],
    closed: false,
    opened: false,
    ended: false,
    rotations: Object.fromEntries(
      park.rotations.map((rotation) => {
        const breaks = createSchedule(
          park.employees.filter((e) => e.rotationId === rotation.id),
          config.closing,
        );
        return [
          rotation.id,
          {
            id: rotation.id,
            assignments: [null, null, null, null],
            breaks,
            delay: 0,
            estimatedDelay: 0,
            ...postSchedule(breaks, config.closing),
            appliedBumps: [],
            finalApplied: false,
            removedBumps: 0,
            bumpCount: 0,
          },
        ];
      }),
    ),
  };
}

function derived(
  state: ParkState,
  rotation: RotationState,
  type: SimulationEvent["type"],
  classification: Classification,
  payload: SimulationEvent["payload"] = {},
) {
  const event: SimulationEvent = {
    id: `derived/${rotation.id}/${type}/${state.now}`,
    minute: state.now,
    rotationId: rotation.id,
    source: "wavewatch",
    classification,
    type,
    payload,
  };
  if (!state.events.some((e) => e.id === event.id)) state.events.push(event);
}

/** Receives observations only: no access to the simulator's future event queue. */
export function applyObservation(
  state: ParkState,
  event: SimulationEvent,
  park: Park,
  config: Config,
) {
  if (state.processedIds.includes(event.id)) return;
  if (event.type === "employee_swap_recorded") {
    const swap = event.payload.swap;
    if (
      !swap ||
      event.minute !== state.now ||
      event.classification !== "Confirmed" ||
      event.source !== "wavewatch"
    )
      throw new Error("Invalid swap observation.");
    const error = swapError(park, state, swap.first, swap.second);
    if (error) throw new Error(error);
    for (const [from, to] of [
      [swap.first, swap.second],
      [swap.second, swap.first],
    ]) {
      const r = state.rotations[from.rotationId];
      r.assignments[from.slot] = to.employeeId;
      state.membership[to.employeeId] = from.rotationId;
      for (const row of r.breaks)
        if (row.employeeId === from.employeeId && row.actual === null)
          row.employeeId = to.employeeId;
    }
  }
  state.processedIds.push(event.id);
  state.events.push(event);
  const rotation = event.rotationId
    ? state.rotations[event.rotationId]
    : undefined;
  if (event.type === "clock_in" && event.employeeId) {
    state.clockIns[event.employeeId] = event.minute;
    const employee = park.employees.find(
      (e) => e.employeeId === event.employeeId,
    )!;
    if (rotation) {
      const slot =
        employee.startingAssignment === "Breaker"
          ? 3
          : Number(employee.startingAssignment.slice(-1)) - 1;
      rotation.assignments[slot] = employee.employeeId;
    }
  }
  if (event.type === "park_open") state.opened = true;
  if (event.type === "park_close") state.closed = true;
  if (event.type === "shift_end") state.ended = true;
  if (!rotation || event.payload.breakIndex === undefined) return;
  const index = event.payload.breakIndex;
  const row = rotation.breaks[index];
  if (event.type === "break_ended") {
    row.end = event.minute;
    row.endClassification = "Confirmed";
  }
  if (event.type !== "break_started") return;
  const delta = event.minute - row.expected;
  row.actual = event.minute;
  const previous = rotation.breaks[index - 1];
  const previousEnd =
    previous?.end ??
    (previous
      ? (previous.actual ?? previous.expected) + previous.duration
      : null);
  const delay =
    previousEnd === null
      ? Math.max(0, delta)
      : Math.max(0, event.minute - previousEnd - POLICY.transitionMinutes);
  row.delay = delay;
  rotation.assignments = rotate(rotation.assignments);
  rotation.bumpCount += 1;
  derived(state, rotation, "bump_inferred", "Calculated", {
    breakIndex: index,
  });
  if (delay > 0) {
    const estimated = previous?.endClassification !== "Confirmed";
    rotation.delay += delay;
    if (estimated) rotation.estimatedDelay += delay;
    derived(state, rotation, "handoff_delay", "Calculated", {
      delay,
      estimated,
    });
  }
  if (delta !== 0) {
    for (const future of rotation.breaks.slice(index + 1))
      if (future.actual === null) future.expected += delta;
    const before = rotation.postBumps.length;
    Object.assign(rotation, postSchedule(rotation.breaks, config.closing));
    derived(state, rotation, "timeline_recalculated", "Expected", {
      delay: delta,
    });
    if (before > rotation.postBumps.length) {
      const removed = before - rotation.postBumps.length;
      rotation.removedBumps += removed;
      derived(state, rotation, "post_bump_removed", "Expected", { removed });
    }
  }
}

/** Mathematical inferences occur as virtual time passes, never as fabricated source records. */
export function projectTime(state: ParkState) {
  for (const rotation of Object.values(state.rotations)) {
    for (const [index, row] of rotation.breaks.entries()) {
      if (
        row.number === 2 &&
        row.actual !== null &&
        row.end === null &&
        state.now >= row.actual + row.duration
      ) {
        row.end = row.actual + row.duration;
        row.endClassification = "Calculated";
        derived(state, rotation, "second_break_end", "Calculated", {
          breakIndex: index,
        });
      }
    }
    if (
      !rotation.finalApplied &&
      state.now >= rotation.finalBump &&
      rotation.breaks.every((row) => row.end !== null)
    ) {
      rotation.assignments = rotate(rotation.assignments);
      rotation.bumpCount += 1;
      rotation.finalApplied = true;
      derived(state, rotation, "final_bump", "Expected");
    }
    for (const time of rotation.postBumps)
      if (
        rotation.finalApplied &&
        state.now >= time &&
        !rotation.appliedBumps.includes(time)
      ) {
        rotation.assignments = rotate(rotation.assignments);
        rotation.bumpCount += 1;
        rotation.appliedBumps.push(time);
        derived(state, rotation, "post_bump", "Expected");
      }
  }
}
