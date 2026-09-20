# Blue Current Adventure Park

**Version:** 0.1  
**Status:** Working draft  
**Purpose:** Fictional operating environment for the Aquatic Operations Dashboard

## Park Concept

Blue Current Adventure Park is a fictional water park themed around ocean
currents, coastal exploration, waves, lagoons, and cliffside adventure.

The park and all of its attractions, employees, schedules, operating records,
and procedures are synthetic. They do not represent any real organization.

## Central Operations

### Operations Base

Operations Base is the central coordination location for the park. The
dashboard prototype is designed primarily for the coordinator working at Base.

Base maintains visibility into:

- Rotation assignments
- Confirmed and expected break activity
- Current and expected employee positions
- Rotation delays
- Expected Extra assignments
- Area-level operating status

## Operational Zones

| Zone | Theme | Primary operations |
|---|---|---|
| Current Cove | Sheltered coastal lagoon | Family attractions and shallow water |
| Tidal Bay | Open-water waves and tides | Wave pools and deep-water coverage |
| Rapids Ridge | Rocky river canyon | Rivers, raft slides, and runout areas |
| Blue Peak | Cliffside thrill complex | High-thrill slides and deep landing pools |

## Rotation Allocation

| Employee group | Current Cove | Tidal Bay | Rapids Ridge | Blue Peak | Total |
|---|---:|---:|---:|---:|---:|
| Shallow Water Lifeguards | 3 | 2 | 1 | 2 | 8 |
| Deep Water Lifeguards | 0 | 2 | 0 | 1 | 3 |
| Slide Operators | 0 | 0 | 3 | 3 | 6 |
| **Total** | **3** | **4** | **4** | **6** | **17** |

## Rotation Registry

Each rotation contains three staffed positions. During an active break cycle,
a fourth employee moves through the three positions and the break assignment.

| Rotation ID | Zone | Employee group | Rotation name |
|---|---|---|---|
| SW-CC-01 | Current Cove | Shallow Water Lifeguard | Tidepool Loop |
| SW-CC-02 | Current Cove | Shallow Water Lifeguard | Harbor Drift |
| SW-CC-03 | Current Cove | Shallow Water Lifeguard | Coral Crossing |
| SW-BB-01 | Tidal Bay | Shallow Water Lifeguard | Tidal East |
| SW-BB-02 | Tidal Bay | Shallow Water Lifeguard | Tidal West |
| SW-RR-01 | Rapids Ridge | Shallow Water Lifeguard | Rapids Landing |
| SW-BP-01 | Blue Peak | Shallow Water Lifeguard | Summit Landing |
| SW-BP-02 | Blue Peak | Shallow Water Lifeguard | Current Falls |
| DW-BB-01 | Tidal Bay | Deep Water Lifeguard | Tidal Deep North |
| DW-BB-02 | Tidal Bay | Deep Water Lifeguard | Tidal Deep South |
| DW-BP-01 | Blue Peak | Deep Water Lifeguard | Blue Peak Deep Landing |
| SO-RR-01 | Rapids Ridge | Slide Operator | Riverstone Rafts |
| SO-RR-02 | Rapids Ridge | Slide Operator | Canyon Current |
| SO-RR-03 | Rapids Ridge | Slide Operator | Ridge Racers |
| SO-BP-01 | Blue Peak | Slide Operator | Blue Surge |
| SO-BP-02 | Blue Peak | Slide Operator | Velocity Falls |
| SO-BP-03 | Blue Peak | Slide Operator | Abyss Drop |

## Attraction Registry

| Attraction ID | Zone | Attraction | Attraction type |
|---|---|---|---|
| AT-CC-01 | Current Cove | Tidepool Terrace | Family activity pool |
| AT-CC-02 | Current Cove | Harbor Drift | Slow-current river |
| AT-CC-03 | Current Cove | Coral Crossing | Children's water-play area |
| AT-BB-01 | Tidal Bay | Tidal Bay Wave Pool | Large wave pool |
| AT-RR-01 | Rapids Ridge | Riverstone Rafts | Family raft slide |
| AT-RR-02 | Rapids Ridge | Canyon Current | Enclosed raft slide |
| AT-RR-03 | Rapids Ridge | Ridge Racers | Multi-lane mat slide |
| AT-BP-01 | Blue Peak | Blue Surge | High-speed body slide |
| AT-BP-02 | Blue Peak | Velocity Falls | Multi-rider tube slide |
| AT-BP-03 | Blue Peak | Abyss Drop | Drop slide with deep landing pool |
| AT-BP-04 | Blue Peak | Summit Landing Pool | Shared shallow landing pool |
| AT-BP-05 | Blue Peak | Current Falls | Shallow-water slide complex |

## Rotation Position Registry

The scheduling engine continues to use `Stand 1`, `Stand 2`, and `Stand 3`.
The dashboard may display the attraction-specific position names below while
preserving the same rotation order.

| Rotation ID | Attraction | Stand 1 display name | Stand 2 display name | Stand 3 display name |
|---|---|---|---|---|
| SW-CC-01 | Tidepool Terrace | North Shore | Activity Island | South Shore |
| SW-CC-02 | Harbor Drift | Entry Bend | Lighthouse Curve | Exit Bend |
| SW-CC-03 | Coral Crossing | Spray Deck | Bridge Pool | Lagoon Exit |
| SW-BB-01 | Tidal Bay Wave Pool | East Shore One | East Shore Two | East Shore Three |
| SW-BB-02 | Tidal Bay Wave Pool | West Shore One | West Shore Two | West Shore Three |
| SW-RR-01 | Riverstone Rafts | Landing Left | Landing Center | Landing Right |
| SW-BP-01 | Summit Landing Pool | Surge Runout | Shared Center | Velocity Runout |
| SW-BP-02 | Current Falls | Falls Entry | Falls Center | Falls Exit |
| DW-BB-01 | Tidal Bay Wave Pool | North Platform | North Center | North Transition |
| DW-BB-02 | Tidal Bay Wave Pool | South Platform | South Center | South Transition |
| DW-BP-01 | Abyss Drop | Deep Entry | Deep Center | Deep Exit |
| SO-RR-01 | Riverstone Rafts | Queue Entry | Raft Load | Dispatch |
| SO-RR-02 | Canyon Current | Tower Entry | Raft Load | Dispatch |
| SO-RR-03 | Ridge Racers | Mat Pickup | Lane Load | Dispatch |
| SO-BP-01 | Blue Surge | Tower Entry | Load Platform | Dispatch |
| SO-BP-02 | Velocity Falls | Queue Entry | Tube Load | Dispatch |
| SO-BP-03 | Abyss Drop | Queue Entry | Launch Platform | Dispatch |

## Standard Position Naming

The first prototype uses generic position names so that the scheduling engine
can operate consistently across every rotation:

```text
Stand 1 -> Stand 2 -> Stand 3 -> Break or Extra -> Stand 1
```

Attraction-specific position names may be added later without changing the
underlying rotation sequence.

## Working Assumptions

- Operations Base is the primary dashboard user location.
- Every listed rotation begins with three staffed positions.
- A fourth employee joins the active cycle as the breaker.
- The existing rotation timing rules apply to all three employee groups in the
  first prototype.
- Differences between lifeguard and slide-operator workflows will be added only
  after they are documented and validated.

## Synthetic Staffing Model

The first fictional operating day uses a 6:00 PM park closing and contains 74
scheduled employees:

| Employee group | Scheduled employees |
|---|---:|
| Shallow Water Lifeguards | 32 |
| Deep Water Lifeguards | 12 |
| Slide Operators | 24 |
| Area Coordinators | 4 |
| Base Coordinator | 1 |
| Operations Lead | 1 |
| **Total** | **74** |

Each of the 17 rotations receives four employees. The six coordinators are not
part of a rotation and provide parkwide, base, or area coverage.

The machine-readable source is `data/blue_current_staffing.json`. All names and
assignments are synthetic and are intended only for training, prototyping, and
portfolio demonstrations.

## Next Design Tasks

1. Connect the fictional park data to the rotation engine.
2. Display the 17 rotations on the dashboard.
3. Add simulated clock-in and break events for the fictional operating day.
