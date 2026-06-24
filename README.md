# CK3 Strategy Advisor (MCP server)

A local [Model Context Protocol](https://modelcontextprotocol.io) server that
reads your **Crusader Kings III** save file and exposes your strategic situation
to Claude as compact, curated tools. Ask Claude "what's my situation?" and it can
pull your realm overview, military, succession, diplomacy, vassals, factions, and
expansion options straight from your latest save.

It is read-only: it never modifies your save or your game.

## Requirements

- **Node.js ≥ 20**
- **Non-Ironman saves only.** Ironman saves are stored in a binary format; the
  advisor detects them and returns a friendly message instead of mis-parsing.
  Play (or re-save) without Ironman to use the advisor.
- Mid/late-game saves are large (the embedded game state is ~200+ MB of text);
  parsing one peaks at roughly **1.1 GB of memory** and takes a couple of seconds.

## Install & build

```bash
npm install
npm run build
```

## Configuration

The server finds your save and game directories from environment variables, with
WSL/`/mnt/c` discovery as a fallback:

| Variable | Purpose | Default |
|----------|---------|---------|
| `CK3_SAVE_DIR` | Folder containing your `.ck3` saves | auto-discovered at `/mnt/c/Users/*/Documents/Paradox Interactive/Crusader Kings III/save games` |
| `CK3_GAME_DIR` | CK3 game install (for localization) | `/mnt/c/Program Files (x86)/Steam/steamapps/common/Crusader Kings III/game` |

`CK3_GAME_DIR` is optional. Without it, titles/traits are shown as their raw game
keys instead of localized names — everything else still works.

The server reads the **newest readable** `.ck3` in the save directory. CK3
autosaves are written in a binary token format (the same one Ironman uses)
regardless of whether you play Ironman, and the advisor can't decode it — so it
automatically **skips binary autosaves/Ironman saves and uses your newest normal
save** instead. You don't need to delete or rename autosaves; just keep making
ordinary saves and the freshest one is picked up.

## Register with Claude

Add it as a local stdio MCP server. In **Claude Code**:

```bash
claude mcp add ck3-advisor -- node /absolute/path/to/ck3mod/dist/index.js
```

Or in **Claude Desktop**, add to `claude_desktop_config.json`:

```json
{
  "mcpServers": {
    "ck3-advisor": {
      "command": "node",
      "args": ["/absolute/path/to/ck3mod/dist/index.js"],
      "env": { "CK3_SAVE_DIR": "/mnt/c/Users/you/Documents/Paradox Interactive/Crusader Kings III/save games" }
    }
  }
}
```

## Workflow

1. Play CK3 (non-Ironman). **Save your game** whenever you want fresh advice.
2. Ask Claude about your realm. Each tool response is stamped with the save's
   in-game date and how long ago it was read, so you know how current it is.
3. Saved again? Just ask again — the server re-reads the newest save automatically.

## Tools

| Tool | What it returns |
|------|-----------------|
| `realm_overview` | Ruler, primary title & tier, house, gold/prestige/piety, date. Start here. |
| `military` | Levy + total mobilised strength, and ongoing wars (side, casus belli, target, score). |
| `succession` | Heirs in order, succession & gender laws, rival claimants. |
| `diplomacy` | Alliances, truces, independence, and who most dislikes you. |
| `vassals` | Your most powerful vassals: power owed, opinion, council seat, faction danger flag. |
| `titles` | Titles you personally hold, grouped by tier, each with its de jure liege. |
| `factions` | Factions targeting you: type, strength vs. their threshold, members, leader. |
| `expansion` | Stored claims (pressed/unpressed), unheld de jure titles, ongoing-war targets. |
| `find_character` | Search living characters by (partial) name → ids. |
| `character` | Full dossier for one character id: traits, skills, wealth, claims. |
| `foreign_realm` | Look up any realm by name/key — ruler, army, allies, liege, active wars. |

## Known limitations (v1)

These reflect what is and isn't stored in the save:

- **Names** are stored in CK3's encoded form; `find_character` normalizes and does
  best-effort substring matching, so very stylized names may not match.
- **Claims** are reported as pressed/unpressed — CK3 does not store a strong/weak
  distinction in the save.
- **Men-at-arms** are not broken out per ruler in the save; `military` reports the
  realm's mobilisation totals.
- **Opinion** values (e.g. in `diplomacy`/`vassals`) are approximate, summed from
  stored opinion modifiers rather than the game's computed total.
- **Localization** is English-only, ignores `$KEY$` interpolation, and is
  currently **unverified against a real CK3 install** (developed against a test
  fixture). Real `.yml` quirks — a leading BOM, `§` colour codes and `#`
  comments inside values, deeply nested subfolders — may not all be handled.
  Without `CK3_GAME_DIR`, titles and traits appear as their raw game keys.
- `expansion` lists **stored** levers (claims, unheld de jure titles, active-war
  CBs), not a full computed enumeration of every possible casus belli.

## Development

```bash
npm test        # run the vitest suite
npm run test:watch
npm run dev     # run the server from source via tsx
```

The verified gamestate field paths the extractors rely on are documented in
[`docs/save-schema.md`](docs/save-schema.md), and `scripts/inspect-section.mjs`
/ `scripts/check-paths.mjs` help map new fields against a real save.

## Distribution (future)

The documented path for shipping this to non-developers is [MCPB](https://github.com/anthropics/mcpb)
(a self-contained bundle with the Node runtime), so it can be installed without a
local Node/npm setup. The current release targets the local stdio prototype above.

## License

[MIT](LICENSE) © Thom Andretti

This is an unofficial, fan-made tool. *Crusader Kings III* is a trademark of
Paradox Interactive AB. This project is not affiliated with or endorsed by
Paradox Interactive.
