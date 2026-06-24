import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { SnapshotCache } from "../cache.js";
import { stamp, truncate } from "../format.js";

export function registerMilitaryTool(server: McpServer, cache: SnapshotCache) {
  server.registerTool(
    "military",
    {
      title: "Military",
      description:
        "Player's military strength (levy + total mobilised strength) and ongoing wars (side, casus belli, target, war score). Note: CK3 does not store a men-at-arms breakdown, so only realm totals are shown.",
      inputSchema: {},
      annotations: { readOnlyHint: true, openWorldHint: false },
    },
    async () => {
      const snap = await cache.get();
      if ("error" in snap) return { isError: true, content: [{ type: "text", text: snap.error }] };
      const m = snap.military;

      const levyStr = m.levy !== null ? Math.round(m.levy).toString() : "?";
      const strengthStr = m.strength !== null ? Math.round(m.strength).toString() : "?";
      const currentStr =
        m.currentStrength !== null ? Math.round(m.currentStrength).toString() : "?";

      let body = `# Military\n- Levy: ${levyStr} | Total strength: ${strengthStr} (current ${currentStr})\n`;

      const { shown, note } = truncate(m.wars, 5);
      if (shown.length === 0) {
        body += "## Wars (0)\nAt peace.";
      } else {
        body += `## Wars (${m.wars.length})\n`;
        for (const w of shown) {
          const yourScore = w.playerSide === "attacker" ? w.attackerScore : w.defenderScore;
          const theirScore = w.playerSide === "attacker" ? w.defenderScore : w.attackerScore;
          const target = w.targetTitle ?? "(unknown)";
          body +=
            `- ${w.playerSide.toUpperCase()} vs ${target} — ${w.cbType}, ` +
            `score you ${yourScore} / them ${theirScore}, since ${w.startDate}\n`;
        }
        body += note;
      }

      return { content: [{ type: "text", text: stamp(snap, body) }] };
    },
  );
}
