import { expect, test } from "vitest";
import { mkdtempSync, writeFileSync, utimesSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { SaveFileSource } from "../src/source.js";

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

test("latest() returns null on empty dir", async () => {
  const dir = mkdtempSync(join(tmpdir(), "ck3-"));
  expect(await new SaveFileSource({ saveDir: dir }).latest()).toBeNull();
});
