import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { titleTierFromKey } from "../src/extract/titleUtils.js";
import { buildSnapshot } from "../src/snapshot.js";
import { queryGamestate } from "../src/parser.js";
import { extractTitles } from "../src/extract/titles.js";
import { Localizer } from "../src/localization.js";
import { registerTitlesTool } from "../src/tools/titles.js";

const GS = readFileSync(
  fileURLToPath(new URL("./fixtures/mini-gamestate.txt", import.meta.url)),
);

describe("titleTierFromKey", () => {
  it("maps tier prefixes", () => {
    expect(titleTierFromKey("e_hre")).toBe("empire");
    expect(titleTierFromKey("k_bohemia")).toBe("kingdom");
    expect(titleTierFromKey("d_bohemia")).toBe("duchy");
    expect(titleTierFromKey("c_praha")).toBe("county");
    expect(titleTierFromKey("b_praha")).toBe("barony");
  });
  it("returns 'other' for unknown prefixes", () => {
    expect(titleTierFromKey("x_weird")).toBe("other");
    expect(titleTierFromKey("")).toBe("other");
  });
});

describe("extractTitles", () => {
  it("buckets the player's domain by tier with de jure lieges", async () => {
    const info = (await buildSnapshot(GS, new Localizer(null))).titles;
    expect(info.total).toBe(2);
    expect(info.empires).toEqual([
      { id: 1, name: "The Holy Roman Empire", deJureLiege: null },
    ]);
    expect(info.kingdoms).toEqual([
      { id: 2, name: "Bohemia", deJureLiege: "The Holy Roman Empire" },
    ]);
    expect(info.duchies).toEqual([]);
    expect(info.counties).toEqual([]);
    expect(info.baronies).toEqual([]);
  });

  it("skips titles whose key has an unrecognized tier prefix", async () => {
    const gs = Buffer.from(
      [
        "played_character={ character=7 }",
        "landed_titles={",
        "landed_titles={",
        '10={ key="x_mystery" name="Mystery" holder=7 }',
        '11={ key="d_foo" name="Foo" holder=7 }',
        "}",
        "}",
        "living={",
        "7={ landed_data={ domain={ 10 11 } } }",
        "}",
      ].join("\n"),
    );
    const info = await queryGamestate(gs, (q) => extractTitles(q, new Localizer(null)));
    // x_mystery is dropped entirely; only the duchy is counted.
    expect(info.total).toBe(1);
    expect(info.duchies).toEqual([{ id: 11, name: "Foo", deJureLiege: null }]);
    expect(info.empires).toEqual([]);
    expect(info.kingdoms).toEqual([]);
    expect(info.counties).toEqual([]);
    expect(info.baronies).toEqual([]);
  });
});

describe("titles tool", () => {
  it("renders held titles grouped by tier", async () => {
    const snap = {
      date: "1130-07-24",
      parsedAt: Date.now(),
      titles: {
        empires: [{ id: 1, name: "The Holy Roman Empire", deJureLiege: null }],
        kingdoms: [{ id: 2, name: "Bohemia", deJureLiege: "The Holy Roman Empire" }],
        duchies: [], counties: [], baronies: [], total: 2,
      },
    } as any;
    const cache = { get: async () => snap } as any;

    let handler: any;
    const server = {
      registerTool: (_name: string, _cfg: any, h: any) => { handler = h; },
    } as any;

    registerTitlesTool(server, cache);
    const res = await handler({});
    const text = res.content[0].text as string;

    expect(text).toContain("Held titles");
    expect(text).toContain("1 empire");
    expect(text).toContain("1 kingdom");
    // Grouping headings and the empire's own list line (the null-deJureLiege,
    // no-suffix branch) — pinned independently of the kingdom's de-jure suffix.
    expect(text).toContain("## Empires (1)");
    expect(text).toContain("## Kingdoms (1)");
    expect(text).toContain("\n- The Holy Roman Empire\n");
    expect(text).toContain("Bohemia (de jure: The Holy Roman Empire)");
  });

  it("uses correct irregular plurals in the header counts", async () => {
    const snap = {
      date: "1130-07-24",
      parsedAt: Date.now(),
      titles: {
        empires: [],
        kingdoms: [],
        duchies: [
          { id: 1, name: "D1", deJureLiege: null },
          { id: 2, name: "D2", deJureLiege: null },
        ],
        counties: [
          { id: 3, name: "C1", deJureLiege: null },
          { id: 4, name: "C2", deJureLiege: null },
        ],
        baronies: [
          { id: 5, name: "B1", deJureLiege: null },
          { id: 6, name: "B2", deJureLiege: null },
        ],
        total: 6,
      },
    } as any;
    const cache = { get: async () => snap } as any;

    let handler: any;
    const server = {
      registerTool: (_name: string, _cfg: any, h: any) => { handler = h; },
    } as any;

    registerTitlesTool(server, cache);
    const res = await handler({});
    const text = res.content[0].text as string;

    expect(text).toContain("2 duchies");
    expect(text).toContain("2 counties");
    expect(text).toContain("2 baronies");
    expect(text).not.toContain("duchys");
    expect(text).not.toContain("countys");
    expect(text).not.toContain("baronys");
  });
});
