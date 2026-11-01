import type { Query } from "../parser.js";
import type { Localizer } from "../localization.js";
import { formatCk3Date } from "../format.js";
import { forEachRelation } from "./scan.js";
import { sumTemporaryOpinion } from "./opinion.js";
import { characterName } from "./names.js";

export interface DipRef {
  id: number;
  name: string;
}
export interface TruceRef {
  id: number;
  name: string;
  until: string;
  result: string;
}
export interface ThreatRef {
  id: number;
  name: string;
  opinion: number;
}
export interface DiplomacyInfo {
  independent: boolean;
  alliances: DipRef[];
  truces: TruceRef[];
  hostile: ThreatRef[]; // top-N lowest summed opinion of the player
}

const HOSTILE_CAP = 5;

export function extractDiplomacy(q: Query, loc: Localizer): DiplomacyInfo {
  const playerId = q.at("/played_character/character") as number;

  // Independent: domain[0] has no de_facto_liege on the title
  const domain = (q.at(`/living/${playerId}/landed_data/domain`) as number[] | undefined) ?? [];
  const primaryId: number | undefined = domain[0];
  const independent =
    primaryId === undefined
      ? true
      : q.at(`/landed_titles/landed_titles/${primaryId}/de_facto_liege`) === undefined;

  const alliances: DipRef[] = [];
  const truces: TruceRef[] = [];

  forEachRelation(q, playerId, (otherId, entry) => {
    // Alliance
    if (entry["alliances"] != null) {
      alliances.push({ id: otherId, name: characterName(q, loc, otherId) });
    }
    // Truces — emit at most ONE per relation entry (prefer truce_0, fall back to truce_1)
    const truceSlot =
      (entry["truce_0"] as Record<string, unknown> | undefined) ??
      (entry["truce_1"] as Record<string, unknown> | undefined);
    if (truceSlot && typeof truceSlot === "object") {
      truces.push({
        id: otherId,
        name: characterName(q, loc, otherId),
        until: formatCk3Date(truceSlot["date"]),
        result: typeof truceSlot["result"] === "string" ? truceSlot["result"] : "?",
      });
    }
  });

  // Single pass over active_opinions: sum temporary_opinion.value per owner (of the player)
  const activeOpinions =
    (q.at("/opinions/active_opinions") as Record<string, unknown>[] | undefined) ?? [];

  const opinionMap = new Map<number, number>();
  for (const entry of activeOpinions) {
    if (!entry || typeof entry !== "object") continue;
    if ((entry["target"] as number | undefined) !== playerId) continue;
    const owner = entry["owner"] as number | undefined;
    if (typeof owner !== "number") continue;
    const value = sumTemporaryOpinion(entry["temporary_opinion"]);
    if (value === null) continue;
    opinionMap.set(owner, (opinionMap.get(owner) ?? 0) + value);
  }

  // Take the N most-negative (hostile) owners; filter to negative only
  const hostile: ThreatRef[] = Array.from(opinionMap.entries())
    .filter(([, opinion]) => opinion < 0)
    .sort(([, a], [, b]) => a - b)
    .slice(0, HOSTILE_CAP)
    .map(([id, opinion]) => ({ id, name: characterName(q, loc, id), opinion }));

  return { independent, alliances, truces, hostile };
}
