# Data & Analytics architecture

All information is **Synthetic Simulation Data** for fictional Blue Current Adventure Park. This is a learning/portfolio simulation, not an operational safety system or an employee evaluation tool.

## Pipeline and boundaries

`Python rules → checked scheduling contract → seeded source events → SimulationEngine → completed days → normalized handoffs → shared metrics → charts / tables / CSV`

The existing Python scheduler remains authoritative for break durations and closing rules. `SimulationEngine` accepts an optional source-event factory; its default is unchanged. Analytics injects a deterministic scenario factory, then advances each isolated engine through shift end. The live React engine, membership, clock, filters and future event queue are never consulted or changed by historical analysis.

Raw completed days retain source observations and Calculated/Expected projection events, including final returns and post-break Extra cycles. The normalized dataset intentionally includes only adjacent break handoffs. Opening arrivals, final returns and Extra-cycle bumps lack the paired recorded break endpoints needed for the handoff metric and are not silently counted as on-time handoffs.

## Generation and reproducibility

- Week: Monday September 7 through Sunday September 13, 2026 (seven completed demo days).
- Master seed: **20260919**, unsigned 32-bit integer; alternate seeds supported by `createAnalyticsDataset(seed)`.
- Daily seeds: `(masterSeed + imul(dayIndex + 1, 2654435761)) >>> 0`.
- Reuses the existing seeded random generator; selects two rotations for recurring timing variation.
- Day profiles configure probabilities, not final metrics: 0.02, 0.09, 0.16, 0.04, 0.24, 0.32, 0.07. Closings: 5, 6, 6, 7, 6, 8, 7 PM.
- The recurring rotations receive +0.28 variation probability on Tuesday, Wednesday, Friday and Saturday. The first break follows its contractual baseline.
- On-time intervals vary between 12 and 15 minutes. Delayed intervals usually add 1–5 minutes; 9% of sampled delays instead add 11–16 minutes. These are fictional scenario parameters, not new operating policies or severity definitions.
- Each rotation/day has a positive-offset generation budget of `min(40, closing − baseline final bump − 5)` minutes. This bounds synthetic variation so all demo breaks and final returns complete before closing; it is not a production timing policy. No late observations are discarded to improve the displayed rates.
- First-break starts/ends and second-break starts are source observations. Second-break ends are inferred using the unchanged scheduled duration, as in live WaveWatch.

`npm run analytics:export` regenerates the same normalized JSON, joined CSV and complete raw-day snapshots under `outputs/analytics/`. Generated values are not manually stored in components. The in-memory demo cache is immutable by convention and all selection/sort/export functions leave the dataset and reference roster untouched. Tests verify these boundaries.

## Record model and evidence

`analytics/model.ts` defines completed days, handoffs, filters, metrics and sort options. Normalized handoffs contain operating date, unique date-prefixed source event ID, rotation ID, previous/next break employee IDs, endpoint times, expected/actual durations, delay, on-time status, evidence, synthetic classification, break number, closing, scenario and daily seed.

Names, zone, attraction and employee group are joined from the existing park reference using IDs. CSV adds those reference fields. Times are integer **minutes since midnight** within the stated simulated operating day; this is not a UTC event feed.

- **Confirmed:** both the previous break end and next break start are source observations.
- **Calculated:** the previous endpoint includes an inferred second-break end.
- **Expected:** future bump/Extra projections exist in raw completed-day history, but are not presented as observed handoff endpoints.

“Confirmed” describes the synthetic source's evidence level, not a real-world measurement. The entire dataset remains synthetic. Replacing the generator with real data would require authorization, privacy controls and validation by an operations subject-matter expert.

## Definitions

| Metric                     | Definition                                                                    |
| -------------------------- | ----------------------------------------------------------------------------- |
| Transition                 | Next break start − previous break end                                         |
| Allowed transition         | Existing contract: 15 minutes                                                 |
| Delay                      | max(0, transition − allowance)                                                |
| On Time                    | Transition ≤ allowance                                                        |
| On-time percentage         | On-time count / total count × 100                                             |
| Average transition         | Sum of all observed transition minutes / total count                          |
| Median transition          | Middle value, or mean of the two middle values                                |
| Average delayed transition | Mean transition duration among delayed handoffs only                          |
| Average delay              | Mean excess minutes among delayed handoffs only                               |
| Total delay                | Sum of per-handoff excess minutes; overlapping intervals are not deduplicated |
| Maximum delay              | Largest excess interval; 0 if all records are on time, undefined when empty   |

Undefined averages/rates are `null` and display “—”. No-observation days remain gaps in the trend, not 0% performance. Week metrics are calculated over rows, not unweighted averages of daily summaries. All daily, rotation and associated-employee summaries reuse the same aggregator.

Employee association means the selected ID appears at either endpoint. A row is counted once even if both endpoints matched. It does not establish who caused a delay. No employee scores, rankings, blame attribution or person-status colors are generated.

## UI and interaction

One centralized filter state combines day, zone, employee group, rotation, employee association and case-insensitive trimmed text search with AND semantics. Impossible combinations show a useful empty state. Coordinators are selectable but have no modeled handoffs; this is explained rather than inventing records. Reset clears filters and resets the explorer's sort/page, including when filters were already empty. Live Operations and Team filters remain independent.

Week Overview includes four KPIs and five views:

1. Weekly on-time trend on a 0–100% axis, with missing-data gaps and no arbitrary target.
2. Average observed transition for every matching rotation, with a blue 15-minute allowance line.
3. 100% on-time/delayed shares in stable reference order, not ranked order.
4. Daily accumulated delay, accompanied by delayed count, average and maximum in tooltips.
5. 1–2, 3–5, 6–10 and 11+ minute analytics buckets. These are not operational severity categories.

Day and rotation chart controls filter the entire page. Rotation detail exposes zone, attraction, group, daily trend and history. Employee detail is explicitly titled **Associated Handoffs**. Insights are deterministic statements computed from the current selection; no language model is used.

Data Explorer has five sort orders, 25-row pagination, named table headers, keyboard-scrollable wide tables and CSV export of all filtered rows in the selected order. CSV quoting handles commas, quotes and line breaks; formula-like strings are neutralized. Export does not change source data.

## Semantic palette and accessibility

`app/analytics/analytics.css` centralizes green On Time, orange Delayed, blue allowance/reference, muted context, teal selection and a restrained categorical palette. Delayed bars also use stripes, with status words and numeric labels so color is not the only cue. Delay bucket tones grow stronger but do not claim severity thresholds.

Charts use responsive native SVG/CSS rather than introducing a second UI/chart framework. Tooltip targets expose complete textual context, work by hover and keyboard focus and dismiss with Escape. Focusable native controls have labels; tables have captions and column headers. The current application supports a light theme only; no unrelated theme system was added.

## Deliberate limitations and next ideas

- This generated archive is separate from live user-created runs; there is no server persistence or multi-user analytics backend.
- Demo variation is a designed sample, not an estimate of real delay probabilities or causal effects.
- Current reference roster/rotation labels are joined by ID; a future changing organization would need historical dimension snapshots.
- Future work could import authorized completed simulation runs, version datasets, add data-quality/exclusion reports and compare scenario parameters.
- An optional day-by-rotation matrix could be considered if it adds insight without duplicating existing charts. It is not needed for this initial release.
- Real-time staffing recommendations, emergency automation and employee scoring are intentionally out of scope.
