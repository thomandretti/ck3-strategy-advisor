# CK3 Strategy Advisor — MCP Server Design

**Date:** 2026-06-22
**Status:** Approved (design phase)

## Summary

A local MCP server that reads Crusader Kings III save files, extracts a compact,
curated snapshot of the player's strategic situation, and exposes it to Claude as
a set of tools. The goal: get strategic help at decision points (war, succession,
marriage, scheming, expansion) without manually describing the game state or
pasting screenshots.

The primary mode is **snapshot consultation** (mode A): the player saves at a
decision point, then asks Claude, which reasons over the latest save. The design
keeps a clean seam so a future **live advisor** (mode B) can be added without a
rewrite.

## Goals & Non-Goals

**Goals (v1):**
- Read non-Ironman CK3 saves and expose strategic state via MCP tools.
- Strict token discipline: tools return compact, curated views — never raw save subtrees.
- Human-readable output (names resolved from IDs; Markdown responses).
- Robust to large saves (~100 MB plaintext gamestate) and mid-write files.
- Architected so a live source (mode B) can be added behind the same interface.

**Non-Goals (v1):**
- Ironman/binary save parsing (detected and refused with a friendly message).
- A CK3 mod. Mode A needs **no mod at all** — it only reads save files.
- Full casus-belli rule enumeration (reimplementing CK3's CB eligibility rules).
- Non-English localization.
- Writing back to the game / automating play.

## Context: the save format (verified against a real save)

Inspected `Emperor_Jenec_of_the_Holy_Roman_Empire_1130_07_24.ck3` (a mid-game
non-Ironman save) to ground the design:

- File layout: `SAV` header → **plaintext `meta_data` block** (~28 KB) → **embedded
  PKZIP** (sig at offset 28574) containing a single `gamestate` entry.
- `gamestate` is **plaintext Paradox (Jomini) format**, ~102 MB uncompressed for
  this mid-game save. Late game will be larger.
- `meta_data` alone is a cheap header: player name, primary title, date, tier,
  house — usable for a fast `realm_overview` without touching the 100 MB body.
- Nested entries are **not** consistently indented (e.g. `landed_titles` children
  sit at column 0), so naive line/regex parsing is unsafe — a real bracket-aware
  parser is required.
- Verified the strategic sections exist by name in the gamestate:
  `played_character` / `currently_played_characters` (player id, e.g.
  `character=33564206`), `wars`/`war`, `alliances`/`relations`, `schemes`/`secrets`,
  `council`, `factions`, `religion`/`faiths`, `dynasties`, `character_lookup`,
  `succession`, `opinions`, `landed_titles`, `living`/`dead_unprunable`.
- The parent-directory `last_save.ck3` (~200 MB) has an unusual header (binary
  bytes immediately after the SAV header; PKZIP sig deep in the file). It is a
  **known edge case** — v1 targets the named saves in `save games/` and skips/notes
  `last_save.ck3` rather than blocking on it.

## Environment

- CK3 runs on **Windows**; saves live under
  `/mnt/c/Users/<user>/Documents/Paradox Interactive/Crusader Kings III/save games/`.
- The MCP server runs in **WSL**, reading across the `/mnt/c` boundary.
- The user talks to Claude via **Claude Code / Claude Desktop** (stdio MCP transport).
- Non-Ironman play (text-format saves).

## Stack

**TypeScript / Node.js.**

- Parser: the **`jomini` npm package** (by the Rakaly author) — reads the SAV
  envelope (plaintext meta + embedded zip + plaintext gamestate) and exposes a
  query API so we can pull only the sections we need instead of materializing the
  whole 100 MB tree.
- MCP: the **official MCP TypeScript SDK** (stdio transport).
- Rationale: both halves are mature in one language, the FFI-free boundary gives
  fast iteration on the tool surface (where most effort goes), and `jomini`-npm
  targets plaintext saves — exactly the non-Ironman case. (The `Jomini` package on
  PyPI is unrelated; there is no mature first-party Python binding, which is why
  Python was not chosen. Rust was the runner-up — fastest and native Ironman
  support — but slower iteration on the tool surface outweighed that for a
  parse-once-and-cache snapshot use case.)

## Architecture

One-way pipeline with a deliberate seam at the `Snapshot` boundary:

```
save files (/mnt/c)        ── Source ──►  raw parse  ──► Extractor ──► Snapshot ──► cache ──► MCP tools ──► Claude
[ .ck3 in "save games/" ]  (file watch)   (jomini)      (+localization) (compact)
```

### Components

1. **Source** (pluggable interface) — `SaveFileSource` watches the save-games
   directory, selects the newest `.ck3` (or a configured file), reads the bytes.
   This is the **mode-B seam**: a future `LiveLogSource` implements the same
   interface and produces the same `Snapshot`; nothing downstream changes.
2. **Parser** — `jomini` decodes the SAV envelope. The extractor uses jomini's
   **query API to pull only needed sections** to bound memory and time.
3. **Extractor** — walks parsed sections, resolves numeric IDs, and produces a
   compact, curated `Snapshot` domain model. **All token discipline lives here**;
   raw subtrees never leave this layer.
4. **Localization resolver** — maps title / trait / culture / faith keys to display
   names using the game install's `localization/english/*.yml` plus names embedded
   in the save (e.g. character first names, house names). Falls back to raw keys
   and warns once when a string is missing. Trait indices resolve via the save's
   `traits_lookup`, then the yml.
5. **Cache** — keyed on save path + mtime/hash. Parse + extract **once per save
   change** (debounced, since CK3 may be mid-write). Every tool call is served from
   the cached `Snapshot`. A `refresh` capability can force a re-read.
6. **MCP server** — stdio transport (Claude Desktop + Claude Code). Exposes the
   tools below. Every response is stamped with the snapshot's in-game date and
   wall-clock age so staleness is always visible.

### Mode-A loop

Player hits save at a decision point → watcher debounces and rebuilds the snapshot
→ player asks Claude → tools answer from cache, stamped with snapshot date/age.

## Tool surface

Tools are organized around the strategic questions asked at a decision point. Each
returns **compact Markdown** (counts, top-N, summaries — never raw subtrees),
stamped with the snapshot date/age.

**v1 tools:**

- **`realm_overview`** — the cheap header (partly from `meta_data`): ruler
  name/age/health/stress, key traits, prestige/piety/gold + monthly income,
  lifestyle/focus, primary title & tier, realm size, vassal count, active-war
  count, succession law, biggest looming problem.
- **`military`** — levy + men-at-arms strength; current wars (belligerents, war
  score, your contribution, time left); strength comparison vs. neighbors / the
  war target.
- **`succession`** — heir(s), succession law, **partition preview** (who inherits
  what titles), heir quality, rival claimants/pretenders.
- **`diplomacy`** — alliances, active truces, opinion of/from neighbors and liege,
  marriage candidates, simple threat ranking.
- **`vassals`** — top-N vassals by power: opinion of you, faction membership,
  council seat, and a danger flag (powerful + low opinion + in a faction).
- **`factions`** — active factions, members, strength vs. you, and goals.
- **`expansion`** — the honest, save-backed answer to "what can I press right now?":
  held claims (target title, strength, press status), de jure targets adjacent to
  the realm, and the CBs attached to ongoing wars.
- **`character`** — full detail on one character by name or id (traits, stats,
  relations, opinions, secrets held on them). **`find_character`** resolves a name → id.

**Deferred (designed-for, out of v1):**
- `intrigue` — your schemes + schemes against you, secrets, hooks.
- `council` — councillor tasks/skills (partly folded into `vassals`/`realm_overview`).
- `economy` — detailed budget breakdown.
- Full casus-belli enumeration — CBs are computed at runtime from CK3's rules
  (de jure rights, holy-war eligibility, claims, drift thresholds). v1 surfaces the
  **stored** facts (claims + de jure + active-war CBs) via `expansion`; Claude
  reasons about fabrication/holy-war opportunities from the realm picture without
  us hardcoding every rule.

## Configuration

Via env vars / config file:

- `CK3_SAVE_DIR` — defaults to discovering
  `/mnt/c/Users/*/Documents/Paradox Interactive/Crusader Kings III/save games/`.
- `CK3_GAME_DIR` — install path for localization (e.g.
  `/mnt/c/Program Files (x86)/Steam/steamapps/common/Crusader Kings III/game/`).
  If missing, tools fall back to raw keys and warn once.
- Optional: pin to a specific save file vs. "always newest."

## Error handling

Every failure is a clear tool response, never a crash:

- No save dir / no saves → actionable message.
- Parse failure or mid-write file → keep the last good snapshot, serve it, flag staleness.
- Ironman/binary save detected → friendly "Ironman not supported" message rather
  than garbage output.
- Missing localization → raw keys + one-time warning.
- The odd `last_save.ck3` envelope → skipped with a note, not a blocker.

## Testing

TDD the parts we own; trust the third-party parser.

- **Extractor** and **localization resolver** tested against a **committed fixture**:
  a small trimmed gamestate (not the 100 MB save) with known values to assert on
  (e.g. player "Emperor Jenec", "The Holy Roman Empire", date 1130.7.24, player id
  33564206).
- **Cache/debounce** logic tested with simulated file events (including a
  mid-write/partial file).
- Each **tool's Markdown output** asserted for shape and for staying within a
  token-budget guardrail.

## Risks & mitigations

- **Memory/time on 100 MB+ saves** → use jomini's query API to extract only needed
  sections; parse-once-and-cache; set Node heap appropriately if required.
- **ID→name resolution gaps** → resolver with explicit fallback to raw keys + warn;
  prioritize the high-value namespaces (titles, traits, cultures, faiths).
- **Save freshness vs. live game** → every response stamped with snapshot
  date/age; the contract is explicitly "I reason about your last save."
- **Format drift across CK3 patches** → extractor reads named sections defensively;
  missing/renamed fields degrade to omitted rather than crash.

## Out of scope for v1 (designed-for)

Mode-B live source; intrigue/council/economy tools; full CB enumeration;
non-English localization. The `Source` interface and `Snapshot` boundary exist
specifically so these can be added without reworking the pipeline.
