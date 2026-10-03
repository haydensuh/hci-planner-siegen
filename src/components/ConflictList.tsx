import type { Conflict } from "../lib/schedule";

export function ConflictList({ conflicts }: { conflicts: Conflict[] }) {
  if (conflicts.length === 0) return null;
  return (
    <section className="conflicts" aria-label="Schedule conflicts">
      <h2>{conflicts.length === 1 ? "Schedule conflict" : "Schedule conflicts"}</h2>
      <ul>
        {conflicts.map((conflict) => (
          <li key={conflict.id}>
            <p>{conflict.aName}</p>
            <p>{conflict.aWhen}</p>
            <p>{conflict.bName}</p>
            <p>{conflict.bWhen}</p>
          </li>
        ))}
      </ul>
    </section>
  );
}
