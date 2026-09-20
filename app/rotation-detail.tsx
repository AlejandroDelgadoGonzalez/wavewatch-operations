"use client";
import { Fragment } from "react";
import type {
  Classification,
  Config,
  Park,
  ParkState,
  Rotation,
} from "../domain/model";
import { formatTime } from "../domain/schedule";
import {
  activeBreak,
  phase,
  planFor,
  offStandLabel,
  bumpTimes,
} from "../operations/selectors";
export function Evidence({ kind }: { kind: Classification }) {
  return (
    <span
      className={`evidence ${kind.toLowerCase()}`}
      title={
        kind === "Confirmed"
          ? "Recorded by the simulated source or an explicit operating-day action"
          : kind === "Calculated"
            ? "Derived mathematically from available records"
            : "Future or inferred; not directly confirmed"
      }
    >
      {kind}
    </span>
  );
}
export function RotationDetail({
  park,
  state,
  config,
  rotation,
  close,
  change,
}: {
  park: Park;
  state: ParkState;
  config: Config;
  rotation: Rotation;
  close: () => void;
  change: (employeeId: string) => void;
}) {
  const value = state.rotations[rotation.id];
  const currentBreak = activeBreak(value, state.now);
  const getName = (id: string | null) =>
    park.employees.find((e) => e.employeeId === id)?.employeeName ??
    "Awaiting clock-in";
  const employees = park.employees.filter(
    (e) => state.membership[e.employeeId] === rotation.id,
  );
  const handoffs = bumpTimes(value);
  return (
    <section
      className="detail"
      id="rotation-detail"
      aria-label="Rotation detail"
      tabIndex={-1}
    >
      <header className="detail-heading">
        <div>
          <p className="eyebrow">
            {rotation.id} · {rotation.zone}
          </p>
          <h2>{rotation.name}</h2>
          <p>{rotation.attraction}</p>
        </div>
        <button
          className="icon-button"
          onClick={close}
          aria-label="Close rotation detail"
        >
          ×
        </button>
      </header>
      <div className="detail-meta">
        <span>{rotation.role}</span>
        <strong>{phase(state, value)}</strong>
      </div>
      {value.delay > 0 && (
        <div className="notice amber">
          <strong>{value.delay}-minute handoff delay</strong>
          <p>
            {value.estimatedDelay
              ? `${value.estimatedDelay} minutes estimated. `
              : "Detected from recorded events. "}
            Timeline adjusted. The cause is unknown.
          </p>
        </div>
      )}
      <h3>
        Position estimate{" "}
        <Evidence
          kind={
            value.finalApplied || value.assignments.every((id) => id === null)
              ? "Expected"
              : value.bumpCount
                ? "Calculated"
                : "Confirmed"
          }
        />
      </h3>
      <p className="muted small">
        During a handoff, movement is in progress. Positions update together
        when the next break start is recorded.
      </p>
      <div className="position-list">
        {value.assignments.map((id, index) => (
          <div key={index} className={index === 3 ? "off-stand" : ""}>
            <span className="position-number">
              {index < 3 ? index + 1 : "↻"}
            </span>
            <div>
              <strong>{getName(id)}</strong>
              <span>
                {index < 3
                  ? `Stand ${index + 1} · ${rotation.stands[index].name}`
                  : offStandLabel(state, value)}
              </span>
              {index < 3 && (
                <span>
                  Extension {rotation.stands[index].extension} · Synthetic
                </span>
              )}
              {id && (
                <span>
                  Arrival{" "}
                  {employees.find((e) => e.employeeId === id)?.arrivalTime} ·
                  Clock-in{" "}
                  {state.clockIns[id] === undefined
                    ? "Expected"
                    : formatTime(state.clockIns[id])}
                </span>
              )}
            </div>
            {id && (
              <Evidence
                kind={
                  index === 3 && currentBreak
                    ? "Confirmed"
                    : value.finalApplied
                      ? "Expected"
                      : value.bumpCount
                        ? "Calculated"
                        : "Confirmed"
                }
              />
            )}
            {id && (
              <button
                className="text-link"
                disabled={state.closed}
                aria-label={`Change ${getName(id)}`}
                onClick={() => change(id)}
              >
                Change
              </button>
            )}
          </div>
        ))}
      </div>
      <h3>Break timeline</h3>
      <p className="muted small">
        Reference → recorded or expected start. Second break ends are calculated
        after the recorded start.
      </p>
      <div className="timeline">
        {value.breaks.map((row, index) => (
          <Fragment key={row.id}>
            <article
              className={`timeline-row ${row.actual !== null ? "occurred" : "future"} ${currentBreak?.id === row.id ? "current" : ""}`}
            >
              <span className="timeline-dot">{index + 1}</span>
              <div>
                <div className="timeline-title">
                  <strong>{getName(row.employeeId)}</strong>
                  <span>
                    Break {row.number} · {row.duration}m
                  </span>
                </div>
                <div className="time-line">
                  <span className="baseline">{formatTime(row.baseline)}</span>
                  <span>→</span>
                  <strong>{formatTime(row.actual ?? row.expected)}</strong>
                  <Evidence
                    kind={row.actual !== null ? "Confirmed" : "Expected"}
                  />
                </div>
                <div className="time-line muted">
                  <span>
                    End{" "}
                    {formatTime(
                      row.end ?? (row.actual ?? row.expected) + row.duration,
                    )}
                  </span>
                  <Evidence
                    kind={
                      row.end !== null
                        ? row.endClassification
                        : row.actual !== null && row.number === 2
                          ? "Calculated"
                          : "Expected"
                    }
                  />
                </div>
              </div>
            </article>
            {handoffs[index] && (
              <article
                className="timeline-row bump-time"
                aria-label="Bump Time"
              >
                <span className="timeline-dot" aria-hidden="true">
                  ↻
                </span>
                <div>
                  <div className="timeline-title">
                    <strong>Bump Time</strong>
                    <Evidence kind={handoffs[index].classification} />
                  </div>
                  <p>
                    Expected: {handoffs[index].expected} min · Actual:{" "}
                    {handoffs[index].actual === null
                      ? "Pending"
                      : `${handoffs[index].actual} min`}
                    {(handoffs[index].variance ?? 0) > 0
                      ? ` (+${handoffs[index].variance} min)`
                      : ""}
                  </p>
                  {handoffs[index].actual !== null && (
                    <p className="muted small">
                      {formatTime(handoffs[index].start!)} →{" "}
                      {formatTime(handoffs[index].end!)}
                    </p>
                  )}
                  {(handoffs[index].variance ?? 0) > 0 && (
                    <p className="delay-text">
                      {handoffs[index].variance}-minute delay detected during
                      this handoff. Cause unknown.
                    </p>
                  )}
                </div>
              </article>
            )}
          </Fragment>
        ))}
      </div>
      <div className="final-schedule">
        <h3>
          After the last break <Evidence kind="Expected" />
        </h3>
        <p>
          Final bump <strong>{formatTime(value.finalBump)}</strong>
        </p>
        <p>
          Extra-cycle bumps{" "}
          <strong>
            {value.postBumps.map(formatTime).join(", ") || "None"}
          </strong>
        </p>
        {value.removedBumps > 0 && (
          <p className="delay-text">
            {value.removedBumps} bump removed: fewer than 30 minutes would
            remain before closing.
          </p>
        )}
      </div>
      <details>
        <summary>Employee arrival & break plans</summary>
        <div className="roster-detail">
          {employees.map((employee) => (
            <div key={employee.employeeId}>
              <strong>{employee.employeeName}</strong>
              <span>{employee.employeeId}</span>
              <span>
                Arrival {employee.arrivalTime} ·{" "}
                {state.clockIns[employee.employeeId] === undefined
                  ? "Expected"
                  : "Confirmed"}
              </span>
              <span>
                Breaks {planFor(employee.arrivalTime, config).join(" + ")} min
              </span>
            </div>
          ))}
        </div>
      </details>
    </section>
  );
}
