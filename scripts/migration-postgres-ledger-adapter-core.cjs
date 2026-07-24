'use strict';

/**
 * PostgreSQL migration-ledger read/append adapter CONTRACT (#3458, seventh slice).
 *
 * This is a source-tested contract for a PostgreSQL migration-ledger adapter
 * compatible with the #3636 orchestrator dependency contract (`readLedger` and
 * `appendLedgerRecord`). It is NOT a real database client: it performs NO database
 * connection, NO `pg` import, NO actual query execution, NO real ledger read or
 * write, and NO real advisory lock. Every query is dispatched through a synthetic
 * injected `queryLockedSession` dependency.
 *
 * The ledger relation (`schema_migration_ledger`) and its seven-field record shape
 * are fixed by contract. Reads use one exact named SELECT ordered by migration_id;
 * appends use one exact named INSERT ... ON CONFLICT (migration_id) DO NOTHING
 * RETURNING migration_id, content_checksum. The adapter is append-only: it never
 * UPDATEs, DELETEs, TRUNCATEs, rewrites, or overwrites an existing row, and it
 * never retries.
 *
 * All results are sanitized. `readLedger` resolves to a frozen array of frozen
 * seven-field clones (never raw rows) or rejects with the single fixed error
 * `POSTGRES_LEDGER_READ_UNAVAILABLE`; it never resolves to `[]` on failure. An
 * empty ledger is a valid `[]` success and is never confused with unavailable
 * evidence. `appendLedgerRecord` is total: it never throws and always resolves to
 * a fixed `{ status }` of APPENDED | FAILED | UNKNOWN. No raw error, message,
 * stack, query result, raw row reference, lock handle, session/client, query or
 * release function, hostname, database name, connection URL, credential, or
 * operator identity ever appears in a result.
 */

// Fixed ledger relation. Never caller-overridable, never read from the
// environment, never interpolated, never hashed, never prefixed/suffixed.
const POSTGRES_MIGRATION_LEDGER_RELATION = 'schema_migration_ledger';

// Fixed record field order. This exact order is shared by the read SELECT list,
// the append INSERT column list, the append $1..$7 parameter order, the cloned
// read record, the append snapshot, the tests, and the docs.
const POSTGRES_MIGRATION_LEDGER_FIELDS = Object.freeze([
  'migration_id',
  'content_checksum',
  'applied_at',
  'runner_version',
  'environment_class',
  'deployed_commit',
  'transaction_outcome'
]);

// Fixed named read query. Exact SELECT list (no SELECT *), canonical UTC
// formatting of applied_at, fixed relation, deterministic ORDER BY migration_id
// ASC. No filter/order override, no offset/limit, no unordered read, no dynamic
// SQL, no interpolation. Values are a frozen empty array.
const LEDGER_READ_QUERY = Object.freeze({
  name: 'lovebud-migration-ledger-read-v1',
  text: [
    'SELECT',
    '  migration_id,',
    '  content_checksum,',
    '  to_char(',
    "    applied_at AT TIME ZONE 'UTC',",
    '    \'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"\'',
    '  ) AS applied_at,',
    '  runner_version,',
    '  environment_class,',
    '  deployed_commit,',
    '  transaction_outcome',
    'FROM schema_migration_ledger',
    'ORDER BY migration_id ASC'
  ].join('\n'),
  values: Object.freeze([])
});

// Fixed named append query template. Exact INSERT column list (field order),
// $1..$7 typed casts, ON CONFLICT (migration_id) DO NOTHING (append-only; no
// DO UPDATE / upsert), RETURNING exactly migration_id, content_checksum. No
// UPDATE/DELETE/TRUNCATE, no multi-row insert, no caller-provided SQL, no raw
// object interpolation. The per-call query binds a frozen snapshot as `values`.
const LEDGER_APPEND_QUERY_TEMPLATE = Object.freeze({
  name: 'lovebud-migration-ledger-append-v1',
  text: [
    'INSERT INTO schema_migration_ledger (',
    '  migration_id,',
    '  content_checksum,',
    '  applied_at,',
    '  runner_version,',
    '  environment_class,',
    '  deployed_commit,',
    '  transaction_outcome',
    ')',
    'VALUES (',
    '  $1::text,',
    '  $2::text,',
    '  $3::timestamptz,',
    '  $4::text,',
    '  $5::text,',
    '  $6::text,',
    '  $7::text',
    ')',
    'ON CONFLICT (migration_id) DO NOTHING',
    'RETURNING',
    '  migration_id,',
    '  content_checksum'
  ].join('\n')
});

const POSTGRES_MIGRATION_LEDGER_QUERIES = Object.freeze({
  read: LEDGER_READ_QUERY,
  append: LEDGER_APPEND_QUERY_TEMPLATE
});

// Append status vocabulary matches the #3636 orchestrator dependency contract.
const POSTGRES_LEDGER_APPEND_STATUSES = Object.freeze({
  APPENDED: 'APPENDED',
  FAILED: 'FAILED',
  UNKNOWN: 'UNKNOWN'
});

// The single fixed, sanitized rejection used by readLedger for every failure.
const POSTGRES_LEDGER_READ_ERROR = 'POSTGRES_LEDGER_READ_UNAVAILABLE';

// The single fixed factory error. Raw getter/Proxy errors never surface.
const FACTORY_ERROR_QUERY_LOCKED_SESSION_REQUIRED = 'POSTGRES_LEDGER_ADAPTER_QUERY_LOCKED_SESSION_REQUIRED';

// transaction_outcome values accepted on READ. (Append input requires COMMITTED.)
const READ_TRANSACTION_OUTCOMES = new Set(['COMMITTED', 'ROLLED_BACK', 'PARTIAL', 'UNKNOWN']);

// Sentinel returned by safe inspection when an own data property is absent,
// inaccessible, or not a plain data value. It is never returned to callers.
const MISS = Symbol('postgres-ledger-adapter-miss');

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

// A canonical timestamp is a non-empty string ending in 'Z' that round-trips to
// the same canonical ISO-8601 UTC value. Mirrors the orchestrator's clock check.
function isCanonicalUtcTimestamp(value) {
  if (typeof value !== 'string' || value.trim().length === 0) return false;
  if (!value.endsWith('Z')) return false;
  let parsed;
  try {
    parsed = new Date(value);
  } catch (error) {
    return false;
  }
  if (Number.isNaN(parsed.getTime())) return false;
  let iso;
  try {
    iso = parsed.toISOString();
  } catch (error) {
    return false;
  }
  return iso === value;
}

// Verify a record carries EXACTLY the fixed field set as enumerable own string
// keys (no extra string key, no enumerable symbol key). Returns false on any
// trap throw, revoked Proxy, or shape mismatch. Never executes a getter.
function hasExactFieldKeys(record) {
  const keys = safeOwnEnumerableKeys(record);
  if (keys === undefined) return false;
  if (keys.length !== POSTGRES_MIGRATION_LEDGER_FIELDS.length) return false;
  const seen = new Set();
  for (const key of keys) {
    if (typeof key === 'symbol') return false;
    seen.add(key);
  }
  for (const field of POSTGRES_MIGRATION_LEDGER_FIELDS) {
    if (!seen.has(field)) return false;
  }
  return true;
}

// Read one raw ledger row into a frozen exact-seven-field clone, or undefined if
// the row is malformed. A row is valid only when it is a safe plain record whose
// enumerable own string keys are exactly the fixed seven fields (no extra string
// key, no enumerable symbol key, no accessor/inherited/non-enumerable required
// field, no custom prototype), every field is an own DATA property holding a
// non-empty string, applied_at is a canonical UTC timestamp, and
// transaction_outcome is one of the read-allowed outcomes. Top-level QueryResult
// metadata is handled by the caller; only the row is inspected here. Accessor
// getters are never executed; trap throws yield undefined.
function readExactRecord(row) {
  try {
    if (!safeIsPlainRecord(row)) return undefined;
    if (!hasExactFieldKeys(row)) return undefined;
    const clone = {};
    for (const field of POSTGRES_MIGRATION_LEDGER_FIELDS) {
      const value = safeGetOwnDataProperty(row, field);
      if (value === MISS || typeof value !== 'string' || value.trim().length === 0) return undefined;
      clone[field] = value;
    }
    if (!isCanonicalUtcTimestamp(clone.applied_at)) return undefined;
    if (!READ_TRANSACTION_OUTCOMES.has(clone.transaction_outcome)) return undefined;
    return Object.freeze(clone);
  } catch (error) {
    return undefined;
  }
}

// Validate a QueryResult and project it to a frozen array of frozen seven-field
// clones preserving the query row order (no JS sort/dedupe/rewrite). Top-level
// metadata (command, rowCount, oid, fields, ...) is allowed and ignored; only the
// own-data `rows` dense array is read. Returns undefined (=> fixed read error) on
// any malformed top-level shape, missing/non-array/sparse rows, malformed row, or
// trap throw. An empty dense rows array yields a frozen [] (valid empty ledger).
function readLedgerRecords(result) {
  try {
    if (!safeIsPlainRecord(result)) return undefined;
    const rows = safeGetOwnDataProperty(result, 'rows');
    if (rows === MISS || !safeIsArray(rows)) return undefined;
    const length = safeGetOwnDataProperty(rows, 'length');
    if (typeof length !== 'number' || !Number.isInteger(length) || length < 0) return undefined;
    const records = [];
    for (let i = 0; i < length; i += 1) {
      const row = safeGetOwnDataProperty(rows, String(i));
      if (row === MISS) return undefined; // sparse / hole
      const record = readExactRecord(row);
      if (record === undefined) return undefined;
      records.push(record);
    }
    return Object.freeze(records);
  } catch (error) {
    return undefined;
  }
}

// Snapshot a caller append record into frozen query values (field order) plus the
// migration_id/content_checksum needed for evidence comparison, or undefined if
// the record is invalid. A record is valid only when it is a safe plain record
// whose enumerable own string keys are exactly the fixed seven fields (no extra
// string/symbol key, no accessor/inherited/non-enumerable field), every field is
// an own DATA property holding a non-empty string, applied_at is a canonical UTC
// timestamp, and transaction_outcome is exactly 'COMMITTED'. The snapshot is taken
// synchronously before any await so later caller mutation of the original record
// cannot affect the query values or the result decision. Accessor getters are
// never executed; trap throws yield undefined.
function snapshotAppendRecord(record) {
  try {
    if (!safeIsPlainRecord(record)) return undefined;
    if (!hasExactFieldKeys(record)) return undefined;
    const values = [];
    const captured = {};
    for (const field of POSTGRES_MIGRATION_LEDGER_FIELDS) {
      const value = safeGetOwnDataProperty(record, field);
      if (value === MISS || typeof value !== 'string' || value.trim().length === 0) return undefined;
      values.push(value);
      captured[field] = value;
    }
    if (!isCanonicalUtcTimestamp(captured.applied_at)) return undefined;
    if (captured.transaction_outcome !== 'COMMITTED') return undefined;
    return Object.freeze({
      values: Object.freeze(values),
      migration_id: captured.migration_id,
      content_checksum: captured.content_checksum
    });
  } catch (error) {
    return undefined;
  }
}

// Classify append evidence into a fixed status. Never throws.
//   APPENDED: exactly one row with exactly two enumerable own string keys
//             (migration_id, content_checksum) whose values equal the snapshot.
//   FAILED:   { rows: [] } — ON CONFLICT DO NOTHING confirmed no insert.
//   UNKNOWN:  query throw/reject (handled by caller), malformed top-level result,
//             missing/non-array/sparse rows, multiple rows, wrong returned
//             id/checksum, extra returned field, accessor/inherited field, or any
//             Proxy/descriptor/ownKeys trap throw. Commit is never inferred.
function readExactAppendEvidence(result, snapshot) {
  try {
    if (!safeIsPlainRecord(result)) return POSTGRES_LEDGER_APPEND_STATUSES.UNKNOWN;
    const rows = safeGetOwnDataProperty(result, 'rows');
    if (rows === MISS || !safeIsArray(rows)) return POSTGRES_LEDGER_APPEND_STATUSES.UNKNOWN;
    const length = safeGetOwnDataProperty(rows, 'length');
    if (typeof length !== 'number' || !Number.isInteger(length) || length < 0) {
      return POSTGRES_LEDGER_APPEND_STATUSES.UNKNOWN;
    }
    if (length === 0) return POSTGRES_LEDGER_APPEND_STATUSES.FAILED;
    if (length !== 1) return POSTGRES_LEDGER_APPEND_STATUSES.UNKNOWN;
    const row = safeGetOwnDataProperty(rows, '0');
    if (row === MISS || !safeIsPlainRecord(row)) return POSTGRES_LEDGER_APPEND_STATUSES.UNKNOWN;
    const keys = safeOwnEnumerableKeys(row);
    if (keys === undefined || keys.length !== 2) return POSTGRES_LEDGER_APPEND_STATUSES.UNKNOWN;
    const seen = new Set();
    for (const key of keys) {
      if (typeof key === 'symbol') return POSTGRES_LEDGER_APPEND_STATUSES.UNKNOWN;
      seen.add(key);
    }
    if (!seen.has('migration_id') || !seen.has('content_checksum')) {
      return POSTGRES_LEDGER_APPEND_STATUSES.UNKNOWN;
    }
    const returnedId = safeGetOwnDataProperty(row, 'migration_id');
    const returnedChecksum = safeGetOwnDataProperty(row, 'content_checksum');
    if (returnedId !== snapshot.migration_id) return POSTGRES_LEDGER_APPEND_STATUSES.UNKNOWN;
    if (returnedChecksum !== snapshot.content_checksum) return POSTGRES_LEDGER_APPEND_STATUSES.UNKNOWN;
    return POSTGRES_LEDGER_APPEND_STATUSES.APPENDED;
  } catch (error) {
    return POSTGRES_LEDGER_APPEND_STATUSES.UNKNOWN;
  }
}

/**
 * Create a frozen adapter { readLedger, appendLedgerRecord } backed by an injected
 * queryLockedSession dependency.
 *
 * queryLockedSession (sync or async) receives exactly { lockHandle, query } and
 * resolves to a pg-style QueryResult. It later binds the opaque lock handle to a
 * real pinned session; this slice never inspects the handle, never implements a
 * handle registry, and never exposes a session object.
 */
function createPostgresMigrationLedgerAdapter(config) {
  // Reading config.queryLockedSession must never surface a raw getter/Proxy error:
  // any throw, accessor, revoked Proxy, missing, inherited, or non-function value
  // maps to the single fixed factory error message.
  const queryLockedSession = safeGetOwnDataProperty(config, 'queryLockedSession');
  if (queryLockedSession === MISS || typeof queryLockedSession !== 'function') {
    throw new Error(FACTORY_ERROR_QUERY_LOCKED_SESSION_REQUIRED);
  }

  // Capture the callable exactly once; never re-inspect the property afterwards.
  const broker = queryLockedSession;

  async function readLedger(arg) {
    const lockHandle = safeGetOwnDataProperty(arg, 'lockHandle');
    if (lockHandle === MISS || lockHandle === null || lockHandle === undefined) {
      throw new Error(POSTGRES_LEDGER_READ_ERROR);
    }

    let result;
    try {
      result = await broker({ lockHandle, query: LEDGER_READ_QUERY });
    } catch (error) {
      throw new Error(POSTGRES_LEDGER_READ_ERROR);
    }

    const records = readLedgerRecords(result);
    if (records === undefined) {
      throw new Error(POSTGRES_LEDGER_READ_ERROR);
    }
    return records;
  }

  async function appendLedgerRecord(arg) {
    // Synchronous validation + snapshot BEFORE any await so caller mutation of the
    // original record during the query cannot affect the values or the decision.
    const lockHandle = safeGetOwnDataProperty(arg, 'lockHandle');
    const handleOk = lockHandle !== MISS && lockHandle !== null && lockHandle !== undefined;
    const record = safeGetOwnDataProperty(arg, 'record');
    const snapshot = snapshotAppendRecord(record);
    if (!handleOk || snapshot === undefined) {
      // Invalid input: no query, fixed negative, nothing exposed.
      return Object.freeze({ status: POSTGRES_LEDGER_APPEND_STATUSES.FAILED });
    }

    // Frozen per-call query: fixed name/text template + frozen snapshot values in
    // field order. The broker cannot mutate the query object or the fixed template.
    const query = Object.freeze({
      name: LEDGER_APPEND_QUERY_TEMPLATE.name,
      text: LEDGER_APPEND_QUERY_TEMPLATE.text,
      values: snapshot.values
    });

    let result;
    try {
      result = await broker({ lockHandle, query });
    } catch (error) {
      // Query throw/reject: commit cannot be inferred.
      return Object.freeze({ status: POSTGRES_LEDGER_APPEND_STATUSES.UNKNOWN });
    }

    return Object.freeze({ status: readExactAppendEvidence(result, snapshot) });
  }

  return Object.freeze({
    readLedger,
    appendLedgerRecord
  });
}

module.exports = {
  POSTGRES_MIGRATION_LEDGER_RELATION,
  POSTGRES_MIGRATION_LEDGER_FIELDS,
  POSTGRES_MIGRATION_LEDGER_QUERIES,
  POSTGRES_LEDGER_APPEND_STATUSES,
  POSTGRES_LEDGER_READ_ERROR,
  createPostgresMigrationLedgerAdapter
};
