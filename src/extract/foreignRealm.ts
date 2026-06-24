import type { Query } from "../parser.js";
import type { Localizer } from "../localization.js";
import { resolveTitleName, titleTierFromKey, type TitleTier } from "./titleUtils.js";
import { extractCharacter } from "./characters.js";

export interface AllyRef { id: number; name: string; realm: string | null }
export interface ForeignWar { side: "attacker" | "defender"; cbType: string; targetTitle: string | null }
export interface RulerRef { id: number; name: string; martial: number; gold: number | null; prestige: number | null }
export interface ForeignRealmInfo {
  titleId: number;
  realmName: string;
  tier: TitleTier;
  ruler: RulerRef;
  strength: number | null;
  currentStrength: number | null;
  liege: { id: number; name: string } | null; // null => independent
  allies: AllyRef[];
  wars: ForeignWar[];
}

function tierRank(t: TitleTier): number {
  switch (t) {
    case "empire": return 5;
    case "kingdom": return 4;
    case "duchy": return 3;
    case "county": return 2;
    case "barony": return 1;
    default: return 0;
  }
}

function charName(q: Query, id: number): string {
  return String(q.at(`/living/${id}/first_name`) ?? "unknown");
}

// Best-match title id for a free-text realm name or key.
// Ranks by match quality (exact > substring), then held > unheld, then tier.
export function findBestTitle(q: Query, loc: Localizer, name: string): number | null {
  const needle = name.trim().toLowerCase();
  if (needle === "") return null;
  const titles = q.at("/landed_titles/landed_titles") as
    | Record<string, Record<string, unknown>>
    | undefined;
  if (!titles) return null;

  let best: { id: number; quality: number; held: number; tier: number } | null = null;
  for (const [idStr, t] of Object.entries(titles)) {
    if (!t || typeof t !== "object") continue;
    const key = typeof t["key"] === "string" ? (t["key"] as string) : "";
    const dispName = typeof t["name"] === "string" ? (t["name"] as string) : "";
    const candidates = [key.toLowerCase(), dispName.toLowerCase(), loc.resolve(key).toLowerCase()];

    let quality = 0;
    if (candidates.some((c) => c === needle)) quality = 2;
    else if (candidates.some((c) => c !== "" && c.includes(needle))) quality = 1;
    if (quality === 0) continue;

    const held = typeof t["holder"] === "number" ? 1 : 0;
    const tier = tierRank(titleTierFromKey(key));
    const id = Number(idStr);
    const better =
      best === null ||
      quality > best.quality ||
      (quality === best.quality && held > best.held) ||
      (quality === best.quality && held === best.held && tier > best.tier);
    if (better) best = { id, quality, held, tier };
  }
  return best ? best.id : null;
}

export function extractForeignRealm(q: Query, loc: Localizer, name: string): ForeignRealmInfo | null {
  const titleId = findBestTitle(q, loc, name);
  if (titleId === null) return null;

  const tPath = `/landed_titles/landed_titles/${titleId}`;
  const key = (q.at(`${tPath}/key`) as string | undefined) ?? "";
  const tier = titleTierFromKey(key);
  const realmName = resolveTitleName(q, loc, titleId);

  const holderId = q.at(`${tPath}/holder`) as number | undefined;

  // Ruler — reuse the character extractor for name/martial/gold/prestige.
  let ruler: RulerRef;
  if (typeof holderId === "number") {
    const c = extractCharacter(q, loc, holderId);
    ruler = c
      ? { id: holderId, name: c.name, martial: c.skills.martial, gold: c.gold, prestige: c.prestige }
      : { id: holderId, name: "unknown", martial: 0, gold: null, prestige: null };
  } else {
    ruler = { id: -1, name: "unheld", martial: 0, gold: null, prestige: null };
  }

  // Army — same fields as the military extractor, read off the holder.
  const sRaw = typeof holderId === "number" ? q.at(`/living/${holderId}/landed_data/strength`) : undefined;
  const csRaw = typeof holderId === "number" ? q.at(`/living/${holderId}/landed_data/current_strength`) : undefined;
  const strength = typeof sRaw === "number" ? sRaw : null;
  const currentStrength = typeof csRaw === "number" ? csRaw : null;

  // Liege — de_facto_liege title's holder; null => independent.
  const liegeTitleId = q.at(`${tPath}/de_facto_liege`) as number | undefined;
  let liege: { id: number; name: string } | null = null;
  if (typeof liegeTitleId === "number") {
    const liegeHolder = q.at(`/landed_titles/landed_titles/${liegeTitleId}/holder`) as number | undefined;
    if (typeof liegeHolder === "number") liege = { id: liegeHolder, name: charName(q, liegeHolder) };
  }

  // allies/wars filled in Task 2
  const allies: AllyRef[] = [];
  const wars: ForeignWar[] = [];

  return { titleId, realmName, tier, ruler, strength, currentStrength, liege, allies, wars };
}
