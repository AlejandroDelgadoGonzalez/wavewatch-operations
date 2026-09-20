"""Load and validate the fictional Blue Current park dataset."""

from __future__ import annotations

import json
import re
from collections import Counter
from pathlib import Path
from typing import Any


DEFAULT_DATA_PATH = Path(__file__).parent / "data" / "blue_current_staffing.json"


class ParkDataError(ValueError):
    """Raised when the fictional park dataset is internally inconsistent."""


def load_park_data(data_path: str | Path = DEFAULT_DATA_PATH) -> dict[str, Any]:
    """Load the synthetic park dataset and verify its core staffing rules."""

    path = Path(data_path)
    with path.open(encoding="utf-8") as data_file:
        park_data: dict[str, Any] = json.load(data_file)

    validate_park_data(park_data)
    return park_data


def validate_park_data(park_data: dict[str, Any]) -> None:
    """Validate identifiers, staffing totals, and rotation coverage."""

    employees = park_data.get("employees", [])
    rotations = park_data.get("rotations", [])
    attractions = park_data.get("attractions", [])
    expected = park_data.get("staffingSummary", {})

    if len(rotations) != 17 or len(employees) != 74:
        raise ParkDataError("The prototype requires 17 rotations and 74 employees.")
    stand_ids = []
    extensions = []
    for rotation in rotations:
        stands = rotation.get("stands", [])
        if len(stands) != 3:
            raise ParkDataError("Every rotation must have exactly three stands.")
        for index, stand in enumerate(stands, 1):
            if not isinstance(stand, dict) or stand.get("id") != f"{rotation['id']}-S{index}" or not stand.get("name"):
                raise ParkDataError("Stands require stable ordered IDs and display names.")
            extension = stand.get("extension")
            if not isinstance(extension, str) or not re.fullmatch(r"[0-9]{4}", extension):
                raise ParkDataError("Stand extensions must contain exactly four numeric digits.")
            stand_ids.append(stand["id"])
            extensions.append(extension)
    if len(set(stand_ids)) != 51 or len(set(extensions)) != 51:
        raise ParkDataError("The 51 stand IDs and extensions must be unique.")

    if len(employees) != expected.get("totalEmployees"):
        raise ParkDataError("The employee total does not match staffingSummary.")
    if len(rotations) != expected.get("rotations"):
        raise ParkDataError("The rotation total does not match staffingSummary.")
    if len(attractions) != 12:
        raise ParkDataError("The prototype must contain 12 attractions.")

    employee_ids = [employee["employeeId"] for employee in employees]
    employee_names = [employee["employeeName"] for employee in employees]
    if len(employee_ids) != len(set(employee_ids)):
        raise ParkDataError("Employee IDs must be unique.")
    if len(employee_names) != len(set(employee_names)):
        raise ParkDataError("Synthetic employee names must be unique.")

    rotation_ids = {rotation["id"] for rotation in rotations}
    assigned_employees = [
        employee for employee in employees if employee["rotationId"] != "N/A"
    ]
    coordinators = [
        employee for employee in employees if employee["rotationId"] == "N/A"
    ]
    if len(assigned_employees) != 68 or len(coordinators) != 6:
        raise ParkDataError("The prototype requires 68 rotation employees and 6 coordinators.")

    if len(assigned_employees) != expected.get("rotationEmployees"):
        raise ParkDataError("The rotation employee total is incorrect.")
    if len(coordinators) != expected.get("coordinators"):
        raise ParkDataError("The coordinator total is incorrect.")
    if any(employee["rotationId"] not in rotation_ids for employee in assigned_employees):
        raise ParkDataError("An employee references an unknown rotation.")
    if any(employee["dataClassification"] != "Synthetic" for employee in employees):
        raise ParkDataError("Every employee record must be marked Synthetic.")

    employees_by_rotation = Counter(
        employee["rotationId"] for employee in assigned_employees
    )
    incorrectly_staffed = {
        rotation_id: employees_by_rotation[rotation_id]
        for rotation_id in rotation_ids
        if employees_by_rotation[rotation_id] != 4
    }
    if incorrectly_staffed:
        raise ParkDataError(
            f"Every rotation must have four employees: {incorrectly_staffed}"
        )


def get_rotation(park_data: dict[str, Any], rotation_id: str) -> dict[str, Any]:
    """Return one rotation by its stable ID."""

    for rotation in park_data["rotations"]:
        if rotation["id"] == rotation_id:
            return rotation
    raise KeyError(f"Unknown rotation ID: {rotation_id}")


def get_employees_for_rotation(
    park_data: dict[str, Any], rotation_id: str
) -> list[dict[str, Any]]:
    """Return the four employees assigned to a rotation in arrival order."""

    get_rotation(park_data, rotation_id)
    return [
        employee
        for employee in park_data["employees"]
        if employee["rotationId"] == rotation_id
    ]
