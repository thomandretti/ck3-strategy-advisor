import type { Query } from "../parser.js";
import type { Localizer } from "../localization.js";

/**
 * Display name for a character. The save stores `first_name` as a CK3
 * localization key (e.g. "MA_iread" for "Máiread"), so it is resolved through
 * the Localizer; without a game dir this echoes the raw key. Returns
 * `fallback` when the character has no first_name.
 */
export function characterName(q: Query, loc: Localizer, id: number, fallback = "unknown"): string {
  const raw = q.at(`/living/${id}/first_name`);
  return typeof raw === "string" ? loc.resolve(raw) : fallback;
}
