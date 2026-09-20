import type { Classification, Closing, ParkState } from "../domain/model.ts";

export type CompletedDay = {
  date: string;
  scenario: string;
  seed: number;
  closing: Closing;
  state: ParkState;
};
export type Handoff = {
  operating_day: string;
  event_id: string;
  rotation_id: string;
  previous_break_employee_id: string;
  next_break_employee_id: string;
  previous_break_end: number;
  expected_transition_minutes: number;
  actual_transition_minutes: number;
  delay_minutes: number;
  expected_next_break_start: number;
  actual_next_break_start: number;
  on_time: boolean;
  evidence: Classification;
  data_classification: "Synthetic Simulation Data";
  break_number: number;
  park_closing_time: Closing;
  scenario: string;
  simulation_seed: number;
};
export type AnalyticsDataset = {
  seed: number;
  days: { date: string; scenario: string; seed: number; closing: Closing }[];
  handoffs: Handoff[];
};
export type AnalyticsFilters = {
  day: string;
  zone: string;
  group: string;
  rotation: string;
  employee: string;
  query: string;
};
export const EMPTY_FILTERS: AnalyticsFilters = {
  day: "",
  zone: "",
  group: "",
  rotation: "",
  employee: "",
  query: "",
};
export type Metrics = {
  total: number;
  onTime: number;
  delayed: number;
  onTimeRate: number | null;
  averageTransition: number | null;
  medianTransition: number | null;
  averageDelay: number | null;
  averageDelayedTransition: number | null;
  maximumDelay: number | null;
  totalDelay: number;
  calculated: number;
};
export type GroupMetrics = Metrics & { id: string; label: string };
export type AnalyticsSort =
  | "time-asc"
  | "time-desc"
  | "delay-desc"
  | "transition-desc"
  | "rotation";
