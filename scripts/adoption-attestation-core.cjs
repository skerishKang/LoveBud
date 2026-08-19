'use strict';

/**
 * Pure core: strict inactive adoption-attestation evidence contract validation.
 * No database, network, shell, or environment fallback.
 * Does not activate committed manifests.
 *
 * Refs #3553, #3549, #3458, #3425
 */

const crypto = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');
const { validatePreparedCollectionPlan } = require('./adoption-baseline-collection-plan-core.cjs');
// Repository-owned canonical catalog contracts (single source of truth).
const {
  REQUIRED_MIGRATION_FIELDS,
  DESTRUCTIVE_OPERATION_VOCABULARY,
  SHA256_PATTERN,
  isValidApprovalReference,
} = require('./migration-provenance-core.cjs');

const PROHIBITED_FIELDS = new Set([
  'host', 'hostname', 'port', 'database', 'database_name',
  'database_url', 'connection_string', 'url', 'secret', 'token',
  'password', 'credential', 'username', 'operator', 'operator_name',
  'operator_email', 'raw_role', 'role_name', 'provider_project',
  'provider_branch', 'raw_catalog', 'rows', 'row_values', 'payload',
  'grantee_name', 'database_owner',
]);

const FAILURE = Object.freeze({
  ADOPTION_ATTESTATION_INPUT_INVALID: 'ADOPTION_ATTESTATION_INPUT_INVALID',
  ADOPTION_ATTESTATION_FORMAT_MISMATCH: 'ADOPTION_ATTESTATION_FORMAT_MISMATCH',
  ADOPTION_ATTESTATION_FIELD_MISSING: 'ADOPTION_ATTESTATION_FIELD_MISSING',
  ADOPTION_ATTESTATION_UNKNOWN_FIELD: 'ADOPTION_ATTESTATION_UNKNOWN_FIELD',
  ADOPTION_ATTESTATION_PROHIBITED_FIELD: 'ADOPTION_ATTESTATION_PROHIBITED_FIELD',
  ADOPTION_ATTESTATION_ENUM_INVALID: 'ADOPTION_ATTESTATION_ENUM_INVALID',
  ADOPTION_ATTESTATION_SENSITIVE_MARKER: 'ADOPTION_ATTESTATION_SENSITIVE_MARKER',
  ADOPTION_ATTESTATION_COMMIT_INVALID: 'ADOPTION_ATTESTATION_COMMIT_INVALID',
  ADOPTION_ATTESTATION_COMMIT_MISMATCH: 'ADOPTION_ATTESTATION_COMMIT_MISMATCH',
  ADOPTION_ATTESTATION_DIGEST_INVALID: 'ADOPTION_ATTESTATION_DIGEST_INVALID',
  ADOPTION_ATTESTATION_DIGEST_MISMATCH: 'ADOPTION_ATTESTATION_DIGEST_MISMATCH',
  ADOPTION_ATTESTATION_VARIANCE_BLOCKING: 'ADOPTION_ATTESTATION_VARIANCE_BLOCKING',
  ADOPTION_ATTESTATION_APPROVAL_INVALID: 'ADOPTION_ATTESTATION_APPROVAL_INVALID',
  ADOPTION_ATTESTATION_MIGRATION_INVALID: 'ADOPTION_ATTESTATION_MIGRATION_INVALID',
  ADOPTION_ATTESTATION_PATH_INVALID: 'ADOPTION_ATTESTATION_PATH_INVALID',
  ADOPTION_ATTESTATION_BOUNDS_EXCEEDED: 'ADOPTION_ATTESTATION_BOUNDS_EXCEEDED',
  ADOPTION_ATTESTATION_UNATTESTED: 'ADOPTION_ATTESTATION_UNATTESTED',
  ADOPTION_ATTESTATION_VALUE_INVALID: 'ADOPTION_ATTESTATION_VALUE_INVALID',
});

const GATE = Object.freeze({
  GATE_ADOPTION_EVIDENCE_UNAVAILABLE: 'GATE_ADOPTION_EVIDENCE_UNAVAILABLE',
  GATE_ADOPTION_EVIDENCE_INVALID: 'GATE_ADOPTION_EVIDENCE_INVALID',
  GATE_ADOPTION_BASELINE_COMMIT_INVALID: 'GATE_ADOPTION_BASELINE_COMMIT_INVALID',
  GATE_ADOPTION_BASELINE_COMMIT_MISMATCH: 'GATE_ADOPTION_BASELINE_COMMIT_MISMATCH',
  GATE_ADOPTION_MANIFEST_DIGEST_INVALID: 'GATE_ADOPTION_MANIFEST_DIGEST_INVALID',
  GATE_ADOPTION_MANIFEST_DIGEST_MISMATCH: 'GATE_ADOPTION_MANIFEST_DIGEST_MISMATCH',
  GATE_ADOPTION_EXPECTED_SCHEMA_DIGEST_INVALID: 'GATE_ADOPTION_EXPECTED_SCHEMA_DIGEST_INVALID',
  GATE_ADOPTION_EXPECTED_SCHEMA_DIGEST_MISMATCH: 'GATE_ADOPTION_EXPECTED_SCHEMA_DIGEST_MISMATCH',
  GATE_ADOPTION_CATALOG_DIGEST_INVALID: 'GATE_ADOPTION_CATALOG_DIGEST_INVALID',
  GATE_ADOPTION_CATALOG_DIGEST_MISMATCH: 'GATE_ADOPTION_CATALOG_DIGEST_MISMATCH',
  GATE_ADOPTION_ENVIRONMENT_CLASS_INVALID: 'GATE_ADOPTION_ENVIRONMENT_CLASS_INVALID',
  GATE_ADOPTION_VARIANCE_BLOCKING: 'GATE_ADOPTION_VARIANCE_BLOCKING',
  GATE_ADOPTION_APPROVAL_REFERENCE_INVALID: 'GATE_ADOPTION_APPROVAL_REFERENCE_INVALID',
  GATE_ADOPTION_APPROVAL_REFERENCE_MISMATCH: 'GATE_ADOPTION_APPROVAL_REFERENCE_MISMATCH',
  GATE_ADOPTION_ENVIRONMENT_CLASS_MISMATCH: 'GATE_ADOPTION_ENVIRONMENT_CLASS_MISMATCH',
  GATE_ADOPTION_SCOPE_MISMATCH: 'GATE_ADOPTION_SCOPE_MISMATCH',
  GATE_ADOPTION_TRUST_BINDING_REQUIRED: 'GATE_ADOPTION_TRUST_BINDING_REQUIRED',
  GATE_ADOPTION_UNKNOWN_FIELD: 'GATE_ADOPTION_UNKNOWN_FIELD',
  GATE_ADOPTION_SENSITIVE_MARKER_DETECTED: 'GATE_ADOPTION_SENSITIVE_MARKER_DETECTED',
  GATE_ADOPTION_MIGRATION_INVALID: 'GATE_ADOPTION_MIGRATION_INVALID',
  GATE_ADOPTION_MIGRATION_DUPLICATE: 'GATE_ADOPTION_MIGRATION_DUPLICATE',
  GATE_ADOPTION_MIGRATION_UNKNOWN: 'GATE_ADOPTION_MIGRATION_UNKNOWN',
  GATE_ADOPTION_MIGRATION_REORDERED: 'GATE_ADOPTION_MIGRATION_REORDERED',
  GATE_ADOPTION_MIGRATION_CHECKSUM_MISMATCH: 'GATE_ADOPTION_MIGRATION_CHECKSUM_MISMATCH',
  GATE_ADOPTION_MIGRATION_MISSING: 'GATE_ADOPTION_MIGRATION_MISSING',
});

const DEFAULT_CONTRACT_REL = 'db/migration-provenance/adoption-attestation-contract.json';

/** Trusted binding fields that must be supplied by the protected invocation boundary. */
const REQUIRED_TRUSTED_BINDING_FIELDS = Object.freeze([
  'baseline_commit',
  'canonical_manifest_digest',
  'expected_schema_digest',
  'catalog_evidence_digest',
  'approval_reference',
  'environment_class',
  'attestation_scope',
  'expected_migrations',
]);

const FALLBACK_SENSITIVE_MARKERS = Object.freeze([
  'postgres://',
  'postgresql://',
  'DATABASE_URL',
  'password=',
  'password:',
  'api_key',
  'api-key',
  'secret=',
  'secret:',
  'token=',
  'token:',
  'BEGIN PRIVATE KEY',
  'BEGIN RSA PRIVATE KEY',
  'neon.tech',
  'cloud.neon',
]);

function fail(category, context) {
  const err = new Error(category);
  err.category = category;
  err.context = context || {};
  throw err;
}

function compareCodePoint(a, b) {
  const left = String(a);
  const right = String(b);
  if (left < right) return -1;
  if (left > right) return 1;
  return 0;
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
  return asciiLowerCase(haystack).includes(asciiLowerCase(needle));
}

function stableStringify(value) {
  if (value === null) return 'null';
  const t = typeof value;
  if (t === 'boolean') return value ? 'true' : 'false';
  if (t === 'number') {
    if (!Number.isFinite(value)) fail(FAILURE.ADOPTION_ATTESTATION_INPUT_INVALID, { field: 'number' });
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
  fail(FAILURE.ADOPTION_ATTESTATION_INPUT_INVALID, { field: 'value' });
}

function computeEvidenceDigest(bytesOrString) {
  const buf = Buffer.isBuffer(bytesOrString)
    ? bytesOrString
    : Buffer.from(String(bytesOrString), 'utf8');
  return `sha256:${crypto.createHash('sha256').update(buf).digest('hex')}`;
}

function computeObjectDigest(obj) {
  return computeEvidenceDigest(Buffer.from(stableStringify(obj), 'utf8'));
}

function defaultContractPath(repoRoot) {
  return path.join(repoRoot, 'db', 'migration-provenance', 'adoption-attestation-contract.json');
}

function loadJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, 'utf8'));
}

function loadAdoptionAttestationContract(repoRoot) {
  return loadJson(defaultContractPath(repoRoot));
}

function validateAdoptionAttestationContract(contract) {
  if (!contract || typeof contract !== 'object' || Array.isArray(contract)) {
    fail(FAILURE.ADOPTION_ATTESTATION_INPUT_INVALID, { field: 'contract' });
  }
  if (contract.format_version !== '1.0') {
    fail(FAILURE.ADOPTION_ATTESTATION_FORMAT_MISMATCH);
  }
  if (contract.digest_algorithm !== 'sha256') {
    fail(FAILURE.ADOPTION_ATTESTATION_INPUT_INVALID, { field: 'digest_algorithm' });
  }
  for (const key of [
    'required_top_level_fields',
    'allowed_top_level_fields',
    'enums',
    'patterns',
    'limits',
    'prohibited_fields',
  ]) {
    if (contract[key] === undefined) {
      fail(FAILURE.ADOPTION_ATTESTATION_FIELD_MISSING, { field: key });
    }
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
    fail(FAILURE.ADOPTION_ATTESTATION_PATH_INVALID, { field: 'path' });
  }
  if (path.isAbsolute(relativePath)) {
    fail(FAILURE.ADOPTION_ATTESTATION_PATH_INVALID, { field: 'path' });
  }
  const normalized = relativePath.replace(/\\/g, '/');
  if (
    normalized.startsWith('/') ||
    normalized.includes('://') ||
    normalized.split('/').some((part) => part === '..' || part === '')
  ) {
    fail(FAILURE.ADOPTION_ATTESTATION_PATH_INVALID, { field: 'path' });
  }
  const root = path.resolve(repoRoot);
  const resolved = path.resolve(root, relativePath);
  if (isPathOutside(root, resolved) || resolved === root) {
    fail(FAILURE.ADOPTION_ATTESTATION_PATH_INVALID, { field: 'path' });
  }
  return resolved;
}

function resolveRepoConfinedPath(repoRoot, repoRelativePath) {
  const lexicalPath = assertRepoRelativePath(repoRoot, repoRelativePath);
  let realRoot;
  try {
    realRoot = fs.realpathSync.native(path.resolve(repoRoot));
  } catch {
    fail(FAILURE.ADOPTION_ATTESTATION_PATH_INVALID, { field: 'path' });
  }
  let realPath;
  try {
    realPath = fs.realpathSync.native(lexicalPath);
  } catch {
    fail(FAILURE.ADOPTION_ATTESTATION_PATH_INVALID, { field: 'path' });
  }
  if (isPathOutside(realRoot, realPath) || realPath === realRoot) {
    fail(FAILURE.ADOPTION_ATTESTATION_PATH_INVALID, { field: 'path' });
  }
  return { realRoot, realPath, lexicalPath };
}

function decodeUtf8Strict(buffer) {
  try {
    const decoder = new TextDecoder('utf-8', { fatal: true });
    return decoder.decode(buffer);
  } catch {
    fail(FAILURE.ADOPTION_ATTESTATION_INPUT_INVALID, { field: 'utf8' });
  }
}

function readConfinedEvidenceFile(repoRoot, repoRelativePath, options = {}) {
  const maxBytes = (options && options.maxInputBytes) || 1048576;
  const { realPath } = resolveRepoConfinedPath(repoRoot, repoRelativePath);
  let stat;
  try {
    stat = fs.statSync(realPath);
  } catch {
    fail(FAILURE.ADOPTION_ATTESTATION_PATH_INVALID, { field: 'path' });
  }
  if (!stat.isFile()) {
    fail(FAILURE.ADOPTION_ATTESTATION_PATH_INVALID, { field: 'path' });
  }
  if (stat.size > maxBytes) {
    fail(FAILURE.ADOPTION_ATTESTATION_BOUNDS_EXCEEDED, { field: 'size' });
  }
  let raw;
  try {
    raw = fs.readFileSync(realPath);
  } catch {
    fail(FAILURE.ADOPTION_ATTESTATION_PATH_INVALID, { field: 'path' });
  }
  if (raw.length > maxBytes) {
    fail(FAILURE.ADOPTION_ATTESTATION_BOUNDS_EXCEEDED, { field: 'size' });
  }
  const text = decodeUtf8Strict(raw);
  let parsed;
  try {
    parsed = JSON.parse(text);
  } catch {
    fail(FAILURE.ADOPTION_ATTESTATION_INPUT_INVALID, { field: 'json' });
  }
  return { value: parsed, bytes: raw, digest: computeEvidenceDigest(raw) };
}

function pushUnique(blockers, code) {
  if (code && !blockers.includes(code)) blockers.push(code);
}

function hasSensitive(text, markers) {
  if (typeof text !== 'string') return false;
  for (const marker of markers) {
    if (typeof marker !== 'string' || !marker) continue;
    if (includesAsciiCaseInsensitive(text, marker)) return true;
  }
  return false;
}

function scanValueSensitive(value, markers, blockers, errors) {
  if (typeof value === 'string') {
    if (hasSensitive(value, markers)) {
      pushUnique(blockers, GATE.GATE_ADOPTION_SENSITIVE_MARKER_DETECTED);
      pushUnique(errors, FAILURE.ADOPTION_ATTESTATION_SENSITIVE_MARKER);
    }
    return;
  }
  if (Array.isArray(value)) {
    for (const item of value) scanValueSensitive(item, markers, blockers, errors);
    return;
  }
  if (value && typeof value === 'object') {
    for (const key of Object.keys(value)) {
      if (hasSensitive(key, markers)) {
        pushUnique(blockers, GATE.GATE_ADOPTION_SENSITIVE_MARKER_DETECTED);
        pushUnique(errors, FAILURE.ADOPTION_ATTESTATION_SENSITIVE_MARKER);
      }
      scanValueSensitive(value[key], markers, blockers, errors);
    }
  }
}

function matchPattern(value, pattern) {
  if (typeof value !== 'string' || typeof pattern !== 'string') return false;
  try {
    return new RegExp(pattern).test(value);
  } catch {
    return false;
  }
}

/**
 * True when binding is a complete trusted adoption binding from the invocation boundary.
 * Evidence values are claims and never establish trust by themselves.
 * expected_migrations must be an array (empty array is valid for inactive canonical manifests).
 */
function hasCompleteTrustedBinding(binding) {
  if (!binding || typeof binding !== 'object' || Array.isArray(binding)) return false;
  for (const field of REQUIRED_TRUSTED_BINDING_FIELDS) {
    const value = binding[field];
    if (field === 'expected_migrations') {
      if (!Array.isArray(value)) return false;
      continue;
    }
    if (value === undefined || value === null || value === '') return false;
  }
  return true;
}

/**
 * Validate trusted expected_migrations array shape before evidence comparison.
 * Returns true when the list is usable for authoritative ordered comparison.
 * Never echoes raw id/checksum values into blockers/errors.
 */
function validateTrustedExpectedMigrations(expectedList, options, blockers, errors) {
  const {
    allowedMigFields,
    prohibited,
    migrationIdPattern,
    digestPattern,
    markers,
    maxMigrations,
  } = options;

  if (!Array.isArray(expectedList)) {
    pushUnique(blockers, GATE.GATE_ADOPTION_TRUST_BINDING_REQUIRED);
    pushUnique(errors, FAILURE.ADOPTION_ATTESTATION_INPUT_INVALID);
    return false;
  }
  if (expectedList.length > maxMigrations) {
    pushUnique(blockers, GATE.GATE_ADOPTION_MIGRATION_INVALID);
    pushUnique(errors, FAILURE.ADOPTION_ATTESTATION_BOUNDS_EXCEEDED);
    return false;
  }

  const seenIds = new Set();
  let ok = true;
  for (let index = 0; index < expectedList.length; index += 1) {
    const record = expectedList[index];
    if (!record || typeof record !== 'object' || Array.isArray(record)) {
      pushUnique(blockers, GATE.GATE_ADOPTION_MIGRATION_INVALID);
      pushUnique(errors, FAILURE.ADOPTION_ATTESTATION_MIGRATION_INVALID);
      ok = false;
      continue;
    }
    // Sparse-array hole or non-own index is treated as malformed.
    if (!Object.prototype.hasOwnProperty.call(expectedList, index)) {
      pushUnique(blockers, GATE.GATE_ADOPTION_MIGRATION_INVALID);
      pushUnique(errors, FAILURE.ADOPTION_ATTESTATION_MIGRATION_INVALID);
      ok = false;
      continue;
    }
    for (const key of Object.keys(record)) {
      if (prohibited.has(key)) {
        pushUnique(blockers, GATE.GATE_ADOPTION_SENSITIVE_MARKER_DETECTED);
        pushUnique(errors, FAILURE.ADOPTION_ATTESTATION_PROHIBITED_FIELD);
        ok = false;
      } else if (!allowedMigFields.has(key)) {
        pushUnique(blockers, GATE.GATE_ADOPTION_MIGRATION_INVALID);
        pushUnique(errors, FAILURE.ADOPTION_ATTESTATION_UNKNOWN_FIELD);
        ok = false;
      }
    }
    if (record.id === undefined || record.id === null || record.id === '') {
      pushUnique(blockers, GATE.GATE_ADOPTION_MIGRATION_INVALID);
      pushUnique(errors, FAILURE.ADOPTION_ATTESTATION_MIGRATION_INVALID);
      ok = false;
    } else if (typeof record.id !== 'string' || !matchPattern(record.id, migrationIdPattern)) {
      pushUnique(blockers, GATE.GATE_ADOPTION_MIGRATION_INVALID);
      pushUnique(errors, FAILURE.ADOPTION_ATTESTATION_MIGRATION_INVALID);
      ok = false;
    } else if (seenIds.has(record.id)) {
      pushUnique(blockers, GATE.GATE_ADOPTION_MIGRATION_DUPLICATE);
      pushUnique(errors, FAILURE.ADOPTION_ATTESTATION_MIGRATION_INVALID);
      ok = false;
    } else {
      seenIds.add(record.id);
    }
    if (record.checksum === undefined || record.checksum === null || record.checksum === '') {
      pushUnique(blockers, GATE.GATE_ADOPTION_MIGRATION_INVALID);
      pushUnique(errors, FAILURE.ADOPTION_ATTESTATION_MIGRATION_INVALID);
      ok = false;
    } else if (
      typeof record.checksum !== 'string' ||
      !matchPattern(record.checksum, digestPattern)
    ) {
      pushUnique(blockers, GATE.GATE_ADOPTION_MIGRATION_INVALID);
      pushUnique(errors, FAILURE.ADOPTION_ATTESTATION_MIGRATION_INVALID);
      ok = false;
    }
    scanValueSensitive(record, markers, blockers, errors);
  }
  return ok;
}

/**
 * Validate adoption attestation evidence against contract + mandatory trusted binding.
 * For ATTESTED evidence, binding must include every REQUIRED_TRUSTED_BINDING_FIELDS value
 * from the protected invocation boundary. Evidence never supplies its own trust source.
 *
 * expected_migrations is mandatory in the trusted binding (repository-owned list; empty allowed).
 *
 * Returns { ok, blockers, errors } without raw path/content leakage.
 */
function validateAdoptionAttestationEvidence(evidence, binding, contract) {
  const blockers = [];
  const errors = [];

  if (!evidence || typeof evidence !== 'object' || Array.isArray(evidence)) {
    return {
      ok: false,
      blockers: [GATE.GATE_ADOPTION_EVIDENCE_UNAVAILABLE],
      errors: [FAILURE.ADOPTION_ATTESTATION_INPUT_INVALID],
    };
  }

  let activeContract = contract;
  if (!activeContract) {
    // Minimal embedded fallback so pure validation works without filesystem when contract is supplied by tests/gate.
    activeContract = {
      format_version: '1.0',
      digest_algorithm: 'sha256',
      required_top_level_fields: [
        'format_version',
        'adoption_status',
        'environment_class',
        'baseline_commit',
        'canonical_manifest_digest',
        'expected_schema_digest',
        'catalog_evidence_digest',
        'variance_classification',
        'approval_reference',
        'applied_migrations',
        'attestation_scope',
      ],
      allowed_top_level_fields: [
        'format_version',
        'adoption_status',
        'environment_class',
        'baseline_commit',
        'canonical_manifest_digest',
        'expected_schema_digest',
        'catalog_evidence_digest',
        'variance_classification',
        'approval_reference',
        'applied_migrations',
        'contract_path',
        'digest_algorithm',
        'attestation_scope',
        'known_variance_codes',
      ],
      applied_migration_required_fields: ['id', 'checksum'],
      applied_migration_allowed_fields: ['id', 'checksum'],
      enums: {
        adoption_status: ['UNATTESTED', 'ATTESTED'],
        environment_class: ['DISPOSABLE_CI', 'PREVIEW', 'STAGING', 'PRODUCTION'],
        variance_classification: ['MATCH', 'KNOWN_DRIFT', 'UNSUPPORTED_LEGACY_STATE', 'UNKNOWN_DRIFT'],
        known_variance_codes: ['SCHEMA_COMPAT_KNOWN', 'LEGACY_INDEX_VARIANT', 'GRANT_SURFACE_KNOWN'],
        attestation_scope: [
          'INACTIVE_BASELINE',
          'DISPOSABLE_RECONSTRUCTION',
          'PREVIEW_READONLY',
          'STAGING_READONLY',
          'PRODUCTION_READONLY',
        ],
      },
      prohibited_fields: [
        'host',
        'hostname',
        'port',
        'database',
        'database_name',
        'database_url',
        'connection_string',
        'secret',
        'secret_name',
        'secret_value',
        'username',
        'password',
        'operator',
        'operator_name',
        'operator_email',
        'operator_user_id',
        'raw_role',
        'credential',
        'raw_catalog',
        'raw_catalog_payload',
        'rows',
        'row_values',
        'values',
        'payload',
      ],
      patterns: {
        baseline_commit: '^[a-f0-9]{40}$',
        digest: '^sha256:[a-f0-9]{64}$',
        migration_id: '^\\d{14}_[a-z0-9]+(?:-[a-z0-9]+)*$',
        approval_reference: '^(?:issue:\\d+|decision:[A-Za-z0-9][A-Za-z0-9._-]{2,63})$',
      },
      blocking_variance: ['UNKNOWN_DRIFT', 'UNSUPPORTED_LEGACY_STATE'],
      known_drift_requires_codes: true,
      limits: {
        max_applied_migrations: 256,
        max_string_length: 512,
        max_input_bytes: 1048576,
        max_approval_reference_length: 96,
        max_known_variance_codes: 32,
      },
      sensitive_content_markers: FALLBACK_SENSITIVE_MARKERS,
    };
  }

  try {
    validateAdoptionAttestationContract(activeContract);
  } catch {
    pushUnique(blockers, GATE.GATE_ADOPTION_EVIDENCE_INVALID);
    pushUnique(errors, FAILURE.ADOPTION_ATTESTATION_INPUT_INVALID);
    return { ok: false, blockers: uniqueSorted(blockers), errors: uniqueSorted(errors) };
  }

  const markers = Array.isArray(activeContract.sensitive_content_markers)
    ? activeContract.sensitive_content_markers
    : FALLBACK_SENSITIVE_MARKERS;
  const limits = activeContract.limits || {};
  const maxString = limits.max_string_length || 512;
  const required = activeContract.required_top_level_fields || [];
  const allowed = new Set(activeContract.allowed_top_level_fields || []);
  const prohibited = new Set(activeContract.prohibited_fields || []);
  const enums = activeContract.enums || {};
  const patterns = activeContract.patterns || {};

  for (const key of Object.keys(evidence)) {
    if (prohibited.has(key)) {
      pushUnique(blockers, GATE.GATE_ADOPTION_SENSITIVE_MARKER_DETECTED);
      pushUnique(errors, FAILURE.ADOPTION_ATTESTATION_PROHIBITED_FIELD);
      continue;
    }
    if (!allowed.has(key)) {
      pushUnique(blockers, GATE.GATE_ADOPTION_UNKNOWN_FIELD);
      pushUnique(errors, FAILURE.ADOPTION_ATTESTATION_UNKNOWN_FIELD);
    }
  }

  scanValueSensitive(evidence, markers, blockers, errors);

  for (const key of required) {
    if (evidence[key] === undefined || evidence[key] === null) {
      pushUnique(blockers, GATE.GATE_ADOPTION_EVIDENCE_INVALID);
      pushUnique(errors, FAILURE.ADOPTION_ATTESTATION_FIELD_MISSING);
    }
  }

  if (evidence.format_version !== undefined && evidence.format_version !== '1.0') {
    pushUnique(blockers, GATE.GATE_ADOPTION_EVIDENCE_INVALID);
    pushUnique(errors, FAILURE.ADOPTION_ATTESTATION_FORMAT_MISMATCH);
  }

  if (evidence.digest_algorithm !== undefined && evidence.digest_algorithm !== 'sha256') {
    pushUnique(blockers, GATE.GATE_ADOPTION_EVIDENCE_INVALID);
    pushUnique(errors, FAILURE.ADOPTION_ATTESTATION_INPUT_INVALID);
  }

  if (evidence.contract_path !== undefined) {
    if (
      typeof evidence.contract_path !== 'string' ||
      evidence.contract_path !== DEFAULT_CONTRACT_REL
    ) {
      pushUnique(blockers, GATE.GATE_ADOPTION_EVIDENCE_INVALID);
      pushUnique(errors, FAILURE.ADOPTION_ATTESTATION_INPUT_INVALID);
    }
  }

  // String bound checks without echoing values.
  for (const key of Object.keys(evidence)) {
    const value = evidence[key];
    if (typeof value === 'string' && value.length > maxString) {
      pushUnique(blockers, GATE.GATE_ADOPTION_EVIDENCE_INVALID);
      pushUnique(errors, FAILURE.ADOPTION_ATTESTATION_BOUNDS_EXCEEDED);
    }
  }

  if (evidence.adoption_status === 'UNATTESTED') {
    pushUnique(blockers, GATE.GATE_ADOPTION_EVIDENCE_UNAVAILABLE);
    pushUnique(errors, FAILURE.ADOPTION_ATTESTATION_UNATTESTED);
    return { ok: false, blockers: uniqueSorted(blockers), errors: uniqueSorted(errors) };
  }

  if (evidence.adoption_status !== 'ATTESTED') {
    pushUnique(blockers, GATE.GATE_ADOPTION_EVIDENCE_INVALID);
    pushUnique(errors, FAILURE.ADOPTION_ATTESTATION_ENUM_INVALID);
    return { ok: false, blockers: uniqueSorted(blockers), errors: uniqueSorted(errors) };
  }

  // ATTESTED path: trusted binding is mandatory. Evidence is never its own trust source.
  const trustedBinding = hasCompleteTrustedBinding(binding) ? binding : null;
  if (!trustedBinding) {
    pushUnique(blockers, GATE.GATE_ADOPTION_TRUST_BINDING_REQUIRED);
    pushUnique(errors, FAILURE.ADOPTION_ATTESTATION_INPUT_INVALID);
  }

  // ATTESTED path requires complete valid binding + evidence structure.
  if (
    typeof evidence.environment_class !== 'string' ||
    !(enums.environment_class || []).includes(evidence.environment_class)
  ) {
    pushUnique(blockers, GATE.GATE_ADOPTION_ENVIRONMENT_CLASS_INVALID);
    pushUnique(errors, FAILURE.ADOPTION_ATTESTATION_ENUM_INVALID);
  } else if (trustedBinding && evidence.environment_class !== trustedBinding.environment_class) {
    pushUnique(blockers, GATE.GATE_ADOPTION_ENVIRONMENT_CLASS_MISMATCH);
    pushUnique(errors, FAILURE.ADOPTION_ATTESTATION_ENUM_INVALID);
  }

  if (!matchPattern(evidence.baseline_commit, patterns.baseline_commit || '^[a-f0-9]{40}$')) {
    pushUnique(blockers, GATE.GATE_ADOPTION_BASELINE_COMMIT_INVALID);
    pushUnique(errors, FAILURE.ADOPTION_ATTESTATION_COMMIT_INVALID);
  } else if (trustedBinding && evidence.baseline_commit !== trustedBinding.baseline_commit) {
    pushUnique(blockers, GATE.GATE_ADOPTION_BASELINE_COMMIT_MISMATCH);
    pushUnique(errors, FAILURE.ADOPTION_ATTESTATION_COMMIT_MISMATCH);
  }

  function checkDigest(field, invalidGate, mismatchGate) {
    const value = evidence[field];
    if (!matchPattern(value, patterns.digest || '^sha256:[a-f0-9]{64}$')) {
      pushUnique(blockers, invalidGate);
      pushUnique(errors, FAILURE.ADOPTION_ATTESTATION_DIGEST_INVALID);
      return;
    }
    if (trustedBinding && value !== trustedBinding[field]) {
      pushUnique(blockers, mismatchGate);
      pushUnique(errors, FAILURE.ADOPTION_ATTESTATION_DIGEST_MISMATCH);
    }
  }

  checkDigest(
    'canonical_manifest_digest',
    GATE.GATE_ADOPTION_MANIFEST_DIGEST_INVALID,
    GATE.GATE_ADOPTION_MANIFEST_DIGEST_MISMATCH
  );
  checkDigest(
    'expected_schema_digest',
    GATE.GATE_ADOPTION_EXPECTED_SCHEMA_DIGEST_INVALID,
    GATE.GATE_ADOPTION_EXPECTED_SCHEMA_DIGEST_MISMATCH
  );
  checkDigest(
    'catalog_evidence_digest',
    GATE.GATE_ADOPTION_CATALOG_DIGEST_INVALID,
    GATE.GATE_ADOPTION_CATALOG_DIGEST_MISMATCH
  );

  const variance = evidence.variance_classification;
  if (
    typeof variance !== 'string' ||
    !(enums.variance_classification || []).includes(variance)
  ) {
    pushUnique(blockers, GATE.GATE_ADOPTION_VARIANCE_BLOCKING);
    pushUnique(errors, FAILURE.ADOPTION_ATTESTATION_ENUM_INVALID);
  } else if ((activeContract.blocking_variance || []).includes(variance)) {
    pushUnique(blockers, GATE.GATE_ADOPTION_VARIANCE_BLOCKING);
    pushUnique(errors, FAILURE.ADOPTION_ATTESTATION_VARIANCE_BLOCKING);
  } else if (variance === 'KNOWN_DRIFT') {
    const codes = evidence.known_variance_codes;
    const allowedCodes = new Set(enums.known_variance_codes || []);
    if (!Array.isArray(codes) || codes.length === 0) {
      pushUnique(blockers, GATE.GATE_ADOPTION_VARIANCE_BLOCKING);
      pushUnique(errors, FAILURE.ADOPTION_ATTESTATION_VARIANCE_BLOCKING);
    } else if (codes.length > (limits.max_known_variance_codes || 32)) {
      pushUnique(blockers, GATE.GATE_ADOPTION_VARIANCE_BLOCKING);
      pushUnique(errors, FAILURE.ADOPTION_ATTESTATION_BOUNDS_EXCEEDED);
    } else {
      for (const code of codes) {
        if (typeof code !== 'string' || !allowedCodes.has(code)) {
          pushUnique(blockers, GATE.GATE_ADOPTION_VARIANCE_BLOCKING);
          pushUnique(errors, FAILURE.ADOPTION_ATTESTATION_ENUM_INVALID);
          break;
        }
      }
    }
  } else if (variance !== 'MATCH') {
    pushUnique(blockers, GATE.GATE_ADOPTION_VARIANCE_BLOCKING);
    pushUnique(errors, FAILURE.ADOPTION_ATTESTATION_VARIANCE_BLOCKING);
  }

  const approval = evidence.approval_reference;
  const maxApproval = limits.max_approval_reference_length || 96;
  if (
    typeof approval !== 'string' ||
    !approval ||
    approval.length > maxApproval ||
    approval === 'approved' ||
    !matchPattern(approval, patterns.approval_reference || '^(?:issue:\\d+|decision:[A-Za-z0-9][A-Za-z0-9._-]{2,63})$')
  ) {
    pushUnique(blockers, GATE.GATE_ADOPTION_APPROVAL_REFERENCE_INVALID);
    pushUnique(errors, FAILURE.ADOPTION_ATTESTATION_APPROVAL_INVALID);
  } else if (hasSensitive(approval, markers)) {
    pushUnique(blockers, GATE.GATE_ADOPTION_SENSITIVE_MARKER_DETECTED);
    pushUnique(errors, FAILURE.ADOPTION_ATTESTATION_SENSITIVE_MARKER);
  } else if (trustedBinding && approval !== trustedBinding.approval_reference) {
    pushUnique(blockers, GATE.GATE_ADOPTION_APPROVAL_REFERENCE_MISMATCH);
    pushUnique(errors, FAILURE.ADOPTION_ATTESTATION_APPROVAL_INVALID);
  }

  if (
    typeof evidence.attestation_scope !== 'string' ||
    !(enums.attestation_scope || []).includes(evidence.attestation_scope)
  ) {
    pushUnique(blockers, GATE.GATE_ADOPTION_EVIDENCE_INVALID);
    pushUnique(errors, FAILURE.ADOPTION_ATTESTATION_ENUM_INVALID);
  } else if (trustedBinding && evidence.attestation_scope !== trustedBinding.attestation_scope) {
    pushUnique(blockers, GATE.GATE_ADOPTION_SCOPE_MISMATCH);
    pushUnique(errors, FAILURE.ADOPTION_ATTESTATION_ENUM_INVALID);
  }

  const requiredMigFields = activeContract.applied_migration_required_fields || ['id', 'checksum'];
  const allowedMigFields = new Set(
    activeContract.applied_migration_allowed_fields || ['id', 'checksum']
  );
  const migrationIdPattern = patterns.migration_id || '^\\d{14}_[a-z0-9]+(?:-[a-z0-9]+)*$';
  const digestPattern = patterns.digest || '^sha256:[a-f0-9]{64}$';
  const maxMigrations = limits.max_applied_migrations || 256;

  // Authoritative trusted migration list only. Never reconstruct from evidence.
  let trustedExpectedMigrations = null;
  if (trustedBinding) {
    const trustedListOk = validateTrustedExpectedMigrations(
      trustedBinding.expected_migrations,
      {
        allowedMigFields,
        prohibited,
        migrationIdPattern,
        digestPattern,
        markers,
        maxMigrations,
      },
      blockers,
      errors
    );
    if (trustedListOk) {
      trustedExpectedMigrations = trustedBinding.expected_migrations;
    }
  }

  if (!Array.isArray(evidence.applied_migrations)) {
    pushUnique(blockers, GATE.GATE_ADOPTION_MIGRATION_INVALID);
    pushUnique(errors, FAILURE.ADOPTION_ATTESTATION_MIGRATION_INVALID);
  } else {
    if (evidence.applied_migrations.length > maxMigrations) {
      pushUnique(blockers, GATE.GATE_ADOPTION_MIGRATION_INVALID);
      pushUnique(errors, FAILURE.ADOPTION_ATTESTATION_BOUNDS_EXCEEDED);
    }

    const seenIds = new Set();
    const expectedList = trustedExpectedMigrations;
    const expectedIds = expectedList
      ? new Set(expectedList.map((item) => item && item.id).filter(Boolean))
      : null;

    evidence.applied_migrations.forEach((record, index) => {
      if (!record || typeof record !== 'object' || Array.isArray(record)) {
        pushUnique(blockers, GATE.GATE_ADOPTION_MIGRATION_INVALID);
        pushUnique(errors, FAILURE.ADOPTION_ATTESTATION_MIGRATION_INVALID);
        return;
      }
      if (!Object.prototype.hasOwnProperty.call(evidence.applied_migrations, index)) {
        pushUnique(blockers, GATE.GATE_ADOPTION_MIGRATION_INVALID);
        pushUnique(errors, FAILURE.ADOPTION_ATTESTATION_MIGRATION_INVALID);
        return;
      }
      for (const key of Object.keys(record)) {
        if (prohibited.has(key)) {
          pushUnique(blockers, GATE.GATE_ADOPTION_SENSITIVE_MARKER_DETECTED);
          pushUnique(errors, FAILURE.ADOPTION_ATTESTATION_PROHIBITED_FIELD);
        } else if (!allowedMigFields.has(key)) {
          pushUnique(blockers, GATE.GATE_ADOPTION_UNKNOWN_FIELD);
          pushUnique(errors, FAILURE.ADOPTION_ATTESTATION_UNKNOWN_FIELD);
        }
      }
      for (const field of requiredMigFields) {
        if (record[field] === undefined || record[field] === null || record[field] === '') {
          pushUnique(blockers, GATE.GATE_ADOPTION_MIGRATION_INVALID);
          pushUnique(errors, FAILURE.ADOPTION_ATTESTATION_MIGRATION_INVALID);
        }
      }
      if (typeof record.id === 'string') {
        if (!matchPattern(record.id, migrationIdPattern)) {
          pushUnique(blockers, GATE.GATE_ADOPTION_MIGRATION_INVALID);
          pushUnique(errors, FAILURE.ADOPTION_ATTESTATION_MIGRATION_INVALID);
        }
        if (seenIds.has(record.id)) {
          pushUnique(blockers, GATE.GATE_ADOPTION_MIGRATION_DUPLICATE);
          pushUnique(errors, FAILURE.ADOPTION_ATTESTATION_MIGRATION_INVALID);
        }
        seenIds.add(record.id);
      }
      if (typeof record.checksum === 'string' && !matchPattern(record.checksum, digestPattern)) {
        pushUnique(blockers, GATE.GATE_ADOPTION_MIGRATION_INVALID);
        pushUnique(errors, FAILURE.ADOPTION_ATTESTATION_MIGRATION_INVALID);
      }
      scanValueSensitive(record, markers, blockers, errors);

      // Always compare against trusted list when complete binding is present.
      // Never skip comparison when expectedList is available (including empty list).
      if (expectedList) {
        const expected = expectedList[index];
        if (!expected) {
          // Evidence entry beyond trusted list, or trusted empty with evidence present.
          pushUnique(blockers, GATE.GATE_ADOPTION_MIGRATION_UNKNOWN);
          pushUnique(errors, FAILURE.ADOPTION_ATTESTATION_MIGRATION_INVALID);
        } else if (record.id !== expected.id) {
          if (expectedIds && expectedIds.has(record.id)) {
            pushUnique(blockers, GATE.GATE_ADOPTION_MIGRATION_REORDERED);
          } else {
            pushUnique(blockers, GATE.GATE_ADOPTION_MIGRATION_UNKNOWN);
          }
          pushUnique(errors, FAILURE.ADOPTION_ATTESTATION_MIGRATION_INVALID);
        } else if (record.checksum !== expected.checksum) {
          pushUnique(blockers, GATE.GATE_ADOPTION_MIGRATION_CHECKSUM_MISMATCH);
          pushUnique(errors, FAILURE.ADOPTION_ATTESTATION_MIGRATION_INVALID);
        }
      }
    });

    if (expectedList) {
      for (let i = evidence.applied_migrations.length; i < expectedList.length; i += 1) {
        pushUnique(blockers, GATE.GATE_ADOPTION_MIGRATION_MISSING);
        pushUnique(errors, FAILURE.ADOPTION_ATTESTATION_MIGRATION_INVALID);
      }
    }
  }

  // Structural gaps still mean invalid evidence even when some fields matched.
  if (
    blockers.length > 0 &&
    !blockers.includes(GATE.GATE_ADOPTION_EVIDENCE_UNAVAILABLE) &&
    !blockers.includes(GATE.GATE_ADOPTION_EVIDENCE_INVALID)
  ) {
    // Keep specific blockers; umbrella optional.
  }

  // If ATTESTED but missing required fields captured earlier, ensure umbrella invalid when only missing markers exist.
  const requiredMissing = required.some(
    (key) => evidence[key] === undefined || evidence[key] === null
  );
  if (requiredMissing) {
    pushUnique(blockers, GATE.GATE_ADOPTION_EVIDENCE_INVALID);
  }

  const uniqueBlockers = uniqueSorted(blockers);
  const uniqueErrors = uniqueSorted(errors);
  return {
    ok: uniqueBlockers.length === 0,
    blockers: uniqueBlockers,
    errors: uniqueErrors,
  };
}

/**
 * Build a prepared UNATTESTED attestation draft for Production-readonly collection.
 *
 * Takes a single options argument — NOT destructuring.
 * Validates all keys via Reflect.ownKeys + Object.getOwnPropertyDescriptors
 * BEFORE reading any value. Rejects unknown keys including validatePlanFn.
 *
 * Accepts exactly four top-level keys:
 *   - preparedPlan
 *   - migrationManifest
 *   - expectedSchemaCandidate
 *   - catalogEvidence
 *
 * Prepared plan validated via MODULE-OWNED validatePreparedCollectionPlan —
 * caller CANNOT inject validatePlanFn.
 *
 * Accepts NO caller-controlled environment/scope/status parameters.
 *
 * Validation order:
 *   1. internally validate trusted prepared plan
 *   2. recursively validate migration manifest
 *   3. recursively validate expected-schema candidate
 *   4. recursively validate catalog evidence
 *   5. validate fixed statuses and structures
 *   6. compute digests
 *   7. build draft
 *   8. final recursive validation
 *
 * baseline_commit and approval_reference come from validated trustedPlan.
 * applied_migrations is always [] for the prepared UNATTESTED draft —
 * populated canonical catalog membership is never an applied-history claim.
 *
 * ADOPTION_REQUIRED manifests accept an empty or populated canonical catalog;
 * every populated catalog record is strictly fail-closed validated for
 * canonical shape (id, path, checksum, uniqueness, ascending order).
 * ACTIVE manifests keep strict minimal applied-record validation.
 * CATALOGUED != APPLIED and UNATTESTED != ACTIVE — no promotion happens here.
 *
 * No database, network, environment fallback, or file write.
 */
function buildPreparedUnattestedAttestationDraft(options) {
  // ── Validate options is non-null plain object ──
  if (!options || typeof options !== 'object' || Array.isArray(options)) {
    fail(FAILURE.ADOPTION_ATTESTATION_INPUT_INVALID, { field: 'options' });
  }
  if (Object.getPrototypeOf(options) !== Object.prototype) {
    fail(FAILURE.ADOPTION_ATTESTATION_VALUE_INVALID);
  }

  // ── Validate top-level keys (Reflect.ownKeys + descriptors, no value read yet) ──
  const ALLOWED_KEYS = new Set([
    'preparedPlan',
    'migrationManifest',
    'expectedSchemaCandidate',
    'catalogEvidence',
  ]);

  const ownKeys = Reflect.ownKeys(options);
  const descriptors = Object.getOwnPropertyDescriptors(options);

  for (const key of ownKeys) {
    // Reject symbol keys
    if (typeof key === 'symbol') fail(FAILURE.ADOPTION_ATTESTATION_VALUE_INVALID);
    // Reject non-string keys
    if (typeof key !== 'string' || !key) fail(FAILURE.ADOPTION_ATTESTATION_VALUE_INVALID);
    // Reject accessor descriptors (get or set) without invoking
    const desc = descriptors[key];
    if (desc && (typeof desc.get === 'function' || typeof desc.set === 'function')) {
      fail(FAILURE.ADOPTION_ATTESTATION_VALUE_INVALID);
    }
    // Reject non-enumerable fields
    if (desc && !desc.enumerable) fail(FAILURE.ADOPTION_ATTESTATION_VALUE_INVALID);
    // Reject unknown key (including validatePlanFn)
    if (!ALLOWED_KEYS.has(key)) {
      fail(FAILURE.ADOPTION_ATTESTATION_UNKNOWN_FIELD, { field: key });
    }
  }

  // ── All keys validated — now safely read values ──
  const preparedPlan = options.preparedPlan;
  const migrationManifest = options.migrationManifest;
  const expectedSchemaCandidate = options.expectedSchemaCandidate;
  const catalogEvidence = options.catalogEvidence;

  // ── Step 1: Validate prepared plan via MODULE-OWNED trusted validator ──
  const validated = validatePreparedCollectionPlan(preparedPlan);
  if (!validated || validated.ok !== true || !validated.plan) {
    fail(FAILURE.ADOPTION_ATTESTATION_INPUT_INVALID, { field: 'preparedPlan' });
  }
  const trustedPlan = validated.plan;

  // ── Step 2-4: Pre-digest recursive validation ──
  validateCollectionArtifact(migrationManifest);
  validateCollectionArtifact(expectedSchemaCandidate);
  validateCollectionArtifact(catalogEvidence);

  // ── Step 5: Validate fixed statuses and structures ──

  // Migration manifest rules
  if (migrationManifest && !Array.isArray(migrationManifest)) {
    if (typeof migrationManifest === 'object') {
      const migStatus = migrationManifest.status;
      const mig = migrationManifest.migrations;

      if (migStatus === 'ADOPTION_REQUIRED') {
        // ADOPTION_REQUIRED + populated canonical catalog is valid prepared input.
        // Every populated catalog record remains strictly fail-closed validated for
        // the current canonical format. Catalog membership is never treated as
        // applied history: the prepared draft's applied_migrations stays [].
        if (!Array.isArray(mig)) fail(FAILURE.ADOPTION_ATTESTATION_INPUT_INVALID, { field: 'migrations' });
        validateCanonicalCatalogRecords(mig);
      } else {
        // Non-ADOPTION_REQUIRED: migrations array must exist, strictly validate each record
        if (!Array.isArray(mig)) fail(FAILURE.ADOPTION_ATTESTATION_INPUT_INVALID, { field: 'migrations' });
        validateMigrationRecords(mig);
      }
    } else {
      fail(FAILURE.ADOPTION_ATTESTATION_INPUT_INVALID, { field: 'migrationManifest' });
    }
  } else {
    fail(FAILURE.ADOPTION_ATTESTATION_INPUT_INVALID, { field: 'migrationManifest' });
  }

  if (!expectedSchemaCandidate || typeof expectedSchemaCandidate !== 'object' || Array.isArray(expectedSchemaCandidate)) {
    fail(FAILURE.ADOPTION_ATTESTATION_INPUT_INVALID, { field: 'expectedSchemaCandidate' });
  }
  if (expectedSchemaCandidate.status !== 'ADOPTION_REQUIRED') {
    fail(FAILURE.ADOPTION_ATTESTATION_ENUM_INVALID, { field: 'status' });
  }

  if (!catalogEvidence || typeof catalogEvidence !== 'object' || Array.isArray(catalogEvidence)) {
    fail(FAILURE.ADOPTION_ATTESTATION_INPUT_INVALID, { field: 'catalogEvidence' });
  }

  // ── Step 6: Digest computation ──
  const canonicalDigest = computeObjectDigest(migrationManifest);
  const expectedDigest = computeObjectDigest(expectedSchemaCandidate);
  const catalogDigest = computeObjectDigest(catalogEvidence);

  // ── applied_migrations is always [] for the prepared UNATTESTED draft ──
  // Catalog membership is never evidence of historical execution. Only a
  // separately trusted historical applied authority could populate this list,
  // and no such caller-controlled provenance path is accepted here.
  const migrations = [];

  // ── Step 7: Build draft ──
  const draft = {
    format_version: '1.0',
    adoption_status: 'UNATTESTED',
    environment_class: 'PRODUCTION',
    baseline_commit: trustedPlan.baseline_commit,
    canonical_manifest_digest: canonicalDigest,
    expected_schema_digest: expectedDigest,
    catalog_evidence_digest: catalogDigest,
    variance_classification: 'UNKNOWN_DRIFT',
    approval_reference: trustedPlan.approval_reference,
    applied_migrations: migrations,
    contract_path: DEFAULT_CONTRACT_REL,
    digest_algorithm: 'sha256',
    attestation_scope: 'PRODUCTION_READONLY',
  };

  // ── Step 8: Final recursive prohibited/sensitive check ──
  recursiveProhibitedCheck(draft, 0);
  scanDraftSensitive(draft, 0);

  return draft;
}

/**
 * Recursive prohibited field check for entire draft tree.
 */
function recursiveProhibitedCheck(obj, depth) {
  if (depth > 20) fail(FAILURE.ADOPTION_ATTESTATION_BOUNDS_EXCEEDED);
  if (obj === null || obj === undefined) return;
  if (Array.isArray(obj)) {
    if (obj.length > 2048) fail(FAILURE.ADOPTION_ATTESTATION_BOUNDS_EXCEEDED);
    for (const item of obj) recursiveProhibitedCheck(item, depth + 1);
    return;
  }
  if (typeof obj === 'object') {
    const keys = Object.keys(obj);
    if (keys.length > 1024) fail(FAILURE.ADOPTION_ATTESTATION_BOUNDS_EXCEEDED);
    for (const key of keys) {
      if (PROHIBITED_FIELDS.has(key)) {
        fail(FAILURE.ADOPTION_ATTESTATION_PROHIBITED_FIELD, { field: key });
      }
      recursiveProhibitedCheck(obj[key], depth + 1);
    }
  }
}

/**
 * Recursive sensitive value scan for entire draft tree.
 */
function scanDraftSensitive(value, depth) {
  if (depth > 20) fail(FAILURE.ADOPTION_ATTESTATION_BOUNDS_EXCEEDED);
  if (value === null || value === undefined) return;
  const t = typeof value;
  if (t === 'string') {
    if (value.length > 65536) fail(FAILURE.ADOPTION_ATTESTATION_BOUNDS_EXCEEDED);
    if (hasSensitive(value, FALLBACK_SENSITIVE_MARKERS)) fail(FAILURE.ADOPTION_ATTESTATION_SENSITIVE_MARKER);
    return;
  }
  if (t === 'number') {
    if (!Number.isFinite(value)) fail(FAILURE.ADOPTION_ATTESTATION_VALUE_INVALID);
    return;
  }
  if (t === 'boolean') return;
  if (Array.isArray(value)) {
    for (const item of value) scanDraftSensitive(item, depth + 1);
    return;
  }
  if (t === 'object') {
    const keys = Object.keys(value);
    for (const key of keys) {
      if (hasSensitive(key, FALLBACK_SENSITIVE_MARKERS)) {
        fail(FAILURE.ADOPTION_ATTESTATION_SENSITIVE_MARKER);
      }
    }
    if (Object.getPrototypeOf(value) !== Object.prototype) {
      fail(FAILURE.ADOPTION_ATTESTATION_VALUE_INVALID);
    }
    for (const key of keys) scanDraftSensitive(value[key], depth + 1);
    return;
  }
  fail(FAILURE.ADOPTION_ATTESTATION_VALUE_INVALID);
}

/**
 * Validate populated canonical catalog records of an ADOPTION_REQUIRED manifest.
 * Fail-closed strict validation against the current committed canonical format
 * (db/migration-provenance/canonical-migrations.json canonical_path_rule,
 * ordering_rule, migration_id_rule, identity/order/checksum contract).
 *
 * Catalog membership is NEVER treated as applied or executed history: no record
 * here is copied into prepared.applied_migrations.
 */
const CANONICAL_MIGRATION_ID_PATTERN = /^\d{14}_[a-z0-9]+(?:-[a-z0-9]+)*$/;
const CANONICAL_MIGRATIONS_DIRECTORY = 'db/migrations';
const CANONICAL_RISK_CLASSES = new Set(['ADDITIVE', 'COMPATIBILITY', 'DESTRUCTIVE', 'ADOPTION']);
const CANONICAL_TRANSACTION_MODES = new Set(['REQUIRED', 'PROHIBITED', 'EXPLICIT']);
const CATALOG_PRECONDITION_CHECKS = new Set(['table_exists']);
const CATALOG_CONDITION_TARGET_PATTERN = /^[A-Za-z_][A-Za-z0-9_.]*$/;

function validateCatalogConditionList(condList, condField) {
  if (!Array.isArray(condList)) {
    fail(FAILURE.ADOPTION_ATTESTATION_INPUT_INVALID, { field: condField });
  }
  if (condList.length > 256) fail(FAILURE.ADOPTION_ATTESTATION_BOUNDS_EXCEEDED, { field: condField });
  for (const cond of condList) {
    if (!cond || typeof cond !== 'object' || Array.isArray(cond)) {
      fail(FAILURE.ADOPTION_ATTESTATION_INPUT_INVALID, { field: condField });
    }
    const condKeys = Object.keys(cond);
    if (condKeys.length !== 3 || !condKeys.includes('check') || !condKeys.includes('target') || !condKeys.includes('expected')) {
      fail(FAILURE.ADOPTION_ATTESTATION_UNKNOWN_FIELD, { field: condField });
    }
    if (typeof cond.check !== 'string' || !CATALOG_PRECONDITION_CHECKS.has(cond.check)) {
      fail(FAILURE.ADOPTION_ATTESTATION_ENUM_INVALID, { field: condField });
    }
    if (typeof cond.target !== 'string' || !CATALOG_CONDITION_TARGET_PATTERN.test(cond.target)) {
      fail(FAILURE.ADOPTION_ATTESTATION_INPUT_INVALID, { field: condField });
    }
    if (typeof cond.expected !== 'boolean') {
      fail(FAILURE.ADOPTION_ATTESTATION_INPUT_INVALID, { field: condField });
    }
  }
}

function validateCanonicalCatalogRecords(migrations) {
  if (!Array.isArray(migrations)) fail(FAILURE.ADOPTION_ATTESTATION_INPUT_INVALID, { field: 'migrations' });
  if (migrations.length > 256) fail(FAILURE.ADOPTION_ATTESTATION_BOUNDS_EXCEEDED, { field: 'migrations' });

  const seenIds = new Set();
  let previousId = null;

  for (const item of migrations) {
    if (!item || typeof item !== 'object' || Array.isArray(item)) {
      fail(FAILURE.ADOPTION_ATTESTATION_MIGRATION_INVALID, { field: 'migrations' });
    }
    if (Object.getPrototypeOf(item) !== Object.prototype) {
      fail(FAILURE.ADOPTION_ATTESTATION_VALUE_INVALID, { field: 'migrations' });
    }
    // Reject accessor properties without invoking.
    const descriptors = Object.getOwnPropertyDescriptors(item);
    for (const key of Object.keys(descriptors)) {
      const desc = descriptors[key];
      if (desc && (typeof desc.get === 'function' || typeof desc.set === 'function')) {
        fail(FAILURE.ADOPTION_ATTESTATION_MIGRATION_INVALID, { field: 'accessor' });
      }
      if (typeof key !== 'string' || !key) {
        fail(FAILURE.ADOPTION_ATTESTATION_MIGRATION_INVALID, { field: 'migrations' });
      }
      if (PROHIBITED_FIELDS.has(key)) {
        fail(FAILURE.ADOPTION_ATTESTATION_PROHIBITED_FIELD, { field: key });
      }
      if (hasSensitive(key, FALLBACK_SENSITIVE_MARKERS)) {
        fail(FAILURE.ADOPTION_ATTESTATION_SENSITIVE_MARKER, { field: 'migrations' });
      }
    }
    // Every committed canonical field must be present (current catalog format).
    for (const field of REQUIRED_MIGRATION_FIELDS) {
      if (!(field in item) || item[field] === undefined || item[field] === null) {
        fail(FAILURE.ADOPTION_ATTESTATION_INPUT_INVALID, { field: `missing:${field}` });
      }
    }
    // No unknown fields: record shape is repository-anchored, caller-controlled
    // record extensions carry no authority and fail closed.
    for (const key of Object.keys(item)) {
      if (!REQUIRED_MIGRATION_FIELDS.includes(key)) {
        fail(FAILURE.ADOPTION_ATTESTATION_UNKNOWN_FIELD, { field: key });
      }
    }

    // id: canonical format, uniqueness, strict ascending order (timestamp ordering).
    if (typeof item.id !== 'string' || !CANONICAL_MIGRATION_ID_PATTERN.test(item.id)) {
      fail(FAILURE.ADOPTION_ATTESTATION_MIGRATION_INVALID, { field: 'id' });
    }
    if (seenIds.has(item.id)) {
      fail(FAILURE.ADOPTION_ATTESTATION_MIGRATION_INVALID, { field: 'duplicate_id' });
    }
    seenIds.add(item.id);
    if (previousId !== null && item.id <= previousId) {
      fail(FAILURE.ADOPTION_ATTESTATION_MIGRATION_INVALID, { field: 'ordering' });
    }
    previousId = item.id;

    // name / owner_domain: non-empty strings.
    if (typeof item.name !== 'string' || item.name.length === 0) {
      fail(FAILURE.ADOPTION_ATTESTATION_INPUT_INVALID, { field: 'name' });
    }
    if (typeof item.owner_domain !== 'string' || item.owner_domain.length === 0) {
      fail(FAILURE.ADOPTION_ATTESTATION_INPUT_INVALID, { field: 'owner_domain' });
    }

    // path: exactly db/migrations/<migration_id>.sql — direct child, no nesting,
    // traversal, absolute path, duplicate slash, or other extension.
    if (typeof item.path !== 'string' || item.path !== `${CANONICAL_MIGRATIONS_DIRECTORY}/${item.id}.sql`) {
      fail(FAILURE.ADOPTION_ATTESTATION_PATH_INVALID, { field: 'path' });
    }

    // checksum: sha256 digest format.
    if (typeof item.checksum !== 'string' || !SHA256_PATTERN.test(item.checksum)) {
      fail(FAILURE.ADOPTION_ATTESTATION_DIGEST_INVALID, { field: 'checksum' });
    }

    // depends_on: dense non-empty string array, no self-reference/duplicates.
    if (!Array.isArray(item.depends_on)) {
      fail(FAILURE.ADOPTION_ATTESTATION_INPUT_INVALID, { field: 'depends_on' });
    }
    const seenDeps = new Set();
    for (const dependency of item.depends_on) {
      if (typeof dependency !== 'string' || dependency.length === 0) {
        fail(FAILURE.ADOPTION_ATTESTATION_INPUT_INVALID, { field: 'depends_on' });
      }
      if (dependency === item.id || seenDeps.has(dependency)) {
        fail(FAILURE.ADOPTION_ATTESTATION_INPUT_INVALID, { field: 'depends_on' });
      }
      seenDeps.add(dependency);
    }

    // risk_class / transaction_mode from the committed vocabulary.
    if (!CANONICAL_RISK_CLASSES.has(item.risk_class)) {
      fail(FAILURE.ADOPTION_ATTESTATION_ENUM_INVALID, { field: 'risk_class' });
    }
    if (!CANONICAL_TRANSACTION_MODES.has(item.transaction_mode)) {
      fail(FAILURE.ADOPTION_ATTESTATION_ENUM_INVALID, { field: 'transaction_mode' });
    }

    // destructive_operations: committed vocabulary only, unique declarations.
    if (!Array.isArray(item.destructive_operations)) {
      fail(FAILURE.ADOPTION_ATTESTATION_INPUT_INVALID, { field: 'destructive_operations' });
    }
    const declared = new Set();
    for (const operation of item.destructive_operations) {
      if (!DESTRUCTIVE_OPERATION_VOCABULARY.includes(operation) || declared.has(operation)) {
        fail(FAILURE.ADOPTION_ATTESTATION_ENUM_INVALID, { field: 'destructive_operations' });
      }
      declared.add(operation);
    }

    // Preconditions/postconditions: fixed condition-record shape.
    validateCatalogConditionList(item.expected_preconditions, 'expected_preconditions');
    validateCatalogConditionList(item.expected_postconditions, 'expected_postconditions');

    // rollback_support: non-empty string (corrections are forward-fix migrations).
    if (typeof item.rollback_support !== 'string' || item.rollback_support.length === 0) {
      fail(FAILURE.ADOPTION_ATTESTATION_INPUT_INVALID, { field: 'rollback_support' });
    }

    // approval_reference: structured reference, placeholder-proof (committed grammar).
    if (!isValidApprovalReference(item.approval_reference)) {
      fail(FAILURE.ADOPTION_ATTESTATION_APPROVAL_INVALID, { field: 'approval_reference' });
    }

    // Sensitive markers inside id/name/checksum fail closed.
    if (hasSensitive(item.id, FALLBACK_SENSITIVE_MARKERS) || hasSensitive(item.checksum, FALLBACK_SENSITIVE_MARKERS)) {
      fail(FAILURE.ADOPTION_ATTESTATION_SENSITIVE_MARKER, { field: 'migrations' });
    }
  }

  // Cross-record dependency resolution: every dependency must exist in the
  // catalog and appear strictly before its dependent (current ordering rule).
  const idIndex = new Map();
  migrations.forEach((item, index) => {
    if (item && typeof item.id === 'string') idIndex.set(item.id, index);
  });
  migrations.forEach((item) => {
    if (!item || !Array.isArray(item.depends_on)) return;
    const ownIndex = typeof item.id === 'string' ? idIndex.get(item.id) : undefined;
    for (const dependency of item.depends_on) {
      if (typeof dependency !== 'string' || !idIndex.has(dependency)) {
        fail(FAILURE.ADOPTION_ATTESTATION_INPUT_INVALID, { field: 'depends_on_unknown' });
      }
      if (ownIndex !== undefined && idIndex.get(dependency) >= ownIndex) {
        fail(FAILURE.ADOPTION_ATTESTATION_INPUT_INVALID, { field: 'depends_on_ordering' });
      }
    }
  });
}


/**
 * Validate migration manifest record (ACTIVE-manifest minimal applied shape).
 * Checks each record: allowed keys, required fields, patterns, duplicate detection.
 */
function validateMigrationRecords(migrations) {
  if (!Array.isArray(migrations)) fail(FAILURE.ADOPTION_ATTESTATION_INPUT_INVALID, { field: 'migrations' });
  if (migrations.length > 256) fail(FAILURE.ADOPTION_ATTESTATION_BOUNDS_EXCEEDED, { field: 'migrations' });

  const MIGRATION_ID_PATTERN = /^\d{14}_[a-z0-9]+(?:-[a-z0-9]+)*$/;
  const SHA256_DIGEST = /^sha256:[a-f0-9]{64}$/;
  const ALLOWED_MIG_FIELDS = new Set(['id', 'checksum']);
  const MIGRATION_PROHIBITED = new Set([
    'host', 'hostname', 'port', 'database', 'database_name',
    'database_url', 'connection_string', 'url', 'secret', 'token',
    'password', 'credential', 'operator',
  ]);
  const seenIds = new Set();

  for (const item of migrations) {
    if (!item || typeof item !== 'object' || Array.isArray(item)) {
      fail(FAILURE.ADOPTION_ATTESTATION_MIGRATION_INVALID, { field: 'applied_migrations' });
    }
    // Check accessor properties (reject without invoking)
    const descriptors = Object.getOwnPropertyDescriptors(item);
    for (const key of Object.keys(descriptors)) {
      if (descriptors[key].get || descriptors[key].set) {
        fail(FAILURE.ADOPTION_ATTESTATION_MIGRATION_INVALID, { field: 'accessor' });
      }
    }
    // No unknown fields
    for (const key of Object.keys(item)) {
      if (!ALLOWED_MIG_FIELDS.has(key)) {
        fail(FAILURE.ADOPTION_ATTESTATION_UNKNOWN_FIELD, { field: key });
      }
      if (MIGRATION_PROHIBITED.has(key)) {
        fail(FAILURE.ADOPTION_ATTESTATION_PROHIBITED_FIELD, { field: key });
      }
    }
    // id required
    if (typeof item.id !== 'string' || !item.id) {
      fail(FAILURE.ADOPTION_ATTESTATION_MIGRATION_INVALID, { field: 'id' });
    }
    if (!MIGRATION_ID_PATTERN.test(item.id)) {
      fail(FAILURE.ADOPTION_ATTESTATION_MIGRATION_INVALID, { field: 'id' });
    }
    if (seenIds.has(item.id)) {
      fail(FAILURE.ADOPTION_ATTESTATION_MIGRATION_INVALID, { field: 'duplicate_id' });
    }
    seenIds.add(item.id);
    // checksum required
    if (typeof item.checksum !== 'string' || !SHA256_DIGEST.test(item.checksum)) {
      fail(FAILURE.ADOPTION_ATTESTATION_DIGEST_INVALID, { field: 'checksum' });
    }
    // Sensitive check — reuse FALLBACK_SENSITIVE_MARKERS
    if (hasSensitive(item.id, FALLBACK_SENSITIVE_MARKERS) || hasSensitive(item.checksum, FALLBACK_SENSITIVE_MARKERS)) {
      fail(FAILURE.ADOPTION_ATTESTATION_SENSITIVE_MARKER, { field: 'applied_migrations' });
    }
  }
}

/**
 * Pre-digest recursive validation for collection artifacts.
 * Checks: type, bounds, prototype, prohibited keys, sensitive markers.
 */
function validateCollectionArtifact(value, depth) {
  if (depth === undefined) depth = 0;
  if (depth > 20) fail(FAILURE.ADOPTION_ATTESTATION_BOUNDS_EXCEEDED);
  if (value === null || value === undefined) {
    if (value === undefined) fail(FAILURE.ADOPTION_ATTESTATION_VALUE_INVALID);
    return;
  }
  const t = typeof value;
  if (t === 'boolean' || t === 'number' || t === 'string') {
    if (t === 'number' && !Number.isFinite(value)) fail(FAILURE.ADOPTION_ATTESTATION_VALUE_INVALID);
    if (t === 'string') {
      if (value.length > 65536) fail(FAILURE.ADOPTION_ATTESTATION_BOUNDS_EXCEEDED);
      if (hasSensitive(value, FALLBACK_SENSITIVE_MARKERS)) fail(FAILURE.ADOPTION_ATTESTATION_SENSITIVE_MARKER);
    }
    return;
  }
  if (t === 'symbol' || t === 'function' || t === 'bigint' || t === 'undefined') {
    fail(FAILURE.ADOPTION_ATTESTATION_VALUE_INVALID);
  }
  if (Array.isArray(value)) {
    if (value.length > 2048) fail(FAILURE.ADOPTION_ATTESTATION_BOUNDS_EXCEEDED);
    for (const item of value) validateCollectionArtifact(item, depth + 1);
    return;
  }
  if (t === 'object') {
    const proto = Object.getPrototypeOf(value);
    if (proto !== Object.prototype && proto !== null) {
      fail(FAILURE.ADOPTION_ATTESTATION_VALUE_INVALID);
    }
    const ownKeys = Reflect.ownKeys(value);
    if (ownKeys.length > 1024) fail(FAILURE.ADOPTION_ATTESTATION_BOUNDS_EXCEEDED);
    // Reject symbol keys and accessor descriptors
    const descriptors = Object.getOwnPropertyDescriptors(value);
    for (const key of ownKeys) {
      if (typeof key === 'symbol') fail(FAILURE.ADOPTION_ATTESTATION_VALUE_INVALID);
      if (typeof key !== 'string' || !key) fail(FAILURE.ADOPTION_ATTESTATION_VALUE_INVALID);
      const desc = descriptors[key];
      if (desc && (typeof desc.get === 'function' || typeof desc.set === 'function')) {
        fail(FAILURE.ADOPTION_ATTESTATION_VALUE_INVALID);
      }
    }
    // Check prohibited/sensitive on keys
    const PROHIBITED = new Set([
      'host', 'hostname', 'port', 'database', 'database_name',
      'database_url', 'connection_string', 'url', 'secret', 'token',
      'password', 'credential', 'operator', 'operator_name',
      'raw_role', 'role_name', 'provider_project', 'raw_catalog',
    ]);
    for (const key of ownKeys) {
      if (typeof key === 'string') {
        if (PROHIBITED.has(key)) fail(FAILURE.ADOPTION_ATTESTATION_PROHIBITED_FIELD, { field: key });
        if (hasSensitive(key, FALLBACK_SENSITIVE_MARKERS)) fail(FAILURE.ADOPTION_ATTESTATION_SENSITIVE_MARKER);
      }
    }
    // Recurse into enumerable data properties only
    for (const key of ownKeys) {
      if (typeof key === 'string') {
        const desc = descriptors[key];
        if (desc && desc.enumerable && !desc.get && !desc.set) {
          validateCollectionArtifact(value[key], depth + 1);
        }
      }
    }
    return;
  }
  fail(FAILURE.ADOPTION_ATTESTATION_VALUE_INVALID);
}

/**
 * Build a synthetic ATTESTED attestation bound to provided artifacts.
 * Pure helper for tests; does not write files or activate manifests.
 */
function buildSyntheticAttestation({
  baselineCommit,
  migrationManifest,
  expectedSchemaManifest,
  catalogEvidence,
  environmentClass = 'DISPOSABLE_CI',
  varianceClassification = 'MATCH',
  approvalReference = 'issue:9999',
  appliedMigrations,
  knownVarianceCodes,
  attestationScope = 'INACTIVE_BASELINE',
}) {
  const canonicalDigest = computeObjectDigest(migrationManifest);
  const expectedDigest = computeObjectDigest(expectedSchemaManifest);
  const catalogDigest = computeObjectDigest(catalogEvidence);
  const migrations = Array.isArray(appliedMigrations)
    ? appliedMigrations
    : Array.isArray(migrationManifest && migrationManifest.migrations)
      ? migrationManifest.migrations.map((item) => ({
          id: item.id,
          checksum: item.checksum,
        }))
      : [];

  const attestation = {
    format_version: '1.0',
    adoption_status: 'ATTESTED',
    environment_class: environmentClass,
    baseline_commit: baselineCommit,
    canonical_manifest_digest: canonicalDigest,
    expected_schema_digest: expectedDigest,
    catalog_evidence_digest: catalogDigest,
    variance_classification: varianceClassification,
    approval_reference: approvalReference,
    applied_migrations: migrations,
    contract_path: DEFAULT_CONTRACT_REL,
    digest_algorithm: 'sha256',
    attestation_scope: attestationScope,
  };
  if (varianceClassification === 'KNOWN_DRIFT' && Array.isArray(knownVarianceCodes)) {
    attestation.known_variance_codes = knownVarianceCodes.slice();
  }
  return attestation;
}

module.exports = {
  FAILURE,
  GATE,
  DEFAULT_CONTRACT_REL,
  REQUIRED_TRUSTED_BINDING_FIELDS,
  compareCodePoint,
  uniqueSorted,
  stableStringify,
  computeEvidenceDigest,
  computeObjectDigest,
  defaultContractPath,
  loadJson,
  loadAdoptionAttestationContract,
  validateAdoptionAttestationContract,
  hasCompleteTrustedBinding,
  isPathOutside,
  assertRepoRelativePath,
  resolveRepoConfinedPath,
  readConfinedEvidenceFile,
  validateAdoptionAttestationEvidence,
  buildPreparedUnattestedAttestationDraft,
  buildSyntheticAttestation,
};
