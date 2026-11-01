import { stat } from "node:fs/promises";
import { readdir } from "node:fs/promises";
import { join } from "node:path";

export interface AdvisorConfig {
  saveDir: string | null;
  gameDir: string | null;
}

export function resolveConfig(env: NodeJS.ProcessEnv = process.env): AdvisorConfig {
  return {
    saveDir: env.CK3_SAVE_DIR ?? null,
    gameDir: env.CK3_GAME_DIR ?? null,
  };
}

const SAVE_TAIL = "Paradox Interactive/Crusader Kings III/save games";
// Windows localizes the Documents folder; OneDrive "known folder backup" moves it under OneDrive.
const DOC_FOLDERS = ["Documents", "Documentos"];

export interface DiscoverOptions {
  env?: NodeJS.ProcessEnv;
  /** WSL mount of the Windows users folder. */
  usersRoot?: string;
}

async function isDir(path: string): Promise<boolean> {
  try {
    return (await stat(path)).isDirectory();
  } catch {
    return false;
  }
}

export async function discoverSaveDir(opts: DiscoverOptions = {}): Promise<string | null> {
  const env = opts.env ?? process.env;
  const usersRoot = opts.usersRoot ?? "/mnt/c/Users";

  // Native Windows: OneDrive-redirected Documents first, then the plain profile folder.
  const home = env.USERPROFILE;
  const roots = [env.OneDrive, home && join(home, "OneDrive"), home].filter(
    (r): r is string => !!r,
  );
  for (const root of roots) {
    for (const doc of DOC_FOLDERS) {
      const candidate = join(root, doc, SAVE_TAIL);
      if (await isDir(candidate)) return candidate;
    }
  }

  // WSL: scan the Windows users mounted under /mnt/c.
  let users: string[];
  try {
    users = await readdir(usersRoot);
  } catch {
    return null;
  }
  for (const u of users) {
    const candidate = `${usersRoot}/${u}/Documents/${SAVE_TAIL}`;
    if (await isDir(candidate)) return candidate;
  }
  return null;
}
