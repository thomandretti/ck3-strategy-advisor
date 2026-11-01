/**
 * Sum the `value` of an opinion entry's `temporary_opinion`.
 * The save stores a single modifier as an object and several as an array,
 * so both shapes must be handled. Returns null when no numeric value exists.
 */
export function sumTemporaryOpinion(raw: unknown): number | null {
  const mods = Array.isArray(raw) ? raw : [raw];
  let total = 0;
  let found = false;
  for (const m of mods) {
    if (!m || typeof m !== "object") continue;
    const value = (m as Record<string, unknown>)["value"];
    if (typeof value !== "number") continue;
    total += value;
    found = true;
  }
  return found ? total : null;
}
