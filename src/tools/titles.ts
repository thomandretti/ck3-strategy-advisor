import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { SnapshotCache } from "../cache.js";
import type { HeldTitle } from "../extract/titles.js";
import { stamp, truncate } from "../format.js";

function plural(n: number, singular: string): string {
  return `${n} ${singular}${n === 1 ? "" : "s"}`;
}

function renderTier(body: string, heading: string, titles: HeldTitle[], cap: number): string {
  if (titles.length === 0) return body;
  body += `\n## ${heading} (${titles.length})\n`;
  const { shown, note } = truncate(titles, cap);
  for (const t of shown) {
    const liege = t.deJureLiege ? ` (de jure: ${t.deJureLiege})` : "";
    body += `- ${t.name}${liege}\n`;
  }
  body += note;
  return body;
}

export function registerTitlesTool(server: McpServer, cache: SnapshotCache) {
  server.registerTool(
    "titles",
    {
      title: "Held Titles",
      description:
        "Titles you personally hold (your domain), grouped by tier (empire/kingdom/duchy/county/barony), each with its de jure liege. For titles held by your vassals, see `vassals`.",
      inputSchema: {},
      annotations: { readOnlyHint: true, openWorldHint: false },
    },
    async () => {
      const snap = await cache.get();
      if ("error" in snap) return { isError: true, content: [{ type: "text", text: snap.error }] };

      const t = snap.titles;
      const counts = [
        plural(t.empires.length, "empire"),
        plural(t.kingdoms.length, "kingdom"),
        plural(t.duchies.length, "duchy").replace("duchys", "duchies"),
        plural(t.counties.length, "county").replace("countys", "counties"),
        plural(t.baronies.length, "barony").replace("baronys", "baronies"),
      ].filter((c) => !c.startsWith("0 "));

      let body = `# Held titles — ${counts.length ? counts.join(", ") : "none"}\n`;
      if (t.total === 0) {
        body += "No titles held.\n";
      } else {
        body = renderTier(body, "Empires", t.empires, 50);
        body = renderTier(body, "Kingdoms", t.kingdoms, 50);
        body = renderTier(body, "Duchies", t.duchies, 50);
        body = renderTier(body, "Counties", t.counties, 50);
        body = renderTier(body, "Baronies", t.baronies, 20);
      }

      return { content: [{ type: "text", text: stamp(snap, body) }] };
    },
  );
}
