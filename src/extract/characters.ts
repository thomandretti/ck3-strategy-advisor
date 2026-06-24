import type { Query } from "../parser.js";
import type { Localizer } from "../localization.js";

export interface CharacterInfo {
  id: number;
  name: string;
  skills: {
    diplomacy: number;
    martial: number;
    stewardship: number;
    intrigue: number;
    learning: number;
    prowess: number;
  };
  traits: string[];
  gold: number | null;
  prestige: number | null;
  piety: number | null;
  health: number | null;
  stress: number | null;
  primaryTitle: string | null;
  claims: { title: string; pressed: boolean }[];
}

export interface CharacterMatch {
  id: number;
  name: string;
  primaryTitle: string | null;
}

function titleName(q: Query, loc: Localizer, titleId: number): string {
  const name = q.at(`/landed_titles/landed_titles/${titleId}/name`) as string | undefined;
  if (name !== undefined) return name;
  const key = q.at(`/landed_titles/landed_titles/${titleId}/key`) as string | undefined;
  if (key !== undefined) return loc.resolve(key);
  return String(titleId);
}

export function extractCharacter(q: Query, loc: Localizer, id: number): CharacterInfo | null {
  const firstName = q.at(`/living/${id}/first_name`);
  if (firstName === undefined) return null;

  // Set trait lookup for this parse
  const traitsLookup = q.at("/traits_lookup") as string[] | null | undefined;
  loc.setTraitLookup(traitsLookup ?? null);

  // Skills: array[6] = diplomacy, martial, stewardship, intrigue, learning, prowess
  const skillArr = (q.at(`/living/${id}/skill`) as number[] | undefined) ?? [];
  const skills = {
    diplomacy: skillArr[0] ?? 0,
    martial: skillArr[1] ?? 0,
    stewardship: skillArr[2] ?? 0,
    intrigue: skillArr[3] ?? 0,
    learning: skillArr[4] ?? 0,
    prowess: skillArr[5] ?? 0,
  };

  // Traits
  const traitIndices = (q.at(`/living/${id}/traits`) as number[] | undefined) ?? [];
  const traits = traitIndices.map((idx) => loc.resolveTrait(idx));

  // Financial/status data
  const gold = (q.at(`/living/${id}/alive_data/gold`) as number | undefined) ?? null;
  const prestige = (q.at(`/living/${id}/alive_data/prestige/accumulated`) as number | undefined) ?? null;
  const piety = (q.at(`/living/${id}/alive_data/piety/accumulated`) as number | undefined) ?? null;
  const health = (q.at(`/living/${id}/alive_data/health`) as number | undefined) ?? null;
  const stress = (q.at(`/living/${id}/alive_data/stress`) as number | undefined) ?? null;

  // Primary title from domain[0]
  const domain = (q.at(`/living/${id}/landed_data/domain`) as number[] | undefined) ?? [];
  const primaryTitleId = domain[0];
  const primaryTitle = primaryTitleId !== undefined ? titleName(q, loc, primaryTitleId) : null;

  // Claims
  const rawClaims = (q.at(`/living/${id}/alive_data/claim`) as Array<{ title: number; pressed?: boolean }> | undefined) ?? [];
  const claims = rawClaims.map((c) => ({
    title: titleName(q, loc, c.title),
    pressed: c.pressed === true,
  }));

  return {
    id,
    name: String(firstName),
    skills,
    traits,
    gold,
    prestige,
    piety,
    health,
    stress,
    primaryTitle,
    claims,
  };
}

export function findCharacters(q: Query, loc: Localizer, name: string): CharacterMatch[] {
  const living = q.at("/living") as Record<string, unknown> | undefined;
  if (!living) return [];

  const lower = name.toLowerCase();
  const matches: CharacterMatch[] = [];

  for (const [key, char] of Object.entries(living)) {
    if (!char || typeof char !== "object") continue;
    const firstName = (char as Record<string, unknown>).first_name;
    if (firstName === undefined) continue;

    const firstNameStr = String(firstName);
    if (!firstNameStr.toLowerCase().includes(lower)) continue;

    const id = Number(key);

    // Set trait lookup for title resolution (may have already been set, but be safe)
    const traitsLookup = q.at("/traits_lookup") as string[] | null | undefined;
    loc.setTraitLookup(traitsLookup ?? null);

    // Resolve primary title
    const domain = (q.at(`/living/${id}/landed_data/domain`) as number[] | undefined) ?? [];
    const primaryTitleId = domain[0];
    const primaryTitle = primaryTitleId !== undefined ? titleName(q, loc, primaryTitleId) : null;

    matches.push({ id, name: firstNameStr, primaryTitle });
  }

  return matches;
}
