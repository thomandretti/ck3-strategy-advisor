import type { Query } from "../parser.js";

// Iterate active_relations entries that involve `subjectId`, invoking
// `fn(otherId, entry)` for each. The boilerplate (loading the array, skipping
// non-object entries, matching first/second, computing the "other" id) is shared
// by the diplomacy (player) and foreign_realm (any ruler) extractors; each caller
// reads whichever fields it needs off `entry`.
export function forEachRelation(
  q: Query,
  subjectId: number,
  fn: (otherId: number, entry: Record<string, unknown>) => void,
): void {
  const rels =
    (q.at("/relations/active_relations") as Record<string, unknown>[] | undefined) ?? [];
  for (const entry of rels) {
    if (!entry || typeof entry !== "object") continue;
    const first = entry["first"] as number | undefined;
    const second = entry["second"] as number | undefined;
    if (first !== subjectId && second !== subjectId) continue;
    const otherId = (first === subjectId ? second : first) as number;
    fn(otherId, entry);
  }
}

// Iterate active_wars in which `subjectId` is a participant, invoking
// `fn(side, war)`. Shared by the military (player) and foreign_realm (any ruler)
// extractors; each caller reads whichever fields it needs off `war`.
export function forEachWar(
  q: Query,
  subjectId: number,
  fn: (side: "attacker" | "defender", war: Record<string, unknown>) => void,
): void {
  const activeWars = q.at("/wars/active_wars") as Record<string, unknown> | undefined;
  if (!activeWars || typeof activeWars !== "object") return;
  for (const warValue of Object.values(activeWars)) {
    if (!warValue || typeof warValue !== "object") continue;
    const war = warValue as Record<string, unknown>;
    const attP =
      ((war["attacker"] as Record<string, unknown> | undefined)?.["participants"] as
        | Array<{ character: number }>
        | undefined) ?? [];
    const defP =
      ((war["defender"] as Record<string, unknown> | undefined)?.["participants"] as
        | Array<{ character: number }>
        | undefined) ?? [];
    const isAtt = attP.some((p) => p.character === subjectId);
    const isDef = !isAtt && defP.some((p) => p.character === subjectId);
    if (!isAtt && !isDef) continue;
    fn(isAtt ? "attacker" : "defender", war);
  }
}
