import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { titleTierFromKey } from "../src/extract/titleUtils.js";
import { buildSnapshot } from "../src/snapshot.js";
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
    expect(text).toContain("The Holy Roman Empire");
    expect(text).toContain("Bohemia (de jure: The Holy Roman Empire)");
  });
});
