import type { Source } from "./source.js";
import type { Localizer } from "./localization.js";
import { extractGamestate, IronmanError } from "./envelope.js";
import { buildSnapshot, type Snapshot } from "./snapshot.js";
import { queryGamestate, type Query } from "./parser.js";

export class SnapshotCache {
  private current: Snapshot | null = null;
  private key = "";
  private gamestate: Buffer | null = null;
  constructor(private source: Source, readonly loc: Localizer) {}

  async get(): Promise<Snapshot | { error: string }> {
    const ref = await this.source.latest();
    if (!ref) return this.current ?? { error: "No CK3 save found. Save your game, then ask again." };
    const k = `${ref.path}:${ref.mtimeMs}`;
    if (k === this.key && this.current) return this.current;
    try {
      const gs = extractGamestate(await this.source.read(ref));
      this.gamestate = gs; // retain before buildSnapshot in case it throws
      this.current = await buildSnapshot(gs, this.loc);
      this.key = k;
      return this.current;
    } catch (e) {
      if (e instanceof IronmanError) return { error: e.message };
      if (this.current) return this.current; // serve last good on transient/mid-write failure
      return { error: `Could not read save: ${(e as Error).message}` };
    }
  }

  async query<T>(fn: (q: Query) => T): Promise<T | { error: string }> {
    const snap = await this.get(); // refreshes this.gamestate as a side effect
    if ("error" in snap) return { error: snap.error };
    if (!this.gamestate) return { error: "No gamestate available." };
    return queryGamestate(this.gamestate, fn);
  }
}
