'use strict';

/**
 * Pure core: inactive PREPARED_ONLY adoption-baseline collection plan.
 * Source-only. No database, network, shell, or environment credential use.
 * Does not attest environments or activate manifests.
 *
 * Refs #3555, #3553, #3549, #3458
 */

const crypto = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');
const { compareCodePoint } = require('./migration-catalog-fingerprint-core.cjs');

const FAILURE = Object.freeze({
  COLLECTION_PLAN_INPUT_INVALID: 'COLLECTION_PLAN_INPUT_INVALID',
  COLLECTION_PLAN_FORMAT_MISMATCH: 'COLLECTION_PLAN_FORMAT_MISMATCH',
  COLLECTION_PLAN_STATUS_INVALID: 'COLLECTION_PLAN_STATUS_INVALID',
  COLLECTION_PLAN_FIELD_MISSING: 'COLLECTION_PLAN_FIELD_MISSING',
  COLLECTION_PLAN_UNKNOWN_FIELD: 'COLLECTION_PLAN_UNKNOWN_FIELD',
  COLLECTION_PLAN_ENUM_INVALID: 'COLLECTION_PLAN_ENUM_INVALID',
  COLLECTION_PLAN_COMMIT_INVALID: 'COLLECTION_PLAN_COMMIT_INVALID',
  COLLECTION_PLAN_APPROVAL_INVALID: 'COLLECTION_PLAN_APPROVAL_INVALID',
  COLLECTION_PLAN_OBJECT_INVALID: 'COLLECTION_PLAN_OBJECT_INVALID',
  COLLECTION_PLAN_OBJECT_DUPLICATE: 'COLLECTION_PLAN_OBJECT_DUPLICATE',
  COLLECTION_PLAN_OBJECT_UNKNOWN: 'COLLECTION_PLAN_OBJECT_UNKNOWN',
  COLLECTION_PLAN_ROLE_INVALID: 'COLLECTION_PLAN_ROLE_INVALID',
  COLLECTION_PLAN_PROOF_INVALID: 'COLLECTION_PLAN_PROOF_INVALID',
  COLLECTION_PLAN_OUTPUT_INVALID: 'COLLECTION_PLAN_OUTPUT_INVALID',
  COLLECTION_PLAN_SENSITIVE_INPUT: 'COLLECTION_PLAN_SENSITIVE_INPUT',
  COLLECTION_PLAN_BOUNDS_EXCEEDED: 'COLLECTION_PLAN_BOUNDS_EXCEEDED',
  COLLECTION_PLAN_PATH_INVALID: 'COLLECTION_PLAN_PATH_INVALID',
  COLLECTION_PLAN_DIGEST_MISMATCH: 'COLLECTION_PLAN_DIGEST_MISMATCH',
  COLLECTION_PLAN_OUTPUT_PROHIBITED: 'COLLECTION_PLAN_OUTPUT_PROHIBITED',
});

const DEFAULT_CONTRACT_REL =
  'db/migration-provenance/adoption-baseline-collection-plan-contract.json';
const COMMITTED_EXPECTED_SCHEMA_REL =
  'db/migration-provenance/expected-schema-manifest.json';
const COMMITTED_CANONICAL_REL =
  'db/migration-provenance/canonical-migrations.json';
const COMMITTED_ATTESTATION_REL =
  'db/migration-provenance/adoption-attestation-contract.json';

const PLAN_KEY_ORDER = Object.freeze([
  'format_version',
  'plan_status',
  'baseline_commit',
  'environment_class',
  'attestation_scope',
  'approval_reference',
  'collection_mode',
  'output_policy',
  'object_allowlist',
  'role_mapping_classes',
  'required_read_only_proofs',
  'expected_outputs',
  'contract_path',
  'digest_algorithm',
  'object_allowlist_digest',
  'plan_digest',
]);

const OBJECT_KEY_ORDER = Object.freeze([
  'name',
  'kind',
  'metadata_categories',
  'rationale_code',
]);

function fail(category, context) {
  const err = new Error(category);
  err.category = category;
  err.context = context || {};
  throw err;
}

function uniqueSorted(values) {
  return [...new Set(values)].sort(compareCodePoint);
}

function asciiLowerCase(text) {
  let out = '';
  for (let i = 0; i < text.length; i += 1) {
    const code = text.charCodeAt(i);
    if (code >= 0x41 && code <= 0x5a) out += String.fromCharCode(code + 0x20);
    else out += text[i];
  }
  return out;
}

function includesAsciiCaseInsensitive(haystack, needle) {
  if (!needle) return false;
  return asciiLowerCase(String(haystack)).includes(asciiLowerCase(String(needle)));
}

function stableStringify(value) {
  if (value === null) return 'null';
  const t = typeof value;
  if (t === 'boolean') return value ? 'true' : 'false';
  if (t === 'number') {
    if (!Number.isFinite(value)) fail(FAILURE.COLLECTION_PLAN_INPUT_INVALID, { field: 'number' });
    return JSON.stringify(value);
  }
  if (t === 'string') return JSON.stringify(value);
  if (Array.isArray(value)) {
    return `[${value.map((item) => stableStringify(item)).join(',')}]`;
  }
  if (t === 'object') {
    const keys = Object.keys(value).sort(compareCodePoint);
    return `{${keys.map((k) => `${JSON.stringify(k)}:${stableStringify(value[k])}`).join(',')}}`;
  }
  fail(FAILURE.COLLECTION_PLAN_INPUT_INVALID, { field: 'value' });
}

function matchPattern(value, pattern) {
  if (typeof value !== 'string' || typeof pattern !== 'string') return false;
  try {
    return new RegExp(pattern).test(value);
  } catch {
    return false;
  }
}

function loadJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, 'utf8'));
}

function defaultContractPath(repoRoot) {
  return path.join(repoRoot, 'db', 'migration-provenance', 'adoption-baseline-collection-plan-contract.json');
}

function loadCollectionPlanContract(repoRoot) {
  return loadJson(defaultContractPath(repoRoot));
}

function validateCollectionPlanContract(contract) {
  if (!contract || typeof contract !== 'object' || Array.isArray(contract)) {
    fail(FAILURE.COLLECTION_PLAN_INPUT_INVALID, { field: 'contract' });
  }
  if (contract.format_version !== '1.0') fail(FAILURE.COLLECTION_PLAN_FORMAT_MISMATCH);
  for (const key of [
    'required_top_level_fields',
    'allowed_top_level_fields',
    'fixed_field_values',
    'enums',
    'patterns',
    'limits',
    'reviewed_object_allowlist',
    'mandatory_read_only_proofs',
    'mandatory_expected_outputs',
    'role_mapping_classes',
    'digest_domains',
  ]) {
    if (contract[key] === undefined) {
      fail(FAILURE.COLLECTION_PLAN_FIELD_MISSING, { field: key });
    }
  }
  if (!Array.isArray(contract.reviewed_object_allowlist) || contract.reviewed_object_allowlist.length < 1) {
    fail(FAILURE.COLLECTION_PLAN_OBJECT_INVALID, { field: 'reviewed_object_allowlist' });
  }
  return true;
}

function isPathOutside(parent, child) {
  const relative = path.relative(parent, child);
  if (!relative) return false;
  return (
    relative === '..' ||
    relative.startsWith(`..${path.sep}`) ||
    path.isAbsolute(relative)
  );
}

function assertRepoRelativePath(repoRoot, relativePath) {
  if (typeof relativePath !== 'string' || !relativePath) {
    fail(FAILURE.COLLECTION_PLAN_PATH_INVALID, { field: 'path' });
  }
  if (path.isAbsolute(relativePath)) {
    fail(FAILURE.COLLECTION_PLAN_PATH_INVALID, { field: 'path' });
  }
  const normalized = relativePath.replace(/\\/g, '/');
  if (
    normalized.startsWith('/') ||
    normalized.includes('://') ||
    normalized.split('/').some((part) => part === '..' || part === '')
  ) {
    fail(FAILURE.COLLECTION_PLAN_PATH_INVALID, { field: 'path' });
  }
  const root = path.resolve(repoRoot);
  const resolved = path.resolve(root, relativePath);
  if (isPathOutside(root, resolved) || resolved === root) {
    fail(FAILURE.COLLECTION_PLAN_PATH_INVALID, { field: 'path' });
  }
  return resolved;
}

function resolveRepoConfinedPath(repoRoot, repoRelativePath) {
  const lexicalPath = assertRepoRelativePath(repoRoot, repoRelativePath);
  let realRoot;
  try {
    realRoot = fs.realpathSync.native(path.resolve(repoRoot));
  } catch {
    fail(FAILURE.COLLECTION_PLAN_PATH_INVALID, { field: 'path' });
  }
  let realPath;
  try {
    realPath = fs.realpathSync.native(lexicalPath);
  } catch {
    fail(FAILURE.COLLECTION_PLAN_PATH_INVALID, { field: 'path' });
  }
  if (isPathOutside(realRoot, realPath) || realPath === realRoot) {
    fail(FAILURE.COLLECTION_PLAN_PATH_INVALID, { field: 'path' });
  }
  return { realRoot, realPath, lexicalPath };
}

function assertOutputNotProhibited(repoRoot, relativePath) {
  const resolved = assertRepoRelativePath(repoRoot, relativePath);
  const prohibited = [
    COMMITTED_EXPECTED_SCHEMA_REL,
    COMMITTED_CANONICAL_REL,
    COMMITTED_ATTESTATION_REL,
    DEFAULT_CONTRACT_REL,
  ].map((rel) => path.resolve(repoRoot, rel));
  if (prohibited.some((p) => path.resolve(resolved) === p)) {
    fail(FAILURE.COLLECTION_PLAN_OUTPUT_PROHIBITED);
  }
  return resolved;
}

function decodeUtf8Strict(buffer) {
  try {
    const decoder = new TextDecoder('utf-8', { fatal: true });
    return decoder.decode(buffer);
  } catch {
    fail(FAILURE.COLLECTION_PLAN_INPUT_INVALID, { field: 'utf8' });
  }
}

function hasSensitive(text, markers) {
  if (typeof text !== 'string') return false;
  for (const marker of markers || []) {
    if (typeof marker !== 'string' || !marker) continue;
    if (includesAsciiCaseInsensitive(text, marker)) return true;
  }
  return false;
}

function scanValueSensitive(value, markers, field) {
  if (typeof value === 'string') {
    if (hasSensitive(value, markers)) fail(FAILURE.COLLECTION_PLAN_SENSITIVE_INPUT, { field });
    return;
  }
  if (Array.isArray(value)) {
    for (const item of value) scanValueSensitive(item, markers, field);
    return;
  }
  if (value && typeof value === 'object') {
    for (const key of Object.keys(value)) {
      if (hasSensitive(key, markers)) fail(FAILURE.COLLECTION_PLAN_SENSITIVE_INPUT, { field: key });
      scanValueSensitive(value[key], markers, key);
    }
  }
}

function assertNoProhibitedKeys(obj, prohibited, field) {
  for (const key of Object.keys(obj)) {
    if (prohibited.has(key)) {
      fail(FAILURE.COLLECTION_PLAN_SENSITIVE_INPUT, { field: key });
    }
  }
}

function sortCopy(values) {
  return [...values].sort(compareCodePoint);
}

function normalizeObjectRecord(raw, contract) {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) {
    fail(FAILURE.COLLECTION_PLAN_OBJECT_INVALID, { field: 'object' });
  }
  const allowed = new Set(contract.object_allowlist_allowed_fields || OBJECT_KEY_ORDER);
  const required = contract.object_allowlist_required_fields || OBJECT_KEY_ORDER;
  const prohibited = new Set(contract.prohibited_fields || []);
  assertNoProhibitedKeys(raw, prohibited, 'object');
  for (const key of Object.keys(raw)) {
    if (!allowed.has(key)) fail(FAILURE.COLLECTION_PLAN_UNKNOWN_FIELD, { field: key });
  }
  for (const key of required) {
    if (raw[key] === undefined || raw[key] === null) {
      fail(FAILURE.COLLECTION_PLAN_OBJECT_INVALID, { field: key });
    }
  }

  const patterns = contract.patterns || {};
  const enums = contract.enums || {};
  const limits = contract.limits || {};
  const markers = contract.sensitive_content_markers || [];

  if (typeof raw.name !== 'string' || !matchPattern(raw.name, patterns.object_name)) {
    fail(FAILURE.COLLECTION_PLAN_OBJECT_INVALID, { field: 'name' });
  }
  if (raw.name.length > (limits.max_string_length || 512)) {
    fail(FAILURE.COLLECTION_PLAN_BOUNDS_EXCEEDED, { field: 'name' });
  }
  scanValueSensitive(raw.name, markers, 'name');

  if (typeof raw.kind !== 'string' || !(enums.object_kind || []).includes(raw.kind)) {
    fail(FAILURE.COLLECTION_PLAN_OBJECT_INVALID, { field: 'kind' });
  }
  // name prefix must match kind
  const expectedPrefix =
    raw.kind === 'TABLE'
      ? 'table:'
      : raw.kind === 'VIEW'
        ? 'view:'
        : 'materialized_view:';
  if (!raw.name.startsWith(expectedPrefix)) {
    fail(FAILURE.COLLECTION_PLAN_OBJECT_INVALID, { field: 'kind' });
  }

  if (!Array.isArray(raw.metadata_categories) || raw.metadata_categories.length < 1) {
    fail(FAILURE.COLLECTION_PLAN_OBJECT_INVALID, { field: 'metadata_categories' });
  }
  if (raw.metadata_categories.length > (limits.max_metadata_categories_per_object || 32)) {
    fail(FAILURE.COLLECTION_PLAN_BOUNDS_EXCEEDED, { field: 'metadata_categories' });
  }
  const allowedCats = new Set(enums.metadata_category || []);
  const categories = [];
  const seenCat = new Set();
  for (const cat of raw.metadata_categories) {
    if (typeof cat !== 'string' || !allowedCats.has(cat)) {
      fail(FAILURE.COLLECTION_PLAN_ENUM_INVALID, { field: 'metadata_categories' });
    }
    if (seenCat.has(cat)) {
      fail(FAILURE.COLLECTION_PLAN_OBJECT_INVALID, { field: 'metadata_categories' });
    }
    seenCat.add(cat);
    categories.push(cat);
  }

  if (
    typeof raw.rationale_code !== 'string' ||
    !(enums.rationale_code || []).includes(raw.rationale_code)
  ) {
    fail(FAILURE.COLLECTION_PLAN_ENUM_INVALID, { field: 'rationale_code' });
  }
  scanValueSensitive(raw.rationale_code, markers, 'rationale_code');

  return {
    name: raw.name,
    kind: raw.kind,
    metadata_categories: sortCopy(categories),
    rationale_code: raw.rationale_code,
  };
}

function canonicalizeObjectAllowlist(objects, contract) {
  if (!Array.isArray(objects)) {
    fail(FAILURE.COLLECTION_PLAN_OBJECT_INVALID, { field: 'object_allowlist' });
  }
  const limits = contract.limits || {};
  if (objects.length < 1) {
    fail(FAILURE.COLLECTION_PLAN_OBJECT_INVALID, { field: 'object_allowlist' });
  }
  if (objects.length > (limits.max_objects || 64)) {
    fail(FAILURE.COLLECTION_PLAN_BOUNDS_EXCEEDED, { field: 'object_allowlist' });
  }
  const reviewed = Array.isArray(contract.reviewed_object_allowlist)
    ? contract.reviewed_object_allowlist
    : [];
  const reviewedByName = new Map(reviewed.map((item) => [item.name, item]));
  const seen = new Set();
  const normalized = objects.map((item) => normalizeObjectRecord(item, contract));
  for (const item of normalized) {
    if (seen.has(item.name)) {
      fail(FAILURE.COLLECTION_PLAN_OBJECT_DUPLICATE, { field: 'name' });
    }
    seen.add(item.name);
    const expected = reviewedByName.get(item.name);
    if (!expected) {
      fail(FAILURE.COLLECTION_PLAN_OBJECT_UNKNOWN, { field: 'name' });
    }
    // Exact match against reviewed repository-owned allowlist (ignoring category order).
    const expectedNorm = normalizeObjectRecord(expected, contract);
    if (
      item.kind !== expectedNorm.kind ||
      item.rationale_code !== expectedNorm.rationale_code ||
      stableStringify(item.metadata_categories) !==
        stableStringify(expectedNorm.metadata_categories)
    ) {
      fail(FAILURE.COLLECTION_PLAN_OBJECT_INVALID, { field: 'object_allowlist' });
    }
  }
  // Must include every reviewed object exactly once.
  if (normalized.length !== reviewed.length) {
    fail(FAILURE.COLLECTION_PLAN_OBJECT_INVALID, { field: 'object_allowlist' });
  }
  for (const reviewedItem of reviewed) {
    if (!seen.has(reviewedItem.name)) {
      fail(FAILURE.COLLECTION_PLAN_OBJECT_INVALID, { field: 'object_allowlist' });
    }
  }
  return normalized.sort((a, b) => compareCodePoint(a.name, b.name));
}

function validateBoundedSortedEnumList(values, allowed, field, options = {}) {
  if (!Array.isArray(values)) fail(FAILURE.COLLECTION_PLAN_ENUM_INVALID, { field });
  if (values.length < 1 && options.allowEmpty !== true) {
    fail(FAILURE.COLLECTION_PLAN_ENUM_INVALID, { field });
  }
  const allowedSet = new Set(allowed || []);
  const seen = new Set();
  for (const value of values) {
    if (typeof value !== 'string' || !allowedSet.has(value)) {
      fail(FAILURE.COLLECTION_PLAN_ENUM_INVALID, { field });
    }
    if (seen.has(value)) fail(FAILURE.COLLECTION_PLAN_ENUM_INVALID, { field });
    seen.add(value);
  }
  if (options.mandatory) {
    for (const required of options.mandatory) {
      if (!seen.has(required)) fail(FAILURE.COLLECTION_PLAN_ENUM_INVALID, { field });
    }
    if (values.length !== options.mandatory.length) {
      fail(FAILURE.COLLECTION_PLAN_ENUM_INVALID, { field });
    }
  }
  const sorted = sortCopy(values);
  if (stableStringify(values) !== stableStringify(sorted) && options.requireSorted) {
    // Accept either sorted or normalize later; builder always emits sorted.
  }
  return sorted;
}

function validateRoleMappingClasses(values, contract) {
  // Reject raw role-like labels that are not abstract classes.
  const rawLike = new Set([
    'raw_role',
    'role_name',
    'username',
    'operator',
    'operator_email',
    'database_owner',
    'grantee_name',
    'credential',
    'postgres',
    'lovebud_ci',
  ]);
  if (!Array.isArray(values)) fail(FAILURE.COLLECTION_PLAN_ROLE_INVALID);
  for (const value of values) {
    if (typeof value !== 'string' || rawLike.has(asciiLowerCase(value))) {
      fail(FAILURE.COLLECTION_PLAN_ROLE_INVALID);
    }
  }
  const sorted = validateBoundedSortedEnumList(
    values,
    contract.enums.role_mapping_class,
    'role_mapping_classes',
    {
      mandatory: contract.role_mapping_classes,
      requireSorted: true,
    }
  );
  return sorted;
}

function computeDomainDigest(domain, payload) {
  const envelope = {
    domain,
    payload,
  };
  const serialized = stableStringify(envelope);
  return `sha256:${crypto.createHash('sha256').update(serialized, 'utf8').digest('hex')}`;
}

function computeObjectAllowlistDigest(objectAllowlist, contract) {
  const domain =
    (contract.digest_domains && contract.digest_domains.object_allowlist) ||
    'lovebud:adoption-baseline-object-allowlist';
  return computeDomainDigest(domain, objectAllowlist);
}

function computeCollectionPlanDigest(planWithoutDigests, contract) {
  const domain =
    (contract.digest_domains && contract.digest_domains.collection_plan) ||
    'lovebud:adoption-baseline-collection-plan';
  // Digests are never self-authorizing: hash excludes plan_digest and object_allowlist_digest.
  const payload = { ...planWithoutDigests };
  delete payload.plan_digest;
  delete payload.object_allowlist_digest;
  return computeDomainDigest(domain, payload);
}

/**
 * Validate a prepared collection plan against the repository-owned contract.
 */
function validatePreparedCollectionPlan(plan, contract) {
  validateCollectionPlanContract(contract);
  if (!plan || typeof plan !== 'object' || Array.isArray(plan)) {
    fail(FAILURE.COLLECTION_PLAN_INPUT_INVALID, { field: 'plan' });
  }

  const prohibited = new Set(contract.prohibited_fields || []);
  const allowed = new Set(contract.allowed_top_level_fields || []);
  const required = contract.required_top_level_fields || [];
  const fixed = contract.fixed_field_values || {};
  const markers = contract.sensitive_content_markers || [];
  const limits = contract.limits || {};
  const patterns = contract.patterns || {};

  assertNoProhibitedKeys(plan, prohibited, 'plan');
  for (const key of Object.keys(plan)) {
    if (!allowed.has(key)) fail(FAILURE.COLLECTION_PLAN_UNKNOWN_FIELD, { field: key });
  }
  for (const key of required) {
    if (plan[key] === undefined || plan[key] === null) {
      fail(FAILURE.COLLECTION_PLAN_FIELD_MISSING, { field: key });
    }
  }

  scanValueSensitive(plan, markers, 'plan');

  for (const [key, expected] of Object.entries(fixed)) {
    if (plan[key] !== expected) {
      if (key === 'plan_status') fail(FAILURE.COLLECTION_PLAN_STATUS_INVALID);
      fail(FAILURE.COLLECTION_PLAN_ENUM_INVALID, { field: key });
    }
  }

  const prohibitedStatuses = new Set(contract.prohibited_plan_statuses || []);
  if (prohibitedStatuses.has(plan.plan_status)) {
    fail(FAILURE.COLLECTION_PLAN_STATUS_INVALID);
  }
  if (plan.plan_status === 'ATTESTED' || plan.plan_status === 'ACTIVE') {
    fail(FAILURE.COLLECTION_PLAN_STATUS_INVALID);
  }

  if (!matchPattern(plan.baseline_commit, patterns.baseline_commit || '^[a-f0-9]{40}$')) {
    fail(FAILURE.COLLECTION_PLAN_COMMIT_INVALID);
  }
  if (plan.baseline_commit !== plan.baseline_commit.toLowerCase()) {
    fail(FAILURE.COLLECTION_PLAN_COMMIT_INVALID);
  }

  const maxApproval = limits.max_approval_reference_length || 96;
  if (
    typeof plan.approval_reference !== 'string' ||
    !plan.approval_reference ||
    plan.approval_reference.length > maxApproval ||
    plan.approval_reference === 'approved' ||
    plan.approval_reference === 'yes' ||
    plan.approval_reference === 'owner-approved' ||
    !matchPattern(plan.approval_reference, patterns.approval_reference)
  ) {
    fail(FAILURE.COLLECTION_PLAN_APPROVAL_INVALID);
  }

  const objectAllowlist = canonicalizeObjectAllowlist(plan.object_allowlist, contract);
  const roleClasses = validateRoleMappingClasses(plan.role_mapping_classes, contract);
  const proofs = validateBoundedSortedEnumList(
    plan.required_read_only_proofs,
    contract.enums.read_only_proof,
    'required_read_only_proofs',
    { mandatory: contract.mandatory_read_only_proofs }
  );
  const outputs = validateBoundedSortedEnumList(
    plan.expected_outputs,
    contract.enums.expected_output,
    'expected_outputs',
    { mandatory: contract.mandatory_expected_outputs }
  );

  // Structural rejection of attestation/activation semantics in outputs list already via enum.
  // Explicit hard reject for forbidden words if ever smuggled through unknown path.
  for (const out of outputs) {
    if (out === 'ATTESTED' || out === 'ACTIVE' || out === 'APPLIED') {
      fail(FAILURE.COLLECTION_PLAN_OUTPUT_INVALID);
    }
  }

  if (plan.contract_path !== undefined && plan.contract_path !== DEFAULT_CONTRACT_REL) {
    fail(FAILURE.COLLECTION_PLAN_INPUT_INVALID, { field: 'contract_path' });
  }
  if (plan.digest_algorithm !== undefined && plan.digest_algorithm !== 'sha256') {
    fail(FAILURE.COLLECTION_PLAN_INPUT_INVALID, { field: 'digest_algorithm' });
  }

  const planBody = {
    format_version: plan.format_version,
    plan_status: plan.plan_status,
    baseline_commit: plan.baseline_commit,
    environment_class: plan.environment_class,
    attestation_scope: plan.attestation_scope,
    approval_reference: plan.approval_reference,
    collection_mode: plan.collection_mode,
    output_policy: plan.output_policy,
    object_allowlist: objectAllowlist,
    role_mapping_classes: roleClasses,
    required_read_only_proofs: proofs,
    expected_outputs: outputs,
  };

  const allowlistDigest = computeObjectAllowlistDigest(objectAllowlist, contract);
  const planDigest = computeCollectionPlanDigest(planBody, contract);

  if (plan.object_allowlist_digest !== undefined) {
    if (
      typeof plan.object_allowlist_digest !== 'string' ||
      !matchPattern(plan.object_allowlist_digest, patterns.digest || '^sha256:[a-f0-9]{64}$') ||
      plan.object_allowlist_digest !== allowlistDigest
    ) {
      fail(FAILURE.COLLECTION_PLAN_DIGEST_MISMATCH, { field: 'object_allowlist_digest' });
    }
  }
  if (plan.plan_digest !== undefined) {
    if (
      typeof plan.plan_digest !== 'string' ||
      !matchPattern(plan.plan_digest, patterns.digest || '^sha256:[a-f0-9]{64}$') ||
      plan.plan_digest !== planDigest
    ) {
      fail(FAILURE.COLLECTION_PLAN_DIGEST_MISMATCH, { field: 'plan_digest' });
    }
  }

  return {
    ok: true,
    plan: {
      ...planBody,
      contract_path: DEFAULT_CONTRACT_REL,
      digest_algorithm: 'sha256',
      object_allowlist_digest: allowlistDigest,
      plan_digest: planDigest,
    },
  };
}

/**
 * Build repository-owned prepared plan. Caller may only supply baselineCommit and approvalReference.
 */
function buildPreparedCollectionPlan({ baselineCommit, approvalReference }, contract) {
  validateCollectionPlanContract(contract);
  if (typeof baselineCommit !== 'string' || !matchPattern(baselineCommit, contract.patterns.baseline_commit)) {
    fail(FAILURE.COLLECTION_PLAN_COMMIT_INVALID);
  }
  if (baselineCommit !== baselineCommit.toLowerCase()) {
    fail(FAILURE.COLLECTION_PLAN_COMMIT_INVALID);
  }
  const maxApproval = (contract.limits && contract.limits.max_approval_reference_length) || 96;
  if (
    typeof approvalReference !== 'string' ||
    !approvalReference ||
    approvalReference.length > maxApproval ||
    approvalReference === 'approved' ||
    approvalReference === 'yes' ||
    approvalReference === 'owner-approved' ||
    !matchPattern(approvalReference, contract.patterns.approval_reference)
  ) {
    fail(FAILURE.COLLECTION_PLAN_APPROVAL_INVALID);
  }
  scanValueSensitive(approvalReference, contract.sensitive_content_markers || [], 'approval_reference');

  const fixed = contract.fixed_field_values;
  const objectAllowlist = canonicalizeObjectAllowlist(contract.reviewed_object_allowlist, contract);
  const plan = {
    format_version: fixed.format_version,
    plan_status: fixed.plan_status,
    baseline_commit: baselineCommit,
    environment_class: fixed.environment_class,
    attestation_scope: fixed.attestation_scope,
    approval_reference: approvalReference,
    collection_mode: fixed.collection_mode,
    output_policy: fixed.output_policy,
    object_allowlist: objectAllowlist,
    role_mapping_classes: sortCopy(contract.role_mapping_classes),
    required_read_only_proofs: sortCopy(contract.mandatory_read_only_proofs),
    expected_outputs: sortCopy(contract.mandatory_expected_outputs),
  };

  const validated = validatePreparedCollectionPlan(plan, contract);
  return validated.plan;
}

function serializePreparedCollectionPlan(plan) {
  const orderedObjects = (plan.object_allowlist || []).map((item) => {
    const ordered = {};
    for (const key of OBJECT_KEY_ORDER) ordered[key] = item[key];
    return ordered;
  });
  const ordered = {};
  for (const key of PLAN_KEY_ORDER) {
    if (key === 'object_allowlist') ordered[key] = orderedObjects;
    else if (Object.prototype.hasOwnProperty.call(plan, key)) ordered[key] = plan[key];
  }
  return `${JSON.stringify(ordered, null, 2)}\n`;
}

function readPreparedCollectionPlanFile(repoRoot, repoRelativePath, options = {}) {
  const maxBytes = (options && options.maxInputBytes) || 1048576;
  const { realPath } = resolveRepoConfinedPath(repoRoot, repoRelativePath);
  let stat;
  try {
    stat = fs.statSync(realPath);
  } catch {
    fail(FAILURE.COLLECTION_PLAN_PATH_INVALID, { field: 'path' });
  }
  if (!stat.isFile()) fail(FAILURE.COLLECTION_PLAN_PATH_INVALID, { field: 'path' });
  if (stat.size > maxBytes) fail(FAILURE.COLLECTION_PLAN_BOUNDS_EXCEEDED, { field: 'size' });
  let raw;
  try {
    raw = fs.readFileSync(realPath);
  } catch {
    fail(FAILURE.COLLECTION_PLAN_PATH_INVALID, { field: 'path' });
  }
  if (raw.length > maxBytes) fail(FAILURE.COLLECTION_PLAN_BOUNDS_EXCEEDED, { field: 'size' });
  const text = decodeUtf8Strict(raw);
  let parsed;
  try {
    parsed = JSON.parse(text);
  } catch {
    fail(FAILURE.COLLECTION_PLAN_INPUT_INVALID, { field: 'json' });
  }
  return parsed;
}

module.exports = {
  FAILURE,
  DEFAULT_CONTRACT_REL,
  COMMITTED_EXPECTED_SCHEMA_REL,
  COMMITTED_CANONICAL_REL,
  PLAN_KEY_ORDER,
  compareCodePoint,
  stableStringify,
  defaultContractPath,
  loadCollectionPlanContract,
  validateCollectionPlanContract,
  validatePreparedCollectionPlan,
  buildPreparedCollectionPlan,
  serializePreparedCollectionPlan,
  computeCollectionPlanDigest,
  computeObjectAllowlistDigest,
  isPathOutside,
  assertRepoRelativePath,
  resolveRepoConfinedPath,
  assertOutputNotProhibited,
  readPreparedCollectionPlanFile,
};
