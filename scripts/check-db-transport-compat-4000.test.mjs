import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

import {
  DB_TRANSPORT,
  DB_TRANSPORT_CAPABILITIES,
  DB_TRANSPORT_ENV,
  DB_TRANSPORT_ERROR,
  DB_TRANSPORT_IDEMPOTENCY_REQUIREMENTS,
  DB_TRANSPORT_REQUIRED_ENVIRONMENT,
  DB_TRANSPORT_SCENARIO,
  DbTransportCompatError,
  __DB_TRANSPORT_COMPAT_TEST_ONLY,
  buildDbTransportCompatResult,
  createHyperdrivePgTransport,
  createNeonHttpTransport,
  createNeonWsTransport,
  getDbTransportScenarioSupport,
  isNeonDatabaseUrl,
  readDbTransportCompatConfig,
  runDbTransportCompatScenario,
  sanitizeDbTransportCompatError,
  timingSafeEqualText,
} from '../functions/_shared/db/db-transport-compat-core.js';
import {
  DB_TRANSPORT_COMPAT_MAX_BODY_BYTES,
  DB_TRANSPORT_COMPAT_SEAM_PATH,
  DB_TRANSPORT_COMPAT_TOKEN_HEADER,
  buildDbTransportCompatResponse,
  onRequest,
} from '../functions/api/experimental/db-transport-compat.js';

const checks = [];
function check(name, fn) {
  checks.push([name, fn]);
}

const BENCH_TOKEN = 'synthetic-bench-token';
const NEON_URL = 'postgresql://ep-synthetic-4093.us-east-1.neon.tech/neondb?sslmode=require';
const HYPERDRIVE_URL = 'postgresql://hyperdrive.invalid/neondb';

function baseEnv(extra = {}) {
  return {
    [DB_TRANSPORT_ENV.ENABLED_FLAG]: 'true',
    [DB_TRANSPORT_ENV.ENVIRONMENT]: DB_TRANSPORT_REQUIRED_ENVIRONMENT,
    [DB_TRANSPORT_ENV.BENCH_TOKEN]: BENCH_TOKEN,
    [DB_TRANSPORT_ENV.NEON_DATABASE_URL]: NEON_URL,
    [DB_TRANSPORT_ENV.HYPERDRIVE_BINDING]: { connectionString: HYPERDRIVE_URL },
    ...extra,
  };
}

function probeRequest(body, extra = {}) {
  return new Request(`https://example.test${DB_TRANSPORT_COMPAT_SEAM_PATH}`, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      [DB_TRANSPORT_COMPAT_TOKEN_HEADER]: BENCH_TOKEN,
      ...(extra.headers || {}),
    },
    body: typeof body === 'string' ? body : JSON.stringify(body),
  });
}

function makeOneShotAdapter(transport, rows = [{ version: 1, marker: 'synthetic' }]) {
  const calls = [];
  return {
    transport,
    stats: { queryCount: 0, connectionCount: 0 },
    calls,
    async query(text, values) {
      calls.push({ text, values });
      this.stats.queryCount += 1;
      return rows;
    },
  };
}

function makeStatefulSessionTransport(transport, initialVersion = 10) {
  let globalVersion = initialVersion;
  const stats = { queryCount: 0, connectionCount: 0 };
  return {
    transport,
    stats,
    get version() { return globalVersion; },
    async createSession() {
      stats.connectionCount += 1;
      let txVersion = globalVersion;
      let inTransaction = false;
      return {
        async query(text) {
          stats.queryCount += 1;
          if (text === 'BEGIN') {
            inTransaction = true;
            txVersion = globalVersion;
            return [];
          }
          if (text === 'COMMIT') {
            if (inTransaction) globalVersion = txVersion;
            inTransaction = false;
            return [];
          }
          if (text === 'ROLLBACK') {
            inTransaction = false;
            txVersion = globalVersion;
            return [];
          }
          if (/^SELECT version, marker FROM/.test(text)) {
            return [{ version: inTransaction ? txVersion : globalVersion, marker: 'synthetic' }];
          }
          if (/SET version = version \+ 1/.test(text)) {
            txVersion += 1;
            return [{ version: txVersion }];
          }
          if (/SET version = version - 1/.test(text)) {
            txVersion -= 1;
            return [{ version: txVersion }];
          }
          return [];
        },
        async close() {},
      };
    },
  };
}

// Capability declarations are explicit and do not depend on route identity.
check('capability: Neon HTTP is one-shot/non-interactive only', () => {
  const c = DB_TRANSPORT_CAPABILITIES[DB_TRANSPORT.NEON_HTTP];
  assert.equal(c.oneShotQuery, true);
  assert.equal(c.nonInteractiveTransaction, true);
  assert.equal(c.interactiveTransaction, false);
  assert.equal(c.requestScopedSession, false);
  assert.equal(c.rowLocks, false);
  assert.equal(c.advisoryTransactionLocks, false);
});

check('capability: Hyperdrive pg is interactive but advisory locks stay unsupported', () => {
  const c = DB_TRANSPORT_CAPABILITIES[DB_TRANSPORT.HYPERDRIVE_PG];
  assert.equal(c.interactiveTransaction, true);
  assert.equal(c.rowLocks, true);
  assert.equal(c.advisoryTransactionLocks, false);
});

check('capability: Neon WS is the full-semantic runtime candidate', () => {
  const c = DB_TRANSPORT_CAPABILITIES[DB_TRANSPORT.NEON_WS];
  assert.equal(c.interactiveTransaction, true);
  assert.equal(c.requestScopedSession, true);
  assert.equal(c.rowLocks, true);
  assert.equal(c.advisoryTransactionLocks, true);
});

check('capability: unsupported scenarios fail from declarations, not route names', () => {
  assert.equal(getDbTransportScenarioSupport(DB_TRANSPORT.NEON_HTTP, DB_TRANSPORT_SCENARIO.INTERACTIVE_BEGIN_COMMIT), false);
  assert.equal(getDbTransportScenarioSupport(DB_TRANSPORT.HYPERDRIVE_PG, DB_TRANSPORT_SCENARIO.ADVISORY_XACT_LOCK), false);
  assert.equal(getDbTransportScenarioSupport(DB_TRANSPORT.NEON_WS, DB_TRANSPORT_SCENARIO.ADVISORY_XACT_LOCK), true);
});

check('idempotency: accepted current classes remain mapped to required transaction primitives', () => {
  assert.deepEqual(DB_TRANSPORT_IDEMPOTENCY_REQUIREMENTS.semanticDuplicateSerialization, ['interactiveTransaction', 'advisoryTransactionLocks']);
  assert.deepEqual(DB_TRANSPORT_IDEMPOTENCY_REQUIREMENTS.uniqueConflictCanonicalReread, ['interactiveTransaction']);
  assert.deepEqual(DB_TRANSPORT_IDEMPOTENCY_REQUIREMENTS.requestKeyReservationReplay, ['interactiveTransaction']);
});

// Dedicated config only. Product-looking fallback values are intentionally ignored.
check('config: disabled gate never becomes ready', () => {
  const c = readDbTransportCompatConfig({}, DB_TRANSPORT.NEON_HTTP);
  assert.equal(c.enabled, false);
  assert.equal(c.ready, false);
});

check('config: exact TEST_ISOLATION_ONLY classification is mandatory', () => {
  const c = readDbTransportCompatConfig(baseEnv({ [DB_TRANSPORT_ENV.ENVIRONMENT]: 'preview' }), DB_TRANSPORT.NEON_HTTP);
  assert.equal(c.ready, false);
});

check('config: benchmark token is mandatory before transport config becomes ready', () => {
  const c = readDbTransportCompatConfig(baseEnv({ [DB_TRANSPORT_ENV.BENCH_TOKEN]: '' }), DB_TRANSPORT.NEON_HTTP);
  assert.equal(c.ready, false);
});

check('config: Product DATABASE_URL is never a Neon compatibility fallback', () => {
  const env = baseEnv({ [DB_TRANSPORT_ENV.NEON_DATABASE_URL]: '', DATABASE_URL: NEON_URL });
  const c = readDbTransportCompatConfig(env, DB_TRANSPORT.NEON_HTTP);
  assert.equal(c.ready, false);
  assert.equal(c.connectionString, '');
});

check('config: Hyperdrive requires the dedicated binding connectionString', () => {
  const missing = readDbTransportCompatConfig(baseEnv({ [DB_TRANSPORT_ENV.HYPERDRIVE_BINDING]: undefined }), DB_TRANSPORT.HYPERDRIVE_PG);
  assert.equal(missing.ready, false);
  const configured = readDbTransportCompatConfig(baseEnv(), DB_TRANSPORT.HYPERDRIVE_PG);
  assert.equal(configured.ready, true);
  assert.equal(configured.connectionString, HYPERDRIVE_URL);
});

check('config: direct Neon accepts Neon host only', () => {
  assert.equal(isNeonDatabaseUrl(NEON_URL), true);
  assert.equal(isNeonDatabaseUrl('postgresql://u:p@localhost/db'), false);
  assert.equal(isNeonDatabaseUrl('mysql://x'), false);
});

check('auth compare: exact token equality only', () => {
  assert.equal(timingSafeEqualText('abc', 'abc'), true);
  assert.equal(timingSafeEqualText('abc', 'abd'), false);
  assert.equal(timingSafeEqualText('abc', 'abcd'), false);
});

// Lazy driver factories: injected fakes prove API shape with zero network.
check('factory: Hyperdrive uses request-scoped pg Client connect/query/end', async () => {
  const events = [];
  class FakeClient {
    constructor(options) { events.push(['construct', options.connectionString]); }
    async connect() { events.push(['connect']); }
    async query(text, values) { events.push(['query', text, values]); return { rows: [{ ok: 1 }] }; }
    async end() { events.push(['end']); }
  }
  const transport = await createHyperdrivePgTransport({
    connectionString: HYPERDRIVE_URL,
    pgImporter: async () => ({ Client: FakeClient }),
  });
  const session = await transport.createSession();
  const rows = await session.query('SELECT $1::int AS ok', [1]);
  await session.close();
  assert.deepEqual(rows, [{ ok: 1 }]);
  assert.equal(transport.stats.connectionCount, 1);
  assert.equal(transport.stats.queryCount, 1);
  assert.deepEqual(events.map((event) => event[0]), ['construct', 'connect', 'query', 'end']);
});

check('factory: Neon WS uses request-scoped Neon Client connect/query/end', async () => {
  const events = [];
  class FakeClient {
    constructor(options) { events.push(['construct', options.connectionString]); }
    async connect() { events.push(['connect']); }
    async query(text, values) { events.push(['query', text, values]); return { rows: [{ ok: 1 }] }; }
    async end() { events.push(['end']); }
  }
  const transport = await createNeonWsTransport({
    connectionString: NEON_URL,
    neonImporter: async () => ({ Client: FakeClient }),
  });
  const session = await transport.createSession();
  await session.query('SELECT $1::int AS ok', [1]);
  await session.close();
  assert.equal(transport.stats.connectionCount, 1);
  assert.equal(transport.stats.queryCount, 1);
  assert.deepEqual(events.map((event) => event[0]), ['construct', 'connect', 'query', 'end']);
});

check('factory: Neon HTTP one-shot path uses sql.query parameter array', async () => {
  const calls = [];
  const fakeSql = {
    async query(text, values) {
      calls.push({ text, values });
      return [{ version: 1, marker: 'synthetic' }];
    },
  };
  const transport = await createNeonHttpTransport({
    connectionString: NEON_URL,
    neonImporter: async () => ({ neon: () => fakeSql }),
  });
  const rows = await transport.query('SELECT version FROM db_transport_compat_4093_fixture WHERE scenario_key = $1', ['authority']);
  assert.equal(rows.length, 1);
  assert.deepEqual(calls[0].values, ['authority']);
  assert.equal(transport.stats.queryCount, 1);
});

// Deterministic scenario behavior.
check('scenario: Neon HTTP one-shot select passes with injected adapter', async () => {
  const adapter = makeOneShotAdapter(DB_TRANSPORT.NEON_HTTP);
  const result = await runDbTransportCompatScenario({
    transport: DB_TRANSPORT.NEON_HTTP,
    scenario: DB_TRANSPORT_SCENARIO.ONE_SHOT_SELECT,
    adapter,
  });
  assert.equal(result.outcome, 'pass');
  assert.equal(result.query_count, 1);
  assert.deepEqual(adapter.calls[0].values, ['authority']);
});

check('scenario: Neon HTTP interactive transaction is expected_unsupported with zero DB query', async () => {
  const adapter = makeOneShotAdapter(DB_TRANSPORT.NEON_HTTP);
  const result = await runDbTransportCompatScenario({
    transport: DB_TRANSPORT.NEON_HTTP,
    scenario: DB_TRANSPORT_SCENARIO.INTERACTIVE_BEGIN_COMMIT,
    adapter,
  });
  assert.equal(result.outcome, 'expected_unsupported');
  assert.equal(result.error_class, DB_TRANSPORT_ERROR.CAPABILITY_UNSUPPORTED);
  assert.equal(result.query_count, 0);
  assert.equal(adapter.calls.length, 0);
});

check('scenario: Hyperdrive advisory lock is expected_unsupported with zero DB query', async () => {
  const adapter = { transport: DB_TRANSPORT.HYPERDRIVE_PG, stats: { queryCount: 0, connectionCount: 0 } };
  const result = await runDbTransportCompatScenario({
    transport: DB_TRANSPORT.HYPERDRIVE_PG,
    scenario: DB_TRANSPORT_SCENARIO.ADVISORY_XACT_LOCK,
    adapter,
  });
  assert.equal(result.outcome, 'expected_unsupported');
  assert.equal(result.lock_outcome, 'not_applicable');
  assert.equal(result.query_count, 0);
  assert.equal(result.connection_count, 0);
});

check('scenario: interactive rollback restores canonical version', async () => {
  const adapter = makeStatefulSessionTransport(DB_TRANSPORT.HYPERDRIVE_PG, 10);
  const result = await runDbTransportCompatScenario({
    transport: DB_TRANSPORT.HYPERDRIVE_PG,
    scenario: DB_TRANSPORT_SCENARIO.INTERACTIVE_BEGIN_ROLLBACK,
    adapter,
  });
  assert.equal(result.outcome, 'pass');
  assert.equal(result.rollback_outcome, 'restored');
  assert.equal(adapter.version, 10);
});

check('scenario: interactive commit is restored after proof for repeatable synthetic runs', async () => {
  const adapter = makeStatefulSessionTransport(DB_TRANSPORT.NEON_WS, 20);
  const result = await runDbTransportCompatScenario({
    transport: DB_TRANSPORT.NEON_WS,
    scenario: DB_TRANSPORT_SCENARIO.INTERACTIVE_BEGIN_COMMIT,
    adapter,
  });
  assert.equal(result.outcome, 'pass');
  assert.equal(result.rollback_outcome, 'committed');
  assert.equal(adapter.version, 20);
});

check('scenario: Neon HTTP noninteractive rollback probe is explicit and non-session based', async () => {
  const adapter = {
    transport: DB_TRANSPORT.NEON_HTTP,
    stats: { queryCount: 4, connectionCount: 0 },
    async runAtomicRollbackProbe(key) {
      assert.equal(key, 'rollback');
      return { transactionFailed: true, restored: true };
    },
  };
  const result = await runDbTransportCompatScenario({
    transport: DB_TRANSPORT.NEON_HTTP,
    scenario: DB_TRANSPORT_SCENARIO.NONINTERACTIVE_ATOMIC_ROLLBACK,
    adapter,
  });
  assert.equal(result.outcome, 'pass');
  assert.equal(result.rollback_outcome, 'restored');
  assert.equal(result.connection_count, 0);
});

// Fail-closed route behavior.
check('route: disabled seam returns 404 before transport work', async () => {
  const response = await onRequest({
    request: probeRequest({ transport: DB_TRANSPORT.NEON_HTTP, scenario: DB_TRANSPORT_SCENARIO.ONE_SHOT_SELECT }),
    env: {},
  });
  assert.equal(response.status, 404);
});

check('route: non-POST returns 405 only after experimental gate is enabled', async () => {
  const response = await buildDbTransportCompatResponse({
    request: new Request(`https://example.test${DB_TRANSPORT_COMPAT_SEAM_PATH}`, { method: 'GET' }),
    env: baseEnv(),
  });
  assert.equal(response.status, 405);
  assert.equal(response.headers.get('allow'), 'POST');
});

check('route: wrong environment classification returns 503', async () => {
  const response = await buildDbTransportCompatResponse({
    request: probeRequest({ transport: DB_TRANSPORT.NEON_HTTP, scenario: DB_TRANSPORT_SCENARIO.ONE_SHOT_SELECT }),
    env: baseEnv({ [DB_TRANSPORT_ENV.ENVIRONMENT]: 'production' }),
  });
  assert.equal(response.status, 503);
  const body = await response.json();
  assert.equal(body.code, DB_TRANSPORT_ERROR.NONPROD_ENV_REQUIRED);
});

check('route: missing benchmark token config returns 503', async () => {
  const response = await buildDbTransportCompatResponse({
    request: probeRequest({ transport: DB_TRANSPORT.NEON_HTTP, scenario: DB_TRANSPORT_SCENARIO.ONE_SHOT_SELECT }),
    env: baseEnv({ [DB_TRANSPORT_ENV.BENCH_TOKEN]: '' }),
  });
  assert.equal(response.status, 503);
});

check('route: wrong benchmark token returns 403 before body/DB execution', async () => {
  const request = probeRequest(
    { transport: DB_TRANSPORT.NEON_HTTP, scenario: DB_TRANSPORT_SCENARIO.ONE_SHOT_SELECT },
    { headers: { [DB_TRANSPORT_COMPAT_TOKEN_HEADER]: 'wrong' } },
  );
  const response = await buildDbTransportCompatResponse({ request, env: baseEnv() });
  assert.equal(response.status, 403);
});

check('route: Product DATABASE_URL cannot satisfy missing dedicated Neon secret', async () => {
  let queried = false;
  const adapter = makeOneShotAdapter(DB_TRANSPORT.NEON_HTTP);
  adapter.query = async () => { queried = true; return []; };
  const response = await buildDbTransportCompatResponse({
    request: probeRequest({ transport: DB_TRANSPORT.NEON_HTTP, scenario: DB_TRANSPORT_SCENARIO.ONE_SHOT_SELECT }),
    env: baseEnv({ [DB_TRANSPORT_ENV.NEON_DATABASE_URL]: '', DATABASE_URL: NEON_URL }),
    adapterOverride: adapter,
  });
  assert.equal(response.status, 503);
  assert.equal(queried, false);
});

check('route: malformed JSON returns bounded 400', async () => {
  const response = await buildDbTransportCompatResponse({
    request: probeRequest('{bad-json'),
    env: baseEnv(),
  });
  assert.equal(response.status, 400);
  const body = await response.json();
  assert.equal(body.code, DB_TRANSPORT_ERROR.REQUEST_INVALID);
});

check('route: oversized body is rejected before transport work', async () => {
  const response = await buildDbTransportCompatResponse({
    request: probeRequest('x'.repeat(DB_TRANSPORT_COMPAT_MAX_BODY_BYTES + 1)),
    env: baseEnv(),
  });
  assert.equal(response.status, 413);
});

check('route: valid one-shot injected adapter returns sanitized result only', async () => {
  const adapter = makeOneShotAdapter(DB_TRANSPORT.NEON_HTTP);
  const response = await buildDbTransportCompatResponse({
    request: probeRequest({ transport: DB_TRANSPORT.NEON_HTTP, scenario: DB_TRANSPORT_SCENARIO.ONE_SHOT_SELECT }),
    env: baseEnv(),
    adapterOverride: adapter,
  });
  assert.equal(response.status, 200);
  const body = await response.json();
  assert.equal(body.outcome, 'pass');
  assert.equal(body.transport_class, DB_TRANSPORT.NEON_HTTP);
  assert.equal(body.scenario, DB_TRANSPORT_SCENARIO.ONE_SHOT_SELECT);
  assert.equal(body.query_count, 1);
  assert.equal(body.cpu_ms, null);
  assert.equal(body.connectionString, undefined);
  assert.equal(body.marker, undefined);
});

check('route: Hyperdrive advisory probe reports expected_unsupported without DB calls', async () => {
  const adapter = { transport: DB_TRANSPORT.HYPERDRIVE_PG, stats: { queryCount: 0, connectionCount: 0 } };
  const response = await buildDbTransportCompatResponse({
    request: probeRequest({ transport: DB_TRANSPORT.HYPERDRIVE_PG, scenario: DB_TRANSPORT_SCENARIO.ADVISORY_XACT_LOCK }),
    env: baseEnv(),
    adapterOverride: adapter,
  });
  assert.equal(response.status, 200);
  const body = await response.json();
  assert.equal(body.outcome, 'expected_unsupported');
  assert.equal(body.error_class, DB_TRANSPORT_ERROR.CAPABILITY_UNSUPPORTED);
  assert.equal(body.query_count, 0);
});

// Sanitized evidence/error schema.
check('result schema: contains bounded telemetry fields and no fixture body', () => {
  const result = buildDbTransportCompatResult({
    transport: DB_TRANSPORT.NEON_HTTP,
    scenario: DB_TRANSPORT_SCENARIO.ONE_SHOT_SELECT,
    outcome: 'pass',
    startedAt: Date.now(),
    stats: { queryCount: 1, connectionCount: 0 },
  });
  assert.deepEqual(Object.keys(result), [
    'transport_class', 'scenario', 'outcome', 'latency_ms', 'cpu_ms', 'query_count',
    'connection_count', 'lock_outcome', 'rollback_outcome', 'error_class',
  ]);
});

check('sanitizer: raw connection material is replaced by bounded class', () => {
  const sanitized = sanitizeDbTransportCompatError(new Error(`failed ${NEON_URL}`));
  assert.equal(sanitized.body.code, DB_TRANSPORT_ERROR.SANITIZATION_REJECTED);
  assert.doesNotMatch(JSON.stringify(sanitized.body), /neon\.tech|synthetic@|sslmode/i);
});

check('sanitizer: known bounded errors preserve stable class/status', () => {
  const sanitized = sanitizeDbTransportCompatError(
    new DbTransportCompatError(DB_TRANSPORT_ERROR.CONFIG_MISSING, 'missing', { status: 503 }),
  );
  assert.equal(sanitized.status, 503);
  assert.equal(sanitized.body.code, DB_TRANSPORT_ERROR.CONFIG_MISSING);
});

// SQL and source guardrails.
check('sql: every fixture-key query uses positional parameterization', () => {
  const sql = __DB_TRANSPORT_COMPAT_TEST_ONLY;
  assert.match(sql.FIXTURE_SELECT_SQL, /\$1/);
  assert.match(sql.FIXTURE_INCREMENT_SQL, /\$1/);
  assert.match(sql.FIXTURE_DECREMENT_SQL, /\$1/);
  assert.match(sql.FIXTURE_FOR_SHARE_SQL, /\$1/);
  assert.match(sql.FIXTURE_FOR_UPDATE_SQL, /\$1/);
  assert.match(sql.ADVISORY_LOCK_SQL, /\$1/);
});

check('source: route imports no Product route authority', () => {
  const file = path.join(process.cwd(), 'functions', 'api', 'experimental', 'db-transport-compat.js');
  const src = fs.readFileSync(file, 'utf8');
  assert.doesNotMatch(src, /community\/trees|modal_compute|buildModalUrl|\.\.\/community/);
});

check('source: no Product DB env fallback is read', () => {
  const files = [
    path.join(process.cwd(), 'functions', '_shared', 'db', 'db-transport-compat-core.js'),
    path.join(process.cwd(), 'functions', 'api', 'experimental', 'db-transport-compat.js'),
  ];
  for (const file of files) {
    const src = fs.readFileSync(file, 'utf8');
    assert.doesNotMatch(src, /env\s*\.\s*DATABASE_URL|env\s*\[\s*['"]DATABASE_URL['"]\s*\]/);
    assert.doesNotMatch(src, /NETLIFY_DATABASE_URL/);
    assert.doesNotMatch(src, /DIRECT_NEON_BROWSE_DATABASE_URL/);
  }
});

check('source: drivers are lazy imports, not normal Product-route top-level dependencies', () => {
  const file = path.join(process.cwd(), 'functions', '_shared', 'db', 'db-transport-compat-core.js');
  const src = fs.readFileSync(file, 'utf8');
  assert.match(src, /import\('pg'\)/);
  assert.match(src, /import\('@neondatabase\/serverless'\)/);
  assert.doesNotMatch(src, /^import\s+.*from\s+['"]pg['"]/m);
  assert.doesNotMatch(src, /^import\s+.*from\s+['"]@neondatabase\/serverless['"]/m);
});

let passed = 0;
for (const [name, fn] of checks) {
  await fn();
  passed += 1;
  console.log(`PASS ${name}`);
}
console.log(`DB_TRANSPORT_COMPAT_4093 PASS ${passed}/${checks.length}`);
