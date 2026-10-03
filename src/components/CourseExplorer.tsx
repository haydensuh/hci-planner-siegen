import { useMemo, useState } from "react";
import { AREAS, areaColor, areaRank } from "../data/curriculum";
import {
  formatCourseTimes,
  formatEcts,
  formatLecturers,
  formatLocation,
  formatModulePreview,
  formatRecommended,
  formatSessionLocation,
  formatSlotDetail,
  textOrTba,
} from "../lib/format";
import { intervalsFor } from "../lib/schedule";
import type { Course, Weekday } from "../types";

const WEEKDAYS: Weekday[] = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];

type CourseExplorerProps = {
  courses: Course[];
  selectedIds: string[];
  versionName: string;
  openIds: Set<string>;
  onToggle: (courseId: string) => void;
  onToggleDetails: (courseId: string) => void;
};

export function CourseExplorer({
  courses,
  selectedIds,
  versionName,
  openIds,
  onToggle,
  onToggleDetails,
}: CourseExplorerProps) {
  const [query, setQuery] = useState("");
  const [area, setArea] = useState("all");
  const [moduleName, setModuleName] = useState("all");
  const [day, setDay] = useState("all");
  const [time, setTime] = useState("all");

  const moduleOptions = useMemo(() => {
    const names = new Set<string>();
    for (const course of courses) {
      if (area !== "all" && course.area !== area) continue;
      for (const module of course.modules) names.add(module.name);
    }
    return [...names].sort((a, b) => a.localeCompare(b, "en"));
  }, [area, courses]);

  const dayOptions = useMemo(() => {
    const present = new Set<string>();
    for (const course of courses) {
      for (const interval of intervalsFor(course)) present.add(interval.day);
    }
    return WEEKDAYS.filter((name) => present.has(name));
  }, [courses]);

  const timeOptions = useMemo(() => {
    const ranges = new Set<string>();
    for (const course of courses) {
      for (const interval of intervalsFor(course)) {
        if (day !== "all" && interval.day !== day) continue;
        ranges.add(`${interval.startTime}–${interval.endTime}`);
      }
    }
    return [...ranges].sort((a, b) => a.localeCompare(b, "en"));
  }, [courses, day]);

  const filtered = useMemo(() => {
    const needle = query.trim().toLowerCase();
    const activeTime = timeOptions.includes(time) ? time : "all";
    return courses
      .filter((course) => {
        if (area !== "all" && course.area !== area) return false;
        if (moduleName !== "all" && !course.modules.some((module) => module.name === moduleName)) return false;
        if (day !== "all" || activeTime !== "all") {
          const matchesWhen = intervalsFor(course).some((interval) => {
            if (day !== "all" && interval.day !== day) return false;
            if (activeTime !== "all" && `${interval.startTime}–${interval.endTime}` !== activeTime) return false;
            return true;
          });
          if (!matchesWhen) return false;
        }
        if (!needle) return true;
        const haystack = [
          course.name,
          course.code,
          course.area,
          course.requirementStatus ?? "",
          course.lecturers.join(" "),
          course.modules.map((module) => module.name).join(" "),
        ]
          .join(" ")
          .toLowerCase();
        return haystack.includes(needle);
      })
      .sort((a, b) => areaRank(a.area) - areaRank(b.area) || a.name.localeCompare(b.name, "en") || a.code.localeCompare(b.code));
  }, [area, courses, day, moduleName, query, time, timeOptions]);

  const groups = useMemo(() => {
    const known = new Set<string>(AREAS);
    const grouped: { area: string; courses: Course[] }[] = AREAS.map((name) => ({
      area: name,
      courses: filtered.filter((course) => course.area === name),
    })).filter((group) => group.courses.length > 0);
    const extras = filtered.filter((course) => !known.has(course.area));
    if (extras.length > 0) grouped.push({ area: "Other", courses: extras });
    return grouped;
  }, [filtered]);

  const selectedCount = courses.filter((course) => selectedIds.includes(course.id)).length;
  const hiddenSelected = courses.filter(
    (course) => selectedIds.includes(course.id) && !filtered.some((item) => item.id === course.id),
  ).length;

  function setAreaFilter(next: string) {
    setArea(next);
    setModuleName("all");
  }

  function setDayFilter(next: string) {
    setDay(next);
    setTime("all");
  }

  function clearFilters() {
    setQuery("");
    setArea("all");
    setModuleName("all");
    setDay("all");
    setTime("all");
  }

  return (
    <section className="panel explorer" aria-label="Courses">
      <div className="explorer-head">
        <div className="explorer-title">
          <h2>Courses</h2>
          <p>
            {filtered.length} shown · {selectedCount} selected in {versionName}
          </p>
        </div>
        <label className="search">
          <span className="visually-hidden">Search courses</span>
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search courses, modules, lecturers"
            type="search"
          />
        </label>
        <div className="filters">
          <label>
            Area
            <select value={area} onChange={(event) => setAreaFilter(event.target.value)}>
              <option value="all">All areas</option>
              {AREAS.map((name) => {
                const count = courses.filter((course) => course.area === name).length;
                return (
                  <option key={name} value={name}>
                    {name} ({count})
                  </option>
                );
              })}
            </select>
          </label>
          <label>
            Module
            <select
              value={moduleOptions.includes(moduleName) ? moduleName : "all"}
              onChange={(event) => setModuleName(event.target.value)}
            >
              <option value="all">All modules</option>
              {moduleOptions.map((name) => (
                <option key={name} value={name}>
                  {name}
                </option>
              ))}
            </select>
          </label>
          <label>
            Day
            <select value={dayOptions.includes(day) ? day : "all"} onChange={(event) => setDayFilter(event.target.value)}>
              <option value="all">All days</option>
              {dayOptions.map((name) => (
                <option key={name} value={name}>
                  {name}
                </option>
              ))}
            </select>
          </label>
          <label>
            Time
            <select value={timeOptions.includes(time) ? time : "all"} onChange={(event) => setTime(event.target.value)}>
              <option value="all">All times</option>
              {timeOptions.map((range) => (
                <option key={range} value={range}>
                  {range}
                </option>
              ))}
            </select>
          </label>
        </div>
        {hiddenSelected > 0 && (
          <p className="filter-note">
            {hiddenSelected} selected {hiddenSelected === 1 ? "course is" : "courses are"} hidden by these filters.{" "}
            <button type="button" onClick={clearFilters}>
              Clear filters
            </button>
          </p>
        )}
      </div>
      <div className="course-scroll">
        {courses.length === 0 && (
          <div className="empty-note">
            <p>No courses are registered for this semester.</p>
            <p>Only offerings present in the semester data are shown.</p>
          </div>
        )}
        {courses.length > 0 && filtered.length === 0 && (
          <div className="empty-note">
            <p>No courses match these filters.</p>
          </div>
        )}
        {groups.map((group) => (
          <section key={group.area} className="area-group">
            <h3 className="area-heading">
              <span className="area-dot" style={{ background: areaColor(group.area) }} />
              {group.area}
            </h3>
            <ul className="course-list">
              {group.courses.map((course) => {
                const selected = selectedIds.includes(course.id);
                const open = openIds.has(course.id);
                return (
                  <li key={course.id} id={`course-${course.id}`}>
                    <article className={selected ? "course is-selected" : "course"}>
                      <button
                        type="button"
                        className="course-select"
                        aria-pressed={selected}
                        onClick={() => onToggle(course.id)}
                      >
                        <span className="check" aria-hidden="true" />
                        <span className="course-copy">
                          <span className="course-name">{course.name}</span>
                          <span className="course-code">{course.code}</span>
                          <span className="course-meta">{formatModulePreview(course.modules)}</span>
                          <span className="course-time">{formatCourseTimes(course)}</span>
                        </span>
                      </button>
                      <button
                        type="button"
                        className="details-toggle"
                        aria-expanded={open}
                        onClick={() => onToggleDetails(course.id)}
                      >
                        {open ? "Hide details" : "Details"}
                      </button>
                      {open && <CourseDetails course={course} />}
                    </article>
                  </li>
                );
              })}
            </ul>
          </section>
        ))}
        {courses.length > 0 && (
          <p className="source-note">
            Times and lecturers come from the WiSe 2026/27 HCI study planner. Fields without an official value are shown as TBA.
          </p>
        )}
      </div>
    </section>
  );
}

function CourseDetails({ course }: { course: Course }) {
  const ects = formatEcts(course);
  return (
    <dl className="detail-grid">
      <div>
        <dt>Area</dt>
        <dd>{course.area}</dd>
      </div>
      <div>
        <dt>{course.modules.length > 1 ? "Modules" : "Module"}</dt>
        <dd>
          {course.modules.length === 0 ? (
            "TBA"
          ) : (
            <ul className="module-list">
              {course.modules.map((module) => (
                <li key={module.code}>
                  {module.name}
                  <span>{module.code}</span>
                </li>
              ))}
            </ul>
          )}
        </dd>
      </div>
      <div>
        <dt>Requirement status</dt>
        <dd>{textOrTba(course.requirementStatus)}</dd>
      </div>
      <div>
        <dt>Recommended semester</dt>
        <dd>{formatRecommended(course.recommendedSemesters)}</dd>
      </div>
      <div>
        <dt>Offering frequency</dt>
        <dd>{textOrTba(course.offeringFrequency)}</dd>
      </div>
      {course.irregularOffering && (
        <div>
          <dt>Irregular offering</dt>
          <dd>Irregular offering</dd>
        </div>
      )}
      <div>
        <dt>Course time</dt>
        <dd>
          {course.schedule.length === 0 ? (
            "TBA"
          ) : (
            <ul className="time-list">
              {course.schedule.map((slot, index) => {
                const sessionLocation = formatSessionLocation(course, slot);
                return (
                  <li key={`${slot.cadence}-${slot.day ?? "block"}-${slot.startDate}-${slot.startTime}-${index}`}>
                    {formatSlotDetail(slot)}
                    {sessionLocation ? ` · ${sessionLocation}` : ""}
                  </li>
                );
              })}
            </ul>
          )}
        </dd>
      </div>
      <div>
        <dt>Location</dt>
        <dd>{formatLocation(course)}</dd>
      </div>
      <div>
        <dt>Lecturer</dt>
        <dd>{formatLecturers(course)}</dd>
      </div>
      {ects && (
        <div>
          <dt>ECTS</dt>
          <dd>{ects}</dd>
        </div>
      )}
    </dl>
  );
}
