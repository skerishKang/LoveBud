# DB Migration Precondition Authority Loader-Resolver Contract

## Purpose

This document is the normative contract for Issue #3678, Step 4 of the ordered migration-precondition authority sequence. It defines one repository/source-only loader-resolver that reads and joins the fixed precondition registry and fixed read-only query catalog.

This child does not execute, prepare, tokenize, interpolate, or send SQL. It does not call a broker, inspect a lock handle, connect to a database, implement `evaluatePrecondition`, use Docker/PostgreSQL, or access Production, staging, a provider, a credential, or a secret.

## Fixed authorities

The only authorities are:

```text
db/migration-provenance/precondition-registry.json
db/migration-provenance/readonly-query-catalog.json
```

Both committed files remain read-only and exactly inactive. No caller path, working directory, environment value, URL, credential, operator input, hostname, alternate file, fallback source, dynamic query text, or second catalog may override or supplement them.

## Public factory

The module exports exactly:

```js
createMigrationPreconditionAuthorityResolver(config?)
```

The returned object is frozen and has exactly one own enumerable data key:

```js
{
  resolvePreconditionAuthority
}
```

The call envelope is:

```js
await resolvePreconditionAuthority({ targetMigrationId })
```

The envelope must be an exact plain own-data object with exactly one enumerable string key, `targetMigrationId`. The value must match the canonical migration ID grammar:

```regex
^\d{14}_[a-z0-9]+(?:-[a-z0-9]+)*$
```

Proxy, accessor, inherited, symbol-keyed, sparse-array, extra-key, empty, or malformed caller input fails closed as `{ status: 'UNAVAILABLE' }`.

## Exact result vocabulary

Every public result is an exact-shape frozen record:

```text
{ status: 'ADOPTION_REQUIRED' }
{ status: 'NOT_FOUND' }
{ status: 'UNAVAILABLE' }
{ status: 'RESOLVED', checks: [...] }
```

No result contains a reason, source text, source object, filesystem error, path, hostname, credential, environment value, SQL error, row data, or diagnostic payload.

### ADOPTION_REQUIRED

The resolver returns only `{ status: 'ADOPTION_REQUIRED' }` when the fixed registry is safely loaded and validates as the exact inactive state:

```json
{
  "format_version": "1.0",
  "status": "ADOPTION_REQUIRED",
  "entries": []
}
```

This branch returns before registry-entry iteration, catalog realpath resolution, catalog stat, catalog read, catalog parse, query-reference resolution, or query-related behavior.

### NOT_FOUND

The resolver returns only `{ status: 'NOT_FOUND' }` for an otherwise structurally safe ACTIVE registry when the requested target entry is absent or the requested target entry has an empty dense `checks` array. The catalog is not needed for this defensive runtime-neutral result.

A future Step 5 adapter may map this state to `NOT_EVALUATED`. This child does not implement that adapter.

### UNAVAILABLE

The resolver returns only `{ status: 'UNAVAILABLE' }` for unsafe input or authority evidence, missing/unreadable/non-regular files, lexical or realpath escape, parse failure, malformed dependency results, malformed registry/catalog shape, status mismatch, unknown query reference, Proxy/accessor/inherited/symbol/sparse/nested authority, arbitrary thenable, Proxy Promise, or any thrown/rejected dependency.

Confirmed invalid source remains a source-validation concern. The runtime-neutral public boundary exposes no finer diagnostic.

### RESOLVED

The resolver returns `RESOLVED` only when the registry and catalog both validate as ACTIVE, the target has non-empty checks, and every stable registry `query_reference` resolves to exactly one catalog entry.

The exact projection is:

```js
{
  status: 'RESOLVED',
  checks: [
    {
      checkId,
      expected,
      query: {
        name,
        text,
        values,
        resultContract: {
          kind,
          field
        }
      }
    }
  ]
}
```

Registry check order is preserved. The result, checks array, every check, query, values array, and result contract are recursively frozen. Every object and array is detached from the caller, parsed registry, parsed catalog, and injected dependency result.

## Fixed loader sequence

For each required fixed authority, the loader performs this fail-closed sequence:

```text
1. derive repository root from module location
2. combine only the fixed repository-relative authority path
3. enforce lexical containment
4. resolve repository realpath once per call
5. resolve target realpath
6. enforce target realpath containment under repository realpath
7. require a regular file
8. read verified realTarget at most once as UTF-8
9. call the configured JSON parser exactly once for that loaded text
10. validate and project without retaining source references
```

`require()` and module cache are never JSON authority. The inactive path loads only the registry. An ACTIVE target with non-empty checks may additionally load the catalog. No required source is read or parsed more than once during one resolution.

## Optional dependency injection

`config` is either omitted or an exact plain own-data object containing only the optional key `dependencies`.

`dependencies` is an exact plain own-data object containing any subset of these keys only:

```text
realpath
isRegularFile
readUtf8File
parseJson
```

Every supplied value must be a non-Proxy function. Missing functions use the fixed defaults. No config key may provide a path, URL, credential, environment fallback, operator identity, hostname, alternate authority, registry object, catalog object, query text, SQL text, lock handle, broker, or database client.

Injected functions are test seams for the fixed loader transport only. They receive only resolver-owned fixed-path or loaded-text arguments. Their return may be synchronous or a genuine native `Promise`. Direct arbitrary thenables, Promise subclasses, Proxy-wrapped Promises, thrown/rejected calls, and malformed results fail closed. Factory configuration failures throw only:

```text
MIGRATION_PRECONDITION_AUTHORITY_RESOLVER_CONFIG_INVALID
```

The message contains no raw input or dependency detail.

## Registry validation boundary

The registry top level has exact keys:

```text
format_version
status
entries
```

`format_version` is exactly `1.0`. Status is exactly `ADOPTION_REQUIRED` or `ACTIVE`. `entries` is a dense ordinary array.

An ACTIVE entry has exact keys:

```text
migration_id
checks
```

Each check has exact keys:

```text
check_id
query_reference
expected
```

Migration IDs use the canonical migration grammar. Check IDs and query references use stable kebab-case:

```regex
^[a-z0-9]+(?:-[a-z0-9]+)*$
```

Duplicate migration IDs and duplicate check IDs within one entry are unavailable. `expected` is exactly boolean. Entry and check objects must be plain, own-data, enumerable-key objects with no Proxy, accessor, inherited, symbol, sparse, nested, or extra authority.

## Catalog validation boundary

The catalog top level has exact keys:

```text
format_version
status
queries
```

`format_version` is exactly `1.0`. `ADOPTION_REQUIRED` requires an exactly empty plain mapping. `ACTIVE` requires a non-empty plain own-data mapping.

Every mapping key uses stable kebab-case and equals the entry `name`. Each entry has exact keys:

```text
name
text
values
result_contract
```

`text` must be a non-empty repository-loaded string. The resolver treats it as inert authority data. It does not parse or claim that the text is PostgreSQL-read-only-safe.

`values` must be a dense ordinary array containing only fixed JSON scalars: string, finite number, boolean, or null. Nested arrays, nested objects, undefined, bigint, symbol, function, non-finite number, accessor, inherited value, sparse index, extra key, and Proxy authority are unavailable.

`result_contract` has exact keys:

```text
kind
field
```

`kind` is exactly `BOOLEAN_SINGLE_ROW`. `field` matches:

```regex
^[a-z][a-z0-9]*(?:_[a-z0-9]+)*$
```

Unknown references, key/name mismatch, status mismatch, extra/missing keys, or unknown result kinds are unavailable. There is no fallback, inference, environment lookup, caller query text, or alternate catalog.

## SQL and runtime boundary

This child does not:

```text
execute SQL
prepare SQL
interpolate SQL
tokenize SQL
claim regex proves SQL safety
call queryLockedSession
access lockHandle
connect to a database
create a pool or client
use network
use Docker/PostgreSQL
access Production or staging
read provider configuration
read credentials or secrets
modify registry or catalog
implement evaluatePrecondition
modify orchestrator/protocol/composition
modify manifest/lock/ledger/broker
```

Synthetic ACTIVE fixture strings prove only deterministic fixed-authority projection. Executable-query approval and PostgreSQL safety evidence require a separately authorized adoption/rehearsal path.

## Test evidence

The source/fake contract covers all 21 required categories: exact frozen surface, hostile call envelope, committed inactive result, no inactive catalog load, lexical/realpath/regular-file checks, read-once/parse-once, no require cache, registry failures, catalog failures, status mismatch, NOT_FOUND, unknown reference, exact key sets, grammars, dense scalars and hostile nested authority, stable order, recursive freeze and detachment, repeated references, no runtime side effect, Step 5 decision, classification, and protected-reference hygiene.

The test is classified `SOURCE_STATIC`: it executes only deterministic source code and synthetic fixed-loader seams. It has no database, network, SQL execution, Docker/PostgreSQL, Production, provider, or secret capability.

## Exact changed-file boundary

Exactly these five files may change:

```text
scripts/migration-precondition-authority-loader-resolver-core.cjs
tests/contracts/db-migration-precondition-authority-loader-resolver-contract.test.cjs
docs/architecture/db-migration-precondition-authority-loader-resolver-contract.md
tests/test-layer-classification.json
docs/architecture/DB_MIGRATION_PROVENANCE_NEXT_CHILD_DECISION.md
```

The registry JSON, catalog JSON, existing validator, source-validation adapter, packages, lockfiles, workflows, UI, Auth, API, CSS, Cloudflare, providers, and secrets remain unchanged.

## Sequence decision

Steps 1–4 are complete after this child. Step 5, the `evaluatePrecondition` adapter, is selected as the only next child but is not implemented here. Steps 6–8 are not authorized.

## Rollback

Rollback is repository-only: revert the implementation PR. No database state, SQL state, Docker/PostgreSQL state, Production state, provider state, credential state, secret state, or environment state exists to roll back.

## References

- Refs #3678.
- Refs #3657 — Keep OPEN.
- Refs #3669 — completed.
- Refs #3675 — merged.
- Refs #3458 — Keep OPEN.
- Refs #3425 — Keep OPEN.
- Refs #3435 — Keep OPEN.
- Refs #3437 — Keep OPEN.
- Refs #1882 — Keep OPEN.
