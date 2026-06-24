#!/usr/bin/env node
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { resolveConfig, discoverSaveDir } from "./config.js";
import { SaveFileSource } from "./source.js";
import { SnapshotCache } from "./cache.js";
import { Localizer } from "./localization.js";
import { registerAllTools } from "./tools/index.js";

async function main() {
  const cfg = resolveConfig();
  const saveDir = cfg.saveDir ?? (await discoverSaveDir());
  if (!saveDir) { console.error("No CK3 save dir found. Set CK3_SAVE_DIR."); process.exit(1); }
  const cache = new SnapshotCache(new SaveFileSource({ saveDir }), new Localizer(cfg.gameDir));
  const server = new McpServer(
    { name: "ck3-strategy-advisor", version: "0.1.0" },
    { instructions: "Tools report the player's CK3 realm from their latest save. Each response is stamped with the save's in-game date and age." },
  );
  registerAllTools(server, cache);
  await server.connect(new StdioServerTransport());
}
main().catch((e) => { console.error(e); process.exit(1); });
