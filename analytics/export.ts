import type { Park } from "../domain/model.ts";
import type { Handoff } from "./model.ts";

export function exportRows(records: Handoff[], park: Park) {
  return records.map((row) => {
    const rotation = park.rotations.find((r) => r.id === row.rotation_id)!;
    return {
      ...row,
      rotation_name: rotation.name,
      attraction: rotation.attraction,
      zone: rotation.zone,
      employee_group: rotation.role,
    };
  });
}
export function analyticsCsv(records: Handoff[], park: Park) {
  const rows = exportRows(records, park);
  const columns = [
    "operating_day",
    "event_id",
    "rotation_id",
    "rotation_name",
    "attraction",
    "zone",
    "employee_group",
    "previous_break_employee_id",
    "next_break_employee_id",
    "previous_break_end",
    "expected_next_break_start",
    "actual_next_break_start",
    "expected_transition_minutes",
    "actual_transition_minutes",
    "delay_minutes",
    "on_time",
    "evidence",
    "data_classification",
    "break_number",
    "park_closing_time",
    "scenario",
    "simulation_seed",
  ] as const;
  const escape = (value: unknown) => {
    let text = String(value);
    if (/^[=+@\-]/.test(text)) text = `'${text}`;
    return `"${text.replaceAll('"', '""')}"`;
  };
  return (
    [
      columns.join(","),
      ...rows.map((row) =>
        columns.map((column) => escape(row[column])).join(","),
      ),
    ].join("\r\n") + "\r\n"
  );
}
