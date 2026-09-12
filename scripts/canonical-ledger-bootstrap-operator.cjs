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
 *     node scripts/canonical-ledger-bootstrap-operator.cjs --execute --execution-head <40hex>
 *     # the ONLY transport that can ever be loaded is the fixed repository-owned
 *     # module scripts/canonical-ledger-bootstrap-postgres.cjs, consumed through
 *     # a bounded six-method view. Any arbitrary module path input is rejected.
 *
 * Hard rules:
 *   - execution disabled by default; dry run is the default mode
 *   - both --execute and LOVEBUD_LEDGER_BOOTSTRAP_ALLOW_EXECUTE=1 are required
 *   - the exact-head authority gate must pass BEFORE any transport method call
 *   - the transport is fixed by repository path, never by caller input
 *   - the one-attempt budget is consumed ONLY on a committed+verified apply
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

const ALLOWED_FLAGS = Object.freeze(['--execute', '--dry-run', '--execution-head']);
const ENV_ALLOW_EXECUTE = 'LOVEBUD_LEDGER_BOOTSTRAP_ALLOW_EXECUTE';
const ENV_EXECUTION_HEAD = 'LOVEBUD_LEDGER_BOOTSTRAP_EXECUTION_HEAD';
const FIXED_TRANSPORT_PATH = path.join(__dirname, 'canonical-ledger-bootstrap-postgres.cjs');

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
  STOP_AMBIGUOUS_RETRY_FORBIDDEN: 'STOP_AMBIGUOUS_RETRY_FORBIDDEN',
  STOP_ARBITRARY_SQL_FORBIDDEN: 'STOP_ARBITRARY_SQL_FORBIDDEN',
  STOP_AUTO_DROP_FORBIDDEN: 'STOP_AUTO_DROP_FORBIDDEN',
  STOP_SECRET_OUTPUT_FORBIDDEN: 'STOP_SECRET_OUTPUT_FORBIDDEN',
  STOP_EXECUTION_HEAD_AUTHORITY_MISMATCH: 'STOP_EXECUTION_HEAD_AUTHORITY_MISMATCH',
  STOP_EXECUTION_UNAUTHORIZED: 'STOP_EXECUTION_UNAUTHORIZED',
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
 * Build the canonical single-binding bootstrap packet from the frozen
 * repository binding in the transport module. currentMain defaults to the
 * trusted local repository HEAD.
 */
function buildBootstrapPacket(overrides) {
  const actualOverrides = isStrictObject(overrides) ? overrides : {};
  const base = {
    issue: BOOTSTRAP.issue,
    activeAuthorizationComment: BOOTSTRAP.activeAuthorizationComment,
    migrationId: BOOTSTRAP.migrationId,
    currentMain: TRANSPORT.resolveTrustedLocalRepoHead(ROOT),
    migrationPath: BOOTSTRAP.migrationPath,
    migrationSha256: BOOTSTRAP.migrationSha256,
    intendedRelation: BOOTSTRAP.relation,
    expectedSchemaFingerprint: BOOTSTRAP.expectedSchemaFingerprint,
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
  if (packet.activeAuthorizationComment !== BOOTSTRAP.activeAuthorizationComment) {
    stops.push(STOP_REASONS.STOP_ACTIVE_COMMENT_MISSING);
  }
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
 * Execute the governed bootstrap. Default is a paper-only dry run. Real apply
 * requires executionEnabled AND allowExecute AND a validated bounded transport
 * AND the exact-head authority gate. One attempt; ambiguous outcomes stop with
 * no retry.
 */
async function executeGovernedBootstrap(opts) {
  const options = isStrictObject(opts) ? opts : {};
  const packet = options.packet;
  const transport = options.transport;
  const executionEnabled = options.executionEnabled === true;
  const allowExecute = options.allowExecute === true;

  const readiness = evaluateBootstrapReadiness(packet);
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
        migrationId: packet.migrationId,
        targetIdentity: packet.targetIdentity,
      },
    };
  }

  const tCheck = validateLedgerBootstrapTransport(transport);
  if (!tCheck.ok) {
    return {
      decision: DECISIONS.EXECUTION_DISABLED_BY_DEFAULT,
      stops: [tCheck.reason],
      reason: tCheck.reason,
      executionAttempted: false,
      oneAttemptBudgetConsumed: false,
    };
  }

  const headAuth = verifyLedgerBootstrapExecutionHead(
    { executionHead: options.executionHead },
    options.repoRoot,
    options.env
  );
  if (!headAuth.ok) {
    return {
      decision: DECISIONS.EXECUTION_DISABLED_BY_DEFAULT,
      stops: [headAuth.reason],
      reason: headAuth.reason,
      actualExecutionHead: headAuth.actualExecutionHead,
      centralAuthorizedExecutionHead: headAuth.centralAuthorizedExecutionHead,
      executionAttempted: false,
      oneAttemptBudgetConsumed: false,
    };
  }

  const lockKey = crypto
    .createHash('sha256')
    .update(`#${packet.issue}|${packet.migrationPath}|${packet.migrationSha256}`)
    .digest('hex')
    .slice(0, 16);

  let lockHandle;
  try {
    lockHandle = await transport.acquireAdvisoryLock(lockKey);
  } catch {
    return {
      decision: DECISIONS.EXECUTION_DISABLED_BY_DEFAULT,
      stops: [STOP_REASONS.STOP_ADVISORY_LOCK_UNAVAILABLE],
      reason: 'ADVISORY_LOCK_QUERY_FAILED',
      executionAttempted: false,
      oneAttemptBudgetConsumed: false,
    };
  }
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
        activeAuthorizationComment: packet.activeAuthorizationComment,
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
      return {
        decision: DECISIONS.APPLY_ROLLED_BACK_PRE_COMMIT,
        stops: [txResult && txResult.reason ? txResult.reason : STOP_REASONS.STOP_AMBIGUOUS_OUTCOME],
        reason: txResult && txResult.reason ? txResult.reason : 'APPLY_FAILED',
        executionAttempted: true,
        oneAttemptBudgetConsumed: false,
      };
    }

    return {
      decision: DECISIONS.APPLY_COMMITTED_AND_VERIFIED,
      stops: [],
      reason: 'APPLY_COMMITTED_AND_VERIFIED',
      executionAttempted: true,
      oneAttemptBudgetConsumed: true,
    };
  } catch {
    return {
      decision: DECISIONS.EXECUTION_DISABLED_BY_DEFAULT,
      stops: [STOP_REASONS.STOP_AMBIGUOUS_OUTCOME],
      reason: 'AMBIGUOUS_OUTCOME',
      ambiguous: true,
      executionAttempted: true,
      oneAttemptBudgetConsumed: false,
      retryPermitted: false,
    };
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
    } else if (flagName === '--execution-head') {
      if (flagValue !== null) {
        executionHead = flagValue;
      } else {
        if (i + 1 >= argv.length || String(argv[i + 1]).startsWith('--')) {
          throw new Error('FLAG_VALUE_MISSING');
        }
        i += 1;
        executionHead = String(argv[i]);
      }
    }
  }

  if (isExecute && isDryRun) throw new Error('CONFLICTING_FLAGS_REJECTED');
  if (!isExecute && !isDryRun) isDryRun = true;
  return { isExecute, isDryRun, executionHead };
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
      decision: readiness.decision,
      stops: readiness.stops,
      binding: {
        issue: packet.issue,
        activeAuthorizationComment: packet.activeAuthorizationComment,
        migrationId: packet.migrationId,
        currentMain: packet.currentMain,
        migrationPath: packet.migrationPath,
        migrationSha256: packet.migrationSha256,
        intendedRelation: packet.intendedRelation,
        expectedSchemaFingerprint: packet.expectedSchemaFingerprint,
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
      executionAttempted: false,
    });
    process.exit(2);
    return;
  }

  let transport;
  try {
    const mod = require(FIXED_TRANSPORT_PATH);
    // Bounded view: expose EXACTLY the six governed methods and nothing else.
    transport = Object.freeze({
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
      oneAttemptBudgetConsumed: false,
      executionAttempted: false,
    });
    process.exit(2);
  });
}

module.exports = Object.freeze({
  DECISIONS,
  STOP_REASONS,
  BOOTSTRAP,
  CANONICAL_TARGET_IDENTITY,
  ALLOWED_FLAGS,
  ENV_ALLOW_EXECUTE,
  ENV_EXECUTION_HEAD,
  REQUIRED_TRANSPORT_METHODS,
  FORBIDDEN_TRANSPORT_METHODS,
  buildBootstrapPacket,
  evaluateBootstrapReadiness,
  validateLedgerBootstrapTransport,
  resolveAuthorizedExecutionHead,
  verifyLedgerBootstrapExecutionHead,
  executeGovernedBootstrap,
  parseOperatorCliArgs,
  __pure: { sha256File, isHex40, isSha256Hex, provenanceStops },
});
