'use strict';

/**
 * Focused source-static contract guarding the database snapshot, retention, and
 * restore-drill policy (Issue #3460, merged by PR #3776) against silent weakening.
 *
 * It reads the canonical policy from a fixed repository-relative path and asserts
 * the semantic boundaries section by section: classification vocabulary, RPO/RTO
 * bounds, the fail-closed recovery gate, isolated-restore-first ordering, restore
 * drill cadence, the privacy allowlist/denylist, recovery-type separation,
 * least-privilege roles, and the protected issue references.
 *
 * This is a source read only. It does not execute SQL, open a database, use the
 * network or a browser, run Docker/PostgreSQL, touch Production or a provider, or
 * read secrets. It does not modify the policy document.
 *
 * Refs #3777
 * Refs #3460 — Keep OPEN.
 * Refs #3435 — Keep OPEN.
 * Refs #3437 — Keep OPEN.
 * Refs #3458 — Keep OPEN.
 * Refs #1882 — Keep OPEN.
 */

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const REPO_ROOT = path.resolve(__dirname, '..', '..');
const POLICY_PATH = path.join(
  REPO_ROOT,
  'docs',
  'ops',
  'DATABASE_SNAPSHOT_RETENTION_RESTORE_DRILL_POLICY.md'
);
const CLASSIFICATION_PATH = path.join(REPO_ROOT, 'tests', 'test-layer-classification.json');
const CONTRACT_REPO_PATH =
  'tests/contracts/database-snapshot-retention-restore-drill-policy-contract.test.cjs';

const policy = fs.readFileSync(POLICY_PATH, 'utf8');

const CLASSIFICATION_LABELS = [
  'REPOSITORY_CONFIRMED',
  'OFFICIAL_PROVIDER_CAPABILITY',
  'PROJECT_CONFIGURATION_UNVERIFIED',
  'PROPOSED_FUTURE_CONTRACT',
  'NOT_AUTHORIZED',
];

const GATE_STATES = [
  'RECOVERY_POINT_VALID',
  'RECOVERY_POINT_STALE',
  'RECOVERY_POINT_MISSING',
  'RECOVERY_POINT_STATUS_UNKNOWN',
  'RESTORE_DRILL_OVERDUE',
  'PROVIDER_CAPABILITY_UNVERIFIED',
  'BLOCKED_BY_RECOVERY_GATE',
];

const BLOCKING_GATE_STATES = [
  'RECOVERY_POINT_STALE',
  'RECOVERY_POINT_MISSING',
  'RECOVERY_POINT_STATUS_UNKNOWN',
  'RESTORE_DRILL_OVERDUE',
  'PROVIDER_CAPABILITY_UNVERIFIED',
  'BLOCKED_BY_RECOVERY_GATE',
];

const PROTECTED_REFS = ['#3435', '#3437', '#3458', '#1882'];

// Split the document into "## " sections. "### " subsections remain inside their
// parent section so assertions can be bounded by topic without pinning line numbers.
function buildSections(text) {
  const map = new Map();
  let current = null;
  let buf = [];
  for (const line of text.split('\n')) {
    const m = /^##\s+(.+?)\s*$/.exec(line);
    if (m) {
      if (current !== null) map.set(current, buf.join('\n'));
      current = m[1].toLowerCase();
      buf = [line];
    } else if (current !== null) {
      buf.push(line);
    }
  }
  if (current !== null) map.set(current, buf.join('\n'));
  return map;
}

const sections = buildSections(policy);

function getSection(keyword) {
  const key = keyword.toLowerCase();
  for (const [title, body] of sections) {
    if (title.includes(key)) return body;
  }
  return null;
}

function findLine(text, re) {
  for (const line of text.split('\n')) {
    if (re.test(line)) return line;
  }
  return null;
}

function tableRow(sectionBody, label) {
  return findLine(sectionBody, new RegExp('^\\s*\\|.*`' + label + '`'));
}

// ---------------------------------------------------------------------------
// A. Policy classification
// ---------------------------------------------------------------------------

test('A: policy status is PROPOSED_FUTURE_CONTRACT', () => {
  assert.match(policy, /status[^.\n]*`?proposed_future_contract`?/i);
});

test('A: classification legend defines every required label', () => {
  const legend = getSection('classification legend');
  assert.ok(legend, 'classification legend section missing');
  for (const label of CLASSIFICATION_LABELS) {
    assert.ok(tableRow(legend, label), `legend missing label ${label}`);
  }
});

test('A: provider capability is not asserted as verified project configuration', () => {
  const legend = getSection('classification legend');
  assert.ok(legend, 'classification legend section missing');
  const offCap = tableRow(legend, 'OFFICIAL_PROVIDER_CAPABILITY');
  const projCfg = tableRow(legend, 'PROJECT_CONFIGURATION_UNVERIFIED');
  assert.ok(offCap, 'OFFICIAL_PROVIDER_CAPABILITY legend row missing');
  assert.ok(projCfg, 'PROJECT_CONFIGURATION_UNVERIFIED legend row missing');
  assert.notEqual(offCap, projCfg, 'the two classifications must stay distinct');
  // A documented provider capability is not a claim that it is enabled here.
  assert.match(offCap, /not a claim that it is enabled for this project/i);
  assert.doesNotMatch(offCap, /fail closed/i);
  // Live project configuration is unknown and fails closed.
  assert.match(projCfg, /cannot be confirmed without account access/i);
  assert.match(projCfg, /fail closed/i);
});

test('A: provider plan/settings are not asserted as verified', () => {
  const unknowns = getSection('provider capability reference and unknowns');
  assert.ok(unknowns, 'provider capability/unknowns section missing');
  assert.match(unknowns, /project_configuration_unverified/i);
  assert.match(unknowns, /until these are verified[\s\S]{0,160}?fails closed/i);
});

// ---------------------------------------------------------------------------
// B. RPO
// ---------------------------------------------------------------------------

const rpoRto = getSection('explicit rpo and rto');
assert.ok(rpoRto, 'RPO/RTO section missing');
const rtoSplit = rpoRto.search(/###\s+RTO/i);
const rpoPart = rtoSplit >= 0 ? rpoRto.slice(0, rtoSplit) : rpoRto;
const rtoPart = rtoSplit >= 0 ? rpoRto.slice(rtoSplit) : '';

test('B: general user data RPO is bounded at no more than 24 hours', () => {
  const row = findLine(rpoPart, /general user data/i);
  assert.ok(row, 'general user data RPO row missing');
  assert.match(row, /(?:≤|<=)\s*24\s*hours/i);
  assert.doesNotMatch(row, /(?:≤|<=)\s*(?:48|72)\s*hours/i);
});

test('B: pre-change Tier 3/destructive recovery point is change-bound and age-limited to 1 hour', () => {
  const row =
    findLine(rpoPart, /immediately before an approved/i) ||
    findLine(rpoPart, /tier 3 or destructive/i);
  assert.ok(row, 'pre-change RPO row missing');
  assert.match(row, /immediately before the change/i);
  assert.match(row, /tier 3/i);
  assert.match(row, /destructive/i);
  assert.match(row, /change-bound|bound to the change/i);
  assert.match(row, /age\s*(?:≤|<=)\s*1\s*hour/i);
  assert.doesNotMatch(row, /age\s*(?:≤|<=)\s*(?:[2-9]|\d{2,})\s*hours?/i);
});

test('B: missing/stale/unverified recovery points fail closed in the RPO table', () => {
  assert.match(rpoPart, /recovery_point_stale/i);
  assert.match(rpoPart, /recovery_point_missing/i);
  assert.match(rpoPart, /provider_capability_unverified/i);
  assert.match(rpoPart, /recovery_point_status_unknown/i);
});

// ---------------------------------------------------------------------------
// C. RTO
// ---------------------------------------------------------------------------

test('C: isolated-copy restore + verification RTO is no more than 4 hours', () => {
  const row = findLine(rtoPart, /restore to isolated copy/i);
  assert.ok(row, 'isolated-copy RTO row missing');
  assert.match(row, /(?:≤|<=)\s*4\s*hours/i);
  assert.doesNotMatch(row, /(?:≤|<=)\s*(?:[5-9]|\d{2,})\s*hours/i);
});

test('C: Production in-place restore RTO is no more than 8 hours and is a separately approved last resort', () => {
  const row = findLine(rtoPart, /production in-place restore/i);
  assert.ok(row, 'Production in-place RTO row missing');
  assert.match(row, /(?:≤|<=)\s*8\s*hours/i);
  assert.doesNotMatch(row, /(?:≤|<=)\s*(?:9|\d{2,})\s*hours/i);
  assert.match(row, /last resort/i);
  assert.match(row, /separate owner approval/i);
  assert.match(row, /never the first step/i);
});

test('C: Production restore requires separate explicit approval and is never automatic', () => {
  assert.match(policy, /requires separate\s+explicit owner approval/i);
  assert.match(policy, /no automatic production restore/i);
  assert.match(policy, /no automatic branch reset/i);
  assert.doesNotMatch(policy, /automatic production restore is (?:allowed|authorized|permitted)/i);
});

// ---------------------------------------------------------------------------
// D. Restore drill cadence
// ---------------------------------------------------------------------------

test('D: drill cadence is quarterly minimum and additionally before a Tier 3 DB release', () => {
  const drill = getSection('restore drill');
  assert.ok(drill, 'restore drill section missing');
  assert.match(drill, /quarterly at minimum/i);
  assert.match(drill, /additionally before any\s+release[\s\S]{0,80}?tier 3 database change/i);
});

test('D: drills use synthetic/non-sensitive data only and never mutate original Production', () => {
  const drill = getSection('restore drill');
  assert.ok(drill, 'restore drill section missing');
  assert.match(drill, /synthetic\/non-sensitive/i);
  assert.match(drill, /never real user data/i);
  assert.match(drill, /zero mutation[\s\S]{0,60}?original production/i);
});

test('D: an overdue drill blocks the next Tier 3 DB change', () => {
  const drill = getSection('restore drill');
  assert.ok(drill, 'restore drill section missing');
  assert.match(drill, /blocks the next\s+tier 3 db change/i);
  assert.match(drill, /restore_drill_overdue/i);
});

// ---------------------------------------------------------------------------
// E. Exact recovery gate vocabulary and fail-closed behavior
// ---------------------------------------------------------------------------

test('E: the fixed gate vocabulary is complete', () => {
  const gate = getSection('pre-change recovery gate');
  assert.ok(gate, 'pre-change recovery gate section missing');
  for (const state of GATE_STATES) {
    assert.ok(gate.includes(state), `gate section missing state ${state}`);
    assert.ok(tableRow(gate, state), `gate states table missing row for ${state}`);
  }
});

test('E: only RECOVERY_POINT_VALID authorizes the DB change to proceed', () => {
  const gate = getSection('pre-change recovery gate');
  assert.ok(gate, 'pre-change recovery gate section missing');
  const validRow = tableRow(gate, 'RECOVERY_POINT_VALID');
  assert.ok(validRow, 'RECOVERY_POINT_VALID row missing');
  assert.match(validRow, /proceed with the approved db change/i);
});

test('E: blocking gate states fail closed and do not authorize proceeding', () => {
  const gate = getSection('pre-change recovery gate');
  assert.ok(gate, 'pre-change recovery gate section missing');
  for (const state of BLOCKING_GATE_STATES) {
    const row = tableRow(gate, state);
    assert.ok(row, `gate states table missing row for ${state}`);
    assert.doesNotMatch(row, /proceed with the approved db change/i, `${state} must not authorize proceeding`);
    assert.match(row, /abort|block|no db change|treat as missing|fail closed/i, `${state} must fail closed`);
  }
});

test('E: the gate aborts (fails closed) when any requirement is unmet', () => {
  const gate = getSection('pre-change recovery gate');
  assert.ok(gate, 'pre-change recovery gate section missing');
  assert.match(gate, /the db change is \*\*aborted\*\* \(fail closed\)/i);
  assert.match(gate, /blocked_by_recovery_gate/i);
});

// ---------------------------------------------------------------------------
// F. Restore order (position-based, not keyword-only)
// ---------------------------------------------------------------------------

test('F: restore order is isolated copy -> verify -> selective extraction -> Production last resort -> approval -> preserve', () => {
  const proc = getSection('restore-first safety');
  assert.ok(proc, 'restore-first safety procedure section missing');
  const lower = proc.toLowerCase();
  const anchors = [
    'restore to an isolated',
    'verify schema and relational invariants',
    'review selective extraction',
    'production in-place restore as a last resort',
    'obtain separate approval before any production',
    'abort and preserve the original production',
  ];
  const positions = anchors.map((anchor) => ({ anchor, index: lower.indexOf(anchor) }));
  for (const { anchor, index } of positions) {
    assert.ok(index >= 0, `restore procedure missing step anchor: ${anchor}`);
  }
  for (let i = 1; i < positions.length; i += 1) {
    assert.ok(
      positions[i - 1].index < positions[i].index,
      `restore order violated: "${positions[i - 1].anchor}" must precede "${positions[i].anchor}"`
    );
  }
});

test('F: failed verification preserves the original Production state', () => {
  const abort = getSection('abort conditions');
  assert.ok(abort, 'abort conditions section missing');
  assert.match(abort, /preserve original production/i);
  assert.match(abort, /fail closed/i);
});

// ---------------------------------------------------------------------------
// G. Privacy and evidence boundary
// ---------------------------------------------------------------------------

test('G: sanitized evidence allowlist is explicit', () => {
  const privacy = getSection('evidence and privacy');
  assert.ok(privacy, 'evidence and privacy section missing');
  const forbiddenAt = privacy.search(/forbidden/i);
  const allowedPart = forbiddenAt >= 0 ? privacy.slice(0, forbiddenAt) : privacy;
  const allowed = [
    /policy version/i,
    /environment class/i,
    /recovery-point state/i,
    /age bucket/i,
    /drill result/i,
    /verification timestamp bucket/i,
    /sanitized failure code/i,
  ];
  for (const re of allowed) {
    assert.match(allowedPart, re);
  }
});

test('G: private-data denylist is explicit', () => {
  const privacy = getSection('evidence and privacy');
  assert.ok(privacy, 'evidence and privacy section missing');
  const forbiddenAt = privacy.search(/forbidden/i);
  assert.ok(forbiddenAt >= 0, 'forbidden subsection missing');
  const forbiddenPart = privacy.slice(forbiddenAt);
  const forbidden = [
    /database url/i,
    /credentials/i,
    /raw row data/i,
    /identifiers/i,
    /sql result payload/i,
    /private logs/i,
    /provider account or project identifiers/i,
  ];
  for (const re of forbidden) {
    assert.match(forbiddenPart, re);
  }
});

// ---------------------------------------------------------------------------
// H. Recovery type separation
// ---------------------------------------------------------------------------

test('H: recovery types are distinct operations', () => {
  const sep = getSection('recovery type separation');
  assert.ok(sep, 'recovery type separation section missing');
  const types = [
    /code rollback \/ forward fix/i,
    /database restore/i,
    /selective row repair/i,
    /schema reconciliation/i,
    /provider configuration correction/i,
  ];
  for (const re of types) {
    assert.match(sep, re);
  }
  assert.match(sep, /\*\*not\*\*\s+interchangeable|not interchangeable/i);
  assert.match(sep, /a database restore is not a schema fix/i);
});

// ---------------------------------------------------------------------------
// I. Least privilege roles
// ---------------------------------------------------------------------------

test('I: least-privilege role separation is explicit', () => {
  const roles = getSection('roles and least privilege');
  assert.ok(roles, 'roles and least privilege section missing');
  const roleNames = [
    /read-only recovery-state observer/i,
    /recovery-point creator/i,
    /isolated restore operator/i,
    /production restore approver/i,
    /production restore executor/i,
    /post-restore verifier/i,
  ];
  for (const re of roleNames) {
    assert.match(roles, re);
  }
});

test('I: no single role automatically holds all recovery permissions', () => {
  const roles = getSection('roles and least privilege');
  assert.ok(roles, 'roles and least privilege section missing');
  assert.match(roles, /no single role automatically holds all recovery permissions/i);
  assert.match(roles, /approver and executor are distinct/i);
  assert.doesNotMatch(roles, /a (?:single|one) role (?:automatically )?(?:holds|has) all/i);
});

// ---------------------------------------------------------------------------
// J. Protected references
// ---------------------------------------------------------------------------

test('J: protected issue references are preserved', () => {
  for (const ref of PROTECTED_REFS) {
    assert.ok(policy.includes(ref), `policy missing protected reference ${ref}`);
  }
  assert.ok(policy.includes('#3460'), 'policy missing parent reference #3460');
  assert.match(policy, /remains open|keep open|kept open/i);
});

test('J: policy never auto-closes a protected issue', () => {
  const autoClose = /(closes|fixes|resolves)\s+#(1882|3460|3435|3437|3458)\b/i;
  assert.doesNotMatch(policy, autoClose);
});

test('J/20: this contract is registered exactly once as SOURCE_STATIC', () => {
  const inventory = JSON.parse(fs.readFileSync(CLASSIFICATION_PATH, 'utf8'));
  const matches = inventory.entries.filter((entry) => entry.path === CONTRACT_REPO_PATH);
  assert.equal(matches.length, 1, 'contract must be registered exactly once');
  assert.equal(matches[0].layer, 'SOURCE_STATIC');
  assert.ok(matches[0].rationale && String(matches[0].rationale).trim().length > 0);
  assert.ok(Array.isArray(matches[0].capabilities));
});
