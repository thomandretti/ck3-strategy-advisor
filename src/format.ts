export function stamp(snapshot: { date: string; parsedAt: number }, body: string): string {
  const ageMin = Math.round((Date.now() - snapshot.parsedAt) / 60000);
  const age = ageMin <= 0 ? "just now" : `${ageMin} min ago`;
  return `_Snapshot: ${snapshot.date} (read ${age})_\n\n${body}`;
}
export function truncate<T>(items: T[], n: number): { shown: T[]; note: string } {
  if (items.length <= n) return { shown: items, note: "" };
  return { shown: items.slice(0, n), note: `\n\n_Showing ${n} of ${items.length}._` };
}
