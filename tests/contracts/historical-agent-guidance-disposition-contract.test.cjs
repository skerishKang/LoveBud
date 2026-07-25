'use strict';

/**
 * Contract: historical agent-guidance disposition.
 *
 * Provenance:
 * - historical restriction inventory and first disposition: #3442 / #3445
 * - verification-target follow-up: #3448
 * - current separated roles: #3662
 * - current UI Rapid Iteration Lane: #3664
 *
 * The historical inventory remains a preserved audit snapshot. Current canonical
 * indexes may be rewritten by later owner-approved policy and are not required
 * to preserve historical line numbers or duplicated policy bodies.
 *
 * SOURCE_STATIC only.
 */

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.resolve(__dirname, '..', '..');

const PATHS = Object.freeze({
  governance: 'docs/ops/MVP_AGENT_GOVERNANCE.md',
  inventory: 'docs/audits/lovebud-historical-agent-restriction-inventory.json',
  roles: 'docs/project/WEB_CTO_WEB_DEVELOPER_LOCAL_VALIDATION.md',
  uiLane: 'docs/project/UI_RAPID_ITERATION_LANE.md',
  opsIndex: 'docs/ops/ops_index.md',
  docIndex: 'docs/doc_index.md',
  self: 'tests/contracts/historical-agent-guidance-disposition-contract.test.cjs',
});

const DISPOSITION_MARKERS = Object.freeze([
  'NON_NORMATIVE_OUTSIDE_NAMED_CONTEXT',
  'SUPERSEDED_BY_MVP_AGENT_GOVERNANCE',
]);

const REQUIRED_FIELDS = Object.freeze([
  'path',
  'heading',
  'line_start',
  'line_end',
  'summary',
  'current_reachability',
  'classification',
  'blocks',
  'owner_approval_reference',
  'recommended_disposition',
  'tranche',
  'reason',
]);

const CLASSIFICATION_ALLOW = Object.freeze([
  'USER_APPROVED_STANDING_RULE',
  'HARD_SECURITY_OR_DATA_SAFETY',
  'CONTEXT_SPECIFIC_GUARDRAIL',
  'RECOMMENDATION_ONLY',
  'OVER_RESTRICTIVE_MVP_BLOCKER',
  'STALE_OR_SUPERSEDED',
  'DUPLICATE_OR_CONFLICTING',
]);

const REACHABILITY_ALLOW = Object.freeze([
  'READ_FIRST',
  'INDEX_LINKED',
  'REFERENCED',
  'HISTORICAL_ONLY',
  'UNROUTED',
]);

const HISTORICAL_NOW_DOCS = Object.freeze([
  {
    rel: 'docs/ops/EDITOR_DETAIL_UI_BROWSER_SMOKE_CHECKLIST.md',
    marker: 'NON_NORMATIVE_OUTSIDE_NAMED_CONTEXT',
    preserved: 'BLOCKED_SLOT_DECISION_MISSING',
  },
  {
    rel: 'docs/ops/ACTIVE_WORK_BOARD_POLICY.md',
    marker: 'NON_NORMATIVE_OUTSIDE_NAMED_CONTEXT',
    preserved: 'git status --short',
  },
  {
    rel: 'docs/ops/GITHUB_AUTH_TOKEN_USAGE.md',
    marker: 'NON_NORMATIVE_OUTSIDE_NAMED_CONTEXT',
    preserved: 'Merge is forbidden unless the CTO explicitly approves',
  },
  {
    rel: 'docs/ops/CLOUDFLARE_PREVIEW_PROVENANCE_RUNBOOK.md',
    marker: 'NON_NORMATIVE_OUTSIDE_NAMED_CONTEXT',
    preserved: 'production URL used as pre-merge PR proof',
  },
]);

const REWRITTEN_CURRENT_INDEXES = Object.freeze([
  PATHS.opsIndex,
  PATHS.docIndex,
]);

const EXPECTED_NOW_PATHS = Object.freeze([
  ...HISTORICAL_NOW_DOCS.map((entry) => entry.rel),
  ...REWRITTEN_CURRENT_INDEXES,
]);

const FOLLOWUP_DOCS = Object.freeze([
  'docs/ops/TEST_PREVIEW_SLOTS.md',
  'docs/ops/VERIFICATION_TARGET_ALLOWLIST.md',
]);

function read(rel) {
  const abs = path.join(ROOT, rel);
  assert.ok(fs.existsSync(abs), `Expected file to exist: ${rel}`);
  return fs.readFileSync(abs, 'utf8');
}

function inventory() {
  return JSON.parse(read(PATHS.inventory));
}

function assertSourceStatic() {
  const self = read(PATHS.self);
  assert.doesNotMatch(
    self,
    /require\(['"](?:child_process|http|https|playwright|puppeteer)['"]\)/i,
    'contract must not import runtime/browser/network modules'
  );
}

test('historical inventory parses with the approved snapshot shape', () => {
  const data = inventory();
  assert.ok(Array.isArray(data.inventory), 'inventory must contain an inventory array');
  assert.equal(data.inventory.length, 19, 'historical snapshot must retain 19 entries');

  const now = data.inventory.filter((item) => item.tranche === 'NOW');
  const defer = data.inventory.filter((item) => item.tranche === 'DEFER');
  assert.equal(now.length, 6, 'historical snapshot must retain 6 NOW entries');
  assert.equal(defer.length, 13, 'historical snapshot must retain 13 DEFER entries');

  for (const item of data.inventory) {
    for (const field of REQUIRED_FIELDS) {
      assert.ok(field in item, `${item.path || '?'} missing ${field}`);
    }
    assert.equal(typeof item.line_start, 'number', `${item.path}.line_start must be numeric`);
    assert.equal(typeof item.line_end, 'number', `${item.path}.line_end must be numeric`);
    assert.ok(item.line_start >= 1, `${item.path}.line_start must be positive`);
    assert.ok(item.line_end >= item.line_start, `${item.path}.line_end must be >= line_start`);
    assert.ok(Array.isArray(item.blocks), `${item.path}.blocks must be an array`);
    assert.ok(CLASSIFICATION_ALLOW.includes(item.classification), `${item.path} classification is invalid`);
    assert.ok(REACHABILITY_ALLOW.includes(item.current_reachability), `${item.path} reachability is invalid`);
    assert.ok(['NOW', 'DEFER'].includes(item.tranche), `${item.path} tranche is invalid`);
    assert.doesNotMatch(
      item.owner_approval_reference || '',
      /named in doc/i,
      `${item.path} must not use self-referential approval provenance`
    );
  }
});

test('historical NOW path set remains the original six audited documents', () => {
  const nowPaths = new Set(
    inventory().inventory
      .filter((item) => item.tranche === 'NOW')
      .map((item) => item.path)
  );
  assert.equal(nowPaths.size, EXPECTED_NOW_PATHS.length);
  for (const rel of EXPECTED_NOW_PATHS) {
    assert.ok(nowPaths.has(rel), `NOW snapshot must contain ${rel}`);
  }
});

test('historical substantive documents preserve body evidence and disposition markers', () => {
  for (const entry of HISTORICAL_NOW_DOCS) {
    const src = read(entry.rel);
    assert.ok(src.includes('MVP_AGENT_GOVERNANCE.md'), `${entry.rel} must link governance`);
    assert.ok(src.includes(entry.marker), `${entry.rel} must contain ${entry.marker}`);
    assert.ok(src.includes(entry.preserved), `${entry.rel} must retain historical evidence text`);
  }
});

test('current indexes may be rewritten but must route to current authority', () => {
  for (const rel of REWRITTEN_CURRENT_INDEXES) {
    const src = read(rel);
    assert.ok(src.includes('MVP_AGENT_GOVERNANCE.md'), `${rel} must link governance`);
    assert.ok(src.includes('WEB_CTO_WEB_DEVELOPER_LOCAL_VALIDATION.md'), `${rel} must link role model`);
    assert.ok(src.includes('UI_RAPID_ITERATION_LANE.md'), `${rel} must link UI lane`);
    assert.match(
      src,
      /historical|supersed|do not override|cannot override/i,
      `${rel} must explain historical guidance cannot override current authority`
    );
  }
});

test('historical line ranges remain valid except owner-approved rewritten indexes', () => {
  const rewritten = new Set(REWRITTEN_CURRENT_INDEXES);
  for (const item of inventory().inventory) {
    const abs = path.join(ROOT, item.path);
    assert.ok(fs.existsSync(abs), `inventory path must exist: ${item.path}`);
    if (rewritten.has(item.path)) {
      // The inventory records the historical line range. #3662/#3664 authorize
      // concise current index rewrites, so current line count is intentionally
      // not required to preserve that old range.
      continue;
    }
    const total = fs.readFileSync(abs, 'utf8').split('\n').length;
    assert.ok(item.line_end <= total, `${item.path} historical range exceeds current file`);
  }
});

test('current governance retains secret, destructive-production, and #1882 protections', () => {
  const src = read(PATHS.governance);
  assert.match(src, /secret|credential|private payload/i);
  assert.match(src, /Destructive Production data deletion.*requires owner approval/is);
  assert.match(src, /Never close #1882/i);
  assert.match(src, /Refs #1882/);
});

test('current governance records the later owner-approved role and UI policies', () => {
  const src = read(PATHS.governance);
  assert.ok(src.includes('#3662'));
  assert.ok(src.includes('#3664'));
  assert.ok(src.includes(PATHS.roles));
  assert.ok(src.includes(PATHS.uiLane));
  assert.match(src, /Local Validation only when required/i);
  assert.match(src, /U0\/U1 skip Local Validation by default/i);
});

test('Issue #3448 follow-up documents remain evidence-quality guidance', () => {
  for (const rel of FOLLOWUP_DOCS) {
    const src = read(rel);
    assert.ok(src.includes('MVP_AGENT_GOVERNANCE.md'), `${rel} must link governance`);
    assert.match(
      src,
      /does not (make|block)[^.]{0,60}(whole task|whole project|unrelated work)|not a project-wide blocker|does not by itself (make|block)[^.]{0,40}(whole project|unrelated work)/i,
      `${rel} must not make slot absence a project-wide blocker`
    );
    assert.doesNotMatch(
      src,
      /production (URL|site)[^.]{0,80}(must not (be )?used|prohibited|forbidden|금지)/i,
      `${rel} must not blanket-ban Production as an environment`
    );
    assert.match(src, /secret|token|cookie|private payload/i);
  }
});

test('Issue #3448 provenance uncertainty lowers claim status', () => {
  for (const rel of FOLLOWUP_DOCS) {
    const src = read(rel);
    assert.match(
      src,
      /NOT_VERIFIED|INVALID_FOR_TARGET_CLAIM|PARTIAL|FIXED_SLOT_NOT_ASSIGNED|NOT_VERIFIED_ON_FIXED_SLOT/i,
      `${rel} must lower evidence status when provenance is uncertain`
    );
  }
});

test('Netlify/lovebudold remains invalid as current Cloudflare runtime proof', () => {
  const src = read('docs/ops/VERIFICATION_TARGET_ALLOWLIST.md');
  assert.match(src, /Netlify/);
  assert.match(src, /lovebudold/);
  assert.match(src, /Cloudflare \+ Modal active runtime/i);
  assert.match(src, /must not be presented as current-runtime proof/i);
});

test('Issue #3448 inventory entries retain applied follow-up metadata', () => {
  const targets = inventory().inventory.filter(
    (item) => FOLLOWUP_DOCS.includes(item.path)
  );
  assert.equal(targets.length, 2);
  for (const item of targets) {
    assert.equal(item.followup_issue, 3448);
    assert.equal(item.followup_status, 'APPLIED');
    assert.equal(item.followup_disposition, 'PRESERVE_AS_EVIDENCE_QUALITY_GUIDANCE');
    assert.equal(item.tranche, 'DEFER');
  }
});

test('current policy documents do not use forbidden #1882 closing keywords', () => {
  const forbidden = /\b(?:Closes|Fixes|Resolves)\s+#1882\b/i;
  for (const rel of [PATHS.governance, PATHS.roles, PATHS.uiLane, ...REWRITTEN_CURRENT_INDEXES]) {
    assert.doesNotMatch(read(rel), forbidden, `${rel} must not close #1882`);
  }
});

test('contract remains source-static', () => {
  assertSourceStatic();
});
