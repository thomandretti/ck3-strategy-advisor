import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import type { SnapshotCache } from "../cache.js";
import { extractForeignRealm, type ForeignRealmInfo } from "../extract/foreignRealm.js";
import { stamp } from "../format.js";

const TIER_LABEL: Record<string, string> = {
  empire: "Empire", kingdom: "Kingdom", duchy: "Duchy",
  county: "County", barony: "Barony", other: "Title",
};

export function formatForeignRealm(info: ForeignRealmInfo): string {
  const army =
    info.strength === null
      ? "not recorded"
      : `${Math.round(info.strength)}${info.currentStrength !== null ? ` (current ${Math.round(info.currentStrength)})` : ""}`;
  const liege = info.liege ? `vassal of ${info.liege.name}` : "independent";
  const allies =
    info.allies.length === 0
      ? "none"
      : info.allies.map((a) => (a.realm ? `${a.realm} (${a.name})` : a.name)).join(", ");
  const wars =
    info.wars.length === 0
      ? "none"
      : info.wars.map((w) => `${w.side} vs ${w.targetTitle ?? (w.cbType || "?")}`).join(", ");

  return (
    `# ${info.realmName} (${TIER_LABEL[info.tier]})\n` +
    `- Ruler: ${info.ruler.name} (id ${info.ruler.id}) — Mar ${info.ruler.martial} | ` +
    `Gold ${info.ruler.gold ?? "?"} | Prestige ${info.ruler.prestige ?? "?"}\n` +
    `- Army: ${army}\n` +
    `- Liege: ${liege}\n` +
    `- Allies: ${allies}\n` +
    `- Wars: ${wars}`
  );
}

export function registerForeignRealmTool(server: McpServer, cache: SnapshotCache) {
  server.registerTool(
    "foreign_realm",
    {
      title: "Foreign Realm",
      description:
        'Look up any realm by name or title key (e.g. "Scotland", "k_france") — its ruler, ' +
        "army strength, allies, liege, and active wars. For your own realm use `realm_overview`.",
      inputSchema: { name: z.string().describe("realm name or title key, full or partial") },
      annotations: { readOnlyHint: true, openWorldHint: false },
    },
    async ({ name }: { name: string }) => {
      const snap = await cache.get();
      if ("error" in snap) return { isError: true, content: [{ type: "text", text: snap.error }] };

      const result = await cache.query((q) => extractForeignRealm(q, cache.loc, name));
      if (result !== null && typeof result === "object" && "error" in result) {
        return { isError: true, content: [{ type: "text", text: (result as { error: string }).error }] };
      }
      const info = result as ForeignRealmInfo | null;
      if (!info) {
        return { content: [{ type: "text", text: stamp(snap, `No realm matching '${name}'.`) }] };
      }
      return { content: [{ type: "text", text: stamp(snap, formatForeignRealm(info)) }] };
    },
  );
}
