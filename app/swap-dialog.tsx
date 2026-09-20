"use client";
import { useEffect, useRef, useState } from "react";
import type {
  Park,
  ParkState,
  SwapCommand,
  SwapPosition,
} from "../domain/model";
import { positionOf, swapError } from "../operations/swaps";
import { offStandLabel } from "../operations/selectors";

export function SwapDialog({
  park,
  state,
  first,
  close,
  confirm,
}: {
  park: Park;
  state: ParkState;
  first: SwapPosition;
  close: () => void;
  confirm: (command: SwapCommand) => void;
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  const [query, setQuery] = useState("");
  const [second, setSecond] = useState<SwapPosition | null>(null);
  const [review, setReview] = useState(false);
  const [error, setError] = useState("");
  const [commandId] = useState(() => `swap/${crypto.randomUUID()}`);
  useEffect(() => {
    const previous = document.activeElement as HTMLElement | null;
    const element = dialog.current!;
    element.showModal();
    return () => {
      element.close();
      previous?.focus();
    };
  }, []);
  const context = (position: SwapPosition) => {
    const employee = park.employees.find(
      (e) => e.employeeId === position.employeeId,
    )!;
    const rotation = park.rotations.find((r) => r.id === position.rotationId)!;
    const label =
      position.slot < 3
        ? rotation.stands[position.slot].name
        : offStandLabel(state, state.rotations[rotation.id]);
    return (
      <>
        <strong>
          {employee.employeeName} · {employee.employeeId}
        </strong>
        <span>
          {employee.jobRole} · Arrival {employee.arrivalTime}
        </span>
        <span>
          {rotation.id} · {rotation.name} · {rotation.zone}
        </span>
        <span>
          {position.slot < 3 ? `Stand ${position.slot + 1} · ` : ""}
          {label}
        </span>
      </>
    );
  };
  const candidates = park.employees.flatMap((employee) => {
    const position = positionOf(state, employee.employeeId);
    return position &&
      position.rotationId !== first.rotationId &&
      `${employee.employeeName} ${employee.employeeId}`
        .toLowerCase()
        .includes(query.toLowerCase())
      ? [position]
      : [];
  });
  return (
    <dialog
      ref={dialog}
      className="swap-dialog"
      aria-labelledby="swap-title"
      onKeyDown={(event) => {
        if (event.key !== "Tab") return;
        const controls = Array.from(
          event.currentTarget.querySelectorAll<HTMLElement>(
            "button:not(:disabled), input:not(:disabled), select:not(:disabled), [tabindex='0']",
          ),
        );
        const firstControl = controls[0],
          lastControl = controls.at(-1);
        if (!firstControl || !lastControl) {
          event.preventDefault();
          return;
        }
        if (event.shiftKey && document.activeElement === firstControl) {
          event.preventDefault();
          lastControl.focus();
        } else if (!event.shiftKey && document.activeElement === lastControl) {
          event.preventDefault();
          firstControl.focus();
        }
      }}
      onCancel={(event) => {
        event.preventDefault();
        close();
      }}
    >
      <h2 id="swap-title">
        {review ? "Review employee swap" : "Change assignment"}
      </h2>
      <p className="muted">
        Simulation paused. This two-way swap affects the current day only.
      </p>
      <div className="swap-context">{context(first)}</div>
      <p className="small muted">
        Prototype constraints: same role, arrival time, position in the cycle,
        and remaining break plan. Neither person can be on break. These are
        data-integrity constraints, not real-world qualification rules.
      </p>
      {!review ? (
        <>
          <label className="swap-search">
            Find swap candidate
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Name or employee ID"
            />
          </label>
          <fieldset className="swap-candidates">
            <legend>Choose an employee from another rotation</legend>
            {candidates.map((position) => {
              const reason = swapError(park, state, first, position);
              return (
                <label
                  key={position.employeeId}
                  className={`swap-candidate ${second?.employeeId === position.employeeId ? "selected" : ""} ${reason ? "unavailable" : ""}`}
                >
                  <input
                    type="radio"
                    name="candidate"
                    value={position.employeeId}
                    disabled={!!reason}
                    checked={second?.employeeId === position.employeeId}
                    onChange={() => {
                      setSecond(position);
                      setError("");
                    }}
                  />
                  <div>
                    {context(position)}
                    {reason && <small>{reason}</small>}
                  </div>
                </label>
              );
            })}
            {!candidates.length && (
              <p role="status">No assigned employees match your search.</p>
            )}
            {candidates.length > 0 &&
              candidates.every((p) => swapError(park, state, first, p)) && (
                <p role="status">
                  No eligible candidates at this time. Try again after the
                  rotations advance.
                </p>
              )}
          </fieldset>
        </>
      ) : (
        second && (
          <>
            <p>Swap positions with:</p>
            <div className="swap-context">{context(second)}</div>
            <p>
              Both assignments and future unstarted breaks move together. Past
              records and each employee’s arrival stay unchanged.
            </p>
          </>
        )
      )}
      {error && (
        <p role="alert" className="notice amber">
          {error}
        </p>
      )}
      <footer className="swap-actions">
        <button onClick={close}>Cancel</button>
        {review && (
          <button
            onClick={() => {
              setReview(false);
              setError("");
            }}
          >
            Back
          </button>
        )}
        <button
          className="primary"
          disabled={!second}
          onClick={() => {
            if (!second) return;
            const reason = swapError(park, state, first, second);
            if (reason) {
              setError(reason);
              return;
            }
            if (!review) {
              setReview(true);
              return;
            }
            try {
              confirm({ id: commandId, first, second });
              close();
            } catch (failure) {
              setError(
                failure instanceof Error
                  ? failure.message
                  : "Swap could not be recorded.",
              );
            }
          }}
        >
          {review ? "Confirm swap" : "Review swap"}
        </button>
      </footer>
    </dialog>
  );
}
