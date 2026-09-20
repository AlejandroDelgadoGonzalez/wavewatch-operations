export type Classification = "Confirmed" | "Calculated" | "Expected";
export type ScenarioId = "normal" | "delayed" | "seeded";
export type Closing = "5:00 PM" | "6:00 PM" | "7:00 PM" | "8:00 PM";
export type Config = { scenario: ScenarioId; closing: Closing; seed: number };
export type Employee = {
  employeeId: string;
  employeeName: string;
  jobRole: string;
  zone: string;
  rotationId: string;
  arrivalTime: string;
  startingAssignment: string;
};
export type Stand = { id: string; name: string; extension: string };
export type SwapPosition = {
  employeeId: string;
  rotationId: string;
  slot: number;
};
export type SwapCommand = {
  id: string;
  first: SwapPosition;
  second: SwapPosition;
};
export type Rotation = {
  id: string;
  zone: string;
  role: string;
  name: string;
  attraction: string;
  attractionId: string;
  stands: Stand[];
};
export type Park = {
  employees: Employee[];
  rotations: Rotation[];
  attractions: { id: string; name: string; zone: string; type: string }[];
  metadata: { parkName: string; operatingDate: string };
};
export type EventType =
  | "clock_in"
  | "employee_swap_recorded"
  | "park_open"
  | "park_close"
  | "shift_end"
  | "break_started"
  | "break_ended"
  | "second_break_end"
  | "bump_inferred"
  | "handoff_delay"
  | "timeline_recalculated"
  | "post_bump_removed"
  | "final_bump"
  | "post_bump"
  | "experimental";
export type SimulationEvent = {
  id: string;
  minute: number;
  type: EventType;
  classification: Classification;
  source: "simulator" | "wavewatch" | "simulation-lab";
  rotationId?: string;
  zone?: string;
  employeeId?: string;
  payload: {
    swap?: { first: SwapPosition; second: SwapPosition };
    breakIndex?: number;
    delay?: number;
    estimated?: boolean;
    removed?: number;
    note?: string;
    kind?: string;
  };
};
export type Break = {
  id: string;
  employeeId: string;
  number: number;
  duration: number;
  baseline: number;
  expected: number;
  actual: number | null;
  end: number | null;
  endClassification: Classification;
  delay: number;
};
export type RotationState = {
  id: string;
  assignments: (string | null)[];
  breaks: Break[];
  delay: number;
  estimatedDelay: number;
  finalBump: number;
  postBumps: number[];
  appliedBumps: number[];
  finalApplied: boolean;
  removedBumps: number;
  bumpCount: number;
};
export type ParkState = {
  now: number;
  clockIns: Record<string, number>;
  membership: Record<string, string>;
  rotations: Record<string, RotationState>;
  events: SimulationEvent[];
  processedIds: string[];
  closed: boolean;
  opened: boolean;
  ended: boolean;
};
export type Alert = {
  id: string;
  rotationId: string;
  title: string;
  detail: string;
  classification: Classification;
  severity: "attention" | "info";
};
