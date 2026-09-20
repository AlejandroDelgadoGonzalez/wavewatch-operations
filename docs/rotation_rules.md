# Rotation Rules

**Version:** 0.1  
**Status:** Draft  
**Last updated:** 2026-08-01  
**Pending validation:** Operations subject-matter expert

## Purpose

This document defines the fictional staffing and rotation rules used by the Aquatic Operations Dashboard prototype.

The dashboard is intended to calculate expected employee positions, track break activity, identify possible rotation delays, and organize operational information in one location.

## Safety and Data Boundaries

All employee names, schedules, locations, and operational records used by this project are synthetic.

This prototype does not represent the internal systems or procedures of any real organization. It is not intended for real-world safety-critical operations.

## Fictional Facility Structure

The fictional water park contains 17 employee rotations divided among three operational groups.

| Employee group | Number of rotations |
|---|---:|
| Shallow Water Lifeguards | 8 |
| Deep Water Lifeguards | 3 |
| Slide Operators | 6 |
| **Total** | **17** |

These quantities are working assumptions and may change after review with the operations subject-matter expert.

## Standard Rotation Structure

A fully active rotation contains four employees and three staffed positions:

- Stand 1
- Stand 2
- Stand 3
- One off-stand assignment

During the break cycle, the off-stand assignment is a scheduled break. After all scheduled breaks are complete, the off-stand assignment becomes an Extra assignment.

An individual employee moves through the rotation in this order:

```text
Stand 1 -> Stand 2 -> Stand 3 -> Break or Extra -> Stand 1
```

During a bump, all four employees move at the same time:

| Current assignment | Assignment after bump |
|---|---|
| Break or Extra | Stand 1 |
| Stand 1 | Stand 2 |
| Stand 2 | Stand 3 |
| Stand 3 | Break or Extra |

## Opening and Initial Assignments

For the reference operating day, the fictional park opens at 10:00 AM. Three employees cover the rotation when the park opens.

| Employee arrival | Initial assignment |
|---|---|
| 9:45 AM | Stand 1 |
| 9:00 AM | Stand 2 |
| 8:00 AM | Stand 3 |
| 11:00 AM | Breaker; not yet active in the rotation |

The breaker arrives at 11:00 AM and initiates the first bump. The employee who started at Stand 3 is expected to begin the first break at 11:10 AM.

After the first bump, the expected assignments are:

| Employee arrival | Assignment |
|---|---|
| 11:00 AM | Stand 1 |
| 9:45 AM | Stand 2 |
| 9:00 AM | Stand 3 |
| 8:00 AM | First break |

## Shift and Break Plans

Employees arrive at the same scheduled times for each operating day. Their shifts end 30 minutes after the park closes.

A shift lasting 6.5 hours receives 45 total break minutes. Each additional two full hours of work adds 15 break minutes.

The break sequence depends on both the employee's arrival time and the park closing time.

| Park closes | 8:00 AM arrival | 9:00 AM arrival | 9:45 AM arrival | 11:00 AM arrival |
|---|---|---|---|---|
| 5:00 PM | 30 + 30 | 30 + 30 | 30 + 15 | 45 |
| 6:00 PM | 45 + 30 | 30 + 30 | 30 + 30 | 45 |
| 7:00 PM | 45 + 30 | 45 + 30 | 30 + 30 | 30 + 30 |
| 8:00 PM | 45 + 45 | 45 + 30 | 45 + 30 | 30 + 30 |

Break durations are listed in chronological order. For example, `45 + 30` means that the employee receives a 45-minute first break followed by a 30-minute second break.

## Data Availability and Inference Rules

The dashboard must distinguish information recorded by the source system from information calculated by the prototype.

| Information | Classification | Explanation |
|---|---|---|
| Employee arrival time | Confirmed | Recorded by the source system |
| Starting position | Confirmed | Assigned when the employee clocks in |
| First break start | Confirmed | Recorded by the source system |
| First break end | Confirmed | Recorded by the source system |
| Second break start | Confirmed | Recorded by the source system |
| Second break end | Calculated | Not recorded by the source system |
| Expected current position | Calculated | Derived from starting position and bump activity |
| Final bump completion | Expected | No direct confirmation is available |
| Extra assignment | Expected | Communicated verbally and not recorded |

The expected end of a second break is calculated using:

```text
Expected second break end =
second break start + scheduled break duration
```

The expected completion of the following bump is calculated using:

```text
Expected bump completion =
expected break end + 15 minutes
```

Calculated information must not be presented as confirmed activity.

## Rotation Timing and Delay Detection

A bump is processed during the transition between the end of one employee's break and the beginning of the next employee's break.

The expected transition allowance is 15 minutes.

```text
Transition time =
next break start - previous break end
```

```text
Rotation delay =
maximum of 0 and (transition time - 15 minutes)
```

If the next break begins within 15 minutes, the rotation is considered on time. If the next break has not started after 15 minutes, the rotation is considered delayed.

When the previous break end is confirmed, the system can report a detected delay. When the previous break end is calculated, the system must report an estimated delay.

| Previous break end | Next break start | Result |
|---|---|---|
| Confirmed | Confirmed | Detected transition time |
| Calculated | Confirmed | Estimated transition time |
| Calculated | Not yet recorded | Expected or delayed status |

A delay must be associated with the handoff window, not automatically attributed to an individual employee.

For example:

```text
8-minute delay detected during the handoff
between one break ending and the next break starting
```

The available data cannot prove whether the delay was caused by an extended break, walking time, the bump process, or another operational event.

## Final Break Bump and Post-Break Extra Cycle

After the final scheduled break, the returning employee performs one final break-related bump.

During this bump:

- The returning employee enters Stand 1.
- The Stand 1 employee moves to Stand 2.
- The Stand 2 employee moves to Stand 3.
- The Stand 3 employee exits the rotation and becomes the Expected Extra.

The final bump is expected to finish 15 minutes after the final break ends. Its actual completion is not recorded.

After scheduled breaks are complete, the rotation changes from the Break Cycle to the Post-Break Extra Cycle.

The off-stand employee communicates verbally with Base and may receive an Extra assignment. These assignments are not recorded by the source system.

### Post-Break Timing Rules

| Park closes | Post-break interval |
|---|---:|
| 5:00 PM | No additional bumps |
| 6:00 PM | 30 minutes |
| 7:00 PM | 25 minutes |
| 8:00 PM | 25 minutes |

An additional bump is performed only when at least 30 minutes will remain before park closing.

```text
Latest useful bump time =
park closing time - 30 minutes
```

### Expected On-Time Schedule

| Park closes | Last break ends | Final break bump | Additional post-break bumps |
|---|---|---|---|
| 5:00 PM | 4:10 PM | 4:25 PM | None |
| 6:00 PM | 4:40 PM | 4:55 PM | 5:25 PM |
| 7:00 PM | 5:25 PM | 5:40 PM | 6:05 PM and 6:30 PM |
| 8:00 PM | 5:55 PM | 6:10 PM | 6:35 PM, 7:00 PM, and 7:25 PM |

These times assume that the first break begins at 11:10 AM and that no delays occur. If the rotation becomes delayed, the dashboard must calculate an adjusted schedule.