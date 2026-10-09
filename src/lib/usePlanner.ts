import { useEffect, useState } from "react";
import { courses } from "../data/courses";
import { SEMESTERS } from "../data/semesters";
import type { PlannerState, Version } from "../types";
import { loadState, saveState } from "./storage";
import { duplicateName, nextVersionName } from "./versions";

const courseSemesterById = new Map(courses.map((course) => [course.id, course.semesterId]));
const semesterIds = SEMESTERS.map((semester) => semester.id);
const HISTORY_LIMIT = 30;

type History = {
  present: PlannerState;
  past: PlannerState[];
  future: PlannerState[];
};

function remember(history: History, next: PlannerState): History {
  if (next === history.present) return history;
  const past = [...history.past, history.present];
  if (past.length > HISTORY_LIMIT) past.shift();
  return { present: next, past, future: [] };
}

function undoHistory(history: History): History {
  const previous = history.past.at(-1);
  if (!previous) return history;
  const future = [history.present, ...history.future];
  if (future.length > HISTORY_LIMIT) future.pop();
  return { present: previous, past: history.past.slice(0, -1), future };
}

function redoHistory(history: History): History {
  const next = history.future[0];
  if (!next) return history;
  const past = [...history.past, history.present];
  if (past.length > HISTORY_LIMIT) past.shift();
  return { present: next, past, future: history.future.slice(1) };
}

function activeVersion(state: PlannerState): Version {
  const versions = state.versions.filter((version) => version.semesterId === state.semesterId);
  const active = versions.find((version) => version.id === state.activeBySemester[state.semesterId]) ?? versions[0];
  if (!active) throw new Error("Each semester needs a timetable version");
  return active;
}

export function usePlanner() {
  const [history, setHistory] = useState<History>(() => ({
    present: loadState({
      semesterIds,
      courseSemesterById,
      defaultSemesterId: "WS26-27",
    }),
    past: [],
    future: [],
  }));
  const state = history.present;

  useEffect(() => {
    saveState(state);
  }, [state]);

  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      const key = event.key.toLowerCase();
      const redo = (key === "z" && event.shiftKey) || key === "y";
      const undoKey = key === "z" && !event.shiftKey;
      if ((!redo && !undoKey) || event.altKey) return;
      if (!(event.metaKey || event.ctrlKey)) return;
      const target = event.target;
      if (
        target instanceof HTMLElement &&
        (target.isContentEditable || target.closest("input, textarea, select"))
      ) {
        return;
      }
      event.preventDefault();
      setHistory(redo ? redoHistory : undoHistory);
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);

  const active = activeVersion(state);
  const semesterVersions = state.versions.filter((version) => version.semesterId === state.semesterId);

  function commit(change: (current: PlannerState) => PlannerState) {
    setHistory((current) => remember(current, change(current.present)));
  }

  function undo() {
    setHistory(undoHistory);
  }

  function redo() {
    setHistory(redoHistory);
  }

  function selectSemester(semesterId: string) {
    commit((current) => (current.semesterId === semesterId ? current : { ...current, semesterId }));
  }

  function selectVersion(versionId: string) {
    commit((current) => {
      if (current.activeBySemester[current.semesterId] === versionId) return current;
      return {
        ...current,
        activeBySemester: { ...current.activeBySemester, [current.semesterId]: versionId },
      };
    });
  }

  function toggleCourse(courseId: string, track?: "9" | "6") {
    commit((current) => {
      const activeId = current.activeBySemester[current.semesterId];
      return {
        ...current,
        versions: current.versions.map((version) => {
          if (version.id !== activeId) return version;
          const selected = version.selectedCourseIds.includes(courseId);
          const lpTrackByCourseId = { ...(version.lpTrackByCourseId ?? {}) };
          if (selected) delete lpTrackByCourseId[courseId];
          else if (track) lpTrackByCourseId[courseId] = track;
          return {
            ...version,
            selectedCourseIds: selected
              ? version.selectedCourseIds.filter((id) => id !== courseId)
              : [...version.selectedCourseIds, courseId],
            lpTrackByCourseId,
          };
        }),
      };
    });
  }

  function createVersion() {
    commit((current) => {
      const names = current.versions
        .filter((version) => version.semesterId === current.semesterId)
        .map((version) => version.name);
      const version: Version = {
        id: crypto.randomUUID(),
        semesterId: current.semesterId,
        name: nextVersionName(names),
        selectedCourseIds: [],
      };
      return {
        ...current,
        versions: [...current.versions, version],
        activeBySemester: { ...current.activeBySemester, [current.semesterId]: version.id },
      };
    });
  }

  function renameVersion(versionId: string, name: string) {
    const trimmed = name.trim().slice(0, 48);
    if (!trimmed) return;
    commit((current) => {
      const version = current.versions.find((item) => item.id === versionId);
      if (!version || version.name === trimmed) return current;
      return {
        ...current,
        versions: current.versions.map((item) => (item.id === versionId ? { ...item, name: trimmed } : item)),
      };
    });
  }

  function duplicateVersion(versionId: string) {
    commit((current) => {
      const source = current.versions.find((version) => version.id === versionId);
      if (!source) return current;
      const names = current.versions
        .filter((version) => version.semesterId === source.semesterId)
        .map((version) => version.name);
      const copy: Version = {
        id: crypto.randomUUID(),
        semesterId: source.semesterId,
        name: duplicateName(source.name, names),
        selectedCourseIds: [...source.selectedCourseIds],
        lpTrackByCourseId: { ...(source.lpTrackByCourseId ?? {}) },
      };
      const index = current.versions.findIndex((version) => version.id === versionId);
      const versions = [...current.versions];
      versions.splice(index + 1, 0, copy);
      return {
        ...current,
        versions,
        activeBySemester: { ...current.activeBySemester, [source.semesterId]: copy.id },
      };
    });
  }

  function deleteVersion(versionId: string) {
    commit((current) => {
      const mine = current.versions.filter((version) => version.semesterId === current.semesterId);
      if (mine.length <= 1) return current;
      const versions = current.versions.filter((version) => version.id !== versionId);
      const remaining = versions.filter((version) => version.semesterId === current.semesterId);
      const currentActive = current.activeBySemester[current.semesterId];
      const nextActive = currentActive === versionId ? (remaining[0]?.id ?? "") : currentActive;
      return {
        ...current,
        versions,
        activeBySemester: { ...current.activeBySemester, [current.semesterId]: nextActive },
      };
    });
  }

  return {
    semesterId: state.semesterId,
    active,
    semesterVersions,
    canUndo: history.past.length > 0,
    canRedo: history.future.length > 0,
    undo,
    redo,
    selectSemester,
    selectVersion,
    toggleCourse,
    createVersion,
    renameVersion,
    duplicateVersion,
    deleteVersion,
  };
}
