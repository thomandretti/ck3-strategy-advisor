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

export function registerAllTools(server: McpServer, cache: SnapshotCache) {
  registerOverview(server, cache);
  registerCharacterTools(server, cache);
  registerMilitaryTool(server, cache);
  registerSuccessionTool(server, cache);
  registerDiplomacyTool(server, cache);
  registerVassalsTool(server, cache);
  registerFactionsTool(server, cache);
  registerExpansionTool(server, cache);
  registerTitlesTool(server, cache);
}
