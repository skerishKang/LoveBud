# DB Destructive DDL Approval Contract

Status: third small slice of Issue #3458. This is a **source-only** contract definition and test. It strengthens the rule that destructive DDL inside a canonical migration is statically classified, explicitly declared in the manifest, bound to a real approval reference, and fail-closed when the declaration is missing, partial, unknown, spurious, or placeholder-approved.

This document does **not** apply SQL, open a database connection, add a canonical migration, activate the canonical stream, or fabricate applied history.

## Baseline

| Field | Value |
| --- | --- |
| Repository | `skerishKang/LoveBud` |
| Baseline `origin/main` SHA | `b1f977fa9aec559597cf2afbadf0600f090f41e7` (squash merge of #3631) |
| Issue | #3458 |
| Validator | `scripts/migration-provenance-core.cjs` (`detectDestructiveOperations`, `validateMigrationManifest`) |
| Contract test | `tests/contracts/db-destructive-ddl-approval-contract.test.cjs` |

## Static operation vocabulary

The validator classifies obvious destructive DDL into a fixed vocabulary (`DESTRUCTIVE_OPERATION_VOCABULARY`):

| Operation class | Static signal |
| --- | --- |
| `DROP_TABLE` | `DROP TABLE` |
| `TRUNCATE_TABLE` | `TRUNCATE` |
| `DROP_COLUMN` | `DROP COLUMN` |
| `ALTER_COLUMN_TYPE` | `ALTER COLUMN ... TYPE` |
| `SET_NOT_NULL` | `SET NOT NULL` |
| `DROP_CONSTRAINT` | `DROP CONSTRAINT` |
| `DROP_INDEX` | `DROP INDEX` |
| `DROP_FUNCTION` | `DROP FUNCTION` |
| `DROP_TRIGGER` | `DROP TRIGGER` |
| `DROP_TYPE` | `DROP TYPE` |
| `DROP_POLICY` | `DROP POLICY` |
| `FK_CASCADE_EXPANSION` | `ON DELETE CASCADE` / `ON UPDATE CASCADE` |

`detectDestructiveOperations(sqlText)` returns a sorted, de-duplicated array of the operation classes present.

## Declaration

When destructive SQL is detected in a canonical migration, the manifest entry must declare **all** of:

- `risk_class = DESTRUCTIVE`;
- `destructive_operations` = the **full** set of detected operation classes (no partial declaration);
- `approval_reference` = a real, separately reviewable approval reference;
- `transaction_mode` = an explicit value (`REQUIRED` / `PROHIBITED` / `EXPLICIT`).

## Approval reference

Placeholder approval references are **not** accepted as approval. The following (case-insensitive) are rejected: `n/a`, `na`, `none`, `no`, `todo`, `tbd`, `pending`, `later`, `unknown`, `placeholder`, `null`, `-`, `.`, `x`/`xx`/...

An approval reference must be a non-empty, human-reviewable reference, for example:

- a GitHub issue/PR reference (e.g. `issue:3458`);
- an ADR reference (e.g. `adr:0001`);
- a change approval record ID.

Production identifiers and operator identity are never recorded in the approval reference (or anywhere in the manifest).

## Fail-closed behavior

The following fail closed:

- destructive SQL + no declaration → `MIGRATION_DESTRUCTIVE_OPERATION_UNDECLARED` (and per-operation `MIGRATION_DESTRUCTIVE_OPERATION_MISSING`);
- destructive SQL + only some operations declared → `MIGRATION_DESTRUCTIVE_OPERATION_MISSING:<id>:<op>`;
- destructive SQL + an operation outside the vocabulary → `MIGRATION_DESTRUCTIVE_OPERATION_UNKNOWN:<id>:<op>`;
- destructive SQL + placeholder approval → `MIGRATION_DESTRUCTIVE_APPROVAL_PLACEHOLDER`;
- destructive SQL + empty approval → `MIGRATION_DESTRUCTIVE_APPROVAL_MISSING`;
- `destructive_operations` present + `risk_class` not `DESTRUCTIVE` → `MIGRATION_DESTRUCTIVE_RISK_REQUIRED`;
- `risk_class = DESTRUCTIVE` + no destructive content (no detected DDL and no declared operations) → `MIGRATION_DESTRUCTIVE_DECLARATION_SPURIOUS`;
- declared operation not actually present in the SQL → `MIGRATION_DESTRUCTIVE_DECLARATION_SPURIOUS:<id>:<op>`;
- duplicate operation declaration → `MIGRATION_DESTRUCTIVE_OPERATION_DUPLICATE:<id>:<op>`.

`MIGRATION_DESTRUCTIVE_OPERATION_UNDECLARED` and `MIGRATION_DESTRUCTIVE_APPROVAL_MISSING` reuse the pre-existing error codes; the remaining codes are added by this slice.

## Limitations

The validator is a **static regular-expression contract, not a full PostgreSQL parser**. It deterministically classifies the obvious destructive forms above and fails closed otherwise. It does **not** prove Production safety.

Statically hard-to-classify forms are treated as `REVIEW_REQUIRED` (documented limitation), never silently passed:

- DDL hidden inside dynamic SQL or `EXECUTE` of a string;
- DDL inside PL/pgSQL function bodies;
- conditional or generated DDL;
- unusual `ALTER COLUMN ... SET DATA TYPE` spellings beyond the `ALTER COLUMN ... TYPE` signal;
- indirect cascade semantics not written as `ON DELETE/UPDATE CASCADE`.

These require a future PostgreSQL parser and/or disposable-engine rehearsal, which is separate work and out of scope for this slice.

## Synthetic fixture method

The contract test creates throwaway canonical repository layouts under the OS temporary directory (`os.tmpdir()` + `fs.mkdtempSync`), writes `.sql` fixtures with explicit content, runs the validator against the temporary root, and removes every temporary directory on completion. No `.sql` fixture is committed to the repository. No database is used.

## Production / Database / SQL Boundary

| Question | Answer |
| --- | --- |
| SQL executed | No |
| Database accessed | No database connection was opened |
| Production mutation | No |
| Secrets used | No `DATABASE_URL` or secret value was used |
| Canonical migration added | No |
| Canonical stream activated | No (`status` remains `ADOPTION_REQUIRED`, `migrations` remains `[]`) |
| Ledger relation DDL written | No |
| Existing migration file modified | No |

## Protected Issues

Refs #3458 - Keep #3458 OPEN.

Refs #3425 - Keep #3425 OPEN.

Refs #3435 - Keep #3435 OPEN.

Refs #3437 - Keep #3437 OPEN.

Refs #1882 - Keep #1882 OPEN.
