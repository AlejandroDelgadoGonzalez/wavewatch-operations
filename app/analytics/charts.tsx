"use client";
import { useId, useState, type ReactNode } from "react";
import type { GroupMetrics, Metrics } from "../../analytics/model";
import { POLICY } from "../../domain/schedule";

export const metric = (value: number | null, suffix = "") =>
  value === null ? "—" : `${value.toFixed(1)}${suffix}`;
export function metricContext(name: string, row: Metrics) {
  return `${name}. On time: ${metric(row.onTimeRate, "%")} (${row.onTime} of ${row.total}). Delayed handoffs: ${row.delayed}. Average transition: ${metric(row.averageTransition, " min")}. Allowed: ${POLICY.transitionMinutes} min. Average delay among delayed handoffs: ${metric(row.averageDelay, " min")}. Total delay: ${row.totalDelay} min. Largest delay: ${row.maximumDelay ?? "—"} min.`;
}
function ChartTarget({
  children,
  detail,
  onClick,
}: {
  children: ReactNode;
  detail: string;
  onClick?: () => void;
}) {
  const [visible, setVisible] = useState(false);
  const id = useId();
  return (
    <div
      className="chart-target"
      onMouseEnter={() => setVisible(true)}
      onMouseLeave={() => setVisible(false)}
    >
      <button
        type="button"
        aria-label={detail}
        aria-describedby={visible ? id : undefined}
        onClick={onClick}
        onFocus={() => setVisible(true)}
        onBlur={() => setVisible(false)}
        onKeyDown={(event) => {
          if (event.key === "Escape") setVisible(false);
        }}
      >
        {children}
      </button>
      {visible && (
        <div className="analytics-tooltip" id={id} role="tooltip">
          {detail}
        </div>
      )}
    </div>
  );
}
export function TrendChart({
  rows,
  selectDay,
}: {
  rows: GroupMetrics[];
  selectDay: (day: string) => void;
}) {
  const point = (row: GroupMetrics, index: number) =>
    `${rows.length === 1 ? 350 : 50 + (index * 600) / (rows.length - 1)},${180 - (row.onTimeRate ?? 0) * 1.5}`;
  // Missing days remain gaps; no fabricated zero-rate points.
  const segments: string[] = [];
  let segment: string[] = [];
  rows.forEach((row, index) => {
    if (row.total) segment.push(point(row, index));
    else if (segment.length) {
      segments.push(segment.join(" "));
      segment = [];
    }
  });
  if (segment.length) segments.push(segment.join(" "));
  return (
    <div className="trend-chart">
      <svg viewBox="0 0 700 215" aria-hidden="true">
        {[0, 25, 50, 75, 100].map((value) => (
          <g key={value}>
            <line
              x1="50"
              x2="650"
              y1={180 - value * 1.5}
              y2={180 - value * 1.5}
              className="chart-grid-line"
            />
            <text x="40" y={185 - value * 1.5} textAnchor="end">
              {value}%
            </text>
          </g>
        ))}
        {segments.map((points, index) => (
          <polyline
            key={index}
            points={points}
            fill="none"
            className="trend-line"
          />
        ))}
        {rows.map((row, index) => (
          <g key={row.id}>
            <title>{metricContext(`${row.label}, ${row.id}`, row)}</title>
            {row.total > 0 && (
              <circle
                cx={
                  rows.length === 1
                    ? 350
                    : 50 + (index * 600) / (rows.length - 1)
                }
                cy={180 - row.onTimeRate! * 1.5}
                r="5"
                className="trend-point"
              />
            )}
            <text
              x={
                rows.length === 1 ? 350 : 50 + (index * 600) / (rows.length - 1)
              }
              y="205"
              textAnchor="middle"
            >
              {row.label.slice(0, 3)}
            </text>
          </g>
        ))}
      </svg>
      <div className="trend-values">
        {rows.map((row) => (
          <ChartTarget
            key={row.id}
            detail={metricContext(`${row.label}, ${row.id}`, row)}
            onClick={() => selectDay(row.id)}
          >
            <span>{row.label.slice(0, 3)}</span>
            <strong>{metric(row.onTimeRate, "%")}</strong>
          </ChartTarget>
        ))}
      </div>
      <p className="chart-note">
        Select a day to inspect it. Missing observations display —, not 0%.
      </p>
    </div>
  );
}
export function RotationCharts({
  rows,
  mode,
  selectRotation,
}: {
  rows: GroupMetrics[];
  mode: "average" | "share";
  selectRotation: (id: string) => void;
}) {
  const maximum = Math.max(
    POLICY.transitionMinutes * 1.5,
    ...rows.map((r) => r.averageTransition ?? 0),
  );
  return (
    <div className="rotation-bars" data-chart={mode}>
      {mode === "average" ? (
        <p className="reference-key">
          ┃ {POLICY.transitionMinutes}-minute allowance · scale 0–
          {maximum.toFixed(1)} min
        </p>
      ) : (
        <p className="chart-note">
          <span className="on-time-text">● On Time</span> ·{" "}
          <span className="delayed-text">▨ Delayed</span> · each bar = 100%
        </p>
      )}
      {rows.map((row) => (
        <ChartTarget
          key={row.id}
          detail={metricContext(`${row.id} — ${row.label}`, row)}
          onClick={() => selectRotation(row.id)}
        >
          <span className="bar-name">
            <strong>{row.label}</strong>
            <small>{row.id}</small>
          </span>
          <span className="bar-content">
            <span className="bar-track">
              {mode === "average" ? (
                <>
                  <span
                    className={`bar-fill ${row.averageTransition! <= POLICY.transitionMinutes ? "on-time-fill" : "delayed-fill"}`}
                    style={{
                      width: `${(row.averageTransition! / maximum) * 100}%`,
                    }}
                  />
                  <span
                    className="allowance-line"
                    style={{
                      left: `${(POLICY.transitionMinutes / maximum) * 100}%`,
                    }}
                  />
                </>
              ) : (
                <>
                  <span
                    className="on-time-fill"
                    style={{ width: `${row.onTimeRate}%` }}
                  />
                  <span
                    className="delayed-fill"
                    style={{ width: `${100 - row.onTimeRate!}%` }}
                  />
                </>
              )}
            </span>
            <span className="bar-reading">
              {mode === "average"
                ? `${metric(row.averageTransition, " min")} · ${row.averageTransition! <= POLICY.transitionMinutes ? "Within allowance" : "Above allowance"}`
                : `${metric(row.onTimeRate, "% On Time")} · ${metric(100 - row.onTimeRate!, "% Delayed")}`}
            </span>
          </span>
        </ChartTarget>
      ))}
    </div>
  );
}
export function DailyDelayChart({
  rows,
  selectDay,
}: {
  rows: GroupMetrics[];
  selectDay: (id: string) => void;
}) {
  const max = Math.max(1, ...rows.map((r) => r.totalDelay));
  return (
    <div className="daily-bars">
      {rows.map((row) => (
        <ChartTarget
          key={row.id}
          detail={metricContext(`${row.label}, ${row.id}`, row)}
          onClick={() => selectDay(row.id)}
        >
          <span>{row.label.slice(0, 3)}</span>
          <span className="bar-track">
            <span
              className="bar-fill delayed-fill"
              style={{ width: `${(row.totalDelay / max) * 100}%` }}
            />
          </span>
          <strong>{row.totalDelay} min</strong>
        </ChartTarget>
      ))}
    </div>
  );
}
export function DistributionChart({
  rows,
}: {
  rows: { label: string; count: number }[];
}) {
  const max = Math.max(1, ...rows.map((r) => r.count));
  return (
    <div className="distribution-bars">
      {rows.map((row, index) => (
        <ChartTarget
          key={row.label}
          detail={`${row.label} beyond the allowance: ${row.count} delayed handoffs. Analytics bucket, not an operational severity classification.`}
        >
          <span>{row.label}</span>
          <span className="bar-track">
            <span
              className={`bar-fill delay-bucket-${index}`}
              style={{ width: `${(row.count / max) * 100}%` }}
            />
          </span>
          <strong>{row.count}</strong>
        </ChartTarget>
      ))}
    </div>
  );
}
