import { expect, test } from "vitest";
import { mkdtempSync, writeFileSync, utimesSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { SaveFileSource } from "../src/source.js";
import { SnapshotCache } from "../src/cache.js";
import { Localizer } from "../src/localization.js";
import { makeTextEnvelope } from "./fixtures/make-envelope.js";

const GS = readFileSync(fileURLToPath(new URL("./fixtures/mini-gamestate.txt", import.meta.url)), "utf8");

test("cache builds once, then serves until mtime changes", async () => {
  const dir = mkdtempSync(join(tmpdir(), "ck3-"));
  const file = join(dir, "game.ck3");
  writeFileSync(file, makeTextEnvelope(GS));
  utimesSync(file, new Date(1000), new Date(1000));
  const cache = new SnapshotCache(new SaveFileSource({ saveDir: dir }), new Localizer(null));
  const a = await cache.get();
  const b = await cache.get();
  expect("overview" in a && a.overview.rulerName).toBe("Emperor Jenec");
  expect(a).toBe(b); // same cached object, no re-parse
});

test("cache reports an error when no save exists", async () => {
  const dir = mkdtempSync(join(tmpdir(), "ck3-"));
  const cache = new SnapshotCache(new SaveFileSource({ saveDir: dir }), new Localizer(null));
  expect("error" in (await cache.get())).toBe(true);
});

test("concurrent cold-cache gets coalesce into a single build (same object reference)", async () => {
  const dir = mkdtempSync(join(tmpdir(), "ck3-"));
  const file = join(dir, "game.ck3");
  writeFileSync(file, makeTextEnvelope(GS));
  utimesSync(file, new Date(1000), new Date(1000));
  const cache = new SnapshotCache(new SaveFileSource({ saveDir: dir }), new Localizer(null));
  const [a, b, c] = await Promise.all([cache.get(), cache.get(), cache.get()]);
  expect(a === b && b === c).toBe(true); // single build shared across all three callers
});
