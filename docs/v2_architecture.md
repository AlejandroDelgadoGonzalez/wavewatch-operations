# WaveWatch V2 architecture

## Boundaries

`domain/model.ts` defines IDs, reference entities, configuration, events, break records and operating state. Static entities come from `data/blue_current_staffing.json`; dynamic state never modifies that dataset.

`rotation_calculator.py` remains the scheduling authority. `scripts/export_simulation_contract.py` exports constants and normal/reference-delayed timelines to `data/simulation_contract.json`; `--check` catches stale output. `domain/schedule.ts` adapts arrival slots to employee IDs and performs rotation/cutoff arithmetic using this contract.

`simulation/scenarios.ts` constructs fictional source events and knows future timing. `simulation/engine.ts` owns this private queue, cursor and virtual clock. WaveWatch receives **only processed observations** and cannot inspect future scenario timing.

`operations/projection.ts` builds observed state, detects delays and derives inferences. `operations/selectors.ts` derives phase, attention, next event and summaries. Components render these values; they do not invent schedules or mutate assignments.

## Event contract

```ts
type SimulationEvent = {
  id: string;                     // stable within the configured run
  minute: number;                 // minutes since midnight on reference date
  type: EventType;
  classification: "Confirmed" | "Calculated" | "Expected";
  source: "simulator" | "wavewatch" | "simulation-lab";
  rotationId?: string;
  zone?: string;
  employeeId?: string;
  payload: { breakIndex?: number; delay?: number; estimated?: boolean;
             removed?: number; kind?: string; note?: string;
             swap?: { first: SwapPosition; second: SwapPosition } };
};
```

Source IDs use deterministic insertion ordinals. Events are stably ordered by minute then ordinal, including simultaneous events across rotations. Derived IDs combine rotation, type and minute. Processed IDs make observation application idempotent. Inferences follow their triggering source event.

Source events: clock-in, park opening, break start, first-break end, park closing and shift end. Derived events: inferred bump, second-break end, handoff delay, forecast recalculation, removed post-break bump, expected final bump and expected post-break bump. Experimental observations use a separate source and have no assignment/coverage consequences.

Source events plus clock progression reconstruct the projection: initialize state, replay observations at each minute, then call `projectTime`. Derived events are outputs, not inputs to apply twice. A reconstruction test verifies exact equality. There is no persistence/replay-file UI yet.

## Clock and scenarios

The engine owns no timer. `app/use-simulation.ts` owns one interval while running and clears it on pause/unmount. Each callback supplies one real second; `tick` applies the current 1/5/15 minute rate, retaining fractional minutes for programmatic ticks. Every intervening minute is projected even at accelerated speeds or Lab checkpoints.

Start is idempotent. Pause stops advancement. Resume retains position/fraction. Restart reconstructs queue/state and clears injected notes, retaining speed. The day begins at the earliest dataset arrival (7:30 AM) and completes at closing + 30. A step/checkpoint changes ready state to paused. Rewinding requires restart.

- Normal: no variations.
- Delayed: SW-CC-01's second employee starts eight minutes later; source end and subsequent starts shift accordingly.
- Seeded: an unsigned 32-bit linear congruential generator decides at each subsequent handoff whether to add a 1–4 minute variation (18% probability). Seed and iteration order determine the day. These are synthetic scenario parameters, not operational rules.

## Projection and evidence

Clock-in confirms the starting slot. Each break-start observation rotates all four assignment slots simultaneously; these location estimates are Calculated. The off-stand employee's recorded break status is Confirmed. First-break end is Confirmed; second-break end is Calculated from recorded start plus duration.

At break start, compare with prior end plus the 15-minute allowance. Positive excess creates a handoff delay. If the prior end was Calculated, flag that portion estimated. No event identifies a responsible employee. Shift unobserved expectations by the difference from the current forecast, recompute final/post-break times, and remove bumps after the inclusive closing-minus-30 cutoff.

Before a delayed record occurs, an overdue break produces an Expected attention item, not a prematurely proven eight-minute delay. At 12:18 in ROT-002, the source record causes detection and recalculation. Future simulator events never directly set dashboard values.

When all breaks have ended and the return allowance elapses, assignments rotate and Extra cycle begins as Expected. Additional cutoff-valid bumps remain Expected. At closing, final estimates remain available for inspection while active/attention summaries clear. Shifts end 30 minutes later.

## UI and performance

`useSyncExternalStore` subscribes to immutable snapshots. Each advance clones operating state once, processes minutes synchronously, then notifies once. At this scale, arrays and simple selectors are deliberate; no distributed infrastructure, external polling or heavyweight store is needed.

React-only state contains navigation, filters, selection and unapplied Lab fields. Lab commands go through the engine. Feed text comes from structured types. The timeline compares original times with observed or updated expected times.

Lab shows scenario, seed, time and counts. In development only, a collapsed inspector exposes the next five simulator events, park flags and a compact assignment/delay summary for each rotation, explicitly identified as simulator/debug information outside Operations Base.

## Reference stands and operating-day membership

Each rotation retains its stable ID and ordered three stands. A stand is `{ id, name, extension }`; the ID appends `-S1`, `-S2`, or `-S3` to its rotation, and synthetic four-digit extensions run from 1001 through 1051. Python validates structure, uniqueness and staffing totals. Tidal Bay replaces the old human-facing zone labels; historical `BB` identifiers remain stable. The operational `Breaker` term is unchanged. The optional workbook generator emits the same stand schema.

`ParkState.membership` starts from reference staffing and records the current day's rotation membership. Team and rotation search use this map, not static employee rotation IDs. Arrival records and break entitlements remain properties of each person. Team filters first, then sorts a new array by parsed arrival or name, with name/ID tie-breakers.

## Explicit Bump Time evidence

`bumpTimes` derives one handoff between each adjacent pair of break rows. Expected duration comes from `POLICY.transitionMinutes`. Actual duration remains pending until previous end and next start are available. Two recorded endpoints produce Confirmed duration; a calculated end produces Calculated duration. Variance and neutral cause-unknown text belong to the handoff, never to the next employee's break card. Accumulated delay alerts remain Calculated; schedule propagation and closing cutoffs are unchanged.

## Operating-day employee swaps

The detail panel opens a native modal and pauses the simulation. Selection, review and cancellation stay in React; confirmation issues a typed `SwapCommand` with a unique `swap/` ID. `SimulationEngine.recordSwap` clones state, applies a Confirmed `employee_swap_recorded` observation, reconciles unprocessed source break ownership, then publishes one snapshot. The observation stores timestamp, both employee IDs, both rotation IDs and both pre-swap slot indices (0–3). It is an explicit simulation action, not evidence from a real location sensor.

`operations/swaps.ts` validates current positions again at confirmation. The prototype requires different modeled rotations, same synthetic role, same arrival time, same slot in the rotation cycle, matching remaining break numbers/durations, neither employee on break, and an open operating day (pre-opening swaps are allowed once both people are assigned). These are data-integrity constraints, not aquatic-safety policy. Different-arrival swaps would require a new person-centered scheduler and are intentionally rejected with an explanation.

The projection swaps both slots and membership entries atomically. Only unstarted break rows change ownership; completed/active break history and original clock-ins remain untouched. The engine updates employee IDs on unprocessed source break events to match those rows, preserving timing, event IDs and cursor. Forecasting never reads the private future queue. Delays stay with the handoff/rotation where observed and are not transferred as employee blame. Subsequent bumps use the new assignments. Duplicate command IDs are no-ops; invalid commands leave the snapshot unchanged. Restart regenerates reference membership, queue and clean event history.

Replay includes simulator observations plus explicit swap observations, not derived events. Apply simulator observations and time projection for a minute before any manual actions recorded at that minute. The native modal contains focus, supports Escape, and restores the invoking control; confirming or cancelling leaves time paused until the user resumes.

## Further extension checklist

For a new event, document its source, required IDs and consequences. Add it to the event union and scenario generator, then implement a tested projection handler and description. Without a defined staffing/coverage policy, keep it a labeled experimental note. Do not infer a safety rule from a UI interaction.
