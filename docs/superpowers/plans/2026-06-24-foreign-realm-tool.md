# Foreign Realm Tool Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a read-only `foreign_realm` MCP tool that looks up any realm by name/key and reports its ruler, army strength, allies, liege, and active wars.

**Architecture:** Follows the project's one-direction flow (save → markdown). A pure extractor (`extractForeignRealm`) ranks a free-text query against every title's key/name/localized-key, resolves the best match's holder, and reads that ruler's army (`landed_data/strength`), allies (`active_relations`), liege (`de_facto_liege` → holder), and wars (`active_wars`). A thin tool (`registerForeignRealmTool`) is parameterised by user input, so it runs through `cache.query()` (like the `character` tool, NOT `buildSnapshot`), formats markdown, and stamps it.

**Tech Stack:** TypeScript (ESM + NodeNext, `strict`), jomini WASM parser, `@modelcontextprotocol/sdk`, zod, vitest.

## Global Constraints

- ESM + NodeNext: every relative import uses an explicit `.js` extension, even from `.ts` sources; type-only imports use `import type`.
- Tools never throw to the client: on `cache.get()` / `cache.query()` returning `{ error }`, return `{ isError: true, content: [{ type: "text", text: error }] }`.
- Use `stamp(snap, body)` to prefix tool output.
- Don't fabricate data the save doesn't store: missing army strength renders "not recorded", never a number.
- Build gate is `npm run build` (tsc strict); test gate is `npm test` (vitest run).
- No new save-schema paths are introduced; all fields are already in `docs/save-schema.md`. Verified against a real save: AI rulers' `landed_data/strength`/`current_strength` are populated, AI–AI alliances resolve via `active_relations`, and AI rulers appear in `active_wars`.

## File Structure

- Create: `src/extract/foreignRealm.ts` — pure extractor + matching helper.
- Create: `src/tools/foreignRealm.ts` — MCP tool registration + pure markdown formatter.
- Create: `tests/foreignRealm.test.ts` — extractor + formatter + tool-handler tests.
- Modify: `tests/fixtures/mini-gamestate.txt` — add AI-ruled realms (additive only).
- Modify: `src/tools/index.ts` — wire `registerForeignRealmTool` into `registerAllTools`.
- Modify: `README.md`, `CLAUDE.md` — add `foreign_realm` to the tool list.

---

### Task 1: `extractForeignRealm` — matching, realm, ruler, army, liege

**Files:**
- Create: `src/extract/foreignRealm.ts`
- Modify: `tests/fixtures/mini-gamestate.txt`
- Test: `tests/foreignRealm.test.ts` (create)

**Interfaces:**
- Consumes: `Query` (`src/parser.js`), `Localizer` (`src/localization.js`), `resolveTitleName`, `titleTierFromKey`, `TitleTier` (`src/extract/titleUtils.js`), `extractCharacter` (`src/extract/characters.js`).
- Produces:
  - `findBestTitle(q: Query, loc: Localizer, name: string): number | null`
  - `extractForeignRealm(q: Query, loc: Localizer, name: string): ForeignRealmInfo | null`
  - Types `AllyRef`, `ForeignWar`, `RulerRef`, `ForeignRealmInfo` (full shape below; `allies`/`wars` are populated in Task 2, returned as `[]` here).

- [ ] **Step 1: Extend the test fixture (additive only)**

Edit `tests/fixtures/mini-gamestate.txt`. These additions introduce three new titles (ids 4/5/6) and three new characters (40000/40001/40002), a new alliance, and a new war — none involve the player, so existing player-centric tests are unaffected. **Do NOT give title 3 (`k_lotharingia`) a holder** — `expansion.test.ts` asserts it stays de-jure-unheld.

In the `landed_titles` inner map, change the title `3` line to also include the three new titles. Replace:

```
3={ key="k_lotharingia" name="Lotharingia" }
```

with:

```
3={ key="k_lotharingia" name="Lotharingia" }
4={ key="k_scotland" name="Alba" holder=40000 }
5={ key="k_france" name="France" holder=40001 }
6={ key="d_scotland" name="Lothian" holder=40002 de_facto_liege=4 }
```

In the `living` map, insert three characters before its closing `}` (i.e. after the Adela block that ends at the line `}` on its own following `22222={ ... }`). Replace:

```
22222={
	first_name="Adela"
	dynasty_house=4872
	traits={ 1 }
	skill={ 3 3 3 3 3 3 }
	alive_data={ gold=5.0 }
	landed_data={ domain={ 2 } strength_for_liege=500 }
}
}
```

with:

```
22222={
	first_name="Adela"
	dynasty_house=4872
	traits={ 1 }
	skill={ 3 3 3 3 3 3 }
	alive_data={ gold=5.0 }
	landed_data={ domain={ 2 } strength_for_liege=500 }
}
40000={
	first_name="Causantin"
	skill={ 5 7 4 3 6 8 }
	alive_data={ gold=88.0 prestige={ currency=200.0 accumulated=500.0 } }
	landed_data={ domain={ 4 } strength=6000.0 current_strength=5500.0 levy=4000.0 }
}
40001={
	first_name="Philippe"
	skill={ 6 5 5 4 4 5 }
	alive_data={ gold=50.0 }
	landed_data={ domain={ 5 } strength=7000.0 current_strength=7000.0 }
}
40002={
	first_name="Domnall"
	skill={ 2 2 2 2 2 2 }
	alive_data={ gold=3.0 }
	landed_data={ domain={ 6 } strength_for_liege=200 }
}
}
```

In the `wars/active_wars` map, add a second war (the foreign king 40000 attacking). Replace:

```
9001={
	start_date=1131.2.1
	name="garbage ONCLICK markup"
	casus_belli={ type="claim_cb" attacker=33564206 defender=22222 targeted_titles={ 2 } }
	attacker={ participants={ { character=33564206 } } ticking_war_score=12.5 }
	defender={ participants={ { character=22222 } } ticking_war_score=3.0 }
}
}
```

with:

```
9001={
	start_date=1131.2.1
	name="garbage ONCLICK markup"
	casus_belli={ type="claim_cb" attacker=33564206 defender=22222 targeted_titles={ 2 } }
	attacker={ participants={ { character=33564206 } } ticking_war_score=12.5 }
	defender={ participants={ { character=22222 } } ticking_war_score=3.0 }
}
9002={
	start_date=1129.5.1
	casus_belli={ type="conquest_cb" targeted_titles={ 6 } }
	attacker={ participants={ { character=40000 } } ticking_war_score=5.0 }
	defender={ participants={ { character=99999 } } ticking_war_score=2.0 }
}
}
```

In `relations/active_relations`, add a second relation object (40000 allied to 40001). Replace:

```
{ first=33564206 second=22222 alliances={ { allied_through_0=33564206 allied_through_1=22222 } } truce_0={ date=1135.6.1 result="victory" } }
}
```

with:

```
{ first=33564206 second=22222 alliances={ { allied_through_0=33564206 allied_through_1=22222 } } truce_0={ date=1135.6.1 result="victory" } }
{ first=40000 second=40001 alliances={ { allied_through_0=40000 allied_through_1=40001 } } }
}
```

- [ ] **Step 2: Confirm the fixture edit didn't regress existing tests**

Run: `npm test`
Expected: PASS — the whole existing suite stays green (the additions are excluded by every player-centric extractor). If anything fails, the fixture was edited wrong (e.g. a holder added to title 3); fix before continuing.

- [ ] **Step 3: Write the failing test**

Create `tests/foreignRealm.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { queryGamestate } from "../src/parser.js";
import { extractForeignRealm } from "../src/extract/foreignRealm.js";
import { Localizer } from "../src/localization.js";

const GS = readFileSync(
  fileURLToPath(new URL("./fixtures/mini-gamestate.txt", import.meta.url)),
);
const run = (name: string) =>
  queryGamestate(GS, (q) => extractForeignRealm(q, new Localizer(null), name));

describe("extractForeignRealm — matching & core", () => {
  it("matches by display name and reports realm, tier, ruler, army", async () => {
    const r = await run("Alba");
    expect(r).not.toBeNull();
    expect(r!.titleId).toBe(4);
    expect(r!.realmName).toBe("Alba");
    expect(r!.tier).toBe("kingdom");
    expect(r!.ruler).toEqual({
      id: 40000, name: "Causantin", martial: 7, gold: 88, prestige: 500,
    });
    expect(r!.strength).toBe(6000);
    expect(r!.currentStrength).toBe(5500);
  });

  it("matches by title key", async () => {
    const r = await run("k_france");
    expect(r!.titleId).toBe(5);
    expect(r!.realmName).toBe("France");
  });

  it("resolves 'Alba' and 'Scotland' to the same realm (name vs key)", async () => {
    const byName = await run("Alba");
    const byKey = await run("scotland"); // matches k_scotland's key
    expect(byKey!.tier).toBe("kingdom"); // kingdom beats the d_scotland duchy
    expect(byKey!.titleId).toBe(byName!.titleId);
    expect(byKey!.titleId).toBe(4);
  });

  it("prefers the higher tier when several titles match", async () => {
    // "scotland" is in both k_scotland (id 4) and d_scotland (id 6); kingdom wins.
    const r = await run("scotland");
    expect(r!.titleId).toBe(4);
    expect(r!.tier).toBe("kingdom");
  });

  it("reports independent when the title has no de_facto_liege", async () => {
    const r = await run("Alba");
    expect(r!.liege).toBeNull();
  });

  it("reports the liege's holder when the title is a vassal", async () => {
    const r = await run("d_scotland"); // de_facto_liege=4, whose holder is 40000
    expect(r!.titleId).toBe(6);
    expect(r!.liege).toEqual({ id: 40000, name: "Causantin" });
  });

  it("returns null for an unknown realm", async () => {
    expect(await run("Atlantis")).toBeNull();
    expect(await run("")).toBeNull();
  });
});
```

- [ ] **Step 4: Run the test to verify it fails**

Run: `npx vitest run tests/foreignRealm.test.ts`
Expected: FAIL — `extractForeignRealm` is not exported / module not found.

- [ ] **Step 5: Write the implementation**

Create `src/extract/foreignRealm.ts`:

```ts
import type { Query } from "../parser.js";
import type { Localizer } from "../localization.js";
import { resolveTitleName, titleTierFromKey, type TitleTier } from "./titleUtils.js";
import { extractCharacter } from "./characters.js";

export interface AllyRef { id: number; name: string; realm: string | null }
export interface ForeignWar { side: "attacker" | "defender"; cbType: string; targetTitle: string | null }
export interface RulerRef { id: number; name: string; martial: number; gold: number | null; prestige: number | null }
export interface ForeignRealmInfo {
  titleId: number;
  realmName: string;
  tier: TitleTier;
  ruler: RulerRef;
  strength: number | null;
  currentStrength: number | null;
  liege: { id: number; name: string } | null; // null => independent
  allies: AllyRef[];
  wars: ForeignWar[];
}

function tierRank(t: TitleTier): number {
  switch (t) {
    case "empire": return 5;
    case "kingdom": return 4;
    case "duchy": return 3;
    case "county": return 2;
    case "barony": return 1;
    default: return 0;
  }
}

function charName(q: Query, id: number): string {
  return String(q.at(`/living/${id}/first_name`) ?? "unknown");
}

// Best-match title id for a free-text realm name or key.
// Ranks by match quality (exact > substring), then held > unheld, then tier.
export function findBestTitle(q: Query, loc: Localizer, name: string): number | null {
  const needle = name.trim().toLowerCase();
  if (needle === "") return null;
  const titles = q.at("/landed_titles/landed_titles") as
    | Record<string, Record<string, unknown>>
    | undefined;
  if (!titles) return null;

  let best: { id: number; quality: number; held: number; tier: number } | null = null;
  for (const [idStr, t] of Object.entries(titles)) {
    if (!t || typeof t !== "object") continue;
    const key = typeof t["key"] === "string" ? (t["key"] as string) : "";
    const dispName = typeof t["name"] === "string" ? (t["name"] as string) : "";
    const candidates = [key.toLowerCase(), dispName.toLowerCase(), loc.resolve(key).toLowerCase()];

    let quality = 0;
    if (candidates.some((c) => c === needle)) quality = 2;
    else if (candidates.some((c) => c !== "" && c.includes(needle))) quality = 1;
    if (quality === 0) continue;

    const held = typeof t["holder"] === "number" ? 1 : 0;
    const tier = tierRank(titleTierFromKey(key));
    const id = Number(idStr);
    const better =
      best === null ||
      quality > best.quality ||
      (quality === best.quality && held > best.held) ||
      (quality === best.quality && held === best.held && tier > best.tier);
    if (better) best = { id, quality, held, tier };
  }
  return best ? best.id : null;
}

export function extractForeignRealm(q: Query, loc: Localizer, name: string): ForeignRealmInfo | null {
  const titleId = findBestTitle(q, loc, name);
  if (titleId === null) return null;

  const tPath = `/landed_titles/landed_titles/${titleId}`;
  const key = (q.at(`${tPath}/key`) as string | undefined) ?? "";
  const tier = titleTierFromKey(key);
  const realmName = resolveTitleName(q, loc, titleId);

  const holderId = q.at(`${tPath}/holder`) as number | undefined;

  // Ruler — reuse the character extractor for name/martial/gold/prestige.
  let ruler: RulerRef;
  if (typeof holderId === "number") {
    const c = extractCharacter(q, loc, holderId);
    ruler = c
      ? { id: holderId, name: c.name, martial: c.skills.martial, gold: c.gold, prestige: c.prestige }
      : { id: holderId, name: "unknown", martial: 0, gold: null, prestige: null };
  } else {
    ruler = { id: -1, name: "unheld", martial: 0, gold: null, prestige: null };
  }

  // Army — same fields as the military extractor, read off the holder.
  const sRaw = typeof holderId === "number" ? q.at(`/living/${holderId}/landed_data/strength`) : undefined;
  const csRaw = typeof holderId === "number" ? q.at(`/living/${holderId}/landed_data/current_strength`) : undefined;
  const strength = typeof sRaw === "number" ? sRaw : null;
  const currentStrength = typeof csRaw === "number" ? csRaw : null;

  // Liege — de_facto_liege title's holder; null => independent.
  const liegeTitleId = q.at(`${tPath}/de_facto_liege`) as number | undefined;
  let liege: { id: number; name: string } | null = null;
  if (typeof liegeTitleId === "number") {
    const liegeHolder = q.at(`/landed_titles/landed_titles/${liegeTitleId}/holder`) as number | undefined;
    if (typeof liegeHolder === "number") liege = { id: liegeHolder, name: charName(q, liegeHolder) };
  }

  // allies/wars filled in Task 2
  const allies: AllyRef[] = [];
  const wars: ForeignWar[] = [];

  return { titleId, realmName, tier, ruler, strength, currentStrength, liege, allies, wars };
}
```

- [ ] **Step 6: Run the test to verify it passes**

Run: `npx vitest run tests/foreignRealm.test.ts`
Expected: PASS (all 7 cases).

- [ ] **Step 7: Build**

Run: `npm run build`
Expected: no type errors.

- [ ] **Step 8: Commit**

```bash
git add src/extract/foreignRealm.ts tests/foreignRealm.test.ts tests/fixtures/mini-gamestate.txt
git commit -m "feat: add extractForeignRealm with matching, ruler, army, liege"
```

---

### Task 2: Allies & active wars on the extractor

**Files:**
- Modify: `src/extract/foreignRealm.ts`
- Test: `tests/foreignRealm.test.ts` (add a describe block)

**Interfaces:**
- Consumes: everything from Task 1.
- Produces: `extractForeignRealm` now populates `allies: AllyRef[]` and `wars: ForeignWar[]` (types unchanged from Task 1).

- [ ] **Step 1: Write the failing test**

Append to `tests/foreignRealm.test.ts`:

```ts
describe("extractForeignRealm — allies & wars", () => {
  it("lists allies by their primary title where resolvable", async () => {
    const r = await run("Alba"); // 40000 allied to 40001 (holds k_france)
    expect(r!.allies).toEqual([{ id: 40001, name: "Philippe", realm: "France" }]);
  });

  it("lists the ruler's active wars with side and target title", async () => {
    const r = await run("Alba"); // war 9002: 40000 attacker, targets title 6 (Lothian)
    expect(r!.wars).toEqual([
      { side: "attacker", cbType: "conquest_cb", targetTitle: "Lothian" },
    ]);
  });

  it("returns empty allies/wars for a ruler with neither", async () => {
    const r = await run("k_france"); // 40001: allied (covered above) but check Lothian's duke
    const duke = await run("d_scotland"); // 40002: no alliance, no war
    expect(duke!.allies).toEqual([]);
    expect(duke!.wars).toEqual([]);
    expect(r).not.toBeNull();
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run tests/foreignRealm.test.ts`
Expected: FAIL — the allies/wars cases expect populated arrays but the extractor returns `[]`.

- [ ] **Step 3: Add the collector helpers and wire them in**

In `src/extract/foreignRealm.ts`, add these two functions above `extractForeignRealm`:

```ts
// Alliances for a ruler — mirrors the diplomacy extractor, keyed by holder id.
function collectAllies(q: Query, loc: Localizer, holderId: number): AllyRef[] {
  const rels = (q.at("/relations/active_relations") as Record<string, unknown>[] | undefined) ?? [];
  const out: AllyRef[] = [];
  for (const entry of rels) {
    if (!entry || typeof entry !== "object") continue;
    const first = entry["first"] as number | undefined;
    const second = entry["second"] as number | undefined;
    if (first !== holderId && second !== holderId) continue;
    if (entry["alliances"] == null) continue;
    const otherId = (first === holderId ? second : first) as number;
    const domain = (q.at(`/living/${otherId}/landed_data/domain`) as number[] | undefined) ?? [];
    const realm = domain[0] !== undefined ? resolveTitleName(q, loc, domain[0]) : null;
    out.push({ id: otherId, name: charName(q, otherId), realm });
  }
  return out;
}

// Active wars a ruler participates in — mirrors the military extractor.
function collectWars(q: Query, loc: Localizer, holderId: number): ForeignWar[] {
  const activeWars = q.at("/wars/active_wars") as Record<string, unknown> | undefined;
  const out: ForeignWar[] = [];
  if (!activeWars || typeof activeWars !== "object") return out;
  for (const warValue of Object.values(activeWars)) {
    if (!warValue || typeof warValue !== "object") continue;
    const war = warValue as Record<string, unknown>;
    const att = war["attacker"] as Record<string, unknown> | undefined;
    const def = war["defender"] as Record<string, unknown> | undefined;
    const attP = (att?.["participants"] as Array<{ character: number }> | undefined) ?? [];
    const defP = (def?.["participants"] as Array<{ character: number }> | undefined) ?? [];
    const isAtt = attP.some((p) => p.character === holderId);
    const isDef = !isAtt && defP.some((p) => p.character === holderId);
    if (!isAtt && !isDef) continue;
    const cb = war["casus_belli"] as Record<string, unknown> | undefined;
    const cbType = typeof cb?.["type"] === "string" ? (cb["type"] as string) : "";
    const targeted = (cb?.["targeted_titles"] as number[] | undefined) ?? [];
    const targetTitle = targeted[0] !== undefined ? resolveTitleName(q, loc, targeted[0]) : null;
    out.push({ side: isAtt ? "attacker" : "defender", cbType, targetTitle });
  }
  return out;
}
```

Then, in `extractForeignRealm`, replace:

```ts
  // allies/wars filled in Task 2
  const allies: AllyRef[] = [];
  const wars: ForeignWar[] = [];
```

with:

```ts
  const allies = typeof holderId === "number" ? collectAllies(q, loc, holderId) : [];
  const wars = typeof holderId === "number" ? collectWars(q, loc, holderId) : [];
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npx vitest run tests/foreignRealm.test.ts`
Expected: PASS (all cases, old and new).

- [ ] **Step 5: Build**

Run: `npm run build`
Expected: no type errors.

- [ ] **Step 6: Commit**

```bash
git add src/extract/foreignRealm.ts tests/foreignRealm.test.ts
git commit -m "feat: add allies and active wars to extractForeignRealm"
```

---

### Task 3: `foreign_realm` MCP tool + wiring + docs

**Files:**
- Create: `src/tools/foreignRealm.ts`
- Modify: `src/tools/index.ts`
- Modify: `README.md`, `CLAUDE.md`
- Test: `tests/foreignRealm.test.ts` (add a describe block)

**Interfaces:**
- Consumes: `extractForeignRealm`, `ForeignRealmInfo` (`src/extract/foreignRealm.js`); `stamp` (`src/format.js`); `SnapshotCache` (`cache.query`, `cache.get`, `cache.loc`).
- Produces:
  - `formatForeignRealm(info: ForeignRealmInfo): string` (pure body formatter)
  - `registerForeignRealmTool(server: McpServer, cache: SnapshotCache): void`

- [ ] **Step 1: Write the failing test**

Append to `tests/foreignRealm.test.ts`:

```ts
import { formatForeignRealm, registerForeignRealmTool } from "../src/tools/foreignRealm.js";
import type { ForeignRealmInfo } from "../src/extract/foreignRealm.js";

describe("foreign_realm tool", () => {
  const info: ForeignRealmInfo = {
    titleId: 4, realmName: "Alba", tier: "kingdom",
    ruler: { id: 40000, name: "Causantin", martial: 7, gold: 88, prestige: 500 },
    strength: 6000, currentStrength: 5500, liege: null,
    allies: [{ id: 40001, name: "Philippe", realm: "France" }],
    wars: [{ side: "attacker", cbType: "conquest_cb", targetTitle: "Lothian" }],
  };

  it("formats a realm dossier", () => {
    const text = formatForeignRealm(info);
    expect(text).toContain("# Alba (Kingdom)");
    expect(text).toContain("Ruler: Causantin (id 40000) — Mar 7 | Gold 88 | Prestige 500");
    expect(text).toContain("Army: 6000 (current 5500)");
    expect(text).toContain("Liege: independent");
    expect(text).toContain("Allies: France (Philippe)");
    expect(text).toContain("Wars: attacker vs Lothian");
  });

  it("renders missing data honestly", () => {
    const bare = formatForeignRealm({
      ...info, strength: null, currentStrength: null,
      liege: { id: 1, name: "Otto" }, allies: [], wars: [],
    });
    expect(bare).toContain("Army: not recorded");
    expect(bare).toContain("Liege: vassal of Otto");
    expect(bare).toContain("Allies: none");
    expect(bare).toContain("Wars: none");
  });

  it("returns a stamped no-match line when nothing matches", async () => {
    const snap = { date: "1130-07-24", parsedAt: Date.now() } as any;
    const cache = { get: async () => snap, query: async () => null, loc: null } as any;
    let handler: any;
    const server = { registerTool: (_n: string, _c: any, h: any) => { handler = h; } } as any;
    registerForeignRealmTool(server, cache);
    const res = await handler({ name: "Atlantis" });
    expect(res.isError).toBeUndefined();
    expect(res.content[0].text).toContain("No realm matching 'Atlantis'.");
  });

  it("surfaces a cache error as isError", async () => {
    const cache = { get: async () => ({ error: "no save" }) } as any;
    let handler: any;
    const server = { registerTool: (_n: string, _c: any, h: any) => { handler = h; } } as any;
    registerForeignRealmTool(server, cache);
    const res = await handler({ name: "Alba" });
    expect(res.isError).toBe(true);
    expect(res.content[0].text).toBe("no save");
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run tests/foreignRealm.test.ts`
Expected: FAIL — `../src/tools/foreignRealm.js` cannot be resolved.

- [ ] **Step 3: Write the tool**

Create `src/tools/foreignRealm.ts`:

```ts
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import type { SnapshotCache } from "../cache.js";
import { extractForeignRealm, type ForeignRealmInfo } from "../extract/foreignRealm.js";
import { stamp } from "../format.js";

const TIER_LABEL: Record<string, string> = {
  empire: "Empire", kingdom: "Kingdom", duchy: "Duchy",
  county: "County", barony: "Barony", other: "Title",
};

export function formatForeignRealm(info: ForeignRealmInfo): string {
  const army =
    info.strength === null
      ? "not recorded"
      : `${Math.round(info.strength)}${info.currentStrength !== null ? ` (current ${Math.round(info.currentStrength)})` : ""}`;
  const liege = info.liege ? `vassal of ${info.liege.name}` : "independent";
  const allies =
    info.allies.length === 0
      ? "none"
      : info.allies.map((a) => (a.realm ? `${a.realm} (${a.name})` : a.name)).join(", ");
  const wars =
    info.wars.length === 0
      ? "none"
      : info.wars.map((w) => `${w.side} vs ${w.targetTitle ?? (w.cbType || "?")}`).join(", ");

  return (
    `# ${info.realmName} (${TIER_LABEL[info.tier]})\n` +
    `- Ruler: ${info.ruler.name} (id ${info.ruler.id}) — Mar ${info.ruler.martial} | ` +
    `Gold ${info.ruler.gold ?? "?"} | Prestige ${info.ruler.prestige ?? "?"}\n` +
    `- Army: ${army}\n` +
    `- Liege: ${liege}\n` +
    `- Allies: ${allies}\n` +
    `- Wars: ${wars}`
  );
}

export function registerForeignRealmTool(server: McpServer, cache: SnapshotCache) {
  server.registerTool(
    "foreign_realm",
    {
      title: "Foreign Realm",
      description:
        'Look up any realm by name or title key (e.g. "Scotland", "k_france") — its ruler, ' +
        "army strength, allies, liege, and active wars. For your own realm use `realm_overview`.",
      inputSchema: { name: z.string().describe("realm name or title key, full or partial") },
      annotations: { readOnlyHint: true, openWorldHint: false },
    },
    async ({ name }: { name: string }) => {
      const snap = await cache.get();
      if ("error" in snap) return { isError: true, content: [{ type: "text", text: snap.error }] };

      const result = await cache.query((q) => extractForeignRealm(q, cache.loc, name));
      if (result !== null && typeof result === "object" && "error" in result) {
        return { isError: true, content: [{ type: "text", text: (result as { error: string }).error }] };
      }
      const info = result as ForeignRealmInfo | null;
      if (!info) {
        return { content: [{ type: "text", text: stamp(snap, `No realm matching '${name}'.`) }] };
      }
      return { content: [{ type: "text", text: stamp(snap, formatForeignRealm(info)) }] };
    },
  );
}
```

- [ ] **Step 4: Wire the tool into `registerAllTools`**

In `src/tools/index.ts`, add the import after the `registerTitlesTool` import:

```ts
import { registerForeignRealmTool } from "./foreignRealm.js";
```

and add the call at the end of `registerAllTools` (after `registerTitlesTool(server, cache);`):

```ts
  registerForeignRealmTool(server, cache);
```

- [ ] **Step 5: Run the test to verify it passes**

Run: `npx vitest run tests/foreignRealm.test.ts`
Expected: PASS (all describe blocks).

- [ ] **Step 6: Update the docs**

In `README.md`, find the tool list/table and add a `foreign_realm` row matching the existing format, described as: "Look up any realm by name/key — ruler, army, allies, liege, active wars."

In `CLAUDE.md`, the "What this is" paragraph lists the tools in backticks. Add `` `foreign_realm` `` to that list (after `` `find_character` ``/`` `character` `` or alongside the realm tools — keep it readable).

- [ ] **Step 7: Full build + test gate**

Run: `npm run build && npm test`
Expected: no type errors; whole suite PASSES.

- [ ] **Step 8: Commit**

```bash
git add src/tools/foreignRealm.ts src/tools/index.ts tests/foreignRealm.test.ts README.md CLAUDE.md
git commit -m "feat: add foreign_realm MCP tool"
```

---

## Self-Review

**Spec coverage:**
- Interface `foreign_realm(name)` → Task 3 tool. ✓
- Best-single-match (key/name/localized, exact>substring, held>unheld, tier) → Task 1 `findBestTitle`. ✓
- Output: realm+tier, ruler+id, army (with "not recorded"), allies by primary title, liege status, active wars, ruler key stats → Tasks 1–3. ✓
- Architecture: pure extractor + thin `cache.query` tool, reuse `resolveTitleName`/`titleTierFromKey`/`extractCharacter`, generalised relation/war scans → Tasks 1–2. ✓
- Error handling: no throw, honest missing data → Task 3 tool + formatter. ✓
- Testing: match by key, by name, Alba≡Scotland, tier preference, army/allies/liege/war, no-match → Tasks 1–3. ✓
- Docs: README + CLAUDE.md → Task 3 Step 6. ✓
- No new save-schema paths. ✓

**Placeholder scan:** none — all steps contain concrete code/commands.

**Type consistency:** `ForeignRealmInfo`/`AllyRef`/`ForeignWar`/`RulerRef` defined once in Task 1 and reused verbatim in Tasks 2–3. `findBestTitle`, `extractForeignRealm`, `formatForeignRealm`, `registerForeignRealmTool` names consistent across tasks. `cache.query`/`cache.get`/`cache.loc` usage matches `src/tools/character.ts`.
