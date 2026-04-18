#!/usr/bin/env node

const fs = require("fs");
const path = require("path");

const ROOT = process.cwd();
const REQUIRED_PATHS = [
  "index.html",
  "netlify.toml",
  "netlify/functions"
];

function assertExists(relPath) {
  const fullPath = path.join(ROOT, relPath);
  if (!fs.existsSync(fullPath)) {
    throw new Error(`Required path missing: ${relPath}`);
  }
}

try {
  for (const relPath of REQUIRED_PATHS) {
    assertExists(relPath);
  }

  console.log("Static build check passed.");
  console.log("No bundle step configured; deploy remains static HTML/JS.");
} catch (error) {
  console.error("Static build check failed.");
  console.error(error.message);
  process.exit(1);
}
