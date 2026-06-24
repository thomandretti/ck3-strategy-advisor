import { queryGamestate, type Query } from "./parser.js";
import type { Localizer } from "./localization.js";
import { formatCk3Date } from "./format.js";
import { extractMilitary, type MilitaryInfo } from "./extract/military.js";
import { extractSuccession, type SuccessionInfo } from "./extract/succession.js";
import { extractDiplomacy, type DiplomacyInfo } from "./extract/diplomacy.js";
import { extractFactions, extractVassals, type FactionInfo, type VassalInfo } from "./extract/vassals.js";
import { extractExpansion, type ExpansionInfo } from "./extract/expansion.js";

export interface RealmOverview {
  rulerName: string; date: string; primaryTitle: string; tier: number;
  house: string; gold: number | null; prestige: number | null; piety: number | null;
}
export interface Snapshot { date: string; parsedAt: number; overview: RealmOverview; military: MilitaryInfo; succession: SuccessionInfo; diplomacy: DiplomacyInfo; factions: FactionInfo[]; vassals: VassalInfo[]; expansion: ExpansionInfo; }

function num(v: unknown): number | null { return typeof v === "number" ? v : null; }
function str(v: unknown): string { return typeof v === "string" ? v : String(v ?? ""); }

export async function buildSnapshot(gamestate: Buffer, loc: Localizer): Promise<Snapshot> {
  return queryGamestate(gamestate, (q: Query): Snapshot => {
    loc.setTraitLookup((q.at("/traits_lookup") as string[]) ?? null);
    const date = formatCk3Date(q.at("/date"));
    const playerId = q.at("/played_character/character");
    const alive = `/living/${playerId}/alive_data`;
    const overview: RealmOverview = {
      rulerName: str(q.at("/meta_data/meta_player_name")),
      date,
      primaryTitle: str(q.at("/meta_data/meta_title_name")),
      tier: num(q.at("/meta_data/meta_player_tier")) ?? 0,
      house: str(q.at("/meta_data/meta_house_name")),
      gold: num(q.at(`${alive}/gold`)),
      prestige: num(q.at(`${alive}/prestige/accumulated`)),
      piety: num(q.at(`${alive}/piety/accumulated`)),
    };
    const military = extractMilitary(q, loc);
    const expansion = extractExpansion(q, loc, military.wars);
    const succession = extractSuccession(q, loc);
    const diplomacy = extractDiplomacy(q, loc);
    const { factions, memberIds } = extractFactions(q, loc);
    const vassals = extractVassals(q, loc, memberIds);
    return { date, parsedAt: Date.now(), overview, military, expansion, succession, diplomacy, factions, vassals };
  });
}
