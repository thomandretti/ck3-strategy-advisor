import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { SnapshotCache } from "../cache.js";
import { stamp, truncate } from "../format.js";

export function registerDiplomacyTool(server: McpServer, cache: SnapshotCache) {
  server.registerTool(
    "diplomacy",
    {
      title: "Diplomacy",
      description:
        "Active alliances and truces, independence status, and the characters with the most negative opinion of you (approximate, from stored opinion modifiers). " +
        "Does not include marriage candidates or neighbour-opinion (not stored in the save).",
      inputSchema: {},
      annotations: { readOnlyHint: true, openWorldHint: false },
    },
    async () => {
      const snap = await cache.get();
      if ("error" in snap) return { isError: true, content: [{ type: "text", text: snap.error }] };
      const d = snap.diplomacy;

      const statusLabel = d.independent ? "independent" : "vassal";
      let body = `# Diplomacy (${statusLabel})\n`;

      const { shown: shownAlliances, note: allianceNote } = truncate(d.alliances, 5);
      body += `## Alliances (${d.alliances.length})\n`;
      if (shownAlliances.length === 0) {
        body += "None.\n";
      } else {
        for (const a of shownAlliances) {
          body += `- ${a.name} (${a.id})\n`;
        }
        body += allianceNote;
      }

      const { shown: shownTruces, note: truceNote } = truncate(d.truces, 5);
      body += `## Truces (${d.truces.length})\n`;
      if (shownTruces.length === 0) {
        body += "None.\n";
      } else {
        for (const t of shownTruces) {
          body += `- ${t.name} (${t.id}) — until ${t.until} (${t.result})\n`;
        }
        body += truceNote;
      }

      const { shown: shownHostile, note: hostileNote } = truncate(d.hostile, 5);
      body += `## Most hostile toward you (approx)\n`;
      if (shownHostile.length === 0) {
        body += "None.\n";
      } else {
        for (const h of shownHostile) {
          body += `- ${h.name} (${h.id}): ${h.opinion}\n`;
        }
        body += hostileNote;
      }

      return { content: [{ type: "text", text: stamp(snap, body) }] };
    },
  );
}
