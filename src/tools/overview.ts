import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { SnapshotCache } from "../cache.js";
import { stamp } from "../format.js";

export function registerOverview(server: McpServer, cache: SnapshotCache) {
  server.registerTool(
    "realm_overview",
    {
      title: "Realm Overview",
      description:
        "Snapshot of the player's ruler and realm: name, primary title & tier, house, gold, prestige, piety, and in-game date. Start here for 'what's my situation'. For military/wars use `military`; for heirs use `succession`.",
      inputSchema: {},
      annotations: { readOnlyHint: true, openWorldHint: false },
    },
    async () => {
      const snap = await cache.get();
      if ("error" in snap) return { isError: true, content: [{ type: "text", text: snap.error }] };
      const o = snap.overview;
      const body =
        `# ${o.rulerName} — ${o.primaryTitle} (tier ${o.tier})\n` +
        `- House: ${o.house}\n` +
        `- Gold: ${o.gold ?? "?"} | Prestige: ${o.prestige ?? "?"} | Piety: ${o.piety ?? "?"}`;
      return { content: [{ type: "text", text: stamp(snap, body) }] };
    },
  );
}
