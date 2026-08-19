const assert = require('node:assert/strict');
const test = require('node:test');

const MODULE_PATH = '../../functions/_shared/db/neon-ws-transaction-adapter.js';
const NEON_URL = 'postgresql://ep-synthetic-transaction.us-east-1.neon.tech/neondb?sslmode=require';

async function loadModule() {
  return import(MODULE_PATH);
}

function makeClientFactory(options = {}) {
  const clients = [];
  class FakeClient {
    constructor(config) {
      this.id = clients.length + 1;
      this.config = config;
      this.events = [];
      clients.push(this);
      if (options.constructError) throw options.constructError;
    }

    async connect() {
      this.events.push(['connect']);
      if (options.connectError) throw options.connectError;
    }

    async query(text, values) {
      this.events.push(['query', text, values]);
      if (text === 'COMMIT' && options.commitError) throw options.commitError;
      if (text === 'ROLLBACK' && options.rollbackError) throw options.rollbackError;
      if (typeof options.queryHook === 'function') {
        return options.queryHook(this, text, values);
      }
      return { rows: [{ client_id: this.id, text, values }] };
    }

    async end() {
      this.events.push(['end']);
      if (options.endError) throw options.endError;
    }
  }
  return { Client: FakeClient, clients };
}

test('constants freeze Neon WS transaction semantics and disable automatic whole-transaction retry', async () => {
  const {
    NEON_WS_TRANSACTION_CAPABILITIES,
    NEON_WS_TRANSACTION_RETRY_POLICY,
    NEON_WS_TRANSACTION_STATE,
  } = await loadModule();

  assert.equal(Object.isFrozen(NEON_WS_TRANSACTION_CAPABILITIES), true);
  assert.equal(Object.isFrozen(NEON_WS_TRANSACTION_RETRY_POLICY), true);
  assert.equal(Object.isFrozen(NEON_WS_TRANSACTION_STATE), true);
  assert.equal(NEON_WS_TRANSACTION_CAPABILITIES.requestScopedClientAffinity, true);
  assert.equal(NEON_WS_TRANSACTION_CAPABILITIES.advisoryTransactionLocks, true);
  assert.equal(NEON_WS_TRANSACTION_RETRY_POLICY.wholeTransactionAttempts, 1);
  assert.equal(NEON_WS_TRANSACTION_RETRY_POLICY.automaticWholeTransactionRetries, 0);
  assert.equal(NEON_WS_TRANSACTION_RETRY_POLICY.retryOnUnknownCommitOutcome, false);
});

test('config rejects non-Neon connection strings before the lazy importer runs', async () => {
  const { createNeonWsTransactionAdapter, NEON_WS_TRANSACTION_ERROR } = await loadModule();
  let importerCalls = 0;
  await assert.rejects(
    () => createNeonWsTransactionAdapter({
      connectionString: 'postgresql://localhost/lovebud',
      neonImporter: async () => {
        importerCalls += 1;
        return makeClientFactory();
      },
    }),
    (error) => error.code === NEON_WS_TRANSACTION_ERROR.CONFIG_INVALID,
  );
  assert.equal(importerCalls, 0);
});

test('one transaction keeps BEGIN, work, locks, canonical reread, and COMMIT on one request-scoped client', async () => {
  const {
    createNeonWsTransactionAdapter,
    NEON_WS_TRANSACTION_COMMIT_OUTCOME,
    NEON_WS_TRANSACTION_STATE,
    __NEON_WS_TRANSACTION_TEST_ONLY,
  } = await loadModule();
  const fake = makeClientFactory();
  const adapter = await createNeonWsTransactionAdapter({
    connectionString: NEON_URL,
    neonImporter: async () => fake,
  });

  const result = await adapter.runTransaction(async (tx) => {
    await tx.query('UPDATE synthetic SET value = $1 WHERE id = $2', ['next', 7]);
    await tx.advisoryXactLock('tree:7');
    await tx.forShare('SELECT id FROM synthetic WHERE id = $1 FOR SHARE', [7]);
    await tx.forUpdate('SELECT id FROM synthetic WHERE id = $1 FOR UPDATE', [7]);
    const rows = await tx.canonicalReread('SELECT value FROM synthetic WHERE id = $1', [7]);
    return rows.length;
  });

  assert.equal(fake.clients.length, 1);
  const client = fake.clients[0];
  const queryEvents = client.events.filter((event) => event[0] === 'query');
  assert.equal(queryEvents[0][1], __NEON_WS_TRANSACTION_TEST_ONLY.BEGIN_SQL);
  assert.equal(queryEvents.at(-1)[1], __NEON_WS_TRANSACTION_TEST_ONLY.COMMIT_SQL);
  assert.equal(queryEvents.some((event) => event[1] === __NEON_WS_TRANSACTION_TEST_ONLY.ADVISORY_XACT_LOCK_SQL), true);
  assert.equal(client.events.at(-1)[0], 'end');
  assert.equal(result.commitOutcome, NEON_WS_TRANSACTION_COMMIT_OUTCOME.COMMITTED);
  assert.equal(result.state, NEON_WS_TRANSACTION_STATE.CLOSED);
  assert.equal(result.stats.connectionCount, 1);
  assert.equal(result.stats.closeCount, 1);
  assert.equal(result.stats.advisoryLockCount, 1);
  assert.equal(result.stats.rowLockCount, 2);
  assert.equal(result.stats.canonicalRereadCount, 1);
});

test('query contract forwards values out-of-band and rejects placeholder mismatches before driver execution', async () => {
  const { createNeonWsTransactionAdapter, NEON_WS_TRANSACTION_ERROR } = await loadModule();
  const fake = makeClientFactory();
  const adapter = await createNeonWsTransactionAdapter({ connectionString: NEON_URL, neonImporter: async () => fake });

  await assert.rejects(
    () => adapter.runTransaction((tx) => tx.query('SELECT $1::text, $2::int', ['only-one'])),
    (error) => error.code === NEON_WS_TRANSACTION_ERROR.QUERY_INVALID,
  );

  const client = fake.clients[0];
  assert.equal(client.events.some((event) => event[0] === 'query' && event[1].startsWith('SELECT $1')), false);
  assert.equal(client.events.some((event) => event[0] === 'query' && event[1] === 'ROLLBACK'), true);
});

test('work cannot issue transaction-control statements outside the adapter state machine', async () => {
  const { createNeonWsTransactionAdapter, NEON_WS_TRANSACTION_ERROR } = await loadModule();
  const fake = makeClientFactory();
  const adapter = await createNeonWsTransactionAdapter({ connectionString: NEON_URL, neonImporter: async () => fake });

  await assert.rejects(
    () => adapter.runTransaction((tx) => tx.query('COMMIT', [])),
    (error) => error.code === NEON_WS_TRANSACTION_ERROR.QUERY_INVALID,
  );
  const queryTexts = fake.clients[0].events.filter((event) => event[0] === 'query').map((event) => event[1]);
  assert.deepEqual(queryTexts, ['BEGIN', 'ROLLBACK']);
});

test('work failure rolls back exactly once, closes the client, and never commits', async () => {
  const { createNeonWsTransactionAdapter, NEON_WS_TRANSACTION_ERROR } = await loadModule();
  const fake = makeClientFactory();
  const adapter = await createNeonWsTransactionAdapter({ connectionString: NEON_URL, neonImporter: async () => fake });

  await assert.rejects(
    () => adapter.runTransaction(async (tx) => {
      await tx.query('UPDATE synthetic SET value = $1 WHERE id = $2', ['x', 1]);
      throw new Error('synthetic work failure');
    }),
    (error) => error.code === NEON_WS_TRANSACTION_ERROR.WORK_FAILURE,
  );

  const client = fake.clients[0];
  const queryTexts = client.events.filter((event) => event[0] === 'query').map((event) => event[1]);
  assert.deepEqual(queryTexts, [
    'BEGIN',
    'UPDATE synthetic SET value = $1 WHERE id = $2',
    'ROLLBACK',
  ]);
  assert.equal(client.events.at(-1)[0], 'end');
});

test('COMMIT transport failure is classified as unknown outcome with no rollback and no automatic whole-transaction retry', async () => {
  const {
    createNeonWsTransactionAdapter,
    NEON_WS_TRANSACTION_COMMIT_OUTCOME,
    NEON_WS_TRANSACTION_ERROR,
  } = await loadModule();
  const fake = makeClientFactory({ commitError: new Error('socket closed after write') });
  const adapter = await createNeonWsTransactionAdapter({ connectionString: NEON_URL, neonImporter: async () => fake });

  let thrown;
  try {
    await adapter.runTransaction((tx) => tx.query('UPDATE synthetic SET value = $1 WHERE id = $2', ['x', 1]));
  } catch (error) {
    thrown = error;
  }
  assert.ok(thrown);
  assert.equal(thrown.code, NEON_WS_TRANSACTION_ERROR.COMMIT_OUTCOME_UNKNOWN);
  assert.equal(thrown.commitOutcome, NEON_WS_TRANSACTION_COMMIT_OUTCOME.UNKNOWN);
  assert.equal(thrown.wholeTransactionRetrySafe, false);
  assert.equal(fake.clients.length, 1);
  const queryTexts = fake.clients[0].events.filter((event) => event[0] === 'query').map((event) => event[1]);
  assert.deepEqual(queryTexts, [
    'BEGIN',
    'UPDATE synthetic SET value = $1 WHERE id = $2',
    'COMMIT',
  ]);
  assert.equal(fake.clients[0].events.at(-1)[0], 'end');
});

test('rollback transport failure is explicit and does not pretend the transaction was safely restored', async () => {
  const { createNeonWsTransactionAdapter, NEON_WS_TRANSACTION_ERROR } = await loadModule();
  const fake = makeClientFactory({ rollbackError: new Error('rollback transport failure') });
  const adapter = await createNeonWsTransactionAdapter({ connectionString: NEON_URL, neonImporter: async () => fake });

  await assert.rejects(
    () => adapter.runTransaction(() => {
      throw new Error('work failed');
    }),
    (error) => error.code === NEON_WS_TRANSACTION_ERROR.ROLLBACK_FAILURE,
  );
  assert.equal(fake.clients.length, 1);
  assert.equal(fake.clients[0].events.at(-1)[0], 'end');
});

test('FOR SHARE and FOR UPDATE helpers require explicit static lock clauses', async () => {
  const { createNeonWsTransactionAdapter, NEON_WS_TRANSACTION_ERROR } = await loadModule();
  const fake = makeClientFactory();
  const adapter = await createNeonWsTransactionAdapter({ connectionString: NEON_URL, neonImporter: async () => fake });

  await assert.rejects(
    () => adapter.runTransaction((tx) => tx.forUpdate('SELECT id FROM synthetic WHERE id = $1', [1])),
    (error) => error.code === NEON_WS_TRANSACTION_ERROR.QUERY_INVALID,
  );
});

test('two concurrent transactions use two distinct request-scoped clients with no session crossover', async () => {
  const { createNeonWsTransactionAdapter } = await loadModule();
  let entered = 0;
  let release;
  const bothEntered = new Promise((resolve) => {
    release = resolve;
  });
  const fake = makeClientFactory({
    async queryHook(client, text, values) {
      if (text === 'SELECT $1::int AS request_id') {
        entered += 1;
        if (entered === 2) release();
        await bothEntered;
        return { rows: [{ client_id: client.id, request_id: values[0] }] };
      }
      return { rows: [] };
    },
  });
  const adapter = await createNeonWsTransactionAdapter({ connectionString: NEON_URL, neonImporter: async () => fake });

  const [first, second] = await Promise.all([
    adapter.runTransaction((tx) => tx.query('SELECT $1::int AS request_id', [101])),
    adapter.runTransaction((tx) => tx.query('SELECT $1::int AS request_id', [202])),
  ]);

  assert.equal(fake.clients.length, 2);
  assert.notEqual(first.value[0].client_id, second.value[0].client_id);
  assert.equal(first.value[0].request_id, 101);
  assert.equal(second.value[0].request_id, 202);
  for (const client of fake.clients) {
    const queryTexts = client.events.filter((event) => event[0] === 'query').map((event) => event[1]);
    assert.equal(queryTexts[0], 'BEGIN');
    assert.equal(queryTexts.at(-1), 'COMMIT');
    assert.equal(client.events.at(-1)[0], 'end');
  }
});

test('canonical reread occurs before COMMIT on the same transaction client', async () => {
  const { createNeonWsTransactionAdapter } = await loadModule();
  const fake = makeClientFactory();
  const adapter = await createNeonWsTransactionAdapter({ connectionString: NEON_URL, neonImporter: async () => fake });

  await adapter.runTransaction(async (tx) => {
    await tx.query('UPDATE synthetic SET value = $1 WHERE id = $2', ['after', 4]);
    await tx.canonicalReread('SELECT value FROM synthetic WHERE id = $1', [4]);
  });

  const queryTexts = fake.clients[0].events.filter((event) => event[0] === 'query').map((event) => event[1]);
  assert.deepEqual(queryTexts, [
    'BEGIN',
    'UPDATE synthetic SET value = $1 WHERE id = $2',
    'SELECT value FROM synthetic WHERE id = $1',
    'COMMIT',
  ]);
});

test('sanitized error output never exposes raw provider or connection details', async () => {
  const {
    NeonWsTransactionError,
    NEON_WS_TRANSACTION_COMMIT_OUTCOME,
    NEON_WS_TRANSACTION_ERROR,
    sanitizeNeonWsTransactionError,
  } = await loadModule();
  const error = new NeonWsTransactionError(
    NEON_WS_TRANSACTION_ERROR.CONNECTION_FAILURE,
    `failed ${NEON_URL}`,
    {
      commitOutcome: NEON_WS_TRANSACTION_COMMIT_OUTCOME.NOT_COMMITTED,
      transactionState: 'failed',
      status: 502,
    },
  );
  const sanitized = sanitizeNeonWsTransactionError(error);
  const serialized = JSON.stringify(sanitized);
  assert.equal(serialized.includes('neon.tech'), false);
  assert.equal(serialized.includes('postgresql://'), false);
  assert.equal(sanitized.code, NEON_WS_TRANSACTION_ERROR.CONNECTION_FAILURE);
  assert.equal(sanitized.whole_transaction_retry_safe, false);
});
