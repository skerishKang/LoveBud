# DB Migration Precondition Authority Contract

Status: design-contract authority for Issue #3657. This contract defines the **precondition registry** and the **evaluatePrecondition adapter boundary** for the canonical migration runner. It is **not** an adapter implementation, **not** a query catalog, **not** a SQL execution engine, and **not** a database-connected service.

## Baseline

| Field | Value |
| --- | --- |
| Repository | `skerishKang/LoveBud` |
| Baseline `origin/main` SHA | `b4cbefddbf1ae13540eaaf07dc74fac8b5823c43` |
| Issue | #3657 |
| Precondition registry | `db/migration-provenance/precondition-registry.json` |
| Authority contract | `docs/architecture/db-migration-precondition-authority-contract.md` |
| Contract test | `tests/contracts/db-migration-precondition-authority-contract.test.cjs` |

## Purpose

Define the migration precondition authority boundary: what a precondition is, where it is registered, how it binds to a target migration, how it references read-only queries without embedding SQL, how each check produces evidence, how evidence maps to status, and what is forbidden before the registry is adopted.

This contract exists to prevent:
- arbitrary SQL injection disguised as precondition logic;
- silent PASS when no precondition is defined;
- precondition logic scattered across adapter files;
- migration execution without defined preconditions;
- registry and query catalog coupling.

## Current inactive state

The precondition registry exists at a fixed path with a single inactive shape:

```json
{
  "format_version": "1.0",
  "status": "ADOPTION_REQUIRED",
  "entries": []
}
```

This file proves the contract boundary exists. It does **not** mean:
- the precondition system is active;
- any migration has preconditions defined;
- SQL queries are authorized;
- the runner may execute migrations;
- Production adoption is approved.

When `status` is `ADOPTION_REQUIRED`, every `evaluatePrecondition` call returns `NOT_EVALUATED` without inspecting query catalog, registry entries, or database state.

## Authority ownership

- **Registry authority:** `db/migration-provenance/precondition-registry.json` is the single source of truth for migration precondition declarations.
- **Contract authority:** this document is the single source of truth for precondition semantics, evidence contract, and status mapping.
- **Future query authority:** a separately approved `db/migration-provenance/readonly-query-catalog.json` (or equivalent) will be the single source of truth for read-only query definitions.
- **No other location** may declare, override, or supplement precondition definitions.

## Fixed registry path

```
db/migration-provenance/precondition-registry.json
```

This path is fixed. No alternative, fallback, environment-variable-derived, or caller-supplied path is allowed. The file must be valid JSON and readable by `require()` or `JSON.parse` of the filesystem content.

## Registry top-level schema

```json
{
  "format_version": "<semver-string>",
  "status": "<ADOPTION_REQUIRED|ACTIVE>",
  "entries": ["<array-of-entry-objects>"]
}
```

- `format_version` — currently `"1.0"`. Future versions require a separately approved contract update.
- `status` — enum. `ADOPTION_REQUIRED` means inactive (all calls `NOT_EVALUATED`). `ACTIVE` means the registry is authoritative.
- `entries` — array of entry objects. When `ADOPTION_REQUIRED`, must be empty `[]`. When `ACTIVE`, must be a non-empty dense array.

**Forbidden top-level keys:** `query`, `text`, `sql`, `url`, `env`, `credential`, `operator`, `hostname`, `caller_path`, `dynamic_source`, `allowlist`, `overrides`.

## Registry entry schema

Each entry in `entries` when `ACTIVE`:

```json
{
  "migration_id": "20260725000000_example-migration",
  "checks": [
    {
      "check_id": "example-condition",
      "query_reference": "example-readonly-query-v1",
      "evidence_contract": {
        "kind": "BOOLEAN_SINGLE_ROW",
        "field": "satisfied",
        "expected": true
      }
    }
  ]
}
```

### Rules

- `migration_id` — exact match to a migration ID in the canonical manifest (`db/migration-provenance/canonical-migrations.json`). The registry **must not** invent, override, or alias migration IDs. Duplicate `migration_id` across entries is forbidden.
- `checks` — non-empty dense array when registry is `ACTIVE`. Duplicate `check_id` is forbidden. Each `check_id` is a stable kebab-case string.
- `query_reference` — a fixed string key that maps to a read-only query definition in the future fixed query catalog. SQL text must **not** be stored in the registry.
- `evidence_contract` — defines how to interpret the query result. See the Evidence contract section.

**Forbidden entry-level keys:** `query`, `text`, `sql`, `url`, `env`, `credential`, `operator`, `hostname`, `caller_path`, `dynamic_source`, `allowlist`.

## Check schema

A `check` object under `checks`:

| Field | Type | Required | Description |
| --- | --- | --- | --- |
| `check_id` | string | yes | Stable kebab-case identifier. Unique within the entry. |
| `query_reference` | string | yes | Key into the future fixed read-only query catalog. |
| `evidence_contract` | object | yes | Defines result interpretation. |

### Future extension

New check-level fields (e.g., `depends_on`, `timeout_ms`, `retry_policy`) require a separately approved contract amendment.

## Migration binding

- A registry entry's `migration_id` must exist in `canonical-migrations.json` `migrations[].id`.
- If the canonical manifest is `ADOPTION_REQUIRED` with `migrations: []`, **no** registry entry is valid (even if one somehow exists).
- The registry **must not** be used to introduce new migration IDs, change migration order, or override checksum/dependency/destructive declarations from the canonical manifest.
- The future `evaluatePrecondition` must cross-validate the target migration against both the registry and the canonical manifest.

## Query-reference boundary

- The registry stores only `query_reference` strings.
- A `query_reference` is a stable, allowlisted key in the future fixed query catalog.
- The query catalog defines the exact read-only SQL text, parameter shape, and result contract.
- The registry **must not** contain SQL text, raw query strings, file paths, URLs, environment variables, database identifiers, credentials, or dynamic parameter sources.
- The future `evaluatePrecondition` **must not** accept caller-supplied query text, file paths, or overrides.

## Future fixed query catalog

A separately approved child will define:

```
db/migration-provenance/readonly-query-catalog.json
```

(or equivalent fixed path). The catalog will be a frozen key-value mapping from `query_reference` to a read-only query object with:

- `name` — stable kebab-case, matches the reference key
- `text` — exact read-only SQL text (SELECT-only, no DDL/DML mutation)
- `params` — optional array of parameter descriptors
- `result_contract` — the expected result shape (e.g., `{ kind: 'BOOLEAN_SINGLE_ROW', field: 'satisfied' }`)

No SQL text, catalog, or catalog contract is created in this child.

## Evidence contract

The `evidence_contract` object in each check defines how the query result is interpreted to produce a boolean condition.

### Supported kind: `BOOLEAN_SINGLE_ROW`

```json
{
  "kind": "BOOLEAN_SINGLE_ROW",
  "field": "<field-name>",
  "expected": true
}
```

Rules:
- The query must return exactly one row.
- The row must contain the named `field` as a boolean value.
- The check passes (`PASS`) when the field value equals `expected`.
- The check fails (`FAIL`) when the field value does not equal `expected`.
- Any deviation from the expected shape (zero rows, multiple rows, missing field, non-boolean type, null, accessor, Proxy trap) produces `UNAVAILABLE`.

### Future evidence kinds

Any new `kind` value (e.g., `ROW_COUNT`, `STRING_MATCH`, `ARRAY_CONTAINS`) requires a separately approved contract amendment. Unknown or unrecognized `kind` values fail closed as `UNAVAILABLE`.

## Status mapping

### NOT_EVALUATED

Returned when no evaluation was attempted. Conditions:
- registry `status === "ADOPTION_REQUIRED"`
- target migration has no entry in registry entries
- target migration ID is not in canonical manifest
- entry exists but `checks` is undefined, null, or empty
- query catalog authority is not yet established
- `evaluatePrecondition` not called

### PASS

Returned when:
- registry `status === "ACTIVE"`
- canonical manifest binding is valid
- target entry exists in registry
- `checks` is non-empty
- every check executes safely
- every check's evidence matches the expected contract
- every evidence contract is satisfied (all pass)

**`PASS` is never returned when no precondition is defined.**

### FAIL

Returned when:
- query execution succeeded
- evidence shape is valid
- one or more expected conditions are not satisfied
- no check produced `UNAVAILABLE`

### UNAVAILABLE

Returned when:
- registry or catalog cannot be read or validated
- broker throw or rejection
- malformed query result
- missing row or field
- accessor, Proxy, or trap failure
- unexpected evaluation failure
- evidence contract violation (wrong kind, missing field, wrong type)

## Multi-check precedence

```text
One or more UNAVAILABLE  →  UNAVAILABLE
Otherwise, one or more FAIL  →  FAIL
All checks authoritative match  →  PASS
```

`NOT_EVALUATED` is returned **only** before query execution (registry inactive, missing entry, empty checks, etc.). Once any query is attempted, the result is `PASS`, `FAIL`, or `UNAVAILABLE`.

## No-precondition semantics

```text
No precondition defined  →  NOT_EVALUATED (not PASS)
Empty checks            →  NOT_EVALUATED (not PASS)
Unknown migration       →  NOT_EVALUATED (not PASS)
Registry unavailable    →  NOT_EVALUATED (not PASS)
Query catalog missing   →  NOT_EVALUATED (not PASS)
```

**`PASS` is never an automatic default.** Every `PASS` requires defined non-empty checks that execute with authoritative evidence.

## Source-validation integration

The existing source-validation adapter (`scripts/migration-source-validation-adapter-core.cjs`) currently returns a fixed `{ status: 'NOT_EVALUATED', reason: 'PRECONDITION_NOT_IMPLEMENTED' }` for preconditions. This contract defines the authority boundary that source validation will integrate with:

- source validation calls `evaluatePrecondition` when the precondition registry is `ACTIVE`;
- source validation returns `NOT_EVALUATED` when the registry is `ADOPTION_REQUIRED`;
- source validation does **not** define, override, or bypass precondition logic.

The source-validation adapter itself is **not** changed in this child.

## Manifest relationship

- The canonical manifest (`db/migration-provenance/canonical-migrations.json`) owns migration identity, order, and checksum authority.
- The precondition registry references manifest migration IDs. It **must not** invent migration IDs.
- The current canonical manifest remains `ADOPTION_REQUIRED` with `migrations: []`.
- The current manifest adapter (`scripts/migration-canonical-manifest-adapter-core.cjs`) is **not** changed.
- No `expected_preconditions` field is added to the canonical manifest or its projection.
- Future source validation will cross-validate the registry against the full canonical manifest (every manifest migration has a registry entry, every registry entry references a manifest migration, no orphan entries).

## Orchestrator relationship

The orchestrator (`scripts/migration-runner-orchestrator-core.cjs`) calls a precondition adapter as one of its dependency-injected gates. The precondition adapter contract envelope:

```js
evaluatePrecondition({
  targetMigrationId,
  lockHandle
})
```

Returns `{ status: 'PASS' | 'FAIL' | 'UNAVAILABLE' | 'NOT_EVALUATED' }`.

The orchestrator gates migration execution on precondition `PASS`. Any other status blocks execution.

The orchestrator itself is **not** changed in this child.

## Pinned-session broker relationship

The future precondition adapter will read the registry and query catalog as a filesystem-only operation. It does **not** require a database session or lock handle to evaluate preconditions. The `lockHandle` parameter in the envelope is reserved for future use where a precondition check executes a read-only query through the pinned-session query broker.

## Sensitive-data boundary

- The precondition registry is a static JSON file committed to the repository. It must not contain secrets, credentials, connection strings, tokens, service account paths, or production environment identifiers.
- Query results from precondition evaluation must not be logged, serialized, committed, or exposed outside the `evaluatePrecondition` return status.
- Raw precondition check evidence (individual check results, row data) must not be exposed to the orchestrator, adapters, or callers.
- Error messages from precondition evaluation must be sanitized. Raw SQL errors, broker errors, or filesystem errors must not be exposed.

## Prohibited behaviors

The following are **strictly forbidden** in this and all related files:

1. Storing SQL text in the precondition registry
2. Storing file paths, URLs, environment variables, or credentials in the precondition registry
3. Accepting caller-supplied query text, file paths, or overrides in `evaluatePrecondition`
4. Returning `PASS` when no precondition entry or no checks are defined
5. Returning `PASS` when the registry is `ADOPTION_REQUIRED`
6. Bypassing the registry by defining preconditions in adapter code
7. Embedding precondition logic in the orchestrator, protocol, manifest adapter, or lock adapter
8. Adding `expected_preconditions` or equivalent to the canonical manifest or its adapter
9. Executing SQL queries from the precondition module (queries go through the catalog-bound broker only)
10. Changing the canonical manifest, manifest adapter, orchestrator, protocol, lock adapter, or ledger adapter in this child
11. Installing packages, modifying package.json or package-lock.json
12. Modifying UI components, pages, CSS, or workflow files
13. Starting Docker, PostgreSQL, or any database-connected service
14. Exposing registry or query evidence outside the `evaluatePrecondition` return status
15. Overriding or bypassing the multi-check precedence rules

## Required implementation sequence

```text
1. precondition authority contract — THIS CHILD (design-contract authority only)
2. registry validator + source-validation integration
3. fixed read-only query catalog contract
4. precondition registry loader/resolver
5. evaluatePrecondition adapter
6. composition root
7. disposable PostgreSQL rehearsal
8. separately approved environment adoption
```

Each step depends on the previous. This child resolves step 1 only.

## Required future tests

The following tests are required in future children:

- Precondition registry validator: structural validation, duplicate migration_id rejection, duplicate check_id rejection, empty checks rejection when ACTIVE, unknown migration_id rejection when canonical manifest is available.
- Registry status transition rules: ADOPTION_REQUIRED to ACTIVE requires non-empty entries.
- evaluatePrecondition contract: NOT_EVALUATED for inactive registry, missing entry, empty checks, unknown migration, missing query catalog. PASS for defined matching conditions. FAIL for defined mismatching conditions. UNAVAILABLE for registry read failure, query execution failure, malformed evidence, Proxy/accessor traps.
- Multi-check precedence: UNAVAILABLE over FAIL, FAIL over PASS, all PASS produces PASS.
- No-precondition enforcement: no entry returns NOT_EVALUATED, never PASS.
- Query-reference resolution: valid reference maps to catalog query, unknown reference returns UNAVAILABLE.
- Cross-validation with canonical manifest: registry migration_id matches manifest, no orphan entries.
- Caller override rejection: caller-supplied query/text/path/url returns UNAVAILABLE or is rejected before evaluation.
- Security-sensitive boundary: no SQL/URL/credential/env/operator/hostname in registry, no evidence leakage.

## Rollback

This is a documentation and contract-file-only change.

- Rollback: revert the child PR.
- Database rollback: not applicable.
- Production rollback: not applicable.
- Forward fix: a later narrow contract correction.

## Completion boundary

This child is complete when:

1. The precondition registry exists at the fixed path with exact inactive shape.
2. This authority contract document exists with all required sections.
3. A source-static contract test validates registry structure, document assertions, and status semantics.
4. The registry is registered as `SOURCE_STATIC` in the classification.
5. The next-child decision is updated reflecting that only step 1 (design-contract authority) is resolved.
6. Only the five allowed files are changed.
7. No database, SQL, Docker, Production, or secret access occurred.
8. Issue #3657 and all protected issues remain open.

## References

- Refs #3657 — Migration precondition authority.
- Refs #3652 — Registry validator + source-validation integration (next child).
- Refs #3650 — Fixed read-only query catalog contract (future).
- Refs #3646 — Pinned-session query broker.
- Refs #3458 — Canonical migration runner.
- Refs #3425 — Canonical migration identity/order/checksum.
- Refs #3435 — Legacy tree schema repair.
- Refs #3437 — Generic social targets.
- Refs #1882 — Repository provenance.
