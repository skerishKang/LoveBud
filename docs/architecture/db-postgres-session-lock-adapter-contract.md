# DB PostgreSQL Pinned-Session Advisory-Lock Adapter Contract

Status: subsequent wiring slice #3646 (extends sixth slice #3458). This is a **source-tested contract** for a PostgreSQL session-level advisory-lock adapter. It is **not** a real database client: it performs **no** database connection, **no** `pg` import, **no** actual query execution, and **no** real lock acquisition. Every session and query is a synthetic injected mock.

## Baseline

| Field | Value |
| --- | --- |
| Repository | `skerishKang/LoveBud` |
| Baseline `origin/main` SHA | `c7504a3c5d45a996266e4cf0df7efa7214e8dc3d` (includes #3636 squash `08512be7`) |
| Issue | #3458 |
| Adapter | `scripts/migration-postgres-session-lock-adapter-core.cjs` (`createPostgresMigrationSessionLockAdapter`) |
| Contract test | `tests/contracts/db-postgres-session-lock-adapter-contract.test.cjs` |

## Connection to the #3636 orchestrator

The #3636 orchestrator depends on `acquireAdvisoryLock`, `checkAdvisoryLock`, and `releaseAdvisoryLock` with the status vocabularies `ACQUIRED|NOT_ATTEMPTED|UNAVAILABLE|FAILED` (acquire), `ACQUIRED|LOST|FAILED|UNAVAILABLE` (check), and `RELEASED|FAILED|UNKNOWN` (release). This adapter implements those three methods plus `queryLockedSession` for the #3646 query broker extension. The injected `queryLockedSession` provides a same-instance pinned-session query broker for downstream adapters (e.g., the ledger read/append adapter).

## Global per-database lock rationale

All canonical migrations on one database are serialized behind a **single global lock**. There is no per-`targetMigrationId` lock: `targetMigrationId` is validated as a non-empty string but is **not** used to compute the lock key. No JavaScript runtime hash, no random key, no environment-based key, no caller override, no string interpolation, and no bigint key-space mixing are used.

## Fixed two-int key pair

```js
POSTGRES_MIGRATION_LOCK_KEYS = Object.freeze({
  classKey: 1279415620,  // 0x4c425544 = "LBUD"
  objectKey: 1296648018  // 0x4d494752 = "MIGR"
});
```

Both keys are positive signed-int32 values. Every acquire/check/release query binds exactly `[classKey, objectKey]` as `$1`/`$2` parameters.

## Pinned-session requirement

A PostgreSQL session-level advisory lock is held by a single session until an explicit unlock or session end. A two-integer-key advisory lock appears in `pg_locks` as `classid`/`objid` with `objsubid = 2`. Therefore acquire, check, and release must use the **same pinned session**. The adapter opens one session via the injected `openSession`, pins it from acquire through release, and returns it to the pool **exactly once** (on the release path only).

## Query semantics

- **Acquire** (`lovebud-migration-lock-acquire-v1`): `SELECT pg_try_advisory_lock($1::integer, $2::integer) AS acquired` — non-blocking; returns `acquired: boolean`. Blocking `pg_advisory_lock`, transaction-level locks, and shared locks are forbidden.
- **Check** (`lovebud-migration-lock-check-v1`): `SELECT EXISTS (SELECT 1 FROM pg_locks WHERE locktype = 'advisory' AND pid = pg_backend_pid() AND database = (SELECT oid FROM pg_database WHERE datname = current_database()) AND classid = ($1::integer)::oid AND objid = ($2::integer)::oid AND objsubid = 2 AND mode = 'ExclusiveLock' AND granted = TRUE) AS held` — verifies the lock is held by the **current session** in the **current database**. Returns `held: boolean`.
- **Release** (`lovebud-migration-lock-release-v1`): `SELECT pg_advisory_unlock($1::integer, $2::integer) AS released` — explicit unlock; returns `released: boolean`. `pg_advisory_unlock_all` is forbidden.

All queries are `{ name, text, values: [classKey, objectKey] }`. Keys are bound as parameters, never interpolated. `SELECT *` and full-catalog returns are forbidden.

## Opaque handle lifecycle

On acquire success the adapter returns `{ status: 'ACQUIRED', handle }`. The handle is a frozen, opaque object with **no** enumerable session/query/release/key fields; `JSON.stringify(handle)` exposes nothing. Internal state is held in a closure-private `WeakMap` keyed by the handle, so handles are adapter-instance-specific: another adapter's handle, an arbitrary object, or a released handle is rejected. Internal lifecycle is `OPEN → RELEASING → RELEASED`; the transition to `RELEASING` is atomic (single-thread ordering) so concurrent or repeated releases cannot duplicate the release query or pool release.

## Acquire mapping

- invalid `targetMigrationId` → `NOT_ATTEMPTED` (openSession not called).
- openSession throw → `UNAVAILABLE`.
- invalid session → `UNAVAILABLE` (best-effort pool release once via safe re-inspection if the invalid session has a callable own-data `release`; status independent of cleanup outcome).
- query throw → `UNAVAILABLE` (best-effort pool release once using the **captured** `release`; status independent of cleanup outcome).
- malformed evidence (`null`, `{}`, `{rows:[]}`, `{rows:[{}]}`, non-boolean `acquired`, multiple rows, extra row field) → `UNAVAILABLE` (best-effort pool release once using the **captured** `release`; status independent of cleanup outcome).
- `acquired=true` → `ACQUIRED` + handle; session kept; pool release 0.
- `acquired=false` + cleanup success → `FAILED`; no handle; pool release exactly once. `FAILED` is reserved for confirmed lock contention followed by a successful session cleanup.
- `acquired=false` + cleanup throw/reject or unsafe cleanup → `UNAVAILABLE`; no handle.
- `acquireAdvisoryLock` never throws.

## Check mapping

- invalid / cross-adapter handle → `FAILED`, query 0.
- released / releasing handle → `LOST`, query 0.
- query throw or malformed `held` evidence → `UNAVAILABLE`.
- `held=true` → `ACQUIRED`; `held=false` → `LOST`.
- check never pool-releases the session.

## Release mapping

- invalid / cross-adapter handle → `UNKNOWN`, query/release 0.
- already released / releasing handle → `UNKNOWN`, no additional query/release.
- query throw or malformed `released` evidence → `UNKNOWN` (pool release still once).
- pool release throw/reject (even after `released=true`) → `UNKNOWN`.
- `released=true` + pool release success → `RELEASED`.
- `released=false` → `FAILED` (pool release still once).
- pool release runs best-effort exactly once regardless of unlock result.

## queryLockedSession broker (#3646)

The adapter exposes a fourth method `queryLockedSession({ lockHandle, query })` that runs a validated query object on the same pinned session captured at acquire time.

### Handle and lifecycle contract

- `lockHandle` is read as an own data property only; accessor getters are not executed.
- Only handles registered in the same adapter instance's `WeakMap` are accepted. Cross-adapter handles are rejected.
- Lifecycle must be `OPEN`; `RELEASING` and `RELEASED` handles are rejected.
- Invalid handle, cross-adapter handle, or non-`OPEN` lifecycle rejects with the fixed error `POSTGRES_LOCKED_SESSION_QUERY_UNAVAILABLE` — no query is executed.
- Handle internal state is never returned, serialized, cloned, or logged.

### Query-object descriptor snapshot

The `query` argument is validated via a single-pass descriptor snapshot. It must be:

- A safe plain record.
- Own keys exactly `{ name, text, values }` (no extra string/symbol keys).
- Each field is an enumerable own data property (no accessors, no inherited properties).
- `name` and `text` are non-empty strings.
- `values` is a dense array (non-enumerable `length`, exact indices `0..length-1`, no holes, no extra properties, no symbol keys, no non-canonical numeric keys).

Validation uses `snapshotQueryObject` which performs shape validation and value capture in a single descriptor pass via `safeOwnKeyDescriptors`. After validation, the original query object is never re-accessed. Proxy `get` traps are never executed — all values come from captured descriptors.

### Query execution

On success:

1. The captured `session.query` callable (pinned at acquire-time) is called with `session` as `this` and the validated query snapshot.
2. The callable is invoked exactly once.
3. The raw `QueryResult` is returned to the caller unchanged — no inspection, logging, or wrapping.
4. `session.query` and `session.release` are never re-read after the initial acquire validation.

### Fixed failure contract

All broker failures reject with exactly:

```
POSTGRES_LOCKED_SESSION_QUERY_UNAVAILABLE
```

Applicable to:
- Missing or malformed `lockHandle`.
- Accessor `lockHandle` (getter not executed).
- Revoked Proxy or descriptor trap throw on `lockHandle`.
- Invalid, cross-adapter, `RELEASING`, or `RELEASED` handle.
- Missing or malformed `query` object.
- Accessor `query` or query field (getter not executed).
- Sparse values, extra values property, non-canonical numeric key, symbol key.
- Revoked Proxy or descriptor trap throw on `query` or `values`.
- Underlying `session.query` synchronous throw or Promise rejection.

Never exposed:
- Original Error, message, or stack.
- Session, query callable, release callable.
- Raw query object or query result.
- Hostname, database name, URL, credential, backend PID, lock key, operator identity.

### Implicit release behavior

The broker does **not** perform advisory unlock, pool release, handle deletion, or lifecycle mutation on failure. Release ownership remains exclusively with `releaseAdvisoryLock`. After a broker failure, the handle remains `OPEN` and explicit `releaseAdvisoryLock` continues to work.

### Query-object validation details

The `snapshotDenseArray` helper validates dense arrays with the same two-pass approach as the ledger adapter:

- Pass 1: find `length` descriptor (non-enumerable data property, integer >= 0).
- Pass 2: validate exact index set `0..length-1` (canonical `String(i)`, enumerable data properties, no extra keys).

The `snapshotQueryObject` helper validates the complete query object in a single descriptor pass. After the snapshot, the original query object is never re-accessed. Caller mutation of the original query or values array during execution does not affect the executed query.

## Malformed evidence classification (exact row evidence)

A query result is valid only as exactly `{ rows: [ { <field>: boolean } ] }` where the single row has **exactly one enumerable own key** equal to the target field, and that field is an **own data property** (not an accessor) holding a boolean. Top-level `QueryResult` metadata (`command`, `rowCount`, `oid`, `fields`, ...) is allowed and ignored. Any other shape is malformed evidence and yields the fail-closed status for that method (`UNAVAILABLE` for acquire/check, `UNKNOWN` for release) with a best-effort pool release where applicable.

The row is rejected (malformed) when any of the following holds:

- it is not a safe plain record, or it has a custom prototype;
- the target field is missing, inherited, non-enumerable, an accessor, or non-boolean;
- the row carries any extra enumerable own key (string **or** symbol), e.g. `{ acquired: true, secret: 'x' }`, `{ held: true, pid: 123 }`, `{ released: true, raw: {} }`;
- there are zero or multiple rows, or the rows array is sparse (length 1 without index 0);
- any `Reflect.ownKeys` / `Object.getOwnPropertyDescriptor` / `getPrototypeOf` Proxy trap throws, or the result/row is a revoked Proxy.

Safe inspection (`safeOwnEnumerableKeys`, `readExactBooleanRow`) never executes an accessor getter and never throws; a malformed row never leaks its offending value, message, or stack into the result or handle.

## Total fail-closed public boundary (safe inspection)

Every public method is **total**: it never throws (acquire/check/release) or always rejects with a fixed error on failure (queryLockedSession). No method exposes a raw `Error`, message, or stack. All argument, config, session, and evidence inspection goes through safe internal helpers that bound every `Reflect.ownKeys`, `Object.getPrototypeOf`, `Object.getOwnPropertyDescriptor`, `Array.isArray`, and property read inside a try/catch.

- A normal property is required to be an **own data property**. Accessor getters are **not executed** during inspection; an accessor, a throwing getter, a `Proxy` get/`getOwnPropertyDescriptor`/`getPrototypeOf` trap throw, a revoked `Proxy`, a descriptor-inspection throw, a `rows` getter throw, or a target boolean-field getter throw is treated as malformed and maps to the fail-closed status.
- `acquireAdvisoryLock`: malformed/throwing input (`targetMigrationId`) → `NOT_ATTEMPTED` (openSession not called); malformed/throwing session or evidence → `UNAVAILABLE` (best-effort pool release once where applicable).
- `checkAdvisoryLock`: malformed/throwing input or handle → `FAILED` (no query); malformed/throwing query evidence → `UNAVAILABLE`.
- `releaseAdvisoryLock`: malformed/throwing input, handle, or query evidence → `UNKNOWN`; the acquired session is still cleaned up best-effort exactly once where applicable.
- Factory: any failure reading `config.openSession` (missing, non-function, accessor, throwing getter, revoked `Proxy`, descriptor-inspection throw, null/undefined config) maps to exactly the fixed message `POSTGRES_LOCK_ADAPTER_OPEN_SESSION_REQUIRED`; the original getter error message/stack is never surfaced.

## Validated cleanup callable pinning

At session validation, `acquireAdvisoryLock` reads the session's `query` and `release` callables **exactly once** via safe own-data inspection and captures them in closure locals. Once the session is validated, the entire valid-session lifecycle (acquire query, evidence classification, `acquired=false` cleanup, check, and final release) uses **only those captured callables** and **never re-reads or re-inspects** `session.query` / `session.release` or their property descriptors.

This matters because `query` is an injected dependency that runs between validation and cleanup. A hostile or buggy `query` could, during execution, replace `session.release` with another function, delete it, turn it into a throwing accessor, or put the session into a `Proxy` state whose descriptor inspection throws. Re-inspecting `session.release` at cleanup time would trust that mutated property instead of the callable that was validated. Pinning the captured callable (`callCapturedRelease`) guarantees:

- the **original validated** `release` is the one invoked for cleanup, exactly once;
- a replacement function installed by `query` is **never** called;
- a deleted or accessor-converted `session.release` cannot skip cleanup or fake it (the accessor getter is never executed);
- cleanup remains **exactly once** per acquire attempt regardless of mid-flight mutation.

Cleanup mapping is unchanged by pinning: `acquired=false` + captured cleanup success → `FAILED`; captured cleanup throw/reject → `UNAVAILABLE`; query throw / malformed evidence + captured cleanup (success or failure) → `UNAVAILABLE`.

The **only** path that still performs a safe own-data re-inspection (`releaseSessionOnce`) is the **invalid-session** path, where session validation failed *before* any callable was trusted, so there is no validated callable to pin and a safe re-inspection is required to attempt a best-effort pool release.

## Sanitization

Method results and handle serialization never contain a raw `Error`, error message, stack, session/client object, query function, release function, hostname, database name, connection URL, credential, `targetMigrationId`, full query result, backend PID, catalog row, or lock-key text. Only the fixed status (and the opaque handle on acquire success) is returned. No console logging.

## No actual DB boundary

This contract performs no database connection, no `pg` import, no actual query execution, and no real lock acquisition. All session/query behavior is supplied by synthetic injected mocks.

## Canonical inventory engine vocabulary

The adapter is registered in `docs/architecture/db-schema-change-inventory.json` under the canonical engine vocabulary. The `engine_enum` is `["postgres", "postgres_ephemeral_ci", "none"]`; the synonym `postgresql` is **not** part of the vocabulary. The adapter entry uses `"engine": "postgres"`, matching every other PostgreSQL schema-change path in the inventory. No synonym enum expansion is introduced.

## Remaining adapters / work

- ledger read/append adapter (in progress, #3458, #3641)
- migration execution adapter
- precondition/postcondition adapter
- source/manifest validation adapter
- disposable PostgreSQL rehearsal
- deployment wiring
- Production adoption / activation

## Protected Issues

Refs #3646 - Keep #3646 OPEN.

Refs #3458 - Keep #3458 OPEN.

Refs #3425 - Keep #3425 OPEN.

Refs #3435 - Keep #3435 OPEN.

Refs #3437 - Keep #3437 OPEN.

Refs #1882 - Keep #1882 OPEN.
