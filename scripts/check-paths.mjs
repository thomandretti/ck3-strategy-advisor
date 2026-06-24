// Verify JSON-pointer paths resolve THROUGH jomini (not just raw text).
// jomini pointer resolution can differ from raw text (duplicate keys, arrays).
// Usage: node scripts/check-paths.mjs <gamestate.txt|save.ck3> <ptr1> [ptr2 ...]
// Supports {player} placeholder -> replaced with /played_character/character id.
import { readFileSync } from "node:fs";
import AdmZip from "adm-zip";
import { Jomini } from "jomini";

const [, , file, ...ptrs] = process.argv;
if (!file || ptrs.length === 0) { console.error("usage: check-paths <gs.txt|save.ck3> <ptr> [ptr...]"); process.exit(2); }

const buf = readFileSync(file);
const gsBuf = file.endsWith(".ck3")
  ? new AdmZip(buf.subarray(buf.indexOf(Buffer.from([0x50,0x4b,0x03,0x04])))).getEntries().find((e)=>e.entryName==="gamestate").getData()
  : buf;

const parser = await Jomini.initialize();
const out = parser.parseText(gsBuf, { encoding: "utf8" }, (q) => {
  const player = q.at("/played_character/character");
  const res = {};
  for (const raw of ptrs) {
    const ptr = raw.replaceAll("{player}", String(player));
    let v;
    try { v = q.at(ptr); } catch (e) { v = `ERROR: ${e.message}`; }
    const t = v instanceof Date ? `Date(${v.toISOString().slice(0,10)})`
      : Array.isArray(v) ? `array[${v.length}]`
      : v && typeof v === "object" ? `object{${Object.keys(v).slice(0,12).join(",")}}`
      : JSON.stringify(v);
    res[ptr] = `${typeof v}: ${t}`;
  }
  return { player, res };
});
console.log("player id:", out.player);
for (const [k, v] of Object.entries(out.res)) console.log(`  ${k}\n    -> ${v}`);
