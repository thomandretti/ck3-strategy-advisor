# CK3 Strategy Advisor MCP Server — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a local stdio MCP server that reads non-Ironman CK3 save files and exposes the player's strategic situation to Claude as compact, curated tools.

**Architecture:** One-way pipeline — `SaveFileSource` (file watch) → `jomini` parse of the unzipped gamestate → `Extractor` (+ localization) → compact `Snapshot` → cache → MCP tools. A pluggable `Source` interface and the `Snapshot` boundary keep a future live source (mode B) reachable without a rewrite.

**Tech Stack:** TypeScript / Node.js, `@modelcontextprotocol/sdk` (stdio transport), `jomini` (npm, Paradox-text parser), `zod`, `adm-zip` (unzip the embedded gamestate), `vitest` (tests). Deployment: local stdio prototype; MCPB is the documented future distribution path.

## Global Constraints

- **TypeScript, ESM** (`"type": "module"`); Node ≥ 20.
- **Package name:** `@modelcontextprotocol/sdk` — import `McpServer` from `@modelcontextprotocol/sdk/server/mcp.js`, `StdioServerTransport` from `@modelcontextprotocol/sdk/server/stdio.js`.
- **`registerTool(name, config, handler)`**: `config.inputSchema` is a **raw object of zod fields** (e.g. `{ id: z.string() }`), NOT `z.object(...)`. Handler returns `{ content: [{ type: "text", text }] }`; errors return `{ isError: true, content: [...] }` — never throw across the transport.
- **Every tool is read-only:** annotations `{ readOnlyHint: true, openWorldHint: false, title: "<Human Title>" }`. Tool names ≤ 64 chars.
- **Token discipline (hard rule):** tools return compact Markdown — counts, top-N, summaries. Never serialize raw save subtrees. Truncate long lists and say so ("Showing 10 of 47…").
- **Every tool response is stamped** with the snapshot's in-game date and wall-clock age.
- **Non-Ironman only:** detect Ironman/binary saves and return a friendly message; never mis-parse.
- **Save format (verified):** `.ck3` = `SAV` header → plaintext `meta_data` → embedded PKZIP (`PK\x03\x04`) containing one plaintext `gamestate` entry (~100 MB mid-game). Target the named saves in `save games/`; treat the parent-dir `last_save.ck3` as a skipped edge case.
- **Default save dir:** discover `/mnt/c/Users/*/Documents/Paradox Interactive/Crusader Kings III/save games/`. **Default game dir** (localization): `/mnt/c/Program Files (x86)/Steam/steamapps/common/Crusader Kings III/game/`. Both overridable via `CK3_SAVE_DIR` / `CK3_GAME_DIR`.
- **TDD always.** Trust the third-party parser; test the code we own. Commit after every green task.

---

## File Structure

```
package.json                       # ESM, deps, scripts
tsconfig.json                      # strict, ES2022, NodeNext
vitest.config.ts
src/
  config.ts                        # resolveConfig(): save dir, game dir discovery
  envelope.ts                      # extractGamestate(buf): unzip; detectFormat(buf)
  parser.ts                        # initParser(); queryGamestate(buf, fn)
  source.ts                        # Source interface; SaveFileSource (newest .ck3, read)
  cache.ts                         # SnapshotCache: build-on-change + debounce
  localization.ts                  # Localizer: load yml, resolve(key), resolveTrait(idx)
  snapshot.ts                      # Snapshot + sub-types (pure data)
  extract/
    overview.ts                    # extractOverview(query, loc) -> RealmOverview
    military.ts                    # extractMilitary(...)
    succession.ts
    diplomacy.ts
    vassals.ts
    factions.ts
    expansion.ts
    characters.ts                  # extractCharacter / findCharacters
  format.ts                        # stamp(snapshot, md); helpers (table, list, truncate)
  tools/
    index.ts                       # registerAllTools(server, cache)
    overview.ts ... character.ts   # one file per tool (registration + formatting)
  index.ts                         # entry: wire config→source→cache→tools; stdio connect
docs/
  save-schema.md                   # Task 7 deliverable: verified field paths per section
tests/
  fixtures/
    mini-gamestate.txt             # hand-written small plaintext gamestate
    make-envelope.ts               # wraps a gamestate string into a SAV+zip buffer
  *.test.ts
```

---

### Task 1: Project scaffold

**Files:**
- Create: `package.json`, `tsconfig.json`, `vitest.config.ts`, `src/index.ts` (placeholder), `tests/smoke.test.ts`

**Interfaces:**
- Produces: npm scripts `build`, `test`, `dev`; ESM project Node ≥ 20.

- [ ] **Step 1: Write `package.json`**

```json
{
  "name": "ck3-strategy-advisor",
  "version": "0.1.0",
  "type": "module",
  "engines": { "node": ">=20" },
  "bin": { "ck3-advisor": "dist/index.js" },
  "scripts": {
    "build": "tsc",
    "dev": "tsx src/index.ts",
    "test": "vitest run",
    "test:watch": "vitest"
  },
  "dependencies": {
    "@modelcontextprotocol/sdk": "^1.0.0",
    "adm-zip": "^0.5.16",
    "jomini": "^0.27.0",
    "zod": "^3.23.0"
  },
  "devDependencies": {
    "@types/adm-zip": "^0.5.5",
    "@types/node": "^20.0.0",
    "tsx": "^4.0.0",
    "typescript": "^5.4.0",
    "vitest": "^2.0.0"
  }
}
```

- [ ] **Step 2: Write `tsconfig.json`**

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "NodeNext",
    "moduleResolution": "NodeNext",
    "outDir": "dist",
    "rootDir": "src",
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "declaration": false,
    "resolveJsonModule": true
  },
  "include": ["src"]
}
```

- [ ] **Step 3: Write `vitest.config.ts`**

```typescript
import { defineConfig } from "vitest/config";
export default defineConfig({ test: { include: ["tests/**/*.test.ts"] } });
```

- [ ] **Step 4: Write a smoke test** — `tests/smoke.test.ts`

```typescript
import { expect, test } from "vitest";
test("toolchain runs", () => { expect(1 + 1).toBe(2); });
```

- [ ] **Step 5: Install and run**

Run: `npm install && npm test`
Expected: vitest reports `1 passed`. (Confirms `jomini`, the SDK, and `adm-zip` resolve. If `jomini@^0.27.0` is unavailable, run `npm view jomini version` and use the latest; note it in the commit.)

- [ ] **Step 6: Commit**

```bash
git add package.json tsconfig.json vitest.config.ts tests/smoke.test.ts src/index.ts
git commit -m "chore: scaffold TypeScript MCP project"
```

---

### Task 2: Save envelope (unzip + format detection)

**Files:**
- Create: `src/envelope.ts`, `tests/fixtures/make-envelope.ts`, `tests/envelope.test.ts`

**Interfaces:**
- Produces:
  - `type SaveFormat = "text" | "ironman" | "unknown"`
  - `detectFormat(buf: Buffer): SaveFormat`
  - `extractGamestate(buf: Buffer): Buffer` — returns the plaintext gamestate bytes; throws `IronmanError` for binary saves.
  - `class IronmanError extends Error {}`

- [ ] **Step 1: Write the fixture envelope builder** — `tests/fixtures/make-envelope.ts`

```typescript
import AdmZip from "adm-zip";
// Wrap a plaintext gamestate string into a minimal CK3-like SAV envelope:
// "SAV" header line + plaintext meta region + embedded zip containing `gamestate`.
export function makeTextEnvelope(gamestate: string): Buffer {
  const header = Buffer.from("SAV010000000000000000000\n", "latin1");
  const meta = Buffer.from("meta_data={\n\tversion=\"1.8.1\"\n}\n", "latin1");
  const zip = new AdmZip();
  zip.addFile("gamestate", Buffer.from(gamestate, "utf8"));
  return Buffer.concat([header, meta, zip.toBuffer()]);
}
// A fake "ironman"/binary save: SAV header then binary bytes, no PK zip.
export function makeBinaryEnvelope(): Buffer {
  return Buffer.concat([
    Buffer.from("SAV010000000000000000000\n", "latin1"),
    Buffer.from([0x55, 0x31, 0x01, 0x00, 0x03, 0x00, 0x8f, 0x05]),
  ]);
}
```

- [ ] **Step 2: Write the failing test** — `tests/envelope.test.ts`

```typescript
import { expect, test } from "vitest";
import { detectFormat, extractGamestate, IronmanError } from "../src/envelope.js";
import { makeTextEnvelope, makeBinaryEnvelope } from "./fixtures/make-envelope.js";

test("detects and extracts a text save's gamestate", () => {
  const buf = makeTextEnvelope("date=1130.7.24\nplayed_character={ character=42 }\n");
  expect(detectFormat(buf)).toBe("text");
  const gs = extractGamestate(buf).toString("utf8");
  expect(gs).toContain("played_character");
  expect(gs).toContain("character=42");
});

test("rejects an ironman/binary save", () => {
  const buf = makeBinaryEnvelope();
  expect(detectFormat(buf)).toBe("ironman");
  expect(() => extractGamestate(buf)).toThrow(IronmanError);
});
```

- [ ] **Step 3: Run test to verify it fails**

Run: `npx vitest run tests/envelope.test.ts`
Expected: FAIL — cannot find module `../src/envelope.js`.

- [ ] **Step 4: Implement `src/envelope.ts`**

```typescript
import AdmZip from "adm-zip";

export type SaveFormat = "text" | "ironman" | "unknown";
export class IronmanError extends Error {}

const ZIP_SIG = Buffer.from([0x50, 0x4b, 0x03, 0x04]); // PK\x03\x04

export function detectFormat(buf: Buffer): SaveFormat {
  if (buf.subarray(0, 3).toString("latin1") !== "SAV") return "unknown";
  // A text save embeds a PKZIP of the plaintext gamestate.
  if (buf.indexOf(ZIP_SIG) !== -1) return "text";
  return "ironman";
}

export function extractGamestate(buf: Buffer): Buffer {
  const format = detectFormat(buf);
  if (format === "ironman") {
    throw new IronmanError("Ironman/binary saves are not supported. Save without Ironman to use the advisor.");
  }
  if (format === "unknown") throw new Error("Not a CK3 save file (missing SAV header).");
  const at = buf.indexOf(ZIP_SIG);
  const zip = new AdmZip(buf.subarray(at));
  const entry = zip.getEntries().find((e) => e.entryName === "gamestate");
  if (!entry) throw new Error("Save archive has no `gamestate` entry.");
  return entry.getData();
}
```

- [ ] **Step 5: Run test to verify it passes**

Run: `npx vitest run tests/envelope.test.ts`
Expected: PASS (both tests).

- [ ] **Step 6: Verify against a REAL save** (sanity, not committed)

Run:
```bash
node --input-type=module -e '
import { readFileSync } from "node:fs";
import { detectFormat, extractGamestate } from "./dist/envelope.js";
const f=process.env.REAL_SAVE; const b=readFileSync(f);
console.log("format:", detectFormat(b));
const gs=extractGamestate(b);
console.log("gamestate bytes:", gs.length, "head:", gs.subarray(0,40).toString());
' </dev/null
```
First `npm run build`. Set `REAL_SAVE` to a real `.ck3` under `save games/`.
Expected: `format: text`, multi-MB gamestate, head begins `meta_data={`.

- [ ] **Step 7: Commit**

```bash
git add src/envelope.ts tests/fixtures/make-envelope.ts tests/envelope.test.ts
git commit -m "feat: extract gamestate from CK3 save envelope; detect ironman"
```

---

### Task 3: jomini parse wrapper

**Files:**
- Create: `src/parser.ts`, `tests/parser.test.ts`

**Interfaces:**
- Consumes: `extractGamestate` (Task 2).
- Produces:
  - `type Query = { at(path: string): unknown; root(): unknown }`
  - `async function queryGamestate<T>(gamestate: Buffer, fn: (q: Query) => T): Promise<T>` — initializes jomini once (module-level singleton), parses the plaintext gamestate with `parseText`, runs `fn` against the query API, returns its result. Using the query callback avoids materializing the whole tree.

- [ ] **Step 1: Write the failing test** — `tests/parser.test.ts`

```typescript
import { expect, test } from "vitest";
import { queryGamestate } from "../src/parser.js";

const GS = Buffer.from(
  `date="1130.7.24"\nplayed_character={\n\tcharacter=33564206\n\tplayer=1\n}\n`,
  "utf8",
);

test("queries a value by json pointer", async () => {
  const player = await queryGamestate(GS, (q) => q.at("/played_character/character"));
  expect(player).toBe(33564206);
});

test("exposes root for whole-object access", async () => {
  const root = await queryGamestate(GS, (q) => q.root()) as Record<string, unknown>;
  expect(root).toHaveProperty("played_character");
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/parser.test.ts`
Expected: FAIL — cannot find `../src/parser.js`.

- [ ] **Step 3: Implement `src/parser.ts`**

```typescript
import { Jomini } from "jomini";

export type Query = { at(path: string): unknown; root(): unknown };

let parserPromise: ReturnType<typeof Jomini.initialize> | null = null;
function getParser() {
  if (!parserPromise) parserPromise = Jomini.initialize();
  return parserPromise;
}

export async function queryGamestate<T>(gamestate: Buffer, fn: (q: Query) => T): Promise<T> {
  const parser = await getParser();
  return parser.parseText(gamestate, { encoding: "utf8" }, (query: Query) => fn(query));
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run tests/parser.test.ts`
Expected: PASS. (If `parseText`'s 3-arg query-callback form differs in the installed jomini version, consult `node_modules/jomini/README.md`; the documented API is `parseText(data, opts, (query) => …)` with `query.at("/json/pointer")` and `query.root()`.)

- [ ] **Step 5: Commit**

```bash
git add src/parser.ts tests/parser.test.ts
git commit -m "feat: jomini gamestate query wrapper"
```

---

### Task 4: SaveFileSource

**Files:**
- Create: `src/source.ts`, `tests/source.test.ts`

**Interfaces:**
- Produces:
  - `interface SaveRef { path: string; mtimeMs: number; }`
  - `interface Source { latest(): Promise<SaveRef | null>; read(ref: SaveRef): Promise<Buffer>; }` ← the mode-B seam.
  - `class SaveFileSource implements Source` — constructed with `{ saveDir: string }`; `latest()` returns the newest `*.ck3` directly in `saveDir` (ignores `last_save.ck3` if present in that dir), or `null` if none.

- [ ] **Step 1: Write the failing test** — `tests/source.test.ts`

```typescript
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
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/source.test.ts`
Expected: FAIL — cannot find `../src/source.js`.

- [ ] **Step 3: Implement `src/source.ts`**

```typescript
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
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run tests/source.test.ts`
Expected: PASS (both tests).

- [ ] **Step 5: Commit**

```bash
git add src/source.ts tests/source.test.ts
git commit -m "feat: SaveFileSource picks newest non-Ironman save"
```

---

### Task 5: Config resolution

**Files:**
- Create: `src/config.ts`, `tests/config.test.ts`

**Interfaces:**
- Produces:
  - `interface AdvisorConfig { saveDir: string | null; gameDir: string | null; }`
  - `function resolveConfig(env = process.env): AdvisorConfig` — honors `CK3_SAVE_DIR` / `CK3_GAME_DIR`; otherwise leaves `null` (discovery via glob is attempted by the caller only when env is unset — keep this function pure and synchronous over `env`).
  - `async function discoverSaveDir(): Promise<string | null>` — globs `/mnt/c/Users/*/Documents/Paradox Interactive/Crusader Kings III/save games` and returns the first existing match.

- [ ] **Step 1: Write the failing test** — `tests/config.test.ts`

```typescript
import { expect, test } from "vitest";
import { resolveConfig } from "../src/config.js";

test("env vars take precedence", () => {
  const cfg = resolveConfig({ CK3_SAVE_DIR: "/saves", CK3_GAME_DIR: "/game" });
  expect(cfg).toEqual({ saveDir: "/saves", gameDir: "/game" });
});

test("missing env yields nulls", () => {
  expect(resolveConfig({})).toEqual({ saveDir: null, gameDir: null });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/config.test.ts`
Expected: FAIL — cannot find `../src/config.js`.

- [ ] **Step 3: Implement `src/config.ts`**

```typescript
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
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run tests/config.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/config.ts tests/config.test.ts
git commit -m "feat: config resolution + save dir discovery"
```

---

### Task 6: Snapshot type, cache, and the `realm_overview` vertical slice

This task delivers the first end-to-end tool: save → extract `RealmOverview` → cached `Snapshot` → MCP `realm_overview` tool, plus the entry point. The `meta_data` and `played_character` structures are verified, so this slice is fully specified.

**Files:**
- Create: `src/snapshot.ts`, `src/cache.ts`, `src/format.ts`, `src/extract/overview.ts`, `src/localization.ts`, `src/tools/index.ts`, `src/tools/overview.ts`, `src/index.ts` (replace placeholder), `tests/fixtures/mini-gamestate.txt`, `tests/overview.test.ts`, `tests/cache.test.ts`

**Interfaces:**
- Produces:
  - `interface RealmOverview { rulerName: string; date: string; primaryTitle: string; tier: number; house: string; gold: number | null; prestige: number | null; piety: number | null; }`
  - `interface Snapshot { date: string; parsedAt: number; overview: RealmOverview; /* later tasks extend this */ }`
  - `async function buildSnapshot(gamestate: Buffer, loc: Localizer): Promise<Snapshot>`
  - `class SnapshotCache { constructor(source: Source, loc: Localizer); get(): Promise<Snapshot | { error: string }>; }` — rebuilds when the newest save's `mtimeMs` changes; serves cache otherwise; on parse failure returns last good snapshot if any, else `{ error }`.
  - `class Localizer { resolve(key: string): string; resolveTrait(idx: number): string; }` (Task 6 ships a pass-through `Localizer` that returns the raw key; Task 8 fills it in).
  - `function stamp(snapshot: { date: string; parsedAt: number }, body: string): string`

- [ ] **Step 1: Write the fixture** — `tests/fixtures/mini-gamestate.txt`

```
date="1130.7.24"
meta_data={
	version="1.8.1"
	meta_date=1130.7.24
	meta_player_name="Emperor Jenec"
	meta_title_name="The Holy Roman Empire"
	meta_player_tier=5
	meta_house_name="Přemyslid"
}
played_character={
	character=33564206
	player=1
}
living={
33564206={
	first_name="Jenec"
	gold=124.5
	prestige={ accumulated=820.0 }
	piety={ accumulated=310.0 }
}
}
```

- [ ] **Step 2: Write the failing tests** — `tests/overview.test.ts`

```typescript
import { expect, test } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { buildSnapshot } from "../src/snapshot.js";
import { Localizer } from "../src/localization.js";

const GS = readFileSync(join(__dirname, "fixtures/mini-gamestate.txt"));

test("buildSnapshot extracts the realm overview", async () => {
  const snap = await buildSnapshot(GS, new Localizer(null));
  expect(snap.overview.rulerName).toBe("Emperor Jenec");
  expect(snap.overview.primaryTitle).toBe("The Holy Roman Empire");
  expect(snap.overview.tier).toBe(5);
  expect(snap.overview.house).toBe("Přemyslid");
  expect(snap.overview.gold).toBe(124.5);
  expect(snap.date).toBe("1130.7.24");
  expect(snap.parsedAt).toBeGreaterThan(0);
});
```

- [ ] **Step 3: Run to verify it fails**

Run: `npx vitest run tests/overview.test.ts`
Expected: FAIL — missing modules.

- [ ] **Step 4: Implement `src/localization.ts` (pass-through for now)**

```typescript
export class Localizer {
  constructor(private gameDir: string | null) {}
  resolve(key: string): string { return key; }
  resolveTrait(idx: number): string { return `trait_${idx}`; }
}
```

- [ ] **Step 5: Implement `src/snapshot.ts`**

```typescript
import { queryGamestate, type Query } from "./parser.js";
import type { Localizer } from "./localization.js";

export interface RealmOverview {
  rulerName: string; date: string; primaryTitle: string; tier: number;
  house: string; gold: number | null; prestige: number | null; piety: number | null;
}
export interface Snapshot { date: string; parsedAt: number; overview: RealmOverview; }

function num(v: unknown): number | null { return typeof v === "number" ? v : null; }
function str(v: unknown): string { return typeof v === "string" ? v : String(v ?? ""); }

export async function buildSnapshot(gamestate: Buffer, _loc: Localizer): Promise<Snapshot> {
  return queryGamestate(gamestate, (q: Query): Snapshot => {
    const date = str(q.at("/date")).replace(/"/g, "");
    const playerId = q.at("/played_character/character");
    const gold = num(q.at(`/living/${playerId}/gold`));
    const prestige = num(q.at(`/living/${playerId}/prestige/accumulated`));
    const piety = num(q.at(`/living/${playerId}/piety/accumulated`));
    const overview: RealmOverview = {
      rulerName: str(q.at("/meta_data/meta_player_name")),
      date,
      primaryTitle: str(q.at("/meta_data/meta_title_name")),
      tier: num(q.at("/meta_data/meta_player_tier")) ?? 0,
      house: str(q.at("/meta_data/meta_house_name")),
      gold, prestige, piety,
    };
    return { date, parsedAt: Date.now(), overview };
  });
}
```

- [ ] **Step 6: Run to verify it passes**

Run: `npx vitest run tests/overview.test.ts`
Expected: PASS.

- [ ] **Step 7: Implement `src/format.ts`**

```typescript
export function stamp(snapshot: { date: string; parsedAt: number }, body: string): string {
  const ageMin = Math.round((Date.now() - snapshot.parsedAt) / 60000);
  const age = ageMin <= 0 ? "just now" : `${ageMin} min ago`;
  return `_Snapshot: ${snapshot.date} (read ${age})_\n\n${body}`;
}
export function truncate<T>(items: T[], n: number): { shown: T[]; note: string } {
  if (items.length <= n) return { shown: items, note: "" };
  return { shown: items.slice(0, n), note: `\n\n_Showing ${n} of ${items.length}._` };
}
```

- [ ] **Step 8: Write the cache test** — `tests/cache.test.ts`

```typescript
import { expect, test } from "vitest";
import { mkdtempSync, writeFileSync, utimesSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { SaveFileSource } from "../src/source.js";
import { SnapshotCache } from "../src/cache.js";
import { Localizer } from "../src/localization.js";
import { makeTextEnvelope } from "./fixtures/make-envelope.js";
import { readFileSync } from "node:fs";

const GS = readFileSync(join(__dirname, "fixtures/mini-gamestate.txt"), "utf8");

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
```

- [ ] **Step 9: Implement `src/cache.ts`**

```typescript
import type { Source } from "./source.js";
import type { Localizer } from "./localization.js";
import { extractGamestate, IronmanError } from "./envelope.js";
import { buildSnapshot, type Snapshot } from "./snapshot.js";

export class SnapshotCache {
  private current: Snapshot | null = null;
  private key = "";
  constructor(private source: Source, private loc: Localizer) {}

  async get(): Promise<Snapshot | { error: string }> {
    const ref = await this.source.latest();
    if (!ref) return this.current ?? { error: "No CK3 save found. Save your game, then ask again." };
    const k = `${ref.path}:${ref.mtimeMs}`;
    if (k === this.key && this.current) return this.current;
    try {
      const gs = extractGamestate(await this.source.read(ref));
      this.current = await buildSnapshot(gs, this.loc);
      this.key = k;
      return this.current;
    } catch (e) {
      if (e instanceof IronmanError) return { error: e.message };
      if (this.current) return this.current; // serve last good on transient/mid-write failure
      return { error: `Could not read save: ${(e as Error).message}` };
    }
  }
}
```

- [ ] **Step 10: Run cache tests**

Run: `npx vitest run tests/cache.test.ts`
Expected: PASS (both).

- [ ] **Step 11: Implement the tool registry + overview tool** — `src/tools/overview.ts`

```typescript
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { SnapshotCache } from "../cache.js";
import { stamp } from "../format.js";

export function registerOverview(server: McpServer, cache: SnapshotCache) {
  server.registerTool(
    "realm_overview",
    {
      title: "Realm Overview",
      description:
        "Snapshot of the player's ruler and realm: name, primary title & tier, house, gold, prestige, piety, and in-game date. Start here for 'what's my situation'. For military/wars use `military`; for heirs use `succession`.",
      inputSchema: {},
      annotations: { readOnlyHint: true, openWorldHint: false },
    },
    async () => {
      const snap = await cache.get();
      if ("error" in snap) return { isError: true, content: [{ type: "text", text: snap.error }] };
      const o = snap.overview;
      const body =
        `# ${o.rulerName} — ${o.primaryTitle} (tier ${o.tier})\n` +
        `- House: ${o.house}\n` +
        `- Gold: ${o.gold ?? "?"} | Prestige: ${o.prestige ?? "?"} | Piety: ${o.piety ?? "?"}`;
      return { content: [{ type: "text", text: stamp(snap, body) }] };
    },
  );
}
```

- [ ] **Step 12: Implement `src/tools/index.ts`**

```typescript
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { SnapshotCache } from "../cache.js";
import { registerOverview } from "./overview.js";

export function registerAllTools(server: McpServer, cache: SnapshotCache) {
  registerOverview(server, cache);
  // later tasks register additional tools here
}
```

- [ ] **Step 13: Implement entry point** — `src/index.ts`

```typescript
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { resolveConfig, discoverSaveDir } from "./config.js";
import { SaveFileSource } from "./source.js";
import { SnapshotCache } from "./cache.js";
import { Localizer } from "./localization.js";
import { registerAllTools } from "./tools/index.js";

async function main() {
  const cfg = resolveConfig();
  const saveDir = cfg.saveDir ?? (await discoverSaveDir());
  if (!saveDir) { console.error("No CK3 save dir found. Set CK3_SAVE_DIR."); process.exit(1); }
  const cache = new SnapshotCache(new SaveFileSource({ saveDir }), new Localizer(cfg.gameDir));
  const server = new McpServer(
    { name: "ck3-strategy-advisor", version: "0.1.0" },
    { instructions: "Tools report the player's CK3 realm from their latest save. Each response is stamped with the save's in-game date and age." },
  );
  registerAllTools(server, cache);
  await server.connect(new StdioServerTransport());
}
main().catch((e) => { console.error(e); process.exit(1); });
```

- [ ] **Step 14: Build, run full suite, and smoke the server**

Run: `npm run build && npm test`
Expected: all tests PASS.
Run (manual smoke): `CK3_SAVE_DIR="<path to save games>" npx @modelcontextprotocol/inspector node dist/index.js` — in the Inspector, call `realm_overview` and confirm it returns a stamped Markdown overview from your latest real save. (If you don't have the Inspector, `node dist/index.js` should start and wait on stdio without crashing.)

- [ ] **Step 15: Commit**

```bash
git add src tests
git commit -m "feat: realm_overview vertical slice (snapshot, cache, stdio server)"
```

---

### Task 7: Map remaining gamestate sections → `docs/save-schema.md`

The later tools need exact field paths inside `living`, `landed_titles`, `wars`, `alliances`/`relations`, `factions`, `succession`, and character `claim` data. These are empirical and must be read from a real save, not guessed. This task produces a committed reference the extractor tasks build against.

**Files:**
- Create: `docs/save-schema.md`
- Create: `scripts/inspect-section.mjs` (a reusable inspector)

**Interfaces:**
- Produces: `docs/save-schema.md` documenting, per section, the exact key path and a real example block, plus the player-relative lookups (e.g. how to find the player's primary title, levies, claims, ongoing wars).

- [ ] **Step 1: Write the inspector** — `scripts/inspect-section.mjs`

```javascript
import { readFileSync, writeFileSync } from "node:fs";
import AdmZip from "adm-zip";
const [, , savePath, needle, bytesArg] = process.argv;
const bytes = Number(bytesArg ?? 1200);
const buf = readFileSync(savePath);
const at = buf.indexOf(Buffer.from([0x50, 0x4b, 0x03, 0x04]));
const zip = new AdmZip(buf.subarray(at));
const gs = zip.getEntries().find((e) => e.entryName === "gamestate").getData().toString("utf8");
writeFileSync("/tmp/gamestate.txt", gs);
const i = gs.search(new RegExp(`(^|\\n)${needle}=`));
console.log(`'${needle}' at offset ${i}`);
console.log(gs.slice(i, i + bytes));
```

- [ ] **Step 2: Run the inspector against a real save for each section**

Run `npm run build` first. Then, with `S="<path to a real .ck3>"`, inspect each:
```bash
for k in landed_titles wars alliances relations factions succession; do
  node scripts/inspect-section.mjs "$S" "$k" 1500 > "/tmp/sec-$k.txt"; done
node scripts/inspect-section.mjs "$S" "played_character" 400
# Then inspect the PLAYER character block specifically:
node --input-type=module -e '
import {readFileSync} from "node:fs";
const gs=readFileSync("/tmp/gamestate.txt","utf8");
const id=gs.match(/played_character=\{[^]*?character=(\d+)/)[1];
const i=gs.search(new RegExp("\\n"+id+"=\\{"));
console.log("player",id,"\n",gs.slice(i,i+2500));
' </dev/null
```

- [ ] **Step 3: Write `docs/save-schema.md`** — for each of these, record the verified path and a trimmed real example:
  - **Player character block** (`living/<id>`): keys for traits (indices → `traits_lookup`), `gold`, `prestige`/`piety` (accumulated), `health`, `stress`, `dynasty_house`, `landed_data` (titles held, vassals), `claim` (claimed title + strong/weak/pressed), `alliance`/`relations` refs, `council` membership, `sub_realm`/levies/`men_at_arms`.
  - **`landed_titles`**: how a title id maps to its `key` (e.g. `k_bohemia`), `de_jure_liege`, `holder`, `heir`/succession.
  - **`wars`/`war`**: attacker/defender, `casus_belli`, war score, participants, target.
  - **`alliances`/`relations`**: how to enumerate the player's active alliances and truces.
  - **`factions`**: members, target/type, strength.
  - **`succession`**: how partition/heirs are represented for the player's titles.
  - For each: the **player-relative access recipe** (start from `played_character/character`, then where to read).

  Mark anything not found as "not directly stored — derive from X" (e.g. levy totals may need summing across holdings).

- [ ] **Step 4: Sanity-check the doc** — pick three documented paths and confirm with the inspector that they return real values on a second, different real save (guards against save-specific quirks).

- [ ] **Step 5: Commit**

```bash
git add docs/save-schema.md scripts/inspect-section.mjs
git commit -m "docs: verified gamestate field schema for extractor tasks"
```

---

### Tasks 8–14: Per-domain extractors + tools

> **Each of these tasks follows the identical 6-step shape below.** They depend on Task 7's `docs/save-schema.md` for exact field paths and on Task 6's infrastructure (`buildSnapshot`, `SnapshotCache`, `stamp`, `truncate`, tool registry). Each extends the `Snapshot` interface with its sub-object, adds an `extract/<domain>.ts`, registers one tool, and asserts against the fixture (extend `tests/fixtures/mini-gamestate.txt` with the minimal block that domain needs, using the real structure recorded in `docs/save-schema.md`).

**The shape (apply per task):**

- [ ] **Step 1 — Extend the fixture:** add the minimal real-structured block for this domain to `tests/fixtures/mini-gamestate.txt`, copying the shape from `docs/save-schema.md` with small known values.
- [ ] **Step 2 — Write the failing extractor test** in `tests/<domain>.test.ts`: call `buildSnapshot(GS, new Localizer(null))` and assert on `snap.<domain>` (exact known values from the fixture).
- [ ] **Step 3 — Run it; verify it fails** (`npx vitest run tests/<domain>.test.ts`).
- [ ] **Step 4 — Implement** `src/extract/<domain>.ts` (exported `extract<Domain>(q: Query, loc: Localizer): <Domain>`) using paths from `docs/save-schema.md`; extend the `Snapshot` interface and call it from `buildSnapshot`.
- [ ] **Step 5 — Implement the tool** `src/tools/<domain>.ts` (read-only annotations, disambiguating description, compact Markdown via `stamp`/`truncate`), register it in `src/tools/index.ts`; run the full suite (`npm test`) green.
- [ ] **Step 6 — Commit** (`feat: <domain> extractor and tool`).

**Task 8 — Localization (do first of this group):** Replace the pass-through `Localizer` with a real one: load `<gameDir>/localization/english/*.yml` (CK3 yml: `KEY: "value"` lines, `$KEY$` interpolation ignored for v1), build a `Map`, and use the save's `traits_lookup` array for `resolveTrait(idx)`. Fallback to the raw key when absent (warn once to stderr). Test with a tiny fixture yml dir asserting `resolve("k_bohemia") === "Bohemia"` and a missing key returns the raw key. **Files:** `src/localization.ts`, `tests/localization.test.ts`, `tests/fixtures/loc/english/test.yml`. Then thread real titles/traits through `overview` (resolve `primaryTitle` from the player's primary title id when available, else keep `meta_title_name`).

**Task 9 — `character` + `find_character`:** `extractCharacter(q, loc, id)` and `findCharacters(q, loc, name)` (search `living` by `first_name`, return id + title). Two tools: `find_character` (name → matches, ≤10, note if more) and `character` (id → traits, stats, gold, prestige/piety, key relations, secrets held). Descriptions disambiguate: `character` says "needs an id — use `find_character` if you only have a name"; `find_character` says "returns ids to pass to `character`". Snapshot does NOT pre-extract all characters (token budget) — these tools query the cached **gamestate** on demand; to support that, have `SnapshotCache` also retain the raw gamestate buffer for ad-hoc queries, exposed as `cache.query(fn)`.

**Task 10 — `military`:** player levy + men-at-arms totals (sum per `docs/save-schema.md`), ongoing wars (belligerents, war score, contribution, time left), and a strength line vs. the war target. Tool `military`.

**Task 11 — `succession`:** heir(s) for the player's primary title, succession law, partition preview (titles → heirs), heir quality, rival claimants. Tool `succession`.

**Task 12 — `diplomacy`:** active alliances, truces, opinion of/from neighbors and liege (top-N), marriage candidates if cheaply available, a simple threat ranking. Tool `diplomacy`.

**Task 13 — `vassals` + `factions`:** `vassals` = top-N vassals by power with opinion, faction membership, council seat, danger flag. `factions` = active factions with members, type/target, strength vs. player. Two tools sharing the vassal extraction.

**Task 14 — `expansion`:** the player's held claims (target title via `landed_titles` key, strong/weak, pressed?), de jure targets adjacent to the realm, and CBs on ongoing wars. Tool `expansion`. Description explicitly notes it lists **stored** claims/de-jure/active-war CBs, not a full computed CB enumeration.

---

### Task 15: README + run instructions

**Files:**
- Create: `README.md`

- [ ] **Step 1: Write `README.md`** covering: what it is, the non-Ironman requirement, install (`npm install && npm run build`), config (`CK3_SAVE_DIR`, `CK3_GAME_DIR` with the `/mnt/c` defaults), how to register in Claude Code / Claude Desktop as a local stdio MCP server (command `node /abs/path/dist/index.js`), the workflow ("save your game, then ask"), the tool list, and the MCPB-distribution future path.
- [ ] **Step 2: Verify** the documented Claude-registration command starts the server (`node dist/index.js` waits on stdio).
- [ ] **Step 3: Commit** (`docs: add README`).

---

## Self-Review

**Spec coverage:**
- Pluggable Source seam → Task 4 (`Source` interface) ✓
- jomini query-only extraction (memory) → Task 3 ✓
- Compact curated Snapshot / token discipline → Task 6 (`stamp`/`truncate`), enforced in every tool task; `character` queries on demand rather than pre-extracting (Task 9) ✓
- Localization resolver w/ fallback → Task 8 ✓
- Cache keyed on path+mtime, debounce/last-good-on-failure → Task 6 (Task 5/6) ✓
- 8 v1 tools (overview, military, succession, diplomacy, vassals, factions, expansion, character/find_character) → Tasks 6, 9–14 ✓
- `expansion` = stored claims+de jure+war CBs, not full enumeration → Task 14 ✓
- Ironman detection/refusal → Task 2 + cache surfacing (Task 6) ✓
- Error handling as tool responses, not crashes → Task 6 cache + tool-design rule ✓
- Config + discovery defaults → Task 5 ✓
- Markdown output, date/age stamp → Task 6 `stamp` ✓
- Testing against committed fixture → Tasks 6–14 ✓
- Stack/deployment (TS, stdio, MCPB future) → Tasks 1, 13/15 ✓

**Gap intentionally deferred (matches spec non-goals):** intrigue/council/economy tools, full CB enumeration, mode-B live source, non-English localization. The `Source` seam and `Snapshot` boundary keep them additive.

**Placeholder scan:** Tasks 1–7 contain complete code. Tasks 8–14 are deliberately structured as a repeated, fully-specified TDD shape parameterized per domain, because their exact field paths are empirical facts produced as a committed artifact in Task 7 — hardcoding unverified CK3 internals into the plan would be worse than routing them through the schema-mapping deliverable. Each still has concrete files, signatures, test strategy, and commit.

**Type consistency:** `Snapshot` is introduced in Task 6 and extended additively by Tasks 8–14; `Source`/`SaveRef` (Task 4), `Query` (Task 3), `Localizer` (Task 6→8), `SnapshotCache.get()`/`.query()` (Task 6/9) names are used consistently downstream.
