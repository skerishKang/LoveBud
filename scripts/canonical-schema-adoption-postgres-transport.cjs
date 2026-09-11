'use strict';

/**
 * Repository-owned bounded schema-adoption Postgres transport (#4371).
 *
 * The ONLY transport surface the canonical schema-adoption operator CLI may
 * load. Implements exactly the bounded interface validated by validateTransport
 * in scripts/canonical-schema-adoption-operator-core.cjs:
 *   acquireAdvisoryLock(lockKey) -> handle | null
 *   releaseAdvisoryLock(handle)  -> void (best-effort)
 *   withTransaction(fn)          -> { ok, reason? } (BEGIN/COMMIT/ROLLBACK here)
 *   applyMigration(tx, {path,sha256}) -> { committed } (fixed allowlist only)
 *   verifyCatalog(relation, fingerprint) -> { matched } (bounded facts only)
 *   writeLedger(payload)         -> { recorded } (fixed seven-field append only)
 *
 * Hard properties: import is network-inert (pg required lazily at first
 * connect only); ONE connect attempt and ONE transaction attempt per instance,
 * no retry; ambiguous outcomes throw fixed sanitized errors; credentials come
 * only from LOVEBUD_SCHEMA_ADOPTION_DATABASE_URL via the production-readonly
 * boundary parser (TLS required, loopback rejected) and fail before connect
 * when missing/malformed; migration apply is allowlist-only with checksum
 * re-verification against local bytes; no grant/revoke, product rows, drop,
 * runtime gate, provider reroute, arbitrary SQL, or arbitrary module input.
 *
 * Refs #4371, #4346, #4282, #4000, #1882.
 */

const crypto = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');

const CORE = require('./canonical-schema-adoption-operator-core.cjs');
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
const CREDENTIAL_ENV_KEY = 'LOVEBUD_SCHEMA_ADOPTION_DATABASE_URL';
// Role mapping file (.secrets-relative JSON) for catalog grantee classes.
const ROLE_MAPPING_ENV_KEY = 'LOVEBUD_SCHEMA_ADOPTION_ROLE_MAPPING_FILE';

const RUNNER_VERSION = 'canonical-schema-adoption-postgres-transport/1.0.0';

// Fixed, sanitized error categories. Raw driver errors, DSNs, credentials,
// and catalog payloads are NEVER included in messages.
const TRANSPORT_FAILURE = Object.freeze({
  LOCK_KEY_INVALID: 'SCHEMA_ADOPTION_LOCK_KEY_INVALID',
  SECRET_UNAVAILABLE: 'SCHEMA_ADOPTION_SECRET_UNAVAILABLE',
  SECRET_MALFORMED: 'SCHEMA_ADOPTION_SECRET_MALFORMED',
  CONNECT_UNAVAILABLE: 'SCHEMA_ADOPTION_CONNECT_UNAVAILABLE',
  LOCK_QUERY_FAILED: 'SCHEMA_ADOPTION_LOCK_QUERY_FAILED',
  TX_REQUIRED: 'SCHEMA_ADOPTION_TX_REQUIRED',
  TX_BEGIN_FAILED: 'SCHEMA_ADOPTION_TX_BEGIN_FAILED',
  APPLY_AMBIGUOUS: 'SCHEMA_ADOPTION_APPLY_AMBIGUOUS',
  MIGRATION_NOT_ALLOWLISTED: 'SCHEMA_ADOPTION_MIGRATION_NOT_ALLOWLISTED',
  CHECKSUM_MISMATCH: 'SCHEMA_ADOPTION_CHECKSUM_MISMATCH',
  APPLY_FAILED: 'SCHEMA_ADOPTION_APPLY_FAILED',
  RELATION_INVALID: 'SCHEMA_ADOPTION_RELATION_INVALID',
  FINGERPRINT_INVALID: 'SCHEMA_ADOPTION_FINGERPRINT_INVALID',
  CATALOG_QUERY_FAILED: 'SCHEMA_ADOPTION_CATALOG_QUERY_FAILED',
  ROLE_MAPPING_UNAVAILABLE: 'SCHEMA_ADOPTION_ROLE_MAPPING_UNAVAILABLE',
  LEDGER_PAYLOAD_INVALID: 'SCHEMA_ADOPTION_LEDGER_PAYLOAD_INVALID',
  DEPLOYED_COMMIT_UNAVAILABLE: 'SCHEMA_ADOPTION_DEPLOYED_COMMIT_UNAVAILABLE',
});

// Fixed allowlist derived from the frozen operator-core profile bindings.
// No other migration path or checksum can ever be applied by this transport.
const ALLOWED_MIGRATIONS = Object.freeze(
  Object.values(CORE.PROFILES)
    .filter(
      (p) =>
        p &&
        typeof p.migrationPath === 'string' &&
        typeof p.migrationSha256 === 'string' &&
        typeof p.migrationId === 'string' &&
        typeof p.intendedRelation === 'string' &&
        typeof p.expectedSchemaFingerprint === 'string'
    )
    .map((p) =>
      Object.freeze({
        profileKey: p.key,
        issue: p.issue,
        migrationId: p.migrationId,
        migrationPath: p.migrationPath,
        migrationSha256: p.migrationSha256,
        relation: p.intendedRelation,
        schema: p.intendedRelation.split('.')[0],
        relationName: p.intendedRelation.split('.')[1],
        expectedSchemaFingerprint: p.expectedSchemaFingerprint,
      })
    )
);

const MIGRATION_BY_PATH = new Map(ALLOWED_MIGRATIONS.map((m) => [m.migrationPath, m]));
const MIGRATION_BY_RELATION = new Map(ALLOWED_MIGRATIONS.map((m) => [m.relation, m]));

const HEX16_RE = /^[0-9a-f]{16}$/;
const HEX64_RE = /^[0-9a-f]{64}$/;
const HEX40_RE = /^[0-9a-f]{40}$/;
const LEDGER_PAYLOAD_KEYS = Object.freeze([
  'issue',
  'activeAuthorizationComment',
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

function sha256Buffer(buf) {
  return crypto.createHash('sha256').update(buf).digest('hex');
}

// Split a 16-hex lock key into two int32 halves for the two-argument
// pg_try_advisory_lock form. Deterministic, parameterized, no interpolation.
function lockKeyHalves(lockKey) {
  const a = parseInt(lockKey.slice(0, 8), 16) | 0;
  const b = parseInt(lockKey.slice(8, 16), 16) | 0;
  return [a, b];
}

/**
 * Create a bounded schema-adoption transport.
 *
 * options (all optional; defaults are the production wiring):
 *   createClient(pgConfig) - client factory (tests inject a fake driver).
 *   env                    - credential source map (default process.env).
 *   roleMapping            - fixed grantee-class map (otherwise loaded from
 *                            the .secrets-relative file named by
 *                            LOVEBUD_SCHEMA_ADOPTION_ROLE_MAPPING_FILE).
 *   resolveDeployedCommit  - 40-hex repo-head resolver (default: operator-core
 *                            trusted local HEAD resolver).
 *   now                    - canonical UTC clock (default new Date().toISOString()).
 *   repoRoot               - repository root (default: fixed repo root).
 */
function createSchemaAdoptionTransport(options) {
  const opts = isStrictObject(options) ? options : {};
  const env = isStrictObject(opts.env) ? opts.env : process.env;
  const repoRoot = typeof opts.repoRoot === 'string' && opts.repoRoot ? opts.repoRoot : ROOT;
  const resolveDeployedCommit =
    typeof opts.resolveDeployedCommit === 'function'
      ? opts.resolveDeployedCommit
      : CORE.resolveTrustedLocalRepoHead;
  const now = typeof opts.now === 'function' ? opts.now : () => new Date().toISOString();

  const state = {
    client: null,
    handle: null,
    connectAttempted: false,
    txOpen: false,
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
    try {
      return BOUNDARY.parseProductionReadonlyDatabaseUrl(raw);
    } catch {
      throw failFixed(TRANSPORT_FAILURE.SECRET_MALFORMED);
    }
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
    if (!isStrictObject(tx) || tx.schemaAdoptionTxBrand !== true || tx !== txApi) {
      throw failFixed(TRANSPORT_FAILURE.TX_REQUIRED);
    }
    requireActiveHandle();
    if (!state.txOpen) {
      // Apply is only valid inside the open adoption transaction.
      throw failFixed(TRANSPORT_FAILURE.TX_REQUIRED);
    }
    if (!isStrictObject(spec)) {
      throw failFixed(TRANSPORT_FAILURE.MIGRATION_NOT_ALLOWLISTED);
    }
    const entry = MIGRATION_BY_PATH.get(spec.path);
    if (!entry) {
      // Fixed allowlist only: no traversal, no discovery, no arbitrary SQL.
      throw failFixed(TRANSPORT_FAILURE.MIGRATION_NOT_ALLOWLISTED);
    }
    const wantSha = typeof spec.sha256 === 'string' ? spec.sha256.toLowerCase() : '';
    if (!HEX64_RE.test(wantSha) || wantSha !== entry.migrationSha256) {
      throw failFixed(TRANSPORT_FAILURE.CHECKSUM_MISMATCH);
    }
    const rootAbs = path.resolve(repoRoot);
    const abs = path.resolve(rootAbs, entry.migrationPath);
    if (!abs.startsWith(rootAbs + path.sep)) {
      throw failFixed(TRANSPORT_FAILURE.MIGRATION_NOT_ALLOWLISTED);
    }
    let bytes;
    try {
      bytes = fs.readFileSync(abs);
    } catch {
      throw failFixed(TRANSPORT_FAILURE.CHECKSUM_MISMATCH);
    }
    if (sha256Buffer(bytes) !== entry.migrationSha256) {
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
    return MIGRATION_BY_RELATION.get(relation) || null;
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
      // Ledger append is only valid inside the open adoption transaction.
      throw failFixed(TRANSPORT_FAILURE.TX_REQUIRED);
    }
    // Payload must bind to the allowlisted migration identity via relation.
    const relEntry = allowedRelation(payload.relation);
    if (!relEntry || payload.migrationId !== relEntry.migrationId) {
      throw failFixed(TRANSPORT_FAILURE.LEDGER_PAYLOAD_INVALID);
    }
    const sha = typeof payload.migrationSha256 === 'string' ? payload.migrationSha256.toLowerCase() : '';
    if (!HEX64_RE.test(sha) || sha !== relEntry.migrationSha256) {
      throw failFixed(TRANSPORT_FAILURE.LEDGER_PAYLOAD_INVALID);
    }
    if (payload.issue !== relEntry.issue) {
      throw failFixed(TRANSPORT_FAILURE.LEDGER_PAYLOAD_INVALID);
    }
    const profile = CORE.PROFILES[relEntry.profileKey];
    if (!profile || payload.activeAuthorizationComment !== profile.activeAuthorizationComment) {
      throw failFixed(TRANSPORT_FAILURE.LEDGER_PAYLOAD_INVALID);
    }
    const t = payload.targetIdentity;
    if (
      !isStrictObject(t) ||
      t.product_shared !== CORE.CANONICAL_TARGET_IDENTITY.product_shared ||
      t.environment_class !== CORE.CANONICAL_TARGET_IDENTITY.environment_class ||
      t.database !== CORE.CANONICAL_TARGET_IDENTITY.database
    ) {
      throw failFixed(TRANSPORT_FAILURE.LEDGER_PAYLOAD_INVALID);
    }
    if (
      typeof payload.fingerprint !== 'string' ||
      !HEX64_RE.test(payload.fingerprint) ||
      payload.fingerprint.toLowerCase() !== relEntry.expectedSchemaFingerprint
    ) {
      throw failFixed(TRANSPORT_FAILURE.LEDGER_PAYLOAD_INVALID);
    }
    const deployedCommit = resolveDeployedCommit(repoRoot);
    if (typeof deployedCommit !== 'string' || !HEX40_RE.test(deployedCommit)) {
      throw failFixed(TRANSPORT_FAILURE.DEPLOYED_COMMIT_UNAVAILABLE);
    }
    const client = state.client;
    const ledgerAdapter = LEDGER_ADAPTER.createPostgresMigrationLedgerAdapter({
      queryLockedSession: async ({ query }) => {
        // Fixed named query text + frozen values only; the session is the
        // single already-locked connection with the open transaction.
        return client.query(query.text, query.values);
      },
    });
    const record = {
      migration_id: relEntry.migrationId,
      content_checksum: `sha256:${relEntry.migrationSha256}`,
      applied_at: now(),
      runner_version: RUNNER_VERSION,
      environment_class: CORE.CANONICAL_TARGET_IDENTITY.environment_class,
      deployed_commit: deployedCommit,
      transaction_outcome: 'COMMITTED',
    };
    const append = await ledgerAdapter.appendLedgerRecord({ record, lockHandle: state.handle });
    if (append && append.status === LEDGER_ADAPTER.POSTGRES_LEDGER_APPEND_STATUSES.APPENDED) {
      return Object.freeze({ recorded: true });
    }
    return Object.freeze({ recorded: false });
  }

  const txApi = Object.freeze({
    schemaAdoptionTxBrand: true,
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
  });
}

const defaultTransport = createSchemaAdoptionTransport();

// The module itself IS the default bounded transport (so the operator CLI can
// require this fixed repository path directly). The factory and bounded
// metadata are attached as inert, non-forbidden surface for tests.
module.exports = Object.freeze({
  ...defaultTransport,
  createSchemaAdoptionTransport,
  TRANSPORT_FAILURE,
  CREDENTIAL_ENV_KEY,
  ROLE_MAPPING_ENV_KEY,
  RUNNER_VERSION,
  ALLOWED_MIGRATIONS,
});
