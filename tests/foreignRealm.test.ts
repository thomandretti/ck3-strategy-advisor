import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { queryGamestate } from "../src/parser.js";
import { extractForeignRealm } from "../src/extract/foreignRealm.js";
import { Localizer } from "../src/localization.js";

const GS = readFileSync(
  fileURLToPath(new URL("./fixtures/mini-gamestate.txt", import.meta.url)),
);
const run = (name: string) =>
  queryGamestate(GS, (q) => extractForeignRealm(q, new Localizer(null), name));

describe("extractForeignRealm — matching & core", () => {
  it("matches by display name and reports realm, tier, ruler, army", async () => {
    const r = await run("Alba");
    expect(r).not.toBeNull();
    expect(r!.titleId).toBe(4);
    expect(r!.realmName).toBe("Alba");
    expect(r!.tier).toBe("kingdom");
    expect(r!.ruler).toEqual({
      id: 40000, name: "Causantin", martial: 7, gold: 88, prestige: 500,
    });
    expect(r!.strength).toBe(6000);
    expect(r!.currentStrength).toBe(5500);
  });

  it("matches by title key", async () => {
    const r = await run("k_france");
    expect(r!.titleId).toBe(5);
    expect(r!.realmName).toBe("France");
  });

  it("resolves 'Alba' and 'Scotland' to the same realm (name vs key)", async () => {
    const byName = await run("Alba");
    const byKey = await run("scotland"); // matches k_scotland's key
    expect(byKey!.tier).toBe("kingdom"); // kingdom beats the d_scotland duchy
    expect(byKey!.titleId).toBe(byName!.titleId);
    expect(byKey!.titleId).toBe(4);
  });

  it("prefers the higher tier when several titles match", async () => {
    // "scotland" is in both k_scotland (id 4) and d_scotland (id 6); kingdom wins.
    const r = await run("scotland");
    expect(r!.titleId).toBe(4);
    expect(r!.tier).toBe("kingdom");
  });

  it("reports independent when the title has no de_facto_liege", async () => {
    const r = await run("Alba");
    expect(r!.liege).toBeNull();
  });

  it("reports the liege's holder when the title is a vassal", async () => {
    const r = await run("d_scotland"); // de_facto_liege=4, whose holder is 40000
    expect(r!.titleId).toBe(6);
    expect(r!.liege).toEqual({ id: 40000, name: "Causantin" });
  });

  it("returns null for an unknown realm", async () => {
    expect(await run("Atlantis")).toBeNull();
    expect(await run("")).toBeNull();
  });
});
