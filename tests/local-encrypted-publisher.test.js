const assert = require("assert");
const crypto = require("crypto");
const fs = require("fs");
const os = require("os");
const path = require("path");
const { DATA_MAGIC, parseArgs, readPackage } = require("../scripts/publish-encrypted-data.js");

assert.deepEqual(parseArgs(["--artifact", "a.enc", "--metadata", "a.json"]), { artifact: "a.enc", metadata: "a.json" });
assert.throws(() => parseArgs(["--artifact", "a.enc"]), /Usage/);
assert.throws(() => parseArgs(["--unknown", "x"]), /Unknown option/);

const dir = fs.mkdtempSync(path.join(os.tmpdir(), "anya-publish-test-"));
const artifact = path.join(dir, "data.enc"), metadataFile = path.join(dir, "data.publish.json");
const payload = Buffer.concat([DATA_MAGIC, Buffer.from("synthetic encrypted payload")]);
fs.writeFileSync(artifact, payload);
const metadata = {
  packageVersion: 1,
  dataPath: "data/voice_analytics.xlsx",
  metadataPath: "data/voice_analytics.xlsx.meta.json",
  plaintextSha256: "a".repeat(64),
  encryptedSha256: crypto.createHash("sha256").update(payload).digest("hex"),
  encryptedBytes: payload.length,
  createdAt: "2026-08-07T00:00:00.000Z",
};
fs.writeFileSync(metadataFile, `${JSON.stringify(metadata)}\n`);
assert.equal(readPackage(artifact, metadataFile).metadata.plaintextSha256, metadata.plaintextSha256);
metadata.encryptedSha256 = "b".repeat(64);
fs.writeFileSync(metadataFile, `${JSON.stringify(metadata)}\n`);
assert.throws(() => readPackage(artifact, metadataFile), /checksum/);
fs.rmSync(dir, { recursive: true, force: true });
console.log("Local encrypted publisher tests passed");
