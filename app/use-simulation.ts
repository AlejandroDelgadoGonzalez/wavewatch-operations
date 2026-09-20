"use client";
import { useEffect, useState, useSyncExternalStore } from "react";
import park from "../data/blue_current_staffing.json";
import { SimulationEngine } from "../simulation/engine";
export function useSimulation() {
  const [engine] = useState(
    () =>
      new SimulationEngine(park, {
        scenario: "normal",
        closing: "6:00 PM",
        seed: 2026,
      }),
  );
  const snapshot = useSyncExternalStore(
    engine.subscribe,
    engine.getSnapshot,
    engine.getSnapshot,
  );
  useEffect(() => {
    if (snapshot.status !== "running") return;
    // Hidden-tab throttling slows the run rather than skipping unseen hours.
    const timer = setInterval(() => engine.tick(1), 1000);
    return () => clearInterval(timer);
  }, [engine, snapshot.status]);
  return { engine, ...snapshot };
}
