import type { Course, CourseModule, ScheduleSlot } from "../types";

export function formatCourseTitle(course: Course): string {
  return course.variant ? `${course.name} (${course.variant})` : course.name;
}

export function textOrTba(value: string | null | undefined): string {
  if (!value || !value.trim()) return "TBA";
  return value;
}

function ordinal(value: number): string {
  const mod100 = value % 100;
  if (mod100 >= 11 && mod100 <= 13) return `${value}th`;
  switch (value % 10) {
    case 1:
      return `${value}st`;
    case 2:
      return `${value}nd`;
    case 3:
      return `${value}rd`;
    default:
      return `${value}th`;
  }
}

export function formatRecommended(semesters: number[]): string {
  if (semesters.length === 0) return "TBA";
  const labels = [...semesters].sort((a, b) => a - b).map(ordinal);
  return `${labels.join(", ")} semester`;
}

export function formatModulePreview(modules: CourseModule[]): string {
  if (modules.length === 0) return "TBA";
  if (modules.length === 1) return modules[0].name;
  if (modules.length === 2) return `${modules[0].name} · ${modules[1].name}`;
  return `${modules[0].name} · +${modules.length - 1} more`;
}

export function formatLecturers(course: Course): string {
  return course.lecturers.length > 0 ? course.lecturers.join(", ") : "TBA";
}

export function formatLocation(course: Course): string {
  if (course.location) return course.location;
  const ordered: string[] = [];
  for (const slot of course.schedule) {
    if (!slot.location || ordered.includes(slot.location)) continue;
    if (slot.cadence === "weekly") ordered.unshift(slot.location);
    else ordered.push(slot.location);
  }
  if (ordered.length > 0) return ordered.join(" / ");
  return "TBA";
}

export function formatSessionLocation(course: Course, slot: ScheduleSlot): string | null {
  if (!course.schedule.some((item) => item.location)) return null;
  return slot.location ?? "TBA";
}

export function formatBlockLocation(course: Course, slotLocation: string | null): string {
  if (slotLocation) return slotLocation;
  if (course.schedule.some((slot) => slot.location)) return "TBA";
  return textOrTba(course.location);
}

function timeRange(slot: ScheduleSlot): string {
  return `${slot.startTime}–${slot.endTime}`;
}

export function formatSlotCompact(slot: ScheduleSlot): string {
  const time = timeRange(slot);
  if (slot.cadence === "block") return `Block · ${time}`;
  if (!slot.day) return time;
  if (slot.cadence === "weekly" || slot.cadence === "single") return `${slot.day} · ${time}`;
  return `${slot.day} · ${time} · ${slot.cadence}`;
}

export function formatSlotDetail(slot: ScheduleSlot): string {
  const compact = formatSlotCompact(slot);
  return slot.note ? `${compact} · ${slot.note}` : compact;
}

export function formatDatedSession(slot: ScheduleSlot): string {
  const time = timeRange(slot);
  if (slot.cadence === "block") {
    return slot.dateLabel ? `Block · ${slot.dateLabel} · ${time}` : `Block · ${time}`;
  }
  const when = [slot.day, slot.dateLabel].filter(Boolean).join(" · ");
  return when ? `${when} · ${time}` : time;
}

export function formatCourseTimes(course: Course): string {
  if (course.schedule.length === 0) return "Time TBA";
  if (course.schedule.length === 1) return formatSlotCompact(course.schedule[0]);
  return `${formatSlotCompact(course.schedule[0])} · +${course.schedule.length - 1} more`;
}

export function formatEcts(course: Course): string | null {
  if (course.ects == null) return null;
  if (course.ectsMax != null && course.ectsMax !== course.ects) return `${course.ects} or ${course.ectsMax}`;
  return String(course.ects);
}

export function ectsSummary(selected: Course[]): string {
  if (selected.length === 0) return "0 ECTS";
  const known = selected.filter((course) => course.ects != null);
  if (known.length === 0) return "ECTS TBA";
  const min = known.reduce((total, course) => total + (course.ects ?? 0), 0);
  const max = known.reduce((total, course) => total + (course.ectsMax ?? course.ects ?? 0), 0);
  const label = min === max ? `${min} ECTS` : `${min}–${max} ECTS`;
  if (known.length === selected.length) return label;
  return `${label} from ${known.length} of ${selected.length}`;
}
