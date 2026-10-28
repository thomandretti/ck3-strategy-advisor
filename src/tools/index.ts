import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { SnapshotCache } from "../cache.js";
import { registerOverview } from "./overview.js";
import { registerCharacterTools } from "./character.js";
import { registerMilitaryTool } from "./military.js";
import { registerSuccessionTool } from "./succession.js";
import { registerDiplomacyTool } from "./diplomacy.js";
import { registerVassalsTool } from "./vassals.js";
import { registerFactionsTool } from "./factions.js";
import { registerExpansionTool } from "./expansion.js";
import { registerTitlesTool } from "./titles.js";
import { registerForeignRealmTool } from "./foreignRealm.js";

type ToolResult = { content: { type: string; text?: string }[] };

// Tool output is built from the save's raw names; decode the escaped ones ("BeorhtflE_d" ->
// "Beorhtflæd") in one place instead of in every extractor.
function withDecodedNames(server: McpServer, cache: SnapshotCache, register: () => void) {
  const target = server as unknown as { registerTool: (...args: unknown[]) => unknown };
  const original = target.registerTool;
  target.registerTool = (name, config, cb) =>
    original.call(server, name, config, async (...args: unknown[]) => {
      const result = (await (cb as (...a: unknown[]) => Promise<ToolResult>)(
        ...args,
      )) as ToolResult;
      return {
        ...result,
        content: result.content.map((c) =>
          c.type === "text" && typeof c.text === "string"
            ? { ...c, text: cache.loc.decodeNames(c.text) }
            : c,
        ),
      };
    });
  try {
    register();
  } finally {
    target.registerTool = original;
  }
}

export function registerAllTools(server: McpServer, cache: SnapshotCache) {
  withDecodedNames(server, cache, () => registerEach(server, cache));
}

function registerEach(server: McpServer, cache: SnapshotCache) {
  registerOverview(server, cache);
  registerCharacterTools(server, cache);
  registerMilitaryTool(server, cache);
  registerSuccessionTool(server, cache);
  registerDiplomacyTool(server, cache);
  registerVassalsTool(server, cache);
  registerFactionsTool(server, cache);
  registerExpansionTool(server, cache);
  registerTitlesTool(server, cache);
  registerForeignRealmTool(server, cache);
}
