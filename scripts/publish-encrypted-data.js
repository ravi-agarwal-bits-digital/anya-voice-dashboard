#!/usr/bin/env node
"use strict";

// Publishes an Admin-generated encrypted data package. It intentionally never
// reads a raw export or an Admin passphrase.
const crypto = require("crypto");
const fs = require("fs");
const path = require("path");
const { spawnSync } = require("child_process");

const DATA_MAGIC = Buffer.from("AANYAENC1"),
  MAX_ARTIFACT_BYTES = 95 * 1024 * 1024,
  DATA_PATH = "data/voice_analytics.xlsx",
  METADATA_PATH = "data/voice_analytics.xlsx.meta.json";

function usage() {
  return [
    "Usage:",
    "  node scripts/publish-encrypted-data.js --artifact /path/data.enc --metadata /path/data.publish.json",
  ].join("\n");
}
function parseArgs(args) {
  const options = {};
  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index];
    if (arg === "--help" || arg === "-h") return { help: true };
    if (arg !== "--artifact" && arg !== "--metadata")
      throw Error(`Unknown option: ${arg}`);
    if (!args[index + 1]) throw Error(`Missing value for ${arg}`);
    options[arg.slice(2)] = args[index + 1];
    index += 1;
  }
  if (!options.artifact || !options.metadata) throw Error(usage());
  return options;
}
function sha256File(filePath) {
  return crypto.createHash("sha256").update(fs.readFileSync(filePath)).digest("hex");
}
function readPackage(artifactPath, metadataPath) {
  const artifact = path.resolve(artifactPath), metadataFile = path.resolve(metadataPath);
  if (!fs.statSync(artifact).isFile()) throw Error("Encrypted artifact is not a file.");
  if (!fs.statSync(metadataFile).isFile()) throw Error("Package metadata is not a file.");
  const size = fs.statSync(artifact).size;
  if (size > MAX_ARTIFACT_BYTES)
    throw Error(`Encrypted artifact is ${(size / 1048576).toFixed(2)} MB; local Git publishing is limited to ${(MAX_ARTIFACT_BYTES / 1048576).toFixed(0)} MB.`);
  const header = Buffer.alloc(DATA_MAGIC.length), descriptor = fs.openSync(artifact, "r");
  try {
    fs.readSync(descriptor, header, 0, header.length, 0);
  } finally {
    fs.closeSync(descriptor);
  }
  if (!header.equals(DATA_MAGIC)) throw Error("Encrypted artifact does not have the AANYAENC1 signature.");
  let metadata;
  try {
    metadata = JSON.parse(fs.readFileSync(metadataFile, "utf8"));
  } catch {
    throw Error("Package metadata is not valid JSON.");
  }
  if (
    metadata?.packageVersion !== 1 ||
    metadata.dataPath !== DATA_PATH ||
    metadata.metadataPath !== METADATA_PATH ||
    !/^[a-f0-9]{64}$/.test(metadata.plaintextSha256 || "") ||
    !/^[a-f0-9]{64}$/.test(metadata.encryptedSha256 || "") ||
    !Number.isInteger(metadata.encryptedBytes) ||
    metadata.encryptedBytes !== size
  )
    throw Error("Package metadata does not match the expected Anya encrypted-data format.");
  if (sha256File(artifact) !== metadata.encryptedSha256)
    throw Error("Encrypted artifact checksum does not match its package metadata.");
  return { artifact, metadata };
}
function run(command, args, cwd) {
  const result = spawnSync(command, args, { cwd, encoding: "utf8" });
  if (result.error) throw result.error;
  if (result.status !== 0)
    throw Error(`${command} ${args.join(" ")} failed.\n${(result.stderr || result.stdout || "").trim()}`);
  return (result.stdout || "").trim();
}
function main(argv = process.argv.slice(2), repoRoot = path.resolve(__dirname, "..")) {
  const options = parseArgs(argv);
  if (options.help) return console.log(usage());
  const { artifact, metadata } = readPackage(options.artifact, options.metadata);
  if (run("git", ["branch", "--show-current"], repoRoot) !== "main")
    throw Error("Run this helper from the main branch of a clean local clone.");
  if (run("git", ["status", "--porcelain"], repoRoot))
    throw Error("Your local clone has uncommitted changes. Commit, stash, or discard them before publishing data.");
  run("git", ["pull", "--ff-only", "origin", "main"], repoRoot);
  let currentMetadata = null;
  try {
    currentMetadata = JSON.parse(fs.readFileSync(path.join(repoRoot, METADATA_PATH), "utf8"));
  } catch { /* A first publish has no metadata yet. */ }
  if (currentMetadata?.plaintextSha256 === metadata.plaintextSha256) {
    console.log("This exact data export is already published. Nothing changed.");
    return;
  }
  fs.copyFileSync(artifact, path.join(repoRoot, DATA_PATH));
  run("git", ["add", DATA_PATH], repoRoot);
  run("git", ["commit", "-m", "Update Anya voice analytics data"], repoRoot);
  const dataCommitSha = run("git", ["rev-parse", "HEAD"], repoRoot);
  const publicMetadata = {
    schemaVersion: 1,
    plaintextSha256: metadata.plaintextSha256,
    dataCommitSha,
    publishedAt: new Date().toISOString(),
  };
  fs.writeFileSync(
    path.join(repoRoot, METADATA_PATH),
    `${JSON.stringify(publicMetadata, null, 2)}\n`,
  );
  run("git", ["add", METADATA_PATH], repoRoot);
  run("git", ["commit", "-m", "Record Anya data publication fingerprint"], repoRoot);
  run("git", ["push", "origin", "main"], repoRoot);
  console.log(`Published encrypted data and metadata. Data commit: ${dataCommitSha}`);
}

if (require.main === module) {
  try {
    main();
  } catch (error) {
    console.error(`Not published: ${error.message || error}`);
    process.exitCode = 1;
  }
}

module.exports = { DATA_MAGIC, MAX_ARTIFACT_BYTES, parseArgs, readPackage };
