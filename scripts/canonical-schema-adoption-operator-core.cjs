'use strict';

/**
 * Canonical schema-adoption governed operator for #4282.
 *
 * PAPER-ONLY / DRY-RUN BY DEFAULT.
 *
 * This module provides the operator-side counterpart to the canonical
 * schema-adoption activation gate (scripts/canonical-schema-adoption-activation-gate-core.cjs).
 * The activation gate is paper-only; this operator wraps a real apply path but
 * keeps execution disabled by default. Production execution is only possible when
 * an out-of-band credentialed operator passes:
 *   - the exact #4282 ACTIVE authorization packet
 *   - a legitimate production transport
 *   - explicit executionEnabled=true at the call site
 *
 * Hard properties:
 *   - fail-closed on every precheck mismatch
 *   - advisory lock around the apply transaction
 *   - transaction-required apply (rollback on pre-commit failure)
 *   - no automatic destructive DROP after committed success
 *   - post-apply catalog verification (read-only)
 *   - ledger/attestation path provided via injected transport
 *   - never reads Product row bodies
 *   - never grants writer / runtime gate / provider reroute
 *   - never consumes the one-attempt budget unless the bound apply actually commits
 *
 * Refs #4282, #3458 (keep OPEN), #1882 (keep OPEN).
 */

const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');

const GATE_CORE = require('./canonical-schema-adoption-activation-gate-core.cjs');

const ROOT = path.resolve(__dirname, '..');

const MANIFEST = JSON.parse(
  fs.readFileSync(path.join(ROOT, 'db/migration-provenance/canonical-migrations.json'), 'utf8'),
);
const EXPECTED_SCHEMA = JSON.parse(
  fs.readFileSync(path.join(ROOT, 'db/migration-provenance/expected-schema-manifest.json'), 'utf8'),
);

const CANONICAL_TARGET_IDENTITY = Object.freeze({
  product_shared: '133-relovetree',
  environment_class: 'production',
  database: 'neondb',
});

const BOUND_MIGRATION = Object.freeze({
  id: '20260812213000_add-tree-appreciation-orders',
  path: 'db/migrations/20260812213000_add-tree-appreciation-orders.sql',
  sha256: '5332ce91ee1440d3c1bebd0a3b0b5ff9cab0a23612195141bebb94d340ebaad8',
});

const BOUND_RELATION = 'public.tree_appreciation_orders';
const BOUND_EXPECTED_FINGERPRINT = 'e7bae9da3a80a035066525ae3f2d780bf4aa97c1ef400d151604e0e1998b8bb1';
const BOUND_ACTIVE_AUTHORIZATION_COMMENT = 5491726186;
const BOUND_ISSUE = 4282;

const DECISIONS = Object.freeze({
  PAPER_ONLY_DRY_RUN: 'PAPER_ONLY_DRY_RUN',
  EXECUTION_DISABLED_BY_DEFAULT: 'EXECUTION_DISABLED_BY_DEFAULT',
  READINESS_PASSED: 'READINESS_PASSED',
  APPLY_COMMITTED_AND_VERIFIED: 'APPLY_COMMITTED_AND_VERIFIED',
  APPLY_ROLLED_BACK_PRE_COMMIT: 'APPLY_ROLLED_BACK_PRE_COMMIT',
});

const STOP_REASONS = Object.freeze({
  STOP_PACKET_FIELD_INVALID: 'STOP_PACKET_FIELD_INVALID',
  STOP_MAIN_MOVED: 'STOP_MAIN_MOVED',
  STOP_RELATION_PRESENT: 'STOP_RELATION_PRESENT',
  STOP_CHECKSUM_MISMATCH: 'STOP_CHECKSUM_MISMATCH',
  STOP_TARGET_IDENTITY_MISMATCH: 'STOP_TARGET_IDENTITY_MISMATCH',
  STOP_ACTIVE_COMMENT_MISSING: 'STOP_ACTIVE_COMMENT_MISSING',
  STOP_UNRELATED_MIGRATION_PRESENT: 'STOP_UNRELATED_MIGRATION_PRESENT',
  STOP_CREDENTIAL_OPERATOR_ABSENT: 'STOP_CREDENTIAL_OPERATOR_ABSENT',
  STOP_ADVISORY_LOCK_UNAVAILABLE: 'STOP_ADVISORY_LOCK_UNAVAILABLE',
  STOP_TRANSACTION_UNAVAILABLE: 'STOP_TRANSACTION_UNAVAILABLE',
  STOP_POSTCHECK_MISMATCH: 'STOP_POSTCHECK_MISMATCH',
  STOP_LEDGER_ATTESTATION_MISMATCH: 'STOP_LEDGER_ATTESTATION_MISMATCH',
  STOP_AMBIGUOUS_OUTCOME: 'STOP_AMBIGUOUS_OUTCOME',
  STOP_PRODUCT_ROW_READ_FORBIDDEN: 'STOP_PRODUCT_ROW_READ_FORBIDDEN',
  STOP_WRITER_GRANT_FORBIDDEN: 'STOP_WRITER_GRANT_FORBIDDEN',
  STOP_RUNTIME_GATE_FORBIDDEN: 'STOP_RUNTIME_GATE_FORBIDDEN',
  STOP_PROVIDER_REROUTE_FORBIDDEN: 'STOP_PROVIDER_REROUTE_FORBIDDEN',
  STOP_ARBITRARY_SQL_FORBIDDEN: 'STOP_ARBITRARY_SQL_FORBIDDEN',
  STOP_AUTO_DROP_FORBIDDEN: 'STOP_AUTO_DROP_FORBIDDEN',
  STOP_AMBIGUOUS_RETRY_FORBIDDEN: 'STOP_AMBIGUOUS_RETRY_FORBIDDEN',
  STOP_SECRET_OUTPUT_FORBIDDEN: 'STOP_SECRET_OUTPUT_FORBIDDEN',
});

function isNonEmptyString(v) {
  return typeof v === 'string' && v.trim().length > 0;
}
function isStrictObject(v) {
  return !!v && typeof v === 'object' && !Array.isArray(v);
}
function isHex40(v) {
  return /^[0-9a-f]{40}$/.test(String(v || '').toLowerCase());
}
function isSha256Hex(v) {
  return /^[0-9a-f]{64}$/.test(String(v || '').toLowerCase());
}
function sha256File(p) {
  return crypto.createHash('sha256').update(fs.readFileSync(p)).digest('hex');
}

const FORBIDDEN_PACKET_KEYS = Object.freeze([
  'productRowReadAllowed',
  'writerGrant',
  'runtimeGateActivation',
  'providerReroute',
  'ambiguousRetryAllowed',
]);

/**
 * Pure readiness check. Validates the bound packet against frozen repo facts
 * and the activation gate. Never touches a transport.
 */
function evaluateOperatorReadiness(packet) {
  const stops = [];

  if (!isStrictObject(packet)) {
    return { decision: DECISIONS.EXECUTION_DISABLED_BY_DEFAULT, stops: [STOP_REASONS.STOP_PACKET_FIELD_INVALID] };
  }

  // --- Mandatory exact bindings ---
  if (packet.issue !== BOUND_ISSUE) stops.push(STOP_REASONS.STOP_PACKET_FIELD_INVALID);
  if (packet.activeAuthorizationComment !== BOUND_ACTIVE_AUTHORIZATION_COMMENT) {
    stops.push(STOP_REASONS.STOP_ACTIVE_COMMENT_MISSING);
  }
  if (!isHex40(packet.currentMain || '')) stops.push(STOP_REASONS.STOP_MAIN_MOVED);
  if (packet.migrationPath !== BOUND_MIGRATION.path) stops.push(STOP_REASONS.STOP_PACKET_FIELD_INVALID);
  if (!isSha256Hex(packet.migrationSha256 || '')) stops.push(STOP_REASONS.STOP_CHECKSUM_MISMATCH);
  if (packet.intendedRelation !== BOUND_RELATION) stops.push(STOP_REASONS.STOP_PACKET_FIELD_INVALID);
  if (packet.expectedSchemaFingerprint !== BOUND_EXPECTED_FINGERPRINT) {
    stops.push(STOP_REASONS.STOP_PACKET_FIELD_INVALID);
  }
  if (!isStrictObject(packet.targetIdentity)) {
    stops.push(STOP_REASONS.STOP_TARGET_IDENTITY_MISMATCH);
  } else {
    const t = packet.targetIdentity;
    if (
      t.product_shared !== CANONICAL_TARGET_IDENTITY.product_shared ||
      t.environment_class !== CANONICAL_TARGET_IDENTITY.environment_class ||
      t.database !== CANONICAL_TARGET_IDENTITY.database
    ) {
      stops.push(STOP_REASONS.STOP_TARGET_IDENTITY_MISMATCH);
    }
  }
  if (packet.unrelatedMigrationCount !== 0) {
    stops.push(STOP_REASONS.STOP_UNRELATED_MIGRATION_PRESENT);
  }
  if (packet.applyMode !== 'TRANSACTION_REQUIRED') {
    stops.push(STOP_REASONS.STOP_TRANSACTION_UNAVAILABLE);
  }

  // --- Forbidden options must be explicitly false ---
  for (const k of FORBIDDEN_PACKET_KEYS) {
    if (packet[k] !== false) {
      if (k === 'productRowReadAllowed') stops.push(STOP_REASONS.STOP_PRODUCT_ROW_READ_FORBIDDEN);
      if (k === 'writerGrant') stops.push(STOP_REASONS.STOP_WRITER_GRANT_FORBIDDEN);
      if (k === 'runtimeGateActivation') stops.push(STOP_REASONS.STOP_RUNTIME_GATE_FORBIDDEN);
      if (k === 'providerReroute') stops.push(STOP_REASONS.STOP_PROVIDER_REROUTE_FORBIDDEN);
      if (k === 'ambiguousRetryAllowed') stops.push(STOP_REASONS.STOP_AMBIGUOUS_RETRY_FORBIDDEN);
    }
  }

  // --- Local file checksum rehash ---
  const localPath = path.join(ROOT, BOUND_MIGRATION.path);
  let localSha = null;
  try {
    localSha = sha256File(localPath);
  } catch {
    stops.push(STOP_REASONS.STOP_CHECKSUM_MISMATCH);
  }
  if (localSha && localSha !== String(packet.migrationSha256 || '').toLowerCase()) {
    stops.push(STOP_REASONS.STOP_CHECKSUM_MISMATCH);
  }

  // --- Cross-check against the canonical activation gate (paper-only) ---
  const gateRes = GATE_CORE.evaluateAdoptionActivationGate({
    currentMain: packet.currentMain,
    approvalReference: `issue:${BOUND_ISSUE}`,
    targetIdentity: packet.targetIdentity,
    migrationFile: packet.migrationPath,
    migrationSha256: packet.migrationSha256,
    intendedRelation: packet.intendedRelation,
    applyMode: packet.applyMode,
    expectedSchemaFingerprint: packet.expectedSchemaFingerprint,
    productRowReadAllowed: packet.productRowReadAllowed,
    runtimeGateActivation: packet.runtimeGateActivation,
    writerGrant: packet.writerGrant,
    providerReroute: packet.providerReroute,
    ambiguousRetryAllowed: packet.ambiguousRetryAllowed,
    unrelatedMigrationCount: packet.unrelatedMigrationCount,
  });
  if (gateRes.decision !== GATE_CORE.GATE_DECISIONS.PAPER_ACTIVATION_GATE_PASSED) {
    stops.push(STOP_REASONS.STOP_PACKET_FIELD_INVALID);
  }

  const unique = Array.from(new Set(stops)).sort();
  return {
    decision: unique.length === 0 ? DECISIONS.READINESS_PASSED : DECISIONS.EXECUTION_DISABLED_BY_DEFAULT,
    stops: unique,
    gateDecision: gateRes.decision,
    gateBlockers: gateRes.blockers,
    manifestStatus: MANIFEST.status,
    expectedSchemaStatus: EXPECTED_SCHEMA.status,
  };
}

/**
 * Build the frozen canonical packet bound to #4282.
 * Source of truth is this repo; the packet must match ACTIVE comment 5491726186.
 */
function buildCanonicalPacket(overrides) {
  const base = {
    issue: BOUND_ISSUE,
    activeAuthorizationComment: BOUND_ACTIVE_AUTHORIZATION_COMMENT,
    currentMain: '4126045a8a348119e28689d52d7740c46d872765',
    migrationPath: BOUND_MIGRATION.path,
    migrationSha256: BOUND_MIGRATION.sha256,
    intendedRelation: BOUND_RELATION,
    targetIdentity: {
      product_shared: CANONICAL_TARGET_IDENTITY.product_shared,
      environment_class: CANONICAL_TARGET_IDENTITY.environment_class,
      database: CANONICAL_TARGET_IDENTITY.database,
    },
    expectedSchemaFingerprint: BOUND_EXPECTED_FINGERPRINT,
    applyMode: 'TRANSACTION_REQUIRED',
    productRowReadAllowed: false,
    writerGrant: false,
    runtimeGateActivation: false,
    providerReroute: false,
    ambiguousRetryAllowed: false,
    unrelatedMigrationCount: 0,
  };
  return Object.freeze({ ...base, ...(overrides || {}) });
}

const FORBIDDEN_TRANSPORT_METHODS = Object.freeze([
  'queryProductRows',
  'grantWriter',
  'activateRuntimeGate',
  'rerouteProvider',
  'dropRelation',
  'executeArbitrarySql',
  'retryAmbiguous',
  'exposeRawCredential',
]);

/**
 * Validate a transport interface. Production transport must provide only the
 * safe, bounded surface below. Any forbidden method fails closed.
 */
function validateTransport(transport) {
  if (!isStrictObject(transport)) {
    return { ok: false, reason: STOP_REASONS.STOP_CREDENTIAL_OPERATOR_ABSENT };
  }
  for (const k of FORBIDDEN_TRANSPORT_METHODS) {
    if (k in transport) {
      return { ok: false, reason: STOP_REASONS.STOP_ARBITRARY_SQL_FORBIDDEN };
    }
  }
  const required = ['acquireAdvisoryLock', 'withTransaction', 'applyMigration', 'verifyCatalog', 'writeLedger'];
  for (const k of required) {
    if (typeof transport[k] !== 'function') {
      return { ok: false, reason: STOP_REASONS.STOP_CREDENTIAL_OPERATOR_ABSENT };
    }
  }
  return { ok: true, reason: null };
}

/**
 * Execute the governed operator. By default this is a paper-only dry run that
 * stops at READINESS_PASSED. Real apply requires `executionEnabled === true`
 * AND a validated transport. The transport is the only surface that can ever
 * touch the database; this function never calls it unless every check above
 * has passed.
 */
async function executeGovernedOperator(opts) {
  const options = isStrictObject(opts) ? opts : {};
  const packet = options.packet;
  const transport = options.transport;
  const executionEnabled = options.executionEnabled === true;
  const allowExecute = options.allowExecute === true;

  const readiness = evaluateOperatorReadiness(packet);
  if (readiness.decision !== DECISIONS.READINESS_PASSED) {
    return {
      decision: DECISIONS.EXECUTION_DISABLED_BY_DEFAULT,
      stops: readiness.stops,
      reason: 'READINESS_FAILED',
      executionAttempted: false,
      oneAttemptBudgetConsumed: false,
    };
  }

  if (!executionEnabled || !allowExecute) {
    return {
      decision: DECISIONS.PAPER_ONLY_DRY_RUN,
      stops: [],
      reason: executionEnabled ? 'EXECUTION_NOT_ALLOWED' : 'EXECUTION_DISABLED_BY_DEFAULT',
      executionAttempted: false,
      oneAttemptBudgetConsumed: false,
      binding: {
        relation: packet.intendedRelation,
        migrationId: BOUND_MIGRATION.id,
        targetIdentity: packet.targetIdentity,
      },
    };
  }

  // Operator mode: real apply via the bounded transport.
  const tCheck = validateTransport(transport);
  if (!tCheck.ok) {
    return {
      decision: DECISIONS.EXECUTION_DISABLED_BY_DEFAULT,
      stops: [tCheck.reason],
      reason: tCheck.reason,
      executionAttempted: false,
      oneAttemptBudgetConsumed: false,
    };
  }

  // --- Advisory lock ---
  const lockKey = crypto
    .createHash('sha256')
    .update(`#${BOUND_ISSUE}|${packet.migrationPath}|${packet.migrationSha256}`)
    .digest('hex')
    .slice(0, 16);
  const lockHandle = await transport.acquireAdvisoryLock(lockKey);
  if (!lockHandle) {
    return {
      decision: DECISIONS.EXECUTION_DISABLED_BY_DEFAULT,
      stops: [STOP_REASONS.STOP_ADVISORY_LOCK_UNAVAILABLE],
      reason: 'ADVISORY_LOCK_UNAVAILABLE',
      executionAttempted: false,
      oneAttemptBudgetConsumed: false,
    };
  }

  try {
    // --- Transaction-required apply ---
    const txResult = await transport.withTransaction(async (tx) => {
      // Read-only relation-absent precheck inside the same connection.
      const pre = await tx.catalogTableKind(packet.intendedRelation);
      if (pre && pre.present === true) {
        return { ok: false, reason: STOP_REASONS.STOP_RELATION_PRESENT };
      }
      // Apply the exact migration body (transport loads it by checksum-verified path).
      const applyOutcome = await transport.applyMigration(tx, {
        path: packet.migrationPath,
        sha256: packet.migrationSha256,
      });
      if (!applyOutcome || applyOutcome.committed !== true) {
        return { ok: false, reason: applyOutcome && applyOutcome.reason || STOP_REASONS.STOP_AMBIGUOUS_OUTCOME };
      }
      // Post-apply catalog verification (read-only, no row bodies).
      const post = await tx.verifyCatalog(packet.intendedRelation, packet.expectedSchemaFingerprint);
      if (!post || post.matched !== true) {
        return { ok: false, reason: STOP_REASONS.STOP_POSTCHECK_MISMATCH };
      }
      // Ledger insert inside the same transaction.
      const ledger = await tx.writeLedger({
        issue: BOUND_ISSUE,
        activeAuthorizationComment: BOUND_ACTIVE_AUTHORIZATION_COMMENT,
        migrationId: BOUND_MIGRATION.id,
        migrationSha256: packet.migrationSha256,
        targetIdentity: packet.targetIdentity,
        relation: packet.intendedRelation,
        fingerprint: packet.expectedSchemaFingerprint,
      });
      if (!ledger || ledger.recorded !== true) {
        return { ok: false, reason: STOP_REASONS.STOP_LEDGER_ATTESTATION_MISMATCH };
      }
      return { ok: true };
    });

    if (!txResult.ok) {
      return {
        decision: DECISIONS.APPLY_ROLLED_BACK_PRE_COMMIT,
        stops: [txResult.reason],
        reason: txResult.reason,
        executionAttempted: true,
        oneAttemptBudgetConsumed: false, // never consumed on pre-commit failure
      };
    }

    return {
      decision: DECISIONS.APPLY_COMMITTED_AND_VERIFIED,
      stops: [],
      reason: 'APPLY_COMMITTED_AND_VERIFIED',
      executionAttempted: true,
      oneAttemptBudgetConsumed: true, // one-attempt budget is consumed ONLY on committed+verified apply
    };
  } catch (err) {
    // Any thrown error is treated as ambiguous outcome: read-only reconcile
    // required, NO retry, owner decision needed.
    return {
      decision: DECISIONS.EXECUTION_DISABLED_BY_DEFAULT,
      stops: [STOP_REASONS.STOP_AMBIGUOUS_OUTCOME],
      reason: 'AMBIGUOUS_OUTCOME',
      ambiguous: true,
      executionAttempted: true,
      oneAttemptBudgetConsumed: false,
    };
  } finally {
    try { await transport.releaseAdvisoryLock(lockHandle); } catch { /* swallow — disconnect is best-effort */ }
  }
}

module.exports = {
  DECISIONS,
  STOP_REASONS,
  CANONICAL_TARGET_IDENTITY,
  BOUND_MIGRATION,
  BOUND_RELATION,
  BOUND_EXPECTED_FINGERPRINT,
  BOUND_ACTIVE_AUTHORIZATION_COMMENT,
  BOUND_ISSUE,
  buildCanonicalPacket,
  evaluateOperatorReadiness,
  validateTransport,
  executeGovernedOperator,
  // exported for tests only (pure helpers)
  __pure: { sha256File, isHex40, isSha256Hex },
};
