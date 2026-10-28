import { expect, test } from "vitest";
import { mkdirSync, mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
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

test("decodeNames turns the save's escaped names into the game's spelling", () => {
  const root = mkdtempSync(join(tmpdir(), "ck3-names-"));
  mkdirSync(join(root, "localization", "english", "names"), { recursive: true });
  writeFileSync(
    join(root, "localization", "english", "names", "character_names_l_english.yml"),
    'l_english:\n BeorhtflE_d:0 "Beorhtflæd"\n RO_gnvaldr:0 "Rögnvaldr"\n PAAl:0 "Pål"\n',
  );
  writeFileSync(
    join(root, "localization", "english", "other_l_english.yml"),
    'l_english:\n some_key:0 "Not a name"\n',
  );
  const loc = new Localizer(root);
  expect(loc.decodeNames("- RO_gnvaldr (32365) wed BeorhtflE_d, PAAl, some_key, Murchad")).toBe(
    "- Rögnvaldr (32365) wed Beorhtflæd, Pål, some_key, Murchad",
  );
  expect(new Localizer(null).decodeNames("RO_gnvaldr")).toBe("RO_gnvaldr");
});
