'use strict';

/**
 * Composition root contract for Issue #3809 (Step 6). Executes the composition
 * root with a synthetic-safe pinned-session boundary and a bounded synthetic
 * ACTIVE authority test seam (authorityResolverFactory). No database, network,
 * SQL execution, Docker/PostgreSQL, Production, provider, credential, or secret.
 * Refs #3809. Refs #3657. Refs #3458. Refs #3425. Refs #3435. Refs #3437.
 * Refs #1882.
 */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.resolve(__dirname, '..', '..');
const CORE = path.join(ROOT, 'scripts/migration-precondition-composition-root-core.cjs');
const LOCK_ADAPTER = path.join(ROOT, 'scripts/migration-postgres-session-lock-adapter-core.cjs');
const ORCHESTRATOR = path.join(ROOT, 'scripts/migration-runner-orchestrator-core.cjs');
const { createMigrationPreconditionCompositionRoot } = require(CORE);
const { createPostgresMigrationSessionLockAdapter, POSTGRES_MIGRATION_LOCK_QUERIES } = require(LOCK_ADAPTER);

const TARGET = '20260727000000_example-migration';
const CHECK = {
  checkId: 'satisfied-check',
  expected: true,
  query: {
    name: 'satisfied-check-query',
    text: 'inert fixture',
    values: [],
    resultContract: { kind: 'BOOLEAN_SINGLE_ROW', field: 'satisfied' },
  },
};

function makeSession(options = {}) {
  const calls = { queries: [], releases: 0 };
  const session = {
    query(q) {
      calls.queries.push(q);
      if (q === POSTGRES_MIGRATION_LOCK_QUERIES.acquire) {
        return { rows: [{ acquired: options.acquired !== false }] };
      }
      if (q === POSTGRES_MIGRATION_LOCK_QUERIES.check) {
        return { rows: [{ held: options.held !== false }] };
      }
      if (q === POSTGRES_MIGRATION_LOCK_QUERIES.release) {
        return { rows: [{ released: options.released !== false }] };
      }
      return { rows: [{ satisfied: options.satisfied !== false }] };
    },
    release() {
      calls.releases += 1;
    },
  };
  return { session, calls };
}

function activeResolverFactory(satisfied) {
  const checks = [{ ...CHECK, expected: true }];
  return () => ({
    resolvePreconditionAuthority: () => ({
      status: 'RESOLVED',
      checks,
    }),
  });
}

function makeRoot(session, resolverFactory) {
  const config = { openSession: () => session };
  if (resolverFactory) config.authorityResolverFactory = resolverFactory;
  return createMigrationPreconditionCompositionRoot(config);
}

function assertSurface(root) {
  assert.ok(Object.isFrozen(root), 'composition surface frozen');
  assert.deepEqual(
    Object.keys(root),
    ['acquireAdvisoryLock', 'evaluatePrecondition', 'checkAdvisoryLock', 'releaseAdvisoryLock'],
    'exact orchestrator-facing dependency subset',
  );
  for (const key of Object.keys(root)) {
    assert.equal(typeof root[key], 'function', key + ' is callable');
  }
  assert.equal('queryLockedSession' in root, false, 'broker not publicly exposed');
  assert.equal('resolvePreconditionAuthority' in root, false, 'raw resolver not exposed');
}

// ── 1–2. Frozen surface + descriptor-safe factory validation ───────────────

test('composition root returns the exact frozen orchestrator-facing surface', async () => {
  const { session } = makeSession();
  const root = makeRoot(session);
  assertSurface(root);

  // Acquire -> evaluate (inactive) -> check -> release with one opaque handle.
  const acquire = await root.acquireAdvisoryLock({ targetMigrationId: TARGET });
  assert.equal(acquire.status, 'ACQUIRED', 'advisory lock acquired');
  assert.ok(acquire.handle && typeof acquire.handle === 'object', 'opaque lock handle present');

  const precondition = await root.evaluatePrecondition({
    targetMigrationId: TARGET,
    lockHandle: acquire.handle,
  });
  assert.equal(precondition.status, 'NOT_EVALUATED', 'inactive authority -> NOT_EVALUATED');

  const check = await root.checkAdvisoryLock({ lockHandle: acquire.handle });
  assert.equal(check.status, 'ACQUIRED', 'same-instance handle accepted by check');

  const release = await root.releaseAdvisoryLock({ lockHandle: acquire.handle });
  assert.equal(release.status, 'RELEASED', 'same-instance handle accepted by release');
});

test('malformed factory configuration fails closed without getter or Proxy execution', () => {
  const fn = () => ({});
  const badConfigs = [];
  const push = (label, value) => badConfigs.push(value);

  push('null', null);
  push('undefined', undefined);
  push('number', 42);
  push('array', []);
  push('empty object', {});
  push('missing openSession', { authorityResolverFactory: fn });

  const nonCallable = { openSession: 42 };
  push('non-callable openSession', nonCallable);

  const extraKey = { openSession: fn, extra: 1 };
  push('extra key', extraKey);

  const badFactory = { openSession: fn, authorityResolverFactory: 42 };
  push('non-callable authorityResolverFactory', badFactory);

  const asFunction = () => {};
  asFunction.openSession = fn;
  push('function config', asFunction);

  const asArray = [];
  asArray.openSession = fn;
  push('array config', asArray);

  const customProto = Object.create({ openSession: fn });
  push('custom prototype', customProto);

  const withSymbol = { openSession: fn };
  withSymbol[Symbol('extra')] = 1;
  push('symbol key', withSymbol);

  const withNonEnumerable = { openSession: fn };
  Object.defineProperty(withNonEnumerable, 'extra', { value: 1, enumerable: false });
  push('non-enumerable key', withNonEnumerable);

  let getterRead = 0;
  const withAccessor = {};
  Object.defineProperty(withAccessor, 'openSession', {
    enumerable: true,
    get() { getterRead += 1; return fn; },
  });
  push('accessor openSession', withAccessor);

  const proxyConfig = new Proxy({ openSession: fn }, {});
  push('Proxy config', proxyConfig);

  const revokedConfig = Proxy.revocable({ openSession: fn }, {});
  revokedConfig.revoke();
  push('revoked Proxy config', revokedConfig.proxy);

  for (const bad of badConfigs) {
    assert.throws(
      () => createMigrationPreconditionCompositionRoot(bad),
      /MIGRATION_PRECONDITION_COMPOSITION_ROOT_CONFIG_INVALID/,
      'bounded factory error for hostile config',
    );
  }
  assert.equal(getterRead, 0, 'accessor getter never invoked');
});

// ── 3–4. Same-instance wiring and cross-instance detection ─────────────────

test('same lock-adapter instance owns acquire/check/release and the evaluator broker', async () => {
  const { session, calls } = makeSession();
  const root = makeRoot(session, activeResolverFactory(true));
  assertSurface(root);

  const acquire = await root.acquireAdvisoryLock({ targetMigrationId: TARGET });
  assert.equal(acquire.status, 'ACQUIRED');
  const handle = acquire.handle;

  // Synthetic ACTIVE authority through the bounded test seam: evaluatePrecondition
  // must exercise the composed pinned-session broker with the SAME handle.
  const precondition = await root.evaluatePrecondition({
    targetMigrationId: TARGET,
    lockHandle: handle,
  });
  assert.equal(precondition.status, 'PASS', 'active authority + same-instance broker -> PASS');

  const queryNames = calls.queries.map((q) => (q && q.name) || q);
  assert.ok(
    queryNames.includes('satisfied-check-query'),
    'precondition broker query executed through the composed pinned session',
  );

  const check = await root.checkAdvisoryLock({ lockHandle: handle });
  assert.equal(check.status, 'ACQUIRED', 'check accepted the same handle');

  const release = await root.releaseAdvisoryLock({ lockHandle: handle });
  assert.equal(release.status, 'RELEASED', 'release accepted the same handle');
});

test('cross-instance handle substitution is detected by the composed broker', async () => {
  const composed = makeSession();
  const root = makeRoot(composed.session, activeResolverFactory(true));

  // A SECOND, unrelated lock-adapter instance.
  const foreign = makeSession();
  const foreignAdapter = createPostgresMigrationSessionLockAdapter({
    openSession: () => foreign.session,
  });
  const foreignAcquire = await foreignAdapter.acquireAdvisoryLock({ targetMigrationId: TARGET });
  assert.equal(foreignAcquire.status, 'ACQUIRED');
  const foreignHandle = foreignAcquire.handle;

  const precondition = await root.evaluatePrecondition({
    targetMigrationId: TARGET,
    lockHandle: foreignHandle,
  });
  assert.equal(precondition.status, 'UNAVAILABLE', 'foreign handle rejected by composed broker');
});

// ── 5. Inactive authority -> NOT_EVALUATED, zero precondition queries ───────

test('current inactive authority maps to NOT_EVALUATED with zero precondition broker queries', async () => {
  const { session, calls } = makeSession();
  const root = makeRoot(session); // default fixed-authority resolver (ADOPTION_REQUIRED)
  assertSurface(root);

  const acquire = await root.acquireAdvisoryLock({ targetMigrationId: TARGET });
  assert.equal(acquire.status, 'ACQUIRED');

  const precondition = await root.evaluatePrecondition({
    targetMigrationId: TARGET,
    lockHandle: acquire.handle,
  });
  assert.equal(precondition.status, 'NOT_EVALUATED', 'no precondition != PASS');

  const queryNames = calls.queries.map((q) => (q && q.name) || q);
  assert.equal(
    queryNames.includes('satisfied-check-query'),
    false,
    'zero precondition broker queries for inactive authority',
  );
});

// ── 6–7. Malformed surfaces fail closed before session/query use ───────────

test('malformed authorityResolverFactory surfaces fail closed before session/query use', async () => {
  let getterRead = 0;
  const malformedFactories = [
    () => ({}),
    () => ({ resolvePreconditionAuthority: 42 }),
    () => ({ resolvePreconditionAuthority: () => {}, extra: 1 }),
    () => Object.create({ resolvePreconditionAuthority: () => {} }),
    () => Promise.resolve({ resolvePreconditionAuthority: () => {} }),
    () => { throw new Error('RAW_RESOLVER_FACTORY_BOOM'); },
    () => {
      const surface = {};
      Object.defineProperty(surface, 'resolvePreconditionAuthority', {
        enumerable: true,
        get() { getterRead += 1; return () => {}; },
      });
      return surface;
    },
  ];

  for (const factory of malformedFactories) {
    const session = makeSession();
    assert.throws(
      () => makeRoot(session.session, factory),
      /MIGRATION_PRECONDITION_COMPOSITION_ROOT_CONFIG_INVALID/,
      'malformed resolver surface rejected at composition time',
    );
    assert.equal(session.calls.queries.length, 0, 'no session query before validation');
  }
  assert.equal(getterRead, 0, 'resolver surface getter never invoked');
});

test('one lock-adapter instance only; no second-instance path in source', () => {
  const source = fs.readFileSync(CORE, 'utf8');
  const matches = source.match(/createPostgresMigrationSessionLockAdapter\(/g) || [];
  assert.equal(matches.length, 1, 'exactly one lock-adapter instantiation in composition root');
  const brokerReads = source.match(/lockAdapter\.queryLockedSession/g) || [];
  assert.equal(brokerReads.length, 1, 'evaluator broker wired from the same lock adapter');
});

// ── 8–10. Handle identity, broker privacy, raw-exposure and console silence ──

test('opaque lock-handle identity is preserved across acquire -> evaluate -> check -> release', async () => {
  const { session } = makeSession();
  const root = makeRoot(session, activeResolverFactory(true));
  const acquire = await root.acquireAdvisoryLock({ targetMigrationId: TARGET });
  const handle = acquire.handle;

  await root.evaluatePrecondition({ targetMigrationId: TARGET, lockHandle: handle });
  await root.checkAdvisoryLock({ lockHandle: handle });
  await root.releaseAdvisoryLock({ lockHandle: handle });

  assert.equal(
    handle && typeof handle === 'object' && Object.isFrozen(handle),
    true,
    'opaque handle remains the exact opaque object',
  );
});

test('no raw error, session, handle, or query result is exposed or logged', async () => {
  const consoleLogs = [];
  const originalLog = console.log;
  const originalError = console.error;
  console.log = (...args) => { consoleLogs.push(args); };
  console.error = (...args) => { consoleLogs.push(args); };
  try {
    const composed = makeSession();
    const root = makeRoot(composed.session, activeResolverFactory(true));
    const foreign = makeSession();
    const foreignAdapter = createPostgresMigrationSessionLockAdapter({ openSession: () => foreign.session });
    const foreignAcquire = await foreignAdapter.acquireAdvisoryLock({ targetMigrationId: TARGET });

    const result = await root.evaluatePrecondition({
      targetMigrationId: TARGET,
      lockHandle: foreignAcquire.handle,
    });
    assert.deepEqual(Object.keys(result), ['status'], 'result has exactly status');
    assert.equal(result.status, 'UNAVAILABLE');
    assert.equal(JSON.stringify(result).length < 200, true, 'no raw handle/query result serialized');
    assert.equal(consoleLogs.length, 0, 'no console output during evaluation');
  } finally {
    console.log = originalLog;
    console.error = originalError;
  }
});

// ── 11. No DB/network/provider/environment capability in source ─────────────

test('composition root source contains no DB, network, driver, retry, or environment capability', () => {
  const source = fs.readFileSync(CORE, 'utf8');
  const forbidden = [
    /require\(['"]pg['"]\)/, /require\(['"]child_process['"]\)/, /require\(['"]net['"]\)/,
    /require\(['"]http/, /require\(['"]https['"]\)/, /\bfetch\s*\(/, /https\.request/,
    /\bsetTimeout\s*\(/, /\bsetInterval\s*\(/, /\bsleep\s*\(/,
    /\bconsole\.(log|error|warn)\s*\(/, /process\.env\b/,
  ];
  for (const re of forbidden) {
    assert.ok(!re.test(source), 'forbidden capability in composition root source: ' + re);
  }
  assert.ok(
    /require\(['"].*migration-(precondition-authority-loader-resolver|postgres-session-lock-adapter|precondition-evaluator-adapter)-core\.cjs['"]\)/.test(source),
    'composition root requires exactly the three authority cores',
  );
});

// ── 12. Orchestrator dependency boundary compatibility ─────────────────────

test('composition surface matches the orchestrator precondition dependency contract', () => {
  const orchestratorSource = fs.readFileSync(ORCHESTRATOR, 'utf8');
  for (const dep of ['acquireAdvisoryLock', 'evaluatePrecondition', 'checkAdvisoryLock', 'releaseAdvisoryLock']) {
    assert.ok(orchestratorSource.includes(`'${dep}'`), 'orchestrator dependency contract includes ' + dep);
  }
  const surface = Object.keys(createMigrationPreconditionCompositionRoot({ openSession: () => makeSession().session }));
  assert.deepEqual(
    surface,
    ['acquireAdvisoryLock', 'evaluatePrecondition', 'checkAdvisoryLock', 'releaseAdvisoryLock'],
    'surface is exactly the orchestrator-facing subset',
  );
});
