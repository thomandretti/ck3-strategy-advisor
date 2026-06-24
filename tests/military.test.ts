import { expect, test } from "vitest";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { buildSnapshot } from "../src/snapshot.js";
import { Localizer } from "../src/localization.js";

const GS = readFileSync(fileURLToPath(new URL("./fixtures/mini-gamestate.txt", import.meta.url)));

test("extracts mobilisation totals and the player's war", async () => {
  const snap = await buildSnapshot(GS, new Localizer(null));
  expect(snap.military.levy).toBe(4733.6);
  expect(snap.military.strength).toBe(8098.7);
  expect(snap.military.wars).toHaveLength(1);
  const w = snap.military.wars[0];
  expect(w.playerSide).toBe("attacker");
  expect(w.cbType).toBe("claim_cb");
  expect(w.targetTitle).toBe("Bohemia"); // title 2 -> name
  expect(w.attackerScore).toBe(12.5);
  expect(w.defenderScore).toBe(3.0);
});
