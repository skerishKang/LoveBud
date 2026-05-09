#!/usr/bin/env node

const fs = require("fs");
const path = require("path");

const ROOT = process.cwd();
const TARGET_EXTS = new Set([".html", ".js", ".mjs", ".cjs"]);
const IGNORE_DIRS = new Set([
  ".git",
  ".github",
  "node_modules",
  ".netlify",
  "dist",
  "coverage"
]);

const errors = [];
const warnings = [];

function walk(dir) {
  const entries = fs.readdirSync(dir, { withFileTypes: true });

  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);

    if (entry.isDirectory()) {
      if (IGNORE_DIRS.has(entry.name)) continue;
      walk(fullPath);
      continue;
    }

    const ext = path.extname(entry.name).toLowerCase();
    if (!TARGET_EXTS.has(ext)) continue;

    checkFile(fullPath, ext);
  }
}

function checkFile(filePath, ext) {
  const raw = fs.readFileSync(filePath, "utf8");

  if (raw.includes("\r\n")) {
    warnings.push(`${filePath}: CRLF line endings detected`);
  }

  const lines = raw.split("\n");

  lines.forEach((line, index) => {
    const lineNo = index + 1;

    if (/\s+$/.test(line)) {
      warnings.push(`${filePath}:${lineNo} trailing whitespace`);
    }

    if (line.includes("\t")) {
      errors.push(`${filePath}:${lineNo} tab character detected`);
    }
  });

  if (ext === ".html") {
    const trimmed = raw.trim();
    if (!trimmed.includes("<!DOCTYPE html>") && !trimmed.includes("<!doctype html>")) {
      errors.push(`${filePath}: missing HTML doctype`);
    }
  }
}

try {
  walk(ROOT);

  if (errors.length > 0) {
    console.error("Static lint failed:\n");
    for (const error of errors) {
      console.error(`- ${error}`);
    }
    process.exit(1);
  }

  if (warnings.length > 0) {
    console.warn("Static lint warnings:\n");
    for (const warning of warnings) {
      console.warn(`- ${warning}`);
    }
  }

  console.log("Static lint passed.");
} catch (error) {
  console.error("Static lint crashed.");
  console.error(error);
  process.exit(1);
}
