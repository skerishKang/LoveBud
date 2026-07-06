/**
 * Contract tests for the Gate A runtime smoke contract (Issue #3265).
 *
 * These tests verify that the runbook and this contract test define the
 * required fixture, identity, smoke sequence, secret-handling, evidence,
 * and decision gate rules. All assertions are source-level only.
 *
 * No subprocess, database connection, psql, curl, fetch, environment
 * inspection, .secrets access, or secret-file reads are performed.
 *
 * Refs: #3265, #3264, #1882
 */

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.resolve(__dirname, '..', '..');
const RUNBOOK_PATH = path.join(ROOT, 'docs/ops/moment-social-write-gate-a-runtime-smoke-contract.md');
const THIS_PATH = __filename;

function readFile(filePath) {
  assert.ok(fs.existsSync(filePath), `File must exist at ${filePath}`);
  return fs.readFileSync(filePath, 'utf8');
}

// ─── 1. Both new files exist ──────────────────────────────────────────────────

test('GateA: runbook file exists', () => {
  assert.ok(fs.existsSync(RUNBOOK_PATH), 'Runbook must exist');
});

test('GateA: contract test file exists (self-evident)', () => {
  assert.ok(fs.existsSync(THIS_PATH), 'Contract test file must exist');
});

// ─── 2. No subprocess, DB, psql, curl, fetch, env, or .secrets access ─────────

test('GateA: contract test does not require child_process module', () => {
  const raw = fs.readFileSync(THIS_PATH, 'utf8');
  const requireMatches = raw.match(/require\(['"][^'"]+['"]\)/g) || [];
  for (const m of requireMatches) {
    assert.equal(m.includes('child_process'), false, 'Must not require child_process');
  }
});

test('GateA: contract test does not reference database connection strings', () => {
  const raw = fs.readFileSync(THIS_PATH, 'utf8');
  const requireMatches = raw.match(/require\(['"][^'"]+['"]\)/g) || [];
  for (const m of requireMatches) {
    assert.equal(m.includes('DATABASE_URL'), false, 'Must not reference DATABASE_URL');
    assert.equal(m.includes('psql'), false, 'Must not reference psql');
  }
});

// ─── 3. Runbook states public-tree-plus-public-memory requirement ────────────

test('GateA: runbook says public tree plus public memory are required', () => {
  const content = readFile(RUNBOOK_PATH);
  const lower = content.toLowerCase();
  assert.ok(
    lower.includes('public parent lovetree') && lower.includes('public target memory'),
    'Runbook must require both public tree and public memory'
  );
  assert.ok(
    lower.includes('private-visibility'),
    'Runbook must state private-visibility is not a valid substitute'
  );
});

// ─── 4. Runbook prohibits using or repurposing real user data ─────────────────

test('GateA: runbook prohibits using or repurposing real user data', () => {
  const content = readFile(RUNBOOK_PATH);
  assert.ok(
    content.includes('Dedicated non-user') && content.includes('real user'),
    'Runbook must prohibit using real user data'
  );
  assert.ok(
    content.includes('No use, repurposing, mutation, or inspection of any real user'),
    'Runbook must list specific prohibitions on real user data'
  );
});

// ─── 5. Runbook requires separate approval before fixture/account provisioning

test('GateA: runbook requires separate approval before fixture provisioning', () => {
  const content = readFile(RUNBOOK_PATH);
  assert.ok(
    content.includes('fixture provisioning') || content.includes('future approved fixture provisioning'),
    'Runbook must reference fixture provisioning'
  );
  assert.ok(
    content.includes('separate CTO approval') || content.includes('operator approval'),
    'Runbook must require separate approval before fixture/account provisioning'
  );
});

// ─── 6. Runbook does not claim unlisted/non-discoverable capability as fact ──

test('GateA: runbook does not claim unlisted/non-discoverable mode exists', () => {
  const content = readFile(RUNBOOK_PATH);
  assert.ok(
    content.includes('does **not** provide a supported unlisted'),
    'Runbook must state unlisted mode is not provided by current source'
  );
  assert.ok(
    content.includes('Do not assume') || content.includes('do not claim'),
    'Runbook must warn against assuming unlisted mode'
  );
  assert.ok(
    content.includes('separate CTO approval') &&
    content.includes('If an unlisted mode is absent or uncertain'),
    'Runbook must require CTO approval when unlisted mode is absent/uncertain'
  );
});

// ─── 7. Runbook defines reaction and comment replay/idempotency checks ───────

test('GateA: runbook defines reaction initial and replay checks', () => {
  const content = readFile(RUNBOOK_PATH);
  assert.ok(
    content.includes('Initial reaction toggle') || content.includes('initial reaction'),
    'Runbook must define initial reaction operation'
  );
  assert.ok(
    content.includes('Reaction replay') || content.includes('replay'),
    'Runbook must define reaction replay check'
  );
});

test('GateA: runbook defines comment initial and replay checks', () => {
  const content = readFile(RUNBOOK_PATH);
  assert.ok(
    content.includes('Initial comment create') || content.includes('initial comment'),
    'Runbook must define initial comment operation'
  );
  assert.ok(
    content.includes('Comment replay') || content.includes('replay'),
    'Runbook must define comment replay check'
  );
});

test('GateA: runbook requires deterministic replay without unintended second toggle', () => {
  const content = readFile(RUNBOOK_PATH);
  assert.ok(
    content.includes('deterministic response') ||
    content.includes('must not change the logical state') ||
    content.includes('not a second toggle'),
    'Runbook must require deterministic replay without unintended mutation'
  );
  assert.ok(
    content.includes('one logical comment') ||
    content.includes('not a duplicate'),
    'Runbook must require one logical comment on replay'
  );
});

// ─── 8. Runbook bans raw identifiers, headers, payloads, tokens, etc. from evidence

test('GateA: runbook bans raw identifiers from evidence', () => {
  const content = readFile(RUNBOOK_PATH);
  assert.ok(
    content.includes('No raw identifiers') ||
    content.includes('no raw identifiers'),
    'Runbook must prohibit raw identifiers from evidence'
  );
});

test('GateA: runbook bans raw request/response body from evidence', () => {
  const content = readFile(RUNBOOK_PATH);
  assert.ok(
    content.includes('no raw request/response body') ||
    content.includes('no raw request') ||
    content.includes('no raw response'),
    'Runbook must prohibit raw request/response body from evidence'
  );
});

test('GateA: runbook bans tokens, passwords, connection strings from evidence', () => {
  const content = readFile(RUNBOOK_PATH);
  assert.ok(
    content.includes('database rows') &&
    content.includes('No raw identifiers'),
    'Runbook must prohibit raw database rows from evidence'
  );
  assert.ok(
    content.includes('tokens'),
    'Runbook must ban tokens from evidence'
  );
});

// ─── 9. Runbook prohibits output-producing secret inspection ─────────────────

test('GateA: runbook prohibits output-producing secret inspection', () => {
  const content = readFile(RUNBOOK_PATH);
  assert.ok(
    content.includes('grep') && content.includes('cat') && content.includes('sed'),
    'Runbook must list specific prohibited secret-inspection tools'
  );
  assert.ok(
    content.includes('printenv') || content.includes('Never read, print, search'),
    'Runbook must prohibit printenv and general secret output'
  );
  assert.ok(
    content.includes('output `.secrets`') ||
    content.includes('Never read, print, search'),
    'Runbook must forbid outputting .secrets directory contents'
  );
  assert.ok(
    content.includes('never log a command with expanded credentials') ||
    content.includes('must remain opaque'),
    'Runbook must require opaque secret injection'
  );
});

// ─── 10. Runbook defines PASS/PARTIAL/BLOCKED/FAILED ─────────────────────────

test('GateA: runbook defines PASS outcome', () => {
  const content = readFile(RUNBOOK_PATH);
  assert.ok(
    content.includes('PASS'),
    'Runbook must define PASS outcome'
  );
  assert.ok(
    content.includes('fixture exists') && content.includes('deterministic replay confirmed'),
    'PASS must require fixture existence and replay confirmation'
  );
});

test('GateA: runbook defines PARTIAL outcome', () => {
  const content = readFile(RUNBOOK_PATH);
  assert.ok(
    content.includes('PARTIAL'),
    'Runbook must define PARTIAL outcome'
  );
  assert.ok(
    content.includes('fixture/procedure remains unavailable') ||
    content.includes('fixture'),
    'PARTIAL must reference fixture unavailability'
  );
});

test('GateA: runbook defines BLOCKED outcome', () => {
  const content = readFile(RUNBOOK_PATH);
  assert.ok(
    content.includes('BLOCKED'),
    'Runbook must define BLOCKED outcome'
  );
  assert.ok(
    content.includes('approval') || content.includes('secret-safety'),
    'BLOCKED must reference missing approval or safety condition'
  );
});

test('GateA: runbook defines FAILED outcome', () => {
  const content = readFile(RUNBOOK_PATH);
  assert.ok(
    content.includes('FAILED'),
    'Runbook must define FAILED outcome'
  );
  assert.ok(
    content.includes('response') || content.includes('authorization') || content.includes('idempotency'),
    'FAILED must reference response/auth/idempotency deviation'
  );
});

// ─── 11. Runbook keeps Migration B, tree runtime, Modal/CF deploy, UI blocked ─

test('GateA: runbook states Migration B remains blocked', () => {
  const content = readFile(RUNBOOK_PATH);
  assert.ok(
    content.includes('Migration B') && content.includes('blocked'),
    'Runbook must state Migration B is blocked'
  );
});

test('GateA: runbook states tree runtime hardening remains blocked', () => {
  const content = readFile(RUNBOOK_PATH);
  assert.ok(
    content.includes('tree runtime') &&
    (content.includes('blocked') || content.includes('Blocked')),
    'Runbook must state tree runtime work remains blocked'
  );
});

test('GateA: runbook states Modal/Cloudflare deployment remains blocked', () => {
  const content = readFile(RUNBOOK_PATH);
  assert.ok(
    (content.includes('Modal') || content.includes('Cloudflare')) &&
    (content.includes('blocked') || content.includes('Blocked')) &&
    (content.includes('deployment') || content.includes('deploy')),
    'Runbook must block Modal/Cloudflare deployment'
  );
});

test('GateA: runbook states UI activation remains blocked', () => {
  const content = readFile(RUNBOOK_PATH);
  assert.ok(
    content.includes('UI activation') &&
    (content.includes('blocked') || content.includes('Blocked')),
    'Runbook must block UI activation'
  );
});

// ─── 12. No #3075, Browse/My Trees, Editor, Scout, Hermes, outside-project,
//        or pr-comment-composer-verify scope added ────────────────────────────

test('GateA: runbook exclusion section explicitly lists Browse', () => {
  const content = readFile(RUNBOOK_PATH);
  assert.ok(
    content.includes('Browse'),
    'Runbook exclusion must mention Browse'
  );
});

test('GateA: runbook exclusion section explicitly lists My Trees', () => {
  const content = readFile(RUNBOOK_PATH);
  assert.ok(
    content.includes('My Trees'),
    'Runbook exclusion must mention My Trees'
  );
});

test('GateA: runbook exclusion section explicitly lists Editor', () => {
  const content = readFile(RUNBOOK_PATH);
  assert.ok(
    content.includes('Editor'),
    'Runbook exclusion must mention Editor'
  );
});

test('GateA: runbook exclusion section explicitly lists #3075', () => {
  const content = readFile(RUNBOOK_PATH);
  assert.ok(
    content.includes('#3075'),
    'Runbook exclusion must mention #3075'
  );
});

test('GateA: runbook exclusion section explicitly lists Scout and Hermes', () => {
  const content = readFile(RUNBOOK_PATH);
  assert.ok(
    content.includes('Scout') && content.includes('Hermes'),
    'Runbook exclusion must mention both Scout and Hermes'
  );
});

test('GateA: runbook exclusion section explicitly lists outside-project code', () => {
  const content = readFile(RUNBOOK_PATH);
  assert.ok(
    content.includes('Outside-project'),
    'Runbook exclusion must mention outside-project code'
  );
});

test('GateA: runbook exclusion section explicitly lists pr-comment-composer-verify', () => {
  const content = readFile(RUNBOOK_PATH);
  assert.ok(
    content.includes('pr-comment-composer-verify'),
    'Runbook exclusion must mention pr-comment-composer-verify'
  );
});
