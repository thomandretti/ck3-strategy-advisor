import { expect, test } from "vitest";
import { queryGamestate } from "../src/parser.js";

const GS = Buffer.from(
  `date="1130.7.24"\nplayed_character={\n\tcharacter=33564206\n\tplayer=1\n}\n`,
  "utf8",
);

test("queries a value by json pointer", async () => {
  const player = await queryGamestate(GS, (q) => q.at("/played_character/character"));
  expect(player).toBe(33564206);
});

test("exposes root for whole-object access", async () => {
  const root = (await queryGamestate(GS, (q) => q.root())) as Record<string, unknown>;
  expect(root).toHaveProperty("played_character");
});
