'use strict';

/**
 * Pure receipt builder for Phase B Production-readonly catalog collection.
 *
 * No database, network, shell, or environment fallback.
 * No file writes, no activation, no mutation.
 *
 * Deterministic digest-only helper.
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
});

const PROHIBITED_FIELDS = new Set([
  'host', 'hostname', 'port', 'database', 'database_name',
  'database_url', 'connection_string', 'url', 'secret', 'token',
  'password', 'credential', 'username', 'operator', 'operator_name',
  'operator_email', 'raw_role', 'role_name', 'provider_project',
  'provider_branch', 'raw_catalog', 'rows', 'row_values', 'payload',
  'grantee_name', 'database_owner',
]);

const SENSITIVE_MARKERS = [
  'postgres://', 'postgresql://', 'DATABASE_URL',
  'password=', 'password:', 'api_key', 'api-key',
  'secret=', 'secret:', 'token=', 'token:',
  'BEGIN PRIVATE KEY', 'BEGIN RSA PRIVATE KEY',
  'neon.tech', 'cloud.neon',
];

const READ_ONLY_PROOFS = Object.freeze([
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

function fail(category) {
  const err = new Error(category);
  err.category = category;
  throw err;
}

function compareCodePoint(a, b) {
  const left = String(a);
  const right = String(b);
  if (left < right) return -1;
  if (left > right) return 1;
  return 0;
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
    if (!Number.isFinite(value)) fail(FAILURE.RECEIPT_INPUT_INVALID);
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
  fail(FAILURE.RECEIPT_INPUT_INVALID);
}

function scanSensitive(value) {
  if (typeof value === 'string') {
    for (const marker of SENSITIVE_MARKERS) {
      if (value.toLowerCase().includes(marker.toLowerCase())) {
        fail(FAILURE.RECEIPT_SENSITIVE_VALUE);
      }
    }
    return;
  }
  if (Array.isArray(value)) {
    for (const item of value) scanSensitive(item);
    return;
  }
  if (value && typeof value === 'object') {
    for (const key of Object.keys(value)) {
      if (SENSITIVE_MARKERS.some((m) => key.toLowerCase().includes(m.toLowerCase()))) {
        fail(FAILURE.RECEIPT_SENSITIVE_VALUE);
      }
      scanSensitive(value[key]);
    }
  }
}

function checkProhibitedFields(obj) {
  for (const key of Object.keys(obj)) {
    if (PROHIBITED_FIELDS.has(key)) {
      fail(FAILURE.RECEIPT_PROHIBITED_FIELD);
    }
  }
}

/**
 * Build a deterministic receipt JSON object for a successful
 * Production-readonly catalog collection.
 *
 * @param {object} options
 * @param {string} options.baselineMainSha - origin/main SHA (40 hex)
 * @param {string} options.approvalReference - issue:number
 * @param {number} options.collectionSessionCount - 1 or 2
 * @param {object} options.collectionPlanDigest - sha256:...
 * @param {object} options.objectAllowlistDigest - sha256:...
 * @param {object} options.boundaryContractDigest - sha256:...
 * @param {object} options.catalogMetadataContractDigest - sha256:...
 * @param {object} options.canonicalManifestDigest - sha256:...
 * @param {object} options.expectedSchemaManifestDigest - sha256:...
 * @param {object} options.catalogEvidence - sanitized evidence from collector
 * @param {string} options.catalogEvidenceDigest - sha256:...
 * @param {object} options.inactiveExpectedSchemaCandidate - candidate object
 * @param {string} options.inactiveCandidateDigest - sha256:...
 * @param {object} options.preparedAttestationDraft - unattensted draft
 * @param {string} options.preparedAttestationDigest - sha256:...
 */
function buildCollectionReceipt(options) {
  if (!options || typeof options !== 'object' || Array.isArray(options)) {
    fail(FAILURE.RECEIPT_INPUT_INVALID);
  }

  // --- Validate inputs ---
  const sha40 = /^[a-f0-9]{40}$/;
  const sha64 = /^sha256:[a-f0-9]{64}$/;
  const approvalRefPattern = /^(?:issue:\d+|decision:[A-Za-z0-9][A-Za-z0-9._-]{2,63})$/;

  if (!sha40.test(options.baselineMainSha)) fail(FAILURE.RECEIPT_INPUT_INVALID);
  if (!approvalRefPattern.test(options.approvalReference)) fail(FAILURE.RECEIPT_INPUT_INVALID);
  if (![1, 2].includes(options.collectionSessionCount)) fail(FAILURE.RECEIPT_INPUT_INVALID);

  for (const digestField of [
    'collectionPlanDigest', 'objectAllowlistDigest', 'boundaryContractDigest',
    'catalogMetadataContractDigest', 'canonicalManifestDigest',
    'expectedSchemaManifestDigest', 'catalogEvidenceDigest',
    'inactiveCandidateDigest', 'preparedAttestationDigest',
  ]) {
    if (!sha64.test(options[digestField])) fail(FAILURE.RECEIPT_INPUT_INVALID);
  }

  // Validate catalogEvidence shape (must have sanitized objects)
  const evidence = options.catalogEvidence;
  if (!evidence || typeof evidence !== 'object' || Array.isArray(evidence)) {
    fail(FAILURE.RECEIPT_INPUT_INVALID);
  }
  checkProhibitedFields(evidence);
  scanSensitive(evidence);

  const inactiveCandidate = options.inactiveExpectedSchemaCandidate;
  if (
    !inactiveCandidate || typeof inactiveCandidate !== 'object' ||
    Array.isArray(inactiveCandidate) || inactiveCandidate.status !== 'ADOPTION_REQUIRED'
  ) {
    fail(FAILURE.RECEIPT_INPUT_INVALID);
  }

  const attestationDraft = options.preparedAttestationDraft;
  if (
    !attestationDraft || typeof attestationDraft !== 'object' ||
    Array.isArray(attestationDraft) || attestationDraft.adoption_status !== 'UNATTESTED'
  ) {
    fail(FAILURE.RECEIPT_INPUT_INVALID);
  }

  // --- Build receipt ---
  const receipt = {
    format_version: FORMAT_VERSION,
    outcome: 'COLLECTION_PASS_SANITIZED_EVIDENCE_READY',
    baseline_main_sha: options.baselineMainSha,
    approval_reference: options.approvalReference,
    collection_session_count: options.collectionSessionCount,
    collection_plan_digest: options.collectionPlanDigest,
    object_allowlist_digest: options.objectAllowlistDigest,
    boundary_contract_digest: options.boundaryContractDigest,
    catalog_metadata_contract_digest: options.catalogMetadataContractDigest,
    canonical_manifest_digest: options.canonicalManifestDigest,
    expected_schema_manifest_digest: options.expectedSchemaManifestDigest,
    catalog_evidence: evidence,
    catalog_evidence_digest: options.catalogEvidenceDigest,
    inactive_expected_schema_candidate: inactiveCandidate,
    inactive_candidate_digest: options.inactiveCandidateDigest,
    prepared_attestation_draft: attestationDraft,
    prepared_attestation_digest: options.preparedAttestationDigest,
    read_only_proofs: READ_ONLY_PROOFS,
    attestation_status: 'UNATTESTED',
    manifest_activation: 'NONE',
    schema_mutation: 'NONE',
    data_mutation: 'NONE',
    credential_change: 'NONE',
    privilege_change: 'NONE',
  };

  // Final prohibited-field scan
  checkProhibitedFields(receipt);
  scanSensitive(receipt);

  return receipt;
}

/**
 * Build a deterministic JSON serialization of the receipt with fixed key ordering.
 */
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
  READ_ONLY_PROOFS,
  compareCodePoint,
  computeDigest,
  computeObjectDigest,
  stableStringify,
  scanSensitive,
  checkProhibitedFields,
  buildCollectionReceipt,
  serializeCollectionReceipt,
};
