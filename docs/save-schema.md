# CK3 Gamestate Field Schema (jomini-verified)

These field mappings were verified through jomini against two real text saves: Empire of Alba (player character ID 184968) and a Roman Empire save (player character ID 16946625). `{player}` is the numeric value at `/played_character/character`.

---

## Conventions

- `{player}` — the numeric character ID returned by `/played_character/character`. Substitute this literal integer into every path that contains `{player}`.
- `{id}` — a generic numeric ID placeholder (title ID, faction ID, war ID, etc.) depending on context. Meaning is specified per-section.
- **jomini-resolved paths only.** Every path in this document was confirmed to return a non-undefined value through jomini's query interface. Raw-text presence of a field is insufficient — several fields visible in raw text do NOT resolve through jomini (e.g. `alive_data/council`, `alive_data/domain`). Paths that could not be confirmed are marked **UNVERIFIED — raw text only**.
- **jomini type behaviour:** Unquoted date strings in the save (e.g. `1413.12.14`) are returned as JavaScript `Date` objects. Numbers return as JS `number`. Quoted strings return as JS `string`. Repeated anonymous blocks (`{ }`) return as JS arrays. Named-key blocks return as JS objects. Boolean values (`yes`/`no`) return as JS `boolean`.
- **Array index access via JSON pointer is broken across all sections.** Jomini returns arrays correctly when the parent path is queried, but integer sub-paths (e.g. `/skill/0`) return `undefined`. Always fetch the array and iterate in JavaScript.

---

## player-character

**Player-relative recipe:** Start with `pid = /played_character/character`. Read `/living/{pid}/*` for all character fields. Top-level scalar fields (`first_name`, `birth`, `culture`, `faith`, `dynasty_house`, `traits`, `skill`, `prowess_age`) are direct children of the character object. Wealth, prestige, piety, health, stress, and claims are under `alive_data`. Domain, council, levy, strength, vassal contracts, laws, succession, limits, and ruler dates are under `landed_data`. Knights are under `playable_data`.

| Path | jomini type | Meaning | Example |
|------|-------------|---------|---------|
| `/played_character/character` | number | Player character ID; use as `{player}` for all other paths | `184968` |
| `/living/{player}/first_name` | string | Character's first name (localisation key or plain name) | `"CrI_chA_n"` |
| `/living/{player}/birth` | Date | Character birth date | `Date(1385-05-24)` |
| `/living/{player}/culture` | number | Culture ID (foreign key into cultures section) | `60` |
| `/living/{player}/faith` | number | Faith ID (foreign key into faiths section) | `10` |
| `/living/{player}/dynasty_house` | number | Dynasty house ID | `4872` |
| `/living/{player}/traits` | array | Flat int array of trait IDs (enum keys into traits db) | `[75, 55, 53, 7, 23, 227]` |
| `/living/{player}/skill` | array | Skill values in order: diplomacy, martial, stewardship, intrigue, learning, prowess | `[7, 9, 10, 7, 6, 7]` |
| `/living/{player}/prowess_age` | number | Age-based prowess modifier (negative = penalty from aging) | `-11` |
| `/living/{player}/alive_data/gold` | number | Current gold (treasury) | `2974.7568` |
| `/living/{player}/alive_data/income` | number | Monthly income | `524.29583` |
| `/living/{player}/alive_data/stress` | number | Current stress level (integer) | `55` |
| `/living/{player}/alive_data/health` | number | Current health value | `2.39453` |
| `/living/{player}/alive_data/fertility` | number | Fertility value (0–1 range) | `0.56995` |
| `/living/{player}/alive_data/prestige` | object | Prestige container; use sub-paths for currency and accumulated | `{currency: 16346.5694, accumulated: 52392.55858}` |
| `/living/{player}/alive_data/prestige/currency` | number | Spendable prestige | `16346.5694` |
| `/living/{player}/alive_data/prestige/accumulated` | number | Total lifetime prestige earned | `52392.55858` |
| `/living/{player}/alive_data/piety` | object | Piety container; use sub-paths for currency and accumulated | `{currency: 1314.317, accumulated: 5064.317}` |
| `/living/{player}/alive_data/piety/currency` | number | Spendable piety | `1314.317` |
| `/living/{player}/alive_data/piety/accumulated` | number | Total lifetime piety earned | `5064.317` |
| `/living/{player}/alive_data/claim` | array | Claims the player holds on titles; each element: `{title: <id>, pressed?: true}` | `[{title: 7230}, {title: 938}]` |
| `/living/{player}/alive_data/wars` | array | War statistics counter `[won, lost, white_peaces, ?]` — NOT a list of war IDs | `[13, 7, 0, 0]` |
| `/living/{player}/landed_data/council` | array | Array of councillor character IDs | `[5298, 5299, 5300, 5301, 5302, 167777463]` |
| `/living/{player}/landed_data/domain` | array | Flat array of held title IDs (personal domain) | `[89, 87, 442, 284, 979, ...]` |
| `/living/{player}/landed_data/levy` | number | Total levy size | `196919.61835` |
| `/living/{player}/landed_data/strength` | number | Total military strength at full mobilisation | `208624.61835` |
| `/living/{player}/landed_data/current_strength` | number | Current military strength (may differ if attrition) | `198676.71032` |
| `/living/{player}/landed_data/strength_without_hires` | number | Military strength excluding hired troops | `208624.61835` |
| `/living/{player}/landed_data/vassal_contracts` | array | Array of vassal contract IDs (foreign keys into contracts section) | `[285220498, 251658687, ...]` |
| `/living/{player}/landed_data/domain_limit` | number | Maximum number of holdings the player can hold directly | `11` |
| `/living/{player}/landed_data/vassal_limit` | number | Maximum number of direct vassals allowed | `92` |
| `/living/{player}/landed_data/laws` | array | Array of active realm law string keys | `["crown_authority_3", "single_heir_succession_law", "male_preference_law"]` |
| `/living/{player}/landed_data/succession` | array | Ordered succession list of character IDs; index 0 is primary heir | `[198957, 209183, 50523480, ...]` |
| `/living/{player}/landed_data/balance` | number | Net monthly income balance (income minus expenses) | `346.06462` |
| `/living/{player}/landed_data/became_ruler_date` | Date | Date the player character became a ruler | `Date(1413-12-14)` |
| `/living/{player}/landed_data/last_war_finish_date` | Date | Date of the most recently concluded war | `Date(1449-12-22)` |
| `/living/{player}/playable_data/knights` | array | Array of knight character IDs serving the player | `[186788, 196089, 16931165, ...]` |

**Notes:**
1. **COUNCIL GOTCHA:** `alive_data/council` resolves to `undefined` in jomini. The council array lives exclusively at `landed_data/council`. Raw text shows `council=` inside `alive_data` but jomini does not surface it there.
2. **DOMAIN GOTCHA:** `domain={...}` appears in raw text under `alive_data` but jomini returns `undefined` for `alive_data/domain`. The only working path is `/living/{player}/landed_data/domain`.
3. **ARRAY INDEXING:** `skill`, `traits`, `domain`, `laws`, `succession`, `vassal_contracts`, `council`, and `claim` all return as arrays but individual items are NOT accessible via JSON pointer index (e.g. `/skill/0` returns `undefined`). Retrieve the array and iterate in TypeScript.
4. **CLAIM STRUCTURE:** `alive_data/claim` is an array of objects each with a `title` key (integer title ID) and an optional `pressed: true` flag. No explicit `strong`/`weak` field is stored in the gamestate.
5. **ALLIANCES:** No alliance or relation list is stored on the character object. See the alliances-relations section — alliances live in `/relations/active_relations` (global array, filter by `first == pid` OR `second == pid`).
6. `prowess_age` is the age modifier applied to prowess, not the raw prowess value. The 6-element `skill` array already includes prowess as index 5; `prowess_age` is an additive modifier stored separately.

---

## landed_titles

**Player-relative recipe:** Get player domain via `/living/{player}/landed_data/domain` (array of numeric title IDs). For each `{id}` in that array, query `/landed_titles/landed_titles/{id}/*`. To traverse the de jure hierarchy, follow `de_jure_liege` IDs upward until `undefined` (= top-level empire). Tier is readable from the `key` prefix: `e_`=empire, `k_`=kingdom, `d_`=duchy, `c_`=county, `b_`=barony. The realm capital is at `/living/{player}/landed_data/realm_capital` → title ID → `/landed_titles/landed_titles/{id}/key`.

| Path | jomini type | Meaning | Example |
|------|-------------|---------|---------|
| `/landed_titles/landed_titles` | object | Flat map of ALL titles in the game, keyed by numeric title ID | `object{0,1,2,3,...}` |
| `/landed_titles/index` | number | Highest numeric title ID assigned in this save | `3359` |
| `/landed_titles/dynamic_templates` | array | Dynamic title template objects (e.g. mercenary company titles); each has `{key, tier, dyn:yes}` | `array[498]` |
| `/landed_titles/landed_titles/{id}/key` | string | Stable localisation/script key; tier prefix indicates title level | `"e_britannia"`, `"k_england"`, `"b_london"` |
| `/landed_titles/landed_titles/{id}/name` | string | Current display name (may differ from key if ruler renamed the title) | `"Alba"`, `"England"`, `"London"` |
| `/landed_titles/landed_titles/{id}/adj` | string | Adjective form of the title name | `"Alban"`, `"English"` |
| `/landed_titles/landed_titles/{id}/pre` | string | Prefix/combining form used in cultural name construction; present on higher-tier titles, may be absent on lower | `"Britanno"`, `"Romano"` |
| `/landed_titles/landed_titles/{id}/article` | string | Grammatical article; only present when needed (e.g. `"the"` for `the Papacy`) | `"the"` |
| `/landed_titles/landed_titles/{id}/holder` | number | Character ID of the current title holder | `184968` |
| `/landed_titles/landed_titles/{id}/de_jure_liege` | number | Title ID of the de jure liege title; `undefined` for top-level empires | `89` (k_england→e_britannia) |
| `/landed_titles/landed_titles/{id}/de_facto_liege` | number | Title ID of the de facto liege; may differ from de_jure_liege when title is held outside its de jure realm; `undefined` at the top | `90` (c_middlesex→k_england) |
| `/landed_titles/landed_titles/{id}/de_jure_vassals` | array | Title IDs that are de jure direct vassals of this title (kingdoms for an empire, duchies for a kingdom, etc.) | `[90, 284, 332, 442, 517, 518, 7157]` |
| `/landed_titles/landed_titles/{id}/capital` | number | Title ID of the capital county/barony for this title | `92` |
| `/landed_titles/landed_titles/{id}/capital_barony` | boolean | Present and `true` on the barony that is the capital of its county; only set on `b_` tier titles | `true` |
| `/landed_titles/landed_titles/{id}/duchy_capital_barony` | boolean | Present and `true` on the barony that is the capital of its duchy; only set on `b_` tier titles in duchy capitals | `true` |
| `/landed_titles/landed_titles/{id}/heir` | array | Ordered character IDs in succession order for this title; index 0 is primary heir; same data as `/living/{player}/landed_data/succession` for player's primary title | `[198957, 209183, 50523480, ...]` |
| `/landed_titles/landed_titles/{id}/claim` | array | Flat array of character IDs who hold a claim on this title (inverse of character `alive_data/claim`) | `[188095, 185728, 33721227, ...]` |
| `/landed_titles/landed_titles/{id}/date` | Date | Date the title was last acquired by its current holder | `Date(1413-12-14)` |
| `/landed_titles/landed_titles/{id}/coat_of_arms_id` | number | Numeric ID referencing the coat of arms; cross-reference into coat_of_arms section | `41` |
| `/living/{player}/landed_data/domain` | array | Ordered array of numeric title IDs the player personally holds; first element is typically highest tier | `[89, 87, 442, 284, 979, ...]` |
| `/living/{player}/landed_data/realm_capital` | number | Title ID of the realm capital barony/county | `445` |
| `/living/{player}/landed_data/succession` | array | Ordered character IDs in succession order for the player's primary title; equivalent to `heir` on the title block | `array[20]` |

**Notes:**
1. **STRUCTURE GOTCHA:** The top-level section is called `landed_titles` AND it contains a nested sub-object also called `landed_titles`. Title data is at `/landed_titles/landed_titles/{id}`, NOT `/landed_titles/{id}`. The outer object also has `dynamic_templates` and `index`.
2. **ARRAY INDEX ACCESS:** `heir`, `de_jure_vassals`, `claim`, and `domain` return as JS arrays but JSON pointer integer indexing (e.g. `/heir/0`) returns `undefined`. Use JS array methods after calling `q.at()` on the parent path.
3. **key vs name:** `key` is the stable identifier (e.g. `e_britannia`) — use for lookups in game files and localisation CSVs. `name` is the current display name and can change when a ruler renames a title. Do not conflate them.
4. **Title IDs are global:** All ~3359 titles share one flat namespace in `/landed_titles/landed_titles`. The player's domain is a subset.
5. **de_jure_liege vs de_facto_liege:** Empire-level titles have both `undefined`. A county can have a different de jure liege and de facto liege when held outside its de jure duchy (e.g. `c_middlesex` de_jure_liege=`d_bedford`, de_facto_liege=`k_england`).
6. **History field:** `/landed_titles/landed_titles/{id}/history` is an object keyed by date strings (e.g. `'1413.12.14'`) mapping to character IDs or event objects. Jomini returns date strings as string keys, not `Date` objects, inside this history object.
7. **Succession laws** are at `/living/{player}/landed_data/laws` (string array), NOT on the title object itself.

---

## wars

**Player-relative recipe:** There is no direct index of war IDs on the character record. `/living/{player}/alive_data/wars` is a `[won, lost, white_peace, ?]` counter tuple — not a war ID list. To find player wars: (1) enumerate all keys of `/wars/active_wars`, skipping tombstoned `none` entries; (2) for each war, read `attacker/participants` and `defender/participants` as JS arrays and check whether any element's `.character` equals the player ID; (3) if matched, determine side from which array the match appeared; (4) then read `casus_belli/*`, `start_date`, `ticking_war_score`, `called_to_war`, and `name`.

| Path | jomini type | Meaning | Example |
|------|-------------|---------|---------|
| `/wars/active_wars` | object | All currently active wars, keyed by war ID (uint32); entries whose value is `none` are tombstoned | `object{3019898880, 2516582401, ...}` |
| `/wars/names` | object | Historical log of war names grouped by category index; not needed for active war state | `object{1,2,3,...}` |
| `/wars/active_wars/{id}/start_date` | Date | Date when this war started | `Date(1449-03-28)` |
| `/wars/active_wars/{id}/name` | string | Localized display name for the war, including encoded UI link tokens | `" ONCLICK:TITLE,2567 ... Claim on the ... County of Kintuš!!!"` |
| `/wars/active_wars/{id}/casus_belli/type` | string | CB type string | `"claim_cb"`, `"de_jure_cb"`, `"claimant_faction_war"` |
| `/wars/active_wars/{id}/casus_belli/attacker` | number | Character ID of the primary war leader on the attacking side | `199240` |
| `/wars/active_wars/{id}/casus_belli/defender` | number | Character ID of the primary war leader on the defending side | `16974842` |
| `/wars/active_wars/{id}/casus_belli/claimant` | number | Character ID of the claimant; `4294967295` (uint32 max) means no claimant | `199240` |
| `/wars/active_wars/{id}/casus_belli/targeted_titles` | array | Array of title IDs the war is fought over; iterate in JS | `[2611]` |
| `/wars/active_wars/{id}/attacker/participants` | array | Participant objects on the attacking side; each: `{character, last_action: Date, contribution: [soldiers, ?, ?]}` | `[{character: 199240, ...}]` |
| `/wars/active_wars/{id}/defender/participants` | array | Participant objects on the defending side; same shape as attacker | `[{character: 16974842, ...}]` |
| `/wars/active_wars/{id}/attacker/ticking_war_score` | number | War score accumulating to the attacker from active sieges; only present when attacker has active sieges | `4.73` |
| `/wars/active_wars/{id}/defender/ticking_war_score` | number | War score accumulating to the defender from active sieges; only present when defender has active sieges | `6.765` |
| `/wars/active_wars/{id}/attacker/controls_all` | boolean | Present and `true` only when the attacker controls all war objectives | `true` |
| `/wars/active_wars/{id}/called_to_war` | array | Character IDs who have been called to war (allies/vassals summoned); not always present on every war | `[190865]` |
| `/wars/active_wars/{id}/battle_results` | array | Battle/siege result objects; each: `{attacker, defender, province, war_score, attacker_won, attacker_initiated}`; only present when at least one battle has occurred | `[{attacker: {commander:178119,...}, ...}]` |
| `/living/{player}/alive_data/wars` | array | War statistics counter `[won, lost, white_peaces, ?]` — NOT a list of war IDs | `[13, 7, 0, 0]` |
| `/living/{player}/landed_data/last_war_finish_date` | Date | Date when the player last finished a war | `Date(1449-12-22)` |

**Notes:**
1. War IDs are uint32 values used as object keys. Some entries are `none` tombstones (resolve `undefined` in jomini) — skip them before accessing sub-fields.
2. `ticking_war_score` is only present when there is an active siege/occupation on that side; resolves `undefined` otherwise.
3. `battle_results` is only present after at least one battle has occurred in the war.
4. `controls_all` is only present (boolean `true`) when the attacker controls all war objectives.
5. `casus_belli/claimant = 4294967295` is the uint32 max sentinel meaning no claimant (e.g. de jure or faction war).
6. Array elements (`participants`, `called_to_war`, `targeted_titles`, `battle_results`) must be accessed as JS arrays — integer JSON-pointer indexing returns `undefined`.
7. Both test gamestates (alba and roman) had the player at peace; no player appeared in any `active_wars` participant block. War structure was verified on NPC wars within the same saves.

---

## alliances-relations

**Player-relative recipe:** Get `pid` from `/played_character/character`. Filter `/relations/active_relations` (JS array, ~14000 entries) for `e.first === pid || e.second === pid`. From matching entries: entries with an `alliances` key are active alliances (each alliance element has `allied_through_0`, `allied_through_1`); entries with `truce_0` or `truce_1` are truces (each slot has `date`, `name`, `result`). Opinions are separate — filter `/opinions/active_opinions` for `owner === pid`.

| Path | jomini type | Meaning | Example |
|------|-------------|---------|---------|
| `/relations/active_relations` | array | Global flat array (~14000 entries) of all pairwise relation records; each entry covers one character pair | `array[13939]` |
| `/relations/active_relations[*]/first` | number | Character ID of the first party in the relation pair | `184968` |
| `/relations/active_relations[*]/second` | number | Character ID of the second party in the relation pair | `16939270` |
| `/relations/active_relations[*]/alliances` | array | Present when the pair is allied; each element: `{allied_through_0, allied_through_1}` (char IDs of the marriage link on each side); absent when no alliance | `[{allied_through_0: 204245, allied_through_1: 201640}]` |
| `/relations/active_relations[*]/alliances[*]/allied_through_0` | number | Character ID on the `first` side through whom this alliance link runs | `204245` |
| `/relations/active_relations[*]/alliances[*]/allied_through_1` | number | Character ID on the `second` side through whom this alliance link runs | `201640` |
| `/relations/active_relations[*]/truce_0` | object | First truce slot; has `date` (Date), `name` (string with markup), `result` ("victory"/"defeat"/"white_peace") | `{date: Date(1452-10-26), name: "Alban De Jure War", result: "victory"}` |
| `/relations/active_relations[*]/truce_1` | object | Second truce slot; same shape as `truce_0`; when both present, they represent the same war from each side's perspective | `{date: Date(1450-12-31), name: "...", result: "defeat"}` |
| `/relations/active_relations[*]/truce_0/date` | Date | Truce expiration date | `Date(1452-10-26)` |
| `/relations/active_relations[*]/truce_0/result` | string | Outcome from that character's perspective: `"victory"`, `"defeat"`, or `"white_peace"`; may be absent | `"victory"` |
| `/relations/active_relations[*]/active_hook_0` | object | Hook held by the `first` character over the `second`; has `type`, `gold`, `expiration_date` (Date; 9999-01-01 = permanent) | `{type: "house_head_hook", gold: 0, expiration_date: Date(9999-01-01)}` |
| `/relations/active_relations[*]/active_hook_1` | object | Hook held by the `second` character over the `first`; same shape as `active_hook_0` | `{type: "house_head_hook", ...}` |
| `/opinions/active_opinions` | array | Global flat array (~95000 entries) of all active directed opinion modifiers; filter by `owner === {player}` for outgoing opinions | `array[95445]` |
| `/opinions/active_opinions[*]/owner` | number | Character ID of the character holding this opinion | `184968` |
| `/opinions/active_opinions[*]/target` | number | Character ID of the character being evaluated | `183735` |
| `/opinions/active_opinions[*]/temporary_opinion` | object | Time-limited opinion modifier; has `modifier` (script name), `value` (numeric contribution), `start_date` (Date), `expiration_date` (Date), `converging.opinion` (target decay value) | `{modifier: "respect_opinion", value: 3, expiration_date: Date(1452-04-10), ...}` |
| `/opinions/active_opinions[*]/scripted_relations` | object | Permanent relationship tag (friend, rival, nemesis, etc.); keyed by relation type; value is metadata including `reason` and `involved_character` | `{friend: {flags: "...", reason: "friend_random_6", involved_character: 179433}}` |

**Notes:**
1. **ARRAY INDEX ACCESS:** `active_relations` and `active_opinions` are JS arrays. Pointer integer indexing (e.g. `/relations/active_relations/0`) returns `undefined`. Iteration must be done in JavaScript code.
2. **truce_0 / truce_1 semantics:** The `_0`/`_1` suffix does NOT reliably map to the `first`/`second` character position. In observed data the player is `first` yet the data is in `truce_1`. Always check both slots on any entry involving the player.
3. No dedicated top-level `truces` section exists. Truces live inside `active_relations` entries alongside alliances, hooks, and war references.
4. **Opinions are entirely separate from alliances/truces.** `/opinions/active_opinions` is a flat directed array; `/relations/active_relations` carries alliance, truce, hook, and war reference data — not opinion values.
5. The `war` key sometimes present inside an `active_relations` entry (e.g. `war=2667577385`) references an ongoing war ID; it is distinct from a truce.
6. Friend/rival/nemesis status is stored in `scripted_relations` inside opinion entries, not in `active_relations`.

---

## factions

**Player-relative recipe:** The player ID is at `/played_character/character` (placeholder: `{player}`). Factions have no player-relative sub-path — iterate the full `/faction_manager/factions` object and filter by `.target === {player}`. Skip entries whose value is the string `"none"`. For each matching faction: `.type` gives the kind; `.power` / `.power_threshold` gives threat ratio (≥1 means demand is imminent); `.discontent` gives the 0–100 bar for peasant/claimant factions; `.members[]` gives character members; `.title_members[]` gives county members for peasant factions; `.leader` is the leading character; `.special_character` / `.special_title` identify the claimant and contested title for claimant factions.

| Path | jomini type | Meaning | Example |
|------|-------------|---------|---------|
| `/faction_manager/factions` | object | All factions in the game, keyed by numeric faction ID; some entries are the string `"none"` (sparse placeholders) | `{211: "none", 1157627945: {...}, ...}` |
| `/faction_manager/factions/{id}/type` | string | Faction type | `"independence_faction"`, `"claimant_faction"`, `"liberty_faction"`, `"populist_faction"`, `"peasant_faction"` |
| `/faction_manager/factions/{id}/target` | number | Character ID of the liege this faction is directed against; filter on this to find threats to the player | `184968` |
| `/faction_manager/factions/{id}/leader` | number | Character ID of the faction leader; absent on some peasant/populist factions | `195827` |
| `/faction_manager/factions/{id}/power` | number | Current faction power (sum of member contributions); compare to `power_threshold` | `15.846` |
| `/faction_manager/factions/{id}/power_threshold` | number | Power level at which the faction issues its demand; absent on `peasant_faction` (those use `discontent` instead) | `70` |
| `/faction_manager/factions/{id}/discontent` | number | Discontent level 0–100 for `peasant_faction` and `claimant_faction`; peasant factions trigger at 100 | `94` |
| `/faction_manager/factions/{id}/members` | array | Member objects for character-based factions; each: `{character: id, faction: id}`; absent on peasant factions | `[{character: 195827, faction: 1157627945}, ...]` |
| `/faction_manager/factions/{id}/title_members` | array | County objects for `peasant_faction`; each: `{county: <title id>}`; absent on character-based factions | `[{county: 512}, {county: 450}]` |
| `/faction_manager/factions/{id}/special_character` | number | Claimant character ID championed by a `claimant_faction`; absent on other types | `33721332` |
| `/faction_manager/factions/{id}/special_title` | number | Title ID being contested by a `claimant_faction`; absent on other types | `5072` |

**Notes:**
1. **NESTING GOTCHA:** Factions are at `/faction_manager/factions`, NOT `/factions`. Attempting `/factions` returns `undefined` from jomini.
2. Many faction entries are the string `"none"` (sparse Paradox format placeholders). Filter with `typeof value === 'object'` before accessing fields.
3. `members` and `title_members` are mutually exclusive: character-based factions use `members`; peasant factions use `title_members`.
4. `power_threshold` is absent on `peasant_faction` — those trigger on `discontent` reaching 100.
5. `leader` is absent on some populist/peasant factions.
6. `discontent` appears on `peasant_faction` (always) and `claimant_faction` (sometimes); absent on `independence_faction` and `liberty_faction` in these saves.
7. Array sub-elements are not accessible via JSON pointer integer index. Iterate returned JS arrays in application code.
8. Verified identically in both saves: alba (player 184968, 219 total factions, 4 targeting player) and roman (player 16946625, 106 total factions, 6 targeting player).

---

## succession-claims

**Player-relative recipe:** (1) Succession laws: `/living/{player}/landed_data/laws` — string array; find element matching `*_succession_law` for law type, `*_law` for gender preference. (2) Heir order: `/living/{player}/landed_data/succession` — number array; index 0 is primary heir. (3) Player's own claims: `/living/{player}/alive_data/claim` — array of `{title, pressed?: true}`; check `.pressed`. (4) Active pretender titles: `/living/{player}/alive_data/pretender` — number array of title IDs (absent if none). (5) To find the player's primary title block: iterate `/landed_titles/landed_titles`, find entry where `.holder === {player}` and `.key` starts with `e_` (or highest tier held); then use that entry's `heir` (ordered heirs) and `claim` (claimant character IDs) arrays.

| Path | jomini type | Meaning | Example |
|------|-------------|---------|---------|
| `/living/{player}/landed_data/laws` | array | Active succession laws for the player's primary realm; includes succession type and gender law | `["crown_authority_3", "single_heir_succession_law", "male_preference_law"]` |
| `/living/{player}/landed_data/succession` | array | Ordered heir priority queue for the player's primary title; index 0 is primary heir | `[198957, 209183, 50523480, ...]` |
| `/living/{player}/alive_data/claim` | array | Claims the player holds on other titles; each: `{title: number, pressed?: true}` | `[{title: 7230}, {title: 938}]` |
| `/living/{id}/alive_data/claim` | array | Claims held by any living character; same schema as player; `pressed: true` indicates active pressing | `[{title: 4629, pressed: true}, {title: 5268}]` |
| `/living/{id}/alive_data/pretender` | array | Title IDs the character is actively contesting (e.g. in a faction or claimant war); absent if none | `[4355, 4356, 4361]` |
| `/landed_titles/landed_titles/{id}/heir` | array | Ordered heir list on the title block; matches `/living/{player}/landed_data/succession` for player's primary title | `[198957, 209183, 50523480, ...]` |
| `/landed_titles/landed_titles/{id}/claim` | array | Flat array of character IDs who hold a claim on this title (inverse of character `alive_data/claim`; no pressed/strong annotation) | `[188095, 185728, 33721227, ...]` |
| `/landed_titles/landed_titles/{id}/key` | string | Internal key string; used to identify title tier from prefix (`e_`, `k_`, `d_`, `c_`, `b_`) | `"e_britannia"` |
| `/landed_titles/landed_titles/{id}/holder` | number | Current title holder character ID; filter on this to find player-held titles | `184968` |

**Notes:**
1. **STRONG vs WEAK claims:** Neither the character's `alive_data/claim` objects nor the title's `claim` array carry an explicit `strong`/`weak` flag. This distinction must be derived externally from game logic (birthright vs granted), not read from the gamestate.
2. **pressed flag:** Only present as `{pressed: true}` on the character's `alive_data/claim` object when actively pressed (raw text stores as `pressed=yes`). Absence means unpressed.
3. **Duplicate heir data:** The heir list appears in two places — `/living/{player}/landed_data/succession` and `/landed_titles/landed_titles/{titleId}/heir`. Both were verified to be identical. Use `landed_data/succession` as the canonical player-relative path.
4. `/landed_titles/landed_titles/{id}/claim` is a flat array of character IDs, NOT claim objects. It is the inverse index of character `alive_data/claim` arrays.
5. Array sub-elements (e.g. `/alive_data/claim/0`) return `undefined` via JSON pointer — use JavaScript array indexing after fetching the array.
6. **pretender vs claim:** `alive_data/pretender` lists title IDs the character is actively contesting; `alive_data/claim` lists all held claims regardless of pressing status. A character can have claims without being a pretender and vice versa.
7. Title IDs in `alive_data/claim[n].title` reference the same numeric namespace as `/landed_titles/landed_titles/{id}` keys.

---

## ADDENDUM: gaps resolved for Tasks 10 & 13 (controller-verified)

### Men-at-arms (Task 10)
There is NO clean per-character men-at-arms breakdown in the gamestate.
`/living/{player}/landed_data/men_at_arms` = undefined; the raw `men_at_arms={ gold=... }`
inside the player block is upkeep cost only. Regiments live in the global `/armies`
(`{regiments, army_regiments, armies, name_manager}`) and `/units` keyed by unit id —
not cheaply attributable to a character. **Task 10 reports mobilisation TOTALS
(`landed_data/levy`, `strength`, `current_strength`, `strength_without_hires`) and
states MAA is not broken out. Do not fabricate an MAA breakdown.**

### Vassal enumeration (Task 13)
- Player's direct vassal contracts: `/living/{player}/landed_data/vassal_contracts` = array of contract IDs (e.g. 56 entries).
- Resolve each: `/vassal_contracts/active/{contractId}` -> object `{ vassal: <charId>, liege: <charId>, date: Date, levels: int[] }`. `vassal` is the vassal character id; `liege` should equal the player.
- `/vassal_contracts/active` is an object keyed by contract id (numeric-string keys).
- Rank vassals by `/living/{vassalId}/landed_data/strength_for_liege` (number; troops the vassal owes the liege). Fallback `/living/{vassalId}/landed_data/strength`.
- Vassal opinion OF player: single pass over `/opinions/active_opinions` (array ~85k–95k), keep entries where `owner === vassalId && target === {player}`, sum `temporary_opinion.value` (+ any base). Only scan once; keep only matches for the top-N vassals.
- Council seat: vassalId present in `/living/{player}/landed_data/council`.
- Faction membership: vassalId present in any `/faction_manager/factions/{id}/members[*].character` where that faction's `target === {player}`.

### Scoped-out / stated-limitation features
- **Marriage candidates (Task 12):** NOT mapped in the gamestate — scope OUT; the plan hedges "if cheaply available".
- **Strong vs weak claims (Task 14):** NOT stored. Report claims as pressed/unpressed only (from `alive_data/claim[*].pressed`), and say so in the tool description.
- **Character name search (Task 9 find_character):** `first_name` is CK3 loc-encoded (e.g. "CrI_chA_n" for Críchán) and the game dir may be null, so display-name search is BEST-EFFORT substring over the raw + resolved name. Document this limitation in the tool description.
