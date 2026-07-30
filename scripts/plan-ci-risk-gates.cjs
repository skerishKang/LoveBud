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
 *
 * CLI:
 *   node scripts/plan-ci-risk-gates.cjs --tier TIER_2 --ui-class U2 --capability structural_dom
 *   node scripts/plan-ci-risk-gates.cjs --tier TIER_2 --ui-class U2 --capability structural_dom --json
 */

'use strict';

const fs = require('fs');
const path = require('path');

const ROOT = __dirname;  // scripts/
const POLICY_REL = path.join('..', 'tests', 'ci-risk-gate-policy.json');
const POLICY_PATH = path.resolve(ROOT, POLICY_REL);

const REGISTRY_REL = path.join('..', 'tests', 'ci-test-group-registry.json');
const REGISTRY_PATH = path.resolve(ROOT, REGISTRY_REL);

/* ── Error vocabulary ────────────────────────────────────────── */
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

/* ── PlanError ───────────────────────────────────────────────── */
class PlanError extends Error {
  constructor(code, message) {
    super(sanitizedErrorCode(code, message));
    this.code = code;
    this.name = 'PlanError';
  }
}

function sanitizedErrorCode(code, detail) {
  // Strip absolute paths, credentials, private patterns
  const sanitized = String(detail || '').replace(/\/[\w./-]+\/[\w./-]+/g, '<path>');
  return code + ': ' + sanitized;
}

/* ── Fixed source reads ──────────────────────────────────────── */
function readPolicy() {
  try {
    const raw = fs.readFileSync(POLICY_PATH, 'utf8');
    return JSON.parse(raw);
  } catch (e) {
    throw new PlanError(ERROR_CODES.POLICY_PARSE_ERROR, 'Cannot read policy file');
  }
}

function readRegistry() {
  try {
    const raw = fs.readFileSync(REGISTRY_PATH, 'utf8');
    return JSON.parse(raw);
  } catch (e) {
    throw new PlanError(ERROR_CODES.POLICY_PARSE_ERROR, 'Cannot read registry file');
  }
}

/* ── Schema validation ───────────────────────────────────────── */
function validatePolicySchema(policy) {
  const requiredTopKeys = ['schema_version', 'title', 'tier_enum', 'ui_class_enum',
    'capability_enum', 'sensitive_capabilities', 'execution_group_enum',
    'tier_ui_matrix', 'escalation_rules', 'execution_group_policy',
    'merge_blockers', 'policy_version'];

  for (const key of requiredTopKeys) {
    if (!(key in policy)) {
      throw new PlanError(ERROR_CODES.POLICY_SCHEMA_ERROR, 'Missing top-level key: ' + key);
    }
  }

  // Validate tier_enum
  if (!Array.isArray(policy.tier_enum) || policy.tier_enum.length !== 3 ||
      policy.tier_enum[0] !== 'TIER_1' || policy.tier_enum[1] !== 'TIER_2' || policy.tier_enum[2] !== 'TIER_3') {
    throw new PlanError(ERROR_CODES.UNKNOWN_ENUM, 'tier_enum must be [TIER_1, TIER_2, TIER_3]');
  }

  // Validate ui_class_enum
  if (!Array.isArray(policy.ui_class_enum) || policy.ui_class_enum.length !== 5 ||
      policy.ui_class_enum[0] !== 'NOT_APPLICABLE') {
    throw new PlanError(ERROR_CODES.UNKNOWN_ENUM, 'ui_class_enum malformed');
  }

  // Validate execution_group_enum matches registry
  const registry = readRegistry();
  if (!Array.isArray(registry.group_enum)) {
    throw new PlanError(ERROR_CODES.REGISTRY_POLICY_MISMATCH, 'Registry missing group_enum');
  }
  if (JSON.stringify(policy.execution_group_enum) !== JSON.stringify(registry.group_enum)) {
    throw new PlanError(ERROR_CODES.REGISTRY_POLICY_MISMATCH, 'execution_group_enum does not match registry group_enum');
  }

  // Validate schema_version
  if (policy.schema_version !== '1.0.0') {
    throw new PlanError(ERROR_CODES.POLICY_SCHEMA_ERROR, 'Unsupported schema_version: ' + policy.schema_version);
  }
}

/* ── CLI argument parsing ────────────────────────────────────── */
function parseArgs(argv) {
  const args = argv.slice(2);
  const result = { tier: null, uiClass: null, capabilities: [], json: false };

  const seen = {};

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];

    if (arg === '--json') {
      result.json = true;
      continue;
    }

    if (arg === '--tier' || arg === '--ui-class') {
      if (seen[arg]) {
        throw new PlanError(ERROR_CODES.DUPLICATE_ARGUMENT, 'Duplicate argument: ' + arg);
      }
      seen[arg] = true;

      if (i + 1 >= args.length || args[i + 1].startsWith('--')) {
        throw new PlanError(ERROR_CODES.MISSING_REQUIRED_ARGUMENT, 'Missing value for ' + arg);
      }
      const value = args[++i];

      if (arg === '--tier') {
        result.tier = value;
      } else if (arg === '--ui-class') {
        result.uiClass = value;
      }
    } else if (arg === '--capability') {
      if (i + 1 >= args.length || args[i + 1].startsWith('--')) {
        throw new PlanError(ERROR_CODES.MISSING_REQUIRED_ARGUMENT, 'Missing value for --capability');
      }
      result.capabilities.push(args[++i]);
    } else if (arg.startsWith('--')) {
      throw new PlanError(ERROR_CODES.UNSUPPORTED_ARGUMENT, 'Unknown argument: ' + arg);
    }
  }

  if (!result.tier) {
    throw new PlanError(ERROR_CODES.MISSING_REQUIRED_ARGUMENT, 'Missing required --tier argument');
  }
  if (!result.uiClass) {
    throw new PlanError(ERROR_CODES.MISSING_REQUIRED_ARGUMENT, 'Missing required --ui-class argument');
  }

  return result;
}

/* ── Input validation against policy enums ───────────────────── */
function validateInputs(policy, tier, uiClass, capabilities) {
  // Validate tier
  if (!policy.tier_enum.includes(tier)) {
    throw new PlanError(ERROR_CODES.UNKNOWN_ENUM, 'Unknown tier: ' + tier + ' (valid: ' + policy.tier_enum.join(', ') + ')');
  }

  // Validate uiClass
  if (!policy.ui_class_enum.includes(uiClass)) {
    throw new PlanError(ERROR_CODES.UNKNOWN_ENUM, 'Unknown ui-class: ' + uiClass + ' (valid: ' + policy.ui_class_enum.join(', ') + ')');
  }

  // Validate capabilities
  for (const cap of capabilities) {
    if (!policy.capability_enum.includes(cap)) {
      throw new PlanError(ERROR_CODES.UNKNOWN_ENUM, 'Unknown capability: ' + cap + ' (valid: ' + policy.capability_enum.join(', ') + ')');
    }
  }
}

/* ── Tier/UI combination check ───────────────────────────────── */
function validateTierUiCombination(policy, tier, uiClass) {
  const allowed = policy.tier_ui_matrix.allowed_combinations;
  const isAllowed = allowed.some(function(comb) {
    return comb[0] === tier && comb[1] === uiClass;
  });
  if (!isAllowed) {
    throw new PlanError(ERROR_CODES.INVALID_TIER_UI_COMBINATION,
      'Invalid Tier/UI combination: ' + tier + ' + ' + uiClass);
  }
}

/* ── Capability escalation rules ─────────────────────────────── */
function applyEscalationRules(policy, tier, uiClass, capabilities) {
  var effectiveTier = tier;

  // U0/U1 blocking rules: these UI classes cannot have behavioral capabilities
  if (uiClass === 'U0' || uiClass === 'U1') {
    var blocked = policy.escalation_rules.u0_u1_blocking_capabilities.blocked;
    for (var i = 0; i < capabilities.length; i++) {
      if (blocked.indexOf(capabilities[i]) !== -1) {
        throw new PlanError(ERROR_CODES.UNDERCLASSIFIED_CAPABILITY,
          'UI class ' + uiClass + ' cannot include capability: ' + capabilities[i]);
      }
    }
  }

  // U2 sensitive escalation: must escalate to Tier 3
  if (uiClass === 'U2') {
    var sensitive = policy.escalation_rules.tier_2_u2_sensitive_escalation.sensitive_capabilities;
    for (var j = 0; j < capabilities.length; j++) {
      if (sensitive.indexOf(capabilities[j]) !== -1 && effectiveTier !== 'TIER_3') {
        throw new PlanError(ERROR_CODES.UNDERCLASSIFIED_CAPABILITY,
          'UI class U2 with sensitive capability ' + capabilities[j] + ' requires TIER_3 (got ' + effectiveTier + ')');
      }
    }
  }

  // U3 sensitive requires Tier 3
  if (uiClass === 'U3') {
    var u3Sensitive = policy.escalation_rules.u3_sensitive_requires_tier_3.sensitive_capabilities;
    for (var k = 0; k < capabilities.length; k++) {
      if (u3Sensitive.indexOf(capabilities[k]) !== -1 && effectiveTier !== 'TIER_3') {
        throw new PlanError(ERROR_CODES.UNDERCLASSIFIED_CAPABILITY,
          'U3 with sensitive capability ' + capabilities[k] + ' requires TIER_3 (got ' + effectiveTier + ')');
      }
    }
  }

  return effectiveTier;
}

/* ── Contradictory capability detection ──────────────────────── */
function detectContradictions(capabilities) {
  // Contradictory pairs
  var contradictions = [
    ['copy_or_docs', 'structural_dom'],
    ['copy_or_docs', 'browser_runtime'],
    ['copy_or_docs', 'responsive_layout'],
    ['visual_only', 'accessibility_or_focus'],
    ['visual_only', 'process_runtime'],
    ['visual_only', 'browser_runtime'],
    ['visual_only', 'responsive_layout'],
  ];

  for (var i = 0; i < contradictions.length; i++) {
    var a = contradictions[i][0];
    var b = contradictions[i][1];
    if (capabilities.indexOf(a) !== -1 && capabilities.indexOf(b) !== -1) {
      throw new PlanError(ERROR_CODES.CONTRADICTORY_CAPABILITY,
        'Contradictory capabilities: ' + a + ' and ' + b);
    }
  }
}

/* ── Build execution group plan ──────────────────────────────── */
function buildPlan(policy, effectiveTier, uiClass, capabilities) {
  var plan = {
    classification: {
      tier: effectiveTier,
      ui_class: uiClass,
      capabilities: capabilities.slice().sort(),
    },
    effective_tier: effectiveTier,
    required_groups: [],
    conditional_groups: [],
    manual_evidence_required: false,
    manual_evidence_groups: [],
    local_validation_required: false,
    browser_evidence_required: false,
    production_verification_required: false,
    merge_blockers: [],
    validation_outcome: 'PASS',
    notes: [],
  };

  // Required groups from tier
  var requiredByTier = policy.execution_group_policy.required_groups[effectiveTier] || [];
  for (var i = 0; i < requiredByTier.length; i++) {
    plan.required_groups.push(requiredByTier[i]);
  }

  // Conditional groups
  var rules = policy.execution_group_policy.conditional_groups.rules;
  for (var r = 0; r < rules.length; r++) {
    var rule = rules[r];
    if (capabilities.indexOf(rule.capability) !== -1) {
      if (rule.affected_tiers.indexOf(effectiveTier) !== -1) {
        for (var g = 0; g < rule.conditional_groups.length; g++) {
          var cg = rule.conditional_groups[g];
          if (plan.required_groups.indexOf(cg) === -1 && plan.conditional_groups.indexOf(cg) === -1) {
            plan.conditional_groups.push(cg);
          }
        }
      }
    }
  }

  // Manual evidence obligations
  var manualTriggerCaps = policy.execution_group_policy.manual_evidence_groups.triggers.capabilities;
  for (var c = 0; c < capabilities.length; c++) {
    if (manualTriggerCaps.indexOf(capabilities[c]) !== -1) {
      plan.manual_evidence_required = true;
      plan.manual_evidence_groups = policy.execution_group_policy.manual_evidence_groups.groups.slice();
      break;
    }
  }

  // Browser evidence
  if (capabilities.indexOf('browser_runtime') !== -1 || capabilities.indexOf('responsive_layout') !== -1) {
    if (effectiveTier === 'TIER_2' || effectiveTier === 'TIER_3') {
      plan.browser_evidence_required = true;
    }
  }

  // Local Validation
  if (effectiveTier === 'TIER_3') {
    plan.local_validation_required = true;
  }
  if (capabilities.indexOf('auth_or_session') !== -1 || capabilities.indexOf('database') !== -1) {
    plan.local_validation_required = true;
  }

  // Production verification
  if (effectiveTier === 'TIER_3') {
    plan.production_verification_required = true;
  }

  // Merge blockers
  if (policy.merge_blockers && policy.merge_blockers.hard_blockers) {
    plan.merge_blockers = policy.merge_blockers.hard_blockers.slice();
  }

  // Notes
  if (uiClass === 'NOT_APPLICABLE' || uiClass === 'U0' || uiClass === 'U1') {
    plan.notes.push('Local Validation: NOT_REQUIRED by default');
  }
  if (effectiveTier === 'TIER_3' && (capabilities.indexOf('database') !== -1 || capabilities.indexOf('migration') !== -1)) {
    plan.notes.push('DB/migration capability detected: DB_ENGINE execution group required');
  }
  if (capabilities.indexOf('provider_or_network') !== -1) {
    plan.notes.push('Provider/network capability: automatic execution prohibited; manual evidence only');
  }

  // Validate all groups against registry
  var registry = readRegistry();
  var validGroups = registry.group_enum;
  var allGroups = plan.required_groups.concat(plan.conditional_groups, plan.manual_evidence_groups);
  for (var v = 0; v < allGroups.length; v++) {
    if (validGroups.indexOf(allGroups[v]) === -1) {
      throw new PlanError(ERROR_CODES.UNKNOWN_EXECUTION_GROUP,
        'Unknown execution group: ' + allGroups[v]);
    }
  }

  return plan;
}

/* ── Output formatters ───────────────────────────────────────── */
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
  if (plan.required_groups.length === 0) {
    lines.push('  (none)');
  } else {
    for (var i = 0; i < plan.required_groups.length; i++) {
      lines.push('  - ' + plan.required_groups[i]);
    }
  }
  lines.push('');
  lines.push('CONDITIONAL GROUPS');
  if (plan.conditional_groups.length === 0) {
    lines.push('  (none)');
  } else {
    for (var j = 0; j < plan.conditional_groups.length; j++) {
      lines.push('  - ' + plan.conditional_groups[j]);
    }
  }
  lines.push('');
  lines.push('MANUAL EVIDENCE: ' + (plan.manual_evidence_required ? 'REQUIRED' : 'NOT REQUIRED'));
  if (plan.manual_evidence_groups.length > 0) {
    for (var k = 0; k < plan.manual_evidence_groups.length; k++) {
      lines.push('  - ' + plan.manual_evidence_groups[k]);
    }
  }
  lines.push('');
  lines.push('LOCAL VALIDATION: ' + (plan.local_validation_required ? 'REQUIRED' : 'NOT REQUIRED'));
  lines.push('BROWSER/RUNTIME EVIDENCE: ' + (plan.browser_evidence_required ? 'REQUIRED' : 'NOT REQUIRED'));
  lines.push('PRODUCTION VERIFICATION: ' + (plan.production_verification_required ? 'REQUIRED' : 'NOT REQUIRED'));
  lines.push('');
  lines.push('MERGE BLOCKERS');
  if (plan.merge_blockers.length === 0) {
    lines.push('  (none)');
  } else {
    for (var m = 0; m < plan.merge_blockers.length; m++) {
      lines.push('  - ' + plan.merge_blockers[m]);
    }
  }
  lines.push('');
  lines.push('VALIDATION OUTCOME: ' + plan.validation_outcome);
  if (plan.notes.length > 0) {
    lines.push('');
    lines.push('NOTES');
    for (var n = 0; n < plan.notes.length; n++) {
      lines.push('  - ' + plan.notes[n]);
    }
  }
  return lines.join('\n');
}

function buildJsonOutput(plan) {
  return JSON.stringify(plan, null, 2);
}

/* ── Main run ────────────────────────────────────────────────── */
function run(argv) {
  var args = parseArgs(argv);
  var policy = readPolicy();
  validatePolicySchema(policy);
  validateInputs(policy, args.tier, args.uiClass, args.capabilities);
  validateTierUiCombination(policy, args.tier, args.uiClass);
  detectContradictions(args.capabilities);
  var effectiveTier = applyEscalationRules(policy, args.tier, args.uiClass, args.capabilities);
  var plan = buildPlan(policy, effectiveTier, args.uiClass, args.capabilities);

  if (args.json) {
    return buildJsonOutput(plan);
  }
  return buildHumanOutput(plan);
}

/* ── CLI entry point ─────────────────────────────────────────── */
function main() {
  try {
    var output = run(process.argv);
    console.log(output);
    process.exitCode = 0;
  } catch (e) {
    if (e instanceof PlanError) {
      console.error(e.message);
      process.exitCode = 1;
    } else {
      console.error('UNEXPECTED_ERROR: ' + (e.message || String(e)));
      process.exitCode = 2;
    }
  }
}

if (require.main === module) {
  main();
}

/* ── Exports for contract test ───────────────────────────────── */
module.exports = {
  ERROR_CODES: ERROR_CODES,
  PlanError: PlanError,
  readPolicy: readPolicy,
  readRegistry: readRegistry,
  validatePolicySchema: validatePolicySchema,
  parseArgs: parseArgs,
  validateInputs: validateInputs,
  validateTierUiCombination: validateTierUiCombination,
  applyEscalationRules: applyEscalationRules,
  detectContradictions: detectContradictions,
  buildPlan: buildPlan,
  buildHumanOutput: buildHumanOutput,
  buildJsonOutput: buildJsonOutput,
  run: run,
  POLICY_PATH: POLICY_PATH,
  REGISTRY_PATH: REGISTRY_PATH,
  ROOT: ROOT,
};
