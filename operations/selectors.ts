import type {
  Alert,
  Classification,
  Config,
  Park,
  ParkState,
  RotationState,
  SimulationEvent,
} from "../domain/model.ts";
import { formatTime, minuteOf, POLICY } from "../domain/schedule.ts";
export function activeBreak(rotation: RotationState, now: number) {
  return rotation.breaks.find(
    (row) => row.actual !== null && row.actual <= now && row.end === null,
  );
}
export function phase(state: ParkState, rotation: RotationState): string {
  if (state.ended) return "Shift ended";
  if (state.closed) return "Park closed";
  if (!state.opened) return "Pre-opening";
  if (rotation.finalApplied) return "Extra cycle";
  if (activeBreak(rotation, state.now)) return "Break cycle";
  if (rotation.bumpCount > 0 || state.now >= 660) return "Handoff";
  return "Opening coverage";
}
export function alertsFor(state: ParkState): Alert[] {
  const alerts: Alert[] = [];
  if (state.closed) return alerts;
  for (const rotation of Object.values(state.rotations)) {
    const next = rotation.breaks.find((row) => row.actual === null);
    if (next && state.now > next.expected)
      alerts.push({
        id: `${rotation.id}/overdue`,
        rotationId: rotation.id,
        title: "Expected break not recorded",
        detail: `${state.now - next.expected} min past ${formatTime(next.expected)}; handoff completion remains unconfirmed.`,
        classification: "Expected",
        severity: "attention",
      });
    if (rotation.delay > 0)
      alerts.push({
        id: `${rotation.id}/delay`,
        rotationId: rotation.id,
        title: `${rotation.delay}-minute accumulated handoff delay`,
        detail: `${rotation.estimatedDelay ? `${rotation.estimatedDelay} min estimated from calculated break ends. ` : "Based on recorded first-break events. "}Remaining expectations adjusted; cause unknown.`,
        classification: "Calculated",
        severity: "attention",
      });
    if (rotation.removedBumps)
      alerts.push({
        id: `${rotation.id}/removed`,
        rotationId: rotation.id,
        title: "Post-break bump removed",
        detail: `${rotation.removedBumps} expected bump(s) no longer meet the closing cutoff.`,
        classification: "Expected",
        severity: "info",
      });
  }
  return alerts;
}
export function nextAction(rotation: RotationState, now: number) {
  const active = activeBreak(rotation, now);
  if (active)
    return {
      time: active.actual! + active.duration,
      label: "Break end",
      employeeId: active.employeeId,
      classification:
        active.number === 2 ? ("Calculated" as const) : ("Expected" as const),
    };
  const next = rotation.breaks.find((row) => row.actual === null);
  if (next)
    return {
      time: next.expected,
      label: "Next break",
      employeeId: next.employeeId,
      classification: "Expected" as const,
    };
  if (!rotation.finalApplied)
    return {
      time: rotation.finalBump,
      label: "Final bump",
      employeeId: null,
      classification: "Expected" as const,
    };
  const bump = rotation.postBumps.find((time) => time > now);
  return bump
    ? {
        time: bump,
        label: "Extra-cycle bump",
        employeeId: null,
        classification: "Expected" as const,
      }
    : null;
}
export function describeEvent(event: SimulationEvent, park: Park): string {
  const name =
    park.employees.find((e) => e.employeeId === event.employeeId)
      ?.employeeName ?? "Employee";
  switch (event.type) {
    case "employee_swap_recorded": {
      const swap = event.payload.swap!;
      const describe = (p: typeof swap.first) =>
        `${park.employees.find((e) => e.employeeId === p.employeeId)?.employeeName} (${p.rotationId})`;
      return `Employee swap recorded: ${describe(swap.first)} ↔ ${describe(swap.second)}`;
    }
    case "clock_in":
      return `${name} clocked in`;
    case "park_open":
      return "Park opened for the fictional operating day";
    case "park_close":
      return "Park closed; closing period started";
    case "shift_end":
      return "Scheduled operating day completed";
    case "break_started":
      return `${name} began break ${(event.payload.breakIndex ?? 0) >= 4 ? 2 : 1}`;
    case "break_ended":
      return `${name} ended first break`;
    case "second_break_end":
      return "Second break end calculated from recorded start";
    case "bump_inferred":
      return "Assignments advanced from break-start evidence";
    case "handoff_delay":
      return `${event.payload.delay}-minute handoff delay ${event.payload.estimated ? "estimated" : "detected"}; cause unknown`;
    case "timeline_recalculated":
      return "Remaining expected timeline recalculated";
    case "post_bump_removed":
      return "Expected post-break bump removed by closing cutoff";
    case "final_bump":
      return "Final bump expected complete; Extra cycle started";
    case "post_bump":
      return "Post-break bump expected complete";
    case "experimental":
      return `Experimental Simulation Event: ${event.payload.kind?.replaceAll("_", " ")} — ${event.payload.note}`;
  }
}
export function planFor(employeeArrival: string, config: Config) {
  return (
    (POLICY.breakPlans[config.closing] as Record<string, number[]>)[
      employeeArrival
    ] ?? []
  );
}
export function summary(state: ParkState) {
  const rotations = Object.values(state.rotations);
  return {
    active: state.opened && !state.closed ? rotations.length : 0,
    breakCycle: state.closed
      ? 0
      : rotations.filter((r) => r.bumpCount > 0 && !r.finalApplied).length,
    extra: state.closed ? 0 : rotations.filter((r) => r.finalApplied).length,
    onBreak: rotations.filter((r) => activeBreak(r, state.now)).length,
    delayed: state.closed
      ? 0
      : rotations.filter(
          (r) =>
            r.delay > 0 ||
            r.breaks.some((b) => b.actual === null && b.expected < state.now),
        ).length,
    upcoming: state.closed
      ? 0
      : rotations.filter((r) => {
          const next = nextAction(r, state.now);
          return next && next.time >= state.now && next.time <= state.now + 15;
        }).length,
    clockedIn: state.ended ? 0 : Object.keys(state.clockIns).length,
  };
}
export function parkStatus(state: ParkState) {
  return state.ended
    ? "Day complete"
    : state.closed
      ? "Closing period"
      : state.opened
        ? "Park open"
        : "Pre-opening";
}
export function percentOfDay(now: number, config: Config) {
  return ((now - 450) / (minuteOf(config.closing) + 30 - 450)) * 100;
}

export function offStandLabel(state: ParkState, rotation: RotationState) {
  return rotation.finalApplied
    ? "Expected Extra"
    : activeBreak(rotation, state.now)
      ? "On break"
      : rotation.bumpCount
        ? "Handoff / returning"
        : "Breaker";
}

export function bumpTimes(rotation: RotationState) {
  return rotation.breaks.slice(1).map((next, index) => {
    const previous = rotation.breaks[index];
    const complete = previous.end !== null && next.actual !== null;
    const actual = complete ? next.actual! - previous.end! : null;
    const classification: Classification = !complete
      ? "Expected"
      : previous.endClassification === "Confirmed"
        ? "Confirmed"
        : "Calculated";
    return {
      id: `${previous.id}/handoff`,
      start: previous.end,
      end: next.actual,
      expected: POLICY.transitionMinutes,
      actual,
      variance: actual === null ? null : actual - POLICY.transitionMinutes,
      classification,
    };
  });
}

export type TeamSort = "name" | "arrival";
export const TEAM_ROLES = [
  "All roles",
  "Coordinator",
  "Shallow Water Lifeguard",
  "Deep Water Lifeguard",
  "Slide Operator",
] as const;
export type TeamRole = (typeof TEAM_ROLES)[number];
const coordinatorRoles = new Set([
  "Area Coordinator",
  "Base Coordinator",
  "Operations Lead",
]);

export function filterRotations(
  park: Park,
  state: ParkState,
  query: string,
  role = "All roles",
  zone = "All zones",
) {
  const search = query.trim().toLowerCase();
  return park.rotations.filter(
    (rotation) =>
      (zone === "All zones" || rotation.zone === zone) &&
      (role === "All roles" || rotation.role === role) &&
      [
        rotation.id,
        rotation.name,
        rotation.attraction,
        ...rotation.stands.map((stand) => stand.name),
        ...park.employees
          .filter(
            (employee) => state.membership[employee.employeeId] === rotation.id,
          )
          .map((employee) => employee.employeeName),
      ].some((value) => value.toLowerCase().includes(search)),
  );
}

export function teamZoneOptions(park: Park, state: ParkState) {
  return [
    ...new Set([
      ...park.rotations.map((rotation) => rotation.zone),
      ...teamMembers(park, state, "", "name").map((employee) => employee.zone),
    ]),
  ];
}

export function teamMembers(
  park: Park,
  state: ParkState,
  query: string,
  sort: TeamSort,
  role: TeamRole = "All roles",
  zone = "All zones",
) {
  return park.employees
    .filter((e) =>
      `${e.employeeName} ${e.employeeId}`
        .toLowerCase()
        .includes(query.trim().toLowerCase()),
    )
    .map((e) => {
      const rotationId = state.membership[e.employeeId];
      const rotation = park.rotations.find((r) => r.id === rotationId);
      return { ...e, rotationId, zone: rotation?.zone ?? e.zone };
    })
    .filter(
      (employee) =>
        (role === "All roles" ||
          (role === "Coordinator"
            ? coordinatorRoles.has(employee.jobRole)
            : employee.jobRole === role)) &&
        (zone === "All zones" || employee.zone === zone),
    )
    .sort(
      (a, b) =>
        (sort === "arrival"
          ? minuteOf(a.arrivalTime) - minuteOf(b.arrivalTime)
          : 0) ||
        a.employeeName.localeCompare(b.employeeName, "en") ||
        a.employeeId.localeCompare(b.employeeId, "en"),
    );
}
