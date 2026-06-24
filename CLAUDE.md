# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this is

A local stdio **Model Context Protocol** server that reads the player's latest
**Crusader Kings III** save and exposes their strategic situation to Claude as
curated, read-only tools (`realm_overview`, `military`, `succession`,
`diplomacy`, `vassals`, `titles`, `factions`, `expansion`, `find_character`,
`character`).
It never modifies the save or the game. See `README.md` for install/config/usage.

## Commands

```bash
npm install
npm run build        # tsc -> dist/  (the registered MCP entry is dist/index.js)
npm run dev          # run the server from source via tsx (no build step)
npm test             # vitest run (whole suite)
npm run test:watch
npx vitest run tests/military.test.ts   # single test file
```

There is no lint step. The build itself (`tsc` with `strict: true`) is the type gate.

## Architecture

The data flows in one direction, save file → markdown tool output:

1. **`source.ts`** (`SaveFileSource`) — finds the newest **parseable (text)**
   `.ck3` in the save dir: sorts candidates by mtime (ignoring `last_save.ck3`),
   then reads each one's 256-byte header newest-first and returns the first
   whose `detectFormat` is `"text"`. This skips CK3 autosaves (always binary
   token format, regardless of Ironman) and Ironman saves, which are usually the
   newest file and would otherwise shadow a readable manual save. Falls back to
   the newest overall if none are text, so the binary/Ironman message still
   surfaces.
2. **`envelope.ts`** (`extractGamestate`) — a `.ck3` is `SAV`-header + an
   embedded PKZIP. Detects Ironman vs text saves, unzips, returns the
   `gamestate` entry as a Buffer. **Ironman detection is by the plaintext
   `meta_data={` marker in the first 256 bytes, NOT by PK presence** — both
   formats embed a zip. Ironman throws `IronmanError` (surfaced as a friendly
   message, not an error).
3. **`parser.ts`** (`queryGamestate`) — wraps a lazily-initialized `jomini`
   WASM parser singleton. Gives extractors a `Query` with `.at(jsonPointer)`.
4. **`snapshot.ts`** (`buildSnapshot`) — parses once and **eagerly** runs every
   extractor inside a single `queryGamestate` pass, producing a `Snapshot`
   (overview + military + succession + diplomacy + factions + vassals +
   expansion). One parse feeds all tools.
5. **`cache.ts`** (`SnapshotCache`) — keyed by `path:mtimeMs`. Returns the
   cached `Snapshot` if the newest save is unchanged; coalesces concurrent
   builds of the same save into one parse; **serves the last good snapshot on a
   transient/mid-write read failure**. Also lazily materializes the gamestate as
   text once per save (`rawGamestateText`) for `find_character`'s substring
   search, and exposes `query()` for tools that need a fresh jomini pass beyond
   the snapshot (e.g. `character`).
6. **`extract/*.ts`** — pure functions `(q: Query, loc: Localizer, ...) => Info`.
   No I/O, no MCP. This is where save-field knowledge lives.
7. **`tools/*.ts`** — each `registerXTool(server, cache)` registers one MCP tool:
   pull from `cache.get()` (or `cache.query()`), format markdown, return it.
   `tools/index.ts` wires them all up via `registerAllTools`.

`localization.ts` (`Localizer`) loads CK3 English `.yml` from `CK3_GAME_DIR` at
startup (recursively; nested subfolders). `resolve(key)` falls back to the raw
key when the game dir is absent. Trait names need a per-save index table set via
`setTraitLookup` from the gamestate's `traits_lookup` (done in `buildSnapshot`).

`format.ts` — `stamp(snapshot, body)` prefixes every tool response with the
save's in-game date and how long ago it was read; `truncate(items, n)` caps long
lists. Use both in any new tool for consistency.

## Working with save fields (read this before touching extractors)

**`docs/save-schema.md` is the canonical, jomini-verified field reference.**
Consult it before adding or changing any `q.at(...)` path. Recurring gotchas it
documents:

- **Array index access via JSON pointer is broken.** `q.at("/.../skill/0")`
  returns `undefined`. Always fetch the array with `q.at(parent)` and iterate in
  JS. This applies to `skill`, `traits`, `domain`, `succession`, `claim`,
  `members`, `participants`, every array.
- **Nesting traps:** title data is at `/landed_titles/landed_titles/{id}` (doubly
  nested); factions at `/faction_manager/factions`, not `/factions`.
- **Player-relative paths:** start from `pid = /played_character/character` and
  substitute into `/living/{pid}/...`. `alive_data/*` (gold, prestige, claims)
  vs `landed_data/*` (domain, levy, council, laws, succession) — some fields
  visible in raw text (`alive_data/council`, `alive_data/domain`) do NOT resolve
  through jomini; the schema marks the working path.
- Verify a new path resolves *through jomini*, not just in raw text, before
  relying on it (see below).

When mapping a new field against a real save:

```bash
node scripts/inspect-section.mjs <save.ck3|gamestate.txt> <needle> [bytes] [occurrence]
node scripts/check-paths.mjs   <save.ck3|gamestate.txt> '/living/{player}/...' [more ptrs]
```

`inspect-section` greps raw text; `check-paths` confirms a JSON pointer actually
resolves through jomini (and expands `{player}`). If you discover a new verified
path or gotcha, update `docs/save-schema.md` in the same change.

## Conventions

- **ESM + NodeNext.** All relative imports use explicit `.js` extensions, even
  from `.ts` sources (e.g. `import { stamp } from "../format.js"`). `type`-only
  imports use `import type`.
- **Tools never throw to the client.** On a missing/Ironman/unreadable save,
  `cache.get()` returns `{ error: string }`; return it as
  `{ isError: true, content: [{ type: "text", text: error }] }`.
- **Don't fabricate data the save doesn't store.** The save genuinely lacks a
  per-character men-at-arms breakdown, strong/weak claim distinction, and
  computed opinion totals. Tool descriptions state these limits; preserve that
  honesty rather than inventing values (see README "Known limitations").
- Tests are vitest, one `tests/<area>.test.ts` per extractor/tool, plus
  `tests/fixtures/` (a `mini-gamestate.txt` and `make-envelope.ts` for building
  a fake `.ck3`). New extractors get a matching test.
