import type { PlannerState, Version } from "../types";

const STORAGE_KEY = "hci-planner-siegen.v1";

type LoadOptions = {
  semesterIds: string[];
  courseSemesterById: Map<string, string>;
  defaultSemesterId: string;
};

function createVersion(semesterId: string, name = "Version A"): Version {
  return {
    id: crypto.randomUUID(),
    semesterId,
    name,
    selectedCourseIds: [],
  };
}

function freshState(options: LoadOptions): PlannerState {
  const versions = options.semesterIds.map((semesterId) => createVersion(semesterId));
  return {
    semesterId: options.defaultSemesterId,
    versions,
    activeBySemester: Object.fromEntries(versions.map((version) => [version.semesterId, version.id])),
  };
}

function sanitizeVersion(value: unknown, options: LoadOptions, seenIds: Set<string>): Version | null {
  if (!value || typeof value !== "object") return null;
  const record = value as Partial<Version>;
  if (typeof record.semesterId !== "string" || !options.semesterIds.includes(record.semesterId)) return null;
  if (typeof record.name !== "string" || !record.name.trim()) return null;
  let id = typeof record.id === "string" && record.id ? record.id : crypto.randomUUID();
  if (seenIds.has(id)) id = crypto.randomUUID();
  seenIds.add(id);
  const selectedCourseIds = Array.isArray(record.selectedCourseIds)
    ? record.selectedCourseIds.filter(
        (courseId): courseId is string =>
          typeof courseId === "string" && options.courseSemesterById.get(courseId) === record.semesterId,
      )
    : [];
  return {
    id,
    semesterId: record.semesterId,
    name: record.name.trim().slice(0, 48),
    selectedCourseIds,
  };
}

function sanitize(value: unknown, options: LoadOptions): PlannerState | null {
  if (!value || typeof value !== "object") return null;
  const record = value as Partial<PlannerState>;
  if (!Array.isArray(record.versions)) return null;
  const seenIds = new Set<string>();
  const versions = record.versions
    .map((version) => sanitizeVersion(version, options, seenIds))
    .filter((version): version is Version => version !== null);

  for (const semesterId of options.semesterIds) {
    if (!versions.some((version) => version.semesterId === semesterId)) {
      versions.push(createVersion(semesterId));
    }
  }

  const activeBySemester: Record<string, string> = {};
  const storedActive =
    record.activeBySemester && typeof record.activeBySemester === "object" ? record.activeBySemester : {};
  for (const semesterId of options.semesterIds) {
    const mine = versions.filter((version) => version.semesterId === semesterId);
    const wanted = storedActive[semesterId];
    activeBySemester[semesterId] = mine.some((version) => version.id === wanted) ? wanted : mine[0].id;
  }

  const semesterId =
    typeof record.semesterId === "string" && options.semesterIds.includes(record.semesterId)
      ? record.semesterId
      : options.defaultSemesterId;

  return { semesterId, versions, activeBySemester };
}

export function loadState(options: LoadOptions): PlannerState {
  const fresh = freshState(options);
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return fresh;
    return sanitize(JSON.parse(raw), options) ?? fresh;
  } catch {
    return fresh;
  }
}

export function saveState(state: PlannerState): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch {
    // Private mode or a full quota should not block planning in memory.
  }
}
