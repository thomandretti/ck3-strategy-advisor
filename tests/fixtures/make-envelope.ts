import AdmZip from "adm-zip";

const ZIP_SIG = Buffer.from([0x50, 0x4b, 0x03, 0x04]); // PK\x03\x04

// A text save: "SAV" header line + PLAINTEXT meta region (note the literal
// "meta_data={") + an embedded zip containing a plaintext `gamestate`.
export function makeTextEnvelope(gamestate: string): Buffer {
  const header = Buffer.from("SAV010000000000000000000\n", "latin1");
  const meta = Buffer.from('meta_data={\n\tversion="1.8.1"\n}\n', "latin1");
  const zip = new AdmZip();
  zip.addFile("gamestate", Buffer.from(gamestate, "utf8"));
  return Buffer.concat([header, meta, zip.toBuffer()]);
}

// A realistic ironman/binary save: "SAV" header, BINARY meta tokens (NO
// plaintext "meta_data="), then an embedded PKZIP — exactly like real CK3
// ironman saves. The zip's presence must NOT cause misclassification as text.
export function makeBinaryEnvelope(): Buffer {
  const header = Buffer.from("SAV010000000000000000000\n", "latin1");
  const binaryMeta = Buffer.from([0x55, 0x31, 0x01, 0x00, 0x03, 0x00, 0x8f, 0x05]);
  const zip = new AdmZip();
  zip.addFile("gamestate", Buffer.from([0x01, 0x02, 0x03, 0x04])); // binary gamestate
  return Buffer.concat([header, binaryMeta, zip.toBuffer()]);
}

export { ZIP_SIG };
