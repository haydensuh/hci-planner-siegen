export type Weekday =
  | "Monday"
  | "Tuesday"
  | "Wednesday"
  | "Thursday"
  | "Friday"
  | "Saturday"
  | "Sunday";

export type ScheduleCadence =
  | "weekly"
  | "fortnightly"
  | "three weeks turn"
  | "even weeks"
  | "single"
  | "block";

export type ScheduleSlot = {
  day: Weekday | null;
  startTime: string;
  endTime: string;
  cadence: ScheduleCadence;
  dateLabel: string | null;
  startDate: string | null;
  endDate: string | null;
  note: string | null;
  location?: string;
};

export type CourseModule = {
  code: string;
  name: string;
};

export type Course = {
  id: string;
  code: string;
  semesterId: string;
  area: string;
  modules: CourseModule[];
  name: string;
  requirementStatus: string | null;
  recommendedSemesters: number[];
  offeringFrequency: string | null;
  /** Planner lecture-group term, used when the lecture itself has no winter/summer term. */
  lectureGroupFrequency?: string;
  irregularOffering?: true;
  datedGrid?: true;
  ects: number | null;
  ectsMax?: number;
  /** Module total earned once every part in the group is selected. */
  creditGroup?: { id: string; label: string; ects: number; parts: number };
  /** Exam credits that are not included in the course total. */
  examCredit?: { groupId: string; label: string; ects: number };
  /** Module total when this timetable does not include every required course. */
  moduleCreditNote?: string;
  schedule: ScheduleSlot[];
  location: string | null;
  lecturers: string[];
  variant?: string;
};

export type Semester = {
  id: string;
  label: string;
  shortLabel: string;
  state: "completed" | "current" | "future";
};

export type Version = {
  id: string;
  semesterId: string;
  name: string;
  selectedCourseIds: string[];
  lpTrackByCourseId?: Record<string, "9" | "6">;
};

export type PlannerState = {
  semesterId: string;
  versions: Version[];
  activeBySemester: Record<string, string>;
};
