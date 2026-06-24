# Held Titles Tool Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a read-only `titles` MCP tool that lists the player's personally-held titles (their domain), grouped by tier, each with its de jure liege.

**Architecture:** Follows the project's one-direction flow: a pure extractor (`extractTitles`) reads `landed_data/domain`, buckets titles by tier (derived from the `key` prefix via a new `titleTierFromKey` helper) and resolves each de jure liege; `buildSnapshot` runs it in the single jomini pass; a thin tool (`registerTitlesTool`) formats markdown via `stamp`/`truncate`.

**Tech Stack:** TypeScript (ESM + NodeNext, `strict`), jomini WASM parser, `@modelcontextprotocol/sdk`, vitest.

## Global Constraints

- ESM + NodeNext: every relative import uses an explicit `.js` extension, even from `.ts` sources; type-only imports use `import type`.
- Tools never throw to the client: on `cache.get()` returning `{ error }`, return `{ isError: true, content: [{ type: "text", text: error }] }`.
- Use `stamp(snap, body)` to prefix tool output and `truncate(items, n)` to cap long lists.
- Don't fabricate data the save doesn't store.
- Build gate is `npm run build` (tsc strict); test gate is `npm test` (vitest run).
- No new save-schema paths are introduced; all fields are already in `docs/save-schema.md`.

---

### Task 1: `titleTierFromKey` helper

**Files:**
- Modify: `src/extract/titleUtils.ts`
- Test: `tests/titles.test.ts` (create)

**Interfaces:**
- Consumes: nothing.
- Produces: `titleTierFromKey(key: string): "empire" | "kingdom" | "duchy" | "county" | "barony" | "other"`

- [ ] **Step 1: Write the failing test**

Create `tests/titles.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { titleTierFromKey } from "../src/extract/titleUtils.js";

describe("titleTierFromKey", () => {
  it("maps tier prefixes", () => {
    expect(titleTierFromKey("e_hre")).toBe("empire");
    expect(titleTierFromKey("k_bohemia")).toBe("kingdom");
    expect(titleTierFromKey("d_bohemia")).toBe("duchy");
    expect(titleTierFromKey("c_praha")).toBe("county");
    expect(titleTierFromKey("b_praha")).toBe("barony");
  });
  it("returns 'other' for unknown prefixes", () => {
    expect(titleTierFromKey("x_weird")).toBe("other");
    expect(titleTierFromKey("")).toBe("other");
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/titles.test.ts`
Expected: FAIL — `titleTierFromKey` is not exported / not a function.

- [ ] **Step 3: Write minimal implementation**

Append to `src/extract/titleUtils.ts`:

```ts
export type TitleTier = "empire" | "kingdom" | "duchy" | "county" | "barony" | "other";

// Tier is encoded in the title key's prefix (e_/k_/d_/c_/b_).
export function titleTierFromKey(key: string): TitleTier {
  switch (key[0]) {
    case "e": return "empire";
    case "k": return "kingdom";
    case "d": return "duchy";
    case "c": return "county";
    case "b": return "barony";
    default: return "other";
  }
}
```

Note: matching on the first character relies on the `_` convention; the
`switch` returns `other` for anything else, so an empty string is safe.

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run tests/titles.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/extract/titleUtils.ts tests/titles.test.ts
git commit -m "feat: add titleTierFromKey helper"
```

---

### Task 2: `extractTitles` extractor (+ fixture tweak)

**Files:**
- Create: `src/extract/titles.ts`
- Modify: `tests/fixtures/mini-gamestate.txt:18`
- Test: `tests/titles.test.ts` (extend)

**Interfaces:**
- Consumes: `titleTierFromKey` (Task 1); `resolveTitleName(q, loc, id)` and `Query`/`Localizer` types (existing).
- Produces:
  - `interface HeldTitle { id: number; name: string; deJureLiege: string | null }`
  - `interface TitlesInfo { empires: HeldTitle[]; kingdoms: HeldTitle[]; duchies: HeldTitle[]; counties: HeldTitle[]; baronies: HeldTitle[]; total: number }`
  - `extractTitles(q: Query, loc: Localizer): TitlesInfo`

- [ ] **Step 1: Tweak the fixture so de jure resolution is exercised**

In `tests/fixtures/mini-gamestate.txt`, line 18, change:

```
2={ key="k_bohemia" name="Bohemia" holder=33564206 }
```

to:

```
2={ key="k_bohemia" name="Bohemia" holder=33564206 de_jure_liege=1 }
```

- [ ] **Step 2: Write the failing test**

Append to `tests/titles.test.ts`:

Match the repo convention (see `tests/vassals.test.ts`): drive the extractor
through `buildSnapshot` and assert on `snap.titles`. `Localizer` takes a single
arg — construct it as `new Localizer(null)` (game dir absent).

```ts
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { buildSnapshot } from "../src/snapshot.js";
import { Localizer } from "../src/localization.js";

const GS = readFileSync(
  fileURLToPath(new URL("./fixtures/mini-gamestate.txt", import.meta.url)),
);

describe("extractTitles", () => {
  it("buckets the player's domain by tier with de jure lieges", async () => {
    const info = (await buildSnapshot(GS, new Localizer(null))).titles;
    expect(info.total).toBe(2);
    expect(info.empires).toEqual([
      { id: 1, name: "The Holy Roman Empire", deJureLiege: null },
    ]);
    expect(info.kingdoms).toEqual([
      { id: 2, name: "Bohemia", deJureLiege: "The Holy Roman Empire" },
    ]);
    expect(info.duchies).toEqual([]);
    expect(info.counties).toEqual([]);
    expect(info.baronies).toEqual([]);
  });
});
```

Note: confirm `Localizer` is constructed with no args elsewhere in the test
suite; if existing tests use a different constructor/import, match that pattern
instead.

- [ ] **Step 3: Run test to verify it fails**

Run: `npx vitest run tests/titles.test.ts`
Expected: FAIL — cannot find module `../src/extract/titles.js`.

- [ ] **Step 4: Write the implementation**

Create `src/extract/titles.ts`:

```ts
import type { Query } from "../parser.js";
import type { Localizer } from "../localization.js";
import { resolveTitleName, titleTierFromKey } from "./titleUtils.js";

export interface HeldTitle {
  id: number;
  name: string;
  deJureLiege: string | null;
}
export interface TitlesInfo {
  empires: HeldTitle[];
  kingdoms: HeldTitle[];
  duchies: HeldTitle[];
  counties: HeldTitle[];
  baronies: HeldTitle[];
  total: number;
}

export function extractTitles(q: Query, loc: Localizer): TitlesInfo {
  const playerId = q.at("/played_character/character") as number;
  const domain = (q.at(`/living/${playerId}/landed_data/domain`) as number[] | undefined) ?? [];

  const info: TitlesInfo = {
    empires: [], kingdoms: [], duchies: [], counties: [], baronies: [], total: 0,
  };

  for (const id of domain) {
    const key = q.at(`/landed_titles/landed_titles/${id}/key`) as string | undefined;
    const tier = titleTierFromKey(key ?? "");

    const ljId = q.at(`/landed_titles/landed_titles/${id}/de_jure_liege`);
    const deJureLiege = typeof ljId === "number" ? resolveTitleName(q, loc, ljId) : null;

    const held: HeldTitle = { id, name: resolveTitleName(q, loc, id), deJureLiege };

    switch (tier) {
      case "empire": info.empires.push(held); break;
      case "kingdom": info.kingdoms.push(held); break;
      case "duchy": info.duchies.push(held); break;
      case "county": info.counties.push(held); break;
      case "barony": info.baronies.push(held); break;
      default: continue; // 'other' — not expected in a player domain; skip
    }
    info.total++;
  }

  return info;
}
```

- [ ] **Step 5: Run test to verify it passes**

Run: `npx vitest run tests/titles.test.ts`
Expected: PASS (both `titleTierFromKey` and `extractTitles` blocks).

- [ ] **Step 6: Ensure the rest of the suite still passes (fixture change)**

Run: `npm test`
Expected: PASS — the added `de_jure_liege=1` on title 2 must not break existing tests (expansion/vassals/etc.). If any test asserted on title 2's absence of `de_jure_liege`, update it.

- [ ] **Step 7: Commit**

```bash
git add src/extract/titles.ts tests/titles.test.ts tests/fixtures/mini-gamestate.txt
git commit -m "feat: add extractTitles extractor"
```

---

### Task 3: Wire `titles` into the snapshot

**Files:**
- Modify: `src/snapshot.ts`

**Interfaces:**
- Consumes: `extractTitles`, `TitlesInfo` (Task 2).
- Produces: `Snapshot.titles: TitlesInfo` available to tools via `cache.get()`.

- [ ] **Step 1: Import the extractor**

In `src/snapshot.ts`, add to the import group:

```ts
import { extractTitles, type TitlesInfo } from "./extract/titles.js";
```

- [ ] **Step 2: Add `titles` to the `Snapshot` interface**

In the `Snapshot` interface, add `titles: TitlesInfo;` (e.g. after `vassalCount: number;`).

- [ ] **Step 3: Run the extractor in the pass and include it in the result**

Inside `buildSnapshot`, after the `extractVassals` call, add:

```ts
const titles = extractTitles(q, loc);
```

and add `titles` to the returned object literal:

```ts
return { date, parsedAt: Date.now(), overview, military, expansion, succession, diplomacy, factions, vassals, vassalCount, titles };
```

- [ ] **Step 4: Verify it compiles**

Run: `npm run build`
Expected: PASS — no type errors.

- [ ] **Step 5: Commit**

```bash
git add src/snapshot.ts
git commit -m "feat: include titles in snapshot"
```

---

### Task 4: `titles` MCP tool + registration

**Files:**
- Create: `src/tools/titles.ts`
- Modify: `src/tools/index.ts`
- Test: `tests/titles.test.ts` (extend)

**Interfaces:**
- Consumes: `Snapshot.titles` (Task 3); `stamp`, `truncate` from `../format.js`; `SnapshotCache`; `McpServer`.
- Produces: `registerTitlesTool(server: McpServer, cache: SnapshotCache)`; tool name `"titles"`.

- [ ] **Step 1: Write the failing tool-render test**

Append to `tests/titles.test.ts`. This drives the tool through a fake server/cache, mirroring how other tool tests register and invoke (check an existing one, e.g. `tests/vassals.test.ts`, and match its harness). Conceptually:

```ts
import { registerTitlesTool } from "../src/tools/titles.js";

describe("titles tool", () => {
  it("renders held titles grouped by tier", async () => {
    // Build a Snapshot-like object with the titles produced above and a date.
    const snap = {
      date: "1130-07-24",
      parsedAt: Date.now(),
      titles: {
        empires: [{ id: 1, name: "The Holy Roman Empire", deJureLiege: null }],
        kingdoms: [{ id: 2, name: "Bohemia", deJureLiege: "The Holy Roman Empire" }],
        duchies: [], counties: [], baronies: [], total: 2,
      },
    } as any;
    const cache = { get: async () => snap } as any;

    let handler: any;
    const server = {
      registerTool: (_name: string, _cfg: any, h: any) => { handler = h; },
    } as any;

    registerTitlesTool(server, cache);
    const res = await handler({});
    const text = res.content[0].text as string;

    expect(text).toContain("Held titles");
    expect(text).toContain("1 empire");
    expect(text).toContain("1 kingdom");
    expect(text).toContain("The Holy Roman Empire");
    expect(text).toContain("Bohemia (de jure: The Holy Roman Empire)");
  });
});
```

If `tests/vassals.test.ts` uses a shared helper to drive tools, use that helper instead of the inline fakes above.

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/titles.test.ts`
Expected: FAIL — cannot find module `../src/tools/titles.js`.

- [ ] **Step 3: Write the tool**

Create `src/tools/titles.ts`:

```ts
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { SnapshotCache } from "../cache.js";
import type { HeldTitle } from "../extract/titles.js";
import { stamp, truncate } from "../format.js";

function plural(n: number, singular: string): string {
  return `${n} ${singular}${n === 1 ? "" : "s"}`;
}

function renderTier(body: string, heading: string, titles: HeldTitle[], cap: number): string {
  if (titles.length === 0) return body;
  body += `\n## ${heading} (${titles.length})\n`;
  const { shown, note } = truncate(titles, cap);
  for (const t of shown) {
    const liege = t.deJureLiege ? ` (de jure: ${t.deJureLiege})` : "";
    body += `- ${t.name}${liege}\n`;
  }
  body += note;
  return body;
}

export function registerTitlesTool(server: McpServer, cache: SnapshotCache) {
  server.registerTool(
    "titles",
    {
      title: "Held Titles",
      description:
        "Titles you personally hold (your domain), grouped by tier (empire/kingdom/duchy/county/barony), each with its de jure liege. For titles held by your vassals, see `vassals`.",
      inputSchema: {},
      annotations: { readOnlyHint: true, openWorldHint: false },
    },
    async () => {
      const snap = await cache.get();
      if ("error" in snap) return { isError: true, content: [{ type: "text", text: snap.error }] };

      const t = snap.titles;
      const counts = [
        plural(t.empires.length, "empire"),
        plural(t.kingdoms.length, "kingdom"),
        plural(t.duchies.length, "duchy").replace("duchys", "duchies"),
        plural(t.counties.length, "county").replace("countys", "counties"),
        plural(t.baronies.length, "barony").replace("baronys", "baronies"),
      ].filter((c) => !c.startsWith("0 "));

      let body = `# Held titles — ${counts.length ? counts.join(", ") : "none"}\n`;
      if (t.total === 0) {
        body += "No titles held.\n";
      } else {
        body = renderTier(body, "Empires", t.empires, 50);
        body = renderTier(body, "Kingdoms", t.kingdoms, 50);
        body = renderTier(body, "Duchies", t.duchies, 50);
        body = renderTier(body, "Counties", t.counties, 50);
        body = renderTier(body, "Baronies", t.baronies, 20);
      }

      return { content: [{ type: "text", text: stamp(snap, body) }] };
    },
  );
}
```

Note on pluralization: `plural` handles the regular `-s` case; duchy/county/barony need the `-ies` form, handled by the `.replace(...)` calls. Keep the `plural` helper simple rather than building a full inflection map (YAGNI).

- [ ] **Step 4: Register the tool**

In `src/tools/index.ts`, import and call it inside `registerAllTools` alongside the others:

```ts
import { registerTitlesTool } from "./titles.js";
// ... inside registerAllTools(server, cache):
registerTitlesTool(server, cache);
```

- [ ] **Step 5: Run the tool test to verify it passes**

Run: `npx vitest run tests/titles.test.ts`
Expected: PASS.

- [ ] **Step 6: Full build + test gate**

Run: `npm run build && npm test`
Expected: PASS — clean tsc, whole suite green.

- [ ] **Step 7: Commit**

```bash
git add src/tools/titles.ts src/tools/index.ts tests/titles.test.ts
git commit -m "feat: add titles MCP tool"
```

---

### Task 5: Docs touch-up

**Files:**
- Modify: `README.md`
- Modify: `CLAUDE.md`

**Interfaces:**
- Consumes: nothing.
- Produces: nothing (docs only).

- [ ] **Step 1: Add `titles` to the tool list in both docs**

In `CLAUDE.md`, the "What this is" sentence lists the curated tools — add `titles` to that list. In `README.md`, add a `titles` entry to the tools section matching the format of the existing entries (name + one-line description: "Titles you personally hold, grouped by tier, each with its de jure liege").

- [ ] **Step 2: Verify nothing else references a stale tool count**

Run: `grep -rn "find_character" README.md CLAUDE.md`
Expected: confirm the tool enumerations are the only places needing the addition; update any "N tools" count if one exists.

- [ ] **Step 3: Commit**

```bash
git add README.md CLAUDE.md
git commit -m "docs: document the titles tool"
```

---

## Self-Review

**Spec coverage:**
- `titleTierFromKey` helper → Task 1. ✓
- `extractTitles` + `TitlesInfo`/`HeldTitle` → Task 2. ✓
- Fixture `de_jure_liege=1` tweak → Task 2, Step 1. ✓
- Snapshot wiring → Task 3. ✓
- `titles` tool (grouping, counts header, de-jure suffix, barony truncation, empty-domain, error passthrough, `stamp`) → Task 4. ✓
- Registration in `registerAllTools` → Task 4, Step 4. ✓
- Tests for helper, extractor, tool render → Tasks 1, 2, 4. ✓
- Honest scope description pointing to `vassals` → Task 4, Step 3. ✓
- Docs (not in spec but required by project convention for new tools) → Task 5. ✓

**Placeholder scan:** No TBD/TODO; all code shown in full. The two "match the existing harness" notes (Localizer construction, tool-test harness) are verification instructions, not placeholders — the inline fallback code is complete and runnable on its own.

**Type consistency:** `HeldTitle`/`TitlesInfo` defined in Task 2 and consumed unchanged in Tasks 3–4. `titleTierFromKey` signature identical across Tasks 1–2. `registerTitlesTool(server, cache)` signature matches sibling tools and its Task 4 call site.
