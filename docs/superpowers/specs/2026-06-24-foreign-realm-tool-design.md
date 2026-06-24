# Foreign Realm Tool — Design

**Goal:** Add a read-only `foreign_realm` MCP tool that looks up any realm by
name and reports who rules it, how strong their army is, and who they are allied
with — answering questions like "the King of Scotland is so-and-so with army Y
and ally Z."

## Validation (done before this spec)

Probed against a real save
(`Shahanshah_Photios_of_the_Sassanid_Empire_656_03_02.ck3`) to confirm the
load-bearing assumptions resolve **through jomini** for non-player rulers:

- `/living/{aiHolder}/landed_data/strength` and `current_strength` are populated
  for AI rulers (e.g. `k_saxony`'s holder: `strength=7255.5`,
  `current_strength=6346.3`). The headline "army Y" number is real.
- Alliances between two AI rulers resolve via `/relations/active_relations`
  (same global array the `diplomacy` extractor reads), and the ally's primary
  title resolves via `domain[0] → name`.
- An AI ruler is findable as a participant in `/wars/active_wars`.
- Matching must be three-way: `k_poland_slav` has display name `"Poland"`;
  `k_papal_state` has display name `"Papacy"`. Key-substring alone misses
  "Poland"; display-name alone misses key-based queries.

No new save-schema paths are introduced — every field is already documented in
`docs/save-schema.md`.

## Interface

`foreign_realm(name: string)` — a partial realm name or title key (e.g.
`"Scotland"`, `"k_scotland"`, `"Poland"`). Returns the single best-matching
realm. The name contrasts with `realm_overview` (the player's own realm).

On no match: `"No realm matching '<name>'."` (stamped, not an error).

## Matching — best single match

Iterate `/landed_titles/landed_titles`. For each title, lowercase-compare the
query against three strings:

1. `key` (`k_scotland`)
2. display `name` (`Alba`)
3. localized key, `loc.resolve(key)` (absent/raw-key fallback when no game dir)

Rank candidates and return the top one:

1. **Held over unheld** — titles with a numeric `holder` rank above those without.
2. **Tier** — empire > kingdom > duchy > county > barony (`titleTierFromKey`).
3. **Match quality** — exact/whole-word match above substring match.

Degrades gracefully without `CK3_GAME_DIR`: the `key` substring still catches
"scotland" even when localization is unavailable.

## Output (per matched realm)

Markdown, prefixed with `stamp(snap, …)`:

- **Realm:** display name + tier (e.g. "Kingdom of Alba").
- **Ruler:** name + id (id so the user can drill in via the `character` tool).
- **Army:** `landed_data/strength` (full mobilisation) and `current_strength`;
  render "not recorded" if absent rather than fabricating a number.
- **Allies:** scan `/relations/active_relations`, filtered by the ruler's id.
  Render each ally by their primary title where resolvable
  ("the King of France"), else by first name.
- **Liege status:** independent if the matched title has no `de_facto_liege`;
  otherwise "vassal of <de_facto_liege's holder>".
- **Active wars:** scan `/wars/active_wars` participants for the ruler; show side
  (attacker/defender) and target title (null target rendered honestly, as in the
  `military` extractor for internal CBs like `liberty_faction_war`).
- **Ruler key stats:** martial, gold, prestige — obtained by reusing
  `extractCharacter` rather than re-indexing the skill array.

## Architecture (follows the one-direction save → markdown flow)

**New `src/extract/foreignRealm.ts`** — pure
`extractForeignRealm(q: Query, loc: Localizer, name: string) => ForeignRealmInfo | null`:

- `findBestTitle(q, loc, name)` helper does the ranked match over
  `/landed_titles/landed_titles`.
- Reuses `resolveTitleName`, `titleTierFromKey` (from `titleUtils.ts`) and
  `extractCharacter` (from `characters.ts`) for ruler stats + primary title.
- Generalises the `active_relations` and `active_wars` scans (identical logic to
  the `diplomacy` / `military` extractors, keyed by the ruler's id instead of the
  player's). Allies resolved to primary title via `domain[0] → resolveTitleName`.
- Returns `null` when no title matches.

**New `src/tools/foreignRealm.ts`** — `registerForeignRealmTool(server, cache)`:

- `inputSchema: { name: z.string().describe(...) }` (mirrors `find_character`).
- Parameterised by user input, so it runs through `cache.query(...)` exactly like
  the `character` tool — it is NOT part of `buildSnapshot`.
- Formats markdown; on `cache.get()` / `cache.query()` returning `{ error }`,
  returns `{ isError: true, content: [{ type: "text", text: error }] }`.
- Returns the stamped no-match line when the extractor returns `null`.

**Wiring & docs:**

- Register in `src/tools/index.ts` (`registerAllTools`).
- Add `foreign_realm` to the tool list in `README.md` and `CLAUDE.md`.

## Error handling

- Tool never throws to the client (project rule): all `{ error }` results are
  surfaced as `isError` text content.
- Missing army strength → "not recorded", never a fabricated value.
- Null war target / no allies / unheld title → rendered honestly.

## Testing

**Extend `tests/fixtures/mini-gamestate.txt`:** the unheld `k_lotharingia`
(title 3) gets a real AI holder — a new living character with full `landed_data`
(`strength`, `current_strength`, `martial` skill, `gold`), an alliance entry in
`active_relations`, and an entry in `active_wars` as a participant.

**New `tests/foreignRealm.test.ts`:**

- match by key (`"k_lotharingia"`)
- match by display name
- **"Alba" and "Scotland" (or fixture analogue: display name vs. key) resolve to
  the same realm** — the most common mis-pick.
- tier preference when a name matches multiple tiers
- renders army strength, allies (by primary title), liege status, and active war
- no-match path returns the stamped "No realm matching '…'." line

Build gate: `npm run build` (tsc strict). Test gate: `npm test` (vitest run).
