import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { AREAS, areaColor, areaRank } from "../data/curriculum";
import {
  formatCourseTimes,
  formatEcts,
  formatLecturers,
  formatLocation,
  formatModulePreview,
  formatRecommended,
  formatSlotDetail,
  textOrEmpty,
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
  onSetDetails: (courseIds: string[], open: boolean) => void;
  onFilteredIdsChange: (ids: string[]) => void;
  reveal: { id: string; nonce: number } | null;
};

export function CourseExplorer({
  courses,
  selectedIds,
  versionName,
  openIds,
  onToggle,
  onToggleDetails,
  onSetDetails,
  onFilteredIdsChange,
  reveal,
}: CourseExplorerProps) {
  const [query, setQuery] = useState("");
  const [area, setArea] = useState("all");
  const [moduleName, setModuleName] = useState("all");
  const [day, setDay] = useState("all");
  const [time, setTime] = useState("all");
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [collapsedAreas, setCollapsedAreas] = useState<Set<string>>(() => new Set());
  const [collapsedModules, setCollapsedModules] = useState<Set<string>>(() => new Set());

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
          course.variant ?? "",
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
      .sort((a, b) => areaRank(a.area) - areaRank(b.area) || a.name.localeCompare(b.name, "en") || (a.variant ?? "").localeCompare(b.variant ?? "", "en") || a.code.localeCompare(b.code));
  }, [area, courses, day, moduleName, query, time, timeOptions]);

  const onFilteredIdsChangeRef = useRef(onFilteredIdsChange);
  onFilteredIdsChangeRef.current = onFilteredIdsChange;
  useEffect(() => {
    onFilteredIdsChangeRef.current(filtered.map((course) => course.id));
  }, [filtered]);

  const groups = useMemo(() => {
    const byArea = new Map<string, Map<string, { code: string; name: string; courses: Course[] }>>();
    for (const course of filtered) {
      let modules = byArea.get(course.area);
      if (!modules) {
        modules = new Map();
        byArea.set(course.area, modules);
      }
      const memberships = course.modules.length > 0 ? course.modules : [{ code: "", name: "No module" }];
      for (const membership of memberships) {
        const key = membership.code || membership.name;
        let bucket = modules.get(key);
        if (!bucket) {
          bucket = { code: membership.code, name: membership.name, courses: [] };
          modules.set(key, bucket);
        }
        bucket.courses.push(course);
      }
    }
    return [...byArea.keys()]
      .sort((a, b) => areaRank(a) - areaRank(b) || a.localeCompare(b, "en"))
      .map((areaName) => ({
        area: areaName,
        courses: filtered.filter((course) => course.area === areaName),
        modules: [...byArea.get(areaName)!.values()].sort(
          (a, b) => a.code.localeCompare(b.code, "en") || a.name.localeCompare(b.name, "en"),
        ),
      }));
  }, [filtered]);

  const activeFilterCount = [
    area !== "all",
    moduleName !== "all" && moduleOptions.includes(moduleName),
    dayOptions.some((name) => name === day),
    timeOptions.includes(time),
  ].filter(Boolean).length;
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

  const visibleIds = filtered.map((course) => course.id);
  const allDetailsOpen = visibleIds.length > 0 && visibleIds.every((id) => openIds.has(id));
  const moduleKeys = groups.flatMap((group) =>
    group.modules.map((module) => `${group.area}::${module.code || module.name}`),
  );
  const allGroupsOpen =
    groups.length > 0 &&
    groups.every((group) => !collapsedAreas.has(group.area)) &&
    moduleKeys.every((key) => !collapsedModules.has(key));

  function toggleAllGroups() {
    if (allGroupsOpen) {
      setCollapsedAreas(new Set(groups.map((group) => group.area)));
      setCollapsedModules(new Set(moduleKeys));
      return;
    }
    setCollapsedAreas((current) => {
      const next = new Set(current);
      for (const group of groups) next.delete(group.area);
      return next;
    });
    setCollapsedModules((current) => {
      const next = new Set(current);
      for (const key of moduleKeys) next.delete(key);
      return next;
    });
  }

  const revealedNonce = useRef<number | null>(null);

  useEffect(() => {
    setCollapsedAreas(new Set());
    setCollapsedModules(new Set());
  }, [query, area, moduleName, day, time]);

  useLayoutEffect(() => {
    if (!reveal) return;
    const course = filtered.find((item) => item.id === reveal.id);
    if (!course) return;
    const moduleKey = firstModuleKey(course);
    if (collapsedAreas.has(course.area) || collapsedModules.has(moduleKey)) {
      if (revealedNonce.current === reveal.nonce) return;
      setCollapsedAreas((current) => (current.has(course.area) ? without(current, course.area) : current));
      setCollapsedModules((current) => (current.has(moduleKey) ? without(current, moduleKey) : current));
      return;
    }
    if (revealedNonce.current === reveal.nonce) return;
    const node = document.getElementById(`course-${reveal.id}`);
    if (!node) return;
    revealedNonce.current = reveal.nonce;
    node.scrollIntoView({ block: "nearest", behavior: "smooth" });
  }, [collapsedAreas, collapsedModules, filtered, reveal]);

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
        <div className="explorer-tools">
          <button
            type="button"
            className="filters-toggle"
            aria-expanded={filtersOpen}
            onClick={() => setFiltersOpen((open) => !open)}
          >
            Filters
            {activeFilterCount > 0 && <span className="filters-count">{activeFilterCount}</span>}
            <ChevronIcon open={filtersOpen} />
          </button>
          {groups.length > 0 && (
            <button type="button" className="details-all" onClick={toggleAllGroups}>
              {allGroupsOpen ? "Collapse all" : "Expand all"}
            </button>
          )}
          {visibleIds.length > 0 && (
            <button
              type="button"
              className="details-all"
              onClick={() => onSetDetails(visibleIds, !allDetailsOpen)}
            >
              {allDetailsOpen ? "Hide all details" : "Open all details"}
            </button>
          )}
        </div>
        {filtersOpen && (
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
            <select value={dayOptions.some((name) => name === day) ? day : "all"} onChange={(event) => setDayFilter(event.target.value)}>
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
        )}
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
        {groups.map((group) => {
          const areaOpen = !collapsedAreas.has(group.area);
          const areaPanelId = panelId("area", group.area);
          return (
            <section key={group.area} className="area-group">
              <h3 className="area-heading">
                <button
                  type="button"
                  aria-expanded={areaOpen}
                  aria-controls={areaPanelId}
                  onClick={() => setCollapsedAreas((current) => toggleMember(current, group.area))}
                >
                  <span className="area-dot" style={{ background: areaColor(group.area) }} />
                  <span className="group-title">{group.area}</span>
                  <span className="group-count">{group.courses.length}</span>
                  <ChevronIcon open={areaOpen} />
                </button>
              </h3>
              {areaOpen && (
                <div id={areaPanelId}>
                  {group.modules.map((module) => {
                    const moduleKey = `${group.area}::${module.code || module.name}`;
                    const moduleOpen = !collapsedModules.has(moduleKey);
                    const modulePanelId = panelId("module", moduleKey);
                    return (
                      <section key={moduleKey} className="module-group">
                        <h4 className="module-heading">
                          <button
                            type="button"
                            aria-expanded={moduleOpen}
                            aria-controls={modulePanelId}
                            onClick={() => setCollapsedModules((current) => toggleMember(current, moduleKey))}
                          >
                            <span className="group-title">{module.name}</span>
                            <span className="group-count">{module.courses.length}</span>
                            <ChevronIcon open={moduleOpen} />
                          </button>
                        </h4>
                        {moduleOpen && (
                          <ul id={modulePanelId} className="course-list">
                            {module.courses.map((course) => {
                              const selected = selectedIds.includes(course.id);
                              const open = openIds.has(course.id);
                              const anchor = moduleKey === firstModuleKey(course);
                              return (
                                <li key={`${moduleKey}-${course.id}`} id={anchor ? `course-${course.id}` : undefined}>
                                  <article className={selected ? "course is-selected" : "course"}>
                                    <button
                                      type="button"
                                      className="course-select"
                                      aria-pressed={selected}
                                      onClick={() => onToggle(course.id)}
                                    >
                                      <span className="course-copy">
                                        <span className="course-name">
                                          {course.name}
                                          {course.variant && <span className="course-variant"> ({course.variant})</span>}
                                        </span>
                                        <span className="course-code">{course.code}</span>
                                        {formatModulePreview(course.modules) && (
                                          <span className="course-meta">{formatModulePreview(course.modules)}</span>
                                        )}
                                        {formatCourseTimes(course) && (
                                          <span className="course-time">{formatCourseTimes(course)}</span>
                                        )}
                                      </span>
                                      <span className="check" aria-hidden="true" />
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
                        )}
                      </section>
                    );
                  })}
                </div>
              )}
            </section>
          );
        })}
        {courses.length > 0 && (
          <p className="source-note">
            Times and lecturers come from the WiSe 2026/27 HCI study planner.
          </p>
        )}
      </div>
    </section>
  );
}

function CourseDetails({ course }: { course: Course }) {
  const ects = formatEcts(course);
  const location = formatLocation(course);
  const requirement = textOrEmpty(course.requirementStatus);
  const recommended = formatRecommended(course.recommendedSemesters);
  const frequency = textOrEmpty(course.offeringFrequency);
  const lecturers = formatLecturers(course);
  const times = formatCourseTimes(course);
  return (
    <dl className="detail-grid">
      <div>
        <dt>Area</dt>
        <dd>{course.area}</dd>
      </div>
      {course.modules.length > 0 && (
        <div>
          <dt>{course.modules.length > 1 ? "Modules" : "Module"}</dt>
          <dd>
            <ul className="module-list">
              {course.modules.map((module) => (
                <li key={module.code}>
                  {module.name}
                  <span>{module.code}</span>
                </li>
              ))}
            </ul>
          </dd>
        </div>
      )}
      {requirement && (
        <div>
          <dt>Requirement status</dt>
          <dd>{requirement}</dd>
        </div>
      )}
      {recommended && (
        <div>
          <dt>Recommended semester</dt>
          <dd>{recommended}</dd>
        </div>
      )}
      {frequency && (
        <div>
          <dt>Offering frequency</dt>
          <dd>{frequency}</dd>
        </div>
      )}
      {course.irregularOffering && (
        <div>
          <dt>Irregular offering</dt>
          <dd>Irregular offering</dd>
        </div>
      )}
      {times && (
        <div>
          <dt>Course time</dt>
          <dd>
            <ul className="time-list">
              {course.schedule.map((slot, index) => (
                <li key={`${slot.cadence}-${slot.day ?? "block"}-${slot.startDate}-${slot.startTime}-${index}`}>
                  {formatSlotDetail(slot)}
                  {slot.location ? ` · ${slot.location}` : ""}
                </li>
              ))}
            </ul>
          </dd>
        </div>
      )}
      {location && (
        <div>
          <dt>Location</dt>
          <dd>{location}</dd>
        </div>
      )}
      {lecturers && (
        <div>
          <dt>Lecturer</dt>
          <dd>{lecturers}</dd>
        </div>
      )}
      {ects && (
        <div>
          <dt>ECTS</dt>
          <dd>{ects}</dd>
        </div>
      )}
    </dl>
  );
}

function panelId(prefix: string, key: string): string {
  return `${prefix}-${key.replace(/[^a-zA-Z0-9]+/g, "-")}`;
}

function firstModuleKey(course: Course): string {
  const memberships = course.modules.length > 0 ? course.modules : [{ code: "", name: "No module" }];
  const first = [...memberships].sort(
    (a, b) => a.code.localeCompare(b.code, "en") || a.name.localeCompare(b.name, "en"),
  )[0];
  return `${course.area}::${first.code || first.name}`;
}

function toggleMember(current: Set<string>, key: string): Set<string> {
  const next = new Set(current);
  if (next.has(key)) next.delete(key);
  else next.add(key);
  return next;
}

function without(current: Set<string>, key: string): Set<string> {
  const next = new Set(current);
  next.delete(key);
  return next;
}

function ChevronIcon({ open }: { open: boolean }) {
  return (
    <svg
      className={open ? "is-open" : undefined}
      viewBox="0 0 16 16"
      width="14"
      height="14"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.6"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M4 6.2 8 10.2 12 6.2" />
    </svg>
  );
}
