"""Export the tested Python scheduling policy for the browser runtime.

Run from any directory. --check detects drift without writing output.
"""
import argparse
import json
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))
from rotation_calculator import (  # noqa: E402
    BREAK_PLANS, POST_BREAK_INTERVALS, TRANSITION_MINUTES,
    MINIMUM_MINUTES_AFTER_BUMP, generate_rotation_scenario,
)


def build_contract():
    return {
        "version": 1,
        "transitionMinutes": TRANSITION_MINUTES,
        "minimumMinutesAfterBump": MINIMUM_MINUTES_AFTER_BUMP,
        "breakPlans": BREAK_PLANS,
        "postBreakIntervals": POST_BREAK_INTERVALS,
        "reference": {closing: generate_rotation_scenario(closing) for closing in BREAK_PLANS},
        "delayedReference": generate_rotation_scenario("6:00 PM", {("Blake", 1): "12:18 PM"}),
    }


if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("--check", action="store_true")
    args = parser.parse_args()
    target = ROOT / "data" / "simulation_contract.json"
    content = json.dumps(build_contract(), indent=2) + "\n"
    if args.check:
        if not target.exists() or target.read_text(encoding="utf-8") != content:
            raise SystemExit("Simulation contract is stale. Run python scripts/export_simulation_contract.py")
        print("Python/browser scheduling contract is current.")
    else:
        target.write_text(content, encoding="utf-8")
        print(target)
