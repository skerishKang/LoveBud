# DB PostgreSQL Migration Ledger Read/Append Adapter Contract

Status: seventh small slice of Issue #3458. This is a **source-tested contract** for a PostgreSQL migration-ledger read/append adapter. It is **not** a real database client: it performs **no** database connection, **no** `pg` import, **no** actual query execution, **no** real ledger read, and **no** real ledger write. Every query result is a synthetic injected mock.

## Baseline

| Field | Value |
| --- | --- |
| Repository | `skerishKang/LoveBud` |
| Baseline `origin/main` SHA | `a0146d8045e469773b06e43cdc3694cf65f14786` (includes #3638 squash) |
| Issue | #3458 |
| Dependency | #3638 (postgres session lock adapter, MERGED) |
| Adapter | `scripts/migration-postgres-ledger-adapter-core.cjs` (`createPostgresMigrationLedgerAdapter`) |
| Contract test | `tests/contracts/db-postgres-ledger-adapter-contract.test.cjs` |

## Connection to the #3636 orchestrator and the #3638 lock adapter

The #3636 orchestrator depends on `readLedger` and `appendLedgerRecord`. This adapter implements exactly those two methods with exactly the orchestrator's call shapes and status vocabulary, so it can be wired into the orchestrator's dependency set alongside the #3638 session-lock adapter.

```js
readLedger({ lockHandle })

appendLedgerRecord({
  record: {
    migration_id,
    content_checksum,
    applied_at,
    runner_version,
    environment_class,
    deployed_commit,
    transaction_outcome
  },
  lockHandle
})
```

`readLedger` resolves to a frozen array of frozen seven-field records (or a frozen empty array for an empty ledger) and rejects with a fixed sanitized error on any failure. `appendLedgerRecord` is total: it never throws and returns exactly `{ status }` where `status` is one of `APPENDED|FAILED|UNKNOWN`.

The #3638 session-lock adapter produces the opaque `lockHandle`. This adapter treats that handle as opaque and forwards it unchanged to the injected broker; it never inspects, serializes, mutates, or exposes it.

## Injected `queryLockedSession` boundary

The factory takes exactly one injected dependency:

```js
createPostgresMigrationLedgerAdapter({ queryLockedSession })
```

`queryLockedSession` is a sync-or-async injected dependency that receives `{ lockHandle, query }` and returns (or resolves to) a `pg`-style `QueryResult`. In a later slice this dependency will connect the opaque lock handle to a real pinned session; in this slice it is always a synthetic mock.

This slice deliberately does **not** implement a lock-handle registry, does **not** modify the #3638 session-lock adapter, does **not** implement a generic DB client, and does **not** expose any session object.

### Factory boundary

`queryLockedSession` must be an **own data property** of the config that is **callable**. Accessor getters, inherited properties, revoked Proxies, throwing getters, and non-functions are all rejected. Any such failure maps to exactly the fixed message:

```text
POSTGRES_LEDGER_ADAPTER_QUERY_LOCKED_SESSION_REQUIRED
```

The raw getter/Proxy error message and stack are never surfaced. On factory success the callable is captured **exactly once** into a closure local and is never re-inspected afterward.

## Fixed relation and field contract

```text
relation: schema_migration_ledger

field order (shared by read, append, SQL values, clone, tests, docs):
  migration_id
  content_checksum
  applied_at
  runner_version
  environment_class
  deployed_commit
  transaction_outcome
```

The relation name and field names are fixed module constants. They cannot be overridden by the caller, read from the environment, dynamically interpolated, derived from a runtime hash, or changed by prefix/suffix.

## Fixed read query

Named query `lovebud-migration-ledger-read-v1`:

```sql
SELECT
  migration_id,
  content_checksum,
  to_char(
    applied_at AT TIME ZONE 'UTC',
    'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"'
  ) AS applied_at,
  runner_version,
  environment_class,
  deployed_commit,
  transaction_outcome
FROM schema_migration_ledger
ORDER BY migration_id ASC
```

Query object:

```js
{
  name: 'lovebud-migration-ledger-read-v1',
  text: FIXED_READ_SQL,
  values: []   // frozen empty values
}
```

Requirements: exact named query; frozen query object; frozen empty `values`; no `SELECT *`; no dynamic SQL; no relation/field interpolation; no caller filter/order override; no offset/limit; no unordered read.

## Fixed append query

Named query `lovebud-migration-ledger-append-v1`:

```sql
INSERT INTO schema_migration_ledger (
  migration_id,
  content_checksum,
  applied_at,
  runner_version,
  environment_class,
  deployed_commit,
  transaction_outcome
)
VALUES (
  $1::text,
  $2::text,
  $3::timestamptz,
  $4::text,
  $5::text,
  $6::text,
  $7::text
)
ON CONFLICT (migration_id) DO NOTHING
RETURNING
  migration_id,
  content_checksum
```

Query `values` order matches the fixed field order exactly:

```js
[
  record.migration_id,
  record.content_checksum,
  record.applied_at,
  record.runner_version,
  record.environment_class,
  record.deployed_commit,
  record.transaction_outcome
]
```

Forbidden: `UPDATE`, `UPSERT DO UPDATE`, `DELETE`, `TRUNCATE`, ledger rewrite, existing-row overwrite, retry loop, multi-row insert, caller-provided SQL, raw object interpolation.

## Opaque lock binding

`lockHandle` is opaque. It must be present as an own data property and must not be `null`/`undefined`. The adapter performs **no** internal field inspection, **no** serialization, and **no** mutation of the handle, and never exposes it in a result or log. It forwards the exact handle value to `queryLockedSession`. Handle validity and session identity are the injected broker's responsibility.

## readLedger contract

### Success

`readLedger({ lockHandle })`:

1. passes the fixed read query to `queryLockedSession` exactly once;
2. validates the `QueryResult` evidence;
3. never returns a raw DB row reference;
4. produces exact seven-field cloned records;
5. freezes each record;
6. freezes the returned array;
7. preserves the query row order exactly;
8. performs no JS-side sort/dedupe/rewrite.

An empty ledger is a valid success result: a frozen `[]`.

### QueryResult shape

Top-level: a safe plain record with an own data property `rows` that is a **dense array** (non-enumerable `length` data property, exactly `length` own enumerable index data properties, no other own properties). Top-level `pg` metadata (`command`, `rowCount`, `oid`, `fields`, ...) is allowed and ignored; no raw metadata other than `rows` is returned. Extra own properties on `rows` (enumerable or not) cause a read error.

Each row: a safe plain record whose **ALL own keys** (enumerable or not, string or symbol) are **exactly** the fixed seven fields as enumerable own string data properties. Extra non-enumerable string keys, symbol keys (enumerable or not), accessor properties, inherited properties, and custom prototypes are all rejected. Each field must be a non-empty string.

- `applied_at`: canonical ISO-8601 UTC, ending in `Z`, with `new Date(value).toISOString() === value`.
- `transaction_outcome`: one of `COMMITTED|ROLLED_BACK|PARTIAL|UNKNOWN`. `NOT_EVALUATED` or any other string is malformed.

### Semantic responsibility

The adapter does **not** judge duplicate migrations, manifest membership, checksum match, committed prefix, dependency order, or target nextness. Those are the existing runner protocol's responsibility. The adapter preserves row order and validates structural evidence only.

### Read failure

Any of the following rejects/throws with the fixed sanitized error:

```text
POSTGRES_LEDGER_READ_UNAVAILABLE
```

Targets: invalid/missing `lockHandle`; `queryLockedSession` throw/reject; malformed `QueryResult`; malformed row; raw-evidence trap throw. No raw DB error/message/stack/row/hostname/URL/credential/handle is exposed. `readLedger` never returns `[]` on failure — an empty ledger and unavailable evidence are never confused. The orchestrator catches the fixed rejection and treats it as a dependency failure.

## appendLedgerRecord input contract

`record` must be a safe plain record whose **ALL own keys** (enumerable or not, string or symbol) are **exactly** the fixed seven fields as enumerable own string data properties. Extra non-enumerable string keys, symbol keys, accessor properties, inherited properties, and custom prototypes are all rejected. Each value must be a non-empty string, `applied_at` a canonical UTC timestamp, and `transaction_outcome === 'COMMITTED'`.

Invalid input maps to `{ status: 'FAILED' }` with **zero** query calls and no raw-input or handle exposure. The record values are safely snapshotted **once, before** the query. A caller mutation of the original record during query execution cannot affect the query values or the result decision.

## append result mapping

### APPENDED

Only when the query result evidence is **exactly**:

```js
{ rows: [ { migration_id: SNAPSHOT_ID, content_checksum: SNAPSHOT_CHECKSUM } ] }
```

Requirements: `rows` is a dense array (non-enumerable `length`, exactly `length` enumerable index data properties, no other own properties); exactly one row; the row's **ALL own keys** are exactly `migration_id` and `content_checksum` as enumerable own string data properties (no extra string/symbol key, no non-enumerable field, no accessor, no inherited property); values exactly matching the snapshot; top-level normal `pg` metadata allowed. Result: `{ status: 'APPENDED' }`.

### FAILED

`ON CONFLICT DO NOTHING` returning an **exact** `{ rows: [] }` (dense empty array with non-enumerable `length` and no other own properties) is confirmed negative evidence that no insert occurred. Result: `{ status: 'FAILED' }`. No automatic retry/update/rewrite. Invalid input is also `FAILED` with zero queries.

### UNKNOWN

The append result cannot be confirmed, so: `{ status: 'UNKNOWN' }`. Targets: query throw/reject; malformed top-level result; non-dense `rows` (extra own properties, sparse indices, accessor indices); multiple rows; wrong returned id/checksum; extra returned row fields; any non-enumerable or symbol own key on the row; accessor/inherited field; Proxy/descriptor/ownKeys trap; missing/non-array `rows`; any unexpected evidence. When the query throws, the actual commit outcome is **not** guessed. Every append result is a fixed status only and never throws.

## Mutation resistance

Proven by the contract test:

- exported constants are frozen;
- the adapter is frozen;
- the fixed query templates are frozen;
- the read output array is frozen;
- the read output records are frozen;
- the raw row reference and the clone reference are distinct;
- caller record mutation does not affect append values;
- a `queryLockedSession` that attempts to mutate the query object cannot change the fixed definition;
- `lockHandle` is forwarded unchanged but never inspected/serialized.

## Descriptor snapshot / TOCTOU hardening

All evidence is inspected via **descriptor inspection exactly once** and then consumed only from the captured snapshot. The original Proxy/object/array property is **never re-accessed** after validation. This eliminates TOCTOU (time-of-check/time-of-use) windows where a Proxy `get` trap or a descriptor trap could return a different value on a second access.

### Snapshot helpers

- `readExactDenseArraySnapshot(arr)` — captures `length` and all index values from descriptors in a single pass. Returns a frozen `{ length, values }` or `undefined`.
- `readExactLedgerRecordDescriptorSnapshot(record)` — captures all seven field values from descriptors in a **single pass** that also validates exact key set, string-only keys, no extra/symbol/accessor keys, and enumerable own data properties. Returns a frozen record or `undefined`.
- `readExactAppendEvidenceRowSnapshot(row)` — captures `migration_id` and `content_checksum` from descriptors in a single pass. Returns a frozen `{ migration_id, content_checksum }` or `undefined`.

### Single-pass record snapshot

The read record, append input record, and append evidence row all use descriptor single-pass:

- exact-key validation and value capture happen in the **same** descriptor pass
- each own property descriptor is retrieved at most once
- separate shape-check/value-read pass is forbidden
- first descriptor snapshot wins
- original hostile record is never re-queried after the snapshot

### Exact dense index set

A dense array's own keys must be **exactly**:

```text
length
0
1
...
length-1
```

Each index key must be the canonical `String(i)` (rejecting `00`, `01`, `000`, `1e0`, `+0`, `-0`, etc.). Non-canonical numeric-looking keys cause a read error / UNKNOWN. Out-of-range indices, missing indices, symbol keys, extra properties, and accessor properties are all rejected.

### Proxy `get` trap execution is zero

After descriptor validation, no code path executes a Proxy `get` trap. All values are consumed from the captured descriptor snapshot. This is verified by tests that install throwing `get` traps on rows, row arrays, and append evidence rows, and assert zero `get` trap calls.

### Descriptor/value TOCTOU fail-closed

If a descriptor trap or `ownKeys` trap throws, or if a Proxy is revoked, the snapshot yields `undefined` and the adapter fails closed (read error or UNKNOWN). A descriptor that returns a different value on repeated access is consumed only from the first capture.

## Sanitization

Adapter return values and the fixed read error never contain a raw `Error`, raw message/stack, raw `QueryResult`, raw row reference, `lockHandle`, session/client, query function, release function, hostname, database name, URL, credential, `DATABASE_URL`, operator identity, or prohibited ledger fields. No console logging.

## No actual DB boundary

This contract performs no database connection, no `pg` import, no actual query execution, no real ledger read, and no real ledger write. All query behavior is supplied by synthetic injected mocks.

## Canonical inventory engine vocabulary

The adapter is registered in `docs/architecture/db-schema-change-inventory.json` under the canonical engine vocabulary with `"engine": "postgres"`, matching every other PostgreSQL schema-change path in the inventory. The synonym `postgresql` is **not** reintroduced and no synonym enum expansion is introduced.

## Remaining adapters / work

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
