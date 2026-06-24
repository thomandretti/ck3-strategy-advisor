import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { queryGamestate } from "../src/parser.js";
import { forEachRelation, forEachWar } from "../src/extract/scan.js";

const GS = readFileSync(fileURLToPath(new URL("./fixtures/mini-gamestate.txt", import.meta.url)));

describe("forEachRelation", () => {
  it("visits only relations involving the subject, with the other id", async () => {
    const seen = await queryGamestate(GS, (q) => {
      const out: number[] = [];
      forEachRelation(q, 40000, (otherId) => out.push(otherId));
      return out;
    });
    expect(seen).toEqual([40001]); // 40000 is allied to 40001 only
  });

  it("yields nothing for a character in no relations", async () => {
    const seen = await queryGamestate(GS, (q) => {
      const out: number[] = [];
      forEachRelation(q, 40002, (otherId) => out.push(otherId));
      return out;
    });
    expect(seen).toEqual([]);
  });
});

describe("forEachWar", () => {
  it("visits wars the subject participates in, with their side", async () => {
    const sides = await queryGamestate(GS, (q) => {
      const out: string[] = [];
      forEachWar(q, 40000, (side) => out.push(side));
      return out;
    });
    expect(sides).toEqual(["attacker"]); // war 9002, 40000 attacks
  });

  it("yields nothing for a character in no war", async () => {
    const sides = await queryGamestate(GS, (q) => {
      const out: string[] = [];
      forEachWar(q, 40002, (side) => out.push(side));
      return out;
    });
    expect(sides).toEqual([]);
  });
});
