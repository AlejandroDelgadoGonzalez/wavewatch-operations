import assert from "node:assert/strict";
import test from "node:test";
import park from "../data/blue_current_staffing.json" with { type: "json" };
import { createAnalyticsDataset } from "../analytics/dataset.ts";
import { generateWeek, DEMO_SEED } from "../analytics/generate.ts";
import { transformDay, transitionTiming } from "../analytics/transform.ts";
import {
  aggregate,
  analyticsView,
  filterHandoffs,
  sortHandoffs,
} from "../analytics/metrics.ts";
import { analyticsCsv, exportRows } from "../analytics/export.ts";
import { EMPTY_FILTERS } from "../analytics/model.ts";
import type { Handoff, AnalyticsSort } from "../analytics/model.ts";
const dataset = createAnalyticsDataset();

test("analytics handoff formula uses the existing 15-minute allowance", () => {
  assert.deepEqual(transitionTiming(715, 730), {
    expected_transition_minutes: 15,
    actual_transition_minutes: 15,
    delay_minutes: 0,
    on_time: true,
  });
  assert.deepEqual(transitionTiming(715, 738), {
    expected_transition_minutes: 15,
    actual_transition_minutes: 23,
    delay_minutes: 8,
    on_time: false,
  });
  assert.equal(transitionTiming(715, 727).on_time, true);
  assert.throws(() => transitionTiming(715, 714));
  assert.throws(() => transitionTiming(NaN, 730));
});
test("analytics aggregates weighted records, medians and delayed-only averages", () => {
  const rows: Handoff[] = [12, 15, 18, 23].map((n) => ({
    ...dataset.handoffs[0],
    ...transitionTiming(0, n),
  }));
  const m = aggregate(rows);
  assert.equal(m.total, 4);
  assert.equal(m.onTime, 2);
  assert.equal(m.delayed, 2);
  assert.equal(m.onTimeRate, 50);
  assert.equal(m.averageTransition, 17);
  assert.equal(m.medianTransition, 16.5);
  assert.equal(m.averageDelay, 5.5);
  assert.equal(m.averageDelayedTransition, 20.5);
  assert.equal(m.totalDelay, 11);
  assert.equal(m.maximumDelay, 8);
  assert.equal(aggregate(rows.slice(0, 3)).medianTransition, 15);
  assert.equal(aggregate(rows.slice(0, 2)).averageDelay, null);
  assert.equal(aggregate([]).averageTransition, null);
  assert.equal(aggregate([]).onTimeRate, null);
  assert.equal(aggregate([]).maximumDelay, null);
  assert.equal(aggregate([]).totalDelay, 0);
});
test("same analytics seed reproduces every record; another seed changes observations", () => {
  assert.equal(dataset.seed, DEMO_SEED);
  assert.deepEqual(createAnalyticsDataset(DEMO_SEED), dataset);
  assert.notDeepEqual(
    createAnalyticsDataset(DEMO_SEED + 1).handoffs,
    dataset.handoffs,
  );
  assert.throws(() => generateWeek(park, -1));
});
test("demo week contains seven completed days and all existing rotations with varied timing", () => {
  assert.equal(dataset.days.length, 7);
  assert.equal(dataset.days[0].date, "2026-09-07");
  assert.equal(dataset.days[6].date, "2026-09-13");
  assert.equal(
    new Set(dataset.handoffs.map((r) => r.event_id)).size,
    dataset.handoffs.length,
  );
  const view = analyticsView(dataset, park, EMPTY_FILTERS);
  assert.equal(view.rotations.length, 17);
  assert.equal(new Set(view.daily.map((d) => d.onTimeRate)).size, 7);
  assert.ok(view.daily.some((d) => d.onTimeRate! > 95));
  assert.ok(view.daily.some((d) => d.onTimeRate! < 80));
  assert.ok(view.overall.maximumDelay! >= 11);
  assert.ok(
    view.rotations.some(
      (r) =>
        dataset.days.filter((d) =>
          dataset.handoffs.some(
            (h) =>
              h.rotation_id === r.id &&
              h.operating_day === d.date &&
              !h.on_time,
          ),
        ).length >= 4,
    ),
  );
  assert.equal(
    view.buckets.reduce((n, b) => n + b.count, 0),
    view.overall.delayed,
  );
});
test("completed raw days preserve source evidence, calculated ends, bump activity and contract durations", () => {
  for (const day of generateWeek(park)) {
    assert.equal(day.state.ended, true);
    assert.deepEqual(
      transformDay(day),
      dataset.handoffs.filter((r) => r.operating_day === day.date),
    );
    for (const rotation of Object.values(day.state.rotations)) {
      assert.equal(rotation.finalApplied, true);
      for (const br of rotation.breaks) {
        assert.equal(br.end! - br.actual!, br.duration);
        assert.equal(
          br.endClassification,
          br.number === 1 ? "Confirmed" : "Calculated",
        );
      }
    }
    assert.ok(day.state.events.some((e) => e.classification === "Expected"));
    for (const row of transformDay(day)) {
      assert.equal(row.expected_next_break_start, row.previous_break_end + 15);
      assert.equal(
        row.delay_minutes,
        Math.max(0, row.actual_transition_minutes - 15),
      );
      assert.equal(row.data_classification, "Synthetic Simulation Data");
    }
    assert.throws(() =>
      transformDay({ ...day, state: { ...day.state, ended: false } }),
    );
  }
  assert.ok(dataset.handoffs.some((r) => r.evidence === "Confirmed"));
  assert.ok(dataset.handoffs.some((r) => r.evidence === "Calculated"));
});
test("daily and rotation aggregations reconcile with overall metrics", () => {
  const view = analyticsView(dataset, park, EMPTY_FILTERS);
  for (const groups of [view.daily, view.rotations]) {
    assert.equal(
      groups.reduce((n, r) => n + r.total, 0),
      view.overall.total,
    );
    assert.equal(
      groups.reduce((n, r) => n + r.totalDelay, 0),
      view.overall.totalDelay,
    );
    assert.ok(
      Math.abs(
        groups.reduce((n, r) => n + r.averageTransition! * r.total, 0) /
          view.overall.total -
          view.overall.averageTransition!,
      ) < 1e-10,
    );
  }
  for (const day of view.daily)
    assert.deepEqual(
      aggregate(dataset.handoffs.filter((r) => r.operating_day === day.id)),
      aggregate(
        filterHandoffs(dataset, park, { ...EMPTY_FILTERS, day: day.id }),
      ),
    );
});
test("all day, zone, role, rotation and employee filters use ID relationships", () => {
  for (const day of dataset.days)
    assert.ok(
      filterHandoffs(dataset, park, { ...EMPTY_FILTERS, day: day.date }).every(
        (r) => r.operating_day === day.date,
      ),
    );
  for (const zone of new Set(park.rotations.map((r) => r.zone))) {
    const rows = filterHandoffs(dataset, park, { ...EMPTY_FILTERS, zone });
    assert.ok(rows.length);
    assert.ok(
      rows.every(
        (r) =>
          park.rotations.find((x) => x.id === r.rotation_id)!.zone === zone,
      ),
    );
  }
  for (const group of new Set(park.rotations.map((r) => r.role))) {
    const rows = filterHandoffs(dataset, park, { ...EMPTY_FILTERS, group });
    assert.ok(rows.length);
    assert.ok(
      rows.every(
        (r) =>
          park.rotations.find((x) => x.id === r.rotation_id)!.role === group,
      ),
    );
  }
  for (const rotation of park.rotations)
    assert.ok(
      filterHandoffs(dataset, park, {
        ...EMPTY_FILTERS,
        rotation: rotation.id,
      }).every((r) => r.rotation_id === rotation.id),
    );
  for (const employee of park.employees) {
    const expected = dataset.handoffs.filter(
      (r) =>
        r.previous_break_employee_id === employee.employeeId ||
        r.next_break_employee_id === employee.employeeId,
    );
    assert.deepEqual(
      filterHandoffs(dataset, park, {
        ...EMPTY_FILTERS,
        employee: employee.employeeId,
      }),
      expected,
    );
    assert.equal(
      new Set(expected.map((r) => r.event_id)).size,
      expected.length,
    );
  }
});
test("combined filters, trimmed search, empty selections and reset are consistent and immutable", () => {
  const before = structuredClone(dataset),
    references = structuredClone(park);
  const record = dataset.handoffs[0],
    rotation = park.rotations.find((r) => r.id === record.rotation_id)!;
  const filters = {
    ...EMPTY_FILTERS,
    day: record.operating_day,
    zone: rotation.zone,
    group: rotation.role,
    rotation: rotation.id,
    employee: record.next_break_employee_id,
    query: `  ${rotation.name.toUpperCase()}  `,
  };
  const rows = filterHandoffs(dataset, park, filters);
  assert.ok(rows.length);
  assert.ok(rows.includes(record));
  assert.ok(
    rows.every(
      (r) => r.operating_day === filters.day && r.rotation_id === rotation.id,
    ),
  );
  assert.equal(
    filterHandoffs(dataset, park, { ...filters, query: "no-such-handoff" })
      .length,
    0,
  );
  const empty = analyticsView(dataset, park, {
    ...EMPTY_FILTERS,
    employee: "missing",
  });
  assert.equal(empty.overall.total, 0);
  assert.equal(empty.insights.length, 0);
  assert.ok(empty.daily.every((d) => d.onTimeRate === null));
  assert.deepEqual(
    filterHandoffs(dataset, park, { ...EMPTY_FILTERS }),
    dataset.handoffs,
  );
  assert.deepEqual(dataset, before);
  assert.deepEqual(park, references);
});
test("sorting and joined CSV export preserve source arrays and include only selected records", () => {
  const before = structuredClone(dataset.handoffs);
  for (const sort of [
    "time-asc",
    "time-desc",
    "delay-desc",
    "transition-desc",
    "rotation",
  ] as AnalyticsSort[]) {
    const rows = sortHandoffs(dataset.handoffs, sort);
    assert.notEqual(rows, dataset.handoffs);
    assert.equal(rows.length, before.length);
    if (sort === "delay-desc") assert.equal(rows[0].delay_minutes, 16);
  }
  const selected = dataset.handoffs.slice(0, 3),
    csv = analyticsCsv(selected, park);
  assert.equal(csv.trim().split("\r\n").length, 4);
  assert.equal(analyticsCsv([], park).trim().split("\r\n").length, 1);
  assert.equal(
    exportRows(selected, park)[0].zone,
    park.rotations.find((r) => r.id === selected[0].rotation_id)!.zone,
  );
  assert.ok(
    analyticsCsv(
      [{ ...selected[0], scenario: '=SUM(1,2) "demo"' }],
      park,
    ).includes('"\'=SUM(1,2) ""demo"""'),
  );
  assert.deepEqual(dataset.handoffs, before);
});
