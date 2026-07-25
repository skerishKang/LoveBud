# Migration Source-Validation Adapter Contract

> Issue #3650 — source-only adapter for the canonical migration runner.

## Baseline

- **Baseline SHA:** `b5052f153f14170affd65ae25ce6c310dd99d264`
- **Scope:** Source-only — no runtime, database, deployment, or Production behavior.

## Purpose

The migration source-validation adapter reads four fixed repository JSON files and delegates to the existing `validateSourceConfiguration` validator from `migration-provenance-core.cjs` plus the precondition registry validator. It does NOT execute SQL, open database connections, import `pg`, access network, modify manifests, or perform any side effect beyond reading four fixed files.

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

### Factory Config Descriptor Snapshot

Factory config is validated via a single safe descriptor snapshot. The adapter never uses `in` operator, Proxy `has` trap, or direct property access on config. Instead:

1. `Object.getPrototypeOf(config)` — validates prototype is `Object.prototype` or `null`
2. `Reflect.ownKeys(config)` + `Object.getOwnPropertyDescriptor(config, key)` — captures all descriptors
3. Rejects symbol keys, accessor properties, non-enumerable properties, extra keys
4. Only `loadFixedSources` and `validateSourceConfiguration` are permitted keys
5. `undefined` config → default dependencies; `null` config → `SOURCE_VALIDATION_ADAPTER_INVALID_DEPENDENCY`
6. Captures callable values from descriptors; original config is never re-accessed
7. All trap failures (`ownKeys`, `getPrototypeOf`, `getOwnPropertyDescriptor`) produce fixed factory error
8. Raw internal errors are not exposed; fixed error: `SOURCE_VALIDATION_ADAPTER_INVALID_DEPENDENCY`

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
| 4 | `db/migration-provenance/precondition-registry.json` | `<repo>/db/migration-provenance/precondition-registry.json` |

- Repository root is calculated from `__dirname`, not from caller, environment, or argument.
- No caller override for file paths, root, glob, URL, or stdin.
- `targetMigrationId` is never used for path selection or source authorization.

## Fourth Source: Precondition Registry (#3659)

A fourth fixed source `db/migration-provenance/precondition-registry.json` is loaded and validated alongside the three existing sources:

1. Loaded via `defaultLoadFixedSources()` as `preconditionRegistryText`
2. Parsed with `JSON.parse()` exactly once
3. Validated structurally by `validatePreconditionRegistry()` from `migration-precondition-registry-validator-core.cjs`
4. Cross-validated against the canonical migration manifest by `validateRegistryManifestBinding()`

Registry validation failures (structural, binding) produce `FAIL`. Registry load failures produce `UNAVAILABLE`.

The registry schema is documented in `docs/architecture/db-migration-precondition-registry-source-validation-contract.md` (#3659).

## Loader Internal State

The default loader returns raw UTF-8 text with a frozen status vocabulary:

```js
const SOURCE_LOAD_STATUSES = Object.freeze({
  LOADED: 'LOADED',
  INVALID: 'INVALID',
  UNAVAILABLE: 'UNAVAILABLE'
});
```

### Status Mapping

| Loader status | Meaning | Adapter action |
|---|---|---|
| `LOADED` | File read succeeded, raw text returned | `validateSource` parses JSON |
| `INVALID` | File read succeeded but content is malformed JSON | `FAIL` (validator not called) |
| `UNAVAILABLE` | File/path/read failed | `UNAVAILABLE` |

### `validateSource()` Mapping

```text
LOADED       → JSON.parse each text → delegate to validator
INVALID      → FAIL
UNAVAILABLE  → UNAVAILABLE
```

Raw `JSON.parse` failure on any source produces `FAIL` without calling the validator. This is tested via actual malformed JSON strings and malformed temp-repository filesystem fixtures in the test suite.

### Async Loader Support

Both sync and async loaders are supported. The adapter detects genuine native Promises using `node:util`'s `types.isPromise`, which checks internal-slot identity. It does NOT use `instanceof Promise`, `Promise.resolve()`, or plain `await` on untrusted values.

```js
const { types: utilTypes } = require('node:util');

function isGenuinePromise(value) {
  try {
    return utilTypes.isPromise(value);
  } catch {
    return false;
  }
}
```

Supported return types:

- Synchronous plain object → descriptor snapshot
- Genuine native Promise (internal `[[PromiseState]]` slot) → `await` after identity check

Not supported (result is `UNAVAILABLE`):

- Proxy-wrapped Promise — `isPromise` returns false, Proxy `get` trap is never executed
- Custom thenable with accessor `then` — getter is never executed
- Custom thenable with data-property `then` function — function is never called

Synchronous throws and rejected genuine Promises produce `UNAVAILABLE`.

## Verified `realTarget` Direct Read

`resolveConfinedRegularFile(relativePath)` returns the verified realpath:

1. Lexical containment: resolved path must start with `REPO_ROOT + path.sep`
2. Repo realpath: `fs.realpathSync(REPO_ROOT)`
3. Target realpath: `fs.realpathSync(lexicalTarget)`
4. Realpath containment: target realpath must start with real repo root
5. Regular file: `fs.statSync(realTarget).isFile()`

The actual read uses only the verified `realTarget`:

```js
const realTarget = resolveConfinedRegularFile(relativePath);
const text = fs.readFileSync(realTarget, 'utf8');
```

After realpath validation, the adapter never reads from the original lexical path.

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
- Successfully read but invalid JSON (raw parse failure)
- Loader returns `INVALID` status
- Validator returns `{ ok: false }`
- Invalid inventory, canonical manifest, or expected-schema manifest

### `UNAVAILABLE`

- Source file cannot be read (missing, permission, directory)
- Path/realpath/symlink escape outside repository
- Loader returns `UNAVAILABLE` status
- Unexpected validator throw or genuine Promise rejection
- Loader throw/reject
- Internal evaluation exception
- Proxy-wrapped Promise or arbitrary thenable from loader/validator

## Call Envelope Validation

The input `{ targetMigrationId }` must be a strict safe plain record:

- Own key exactly `targetMigrationId` (no extra keys, no symbol keys, no inherited)
- Enumerable own data property (no accessor, no non-enumerable)
- Prototype is `Object.prototype` or `null` (no custom prototype)
- `targetMigrationId` is a non-empty string
- Proxy traps on the envelope do not execute `get`, and envelope traps (`ownKeys`, `getPrototypeOf`, `getOwnPropertyDescriptor`) are safely caught

Malformed envelopes produce `FAIL` with source read count 0.

## Loader Result Descriptor Snapshot

Injected loader results are validated via safe descriptor snapshots:

- Plain record only (no array, no function, no null)
- Exact permitted own keys per status variant (order-independent set comparison):
  - `LOADED`: `{status, inventoryText, migrationManifestText, expectedSchemaManifestText, preconditionRegistryText}`
  - `INVALID`: `{status}`
  - `UNAVAILABLE`: `{status}`
- All keys must be own enumerable data properties
- Symbol, extra, accessor, non-enumerable, or inherited keys → `UNAVAILABLE`
- Proxy `get` trap: 0 executions
- Descriptor value capture; original result never re-accessed

## Validator Result Descriptor Snapshot

Validator results are validated via safe descriptor snapshots:

- `ok` must be an own enumerable data property (no accessor, no getter, no non-enumerable)
- `ok === true` → `PASS`
- `ok !== true` on inspectable result → `FAIL`
- Proxy `get` trap: 0 executions
- `ownKeys`/`getPrototypeOf`/`getOwnPropertyDescriptor` trap throw → `UNAVAILABLE`
- Revoked Proxy → `UNAVAILABLE`
- Validator genuine Promise rejection → `UNAVAILABLE`
- Proxy-wrapped Promise / arbitrary thenable → `UNAVAILABLE` (not assimilated)
- `errors`, `summary`, raw result never exposed externally

## Read/Parse Count

- Each fixed source is read at most once per `validateSource()` call.
- Each source is JSON-parsed at most once per call.
- No `existsSync` + `readFileSync` double-read pattern.
- `JSON.parse` failure on first source → `FAIL`, validator not called.
- Per-file read count is verified in tests: inventory, canonical manifest, expected-schema manifest, and precondition registry each read exactly once.

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

## Test Coverage Summary

The test suite includes:

- **1–8:** Core public surface, PASS/FAIL/UNAVAILABLE fixtures, call envelope, sanitization, orchestrator compatibility
- **A:** Actual raw malformed JSON injection (inventory, canonical, schema)
- **B:** Default loader filesystem tests (missing, directory, symlink escape, **B4/B5/B6 malformed fixed files**)
- **C:** External symlink → UNAVAILABLE (explicit skip on unavailable symlink)
- **D:** Hostile factory config (D1–D16: numeric, string, array, function, custom prototype, extra key, symbol, **null config**, accessor dependency, **non-enumerable dependency**, Proxy traps, revoked Proxy, **swapped dependency order**)
- **E:** Async loader (resolve/reject, **E5/E6 genuine Promise**, **E7 Proxy-wrapped Promise get trap 0**, **E8 accessor thenable getter 0**, **E9 data-property thenable call 0**)
- **F:** Hostile loader result (accessor, Proxy, traps, revoked, unknown status, extra key, symbol, wrong type, **F11 reversed key order**, **F12 non-enumerable status**, **F13 non-enumerable text**)
- **G:** Hostile validator result (ok true/false, accessor, Proxy, traps, revoked, reject, **G10/G11 genuine Promise**, **G12 Proxy-wrapped validator get trap 0**, **G13 accessor thenable getter 0**, **G14 data-property thenable call 0**, **G15 non-enumerable ok**)
- **H:** Source counts (loader 1x, envelope 0x, malformed 0x)
- **I:** Fixed source actual read counts (inventory, canonical, schema, registry each exactly 1)
- **J:** Precondition registry 4th source integration (J1–J7: PASS, malformed → FAIL, invalid structure → FAIL, missing file → UNAVAILABLE, forbidden authority key → FAIL, parse/validator counts, result sanitization)

## Side-Effect Boundary

- No `pg`, `child_process`, `net`, `http`, `https`, `fetch`, `axios`
- No SQL text, database connection, Docker, PostgreSQL
- No environment variable fallback, `.secrets` read
- No file write, manifest mutation, cache file, temp output
- No `process.exit`, global mutable state
- No `require()` at module load reads files; reads occur only at `validateSource()` call time
- Test injection does not allow caller-selected file paths or roots

## Rollback

Source-only PR revert. No database rollback.

## Protected Issues

- Refs #3650
- Refs #3659
- Refs #3657
- Refs #3658
- Refs #3458 — Keep OPEN.
- Refs #3425 — Keep OPEN.
- Refs #3435 — Keep OPEN.
- Refs #3437 — Keep OPEN.
- Refs #1882 — Keep OPEN.
