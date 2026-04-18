const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("fs");
const path = require("path");

const ROOT = process.cwd();

function read(relPath) {
  return fs.readFileSync(path.join(ROOT, relPath), "utf8");
}

test("netlify.toml keeps API redirects and does not use global SPA fallback", () => {
  const netlifyToml = read("netlify.toml");

  assert.notEqual(
    netlifyToml.indexOf('from = "/api/trees"'),
    -1,
    "API redirect missing"
  );

  assert.equal(
    netlifyToml.indexOf('from = "/*"'),
    -1,
    "Global SPA fallback should not exist in static multipage mode"
  );
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
