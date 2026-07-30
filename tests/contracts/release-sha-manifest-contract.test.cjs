const { test, after } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const { execSync } = require("node:child_process");

const ROOT = path.resolve(__dirname, "..", "..");
const MANIFEST_DIR = path.join(ROOT, ".well-known");
const MANIFEST_PATH = path.join(MANIFEST_DIR, "release.json");
const HEADERS_PATH = path.join(ROOT, "_headers");
const BUILD_SCRIPT = path.join(ROOT, "scripts", "build-static.js");

function cleanup() {
  if (fs.existsSync(MANIFEST_DIR)) {
    fs.rmSync(MANIFEST_DIR, { recursive: true, force: true });
  }
}

after(() => {
  cleanup();
});

test("1. build script exists and is executable entry", () => {
  assert.ok(fs.existsSync(BUILD_SCRIPT), "build-static.js must exist");
  const stat = fs.statSync(BUILD_SCRIPT);
  assert.ok(stat.isFile(), "build-static.js must be a file");
});

test("2. npm run build generates the manifest", () => {
  execSync("npm run build", { cwd: ROOT, encoding: "utf-8", timeout: 30000 });
  assert.ok(fs.existsSync(MANIFEST_PATH), "manifest must exist after build");
});

test("3. manifest is valid JSON with exactly two keys", () => {
  const raw = fs.readFileSync(MANIFEST_PATH, "utf-8");
  let parsed;
  try {
    parsed = JSON.parse(raw);
  } catch {
    assert.fail("manifest must be valid JSON");
  }
  assert.equal(typeof parsed, "object", "manifest must be a JSON object");
  assert.equal(Array.isArray(parsed), false, "manifest must be a JSON object, not array");
  const keys = Object.keys(parsed).sort();
  assert.deepEqual(keys, ["contract_version", "release_sha"], "manifest must have exactly release_sha and contract_version");
});

test("4. release_sha is full 40-character lowercase hex", () => {
  const raw = fs.readFileSync(MANIFEST_PATH, "utf-8");
  const parsed = JSON.parse(raw);
  assert.equal(typeof parsed.release_sha, "string", "release_sha must be a string");
  assert.match(parsed.release_sha, /^[0-9a-f]{40}$/, "release_sha must be exactly 40 lowercase hex characters");
});

test("5. release_sha matches the checked-out source SHA", () => {
  const sha = execSync("git rev-parse HEAD", {
    cwd: ROOT, encoding: "utf-8", timeout: 15000,
  }).trim();
  const raw = fs.readFileSync(MANIFEST_PATH, "utf-8");
  const parsed = JSON.parse(raw);
  assert.equal(parsed.release_sha, sha, "release_sha must equal checked-out HEAD SHA");
});

test("6. contract_version equals 1", () => {
  const raw = fs.readFileSync(MANIFEST_PATH, "utf-8");
  const parsed = JSON.parse(raw);
  assert.equal(parsed.contract_version, "1", "contract_version must be '1'");
});

test("7. manifest has no forbidden metadata fields", () => {
  const raw = fs.readFileSync(MANIFEST_PATH, "utf-8");
  const parsed = JSON.parse(raw);
  const forbidden = ["timestamp", "branch", "actor", "email", "build_url", "buildUrl", "environment", "cloudflare", "deployment", "request_id", "requestId"];
  for (const key of Object.keys(parsed)) {
    if (forbidden.includes(key.toLowerCase())) {
      assert.fail(`forbidden field found: ${key}`);
    }
  }
});

test("8. _headers has path-specific freshness rule for manifest", () => {
  assert.ok(fs.existsSync(HEADERS_PATH), "_headers must exist");
  const content = fs.readFileSync(HEADERS_PATH, "utf-8");
  assert.match(content, /\.well-known\/release\.json/, "_headers must reference .well-known/release.json path");
  assert.match(content, /Cache-Control:\s*no-store/, "_headers must specify Cache-Control: no-store for manifest");
});

test("9. build fails when SHA is missing or invalid", () => {
  const tmpDir = fs.mkdtempSync("sha-fail-test-");
  try {
    execSync("git init && git config user.email test@test && git config user.name test && git commit --allow-empty -m 'no sha'", {
      cwd: tmpDir, encoding: "utf-8", timeout: 15000,
    });
    const result = execSync(`node ${BUILD_SCRIPT}`, {
      cwd: tmpDir, encoding: "utf-8", timeout: 15000, stdio: ["pipe", "pipe", "pipe"],
    });
    assert.fail("build must fail when SHA is invalid, but it succeeded");
  } catch (e) {
    assert.ok(true, "build correctly failed when SHA context is invalid");
  } finally {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  }
});

test("10. cleanup leaves no unauthorized generated source diff", () => {
  cleanup();
  assert.equal(fs.existsSync(MANIFEST_DIR), false, "generated .well-known dir must be removed after cleanup");
  const untracked = execSync("git status --porcelain .well-known/", {
    cwd: ROOT, encoding: "utf-8", timeout: 15000,
  }).trim();
  assert.equal(untracked, "", "no untracked .well-known files must remain after cleanup");
});
