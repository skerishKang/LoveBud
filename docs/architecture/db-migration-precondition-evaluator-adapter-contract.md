# DB Migration Precondition Evaluator Adapter Contract

Source-tested dependency-injected adapter contract for Issue #3802 (Step 5 of the migration-precondition authority sequence under #3657 and #3458). This child implements the fail-closed `evaluatePrecondition` adapter that converts the already-resolved fixed source authority into the canonical runtime migration-gate precondition status. It does not implement the composition root, PostgreSQL rehearsal, or environment adoption.

## 1. Status and exact source baseline

```text
Status:      DRAFT implementation contract — pending Web CTO review
Baseline:    origin/main dbe74ca1c4bca66c897efadd3972c9b3839ff94d
Branch:      feat/migration-precondition-evaluator-3657-c1-fresh
Issue:       #3802 — Implement the fail-closed evaluatePrecondition adapter
Parents:     #3657 (Keep OPEN), #3458 (Keep OPEN)
Completed:   Step 1 precondition authority contract (#3659 era)
             Step 2 registry validator + source validation (#3659)
             Step 3 fixed read-only query catalog contract (#3669)
             Step 4 fixed registry/catalog loader-resolver (#3678)
Implemented: Step 5 evaluatePrecondition adapter (THIS child)
Not authorized: Step 6 composition root, Step 7 disposable PostgreSQL rehearsal, Step 8 environment adoption
```

Authorities (unchanged): `db-migration-precondition-authority-contract.md`, `db-migration-precondition-authority-loader-resolver-contract.md`, `db-migration-readonly-query-catalog-contract.md`, `db-postgres-session-lock-adapter-contract.md`, `DB_MIGRATION_PROVENANCE_NEXT_CHILD_DECISION.md`, and the fixed committed `db/migration-provenance/*` authorities (kept `ADOPTION_REQUIRED` and inactive; catalog population is distinct from runner activation).

## 2. Scope and evidence limits

- Scope: implement and source-test one dependency-injected adapter with the exact public surface `createMigrationPreconditionEvaluatorAdapter({ resolvePreconditionAuthority, queryLockedSession })` returning the frozen surface `{ evaluatePrecondition }`.
- The adapter owns the registry/catalog/SQL/manifest/lock/database/orchestration in no way. It consumes only the two injected dependencies.
- Limits: no database, Docker/PostgreSQL, network, SQL execution, Production, provider, credential, environment, package, workflow, or UI change. No modification or activation of any committed authority. Browser/Playwright validation is not required.
- Committed authorities remain `ADOPTION_REQUIRED` and inactive (two manifests are catalog-populated). The evaluator therefore cannot execute a real query in this child; its behavior is proven with synthetic fixtures.

## 3. Factory and public surface

```js
createMigrationPreconditionEvaluatorAdapter({
  resolvePreconditionAuthority,   // required callable own data property
  queryLockedSession              // required callable own data property
})
  -> Object.freeze({ evaluatePrecondition })
```

- The factory configuration is an exact plain data record containing only those two keys. Both must be callable own data properties.
- The factory and the returned adapter surface are frozen.
- No caller-selected path, registry, catalog, query, SQL, status override, logger, retry, timeout, or environment fallback may be supplied.

### Method envelope

```js
evaluatePrecondition({ targetMigrationId, lockHandle })
  -> Promise<{ status: 'PASS' | 'FAIL' | 'UNAVAILABLE' | 'NOT_EVALUATED' }>
```

- Input must have exactly two enumerable own data keys: `targetMigrationId` and `lockHandle`.
- `targetMigrationId` must match the canonical migration-ID grammar `/^\d{14}_[a-z0-9]+(?:-[a-z0-9]+)*$/`.
- `lockHandle` is forwarded to the broker by exact identity. It is never inspected, cloned, serialized, or released.
- Malformed, primitive, array, missing-key, extra-key, inherited-key, accessor, Proxy, or revoked-Proxy input returns `UNAVAILABLE` without invoking either dependency. Getters are never invoked.

### Result records

Every returned value is a plain record (prototype `Object.prototype`), frozen, with exactly one enumerable own key: `status`. No raw evidence, raw error, SQL row, lock handle, migration ID, or console output is ever exposed.

## 4. Resolver status mapping

`resolvePreconditionAuthority({ targetMigrationId })` results map as follows:

```text
{ status: 'ADOPTION_REQUIRED' }  -> NOT_EVALUATED  (broker calls 0)
{ status: 'NOT_FOUND' }          -> NOT_EVALUATED  (broker calls 0)
{ status: 'UNAVAILABLE' }        -> UNAVAILABLE    (broker calls 0)
throw / rejection                -> UNAVAILABLE
malformed result                 -> UNAVAILABLE
{ status: 'RESOLVED', checks: [] } -> NOT_EVALUATED (broker calls 0; defensive fallback)
{ status: 'RESOLVED', checks: [...] } -> evaluate each check (broker per check)
unknown status value             -> UNAVAILABLE
```

Absolute rules:

```text
no precondition != PASS
inactive authority != PASS
empty checks != PASS
PASS is never an automatic default
```

## 5. Resolved check contract

A resolved check is the fixed detached authority shape:

```js
{
  checkId,                          // non-empty kebab-case string
  expected,                         // boolean
  query: {
    name,                           // non-empty string
    text,                           // non-empty string
    values,                         // dense array of primitives (string/number/boolean/null)
    resultContract: {
      kind: 'BOOLEAN_SINGLE_ROW',   // only this kind is interpreted
      field                          // non-empty string
    }
  }
}
```

The entire `checks` array and every check/query/resultContract are validated and snapshotted (detached + frozen) before the first broker call. A malformed later check therefore can never cause partial execution of earlier checks.

## 6. Broker invocation

Each check executes through:

```js
queryLockedSession({ lockHandle, query: { name, text, values } })
```

Requirements:

- the exact opaque `lockHandle` identity is forwarded unchanged (no inspect, clone, serialize, or release);
- `resultContract` is never forwarded to the broker;
- the `query` object is an exact three-key record `{ name, text, values }`, detached and frozen;
- registry check order is preserved;
- no retry, sleep, timeout, or parallel query execution.

## 7. `BOOLEAN_SINGLE_ROW` interpretation

Valid evidence:

```text
result is a plain record
result.rows is a dense array
exactly one row
row is a plain record with prototype Object.prototype
row has exactly one enumerable own string key equal to resultContract.field
no own symbol keys and no extra non-enumerable own keys
field is an own data property
field value is a boolean
```

Top-level PostgreSQL result metadata may be present and is ignored. Raw rows or metadata are never returned or logged.

Malformed → `UNAVAILABLE` (check level):

```text
zero rows; multiple rows; sparse rows
missing field; extra field; accessor field; inherited field; symbol key
null; non-boolean; custom prototype; Proxy row; revoked Proxy row
unknown result kind; broker throw/rejection; non-record broker result
```

A valid boolean equal to `expected` makes the check PASS; a valid boolean that differs makes the check FAIL.

## 8. Multi-check precedence

```text
one or more UNAVAILABLE           -> final UNAVAILABLE
otherwise one or more FAIL        -> final FAIL
all non-empty checks match        -> final PASS
```

Execution rules:

- a confirmed FAIL does not short-circuit the remaining checks, because a later UNAVAILABLE has higher precedence;
- once UNAVAILABLE is established, later checks need not execute (they are skipped).

## 9. Call-envelope and dependency hardening

- The factory configuration is an exact two-key plain record; both dependencies are callable own data properties. A malformed configuration throws one bounded factory error `MIGRATION_PRECONDITION_EVALUATOR_CONFIG_INVALID`.
- The `evaluatePrecondition` input envelope is validated before any dependency call. Accessors, inherited keys, extra keys, missing keys, Proxy, and revoked Proxy inputs never invoke a dependency and never run a getter.
- Sync returns, native Promise resolutions, throws, and rejections are handled without thenable assimilation and without raw error exposure. Non-native thenables, Proxy Promises, and hostile returns fail closed as `UNAVAILABLE`.
- No retry, timeout, sleep, database driver, network, child process, Docker, PostgreSQL, Production, provider, or environment access exists in the adapter source.

## 10. Dependency contract compatibility

The returned statuses (`PASS`, `FAIL`, `UNAVAILABLE`, `NOT_EVALUATED`) are exactly the orchestrator precondition-condition status vocabulary (`CONDITION_STATUSES` in `scripts/migration-runner-orchestrator-core.cjs`). No orchestrator modification is needed.

## 11. Files changed by this child

The cumulative PR diff is exactly the authorized eight files:

```text
scripts/migration-precondition-evaluator-adapter-core.cjs            (new adapter core)
tests/contracts/db-migration-precondition-evaluator-adapter-contract.test.cjs (new source/fake contract)
docs/architecture/db-migration-precondition-evaluator-adapter-contract.md   (this document)
tests/test-layer-classification.json                                 (register new contract as SOURCE_STATIC)
docs/architecture/DB_MIGRATION_PROVENANCE_NEXT_CHILD_DECISION.md     (Steps 1-5 complete, Step 6 selected not implemented, Steps 7-8 not authorized)
docs/architecture/db-schema-change-inventory.json                    (one new source-only adapter entry)
tests/contracts/ci-test-group-registry-contract.test.cjs             (deterministic test-layer count literal reconciliation only)
tests/contracts/cloudflare-supplied-url-smoke-contract.test.cjs      (deterministic test-layer count literal reconciliation only)
```

The two guard files are a deterministic test-layer count literal reconciliation only:

```text
default_total     782 -> 783
SOURCE_STATIC     573 -> 574
EXECUTED_FAKE     189 unchanged
EXECUTED_REAL_LOCAL 20 unchanged
no counting logic change
no Cloudflare smoke runtime/route/package/workflow behavior change
```

## 12. Explicit non-actions

```text
no modification or activation of any committed registry/catalog/manifest authority
no composition root; no PostgreSQL rehearsal; no environment adoption
no database, Docker/PostgreSQL, Production, provider, credential, secret, or environment access
no package, workflow, API, Auth, UI, CSS, or deployment change
no Ready transition, merge, or Issue closure
no modification of open PR #3780/#3787/#3801 or their branches/worktrees
no reset, clean, stash, rebase, amend, force push, or history rewrite
```

## 13. Rollback

- This child is additive (one new adapter core, one new contract, one new doc, three bounded authority-file updates, and two deterministic count-literal guard reconciliations). Removing the eight-file cumulative change restores the prior state; no runtime behavior changes because the authorities remain inactive.

Refs #3802.
Refs #3657 — Keep OPEN.
Refs #3678 — completed Step 4.
Refs #3669 — completed Step 3.
Refs #3659 — completed Step 2.
Refs #3458 — Keep OPEN.
Refs #3425 — Keep OPEN.
Refs #3435 — Keep OPEN.
Refs #3437 — Keep OPEN.
Refs #1882 — Keep OPEN.
