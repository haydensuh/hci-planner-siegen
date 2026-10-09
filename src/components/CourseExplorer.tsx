import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { AREAS, areaColor, areaRank } from "../data/curriculum";
import {
  LP6_NOTE,
  LP9_NOTE,
  TRACK_RULE,
  lp6Course,
  lp6Courses,
  lp9Placement,
  lp9Sections,
  type CatalogGroup,
  type CatalogSection,
} from "../data/interdisciplinaryCatalog";
import {
  formatCourseTimes,
  formatEcts,
  formatLecturers,
  formatLocation,
  formatModulePreview,
  formatRecommended,
  moduleSemester,
  formatSeason,
  formatSlotDetail,
  isSummerOnly,
  textOrEmpty,
} from "../lib/format";
import { intervalsFor } from "../lib/schedule";
import type { Course, Weekday } from "../types";

const WEEKDAYS: Weekday[] = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];

const NINE_LP_LOCK = "9 LP is already selected in this version, so a 6 LP course can’t be selected.";
const SIX_LP_LOCK = "6 LP is already selected in this version, so a 9 LP course can’t be selected.";
const MIX_LP_LOCK = "6 LP and 9 LP courses can’t be mixed in this version.";

function listsFor(courseId: string) {
  return { on9: lp9Placement(courseId) !== null, on6: lp6Course(courseId) !== null };
}

function selectionSide(courseId: string, tracks: Record<string, "9" | "6">): "9" | "6" | null {
  const { on9, on6 } = listsFor(courseId);
  if (on9 && on6) return tracks[courseId] ?? null;
  if (on9) return "9";
  if (on6) return "6";
  return null;
}

function interdisciplinaryChoice(
  selectedIds: string[],
  tracks: Record<string, "9" | "6">,
): "9" | "6" | "mix" | null {
  let six = false;
  let nine = false;
  for (const courseId of selectedIds) {
    const side = selectionSide(courseId, tracks);
    if (side === "6") six = true;
    if (side === "9") nine = true;
  }
  if (six && nine) return "mix";
  if (six) return "6";
  if (nine) return "9";
  return null;
}

function selectionLock(
  courseId: string,
  selectedIds: string[],
  tracks: Record<string, "9" | "6">,
): string | null {
  if (selectedIds.includes(courseId)) return null;
  const { on9, on6 } = listsFor(courseId);
  if (on9 && on6) return null;
  const choice = interdisciplinaryChoice(selectedIds, tracks);
  if ((choice === "9" || choice === "mix") && on6 && !on9) return NINE_LP_LOCK;
  if ((choice === "6" || choice === "mix") && on9 && !on6) return SIX_LP_LOCK;
  return null;
}

type CourseExplorerProps = {
  courses: Course[];
  selectedIds: string[];
  lpTracks: Record<string, "9" | "6">;
  versionName: string;
  openIds: Set<string>;
  onToggle: (courseId: string, track?: "9" | "6") => void;
  onToggleDetails: (courseId: string) => void;
  onSetDetails: (courseIds: string[], open: boolean) => void;
  onFilteredIdsChange: (ids: string[], browseFiltered: boolean) => void;
  reveal: { id: string; nonce: number } | null;
};

export function CourseExplorer({
  courses,
  selectedIds,
  lpTracks,
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
  const [track, setTrack] = useState<"9" | "6">("9");

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

  const activeDay = dayOptions.some((name) => name === day) ? day : "all";
  const activeTime = timeOptions.includes(time) ? time : "all";
  const activeModule = moduleOptions.includes(moduleName) ? moduleName : "all";

  const filtered = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return courses
      .filter((course) => {
        if (isSummerOnly(course) && course.id !== reveal?.id) return false;
        if (area !== "all" && course.area !== area) return false;
        if (activeModule !== "all" && !course.modules.some((module) => module.name === activeModule)) return false;
        if (activeDay !== "all" || activeTime !== "all") {
          const matchesWhen = intervalsFor(course).some((interval) => {
            if (activeDay !== "all" && interval.day !== activeDay) return false;
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
  }, [activeDay, activeModule, activeTime, area, courses, query, reveal]);

  const browseFiltered = query.trim() !== "" || area !== "all" || activeModule !== "all" || activeDay !== "all" || activeTime !== "all";
  const onFilteredIdsChangeRef = useRef(onFilteredIdsChange);
  onFilteredIdsChangeRef.current = onFilteredIdsChange;
  useEffect(() => {
    onFilteredIdsChangeRef.current(
      filtered.map((course) => course.id),
      browseFiltered,
    );
  }, [browseFiltered, filtered]);

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

  const visible9 = filtered.filter((course) => lp9Placement(course.id)).length;
  const visible6 = filtered.filter((course) => lp6Course(course.id)).length;
  const trackChoice = interdisciplinaryChoice(selectedIds, lpTracks);
  const trackLockReason =
    trackChoice === "9" ? NINE_LP_LOCK : trackChoice === "6" ? SIX_LP_LOCK : trackChoice === "mix" ? MIX_LP_LOCK : null;
  const shownTrack: "9" | "6" =
    trackChoice === "9"
      ? "9"
      : trackChoice === "6"
        ? "6"
        : track === "9" && visible9 === 0 && visible6 > 0
          ? "6"
          : track === "6" && visible6 === 0 && visible9 > 0
            ? "9"
            : track;

  const listedGroups = useMemo(() => {
    const needle = query.trim().toLowerCase();
    const hasArea = groups.some((group) => group.area === "Interdisciplinary Contexts");
    const openBrowse = activeModule === "all" && activeDay === "all" && activeTime === "all";
    const catalogHit =
      needle.length > 0 &&
      lp9Sections.some((section) => {
        const offered = section.groups.some((group) => group.entries.length > 0);
        if (!offered) return false;
        if (section.name.toLowerCase().includes(needle)) return true;
        return section.groups.some(
          (group) =>
            group.entries.length > 0 &&
            (group.name.toLowerCase().includes(needle) ||
              group.entries.some((entry) => "title" in entry && entry.title.toLowerCase().includes(needle))),
        );
      });
    if (!hasArea && (area === "all" || area === "Interdisciplinary Contexts") && openBrowse && catalogHit) {
      return [...groups, { area: "Interdisciplinary Contexts", courses: [], modules: [] }].sort(
        (a, b) => areaRank(a.area) - areaRank(b.area),
      );
    }
    return groups;
  }, [activeDay, activeModule, activeTime, area, groups, query]);

  const activeFilterCount = [area !== "all", activeModule !== "all", activeDay !== "all", activeTime !== "all"].filter(Boolean).length;
  const selectedCount = courses.filter((course) => selectedIds.includes(course.id)).length;
  const hiddenSelected = browseFiltered
    ? courses.filter(
        (course) =>
          selectedIds.includes(course.id) &&
          !isSummerOnly(course) &&
          !filtered.some((item) => item.id === course.id),
      ).length
    : 0;

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
  const moduleKeys = listedGroups.flatMap((group) =>
    group.area === "Interdisciplinary Contexts"
      ? catalogKeysFor(shownTrack)
      : group.modules.map((module) => `${group.area}::${module.code || module.name}`),
  );
  const allGroupsOpen =
    listedGroups.length > 0 &&
    listedGroups.every((group) => !collapsedAreas.has(group.area)) &&
    moduleKeys.every((key) => !collapsedModules.has(key));

  function toggleAllGroups() {
    if (allGroupsOpen) {
      setCollapsedAreas(new Set(listedGroups.map((group) => group.area)));
      setCollapsedModules(new Set(moduleKeys));
      return;
    }
    setCollapsedAreas((current) => {
      const next = new Set(current);
      for (const group of listedGroups) next.delete(group.area);
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
    const desiredTrack = revealTrack(course.id, shownTrack);
    if (desiredTrack && desiredTrack !== track) {
      setTrack(desiredTrack);
      return;
    }
    const keys = revealKeys(course, desiredTrack ?? shownTrack);
    const hidden = collapsedAreas.has(course.area) || keys.some((key) => collapsedModules.has(key));
    if (hidden) {
      if (revealedNonce.current === reveal.nonce) return;
      setCollapsedAreas((current) => (current.has(course.area) ? without(current, course.area) : current));
      setCollapsedModules((current) => {
        const next = new Set(current);
        for (const key of keys) next.delete(key);
        return next;
      });
      return;
    }
    if (revealedNonce.current === reveal.nonce) return;
    const node = document.getElementById(`course-${reveal.id}`);
    if (!node) return;
    revealedNonce.current = reveal.nonce;
    node.scrollIntoView({ block: "nearest", behavior: "smooth" });
  }, [collapsedAreas, collapsedModules, filtered, reveal, shownTrack, track]);

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
          {listedGroups.length > 0 && (
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
                const count = courses.filter((course) => course.area === name && !isSummerOnly(course)).length;
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
        {listedGroups.map((group) => {
          const areaOpen = !collapsedAreas.has(group.area);
          const areaPanelId = panelId("area", group.area);
          const areaCount =
            group.area === "Interdisciplinary Contexts"
              ? filtered.filter(
                  (course) =>
                    course.area === group.area &&
                    (shownTrack === "9" ? lp9Placement(course.id) : lp6Course(course.id)),
                ).length
              : group.courses.length;
          const toggleArea = () => setCollapsedAreas((current) => toggleMember(current, group.area));
          return (
            <section key={group.area} className="area-group">
              <h3 className="area-heading">
                <button
                  type="button"
                  className="area-toggle"
                  aria-expanded={areaOpen}
                  aria-controls={areaPanelId}
                  aria-label={`${group.area}, ${areaCount} ${areaCount === 1 ? "course" : "courses"}`}
                  onClick={toggleArea}
                >
                  <span className="area-dot" style={{ background: areaColor(group.area) }} />
                  <span className="group-title">{group.area}</span>
                </button>
                {group.area === "Practice" && <PracticeInfo />}
                <div className="area-rest" onClick={toggleArea}>
                  <span className="group-count">{areaCount}</span>
                  <ChevronIcon open={areaOpen} />
                </div>
              </h3>
              {areaOpen && (
                <div id={areaPanelId}>
                  {group.area === "Interdisciplinary Contexts" ? (
                    <InterdisciplinaryCatalog
                      courses={courses}
                      shownTrack={shownTrack}
                      trackLockReason={trackLockReason}
                      onTrack={setTrack}
                      filteredIds={visibleIds}
                      query={query}
                      narrowing={moduleName !== "all" || day !== "all" || timeOptions.includes(time) || query.trim().length > 0}
                      selectedIds={selectedIds}
                      lpTracks={lpTracks}
                      openIds={openIds}
                      collapsed={collapsedModules}
                      onToggleKey={(key) => setCollapsedModules((current) => toggleMember(current, key))}
                      onToggle={(courseId) => onToggle(courseId, shownTrack)}
                      onToggleDetails={onToggleDetails}
                    />
                  ) : (
                    <>
                      {group.modules.map((module) => {
                    const moduleKey = `${group.area}::${module.code || module.name}`;
                    const moduleOpen = !collapsedModules.has(moduleKey);
                    const modulePanelId = panelId("module", moduleKey);
                    const semester = moduleSemester(module.name);
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
                            {semester !== null && (
                              <span className="group-note">For {semester} semester</span>
                            )}
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
                                        {formatSeason(course) && <span className="course-season">{formatSeason(course)}</span>}
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
                                    {open && <CourseDetails course={course} moduleName={module.name} />}
                                  </article>
                                </li>
                              );
                            })}
                          </ul>
                        )}
                      </section>
                    );
                  })}
                      {group.area === "Current Research" && (
                        <section className="module-group">
                          <h4 className="module-heading">
                            <span className="internship-heading">
                              <span className="group-title">Internship</span>
                            </span>
                          </h4>
                          <p className="catalog-empty">No timetable entry for Winter 2026/27. The module is 6 ECTS.</p>
                        </section>
                      )}
                    </>
                  )}
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

function CourseArticle({
  course,
  selected,
  open,
  extra,
  showModules,
  lockReason,
  onToggle,
  onToggleDetails,
}: {
  course: Course;
  selected: boolean;
  open: boolean;
  extra?: string;
  showModules: boolean;
  lockReason?: string | null;
  onToggle: (courseId: string) => void;
  onToggleDetails: (courseId: string) => void;
}) {
  return (
    <article className={selected ? "course is-selected" : "course"}>
      <span className={lockReason ? "course-lock" : undefined} title={lockReason ?? undefined}>
      <button
        type="button"
        className="course-select"
        aria-pressed={selected}
        disabled={Boolean(lockReason)}
        onClick={() => {
          if (lockReason) return;
          onToggle(course.id);
        }}
      >
        <span className="course-copy">
          <span className="course-name">
            {course.name}
            {course.variant && <span className="course-variant"> ({course.variant})</span>}
          </span>
          <span className="course-code">{course.code}</span>
          {showModules && formatModulePreview(course.modules) && (
            <span className="course-meta">{formatModulePreview(course.modules)}</span>
          )}
          {extra && <span className="course-meta">{extra}</span>}
          {formatSeason(course) && <span className="course-season">{formatSeason(course)}</span>}
          {formatCourseTimes(course) && <span className="course-time">{formatCourseTimes(course)}</span>}
        </span>
        <span className="check" aria-hidden="true" />
      </button>
      </span>
      <button type="button" className="details-toggle" aria-expanded={open} onClick={() => onToggleDetails(course.id)}>
        {open ? "Hide details" : "Details"}
      </button>
      {open && <CourseDetails course={course} />}
    </article>
  );
}

function InterdisciplinaryCatalog({
  courses,
  shownTrack,
  trackLockReason,
  onTrack,
  filteredIds,
  query,
  narrowing,
  selectedIds,
  lpTracks,
  openIds,
  collapsed,
  onToggleKey,
  onToggle,
  onToggleDetails,
}: {
  courses: Course[];
  shownTrack: "9" | "6";
  trackLockReason: string | null;
  onTrack: (track: "9" | "6") => void;
  filteredIds: string[];
  query: string;
  narrowing: boolean;
  selectedIds: string[];
  lpTracks: Record<string, "9" | "6">;
  openIds: Set<string>;
  collapsed: Set<string>;
  onToggleKey: (key: string) => void;
  onToggle: (courseId: string) => void;
  onToggleDetails: (courseId: string) => void;
}) {
  const byId = new Map(courses.map((course) => [course.id, course]));
  const needle = query.trim().toLowerCase();

  function renderCourse(course: Course, extra?: string) {
    const lockReason = selectionLock(course.id, selectedIds, lpTracks);
    return (
      <li key={course.id} id={`course-${course.id}`}>
        <CourseArticle
          course={course}
          selected={selectedIds.includes(course.id)}
          open={openIds.has(course.id)}
          extra={extra}
          showModules={false}
          lockReason={lockReason}
          onToggle={onToggle}
          onToggleDetails={onToggleDetails}
        />
      </li>
    );
  }

  const lp6Visible = lp6Courses.flatMap((item) => {
    const course = byId.get(item.courseId);
    if (!course || !filteredIds.includes(course.id)) return [];
    return [{ course, notInVb: item.notInVb }];
  });

  const lp9Visible = lp9Sections.flatMap((section) => {
    const groups = section.groups.filter((group) => catalogGroupVisible(section, group, filteredIds, needle, narrowing));
    return groups.length > 0 ? [{ section, groups }] : [];
  });

  return (
    <div className="track-wrap">
      <div className="track-bar">
        <div
          className={trackLockReason ? "track-switch is-locked" : "track-switch"}
          role="group"
          aria-label="Credit track"
          aria-describedby={trackLockReason ? "track-lock-reason" : undefined}
        >
          <button type="button" aria-pressed={shownTrack === "9"} disabled={trackLockReason !== null} onClick={() => onTrack("9")}>
            9 LP
          </button>
          <button type="button" aria-pressed={shownTrack === "6"} disabled={trackLockReason !== null} onClick={() => onTrack("6")}>
            6 LP
          </button>
          {trackLockReason && (
            <p id="track-lock-reason" className="track-tooltip" role="tooltip">
              {trackLockReason}
            </p>
          )}
        </div>
        <p className="track-note">{TRACK_RULE}</p>
      </div>
      <p className="track-semester">{shownTrack === "9" ? LP9_NOTE : LP6_NOTE}</p>
      {shownTrack === "6" ? (
        lp6Visible.length > 0 ? (
          <ul className="course-list track-courses">
            {lp6Visible.map(({ course, notInVb }) => renderCourse(course, notInVb ? "Not in Vb" : undefined))}
          </ul>
        ) : (
          <p className="catalog-empty">No courses on this track match these filters.</p>
        )
      ) : lp9Visible.length > 0 ? (
        lp9Visible.map(({ section, groups }) => {
          const key = catalogSectionKey(section.name);
          const open = !collapsed.has(key);
          const count = groups.reduce(
            (sum, group) =>
              sum + group.entries.filter((entry) => "courseId" in entry && filteredIds.includes(entry.courseId)).length,
            0,
          );
          return (
            <section key={key} className="module-group">
              <h4 className="module-heading">
                <button type="button" aria-expanded={open} aria-controls={panelId("module", key)} onClick={() => onToggleKey(key)}>
                  <span className="group-title">{section.name}</span>
                  <span className="group-count">{count}</span>
                  <ChevronIcon open={open} />
                </button>
              </h4>
              {open && (
                <div id={panelId("module", key)}>
                  {groups.map((group) => {
                    const coursesInGroup = group.entries.flatMap((entry) => {
                      if (!("courseId" in entry) || !filteredIds.includes(entry.courseId)) return [];
                      const course = byId.get(entry.courseId);
                      return course ? [course] : [];
                    });
                    const titles = group.entries.flatMap((entry) => ("title" in entry ? [entry.title] : []));
                    const showTitles = titles.length > 0 && (!narrowing || titles.some((title) => title.toLowerCase().includes(needle)) || nameHit(section, group, needle));
                    if (!group.name) {
                      return (
                        <ul key="courses" className="course-list">
                          {coursesInGroup.map((course) => renderCourse(course))}
                          {showTitles && titles.map((title) => <CatalogTitle key={title} title={title} />)}
                        </ul>
                      );
                    }
                    const groupKey = catalogGroupKey(section.name, group.name);
                    const groupOpen = !collapsed.has(groupKey);
                    return (
                      <section key={group.name} className="lecture-group">
                        <h5 className="module-heading lecture-heading">
                          <button
                            type="button"
                            aria-expanded={groupOpen}
                            aria-controls={panelId("module", groupKey)}
                            onClick={() => onToggleKey(groupKey)}
                          >
                            <span className="group-title">{group.name}</span>
                            <span className="group-count">{coursesInGroup.length}</span>
                            <ChevronIcon open={groupOpen} />
                          </button>
                        </h5>
                        {groupOpen && (
                          <ul id={panelId("module", groupKey)} className="course-list">
                            {coursesInGroup.map((course) => renderCourse(course))}
                            {showTitles && titles.map((title) => <CatalogTitle key={title} title={title} />)}
                          </ul>
                        )}
                      </section>
                    );
                  })}
                </div>
              )}
            </section>
          );
        })
      ) : (
        <p className="catalog-empty">No courses on this track match these filters.</p>
      )}
    </div>
  );
}

function CatalogTitle({ title }: { title: string }) {
  return (
    <li className="catalog-title">
      <span>{title}</span>
      <span>No timetable entry</span>
    </li>
  );
}

function catalogGroupVisible(
  section: CatalogSection,
  group: CatalogGroup,
  filteredIds: string[],
  needle: string,
  narrowing: boolean,
): boolean {
  if (group.entries.some((entry) => "courseId" in entry && filteredIds.includes(entry.courseId))) return true;
  if (!group.entries.some((entry) => "title" in entry)) return false;
  const hit = nameHit(section, group, needle) || group.entries.some((entry) => "title" in entry && entry.title.toLowerCase().includes(needle));
  return !narrowing || hit;
}

function nameHit(section: CatalogSection, group: CatalogGroup, needle: string): boolean {
  if (!needle) return false;
  return section.name.toLowerCase().includes(needle) || group.name.toLowerCase().includes(needle);
}

function catalogSectionKey(name: string): string {
  return `Interdisciplinary Contexts::9::${name}`;
}

function catalogGroupKey(section: string, group: string): string {
  return `${catalogSectionKey(section)}::${group}`;
}

function catalogKeysFor(track: "9" | "6"): string[] {
  if (track !== "9") return [];
  return lp9Sections.flatMap((section) => {
    const key = catalogSectionKey(section.name);
    const groups = section.groups
      .filter((group) => group.name && group.entries.some((entry) => "courseId" in entry))
      .map((group) => catalogGroupKey(section.name, group.name));
    return [key, ...groups];
  });
}

function revealTrack(courseId: string, shown: "9" | "6"): "9" | "6" | null {
  const on9 = lp9Placement(courseId) !== null;
  const on6 = lp6Course(courseId) !== null;
  if (!on9 && !on6) return null;
  if (shown === "9" && on9) return "9";
  if (shown === "6" && on6) return "6";
  return on9 ? "9" : "6";
}

function revealKeys(course: Course, shown: "9" | "6"): string[] {
  if (course.area !== "Interdisciplinary Contexts") return [firstModuleKey(course)];
  if (shown !== "9") return [];
  const place = lp9Placement(course.id);
  if (!place) return [];
  const keys = [catalogSectionKey(place.section)];
  if (place.group) keys.push(catalogGroupKey(place.section, place.group));
  return keys;
}

function CourseDetails({ course, moduleName }: { course: Course; moduleName?: string }) {
  const ects = formatEcts(course);
  const location = formatLocation(course);
  const requirement = textOrEmpty(course.requirementStatus);
  const inProject = moduleName ? moduleSemester(moduleName) : null;
  const projects = course.modules.flatMap((module) => {
    const semester = moduleSemester(module.name);
    return semester === null ? [] : [{ name: module.name, label: formatRecommended([semester]) }];
  });
  const recommended =
    inProject !== null
      ? formatRecommended([inProject])
      : projects.length === 1
        ? projects[0].label
        : projects.length === 0
          ? formatRecommended(course.recommendedSemesters)
          : null;
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
      {!recommended && projects.length > 1 && (
        <div>
          <dt>Recommended semester</dt>
          <dd>
            <ul className="module-list">
              {projects.map((project) => (
                <li key={project.name}>
                  {project.name}
                  <span>{project.label}</span>
                </li>
              ))}
            </ul>
          </dd>
        </div>
      )}
      {frequency && (
        <div>
          <dt>Offering frequency</dt>
          <dd>{frequency}</dd>
        </div>
      )}
      {course.lectureGroupFrequency && (
        <div>
          <dt>Lecture group</dt>
          <dd>{course.lectureGroupFrequency}</dd>
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
      {(ects || course.creditGroup || course.moduleCreditNote) && (
        <div>
          <dt>ECTS</dt>
          <dd>
            {course.creditGroup
              ? `${course.creditGroup.ects} ECTS once all ${course.creditGroup.parts} ${course.creditGroup.label} courses are completed.`
              : ects}
            {course.moduleCreditNote && <span className="detail-note">{course.moduleCreditNote}</span>}
          </dd>
        </div>
      )}
      {course.examCredit && (
        <div>
          <dt>Exam</dt>
          <dd>
            Credits are recognized only when you also take the exam ({course.examCredit.ects} ECTS). You choose which
            seminar in {course.examCredit.label} the exam belongs to.
          </dd>
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

function PracticeInfo() {
  const [open, setOpen] = useState(false);
  const [hover, setHover] = useState(false);
  const rootRef = useRef<HTMLSpanElement>(null);
  const tipRef = useRef<HTMLSpanElement>(null);
  const hoverTimer = useRef<number | null>(null);
  const [pos, setPos] = useState({ top: 0, left: 0, hidden: false });
  const shown = open || hover;

  function showTip() {
    if (hoverTimer.current) window.clearTimeout(hoverTimer.current);
    setHover(true);
  }

  function hideTip() {
    if (hoverTimer.current) window.clearTimeout(hoverTimer.current);
    hoverTimer.current = window.setTimeout(() => setHover(false), 80);
  }

  useLayoutEffect(() => {
    if (!shown) return;
    function place() {
      const icon = rootRef.current?.getBoundingClientRect();
      const tip = tipRef.current?.getBoundingClientRect();
      if (!icon || !tip) return;
      const scroll = rootRef.current?.closest(".course-scroll")?.getBoundingClientRect();
      const hidden = scroll != null && (icon.bottom < scroll.top || icon.top > scroll.bottom);
      const width = tip.width || 280;
      const height = tip.height || 0;
      let left = Math.min(Math.max(8, icon.left - 8), window.innerWidth - width - 8);
      let top = icon.bottom + 8;
      if (height > 0 && top + height > window.innerHeight - 8 && icon.top - height - 8 > 8) {
        top = icon.top - height - 8;
      }
      setPos((current) =>
        current.top === top && current.left === left && current.hidden === hidden ? current : { top, left, hidden },
      );
    }
    place();
    window.addEventListener("scroll", place, true);
    window.addEventListener("resize", place);
    return () => {
      window.removeEventListener("scroll", place, true);
      window.removeEventListener("resize", place);
    };
  }, [shown]);

  useEffect(() => {
    return () => {
      if (hoverTimer.current) window.clearTimeout(hoverTimer.current);
    };
  }, []);

  useEffect(() => {
    if (!open) return;
    function onPointerDown(event: PointerEvent) {
      const target = event.target as Node;
      if (rootRef.current?.contains(target) || tipRef.current?.contains(target)) return;
      setOpen(false);
    }
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") setOpen(false);
    }
    document.addEventListener("pointerdown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("pointerdown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [open]);

  return (
    <span ref={rootRef} className="area-info" onMouseEnter={showTip} onMouseLeave={hideTip}>
      <button
        type="button"
        aria-expanded={shown}
        aria-controls="practice-tip"
        aria-label="About Practice projects"
        onClick={(event) => {
          setOpen((current) => {
            if (current) event.currentTarget.blur();
            return !current;
          });
        }}
      >
        <InfoIcon />
      </button>
      {shown &&
        createPortal(
          <span
            id="practice-tip"
            ref={tipRef}
            className="area-tip is-fixed"
            role="tooltip"
            style={{ top: pos.top, left: pos.left, visibility: pos.hidden ? "hidden" : "visible" }}
            onMouseEnter={showTip}
            onMouseLeave={hideTip}
          >
            <span className="area-tip-card">
              <ul>
                <li>Taking one projectper semester is recommended.</li>
                <li>
                  Projects A and B are mostly group work. Project C can be planned as solo work.
                  <span>
                    Project C can be treated as preparation for the master’s thesis. If you have a project you might want
                    as a thesis topic, taking it as Project C is recommended.
                  </span>
                </li>
              </ul>
            </span>
          </span>,
          document.body,
        )}
    </span>
  );
}

function InfoIcon() {
  return (
    <svg viewBox="0 0 16 16" width="15" height="15" fill="none" stroke="currentColor" strokeWidth="1.6" aria-hidden="true">
      <circle cx="8" cy="8" r="6.2" />
      <path d="M8 7.2V11.2" strokeLinecap="round" />
      <path d="M8 4.9h.01" strokeLinecap="round" />
    </svg>
  );
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
