import type { Query } from "../parser.js";
import type { Localizer } from "../localization.js";

export interface FactionInfo {
  type: string; power: number | null; threshold: number | null;
  discontent: number | null; members: number; leaderName: string | null;
}
export interface VassalInfo {
  id: number; name: string; strengthForLiege: number;
  opinion: number | null; councilSeat: boolean; inFaction: boolean;
}

function num(v: unknown): number | null { return typeof v === "number" ? v : null; }

/** Returns factions targeting the player + the set of their member char ids */
export function extractFactions(q: Query, loc: Localizer): { factions: FactionInfo[]; memberIds: Set<number> } {
  void loc;
  const playerId = q.at("/played_character/character") as number;
  const factionsObj = q.at("/faction_manager/factions") as Record<string, unknown> | undefined;

  const factions: FactionInfo[] = [];
  const memberIds = new Set<number>();

  if (!factionsObj || typeof factionsObj !== "object") return { factions, memberIds };

  for (const value of Object.values(factionsObj)) {
    // Skip "none" strings (sparse placeholders)
    if (typeof value !== "object" || value === null) continue;
    const f = value as Record<string, unknown>;

    if ((f["target"] as number | undefined) !== playerId) continue;

    // Collect character member ids
    const members = f["members"] as Array<Record<string, unknown>> | undefined;
    let memberCount = 0;
    if (Array.isArray(members)) {
      memberCount = members.length;
      for (const m of members) {
        const charId = m["character"];
        if (typeof charId === "number") memberIds.add(charId);
      }
    }

    // Resolve leader name
    const leaderId = f["leader"];
    let leaderName: string | null = null;
    if (typeof leaderId === "number") {
      const raw = q.at(`/living/${leaderId}/first_name`);
      leaderName = typeof raw === "string" ? raw : null;
    }

    factions.push({
      type: typeof f["type"] === "string" ? f["type"] : String(f["type"] ?? ""),
      power: num(f["power"]),
      threshold: num(f["power_threshold"]) ?? null,
      discontent: num(f["discontent"]),
      members: memberCount,
      leaderName,
    });
  }

  return { factions, memberIds };
}

/** topN vassals by strengthForLiege; uses faction memberIds + single opinion pass */
export function extractVassals(q: Query, loc: Localizer, factionMemberIds: Set<number>, topN = 8): VassalInfo[] {
  void loc;
  const playerId = q.at("/played_character/character") as number;

  // 1. Resolve vassal contract ids from player's landed_data
  const contractIds = (q.at(`/living/${playerId}/landed_data/vassal_contracts`) as number[] | undefined) ?? [];

  // 2. For each contract, resolve the vassal character id and their strength_for_liege
  type VassalEntry = { id: number; strength: number };
  const entries: VassalEntry[] = [];
  for (const cid of contractIds) {
    const contract = q.at(`/vassal_contracts/active/${cid}`) as Record<string, unknown> | undefined;
    if (!contract || typeof contract !== "object") continue;
    const vassalId = contract["vassal"];
    if (typeof vassalId !== "number") continue;

    const sfl = q.at(`/living/${vassalId}/landed_data/strength_for_liege`);
    const strength =
      typeof sfl === "number"
        ? sfl
        : (typeof q.at(`/living/${vassalId}/landed_data/strength`) === "number"
            ? (q.at(`/living/${vassalId}/landed_data/strength`) as number)
            : 0);

    entries.push({ id: vassalId, strength });
  }

  // 3. Sort desc by strength, take topN
  entries.sort((a, b) => b.strength - a.strength);
  const topEntries = entries.slice(0, topN);
  const topIds = new Set(topEntries.map((e) => e.id));

  // 4. Council seat set
  const council = (q.at(`/living/${playerId}/landed_data/council`) as number[] | undefined) ?? [];
  const councilSet = new Set(council);

  // 5. Single pass over active_opinions — accumulate only for topN vassals targeting player
  const activeOpinions =
    (q.at("/opinions/active_opinions") as Record<string, unknown>[] | undefined) ?? [];
  const opinionMap = new Map<number, number>();
  for (const entry of activeOpinions) {
    if (!entry || typeof entry !== "object") continue;
    if ((entry["target"] as number | undefined) !== playerId) continue;
    const owner = entry["owner"] as number | undefined;
    if (typeof owner !== "number" || !topIds.has(owner)) continue;
    const tempOpinion = entry["temporary_opinion"] as Record<string, unknown> | undefined;
    const value = tempOpinion?.["value"];
    if (typeof value !== "number") continue;
    opinionMap.set(owner, (opinionMap.get(owner) ?? 0) + value);
  }

  // 6. Build final vassal list
  return topEntries.map(({ id, strength }) => {
    const raw = q.at(`/living/${id}/first_name`);
    const name = typeof raw === "string" ? raw : String(raw ?? id);
    return {
      id,
      name,
      strengthForLiege: strength,
      opinion: opinionMap.has(id) ? opinionMap.get(id)! : null,
      councilSeat: councilSet.has(id),
      inFaction: factionMemberIds.has(id),
    };
  });
}
