import { expect, test } from "vitest";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { buildSnapshot } from "../src/snapshot.js";
import { Localizer } from "../src/localization.js";
import { registerSuccessionTool } from "../src/tools/succession.js";
const GS = readFileSync(fileURLToPath(new URL("./fixtures/mini-gamestate.txt", import.meta.url)));
test("extracts heirs, laws, and claimants", async () => {
  const s = (await buildSnapshot(GS, new Localizer(null))).succession;
  expect(s.primaryTitle).toBe("The Holy Roman Empire");
  expect(s.successionLaw).toBe("single_heir_succession_law");
  expect(s.genderLaw).toBe("male_preference_law");
  expect(s.heirs[0]).toEqual({ id: 22222, name: "Adela" });
  expect(s.designatedHeir).toEqual({ id: 40000, name: "Causantin" });
  expect(s.claimants.map((c) => c.id)).toContain(22222);
});

async function renderSuccession(succession: object) {
  const snap = { date: "1118-10-02", parsedAt: Date.now(), succession } as any;
  let handler: any;
  const server = {
    registerTool: (_name: string, _cfg: any, h: any) => {
      handler = h;
    },
  } as any;
  registerSuccessionTool(server, { get: async () => snap } as any);
  return (await handler({})).content[0].text as string;
}

const base = {
  primaryTitle: "Ireland",
  primaryTitleId: 1,
  successionLaw: "Confederate Partition",
  genderLaw: "Male Preference",
  totalHeirs: 2,
  claimants: [],
  totalClaimants: 0,
};

test("tool marks the designated heir by id, not the first list entry", async () => {
  const text = await renderSuccession({
    ...base,
    designatedHeir: { id: 3, name: "Simon" },
    heirs: [
      { id: 1, name: "Daniel" },
      { id: 3, name: "Simon" },
    ],
  });
  expect(text).toContain("- Designated heir: Simon (3)");
  expect(text).toContain("2. Simon (3) <- designated heir");
  expect(text).not.toContain("1. Daniel (1) <-");
  expect(text).not.toContain("primary heir");
});

test("tool says so when the save has no designated heir", async () => {
  const text = await renderSuccession({
    ...base,
    designatedHeir: null,
    heirs: [{ id: 1, name: "Daniel" }],
  });
  expect(text).toContain("- Designated heir: not stored in this save");
  expect(text).not.toContain("<- designated heir");
});
