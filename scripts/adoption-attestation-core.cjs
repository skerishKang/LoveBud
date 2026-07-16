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
 */
function hasCompleteTrustedBinding(binding) {
  if (!binding || typeof binding !== 'object' || Array.isArray(binding)) return false;
  for (const field of REQUIRED_TRUSTED_BINDING_FIELDS) {
    const value = binding[field];
    if (value === undefined || value === null || value === '') return false;
  }
  return true;
}

/**
 * Validate adoption attestation evidence against contract + mandatory trusted binding.
 * For ATTESTED evidence, binding must include every REQUIRED_TRUSTED_BINDING_FIELDS value
 * from the protected invocation boundary. Evidence never supplies its own trust source.
 *
 * binding may also include:
 *   expected_migrations: [{id, checksum}]  (repository-owned expected migration list)
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

  if (!Array.isArray(evidence.applied_migrations)) {
    pushUnique(blockers, GATE.GATE_ADOPTION_MIGRATION_INVALID);
    pushUnique(errors, FAILURE.ADOPTION_ATTESTATION_MIGRATION_INVALID);
  } else {
    const maxMigrations = limits.max_applied_migrations || 256;
    if (evidence.applied_migrations.length > maxMigrations) {
      pushUnique(blockers, GATE.GATE_ADOPTION_MIGRATION_INVALID);
      pushUnique(errors, FAILURE.ADOPTION_ATTESTATION_BOUNDS_EXCEEDED);
    }

    const requiredMigFields = activeContract.applied_migration_required_fields || ['id', 'checksum'];
    const allowedMigFields = new Set(
      activeContract.applied_migration_allowed_fields || ['id', 'checksum']
    );
    const seenIds = new Set();
    const migrationIdPattern = patterns.migration_id || '^\\d{14}_[a-z0-9]+(?:-[a-z0-9]+)*$';
    const digestPattern = patterns.digest || '^sha256:[a-f0-9]{64}$';

    evidence.applied_migrations.forEach((record, index) => {
      if (!record || typeof record !== 'object' || Array.isArray(record)) {
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

      const expectedList =
        trustedBinding && Array.isArray(trustedBinding.expected_migrations)
          ? trustedBinding.expected_migrations
          : binding && Array.isArray(binding.expected_migrations)
            ? binding.expected_migrations
            : null;
      if (expectedList) {
        const expected = expectedList[index];
        if (!expected) {
          pushUnique(blockers, GATE.GATE_ADOPTION_MIGRATION_UNKNOWN);
          pushUnique(errors, FAILURE.ADOPTION_ATTESTATION_MIGRATION_INVALID);
        } else {
          if (record.id !== expected.id) {
            // Wrong id at position: unknown or reordered.
            const expectedIds = new Set(expectedList.map((item) => item.id));
            if (!expectedIds.has(record.id)) {
              pushUnique(blockers, GATE.GATE_ADOPTION_MIGRATION_UNKNOWN);
            } else {
              pushUnique(blockers, GATE.GATE_ADOPTION_MIGRATION_REORDERED);
            }
            pushUnique(errors, FAILURE.ADOPTION_ATTESTATION_MIGRATION_INVALID);
          } else if (record.checksum !== expected.checksum) {
            pushUnique(blockers, GATE.GATE_ADOPTION_MIGRATION_CHECKSUM_MISMATCH);
            pushUnique(errors, FAILURE.ADOPTION_ATTESTATION_MIGRATION_INVALID);
          }
        }
      }
    });

    const expectedForMissing =
      trustedBinding && Array.isArray(trustedBinding.expected_migrations)
        ? trustedBinding.expected_migrations
        : binding && Array.isArray(binding.expected_migrations)
          ? binding.expected_migrations
          : null;
    if (Array.isArray(expectedForMissing)) {
      for (let i = evidence.applied_migrations.length; i < expectedForMissing.length; i += 1) {
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
  buildSyntheticAttestation,
};
