# Held Titles Tool — Design

**Date:** 2026-06-24
**Status:** Approved, pending implementation

## Goal

Add a new read-only MCP tool, `titles`, that lists every title the player
character **personally holds** (their domain), grouped by tier, with each
title's de jure liege. This fills a gap: no existing tool enumerates the
player's held titles. `realm_overview` shows only the primary title; `vassals`
covers vassal-held titles; `expansion` covers claims and de jure *unheld*
titles.

## Scope

- **In scope:** Titles in the player's personal domain
  (`/living/{player}/landed_data/domain`) — empires, kingdoms, duchies,
  counties, and baronies the player holds directly.
- **Out of scope:** Titles held by vassals (already served by `vassals`), the
  full de jure realm tree, claims (served by `expansion`).

## Architecture

Follows the established one-direction flow (save → extractor → snapshot →
tool). No new I/O, no new save-schema paths — all fields used
(`domain`, `key`, `name`, `de_jure_liege`, `holder`) are already documented in
`docs/save-schema.md`.

### 1. `src/extract/titleUtils.ts` — new helper

Add `titleTierFromKey(key: string)` returning the tier derived from the key
prefix:

| prefix | tier      |
|--------|-----------|
| `e_`   | `empire`  |
| `k_`   | `kingdom` |
| `d_`   | `duchy`   |
| `c_`   | `county`  |
| `b_`   | `barony`  |
| other  | `other`   |

Keeps tier-prefix knowledge in one place, next to `resolveTitleName`, and makes
it independently unit-testable.

### 2. `src/extract/titles.ts` — new extractor

Pure function `extractTitles(q: Query, loc: Localizer): TitlesInfo`.

```ts
export interface HeldTitle {
  id: number;
  name: string;
  deJureLiege: string | null; // null for top-level (empire / no de_jure_liege)
}
export interface TitlesInfo {
  empires: HeldTitle[];
  kingdoms: HeldTitle[];
  duchies: HeldTitle[];
  counties: HeldTitle[];
  baronies: HeldTitle[];
  total: number;
}
```

Logic:
1. Read `/living/{player}/landed_data/domain` (array of numeric title IDs);
   default to `[]` if absent.
2. For each ID:
   - `name` via `resolveTitleName(q, loc, id)`.
   - tier via `titleTierFromKey` of `/landed_titles/landed_titles/{id}/key`.
   - `deJureLiege`: read `/landed_titles/landed_titles/{id}/de_jure_liege`; if a
     number, resolve via `resolveTitleName`; else `null`.
3. Bucket into the five tier arrays, preserving domain order within each tier.
   Titles whose tier is `other` are skipped (defensive; not expected in domain).
4. `total` = number of titles placed into buckets.

### 3. `src/snapshot.ts`

- Add `titles: TitlesInfo` to the `Snapshot` interface.
- Call `extractTitles(q, loc)` inside the single `queryGamestate` pass and
  include it in the returned snapshot.

### 4. `src/tools/titles.ts` — new tool

`registerTitlesTool(server, cache)`, tool name `titles`.

- Description (honest about scope): "Titles you personally hold (your domain),
  grouped by tier, each with its de jure liege. For titles held by your
  vassals, see `vassals`."
- `inputSchema: {}`, `annotations: { readOnlyHint: true, openWorldHint: false }`.
- On `cache.get()` returning `{ error }`, return
  `{ isError: true, content: [{ type: "text", text: error }] }`.
- Markdown body:
  - Header line with per-tier counts, e.g.
    `# Held titles — 1 empire, 1 kingdom, 3 duchies, …` (omit zero-count tiers;
    pluralize correctly).
  - One section per non-empty tier (Empires / Kingdoms / Duchies / Counties /
    Baronies), each entry `- Name (de jure: Liege)`; omit the `(de jure: …)`
    suffix when `deJureLiege` is `null`.
  - Baronies (usually the most numerous) capped via the existing `truncate`
    helper, with its standard "… and N more" note.
  - Empty domain → "No titles held." (defensive; a landed player always holds
    ≥1).
- Wrap the whole body in `stamp(snap, body)`.

### 5. `src/tools/index.ts`

Import and call `registerTitlesTool` in `registerAllTools`.

## Error handling

Identical to sibling tools: tools never throw to the client; `cache.get()`
surfaces missing/Ironman/unreadable saves as `{ error }`, which the tool returns
as an `isError` result.

## Testing — `tests/titles.test.ts`

- **Fixture change:** add `de_jure_liege=1` to title `2` (k_bohemia) in
  `tests/fixtures/mini-gamestate.txt` so de jure resolution is exercised.
- **`titleTierFromKey`:** each prefix maps correctly; unknown prefix → `other`.
- **`extractTitles`:** domain `{1, 2}` →
  - `empires`: `[{ id: 1, name: "The Holy Roman Empire", deJureLiege: null }]`
  - `kingdoms`: `[{ id: 2, name: "Bohemia", deJureLiege: "The Holy Roman Empire" }]`
  - `total === 2`; other tier arrays empty.
- **Tool render:** markdown contains the header counts and both title names; the
  kingdom line includes `(de jure: The Holy Roman Empire)`.

Per project convention, every new extractor gets a matching test.

## Conventions

- ESM + NodeNext: relative imports use explicit `.js` extensions; `import type`
  for type-only imports.
- Use `stamp` and `truncate` from `format.ts` for consistency with other tools.
- Don't fabricate data the save doesn't store.
