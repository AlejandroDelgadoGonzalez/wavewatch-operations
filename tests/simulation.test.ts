import assert from "node:assert/strict";
import test from "node:test";
import park from "../data/blue_current_staffing.json" with { type: "json" };
import { SimulationEngine } from "../simulation/engine.ts";
import { createSourceEvents } from "../simulation/scenarios.ts";
import {
  applyObservation,
  initialState,
  projectTime,
} from "../operations/projection.ts";
import {
  alertsFor,
  activeBreak,
  summary,
  nextAction,
  bumpTimes,
  teamMembers,
  filterRotations,
  TEAM_ROLES,
  teamZoneOptions,
  describeEvent,
  offStandLabel,
} from "../operations/selectors.ts";
import {
  POLICY,
  CLOSINGS,
  minuteOf,
  rotate,
  postSchedule,
} from "../domain/schedule.ts";
import type { Config, ScenarioId } from "../domain/model.ts";
import { positionOf, swapError } from "../operations/swaps.ts";
const config: Config = { scenario: "normal", closing: "6:00 PM", seed: 2026 };
test("Rotation Board searches every data-defined stand with trimmed case-insensitive matching and combined filters", () => {
  const state = create().getSnapshot().state;
  const source = structuredClone(park),
    before = structuredClone(state);
  for (const rotation of park.rotations)
    for (const stand of rotation.stands) {
      assert.ok(
        filterRotations(park, state, `  ${stand.name.toUpperCase()}  `).some(
          (r) => r.id === rotation.id,
        ),
      );
    }
  for (const name of ["North Platform", "North Center", "North Transition"]) {
    assert.deepEqual(
      filterRotations(
        park,
        state,
        `  ${name.toLowerCase()}  `,
        "Deep Water Lifeguard",
        "Tidal Bay",
      ).map((r) => r.id),
      ["DW-BB-01"],
    );
    assert.equal(
      filterRotations(park, state, name, "Slide Operator", "Tidal Bay").length,
      0,
    );
    assert.equal(
      filterRotations(park, state, name, "Deep Water Lifeguard", "Current Cove")
        .length,
      0,
    );
  }
  assert.deepEqual(
    filterRotations(park, state, "Activity Island").map((r) => r.id),
    ["SW-CC-01"],
  );
  for (const query of [
    "Maya Nguyen",
    "SW-CC-01",
    "Tidepool Loop",
    "Tidepool Terrace",
  ])
    assert.ok(
      filterRotations(park, state, query).some((r) => r.id === "SW-CC-01"),
    );
  assert.equal(filterRotations(park, state, "   ").length, 17);
  assert.deepEqual(park, source);
  assert.deepEqual(state, before);
});

test("Team filters every role and zone including grouped coordinators and conditional Parkwide", () => {
  const state = create().getSnapshot().state;
  const counts = {
    "All roles": 74,
    Coordinator: 6,
    "Shallow Water Lifeguard": 32,
    "Deep Water Lifeguard": 12,
    "Slide Operator": 24,
  };
  for (const role of TEAM_ROLES)
    assert.equal(
      teamMembers(park, state, "", "name", role).length,
      counts[role],
    );
  const coordinators = teamMembers(park, state, "", "name", "Coordinator");
  assert.deepEqual(
    new Set(coordinators.map((e) => e.jobRole)),
    new Set(["Area Coordinator", "Base Coordinator", "Operations Lead"]),
  );
  assert.deepEqual(teamZoneOptions(park, state), [
    "Current Cove",
    "Tidal Bay",
    "Rapids Ridge",
    "Blue Peak",
    "Parkwide",
  ]);
  for (const zone of teamZoneOptions(park, state)) {
    assert.equal(
      teamMembers(park, state, "", "name", "All roles", zone).length,
      park.employees.filter((e) => e.zone === zone).length,
    );
  }
  assert.equal(
    teamMembers(park, state, "", "name", "Coordinator", "Parkwide").length,
    2,
  );
  const noParkwide = {
    ...park,
    employees: park.employees.filter((e) => e.zone !== "Parkwide"),
  };
  assert.equal(teamZoneOptions(noParkwide, state).includes("Parkwide"), false);
});

test("Team combines trimmed search role zone and stable sorting without mutating reference or state", () => {
  const state = create().getSnapshot().state;
  const source = structuredClone(park),
    before = structuredClone(state);
  for (const role of TEAM_ROLES)
    for (const zone of ["All zones", ...teamZoneOptions(park, state)])
      for (const sort of ["name", "arrival"] as const) {
        const expected = park.employees
          .filter(
            (e) =>
              `${e.employeeName} ${e.employeeId}`.toLowerCase().includes("n") &&
              (role === "All roles" ||
                (role === "Coordinator"
                  ? [
                      "Area Coordinator",
                      "Base Coordinator",
                      "Operations Lead",
                    ].includes(e.jobRole)
                  : e.jobRole === role)) &&
              (zone === "All zones" || e.zone === zone),
          )
          .sort(
            (a, b) =>
              (sort === "arrival"
                ? minuteOf(a.arrivalTime) - minuteOf(b.arrivalTime)
                : 0) ||
              a.employeeName.localeCompare(b.employeeName, "en") ||
              a.employeeId.localeCompare(b.employeeId, "en"),
          );
        assert.deepEqual(
          teamMembers(park, state, "  N  ", sort, role, zone).map(
            (e) => e.employeeId,
          ),
          expected.map((e) => e.employeeId),
        );
      }
  assert.equal(
    teamMembers(
      park,
      state,
      " BCAP-0001 ",
      "arrival",
      "Shallow Water Lifeguard",
      "Current Cove",
    ).length,
    1,
  );
  assert.equal(teamMembers(park, state, "missing employee", "name").length, 0);
  assert.equal(
    teamMembers(park, state, "", "name", "Slide Operator", "Parkwide").length,
    0,
  );
  assert.equal(
    teamMembers(park, state, "", "name", "All roles", "All zones").length,
    74,
  );
  assert.deepEqual(park, source);
  assert.deepEqual(state, before);
});

test("Team role and zone filters and Rotation Board employee search immediately follow swaps", () => {
  const engine = create();
  engine.advanceTo(670);
  const a = member("SW-CC-01"),
    b = member("SW-BB-01");
  engine.recordSwap(swapCommand(engine, a.employeeId, b.employeeId));
  const state = engine.getSnapshot().state;
  assert.equal(
    teamMembers(
      park,
      state,
      a.employeeId,
      "arrival",
      "Shallow Water Lifeguard",
      "Current Cove",
    ).length,
    0,
  );
  assert.equal(
    teamMembers(
      park,
      state,
      a.employeeId,
      "arrival",
      "Shallow Water Lifeguard",
      "Tidal Bay",
    )[0].rotationId,
    b.rotationId,
  );
  assert.equal(
    teamMembers(
      park,
      state,
      b.employeeId,
      "name",
      "Shallow Water Lifeguard",
      "Current Cove",
    )[0].rotationId,
    a.rotationId,
  );
  assert.deepEqual(
    filterRotations(park, state, a.employeeName).map((r) => r.id),
    [b.rotationId],
  );
  assert.equal(
    teamMembers(park, state, a.employeeId, "name", "Coordinator", "Tidal Bay")
      .length,
    0,
  );
});
test("swaps preserve each person's break entitlement across all closing schedules", () => {
  for (const closing of CLOSINGS) {
    const engine = new SimulationEngine(park, { ...config, closing });
    engine.advanceTo(670);
    const a = member("SW-CC-01"),
      b = member("SW-BB-01");
    engine.recordSwap(swapCommand(engine, a.employeeId, b.employeeId));
    engine.advanceTo(minuteOf(closing) + 30);
    const state = engine.getSnapshot().state;
    for (const e of [a, b]) {
      const completed = Object.values(state.rotations)
        .flatMap((r) => r.breaks)
        .filter((row) => row.employeeId === e.employeeId);
      assert.deepEqual(
        completed.map((row) => row.duration),
        (POLICY.breakPlans[closing] as Record<string, number[]>)[e.arrivalTime],
      );
      assert.ok(
        completed.every((row) => row.actual !== null && row.end !== null),
      );
    }
    assert.equal(
      new Set(Object.values(state.rotations).flatMap((r) => r.assignments))
        .size,
      68,
    );
  }
});

test("swaps after calculated break ends and in Extra cycle preserve histories and subsequent movement", () => {
  const engine = create();
  engine.advanceTo(910);
  const a = member("SW-CC-01", "8:00 AM"),
    b = member("SW-CC-02", "8:00 AM");
  engine.recordSwap(swapCommand(engine, a.employeeId, b.employeeId));
  const records = engine
    .getSnapshot()
    .state.events.filter(
      (e) => e.source === "simulator" || e.type === "employee_swap_recorded",
    );
  const replay = initialState(park, config, 450);
  for (let now = 450; now <= 910; now++) {
    replay.now = now;
    for (const event of records.filter(
      (e) => e.minute === now && e.source === "simulator",
    ))
      applyObservation(replay, event, park, config);
    projectTime(replay);
    for (const event of records.filter(
      (e) => e.minute === now && e.type === "employee_swap_recorded",
    ))
      applyObservation(replay, event, park, config);
  }
  assert.deepEqual(replay, engine.getSnapshot().state);
  engine.advanceTo(1015);
  engine.recordSwap(
    swapCommand(engine, a.employeeId, b.employeeId, "swap/extra"),
  );
  const before = [...rotation(engine).assignments];
  engine.advanceTo(1045);
  assert.deepEqual(rotation(engine).assignments, rotate(before));
  const history = Object.values(engine.getSnapshot().state.rotations)
    .flatMap((r) => r.breaks)
    .filter((row) => row.employeeId === a.employeeId);
  assert.equal(history.length, 2);
});
test("Bump Time separates recorded, calculated, and pending handoffs without employee blame", () => {
  const normal = create();
  normal.advanceTo(715);
  let handoff = bumpTimes(rotation(normal))[0];
  assert.equal(handoff.expected, POLICY.transitionMinutes);
  assert.equal(handoff.actual, null);
  assert.equal(handoff.classification, "Expected");
  normal.advanceTo(730);
  handoff = bumpTimes(rotation(normal))[0];
  assert.deepEqual(
    [
      handoff.start,
      handoff.end,
      handoff.actual,
      handoff.variance,
      handoff.classification,
    ],
    [715, 730, 15, 0, "Confirmed"],
  );
  const delayed = create("delayed");
  delayed.advanceTo(738);
  handoff = bumpTimes(rotation(delayed))[0];
  assert.deepEqual(
    [handoff.actual, handoff.variance, handoff.classification],
    [23, 8, "Confirmed"],
  );
  assert.equal("employeeId" in handoff, false);
  normal.advanceTo(925);
  assert.equal(bumpTimes(rotation(normal))[4].classification, "Calculated");
  assert.equal(bumpTimes(rotation(normal))[4].actual, 15);
});

const member = (rotationId: string, arrival = "9:00 AM") =>
  park.employees.find(
    (e) => e.rotationId === rotationId && e.arrivalTime === arrival,
  )!;
const swapCommand = (
  engine: SimulationEngine,
  firstId: string,
  secondId: string,
  id = "swap/test",
) => ({
  id,
  first: positionOf(engine.getSnapshot().state, firstId)!,
  second: positionOf(engine.getSnapshot().state, secondId)!,
});

test("swap is atomic, idempotent, updates Team and Activity, preserves history, and follows future bumps", () => {
  const engine = create();
  engine.advanceTo(715);
  const a = member("SW-CC-01"),
    b = member("SW-BB-01");
  const before = structuredClone(engine.getSnapshot().state);
  const command = swapCommand(engine, a.employeeId, b.employeeId);
  engine.recordSwap(command);
  const state = engine.getSnapshot().state;
  assert.equal(state.membership[a.employeeId], b.rotationId);
  assert.equal(state.membership[b.employeeId], a.rotationId);
  assert.equal(
    state.rotations[a.rotationId].assignments[command.first.slot],
    b.employeeId,
  );
  assert.equal(
    state.rotations[b.rotationId].assignments[command.second.slot],
    a.employeeId,
  );
  assert.deepEqual(state.events.slice(0, -1), before.events);
  assert.deepEqual(state.clockIns, before.clockIns);
  assert.deepEqual(
    state.rotations[a.rotationId].breaks[0],
    before.rotations[a.rotationId].breaks[0],
  );
  assert.equal(
    new Set(Object.values(state.rotations).flatMap((r) => r.assignments)).size,
    68,
  );
  assert.equal(
    teamMembers(park, state, a.employeeId, "name")[0].rotationId,
    b.rotationId,
  );
  assert.equal(
    teamMembers(park, state, a.employeeId, "name")[0].zone,
    "Tidal Bay",
  );
  assert.match(
    describeEvent(state.events.at(-1)!, park),
    /Employee swap recorded/,
  );
  assert.equal(state.events.at(-1)!.classification, "Confirmed");
  engine.recordSwap(command);
  assert.equal(engine.getSnapshot().state, state);
  engine.advanceTo(730);
  assert.equal(
    engine.getSnapshot().state.rotations[a.rotationId].assignments[3],
    b.employeeId,
  );
  assert.equal(
    engine.getSnapshot().state.rotations[a.rotationId].breaks[1].employeeId,
    b.employeeId,
  );
  assert.equal(
    engine
      .getSnapshot()
      .state.events.find(
        (e) =>
          e.type === "break_started" &&
          e.rotationId === a.rotationId &&
          e.payload.breakIndex === 1,
      )?.employeeId,
    b.employeeId,
  );
  engine.advanceTo(1110);
  for (const employee of [a, b]) {
    const starts = engine
      .getSnapshot()
      .state.events.filter(
        (e) =>
          e.type === "break_started" && e.employeeId === employee.employeeId,
      );
    assert.equal(starts.length, 2);
    assert.ok(starts.every((e) => e.rotationId !== employee.rotationId));
  }
  engine.restart();
  const clean = create();
  assert.deepEqual(engine.getSnapshot().state, clean.getSnapshot().state);
});

test("swap preserves completed breaks, supports replay and does not expose future timing", () => {
  for (const scenario of ["normal", "delayed", "seeded"] as const) {
    const engine = create(scenario);
    engine.advanceTo(715);
    const a = member("SW-CC-01", "8:00 AM"),
      b = member("SW-CC-02", "8:00 AM");
    engine.recordSwap(swapCommand(engine, a.employeeId, b.employeeId));
    engine.advanceTo(1110);
    const target = engine.getSnapshot().state;
    const records = target.events.filter(
      (e) => e.source === "simulator" || e.type === "employee_swap_recorded",
    );
    const replay = initialState(park, { ...config, scenario }, 450);
    let cursor = 0;
    for (let time = 450; time <= 1110; time++) {
      replay.now = time;
      while (cursor < records.length && records[cursor].minute <= time)
        applyObservation(replay, records[cursor++], park, {
          ...config,
          scenario,
        });
      projectTime(replay);
    }
    assert.deepEqual(replay, target);
    assert.equal(
      target.rotations[a.rotationId].breaks[0].employeeId,
      a.employeeId,
    );
    assert.equal(
      target.rotations[a.rotationId].breaks[4].employeeId,
      b.employeeId,
    );
    assert.equal(
      new Set(Object.values(target.rotations).flatMap((r) => r.assignments))
        .size,
      68,
    );
  }
});

test("invalid, stale, self, same-rotation, different-plan and active-break swaps leave state untouched", () => {
  const engine = create();
  engine.advanceTo(670);
  const a = member("SW-CC-01"),
    b = member("SW-CC-02");
  const command = swapCommand(engine, a.employeeId, b.employeeId);
  const before = engine.getSnapshot();
  const invalid = [
    { ...command, second: command.first },
    swapCommand(engine, a.employeeId, member("SW-CC-01", "9:45 AM").employeeId),
    swapCommand(engine, a.employeeId, member("SO-BP-01").employeeId),
    swapCommand(engine, a.employeeId, member("SW-CC-02", "9:45 AM").employeeId),
    swapCommand(
      engine,
      member("SW-CC-01", "8:00 AM").employeeId,
      member("SW-CC-02", "8:00 AM").employeeId,
    ),
    { ...command, second: { ...command.second, employeeId: "missing" } },
    { ...command, second: { ...command.second, rotationId: "N/A" } },
    { ...command, second: { ...command.second, slot: 99 } },
  ];
  for (const value of invalid) {
    assert.throws(() => engine.recordSwap(value));
    assert.equal(engine.getSnapshot(), before);
  }
  engine.start();
  assert.throws(() => engine.recordSwap(command), /Pause/);
  engine.pause();
  engine.advanceTo(730);
  assert.throws(() => engine.recordSwap(command), /Assignment changed/);
  const mixed = create("delayed");
  mixed.advanceTo(730);
  const mismatch = swapCommand(mixed, a.employeeId, b.employeeId);
  assert.match(
    swapError(
      park,
      mixed.getSnapshot().state,
      mismatch.first,
      mismatch.second,
    )!,
    /same position/,
  );
  engine.advanceTo(1080);
  assert.throws(
    () => engine.recordSwap(swapCommand(engine, a.employeeId, b.employeeId)),
    /closing/,
  );
});

test("Team filters before sorting, uses numeric arrival and stable name/ID ties without source mutation", () => {
  const engine = create();
  const before = structuredClone(park);
  const state = engine.getSnapshot().state;
  for (const sort of ["name", "arrival"] as const) {
    const rows = teamMembers(park, state, "", sort);
    assert.equal(rows.length, 74);
    for (let i = 1; i < rows.length; i++) {
      const a = rows[i - 1],
        b = rows[i];
      const time =
        sort === "arrival"
          ? minuteOf(a.arrivalTime) - minuteOf(b.arrivalTime)
          : 0;
      assert.ok(
        time < 0 ||
          (time === 0 &&
            a.employeeName.localeCompare(b.employeeName, "en") <= 0),
      );
    }
    assert.equal(
      teamMembers(park, state, "Maya Nguyen", sort)[0].employeeId,
      member("SW-CC-01", "8:00 AM").employeeId,
    );
    assert.equal(teamMembers(park, state, "not-found", sort).length, 0);
  }
  const twins = {
    ...park,
    employees: [
      { ...park.employees[0], employeeId: "Z" },
      { ...park.employees[0], employeeId: "A" },
    ],
  };
  assert.deepEqual(
    teamMembers(twins, state, "", "arrival").map((e) => e.employeeId),
    ["A", "Z"],
  );
  assert.deepEqual(park, before);
});

test("off-stand labels are readable through the full cycle", () => {
  const engine = create();
  for (const [time, label] of [
    [660, "Breaker"],
    [670, "On break"],
    [715, "Handoff / returning"],
    [1015, "Expected Extra"],
  ] as const) {
    engine.advanceTo(time);
    assert.equal(
      offStandLabel(engine.getSnapshot().state, rotation(engine)),
      label,
    );
  }
});
const create = (scenario: ScenarioId = "normal", seed = 2026) =>
  new SimulationEngine(park, { ...config, scenario, seed });
const rotation = (engine: SimulationEngine) =>
  engine.getSnapshot().state.rotations["SW-CC-01"];
const aliases = Object.fromEntries(
  park.employees
    .filter((e) => e.rotationId === "SW-CC-01")
    .map((e, i) => [e.employeeId, ["Avery", "Blake", "Cameron", "Dakota"][i]]),
);

test("closing cutoff is inclusive at exactly 30 minutes, exclusive one minute later", () => {
  const breaks = structuredClone(rotation(create()).breaks);
  breaks.at(-1)!.expected += 5;
  assert.deepEqual(postSchedule(breaks, config.closing).postBumps, [1050]);
  breaks.at(-1)!.expected += 1;
  assert.deepEqual(postSchedule(breaks, config.closing).postBumps, []);
});

test("second-break end estimates and closing status never become source confirmations", () => {
  const engine = create();
  engine.advanceTo(880);
  assert.equal(nextAction(rotation(engine), 880)?.classification, "Calculated");
  engine.advanceTo(1080);
  const state = engine.getSnapshot().state;
  assert.equal(summary(state).active, 0);
  assert.deepEqual(alertsFor(state), []);
  assert.equal(state.closed, true);
  assert.equal(state.ended, false);
  engine.advanceTo(1110);
  assert.equal(summary(engine.getSnapshot().state).clockedIn, 0);
  assert.equal(engine.getSnapshot().state.ended, true);
});

test("ROT-001: full simulator preserves final timings and assignments", () => {
  const engine = create();
  engine.advanceTo(1110);
  const r = rotation(engine);
  assert.equal(r.breaks.at(-1)?.end, 1000);
  assert.equal(r.finalBump, 1015);
  assert.deepEqual(r.postBumps, [1045]);
  assert.deepEqual(
    r.assignments.map((id) => aliases[id!]),
    ["Dakota", "Cameron", "Blake", "Avery"],
  );
  assert.equal(engine.getSnapshot().status, "complete");
});
test("ROT-002: no future leakage; delayed source event recalculates forecasts and removes bump", () => {
  const engine = create("delayed");
  engine.advanceTo(730);
  assert.equal(rotation(engine).delay, 0);
  assert.deepEqual(rotation(engine).postBumps, [1045]);
  engine.step();
  assert.ok(
    alertsFor(engine.getSnapshot().state).some(
      (a) => a.id === "SW-CC-01/overdue",
    ),
  );
  engine.advanceTo(738);
  const delayed = rotation(engine);
  assert.equal(delayed.breaks[1].actual, 738);
  assert.equal(delayed.delay, 8);
  assert.equal(delayed.breaks[2].expected, 783);
  assert.equal(delayed.finalBump, 1023);
  assert.deepEqual(delayed.postBumps, []);
  assert.equal(delayed.removedBumps, 1);
  engine.advanceTo(1110);
  assert.equal(rotation(engine).breaks.at(-1)?.end, 1008);
  assert.deepEqual(
    rotation(engine).assignments.map((id) => aliases[id!]),
    ["Cameron", "Blake", "Avery", "Dakota"],
  );
  assert.equal(
    engine
      .getSnapshot()
      .state.events.filter(
        (e) => e.rotationId === "SW-CC-01" && e.type === "post_bump",
      ).length,
    0,
  );
});
test("all supported closing schedules agree with the tested Python contract", () => {
  for (const closing of CLOSINGS) {
    const engine = new SimulationEngine(park, { ...config, closing });
    engine.advanceTo(minuteOf(closing) + 30);
    const expected = POLICY.reference[closing];
    const r = rotation(engine);
    assert.equal(
      r.breaks.at(-1)?.end,
      minuteOf(expected.post_break_schedule.last_break_end),
    );
    assert.equal(
      r.finalBump,
      minuteOf(expected.post_break_schedule.final_break_bump),
    );
    assert.deepEqual(
      r.postBumps,
      expected.post_break_schedule.post_break_bumps.map(minuteOf),
    );
    assert.deepEqual(
      r.assignments.map((id) => aliases[id!]),
      Object.values(expected.final_assignments),
    );
  }
});
test("clock start pause resume step speed restart and fractional time", () => {
  const engine = create();
  engine.tick(5);
  assert.equal(engine.getSnapshot().state.now, 450);
  engine.start();
  engine.start();
  engine.tick(0.5);
  assert.equal(engine.getSnapshot().state.now, 450);
  engine.pause();
  engine.tick(20);
  engine.start();
  engine.tick(0.5);
  assert.equal(engine.getSnapshot().state.now, 451);
  engine.setSpeed(5);
  engine.tick(1);
  assert.equal(engine.getSnapshot().state.now, 456);
  engine.setSpeed(15);
  engine.tick(1);
  assert.equal(engine.getSnapshot().state.now, 471);
  engine.step();
  assert.equal(engine.getSnapshot().state.now, 471);
  engine.pause();
  engine.step();
  assert.equal(engine.getSnapshot().state.now, 472);
  engine.restart();
  assert.equal(engine.getSnapshot().status, "ready");
  assert.equal(engine.getSnapshot().state.now, 450);
  assert.equal(engine.getSnapshot().state.processedIds.length, 1);
  assert.throws(() => engine.setSpeed(100));
  assert.throws(() => engine.tick(-1));
});
test("events execute once and stay chronological at every speed", () => {
  const fast = create("seeded");
  fast.start();
  fast.setSpeed(15);
  fast.tick(1000);
  const slow = create("seeded");
  for (let i = 450; i < 1110; i++) slow.step();
  assert.deepEqual(fast.getSnapshot().state, slow.getSnapshot().state);
  const events = fast.getSnapshot().state.events;
  assert.equal(new Set(events.map((e) => e.id)).size, events.length);
  assert.ok(events.every((e, i) => !i || e.minute >= events[i - 1].minute));
  fast.tick(100);
  fast.step();
  assert.equal(fast.getSnapshot().state.events.length, events.length);
});
test("same seed produces exact replay; different seeds vary conservative handoffs", () => {
  const a = create("seeded", 12),
    b = create("seeded", 12),
    c = create("seeded", 13);
  for (const engine of [a, b, c]) engine.advanceTo(1110);
  assert.deepEqual(a.getSnapshot().state, b.getSnapshot().state);
  assert.notDeepEqual(
    a.getSnapshot().state.events,
    c.getSnapshot().state.events,
  );
  assert.ok(
    a
      .getSnapshot()
      .state.events.filter((e) => e.type === "handoff_delay")
      .every((e) => e.payload.delay! <= 4),
  );
});
test("source references valid entities and never records second break ends", () => {
  const events = createSourceEvents(park, config);
  for (const e of events) {
    if (e.rotationId)
      assert.ok(park.rotations.some((r) => r.id === e.rotationId));
    if (e.employeeId) {
      const employee = park.employees.find(
        (p) => p.employeeId === e.employeeId,
      )!;
      assert.ok(employee);
      if (e.rotationId) assert.equal(employee.rotationId, e.rotationId);
    }
    assert.notEqual(e.type, "second_break_end");
    if (e.type === "break_ended") assert.ok(e.payload.breakIndex! < 4);
  }
});
test("opening, first bump and break transitions preserve sequence and evidence", () => {
  const engine = create();
  engine.advanceTo(600);
  assert.equal(summary(engine.getSnapshot().state).active, 17);
  assert.deepEqual(
    rotation(engine).assignments.map((id) => (id ? aliases[id] : null)),
    ["Cameron", "Blake", "Avery", null],
  );
  engine.advanceTo(660);
  assert.equal(rotation(engine).bumpCount, 0);
  engine.advanceTo(670);
  assert.deepEqual(
    rotation(engine).assignments.map((id) => aliases[id!]),
    ["Dakota", "Cameron", "Blake", "Avery"],
  );
  assert.ok(activeBreak(rotation(engine), 670));
  engine.advanceTo(715);
  assert.equal(activeBreak(rotation(engine), 715), undefined);
  assert.equal(rotation(engine).breaks[0].endClassification, "Confirmed");
  engine.advanceTo(910);
  assert.equal(rotation(engine).breaks[4].endClassification, "Calculated");
  engine.advanceTo(1015);
  assert.ok(rotation(engine).finalApplied);
  const before = [...rotation(engine).assignments];
  engine.advanceTo(1045);
  assert.deepEqual(rotation(engine).assignments, rotate(before));
});
test("recorded source stream alone reconstructs the same projection", () => {
  const engine = create("delayed");
  engine.advanceTo(1110);
  const projected = initialState(park, { ...config, scenario: "delayed" }, 450);
  const records = engine
    .getSnapshot()
    .state.events.filter((e) => e.source === "simulator");
  let cursor = 0;
  for (let time = 450; time <= 1110; time++) {
    projected.now = time;
    while (cursor < records.length && records[cursor].minute <= time)
      applyObservation(projected, records[cursor++], park, config);
    projectTime(projected);
  }
  assert.deepEqual(projected, engine.getSnapshot().state);
  const count = projected.events.length;
  applyObservation(projected, records[0], park, config);
  assert.equal(projected.events.length, count);
});
test("calculated preceding end gives estimated delay, never employee blame", () => {
  const engine = create("seeded", 2026);
  engine.advanceTo(1110);
  const delays = engine
    .getSnapshot()
    .state.events.filter((e) => e.type === "handoff_delay");
  assert.ok(delays.some((e) => e.payload.estimated));
  assert.ok(
    delays.every(
      (e) => e.classification === "Calculated" && e.employeeId === undefined,
    ),
  );
});
test("experimental notes are isolated, recorded once and cleared by restart", () => {
  const engine = create();
  const before = structuredClone(engine.getSnapshot().state.rotations);
  engine.injectExperimental(
    "temporary_closure",
    "SW-CC-01",
    "Need closure workflow requirements",
  );
  assert.deepEqual(engine.getSnapshot().state.rotations, before);
  assert.equal(
    engine.getSnapshot().state.events.at(-1)?.source,
    "simulation-lab",
  );
  engine.start();
  assert.throws(() =>
    engine.injectExperimental("temporary_closure", "SW-CC-01", "test"),
  );
  engine.restart();
  assert.equal(
    engine.getSnapshot().state.events.some((e) => e.type === "experimental"),
    false,
  );
});
