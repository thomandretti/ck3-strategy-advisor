import { expect, test } from "vitest";
import { resolveConfig } from "../src/config.js";

test("env vars take precedence", () => {
  const cfg = resolveConfig({ CK3_SAVE_DIR: "/saves", CK3_GAME_DIR: "/game" });
  expect(cfg).toEqual({ saveDir: "/saves", gameDir: "/game" });
});

test("missing env yields nulls", () => {
  expect(resolveConfig({})).toEqual({ saveDir: null, gameDir: null });
});

import { mkdirSync, mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { discoverSaveDir } from "../src/config.js";

const TAIL = join("Paradox Interactive", "Crusader Kings III", "save games");
function home(...docFolders: string[]): string {
  const h = mkdtempSync(join(tmpdir(), "ck3-home-"));
  for (const d of docFolders) mkdirSync(join(h, d, TAIL), { recursive: true });
  return h;
}
const NO_WSL = join(tmpdir(), "ck3-no-such-users-root");

test("finds saves under OneDrive\Documentos on Windows", async () => {
  const h = home(join("OneDrive", "Documentos"));
  expect(await discoverSaveDir({ env: { USERPROFILE: h }, usersRoot: NO_WSL })).toBe(
    join(h, "OneDrive", "Documentos", TAIL),
  );
});

test("finds saves under OneDrive\Documents and plain Documents", async () => {
  const a = home(join("OneDrive", "Documents"));
  expect(await discoverSaveDir({ env: { USERPROFILE: a }, usersRoot: NO_WSL })).toBe(
    join(a, "OneDrive", "Documents", TAIL),
  );
  const b = home("Documents");
  expect(await discoverSaveDir({ env: { USERPROFILE: b }, usersRoot: NO_WSL })).toBe(
    join(b, "Documents", TAIL),
  );
});

test("prefers the OneDrive folder from %OneDrive% when set", async () => {
  const h = home();
  const od = mkdtempSync(join(tmpdir(), "ck3-od-"));
  mkdirSync(join(od, "Documents", TAIL), { recursive: true });
  expect(await discoverSaveDir({ env: { USERPROFILE: h, OneDrive: od }, usersRoot: NO_WSL })).toBe(
    join(od, "Documents", TAIL),
  );
});

test("falls back to WSL /mnt/c/Users scan, and returns null when nothing exists", async () => {
  const root = mkdtempSync(join(tmpdir(), "ck3-users-"));
  mkdirSync(join(root, "someone", "Documents", TAIL), { recursive: true });
  expect(await discoverSaveDir({ env: {}, usersRoot: root })).toBe(
    `${root}/someone/Documents/Paradox Interactive/Crusader Kings III/save games`,
  );
  expect(await discoverSaveDir({ env: {}, usersRoot: NO_WSL })).toBeNull();
});
