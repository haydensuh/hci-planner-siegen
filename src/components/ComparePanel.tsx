import { areaRank } from "../data/curriculum";
import { formatCourseTimes } from "../lib/format";
import type { Course, Version } from "../types";

type ComparePanelProps = {
  versions: Version[];
  courses: Course[];
  activeId: string;
};

export function ComparePanel({ versions, courses, activeId }: ComparePanelProps) {
  const chosen = new Set(versions.flatMap((version) => version.selectedCourseIds));
  const rows = courses
    .filter((course) => chosen.has(course.id))
    .sort((a, b) => areaRank(a.area) - areaRank(b.area) || a.name.localeCompare(b.name, "en"));

  if (rows.length === 0) {
    return <p className="compare-empty">Add courses to a version to compare combinations.</p>;
  }

  return (
    <div className="compare">
      <table>
        <caption className="visually-hidden">Selected courses across timetable versions</caption>
        <thead>
          <tr>
            <th scope="col">Course</th>
            {versions.map((version) => (
              <th key={version.id} scope="col" className={version.id === activeId ? "is-active" : undefined}>
                {version.name}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((course) => {
            const flags = versions.map((version) => version.selectedCourseIds.includes(course.id));
            const mixed = flags.some(Boolean) && flags.some((flag) => !flag);
            return (
              <tr key={course.id} className={mixed ? "is-mixed" : undefined}>
                <th scope="row">
                  <span>{course.name}</span>
                  <small>{formatCourseTimes(course)}</small>
                </th>
                {versions.map((version, index) => (
                  <td key={version.id}>
                    {flags[index] ? (
                      <span className="mark">In</span>
                    ) : (
                      <span className="miss">
                        <span className="visually-hidden">Not in this version</span>
                      </span>
                    )}
                  </td>
                ))}
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
