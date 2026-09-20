import argparse
from datetime import datetime, timedelta

TIME_FORMAT = "%I:%M %p"
FIRST_BREAK_START = "11:10 AM"
TRANSITION_MINUTES = 15
MINIMUM_MINUTES_AFTER_BUMP = 30

EMPLOYEES = [
    {
        "employee": "Avery",
        "arrival": "8:00 AM",
        "starting_assignment": "Stand 3",
    },
    {
        "employee": "Blake",
        "arrival": "9:00 AM",
        "starting_assignment": "Stand 2",
    },
    {
        "employee": "Cameron",
        "arrival": "9:45 AM",
        "starting_assignment": "Stand 1",
    },
    {
        "employee": "Dakota",
        "arrival": "11:00 AM",
        "starting_assignment": "Breaker",
    },
]

BREAK_PLANS = {
    "5:00 PM": {
        "8:00 AM": [30, 30],
        "9:00 AM": [30, 30],
        "9:45 AM": [30, 15],
        "11:00 AM": [45],
    },
    "6:00 PM": {
        "8:00 AM": [45, 30],
        "9:00 AM": [30, 30],
        "9:45 AM": [30, 30],
        "11:00 AM": [45],
    },
    "7:00 PM": {
        "8:00 AM": [45, 30],
        "9:00 AM": [45, 30],
        "9:45 AM": [30, 30],
        "11:00 AM": [30, 30],
    },
    "8:00 PM": {
        "8:00 AM": [45, 45],
        "9:00 AM": [45, 30],
        "9:45 AM": [45, 30],
        "11:00 AM": [30, 30],
    },
}

POST_BREAK_INTERVALS = {
    "5:00 PM": None,
    "6:00 PM": 30,
    "7:00 PM": 25,
    "8:00 PM": 25,
}


def parse_time(time_text):
    return datetime.strptime(time_text, TIME_FORMAT)


def format_time(time_value):
    return time_value.strftime(TIME_FORMAT).lstrip("0")


def calculate_break_timing(
    break_start_text,
    break_duration_minutes,
    transition_minutes=TRANSITION_MINUTES,
):
    break_start = parse_time(break_start_text)
    break_duration = timedelta(minutes=break_duration_minutes)
    transition_allowance = timedelta(minutes=transition_minutes)

    break_end = break_start + break_duration
    next_break_start = break_end + transition_allowance

    return break_end, next_break_start


def calculate_delay(expected_start_text, actual_start_text):
    expected_start = parse_time(expected_start_text)
    actual_start = parse_time(actual_start_text)
    difference = actual_start - expected_start
    delay_minutes = int(difference.total_seconds() / 60)
    return max(0, delay_minutes)


def create_break_schedule(closing_time):
    if closing_time not in BREAK_PLANS:
        supported_times = ", ".join(BREAK_PLANS)
        raise ValueError(
            f"Unsupported closing time: {closing_time}. "
            f"Choose one of: {supported_times}."
        )

    closing_plan = BREAK_PLANS[closing_time]
    maximum_breaks = max(len(breaks) for breaks in closing_plan.values())
    break_schedule = []

    for break_index in range(maximum_breaks):
        for employee in EMPLOYEES:
            durations = closing_plan[employee["arrival"]]
            if break_index < len(durations):
                break_schedule.append(
                    {
                        "employee": employee["employee"],
                        "arrival": employee["arrival"],
                        "break_number": break_index + 1,
                        "duration_minutes": durations[break_index],
                    }
                )

    return break_schedule


def calculate_rotation_timeline(
    closing_time,
    actual_starts=None,
    first_break_start=FIRST_BREAK_START,
):
    actual_starts = actual_starts or {}
    break_schedule = create_break_schedule(closing_time)
    current_expected_start = first_break_start
    timeline = []

    for break_event in break_schedule:
        event_key = (
            break_event["employee"],
            break_event["break_number"],
        )
        actual_start = actual_starts.get(event_key, current_expected_start)
        delay_minutes = calculate_delay(current_expected_start, actual_start)
        break_end, next_expected_start = calculate_break_timing(
            break_start_text=actual_start,
            break_duration_minutes=break_event["duration_minutes"],
        )

        timeline.append(
            {
                **break_event,
                "expected_start": current_expected_start,
                "actual_start": actual_start,
                "break_end": format_time(break_end),
                "break_end_classification": (
                    "Confirmed"
                    if break_event["break_number"] == 1
                    else "Calculated"
                ),
                "delay_minutes": delay_minutes,
            }
        )

        current_expected_start = format_time(next_expected_start)

    return timeline


def calculate_post_break_schedule(timeline, closing_time):
    if not timeline:
        raise ValueError("A rotation timeline must contain at least one break.")

    last_break_end = parse_time(timeline[-1]["break_end"])
    final_break_bump = last_break_end + timedelta(minutes=TRANSITION_MINUTES)
    park_closing_time = parse_time(closing_time)
    latest_useful_bump = park_closing_time - timedelta(
        minutes=MINIMUM_MINUTES_AFTER_BUMP
    )
    interval_minutes = POST_BREAK_INTERVALS[closing_time]
    post_break_bumps = []

    if interval_minutes is not None:
        candidate = final_break_bump + timedelta(minutes=interval_minutes)
        while candidate <= latest_useful_bump:
            post_break_bumps.append(format_time(candidate))
            candidate += timedelta(minutes=interval_minutes)

    return {
        "last_break_end": format_time(last_break_end),
        "final_break_bump": format_time(final_break_bump),
        "latest_useful_bump": format_time(latest_useful_bump),
        "post_break_interval_minutes": interval_minutes,
        "post_break_bumps": post_break_bumps,
    }


def rotate_assignments(assignments):
    return [assignments[-1], *assignments[:-1]]


def calculate_final_assignments(timeline, post_break_schedule):
    assignments = ["Cameron", "Blake", "Avery", "Dakota"]
    number_of_bumps = (
        len(timeline)
        + 1
        + len(post_break_schedule["post_break_bumps"])
    )

    for _ in range(number_of_bumps):
        assignments = rotate_assignments(assignments)

    return {
        "Stand 1": assignments[0],
        "Stand 2": assignments[1],
        "Stand 3": assignments[2],
        "Extra": assignments[3],
    }


def generate_rotation_scenario(closing_time, actual_starts=None):
    timeline = calculate_rotation_timeline(
        closing_time=closing_time,
        actual_starts=actual_starts,
    )
    post_break_schedule = calculate_post_break_schedule(
        timeline=timeline,
        closing_time=closing_time,
    )
    final_assignments = calculate_final_assignments(
        timeline=timeline,
        post_break_schedule=post_break_schedule,
    )

    return {
        "closing_time": closing_time,
        "timeline": timeline,
        "total_detected_delay_minutes": sum(
            event["delay_minutes"] for event in timeline
        ),
        "post_break_schedule": post_break_schedule,
        "final_assignments": final_assignments,
    }


def print_rotation_scenario(scenario_name, scenario):
    print(f"Scenario: {scenario_name}")
    print(f'Park closing time: {scenario["closing_time"]}')
    print()

    for event in scenario["timeline"]:
        status = (
            f'DELAYED by {event["delay_minutes"]} minutes'
            if event["delay_minutes"] > 0
            else "ON TIME"
        )
        print(
            f'{event["employee"]} break {event["break_number"]}: '
            f'{event["actual_start"]} - {event["break_end"]} | {status}'
        )

    post_break = scenario["post_break_schedule"]
    print()
    print(
        "Total detected delay:",
        f'{scenario["total_detected_delay_minutes"]} minutes',
    )
    print("Final break bump:", post_break["final_break_bump"])
    print(
        "Post-break bumps:",
        ", ".join(post_break["post_break_bumps"]) or "None",
    )
    print()
    print("Final assignments:")
    for assignment, employee in scenario["final_assignments"].items():
        print(f"  {assignment}: {employee}")


def parse_arguments():
    parser = argparse.ArgumentParser(
        description="Calculate a fictional aquatic rotation schedule."
    )
    parser.add_argument(
        "--closing-time",
        choices=BREAK_PLANS.keys(),
        default="6:00 PM",
        help="Park closing time used to select the break plan.",
    )
    parser.add_argument(
        "--scenario",
        choices=("on-time", "delayed"),
        default="on-time",
        help="Use an on-time rotation or the documented Blake delay.",
    )
    return parser.parse_args()


def main():
    arguments = parse_arguments()
    actual_starts = None

    if arguments.scenario == "delayed":
        actual_starts = {("Blake", 1): "12:18 PM"}

    scenario = generate_rotation_scenario(
        closing_time=arguments.closing_time,
        actual_starts=actual_starts,
    )
    print_rotation_scenario(arguments.scenario.upper(), scenario)


if __name__ == "__main__":
    main()
