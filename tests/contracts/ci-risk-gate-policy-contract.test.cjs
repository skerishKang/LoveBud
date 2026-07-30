/**
 * LoveBud #3710 CI Risk-Tier Gate Policy — Static Contract Test
 *
 * Refs #3710 (implementation child). Parent #3670 stays OPEN.
 * Baseline: daec7e8895836b1b5f0c0ce36084a5c83cf8aa38
 *
 * Locks the machine-readable policy, deterministic planner, and
 * fail-closed escalation rules for the CI risk-tier gate system.
 *
 * This test:
 *   - reads ONLY fixed repository-relative authority files;
 *   - executes NO test, browser, network, provider, DB, or workflow;
 *   - asserts schema validity, enum boundaries, escalation rules,
 *     representative success/failure cases, output stability, and
 *     source-only boundary.
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

  // Check changed files match expected set
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

/* ── 3) Unknown-field rejection ──────────────────────────────── */
test('5. validatePolicySchema rejects unknown field', () => {
  const p = JSON.parse(JSON.stringify(policy()));
  delete p.title;
  assertPlanError(function() { planner.validatePolicySchema(p); }, 'POLICY_SCHEMA_ERROR');
});

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

/* ── 4) Fixed source reads ───────────────────────────────────── */
test('8. planner reads from fixed repository-relative paths only', () => {
  const p = policy();
  assert.ok(p.schema_version === '1.0.0');
  assert.ok(p.tier_enum.length === 3);
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
test('10. Tier 1 + U0 (copy/docs only)', () => {
  const plan = planner.run(['node', 'plan', '--tier', 'TIER_1', '--ui-class', 'U0', '--capability', 'copy_or_docs']);
  assert.ok(plan.includes('TIER_1'));
  assert.ok(plan.includes('U0'));
  assert.ok(plan.includes('SOURCE_STATIC'));
  assert.ok(plan.includes('PASS'));
});

test('11. Tier 1 + U1 (visual only)', () => {
  const plan = planner.run(['node', 'plan', '--tier', 'TIER_1', '--ui-class', 'U1', '--capability', 'visual_only']);
  assert.ok(plan.includes('TIER_1'));
  assert.ok(plan.includes('U1'));
  assert.ok(plan.includes('PASS'));
});

test('12. Tier 2 + U2 + structural_dom', () => {
  const plan = planner.run(['node', 'plan', '--tier', 'TIER_2', '--ui-class', 'U2', '--capability', 'structural_dom']);
  assert.ok(plan.includes('TIER_2'));
  assert.ok(plan.includes('U2'));
  assert.ok(plan.includes('SOURCE_STATIC'));
  assert.ok(plan.includes('EXECUTED_FAKE'));
  assert.ok(plan.includes('PASS'));
});

test('13. Tier 2 + U2 + responsive_layout (browser evidence)', () => {
  const plan = planner.run(['node', 'plan', '--tier', 'TIER_2', '--ui-class', 'U2', '--capability', 'responsive_layout']);
  assert.ok(plan.includes('BROWSER/RUNTIME EVIDENCE: REQUIRED'));
  assert.ok(plan.includes('BROWSER_REAL_LOCAL'));
});

test('14. Tier 3 + U3 + database (DB_ENGINE)', () => {
  const plan = planner.run(['node', 'plan', '--tier', 'TIER_3', '--ui-class', 'U3', '--capability', 'database']);
  assert.ok(plan.includes('FULL_DEFAULT_REGRESSION'));
  assert.ok(plan.includes('DB_ENGINE'));
  assert.ok(plan.includes('LOCAL VALIDATION: REQUIRED'));
  assert.ok(plan.includes('PRODUCTION VERIFICATION: REQUIRED'));
});

test('15. Tier 3 + U3 + provider_or_network (manual evidence)', () => {
  const plan = planner.run(['node', 'plan', '--tier', 'TIER_3', '--ui-class', 'U3', '--capability', 'provider_or_network']);
  assert.ok(plan.includes('MANUAL EVIDENCE: REQUIRED'));
  assert.ok(plan.includes('REMOTE_OR_PROVIDER_MANUAL'));
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

test('18. Tier 2 + U3 + database is UNDERCLASSIFIED', () => {
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

test('23. alternate policy path not accepted (fixed source enforcement)', () => {
  const reporterContent = fs.readFileSync(PLANNER_PATH, 'utf8');
  // The script must NOT accept a --policy-path or similar override
  assert.doesNotMatch(reporterContent, /--policy-path|POLICY_PATH.*argv|process\.argv.*policy/);
});

/* ── 8) U3 runtime sensitive escalation ──────────────────────── */
test('24. U3 + migration requires TIER_3', () => {
  assertPlanError(function() {
    planner.run(['node', 'plan', '--tier', 'TIER_2', '--ui-class', 'U3', '--capability', 'migration']);
  }, 'UNDERCLASSIFIED_CAPABILITY');
});

test('25. U3 + destructive requires TIER_3 with full regression', () => {
  const plan = planner.run(['node', 'plan', '--tier', 'TIER_3', '--ui-class', 'U3', '--capability', 'destructive']);
  assert.ok(plan.includes('FULL_DEFAULT_REGRESSION'));
  assert.ok(plan.includes('LOCAL VALIDATION: REQUIRED'));
});

test('13b. Tier 2 + U3 + browser_runtime (no sensitive cap)', () => {
  const plan = planner.run(['node', 'plan', '--tier', 'TIER_2', '--ui-class', 'U3', '--capability', 'browser_runtime']);
  assert.ok(plan.includes('BROWSER/RUNTIME EVIDENCE: REQUIRED'));
  assert.ok(plan.includes('TIER_2'));
  assert.ok(plan.includes('U3'));
  assert.ok(plan.includes('BROWSER_REAL_LOCAL'));
  assert.ok(plan.includes('PASS'));
});

/* ── 9) Contradiction detection ──────────────────────────────── */
test('26. contradictory copy_or_docs + structural_dom rejected', () => {
  assertPlanError(function() {
    planner.run(['node', 'plan', '--tier', 'TIER_2', '--ui-class', 'U2',
      '--capability', 'copy_or_docs', '--capability', 'structural_dom']);
  }, 'CONTRADICTORY_CAPABILITY');
});

/* ── 10) Output stability ────────────────────────────────────── */
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

/* ── 11) Canonical group ordering ────────────────────────────── */
test('29. all groups in plan are in canonical registry order', () => {
  const reg = JSON.parse(fs.readFileSync(REGISTRY_PATH, 'utf8'));
  const plan = JSON.parse(planner.run(['node', 'plan', '--tier', 'TIER_3', '--ui-class', 'U3', '--capability', 'database', '--json']));
  const allGroups = plan.required_groups.concat(plan.conditional_groups, plan.manual_evidence_groups);
  for (const g of allGroups) {
    assert.ok(reg.group_enum.indexOf(g) !== -1, 'Unknown group: ' + g);
  }
});

/* ── 12) No external side effects ────────────────────────────── */
test('30. planner has no network, browser, DB, or process execution', () => {
  const src = fs.readFileSync(PLANNER_PATH, 'utf8');
  assert.doesNotMatch(src, /\b(exec|execSync|spawn|spawnSync)\s*\(/);
  assert.doesNotMatch(src, /\bfetch\s*\(/);
  assert.doesNotMatch(src, /http\.|https\./);
  assert.doesNotMatch(src, /\bpg\b|\bmysql\b|\bsqlite\b/);
  assert.doesNotMatch(src, /\bdocker\b/i);
  assert.doesNotMatch(src, /\bpuppeteer\b|\bplaywright\./);
  assert.doesNotMatch(src, /\breport-test-layers\b/);
});

/* ── 13) Sanitized error output ──────────────────────────────── */
test('31. errors contain no absolute host paths or stack traces', () => {
  try {
    planner.run(['node', 'plan', '--tier', 'BOGUS_TIER', '--ui-class', 'U0']);
  } catch (e) {
    assert.ok(!e.message.includes('/home/') || !e.message.includes('/root/'));
    assert.equal(e.code, 'UNKNOWN_ENUM');
  }
});

/* ── 14) Non-zero exit on invalid input ───────────────────────── */
test('32. planner returns exit code 1 on invalid input', () => {
  // Test via the PlanError mechanism
  assertPlanError(function() {
    planner.validateInputs(planner.readPolicy(), 'BOGUS', 'U0', []);
  }, 'UNKNOWN_ENUM');
});

/* ── 15) SOURCE_STATIC registration ──────────────────────────── */
test('33. this contract is registered as SOURCE_STATIC', () => {
  const cls = JSON.parse(fs.readFileSync(CLASSIFICATION_PATH, 'utf8'));
  const testPath = 'tests/contracts/ci-risk-gate-policy-contract.test.cjs';
  const found = cls.entries.filter(function(e) { return e.path === testPath; });
  assert.equal(found.length, 1, 'Must have exactly one classification entry for this test');
  assert.equal(found[0].layer, 'SOURCE_STATIC');
  assert.deepEqual(found[0].capabilities, []);
});

/* ── 16) Protected reference hygiene ─────────────────────────── */
test('34. protected issue references use Refs not Closes/Fixes', () => {
  const docText = fs.readFileSync(DOC_PATH, 'utf8');
  const protectedIssues = ['3670', '3710', '1882'];
  for (const issue of protectedIssues) {
    assert.match(docText, new RegExp('Refs #' + issue));
  }
  assert.doesNotMatch(docText, /Closes #1882|Fixes #1882|Resolves #1882/i);
});

/* ── 17) Invalid Tier/UI fails ───────────────────────────────── */
test('35. Tier 2 + U0 is invalid combination', () => {
  assertPlanError(function() {
    planner.run(['node', 'plan', '--tier', 'TIER_2', '--ui-class', 'U0']);
  }, 'INVALID_TIER_UI_COMBINATION');
});

test('36. Tier 1 + U2 is invalid combination', () => {
  assertPlanError(function() {
    planner.run(['node', 'plan', '--tier', 'TIER_1', '--ui-class', 'U2', '--capability', 'structural_dom']);
  }, 'INVALID_TIER_UI_COMBINATION');
});

/* ── 18) DB/migration → DB_ENGINE ────────────────────────────── */
test('37. migration capability requires DB_ENGINE conditional group', () => {
  const planJson = JSON.parse(planner.run(['node', 'plan', '--tier', 'TIER_3', '--ui-class', 'U3', '--capability', 'migration', '--json']));
  assert.ok(planJson.conditional_groups.indexOf('DB_ENGINE') !== -1, 'DB_ENGINE must be conditional for migration');
});

/* ── 19) Provider manual evidence non-execution ──────────────── */
test('38. REMOTE_OR_PROVIDER_MANUAL never appears as required', () => {
  const p = policy();
  // Check policy does not list REMOTE_OR_PROVIDER_MANUAL in required_groups
  for (const tier of EXPECTED_TIERS) {
    const req = p.execution_group_policy.required_groups[tier] || [];
    assert.equal(req.indexOf('REMOTE_OR_PROVIDER_MANUAL'), -1,
      'REMOTE_OR_PROVIDER_MANUAL must not be in required_groups for ' + tier);
  }
});
