#!/usr/bin/env node

import fs from "node:fs";
import path from "node:path";
import process from "node:process";
import { execSync } from "node:child_process";

const ROOT = process.cwd();
const REQUIRED_PATHS = [
  "index.html"
];

function assertExists(relPath) {
  const fullPath = path.join(ROOT, relPath);
  if (!fs.existsSync(fullPath)) {
    throw new Error(`Required path missing: ${relPath}`);
  }
}

function resolveSha() {
  const raw = execSync("git rev-parse HEAD", {
    encoding: "utf-8",
    timeout: 15000,
  }).trim();
  if (!/^[0-9a-f]{40}$/.test(raw)) {
    throw new Error(
      `Resolved SHA is not a valid 40-character hex string: ${raw}`
    );
  }
  return raw;
}

function generateManifest(sha) {
  const dir = path.join(ROOT, ".well-known");
  const filePath = path.join(dir, "release.json");
  const manifest = JSON.stringify(
    { release_sha: sha, contract_version: "1" },
    null,
    2
  ) + "\n";
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(filePath, manifest, "utf-8");
  console.log(`Release manifest generated at .well-known/release.json`);
}

try {
  for (const relPath of REQUIRED_PATHS) {
    assertExists(relPath);
  }

  const sha = resolveSha();
  generateManifest(sha);

  console.log("Static build check passed.");
  console.log("No bundle step configured; deploy remains static HTML/JS.");
} catch (error) {
  console.error("Static build check failed.");
  console.error(error.message);
  process.exit(1);
}
