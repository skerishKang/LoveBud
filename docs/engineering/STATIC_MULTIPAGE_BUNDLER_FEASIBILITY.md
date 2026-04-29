# Static Multipage Bundler Feasibility Audit

> **Docs-only. Feasibility audit only.**
> This document evaluates optional bundler adoption (Vite, Rollup) against LoveBud's current static multipage Cloudflare Pages runtime.
> No build tool is installed, no package is changed, no script type is converted, and no runtime behavior is altered by this document.
> Any implementation requires separate CTO approval and production-equivalent validation.

---

## 1. Current Runtime / Build Baseline

### Hosting and Routing

| Layer | Current state |
|-------|---------------|
| **Static hosting** | Cloudflare Pages (lovebud.pages.dev) |
| **API router** | Cloudflare Pages Functions — `functions/api/[[path]].js` |
| **API contract** | same-origin `/api/*` from browser |
| **Compute backend** | Modal upstream (`modal_compute/`) |
| **Legacy/fallback** | Netlify Functions (not active production) |

### Build / Script Model

- **No bundler.** The project is a **static multipage app** with zero build-time transformation.
- **Runtime contract:** ordered `<script src="...">` tags in each `pages/*.html` file define load order and global namespace resolution.
- **Global namespace pattern:** modules expose APIs as `window.*` globals (e.g., `window.LoveBudAuth`, `window.LoveBudSearch`). Scripts depend on this order.
- **Firebase SDK/config:** loaded via CDN `<script>` tags with explicit ordering constraints. The config initialisation script must execute after the Firebase SDK loads and before any page-level consumer.
- **i18n, shared-header, auth, page-shell** scripts each depend on prior scripts in the load order. This contract is implicit in `<script>` tag sequence.

### Why Bundler Adoption Is Non-Trivial

A bundler (Vite, Rollup) transforms scripts from ordered globals into module graphs. On this project:

1. Any `type="module"` conversion breaks the `window.*` global contract unless all consumers are updated simultaneously.
2. Cloudflare Pages deployment requires a predictable output directory (`dist/` or the repo root). Introducing a build step changes this contract.
3. Each `pages/*.html` file is an independent HTML entrypoint. Vite multipage mode or Rollup must be explicitly configured for this topology.
4. Firebase SDK cannot be bundled without version-pinning and compat-layer review.
5. Rollback from a bundler requires reverting both build config and all modified HTML files.

---

## 2. Bundler Options to Evaluate

| Option | Description | Risk | Benefit |
|--------|-------------|------|---------|
| **No bundler — keep current script order** | Status quo. Ordered `<script src>` tags. No build step. | None | Zero migration risk. Baseline reference. |
| **Vite multipage app** | `vite.config.js` with `build.rollupOptions.input` mapping each `pages/*.html`. Output to `dist/`. | High — all HTML entrypoints, script order, asset paths, and Cloudflare output dir must change together. | Tree-shaking, HMR in dev, modern asset hashing. |
| **Rollup targeted bundles** | Bundle only specific helper modules (e.g., shared utilities) without touching page HTML. | Medium — requires creating module wrappers; `window.*` contract must be maintained as output. | Smaller targeted bundles for helpers; does not solve page-level script order. |
| **Partial helper bundling only** | Bundle one low-risk non-auth, non-Firebase helper into a single IIFE. All page HTML and auth/i18n scripts unchanged. | Low-Medium — narrow surface area; rollback is one file revert. | Pilot bundler feasibility on an isolated non-critical module. |
| **Defer bundler until module contracts are stable** | Wait until all `window.*` contracts are documented and contract-tested before evaluating a build tool. | None | Reduces migration risk; audit docs (this and related PRs) are a prerequisite. |

**Current recommendation:** Defer bundler until module contracts are stable and contract tests cover the full script-order dependency graph. Partial helper bundling pilot is the lowest-risk first step if exploration is approved.

---

## 3. Required Feasibility Questions

All questions below must be answered with production-equivalent evidence before any bundler implementation proceeds.

### 3.1 Output Directory and Cloudflare Pages Deployment Impact

- What is the current Cloudflare Pages build configuration (build command, output directory)?
- Does the current deploy use repo root as the publish directory (no build command)?
- If a `dist/` output directory is introduced, what Cloudflare Pages settings must change?
- Will existing preview URLs and production DNS be affected?
- Is there a staging/preview slot available to validate before production cutover?

### 3.2 Every `pages/*.html` Entrypoint Strategy

- How many `pages/*.html` files exist and which share which scripts?
- Does Vite multipage `rollupOptions.input` need to enumerate every HTML file?
- How are page-specific scripts (e.g., editor-only modules) handled vs. shared header/auth scripts?
- Can partial bundling (bundle helpers only, leave HTML untouched) meet the goal?

### 3.3 Static Asset Path Behavior

- Are any image, font, or CSS asset paths hardcoded in HTML or JS?
- Will Vite's asset hashing (`asset.[hash].js`) break any `<script src="...">` references that are dynamically constructed in JS?
- How does `_redirects` interact with a `dist/` output structure?

### 3.4 Firebase SDK / Config Loading Strategy

- Firebase is loaded via CDN `<script>` tag. Can it be bundled, or must it remain a CDN load?
- If Firebase remains CDN-loaded, does Vite treat it as an external? Is the compat layer intact?
- What is the exact initialisation order dependency between `firebase-app`, `firebase-auth`, `firebase-firestore`, and the project's own config script?
- Has any Firebase version upgrade occurred since initial setup that changes the CDN URL or compat requirements?

### 3.5 i18n / Shared-Header / Auth / Page-Shell Script Order Equivalents

- Which scripts must load before `window.LoveBudAuth` is defined?
- Which scripts must load before i18n strings are available to page components?
- Does shared-header assume `window.currentUser` or equivalent globals at parse time or after `DOMContentLoaded`?
- How are these ordering constraints currently enforced (purely by `<script>` tag sequence)?
- What test or assertion currently validates this order? (See PR B follow-up.)

### 3.6 Rollback Plan

- If a bundler pilot introduces a regression, what is the exact revert procedure?
- Is the revert a single git revert commit, or does it require Cloudflare Pages config revert as well?
- How long does a Cloudflare Pages rollback take to propagate?
- Is there a feature flag or traffic split mechanism available for gradual rollout?

### 3.7 Source Map / Debugging Approach

- Will source maps be generated and uploaded for production error tracking?
- Are there any CSP (Content Security Policy) headers in `_headers` or Cloudflare config that block inline source map comments?
- How will production debugging change compared to current unminified script debugging?

---

## 4. Guardrails

The following actions are **prohibited** until all feasibility questions are resolved and CTO approval is granted:

- No Vite or Rollup package install (`package.json` / `package-lock.json` must not change)
- No `type="module"` conversion on any browser-facing script
- No modification of `<script src>` order in any `pages/*.html` file
- No Cloudflare Pages routing or output directory change
- No Modal or Neon backend change
- No Firebase SDK loading change
- No modification of PR #7, prototype, reference, demo, or variant folders
- No closing of Issue #225 from this PR (this is a feasibility audit, not implementation)

---

## 5. Verification Matrix Before Any Implementation

All smoke tests below must pass in a Cloudflare Pages PR preview or fixed test slot before any bundler change is merged to production.

| Page / Flow | Test type | Pass criteria |
|-------------|-----------|---------------|
| Home / Intro | Static smoke | Page renders, no fatal console errors |
| Search — Browse data load | Smoke | Browse route returns data from Modal via `/api/*` |
| Detail — Public tree | Smoke | Detail page loads without auth, tree data visible |
| Login — Auth flow | Auth smoke | Firebase Auth login flow completes, session established |
| My-Trees — Auth-pending | Auth-pending smoke | Redirects unauthenticated users; loads for authenticated |
| Editor — Protected page | Protected-page smoke | Editor loads only for authenticated owner; auth guard fires |
| Settings — Auth / return | Auth smoke | Settings page loads with correct user state; return URL preserved |
| Console errors | Global | Zero fatal console errors on all above pages |
| Cloudflare preview | Deploy | Cloudflare PR preview URL resolves and all above pass |

---

## 6. Follow-up PR Split

| PR | Scope | Prerequisite |
|----|-------|--------------|
| **This PR (PR A)** | Bundler feasibility audit doc | None — docs-only |
| **PR B** | Current script-order contract test expansion — add assertions for `window.*` global availability order | This PR |
| **PR C** | Build-tool proof-of-concept branch — Vite multipage config on a throwaway branch, no merge | CTO approval after PR B |
| **PR D** | One low-risk public page bundle pilot — partial helper IIFE only, no auth/Firebase scripts | CTO approval + PR C findings |
| **PR E** | Rollback and deployment documentation — Cloudflare Pages config change runbook | Before any PR D deploy |

> **No PR C or later may proceed without explicit CTO approval.**
> PR B (contract test expansion) is a safe docs/test-only follow-up after this PR.

---

*Last updated: 2026-04-29*
*Scope: docs-only, feasibility audit, no build/runtime/package changes*
*Related: Refs #225*
