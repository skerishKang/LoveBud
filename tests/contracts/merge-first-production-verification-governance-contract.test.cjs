'use strict';

/**
 * Contract: merge-first Production verification with risk-proportional UI gates.
 *
 * Provenance:
 * - merge-first workflow: #3513
 * - separated Web roles: #3662
 * - UI Rapid Iteration Lane: #3664
 *
 * SOURCE_STATIC only.
 */

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.resolve(__dirname, '..', '..');

const PATHS = Object.freeze({
  workflow: 'docs/ops/MERGE_FIRST_PRODUCTION_VERIFICATION_WORKFLOW.md',
  governance: 'docs/ops/MVP_AGENT_GOVERNANCE.md',
  uiLane: 'docs/project/UI_RAPID_ITERATION_LANE.md',
  roles: 'docs/project/WEB_CTO_WEB_DEVELOPER_LOCAL_VALIDATION.md',
  checklist: 'docs/ops/PR_CHECKLIST.md',
  verification: 'docs/project/VERIFICATION_AND_EVIDENCE.md',
  screenshots: 'docs/ops/UI_SCREENSHOT_CTO_REVIEW_POLICY.md',
  agents: 'AGENTS.md',
  kilo: '.kilocode/rules/00-lovebud-global.md',
});

function read(rel) {
  const abs = path.join(ROOT, rel);
  assert.ok(fs.existsSync(abs), `Expected file to exist: ${rel}`);
  return fs.readFileSync(abs, 'utf8');
}

function assertContainsAll(text, values, label) {
  for (const value of values) {
    assert.ok(text.includes(value), `${label} must contain ${value}`);
  }
}

function section(text, startHeading, endHeading) {
  const start = text.indexOf(startHeading);
  assert.notEqual(start, -1, `Missing section: ${startHeading}`);
  const from = start + startHeading.length;
  if (!endHeading) return text.slice(from);
  const end = text.indexOf(endHeading, from);
  assert.notEqual(end, -1, `Missing following section: ${endHeading}`);
  return text.slice(from, end);
}

const CURRENT_POLICY_DOCS = Object.freeze([
  PATHS.workflow,
  PATHS.governance,
  PATHS.uiLane,
  PATHS.roles,
  PATHS.checklist,
  PATHS.verification,
  PATHS.screenshots,
  PATHS.agents,
  PATHS.kilo,
]);

test('merge-first workflow declares current authority and provenance', () => {
  const src = read(PATHS.workflow);
  assert.match(src, /Merge-First Production Verification Workflow/i);
  assertContainsAll(src, ['#3513', '#3662', '#3664'], 'merge-first workflow');
  assert.ok(src.includes('MVP_AGENT_GOVERNANCE.md'));
  assert.ok(src.includes('UI_RAPID_ITERATION_LANE.md'));
});

test('workflow contains current risk-proportional sections', () => {
  const src = read(PATHS.workflow);
  for (const heading of [
    '## 1. Purpose',
    '## 2. Current operating mode',
    '## 3. Pre-merge evidence by change class',
    '## 4. Test selection principle',
    '## 5. CI',
    '## 6. Optional pre-merge browser evidence',
    '## 7. Post-merge Production verification',
    '## 8. Production outcomes',
    '## 9. Merge rules',
    '## 10. Role allocation',
    '## 11. Issue handling',
    '## 12. Report template',
    '## 13. Governance boundary',
  ]) {
    assert.ok(src.includes(heading), `Missing workflow heading: ${heading}`);
  }
});

test('current flow is focused pre-merge evidence followed by Production confirmation', () => {
  const src = read(PATHS.workflow);
  assert.match(src, /focused pre-merge evidence/i);
  assert.match(src, /Local Validation only when required/i);
  assert.match(src, /expected-head squash merge/i);
  assert.match(src, /Cloudflare Pages automatically deploys main/i);
  assert.match(src, /affected Production behavior is confirmed/i);
});

test('preview and fixed slot remain optional evidence, not permission gates', () => {
  const src = read(PATHS.workflow);
  assert.match(src, /Preview and fixed-slot procedures remain optional/i);
  assert.match(src, /absence is not a merge blocker/i);
  assert.match(src, /do not search for preview URLs or deploy fixed slots unless assigned/i);
});

test('U0 copy-only gates are focused and Local-free by default', () => {
  const src = read(PATHS.workflow);
  const u0 = section(src, '### U0 — Copy-only', '### U1 — Visual-only');
  assert.match(u0, /exact before\/after copy/i);
  assert.match(u0, /syntax\/static\/focused copy check/i);
  assert.match(u0, /CI classification/i);
  assert.match(u0, /exact-head remote review/i);
  assert.match(u0, /Not automatically required/i);
  assert.match(u0, /Local Validation/i);
  assert.match(u0, /full lint\/build\/test\/verify suite/i);
  assert.match(u0, /preview\/fixed slot/i);
  assert.match(u0, /screenshots/i);
});

test('U1 visual-only gates are focused and escalate structural/runtime risk', () => {
  const src = read(PATHS.workflow);
  const u1 = section(src, '### U1 — Visual-only', '### U2 — Structural UI');
  assert.match(u1, /selector\/token\/value delta/i);
  assert.match(u1, /focused CSS\/static check/i);
  assert.match(u1, /Local Validation and pre-merge screenshots are optional/i);
  assert.match(u1, /layout|overflow|shared\/global|breakpoint/i);
});

test('U2 and U3 retain structural and runtime evidence', () => {
  const src = read(PATHS.workflow);
  const u2 = section(src, '### U2 — Structural UI', '### U3 — Runtime-sensitive UI');
  const u3 = section(src, '### U3 — Runtime-sensitive UI', '### Backend/data/auth/security');
  assert.match(u2, /DOM\/layout\/accessibility/i);
  assert.match(u2, /conditional browser\/Local evidence/i);
  assert.match(u3, /unit\/contract\/integration/i);
  assert.match(u3, /Local\/runtime\/browser\/auth\/API\/cache\/storage/i);
});

test('backend, data, auth, and security remain strict', () => {
  const src = read(PATHS.workflow);
  const strict = section(src, '### Backend/data/auth/security', '## 4. Test selection principle');
  assert.match(strict, /strict full evidence/i);
  assert.match(strict, /UI fast-lane reductions do not apply/i);
});

test('workflow rejects universal full-suite testing by file type', () => {
  const src = read(PATHS.workflow);
  const tests = section(src, '## 4. Test selection principle', '## 5. CI');
  assert.match(tests, /Tests are selected by affected behavior and blast radius/i);
  assert.match(tests, /Do not require every command below for every PR/i);
  assertContainsAll(tests, ['npm run lint', 'npm run build', 'npm test', 'npm run verify'], 'illustrative suite list');
});

test('workflow preserves exact CI classifications and blockers', () => {
  const src = read(PATHS.workflow);
  assertContainsAll(src, [
    'CI_GREEN',
    'CI_EXECUTED_FAILURE',
    'CI_PENDING_EXECUTION',
    'CI_UNAVAILABLE_INFRA',
  ], 'workflow CI');
  assert.match(src, /relevant executed failure blocks merge/i);
  assert.match(src, /queued\/running work blocks merge temporarily/i);
  assert.match(src, /infrastructure-unavailable shells/i);
});

test('Production verification scope is proportional to U0 through U3', () => {
  const src = read(PATHS.workflow);
  const production = section(src, '## 7. Post-merge Production verification', '## 8. Production outcomes');
  assertContainsAll(production, ['### U0', '### U1', '### U2', '### U3'], 'Production section');
  assert.match(production, /Full journey QA is not required/i);
  assert.match(production, /Do not automatically repeat every page and viewport/i);
  assert.match(production, /console\/network/i);
});

test('minor U0/U1 misses use micro correction PRs, not destructive rollback', () => {
  const src = read(PATHS.workflow);
  assert.match(src, /Minor U0\/U1 visual miss/i);
  assert.match(src, /new micro branch from current main/i);
  assert.match(src, /focused checks/i);
  assert.match(src, /Production re-check/i);
  assert.match(src, /Never force-push\/reset\/move `main` destructively/i);
  assert.match(src, /dedicated correction or revert PR/i);
});

test('merge remains expected-head squash only', () => {
  const src = read(PATHS.workflow);
  const merge = section(src, '## 9. Merge rules', '## 10. Role allocation');
  assert.match(merge, /re-read exact head immediately before merge/i);
  assert.match(merge, /squash merge with expected head pinned/i);
  assert.match(merge, /Do not use merge\/rebase commit methods/i);
});

test('role allocation keeps Local conditional and CTO final', () => {
  const src = read(PATHS.workflow);
  const roles = section(src, '## 10. Role allocation', '## 11. Issue handling');
  assertContainsAll(roles, ['Web CTO', 'Web Developer', 'Local Validation'], 'role allocation');
  assert.match(roles, /invoked only when required/i);
  assert.match(roles, /does not make final merge decision/i);
  assert.match(roles, /expected-head squash merge/i);
});

test('U0/U1 issue overhead is explicitly reduced', () => {
  const src = read(PATHS.workflow);
  const issues = section(src, '## 11. Issue handling', '## 12. Report template');
  assert.match(issues, /do not require a new child Issue for every micro correction/i);
  assert.match(issues, /active parent\/product\/UI objective/i);
});

test('AGENTS and local rules identify merge-first and the UI lane', () => {
  for (const rel of [PATHS.agents, PATHS.kilo]) {
    const src = read(rel);
    assert.ok(src.includes('UI_RAPID_ITERATION_LANE.md'), `${rel} must link UI lane`);
    assert.match(src, /Merge-first Production verification/i);
    assert.match(src, /U0|copy-only/i);
    assert.match(src, /U1|visual-only/i);
  }
});

test('PR checklist and verification docs implement the same risk routing', () => {
  for (const rel of [PATHS.checklist, PATHS.verification, PATHS.screenshots]) {
    const src = read(rel);
    assert.ok(src.includes('UI_RAPID_ITERATION_LANE.md'), `${rel} must link UI lane`);
    assert.match(src, /U0/);
    assert.match(src, /U1/);
    assert.match(src, /U2/);
    assert.match(src, /U3/);
  }
});

test('current policy docs do not make fixed slot a universal merge gate', () => {
  const forbidden = /fixed[- ]slot[^\n]*(?:is required|is mandatory|must be used|must run)[^\n]*(?:every|all|before merge)/i;
  for (const rel of CURRENT_POLICY_DOCS) {
    assert.doesNotMatch(read(rel), forbidden, `${rel} must not restore universal fixed-slot gate`);
  }
});

test('current policy docs do not make Local Validation universal for U0/U1', () => {
  const forbidden = /U0\/U1[^\n]*(?:Local Validation is required|Local Validation is mandatory|must use Local Validation)/i;
  for (const rel of CURRENT_POLICY_DOCS) {
    assert.doesNotMatch(read(rel), forbidden, `${rel} must not require Local for U0/U1`);
  }
});

test('current policy docs never close #1882', () => {
  const forbidden = /\b(?:Closes|Fixes|Resolves)\s+#1882\b/i;
  for (const rel of CURRENT_POLICY_DOCS) {
    assert.doesNotMatch(read(rel), forbidden, `${rel} must not close #1882`);
  }
});
