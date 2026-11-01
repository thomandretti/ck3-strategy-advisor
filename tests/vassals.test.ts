import { expect, test } from "vitest";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { buildSnapshot } from "../src/snapshot.js";
import { Localizer } from "../src/localization.js";
const GAME_DIR = fileURLToPath(new URL("./fixtures/gamedir", import.meta.url));
const GS = readFileSync(fileURLToPath(new URL("./fixtures/mini-gamestate.txt", import.meta.url)));
test("extracts vassals and factions with cross-referenced flags", async () => {
  const snap = await buildSnapshot(GS, new Localizer(null));
  expect(snap.factions).toEqual([
    {
      type: "independence_faction",
      power: 30,
      threshold: 70,
      discontent: null,
      members: 1,
      leaderName: "Adela",
    },
  ]);
  expect(snap.vassals).toEqual([
    {
      id: 22222,
      name: "Adela",
      strengthForLiege: 500,
      opinion: -30,
      councilSeat: true,
      inFaction: true,
    },
  ]);
  expect(snap.vassalCount).toBe(1);
});

test("resolves character names through localization when the game dir is loaded", async () => {
  const snap = await buildSnapshot(GS, new Localizer(GAME_DIR));
  expect(snap.vassals[0]?.name).toBe("Adéla");
  expect(snap.factions[0]?.leaderName).toBe("Adéla");
  expect(snap.diplomacy.hostile[0]?.name).toBe("Adéla");
});
