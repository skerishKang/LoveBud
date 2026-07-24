'use strict';

/**
 * Focused SOURCE_STATIC contract test: PostgreSQL migration-ledger read/append
 * adapter (#3458, seventh slice).
 *
 * Exercises scripts/migration-postgres-ledger-adapter-core.cjs by calling the real
 * exported factory and methods with synthetic JavaScript query mocks. No pg,
 * PostgreSQL, Docker, network, DATABASE_URL, environment secret, filesystem write,
 * child_process, real advisory lock, real ledger read/write, or actual SQL
 * execution is used. SQL is present only as contract strings; behavior is proven by
 * calling adapter methods and asserting call counts, query shapes, and results.
 *
 * Orchestrator compatibility is proven by wiring the real adapter's readLedger and
 * appendLedgerRecord into the real #3636 runCanonicalMigration with synthetic mocks
 * for the remaining dependencies.
 *
 * Refs #3458
 * Refs #3425 - Keep #3425 OPEN.
 * Refs #3435 - Keep #3435 OPEN.
 * Refs #3437 - Keep #3437 OPEN.
 * Refs #1882 - Keep #1882 OPEN.
 */

const { describe, it } = require('node:test');
const assert = require('node:assert');
const path = require('node:path');

const REPO_ROOT = path.resolve(__dirname, '..', '..');
const CORE_PATH = path.join(REPO_ROOT, 'scripts', 'migration-postgres-ledger-adapter-core.cjs');
const ORCH_PATH = path.join(REPO_ROOT, 'scripts', 'migration-runner-orchestrator-core.cjs');
const core = require(CORE_PATH);
const orch = require(ORCH_PATH);

const {
  POSTGRES_MIGRATION_LEDGER_RELATION,
  POSTGRES_MIGRATION_LEDGER_FIELDS,
  POSTGRES_MIGRATION_LEDGER_QUERIES,
  POSTGRES_LEDGER_APPEND_STATUSES,
  POSTGRES_LEDGER_READ_ERROR,
  createPostgresMigrationLedgerAdapter
} = core;

const READ_NAME = POSTGRES_MIGRATION_LEDGER_QUERIES.read.name;
const APPEND_NAME = POSTGRES_MIGRATION_LEDGER_QUERIES.append.name;
const READ_SQL = POSTGRES_MIGRATION_LEDGER_QUERIES.read.text;
const APPEND_SQL = POSTGRES_MIGRATION_LEDGER_QUERIES.append.text;
const FACTORY_ERROR = 'POSTGRES_LEDGER_ADAPTER_QUERY_LOCKED_SESSION_REQUIRED';
const TS = '2026-01-02T03:04:05.678Z';
const HANDLE = Object.freeze({ tag: 'OPAQUE_LOCK_HANDLE' });

function validRecord(over) {
  return {
    migration_id: '20260101000000_first',
    content_checksum: 'sha256:aaaa',
    applied_at: TS,
    runner_version: '1.0.0',
    environment_class: 'disposable',
    deployed_commit: 'sha256:commit',
    transaction_outcome: 'COMMITTED',
    ...(over || {})
  };
}

function readRow(over) {
  return validRecord(over);
}

// Flexible synthetic queryLockedSession broker. Records every { lockHandle, query }
// call. Routes by query name; supports sync or async, fixed values, impl functions,
// and a global throw.
function makeBroker(opts) {
  const o = opts || {};
  const calls = [];
  const route = (arg) => {
    calls.push(arg);
    if (o.throwError) throw o.throwError;
    const name = arg && arg.query && arg.query.name;
    if (name === READ_NAME) {
      if (typeof o.readImpl === 'function') return o.readImpl(arg);
      return 'read' in o ? o.read : { rows: [] };
    }
    if (name === APPEND_NAME) {
      if (typeof o.appendImpl === 'function') return o.appendImpl(arg);
      return 'append' in o ? o.append : { rows: [] };
    }
    return {};
  };
  const fn = o.sync ? route : (async (arg) => route(arg));
  fn.calls = calls;
  return fn;
}

function adapterWith(opts) {
  const broker = makeBroker(opts);
  return { adapter: createPostgresMigrationLedgerAdapter({ queryLockedSession: broker }), broker };
}

async function rejectsRead(adapter, ...rest) {
  let threw = null;
  try {
    await adapter.readLedger(rest.length === 0 ? { lockHandle: HANDLE } : rest[0]);
  } catch (error) {
    threw = error;
  }
  return threw;
}

// A real array's `length` cannot be redefined to a bogus value (RangeError /
// non-configurable), so hostile length evidence is modeled with a Proxy whose
// getOwnPropertyDescriptor trap reports a bogus `length` descriptor. Array.isArray
// still returns true (target is an array); only the reported length is hostile.
function rowsWithBogusLength(rows, bogusLength) {
  return new Proxy(rows, {
    getOwnPropertyDescriptor(target, prop) {
      if (prop === 'length') {
        return { value: bogusLength, writable: true, enumerable: false, configurable: false };
      }
      return Reflect.getOwnPropertyDescriptor(target, prop);
    }
  });
}

function rowsWithThrowingLength(rows) {
  return new Proxy(rows, {
    getOwnPropertyDescriptor(target, prop) {
      if (prop === 'length') throw new Error('length secret');
      return Reflect.getOwnPropertyDescriptor(target, prop);
    }
  });
}

describe('DB postgres ledger adapter contract (#3458)', () => {

  describe('1. Exports and factory boundary', () => {
    it('exports the required named bindings', () => {
      assert.strictEqual(typeof createPostgresMigrationLedgerAdapter, 'function');
      assert.strictEqual(POSTGRES_MIGRATION_LEDGER_RELATION, 'schema_migration_ledger');
      assert.deepStrictEqual(POSTGRES_MIGRATION_LEDGER_FIELDS, [
        'migration_id', 'content_checksum', 'applied_at', 'runner_version',
        'environment_class', 'deployed_commit', 'transaction_outcome'
      ]);
      assert.strictEqual(POSTGRES_LEDGER_READ_ERROR, 'POSTGRES_LEDGER_READ_UNAVAILABLE');
      assert.deepStrictEqual(POSTGRES_LEDGER_APPEND_STATUSES, { APPENDED: 'APPENDED', FAILED: 'FAILED', UNKNOWN: 'UNKNOWN' });
    });

    it('returns a frozen adapter with exactly readLedger and appendLedgerRecord', () => {
      const { adapter } = adapterWith({});
      assert.ok(Object.isFrozen(adapter));
      assert.deepStrictEqual(Object.keys(adapter).sort(), ['appendLedgerRecord', 'readLedger']);
      assert.strictEqual(typeof adapter.readLedger, 'function');
      assert.strictEqual(typeof adapter.appendLedgerRecord, 'function');
    });

    it('accepts an async broker', async () => {
      const { adapter } = adapterWith({ read: { rows: [readRow()] } });
      const rows = await adapter.readLedger({ lockHandle: HANDLE });
      assert.strictEqual(rows.length, 1);
    });

    it('accepts a sync broker', async () => {
      const { adapter } = adapterWith({ sync: true, read: { rows: [readRow()] } });
      const rows = await adapter.readLedger({ lockHandle: HANDLE });
      assert.strictEqual(rows.length, 1);
    });

    it('throws the fixed error when config is missing', () => {
      assert.throws(() => createPostgresMigrationLedgerAdapter(), (e) => e.message === FACTORY_ERROR);
      assert.throws(() => createPostgresMigrationLedgerAdapter(undefined), (e) => e.message === FACTORY_ERROR);
      assert.throws(() => createPostgresMigrationLedgerAdapter(null), (e) => e.message === FACTORY_ERROR);
    });

    it('throws the fixed error when queryLockedSession is missing', () => {
      assert.throws(() => createPostgresMigrationLedgerAdapter({}), (e) => e.message === FACTORY_ERROR);
    });

    it('throws the fixed error when queryLockedSession is a non-function', () => {
      for (const value of [0, 'fn', true, null, undefined, {}, []]) {
        assert.throws(() => createPostgresMigrationLedgerAdapter({ queryLockedSession: value }), (e) => e.message === FACTORY_ERROR);
      }
    });

    it('throws the fixed error when queryLockedSession is an accessor (getter not executed)', () => {
      let getterRan = false;
      const config = {};
      Object.defineProperty(config, 'queryLockedSession', {
        enumerable: true,
        get() { getterRan = true; return async () => ({ rows: [] }); }
      });
      assert.throws(() => createPostgresMigrationLedgerAdapter(config), (e) => e.message === FACTORY_ERROR);
      assert.strictEqual(getterRan, false);
    });

    it('throws the fixed error when the getter throws, without surfacing the raw error', () => {
      const config = {};
      Object.defineProperty(config, 'queryLockedSession', {
        enumerable: true,
        get() { throw new Error('SECRET_GETTER_FAILURE db.internal:5432'); }
      });
      let threw = null;
      try { createPostgresMigrationLedgerAdapter(config); } catch (e) { threw = e; }
      assert.ok(threw);
      assert.strictEqual(threw.message, FACTORY_ERROR);
      assert.ok(!/SECRET_GETTER_FAILURE/.test(threw.message));
      assert.ok(!/db\.internal/.test(threw.stack || ''));
    });

    it('throws the fixed error when queryLockedSession is inherited (not own)', () => {
      const proto = { queryLockedSession: async () => ({ rows: [] }) };
      const config = Object.create(proto);
      assert.throws(() => createPostgresMigrationLedgerAdapter(config), (e) => e.message === FACTORY_ERROR);
    });

    it('throws the fixed error when the config is a revoked Proxy', () => {
      const { proxy, revoke } = Proxy.revocable({ queryLockedSession: async () => ({ rows: [] }) }, {});
      revoke();
      assert.throws(() => createPostgresMigrationLedgerAdapter(proxy), (e) => e.message === FACTORY_ERROR);
    });

    it('throws the fixed error when queryLockedSession is a revoked Proxy wrapping a non-function', () => {
      const { proxy, revoke } = Proxy.revocable({}, {});
      revoke();
      assert.throws(() => createPostgresMigrationLedgerAdapter({ queryLockedSession: proxy }), (e) => e.message === FACTORY_ERROR);
    });

    it('pins the captured callable: later config mutation does not divert the broker', async () => {
      const original = makeBroker({ read: { rows: [readRow({ migration_id: 'orig' })] } });
      const replacement = makeBroker({ read: { rows: [readRow({ migration_id: 'replaced' })] } });
      const config = { queryLockedSession: original };
      const adapter = createPostgresMigrationLedgerAdapter(config);
      config.queryLockedSession = replacement; // mutate after capture
      const rows = await adapter.readLedger({ lockHandle: HANDLE });
      assert.strictEqual(rows[0].migration_id, 'orig');
      assert.strictEqual(original.calls.length, 1);
      assert.strictEqual(replacement.calls.length, 0);
    });
  });

  describe('2. Fixed relation, fields, and queries', () => {
    it('uses the fixed relation name', () => {
      assert.strictEqual(POSTGRES_MIGRATION_LEDGER_RELATION, 'schema_migration_ledger');
      assert.ok(READ_SQL.includes('FROM schema_migration_ledger'));
      assert.ok(APPEND_SQL.includes('INSERT INTO schema_migration_ledger'));
    });

    it('freezes the field order exactly', () => {
      assert.ok(Object.isFrozen(POSTGRES_MIGRATION_LEDGER_FIELDS));
      assert.deepStrictEqual([...POSTGRES_MIGRATION_LEDGER_FIELDS], [
        'migration_id', 'content_checksum', 'applied_at', 'runner_version',
        'environment_class', 'deployed_commit', 'transaction_outcome'
      ]);
    });

    it('freezes the query container and both query definitions', () => {
      assert.ok(Object.isFrozen(POSTGRES_MIGRATION_LEDGER_QUERIES));
      assert.ok(Object.isFrozen(POSTGRES_MIGRATION_LEDGER_QUERIES.read));
      assert.ok(Object.isFrozen(POSTGRES_MIGRATION_LEDGER_QUERIES.append));
      assert.ok(Object.isFrozen(POSTGRES_MIGRATION_LEDGER_QUERIES.read.values));
      assert.deepStrictEqual([...POSTGRES_MIGRATION_LEDGER_QUERIES.read.values], []);
    });

    it('uses exact named queries', () => {
      assert.strictEqual(READ_NAME, 'lovebud-migration-ledger-read-v1');
      assert.strictEqual(APPEND_NAME, 'lovebud-migration-ledger-append-v1');
    });

    it('read SQL lists all seven fields in order and formats applied_at as canonical UTC', () => {
      const idx = POSTGRES_MIGRATION_LEDGER_FIELDS.map((f) => READ_SQL.indexOf(f));
      for (const i of idx) assert.ok(i >= 0, `read SQL missing field at ${i}`);
      for (let i = 1; i < idx.length; i += 1) assert.ok(idx[i - 1] < idx[i], 'read SQL field order mismatch');
      assert.ok(READ_SQL.includes("AT TIME ZONE 'UTC'"));
      assert.ok(READ_SQL.includes('to_char('));
      assert.ok(READ_SQL.includes('AS applied_at'));
    });

    it('read SQL is ordered and forbids SELECT *, offset, limit, and unordered read', () => {
      assert.ok(READ_SQL.includes('ORDER BY migration_id ASC'));
      assert.ok(!/SELECT\s+\*/i.test(READ_SQL));
      assert.ok(!/\bOFFSET\b/i.test(READ_SQL));
      assert.ok(!/\bLIMIT\b/i.test(READ_SQL));
    });

    it('append SQL has the exact column list, typed casts, conflict clause, and RETURNING', () => {
      assert.ok(APPEND_SQL.includes('ON CONFLICT (migration_id) DO NOTHING'));
      assert.ok(APPEND_SQL.includes('RETURNING'));
      assert.ok(APPEND_SQL.includes('$1::text'));
      assert.ok(APPEND_SQL.includes('$2::text'));
      assert.ok(APPEND_SQL.includes('$3::timestamptz'));
      assert.ok(APPEND_SQL.includes('$4::text'));
      assert.ok(APPEND_SQL.includes('$7::text'));
      // RETURNING exactly migration_id, content_checksum
      const returning = APPEND_SQL.slice(APPEND_SQL.indexOf('RETURNING'));
      assert.ok(returning.includes('migration_id'));
      assert.ok(returning.includes('content_checksum'));
      assert.ok(!returning.includes('applied_at'));
    });

    it('append SQL forbids UPDATE, DO UPDATE (upsert), DELETE, and TRUNCATE', () => {
      assert.ok(!/\bUPDATE\b/i.test(APPEND_SQL));
      assert.ok(!/DO\s+UPDATE/i.test(APPEND_SQL));
      assert.ok(!/\bDELETE\b/i.test(APPEND_SQL));
      assert.ok(!/\bTRUNCATE\b/i.test(APPEND_SQL));
    });

    it('read query carries a frozen empty values array and is passed exactly once', async () => {
      const { adapter, broker } = adapterWith({ read: { rows: [] } });
      await adapter.readLedger({ lockHandle: HANDLE });
      assert.strictEqual(broker.calls.length, 1);
      const q = broker.calls[0].query;
      assert.strictEqual(q.name, READ_NAME);
      assert.deepStrictEqual([...q.values], []);
      assert.ok(Object.isFrozen(q.values));
    });

    it('append query binds snapshot values in exact field order ($1..$7)', async () => {
      const rec = validRecord({
        migration_id: 'mid', content_checksum: 'csum', applied_at: TS,
        runner_version: 'rv', environment_class: 'ec', deployed_commit: 'dc', transaction_outcome: 'COMMITTED'
      });
      const { adapter, broker } = adapterWith({ append: { rows: [{ migration_id: 'mid', content_checksum: 'csum' }] } });
      await adapter.appendLedgerRecord({ record: rec, lockHandle: HANDLE });
      const q = broker.calls[0].query;
      assert.strictEqual(q.name, APPEND_NAME);
      assert.deepStrictEqual([...q.values], ['mid', 'csum', TS, 'rv', 'ec', 'dc', 'COMMITTED']);
      assert.ok(Object.isFrozen(q));
      assert.ok(Object.isFrozen(q.values));
    });

    it('a broker that mutates the passed query object cannot change the fixed definition', async () => {
      const { adapter } = adapterWith({
        appendImpl: (arg) => {
          try { arg.query.values[0] = 'TAMPERED'; } catch (e) { /* frozen: ignore */ }
          try { arg.query.text = 'TAMPERED SQL'; } catch (e) { /* frozen: ignore */ }
          return { rows: [{ migration_id: 'mid', content_checksum: 'csum' }] };
        }
      });
      const res = await adapter.appendLedgerRecord({ record: validRecord({ migration_id: 'mid', content_checksum: 'csum' }), lockHandle: HANDLE });
      assert.strictEqual(res.status, 'APPENDED');
      assert.ok(!APPEND_SQL.includes('TAMPERED'));
    });
  });

  describe('3. readLedger success', () => {
    it('empty rows resolves to a frozen empty array (valid empty ledger)', async () => {
      const { adapter } = adapterWith({ read: { rows: [] } });
      const rows = await adapter.readLedger({ lockHandle: HANDLE });
      assert.ok(Array.isArray(rows));
      assert.strictEqual(rows.length, 0);
      assert.ok(Object.isFrozen(rows));
    });

    it('one record resolves to one frozen seven-field clone', async () => {
      const { adapter } = adapterWith({ read: { rows: [readRow({ migration_id: 'm1' })] } });
      const rows = await adapter.readLedger({ lockHandle: HANDLE });
      assert.strictEqual(rows.length, 1);
      assert.ok(Object.isFrozen(rows[0]));
      assert.deepStrictEqual(Object.keys(rows[0]), [...POSTGRES_MIGRATION_LEDGER_FIELDS]);
    });

    it('multiple records preserve query row order (no JS sort/dedupe)', async () => {
      const { adapter } = adapterWith({ read: { rows: [readRow({ migration_id: 'z9' }), readRow({ migration_id: 'a1' }), readRow({ migration_id: 'm5' })] } });
      const rows = await adapter.readLedger({ lockHandle: HANDLE });
      assert.deepStrictEqual(rows.map((r) => r.migration_id), ['z9', 'a1', 'm5']);
    });

    it('does not return raw row references (clone is distinct and frozen)', async () => {
      const raw = readRow({ migration_id: 'm1' });
      const { adapter } = adapterWith({ read: { rows: [raw] } });
      const rows = await adapter.readLedger({ lockHandle: HANDLE });
      assert.notStrictEqual(rows[0], raw);
      assert.ok(Object.isFrozen(rows[0]));
      // mutating the raw row after the fact does not change the clone
      raw.migration_id = 'MUTATED';
      assert.strictEqual(rows[0].migration_id, 'm1');
    });

    it('allows top-level QueryResult metadata (command/rowCount/oid/fields) but returns only records', async () => {
      const { adapter } = adapterWith({ read: { command: 'SELECT', rowCount: 1, oid: 0, fields: [{ name: 'migration_id' }], rows: [readRow()] } });
      const rows = await adapter.readLedger({ lockHandle: HANDLE });
      assert.strictEqual(rows.length, 1);
      assert.ok(!('command' in rows[0]));
      assert.ok(!('rowCount' in rows[0]));
    });

    it('accepts every read-allowed transaction_outcome', async () => {
      for (const outcome of ['COMMITTED', 'ROLLED_BACK', 'PARTIAL', 'UNKNOWN']) {
        const { adapter } = adapterWith({ read: { rows: [readRow({ transaction_outcome: outcome })] } });
        const rows = await adapter.readLedger({ lockHandle: HANDLE });
        assert.strictEqual(rows[0].transaction_outcome, outcome);
      }
    });

    it('normalizes nothing: applied_at is returned verbatim when canonical', async () => {
      const { adapter } = adapterWith({ read: { rows: [readRow({ applied_at: '2030-12-31T23:59:59.999Z' })] } });
      const rows = await adapter.readLedger({ lockHandle: HANDLE });
      assert.strictEqual(rows[0].applied_at, '2030-12-31T23:59:59.999Z');
    });

    it('rejects extra non-index own properties on the rows array', async () => {
      const rowsArr = [readRow({ migration_id: 'm1' })];
      rowsArr.extraMeta = 'MALFORMED';
      const { adapter } = adapterWith({ read: { rows: rowsArr } });
      const err = await rejectsRead(adapter);
      assert.strictEqual(err.message, POSTGRES_LEDGER_READ_ERROR);
    });

    it('accepts a rows array wrapped in a transparent Proxy', async () => {
      const proxied = new Proxy([readRow({ migration_id: 'm1' })], {});
      const { adapter } = adapterWith({ read: { rows: proxied } });
      const rows = await adapter.readLedger({ lockHandle: HANDLE });
      assert.strictEqual(rows.length, 1);
      assert.strictEqual(rows[0].migration_id, 'm1');
    });
  });

  describe('4. readLedger failure (fixed sanitized rejection)', () => {
    it('rejects with the fixed error on missing lockHandle and calls the broker zero times', async () => {
      const { adapter, broker } = adapterWith({});
      for (const arg of [{}, { lockHandle: null }, { lockHandle: undefined }, null, undefined]) {
        const err = await rejectsRead(adapter, arg);
        assert.ok(err);
        assert.strictEqual(err.message, POSTGRES_LEDGER_READ_ERROR);
      }
      assert.strictEqual(broker.calls.length, 0);
    });

    it('treats an accessor lockHandle as invalid (getter not executed)', async () => {
      let ran = false;
      const arg = {};
      Object.defineProperty(arg, 'lockHandle', { enumerable: true, get() { ran = true; return HANDLE; } });
      const { adapter, broker } = adapterWith({});
      const err = await rejectsRead(adapter, arg);
      assert.strictEqual(err.message, POSTGRES_LEDGER_READ_ERROR);
      assert.strictEqual(ran, false);
      assert.strictEqual(broker.calls.length, 0);
    });

    it('rejects with the fixed error when the broker throws, hiding the raw error', async () => {
      const { adapter } = adapterWith({ throwError: new Error('SECRET pg ECONNREFUSED db.internal:5432') });
      const err = await rejectsRead(adapter);
      assert.strictEqual(err.message, POSTGRES_LEDGER_READ_ERROR);
      assert.ok(!/SECRET|ECONNREFUSED|db\.internal/.test(err.message + (err.stack || '')));
    });

    it('rejects with the fixed error when the broker rejects', async () => {
      const { adapter } = adapterWith({ readImpl: async () => { throw new Error('boom'); } });
      const err = await rejectsRead(adapter);
      assert.strictEqual(err.message, POSTGRES_LEDGER_READ_ERROR);
    });

    it('rejects when rows is missing or a non-array', async () => {
      for (const read of [{}, { rows: null }, { rows: 'x' }, { rows: 5 }, { rows: {} }]) {
        const { adapter } = adapterWith({ read });
        const err = await rejectsRead(adapter);
        assert.strictEqual(err.message, POSTGRES_LEDGER_READ_ERROR, JSON.stringify(read));
      }
    });

    it('rejects on a sparse rows array', async () => {
      const sparse = new Array(2);
      sparse[1] = readRow();
      const { adapter } = adapterWith({ read: { rows: sparse } });
      const err = await rejectsRead(adapter);
      assert.strictEqual(err.message, POSTGRES_LEDGER_READ_ERROR);
    });

    it('rejects when the top-level result is not a plain record', async () => {
      for (const read of [null, 'rows', 5, true, [], new (class X {})()]) {
        const { adapter } = adapterWith({ read });
        const err = await rejectsRead(adapter);
        assert.strictEqual(err.message, POSTGRES_LEDGER_READ_ERROR);
      }
    });

    it('rejects a malformed row (not a plain record / custom prototype)', async () => {
      class Custom {}
      const bad = new Custom();
      Object.assign(bad, readRow());
      const { adapter } = adapterWith({ read: { rows: [bad] } });
      const err = await rejectsRead(adapter);
      assert.strictEqual(err.message, POSTGRES_LEDGER_READ_ERROR);
    });

    it('rejects a row missing a required field', async () => {
      const row = readRow();
      delete row.content_checksum;
      const { adapter } = adapterWith({ read: { rows: [row] } });
      const err = await rejectsRead(adapter);
      assert.strictEqual(err.message, POSTGRES_LEDGER_READ_ERROR);
    });

    it('rejects a row with an empty or whitespace field', async () => {
      for (const over of [{ runner_version: '' }, { environment_class: '   ' }, { deployed_commit: '' }]) {
        const { adapter } = adapterWith({ read: { rows: [readRow(over)] } });
        const err = await rejectsRead(adapter);
        assert.strictEqual(err.message, POSTGRES_LEDGER_READ_ERROR, JSON.stringify(over));
      }
    });

    it('rejects a non-string field', async () => {
      const { adapter } = adapterWith({ read: { rows: [readRow({ runner_version: 42 })] } });
      const err = await rejectsRead(adapter);
      assert.strictEqual(err.message, POSTGRES_LEDGER_READ_ERROR);
    });

    it('rejects a row with an extra enumerable string key', async () => {
      const row = readRow();
      row.secret = 'x';
      const { adapter } = adapterWith({ read: { rows: [row] } });
      const err = await rejectsRead(adapter);
      assert.strictEqual(err.message, POSTGRES_LEDGER_READ_ERROR);
    });

    it('rejects a row with an enumerable symbol key', async () => {
      const row = readRow();
      row[Symbol('extra')] = 'x';
      const { adapter } = adapterWith({ read: { rows: [row] } });
      const err = await rejectsRead(adapter);
      assert.strictEqual(err.message, POSTGRES_LEDGER_READ_ERROR);
    });

    it('rejects a row whose required field is an accessor (getter not executed)', async () => {
      let ran = false;
      const row = readRow();
      Object.defineProperty(row, 'migration_id', { enumerable: true, get() { ran = true; return 'x'; } });
      const { adapter } = adapterWith({ read: { rows: [row] } });
      const err = await rejectsRead(adapter);
      assert.strictEqual(err.message, POSTGRES_LEDGER_READ_ERROR);
      assert.strictEqual(ran, false);
    });

    it('rejects a row whose required field is non-enumerable', async () => {
      const row = readRow();
      Object.defineProperty(row, 'migration_id', { enumerable: false, value: 'x' });
      const { adapter } = adapterWith({ read: { rows: [row] } });
      const err = await rejectsRead(adapter);
      assert.strictEqual(err.message, POSTGRES_LEDGER_READ_ERROR);
    });

    it('rejects a row whose required field is inherited', async () => {
      const row = Object.create({ migration_id: 'inherited' });
      const base = readRow();
      for (const f of POSTGRES_MIGRATION_LEDGER_FIELDS) {
        if (f !== 'migration_id') row[f] = base[f];
      }
      const { adapter } = adapterWith({ read: { rows: [row] } });
      const err = await rejectsRead(adapter);
      assert.strictEqual(err.message, POSTGRES_LEDGER_READ_ERROR);
    });

    it('rejects when a row ownKeys trap throws', async () => {
      const trap = new Proxy(readRow(), {
        ownKeys() { throw new Error('ownKeys secret'); },
        getOwnPropertyDescriptor() { throw new Error('desc secret'); }
      });
      const { adapter } = adapterWith({ read: { rows: [trap] } });
      const err = await rejectsRead(adapter);
      assert.strictEqual(err.message, POSTGRES_LEDGER_READ_ERROR);
    });

    it('rejects when the result getPrototypeOf trap throws', async () => {
      const trap = new Proxy({ rows: [readRow()] }, {
        getPrototypeOf() { throw new Error('proto secret'); }
      });
      const { adapter } = adapterWith({ read: trap });
      const err = await rejectsRead(adapter);
      assert.strictEqual(err.message, POSTGRES_LEDGER_READ_ERROR);
    });

    it('rejects a revoked-Proxy row', async () => {
      const { proxy, revoke } = Proxy.revocable(readRow(), {});
      revoke();
      const { adapter } = adapterWith({ read: { rows: [proxy] } });
      const err = await rejectsRead(adapter);
      assert.strictEqual(err.message, POSTGRES_LEDGER_READ_ERROR);
    });

    it('rejects an invalid applied_at timestamp', async () => {
      for (const applied_at of ['2026-01-02 03:04:05', '2026-01-02T03:04:05.678', 'not-a-date', '2026-13-40T99:99:99.999Z', TS.toLowerCase()]) {
        const { adapter } = adapterWith({ read: { rows: [readRow({ applied_at })] } });
        const err = await rejectsRead(adapter);
        assert.strictEqual(err.message, POSTGRES_LEDGER_READ_ERROR, applied_at);
      }
    });

    it('rejects a non-canonical applied_at that does not round-trip', async () => {
      const { adapter } = adapterWith({ read: { rows: [readRow({ applied_at: '2026-01-02T03:04:05.6780Z' })] } });
      const err = await rejectsRead(adapter);
      assert.strictEqual(err.message, POSTGRES_LEDGER_READ_ERROR);
    });

    it('rejects a disallowed transaction_outcome on read', async () => {
      for (const transaction_outcome of ['NOT_EVALUATED', 'committed', 'OK', '', 'FAILED']) {
        const { adapter } = adapterWith({ read: { rows: [readRow({ transaction_outcome })] } });
        const err = await rejectsRead(adapter);
        assert.strictEqual(err.message, POSTGRES_LEDGER_READ_ERROR, transaction_outcome);
      }
    });

    it('never turns unavailable evidence into an empty array', async () => {
      const { adapter } = adapterWith({ read: { rows: [readRow({ runner_version: '' })] } });
      let resolved = null;
      let threw = null;
      try { resolved = await adapter.readLedger({ lockHandle: HANDLE }); } catch (e) { threw = e; }
      assert.strictEqual(resolved, null);
      assert.ok(threw);
      assert.ok(!Array.isArray(resolved));
    });

    it('rejects when rows length is non-integer, negative, or non-number', async () => {
      for (const len of [1.5, -1, NaN, '1', null]) {
        const { adapter } = adapterWith({ read: { rows: rowsWithBogusLength([readRow()], len) } });
        const err = await rejectsRead(adapter);
        assert.strictEqual(err.message, POSTGRES_LEDGER_READ_ERROR, String(len));
      }
    });

    it('rejects when the rows length getter throws', async () => {
      const { adapter } = adapterWith({ read: { rows: rowsWithThrowingLength([readRow()]) } });
      const err = await rejectsRead(adapter);
      assert.strictEqual(err.message, POSTGRES_LEDGER_READ_ERROR);
    });

    it('rejects a field that is a String object, null, or boolean (not a primitive string)', async () => {
      for (const runner_version of [new String('1.0.0'), null, true, 42]) {
        const { adapter } = adapterWith({ read: { rows: [readRow({ runner_version })] } });
        const err = await rejectsRead(adapter);
        assert.strictEqual(err.message, POSTGRES_LEDGER_READ_ERROR);
      }
    });
  });

  describe('5. appendLedgerRecord input contract', () => {
    it('appends an exact valid record (APPENDED)', async () => {
      const rec = validRecord({ migration_id: 'mid', content_checksum: 'csum' });
      const { adapter } = adapterWith({ append: { rows: [{ migration_id: 'mid', content_checksum: 'csum' }] } });
      const res = await adapter.appendLedgerRecord({ record: rec, lockHandle: HANDLE });
      assert.strictEqual(res.status, 'APPENDED');
    });

    it('returns FAILED with zero query calls for an invalid/missing handle', async () => {
      const { adapter, broker } = adapterWith({});
      for (const lockHandle of [null, undefined]) {
        const res = await adapter.appendLedgerRecord({ record: validRecord(), lockHandle });
        assert.strictEqual(res.status, 'FAILED');
      }
      const resMissing = await adapter.appendLedgerRecord({ record: validRecord() });
      assert.strictEqual(resMissing.status, 'FAILED');
      assert.strictEqual(broker.calls.length, 0);
    });

    it('returns FAILED with zero query calls for invalid/missing record', async () => {
      const { adapter, broker } = adapterWith({});
      for (const record of [undefined, null, {}, 'x', 5, [], { status: 'FAILED' }]) {
        const res = await adapter.appendLedgerRecord({ record, lockHandle: HANDLE });
        assert.strictEqual(res.status, 'FAILED', JSON.stringify(record));
      }
      assert.strictEqual(broker.calls.length, 0);
    });

    it('returns FAILED for a record with a missing field', async () => {
      const rec = validRecord();
      delete rec.deployed_commit;
      const { adapter, broker } = adapterWith({});
      const res = await adapter.appendLedgerRecord({ record: rec, lockHandle: HANDLE });
      assert.strictEqual(res.status, 'FAILED');
      assert.strictEqual(broker.calls.length, 0);
    });

    it('returns FAILED for a record with an extra string field', async () => {
      const rec = validRecord();
      rec.extra = 'x';
      const { adapter, broker } = adapterWith({});
      const res = await adapter.appendLedgerRecord({ record: rec, lockHandle: HANDLE });
      assert.strictEqual(res.status, 'FAILED');
      assert.strictEqual(broker.calls.length, 0);
    });

    it('returns FAILED for a record with an enumerable symbol field', async () => {
      const rec = validRecord();
      rec[Symbol('x')] = 'y';
      const { adapter, broker } = adapterWith({});
      const res = await adapter.appendLedgerRecord({ record: rec, lockHandle: HANDLE });
      assert.strictEqual(res.status, 'FAILED');
      assert.strictEqual(broker.calls.length, 0);
    });

    it('returns FAILED for a record whose field is an accessor (getter not executed)', async () => {
      let ran = false;
      const rec = validRecord();
      Object.defineProperty(rec, 'applied_at', { enumerable: true, get() { ran = true; return TS; } });
      const { adapter, broker } = adapterWith({});
      const res = await adapter.appendLedgerRecord({ record: rec, lockHandle: HANDLE });
      assert.strictEqual(res.status, 'FAILED');
      assert.strictEqual(ran, false);
      assert.strictEqual(broker.calls.length, 0);
    });

    it('returns FAILED for a record whose field is inherited', async () => {
      const rec = Object.create({ migration_id: 'inherited' });
      const base = validRecord();
      for (const f of POSTGRES_MIGRATION_LEDGER_FIELDS) if (f !== 'migration_id') rec[f] = base[f];
      const { adapter, broker } = adapterWith({});
      const res = await adapter.appendLedgerRecord({ record: rec, lockHandle: HANDLE });
      assert.strictEqual(res.status, 'FAILED');
      assert.strictEqual(broker.calls.length, 0);
    });

    it('returns FAILED for an invalid applied_at on append', async () => {
      const { adapter, broker } = adapterWith({});
      const res = await adapter.appendLedgerRecord({ record: validRecord({ applied_at: '2026-01-02 03:04:05' }), lockHandle: HANDLE });
      assert.strictEqual(res.status, 'FAILED');
      assert.strictEqual(broker.calls.length, 0);
    });

    it('requires transaction_outcome === COMMITTED on append', async () => {
      const { adapter, broker } = adapterWith({});
      for (const transaction_outcome of ['ROLLED_BACK', 'PARTIAL', 'UNKNOWN', 'committed', '']) {
        const res = await adapter.appendLedgerRecord({ record: validRecord({ transaction_outcome }), lockHandle: HANDLE });
        assert.strictEqual(res.status, 'FAILED', transaction_outcome);
      }
      assert.strictEqual(broker.calls.length, 0);
    });

    it('snapshots the record before awaiting: mid-flight caller mutation does not affect values', async () => {
      const rec = validRecord({ migration_id: 'mid', content_checksum: 'csum' });
      let observedValues = null;
      const { adapter } = adapterWith({
        appendImpl: async (arg) => {
          observedValues = [...arg.query.values];
          // mutate the caller record while the query is "in flight"
          rec.migration_id = 'TAMPERED';
          rec.content_checksum = 'TAMPERED';
          return { rows: [{ migration_id: 'mid', content_checksum: 'csum' }] };
        }
      });
      const res = await adapter.appendLedgerRecord({ record: rec, lockHandle: HANDLE });
      assert.deepStrictEqual(observedValues, ['mid', 'csum', TS, '1.0.0', 'disposable', 'sha256:commit', 'COMMITTED']);
      assert.strictEqual(res.status, 'APPENDED');
    });

    it('result decision uses the snapshot, not the mutated record', async () => {
      const rec = validRecord({ migration_id: 'mid', content_checksum: 'csum' });
      const { adapter } = adapterWith({
        appendImpl: async () => {
          rec.migration_id = 'TAMPERED';
          // evidence matches the ORIGINAL snapshot id/checksum
          return { rows: [{ migration_id: 'mid', content_checksum: 'csum' }] };
        }
      });
      const res = await adapter.appendLedgerRecord({ record: rec, lockHandle: HANDLE });
      assert.strictEqual(res.status, 'APPENDED');
    });
  });

  describe('6. appendLedgerRecord evidence mapping', () => {
    it('matching one exact row -> APPENDED', async () => {
      const { adapter } = adapterWith({ append: { rows: [{ migration_id: 'mid', content_checksum: 'csum' }], command: 'INSERT', rowCount: 1 } });
      const res = await adapter.appendLedgerRecord({ record: validRecord({ migration_id: 'mid', content_checksum: 'csum' }), lockHandle: HANDLE });
      assert.strictEqual(res.status, 'APPENDED');
    });

    it('zero rows -> FAILED (ON CONFLICT DO NOTHING negative evidence)', async () => {
      const { adapter } = adapterWith({ append: { rows: [], command: 'INSERT', rowCount: 0 } });
      const res = await adapter.appendLedgerRecord({ record: validRecord(), lockHandle: HANDLE });
      assert.strictEqual(res.status, 'FAILED');
    });

    it('broker throw -> UNKNOWN (commit not inferred)', async () => {
      const { adapter } = adapterWith({ throwError: new Error('connection reset') });
      const res = await adapter.appendLedgerRecord({ record: validRecord(), lockHandle: HANDLE });
      assert.strictEqual(res.status, 'UNKNOWN');
    });

    it('broker reject -> UNKNOWN', async () => {
      const { adapter } = adapterWith({ appendImpl: async () => { throw new Error('x'); } });
      const res = await adapter.appendLedgerRecord({ record: validRecord(), lockHandle: HANDLE });
      assert.strictEqual(res.status, 'UNKNOWN');
    });

    it('wrong returned migration_id -> UNKNOWN', async () => {
      const { adapter } = adapterWith({ append: { rows: [{ migration_id: 'OTHER', content_checksum: 'csum' }] } });
      const res = await adapter.appendLedgerRecord({ record: validRecord({ migration_id: 'mid', content_checksum: 'csum' }), lockHandle: HANDLE });
      assert.strictEqual(res.status, 'UNKNOWN');
    });

    it('wrong returned content_checksum -> UNKNOWN', async () => {
      const { adapter } = adapterWith({ append: { rows: [{ migration_id: 'mid', content_checksum: 'OTHER' }] } });
      const res = await adapter.appendLedgerRecord({ record: validRecord({ migration_id: 'mid', content_checksum: 'csum' }), lockHandle: HANDLE });
      assert.strictEqual(res.status, 'UNKNOWN');
    });

    it('multiple returned rows -> UNKNOWN', async () => {
      const { adapter } = adapterWith({ append: { rows: [{ migration_id: 'mid', content_checksum: 'csum' }, { migration_id: 'mid', content_checksum: 'csum' }] } });
      const res = await adapter.appendLedgerRecord({ record: validRecord({ migration_id: 'mid', content_checksum: 'csum' }), lockHandle: HANDLE });
      assert.strictEqual(res.status, 'UNKNOWN');
    });

    it('extra returned row field -> UNKNOWN', async () => {
      const { adapter } = adapterWith({ append: { rows: [{ migration_id: 'mid', content_checksum: 'csum', applied_at: TS }] } });
      const res = await adapter.appendLedgerRecord({ record: validRecord({ migration_id: 'mid', content_checksum: 'csum' }), lockHandle: HANDLE });
      assert.strictEqual(res.status, 'UNKNOWN');
    });

    it('returned row missing a key -> UNKNOWN', async () => {
      const { adapter } = adapterWith({ append: { rows: [{ migration_id: 'mid' }] } });
      const res = await adapter.appendLedgerRecord({ record: validRecord({ migration_id: 'mid', content_checksum: 'csum' }), lockHandle: HANDLE });
      assert.strictEqual(res.status, 'UNKNOWN');
    });

    it('returned row with an accessor field -> UNKNOWN (getter not executed)', async () => {
      let ran = false;
      const row = { content_checksum: 'csum' };
      Object.defineProperty(row, 'migration_id', { enumerable: true, get() { ran = true; return 'mid'; } });
      const { adapter } = adapterWith({ append: { rows: [row] } });
      const res = await adapter.appendLedgerRecord({ record: validRecord({ migration_id: 'mid', content_checksum: 'csum' }), lockHandle: HANDLE });
      assert.strictEqual(res.status, 'UNKNOWN');
      assert.strictEqual(ran, false);
    });

    it('malformed top-level result -> UNKNOWN', async () => {
      for (const append of [null, 'x', 5, [], {}, { rows: null }, { rows: 'x' }, { rows: {} }]) {
        const { adapter } = adapterWith({ append });
        const res = await adapter.appendLedgerRecord({ record: validRecord(), lockHandle: HANDLE });
        assert.strictEqual(res.status, 'UNKNOWN', JSON.stringify(append));
      }
    });

    it('sparse append rows -> UNKNOWN', async () => {
      const sparse = new Array(1); // hole at 0
      const { adapter } = adapterWith({ append: { rows: sparse } });
      const res = await adapter.appendLedgerRecord({ record: validRecord(), lockHandle: HANDLE });
      assert.strictEqual(res.status, 'UNKNOWN');
    });

    it('append row ownKeys trap throw -> UNKNOWN', async () => {
      const trap = new Proxy({ migration_id: 'mid', content_checksum: 'csum' }, {
        ownKeys() { throw new Error('ownKeys secret'); },
        getOwnPropertyDescriptor() { throw new Error('desc secret'); }
      });
      const { adapter } = adapterWith({ append: { rows: [trap] } });
      const res = await adapter.appendLedgerRecord({ record: validRecord({ migration_id: 'mid', content_checksum: 'csum' }), lockHandle: HANDLE });
      assert.strictEqual(res.status, 'UNKNOWN');
    });

    it('returns only fixed statuses and never throws', async () => {
      const allowed = new Set(['APPENDED', 'FAILED', 'UNKNOWN']);
      const cases = [
        { append: { rows: [{ migration_id: 'mid', content_checksum: 'csum' }] } },
        { append: { rows: [] } },
        { throwError: new Error('x') },
        { append: { rows: [{ migration_id: 'WRONG', content_checksum: 'csum' }] } }
      ];
      for (const opts of cases) {
        const { adapter } = adapterWith(opts);
        const res = await adapter.appendLedgerRecord({ record: validRecord({ migration_id: 'mid', content_checksum: 'csum' }), lockHandle: HANDLE });
        assert.ok(allowed.has(res.status));
        assert.ok(Object.isFrozen(res));
      }
    });

    it('does not retry: exactly one query call per append attempt', async () => {
      const { adapter, broker } = adapterWith({ append: { rows: [] } });
      await adapter.appendLedgerRecord({ record: validRecord(), lockHandle: HANDLE });
      assert.strictEqual(broker.calls.filter((c) => c.query.name === APPEND_NAME).length, 1);
    });

    it('append results are frozen plain records', async () => {
      const { adapter } = adapterWith({ append: { rows: [] } });
      const res = await adapter.appendLedgerRecord({ record: validRecord(), lockHandle: HANDLE });
      assert.ok(Object.isFrozen(res));
      assert.deepStrictEqual(Object.keys(res), ['status']);
    });

    it('evidence row with a custom prototype -> UNKNOWN', async () => {
      class Custom {}
      const row = new Custom();
      Object.assign(row, { migration_id: 'mid', content_checksum: 'csum' });
      const { adapter } = adapterWith({ append: { rows: [row] } });
      const res = await adapter.appendLedgerRecord({ record: validRecord({ migration_id: 'mid', content_checksum: 'csum' }), lockHandle: HANDLE });
      assert.strictEqual(res.status, 'UNKNOWN');
    });

    it('evidence returned id/checksum that is non-string -> UNKNOWN', async () => {
      const { adapter } = adapterWith({ append: { rows: [{ migration_id: 123, content_checksum: 'csum' }] } });
      const res = await adapter.appendLedgerRecord({ record: validRecord({ migration_id: 'mid', content_checksum: 'csum' }), lockHandle: HANDLE });
      assert.strictEqual(res.status, 'UNKNOWN');
    });

    it('evidence row with a non-enumerable returned key -> UNKNOWN', async () => {
      const row = { content_checksum: 'csum' };
      Object.defineProperty(row, 'migration_id', { enumerable: false, value: 'mid' });
      const { adapter } = adapterWith({ append: { rows: [row] } });
      const res = await adapter.appendLedgerRecord({ record: validRecord({ migration_id: 'mid', content_checksum: 'csum' }), lockHandle: HANDLE });
      assert.strictEqual(res.status, 'UNKNOWN');
    });

    it('evidence row that is a revoked Proxy -> UNKNOWN', async () => {
      const { proxy, revoke } = Proxy.revocable({ migration_id: 'mid', content_checksum: 'csum' }, {});
      revoke();
      const { adapter } = adapterWith({ append: { rows: [proxy] } });
      const res = await adapter.appendLedgerRecord({ record: validRecord({ migration_id: 'mid', content_checksum: 'csum' }), lockHandle: HANDLE });
      assert.strictEqual(res.status, 'UNKNOWN');
    });

    it('evidence rows with non-integer length -> UNKNOWN', async () => {
      const rowsArr = rowsWithBogusLength([{ migration_id: 'mid', content_checksum: 'csum' }], 1.5);
      const { adapter } = adapterWith({ append: { rows: rowsArr } });
      const res = await adapter.appendLedgerRecord({ record: validRecord({ migration_id: 'mid', content_checksum: 'csum' }), lockHandle: HANDLE });
      assert.strictEqual(res.status, 'UNKNOWN');
    });
  });

  describe('7. Orchestrator compatibility (real runCanonicalMigration)', () => {
    const ORCH_TARGET = '20260101000000_first';
    const ORCH_CHECKSUM = 'sha256:aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa';
    const ORCH_TS = '2026-01-01T00:00:00.000Z';

    function orchTarget() {
      return {
        id: ORCH_TARGET, checksum: ORCH_CHECKSUM, depends_on: [], transaction_mode: 'REQUIRED',
        risk_class: 'ADDITIVE', destructive_operations: []
      };
    }

    function orchDeps(ledgerAdapter, over) {
      return {
        validateSource: () => ({ status: 'PASS' }),
        loadManifest: () => ({ status: 'ACTIVE', migrations: [orchTarget()] }),
        acquireAdvisoryLock: () => ({ status: 'ACQUIRED', handle: HANDLE }),
        readLedger: ledgerAdapter.readLedger,
        evaluatePrecondition: () => ({ status: 'PASS' }),
        executeMigration: () => ({ executionOutcome: 'SUCCEEDED', transactionOutcome: 'COMMITTED' }),
        evaluatePostcondition: () => ({ status: 'PASS' }),
        checkAdvisoryLock: () => ({ status: 'ACQUIRED' }),
        appendLedgerRecord: ledgerAdapter.appendLedgerRecord,
        releaseAdvisoryLock: () => ({ status: 'RELEASED' }),
        now: () => ORCH_TS,
        ...(over || {})
      };
    }

    function orchInput(deps) {
      return {
        targetMigrationId: ORCH_TARGET,
        requestedAction: 'APPLY_FORWARD',
        runtimeMetadata: { runnerVersion: '1.0.0', environmentClass: 'disposable', deployedCommit: 'sha256:commit' },
        dependencies: deps
      };
    }

    it('readLedger result is consumed as an array and the run reaches EXECUTED_AND_RECORDED', async () => {
      const { adapter } = adapterWith({
        read: { rows: [] },
        append: { rows: [{ migration_id: ORCH_TARGET, content_checksum: ORCH_CHECKSUM }] }
      });
      const r = await orch.runCanonicalMigration(orchInput(orchDeps(adapter)));
      assert.strictEqual(r.outcome, orch.ORCHESTRATION_OUTCOMES.EXECUTED_AND_RECORDED);
      assert.strictEqual(r.ledgerAppended, true);
    });

    it('append APPENDED is treated as a successful ledger append', async () => {
      const { adapter } = adapterWith({
        read: { rows: [] },
        append: { rows: [{ migration_id: ORCH_TARGET, content_checksum: ORCH_CHECKSUM }] }
      });
      const r = await orch.runCanonicalMigration(orchInput(orchDeps(adapter)));
      assert.strictEqual(r.ledgerAppended, true);
      assert.strictEqual(r.outcome, orch.ORCHESTRATION_OUTCOMES.EXECUTED_AND_RECORDED);
    });

    it('append FAILED (conflict) is treated as a ledger append failure', async () => {
      const { adapter } = adapterWith({ read: { rows: [] }, append: { rows: [] } });
      const r = await orch.runCanonicalMigration(orchInput(orchDeps(adapter)));
      assert.strictEqual(r.ledgerAppended, false);
      assert.strictEqual(r.outcome, orch.ORCHESTRATION_OUTCOMES.LEDGER_APPEND_FAILED);
    });

    it('append UNKNOWN is treated as a ledger append failure', async () => {
      const { adapter } = adapterWith({ read: { rows: [] }, appendImpl: async () => { throw new Error('x'); } });
      const r = await orch.runCanonicalMigration(orchInput(orchDeps(adapter)));
      assert.strictEqual(r.ledgerAppended, false);
      assert.strictEqual(r.outcome, orch.ORCHESTRATION_OUTCOMES.LEDGER_APPEND_FAILED);
    });

    it('readLedger fixed rejection is treated as a dependency failure before execution', async () => {
      // broker rejects the read -> adapter rejects with the fixed error
      const { adapter } = adapterWith({ readImpl: async () => { throw new Error('db down'); } });
      const r = await orch.runCanonicalMigration(orchInput(orchDeps(adapter)));
      assert.strictEqual(r.outcome, orch.ORCHESTRATION_OUTCOMES.BLOCKED_BEFORE_EXECUTION);
      assert.strictEqual(r.executionAttempted, false);
    });

    it('a committed ledger prefix from readLedger drives the no-op/retry protocol path', async () => {
      // target already committed in the ledger -> protocol blocks re-application
      const { adapter } = adapterWith({
        read: { rows: [readRow({ migration_id: ORCH_TARGET, content_checksum: ORCH_CHECKSUM })] },
        append: { rows: [] }
      });
      const r = await orch.runCanonicalMigration(orchInput(orchDeps(adapter)));
      assert.notStrictEqual(r.outcome, orch.ORCHESTRATION_OUTCOMES.EXECUTED_AND_RECORDED);
      assert.strictEqual(r.ledgerAppended, false);
    });

    it('the opaque lockHandle never appears in adapter output or orchestrator result', async () => {
      const { adapter } = adapterWith({
        read: { rows: [] },
        append: { rows: [{ migration_id: ORCH_TARGET, content_checksum: ORCH_CHECKSUM }] }
      });
      const rows = await adapter.readLedger({ lockHandle: HANDLE });
      const res = await adapter.appendLedgerRecord({ record: validRecord({ migration_id: ORCH_TARGET, content_checksum: ORCH_CHECKSUM }), lockHandle: HANDLE });
      const serialized = JSON.stringify({ rows, res });
      assert.ok(!serialized.includes('OPAQUE_LOCK_HANDLE'));
      const r = await orch.runCanonicalMigration(orchInput(orchDeps(adapter)));
      assert.ok(!JSON.stringify(r).includes('OPAQUE_LOCK_HANDLE'));
    });
  });

  describe('8. Mutation resistance and opaque handle', () => {
    it('exported constants are frozen', () => {
      assert.ok(Object.isFrozen(POSTGRES_MIGRATION_LEDGER_FIELDS));
      assert.ok(Object.isFrozen(POSTGRES_MIGRATION_LEDGER_QUERIES));
      assert.ok(Object.isFrozen(POSTGRES_MIGRATION_LEDGER_QUERIES.read));
      assert.ok(Object.isFrozen(POSTGRES_MIGRATION_LEDGER_QUERIES.append));
      assert.ok(Object.isFrozen(POSTGRES_LEDGER_APPEND_STATUSES));
    });

    it('mutating the returned fields array does not affect the adapter', () => {
      const before = [...POSTGRES_MIGRATION_LEDGER_FIELDS];
      assert.throws(() => { POSTGRES_MIGRATION_LEDGER_FIELDS.push('evil'); });
      assert.deepStrictEqual([...POSTGRES_MIGRATION_LEDGER_FIELDS], before);
    });

    it('read output array and records are frozen and distinct from raw rows', async () => {
      const raw = readRow({ migration_id: 'm1' });
      const { adapter } = adapterWith({ read: { rows: [raw] } });
      const rows = await adapter.readLedger({ lockHandle: HANDLE });
      assert.ok(Object.isFrozen(rows));
      assert.ok(Object.isFrozen(rows[0]));
      assert.notStrictEqual(rows[0], raw);
      assert.throws(() => { rows.push({}); });
      assert.throws(() => { rows[0].migration_id = 'x'; });
    });

    it('the lockHandle is passed through verbatim to the broker but never serialized into results', async () => {
      const handle = Object.freeze({ secret: 'HANDLE_SECRET', deep: { token: 'T' } });
      const { adapter, broker } = adapterWith({ read: { rows: [] } });
      const rows = await adapter.readLedger({ lockHandle: handle });
      assert.strictEqual(broker.calls[0].lockHandle, handle); // exact value passed through
      assert.ok(!JSON.stringify(rows).includes('HANDLE_SECRET'));
    });

    it('the lockHandle is not inspected: a handle with a throwing ownKeys trap still works', async () => {
      const handle = new Proxy({}, {
        ownKeys() { throw new Error('handle ownKeys secret'); },
        getOwnPropertyDescriptor() { throw new Error('handle desc secret'); }
      });
      const { adapter, broker } = adapterWith({ read: { rows: [readRow()] } });
      const rows = await adapter.readLedger({ lockHandle: handle });
      assert.strictEqual(rows.length, 1);
      assert.strictEqual(broker.calls[0].lockHandle, handle);
    });
  });

  describe('7. Exact all-own-key evidence boundary (#3641 fix)', () => {
    // 1. Read record: non-enumerable extra string -> fixed read error
    it('1. read rejects row with non-enumerable extra string property', async () => {
      const row = readRow();
      Object.defineProperty(row, 'hidden_extra', { enumerable: false, value: 'bad' });
      const { adapter } = adapterWith({ read: { rows: [row] } });
      const err = await rejectsRead(adapter);
      assert.strictEqual(err.message, POSTGRES_LEDGER_READ_ERROR);
    });

    // 2. Read record: non-enumerable extra symbol -> fixed read error
    it('2. read rejects row with non-enumerable extra symbol property', async () => {
      const row = readRow();
      const sym = Symbol('hidden');
      Object.defineProperty(row, sym, { enumerable: false, value: 'bad' });
      const { adapter } = adapterWith({ read: { rows: [row] } });
      const err = await rejectsRead(adapter);
      assert.strictEqual(err.message, POSTGRES_LEDGER_READ_ERROR);
    });

    // 3. Read record: hidden credential -> fixed read error
    it('3. read rejects row with hidden credential property', async () => {
      const row = readRow();
      Object.defineProperty(row, 'credential', { enumerable: false, value: 'secret' });
      const { adapter } = adapterWith({ read: { rows: [row] } });
      const err = await rejectsRead(adapter);
      assert.strictEqual(err.message, POSTGRES_LEDGER_READ_ERROR);
    });

    // 4. Read record: hidden raw_catalog_payload -> fixed read error
    it('4. read rejects row with hidden raw_catalog_payload property', async () => {
      const row = readRow();
      Object.defineProperty(row, 'raw_catalog_payload', { enumerable: false, value: { secret: true } });
      const { adapter } = adapterWith({ read: { rows: [row] } });
      const err = await rejectsRead(adapter);
      assert.strictEqual(err.message, POSTGRES_LEDGER_READ_ERROR);
    });

    // 5. Read record: extra accessor property getter execution 0 + fixed error
    it('5. read rejects row with extra accessor property (getter not executed)', async () => {
      let ran = false;
      const row = readRow();
      Object.defineProperty(row, 'hidden_getter', {
        enumerable: false,
        get() { ran = true; return 'val'; }
      });
      const { adapter } = adapterWith({ read: { rows: [row] } });
      const err = await rejectsRead(adapter);
      assert.strictEqual(err.message, POSTGRES_LEDGER_READ_ERROR);
      assert.strictEqual(ran, false);
    });

    // 6. Append input: non-enumerable extra string -> FAILED, query 0
    it('6. append input rejects record with non-enumerable extra string (FAILED, query 0)', async () => {
      const rec = validRecord();
      Object.defineProperty(rec, 'hidden_extra', { enumerable: false, value: 'bad' });
      const { adapter, broker } = adapterWith({});
      const res = await adapter.appendLedgerRecord({ record: rec, lockHandle: HANDLE });
      assert.strictEqual(res.status, 'FAILED');
      assert.strictEqual(broker.calls.length, 0);
    });

    // 7. Append input: non-enumerable extra symbol -> FAILED, query 0
    it('7. append input rejects record with non-enumerable extra symbol (FAILED, query 0)', async () => {
      const rec = validRecord();
      Object.defineProperty(rec, Symbol('hidden'), { enumerable: false, value: 'bad' });
      const { adapter, broker } = adapterWith({});
      const res = await adapter.appendLedgerRecord({ record: rec, lockHandle: HANDLE });
      assert.strictEqual(res.status, 'FAILED');
      assert.strictEqual(broker.calls.length, 0);
    });

    // 8. Append input: hidden credential -> FAILED, query 0
    it('8. append input rejects record with hidden credential (FAILED, query 0)', async () => {
      const rec = validRecord();
      Object.defineProperty(rec, 'credential', { enumerable: false, value: 'secret' });
      const { adapter, broker } = adapterWith({});
      const res = await adapter.appendLedgerRecord({ record: rec, lockHandle: HANDLE });
      assert.strictEqual(res.status, 'FAILED');
      assert.strictEqual(broker.calls.length, 0);
    });

    // 9. Append input: hidden operator_email -> FAILED, query 0
    it('9. append input rejects record with hidden operator_email (FAILED, query 0)', async () => {
      const rec = validRecord();
      Object.defineProperty(rec, 'operator_email', { enumerable: false, value: 'admin@lovebud.dev' });
      const { adapter, broker } = adapterWith({});
      const res = await adapter.appendLedgerRecord({ record: rec, lockHandle: HANDLE });
      assert.strictEqual(res.status, 'FAILED');
      assert.strictEqual(broker.calls.length, 0);
    });

    // 10. Append input: extra accessor getter execution 0 + FAILED, query 0
    it('10. append input rejects record with extra accessor property (getter not executed, FAILED, query 0)', async () => {
      let ran = false;
      const rec = validRecord();
      Object.defineProperty(rec, 'hidden_getter', {
        enumerable: false,
        get() { ran = true; return 'val'; }
      });
      const { adapter, broker } = adapterWith({});
      const res = await adapter.appendLedgerRecord({ record: rec, lockHandle: HANDLE });
      assert.strictEqual(res.status, 'FAILED');
      assert.strictEqual(ran, false);
      assert.strictEqual(broker.calls.length, 0);
    });

    // 11. Append returned row: non-enumerable extra string -> UNKNOWN
    it('11. append evidence rejects returned row with non-enumerable extra string -> UNKNOWN', async () => {
      const row = { migration_id: 'mid', content_checksum: 'csum' };
      Object.defineProperty(row, 'hidden_extra', { enumerable: false, value: 'bad' });
      const { adapter } = adapterWith({ append: { rows: [row] } });
      const res = await adapter.appendLedgerRecord({ record: validRecord({ migration_id: 'mid', content_checksum: 'csum' }), lockHandle: HANDLE });
      assert.strictEqual(res.status, 'UNKNOWN');
    });

    // 12. Append returned row: non-enumerable extra symbol -> UNKNOWN
    it('12. append evidence rejects returned row with non-enumerable extra symbol -> UNKNOWN', async () => {
      const row = { migration_id: 'mid', content_checksum: 'csum' };
      Object.defineProperty(row, Symbol('hidden'), { enumerable: false, value: 'bad' });
      const { adapter } = adapterWith({ append: { rows: [row] } });
      const res = await adapter.appendLedgerRecord({ record: validRecord({ migration_id: 'mid', content_checksum: 'csum' }), lockHandle: HANDLE });
      assert.strictEqual(res.status, 'UNKNOWN');
    });

    // 13. Append returned row: hidden raw field -> UNKNOWN
    it('13. append evidence rejects returned row with hidden raw field -> UNKNOWN', async () => {
      const row = { migration_id: 'mid', content_checksum: 'csum' };
      Object.defineProperty(row, 'raw', { enumerable: false, value: 'secret' });
      const { adapter } = adapterWith({ append: { rows: [row] } });
      const res = await adapter.appendLedgerRecord({ record: validRecord({ migration_id: 'mid', content_checksum: 'csum' }), lockHandle: HANDLE });
      assert.strictEqual(res.status, 'UNKNOWN');
    });

    // 14. Append returned row: extra accessor getter execution 0 + UNKNOWN
    it('14. append evidence rejects returned row with extra accessor property (getter not executed) -> UNKNOWN', async () => {
      let ran = false;
      const row = { migration_id: 'mid', content_checksum: 'csum' };
      Object.defineProperty(row, 'hidden_getter', {
        enumerable: false,
        get() { ran = true; return 'val'; }
      });
      const { adapter } = adapterWith({ append: { rows: [row] } });
      const res = await adapter.appendLedgerRecord({ record: validRecord({ migration_id: 'mid', content_checksum: 'csum' }), lockHandle: HANDLE });
      assert.strictEqual(res.status, 'UNKNOWN');
      assert.strictEqual(ran, false);
    });

    // 15. Dense rows evidence: read empty rows + enumerable extra property -> fixed read error
    it('15. read rejects empty rows array with enumerable extra property -> fixed read error', async () => {
      const rowsArr = [];
      rowsArr.extraProp = 'bad';
      const { adapter } = adapterWith({ read: { rows: rowsArr } });
      const err = await rejectsRead(adapter);
      assert.strictEqual(err.message, POSTGRES_LEDGER_READ_ERROR);
    });

    // 16. Dense rows evidence: read empty rows + non-enumerable extra property -> fixed read error
    it('16. read rejects empty rows array with non-enumerable extra property -> fixed read error', async () => {
      const rowsArr = [];
      Object.defineProperty(rowsArr, 'hiddenProp', { enumerable: false, value: 'bad' });
      const { adapter } = adapterWith({ read: { rows: rowsArr } });
      const err = await rejectsRead(adapter);
      assert.strictEqual(err.message, POSTGRES_LEDGER_READ_ERROR);
    });

    // 17. Dense rows evidence: read rows + symbol property -> fixed read error
    it('17. read rejects rows array with symbol property -> fixed read error', async () => {
      const rowsArr = [readRow()];
      rowsArr[Symbol('sym')] = 'bad';
      const { adapter } = adapterWith({ read: { rows: rowsArr } });
      const err = await rejectsRead(adapter);
      assert.strictEqual(err.message, POSTGRES_LEDGER_READ_ERROR);
    });

    // 18. Dense rows evidence: append empty rows + enumerable extra -> UNKNOWN
    it('18. append evidence rejects empty rows array with enumerable extra property -> UNKNOWN', async () => {
      const rowsArr = [];
      rowsArr.extraProp = 'bad';
      const { adapter } = adapterWith({ append: { rows: rowsArr } });
      const res = await adapter.appendLedgerRecord({ record: validRecord(), lockHandle: HANDLE });
      assert.strictEqual(res.status, 'UNKNOWN');
    });

    // 19. Dense rows evidence: append empty rows + non-enumerable extra -> UNKNOWN
    it('19. append evidence rejects empty rows array with non-enumerable extra property -> UNKNOWN', async () => {
      const rowsArr = [];
      Object.defineProperty(rowsArr, 'hiddenProp', { enumerable: false, value: 'bad' });
      const { adapter } = adapterWith({ append: { rows: rowsArr } });
      const res = await adapter.appendLedgerRecord({ record: validRecord(), lockHandle: HANDLE });
      assert.strictEqual(res.status, 'UNKNOWN');
    });

    // 20. Dense rows evidence: append empty rows + symbol -> UNKNOWN
    it('20. append evidence rejects empty rows array with symbol property -> UNKNOWN', async () => {
      const rowsArr = [];
      rowsArr[Symbol('sym')] = 'bad';
      const { adapter } = adapterWith({ append: { rows: rowsArr } });
      const res = await adapter.appendLedgerRecord({ record: validRecord(), lockHandle: HANDLE });
      assert.strictEqual(res.status, 'UNKNOWN');
    });

    // 21. Dense rows evidence: append one-row array + extra property -> UNKNOWN
    it('21. append evidence rejects one-row array with extra property -> UNKNOWN', async () => {
      const rowsArr = [{ migration_id: 'mid', content_checksum: 'csum' }];
      rowsArr.extraProp = 'bad';
      const { adapter } = adapterWith({ append: { rows: rowsArr } });
      const res = await adapter.appendLedgerRecord({ record: validRecord({ migration_id: 'mid', content_checksum: 'csum' }), lockHandle: HANDLE });
      assert.strictEqual(res.status, 'UNKNOWN');
    });

    // 22. Dense rows evidence: index accessor getter execution 0
    it('22. rows validation does not execute index accessor getters -> fixed error / UNKNOWN', async () => {
      let ran = false;
      const rowsArr = [];
      Object.defineProperty(rowsArr, '0', {
        enumerable: true,
        get() { ran = true; return readRow(); }
      });
      Object.defineProperty(rowsArr, 'length', { value: 1 });
      const { adapter: readAdapter } = adapterWith({ read: { rows: rowsArr } });
      const err = await rejectsRead(readAdapter);
      assert.strictEqual(err.message, POSTGRES_LEDGER_READ_ERROR);
      assert.strictEqual(ran, false);

      const { adapter: appendAdapter } = adapterWith({ append: { rows: rowsArr } });
      const res = await appendAdapter.appendLedgerRecord({ record: validRecord({ migration_id: 'mid', content_checksum: 'csum' }), lockHandle: HANDLE });
      assert.strictEqual(res.status, 'UNKNOWN');
    });

    // 23. Dense rows evidence: rows ownKeys trap throw -> fail-closed
    it('23. rows ownKeys trap throw fails closed (read error / UNKNOWN)', async () => {
      const badRows = new Proxy([], {
        ownKeys() { throw new Error('ownKeys secret'); }
      });
      const { adapter: readAdapter } = adapterWith({ read: { rows: badRows } });
      const err = await rejectsRead(readAdapter);
      assert.strictEqual(err.message, POSTGRES_LEDGER_READ_ERROR);

      const { adapter: appendAdapter } = adapterWith({ append: { rows: badRows } });
      const res = await appendAdapter.appendLedgerRecord({ record: validRecord({ migration_id: 'mid', content_checksum: 'csum' }), lockHandle: HANDLE });
      assert.strictEqual(res.status, 'UNKNOWN');
    });

    // 24. Dense rows evidence: rows descriptor trap throw -> fail-closed
    it('24. rows descriptor trap throw fails closed (read error / UNKNOWN)', async () => {
      const badRows = new Proxy([readRow()], {
        getOwnPropertyDescriptor() { throw new Error('desc secret'); }
      });
      const { adapter: readAdapter } = adapterWith({ read: { rows: badRows } });
      const err = await rejectsRead(readAdapter);
      assert.strictEqual(err.message, POSTGRES_LEDGER_READ_ERROR);

      const { adapter: appendAdapter } = adapterWith({ append: { rows: [{ migration_id: 'mid', content_checksum: 'csum' }] } });
      // To test append rows descriptor trap, proxy the rows array:
      const badAppendRows = new Proxy([{ migration_id: 'mid', content_checksum: 'csum' }], {
        getOwnPropertyDescriptor() { throw new Error('desc secret'); }
      });
      const { adapter: appendAdapter2 } = adapterWith({ append: { rows: badAppendRows } });
      const res = await appendAdapter2.appendLedgerRecord({ record: validRecord({ migration_id: 'mid', content_checksum: 'csum' }), lockHandle: HANDLE });
      assert.strictEqual(res.status, 'UNKNOWN');
    });

    // 25. Regression: exact empty rows: [] -> FAILED maintained
    it('25. exact empty rows: [] maintains FAILED status', async () => {
      const { adapter } = adapterWith({ append: { rows: [] } });
      const res = await adapter.appendLedgerRecord({ record: validRecord(), lockHandle: HANDLE });
      assert.strictEqual(res.status, 'FAILED');
    });

    // 26. Regression: exact matching row -> APPENDED maintained
    it('26. exact matching row maintains APPENDED status', async () => {
      const { adapter } = adapterWith({ append: { rows: [{ migration_id: 'mid', content_checksum: 'csum' }] } });
      const res = await adapter.appendLedgerRecord({ record: validRecord({ migration_id: 'mid', content_checksum: 'csum' }), lockHandle: HANDLE });
      assert.strictEqual(res.status, 'APPENDED');
    });

    // 27. Regression: valid read empty array -> frozen []
    it('27. valid read empty array resolves to frozen []', async () => {
      const { adapter } = adapterWith({ read: { rows: [] } });
      const rows = await adapter.readLedger({ lockHandle: HANDLE });
      assert.deepStrictEqual(rows, []);
      assert.ok(Object.isFrozen(rows));
    });

    // 28. Regression: valid multi-row read order maintained
    it('28. valid multi-row read preserves exact row order', async () => {
      const { adapter } = adapterWith({ read: { rows: [readRow({ migration_id: 'm1' }), readRow({ migration_id: 'm2' })] } });
      const rows = await adapter.readLedger({ lockHandle: HANDLE });
      assert.strictEqual(rows.length, 2);
      assert.strictEqual(rows[0].migration_id, 'm1');
      assert.strictEqual(rows[1].migration_id, 'm2');
    });

    // 29. Regression: top-level pg metadata allowed
    it('29. top-level pg metadata (command, rowCount, oid, fields) continues to be allowed', async () => {
      const { adapter } = adapterWith({ read: { command: 'SELECT', rowCount: 1, oid: 123, fields: [], rows: [readRow()] } });
      const rows = await adapter.readLedger({ lockHandle: HANDLE });
      assert.strictEqual(rows.length, 1);
    });

    // 30. Regression: public methods raw throw/error leak none
    it('30. public methods never leak raw error messages or stacks', async () => {
      const { adapter } = adapterWith({ throwError: new Error('SECRET_DB_URL postgres://admin:secret@localhost:5432/db') });
      const err = await rejectsRead(adapter);
      assert.strictEqual(err.message, POSTGRES_LEDGER_READ_ERROR);
      assert.ok(!err.message.includes('SECRET_DB_URL'));
      assert.ok(!err.message.includes('postgres://'));
      assert.ok(!err.message.includes('secret'));
    });
  });

  describe('9. Sanitization', () => {
    it('read rejection exposes only the fixed error (no raw error/message/stack/row/handle)', async () => {
      const { adapter } = adapterWith({ throwError: new Error('pg://user:pass@db.internal:5432/mydb ECONNREFUSED') });
      const err = await rejectsRead(adapter);
      assert.strictEqual(err.message, POSTGRES_LEDGER_READ_ERROR);
      const blob = err.message + (err.stack || '');
      for (const needle of ['pg://', 'user:pass', 'db.internal', '5432', 'ECONNREFUSED', 'mydb']) {
        assert.ok(!blob.includes(needle), `leaked ${needle}`);
      }
    });

    it('malformed row values never leak into the rejection', async () => {
      const row = readRow();
      row.runner_version = 'SECRET_VERSION_LEAK';
      row[Symbol('s')] = 'SECRET_SYMBOL_LEAK';
      const { adapter } = adapterWith({ read: { rows: [row] } });
      const err = await rejectsRead(adapter);
      assert.strictEqual(err.message, POSTGRES_LEDGER_READ_ERROR);
      assert.ok(!JSON.stringify(err.message).includes('SECRET_VERSION_LEAK'));
    });

    it('append results never carry raw result/row/handle/session/error detail', async () => {
      const { adapter } = adapterWith({ append: { rows: [{ migration_id: 'mid', content_checksum: 'csum', leaked: 'SECRET_ROW' }], secretMeta: 'SECRET_META' } });
      const res = await adapter.appendLedgerRecord({ record: validRecord({ migration_id: 'mid', content_checksum: 'csum' }), lockHandle: HANDLE });
      const blob = JSON.stringify(res);
      assert.ok(!blob.includes('SECRET_ROW'));
      assert.ok(!blob.includes('SECRET_META'));
      assert.deepStrictEqual(Object.keys(res), ['status']);
    });

    it('the core module defines no console logging', () => {
      const src = require('node:fs').readFileSync(CORE_PATH, 'utf8');
      assert.ok(!/console\./.test(src));
      assert.ok(!/DATABASE_URL/.test(src));
      assert.ok(!/require\(['"]pg['"]\)/.test(src));
    });
  });

  describe('10. Descriptor snapshot / TOCTOU hardening (#3641 hardening)', () => {
    // 1. Read rows Proxy get trap throws -> get trap 0 calls, descriptor snapshot used
    it('1. read rows Proxy get trap throw -> 0 get calls, descriptor snapshot used', async () => {
      let getCalls = 0;
      const proxied = new Proxy([readRow({ migration_id: 'm1' })], {
        get(target, prop, receiver) {
          getCalls += 1;
          throw new Error('get secret');
        }
      });
      const { adapter } = adapterWith({ read: { rows: proxied } });
      const rows = await adapter.readLedger({ lockHandle: HANDLE });
      assert.strictEqual(rows.length, 1);
      assert.strictEqual(rows[0].migration_id, 'm1');
      assert.strictEqual(getCalls, 0);
    });

    // 2. Append rows Proxy get trap throws -> 0 get calls, APPENDED via descriptor
    it('2. append rows Proxy get trap throw -> 0 get calls, APPENDED via descriptor', async () => {
      let getCalls = 0;
      const proxied = new Proxy([{ migration_id: 'mid', content_checksum: 'csum' }], {
        get(target, prop, receiver) {
          getCalls += 1;
          throw new Error('get secret');
        }
      });
      const { adapter } = adapterWith({ append: { rows: proxied } });
      const res = await adapter.appendLedgerRecord({ record: validRecord({ migration_id: 'mid', content_checksum: 'csum' }), lockHandle: HANDLE });
      assert.strictEqual(res.status, 'APPENDED');
      assert.strictEqual(getCalls, 0);
    });

    // 3. Append rows Proxy get trap returns different row -> 0 get calls, descriptor used
    it('3. append rows Proxy get trap returns different row -> 0 get calls, descriptor used', async () => {
      let getCalls = 0;
      const proxied = new Proxy([{ migration_id: 'mid', content_checksum: 'csum' }], {
        get(target, prop, receiver) {
          getCalls += 1;
          if (prop === '0') return { migration_id: 'DIFFERENT', content_checksum: 'DIFFERENT' };
          return Reflect.get(target, prop, receiver);
        }
      });
      const { adapter } = adapterWith({ append: { rows: proxied } });
      const res = await adapter.appendLedgerRecord({ record: validRecord({ migration_id: 'mid', content_checksum: 'csum' }), lockHandle: HANDLE });
      assert.strictEqual(res.status, 'APPENDED');
      assert.strictEqual(getCalls, 0);
    });

    // 4. Read row descriptor valid, get trap throws -> 0 get calls, frozen clone
    it('4. read row descriptor valid, get trap throws -> 0 get calls, frozen clone', async () => {
      let getCalls = 0;
      const row = new Proxy(readRow({ migration_id: 'm1' }), {
        get(target, prop, receiver) {
          getCalls += 1;
          throw new Error('row get secret');
        }
      });
      const { adapter } = adapterWith({ read: { rows: [row] } });
      const rows = await adapter.readLedger({ lockHandle: HANDLE });
      assert.strictEqual(rows.length, 1);
      assert.strictEqual(rows[0].migration_id, 'm1');
      assert.ok(Object.isFrozen(rows[0]));
      assert.strictEqual(getCalls, 0);
    });

    // 5. Append returned row descriptor matching, get trap wrong -> 0 get calls, APPENDED
    it('5. append returned row descriptor matching, get trap wrong -> 0 get calls, APPENDED', async () => {
      let getCalls = 0;
      const row = new Proxy({ migration_id: 'mid', content_checksum: 'csum' }, {
        get(target, prop, receiver) {
          getCalls += 1;
          if (prop === 'migration_id') return 'WRONG';
          if (prop === 'content_checksum') return 'WRONG';
          return Reflect.get(target, prop, receiver);
        }
      });
      const { adapter } = adapterWith({ append: { rows: [row] } });
      const res = await adapter.appendLedgerRecord({ record: validRecord({ migration_id: 'mid', content_checksum: 'csum' }), lockHandle: HANDLE });
      assert.strictEqual(res.status, 'APPENDED');
      assert.strictEqual(getCalls, 0);
    });

    // 6. Append returned row descriptor wrong, get trap matching -> 0 get calls, UNKNOWN
    it('6. append returned row descriptor wrong, get trap matching -> 0 get calls, UNKNOWN', async () => {
      let getCalls = 0;
      const row = new Proxy({ migration_id: 'WRONG', content_checksum: 'WRONG' }, {
        get(target, prop, receiver) {
          getCalls += 1;
          if (prop === 'migration_id') return 'mid';
          if (prop === 'content_checksum') return 'csum';
          return Reflect.get(target, prop, receiver);
        }
      });
      const { adapter } = adapterWith({ append: { rows: [row] } });
      const res = await adapter.appendLedgerRecord({ record: validRecord({ migration_id: 'mid', content_checksum: 'csum' }), lockHandle: HANDLE });
      assert.strictEqual(res.status, 'UNKNOWN');
      assert.strictEqual(getCalls, 0);
    });

    // 7. Record field descriptor returns different value on repeated calls
    it('7. record field descriptor returns different value on repeated calls -> first snapshot wins', async () => {
      let callCount = 0;
      const rec = validRecord({ migration_id: 'mid', content_checksum: 'csum' });
      Object.defineProperty(rec, 'migration_id', {
        enumerable: true,
        get() {
          callCount += 1;
          return callCount === 1 ? 'mid' : 'TAMPERED';
        }
      });
      const { adapter, broker } = adapterWith({});
      const res = await adapter.appendLedgerRecord({ record: rec, lockHandle: HANDLE });
      assert.strictEqual(res.status, 'FAILED');
      assert.strictEqual(broker.calls.length, 0);
    });

    // 8. Append evidence descriptor returns different value on repeated calls
    it('8. append evidence descriptor returns different value on repeated calls -> first snapshot wins', async () => {
      let callCount = 0;
      const row = { migration_id: 'mid', content_checksum: 'csum' };
      const proxied = new Proxy(row, {
        getOwnPropertyDescriptor(target, prop) {
          callCount += 1;
          if (prop === 'migration_id') {
            return { enumerable: true, configurable: true, value: callCount === 1 ? 'mid' : 'DIFFERENT' };
          }
          return Reflect.getOwnPropertyDescriptor(target, prop);
        }
      });
      const { adapter } = adapterWith({ append: { rows: [proxied] } });
      const res = await adapter.appendLedgerRecord({ record: validRecord({ migration_id: 'mid', content_checksum: 'csum' }), lockHandle: HANDLE });
      assert.strictEqual(res.status, 'APPENDED');
    });

    // 9. Length descriptor is captured once, not re-read after validation
    it('9. length descriptor captured once, not re-read after validation', async () => {
      let lengthCalls = 0;
      const proxied = new Proxy([readRow({ migration_id: 'm1' })], {
        getOwnPropertyDescriptor(target, prop) {
          if (prop === 'length') lengthCalls += 1;
          return Reflect.getOwnPropertyDescriptor(target, prop);
        },
        ownKeys(target) { return Reflect.ownKeys(target); }
      });
      const { adapter } = adapterWith({ read: { rows: proxied } });
      const rows = await adapter.readLedger({ lockHandle: HANDLE });
      assert.strictEqual(rows.length, 1);
      // length descriptor should be retrieved exactly once during snapshot
      assert.strictEqual(lengthCalls, 1);
    });

    // 10. length=1 + own key '00', key '0' absent -> malformed
    it('10. length=1 + own key 00, key 0 absent -> read error', async () => {
      const rowsArr = [];
      Object.defineProperty(rowsArr, '00', { enumerable: true, value: readRow({ migration_id: 'm1' }) });
      Object.defineProperty(rowsArr, 'length', { value: 1, writable: false, configurable: false, enumerable: false });
      const { adapter } = adapterWith({ read: { rows: rowsArr } });
      const err = await rejectsRead(adapter);
      assert.strictEqual(err.message, POSTGRES_LEDGER_READ_ERROR);
    });

    // 11. length=1 + own key '01', key '0' absent -> malformed
    it('11. length=1 + own key 01, key 0 absent -> read error', async () => {
      const rowsArr = [];
      Object.defineProperty(rowsArr, '01', { enumerable: true, value: readRow({ migration_id: 'm1' }) });
      Object.defineProperty(rowsArr, 'length', { value: 1, writable: false, configurable: false, enumerable: false });
      const { adapter } = adapterWith({ read: { rows: rowsArr } });
      const err = await rejectsRead(adapter);
      assert.strictEqual(err.message, POSTGRES_LEDGER_READ_ERROR);
    });

    // 12. length=2 + only '0', '2' -> malformed
    it('12. length=2 + only 0, 2 -> read error', async () => {
      const proxied = new Proxy([], {
        getOwnPropertyDescriptor(target, prop) {
          if (prop === 'length') return { enumerable: false, configurable: false, writable: false, value: 2 };
          if (prop === '0') return { enumerable: true, configurable: true, value: readRow({ migration_id: 'm1' }) };
          if (prop === '2') return { enumerable: true, configurable: true, value: readRow({ migration_id: 'm2' }) };
          return undefined;
        },
        ownKeys() { return ['0', '2', 'length']; }
      });
      const { adapter } = adapterWith({ read: { rows: proxied } });
      const err = await rejectsRead(adapter);
      assert.strictEqual(err.message, POSTGRES_LEDGER_READ_ERROR);
    });

    // 13. length=2 + only '1', '2' -> malformed
    it('13. length=2 + only 1, 2 -> read error', async () => {
      const proxied = new Proxy([], {
        getOwnPropertyDescriptor(target, prop) {
          if (prop === 'length') return { enumerable: false, configurable: false, writable: false, value: 2 };
          if (prop === '1') return { enumerable: true, configurable: true, value: readRow({ migration_id: 'm1' }) };
          if (prop === '2') return { enumerable: true, configurable: true, value: readRow({ migration_id: 'm2' }) };
          return undefined;
        },
        ownKeys() { return ['1', '2', 'length']; }
      });
      const { adapter } = adapterWith({ read: { rows: proxied } });
      const err = await rejectsRead(adapter);
      assert.strictEqual(err.message, POSTGRES_LEDGER_READ_ERROR);
    });

    // 14. Proxy get trap synthesizes missing '0' -> malformed
    it('14. Proxy get trap synthesizes missing 0 -> read error', async () => {
      const rowsArr = [];
      Object.defineProperty(rowsArr, '1', { enumerable: true, value: readRow({ migration_id: 'm1' }) });
      Object.defineProperty(rowsArr, 'length', { value: 2, writable: false, configurable: false, enumerable: false });
      const proxied = new Proxy(rowsArr, {
        get(target, prop, receiver) {
          if (prop === '0') return readRow({ migration_id: 'm1' });
          return Reflect.get(target, prop, receiver);
        }
      });
      const { adapter } = adapterWith({ read: { rows: proxied } });
      const err = await rejectsRead(adapter);
      assert.strictEqual(err.message, POSTGRES_LEDGER_READ_ERROR);
    });

    // 15. Exact length,0..n-1 -> valid
    it('15. exact length,0..n-1 -> valid read', async () => {
      const { adapter } = adapterWith({ read: { rows: [readRow({ migration_id: 'm1' }), readRow({ migration_id: 'm2' })] } });
      const rows = await adapter.readLedger({ lockHandle: HANDLE });
      assert.strictEqual(rows.length, 2);
      assert.strictEqual(rows[0].migration_id, 'm1');
      assert.strictEqual(rows[1].migration_id, 'm2');
    });

    // 16. Regression: exact empty rows [] -> FAILED maintained
    it('16. exact empty rows [] maintains FAILED status', async () => {
      const { adapter } = adapterWith({ append: { rows: [] } });
      const res = await adapter.appendLedgerRecord({ record: validRecord(), lockHandle: HANDLE });
      assert.strictEqual(res.status, 'FAILED');
    });

    // 17. Regression: exact empty rows [] -> read frozen [] maintained
    it('17. exact empty rows [] read resolves to frozen []', async () => {
      const { adapter } = adapterWith({ read: { rows: [] } });
      const rows = await adapter.readLedger({ lockHandle: HANDLE });
      assert.deepStrictEqual(rows, []);
      assert.ok(Object.isFrozen(rows));
    });

    // 18. Regression: exact one-row append -> APPENDED maintained
    it('18. exact one-row append maintains APPENDED status', async () => {
      const { adapter } = adapterWith({ append: { rows: [{ migration_id: 'mid', content_checksum: 'csum' }] } });
      const res = await adapter.appendLedgerRecord({ record: validRecord({ migration_id: 'mid', content_checksum: 'csum' }), lockHandle: HANDLE });
      assert.strictEqual(res.status, 'APPENDED');
    });

    // 19. Regression: valid multi-row read order maintained
    it('19. valid multi-row read preserves exact row order', async () => {
      const { adapter } = adapterWith({ read: { rows: [readRow({ migration_id: 'm1' }), readRow({ migration_id: 'm2' })] } });
      const rows = await adapter.readLedger({ lockHandle: HANDLE });
      assert.strictEqual(rows.length, 2);
      assert.strictEqual(rows[0].migration_id, 'm1');
      assert.strictEqual(rows[1].migration_id, 'm2');
    });

    // 20. Regression: top-level pg metadata allowed
    it('20. top-level pg metadata continues to be allowed', async () => {
      const { adapter } = adapterWith({ read: { command: 'SELECT', rowCount: 1, oid: 123, fields: [], rows: [readRow()] } });
      const rows = await adapter.readLedger({ lockHandle: HANDLE });
      assert.strictEqual(rows.length, 1);
    });

    // 21. Regression: getter/Proxy raw error leak 0
    it('21. public methods never leak raw error messages or stacks', async () => {
      const { adapter } = adapterWith({ throwError: new Error('SECRET_DB_URL postgres://admin:secret@localhost:5432/db') });
      const err = await rejectsRead(adapter);
      assert.strictEqual(err.message, POSTGRES_LEDGER_READ_ERROR);
      assert.ok(!err.message.includes('SECRET_DB_URL'));
      assert.ok(!err.message.includes('postgres://'));
      assert.ok(!err.message.includes('secret'));
    });

    // 22. Regression: public methods unexpected throw 0
    it('22. public methods never throw unexpectedly', async () => {
      const allowed = new Set(['APPENDED', 'FAILED', 'UNKNOWN']);
      const cases = [
        { append: { rows: [{ migration_id: 'mid', content_checksum: 'csum' }] } },
        { append: { rows: [] } },
        { throwError: new Error('x') },
        { append: { rows: [{ migration_id: 'WRONG', content_checksum: 'csum' }] } }
      ];
      for (const opts of cases) {
        const { adapter } = adapterWith(opts);
        const res = await adapter.appendLedgerRecord({ record: validRecord({ migration_id: 'mid', content_checksum: 'csum' }), lockHandle: HANDLE });
        assert.ok(allowed.has(res.status));
        assert.ok(Object.isFrozen(res));
      }
    });
  });
});
