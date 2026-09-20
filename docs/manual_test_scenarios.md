# Manual Test Scenarios

**Version:** 0.1  
**Status:** Draft  
**Related requirements:** `rotation_rules.md`

## Scenario ROT-001: On-Time Rotation With a 6:00 PM Closing

### Purpose

Verify that the rotation timeline, employee positions, break schedule, final break bump, and post-break Extra assignment are calculated correctly when no delays occur.

### Operating-Day Inputs

| Input | Value |
|---|---|
| Park opening time | 10:00 AM |
| Park closing time | 6:00 PM |
| Shift end time | 6:30 PM |
| Breaker arrival time | 11:00 AM |
| First break start time | 11:10 AM |
| Transition allowance | 15 minutes |
| Post-break bump interval | 30 minutes |

### Employee Inputs

| Employee | Arrival | Starting assignment | Break plan |
|---|---|---|---|
| Avery | 8:00 AM | Stand 3 | 45 + 30 |
| Blake | 9:00 AM | Stand 2 | 30 + 30 |
| Cameron | 9:45 AM | Stand 1 | 30 + 30 |
| Dakota | 11:00 AM | Breaker | 45 |

### Expected Break Timeline

| Event | Expected time | Data classification |
|---|---|---|
| Avery first break starts | 11:10 AM | Confirmed |
| Avery first break ends | 11:55 AM | Confirmed |
| Blake first break starts | 12:10 PM | Confirmed |
| Blake first break ends | 12:40 PM | Confirmed |
| Cameron first break starts | 12:55 PM | Confirmed |
| Cameron first break ends | 1:25 PM | Confirmed |
| Dakota break starts | 1:40 PM | Confirmed |
| Dakota break ends | 2:25 PM | Confirmed |
| Avery second break starts | 2:40 PM | Confirmed |
| Avery second break ends | 3:10 PM | Calculated |
| Blake second break starts | 3:25 PM | Confirmed |
| Blake second break ends | 3:55 PM | Calculated |
| Cameron second break starts | 4:10 PM | Confirmed |
| Cameron second break ends | 4:40 PM | Calculated |
| Final break bump completes | 4:55 PM | Expected |
| Final post-break bump occurs | 5:25 PM | Expected |

### Expected Final Assignments

After the 5:25 PM bump, the rotation stops rotating.

| Employee | Expected assignment |
|---|---|
| Dakota | Stand 1 |
| Cameron | Stand 2 |
| Blake | Stand 3 |
| Avery | Extra |

No additional bump is scheduled before the 6:00 PM closing.

## Scenario ROT-002: Delayed First Handoff With a 6:00 PM Closing

### Purpose

Verify that a confirmed delay changes the adjusted rotation timeline and may eliminate a later post-break bump.

### Starting Conditions

This scenario uses the same operating-day and employee inputs as `ROT-001`.

Only one event changes:

| Event | On-time value | Actual value |
|---|---|---|
| Blake first break starts | 12:10 PM | 12:18 PM |

Avery's first break still ends at 11:55 AM. All handoffs after Blake's delayed break start are assumed to use the full 15-minute transition allowance without adding another delay.

### Delay Calculation

| Measurement | Value |
|---|---:|
| Avery first break end | 11:55 AM |
| Blake actual first break start | 12:18 PM |
| Actual transition time | 23 minutes |
| Allowed transition time | 15 minutes |
| Confirmed delay | 8 minutes |

### Adjusted Timeline

| Event | Adjusted time | Data classification |
|---|---|---|
| Avery first break ends | 11:55 AM | Confirmed |
| Blake first break starts | 12:18 PM | Confirmed |
| Blake first break ends | 12:48 PM | Confirmed |
| Cameron first break starts | 1:03 PM | Confirmed |
| Cameron first break ends | 1:33 PM | Confirmed |
| Dakota break starts | 1:48 PM | Confirmed |
| Dakota break ends | 2:33 PM | Confirmed |
| Avery second break starts | 2:48 PM | Confirmed |
| Avery second break ends | 3:18 PM | Calculated |
| Blake second break starts | 3:33 PM | Confirmed |
| Blake second break ends | 4:03 PM | Calculated |
| Cameron second break starts | 4:18 PM | Confirmed |
| Cameron second break ends | 4:48 PM | Calculated |
| Final break bump completes | 5:03 PM | Expected |
| Next post-break bump candidate | 5:33 PM | Not scheduled |

The 5:33 PM bump is not scheduled because it occurs after the 5:30 PM latest useful bump time.

### Expected Final Assignments

After the 5:03 PM final break bump, the rotation stops rotating.

| Employee | Expected assignment |
|---|---|
| Cameron | Stand 1 |
| Blake | Stand 2 |
| Avery | Stand 3 |
| Dakota | Extra |

### Expected Result

The dashboard must:

- Report an 8-minute confirmed delay.
- Show the adjusted timeline.
- Remove the normally expected 5:25 PM post-break bump.
- Display Dakota as the Expected Extra through park closing.