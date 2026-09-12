'use strict';

/**
 * Governed operator for the #3846 canonical Production ledger bootstrap.
 *
 * USAGE:
 *   node scripts/canonical-ledger-bootstrap-operator.cjs --dry-run
 *     # paper-only readiness check; never touches a transport connection
 *
 *   # Production execution (out-of-band credentialed operator only):
 *   LOVEBUD_LEDGER_BOOTSTRAP_ALLOW_EXECUTE=1 \
 *   LOVEBUD_LEDGER_BOOTSTRAP_EXECUTION_AUTHORITY=<central-comment> \
 *     node scripts/canonical-ledger-bootstrap-operator.cjs \
 *       --execute --execution-authority <central-comment> --execution-head <40hex>
 *     # the ONLY transport that can ever be loaded is the fixed repository-owned
 *     # module scripts/canonical-ledger-bootstrap-postgres.cjs, consumed through
 *     # a bounded seven-method view. Any arbitrary module path input is rejected.
 *
 * Authority separation:
 *   - The frozen packet carries IMMUTABLE BOOTSTRAP PROVENANCE only: issue:3846,
 *     the migration identity/path/checksum, the expected schema fingerprint, the
 *     ADDITIVE risk class, and TRANSACTION_REQUIRED mode.
 *   - The LIVE CENTRAL Production execution authority is supplied separately at
 *     execution time (--execution-authority /
 *     LOVEBUD_LEDGER_BOOTSTRAP_EXECUTION_AUTHORITY). It is never defaulted from,
 *     and never derived from, the frozen provenance.
 *   - The SOURCE/TEST implementation comment 5644253160 authorized building this
 *     vehicle only. It is provenance metadata and can NEVER satisfy the live
 *     Production execution authority.
 *
 * Hard rules:
 *   - execution disabled by default; dry run is the default mode
 *   - both --execute and LOVEBUD_LEDGER_BOOTSTRAP_ALLOW_EXECUTE=1 are required
 *   - the live execution authority gate AND the exact-head gate must both pass
 *     BEFORE any transport method call
 *   - the transport is fixed by repository path, never by caller input
 *   - connected-target identity is proven AFTER the one connection opens and
 *     BEFORE the advisory lock, BEGIN, migration SQL, or ledger write. A wrong
 *     Neon endpoint fails preconnect (unconsumed); a wrong connected database,
 *     a role class other than OWNER_CLASS, a failed probe, or a malformed
 *     identity result is a post-connect stop: consumed, no retry, and zero
 *     lock/BEGIN/apply/ledger calls.
 *   - the CENTRAL exactly-one DB-capable authority is consumed when governed
 *     DB-capable execution begins (connection / advisory-lock / transaction
 *     path), NOT when COMMIT succeeds. Every outcome after that point stays
 *     consumed and retryPermitted is false: rollback, target-already-present,
 *     catalog mismatch, ledger mismatch, connection failure after connect,
 *     transaction failure, and commit ambiguity are NOT reusable.
 *   - preconnect failures (readiness, transport validation, missing/invalid
 *     execution authority, head mismatch, missing/malformed credential, and a
 *     DSN bound to the wrong Neon endpoint) leave the authority unconsumed
 *   - any error / connection loss is treated as ambiguous outcome: stop, no retry
 *   - this script never logs or prints secret/credential material
 *   - SOURCE/TEST ONLY: running this file in CI performs NO Production contact
 *
 * Refs #3846, #3458 (keep OPEN), #1882 (keep OPEN).
 */

const crypto = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');

const TRANSPORT = require('./canonical-ledger-bootstrap-postgres.cjs');

const ROOT = path.resolve(__dirname, '..');

const BOOTSTRAP = TRANSPORT.BOOTSTRAP;
const CANONICAL_TARGET_IDENTITY = TRANSPORT.CANONICAL_TARGET_IDENTITY;

const ALLOWED_FLAGS = Object.freeze([
  '--execute',
  '--dry-run',
  '--execution-head',
  '--execution-authority',
]);
const ENV_ALLOW_EXECUTE = 'LOVEBUD_LEDGER_BOOTSTRAP_ALLOW_EXECUTE';
const ENV_EXECUTION_HEAD = 'LOVEBUD_LEDGER_BOOTSTRAP_EXECUTION_HEAD';
const ENV_EXECUTION_AUTHORITY = 'LOVEBUD_LEDGER_BOOTSTRAP_EXECUTION_AUTHORITY';
const FIXED_TRANSPORT_PATH = path.join(__dirname, 'canonical-ledger-bootstrap-postgres.cjs');

// Failure categories the repository transport raises provably BEFORE any
// DB-capable contact: credential resolution, DSN endpoint-identity binding, and
// lock-key shape validation. Only these leave the CENTRAL authority unconsumed.
// Every other failure out of the connected-identity or advisory-lock calls is
// treated as DB-capable execution having begun.
const PRECONNECT_FAILURE_CATEGORIES = new Set([
  TRANSPORT.TRANSPORT_FAILURE.SECRET_UNAVAILABLE,
  TRANSPORT.TRANSPORT_FAILURE.SECRET_MALFORMED,
  TRANSPORT.TRANSPORT_FAILURE.LOCK_KEY_INVALID,
  TRANSPORT.TRANSPORT_FAILURE.ENDPOINT_IDENTITY_MISMATCH,
  TRANSPORT.TRANSPORT_FAILURE.ROLE_MAPPING_UNAVAILABLE,
]);

const DECISIONS = Object.freeze({
  PAPER_ONLY_DRY_RUN: 'PAPER_ONLY_DRY_RUN',
  EXECUTION_DISABLED_BY_DEFAULT: 'EXECUTION_DISABLED_BY_DEFAULT',
  READINESS_PASSED: 'READINESS_PASSED',
  APPLY_COMMITTED_AND_VERIFIED: 'APPLY_COMMITTED_AND_VERIFIED',
  APPLY_ROLLED_BACK_PRE_COMMIT: 'APPLY_ROLLED_BACK_PRE_COMMIT',
});

const STOP_REASONS = Object.freeze({
  STOP_PACKET_FIELD_INVALID: 'STOP_PACKET_FIELD_INVALID',
  STOP_PROVENANCE_MISMATCH: 'STOP_PROVENANCE_MISMATCH',
  STOP_MAIN_MOVED: 'STOP_MAIN_MOVED',
  STOP_RELATION_PRESENT: 'STOP_RELATION_PRESENT',
  STOP_CHECKSUM_MISMATCH: 'STOP_CHECKSUM_MISMATCH',
  STOP_TARGET_IDENTITY_MISMATCH: 'STOP_TARGET_IDENTITY_MISMATCH',
  STOP_EXECUTION_AUTHORITY_MISSING: 'STOP_EXECUTION_AUTHORITY_MISSING',
  STOP_EXECUTION_AUTHORITY_SOURCE_TEST_ONLY: 'STOP_EXECUTION_AUTHORITY_SOURCE_TEST_ONLY',
  STOP_EXECUTION_AUTHORITY_INVALID: 'STOP_EXECUTION_AUTHORITY_INVALID',
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
  STOP_AMBIGUOUS_RETRY_FORBIDDEN: 'STOP_AMBIGUOUS_RETRY_FORBIDDEN',
  STOP_ARBITRARY_SQL_FORBIDDEN: 'STOP_ARBITRARY_SQL_FORBIDDEN',
  STOP_AUTO_DROP_FORBIDDEN: 'STOP_AUTO_DROP_FORBIDDEN',
  STOP_SECRET_OUTPUT_FORBIDDEN: 'STOP_SECRET_OUTPUT_FORBIDDEN',
  STOP_EXECUTION_HEAD_AUTHORITY_MISMATCH: 'STOP_EXECUTION_HEAD_AUTHORITY_MISMATCH',
  STOP_EXECUTION_UNAUTHORIZED: 'STOP_EXECUTION_UNAUTHORIZED',
  STOP_PRECONNECT_ENDPOINT_IDENTITY: 'STOP_PRECONNECT_ENDPOINT_IDENTITY',
  STOP_CONNECTED_TARGET_IDENTITY_MISMATCH: 'STOP_CONNECTED_TARGET_IDENTITY_MISMATCH',
});

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

const REQUIRED_TRANSPORT_METHODS = Object.freeze([
  'verifyConnectedTargetIdentity',
  'acquireAdvisoryLock',
  'releaseAdvisoryLock',
  'withTransaction',
  'applyMigration',
  'verifyCatalog',
  'writeLedger',
]);

const FORBIDDEN_PACKET_KEYS = Object.freeze([
  'productRowReadAllowed',
  'writerGrant',
  'runtimeGateActivation',
  'providerReroute',
  'ambiguousRetryAllowed',
]);

const HEX40_RE = /^[0-9a-f]{40}$/;
const HEX64_RE = /^[0-9a-f]{64}$/;

function isStrictObject(v) {
  return !!v && typeof v === 'object' && !Array.isArray(v);
}

function isHex40(v) {
  return typeof v === 'string' && HEX40_RE.test(v.toLowerCase());
}

function isSha256Hex(v) {
  return typeof v === 'string' && HEX64_RE.test(v.toLowerCase());
}

function sha256File(filePath) {
  return crypto.createHash('sha256').update(fs.readFileSync(filePath)).digest('hex');
}

function readJsonRepoFile(relPath) {
  const abs = path.resolve(ROOT, relPath);
  if (!abs.startsWith(ROOT + path.sep)) return null;
  try {
    return JSON.parse(fs.readFileSync(abs, 'utf8'));
  } catch {
    return null;
  }
}

/**
 * Build the canonical single-binding bootstrap PROVENANCE packet from the
 * frozen repository binding in the transport module. currentMain defaults to
 * the trusted local repository HEAD.
 *
 * The packet deliberately carries NO execution authority: the live CENTRAL
 * Production execution authority is supplied separately at execution time and
 * is never derived from these frozen provenance facts.
 */
function buildBootstrapPacket(overrides) {
  const actualOverrides = isStrictObject(overrides) ? overrides : {};
  const base = {
    issue: BOOTSTRAP.issue,
    migrationId: BOOTSTRAP.migrationId,
    currentMain: TRANSPORT.resolveTrustedLocalRepoHead(ROOT),
    migrationPath: BOOTSTRAP.migrationPath,
    migrationSha256: BOOTSTRAP.migrationSha256,
    intendedRelation: BOOTSTRAP.relation,
    expectedSchemaFingerprint: BOOTSTRAP.expectedSchemaFingerprint,
    riskClass: BOOTSTRAP.riskClass,
    targetIdentity: Object.freeze({ ...CANONICAL_TARGET_IDENTITY }),
    applyMode: 'TRANSACTION_REQUIRED',
    unrelatedMigrationCount: 0,
    productRowReadAllowed: false,
    writerGrant: false,
    runtimeGateActivation: false,
    providerReroute: false,
    ambiguousRetryAllowed: false,
  };
  return Object.freeze({ ...base, ...actualOverrides });
}

/**
 * Cross-check the packet against the committed repository provenance facts:
 * canonical-migrations.json, expected-schema-manifest.json, ledger-contract.json.
 * Pure local file reads; never network.
 */
function provenanceStops(packet) {
  const stops = [];
  const canonical = readJsonRepoFile('db/migration-provenance/canonical-migrations.json');
  const entry =
    canonical && Array.isArray(canonical.migrations)
      ? canonical.migrations.find((m) => m && m.path === packet.migrationPath)
      : null;
  if (!entry) {
    stops.push(STOP_REASONS.STOP_PROVENANCE_MISMATCH);
  } else {
    if (entry.id !== packet.migrationId) stops.push(STOP_REASONS.STOP_PROVENANCE_MISMATCH);
    if (entry.checksum !== `sha256:${packet.migrationSha256}`) {
      stops.push(STOP_REASONS.STOP_PROVENANCE_MISMATCH);
    }
    if (entry.approval_reference !== `issue:${packet.issue}`) {
      stops.push(STOP_REASONS.STOP_PROVENANCE_MISMATCH);
    }
    if (entry.risk_class !== BOOTSTRAP.riskClass) stops.push(STOP_REASONS.STOP_PROVENANCE_MISMATCH);
    if (entry.transaction_mode !== BOOTSTRAP.transactionMode) {
      stops.push(STOP_REASONS.STOP_PROVENANCE_MISMATCH);
    }
  }

  const manifest = readJsonRepoFile('db/migration-provenance/expected-schema-manifest.json');
  const critical =
    manifest && Array.isArray(manifest.critical_objects)
      ? manifest.critical_objects.find((o) => o && o.name === `table:${packet.intendedRelation}`)
      : null;
  if (!critical || critical.fingerprint !== `sha256:${packet.expectedSchemaFingerprint}`) {
    stops.push(STOP_REASONS.STOP_PROVENANCE_MISMATCH);
  }

  const contract = readJsonRepoFile('db/migration-provenance/ledger-contract.json');
  const relationName = String(packet.intendedRelation).split('.')[1];
  if (!contract || contract.relation_name !== relationName) {
    stops.push(STOP_REASONS.STOP_PROVENANCE_MISMATCH);
  }

  return Array.from(new Set(stops));
}

/**
 * Pure readiness check against the frozen binding and repository provenance.
 * Never touches a transport, never connects, never reads credentials.
 */
function evaluateBootstrapReadiness(packet) {
  const stops = [];

  if (!isStrictObject(packet)) {
    return {
      decision: DECISIONS.EXECUTION_DISABLED_BY_DEFAULT,
      stops: [STOP_REASONS.STOP_PACKET_FIELD_INVALID],
    };
  }

  if (packet.issue !== BOOTSTRAP.issue) stops.push(STOP_REASONS.STOP_PACKET_FIELD_INVALID);
  if (!isHex40(String(packet.currentMain || ''))) stops.push(STOP_REASONS.STOP_MAIN_MOVED);
  if (packet.migrationId !== BOOTSTRAP.migrationId) {
    stops.push(STOP_REASONS.STOP_PACKET_FIELD_INVALID);
  }
  if (packet.migrationPath !== BOOTSTRAP.migrationPath) {
    stops.push(STOP_REASONS.STOP_PACKET_FIELD_INVALID);
  }
  if (!isSha256Hex(String(packet.migrationSha256 || ''))) {
    stops.push(STOP_REASONS.STOP_CHECKSUM_MISMATCH);
  }
  if (packet.intendedRelation !== BOOTSTRAP.relation) {
    stops.push(STOP_REASONS.STOP_PACKET_FIELD_INVALID);
  }
  if (packet.expectedSchemaFingerprint !== BOOTSTRAP.expectedSchemaFingerprint) {
    stops.push(STOP_REASONS.STOP_PACKET_FIELD_INVALID);
  }
  if (packet.riskClass !== BOOTSTRAP.riskClass) {
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

  for (const k of FORBIDDEN_PACKET_KEYS) {
    if (packet[k] !== false) {
      if (k === 'productRowReadAllowed') stops.push(STOP_REASONS.STOP_PRODUCT_ROW_READ_FORBIDDEN);
      if (k === 'writerGrant') stops.push(STOP_REASONS.STOP_WRITER_GRANT_FORBIDDEN);
      if (k === 'runtimeGateActivation') stops.push(STOP_REASONS.STOP_RUNTIME_GATE_FORBIDDEN);
      if (k === 'providerReroute') stops.push(STOP_REASONS.STOP_PROVIDER_REROUTE_FORBIDDEN);
      if (k === 'ambiguousRetryAllowed') stops.push(STOP_REASONS.STOP_AMBIGUOUS_RETRY_FORBIDDEN);
    }
  }

  // Local file checksum rehash against the bound checksum.
  let localSha = null;
  try {
    localSha = sha256File(path.join(ROOT, BOOTSTRAP.migrationPath));
  } catch {
    stops.push(STOP_REASONS.STOP_CHECKSUM_MISMATCH);
  }
  if (localSha && localSha !== String(packet.migrationSha256 || '').toLowerCase()) {
    stops.push(STOP_REASONS.STOP_CHECKSUM_MISMATCH);
  }

  for (const s of provenanceStops(packet)) stops.push(s);

  const unique = Array.from(new Set(stops)).sort();
  return {
    decision: unique.length === 0 ? DECISIONS.READINESS_PASSED : DECISIONS.EXECUTION_DISABLED_BY_DEFAULT,
    stops: unique,
  };
}

/**
 * Structural transport validation: exactly the bounded method surface, no
 * forbidden capability, ZERO method calls performed here.
 */
function validateLedgerBootstrapTransport(transport) {
  if (!isStrictObject(transport)) {
    return { ok: false, reason: STOP_REASONS.STOP_CREDENTIAL_OPERATOR_ABSENT };
  }
  for (const k of FORBIDDEN_TRANSPORT_METHODS) {
    if (k in transport) {
      return { ok: false, reason: STOP_REASONS.STOP_ARBITRARY_SQL_FORBIDDEN };
    }
  }
  for (const k of REQUIRED_TRANSPORT_METHODS) {
    if (typeof transport[k] !== 'function') {
      return { ok: false, reason: STOP_REASONS.STOP_CREDENTIAL_OPERATOR_ABSENT };
    }
  }
  return { ok: true, reason: null };
}

function resolveAuthorizedExecutionHead(options, env) {
  const opts = isStrictObject(options) ? options : {};
  if (typeof opts.executionHead === 'string' && opts.executionHead.trim().length > 0) {
    return opts.executionHead.trim().toLowerCase();
  }
  const source = isStrictObject(env) ? env : process.env;
  const raw = source[ENV_EXECUTION_HEAD];
  if (typeof raw === 'string' && raw.trim().length > 0) {
    return raw.trim().toLowerCase();
  }
  return null;
}

/**
 * Resolve the live CENTRAL Production execution authority reference from the
 * explicit execution-time input (CLI flag / options) or the dedicated
 * environment key. It is NEVER read from the frozen packet or the SOURCE/TEST
 * implementation provenance.
 */
function resolveExecutionAuthorityReference(options, env) {
  const opts = isStrictObject(options) ? options : {};
  const fromOptions = opts.executionAuthority;
  if (typeof fromOptions === 'string' && fromOptions.trim().length > 0) {
    return fromOptions;
  }
  if (typeof fromOptions === 'number' && Number.isSafeInteger(fromOptions) && fromOptions > 0) {
    return fromOptions;
  }
  const source = isStrictObject(env) ? env : process.env;
  const raw = source[ENV_EXECUTION_AUTHORITY];
  if (typeof raw === 'string' && raw.trim().length > 0) return raw;
  if (typeof raw === 'number' && Number.isSafeInteger(raw) && raw > 0) return raw;
  return null;
}

/**
 * Live CENTRAL Production execution authority gate. The reference must be
 * present, well-formed, and distinct from the SOURCE/TEST implementation
 * provenance comment. Fails closed BEFORE any credential/DB contact.
 */
function verifyLedgerBootstrapExecutionAuthority(options, env) {
  const raw = resolveExecutionAuthorityReference(options, env);
  if (raw === null) {
    return {
      ok: false,
      reason: STOP_REASONS.STOP_EXECUTION_AUTHORITY_MISSING,
      executionAuthorityReference: null,
    };
  }
  const normalized = TRANSPORT.normalizeExecutionAuthorityReference(raw);
  if (normalized === String(BOOTSTRAP.sourceTestImplementationComment)) {
    // The SOURCE/TEST implementation comment is provenance, never authority.
    return {
      ok: false,
      reason: STOP_REASONS.STOP_EXECUTION_AUTHORITY_SOURCE_TEST_ONLY,
      executionAuthorityReference: null,
    };
  }
  if (!TRANSPORT.isValidExecutionAuthorityReference(raw)) {
    return {
      ok: false,
      reason: STOP_REASONS.STOP_EXECUTION_AUTHORITY_INVALID,
      executionAuthorityReference: null,
    };
  }
  return { ok: true, reason: null, executionAuthorityReference: normalized };
}

/**
 * Exact-head authority gate: the CENTRAL-authorized execution head (CLI flag
 * or LOVEBUD_LEDGER_BOOTSTRAP_EXECUTION_HEAD) must exist, be 40-hex, and equal
 * the trusted local repository HEAD. Fails closed otherwise.
 */
function verifyLedgerBootstrapExecutionHead(options, repoRoot, env) {
  const actualExecutionHead = TRANSPORT.resolveTrustedLocalRepoHead(repoRoot || ROOT);
  if (!actualExecutionHead || !isHex40(actualExecutionHead)) {
    return {
      ok: false,
      reason: STOP_REASONS.STOP_MAIN_MOVED,
      actualExecutionHead: null,
      centralAuthorizedExecutionHead: null,
    };
  }
  const centralAuthorizedExecutionHead = resolveAuthorizedExecutionHead(options, env);
  if (!centralAuthorizedExecutionHead || !isHex40(centralAuthorizedExecutionHead)) {
    return {
      ok: false,
      reason: STOP_REASONS.STOP_EXECUTION_HEAD_AUTHORITY_MISMATCH,
      actualExecutionHead,
      centralAuthorizedExecutionHead: null,
    };
  }
  if (actualExecutionHead !== centralAuthorizedExecutionHead) {
    return {
      ok: false,
      reason: STOP_REASONS.STOP_EXECUTION_HEAD_AUTHORITY_MISMATCH,
      actualExecutionHead,
      centralAuthorizedExecutionHead,
    };
  }
  return { ok: true, actualExecutionHead, centralAuthorizedExecutionHead };
}

/**
 * Normalize one governed-attempt result envelope.
 *
 * `oneAttemptBudgetConsumed` is the CENTRAL authority-consumption state: it
 * becomes true the moment governed DB-capable execution begins (connection /
 * advisory-lock / transaction path) and never returns to false. It is NOT the
 * commit outcome. `committedAndVerified` is a separate DB-outcome fact and is
 * never used as authority-consumption state. `retryPermitted` is always the
 * exact inverse of consumption, so a consumed authority can never be reused.
 */
function governedResult(fields) {
  const consumed = fields.oneAttemptBudgetConsumed === true;
  return {
    ...fields,
    dbCapableExecutionStarted: consumed,
    oneAttemptBudgetConsumed: consumed,
    retryPermitted: !consumed,
  };
}

/**
 * Execute the governed bootstrap. Default is a paper-only dry run. Real apply
 * requires executionEnabled AND allowExecute AND a validated bounded transport
 * AND the live CENTRAL execution-authority gate AND the exact-head gate — all
 * BEFORE any transport method call. One attempt; every outcome after governed
 * DB-capable execution begins keeps the CENTRAL authority consumed.
 */
async function executeGovernedBootstrap(opts) {
  const options = isStrictObject(opts) ? opts : {};
  const packet = options.packet;
  const transport = options.transport;
  const executionEnabled = options.executionEnabled === true;
  const allowExecute = options.allowExecute === true;

  const readiness = evaluateBootstrapReadiness(packet);
  if (readiness.decision !== DECISIONS.READINESS_PASSED) {
    return governedResult({
      decision: DECISIONS.EXECUTION_DISABLED_BY_DEFAULT,
      stops: readiness.stops,
      reason: 'READINESS_FAILED',
      executionAttempted: false,
      oneAttemptBudgetConsumed: false,
    });
  }

  if (!executionEnabled || !allowExecute) {
    return governedResult({
      decision: DECISIONS.PAPER_ONLY_DRY_RUN,
      stops: [],
      reason: executionEnabled ? 'EXECUTION_NOT_ALLOWED' : 'EXECUTION_DISABLED_BY_DEFAULT',
      executionAttempted: false,
      oneAttemptBudgetConsumed: false,
      binding: {
        relation: packet.intendedRelation,
        migrationId: packet.migrationId,
        targetIdentity: packet.targetIdentity,
      },
    });
  }

  const tCheck = validateLedgerBootstrapTransport(transport);
  if (!tCheck.ok) {
    return governedResult({
      decision: DECISIONS.EXECUTION_DISABLED_BY_DEFAULT,
      stops: [tCheck.reason],
      reason: tCheck.reason,
      executionAttempted: false,
      oneAttemptBudgetConsumed: false,
    });
  }

  // Live CENTRAL Production execution authority. Supplied separately at
  // execution time; never derived from the frozen SOURCE/TEST provenance.
  const authorityAuth = verifyLedgerBootstrapExecutionAuthority(
    { executionAuthority: options.executionAuthority },
    options.env
  );
  if (!authorityAuth.ok) {
    return governedResult({
      decision: DECISIONS.EXECUTION_DISABLED_BY_DEFAULT,
      stops: [authorityAuth.reason],
      reason: authorityAuth.reason,
      executionAuthorityReference: authorityAuth.executionAuthorityReference,
      executionAttempted: false,
      oneAttemptBudgetConsumed: false,
    });
  }
  const executionAuthorityReference = authorityAuth.executionAuthorityReference;

  const headAuth = verifyLedgerBootstrapExecutionHead(
    { executionHead: options.executionHead },
    options.repoRoot,
    options.env
  );
  if (!headAuth.ok) {
    return governedResult({
      decision: DECISIONS.EXECUTION_DISABLED_BY_DEFAULT,
      stops: [headAuth.reason],
      reason: headAuth.reason,
      actualExecutionHead: headAuth.actualExecutionHead,
      centralAuthorizedExecutionHead: headAuth.centralAuthorizedExecutionHead,
      executionAuthorityReference,
      executionAttempted: false,
      oneAttemptBudgetConsumed: false,
    });
  }

  const lockKey = crypto
    .createHash('sha256')
    .update(`#${packet.issue}|${packet.migrationPath}|${packet.migrationSha256}`)
    .digest('hex')
    .slice(0, 16);

  // ---- Preconnect boundary ---------------------------------------------
  // Everything above is pure/local. From here on the transport may open a
  // connection, so any non-preconnect failure below is DB-capable and keeps
  // the CENTRAL authority consumed.

  // Connected-target identity gate. Opens the ONE permitted connection and
  // proves the ACTUALLY CONNECTED database and role class BEFORE any advisory
  // lock, BEGIN, migration SQL, or ledger write.
  //   - a wrong Neon endpoint is detectable from the DSN alone and fails
  //     PRECONNECT with zero connections (authority UNCONSUMED);
  //   - a wrong connected database, a role class that is not OWNER_CLASS, a
  //     failed probe, or a malformed identity result means DB-capable
  //     execution has already begun: CONSUMED, retryPermitted = false.
  let identity;
  try {
    identity = await transport.verifyConnectedTargetIdentity();
  } catch (err) {
    const category = err && err.category;
    if (PRECONNECT_FAILURE_CATEGORIES.has(category)) {
      // A preconnect input problem (credential, role mapping, DSN endpoint
      // binding): nothing DB-capable has happened, so the CENTRAL authority
      // stays UNCONSUMED and the attempt remains permitted.
      const endpointMismatch = category === TRANSPORT.TRANSPORT_FAILURE.ENDPOINT_IDENTITY_MISMATCH;
      return governedResult({
        decision: DECISIONS.EXECUTION_DISABLED_BY_DEFAULT,
        stops: [
          endpointMismatch
            ? STOP_REASONS.STOP_PRECONNECT_ENDPOINT_IDENTITY
            : STOP_REASONS.STOP_CREDENTIAL_OPERATOR_ABSENT,
        ],
        reason: endpointMismatch
          ? 'PRECONNECT_ENDPOINT_IDENTITY_MISMATCH'
          : 'PRECONNECT_CREDENTIAL_UNAVAILABLE',
        preconnectFailure: true,
        executionAuthorityReference,
        executionAttempted: false,
        oneAttemptBudgetConsumed: false,
        committedAndVerified: false,
      });
    }
    // The connection opened and the connected target could not be proven:
    // DB-capable execution has begun, so the authority stays CONSUMED.
    return governedResult({
      decision: DECISIONS.EXECUTION_DISABLED_BY_DEFAULT,
      stops: [STOP_REASONS.STOP_CONNECTED_TARGET_IDENTITY_MISMATCH],
      reason: 'CONNECTED_TARGET_IDENTITY_MISMATCH',
      preconnectFailure: false,
      executionAuthorityReference,
      executionAttempted: true,
      oneAttemptBudgetConsumed: true,
      committedAndVerified: false,
    });
  }
  if (!identity || identity.ok !== true) {
    // Defensive: a transport that reports non-ok without throwing is still a
    // post-connect failure, and an undefined state may have begun DB-capable
    // execution. Fail closed and keep the authority consumed.
    return governedResult({
      decision: DECISIONS.EXECUTION_DISABLED_BY_DEFAULT,
      stops: [STOP_REASONS.STOP_CONNECTED_TARGET_IDENTITY_MISMATCH],
      reason: 'CONNECTED_TARGET_IDENTITY_MISMATCH',
      preconnectFailure: false,
      executionAuthorityReference,
      executionAttempted: true,
      oneAttemptBudgetConsumed: true,
      committedAndVerified: false,
    });
  }

  let lockHandle;
  try {
    lockHandle = await transport.acquireAdvisoryLock(lockKey);
  } catch (err) {
    const preconnectFailure = PRECONNECT_FAILURE_CATEGORIES.has(err && err.category);
    return governedResult({
      decision: DECISIONS.EXECUTION_DISABLED_BY_DEFAULT,
      stops: [STOP_REASONS.STOP_ADVISORY_LOCK_UNAVAILABLE],
      reason: preconnectFailure ? 'PRECONNECT_CREDENTIAL_UNAVAILABLE' : 'ADVISORY_LOCK_QUERY_FAILED',
      preconnectFailure,
      executionAuthorityReference,
      executionAttempted: !preconnectFailure,
      oneAttemptBudgetConsumed: !preconnectFailure,
      committedAndVerified: false,
    });
  }
  if (!lockHandle) {
    // The connection and the advisory-lock path both began: consumed.
    return governedResult({
      decision: DECISIONS.EXECUTION_DISABLED_BY_DEFAULT,
      stops: [STOP_REASONS.STOP_ADVISORY_LOCK_UNAVAILABLE],
      reason: 'ADVISORY_LOCK_UNAVAILABLE',
      executionAuthorityReference,
      executionAttempted: true,
      oneAttemptBudgetConsumed: true,
      committedAndVerified: false,
    });
  }

  try {
    const txResult = await transport.withTransaction(async (tx) => {
      const pre = await tx.catalogTableKind(packet.intendedRelation);
      if (pre && pre.present === true) {
        return { ok: false, reason: STOP_REASONS.STOP_RELATION_PRESENT };
      }
      const applyOutcome = await transport.applyMigration(tx, {
        path: packet.migrationPath,
        sha256: packet.migrationSha256,
      });
      if (!applyOutcome || applyOutcome.committed !== true) {
        return {
          ok: false,
          reason: (applyOutcome && applyOutcome.reason) || STOP_REASONS.STOP_AMBIGUOUS_OUTCOME,
        };
      }
      const post = await tx.verifyCatalog(packet.intendedRelation, packet.expectedSchemaFingerprint);
      if (!post || post.matched !== true) {
        return { ok: false, reason: STOP_REASONS.STOP_POSTCHECK_MISMATCH };
      }
      const ledger = await tx.writeLedger({
        issue: packet.issue,
        executionAuthorityReference,
        executionHead: headAuth.actualExecutionHead,
        migrationId: packet.migrationId,
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

    if (!txResult || txResult.ok !== true) {
      // Rolled back pre-commit, but the CENTRAL authority is already consumed.
      return governedResult({
        decision: DECISIONS.APPLY_ROLLED_BACK_PRE_COMMIT,
        stops: [txResult && txResult.reason ? txResult.reason : STOP_REASONS.STOP_AMBIGUOUS_OUTCOME],
        reason: txResult && txResult.reason ? txResult.reason : 'APPLY_FAILED',
        executionAuthorityReference,
        executionAttempted: true,
        oneAttemptBudgetConsumed: true,
        committedAndVerified: false,
      });
    }

    return governedResult({
      decision: DECISIONS.APPLY_COMMITTED_AND_VERIFIED,
      stops: [],
      reason: 'APPLY_COMMITTED_AND_VERIFIED',
      executionAuthorityReference,
      executionAttempted: true,
      oneAttemptBudgetConsumed: true,
      committedAndVerified: true,
    });
  } catch {
    return governedResult({
      decision: DECISIONS.EXECUTION_DISABLED_BY_DEFAULT,
      stops: [STOP_REASONS.STOP_AMBIGUOUS_OUTCOME],
      reason: 'AMBIGUOUS_OUTCOME',
      ambiguous: true,
      executionAuthorityReference,
      executionAttempted: true,
      oneAttemptBudgetConsumed: true,
      committedAndVerified: false,
    });
  } finally {
    try {
      await transport.releaseAdvisoryLock(lockHandle);
    } catch {
      /* swallow — disconnect is best-effort */
    }
  }
}

/** Strict CLI parser: no unknown flags, no duplicates, no positionals. */
function parseOperatorCliArgs(argv) {
  const seen = new Set();
  let isExecute = false;
  let isDryRun = false;
  let executionHead = null;
  let executionAuthority = null;

  for (let i = 0; i < argv.length; i += 1) {
    const arg = String(argv[i]);
    let flagName = arg;
    let flagValue = null;
    if (arg.startsWith('--')) {
      const eq = arg.indexOf('=');
      if (eq !== -1) {
        flagName = arg.slice(0, eq);
        flagValue = arg.slice(eq + 1);
      }
    } else {
      throw new Error('POSITIONAL_ARGUMENT_REJECTED');
    }
    if (!ALLOWED_FLAGS.includes(flagName)) throw new Error('UNKNOWN_FLAG_REJECTED');
    if (seen.has(flagName)) throw new Error('DUPLICATE_FLAG_REJECTED');
    seen.add(flagName);

    if (flagName === '--execute' || flagName === '--dry-run') {
      if (flagValue !== null) throw new Error('FLAG_VALUE_UNEXPECTED');
      if (flagName === '--execute') isExecute = true;
      else isDryRun = true;
    } else if (flagName === '--execution-head' || flagName === '--execution-authority') {
      let value;
      if (flagValue !== null) {
        value = flagValue;
      } else {
        if (i + 1 >= argv.length || String(argv[i + 1]).startsWith('--')) {
          throw new Error('FLAG_VALUE_MISSING');
        }
        i += 1;
        value = String(argv[i]);
      }
      if (flagName === '--execution-head') executionHead = value;
      else executionAuthority = value;
    }
  }

  if (isExecute && isDryRun) throw new Error('CONFLICTING_FLAGS_REJECTED');
  if (!isExecute && !isDryRun) isDryRun = true;
  return { isExecute, isDryRun, executionHead, executionAuthority };
}

function writeJsonError(obj) {
  process.stderr.write(JSON.stringify(obj, null, 2) + '\n');
}

async function main() {
  let parsed;
  try {
    parsed = parseOperatorCliArgs(process.argv.slice(2));
  } catch (err) {
    writeJsonError({
      mode: 'INITIALIZATION_FAILED',
      decision: DECISIONS.EXECUTION_DISABLED_BY_DEFAULT,
      reason: err.message || 'INVALID_CLI_ARGUMENTS',
      oneAttemptBudgetConsumed: false,
      executionAttempted: false,
    });
    process.exit(2);
    return;
  }

  const packet = buildBootstrapPacket();

  if (parsed.isDryRun) {
    const readiness = evaluateBootstrapReadiness(packet);
    const report = {
      mode: 'DRY_RUN',
      executionAttempted: false,
      oneAttemptBudgetConsumed: false,
      retryPermitted: true,
      decision: readiness.decision,
      stops: readiness.stops,
      binding: {
        issue: packet.issue,
        // Provenance metadata only: the SOURCE/TEST implementation comment is
        // NEVER the Production mutation authority.
        sourceTestImplementationComment: BOOTSTRAP.sourceTestImplementationComment,
        liveExecutionAuthority: 'SUPPLIED_SEPARATELY_AT_EXECUTION_TIME',
        migrationId: packet.migrationId,
        currentMain: packet.currentMain,
        migrationPath: packet.migrationPath,
        migrationSha256: packet.migrationSha256,
        intendedRelation: packet.intendedRelation,
        expectedSchemaFingerprint: packet.expectedSchemaFingerprint,
        riskClass: packet.riskClass,
        targetIdentity: packet.targetIdentity,
        applyMode: packet.applyMode,
      },
    };
    process.stdout.write(JSON.stringify(report, null, 2) + '\n');
    if (readiness.decision !== DECISIONS.READINESS_PASSED) process.exit(2);
    return;
  }

  if (process.env[ENV_ALLOW_EXECUTE] !== '1') {
    writeJsonError({
      mode: 'EXECUTE_REQUESTED',
      decision: DECISIONS.EXECUTION_DISABLED_BY_DEFAULT,
      reason: `${ENV_ALLOW_EXECUTE} not set`,
      oneAttemptBudgetConsumed: false,
      retryPermitted: true,
      executionAttempted: false,
    });
    process.exit(2);
    return;
  }

  // Live CENTRAL Production execution authority gate — BEFORE any credential
  // or DB contact. The SOURCE/TEST implementation comment can never pass.
  const authorityAuth = verifyLedgerBootstrapExecutionAuthority({
    executionAuthority: parsed.executionAuthority,
  });
  if (!authorityAuth.ok) {
    writeJsonError({
      mode: 'EXECUTE_REQUESTED',
      decision: DECISIONS.EXECUTION_DISABLED_BY_DEFAULT,
      reason: authorityAuth.reason,
      executionAuthorityReference: authorityAuth.executionAuthorityReference,
      oneAttemptBudgetConsumed: false,
      retryPermitted: true,
      executionAttempted: false,
    });
    process.exit(2);
    return;
  }

  const headAuth = verifyLedgerBootstrapExecutionHead({ executionHead: parsed.executionHead });
  if (!headAuth.ok) {
    writeJsonError({
      mode: 'EXECUTE_REQUESTED',
      decision: DECISIONS.EXECUTION_DISABLED_BY_DEFAULT,
      reason: headAuth.reason,
      actualExecutionHead: headAuth.actualExecutionHead,
      centralAuthorizedExecutionHead: headAuth.centralAuthorizedExecutionHead,
      oneAttemptBudgetConsumed: false,
      retryPermitted: true,
      executionAttempted: false,
    });
    process.exit(2);
    return;
  }

  let transport;
  try {
    const mod = require(FIXED_TRANSPORT_PATH);
    // Bounded view: expose EXACTLY the seven governed methods and nothing else.
    transport = Object.freeze({
      verifyConnectedTargetIdentity: mod.verifyConnectedTargetIdentity,
      acquireAdvisoryLock: mod.acquireAdvisoryLock,
      releaseAdvisoryLock: mod.releaseAdvisoryLock,
      withTransaction: mod.withTransaction,
      applyMigration: mod.applyMigration,
      verifyCatalog: mod.verifyCatalog,
      writeLedger: mod.writeLedger,
    });
  } catch {
    writeJsonError({
      mode: 'EXECUTE_REQUESTED',
      decision: DECISIONS.EXECUTION_DISABLED_BY_DEFAULT,
      reason: 'TRANSPORT_REQUIRE_FAILED',
      oneAttemptBudgetConsumed: false,
      executionAttempted: false,
    });
    process.exit(2);
    return;
  }

  const tCheck = validateLedgerBootstrapTransport(transport);
  if (!tCheck.ok) {
    writeJsonError({
      mode: 'EXECUTE_REQUESTED',
      decision: DECISIONS.EXECUTION_DISABLED_BY_DEFAULT,
      reason: tCheck.reason,
      oneAttemptBudgetConsumed: false,
      executionAttempted: false,
    });
    process.exit(2);
    return;
  }

  const result = await executeGovernedBootstrap({
    packet,
    transport,
    executionEnabled: true,
    allowExecute: true,
    executionHead: parsed.executionHead,
    executionAuthority: parsed.executionAuthority,
  });
  process.stdout.write(JSON.stringify({ mode: 'EXECUTE', ...result }, null, 2) + '\n');
  if (result.stops && result.stops.length > 0) process.exit(2);
}

if (require.main === module) {
  main().catch(() => {
    writeJsonError({
      mode: 'AMBIGUOUS',
      decision: DECISIONS.EXECUTION_DISABLED_BY_DEFAULT,
      reason: 'UNCAUGHT_ERROR',
      message: 'Operator entered an undefined state. Read-only reconcile required; no retry.',
      // Fail closed: an undefined state may have begun DB-capable execution, so
      // the CENTRAL exactly-one authority must be treated as CONSUMED.
      oneAttemptBudgetConsumed: true,
      dbCapableExecutionStarted: true,
      retryPermitted: false,
      committedAndVerified: false,
      executionAttempted: true,
    });
    process.exit(2);
  });
}

module.exports = Object.freeze({
  DECISIONS,
  STOP_REASONS,
  BOOTSTRAP,
  CANONICAL_TARGET_IDENTITY,
  CANONICAL_NEON_ENDPOINT_IDENTITY: TRANSPORT.CANONICAL_NEON_ENDPOINT_IDENTITY,
  EXPECTED_CONNECTED_ROLE_CLASS: TRANSPORT.EXPECTED_CONNECTED_ROLE_CLASS,
  ALLOWED_FLAGS,
  ENV_ALLOW_EXECUTE,
  ENV_EXECUTION_HEAD,
  ENV_EXECUTION_AUTHORITY,
  PRECONNECT_FAILURE_CATEGORIES,
  REQUIRED_TRANSPORT_METHODS,
  FORBIDDEN_TRANSPORT_METHODS,
  buildBootstrapPacket,
  evaluateBootstrapReadiness,
  validateLedgerBootstrapTransport,
  resolveAuthorizedExecutionHead,
  resolveExecutionAuthorityReference,
  verifyLedgerBootstrapExecutionAuthority,
  verifyLedgerBootstrapExecutionHead,
  executeGovernedBootstrap,
  parseOperatorCliArgs,
  __pure: { sha256File, isHex40, isSha256Hex, provenanceStops, governedResult },
});
