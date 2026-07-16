'use strict';

/**
 * Pure receipt builder for Phase B Production-readonly catalog collection.
 *
 * No database, network, shell, or environment fallback.
 * No file writes, no activation, no mutation.
 *
 * Validation ordering:
 *   1. plain JSON-compatible type validation (accessor-safe — getters never invoked)
 *   2. recursion/array/key/string bounds + prototype + cyclic
 *   3. prohibited-key recursive scan
 *   4. sensitive-value recursive scan
 *   5. digest computation
 *   6. cross-binding verification
 *   7. receipt construction + brand + deep-freeze
 *   8. final recursive scan
 *   9. serialization (branded WeakSet check — forged/cloned receipts rejected)
 *
 * Digest is recomputed from provided artifacts — caller-supplied digest
 * strings are NOT trusted. Full cross-validation against attestation binding.
 *
 * Trusted plan validator: MODULE-OWNED import from adoption-baseline-collection-plan-core.cjs.
 * Caller CANNOT inject validatePlanFn — no options.validatePlanFn accepted.
 *
 * Refs #3573 (NEW), #3458 (OPEN), #3425 (OPEN), #1882 (OPEN)
 */

const crypto = require('node:crypto');
const { validatePreparedCollectionPlan } = require('./adoption-baseline-collection-plan-core.cjs');

const FORMAT_VERSION = '1.0';
const DIGEST_ALGORITHM = 'sha256';

const FAILURE = Object.freeze({
  RECEIPT_INPUT_INVALID: 'RECEIPT_INPUT_INVALID',
  RECEIPT_PROHIBITED_FIELD: 'RECEIPT_PROHIBITED_FIELD',
  RECEIPT_SENSITIVE_VALUE: 'RECEIPT_SENSITIVE_VALUE',
  RECEIPT_DIGEST_MISMATCH: 'RECEIPT_DIGEST_MISMATCH',
  RECEIPT_BOUNDS_EXCEEDED: 'RECEIPT_BOUNDS_EXCEEDED',
  RECEIPT_VALUE_TYPE_INVALID: 'RECEIPT_VALUE_TYPE_INVALID',
});

const PROHIBITED_FIELDS = new Set([
  'host', 'hostname', 'port', 'database', 'database_name',
  'database_url', 'connection_string', 'url', 'secret', 'token',
  'password', 'credential', 'username', 'operator', 'operator_name',
  'operator_email', 'raw_role', 'role_name', 'provider_project',
  'provider_branch', 'raw_catalog', 'rows', 'row_values', 'payload',
  'grantee_name', 'database_owner',
]);

const SENSITIVE_MARKERS = Object.freeze([
  'postgres://', 'postgresql://', 'DATABASE_URL',
  'password=', 'password:', 'api_key', 'api-key',
  'secret=', 'secret:', 'token=', 'token:',
  'BEGIN PRIVATE KEY', 'BEGIN RSA PRIVATE KEY',
  'neon.tech', 'cloud.neon',
]);

const MAX_RECURSION_DEPTH = 20;
const MAX_ARRAY_ITEMS = 2048;
const MAX_OBJECT_KEYS = 1024;
const MAX_STRING_LENGTH = 65536;

// ─── Module-private brand for genuine receipts ──────────────────────────────
const _receiptBrand = new WeakSet();

function fail(category) {
  const err = new Error(category);
  err.category = category;
  throw err;
}

function compareCodePoint(a, b) {
  const l = String(a), r = String(b);
  return l < r ? -1 : l > r ? 1 : 0;
}

function computeDigest(input) {
  const buf = Buffer.isBuffer(input)
    ? input
    : Buffer.from(String(input), 'utf8');
  return `sha256:${crypto.createHash('sha256').update(buf).digest('hex')}`;
}

function computeObjectDigest(obj) {
  return computeDigest(Buffer.from(stableStringify(obj), 'utf8'));
}

function stableStringify(value) {
  if (value === null) return 'null';
  const t = typeof value;
  if (t === 'boolean') return value ? 'true' : 'false';
  if (t === 'number') {
    if (!Number.isFinite(value)) fail(FAILURE.RECEIPT_VALUE_TYPE_INVALID);
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
  fail(FAILURE.RECEIPT_VALUE_TYPE_INVALID);
}

/**
 * Strict JSON-artifact type-and-bounds validation.
 *
 * Uses local WeakSet passed as parameter for cyclic detection (not module-global).
 * Uses Reflect.ownKeys + Object.getOwnPropertyDescriptors to detect accessors
 * and symbol keys WITHOUT invoking getters.
 *
 * Rejects: cyclic, custom prototype, Date/Map/Set/Buffer, typed array,
 * accessor property (get/set), symbol key, undefined, function, symbol,
 * bigint, NaN, Infinity, excessive depth/array/key/string.
 */
function validateJsonArtifact(value, depth, seenSet) {
  if (depth > MAX_RECURSION_DEPTH) fail(FAILURE.RECEIPT_BOUNDS_EXCEEDED);

  if (value === null || value === undefined) {
    if (value === undefined) fail(FAILURE.RECEIPT_VALUE_TYPE_INVALID);
    return;
  }

  const t = typeof value;

  if (t === 'boolean') return;
  if (t === 'number') {
    if (!Number.isFinite(value)) fail(FAILURE.RECEIPT_VALUE_TYPE_INVALID);
    return;
  }
  if (t === 'string') {
    if (value.length > MAX_STRING_LENGTH) fail(FAILURE.RECEIPT_BOUNDS_EXCEEDED);
    return;
  }
  if (t === 'symbol' || t === 'function' || t === 'bigint' || t === 'undefined') {
    fail(FAILURE.RECEIPT_VALUE_TYPE_INVALID);
  }

  // Must be object or array
  if (Array.isArray(value)) {
    if (value.length > MAX_ARRAY_ITEMS) fail(FAILURE.RECEIPT_BOUNDS_EXCEEDED);
    for (const item of value) validateJsonArtifact(item, depth + 1, seenSet);
    return;
  }

  if (t === 'object') {
    // Cyclic check — use local seenSet
    if (seenSet) {
      if (seenSet.has(value)) fail(FAILURE.RECEIPT_VALUE_TYPE_INVALID);
    }

    // Prototype check
    const proto = Object.getPrototypeOf(value);
    if (proto !== Object.prototype && proto !== null) {
      fail(FAILURE.RECEIPT_VALUE_TYPE_INVALID);
    }

    if (seenSet) seenSet.add(value);

    // Use Reflect.ownKeys + descriptors to detect accessors and symbol keys
    // WITHOUT invoking getters
    const ownKeys = Reflect.ownKeys(value);
    if (ownKeys.length > MAX_OBJECT_KEYS) fail(FAILURE.RECEIPT_BOUNDS_EXCEEDED);

    // Filter out symbol keys — they are rejected
    const stringKeys = [];
    for (const key of ownKeys) {
      if (typeof key === 'symbol') fail(FAILURE.RECEIPT_VALUE_TYPE_INVALID);
      if (typeof key !== 'string' || !key) fail(FAILURE.RECEIPT_VALUE_TYPE_INVALID);
      stringKeys.push(key);
    }

    // Check descriptors BEFORE accessing values
    const descriptors = Object.getOwnPropertyDescriptors(value);
    for (const key of stringKeys) {
      const desc = descriptors[key];
      // Accessor property — reject without invoking getter
      if (desc && typeof desc.get === 'function') fail(FAILURE.RECEIPT_VALUE_TYPE_INVALID);
      if (desc && typeof desc.set === 'function') fail(FAILURE.RECEIPT_VALUE_TYPE_INVALID);
      // Reject non-enumerable fields (JSON.stringify skips them)
      if (desc && !desc.enumerable) fail(FAILURE.RECEIPT_VALUE_TYPE_INVALID);
    }

    // Now validate values for enumerable string keys
    for (const key of stringKeys) {
      // Only validate if the descriptor is enumerable data (checked above, but guard)
      const desc = descriptors[key];
      if (desc && desc.enumerable && !desc.get && !desc.set) {
        validateJsonArtifact(value[key], depth + 1, seenSet);
      }
    }
    return;
  }

  fail(FAILURE.RECEIPT_VALUE_TYPE_INVALID);
}

/**
 * Recursive sanitization with bounds checking.
 * Scans ALL nested values for prohibited keys and sensitive markers.
 */
function scanSensitive(value, depth) {
  if (depth > MAX_RECURSION_DEPTH) fail(FAILURE.RECEIPT_BOUNDS_EXCEEDED);

  // Reject undefined explicitly
  if (value === undefined) fail(FAILURE.RECEIPT_VALUE_TYPE_INVALID);
  if (value === null) return;

  const t = typeof value;

  if (t === 'string') {
    if (value.length > MAX_STRING_LENGTH) fail(FAILURE.RECEIPT_BOUNDS_EXCEEDED);
    for (const marker of SENSITIVE_MARKERS) {
      if (value.toLowerCase().includes(marker.toLowerCase())) {
        fail(FAILURE.RECEIPT_SENSITIVE_VALUE);
      }
    }
    return;
  }

  if (t === 'number') {
    if (!Number.isFinite(value)) fail(FAILURE.RECEIPT_VALUE_TYPE_INVALID);
    return;
  }

  if (t === 'boolean') return;

  if (Array.isArray(value)) {
    if (value.length > MAX_ARRAY_ITEMS) fail(FAILURE.RECEIPT_BOUNDS_EXCEEDED);
    for (const item of value) scanSensitive(item, depth + 1);
    return;
  }

  if (t === 'object') {
    const keys = Object.keys(value);
    if (keys.length > MAX_OBJECT_KEYS) fail(FAILURE.RECEIPT_BOUNDS_EXCEEDED);
    for (const key of keys) {
      if (SENSITIVE_MARKERS.some((m) => key.toLowerCase().includes(m.toLowerCase()))) {
        fail(FAILURE.RECEIPT_SENSITIVE_VALUE);
      }
    }
    // Prototype check: reject non-plain objects
    if (Object.getPrototypeOf(value) !== Object.prototype) {
      fail(FAILURE.RECEIPT_VALUE_TYPE_INVALID);
    }
    for (const key of keys) scanSensitive(value[key], depth + 1);
    return;
  }

  // symbol, bigint, function, undefined (null handled above)
  fail(FAILURE.RECEIPT_VALUE_TYPE_INVALID);
}

/**
 * Recursive prohibited key check — entire nested tree.
 */
function checkProhibitedFields(obj, depth) {
  if (depth > MAX_RECURSION_DEPTH) fail(FAILURE.RECEIPT_BOUNDS_EXCEEDED);
  if (obj === null || obj === undefined) {
    if (obj === undefined) fail(FAILURE.RECEIPT_VALUE_TYPE_INVALID);
    return;
  }
  const t = typeof obj;

  // Traverse arrays
  if (Array.isArray(obj)) {
    if (obj.length > MAX_ARRAY_ITEMS) fail(FAILURE.RECEIPT_BOUNDS_EXCEEDED);
    for (const item of obj) checkProhibitedFields(item, depth + 1);
    return;
  }

  if (t !== 'object') return;

  // Prototype check
  if (Object.getPrototypeOf(obj) !== Object.prototype) {
    fail(FAILURE.RECEIPT_VALUE_TYPE_INVALID);
  }

  const keys = Object.keys(obj);
  for (const key of keys) {
    if (PROHIBITED_FIELDS.has(key)) {
      fail(FAILURE.RECEIPT_PROHIBITED_FIELD);
    }
    checkProhibitedFields(obj[key], depth + 1);
  }
}

/**
 * Full pre-digest validation of a collection artifact.
 * Uses an independent local WeakSet for each call (not module-global).
 */
function validateArtifact(value) {
  const seen = new WeakSet();
  validateJsonArtifact(value, 0, seen);
  checkProhibitedFields(value, 0);
  scanSensitive(value, 0);
}

/**
 * Deep-freeze a value recursively.
 */
function deepFreeze(value) {
  if (value === null || value === undefined) return value;
  const t = typeof value;
  if (t !== 'object' && t !== 'function') return value;
  if (Object.isFrozen(value)) return value;
  if (Array.isArray(value)) {
    for (const item of value) deepFreeze(item);
    Object.freeze(value);
    return value;
  }
  if (t === 'object') {
    const keys = Object.keys(value);
    for (const key of keys) deepFreeze(value[key]);
    Object.freeze(value);
    return value;
  }
  return value;
}

/**
 * Build a deterministic receipt from artifacts.
 *
 * Trusted plan validator is MODULE-OWNED — caller CANNOT inject validatePlanFn.
 * No options.validatePlanFn accepted; unknown options are rejected.
 *
 * DIGESTS ARE RECOMPUTED INTERNALLY — caller-supplied digest strings
 * are NOT trusted. Full pre-digest validation + cross-binding verification.
 *
 * Built receipt is branded via module-private WeakSet and deep-frozen.
 * Only branded receipts can be serialized (forged/cloned/spread rejected).
 *
 * @param {object} options
 * @param {object} options.preparedPlan — output of buildPreparedCollectionPlan
 * @param {Buffer} options.boundaryContractBytes — exact file bytes
 * @param {Buffer} options.catalogMetadataContractBytes — exact file bytes
 * @param {object} options.canonicalManifest — parsed canonical-migrations.json
 * @param {object} options.expectedSchemaManifest — parsed expected-schema-manifest.json
 * @param {object} options.catalogEvidence — sanitized evidence from collector
 * @param {object} options.inactiveExpectedSchemaCandidate — candidate object
 * @param {object} options.preparedAttestationDraft — UNATTESTED draft
 * @param {number} options.collectionSessionCount — 1 or 2 for success
 */
function buildCollectionReceipt(options) {
  if (!options || typeof options !== 'object' || Array.isArray(options)) {
    fail(FAILURE.RECEIPT_INPUT_INVALID);
  }

  // ── Reject call-injected validator — module-owned only ──
  const ALLOWED_KEYS = new Set([
    'preparedPlan',
    'boundaryContractBytes',
    'catalogMetadataContractBytes',
    'canonicalManifest',
    'expectedSchemaManifest',
    'catalogEvidence',
    'inactiveExpectedSchemaCandidate',
    'preparedAttestationDraft',
    'collectionSessionCount',
  ]);
  for (const key of Object.keys(options)) {
    if (!ALLOWED_KEYS.has(key)) fail(FAILURE.RECEIPT_INPUT_INVALID);
  }

  // ── Step 0: Validate prepared plan via MODULE-OWNED trusted validator ──
  const validated = validatePreparedCollectionPlan(options.preparedPlan);
  if (!validated || validated.ok !== true || !validated.plan) {
    fail(FAILURE.RECEIPT_INPUT_INVALID);
  }
  const trustedPlan = validated.plan;

  // ── Step 1-4: Pre-digest validation of all artifacts ──
  const evidence = options.catalogEvidence;
  const candidate = options.inactiveExpectedSchemaCandidate;
  const draft = options.preparedAttestationDraft;
  const canonicalManifest = options.canonicalManifest;
  const expectedSchemaManifest = options.expectedSchemaManifest;

  for (const artifact of [canonicalManifest, expectedSchemaManifest, evidence, candidate, draft]) {
    validateArtifact(artifact);
  }

  // ── Step 4b: Session count enforcement for success receipt ──
  const sessionCount = options.collectionSessionCount;
  if (!Number.isInteger(sessionCount) || sessionCount < 1 || sessionCount > 2) {
    fail(FAILURE.RECEIPT_INPUT_INVALID);
  }

  // ── Step 5: Digest computation ──
  const boundaryContractDigest = options.boundaryContractBytes
    ? computeDigest(options.boundaryContractBytes)
    : null;
  const catalogMetadataContractDigest = options.catalogMetadataContractBytes
    ? computeDigest(options.catalogMetadataContractBytes)
    : null;
  const canonicalManifestDigest = computeObjectDigest(canonicalManifest);
  const expectedSchemaManifestDigest = computeObjectDigest(expectedSchemaManifest);
  const catalogEvidenceDigest = computeObjectDigest(evidence);
  const inactiveCandidateDigest = computeObjectDigest(candidate);
  const preparedAttestationDigest = computeObjectDigest(draft);

  // Use validated trusted plan digests
  const collectionPlanDigest = trustedPlan.plan_digest;
  const objectAllowlistDigest = trustedPlan.object_allowlist_digest;
  const collectionPlanContractDigest = trustedPlan.collection_plan_contract_digest;

  // ── SHA-256 format validation ──
  const sha64 = /^sha256:[a-f0-9]{64}$/;
  for (const d of [collectionPlanDigest, objectAllowlistDigest, collectionPlanContractDigest,
    boundaryContractDigest, catalogMetadataContractDigest,
    canonicalManifestDigest, expectedSchemaManifestDigest,
    catalogEvidenceDigest, inactiveCandidateDigest, preparedAttestationDigest]) {
    if (!sha64.test(d)) fail(FAILURE.RECEIPT_INPUT_INVALID);
  }

  // ── Step 6: Cross-binding verification ──
  if (catalogEvidenceDigest !== draft.catalog_evidence_digest) {
    fail(FAILURE.RECEIPT_DIGEST_MISMATCH);
  }
  if (inactiveCandidateDigest !== draft.expected_schema_digest) {
    fail(FAILURE.RECEIPT_DIGEST_MISMATCH);
  }
  if (canonicalManifestDigest !== draft.canonical_manifest_digest) {
    fail(FAILURE.RECEIPT_DIGEST_MISMATCH);
  }

  // Candidate/draft status checks
  if (candidate.status !== 'ADOPTION_REQUIRED') fail(FAILURE.RECEIPT_INPUT_INVALID);
  if (draft.adoption_status !== 'UNATTESTED') fail(FAILURE.RECEIPT_INPUT_INVALID);

  // ── Step 7: Receipt construction + brand + deep-freeze ──
  const receipt = Object.freeze({
    format_version: FORMAT_VERSION,
    outcome: 'COLLECTION_PASS_SANITIZED_EVIDENCE_READY',
    baseline_main_sha: trustedPlan.baseline_commit,
    approval_reference: trustedPlan.approval_reference,
    collection_session_count: sessionCount,
    collection_plan_digest: collectionPlanDigest,
    object_allowlist_digest: objectAllowlistDigest,
    collection_plan_contract_digest: collectionPlanContractDigest,
    boundary_contract_digest: boundaryContractDigest,
    catalog_metadata_contract_digest: catalogMetadataContractDigest,
    canonical_manifest_digest: canonicalManifestDigest,
    expected_schema_manifest_digest: expectedSchemaManifestDigest,
    catalog_evidence: deepFreeze(evidence),
    catalog_evidence_digest: catalogEvidenceDigest,
    inactive_expected_schema_candidate: deepFreeze(candidate),
    inactive_candidate_digest: inactiveCandidateDigest,
    prepared_attestation_draft: deepFreeze(draft),
    prepared_attestation_digest: preparedAttestationDigest,
    read_only_proofs: Object.freeze(trustedPlan.required_read_only_proofs || []),
    attestation_status: 'UNATTESTED',
    manifest_activation: 'NONE',
    schema_mutation: 'NONE',
    data_mutation: 'NONE',
    credential_change: 'NONE',
    privilege_change: 'NONE',
  });

  // ── Brand the genuine receipt ──
  _receiptBrand.add(receipt);

  // ── Step 8: Final recursive scan (operates on frozen shallow — values already frozen) ──
  // (checkProhibitedFields/scanSensitive already ran on individual artifacts above;
  // full receipt scan validates top-level structure is clean)
  checkProhibitedFields(receipt, 0);
  scanSensitive(receipt, 0);

  return receipt;
}

function serializeCollectionReceipt(receipt) {
  if (!receipt || typeof receipt !== 'object' || Array.isArray(receipt)) {
    fail(FAILURE.RECEIPT_INPUT_INVALID);
  }

  // ── Brand check: only genuine buildCollectionReceipt-produced receipts ──
  if (!_receiptBrand.has(receipt)) {
    fail(FAILURE.RECEIPT_INPUT_INVALID);
  }

  // ── Independent full validation ──
  validateArtifact(receipt);

  // Verify success receipt invariant
  if (receipt.outcome !== 'COLLECTION_PASS_SANITIZED_EVIDENCE_READY') {
    fail(FAILURE.RECEIPT_INPUT_INVALID);
  }
  if (!Number.isInteger(receipt.collection_session_count) ||
      receipt.collection_session_count < 1 || receipt.collection_session_count > 2) {
    fail(FAILURE.RECEIPT_INPUT_INVALID);
  }
  if (receipt.attestation_status !== 'UNATTESTED') fail(FAILURE.RECEIPT_INPUT_INVALID);
  if (receipt.manifest_activation !== 'NONE') fail(FAILURE.RECEIPT_INPUT_INVALID);
  if (receipt.inactive_expected_schema_candidate &&
      receipt.inactive_expected_schema_candidate.status !== 'ADOPTION_REQUIRED') {
    fail(FAILURE.RECEIPT_INPUT_INVALID);
  }

  return `${JSON.stringify(receipt, null, 2)}\n`;
}

module.exports = {
  FORMAT_VERSION,
  DIGEST_ALGORITHM,
  FAILURE,
  PROHIBITED_FIELDS,
  SENSITIVE_MARKERS,
  compareCodePoint,
  computeDigest,
  computeObjectDigest,
  stableStringify,
  validateJsonArtifact,
  validateArtifact,
  scanSensitive,
  checkProhibitedFields,
  buildCollectionReceipt,
  serializeCollectionReceipt,
  // Export WeakSet for testing only
  _receiptBrand,
};
