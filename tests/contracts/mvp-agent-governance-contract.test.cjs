'use strict';

/**
 * Contract: canonical LoveBud agent governance.
 *
 * Owner-approved provenance:
 * - MVP governance: #3442 comment 4947327550
 * - CI_UNAVAILABLE_INFRA: #3642
 * - separated Web roles: #3662
 * - UI Rapid Iteration Lane: #3664
 *
 * SOURCE_STATIC only. This test reads repository guidance; it does not launch
 * browsers, use credentials, access databases/providers, deploy, or mutate data.
 */

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.resolve(__dirname, '..', '..');

const PATHS = Object.freeze({
  governance: 'docs/ops/MVP_AGENT_GOVERNANCE.md',
  roles: 'docs/project/WEB_CTO_WEB_DEVELOPER_LOCAL_VALIDATION.md',
  uiLane: 'docs/project/UI_RAPID_ITERATION_LANE.md',
  templates: 'docs/project/ROLE_SESSION_TEMPLATES.md',
  agents: 'AGENTS.md',
  kilo: '.kilocode/rules/00-lovebud-global.md',
  prChecklist: 'docs/ops/PR_CHECKLIST.md',
  mergeFirst: 'docs/ops/MERGE_FIRST_PRODUCTION_VERIFICATION_WORKFLOW.md',
  verification: 'docs/project/VERIFICATION_AND_EVIDENCE.md',
  screenshots: 'docs/ops/UI_SCREENSHOT_CTO_REVIEW_POLICY.md',
});

function read(rel) {
  const abs = path.join(ROOT, rel);
  assert.ok(fs.existsSync(abs), `Expected file to exist: ${rel}`);
  return fs.readFileSync(abs, 'utf8');
}

function section(text, startHeading, endHeading) {
  const start = text.indexOf(startHeading);
  assert.notEqual(start, -1, `Missing section heading: ${startHeading}`);
  const from = start + startHeading.length;
  if (!endHeading) return text.slice(from);
  const end = text.indexOf(endHeading, from);
  assert.notEqual(end, -1, `Missing following section heading: ${endHeading}`);
  return text.slice(from, end);
}

function assertContainsAll(text, values, label) {
  for (const value of values) {
    assert.ok(text.includes(value), `${label} must contain ${value}`);
  }
}

const CURRENT_ENTRYPOINTS = Object.freeze([
  PATHS.agents,
  PATHS.kilo,
  PATHS.roles,
  PATHS.uiLane,
  PATHS.templates,
  PATHS.prChecklist,
  PATHS.mergeFirst,
  PATHS.verification,
  PATHS.screenshots,
]);

test('canonical governance declares all owner-approved provenance', () => {
  const src = read(PATHS.governance);
  assert.match(src, /canonical source of truth/i);
  assertContainsAll(src, ['4947327550', '#3642', '#3662', '#3664'], 'governance');
  assert.ok(src.includes(PATHS.roles));
  assert.ok(src.includes(PATHS.uiLane));
});

test('canonical governance lists exactly seven hard standing rules', () => {
  const src = read(PATHS.governance);
  const hard = section(src, '## Hard standing rules', '## CI classification');
  const numbered = hard.match(/^\d+\./gm) || [];
  assert.equal(numbered.length, 7, `Expected 7 hard rules, found ${numbered.length}`);

  assert.match(hard, /secret|credential|private payload/i);
  assert.match(hard, /another worker|other worker/i);
  assert.match(hard, /destructive Production/i);
  assert.match(hard, /CI_EXECUTED_FAILURE/);
  assert.match(hard, /CI_PENDING_EXECUTION/);
  assert.match(hard, /CI_UNAVAILABLE_INFRA/);
  assert.match(hard, /expected PR head|expected.*head/i);
  assert.match(hard, /squash merge/i);
  assert.match(hard, /Never close #1882/i);
  assert.match(hard, /Refs #1882/);
});

test('canonical governance defines exact CI classifications', () => {
  const src = read(PATHS.governance);
  assertContainsAll(src, [
    'CI_GREEN',
    'CI_EXECUTED_FAILURE',
    'CI_PENDING_EXECUTION',
    'CI_UNAVAILABLE_INFRA',
  ], 'governance CI section');
  assert.match(src, /red job shell.*no steps|red.*appearance alone/is);
});

test('canonical governance defines evidence levels and browser permission model', () => {
  const src = read(PATHS.governance);
  assertContainsAll(src, [
    'LOCAL_EVIDENCE',
    'PRE_MERGE_EVIDENCE',
    'PRODUCTION_EVIDENCE',
  ], 'governance evidence model');
  assert.match(src, /allowed without special approval|allowed by default/i);
  assert.match(src, /browser/i);
  assert.match(src, /preview|fixed slot/i);
  assert.match(src, /evidence strength, not permission/i);
});

test('canonical governance defines separated Web roles with conditional Local Validation', () => {
  const src = read(PATHS.governance);
  assertContainsAll(src, ['Web CTO', 'Web Developer', 'Local Validation when required'], 'role model');
  assert.match(src, /separate Web Developer implementation/i);
  assert.match(src, /Local Validation only when required/i);
  assert.match(src, /Web CTO independent final review/i);
  assert.match(src, /same production change.*implemented and finally approved/is);
});

test('UI Rapid Iteration Lane defines U0 through U3 and risk boundaries', () => {
  const lane = read(PATHS.uiLane);
  assertContainsAll(lane, [
    'U0 — Copy-only',
    'U1 — Visual-only',
    'U2 — Structural UI',
    'U3 — Runtime-sensitive UI',
  ], 'UI lane');
  assert.match(lane, /JavaScript|auth|API|cache|storage/i);
  assert.match(lane, /DOM structure|focus order|accessibility/i);
  assert.match(lane, /shared\/global|global CSS/i);
});

test('U0 and U1 are explicitly de-escalated from ceremonial process', () => {
  const governance = read(PATHS.governance);
  const lane = read(PATHS.uiLane);
  const combined = `${governance}\n${lane}`;

  assert.match(combined, /U0\/U1 skip Local Validation by default/i);
  assert.match(combined, /do not require a new child Issue|new Issue is not required/i);
  assert.match(combined, /do not require unrelated full-suite tests|Unrelated full-suite commands must not/i);
  assert.match(combined, /do not require[^\n]*pre-merge screenshots|pre-merge screenshots are optional/i);
  assert.match(combined, /do not require[^\n]*fixed slot|fixed slot.*not.*permission gate|fixed slot.*optional/i);
});

test('U2 and U3 retain structural and runtime evidence', () => {
  const lane = read(PATHS.uiLane);
  const u2 = section(lane, '## 5. U2 — Structural UI', '## 6. U3 — Runtime-sensitive UI');
  const u3 = section(lane, '## 6. U3 — Runtime-sensitive UI', '## 7. Escalation triggers');
  assert.match(u2, /focused.*test/i);
  assert.match(u2, /Local Validation only when.*needs local\/browser evidence|conditional.*Local Validation/is);
  assert.match(u3, /full separated execution model|full relevant runtime/i);
});

test('current entrypoints link canonical governance and current role/UI policy', () => {
  for (const rel of CURRENT_ENTRYPOINTS) {
    const src = read(rel);
    assert.ok(src.includes('MVP_AGENT_GOVERNANCE.md') || rel === PATHS.governance,
      `${rel} must link canonical governance`);
  }

  for (const rel of [PATHS.agents, PATHS.kilo, PATHS.roles, PATHS.templates, PATHS.prChecklist]) {
    const src = read(rel);
    assert.ok(src.includes('UI_RAPID_ITERATION_LANE.md'), `${rel} must link UI Rapid Iteration Lane`);
  }
});

test('root guidance restores numbered environment and operational input/image guardrails', () => {
  const src = read(PATHS.agents);
  const operational = section(
    src,
    '## 11. Operational input and image handling',
    '## 12. Test selection'
  );

  assert.match(src, /^## 10\. Current local execution environment$/m);
  assert.match(
    operational,
    /pasted[^\n]*(completion reports?|logs?|command results?)[^\n]*(decision inputs?|not automatically trusted)/i
  );
  assert.match(
    operational,
    /independently verifies?[^\n]*(remote SHA|cumulative diff)[^\n]*(changed files|CI|comments|evidence)/i
  );
  assert.match(operational, /attached images[^\n]*(analysis|comparison|review)[^\n]*by default/i);
  assert.match(
    operational,
    /generate or transform images[^\n]*only when the user explicitly requests/i
  );
  assert.match(operational, /mentioning an image alone is not such a request/i);
});

test('entrypoints do not restore Local as the default coder for U0/U1', () => {
  for (const rel of [PATHS.agents, PATHS.kilo, PATHS.roles, PATHS.templates, PATHS.prChecklist, PATHS.verification]) {
    const src = read(rel);
    assert.doesNotMatch(src, /U0\/U1[^\n]{0,200}(Local Validation (is )?required|must use Local)/i,
      `${rel} must not require Local for U0/U1`);
  }
});

test('entrypoints do not restore universal full-suite, fixed-slot, or screenshot gates for U0/U1', () => {
  const forbidden = /U0\/U1[^\n]{0,240}(must use full suite|full suite is required|required fixed slot|fixed slot is required|screenshots are required)/i;
  for (const rel of [PATHS.agents, PATHS.kilo, PATHS.uiLane, PATHS.prChecklist, PATHS.mergeFirst, PATHS.verification]) {
    assert.doesNotMatch(read(rel), forbidden, `${rel} must keep U0/U1 risk-proportional`);
  }
});

test('new restriction protocol remains owner-traceable', () => {
  const src = read(PATHS.governance);
  assert.match(src, /New restriction protocol/i);
  assert.match(src, /traceable owner approval/i);
  assert.ok(src.includes('RECOMMENDATION_ONLY'));
});

test('destructive Production protection remains while ordinary scoped work is allowed', () => {
  const src = read(PATHS.governance);
  assert.match(src, /Destructive Production data deletion.*requires owner approval/is);
  assert.match(src, /ordinary.*test-data|ordinary in-scope test-data/i);
});

test('no current policy uses forbidden closing keywords for #1882', () => {
  const forbidden = /\b(?:Closes|Fixes|Resolves)\s+#1882\b/i;
  for (const rel of CURRENT_ENTRYPOINTS.concat([PATHS.governance])) {
    assert.doesNotMatch(read(rel), forbidden, `${rel} must not close #1882`);
  }
});

test('dirty worktree remains preserve-and-route rather than automatic blocker', () => {
  const src = read(PATHS.governance);
  assert.match(src, /dirty worktree/i);
  assert.match(src, /preserve existing changes/i);
  assert.match(src, /not an automatic blocker/i);
  assert.match(src, /do not clean\/reset\/stash-drop\/overwrite/i);
});
