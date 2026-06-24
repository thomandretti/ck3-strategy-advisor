import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import type { SnapshotCache } from "../cache.js";
import { extractCharacter, findCharacters } from "../extract/characters.js";
import { stamp, truncate } from "../format.js";

export function registerCharacterTools(server: McpServer, cache: SnapshotCache) {
  server.registerTool(
    "find_character",
    {
      title: "Find Character",
      description:
        "Search living characters by (partial) first name; returns ids to pass to `character`. " +
        "Best-effort: CK3 stores names in an encoded form, so matching is approximate.",
      inputSchema: { name: z.string().describe("full or partial first name") },
      annotations: { readOnlyHint: true, openWorldHint: false },
    },
    async ({ name }: { name: string }) => {
      const result = await cache.query((q) => findCharacters(q, cache.loc, name));
      if ("error" in result) return { isError: true, content: [{ type: "text", text: result.error }] };

      if (result.length === 0) {
        return { content: [{ type: "text", text: `No living character matching '${name}'.` }] };
      }

      const { shown, note } = truncate(result, 10);
      const lines = shown.map((m) => `- ${m.name} (id ${m.id}) — ${m.primaryTitle ?? "no title"}`).join("\n");
      return { content: [{ type: "text", text: lines + note }] };
    },
  );

  server.registerTool(
    "character",
    {
      title: "Character",
      description:
        "Detailed dossier for one character by id — needs an id; use `find_character` if you only have a name. " +
        "Traits, skills, gold/prestige/piety, health/stress, primary title, and claims " +
        "(pressed/unpressed; CK3 does not store strong/weak).",
      inputSchema: { id: z.number().describe("character id, e.g. from find_character") },
      annotations: { readOnlyHint: true, openWorldHint: false },
    },
    async ({ id }: { id: number }) => {
      // Get snapshot for stamping
      const snap = await cache.get();
      if ("error" in snap) return { isError: true, content: [{ type: "text", text: snap.error }] };

      const result = await cache.query((q) => extractCharacter(q, cache.loc, id));
      if (result !== null && typeof result === "object" && "error" in result) {
        return { isError: true, content: [{ type: "text", text: (result as { error: string }).error }] };
      }

      const c = result as import("../extract/characters.js").CharacterInfo | null;
      if (!c) {
        return { content: [{ type: "text", text: `No character with id ${id}.` }] };
      }
      const skillLine =
        `Dip ${c.skills.diplomacy} | Mar ${c.skills.martial} | Stw ${c.skills.stewardship} | ` +
        `Int ${c.skills.intrigue} | Lrn ${c.skills.learning} | Prw ${c.skills.prowess}`;
      const traitsLine = c.traits.length > 0 ? c.traits.join(", ") : "none";
      const claimsLine =
        c.claims.length > 0
          ? c.claims.map((cl) => `${cl.title} (${cl.pressed ? "pressed" : "unpressed"})`).join(", ")
          : "none";

      const body =
        `# ${c.name} (id ${c.id})\n` +
        `- Primary title: ${c.primaryTitle ?? "none"}\n` +
        `- Skills: ${skillLine}\n` +
        `- Traits: ${traitsLine}\n` +
        `- Gold: ${c.gold ?? "?"} | Prestige: ${c.prestige ?? "?"} | Piety: ${c.piety ?? "?"}\n` +
        `- Health: ${c.health ?? "?"} | Stress: ${c.stress ?? "?"}\n` +
        `- Claims: ${claimsLine}`;

      return { content: [{ type: "text", text: stamp(snap, body) }] };
    },
  );
}
