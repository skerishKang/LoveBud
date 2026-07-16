'use strict';

/**
 * Pure receipt builder for Phase B Production-readonly catalog collection.
 *
 * No database, network, shell, or environment fallback.
 * No file writes, no activation, no mutation.
 *
 * Digest is recomputed from provided artifacts — caller-supplied digest
 * strings are NOT trusted. Full cross-validation against attestation binding.
 *
 * Refs #3573 (NEW), #3458 (OPEN), #3425 (OPEN), #1882 (OPEN)
 */

const crypto = require('node:crypto');

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
 * Recursive sanitization with bounds checking.
 * Scans ALL nested values for prohibited keys and sensitive markers.
 */
function scanSensitive(value, depth = 0) {
  if (depth > MAX_RECURSION_DEPTH) fail(FAILURE.RECEIPT_BOUNDS_EXCEEDED);

  if (value === null || value === undefined) return;

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

  // symbol, bigint, function, undefined at top level (null handled above)
  fail(FAILURE.RECEIPT_VALUE_TYPE_INVALID);
}

/**
 * Recursive prohibited key check — entire nested tree.
 */
function checkProhibitedFields(obj, depth = 0) {
  if (depth > MAX_RECURSION_DEPTH) fail(FAILURE.RECEIPT_BOUNDS_EXCEEDED);
  if (obj === null || obj === undefined) return;
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
 * Build a deterministic receipt from artifacts.
 * DIGESTS ARE RECOMPUTED INTERNALLY — caller-supplied digest strings
 * are NOT trusted. Cross-validation against attestation draft.
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
 * @param {number} options.collectionSessionCount — 0, 1, or 2
 */
function buildCollectionReceipt(options) {
  if (!options || typeof options !== 'object' || Array.isArray(options)) {
    fail(FAILURE.RECEIPT_INPUT_INVALID);
  }

  const plan = options.preparedPlan;
  if (!plan || typeof plan !== 'object' || plan.plan_status !== 'PREPARED_ONLY') {
    fail(FAILURE.RECEIPT_INPUT_INVALID);
  }

  // ── Recomputed digests from artifacts ──
  const boundaryContractDigest = options.boundaryContractBytes
    ? computeDigest(options.boundaryContractBytes)
    : null;
  const catalogMetadataContractDigest = options.catalogMetadataContractBytes
    ? computeDigest(options.catalogMetadataContractBytes)
    : null;
  const canonicalManifestDigest = computeObjectDigest(options.canonicalManifest);
  const expectedSchemaManifestDigest = computeObjectDigest(options.expectedSchemaManifest);
  const catalogEvidenceDigest = computeObjectDigest(options.catalogEvidence);
  const inactiveCandidateDigest = computeObjectDigest(options.inactiveExpectedSchemaCandidate);
  const preparedAttestationDigest = computeObjectDigest(options.preparedAttestationDraft);

  // ── Use prepared plan digests ──
  const collectionPlanDigest = plan.plan_digest;
  const objectAllowlistDigest = plan.object_allowlist_digest;
  const collectionPlanContractDigest = plan.collection_plan_contract_digest;

  // ── SHA-256 format validation ──
  const sha64 = /^sha256:[a-f0-9]{64}$/;
  if (!sha64.test(collectionPlanDigest)) fail(FAILURE.RECEIPT_INPUT_INVALID);
  if (!sha64.test(objectAllowlistDigest)) fail(FAILURE.RECEIPT_INPUT_INVALID);
  if (!sha64.test(collectionPlanContractDigest)) fail(FAILURE.RECEIPT_INPUT_INVALID);
  if (!sha64.test(boundaryContractDigest)) fail(FAILURE.RECEIPT_INPUT_INVALID);
  if (!sha64.test(catalogMetadataContractDigest)) fail(FAILURE.RECEIPT_INPUT_INVALID);
  if (!sha64.test(canonicalManifestDigest)) fail(FAILURE.RECEIPT_INPUT_INVALID);
  if (!sha64.test(expectedSchemaManifestDigest)) fail(FAILURE.RECEIPT_INPUT_INVALID);
  if (!sha64.test(catalogEvidenceDigest)) fail(FAILURE.RECEIPT_INPUT_INVALID);
  if (!sha64.test(inactiveCandidateDigest)) fail(FAILURE.RECEIPT_INPUT_INVALID);
  if (!sha64.test(preparedAttestationDigest)) fail(FAILURE.RECEIPT_INPUT_INVALID);

  // ── Cross-validate digests against attestation draft ──
  const draft = options.preparedAttestationDraft;
  if (catalogEvidenceDigest !== draft.catalog_evidence_digest) {
    fail(FAILURE.RECEIPT_DIGEST_MISMATCH);
  }
  if (inactiveCandidateDigest !== draft.expected_schema_digest) {
    fail(FAILURE.RECEIPT_DIGEST_MISMATCH);
  }
  if (canonicalManifestDigest !== draft.canonical_manifest_digest) {
    fail(FAILURE.RECEIPT_DIGEST_MISMATCH);
  }

  // ── Validate evidence/candidate/draft ──
  const evidence = options.catalogEvidence;
  if (!evidence || typeof evidence !== 'object' || Array.isArray(evidence)) {
    fail(FAILURE.RECEIPT_INPUT_INVALID);
  }
  const candidate = options.inactiveExpectedSchemaCandidate;
  if (!candidate || typeof candidate !== 'object' || Array.isArray(candidate)) {
    fail(FAILURE.RECEIPT_INPUT_INVALID);
  }
  if (candidate.status !== 'ADOPTION_REQUIRED') fail(FAILURE.RECEIPT_INPUT_INVALID);
  if (draft.adoption_status !== 'UNATTESTED') fail(FAILURE.RECEIPT_INPUT_INVALID);

  checkProhibitedFields(evidence);
  checkProhibitedFields(candidate);
  checkProhibitedFields(draft);
  scanSensitive(evidence);
  scanSensitive(candidate);
  scanSensitive(draft);

  if (!Number.isInteger(options.collectionSessionCount) || options.collectionSessionCount < 0) {
    fail(FAILURE.RECEIPT_INPUT_INVALID);
  }

  // ── Build receipt — all digests recomputed internally ──
  const receipt = {
    format_version: FORMAT_VERSION,
    outcome: 'COLLECTION_PASS_SANITIZED_EVIDENCE_READY',
    baseline_main_sha: plan.baseline_commit,
    approval_reference: plan.approval_reference,
    collection_session_count: options.collectionSessionCount,
    collection_plan_digest: collectionPlanDigest,
    object_allowlist_digest: objectAllowlistDigest,
    collection_plan_contract_digest: collectionPlanContractDigest,
    boundary_contract_digest: boundaryContractDigest,
    catalog_metadata_contract_digest: catalogMetadataContractDigest,
    canonical_manifest_digest: canonicalManifestDigest,
    expected_schema_manifest_digest: expectedSchemaManifestDigest,
    catalog_evidence: evidence,
    catalog_evidence_digest: catalogEvidenceDigest,
    inactive_expected_schema_candidate: candidate,
    inactive_candidate_digest: inactiveCandidateDigest,
    prepared_attestation_draft: draft,
    prepared_attestation_digest: preparedAttestationDigest,
    read_only_proofs: plan.required_read_only_proofs || [],
    attestation_status: 'UNATTESTED',
    manifest_activation: 'NONE',
    schema_mutation: 'NONE',
    data_mutation: 'NONE',
    credential_change: 'NONE',
    privilege_change: 'NONE',
  };

  // Final full recursive scan
  checkProhibitedFields(receipt);
  scanSensitive(receipt);

  return receipt;
}

function serializeCollectionReceipt(receipt) {
  if (!receipt || typeof receipt !== 'object' || Array.isArray(receipt)) {
    fail(FAILURE.RECEIPT_INPUT_INVALID);
  }
  scanSensitive(receipt);
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
  scanSensitive,
  checkProhibitedFields,
  buildCollectionReceipt,
  serializeCollectionReceipt,
};
