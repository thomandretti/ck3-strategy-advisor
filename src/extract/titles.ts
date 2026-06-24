import type { Query } from "../parser.js";
import type { Localizer } from "../localization.js";
import { resolveTitleName, titleTierFromKey } from "./titleUtils.js";

export interface HeldTitle {
  id: number;
  name: string;
  deJureLiege: string | null;
}
export interface TitlesInfo {
  empires: HeldTitle[];
  kingdoms: HeldTitle[];
  duchies: HeldTitle[];
  counties: HeldTitle[];
  baronies: HeldTitle[];
  total: number;
}

export function extractTitles(q: Query, loc: Localizer): TitlesInfo {
  const playerId = q.at("/played_character/character") as number;
  const domain = (q.at(`/living/${playerId}/landed_data/domain`) as number[] | undefined) ?? [];

  const info: TitlesInfo = {
    empires: [],
    kingdoms: [],
    duchies: [],
    counties: [],
    baronies: [],
    total: 0,
  };

  for (const id of domain) {
    const key = q.at(`/landed_titles/landed_titles/${id}/key`) as string | undefined;
    const tier = titleTierFromKey(key ?? "");

    const ljId = q.at(`/landed_titles/landed_titles/${id}/de_jure_liege`);
    const deJureLiege = typeof ljId === "number" ? resolveTitleName(q, loc, ljId) : null;

    const held: HeldTitle = { id, name: resolveTitleName(q, loc, id), deJureLiege };

    switch (tier) {
      case "empire":
        info.empires.push(held);
        break;
      case "kingdom":
        info.kingdoms.push(held);
        break;
      case "duchy":
        info.duchies.push(held);
        break;
      case "county":
        info.counties.push(held);
        break;
      case "barony":
        info.baronies.push(held);
        break;
      default:
        continue; // 'other' — not expected in a player domain; skip
    }
    info.total++;
  }

  return info;
}
