import type { Course, CourseModule, ScheduleSlot } from "../types";

export function formatCourseTitle(course: Course): string {
  return course.variant ? `${course.name} (${course.variant})` : course.name;
}

export function textOrEmpty(value: string | null | undefined): string | null {
  if (!value || !value.trim()) return null;
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

export function formatRecommended(semesters: number[]): string | null {
  if (semesters.length === 0) return null;
  const labels = [...semesters].sort((a, b) => a - b).map(ordinal);
  return `${labels.join(", ")} semester`;
}

export function formatModulePreview(modules: CourseModule[]): string | null {
  if (modules.length === 0) return null;
  if (modules.length === 1) return modules[0].name;
  if (modules.length === 2) return `${modules[0].name} · ${modules[1].name}`;
  return `${modules[0].name} · +${modules.length - 1} more`;
}

export function formatLecturers(course: Course): string | null {
  return course.lecturers.length > 0 ? course.lecturers.join(", ") : null;
}

export function formatLocation(course: Course): string | null {
  if (course.location) return course.location;
  const ordered: string[] = [];
  for (const slot of course.schedule) {
    if (!slot.location || ordered.includes(slot.location)) continue;
    if (slot.cadence === "weekly") ordered.unshift(slot.location);
    else ordered.push(slot.location);
  }
  return ordered.length > 0 ? ordered.join(" / ") : null;
}

export function formatBlockLocation(course: Course, slotLocation: string | null): string | null {
  return slotLocation ?? course.location;
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

function hasSeasonTerm(frequency: string): boolean {
  return frequency.includes("every semester") || frequency.includes("winter") || frequency.includes("summer");
}

/** Lecture term when it names a season, otherwise the parent lecture group's term. */
function seasonText(course: Course): string {
  const own = course.offeringFrequency?.toLowerCase() ?? "";
  if (hasSeasonTerm(own)) return own;
  return course.lectureGroupFrequency?.toLowerCase() || own;
}

export function formatSeason(course: Course): string | null {
  const frequency = seasonText(course);
  if (frequency.includes("every semester")) return "Winter · Summer";
  if (frequency.includes("summer") && !frequency.includes("winter")) return "Summer";
  if (frequency.includes("winter") || course.semesterId.startsWith("WS")) return "Winter";
  if (frequency.includes("summer")) return "Summer";
  return null;
}

export function isSummerOnly(course: Course): boolean {
  const frequency = seasonText(course);
  if (frequency.includes("every")) return false;
  if (frequency.includes("summer") && !frequency.includes("winter")) return true;
  return course.semesterId.startsWith("SS");
}

export function formatCourseTimes(course: Course): string | null {
  if (course.schedule.length === 0) return null;
  if (course.schedule.length === 1) return formatSlotCompact(course.schedule[0]);
  return `${formatSlotCompact(course.schedule[0])} · +${course.schedule.length - 1} more`;
}

export function formatEcts(course: Course): string | null {
  if (course.ects == null) return null;
  if (course.ectsMax != null && course.ectsMax !== course.ects) return `${course.ects} or ${course.ectsMax}`;
  return String(course.ects);
}

function formatAmount(value: number): string {
  const rounded = Math.round(value * 10) / 10;
  return Number.isInteger(rounded) ? String(rounded) : String(rounded);
}

export function ectsSummary(selected: Course[]): string | null {
  if (selected.length === 0) return "0 ECTS";
  const groups = new Map<string, { ects: number; parts: number; count: number }>();
  let min = 0;
  let max = 0;
  let known = 0;
  for (const course of selected) {
    if (course.creditGroup) {
      const current = groups.get(course.creditGroup.id) ?? {
        ects: course.creditGroup.ects,
        parts: course.creditGroup.parts,
        count: 0,
      };
      current.count += 1;
      groups.set(course.creditGroup.id, current);
      known += 1;
      continue;
    }
    if (course.ects == null) continue;
    known += 1;
    min += course.ects;
    max += course.ectsMax ?? course.ects;
  }
  for (const group of groups.values()) {
    if (group.count === group.parts) {
      min += group.ects;
      max += group.ects;
    }
  }
  if (known === 0) return null;
  const label = min === max ? `${formatAmount(min)} ECTS` : `${formatAmount(min)}–${formatAmount(max)} ECTS`;
  if (known === selected.length) return label;
  return `${label} from ${known} of ${selected.length}`;
}

export type CreditNotice = { id: string; title: string; body: string };

export function creditNotices(selected: Course[]): CreditNotice[] {
  const notices: CreditNotice[] = [];
  const groups = new Map<string, { label: string; ects: number; parts: number; count: number }>();
  const exams = new Map<string, { label: string; ects: number }>();
  for (const course of selected) {
    if (course.creditGroup) {
      const current = groups.get(course.creditGroup.id) ?? {
        label: course.creditGroup.label,
        ects: course.creditGroup.ects,
        parts: course.creditGroup.parts,
        count: 0,
      };
      current.count += 1;
      groups.set(course.creditGroup.id, current);
    }
    if (course.examCredit && !exams.has(course.examCredit.groupId)) {
      exams.set(course.examCredit.groupId, { label: course.examCredit.label, ects: course.examCredit.ects });
    }
  }
  for (const [id, group] of groups) {
    if (group.count >= group.parts) continue;
    notices.push({
      id: `group-${id}`,
      title: group.label,
      body: `${group.ects} ECTS once all ${group.parts} courses are selected. ${group.count} of ${group.parts} selected.`,
    });
  }
  for (const [id, exam] of exams) {
    notices.push({
      id: `exam-${id}`,
      title: exam.label,
      body: `Credits are recognized only when you also take the exam (${exam.ects} ECTS). You choose which seminar the exam belongs to.`,
    });
  }
  return notices;
}
