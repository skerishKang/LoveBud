# DB Migration Precondition Registry Source-Validation Contract

> Issue #3659 — source-static validation of the precondition registry.

## Baseline

- **Baseline SHA:** `6e4bc984305d34501174e0d9c7fb60052ee8e071`
- **Scope:** Source-static only — no runtime, database, deployment, or Production behavior.

## Purpose

The precondition registry at `db/migration-provenance/precondition-registry.json` is a fixed repository JSON source that declares what preconditions each canonical migration expects. This contract validates that the registry:

1. Is structurally valid (exact schema, no extra/sparse/accessor/symbol keys, valid format_version and status)
2. Is internally consistent (empty entries for ADOPTION_REQUIRED, non-empty for ACTIVE, no duplicate migration_id or check_id)
3. Contains no forbidden authority keys (query, sql, path, url, env, credential, etc.)
4. Does not execute getters, Proxy traps, or any code path
5. Binds correctly to the canonical migration manifest (one-to-one when ACTIVE)

## Schema

### Top-level

```json
{
  "format_version": "1.0",
  "status": "ADOPTION_REQUIRED | ACTIVE",
  "entries": []
}
```

Exact keys: `format_version`, `status`, `entries`. No extra keys, symbol keys, or accessor properties.

### Entry

```json
{
  "migration_id": "YYYYMMDDHHMMSS_slug",
  "checks": []
}
```

Exact keys: `migration_id`, `checks`. No extra keys.

### Check

```json
{
  "check_id": "string",
  "query_reference": "string",
  "expected": true | false
}
```

Exact keys: `check_id`, `query_reference`, `expected`. No extra keys.

## Identifier Grammar

### migration_id

Canonical migration ID pattern (same as `migration-provenance-core.cjs`):

```
/^\d{14}_[a-z0-9]+(?:-[a-z0-9]+)*$/
```

- 14-digit UTC timestamp, underscore, then a lowercase kebab-case slug
- Uppercase, spaces, underscores in slug, leading/trailing whitespace → FAIL

Valid examples:

```
20260725000000_example-migration
```

Invalid examples:

```
test
20260725_test
20260725000000_Test
20260725000000_test_name
20260725000000_-test
```

### check_id

Stable kebab-case:

```
/^[a-z0-9]+(?:-[a-z0-9]+)*$/
```

No underscores, uppercase, spaces, leading/trailing hyphens, or leading/trailing whitespace.

### query_reference

Safe kebab-case catalog key (same grammar as check_id):

```
/^[a-z0-9]+(?:-[a-z0-9]+)*$/
```

No colons, SQL text, slashes, uppercase, underscores, or whitespace.

## Dense Arrays

- `entries` and each `checks` array must be dense (no sparse holes).
- `isDenseArray()` helper checks every index from 0 to length-1 is present.
- Sparse entries → `REGISTRY_ENTRIES_SPARSE`
- Sparse checks → `REGISTRY_ENTRY_CHECKS_SPARSE`

## Proxy Rejection

All registry, entry, check, and manifest inputs are rejected if they are Proxy-wrapped objects. Detection uses `node:util`'s `types.isProxy()` before any reflective inspection (`Object.getPrototypeOf`, `Reflect.ownKeys`, `Object.getOwnPropertyDescriptor`, property access). All Proxy trap counters (get, getPrototypeOf, ownKeys, getOwnPropertyDescriptor, has) are guaranteed 0.

## Status Rules

| status | entries constraint | Binding (ADOPTION_REQUIRED manifest) | Binding (ACTIVE manifest) |
|---|---|---|---|
| `ADOPTION_REQUIRED` | `entries` must be empty array | PASS | FAIL (manifest adopted before registry) |
| `ACTIVE` | `entries` must be non-empty array, each with non-empty `checks` | FAIL (manifest not adopted) | PASS + one-to-one binding, all checks non-empty |

### ACTIVE checks constraint

When `status` is `ACTIVE`, each entry's `checks` array must be non-empty. Empty checks → `REGISTRY_ENTRY_CHECKS_EMPTY` → FAIL.

## One-to-One Binding (ACTIVE)

When both manifest and registry are ACTIVE:
- Each canonical migration has exactly one registry entry
- Each registry entry references exactly one canonical migration
- No orphan entries (registry entry without matching migration)
- No missing entries (migration without matching registry entry)
- No duplicate migration_id in registry

## Fixed Path

```
db/migration-provenance/precondition-registry.json
```

- Repository root is calculated from `__dirname`, not from caller, environment, or argument.
- No caller override for file paths, root, glob, URL, or stdin.
- Loaded via `resolveConfinedRegularFile()` which enforces lexical containment, realpath containment, and regular file check.

## Forbidden Authority Keys

The following keys are never permitted in entries or checks:

```
query, text, sql, path, url, env, credential,
operator, hostname, caller_path, dynamic_source,
allowlist, evidence_contract, kind, field
```

## Public Result

```js
// From the adapter's validateSource():
{ status: 'PASS' | 'FAIL' | 'UNAVAILABLE' }
```

- `PASS`: registry is valid JSON, structurally valid, consistent with manifest, all four sources valid
- `FAIL`: registry contains invalid content (malformed JSON, structural violation, binding mismatch)
- `UNAVAILABLE`: registry file is missing, unreadable, directory instead of file, or escapes repo

## Validation Sequence

1. Load registry file via `resolveConfinedRegularFile()` + `readFileSync`
2. `JSON.parse()` exactly once
3. `validatePreconditionRegistry()` — structural validation
4. `validateRegistryManifestBinding()` — cross-binding with canonical manifest
5. Combined result feeds into existing source-validation PASS/FAIL/UNAVAILABLE

## Limitations (Out of Scope)

- No precondition evaluation or runtime execution
- No SQL execution or DB connection
- No `readonly-query-catalog.json` generation
- No query broker calls
- No migration execution
- No lock acquisition
- No Docker/PostgreSQL
