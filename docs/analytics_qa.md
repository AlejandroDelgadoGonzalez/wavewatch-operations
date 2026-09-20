# Data & Analytics verification

Verified September 20, 2026 against the compiled local Worker preview at `http://127.0.0.1:3001`, using Edge/Chromium. This report concerns the new historical analytics feature; existing uncommitted V2 changes were preserved.

## Automated checks

`npm run verify` passed:

- 14 Python tests.
- Python/browser scheduling-contract freshness check.
- 34 TypeScript tests: 25 existing simulation/operations tests plus 9 analytics tests.
- Production build.
- 2 server-rendering/reference-data tests.
- ESLint and TypeScript checks.

Total: **50 passing tests**, plus contract verification, lint, type checking and build. The build reports Vinext's existing static route-classification notice; it does not cause a failed build or preview error.

The nine new analytics tests cover:

1. Exactly 15 minutes gives no delay; 23 minutes gives 8 minutes; invalid endpoints reject.
2. Counts, percentage, mean, median, delayed-only averages, maximum, total and empty/null behavior.
3. Same-seed replay, different-seed variation and seed validation.
4. Seven distinct days, all 17 rotations, repeated delay patterns, occasional outliers, unique event IDs and distribution reconciliation.
5. Completed-day integrity, contract durations, source versus calculated end evidence, Expected bump activity and normalization.
6. Daily/rotation counts, delay sums and record-weighted averages reconcile with the overall dataset.
7. Every day, zone, modeled employee group, rotation and employee association.
8. Combined filters, trimmed case-insensitive search, empty results, reset and source immutability.
9. All sort options, joined CSV columns, filtered exports, quoting/formula safety and array immutability.

## Compiled application checks

Build and preview workflow: `npm run build`, then `npm start`. No development-server-only result was used for acceptance.

`scripts/analytics-browser-qa.mjs` passed at **1440 × 1000**, **900 × 1000** and **390 × 844**:

- Sidebar destination and default Week Overview; no live clock displayed in historical analysis.
- All four KPIs compared with the independent analytics calculation layer.
- All five chart populations, bucket counts and deterministic insights follow the active selection.
- Every day, zone and employee-group option; rotation chart selection, associated employee detail and combined day/zone/group/rotation/employee/search.
- Empty results, coordinator explanation and both reset actions.
- Five Data Explorer sort modes, 25-row pagination and reset of pagination even with otherwise-empty filters.
- Downloaded CSV compared byte-for-byte with all matching sorted records, not just the current page.
- Keyboard focus, Enter activation, hover context and Escape dismissal of tooltips.
- Trend tooltip horizontal bounds checked for every day at all three widths.
- Returning to live Operations preserves its paused clock; historical data remains independent.
- No horizontal page overflow, browser console errors, hydration errors, failed requests or uncaught runtime errors.

The existing `scripts/browser-qa.mjs` regression suite also passed: Rotation Board stand search and combined filters, Team search/roles/zones/sorts, swapped membership, rotation details, Bump Time evidence, swap restrictions/confirmation/history, ROT-001/ROT-002, all closing times and seeded replay.

## Accessibility and visual review

`scripts/analytics-accessibility-qa.mjs` ran axe-core 4.10.3 WCAG 2 A/AA and 2.1 AA checks across four states (overview, associated employee, explorer and empty) at three widths: **12 scans, no reported violations**. A pre-existing low-contrast footer was darkened without changing layout or functionality.

Automated scanning is not a full accessibility certification. Axe retains manual-review items for some color/ARIA contexts; visual and interaction review covered chart labels, text alternatives, tooltip text, semantic colors and focus behavior. The app currently supports only a light theme, so no unsupported dark-theme claim is made.

Screenshots were inspected for the full week, a smoother day, Saturday's higher delays, rotation detail, employee association, Blue Peak selection, Data Explorer, narrow layout and mobile tooltip placement. KPIs appear before the longer filter form on mobile. Wide tables scroll within their own container instead of widening the page. Native chart labels/buttons expose values even where a small SVG axis alone would be difficult to read.

Color review: green consistently means On Time; orange/striping means Delayed; blue is the 15-minute reference; teal indicates selection/context. Employee names and IDs are not assigned performance colors. Numeric labels and status text supplement every status color. The average-transition scale is labeled with its actual maximum (22.5 minutes in the unfiltered week), not a rounded axis limit.

Artifacts are generated locally under `outputs/analytics-qa/`: screenshots, `filtered.csv` and `accessibility.json`. They are intentionally git-ignored. Re-run the browser scripts against a separately started compiled preview. Playwright is an optional QA dependency; use `BROWSER_CHANNEL=msedge` on Windows. The accessibility script documents its isolated optional axe installation under `outputs/qa-tools/`, without adding a production dependency.

PowerShell reproduction (with the preview already running):

```powershell
$env:BROWSER_CHANNEL = 'msedge'
$env:QA_URL = 'http://127.0.0.1:3001'
$env:QA_PRODUCTION = '1'
node scripts/analytics-browser-qa.mjs
node scripts/analytics-accessibility-qa.mjs
node scripts/browser-qa.mjs
```

Set `QA_URL` explicitly for the existing regression suite: its default points to the development server on port 3000, not the compiled preview on port 3001.

## Reproduction checkpoint

`npm run analytics:export` completed successfully. With seed **20260919**, the generated week contains:

| Metric | Generated result |
| --- | ---: |
| Completed days | 7 |
| Handoffs | 765 |
| On-time handoffs | 665 |
| Delayed handoffs | 100 |
| On-time rate | 86.9281045751634% |
| Average transition | 14.154248366013071 minutes |
| Median transition | 14 minutes |
| Average delay, delayed only | 3.37 minutes |
| Maximum delay | 16 minutes |
| Total delay | 337 minutes |
| Confirmed / Calculated handoffs | 476 / 289 |

These are a QA checkpoint, not frontend constants. The UI calculates and rounds displayed values from records. The synthetic archive is not presented as real employer data and no public deployment was changed.

## Files in this analytics increment

Created:

- `analytics/model.ts`, `generate.ts`, `transform.ts`, `dataset.ts`, `metrics.ts`, `export.ts`.
- `app/analytics/page-panel.tsx`, `charts.tsx`, `handoff-table.tsx`, `analytics.css`.
- `tests/analytics.test.ts`.
- `scripts/export-analytics.ts`, `analytics-browser-qa.mjs`, `analytics-accessibility-qa.mjs`.
- `docs/analytics.md`, `docs/analytics_qa.md`.

Modified:

- `app/page.tsx`: navigation, historical header and isolated analytics destination.
- `app/globals.css`: footer contrast correction only for this increment.
- `simulation/engine.ts`: optional source-event factory, preserving default live behavior.
- `package.json`: analytics tests in verification and deterministic export command.
- `README.md`: end-to-end portfolio explanation and reproduction instructions.

Earlier V2 source/test/data changes already present in the working tree are not attributed to this analytics increment.
