import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { SnapshotCache } from "../cache.js";
import { registerOverview } from "./overview.js";

export function registerAllTools(server: McpServer, cache: SnapshotCache) {
  registerOverview(server, cache);
  // later tasks register additional tools here
}
