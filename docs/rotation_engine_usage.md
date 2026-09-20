# Rotation Engine Usage

## Purpose

`rotation_calculator.py` generates fictional break timelines, detects recorded
delays, calculates post-break bumps, and determines expected final assignments.

The engine currently supports park closing times of 5:00 PM, 6:00 PM, 7:00 PM,
and 8:00 PM. All data is synthetic and follows the rules documented in
`rotation_rules.md`.

## Run an On-Time Scenario

```powershell
python rotation_calculator.py --closing-time "6:00 PM" --scenario on-time
```

## Run the Documented Delayed Scenario

```powershell
python rotation_calculator.py --closing-time "6:00 PM" --scenario delayed
```

The delayed scenario records Blake's first break at 12:18 PM instead of the
expected 12:10 PM. The engine detects an eight-minute delay, adjusts all later
times, and removes the normally scheduled 5:25 PM post-break bump.

## Try Other Closing Times

Replace the closing time with one of the supported values:

```powershell
python rotation_calculator.py --closing-time "5:00 PM"
python rotation_calculator.py --closing-time "7:00 PM"
python rotation_calculator.py --closing-time "8:00 PM"
```

## Run the Automated Tests

```powershell
python -m unittest discover -s tests -p "test_*.py" -v
```

The tests verify:

- Break duration and transition calculations
- Delay detection
- The `ROT-001` on-time scenario
- The `ROT-002` delayed scenario
- Expected schedules for every supported closing time
- Expected final employee assignments

## Current Limitations

- Employee names and shift patterns are fixed synthetic examples.
- Extra assignments are calculated because their verbal confirmation is not
  available as source data.
- Second break end times are calculated rather than confirmed.
- The engine does not connect to any real employer system.
