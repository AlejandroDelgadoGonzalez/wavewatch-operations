"use client";
import { useMemo, useState } from "react";
import park from "../data/blue_current_staffing.json";
import { useSimulation } from "./use-simulation";
import { Evidence, RotationDetail } from "./rotation-detail";
import { SwapDialog } from "./swap-dialog";
import { AnalyticsPanel } from "./analytics/page-panel";
import { positionOf } from "../operations/swaps";
import { SCENARIOS } from "../simulation/scenarios";
import { CLOSINGS, formatTime, minuteOf } from "../domain/schedule";
import {
  alertsFor,
  describeEvent,
  nextAction,
  parkStatus,
  percentOfDay,
  phase,
  planFor,
  summary,
  offStandLabel,
  teamMembers,
  filterRotations,
  teamZoneOptions,
  TEAM_ROLES,
  type TeamRole,
  type TeamSort,
} from "../operations/selectors";
import type {
  Closing,
  Config,
  ScenarioId,
  SwapPosition,
} from "../domain/model";

const zones = [...new Set(park.rotations.map((r) => r.zone))];
const referenceDate = new Intl.DateTimeFormat("en-GB", {
  day: "2-digit",
  month: "short",
  year: "numeric",
  timeZone: "UTC",
})
  .format(new Date(`${park.metadata.operatingDate}T00:00:00Z`))
  .toUpperCase();
const roles = [...new Set(park.rotations.map((r) => r.role))];
const employeeById = Object.fromEntries(
  park.employees.map((e) => [e.employeeId, e]),
);
const defaultConfig: Config = {
  scenario: "normal",
  closing: "6:00 PM",
  seed: 2026,
};

export default function Home() {
  const { engine, state, status, speed, config } = useSimulation();
  const [view, setView] = useState("Operations");
  const [zone, setZone] = useState("All zones");
  const [role, setRole] = useState("All roles");
  const [query, setQuery] = useState("");
  const [selected, setSelected] = useState<string | null>(null);
  const [swapFirst, setSwapFirst] = useState<SwapPosition | null>(null);
  const [teamSort, setTeamSort] = useState<TeamSort>("name");
  const [teamQuery, setTeamQuery] = useState("");
  const [teamRole, setTeamRole] = useState<TeamRole>("All roles");
  const [teamZone, setTeamZone] = useState("All zones");
  const [swapMessage, setSwapMessage] = useState("");
  const [feedRotation, setFeedRotation] = useState("All rotations");
  const [feedKind, setFeedKind] = useState("All evidence");
  const [draft, setDraft] = useState<Config>(defaultConfig);
  const [experimentalRotation, setExperimentalRotation] = useState(
    park.rotations[0].id,
  );
  const [experimentalKind, setExperimentalKind] = useState(
    "coordinator_intervention",
  );
  const [note, setNote] = useState("");
  const [labMessage, setLabMessage] = useState("");
  const totals = summary(state);
  const alerts = alertsFor(state);
  const scenario = SCENARIOS.find((s) => s.id === config.scenario)!;
  const visibleRotations = useMemo(
    () => filterRotations(park, state, query, role, zone),
    [zone, role, query, state],
  );
  const visibleTeam = teamMembers(
    park,
    state,
    teamQuery,
    teamSort,
    teamRole,
    teamZone,
  );
  const resetTeamFilters = () => {
    setTeamQuery("");
    setTeamRole("All roles");
    setTeamZone("All zones");
    setTeamSort("name");
  };
  const feed = state.events
    .filter(
      (e) =>
        e.type !== "bump_inferred" &&
        (feedRotation === "All rotations" ||
          e.rotationId === feedRotation ||
          e.payload.swap?.second.rotationId === feedRotation) &&
        (feedKind === "All evidence" || e.classification === feedKind),
    )
    .slice()
    .reverse();
  const choose = (id: string) => {
    setSelected(id);
    setView("Operations");
    setTimeout(() => {
      const panel = document.getElementById("rotation-detail");
      panel?.focus({ preventScroll: true });
      if (window.innerWidth < 1200)
        panel?.scrollIntoView({ behavior: "smooth", block: "start" });
    }, 0);
  };
  const selectedRotation = park.rotations.find((r) => r.id === selected);
  const referenceRotation = state.rotations[park.rotations[0].id];
  const lastBreak = referenceRotation.breaks.at(-1)!;
  const checkpoints: [string, number][] = [
    ["Before opening", 595],
    ["First break", 670],
    ["Handoff overdue (6 PM)", 731],
    ["ROT-002 record (6 PM)", 738],
    [
      "Final break end",
      lastBreak.end ??
        (lastBreak.actual ?? lastBreak.expected) + lastBreak.duration,
    ],
    ["Extra cycle", referenceRotation.finalBump],
    ["Near closing", minuteOf(config.closing) - 5],
    ["Complete day", minuteOf(config.closing) + 30],
  ];
  const showTime = (time: number) => {
    engine.advanceTo(time);
    setLabMessage(`Processed every event through ${formatTime(time)}.`);
  };

  return (
    <div className="shell">
      <aside className="sidebar">
        <a className="brand" href="#main">
          <span className="brand-symbol">≈</span>
          <span>
            WAVEWATCH<small>OPERATIONS / V2</small>
          </span>
        </a>
        <p className="nav-caption">OPERATIONS BASE</p>
        <nav aria-label="Main navigation">
          {[
            "Operations",
            "Activity",
            "Team",
            "Data & Analytics",
            "Simulation Lab",
            "About",
          ].map((item, i) => (
            <button
              key={item}
              className={view === item ? "active" : ""}
              aria-current={view === item ? "page" : undefined}
              onClick={() => setView(item)}
            >
              <span aria-hidden="true">
                {["▦", "≡", "◉", "▥", "▷", "i"][i]}
              </span>
              {item}
            </button>
          ))}
        </nav>
        <div className="sidebar-bottom">
          <strong>Blue Current</strong>
          <span>Adventure Park</span>
          <p>Synthetic operating environment</p>
        </div>
      </aside>
      <main id="main" className="workspace">
        <header className="topbar">
          <div>
            <span className="eyebrow">BLUE CURRENT ADVENTURE PARK</span>
            <h1>{view === "Operations" ? "Operations Base" : view}</h1>
          </div>
          <span className="day-label">
            {view === "Data & Analytics" ? (
              <>
                HISTORICAL DEMO <strong>07–13 SEP 2026</strong>
              </>
            ) : (
              <>
                REFERENCE DAY <strong>{referenceDate}</strong>
              </>
            )}
          </span>
        </header>
        {view !== "Data & Analytics" && (
          <>
            <section className="clock-bar" aria-label="Simulation controls">
              <div className="clock">
                <span>SIMULATED TIME</span>
                <strong data-testid="clock">{formatTime(state.now)}</strong>
                <small>{parkStatus(state)}</small>
              </div>
              <div className="scenario-label">
                <span>{scenario.name}</span>
                <small>
                  Closes {config.closing} ·{" "}
                  {status === "ready"
                    ? "Ready to start"
                    : status === "complete"
                      ? "Complete"
                      : status === "running"
                        ? "Running"
                        : "Paused"}
                </small>
              </div>
              <div className="clock-controls">
                <button
                  className="primary"
                  disabled={status === "complete"}
                  onClick={() =>
                    status === "running" ? engine.pause() : engine.start()
                  }
                >
                  {status === "running"
                    ? "Pause"
                    : status === "ready"
                      ? "Start simulation"
                      : "Resume"}
                </button>
                <button
                  disabled={status === "running" || status === "complete"}
                  onClick={() => engine.step()}
                  title="Advance one simulated minute"
                >
                  +1 min
                </button>
                <label>
                  <span className="sr-only">Simulation speed</span>
                  <select
                    value={speed}
                    onChange={(e) => engine.setSpeed(+e.target.value)}
                  >
                    {[1, 5, 15].map((s) => (
                      <option key={s} value={s}>
                        {s}× speed
                      </option>
                    ))}
                  </select>
                </label>
                <button onClick={() => engine.restart()}>Restart</button>
              </div>
              <div
                className="clock-progress"
                style={{ width: `${percentOfDay(state.now, config)}%` }}
              />
            </section>
            <div className="clock-caption">
              1× = 1 simulated minute per real second. Pause to inspect or step
              forward.{" "}
              <button
                className="text-link"
                onClick={() => setView("Simulation Lab")}
              >
                Scenario controls →
              </button>
            </div>
          </>
        )}
        {view === "Data & Analytics" && <AnalyticsPanel />}
        {swapMessage &&
          state.events.some(
            (event) => event.type === "employee_swap_recorded",
          ) && (
            <p role="status" className="notice">
              {swapMessage}
            </p>
          )}
        {swapFirst && (
          <SwapDialog
            park={park}
            state={state}
            first={swapFirst}
            close={() => setSwapFirst(null)}
            confirm={(command) => {
              engine.recordSwap(command);
              setSwapMessage(
                "Employee swap recorded. Both rotations updated. Resume the simulation when ready.",
              );
            }}
          />
        )}

        {view === "Operations" && (
          <>
            <section className="metrics" aria-label="Operations overview">
              {[
                [
                  "Active rotations",
                  totals.active,
                  `of ${park.rotations.length} configured`,
                ],
                [
                  "Break cycle",
                  totals.breakCycle,
                  `${totals.onBreak} employees on break`,
                ],
                ["Extra cycle", totals.extra, "expected assignments"],
                [
                  "Delayed rotations",
                  totals.delayed,
                  `${totals.upcoming} events in next 15m`,
                ],
              ].map(([label, value, sub]) => (
                <article key={label}>
                  <span>{label}</span>
                  <strong>{value}</strong>
                  <small>{sub}</small>
                </article>
              ))}
            </section>
            {alerts.length > 0 && (
              <div className="attention-summary">
                <strong>
                  {alerts.length} attention items · {totals.delayed} affected{" "}
                  {totals.delayed === 1 ? "rotation" : "rotations"}
                </strong>
                <button
                  className="text-link"
                  onClick={() => {
                    document
                      .getElementById("attention-panel")
                      ?.scrollIntoView({ behavior: "smooth" });
                    document
                      .getElementById("attention-panel")
                      ?.focus({ preventScroll: true });
                  }}
                >
                  Review attention →
                </button>
                <button
                  className="text-link"
                  onClick={() => choose(alerts[0].rotationId)}
                >
                  Inspect {alerts[0].rotationId} →
                </button>
              </div>
            )}
            <div
              className={`operations-layout ${selectedRotation ? "with-detail" : ""}`}
            >
              <div className="board-area">
                <section className="zone-strip" aria-label="Zones">
                  {zones.map((z, i) => {
                    const rotations = park.rotations.filter(
                      (r) => r.zone === z,
                    );
                    const affected = new Set(
                      alerts
                        .filter((a) =>
                          rotations.some((r) => r.id === a.rotationId),
                        )
                        .map((a) => a.rotationId),
                    ).size;
                    return (
                      <button
                        key={z}
                        aria-pressed={zone === z}
                        className={zone === z ? "selected" : ""}
                        onClick={() => setZone(zone === z ? "All zones" : z)}
                      >
                        <span className="zone-index">0{i + 1}</span>
                        <strong>{z}</strong>
                        <small>
                          {rotations.length} rotations ·{" "}
                          {affected
                            ? `${affected} delayed`
                            : "No attention items"}
                        </small>
                      </button>
                    );
                  })}
                </section>
                <div className="board-heading">
                  <h2>
                    Rotation board{" "}
                    <span>
                      {visibleRotations.length} / {park.rotations.length}
                    </span>
                  </h2>
                  <div className="legend">
                    <Evidence kind="Confirmed" />
                    <Evidence kind="Calculated" />
                    <Evidence kind="Expected" />
                  </div>
                </div>
                <div className="filters">
                  <label className="search">
                    <span className="sr-only">
                      Search rotations or employees
                    </span>
                    <input
                      placeholder="Find an employee, rotation, attraction, or stand…"
                      value={query}
                      onChange={(e) => setQuery(e.target.value)}
                    />
                  </label>
                  <label>
                    <span className="sr-only">Zone filter</span>
                    <select
                      aria-label="Zone filter"
                      value={zone}
                      onChange={(e) => setZone(e.target.value)}
                    >
                      {["All zones", ...zones].map((z) => (
                        <option key={z}>{z}</option>
                      ))}
                    </select>
                  </label>
                  <label>
                    <span className="sr-only">Role filter</span>
                    <select
                      aria-label="Role filter"
                      value={role}
                      onChange={(e) => setRole(e.target.value)}
                    >
                      {["All roles", ...roles].map((r) => (
                        <option key={r}>{r}</option>
                      ))}
                    </select>
                  </label>
                </div>
                <div className="rotation-grid">
                  {visibleRotations.map((rotation) => {
                    const r = state.rotations[rotation.id];
                    const next = nextAction(r, state.now);
                    const pending = r.breaks.some(
                      (b) => b.actual === null && b.expected < state.now,
                    );
                    return (
                      <button
                        key={rotation.id}
                        className={`rotation-card ${selected === rotation.id ? "selected" : ""}`}
                        aria-label={`Inspect ${rotation.name}`}
                        onClick={() => choose(rotation.id)}
                      >
                        <div className="card-head">
                          <span className="mono">{rotation.id}</span>
                          <span
                            className={`phase ${pending || r.delay ? "attention" : ""}`}
                          >
                            {pending ? "Awaiting break" : phase(state, r)}
                          </span>
                        </div>
                        <h3>{rotation.name}</h3>
                        <p className="card-zone">
                          {rotation.zone} ·{" "}
                          {rotation.role
                            .replace(" Lifeguard", "")
                            .replace("Slide Operator", "Slide Ops")}
                        </p>
                        <ol className="card-assignments">
                          {r.assignments.map((id, index) => (
                            <li key={index}>
                              <span>
                                {index < 3
                                  ? rotation.stands[index].name
                                  : offStandLabel(state, r)}
                              </span>
                              <strong>
                                {id
                                  ? employeeById[id].employeeName
                                  : "Not clocked in"}
                              </strong>
                            </li>
                          ))}
                        </ol>
                        <div className="card-evidence">
                          <Evidence
                            kind={
                              r.finalApplied ||
                              r.assignments.every((id) => id === null)
                                ? "Expected"
                                : r.bumpCount
                                  ? "Calculated"
                                  : "Confirmed"
                            }
                          />
                          <span>
                            {r.delay
                              ? `+${r.delay}m handoff delay`
                              : "Assignment evidence"}
                          </span>
                        </div>
                        <footer>
                          {state.closed ? (
                            <span>Final assignments retained</span>
                          ) : next ? (
                            <>
                              <span>
                                {next.label}{" "}
                                <strong>{formatTime(next.time)}</strong>
                              </span>
                              <span className="expected-label">
                                {next.classification}
                              </span>
                            </>
                          ) : (
                            <span>No further bumps expected</span>
                          )}
                        </footer>
                      </button>
                    );
                  })}
                </div>
                {!visibleRotations.length && (
                  <div className="empty">
                    <h3>No matching rotations</h3>
                    <p>Try another name or reset the filters.</p>
                    <button
                      onClick={() => {
                        setQuery("");
                        setRole("All roles");
                        setZone("All zones");
                      }}
                    >
                      Reset filters
                    </button>
                  </div>
                )}
              </div>
              {selectedRotation && (
                <RotationDetail
                  park={park}
                  state={state}
                  config={config}
                  rotation={selectedRotation}
                  close={() => setSelected(null)}
                  change={(employeeId) => {
                    engine.pause();
                    setSwapMessage("");
                    setSwapFirst(positionOf(state, employeeId));
                  }}
                />
              )}
            </div>
            <div className="lower-panels">
              <section className="panel" id="attention-panel" tabIndex={-1}>
                <header>
                  <h2>Operations attention</h2>
                  <span>{alerts.length} items</span>
                </header>
                <div className="attention-list">
                  {alerts.length ? (
                    alerts.map((a) => (
                      <button
                        key={a.id}
                        className={`alert ${a.severity}`}
                        onClick={() => choose(a.rotationId)}
                      >
                        <span className="mono">{a.rotationId}</span>
                        <strong>{a.title}</strong>
                        <p>{a.detail}</p>
                        <Evidence kind={a.classification} />
                      </button>
                    ))
                  ) : (
                    <div className="empty compact">
                      <strong>No active attention items</strong>
                      <p>
                        Handoff exceptions will appear here as the day develops.
                      </p>
                    </div>
                  )}
                </div>
              </section>
              <section className="panel">
                <header>
                  <h2>Recent activity</h2>
                  <button
                    className="text-link"
                    onClick={() => setView("Activity")}
                  >
                    View full feed →
                  </button>
                </header>
                <div className="feed">
                  {state.events
                    .filter((e) => e.type !== "bump_inferred")
                    .slice(-6)
                    .reverse()
                    .map((e) => (
                      <article key={e.id}>
                        <time>{formatTime(e.minute)}</time>
                        <div>
                          <strong>{describeEvent(e, park)}</strong>
                          <span>
                            {e.rotationId ?? "Parkwide"}{" "}
                            <Evidence kind={e.classification} />
                          </span>
                        </div>
                      </article>
                    ))}
                </div>
              </section>
            </div>
          </>
        )}

        {view === "Activity" && (
          <section className="panel full-panel">
            <header>
              <div>
                <h2>Activity stream</h2>
                <p className="muted">
                  Recorded events and WaveWatch inferences, newest first.
                </p>
              </div>
              <span>{feed.length} matching events</span>
            </header>
            <div className="filters">
              <label>
                Rotation
                <select
                  aria-label="Activity rotation"
                  value={feedRotation}
                  onChange={(e) => setFeedRotation(e.target.value)}
                >
                  <option>All rotations</option>
                  {park.rotations.map((r) => (
                    <option key={r.id}>{r.id}</option>
                  ))}
                </select>
              </label>
              <label>
                Evidence
                <select
                  aria-label="Evidence"
                  value={feedKind}
                  onChange={(e) => setFeedKind(e.target.value)}
                >
                  {["All evidence", "Confirmed", "Calculated", "Expected"].map(
                    (c) => (
                      <option key={c}>{c}</option>
                    ),
                  )}
                </select>
              </label>
            </div>
            <div className="feed">
              {feed.slice(0, 150).map((e) => (
                <article key={e.id}>
                  <time>{formatTime(e.minute)}</time>
                  <div>
                    <strong>{describeEvent(e, park)}</strong>
                    <span>
                      {e.rotationId ? (
                        <button
                          className="text-link"
                          onClick={() => choose(e.rotationId!)}
                        >
                          {e.rotationId}
                        </button>
                      ) : (
                        "Parkwide"
                      )}{" "}
                      · {e.source} <Evidence kind={e.classification} />
                    </span>
                  </div>
                </article>
              ))}
              {!feed.length && (
                <p className="empty">No events match these filters.</p>
              )}
            </div>
            {feed.length > 150 && (
              <p className="muted panel-foot">
                Showing the newest 150. Filter by rotation to inspect its full
                history; the engine retains every event.
              </p>
            )}
          </section>
        )}

        {view === "Team" && (
          <section className="panel full-panel">
            <header>
              <div>
                <h2>Scheduled team</h2>
                <p role="status" data-testid="team-count">
                  Showing {visibleTeam.length} of {park.employees.length}{" "}
                  employees
                </p>
                <p className="muted">
                  {totals.clockedIn} clocked in · {park.employees.length}{" "}
                  scheduled · shift ends{" "}
                  {formatTime(minuteOf(config.closing) + 30)}
                </p>
              </div>
            </header>
            <div className="filters team-filters">
              <label className="search">
                <span className="sr-only">Find team member</span>
                <input
                  placeholder="Name or employee ID"
                  value={teamQuery}
                  onChange={(e) => setTeamQuery(e.target.value)}
                />
              </label>
              <label>
                Role
                <select
                  aria-label="Team role filter"
                  value={teamRole}
                  onChange={(event) =>
                    setTeamRole(event.target.value as TeamRole)
                  }
                >
                  {TEAM_ROLES.map((value) => (
                    <option key={value}>{value}</option>
                  ))}
                </select>
              </label>
              <label>
                Zone
                <select
                  aria-label="Team zone filter"
                  value={teamZone}
                  onChange={(event) => setTeamZone(event.target.value)}
                >
                  {["All zones", ...teamZoneOptions(park, state)].map(
                    (value) => (
                      <option key={value}>{value}</option>
                    ),
                  )}
                </select>
              </label>
              <label>
                Sort by
                <select
                  value={teamSort}
                  onChange={(event) =>
                    setTeamSort(event.target.value as TeamSort)
                  }
                >
                  <option value="name">Name (A–Z)</option>
                  <option value="arrival">Arrival (earliest first)</option>
                </select>
              </label>
              <button onClick={resetTeamFilters}>Reset filters</button>
            </div>
            {!visibleTeam.length ? (
              <div className="empty">
                <h3>No matching employees</h3>
                <p>
                  Try another name or employee ID, choose a different role or
                  zone, or use Reset filters.
                </p>
              </div>
            ) : (
              <div className="table-scroll">
                <table>
                  <thead>
                    <tr>
                      <th>Employee</th>
                      <th>Role / zone</th>
                      <th>Arrival</th>
                      <th>Break plan</th>
                      <th>Rotation</th>
                    </tr>
                  </thead>
                  <tbody>
                    {visibleTeam.map((e) => (
                      <tr key={e.employeeId}>
                        <td>
                          <strong>{e.employeeName}</strong>
                          <small>{e.employeeId}</small>
                        </td>
                        <td>
                          {e.jobRole}
                          <small>{e.zone}</small>
                        </td>
                        <td>
                          {e.arrivalTime}
                          <small>
                            {state.ended
                              ? "Shift ended"
                              : state.clockIns[e.employeeId] !== undefined
                                ? "Confirmed clock-in"
                                : "Expected"}
                          </small>
                        </td>
                        <td>
                          {e.rotationId === "N/A"
                            ? "Not modeled"
                            : `${planFor(e.arrivalTime, config).join(" + ")} min`}
                        </td>
                        <td>
                          {e.rotationId === "N/A" ? (
                            "Coordination"
                          ) : (
                            <button
                              className="text-link"
                              onClick={() => choose(e.rotationId)}
                            >
                              {e.rotationId}
                            </button>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>
        )}

        {view === "Simulation Lab" && (
          <div className="lab-grid">
            <section className="panel lab-panel">
              <p className="eyebrow">FICTIONAL ENVIRONMENT CONTROLS</p>
              <h2>Scenario configuration</h2>
              <p className="muted">
                Configure the park here. WaveWatch observes the resulting event
                stream.
              </p>
              <label>
                Scenario
                <select
                  aria-label="Scenario"
                  value={draft.scenario}
                  onChange={(e) =>
                    setDraft({
                      ...draft,
                      scenario: e.target.value as ScenarioId,
                    })
                  }
                >
                  {SCENARIOS.map((s) => (
                    <option value={s.id} key={s.id}>
                      {s.name}
                    </option>
                  ))}
                </select>
              </label>
              <p className="scenario-description">
                {SCENARIOS.find((s) => s.id === draft.scenario)?.description}
              </p>
              <div className="form-row">
                <label>
                  Park closing
                  <select
                    aria-label="Park closing"
                    value={draft.closing}
                    onChange={(e) =>
                      setDraft({ ...draft, closing: e.target.value as Closing })
                    }
                  >
                    {CLOSINGS.map((c) => (
                      <option key={c}>{c}</option>
                    ))}
                  </select>
                </label>
                <label>
                  Seed
                  <input
                    aria-label="Seed"
                    type="number"
                    min="0"
                    max="4294967295"
                    value={draft.seed}
                    onChange={(e) =>
                      setDraft({ ...draft, seed: Number(e.target.value) })
                    }
                  />
                </label>
              </div>
              <button
                className="primary"
                disabled={
                  !Number.isInteger(draft.seed) ||
                  draft.seed < 0 ||
                  draft.seed > 4294967295
                }
                onClick={() => {
                  engine.restart(draft);
                  setLabMessage(
                    "Scenario restarted at the first scheduled arrival.",
                  );
                }}
              >
                Apply & restart scenario
              </button>
              <p className="muted small">
                Current: {scenario.name} · seed {config.seed}. Restart clears
                the current run and injected notes.
              </p>
            </section>
            <section className="panel lab-panel">
              <h2>Inspect a moment</h2>
              <p className="muted">
                Pause first. Each shortcut executes all intervening events in
                order.
              </p>
              <div className="checkpoint-grid">
                {checkpoints.map(([label, time]) => (
                  <button
                    key={label}
                    disabled={
                      status === "running" ||
                      state.now >= Number(time) ||
                      (label.includes("(6 PM)") && config.closing !== "6:00 PM")
                    }
                    onClick={() => showTime(Number(time))}
                  >
                    <strong>{label}</strong>
                    <span>{formatTime(Number(time))}</span>
                  </button>
                ))}
              </div>
              <p role="status" className="lab-message">
                {labMessage}
              </p>
              <div className="notice">
                <strong>Reference employee mapping</strong>
                <p>
                  ROT-001/002 use Avery, Blake, Cameron and Dakota in the Python
                  tests. In SW-CC-01 these arrival slots map to{" "}
                  {park.employees
                    .filter((e) => e.rotationId === "SW-CC-01")
                    .map((e) => e.employeeName)
                    .join(", ")}
                  . The roster remains unchanged.
                </p>
              </div>
            </section>
            <section className="panel lab-panel">
              <h2>Experimental event</h2>
              <p className="muted">
                Adds an observation to the feed only. Coverage, closure and
                reassignment consequences have not been defined.
              </p>
              <label>
                Event type
                <select
                  aria-label="Event type"
                  value={experimentalKind}
                  onChange={(e) => setExperimentalKind(e.target.value)}
                >
                  <option value="coordinator_intervention">
                    Coordinator intervention
                  </option>
                  <option value="temporary_closure">
                    Temporary attraction closure
                  </option>
                  <option value="staffing_shortage">Staffing shortage</option>
                </select>
              </label>
              <label>
                Rotation
                <select
                  aria-label="Experimental rotation"
                  value={experimentalRotation}
                  onChange={(e) => setExperimentalRotation(e.target.value)}
                >
                  {park.rotations.map((r) => (
                    <option key={r.id} value={r.id}>
                      {r.id} · {r.name}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                Discovery note
                <textarea
                  aria-label="Discovery note"
                  maxLength={240}
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                  placeholder="What would Operations Base need to know?"
                />
              </label>
              <button
                disabled={status === "running" || !note.trim()}
                onClick={() => {
                  engine.injectExperimental(
                    experimentalKind,
                    experimentalRotation,
                    note,
                  );
                  setNote("");
                  setLabMessage(
                    "Experimental observation added. Operational assignments are unchanged.",
                  );
                }}
              >
                Record experimental observation
              </button>
            </section>
            <section className="panel lab-panel">
              <h2>Run details</h2>
              <dl>
                <dt>Scenario</dt>
                <dd>{scenario.name}</dd>
                <dt>Seed</dt>
                <dd>{config.seed}</dd>
                <dt>Virtual clock</dt>
                <dd>{formatTime(state.now)}</dd>
                <dt>Rate</dt>
                <dd>{speed} simulated minutes / second</dd>
                <dt>Source events processed</dt>
                <dd>{state.processedIds.length}</dd>
                <dt>Total event records</dt>
                <dd>{state.events.length}</dd>
                <dt>Evidence model</dt>
                <dd>Confirmed / Calculated / Expected</dd>
              </dl>
              {process.env.NODE_ENV === "development" && (
                <details>
                  <summary>
                    Development inspector · future simulator events
                  </summary>
                  <p className="muted small">
                    Simulator truth, deliberately unavailable to WaveWatch
                    forecasts.
                  </p>
                  <pre>{JSON.stringify(engine.debug(), null, 2)}</pre>
                </details>
              )}
            </section>
          </div>
        )}

        {view === "About" && (
          <section className="panel about">
            <p className="eyebrow">PORTFOLIO / OPERATIONS ANALYTICS</p>
            <h2>WaveWatch Operations V2</h2>
            <p>
              Use Operations Base to observe a fictional operating day at Blue
              Current Adventure Park. The simulation generates recorded
              activity; WaveWatch interprets it using documented rotation rules.
            </p>
            <div className="architecture-flow">
              <span>Scenario</span>
              <span>Simulation engine</span>
              <span>Event stream</span>
              <span>Park state</span>
              <span>WaveWatch</span>
            </div>
            <h3>Evidence matters</h3>
            <p>
              <Evidence kind="Confirmed" /> Recorded clock-ins, break events,
              explicit employee swaps, and handoff durations with two recorded
              endpoints.
            </p>
            <p>
              <Evidence kind="Calculated" /> Position estimates, second-break
              ends and handoff arithmetic.
            </p>
            <p>
              <Evidence kind="Expected" /> Future timing, unconfirmed bumps and
              Extra assignments.
            </p>
            <h3>Model boundaries</h3>
            <p>
              All people, IDs, attractions and records are synthetic. This
              educational portfolio project does not represent any real employer
              or its procedures and is not intended for real-world
              safety-critical aquatic operations.
            </p>
            <p>
              Break movement is modeled as a simultaneous bump at the next
              recorded break start. There is no location sensor. Experimental
              events record discovery notes only; they do not invent staffing or
              safety policies.
            </p>
            <p className="muted">
              The virtual day is local to this tab. Refreshing starts a new run.
              Coordinator break and reassignment rules are not yet modeled.
            </p>
          </section>
        )}
        <footer className="app-footer">
          <span>WaveWatch Operations · Blue Current Adventure Park</span>
          <span>Fictional portfolio simulation</span>
        </footer>
      </main>
    </div>
  );
}
