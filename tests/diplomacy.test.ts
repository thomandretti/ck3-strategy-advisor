import { expect, test } from "vitest";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { buildSnapshot } from "../src/snapshot.js";
import { Localizer } from "../src/localization.js";
const GS = readFileSync(fileURLToPath(new URL("./fixtures/mini-gamestate.txt", import.meta.url)));
test("extracts alliances, truces, hostility, independence", async () => {
  const d = (await buildSnapshot(GS, new Localizer(null))).diplomacy;
  expect(d.independent).toBe(true);
  expect(d.alliances).toEqual([{ id: 22222, name: "Adela" }]);
  expect(d.truces).toEqual([{ id: 22222, name: "Adela", until: "1135.6.1", result: "victory" }]);
  expect(d.hostile).toEqual([{ id: 22222, name: "Adela", opinion: -30 }]);
});
