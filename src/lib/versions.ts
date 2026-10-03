export function nextVersionName(existing: string[]): string {
  for (let index = 0; index < 26; index += 1) {
    const name = `Version ${String.fromCharCode(65 + index)}`;
    if (!existing.includes(name)) return name;
  }
  let count = existing.length + 1;
  while (existing.includes(`Version ${count}`)) count += 1;
  return `Version ${count}`;
}

export function duplicateName(name: string, existing: string[]): string {
  const base = `${name} copy`;
  if (!existing.includes(base)) return base;
  let count = 2;
  while (existing.includes(`${base} ${count}`)) count += 1;
  return `${base} ${count}`;
}
