// Inspect a CK3 gamestate section by raw-text search.
// Usage: node scripts/inspect-section.mjs <gamestate.txt|save.ck3> <needle> [bytes=1200] [occurrence=1]
// Accepts either a raw extracted gamestate .txt or a .ck3 save (auto-unzips).
import { readFileSync } from "node:fs";
import AdmZip from "adm-zip";

const [, , file, needle, bytesArg, occArg] = process.argv;
if (!file || !needle) {
  console.error("usage: inspect-section <gs.txt|save.ck3> <needle> [bytes] [occurrence]");
  process.exit(2);
}
const bytes = Number(bytesArg ?? 1200);
const occ = Number(occArg ?? 1);

function loadText(f) {
  const buf = readFileSync(f);
  if (f.endsWith(".ck3")) {
    const at = buf.indexOf(Buffer.from([0x50, 0x4b, 0x03, 0x04]));
    return new AdmZip(buf.subarray(at))
      .getEntries()
      .find((e) => e.entryName === "gamestate")
      .getData()
      .toString("utf8");
  }
  return buf.toString("utf8");
}

const gs = loadText(file);
const re = new RegExp(`(^|\\n)\\t*${needle}=`, "g");
let m,
  found = 0,
  idx = -1;
while ((m = re.exec(gs)) !== null) {
  found++;
  if (found === occ) {
    idx = m.index + (m[1] ? 1 : 0);
    break;
  }
}
if (idx === -1) {
  console.log(`'${needle}=' occurrence ${occ} NOT FOUND (total matches: ${found})`);
  process.exit(0);
}
console.log(`'${needle}=' occurrence ${occ}/${found} at offset ${idx}:`);
console.log(gs.slice(idx, idx + bytes));
