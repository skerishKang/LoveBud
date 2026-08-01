'use strict';

/**
 * Fail-closed evaluatePrecondition adapter contract for Issue #3802 (Step 5).
 * Synthetic resolver/broker fixtures only. No database, network, SQL execution,
 * Docker/PostgreSQL, Production, provider, credential, or secret capability.
 * Refs #3802. Refs #3657. Refs #3458. Refs #3425. Refs #3435. Refs #3437.
 * Refs #1882.
 */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.resolve(__dirname, '..', '..');
const CORE = path.join(ROOT, 'scripts/migration-precondition-evaluator-adapter-core.cjs');
const ORCHESTRATOR = path.join(ROOT, 'scripts/migration-runner-orchestrator-core.cjs');
const { createMigrationPreconditionEvaluatorAdapter } = require(CORE);

const TARGET = '20260727000000_example-migration';
const LOCK = { token: 'opaque-lock-handle' };
const FIELD = 'satisfied';

function makeCheck(checkId, expected, field = FIELD, values = []) {
  return {
    checkId,
    expected,
    query: {
      name: checkId + '-query',
      text: 'inert fixture',
      values,
      resultContract: { kind: 'BOOLEAN_SINGLE_ROW', field },
    },
  };
}

function makeResolved(checks) {
  return { status: 'RESOLVED', checks };
}

function makeRow(field, value) {
  const row = {};
  row[field] = value;
  return { rows: [row] };
}

function makeHarness(resolverImpl, brokerImpl) {
  const resolverCalls = [];
  const brokerCalls = [];
  const resolver = async (arg) => {
    resolverCalls.push(arg);
    return resolverImpl(arg);
  };
  const broker = async (arg) => {
    brokerCalls.push(arg);
    return brokerImpl(arg);
  };
  const adapter = createMigrationPreconditionEvaluatorAdapter({
    resolvePreconditionAuthority: resolver,
    queryLockedSession: broker,
  });
  return { adapter, resolverCalls, brokerCalls };
}

// Sync-return harness: dependencies return values directly so the adapter's
// thenable/native-Promise handling is exercised without an async wrapper.
function makeRawHarness(resolverImpl, brokerImpl) {
  const resolverCalls = [];
  const brokerCalls = [];
  const resolver = (arg) => {
    resolverCalls.push(arg);
    return resolverImpl(arg);
  };
  const broker = (arg) => {
    brokerCalls.push(arg);
    return brokerImpl(arg);
  };
  const adapter = createMigrationPreconditionEvaluatorAdapter({
    resolvePreconditionAuthority: resolver,
    queryLockedSession: broker,
  });
  return { adapter, resolverCalls, brokerCalls };
}

async function evaluate(adapter, input = { targetMigrationId: TARGET, lockHandle: LOCK }) {
  return adapter.evaluatePrecondition(input);
}

function assertStatusRecord(result, expectedStatus) {
  assert.equal(Object.getPrototypeOf(result), Object.prototype, 'plain record prototype');
  assert.ok(Object.isFrozen(result), 'result frozen');
  assert.deepEqual(Object.keys(result), ['status'], 'exactly one enumerable own key: status');
  assert.equal(result.status, expectedStatus, 'expected status');
}

// ── 1–2. Frozen surfaces and exact status record ─────────────────────────────

test('frozen adapter exposes exactly evaluatePrecondition', () => {
  const { adapter } = makeHarness(
    () => ({ status: 'ADOPTION_REQUIRED' }),
    () => makeRow(FIELD, true),
  );
  assert.ok(Object.isFrozen(adapter), 'adapter frozen');
  assert.deepEqual(Object.keys(adapter), ['evaluatePrecondition'], 'exactly evaluatePrecondition');
  assert.equal(typeof adapter.evaluatePrecondition, 'function', 'evaluatePrecondition callable');
  assert.ok(Object.isFrozen(createMigrationPreconditionEvaluatorAdapter), 'factory frozen');
});

test('every status result is an exact frozen plain record', async () => {
  const cases = [
    [() => ({ status: 'ADOPTION_REQUIRED' }), () => makeRow(FIELD, true), 'NOT_EVALUATED'],
    [() => ({ status: 'NOT_FOUND' }), () => makeRow(FIELD, true), 'NOT_EVALUATED'],
    [() => ({ status: 'UNAVAILABLE' }), () => makeRow(FIELD, true), 'UNAVAILABLE'],
    [() => ({ status: 'RESOLVED', checks: [makeCheck('check-a', true)] }), () => makeRow(FIELD, true), 'PASS'],
    [() => ({ status: 'RESOLVED', checks: [makeCheck('check-a', true)] }), () => makeRow(FIELD, false), 'FAIL'],
    [() => { throw new Error('boom'); }, () => makeRow(FIELD, true), 'UNAVAILABLE'],
  ];
  for (const [resolverImpl, brokerImpl, status] of cases) {
    const { adapter } = makeHarness(resolverImpl, brokerImpl);
    const result = await evaluate(adapter);
    assertStatusRecord(result, status);
  }
});

// ── 3. Malformed factory configuration ─────────────────────────────────────

test('malformed factory configuration fails with one bounded factory error', () => {
  const fn = () => {};
  const badConfigs = [
    null,
    undefined,
    42,
    'x',
    [],
    {},
    { resolvePreconditionAuthority: fn },
    { queryLockedSession: fn },
    { resolvePreconditionAuthority: fn, queryLockedSession: 42 },
    { resolvePreconditionAuthority: 42, queryLockedSession: fn },
    { resolvePreconditionAuthority: fn, queryLockedSession: fn, extra: 1 },
    new Proxy({ resolvePreconditionAuthority: fn, queryLockedSession: fn }, {}),
  ];
  for (const config of badConfigs) {
    assert.throws(
      () => createMigrationPreconditionEvaluatorAdapter(config),
      (error) => error instanceof Error && error.message === 'MIGRATION_PRECONDITION_EVALUATOR_CONFIG_INVALID',
      'bounded factory error for config: ' + String(config),
    );
  }
});

// ── 4. Hostile call envelopes invoke neither dependency ─────────────────────

test('malformed/accessor/inherited/Proxy call envelopes invoke neither dependency', async () => {
  const { adapter, resolverCalls, brokerCalls } = makeHarness(
    () => ({ status: 'ADOPTION_REQUIRED' }),
    () => makeRow(FIELD, true),
  );

  let accessorRead = 0;
  const accessorInput = {};
  Object.defineProperty(accessorInput, 'targetMigrationId', {
    enumerable: true,
    get() {
      accessorRead += 1;
      return TARGET;
    },
  });
  accessorInput.lockHandle = LOCK;

  const revoked = Proxy.revocable({ targetMigrationId: TARGET, lockHandle: LOCK }, {});
  revoked.revoke();

  const inheritedInput = Object.create({ targetMigrationId: TARGET });
  inheritedInput.lockHandle = LOCK;

  const proxyInput = new Proxy({ targetMigrationId: TARGET, lockHandle: LOCK }, {});

  const hostileInputs = [
    null,
    undefined,
    42,
    'x',
    true,
    [],
    { targetMigrationId: TARGET },
    { lockHandle: LOCK },
    { targetMigrationId: TARGET, lockHandle: LOCK, extra: 1 },
    { targetMigrationId: 42, lockHandle: LOCK },
    inheritedInput,
    accessorInput,
    proxyInput,
    revoked.proxy,
  ];

  for (const input of hostileInputs) {
    // Call directly (no default envelope) so `undefined` is exercised as hostile.
    const result = await adapter.evaluatePrecondition(input);
    assertStatusRecord(result, 'UNAVAILABLE');
  }
  assert.equal(accessorRead, 0, 'accessor getter never invoked');
  assert.equal(resolverCalls.length, 0, 'resolver never invoked for hostile input');
  assert.equal(brokerCalls.length, 0, 'broker never invoked for hostile input');
});

// ── 5–8. No-query status mapping ───────────────────────────────────────────

test('ADOPTION_REQUIRED and NOT_FOUND map to NOT_EVALUATED with zero broker calls', async () => {
  for (const status of ['ADOPTION_REQUIRED', 'NOT_FOUND']) {
    const { adapter, resolverCalls, brokerCalls } = makeHarness(
      () => ({ status }),
      () => makeRow(FIELD, true),
    );
    const result = await evaluate(adapter);
    assertStatusRecord(result, 'NOT_EVALUATED');
    assert.equal(resolverCalls.length, 1, 'resolver called exactly once');
    assert.equal(brokerCalls.length, 0, 'broker not called');
  }
});

test('resolver UNAVAILABLE, throw, rejection, and malformed result map to UNAVAILABLE', async () => {
  const malformedCases = [
    () => ({ status: 'BOGUS' }),
    () => ({ status: 'RESOLVED' }),
    () => ({ status: 'RESOLVED', checks: 'nope' }),
    () => 42,
    () => 'UNAVAILABLE',
    () => null,
    async () => { throw new Error('resolver boom'); },
    () => Promise.reject(new Error('resolver reject')),
    () => new Promise(() => { throw new Error('sync thenable throw'); }),
  ];
  for (const resolverImpl of malformedCases) {
    const { adapter, brokerCalls } = makeHarness(resolverImpl, () => makeRow(FIELD, true));
    const result = await evaluate(adapter);
    assertStatusRecord(result, 'UNAVAILABLE');
    assert.equal(brokerCalls.length, 0, 'broker not called');
  }
});

test('resolved authority with empty checks maps to NOT_EVALUATED with zero broker calls', async () => {
  const { adapter, resolverCalls, brokerCalls } = makeHarness(
    () => makeResolved([]),
    () => makeRow(FIELD, true),
  );
  const result = await evaluate(adapter);
  assertStatusRecord(result, 'NOT_EVALUATED');
  assert.equal(resolverCalls.length, 1, 'resolver called once');
  assert.equal(brokerCalls.length, 0, 'broker not called (empty checks !== PASS)');
});

// ── 9–14. Query execution and multi-check precedence ────────────────────────

test('one matching BOOLEAN_SINGLE_ROW check maps to PASS', async () => {
  const { adapter, brokerCalls } = makeHarness(
    () => makeResolved([makeCheck('check-a', true)]),
    () => makeRow(FIELD, true),
  );
  const result = await evaluate(adapter);
  assertStatusRecord(result, 'PASS');
  assert.equal(brokerCalls.length, 1, 'one broker call');
});

test('one valid mismatch maps to FAIL', async () => {
  const { adapter, brokerCalls } = makeHarness(
    () => makeResolved([makeCheck('check-a', true)]),
    () => makeRow(FIELD, false),
  );
  const result = await evaluate(adapter);
  assertStatusRecord(result, 'FAIL');
  assert.equal(brokerCalls.length, 1, 'one broker call');
});

test('all matching multi-check maps to PASS with registry order preserved', async () => {
  const seenOrder = [];
  let callIndex = 0;
  const { adapter, brokerCalls } = makeHarness(
    () => makeResolved([makeCheck('check-a', true), makeCheck('check-b', false)]),
    () => {
      const index = callIndex;
      callIndex += 1;
      seenOrder.push(index);
      return makeRow(FIELD, index === 0 ? true : false);
    },
  );
  const result = await evaluate(adapter);
  assertStatusRecord(result, 'PASS');
  assert.deepEqual(seenOrder, [0, 1], 'checks executed in registry order');
  assert.equal(brokerCalls.length, 2, 'two broker calls');
});

test('one FAIL followed by a matching check still executes both and maps to FAIL', async () => {
  const { adapter, brokerCalls } = makeHarness(
    () => makeResolved([makeCheck('check-a', true), makeCheck('check-b', true)]),
    () => makeRow(FIELD, brokerCalls.length === 1 ? false : true),
  );
  const result = await evaluate(adapter);
  assertStatusRecord(result, 'FAIL');
  assert.equal(brokerCalls.length, 2, 'FAIL did not short-circuit the later check');
});

test('one FAIL followed by broker/result UNAVAILABLE maps to final UNAVAILABLE', async () => {
  const { adapter, brokerCalls } = makeHarness(
    () => makeResolved([makeCheck('check-a', true), makeCheck('check-b', true)]),
    () => (brokerCalls.length === 1 ? makeRow(FIELD, false) : { rows: [] }),
  );
  const result = await evaluate(adapter);
  assertStatusRecord(result, 'UNAVAILABLE');
  assert.equal(brokerCalls.length, 2, 'later UNAVAILABLE observed after FAIL');
});

test('first UNAVAILABLE stops subsequent broker calls', async () => {
  const { adapter, brokerCalls } = makeHarness(
    () => makeResolved([makeCheck('check-a', true), makeCheck('check-b', true)]),
    () => { throw new Error('broker boom'); },
  );
  const result = await evaluate(adapter);
  assertStatusRecord(result, 'UNAVAILABLE');
  assert.equal(brokerCalls.length, 1, 'first UNAVAILABLE stops later broker calls');
});

// ── 15–16. Malformed row shapes and unknown result kind ─────────────────────

test('every malformed BOOLEAN_SINGLE_ROW shape maps to UNAVAILABLE', async () => {
  const accessorRow = {};
  Object.defineProperty(accessorRow, FIELD, { enumerable: true, get() { return true; } });
  const symbolRow = {};
  symbolRow[FIELD] = true;
  symbolRow[Symbol('extra')] = 1;
  const customProtoRow = Object.create({ [FIELD]: true });
  const inheritedRow = Object.create({ [FIELD]: true });
  const proxyRow = new Proxy({ [FIELD]: true }, {});
  const revokedRow = Proxy.revocable({ [FIELD]: true }, {});
  revokedRow.revoke();
  const sparseRows = [];
  sparseRows.length = 1; // hole at index 0

  const malformedBrokerResults = [
    () => ({ rows: [] }),                                   // zero rows
    () => ({ rows: [{ [FIELD]: true }, { [FIELD]: true }] }), // multiple rows
    () => ({ rows: sparseRows }),                           // sparse rows
    () => ({ rows: [{}] }),                                 // missing field
    () => ({ rows: [{ other: true }] }),                    // wrong field
    () => ({ rows: [{ [FIELD]: true, extra: 1 }] }),        // extra field
    () => ({ rows: [accessorRow] }),                        // accessor field
    () => ({ rows: [inheritedRow] }),                       // inherited field
    () => ({ rows: [customProtoRow] }),                     // custom prototype
    () => ({ rows: [{ [FIELD]: null }] }),                  // null
    () => ({ rows: [{ [FIELD]: 'yes' }] }),                 // non-boolean
    () => ({ rows: [symbolRow] }),                          // symbol key
    () => ({ rows: [proxyRow] }),                           // Proxy row
    () => ({ rows: [revokedRow.proxy] }),                   // revoked Proxy row
    () => ({ rows: 'x' }),                                  // rows not an array
    () => ({ rows: [42] }),                                 // row not an object
    () => 42,                                               // broker result not a record
    () => 'x',
    () => null,
  ];

  for (const brokerImpl of malformedBrokerResults) {
    const { adapter, brokerCalls } = makeHarness(
      () => makeResolved([makeCheck('check-a', true)]),
      brokerImpl,
    );
    const result = await evaluate(adapter);
    assertStatusRecord(result, 'UNAVAILABLE');
    assert.equal(brokerCalls.length, 1, 'malformed row shape observed by broker');
  }
});

test('unknown result kind maps to UNAVAILABLE before any broker call', async () => {
  const check = makeCheck('check-a', true, FIELD, []);
  check.query.resultContract.kind = 'SCALAR';
  const { adapter, brokerCalls } = makeHarness(
    () => makeResolved([check]),
    () => makeRow(FIELD, true),
  );
  const result = await evaluate(adapter);
  assertStatusRecord(result, 'UNAVAILABLE');
  assert.equal(brokerCalls.length, 0, 'unknown kind rejected before broker call');
});

// ── 17. Whole-envelope pre-validation before the first broker call ─────────

test('entire resolved envelope is validated before the first broker call', async () => {
  const malformedChecks = [
    () => { const c = makeCheck('check-b', true); c.query = undefined; return c; },
    () => { const c = makeCheck('check-b', true); c.expected = 'yes'; return c; },
    () => { const c = makeCheck('check-b', true); delete c.query.values; return c; },
    () => { const c = makeCheck('check-b', true); c.query.resultContract = { kind: 'NOPE', field: FIELD }; return c; },
    () => { const c = makeCheck('check-b', true); c.query.resultContract.field = ''; return c; },
    () => { const c = makeCheck('check-b', true); c.query.name = ''; return c; },
    () => { const c = makeCheck('check-b', true); c.query.values = [1, , 3]; return c; },
  ];
  for (const makeMalformed of malformedChecks) {
    const malformed = makeMalformed();
    const { adapter, brokerCalls } = makeHarness(
      () => makeResolved([makeCheck('check-a', true), malformed]),
      () => makeRow(FIELD, true),
    );
    const result = await evaluate(adapter);
    assertStatusRecord(result, 'UNAVAILABLE');
    assert.equal(brokerCalls.length, 0, 'no partial execution before full envelope validation');
  }
});

// ── 18–20. Broker query boundary and lockHandle identity ────────────────────

test('broker receives exact { lockHandle, query:{name,text,values} } without resultContract', async () => {
  let captured = null;
  const { adapter } = makeHarness(
    () => makeResolved([makeCheck('check-a', true, FIELD, [1, 'two', true])]),
    (arg) => {
      captured = arg;
      return makeRow(FIELD, true);
    },
  );
  const result = await evaluate(adapter);
  assertStatusRecord(result, 'PASS');
  assert.ok(captured, 'broker called');
  assert.deepEqual(Object.keys(captured), ['lockHandle', 'query'], 'broker envelope exact two keys');
  assert.deepEqual(Object.keys(captured.query), ['name', 'text', 'values'], 'broker query exact three keys');
  assert.equal('resultContract' in captured.query, false, 'resultContract stripped before broker');
  assert.equal(captured.query.name, 'check-a-query');
  assert.equal(captured.query.text, 'inert fixture');
  assert.deepEqual([...captured.query.values], [1, 'two', true], 'values preserved');
});

test('the exact opaque lockHandle identity is forwarded unchanged', async () => {
  let capturedHandle = null;
  const { adapter } = makeHarness(
    () => makeResolved([makeCheck('check-a', true)]),
    (arg) => {
      capturedHandle = arg.lockHandle;
      return makeRow(FIELD, true);
    },
  );
  await evaluate(adapter);
  assert.equal(capturedHandle, LOCK, 'broker received the exact same lockHandle identity');
});

test('broker query and values are detached and frozen', async () => {
  let captured = null;
  const values = [1, 'two', true];
  const { adapter } = makeHarness(
    () => makeResolved([makeCheck('check-a', true, FIELD, values)]),
    (arg) => {
      captured = arg;
      return makeRow(FIELD, true);
    },
  );
  await evaluate(adapter);
  assert.ok(Object.isFrozen(captured.query), 'broker query frozen');
  assert.ok(Object.isFrozen(captured.query.values), 'broker query values frozen');
  assert.notEqual(captured.query.values, values, 'values detached from resolver input');
});

// ── 21–22. Call counts and no raw exposure ─────────────────────────────────

test('dependencies are called at most once per required operation', async () => {
  const { adapter, resolverCalls, brokerCalls } = makeHarness(
    () => makeResolved([makeCheck('check-a', true), makeCheck('check-b', true)]),
    () => makeRow(FIELD, true),
  );
  await evaluate(adapter);
  assert.equal(resolverCalls.length, 1, 'resolver called exactly once');
  assert.equal(brokerCalls.length, 2, 'broker called exactly once per check');
});

test('raw error, message, stack, row, or handle never appears in result or console', async () => {
  const consoleLogs = [];
  const originalLog = console.log;
  const originalError = console.error;
  console.log = (...args) => { consoleLogs.push(args); };
  console.error = (...args) => { consoleLogs.push(args); };
  try {
    const { adapter } = makeHarness(
      () => { throw new Error('SUPER_SECRET_RESOLVER_BOOM'); },
      () => { throw new Error('SUPER_SECRET_BROKER_BOOM'); },
    );
    const result = await evaluate(adapter);
    assertStatusRecord(result, 'UNAVAILABLE');
    assert.equal('SUPER_SECRET_RESOLVER_BOOM' in result, false, 'no raw resolver error in result');
    assert.equal('SUPER_SECRET_BROKER_BOOM' in result, false, 'no raw broker error in result');
    assert.equal(JSON.stringify(result).includes('SUPER_SECRET'), false, 'no secret text serialized');
    assert.equal(consoleLogs.length, 0, 'no console output during evaluation');
  } finally {
    console.log = originalLog;
    console.error = originalError;
  }
});

// ── 23. No runtime/network/driver/retry capability ─────────────────────────

test('adapter source contains no retry, timeout, sleep, driver, or network capability', () => {
  const source = fs.readFileSync(CORE, 'utf8');
  const forbidden = [
    /setTimeout/, /setInterval/, /sleep/,
    /require\(['"]pg['"]\)/, /require\(['"]child_process['"]\)/,
    /require\(['"]net['"]\)/, /require\(['"]http/,
    /\bfetch\s*\(/, /https\.request/,
    /console\./, /process\.env/,
  ];
  for (const re of forbidden) {
    assert.ok(!re.test(source), 'forbidden capability in adapter source: ' + re);
  }
  assert.ok(source.includes('node:util'), 'only node:util dependency required');
});

// ── 24. Orchestrator status compatibility ──────────────────────────────────

test('evaluator statuses are accepted by the orchestrator dependency contract', () => {
  const orchestratorSource = fs.readFileSync(ORCHESTRATOR, 'utf8');
  const expected = ['PASS', 'FAIL', 'UNAVAILABLE', 'NOT_EVALUATED'];
  for (const status of expected) {
    assert.ok(orchestratorSource.includes(`'${status}'`), 'orchestrator accepts status ' + status);
  }
  assert.ok(
    /CONDITION_STATUSES\s*=\s*new Set\(\[[^\]]*'PASS'[^\]]*'FAIL'[^\]]*'UNAVAILABLE'[^\]]*'NOT_EVALUATED'[^\]]*\]\)/.test(orchestratorSource),
    'orchestrator CONDITION_STATUSES contains the evaluator status vocabulary',
  );
});

// ── Thenable-safe dependency handling ───────────────────────────────────────

test('hostile then getter on resolver and broker results is never invoked and maps to UNAVAILABLE', async () => {
  let resolverGetter = 0;
  const hostileResolverResult = { status: 'NOT_FOUND' };
  Object.defineProperty(hostileResolverResult, 'then', {
    get() { resolverGetter += 1; return () => {}; },
  });
  const h1 = makeRawHarness(() => hostileResolverResult, () => makeRow(FIELD, true));
  assertStatusRecord(await evaluate(h1.adapter), 'UNAVAILABLE');
  assert.equal(resolverGetter, 0, 'resolver then getter never invoked');
  assert.equal(h1.brokerCalls.length, 0, 'broker not called');

  let brokerGetter = 0;
  const hostileBrokerResult = { rows: [{ [FIELD]: true }] };
  Object.defineProperty(hostileBrokerResult, 'then', {
    get() { brokerGetter += 1; return () => {}; },
  });
  const h2 = makeRawHarness(
    () => makeResolved([makeCheck('check-a', true)]),
    () => hostileBrokerResult,
  );
  assertStatusRecord(await evaluate(h2.adapter), 'UNAVAILABLE');
  assert.equal(brokerGetter, 0, 'broker then getter never invoked');
});

test('non-native thenable with callable then is never invoked and maps to UNAVAILABLE', async () => {
  let thenCalled = 0;
  const thenable = {
    then() { thenCalled += 1; return Promise.resolve({ status: 'NOT_FOUND' }); },
  };
  const h1 = makeRawHarness(() => thenable, () => makeRow(FIELD, true));
  assertStatusRecord(await evaluate(h1.adapter), 'UNAVAILABLE');
  assert.equal(thenCalled, 0, 'then never invoked');
  assert.equal(h1.brokerCalls.length, 0, 'broker not called');

  const brokerThenable = {
    rows: [{ [FIELD]: true }],
    then() { thenCalled += 1; return Promise.resolve({ rows: [{ [FIELD]: true }] }); },
  };
  const h2 = makeRawHarness(
    () => makeResolved([makeCheck('check-a', true)]),
    () => brokerThenable,
  );
  assertStatusRecord(await evaluate(h2.adapter), 'UNAVAILABLE');
  assert.equal(thenCalled, 0, 'broker then never invoked');
});

test('native Promise resolve/reject, sync plain results, Proxy and revoked Proxy thenables', async () => {
  // Native Promise resolve -> normal processing.
  const h1 = makeRawHarness(() => Promise.resolve({ status: 'NOT_FOUND' }), () => makeRow(FIELD, true));
  assertStatusRecord(await evaluate(h1.adapter), 'NOT_EVALUATED');

  // Native Promise reject -> UNAVAILABLE.
  const h2 = makeRawHarness(() => Promise.reject(new Error('resolver boom')), () => makeRow(FIELD, true));
  assertStatusRecord(await evaluate(h2.adapter), 'UNAVAILABLE');

  // Sync plain result -> normal processing.
  const h3 = makeRawHarness(() => ({ status: 'NOT_FOUND' }), () => makeRow(FIELD, true));
  assertStatusRecord(await evaluate(h3.adapter), 'NOT_EVALUATED');

  // Proxy thenable -> UNAVAILABLE.
  const proxyThenable = new Proxy({ then() {} }, {});
  const h4 = makeRawHarness(() => proxyThenable, () => makeRow(FIELD, true));
  assertStatusRecord(await evaluate(h4.adapter), 'UNAVAILABLE');

  // Revoked Proxy -> UNAVAILABLE.
  const revoked = Proxy.revocable({ status: 'NOT_FOUND' }, {});
  revoked.revoke();
  const h5 = makeRawHarness(() => revoked.proxy, () => makeRow(FIELD, true));
  assertStatusRecord(await evaluate(h5.adapter), 'UNAVAILABLE');

  // Promise subclass -> UNAVAILABLE without awaiting.
  class SubPromise extends Promise {}
  const h6 = makeRawHarness(() => new SubPromise(() => {}), () => makeRow(FIELD, true));
  assertStatusRecord(await evaluate(h6.adapter), 'UNAVAILABLE');
});

// ── Exact plain-record validation (factory config + method input) ──────────

test('factory config rejects function, array, custom prototype, symbol, non-enumerable, accessor, Proxy', () => {
  const fn = () => {};
  fn.resolvePreconditionAuthority = fn;
  fn.queryLockedSession = fn;
  const arr = [];
  arr.resolvePreconditionAuthority = fn;
  arr.queryLockedSession = fn;
  const customProto = Object.create({ resolvePreconditionAuthority: fn, queryLockedSession: fn });
  const withSymbol = { resolvePreconditionAuthority: fn, queryLockedSession: fn };
  withSymbol[Symbol('extra')] = 1;
  const withNonEnumerable = { resolvePreconditionAuthority: fn, queryLockedSession: fn };
  Object.defineProperty(withNonEnumerable, 'extra', { value: 1, enumerable: false });
  const withAccessor = { queryLockedSession: fn };
  Object.defineProperty(withAccessor, 'resolvePreconditionAuthority', { get() { return fn; } });
  const proxyConfig = new Proxy({ resolvePreconditionAuthority: fn, queryLockedSession: fn }, {});
  const revokedConfig = Proxy.revocable({ resolvePreconditionAuthority: fn, queryLockedSession: fn }, {});
  revokedConfig.revoke();

  for (const bad of [fn, arr, customProto, withSymbol, withNonEnumerable, withAccessor, proxyConfig, revokedConfig.proxy]) {
    assert.throws(
      () => createMigrationPreconditionEvaluatorAdapter(bad),
      /MIGRATION_PRECONDITION_EVALUATOR_CONFIG_INVALID/,
      'bounded factory error for hostile config',
    );
  }
});

test('evaluatePrecondition input rejects hostile shapes with zero dependency calls', async () => {
  const { adapter, resolverCalls, brokerCalls } = makeRawHarness(
    () => ({ status: 'ADOPTION_REQUIRED' }),
    () => makeRow(FIELD, true),
  );

  const fnInput = () => {};
  fnInput.targetMigrationId = TARGET;
  fnInput.lockHandle = LOCK;
  const arrInput = [];
  arrInput.targetMigrationId = TARGET;
  arrInput.lockHandle = LOCK;
  const customProtoInput = Object.create({ targetMigrationId: TARGET });
  customProtoInput.lockHandle = LOCK;
  const symbolInput = { targetMigrationId: TARGET, lockHandle: LOCK };
  symbolInput[Symbol('extra')] = 1;
  const nonEnumerableInput = { targetMigrationId: TARGET, lockHandle: LOCK };
  Object.defineProperty(nonEnumerableInput, 'extra', { value: 1, enumerable: false });
  const accessorInput = { lockHandle: LOCK };
  Object.defineProperty(accessorInput, 'targetMigrationId', { get() { return TARGET; } });
  const proxyInput = new Proxy({ targetMigrationId: TARGET, lockHandle: LOCK }, {});
  const revokedInput = Proxy.revocable({ targetMigrationId: TARGET, lockHandle: LOCK }, {});
  revokedInput.revoke();

  for (const bad of [
    fnInput, arrInput, customProtoInput, symbolInput, nonEnumerableInput,
    accessorInput, proxyInput, revokedInput.proxy,
  ]) {
    const result = await adapter.evaluatePrecondition(bad);
    assertStatusRecord(result, 'UNAVAILABLE');
  }
  assert.equal(resolverCalls.length, 0, 'resolver never invoked for hostile input');
  assert.equal(brokerCalls.length, 0, 'broker never invoked for hostile input');
});

test('resolver status result rejects symbol, non-enumerable, accessor, custom prototype, wrong keys', async () => {
  const withSymbol = { status: 'NOT_FOUND' };
  withSymbol[Symbol('extra')] = 1;
  const withNonEnumerable = { status: 'NOT_FOUND' };
  Object.defineProperty(withNonEnumerable, 'extra', { value: 1, enumerable: false });
  const withAccessor = {};
  Object.defineProperty(withAccessor, 'status', { get() { return 'NOT_FOUND'; } });
  const customProto = Object.create({ status: 'NOT_FOUND' });
  const wrongKeys = { status: 'NOT_FOUND', extra: 1 };

  for (const hostile of [withSymbol, withNonEnumerable, withAccessor, customProto, wrongKeys]) {
    const { adapter, brokerCalls } = makeRawHarness(() => hostile, () => makeRow(FIELD, true));
    assertStatusRecord(await evaluate(adapter), 'UNAVAILABLE');
    assert.equal(brokerCalls.length, 0, 'broker not called for malformed resolver result');
  }
});

test('malformed check/query/resultContract shapes fail the whole envelope before any broker call', async () => {
  const symCheck = makeCheck('check-b', true);
  symCheck[Symbol('extra')] = 1;
  const nonEnumCheck = makeCheck('check-b', true);
  Object.defineProperty(nonEnumCheck, 'extra', { value: 1, enumerable: false });
  const accessorCheck = makeCheck('check-b', true);
  Object.defineProperty(accessorCheck, 'checkId', { get() { return 'check-b'; } });
  const customProtoCheck = Object.create({ checkId: 'check-b', expected: true });
  customProtoCheck.query = makeCheck('check-b', true).query;
  const wrongCheckKeys = { checkId: 'check-b', expected: true, query: makeCheck('check-b', true).query, extra: 1 };

  const malformedChecks = [symCheck, nonEnumCheck, accessorCheck, customProtoCheck, wrongCheckKeys];

  for (const malformedCheck of malformedChecks) {
    const { adapter, brokerCalls } = makeRawHarness(
      () => makeResolved([makeCheck('check-a', true), malformedCheck]),
      () => makeRow(FIELD, true),
    );
    assertStatusRecord(await evaluate(adapter), 'UNAVAILABLE');
    assert.equal(brokerCalls.length, 0, 'no partial execution before full envelope validation');
  }

  // Malformed query shapes.
  const queryMutations = [
    (q) => { q.extra = 1; },                                   // extra key
    (q) => { q.name = ''; },                                   // empty name
    (q) => { q.text = ''; },                                   // empty text
    (q) => { q.values = [NaN]; },                              // NaN value
    (q) => { q.values = [Infinity]; },                         // Infinity value
    (q) => { q.values = [-Infinity]; },                        // -Infinity value
    (q) => { q.resultContract = { kind: 'SCALAR', field: FIELD }; }, // unknown kind
    (q) => { q.resultContract = { kind: 'BOOLEAN_SINGLE_ROW', field: '' }; }, // empty field
  ];
  for (const mutate of queryMutations) {
    const check = makeCheck('check-b', true);
    mutate(check.query);
    const { adapter, brokerCalls } = makeRawHarness(
      () => makeResolved([check]),
      () => makeRow(FIELD, true),
    );
    assertStatusRecord(await evaluate(adapter), 'UNAVAILABLE');
    assert.equal(brokerCalls.length, 0, 'malformed query rejected before broker call');
  }
});

// ── Descriptor-safe dense arrays (checks / values / rows) ───────────────────

test('checks and values arrays reject accessor indexes, symbols, extra keys, custom prototypes, sparse, Proxy', async () => {
  let accessorRead = 0;
  const accessorChecks = [];
  accessorChecks.length = 1;
  Object.defineProperty(accessorChecks, '0', {
    enumerable: true,
    get() { accessorRead += 1; return makeCheck('check-a', true); },
  });
  const h1 = makeRawHarness(() => ({ status: 'RESOLVED', checks: accessorChecks }), () => makeRow(FIELD, true));
  assertStatusRecord(await evaluate(h1.adapter), 'UNAVAILABLE');
  assert.equal(accessorRead, 0, 'accessor index getter never invoked');
  assert.equal(h1.brokerCalls.length, 0, 'broker not called');

  const symbolChecks = [makeCheck('check-a', true)];
  symbolChecks[Symbol('extra')] = 1;
  const extraKeyChecks = [makeCheck('check-a', true)];
  extraKeyChecks.extra = 1;
  const customProtoChecks = [makeCheck('check-a', true)];
  Object.setPrototypeOf(customProtoChecks, {});
  const sparseChecks = [];
  sparseChecks.length = 1;
  const proxyChecks = new Proxy([makeCheck('check-a', true)], {});
  const revokedChecks = Proxy.revocable([makeCheck('check-a', true)], {});
  revokedChecks.revoke();

  for (const badChecks of [symbolChecks, extraKeyChecks, customProtoChecks, sparseChecks, proxyChecks, revokedChecks.proxy]) {
    const { adapter, brokerCalls } = makeRawHarness(
      () => ({ status: 'RESOLVED', checks: badChecks }),
      () => makeRow(FIELD, true),
    );
    assertStatusRecord(await evaluate(adapter), 'UNAVAILABLE');
    assert.equal(brokerCalls.length, 0, 'malformed checks array rejected before broker call');
  }

  // Values arrays: accessor index getter 0, symbol, extra key, custom proto,
  // sparse, Proxy, revoked Proxy.
  let valuesAccessorRead = 0;
  const accessorValues = [];
  accessorValues.length = 1;
  Object.defineProperty(accessorValues, '0', { enumerable: true, get() { valuesAccessorRead += 1; return 1; } });
  const h2 = makeRawHarness(
    () => makeResolved([makeCheck('check-a', true, FIELD, accessorValues)]),
    () => makeRow(FIELD, true),
  );
  assertStatusRecord(await evaluate(h2.adapter), 'UNAVAILABLE');
  assert.equal(valuesAccessorRead, 0, 'values accessor index getter never invoked');
  assert.equal(h2.brokerCalls.length, 0, 'broker not called');

  const symbolValues = [1];
  symbolValues[Symbol('extra')] = 1;
  const extraKeyValues = [1];
  extraKeyValues.extra = 1;
  const customProtoValues = [1];
  Object.setPrototypeOf(customProtoValues, {});
  const sparseValues = [];
  sparseValues.length = 1;
  const proxyValues = new Proxy([1], {});
  const revokedValues = Proxy.revocable([1], {});
  revokedValues.revoke();

  for (const badValues of [symbolValues, extraKeyValues, customProtoValues, sparseValues, proxyValues, revokedValues.proxy]) {
    const { adapter, brokerCalls } = makeRawHarness(
      () => makeResolved([makeCheck('check-a', true, FIELD, badValues)]),
      () => makeRow(FIELD, true),
    );
    assertStatusRecord(await evaluate(adapter), 'UNAVAILABLE');
    assert.equal(brokerCalls.length, 0, 'malformed values array rejected before broker call');
  }
});

test('broker rows array rejects accessor indexes, symbols, extra keys, custom prototypes, sparse, Proxy', async () => {
  let rowsAccessorRead = 0;
  const accessorRows = [];
  accessorRows.length = 1;
  Object.defineProperty(accessorRows, '0', {
    enumerable: true,
    get() { rowsAccessorRead += 1; return { [FIELD]: true }; },
  });
  const h1 = makeRawHarness(
    () => makeResolved([makeCheck('check-a', true)]),
    () => ({ rows: accessorRows }),
  );
  assertStatusRecord(await evaluate(h1.adapter), 'UNAVAILABLE');
  assert.equal(rowsAccessorRead, 0, 'rows accessor index getter never invoked');

  const symbolRows = [{ [FIELD]: true }];
  symbolRows[Symbol('extra')] = 1;
  const extraKeyRows = [{ [FIELD]: true }];
  extraKeyRows.extra = 1;
  const customProtoRows = [{ [FIELD]: true }];
  Object.setPrototypeOf(customProtoRows, {});
  const sparseRows = [];
  sparseRows.length = 1;
  const proxyRows = new Proxy([{ [FIELD]: true }], {});
  const revokedRows = Proxy.revocable([{ [FIELD]: true }], {});
  revokedRows.revoke();

  for (const badRows of [symbolRows, extraKeyRows, customProtoRows, sparseRows, proxyRows, revokedRows.proxy]) {
    const { adapter } = makeRawHarness(
      () => makeResolved([makeCheck('check-a', true)]),
      () => ({ rows: badRows }),
    );
    assertStatusRecord(await evaluate(adapter), 'UNAVAILABLE');
  }
});
