export const AREAS = [
  "Basics of HCI",
  "Consolidation",
  "Practice",
  "Current Research",
  "Interdisciplinary Contexts",
  "Internship",
  "Thesis",
] as const;

export type AreaName = (typeof AREAS)[number];

export const AREA_COLORS: Record<AreaName, string> = {
  "Basics of HCI": "#1b64da",
  Consolidation: "#0a7a6a",
  Practice: "#5b45d6",
  "Current Research": "#d64000",
  "Interdisciplinary Contexts": "#0077b6",
  Internship: "#4e5968",
  Thesis: "#1a365d",
};

export function areaColor(area: string): string {
  if (area in AREA_COLORS) return AREA_COLORS[area as AreaName];
  return "#333d4b";
}

export function areaRank(area: string): number {
  const index = AREAS.indexOf(area as AreaName);
  return index === -1 ? AREAS.length : index;
}
