# Release Smoke and Runtime Observability Audit

## 1. Exact Base SHA and Evidence Limits

- **Base SHA:** `235ec59b2a5a40e0cf0115ebe45b2c6e50abbcdc`
- **Evidence boundary:** Source reading only. No browser, Preview, Production, Cloudflare Dashboard, Wrangler, API call, DB connection, secret/environment inspection, or provider action.
- **Authority files read:** `.github/workflows/ci.yml`, `package.json`, `_redirects`, `_headers`, `scripts/pre-deploy.cjs`, `scripts/cloudflare-supplied-url-smoke.cjs`, `tests/ci-test-group-registry.json`, `tests/test-layer-classification.json`, `tests/smoke/routes.test.cjs`, `docs/ops/` governance documents, `docs/ops/OBSERVABILITY_RUNTIME_LOGGING_AUDIT.md`.
- **Related Issues:** #3714, #3673 (parent), #3699 (deployment incident), #3670 (CI reliability), #3425 (production parity).

---

## 2. Current Deployment Path Map

### 2.1 Source-to-Production Flow

```text
PR merge to main
→ GitHub push to main branch triggers CI (ci.yml)
→ CI runs: lint, build, test (smoke/route/contract/browser), verify (pre-deploy)
→ CI completes (success or failure recorded)
→ Cloudflare Pages auto-deploys from main branch
   (no CI workflow step triggers this; it is Cloudflare's automatic Git integration)
→ Cloudflare Pages build output is published to production alias
→ https://lovebud.pages.dev/ serves the latest successful deployment
```

- OBSERVED_SOURCE_FACT: The only CI workflow (`.github/workflows/ci.yml`) has **no deploy job** — no `wrangler`, no Cloudflare API token, no upload/deploy action.
- OBSERVED_SOURCE_FACT: No `wrangler.toml` or `wrangler.json` exists in the repository.
- OBSERVED_SOURCE_FACT: The `_redirects` file defines 301 canonicalizations from `.html`/`.html/` to extensionless `/pages/<name>` paths for 8 page routes.
- OBSERVED_SOURCE_FACT: The `_headers` file applies a global CSP and aggressive no-store/no-cache on `/pages/*`.

### 2.2 Deployment Attempt Evidence

- UNRESOLVED: No repository evidence confirms whether a `main` push produced a successful Cloudflare Pages deployment. No file in `.github/workflows/`, `scripts/`, or `tests/` calls the Cloudflare API or reads Cloudflare deployment status.
- UNRESOLVED: Deployment attempt status (success/failure) is observable only through the Cloudflare Dashboard or API, which is outside this audit's evidence boundary.
- UNRESOLVED: The `_redirects`/`_headers` changes and any non-CI build failure are invisible to repository CI.

### 2.3 Production Alias Evidence

- UNRESOLVED: The exact SHA currently serving as Production alias cannot be confirmed from repository evidence alone. No deployment manifest, deployment SHA annotation file, or deployment badge is maintained in-repo.

---

## 3. Current Source/CI/Deployment/Production Evidence Inventory

### 3.1 CI Evidence by Layer Classification

The `tests/test-layer-classification.json` registry classifies every test into one of five layers executed in CI:

| Layer | Count | Command | Scope |
|---|---|---|---|
| `SOURCE_STATIC` | (all static tests) | `npm test` (via `node --test` glob) | Source-only static contract tests. File existence, directory structure, string/regex assertions. |
| `EXECUTED_FAKE` | (fake/stub tests) | `npm test` (via `node --test` glob) | Fake/stub runtime contract tests. Production module source in `node:vm` with injected mock dependencies. No external system used. |
| `BROWSER_REAL_LOCAL` | 12 | `npm test` (via `node --test` glob) | Real local Playwright Chromium browser page rendering. CSS/JS/DOM/geometry assertions via local HTTP server. |
| `PROCESS_REAL_LOCAL` | 3 | `npm test` (via `node --test` glob) | Real local process contract tests. Production module in Node or Playwright without browser page rendering. |
| `DB_ENGINE` | 7 | `npm run test:db-engine:*` (7 separate CI jobs) | Disposable PostgreSQL 17.4 engine tests. Ephemeral CI service containers. Never Production. |

- OBSERVED_SOURCE_FACT: All five layers above execute in CI. The `BROWSER_REAL_LOCAL` and `PROCESS_REAL_LOCAL` layers use Playwright Chromium (`npx playwright install --with-deps chromium`) and **are executed by `npm test`** via the `node --test tests/{smoke,routes,contracts}/*.test.cjs` glob.
- OBSERVED_SOURCE_FACT: CI runs 8 parallel jobs: 1 `verify-static` (lint/build/test/verify — covers all four `npm test` layers) and 7 `db-engine-*` jobs.
- OBSERVED_SOURCE_FACT: All CI evidence is generated on `ubuntu-latest` with Node 20. No Windows or Node 22 matrix.

- OBSERVED_SOURCE_FACT: The `EXECUTED_FAKE` layer consumes `node:vm` fake/mock/stub dependencies — no real external system, DB, API, or network call. These are NOT the same as the Manual/Remote group.

### 3.2 Manual / Remote / Provider-Gated Scripts (NOT executed in CI)

The `tests/ci-test-group-registry.json` classifies these under `REMOTE_OR_PROVIDER_MANUAL` with `default_pr_execution_state: MANUAL`:

| Script | Command | Group |
|---|---|---|
| `scripts/cloudflare-supplied-url-smoke.cjs` | `npm run smoke:cloudflare` | REMOTE_OR_PROVIDER_MANUAL |
| `scripts/e2e-auth-guard-smoke.cjs` | `npm run test:e2e:*` | REMOTE_OR_PROVIDER_MANUAL |
| `scripts/e2e-editor-delete-smoke.cjs` | `npm run test:e2e:*` | REMOTE_OR_PROVIDER_MANUAL |
| `scripts/e2e-editor-save-smoke.cjs` | `npm run test:e2e:*` | REMOTE_OR_PROVIDER_MANUAL |
| `scripts/e2e-login-success-smoke.cjs` | `npm run test:e2e:*` | REMOTE_OR_PROVIDER_MANUAL |
| `scripts/e2e-login-timeout-smoke.cjs` | `npm run test:e2e:*` | REMOTE_OR_PROVIDER_MANUAL |
| `scripts/e2e-public-viewer-mobile-smoke.cjs` | `npm run test:e2e:*` | REMOTE_OR_PROVIDER_MANUAL |
| `scripts/e2e-search-detail-smoke.cjs` | `npm run test:e2e:*` | REMOTE_OR_PROVIDER_MANUAL |
| `scripts/e2e-ui-regression-smoke.cjs` | `npm run test:e2e:*` | REMOTE_OR_PROVIDER_MANUAL |
| `scripts/capture-screenshots.cjs` | `npm run test:screenshots` | REMOTE_OR_PROVIDER_MANUAL |
| `scripts/batch-test-runner.cjs` | `npm run test:e2e:*` | REMOTE_OR_PROVIDER_MANUAL |
| `scripts/verify-env.cjs` | `npm run verify:remote` | REMOTE_OR_PROVIDER_MANUAL |
| `scripts/ops-auth-credential-preflight.cjs` | — | REMOTE_OR_PROVIDER_MANUAL |
| `scripts/smoke-gate-a-moment-social-write.mjs` | — | REMOTE_OR_PROVIDER_MANUAL |
| `scripts/check-pr-guardrails.cjs` | — | REMOTE_OR_PROVIDER_MANUAL |

- OBSERVED_SOURCE_FACT: None of the above scripts execute in CI. The `ci.yml` workflow never calls `npm run test:e2e:*`, `npm run smoke:cloudflare`, `npm run test:screenshots`, or `npm run verify:remote`.
- OBSERVED_SOURCE_FACT: This is distinct from the 12 `BROWSER_REAL_LOCAL` Playwright contracts that **do** execute in CI via `npm test`.

### 3.3 Production Verification Evidence

- DOCUMENTED_OPERATING_RULE: `docs/ops/MERGE_FIRST_PRODUCTION_VERIFICATION_WORKFLOW.md` defines post-merge manual Production confirmation as the normal final check. Preview/fixed-slot remain optional.
- DOCUMENTED_OPERATING_RULE: Production verification scope is proportional to U0/U1/U2/U3 risk class.
- DOCUMENTED_OPERATING_RULE: U0 verification = exact copy confirmation. U1 = exact visual. U2 = affected states/layouts. U3 = route/action/auth/API/cache/storage/runtime.
- OBSERVED_SOURCE_FACT: No automated Production verification script exists in CI or as a post-merge hook. Verification is entirely manual per the merge-first workflow.

---

## 4. Route and Critical Static Asset Smoke Inventory

### 4.1 Defined Routes (from `_redirects`)

| Route | Target | File source |
|---|---|---|
| `/intro` | `/pages/intro` | `pages/intro.html` |
| `/login` | `/pages/login` | `pages/login.html` |
| `/search` | `/pages/search` | `pages/search.html` |
| `/detail` | `/pages/detail` | `pages/detail.html` |
| `/editor` | `/pages/editor` | `pages/editor.html` |
| `/my-trees` | `/pages/my-trees` | `pages/my-trees.html` |
| `/tree` | `/pages/tree` | `pages/tree.html` |
| `/settings` | `/pages/settings` | `pages/settings.html` |

### 4.2 Static Asset Smoke (from `tests/smoke/routes.test.cjs`)

- OBSERVED_SOURCE_FACT: `tests/smoke/routes.test.cjs` asserts:
  1. `functions/api/` directory exists with `trees.js`, `memories.js`, `[[path]].js`
  2. `package.json` has required scripts
  3. Core static pages exist: `index.html`, `pages/login.html`, `pages/search.html`, `pages/my-trees.html`

### 4.3 Cloudflare Supplied-URL Smoke Targets

- OBSERVED_SOURCE_FACT: `scripts/cloudflare-supplied-url-smoke.cjs` validates 3 targets against a deployed URL:
  - `/` (Home, no API dependency)
  - `/pages/intro.html` (Intro, no API dependency)
  - `/pages/search.html` (Search, API-dependent)
- OBSERVED_SOURCE_FACT: This script targets a deployed Cloudflare URL — distinct from the 12 `BROWSER_REAL_LOCAL` Playwright contracts that run against a local HTTP server in CI. The supplied-URL smoke has no automatic CI or post-merge execution.

### 4.4 Missing Route Smoke Coverage

- UNRESOLVED: No smoke coverage exists for `/pages/detail`, `/pages/editor`, `/pages/my-trees`, `/pages/settings`, `/pages/tree`, `/pages/login` in the supplied-URL script.
- UNRESOLVED: The `tests/smoke/routes.test.cjs` checks file existence only — no HTTP response, no DOM structure, no API health.

---

## 5. Public API Endpoints (Documented)

- OBSERVED_SOURCE_FACT: `docs/ops/DEPLOY_CHECKLIST.md` documents two public read API endpoints:
  - `GET /api/community/trees?view=summary&sort=latest&limit=3` — fixed-parameter browse summary. Candidate for bounded generic health smoke.
  - `GET /api/community/memories?treeId=<treeId>` — identifier-bearing preview hydrate. Requires a known `treeId` parameter; not a generic health endpoint.
- OBSERVED_SOURCE_FACT: `docs/ops/DEPLOYED_ENTRY_MAP.md` confirms the `/api/*` routing: Cloudflare Pages Functions → Modal, with `x-lovebud-upstream: modal` header and `server: cloudflare`.
- OBSERVED_SOURCE_FACT: `docs/ops/ENV_DEPENDENCY.md` documents that `MODAL_BASE_URL` controls the Modal routing and `LOVEBUD_UPSTREAM_ORIGIN` controls the Vercel fallback.

---

## 6. Current Logging and Error-Taxonomy Inventory

### 6.1 Error Classification Vocabulary

- DOCUMENTED_OPERATING_RULE: `docs/ops/MVP_AGENT_GOVERNANCE.md` defines 4 CI states: `CI_GREEN`, `CI_EXECUTED_FAILURE`, `CI_PENDING_EXECUTION`, `CI_UNAVAILABLE_INFRA`.
- DOCUMENTED_OPERATING_RULE: `docs/ops/CI_UNAVAILABLE_INFRA_MERGE_POLICY.md` defines the alternative-evidence path for infrastructure failures.
- OBSERVED_SOURCE_FACT: `tests/ci-test-group-registry.json` defines additional vocabulary: `BRANCH_ONLY_FAILURE`, `MAIN_BASELINE_FAILURE`, `PLATFORM_ONLY_FAILURE`, `NON_DETERMINISTIC_FAILURE`, `CI_EXECUTED_MAIN_REGRESSION`, `CI_EXECUTED_MAIN_FAILURE`, `CI_EXECUTED_BRANCH_FAILURE`.
- OBSERVED_SOURCE_FACT: `tests/test-layer-classification.json` classifies each test into: `SOURCE_STATIC`, `EXECUTED_FAKE`, `EXECUTED_REAL_LOCAL`, `EXTERNAL_INTEGRATION`, `PRODUCTION_SMOKE`, `DB_ENGINE_EXECUTION`.

### 6.2 Runtime Logging

- OBSERVED_SOURCE_FACT: `docs/ops/OBSERVABILITY_RUNTIME_LOGGING_AUDIT.md` (448 lines) exists as a completed planning/audit document. It inventories:
  - Cloudflare Pages Functions: HTTP request/response metadata, deployment status, build logs, function invocation logs. No structured request correlation across Modal boundary.
  - Modal runtime: Container logs available via Modal Dashboard. No structured log shipping.
  - Firebase Auth: Authentication event logs available in Firebase Console. No integration with application logging.
- UNRESOLVED: The observability audit proposes logging strategy but no implementation has been authorized or executed.
- UNRESOLVED: No centralized log aggregation, cross-boundary trace ID, or sanitized error taxonomy exists in Production.
- UNRESOLVED: Client-side (browser) errors are not captured or aggregated. There is no `window.onerror`, `unhandledrejection`, or structured console error reporting.

### 6.3 Sanitized Error Tokens

- OBSERVED_SOURCE_FACT: The existing error vocabulary (`CI_*`, test layer classifications) is CI-scoped only. No Production runtime error taxonomy exists.
- OBSERVED_SOURCE_FACT: `docs/ops/DEPLOY_CHECKLIST.md` documents manual `curl` commands for API health checks. No structured error code or classification is returned by these checks.

---

## 7. Privacy / Sanitization Boundary

- DOCUMENTED_OPERATING_RULE: No secret, credential, cookie, session token, private identifier, raw request body, user content, database URL, or provider payload may be collected or recorded in any evidence artifact.
- DOCUMENTED_OPERATING_RULE: `scripts/cloudflare-supplied-url-smoke.cjs` filters YouTube media URLs from error/blocker reporting to avoid exposing content-dependent failures.
- DOCUMENTED_OPERATING_RULE: `docs/ops/OBSERVABILITY_RUNTIME_LOGGING_AUDIT.md` explicitly recommends redaction-aware logging with no private payload capture.
- OBSERVED_SOURCE_FACT: `tests/contracts/gate-a-moment-social-write-smoke-runner-contract.test.cjs` asserts the smoke runner outputs `"secret/private exposure": "NONE"` in blocked state, contains no forbidden raw/private substrings, and reads all inputs from env-only.
- PROPOSED_NEXT_CHILD: Any runtime observability implementation must pass a contract test proving zero private payload exposure, matching the pattern established by the Gate A smoke runner contract.

---

## 8. Known Gaps and Failure Modes

### 8.1 #3699 — Automatic main-to-Production Deployment Failure

- DOCUMENTED_OPERATING_RULE: `#3699` documents that `main` can merge successfully while Production continues serving an older build. The operating rule states:
  1. Check Production once after merge.
  2. If current main is served, verify affected behavior.
  3. If Production is stale, record observation and stop.
  4. No manual deployment or Cloudflare mutation without owner explicit request.
- OBSERVED_SOURCE_FACT: The #3699 diagnosis scope is documented as read-only — determine whether (1) a deployment attempt occurred, (2) what non-secret failure category stopped activation, (3) what Git-to-Pages connection condition is missing, (4) whether production alias is pointing to an older deployment.
- OBSERVED_SOURCE_FACT: No mechanism exists to automatically detect a stale Production alias. There is no cron job, webhook listener, or periodic comparison of source SHA vs Production serving SHA.

### 8.2 Identified Gaps

| # | Gap | Impact | Source |
|---|---|---|---|
| 1 | No CI deploy job | Cloudflare Pages deployment is invisible to CI | `ci.yml` |
| 2 | No post-deploy smoke in CI | No automated route/API/DOM verification after merge | `ci.yml` |
| 3 | No deployment SHA annotation | Cannot correlate source commit to deployed revision | no deploy manifest |
| 4 | Playwright-based supplied-URL smoke (3 routes) not executed in CI | Deployed route/DOM/console errors unchecked after merge | `ci.yml`, registry |
| 5 | No Production alias stale detection | Stale deployment can persist undetected | #3699 |
| 6 | No cross-boundary trace ID | Production errors cannot be correlated across Cloudflare → Modal | Observability audit |
| 7 | No client-side error capture | Browser console errors are invisible without manual inspection | No `window.onerror` |
| 8 | No Production runtime error taxonomy | CI error classes do not extend to Production | error vocabulary scope |
| 9 | Supplied-URL smoke covers only 3 of 9 routes | Detail, Editor, My Trees, Settings, Tree, Login have no deployed-URL route smoke | `cloudflare-supplied-url-smoke.cjs` |
| 10 | No `wrangler.toml` | Pages-specific build configuration absent from version control | no wrangler file |

---

## 9. Exact Distinction: Technical Smoke vs Product/Visual Acceptance

- DOCUMENTED_OPERATING_RULE: `docs/ops/UI_SCREENSHOT_CTO_REVIEW_POLICY.md` establishes that functional verification and subjective visual judgment are separate activities. The executor reports `SCREENSHOT_CAPTURED`, `PAGE_LOADED`, `NO_FATAL_CONSOLE_ERRORS` — never `VISUAL_PASS`, `UI_APPROVED`, `BRAND_ALIGNED`.
- DOCUMENTED_OPERATING_RULE: `docs/ops/MERGE_FIRST_PRODUCTION_VERIFICATION_WORKFLOW.md` separates technical smoke (route response, API status, static asset serving) from product acceptance (visual correctness, brand alignment, UX completeness).
- OBSERVED_SOURCE_FACT: The supplied-URL smoke script (`cloudflare-supplied-url-smoke.cjs`) checks technical signals only: HTTP status, `<body>` DOM presence, horizontal overflow, console errors, network failures. It never checks visual layout, content accuracy, or brand appearance.

```text
Technical smoke = HTTP 200, body rendered, zero fatal console errors,
                  zero network failures, no horizontal overflow,
                  API returns expected status, no 404s for critical assets

Product/Visual acceptance = correct layout, brand colors, typography,
                            animation quality, content completeness,
                            responsive behavior, accessibility
```

---

## 10. Prioritized Next-Child Plan (#3673 Steps 2–6)

Based on the audit findings, the following order is recommended for #3673 children:

### Step 2 — Release-SHA Annotation and Post-Deploy Route/Static/API Smoke Contract

**Priority:** Highest
**Rationale:** Without release SHA annotation, no post-deploy evidence can be correlated to a source commit. Without a bounded route/static/API smoke contract, post-deploy verification is ad-hoc.
**Stop condition:** A repository document and contract test pair that (a) annotates each `main` merge with a deploy-ready SHA marker, (b) defines the exact set of routes and static assets to smoke, (c) defines the expected HTTP status and minimal DOM signals per route, (d) preserves privacy by never specifying private IDs, tokens, or credentials.

### Step 3 — Sanitized Runtime Error and Latency Taxonomy

**Priority:** High
**Rationale:** No Production error taxonomy exists. The CI-scoped vocabulary (`CI_*`, `BRANCH_ONLY_FAILURE`, etc.) does not extend to Production.
**Stop condition:** A taxonomy document defining sanitized error codes, latency buckets, and severity levels for route/API/runtime failures. No runtime instrumentation is authorized — taxonomy only.

### Step 4 — Critical User-Journey Success-State Instrumentation

**Priority:** Medium
**Rationale:** Login, save, and load journey success states are currently unobservable at Production without manual browser testing.
**Stop condition:** A design document defining measurable success/failure signals for 3–5 critical journeys (home load, browse load, tree detail load, login, editor load). No implementation authorized.

### Step 5 — Release Health Thresholds and Forward-Fix/Rollback Triggers

**Priority:** Medium
**Rationale:** No quantitative thresholds exist for route error rate, API latency, or static asset availability.
**Stop condition:** A policy document defining per-route/API health thresholds, stale-deployment detection criteria, and escalation path. No implementation.

### Step 6 — Operator-Facing Summary/Reporting

**Priority:** Lower
**Rationale:** Prerequisite on Steps 2–5 providing the data sources.
**Stop condition:** A document or script design that aggregates deployment SHA, smoke results, error taxonomy, and health thresholds into a single operator-facing summary.

---

## 11. Recommended First Implementation Child

### Child: Post-merge Release-SHA Stamping and Bounded Route Smoke Contract

This is the smallest self-contained implementation that begins closing the observability gap. It does not touch Cloudflare, Dashboard, Wrangler, or Production configuration.

**Scope:**
1. Define a repository document (`docs/ops/RELEASE_SHA_AND_SMOKE_CONTRACT.md`) that:
   - Specifies how each `main` merge is annotated with its deploy SHA.
   - Lists exact route/static-asset smoke targets and expected signals.
   - Prescribes the minimum smoke evidence record format.
2. Define a contract test that validates the document against repository content.

**Exact stop conditions:**
- Document is reviewed and merged.
- Contract test passes on `main`.
- No Cloudflare, Wrangler, Preview, Production, API, DB, or secret action occurs.
- No existing file is modified (only new files created).
- #3699 is referenced but not closed.

- PROPOSED_NEXT_CHILD: `docs/ops/RELEASE_SHA_AND_SMOKE_CONTRACT.md` with exact stop conditions as above. Separate Issue required.

---

## 12. Unsupported Claims and Unresolved Provider Boundaries

### Unsupported Claims

| Claim | Reason |
|---|---|
| "Production is serving the latest main" | No repository evidence can confirm this. Cloudflare Pages deployment is external to CI. No SHA comparison mechanism exists. |
| "All routes serve HTTP 200" | Only Home (`/`), Intro (`/pages/intro.html`), and Search (`/pages/search.html`) have supplied-URL Playwright smoke that checks HTTP status. The supplied-URL smoke is not executed in CI. The 12 local Playwright browser contracts (executed in CI) test different DOM/geometry assertions against a local server. |
| "API endpoints are healthy" | No CI job or post-deploy hook calls any `/api/*` endpoint. The `DEPLOY_CHECKLIST.md` curl commands are manual and optional. |
| "Browser console has no errors" | No `window.onerror` or `unhandledrejection` handler exists. The supplied-URL Playwright smoke checks console errors only for the 3 routes it visits, and is not run in CI. The 12 local Playwright browser contracts check console errors in a local server context only. |
| "Deployment parity between source and production" | No deploy manifest or SHA annotation exists in the repository. Cloudflare Dashboard state is invisible to this audit. |

### Unresolved Provider Boundaries

1. UNRESOLVED: Cloudflare Pages build status, deployment log, and production alias are **opaquely managed through the Cloudflare Dashboard**. The repository has no visibility into whether a deployment succeeded, failed, or is still queued after a `main` push.
2. UNRESOLVED: Modal runtime logs are available only through the Modal Dashboard. There is no log shipping, structured correlation, or cross-boundary trace ID connecting Cloudflare Pages requests to Modal function invocations.
3. UNRESOLVED: Firebase Auth event logging is available only through the Firebase Console. There is no integration between auth events and application-level error/health signals.
4. UNRESOLVED: Neon database connection health is not observable from the repository. No repository script or CI job verifies database connectivity or schema consistency against Production.
5. UNRESOLVED: The `LOVEBUD_UPSTREAM_ORIGIN` default (`https://lovebud.vercel.app`) points to a deprecated environment whose runtime behavior is not actively monitored.

*Refs #3714*
*Refs #3673 — Keep OPEN*
*Refs #3699 — Keep OPEN*
*Refs #3670 — Keep OPEN*
*Refs #3425 — Keep OPEN*
*Refs #1882 — Keep OPEN*