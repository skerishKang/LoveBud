# LoveBud CI Test Isolation Hardening Decision

## 1. Exact base SHA and evidence limits

| Field | Value |
|---|---|
| Parent | #3670 (Keep OPEN) |
| Completed predecessors | #3671 / PR #3676, #3685 / PR #3686, #3710 / PR #3711 |
| This child | #3715 |
| Expected starting main | `235ec59b2a5a40e0cf0115ebe45b2c6e50abbcdc` |
| Actual found main | `235ec59b2a5a40e0cf0115ebe45b2c6e50abbcdc` |
| Drift | None — exact match |
| Work class | Generic Tier 2 repository-source audit |
| UI class | NOT_APPLICABLE |
| Source inspected | All default-CI test files, DB engine tests and harness, CI workflow, test registry/classification, 10+ representative contract tests |
| NOT inspected | Remote/provider scripts (not default CI), Python supplemental tests (no discovered runner), manual E2E scripts |

**CONFIRMED:** This document audits repository source only. It does not execute or alter tests, browsers, providers, databases, containers, deployments, or Production.

## 2. Node 20 test-runner execution model

`npm test` passes multiple test files to `node --test` (`package.json:10`):

```json
"test": "node --test tests/smoke/*.test.cjs tests/routes/*.test.cjs tests/contracts/*.test.cjs"
```

Under Node 20 process isolation:

```text
each test file:
  executes in a separate child process

file-level concurrency:
  bounded by --test-concurrency
  Node 20.20.x CLI default: os.availableParallelism() - 1

same-file test/subtest concurrency:
  sequential by default unless concurrency is explicitly enabled
```

The following four concurrency dimensions must be distinguished:

```text
cross-file child-process concurrency
  — multiple test-file child processes running simultaneously
  — each has its own process-local globals, module cache, and filesystem view

same-file test/subtest concurrency
  — subtests within one file running simultaneously
  — only occurs when the file explicitly enables concurrency

shared external resources across child processes
  — filesystem paths, network ports, PostgreSQL instances
  — these are the real cross-file collision surface

process-local globals and module caches
  — globalThis, require.cache, ESM module map
  — scoped to one child process; cannot affect other files' processes
```

This model is critical for hazard classification. A mutation of `globalThis.fetch` in one test file cannot affect a different test file's child process. It can only affect same-file subtests if those subtests explicitly run concurrently.

## 3. Isolation-domain inventory

Each domain is enumerated across `package.json` scripts (line 10), `.github/workflows/ci.yml`, `tests/ci-test-group-registry.json`, `tests/test-layer-classification.json`, and direct file source reads.

| Domain | Scope | Files | Registry group |
|---|---|---|---|
| Fixed/listening ports | 15 browser-like test files | `tests/contracts/*browser*contract*.test.cjs` | BROWSER_REAL_LOCAL |
| HTTP server lifecycle | Same 15 browser-like files | `tests/contracts/*browser*contract*.test.cjs` | BROWSER_REAL_LOCAL |
| Child process spawn/exit/kill | 7 DB engine + 3 loop-contract files | `tests/db-engine/*.test.cjs`, `tests/contracts/lovebud-loop-*.test.cjs` | DB_ENGINE, PROCESS_REAL_LOCAL |
| Temporary directories and filenames | 20+ contract test files | `tests/contracts/*.test.cjs` (various) | SOURCE_STATIC, EXECUTED_FAKE, BROWSER_REAL_LOCAL |
| Browser contexts/pages | 15 browser-like test files | `tests/contracts/*browser*contract*.test.cjs` | BROWSER_REAL_LOCAL |
| Fake timers and real timers | 30+ test files | Various `tests/contracts/*.test.cjs` | SOURCE_STATIC, EXECUTED_FAKE, BROWSER_REAL_LOCAL |
| Global/environment mutation | 5+ test files | `tests/contracts/scout-*-*.test.cjs`, `tests/contracts/db-migration-canonical-*.test.cjs`, `tests/contracts/owner-tree-list-*.test.cjs` | EXECUTED_FAKE |
| Module cache mutation | 4 test files | `tests/contracts/relationship-hints-*.test.cjs`, `tests/contracts/db-migration-*-*.test.cjs` | SOURCE_STATIC, EXECUTED_FAKE |
| Filesystem cleanup | 25+ test files | Various `tests/contracts/` and `tests/db-engine/` | All layers |
| Signal handling | 0 test files | None | N/A |
| Parallel execution | Main `npm test` script | All 773 default-CI files | All default layers |
| Windows path/drive assumptions | 5 files | `scripts/report-test-layers.cjs`, `scripts/report-ci-test-groups.cjs`, `tests/helpers/import-absolute.cjs`, `lovebud-loop-*.test.cjs` | Various |
| PostgreSQL/container lifecycle | 7 DB engine test files + CI workflow | `tests/db-engine/*.test.cjs`, `.github/workflows/ci.yml` | DB_ENGINE |

### 3a. Inventory count reconciliation

| Count source | Value |
|---|---|
| Registry BROWSER_REAL_LOCAL (execution-group authority) | 12 |
| Source-discovered browser-like files (`*browser*contract*.test.cjs`) | 15 |
| Registry-only (in BROWSER_REAL_LOCAL but not source-discovered) | 1: `legacy-tree-entity-repair-package-contract.test.cjs` |
| Source-only (source-discovered but not in registry BROWSER_REAL_LOCAL) | 4: `editor-owner-tree-scope-browser-runtime-3576-contract.test.cjs`, `editor-sidebar-module-browser-runtime-3576-contract.test.cjs`, `embedded-browser-google-login-contract.test.cjs`, `test-browser-normalize-tree-metadata-contract.test.cjs` |
| Registry PROCESS_REAL_LOCAL | 3 |
| Default-CI total (actual file count) | 773 |

The registry/source discrepancy is recorded as an exact gap. The terms "BROWSER_REAL_LOCAL" (registry authority) and "browser-like file" (source pattern) are not used interchangeably.

## 4. Isolation-domain inventory with evidence

### 4a. Fixed/listening ports — CONFIRMED_HAZARD

**Evidence:** Eight browser contract test files use a two-step `getFreePort()` pattern that creates a TOCTOU race window:

`tests/contracts/tree-layout-persistence-3582-browser-contract.test.cjs:221-231`:
```js
function getFreePort() {
  return new Promise((resolve, reject) => {
    const srv = net.createServer();
    srv.unref();
    srv.on('error', reject);
    srv.listen(0, '127.0.0.1', () => {
      const port = srv.address().port;
      srv.close(() => resolve(port));  // port released here
    });
  });
}
```

Followed by `startServer()` at line 233-267 that re-listens on the probed port:
```js
function startServer() {
  return getFreePort().then((port) =>
    new Promise((resolve, reject) => {
      const server = http.createServer(...);
      server.listen(port, '127.0.0.1', ...);  // TOCTOU: port may be taken
    })
  );
}
```

**Affected files (8):**
- `tests/contracts/tree-layout-persistence-3582-browser-contract.test.cjs`
- `tests/contracts/tree-layout-mode-policy-3581-browser-contract.test.cjs`
- `tests/contracts/tree-card-composition-3578-browser-contract.test.cjs`
- `tests/contracts/browse-story-view-foundation-3655-browser-contract.test.cjs`
- `tests/contracts/browse-my-trees-compact-geometry-3608-browser-contract.test.cjs`
- `tests/contracts/browse-my-trees-large-geometry-3608-browser-contract.test.cjs`
- `tests/contracts/browse-my-trees-list-geometry-3608-browser-contract.test.cjs`
- `tests/contracts/home-video-modal-loading-3707-browser-contract.test.cjs`

**Safe counter-examples (5 files):** Five files already use direct `server.listen(0, '127.0.0.1')` which lets the OS assign an ephemeral port atomically:
- `tests/contracts/editor-sidebar-module-browser-runtime-3576-contract.test.cjs`
- `tests/contracts/editor-owner-tree-scope-browser-runtime-3576-contract.test.cjs`
- `tests/contracts/settings-readonly-account-3583-browser-contract.test.cjs`
- `tests/contracts/settings-password-reset-3635-browser-contract.test.cjs`
- `tests/contracts/settings-display-name-edit-3617-browser-contract.test.cjs`

### 4b. HTTP server lifecycle — CONFIRMED_HAZARD (unawaited close only)

**Evidence:** The three Settings browser test files share a single server across all subtests via `before`/`after` with awaited teardown:

`tests/contracts/settings-readonly-account-3583-browser-contract.test.cjs:44-46,170-178`:
```js
let server;
let browser;
let baseUrl;

before(async function() {
  server = await startServer();
  baseUrl = 'http://127.0.0.1:' + server.address().port;
  browser = await chromium.launch({ headless: true });
});

after(async function() {
  if (browser) await browser.close();
  if (server) await new Promise(function(resolve) { server.close(resolve); });
});
```

Same pattern in:
- `tests/contracts/settings-password-reset-3635-browser-contract.test.cjs:20-22,292-305`
- `tests/contracts/settings-display-name-edit-3617-browser-contract.test.cjs:20-22,351-364`

**Classification:** The shared-suite fixture itself is **BOUNDED_ACCEPTABLE** — no explicit concurrency is configured, subtests are sequential by default, Playwright contexts/pages are isolated, and teardown is awaited. The shared fixture does not constitute a confirmed hazard on its own.

**Retained hazard:** Multiple browser test files call `server.close()` without `await` in `finally` blocks:

`tests/contracts/tree-layout-persistence-3582-browser-contract.test.cjs:681-683`:
```js
} finally {
  server.close();       // not awaited — port release race
  await browser.close();
}
```

This is a **CONFIRMED_HAZARD** because unawaited `server.close()` may not release the port before the next same-file subtest starts, creating a port collision window within the same process.

### 4c. Child process spawn/exit/kill — LATENT_COLLISION_RISK

**Evidence:** DB engine tests and loop-contract tests spawn child processes inheriting the parent environment:

`tests/db-engine/helpers/postgres-disposable-harness.cjs:96-133` — `runPsqlFile` uses `spawnSync` with `env: { ...process.env, PGPASSWORD: cfg.password }`.

`tests/contracts/lovebud-loop-policy-loader-contract.test.cjs:329-333`:
```js
cp.spawnSync('node', ['scripts/loop/run-loop.mjs', '--mode=dry-run'], {
  env: { ...process.process.env, LOCALAPPDATA: '' }
});
```

Three loop-contract files use `LOCALAPPDATA: ''` override:
- `tests/contracts/lovebud-loop-policy-loader-contract.test.cjs:333,397`
- `tests/contracts/lovebud-loop-triage-contract.test.cjs:357`
- `tests/contracts/lovebud-loop-autonomy-policy-contract.test.cjs:153`

The child process inherits the parent environment and therefore expands the child process's available secret/config surface beyond what the test code explicitly requires. This is a security-minimization risk, not a test-isolation collision risk.

DB engine `spawnSync` calls have `timeout: 60000` (60-second bound), which contains hangs.

### 4d. Temporary directories and filenames — LATENT_COLLISION_RISK (shared fixtures)

**Evidence:** Five test files write to shared `_tmp-*.json` paths under `tests/contracts/fixtures/migration-provenance/`:

| Writer file | Paths written |
|---|---|
| `tests/contracts/migration-provenance-gate-contract.test.cjs:407-410,554-591` | `_tmp-catalog-binding.json`, `_tmp-ledger-binding.json`, `_tmp-ledger-bad.json`, `_tmp-catalog-ok.json`, `_tmp-catalog-missing-pair.json`, `_tmp-missing-ledger.json` |
| `tests/contracts/expected-schema-candidate-contract.test.cjs:438,524,551,576` | `_tmp-sensitive-evidence.json`, `_tmp-candidate-evidence.json`, `_tmp-bad.json`, `_tmp-symlink-escape-evidence.json` |
| `tests/contracts/adoption-attestation-contract.test.cjs:696,851,854` | `_tmp-adoption-symlink.json`, `_tmp-cli-catalog.json`, `_tmp-cli-ledger.json` |
| `tests/contracts/adoption-baseline-collection-plan-contract.test.cjs:473,489` | `_tmp-plan-bad.json`, `_tmp-plan-symlink.json` |
| `tests/contracts/migration-catalog-fingerprint-contract.test.cjs:461,482` | `_tmp-invalid-${process.pid}.json`, `_tmp-invalid-utf8-${process.pid}.bin.json` |

**Classification analysis:**

- The five files above are distinct test-file child processes. Under Node 20 process isolation, they run in separate processes with separate `process.pid` values.
- For files that use stable `_tmp-*` names (no `process.pid`), a cross-process collision is possible only if two of these files execute concurrently in the same CI job. The main `npm test` script runs all files in one `node --test` invocation with file-level concurrency, so these files CAN run concurrently.
- However, none of these files use explicit same-file concurrency. Each writes its `_tmp-*` files sequentially within its own process. The collision risk is between different files' child processes, not within a single file.
- The `migration-catalog-fingerprint-contract.test.cjs` file uses `${process.pid}` in its filenames. Since each test file runs in a separate child process, `process.pid` is unique per file, so these paths do NOT collide across files.

**Reclassification:** The stable `_tmp-*` paths are **LATENT_COLLISION_RISK** — collision is possible under concurrent file execution but no specific same-file concurrent writer pair is proven. The `process.pid`-suffixed paths are **BOUNDED_ACCEPTABLE** — no cross-file collision because `process.pid` differs per child process.

The codebase acknowledges this pattern in `tests/contracts/no-hardcoded-local-test-paths-contract.test.cjs:39-43`:
```js
function isKnownEphemeralFixture(file) {
  return /(^|\/)_tmp-[^/]+\.json$/i.test(relative);
}
```

Two additional files write to shared repo-root `.tmp-*` directories:
- `tests/contracts/public-mobile-detail-visibility-3567-contract.test.cjs:220-223` — `.tmp-3567-fixtures/`
- `tests/contracts/editor-sidebar-module-browser-runtime-3576-contract.test.cjs:118-121` — `.tmp-3576-sidebar-module/`

These are **BOUNDED_ACCEPTABLE** — each path is unique to one file, and no other file writes to the same directory.

**Safe examples:** 20+ files correctly use `os.mkdtempSync(path.join(os.tmpdir(), unique-prefix))` which guarantees uniqueness. These are **BOUNDED_ACCEPTABLE**. However, these also generally lack cleanup in `finally` blocks or `t.after()` hooks.

### 4e. Browser contexts/pages — BOUNDED_ACCEPTABLE

**Evidence:** All 15 browser-like files create isolated Playwright `browser`/`context`/`page` instances per test or per suite. The risk of cross-test browser state leakage is bounded by Playwright's own isolation model (each context is a separate storage/state partition).

Hazard exists only when shared browser instances are used across subtests (3 settings files, see 4b) — but Playwright's `context` isolation within a shared `browser` provides reasonable separation for the existing test patterns.

### 4f. Fake timers and real timers — LATENT_COLLISION_RISK

**Evidence:** Real `setTimeout`/`setInterval` are used for timing-dependent waits in browser tests:

- `tests/contracts/tree-layout-persistence-3582-editor-route-contract.test.cjs:506-510` — `await page.waitForTimeout(400)`
- Multiple other browser tests use `waitForTimeout` with hardcoded delays (15ms, 200ms, 400ms)

Fake timer harness exists in:
- `tests/contracts/editor-nochange-save-entry-evidence-3299.test.cjs:32-54` — custom `setTimeoutFake`/`advanceBy` harness

The inconsistency creates timing sensitivity. Real timers make test behavior dependent on host CPU load and scheduler. Under same-file sequential execution (default), this is bounded. Under same-file explicit concurrency, it would become a hazard.

### 4g. Global/environment mutation — BOUNDED_ACCEPTABLE

**Evidence 1 — `globalThis.fetch` mutation:**

`tests/contracts/scout-suggest-endpoint-live-adapter-mock-only-wiring-contract.test.cjs:345-391,405-531`:
```js
const originalFetch = globalThis.fetch;
globalThis.fetch = async (url, init) => { ... };
// If test fails before restore, same-file tests lose real fetch
globalThis.fetch = originalFetch;
```

`tests/contracts/owner-tree-list-observability-contract.test.cjs:301-347`:
```js
const originalFetch = global.fetch;
global.fetch = mockFetch;
try { ... } finally { global.fetch = originalFetch; }
```

**Classification:** Under Node 20 process isolation, each test file runs in a separate child process. `globalThis.fetch` mutation in one file cannot affect another file's child process. Within the same file, subtests are sequential by default unless concurrency is explicitly enabled.

- `owner-tree-list-observability-contract.test.cjs` uses `try/finally` to restore `global.fetch` — **BOUNDED_ACCEPTABLE** for sequential execution.
- `scout-suggest-endpoint-live-adapter-mock-only-wiring-contract.test.cjs` uses save/restore without `try/finally` — if the test fails before restore, same-file subtests could be affected. However, no explicit same-file concurrency is configured. **BOUNDED_ACCEPTABLE** for sequential execution, with a latent risk if concurrency is later enabled.

**Evidence 2 — `JSON.parse` mutation:**

`tests/contracts/db-migration-canonical-manifest-adapter-contract.test.cjs:1645-1651,2016-2017`:
```js
beforeEach(() => { originalParse = JSON.parse; });
afterEach(() => { JSON.parse = originalParse; });
// Subtests patch JSON.parse with getter-throwing wrapper
```

**Classification:** The `beforeEach`/`afterEach` pattern restores `JSON.parse` after each subtest. Under sequential same-file execution (default), this is **BOUNDED_ACCEPTABLE**. If same-file concurrency were enabled, the patch would affect concurrent subtests — but no explicit concurrency is configured.

**Evidence 3 — `globalThis.__lb_db_cleanup_errors` shared array:**

`tests/db-engine/helpers/postgres-disposable-harness.cjs:195-196`:
```js
if (!globalThis.__lb_db_cleanup_errors) globalThis.__lb_db_cleanup_errors = [];
globalThis.__lb_db_cleanup_errors.push(`${scenario}:${code}`);
```

Same pattern in `tests/db-engine/tree-comments-reconcile-postgres.test.cjs:205-206`.

**Classification:** Each DB-engine test file runs in a separate child process (via `--test-concurrency=1` per file, and each is a separate workflow job). The `globalThis.__lb_db_cleanup_errors` array is process-local and per-file. It accumulates within one file's scenarios but does not cross file or job boundaries. **BOUNDED_ACCEPTABLE** — the array grows within a single file's execution but is discarded when the process exits.

**Evidence 4 — Repeat ESM `import()` of same module:**

`tests/contracts/lovebud-loop-triage-contract.test.cjs:79-124` — 10+ subtests each call `await import('../../scripts/loop/build-queue.mjs')`, getting the same module singleton via ESM cache.

`tests/contracts/lovebud-loop-policy-loader-contract.test.cjs:42-137` — 10+ subtests each call `await import('../../scripts/loop/policy-loader.mjs')`.

**Classification:** Under sequential same-file execution (default), the ESM module cache returns the same singleton, but since subtests run one at a time, there is no concurrent access. If the imported module has internal mutable state and same-file concurrency were enabled, this would become a hazard. **BOUNDED_ACCEPTABLE** for sequential execution.

### 4h. Module cache mutation — LATENT_COLLISION_RISK

**Evidence:** Four files mutate `require.cache`:

- `tests/contracts/relationship-hints-ui-controller-contract.test.cjs:123-129` — deletes specific cached paths at top level (outside any test)
- `tests/contracts/db-migration-source-validation-adapter-contract.test.cjs:187` — deletes temp-copied adapter path
- `tests/contracts/db-migration-precondition-registry-source-validation-contract.test.cjs:860-861,887-888` — cascading deletes
- `tests/contracts/db-migration-canonical-manifest-adapter-contract.test.cjs:185-191` — iterates ALL `Object.keys(require.cache)` deleting matching entries

**Classification:** Under Node 20 process isolation, `require.cache` is process-local. Cross-file contamination is not possible. Within a single file, subtests are sequential by default. The `require.cache` deletions use temp paths inside `os.tmpdir()` (unique per process), so they do not affect other modules. The broad-cache-scan in the canonical manifest adapter test (line 185-191) could theoretically affect other modules in the same process, but only if those modules are actively being loaded during the scan — which requires same-file concurrency. **LATENT_COLLISION_RISK** — no proven concurrent execution, but the pattern is unsafe if concurrency is enabled.

### 4i. Filesystem cleanup — LATENT_COLLISION_RISK

**Evidence:** The `_tmp-*.json` and `.tmp-*` directory patterns have cleanup in `try/finally` blocks, but:
1. Cross-file collision is possible for stable `_tmp-*` paths (see 4d)
2. No `after`/`afterEach` hooks ensure cleanup if a subtest crashes
3. `os.mkdtempSync` directories (20+ files) are never explicitly cleaned up — rely on OS /tmp ephemeral behavior

One file writes outside the repo entirely:
`tests/contracts/tree-layout-persistence-3582-editor-route-contract.test.cjs:25`:
```js
const EVIDENCE = path.resolve(ROOT, '..', 'local-backup', 'lovebud-3582-persistence');
```
Evidence directory `../local-backup/` is outside the repo with no cleanup protocol. **UNRESOLVED** — source does not prove a cleanup defect, but the out-of-repo path is a maintenance hazard.

### 4j. Signal handling — UNRESOLVED

**Evidence:** Zero signal handlers found across all test files. `grep -r "process.on.*SIG" tests/` returns no matches.

DB engine tests create disposable databases that become orphaned if the test process receives SIGKILL (uncatchable) or the `finally` cleanup block is skipped due to process crash. No SIGTERM/SIGINT handler exists to clean up orphaned `lovebud_ci_*` databases. **UNRESOLVED** — no evidence of an actual defect, but the absence of signal handlers means crash-time cleanup is not guaranteed.

### 4k. Parallel execution — AMPLIFIER

**Evidence:** Main `npm test` script at `package.json:10`:
```json
"test": "node --test tests/smoke/*.test.cjs tests/routes/*.test.cjs tests/contracts/*.test.cjs"
```
No `--test-concurrency` flag. Node 20 applies a bounded default of `os.availableParallelism() - 1` file-level child processes.

DB engine scripts are safe — each uses `--test-concurrency=1`:
```json
"test:db-engine:tree-comments": "node --test --test-concurrency=1 tests/db-engine/tree-comments-reconcile-postgres.test.cjs"
```

**Classification:** The absence of an explicit `--test-concurrency` flag is not by itself a CONFIRMED_HAZARD. Node already applies a bounded default. It can **amplify** shared-resource defects (TOCTOU port race, shared `_tmp-*` paths), but the defect is the shared-resource collision path, not the concurrency cap itself.

This document introduces the **AMPLIFIER** annotation for hazards that are conditionally elevated by parallel execution but are not defects in isolation:

```text
AMPLIFIER: a condition that increases the likelihood or blast radius of an
existing hazard under concurrent execution, but is not itself a defect.
AMPLIFIER is not a disposition (CONFIRMED_HAZARD / LATENT_COLLISION_RISK /
PLATFORM_ASSUMPTION / BOUNDED_ACCEPTABLE / UNRESOLVED). It is a modifier.
```

The parallel execution domain is classified as **AMPLIFIER** — it amplifies 4a (TOCTOU), 4d (shared `_tmp-*` paths), and 4b (unawaited `server.close()`), but is not a defect itself.

A future duration/evidence child may evaluate whether capping `--test-concurrency` is warranted. This document does not recommend `--test-concurrency=1` as a default fix without measured evidence.

### 4l. Windows path/drive assumptions — PLATFORM_ASSUMPTION

**Evidence:**
- `scripts/report-test-layers.cjs:127` — `/^[A-Za-z]:/.test(norm)` detects absolute Windows paths
- `scripts/report-ci-test-groups.cjs:325` — same pattern
- `tests/contracts/modal-public-legacy-memory-visibility-contract.test.cjs:15` — `process.platform === 'win32' ? 'python' : 'python3'`
- `tests/contracts/expected-schema-candidate-contract.test.cjs:587` — `process.platform === 'win32'`
- `tests/contracts/adoption-baseline-collection-plan-contract.test.cjs:501` — Windows EPERM/EACCES skip
- `tests/contracts/adoption-attestation-contract.test.cjs:705` — same skip
- `tests/helpers/import-absolute.cjs:7` — `Windows-safe: drive letters must not be treated as URL schemes.`

Three loop-contract files blank `LOCALAPPDATA: ''` in spawned env, suggesting Windows-specific cleanup workaround.

These are platform awareness, not defects. They should be tracked for cross-platform CI matrices but are not currently causing CI failures on Ubuntu.

### 4m. PostgreSQL/container lifecycle — BOUNDED_ACCEPTABLE

**Evidence:** CI workflow declares PostgreSQL 17.4 service containers per job (`.github/workflows/ci.yml:45-67,97-123,etc.`). Seven DB engine jobs each get a dedicated disposable `postgres:17.4-bookworm` container with:
- Isolated ephemeral credentials per run (`${{ format('{0}-{1}', github.run_id, github.run_attempt) }}`)
- Host restriction to `127.0.0.1` (harness line 15)
- User restriction to `lovebud_ci_*` pattern (harness line 16)
- Database prefix restriction to `lovebud_ci_` (harness line 17)
- `DROP DATABASE IF EXISTS ... WITH (FORCE)` in finally blocks
- Unique test DB names using `process.pid` + `crypto.randomBytes(4).toString('hex')`

Each DB engine workflow job uses a separate workflow job, separate Node process, and separate PostgreSQL service container. The `globalThis.__lb_db_cleanup_errors` array is per-process and per-file; it does not accumulate across the seven jobs.

**Limitation:** No local-development PG orchestration exists. Tests assume a pre-existing PG at `localhost:5432`. No Docker container lifecycle is managed by the tests themselves. **UNRESOLVED** — no evidence of a defect, but local PG setup is not automated.

## 5. Severity/likelihood/blast-radius matrix

| # | Hazard | Severity | Likelihood | Blast radius |
|---|---|---|---|---|
| 4a | TOCTOU in `getFreePort()` — port race | Medium | Medium (under file concurrency, correlated with host load) | 8 browser test files, EADDRINUSE failures |
| 4b | HTTP server lifecycle — unawaited `server.close()` | Low | Medium (under same-file sequential execution, port may not release in time) | Browser files with `try/finally` pattern |
| 4c | Child process env inheritance | Medium | High (every run) | 10+ test files, security-minimization risk |
| 4d | Shared `_tmp-*.json` fixture paths | Medium | Medium (under file concurrency of affected files) | 5 migration-provenance test files |
| 4d | `.tmp-*` dirs in repo root | Low | Low (single file per dir, no collision) | 2 files |
| 4d | `mkdtempSync` no cleanup | Low | High (every run) | 20+ files, disk accumulation |
| 4g | `globalThis.fetch` mutation (no try/finally) | Low | Low (sequential execution, restore path exists) | Same-file subtests only |
| 4g | `JSON.parse` mutation | Low | Low (sequential execution, beforeEach/afterEach) | Same-file subtests only |
| 4g | `globalThis.__lb_db_cleanup_errors` shared array | Low | High (every DB engine run) | Per-process only, no cross-file/cross-job |
| 4g | Repeat ESM `import()` of same module | Low | Low (sequential execution, no concurrent access) | Same-file subtests only |
| 4h | `delete require.cache` broad scan | Low | Low (sequential execution, temp paths) | Same-file only |
| 4j | No signal handler for DB cleanup | Medium | Low (process crash is rare) | Per-process DB cleanup |
| 4k | Parallel execution (AMPLIFIER) | — | High (every run) | Amplifies 4a, 4b, 4d |
| 4l | Windows path assumptions | Low | Low (CI is Ubuntu only) | 5 files, platform-dependent |
| 4m | No local PG orchestration | Low | Low (CI handles containers) | Local development only |

## 6. Branch versus pristine-main reproduction rule

**CONFIRMED:** Every hazard listed above exists in pristine `main` at `235ec59b2a5a40e0cf0115ebe45b2c6e50abbcdc`.

- **Pristine-main reproducible:** TOCTOU port race, shared `_tmp-*.json` paths, `globalThis.fetch` mutation, `JSON.parse` mutation, env inheritance, `require.cache` deletion, no signal handlers, no explicit concurrency cap, `mkdtempSync` no cleanup, `LOCALAPPDATA` override, Windows drive-letter checks.
- **Branch-induced only:** None. No branch-specific isolation delta is required for reproduction.
- **Stochastic (load/timing dependent):** Port race from `getFreePort()` under file concurrency, unawaited `server.close()` race.

**Verification rule for the first implementation slice:** The fix must be verified against pristine `main` (or the implementation branch based on `main`) without requiring a separate `main` checkout. The fix is deterministic (port binding on `listen(0)`) and can be verified by running all 8 affected files together in both sequential and default file-concurrency modes.

## 7. Cleanup ownership model

| Resource type | Current owner | Required model | Gap |
|---|---|---|---|
| HTTP server port | Per-test inline lifecycle | Test file creates, test file destroys via `t.after()` or `finally`-awaited close | `server.close()` not awaited; no afterEach for subtest isolation |
| Temp directory `os.tmpdir()` | No explicit owner | Test file creates, test file destroys via `t.after()` | 20+ files never clean up |
| `_tmp-*.json` fixture files | Inline `try/finally` unlink | Test writes, test destroys; path must be unique per file | 5 files share stable paths across file concurrency |
| `.tmp-*` repo-root dirs | Inline `try/finally` rmSync | Test creates, test destroys | 2 files, no collision but no cleanup guarantee |
| `globalThis.fetch` | Per-test save/restore try/finally | Test mocks, test restores per subtest | One file lacks try/finally; sequential-safe only |
| `JSON.parse` | beforeEach/afterEach | Test patches, test restores per subtest | Sequential-safe only; no same-file concurrency |
| `globalThis.__lb_db_cleanup_errors` | Appending, never cleared | Per-process array, reset on entry | Grows within one file's scenarios |
| DB engine test databases | withDisposableDb finally block | Test creates, harness drops via DROP DATABASE IF EXISTS WITH (FORCE) | No SIGTERM handler for crash case |
| Child process env | Implicit full propagation | Explicit allowlist of env vars | Inherits parent environment beyond what is required |

## 8. Sanitized failure-artifact requirements

For the recommended first slice (port TOCTOU), the required evidence on failure is:

```
CONFIRMED: all 8 files pass together at SHA <X> with <N> subtests (sequential file concurrency).
CONFIRMED: all 8 files pass together at SHA <X> with <N> subtests (default file concurrency).
CONFIRMED: no EADDRINUSE, ECONNREFUSED, or listen-related error in any run output.
CONFIRMED: no teardown-uncompleted error in any run output.
```

Future slices should define a minimum failure-artifact packet: TAP output, normalized JSON classification, and per-test-file status keyed by SHA. This document does not specify the full packet schema; that is deferred to the CI failure-artifact standardization child.

## 9. Ordered implementation slices

The following slices are ordered by net isolation gain ÷ change risk × evidence certainty.

| Order | Slice | Hazard addressed | Estimated files changed | Evidence certainty |
|---|---|---|---|---|
| 1 | **Replace `getFreePort()` with direct `server.listen(0)`** | 4a — TOCTOU port race | 8 browser test files | High — mechanical replacement, proven by 5 existing files |
| 2 | **Await all `server.close()` calls** | 4b — port release race | ~15 browser test files | High — missing `await`, mechanical fix |
| 3 | **Unique `_tmp-*.json` fixture paths with process-unique tokens** | 4d — shared fixture paths | 5 migration-provenance files | High — add `process.pid` or random suffix |
| 4 | **Global mutation guard: restore `fetch`/`JSON.parse` in `t.after()`** | 4g — global mutation | 3 test files | Medium — `t.after()` run per-test but parallel siblings not serialized |
| 5 | **Cap main test concurrency** | 4k — AMPLIFIER | 1 file (`package.json`) | Requires duration evidence — separate child |
| 6 | **Clean up `mkdtempSync` dirs in `t.after()`** | 4d — temp dir accumulation | 20+ files | High — mechanical, low risk |
| 7 | **Clean up `globalThis.__lb_db_cleanup_errors` per scenario** | 4g — shared array | 1 harness file | High — reset array on entry |
| 8 | **Explicit env allowlist for child processes** | 4c — env inheritance | 10+ files | Medium — requires known-variable inventory |
| 9 | **Convert shared-server browser tests to per-test servers** | 4b — shared mutable server | 3 settings test files | Medium — structural change, verified by existing patterns |
| 10 | **Replace `delete require.cache` broad scan with targeted path** | 4h — module cache mutation | 4 files | Medium — requires understanding dependency graph |
| 11 | **Convert repeat ESM `import()` to shared const** | 4g — module singleton re-import | 2 loop-contract files | Low — import-once optimization, optional |
| 12 | **Add SIGTERM/SIGINT handlers for DB cleanup** | 4j — orphaned databases | 1 harness file | Medium — signal handling for non-crash cases |
| 13 | **Local PG orchestration script** | 4m — no local PG setup | New script | Low — dev tooling, not CI blocker |

## 10. Recommended first implementation slice

**Slice 1: Replace `getFreePort()` two-step TOCTOU pattern with direct `server.listen(0)`**

**Rationale:**
- Addresses a confirmed TOCTOU race condition (severity Medium under file concurrency)
- Mechanical, reversible change — proven by 5 files already using `server.listen(0)` directly
- Affects exactly 8 browser contract files, all sharing identical code
- Fix eliminates the race window entirely (OS assigns port atomically on `listen(0)`)
- No new dependencies, no package change, no workflow change
- Easy to verify: all 8 files must pass together in both sequential and default file-concurrency modes
- Rollback is a simple revert of the 8-file change

### 10a. Exact proposed files

| Action | File path |
|---|---|
| Edit | `tests/contracts/tree-layout-persistence-3582-browser-contract.test.cjs` |
| Edit | `tests/contracts/tree-layout-mode-policy-3581-browser-contract.test.cjs` |
| Edit | `tests/contracts/tree-card-composition-3578-browser-contract.test.cjs` |
| Edit | `tests/contracts/browse-story-view-foundation-3655-browser-contract.test.cjs` |
| Edit | `tests/contracts/browse-my-trees-compact-geometry-3608-browser-contract.test.cjs` |
| Edit | `tests/contracts/browse-my-trees-large-geometry-3608-browser-contract.test.cjs` |
| Edit | `tests/contracts/browse-my-trees-list-geometry-3608-browser-contract.test.cjs` |
| Edit | `tests/contracts/home-video-modal-loading-3707-browser-contract.test.cjs` |

**Change description per file:**
1. Remove the `getFreePort()` function (typically ~10 lines using `net.createServer()` + probe + close)
2. Replace `server.listen(port, '127.0.0.1', ...)` with `server.listen(0, '127.0.0.1', ...)`
3. Remove the `const port = await getFreePort()` call from `startServer()` or equivalent
4. Use `server.address().port` to capture the ephemeral port for `baseUrl`

**No other file may change in this slice.**

### 10b. Proposed focused evidence

The implementation child must report:

```bash
# A. All 8 exact files together, sequential file concurrency
node --test --test-concurrency=1 \
  tests/contracts/tree-layout-persistence-3582-browser-contract.test.cjs \
  tests/contracts/tree-layout-mode-policy-3581-browser-contract.test.cjs \
  tests/contracts/tree-card-composition-3578-browser-contract.test.cjs \
  tests/contracts/browse-story-view-foundation-3655-browser-contract.test.cjs \
  tests/contracts/browse-my-trees-compact-geometry-3608-browser-contract.test.cjs \
  tests/contracts/browse-my-trees-large-geometry-3608-browser-contract.test.cjs \
  tests/contracts/browse-my-trees-list-geometry-3608-browser-contract.test.cjs \
  tests/contracts/home-video-modal-loading-3707-browser-contract.test.cjs

# B. All 8 exact files together, default file concurrency
node --test \
  tests/contracts/tree-layout-persistence-3582-browser-contract.test.cjs \
  tests/contracts/tree-layout-mode-policy-3581-browser-contract.test.cjs \
  tests/contracts/tree-card-composition-3578-browser-contract.test.cjs \
  tests/contracts/browse-story-view-foundation-3655-browser-contract.test.cjs \
  tests/contracts/browse-my-trees-compact-geometry-3608-browser-contract.test.cjs \
  tests/contracts/browse-my-trees-large-geometry-3608-browser-contract.test.cjs \
  tests/contracts/browse-my-trees-list-geometry-3608-browser-contract.test.cjs \
  tests/contracts/home-video-modal-loading-3707-browser-contract.test.cjs
```

**Additional source assertions:**
- `getFreePort` probe/rebind pattern: 0 occurrences across all 8 files
- Direct `server.listen(0, '127.0.0.1')`: 8 occurrences (one per file)
- `server.address().port` used to capture ephemeral port: 8 occurrences

**Required results:**
- All subtests PASS in both runs
- EADDRINUSE: 0
- ECONNREFUSED: 0
- listen-related errors: 0
- teardown-uncompleted errors: 0

A repeated parallel stress loop may be proposed only as bounded additional evidence. No blind retry may convert failure into success.

### 10c. Browser execution authorization

The eight proposed files are Playwright browser contracts. Running them launches local Chromium.

The future implementation child authorization is:

```text
local Playwright Chromium execution for the 8 exact affected contracts:
  required and authorized

remote browser, Preview, Production, provider, Docker, PostgreSQL,
and unrelated browser suites:
  forbidden
```

The audit PR itself (#3720) remains source-only and does not execute a browser.

### 10d. Rollback

```text
git revert <implementation-SHA>
```

No runtime state, workflow configuration, branch protection, database state, provider state, Production state, or lockfile change is created.

### 10e. Stop conditions

The implementation child stops immediately if:
1. Any affected file has been modified by a parallel child (#3713 is the only parallel child, and its allowed files list does not include these 8 browser files).
2. The change expands beyond the 8 exact files listed in 10a.
3. `package.json`, `.github/workflows/`, lockfiles, runtime JS/CSS, DB, provider, or secret files are touched.
4. Any test is skipped, quarantined, retried, or given increased timeout.
5. Any test is executed beyond the 8 affected files.
6. A remote browser, Preview, Production, provider, Docker, PostgreSQL, or network action is performed.
7. The diff includes whitespace errors.
8. Cumulative changed files exceed exactly 8.

## 11. UNRESOLVED items

The following are confirmed gaps but are explicitly deferred to later slices or separate children:

| Gap | Reason for deferral | Target |
|---|---|---|
| PostgreSQL container lifecycle | CI handles this; local-PG orchestration is dev-tooling, not CI-hardening | Slice 13 or separate dev-tooling issue |
| Signal handling for DB cleanup | Requires orchestration beyond the test harness | Slice 12 |
| Branch/main dual execution | Requires workflow-level coordination | Separate child after isolation hardening |
| Standardized failure artifacts | Requires CI workflow change | Separate child after risk-tier gate wiring |
| Cross-platform CI matrix (Windows/Linux) | Requires runner configuration change | Separate child after isolation hardening |
| Python supplemental runner | No discovered workflow runner; scripts are not default CI | Separate infrastructure issue |
| Remote/provider manual scripts | Not default CI; requires auth/provider access | Separate ops issue |
| Local PG orchestration | No evidence of a defect; local setup is not automated | Slice 13 |

## References

Refs #3715.
Refs #3670 — Keep OPEN.
Refs #3710 — completed.
Refs #3713 — parallel, Keep OPEN.
Refs #1882 — Keep OPEN.
