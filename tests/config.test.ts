import { expect, test } from "vitest";
import { resolveConfig } from "../src/config.js";

test("env vars take precedence", () => {
  const cfg = resolveConfig({ CK3_SAVE_DIR: "/saves", CK3_GAME_DIR: "/game" });
  expect(cfg).toEqual({ saveDir: "/saves", gameDir: "/game" });
});

test("missing env yields nulls", () => {
  expect(resolveConfig({})).toEqual({ saveDir: null, gameDir: null });
});
