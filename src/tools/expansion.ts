import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { SnapshotCache } from "../cache.js";
import { stamp, truncate } from "../format.js";

export function registerExpansionTool(server: McpServer, cache: SnapshotCache) {
  server.registerTool(
    "expansion",
    {
      title: "Expansion",
      description:
        "Stored expansion levers: your title claims (pressed/unpressed — CK3 does not store strong/weak), " +
        "de jure titles in your realm that are currently unheld, and the targets of your ongoing wars. " +
        "This lists STORED data, not a full computed enumeration of every possible casus belli.",
      inputSchema: {},
      annotations: { readOnlyHint: true, openWorldHint: false },
    },
    async () => {
      try {
        const snap = await cache.get();
        if ("error" in snap) return { isError: true, content: [{ type: "text", text: snap.error }] };
        const e = snap.expansion;

        let body = "# Expansion\n";

        // Claims
        const { shown: shownClaims, note: claimsNote } = truncate(e.claims, 10);
        if (shownClaims.length === 0) {
          body += `## Claims (0)\nNo claims.\n`;
        } else {
          body += `## Claims (${e.claims.length}, ${e.pressedCount} pressed)\n`;
          for (const c of shownClaims) {
            body += `- ${c.title} (${c.pressed ? "pressed" : "unpressed"})\n`;
          }
          body += claimsNote;
        }

        // Unheld de jure titles
        if (e.deJureUnheld.length > 0) {
          const { shown: shownDJ, note: djNote } = truncate(e.deJureUnheld, 10);
          body += `## Unheld de jure titles (${e.deJureUnheld.length})\n`;
          for (const t of shownDJ) {
            body += `- ${t.title}\n`;
          }
          body += djNote;
        } else {
          body += `## Unheld de jure titles (0)\nNone.\n`;
        }

        // Ongoing war targets
        if (e.warTargets.length > 0) {
          const { shown: shownWT, note: wtNote } = truncate(e.warTargets, 10);
          body += `## Ongoing war targets (${e.warTargets.length})\n`;
          for (const t of shownWT) {
            body += `- ${t.title} (${t.cbType})\n`;
          }
          body += wtNote;
        }

        return { content: [{ type: "text", text: stamp(snap, body) }] };
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        return { isError: true, content: [{ type: "text", text: msg }] };
      }
    },
  );
}
