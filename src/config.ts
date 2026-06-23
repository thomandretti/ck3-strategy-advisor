import { stat } from "node:fs/promises";
import { readdir } from "node:fs/promises";

export interface AdvisorConfig { saveDir: string | null; gameDir: string | null; }

export function resolveConfig(env: NodeJS.ProcessEnv = process.env): AdvisorConfig {
  return {
    saveDir: env.CK3_SAVE_DIR ?? null,
    gameDir: env.CK3_GAME_DIR ?? null,
  };
}

const SAVE_TAIL = "Documents/Paradox Interactive/Crusader Kings III/save games";

export async function discoverSaveDir(): Promise<string | null> {
  const usersRoot = "/mnt/c/Users";
  let users: string[];
  try { users = await readdir(usersRoot); } catch { return null; }
  for (const u of users) {
    const candidate = `${usersRoot}/${u}/${SAVE_TAIL}`;
    try { if ((await stat(candidate)).isDirectory()) return candidate; } catch { /* skip */ }
  }
  return null;
}
