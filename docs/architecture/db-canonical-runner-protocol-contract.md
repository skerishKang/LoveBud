# DB Canonical Runner Protocol Contract

Status: fourth small slice of Issue #3458. This is a **pure, deterministic, source-only protocol contract**. It is **not** a migration runner. It performs **no** database connection, **no** SQL execution, **no** ledger write, and **no** advisory lock acquisition. It fixes the runner protocol that a future, separately approved runner must obey.

## Baseline

| Field | Value |
| --- | --- |
| Repository | `skerishKang/LoveBud` |
| Baseline `origin/main` SHA | `63f9cedd8cae11b24f9192f65657905572e841eb` (squash merge of #3633) |
| Issue | #3458 |
| Core | `scripts/migration-runner-protocol-core.cjs` (`evaluateMigrationPreflight`, `evaluateMigrationCompletion`) |
| Contract test | `tests/contracts/db-canonical-runner-protocol-contract.test.cjs` |

## Pure entry points

### `evaluateMigrationPreflight(input)`

Fail-closed gate evaluated **before** executing a canonical migration. Returns `{ decision, blockers, recovery }` where `decision` is `FAIL_CLOSED`, `NOOP_ALREADY_APPLIED`, or `READY_TO_EXECUTE`.

Bounded pure input (no DB access): `sourceValidation`, `advisoryLock`, `precondition`, `migration { id, checksum, transactionMode, dependsOn[], explicitBoundaryApproved }`, `manifestOrder [{ id, checksum }]`, `ledger [{ migration_id, content_checksum, transaction_outcome }]`.

Preflight order:

1. **Source validation** must be `PASS`; otherwise `FAIL_CLOSED` with `RUNNER_SOURCE_VALIDATION_FAILED` and no execution plan.
2. **Advisory lock** must be `ACQUIRED`; otherwise `FAIL_CLOSED` with `RUNNER_ADVISORY_LOCK_REQUIRED`. The core never acquires a lock.
3. **Ledger integrity**: a ledger record outside the manifest → `RUNNER_UNKNOWN_LEDGER_MIGRATION:<id>`; a duplicate ledger ID → `RUNNER_DUPLICATE_LEDGER_MIGRATION:<id>`.
4. **Idempotent retry** when the migration ID is already in the ledger:
   - exact committed match (ID + checksum + `COMMITTED`) → `NOOP_ALREADY_APPLIED` (no re-execute, no re-append);
   - same ID, different checksum → `RUNNER_APPLIED_CHECKSUM_MISMATCH:<id>` (recovery `FORWARD_FIX_REQUIRED`);
   - same ID, non-committed outcome → `RUNNER_EXISTING_NON_COMMITTED_OUTCOME:<id>:<outcome>` (recovery `MANUAL_RECONCILIATION_REQUIRED`; no automatic retry).
5. **Canonical sequence**: the migration must exist in the manifest (`RUNNER_SEQUENCE_BLOCKED` otherwise); every prior manifest migration must be applied and committed (`RUNNER_DEPENDENCY_NOT_APPLIED:<id>`, `RUNNER_PRIOR_OUTCOME_NOT_COMMITTED:<id>`); declared dependencies must be applied and committed.
6. **Transaction mode**: unsupported mode → `RUNNER_TRANSACTION_MODE_INVALID`; `EXPLICIT` without `explicitBoundaryApproved` → `RUNNER_EXPLICIT_BOUNDARY_REQUIRED`.
7. **Precondition** must be exactly `PASS`: `FAIL` → `RUNNER_PRECONDITION_FAILED`, `UNAVAILABLE` → `RUNNER_PRECONDITION_UNAVAILABLE`, otherwise → `RUNNER_PRECONDITION_NOT_EVALUATED`.

### `evaluateMigrationCompletion(input)`

Gate evaluated **after** execution. A successful execution **alone never** authorizes a ledger append. Returns `READY_TO_APPEND_LEDGER` only when **all** hold; otherwise `FAIL_CLOSED`. No ledger write is performed.

`READY_TO_APPEND_LEDGER` requires: `executionOutcome = SUCCEEDED`, `transactionOutcome = COMMITTED`, `postcondition = PASS`, migration checksum equals the manifest checksum, `sourceValidation = PASS`, `advisoryLock = ACQUIRED`, and `priorSequenceValid = true`.

Blockers: `RUNNER_POSTCONDITION_FAILED`, `RUNNER_POSTCONDITION_UNAVAILABLE`, `RUNNER_POSTCONDITION_NOT_EVALUATED`, `RUNNER_EXECUTION_OUTCOME_UNKNOWN`, `RUNNER_EXECUTION_OUTCOME_NOT_SUCCEEDED`, `RUNNER_TRANSACTION_OUTCOME_NOT_COMMITTED`, `RUNNER_APPLIED_CHECKSUM_MISMATCH:<id>`, `RUNNER_ADVISORY_LOCK_REQUIRED`, `RUNNER_SOURCE_VALIDATION_FAILED`, `RUNNER_SEQUENCE_BLOCKED`.

## Vocabularies

- `RUNNER_DECISIONS`: `FAIL_CLOSED`, `NOOP_ALREADY_APPLIED`, `READY_TO_EXECUTE`, `READY_TO_APPEND_LEDGER`.
- `RECOVERY_DECISIONS`: `NO_RECOVERY_ACTION`, `RETRY_REQUIRES_FRESH_PREFLIGHT`, `FORWARD_FIX_REQUIRED`, `MANUAL_RECONCILIATION_REQUIRED`, `SNAPSHOT_RESTORE_DECISION_REQUIRED`.
- `SOURCE_VALIDATION_STATUSES`: `PASS`, `FAIL`.
- `ADVISORY_LOCK_STATUSES`: `ACQUIRED`, `UNAVAILABLE`, `FAILED`, `NOT_ATTEMPTED`.
- `CONDITION_STATUSES`: `PASS`, `FAIL`, `UNAVAILABLE`, `NOT_EVALUATED`.
- `EXECUTION_OUTCOMES`: `SUCCEEDED`, `FAILED`, `PARTIAL`, `UNKNOWN`.
- `TRANSACTION_OUTCOMES`: `COMMITTED`, `ROLLED_BACK`, `PARTIAL`, `UNKNOWN`.
- `TRANSACTION_MODES`: `REQUIRED`, `PROHIBITED`, `EXPLICIT`.

## Rollback / forward-fix policy

- **Failure before execution**: a preflight blocker executes no migration and writes no ledger record.
- **REQUIRED transaction failure during execution**: even a proven `ROLLED_BACK` outcome never produces a ledger `COMMITTED` record; the migration is not auto-re-run; the next invocation runs a full fresh preflight (`RETRY_REQUIRES_FRESH_PREFLIGHT`).
- **PROHIBITED / EXPLICIT failure**: partial application cannot be determined statically → `MANUAL_RECONCILIATION_REQUIRED`.
- **Correcting an already-COMMITTED migration**: existing migration files are never edited, ledger records are never deleted or modified, and a same-ID down migration is forbidden. A correction is a **new forward-fix migration** with a new ID and checksum (`FORWARD_FIX_REQUIRED`).

### Forbidden planner actions

The planner never returns: `RUN_DOWN_MIGRATION`, `AUTO_ROLLBACK_APPLIED_MIGRATION`, `DELETE_LEDGER_RECORD`, `REWRITE_LEDGER_HISTORY` (`FORBIDDEN_RUNNER_ACTIONS`). Arbitrary down migrations are not assumed safe.

## Limitations

This is a pure decision contract over bounded input. It does not connect to a database, execute SQL, acquire locks, or write ledger records, and it does not prove that a real runner is correct. A future runner must implement this protocol and be validated separately (including disposable-engine rehearsal). Recovery decisions are bounded signals for a separately approved operator/process; this contract performs no restore or execution.

## Production / Database / SQL Boundary

| Question | Answer |
| --- | --- |
| SQL executed | No |
| Database accessed | No database connection was opened |
| Advisory lock acquired | No |
| Ledger record written | No |
| Production mutation | No |
| Secrets used | No `DATABASE_URL` or secret value was used |
| Canonical stream activated | No (`status` remains `ADOPTION_REQUIRED`, `migrations` remains `[]`) |
| Runner implemented | No (protocol contract only) |

## Protected Issues

Refs #3458 - Keep #3458 OPEN.

Refs #3425 - Keep #3425 OPEN.

Refs #3435 - Keep #3435 OPEN.

Refs #3437 - Keep #3437 OPEN.

Refs #1882 - Keep #1882 OPEN.
