import type { Course, ScheduleSlot, Weekday } from "../types";
import { formatCourseTitle } from "./format";

export const GRID_DAYS = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday"] as const;

export type GridDay = (typeof GRID_DAYS)[number];

const WEEKDAYS: Weekday[] = [
  "Sunday",
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
];

export const HOUR_PX = 64;

export type CourseInterval = {
  day: Weekday;
  startTime: string;
  endTime: string;
  start: number;
  end: number;
  meta: string | null;
  when: string;
  onGrid: boolean;
  location: string | null;
};

export type Conflict = {
  id: string;
  aName: string;
  bName: string;
  aWhen: string;
  bWhen: string;
};

export type GridBlock = {
  course: Course;
  day: GridDay;
  start: number;
  end: number;
  startTime: string;
  endTime: string;
  meta: string | null;
  location: string | null;
  conflict: boolean;
  dated: boolean;
  lane: number;
  laneCount: number;
};

export function minutes(time: string): number {
  const [hour, minute] = time.split(":").map(Number);
  return hour * 60 + minute;
}

export function formatHour(hour: number): string {
  return `${String(hour).padStart(2, "0")}:00`;
}

function parseIsoDate(iso: string): Date {
  const [year, month, day] = iso.split("-").map(Number);
  return new Date(year, month - 1, day);
}

function eachDate(startIso: string, endIso: string): Date[] {
  const dates: Date[] = [];
  const cursor = parseIsoDate(startIso);
  const end = parseIsoDate(endIso);
  while (cursor <= end && dates.length < 21) {
    dates.push(new Date(cursor));
    cursor.setDate(cursor.getDate() + 1);
  }
  return dates;
}

function isGridDay(day: Weekday): day is GridDay {
  return (GRID_DAYS as readonly string[]).includes(day);
}

function slotMeta(slot: ScheduleSlot): string | null {
  const parts: string[] = [];
  if (slot.cadence === "block") parts.push("block");
  else if (slot.cadence !== "weekly") parts.push(slot.cadence);
  if (slot.note) parts.push(slot.note);
  return parts.length > 0 ? parts.join(", ") : null;
}

function whenLabel(day: Weekday, startTime: string, endTime: string, meta: string | null): string {
  const time = `${day} ${startTime}–${endTime}`;
  return meta ? `${time} (${meta})` : time;
}

export function intervalsFor(course: Course): CourseInterval[] {
  const merged = new Map<string, CourseInterval>();

  function add(day: Weekday, slot: ScheduleSlot) {
    const onGrid = isGridDay(day);
    const location = slot.location ?? null;
    const key = `${day}|${slot.startTime}|${slot.endTime}|${onGrid}|${location ?? ""}`;
    const meta = slotMeta(slot);
    const existing = merged.get(key);
    if (existing) {
      if (meta && existing.meta && !existing.meta.split("; ").includes(meta)) {
        existing.meta = `${existing.meta}; ${meta}`;
      } else if (meta && !existing.meta) {
        existing.meta = meta;
      }
      existing.when = whenLabel(day, slot.startTime, slot.endTime, existing.meta);
      return;
    }
    merged.set(key, {
      day,
      startTime: slot.startTime,
      endTime: slot.endTime,
      start: minutes(slot.startTime),
      end: minutes(slot.endTime),
      meta,
      when: whenLabel(day, slot.startTime, slot.endTime, meta),
      onGrid,
      location,
    });
  }

  for (const slot of course.schedule) {
    if (slot.day) {
      add(slot.day, slot);
      continue;
    }
    if (!slot.startDate || !slot.endDate) continue;
    for (const date of eachDate(slot.startDate, slot.endDate)) {
      add(WEEKDAYS[date.getDay()], slot);
    }
  }

  return [...merged.values()];
}

function rangesOverlap(left: { start: number; end: number }, right: { start: number; end: number }): boolean {
  return left.start < right.end && right.start < left.end;
}

export function findConflicts(selected: Course[]): Conflict[] {
  const cache = new Map(selected.map((course) => [course.id, intervalsFor(course)]));
  const conflicts: Conflict[] = [];
  const seen = new Set<string>();

  for (let i = 0; i < selected.length; i += 1) {
    for (let j = i + 1; j < selected.length; j += 1) {
      const a = selected[i];
      const b = selected[j];
      for (const left of cache.get(a.id) ?? []) {
        for (const right of cache.get(b.id) ?? []) {
          if (left.day !== right.day || !rangesOverlap(left, right)) continue;
          const key = `${a.id}|${b.id}|${left.when}|${right.when}`;
          if (seen.has(key)) continue;
          seen.add(key);
          conflicts.push({
            id: key,
            aName: formatCourseTitle(a),
            bName: formatCourseTitle(b),
            aWhen: left.when,
            bWhen: right.when,
          });
        }
      }
    }
  }

  return conflicts;
}

function assignLanes<T extends { start: number; end: number }>(
  drafts: T[],
): Array<T & { lane: number; laneCount: number }> {
  const items = [...drafts].sort((a, b) => a.start - b.start || b.end - a.end);
  const placed: Array<T & { lane: number }> = [];
  const laneEnds: number[] = [];

  for (const item of items) {
    let lane = laneEnds.findIndex((end) => end <= item.start);
    if (lane === -1) {
      lane = laneEnds.length;
      laneEnds.push(item.end);
    } else {
      laneEnds[lane] = item.end;
    }
    placed.push({ ...item, lane });
  }

  const parent = placed.map((_, index) => index);
  function find(index: number): number {
    let cursor = index;
    while (parent[cursor] !== cursor) {
      parent[cursor] = parent[parent[cursor]];
      cursor = parent[cursor];
    }
    return cursor;
  }
  function unite(left: number, right: number) {
    const a = find(left);
    const b = find(right);
    if (a !== b) parent[b] = a;
  }

  for (let i = 0; i < placed.length; i += 1) {
    for (let j = i + 1; j < placed.length; j += 1) {
      if (rangesOverlap(placed[i], placed[j])) unite(i, j);
    }
  }

  const clusterLanes = new Map<number, number>();
  for (let i = 0; i < placed.length; i += 1) {
    const root = find(i);
    clusterLanes.set(root, Math.max(clusterLanes.get(root) ?? 1, placed[i].lane + 1));
  }

  return placed.map((item, index) => ({
    ...item,
    laneCount: clusterLanes.get(find(index)) ?? 1,
  }));
}

export function layoutGrid(selected: Course[]): Map<GridDay, GridBlock[]> {
  const entries = selected.map((course) => ({
    course,
    intervals: intervalsFor(course).filter((interval) => interval.onGrid),
  }));
  const result = new Map<GridDay, GridBlock[]>();

  for (const day of GRID_DAYS) {
    const drafts: Array<Omit<GridBlock, "lane" | "laneCount">> = [];
    for (const entry of entries) {
      for (const interval of entry.intervals) {
        if (interval.day !== day) continue;
        const conflict = entries.some((other) => {
          if (other.course.id === entry.course.id) return false;
          return other.intervals.some(
            (candidate) => candidate.day === day && rangesOverlap(candidate, interval),
          );
        });
        drafts.push({
          course: entry.course,
          day,
          start: interval.start,
          end: interval.end,
          startTime: interval.startTime,
          endTime: interval.endTime,
          meta: interval.meta,
          location: interval.location,
          conflict,
          dated: entry.course.datedGrid === true,
        });
      }
    }
    result.set(day, assignLanes(drafts));
  }

  return result;
}

export function outsideLines(course: Course): string[] {
  return intervalsFor(course)
    .filter((interval) => !interval.onGrid)
    .map((interval) => {
      const place = interval.location ?? course.location;
      return place ? `${formatCourseTitle(course)} · ${interval.when} · ${place}` : `${formatCourseTitle(course)} · ${interval.when}`;
    });
}

export function gridBounds(courses: Course[]): { startHour: number; endHour: number } {
  let min = Number.POSITIVE_INFINITY;
  let max = 0;
  for (const course of courses) {
    for (const interval of intervalsFor(course)) {
      if (!interval.onGrid) continue;
      min = Math.min(min, interval.start);
      max = Math.max(max, interval.end);
    }
  }
  if (!Number.isFinite(min) || max <= min) return { startHour: 8, endHour: 18 };
  return { startHour: Math.floor(min / 60), endHour: Math.ceil(max / 60) };
}
