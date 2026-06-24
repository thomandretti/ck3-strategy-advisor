import { open, readdir, readFile, stat } from "node:fs/promises";
import { join } from "node:path";
import { detectFormat } from "./envelope.js";

export interface SaveRef {
  path: string;
  mtimeMs: number;
}
export interface Source {
  latest(): Promise<SaveRef | null>;
  read(ref: SaveRef): Promise<Buffer>;
}

// detectFormat only needs the "SAV" header + plaintext meta region; the first
// 256 bytes are enough, so we avoid reading whole multi-MB saves just to pick.
async function readHeader(path: string, bytes = 256): Promise<Buffer> {
  const fh = await open(path, "r");
  try {
    const buf = Buffer.alloc(bytes);
    const { bytesRead } = await fh.read(buf, 0, bytes, 0);
    return buf.subarray(0, bytesRead);
  } finally {
    await fh.close();
  }
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
    const candidates: SaveRef[] = [];
    for (const name of names) {
      if (!name.endsWith(".ck3") || name === "last_save.ck3") continue;
      const path = join(this.opts.saveDir, name);
      const s = await stat(path);
      candidates.push({ path, mtimeMs: s.mtimeMs });
    }
    if (candidates.length === 0) return null;
    candidates.sort((a, b) => b.mtimeMs - a.mtimeMs); // newest first

    // Prefer the newest *parseable* save. CK3 autosaves use the binary token
    // format regardless of Ironman, and are usually the newest file — picking
    // by mtime alone lets a binary autosave shadow a readable manual save.
    for (const ref of candidates) {
      try {
        if (detectFormat(await readHeader(ref.path)) === "text") return ref;
      } catch {
        // unreadable (e.g. mid-write) — try the next candidate
      }
    }
    // No text save found — fall back to the newest so the caller still surfaces
    // the friendly binary/Ironman message rather than "no save found".
    // candidates is non-empty here (guarded by the length check above), so
    // [0] is always present; the newest save after sorting.
    return candidates[0]!;
  }

  read(ref: SaveRef): Promise<Buffer> {
    return readFile(ref.path);
  }
}
