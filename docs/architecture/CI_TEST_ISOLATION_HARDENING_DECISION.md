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

## 2. Isolation-domain inventory

Each domain is enumerated across `package.json` scripts (line 10), `.github/workflows/ci.yml`, `tests/ci-test-group-registry.json`, `tests/test-layer-classification.json`, and direct file source reads.

| Domain | Scope | Files | Test type label |
|---|---|---|---|
| Fixed/listening ports | 15 browser-contract test files | `tests/contracts/*browser*contract*.test.cjs` | BROWSER_REAL_LOCAL |
| HTTP server lifecycle | Same 15 browser-contract files | `tests/contracts/*browser*contract*.test.cjs` | BROWSER_REAL_LOCAL |
| Child process spawn/exit/kill | 7 DB engine + 3 loop-contract files | `tests/db-engine/*.test.cjs`, `tests/contracts/lovebud-loop-*.test.cjs` | DB_ENGINE, PROCESS_REAL_LOCAL |
| Temporary directories and filenames | 20+ contract test files | `tests/contracts/*.test.cjs` (various) | SOURCE_STATIC, EXECUTED_FAKE, BROWSER_REAL_LOCAL |
| Browser contexts/pages | 15 browser-contract test files | `tests/contracts/*browser*contract*.test.cjs` | BROWSER_REAL_LOCAL |
| Fake timers and real timers | 30+ test files | Various `tests/contracts/*.test.cjs` | SOURCE_STATIC, EXECUTED_FAKE, BROWSER_REAL_LOCAL |
| Global/environment mutation | 5+ test files | `tests/contracts/scout-*-*.test.cjs`, `tests/contracts/db-migration-canonical-*.test.cjs`, `tests/contracts/owner-tree-list-*.test.cjs` | EXECUTED_FAKE |
| Module cache mutation | 4 test files | `tests/contracts/relationship-hints-*.test.cjs`, `tests/contracts/db-migration-*-*.test.cjs` | SOURCE_STATIC, EXECUTED_FAKE |
| Filesystem cleanup | 25+ test files | Various `tests/contracts/` and `tests/db-engine/` | All layers |
| Signal handling | 0 test files | None | N/A |
| Parallel execution | Main `npm test` script | All 766 default-CI files | All default layers |
| Windows path/drive assumptions | 5 files | `scripts/report-test-layers.cjs`, `scripts/report-ci-test-groups.cjs`, `tests/helpers/import-absolute.cjs`, `lovebud-loop-*.test.cjs` | Various |
| PostgreSQL/container lifecycle | 7 DB engine test files + CI workflow | `tests/db-engine/*.test.cjs`, `.github/workflows/ci.yml` | DB_ENGINE |

## 3. Isolation-domain inventory with evidence

### 3a. Fixed/listening ports — CONFIRMED_HAZARD

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

**Affected files:**
- `tests/contracts/tree-layout-persistence-3582-browser-contract.test.cjs`
- `tests/contracts/tree-layout-mode-policy-3581-browser-contract.test.cjs`
- `tests/contracts/tree-card-composition-3578-browser-contract.test.cjs`
- `tests/contracts/browse-story-view-foundation-3655-browser-contract.test.cjs`
- `tests/contracts/browse-my-trees-compact-geometry-3608-browser-contract.test.cjs`
- `tests/contracts/browse-my-trees-large-geometry-3608-browser-contract.test.cjs`
- `tests/contracts/browse-my-trees-list-geometry-3608-browser-contract.test.cjs`
- `tests/contracts/home-video-modal-loading-3707-browser-contract.test.cjs`

**Safe counter-examples:** Four files already use direct `server.listen(0, '127.0.0.1')` which lets the OS assign an ephemeral port atomically:
- `tests/contracts/editor-sidebar-module-browser-runtime-3576-contract.test.cjs`
- `tests/contracts/editor-owner-tree-scope-browser-runtime-3576-contract.test.cjs`
- `tests/contracts/settings-readonly-account-3583-browser-contract.test.cjs`
- `tests/contracts/settings-password-reset-3635-browser-contract.test.cjs`
- `tests/contracts/settings-display-name-edit-3617-browser-contract.test.cjs`

### 3b. HTTP server lifecycle — CONFIRMED_HAZARD

**Evidence:** Three settings browser test files share a single server across all subtests via `before`/`after`:

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

**Additional finding:** Multiple browser test files call `server.close()` without `await` in `finally` blocks:

`tests/contracts/tree-layout-persistence-3582-browser-contract.test.cjs:681-683`:
```js
} finally {
  server.close();       // not awaited — port release race
  await browser.close();
}
```

This means the port may not be released before the next test starts. Under parallel sibling execution within the same file (default concurrency), this creates a cross-subtest port collision window.

### 3c. Child process spawn/exit/kill — LATENT_COLLISION_RISK

**Evidence:** DB engine tests and loop-contract tests spawn child processes with full `process.env` propagation:

`tests/db-engine/helpers/postgres-disposable-harness.cjs:96-133` — `runPsqlFile` uses `spawnSync` with `env: { ...process.env, PGPASSWORD: cfg.password }`.

`tests/contracts/lovebud-loop-policy-loader-contract.test.cjs:329-333`:
```js
cp.spawnSync('node', ['scripts/loop/run-loop.mjs', '--mode=dry-run'], {
  env: { ...process.env, LOCALAPPDATA: '' }
});
```

Three loop-contract files use `LOCALAPPDATA: ''` override:
- `tests/contracts/lovebud-loop-policy-loader-contract.test.cjs:333,397`
- `tests/contracts/lovebud-loop-triage-contract.test.cjs:357`
- `tests/contracts/lovebud-loop-autonomy-policy-contract.test.cjs:153`

Full `process.env` propagation leaks CI credentials (GITHUB_TOKEN, DATABASE_URL, etc.) to child processes and makes child behavior depend on CI-injected variables.

DB engine `spawnSync` calls have `timeout: 60000` (60-second bound), which contains hangs.

### 3d. Temporary directories and filenames — CONFIRMED_HAZARD (shared fixtures)

**Evidence:** Five test files write to shared `_tmp-*.json` paths under `tests/contracts/fixtures/migration-provenance/`:

- `tests/contracts/migration-provenance-gate-contract.test.cjs:407-410,554-591` — writes `_tmp-catalog-binding.json`, `_tmp-ledger-binding.json`, `_tmp-ledger-bad.json`, `_tmp-catalog-ok.json`, `_tmp-catalog-missing-pair.json`, `_tmp-missing-ledger.json`
- `tests/contracts/expected-schema-candidate-contract.test.cjs:438,524,551,576` — writes `_tmp-sensitive-evidence.json`, `_tmp-candidate-evidence.json`, `_tmp-bad.json`, `_tmp-symlink-escape-evidence.json`
- `tests/contracts/adoption-attestation-contract.test.cjs:696,851,854` — writes `_tmp-adoption-symlink.json`, `_tmp-cli-catalog.json`, `_tmp-cli-ledger.json`
- `tests/contracts/adoption-baseline-collection-plan-contract.test.cjs:473,489` — writes `_tmp-plan-bad.json`, `_tmp-plan-symlink.json`
- `tests/contracts/migration-catalog-fingerprint-contract.test.cjs:461,482` — writes `_tmp-invalid-${process.pid}.json`, `_tmp-invalid-utf8-${process.pid}.bin.json` (uses process.pid, still collides within same process)

The codebase acknowledges this pattern in `tests/contracts/no-hardcoded-local-test-paths-contract.test.cjs:39-43`:
```js
function isKnownEphemeralFixture(file) {
  return /(^|\/)_tmp-[^/]+\.json$/i.test(relative);
}
```

Two additional files write to shared repo-root `.tmp-*` directories:
- `tests/contracts/public-mobile-detail-visibility-3567-contract.test.cjs:220-223` — `.tmp-3567-fixtures/`
- `tests/contracts/editor-sidebar-module-browser-runtime-3576-contract.test.cjs:118-121` — `.tmp-3576-sidebar-module/`

**Safe examples:** 20+ files correctly use `os.mkdtempSync(path.join(os.tmpdir(), unique-prefix))` which guarantees uniqueness. However, these also generally lack cleanup in `finally` blocks or `t.after()` hooks.

### 3e. Browser contexts/pages — BOUNDED_ACCEPTABLE

**Evidence:** All 15 browser-contract files create isolated Playwright `browser`/`context`/`page` instances per test or per suite. The risk of cross-test browser state leakage is bounded by Playwright's own isolation model (each context is a separate storage/state partition).

Hazard exists only when shared browser instances are used across subtests (3 settings files, see 3b) — but Playwright's `context` isolation within a shared `browser` provides reasonable separation for the existing test patterns.

### 3f. Fake timers and real timers — LATENT_COLLISION_RISK

**Evidence:** Real `setTimeout`/`setInterval` are used for timing-dependent waits in browser tests:

- `tests/contracts/tree-layout-persistence-3582-editor-route-contract.test.cjs:506-510` — `await page.waitForTimeout(400)`
- Multiple other browser tests use `waitForTimeout` with hardcoded delays (15ms, 200ms, 400ms)

Fake timer harness exists in:
- `tests/contracts/editor-nochange-save-entry-evidence-3299.test.cjs:32-54` — custom `setTimeoutFake`/`advanceBy` harness

The inconsistency creates timing sensitivity. Real timers in parallel execution make test behavior dependent on host CPU load and scheduler.

### 3g. Global/environment mutation — CONFIRMED_HAZARD

**Evidence 1 — `globalThis.fetch` mutation:**

`tests/contracts/scout-suggest-endpoint-live-adapter-mock-only-wiring-contract.test.cjs:345-391,405-531`:
```js
const originalFetch = globalThis.fetch;
globalThis.fetch = async (url, init) => { ... };
// If test fails before restore, all parallel tests lose real fetch
globalThis.fetch = originalFetch;
```

`tests/contracts/owner-tree-list-observability-contract.test.cjs:301-347`:
```js
const originalFetch = global.fetch;
global.fetch = mockFetch;
try { ... } finally { global.fetch = originalFetch; }
```

**Evidence 2 — `JSON.parse` mutation:**

`tests/contracts/db-migration-canonical-manifest-adapter-contract.test.cjs:1645-1651,2016-2017`:
```js
beforeEach(() => { originalParse = JSON.parse; });
afterEach(() => { JSON.parse = originalParse; });
// Subtests patch JSON.parse with getter-throwing wrapper
```

**Evidence 3 — `globalThis.__lb_db_cleanup_errors` shared array:**

`tests/db-engine/helpers/postgres-disposable-harness.cjs:195-196`:
```js
if (!globalThis.__lb_db_cleanup_errors) globalThis.__lb_db_cleanup_errors = [];
globalThis.__lb_db_cleanup_errors.push(`${scenario}:${code}`);
```

Same pattern in `tests/db-engine/tree-comments-reconcile-postgres.test.cjs:205-206`.

**Evidence 4 — Repeat ESM `import()` of same module:**

`tests/contracts/lovebud-loop-triage-contract.test.cjs:79-124` — 10+ subtests each call `await import('../../scripts/loop/build-queue.mjs')`, getting the same module singleton via ESM cache.

`tests/contracts/lovebud-loop-policy-loader-contract.test.cjs:42-137` — 10+ subtests each call `await import('../../scripts/loop/policy-loader.mjs')`.

If the imported module has internal mutable state, parallel subtests within the same `describe` block (run concurrently by default) will interfere.

### 3h. Module cache mutation — LATENT_COLLISION_RISK

**Evidence:** Four files mutate `require.cache`:

- `tests/contracts/relationship-hints-ui-controller-contract.test.cjs:123-129` — deletes specific cached paths
- `tests/contracts/db-migration-source-validation-adapter-contract.test.cjs:187` — deletes temp-copied adapter path
- `tests/contracts/db-migration-precondition-registry-source-validation-contract.test.cjs:860-861,887-888` — cascading deletes
- `tests/contracts/db-migration-canonical-manifest-adapter-contract.test.cjs:185-191` — iterates ALL `Object.keys(require.cache)` deleting matching entries

The full-cache scan in the canonical manifest adapter test (line 185-191) is the most aggressive and could affect parallel tests actively loading modules.

### 3i. Filesystem cleanup — LATENT_COLLISION_RISK

**Evidence:** The `_tmp-*.json` and `.tmp-*` directory patterns have cleanup in `try/finally` blocks, but:
1. Parallel subtests writing to the same path will race (see 3d)
2. No `after`/`afterEach` hooks ensure cleanup if a subtest crashes
3. `os.mkdtempSync` directories (20+ files) are never explicitly cleaned up — rely on OS /tmp ephemeral behavior

One file writes outside the repo entirely:
`tests/contracts/tree-layout-persistence-3582-editor-route-contract.test.cjs:25`:
```js
const EVIDENCE = path.resolve(ROOT, '..', 'local-backup', 'lovebud-3582-persistence');
```
Evidence directory `../local-backup/` is outside the repo with no cleanup protocol.

### 3j. Signal handling — UNRESOLVED

**Evidence:** Zero signal handlers found across all test files. `grep -r "process.on.*SIG" tests/` returns no matches.

DB engine tests create disposable databases that become orphaned if the test process receives SIGKILL (uncatchable) or the `finally` cleanup block is skipped due to process crash. No SIGTERM/SIGINT handler exists to clean up orphaned `lovebud_ci_*` databases.

### 3k. Parallel execution — CONFIRMED_HAZARD

**Evidence:** Main `npm test` script at `package.json:10`:
```json
"test": "node --test tests/smoke/*.test.cjs tests/routes/*.test.cjs tests/contracts/*.test.cjs"
```
No `--test-concurrency` flag. Node.js default test runner concurrency is max(available CPUs × 8, 32) in Node 20. This means up to 32 test files execute in parallel in a single process.

DB engine scripts are safe — each uses `--test-concurrency=1`:
```json
"test:db-engine:tree-comments": "node --test --test-concurrency=1 tests/db-engine/tree-comments-reconcile-postgres.test.cjs"
```

The combination of parallel execution with:
- TOCTOU in `getFreePort()` (3a)
- Shared `_tmp-*.json` fixture paths (3d)
- Global mutation (3g)
- Module cache mutation (3h)

creates concrete cross-test collision paths.

### 3l. Windows path/drive assumptions — PLATFORM_ASSUMPTION

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

### 3m. PostgreSQL/container lifecycle — BOUNDED_ACCEPTABLE

**Evidence:** CI workflow declares PostgreSQL 17.4 service containers per job (`.github/workflows/ci.yml:45-67,97-123,etc.`). Seven DB engine jobs each get a dedicated disposable `postgres:17.4-bookworm` container with:
- Isolated ephemeral credentials per run (`${{ format('{0}-{1}', github.run_id, github.run_attempt) }}`)
- Host restriction to `127.0.0.1` (harness line 15)
- User restriction to `lovebud_ci_*` pattern (harness line 16)
- Database prefix restriction to `lovebud_ci_` (harness line 17)
- `DROP DATABASE IF EXISTS ... WITH (FORCE)` in finally blocks
- Unique test DB names using `process.pid` + `crypto.randomBytes(4).toString('hex')`

Each DB job is a separate workflow job, so they are truly isolated from each other and from the main test suite. No concurrent test shares a PG instance.

**Limitation:** No local-development PG orchestration exists. Tests assume a pre-existing PG at `localhost:5432`. No Docker container lifecycle is managed by the tests themselves.

## 4. Severity/likelihood/blast-radius matrix

| # | Hazard | Severity | Likelihood | Blast radius |
|---|---|---|---|---|
| 3a | TOCTOU in `getFreePort()` — port race | Medium | Medium (under parallel execution, correlated with host load) | 8 browser test files, EADDRINUSE failures |
| 3b | HTTP server lifecycle — shared mutable server | Medium | Low (sequential per file, but cross-subtest state leak) | 3 settings test files |
| 3b | `server.close()` not awaited | Low | Medium (under parallel sibling execution) | All browser files with `try/finally` pattern |
| 3c | Full `process.env` propagation to child | Medium | High (every run) | 10+ test files, credential exposure |
| 3d | Shared `_tmp-*.json` fixture paths | High | Medium (under parallel execution of affected files) | 5 migration-provenance test files |
| 3d | `.tmp-*` dirs in repo root | Medium | Low (single file per dir, but no collision guard) | 2 files |
| 3d | `mkdtempSync` no cleanup | Low | High (every run) | 20+ files, disk accumulation |
| 3g | `globalThis.fetch` mutation | High | Medium (depends on parallel timing) | All tests using real fetch |
| 3g | `JSON.parse` mutation | High | Medium (depends on parallel timing) | All tests using JSON.parse |
| 3g | `globalThis.__lb_db_cleanup_errors` shared array | Low | High (every DB engine run) | 7 DB engine tests, logic errors |
| 3g | Repeat ESM `import()` of same module | Low | High (every run of affected files) | 2 loop-contract files |
| 3h | `delete require.cache` broad scan | Medium | Low (parallel timing needed for collision) | 4 files, all contract tests indirectly |
| 3j | No signal handler for DB cleanup | Medium | Low (process crash is rare) | All DB engine tests |
| 3k | No `--test-concurrency` cap | High | High (every run) | All 766 default-CI files |
| 3l | Windows path assumptions | Low | Low (CI is Ubuntu only) | 5 files, platform-dependent |
| 3m | No local PG orchestration | Low | Low (CI handles containers) | Local development only |

## 5. Branch versus pristine-main reproduction rule

**CONFIRMED:** Every hazard listed above exists in pristine `main` at `235ec59b2a5a40e0cf0115ebe45b2c6e50abbcdc`.

- **Pristine-main reproducible:** TOCTOU port race, shared `_tmp-*.json` paths, `globalThis.fetch` mutation, `JSON.parse` mutation, full env propagation, `require.cache` deletion, no signal handlers, no concurrency cap, `mkdtempSync` no cleanup, `LOCALAPPDATA` override, Windows drive-letter checks.
- **Branch-induced only:** None. No branch-specific isolation delta is required for reproduction.
- **Stochastic (load/timing dependent):** Port race from `getFreePort()` + parallel execution, global mutation collision under parallel siblings, `server.close()` not-awaited race.

**Verification rule for the first implementation slice:** The fix must be verified against pristine `main` (or the implementation branch based on `main`) without requiring a separate `main` checkout. The fix is deterministic (port binding on `listen(0)`) and can be verified by running the affected test files individually (sequential mode) to prove continued correct behavior and together (parallel mode) to prove no port collision.

## 6. Cleanup ownership model

| Resource type | Current owner | Required model | Gap |
|---|---|---|---|
| HTTP server port | Per-test inline lifecycle | Test file creates, test file destroys via `t.after()` or `finally`-awaited close | `server.close()` not awaited; no afterEach for subtest isolation |
| Temp directory `os.tmpdir()` | No explicit owner | Test file creates, test file destroys via `t.after()` | 20+ files never clean up |
| `_tmp-*.json` fixture files | Inline `try/finally` unlink | Test writes, test destroys; path must be unique | 5 files share same paths |
| `.tmp-*` repo-root dirs | Inline `try/finally` rmSync | Test creates, test destroys | 2 files, path collision possible |
| `globalThis.fetch` | Per-test save/restore try/finally | Test mocks, test restores; must survive parallel | No parallel-safety guarantee |
| `JSON.parse` | beforeEach/afterEach | Test patches, test restores per subtest | Same parallel gap |
| `globalThis.__lb_db_cleanup_errors` | Appending, never cleared | Each test scenario pushes, array grows unbounded | Every DB run accumulates |
| DB engine test databases | withDisposableDb finally block | Test creates, harness drops via DROP DATABASE IF EXISTS WITH (FORCE) | No SIGTERM handler for crash case |
| Child process env | Implicit full propagation | Explicit allowlist of env vars | Current pattern leaks CI credentials |

## 7. Sanitized failure-artifact requirements

For the recommended first slice (port TOCTOU), the required evidence on failure is:

```
CONFIRMED: <test file> passes sequentially at SHA <X> with <N> subtests.
CONFIRMED: <test file> passes concurrently at SHA <X> with <N> subtests.
CONFIRMED: no EADDRINUSE, ECONNREFUSED, or timeout failure in any test output.
```

Future slices should define a minimum failure-artifact packet: TAP output, normalized JSON classification, and per-test-file status keyed by SHA. This document does not specify the full packet schema; that is deferred to the CI failure-artifact standardization child.

## 8. Ordered implementation slices

The following slices are ordered by net isolation gain ÷ change risk × evidence certainty.

| Order | Slice | Hazard addressed | Estimated files changed | Evidence certainty |
|---|---|---|---|---|
| 1 | **Replace `getFreePort()` with direct `server.listen(0)`** | 3a — TOCTOU port race | 8 browser test files | High — mechanical replacement, proven by 5 existing files |
| 2 | **Await all `server.close()` calls** | 3b — port release race | ~15 browser test files | High — missing `await`, mechanical fix |
| 3 | **Unique `_tmp-*.json` fixture paths with process-unique tokens** | 3d — shared fixture paths | 5 migration-provenance files | High — add `process.pid` or random suffix |
| 4 | **Global mutation guard: restore `fetch`/`JSON.parse` in `t.after()`** | 3g — global mutation | 3 test files | Medium — `t.after()` run per-test but parallel siblings not serialized |
| 5 | **Cap main test concurrency** | 3k — parallel hazard | 1 file (`package.json`) | High — add `--test-concurrency=1` or `=4` |
| 6 | **Clean up `mkdtempSync` dirs in `t.after()`** | 3d — temp dir accumulation | 20+ files | High — mechanical, low risk |
| 7 | **Clean up `globalThis.__lb_db_cleanup_errors` per scenario** | 3g — shared array | 1 harness file | High — reset array on entry |
| 8 | **Explicit env allowlist for child processes** | 3c — env propagation | 10+ files | Medium — requires known-variable inventory |
| 9 | **Convert shared-server browser tests to per-test servers** | 3b — shared mutable server | 3 settings test files | Medium — structural change, verified by existing patterns |
| 10 | **Replace `delete require.cache` broad scan with targeted path** | 3h — module cache mutation | 4 files | Medium — requires understanding dependency graph |
| 11 | **Convert repeat ESM `import()` to shared const** | 3g — module singleton re-import | 2 loop-contract files | Low — import-once optimization, optional |
| 12 | **Add SIGTERM/SIGINT handlers for DB cleanup** | 3j — orphaned databases | 1 harness file | Medium — signal handling for non-crash cases |
| 13 | **Local PG orchestration script** | 3m — no local PG setup | New script | Low — dev tooling, not CI blocker |

## 9. Recommended first implementation slice

**Slice 1: Replace `getFreePort()` two-step TOCTOU pattern with direct `server.listen(0)`**

**Rationale:**
- Addresses a confirmed TOCTOU race condition (severity Medium under parallel execution)
- Mechanical, reversible change — proven by 5 files already using `server.listen(0)` directly
- Affects exactly 8 browser contract files, all sharing identical code
- Fix eliminates the race window entirely (OS assigns port atomically on `listen(0)`)
- No new dependencies, no package change, no workflow change
- Easy to verify: affected files must pass both sequentially and concurrently
- Rollback is a simple revert of the 8-file change

### 9a. Exact proposed files

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

### 9b. Proposed focused evidence (not test execution)

The implementation child must report:

```text
1. Exact SHA of the fix commit.
2. For each of the 8 affected files:
   - `node --test --test-concurrency=1 <file>` passes cleanly with all subtests.
   - `node --test <file>` (default concurrency) passes cleanly with all subtests.
3. No EADDRINUSE, ECONNREFUSED, or listen-related error in any run output.
4. `git diff --check` = no whitespace error.
5. `git diff --stat origin/main...HEAD` = exactly 8 files changed.
```

The implementation child **must not** run `npm test` (the full 766-file suite), `npm run lint`, `npm run build`, `npm run verify`, CI workflows, browsers, Docker, PostgreSQL, or any provider/remote command.

### 9c. Rollback

```text
git revert <implementation-SHA>
```

No runtime state, workflow configuration, branch protection, database state, provider state, Production state, or lockfile change is created.

### 9d. Stop conditions

The implementation child stops immediately if:
1. Any affected file has been modified by a parallel child (#3713 is the only parallel child, and its allowed files list does not include these 8 browser files).
2. The change expands beyond the 8 exact files listed in 9a.
3. `package.json`, `.github/workflows/`, lockfiles, runtime JS/CSS, DB, provider, or secret files are touched.
4. Any test is skipped, quarantined, retried, or given increased timeout.
5. Any test is executed beyond the 8 affected files in sequential or single-file concurrent mode.
6. A browser, Docker, PostgreSQL, network, provider, or Production action is performed.
7. The diff includes whitespace errors.
8. Cumulative changed files exceed exactly 8.

## 10. UNRESOLVED items

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

## References

Refs #3715.
Refs #3670 — Keep OPEN.
Refs #3710 — completed.
Refs #3713 — parallel, Keep OPEN.
Refs #1882 — Keep OPEN.
