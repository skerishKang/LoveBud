# Canonical Manifest Loader Adapter Contract

> Issue #3652 — source-only adapter for the canonical migration runner.

## Baseline

- **Baseline SHA:** `b3bcdda7d69fe98d447df41fddcd9edcde4e20cd`
- **Scope:** Source-only — no runtime, database, deployment, or Production behavior.

## Purpose

The canonical manifest loader adapter reads one fixed repository JSON file and delegates to the existing `validateMigrationManifest` validator from `migration-provenance-core.cjs`. It does NOT execute SQL, open database connections, import `pg`, access network, modify manifests, activate the manifest, or perform any side effect beyond reading one fixed file.

## Orchestrator Dependency Order

```
validateSource
  -> loadManifest    <-- THIS ADAPTER
  -> acquireAdvisoryLock
  -> readLedger
  -> ...
```

## Factory

```js
const { createMigrationCanonicalManifestAdapter } = require('./migration-canonical-manifest-adapter-core.cjs');

// Default (production) — reads fixed repository manifest
const adapter = createMigrationCanonicalManifestAdapter();

// Test injection — override reader and/or validator
const adapter = createMigrationCanonicalManifestAdapter({
  readFixedManifestText,
  validateMigrationManifest
});
```

### Factory Config Descriptor Snapshot

Factory config is validated via a single safe descriptor snapshot. The adapter never uses `in` operator, Proxy `has` trap, or direct property access on config. Instead:

1. `Object.getPrototypeOf(config)` — validates prototype is `Object.prototype` or `null`
2. `Reflect.ownKeys(config)` + `Object.getOwnPropertyDescriptor(config, key)` — captures all descriptors
3. Rejects symbol keys, accessor properties, non-enumerable properties, extra keys
4. Only `readFixedManifestText` and `validateMigrationManifest` are permitted keys
5. `undefined` config -> default dependencies; `null` config -> `MIGRATION_CANONICAL_MANIFEST_ADAPTER_INVALID_DEPENDENCY`
6. Captures callable values from descriptors; original config is never re-accessed
7. All trap failures (`ownKeys`, `getPrototypeOf`, `getOwnPropertyDescriptor`) produce fixed factory error
8. Raw internal errors are not exposed; fixed error: `MIGRATION_CANONICAL_MANIFEST_ADAPTER_INVALID_DEPENDENCY`

## Public Surface

The adapter is a frozen object with exactly one own enumerable key:

```js
{ loadManifest }
```

### `loadManifest({ targetMigrationId })`

| Input | Return |
|---|---|
| Valid `targetMigrationId` (non-empty string) | `Promise<{ status, migrations }>` |
| Missing/invalid/malformed envelope | `Promise.reject(MIGRATION_CANONICAL_MANIFEST_UNAVAILABLE)` (source read: 0) |

## Fixed Canonical Manifest Path

| # | Repository-relative path | Absolute (from `REPO_ROOT`) |
|---|---|---|
| 1 | `db/migration-provenance/canonical-migrations.json` | `<repo>/db/migration-provenance/canonical-migrations.json` |

- Repository root is calculated from `__dirname`, not from caller, environment, or argument.
- No caller override for file paths, root, glob, URL, or stdin.
- `targetMigrationId` is never used for path selection, source authorization, or migration lookup.

## Existing Validator Source of Truth

Manifest policy is NOT reimplemented in this adapter. The adapter delegates to:

```js
const { validateMigrationManifest } = require('./migration-provenance-core.cjs');
validateMigrationManifest(parsedManifest, REPO_ROOT)
```

The existing validator owns:
- Status vocabulary (`ADOPTION_REQUIRED`, `ACTIVE`)
- Fixed canonical directory (`db/migrations`)
- Ledger contract validation
- Required migration fields
- Migration ID/path rules (`/^\d{14}_[a-z0-9]+(?:-[a-z0-9]+)*$/`)
- Raw-byte checksum verification
- Strict ascending order
- Dependency existence/order
- Transaction-mode vocabulary
- Risk-class vocabulary
- Destructive-operation declaration
- Approval reference
- Dynamic/procedural ambiguity blocking

## Current `ADOPTION_REQUIRED` Behavior

The current committed manifest is:

```json
{ "status": "ADOPTION_REQUIRED", "migrations": [] }
```

This is a structurally valid manifest. The default adapter returns:

```js
Object.freeze({
  status: 'ADOPTION_REQUIRED',
  migrations: Object.freeze([])
})
```

`ADOPTION_REQUIRED` is NOT treated as an adapter error, source unavailable, empty fabrication, or automatic `ACTIVE` conversion. Manifest activation is the protocol's responsibility (`RUNNER_MANIFEST_NOT_ACTIVE`).

## Protocol-Only Six-Field Projection

Each migration record in the result contains exactly six own enumerable data keys:

```
id
checksum
depends_on
transaction_mode
risk_class
destructive_operations
```

Fields NOT exposed: `name`, `path`, `owner_domain`, `approval_reference`, `expected_preconditions`, `expected_postconditions`, `rollback_support`, source SQL, source bytes, canonical directory, ledger contract, repository path, validator errors, manifest internal metadata.

Migration array order from the source manifest is preserved exactly. No sort, deduplication, filter, target-only selection, dependency reordering, or ID normalization.

## Target-Neutral Full Manifest Loading

`targetMigrationId` is validated in the call envelope but never used for:
- Manifest filtering
- Target authorization
- Migration lookup
- Source path selection
- Error message content

Unknown target IDs return the full validated manifest. Target existence and execution order are the protocol's responsibility.

## Deep Detached Frozen Result

The returned result is completely detached from the source object. All of the following are frozen:
- Top-level result object
- `migrations` array
- Each migration record
- Each `depends_on` array
- Each `destructive_operations` array

Source mutation cannot affect returned results. Returned result mutation attempts are no-ops. First-call output mutation does not affect subsequent calls. Nested array identity differs from source.

## Fixed Public Errors

| Error Constant | Value | When |
|---|---|---|
| `MIGRATION_CANONICAL_MANIFEST_UNAVAILABLE` | `'MIGRATION_CANONICAL_MANIFEST_UNAVAILABLE'` | All load failures |
| `MIGRATION_CANONICAL_MANIFEST_ADAPTER_INVALID_DEPENDENCY` | `'MIGRATION_CANONICAL_MANIFEST_ADAPTER_INVALID_DEPENDENCY'` | Factory config errors |

All public load failures produce the same fixed error. Raw causes are never classified or exposed.

## Stack/Cause/Path Sanitization

Error messages contain no: raw error message, stack, `cause`, file path, absolute repo path, target ID, validator error code, source bytes, URL, hostname, credential, or environment variable.

## Realpath Confinement

Default source read sequence:
1. Fixed repository-relative path computed
2. Lexical repository containment check
3. Repository root realpath
4. Manifest target realpath
5. Target realpath inside real repository root
6. Regular file check (via `statSync`)
7. Verified `realTarget` read exactly once (UTF-8)
8. JSON parsed exactly once
9. Validator called exactly once
10. Runner-only projection created

Symlink escape, directory at manifest path, missing file, and read errors all produce `MIGRATION_CANONICAL_MANIFEST_UNAVAILABLE`.

## Exactly-Once Read/Parse/Validator Counts

- `readFixedManifestText()` called exactly once per `loadManifest()` call
- `JSON.parse()` called exactly once per `loadManifest()` call
- `validateMigrationManifest()` called exactly once per `loadManifest()` call
- Malformed envelope: 0 reads, 0 parses, 0 validator calls

## Promise/Proxy/Thenable Policy

Supported:
- Synchronous string result
- Genuine native Promise (via `node:util` `types.isPromise`)

NOT supported (rejected with fixed error):
- Proxy-wrapped Promise
- Accessor thenable
- Data-property thenable
- Arbitrary Promise-like object

Same policy applies to both reader and validator.

## Descriptor Snapshot Boundaries

Both factory config and call envelope use `Reflect.ownKeys` + `Object.getOwnPropertyDescriptor` for safe descriptor snapshots. No `in` operator, no Proxy `has`/`get` traps, no direct property access on untrusted objects.

## No Manifest Activation

The adapter does not activate the manifest. `ADOPTION_REQUIRED` status is returned as-is. Manifest activation is a runner protocol responsibility.

## No Migration Addition

The adapter does not add, remove, or modify migration entries. It projects existing entries with the six-field boundary.

## No DB/SQL/Docker/PostgreSQL/Production/Provider/Secret

The adapter has no:
- `pg` import
- Database driver
- SQL text
- Network / HTTP / fetch
- Child process / shell
- Docker
- PostgreSQL
- `process.env`
- `.secrets` read
- Console output
- File write
- Manifest mutation
- Cache / temp output
- Process exit
- Global mutable state

Allowed filesystem operation: fixed manifest read-only loading.

## Orchestrator Compatibility

The adapter result is accepted by the orchestrator's `MANIFEST_LOAD` stage:
- Inactive manifest (`ADOPTION_REQUIRED`) result accepted as `MANIFEST_LOADED` evidence
- Active manifest (`ACTIVE`) result also accepted
- Loader fixed rejection produces `ORCHESTRATOR_DEPENDENCY_FAILED:loadManifest` in orchestrator
- Loader malformed result is blocked by adapter's own projection validation, not exposed to orchestrator
- Source validation FAIL results in `loadManifest` not being called (0 times)

## Module Require Behavior

Module `require()` does NOT read the manifest. Manifest read occurs only at `loadManifest()` call time.

## Rollback

Rollback is source-only PR revert. No database state, no manifest activation, no migration history is affected.

## Next Child

The next child adapter (lock, ledger, precondition) should be reviewed in a separate precondition adapter audit. This adapter does not affect downstream adapter contracts.

## Protected Issues

All referenced issues remain OPEN:
- #3652 — this issue
- #3650 — source-validation adapter
- #3458 — keep OPEN
- #3425 — keep OPEN
- #3435 — keep OPEN
- #3437 — keep OPEN
- #1882 — keep OPEN
