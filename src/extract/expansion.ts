import type { Query } from "../parser.js";
import type { Localizer } from "../localization.js";
import type { War } from "./military.js";
import { resolveTitleName } from "./titleUtils.js";

export interface ClaimRef { title: string; pressed: boolean }
export interface ExpansionInfo {
  claims: ClaimRef[];
  pressedCount: number;
  deJureUnheld: { title: string }[];
  warTargets: { title: string; cbType: string }[];
}

export function extractExpansion(q: Query, loc: Localizer, wars: War[]): ExpansionInfo {

  const playerId = q.at("/played_character/character") as number;
  const aliveData = `/living/${playerId}/alive_data`;

  // Claims: alive_data/claim is an array of { title, pressed? }
  const rawClaims = (q.at(`${aliveData}/claim`) as Array<Record<string, unknown>> | undefined) ?? [];
  const claims: ClaimRef[] = rawClaims.map((c) => ({
    title: resolveTitleName(q, loc, c["title"] as number),
    pressed: c["pressed"] === true,
  }));
  const pressedCount = claims.filter((c) => c.pressed).length;

  // De jure unheld: titles in primary title's de_jure_vassals with no holder
  const primaryTitleId = (q.at(`/living/${playerId}/landed_data/domain`) as number[] | undefined)?.[0];
  const deJureVassals =
    primaryTitleId !== undefined
      ? ((q.at(`/landed_titles/landed_titles/${primaryTitleId}/de_jure_vassals`) as number[] | undefined) ?? [])
      : [];

  const deJureUnheld = deJureVassals
    .filter((tid) => q.at(`/landed_titles/landed_titles/${tid}/holder`) === undefined)
    .map((tid) => ({ title: resolveTitleName(q, loc, tid) }));

  // War targets: reuse already-extracted wars
  const warTargets = wars.map((w) => ({
    title: w.targetTitle ?? "?",
    cbType: w.cbType,
  }));

  return { claims, pressedCount, deJureUnheld, warTargets };
}
