import { expect, test } from "vitest";
import { fileURLToPath } from "node:url";
import { Localizer } from "../src/localization.js";

const GAME_DIR = fileURLToPath(new URL("./fixtures/gamedir", import.meta.url));

test("resolve() returns the localized value", () => {
  const loc = new Localizer(GAME_DIR);
  expect(loc.resolve("k_bohemia")).toBe("Bohemia");
  expect(loc.resolve("e_hispania")).toBe("Empire of Hispania");
});

test("resolve() falls back to the raw key when missing", () => {
  const loc = new Localizer(GAME_DIR);
  expect(loc.resolve("k_does_not_exist")).toBe("k_does_not_exist");
});

test("a null game dir yields an empty localizer that echoes keys", () => {
  const loc = new Localizer(null);
  expect(loc.resolve("k_bohemia")).toBe("k_bohemia");
});

test("resolveTrait() maps an index through traits_lookup then localizes", () => {
  const loc = new Localizer(GAME_DIR);
  loc.setTraitLookup(["just", "diligent"]); // identifiers; "just" -> "Just" via yml
  expect(loc.resolveTrait(0)).toBe("Just");
  expect(loc.resolveTrait(99)).toBe("trait_99"); // out of range -> fallback
});
