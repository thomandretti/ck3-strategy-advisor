import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { SnapshotCache } from "../cache.js";
import { stamp, truncate } from "../format.js";

export function registerFactionsTool(server: McpServer, cache: SnapshotCache) {
  server.registerTool(
    "factions",
    {
      title: "Factions",
      description:
        "Factions currently targeting you: type, strength vs. the threshold that triggers their demand (peasant factions use discontent), member count, and leader.",
      inputSchema: {},
      annotations: { readOnlyHint: true, openWorldHint: false },
    },
    async () => {
      const snap = await cache.get();
      if ("error" in snap) return { isError: true, content: [{ type: "text", text: snap.error }] };

      const { factions } = snap;
      let body: string;

      if (factions.length === 0) {
        body = "No factions against you.\n";
      } else {
        const { shown, note } = truncate(factions, 8);
        body = `# Factions against you (${factions.length})\n`;
        for (const f of shown) {
          const powerStr =
            f.discontent !== null && f.threshold === null
              ? `discontent ${f.discontent}`
              : `power ${f.power ?? "?"}/${f.threshold ?? "?"}`;
          const leaderStr = f.leaderName ?? "?";
          body += `- ${f.type}: ${powerStr} — ${f.members} members, leader ${leaderStr}\n`;
        }
        body += note;
      }

      return { content: [{ type: "text", text: stamp(snap, body) }] };
    },
  );
}
