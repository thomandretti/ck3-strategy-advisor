import AdmZip from "adm-zip";

export type SaveFormat = "text" | "ironman" | "unknown";
export class IronmanError extends Error {}

const ZIP_SIG = Buffer.from([0x50, 0x4b, 0x03, 0x04]); // PK\x03\x04

export function detectFormat(buf: Buffer): SaveFormat {
  if (buf.subarray(0, 3).toString("latin1") !== "SAV") return "unknown";
  // Text saves store the meta region as plaintext right after the header line
  // (verified: literal "meta_data={" at ~offset 24). Ironman saves store it as
  // binary tokens. BOTH embed a PKZIP gamestate, so PK presence is NOT the
  // discriminator — the plaintext meta marker is.
  const head = buf.subarray(0, 256).toString("latin1");
  if (head.includes("meta_data={")) return "text";
  return "ironman";
}

export function extractGamestate(buf: Buffer): Buffer {
  const format = detectFormat(buf);
  if (format === "ironman") {
    throw new IronmanError(
      "This save is in CK3's binary token format (Ironman saves and autosaves " +
        "use it) which the advisor can't decode. Make a normal (non-autosave) " +
        "save and it will be picked up automatically.",
    );
  }
  if (format === "unknown") throw new Error("Not a CK3 save file (missing SAV header).");
  const at = buf.indexOf(ZIP_SIG);
  const zip = new AdmZip(buf.subarray(at));
  const entry = zip.getEntries().find((e) => e.entryName === "gamestate");
  if (!entry) throw new Error("Save archive has no `gamestate` entry.");
  return entry.getData();
}
