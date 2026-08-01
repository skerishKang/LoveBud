# DB Precondition Composition Root PostgreSQL Rehearsal Contract

CI-only disposable PostgreSQL rehearsal contract for Issue #3816 (Step 7, the final child of #3657). Proves that the already-merged migration precondition composition root and orchestrator-facing dependency surface behave correctly against a real pinned PostgreSQL 17.4 engine. This child does not adopt Step 8 environment adoption and does not create or approve Step 8 SQL.

## 1. Status and exact source baseline

```text
Status:      DRAFT implementation contract — pending Web CTO review
Baseline:    origin/main 2f78851caeaedc1c58490a0b4b6fd87d62a661cb
Branch:      feat/precondition-composition-root-postgres-rehearsal-3657
Issue:       #3816 — Rehearse composed precondition boundary on disposable PostgreSQL
Parents:     #3657 (final child; Keep OPEN until merge), #3458 (Keep OPEN)
Completed:   Steps 1–6 (authority, validation, catalog, loader-resolver, evaluator, composition root)
Implemented: Step 7 disposable PostgreSQL rehearsal (THIS child)
Not authorized: Step 8 environment adoption (separate future child under #3458)
```

Composed authorities (unchanged): `createMigrationPreconditionCompositionRoot`, `createPostgresMigrationSessionLockAdapter`, `createMigrationPreconditionEvaluatorAdapter`, `runCanonicalMigration` + the runner protocol. None are modified by this child.

## 2. Scope and evidence limits

- Scope: one CI-only DB-engine test that executes the merged composition root against a disposable `postgres:17.4-bookworm` engine via the existing `tests/db-engine/helpers/postgres-disposable-harness.cjs`, plus a source-static contract that locks the rehearsal boundary.
- The real-engine result is authoritative only in the fresh exact-head GitHub Actions job (`db-engine-precondition-composition-root`). Local source/static tests may run; the DB-engine test itself is never executed locally (no local Docker, local/WSL PostgreSQL, Production, Preview, Neon, Modal, provider, or `DATABASE_URL`).
- Permitted SQL: canonical advisory-lock acquire/check/release queries (invoked by the merged lock adapter), fixed synthetic boolean `SELECT` evidence, and bounded read-only residual-lock verification. No DDL, DML, migration, ledger, schema, extension, role, GRANT/REVOKE, or runtime-composed SQL. No test approves SQL for Step 8 adoption.

## 3. Execution environment (GitHub Actions only)

```text
service image: postgres:17.4-bookworm
server_version_num: 170004 (exact assertion)
host: loopback only (LB_TEST_PGHOST=127.0.0.1)
user/database prefix: lovebud_ci*
credentials: synthetic job-derived values only
env: LB_TEST_PGHOST / LB_TEST_PGPORT / LB_TEST_PGUSER / LB_TEST_PGPASSWORD / LB_TEST_PGADMIN_DB
```

The CI job mirrors the existing disposable PostgreSQL jobs: `ubuntu-latest`, `timeout-minutes: 15`, `postgres:17.4-bookworm` service, `npm ci`, PostgreSQL client install, `SHOW server_version_num` = `170004`, and runs only `npm run test:db-engine:precondition-composition-root`.

## 4. Session wrapper contract

The real `openSession` supplied to the composition root returns a **plain record with own callable data properties**:

```js
{
  query: async function (queryObject) { /* dedicated pg.Client delegation */ },
  release: async function () { /* dedicated client.end() exactly once */ }
}
```

- Each advisory-lock acquire uses a dedicated `pg.Client` connected only via the harness loopback `LB_TEST_PG*` configuration.
- The raw `pg.Client` is never returned directly (its methods are prototype-inherited and do not satisfy the lock-adapter own-callable contract).
- No connection pool sharing, no raw client exposure, no client-config/credential output, no `DATABASE_URL` read, no host/database/user output, no backend PID output, no query-result output.

## 5. Required real-engine scenarios

- **R1 — committed inactive authority**: `acquire -> ACQUIRED`, `evaluate -> NOT_EVALUATED`, `check -> ACQUIRED`, `release -> RELEASED`; zero precondition broker queries; `ADOPTION_REQUIRED` never maps to `PASS`.
- **R2 — synthetic ACTIVE same-session PASS**: the construction-time `authorityResolverFactory` seam (only) supplies an ACTIVE check using the canonical advisory-lock check query + boolean `held` result contract; `acquire -> ACQUIRED`, `evaluate -> PASS` (proves the evaluator broker is the same pinned session), `check -> ACQUIRED`, `release -> RELEASED`.
- **R3 — synthetic bounded FAIL**: a fixed `SELECT FALSE AS satisfied` check yields `evaluate -> FAIL`; orchestrator outcome `BLOCKED_BEFORE_EXECUTION`, `executeMigration` 0, `appendLedgerRecord` 0, release completed.
- **R4 — committed authority orchestrator fail-closed**: the four real composition-root methods compose into `runCanonicalMigration`; outcome `BLOCKED_BEFORE_EXECUTION`, blocker `RUNNER_PRECONDITION_NOT_EVALUATED`, `executionAttempted` false, `executeMigration` 0, `appendLedgerRecord` 0, `lockReleased` true.
- **R5 — real contention**: two composition roots on the same disposable DB; A `ACQUIRED`, B `FAILED` while A holds, A check `ACQUIRED`, A release `RELEASED`, B fresh acquire `ACQUIRED`, B release `RELEASED`; each acquire uses a dedicated session.
- **R6 — invalid lifecycle**: cross-instance handle `evaluate -> UNAVAILABLE`, released handle `evaluate -> UNAVAILABLE`, repeated release `-> UNKNOWN`; rejected paths perform zero additional queries and zero additional session releases.
- **R7 — cleanup**: dedicated session release counts exact; no residual advisory lock with the canonical keys; disposable DB dropped by the harness; global cleanup errors 0; no raw output.

## 6. SQL boundary

Permitted: canonical advisory-lock acquire/check/release (merged adapter), fixed synthetic boolean `SELECT` evidence, bounded read-only residual-lock verification, harness-owned disposable DB create/drop. Forbidden: target-DB DDL, DML, migration SQL, ledger writes, schema/extension/role creation, GRANT/REVOKE, Production catalog inspection, runtime-composed SQL.

## 7. Files changed by this child

The cumulative PR diff is exactly the authorized ten files (Web CTO scope amendment `#issuecomment-5151391639`; original nine files plus the deterministic reporter registry file):

```text
A tests/db-engine/precondition-composition-root-postgres.test.cjs            (CI-only DB-engine rehearsal)
A tests/contracts/db-precondition-composition-root-postgres-rehearsal-contract.test.cjs (source-static contract)
A docs/architecture/db-precondition-composition-root-postgres-rehearsal-contract.md   (this document)
M package.json                                                               (one new script)
M .github/workflows/ci.yml                                                   (one new job)
M tests/test-layer-classification.json                                       (register source-static + supplemental DB entries)
M docs/architecture/DB_MIGRATION_PROVENANCE_NEXT_CHILD_DECISION.md           (Steps 1-7 complete, Step 8 unauthorized)
M tests/contracts/ci-test-group-registry-contract.test.cjs                   (supplemental script/job + count literal reconciliation)
M tests/contracts/cloudflare-supplied-url-smoke-contract.test.cjs            (count literal reconciliation)
M scripts/report-ci-test-groups.cjs                                          (one exact EXPECTED_DB_ENGINE_SCRIPTS pair only)
```

No eleventh file. The reporter change is exactly one script/target registry pair:

```js
{ script: 'test:db-engine:precondition-composition-root', target: 'tests/db-engine/precondition-composition-root-postgres.test.cjs' }
```

with no reporter logic, schema, validation, or error-code change, and no change to existing registry pairs. The guard contracts change only to register the supplemental DB-engine script/job and reconcile deterministic default-test count literals caused by the new source-static contract:

```text
default_total     784 -> 785
SOURCE_STATIC     575 -> 576
EXECUTED_FAKE     189 unchanged
EXECUTED_REAL_LOCAL 20 unchanged
```

`scripts/report-ci-test-groups.cjs` is a supplemental DB-engine registration and does not increase the default test count further.

## 8. Classification

```text
tests/contracts/db-precondition-composition-root-postgres-rehearsal-contract.test.cjs
  layer: SOURCE_STATIC

tests/db-engine/precondition-composition-root-postgres.test.cjs
  layer: DB_ENGINE_EXECUTION
  defaultCi: false
  capabilities: [postgresql, network]
```

The supplemental DB-engine test is not added to the default `npm test` glob.

## 9. Parent completion posture

Successful merge of this child completes the authority-and-adapter scope of `#3657`. After independent Web CTO verification, #3816 and #3657 may be closed as completed. `#3458` and all protected parents remain OPEN. Step 8 environment adoption is not authorized and is not required to close #3657; it remains a separate future child under #3458.

## 10. Explicit non-actions

```text
no modification of the six authority/core files, the harness, db/migration-provenance/**, package-lock.json,
  product/API/UI/Auth/Cloudflare/provider files
no Ready transition, merge, or Issue closure by the worker
no Production/Preview/Neon/Modal/provider access
no DATABASE_URL, real credential, or real database access
no local Docker/PostgreSQL/WSL DB execution of the DB-engine test
no migration/DDL/DML/ledger SQL; no Step 8 SQL creation or approval
no reset, clean, stash, rebase, amend, force push, or history rewrite
no modification of open PR #3780/#3787/#3801 or their worktrees
```

## 11. Rollback

- This child is additive (one CI-only DB-engine test, one source-static contract, one doc, one package script, one CI job, one classification entry, one deterministic reporter registry pair, and deterministic count-literal guard reconciliations). Removing the ten-file cumulative change restores the prior state; no runtime behavior changes because the authorities remain inactive and no environment adoption occurs.

Refs #3816.
Refs #3809 — completed Step 6.
Refs #3802 — completed Step 5.
Refs #3657 — final child; Keep OPEN until merge.
Refs #3458 — Keep OPEN.
Refs #3425 — Keep OPEN.
Refs #3435 — Keep OPEN.
Refs #1882 — Keep OPEN.
