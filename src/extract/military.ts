import type { Query } from "../parser.js";
import type { Localizer } from "../localization.js";
import { formatCk3Date } from "../format.js";

export interface War {
  playerSide: "attacker" | "defender";
  cbType: string;
  targetTitle: string | null;
  attackerScore: number;
  defenderScore: number;
  startDate: string;
}

export interface MilitaryInfo {
  levy: number | null;
  strength: number | null;
  currentStrength: number | null;
  strengthWithoutHires: number | null;
  wars: War[];
}

function num(v: unknown): number | null {
  return typeof v === "number" ? v : null;
}

function titleName(q: Query, titleId: number): string | null {
  const name = q.at(`/landed_titles/landed_titles/${titleId}/name`);
  if (typeof name === "string") return name;
  const key = q.at(`/landed_titles/landed_titles/${titleId}/key`);
  if (typeof key === "string") return key;
  return null;
}

export function extractMilitary(q: Query, loc: Localizer): MilitaryInfo {
  void loc; // reserved for future localisation
  const playerId = q.at("/played_character/character") as number;
  const landedData = `/living/${playerId}/landed_data`;

  const levy = num(q.at(`${landedData}/levy`));
  const strength = num(q.at(`${landedData}/strength`));
  const currentStrength = num(q.at(`${landedData}/current_strength`));
  const strengthWithoutHires = num(q.at(`${landedData}/strength_without_hires`));

  const activeWars = q.at("/wars/active_wars") as Record<string, unknown> | undefined;
  const wars: War[] = [];

  if (activeWars && typeof activeWars === "object") {
    for (const [, warValue] of Object.entries(activeWars)) {
      // Skip tombstoned "none" entries
      if (!warValue || typeof warValue !== "object") continue;

      const war = warValue as Record<string, unknown>;

      // Check attacker/defender participants for the player
      const attackerData = war["attacker"] as Record<string, unknown> | undefined;
      const defenderData = war["defender"] as Record<string, unknown> | undefined;

      const attackerParticipants = (
        attackerData?.["participants"] as Array<{ character: number }> | undefined
      ) ?? [];
      const defenderParticipants = (
        defenderData?.["participants"] as Array<{ character: number }> | undefined
      ) ?? [];

      const isAttacker = attackerParticipants.some((p) => p.character === playerId);
      const isDefender = !isAttacker && defenderParticipants.some((p) => p.character === playerId);

      if (!isAttacker && !isDefender) continue;

      const playerSide: "attacker" | "defender" = isAttacker ? "attacker" : "defender";

      const cb = war["casus_belli"] as Record<string, unknown> | undefined;
      const cbType = typeof cb?.["type"] === "string" ? cb["type"] : "";

      const targetedTitles = (cb?.["targeted_titles"] as number[] | undefined) ?? [];
      const firstTitleId = targetedTitles[0];
      const targetTitle = firstTitleId !== undefined ? titleName(q, firstTitleId) : null;

      const attackerScore = num(attackerData?.["ticking_war_score"]) ?? 0;
      const defenderScore = num(defenderData?.["ticking_war_score"]) ?? 0;

      const startDate = formatCk3Date(war["start_date"]);

      wars.push({ playerSide, cbType, targetTitle, attackerScore, defenderScore, startDate });
    }
  }

  return { levy, strength, currentStrength, strengthWithoutHires, wars };
}
