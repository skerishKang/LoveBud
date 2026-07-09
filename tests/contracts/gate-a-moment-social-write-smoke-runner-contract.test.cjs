/**
 * Contract tests for the Gate A moment-social-write smoke runner (Issue #3334).
 *
 * These tests verify that scripts/smoke-gate-a-moment-social-write.mjs satisfies
 * the Gate A runner contract:
 *   - missing required env yields a BLOCKED result (fail-closed);
 *   - output shape is the typed/sanitized Gate A evidence block only;
 *   - forbidden raw/private fields are never printed;
 *   - the runner does NOT contain committed fixture identifiers or credentials.
 *
 * All assertions are source-level + safe child-process output inspection.
 * No network, DB, fixture, credential, or production action is performed.
 *
 * Refs: #3334, #3264, #3188, #3075, #1882
 */

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { execFileSync } = require('node:child_process');

const ROOT = path.resolve(__dirname, '..', '..');
const RUNNER_PATH = path.join(ROOT, 'scripts', 'smoke-gate-a-moment-social-write.mjs');

function readFile(filePath) {
  assert.ok(fs.existsSync(filePath), `File must exist at ${filePath}`);
  return fs.readFileSync(filePath, 'utf8');
}

function runRunner(env) {
  try {
    const out = execFileSync('node', [RUNNER_PATH], {
      env: { ...process.env, ...env },
      encoding: 'utf8',
      timeout: 30000,
    });
    return { code: 0, out, err: '' };
  } catch (err) {
    // The runner may exit non-zero on some failures, but BLOCKED_MISSING_ENV exits 0.
    return { code: err.status ?? 1, out: err.stdout ?? '', err: err.stderr ?? '' };
  }
}

const REQUIRED_KEYS = [
  'smokeStatus',
  'reactionWrite',
  'commentWrite',
  'publicVisibility',
  'legacyCompatibility',
  'genericTargetIntegrity',
  'triggerCompatibility',
  'secret/private exposure',
];

// Forbidden raw/private substrings that must NEVER appear in runner output
// on ANY channel (stdout or stderr).
const FORBIDDEN_PATTERNS = [
  // Opaque operator env var NAMES must not be echoed.
  /\bGATE_A_(API_BASE|MEMORY_ID|TREE_ID|AUTHORIZATION|REACTION_KEY|COMMENT_KEY|TIMEOUT_MS)\b/,
  // Auth / credential labels.
  /authorization/i,
  /bearer\s+[A-Za-z0-9._-]+/i,
  /idempotency-?key:\s*[A-Za-z0-9._:-]+/i,
  // Secret / private terms (but NOT "secret/private exposure" — that is the
  // allowed evidence key emitted by the runner).
  /\btoken\b/i,
  /\bpassword\b/i,
  /\bcookie\b/i,
  /\bcredential/i,
  // Request/response metadata.
  /request\b/i,
  /response\b/i,
  /header\b/i,
  /status code/i,
  // Raw identifiers.
  /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/i, // UUID
  /tree_id=|memory_id=|treeId=|memoryId=/i,
  /"body":/i,
];

// ─── 1. Runner file exists ────────────────────────────────────────────────────

test('Gate A runner: script file exists', () => {
  assert.ok(fs.existsSync(RUNNER_PATH), 'Runner script must exist');
});

// ─── 2. Missing env yields BLOCKED (fail-closed) ──────────────────────────────

test('Gate A runner: missing required env yields BLOCKED_MISSING_ENV', () => {
  // Run with NO Gate A env at all.
  const { out } = runRunner({});
  assert.ok(
    /smokeStatus:\s*BLOCKED_MISSING_ENV/.test(out),
    `Expected BLOCKED_MISSING_ENV in output, got:\n${out}`
  );
  // All sub-checks must be NOT_RUN when blocked by missing env.
  for (const key of ['reactionWrite', 'commentWrite', 'publicVisibility']) {
    assert.ok(
      new RegExp(`${key}:\\s*NOT_RUN`).test(out),
      `Expected ${key}: NOT_RUN when blocked, got:\n${out}`
    );
  }
});

test('Gate A runner: partial env (only API base) still BLOCKED_MISSING_ENV', () => {
  const { out } = runRunner({ GATE_A_API_BASE: 'https://example.invalid' });
  assert.ok(
    /smokeStatus:\s*BLOCKED_MISSING_ENV/.test(out),
    `Expected BLOCKED_MISSING_ENV with partial env, got:\n${out}`
  );
});

// ─── 3. Output shape is typed/sanitized ───────────────────────────────────────

test('Gate A runner: output contains exactly the typed Gate A evidence keys', () => {
  const { out } = runRunner({});
  for (const key of REQUIRED_KEYS) {
    assert.ok(
      new RegExp(`^${key.replace('/', '\\/')}:\\s*\\S+$`, 'm').test(out),
      `Output must include typed key "${key}", got:\n${out}`
    );
  }
});

test('Gate A runner: evidence values are restricted to allowed enum tokens', () => {
  const { out } = runRunner({});
  const allowed = /^(PASS|FAIL|NOT_RUN|BLOCKED_[A-Z0-9_]+|NONE|STOP_AND_REPORT)$/;
  for (const line of out.split('\n')) {
    const m = line.match(/^([^:]+):\s*(.+)$/);
    if (!m) continue;
    assert.ok(
      allowed.test(m[2].trim()),
      `Evidence value "${m[2]}" for "${m[1]}" is not in the allowed enum`
    );
  }
});

test('Gate A runner: secret/private exposure value is NONE in blocked state', () => {
  const { out } = runRunner({});
  assert.ok(
    /secret\/private exposure:\s*NONE/.test(out),
    `Expected secret/private exposure: NONE, got:\n${out}`
  );
});

// ─── 4. Forbidden raw/private fields are not printed ──────────────────────────

test('Gate A runner: output contains no forbidden raw/private substrings', () => {
  const { out } = runRunner({});
  for (const pat of FORBIDDEN_PATTERNS) {
    assert.ok(
      !pat.test(out),
      `Output must not contain forbidden pattern ${pat}, got:\n${out}`
    );
  }
});

// ─── 4b. stderr must be empty for blocked runs; no channel leaks env/auth/raw ──

test('Gate A runner: blocked run emits NO output on stderr', () => {
  const { err } = runRunner({});
  assert.strictEqual(err, '', `Blocked run must not write to stderr, got:\n${err}`);
});

test('Gate A runner: stale Netlify API base yields BLOCKED_STALE_NETLIFY_API_BASE', () => {
  const env = {
    GATE_A_API_BASE: 'https://lovebud.netlify.app',
    GATE_A_MEMORY_ID: 'mem-0000',
    GATE_A_TREE_ID: 'tree-0000',
    GATE_A_AUTHORIZATION: 'opaque-token',
    GATE_A_REACTION_KEY: 'rk-0000',
    GATE_A_COMMENT_KEY: 'ck-0000',
  };
  const { out } = runRunner(env);
  assert.ok(
    /smokeStatus:\s*BLOCKED_STALE_NETLIFY_API_BASE/.test(out),
    `Expected BLOCKED_STALE_NETLIFY_API_BASE for Netlify base, got:\n${out}`
  );
  for (const key of ['reactionWrite', 'commentWrite', 'publicVisibility']) {
    assert.ok(
      new RegExp(`${key}:\\s*NOT_RUN`).test(out),
      `Expected ${key}: NOT_RUN when blocked by stale Netlify base, got:\n${out}`
    );
  }
  assert.ok(
    /secret\/private exposure:\s*NONE/.test(out),
    `Expected secret/private exposure: NONE, got:\n${out}`
  );
});

test('Gate A runner: stale Netlify subdomain (*.netlify.app) also blocked', () => {
  const env = {
    GATE_A_API_BASE: 'https://main--lovebud.netlify.app',
    GATE_A_MEMORY_ID: 'mem-0000',
    GATE_A_TREE_ID: 'tree-0000',
    GATE_A_AUTHORIZATION: 'opaque-token',
    GATE_A_REACTION_KEY: 'rk-0000',
    GATE_A_COMMENT_KEY: 'ck-0000',
  };
  const { out } = runRunner(env);
  assert.ok(
    /smokeStatus:\s*BLOCKED_STALE_NETLIFY_API_BASE/.test(out),
    `Expected BLOCKED_STALE_NETLIFY_API_BASE for *.netlify.app base, got:\n${out}`
  );
});

test('Gate A runner: blocked Netlify run emits NO host/token/URL on any channel', () => {
  const env = {
    GATE_A_API_BASE: 'https://lovebud.netlify.app',
    GATE_A_MEMORY_ID: 'mem-0000',
    GATE_A_TREE_ID: 'tree-0000',
    GATE_A_AUTHORIZATION: 'opaque-token',
    GATE_A_REACTION_KEY: 'rk-0000',
    GATE_A_COMMENT_KEY: 'ck-0000',
  };
  const { out, err } = runRunner(env);
  const combined = `${out}\n${err}`;
  // No raw URL/host leak.
  assert.ok(!/netlify\.app/i.test(combined), `Netlify host must not be echoed, got:\n${combined}`);
  // No token/URL/env leakage (reuse forbidden patterns where applicable).
  for (const pat of FORBIDDEN_PATTERNS) {
    assert.ok(!pat.test(combined), `Blocked Netlify run must not leak ${pat}, got:\n${combined}`);
  }
  assert.strictEqual(err, '', `Blocked Netlify run must not write to stderr, got:\n${err}`);
});

test('Gate A runner: Cloudflare Pages base is NOT blocked by the Netlify guardrail', () => {
  // A valid Cloudflare/Modal base must NOT trip the Netlify guardrail.
  // With only the base set (other env missing), it should still report
  // BLOCKED_MISSING_ENV, proving the Netlify check did not short-circuit it.
  const { out } = runRunner({ GATE_A_API_BASE: 'https://lovebud.pages.dev' });
  assert.ok(
    /smokeStatus:\s*BLOCKED_MISSING_ENV/.test(out),
    `Cloudflare Pages base must not be treated as stale Netlify, got:\n${out}`
  );
});

// ─── 5. Runner source contains no committed fixture identifiers or credentials ─

test('Gate A runner: source hard-codes no fixture/tree/memory UUIDs', () => {
  const src = readFile(RUNNER_PATH);
  assert.ok(
    !/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/i.test(src),
    'Runner source must not contain any UUID (tree/memory/idempotency)'
  );
});

test('Gate A runner: source hard-codes no bearer token or credential', () => {
  const src = readFile(RUNNER_PATH);
  // The runner builds the Authorization header from an ENV value at runtime
  // (Template literal `Bearer ${process.env.X}`). That is NOT a hard-coded token.
  // A hard-coded token would be a literal string assigned/returned, e.g.
  //   Authorization: `Bearer sk-...`  or  const TOKEN = 'abc123'
  // Forbid literal token-looking assignments / non-env bearer literals.
  assert.ok(
    !/Authorization:\s*`Bearer\s+[^`]*\$?\{?[^}]*\}[^`]*`\s*$/m.test(src) ||
      /process\.env\.GATE_A_AUTHORIZATION/.test(src),
    'If a Bearer literal exists, it must be built only from process.env'
  );
  assert.ok(
    !/(const|let|var)\s+\w*(token|auth|key|secret|credential)\w*\s*=\s*['"][^'"]{8,}/i.test(src),
    'Runner source must not assign a literal credential value to a variable'
  );
});

test('Gate A runner: source reads all inputs from env-only (process.env)', () => {
  const src = readFile(RUNNER_PATH);
  // Required inputs must be sourced via process.env, never literals.
  for (const key of [
    'GATE_A_API_BASE',
    'GATE_A_MEMORY_ID',
    'GATE_A_TREE_ID',
    'GATE_A_AUTHORIZATION',
    'GATE_A_REACTION_KEY',
    'GATE_A_COMMENT_KEY',
  ]) {
    assert.ok(
      src.includes(`process.env.${key}`),
      `Runner must read ${key} from process.env`
    );
  }
});

test('Gate A runner: source contains no fixture-creation or schema-migration calls', () => {
  const src = readFile(RUNNER_PATH);
  // The word "fixture" may appear in comments/docs; what is forbidden is an
  // actual provisioning/seed/create call. Check for actionable provisioning.
  assert.ok(
    !/\b(provision|seed|createFixture|create_fixture|createTree|createMemory|POST.*\/trees\b.*method:\s*['"]POST['"]|POST.*\/memories\b.*method:\s*['"]POST['"])\b/i.test(src),
    'Runner source must not create/provision fixtures or trees/memories'
  );
  // No SQL / schema / migration execution.
  assert.ok(
    !/\b(?:psql|CREATE TABLE|ALTER TABLE|DROP TABLE|migration)\b/i.test(src),
    'Runner source must not contain SQL/migration execution'
  );
});

test('Gate A runner: source emits only the typed evidence block (no request/response bodies)', () => {
  const src = readFile(RUNNER_PATH);
  // It must not console.log raw responses; only the emit() evidence block.
  assert.ok(
    !/console\.log\(.*res|console\.log\(.*response|console\.log\(.*body/i.test(src),
    'Runner must not log raw response/body content'
  );
});
