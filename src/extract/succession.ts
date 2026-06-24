import type { Query } from "../parser.js";
import type { Localizer } from "../localization.js";
import { resolveTitleName } from "./titleUtils.js";

export interface HeirRef { id: number; name: string }
export interface SuccessionInfo {
  primaryTitle: string;
  primaryTitleId: number | null;
  successionLaw: string;
  genderLaw: string;
  heirs: HeirRef[];
  totalHeirs: number;
  claimants: HeirRef[];
  totalClaimants: number;
}

const HEIR_CAP = 6;
const CLAIMANT_CAP = 6;

function resolveCharName(q: Query, id: number): string {
  return String(q.at(`/living/${id}/first_name`) ?? "unknown");
}

export function extractSuccession(q: Query, loc: Localizer): SuccessionInfo {
  const playerId = q.at("/played_character/character") as number;
  const landedData = `/living/${playerId}/landed_data`;

  // Primary title: domain[0]
  const domain = (q.at(`${landedData}/domain`) as number[] | undefined) ?? [];
  const primaryTitleId: number | null = domain.length > 0 ? domain[0] : null;

  const primaryTitle: string =
    primaryTitleId !== null
      ? resolveTitleName(q, loc, primaryTitleId)
      : "unknown";

  // Laws
  const laws = (q.at(`${landedData}/laws`) as string[] | undefined) ?? [];
  const successionLaw =
    laws.find((l) => l.endsWith("_succession_law")) ?? "unknown";
  const genderLaw =
    laws.find((l) => /_(preference|only)_law$/.test(l) || l === "gender_equal_law") ?? "unknown";

  // Heirs from landed_data/succession
  const successionIds = (q.at(`${landedData}/succession`) as number[] | undefined) ?? [];
  const totalHeirs = successionIds.length;
  const heirs: HeirRef[] = successionIds.slice(0, HEIR_CAP).map((id) => ({
    id,
    name: resolveCharName(q, id),
  }));

  // Resolve law strings through localizer (echoes raw key when no game dir)
  const resolvedSuccessionLaw = loc.resolve(successionLaw);
  const resolvedGenderLaw = loc.resolve(genderLaw);

  // Claimants from the primary title's claim array
  const claimantIds: number[] =
    primaryTitleId !== null
      ? ((q.at(`/landed_titles/landed_titles/${primaryTitleId}/claim`) as number[] | undefined) ?? [])
      : [];
  const totalClaimants = claimantIds.length;
  const claimants: HeirRef[] = claimantIds.slice(0, CLAIMANT_CAP).map((id) => ({
    id,
    name: resolveCharName(q, id),
  }));

  return {
    primaryTitle,
    primaryTitleId,
    successionLaw: resolvedSuccessionLaw,
    genderLaw: resolvedGenderLaw,
    heirs,
    totalHeirs,
    claimants,
    totalClaimants,
  };
}
