import type { Source, SaveRef } from "./source.js";
import type { Localizer } from "./localization.js";
import { extractGamestate, IronmanError } from "./envelope.js";
import { buildSnapshot, type Snapshot } from "./snapshot.js";
import { queryGamestate, type Query } from "./parser.js";

export class SnapshotCache {
  private current: Snapshot | null = null;
  private key = "";
  private gamestate: Buffer | null = null;
  private gamestateText: string | null = null;
  private inFlight: Promise<Snapshot | { error: string }> | null = null;
  private inFlightKey = "";
  constructor(
    private source: Source,
    readonly loc: Localizer,
  ) {}

  async get(): Promise<Snapshot | { error: string }> {
    const ref = await this.source.latest();
    if (!ref)
      return this.current ?? { error: "No CK3 save found. Save your game, then ask again." };
    const k = `${ref.path}:${ref.mtimeMs}`;
    if (k === this.key && this.current) return this.current;
    // Coalesce concurrent builds for the same save into one parse.
    if (this.inFlight && this.inFlightKey === k) return this.inFlight;
    this.inFlightKey = k;
    this.inFlight = this.build(ref, k);
    try {
      return await this.inFlight;
    } finally {
      if (this.inFlightKey === k) this.inFlight = null;
    }
  }

  private async build(ref: SaveRef, k: string): Promise<Snapshot | { error: string }> {
    try {
      const gs = extractGamestate(await this.source.read(ref));
      const snap = await buildSnapshot(gs, this.loc);
      // commit all derived state together, only on success
      this.gamestate = gs;
      this.gamestateText = null; // lazily materialized by rawGamestateText()
      this.current = snap;
      this.key = k;
      return snap;
    } catch (e) {
      if (e instanceof IronmanError) return { error: e.message };
      if (this.current) return this.current; // serve last good on transient/mid-write failure
      return { error: `Could not read save: ${(e as Error).message}` };
    }
  }

  async query<T>(fn: (q: Query) => T): Promise<T | { error: string }> {
    const snap = await this.get();
    if ("error" in snap) return { error: snap.error };
    if (!this.gamestate) return { error: "No gamestate available." };
    return queryGamestate(this.gamestate, fn);
  }

  async rawGamestate(): Promise<Buffer | { error: string }> {
    const snap = await this.get();
    if ("error" in snap) return { error: snap.error };
    if (!this.gamestate) return { error: "No gamestate available." };
    return this.gamestate;
  }

  // FIX D: convert the gamestate Buffer to text ONCE per save, not per find_character call.
  async rawGamestateText(): Promise<string | { error: string }> {
    const snap = await this.get();
    if ("error" in snap) return { error: snap.error };
    if (!this.gamestate) return { error: "No gamestate available." };
    if (this.gamestateText === null) this.gamestateText = this.gamestate.toString("utf8");
    return this.gamestateText;
  }
}
