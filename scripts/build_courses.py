#!/usr/bin/env python3
"""Turn the Unisono study-planner extract into typed course data.

Unknown values stay null. ECTS comes from an explicit course credit, then a
fixed area credit, then an interdisciplinary module rule, and otherwise only
when every module name lists the same LP figure. Future semesters are never
inferred.
"""

from __future__ import annotations

import json
import re
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
SOURCE = ROOT / "data" / "ws26_27_courses.js"
OUTPUT = ROOT / "src" / "data" / "courses.ts"

SEMESTER_IDS = {
    "WS26/27": "WS26-27",
}

DAYS = "Monday|Tuesday|Wednesday|Thursday|Friday|Saturday|Sunday"
RECURRING = re.compile(
    rf"^(weekly|fortnightly|three weeks turn|even weeks),\s+({DAYS}),\s+(.+?)\s+from\s+(\d{{1,2}}:\d{{2}})\s+until\s+(\d{{1,2}}:\d{{2}})$"
)
SINGLE = re.compile(
    rf"^({DAYS}),\s+(\d{{1,2}}/\d{{1,2}}/\d{{2}})\s+from\s+(\d{{1,2}}:\d{{2}})\s+to\s+(\d{{1,2}}:\d{{2}})$"
)
BLOCK = re.compile(
    r"^block date,\s+(.+?)\s+from\s+(\d{1,2}:\d{2})\s+until\s+(\d{1,2}:\d{2})$"
)
LP = re.compile(r"\((\d+)\s*LP\)")
COURSE_ECTS = {
    "1MEWI3830V": 9,  # Ethnographies of AI
}
AREA_ECTS = {
    "Basics of HCI": 4.5,
    "Consolidation": 4.5,
    "Current Research": 6,
    "Practice": 9,
}
CONTEXT_9LP = {"3HCIMA013", "3HCIMA014", "3HCIMA022", "3HCIMA023"}
CONTEXT_6LP = {"3HCIMA015", "3HCIMA019", "3HCIMA020", "3HCIMA024", "3HCIMA025"}


def clock(value: str) -> str:
    hour, minute = value.split(":")
    return f"{int(hour):02d}:{minute}"


def iso_date(value: str) -> str:
    month, day, year = value.split("/")
    return f"{2000 + int(year):04d}-{int(month):02d}-{int(day):02d}"


def date_label(value: str) -> tuple[str, str, str]:
    start_raw, end_raw = [part.strip() for part in value.split("-")]
    start = iso_date(start_raw)
    end = iso_date(end_raw)
    return f"{start_raw} – {end_raw}", start, end


def parse_slot(raw: str) -> dict:
    note = None
    text = raw.strip()
    if text.endswith(" DE EN"):
        note = "DE EN"
        text = text[: -len(" DE EN")].strip()

    recurring = RECURRING.match(text)
    if recurring:
        label, start, end = date_label(recurring.group(3))
        return {
            "day": recurring.group(2),
            "startTime": clock(recurring.group(4)),
            "endTime": clock(recurring.group(5)),
            "cadence": recurring.group(1),
            "dateLabel": label,
            "startDate": start,
            "endDate": end,
            "note": note,
        }

    single = SINGLE.match(text)
    if single:
        label = single.group(2)
        iso = iso_date(label)
        return {
            "day": single.group(1),
            "startTime": clock(single.group(3)),
            "endTime": clock(single.group(4)),
            "cadence": "single",
            "dateLabel": label,
            "startDate": iso,
            "endDate": iso,
            "note": note,
        }

    block = BLOCK.match(text)
    if block:
        label, start, end = date_label(block.group(1))
        return {
            "day": None,
            "startTime": clock(block.group(2)),
            "endTime": clock(block.group(3)),
            "cadence": "block",
            "dateLabel": label,
            "startDate": start,
            "endDate": end,
            "note": note,
        }

    raise ValueError(f"Unparsed schedule: {raw}")


def context_ects(modules: list[dict]) -> tuple[int | None, int | None]:
    codes = {module["code"] for module in modules}
    has_9 = bool(codes & CONTEXT_9LP)
    has_6 = bool(codes & CONTEXT_6LP)
    if has_9 and has_6:
        return 6, 9
    if has_9:
        return 9, None
    if has_6:
        return 6, None
    return None, None


def credits_for(code: str, area: str, modules: list[dict]) -> tuple[float | None, int | None]:
    if code in COURSE_ECTS:
        return COURSE_ECTS[code], None
    if area in AREA_ECTS:
        return AREA_ECTS[area], None
    low, high = context_ects(modules)
    if low is not None:
        return low, high
    return ects_for(modules), None


def ects_for(modules: list[dict]) -> int | None:
    if not modules:
        return None
    values: list[int] = []
    for module in modules:
        match = LP.search(module["name"])
        if not match:
            return None
        values.append(int(match.group(1)))
    unique = set(values)
    if len(unique) == 1:
        return unique.pop()
    return None


def only(values: list, field: str, code: str):
    if not values:
        return None
    if len(values) > 1:
        raise ValueError(f"{code} has multiple {field}: {values}")
    return values[0]


def convert(raw: dict) -> dict:
    semester_id = SEMESTER_IDS.get(raw["semester"])
    if not semester_id:
        raise ValueError(f"Unsupported semester {raw['semester']}")
    areas = raw.get("area") or []
    if len(areas) != 1:
        raise ValueError(f"{raw['code']} expected one area, got {areas}")

    schedule_raw = raw.get("schedule") or []
    slot_locations = raw.get("slotLocations")
    if slot_locations is not None and len(slot_locations) != len(schedule_raw):
        raise ValueError(f"{raw['code']} slotLocations do not match its schedule")
    schedule = []
    for index, item in enumerate(schedule_raw):
        slot = parse_slot(item)
        if slot_locations and slot_locations[index]:
            slot["location"] = slot_locations[index]
        schedule.append(slot)

    ects, ects_max = credits_for(raw["code"], areas[0], raw.get("modules") or [])
    course = {
        "id": f"{raw['code'].lower()}-{raw['instance']}-{semester_id.lower()}"
        if raw.get("instance")
        else f"{raw['code'].lower()}-{semester_id.lower()}",
        "code": raw["code"],
        "semesterId": semester_id,
        "area": areas[0],
        "modules": [{"code": module["code"], "name": module["name"]} for module in raw.get("modules") or []],
        "name": raw["course"],
        "requirementStatus": only(raw.get("requirementStatus") or [], "requirement statuses", raw["code"]),
        "recommendedSemesters": sorted(set(raw.get("recommendedSemesters") or [])),
        "offeringFrequency": only(raw.get("offeringFrequency") or [], "offering frequencies", raw["code"]),
        "ects": ects,
        "schedule": schedule,
        "location": raw.get("location") or None,
        "lecturers": list(raw.get("lecturers") or []),
    }
    if ects_max is not None:
        course["ectsMax"] = ects_max
    if raw.get("lectureGroupFrequency"):
        course["lectureGroupFrequency"] = raw["lectureGroupFrequency"]
    if raw.get("irregularOffering") is True:
        course["irregularOffering"] = True
    if raw.get("datedGrid") is True:
        course["datedGrid"] = True
    if raw.get("variant"):
        course["variant"] = raw["variant"]
    return course


def main() -> None:
    source = SOURCE.read_text(encoding="utf-8")
    match = re.search(r"export const courses = (\[.*\]);?\s*$", source, re.S)
    if not match:
        raise SystemExit("Could not find courses array")
    raw_courses = json.loads(match.group(1))
    courses = [convert(item) for item in raw_courses]
    ids = [course["id"] for course in courses]
    if len(ids) != len(set(ids)):
        raise SystemExit("Duplicate course ids")
    payload = json.dumps(courses, indent=2, ensure_ascii=False)
    OUTPUT.write_text(
        "\n".join(
            [
                "// Generated by scripts/build_courses.py from data/ws26_27_courses.js.",
                "// Do not edit by hand. Missing official values stay null.",
                'import type { Course } from "../types";',
                "",
                f"export const courses: Course[] = {payload} satisfies Course[];",
                "",
            ]
        ),
        encoding="utf-8",
    )
    irregular = sum(1 for course in courses if course.get("irregularOffering"))
    with_ects = sum(1 for course in courses if course["ects"] is not None)
    print(f"Wrote {len(courses)} courses ({irregular} irregular, {with_ects} with ECTS) to {OUTPUT}")


if __name__ == "__main__":
    main()
