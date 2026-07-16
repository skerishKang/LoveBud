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
  COLLECTION_PLAN_CONTRACT_DIGEST_MISMATCH: 'COLLECTION_PLAN_CONTRACT_DIGEST_MISMATCH',
  COLLECTION_PLAN_OUTPUT_PROHIBITED: 'COLLECTION_PLAN_OUTPUT_PROHIBITED',
  COLLECTION_PLAN_POLICY_INVALID: 'COLLECTION_PLAN_POLICY_INVALID',
});

const DEFAULT_CONTRACT_REL =
  'db/migration-provenance/adoption-baseline-collection-plan-contract.json';
const COMMITTED_EXPECTED_SCHEMA_REL =
  'db/migration-provenance/expected-schema-manifest.json';
const COMMITTED_CANONICAL_REL =
  'db/migration-provenance/canonical-migrations.json';
const COMMITTED_ATTESTATION_REL =
  'db/migration-provenance/adoption-attestation-contract.json';

/** Source constants — safety invariants independent of any caller/file override. */
const CANONICAL_FIXED = Object.freeze({
  format_version: '1.0',
  plan_status: 'PREPARED_ONLY',
  environment_class: 'PRODUCTION',
  attestation_scope: 'PRODUCTION_READONLY',
  collection_mode: 'CATALOG_METADATA_ONLY',
  output_policy: 'SANITIZED_STDOUT_ONLY',
});
const CANONICAL_PREPARED_ATTESTATION_STATUS = 'UNATTESTED';
const CANONICAL_DIGEST_ALGORITHM = 'sha256';
const CANONICAL_PROHIBITED_STATUSES = Object.freeze([
  'ATTESTED',
  'ACTIVE',
  'APPLIED',
  'APPROVED_FOR_MUTATION',
]);
const CANONICAL_ROLE_CLASSES = Object.freeze([
  'PUBLIC',
  'APPLICATION',
  'AUTHENTICATED',
  'SERVICE',
  'OWNER_CLASS',
]);
const CANONICAL_PROOFS = Object.freeze([
  'EXPLICIT_READ_ONLY_TRANSACTION',
  'READ_ONLY_TRANSACTION_CONFIRMED',
  'REPOSITORY_OWNED_SQL_ONLY',
  'NO_CALLER_SQL',
  'ALLOWLISTED_OBJECTS_ONLY',
  'NO_APPLICATION_ROW_READS',
  'ABSTRACT_ROLE_MAPPING_ONLY',
  'NO_RAW_CATALOG_OUTPUT',
  'NO_PARTIAL_SUCCESS_CLAIM',
  'BOUNDED_FAILURE_OUTPUT',
]);
const CANONICAL_OUTPUTS = Object.freeze([
  'SANITIZED_CATALOG_EVIDENCE',
  'CATALOG_EVIDENCE_DIGEST',
  'INACTIVE_EXPECTED_SCHEMA_CANDIDATE',
  'COLLECTION_PLAN_DIGEST',
  'OBJECT_ALLOWLIST_DIGEST',
  'PREPARED_ATTESTATION_DRAFT',
  'BOUNDED_COLLECTION_OUTCOME',
]);
const CANONICAL_DIGEST_DOMAINS = Object.freeze({
  collection_plan: 'lovebud:adoption-baseline-collection-plan',
  object_allowlist: 'lovebud:adoption-baseline-object-allowlist',
});
const CANONICAL_BASELINE_COMMIT_PATTERN = '^[a-f0-9]{40}$';
const CANONICAL_APPROVAL_REFERENCE_PATTERN =
  '^(?:issue:\\d+|decision:[A-Za-z0-9][A-Za-z0-9._-]{2,63})$';
const MAX_CONTRACT_BYTES = 1048576;
const MODULE_REPO_ROOT = path.resolve(__dirname, '..');

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
  'collection_plan_contract_digest',
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

function defaultContractPath(repoRoot) {
  return path.join(repoRoot, 'db', 'migration-provenance', 'adoption-baseline-collection-plan-contract.json');
}

function exactStringArrayEqual(actual, expected) {
  if (!Array.isArray(actual) || actual.length !== expected.length) return false;
  for (let i = 0; i < expected.length; i += 1) {
    if (actual[i] !== expected[i]) return false;
  }
  return true;
}

function setEqual(actual, expected) {
  if (!Array.isArray(actual) || actual.length !== expected.length) return false;
  const left = new Set(actual);
  if (left.size !== expected.length) return false;
  for (const value of expected) {
    if (!left.has(value)) return false;
  }
  return true;
}

function computeExactBytesDigest(buffer) {
  return `sha256:${crypto.createHash('sha256').update(buffer).digest('hex')}`;
}

/**
 * Strict repository-owned policy validation (used only after trusted load).
 * Not a public authorization surface for caller-supplied contracts.
 */
function validateCollectionPlanContract(contract, repoRoot) {
  if (!contract || typeof contract !== 'object' || Array.isArray(contract)) {
    fail(FAILURE.COLLECTION_PLAN_POLICY_INVALID, { field: 'contract' });
  }
  if (contract.format_version !== '1.0') fail(FAILURE.COLLECTION_PLAN_FORMAT_MISMATCH);
  if (contract.digest_algorithm !== CANONICAL_DIGEST_ALGORITHM) {
    fail(FAILURE.COLLECTION_PLAN_POLICY_INVALID, { field: 'digest_algorithm' });
  }
  if (contract.contract_path !== DEFAULT_CONTRACT_REL) {
    fail(FAILURE.COLLECTION_PLAN_POLICY_INVALID, { field: 'contract_path' });
  }
  if (contract.prepared_attestation_status !== CANONICAL_PREPARED_ATTESTATION_STATUS) {
    fail(FAILURE.COLLECTION_PLAN_POLICY_INVALID, { field: 'prepared_attestation_status' });
  }

  const fixed = contract.fixed_field_values || {};
  for (const [key, expected] of Object.entries(CANONICAL_FIXED)) {
    if (fixed[key] !== expected) {
      fail(FAILURE.COLLECTION_PLAN_POLICY_INVALID, { field: key });
    }
  }

  if (!setEqual(contract.prohibited_plan_statuses || [], CANONICAL_PROHIBITED_STATUSES)) {
    fail(FAILURE.COLLECTION_PLAN_POLICY_INVALID, { field: 'prohibited_plan_statuses' });
  }
  if (!setEqual(contract.role_mapping_classes || [], CANONICAL_ROLE_CLASSES)) {
    fail(FAILURE.COLLECTION_PLAN_POLICY_INVALID, { field: 'role_mapping_classes' });
  }
  if (!setEqual(contract.mandatory_read_only_proofs || [], CANONICAL_PROOFS)) {
    fail(FAILURE.COLLECTION_PLAN_POLICY_INVALID, { field: 'mandatory_read_only_proofs' });
  }
  if (!setEqual(contract.mandatory_expected_outputs || [], CANONICAL_OUTPUTS)) {
    fail(FAILURE.COLLECTION_PLAN_POLICY_INVALID, { field: 'mandatory_expected_outputs' });
  }
  if (
    !contract.digest_domains ||
    contract.digest_domains.collection_plan !== CANONICAL_DIGEST_DOMAINS.collection_plan ||
    contract.digest_domains.object_allowlist !== CANONICAL_DIGEST_DOMAINS.object_allowlist
  ) {
    fail(FAILURE.COLLECTION_PLAN_POLICY_INVALID, { field: 'digest_domains' });
  }

  const patterns = contract.patterns || {};
  if (patterns.baseline_commit !== CANONICAL_BASELINE_COMMIT_PATTERN) {
    fail(FAILURE.COLLECTION_PLAN_POLICY_INVALID, { field: 'baseline_commit_pattern' });
  }
  if (patterns.approval_reference !== CANONICAL_APPROVAL_REFERENCE_PATTERN) {
    fail(FAILURE.COLLECTION_PLAN_POLICY_INVALID, { field: 'approval_reference_pattern' });
  }

  if (!Array.isArray(contract.reviewed_object_allowlist) || contract.reviewed_object_allowlist.length < 1) {
    fail(FAILURE.COLLECTION_PLAN_OBJECT_INVALID, { field: 'reviewed_object_allowlist' });
  }
  if (!contract.object_selection_evidence || typeof contract.object_selection_evidence !== 'object') {
    fail(FAILURE.COLLECTION_PLAN_POLICY_INVALID, { field: 'object_selection_evidence' });
  }

  const allowNames = contract.reviewed_object_allowlist.map((item) => item && item.name).sort(compareCodePoint);
  const evidenceNames = Object.keys(contract.object_selection_evidence).sort(compareCodePoint);
  if (!exactStringArrayEqual(allowNames, evidenceNames)) {
    fail(FAILURE.COLLECTION_PLAN_POLICY_INVALID, { field: 'object_selection_evidence' });
  }

  const root = path.resolve(repoRoot || MODULE_REPO_ROOT);
  for (const name of evidenceNames) {
    const evidence = contract.object_selection_evidence[name];
    if (!evidence || !Array.isArray(evidence.repository_evidence) || evidence.repository_evidence.length < 1) {
      fail(FAILURE.COLLECTION_PLAN_POLICY_INVALID, { field: 'repository_evidence' });
    }
    for (const rel of evidence.repository_evidence) {
      if (typeof rel !== 'string' || !rel) {
        fail(FAILURE.COLLECTION_PLAN_POLICY_INVALID, { field: 'repository_evidence' });
      }
      // Existence only — never echo path or content.
      try {
        const { realPath } = resolveRepoConfinedPath(root, rel);
        const stat = fs.statSync(realPath);
        if (!stat.isFile()) fail(FAILURE.COLLECTION_PLAN_POLICY_INVALID, { field: 'repository_evidence' });
      } catch {
        fail(FAILURE.COLLECTION_PLAN_POLICY_INVALID, { field: 'repository_evidence' });
      }
    }
  }

  // Ensure reviewed allowlist objects themselves are well-formed under this contract.
  canonicalizeObjectAllowlist(contract.reviewed_object_allowlist, contract);
  return true;
}

/**
 * Canonical trusted policy loader. Fixed repository path only.
 * Returns contract object, exact file bytes, and exact-byte digest.
 */
function loadTrustedCollectionPlanContract() {
  const repoRoot = MODULE_REPO_ROOT;
  const lexicalPath = path.join(repoRoot, ...DEFAULT_CONTRACT_REL.split('/'));
  let realRoot;
  let realPath;
  try {
    realRoot = fs.realpathSync.native(path.resolve(repoRoot));
    realPath = fs.realpathSync.native(lexicalPath);
  } catch {
    fail(FAILURE.COLLECTION_PLAN_POLICY_INVALID, { field: 'contract' });
  }
  if (isPathOutside(realRoot, realPath) || realPath === realRoot) {
    fail(FAILURE.COLLECTION_PLAN_POLICY_INVALID, { field: 'contract' });
  }
  let stat;
  try {
    stat = fs.statSync(realPath);
  } catch {
    fail(FAILURE.COLLECTION_PLAN_POLICY_INVALID, { field: 'contract' });
  }
  if (!stat.isFile() || stat.size > MAX_CONTRACT_BYTES) {
    fail(FAILURE.COLLECTION_PLAN_POLICY_INVALID, { field: 'contract' });
  }
  let bytes;
  try {
    bytes = fs.readFileSync(realPath);
  } catch {
    fail(FAILURE.COLLECTION_PLAN_POLICY_INVALID, { field: 'contract' });
  }
  if (bytes.length > MAX_CONTRACT_BYTES) {
    fail(FAILURE.COLLECTION_PLAN_POLICY_INVALID, { field: 'contract' });
  }
  const text = decodeUtf8Strict(bytes);
  let contract;
  try {
    contract = JSON.parse(text);
  } catch {
    fail(FAILURE.COLLECTION_PLAN_POLICY_INVALID, { field: 'contract' });
  }
  validateCollectionPlanContract(contract, repoRoot);
  return {
    contract,
    contractBytes: bytes,
    contractDigest: computeExactBytesDigest(bytes),
    repoRoot,
  };
}

/** @deprecated Prefer loadTrustedCollectionPlanContract — kept for path helper tests only. */
function loadCollectionPlanContract(repoRoot) {
  if (repoRoot && path.resolve(repoRoot) !== path.resolve(MODULE_REPO_ROOT)) {
    fail(FAILURE.COLLECTION_PLAN_POLICY_INVALID, { field: 'contract' });
  }
  return loadTrustedCollectionPlanContract().contract;
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

function validateRoleMappingClasses(values) {
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
  const sorted = validateBoundedSortedEnumList(values, CANONICAL_ROLE_CLASSES, 'role_mapping_classes', {
    mandatory: CANONICAL_ROLE_CLASSES,
    requireSorted: true,
  });
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

function computeObjectAllowlistDigest(objectAllowlist) {
  return computeDomainDigest(CANONICAL_DIGEST_DOMAINS.object_allowlist, objectAllowlist);
}

/**
 * Plan digest binds every emitted field except plan_digest itself.
 * Includes contract_path, digest_algorithm, collection_plan_contract_digest,
 * and object_allowlist_digest.
 */
function computeCollectionPlanDigest(planWithoutPlanDigest) {
  const payload = { ...planWithoutPlanDigest };
  delete payload.plan_digest;
  return computeDomainDigest(CANONICAL_DIGEST_DOMAINS.collection_plan, payload);
}

/**
 * Unconditional safety invariants from source constants.
 * Never depend solely on caller- or file-provided fixed_field_values.
 */
function assertUnconditionalSafetyInvariants(plan) {
  if (!plan || typeof plan !== 'object' || Array.isArray(plan)) {
    fail(FAILURE.COLLECTION_PLAN_INPUT_INVALID, { field: 'plan' });
  }
  if (
    typeof plan.plan_status === 'string' &&
    CANONICAL_PROHIBITED_STATUSES.includes(plan.plan_status)
  ) {
    fail(FAILURE.COLLECTION_PLAN_STATUS_INVALID);
  }
  if (plan.plan_status !== CANONICAL_FIXED.plan_status) {
    fail(FAILURE.COLLECTION_PLAN_STATUS_INVALID);
  }
  if (plan.environment_class !== CANONICAL_FIXED.environment_class) {
    fail(FAILURE.COLLECTION_PLAN_ENUM_INVALID, { field: 'environment_class' });
  }
  if (plan.attestation_scope !== CANONICAL_FIXED.attestation_scope) {
    fail(FAILURE.COLLECTION_PLAN_ENUM_INVALID, { field: 'attestation_scope' });
  }
  if (plan.collection_mode !== CANONICAL_FIXED.collection_mode) {
    fail(FAILURE.COLLECTION_PLAN_ENUM_INVALID, { field: 'collection_mode' });
  }
  if (plan.output_policy !== CANONICAL_FIXED.output_policy) {
    fail(FAILURE.COLLECTION_PLAN_ENUM_INVALID, { field: 'output_policy' });
  }
  if (plan.format_version !== CANONICAL_FIXED.format_version) {
    fail(FAILURE.COLLECTION_PLAN_FORMAT_MISMATCH);
  }
}

/**
 * Validate a prepared collection plan against the repository-owned trusted contract.
 * Second positional argument is ignored and never used as policy authority.
 */
function validatePreparedCollectionPlan(plan /* , ignoredCallerContract */) {
  const trusted = loadTrustedCollectionPlanContract();
  const contract = trusted.contract;

  if (!plan || typeof plan !== 'object' || Array.isArray(plan)) {
    fail(FAILURE.COLLECTION_PLAN_INPUT_INVALID, { field: 'plan' });
  }

  // Unconditional source-constant guards run even if trusted contract were malformed
  // after load (defense in depth; load already validates).
  assertUnconditionalSafetyInvariants(plan);

  const prohibited = new Set(contract.prohibited_fields || []);
  const allowed = new Set(contract.allowed_top_level_fields || []);
  const required = contract.required_top_level_fields || [];
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

  // Re-assert fixed fields against source constants AND trusted contract fixed values.
  for (const [key, expected] of Object.entries(CANONICAL_FIXED)) {
    if (plan[key] !== expected) {
      if (key === 'plan_status') fail(FAILURE.COLLECTION_PLAN_STATUS_INVALID);
      fail(FAILURE.COLLECTION_PLAN_ENUM_INVALID, { field: key });
    }
  }
  for (const [key, expected] of Object.entries(contract.fixed_field_values || {})) {
    if (plan[key] !== expected) {
      if (key === 'plan_status') fail(FAILURE.COLLECTION_PLAN_STATUS_INVALID);
      fail(FAILURE.COLLECTION_PLAN_ENUM_INVALID, { field: key });
    }
  }

  if (!matchPattern(plan.baseline_commit, CANONICAL_BASELINE_COMMIT_PATTERN)) {
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
    !matchPattern(plan.approval_reference, CANONICAL_APPROVAL_REFERENCE_PATTERN)
  ) {
    fail(FAILURE.COLLECTION_PLAN_APPROVAL_INVALID);
  }

  const objectAllowlist = canonicalizeObjectAllowlist(plan.object_allowlist, contract);
  const roleClasses = validateRoleMappingClasses(plan.role_mapping_classes);
  // Exact mandatory sets from source constants (not only file-provided lists).
  if (!setEqual(roleClasses, CANONICAL_ROLE_CLASSES)) {
    fail(FAILURE.COLLECTION_PLAN_ROLE_INVALID);
  }
  const proofs = validateBoundedSortedEnumList(
    plan.required_read_only_proofs,
    CANONICAL_PROOFS,
    'required_read_only_proofs',
    { mandatory: CANONICAL_PROOFS }
  );
  const outputs = validateBoundedSortedEnumList(
    plan.expected_outputs,
    CANONICAL_OUTPUTS,
    'expected_outputs',
    { mandatory: CANONICAL_OUTPUTS }
  );

  for (const out of outputs) {
    if (
      out === 'ATTESTED' ||
      out === 'ACTIVE' ||
      out === 'APPLIED' ||
      out === 'APPROVED_FOR_MUTATION'
    ) {
      fail(FAILURE.COLLECTION_PLAN_OUTPUT_INVALID);
    }
  }

  if (plan.contract_path !== DEFAULT_CONTRACT_REL) {
    fail(FAILURE.COLLECTION_PLAN_INPUT_INVALID, { field: 'contract_path' });
  }
  if (plan.digest_algorithm !== CANONICAL_DIGEST_ALGORITHM) {
    fail(FAILURE.COLLECTION_PLAN_INPUT_INVALID, { field: 'digest_algorithm' });
  }

  const trustedContractDigest = trusted.contractDigest;
  if (
    typeof plan.collection_plan_contract_digest !== 'string' ||
    !matchPattern(plan.collection_plan_contract_digest, patterns.digest || '^sha256:[a-f0-9]{64}$') ||
    plan.collection_plan_contract_digest !== trustedContractDigest
  ) {
    fail(FAILURE.COLLECTION_PLAN_CONTRACT_DIGEST_MISMATCH, {
      field: 'collection_plan_contract_digest',
    });
  }

  const allowlistDigest = computeObjectAllowlistDigest(objectAllowlist);
  const planBody = {
    format_version: CANONICAL_FIXED.format_version,
    plan_status: CANONICAL_FIXED.plan_status,
    baseline_commit: plan.baseline_commit,
    environment_class: CANONICAL_FIXED.environment_class,
    attestation_scope: CANONICAL_FIXED.attestation_scope,
    approval_reference: plan.approval_reference,
    collection_mode: CANONICAL_FIXED.collection_mode,
    output_policy: CANONICAL_FIXED.output_policy,
    object_allowlist: objectAllowlist,
    role_mapping_classes: roleClasses,
    required_read_only_proofs: proofs,
    expected_outputs: outputs,
    contract_path: DEFAULT_CONTRACT_REL,
    digest_algorithm: CANONICAL_DIGEST_ALGORITHM,
    collection_plan_contract_digest: trustedContractDigest,
    object_allowlist_digest: allowlistDigest,
  };

  const planDigest = computeCollectionPlanDigest(planBody);

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
      plan_digest: planDigest,
    },
  };
}

/**
 * Build repository-owned prepared plan.
 * Caller may only supply baselineCommit and approvalReference.
 * Second positional argument is ignored and never used as policy authority.
 */
function buildPreparedCollectionPlan(input /* , ignoredCallerContract */) {
  const trusted = loadTrustedCollectionPlanContract();
  const contract = trusted.contract;
  const baselineCommit = input && input.baselineCommit;
  const approvalReference = input && input.approvalReference;

  if (typeof baselineCommit !== 'string' || !matchPattern(baselineCommit, CANONICAL_BASELINE_COMMIT_PATTERN)) {
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
    !matchPattern(approvalReference, CANONICAL_APPROVAL_REFERENCE_PATTERN)
  ) {
    fail(FAILURE.COLLECTION_PLAN_APPROVAL_INVALID);
  }
  scanValueSensitive(approvalReference, contract.sensitive_content_markers || [], 'approval_reference');

  const objectAllowlist = canonicalizeObjectAllowlist(contract.reviewed_object_allowlist, contract);
  const allowlistDigest = computeObjectAllowlistDigest(objectAllowlist);
  const plan = {
    format_version: CANONICAL_FIXED.format_version,
    plan_status: CANONICAL_FIXED.plan_status,
    baseline_commit: baselineCommit,
    environment_class: CANONICAL_FIXED.environment_class,
    attestation_scope: CANONICAL_FIXED.attestation_scope,
    approval_reference: approvalReference,
    collection_mode: CANONICAL_FIXED.collection_mode,
    output_policy: CANONICAL_FIXED.output_policy,
    object_allowlist: objectAllowlist,
    role_mapping_classes: sortCopy([...CANONICAL_ROLE_CLASSES]),
    required_read_only_proofs: sortCopy([...CANONICAL_PROOFS]),
    expected_outputs: sortCopy([...CANONICAL_OUTPUTS]),
    contract_path: DEFAULT_CONTRACT_REL,
    digest_algorithm: CANONICAL_DIGEST_ALGORITHM,
    collection_plan_contract_digest: trusted.contractDigest,
    object_allowlist_digest: allowlistDigest,
  };
  plan.plan_digest = computeCollectionPlanDigest(plan);

  // Round-trip through validator (still loads trusted contract; ignores any second arg).
  const validated = validatePreparedCollectionPlan(plan);
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
  CANONICAL_FIXED,
  CANONICAL_PROOFS,
  CANONICAL_OUTPUTS,
  CANONICAL_ROLE_CLASSES,
  CANONICAL_PROHIBITED_STATUSES,
  CANONICAL_DIGEST_DOMAINS,
  PLAN_KEY_ORDER,
  compareCodePoint,
  stableStringify,
  defaultContractPath,
  loadTrustedCollectionPlanContract,
  loadCollectionPlanContract,
  validateCollectionPlanContract,
  validatePreparedCollectionPlan,
  buildPreparedCollectionPlan,
  serializePreparedCollectionPlan,
  computeExactBytesDigest,
  computeCollectionPlanDigest,
  computeObjectAllowlistDigest,
  isPathOutside,
  assertRepoRelativePath,
  resolveRepoConfinedPath,
  assertOutputNotProhibited,
  readPreparedCollectionPlanFile,
};
