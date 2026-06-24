import { expect, test } from "vitest";
import { mkdtempSync, writeFileSync, utimesSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { SaveFileSource } from "../src/source.js";
import { makeTextEnvelope, makeBinaryEnvelope } from "./fixtures/make-envelope.js";

test("latest() returns the newest .ck3 and ignores last_save.ck3", async () => {
  const dir = mkdtempSync(join(tmpdir(), "ck3-"));
  writeFileSync(join(dir, "old.ck3"), "a");
  writeFileSync(join(dir, "new.ck3"), "b");
  writeFileSync(join(dir, "last_save.ck3"), "c");
  utimesSync(join(dir, "old.ck3"), new Date(1000), new Date(1000));
  utimesSync(join(dir, "new.ck3"), new Date(9000), new Date(9000));
  utimesSync(join(dir, "last_save.ck3"), new Date(99999), new Date(99999));

  const src = new SaveFileSource({ saveDir: dir });
  const ref = await src.latest();
  expect(ref?.path.endsWith("new.ck3")).toBe(true);
  expect((await src.read(ref!)).toString()).toBe("b");
});

test("latest() skips a newer binary autosave for an older parseable save", async () => {
  // CK3 autosaves use the binary token format regardless of Ironman, and are
  // usually the newest file. latest() must pick the newest *text* save instead.
  const dir = mkdtempSync(join(tmpdir(), "ck3-"));
  writeFileSync(join(dir, "manual.ck3"), makeTextEnvelope("gamestate={}"));
  writeFileSync(join(dir, "autosave.ck3"), makeBinaryEnvelope());
  utimesSync(join(dir, "manual.ck3"), new Date(1000), new Date(1000));
  utimesSync(join(dir, "autosave.ck3"), new Date(9000), new Date(9000));

  const ref = await new SaveFileSource({ saveDir: dir }).latest();
  expect(ref?.path.endsWith("manual.ck3")).toBe(true);
});

test("latest() falls back to the newest save when none are parseable", async () => {
  // No text save present — return the newest anyway so the caller surfaces the
  // friendly binary/Ironman message rather than "no save found".
  const dir = mkdtempSync(join(tmpdir(), "ck3-"));
  writeFileSync(join(dir, "old.ck3"), makeBinaryEnvelope());
  writeFileSync(join(dir, "new.ck3"), makeBinaryEnvelope());
  utimesSync(join(dir, "old.ck3"), new Date(1000), new Date(1000));
  utimesSync(join(dir, "new.ck3"), new Date(9000), new Date(9000));

  const ref = await new SaveFileSource({ saveDir: dir }).latest();
  expect(ref?.path.endsWith("new.ck3")).toBe(true);
});

test("latest() returns null on empty dir", async () => {
  const dir = mkdtempSync(join(tmpdir(), "ck3-"));
  expect(await new SaveFileSource({ saveDir: dir }).latest()).toBeNull();
});
