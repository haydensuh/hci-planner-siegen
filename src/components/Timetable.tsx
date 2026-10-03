import { useMemo } from "react";
import { areaColor } from "../data/curriculum";
import { formatBlockLocation, formatCourseTitle, formatDatedSession } from "../lib/format";
import {
  formatHour,
  GRID_DAYS,
  gridBounds,
  HOUR_PX,
  layoutGrid,
  outsideLines,
  type GridBlock,
} from "../lib/schedule";
import type { Course } from "../types";

type TimetableProps = {
  selected: Course[];
  boundsCourses: Course[];
  onFocusCourse: (courseId: string) => void;
  onRemoveCourse: (courseId: string) => void;
};

export function Timetable({ selected, boundsCourses, onFocusCourse, onRemoveCourse }: TimetableProps) {
  const bounds = useMemo(() => gridBounds(boundsCourses), [boundsCourses]);
  const layout = useMemo(() => layoutGrid(selected), [selected]);
  const outside = selected.flatMap(outsideLines);
  const unscheduled = selected.filter((course) => course.schedule.length === 0);
  const hours: number[] = [];
  for (let hour = bounds.startHour; hour < bounds.endHour; hour += 1) hours.push(hour);
  const height = (bounds.endHour - bounds.startHour) * HOUR_PX;
  const hasGrid = GRID_DAYS.some((day) => (layout.get(day)?.length ?? 0) > 0);
  const areas = [...new Set(selected.map((course) => course.area))];
  const dated = selected.filter((course) => course.datedGrid);

  return (
    <>
      {dated.length > 0 && (
        <section className="notice dated-panel" aria-label="Block dates">
          <h2>Block dates</h2>
          <ul>
            {dated.map((course) => (
              <li key={course.id}>
                <p className="notice-name">{formatCourseTitle(course)}</p>
                {course.schedule.map((slot, index) => (
                  <p className="notice-meta" key={`${course.id}-${index}`}>
                    {formatDatedSession(slot)}
                  </p>
                ))}
              </li>
            ))}
          </ul>
        </section>
      )}
    <div className="timetable">
      {areas.length > 0 && (
        <ul className="legend">
          {areas.map((area) => (
            <li key={area}>
              <span style={{ background: areaColor(area) }} />
              {area}
            </li>
          ))}
        </ul>
      )}
      {hasGrid && (
        <div className="timetable-grid">
          <div className="time-col">
            <div className="day-name day-name-spacer" />
            <div className="time-body" style={{ height }}>
              {hours.map((hour) => (
                <span key={hour} className="hour-label" style={{ top: (hour - bounds.startHour) * HOUR_PX }}>
                  {formatHour(hour)}
                </span>
              ))}
              <span className="hour-label is-end" style={{ top: height }}>
                {formatHour(bounds.endHour)}
              </span>
            </div>
          </div>
          {GRID_DAYS.map((day) => (
            <div key={day} className="day-col">
              <div className="day-name">{day}</div>
              <div className="day-body" style={{ height }}>
                {hours.map((hour) => (
                  <span
                    key={hour}
                    className="hour-line"
                    style={{ top: (hour - bounds.startHour) * HOUR_PX }}
                  />
                ))}
                {(layout.get(day) ?? []).map((block) => (
                  <Block
                    key={`${block.course.id}-${block.start}-${block.end}`}
                    block={block}
                    boundsStart={bounds.startHour}
                    onFocus={onFocusCourse}
                    onRemove={onRemoveCourse}
                  />
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
      {outside.length > 0 && (
        <section className="outside">
          <h3>Outside Monday–Friday</h3>
          <ul>
            {outside.map((line, index) => (
              <li key={`${line}-${index}`}>{line}</li>
            ))}
          </ul>
        </section>
      )}
      {unscheduled.length > 0 && (
        <section className="outside">
          <h3>No time listed</h3>
          <ul>
            {unscheduled.map((course) => (
              <li key={course.id}>{formatCourseTitle(course)}</li>
            ))}
          </ul>
        </section>
      )}
    </div>
    </>
  );
}

function Block({
  block,
  boundsStart,
  onFocus,
  onRemove,
}: {
  block: GridBlock;
  boundsStart: number;
  onFocus: (courseId: string) => void;
  onRemove: (courseId: string) => void;
}) {
  const duration = block.end - block.start;
  const compact = duration <= 75;
  const location = formatBlockLocation(block.course, block.location);
  return (
    <div
      className={["block", block.conflict && "is-conflict", block.dated && "is-dated"].filter(Boolean).join(" ")}
      style={{
        top: ((block.start - boundsStart * 60) / 60) * HOUR_PX,
        height: (duration / 60) * HOUR_PX - 4,
        left: `calc(${block.lane} * (100% / ${block.laneCount}) + 3px)`,
        width: `calc(100% / ${block.laneCount} - 6px)`,
        background: areaColor(block.course.area),
      }}
    >
      <button
        type="button"
        className="block-main"
        title={[formatCourseTitle(block.course), `${block.startTime}–${block.endTime}`, location]
          .filter(Boolean)
          .join(", ")}
        onClick={() => onFocus(block.course.id)}
      >
        <span className="block-name">
          {block.course.name}
          {block.course.variant && <span className="course-variant"> ({block.course.variant})</span>}
        </span>
        <span className="block-time">
          {block.startTime}–{block.endTime}
          {block.meta ? ` · ${block.meta}` : ""}
        </span>
        {!compact && location && <span className="block-location">{location}</span>}
        {block.conflict && <span className="block-flag">Conflict</span>}
      </button>
      <button
        type="button"
        className="block-remove"
        aria-label={`Remove ${formatCourseTitle(block.course)}`}
        onClick={() => onRemove(block.course.id)}
      >
        <span aria-hidden="true">×</span>
      </button>
    </div>
  );
}
