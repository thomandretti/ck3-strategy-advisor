import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { SnapshotCache } from "../cache.js";
import { stamp, truncate } from "../format.js";

export function registerSuccessionTool(server: McpServer, cache: SnapshotCache) {
  server.registerTool(
    "succession",
    {
      title: "Succession",
      description:
        "Heirs for the player's primary title, in order, plus succession & gender laws and rival claimants. " +
        "Note: CK3 does not store a partition preview, so which heir inherits which title is not simulated.",
      inputSchema: {},
      annotations: { readOnlyHint: true, openWorldHint: false },
    },
    async () => {
      const snap = await cache.get();
      if ("error" in snap) return { isError: true, content: [{ type: "text", text: snap.error }] };
      const s = snap.succession;

      let body = `# Succession — ${s.primaryTitle}\n`;
      body += `- Law: ${s.successionLaw} / ${s.genderLaw}\n`;

      const { shown: shownHeirs, note: heirNote } = truncate(s.heirs, 6);
      const heirLabel =
        shownHeirs.length < s.totalHeirs
          ? `showing ${shownHeirs.length} of ${s.totalHeirs}`
          : String(s.totalHeirs);
      body += `## Heirs (${heirLabel})\n`;
      shownHeirs.forEach((h, i) => {
        const tag = i === 0 ? " <- primary heir" : "";
        body += `${i + 1}. ${h.name} (${h.id})${tag}\n`;
      });
      body += heirNote;

      const { shown: shownClaim, note: claimNote } = truncate(s.claimants, 6);
      if (shownClaim.length === 0) {
        body += `\n## Rival claimants (0)\nNone.`;
      } else {
        body += `\n## Rival claimants (${s.totalClaimants})\n`;
        for (const c of shownClaim) {
          body += `- ${c.name} (${c.id})\n`;
        }
        body += claimNote;
      }

      return { content: [{ type: "text", text: stamp(snap, body) }] };
    },
  );
}
