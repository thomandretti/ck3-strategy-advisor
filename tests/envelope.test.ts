import { expect, test } from "vitest";
import { detectFormat, extractGamestate, IronmanError } from "../src/envelope.js";
import { makeTextEnvelope, makeBinaryEnvelope, ZIP_SIG } from "./fixtures/make-envelope.js";

test("detects and extracts a text save's gamestate", () => {
  const buf = makeTextEnvelope("date=1130.7.24\nplayed_character={ character=42 }\n");
  expect(detectFormat(buf)).toBe("text");
  const gs = extractGamestate(buf).toString("utf8");
  expect(gs).toContain("played_character");
  expect(gs).toContain("character=42");
});

test("rejects an ironman/binary save even though it embeds a zip", () => {
  const buf = makeBinaryEnvelope();
  // Guard: the fixture genuinely contains a PK zip, like real ironman saves.
  expect(buf.indexOf(ZIP_SIG)).toBeGreaterThan(-1);
  expect(detectFormat(buf)).toBe("ironman");
  expect(() => extractGamestate(buf)).toThrow(IronmanError);
});

test("returns unknown for a non-CK3 buffer", () => {
  expect(detectFormat(Buffer.from("not a save"))).toBe("unknown");
});
