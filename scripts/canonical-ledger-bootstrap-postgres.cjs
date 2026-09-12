'use strict';

/**
 * Repository-owned bounded Production ledger-bootstrap Postgres transport (#3846).
 *
 * The ONLY transport surface the canonical ledger-bootstrap operator CLI may
 * load. Implements exactly the bounded interface validated by
 * validateLedgerBootstrapTransport in scripts/canonical-ledger-bootstrap-operator.cjs:
 *   acquireAdvisoryLock(lockKey) -> handle | null
 *   releaseAdvisoryLock(handle)  -> void (best-effort)
 *   withTransaction(fn)          -> { ok, reason? } (BEGIN/COMMIT/ROLLBACK here)
 *   applyMigration(tx, {path,sha256}) -> { committed } (exact bootstrap binding only)
 *   verifyCatalog(relation, fingerprint) -> { matched } (bounded facts only)
 *   writeLedger(payload)         -> { recorded, ledgerAppendStatus } (fixed seven-field append only;
 *                                   ledgerAppendStatus is the bounded APPENDED | FAILED | UNKNOWN
 *                                   diagnostic, never raw driver data)
 *
 * This transport is bound to exactly ONE migration: the canonical ledger
 * bootstrap migration recorded in db/migration-provenance/canonical-migrations.json
 * (id 20260802094500_bootstrap-migration-ledger, approval issue:3846, risk
 * ADDITIVE, transaction mode REQUIRED) and exactly ONE relation
 * (public.schema_migration_ledger) with the expected fingerprint recorded in
 * db/migration-provenance/expected-schema-manifest.json. No other migration,
 * relation, checksum, or fingerprint can ever be applied or verified.
 *
 * Hard properties: import is network-inert (pg required lazily at first
 * connect only); ONE connect attempt and ONE transaction attempt per instance,
 * no retry; ambiguous outcomes throw fixed sanitized errors; credentials come
 * only from LOVEBUD_LEDGER_BOOTSTRAP_DATABASE_URL via the production-readonly
 * boundary parser (TLS required, loopback rejected) and fail before connect
 * when missing/malformed; migration apply re-verifies local bytes against the
 * bound checksum (the SQL body is loaded from the repository file, never
 * embedded); no grant/revoke, product rows, drop, runtime gate, provider
 * reroute, arbitrary SQL, or arbitrary module input.
 *
 * AUTHORITY SEPARATION (the two must never be conflated):
 *   A. Immutable bootstrap provenance — issue:3846, the migration identity,
 *      path, checksum and expected fingerprint, risk class ADDITIVE, and
 *      transaction mode REQUIRED. Frozen in BOOTSTRAP below and cross-checked
 *      against db/migration-provenance/*.json by the operator.
 *   B. Live CENTRAL Production execution authority — a CENTRAL comment
 *      reference supplied SEPARATELY at execution time (operator CLI/env). It
 *      is never defaulted from, and never derived from, the frozen provenance.
 *      The SOURCE/TEST implementation comment 5644253160 authorized building
 *      this vehicle ONLY; it is retained in BOOTSTRAP as inert provenance
 *      metadata, and isValidExecutionAuthorityReference() rejects it as live
 *      authority. writeLedger() refuses any attestation payload whose authority
 *      reference is absent, malformed, equal to the SOURCE/TEST comment, or not
 *      bound to the exact authorized execution head.
 *
 * CONNECTED-TARGET IDENTITY GATE (target-binding guard). A syntactically valid
 * DSN is not proof of the right target, so before ANY advisory lock, BEGIN, or
 * DDL the transport proves the target it is ACTUALLY connected to:
 *   A. the parsed DSN host must be the canonical Neon endpoint identity
 *      (ep-little-poetry-a1vjyiim) on the Neon-managed domain. An arbitrary
 *      *.neon.tech host is rejected, and this is checkable from the DSN, so a
 *      wrong endpoint fails PRECONNECT with no connection opened at all.
 *   B. one bounded probe must report the canonical database (neondb).
 *   C. the connected role must resolve through the already-approved private
 *      role mapping to OWNER_CLASS. The raw owner role name is never hardcoded.
 * A wrong connected database or role class means DB-capable execution has
 * already begun: it fails closed as CONNECTED_TARGET_IDENTITY_MISMATCH and the
 * CENTRAL authority stays consumed. Raw host/database/role values are never
 * returned, thrown, or logged — only bounded booleans and the class label.
 *
 * SOURCE/TEST ONLY: this file performs NO Production contact. Live execution
 * is a separately authorized, separately credentialed operator action.
 *
 * Refs #3846, #3458 (keep OPEN), #1882 (keep OPEN).
 */

const crypto = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');

const BOUNDARY = require('./production-readonly-catalog-boundary-core.cjs');
const LEDGER_ADAPTER = require('./migration-postgres-ledger-adapter-core.cjs');

// Lazy: the catalog adapter requires `pg` at module scope; loading it only at
// verification time keeps this module's import network-inert.
let adapterModule = null;
function adapter() {
  if (!adapterModule) {
    adapterModule = require('./migration-catalog-postgres-adapter-core.cjs');
  }
  return adapterModule;
}

const ROOT = path.resolve(__dirname, '..');

// Dedicated credential boundary. Read ONLY at connect time. No fallback to
// DATABASE_URL / NETLIFY_DATABASE_URL / NEON_DATABASE_URL or any other key.
const CREDENTIAL_ENV_KEY = 'LOVEBUD_LEDGER_BOOTSTRAP_DATABASE_URL';
// Role mapping file (.secrets-relative JSON) for catalog grantee classes.
const ROLE_MAPPING_ENV_KEY = 'LOVEBUD_LEDGER_BOOTSTRAP_ROLE_MAPPING_FILE';

const RUNNER_VERSION = 'canonical-ledger-bootstrap-postgres-transport/1.0.0';

// Canonical Production identity committed in the repository (same authority as
// the activation gate and the governed schema-adoption operator core).
const CANONICAL_TARGET_IDENTITY = Object.freeze({
  product_shared: '133-relovetree',
  environment_class: 'production',
  database: 'neondb',
});

// Canonical Neon provider endpoint identity. The ledger bootstrap may run only
// against THIS endpoint on the Neon-managed domain. The endpoint id is the
// security-relevant binding; the regional labels are intentionally not pinned
// to one literal because CENTRAL fixed the endpoint identity, not a region.
const CANONICAL_NEON_ENDPOINT_IDENTITY = 'ep-little-poetry-a1vjyiim';
const NEON_MANAGED_DOMAIN_SUFFIX = '.neon.tech';
const NEON_ENDPOINT_POOLER_SUFFIX = '-pooler';
const NEON_ENDPOINT_LABEL_RE = /^ep-[a-z0-9]+(?:-[a-z0-9]+)*$/;

// The connected role must resolve to this grantee class through the approved
// private role mapping. The raw Production owner role name is NEVER hardcoded,
// returned, or logged.
const EXPECTED_CONNECTED_ROLE_CLASS = 'OWNER_CLASS';

// The single bounded connected-identity probe: fixed SQL text, no
// interpolation, no parameters, no values.
const CONNECTED_IDENTITY_QUERY =
  'SELECT current_database() AS database_name, current_user AS role_name';

// SOURCE/TEST implementation provenance ONLY. CENTRAL comment 5644253160
// authorized building this repository-owned vehicle under issue #3846; it did
// NOT authorize a Production mutation, and it MUST NEVER be accepted as the
// live Production execution authority. It is retained as inert metadata so the
// separation stays auditable, and it is explicitly rejected below.
const SOURCE_TEST_IMPLEMENTATION_COMMENT = 5644253160;

// A live CENTRAL Production execution authorization is a CENTRAL comment
// reference: bare digits, or the explicit `comment:<digits>` form. It is
// supplied separately at execution time and is never defaulted from BOOTSTRAP
// or any other frozen binding.
const EXECUTION_AUTHORITY_RE = /^[0-9]{6,}$/;

function normalizeExecutionAuthorityReference(value) {
  if (typeof value === 'number' && Number.isSafeInteger(value) && value > 0) {
    return String(value);
  }
  if (typeof value === 'string') {
    const normalized = value.trim().toLowerCase().replace(/^comment:/, '');
    if (normalized.length > 0) return normalized;
  }
  return null;
}

function isValidExecutionAuthorityReference(value) {
  const normalized = normalizeExecutionAuthorityReference(value);
  if (!normalized || !EXECUTION_AUTHORITY_RE.test(normalized)) return false;
  // The SOURCE/TEST implementation provenance can never be live authority.
  if (normalized === String(SOURCE_TEST_IMPLEMENTATION_COMMENT)) return false;
  return true;
}

// Classify a DSN host as a Neon endpoint host and extract its endpoint id.
// Returns null when the host is not on the Neon-managed domain at all. The
// pooler suffix is normalized away so pooled and direct hosts bind to the same
// endpoint identity.
function classifyNeonEndpointHost(host) {
  if (typeof host !== 'string') return null;
  const normalized = host.trim().toLowerCase().replace(/\.+$/, '');
  if (normalized.length === 0) return null;
  if (!normalized.endsWith(NEON_MANAGED_DOMAIN_SUFFIX)) return null;
  const labels = normalized.split('.');
  // <endpoint>.<region label...>.neon.tech — a bare "neon.tech" is not an
  // endpoint host and is rejected.
  if (labels.length < 3) return null;
  const first = labels[0];
  if (!first) return null;
  const endpointId = first.endsWith(NEON_ENDPOINT_POOLER_SUFFIX)
    ? first.slice(0, -NEON_ENDPOINT_POOLER_SUFFIX.length)
    : first;
  if (!NEON_ENDPOINT_LABEL_RE.test(endpointId)) return null;
  return Object.freeze({ endpointId });
}

// True only for the canonical endpoint identity on the Neon-managed domain.
function isCanonicalNeonEndpointHost(host) {
  const classified = classifyNeonEndpointHost(host);
  return !!classified && classified.endpointId === CANONICAL_NEON_ENDPOINT_IDENTITY;
}

// The single frozen bootstrap PROVENANCE binding (category A above). These
// values are the exact repository facts recorded in
// db/migration-provenance/canonical-migrations.json,
// db/migration-provenance/expected-schema-manifest.json, and
// db/migration-provenance/ledger-contract.json. They are never read from the
// environment, caller input, or any network source. This object carries NO
// execution authority.
const BOOTSTRAP = Object.freeze({
  issue: 3846,
  sourceTestImplementationComment: SOURCE_TEST_IMPLEMENTATION_COMMENT,
  migrationId: '20260802094500_bootstrap-migration-ledger',
  migrationPath: 'db/migrations/20260802094500_bootstrap-migration-ledger.sql',
  migrationSha256: 'c04d6e8cf074514e1835cd837f6ae72ccd96b775a507a12d2b394733977918cc',
  expectedSchemaFingerprint:
    '961d195776eaa245e4e63620a35f19a4de2dbe2f00dbd8b94faffb70ce2332d1',
  relation: 'public.schema_migration_ledger',
  schema: 'public',
  relationName: 'schema_migration_ledger',
  approvalReference: 'issue:3846',
  riskClass: 'ADDITIVE',
  transactionMode: 'REQUIRED',
});

// Fixed, sanitized error categories. Raw driver errors, DSNs, credentials,
// and catalog payloads are NEVER included in messages.
const TRANSPORT_FAILURE = Object.freeze({
  LOCK_KEY_INVALID: 'LEDGER_BOOTSTRAP_LOCK_KEY_INVALID',
  SECRET_UNAVAILABLE: 'LEDGER_BOOTSTRAP_SECRET_UNAVAILABLE',
  SECRET_MALFORMED: 'LEDGER_BOOTSTRAP_SECRET_MALFORMED',
  CONNECT_UNAVAILABLE: 'LEDGER_BOOTSTRAP_CONNECT_UNAVAILABLE',
  LOCK_QUERY_FAILED: 'LEDGER_BOOTSTRAP_LOCK_QUERY_FAILED',
  TX_REQUIRED: 'LEDGER_BOOTSTRAP_TX_REQUIRED',
  TX_BEGIN_FAILED: 'LEDGER_BOOTSTRAP_TX_BEGIN_FAILED',
  APPLY_AMBIGUOUS: 'LEDGER_BOOTSTRAP_APPLY_AMBIGUOUS',
  MIGRATION_NOT_ALLOWLISTED: 'LEDGER_BOOTSTRAP_MIGRATION_NOT_ALLOWLISTED',
  CHECKSUM_MISMATCH: 'LEDGER_BOOTSTRAP_CHECKSUM_MISMATCH',
  APPLY_FAILED: 'LEDGER_BOOTSTRAP_APPLY_FAILED',
  RELATION_INVALID: 'LEDGER_BOOTSTRAP_RELATION_INVALID',
  FINGERPRINT_INVALID: 'LEDGER_BOOTSTRAP_FINGERPRINT_INVALID',
  CATALOG_QUERY_FAILED: 'LEDGER_BOOTSTRAP_CATALOG_QUERY_FAILED',
  ROLE_MAPPING_UNAVAILABLE: 'LEDGER_BOOTSTRAP_ROLE_MAPPING_UNAVAILABLE',
  LEDGER_PAYLOAD_INVALID: 'LEDGER_BOOTSTRAP_LEDGER_PAYLOAD_INVALID',
  DEPLOYED_COMMIT_UNAVAILABLE: 'LEDGER_BOOTSTRAP_DEPLOYED_COMMIT_UNAVAILABLE',
  EXECUTION_AUTHORITY_INVALID: 'LEDGER_BOOTSTRAP_EXECUTION_AUTHORITY_INVALID',
  EXECUTION_HEAD_UNBOUND: 'LEDGER_BOOTSTRAP_EXECUTION_HEAD_UNBOUND',
  ENDPOINT_IDENTITY_MISMATCH: 'LEDGER_BOOTSTRAP_ENDPOINT_IDENTITY_MISMATCH',
  CONNECTED_TARGET_IDENTITY_MISMATCH: 'LEDGER_BOOTSTRAP_CONNECTED_TARGET_IDENTITY_MISMATCH',
  CONNECTED_TARGET_IDENTITY_UNAVAILABLE: 'LEDGER_BOOTSTRAP_CONNECTED_TARGET_IDENTITY_UNAVAILABLE',
  IDENTITY_NOT_VERIFIED: 'LEDGER_BOOTSTRAP_IDENTITY_NOT_VERIFIED',
});

const HEX16_RE = /^[0-9a-f]{16}$/;
const HEX64_RE = /^[0-9a-f]{64}$/;
const HEX40_RE = /^[0-9a-f]{40}$/;
const LEDGER_PAYLOAD_KEYS = Object.freeze([
  'issue',
  'executionAuthorityReference',
  'executionHead',
  'migrationId',
  'migrationSha256',
  'targetIdentity',
  'relation',
  'fingerprint',
]);

function failFixed(code) {
  const err = new Error(code);
  err.category = code;
  return err;
}

function isStrictObject(v) {
  return !!v && typeof v === 'object' && !Array.isArray(v);
}

/**
 * Whitelist the ledger adapter's append status into a bounded enum.
 *
 * The adapter is total and returns a fixed `{ status }` of
 * APPENDED | FAILED | UNKNOWN. That status is the only thing preserved here:
 * anything that is not exactly one of the three fixed literals collapses to
 * UNKNOWN, and a throwing/revoked Proxy accessor collapses to UNKNOWN as well.
 * This is a SOURCE/TEST diagnostic so a failed append can be told apart from an
 * unavailable one. No raw query error, row, result, handle, session, host, or
 * credential value is ever propagated.
 */
function boundedLedgerAppendStatus(append) {
  const STATUSES = LEDGER_ADAPTER.POSTGRES_LEDGER_APPEND_STATUSES;
  let raw = '';
  try {
    if (append !== null && typeof append === 'object' && typeof append.status === 'string') {
      raw = append.status;
    }
  } catch {
    raw = '';
  }
  if (raw === STATUSES.APPENDED) return STATUSES.APPENDED;
  if (raw === STATUSES.FAILED) return STATUSES.FAILED;
  return STATUSES.UNKNOWN;
}

function sha256Buffer(buf) {
  return crypto.createHash('sha256').update(buf).digest('hex');
}

// Trusted local repository HEAD resolver used for the ledger deployed_commit
// field. Fails closed (null) on any git/process error.
function resolveTrustedLocalRepoHead(repoRoot) {
  const cwd = repoRoot || ROOT;
  try {
    const childProcess = require('node:child_process');
    const out = childProcess.execFileSync('git', ['rev-parse', 'HEAD'], {
      cwd,
      encoding: 'utf8',
      timeout: 5000,
      maxBuffer: 1024,
      stdio: ['ignore', 'pipe', 'ignore'],
    }).trim();
    if (HEX40_RE.test(out.toLowerCase())) {
      return out.toLowerCase();
    }
  } catch {
    // Fail closed on any execution/process error
  }
  return null;
}

// Split a 16-hex lock key into two int32 halves for the two-argument
// pg_try_advisory_lock form. Deterministic, parameterized, no interpolation.
function lockKeyHalves(lockKey) {
  const a = parseInt(lockKey.slice(0, 8), 16) | 0;
  const b = parseInt(lockKey.slice(8, 16), 16) | 0;
  return [a, b];
}

/**
 * Create a bounded ledger-bootstrap transport.
 *
 * options (all optional; defaults are the production wiring):
 *   createClient(pgConfig) - client factory (tests inject a fake driver).
 *   env                    - credential source map (default process.env).
 *   roleMapping            - fixed grantee-class map (otherwise loaded from
 *                            the .secrets-relative file named by
 *                            LOVEBUD_LEDGER_BOOTSTRAP_ROLE_MAPPING_FILE).
 *   resolveDeployedCommit  - 40-hex repo-head resolver (default: trusted local HEAD).
 *   now                    - canonical UTC clock (default new Date().toISOString()).
 *   repoRoot               - repository root (default: fixed repo root).
 */
function createLedgerBootstrapTransport(options) {
  const opts = isStrictObject(options) ? options : {};
  const env = isStrictObject(opts.env) ? opts.env : process.env;
  const repoRoot = typeof opts.repoRoot === 'string' && opts.repoRoot ? opts.repoRoot : ROOT;
  const resolveDeployedCommit =
    typeof opts.resolveDeployedCommit === 'function'
      ? opts.resolveDeployedCommit
      : resolveTrustedLocalRepoHead;
  const now = typeof opts.now === 'function' ? opts.now : () => new Date().toISOString();

  const state = {
    client: null,
    handle: null,
    connectAttempted: false,
    txOpen: false,
    identityVerified: false,
    roleMapping: isStrictObject(opts.roleMapping) ? opts.roleMapping : null,
    roleMap: null,
    contract: null,
  };

  function defaultCreateClient(pgConfig) {
    // Lazy: the driver is loaded ONLY here, ONLY at real connect time.
    const { Client } = require('pg');
    return new Client(pgConfig);
  }
  const createClient = typeof opts.createClient === 'function' ? opts.createClient : defaultCreateClient;

  function resolvePgConfig() {
    const raw = env[CREDENTIAL_ENV_KEY];
    if (typeof raw !== 'string' || raw.trim().length === 0) {
      throw failFixed(TRANSPORT_FAILURE.SECRET_UNAVAILABLE);
    }
    let pgConfig;
    try {
      pgConfig = BOUNDARY.parseProductionReadonlyDatabaseUrl(raw);
    } catch {
      throw failFixed(TRANSPORT_FAILURE.SECRET_MALFORMED);
    }
    // Target-binding guard, provably PRE-CONNECT: a well-formed DSN aimed at a
    // different Neon endpoint must never open a connection at all. This runs
    // before createClient(), so the connection count stays zero.
    if (!isCanonicalNeonEndpointHost(pgConfig.host)) {
      throw failFixed(TRANSPORT_FAILURE.ENDPOINT_IDENTITY_MISMATCH);
    }
    return pgConfig;
  }

  async function ensureConnection() {
    if (state.client) return state.client;
    if (state.connectAttempted) {
      // ONE connect attempt per transport instance. Never retry.
      throw failFixed(TRANSPORT_FAILURE.CONNECT_UNAVAILABLE);
    }
    state.connectAttempted = true;
    const pgConfig = resolvePgConfig(); // fails pre-connect on missing/malformed secret
    let client;
    try {
      client = createClient(pgConfig);
    } catch {
      throw failFixed(TRANSPORT_FAILURE.CONNECT_UNAVAILABLE);
    }
    try {
      await client.connect();
    } catch {
      try {
        await client.end();
      } catch {
        /* best-effort cleanup only */
      }
      throw failFixed(TRANSPORT_FAILURE.CONNECT_UNAVAILABLE);
    }
    state.client = client;
    return client;
  }

  async function closeConnection() {
    const client = state.client;
    state.client = null;
    state.handle = null;
    state.txOpen = false;
    // The verified identity belongs to the connection: losing the connection
    // invalidates it, so a later lock/transaction cannot rely on a stale pass.
    state.identityVerified = false;
    if (client) {
      try {
        await client.end();
      } catch {
        /* best-effort disconnect */
      }
    }
  }

  function roleMappingForVerify() {
    if (state.roleMap) return state.roleMap;
    let plain = state.roleMapping;
    if (!plain) {
      try {
        plain = BOUNDARY.loadProductionRoleMapping(repoRoot, env[ROLE_MAPPING_ENV_KEY]);
      } catch {
        throw failFixed(TRANSPORT_FAILURE.ROLE_MAPPING_UNAVAILABLE);
      }
    }
    try {
      // The adapter consumes a Map of validated grantee classes.
      state.roleMap = adapter().validateRoleMapping(plain);
    } catch {
      throw failFixed(TRANSPORT_FAILURE.ROLE_MAPPING_UNAVAILABLE);
    }
    return state.roleMap;
  }

  /**
   * Connected-target identity gate. Opens the ONE permitted connection (if not
   * already open) and proves the ACTUALLY CONNECTED target before any advisory
   * lock, BEGIN, migration SQL, or ledger write.
   *
   *   A. pre-connect: the DSN host is already bound to the canonical Neon
   *      endpoint by resolvePgConfig() — a wrong endpoint throws there and
   *      never reaches this method with a connection.
   *   B. post-connect: current_database() must be the canonical database.
   *   C. post-connect: current_user must resolve through the approved private
   *      role mapping to OWNER_CLASS.
   *
   * Returns bounded facts only (booleans + the class label). Raw host,
   * database, and role values are never returned, thrown, or logged.
   */
  async function verifyConnectedTargetIdentity() {
    // The approved private role mapping is a PRECONNECT input. Resolve it
    // BEFORE the connection opens, so a missing/invalid mapping fails closed
    // without ever costing the CENTRAL authority (ROLE_MAPPING_UNAVAILABLE is
    // a preconnect category in the operator).
    const roleMap = roleMappingForVerify();
    const client = await ensureConnection();
    let res;
    try {
      res = await client.query(CONNECTED_IDENTITY_QUERY);
    } catch {
      await closeConnection();
      throw failFixed(TRANSPORT_FAILURE.CONNECTED_TARGET_IDENTITY_UNAVAILABLE);
    }
    const row = res && Array.isArray(res.rows) && res.rows.length === 1 ? res.rows[0] : null;
    if (
      !row ||
      typeof row.database_name !== 'string' ||
      typeof row.role_name !== 'string' ||
      row.database_name.length === 0 ||
      row.role_name.length === 0
    ) {
      // Malformed identity result: fail closed, never echo the payload.
      await closeConnection();
      throw failFixed(TRANSPORT_FAILURE.CONNECTED_TARGET_IDENTITY_UNAVAILABLE);
    }
    const databaseVerified = row.database_name === CANONICAL_TARGET_IDENTITY.database;
    const mapped = roleMap.get(row.role_name.toLowerCase());
    const roleClass = typeof mapped === 'string' ? mapped : null;
    const roleClassVerified = roleClass === EXPECTED_CONNECTED_ROLE_CLASS;
    if (!databaseVerified || !roleClassVerified) {
      // DB-capable execution already began: fail closed, connection released,
      // no lock, no BEGIN, no DDL. Caller keeps the authority consumed.
      await closeConnection();
      throw failFixed(TRANSPORT_FAILURE.CONNECTED_TARGET_IDENTITY_MISMATCH);
    }
    // Bounded facts only: booleans and the class label. Never the raw values.
    state.identityVerified = true;
    return Object.freeze({
      ok: true,
      databaseVerified: true,
      roleClassVerified: true,
      roleClass: EXPECTED_CONNECTED_ROLE_CLASS,
    });
  }

  function contractForVerify() {
    if (!state.contract) {
      state.contract = adapter().loadContract(repoRoot);
    }
    return state.contract;
  }

  // ---- Bounded transport surface -------------------------------------

  async function acquireAdvisoryLock(lockKey) {
    if (typeof lockKey !== 'string' || !HEX16_RE.test(lockKey)) {
      throw failFixed(TRANSPORT_FAILURE.LOCK_KEY_INVALID);
    }
    // Structural ordering guard: the connected target identity must already be
    // proven on this connection. The advisory lock — and therefore every
    // transaction, migration apply, and ledger write behind it — is unreachable
    // until the identity gate has passed.
    if (!state.identityVerified) {
      throw failFixed(TRANSPORT_FAILURE.IDENTITY_NOT_VERIFIED);
    }
    const client = await ensureConnection();
    const [a, b] = lockKeyHalves(lockKey);
    let res;
    try {
      res = await client.query('SELECT pg_try_advisory_lock($1::integer, $2::integer) AS locked', [a, b]);
    } catch {
      await closeConnection();
      throw failFixed(TRANSPORT_FAILURE.LOCK_QUERY_FAILED);
    }
    const row = res && Array.isArray(res.rows) && res.rows.length === 1 ? res.rows[0] : null;
    if (!row || row.locked !== true) {
      // Not acquired: NO retry. Release the connection and report null so the
      // operator core stops with STOP_ADVISORY_LOCK_UNAVAILABLE.
      await closeConnection();
      return null;
    }
    const handle = Object.freeze({
      acquireAdvisoryLockHandleBrand: true,
      keyA: a,
      keyB: b,
    });
    state.handle = handle;
    return handle;
  }

  async function releaseAdvisoryLock(handle) {
    const validHandle =
      isStrictObject(handle) && handle.acquireAdvisoryLockHandleBrand === true && handle === state.handle;
    const client = state.client;
    if (validHandle && client) {
      try {
        await client.query('SELECT pg_advisory_unlock($1::integer, $2::integer)', [handle.keyA, handle.keyB]);
      } catch {
        /* best-effort unlock; connection end releases session locks anyway */
      }
    }
    await closeConnection();
  }

  function requireActiveHandle() {
    if (!state.handle || !state.client) {
      throw failFixed(TRANSPORT_FAILURE.TX_REQUIRED);
    }
  }

  async function rollbackQuietly(client) {
    try {
      await client.query('ROLLBACK');
      return true;
    } catch {
      return false;
    }
  }

  async function withTransaction(fn) {
    if (typeof fn !== 'function') {
      throw failFixed(TRANSPORT_FAILURE.TX_REQUIRED);
    }
    requireActiveHandle();
    if (state.txOpen) {
      // ONE transaction attempt per lock session. Never nest/retry.
      throw failFixed(TRANSPORT_FAILURE.TX_REQUIRED);
    }
    const client = state.client;
    try {
      await client.query('BEGIN');
    } catch {
      throw failFixed(TRANSPORT_FAILURE.TX_BEGIN_FAILED);
    }
    state.txOpen = true;
    let outcome;
    try {
      outcome = await fn(txApi);
    } catch {
      // Callback failure: ROLLBACK. If rollback itself fails, the outcome is
      // ambiguous and cannot be inferred: throw sanitized, no retry.
      const rolledBack = await rollbackQuietly(client);
      state.txOpen = false;
      if (!rolledBack) {
        throw failFixed(TRANSPORT_FAILURE.APPLY_AMBIGUOUS);
      }
      return Object.freeze({ ok: false, reason: TRANSPORT_FAILURE.APPLY_FAILED });
    }
    if (isStrictObject(outcome) && outcome.ok === true) {
      try {
        await client.query('COMMIT');
        state.txOpen = false;
        return Object.freeze({ ok: true });
      } catch {
        state.txOpen = false;
        // COMMIT outcome cannot be inferred: ambiguous, never retried.
        throw failFixed(TRANSPORT_FAILURE.APPLY_AMBIGUOUS);
      }
    }
    const rolledBack = await rollbackQuietly(client);
    state.txOpen = false;
    if (!rolledBack) {
      throw failFixed(TRANSPORT_FAILURE.APPLY_AMBIGUOUS);
    }
    const reason =
      isStrictObject(outcome) && typeof outcome.reason === 'string' && outcome.reason
        ? outcome.reason
        : TRANSPORT_FAILURE.APPLY_FAILED;
    return Object.freeze({ ok: false, reason });
  }

  async function applyMigration(tx, spec) {
    if (!isStrictObject(tx) || tx.ledgerBootstrapTxBrand !== true || tx !== txApi) {
      throw failFixed(TRANSPORT_FAILURE.TX_REQUIRED);
    }
    requireActiveHandle();
    if (!state.txOpen) {
      // Apply is only valid inside the open bootstrap transaction.
      throw failFixed(TRANSPORT_FAILURE.TX_REQUIRED);
    }
    if (!isStrictObject(spec)) {
      throw failFixed(TRANSPORT_FAILURE.MIGRATION_NOT_ALLOWLISTED);
    }
    // Single binding: the exact bootstrap path and nothing else.
    if (spec.path !== BOOTSTRAP.migrationPath) {
      throw failFixed(TRANSPORT_FAILURE.MIGRATION_NOT_ALLOWLISTED);
    }
    const wantSha = typeof spec.sha256 === 'string' ? spec.sha256.toLowerCase() : '';
    if (!HEX64_RE.test(wantSha) || wantSha !== BOOTSTRAP.migrationSha256) {
      throw failFixed(TRANSPORT_FAILURE.CHECKSUM_MISMATCH);
    }
    const rootAbs = path.resolve(repoRoot);
    const abs = path.resolve(rootAbs, BOOTSTRAP.migrationPath);
    if (!abs.startsWith(rootAbs + path.sep)) {
      throw failFixed(TRANSPORT_FAILURE.MIGRATION_NOT_ALLOWLISTED);
    }
    let bytes;
    try {
      bytes = fs.readFileSync(abs);
    } catch {
      throw failFixed(TRANSPORT_FAILURE.CHECKSUM_MISMATCH);
    }
    if (sha256Buffer(bytes) !== BOOTSTRAP.migrationSha256) {
      // Local file bytes no longer match the bound checksum: fail closed,
      // zero SQL sent.
      throw failFixed(TRANSPORT_FAILURE.CHECKSUM_MISMATCH);
    }
    try {
      await state.client.query(bytes.toString('utf8'));
    } catch {
      // A failed statement inside the open transaction aborts it; commit is
      // definitively unreachable: pre-commit failure, not an ambiguous outcome.
      return Object.freeze({ committed: false, reason: TRANSPORT_FAILURE.APPLY_FAILED });
    }
    return Object.freeze({ committed: true });
  }

  function allowedRelation(relation) {
    if (typeof relation !== 'string') return null;
    return relation === BOOTSTRAP.relation ? BOOTSTRAP : null;
  }

  async function catalogTableKind(relation) {
    const entry = allowedRelation(relation);
    if (!entry) {
      throw failFixed(TRANSPORT_FAILURE.RELATION_INVALID);
    }
    requireActiveHandle();
    let res;
    try {
      res = await state.client.query(adapter().Q.RELATION, [entry.schema, entry.relationName]);
    } catch {
      throw failFixed(TRANSPORT_FAILURE.CATALOG_QUERY_FAILED);
    }
    const classification = adapter().classifyTargetPresenceRelationRows(res.rows, 'TABLE');
    return Object.freeze({ present: classification.presence === 'TARGET_PRESENT' });
  }

  async function verifyCatalog(relation, fingerprint) {
    const entry = allowedRelation(relation);
    if (!entry) {
      throw failFixed(TRANSPORT_FAILURE.RELATION_INVALID);
    }
    if (typeof fingerprint !== 'string' || !HEX64_RE.test(fingerprint)) {
      throw failFixed(TRANSPORT_FAILURE.FINGERPRINT_INVALID);
    }
    requireActiveHandle();
    let relationResult;
    try {
      relationResult = await state.client.query(adapter().Q.RELATION, [entry.schema, entry.relationName]);
      const presence = adapter().classifyTargetPresenceRelationRows(relationResult.rows, 'TABLE');
      if (presence.presence === 'TARGET_ABSENT') {
        return Object.freeze({ matched: false, reason: 'TARGET_NOT_FOUND' });
      }
    } catch {
      throw failFixed(TRANSPORT_FAILURE.CATALOG_QUERY_FAILED);
    }

    const roleMap = roleMappingForVerify();
    const contract = contractForVerify();
    let actual = null;
    try {
      const rawObject = await adapter().fetchRawObject(
        state.client,
        { schema: entry.schema, object_name: entry.relationName, object_kind: 'TABLE' },
        roleMap
      );
      const metadata = adapter().toCanonicalMetadata([rawObject], contract);
      const evidence = adapter().buildCatalogEvidence(metadata, contract);
      const single = evidence.objects && evidence.objects[0];
      actual = single ? single.fingerprint : null;
    } catch {
      throw failFixed(TRANSPORT_FAILURE.CATALOG_QUERY_FAILED);
    }
    const matched = actual === `sha256:${fingerprint}`;
    // Bounded facts only: no role names, DSNs, or raw ACL rows are returned.
    return Object.freeze({ matched });
  }

  async function writeLedger(payload) {
    if (!isStrictObject(payload)) {
      throw failFixed(TRANSPORT_FAILURE.LEDGER_PAYLOAD_INVALID);
    }
    const payloadKeys = Object.keys(payload);
    if (
      payloadKeys.length !== LEDGER_PAYLOAD_KEYS.length ||
      LEDGER_PAYLOAD_KEYS.some((key) => !payloadKeys.includes(key))
    ) {
      throw failFixed(TRANSPORT_FAILURE.LEDGER_PAYLOAD_INVALID);
    }
    requireActiveHandle();
    if (!state.txOpen) {
      // Ledger append is only valid inside the open bootstrap transaction.
      throw failFixed(TRANSPORT_FAILURE.TX_REQUIRED);
    }
    // Payload must bind to the exact bootstrap migration identity.
    if (payload.relation !== BOOTSTRAP.relation || payload.migrationId !== BOOTSTRAP.migrationId) {
      throw failFixed(TRANSPORT_FAILURE.LEDGER_PAYLOAD_INVALID);
    }
    const sha = typeof payload.migrationSha256 === 'string' ? payload.migrationSha256.toLowerCase() : '';
    if (!HEX64_RE.test(sha) || sha !== BOOTSTRAP.migrationSha256) {
      throw failFixed(TRANSPORT_FAILURE.LEDGER_PAYLOAD_INVALID);
    }
    if (payload.issue !== BOOTSTRAP.issue) {
      throw failFixed(TRANSPORT_FAILURE.LEDGER_PAYLOAD_INVALID);
    }
    // Live CENTRAL Production execution authority (category B). It must be
    // present, well-formed, and distinct from the SOURCE/TEST implementation
    // provenance comment — that comment is never a mutation authority and is
    // never written into an attestation as one.
    if (!isValidExecutionAuthorityReference(payload.executionAuthorityReference)) {
      throw failFixed(TRANSPORT_FAILURE.EXECUTION_AUTHORITY_INVALID);
    }
    // The attestation must be bound to the exact authorized execution head.
    const executionHead =
      typeof payload.executionHead === 'string' ? payload.executionHead.toLowerCase() : '';
    if (!HEX40_RE.test(executionHead)) {
      throw failFixed(TRANSPORT_FAILURE.EXECUTION_HEAD_UNBOUND);
    }
    const t = payload.targetIdentity;
    if (
      !isStrictObject(t) ||
      t.product_shared !== CANONICAL_TARGET_IDENTITY.product_shared ||
      t.environment_class !== CANONICAL_TARGET_IDENTITY.environment_class ||
      t.database !== CANONICAL_TARGET_IDENTITY.database
    ) {
      throw failFixed(TRANSPORT_FAILURE.LEDGER_PAYLOAD_INVALID);
    }
    if (
      typeof payload.fingerprint !== 'string' ||
      !HEX64_RE.test(payload.fingerprint) ||
      payload.fingerprint.toLowerCase() !== BOOTSTRAP.expectedSchemaFingerprint
    ) {
      throw failFixed(TRANSPORT_FAILURE.LEDGER_PAYLOAD_INVALID);
    }
    const deployedCommit = resolveDeployedCommit(repoRoot);
    if (typeof deployedCommit !== 'string' || !HEX40_RE.test(deployedCommit)) {
      throw failFixed(TRANSPORT_FAILURE.DEPLOYED_COMMIT_UNAVAILABLE);
    }
    if (executionHead !== deployedCommit) {
      // The attestation is not bound to the exact authorized execution head.
      throw failFixed(TRANSPORT_FAILURE.EXECUTION_HEAD_UNBOUND);
    }
    // The fixed seven-field record carries NO authorization comment: the
    // SOURCE/TEST provenance comment is never written as mutation authority,
    // and the live execution authority is bound by the validation above rather
    // than by any ledger column.
    const client = state.client;
    const ledgerAdapter = LEDGER_ADAPTER.createPostgresMigrationLedgerAdapter({
      queryLockedSession: async ({ query }) => {
        // Fixed named query text + frozen values only; the session is the
        // single already-locked connection with the open transaction.
        return client.query(query.text, query.values);
      },
    });
    const record = {
      migration_id: BOOTSTRAP.migrationId,
      content_checksum: `sha256:${BOOTSTRAP.migrationSha256}`,
      applied_at: now(),
      runner_version: RUNNER_VERSION,
      environment_class: CANONICAL_TARGET_IDENTITY.environment_class,
      deployed_commit: deployedCommit,
      transaction_outcome: 'COMMITTED',
    };
    const append = await ledgerAdapter.appendLedgerRecord({ record, lockHandle: state.handle });
    // Bounded SOURCE/TEST diagnostic: preserve the adapter's fixed status class
    // (APPENDED | FAILED | UNKNOWN) so a FAILED append is distinguishable from an
    // UNKNOWN one without ever exposing a raw error, row, or session value.
    // Production behaviour is unchanged — anything other than APPENDED still
    // fails closed with recorded:false.
    const appendStatus = boundedLedgerAppendStatus(append);
    if (appendStatus === LEDGER_ADAPTER.POSTGRES_LEDGER_APPEND_STATUSES.APPENDED) {
      return Object.freeze({ recorded: true, ledgerAppendStatus: appendStatus });
    }
    return Object.freeze({ recorded: false, ledgerAppendStatus: appendStatus });
  }

  const txApi = Object.freeze({
    ledgerBootstrapTxBrand: true,
    catalogTableKind,
    verifyCatalog,
    writeLedger,
  });

  return Object.freeze({
    acquireAdvisoryLock,
    releaseAdvisoryLock,
    withTransaction,
    applyMigration,
    verifyCatalog,
    writeLedger,
    verifyConnectedTargetIdentity,
  });
}

const defaultTransport = createLedgerBootstrapTransport();

// The module itself IS the default bounded transport (so the operator CLI can
// require this fixed repository path directly). The factory and bounded
// metadata are attached as inert, non-forbidden surface for tests.
module.exports = Object.freeze({
  ...defaultTransport,
  createLedgerBootstrapTransport,
  TRANSPORT_FAILURE,
  BOOTSTRAP,
  CANONICAL_TARGET_IDENTITY,
  SOURCE_TEST_IMPLEMENTATION_COMMENT,
  EXECUTION_AUTHORITY_RE,
  normalizeExecutionAuthorityReference,
  isValidExecutionAuthorityReference,
  CREDENTIAL_ENV_KEY,
  ROLE_MAPPING_ENV_KEY,
  RUNNER_VERSION,
  resolveTrustedLocalRepoHead,
  CANONICAL_NEON_ENDPOINT_IDENTITY,
  NEON_MANAGED_DOMAIN_SUFFIX,
  EXPECTED_CONNECTED_ROLE_CLASS,
  CONNECTED_IDENTITY_QUERY,
  classifyNeonEndpointHost,
  isCanonicalNeonEndpointHost,
});
