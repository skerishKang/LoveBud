'use strict';

/**
 * PostgreSQL pinned-session advisory-lock adapter CONTRACT (#3458, sixth slice).
 *
 * This is a source-tested contract for a PostgreSQL session-level advisory lock
 * adapter compatible with the #3636 orchestrator dependency contract. It is NOT
 * a real database client: it performs NO database connection, NO `pg` import, NO
 * actual query execution, and NO real lock acquisition. Every session and query
 * is a synthetic injected mock.
 *
 * A PostgreSQL session-level advisory lock is held by a single session until an
 * explicit unlock or session end. A two-integer-key advisory lock appears in
 * pg_locks as classid/objid with objsubid=2, so acquire/check/release must use
 * the SAME pinned session. This adapter pins one session from acquire through
 * release and returns it to the pool exactly once.
 *
 * All method results are sanitized: only a fixed status (and an opaque handle on
 * acquire success) is returned. No raw error, message, stack, session, query
 * function, release function, hostname, database name, connection URL,
 * credential, targetMigrationId, query result, backend PID, catalog row, or lock
 * key text ever appears in a result or in the handle serialization.
 */

// One global lock serializes all canonical migrations per database. Two positive
// signed-int32 keys. No per-target hash, no runtime hash, no random key, no
// environment-based key, no caller override, no string interpolation, no bigint.
const POSTGRES_MIGRATION_LOCK_KEYS = Object.freeze({
  classKey: 1279415620, // 0x4c425544 = "LBUD"
  objectKey: 1296648018 // 0x4d494752 = "MIGR"
});

const LOCK_VALUES = Object.freeze([
  POSTGRES_MIGRATION_LOCK_KEYS.classKey,
  POSTGRES_MIGRATION_LOCK_KEYS.objectKey
]);

// Exact named queries. Whitespace may vary but SQL meaning and parameter order
// are fixed. Keys are bound as $1/$2 parameters, never interpolated.
const POSTGRES_MIGRATION_LOCK_QUERIES = Object.freeze({
  acquire: Object.freeze({
    name: 'lovebud-migration-lock-acquire-v1',
    text: 'SELECT pg_try_advisory_lock($1::integer, $2::integer) AS acquired',
    values: LOCK_VALUES
  }),
  check: Object.freeze({
    name: 'lovebud-migration-lock-check-v1',
    text: [
      'SELECT EXISTS (',
      '  SELECT 1',
      '  FROM pg_locks',
      "  WHERE locktype = 'advisory'",
      '    AND pid = pg_backend_pid()',
      '    AND database = (',
      '      SELECT oid',
      '      FROM pg_database',
      '      WHERE datname = current_database()',
      '    )',
      '    AND classid = ($1::integer)::oid',
      '    AND objid = ($2::integer)::oid',
      '    AND objsubid = 2',
      "    AND mode = 'ExclusiveLock'",
      '    AND granted = TRUE',
      ') AS held'
    ].join('\n'),
    values: LOCK_VALUES
  }),
  release: Object.freeze({
    name: 'lovebud-migration-lock-release-v1',
    text: 'SELECT pg_advisory_unlock($1::integer, $2::integer) AS released',
    values: LOCK_VALUES
  })
});

// Status vocabularies match the #3636 orchestrator dependency contract exactly.
const POSTGRES_LOCK_ACQUIRE_STATUSES = Object.freeze({
  ACQUIRED: 'ACQUIRED',
  NOT_ATTEMPTED: 'NOT_ATTEMPTED',
  UNAVAILABLE: 'UNAVAILABLE',
  FAILED: 'FAILED'
});

const POSTGRES_LOCK_CHECK_STATUSES = Object.freeze({
  ACQUIRED: 'ACQUIRED',
  LOST: 'LOST',
  FAILED: 'FAILED',
  UNAVAILABLE: 'UNAVAILABLE'
});

const POSTGRES_LOCK_RELEASE_STATUSES = Object.freeze({
  RELEASED: 'RELEASED',
  FAILED: 'FAILED',
  UNKNOWN: 'UNKNOWN'
});

const FACTORY_ERROR_OPEN_SESSION_REQUIRED = 'POSTGRES_LOCK_ADAPTER_OPEN_SESSION_REQUIRED';

function isPlainRecord(value) {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) return false;
  const proto = Object.getPrototypeOf(value);
  return proto === Object.prototype || proto === null;
}

function isNonEmptyString(value) {
  return typeof value === 'string' && value.trim().length > 0;
}

// Best-effort await that discards any error detail.
async function bestEffort(fn) {
  try {
    await fn();
  } catch (error) {
    // discarded
  }
}

function isValidSingleBooleanRow(result, field) {
  return isPlainRecord(result)
    && Array.isArray(result.rows)
    && result.rows.length === 1
    && isPlainRecord(result.rows[0])
    && typeof result.rows[0][field] === 'boolean';
}

/**
 * Create a frozen adapter { acquireAdvisoryLock, checkAdvisoryLock,
 * releaseAdvisoryLock } backed by an injected openSession dependency.
 *
 * openSession() (sync or async) must resolve to a plain record { query, release }
 * with both callable. The session is pinned from acquire through release and
 * returned to the pool exactly once.
 */
function createPostgresMigrationSessionLockAdapter(config) {
  const cfg = config || {};
  if (typeof cfg.openSession !== 'function') {
    throw new Error(FACTORY_ERROR_OPEN_SESSION_REQUIRED);
  }
  const openSession = cfg.openSession;

  // Closure-private, per-adapter handle state. Handles from another adapter
  // instance are not present here and are therefore rejected.
  const handleState = new WeakMap();

  function createHandle(session) {
    const handle = Object.freeze({});
    handleState.set(handle, { session, lifecycle: 'OPEN' });
    return handle;
  }

  async function acquireAdvisoryLock(arg) {
    const a = arg || {};
    // targetMigrationId must be a non-empty string but is NOT used for the lock key.
    if (!isNonEmptyString(a.targetMigrationId)) {
      return { status: POSTGRES_LOCK_ACQUIRE_STATUSES.NOT_ATTEMPTED };
    }

    let session;
    try {
      session = await openSession();
    } catch (error) {
      return { status: POSTGRES_LOCK_ACQUIRE_STATUSES.UNAVAILABLE };
    }

    const hasCallableRelease = session !== null
      && typeof session === 'object'
      && typeof session.release === 'function';
    const validSession = isPlainRecord(session)
      && typeof session.query === 'function'
      && typeof session.release === 'function';
    if (!validSession) {
      if (hasCallableRelease) {
        await bestEffort(() => session.release());
      }
      return { status: POSTGRES_LOCK_ACQUIRE_STATUSES.UNAVAILABLE };
    }

    let result;
    try {
      result = await session.query(POSTGRES_MIGRATION_LOCK_QUERIES.acquire);
    } catch (error) {
      await bestEffort(() => session.release());
      return { status: POSTGRES_LOCK_ACQUIRE_STATUSES.UNAVAILABLE };
    }

    if (!isValidSingleBooleanRow(result, 'acquired')) {
      await bestEffort(() => session.release());
      return { status: POSTGRES_LOCK_ACQUIRE_STATUSES.UNAVAILABLE };
    }

    if (result.rows[0].acquired === true) {
      const handle = createHandle(session);
      return { status: POSTGRES_LOCK_ACQUIRE_STATUSES.ACQUIRED, handle };
    }

    await bestEffort(() => session.release());
    return { status: POSTGRES_LOCK_ACQUIRE_STATUSES.FAILED };
  }

  async function checkAdvisoryLock(arg) {
    const a = arg || {};
    const state = handleState.get(a.lockHandle);
    // Invalid / cross-adapter handle: no query.
    if (!state) {
      return { status: POSTGRES_LOCK_CHECK_STATUSES.FAILED };
    }
    // Released / releasing handle: lock no longer held, no query.
    if (state.lifecycle !== 'OPEN') {
      return { status: POSTGRES_LOCK_CHECK_STATUSES.LOST };
    }

    let result;
    try {
      result = await state.session.query(POSTGRES_MIGRATION_LOCK_QUERIES.check);
    } catch (error) {
      return { status: POSTGRES_LOCK_CHECK_STATUSES.UNAVAILABLE };
    }

    if (!isValidSingleBooleanRow(result, 'held')) {
      return { status: POSTGRES_LOCK_CHECK_STATUSES.UNAVAILABLE };
    }

    return {
      status: result.rows[0].held === true
        ? POSTGRES_LOCK_CHECK_STATUSES.ACQUIRED
        : POSTGRES_LOCK_CHECK_STATUSES.LOST
    };
  }

  async function releaseAdvisoryLock(arg) {
    const a = arg || {};
    const state = handleState.get(a.lockHandle);
    // Invalid / cross-adapter handle: no query, no pool release.
    if (!state) {
      return { status: POSTGRES_LOCK_RELEASE_STATUSES.UNKNOWN };
    }
    // Already releasing / released: no additional query or pool release.
    if (state.lifecycle !== 'OPEN') {
      return { status: POSTGRES_LOCK_RELEASE_STATUSES.UNKNOWN };
    }
    // Atomic transition to RELEASING so concurrent/repeated releases cannot
    // duplicate the release query or pool release (single-thread ordering).
    state.lifecycle = 'RELEASING';

    let queryOk = true;
    let released = false;
    try {
      const result = await state.session.query(POSTGRES_MIGRATION_LOCK_QUERIES.release);
      if (!isValidSingleBooleanRow(result, 'released')) {
        queryOk = false;
      } else {
        released = result.rows[0].released === true;
      }
    } catch (error) {
      queryOk = false;
    }

    // Pool release best-effort exactly once, regardless of unlock result.
    let poolReleaseOk = true;
    try {
      await state.session.release();
    } catch (error) {
      poolReleaseOk = false;
    }

    state.lifecycle = 'RELEASED';

    if (!queryOk) {
      return { status: POSTGRES_LOCK_RELEASE_STATUSES.UNKNOWN };
    }
    if (!poolReleaseOk) {
      return { status: POSTGRES_LOCK_RELEASE_STATUSES.UNKNOWN };
    }
    if (released) {
      return { status: POSTGRES_LOCK_RELEASE_STATUSES.RELEASED };
    }
    return { status: POSTGRES_LOCK_RELEASE_STATUSES.FAILED };
  }

  return Object.freeze({
    acquireAdvisoryLock,
    checkAdvisoryLock,
    releaseAdvisoryLock
  });
}

module.exports = {
  POSTGRES_MIGRATION_LOCK_KEYS,
  POSTGRES_MIGRATION_LOCK_QUERIES,
  POSTGRES_LOCK_ACQUIRE_STATUSES,
  POSTGRES_LOCK_CHECK_STATUSES,
  POSTGRES_LOCK_RELEASE_STATUSES,
  createPostgresMigrationSessionLockAdapter
};
