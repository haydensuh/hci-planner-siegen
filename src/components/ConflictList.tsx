import type { Conflict } from "../lib/schedule";

export function ConflictList({ conflicts }: { conflicts: Conflict[] }) {
  if (conflicts.length === 0) return null;
  return (
    <section className="notice conflicts" aria-label="Schedule conflicts">
      <h2>{conflicts.length === 1 ? "Schedule conflict" : "Schedule conflicts"}</h2>
      <ul>
        {conflicts.map((conflict) => (
          <li key={conflict.id}>
            <p className="notice-name">{conflict.aName}</p>
            <p className="notice-meta">{conflict.aWhen}</p>
            <p className="notice-name">{conflict.bName}</p>
            <p className="notice-meta">{conflict.bWhen}</p>
          </li>
        ))}
      </ul>
    </section>
  );
}
