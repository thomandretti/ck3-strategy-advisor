import { readdir, readFile, stat } from "node:fs/promises";
import { join } from "node:path";

export interface SaveRef { path: string; mtimeMs: number; }
export interface Source {
  latest(): Promise<SaveRef | null>;
  read(ref: SaveRef): Promise<Buffer>;
}

export class SaveFileSource implements Source {
  constructor(private opts: { saveDir: string }) {}

  async latest(): Promise<SaveRef | null> {
    let names: string[];
    try {
      names = await readdir(this.opts.saveDir);
    } catch {
      return null;
    }
    const candidates = names.filter((n) => n.endsWith(".ck3") && n !== "last_save.ck3");
    let best: SaveRef | null = null;
    for (const name of candidates) {
      const path = join(this.opts.saveDir, name);
      const s = await stat(path);
      if (!best || s.mtimeMs > best.mtimeMs) best = { path, mtimeMs: s.mtimeMs };
    }
    return best;
  }

  read(ref: SaveRef): Promise<Buffer> {
    return readFile(ref.path);
  }
}
