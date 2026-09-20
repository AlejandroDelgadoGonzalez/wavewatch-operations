# V2 verification report

Verified locally on Windows with Node 24 and headless Microsoft Edge on September 19, 2026. This incremental video-feedback update preserves the original simulator. No hosted deployment was changed.

## Follow-up: stand search and independent Team filters

Only these two features were extended; reference data, names, rotation rules, swaps, timers and existing functionality were preserved.

- Rotation Board uses `rotation.stands[].name` alongside its existing rotation, attraction and current employee-name search. Queries are trimmed and case-insensitive, and combine with the existing role/zone filters.
- Team has separate search, role, zone and sort state. Coordinator groups Area Coordinator, Base Coordinator and Operations Lead without changing their job-role values. Zone filtering uses current operating-day membership; Parkwide appears when present. Search/filtering precedes sorting on a new array.
- Matching counts use a polite status region; empty results explain how to recover. Reset filters clears only Team search/role/zone and restores Name (A–Z). Native labeled controls stack in one column at mobile width.

Verification passed: `npm run verify` (14 Python + 25 simulation/selector + 2 SSR tests = 41 tests), scheduling contract drift check, build, ESLint and TypeScript. The separate `npm run build` and `npm start` preview flow also passed.

Compiled browser QA passed at 1440×1000 and 390×844, including:

- North Platform, North Center, North Transition and Activity Island; upper/lowercase and surrounding spaces; matching and conflicting role/zone filters.
- All five Team role choices, all three underlying coordinator roles, all six zone choices including All zones and Parkwide, counts and empty results.
- Combined name/ID search, role, zone and both sort modes; selector tests additionally cover every role/zone/sort combination and source/state immutability.
- Two-way filter independence across view changes, including Reset filters preserving the Rotation Board selections.
- Current-zone filtering immediately after the existing Ethan Johnson / Adrian Morgan swap, without reloading.
- Accessible filter names, native control tab order, keyboard-activated reset, mobile control stacking and page-level overflow checks. No browser console/page errors, request failures or hydration errors were observed. Existing full simulator/browser regressions also passed.

Visual checks used `outputs/v2-qa/filters-1440-board.png`, `filters-1440-team.png`, `filters-390-board.png` and `filters-390-team.png` (generated, ignored artifacts). These are targeted accessibility and layout checks, not a formal accessibility certification.

Files changed in this follow-up: `app/page.tsx`, `app/globals.css`, `operations/selectors.ts`, `tests/simulation.test.ts`, `scripts/browser-qa.mjs`, and `docs/v2_qa.md`. Earlier changes below remain intact.

## Automated verification

`npm run verify` passed:

- **14 Python tests:** existing scheduling regressions plus stable stand IDs, 51 unique four-digit extensions, invalid stand data rejection, Tidal names, fixed staffing totals and preserved Breaker roles.
- **Contract drift check:** browser contract matches the Python scheduling reference.
- **21 simulation tests:** the original 13 regressions plus Bump Time evidence/variance/pending state, atomic/idempotent swaps, invalid/stale/active-break rejection, live Team membership, future source ownership and bumps, completed history preservation, replay with swaps (including calculated-end timing), all-closing break entitlement, Extra-cycle swaps, chronological stable Team sorting and readable off-stand states.
- **2 SSR/data tests:** rendered V2 controls, all 17 ordered card lists, named stands, Tidal labels, synthetic staffing totals and absence of V1 controls/old zone labels.
- **Production build, ESLint and TypeScript:** passed.

## Browser interaction checks

`scripts/browser-qa.mjs` passed against the compiled Worker served by Wrangler at `http://127.0.0.1:3001`:

- Start, advancing clock, pause without drift, one-minute step, resume, speed change and restart.
- Employee search and zone filtering, rotation selection and detail closing.
- All 17 cards contain four vertically ordered assignment rows with their own stand names. Tidal Bay filtering returns its four rotations.
- SW-CC-01 assignment rows use each employee's own arrival time and all three static stand extensions.
- Nia Torres → Adrian Morgan: recorded 11:55 AM → 12:10 PM handoff displays expected 15, actual 15, Confirmed. Before the second endpoint, actual is pending.
- Maya Nguyen → Ethan Johnson: 11:55 AM → 12:18 PM displays expected 15, actual 23 (+8), Confirmed. Cause-unknown text lives in Bump Time; employee break rows contain no delay attribution.
- On-break employee selection has no eligible candidates; missing-name search has a useful empty state and disabled review action.
- Ethan Johnson ↔ Adrian Morgan: select by keyboard, visible radio state, review/cancel without mutation, confirm on 390px mobile, both cards/details updated, Team's live rotation/zone updated, one neutral Activity record, and the next bump moves both employees into their new rotation's break slot.
- Both Team sort modes agree with a parsed-time/name/ID reference ordering; search works in both modes without losing membership changes.
- Modal focus remains inside while tabbing, Escape/cancel restores the Change button, and the simulation stays paused. An initial browser check caught native-dialog focus escaping to browser chrome; an explicit Tab boundary handler fixed it before the passing run.
- ROT-002 overdue state before the source record, then eight-minute delay, recalculation, last break at 4:48 and final bump at 5:03 with no additional bump.
- ROT-001 last break at 4:40, final bump at 4:55 and 5:25 extra-cycle expectation.
- Closing-time checkpoints for 5, 6, 7 and 8 PM.
- Experimental note appearing in the structured activity feed; evidence filtering.
- Same-seed replay producing identical visible activity history.
- All 74 team rows and employee search; keyboard navigation to About.
- No development inspector in the compiled build; no browser runtime errors.
- Browser console error messages are explicitly collected and asserted empty. Metadata references the existing SVG favicon so browsers do not request a missing ICO file. Loopback hosts use HTTP for local metadata assets; a new SSR assertion covers this after QA detected an HTTPS/HTTP mismatch.
- Desktop 1440×1000, tablet 900×1000 and mobile 390×844 without page-level horizontal overflow.

## Visual inspection

Screenshots were inspected for pre-opening, active break, overdue handoff, delayed timeline, Expected Extra cycle, near-closing state, tablet detail and mobile Operations/Lab. Checks focused on readable assignment names, evidence distinctions, delay copy without blame, wrapping, spacing and unclipped controls.

Fixes from QA included explicit accessible names for Lab selectors, a top-level attention shortcut, unconfirmed empty-assignment labels, scenario-dependent checkpoints, correct Calculated labeling for projected second-break ends, and the Windows compiled-preview issue documented in the audit.

Selected screenshots are maintained under `docs/screenshots/`, including the refreshed board/timeline and new mobile swap/detail views. The complete generated set stays in ignored `outputs/v2-qa/` and can be regenerated. This is targeted functional/visual QA, not a formal accessibility certification, safety validation, or proof of real-world operational suitability.

## Prototype assumptions and remaining limits

- Extensions are static synthetic values 1001–1051; stand IDs use rotation ID plus S1/S2/S3. Existing BB IDs remain stable.
- Same role, arrival, cycle slot and remaining plan are required for swaps; active-break employees and closed days are excluded. These are implementation constraints, not real operational policy. Arbitrary different-arrival swaps are not supported.
- Manual swap observations are Confirmed actions inside the simulation. They do not prove real employee location. Subsequent inferred positions and Extra status retain their existing evidence levels.
- Reload/restart resets the local run; there is no saved-state or multiuser synchronization. Source timing is preserved when future break ownership changes. Completed events and breaks are never rewritten.
- The legacy optional workbook generator was updated to emit the new labels and stand schema. No old, ignored spreadsheet exports were treated as app fixtures or regenerated during this web-only update.

## Exact changed files

- UI: `app/page.tsx`, `app/rotation-detail.tsx`, `app/swap-dialog.tsx`, `app/globals.css`, `app/layout.tsx`.
- Domain/state: `domain/model.ts`, `operations/projection.ts`, `operations/selectors.ts`, `operations/swaps.ts`, `simulation/engine.ts`.
- Reference/validation: `data/blue_current_staffing.json`, `park_data.py`, `scripts/build_staffing_workbook.mjs`.
- Tests: `tests/test_park_data.py`, `tests/simulation.test.ts`, `tests/rendered-html.test.mjs`, `scripts/browser-qa.mjs`.
- Documentation: `README.md`, `docs/park_design.md`, `docs/v2_architecture.md`, `docs/v2_qa.md`.
- Visual evidence: `docs/screenshots/v2-operations.png`, `docs/screenshots/v2-timeline.png`, `docs/screenshots/v2-mobile-swap.png`, `docs/screenshots/v2-mobile-detail.png`. The mobile Lab capture was regenerated and remained byte-identical.

The Python scheduling authority, exported scheduling contract, scenario generator and single-timer React hook were not changed.
