import type {
  Config,
  Park,
  ParkState,
  SimulationEvent,
  SwapCommand,
} from "../domain/model.ts";
import { minuteOf } from "../domain/schedule.ts";
import { createSourceEvents } from "./scenarios.ts";
import {
  applyObservation,
  initialState,
  projectTime,
} from "../operations/projection.ts";

export type Snapshot = {
  state: ParkState;
  config: Config;
  status: "ready" | "running" | "paused" | "complete";
  speed: number;
};

/** Pure virtual clock/service: React owns one interval; this engine owns no wall-clock timers. */
export class SimulationEngine {
  private park: Park;
  private sourceFactory: (park: Park, config: Config) => SimulationEvent[];
  private queue: SimulationEvent[] = [];
  private cursor = 0;
  private fraction = 0;
  private listeners = new Set<() => void>();
  private snapshot!: Snapshot;
  constructor(park: Park, config: Config, sourceFactory = createSourceEvents) {
    this.park = park;
    this.sourceFactory = sourceFactory;
    this.restart(config);
  }
  getSnapshot = () => this.snapshot;
  subscribe = (callback: () => void) => {
    this.listeners.add(callback);
    return () => {
      this.listeners.delete(callback);
    };
  };
  private publish() {
    for (const callback of this.listeners) callback();
  }
  restart(config = this.snapshot.config) {
    if (
      !["normal", "delayed", "seeded"].includes(config.scenario) ||
      !["5:00 PM", "6:00 PM", "7:00 PM", "8:00 PM"].includes(config.closing) ||
      !Number.isInteger(config.seed) ||
      config.seed < 0 ||
      config.seed > 4294967295
    )
      throw new Error("Invalid scenario configuration");
    this.queue = this.sourceFactory(this.park, config);
    this.cursor = 0;
    this.fraction = 0;
    const start = Math.min(
      ...this.park.employees.map((e) => minuteOf(e.arrivalTime)),
    );
    this.snapshot = {
      state: initialState(this.park, config, start),
      config: { ...config },
      speed: this.snapshot?.speed ?? 1,
      status: "ready",
    };
    this.processMinute();
    this.publish();
  }
  private processMinute() {
    const { state, config } = this.snapshot;
    while (
      this.cursor < this.queue.length &&
      this.queue[this.cursor].minute <= state.now
    )
      applyObservation(state, this.queue[this.cursor++], this.park, config);
    projectTime(state);
  }
  start() {
    if (
      this.snapshot.status === "complete" ||
      this.snapshot.status === "running"
    )
      return;
    this.snapshot = { ...this.snapshot, status: "running" };
    this.publish();
  }
  pause() {
    if (this.snapshot.status !== "running") return;
    this.snapshot = { ...this.snapshot, status: "paused" };
    this.publish();
  }
  setSpeed(speed: number) {
    if (![1, 5, 15].includes(speed)) throw new Error("Unsupported speed");
    this.snapshot = { ...this.snapshot, speed };
    this.publish();
  }
  tick(realSeconds: number) {
    if (!Number.isFinite(realSeconds) || realSeconds < 0)
      throw new Error("Invalid elapsed seconds");
    if (this.snapshot.status !== "running") return;
    this.fraction += realSeconds * this.snapshot.speed;
    const whole = Math.floor(this.fraction + 1e-9);
    this.fraction -= whole;
    if (whole) this.advance(whole);
  }
  step() {
    if (
      this.snapshot.status === "running" ||
      this.snapshot.status === "complete"
    )
      return;
    this.advance(1);
  }
  /** Lab shortcut processes every intervening minute/event; never skips projection. */
  advanceTo(minute: number) {
    if (this.snapshot.status === "running") return;
    if (minute < this.snapshot.state.now)
      throw new Error("Restart before rewinding");
    this.advance(minute - this.snapshot.state.now);
  }
  private advance(minutes: number) {
    if (!Number.isInteger(minutes) || minutes < 0)
      throw new Error("Minutes must be a nonnegative integer");
    const end = minuteOf(this.snapshot.config.closing) + 30;
    const target = Math.min(end, this.snapshot.state.now + minutes);
    this.snapshot = {
      ...this.snapshot,
      status:
        this.snapshot.status === "ready" && minutes > 0
          ? "paused"
          : this.snapshot.status,
      state: structuredClone(this.snapshot.state),
    };
    while (this.snapshot.state.now < target) {
      this.snapshot.state.now++;
      this.processMinute();
    }
    if (target === end) this.snapshot.status = "complete";
    this.publish();
  }
  injectExperimental(kind: string, rotationId: string, note: string) {
    if (this.snapshot.status === "running")
      throw new Error("Pause before adding a lab event");
    if (!this.snapshot.state.rotations[rotationId])
      throw new Error("Unknown rotation");
    if (
      !note.trim() ||
      ![
        "temporary_closure",
        "coordinator_intervention",
        "staffing_shortage",
      ].includes(kind)
    )
      throw new Error("Invalid experimental event");
    this.snapshot = {
      ...this.snapshot,
      state: structuredClone(this.snapshot.state),
    };
    const event: SimulationEvent = {
      id: `lab/${this.snapshot.state.events.filter((e) => e.source === "simulation-lab").length}`,
      minute: this.snapshot.state.now,
      type: "experimental",
      source: "simulation-lab",
      classification: "Confirmed",
      rotationId,
      payload: { kind, note: note.trim().slice(0, 240) },
    };
    applyObservation(
      this.snapshot.state,
      event,
      this.park,
      this.snapshot.config,
    );
    this.publish();
  }
  recordSwap(command: SwapCommand) {
    if (this.snapshot.state.processedIds.includes(command.id)) return;
    if (!command.id.startsWith("swap/") || command.id.length <= 5)
      throw new Error("Invalid swap command ID.");
    if (this.snapshot.status === "running")
      throw new Error("Pause before recording a swap.");
    const state = structuredClone(this.snapshot.state);
    applyObservation(
      state,
      {
        id: command.id,
        minute: state.now,
        type: "employee_swap_recorded",
        classification: "Confirmed",
        source: "wavewatch",
        rotationId: command.first.rotationId,
        payload: {
          swap: { first: { ...command.first }, second: { ...command.second } },
        },
      },
      this.park,
      this.snapshot.config,
    );
    // Preserve source timings and IDs; only future break ownership follows the new roster.
    this.queue = this.queue.map((event, index) => {
      if (
        index < this.cursor ||
        !event.rotationId ||
        event.payload.breakIndex === undefined
      )
        return event;
      const row =
        state.rotations[event.rotationId].breaks[event.payload.breakIndex];
      return { ...event, employeeId: row.employeeId };
    });
    this.snapshot = { ...this.snapshot, state };
    this.publish();
  }
  debug() {
    return {
      nextEvents: this.queue.slice(this.cursor, this.cursor + 5),
      processed: this.cursor,
      remaining: this.queue.length - this.cursor,
      park: {
        now: this.snapshot.state.now,
        opened: this.snapshot.state.opened,
        closed: this.snapshot.state.closed,
        ended: this.snapshot.state.ended,
      },
      rotations: Object.values(this.snapshot.state.rotations).map(
        (rotation) => ({
          id: rotation.id,
          assignments: rotation.assignments,
          accumulatedDelay: rotation.delay,
          estimatedDelay: rotation.estimatedDelay,
          finalBumpApplied: rotation.finalApplied,
          remainingPostBumps: rotation.postBumps.filter(
            (time) => time > this.snapshot.state.now,
          ),
        }),
      ),
    };
  }
}
