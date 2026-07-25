# LoveBud DB Migration Provenance Next-Child Decision

## Decision summary

| Field | Value |
| --- | --- |
| Decision issue | #3644 |
| Parent issue | #3458 |
| Baseline `main` | `eb030c1d4751dfee45d65f5a420caebebac6ebcc` |
| Outcome | `SAFE_IMPLEMENTATION_CHILD_SELECTED` |
| Selected child | Source-tested pinned-session query broker |
| Production access | None |
| Database access | None |
| SQL execution | None |
| Test layer | `SOURCE_STATIC` |

The previous decision `NO_SAFE_IMPLEMENTATION_CHILD_WITHOUT_OPERATOR_INPUT` is superseded for next-child selection. Operator input still blocks Production-readonly catalog collection, but it does not block the repository-side composition work selected here.

## Why the previous decision changed

The previous dependency map predates these merged capabilities:

- canonical runner protocol;
- canonical runner orchestrator;
- PostgreSQL pinned-session advisory-lock adapter;
- PostgreSQL ledger read/append adapter;
- adoption operator checklist;
- CI infrastructure-unavailable governance.

The repository therefore has a new concrete composition gap that can be addressed without credentials or Production access.

## Verified current incompatibility

### Lock adapter

`createPostgresMigrationSessionLockAdapter` owns the pinned session in closure-private state and returns only:

```js
{
  acquireAdvisoryLock,
  checkAdvisoryLock,
  releaseAdvisoryLock
}
```

On successful acquisition, the opaque handle maps internally to:

```js
{ session, query, release, lifecycle: 'OPEN' }
```

The captured query callable is available only inside the lock-adapter closure.

### Ledger adapter

`createPostgresMigrationLedgerAdapter` requires this injected boundary:

```js
queryLockedSession({ lockHandle, query })
```

The ledger adapter intentionally does not inspect the handle or own a session. It forwards the handle and fixed query to the injected broker.

### Result

The two adapters cannot currently be composed while preserving the same-session requirement. Supplying an unrelated query function would not prove that the ledger read or append ran on the session holding the advisory lock.

This is the first missing bridge after the merged lock and ledger adapter slices.

---

## Selected next child

### Proposed issue title

`[Architecture][DB] Add a pinned-session query broker for migration adapters`

### Objective

Extend the PostgreSQL migration session-lock adapter with a source-tested method:

```js
queryLockedSession({ lockHandle, query })
```

The method must execute the supplied repository query through the exact query callable and session captured when the same adapter instance acquired the advisory lock.

This is a source contract only. The injected `openSession` remains synthetic. The child must not add `pg`, create a pool, connect to PostgreSQL, execute real SQL, or wire Production.

## Required public surface

The adapter factory should return a frozen object with exactly:

```js
{
  acquireAdvisoryLock,
  checkAdvisoryLock,
  queryLockedSession,
  releaseAdvisoryLock
}
```

Existing acquire/check/release behavior must remain unchanged.

## Required broker behavior

### Handle and lifecycle

`queryLockedSession` must:

1. read `lockHandle` as an own data property without executing accessors;
2. require that the handle belongs to the same adapter instance;
3. require lifecycle exactly `OPEN`;
4. reject invalid, cross-adapter, releasing, or released handles without invoking a query;
5. never expose or serialize the handle state.

### Query boundary

The broker must:

1. read `query` as an own data property without executing an accessor;
2. require a safe repository query object rather than a function or primitive;
3. use only the session query callable captured at session validation time;
4. invoke that callable exactly once with the exact validated query snapshot or exact trusted query object defined by the contract;
5. call it with the captured session as `this`;
6. return the raw query result only to the consuming adapter;
7. never log, clone, summarize, or expose raw result content elsewhere.

The implementation must define a precise fail-closed query-object contract. It must not dynamically interpolate identifiers, credentials, URLs, operator values, or raw caller data.

### Failure mapping

Any invalid input, invalid/cross-adapter/released handle, query inspection failure, Proxy trap failure, or underlying query throw/rejection must reject with exactly one fixed sanitized error message:

```text
POSTGRES_LOCKED_SESSION_QUERY_UNAVAILABLE
```

The raw error, message, stack, session, query callable, release callable, URL, hostname, database name, backend PID, credential, or row data must not be exposed.

A broker failure must not release the session. Release ownership remains exclusively with `releaseAdvisoryLock`, preserving exactly-once pool release.

### Concurrency and lifecycle interaction

The contract must define and test:

- query while lifecycle is `OPEN`;
- query after release begins;
- query after release completes;
- repeated broker calls while open;
- underlying query throw without implicit release;
- release after a broker failure;
- no session/query/release callable re-inspection after acquisition;
- cross-adapter handle rejection;
- hostile Proxy/accessor input handling.

The child must remain fail-closed and must not invent transaction, retry, timeout, cancellation, or multi-session behavior.

---

## Exact allowed files

1. `scripts/migration-postgres-session-lock-adapter-core.cjs`
2. `tests/contracts/db-postgres-session-lock-adapter-contract.test.cjs`
3. `docs/architecture/db-postgres-session-lock-adapter-contract.md`
4. `docs/architecture/db-postgres-ledger-adapter-contract.md` — minimal wiring clarification only

No new test file is required. The existing session-lock contract test remains classified as `SOURCE_STATIC`, so `tests/test-layer-classification.json` must not change unless current source evidence proves an existing registration defect.

## Prohibited files and areas

- `package.json` and `package-lock.json`;
- `.github/**`;
- `db/migration-provenance/**`;
- `db/migrations/**`;
- SQL and rollback artifacts;
- Production-readonly collection runners;
- orchestrator and protocol implementation files;
- product, API, UI, Auth, CSS, and Cloudflare files;
- secrets, environment configuration, provider settings, and repository visibility;
- any unrelated test or documentation file.

## Explicit non-goals

The child does not:

- import or install `pg`;
- create a pool or real `openSession` implementation;
- connect to a database;
- execute SQL against PostgreSQL;
- create or bootstrap `schema_migration_ledger`;
- activate `canonical-migrations.json`;
- add canonical migrations;
- implement source validation, manifest loading, preconditions, execution, or postconditions;
- compose the full orchestrator dependency set;
- add disposable PostgreSQL rehearsal;
- perform Production adoption or deployment integration.

## Acceptance criteria

1. The adapter exposes `queryLockedSession` together with the existing three methods.
2. A valid same-instance open handle executes through the exact captured session query callable.
3. The ledger adapter's fixed read and append query objects can be forwarded without inspecting the opaque handle.
4. Invalid/cross-adapter/releasing/released handles execute zero broker queries.
5. Broker failure never implicitly unlocks or pool-releases the session.
6. Final `releaseAdvisoryLock` still performs the existing exactly-once unlock and pool-release behavior.
7. No callable is re-read from the mutable session after acquisition.
8. Accessor and Proxy traps do not leak raw errors or execute untrusted getters.
9. Every broker failure uses the fixed sanitized error `POSTGRES_LOCKED_SESSION_QUERY_UNAVAILABLE`.
10. Existing acquire/check/release tests remain passing.
11. Focused source-static contract tests cover valid forwarding, lifecycle boundaries, failures, sanitization, and exact call counts.
12. Only the four allowed files change.
13. No database, Docker, PostgreSQL, Production, provider, secret, manifest, or SQL operation occurs.

## Verification requirements

Required evidence is proportional to this source-only child:

```text
node --check scripts/migration-postgres-session-lock-adapter-core.cjs
node --check tests/contracts/db-postgres-session-lock-adapter-contract.test.cjs
node --test tests/contracts/db-postgres-session-lock-adapter-contract.test.cjs
```

Also run the directly related ledger adapter contract because the child documents and enables its injected boundary:

```text
node --test tests/contracts/db-postgres-ledger-adapter-contract.test.cjs
```

Run repository static lint/build commands when the current local dependency environment supports them. Do not start Docker or PostgreSQL solely to imitate unrelated CI jobs.

If GitHub Actions creates job shells with zero executed steps because private-repository credits remain exhausted, classify it as `CI_UNAVAILABLE_INFRA` under the canonical policy. A real executed test failure remains `CI_EXECUTED_FAILURE` and blocks merge.

## Rollback and forward-fix posture

This is a source-only adapter extension.

- Rollback: revert the child PR.
- Database rollback: not applicable.
- Production rollback: not applicable.
- Forward fix: a later narrow contract correction.

No database or runtime state is created by this child.

## Completion boundary

The child is complete when:

1. the source-tested broker exists on the same adapter instance as the pinned-session handle state;
2. the broker safely executes ledger query objects through the exact captured session query callable;
3. lifecycle and sanitization contracts pass focused tests;
4. existing lock and ledger adapter contracts remain intact;
5. the remote diff contains only allowed files;
6. the PR records exact head evidence and CI classification;
7. #3458 and all protected issues remain open.

---

## Work that remains after the selected child

After the broker is merged, the next-state audit should consider, in dependency order:

1. source-validation and manifest-loading adapters;
2. precondition, execution, and postcondition adapters;
3. a source-tested dependency composition root;
4. disposable PostgreSQL rehearsal of the composed runner;
5. clean-database reconstruction;
6. Phase B target-readonly collection when operator inputs and approval exist;
7. Phase C/D adoption decisions;
8. separately approved ledger bootstrap and canonical stream;
9. deployment enforcement and sanitized observability;
10. legacy migration-path retirement.

This decision does not claim those later children are approved or ready.

## Decision completion statement

This decision was produced from repository and GitHub evidence only. No database connection was opened, no SQL was executed, no Docker/PostgreSQL process was started, no Production or provider environment was accessed, no secret was inspected, and no manifest or runtime state was changed.

---

## Precondition authority child (#3657)

### Authority gap

Issue #3657 identified a `BLOCKED_PRECONDITION_AUTHORITY_MISSING` gap: no canonical precondition registry, no query reference authority, no SQL query catalog, no target migration precondition binding, and no raw evidence to status mapping contract existed.

| Field | Value |
| --- | --- |
| Baseline `main` | `b4cbefddbf1ae13540eaaf07dc74fac8b5823c43` |
| Authority gap | `BLOCKED_PRECONDITION_AUTHORITY_MISSING` |
| Resolution scope | design-contract authority only |
| Adapter implementation ready | **NO** — adapter remains not implemented |
| Registry status | `ADOPTION_REQUIRED` |
| Registry entries | `[]` (empty) |
| Query catalog | **not yet defined** |
| SQL content | **none** — registry stores query_reference only |

### What this child resolves

This child establishes the repository authority boundary for migration preconditions:

- fixed precondition registry path and initial inactive shape
- migration ID to precondition set binding rules
- registry query-reference boundary (SQL separated from registry)
- strict evidence contract (BOOLEAN_SINGLE_ROW only for now)
- PASS/FAIL/UNAVAILABLE/NOT_EVALUATED status mapping
- multi-check precedence (UNAVAILABLE > FAIL > PASS)
- no-precondition semantics (no precondition = NOT_EVALUATED, never PASS)
- prohibited behaviors list
- future implementation sequence

### What this child does NOT resolve

- The `evaluatePrecondition` adapter is **not** implemented.
- The read-only SQL query catalog is **not** created.
- No SQL query, adapter, DB connection, or registry entry is added.
- No canonical manifest, manifest adapter, orchestrator, protocol, lock adapter, or ledger adapter is changed.
- No Production mutation occurs.

### Selected next child

```text
registry validator + source-validation integration
```

- **Not** the `evaluatePrecondition` adapter.
- **Not** the fixed query catalog.
- Will add a precondition registry validator as a fixed source input to the existing source-validation adapter.
- The registry validator validates schema, migration ID cross-binding, duplicate detection, and query_reference format.
- Source validation does **not** call `evaluatePrecondition` or execute runtime queries.
- SQL and query catalog remain absent in the next child as well.
- **A new issue number is required** (not #3650 or #3652 — those are prior completed dependencies).

### Prior completed dependencies

- #3650 — Source-validation adapter.
- #3652 / PR #3653 — Canonical manifest loader adapter.
- #3646 — Pinned-session query broker.

### Protected issues

Refs #3657 — Migration precondition authority (Keep OPEN).
Refs #3650 — Source-validation adapter (prior completed).
Refs #3652 — Canonical manifest loader adapter (prior completed).
Refs #3646 — Pinned-session query broker (prior completed).
Refs #3458 — Keep #3458 OPEN.
Refs #3425 — Keep #3425 OPEN.
Refs #3435 — Keep #3435 OPEN.
Refs #3437 — Keep #3437 OPEN.
Refs #1882 — Keep #1882 OPEN.
