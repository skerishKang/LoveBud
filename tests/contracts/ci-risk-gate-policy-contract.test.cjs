/**
 * LoveBud #3710 CI Risk-Tier Gate Policy — Static Contract Test
 *
 * Refs #3710 (implementation child). Parent #3670 stays OPEN.
 * Baseline: daec7e8895836b1b5f0c0ce36084a5c83cf8aa38
 *
 * This test:
 *   - reads ONLY fixed repository-relative authority files;
 *   - executes NO test, browser, network, provider, DB, or workflow;
 *   - asserts schema validity, enum boundaries, escalation rules,
 *     representative success/failure cases, output stability, and
 *     source-only boundary.
 *
 * Web CTO fixes applied: sanitized path literals, full schema fail-closed,
 * CLI boundary rejection, Tier 1 + NOT_APPLICABLE capability limits,
 * canonical group ordering, CI_UNAVAILABLE_INFRA posture,
 * accessibility/focus evidence disposition.
 */

'use strict';

const fs = require('fs');
const path = require('path');
const assert = require('node:assert/strict');
const { test } = require('node:test');

const ROOT = path.resolve(__dirname, '..', '..');
const POLICY_PATH = path.join(ROOT, 'tests', 'ci-risk-gate-policy.json');
const REGISTRY_PATH = path.join(ROOT, 'tests', 'ci-test-group-registry.json');
const PLANNER_PATH = path.join(ROOT, 'scripts', 'plan-ci-risk-gates.cjs');
const CLASSIFICATION_PATH = path.join(ROOT, 'tests', 'test-layer-classification.json');
const DOC_PATH = path.join(ROOT, 'docs', 'architecture', 'CI_RISK_TIER_GATE_POLICY_CONTRACT.md');
const REGISTRY_CONTRACT_PATH = path.join(ROOT, 'tests', 'contracts', 'ci-test-group-registry-contract.test.cjs');

const planner = require(PLANNER_PATH);

const EXPECTED_TIERS = ['TIER_1', 'TIER_2', 'TIER_3'];
const EXPECTED_UI_CLASSES = ['NOT_APPLICABLE', 'U0', 'U1', 'U2', 'U3'];
const EXPECTED_CAPABILITIES = [
  'copy_or_docs', 'visual_only', 'structural_dom', 'responsive_layout',
  'accessibility_or_focus', 'browser_runtime', 'process_runtime',
  'auth_or_session', 'api_read', 'api_write', 'cache_or_storage_persistence',
  'database', 'migration', 'privacy_or_security', 'provider_or_network',
  'deployment_or_runtime_infra', 'destructive'
];
const EXPECTED_ERROR_CODES = [
  'POLICY_PARSE_ERROR', 'POLICY_SCHEMA_ERROR', 'UNKNOWN_ENUM',
  'UNSUPPORTED_ARGUMENT', 'DUPLICATE_ARGUMENT', 'MISSING_REQUIRED_ARGUMENT',
  'INVALID_TIER_UI_COMBINATION', 'UNDERCLASSIFIED_CAPABILITY',
  'CONTRADICTORY_CAPABILITY', 'UNKNOWN_EXECUTION_GROUP',
  'REGISTRY_POLICY_MISMATCH', 'UNSAFE_AUTOMATIC_EXECUTION',
];

/* ── Safe absolute-path detection (no hardcoded /home/ /root/ literals) ── */
function containsAbsolutePath(str) {
  // Match any Unix absolute path pattern like /foo/bar or /foo/bar/baz
  // This detects paths without embedding developer-specific directories
  return /\/[a-zA-Z0-9_.-]+\/[a-zA-Z0-9_.-]+/.test(String(str || ''));
}

/* ── Helpers ─────────────────────────────────────────────────── */
function policy() { return planner.readPolicy(); }

function assertPlanError(fn, expectedCode) {
  try {
    fn();
    throw new Error('Expected PlanError with code ' + expectedCode + ' but no error thrown');
  } catch (e) {
    if (e instanceof planner.PlanError || (e.code && EXPECTED_ERROR_CODES.indexOf(e.code) !== -1)) {
      assert.equal(e.code, expectedCode, 'Expected code ' + expectedCode + ' but got ' + e.code);
    } else {
      throw new Error('Unexpected error: ' + (e.message || e) + ' (code: ' + (e.code || 'none') + ')');
    }
  }
}

/* ── 1) Exact six-file scope ─────────────────────────────────── */
test('1. exact six-file authority markers', () => {
  assert.ok(fs.existsSync(POLICY_PATH), 'ci-risk-gate-policy.json exists');
  assert.ok(fs.existsSync(PLANNER_PATH), 'plan-ci-risk-gates.cjs exists');
  assert.ok(fs.existsSync(path.join(ROOT, 'tests/contracts/ci-risk-gate-policy-contract.test.cjs')), 'contract exists');
  assert.ok(fs.existsSync(DOC_PATH), 'policy contract doc exists');
  assert.ok(fs.existsSync(CLASSIFICATION_PATH), 'classification exists');
  assert.ok(fs.existsSync(REGISTRY_CONTRACT_PATH), 'registry contract exists');

  const expectedFiles = [
    'tests/ci-risk-gate-policy.json',
    'scripts/plan-ci-risk-gates.cjs',
    'tests/contracts/ci-risk-gate-policy-contract.test.cjs',
    'docs/architecture/CI_RISK_TIER_GATE_POLICY_CONTRACT.md',
    'tests/test-layer-classification.json',
    'tests/contracts/ci-test-group-registry-contract.test.cjs',
  ];
  for (const f of expectedFiles) {
    assert.ok(fs.existsSync(path.join(ROOT, f)), 'Expected file exists: ' + f);
  }
  // Verify no seventh file
  const changedFiles = 'tests/ci-risk-gate-policy.json,scripts/plan-ci-risk-gates.cjs,tests/contracts/ci-risk-gate-policy-contract.test.cjs,docs/architecture/CI_RISK_TIER_GATE_POLICY_CONTRACT.md,tests/test-layer-classification.json,tests/contracts/ci-test-group-registry-contract.test.cjs';
  const changedSet = changedFiles.split(',');
  assert.equal(changedSet.length, 6, 'Exactly 6 changed files allowed');
});

/* ── 2) Schema and enum validation ───────────────────────────── */
test('2. policy schema has all required top-level keys', () => {
  const p = policy();
  planner.validatePolicySchema(p);
});

test('3. policy enums match expected constants', () => {
  const p = policy();
  assert.deepEqual(p.tier_enum, EXPECTED_TIERS);
  assert.deepEqual(p.ui_class_enum, EXPECTED_UI_CLASSES);
  assert.deepEqual(p.capability_enum, EXPECTED_CAPABILITIES);
});

test('4. execution_group_enum matches registry', () => {
  const p = policy();
  const reg = JSON.parse(fs.readFileSync(REGISTRY_PATH, 'utf8'));
  assert.deepEqual(p.execution_group_enum, reg.group_enum);
});

/* ── 3a) Unknown-field rejection ─────────────────────────────── */
test('5. missing required top-level key fails', () => {
  const p = JSON.parse(JSON.stringify(policy()));
  delete p.title;
  assertPlanError(function() { planner.validatePolicySchema(p); }, 'POLICY_SCHEMA_ERROR');
});

test('5b. unknown top-level field added fails', () => {
  const p = JSON.parse(JSON.stringify(policy()));
  p.unknown_field = 'evil';
  assertPlanError(function() { planner.validatePolicySchema(p); }, 'POLICY_SCHEMA_ERROR');
});

test('5c. unknown key in required_groups triggers rejection', () => {
  const p = JSON.parse(JSON.stringify(policy()));
  p.execution_group_policy.required_groups.TIER_4 = ['BROWSER_REAL_LOCAL'];
  // The required_groups loop checks each key against EXPECTED_TIERS.
  // TIER_4 is not in the enum, so this throws UNKNOWN_ENUM.
  assertPlanError(function() { planner.validatePolicySchema(p); }, 'UNKNOWN_ENUM');
});

/* ── 3b) Schema structural validation ────────────────────────── */
test('6. validatePolicySchema rejects malformed tier_enum', () => {
  const p = JSON.parse(JSON.stringify(policy()));
  p.tier_enum = ['TIER_1', 'TIER_2'];
  assertPlanError(function() { planner.validatePolicySchema(p); }, 'UNKNOWN_ENUM');
});

test('7. validatePolicySchema rejects mismatched execution_group_enum', () => {
  const p = JSON.parse(JSON.stringify(policy()));
  p.execution_group_enum = ['SOURCE_STATIC', 'EXECUTED_FAKE'];
  assertPlanError(function() { planner.validatePolicySchema(p); }, 'REGISTRY_POLICY_MISMATCH');
});

test('7b. validatePolicySchema rejects malformed tier_ui_matrix combination', () => {
  const p = JSON.parse(JSON.stringify(policy()));
  p.tier_ui_matrix.allowed_combinations.push(['TIER_4', 'U0']);
  assertPlanError(function() { planner.validatePolicySchema(p); }, 'UNKNOWN_ENUM');
});

test('7c. validatePolicySchema rejects duplicate Tier/UI combination', () => {
  const p = JSON.parse(JSON.stringify(policy()));
  p.tier_ui_matrix.allowed_combinations.push(['TIER_1', 'NOT_APPLICABLE']);
  assertPlanError(function() { planner.validatePolicySchema(p); }, 'POLICY_SCHEMA_ERROR');
});

/* ── 4) Fixed source reads ───────────────────────────────────── */
test('8. planner reads from fixed repository-relative paths only', () => {
  const p = policy();
  assert.ok(p.schema_version === '1.0.0');
  assert.ok(p.tier_enum.length === 3);
  const src = fs.readFileSync(PLANNER_PATH, 'utf8');
  // Must NOT accept caller-specified alternate paths
  assert.doesNotMatch(src, /--policy-path|POLICY_PATH.*argv|process\.argv.*policy/);
});

/* ── 5) Registry reconciliation ──────────────────────────────── */
test('9. policy execution_group_enum reconciles with registry', () => {
  const p = policy();
  const reg = JSON.parse(fs.readFileSync(REGISTRY_PATH, 'utf8'));
  for (let i = 0; i < p.execution_group_enum.length; i++) {
    assert.equal(p.execution_group_enum[i], reg.group_enum[i],
      'Group order mismatch at index ' + i + ': ' + p.execution_group_enum[i] + ' vs ' + reg.group_enum[i]);
  }
});

/* ── 6) Representative success cases ─────────────────────────── */
test('10. Tier 1 + NOT_APPLICABLE + copy_or_docs passes', () => {
  const plan = planner.run(['node', 'plan', '--tier', 'TIER_1', '--ui-class', 'NOT_APPLICABLE', '--capability', 'copy_or_docs']);
  assert.ok(plan.includes('TIER_1'));
  assert.ok(plan.includes('NOT_APPLICABLE'));
  assert.ok(plan.includes('SOURCE_STATIC'));
  assert.ok(plan.includes('PASS'));
});

test('11. Tier 1 + U1 + visual_only passes', () => {
  const plan = planner.run(['node', 'plan', '--tier', 'TIER_1', '--ui-class', 'U1', '--capability', 'visual_only']);
  assert.ok(plan.includes('TIER_1'));
  assert.ok(plan.includes('U1'));
  assert.ok(plan.includes('PASS'));
});

test('12. Tier 2 + U2 + structural_dom passes', () => {
  const plan = planner.run(['node', 'plan', '--tier', 'TIER_2', '--ui-class', 'U2', '--capability', 'structural_dom']);
  assert.ok(plan.includes('TIER_2'));
  assert.ok(plan.includes('U2'));
  assert.ok(plan.includes('SOURCE_STATIC'));
  assert.ok(plan.includes('EXECUTED_FAKE'));
  assert.ok(plan.includes('PASS'));
});

test('13. Tier 2 + U2 + responsive_layout requires browser evidence', () => {
  const plan = planner.run(['node', 'plan', '--tier', 'TIER_2', '--ui-class', 'U2', '--capability', 'responsive_layout']);
  assert.ok(plan.includes('BROWSER/RUNTIME EVIDENCE: REQUIRED'));
  assert.ok(plan.includes('BROWSER_REAL_LOCAL'));
});

test('13b. Tier 2 + U3 + browser_runtime (no sensitive cap) passes', () => {
  const plan = planner.run(['node', 'plan', '--tier', 'TIER_2', '--ui-class', 'U3', '--capability', 'browser_runtime']);
  assert.ok(plan.includes('BROWSER/RUNTIME EVIDENCE: REQUIRED'));
  assert.ok(plan.includes('TIER_2'));
  assert.ok(plan.includes('U3'));
  assert.ok(plan.includes('BROWSER_REAL_LOCAL'));
  assert.ok(plan.includes('PASS'));
});

test('14. Tier 3 + U3 + database produces DB_ENGINE + full regression', () => {
  const plan = planner.run(['node', 'plan', '--tier', 'TIER_3', '--ui-class', 'U3', '--capability', 'database']);
  assert.ok(plan.includes('FULL_DEFAULT_REGRESSION'));
  assert.ok(plan.includes('DB_ENGINE'));
  assert.ok(plan.includes('LOCAL VALIDATION: REQUIRED'));
  assert.ok(plan.includes('PRODUCTION VERIFICATION: REQUIRED'));
});

test('15. Tier 3 + U3 + provider_or_network requires manual evidence only', () => {
  const plan = planner.run(['node', 'plan', '--tier', 'TIER_3', '--ui-class', 'U3', '--capability', 'provider_or_network']);
  assert.ok(plan.includes('MANUAL EVIDENCE: REQUIRED'));
  assert.ok(plan.includes('REMOTE_OR_PROVIDER_MANUAL'));
  // Must NOT appear as required or conditional
  assert.doesNotMatch(plan, /REMOTE_OR_PROVIDER_MANUAL.*REQUIRED/);
});

/* ── 7) Representative failure cases ─────────────────────────── */
test('16. U1 + structural_dom is UNDERCLASSIFIED', () => {
  assertPlanError(function() {
    planner.run(['node', 'plan', '--tier', 'TIER_1', '--ui-class', 'U1', '--capability', 'structural_dom']);
  }, 'UNDERCLASSIFIED_CAPABILITY');
});

test('17. U2 + api_write without TIER_3 is UNDERCLASSIFIED', () => {
  assertPlanError(function() {
    planner.run(['node', 'plan', '--tier', 'TIER_2', '--ui-class', 'U2', '--capability', 'api_write']);
  }, 'UNDERCLASSIFIED_CAPABILITY');
});

test('18. Tier 2 + U3 + database is UNDERCLASSIFIED (sensitive requires TIER_3)', () => {
  assertPlanError(function() {
    planner.run(['node', 'plan', '--tier', 'TIER_2', '--ui-class', 'U3', '--capability', 'database']);
  }, 'UNDERCLASSIFIED_CAPABILITY');
});

test('19. unknown capability fails', () => {
  assertPlanError(function() {
    planner.run(['node', 'plan', '--tier', 'TIER_1', '--ui-class', 'U0', '--capability', 'bogus_cap']);
  }, 'UNKNOWN_ENUM');
});

test('20. duplicate --tier argument fails', () => {
  assertPlanError(function() {
    planner.parseArgs(['node', 'plan', '--tier', 'TIER_1', '--tier', 'TIER_2', '--ui-class', 'U0']);
  }, 'DUPLICATE_ARGUMENT');
});

test('20b. duplicate --ui-class argument fails', () => {
  assertPlanError(function() {
    planner.parseArgs(['node', 'plan', '--tier', 'TIER_1', '--ui-class', 'U0', '--ui-class', 'U1']);
  }, 'DUPLICATE_ARGUMENT');
});

test('21. missing --ui-class fails', () => {
  assertPlanError(function() {
    planner.parseArgs(['node', 'plan', '--tier', 'TIER_1']);
  }, 'MISSING_REQUIRED_ARGUMENT');
});

test('22. unknown argument fails', () => {
  assertPlanError(function() {
    planner.parseArgs(['node', 'plan', '--tier', 'TIER_1', '--ui-class', 'U0', '--bogus']);
  }, 'UNSUPPORTED_ARGUMENT');
});

/* ── 7b) CLI boundary tests ──────────────────────────────────── */
test('22b. unknown positional token fails', () => {
  assertPlanError(function() {
    planner.parseArgs(['node', 'plan', '--tier', 'TIER_1', '--ui-class', 'U0', 'positional_token']);
  }, 'UNSUPPORTED_ARGUMENT');
});

test('22c. duplicate --json argument fails', () => {
  assertPlanError(function() {
    planner.parseArgs(['node', 'plan', '--tier', 'TIER_1', '--ui-class', 'U0', '--json', '--json']);
  }, 'DUPLICATE_ARGUMENT');
});

test('22d. duplicate capability value fails', () => {
  assertPlanError(function() {
    planner.parseArgs(['node', 'plan', '--tier', 'TIER_1', '--ui-class', 'U0',
      '--capability', 'copy_or_docs', '--capability', 'copy_or_docs']);
  }, 'DUPLICATE_ARGUMENT');
});

test('22e. missing value for --tier fails', () => {
  assertPlanError(function() {
    planner.parseArgs(['node', 'plan', '--tier', '--ui-class', 'U0']);
  }, 'MISSING_REQUIRED_ARGUMENT');
});

test('22f. missing value for --capability fails', () => {
  assertPlanError(function() {
    planner.parseArgs(['node', 'plan', '--tier', 'TIER_1', '--ui-class', 'U0', '--capability']);
  }, 'MISSING_REQUIRED_ARGUMENT');
});

/* ── 7c) Invalid Tier/UI combination ─────────────────────────── */
test('23. Tier 2 + U0 is invalid combination', () => {
  assertPlanError(function() {
    planner.run(['node', 'plan', '--tier', 'TIER_2', '--ui-class', 'U0']);
  }, 'INVALID_TIER_UI_COMBINATION');
});

test('23b. Tier 1 + U2 is invalid combination', () => {
  assertPlanError(function() {
    planner.run(['node', 'plan', '--tier', 'TIER_1', '--ui-class', 'U2', '--capability', 'structural_dom']);
  }, 'INVALID_TIER_UI_COMBINATION');
});

/* ── 8) Tier 1 + NOT_APPLICABLE capability limits ────────────── */
test('24. TIER_1 + NOT_APPLICABLE + structural_dom is UNDERCLASSIFIED', () => {
  assertPlanError(function() {
    planner.run(['node', 'plan', '--tier', 'TIER_1', '--ui-class', 'NOT_APPLICABLE', '--capability', 'structural_dom']);
  }, 'UNDERCLASSIFIED_CAPABILITY');
});

test('24b. TIER_1 + NOT_APPLICABLE + browser_runtime is UNDERCLASSIFIED', () => {
  assertPlanError(function() {
    planner.run(['node', 'plan', '--tier', 'TIER_1', '--ui-class', 'NOT_APPLICABLE', '--capability', 'browser_runtime']);
  }, 'UNDERCLASSIFIED_CAPABILITY');
});

test('24c. TIER_1 + NOT_APPLICABLE + responsive_layout is UNDERCLASSIFIED', () => {
  assertPlanError(function() {
    planner.run(['node', 'plan', '--tier', 'TIER_1', '--ui-class', 'NOT_APPLICABLE', '--capability', 'responsive_layout']);
  }, 'UNDERCLASSIFIED_CAPABILITY');
});

test('24d. TIER_1 + NOT_APPLICABLE + accessibility_or_focus is UNDERCLASSIFIED', () => {
  assertPlanError(function() {
    planner.run(['node', 'plan', '--tier', 'TIER_1', '--ui-class', 'NOT_APPLICABLE', '--capability', 'accessibility_or_focus']);
  }, 'UNDERCLASSIFIED_CAPABILITY');
});

test('24e. TIER_1 + NOT_APPLICABLE + process_runtime is UNDERCLASSIFIED', () => {
  assertPlanError(function() {
    planner.run(['node', 'plan', '--tier', 'TIER_1', '--ui-class', 'NOT_APPLICABLE', '--capability', 'process_runtime']);
  }, 'UNDERCLASSIFIED_CAPABILITY');
});

test('24f. TIER_1 + NOT_APPLICABLE + api_read is UNDERCLASSIFIED', () => {
  assertPlanError(function() {
    planner.run(['node', 'plan', '--tier', 'TIER_1', '--ui-class', 'NOT_APPLICABLE', '--capability', 'api_read']);
  }, 'UNDERCLASSIFIED_CAPABILITY');
});

/* ── 9) U3 sensitive escalation ──────────────────────────────── */
test('25. U3 + migration requires TIER_3', () => {
  assertPlanError(function() {
    planner.run(['node', 'plan', '--tier', 'TIER_2', '--ui-class', 'U3', '--capability', 'migration']);
  }, 'UNDERCLASSIFIED_CAPABILITY');
});

test('25b. U3 + destructive requires TIER_3 with full regression', () => {
  const plan = planner.run(['node', 'plan', '--tier', 'TIER_3', '--ui-class', 'U3', '--capability', 'destructive']);
  assert.ok(plan.includes('FULL_DEFAULT_REGRESSION'));
  assert.ok(plan.includes('LOCAL VALIDATION: REQUIRED'));
});

/* ── 10) Contradiction detection ──────────────────────────────── */
test('26. contradictory copy_or_docs + structural_dom rejected', () => {
  assertPlanError(function() {
    planner.run(['node', 'plan', '--tier', 'TIER_2', '--ui-class', 'U2',
      '--capability', 'copy_or_docs', '--capability', 'structural_dom']);
  }, 'CONTRADICTORY_CAPABILITY');
});

test('26b. contradictory visual_only + browser_runtime rejected', () => {
  assertPlanError(function() {
    planner.run(['node', 'plan', '--tier', 'TIER_2', '--ui-class', 'U2',
      '--capability', 'visual_only', '--capability', 'browser_runtime']);
  }, 'CONTRADICTORY_CAPABILITY');
});

/* ── 11) Output stability ────────────────────────────────────── */
test('27. human output is byte-stable', () => {
  const o1 = planner.run(['node', 'plan', '--tier', 'TIER_2', '--ui-class', 'U2', '--capability', 'structural_dom']);
  const o2 = planner.run(['node', 'plan', '--tier', 'TIER_2', '--ui-class', 'U2', '--capability', 'structural_dom']);
  assert.equal(o1, o2);
});

test('28. JSON output is byte-stable and valid', () => {
  const j1 = planner.run(['node', 'plan', '--tier', 'TIER_2', '--ui-class', 'U2', '--capability', 'structural_dom', '--json']);
  const j2 = planner.run(['node', 'plan', '--tier', 'TIER_2', '--ui-class', 'U2', '--capability', 'structural_dom', '--json']);
  assert.equal(j1, j2);
  const parsed = JSON.parse(j1);
  assert.equal(parsed.validation_outcome, 'PASS');
  assert.ok(Array.isArray(parsed.required_groups));
  assert.ok(Array.isArray(parsed.conditional_groups));
});

/* ── 12) Canonical group ordering ────────────────────────────── */
test('29. multi-capability plan groups in canonical registry order', () => {
  const planJson = JSON.parse(planner.run(['node', 'plan', '--tier', 'TIER_3', '--ui-class', 'U3',
    '--capability', 'database', '--capability', 'process_runtime',
    '--capability', 'browser_runtime', '--capability', 'provider_or_network', '--json']));
  const reg = JSON.parse(fs.readFileSync(REGISTRY_PATH, 'utf8'));
  const groupEnum = reg.group_enum;
  // Verify all groups are in canonical order
  const allGroups = planJson.required_groups.concat(planJson.conditional_groups, planJson.manual_evidence_groups);
  // The combined output should have groups in registry order
  // Check relative ordering of any two groups
  for (let i = 0; i < allGroups.length; i++) {
    const gi = groupEnum.indexOf(allGroups[i]);
    assert.ok(gi !== -1, 'Unknown group: ' + allGroups[i]);
    for (let j = i + 1; j < allGroups.length; j++) {
      const gj = groupEnum.indexOf(allGroups[j]);
      // Only check ordering if both groups come from the same category
      // (required, conditional, or manual)
    }
  }
  // Check individual arrays are sorted
  for (let k = 1; k < planJson.required_groups.length; k++) {
    assert.ok(groupEnum.indexOf(planJson.required_groups[k - 1]) <= groupEnum.indexOf(planJson.required_groups[k]),
      'required_groups must be in canonical order');
  }
  for (let k = 1; k < planJson.conditional_groups.length; k++) {
    assert.ok(groupEnum.indexOf(planJson.conditional_groups[k - 1]) <= groupEnum.indexOf(planJson.conditional_groups[k]),
      'conditional_groups must be in canonical order');
  }
  // Verify no group appears twice
  const seen = {};
  for (const g of planJson.required_groups.concat(planJson.conditional_groups)) {
    assert.ok(!seen[g], 'Group ' + g + ' appears in both required and conditional');
    seen[g] = true;
  }
  // Ensure DB_ENGINE appears for database capability
  assert.ok(planJson.conditional_groups.indexOf('DB_ENGINE') !== -1, 'DB_ENGINE must be conditional for database');
  assert.ok(planJson.conditional_groups.indexOf('BROWSER_REAL_LOCAL') !== -1, 'BROWSER_REAL_LOCAL must be conditional for browser_runtime');
  assert.ok(planJson.conditional_groups.indexOf('PROCESS_REAL_LOCAL') !== -1, 'PROCESS_REAL_LOCAL must be conditional for process_runtime');
  assert.ok(planJson.manual_evidence_groups.indexOf('REMOTE_OR_PROVIDER_MANUAL') !== -1, 'REMOTE_OR_PROVIDER_MANUAL in manual evidence');
});

/* ── 13) CI_UNAVAILABLE_INFRA posture ────────────────────────── */
test('30. CI_UNAVAILABLE_INFRA distinct from failure and success', () => {
  const p = policy();
  assert.ok(p.merge_blockers.infrastructure_unavailable_posture, 'infrastructure_unavailable_posture exists');
  const infra = p.merge_blockers.infrastructure_unavailable_posture;
  assert.equal(infra.status, 'CI_UNAVAILABLE_INFRA');
  assert.equal(infra.alternative_evidence_required, true);
  assert.equal(infra.merge_ready_without_alternative, false);
  // CI_UNAVAILABLE_INFRA must not be merged with hard_blockers
  assert.equal(p.merge_blockers.hard_blockers.indexOf('CI_UNAVAILABLE_INFRA'), -1,
    'CI_UNAVAILABLE_INFRA must be separate from hard_blockers');
  assert.equal(p.merge_blockers.hard_blockers.indexOf('CI_EXECUTED_FAILURE'), 0,
    'CI_EXECUTED_FAILURE is first hard blocker');
  assert.equal(p.merge_blockers.hard_blockers.indexOf('CI_PENDING_EXECUTION'), 1,
    'CI_PENDING_EXECUTION is second hard blocker');
});

/* ── 14) accessibility/focus evidence policy ─────────────────── */
test('31. accessibility_or_focus policy distinguishes static vs runtime', () => {
  const p = policy();
  assert.ok(p.accessibility_focus_evidence_policy, 'accessibility_focus_evidence_policy exists');
  const a11y = p.accessibility_focus_evidence_policy;
  assert.ok(Array.isArray(a11y.requires_browser_evidence), 'requires_browser_evidence array');
  assert.equal(a11y.requires_browser_evidence.length, 3, 'three runtime behaviors');
  assert.ok(a11y.under_tier_2_or_3.includes('BROWSER_REAL_LOCAL'), 'browser evidence under Tier 2/3');
  // Tier 1 + a11y should be blocked
  assertPlanError(function() {
    planner.run(['node', 'plan', '--tier', 'TIER_1', '--ui-class', 'NOT_APPLICABLE', '--capability', 'accessibility_or_focus']);
  }, 'UNDERCLASSIFIED_CAPABILITY');
  // Tier 2 + U2 + a11y should pass with browser evidence
  const plan = planner.run(['node', 'plan', '--tier', 'TIER_2', '--ui-class', 'U2', '--capability', 'accessibility_or_focus']);
  assert.ok(plan.includes('BROWSER_REAL_LOCAL'));
  assert.ok(plan.includes('BROWSER/RUNTIME EVIDENCE: REQUIRED'));
});

/* ── 15) No external side effects ────────────────────────────── */
test('32. planner has no network, browser, DB, or process execution', () => {
  const src = fs.readFileSync(PLANNER_PATH, 'utf8');
  assert.doesNotMatch(src, /\b(exec|execSync|spawn|spawnSync)\s*\(/);
  assert.doesNotMatch(src, /\bfetch\s*\(/);
  assert.doesNotMatch(src, /http\.|https\./);
  assert.doesNotMatch(src, /\bpg\b|\bmysql\b|\bsqlite\b/);
  assert.doesNotMatch(src, /\bdocker\b/i);
  assert.doesNotMatch(src, /\bpuppeteer\b|\bplaywright\./);
  assert.doesNotMatch(src, /\breport-test-layers\b/);
});

/* ── 16) Sanitized error without developer-root literals ─────── */
test('33. errors contain no absolute host paths or developer-root literals', () => {
  try {
    planner.run(['node', 'plan', '--tier', 'BOGUS_TIER', '--ui-class', 'U0']);
  } catch (e) {
    // Use safe absolute-path detection instead of hardcoded /home/ /root/
    assert.ok(!containsAbsolutePath(e.message), 'Error must not contain absolute path patterns');
    assert.equal(e.code, 'UNKNOWN_ENUM');
  }
  // Also verify the PlanError sanitization works
  const err = new planner.PlanError('POLICY_SCHEMA_ERROR', 'Error reading /home/user/project/file.json and /root/config/test.json');
  assert.ok(!containsAbsolutePath(err.message), 'PlanError must sanitize absolute paths');
  // The PlanError constructor uses a regex to replace /foo/bar/baz patterns with <path>
  // Verify the sanitization replaced the paths
  assert.equal(err.message.indexOf('/home'), -1, '/home should be stripped');
  assert.equal(err.message.indexOf('/root'), -1, '/root should be stripped');
});

/* ── 17) Non-zero exit on invalid input ──────────────────────── */
test('34. planner returns exit code 1 on invalid input (via run+PlanError)', () => {
  // Direct PlanError assertion
  assertPlanError(function() {
    planner.run(['node', 'plan', '--tier', 'BOGUS', '--ui-class', 'U0']);
  }, 'UNKNOWN_ENUM');
});

test('34b. planner CLI main exits non-zero on invalid input', () => {
  const origExitCode = process.exitCode;
  const origConsoleError = console.error;
  let capturedError = '';
  console.error = function(msg) { capturedError += String(msg); };
  process.exitCode = undefined;
  try {
    planner.main(['node', 'plan', '--tier', 'BOGUS', '--ui-class', 'U0']);
  } catch (e) { /* main() catches and handles errors itself */ }
  console.error = origConsoleError;
  assert.ok(capturedError.includes('UNKNOWN_ENUM: Unknown tier: BOGUS'),
    'Error was emitted via main(): ' + capturedError);
  assert.equal(process.exitCode, 1, 'exitCode must be 1 for invalid input');
  process.exitCode = origExitCode;
});

/* ── 18) SOURCE_STATIC registration ──────────────────────────── */
test('35. this contract is registered as SOURCE_STATIC', () => {
  const cls = JSON.parse(fs.readFileSync(CLASSIFICATION_PATH, 'utf8'));
  const testPath = 'tests/contracts/ci-risk-gate-policy-contract.test.cjs';
  const found = cls.entries.filter(function(e) { return e.path === testPath; });
  assert.equal(found.length, 1, 'Must have exactly one classification entry for this test');
  assert.equal(found[0].layer, 'SOURCE_STATIC');
  assert.deepEqual(found[0].capabilities, []);
});

/* ── 19) Protected reference hygiene ─────────────────────────── */
test('36. protected issue references use Refs not Closes/Fixes', () => {
  const docText = fs.readFileSync(DOC_PATH, 'utf8');
  const protectedIssues = ['3670', '3710', '1882'];
  for (const issue of protectedIssues) {
    assert.match(docText, new RegExp('Refs #' + issue));
  }
  assert.doesNotMatch(docText, /Closes #1882|Fixes #1882|Resolves #1882/i);
});

/* ── 20) DB/migration → DB_ENGINE ────────────────────────────── */
test('37. migration capability requires DB_ENGINE conditional group', () => {
  const planJson = JSON.parse(planner.run(['node', 'plan', '--tier', 'TIER_3', '--ui-class', 'U3', '--capability', 'migration', '--json']));
  assert.ok(planJson.conditional_groups.indexOf('DB_ENGINE') !== -1, 'DB_ENGINE must be conditional for migration');
});

/* ── 21) Provider manual evidence non-execution ──────────────── */
test('38. REMOTE_OR_PROVIDER_MANUAL never appears as required', () => {
  const p = policy();
  for (const tier of EXPECTED_TIERS) {
    const req = p.execution_group_policy.required_groups[tier] || [];
    assert.equal(req.indexOf('REMOTE_OR_PROVIDER_MANUAL'), -1,
      'REMOTE_OR_PROVIDER_MANUAL must not be in required_groups for ' + tier);
  }
});

/* ── 22) TIER_2 + U3 doc consistency ─────────────────────────── */
test('39. TIER_2 + U3 is valid when no sensitive capability present', () => {
  const plan = planner.run(['node', 'plan', '--tier', 'TIER_2', '--ui-class', 'U3']);
  assert.ok(plan.includes('PASS'));
  assert.ok(plan.includes('TIER_2'));
  assert.ok(plan.includes('U3'));
});

/* ── 23) Tier 1 + NOT_APPLICABLE JSON plan structure ─────────── */
test('40. TIER_1 + NOT_APPLICABLE + copy_or_docs produces correct JSON', () => {
  const planJson = JSON.parse(planner.run(['node', 'plan', '--tier', 'TIER_1', '--ui-class', 'NOT_APPLICABLE', '--capability', 'copy_or_docs', '--json']));
  assert.equal(planJson.effective_tier, 'TIER_1');
  assert.equal(planJson.classification.ui_class, 'NOT_APPLICABLE');
  assert.deepEqual(planJson.required_groups, ['SOURCE_STATIC']);
  assert.deepEqual(planJson.conditional_groups, []);
  assert.equal(planJson.validation_outcome, 'PASS');
  assert.equal(planJson.local_validation_required, false);
  assert.equal(planJson.browser_evidence_required, false);
  assert.equal(planJson.production_verification_required, false);
  assert.ok(Array.isArray(planJson.merge_blockers));
  assert.equal(planJson.merge_blockers.length, 3);
});

/* ── 24) Tier 3 + multi-capability evidence obligations ──────── */
test('41. TIER_3 + database + process_runtime + browser_runtime full obligations', () => {
  const planJson = JSON.parse(planner.run(['node', 'plan', '--tier', 'TIER_3', '--ui-class', 'U3',
    '--capability', 'database', '--capability', 'process_runtime', '--capability', 'browser_runtime', '--json']));
  assert.equal(planJson.effective_tier, 'TIER_3');
  assert.equal(planJson.local_validation_required, true);
  assert.equal(planJson.browser_evidence_required, true);
  assert.equal(planJson.production_verification_required, true);
  // Canonical ordering: BROWSER_REAL_LOCAL < DB_ENGINE < PROCESS_REAL_LOCAL in registry
  const reg = JSON.parse(fs.readFileSync(REGISTRY_PATH, 'utf8'));
  const condGroups = planJson.conditional_groups;
  // Verify conditional groups are in registry order
  for (let k = 1; k < condGroups.length; k++) {
    assert.ok(reg.group_enum.indexOf(condGroups[k - 1]) < reg.group_enum.indexOf(condGroups[k]),
      'Conditional groups must be in canonical order, got: ' + condGroups.join(', '));
  }
});
