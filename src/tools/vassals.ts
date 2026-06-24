import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { SnapshotCache } from "../cache.js";
import { stamp, truncate } from "../format.js";

export function registerVassalsTool(server: McpServer, cache: SnapshotCache) {
  server.registerTool(
    "vassals",
    {
      title: "Vassals",
      description:
        "Your most powerful direct vassals: military power owed, approximate opinion of you, council seat, and whether they're in a faction against you (danger flag).",
      inputSchema: {},
      annotations: { readOnlyHint: true, openWorldHint: false },
    },
    async () => {
      const snap = await cache.get();
      if ("error" in snap) return { isError: true, content: [{ type: "text", text: snap.error }] };

      const { vassals, vassalCount } = snap;
      const { shown, note } = truncate(vassals, 8);
      const k = shown.length;

      let body = `# Top vassals (showing ${k} of ${vassalCount})\n`;
      if (shown.length === 0) {
        body += "No direct vassals.\n";
      } else {
        for (const v of shown) {
          const opinionStr = v.opinion !== null ? String(v.opinion) : "?";
          const flags: string[] = [];
          if (v.councilSeat) flags.push("council");
          if (v.inFaction) flags.push("⚠ in faction");
          const flagStr = flags.length > 0 ? ", " + flags.join(", ") : "";
          body += `- ${v.name} (${v.id}): power ${v.strengthForLiege}, opinion ${opinionStr}${flagStr}\n`;
        }
        body += note;
      }

      return { content: [{ type: "text", text: stamp(snap, body) }] };
    },
  );
}
