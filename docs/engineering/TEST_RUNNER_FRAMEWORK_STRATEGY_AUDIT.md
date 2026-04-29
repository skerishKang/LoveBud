# Test Runner Framework Strategy Audit

> **Status:** STRATEGY_AUDIT
> **Source:** Issue #224
> **Type:** Docs-only — no test runner, dependency, or CI changes in this PR

---

## 1. Purpose

This document audits the current test runner framework strategy to determine whether a migration to Jest (or similar) is warranted, and defines guardrails before any package dependency or CI command changes.

The current baseline uses Node.js native `node:test` runner with `node:assert/strict` for contract/smoke tests, and separate Playwright-based browser smoke scripts for runtime verification.

---

## 2. Current Test Baseline to Inspect

### 2.1 Test Commands (from `package.json`)

| Command | Description | Framework |
|---------|-------------|-----------|
| `npm test` | Run contract/smoke tests | Node native `node --test` |
| `npm run verify` | Pre-deploy static verification | Custom Node script (`scripts/pre-deploy.js`) |
| `npm run verify:full` | Include remote/env checks | Extended verify |
| `npm run test:batch` | Batch test runner | Custom Node script |
| `npm run test:screenshots` | Capture screenshot evidence | Playwright |
| `npm run test:e2e:*` | E2E smoke flows | Playwright |

### 2.2 Test File Organization

```
tests/
├── smoke/
│   └── routes.test.js                 — static route existence, file structure
├── routes/
│   ├── static-page-aliases.test.js    — URL alias consistency
│   ├── search-runtime-modules.test.js — module load order
│   └── detail-alias-consistency.test.js
└── contracts/
    ├── public-private-boundary-doc.test.js
    ├── modal-private-ownership-policy.test.js
    ├── modal-public-memory-parent-visibility.test.js
    ├── auth-bootstrap-contract.test.js
    ├── auth-wait-policy.test.js
    ├── editor-script-order-contract.test.js
    ├── api-route-mapping.test.js
    └── ... (16 total contract tests)
```

### 2.3 Test Framework Stack

- **Unit/contract tests:** Node.js built-in `node:test` and `node:assert/strict` (no external dependency)
- **Browser E2E smoke:** Playwright (already in `devDependencies`)
- **Static verification:** Custom Node scripts (`scripts/pre-deploy.js`, `scripts/verify-core-flows.js`)
- **Batch runner:** `scripts/batch-test-runner.js`

### 2.4 CI Pipeline (`.github/workflows/ci.yml`)

```yaml
name: CI

on:
  pull_request:
  push:
    branches:
      - main

jobs:
  verify-static:
    runs-on: ubuntu-latest
    steps:
      - name: Checkout
        uses: actions/checkout@v4
      - name: Setup Node
        uses: actions/setup-node@v4
        with:
          node-version: 20
          cache: npm
      - name: Install
        run: npm ci
      - name: Lint
        run: npm run lint
      - name: Build check
        run: npm run build
      - name: Smoke test
        run: npm test
      - name: Verify
        run: npm run verify
```

---

## 3. Decision Questions

### Q1: Does Jest solve an actual problem in this codebase?

**Current state assessment:**
- Node native test runner is stable and sufficient for contract/smoke tests.
- Tests are primarily file-system, static analysis, and contract verification — no complex mocking needed.
- Playwright already covers browser/E2E scenarios separately.
- No current pain points reported around test organization, coverage, or debugging.

**Conclusion:** Jest's benefits (snapshot testing, rich assertions, mocking) are **not clearly needed** given the current test profile.

### Q2: Would keeping lightweight contract tests be more appropriate?

**Yes.** Current `node:test` + `assert/strict` approach:
- Zero additional dependency
- Fast startup (no Jest initialization overhead)
- Sufficient for static/file-system/contract checks
- Aligns with "lightweight verification" philosophy

Migration to Jest would add ~100MB to `node_modules` and increase CI runtime for questionable gain.

### Q3: Should browser/runtime smoke be separated from unit tests?

**Already separated.**
- `npm test` → Node contract tests (fast, deterministic)
- `npm run test:e2e:*` → Playwright browser smoke (slow, flaky-prone)
- CI runs both in sequence, but they are distinct concerns

No need to unify under one runner.

### Q4: Cloudflare Pages / Modal verification relationship?

Contract tests verify:
- Script load order (`auth-bootstrap-contract.test.js`)
- API route mapping (`api-route-mapping.test.js`)
- Visibility/policy contracts (multiple boundary tests)

These are **local static checks** — they do not require Cloudflare/Modal runtime. Runtime smoke is handled separately by E2E scripts.

---

## 4. Migration Risk Assessment

| Risk | Impact | Mitigation |
|------|--------|------------|
| **Package dependency increase** | High — Jest + Jest CLI + jsdom (if needed) adds ~100MB, slows `npm ci` | Avoid unless concrete need emerges |
| **CI runtime increase** | Medium — Jest startup time, test discovery overhead | Keep current fast Node native runner |
| **Flaky browser/runtime test mixing** | High — Jest encourages mixing unit/integration/E2E; we should keep them separate | Maintain separate Playwright suite; do not migrate E2E into Jest |
| **Existing `npm test` stability risk** | Medium — Migration breakage possible, test ID changes, coverage reporting changes | Do not migrate working tests; add Jest only for new tests that explicitly need it |
| **Coverage tooling integration** | Medium — Current no-coverage approach; Jest encourages `--coverage` which adds runtime | Keep coverage off unless explicitly required |

---

## 5. Recommended Staged Path

### Phase 0: Docs-only Audit (This PR)
- Document current baseline.
- Identify no clear need for Jest migration.
- Define guardrails.

### Phase 1: Keep Current Setup (Recommended)
- Continue with Node native test runner for contract tests.
- Keep Playwright for browser smoke.
- Maintain separate test categories:
  - `tests/contracts/` — fast Node tests (`npm test`)
  - `tests/smoke/` — static smoke (`npm test`)
  - `scripts/test:e2e:*` — browser smoke (Playwright)
- No Jest/Vitest introduction.

### Phase 2: Optional Framework POC (Only if blocker emerges)
If a concrete need arises (e.g., need for snapshot testing, complex mocking, coverage reporting):
1. Create a **separate** Jest/Vitest POC branch.
2. Run Jest **alongside** existing tests — do not replace.
3. Evaluate cost/benefit on CI runtime and maintenance.
4. CTO approval required before any dependency addition.

### Phase 3: Test Organization Cleanup (Framework-agnostic)
- Clarify test naming conventions.
- Add missing test coverage documentation.
- Improve `scripts/pre-deploy.js` modularization.
- These improvements do not require a new test runner.

---

## 6. Guardrails (Enforced Until Further Notice)

- ❌ **No Jest dependency** in this PR or any follow-up without explicit CTO approval.
- ❌ **No package.json/package-lock.json changes** related to test runner.
- ❌ **No test command changes** (`npm test` remains Node native).
- ❌ **No CI workflow changes** (keep `npm test` as-is).
- ❌ **No broad test migration** — do not rewrite existing contract tests to Jest.
- ❌ **No mixing** of browser E2E into unit test runner.
- ❌ **No PR #7/prototype/reference/demo/variant changes** in this audit or follow-ups.
- ✅ Existing Node native test runner is the **source of truth** for contract tests.
- ✅ Playwright remains responsible for browser smoke.

---

## 7. Follow-up PR Split (If/When Needed)

| PR | Scope | Approval |
|----|-------|----------|
| **PR A** | Current CI/test command coverage documentation | ✅ Allowed (docs-only) |
| **PR B** | Contract test naming/organization cleanup | ✅ Allowed (no framework change) |
| **PR C** | Optional Jest/Vitest POC (separate directory, parallel run) | ⚠️ Requires CTO approval |
| **PR D** | Browser smoke separation clarification | ✅ Allowed (docs-only) |

**Never** migrate all tests in one PR. Any framework change must be incremental and additive.

---

## 8. Verification Checklist

- [ ] `git diff --check` passes
- [ ] Changed files limited to `docs/engineering/TEST_RUNNER_FRAMEWORK_STRATEGY_AUDIT.md`
- [ ] No package.json/package-lock.json modifications
- [ ] No .github/workflows/ changes
- [ ] No tests/** changes
- [ ] No scripts/test command changes
- [ ] No close keywords for Issue #224

---

## 9. Related Documents

- `docs/engineering/engineering_index.md` — Engineering docs index
- `docs/engineering/API_CONTRACT.md` — API contract tests pattern
- `docs/ops/OPERATIONS.md` — CI/test operation policy
- `package.json` — current test scripts
- `.github/workflows/ci.yml` — current CI pipeline

---

## 10. Conclusion

**Current recommendation: Continue with Node native test runner.**

The existing setup is:
- Simple (no extra deps)
- Fast (native runner)
- Sufficient (static/contract/smoke coverage adequate)
- Separated (unit vs E2E clearly divided)

A migration to Jest would introduce cost (dependency weight, CI time, migration effort) without solving a clear pain point. Keep the lightweight approach until a concrete blocker emerges that Node's native runner cannot address.

---

**Note:** Issue #224 remains open. This audit covers the strategy question only. Implementation decisions (if any) are tracked separately.