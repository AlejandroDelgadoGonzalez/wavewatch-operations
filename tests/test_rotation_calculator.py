import unittest

from rotation_calculator import (
    calculate_break_timing,
    calculate_delay,
    format_time,
    generate_rotation_scenario,
)


class BreakCalculationTests(unittest.TestCase):
    def test_calculates_break_end_and_next_start(self):
        break_end, next_break_start = calculate_break_timing(
            break_start_text="11:10 AM",
            break_duration_minutes=45,
        )

        self.assertEqual(format_time(break_end), "11:55 AM")
        self.assertEqual(format_time(next_break_start), "12:10 PM")

    def test_detects_eight_minute_delay(self):
        delay = calculate_delay(
            expected_start_text="12:10 PM",
            actual_start_text="12:18 PM",
        )

        self.assertEqual(delay, 8)

    def test_early_start_does_not_create_negative_delay(self):
        delay = calculate_delay(
            expected_start_text="12:10 PM",
            actual_start_text="12:05 PM",
        )

        self.assertEqual(delay, 0)


class RotationScenarioTests(unittest.TestCase):
    def test_rot_001_on_time_six_pm_closing(self):
        scenario = generate_rotation_scenario("6:00 PM")

        self.assertEqual(
            scenario["post_break_schedule"]["last_break_end"],
            "4:40 PM",
        )
        self.assertEqual(
            scenario["post_break_schedule"]["final_break_bump"],
            "4:55 PM",
        )
        self.assertEqual(
            scenario["post_break_schedule"]["post_break_bumps"],
            ["5:25 PM"],
        )
        self.assertEqual(
            scenario["final_assignments"],
            {
                "Stand 1": "Dakota",
                "Stand 2": "Cameron",
                "Stand 3": "Blake",
                "Extra": "Avery",
            },
        )

    def test_rot_002_delay_removes_post_break_bump(self):
        scenario = generate_rotation_scenario(
            "6:00 PM",
            actual_starts={("Blake", 1): "12:18 PM"},
        )

        self.assertEqual(scenario["total_detected_delay_minutes"], 8)
        self.assertEqual(
            scenario["post_break_schedule"]["last_break_end"],
            "4:48 PM",
        )
        self.assertEqual(
            scenario["post_break_schedule"]["final_break_bump"],
            "5:03 PM",
        )
        self.assertEqual(
            scenario["post_break_schedule"]["post_break_bumps"],
            [],
        )
        self.assertEqual(
            scenario["final_assignments"],
            {
                "Stand 1": "Cameron",
                "Stand 2": "Blake",
                "Stand 3": "Avery",
                "Extra": "Dakota",
            },
        )

    def test_supported_closing_times_match_documented_schedules(self):
        expected_schedules = {
            "5:00 PM": ("4:10 PM", "4:25 PM", []),
            "6:00 PM": ("4:40 PM", "4:55 PM", ["5:25 PM"]),
            "7:00 PM": (
                "5:25 PM",
                "5:40 PM",
                ["6:05 PM", "6:30 PM"],
            ),
            "8:00 PM": (
                "5:55 PM",
                "6:10 PM",
                ["6:35 PM", "7:00 PM", "7:25 PM"],
            ),
        }

        for closing_time, expected in expected_schedules.items():
            with self.subTest(closing_time=closing_time):
                scenario = generate_rotation_scenario(closing_time)
                post_break = scenario["post_break_schedule"]
                actual = (
                    post_break["last_break_end"],
                    post_break["final_break_bump"],
                    post_break["post_break_bumps"],
                )
                self.assertEqual(actual, expected)


if __name__ == "__main__":
    unittest.main()
