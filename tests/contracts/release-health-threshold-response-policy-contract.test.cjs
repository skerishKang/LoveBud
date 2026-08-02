'use strict';

const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.resolve(__dirname, '..', '..');
const POLICY_PATH = path.join(ROOT, 'docs', 'ops', 'RELEASE_HEALTH_THRESHOLD_AND_RESPONSE_POLICY.md');
const CLASSIFICATION_PATH = path.join(ROOT, 'tests', 'test-layer-classification.json');
const REGISTRY_CONTRACT_PATH = path.join(ROOT, 'tests', 'contracts', 'ci-test-group-registry-contract.test.cjs');
const CF_SMOKE_CONTRACT_PATH = path.join(ROOT, 'tests', 'contracts', 'cloudflare-supplied-url-smoke-contract.test.cjs');

const SELF_PATH = 'tests/contracts/release-health-threshold-response-policy-contract.test.cjs';

assert.ok(fs.existsSync(POLICY_PATH), 'policy document must exist');
const POLICY = fs.readFileSync(POLICY_PATH, 'utf8');

const HEALTH_STATES = ['HEALTHY', 'DEGRADED', 'BLOCKED', 'INSUFFICIENT_EVIDENCE'];
const RESPONSE_RECOMMENDATIONS = [
  'NO_ACTION',
  'OBSERVE',
  'FORWARD_FIX_REQUIRED',
  'ROLLBACK_RECOMMENDED',
  'OWNER_DECISION_REQUIRED',
];
const PRECEDENCE_ORDER = [
  'PRIVACY_OR_SAFETY_VIOLATION',
  'RELEASE_IDENTITY_MISMATCH',
  'REQUIRED_FUNCTIONAL_BLOCKER',
  'INSUFFICIENT_REQUIRED_EVIDENCE',
  'DEGRADED_SIGNAL',
  'HEALTHY',
];
const HARD_BLOCKERS = [
  'release_sha_mismatch',
  'missing_or_invalid_release_manifest',
  'required_route_failure',
  'required_static_asset_failure',
  'same_origin_unexpected_http_ge_400',
  'fatal_pageerror_or_unhandled_browser_error',
  'privacy_boundary_violation',
  'validated_critical_journey_terminal_failure',
  'required_health_check_failed',
];
const ROLLBACK_PREREQUISITES = [
  'exact deployed bad SHA identified',
  'exact known-good rollback target SHA identified',
  'blocker causally linked to the bad SHA',
  'rollback path operationally available',
  'no DB/schema/data/provider incompatibility known',
  'rollback does not cross an irreversible migration boundary',
  'owner approval required before execution',
];
const FORWARD_FIX_CONDITIONS = [
  'application reachable',
  'no security/privacy/data-integrity emergency proven',
  'bounded corrective release feasible',
  'rollback compatibility unknown or unsafe',
];
const REQUIRED_EVIDENCE = [
  'expected_release_sha known',
  'observed_release_sha known (or NOT_EXPOSED with manifest authority)',
  'release_manifest_valid known',
  'release_match_state known',
  'required route checks measured',
  'required static asset checks measured',
  'required browser health measured',
  'required critical journey evidence measured',
  'privacy_boundary_pass known',
];
const NOT_HEALTH_EVIDENCE = [
  'subjective visual judgment',
  'product acceptance',
  'authenticated visual acceptance',
  'content/copy preference',
  'UI/Product approval',
];
const PRIVACY_EXCLUSIONS = [
  'raw body',
  'raw exception',
  'stack trace',
  'URL (with or without query)',
  'query string values',
  'token',
  'cookie',
  'authorization header',
  'user content',
  'private identifier (treeId, memoryId, Firebase UID, user ID, UUID)',
  'provider/account/project metadata',
  'deployment ID',
  'database URL / connection string',
  'request ID',
  'raw timestamp',
  'free-form metadata',
];

function fencedBlocks() {
  const blocks = [];
  const re = /```text\n([\s\S]*?)```/g;
  let m;
  while ((m = re.exec(POLICY)) !== null) {
    blocks.push(m[1].trim());
  }
  return blocks;
}

// Returns the trimmed text of the fenced block that either contains `marker`
// (marker as the first line inside the fence) or immediately follows `marker`
// when the marker is a heading outside the fence.
function rawBlock(marker) {
  const containing = fencedBlocks().find((block) => block.includes(marker));
  if (containing) {
    return containing;
  }
  const markerIndex = POLICY.indexOf(marker);
  assert.ok(markerIndex >= 0, `policy must contain marker: ${marker}`);
  const after = POLICY.slice(markerIndex, markerIndex + 500);
  const m = after.match(/```text\n([\s\S]*?)```/);
  assert.ok(m, `a fenced block must follow marker: ${marker}`);
  return m[1].trim();
}

function blockLines(marker) {
  return rawBlock(marker)
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean)
    .filter((line) => line !== marker);
}

test('exact four health states are the only top-level states', () => {
  assert.deepEqual(blockLines('HEALTH_STATES:'), HEALTH_STATES);
});

test('exact five response recommendations are the only recommendations', () => {
  assert.deepEqual(blockLines('RESPONSE_RECOMMENDATIONS:'), RESPONSE_RECOMMENDATIONS);
});

test('single deterministic precedence, high to low, HEALTHY lowest', () => {
  const ordered = blockLines('PRECEDENCE (high -> low):')
    .map((line) => line.replace(/^>\s*/, '').trim())
    .filter((line) => line !== '>');
  assert.deepEqual(ordered, PRECEDENCE_ORDER);
  assert.equal(ordered[ordered.length - 1], 'HEALTHY', 'HEALTHY must be lowest priority');
});

test('hard blocker set is exact and tied to the exact deployed release', () => {
  assert.deepEqual(blockLines('HARD_BLOCKERS:'), HARD_BLOCKERS);
  assert.match(POLICY, /never downgraded by a degraded or healthy signal/);
  assert.match(POLICY, /Third-party noise, optional signals, or unmeasured data are \*\*not\*\* hard blockers without authorized evidence/);
});

test('no success-default: missing or unmeasured required evidence is never HEALTHY', () => {
  assert.match(POLICY, /No required evidence is ever defaulted to success/);
  assert.match(POLICY, /is \*\*not\*\* `HEALTHY`/);
  assert.deepEqual(blockLines('REQUIRED_EVIDENCE:'), REQUIRED_EVIDENCE);
  assert.match(POLICY, /incomplete is `INSUFFICIENT_EVIDENCE`/);
});

test('latency boundary: GTE_5_S is DEGRADED unless explicit timeout/functional failure is BLOCKED', () => {
  const rule = rawBlock('LATENCY_RULE:');
  assert.match(rule, /TIMEOUT_OR_UNKNOWN on a required check:/);
  assert.match(rule, /INSUFFICIENT_EVIDENCE or BLOCKED according to the check contract/);
  assert.match(rule, /GTE_5_S on a required deterministic smoke operation:/);
  assert.match(rule, /-> DEGRADED/);
  assert.match(rule, /unless the operation also fails its explicit timeout\/functional contract:/);
  assert.match(rule, /-> BLOCKED/);
  assert.match(POLICY, /No API p95 or user-impact threshold is invented/);
});

test('forward-fix is the default for a release-linked blocker under its conditions', () => {
  assert.deepEqual(blockLines('FORWARD_FIX_CONDITIONS:'), FORWARD_FIX_CONDITIONS);
  assert.match(POLICY, /`FORWARD_FIX_REQUIRED` is the default response/);
  assert.match(POLICY, /security\/privacy\/data-integrity emergency that is proven escalates to `OWNER_DECISION_REQUIRED`/);
});

test('rollback requires every prerequisite and never by guess', () => {
  assert.deepEqual(blockLines('ROLLBACK_PREREQUISITES:'), ROLLBACK_PREREQUISITES);
  assert.match(POLICY, /If any prerequisite is `UNKNOWN`, emit `OWNER_DECISION_REQUIRED` or `FORWARD_FIX_REQUIRED`/);
  assert.match(POLICY, /Never recommend rollback by guess/);
  assert.match(POLICY, /owner approval required before execution/);
});

test('owner approval and automatic-rollback prohibition are unconditional', () => {
  assert.match(POLICY, /Rollback \*\*execution\*\* is always `NOT_AUTHORIZED` in this policy/);
  assert.match(POLICY, /Automatic rollback execution is `NOT_AUTHORIZED`/);
  assert.match(POLICY, /Owner approval is always required before any rollback or emergency action/);
  const nonActions = rawBlock('### Non-actions (NOT_AUTHORIZED)');
  assert.match(nonActions, /rollback execution/);
  assert.match(nonActions, /deployment/);
  assert.match(nonActions, /Ready \/ merge \/ Issue closure \/ parent closure/);
});

test('technical release health is strictly separated from product acceptance', () => {
  assert.deepEqual(blockLines('NOT_HEALTH_EVIDENCE:'), NOT_HEALTH_EVIDENCE);
  assert.match(POLICY, /`HEALTHY` never implies UI\/Product approval/);
  assert.match(POLICY, /may be technically `HEALTHY` while product\/visual acceptance is still pending/);
});

test('privacy boundary excludes every raw or private payload class', () => {
  for (const excluded of PRIVACY_EXCLUSIONS) {
    assert.ok(POLICY.includes(excluded), `policy must exclude: ${excluded}`);
  }
  assert.match(POLICY, /PRIVACY_BOUNDARY_VIOLATION/);
  assert.match(POLICY, /Allowed outputs are bounded enum\/bucket values only/);
});

test('Step 6 operator-summary handoff contract forbids raw payload', () => {
  const handoff = rawBlock('HANDOFF_CONTRACT:');
  assert.match(handoff, /health_state, response_recommendation, bounded evidence enums, bounded sanitized codes/);
  assert.match(handoff, /forbidden: raw body, raw exception, stack, URL, token, cookie, authorization, user content,/);
  assert.match(handoff, /private identifiers, provider\/account\/project metadata, database URL/);
  assert.match(handoff, /each summary cites the exact correlated release SHA and the policy authority document/);
  assert.match(POLICY, /A later Step 6 summary may never include a field this policy forbids/);
});

test('exact policy authority is the single document and closure impact keeps all issues OPEN', () => {
  assert.match(POLICY, /This single document is the one-document policy authority for release health states and response recommendations/);
  assert.match(POLICY, /Step 5 of 6/);
  for (const issue of ['#3824', '#3673', '#3670', '#3672', '#3425', '#1882']) {
    assert.match(POLICY, new RegExp(`${issue} Keep OPEN`));
  }
  assert.match(POLICY, /Step 6 \(operator-facing summary\/reporting\) is the next future step and remains OPEN/);
});

test('policy document never embeds a raw payload example', () => {
  assert.doesNotMatch(POLICY, /https?:\/\/[a-z0-9.-]+/i, 'policy must not contain a concrete URL');
  assert.doesNotMatch(POLICY, /Bearer\s+\S+/i, 'policy must not contain a token literal');
  assert.doesNotMatch(POLICY, /\{"responseBody":/, 'policy must not contain a raw body example');
  assert.doesNotMatch(POLICY, /private user content/, 'policy must not embed user content');
});

test('this contract is classified SOURCE_STATIC and registry/count literals are reconciled', () => {
  const classification = JSON.parse(fs.readFileSync(CLASSIFICATION_PATH, 'utf8'));
  const entry = classification.entries.find((e) => e.path === SELF_PATH);
  assert.ok(entry, 'classification entry must exist for this contract test');
  assert.equal(entry.layer, 'SOURCE_STATIC');

  const registryContract = fs.readFileSync(REGISTRY_CONTRACT_PATH, 'utf8');
  assert.match(registryContract, /expected post-child counts 791 \/ 578 \/ 191 \/ 22/);
  assert.match(registryContract, /default_total,\s*791/);
  assert.match(registryContract, /SOURCE_STATIC,\s*578/);
  assert.match(registryContract, /EXECUTED_FAKE,\s*191/);
  assert.match(registryContract, /EXECUTED_REAL_LOCAL,\s*22/);

  // The CF smoke contract embeds the same count literals as regex-literal text
  // (backslash-s), so match the literal source text rather than a whitespace class.
  const cfSmoke = fs.readFileSync(CF_SMOKE_CONTRACT_PATH, 'utf8');
  assert.ok(cfSmoke.includes('default_total,\\s*791'), 'CF smoke contract must embed default_total 791 literal');
  assert.ok(cfSmoke.includes('SOURCE_STATIC,\\s*578'), 'CF smoke contract must embed SOURCE_STATIC 578 literal');
});

test('this contract is source-static with no I/O side effect beyond reading files', () => {
  const source = fs.readFileSync(__filename, 'utf8');
  assert.doesNotMatch(source, /require\(['\"](?:http|https|node:net|child_process)['\"]\)/);
  assert.doesNotMatch(source, /\bfetch\s*\(/);
  assert.doesNotMatch(source, /\bsetTimeout\s*\(/);
});
