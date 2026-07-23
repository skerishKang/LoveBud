# DB Canonical Runner Orchestrator Contract

Status: fifth small slice of Issue #3458. This is a **dependency-injected async orchestrator contract**. It is **not** a migration runner. It performs **no** database connection, **no** SQL execution, **no** real advisory lock, and **no** real ledger write. Every external effect is a synthetic injected dependency.

## Baseline

| Field | Value |
| --- | --- |
| Repository | `skerishKang/LoveBud` |
| Baseline `origin/main` SHA | `6bd654f32edc94e8c4643686cd7ce617f669345f` (squash merge of #3634) |
| Issue | #3458 |
| Orchestrator | `scripts/migration-runner-orchestrator-core.cjs` (`runCanonicalMigration`) |
| Protocol (source of truth, unmodified) | `scripts/migration-runner-protocol-core.cjs` (`evaluateMigrationPreflight`, `evaluateMigrationCompletion`) |
| Contract test | `tests/contracts/db-canonical-runner-orchestrator-contract.test.cjs` |

## Protocol vs orchestrator roles

- The **protocol** (`migration-runner-protocol-core.cjs`) is the single source of policy truth. It decides preflight (`FAIL_CLOSED` / `NOOP_ALREADY_APPLIED` / `READY_TO_EXECUTE`) and completion (`READY_TO_APPEND_LEDGER` / `FAIL_CLOSED`) as pure functions.
- The **orchestrator** (`migration-runner-orchestrator-core.cjs`) sequences the injected dependencies around the protocol calls. It **never re-implements** protocol decisions; it delegates to `evaluateMigrationPreflight` and `evaluateMigrationCompletion` and acts only on their results.

## Dependency injection

`runCanonicalMigration(input)` takes:

```js
{
  targetMigrationId,
  requestedAction,
  runtimeMetadata: { runnerVersion, environmentClass, deployedCommit },
  dependencies: {
    validateSource, loadManifest, acquireAdvisoryLock, readLedger,
    evaluatePrecondition, executeMigration, evaluatePostcondition,
    checkAdvisoryLock, appendLedgerRecord, releaseAdvisoryLock, now
  },
  explicitBoundaryApproved // optional boolean, default false (passed through to preflight)
}
```

Before any dependency call, the orchestrator validates that the three `runtimeMetadata` values are non-empty strings and that all 11 dependencies are callable. Any failure → 0 dependency calls, stage `INITIAL`, outcome `BLOCKED_BEFORE_EXECUTION`. Each dependency may be sync or async. The orchestrator never mutates the input or any dependency return object.

Dependency contracts (synthetic):

- `validateSource({ targetMigrationId })` → `{ status: PASS|FAIL|UNAVAILABLE }`
- `loadManifest({ targetMigrationId })` → `{ status, migrations }`
- `acquireAdvisoryLock({ targetMigrationId })` → `{ status: ACQUIRED|NOT_ATTEMPTED|UNAVAILABLE|FAILED, handle }` — when `status` is `ACQUIRED`, the result must carry an own `handle` property that is non-null and non-undefined. `handle` is opaque (any type allowed) and is never stringified, cloned, logged, or included in the result/events/blockers.
- `readLedger({ lockHandle })` → ledger record array (never called before the lock is `ACQUIRED`).
- `evaluatePrecondition({ targetMigrationId, lockHandle })` → `{ status: PASS|FAIL|UNAVAILABLE|NOT_EVALUATED }`
- `executeMigration({ migrationId, migrationChecksum, transactionMode, destructive, lockHandle })` → `{ executionOutcome, transactionOutcome }` — receives only protocol binding values; never raw SQL, manifest, credential, URL, or operator identity.
- `evaluatePostcondition({ migrationId, migrationChecksum, transactionMode, destructive, lockHandle })` → `{ status }`
- `checkAdvisoryLock({ lockHandle })` → `{ status: ACQUIRED|LOST|FAILED|UNAVAILABLE }`
- `appendLedgerRecord({ record, lockHandle })` → `{ status: APPENDED|FAILED|UNKNOWN }`
- `releaseAdvisoryLock({ lockHandle })` → `{ status: RELEASED|FAILED|UNKNOWN }`
- `now()` → canonical ISO-8601 UTC timestamp (Date-parseable, `Z`-terminated, round-trips via `toISOString()`). `now` is a **zero-argument** dependency; it is invoked with no arguments.

Result shape: every status-returning dependency (`validateSource`, `loadManifest`, `acquireAdvisoryLock`, `evaluatePrecondition`, `executeMigration`, `evaluatePostcondition`, `checkAdvisoryLock`, `appendLedgerRecord`, `releaseAdvisoryLock`) must return a **plain record object** (non-null, `typeof === 'object'`, not an array, prototype `Object.prototype` or `null`). An array or function carrying a `status` property is not a valid result. Exceptions: `readLedger` returns an array, `now` returns a string. A malformed (non-plain-record) result → `ORCHESTRATOR_DEPENDENCY_RESULT_INVALID:<name>`.

Source/lock valid-negative results preserve the exact protocol blockers (imported from the protocol core, which is not modified): source `FAIL` → `RUNNER_SOURCE_VALIDATION_FAILED`, source `UNAVAILABLE` → `RUNNER_SOURCE_VALIDATION_UNAVAILABLE`, lock `NOT_ATTEMPTED`/`FAILED`/`UNAVAILABLE` → `RUNNER_ADVISORY_LOCK_REQUIRED`. These do not add `ORCHESTRATOR_DEPENDENCY_RESULT_INVALID`, call no release, and call no ledger/precondition/execute/append.

## Exact stage order

```text
validateSource → loadManifest → acquireAdvisoryLock → readLedger →
evaluatePrecondition → evaluateMigrationPreflight → executeMigration →
evaluatePostcondition → checkAdvisoryLock → evaluateMigrationCompletion →
now → appendLedgerRecord → releaseAdvisoryLock
```

Stages: `INITIAL`, `SOURCE_VALIDATION`, `MANIFEST_LOAD`, `LOCK_ACQUIRE`, `LEDGER_READ`, `PRECONDITION`, `PREFLIGHT`, `EXECUTION`, `POSTCONDITION`, `LOCK_RECHECK`, `COMPLETION`, `LEDGER_APPEND`, `LOCK_RELEASE`, `COMPLETED`. Protocol calls are not dependencies.

## Preflight / completion binding

The preflight input is assembled from gathered state (`sourceValidationStatus`, `manifestStatus`, `manifestMigrations`, `targetMigrationId`, `ledgerRecords`, `advisoryLockStatus`, `preconditionStatus`, `explicitBoundaryApproved`, `requestedAction`). On `READY_TO_EXECUTE`, only the protocol binding (`migrationId`, `migrationChecksum`, `transactionMode`, `destructive`, `lockHandle`) is passed to `executeMigration`.

After execution, the orchestrator always runs postcondition → lock recheck → canonical completion. The completion input carries `ledgerAppendAuthorized: false`; dependency/caller-supplied authorization is never trusted. If completion is not `READY_TO_APPEND_LEDGER` with `ledgerAppendAuthorized === true`, no append occurs and the outcome is `COMPLETION_BLOCKED`.

## NOOP

If preflight returns `NOOP_ALREADY_APPLIED`, the orchestrator executes nothing (execute/postcondition/lock-recheck/now/append all 0), releases the lock exactly once, and returns outcome `NOOP_ALREADY_APPLIED` with `executionAttempted`, `ledgerAppendAttempted`, `ledgerAppended` all false.

## Lock lifecycle

If the lock is not `ACQUIRED`, the orchestrator fails closed with no ledger read, precondition, execute, append, or release. `ACQUIRED` additionally requires a usable opaque handle (own `handle` property, non-null, non-undefined). If the adapter claims `ACQUIRED` but the handle is unusable, the orchestrator sets `lockAcquired=true`, adds `ORCHESTRATOR_DEPENDENCY_RESULT_INVALID:acquireAdvisoryLock`, returns outcome `BLOCKED_BEFORE_EXECUTION`, never starts the migration pipeline (ledger/precondition/execute/postcondition/recheck/now/append all 0), and still attempts a best-effort cleanup release exactly once (passing only the raw opaque handle). Once `ACQUIRED` with a usable handle, the lock is released **exactly once** on every path (success, failure, or throw). A release that is `FAILED`/`UNKNOWN`/malformed/throw sets the final outcome to `LOCK_RELEASE_FAILED` with blocker `ORCHESTRATOR_LOCK_RELEASE_FAILED`, preserving already-successful execution/append flags. Release-failure recovery upgrades `NO_RECOVERY_ACTION` to `MANUAL_RECONCILIATION_REQUIRED` and preserves any stronger existing recovery. A malformed (non-plain-record) append result carries both `ORCHESTRATOR_DEPENDENCY_RESULT_INVALID:appendLedgerRecord` and `ORCHESTRATOR_LEDGER_APPEND_FAILED`; a malformed release result carries both `ORCHESTRATOR_DEPENDENCY_RESULT_INVALID:releaseAdvisoryLock` and `ORCHESTRATOR_LOCK_RELEASE_FAILED`; schema-valid negative statuses (`FAILED`/`UNKNOWN`) carry only the domain blocker.

## Ledger append authorization and record

Only after completion approval does the orchestrator call `now()` and build a ledger record with **exactly** the 7 authoritative fields:

```js
{ migration_id, content_checksum, applied_at, runner_version, environment_class, deployed_commit, transaction_outcome: 'COMMITTED' }
```

No extra fields. The prohibited fields (`operator_email`, `operator_user_id`, `credential`, `connection_string`, `raw_catalog_payload`) are never present. The record is passed only to `appendLedgerRecord`; it never appears in the result or events.

## Append failure / manual reconciliation

If `now()` is invalid, the outcome is `LEDGER_APPEND_FAILED` with `ORCHESTRATOR_CLOCK_RESULT_INVALID` and append is not called. If append throws, is malformed, `FAILED`, or `UNKNOWN`, the outcome is `LEDGER_APPEND_FAILED` with `ORCHESTRATOR_LEDGER_APPEND_FAILED`, recovery `MANUAL_RECONCILIATION_REQUIRED`, `ledgerAppended=false`. The migration is never re-executed, the append is never retried, and no down migration or ledger rewrite occurs. The lock release is still attempted.

## Destructive unknown recovery

For a throw or invalid evidence after the execution call, the outcome is `COMPLETION_BLOCKED`; recovery is `SNAPSHOT_RESTORE_DECISION_REQUIRED` for a destructive migration and `MANUAL_RECONCILIATION_REQUIRED` otherwise.

## Sanitized result

```js
{
  outcome, stage, protocolDecision, blockers, recoveryDecision,
  migrationId, migrationChecksum,
  executionAttempted, ledgerAppendAttempted, ledgerAppended,
  lockAcquired, lockReleased, events
}
```

`blockers` are sorted/unique; `events` use only the fixed vocabulary. Stage is `COMPLETED` for success/noop/normal-blocked with a successful release, `LOCK_RELEASE` on release failure, `INITIAL` on initial validation failure, and the actual failure stage otherwise. The result never contains a raw error, error message, stack, lock handle, raw manifest, ledger array/record, SQL, row data, hostname, URL, credential, or operator identity.

## Outcomes / blockers / events

- Outcomes: `BLOCKED_BEFORE_EXECUTION`, `NOOP_ALREADY_APPLIED`, `COMPLETION_BLOCKED`, `LEDGER_APPEND_FAILED`, `EXECUTED_AND_RECORDED`, `LOCK_RELEASE_FAILED`.
- Orchestrator blockers: `ORCHESTRATOR_RUNTIME_METADATA_INVALID`, `ORCHESTRATOR_DEPENDENCY_MISSING:<name>`, `ORCHESTRATOR_DEPENDENCY_FAILED:<name>`, `ORCHESTRATOR_DEPENDENCY_RESULT_INVALID:<name>`, `ORCHESTRATOR_CLOCK_RESULT_INVALID`, `ORCHESTRATOR_LEDGER_APPEND_FAILED`, `ORCHESTRATOR_LOCK_RELEASE_FAILED`. Protocol blockers are preserved unchanged.
- Events (fixed vocabulary): `SOURCE_VALIDATION_COMPLETED`, `MANIFEST_LOADED`, `LOCK_ACQUIRED`, `LEDGER_READ`, `PRECONDITION_COMPLETED`, `PREFLIGHT_READY`, `PREFLIGHT_BLOCKED`, `PREFLIGHT_NOOP`, `EXECUTION_COMPLETED`, `POSTCONDITION_COMPLETED`, `LOCK_RECHECKED`, `COMPLETION_AUTHORIZED`, `COMPLETION_BLOCKED`, `LEDGER_APPENDED`, `LEDGER_APPEND_FAILED`, `LOCK_RELEASED`, `LOCK_RELEASE_FAILED`.

## Real DB / SQL boundary

This contract performs no database connection, SQL execution, advisory-lock acquisition, or ledger write. All such effects are injected dependencies that a real adapter must implement separately and validate independently.

## Remaining work

- PostgreSQL execution adapter (real `executeMigration`/precondition/postcondition).
- Advisory-lock adapter (real `acquireAdvisoryLock`/`checkAdvisoryLock`/`releaseAdvisoryLock`).
- Authoritative ledger relation + bootstrap migration (real `appendLedgerRecord`/`readLedger`).
- Disposable-engine orchestrator rehearsal.
- Clean database reconstruction.
- Deployment integration.
- Production adoption / activation.

## Protected Issues

Refs #3458 - Keep #3458 OPEN.

Refs #3425 - Keep #3425 OPEN.

Refs #3435 - Keep #3435 OPEN.

Refs #3437 - Keep #3437 OPEN.

Refs #1882 - Keep #1882 OPEN.
