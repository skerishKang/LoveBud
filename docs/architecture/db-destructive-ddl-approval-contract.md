# DB Destructive DDL Approval Contract

Status: third small slice of Issue #3458. This is a **source-only** contract definition and test. It strengthens the rule that destructive DDL inside a canonical migration is statically classified, explicitly declared in the manifest, bound to a **structured** approval reference, and fail-closed when the declaration is missing, partial, unknown, spurious, placeholder-approved, or malformed. Recognized dynamic/procedural ambiguity signals fail closed as `REVIEW_REQUIRED`.

This document does **not** apply SQL, open a database connection, add a canonical migration, activate the canonical stream, or fabricate applied history.

## Baseline

| Field | Value |
| --- | --- |
| Repository | `skerishKang/LoveBud` |
| Baseline `origin/main` SHA | `b1f977fa9aec559597cf2afbadf0600f090f41e7` (squash merge of #3631) |
| Issue | #3458 |
| Validator | `scripts/migration-provenance-core.cjs` (`detectDestructiveOperations`, `detectDestructiveReviewRequiredReasons`, `isValidApprovalReference`, `validateMigrationManifest`) |
| Contract test | `tests/contracts/db-destructive-ddl-approval-contract.test.cjs` |

This contract separates three scopes:

1. **Statically recognized destructive operations** — obvious DDL forms the regex classifies deterministically.
2. **Recognized ambiguity signals requiring review** — dynamic/procedural forms that fail closed as `REVIEW_REQUIRED`.
3. **Residual limitations** — PostgreSQL semantics the regex neither classifies nor recognizes; these are not proven absent.

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

## Recognized ambiguity signals (REVIEW_REQUIRED)

Some forms hide their actual operations from a static regex. `detectDestructiveReviewRequiredReasons(sqlText)` returns a sorted, de-duplicated array of recognized ambiguity reason codes (`DESTRUCTIVE_REVIEW_REQUIRED_REASONS`):

| Reason | Recognized signal |
| --- | --- |
| `DYNAMIC_EXECUTE` | `EXECUTE` of a string literal / dollar-quoted string / `format(...)` (dynamic SQL execution) |
| `PROCEDURAL_DO_BLOCK` | PostgreSQL anonymous procedural block `DO $$ ... $$` (or `DO $tag$ ... $tag$`) |
| `PLPGSQL_BODY` | `LANGUAGE plpgsql` function body (procedural code that may build/run DDL) |
| `GENERATED_DDL` | `format(...)` carrying a DDL keyword, or string concatenation assembling a DDL keyword from fragments |

When any reason is recognized, the migration fails closed with `MIGRATION_DESTRUCTIVE_REVIEW_REQUIRED:<migration_id>:<reason>` — **even if** `destructive_operations` and a valid `approval_reference` are present, because the static detector cannot determine the actual operations of a dynamic/procedural form.

These signals are deliberately narrow to avoid over-blocking ordinary SQL. The following are **not** `REVIEW_REQUIRED`:

- a plain `CREATE TABLE`;
- a direct `DROP TABLE` (handled by the recognized destructive-operation path above);
- the word `execute` appearing inside an ordinary string value;
- a SQL function with no dynamic execution or procedural destructive signal (e.g. `LANGUAGE sql`).

## Declaration

When destructive SQL is detected in a canonical migration, the manifest entry must declare **all** of:

- `risk_class = DESTRUCTIVE`;
- `destructive_operations` = the **full** set of detected operation classes (no partial declaration);
- `approval_reference` = a real, separately reviewable approval reference;
- `transaction_mode` = an explicit value (`REQUIRED` / `PROHIBITED` / `EXPLICIT`).

## Approval reference

A destructive migration's `approval_reference` must be a **structured** reference (`APPROVAL_REFERENCE_PATTERN`), not an arbitrary non-empty string:

```text
issue:<positive-integer>      e.g. issue:3458
pr:<positive-integer>         e.g. pr:3633
adr:<identifier>              e.g. adr:0001, adr:db.migration-001
change:<identifier>           e.g. change:DB-2026-001
approval:<identifier>         e.g. approval:arch/db-001
```

Format rules:

- `issue` and `pr` take a positive integer only (no `0`, no negative).
- `adr`, `change`, `approval` identifiers start with an alphanumeric character, then alphanumerics or `.`, `_`, `/`, `-`.
- No spaces, no empty identifier, no placeholder token, no arbitrary general string.

Error distinction:

- empty → `MIGRATION_DESTRUCTIVE_APPROVAL_MISSING`;
- obvious placeholder (`n/a`, `na`, `none`, `no`, `todo`, `tbd`, `pending`, `later`, `unknown`, `placeholder`, `null`, `-`, `.`, `x`/`xx`/...) → `MIGRATION_DESTRUCTIVE_APPROVAL_PLACEHOLDER`;
- non-empty but not an allowed structured form (e.g. `todo later`, `pending-review`, `ask-owner`, `approval-needed`, `abc`, `issue:`, `issue:abc`, `issue:0`, `pr:-1`, `change:`, any reference with a space) → `MIGRATION_DESTRUCTIVE_APPROVAL_INVALID`.

Production identifiers and operator identity are never recorded in the approval reference (or anywhere in the manifest).

## Fail-closed behavior

The following fail closed:

- destructive SQL + no declaration → `MIGRATION_DESTRUCTIVE_OPERATION_UNDECLARED` (and per-operation `MIGRATION_DESTRUCTIVE_OPERATION_MISSING`);
- destructive SQL + only some operations declared → `MIGRATION_DESTRUCTIVE_OPERATION_MISSING:<id>:<op>`;
- destructive SQL + an operation outside the vocabulary → `MIGRATION_DESTRUCTIVE_OPERATION_UNKNOWN:<id>:<op>`;
- destructive SQL + placeholder approval → `MIGRATION_DESTRUCTIVE_APPROVAL_PLACEHOLDER`;
- destructive SQL + empty approval → `MIGRATION_DESTRUCTIVE_APPROVAL_MISSING`;
- destructive SQL + non-empty but non-structured approval → `MIGRATION_DESTRUCTIVE_APPROVAL_INVALID`;
- recognized dynamic/procedural ambiguity signal → `MIGRATION_DESTRUCTIVE_REVIEW_REQUIRED:<id>:<reason>` (regardless of declaration or approval);
- `destructive_operations` present + `risk_class` not `DESTRUCTIVE` → `MIGRATION_DESTRUCTIVE_RISK_REQUIRED`;
- `risk_class = DESTRUCTIVE` + no destructive content (no detected DDL and no declared operations) → `MIGRATION_DESTRUCTIVE_DECLARATION_SPURIOUS`;
- declared operation not actually present in the SQL → `MIGRATION_DESTRUCTIVE_DECLARATION_SPURIOUS:<id>:<op>`;
- duplicate operation declaration → `MIGRATION_DESTRUCTIVE_OPERATION_DUPLICATE:<id>:<op>`.

`MIGRATION_DESTRUCTIVE_OPERATION_UNDECLARED` and `MIGRATION_DESTRUCTIVE_APPROVAL_MISSING` reuse pre-existing error codes; the remaining codes (including `MIGRATION_DESTRUCTIVE_REVIEW_REQUIRED` and `MIGRATION_DESTRUCTIVE_APPROVAL_INVALID`) are added by this slice.

## Limitations (residual scope)

The validator is a **static regular-expression contract, not a full PostgreSQL parser**, and it does **not** prove Production safety. Be precise about what it does and does not establish:

- It **deterministically classifies** the recognized destructive operations above (scope 1).
- It **fails closed** on the recognized dynamic/procedural ambiguity signals above (scope 2): `EXECUTE` of a string/`format(...)`, `DO $$ ... $$` blocks, `LANGUAGE plpgsql` bodies, and `format(...)`/concatenation that assembles a DDL keyword.
- It does **not** prove the **absence** of destructive semantics the regex does not recognize (scope 3). An unrecognized PostgreSQL construct is not shown to be safe merely because no signal matched.

Examples that remain residual limitations (not proven safe, and not all individually signaled):

- dynamic SQL spelled in ways the signals do not recognize;
- conditional or generated DDL outside the recognized `format(...)`/concatenation patterns;
- unusual `ALTER COLUMN ... SET DATA TYPE` spellings beyond the `ALTER COLUMN ... TYPE` signal;
- indirect cascade semantics not written as `ON DELETE/UPDATE CASCADE`;
- DDL reached through unrecognized procedural control flow.

This guard is **not** equivalent to a PostgreSQL parser and does **not** detect all dynamic SQL. A future PostgreSQL parser and/or disposable-engine rehearsal is a separate, required complement for final assurance; until then, recognized ambiguity signals fail closed and unrecognized semantics are an acknowledged residual risk, never a claimed proof of safety.

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
