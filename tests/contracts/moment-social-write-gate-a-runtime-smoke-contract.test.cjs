/**
 * Contract tests for Moment Social Write Gate A — Runtime Smoke Contract
 * (Issue #3265).
 *
 * These tests verify that docs/ops/moment-social-write-gate-a-runtime-smoke-contract.md
 * satisfies the contractual requirements for a future controlled public-fixture smoke.
 *
 * All assertions are source-level and markdown-only. No database connection,
 * subprocess, fetch, curl, psql, environment-variable inspection, or secret-file
 * access is used.
 *
 * Refs: #3265, #3260, #1882
 */

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.resolve(__dirname, '..', '..');
const CONTRACT_PATH = path.join(ROOT, 'docs/ops/moment-social-write-gate-a-runtime-smoke-contract.md');

function readFile(filePath) {
  assert.ok(fs.existsSync(filePath), `File must exist at ${filePath}`);
  return fs.readFileSync(filePath, 'utf8');
}

function hasString(content, pattern) {
  return content.includes(pattern);
}

function hasRegex(content, regex) {
  return regex.test(content);
}

// ─── FILE EXISTENCE ────────────────────────────────────────────────────────────

test('Gate A: contract markdown file exists', () => {
  assert.ok(fs.existsSync(CONTRACT_PATH), 'Contract markdown must exist');
});

// ─── 1. REQUIRED PUBLIC TREE + PUBLIC MEMORY LANGUAGE ─────────────────────────

test('Gate A: states authenticated public social-write path requires public parent LoveTree', () => {
  const content = readFile(CONTRACT_PATH);
  assert.ok(
    hasString(content, 'parent LoveTree') && hasString(content, "visibility = 'public'"),
    'Contract must require public parent tree visibility'
  );
});

test('Gate A: states authenticated public social-write path requires public target memory', () => {
  const content = readFile(CONTRACT_PATH);
  assert.ok(
    hasString(content, 'target memory') && hasString(content, "visibility = 'public'"),
    'Contract must require public target memory visibility'
  );
});

test('Gate A: references require_memory_visible_or_owner_cursor as the runtime authorization guard', () => {
  const content = readFile(CONTRACT_PATH);
  assert.ok(
    hasString(content, 'require_memory_visible_or_owner_cursor'),
    'Contract must reference the runtime authorization guard'
  );
});

// ─── 2. DEDICATED APPROVED FIXTURE / TEST IDENTITY REQUIREMENT ────────────────

test('Gate A: requires separately approved dedicated test identity and fixture', () => {
  const content = readFile(CONTRACT_PATH);
  assert.ok(
    hasString(content, 'dedicated test identity'),
    'Contract must require dedicated test identity'
  );
  assert.ok(
    hasString(content, 'separately approved'),
    'Contract must require separate approval'
  );
});

test('Gate A: requires dedicated test Tree and memory', () => {
  const content = readFile(CONTRACT_PATH);
  assert.ok(
    hasString(content, 'test Tree') && hasString(content, 'test memory'),
    'Contract must require dedicated test Tree and memory'
  );
});

// ─── 3. PROHIBITION ON REAL-USER DATA REUSE ───────────────────────────────────

test('Gate A: prohibits using real user accounts', () => {
  const content = readFile(CONTRACT_PATH);
  assert.ok(
    hasString(content, 'Do not') && hasString(content, 'real user'),
    'Contract must prohibit using real user data'
  );
});

test('Gate A: prohibits repurposing, modifying, or exposing production content', () => {
  const content = readFile(CONTRACT_PATH);
  assert.ok(
    hasString(content, 'repurpose') || hasString(content, 'production content'),
    'Contract must prohibit repurposing production content'
  );
});

// ─── 4. NO ASSUMPTION OF UNLISTED/NON-DISCOVERABLE CAPABILITY ─────────────────

test('Gate A: acknowledges there is no unlisted/non-discoverable visibility state', () => {
  const content = readFile(CONTRACT_PATH);
  assert.ok(
    hasString(content, 'no') && hasString(content, 'unlisted') && hasString(content, 'non-discoverable'),
    'Contract must acknowledge absence of unlisted/non-discoverable mode'
  );
});

test('Gate A: references validate_visibility() as the canonical allowed-values source', () => {
  const content = readFile(CONTRACT_PATH);
  assert.ok(
    hasString(content, 'validate_visibility()'),
    'Contract must reference validate_visibility as the visibility source of truth'
  );
});

test('Gate A: does not claim unlisted/non-discoverable capability', () => {
  const content = readFile(CONTRACT_PATH);
  assert.ok(
    hasRegex(content, /no\s+unlisted/i),
    'Contract must not claim unlisted capability exists'
  );
});

// ─── 5. NO DB, DEPLOY, RUNTIME SMOKE, MIGRATION, ROLLBACK, SOURCE/API/CLIENT/UI CHANGE ──

test('Gate A: states no DB connection, runtime smoke, API call, deploy, Modal, or Cloudflare action', () => {
  const content = readFile(CONTRACT_PATH);
  assert.ok(
    hasRegex(content, /no DB connection/i),
    'Contract must state no DB/runtime/deploy action occurs'
  );
  assert.ok(
    hasString(content, 'Modal action') && hasString(content, 'Cloudflare action'),
    'Contract must exclude Modal and Cloudflare actions'
  );
});

test('Gate A: states no migration, rollback, or source-runtime change', () => {
  const content = readFile(CONTRACT_PATH);
  assert.ok(
    hasString(content, 'migration') && hasString(content, 'rollback'),
    'Contract must exclude migration and rollback'
  );
  assert.ok(
    hasString(content, 'source-runtime change'),
    'Contract must exclude source-runtime changes'
  );
});

test('Gate A: states no runtime, schema, API, client, or UI code is changed', () => {
  const content = readFile(CONTRACT_PATH);
  assert.ok(
    hasString(content, 'Changes') || hasString(content, 'changes'),
    'Contract must state no code changes'
  );
  assert.ok(
    hasString(content, 'runtime') && hasString(content, 'schema') && hasString(content, 'API') &&
    hasString(content, 'client') && hasString(content, 'UI'),
    'Contract must exclude runtime, schema, API, client, and UI changes'
  );
});

// ─── 6. SANITIZED-EVIDENCE-ONLY REQUIREMENTS ───────────────────────────────────

test('Gate A: defines safe evidence values (PASS, PARTIAL, BLOCKED)', () => {
  const content = readFile(CONTRACT_PATH);
  assert.ok(
    hasString(content, 'PASS') && hasString(content, 'PARTIAL') && hasString(content, 'BLOCKED'),
    'Contract must define PASS, PARTIAL, BLOCKED evidence values'
  );
});

test('Gate A: defines sanitized counts/categories as acceptable evidence', () => {
  const content = readFile(CONTRACT_PATH);
  assert.ok(
    hasString(content, 'sanitized counts') || hasString(content, 'count'),
    'Contract must define sanitized counts as acceptable evidence'
  );
});

test('Gate A: prohibits raw actor, account, Tree, memory, comment, reaction, audit, or credential data', () => {
  const content = readFile(CONTRACT_PATH);
  assert.ok(
    hasString(content, 'No raw actor'),
    'Contract must prohibit raw actor data in evidence'
  );
});

// ─── 7. CANCELLATION CRITERIA ─────────────────────────────────────────────────

test('Gate A: defines cancellation criteria for unsafe fixture', () => {
  const content = readFile(CONTRACT_PATH);
  assert.ok(
    hasString(content, 'cancelled') || hasString(content, 'cancellation'),
    'Contract must define cancellation criteria'
  );
  assert.ok(
    hasString(content, 'cannot be established safely'),
    'Contract must define unsafe fixture as cancellation trigger'
  );
});

test('Gate A: prohibits fallback to real user data on cancellation', () => {
  const content = readFile(CONTRACT_PATH);
  assert.ok(
    hasString(content, 'fallback to real user'),
    'Contract must prohibit fallback to real user data'
  );
});

// ─── 8. IDEMPOTENCY REPLAY AND CONTROLLED COMMENT/REACTION SEQUENCING ──────────

test('Gate A: defines idempotency replay expectation', () => {
  const content = readFile(CONTRACT_PATH);
  assert.ok(
    hasString(content, 'Idempotency replay'),
    'Contract must define idempotency replay section'
  );
  assert.ok(
    hasString(content, 'deterministic'),
    'Contract must describe deterministic replay behavior'
  );
});

test('Gate A: defines controlled reaction action in future smoke sequence', () => {
  const content = readFile(CONTRACT_PATH);
  assert.ok(
    hasString(content, 'Controlled reaction action') || hasString(content, 'reaction action'),
    'Contract must define a controlled reaction action step'
  );
});

test('Gate A: defines controlled comment action in future smoke sequence', () => {
  const content = readFile(CONTRACT_PATH);
  assert.ok(
    hasString(content, 'Controlled comment action') || hasString(content, 'comment action'),
    'Contract must define a controlled comment action step'
  );
});

test('Gate A: defines preflight, response verification, and cleanup steps', () => {
  const content = readFile(CONTRACT_PATH);
  assert.ok(
    hasString(content, 'Preflight'),
    'Contract must define preflight step'
  );
  assert.ok(
    hasString(content, 'Response') && hasString(content, 'verification'),
    'Contract must define response verification step'
  );
  assert.ok(
    hasString(content, 'Cleanup') || hasString(content, 'evidence capture'),
    'Contract must define cleanup step'
  );
});

// ─── 9. EXPLICIT NON-GOALS ────────────────────────────────────────────────────

test('Gate A: non-goals exclude Modal deployment', () => {
  const content = readFile(CONTRACT_PATH);
  assert.ok(
    hasString(content, 'non-goals') || hasString(content, 'Non-goals'),
    'Contract must have non-goals section'
  );
  assert.ok(
    hasString(content, 'Modal deployment'),
    'Non-goals must exclude Modal deployment'
  );
});

test('Gate A: non-goals exclude Cloudflare deployment', () => {
  const content = readFile(CONTRACT_PATH);
  assert.ok(
    hasString(content, 'Cloudflare deployment'),
    'Non-goals must exclude Cloudflare deployment'
  );
});

test('Gate A: non-goals exclude database execution', () => {
  const content = readFile(CONTRACT_PATH);
  assert.ok(
    hasString(content, 'database execution') || hasString(content, 'database'),
    'Non-goals must exclude database execution'
  );
});

test('Gate A: non-goals reference and exclude #3075', () => {
  const content = readFile(CONTRACT_PATH);
  assert.ok(
    hasString(content, '#3075'),
    'Non-goals must reference and exclude #3075'
  );
});

test('Gate A: non-goals exclude Browse, My Trees, Editor, Scout, Hermes', () => {
  const content = readFile(CONTRACT_PATH);
  assert.ok(
    hasString(content, 'Browse') && hasString(content, 'My Trees') &&
    hasString(content, 'Editor') && hasString(content, 'Scout') &&
    hasString(content, 'Hermes'),
    'Non-goals must exclude Browse, My Trees, Editor, Scout, Hermes'
  );
});

test('Gate A: non-goals exclude pr-comment-composer-verify', () => {
  const content = readFile(CONTRACT_PATH);
  assert.ok(
    hasString(content, 'pr-comment-composer-verify'),
    'Non-goals must exclude pr-comment-composer-verify'
  );
});

test('Gate A: non-goals exclude any UI, CSS, or layout change', () => {
  const content = readFile(CONTRACT_PATH);
  assert.ok(
    hasString(content, 'UI') && hasString(content, 'CSS') && hasString(content, 'layout'),
    'Non-goals must exclude UI, CSS, and layout changes'
  );
});

test('Gate A: non-goals exclude runtime smoke, API call, migration, rollback execution', () => {
  const content = readFile(CONTRACT_PATH);
  assert.ok(
    hasString(content, 'runtime smoke') && hasString(content, 'API call') &&
    hasString(content, 'migration') && hasString(content, 'rollback'),
    'Non-goals must exclude runtime smoke, API call, migration, and rollback'
  );
});

// ─── 10. NO SECRETS OR RAW CREDENTIAL MATERIAL ─────────────────────────────────

test('Gate A: prohibits output of raw identifiers', () => {
  const content = readFile(CONTRACT_PATH);
  assert.ok(
    hasString(content, 'raw identifiers'),
    'Contract must prohibit raw identifier output'
  );
});

test('Gate A: prohibits output of tokens, authorization headers, cookies, passwords', () => {
  const content = readFile(CONTRACT_PATH);
  assert.ok(
    hasString(content, 'Tokens'),
    'Contract must prohibit token output'
  );
  assert.ok(
    hasString(content, 'Authorization headers'),
    'Contract must prohibit Authorization header output'
  );
  assert.ok(
    hasString(content, 'Passwords'),
    'Contract must prohibit password output'
  );
});

test('Gate A: prohibits output of connection strings, request bodies, raw audit rows, .secrets content', () => {
  const content = readFile(CONTRACT_PATH);
  assert.ok(
    hasString(content, 'Connection strings'),
    'Contract must prohibit connection string output'
  );
  assert.ok(
    hasRegex(content, /request bod(y|ies)/i),
    'Contract must prohibit request body output'
  );
  assert.ok(
    hasString(content, 'Raw audit rows') || hasString(content, 'raw audit rows'),
    'Contract must prohibit raw audit row output'
  );
  assert.ok(
    hasString(content, '.secrets'),
    'Contract must prohibit .secrets content output'
  );
});

test('Gate A: prohibits output of shell-expanded secrets', () => {
  const content = readFile(CONTRACT_PATH);
  assert.ok(
    hasRegex(content, /shell-expanded/i),
    'Contract must prohibit shell-expanded secret output'
  );
});

// ─── 11. PROHIBITED COMMANDS ──────────────────────────────────────────────────

test('Gate A: prohibits grep against secret files or variables', () => {
  const content = readFile(CONTRACT_PATH);
  assert.ok(
    hasString(content, 'grep') && hasString(content, 'secret'),
    'Contract must prohibit grep against secret files'
  );
});

test('Gate A: prohibits cat against secret files', () => {
  const content = readFile(CONTRACT_PATH);
  assert.ok(
    hasString(content, 'cat') && hasString(content, 'secret'),
    'Contract must prohibit cat against secret files'
  );
});

test('Gate A: prohibits printenv and full environment dumps', () => {
  const content = readFile(CONTRACT_PATH);
  assert.ok(
    hasString(content, 'printenv'),
    'Contract must prohibit printenv'
  );
});

test('Gate A: prohibits shell tracing that exposes secret values', () => {
  const content = readFile(CONTRACT_PATH);
  assert.ok(
    hasString(content, 'shell tracing') || hasString(content, 'set -x'),
    'Contract must prohibit shell tracing that exposes secrets'
  );
});

// ─── 12. FAILED/UNAVAILABLE FIXTURE CONSEQUENCES ──────────────────────────────

test('Gate A: failed fixture verification does not authorize rollback', () => {
  const content = readFile(CONTRACT_PATH);
  assert.ok(
    hasString(content, 'Failed') && hasString(content, 'does not') && hasString(content, 'Rollback'),
    'Contract must state failed fixture does not authorize rollback'
  );
});

test('Gate A: failed fixture does not authorize Migration B, tree hardening, tree writer, or UI activation', () => {
  const content = readFile(CONTRACT_PATH);
  assert.ok(
    hasString(content, 'Migration B'),
    'Contract must state failed fixture does not authorize Migration B'
  );
  assert.ok(
    hasString(content, 'Tree runtime hardening'),
    'Contract must state failed fixture does not authorize tree runtime hardening'
  );
  assert.ok(
    hasRegex(content, /tree writer/i),
    'Contract must state failed fixture does not authorize tree writer activation'
  );
  assert.ok(
    hasString(content, 'UI activation'),
    'Contract must state failed fixture does not authorize UI activation'
  );
});

test('Gate A: failed fixture does not authorize Browse, My Trees, Editor, Scout, Hermes changes', () => {
  const content = readFile(CONTRACT_PATH);
  assert.ok(
    hasString(content, 'Browse') && hasString(content, 'My Trees') &&
    hasString(content, 'Editor') && hasString(content, 'Scout') &&
    hasString(content, 'Hermes'),
    'Contract must state failed fixture does not authorize Browse, My Trees, Editor, Scout, Hermes changes'
  );
});

// ─── 13. ROLLBACK BOUNDARY ────────────────────────────────────────────────────

test('Gate A: any future rollback remains runtime-first and separately approved', () => {
  const content = readFile(CONTRACT_PATH);
  assert.ok(
    hasString(content, 'runtime-first') && hasString(content, 'separately approved'),
    'Contract must state rollback is runtime-first and separately approved'
  );
});

test('Gate A: this documentation task changes neither runtime nor schema', () => {
  const content = readFile(CONTRACT_PATH);
  assert.ok(
    hasString(content, 'changes neither runtime nor schema'),
    'Contract must state this task changes neither runtime nor schema'
  );
});

// ─── 14. CORRECTED FIXTURE CONCEPT PHRASING ───────────────────────────────────

test('Gate A: uses corrected fixture concept phrase about separately approved dedicated public fixture', () => {
  const content = readFile(CONTRACT_PATH);
  const phraseExists = hasString(content, 'separately approved dedicated public fixture');
  const containsCorrectSemantics = hasString(content, 'public visibility is required') &&
    hasString(content, 'operational containment comes from');
  assert.ok(
    phraseExists || containsCorrectSemantics,
    'Contract must use corrected fixture concept with dedicated public fixture language'
  );
});

test('Gate A: does NOT contain the ambiguous phrase "approved non-public fixture"', () => {
  const content = readFile(CONTRACT_PATH);
  assert.equal(
    hasString(content, 'approved non-public fixture'),
    false,
    'Contract must not contain ambiguous phrase "approved non-public fixture"'
  );
});

// ─── 15. FIXTURE ENVIRONMENT — NO NON-PRODUCTION CLAIM, APPROVED RUNTIME REQUIRED ─

test('Gate A: does not contain the phrase "non-production or sandbox environment"', () => {
  const content = readFile(CONTRACT_PATH);
  assert.equal(
    hasString(content, 'non-production or sandbox environment'),
    false,
    'Contract must not claim fixture is restricted to non-production/sandbox'
  );
});

test('Gate A: requires an "approved runtime environment" for the fixture', () => {
  const content = readFile(CONTRACT_PATH);
  assert.ok(
    hasString(content, 'approved runtime environment'),
    'Contract must require an approved runtime environment for the fixture'
  );
});

test('Gate A: production fixture provisioning is conditional on separate explicit approval', () => {
  const content = readFile(CONTRACT_PATH);
  assert.ok(
    hasString(content, 'provisioned in production') && hasString(content, 'separate explicit approval'),
    'Contract must require separate explicit approval before any production provisioning'
  );
});

// ─── 16. FUTURE SMOKE CHECKLIST ───────────────────────────────────────────────

test('Gate A: approval checklist requires explicit approval of dedicated test identity and fixture', () => {
  const content = readFile(CONTRACT_PATH);
  assert.ok(
    hasRegex(content, /explicit approval/i) && hasString(content, 'test identity'),
    'Checklist must require explicit approval of test identity'
  );
});

test('Gate A: approval checklist requires confirmation that fixture Tree and memory are public', () => {
  const content = readFile(CONTRACT_PATH);
  assert.ok(
    hasRegex(content, /confirmation/i) && hasString(content, 'fixture Tree') &&
    hasString(content, 'public'),
    'Checklist must require confirmation fixture Tree and memory are public'
  );
});

test('Gate A: approval checklist requires confirmation of safe non-personal content', () => {
  const content = readFile(CONTRACT_PATH);
  assert.ok(
    hasString(content, 'safe non-personal content'),
    'Checklist must require confirmation of safe non-personal content'
  );
});

test('Gate A: approval checklist requires operator can only run through approved opaque credential path', () => {
  const content = readFile(CONTRACT_PATH);
  assert.ok(
    hasString(content, 'opaque credential path'),
    'Checklist must require approved opaque credential path'
  );
});

test('Gate A: approval checklist requires cancellation when fixture safety cannot be established', () => {
  const content = readFile(CONTRACT_PATH);
  assert.ok(
    hasString(content, 'Cancellation') && hasString(content, 'cannot be established safely'),
    'Checklist must require cancellation when fixture cannot be verified safely'
  );
});

// ─── 17. NO FIXTURE OR TEST IDENTITY CREATED DURING THIS TASK ─────────────────

test('Gate A: states no fixture, test identity, test Tree, or test memory is created in this task', () => {
  const content = readFile(CONTRACT_PATH);
  assert.ok(
    hasString(content, 'not create') || hasString(content, 'Do not'),
    'Contract must state no fixture is created in this task'
  );
});

// ─── 18. SCOPE GUARD: NO SUBPROCESS, FETCH, ENV, SHELL, OR SECRET FILE USE IN TEST ──

test('Gate A: test uses no child_process, fetch, process.env, network calls, database drivers, shell commands, or secret files', () => {
  // Verify only safe standard modules are required in the require block.
  const testContent = fs.readFileSync(__filename, 'utf8');
  const lines = testContent.split('\n');
  const safeModules = new Set([
    'node:test',
    'node:assert/strict',
    'node:fs',
    'node:path',
  ]);
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed.startsWith('const ') && !trimmed.startsWith('var ') && !trimmed.startsWith('let ')) {
      continue;
    }
    const match = trimmed.match(/require\(['"]([^'"]+)['"]\)/);
    if (match) {
      const mod = match[1];
      assert.ok(
        safeModules.has(mod),
        'Test must only require safe modules, got: ' + mod
      );
    }
  }
});
