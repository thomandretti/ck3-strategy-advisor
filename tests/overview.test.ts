import { expect, test } from "vitest";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { buildSnapshot } from "../src/snapshot.js";
import { Localizer } from "../src/localization.js";

const GS = readFileSync(fileURLToPath(new URL("./fixtures/mini-gamestate.txt", import.meta.url)));

test("buildSnapshot extracts the realm overview", async () => {
  const snap = await buildSnapshot(GS, new Localizer(null));
  expect(snap.overview.rulerName).toBe("Emperor Jenec");
  expect(snap.overview.primaryTitle).toBe("The Holy Roman Empire");
  expect(snap.overview.tier).toBe(5);
  expect(snap.overview.house).toBe("Přemyslid");
  expect(snap.overview.gold).toBe(124.5);
  expect(snap.overview.prestige).toBe(820.0);
  expect(snap.overview.piety).toBe(310.0);
  expect(snap.date).toBe("1130.7.24");
  expect(snap.parsedAt).toBeGreaterThan(0);
});
