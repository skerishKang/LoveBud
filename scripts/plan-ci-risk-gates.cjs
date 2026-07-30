#!/usr/bin/env node
/**
 * LoveBud CI Risk-Tier Gate Planner — scripts/plan-ci-risk-gates.cjs
 *
 * Machine-readable gate planner that reads tests/ci-risk-gate-policy.json
 * and produces a deterministic execution-group plan for a given Tier/UI/
 * capability combination.
 *
 * Issue #3710 — Parent #3670
 *
 * This script:
 *   - reads ONLY fixed repository-relative authority files (never caller paths);
 *   - does NOT execute any test, browser, network, provider, DB, or workflow;
 *   - does NOT expose host paths, credentials, or private URLs in errors.
 */

'use strict';

const fs = require('fs');
const path = require('path');

const ROOT = __dirname;
const POLICY_REL = path.join('..', 'tests', 'ci-risk-gate-policy.json');
const POLICY_PATH = path.resolve(ROOT, POLICY_REL);
const REGISTRY_REL = path.join('..', 'tests', 'ci-test-group-registry.json');
const REGISTRY_PATH = path.resolve(ROOT, REGISTRY_REL);

const ERROR_CODES = {
  POLICY_PARSE_ERROR: 'POLICY_PARSE_ERROR',
  POLICY_SCHEMA_ERROR: 'POLICY_SCHEMA_ERROR',
  UNKNOWN_ENUM: 'UNKNOWN_ENUM',
  UNSUPPORTED_ARGUMENT: 'UNSUPPORTED_ARGUMENT',
  DUPLICATE_ARGUMENT: 'DUPLICATE_ARGUMENT',
  MISSING_REQUIRED_ARGUMENT: 'MISSING_REQUIRED_ARGUMENT',
  INVALID_TIER_UI_COMBINATION: 'INVALID_TIER_UI_COMBINATION',
  UNDERCLASSIFIED_CAPABILITY: 'UNDERCLASSIFIED_CAPABILITY',
  CONTRADICTORY_CAPABILITY: 'CONTRADICTORY_CAPABILITY',
  UNKNOWN_EXECUTION_GROUP: 'UNKNOWN_EXECUTION_GROUP',
  REGISTRY_POLICY_MISMATCH: 'REGISTRY_POLICY_MISMATCH',
  UNSAFE_AUTOMATIC_EXECUTION: 'UNSAFE_AUTOMATIC_EXECUTION',
};

class PlanError extends Error {
  constructor(code, message) {
    super(code + ': ' + String(message || '').replace(/\/[\w.\/-]+\/[\w.\/-]+/g, '<path>'));
    this.code = code;
    this.name = 'PlanError';
  }
}

const EXPECTED_TOP_KEYS = [
  'schema_version', 'title', 'description', 'tier_enum', 'ui_class_enum',
  'capability_enum', 'tier_1_not_applicable_allowed_capabilities',
  'sensitive_capabilities', 'execution_group_enum', 'tier_ui_matrix',
  'escalation_rules', 'execution_group_policy', 'merge_blockers',
  'accessibility_focus_evidence_policy', 'policy_version', 'policy_date', 'refs'
];

const EXPECTED_TIERS = ['TIER_1', 'TIER_2', 'TIER_3'];
const EXPECTED_UI_CLASSES = ['NOT_APPLICABLE', 'U0', 'U1', 'U2', 'U3'];
const EXPECTED_CAPABILITIES = [
  'copy_or_docs', 'visual_only', 'structural_dom', 'responsive_layout',
  'accessibility_or_focus', 'browser_runtime', 'process_runtime',
  'auth_or_session', 'api_read', 'api_write', 'cache_or_storage_persistence',
  'database', 'migration', 'privacy_or_security', 'provider_or_network',
  'deployment_or_runtime_infra', 'destructive'
];
const EXPECTED_SENSITIVE = [
  'auth_or_session', 'api_write', 'cache_or_storage_persistence',
  'database', 'migration', 'privacy_or_security', 'provider_or_network',
  'deployment_or_runtime_infra', 'destructive'
];

const EXPECTED_ESCALATION_KEYS = [
  'tier_1_not_applicable_blocked', 'u0_u1_blocking_capabilities',
  'tier_2_u2_sensitive_escalation', 'u3_sensitive_requires_tier_3'
];

const EXPECTED_MERGE_BLOCKER_KEYS = [
  'description', 'hard_blockers', 'infrastructure_unavailable_posture',
  'tier_3_requirements'
];

const EXPECTED_ACCESSIBILITY_POLICY_KEYS = [
  'description', 'static_only_indicator', 'requires_browser_evidence',
  'under_tier_2_or_3', 'non_behavioral_aria_copy_exception'
];

const PRODUCTION_CAPABILITIES = [
  'browser_runtime', 'process_runtime', 'auth_or_session',
  'api_read', 'api_write', 'cache_or_storage_persistence',
  'database', 'migration', 'privacy_or_security',
  'provider_or_network', 'deployment_or_runtime_infra', 'destructive'
];

const MANUAL_ONLY_GROUP = 'REMOTE_OR_PROVIDER_MANUAL';

/* ── Source reads ────────────────────────────────────────────── */
function readPolicy() {
  try { return JSON.parse(fs.readFileSync(POLICY_PATH, 'utf8')); }
  catch (e) { throw new PlanError(ERROR_CODES.POLICY_PARSE_ERROR, 'Cannot read policy file'); }
}

function readRegistry() {
  try { return JSON.parse(fs.readFileSync(REGISTRY_PATH, 'utf8')); }
  catch (e) { throw new PlanError(ERROR_CODES.POLICY_PARSE_ERROR, 'Cannot read registry file'); }
}

/* ── Deep object key validation helper ────────────────────────── */
function assertExactSortedKeys(obj, expectedKeys, context) {
  var keys = Object.keys(obj).sort();
  var expectedSorted = expectedKeys.slice().sort();
  if (keys.length !== expectedSorted.length) {
    throw new PlanError(ERROR_CODES.POLICY_SCHEMA_ERROR,
      context + ' key count mismatch: ' + JSON.stringify(keys) + ' vs expected ' + JSON.stringify(expectedSorted));
  }
  for (var ki = 0; ki < keys.length; ki++) {
    if (keys[ki] !== expectedSorted[ki]) {
      var extra = keys.filter(function(k) { return expectedSorted.indexOf(k) === -1; });
      var missing = expectedSorted.filter(function(k) { return keys.indexOf(k) === -1; });
      var msg = context + ' key mismatch';
      if (extra.length > 0) msg += '; unknown: ' + extra.join(', ');
      if (missing.length > 0) msg += '; missing: ' + missing.join(', ');
      throw new PlanError(ERROR_CODES.POLICY_SCHEMA_ERROR, msg);
    }
  }
}

/* ── Full schema validation ──────────────────────────────────── */
function validatePolicySchema(policy) {
  // Check exact top-level keys
  var topKeys = Object.keys(policy).sort();
  var expectedSorted = EXPECTED_TOP_KEYS.slice().sort();
  if (topKeys.length !== expectedSorted.length) {
    throw new PlanError(ERROR_CODES.POLICY_SCHEMA_ERROR, 'Top-level key count mismatch');
  }
  for (var tk = 0; tk < topKeys.length; tk++) {
    if (topKeys[tk] !== expectedSorted[tk]) {
      var extra = topKeys.filter(function(k) { return expectedSorted.indexOf(k) === -1; });
      var missing = expectedSorted.filter(function(k) { return topKeys.indexOf(k) === -1; });
      var msg = 'Top-level key mismatch';
      if (extra.length > 0) msg += '; unknown: ' + extra.join(', ');
      if (missing.length > 0) msg += '; missing: ' + missing.join(', ');
      throw new PlanError(ERROR_CODES.POLICY_SCHEMA_ERROR, msg);
    }
  }

  if (policy.schema_version !== '1.0.0') {
    throw new PlanError(ERROR_CODES.POLICY_SCHEMA_ERROR, 'Unsupported schema_version');
  }
  if (policy.policy_version !== '1.0.0') {
    throw new PlanError(ERROR_CODES.POLICY_SCHEMA_ERROR, 'Unsupported policy_version');
  }

  // Validate tier_enum exactly
  if (!policy.tier_enum || policy.tier_enum.length !== 3 ||
      policy.tier_enum[0] !== 'TIER_1' || policy.tier_enum[1] !== 'TIER_2' || policy.tier_enum[2] !== 'TIER_3') {
    throw new PlanError(ERROR_CODES.UNKNOWN_ENUM, 'tier_enum malformed');
  }

  // Validate ui_class_enum exactly
  if (!policy.ui_class_enum || policy.ui_class_enum.length !== 5 || policy.ui_class_enum[0] !== 'NOT_APPLICABLE' ||
      policy.ui_class_enum[1] !== 'U0' || policy.ui_class_enum[2] !== 'U1' || policy.ui_class_enum[3] !== 'U2' || policy.ui_class_enum[4] !== 'U3') {
    throw new PlanError(ERROR_CODES.UNKNOWN_ENUM, 'ui_class_enum malformed');
  }

  // Validate capability_enum exactly
  if (!policy.capability_enum || policy.capability_enum.length !== 17 ||
      JSON.stringify(policy.capability_enum) !== JSON.stringify(EXPECTED_CAPABILITIES)) {
    throw new PlanError(ERROR_CODES.UNKNOWN_ENUM, 'capability_enum malformed');
  }

  // Validate sensitive_capabilities exact subset
  if (!policy.sensitive_capabilities || JSON.stringify(policy.sensitive_capabilities) !== JSON.stringify(EXPECTED_SENSITIVE)) {
    throw new PlanError(ERROR_CODES.UNKNOWN_ENUM, 'sensitive_capabilities malformed');
  }

  // Validate tier_1_not_applicable_allowed_capabilities
  if (!policy.tier_1_not_applicable_allowed_capabilities || !Array.isArray(policy.tier_1_not_applicable_allowed_capabilities)) {
    throw new PlanError(ERROR_CODES.POLICY_SCHEMA_ERROR, 'tier_1_not_applicable_allowed_capabilities must be an array');
  }
  for (var t1c = 0; t1c < policy.tier_1_not_applicable_allowed_capabilities.length; t1c++) {
    if (EXPECTED_CAPABILITIES.indexOf(policy.tier_1_not_applicable_allowed_capabilities[t1c]) === -1) {
      throw new PlanError(ERROR_CODES.UNKNOWN_ENUM, 'Unknown allowed capability: ' + policy.tier_1_not_applicable_allowed_capabilities[t1c]);
    }
  }

  // Validate execution_group_enum matches registry
  var registry = readRegistry();
  if (!registry.group_enum || JSON.stringify(policy.execution_group_enum) !== JSON.stringify(registry.group_enum)) {
    throw new PlanError(ERROR_CODES.REGISTRY_POLICY_MISMATCH, 'execution_group_enum does not match registry');
  }
  // Validate REMOTE_OR_PROVIDER_MANUAL has risk_gate_eligibility: manual_only in registry
  var remoteRegGroup = null;
  for (var rrg = 0; rrg < registry.groups.length; rrg++) {
    if (registry.groups[rrg].group === MANUAL_ONLY_GROUP) { remoteRegGroup = registry.groups[rrg]; break; }
  }
  if (!remoteRegGroup || remoteRegGroup.risk_gate_eligibility !== 'manual_only') {
    throw new PlanError(ERROR_CODES.REGISTRY_POLICY_MISMATCH,
      MANUAL_ONLY_GROUP + ' must have risk_gate_eligibility: manual_only in registry');
  }

  // Validate tier_ui_matrix — exact keys and allowed_combinations
  assertExactSortedKeys(policy.tier_ui_matrix, ['allowed_combinations', 'description'], 'tier_ui_matrix');
  if (!Array.isArray(policy.tier_ui_matrix.allowed_combinations)) {
    throw new PlanError(ERROR_CODES.POLICY_SCHEMA_ERROR, 'tier_ui_matrix.allowed_combinations must be array');
  }
  for (var ac = 0; ac < policy.tier_ui_matrix.allowed_combinations.length; ac++) {
    var comb = policy.tier_ui_matrix.allowed_combinations[ac];
    if (!Array.isArray(comb) || comb.length !== 2) {
      throw new PlanError(ERROR_CODES.POLICY_SCHEMA_ERROR, 'Malformed combination at index ' + ac);
    }
    if (EXPECTED_TIERS.indexOf(comb[0]) === -1) {
      throw new PlanError(ERROR_CODES.UNKNOWN_ENUM, 'Unknown tier in combination: ' + comb[0]);
    }
    if (EXPECTED_UI_CLASSES.indexOf(comb[1]) === -1) {
      throw new PlanError(ERROR_CODES.UNKNOWN_ENUM, 'Unknown ui class in combination: ' + comb[1]);
    }
    // Check duplicates
    for (var ac2 = ac + 1; ac2 < policy.tier_ui_matrix.allowed_combinations.length; ac2++) {
      if (policy.tier_ui_matrix.allowed_combinations[ac2][0] === comb[0] &&
          policy.tier_ui_matrix.allowed_combinations[ac2][1] === comb[1]) {
        throw new PlanError(ERROR_CODES.POLICY_SCHEMA_ERROR, 'Duplicate Tier/UI combination: ' + comb[0] + ' + ' + comb[1]);
      }
    }
  }

  // Validate escalation_rules — exact keys
  assertExactSortedKeys(policy.escalation_rules,
    ['description', 'tier_1_not_applicable_blocked', 'u0_u1_blocking_capabilities',
     'tier_2_u2_sensitive_escalation', 'u3_sensitive_requires_tier_3'], 'escalation_rules');
  for (var ek = 0; ek < EXPECTED_ESCALATION_KEYS.length; ek++) {
    var rule = policy.escalation_rules[EXPECTED_ESCALATION_KEYS[ek]];
    if (!rule || typeof rule !== 'object') {
      throw new PlanError(ERROR_CODES.POLICY_SCHEMA_ERROR, 'Missing escalation rule: ' + EXPECTED_ESCALATION_KEYS[ek]);
    }
    // Must have note + either blocked or sensitive_capabilities
    assertExactSortedKeys(rule, ['note', (EXPECTED_ESCALATION_KEYS[ek] === 'tier_2_u2_sensitive_escalation' || EXPECTED_ESCALATION_KEYS[ek] === 'u3_sensitive_requires_tier_3' ? 'sensitive_capabilities' : 'blocked')],
      'escalation_rules.' + EXPECTED_ESCALATION_KEYS[ek]);
    var caps = rule.blocked || rule.sensitive_capabilities;
    if (!Array.isArray(caps)) {
      throw new PlanError(ERROR_CODES.POLICY_SCHEMA_ERROR, 'Malformed escalation rule: ' + EXPECTED_ESCALATION_KEYS[ek]);
    }
    // Verify exact capability list for TIER_1 blocked / U0U1 blocked
    if (EXPECTED_ESCALATION_KEYS[ek] === 'tier_1_not_applicable_blocked' || EXPECTED_ESCALATION_KEYS[ek] === 'u0_u1_blocking_capabilities') {
      var expectedBlocked = EXPECTED_CAPABILITIES.filter(function(c) {
        return c !== 'copy_or_docs' && c !== 'visual_only';
      });
      if (JSON.stringify(caps) !== JSON.stringify(expectedBlocked)) {
        throw new PlanError(ERROR_CODES.UNKNOWN_ENUM, 'Incorrect blocked list in ' + EXPECTED_ESCALATION_KEYS[ek]);
      }
    } else {
      // sensitive capabilities must match EXPECTED_SENSITIVE
      if (JSON.stringify(caps) !== JSON.stringify(EXPECTED_SENSITIVE)) {
        throw new PlanError(ERROR_CODES.UNKNOWN_ENUM, 'Incorrect sensitive_capabilities in ' + EXPECTED_ESCALATION_KEYS[ek]);
      }
    }
  }

  // Validate execution_group_policy
  assertExactSortedKeys(policy.execution_group_policy, ['conditional_groups', 'manual_evidence_groups', 'required_groups'], 'execution_group_policy');

  // Validate required_groups — exact tier keys
  var reqKeys = Object.keys(policy.execution_group_policy.required_groups).sort();
  if (JSON.stringify(reqKeys) !== JSON.stringify(['TIER_1', 'TIER_2', 'TIER_3'])) {
    throw new PlanError(ERROR_CODES.POLICY_SCHEMA_ERROR, 'required_groups must have exact TIER_1, TIER_2, TIER_3 keys');
  }
  for (var rgTier in policy.execution_group_policy.required_groups) {
    if (EXPECTED_TIERS.indexOf(rgTier) === -1) {
      throw new PlanError(ERROR_CODES.UNKNOWN_ENUM, 'Unknown tier in required_groups: ' + rgTier);
    }
    var rg = policy.execution_group_policy.required_groups[rgTier];
    if (!Array.isArray(rg)) {
      throw new PlanError(ERROR_CODES.POLICY_SCHEMA_ERROR, 'required_groups for ' + rgTier + ' must be array');
    }
    for (var rgc = 0; rgc < rg.length; rgc++) {
      if (policy.execution_group_enum.indexOf(rg[rgc]) === -1) {
        throw new PlanError(ERROR_CODES.UNKNOWN_EXECUTION_GROUP, 'Unknown group ' + rg[rgc] + ' in required_groups');
      }
      if (rg[rgc] === MANUAL_ONLY_GROUP) {
        throw new PlanError(ERROR_CODES.UNSAFE_AUTOMATIC_EXECUTION,
          MANUAL_ONLY_GROUP + ' must not appear in required_groups');
      }
    }
  }

  // Validate conditional_groups
  assertExactSortedKeys(policy.execution_group_policy.conditional_groups, ['description', 'rules'], 'conditional_groups');
  if (!Array.isArray(policy.execution_group_policy.conditional_groups.rules)) {
    throw new PlanError(ERROR_CODES.POLICY_SCHEMA_ERROR, 'conditional_groups.rules must be array');
  }
  for (var rl = 0; rl < policy.execution_group_policy.conditional_groups.rules.length; rl++) {
    var rule = policy.execution_group_policy.conditional_groups.rules[rl];
    if (!rule.capability || !rule.conditional_groups || !rule.affected_tiers) {
      throw new PlanError(ERROR_CODES.POLICY_SCHEMA_ERROR, 'Malformed conditional rule at index ' + rl);
    }
    // Check exact keys
    assertExactSortedKeys(rule, ['affected_tiers', 'capability', 'conditional_groups'],
      'conditional_groups.rules[' + rl + ']');
    if (EXPECTED_CAPABILITIES.indexOf(rule.capability) === -1) {
      throw new PlanError(ERROR_CODES.UNKNOWN_ENUM, 'Unknown capability ' + rule.capability + ' in conditional rule');
    }
    if (!Array.isArray(rule.affected_tiers)) {
      throw new PlanError(ERROR_CODES.POLICY_SCHEMA_ERROR, 'affected_tiers must be array in rule ' + rl);
    }
    for (var ati = 0; ati < rule.affected_tiers.length; ati++) {
      if (EXPECTED_TIERS.indexOf(rule.affected_tiers[ati]) === -1) {
        throw new PlanError(ERROR_CODES.UNKNOWN_ENUM, 'Invalid affected_tiers value: ' + rule.affected_tiers[ati] + ' in rule ' + rl);
      }
    }
    for (var cg = 0; cg < rule.conditional_groups.length; cg++) {
      if (policy.execution_group_enum.indexOf(rule.conditional_groups[cg]) === -1) {
        throw new PlanError(ERROR_CODES.UNKNOWN_EXECUTION_GROUP, 'Unknown group ' + rule.conditional_groups[cg] + ' in conditional rule');
      }
      if (rule.conditional_groups[cg] === MANUAL_ONLY_GROUP) {
        throw new PlanError(ERROR_CODES.UNSAFE_AUTOMATIC_EXECUTION,
          MANUAL_ONLY_GROUP + ' must not appear in conditional_groups');
      }
    }
    // Check for duplicate capabilities in rules
    for (var rl2 = rl + 1; rl2 < policy.execution_group_policy.conditional_groups.rules.length; rl2++) {
      if (policy.execution_group_policy.conditional_groups.rules[rl2].capability === rule.capability) {
        throw new PlanError(ERROR_CODES.POLICY_SCHEMA_ERROR, 'Duplicate capability in conditional rules: ' + rule.capability);
      }
    }
  }

  // Validate manual_evidence_groups
  assertExactSortedKeys(policy.execution_group_policy.manual_evidence_groups, ['description', 'groups', 'triggers'],
    'manual_evidence_groups');
  if (!Array.isArray(policy.execution_group_policy.manual_evidence_groups.groups) ||
      policy.execution_group_policy.manual_evidence_groups.groups.indexOf(MANUAL_ONLY_GROUP) === -1) {
    throw new PlanError(ERROR_CODES.POLICY_SCHEMA_ERROR, 'manual_evidence_groups must include ' + MANUAL_ONLY_GROUP);
  }
  assertExactSortedKeys(policy.execution_group_policy.manual_evidence_groups.triggers, ['capabilities'],
    'manual_evidence_groups.triggers');
  if (!Array.isArray(policy.execution_group_policy.manual_evidence_groups.triggers.capabilities) ||
      policy.execution_group_policy.manual_evidence_groups.triggers.capabilities.indexOf('provider_or_network') === -1) {
    throw new PlanError(ERROR_CODES.POLICY_SCHEMA_ERROR, 'manual_evidence_groups.triggers.capabilities must include provider_or_network');
  }

  // Validate merge_blockers — exact keys
  assertExactSortedKeys(policy.merge_blockers, EXPECTED_MERGE_BLOCKER_KEYS, 'merge_blockers');
  if (!Array.isArray(policy.merge_blockers.hard_blockers) || policy.merge_blockers.hard_blockers.length !== 3) {
    throw new PlanError(ERROR_CODES.POLICY_SCHEMA_ERROR, 'hard_blockers must be array of 3');
  }
  if (policy.merge_blockers.hard_blockers[0] !== 'CI_EXECUTED_FAILURE' ||
      policy.merge_blockers.hard_blockers[1] !== 'CI_PENDING_EXECUTION' ||
      policy.merge_blockers.hard_blockers[2] !== 'UNRESOLVED_DESTRUCTIVE_APPROVAL') {
    throw new PlanError(ERROR_CODES.POLICY_SCHEMA_ERROR, 'hard_blockers content or order mismatch');
  }

  // Validate infrastructure_unavailable_posture
  assertExactSortedKeys(policy.merge_blockers.infrastructure_unavailable_posture,
    ['alternative_evidence_required', 'description', 'merge_ready_without_alternative', 'status'],
    'infrastructure_unavailable_posture');
  if (policy.merge_blockers.infrastructure_unavailable_posture.status !== 'CI_UNAVAILABLE_INFRA') {
    throw new PlanError(ERROR_CODES.POLICY_SCHEMA_ERROR, 'infrastructure_unavailable_posture.status must be CI_UNAVAILABLE_INFRA');
  }
  if (policy.merge_blockers.infrastructure_unavailable_posture.alternative_evidence_required !== true) {
    throw new PlanError(ERROR_CODES.POLICY_SCHEMA_ERROR, 'infrastructure_unavailable_posture.alternative_evidence_required must be true');
  }

  // Validate tier_3_requirements
  assertExactSortedKeys(policy.merge_blockers.tier_3_requirements,
    ['exact_head_local_validation', 'note', 'production_verification_for'],
    'tier_3_requirements');
  if (policy.merge_blockers.tier_3_requirements.exact_head_local_validation !== true) {
    throw new PlanError(ERROR_CODES.POLICY_SCHEMA_ERROR, 'tier_3_requirements.exact_head_local_validation must be true');
  }

  // Validate accessibility_focus_evidence_policy
  assertExactSortedKeys(policy.accessibility_focus_evidence_policy, EXPECTED_ACCESSIBILITY_POLICY_KEYS,
    'accessibility_focus_evidence_policy');
  if (!policy.accessibility_focus_evidence_policy.requires_browser_evidence ||
      !Array.isArray(policy.accessibility_focus_evidence_policy.requires_browser_evidence)) {
    throw new PlanError(ERROR_CODES.POLICY_SCHEMA_ERROR, 'accessibility_focus_evidence_policy.requires_browser_evidence must be array');
  }
}

/* ── CLI argument parsing ────────────────────────────────────── */
function parseArgs(argv) {
  var args = argv.slice(2);
  var result = { tier: null, uiClass: null, capabilities: [], json: 0 };
  var seenCapValues = {};

  for (var i = 0; i < args.length; i++) {
    var arg = args[i];

    if (arg === '--json') {
      result.json++;
      continue;
    }

    if (arg === '--tier' || arg === '--ui-class') {
      if (arg === '--tier' && result.tier !== null) {
        throw new PlanError(ERROR_CODES.DUPLICATE_ARGUMENT, 'Duplicate --tier argument');
      }
      if (arg === '--ui-class' && result.uiClass !== null) {
        throw new PlanError(ERROR_CODES.DUPLICATE_ARGUMENT, 'Duplicate --ui-class argument');
      }
      if (i + 1 >= args.length || args[i + 1].startsWith('--')) {
        throw new PlanError(ERROR_CODES.MISSING_REQUIRED_ARGUMENT, 'Missing value for ' + arg);
      }
      var value = args[++i];
      if (arg === '--tier') result.tier = value;
      else result.uiClass = value;
    } else if (arg === '--capability') {
      if (i + 1 >= args.length || args[i + 1].startsWith('--')) {
        throw new PlanError(ERROR_CODES.MISSING_REQUIRED_ARGUMENT, 'Missing value for --capability');
      }
      var capVal = args[++i];
      if (seenCapValues[capVal]) {
        throw new PlanError(ERROR_CODES.DUPLICATE_ARGUMENT, 'Duplicate capability value: ' + capVal);
      }
      seenCapValues[capVal] = true;
      result.capabilities.push(capVal);
    } else if (arg.startsWith('--')) {
      throw new PlanError(ERROR_CODES.UNSUPPORTED_ARGUMENT, 'Unknown argument: ' + arg);
    } else {
      throw new PlanError(ERROR_CODES.UNSUPPORTED_ARGUMENT, 'Unexpected positional token: ' + arg);
    }
  }

  if (result.json > 1) {
    throw new PlanError(ERROR_CODES.DUPLICATE_ARGUMENT, 'Duplicate --json argument');
  }
  if (result.tier === null) {
    throw new PlanError(ERROR_CODES.MISSING_REQUIRED_ARGUMENT, 'Missing required --tier argument');
  }
  if (result.uiClass === null) {
    throw new PlanError(ERROR_CODES.MISSING_REQUIRED_ARGUMENT, 'Missing required --ui-class argument');
  }

  return result;
}

/* ── Input validation ────────────────────────────────────────── */
function validateInputs(policy, tier, uiClass, capabilities) {
  if (policy.tier_enum.indexOf(tier) === -1) {
    throw new PlanError(ERROR_CODES.UNKNOWN_ENUM, 'Unknown tier: ' + tier);
  }
  if (policy.ui_class_enum.indexOf(uiClass) === -1) {
    throw new PlanError(ERROR_CODES.UNKNOWN_ENUM, 'Unknown ui-class: ' + uiClass);
  }
  for (var ci = 0; ci < capabilities.length; ci++) {
    if (policy.capability_enum.indexOf(capabilities[ci]) === -1) {
      throw new PlanError(ERROR_CODES.UNKNOWN_ENUM, 'Unknown capability: ' + capabilities[ci]);
    }
  }
}

function validateTierUiCombination(policy, tier, uiClass) {
  var allowed = policy.tier_ui_matrix.allowed_combinations;
  var ok = false;
  for (var ai = 0; ai < allowed.length; ai++) {
    if (allowed[ai][0] === tier && allowed[ai][1] === uiClass) { ok = true; break; }
  }
  if (!ok) {
    throw new PlanError(ERROR_CODES.INVALID_TIER_UI_COMBINATION,
      'Invalid Tier/UI combination: ' + tier + ' + ' + uiClass);
  }
}

/* ── Escalation rules ────────────────────────────────────────── */
function applyEscalationRules(policy, tier, uiClass, capabilities) {
  var effectiveTier = tier;

  // TIER_1 + NOT_APPLICABLE blocked mid-risk capabilities
  if (tier === 'TIER_1' && uiClass === 'NOT_APPLICABLE') {
    var t1Blocked = policy.escalation_rules.tier_1_not_applicable_blocked.blocked;
    var allowedCaps = policy.tier_1_not_applicable_allowed_capabilities;
    for (var tb = 0; tb < capabilities.length; tb++) {
      if (t1Blocked.indexOf(capabilities[tb]) !== -1) {
        throw new PlanError(ERROR_CODES.UNDERCLASSIFIED_CAPABILITY,
          'TIER_1 + NOT_APPLICABLE cannot include: ' + capabilities[tb]);
      }
      if (allowedCaps.indexOf(capabilities[tb]) === -1) {
        throw new PlanError(ERROR_CODES.UNDERCLASSIFIED_CAPABILITY,
          'TIER_1 + NOT_APPLICABLE cannot include: ' + capabilities[tb]);
      }
    }
  }

  if (uiClass === 'U0' || uiClass === 'U1') {
    var blocked = policy.escalation_rules.u0_u1_blocking_capabilities.blocked;
    for (var uu = 0; uu < capabilities.length; uu++) {
      if (blocked.indexOf(capabilities[uu]) !== -1) {
        throw new PlanError(ERROR_CODES.UNDERCLASSIFIED_CAPABILITY,
          'UI class ' + uiClass + ' cannot include: ' + capabilities[uu]);
      }
    }
  }

  if (uiClass === 'U2') {
    var s2 = policy.escalation_rules.tier_2_u2_sensitive_escalation.sensitive_capabilities;
    for (var su2 = 0; su2 < capabilities.length; su2++) {
      if (s2.indexOf(capabilities[su2]) !== -1 && effectiveTier !== 'TIER_3') {
        throw new PlanError(ERROR_CODES.UNDERCLASSIFIED_CAPABILITY,
          'U2 sensitive cap ' + capabilities[su2] + ' requires TIER_3');
      }
    }
  }

  if (uiClass === 'U3') {
    var s3 = policy.escalation_rules.u3_sensitive_requires_tier_3.sensitive_capabilities;
    for (var su3 = 0; su3 < capabilities.length; su3++) {
      if (s3.indexOf(capabilities[su3]) !== -1 && effectiveTier !== 'TIER_3') {
        throw new PlanError(ERROR_CODES.UNDERCLASSIFIED_CAPABILITY,
          'U3 sensitive cap ' + capabilities[su3] + ' requires TIER_3');
      }
    }
  }

  return effectiveTier;
}

/* ── Contradiction detection ─────────────────────────────────── */
function detectContradictions(capabilities) {
  var pairs = [
    ['copy_or_docs', 'structural_dom'],
    ['copy_or_docs', 'browser_runtime'],
    ['copy_or_docs', 'responsive_layout'],
    ['copy_or_docs', 'accessibility_or_focus'],
    ['visual_only', 'accessibility_or_focus'],
    ['visual_only', 'process_runtime'],
    ['visual_only', 'browser_runtime'],
    ['visual_only', 'responsive_layout'],
    ['visual_only', 'structural_dom'],
  ];
  for (var pi = 0; pi < pairs.length; pi++) {
    if (capabilities.indexOf(pairs[pi][0]) !== -1 && capabilities.indexOf(pairs[pi][1]) !== -1) {
      throw new PlanError(ERROR_CODES.CONTRADICTORY_CAPABILITY,
        pairs[pi][0] + ' and ' + pairs[pi][1] + ' are contradictory');
    }
  }
}

/* ── Canonical ordering helper ───────────────────────────────── */
function sortByGroupEnum(groups, groupEnum) {
  var sorted = groups.slice();
  sorted.sort(function(a, b) {
    return groupEnum.indexOf(a) - groupEnum.indexOf(b);
  });
  return sorted;
}

/* ── Build plan ──────────────────────────────────────────────── */
function buildPlan(policy, effectiveTier, uiClass, capabilities) {
  var groupEnum = policy.execution_group_enum;

  var plan = {
    classification: { tier: effectiveTier, ui_class: uiClass, capabilities: capabilities.slice().sort() },
    effective_tier: effectiveTier,
    required_groups: [],
    conditional_groups: [],
    manual_evidence_required: false,
    manual_evidence_groups: [],
    local_validation_required: false,
    browser_evidence_required: false,
    production_verification_required: false,
    merge_blockers: [],
    infrastructure_unavailable_posture: null,
    validation_outcome: 'PASS',
    notes: [],
  };

  // Required groups
  var reqByTier = policy.execution_group_policy.required_groups[effectiveTier] || [];
  for (var ri = 0; ri < reqByTier.length; ri++) {
    if (reqByTier[ri] === MANUAL_ONLY_GROUP) {
      throw new PlanError(ERROR_CODES.UNSAFE_AUTOMATIC_EXECUTION,
        MANUAL_ONLY_GROUP + ' found in required_groups for ' + effectiveTier);
    }
    if (plan.required_groups.indexOf(reqByTier[ri]) === -1) {
      plan.required_groups.push(reqByTier[ri]);
    }
  }

  // Conditional groups
  var rules = policy.execution_group_policy.conditional_groups.rules;
  for (var rxi = 0; rxi < rules.length; rxi++) {
    var rule = rules[rxi];
    if (capabilities.indexOf(rule.capability) !== -1 && rule.affected_tiers.indexOf(effectiveTier) !== -1) {
      for (var cgi = 0; cgi < rule.conditional_groups.length; cgi++) {
        var cg = rule.conditional_groups[cgi];
        if (cg === MANUAL_ONLY_GROUP) {
          throw new PlanError(ERROR_CODES.UNSAFE_AUTOMATIC_EXECUTION,
            MANUAL_ONLY_GROUP + ' found in conditional_groups');
        }
        if (plan.required_groups.indexOf(cg) === -1 && plan.conditional_groups.indexOf(cg) === -1) {
          plan.conditional_groups.push(cg);
        }
      }
    }
  }

  // Sort groups by canonical order
  plan.required_groups = sortByGroupEnum(plan.required_groups, groupEnum);
  plan.conditional_groups = sortByGroupEnum(plan.conditional_groups, groupEnum);

  // Manual evidence (never required or conditional)
  var manualTriggerCaps = policy.execution_group_policy.manual_evidence_groups.triggers.capabilities;
  for (var mt = 0; mt < capabilities.length; mt++) {
    if (manualTriggerCaps.indexOf(capabilities[mt]) !== -1) {
      plan.manual_evidence_required = true;
      plan.manual_evidence_groups = sortByGroupEnum(
        policy.execution_group_policy.manual_evidence_groups.groups.slice(), groupEnum);
      break;
    }
  }

  // Browser evidence for runtime access, responsive, accessibility
  if ((capabilities.indexOf('browser_runtime') !== -1 ||
       capabilities.indexOf('responsive_layout') !== -1 ||
       capabilities.indexOf('accessibility_or_focus') !== -1) &&
      (effectiveTier === 'TIER_2' || effectiveTier === 'TIER_3')) {
    plan.browser_evidence_required = true;
  }

  // Local validation: TIER_3 always, plus specific capabilities
  if (effectiveTier === 'TIER_3' ||
      capabilities.indexOf('auth_or_session') !== -1 ||
      capabilities.indexOf('database') !== -1) {
    plan.local_validation_required = true;
  }

  // Production verification: ONLY when capabilities include observable boundaries
  for (var pv = 0; pv < capabilities.length; pv++) {
    if (PRODUCTION_CAPABILITIES.indexOf(capabilities[pv]) !== -1) {
      plan.production_verification_required = true;
      break;
    }
  }

  // CI_UNAVAILABLE_INFRA posture
  if (policy.merge_blockers.infrastructure_unavailable_posture) {
    plan.infrastructure_unavailable_posture = {
      status: policy.merge_blockers.infrastructure_unavailable_posture.status,
      alternative_evidence_required: policy.merge_blockers.infrastructure_unavailable_posture.alternative_evidence_required,
      merge_ready_without_alternative: policy.merge_blockers.infrastructure_unavailable_posture.merge_ready_without_alternative,
    };
  }

  // Merge blockers
  if (policy.merge_blockers && policy.merge_blockers.hard_blockers) {
    plan.merge_blockers = policy.merge_blockers.hard_blockers.slice();
  }

  return plan;
}

/* ── Output ──────────────────────────────────────────────────── */
function buildHumanOutput(plan) {
  var lines = [];
  lines.push('CI RISK-TIER GATE PLAN');
  lines.push('======================');
  lines.push('');
  lines.push('CLASSIFICATION');
  lines.push('  Tier:         ' + plan.classification.tier);
  lines.push('  UI class:     ' + plan.classification.ui_class);
  lines.push('  Capabilities: ' + plan.classification.capabilities.join(', '));
  lines.push('');
  lines.push('EFFECTIVE TIER: ' + plan.effective_tier);
  lines.push('');
  lines.push('REQUIRED GROUPS');
  if (plan.required_groups.length === 0) lines.push('  (none)');
  else for (var i = 0; i < plan.required_groups.length; i++) lines.push('  - ' + plan.required_groups[i]);
  lines.push('');
  lines.push('CONDITIONAL GROUPS');
  if (plan.conditional_groups.length === 0) lines.push('  (none)');
  else for (var j = 0; j < plan.conditional_groups.length; j++) lines.push('  - ' + plan.conditional_groups[j]);
  lines.push('');
  lines.push('MANUAL EVIDENCE: ' + (plan.manual_evidence_required ? 'REQUIRED' : 'NOT REQUIRED'));
  if (plan.manual_evidence_groups.length > 0) for (var k = 0; k < plan.manual_evidence_groups.length; k++) lines.push('  - ' + plan.manual_evidence_groups[k]);
  lines.push('');
  lines.push('LOCAL VALIDATION: ' + (plan.local_validation_required ? 'REQUIRED' : 'NOT REQUIRED'));
  lines.push('BROWSER/RUNTIME EVIDENCE: ' + (plan.browser_evidence_required ? 'REQUIRED' : 'NOT REQUIRED'));
  lines.push('PRODUCTION VERIFICATION: ' + (plan.production_verification_required ? 'REQUIRED' : 'NOT REQUIRED'));
  lines.push('');
  lines.push('MERGE BLOCKERS');
  if (plan.merge_blockers.length === 0) lines.push('  (none)');
  else for (var m = 0; m < plan.merge_blockers.length; m++) lines.push('  - ' + plan.merge_blockers[m]);
  lines.push('');
  if (plan.infrastructure_unavailable_posture) {
    lines.push('INFRASTRUCTURE UNAVAILABLE POSTURE');
    lines.push('  Status: ' + plan.infrastructure_unavailable_posture.status);
    lines.push('  Alternative evidence required: ' + (plan.infrastructure_unavailable_posture.alternative_evidence_required ? 'YES' : 'NO'));
    lines.push('  Merge-ready without alternative: ' + (plan.infrastructure_unavailable_posture.merge_ready_without_alternative ? 'YES' : 'NO'));
    lines.push('');
  }
  lines.push('VALIDATION OUTCOME: ' + plan.validation_outcome);
  return lines.join('\n');
}

function buildJsonOutput(plan) {
  return JSON.stringify(plan, null, 2);
}

function run(argv) {
  var args = parseArgs(argv);
  var pol = readPolicy();
  validatePolicySchema(pol);
  validateInputs(pol, args.tier, args.uiClass, args.capabilities);
  validateTierUiCombination(pol, args.tier, args.uiClass);
  detectContradictions(args.capabilities);
  var effectiveTier = applyEscalationRules(pol, args.tier, args.uiClass, args.capabilities);
  var plan = buildPlan(pol, effectiveTier, args.uiClass, args.capabilities);
  return args.json ? buildJsonOutput(plan) : buildHumanOutput(plan);
}

function main(argv) {
  try {
    console.log(run(argv || process.argv));
    process.exitCode = 0;
  } catch (e) {
    if (e instanceof PlanError) { console.error(e.message); process.exitCode = 1; }
    else { console.error('UNEXPECTED_ERROR: ' + (e.message || String(e))); process.exitCode = 2; }
  }
}

if (require.main === module) main();

module.exports = {
  ERROR_CODES: ERROR_CODES, PlanError: PlanError,
  readPolicy: readPolicy, readRegistry: readRegistry,
  validatePolicySchema: validatePolicySchema, parseArgs: parseArgs,
  validateInputs: validateInputs, validateTierUiCombination: validateTierUiCombination,
  applyEscalationRules: applyEscalationRules, detectContradictions: detectContradictions,
  buildPlan: buildPlan, buildHumanOutput: buildHumanOutput, buildJsonOutput: buildJsonOutput,
  run: run, POLICY_PATH: POLICY_PATH, REGISTRY_PATH: REGISTRY_PATH, ROOT: ROOT,
  EXPECTED_TOP_KEYS: EXPECTED_TOP_KEYS, EXPECTED_TIERS: EXPECTED_TIERS,
  EXPECTED_UI_CLASSES: EXPECTED_UI_CLASSES, EXPECTED_CAPABILITIES: EXPECTED_CAPABILITIES,
  EXPECTED_SENSITIVE: EXPECTED_SENSITIVE,
  PRODUCTION_CAPABILITIES: PRODUCTION_CAPABILITIES,
  MANUAL_ONLY_GROUP: MANUAL_ONLY_GROUP,
  main: main,
};
