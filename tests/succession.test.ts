import { expect, test } from "vitest";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { buildSnapshot } from "../src/snapshot.js";
import { Localizer } from "../src/localization.js";
const GS = readFileSync(fileURLToPath(new URL("./fixtures/mini-gamestate.txt", import.meta.url)));
test("extracts heirs, laws, and claimants", async () => {
  const s = (await buildSnapshot(GS, new Localizer(null))).succession;
  expect(s.primaryTitle).toBe("The Holy Roman Empire");
  expect(s.successionLaw).toBe("single_heir_succession_law");
  expect(s.genderLaw).toBe("male_preference_law");
  expect(s.heirs[0]).toEqual({ id: 22222, name: "Adela" });
  expect(s.claimants.map((c) => c.id)).toContain(22222);
});
