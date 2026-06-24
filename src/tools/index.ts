import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { SnapshotCache } from "../cache.js";
import { registerOverview } from "./overview.js";
import { registerCharacterTools } from "./character.js";
import { registerMilitaryTool } from "./military.js";

export function registerAllTools(server: McpServer, cache: SnapshotCache) {
  registerOverview(server, cache);
  registerCharacterTools(server, cache);
  registerMilitaryTool(server, cache);
}
