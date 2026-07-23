# DB PostgreSQL Pinned-Session Advisory-Lock Adapter Contract

Status: sixth small slice of Issue #3458. This is a **source-tested contract** for a PostgreSQL session-level advisory-lock adapter. It is **not** a real database client: it performs **no** database connection, **no** `pg` import, **no** actual query execution, and **no** real lock acquisition. Every session and query is a synthetic injected mock.

## Baseline

| Field | Value |
| --- | --- |
| Repository | `skerishKang/LoveBud` |
| Baseline `origin/main` SHA | `c7504a3c5d45a996266e4cf0df7efa7214e8dc3d` (includes #3636 squash `08512be7`) |
| Issue | #3458 |
| Adapter | `scripts/migration-postgres-session-lock-adapter-core.cjs` (`createPostgresMigrationSessionLockAdapter`) |
| Contract test | `tests/contracts/db-postgres-session-lock-adapter-contract.test.cjs` |

## Connection to the #3636 orchestrator

The #3636 orchestrator depends on `acquireAdvisoryLock`, `checkAdvisoryLock`, and `releaseAdvisoryLock` with the status vocabularies `ACQUIRED|NOT_ATTEMPTED|UNAVAILABLE|FAILED` (acquire), `ACQUIRED|LOST|FAILED|UNAVAILABLE` (check), and `RELEASED|FAILED|UNKNOWN` (release). This adapter implements exactly those three methods and returns exactly those statuses, so it can be wired into the orchestrator's dependency set. The orchestrator passes the lock handle as an opaque value.

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
- openSession throw / invalid session → `UNAVAILABLE` (best-effort pool release once if the invalid session has a callable `release`).
- query throw or malformed evidence (`null`, `{}`, `{rows:[]}`, `{rows:[{}]}`, non-boolean `acquired`, multiple rows) → `UNAVAILABLE` (best-effort pool release once).
- `acquired=true` → `ACQUIRED` + handle; session kept; pool release 0.
- `acquired=false` → `FAILED`; no handle; pool release exactly once.
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

## Malformed evidence classification

A query result is valid only as exactly `{ rows: [ { <field>: boolean } ] }` (one row, plain record, boolean field). Any other shape is malformed evidence and yields the fail-closed status for that method (`UNAVAILABLE` for acquire/check, `UNKNOWN` for release) with a best-effort pool release where applicable.

## Sanitization

Method results and handle serialization never contain a raw `Error`, error message, stack, session/client object, query function, release function, hostname, database name, connection URL, credential, `targetMigrationId`, full query result, backend PID, catalog row, or lock-key text. Only the fixed status (and the opaque handle on acquire success) is returned. No console logging.

## No actual DB boundary

This contract performs no database connection, no `pg` import, no actual query execution, and no real lock acquisition. All session/query behavior is supplied by synthetic injected mocks.

## Remaining adapters / work

- ledger read/append adapter
- migration execution adapter
- precondition/postcondition adapter
- source/manifest validation adapter
- disposable PostgreSQL rehearsal
- deployment wiring
- Production adoption / activation

## Protected Issues

Refs #3458 - Keep #3458 OPEN.

Refs #3425 - Keep #3425 OPEN.

Refs #3435 - Keep #3435 OPEN.

Refs #3437 - Keep #3437 OPEN.

Refs #1882 - Keep #1882 OPEN.
