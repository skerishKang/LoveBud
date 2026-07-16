'use strict';

/**
 * Pure core: build reviewable inactive expected-schema candidates
 * from gate-compatible sanitized catalog evidence.
 *
 * Does not activate committed manifests. Always emits status=ADOPTION_REQUIRED.
 * No database, network, shell, or environment fallback.
 *
 * Refs #3549, #3544, #3542, #3458
 */

const fs = require('node:fs');
const path = require('node:path');
const {
  validateExpectedSchemaManifest,
  SHA256_PATTERN,
} = require('./migration-provenance-core.cjs');
const { compareCodePoint } = require('./migration-catalog-fingerprint-core.cjs');

const FAILURE = Object.freeze({
  EXPECTED_SCHEMA_CANDIDATE_INPUT_INVALID: 'EXPECTED_SCHEMA_CANDIDATE_INPUT_INVALID',
  EXPECTED_SCHEMA_CANDIDATE_FORMAT_MISMATCH: 'EXPECTED_SCHEMA_CANDIDATE_FORMAT_MISMATCH',
  EXPECTED_SCHEMA_CANDIDATE_NORMALIZER_MISMATCH: 'EXPECTED_SCHEMA_CANDIDATE_NORMALIZER_MISMATCH',
  EXPECTED_SCHEMA_CANDIDATE_OBJECT_INVALID: 'EXPECTED_SCHEMA_CANDIDATE_OBJECT_INVALID',
  EXPECTED_SCHEMA_CANDIDATE_OBJECT_DUPLICATE: 'EXPECTED_SCHEMA_CANDIDATE_OBJECT_DUPLICATE',
  EXPECTED_SCHEMA_CANDIDATE_BOUNDS_EXCEEDED: 'EXPECTED_SCHEMA_CANDIDATE_BOUNDS_EXCEEDED',
  EXPECTED_SCHEMA_CANDIDATE_SENSITIVE_INPUT: 'EXPECTED_SCHEMA_CANDIDATE_SENSITIVE_INPUT',
  EXPECTED_SCHEMA_CANDIDATE_OUTPUT_PROHIBITED: 'EXPECTED_SCHEMA_CANDIDATE_OUTPUT_PROHIBITED',
  EXPECTED_SCHEMA_CANDIDATE_VALIDATION_FAILED: 'EXPECTED_SCHEMA_CANDIDATE_VALIDATION_FAILED',
});

const SUPPORTED_FORMAT_VERSION = '1.0';
const SUPPORTED_NORMALIZER_VERSION = '1.0';
const FORCED_STATUS = 'ADOPTION_REQUIRED';
const METADATA_CONTRACT_PATH = 'db/migration-provenance/catalog-metadata-contract.json';
const COMMITTED_EXPECTED_SCHEMA_REL = 'db/migration-provenance/expected-schema-manifest.json';
const COMMITTED_CANONICAL_REL = 'db/migration-provenance/canonical-migrations.json';

const EVIDENCE_TOP_LEVEL = Object.freeze(['format_version', 'normalizer_version', 'objects']);
const OBJECT_FIELDS = Object.freeze(['name', 'fingerprint']);
const CALLER_ACTIVATION_FIELDS = Object.freeze([
  'status',
  'critical_objects',
  'fingerprint_algorithm',
  'adoption_rule',
  'comparison_scope',
  'metadata_contract_path',
  'ACTIVE',
  'adoption_status',
  'approval_reference',
  'approved_by',
  'activated_at',
]);

const OBJECT_NAME_PATTERN =
  /^(?:table|view|materialized_view):[A-Za-z_][A-Za-z0-9_]*\.[A-Za-z_][A-Za-z0-9_]*$/;

const LIMITS = Object.freeze({
  max_objects: 256,
  max_object_name_length: 200,
  max_input_bytes: 1048576,
  max_string_length: 65536,
});

const SENSITIVE_MARKER_PATTERN =
  /(?:postgres(?:ql)?:\/\/|(?:api[_-]?key|token|secret|password)\s*[:=]|-----BEGIN(?: [A-Z]+)? PRIVATE KEY-----|DATABASE_URL|neon\.tech|cloud\.neon)/i;

const RAW_METADATA_MARKERS = Object.freeze([
  'schema',
  'object_name',
  'object_kind',
  'columns',
  'constraints',
  'indexes',
  'triggers',
  'row_level_security',
  'grants',
  'view_definition',
  'relation_kind',
  'rows',
  'row_values',
  'connection_string',
  'database_url',
  'host',
  'password',
  'raw_catalog',
]);

const CANDIDATE_KEY_ORDER = Object.freeze([
  'format_version',
  'status',
  'fingerprint_algorithm',
  'normalizer_version',
  'metadata_contract_path',
  'critical_objects',
  'adoption_rule',
  'comparison_scope',
]);

function fail(category, context) {
  const err = new Error(category);
  err.category = category;
  err.context = context || {};
  throw err;
}

function assertStringBounded(value, field) {
  if (typeof value !== 'string') {
    fail(FAILURE.EXPECTED_SCHEMA_CANDIDATE_OBJECT_INVALID, { field });
  }
  if (value.length > LIMITS.max_string_length) {
    fail(FAILURE.EXPECTED_SCHEMA_CANDIDATE_BOUNDS_EXCEEDED, { field });
  }
}

function scanSensitive(text, field) {
  if (typeof text !== 'string') return;
  if (SENSITIVE_MARKER_PATTERN.test(text)) {
    fail(FAILURE.EXPECTED_SCHEMA_CANDIDATE_SENSITIVE_INPUT, { field });
  }
}

function assertNoRawMetadataKeys(obj) {
  for (const key of Object.keys(obj)) {
    if (RAW_METADATA_MARKERS.includes(key)) {
      fail(FAILURE.EXPECTED_SCHEMA_CANDIDATE_SENSITIVE_INPUT, { field: key });
    }
  }
}

/**
 * Validate gate-compatible catalog evidence for candidate construction.
 * Mutates nothing; returns true or throws with category.
 */
function validateCandidateEvidence(evidence) {
  if (evidence === null || typeof evidence !== 'object' || Array.isArray(evidence)) {
    fail(FAILURE.EXPECTED_SCHEMA_CANDIDATE_INPUT_INVALID, { field: 'evidence' });
  }

  assertNoRawMetadataKeys(evidence);

  for (const key of Object.keys(evidence)) {
    if (CALLER_ACTIVATION_FIELDS.includes(key)) {
      fail(FAILURE.EXPECTED_SCHEMA_CANDIDATE_INPUT_INVALID, { field: key });
    }
    if (!EVIDENCE_TOP_LEVEL.includes(key)) {
      fail(FAILURE.EXPECTED_SCHEMA_CANDIDATE_INPUT_INVALID, { field: key });
    }
  }

  for (const required of EVIDENCE_TOP_LEVEL) {
    if (evidence[required] === undefined) {
      fail(FAILURE.EXPECTED_SCHEMA_CANDIDATE_INPUT_INVALID, { field: required });
    }
  }

  assertStringBounded(evidence.format_version, 'format_version');
  assertStringBounded(evidence.normalizer_version, 'normalizer_version');
  scanSensitive(evidence.format_version, 'format_version');
  scanSensitive(evidence.normalizer_version, 'normalizer_version');

  if (evidence.format_version !== SUPPORTED_FORMAT_VERSION) {
    fail(FAILURE.EXPECTED_SCHEMA_CANDIDATE_FORMAT_MISMATCH);
  }
  if (evidence.normalizer_version !== SUPPORTED_NORMALIZER_VERSION) {
    fail(FAILURE.EXPECTED_SCHEMA_CANDIDATE_NORMALIZER_MISMATCH);
  }

  if (!Array.isArray(evidence.objects)) {
    fail(FAILURE.EXPECTED_SCHEMA_CANDIDATE_INPUT_INVALID, { field: 'objects' });
  }
  if (evidence.objects.length > LIMITS.max_objects) {
    fail(FAILURE.EXPECTED_SCHEMA_CANDIDATE_BOUNDS_EXCEEDED, { field: 'objects' });
  }

  const seen = new Set();
  for (const item of evidence.objects) {
    if (item === null || typeof item !== 'object' || Array.isArray(item)) {
      fail(FAILURE.EXPECTED_SCHEMA_CANDIDATE_OBJECT_INVALID, { field: 'object' });
    }
    assertNoRawMetadataKeys(item);
    for (const key of Object.keys(item)) {
      if (CALLER_ACTIVATION_FIELDS.includes(key)) {
        fail(FAILURE.EXPECTED_SCHEMA_CANDIDATE_INPUT_INVALID, { field: key });
      }
      if (!OBJECT_FIELDS.includes(key)) {
        fail(FAILURE.EXPECTED_SCHEMA_CANDIDATE_OBJECT_INVALID, { field: key });
      }
    }
    if (item.name === undefined || item.fingerprint === undefined) {
      fail(FAILURE.EXPECTED_SCHEMA_CANDIDATE_OBJECT_INVALID, { field: 'name' });
    }
    assertStringBounded(item.name, 'name');
    assertStringBounded(item.fingerprint, 'fingerprint');
    scanSensitive(item.name, 'name');
    scanSensitive(item.fingerprint, 'fingerprint');

    if (item.name.length > LIMITS.max_object_name_length) {
      fail(FAILURE.EXPECTED_SCHEMA_CANDIDATE_BOUNDS_EXCEEDED, { field: 'name' });
    }
    if (!OBJECT_NAME_PATTERN.test(item.name)) {
      fail(FAILURE.EXPECTED_SCHEMA_CANDIDATE_OBJECT_INVALID, { field: 'name' });
    }
    if (!SHA256_PATTERN.test(item.fingerprint)) {
      fail(FAILURE.EXPECTED_SCHEMA_CANDIDATE_OBJECT_INVALID, { field: 'fingerprint' });
    }
    if (seen.has(item.name)) {
      fail(FAILURE.EXPECTED_SCHEMA_CANDIDATE_OBJECT_DUPLICATE, { field: 'name' });
    }
    seen.add(item.name);
  }

  return true;
}

/**
 * Extract repository-owned fixed fields from a committed inactive template.
 * Does not copy critical_objects (always rebuilt from evidence).
 */
function extractRepositoryOwnedFields(template) {
  if (template === null || typeof template !== 'object' || Array.isArray(template)) {
    fail(FAILURE.EXPECTED_SCHEMA_CANDIDATE_INPUT_INVALID, { field: 'template' });
  }
  if (template.status !== FORCED_STATUS) {
    fail(FAILURE.EXPECTED_SCHEMA_CANDIDATE_VALIDATION_FAILED, { field: 'status' });
  }
  if (!Array.isArray(template.critical_objects) || template.critical_objects.length !== 0) {
    fail(FAILURE.EXPECTED_SCHEMA_CANDIDATE_VALIDATION_FAILED, { field: 'critical_objects' });
  }
  if (template.format_version !== SUPPORTED_FORMAT_VERSION) {
    fail(FAILURE.EXPECTED_SCHEMA_CANDIDATE_FORMAT_MISMATCH);
  }
  if (template.normalizer_version !== SUPPORTED_NORMALIZER_VERSION) {
    fail(FAILURE.EXPECTED_SCHEMA_CANDIDATE_NORMALIZER_MISMATCH);
  }
  if (template.fingerprint_algorithm !== 'sha256') {
    fail(FAILURE.EXPECTED_SCHEMA_CANDIDATE_VALIDATION_FAILED, { field: 'fingerprint_algorithm' });
  }
  if (template.metadata_contract_path !== METADATA_CONTRACT_PATH) {
    fail(FAILURE.EXPECTED_SCHEMA_CANDIDATE_VALIDATION_FAILED, { field: 'metadata_contract_path' });
  }
  if (typeof template.adoption_rule !== 'string' || !template.adoption_rule.trim()) {
    fail(FAILURE.EXPECTED_SCHEMA_CANDIDATE_VALIDATION_FAILED, { field: 'adoption_rule' });
  }
  if (!Array.isArray(template.comparison_scope) || template.comparison_scope.length === 0) {
    fail(FAILURE.EXPECTED_SCHEMA_CANDIDATE_VALIDATION_FAILED, { field: 'comparison_scope' });
  }
  for (const scope of template.comparison_scope) {
    assertStringBounded(scope, 'comparison_scope');
    scanSensitive(scope, 'comparison_scope');
  }
  scanSensitive(template.adoption_rule, 'adoption_rule');

  return {
    format_version: template.format_version,
    fingerprint_algorithm: template.fingerprint_algorithm,
    normalizer_version: template.normalizer_version,
    metadata_contract_path: template.metadata_contract_path,
    adoption_rule: template.adoption_rule,
    comparison_scope: template.comparison_scope.slice(),
  };
}

/**
 * Build inactive expected-schema candidate from evidence + repository template fields.
 * status is always ADOPTION_REQUIRED; critical_objects come only from evidence.
 */
function buildExpectedSchemaCandidate(evidence, template) {
  validateCandidateEvidence(evidence);
  const owned = extractRepositoryOwnedFields(template);

  const critical_objects = evidence.objects
    .map((item) => ({
      name: item.name,
      fingerprint: item.fingerprint,
    }))
    .sort((a, b) => compareCodePoint(a.name, b.name));

  const candidate = {
    format_version: owned.format_version,
    status: FORCED_STATUS,
    fingerprint_algorithm: owned.fingerprint_algorithm,
    normalizer_version: owned.normalizer_version,
    metadata_contract_path: owned.metadata_contract_path,
    critical_objects,
    adoption_rule: owned.adoption_rule,
    comparison_scope: owned.comparison_scope,
  };

  const validation = validateCandidateAgainstContract(candidate);
  if (!validation.ok) {
    fail(FAILURE.EXPECTED_SCHEMA_CANDIDATE_VALIDATION_FAILED);
  }
  if (candidate.status !== FORCED_STATUS) {
    fail(FAILURE.EXPECTED_SCHEMA_CANDIDATE_VALIDATION_FAILED, { field: 'status' });
  }
  if (candidate.status === 'ACTIVE') {
    fail(FAILURE.EXPECTED_SCHEMA_CANDIDATE_VALIDATION_FAILED, { field: 'status' });
  }

  return candidate;
}

/**
 * Validate candidate with existing expected-schema manifest validator.
 */
function validateCandidateAgainstContract(candidate) {
  const result = validateExpectedSchemaManifest(candidate);
  if (!result.ok) {
    return result;
  }
  if (!candidate || candidate.status !== FORCED_STATUS) {
    return {
      ok: false,
      errors: [...result.errors, 'EXPECTED_SCHEMA_CANDIDATE_STATUS_NOT_INACTIVE'],
    };
  }
  if (candidate.format_version !== SUPPORTED_FORMAT_VERSION) {
    return {
      ok: false,
      errors: [...result.errors, 'EXPECTED_SCHEMA_CANDIDATE_FORMAT_MISMATCH'],
    };
  }
  if (candidate.normalizer_version !== SUPPORTED_NORMALIZER_VERSION) {
    return {
      ok: false,
      errors: [...result.errors, 'EXPECTED_SCHEMA_CANDIDATE_NORMALIZER_MISMATCH'],
    };
  }
  if (candidate.metadata_contract_path !== METADATA_CONTRACT_PATH) {
    return {
      ok: false,
      errors: [...result.errors, 'EXPECTED_SCHEMA_CANDIDATE_CONTRACT_PATH_MISMATCH'],
    };
  }
  if (candidate.fingerprint_algorithm !== 'sha256') {
    return {
      ok: false,
      errors: [...result.errors, 'EXPECTED_SCHEMA_CANDIDATE_ALGORITHM_MISMATCH'],
    };
  }
  return result;
}

/**
 * Byte-stable pretty JSON with fixed key order (not localeCompare).
 */
function serializeExpectedSchemaCandidate(candidate) {
  const validation = validateCandidateAgainstContract(candidate);
  if (!validation.ok) {
    fail(FAILURE.EXPECTED_SCHEMA_CANDIDATE_VALIDATION_FAILED);
  }

  const orderedObjects = candidate.critical_objects
    .map((item) => ({ name: item.name, fingerprint: item.fingerprint }))
    .sort((a, b) => compareCodePoint(a.name, b.name));

  const ordered = {};
  for (const key of CANDIDATE_KEY_ORDER) {
    if (key === 'critical_objects') {
      ordered[key] = orderedObjects;
    } else if (key === 'status') {
      ordered[key] = FORCED_STATUS;
    } else if (Object.prototype.hasOwnProperty.call(candidate, key)) {
      ordered[key] = candidate[key];
    }
  }
  return `${JSON.stringify(ordered, null, 2)}\n`;
}

function decodeUtf8Strict(buffer) {
  try {
    const decoder = new TextDecoder('utf-8', { fatal: true });
    return decoder.decode(buffer);
  } catch {
    fail(FAILURE.EXPECTED_SCHEMA_CANDIDATE_INPUT_INVALID, { field: 'utf8' });
  }
}

function assertRepoRelativePath(repoRoot, relativePath) {
  if (typeof relativePath !== 'string' || !relativePath) {
    fail(FAILURE.EXPECTED_SCHEMA_CANDIDATE_INPUT_INVALID, { field: 'path' });
  }
  if (path.isAbsolute(relativePath)) {
    fail(FAILURE.EXPECTED_SCHEMA_CANDIDATE_INPUT_INVALID, { field: 'path' });
  }
  const normalized = relativePath.replace(/\\/g, '/');
  if (
    normalized.startsWith('/') ||
    normalized.includes('://') ||
    normalized.split('/').some((part) => part === '..')
  ) {
    fail(FAILURE.EXPECTED_SCHEMA_CANDIDATE_INPUT_INVALID, { field: 'path' });
  }

  const root = path.resolve(repoRoot);
  const resolved = path.resolve(root, relativePath);
  if (resolved !== root && !resolved.startsWith(`${root}${path.sep}`)) {
    fail(FAILURE.EXPECTED_SCHEMA_CANDIDATE_INPUT_INVALID, { field: 'path' });
  }
  return resolved;
}

function assertOutputNotCommittedManifest(repoRoot, relativePath) {
  const resolved = assertRepoRelativePath(repoRoot, relativePath);
  const prohibited = path.resolve(repoRoot, COMMITTED_EXPECTED_SCHEMA_REL);
  if (resolved === prohibited) {
    fail(FAILURE.EXPECTED_SCHEMA_CANDIDATE_OUTPUT_PROHIBITED);
  }
  return resolved;
}

function readEvidenceFile(absolutePath, options = {}) {
  const maxBytes = options.maxInputBytes || LIMITS.max_input_bytes;
  let stat;
  try {
    stat = fs.statSync(absolutePath);
  } catch {
    fail(FAILURE.EXPECTED_SCHEMA_CANDIDATE_INPUT_INVALID, { field: 'evidence' });
  }
  if (!stat.isFile()) {
    fail(FAILURE.EXPECTED_SCHEMA_CANDIDATE_INPUT_INVALID, { field: 'evidence' });
  }
  if (stat.size > maxBytes) {
    fail(FAILURE.EXPECTED_SCHEMA_CANDIDATE_BOUNDS_EXCEEDED, { field: 'evidence' });
  }
  let raw;
  try {
    raw = fs.readFileSync(absolutePath);
  } catch {
    fail(FAILURE.EXPECTED_SCHEMA_CANDIDATE_INPUT_INVALID, { field: 'evidence' });
  }
  if (raw.length > maxBytes) {
    fail(FAILURE.EXPECTED_SCHEMA_CANDIDATE_BOUNDS_EXCEEDED, { field: 'evidence' });
  }
  const text = decodeUtf8Strict(raw);
  scanSensitive(text, 'evidence');
  let parsed;
  try {
    parsed = JSON.parse(text);
  } catch {
    fail(FAILURE.EXPECTED_SCHEMA_CANDIDATE_INPUT_INVALID, { field: 'json' });
  }
  return parsed;
}

/**
 * Load full committed inactive template (empty critical_objects) for builders.
 */
function loadCommittedInactiveTemplate(repoRoot) {
  const absolute = path.resolve(repoRoot, COMMITTED_EXPECTED_SCHEMA_REL);
  let raw;
  try {
    raw = fs.readFileSync(absolute);
  } catch {
    fail(FAILURE.EXPECTED_SCHEMA_CANDIDATE_INPUT_INVALID, { field: 'template' });
  }
  let template;
  try {
    template = JSON.parse(decodeUtf8Strict(raw));
  } catch {
    fail(FAILURE.EXPECTED_SCHEMA_CANDIDATE_INPUT_INVALID, { field: 'template' });
  }
  extractRepositoryOwnedFields(template);
  return template;
}

function fileSha256Hex(filePath) {
  const crypto = require('node:crypto');
  return crypto.createHash('sha256').update(fs.readFileSync(filePath)).digest('hex');
}

module.exports = {
  FAILURE,
  LIMITS,
  FORCED_STATUS,
  SUPPORTED_FORMAT_VERSION,
  SUPPORTED_NORMALIZER_VERSION,
  METADATA_CONTRACT_PATH,
  COMMITTED_EXPECTED_SCHEMA_REL,
  COMMITTED_CANONICAL_REL,
  CANDIDATE_KEY_ORDER,
  validateCandidateEvidence,
  extractRepositoryOwnedFields,
  buildExpectedSchemaCandidate,
  serializeExpectedSchemaCandidate,
  validateCandidateAgainstContract,
  assertRepoRelativePath,
  assertOutputNotCommittedManifest,
  readEvidenceFile,
  loadCommittedInactiveTemplate,
  fileSha256Hex,
  compareCodePoint,
};
