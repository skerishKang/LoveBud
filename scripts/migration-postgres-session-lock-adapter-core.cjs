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
const BROKER_ERROR_QUERY_UNAVAILABLE = 'POSTGRES_LOCKED_SESSION_QUERY_UNAVAILABLE';

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

// Collect the enumerable OWN keys (string and symbol) of a record without ever
// throwing or executing an accessor getter. Reflect.ownKeys and
// Object.getOwnPropertyDescriptor can invoke Proxy traps that throw; any throw,
// revoked Proxy, or inconsistent ownKeys/descriptor result yields undefined.
function safeOwnEnumerableKeys(obj) {
  let keys;
  try {
    keys = Reflect.ownKeys(obj);
  } catch (error) {
    return undefined;
  }
  const enumerable = [];
  for (const key of keys) {
    let desc;
    try {
      desc = Object.getOwnPropertyDescriptor(obj, key);
    } catch (error) {
      return undefined;
    }
    if (desc === undefined) return undefined;
    if (desc.enumerable === true) enumerable.push(key);
  }
  return enumerable;
}

// Collect ALL own keys (string and symbol) and their descriptors without ever
// throwing or executing an accessor getter. Returns undefined on any trap throw,
// revoked Proxy, or inconsistent ownKeys/descriptor result.
function safeOwnKeyDescriptors(obj) {
  let keys;
  try {
    keys = Reflect.ownKeys(obj);
  } catch (error) {
    return undefined;
  }
  const descriptors = [];
  for (const key of keys) {
    let desc;
    try {
      desc = Object.getOwnPropertyDescriptor(obj, key);
    } catch (error) {
      return undefined;
    }
    if (desc === undefined) return undefined;
    descriptors.push({ key, desc });
  }
  return descriptors;
}

// Snapshot a query object { name, text, values } from descriptors in ONE pass.
// Validates:
// - safe plain record
// - own keys are EXACTLY { name, text, values } (no extra string/symbol key)
// - all keys are strings (no symbol keys)
// - each field is an enumerable own data property (no accessor, no inherited)
// - name and text are non-empty strings
// - values is a dense array (non-enumerable length, exact indices 0..length-1,
//   no holes, no extra properties, no symbol keys, no accessor indices,
//   no non-canonical numeric keys)
// Returns a frozen { name, text, values } snapshot or undefined if malformed.
// After this call, the original query object is never re-accessed. Proxy get
// traps are never executed. Each own property descriptor is retrieved at most once.
function snapshotQueryObject(query) {
  try {
    if (!safeIsPlainRecord(query)) return undefined;
    const descriptors = safeOwnKeyDescriptors(query);
    if (descriptors === undefined) return undefined;
    if (descriptors.length !== 3) return undefined;

    const snapshot = {};
    const seen = new Set();
    for (const { key, desc } of descriptors) {
      // 1. All own keys must be strings (no symbol keys)
      if (typeof key !== 'string') return undefined;
      // 2. Accessor forbidden (must be data property)
      if (!('value' in desc)) return undefined;
      // 3. Must be enumerable=true
      if (desc.enumerable !== true) return undefined;
      // 4. Must be one of the expected fields (no extra keys)
      if (key !== 'name' && key !== 'text' && key !== 'values') return undefined;
      // 5. Capture value immediately from this single descriptor
      snapshot[key] = desc.value;
      seen.add(key);
    }
    // 6. Must have all three fields
    if (!seen.has('name') || !seen.has('text') || !seen.has('values')) return undefined;

    // 7. Validate name and text (non-empty strings)
    if (!isNonEmptyString(snapshot.name)) return undefined;
    if (!isNonEmptyString(snapshot.text)) return undefined;

    // 8. Validate values is a dense array (single descriptor pass)
    const valuesSnapshot = snapshotDenseArray(snapshot.values);
    if (valuesSnapshot === undefined) return undefined;

    return Object.freeze({
      name: snapshot.name,
      text: snapshot.text,
      values: valuesSnapshot
    });
  } catch (error) {
    return undefined;
  }
}

// Snapshot a dense array into a frozen array by inspecting descriptors exactly
// once. Uses two-pass validation within a single descriptor list:
//   Pass 1: find length descriptor (non-enumerable data property, integer >= 0)
//   Pass 2: validate exact index set 0..length-1 (canonical String(i), enumerable
//           data properties) and no extra keys
// After this call, the original array is never accessed again. Proxy get traps
// are never executed.
function snapshotDenseArray(arr) {
  if (!safeIsArray(arr)) return undefined;
  const descriptors = safeOwnKeyDescriptors(arr);
  if (descriptors === undefined) return undefined;

  // Pass 1: find length descriptor
  let length = -1;
  for (const { key, desc } of descriptors) {
    if (key === 'length') {
      if (desc.enumerable === true) return undefined;
      if (!('value' in desc) || typeof desc.value !== 'number' || !Number.isInteger(desc.value) || desc.value < 0) return undefined;
      length = desc.value;
    }
  }
  if (length === -1) return undefined; // length missing

  // Pass 2: validate exact key set and capture values
  const indexValues = [];
  for (const { key, desc } of descriptors) {
    if (key === 'length') continue; // already validated in pass 1
    if (typeof key !== 'string') return undefined; // symbol key forbidden
    const idx = Number(key);
    // Must be canonical numeric index: String(Number(key)) === key
    if (!Number.isInteger(idx) || idx < 0 || String(idx) !== key) return undefined;
    // Must be in range 0..length-1
    if (idx >= length) return undefined;
    // Must be enumerable data property
    if (desc.enumerable !== true) return undefined;
    if (!('value' in desc)) return undefined;
    indexValues[idx] = desc.value;
  }

  // Verify exactly length indices (no holes, no extras)
  if (indexValues.length !== length) return undefined;
  for (let i = 0; i < length; i += 1) {
    if (!(i in indexValues)) return undefined;
  }
  return Object.freeze(indexValues);
}

// Classify a query result as exactly { rows: [ { <field>: boolean } ] } where the
// single row has EXACTLY ONE enumerable own key equal to `field`, and that field is
// an own DATA property (not accessor) holding a boolean. Top-level QueryResult
// metadata (command, rowCount, oid, fields, ...) is allowed and ignored. Any throw,
// Proxy trap, revoked Proxy, malformed shape, non-plain record, wrong row count,
// sparse row, extra string/symbol field, accessor field, inherited field, custom
// prototype, or non-boolean field yields { ok: false }. Accessor getters are never
// executed.
function readExactBooleanRow(result, field) {
  try {
    if (!safeIsPlainRecord(result)) return { ok: false };
    const rows = safeGetOwnDataProperty(result, 'rows');
    if (rows === MISS || !safeIsArray(rows)) return { ok: false };
    const length = safeGetOwnDataProperty(rows, 'length');
    if (length !== 1) return { ok: false };
    const row = safeGetOwnDataProperty(rows, '0');
    if (row === MISS || !safeIsPlainRecord(row)) return { ok: false };
    const keys = safeOwnEnumerableKeys(row);
    if (keys === undefined) return { ok: false };
    if (keys.length !== 1) return { ok: false };
    if (keys[0] !== field) return { ok: false };
    const value = safeGetOwnDataProperty(row, field);
    if (value === true || value === false) return { ok: true, value };
    return { ok: false };
  } catch (error) {
    return { ok: false };
  }
}

// Best-effort pool release of a session, exactly once, discarding all error
// detail. No-ops when the session has no callable own-data `release`. Used ONLY
// for the invalid-session cleanup path, where session validation failed BEFORE
// any callable was trusted, so a safe own-data re-inspection is still required.
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

// Best-effort pool release using a release callable that was ALREADY captured and
// validated at session-validation time. It NEVER re-reads `session.release` and
// NEVER re-inspects the property descriptor, so an injected `query` that mutates,
// deletes, replaces, or turns `session.release` into a throwing accessor during
// execution cannot divert, skip, or fake the cleanup. Exactly once; discards all
// error detail. Total: a non-function captured value yields false without throwing.
async function callCapturedRelease(session, release) {
  if (typeof release !== 'function') return false;
  try {
    await release.call(session);
    return true;
  } catch (error) {
    return false;
  }
}

/**
 * Create a frozen adapter { acquireAdvisoryLock, checkAdvisoryLock,
 * queryLockedSession, releaseAdvisoryLock } backed by an injected openSession
 * dependency.
 *
 * openSession() (sync or async) must resolve to a plain record { query, release }
 * with both callable. The session is pinned from acquire through release and
 * returned to the pool exactly once.
 *
 * queryLockedSession({ lockHandle, query }) runs a validated query object on the
 * same pinned session captured at acquire time. The query object is validated
 * via descriptor snapshot (exact { name, text, values } own keys, dense values
 * array) before execution. The captured session.query callable is used exactly
 * once with the captured session as `this`. Failures reject with the fixed
 * message POSTGRES_LOCKED_SESSION_QUERY_UNAVAILABLE.
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
      await callCapturedRelease(session, release);
      return { status: POSTGRES_LOCK_ACQUIRE_STATUSES.UNAVAILABLE };
    }

    const evidence = readExactBooleanRow(result, 'acquired');
    if (!evidence.ok) {
      await callCapturedRelease(session, release);
      return { status: POSTGRES_LOCK_ACQUIRE_STATUSES.UNAVAILABLE };
    }

    if (evidence.value === true) {
      const handle = createHandle(session, query, release);
      return { status: POSTGRES_LOCK_ACQUIRE_STATUSES.ACQUIRED, handle };
    }

    // acquired=false is normal lock contention. FAILED is only valid when the
    // confirmed contention is followed by a successful session cleanup; a cleanup
    // throw/reject or unsafe cleanup downgrades to UNAVAILABLE. Cleanup uses the
    // release callable captured at validation time (never re-inspected), so an
    // injected query cannot divert or skip the cleanup by mutating session.release.
    const cleanupOk = await callCapturedRelease(session, release);
    return {
      status: cleanupOk
        ? POSTGRES_LOCK_ACQUIRE_STATUSES.FAILED
        : POSTGRES_LOCK_ACQUIRE_STATUSES.UNAVAILABLE
    };
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

    const evidence = readExactBooleanRow(result, 'held');
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
      const evidence = readExactBooleanRow(result, 'released');
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

  async function queryLockedSession(arg) {
    const lockHandle = safeGetOwnDataProperty(arg, 'lockHandle');
    const state = handleState.get(lockHandle);
    // Invalid / cross-adapter / malformed handle: no query.
    if (!state) {
      return Promise.reject(new Error(BROKER_ERROR_QUERY_UNAVAILABLE));
    }
    // Releasing / released handle: no query.
    if (state.lifecycle !== 'OPEN') {
      return Promise.reject(new Error(BROKER_ERROR_QUERY_UNAVAILABLE));
    }

    const query = safeGetOwnDataProperty(arg, 'query');
    const querySnapshot = snapshotQueryObject(query);
    if (querySnapshot === undefined) {
      return Promise.reject(new Error(BROKER_ERROR_QUERY_UNAVAILABLE));
    }

    try {
      return await state.query.call(state.session, querySnapshot);
    } catch (error) {
      return Promise.reject(new Error(BROKER_ERROR_QUERY_UNAVAILABLE));
    }
  }

  return Object.freeze({
    acquireAdvisoryLock,
    checkAdvisoryLock,
    queryLockedSession,
    releaseAdvisoryLock
  });
}

module.exports = {
  POSTGRES_MIGRATION_LOCK_KEYS,
  POSTGRES_MIGRATION_LOCK_QUERIES,
  POSTGRES_LOCK_ACQUIRE_STATUSES,
  POSTGRES_LOCK_CHECK_STATUSES,
  POSTGRES_LOCK_RELEASE_STATUSES,
  BROKER_ERROR_QUERY_UNAVAILABLE,
  createPostgresMigrationSessionLockAdapter
};
