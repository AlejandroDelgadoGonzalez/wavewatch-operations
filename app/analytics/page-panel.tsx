"use client";
import { useMemo, useState } from "react";
import park from "../../data/blue_current_staffing.json";
import { getDemoWeek } from "../../analytics/dataset";
import { analyticsView } from "../../analytics/metrics";
import {
  EMPTY_FILTERS,
  type AnalyticsFilters,
  type Metrics,
} from "../../analytics/model";
import { POLICY } from "../../domain/schedule";
import {
  DailyDelayChart,
  DistributionChart,
  metric,
  RotationCharts,
  TrendChart,
} from "./charts";
import { HandoffTable } from "./handoff-table";
import "./analytics.css";

function SummaryMetrics({ overview }: { overview: Metrics }) {
  return (
    <>
      <section
        className="analytics-kpis"
        aria-label="Historical handoff metrics"
      >
        {[
          [
            "On-Time Rate",
            metric(overview.onTimeRate, "%"),
            `${overview.onTime} of ${overview.total} handoffs`,
            "rate",
          ],
          [
            "Average Transition",
            metric(overview.averageTransition, " min"),
            `${POLICY.transitionMinutes} min allowed`,
            "transition",
          ],
          [
            "Average Delay",
            metric(overview.averageDelay, " min"),
            "Among delayed handoffs only",
            "delay",
          ],
          [
            "Delayed Handoffs",
            String(overview.delayed),
            `${overview.totalDelay} total delay minutes`,
            "delayed",
          ],
        ].map(([title, value, sub, key]) => (
          <article key={key} className={`analytics-kpi kpi-${key}`}>
            <span>{title}</span>
            <strong data-testid={`analytics-${key}`}>{value}</strong>
            <small>{sub}</small>
          </article>
        ))}
      </section>
      <p className="analytics-evidence">
        {overview.total - overview.calculated} Confirmed · {overview.calculated}{" "}
        Calculated handoffs. Calculated values use an inferred second-break end.
        Total delay sums individual intervals; it is not park downtime.
      </p>
    </>
  );
}

export function AnalyticsPanel() {
  const [dataset] = useState(getDemoWeek);
  const [filters, setFilters] = useState<AnalyticsFilters>({
    ...EMPTY_FILTERS,
  });
  const [tab, setTab] = useState("Week Overview");
  const [resetVersion, setResetVersion] = useState(0);
  const view = useMemo(
    () => analyticsView(dataset, park, filters),
    [dataset, filters],
  );
  const set = (key: keyof AnalyticsFilters, value: string) =>
    setFilters((previous) => ({ ...previous, [key]: value }));
  const employee = park.employees.find(
    (e) => e.employeeId === filters.employee,
  );
  const rotation = park.rotations.find((r) => r.id === filters.rotation);
  const reset = () => {
    setFilters({ ...EMPTY_FILTERS });
    setResetVersion((version) => version + 1);
  };
  const context = [
    filters.day || "All 7 days",
    filters.zone || "All zones",
    filters.group || "All employee groups",
    rotation ? `${rotation.id} — ${rotation.name}` : "All rotations",
    employee
      ? `${employee.employeeName} — Associated Handoffs`
      : "All employees",
    filters.query.trim() ? `Search: ${filters.query.trim()}` : "",
  ].filter(Boolean);
  const overview = view.overall;
  return (
    <div className="analytics" data-testid="analytics">
      <div className="analytics-intro">
        <div>
          <span className="synthetic-label">Synthetic Simulation Data</span>
          <p>
            Operational timing analysis from synthetic Blue Current simulation
            data.
          </p>
          <p className="muted">
            Completed demo week · September 7–13, 2026 · seed {dataset.seed}.
            Separate from the live operating day.
          </p>
        </div>
        <div className="analytics-scope">
          <strong>7 completed days</strong>
          <span>17 rotations · 4 zones</span>
        </div>
      </div>
      <SummaryMetrics overview={overview} />
      <section
        className="analytics-panel analytics-filter-panel"
        aria-label="Analytics filters"
      >
        <div className="analytics-filters">
          <label>
            Day
            <select
              aria-label="Analytics day"
              value={filters.day}
              onChange={(e) => set("day", e.target.value)}
            >
              <option value="">All days</option>
              {dataset.days.map((day) => (
                <option key={day.date} value={day.date}>
                  {new Intl.DateTimeFormat("en-US", {
                    weekday: "long",
                    month: "short",
                    day: "numeric",
                    timeZone: "UTC",
                  }).format(new Date(`${day.date}T00:00:00Z`))}
                </option>
              ))}
            </select>
          </label>
          <label>
            Zone
            <select
              aria-label="Analytics zone"
              value={filters.zone}
              onChange={(e) => set("zone", e.target.value)}
            >
              <option value="">All zones</option>
              {[...new Set(park.rotations.map((r) => r.zone))].map((zone) => (
                <option key={zone}>{zone}</option>
              ))}
            </select>
          </label>
          <label>
            Employee group
            <select
              aria-label="Analytics employee group"
              value={filters.group}
              onChange={(e) => set("group", e.target.value)}
            >
              <option value="">All employee groups</option>
              {[...new Set(park.rotations.map((r) => r.role))].map((group) => (
                <option key={group}>{group}</option>
              ))}
            </select>
          </label>
          <label>
            Rotation
            <select
              aria-label="Analytics rotation"
              value={filters.rotation}
              onChange={(e) => set("rotation", e.target.value)}
            >
              <option value="">All rotations</option>
              {park.rotations.map((r) => (
                <option value={r.id} key={r.id}>
                  {r.id} — {r.name}
                </option>
              ))}
            </select>
          </label>
          <label>
            Employee association
            <select
              aria-label="Analytics employee"
              value={filters.employee}
              onChange={(e) => set("employee", e.target.value)}
            >
              <option value="">All employees</option>
              {park.employees.map((e) => (
                <option value={e.employeeId} key={e.employeeId}>
                  {e.employeeName} · {e.employeeId}
                </option>
              ))}
            </select>
          </label>
          <label className="analytics-search">
            Search records
            <input
              aria-label="Search analytics records"
              placeholder="Date, rotation, employee name or ID…"
              value={filters.query}
              onChange={(e) => set("query", e.target.value)}
            />
          </label>
          <button onClick={reset}>Reset Filters</button>
        </div>
        <div
          className="analytics-filter-context"
          aria-label="Active analytics filters"
        >
          {context.map((text) => (
            <span key={text}>{text}</span>
          ))}
        </div>
        <p role="status" data-testid="analytics-count">
          {overview.total} of {dataset.handoffs.length} handoffs in this
          selection
        </p>
      </section>
      <div className="analytics-tabs" role="group" aria-label="Analytics views">
        {["Week Overview", "Data Explorer"].map((name) => (
          <button
            key={name}
            aria-pressed={tab === name}
            onClick={() => setTab(name)}
          >
            {name}
          </button>
        ))}
      </div>
      {!overview.total ? (
        <section className="analytics-panel empty">
          <h2>No matching handoffs</h2>
          <p>
            Try another filter combination. Coordinators have no modeled
            handoffs.
          </p>
          <button onClick={reset}>Clear analytics filters</button>
        </section>
      ) : tab === "Data Explorer" ? (
        <HandoffTable
          key={`${resetVersion}/${JSON.stringify(filters)}`}
          park={park}
          records={view.records}
          label="Data Explorer"
        />
      ) : (
        <>
          <section
            className="analytics-panel insights"
            aria-label="Weekly Insights"
          >
            <h2>Weekly Insights</h2>
            <p className="muted">
              Calculated from the active filter selection.
            </p>
            <ul>
              {view.insights.map((insight) => (
                <li key={insight}>{insight}</li>
              ))}
            </ul>
          </section>
          {(rotation || employee) && (
            <section
              className="analytics-panel analytics-detail"
              aria-label={
                employee ? "Associated Handoffs" : "Rotation analytics detail"
              }
            >
              <h2>
                {employee
                  ? "Associated Handoffs"
                  : `${rotation!.id} — ${rotation!.name}`}
              </h2>
              {employee && (
                <p>
                  <strong>{employee.employeeName}</strong> ·{" "}
                  {employee.employeeId} · associated as previous or next break
                  employee; each handoff counted once.
                </p>
              )}
              {rotation && (
                <p>
                  {rotation.zone} · {rotation.attraction} · {rotation.role}
                </p>
              )}
              <p>
                Transition delays reflect the entire handoff process and cannot
                be attributed to an individual employee from these records
                alone.
              </p>
              <dl className="analytics-detail-metrics">
                {[
                  ["Associated handoffs", overview.total],
                  ["On-time handoffs", overview.onTime],
                  ["Delayed handoffs", overview.delayed],
                  ["On-time percentage", metric(overview.onTimeRate, "%")],
                  [
                    "Average observed transition",
                    metric(overview.averageTransition, " min"),
                  ],
                  [
                    "Average delayed transition",
                    metric(overview.averageDelayedTransition, " min"),
                  ],
                  [
                    "Average delay (delayed only)",
                    metric(overview.averageDelay, " min"),
                  ],
                  ["Maximum delay", metric(overview.maximumDelay, " min")],
                  ["Total delay", `${overview.totalDelay} min`],
                  [
                    "Median transition",
                    metric(overview.medianTransition, " min"),
                  ],
                ].map(([key, value]) => (
                  <div key={key}>
                    <dt>{key}</dt>
                    <dd>{value}</dd>
                  </div>
                ))}
              </dl>
              <p className="muted">
                Rotation associations:{" "}
                {view.rotations.map((r) => r.id).join(", ")}. The trend below
                follows this selection.
              </p>
            </section>
          )}
          <div className="analytics-chart-grid">
            <section
              className="analytics-panel"
              aria-label="Weekly on-time trend"
            >
              <h2>
                {employee
                  ? "Associated handoff daily trend"
                  : rotation
                    ? "Rotation daily trend"
                    : "Weekly On-Time Trend"}
              </h2>
              <p>
                On-time handoffs / all observed handoffs · no assumed target
                percentage
              </p>
              <TrendChart
                rows={view.daily}
                selectDay={(day) => set("day", day)}
              />
            </section>
            <section
              className="analytics-panel"
              aria-label="Daily delay minutes"
            >
              <h2>Daily Delay Minutes</h2>
              <p>Sum of minutes beyond the allowance</p>
              <DailyDelayChart
                rows={view.daily}
                selectDay={(day) => set("day", day)}
              />
            </section>
            <section
              className="analytics-panel"
              aria-label="Average transition by rotation"
            >
              <h2>Average Transition by Rotation</h2>
              <p>Select a rotation to inspect its history.</p>
              <RotationCharts
                rows={view.rotations}
                mode="average"
                selectRotation={(id) => set("rotation", id)}
              />
            </section>
            <section
              className="analytics-panel"
              aria-label="On-time versus delayed by rotation"
            >
              <h2>On Time vs Delayed</h2>
              <p>
                Share of handoffs · stable reference rotation order, not a
                ranking
              </p>
              <RotationCharts
                rows={view.rotations}
                mode="share"
                selectRotation={(id) => set("rotation", id)}
              />
            </section>
            <section
              className="analytics-panel"
              aria-label="Delay distribution"
            >
              <h2>Delay Distribution</h2>
              <p>
                Analytics buckets only — not operational severity definitions.
              </p>
              <DistributionChart rows={view.buckets} />
            </section>
            <section className="analytics-panel analytics-method">
              <h2>How to Read This Week</h2>
              <p>
                <span className="analytics-status on-time">On Time</span>{" "}
                Transition ≤ {POLICY.transitionMinutes} minutes.
              </p>
              <p>
                <span className="analytics-status delayed">Delayed</span>{" "}
                Transition &gt; {POLICY.transitionMinutes} minutes.
              </p>
              <p className="reference-key">
                Blue line = {POLICY.transitionMinutes}-minute allowance.
              </p>
              <p>
                Handoff delays represent the entire transition process and
                cannot be attributed to an individual employee based on the
                available data.
              </p>
              <p>
                Observed handoffs exclude opening arrival, the final return and
                Extra-cycle bumps: those have no pair of adjacent recorded break
                starts/ends.
              </p>
              <p>
                Median transition:{" "}
                <strong>{metric(overview.medianTransition, " min")}</strong> ·
                Maximum delay:{" "}
                <strong>{metric(overview.maximumDelay, " min")}</strong>.
              </p>
            </section>
          </div>
          {(rotation || employee) && (
            <HandoffTable
              key={`${resetVersion}/${JSON.stringify(filters)}`}
              park={park}
              records={view.records}
              label={
                employee
                  ? "Associated handoff history"
                  : "Rotation handoff history"
              }
            />
          )}
        </>
      )}
    </div>
  );
}
