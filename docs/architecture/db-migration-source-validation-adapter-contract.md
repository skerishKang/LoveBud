# Migration Source-Validation Adapter Contract

> Issue #3650 — source-only adapter for the canonical migration runner.

## Baseline

- **Baseline SHA:** `b5052f153f14170affd65ae25ce6c310dd99d264`
- **Scope:** Source-only — no runtime, database, deployment, or Production behavior.

## Purpose

The migration source-validation adapter reads three fixed repository JSON files and delegates to the existing `validateSourceConfiguration` validator from `migration-provenance-core.cjs`. It does NOT execute SQL, open database connections, import `pg`, access network, modify manifests, or perform any side effect beyond reading three fixed files.

## Factory

```js
const { createMigrationSourceValidationAdapter } = require('./migration-source-validation-adapter-core.cjs');

// Default (production) — reads fixed repository sources
const adapter = createMigrationSourceValidationAdapter();

// Test injection — override source loader and/or validator
const adapter = createMigrationSourceValidationAdapter({
  loadFixedSources,
  validateSourceConfiguration
});
```

## Public Surface

The adapter is a frozen object with exactly one own enumerable key:

```js
{ validateSource }
```

### `validateSource({ targetMigrationId })`

| Input | Return |
|---|---|
| Valid `targetMigrationId` (non-empty string) | `Promise<{ status: 'PASS' \| 'FAIL' \| 'UNAVAILABLE' }>` |
| Missing/invalid/malformed envelope | `Promise<{ status: 'FAIL' }>` (source read: 0) |

## Fixed Source Paths

| # | Repository-relative path | Absolute (from `REPO_ROOT`) |
|---|---|---|
| 1 | `docs/architecture/migration-path-inventory.json` | `<repo>/docs/architecture/migration-path-inventory.json` |
| 2 | `db/migration-provenance/canonical-migrations.json` | `<repo>/db/migration-provenance/canonical-migrations.json` |
| 3 | `db/migration-provenance/expected-schema-manifest.json` | `<repo>/db/migration-provenance/expected-schema-manifest.json` |

- Repository root is calculated from `__dirname`, not from caller, environment, or argument.
- No caller override for file paths, root, glob, URL, or stdin.
- `targetMigrationId` is never used for path selection or source authorization.

## Existing Validator

The adapter reuses `validateSourceConfiguration` from `migration-provenance-core.cjs`. It does NOT reimplement, reduce, or bypass any validation policy.

The adapter calls:

```js
validateSourceConfiguration({
  repoRoot,
  inventory,
  migrationManifest,
  expectedSchemaManifest
})
```

The existing validator checks:
- Migration-path inventory completeness and content checksum
- Canonical migration directory fixed to `db/migrations`
- Migration ID/path/checksum rules and dependency order
- Raw-byte SQL checksum and destructive operation declaration
- Expected-schema manifest structure
- Ledger contract field agreement

## Status Mapping

### `PASS`

Only when `validateSourceConfiguration` returns `{ ok: true }`.

Current committed source (inactive manifests, empty migrations, empty critical objects) is expected to PASS.

`PASS` does NOT mean:
- Manifest ACTIVE
- Production adoption complete
- Ledger relation exists
- PostgreSQL connected
- Migration executable
- Target migration authorized
- Deployment gate active

### `FAIL`

- Malformed call envelope (source read: 0)
- Successfully read but invalid JSON
- Validator returns `{ ok: false }`
- Invalid inventory, canonical manifest, or expected-schema manifest

### `UNAVAILABLE`

- Source file cannot be read (missing, permission, directory)
- Path/realpath/symlink escape outside repository
- Unexpected validator throw or Promise rejection
- Loader throw/reject
- Internal evaluation exception

## Call Envelope Validation

The input `{ targetMigrationId }` must be a strict safe plain record:

- Own key exactly `targetMigrationId` (no extra keys, no symbol keys, no inherited)
- Enumerable own data property (no accessor, no non-enumerable)
- Prototype is `Object.prototype` or `null` (no custom prototype)
- `targetMigrationId` is a non-empty string
- Proxy traps on the envelope do not execute `get`, and envelope traps (`ownKeys`, `getPrototypeOf`, `getOwnPropertyDescriptor`) are safely caught

Malformed envelopes produce `FAIL` with source read count 0.

## Read/Parse Count

- Each fixed source is read at most once per `validateSource()` call.
- Each source is JSON-parsed at most once per call.
- No `existsSync` + `readFileSync` double-read pattern.

## Path/Realpath Confinement

1. Lexical containment: resolved path must start with `REPO_ROOT + path.sep`.
2. Realpath containment: `fs.realpathSync` on both repo root and target file.
3. Target realpath must start with real repo root.
4. Target must be a regular file (`statSync().isFile()`).

## Result Sanitization

- Result contains only `{ status: 'PASS' | 'FAIL' | 'UNAVAILABLE' }`.
- No target migration ID, source paths, validator errors, raw inventory data, hostname, URL, credentials, or environment variables.
- No `console.log`, `console.error`, or `console.warn` calls.

## Orchestrator Compatibility

The adapter's `validateSource` method is compatible with the `runCanonicalMigration` orchestrator's `validateSource` dependency:

- `PASS` → orchestrator proceeds to `MANIFEST_LOAD`
- `FAIL` → orchestrator blocks at `SOURCE_VALIDATION` with `RUNNER_SOURCE_VALIDATION_FAILED`
- `UNAVAILABLE` → orchestrator blocks at `SOURCE_VALIDATION` with `RUNNER_SOURCE_VALIDATION_UNAVAILABLE`
- `FAIL`/`UNAVAILABLE` → `loadManifest` and subsequent dependencies are not called

`loadManifest` is a separate child dependency; this adapter does NOT call it.

## Side-Effect Boundary

- No `pg`, `child_process`, `net`, `http`, `https`, `fetch`, `axios`
- No SQL text, database connection, Docker, PostgreSQL
- No environment variable fallback, `.secrets` read
- No file write, manifest mutation, cache file, temp output
- No `process.exit`, global mutable state
- No `require()` at module load reads files; reads occur only at `validateSource()` call time

## Rollback

Source-only PR revert. No database rollback.

## Protected Issues

- Refs #3650
- Refs #3458 — Keep OPEN.
- Refs #3425 — Keep OPEN.
- Refs #3435 — Keep OPEN.
- Refs #3437 — Keep OPEN.
- Refs #1882 — Keep OPEN.
