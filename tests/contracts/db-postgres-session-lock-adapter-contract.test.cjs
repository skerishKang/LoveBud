'use strict';

/**
 * Focused SOURCE_STATIC contract test: PostgreSQL pinned-session advisory-lock
 * adapter (#3458, sixth slice).
 *
 * Exercises scripts/migration-postgres-session-lock-adapter-core.cjs by calling
 * the real exported functions with synthetic JavaScript session/query mocks. No
 * pg, PostgreSQL, Docker, network, DATABASE_URL, environment secret, filesystem
 * write, child_process, or actual SQL execution is used. SQL is present only as
 * contract strings; lifecycle is proven by calling adapter methods and asserting
 * call counts and results (not by comment/string presence alone).
 *
 * Refs #3458
 * Refs #3425 - Keep #3425 OPEN.
 * Refs #3435 - Keep #3435 OPEN.
 * Refs #3437 - Keep #3437 OPEN.
 * Refs #1882 - Keep #1882 OPEN.
 */

const { describe, it } = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');

const REPO_ROOT = path.resolve(__dirname, '..', '..');
const CORE_PATH = path.join(REPO_ROOT, 'scripts', 'migration-postgres-session-lock-adapter-core.cjs');
const core = require(CORE_PATH);

const {
  POSTGRES_MIGRATION_LOCK_KEYS,
  POSTGRES_MIGRATION_LOCK_QUERIES,
  POSTGRES_LOCK_ACQUIRE_STATUSES,
  POSTGRES_LOCK_CHECK_STATUSES,
  POSTGRES_LOCK_RELEASE_STATUSES,
  createPostgresMigrationSessionLockAdapter
} = core;

const ACQUIRE_NAME = POSTGRES_MIGRATION_LOCK_QUERIES.acquire.name;
const CHECK_NAME = POSTGRES_MIGRATION_LOCK_QUERIES.check.name;
const RELEASE_NAME = POSTGRES_MIGRATION_LOCK_QUERIES.release.name;
const TARGET = '20260101000000_first';

// Build a synthetic session with configurable query results and call tracking.
function mockSession(opts) {
  const o = opts || {};
  const state = { queries: [], poolReleases: 0 };
  const queryImpl = o.queryImpl || (async (q) => {
    state.queries.push(q);
    if (q.name === ACQUIRE_NAME) return 'acquireResult' in o ? o.acquireResult : { rows: [{ acquired: true }] };
    if (q.name === CHECK_NAME) return 'checkResult' in o ? o.checkResult : { rows: [{ held: true }] };
    if (q.name === RELEASE_NAME) return 'releaseResult' in o ? o.releaseResult : { rows: [{ released: true }] };
    return {};
  });
  const poolReleaseImpl = o.poolReleaseImpl || (async () => { state.poolReleases += 1; });
  return { session: { query: queryImpl, release: poolReleaseImpl }, state };
}

function adapterFor(session, openOver) {
  return createPostgresMigrationSessionLockAdapter({ openSession: openOver || (async () => session), ...{} });
}

function queriesByName(state, name) {
  return state.queries.filter((q) => q.name === name);
}

describe('DB postgres session lock adapter contract (#3458)', () => {

  describe('1. Factory / session', () => {
    it('valid factory returns a frozen adapter', () => {
      const { session } = mockSession();
      const adapter = adapterFor(session);
      assert.ok(Object.isFrozen(adapter));
      assert.strictEqual(typeof adapter.acquireAdvisoryLock, 'function');
      assert.strictEqual(typeof adapter.checkAdvisoryLock, 'function');
      assert.strictEqual(typeof adapter.releaseAdvisoryLock, 'function');
    });
    it('missing openSession is rejected with the fixed code', () => {
      assert.throws(() => createPostgresMigrationSessionLockAdapter({}), (e) => e.message === 'POSTGRES_LOCK_ADAPTER_OPEN_SESSION_REQUIRED');
    });
    it('non-function openSession is rejected with the fixed code', () => {
      assert.throws(() => createPostgresMigrationSessionLockAdapter({ openSession: 'nope' }), (e) => e.message === 'POSTGRES_LOCK_ADAPTER_OPEN_SESSION_REQUIRED');
    });
    it('sync openSession is supported', async () => {
      const { session } = mockSession();
      const adapter = createPostgresMigrationSessionLockAdapter({ openSession: () => session });
      const r = await adapter.acquireAdvisoryLock({ targetMigrationId: TARGET });
      assert.strictEqual(r.status, POSTGRES_LOCK_ACQUIRE_STATUSES.ACQUIRED);
    });
    it('async openSession is supported', async () => {
      const { session } = mockSession();
      const adapter = createPostgresMigrationSessionLockAdapter({ openSession: async () => session });
      const r = await adapter.acquireAdvisoryLock({ targetMigrationId: TARGET });
      assert.strictEqual(r.status, POSTGRES_LOCK_ACQUIRE_STATUSES.ACQUIRED);
    });
    it('openSession throw yields UNAVAILABLE', async () => {
      const adapter = createPostgresMigrationSessionLockAdapter({ openSession: async () => { throw new Error('boom'); } });
      const r = await adapter.acquireAdvisoryLock({ targetMigrationId: TARGET });
      assert.strictEqual(r.status, POSTGRES_LOCK_ACQUIRE_STATUSES.UNAVAILABLE);
    });
    it('null session yields UNAVAILABLE', async () => {
      const adapter = createPostgresMigrationSessionLockAdapter({ openSession: async () => null });
      const r = await adapter.acquireAdvisoryLock({ targetMigrationId: TARGET });
      assert.strictEqual(r.status, POSTGRES_LOCK_ACQUIRE_STATUSES.UNAVAILABLE);
    });
    it('array session yields UNAVAILABLE', async () => {
      const adapter = createPostgresMigrationSessionLockAdapter({ openSession: async () => [] });
      const r = await adapter.acquireAdvisoryLock({ targetMigrationId: TARGET });
      assert.strictEqual(r.status, POSTGRES_LOCK_ACQUIRE_STATUSES.UNAVAILABLE);
    });
    it('missing query yields UNAVAILABLE', async () => {
      const adapter = createPostgresMigrationSessionLockAdapter({ openSession: async () => ({ release: async () => {} }) });
      const r = await adapter.acquireAdvisoryLock({ targetMigrationId: TARGET });
      assert.strictEqual(r.status, POSTGRES_LOCK_ACQUIRE_STATUSES.UNAVAILABLE);
    });
    it('missing release yields UNAVAILABLE', async () => {
      const adapter = createPostgresMigrationSessionLockAdapter({ openSession: async () => ({ query: async () => ({ rows: [{ acquired: true }] }) }) });
      const r = await adapter.acquireAdvisoryLock({ targetMigrationId: TARGET });
      assert.strictEqual(r.status, POSTGRES_LOCK_ACQUIRE_STATUSES.UNAVAILABLE);
    });
    it('invalid session with callable release releases exactly once', async () => {
      let poolReleases = 0;
      const adapter = createPostgresMigrationSessionLockAdapter({ openSession: async () => ({ release: async () => { poolReleases += 1; } }) });
      const r = await adapter.acquireAdvisoryLock({ targetMigrationId: TARGET });
      assert.strictEqual(r.status, POSTGRES_LOCK_ACQUIRE_STATUSES.UNAVAILABLE);
      assert.strictEqual(poolReleases, 1);
    });
    it('input/session objects are not modified', async () => {
      const { session } = mockSession();
      const before = JSON.parse(JSON.stringify({ query: 'fn', release: 'fn' }));
      const adapter = createPostgresMigrationSessionLockAdapter({ openSession: async () => session });
      const input = { targetMigrationId: TARGET };
      const inputBefore = JSON.parse(JSON.stringify(input));
      await adapter.acquireAdvisoryLock(input);
      assert.deepStrictEqual(JSON.parse(JSON.stringify(input)), inputBefore);
      assert.strictEqual(typeof session.query, 'function');
      assert.strictEqual(typeof session.release, 'function');
      assert.ok(before);
    });
  });

  describe('2. Acquire', () => {
    it('issues the exact named acquire query', async () => {
      const { session, state } = mockSession();
      const adapter = adapterFor(session);
      await adapter.acquireAdvisoryLock({ targetMigrationId: TARGET });
      const qs = queriesByName(state, ACQUIRE_NAME);
      assert.strictEqual(qs.length, 1);
      assert.strictEqual(qs[0].name, 'lovebud-migration-lock-acquire-v1');
      assert.match(qs[0].text, /pg_try_advisory_lock\(/);
    });
    it('binds the exact parameterized values', async () => {
      const { session, state } = mockSession();
      const adapter = adapterFor(session);
      await adapter.acquireAdvisoryLock({ targetMigrationId: TARGET });
      const q = queriesByName(state, ACQUIRE_NAME)[0];
      assert.deepStrictEqual(q.values, [1279415620, 1296648018]);
    });
    it('does not interpolate keys into the SQL text', async () => {
      const { session, state } = mockSession();
      const adapter = adapterFor(session);
      await adapter.acquireAdvisoryLock({ targetMigrationId: TARGET });
      const q = queriesByName(state, ACQUIRE_NAME)[0];
      assert.ok(!q.text.includes('1279415620'));
      assert.ok(!q.text.includes('1296648018'));
      assert.match(q.text, /\$1::integer/);
      assert.match(q.text, /\$2::integer/);
    });
    it('acquired=true yields ACQUIRED', async () => {
      const { session } = mockSession({ acquireResult: { rows: [{ acquired: true }] } });
      const r = await adapterFor(session).acquireAdvisoryLock({ targetMigrationId: TARGET });
      assert.strictEqual(r.status, POSTGRES_LOCK_ACQUIRE_STATUSES.ACQUIRED);
    });
    it('acquired=true yields a non-null frozen handle', async () => {
      const { session } = mockSession();
      const r = await adapterFor(session).acquireAdvisoryLock({ targetMigrationId: TARGET });
      assert.ok(r.handle !== null && typeof r.handle === 'object');
      assert.ok(Object.isFrozen(r.handle));
    });
    it('acquired=true does not pool-release before final release', async () => {
      const { session, state } = mockSession();
      const adapter = adapterFor(session);
      await adapter.acquireAdvisoryLock({ targetMigrationId: TARGET });
      assert.strictEqual(state.poolReleases, 0);
    });
    it('acquired=false yields FAILED', async () => {
      const { session } = mockSession({ acquireResult: { rows: [{ acquired: false }] } });
      const r = await adapterFor(session).acquireAdvisoryLock({ targetMigrationId: TARGET });
      assert.strictEqual(r.status, POSTGRES_LOCK_ACQUIRE_STATUSES.FAILED);
    });
    it('acquired=false yields no handle', async () => {
      const { session } = mockSession({ acquireResult: { rows: [{ acquired: false }] } });
      const r = await adapterFor(session).acquireAdvisoryLock({ targetMigrationId: TARGET });
      assert.strictEqual(r.handle, undefined);
    });
    it('acquired=false pool-releases exactly once', async () => {
      const { session, state } = mockSession({ acquireResult: { rows: [{ acquired: false }] } });
      await adapterFor(session).acquireAdvisoryLock({ targetMigrationId: TARGET });
      assert.strictEqual(state.poolReleases, 1);
    });
    it('invalid target yields NOT_ATTEMPTED with openSession 0', async () => {
      let opens = 0;
      const adapter = createPostgresMigrationSessionLockAdapter({ openSession: async () => { opens += 1; return mockSession().session; } });
      for (const bad of [undefined, null, '', '   ', 42]) {
        const r = await adapter.acquireAdvisoryLock({ targetMigrationId: bad });
        assert.strictEqual(r.status, POSTGRES_LOCK_ACQUIRE_STATUSES.NOT_ATTEMPTED, String(bad));
      }
      assert.strictEqual(opens, 0);
    });
    it('acquire query throw yields UNAVAILABLE + pool release 1', async () => {
      const { session, state } = mockSession({ queryImpl: async () => { throw new Error('db down'); } });
      const r = await adapterFor(session).acquireAdvisoryLock({ targetMigrationId: TARGET });
      assert.strictEqual(r.status, POSTGRES_LOCK_ACQUIRE_STATUSES.UNAVAILABLE);
      assert.strictEqual(state.poolReleases, 1);
    });
    it('each malformed result variant yields UNAVAILABLE', async () => {
      const variants = [null, {}, { rows: [] }, { rows: [{}] }, { rows: [{ acquired: 'true' }] }, { rows: [{ acquired: true }, { acquired: false }] }];
      for (const v of variants) {
        const { session, state } = mockSession({ acquireResult: v });
        const r = await adapterFor(session).acquireAdvisoryLock({ targetMigrationId: TARGET });
        assert.strictEqual(r.status, POSTGRES_LOCK_ACQUIRE_STATUSES.UNAVAILABLE, JSON.stringify(v));
        assert.strictEqual(state.poolReleases, 1, JSON.stringify(v));
      }
    });
    it('multiple rows are rejected', async () => {
      const { session } = mockSession({ acquireResult: { rows: [{ acquired: true }, { acquired: false }] } });
      const r = await adapterFor(session).acquireAdvisoryLock({ targetMigrationId: TARGET });
      assert.strictEqual(r.status, POSTGRES_LOCK_ACQUIRE_STATUSES.UNAVAILABLE);
    });
    it('non-boolean acquired is rejected', async () => {
      const { session } = mockSession({ acquireResult: { rows: [{ acquired: 1 }] } });
      const r = await adapterFor(session).acquireAdvisoryLock({ targetMigrationId: TARGET });
      assert.strictEqual(r.status, POSTGRES_LOCK_ACQUIRE_STATUSES.UNAVAILABLE);
    });
  });

  describe('3. Handle opacity', () => {
    it('handle has no enumerable session/query/release fields', async () => {
      const { session } = mockSession();
      const r = await adapterFor(session).acquireAdvisoryLock({ targetMigrationId: TARGET });
      assert.deepStrictEqual(Object.keys(r.handle), []);
    });
    it('JSON serialization contains no session or key', async () => {
      const { session } = mockSession();
      const r = await adapterFor(session).acquireAdvisoryLock({ targetMigrationId: TARGET });
      const s = JSON.stringify(r.handle);
      assert.ok(!s.includes('1279415620'));
      assert.ok(!s.includes('1296648018'));
      assert.ok(!s.includes('query'));
      assert.ok(!s.includes('release'));
    });
    it('caller mutation of the handle is impossible', async () => {
      const { session } = mockSession();
      const r = await adapterFor(session).acquireAdvisoryLock({ targetMigrationId: TARGET });
      assert.throws(() => { r.handle.injected = 'x'; });
    });
    it('cross-adapter handle is rejected by check (FAILED)', async () => {
      const a = adapterFor(mockSession().session);
      const b = adapterFor(mockSession().session);
      const acq = await a.acquireAdvisoryLock({ targetMigrationId: TARGET });
      const r = await b.checkAdvisoryLock({ lockHandle: acq.handle });
      assert.strictEqual(r.status, POSTGRES_LOCK_CHECK_STATUSES.FAILED);
    });
    it('arbitrary object handle is rejected', async () => {
      const adapter = adapterFor(mockSession().session);
      const r = await adapter.checkAdvisoryLock({ lockHandle: { fake: true } });
      assert.strictEqual(r.status, POSTGRES_LOCK_CHECK_STATUSES.FAILED);
    });
    it('targetMigrationId is absent from handle serialization', async () => {
      const { session } = mockSession();
      const r = await adapterFor(session).acquireAdvisoryLock({ targetMigrationId: TARGET });
      assert.ok(!JSON.stringify(r.handle).includes(TARGET));
    });
    it('two successful acquires produce distinct handles/sessions', async () => {
      const sessions = [];
      const adapter = createPostgresMigrationSessionLockAdapter({ openSession: async () => { const s = mockSession().session; sessions.push(s); return s; } });
      const r1 = await adapter.acquireAdvisoryLock({ targetMigrationId: TARGET });
      const r2 = await adapter.acquireAdvisoryLock({ targetMigrationId: TARGET });
      assert.notStrictEqual(r1.handle, r2.handle);
      assert.strictEqual(sessions.length, 2);
      assert.notStrictEqual(sessions[0], sessions[1]);
    });
  });

  describe('4. Check', () => {
    it('issues the exact named check query', async () => {
      const { session, state } = mockSession();
      const adapter = adapterFor(session);
      const acq = await adapter.acquireAdvisoryLock({ targetMigrationId: TARGET });
      await adapter.checkAdvisoryLock({ lockHandle: acq.handle });
      const qs = queriesByName(state, CHECK_NAME);
      assert.strictEqual(qs.length, 1);
      assert.strictEqual(qs[0].name, 'lovebud-migration-lock-check-v1');
    });
    it('check values are the exact fixed pair', async () => {
      const { session, state } = mockSession();
      const adapter = adapterFor(session);
      const acq = await adapter.acquireAdvisoryLock({ targetMigrationId: TARGET });
      await adapter.checkAdvisoryLock({ lockHandle: acq.handle });
      assert.deepStrictEqual(queriesByName(state, CHECK_NAME)[0].values, [1279415620, 1296648018]);
    });
    it('check SQL references pg_locks', () => {
      assert.match(POSTGRES_MIGRATION_LOCK_QUERIES.check.text, /pg_locks/);
    });
    it('check SQL references pg_backend_pid()', () => {
      assert.match(POSTGRES_MIGRATION_LOCK_QUERIES.check.text, /pg_backend_pid\(\)/);
    });
    it('check SQL constrains the current database', () => {
      assert.match(POSTGRES_MIGRATION_LOCK_QUERIES.check.text, /current_database\(\)/);
    });
    it('check SQL constrains objsubid = 2', () => {
      assert.match(POSTGRES_MIGRATION_LOCK_QUERIES.check.text, /objsubid = 2/);
    });
    it('check SQL constrains ExclusiveLock', () => {
      assert.match(POSTGRES_MIGRATION_LOCK_QUERIES.check.text, /ExclusiveLock/);
    });
    it('check SQL constrains granted = TRUE', () => {
      assert.match(POSTGRES_MIGRATION_LOCK_QUERIES.check.text, /granted = TRUE/);
    });
    it('held=true yields ACQUIRED', async () => {
      const { session } = mockSession({ checkResult: { rows: [{ held: true }] } });
      const adapter = adapterFor(session);
      const acq = await adapter.acquireAdvisoryLock({ targetMigrationId: TARGET });
      const r = await adapter.checkAdvisoryLock({ lockHandle: acq.handle });
      assert.strictEqual(r.status, POSTGRES_LOCK_CHECK_STATUSES.ACQUIRED);
    });
    it('held=false yields LOST', async () => {
      const { session } = mockSession({ checkResult: { rows: [{ held: false }] } });
      const adapter = adapterFor(session);
      const acq = await adapter.acquireAdvisoryLock({ targetMigrationId: TARGET });
      const r = await adapter.checkAdvisoryLock({ lockHandle: acq.handle });
      assert.strictEqual(r.status, POSTGRES_LOCK_CHECK_STATUSES.LOST);
    });
    it('invalid handle yields FAILED with query 0', async () => {
      const { session, state } = mockSession();
      const adapter = adapterFor(session);
      await adapter.acquireAdvisoryLock({ targetMigrationId: TARGET });
      const before = state.queries.length;
      const r = await adapter.checkAdvisoryLock({ lockHandle: undefined });
      assert.strictEqual(r.status, POSTGRES_LOCK_CHECK_STATUSES.FAILED);
      assert.strictEqual(state.queries.length, before);
    });
    it('cross-adapter handle yields FAILED', async () => {
      const a = adapterFor(mockSession().session);
      const bState = mockSession();
      const b = adapterFor(bState.session);
      const acq = await a.acquireAdvisoryLock({ targetMigrationId: TARGET });
      const before = bState.state.queries.length;
      const r = await b.checkAdvisoryLock({ lockHandle: acq.handle });
      assert.strictEqual(r.status, POSTGRES_LOCK_CHECK_STATUSES.FAILED);
      assert.strictEqual(bState.state.queries.length, before);
    });
    it('released handle yields LOST with query 0', async () => {
      const { session, state } = mockSession();
      const adapter = adapterFor(session);
      const acq = await adapter.acquireAdvisoryLock({ targetMigrationId: TARGET });
      await adapter.releaseAdvisoryLock({ lockHandle: acq.handle });
      const before = queriesByName(state, CHECK_NAME).length;
      const r = await adapter.checkAdvisoryLock({ lockHandle: acq.handle });
      assert.strictEqual(r.status, POSTGRES_LOCK_CHECK_STATUSES.LOST);
      assert.strictEqual(queriesByName(state, CHECK_NAME).length, before);
    });
    it('check query throw yields UNAVAILABLE', async () => {
      const { session } = mockSession({ queryImpl: async (q) => { if (q.name === CHECK_NAME) throw new Error('x'); if (q.name === ACQUIRE_NAME) return { rows: [{ acquired: true }] }; return { rows: [{ released: true }] }; } });
      const adapter = adapterFor(session);
      const acq = await adapter.acquireAdvisoryLock({ targetMigrationId: TARGET });
      const r = await adapter.checkAdvisoryLock({ lockHandle: acq.handle });
      assert.strictEqual(r.status, POSTGRES_LOCK_CHECK_STATUSES.UNAVAILABLE);
    });
    it('malformed held evidence yields UNAVAILABLE', async () => {
      for (const v of [null, {}, { rows: [] }, { rows: [{}] }, { rows: [{ held: 'yes' }] }]) {
        const { session } = mockSession({ checkResult: v });
        const adapter = adapterFor(session);
        const acq = await adapter.acquireAdvisoryLock({ targetMigrationId: TARGET });
        const r = await adapter.checkAdvisoryLock({ lockHandle: acq.handle });
        assert.strictEqual(r.status, POSTGRES_LOCK_CHECK_STATUSES.UNAVAILABLE, JSON.stringify(v));
      }
    });
    it('check does not pool-release the session', async () => {
      const { session, state } = mockSession();
      const adapter = adapterFor(session);
      const acq = await adapter.acquireAdvisoryLock({ targetMigrationId: TARGET });
      await adapter.checkAdvisoryLock({ lockHandle: acq.handle });
      assert.strictEqual(state.poolReleases, 0);
    });
  });

  describe('5. Release', () => {
    it('issues the exact named release query', async () => {
      const { session, state } = mockSession();
      const adapter = adapterFor(session);
      const acq = await adapter.acquireAdvisoryLock({ targetMigrationId: TARGET });
      await adapter.releaseAdvisoryLock({ lockHandle: acq.handle });
      const qs = queriesByName(state, RELEASE_NAME);
      assert.strictEqual(qs.length, 1);
      assert.strictEqual(qs[0].name, 'lovebud-migration-lock-release-v1');
    });
    it('release values are the exact fixed pair', async () => {
      const { session, state } = mockSession();
      const adapter = adapterFor(session);
      const acq = await adapter.acquireAdvisoryLock({ targetMigrationId: TARGET });
      await adapter.releaseAdvisoryLock({ lockHandle: acq.handle });
      assert.deepStrictEqual(queriesByName(state, RELEASE_NAME)[0].values, [1279415620, 1296648018]);
    });
    it('release uses pg_advisory_unlock', () => {
      assert.match(POSTGRES_MIGRATION_LOCK_QUERIES.release.text, /pg_advisory_unlock\(/);
    });
    it('release does not use pg_advisory_unlock_all', () => {
      assert.ok(!POSTGRES_MIGRATION_LOCK_QUERIES.release.text.includes('pg_advisory_unlock_all'));
    });
    it('released=true + pool release success yields RELEASED', async () => {
      const { session } = mockSession({ releaseResult: { rows: [{ released: true }] } });
      const adapter = adapterFor(session);
      const acq = await adapter.acquireAdvisoryLock({ targetMigrationId: TARGET });
      const r = await adapter.releaseAdvisoryLock({ lockHandle: acq.handle });
      assert.strictEqual(r.status, POSTGRES_LOCK_RELEASE_STATUSES.RELEASED);
    });
    it('released=false yields FAILED', async () => {
      const { session } = mockSession({ releaseResult: { rows: [{ released: false }] } });
      const adapter = adapterFor(session);
      const acq = await adapter.acquireAdvisoryLock({ targetMigrationId: TARGET });
      const r = await adapter.releaseAdvisoryLock({ lockHandle: acq.handle });
      assert.strictEqual(r.status, POSTGRES_LOCK_RELEASE_STATUSES.FAILED);
    });
    it('released=false still pool-releases once', async () => {
      const { session, state } = mockSession({ releaseResult: { rows: [{ released: false }] } });
      const adapter = adapterFor(session);
      const acq = await adapter.acquireAdvisoryLock({ targetMigrationId: TARGET });
      await adapter.releaseAdvisoryLock({ lockHandle: acq.handle });
      assert.strictEqual(state.poolReleases, 1);
    });
    it('release query throw yields UNKNOWN + pool release 1', async () => {
      const { session, state } = mockSession({ queryImpl: async (q) => { if (q.name === RELEASE_NAME) throw new Error('x'); if (q.name === ACQUIRE_NAME) return { rows: [{ acquired: true }] }; return {}; } });
      const adapter = adapterFor(session);
      const acq = await adapter.acquireAdvisoryLock({ targetMigrationId: TARGET });
      const r = await adapter.releaseAdvisoryLock({ lockHandle: acq.handle });
      assert.strictEqual(r.status, POSTGRES_LOCK_RELEASE_STATUSES.UNKNOWN);
      assert.strictEqual(state.poolReleases, 1);
    });
    it('malformed release evidence yields UNKNOWN', async () => {
      for (const v of [null, {}, { rows: [] }, { rows: [{}] }, { rows: [{ released: 'yes' }] }]) {
        const { session, state } = mockSession({ releaseResult: v });
        const adapter = adapterFor(session);
        const acq = await adapter.acquireAdvisoryLock({ targetMigrationId: TARGET });
        const r = await adapter.releaseAdvisoryLock({ lockHandle: acq.handle });
        assert.strictEqual(r.status, POSTGRES_LOCK_RELEASE_STATUSES.UNKNOWN, JSON.stringify(v));
        assert.strictEqual(state.poolReleases, 1, JSON.stringify(v));
      }
    });
    it('pool release throw after unlock true yields UNKNOWN', async () => {
      const { session } = mockSession({ releaseResult: { rows: [{ released: true }] }, poolReleaseImpl: async () => { throw new Error('pool'); } });
      const adapter = adapterFor(session);
      const acq = await adapter.acquireAdvisoryLock({ targetMigrationId: TARGET });
      const r = await adapter.releaseAdvisoryLock({ lockHandle: acq.handle });
      assert.strictEqual(r.status, POSTGRES_LOCK_RELEASE_STATUSES.UNKNOWN);
    });
    it('invalid handle yields UNKNOWN with query/release 0', async () => {
      const { session, state } = mockSession();
      const adapter = adapterFor(session);
      await adapter.acquireAdvisoryLock({ targetMigrationId: TARGET });
      const qBefore = state.queries.length;
      const pBefore = state.poolReleases;
      const r = await adapter.releaseAdvisoryLock({ lockHandle: { bogus: true } });
      assert.strictEqual(r.status, POSTGRES_LOCK_RELEASE_STATUSES.UNKNOWN);
      assert.strictEqual(state.queries.length, qBefore);
      assert.strictEqual(state.poolReleases, pBefore);
    });
    it('cross-adapter handle yields UNKNOWN', async () => {
      const a = adapterFor(mockSession().session);
      const b = adapterFor(mockSession().session);
      const acq = await a.acquireAdvisoryLock({ targetMigrationId: TARGET });
      const r = await b.releaseAdvisoryLock({ lockHandle: acq.handle });
      assert.strictEqual(r.status, POSTGRES_LOCK_RELEASE_STATUSES.UNKNOWN);
    });
    it('repeated release yields UNKNOWN the second time', async () => {
      const { session } = mockSession();
      const adapter = adapterFor(session);
      const acq = await adapter.acquireAdvisoryLock({ targetMigrationId: TARGET });
      const r1 = await adapter.releaseAdvisoryLock({ lockHandle: acq.handle });
      const r2 = await adapter.releaseAdvisoryLock({ lockHandle: acq.handle });
      assert.strictEqual(r1.status, POSTGRES_LOCK_RELEASE_STATUSES.RELEASED);
      assert.strictEqual(r2.status, POSTGRES_LOCK_RELEASE_STATUSES.UNKNOWN);
    });
    it('release query runs exactly once total', async () => {
      const { session, state } = mockSession();
      const adapter = adapterFor(session);
      const acq = await adapter.acquireAdvisoryLock({ targetMigrationId: TARGET });
      await adapter.releaseAdvisoryLock({ lockHandle: acq.handle });
      await adapter.releaseAdvisoryLock({ lockHandle: acq.handle });
      assert.strictEqual(queriesByName(state, RELEASE_NAME).length, 1);
    });
    it('pool release runs exactly once total', async () => {
      const { session, state } = mockSession();
      const adapter = adapterFor(session);
      const acq = await adapter.acquireAdvisoryLock({ targetMigrationId: TARGET });
      await adapter.releaseAdvisoryLock({ lockHandle: acq.handle });
      await adapter.releaseAdvisoryLock({ lockHandle: acq.handle });
      assert.strictEqual(state.poolReleases, 1);
    });
    it('concurrent double release does not duplicate the release query', async () => {
      const { session, state } = mockSession();
      const adapter = adapterFor(session);
      const acq = await adapter.acquireAdvisoryLock({ targetMigrationId: TARGET });
      await Promise.all([adapter.releaseAdvisoryLock({ lockHandle: acq.handle }), adapter.releaseAdvisoryLock({ lockHandle: acq.handle })]);
      assert.strictEqual(queriesByName(state, RELEASE_NAME).length, 1);
    });
    it('concurrent double release does not duplicate pool release', async () => {
      const { session, state } = mockSession();
      const adapter = adapterFor(session);
      const acq = await adapter.acquireAdvisoryLock({ targetMigrationId: TARGET });
      await Promise.all([adapter.releaseAdvisoryLock({ lockHandle: acq.handle }), adapter.releaseAdvisoryLock({ lockHandle: acq.handle })]);
      assert.strictEqual(state.poolReleases, 1);
    });
    it('check during/after release does not query', async () => {
      const { session, state } = mockSession();
      const adapter = adapterFor(session);
      const acq = await adapter.acquireAdvisoryLock({ targetMigrationId: TARGET });
      await adapter.releaseAdvisoryLock({ lockHandle: acq.handle });
      const before = queriesByName(state, CHECK_NAME).length;
      await adapter.checkAdvisoryLock({ lockHandle: acq.handle });
      assert.strictEqual(queriesByName(state, CHECK_NAME).length, before);
    });
  });

  describe('6. SQL / source safety', () => {
    const source = fs.readFileSync(CORE_PATH, 'utf8');
    it('fixed key values are exact', () => {
      assert.strictEqual(POSTGRES_MIGRATION_LOCK_KEYS.classKey, 1279415620);
      assert.strictEqual(POSTGRES_MIGRATION_LOCK_KEYS.objectKey, 1296648018);
    });
    it('both keys are signed-int32-safe', () => {
      for (const k of [POSTGRES_MIGRATION_LOCK_KEYS.classKey, POSTGRES_MIGRATION_LOCK_KEYS.objectKey]) {
        assert.ok(Number.isInteger(k));
        assert.ok(k > 0 && k <= 2147483647);
      }
    });
    it('query values use the fixed keys', () => {
      for (const q of Object.values(POSTGRES_MIGRATION_LOCK_QUERIES)) {
        assert.deepStrictEqual(q.values, [1279415620, 1296648018]);
      }
    });
    it('no blocking pg_advisory_lock(', () => {
      assert.ok(!/pg_advisory_lock\(/.test(source));
    });
    it('no transaction-level advisory lock', () => {
      assert.ok(!source.includes('pg_advisory_xact_lock'));
    });
    it('no shared advisory lock', () => {
      assert.ok(!source.includes('advisory_lock_shared'));
      assert.ok(!source.includes('pg_try_advisory_lock_shared'));
    });
    it('no SELECT *', () => {
      assert.ok(!/SELECT\s+\*/i.test(source));
    });
    it('no dynamic SQL interpolation of keys', () => {
      assert.ok(!source.includes('${'));
    });
    it('core does not require pg', () => {
      assert.doesNotMatch(source, /require\(['"]pg['"]\)/);
    });
    it('no process.env', () => {
      assert.ok(!source.includes('process.env'));
    });
    it('no DATABASE_URL', () => {
      assert.ok(!source.includes('DATABASE_URL'));
    });
    it('no fetch/http/net/tls/child_process', () => {
      assert.doesNotMatch(source, /require\(['"](?:http|https|net|tls|child_process|node:http|node:https|node:net|node:tls|node:child_process)['"]\)/);
      assert.ok(!/\bfetch\s*\(/.test(source));
    });
    it('no filesystem write', () => {
      assert.doesNotMatch(source, /fs\.(writeFileSync|mkdirSync|rmSync|appendFileSync|createWriteStream)/);
    });
    it('no console logging', () => {
      assert.doesNotMatch(source, /console\.(log|error|warn|info|debug)/);
    });
    it('no raw error/stack leakage in results', async () => {
      const { session } = mockSession({ queryImpl: async () => { throw new Error('secret-db-detail'); } });
      const r = await adapterFor(session).acquireAdvisoryLock({ targetMigrationId: TARGET });
      assert.ok(!JSON.stringify(r).includes('secret-db-detail'));
      assert.ok(!('error' in r) && !('stack' in r) && !('message' in r));
    });
    it('deterministic results for identical synthetic evidence', async () => {
      const run = async () => {
        const { session } = mockSession();
        const adapter = adapterFor(session);
        const acq = await adapter.acquireAdvisoryLock({ targetMigrationId: TARGET });
        return acq.status;
      };
      assert.strictEqual(await run(), await run());
    });
  });

  describe('7. Fail-closed malformed boundaries (HOLD A)', () => {
    function throwingGetterObject(key, secretMessage) {
      const obj = {};
      Object.defineProperty(obj, key, {
        enumerable: true,
        configurable: true,
        get() { throw new Error(secretMessage || 'getter-blew-up'); }
      });
      return obj;
    }

    function accessorObject(key, value, counter) {
      const obj = {};
      Object.defineProperty(obj, key, {
        enumerable: true,
        configurable: true,
        get() { if (counter) counter.count += 1; return value; }
      });
      return obj;
    }

    function revokedProxy(target) {
      const revocable = Proxy.revocable(target, {});
      revocable.revoke();
      return revocable.proxy;
    }

    it('acquire throwing-getter targetMigrationId yields NOT_ATTEMPTED, openSession 0', async () => {
      let opens = 0;
      const adapter = createPostgresMigrationSessionLockAdapter({ openSession: async () => { opens += 1; return mockSession().session; } });
      const r = await adapter.acquireAdvisoryLock(throwingGetterObject('targetMigrationId'));
      assert.strictEqual(r.status, POSTGRES_LOCK_ACQUIRE_STATUSES.NOT_ATTEMPTED);
      assert.strictEqual(opens, 0);
    });
    it('acquire accessor targetMigrationId is not executed and yields NOT_ATTEMPTED', async () => {
      const counter = { count: 0 };
      const adapter = adapterFor(mockSession().session);
      const r = await adapter.acquireAdvisoryLock(accessorObject('targetMigrationId', TARGET, counter));
      assert.strictEqual(r.status, POSTGRES_LOCK_ACQUIRE_STATUSES.NOT_ATTEMPTED);
      assert.strictEqual(counter.count, 0);
    });
    it('acquire revoked Proxy arg yields NOT_ATTEMPTED', async () => {
      const adapter = adapterFor(mockSession().session);
      const r = await adapter.acquireAdvisoryLock(revokedProxy({ targetMigrationId: TARGET }));
      assert.strictEqual(r.status, POSTGRES_LOCK_ACQUIRE_STATUSES.NOT_ATTEMPTED);
    });
    it('acquire descriptor-inspection-throwing arg yields NOT_ATTEMPTED', async () => {
      const adapter = adapterFor(mockSession().session);
      const arg = new Proxy({ targetMigrationId: TARGET }, { getOwnPropertyDescriptor() { throw new Error('desc'); } });
      const r = await adapter.acquireAdvisoryLock(arg);
      assert.strictEqual(r.status, POSTGRES_LOCK_ACQUIRE_STATUSES.NOT_ATTEMPTED);
    });
    it('acquire null/undefined arg yields NOT_ATTEMPTED', async () => {
      const adapter = adapterFor(mockSession().session);
      assert.strictEqual((await adapter.acquireAdvisoryLock(null)).status, POSTGRES_LOCK_ACQUIRE_STATUSES.NOT_ATTEMPTED);
      assert.strictEqual((await adapter.acquireAdvisoryLock(undefined)).status, POSTGRES_LOCK_ACQUIRE_STATUSES.NOT_ATTEMPTED);
    });
    it('acquire session with throwing query getter yields UNAVAILABLE without running the getter', async () => {
      let queryGetterCalls = 0;
      let poolReleases = 0;
      const session = {};
      Object.defineProperty(session, 'query', { enumerable: true, configurable: true, get() { queryGetterCalls += 1; throw new Error('query-getter'); } });
      Object.defineProperty(session, 'release', { enumerable: true, configurable: true, writable: true, value: async () => { poolReleases += 1; } });
      const adapter = createPostgresMigrationSessionLockAdapter({ openSession: async () => session });
      const r = await adapter.acquireAdvisoryLock({ targetMigrationId: TARGET });
      assert.strictEqual(r.status, POSTGRES_LOCK_ACQUIRE_STATUSES.UNAVAILABLE);
      assert.strictEqual(queryGetterCalls, 0);
      assert.strictEqual(poolReleases, 1);
    });
    it('acquire revoked Proxy session yields UNAVAILABLE', async () => {
      const session = revokedProxy({ query: async () => ({ rows: [{ acquired: true }] }), release: async () => {} });
      const adapter = createPostgresMigrationSessionLockAdapter({ openSession: async () => session });
      const r = await adapter.acquireAdvisoryLock({ targetMigrationId: TARGET });
      assert.strictEqual(r.status, POSTGRES_LOCK_ACQUIRE_STATUSES.UNAVAILABLE);
    });
    it('acquire session with getPrototypeOf throw yields UNAVAILABLE + pool release 1', async () => {
      let poolReleases = 0;
      const target = { query: async () => ({ rows: [{ acquired: true }] }), release: async () => { poolReleases += 1; } };
      const session = new Proxy(target, { getPrototypeOf() { throw new Error('proto-getter'); } });
      const adapter = createPostgresMigrationSessionLockAdapter({ openSession: async () => session });
      const r = await adapter.acquireAdvisoryLock({ targetMigrationId: TARGET });
      assert.strictEqual(r.status, POSTGRES_LOCK_ACQUIRE_STATUSES.UNAVAILABLE);
      assert.strictEqual(poolReleases, 1);
    });
    it('acquire rows-getter-throw evidence yields UNAVAILABLE + pool release 1 without running the getter', async () => {
      let rowsGetterCalls = 0;
      const result = {};
      Object.defineProperty(result, 'rows', { enumerable: true, configurable: true, get() { rowsGetterCalls += 1; throw new Error('rows-getter'); } });
      const { session, state } = mockSession({ acquireResult: result });
      const r = await adapterFor(session).acquireAdvisoryLock({ targetMigrationId: TARGET });
      assert.strictEqual(r.status, POSTGRES_LOCK_ACQUIRE_STATUSES.UNAVAILABLE);
      assert.strictEqual(rowsGetterCalls, 0);
      assert.strictEqual(state.poolReleases, 1);
    });
    it('acquire acquired-field-getter-throw evidence yields UNAVAILABLE + pool release 1 without running the getter', async () => {
      let fieldGetterCalls = 0;
      const row = {};
      Object.defineProperty(row, 'acquired', { enumerable: true, configurable: true, get() { fieldGetterCalls += 1; throw new Error('field-getter'); } });
      const { session, state } = mockSession({ acquireResult: { rows: [row] } });
      const r = await adapterFor(session).acquireAdvisoryLock({ targetMigrationId: TARGET });
      assert.strictEqual(r.status, POSTGRES_LOCK_ACQUIRE_STATUSES.UNAVAILABLE);
      assert.strictEqual(fieldGetterCalls, 0);
      assert.strictEqual(state.poolReleases, 1);
    });
    it('acquire revoked Proxy evidence yields UNAVAILABLE + pool release 1', async () => {
      const { session, state } = mockSession({ acquireResult: revokedProxy({ rows: [{ acquired: true }] }) });
      const r = await adapterFor(session).acquireAdvisoryLock({ targetMigrationId: TARGET });
      assert.strictEqual(r.status, POSTGRES_LOCK_ACQUIRE_STATUSES.UNAVAILABLE);
      assert.strictEqual(state.poolReleases, 1);
    });
    it('factory config.openSession throwing getter maps to the fixed code only, getter not run', () => {
      let calls = 0;
      const config = {};
      Object.defineProperty(config, 'openSession', { enumerable: true, configurable: true, get() { calls += 1; throw new Error('secret-config-detail'); } });
      assert.throws(() => createPostgresMigrationSessionLockAdapter(config), (e) => e.message === 'POSTGRES_LOCK_ADAPTER_OPEN_SESSION_REQUIRED');
      assert.strictEqual(calls, 0);
    });
    it('factory revoked Proxy config maps to the fixed code', () => {
      const config = revokedProxy({ openSession: async () => mockSession().session });
      assert.throws(() => createPostgresMigrationSessionLockAdapter(config), (e) => e.message === 'POSTGRES_LOCK_ADAPTER_OPEN_SESSION_REQUIRED');
    });
    it('factory descriptor-inspection-throwing config maps to the fixed code', () => {
      const config = new Proxy({ openSession: async () => mockSession().session }, { getOwnPropertyDescriptor() { throw new Error('desc'); } });
      assert.throws(() => createPostgresMigrationSessionLockAdapter(config), (e) => e.message === 'POSTGRES_LOCK_ADAPTER_OPEN_SESSION_REQUIRED');
    });
    it('factory null/undefined config maps to the fixed code', () => {
      assert.throws(() => createPostgresMigrationSessionLockAdapter(null), (e) => e.message === 'POSTGRES_LOCK_ADAPTER_OPEN_SESSION_REQUIRED');
      assert.throws(() => createPostgresMigrationSessionLockAdapter(undefined), (e) => e.message === 'POSTGRES_LOCK_ADAPTER_OPEN_SESSION_REQUIRED');
    });
    it('check arg.lockHandle throwing getter yields FAILED', async () => {
      const { session } = mockSession();
      const adapter = adapterFor(session);
      await adapter.acquireAdvisoryLock({ targetMigrationId: TARGET });
      const r = await adapter.checkAdvisoryLock(throwingGetterObject('lockHandle'));
      assert.strictEqual(r.status, POSTGRES_LOCK_CHECK_STATUSES.FAILED);
    });
    it('check revoked Proxy arg yields FAILED', async () => {
      const adapter = adapterFor(mockSession().session);
      const r = await adapter.checkAdvisoryLock(revokedProxy({ lockHandle: {} }));
      assert.strictEqual(r.status, POSTGRES_LOCK_CHECK_STATUSES.FAILED);
    });
    it('check rows-getter-throw evidence yields UNAVAILABLE', async () => {
      const { session } = mockSession({ checkResult: throwingGetterObject('rows') });
      const adapter = adapterFor(session);
      const acq = await adapter.acquireAdvisoryLock({ targetMigrationId: TARGET });
      const r = await adapter.checkAdvisoryLock({ lockHandle: acq.handle });
      assert.strictEqual(r.status, POSTGRES_LOCK_CHECK_STATUSES.UNAVAILABLE);
    });
    it('check held-field-getter-throw evidence yields UNAVAILABLE', async () => {
      const { session } = mockSession({ checkResult: { rows: [throwingGetterObject('held')] } });
      const adapter = adapterFor(session);
      const acq = await adapter.acquireAdvisoryLock({ targetMigrationId: TARGET });
      const r = await adapter.checkAdvisoryLock({ lockHandle: acq.handle });
      assert.strictEqual(r.status, POSTGRES_LOCK_CHECK_STATUSES.UNAVAILABLE);
    });
    it('release arg.lockHandle throwing getter yields UNKNOWN with query/release 0', async () => {
      const { session, state } = mockSession();
      const adapter = adapterFor(session);
      await adapter.acquireAdvisoryLock({ targetMigrationId: TARGET });
      const qBefore = state.queries.length;
      const r = await adapter.releaseAdvisoryLock(throwingGetterObject('lockHandle'));
      assert.strictEqual(r.status, POSTGRES_LOCK_RELEASE_STATUSES.UNKNOWN);
      assert.strictEqual(state.queries.length, qBefore);
      assert.strictEqual(state.poolReleases, 0);
    });
    it('release revoked Proxy arg yields UNKNOWN', async () => {
      const adapter = adapterFor(mockSession().session);
      const r = await adapter.releaseAdvisoryLock(revokedProxy({ lockHandle: {} }));
      assert.strictEqual(r.status, POSTGRES_LOCK_RELEASE_STATUSES.UNKNOWN);
    });
    it('release rows-getter-throw evidence yields UNKNOWN + pool release 1', async () => {
      const { session, state } = mockSession({ releaseResult: throwingGetterObject('rows') });
      const adapter = adapterFor(session);
      const acq = await adapter.acquireAdvisoryLock({ targetMigrationId: TARGET });
      const r = await adapter.releaseAdvisoryLock({ lockHandle: acq.handle });
      assert.strictEqual(r.status, POSTGRES_LOCK_RELEASE_STATUSES.UNKNOWN);
      assert.strictEqual(state.poolReleases, 1);
    });
    it('release released-field-getter-throw evidence yields UNKNOWN + pool release 1', async () => {
      const { session, state } = mockSession({ releaseResult: { rows: [throwingGetterObject('released')] } });
      const adapter = adapterFor(session);
      const acq = await adapter.acquireAdvisoryLock({ targetMigrationId: TARGET });
      const r = await adapter.releaseAdvisoryLock({ lockHandle: acq.handle });
      assert.strictEqual(r.status, POSTGRES_LOCK_RELEASE_STATUSES.UNKNOWN);
      assert.strictEqual(state.poolReleases, 1);
    });
    it('malformed throwing evidence never leaks the raw error detail', async () => {
      const secret = 'super-secret-db-detail';
      const result = {};
      Object.defineProperty(result, 'rows', { enumerable: true, configurable: true, get() { throw new Error(secret); } });
      const { session } = mockSession({ acquireResult: result });
      const r = await adapterFor(session).acquireAdvisoryLock({ targetMigrationId: TARGET });
      assert.ok(!JSON.stringify(r).includes(secret));
      assert.ok(!('error' in r) && !('stack' in r) && !('message' in r));
    });
    it('public methods never throw across malformed/throwing boundaries', async () => {
      const adapter = adapterFor(mockSession().session);
      await assert.doesNotReject(adapter.acquireAdvisoryLock(throwingGetterObject('targetMigrationId')));
      await assert.doesNotReject(adapter.acquireAdvisoryLock(revokedProxy({ targetMigrationId: TARGET })));
      await assert.doesNotReject(adapter.checkAdvisoryLock(throwingGetterObject('lockHandle')));
      await assert.doesNotReject(adapter.checkAdvisoryLock(revokedProxy({})));
      await assert.doesNotReject(adapter.releaseAdvisoryLock(throwingGetterObject('lockHandle')));
      await assert.doesNotReject(adapter.releaseAdvisoryLock(revokedProxy({})));
    });
  });
});
