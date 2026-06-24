import { expect, test } from "vitest";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { buildSnapshot } from "../src/snapshot.js";
import { Localizer } from "../src/localization.js";

const GS = readFileSync(fileURLToPath(new URL("./fixtures/mini-gamestate.txt", import.meta.url)));

test("extracts claims, unheld de jure titles, and war targets", async () => {
  const e = (await buildSnapshot(GS, new Localizer(null))).expansion;
  expect(e.claims).toEqual([{ title: "Bohemia", pressed: true }]);
  expect(e.pressedCount).toBe(1);
  expect(e.deJureUnheld).toEqual([{ title: "Lotharingia" }]);
  expect(e.warTargets).toEqual([{ title: "Bohemia", cbType: "claim_cb" }]);
});
