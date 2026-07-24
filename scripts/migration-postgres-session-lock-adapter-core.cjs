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

// Sentinel returned by safe inspection when an own data property is absent,
// inaccessible, or not a plain data value. It is never returned to callers.
const MISS = Symbol('postgres-lock-adapter-miss');

// Read an OWN DATA property without ever executing an accessor getter and
// without ever throwing. Any Proxy trap throw, revoked-Proxy throw, descriptor
// inspection throw, accessor property, inherited property, or missing property
// yields MISS. The returned descriptor object is engine-created, so reading
// desc.value cannot run caller code.
function safeGetOwnDataProperty(obj, key) {
  if (obj === null || obj === undefined) return MISS;
  let desc;
  try {
    desc = Object.getOwnPropertyDescriptor(obj, key);
  } catch (error) {
    return MISS;
  }
  if (desc === undefined) return MISS;
  if (!('value' in desc)) return MISS;
  return desc.value;
}

// Read an own data property that must be callable. Never throws, never runs an
// accessor getter. Returns the function or undefined.
function safeGetCallable(obj, key) {
  const value = safeGetOwnDataProperty(obj, key);
  if (value !== MISS && typeof value === 'function') return value;
  return undefined;
}

function safeIsArray(value) {
  try {
    return Array.isArray(value);
  } catch (error) {
    return false;
  }
}

// Plain-record check that survives Object.getPrototypeOf throws, revoked
// Proxies, and Proxy getPrototypeOf traps. Never throws.
function safeIsPlainRecord(value) {
  if (value === null || value === undefined) return false;
  try {
    if (typeof value !== 'object') return false;
    if (Array.isArray(value)) return false;
    const proto = Object.getPrototypeOf(value);
    return proto === Object.prototype || proto === null;
  } catch (error) {
    return false;
  }
}

function isNonEmptyString(value) {
  return typeof value === 'string' && value.trim().length > 0;
}

// Classify a query result as exactly { rows: [ { <field>: boolean } ] } using
// only safe own-data reads. Accessor getters for `rows` and the boolean field
// are NOT executed. Any throw, Proxy trap, revoked Proxy, malformed shape,
// non-plain record, wrong row count, or non-boolean field yields { ok: false }.
function readSingleBooleanField(result, field) {
  try {
    if (!safeIsPlainRecord(result)) return { ok: false };
    const rows = safeGetOwnDataProperty(result, 'rows');
    if (rows === MISS || !safeIsArray(rows)) return { ok: false };
    const length = safeGetOwnDataProperty(rows, 'length');
    if (length !== 1) return { ok: false };
    const row = safeGetOwnDataProperty(rows, '0');
    if (row === MISS || !safeIsPlainRecord(row)) return { ok: false };
    const value = safeGetOwnDataProperty(row, field);
    if (value === true || value === false) return { ok: true, value };
    return { ok: false };
  } catch (error) {
    return { ok: false };
  }
}

// Best-effort pool release of a session, exactly once, discarding all error
// detail. No-ops when the session has no callable own-data `release`.
async function releaseSessionOnce(session) {
  const release = safeGetCallable(session, 'release');
  if (release === undefined) return false;
  try {
    await release.call(session);
    return true;
  } catch (error) {
    return false;
  }
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
  // Reading config.openSession must never surface a raw getter/Proxy error: any
  // throw, accessor, revoked Proxy, missing, or non-function value maps to the
  // single fixed factory error message.
  const openSession = safeGetOwnDataProperty(config, 'openSession');
  if (openSession === MISS || typeof openSession !== 'function') {
    throw new Error(FACTORY_ERROR_OPEN_SESSION_REQUIRED);
  }

  // Closure-private, per-adapter handle state. Handles from another adapter
  // instance are not present here and are therefore rejected.
  const handleState = new WeakMap();

  function createHandle(session, query, release) {
    const handle = Object.freeze({});
    handleState.set(handle, { session, query, release, lifecycle: 'OPEN' });
    return handle;
  }

  async function acquireAdvisoryLock(arg) {
    // targetMigrationId must be a non-empty string own data property but is NOT
    // used for the lock key. Malformed/throwing input never opens a session.
    const targetMigrationId = safeGetOwnDataProperty(arg, 'targetMigrationId');
    if (targetMigrationId === MISS || !isNonEmptyString(targetMigrationId)) {
      return { status: POSTGRES_LOCK_ACQUIRE_STATUSES.NOT_ATTEMPTED };
    }

    let session;
    try {
      session = await openSession();
    } catch (error) {
      return { status: POSTGRES_LOCK_ACQUIRE_STATUSES.UNAVAILABLE };
    }

    const query = safeGetCallable(session, 'query');
    const release = safeGetCallable(session, 'release');
    const validSession = safeIsPlainRecord(session)
      && query !== undefined
      && release !== undefined;
    if (!validSession) {
      await releaseSessionOnce(session);
      return { status: POSTGRES_LOCK_ACQUIRE_STATUSES.UNAVAILABLE };
    }

    let result;
    try {
      result = await query.call(session, POSTGRES_MIGRATION_LOCK_QUERIES.acquire);
    } catch (error) {
      await releaseSessionOnce(session);
      return { status: POSTGRES_LOCK_ACQUIRE_STATUSES.UNAVAILABLE };
    }

    const evidence = readSingleBooleanField(result, 'acquired');
    if (!evidence.ok) {
      await releaseSessionOnce(session);
      return { status: POSTGRES_LOCK_ACQUIRE_STATUSES.UNAVAILABLE };
    }

    if (evidence.value === true) {
      const handle = createHandle(session, query, release);
      return { status: POSTGRES_LOCK_ACQUIRE_STATUSES.ACQUIRED, handle };
    }

    await releaseSessionOnce(session);
    return { status: POSTGRES_LOCK_ACQUIRE_STATUSES.FAILED };
  }

  async function checkAdvisoryLock(arg) {
    const lockHandle = safeGetOwnDataProperty(arg, 'lockHandle');
    const state = handleState.get(lockHandle);
    // Invalid / cross-adapter / malformed handle: no query.
    if (!state) {
      return { status: POSTGRES_LOCK_CHECK_STATUSES.FAILED };
    }
    // Released / releasing handle: lock no longer held, no query.
    if (state.lifecycle !== 'OPEN') {
      return { status: POSTGRES_LOCK_CHECK_STATUSES.LOST };
    }

    let result;
    try {
      result = await state.query.call(state.session, POSTGRES_MIGRATION_LOCK_QUERIES.check);
    } catch (error) {
      return { status: POSTGRES_LOCK_CHECK_STATUSES.UNAVAILABLE };
    }

    const evidence = readSingleBooleanField(result, 'held');
    if (!evidence.ok) {
      return { status: POSTGRES_LOCK_CHECK_STATUSES.UNAVAILABLE };
    }

    return {
      status: evidence.value === true
        ? POSTGRES_LOCK_CHECK_STATUSES.ACQUIRED
        : POSTGRES_LOCK_CHECK_STATUSES.LOST
    };
  }

  async function releaseAdvisoryLock(arg) {
    const lockHandle = safeGetOwnDataProperty(arg, 'lockHandle');
    const state = handleState.get(lockHandle);
    // Invalid / cross-adapter / malformed handle: no query, no pool release.
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
      const result = await state.query.call(state.session, POSTGRES_MIGRATION_LOCK_QUERIES.release);
      const evidence = readSingleBooleanField(result, 'released');
      if (!evidence.ok) {
        queryOk = false;
      } else {
        released = evidence.value === true;
      }
    } catch (error) {
      queryOk = false;
    }

    // Pool release best-effort exactly once, regardless of unlock result.
    let poolReleaseOk = true;
    try {
      await state.release.call(state.session);
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
