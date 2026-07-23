# DB Canonical Runner Protocol Contract

Status: fourth small slice of Issue #3458 (hardened binding + ledger-prefix follow-up). This is a **pure, deterministic, source-only protocol contract**. It is **not** a migration runner. It performs **no** database connection, **no** SQL execution, **no** ledger write, and **no** advisory lock acquisition. It fixes the runner protocol that a future, separately approved runner must obey.

## Baseline

| Field | Value |
| --- | --- |
| Repository | `skerishKang/LoveBud` |
| Baseline `origin/main` SHA | `63f9cedd8cae11b24f9192f65657905572e841eb` (squash merge of #3633) |
| Issue | #3458 |
| Core | `scripts/migration-runner-protocol-core.cjs` (`evaluateMigrationPreflight`, `evaluateMigrationCompletion`) |
| Contract test | `tests/contracts/db-canonical-runner-protocol-contract.test.cjs` |

## Result shape

Every result carries explicit authorization flags and binding fields:

```js
{
  decision,              // FAIL_CLOSED | NOOP_ALREADY_APPLIED | READY_TO_EXECUTE | READY_TO_APPEND_LEDGER
  blockers,              // sorted, unique blocker codes
  recoveryDecision,      // a RECOVERY_DECISIONS value
  migrationId,
  migrationChecksum,
  transactionMode,
  destructive,
  executionAuthorized,   // true only for READY_TO_EXECUTE
  ledgerAppendAuthorized // true only for READY_TO_APPEND_LEDGER
}
```

Authorization rules: `FAIL_CLOSED` and `NOOP_ALREADY_APPLIED` set both flags false; `READY_TO_EXECUTE` sets `executionAuthorized=true`, `ledgerAppendAuthorized=false`; `READY_TO_APPEND_LEDGER` sets `executionAuthorized=false`, `ledgerAppendAuthorized=true`.

## `evaluateMigrationPreflight(input)`

Fail-closed gate evaluated **before** executing a canonical migration. Pure input (camelCase):

```js
{
  sourceValidationStatus,   // PASS | FAIL | UNAVAILABLE
  manifestStatus,           // must be exactly ACTIVE
  manifestMigrations,       // [{ id, checksum, depends_on, transaction_mode, risk_class, destructive_operations }]
  targetMigrationId,        // resolved against manifestMigrations (caller supplies no separate object)
  ledgerRecords,            // [{ migration_id, content_checksum, applied_at, runner_version, environment_class, deployed_commit, transaction_outcome }]
  advisoryLockStatus,       // ACQUIRED | NOT_ATTEMPTED | UNAVAILABLE | FAILED | LOST
  preconditionStatus,       // PASS | FAIL | UNAVAILABLE | NOT_EVALUATED
  explicitBoundaryApproved, // boolean (for EXPLICIT transaction mode)
  requestedAction           // must be APPLY_FORWARD
}
```

The target entry (id, checksum, depends_on, transaction_mode, risk_class, destructive_operations) is derived from `manifestMigrations` by `targetMigrationId`; the caller cannot override checksum, transaction mode, dependencies, or destructive status. A missing target → `RUNNER_TARGET_MIGRATION_UNKNOWN:<id>`; a malformed manifest record → `RUNNER_MANIFEST_MIGRATION_INVALID:<id>`.

Preflight checks:

1. `requestedAction` must be `APPLY_FORWARD`; anything else (including every forbidden action) → `RUNNER_REQUESTED_ACTION_INVALID:<action>`.
2. Source validation: `UNAVAILABLE` → `RUNNER_SOURCE_VALIDATION_UNAVAILABLE`; not `PASS` → `RUNNER_SOURCE_VALIDATION_FAILED`.
3. `manifestStatus` must be exactly `ACTIVE` (`ADOPTION_REQUIRED`/missing/unknown all blocked) → `RUNNER_MANIFEST_NOT_ACTIVE`.
4. Advisory lock must be `ACQUIRED` → else `RUNNER_ADVISORY_LOCK_REQUIRED`.
5. `ledgerRecords` must be an array; missing/non-array → `RUNNER_LEDGER_EVIDENCE_UNAVAILABLE` (never coerced to an empty array).
6. The ledger must be an **exact committed prefix** of the manifest, comparing ledger array index against manifest index directly. Each ledger record must satisfy the authoritative schema from `db/migration-provenance/ledger-contract.json`: a plain object whose required fields (`migration_id`, `content_checksum`, `applied_at`, `runner_version`, `environment_class`, `deployed_commit`, `transaction_outcome`) are each a non-empty string, and which carries **no** prohibited field (`operator_email`, `operator_user_id`, `credential`, `connection_string`, `raw_catalog_payload`) as an own property regardless of value. Prohibited field values are never read, returned, or logged.
   - malformed record (null/array/non-object, any missing or empty/whitespace required field, or any prohibited field present) → `RUNNER_LEDGER_RECORD_INVALID:<index>`;
   - duplicate ID → `RUNNER_DUPLICATE_LEDGER_MIGRATION:<id>`;
   - ID outside the manifest → `RUNNER_UNKNOWN_LEDGER_MIGRATION:<id>`;
   - ledger order ≠ manifest order → `RUNNER_LEDGER_ORDER_MISMATCH:<id>`;
   - ledger checksum ≠ manifest checksum → `RUNNER_APPLIED_CHECKSUM_MISMATCH:<id>`;
   - prior outcome not `COMMITTED` → `RUNNER_PRIOR_OUTCOME_NOT_COMMITTED:<id>:<outcome>`;
   - missing middle / not a contiguous prefix → `RUNNER_SEQUENCE_BLOCKED:<id>`.
7. **NOOP** is allowed only after the whole ledger prefix validates **and** no earlier gate blocker was collected: `requestedAction=APPLY_FORWARD`, source `PASS`, manifest `ACTIVE`, lock `ACQUIRED`, ledger evidence an array, a valid target manifest entry, a valid exact committed prefix, and the target record's ID/checksum/outcome an exact match → `NOOP_ALREADY_APPLIED`. NOOP never bypasses the requestedAction/source/manifest/lock/ledger/target fail-closed gates (it needs no transaction-mode approval or precondition, since nothing is executed). An unknown/duplicate/reordered/checksum-invalid ledger alongside an exact target is **not** NOOP.
8. **READY_TO_EXECUTE** requires the target to be exactly `manifestMigrations[ledgerRecords.length]` (the next unapplied). A target after that → missing prefix (`RUNNER_SEQUENCE_BLOCKED`); a target before that → already applied/no-op or corruption.
9. Every `depends_on` must exist in the committed prefix with the same id/checksum → else `RUNNER_DEPENDENCY_NOT_APPLIED:<target>:<dependency>`.
10. Transaction mode: unsupported → `RUNNER_TRANSACTION_MODE_INVALID`; `EXPLICIT` without `explicitBoundaryApproved` → `RUNNER_EXPLICIT_BOUNDARY_REQUIRED`.
11. Precondition must be exactly `PASS`: `FAIL` → `RUNNER_PRECONDITION_FAILED`, `UNAVAILABLE` → `RUNNER_PRECONDITION_UNAVAILABLE`, otherwise → `RUNNER_PRECONDITION_NOT_EVALUATED`.

## `evaluateMigrationCompletion(input)`

Gate evaluated **after** execution, **bound to a canonical preflight**. A successful execution alone never authorizes a ledger append. Pure input (camelCase):

```js
{
  preflightInput,       // the exact input passed to evaluateMigrationPreflight
  preflightResult,      // the preflight result the caller claims to have obtained
  executionOutcome,     // NOT_RUN | SUCCEEDED | FAILED | UNKNOWN
  transactionOutcome,   // NOT_EVALUATED | COMMITTED | ROLLED_BACK | PARTIAL | UNKNOWN
  postconditionStatus,  // PASS | FAIL | UNAVAILABLE | NOT_EVALUATED
  advisoryLockStatus,   // ACQUIRED | ... | LOST
  migrationId,
  migrationChecksum,
  ledgerAppendAuthorized // IGNORED — always recomputed
}
```

Completion does **not** accept raw `sourceValidation` / `priorSequenceValid` / `manifestChecksum` booleans from the caller. Internally it:

1. re-runs `evaluateMigrationPreflight(preflightInput)`;
2. requires the supplied `preflightResult` to match the canonical result exactly (deep equality);
3. requires the canonical decision to be `READY_TO_EXECUTE` with empty blockers and `executionAuthorized=true`;
4. requires `migrationId`/`migrationChecksum` to match the canonical preflight binding.

Any failure → `RUNNER_PREFLIGHT_NOT_AUTHORIZED`. A forged `preflightResult` never authorizes a ledger append.

`READY_TO_APPEND_LEDGER` additionally requires: `executionOutcome=SUCCEEDED`, `transactionOutcome=COMMITTED`, `postconditionStatus=PASS`, `advisoryLockStatus=ACQUIRED`. Blockers: `RUNNER_PREFLIGHT_NOT_AUTHORIZED`, `RUNNER_EXECUTION_FAILED`, `RUNNER_EXECUTION_OUTCOME_UNKNOWN`, `RUNNER_TRANSACTION_OUTCOME_NOT_COMMITTED:<outcome>`, `RUNNER_POSTCONDITION_FAILED`, `RUNNER_POSTCONDITION_UNAVAILABLE`, `RUNNER_POSTCONDITION_NOT_EVALUATED`, `RUNNER_ADVISORY_LOCK_LOST`. **Every failed completion** also carries `RUNNER_LEDGER_APPEND_NOT_AUTHORIZED` (sorted, unique, never present in a successful result, and it does not influence the recovery decision).

## Vocabularies

- `RUNNER_DECISIONS`: `FAIL_CLOSED`, `NOOP_ALREADY_APPLIED`, `READY_TO_EXECUTE`, `READY_TO_APPEND_LEDGER`.
- `RECOVERY_DECISIONS`: `NO_RECOVERY_ACTION`, `RETRY_REQUIRES_FRESH_PREFLIGHT`, `FORWARD_FIX_REQUIRED`, `MANUAL_RECONCILIATION_REQUIRED`, `SNAPSHOT_RESTORE_DECISION_REQUIRED`.
- `REQUESTED_ACTIONS`: `APPLY_FORWARD` (the only permitted requested action).
- `SOURCE_VALIDATION_STATUSES`: `PASS`, `FAIL`, `UNAVAILABLE`.
- `ADVISORY_LOCK_STATUSES`: `ACQUIRED`, `NOT_ATTEMPTED`, `UNAVAILABLE`, `FAILED`, `LOST`.
- `CONDITION_STATUSES`: `PASS`, `FAIL`, `UNAVAILABLE`, `NOT_EVALUATED`.
- `EXECUTION_OUTCOMES`: `NOT_RUN`, `SUCCEEDED`, `FAILED`, `UNKNOWN` (partial application is a transaction-level concern).
- `TRANSACTION_OUTCOMES`: `NOT_EVALUATED`, `COMMITTED`, `ROLLED_BACK`, `PARTIAL`, `UNKNOWN`.
- `TRANSACTION_MODES`: `REQUIRED`, `PROHIBITED`, `EXPLICIT`.

## Recovery escalation

- `REQUIRED` + `FAILED` + `ROLLED_BACK` → `RETRY_REQUIRES_FRESH_PREFLIGHT` (no auto-retry; the next invocation runs a fresh full preflight).
- `REQUIRED` + `PARTIAL`/`UNKNOWN` transaction → ordinary migration: `MANUAL_RECONCILIATION_REQUIRED`; **destructive** migration: `SNAPSHOT_RESTORE_DECISION_REQUIRED`.
- `PROHIBITED`/`EXPLICIT` + `FAILED`/`UNKNOWN`/non-`COMMITTED` → `MANUAL_RECONCILIATION_REQUIRED`.

## Rollback / forward-fix policy and forbidden actions

`FORBIDDEN_RUNNER_ACTIONS` are never returned and, when supplied as `requestedAction`, fail closed: `RUN_DOWN_MIGRATION`, `AUTO_ROLLBACK_APPLIED_MIGRATION`, `DELETE_LEDGER_RECORD`, `REWRITE_LEDGER_HISTORY`, `REAPPLY_COMMITTED_MIGRATION`. Arbitrary down migrations are not assumed safe. Correcting an already-`COMMITTED` migration is a new forward-fix migration with a new ID/checksum; existing migration files and ledger records are never edited or deleted.

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
