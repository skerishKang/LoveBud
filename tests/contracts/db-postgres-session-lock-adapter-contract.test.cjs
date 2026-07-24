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
  BROKER_ERROR_QUERY_UNAVAILABLE,
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
      assert.deepStrictEqual(Object.keys(adapter).sort(), ['acquireAdvisoryLock', 'checkAdvisoryLock', 'queryLockedSession', 'releaseAdvisoryLock']);
      assert.strictEqual(typeof adapter.acquireAdvisoryLock, 'function');
      assert.strictEqual(typeof adapter.checkAdvisoryLock, 'function');
      assert.strictEqual(typeof adapter.queryLockedSession, 'function');
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

  describe('8. Cleanup failure mapping (HOLD B)', () => {
    it('acquired=false + cleanup success yields FAILED + pool release 1', async () => {
      const { session, state } = mockSession({ acquireResult: { rows: [{ acquired: false }] } });
      const r = await adapterFor(session).acquireAdvisoryLock({ targetMigrationId: TARGET });
      assert.strictEqual(r.status, POSTGRES_LOCK_ACQUIRE_STATUSES.FAILED);
      assert.strictEqual(state.poolReleases, 1);
      assert.strictEqual(r.handle, undefined);
    });
    it('acquired=false + cleanup sync throw yields UNAVAILABLE', async () => {
      let cleanupAttempts = 0;
      const { session } = mockSession({ acquireResult: { rows: [{ acquired: false }] }, poolReleaseImpl: () => { cleanupAttempts += 1; throw new Error('cleanup-sync'); } });
      const r = await adapterFor(session).acquireAdvisoryLock({ targetMigrationId: TARGET });
      assert.strictEqual(r.status, POSTGRES_LOCK_ACQUIRE_STATUSES.UNAVAILABLE);
      assert.strictEqual(cleanupAttempts, 1);
      assert.strictEqual(r.handle, undefined);
    });
    it('acquired=false + cleanup rejection yields UNAVAILABLE', async () => {
      let cleanupAttempts = 0;
      const { session } = mockSession({ acquireResult: { rows: [{ acquired: false }] }, poolReleaseImpl: async () => { cleanupAttempts += 1; throw new Error('cleanup-reject'); } });
      const r = await adapterFor(session).acquireAdvisoryLock({ targetMigrationId: TARGET });
      assert.strictEqual(r.status, POSTGRES_LOCK_ACQUIRE_STATUSES.UNAVAILABLE);
      assert.strictEqual(cleanupAttempts, 1);
    });
    it('acquire query throw + cleanup throw yields UNAVAILABLE (cleanup once)', async () => {
      let cleanupAttempts = 0;
      const { session } = mockSession({ queryImpl: async () => { throw new Error('db down'); }, poolReleaseImpl: () => { cleanupAttempts += 1; throw new Error('cleanup'); } });
      const r = await adapterFor(session).acquireAdvisoryLock({ targetMigrationId: TARGET });
      assert.strictEqual(r.status, POSTGRES_LOCK_ACQUIRE_STATUSES.UNAVAILABLE);
      assert.strictEqual(cleanupAttempts, 1);
    });
    it('malformed acquire evidence + cleanup throw yields UNAVAILABLE (cleanup once)', async () => {
      let cleanupAttempts = 0;
      const { session } = mockSession({ acquireResult: { rows: [{ acquired: true, secret: 'x' }] }, poolReleaseImpl: () => { cleanupAttempts += 1; throw new Error('cleanup'); } });
      const r = await adapterFor(session).acquireAdvisoryLock({ targetMigrationId: TARGET });
      assert.strictEqual(r.status, POSTGRES_LOCK_ACQUIRE_STATUSES.UNAVAILABLE);
      assert.strictEqual(cleanupAttempts, 1);
    });
    it('each acquire failure path attempts cleanup exactly once', async () => {
      let n = 0;
      let s = mockSession({ acquireResult: { rows: [{ acquired: false }] }, poolReleaseImpl: async () => { n += 1; } });
      await adapterFor(s.session).acquireAdvisoryLock({ targetMigrationId: TARGET });
      assert.strictEqual(n, 1, 'acquired=false');
      n = 0;
      s = mockSession({ queryImpl: async () => { throw new Error('x'); }, poolReleaseImpl: async () => { n += 1; } });
      await adapterFor(s.session).acquireAdvisoryLock({ targetMigrationId: TARGET });
      assert.strictEqual(n, 1, 'query throw');
      n = 0;
      s = mockSession({ acquireResult: { rows: [] }, poolReleaseImpl: async () => { n += 1; } });
      await adapterFor(s.session).acquireAdvisoryLock({ targetMigrationId: TARGET });
      assert.strictEqual(n, 1, 'malformed evidence');
      n = 0;
      const adapter = createPostgresMigrationSessionLockAdapter({ openSession: async () => ({ release: async () => { n += 1; } }) });
      await adapter.acquireAdvisoryLock({ targetMigrationId: TARGET });
      assert.strictEqual(n, 1, 'invalid session');
    });
    it('all acquire failure paths return no handle', async () => {
      const sessions = [
        mockSession({ acquireResult: { rows: [{ acquired: false }] } }).session,
        mockSession({ queryImpl: async () => { throw new Error('x'); } }).session,
        mockSession({ acquireResult: { rows: [{ acquired: true, secret: 'x' }] } }).session,
        mockSession({ acquireResult: { rows: [] } }).session
      ];
      for (const session of sessions) {
        const r = await adapterFor(session).acquireAdvisoryLock({ targetMigrationId: TARGET });
        assert.strictEqual(r.handle, undefined);
        assert.notStrictEqual(r.status, POSTGRES_LOCK_ACQUIRE_STATUSES.ACQUIRED);
      }
    });
  });

  describe('9. Exact row evidence (HOLD C)', () => {
    it('acquire row with extra string key yields UNAVAILABLE', async () => {
      const { session } = mockSession({ acquireResult: { rows: [{ acquired: true, secret: 'x' }] } });
      const r = await adapterFor(session).acquireAdvisoryLock({ targetMigrationId: TARGET });
      assert.strictEqual(r.status, POSTGRES_LOCK_ACQUIRE_STATUSES.UNAVAILABLE);
    });
    it('check row with extra string key yields UNAVAILABLE', async () => {
      const { session } = mockSession({ checkResult: { rows: [{ held: true, pid: 123 }] } });
      const adapter = adapterFor(session);
      const acq = await adapter.acquireAdvisoryLock({ targetMigrationId: TARGET });
      const r = await adapter.checkAdvisoryLock({ lockHandle: acq.handle });
      assert.strictEqual(r.status, POSTGRES_LOCK_CHECK_STATUSES.UNAVAILABLE);
    });
    it('release row with extra string key yields UNKNOWN', async () => {
      const { session } = mockSession({ releaseResult: { rows: [{ released: true, raw: {} }] } });
      const adapter = adapterFor(session);
      const acq = await adapter.acquireAdvisoryLock({ targetMigrationId: TARGET });
      const r = await adapter.releaseAdvisoryLock({ lockHandle: acq.handle });
      assert.strictEqual(r.status, POSTGRES_LOCK_RELEASE_STATUSES.UNKNOWN);
    });
    it('acquire row with extra enumerable symbol yields UNAVAILABLE', async () => {
      const row = { acquired: true };
      row[Symbol('extra')] = 'x';
      const { session } = mockSession({ acquireResult: { rows: [row] } });
      const r = await adapterFor(session).acquireAdvisoryLock({ targetMigrationId: TARGET });
      assert.strictEqual(r.status, POSTGRES_LOCK_ACQUIRE_STATUSES.UNAVAILABLE);
    });
    it('check row with extra enumerable symbol yields UNAVAILABLE', async () => {
      const row = { held: true };
      row[Symbol('extra')] = 'x';
      const { session } = mockSession({ checkResult: { rows: [row] } });
      const adapter = adapterFor(session);
      const acq = await adapter.acquireAdvisoryLock({ targetMigrationId: TARGET });
      const r = await adapter.checkAdvisoryLock({ lockHandle: acq.handle });
      assert.strictEqual(r.status, POSTGRES_LOCK_CHECK_STATUSES.UNAVAILABLE);
    });
    it('release row with extra enumerable symbol yields UNKNOWN', async () => {
      const row = { released: true };
      row[Symbol('extra')] = 'x';
      const { session } = mockSession({ releaseResult: { rows: [row] } });
      const adapter = adapterFor(session);
      const acq = await adapter.acquireAdvisoryLock({ targetMigrationId: TARGET });
      const r = await adapter.releaseAdvisoryLock({ lockHandle: acq.handle });
      assert.strictEqual(r.status, POSTGRES_LOCK_RELEASE_STATUSES.UNKNOWN);
    });
    it('non-enumerable target field is malformed (UNAVAILABLE)', async () => {
      const row = {};
      Object.defineProperty(row, 'acquired', { enumerable: false, configurable: true, writable: true, value: true });
      const { session } = mockSession({ acquireResult: { rows: [row] } });
      const r = await adapterFor(session).acquireAdvisoryLock({ targetMigrationId: TARGET });
      assert.strictEqual(r.status, POSTGRES_LOCK_ACQUIRE_STATUSES.UNAVAILABLE);
    });
    it('inherited target field is malformed (UNAVAILABLE)', async () => {
      const row = Object.create({ acquired: true });
      const { session } = mockSession({ acquireResult: { rows: [row] } });
      const r = await adapterFor(session).acquireAdvisoryLock({ targetMigrationId: TARGET });
      assert.strictEqual(r.status, POSTGRES_LOCK_ACQUIRE_STATUSES.UNAVAILABLE);
    });
    it('accessor target field is malformed and the getter is not executed', async () => {
      let calls = 0;
      const row = {};
      Object.defineProperty(row, 'acquired', { enumerable: true, configurable: true, get() { calls += 1; return true; } });
      const { session } = mockSession({ acquireResult: { rows: [row] } });
      const r = await adapterFor(session).acquireAdvisoryLock({ targetMigrationId: TARGET });
      assert.strictEqual(r.status, POSTGRES_LOCK_ACQUIRE_STATUSES.UNAVAILABLE);
      assert.strictEqual(calls, 0);
    });
    it('ownKeys trap throw is fail-closed (UNAVAILABLE)', async () => {
      const row = new Proxy({ acquired: true }, { ownKeys() { throw new Error('ownKeys'); } });
      const { session } = mockSession({ acquireResult: { rows: [row] } });
      const r = await adapterFor(session).acquireAdvisoryLock({ targetMigrationId: TARGET });
      assert.strictEqual(r.status, POSTGRES_LOCK_ACQUIRE_STATUSES.UNAVAILABLE);
    });
    it('descriptor trap throw is fail-closed (UNAVAILABLE)', async () => {
      const row = new Proxy({ acquired: true }, { getOwnPropertyDescriptor() { throw new Error('desc'); } });
      const { session } = mockSession({ acquireResult: { rows: [row] } });
      const r = await adapterFor(session).acquireAdvisoryLock({ targetMigrationId: TARGET });
      assert.strictEqual(r.status, POSTGRES_LOCK_ACQUIRE_STATUSES.UNAVAILABLE);
    });
    it('sparse rows (length 1 without index 0) is malformed (UNAVAILABLE)', async () => {
      const rows = new Array(1);
      const { session } = mockSession({ acquireResult: { rows } });
      const r = await adapterFor(session).acquireAdvisoryLock({ targetMigrationId: TARGET });
      assert.strictEqual(r.status, POSTGRES_LOCK_ACQUIRE_STATUSES.UNAVAILABLE);
    });
    it('top-level normal pg metadata is accepted (ACQUIRED)', async () => {
      const { session } = mockSession({ acquireResult: { command: 'SELECT', rowCount: 1, oid: null, fields: [], rows: [{ acquired: true }] } });
      const r = await adapterFor(session).acquireAdvisoryLock({ targetMigrationId: TARGET });
      assert.strictEqual(r.status, POSTGRES_LOCK_ACQUIRE_STATUSES.ACQUIRED);
    });
    it('malformed row secret is not exposed in the result or handle', async () => {
      const secret = 'super-secret-row-value';
      const { session } = mockSession({ acquireResult: { rows: [{ acquired: true, secret }] } });
      const r = await adapterFor(session).acquireAdvisoryLock({ targetMigrationId: TARGET });
      assert.strictEqual(r.status, POSTGRES_LOCK_ACQUIRE_STATUSES.UNAVAILABLE);
      assert.ok(!JSON.stringify(r).includes(secret));
      assert.ok(!('error' in r) && !('stack' in r) && !('message' in r));
    });
  });

  describe('10. Inventory engine vocabulary (HOLD D)', () => {
    const inv = JSON.parse(fs.readFileSync(path.join(REPO_ROOT, 'docs', 'architecture', 'db-schema-change-inventory.json'), 'utf8'));
    const adapterEntry = inv.entries.find((e) => e.path === 'scripts/migration-postgres-session-lock-adapter-core.cjs');
    it('engine_enum contains postgres', () => {
      assert.ok(inv.engine_enum.includes('postgres'));
    });
    it('engine_enum does not contain postgresql', () => {
      assert.ok(!inv.engine_enum.includes('postgresql'));
    });
    it('adapter entry engine equals postgres', () => {
      assert.ok(adapterEntry);
      assert.strictEqual(adapterEntry.engine, 'postgres');
    });
  });

  describe('11. Validated cleanup callable pinning', () => {
    // Build a session whose query may mutate session.release during execution,
    // tracking calls to the original captured release vs any replacement/accessor.
    function pinningSession(queryBehavior) {
      const counts = { original: 0, replacement: 0, getter: 0 };
      const originalRelease = async () => { counts.original += 1; };
      const replacementRelease = async () => { counts.replacement += 1; };
      const session = {
        release: originalRelease,
        query: async (q) => queryBehavior(q, session, { originalRelease, replacementRelease, counts })
      };
      return { session, counts };
    }

    it('query replaces session.release + acquired=false: original captured release used, FAILED', async () => {
      const { session, counts } = pinningSession((q, s, ctx) => {
        if (q.name === ACQUIRE_NAME) {
          s.release = ctx.replacementRelease;
          return { rows: [{ acquired: false }] };
        }
        return {};
      });
      const r = await adapterFor(session).acquireAdvisoryLock({ targetMigrationId: TARGET });
      assert.strictEqual(r.status, POSTGRES_LOCK_ACQUIRE_STATUSES.FAILED);
      assert.strictEqual(counts.original, 1);
      assert.strictEqual(counts.replacement, 0);
      assert.strictEqual(r.handle, undefined);
    });

    it('query deletes session.release + acquired=false: original captured release used, FAILED', async () => {
      const { session, counts } = pinningSession((q, s) => {
        if (q.name === ACQUIRE_NAME) {
          delete s.release;
          return { rows: [{ acquired: false }] };
        }
        return {};
      });
      const r = await adapterFor(session).acquireAdvisoryLock({ targetMigrationId: TARGET });
      assert.strictEqual(r.status, POSTGRES_LOCK_ACQUIRE_STATUSES.FAILED);
      assert.strictEqual(counts.original, 1);
      assert.strictEqual(r.handle, undefined);
    });

    it('query turns session.release into a throwing accessor + acquired=false: getter not run, original used, FAILED', async () => {
      const { session, counts } = pinningSession((q, s, ctx) => {
        if (q.name === ACQUIRE_NAME) {
          Object.defineProperty(s, 'release', {
            configurable: true,
            enumerable: true,
            get() { ctx.counts.getter += 1; throw new Error('accessor'); }
          });
          return { rows: [{ acquired: false }] };
        }
        return {};
      });
      const r = await adapterFor(session).acquireAdvisoryLock({ targetMigrationId: TARGET });
      assert.strictEqual(r.status, POSTGRES_LOCK_ACQUIRE_STATUSES.FAILED);
      assert.strictEqual(counts.original, 1);
      assert.strictEqual(counts.getter, 0);
    });

    it('query replaces session.release then throws: original captured release used, UNAVAILABLE', async () => {
      const { session, counts } = pinningSession((q, s, ctx) => {
        if (q.name === ACQUIRE_NAME) {
          s.release = ctx.replacementRelease;
          throw new Error('db down');
        }
        return {};
      });
      const r = await adapterFor(session).acquireAdvisoryLock({ targetMigrationId: TARGET });
      assert.strictEqual(r.status, POSTGRES_LOCK_ACQUIRE_STATUSES.UNAVAILABLE);
      assert.strictEqual(counts.original, 1);
      assert.strictEqual(counts.replacement, 0);
    });

    it('query deletes session.release then returns malformed result: original captured release used, UNAVAILABLE', async () => {
      const { session, counts } = pinningSession((q, s) => {
        if (q.name === ACQUIRE_NAME) {
          delete s.release;
          return { rows: [{ acquired: true, secret: 'x' }] };
        }
        return {};
      });
      const r = await adapterFor(session).acquireAdvisoryLock({ targetMigrationId: TARGET });
      assert.strictEqual(r.status, POSTGRES_LOCK_ACQUIRE_STATUSES.UNAVAILABLE);
      assert.strictEqual(counts.original, 1);
    });

    it('captured original release rejects + acquired=false: original called once, UNAVAILABLE', async () => {
      let original = 0;
      const session = {
        release: async () => { original += 1; throw new Error('cleanup-reject'); },
        query: async (q) => (q.name === ACQUIRE_NAME ? { rows: [{ acquired: false }] } : {})
      };
      const r = await adapterFor(session).acquireAdvisoryLock({ targetMigrationId: TARGET });
      assert.strictEqual(r.status, POSTGRES_LOCK_ACQUIRE_STATUSES.UNAVAILABLE);
      assert.strictEqual(original, 1);
      assert.strictEqual(r.handle, undefined);
    });

    it('acquired=true then external session.release replacement: final release uses original captured, RELEASED', async () => {
      const counts = { original: 0, replacement: 0 };
      const originalRelease = async () => { counts.original += 1; };
      const replacementRelease = async () => { counts.replacement += 1; };
      const session = {
        release: originalRelease,
        query: async (q) => {
          if (q.name === ACQUIRE_NAME) return { rows: [{ acquired: true }] };
          if (q.name === RELEASE_NAME) return { rows: [{ released: true }] };
          return {};
        }
      };
      const adapter = adapterFor(session);
      const acq = await adapter.acquireAdvisoryLock({ targetMigrationId: TARGET });
      assert.strictEqual(acq.status, POSTGRES_LOCK_ACQUIRE_STATUSES.ACQUIRED);
      session.release = replacementRelease;
      const rel = await adapter.releaseAdvisoryLock({ lockHandle: acq.handle });
      assert.strictEqual(rel.status, POSTGRES_LOCK_RELEASE_STATUSES.RELEASED);
      assert.strictEqual(counts.original, 1);
      assert.strictEqual(counts.replacement, 0);
    });

    it('captured cleanup runs exactly once across all mutation paths', async () => {
      const scenarios = [
        (q, s, ctx) => { if (q.name === ACQUIRE_NAME) { s.release = ctx.replacementRelease; return { rows: [{ acquired: false }] }; } return {}; },
        (q, s) => { if (q.name === ACQUIRE_NAME) { delete s.release; return { rows: [{ acquired: false }] }; } return {}; },
        (q, s, ctx) => { if (q.name === ACQUIRE_NAME) { Object.defineProperty(s, 'release', { configurable: true, enumerable: true, get() { ctx.counts.getter += 1; throw new Error('accessor'); } }); return { rows: [{ acquired: false }] }; } return {}; },
        (q, s, ctx) => { if (q.name === ACQUIRE_NAME) { s.release = ctx.replacementRelease; throw new Error('db down'); } return {}; },
        (q, s) => { if (q.name === ACQUIRE_NAME) { delete s.release; return { rows: [{ acquired: true, secret: 'x' }] }; } return {}; }
      ];
      for (const behavior of scenarios) {
        const { session, counts } = pinningSession(behavior);
        await adapterFor(session).acquireAdvisoryLock({ targetMigrationId: TARGET });
        assert.strictEqual(counts.original, 1, 'captured original release called exactly once');
      }
    });
  });

  describe('5. queryLockedSession broker', () => {
    const READ_QUERY = Object.freeze({ name: 'test-read', text: 'SELECT 1', values: [] });
    const APPEND_QUERY = Object.freeze({ name: 'test-append', text: 'INSERT INTO t VALUES ($1)', values: ['mid'] });

    function acquiredAdapter(mockOver) {
      const { session, state } = mockSession(mockOver);
      const adapter = adapterFor(session);
      return { adapter, session, state };
    }

    async function acquireHandle(adapter) {
      const r = await adapter.acquireAdvisoryLock({ targetMigrationId: TARGET });
      if (r.status !== 'ACQUIRED') throw new Error('acquire failed');
      return r.handle;
    }

    it('1. OPEN handle executes captured query callable exactly once', async () => {
      const { adapter, state } = acquiredAdapter();
      const handle = await acquireHandle(adapter);
      const result = await adapter.queryLockedSession({ lockHandle: handle, query: READ_QUERY });
      assert.strictEqual(state.queries.length, 2); // acquire + broker
      assert.strictEqual(state.queries[1].name, 'test-read');
      assert.ok(result !== undefined);
    });

    it('2. captured session is this context for the query callable', async () => {
      let thisContext = null;
      const { session } = mockSession({
        queryImpl: async function (q) { thisContext = this; return { rows: [{ acquired: true }] }; }
      });
      const adapter = adapterFor(session);
      const handle = await acquireHandle(adapter);
      await adapter.queryLockedSession({ lockHandle: handle, query: READ_QUERY });
      assert.strictEqual(thisContext, session);
    });

    it('3. read query frozen empty values forwarded', async () => {
      const captured = [];
      const { session } = mockSession({
        queryImpl: async (q) => {
          captured.push(q);
          if (q.name === ACQUIRE_NAME) return { rows: [{ acquired: true }] };
          return {};
        }
      });
      const adapter = adapterFor(session);
      const handle = await acquireHandle(adapter);
      await adapter.queryLockedSession({ lockHandle: handle, query: READ_QUERY });
      const q = captured[1];
      assert.deepStrictEqual([...q.values], []);
      assert.ok(Object.isFrozen(q));
    });

    it('4. append query 7 values order forwarded', async () => {
      const captured = [];
      const { session } = mockSession({
        queryImpl: async (q) => {
          captured.push(q);
          if (q.name === ACQUIRE_NAME) return { rows: [{ acquired: true }] };
          return {};
        }
      });
      const adapter = adapterFor(session);
      const handle = await acquireHandle(adapter);
      const sevenValues = ['mid', 'csum', '2026-01-02T03:04:05.678Z', '1.0.0', 'disp', 'dc', 'COMMITTED'];
      await adapter.queryLockedSession({ lockHandle: handle, query: { name: 'test-append', text: 'INSERT ...', values: sevenValues } });
      const q = captured[1];
      assert.deepStrictEqual([...q.values], sevenValues);
    });

    it('5. raw result identity returned to caller', async () => {
      const rawResult = { rows: [{ migration_id: 'mid', content_checksum: 'csum' }] };
      const { session } = mockSession({
        queryImpl: async (q) => {
          if (q.name === ACQUIRE_NAME) return { rows: [{ acquired: true }] };
          return rawResult;
        }
      });
      const adapter = adapterFor(session);
      const handle = await acquireHandle(adapter);
      const result = await adapter.queryLockedSession({ lockHandle: handle, query: READ_QUERY });
      assert.strictEqual(result, rawResult);
    });

    it('6. repeated broker calls work from OPEN handle', async () => {
      const { adapter, state } = acquiredAdapter();
      const handle = await acquireHandle(adapter);
      await adapter.queryLockedSession({ lockHandle: handle, query: READ_QUERY });
      await adapter.queryLockedSession({ lockHandle: handle, query: READ_QUERY });
      await adapter.queryLockedSession({ lockHandle: handle, query: READ_QUERY });
      assert.strictEqual(state.queries.length, 4); // acquire + 3 broker
    });

    it('7. replacing session.query after acquire does not affect broker', async () => {
      let originalCalls = 0;
      const { session } = mockSession({
        queryImpl: async (q) => {
          if (q.name && q.name.startsWith('lovebud-migration-lock-')) return { rows: [{ acquired: true }] };
          originalCalls += 1;
          return {};
        }
      });
      const adapter = adapterFor(session);
      const handle = await acquireHandle(adapter);
      session.query = async () => { throw new Error('replaced'); };
      await adapter.queryLockedSession({ lockHandle: handle, query: READ_QUERY });
      assert.strictEqual(originalCalls, 1);
    });

    it('8. session.query accessor getter execution 0', async () => {
      let getterRan = false;
      const { session } = mockSession({
        queryImpl: async (q) => {
          if (q.name === ACQUIRE_NAME) return { rows: [{ acquired: true }] };
          return {};
        }
      });
      const adapter = adapterFor(session);
      const handle = await acquireHandle(adapter);
      // Replace session.query with accessor AFTER acquire (captured callable already stored)
      Object.defineProperty(session, 'query', {
        enumerable: true,
        get() { getterRan = true; return async () => { throw new Error('accessor'); }; }
      });
      await adapter.queryLockedSession({ lockHandle: handle, query: READ_QUERY });
      assert.strictEqual(getterRan, false);
    });

    it('9. caller mutation of query/values after snapshot does not affect execution', async () => {
      const captured = [];
      const { session } = mockSession({
        queryImpl: async (q) => {
          captured.push(q);
          if (q.name === ACQUIRE_NAME) return { rows: [{ acquired: true }] };
          return {};
        }
      });
      const adapter = adapterFor(session);
      const handle = await acquireHandle(adapter);
      const query = { name: 'test', text: 'SELECT 1', values: ['original'] };
      const p = adapter.queryLockedSession({ lockHandle: handle, query });
      query.name = 'TAMPERED';
      query.text = 'TAMPERED SQL';
      query.values[0] = 'TAMPERED';
      await p;
      assert.strictEqual(captured[1].name, 'test');
      assert.strictEqual(captured[1].text, 'SELECT 1');
      assert.strictEqual(captured[1].values[0], 'original');
    });

    it('10. missing lockHandle -> fixed error', async () => {
      const { adapter } = acquiredAdapter();
      let err = null;
      try { await adapter.queryLockedSession({ query: READ_QUERY }); } catch (e) { err = e; }
      assert.ok(err);
      assert.strictEqual(err.message, BROKER_ERROR_QUERY_UNAVAILABLE);
    });

    it('11. null/undefined lockHandle -> fixed error', async () => {
      const { adapter } = acquiredAdapter();
      for (const lockHandle of [null, undefined]) {
        let err = null;
        try { await adapter.queryLockedSession({ lockHandle, query: READ_QUERY }); } catch (e) { err = e; }
        assert.ok(err);
        assert.strictEqual(err.message, BROKER_ERROR_QUERY_UNAVAILABLE);
      }
    });

    it('12. arbitrary object as lockHandle -> fixed error', async () => {
      const { adapter } = acquiredAdapter();
      let err = null;
      try { await adapter.queryLockedSession({ lockHandle: {}, query: READ_QUERY }); } catch (e) { err = e; }
      assert.ok(err);
      assert.strictEqual(err.message, BROKER_ERROR_QUERY_UNAVAILABLE);
    });

    it('13. cross-adapter handle -> fixed error, query 0', async () => {
      const { adapter: adapterA } = acquiredAdapter();
      const { adapter: adapterB } = acquiredAdapter();
      const handle = await acquireHandle(adapterA);
      let err = null;
      try { await adapterB.queryLockedSession({ lockHandle: handle, query: READ_QUERY }); } catch (e) { err = e; }
      assert.ok(err);
      assert.strictEqual(err.message, BROKER_ERROR_QUERY_UNAVAILABLE);
    });

    it('14. release started then broker -> fixed error, query 0', async () => {
      const { adapter, state } = acquiredAdapter();
      const handle = await acquireHandle(adapter);
      // Start release but keep the Promise pending so lifecycle stays RELEASING
      let releaseResolve;
      const { session } = mockSession({
        queryImpl: async (q) => {
          if (q.name === RELEASE_NAME) {
            await new Promise(r => { releaseResolve = r; });
            return { rows: [{ released: true }] };
          }
          if (q.name === ACQUIRE_NAME) return { rows: [{ acquired: true }] };
          return {};
        }
      });
      const adapter2 = adapterFor(session);
      const handle2 = await acquireHandle(adapter2);
      const releasePromise = adapter2.releaseAdvisoryLock({ lockHandle: handle2 });
      // Now try broker while release is pending (lifecycle = RELEASING)
      let err = null;
      try { await adapter2.queryLockedSession({ lockHandle: handle2, query: READ_QUERY }); } catch (e) { err = e; }
      assert.ok(err);
      assert.strictEqual(err.message, BROKER_ERROR_QUERY_UNAVAILABLE);
      // Complete release
      releaseResolve(true);
      await releasePromise;
    });

    it('15. release completed then broker -> fixed error, query 0', async () => {
      const { adapter, state } = acquiredAdapter();
      const handle = await acquireHandle(adapter);
      await adapter.releaseAdvisoryLock({ lockHandle: handle });
      let err = null;
      try { await adapter.queryLockedSession({ lockHandle: handle, query: READ_QUERY }); } catch (e) { err = e; }
      assert.ok(err);
      assert.strictEqual(err.message, BROKER_ERROR_QUERY_UNAVAILABLE);
    });

    it('16. query sync throw -> fixed error, implicit unlock 0, implicit release 0', async () => {
      const { session } = mockSession({
        queryImpl: (q) => {
          if (q.name === ACQUIRE_NAME) return { rows: [{ acquired: true }] };
          if (q.name === RELEASE_NAME) return { rows: [{ released: true }] };
          throw new Error('raw sync');
        }
      });
      const adapter = adapterFor(session);
      const handle = await acquireHandle(adapter);
      let err = null;
      try { await adapter.queryLockedSession({ lockHandle: handle, query: READ_QUERY }); } catch (e) { err = e; }
      assert.ok(err);
      assert.strictEqual(err.message, BROKER_ERROR_QUERY_UNAVAILABLE);
      // Verify explicit release still works
      const rel = await adapter.releaseAdvisoryLock({ lockHandle: handle });
      assert.strictEqual(rel.status, POSTGRES_LOCK_RELEASE_STATUSES.RELEASED);
    });

    it('17. query Promise reject -> fixed error, implicit unlock 0, implicit release 0', async () => {
      const { session } = mockSession({
        queryImpl: async (q) => {
          if (q.name === ACQUIRE_NAME) return { rows: [{ acquired: true }] };
          if (q.name === RELEASE_NAME) return { rows: [{ released: true }] };
          throw new Error('reject raw');
        }
      });
      const adapter = adapterFor(session);
      const handle = await acquireHandle(adapter);
      let err = null;
      try { await adapter.queryLockedSession({ lockHandle: handle, query: READ_QUERY }); } catch (e) { err = e; }
      assert.ok(err);
      assert.strictEqual(err.message, BROKER_ERROR_QUERY_UNAVAILABLE);
      // Verify explicit release still works
      const rel = await adapter.releaseAdvisoryLock({ lockHandle: handle });
      assert.strictEqual(rel.status, POSTGRES_LOCK_RELEASE_STATUSES.RELEASED);
    });

    it('18. fixed error only, no raw error/stack leak', async () => {
      const { adapter } = acquiredAdapter();
      const handle = await acquireHandle(adapter);
      let err = null;
      try { await adapter.queryLockedSession({ lockHandle: {}, query: READ_QUERY }); } catch (e) { err = e; }
      assert.ok(err);
      assert.strictEqual(err.message, BROKER_ERROR_QUERY_UNAVAILABLE);
      const blob = err.message + (err.stack || '');
      assert.ok(!blob.includes('raw'));
    });

    it('19. accessor lockHandle -> fixed error, query 0', async () => {
      let ran = false;
      const { adapter, state } = acquiredAdapter();
      const handle = await acquireHandle(adapter);
      // Build arg without spread to avoid triggering the accessor getter
      const arg = {};
      Object.defineProperty(arg, 'lockHandle', { enumerable: true, get() { ran = true; return handle; } });
      // query must be set via defineProperty too (not spread) to keep lockHandle accessor
      Object.defineProperty(arg, 'query', { enumerable: true, value: READ_QUERY });
      let err = null;
      try { await adapter.queryLockedSession(arg); } catch (e) { err = e; }
      assert.ok(err);
      assert.strictEqual(err.message, BROKER_ERROR_QUERY_UNAVAILABLE);
      assert.strictEqual(ran, false);
    });

    it('20. accessor query field -> fixed error', async () => {
      const { adapter } = acquiredAdapter();
      const handle = await acquireHandle(adapter);
      const query = { name: 'test', text: 'SELECT 1' };
      Object.defineProperty(query, 'values', { enumerable: true, get() { return []; } });
      let err = null;
      try { await adapter.queryLockedSession({ lockHandle: handle, query }); } catch (e) { err = e; }
      assert.ok(err);
      assert.strictEqual(err.message, BROKER_ERROR_QUERY_UNAVAILABLE);
    });

    it('21. missing query field (name) -> fixed error', async () => {
      const { adapter } = acquiredAdapter();
      const handle = await acquireHandle(adapter);
      let err = null;
      try { await adapter.queryLockedSession({ lockHandle: handle, query: { name: '', text: 'SELECT 1', values: [] } }); } catch (e) { err = e; }
      assert.ok(err);
      assert.strictEqual(err.message, BROKER_ERROR_QUERY_UNAVAILABLE);
    });

    it('22. extra query field -> fixed error', async () => {
      const { adapter } = acquiredAdapter();
      const handle = await acquireHandle(adapter);
      let err = null;
      try { await adapter.queryLockedSession({ lockHandle: handle, query: { name: 'test', text: 'SELECT 1', values: [], extra: 'bad' } }); } catch (e) { err = e; }
      assert.ok(err);
      assert.strictEqual(err.message, BROKER_ERROR_QUERY_UNAVAILABLE);
    });

    it('23. symbol query key -> fixed error', async () => {
      const { adapter } = acquiredAdapter();
      const handle = await acquireHandle(adapter);
      const query = { name: 'test', text: 'SELECT 1', values: [] };
      query[Symbol('s')] = 'bad';
      let err = null;
      try { await adapter.queryLockedSession({ lockHandle: handle, query }); } catch (e) { err = e; }
      assert.ok(err);
      assert.strictEqual(err.message, BROKER_ERROR_QUERY_UNAVAILABLE);
    });

    it('24. non-enumerable query field -> fixed error', async () => {
      const { adapter } = acquiredAdapter();
      const handle = await acquireHandle(adapter);
      const query = { name: 'test', text: 'SELECT 1' };
      Object.defineProperty(query, 'values', { enumerable: false, value: [] });
      let err = null;
      try { await adapter.queryLockedSession({ lockHandle: handle, query }); } catch (e) { err = e; }
      assert.ok(err);
      assert.strictEqual(err.message, BROKER_ERROR_QUERY_UNAVAILABLE);
    });

    it('25. sparse values array -> fixed error', async () => {
      const { adapter } = acquiredAdapter();
      const handle = await acquireHandle(adapter);
      const sparse = new Array(2);
      sparse[0] = 'first';
      let err = null;
      try { await adapter.queryLockedSession({ lockHandle: handle, query: { name: 'test', text: 'SELECT 1', values: sparse } }); } catch (e) { err = e; }
      assert.ok(err);
      assert.strictEqual(err.message, BROKER_ERROR_QUERY_UNAVAILABLE);
    });

    it('26. extra values property -> fixed error', async () => {
      const { adapter } = acquiredAdapter();
      const handle = await acquireHandle(adapter);
      const arr = ['val'];
      arr.extra = 'bad';
      let err = null;
      try { await adapter.queryLockedSession({ lockHandle: handle, query: { name: 'test', text: 'SELECT 1', values: arr } }); } catch (e) { err = e; }
      assert.ok(err);
      assert.strictEqual(err.message, BROKER_ERROR_QUERY_UNAVAILABLE);
    });

    it('27. values with non-canonical key -> fixed error', async () => {
      const { adapter } = acquiredAdapter();
      const handle = await acquireHandle(adapter);
      const arr = [];
      Object.defineProperty(arr, '00', { enumerable: true, value: 'bad' });
      Object.defineProperty(arr, 'length', { value: 1 });
      let err = null;
      try { await adapter.queryLockedSession({ lockHandle: handle, query: { name: 'test', text: 'SELECT 1', values: arr } }); } catch (e) { err = e; }
      assert.ok(err);
      assert.strictEqual(err.message, BROKER_ERROR_QUERY_UNAVAILABLE);
    });

    it('28. values Proxy ownKeys throw -> fixed error', async () => {
      const { adapter } = acquiredAdapter();
      const handle = await acquireHandle(adapter);
      const badValues = new Proxy([], { ownKeys() { throw new Error('secret'); } });
      let err = null;
      try { await adapter.queryLockedSession({ lockHandle: handle, query: { name: 'test', text: 'SELECT 1', values: badValues } }); } catch (e) { err = e; }
      assert.ok(err);
      assert.strictEqual(err.message, BROKER_ERROR_QUERY_UNAVAILABLE);
    });

    it('29. query Proxy getOwnPropertyDescriptor throw -> fixed error', async () => {
      const { adapter } = acquiredAdapter();
      const handle = await acquireHandle(adapter);
      const badQuery = new Proxy({ name: 'test', text: 'SELECT 1', values: [] }, {
        getOwnPropertyDescriptor() { throw new Error('desc secret'); }
      });
      let err = null;
      try { await adapter.queryLockedSession({ lockHandle: handle, query: badQuery }); } catch (e) { err = e; }
      assert.ok(err);
      assert.strictEqual(err.message, BROKER_ERROR_QUERY_UNAVAILABLE);
    });

    it('30. revoked Proxy query -> fixed error', async () => {
      const { adapter } = acquiredAdapter();
      const handle = await acquireHandle(adapter);
      const { proxy, revoke } = Proxy.revocable({ name: 'test', text: 'SELECT 1', values: [] }, {});
      revoke();
      let err = null;
      try { await adapter.queryLockedSession({ lockHandle: handle, query: proxy }); } catch (e) { err = e; }
      assert.ok(err);
      assert.strictEqual(err.message, BROKER_ERROR_QUERY_UNAVAILABLE);
    });

    it('31. query Proxy get trap execution 0', async () => {
      let getCalls = 0;
      const { adapter } = acquiredAdapter();
      const handle = await acquireHandle(adapter);
      const proxied = new Proxy({ name: 'test', text: 'SELECT 1', values: [] }, {
        get(target, prop) {
          getCalls += 1;
          return Reflect.get(target, prop);
        }
      });
      await adapter.queryLockedSession({ lockHandle: handle, query: proxied });
      assert.strictEqual(getCalls, 0);
    });

    it('32. query values index accessor -> fixed error (getter 0)', async () => {
      let ran = false;
      const { adapter } = acquiredAdapter();
      const handle = await acquireHandle(adapter);
      const arr = [];
      Object.defineProperty(arr, '0', { enumerable: true, get() { ran = true; return 'val'; } });
      Object.defineProperty(arr, 'length', { value: 1 });
      let err = null;
      try { await adapter.queryLockedSession({ lockHandle: handle, query: { name: 'test', text: 'SELECT 1', values: arr } }); } catch (e) { err = e; }
      assert.ok(err);
      assert.strictEqual(err.message, BROKER_ERROR_QUERY_UNAVAILABLE);
      assert.strictEqual(ran, false);
    });

    it('33. query field accessor -> fixed error', async () => {
      let ran = false;
      const { adapter } = acquiredAdapter();
      const handle = await acquireHandle(adapter);
      const query = { text: 'SELECT 1', values: [] };
      Object.defineProperty(query, 'name', { enumerable: true, get() { ran = true; return 'test'; } });
      let err = null;
      try { await adapter.queryLockedSession({ lockHandle: handle, query }); } catch (e) { err = e; }
      assert.ok(err);
      assert.strictEqual(err.message, BROKER_ERROR_QUERY_UNAVAILABLE);
      assert.strictEqual(ran, false);
    });

    it('34. non-plain-record query -> fixed error', async () => {
      const { adapter } = acquiredAdapter();
      const handle = await acquireHandle(adapter);
      for (const query of [null, 'x', 5, true, []]) {
        let err = null;
        try { await adapter.queryLockedSession({ lockHandle: handle, query }); } catch (e) { err = e; }
        assert.ok(err);
        assert.strictEqual(err.message, BROKER_ERROR_QUERY_UNAVAILABLE);
      }
    });

    it('35. custom prototype query -> fixed error', async () => {
      const { adapter } = acquiredAdapter();
      const handle = await acquireHandle(adapter);
      class Custom {}
      const q = new Custom();
      Object.assign(q, { name: 'test', text: 'SELECT 1', values: [] });
      let err = null;
      try { await adapter.queryLockedSession({ lockHandle: handle, query: q }); } catch (e) { err = e; }
      assert.ok(err);
      assert.strictEqual(err.message, BROKER_ERROR_QUERY_UNAVAILABLE);
    });

    it('36. query getPrototypeOf trap throw -> fixed error', async () => {
      const { adapter } = acquiredAdapter();
      const handle = await acquireHandle(adapter);
      const trapQuery = new Proxy({ name: 'test', text: 'SELECT 1', values: [] }, {
        getPrototypeOf() { throw new Error('proto'); }
      });
      let err = null;
      try { await adapter.queryLockedSession({ lockHandle: handle, query: trapQuery }); } catch (e) { err = e; }
      assert.ok(err);
      assert.strictEqual(err.message, BROKER_ERROR_QUERY_UNAVAILABLE);
    });

    it('37. fixed error message and stack never contain raw error detail', async () => {
      const { adapter } = acquiredAdapter();
      const handle = await acquireHandle(adapter);
      const badQuery = new Proxy({ name: 'test', text: 'SELECT 1', values: [] }, {
        getOwnPropertyDescriptor() { throw new Error('POSTGRES_SECRET_INTERNAL_HOST db.internal:5432'); }
      });
      let err = null;
      try { await adapter.queryLockedSession({ lockHandle: handle, query: badQuery }); } catch (e) { err = e; }
      assert.ok(err);
      assert.strictEqual(err.message, BROKER_ERROR_QUERY_UNAVAILABLE);
      assert.ok(!err.message.includes('POSTGRES_SECRET_INTERNAL_HOST'));
      assert.ok(!err.message.includes('db.internal'));
    });
  });
});
