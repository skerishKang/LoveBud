const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("fs");
const path = require("path");

const ROOT = process.cwd();

function read(relPath) {
  return fs.readFileSync(path.join(ROOT, relPath), "utf8");
}

test("Cloudflare Pages Functions API routes exist", (t) => {
  const apiDir = path.join(ROOT, "functions", "api");
  assert.ok(fs.existsSync(apiDir), "functions/api directory should exist");

  const requiredFiles = [
    "trees.js",
    "memories.js",
    "[[path]].js",
  ];

  for (const file of requiredFiles) {
    const filePath = path.join(apiDir, file);
    assert.ok(fs.existsSync(filePath), `Missing API route file: ${file}`);
  }
});

test("package.json has baseline stability scripts", () => {
  const pkg = JSON.parse(read("package.json"));

  assert.equal(typeof pkg.scripts?.lint, "string");
  assert.equal(typeof pkg.scripts?.build, "string");
  assert.equal(typeof pkg.scripts?.test, "string");
  assert.equal(typeof pkg.scripts?.ci, "string");
});

test("core static pages exist for multipage routing", () => {
  const requiredPages = [
    "index.html",
    "pages/login.html",
    "pages/search.html",
    "pages/my-trees.html",
  ];

  for (const relPath of requiredPages) {
    assert.ok(
      fs.existsSync(path.join(ROOT, relPath)),
      `Required page missing: ${relPath}`
    );
  }
});
