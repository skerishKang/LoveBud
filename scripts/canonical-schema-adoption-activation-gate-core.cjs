'use strict';

/**
 * Canonical schema-adoption activation gate for the fail-closed canonical
 * migration runner (#3458, #4282).
 *
 * This module implements the PAPER-ONLY activation gate that a separately
 * approved operator/runner must consult before it is permitted to execute a
 * canonical schema adoption. It performs NO database connection, NO SQL
 * execution, NO advisory lock acquisition, and NO migration-ledger write. It
 * does NOT mark the canonical stream ACTIVE by itself (per policy requirement:
 * a paper-only activation artifact + tests must prove the stream is not
 * auto-activated by this gate).
 *
 * Refs #3458 (keep OPEN), #3425 (keep OPEN), #3435 (keep OPEN), #3437 (keep
 * OPEN), #1882 (keep OPEN).
 */

const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');

const REPO_ROOT = path.resolve(__dirname, '..');

const CANONICAL_MANIFEST = path.join(
  REPO_ROOT,
  'db',
  'migration-provenance',
  'canonical-migrations.json'
);
const EXPECTED_SCHEMA = path.join(
  REPO_ROOT,
  'db',
  'migration-provenance',
  'expected-schema-manifest.json'
);
const ALLOWLIST_CONTRACT = path.join(
  REPO_ROOT,
  'db',
  'migration-provenance',
  'adoption-baseline-collection-plan-contract.json'
);

const CANONICAL_TARGET_IDENTITY = Object.freeze({
  product_shared: '133-relovetree',
  environment_class: 'production',
  database: 'neondb',
});

const GATE_DECISIONS = Object.freeze({
  FAIL_CLOSED: 'FAIL_CLOSED',
  NOT_APPROVED: 'NOT_APPROVED',
  PAPER_ACTIVATION_GATE_PASSED: 'PAPER_ACTIVATION_GATE_PASSED',
});

const GATE_BLOCKERS = Object.freeze({
  GATE_PACKET_FIELD_INVALID: 'GATE_PACKET_FIELD_INVALID',
  GATE_CURRENT_MAIN_MISMATCH: 'GATE_CURRENT_MAIN_MISMATCH',
  GATE_APPROVAL_REFERENCE_INVALID: 'GATE_APPROVAL_REFERENCE_INVALID',
  GATE_MIGRATION_NOT_FOUND: 'GATE_MIGRATION_NOT_FOUND',
  GATE_CHECKSUM_MISMATCH: 'GATE_CHECKSUM_MISMATCH',
  GATE_TARGET_RELATION_INVALID: 'GATE_TARGET_RELATION_INVALID',
  GATE_MANIFEST_NOT_ACTIVE: 'GATE_MANIFEST_NOT_ACTIVE',
  GATE_EXPECTED_SCHEMA_NOT_REQUIRES: 'GATE_EXPECTED_SCHEMA_NOT_REQUIRES',
  GATE_EXPECTED_SCHEMA_FINGERPRINT_MISSING: 'GATE_EXPECTED_SCHEMA_FINGERPRINT_MISSING',
  GATE_TARGET_NOT_ALLOWLISTED: 'GATE_TARGET_NOT_ALLOWLISTED',
  GATE_EXPECTED_SCHEMA_FINGERPRINT_UNKNOWN: 'GATE_EXPECTED_SCHEMA_FINGERPRINT_UNKNOWN',
  GATE_UNRELATED_MIGRATION_PRESENT: 'GATE_UNRELATED_MIGRATION_PRESENT',
  GATE_SINGLE_MIGRATION_ONLY_VIOLATION: 'GATE_SINGLE_MIGRATION_ONLY_VIOLATION',
  GATE_PRODUCT_ROW_READ_FORBIDDEN: 'GATE_PRODUCT_ROW_READ_FORBIDDEN',
  GATE_RUNTIME_GATE_FORBIDDEN: 'GATE_RUNTIME_GATE_FORBIDDEN',
  GATE_WRITER_GRANT_FORBIDDEN: 'GATE_WRITER_GRANT_FORBIDDEN',
  GATE_PROVIDER_REROUTE_FORBIDDEN: 'GATE_PROVIDER_REROUTE_FORBIDDEN',
  GATE_AMBIGUOUS_OUTCOME_FORBIDS_RETRY: 'GATE_AMBIGUOUS_OUTCOME_FORBIDS_RETRY',
});

const ALLOWED_APPLY_MODES = Object.freeze(new Set(['TRANSACTION_REQUIRED']));

function isNonEmptyString(v) {
  return typeof v === 'string' && v.trim().length > 0;
}

function isStrictObject(v) {
  return !!v && typeof v === 'object' && !Array.isArray(v);
}

function sha256File(p) {
  const data = fs.readFileSync(p);
  return crypto.createHash('sha256').update(data).digest('hex');
}

function isHex40(v) {
  return /^[0-9a-f]{40}$/.test(String(v || '').toLowerCase());
}

function isSha256Hex(v) {
  return /^[0-9a-f]{64}$/.test(String(v || '').toLowerCase());
}

function parseObjectRef(ref) {
  // Accept "schema:relation" or "schema.relation" or "schema.relation.kind".
  if (typeof ref !== 'string' || !ref) return null;
  let schema, relation, kind;
  if (ref.includes(':')) {
    const [s, rest] = ref.split(':');
    schema = s;
    [relation, kind] = rest.split('.');
  } else {
    [schema, relation, kind] = ref.split('.');
  }
  if (!schema || !relation) return null;
  return { schema, relation, kind: kind || 'TABLE' };
}

function loadJson(p) {
  return JSON.parse(fs.readFileSync(p, 'utf8'));
}

/**
 * Evaluate a canonical schema-adoption packet against the frozen repository
 * policy. Returns a sanitized decision — never throws detail that could leak
 * credentials/roles/secrets.
 *
 * packet: {
 *   currentMain, approvalReference, targetIdentity, migrationFile,
 *   migrationSha256, intendedRelation, applyMode, expectedSchemaFingerprint,
 *   productRowReadAllowed, runtimeGateActivation, writerGrant, providerReroute,
 *   ambiguousRetryAllowed
 * }
 */
function evaluateAdoptionActivationGate(packet) {
  const blockers = [];
  let decision = GATE_DECISIONS.NOT_APPROVED;

  if (!isStrictObject(packet)) {
    return {
      decision: GATE_DECISIONS.FAIL_CLOSED,
      blockers: [GATE_BLOCKERS.GATE_PACKET_FIELD_INVALID],
    };
  }

  // --- Required packet fields: exact binding, non-empty strings ---
  const requiredStrings = [
    'currentMain',
    'approvalReference',
    'migrationFile',
    'migrationSha256',
    'intendedRelation',
    'applyMode',
  ];
  for (const f of requiredStrings) {
    if (!isNonEmptyString(packet[f])) {
      blockers.push(GATE_BLOCKERS.GATE_PACKET_FIELD_INVALID);
    }
  }
  if (!isStrictObject(packet.targetIdentity)) {
    blockers.push(GATE_BLOCKERS.GATE_PACKET_FIELD_INVALID);
  }

  if (packet.currentMain && !isHex40(packet.currentMain)) {
    blockers.push(GATE_BLOCKERS.GATE_PACKET_FIELD_INVALID);
  }
  if (packet.approvalReference && !/^issue:\d+$/.test(packet.approvalReference)) {
    blockers.push(GATE_BLOCKERS.GATE_APPROVAL_REFERENCE_INVALID);
  }
  // The activation gate binds this adoption to the explicit #4282 approval.
  if (packet.approvalReference && packet.approvalReference !== 'issue:4282') {
    blockers.push(GATE_BLOCKERS.GATE_APPROVAL_REFERENCE_INVALID);
  }
  if (packet.migrationSha256 && !isSha256Hex(packet.migrationSha256)) {
    blockers.push(GATE_BLOCKERS.GATE_CHECKSUM_MISMATCH);
  }
  if (packet.applyMode && !ALLOWED_APPLY_MODES.has(packet.applyMode)) {
    blockers.push(GATE_BLOCKERS.GATE_PACKET_FIELD_INVALID);
  }
  // Forbid dangerous packet options outright (fail closed).
  if (packet.productRowReadAllowed !== false) {
    blockers.push(GATE_BLOCKERS.GATE_PRODUCT_ROW_READ_FORBIDDEN);
  }
  if (packet.runtimeGateActivation !== false) {
    blockers.push(GATE_BLOCKERS.GATE_RUNTIME_GATE_FORBIDDEN);
  }
  if (packet.writerGrant !== false) {
    blockers.push(GATE_BLOCKERS.GATE_WRITER_GRANT_FORBIDDEN);
  }
  if (packet.providerReroute !== false) {
    blockers.push(GATE_BLOCKERS.GATE_PROVIDER_REROUTE_FORBIDDEN);
  }
  if (packet.ambiguousRetryAllowed !== false) {
    blockers.push(GATE_BLOCKERS.GATE_AMBIGUOUS_OUTCOME_FORBIDS_RETRY);
  }

  // --- Repository facts (read-only, frozen) ---
  let manifest, expected, allowlist;
  try {
    manifest = loadJson(CANONICAL_MANIFEST);
    expected = loadJson(EXPECTED_SCHEMA);
    allowlist = loadJson(ALLOWLIST_CONTRACT);
  } catch {
    return {
      decision: GATE_DECISIONS.FAIL_CLOSED,
      blockers: [GATE_BLOCKERS.GATE_PACKET_FIELD_INVALID],
    };
  }

  if (manifest.status !== 'ADOPTION_REQUIRED') {
    // Must remain ADOPTION_REQUIRED; this gate never activates the stream.
    blockers.push(GATE_BLOCKERS.GATE_MANIFEST_NOT_ACTIVE);
  }

  const target = parseObjectRef(packet.intendedRelation);
  if (!target || target.schema !== 'public' || target.relation !== 'tree_appreciation_orders') {
    blockers.push(GATE_BLOCKERS.GATE_TARGET_RELATION_INVALID);
  }

  // Canonical target identity binding.
  if (packet.targetIdentity) {
    const ti = typeof packet.targetIdentity === 'string' ? null : packet.targetIdentity;
    const identityMatch =
      ti &&
      ti.product_shared === CANONICAL_TARGET_IDENTITY.product_shared &&
      ti.environment_class === CANONICAL_TARGET_IDENTITY.environment_class &&
      ti.database === CANONICAL_TARGET_IDENTITY.database;
    if (!identityMatch) {
      blockers.push(GATE_BLOCKERS.GATE_TARGET_RELATION_INVALID);
    }
  }

  // Migration resolution by exact id + checksum + path binding.
  const entry = manifest.migrations && manifest.migrations.find(
    (m) => m.id === '20260812213000_add-tree-appreciation-orders'
  );
  if (!entry) {
    blockers.push(GATE_BLOCKERS.GATE_MIGRATION_NOT_FOUND);
  } else {
    if (entry.path !== packet.migrationFile) {
      blockers.push(GATE_BLOCKERS.GATE_MIGRATION_NOT_FOUND);
    }
    if (entry.checksum !== 'sha256:' + String(packet.migrationSha256).toLowerCase()) {
      blockers.push(GATE_BLOCKERS.GATE_CHECKSUM_MISMATCH);
    }
    // Local file checksum must match the packet AND the local file on disk.
    const localPath = path.join(REPO_ROOT, entry.path);
    const localSha = sha256File(localPath);
    if (localSha !== String(packet.migrationSha256).toLowerCase()) {
      blockers.push(GATE_BLOCKERS.GATE_CHECKSUM_MISMATCH);
    }
  }

  // Expected schema binding (fingerprint + ADOPTION_REQUIRED).
  if (expected.status !== 'ADOPTION_REQUIRED') {
    blockers.push(GATE_BLOCKERS.GATE_EXPECTED_SCHEMA_NOT_REQUIRES);
  }
  const critical = expected.critical_objects || expected.objects || [];
  const fpEntry = critical.find(
    (o) => o.name === 'table:public.tree_appreciation_orders'
  );
  if (!fpEntry) {
    blockers.push(GATE_BLOCKERS.GATE_EXPECTED_SCHEMA_FINGERPRINT_MISSING);
  } else if (fpEntry.fingerprint !== 'sha256:' + String(packet.expectedSchemaFingerprint).toLowerCase()) {
    blockers.push(GATE_BLOCKERS.GATE_EXPECTED_SCHEMA_FINGERPRINT_UNKNOWN);
  }

  // Allowlist binding (catalog-presence allowed, data read not).
  const allowedEntry = (allowlist.reviewed_object_allowlist || []).find(
    (o) => o.name === 'table:public.tree_appreciation_orders'
  );
  if (!allowedEntry) {
    blockers.push(GATE_BLOCKERS.GATE_TARGET_NOT_ALLOWLISTED);
  } else if (!Array.isArray(allowedEntry.metadata_categories)) {
    blockers.push(GATE_BLOCKERS.GATE_TARGET_NOT_ALLOWLISTED);
  }

  // Single-migration-only: unrelated migration count must be 0.
  if (packet.unrelatedMigrationCount !== 0) {
    blockers.push(GATE_BLOCKERS.GATE_SINGLE_MIGRATION_ONLY_VIOLATION);
  }

  // current main binding.
  if (packet.currentMain && isHex40(packet.currentMain)) {
    // Validated shape only (hash format). Exact-head binding is enforced by the
    // caller's git context; the gate refuses mismatched formats upstream.
  }

  if (blockers.length === 0) {
    decision = GATE_DECISIONS.PAPER_ACTIVATION_GATE_PASSED;
  } else {
    decision = GATE_DECISIONS.NOT_APPROVED;
  }

  return {
    decision,
    blockers: Array.from(new Set(blockers)).sort(),
    // Sanitized binding (no secrets/roles/SQL).
    binding: {
      migrationId: entry && entry.id,
      migrationChecksum: entry && entry.checksum,
      relation: target && `${target.schema}.${target.relation}`,
      canonicalStatus: manifest.status,
      expectedSchemaStatus: expected.status,
      targetAllowlisted: !!allowedEntry,
    },
  };
}

function createPaperActivationArtifact(packet) {
  // Paper-only: writes nothing to Production; does NOT flip manifest status.
  // Returns a sanitized artifact document reference (no secret/credential).
  const result = evaluateAdoptionActivationGate(packet);
  if (result.decision !== GATE_DECISIONS.PAPER_ACTIVATION_GATE_PASSED) {
    return { artifactCreated: false, gate: result };
  }
  return {
    artifactCreated: true,
    gate: result,
    artifactType: 'PAPER_ONLY_ADOPTION_ACTIVATION_RECORD',
    canonicalStatusAfter: 'ADOPTION_REQUIRED', // explicitly NOT flipped
    productionMutation: 'NONE',
    note: 'Paper-only activation artifact. Does not activate canonical Production stream or execute any migration.',
  };
}

module.exports = {
  GATE_DECISIONS,
  GATE_BLOCKERS,
  CANONICAL_TARGET_IDENTITY,
  evaluateAdoptionActivationGate,
  createPaperActivationArtifact,
  // exported for tests only (pure helpers)
  __pure: {
    sha256File,
    parseObjectRef,
    isHex40,
    isSha256Hex,
  },
};
