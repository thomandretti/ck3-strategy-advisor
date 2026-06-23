import { queryGamestate, type Query } from "./parser.js";
import type { Localizer } from "./localization.js";

export interface RealmOverview {
  rulerName: string; date: string; primaryTitle: string; tier: number;
  house: string; gold: number | null; prestige: number | null; piety: number | null;
}
export interface Snapshot { date: string; parsedAt: number; overview: RealmOverview; }

function num(v: unknown): number | null { return typeof v === "number" ? v : null; }
function str(v: unknown): string { return typeof v === "string" ? v : String(v ?? ""); }

// `/date` parses to a JS Date (unquoted in real saves); format to CK3 "Y.M.D".
// Fall back to a quote-stripped string if a save ever stores it as a string.
function formatDate(v: unknown): string {
  if (v instanceof Date) return `${v.getUTCFullYear()}.${v.getUTCMonth() + 1}.${v.getUTCDate()}`;
  return str(v).replace(/"/g, "");
}

export async function buildSnapshot(gamestate: Buffer, loc: Localizer): Promise<Snapshot> {
  return queryGamestate(gamestate, (q: Query): Snapshot => {
    loc.setTraitLookup((q.at("/traits_lookup") as string[]) ?? null);
    const date = formatDate(q.at("/date"));
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
    return { date, parsedAt: Date.now(), overview };
  });
}
