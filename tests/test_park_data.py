import unittest
import copy
import json

from park_data import (
    ParkDataError,
    get_employees_for_rotation,
    get_rotation,
    load_park_data,
    validate_park_data,
)


class ParkDataTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.park_data = load_park_data()

    def test_expected_dataset_totals(self):
        self.assertEqual(74, len(self.park_data["employees"]))
        self.assertEqual(17, len(self.park_data["rotations"]))
        self.assertEqual(12, len(self.park_data["attractions"]))

    def test_every_rotation_has_four_employees(self):
        for rotation in self.park_data["rotations"]:
            employees = get_employees_for_rotation(self.park_data, rotation["id"])
            self.assertEqual(4, len(employees), rotation["id"])

    def test_rotation_assignments_follow_expected_arrival_pattern(self):
        employees = get_employees_for_rotation(self.park_data, "SW-CC-01")
        self.assertEqual(
            ["8:00 AM", "9:00 AM", "9:45 AM", "11:00 AM"],
            [employee["arrivalTime"] for employee in employees],
        )
        self.assertEqual(
            ["Stand 3", "Stand 2", "Stand 1", "Breaker"],
            [employee["startingAssignment"] for employee in employees],
        )

    def test_rotation_lookup_includes_three_display_stands(self):
        rotation = get_rotation(self.park_data, "SO-BP-03")
        self.assertEqual("Abyss Drop", rotation["attraction"])
        self.assertEqual(3, len(rotation["stands"]))

    def test_validation_rejects_incorrect_employee_total(self):
        invalid_data = {
            **self.park_data,
            "employees": self.park_data["employees"][:-1],
        }
        with self.assertRaises(ParkDataError):
            validate_park_data(invalid_data)

    def test_stands_have_unique_stable_ids_and_four_digit_extensions(self):
        stands = [stand for rotation in self.park_data["rotations"] for stand in rotation["stands"]]
        self.assertEqual(51, len(stands))
        self.assertEqual(51, len({stand["extension"] for stand in stands}))
        self.assertEqual(51, len({stand["id"] for stand in stands}))
        for stand in stands:
            self.assertRegex(stand["extension"], r"^[0-9]{4}$")
        self.assertEqual("1001", get_rotation(self.park_data, "SW-CC-01")["stands"][0]["extension"])

    def test_validation_rejects_invalid_stands(self):
        for mode in ["duplicate", "format", "missing", "id", "type"]:
            data = copy.deepcopy(self.park_data)
            stands = data["rotations"][0]["stands"]
            if mode == "duplicate":
                stands[1]["extension"] = stands[0]["extension"]
            elif mode == "format":
                stands[0]["extension"] = "ABC1"
            elif mode == "missing":
                stands.pop()
            elif mode == "id":
                stands[0]["id"] = "incorrect"
            else:
                stands[0]["extension"] = 1001
            with self.subTest(mode=mode), self.assertRaises(ParkDataError):
                validate_park_data(data)

    def test_tidal_labels_keep_ids_and_operational_breaker_role(self):
        self.assertNotRegex(json.dumps(self.park_data), r"Breaker (Bay|East|West|Deep)")
        self.assertEqual("Tidal East", get_rotation(self.park_data, "SW-BB-01")["name"])
        tidal = [r for r in self.park_data["rotations"] if r["zone"] == "Tidal Bay"]
        self.assertEqual(4, len(tidal))
        self.assertTrue(all(r["attractionId"] == "AT-BB-01" for r in tidal))
        self.assertEqual(17, sum(e["startingAssignment"] == "Breaker" for e in self.park_data["employees"]))


if __name__ == "__main__":
    unittest.main()
