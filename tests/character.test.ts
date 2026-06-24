import { expect, test } from "vitest";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { queryGamestate } from "../src/parser.js";
import { extractCharacter, findCharacters } from "../src/extract/characters.js";
import { Localizer } from "../src/localization.js";

const GS = readFileSync(fileURLToPath(new URL("./fixtures/mini-gamestate.txt", import.meta.url)));

test("extractCharacter returns a full dossier", async () => {
  const loc = new Localizer(null);
  const c = await queryGamestate(GS, (q) => extractCharacter(q, loc, 33564206));
  expect(c).not.toBeNull();
  expect(c!.name).toBe("Jenec");
  expect(c!.skills.learning).toBe(9);       // skill[4]
  expect(c!.traits).toEqual(["just", "temperate", "chaste"]);
  expect(c!.gold).toBe(124.5);
  expect(c!.primaryTitle).toBe("The Holy Roman Empire"); // domain[0]=1 -> name
  expect(c!.claims).toEqual([{ title: "Bohemia", pressed: true }]);
});

test("extractCharacter returns null for an unknown id", async () => {
  const loc = new Localizer(null);
  const c = await queryGamestate(GS, (q) => extractCharacter(q, loc, 999));
  expect(c).toBeNull();
});

test("findCharacters matches by partial first name", () => {
  const matches = findCharacters(GS, "del"); // 'Adela'
  expect(matches.map((m) => m.id)).toContain(22222);
});
