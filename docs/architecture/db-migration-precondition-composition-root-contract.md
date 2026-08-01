# DB Migration Precondition Composition Root Contract

Source-tested composition root contract for Issue #3809 (Step 6 of the migration-precondition authority sequence under #3657 and #3458). This child wires the already-merged authorities into one frozen orchestrator-facing dependency surface without changing any of them. It does not authorize Step 7 disposable PostgreSQL rehearsal or Step 8 environment adoption.

## 1. Status and exact source baseline

```text
Status:      DRAFT implementation contract — pending Web CTO review
Baseline:    origin/main 1c08808fcb25acda50518b404caf50b5006588bd
Branch:      feat/migration-precondition-composition-root-3657
Issue:       #3809 — Compose migration precondition authority into canonical runner dependencies
Parents:     #3657 (Keep OPEN), #3458 (Keep OPEN)
Completed:   Steps 1–5 (authority contract, registry/source validation, readonly query catalog,
             loader-resolver, evaluatePrecondition adapter)
Implemented: Step 6 composition root (THIS child)
Not authorized: Step 7 disposable PostgreSQL rehearsal, Step 8 environment adoption
```

Composed authorities (unchanged): `createMigrationPreconditionAuthorityResolver` (loader-resolver core), `createPostgresMigrationSessionLockAdapter` (pinned-session lock adapter core), `createMigrationPreconditionEvaluatorAdapter` (evaluator core). The orchestrator dependency boundary (`runCanonicalMigration`) consumes the four returned functions.

## 2. Scope and evidence limits

- Scope: implement and source-test one composition root that instantiates one resolver, one pinned-session lock adapter, and one evaluator, and returns the exact frozen orchestrator-facing dependency subset.
- Limits: no database, Docker/PostgreSQL, network, SQL execution, Production, provider, credential, environment, package, workflow, or UI change. No modification of any committed authority, registry, catalog, manifest, or ledger adapter. Browser/Playwright validation is not required.
- The committed authorities remain `ADOPTION_REQUIRED` and empty; the composition root therefore evaluates the current authority to `NOT_EVALUATED` and can never implicitly `PASS`.

## 3. Factory and public surface

```js
createMigrationPreconditionCompositionRoot({
  openSession,                    // required callable own data property
  authorityResolverFactory        // optional bounded construction-time test seam
})
  -> Object.freeze({
       acquireAdvisoryLock,       // lock-adapter instance
       evaluatePrecondition,      // evaluator wired with the SAME lock-adapter broker
       checkAdvisoryLock,         // lock-adapter instance
       releaseAdvisoryLock        // lock-adapter instance
     })
```

- The factory and the returned surface are frozen.
- Config is a plain data record whose own enumerable data keys are drawn from `{ openSession, authorityResolverFactory }`; `openSession` is required and callable. Malformed, accessor, inherited, symbol, non-enumerable, Proxy, and revoked-Proxy config fails closed with one bounded factory error `MIGRATION_PRECONDITION_COMPOSITION_ROOT_CONFIG_INVALID`; getters are never invoked.
- The default resolver is the fixed repository authority resolver, constructed exactly once. The optional `authorityResolverFactory` is the documented bounded construction-time test seam that returns a plain `{ resolvePreconditionAuthority }` surface so synthetic ACTIVE authority evidence can exercise the composed pinned-session broker. It never lets a runtime caller select authority paths or SQL.
- Public surface exposure is limited to the four orchestrator-facing functions. `queryLockedSession`, the raw resolver, sessions, lock handles, SQL, provider state, authority file contents, and internal configuration are never exposed.

## 4. Composition guarantees

1. One resolver from the fixed repository authority (or the bounded test seam).
2. One pinned-session lock adapter constructed from the injected `openSession` boundary.
3. The evaluator receives `queryLockedSession` from the **same lock-adapter instance** that supplies `acquireAdvisoryLock`, `checkAdvisoryLock`, and `releaseAdvisoryLock`.
4. The exact frozen orchestrator-facing dependency subset is returned.
5. Opaque lock-handle identity is preserved across acquire → evaluate → check → release.
6. Malformed factory config and malformed component surfaces fail closed before any session/query use.
7. The current inactive authority is `ADOPTION_REQUIRED` and therefore evaluates to `NOT_EVALUATED`, never implicit `PASS`.
8. No composition path creates a second lock-adapter instance for the evaluator broker (exactly one `createPostgresMigrationSessionLockAdapter` call; the evaluator broker is read from that instance).
9. No raw errors, session objects, handles, paths, or authority contents are returned or logged.
10. No retry, timeout, sleep, network, driver, environment fallback, or caller-selected authority path is added.

## 5. Cross-instance and substituted-wiring detection

- A lock handle produced by a different lock-adapter instance is not present in the composed adapter's handle registry and is therefore rejected by the composed `evaluatePrecondition` broker (`UNAVAILABLE`).
- The source-level single-instantiation guarantee means no second lock adapter can be created for the evaluator broker; a mutation that wires a second adapter breaks the same-instance test.

## 6. Inactive authority behavior

The default composition root uses the fixed repository resolver. Because the committed precondition registry is `ADOPTION_REQUIRED` (inactive), `evaluatePrecondition({ targetMigrationId, lockHandle })` returns `NOT_EVALUATED` with zero precondition broker queries. `PASS` is never an automatic default.

## 7. Files changed by this child

The cumulative PR diff is exactly the authorized eight files:

```text
scripts/migration-precondition-composition-root-core.cjs            (new composition root)
tests/contracts/db-migration-precondition-composition-root-contract.test.cjs (new source/fake contract)
docs/architecture/db-migration-precondition-composition-root-contract.md   (this document)
tests/test-layer-classification.json                                 (register new contract as SOURCE_STATIC)
docs/architecture/DB_MIGRATION_PROVENANCE_NEXT_CHILD_DECISION.md     (Steps 1-6 complete, Step 7 selected not implemented, Step 8 not authorized)
docs/architecture/db-schema-change-inventory.json                    (one new source-only adapter entry)
tests/contracts/ci-test-group-registry-contract.test.cjs             (deterministic test-layer count literal reconciliation only)
tests/contracts/cloudflare-supplied-url-smoke-contract.test.cjs      (deterministic test-layer count literal reconciliation only)
```

The two guard files are a deterministic test-layer count literal reconciliation only:

```text
default_total     783 -> 784
SOURCE_STATIC     574 -> 575
EXECUTED_FAKE     189 unchanged
EXECUTED_REAL_LOCAL 20 unchanged
no counting logic change
no Cloudflare smoke runtime/route/package/workflow behavior change
```

## 8. Explicit non-actions

```text
no modification of the resolver, evaluator, lock adapter, orchestrator, protocol, registry, catalog,
  manifest, or ledger adapter
no database, Docker/PostgreSQL, SQL execution, Production, provider, credential, secret, or environment access
no package, workflow, API, Auth, UI, CSS, or deployment change
no Ready transition, merge, or Issue closure
no modification of open PR #3780/#3787/#3801 or their branches/worktrees
no reset, clean, stash, rebase, amend, force push, or history rewrite
```

## 9. Rollback

- This child is additive (one new composition root, one new contract, one new doc, three bounded authority-file updates, and two deterministic count-literal guard reconciliations). Removing the eight-file cumulative change restores the prior state; no runtime behavior changes because the authorities remain inactive.

Refs #3809.
Refs #3802 — completed Step 5.
Refs #3657 — Keep OPEN.
Refs #3458 — Keep OPEN.
Refs #3425 — Keep OPEN.
Refs #3435 — Keep OPEN.
Refs #3437 — Keep OPEN.
Refs #1882 — Keep OPEN.
