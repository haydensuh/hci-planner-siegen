import type { Semester } from "../types";

export const SEMESTERS: Semester[] = [
  {
    id: "WS26-27",
    label: "Winter Semester 2026/27",
    shortLabel: "Winter 2026/27",
    state: "current",
  },
  {
    id: "SS27",
    label: "Summer Semester 2027",
    shortLabel: "Summer 2027",
    state: "future",
  },
];

export function semesterById(id: string): Semester | undefined {
  return SEMESTERS.find((semester) => semester.id === id);
}
