// #4093 shared DB transaction-transport compatibility core.
//
// This module is intentionally isolated from normal Product routes. It provides
// explicit transport capability declarations, dedicated non-Production config
// resolution, lazy transport factories, bounded benchmark scenarios, and a
// sanitized result/error contract. Runtime execution is still separately gated
// on owner-approved TEST_ISOLATION_ONLY resources.

export const DB_TRANSPORT = Object.freeze({
  NEON_HTTP: 'neon_http',
  HYPERDRIVE_PG: 'hyperdrive_pg',
  NEON_WS: 'neon_ws',
});

export const DB_TRANSPORT_SCENARIO = Object.freeze({
  ONE_SHOT_SELECT: 'one_shot_select',
  NONINTERACTIVE_ATOMIC_ROLLBACK: 'noninteractive_atomic_rollback',
  INTERACTIVE_BEGIN_COMMIT: 'interactive_begin_commit',
  INTERACTIVE_BEGIN_ROLLBACK: 'interactive_begin_rollback',
  ROW_LOCK_FOR_SHARE: 'row_lock_for_share',
  ROW_LOCK_FOR_UPDATE: 'row_lock_for_update',
  ADVISORY_XACT_LOCK: 'advisory_xact_lock',
});

export const DB_TRANSPORT_ERROR = Object.freeze({
  NONE: 'NONE',
  EXPERIMENT_DISABLED: 'EXPERIMENT_DISABLED',
  NONPROD_ENV_REQUIRED: 'NONPROD_ENV_REQUIRED',
  BENCH_AUTH_REQUIRED: 'BENCH_AUTH_REQUIRED',
  CONFIG_MISSING: 'CONFIG_MISSING',
  CONFIG_INVALID: 'CONFIG_INVALID',
  TRANSPORT_UNSUPPORTED: 'TRANSPORT_UNSUPPORTED',
  SCENARIO_UNSUPPORTED: 'SCENARIO_UNSUPPORTED',
  CAPABILITY_UNSUPPORTED: 'CAPABILITY_UNSUPPORTED',
  REQUEST_INVALID: 'REQUEST_INVALID',
  QUERY_FAILURE: 'QUERY_FAILURE',
  TRANSACTION_ABORTED: 'TRANSACTION_ABORTED',
  LOCK_TIMEOUT_EXPECTED: 'LOCK_TIMEOUT_EXPECTED',
  CONNECTION_FAILURE: 'CONNECTION_FAILURE',
  SANITIZATION_REJECTED: 'SANITIZATION_REJECTED',
  UNEXPECTED_ERROR: 'UNEXPECTED_ERROR',
});

export const DB_TRANSPORT_ENV = Object.freeze({
  ENABLED_FLAG: 'LB_EXPERIMENTAL_DB_TRANSPORT_COMPAT',
  ENVIRONMENT: 'DB_TRANSPORT_COMPAT_ENVIRONMENT',
  BENCH_TOKEN: 'DB_TRANSPORT_COMPAT_BENCH_TOKEN',
  NEON_DATABASE_URL: 'DB_TRANSPORT_COMPAT_NEON_DATABASE_URL',
  HYPERDRIVE_BINDING: 'DB_TRANSPORT_COMPAT_HYPERDRIVE',
});

export const DB_TRANSPORT_REQUIRED_ENVIRONMENT = 'test_isolation_only';
export const DB_TRANSPORT_FIXTURE_TABLE = 'db_transport_compat_4093_fixture';

const POSTGRES_URL = /^postgres(?:ql)?:\/\//i;
const NEON_HOST = /(?:^|\.)neon\.tech$/i;
const LOCK_TIMEOUT_MS = 350;

function frozenCapabilities(value) {
  return Object.freeze({ ...value });
}

export const DB_TRANSPORT_CAPABILITIES = Object.freeze({
  [DB_TRANSPORT.NEON_HTTP]: frozenCapabilities({
    oneShotQuery: true,
    nonInteractiveTransaction: true,
    interactiveTransaction: false,
    requestScopedSession: false,
    rowLocks: false,
    advisoryTransactionLocks: false,
  }),
  [DB_TRANSPORT.HYPERDRIVE_PG]: frozenCapabilities({
    oneShotQuery: true,
    nonInteractiveTransaction: true,
    interactiveTransaction: true,
    requestScopedSession: true,
    rowLocks: true,
    // Cloudflare documents PostgreSQL advisory locks as unsupported through
    // Hyperdrive. Keep this explicit: do not infer support from `pg` itself.
    advisoryTransactionLocks: false,
  }),
  [DB_TRANSPORT.NEON_WS]: frozenCapabilities({
    oneShotQuery: true,
    nonInteractiveTransaction: true,
    interactiveTransaction: true,
    requestScopedSession: true,
    rowLocks: true,
    advisoryTransactionLocks: true,
  }),
});

export const DB_TRANSPORT_IDEMPOTENCY_REQUIREMENTS = Object.freeze({
  semanticDuplicateSerialization: Object.freeze(['interactiveTransaction', 'advisoryTransactionLocks']),
  uniqueConflictCanonicalReread: Object.freeze(['interactiveTransaction']),
  requestKeyReservationReplay: Object.freeze(['interactiveTransaction']),
  databaseDedup: Object.freeze(['interactiveTransaction']),
  optimisticRevisionConvergence: Object.freeze(['interactiveTransaction']),
});

const SCENARIO_CAPABILITY = Object.freeze({
  [DB_TRANSPORT_SCENARIO.ONE_SHOT_SELECT]: 'oneShotQuery',
  [DB_TRANSPORT_SCENARIO.NONINTERACTIVE_ATOMIC_ROLLBACK]: 'nonInteractiveTransaction',
  [DB_TRANSPORT_SCENARIO.INTERACTIVE_BEGIN_COMMIT]: 'interactiveTransaction',
  [DB_TRANSPORT_SCENARIO.INTERACTIVE_BEGIN_ROLLBACK]: 'interactiveTransaction',
  [DB_TRANSPORT_SCENARIO.ROW_LOCK_FOR_SHARE]: 'rowLocks',
  [DB_TRANSPORT_SCENARIO.ROW_LOCK_FOR_UPDATE]: 'rowLocks',
  [DB_TRANSPORT_SCENARIO.ADVISORY_XACT_LOCK]: 'advisoryTransactionLocks',
});

const FIXTURE_SELECT_SQL = `SELECT version, marker FROM ${DB_TRANSPORT_FIXTURE_TABLE} WHERE scenario_key = $1`;
const FIXTURE_INCREMENT_SQL = `UPDATE ${DB_TRANSPORT_FIXTURE_TABLE} SET version = version + 1, updated_at = now() WHERE scenario_key = $1 RETURNING version`;
const FIXTURE_DECREMENT_SQL = `UPDATE ${DB_TRANSPORT_FIXTURE_TABLE} SET version = version - 1, updated_at = now() WHERE scenario_key = $1 RETURNING version`;
const FIXTURE_FOR_SHARE_SQL = `SELECT version FROM ${DB_TRANSPORT_FIXTURE_TABLE} WHERE scenario_key = $1 FOR SHARE`;
const FIXTURE_FOR_UPDATE_SQL = `SELECT version FROM ${DB_TRANSPORT_FIXTURE_TABLE} WHERE scenario_key = $1 FOR UPDATE`;
const ADVISORY_LOCK_SQL = 'SELECT pg_advisory_xact_lock(hashtext($1::text))';
const SET_LOCK_TIMEOUT_SQL = `SET LOCAL lock_timeout = '${LOCK_TIMEOUT_MS}ms'`;

export class DbTransportCompatError extends Error {
  constructor(code, message = code, options = {}) {
    super(message);
    this.name = 'DbTransportCompatError';
    this.code = Object.values(DB_TRANSPORT_ERROR).includes(code) ? code : DB_TRANSPORT_ERROR.UNEXPECTED_ERROR;
    this.status = Number.isInteger(options.status) ? options.status : 500;
    this.expected = options.expected === true;
  }
}

export function getDbTransportCapabilities(transport) {
  return DB_TRANSPORT_CAPABILITIES[transport] || null;
}

export function isKnownDbTransport(transport) {
  return Boolean(getDbTransportCapabilities(transport));
}

export function isKnownDbTransportScenario(scenario) {
  return Object.prototype.hasOwnProperty.call(SCENARIO_CAPABILITY, scenario);
}

export function getDbTransportScenarioSupport(transport, scenario) {
  const capabilities = getDbTransportCapabilities(transport);
  if (!capabilities || !isKnownDbTransportScenario(scenario)) return false;
  const capability = SCENARIO_CAPABILITY[scenario];
  return capabilities[capability] === true;
}

export function isNeonDatabaseUrl(value) {
  if (typeof value !== 'string' || !POSTGRES_URL.test(value)) return false;
  try {
    const parsed = new URL(value);
    return NEON_HOST.test(parsed.hostname);
  } catch {
    return false;
  }
}

function getStringEnv(env, name) {
  return env && typeof env[name] === 'string' ? env[name] : '';
}

export function readDbTransportCompatConfig(env = {}, transport) {
  const enabled = getStringEnv(env, DB_TRANSPORT_ENV.ENABLED_FLAG) === 'true';
  const environment = getStringEnv(env, DB_TRANSPORT_ENV.ENVIRONMENT);
  const benchToken = getStringEnv(env, DB_TRANSPORT_ENV.BENCH_TOKEN);

  const base = {
    enabled,
    environment,
    benchTokenConfigured: benchToken.length > 0,
    transport,
    ready: false,
    connectionString: '',
  };

  if (!enabled || environment !== DB_TRANSPORT_REQUIRED_ENVIRONMENT || !benchToken) {
    return Object.freeze(base);
  }

  if (transport === DB_TRANSPORT.HYPERDRIVE_PG) {
    const binding = env ? env[DB_TRANSPORT_ENV.HYPERDRIVE_BINDING] : null;
    const connectionString = binding && typeof binding.connectionString === 'string'
      ? binding.connectionString
      : '';
    return Object.freeze({
      ...base,
      ready: POSTGRES_URL.test(connectionString),
      connectionString,
    });
  }

  if (transport === DB_TRANSPORT.NEON_HTTP || transport === DB_TRANSPORT.NEON_WS) {
    const connectionString = getStringEnv(env, DB_TRANSPORT_ENV.NEON_DATABASE_URL);
    return Object.freeze({
      ...base,
      ready: isNeonDatabaseUrl(connectionString),
      connectionString,
    });
  }

  return Object.freeze(base);
}

export function timingSafeEqualText(left, right) {
  if (typeof left !== 'string' || typeof right !== 'string') return false;
  const max = Math.max(left.length, right.length);
  let mismatch = left.length ^ right.length;
  for (let i = 0; i < max; i += 1) {
    mismatch |= (left.charCodeAt(i) || 0) ^ (right.charCodeAt(i) || 0);
  }
  return mismatch === 0;
}

function assertStaticParameterizedQuery(text, values) {
  if (typeof text !== 'string' || !text.trim()) {
    throw new DbTransportCompatError(DB_TRANSPORT_ERROR.REQUEST_INVALID, 'query text invalid', { status: 500 });
  }
  if (!Array.isArray(values)) {
    throw new DbTransportCompatError(DB_TRANSPORT_ERROR.REQUEST_INVALID, 'query values invalid', { status: 500 });
  }
}

function rowsFromResult(result) {
  if (Array.isArray(result)) return result;
  if (result && Array.isArray(result.rows)) return result.rows;
  return [];
}

function makeStats() {
  return { queryCount: 0, connectionCount: 0 };
}

function makeSessionWrapper(client, stats) {
  let closed = false;
  return {
    async query(text, values = []) {
      assertStaticParameterizedQuery(text, values);
      stats.queryCount += 1;
      const result = await client.query(text, values);
      return rowsFromResult(result);
    },
    async close() {
      if (closed) return;
      closed = true;
      if (typeof client.end === 'function') await client.end();
    },
  };
}

async function defaultPgImporter() {
  return import('pg');
}

async function defaultNeonImporter() {
  return import('@neondatabase/serverless');
}

export async function createHyperdrivePgTransport({ connectionString, pgImporter = defaultPgImporter } = {}) {
  if (typeof connectionString !== 'string' || !POSTGRES_URL.test(connectionString)) {
    throw new DbTransportCompatError(DB_TRANSPORT_ERROR.CONFIG_INVALID, 'Hyperdrive config invalid', { status: 503 });
  }
  const stats = makeStats();
  const { Client } = await pgImporter();
  if (typeof Client !== 'function') {
    throw new DbTransportCompatError(DB_TRANSPORT_ERROR.CONFIG_INVALID, 'pg Client unavailable', { status: 503 });
  }

  return {
    transport: DB_TRANSPORT.HYPERDRIVE_PG,
    capabilities: DB_TRANSPORT_CAPABILITIES[DB_TRANSPORT.HYPERDRIVE_PG],
    stats,
    async createSession() {
      const client = new Client({ connectionString });
      try {
        await client.connect();
      } catch {
        try { await client.end(); } catch (_) {}
        throw new DbTransportCompatError(DB_TRANSPORT_ERROR.CONNECTION_FAILURE, 'database connection failed', { status: 502 });
      }
      stats.connectionCount += 1;
      return makeSessionWrapper(client, stats);
    },
  };
}

export async function createNeonWsTransport({ connectionString, neonImporter = defaultNeonImporter } = {}) {
  if (!isNeonDatabaseUrl(connectionString)) {
    throw new DbTransportCompatError(DB_TRANSPORT_ERROR.CONFIG_INVALID, 'Neon WS config invalid', { status: 503 });
  }
  const stats = makeStats();
  const { Client } = await neonImporter();
  if (typeof Client !== 'function') {
    throw new DbTransportCompatError(DB_TRANSPORT_ERROR.CONFIG_INVALID, 'Neon Client unavailable', { status: 503 });
  }

  return {
    transport: DB_TRANSPORT.NEON_WS,
    capabilities: DB_TRANSPORT_CAPABILITIES[DB_TRANSPORT.NEON_WS],
    stats,
    async createSession() {
      const client = new Client({ connectionString });
      try {
        await client.connect();
      } catch {
        try { await client.end(); } catch (_) {}
        throw new DbTransportCompatError(DB_TRANSPORT_ERROR.CONNECTION_FAILURE, 'database connection failed', { status: 502 });
      }
      stats.connectionCount += 1;
      return makeSessionWrapper(client, stats);
    },
  };
}

export async function createNeonHttpTransport({ connectionString, neonImporter = defaultNeonImporter } = {}) {
  if (!isNeonDatabaseUrl(connectionString)) {
    throw new DbTransportCompatError(DB_TRANSPORT_ERROR.CONFIG_INVALID, 'Neon HTTP config invalid', { status: 503 });
  }
  const stats = makeStats();
  const { neon } = await neonImporter();
  if (typeof neon !== 'function') {
    throw new DbTransportCompatError(DB_TRANSPORT_ERROR.CONFIG_INVALID, 'Neon HTTP client unavailable', { status: 503 });
  }
  const sql = neon(connectionString, { disableWarningInBrowsers: true });

  return {
    transport: DB_TRANSPORT.NEON_HTTP,
    capabilities: DB_TRANSPORT_CAPABILITIES[DB_TRANSPORT.NEON_HTTP],
    stats,
    async query(text, values = []) {
      assertStaticParameterizedQuery(text, values);
      stats.queryCount += 1;
      return rowsFromResult(await sql.query(text, values));
    },
    async runAtomicRollbackProbe(scenarioKey) {
      const before = await this.query(FIXTURE_SELECT_SQL, [scenarioKey]);
      const beforeVersion = before.length ? Number(before[0].version) : null;
      let transactionFailed = false;
      try {
        // Neon HTTP transaction() is deliberately non-interactive. The callback
        // only builds an array of tagged queries; no result of one statement can
        // drive construction of the next statement.
        stats.queryCount += 2;
        await sql.transaction((txn) => [
          txn`UPDATE db_transport_compat_4093_fixture SET version = version + 1, updated_at = now() WHERE scenario_key = ${scenarioKey}`,
          txn`SELECT 1 / 0 AS force_atomic_rollback`,
        ]);
      } catch {
        transactionFailed = true;
      }
      const after = await this.query(FIXTURE_SELECT_SQL, [scenarioKey]);
      const afterVersion = after.length ? Number(after[0].version) : null;
      return {
        transactionFailed,
        restored: transactionFailed && beforeVersion !== null && beforeVersion === afterVersion,
      };
    },
  };
}

export async function createDbTransportCompatTransport({ transport, connectionString, pgImporter, neonImporter } = {}) {
  if (transport === DB_TRANSPORT.NEON_HTTP) {
    return createNeonHttpTransport({ connectionString, neonImporter });
  }
  if (transport === DB_TRANSPORT.HYPERDRIVE_PG) {
    return createHyperdrivePgTransport({ connectionString, pgImporter });
  }
  if (transport === DB_TRANSPORT.NEON_WS) {
    return createNeonWsTransport({ connectionString, neonImporter });
  }
  throw new DbTransportCompatError(DB_TRANSPORT_ERROR.TRANSPORT_UNSUPPORTED, 'transport unsupported', { status: 422 });
}

function scenarioKeyFor(scenario) {
  if (scenario === DB_TRANSPORT_SCENARIO.ONE_SHOT_SELECT) return 'authority';
  if (scenario === DB_TRANSPORT_SCENARIO.NONINTERACTIVE_ATOMIC_ROLLBACK) return 'rollback';
  if (scenario === DB_TRANSPORT_SCENARIO.INTERACTIVE_BEGIN_COMMIT) return 'read_write';
  if (scenario === DB_TRANSPORT_SCENARIO.INTERACTIVE_BEGIN_ROLLBACK) return 'rollback';
  if (scenario === DB_TRANSPORT_SCENARIO.ROW_LOCK_FOR_SHARE) return 'for_share';
  if (scenario === DB_TRANSPORT_SCENARIO.ROW_LOCK_FOR_UPDATE) return 'for_update';
  if (scenario === DB_TRANSPORT_SCENARIO.ADVISORY_XACT_LOCK) return 'authority';
  return 'authority';
}

async function withSession(transport, fn) {
  const session = await transport.createSession();
  try {
    return await fn(session);
  } finally {
    await session.close();
  }
}

async function runOneShotSelect(transport, scenarioKey) {
  if (typeof transport.query === 'function') {
    const rows = await transport.query(FIXTURE_SELECT_SQL, [scenarioKey]);
    return { rowCount: rows.length };
  }
  return withSession(transport, async (session) => {
    const rows = await session.query(FIXTURE_SELECT_SQL, [scenarioKey]);
    return { rowCount: rows.length };
  });
}

async function runInteractiveCommit(transport, scenarioKey) {
  let beforeVersion = null;
  let committedVersion = null;
  await withSession(transport, async (session) => {
    await session.query('BEGIN', []);
    try {
      const before = await session.query(FIXTURE_SELECT_SQL, [scenarioKey]);
      beforeVersion = before.length ? Number(before[0].version) : null;
      const updated = await session.query(FIXTURE_INCREMENT_SQL, [scenarioKey]);
      committedVersion = updated.length ? Number(updated[0].version) : null;
      await session.query('COMMIT', []);
    } catch (error) {
      try { await session.query('ROLLBACK', []); } catch (_) {}
      throw error;
    }
  });

  const verify = await runOneShotSelect(transport, scenarioKey);
  const committed = beforeVersion !== null && committedVersion === beforeVersion + 1 && verify.rowCount === 1;

  // Restore the synthetic fixture so repeated benchmark invocations start from a
  // stable state. The restoration itself is an explicit transaction and is part
  // of query-count observations, never Product data mutation.
  await withSession(transport, async (session) => {
    await session.query('BEGIN', []);
    try {
      await session.query(FIXTURE_DECREMENT_SQL, [scenarioKey]);
      await session.query('COMMIT', []);
    } catch (error) {
      try { await session.query('ROLLBACK', []); } catch (_) {}
      throw error;
    }
  });
  return { committed };
}

async function runInteractiveRollback(transport, scenarioKey) {
  let beforeVersion = null;
  await withSession(transport, async (session) => {
    await session.query('BEGIN', []);
    try {
      const before = await session.query(FIXTURE_SELECT_SQL, [scenarioKey]);
      beforeVersion = before.length ? Number(before[0].version) : null;
      await session.query(FIXTURE_INCREMENT_SQL, [scenarioKey]);
      await session.query('ROLLBACK', []);
    } catch (error) {
      try { await session.query('ROLLBACK', []); } catch (_) {}
      throw error;
    }
  });
  const afterRows = await (typeof transport.query === 'function'
    ? transport.query(FIXTURE_SELECT_SQL, [scenarioKey])
    : withSession(transport, (session) => session.query(FIXTURE_SELECT_SQL, [scenarioKey])));
  const afterVersion = afterRows.length ? Number(afterRows[0].version) : null;
  return { restored: beforeVersion !== null && beforeVersion === afterVersion };
}

function isLockTimeoutError(error) {
  if (!error) return false;
  if (error.code === '55P03') return true;
  const message = typeof error.message === 'string' ? error.message.toLowerCase() : '';
  return message.includes('lock timeout') || message.includes('canceling statement due to lock timeout');
}

async function runRowLockProbe(transport, scenarioKey, lockSql) {
  const first = await transport.createSession();
  const second = await transport.createSession();
  let blocked = false;
  let reacquired = false;
  try {
    await first.query('BEGIN', []);
    await first.query(lockSql, [scenarioKey]);

    await second.query('BEGIN', []);
    await second.query(SET_LOCK_TIMEOUT_SQL, []);
    try {
      if (lockSql === FIXTURE_FOR_SHARE_SQL) {
        await second.query(FIXTURE_INCREMENT_SQL, [scenarioKey]);
      } else {
        await second.query(FIXTURE_FOR_UPDATE_SQL, [scenarioKey]);
      }
    } catch (error) {
      blocked = isLockTimeoutError(error);
    }
    try { await second.query('ROLLBACK', []); } catch (_) {}
    await first.query('COMMIT', []);

    await second.query('BEGIN', []);
    try {
      await second.query(lockSql, [scenarioKey]);
      reacquired = true;
    } finally {
      await second.query('ROLLBACK', []);
    }
  } finally {
    try { await first.query('ROLLBACK', []); } catch (_) {}
    try { await second.query('ROLLBACK', []); } catch (_) {}
    await Promise.allSettled([first.close(), second.close()]);
  }
  return { blocked, reacquired };
}

async function runAdvisoryLockProbe(transport, scenarioKey) {
  const first = await transport.createSession();
  const second = await transport.createSession();
  let blocked = false;
  let reacquired = false;
  try {
    await first.query('BEGIN', []);
    await first.query(ADVISORY_LOCK_SQL, [scenarioKey]);

    await second.query('BEGIN', []);
    await second.query(SET_LOCK_TIMEOUT_SQL, []);
    try {
      await second.query(ADVISORY_LOCK_SQL, [scenarioKey]);
    } catch (error) {
      blocked = isLockTimeoutError(error);
    }
    try { await second.query('ROLLBACK', []); } catch (_) {}
    await first.query('COMMIT', []);

    await second.query('BEGIN', []);
    try {
      await second.query(ADVISORY_LOCK_SQL, [scenarioKey]);
      reacquired = true;
    } finally {
      await second.query('ROLLBACK', []);
    }
  } finally {
    try { await first.query('ROLLBACK', []); } catch (_) {}
    try { await second.query('ROLLBACK', []); } catch (_) {}
    await Promise.allSettled([first.close(), second.close()]);
  }
  return { blocked, reacquired };
}

function elapsedMs(startedAt) {
  const elapsed = Date.now() - startedAt;
  return Number.isFinite(elapsed) && elapsed >= 0 ? elapsed : 0;
}

export function buildDbTransportCompatResult({
  transport,
  scenario,
  outcome,
  startedAt,
  stats = {},
  lockOutcome = 'not_applicable',
  rollbackOutcome = 'not_applicable',
  errorClass = DB_TRANSPORT_ERROR.NONE,
} = {}) {
  return Object.freeze({
    transport_class: transport,
    scenario,
    outcome,
    latency_ms: elapsedMs(startedAt || Date.now()),
    cpu_ms: null,
    query_count: Number.isInteger(stats.queryCount) ? stats.queryCount : 0,
    connection_count: Number.isInteger(stats.connectionCount) ? stats.connectionCount : 0,
    lock_outcome: lockOutcome,
    rollback_outcome: rollbackOutcome,
    error_class: errorClass,
  });
}

export async function runDbTransportCompatScenario({ transport, scenario, adapter, startedAt = Date.now() } = {}) {
  if (!isKnownDbTransport(transport)) {
    throw new DbTransportCompatError(DB_TRANSPORT_ERROR.TRANSPORT_UNSUPPORTED, 'transport unsupported', { status: 422 });
  }
  if (!isKnownDbTransportScenario(scenario)) {
    throw new DbTransportCompatError(DB_TRANSPORT_ERROR.SCENARIO_UNSUPPORTED, 'scenario unsupported', { status: 422 });
  }

  if (!getDbTransportScenarioSupport(transport, scenario)) {
    return buildDbTransportCompatResult({
      transport,
      scenario,
      outcome: 'expected_unsupported',
      startedAt,
      stats: adapter && adapter.stats,
      errorClass: DB_TRANSPORT_ERROR.CAPABILITY_UNSUPPORTED,
    });
  }

  if (!adapter || adapter.transport !== transport) {
    throw new DbTransportCompatError(DB_TRANSPORT_ERROR.CONFIG_INVALID, 'transport adapter mismatch', { status: 500 });
  }

  const key = scenarioKeyFor(scenario);
  if (scenario === DB_TRANSPORT_SCENARIO.ONE_SHOT_SELECT) {
    const detail = await runOneShotSelect(adapter, key);
    return buildDbTransportCompatResult({
      transport, scenario, outcome: detail.rowCount === 1 ? 'pass' : 'fail', startedAt, stats: adapter.stats,
      errorClass: detail.rowCount === 1 ? DB_TRANSPORT_ERROR.NONE : DB_TRANSPORT_ERROR.QUERY_FAILURE,
    });
  }

  if (scenario === DB_TRANSPORT_SCENARIO.NONINTERACTIVE_ATOMIC_ROLLBACK) {
    if (transport === DB_TRANSPORT.NEON_HTTP) {
      const detail = await adapter.runAtomicRollbackProbe(key);
      return buildDbTransportCompatResult({
        transport,
        scenario,
        outcome: detail.restored ? 'pass' : 'fail',
        startedAt,
        stats: adapter.stats,
        rollbackOutcome: detail.restored ? 'restored' : 'not_restored',
        errorClass: detail.restored ? DB_TRANSPORT_ERROR.NONE : DB_TRANSPORT_ERROR.TRANSACTION_ABORTED,
      });
    }
    const detail = await runInteractiveRollback(adapter, key);
    return buildDbTransportCompatResult({
      transport, scenario, outcome: detail.restored ? 'pass' : 'fail', startedAt, stats: adapter.stats,
      rollbackOutcome: detail.restored ? 'restored' : 'not_restored',
      errorClass: detail.restored ? DB_TRANSPORT_ERROR.NONE : DB_TRANSPORT_ERROR.TRANSACTION_ABORTED,
    });
  }

  if (scenario === DB_TRANSPORT_SCENARIO.INTERACTIVE_BEGIN_COMMIT) {
    const detail = await runInteractiveCommit(adapter, key);
    return buildDbTransportCompatResult({
      transport, scenario, outcome: detail.committed ? 'pass' : 'fail', startedAt, stats: adapter.stats,
      rollbackOutcome: detail.committed ? 'committed' : 'not_restored',
      errorClass: detail.committed ? DB_TRANSPORT_ERROR.NONE : DB_TRANSPORT_ERROR.TRANSACTION_ABORTED,
    });
  }

  if (scenario === DB_TRANSPORT_SCENARIO.INTERACTIVE_BEGIN_ROLLBACK) {
    const detail = await runInteractiveRollback(adapter, key);
    return buildDbTransportCompatResult({
      transport, scenario, outcome: detail.restored ? 'pass' : 'fail', startedAt, stats: adapter.stats,
      rollbackOutcome: detail.restored ? 'restored' : 'not_restored',
      errorClass: detail.restored ? DB_TRANSPORT_ERROR.NONE : DB_TRANSPORT_ERROR.TRANSACTION_ABORTED,
    });
  }

  if (scenario === DB_TRANSPORT_SCENARIO.ROW_LOCK_FOR_SHARE || scenario === DB_TRANSPORT_SCENARIO.ROW_LOCK_FOR_UPDATE) {
    const lockSql = scenario === DB_TRANSPORT_SCENARIO.ROW_LOCK_FOR_SHARE ? FIXTURE_FOR_SHARE_SQL : FIXTURE_FOR_UPDATE_SQL;
    const detail = await runRowLockProbe(adapter, key, lockSql);
    const pass = detail.blocked && detail.reacquired;
    return buildDbTransportCompatResult({
      transport, scenario, outcome: pass ? 'pass' : 'fail', startedAt, stats: adapter.stats,
      lockOutcome: pass ? 'blocked_then_released' : 'unexpected',
      errorClass: pass ? DB_TRANSPORT_ERROR.NONE : DB_TRANSPORT_ERROR.QUERY_FAILURE,
    });
  }

  if (scenario === DB_TRANSPORT_SCENARIO.ADVISORY_XACT_LOCK) {
    const detail = await runAdvisoryLockProbe(adapter, key);
    const pass = detail.blocked && detail.reacquired;
    return buildDbTransportCompatResult({
      transport, scenario, outcome: pass ? 'pass' : 'fail', startedAt, stats: adapter.stats,
      lockOutcome: pass ? 'blocked_then_released' : 'unexpected',
      errorClass: pass ? DB_TRANSPORT_ERROR.NONE : DB_TRANSPORT_ERROR.QUERY_FAILURE,
    });
  }

  throw new DbTransportCompatError(DB_TRANSPORT_ERROR.SCENARIO_UNSUPPORTED, 'scenario unsupported', { status: 422 });
}

const FORBIDDEN_ERROR_PATTERNS = [
  /postgres(?:ql)?:\/\//i,
  /password=/i,
  /sslmode=/i,
  /neon\.tech/i,
  /database_url/i,
  /authorization/i,
  /bearer\s+/i,
];

export function sanitizeDbTransportCompatError(error) {
  let code = DB_TRANSPORT_ERROR.UNEXPECTED_ERROR;
  let status = 500;
  if (error instanceof DbTransportCompatError) {
    code = error.code;
    status = error.status;
  } else if (error && error.name === 'AbortError') {
    code = DB_TRANSPORT_ERROR.QUERY_FAILURE;
    status = 504;
  }

  const raw = error && typeof error.message === 'string' ? error.message : '';
  if (FORBIDDEN_ERROR_PATTERNS.some((pattern) => pattern.test(raw))) {
    code = DB_TRANSPORT_ERROR.SANITIZATION_REJECTED;
  }

  return Object.freeze({
    status,
    body: Object.freeze({
      error: 'db transport compatibility probe failed',
      code,
    }),
  });
}

export const __DB_TRANSPORT_COMPAT_TEST_ONLY = Object.freeze({
  FIXTURE_SELECT_SQL,
  FIXTURE_INCREMENT_SQL,
  FIXTURE_DECREMENT_SQL,
  FIXTURE_FOR_SHARE_SQL,
  FIXTURE_FOR_UPDATE_SQL,
  ADVISORY_LOCK_SQL,
  SET_LOCK_TIMEOUT_SQL,
  SCENARIO_CAPABILITY,
});
