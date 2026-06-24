import type { Query } from "../parser.js";
import type { Localizer } from "../localization.js";

// Display name for a numeric title id: current name -> localized key -> raw id.
export function resolveTitleName(q: Query, loc: Localizer, titleId: number): string {
  const name = q.at(`/landed_titles/landed_titles/${titleId}/name`) as string | undefined;
  if (name !== undefined) return name;
  const key = q.at(`/landed_titles/landed_titles/${titleId}/key`) as string | undefined;
  if (key !== undefined) return loc.resolve(key);
  return String(titleId);
}

export type TitleTier = "empire" | "kingdom" | "duchy" | "county" | "barony" | "other";

// Tier is encoded in the title key's prefix (e_/k_/d_/c_/b_).
export function titleTierFromKey(key: string): TitleTier {
  switch (key[0]) {
    case "e":
      return "empire";
    case "k":
      return "kingdom";
    case "d":
      return "duchy";
    case "c":
      return "county";
    case "b":
      return "barony";
    default:
      return "other";
  }
}
