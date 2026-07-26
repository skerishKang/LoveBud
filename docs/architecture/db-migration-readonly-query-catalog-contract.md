# DB Migration Read-only Query Catalog Contract

## Purpose

This document is the normative repository authority for the fixed read-only PostgreSQL query catalog used by future canonical migration precondition evaluation.

This child is source-static only. It defines the authority file and the future schema. It does not load, resolve, execute, or evaluate a query.

## Fixed authority path

The only catalog authority is:

```text
db/migration-provenance/readonly-query-catalog.json
```

No adapter, manifest, environment variable, caller argument, alternate file, path, URL, credential, operator input, hostname, or dynamic input may override, supplement, or replace this authority.

## Current inactive state

The committed catalog is exactly:

```json
{
  "format_version": "1.0",
  "status": "ADOPTION_REQUIRED",
  "queries": {}
}
```

The committed catalog contains zero query entries and no SQL text.

Its exact top-level keys, in authority order, are:

```text
format_version
status
queries
```

## Status contract

The only catalog statuses are:

```text
ADOPTION_REQUIRED
ACTIVE
```

Normative status rules:

- `ADOPTION_REQUIRED` requires `queries` to be exactly an empty plain object.
- `ACTIVE` requires `queries` to be a non-empty plain-object mapping with at least one valid query entry.
- Transition from `ADOPTION_REQUIRED` to `ACTIVE` requires a separately approved contract/adoption child.
- This child does not authorize or perform that transition.

## Authority separation

### Precondition registry ownership

The canonical precondition registry owns only:

```text
migration_id
check_id
query_reference
expected
```

The registry does not own SQL text, a query object, result kind, or result field.

### Read-only query catalog ownership

The read-only query catalog owns only:

```text
fixed query object
raw result contract
```

The catalog does not own `migration_id` or the registry's `expected` boolean.

The registry's stable `query_reference` selects a catalog mapping key. The future loader/resolver may join those authorities, but it must not transfer, duplicate, infer, override, or supplement ownership between them.

## Future ACTIVE schema

The top-level exact key set remains:

```text
format_version
status
queries
```

For `ACTIVE`, `queries` is a mapping whose keys are stable `query_reference` values.

The query mapping key grammar is exactly:

```regex
^[a-z0-9]+(?:-[a-z0-9]+)*$
```

Each mapping key must equal its entry's `name` exactly.

A future entry has the exact keys:

```text
name
text
values
result_contract
```

Example shape only; this child does not commit an ACTIVE entry or executable SQL:

```json
{
  "example-readonly-query-v1": {
    "name": "example-readonly-query-v1",
    "text": "fixed read-only SQL",
    "values": [],
    "result_contract": {
      "kind": "BOOLEAN_SINGLE_ROW",
      "field": "satisfied"
    }
  }
}
```

### `name`

`name` is a string and must equal the containing query mapping key exactly.

### `text`

`text` represents exactly one repository-fixed, read-only PostgreSQL query.

The following are prohibited:

```text
caller interpolation
dynamic identifier
environment fallback
path
URL
credential
operator input
secret input
mutating SQL
transaction control
session control
lock manipulation
data-modifying CTE
multiple SQL statements
SELECT INTO
row-locking clauses
```

A future adoption or loader/resolver child must fail closed for prohibited behavior. This source-static child intentionally adds neither a SQL parser nor a regex-only security validator because the committed catalog is empty.

### `values`

`values` may later contain only a dense, fixed JSON scalar array. Allowed scalar categories are string, number, boolean, and null, subject to the separately approved loader/resolver contract.

Nested object authority and nested array authority are prohibited.

Caller-provided values, environment-derived values, secret values, operator-provided values, or runtime interpolation are prohibited.

### `result_contract`

`result_contract` has the exact keys:

```text
kind
field
```

The initially allowed `kind` is exactly:

```text
BOOLEAN_SINGLE_ROW
```

`field` is a stable lower-snake-case identifier matching:

```regex
^[a-z][a-z0-9]*(?:_[a-z0-9]+)*$
```

No new result kind or field authority is permitted without a separate contract amendment.

## BOOLEAN_SINGLE_ROW future semantics

A future runtime adapter must preserve these exact semantics:

| Evidence | Result |
|---|---|
| Exactly one row, named field exists, field value is boolean, and field value is strictly equal to the registry `expected` boolean | `PASS` |
| Exactly one row, named field exists, field value is boolean, and field value is not strictly equal to the registry `expected` boolean | `FAIL` |
| Zero rows | `UNAVAILABLE` |
| Multiple rows | `UNAVAILABLE` |
| Missing named field | `UNAVAILABLE` |
| `null` field value | `UNAVAILABLE` |
| Non-boolean field value | `UNAVAILABLE` |
| Unsafe, Proxy-backed, accessor-backed, or otherwise untrustworthy evidence | `UNAVAILABLE` |

This child does not return runtime status and does not execute a query.

## Override prohibition

The catalog authority must not be overridden or supplemented by:

```text
adapter
manifest
environment variable
caller argument
alternate file
path
URL
credential
operator identity
hostname
dynamic input
```

Unknown `query_reference` values must not be supplied by fallback, inference, caller text, environment text, or a second catalog.

## Source-static implementation boundary

The cumulative changed-file boundary for this child is exactly:

```text
db/migration-provenance/readonly-query-catalog.json
docs/architecture/db-migration-readonly-query-catalog-contract.md
tests/contracts/db-migration-readonly-query-catalog-contract.test.cjs
tests/test-layer-classification.json
docs/architecture/DB_MIGRATION_PROVENANCE_NEXT_CHILD_DECISION.md
```

This child adds none of the following:

```text
catalog loader
catalog resolver
evaluatePrecondition
queryLockedSession call
SQL execution
database connection
Docker or PostgreSQL execution
runtime composition
Production adoption
secret inspection
environment or provider modification
```

## Required implementation sequence

The canonical implementation sequence is:

1. Precondition authority contract — completed.
2. Registry validator and source-validation integration — completed.
3. Fixed read-only query catalog contract — completed by this child.
4. Precondition registry/catalog loader-resolver — next child selected.
5. `evaluatePrecondition` adapter — future child, not selected.
6. Composition root — future child, not selected.
7. Disposable PostgreSQL rehearsal — future child, not selected.
8. Separately approved environment adoption — future child, not selected.

No step may be skipped. Step 4 is the only next child selected by this decision.

## Source-static test contract

The repository contract test verifies the committed inactive JSON, exact key sets, empty mapping, absence of committed SQL text, inactive/ACTIVE status rules, key grammar, name equality, future exact entry and result-contract keys, initial result kind, authority separation, override prohibitions, current non-runtime boundary, implementation sequence, exact test-layer registration, and protected-reference hygiene.

It does not claim executable SQL safety, database behavior, pinned-session behavior, or runtime result mapping has been implemented.

## Rollback

Rollback is repository-only: revert this child as one unit. No database rollback, SQL rollback, credential action, environment change, provider change, or Production action is required because this child performs none of those operations.

## Completion boundary

This child is complete only when all five allowed files are present in the cumulative diff, the catalog remains exactly inactive and empty, the source-static contract passes, the classification entry exists exactly once as `SOURCE_STATIC`, and CI is green.

Completion does not authorize Ready conversion, merge, Issue closure, ACTIVE adoption, runtime implementation, database access, SQL execution, Docker/PostgreSQL execution, or Production access.

## References

- Refs #3669
- Refs #3657
- Refs #3659 — completed
- Refs #3660 — merged
- Refs #3658 — completed
- Refs #3652
- Refs #3650
- Refs #3646
- Refs #3458 — Keep OPEN
- Refs #3425 — Keep OPEN
- Refs #3435 — Keep OPEN
- Refs #3437 — Keep OPEN
- Refs #1882 — Keep OPEN
