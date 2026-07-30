# CI Browser Fixture Lifecycle Audit

**Issue:** #3755  
**Parent:** #3670 — Keep OPEN  
**Baseline:** `9af1f6116566e9b616a89f108bc17e002bcf8485`  
**Date:** 2026-07-30  
**Scope:** Source-only audit — no test/source/package/workflow modifications authorized.

---

## 1. Audit Scope

Inventory browser and HTTP fixture test contracts for lifecycle debt in:

- Listener/port ownership (ephemeral vs fixed)
- Server startup and teardown patterns
- `server.close()` — awaited vs fire-and-forget
- `browser.close()`, `context.close()`, `page.close()` — order and await
- Fake-clock ownership (`page.clock`, `setTimeout`, `setInterval`)
- Runner-owned vs untracked top-level async
- `process.exit()` and custom pass/fail counters
- `run().catch()` untracked lifecycle

---

## 2. Contracts Inspected

### 2.1 Browser contracts with `http.createServer` — 21 files

All follow a consistent pattern:

```
startServer() → http.createServer(reqHandler) → server.listen(0, '127.0.0.1', callback)
closeServer(server) → new Promise((resolve, reject) => { server.close((error) => { ... }) })
```

| # | File | Port | Teardown | Runner | Focused command from source |
|---|---|---|---|---|---|
| 1 | `browse-my-trees-compact-geometry-3608-browser-contract.test.cjs` | ephemeral (0) | `await closeServer(server)` in `finally` | `test()` | ✅ `node --test tests/contracts/...` |
| 2 | `browse-my-trees-large-geometry-3608-browser-contract.test.cjs` | ephemeral (0) | `await closeServer(server)` in `finally` | `test()` | ✅ |
| 3 | `browse-my-trees-list-geometry-3608-browser-contract.test.cjs` | ephemeral (0) | `await closeServer(server)` in `finally` | `test()` | ✅ |
| 4 | `browse-story-view-foundation-3655-browser-contract.test.cjs` | ephemeral (0) | `await closeServer(server)` in `finally` | `test()` | ✅ |
| 5 | `editor-balanced-independent-rails-3585-contract.test.cjs` | ephemeral (0) | `await closeServer(server)` in `finally` | `test()` | ✅ |
| 6 | `editor-explicit-appreciation-edit-mode-3586-contract.test.cjs` | ephemeral (0) | `await closeServer(server)` in `finally` | `test()` | ✅ |
| 7 | `editor-owner-tree-scope-browser-runtime-3576-contract.test.cjs` | ephemeral (0) | `await closeServer(server)` in `finally` | `test()` | ✅ |
| 8 | `editor-sidebar-module-browser-runtime-3576-contract.test.cjs` | ephemeral (0) | `await closeServer(server)` in `finally` | `test()` | ✅ |
| 9 | `home-thumbnail-loading-browser-contract.test.cjs` | ephemeral (0) | `await closeServer(server)` in `finally` | `test()` | ✅ |
| 10 | `home-video-modal-loading-3707-browser-contract.test.cjs` | ephemeral (0) | `await closeServer(server)` via `t.after()` | `test()` → `t.test()` | ✅ |
| 11 | `my-trees-mobile-preview-sheet-contract.test.cjs` | ephemeral (0) | `await closeServer(server)` in `finally` | `test()` | ✅ |
| 12 | `owner-appreciation-tree-scope-css-3580-contract.test.cjs` | ephemeral (0) | `await closeServer(server)` in `finally` | `test()` | ✅ |
| 13 | `public-mobile-detail-visibility-3567-contract.test.cjs` | ephemeral (0) | `await closeServer(server)` in `finally` | `test()` | ✅ |
| 14 | `public-viewer-csp-header-3589-contract.test.cjs` | ephemeral (0) | `await closeServer(server)` in `finally` | `test()` | ✅ |
| 15 | `settings-display-name-edit-3617-browser-contract.test.cjs` | ephemeral (0) | `await closeServer(server)` in `finally` | `test()` | ✅ |
| 16 | `settings-password-reset-3635-browser-contract.test.cjs` | ephemeral (0) | `await closeServer(server)` in `finally` | `test()` | ✅ |
| 17 | `settings-readonly-account-3583-browser-contract.test.cjs` | ephemeral (0) | `await closeServer(server)` in `finally` | `test()` | ✅ |
| 18 | `tree-card-composition-3578-browser-contract.test.cjs` | ephemeral (0) | `await closeServer(server)` in `finally` | `test()` | ✅ |
| 19 | `tree-layout-mode-policy-3581-browser-contract.test.cjs` | ephemeral (0) | `await closeServer(server)` in `finally` | `test()` | ✅ |
| 20 | `tree-layout-persistence-3582-browser-contract.test.cjs` | ephemeral (0) | `await closeServer(server)` in `finally` | `test()` | ✅ |
| 21 | `tree-layout-persistence-3582-editor-route-contract.test.cjs` | ephemeral (0) | `await closeServer(server)` in `finally` | `test()` | ✅ |

**Teardown order (consistent across all):**

```
page.close()    → awaited (when used)
context.close() → awaited
browser.close() → awaited
closeServer()   → awaited
```

**Focused command:** All 21 contracts can be run individually via `node --test tests/contracts/<filename>`.

**Classification: CONFIRMED_SAFE** — All 21 contracts.

---

### 2.2 Fake-clock ownership — 1 file

| File | Pattern | Owner |
|---|---|---|
| `home-video-modal-loading-3707-browser-contract.test.cjs` | `page.clock.install()` + `page.clock.fastForward()` | Playwright (browser-owned) |

`page.clock` is a Playwright API that installs fake timers _inside the browser context_, not in the Node.js process. Timer advancement is deterministic via explicit `fastForward()` calls. Teardown is implicit when `browser.close()` or `context.close()` is called.

No `setTimeout`/`setInterval` in this file's Node process that could race with assertion logic.

**Classification: CONFIRMED_SAFE**

---

### 2.3 `setTimeout`/`setInterval` in Node process (non-browser contracts)

Scattered across ~40 non-browser contracts. Common patterns:

- `await new Promise(resolve => setTimeout(resolve, N))` — deterministic microtask flush
- `setTimeout` injected into sandbox/VM context as controlled mock
- `clock.setTimeout` from deterministic fake clock (e.g., `browse-my-trees-staged-loading-contract.test.cjs`)

These are all used within runner-owned `test()` callbacks with proper await. No timer-based flakiness pattern is visible from source alone.

**Classification: LIKELY_SAFE_NEEDS_EXECUTION_EVIDENCE**

---

### 2.4 `run().catch()` untracked lifecycle — 15 files

Excluding the file fixed by PR #3745 (`scout-staging-provider-activation-guard-contract.test.cjs`):

| File | Has browser fixture? |
|---|---|
| `editor-appreciation-order-qa-contract.test.cjs` | No |
| `scout-api-key-provider-transport-gates-contract.test.cjs` | No |
| `scout-live-auth-rate-limit-boundary-reconcile-contract.test.cjs` | No |
| `scout-live-auth-rate-limit-endpoint-di-contract.test.cjs` | No |
| `scout-live-auth-rate-limit-endpoint-observability-contract.test.cjs` | No |
| `scout-live-auth-rate-limit-endpoint-safe-fail-wiring-contract.test.cjs` | No |
| `scout-live-auth-rate-limit-readiness-audit-contract.test.cjs` | No |
| `scout-live-auth-rate-limit-runtime-boundary-contract.test.cjs` | No |
| `scout-live-endpoint-error-readiness-audit-contract.test.cjs` | No |
| `scout-live-endpoint-error-taxonomy-contract.test.cjs` | No |
| `scout-live-provider-adapter-skeleton-contract.test.cjs` | No |
| `scout-live-provider-transport-contract.test.cjs` | No |
| `scout-provider-specific-adapter-selection-boundary-contract.test.cjs` | No |
| `scout-provider-specific-adapter-skeleton-contract.test.cjs` | No |
| `scout-suggest-local-model-smoke-gate-contract.test.cjs` | No |

**None involve browser or HTTP fixtures.** These are unit/contract tests with no listener, no server, no browser.

These contracts represent a known lifecycle pattern (`run().catch()`) that the #3745 series is progressively converting. They are **OUT_OF_SCOPE** for this browser fixture audit.

**Classification: OUT_OF_SCOPE**

---

### 2.5 `process.exit()` — files outside browser fixture scope

| File | Usage | Classification |
|---|---|---|
| `browse-mytrees-card-visual-alignment-contract.test.cjs` | `if (failed > 0) process.exit(1)` — custom counter, no server/browser | **OUT_OF_SCOPE** |
| `browse-mytrees-chip-visual-alignment-contract.test.cjs` | same pattern | **OUT_OF_SCOPE** |
| `browse-mytrees-empty-state-visual-alignment-contract.test.cjs` | same pattern | **OUT_OF_SCOPE** |
| `browse-mytrees-visual-alignment-contract.test.cjs` | same pattern | **OUT_OF_SCOPE** |
| `ci-risk-gate-policy-contract.test.cjs` | `process.exitCode` inspection (safe) | **CONFIRMED_SAFE** |
| `ci-test-group-registry-contract.test.cjs` | `process.exitCode` inspection (safe) | **CONFIRMED_SAFE** |
| `editor-appreciation-order-qa-contract.test.cjs` | `process.exit(1)` in `run().catch()` handler | **OUT_OF_SCOPE** |
| `scout-*` contracts | Various `process.exit(1)` patterns | **OUT_OF_SCOPE** (parallel to #3745 series) |

None of these involve browser or HTTP fixture listeners.

**Classification: OUT_OF_SCOPE**

---

### 2.6 PR #3743 hardening (completed)

`my-trees-mobile-preview-sheet-contract.test.cjs` was hardened in PR #3743 (`test(ci): harden mobile preview server isolation`) with +9/−19 lines. This was the last completed lifecycle hardening before this audit baseline.

---

### 2.7 PR #3746/Issue #3746 (parallel scope, CLOSED)

Issue #3746 (`[CI][Reliability] Make Home modal reduced-motion long-wait clock deterministic`) is parallel scope (CLOSED). Its scope did not overlap with browser fixture listener teardown; it focused on clock determinism for the reduced-motion modal lifecycle (a different axis of flakiness).

---

## 3. Pattern Summary

| Pattern | Files | Browser? | Classification |
|---|---|---|---|
| `http.createServer` + `server.listen(0, ...)` | 21 | Yes | **CONFIRMED_SAFE** |
| `server.close(callback)` awaited via Promise | 21 | Yes | **CONFIRMED_SAFE** |
| `browser.close()` awaited | 21 | Yes | **CONFIRMED_SAFE** |
| `context.close()` awaited | 21 | Yes | **CONFIRMED_SAFE** |
| `page.close()` awaited | 10+ | Yes | **CONFIRMED_SAFE** |
| `page.clock` (Playwright fake timer) | 1 | Yes | **CONFIRMED_SAFE** |
| `run().catch()` (no server/browser) | 15 | No | **OUT_OF_SCOPE** |
| `process.exit(1)` (no server/browser) | 10+ | No | **OUT_OF_SCOPE** |
| Timer settlement (`setTimeout` + await) | ~40 | Mixed | **LIKELY_SAFE_NEEDS_EXECUTION_EVIDENCE** |

---

## 4. Defect Assessment

### Checked risks

| Risk | Evidence | Verdict |
|---|---|---|
| Fixed shared port | All 21 browser contracts use `server.listen(0, ...)` — ephemeral OS-assigned ports | ✅ None found |
| Unawaited `server.close` | All 21 use `new Promise(resolve => server.close(resolve))` awaited in `finally` | ✅ None found |
| Listener close after browser exit | `server.close()` called after `browser.close()` in `finally` — correct ordering | ✅ None found |
| Top-level async not runner-owned | All browser contracts use `test()` / `t.test()` as the top-level registration | ✅ None found |
| Timer-settlement race in browser | `page.clock.fastForward()` is deterministic; no `setTimeout` in Node process for browser tests | ✅ None found |
| Teardown omission | Every `startServer()` has a matching `closeServer()` in `finally` or `t.after()` | ✅ None found |
| Browser/context close order | Consistent: pages → context → browser → server | ✅ Order preserved |

### Identified non-risks

- **Probe-close-rebind**: `server.listen(0, ...)` is the standard ephemeral-port pattern for test isolation, not a defect.
- **Owning a browser**: Per the issue rules, "Do not label a test flaky merely because it owns a server or browser."

---

## 5. Conclusion

**NO_BOUNDED_CANDIDATE_FOUND**

### Rationale

1. **All 21 browser/HTTP fixture contracts** use a uniform, runner-owned lifecycle with fully awaited teardown in the correct order.
2. **No fixed shared ports** exist across browser fixtures — all use ephemeral OS-assigned ports.
3. **No unawaited `server.close()`** calls were identified.
4. **No listener close after browser process exit** without awaiting was found.
5. **The `run().catch()` pattern** exists in 15 non-browser Scout contracts, but these are already targeted by the #3745 reliability child series and do not involve browser fixtures.
6. **`process.exit()`** usage is confined to non-browser contracts and is already tracked in the reliability workstream.
7. **Fake-clock ownership** (`page.clock`) is Playwright-owned and deterministic.

### Recommendations for future (non-blocking)

While no bounded candidate was found for immediate hardening, the following areas may warrant attention in future reliability cycles:

- The remaining `run().catch()` contracts (~15 files) are known lifecycle debt being addressed incrementally under #3670.
- Timer-settlement evidence (`setTimeout` + `await` in non-browser contracts) can only be confirmed through execution, not source audit alone.

### Active PR overlap

None — #3745 is completed, #3746 is CLOSED, and all other active PRs are outside browser fixture lifecycle scope.

---

## 6. Verification

| Check | Status |
|---|---|
| `git diff --check` | ✅ Clean |
| `git diff --name-only origin/main...HEAD` | 1 file (this document) |
| `git diff --stat origin/main...HEAD` | 1 file, 0 unexpected |
| `git status --short` | ✅ Clean |
| `git rev-list --left-right --count origin/main...HEAD` | 1 ahead, 0 behind |
| `git merge-base HEAD origin/main` | Matches expected baseline |
| New files | Exactly 1 — `docs/architecture/CI_BROWSER_FIXTURE_LIFECYCLE_AUDIT.md` |
| Unexpected files | 0 |

---

*Refs #3755, Refs #3670 (Keep OPEN), Refs #1882 (Keep OPEN)*
