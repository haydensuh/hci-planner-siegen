import { useEffect, useMemo, useRef, useState } from "react";
import { ComparePanel } from "./components/ComparePanel";
import { ConflictList } from "./components/ConflictList";
import { CourseExplorer } from "./components/CourseExplorer";
import { Timetable } from "./components/Timetable";
import { VersionBar } from "./components/VersionBar";
import { courses } from "./data/courses";
import { semesterById, SEMESTERS } from "./data/semesters";
import { findConflicts } from "./lib/schedule";
import { usePlanner } from "./lib/usePlanner";
import type { Course } from "./types";

const coursesById = new Map(courses.map((course) => [course.id, course]));

export default function App() {
  const planner = usePlanner();
  const semester = semesterById(planner.semesterId) ?? SEMESTERS[0];
  const [compareOpen, setCompareOpen] = useState(false);
  const [openIds, setOpenIds] = useState<Set<string>>(() => new Set());
  const [toast, setToast] = useState<string | null>(null);
  const [reveal, setReveal] = useState<{ id: string; nonce: number } | null>(null);
  const filteredIds = useRef<Set<string> | null>(null);
  const toastTimer = useRef<number | null>(null);

  const semesterCourses = useMemo(
    () => courses.filter((course) => course.semesterId === planner.semesterId),
    [planner.semesterId],
  );
  const selected = useMemo(
    () =>
      planner.active.selectedCourseIds
        .map((id) => coursesById.get(id))
        .filter((course): course is Course => Boolean(course)),
    [planner.active.selectedCourseIds],
  );
  const conflicts = useMemo(() => findConflicts(selected), [selected]);

  useEffect(() => {
    return () => {
      if (toastTimer.current) window.clearTimeout(toastTimer.current);
    };
  }, []);

  function showToast(message: string) {
    setToast(message);
    if (toastTimer.current) window.clearTimeout(toastTimer.current);
    toastTimer.current = window.setTimeout(() => setToast(null), 4000);
  }

  function focusCourse(courseId: string) {
    if (filteredIds.current && !filteredIds.current.has(courseId)) {
      showToast("A search or filter is applied, so this course’s details can’t be shown.");
      return;
    }
    setOpenIds((current) => {
      const next = new Set(current);
      next.add(courseId);
      return next;
    });
    setReveal({ id: courseId, nonce: Date.now() });
  }

  return (
    <div className="app">
      <header className="header">
        <div className="brand">
          <p className="eyebrow">
            <img className="brand-logo" src="/favicon.png" alt="" />
            University of Siegen · M.Sc. HCI
          </p>
          <div className="title-row">
            <h1>Timetable Planner</h1>
            <a
              className="external-link"
              href="https://unisono.uni-siegen.de/qisserver/pages/startFlow.xhtml?_flowId=studyPlanner-flow&_flowExecutionKey=e2s1"
              target="_blank"
              rel="noopener noreferrer"
              aria-label="Planner of studies, opens in a new tab"
            >
              Planner of studies
              <ExternalIcon />
            </a>
          </div>
        </div>
        <div className="semester-switch" role="radiogroup" aria-label="Semester">
          {SEMESTERS.map((item) => (
            <button
              key={item.id}
              type="button"
              role="radio"
              aria-checked={item.id === planner.semesterId}
              className={item.id === planner.semesterId ? "semester-option is-active" : "semester-option"}
              onClick={() => {
                planner.selectSemester(item.id);
                setCompareOpen(false);
                setOpenIds(new Set());
              }}
            >
              <span>{item.shortLabel}</span>
              <small>{item.state === "current" ? "Current" : "Upcoming"}</small>
            </button>
          ))}
        </div>
      </header>
      <main className="workspace">
        <CourseExplorer
          key={planner.semesterId}
          courses={semesterCourses}
          selectedIds={planner.active.selectedCourseIds}
          versionName={planner.active.name}
          openIds={openIds}
          onToggle={planner.toggleCourse}
          onToggleDetails={(courseId) => {
            setOpenIds((current) => {
              const next = new Set(current);
              if (next.has(courseId)) next.delete(courseId);
              else next.add(courseId);
              return next;
            });
          }}
          onSetDetails={(courseIds, open) => {
            setOpenIds((current) => {
              const next = new Set(current);
              for (const courseId of courseIds) {
                if (open) next.add(courseId);
                else next.delete(courseId);
              }
              return next;
            });
          }}
          onFilteredIdsChange={(ids) => {
            filteredIds.current = new Set(ids);
          }}
          reveal={reveal}
        />
        <section className="panel planner" aria-label={`${semester.label} timetable`}>
          <VersionBar
            versions={planner.semesterVersions}
            active={planner.active}
            selected={selected}
            compareOpen={compareOpen}
            onSelect={planner.selectVersion}
            onCreate={() => {
              planner.createVersion();
              setCompareOpen(false);
            }}
            onRename={planner.renameVersion}
            onDuplicate={planner.duplicateVersion}
            onDelete={(versionId) => {
              planner.deleteVersion(versionId);
              setCompareOpen(false);
            }}
            canUndo={planner.canUndo}
            onUndo={planner.undo}
            canRedo={planner.canRedo}
            onRedo={planner.redo}
            onToggleCompare={() => setCompareOpen((open) => !open)}
          />
          <div className="planner-scroll">
            <ConflictList conflicts={conflicts} />
            {compareOpen && (
              <ComparePanel versions={planner.semesterVersions} courses={semesterCourses} activeId={planner.active.id} />
            )}
            {selected.length === 0 ? (
              <div className="empty-state">
                <p>Your timetable is empty.</p>
                <p>Select courses to start building your schedule.</p>
              </div>
            ) : (
              <Timetable
                selected={selected}
                boundsCourses={semesterCourses}
                onFocusCourse={focusCourse}
                onRemoveCourse={planner.toggleCourse}
              />
            )}
          </div>
        </section>
      </main>
      <div className="toast-anchor" role="status" aria-live="polite">
        {toast && <p className="toast">{toast}</p>}
      </div>
    </div>
  );
}

function ExternalIcon() {
  return (
    <svg viewBox="0 0 16 16" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M6.2 3.6H4.1A1.5 1.5 0 0 0 2.6 5.1v6.8a1.5 1.5 0 0 0 1.5 1.5h6.8a1.5 1.5 0 0 0 1.5-1.5V9.8" />
      <path d="M8.6 2.6h4.8v4.8" />
      <path d="M13.1 2.9 7.4 8.6" />
    </svg>
  );
}
