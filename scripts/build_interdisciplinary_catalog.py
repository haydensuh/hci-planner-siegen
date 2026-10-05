#!/usr/bin/env python3
"""Build the Interdisciplinary Contexts catalog from the registration workbook.

The workbook repeats the same lectures under Ia–IVa and Ib–Vb. This script
keeps one 9 LP tree (from Ia, plus New Media Management and Media Law) and one
deduped 6 LP list (from Ib). Lectures match existing course ids. A lecture with
no timetable row stays as a title.
"""

from __future__ import annotations

import json
import re
import zipfile
import xml.etree.ElementTree as ET
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
COURSES = ROOT / "src" / "data" / "courses.ts"
OUTPUT = ROOT / "src" / "data" / "interdisciplinaryCatalog.ts"
WORKBOOK = Path(
    "/Users/hyunjung/Downloads/HCI_수강신청_졸업요건_Planner_업데이트.xlsx"
)

NS = {"m": "http://schemas.openxmlformats.org/spreadsheetml/2006/main"}


def norm(value: str) -> str:
    text = (value or "").replace("–", "-").replace("—", "-").replace("’", "'")
    return re.sub(r"[^a-z0-9]+", " ", text.lower()).strip()


def slot_of(name: str) -> str:
    for slot in ("IIIa", "IIIb", "IVa", "IVb", "IIa", "IIb", "Ia", "Ib", "Vb"):
        if re.search(rf"\b{slot}\b", name):
            return slot
    return name


def load_courses() -> list[dict]:
    raw = COURSES.read_text()
    payload = raw[raw.find("= [") + 2 : raw.rfind("] satisfies") + 1]
    courses = json.loads(payload)
    return [course for course in courses if course["area"] == "Interdisciplinary Contexts"]


def load_rows() -> list[dict]:
    with zipfile.ZipFile(WORKBOOK) as workbook:
        strings = [
            "".join(
                (node.text or "")
                for node in shared.iter(
                    "{http://schemas.openxmlformats.org/spreadsheetml/2006/main}t"
                )
            )
            for shared in ET.fromstring(workbook.read("xl/sharedStrings.xml")).findall(
                "m:si", NS
            )
        ]
        sheet = ET.fromstring(workbook.read("xl/worksheets/sheet1.xml"))

    module = teil = group = ""
    rows: list[dict] = []
    for row in sheet.findall("m:sheetData/m:row", NS):
        number = int(row.get("r"))
        if number == 1 or number > 697:
            continue
        cells: dict[str, str] = {}
        for cell in row.findall("m:c", NS):
            column = re.match(r"[A-Z]+", cell.get("r")).group(0)
            kind = cell.get("t")
            value = cell.find("m:v", NS)
            text = "" if value is None else (strings[int(value.text)] if kind == "s" else (value.text or ""))
            cells[column] = re.sub(r"\s+", " ", text.replace("\n", " ")).strip()
        if cells.get("C"):
            module = cells["C"]
            if not cells.get("D"):
                teil = ""
            if not cells.get("E"):
                group = ""
        if cells.get("D"):
            teil = cells["D"]
            if not cells.get("E"):
                group = ""
        if cells.get("E"):
            group = cells["E"]
        if group.startswith("The instructional"):
            continue
        lecture = cells.get("F", "")
        if not lecture and not cells.get("D") and not cells.get("E"):
            continue
        rows.append(
            {
                "slot": slot_of(module),
                "teil": teil,
                "group": group.replace("(Lecture & Exercise))", "(Lecture & Exercise)"),
                "lecture": lecture,
            }
        )
    return rows


def candidates(courses: list[dict], lecture: str) -> list[dict]:
    needle = norm(lecture)
    scored: list[tuple[int, str, str, dict]] = []
    for course in courses:
        name = norm(course["name"])
        variant = norm(course.get("variant") or "")
        if "seminar informatik" in needle:
            if variant and variant in needle:
                scored.append((len(variant), course["code"], course["id"], course))
            continue
        if name == needle:
            scored.append((1000 + len(name), course["code"], course["id"], course))
        elif len(needle) >= 18 and name.startswith(needle):
            scored.append((len(needle), course["code"], course["id"], course))
    scored.sort(key=lambda item: (-item[0], item[1], item[2]))
    seen: set[str] = set()
    ordered: list[dict] = []
    for *_, course in scored:
        if course["id"] in seen:
            continue
        seen.add(course["id"])
        ordered.append(course)
    return ordered


def title_for(lecture: str) -> str:
    match = re.match(r"Seminar Informatik \(Computer Science\) Seminar (.+)$", lecture)
    if match:
        return f"Seminar Informatik ({match.group(1).strip()})"
    return lecture


def walk(courses: list[dict], rows: list[dict], slot: str, shared_name: str = "") -> tuple[list[dict], list[str]]:
    used: list[str] = []
    sections: list[dict] = []
    section = None
    group = None
    for row in rows:
        if row["slot"] != slot:
            continue
        if section is None or section["name"] != row["teil"]:
            section = {"name": row["teil"], "groups": []}
            sections.append(section)
            group = None
        group_name = "" if row["group"].startswith("Interdisciplinary Contexts in HCI") else row["group"]
        if group is None or group["name"] != group_name:
            group = {"name": group_name, "entries": []}
            section["groups"].append(group)
        if not row["lecture"]:
            continue
        found = candidates(courses, row["lecture"])
        fresh = [course for course in found if course["id"] not in used]
        if not found:
            label = title_for(row["lecture"])
            if not any(entry.get("title") == label for entry in group["entries"]):
                group["entries"].append({"title": label})
            continue
        if not fresh:
            continue
        used.append(fresh[0]["id"])
        group["entries"].append({"courseId": fresh[0]["id"]})
    if shared_name and sections and sections[0]["name"] == "":
        sections[0]["name"] = shared_name
    return sections, used


def emit(lp9: list[dict], lp6: list[dict]) -> None:
    body = json.dumps({"lp9": lp9, "lp6": lp6}, ensure_ascii=False, indent=2)
    OUTPUT.write_text(
        """// Generated by scripts/build_interdisciplinary_catalog.py.
// 9 LP follows Ia, then New Media Management and Media Law.
// 6 LP is the deduped Ib list. Vb omits the courses flagged notInVb.

export type CatalogEntry = { courseId: string } | { title: string };

export type CatalogGroup = {
  name: string;
  entries: CatalogEntry[];
};

export type CatalogSection = {
  name: string;
  groups: CatalogGroup[];
};

export type Lp6Course = {
  courseId: string;
  notInVb?: true;
};

export const TRACK_RULE =
  "Choose two 9 LP modules or three 6 LP modules.";

export const LP9_NOTE = "Semester 1: Ia or IIa. Courses for semester 3 are not shown.";

export const LP6_NOTE = "Semester 1: Ib or IIb. Courses for semester 3 are not shown.";

"""
        + f"const catalog = {body} as const;\n\n"
        + """export const lp9Sections: CatalogSection[] = catalog.lp9.map((section) => ({
  name: section.name,
  groups: section.groups.map((group) => ({
    name: group.name,
    entries: group.entries.map((entry) =>
      "courseId" in entry ? { courseId: entry.courseId } : { title: entry.title },
    ),
  })),
}));

export const lp6Courses: Lp6Course[] = catalog.lp6.map((course) =>
  "notInVb" in course ? { courseId: course.courseId, notInVb: true } : { courseId: course.courseId },
);

export function lp9Placement(courseId: string): { section: string; group: string } | null {
  for (const section of lp9Sections) {
    for (const group of section.groups) {
      if (group.entries.some((entry) => "courseId" in entry && entry.courseId === courseId)) {
        return { section: section.name, group: group.name };
      }
    }
  }
  return null;
}

export function lp6Course(courseId: string): Lp6Course | null {
  return lp6Courses.find((course) => course.courseId === courseId) ?? null;
}
"""
    )


def main() -> None:
    courses = load_courses()
    rows = load_rows()
    lp9, _ = walk(courses, rows, "Ia", "Offered in Ia–IVa")
    media, _ = walk(courses, rows, "New Media Management (9 credit)", "New Media Management")
    law, _ = walk(courses, rows, "Media Law (9 credit)", "Media Law")
    lp9.extend(media + law)
    six, _ = walk(courses, rows, "Ib")
    vb, _ = walk(courses, rows, "Vb")
    vb_ids = {
        entry["courseId"]
        for section in vb
        for group in section["groups"]
        for entry in group["entries"]
        if "courseId" in entry
    }
    lp6 = []
    seen: set[str] = set()
    for section in six:
        for group in section["groups"]:
            for entry in group["entries"]:
                course_id = entry.get("courseId")
                if not course_id or course_id in seen:
                    continue
                seen.add(course_id)
                item = {"courseId": course_id}
                if course_id not in vb_ids:
                    item["notInVb"] = True
                lp6.append(item)
    emit(lp9, lp6)
    print(f"Wrote {OUTPUT} ({len(lp9)} 9 LP sections, {len(lp6)} 6 LP courses)")


if __name__ == "__main__":
    main()
