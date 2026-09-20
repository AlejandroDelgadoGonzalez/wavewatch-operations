"use client";
import { useState } from "react";
import type { AnalyticsSort, Handoff } from "../../analytics/model";
import type { Park } from "../../domain/model";
import { formatTime } from "../../domain/schedule";
import { sortHandoffs } from "../../analytics/metrics";
import { analyticsCsv } from "../../analytics/export";

export function HandoffTable({
  records,
  park,
  label,
}: {
  records: Handoff[];
  park: Park;
  label: string;
}) {
  const [sort, setSort] = useState<AnalyticsSort>("time-asc");
  const [page, setPage] = useState(0);
  const sorted = sortHandoffs(records, sort),
    size = 25;
  const maxPage = Math.max(0, Math.ceil(sorted.length / size) - 1);
  const currentPage = Math.min(page, maxPage);
  const exportCsv = () => {
    const url = URL.createObjectURL(
      new Blob([analyticsCsv(sorted, park)], {
        type: "text/csv;charset=utf-8",
      }),
    );
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = "wavewatch-filtered-synthetic-handoffs.csv";
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  };
  return (
    <section className="analytics-panel" aria-label={label}>
      <div className="analytics-section-heading">
        <div>
          <h3>{label}</h3>
          <p>
            {records.length} matching records · all active analytics filters
            apply
          </p>
        </div>
        <button onClick={exportCsv} disabled={!records.length}>
          Export CSV
        </button>
      </div>
      <div className="explorer-controls">
        <label>
          Sort handoffs
          <select
            value={sort}
            onChange={(event) => {
              setSort(event.target.value as AnalyticsSort);
              setPage(0);
            }}
          >
            <option value="time-asc">Time (oldest first)</option>
            <option value="time-desc">Time (newest first)</option>
            <option value="delay-desc">Delay (largest first)</option>
            <option value="transition-desc">Transition (longest first)</option>
            <option value="rotation">Rotation ID</option>
          </select>
        </label>
        <p>Employee IDs identify association, not responsibility.</p>
      </div>
      <div
        className="table-scroll"
        tabIndex={0}
        aria-label={`${label}, scroll horizontally for more columns`}
      >
        <table>
          <caption className="sr-only">
            {label}. Synthetic handoff records; timestamps are local simulated
            times.
          </caption>
          <thead>
            <tr>
              {[
                "Day",
                "Rotation / zone",
                "Employee group",
                "Previous break end",
                "Next break start",
                "Break",
                "Transition",
                "Allowed",
                "Delay",
                "Status",
                "Evidence",
                "Associated employee IDs",
              ].map((title) => (
                <th scope="col" key={title}>
                  {title}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {sorted
              .slice(currentPage * size, (currentPage + 1) * size)
              .map((row) => {
                const rotation = park.rotations.find(
                  (r) => r.id === row.rotation_id,
                )!;
                return (
                  <tr
                    key={row.event_id}
                    className={row.on_time ? "" : "handoff-delayed"}
                  >
                    <td>{row.operating_day}</td>
                    <td>
                      <strong>{row.rotation_id}</strong>
                      <small>
                        {rotation.name} · {rotation.zone}
                      </small>
                    </td>
                    <td>{rotation.role}</td>
                    <td>{formatTime(row.previous_break_end)}</td>
                    <td>{formatTime(row.actual_next_break_start)}</td>
                    <td>{row.break_number}</td>
                    <td>{row.actual_transition_minutes} min</td>
                    <td>{row.expected_transition_minutes} min</td>
                    <td>{row.delay_minutes} min</td>
                    <td>
                      <span
                        className={`analytics-status ${row.on_time ? "on-time" : "delayed"}`}
                      >
                        {row.on_time ? "On Time" : "Delayed"}
                      </span>
                    </td>
                    <td>{row.evidence}</td>
                    <td>
                      {row.previous_break_employee_id} →{" "}
                      {row.next_break_employee_id}
                    </td>
                  </tr>
                );
              })}
          </tbody>
        </table>
      </div>
      {!records.length && (
        <p className="empty">No handoffs match the active filters.</p>
      )}
      <div className="explorer-pagination">
        <button
          disabled={currentPage === 0}
          onClick={() => setPage(currentPage - 1)}
        >
          Previous page
        </button>
        <span role="status">
          Page {currentPage + 1} of {maxPage + 1} · {records.length} records
        </span>
        <button
          disabled={currentPage === maxPage}
          onClick={() => setPage(currentPage + 1)}
        >
          Next page
        </button>
      </div>
      <p className="chart-note">
        CSV exports all matching rows in the selected order, not only this page.
        Clock values in CSV are minutes since midnight.
      </p>
    </section>
  );
}
