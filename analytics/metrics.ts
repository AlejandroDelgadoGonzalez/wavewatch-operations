import type { Park } from "../domain/model.ts";
import type {
  AnalyticsDataset,
  AnalyticsFilters,
  AnalyticsSort,
  GroupMetrics,
  Handoff,
  Metrics,
} from "./model.ts";
import { POLICY } from "../domain/schedule.ts";

export function aggregate(records: Handoff[]): Metrics {
  const total = records.length,
    delayed = records.filter((r) => !r.on_time);
  const durations = records
    .map((r) => r.actual_transition_minutes)
    .sort((a, b) => a - b);
  const sum = (
    rows: Handoff[],
    field: "actual_transition_minutes" | "delay_minutes",
  ) => rows.reduce((n, r) => n + r[field], 0);
  return {
    total,
    onTime: total - delayed.length,
    delayed: delayed.length,
    onTimeRate: total ? ((total - delayed.length) / total) * 100 : null,
    averageTransition: total
      ? sum(records, "actual_transition_minutes") / total
      : null,
    medianTransition: total
      ? (durations[Math.floor((total - 1) / 2)] +
          durations[Math.floor(total / 2)]) /
        2
      : null,
    averageDelay: delayed.length
      ? sum(delayed, "delay_minutes") / delayed.length
      : null,
    averageDelayedTransition: delayed.length
      ? sum(delayed, "actual_transition_minutes") / delayed.length
      : null,
    maximumDelay: total
      ? Math.max(...records.map((r) => r.delay_minutes))
      : null,
    totalDelay: sum(records, "delay_minutes"),
    calculated: records.filter((r) => r.evidence === "Calculated").length,
  };
}
export function filterHandoffs(
  dataset: AnalyticsDataset,
  park: Park,
  filters: AnalyticsFilters,
) {
  const search = filters.query.trim().toLowerCase();
  const rotations = new Map(park.rotations.map((r) => [r.id, r]));
  const employees = new Map(
    park.employees.map((e) => [e.employeeId, e.employeeName]),
  );
  return dataset.handoffs.filter((record) => {
    const rotation = rotations.get(record.rotation_id)!;
    return (
      (!filters.day || record.operating_day === filters.day) &&
      (!filters.zone || rotation.zone === filters.zone) &&
      (!filters.group || rotation.role === filters.group) &&
      (!filters.rotation || record.rotation_id === filters.rotation) &&
      (!filters.employee ||
        [
          record.previous_break_employee_id,
          record.next_break_employee_id,
        ].includes(filters.employee)) &&
      [
        record.operating_day,
        record.event_id,
        rotation.id,
        rotation.name,
        rotation.attraction,
        rotation.zone,
        rotation.role,
        record.previous_break_employee_id,
        record.next_break_employee_id,
        employees.get(record.previous_break_employee_id) ?? "",
        employees.get(record.next_break_employee_id) ?? "",
        record.on_time ? "on time" : "delayed",
      ].some((text) => text.toLowerCase().includes(search))
    );
  });
}
export function sortHandoffs(records: Handoff[], sort: AnalyticsSort) {
  const chronological = (a: Handoff, b: Handoff) =>
    a.operating_day.localeCompare(b.operating_day) ||
    a.actual_next_break_start - b.actual_next_break_start ||
    a.event_id.localeCompare(b.event_id);
  return records
    .slice()
    .sort(
      (a, b) =>
        (sort === "time-desc"
          ? -chronological(a, b)
          : sort === "delay-desc"
            ? b.delay_minutes - a.delay_minutes
            : sort === "transition-desc"
              ? b.actual_transition_minutes - a.actual_transition_minutes
              : sort === "rotation"
                ? a.rotation_id.localeCompare(b.rotation_id)
                : 0) || chronological(a, b),
    );
}
export function analyticsView(
  dataset: AnalyticsDataset,
  park: Park,
  filters: AnalyticsFilters,
) {
  const records = filterHandoffs(dataset, park, filters);
  const overall = aggregate(records);
  const daily: GroupMetrics[] = dataset.days
    .filter((day) => !filters.day || day.date === filters.day)
    .map((day) => ({
      id: day.date,
      label: new Intl.DateTimeFormat("en-US", {
        weekday: "long",
        timeZone: "UTC",
      }).format(new Date(`${day.date}T00:00:00Z`)),
      ...aggregate(records.filter((r) => r.operating_day === day.date)),
    }));
  const rotations: GroupMetrics[] = park.rotations
    .filter((rotation) => records.some((r) => r.rotation_id === rotation.id))
    .map((rotation) => ({
      id: rotation.id,
      label: rotation.name,
      ...aggregate(records.filter((r) => r.rotation_id === rotation.id)),
    }));
  const buckets = [
    { label: "1–2 min", min: 1, max: 2 },
    { label: "3–5 min", min: 3, max: 5 },
    { label: "6–10 min", min: 6, max: 10 },
    { label: "11+ min", min: 11, max: Infinity },
  ].map((bucket) => ({
    label: bucket.label,
    count: records.filter(
      (r) => r.delay_minutes >= bucket.min && r.delay_minutes <= bucket.max,
    ).length,
  }));
  const insights: string[] = [];
  if (overall.total) {
    insights.push(
      `${overall.onTimeRate!.toFixed(1)}% of ${overall.total} handoffs occurred within the ${POLICY.transitionMinutes}-minute allowance.`,
    );
    const largest = daily.reduce((a, b) =>
      a.totalDelay >= b.totalDelay ? a : b,
    );
    if (overall.delayed) {
      const tied = daily
        .filter((d) => d.totalDelay === largest.totalDelay)
        .map((d) => d.label)
        .join(", ");
      insights.push(
        `${tied} recorded the largest total delay in this selection: ${largest.totalDelay} minutes.`,
      );
      const small = buckets[0].count + buckets[1].count;
      insights.push(
        `${small} of ${overall.delayed} delayed handoffs (${((small / overall.delayed) * 100).toFixed(1)}%) were 1–5 minutes beyond the allowance.`,
      );
    } else insights.push("No delayed handoffs occurred in this selection.");
    if (filters.rotation && rotations[0])
      insights.push(
        `${rotations[0].id} averaged ${rotations[0].averageTransition!.toFixed(1)} minutes per handoff.`,
      );
  }
  return { records, overall, daily, rotations, buckets, insights };
}
