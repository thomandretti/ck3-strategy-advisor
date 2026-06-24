import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { queryGamestate } from "../src/parser.js";
import { extractForeignRealm } from "../src/extract/foreignRealm.js";
import { Localizer } from "../src/localization.js";
import { formatForeignRealm, registerForeignRealmTool } from "../src/tools/foreignRealm.js";
import type { ForeignRealmInfo } from "../src/extract/foreignRealm.js";

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

describe("extractForeignRealm — allies & wars", () => {
  it("lists allies by their primary title where resolvable", async () => {
    const r = await run("Alba"); // 40000 allied to 40001 (holds k_france)
    expect(r!.allies).toEqual([{ id: 40001, name: "Philippe", realm: "France" }]);
  });

  it("lists the ruler's active wars with side and target title", async () => {
    const r = await run("Alba"); // war 9002: 40000 attacker, targets title 6 (Lothian)
    expect(r!.wars).toEqual([
      { side: "attacker", cbType: "conquest_cb", targetTitle: "Lothian" },
    ]);
  });

  it("returns empty allies/wars for a ruler with neither", async () => {
    const r = await run("k_france"); // 40001: allied (covered above) but check Lothian's duke
    const duke = await run("d_scotland"); // 40002: no alliance, no war
    expect(duke!.allies).toEqual([]);
    expect(duke!.wars).toEqual([]);
    expect(r).not.toBeNull();
  });
});

describe("foreign_realm tool", () => {
  const info: ForeignRealmInfo = {
    titleId: 4, realmName: "Alba", tier: "kingdom",
    ruler: { id: 40000, name: "Causantin", martial: 7, gold: 88, prestige: 500 },
    strength: 6000, currentStrength: 5500, liege: null,
    allies: [{ id: 40001, name: "Philippe", realm: "France" }],
    wars: [{ side: "attacker", cbType: "conquest_cb", targetTitle: "Lothian" }],
  };

  it("formats a realm dossier", () => {
    const text = formatForeignRealm(info);
    expect(text).toContain("# Alba (Kingdom)");
    expect(text).toContain("Ruler: Causantin (id 40000) — Mar 7 | Gold 88 | Prestige 500");
    expect(text).toContain("Army: 6000 (current 5500)");
    expect(text).toContain("Liege: independent");
    expect(text).toContain("Allies: France (Philippe)");
    expect(text).toContain("Wars: attacker vs Lothian");
  });

  it("renders missing data honestly", () => {
    const bare = formatForeignRealm({
      ...info, strength: null, currentStrength: null,
      liege: { id: 1, name: "Otto" }, allies: [], wars: [],
    });
    expect(bare).toContain("Army: not recorded");
    expect(bare).toContain("Liege: vassal of Otto");
    expect(bare).toContain("Allies: none");
    expect(bare).toContain("Wars: none");
  });

  it("returns a stamped no-match line when nothing matches", async () => {
    const snap = { date: "1130-07-24", parsedAt: Date.now() } as any;
    const cache = { get: async () => snap, query: async () => null, loc: null } as any;
    let handler: any;
    const server = { registerTool: (_n: string, _c: any, h: any) => { handler = h; } } as any;
    registerForeignRealmTool(server, cache);
    const res = await handler({ name: "Atlantis" });
    expect(res.isError).toBeUndefined();
    expect(res.content[0].text).toContain("No realm matching 'Atlantis'.");
  });

  it("surfaces a cache error as isError", async () => {
    const cache = { get: async () => ({ error: "no save" }) } as any;
    let handler: any;
    const server = { registerTool: (_n: string, _c: any, h: any) => { handler = h; } } as any;
    registerForeignRealmTool(server, cache);
    const res = await handler({ name: "Alba" });
    expect(res.isError).toBe(true);
    expect(res.content[0].text).toBe("no save");
  });
});

describe("extractForeignRealm — ranking precedence & unheld", () => {
  it("ranks an exact match above a higher-priority substring match", async () => {
    // "Mercia" exactly matches k_mercia's display name (unheld KINGDOM, id 7);
    // d_mercia (HELD duchy, id 8) matches only as a substring. Quality wins,
    // so the exact-but-unheld kingdom is chosen over the held duchy.
    const r = await run("Mercia");
    expect(r!.titleId).toBe(7);
  });

  it("at equal match quality, ranks a held title above an unheld higher tier", async () => {
    // "merc" is a substring of both k_mercia (unheld kingdom, id 7) and
    // d_mercia (held duchy, id 8); neither is an exact match. held > unheld
    // outranks the kingdom's higher tier, so the held duchy is chosen.
    const r = await run("merc");
    expect(r!.titleId).toBe(8);
    expect(r!.tier).toBe("duchy");
  });

  it("returns an unheld realm with a sentinel ruler and no army", async () => {
    // k_lotharingia (id 3) has no holder.
    const r = await run("Lotharingia");
    expect(r!.titleId).toBe(3);
    expect(r!.ruler.id).toBe(-1);
    expect(r!.ruler.name).toBe("unheld");
    expect(r!.strength).toBeNull();
    expect(r!.allies).toEqual([]);
    expect(r!.wars).toEqual([]);
  });
});
