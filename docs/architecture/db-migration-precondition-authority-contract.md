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
- **Future query authority:** a separately approved `db/migration-provenance/readonly-query-catalog.json` will be the single source of truth for read-only query definitions.
- **No other location** may declare, override, or supplement precondition definitions.

## Fixed registry path

```
db/migration-provenance/precondition-registry.json
```

This path is fixed. No alternative, fallback, environment-variable-derived, or caller-supplied path is allowed.

**Loader boundary.** The registry is read through a fixed-file loader contract:

```text
derive repository root from module location
fixed repository-relative path only
lexical containment (no .. traversal)
repository/target realpath resolution
realpath containment (resolved path stays under repository root)
regular-file check
read verified realTarget exactly once as UTF-8
JSON.parse exactly once
validate exactly once
no require cache (module.cache must not be used)
no caller path or cwd authority
```

`require()` is **not** allowed as a registry or catalog authority loader because the module cache and shared-object semantics violate the exact-read/parse boundary.

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
      "expected": true
    }
  ]
}
```

### Rules

- `migration_id` — exact match to a migration ID in the canonical manifest (`db/migration-provenance/canonical-migrations.json`). The registry **must not** invent, override, or alias migration IDs. Duplicate `migration_id` across entries is forbidden.
- `checks` — non-empty dense array when registry is `ACTIVE`. Duplicate `check_id` is forbidden. Each `check_id` is a stable kebab-case string.
- `query_reference` — a fixed string key that maps to a read-only query definition in the future fixed query catalog. SQL text must **not** be stored in the registry.
- `expected` — the boolean value that the query result field must match for the check to pass. The catalog owns the raw result shape (`kind`, `field`); the registry owns only the expected boolean.

**Forbidden entry-level keys:** `query`, `text`, `sql`, `url`, `env`, `credential`, `operator`, `hostname`, `caller_path`, `dynamic_source`, `allowlist`, `evidence_contract`, `kind`, `field`.

## Check schema

A `check` object under `checks`:

| Field | Type | Required | Description |
| --- | --- | --- | --- |
| `check_id` | string | yes | Stable kebab-case identifier. Unique within the entry. |
| `query_reference` | string | yes | Key into the future fixed read-only query catalog. |
| `expected` | boolean | yes | Expected boolean value for the query result field. |

### Forbidden check-level keys

`evidence_contract`, `kind`, `field`, `query`, `text`, `sql`, `url`, `env`, `credential`, `operator`, `hostname`, `caller_path`, `dynamic_source`, `allowlist`.

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
- The query catalog defines the exact read-only SQL text, parameter shape, and raw result contract.
- The registry **must not** contain SQL text, raw query strings, file paths, URLs, environment variables, database identifiers, credentials, or dynamic parameter sources.
- The future `evaluatePrecondition` **must not** accept caller-supplied query text, file paths, or overrides.

## Future fixed query catalog

A separately approved child will define the exact fixed path below. The catalog will be a frozen key-value mapping from `query_reference` to a read-only query object:

```json
{
  "name": "example-readonly-query-v1",
  "text": "fixed read-only SQL (SELECT only, no DDL/DML mutation)",
  "values": [],
  "result_contract": {
    "kind": "BOOLEAN_SINGLE_ROW",
    "field": "satisfied"
  }
}
```

The catalog owns the raw result contract (`kind`, `field`). The registry owns the expected boolean. Neither duplicates the other's authority.

No SQL text, catalog, or catalog contract is created in this child.

## Result contract

The **future fixed query catalog** owns the raw result contract. The **registry** owns only the expected boolean. The two are never duplicated.

### Catalog-owned: `result_contract`

The catalog entry defines how the raw query result is interpreted:

```json
{
  "name": "example-readonly-query-v1",
  "text": "SELECT satisfied FROM precondition_checks WHERE id = $1",
  "values": [],
  "result_contract": {
    "kind": "BOOLEAN_SINGLE_ROW",
    "field": "satisfied"
  }
}
```

### Registry-owned: `expected`

The registry check stores only the expected boolean:

```json
{
  "check_id": "example-condition",
  "query_reference": "example-readonly-query-v1",
  "expected": true
}
```

### BOOLEAN_SINGLE_ROW semantics

Rules:
- The query must return exactly one row.
- The row must contain the named `field` as a boolean value.
- The check passes (`PASS`) when the field value equals the registry `expected` value.
- The check fails (`FAIL`) when the field value does not equal `expected`.
- Any deviation from the expected shape (zero rows, multiple rows, missing field, non-boolean type, null, accessor, Proxy trap) produces `UNAVAILABLE`.

### Future evidence kinds

Any new `kind` value (e.g., `ROW_COUNT`, `STRING_MATCH`, `ARRAY_CONTAINS`) requires a separately approved contract amendment. Unknown or unrecognized `kind` values fail closed as `UNAVAILABLE`.

## Status mapping

### Normative status matrix

| Condition | Phase | Required status |
|---|---|---|
| Registry safely loaded and status is `ADOPTION_REQUIRED` | runtime | `NOT_EVALUATED` |
| Query-catalog authority has not yet been adopted and registry remains `ADOPTION_REQUIRED` | runtime | `NOT_EVALUATED` |
| ACTIVE registry lacks the target entry or has empty checks | source validation | `FAIL` |
| ACTIVE registry lacks the target entry or has empty checks despite source validation | runtime defensive fallback | `NOT_EVALUATED` |
| Fixed registry/catalog file missing or unreadable | source/runtime | `UNAVAILABLE` |
| JSON successfully read but malformed or contract-invalid | source validation | `FAIL` |
| Unsafe/malformed registry/catalog evidence reaches runtime | runtime | `UNAVAILABLE` |
| Broker throw/rejection or malformed query evidence | runtime | `UNAVAILABLE` |
| Valid evidence disagrees with expected value | runtime | `FAIL` |
| All defined non-empty checks match | runtime | `PASS` |

### Key distinction: authority-not-adopted vs actual failure

```text
Registry intentionally ADOPTION_REQUIRED
  → NOT_EVALUATED

Catalog authority not yet adopted AND registry ADOPTION_REQUIRED
  → NOT_EVALUATED

Required fixed registry/catalog file missing, unreadable, parse failed, or validation failed
  → UNAVAILABLE (for file-level failure)
  → FAIL (for confirmed invalid content)
```

**`PASS` is never returned when no precondition is defined.**

### Multi-check precedence

```text
One or more UNAVAILABLE  →  UNAVAILABLE
Otherwise, one or more FAIL  →  FAIL
All checks authoritative match  →  PASS
```

`NOT_EVALUATED` is returned **only** when no query execution is attempted (registry inactive, missing entry, empty checks as runtime defensive fallback, etc.). Once any query is attempted, the result is `PASS`, `FAIL`, or `UNAVAILABLE`.

### No-precondition semantics

```text
No precondition defined  →  NOT_EVALUATED (not PASS)
Empty checks (source)    →  FAIL
Empty checks (runtime)   →  NOT_EVALUATED (defensive fallback)
Authority not adopted    →  NOT_EVALUATED
```

**`PASS` is never an automatic default.** Every `PASS` requires defined non-empty checks that execute with authoritative evidence.

## Source-validation integration

The existing migration source-validation adapter (`scripts/migration-source-validation-adapter-core.cjs`) returns only its existing frozen source-integrity status record:

```text
{ status: PASS | FAIL | UNAVAILABLE }
```

This child does **not** modify that adapter.

### Source validation role

Source validation validates the precondition registry as a **fixed source input**, independently from the runtime precondition evaluator. Source validation does **not** call `evaluatePrecondition`.

### Source validation responsibilities

```text
1. Load fixed registry file
2. Validate registry schema (top-level keys, status enum, entries structure)
3. If ADOPTION_REQUIRED + entries=[] → PASS (valid inactive state)
4. Validate ACTIVE schema when status is ACTIVE
5. Cross-validate migration IDs against canonical manifest
6. Detect duplicate migration_id or check_id
7. Validate query_reference format
8. Detect orphan entries (migration_id not in manifest)
```

### Source validation result mapping

- Confirmed invalid source content → `FAIL`
- Missing/unreadable registry file → `UNAVAILABLE`
- Current valid inactive registry → `PASS`

A future child may add the registry as an additional fixed source input while preserving the exact public result shape (`{ status: PASS | FAIL | UNAVAILABLE }`). No `reason` field or precondition-specific result is added.

## Manifest relationship

- The canonical manifest (`db/migration-provenance/canonical-migrations.json`) owns migration identity, order, and checksum authority.
- The precondition registry references manifest migration IDs. It **must not** invent migration IDs.
- The current canonical manifest remains `ADOPTION_REQUIRED` with two catalogued migrations (catalog population is distinct from adoption).
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

Registry and catalog loading are filesystem/source operations that do not require a database session or lock handle.

Actual precondition check execution is a **runtime operation** and requires:

1. the orchestrator-supplied opaque `lockHandle`;
2. the same lock-adapter instance that owns the handle;
3. `queryLockedSession({ lockHandle, query })` to execute through the exact captured pinned session;
4. zero implicit unlock or pool release.

The runtime adapter does **not** expose or re-inspect the session or query callable. Release ownership remains exclusively with `releaseAdvisoryLock`.

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
16. Storing `evidence_contract`, `kind`, or `field` in the registry (these belong to the query catalog only)
17. Using `require()` as a registry or catalog authority loader

## Required implementation sequence

```text
1. precondition authority contract — THIS CHILD (design-contract authority only)
2. registry validator + source-validation integration (NEW ISSUE REQUIRED)
3. fixed read-only query catalog contract (NEW ISSUE REQUIRED)
4. precondition registry loader/resolver
5. evaluatePrecondition adapter
6. composition root
7. disposable PostgreSQL rehearsal
8. separately approved environment adoption
```

Each step depends on the previous. This child resolves step 1 only.

## Required future tests

The following tests are required in future children:

### NOT_EVALUATED future cases

- Registry safely loaded with `ADOPTION_REQUIRED`.
- Catalog authority deliberately not adopted while registry remains `ADOPTION_REQUIRED`.
- `ACTIVE` registry target-entry/empty-check invariant reaching runtime only as defensive fallback.

### Source validation FAIL cases

- `ACTIVE` registry missing target entry.
- `ACTIVE` registry empty checks.
- Orphan/unknown migration ID.
- Malformed registry content.
- Duplicate `migration_id`.
- Duplicate `check_id`.
- Invalid `query_reference`.

### UNAVAILABLE cases

- Required fixed registry file missing or unreadable.
- Required fixed catalog file missing or unreadable after catalog authority adoption.
- Realpath/read dependency unavailable.
- JSON parse dependency failure.
- Unsafe evidence reaching runtime.
- Broker throw/rejection.
- Malformed query result.

### PASS cases

- All defined non-empty checks match with authoritative evidence.

### FAIL cases

- Valid evidence disagrees with expected value.

### Additional required tests

- Precondition registry validator: structural validation, duplicate `migration_id` rejection, duplicate `check_id` rejection, empty checks rejection when `ACTIVE`, unknown `migration_id` rejection when canonical manifest is available.
- Registry status transition rules: `ADOPTION_REQUIRED` to `ACTIVE` requires non-empty entries.
- evaluatePrecondition contract: `PASS` for defined matching conditions. `FAIL` for defined mismatching conditions.
- Multi-check precedence: `UNAVAILABLE` over `FAIL`, `FAIL` over `PASS`, all `PASS` produces `PASS`.
- No-precondition enforcement: no entry returns `NOT_EVALUATED`, never `PASS`.
- Query-reference resolution: valid reference maps to catalog query, unknown reference returns `UNAVAILABLE`.
- Cross-validation with canonical manifest: registry `migration_id` matches manifest, no orphan entries.
- Caller override rejection: caller-supplied query/text/path/url returns `UNAVAILABLE` or is rejected before evaluation.
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

- Refs #3657 — Migration precondition authority (Keep OPEN).
- Refs #3652 / PR #3653 — Canonical manifest loader adapter (prior completed dependency).
- Refs #3650 — Source-validation adapter (prior completed dependency).
- Refs #3646 — Pinned-session query broker (prior completed dependency).
- Refs #3458 — Canonical migration runner (Keep OPEN).
- Refs #3425 — Canonical migration identity/order/checksum (Keep OPEN).
- Refs #3435 — Legacy tree schema repair (Keep OPEN).
- Refs #3437 — Generic social targets (Keep OPEN).
- Refs #1882 — Repository provenance (Keep OPEN).
