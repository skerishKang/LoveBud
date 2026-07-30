# Release-SHA Public Exposure Decision

> **Status:** decision document — no implementation, no code/test/workflow/package changes
> **Authority labels:** `OBSERVED_CURRENT_FACT`, `PROPOSED_FUTURE_CONTRACT`, `UNRESOLVED`, `NOT_AUTHORIZED`
> **Parent:** #3673 — Keep OPEN
> **Completed groundwork:** #3734 / PR #3738 — `docs/ops/RELEASE_SHA_BOUNDED_SMOKE_CONTRACT.md`; #3725 / PR #3726 — `docs/ops/RUNTIME_HEALTH_ERROR_LATENCY_TAXONOMY.md`
> **Related:** #3734 — completed; #3699 — Keep OPEN; #3425 — Keep OPEN; #1882 — Keep OPEN
> **Base SHA:** `ff5dc6a76b9909301a27245b91ef8a194f88b277`

This document decides whether and how LoveBud may intentionally expose the currently serving source SHA through a bounded public mechanism that supports release correlation without revealing provider deployment IDs, environment data, build metadata, secrets, or mutable operator state.

No implementation, code change, test, workflow, or package change is authorized or performed by this document.

---

## 1. Purpose and Scope

### 1.1 Goal

Determine the minimal public surface for exposing the serving source SHA so that release correlation (expected `main` SHA vs observed serving SHA) can be performed without violating privacy, security, or governance boundaries.

### 1.2 Authority labels

| Label | Meaning |
|---|---|
| `OBSERVED_CURRENT_FACT` | Verified from repository source at the base SHA. No runtime or provider observation. |
| `PROPOSED_FUTURE_CONTRACT` | Defined here as a candidate. Not implemented. Requires a separate child Issue and owner approval before any code change. |
| `UNRESOLVED` | Cannot be determined from repository evidence alone. Requires provider dashboard, Production observation, or separate investigation. |
| `NOT_AUTHORIZED` | Explicitly outside the scope of this document and any currently approved child. |

### 1.3 Recommendation labels

Each model below is classified as one of:

- `RECOMMENDED` — safe, minimal, testable, and within governance boundaries. A future implementation child may proceed with owner approval.
- `DEFERRED` — viable in principle but requires broader blast radius, additional approval, or a prerequisite child. Not blocked, but not prioritized.
- `NOT_AUTHORIZED` — explicitly forbidden by hard boundaries or governance rules.

---

## 2. Source Evidence Inspected

`OBSERVED_CURRENT_FACT` — all files read from repository source at base SHA `ff5dc6a76b9909301a27245b91ef8a194f88b277`:

| Path | Role |
|---|---|
| `docs/ops/RELEASE_SHA_BOUNDED_SMOKE_CONTRACT.md` | Defines bounded smoke contract, release correlation fields, sanitized artifact schema |
| `docs/ops/RUNTIME_HEALTH_ERROR_LATENCY_TAXONOMY.md` | Defines runtime domains, error-code grammar, privacy/redaction rules |
| `docs/operations/RELEASE_SMOKE_RUNTIME_OBSERVABILITY_AUDIT.md` | Completed operations audit (#3714 / PR #3719) |
| `docs/ops/MERGE_FIRST_PRODUCTION_VERIFICATION_WORKFLOW.md` | Post-merge Production verification workflow |
| `_headers` | Global CSP and no-store on `/pages/*` |
| `_redirects` | 301 canonicalizations from `.html`/`.html/` to extensionless `/pages/<name>` |
| `.github/workflows/ci.yml` | CI workflow — no deploy job, no Cloudflare API, no wrangler |
| `package.json` | Scripts: `npm test` runs static/contract/browser tests; `npm run build` runs `scripts/build-static.js`; `npm run smoke:cloudflare` runs supplied-URL smoke (not in CI) |
| `scripts/cloudflare-supplied-url-smoke.cjs` | Playwright smoke for 3 routes against supplied URL; not in CI |
| `functions/api/[[path]].js` | Cloudflare Pages Functions catch-all proxy to Modal; returns bounded headers |

### 2.1 Current response headers from `functions/api/[[path]].js`

`OBSERVED_CURRENT_FACT`:

```text
x-lovebud-upstream: modal | cloudflare
x-lovebud-route-status: payload-too-large | unhandled | method-not-allowed | missing-authorization | modal-timeout
x-lovebud-degraded: modal-unavailable
x-lovebud-request-id: req-<uuid>  (correlation metadata, transient only)
```

These headers are already part of the response contract. No `x-lovebud-release-sha` header exists.

### 2.2 Current deployment path

`OBSERVED_CURRENT_FACT` (from `docs/ops/DEPLOY_CHECKLIST.md`, `docs/operations/RELEASE_SMOKE_RUNTIME_OBSERVABILITY_AUDIT.md` §2.1):

```text
PR merge to main
→ CI (ci.yml): lint, build, test, verify — no deploy job
→ Cloudflare Pages auto-deploys from main branch (Git integration)
→ https://lovebud.pages.dev/ serves latest successful deployment
```

- No `wrangler.toml` or `wrangler.json` in repository.
- No CI workflow step triggers deployment or reads Cloudflare deployment status.
- No deployment SHA annotation file or deploy manifest exists in repository.

### 2.3 Current SHA exposure state

`OBSERVED_CURRENT_FACT` (from `docs/ops/RELEASE_SHA_BOUNDED_SMOKE_CONTRACT.md` §1.3, `docs/ops/RUNTIME_HEALTH_ERROR_LATENCY_TAXONOMY.md` §2.1 and §2.10):

```text
observed_release_sha:
UNKNOWN | NOT_EXPOSED

release_match_state:
NOT_EXPOSED

automatic stale-release detection:
not implemented
```

No serving-SHA exposure mechanism is defined in current repository source, response contracts, or operating evidence.

---

## 3. Hard Boundaries

The following are explicitly forbidden. Any model that requires or depends on any of these is `NOT_AUTHORIZED`.

```text
Cloudflare deployment ID is not source SHA
no provider API/dashboard dependency
no environment dump
no branch name, actor, email, timestamp, build URL, account/project ID
no CI commit-back (no SHA file committed to repository)
no mutable runtime write
no automatic deployment or rollback
```

### 3.1 Security boundary

The only value permitted in any public exposure mechanism is the Git source SHA (40-character hex) and a bounded `contract_version` string. No:

- Cloudflare deployment ID (UUID format, not SHA)
- build log content
- environment variable values
- database URLs
- provider dashboard state
- timestamps (exact or bucketed)
- branch names, actor names, emails
- account/project IDs
- request IDs (already transient-only per `x-lovebud-request-id` policy)

---

## 4. Model Comparison Matrix

### 4.1 Summary

| Model | Authority | Recommendation | Build-time injection | Cache behavior | Route coverage | Privacy/security | Staleness failure | Testability | Rollback | Stop condition |
|---|---|---|---|---|---|---|---|---|---|---|
| public immutable text asset | `OBSERVED_CURRENT_FACT` / `PROPOSED_FUTURE_CONTRACT` | `RECOMMENDED` | Build script writes SHA to static file | CDN-cached; cache-bust or short TTL | Single file, all routes can reference | Low — only SHA | Build script not re-run; stale file served | CI file-existence + SHA format check | Remove build script and generated file | File removed or build script changed |
| public JSON manifest | `OBSERVED_CURRENT_FACT` / `PROPOSED_FUTURE_CONTRACT` | `RECOMMENDED` | Build script writes JSON with `release_sha` + `contract_version` | CDN-cached; cache-bust or short TTL | Single endpoint | Low — only SHA + version | Build script not re-run; stale manifest served | CI JSON schema + SHA format check | Remove build script and generated file | File removed or build script changed |
| bounded response header | `OBSERVED_CURRENT_FACT` / `PROPOSED_FUTURE_CONTRACT` | `RECOMMENDED` | `_headers` file or Function sets header | Per-response; not cached separately | All routes (global `_headers`) or specific | Low — only SHA in header | `_headers` not updated on deploy | CI curl header check | Remove header from `_headers` | Header removed from `_headers` |
| HTML meta tag | `OBSERVED_CURRENT_FACT` / `PROPOSED_FUTURE_CONTRACT` | `DEFERRED` | Build script injects meta tag into HTML templates | HTML is no-store per `_headers`; always fresh | All HTML pages | Low — only SHA in meta | HTML not regenerated | CI DOM meta-tag assertion | Remove meta tag from templates | Meta tag removed from templates |
| runtime API endpoint | `OBSERVED_CURRENT_FACT` / `PROPOSED_FUTURE_CONTRACT` | `DEFERRED` | New Function serves SHA at `/api/release` | Cacheable or not; provider-managed | Single endpoint | Medium — API endpoint risk | Function not updated | CI curl endpoint check | Remove Function or route | Function/route removed |
| provider-native deployment metadata | `NOT_AUTHORIZED` | `NOT_AUTHORIZED` | Provider-managed (Cloudflare deployment ID) | Provider-managed | All routes | High — exposes deployment ID, not SHA | Provider-managed | Requires provider API access | Provider-managed | Provider-managed |

### 4.2 Detailed per-model analysis

#### 4.2.1 public immutable text asset

`OBSERVED_CURRENT_FACT`: No such file exists in the repository. No build script generates a SHA file.

`PROPOSED_FUTURE_CONTRACT`:

- **source of truth:** `main` HEAD SHA at build time. The build script reads `git rev-parse HEAD` (or the CI-provided `GITHUB_SHA`) and writes the 40-character SHA to a static file (e.g., `/release-sha.txt` or `/.well-known/release-sha`).
- **build-time injection mechanism:** `scripts/build-static.js` (or a new `scripts/build-release-sha.cjs`) writes the file during `npm run build`. The file is a static asset published by Cloudflare Pages. No CI commit-back — the file is generated at build time and published as a build artifact, never committed to the repository.
- **cache behavior:** Cloudflare Pages CDN caches static assets. The file should use a short `Cache-Control: max-age=60` or a cache-busting query string (`?v=<sha>`) to ensure freshness. The `_headers` file can be extended to set cache policy for this path.
- **route coverage:** Single file. Any route or script can fetch it via HTTP. All 9 canonical routes can reference it.
- **security/privacy exposure:** Minimal. Only the 40-character Git SHA is exposed. No deployment ID, environment data, build metadata, or secrets. The SHA is already public in the Git repository.
- **staleness failure mode:** If the build script does not re-run on a new deploy, the file may be stale. Since Cloudflare Pages auto-deploys from `main` and the build script runs on every deploy, the file should always match the serving SHA. Staleness is detectable by comparing the file content to `main` HEAD.
- **local/CI testability:** `tests/smoke/routes.test.cjs` can assert file existence and SHA format (40-char hex). A contract test can validate the file content matches `git rev-parse HEAD` at build time.
- **rollback:** Remove the build script step that generates the file. Remove any `_headers` entry for the path. No existing file is modified — only new files are added.
- **stop condition:** The file is removed from the build output, or the build script step is removed.
- **authority label:** `OBSERVED_CURRENT_FACT` (does not exist), `PROPOSED_FUTURE_CONTRACT` (if implemented).

#### 4.2.2 public JSON manifest

`OBSERVED_CURRENT_FACT`: No such file exists in the repository.

`PROPOSED_FUTURE_CONTRACT`:

- **source of truth:** `main` HEAD SHA at build time.
- **build-time injection mechanism:** Build script writes a JSON file (e.g., `/.well-known/release.json`) with the minimal shape: `{"release_sha": "<40-char SHA>", "contract_version": "1"}`. The `contract_version` field allows future schema evolution.
- **cache behavior:** CDN-cached. Should use `Cache-Control: max-age=60` or cache-busting. The `_headers` file can set cache policy for `/.well-known/release.json`.
- **route coverage:** Single endpoint. All routes and scripts can fetch it.
- **security/privacy exposure:** Minimal. Only `release_sha` and `contract_version` are exposed. No other metadata.
- **staleness failure mode:** Same as text asset. Build script runs on every deploy, so the manifest should always match.
- **local/CI testability:** Contract test validates JSON schema, SHA format, and that only `release_sha` and `contract_version` fields are present. `tests/contracts/` pattern can be used.
- **rollback:** Remove build script step and generated file.
- **stop condition:** File removed or build script step removed.
- **authority label:** `OBSERVED_CURRENT_FACT` (does not exist), `PROPOSED_FUTURE_CONTRACT` (if implemented).

#### 4.2.3 bounded response header

`OBSERVED_CURRENT_FACT`: The codebase already uses `x-lovebud-*` headers (`x-lovebud-upstream`, `x-lovebud-route-status`, `x-lovebud-degraded`, `x-lovebud-request-id`) in `functions/api/[[path]].js`. No `x-lovebud-release-sha` header exists. The `_headers` file sets global headers but does not include a release SHA.

`PROPOSED_FUTURE_CONTRACT`:

- **source of truth:** `main` HEAD SHA at build time.
- **build-time injection mechanism:** Two options:
  1. `_headers` file: Add `x-lovebud-release-sha: <SHA>` to the global `/*` block. This requires the `_headers` file to be regenerated at build time with the current SHA.
  2. Cloudflare Pages Function: A new or existing Function sets the header on all responses.
  Option 1 is simpler but requires modifying `_headers` (existing file). Option 2 requires new Function code.
- **cache behavior:** Headers are per-response, not cached separately. The HTML pages are already `no-store` per `_headers`. Static assets carry their own cache-busting query strings.
- **route coverage:** If using `_headers` global `/*` block, all routes. If using a Function, only routes handled by that Function.
- **security/privacy exposure:** Minimal. Only the 40-character SHA is in the header. No deployment ID or environment data.
- **staleness failure mode:** If `_headers` is not regenerated on deploy, the header is stale. Since `_headers` is committed to the repository and deployed with the build, it should match. However, if the SHA is injected at build time into `_headers`, the file must be regenerated on every deploy.
- **local/CI testability:** `curl -sI <url>` can check the header. A contract test can validate the header format.
- **rollback:** Remove the header from `_headers` or remove the Function code.
- **stop condition:** Header removed from `_headers` or Function removed.
- **authority label:** `OBSERVED_CURRENT_FACT` (does not exist), `PROPOSED_FUTURE_CONTRACT` (if implemented).

#### 4.2.4 HTML meta tag

`OBSERVED_CURRENT_FACT`: No `<meta name="lovebud-release-sha">` tag exists in any HTML template. The HTML pages are built from `pages/*.html` source files.

`PROPOSED_FUTURE_CONTRACT`:

- **source of truth:** `main` HEAD SHA at build time.
- **build-time injection mechanism:** Build script injects `<meta name="lovebud-release-sha" content="<SHA>">` into all HTML templates during `npm run build`. This requires modifying the build script and all HTML templates.
- **cache behavior:** HTML pages are `no-store` per `_headers` (`Cache-Control: no-store, no-cache, must-revalidate`). Always fresh from CDN.
- **route coverage:** All HTML pages (9 canonical routes).
- **security/privacy exposure:** Minimal. Only the SHA in the meta tag content.
- **staleness failure mode:** If HTML is not regenerated on deploy, stale. Since HTML is built from source on every deploy, it should match.
- **local/CI testability:** Playwright DOM assertion can check the meta tag content. `tests/contracts/` pattern can validate.
- **rollback:** Remove meta tag injection from build script and HTML templates.
- **stop condition:** Meta tag removed from templates or build script.
- **authority label:** `OBSERVED_CURRENT_FACT` (does not exist), `PROPOSED_FUTURE_CONTRACT` (if implemented).

#### 4.2.5 runtime API endpoint

`OBSERVED_CURRENT_FACT`: No `/api/release` or `/api/health` endpoint exists. The API surface is defined in `functions/api/[[path]].js`, `functions/api/trees.js`, `functions/api/memories.js`. No release-related endpoint.

`PROPOSED_FUTURE_CONTRACT`:

- **source of truth:** `main` HEAD SHA at build time.
- **build-time injection mechanism:** A new Cloudflare Pages Function (e.g., `functions/api/release.js`) serves the SHA as JSON. The SHA must be injected at build time — either as an environment variable or embedded in the Function code. Environment variables are set in the Cloudflare Pages dashboard, which is a provider dependency. Embedding in Function code requires build-time code generation.
- **cache behavior:** Cacheable or not. Could use `Cache-Control` headers. Provider-managed.
- **route coverage:** Single endpoint (`/api/release` or similar).
- **security/privacy exposure:** Medium. An API endpoint introduces additional attack surface. If the endpoint is not carefully scoped, it could expose more than intended. The response must be strictly limited to `release_sha` and `contract_version`.
- **staleness failure mode:** If the Function is not updated on deploy, stale. Since Functions are deployed with the build, it should match. However, if the SHA is injected via environment variable, the environment must be updated separately.
- **local/CI testability:** `curl` can check the endpoint. Contract test can validate JSON schema.
- **rollback:** Remove the Function file.
- **stop condition:** Function file removed.
- **authority label:** `OBSERVED_CURRENT_FACT` (does not exist), `PROPOSED_FUTURE_CONTRACT` (if implemented).

#### 4.2.6 provider-native deployment metadata

`NOT_AUTHORIZED`:

- **source of truth:** Provider-managed (Cloudflare deployment ID).
- **build-time injection mechanism:** Provider-managed. No repository source controls this.
- **cache behavior:** Provider-managed.
- **route coverage:** All routes (if exposed via provider configuration).
- **security/privacy exposure:** High. Cloudflare deployment ID is a UUID, not a source SHA. It exposes deployment timing, frequency, and provider-internal state. It does not prove which source commit is served.
- **staleness failure mode:** Provider-managed. Cannot be detected from repository evidence.
- **local/CI testability:** Requires provider API access. Not testable from repository source.
- **rollback:** Provider-managed.
- **stop condition:** Provider-managed.
- **authority label:** `NOT_AUTHORIZED`.

Hard boundary violation: "Cloudflare deployment ID is not source SHA." Provider-native deployment metadata uses the Cloudflare deployment ID, which is explicitly not the source SHA. It also requires provider API/dashboard access, which is forbidden.

---

## 5. Recommendations

### 5.1 Per-model recommendation

| Model | Recommendation | Rationale |
|---|---|---|
| public immutable text asset | `RECOMMENDED` | Simplest surface. Single static file. Low risk. CDN-cached. Easy to test. No provider dependency. |
| public JSON manifest | `RECOMMENDED` | Structured and extensible. Supports `contract_version` for future schema evolution. Low risk. CDN-cached. Easy to test. |
| bounded response header | `RECOMMENDED` | Already has precedent with `x-lovebud-*` headers. No extra HTTP request. Low overhead. Low risk. |
| HTML meta tag | `DEFERRED` | Requires modifying all HTML templates (9 files). Higher blast radius. No clear benefit over text asset or JSON manifest. HTML is already no-store, so no cache advantage. |
| runtime API endpoint | `DEFERRED` | Requires new Function code. Introduces API endpoint attack surface. Potential for accidental data exposure if not carefully scoped. Environment variable injection requires provider dashboard access. |
| provider-native deployment metadata | `NOT_AUTHORIZED` | Cloudflare deployment ID is not source SHA. Requires provider API/dashboard access. Exposes provider-internal state. |

### 5.2 Primary recommended model

The **public JSON manifest** is the primary recommended model. It provides:

- Structured, machine-readable format
- Support for `contract_version` field for future evolution
- Single endpoint, easy to fetch
- CDN-cached with controllable cache policy
- Minimal privacy/security exposure (only `release_sha` and `contract_version`)
- Testable in CI with JSON schema validation

### 5.3 Secondary recommended models

The **public immutable text asset** and **bounded response header** are also recommended as complementary or alternative surfaces:

- Text asset: simplest possible surface, useful for curl-based verification
- Response header: no extra HTTP request, automatically included on all responses

### 5.4 Minimal public shape

For any recommended model, the exact minimal public shape uses only:

```json
{
  "release_sha": "<40-character Git SHA>",
  "contract_version": "1"
}
```

- `release_sha` is the **full 40-character Git SHA**. No bounded alternative (e.g., short SHA) is justified. The full SHA is required for unambiguous release correlation. A short SHA (7–12 characters) introduces collision risk and cannot be reliably compared against `main` HEAD. The full SHA is already public in the Git repository and poses no additional privacy risk.
- `contract_version` is a bounded string (`"1"`) that allows future schema evolution without breaking existing consumers.

For the text asset model, the file contains only the 40-character SHA (no JSON wrapper).

For the response header model, the header value is the 40-character SHA:

```text
x-lovebud-release-sha: ff5dc6a76b9909301a27245b91ef8a194f88b277
```

---

## 6. Ordered Next Child

### Child: Implement public JSON manifest for release-SHA exposure

- **Scope:** Implement a public JSON manifest at `/.well-known/release.json` containing `release_sha` and `contract_version`, generated at build time from `main` HEAD SHA. This is the primary recommended model from §5.2.
- **Prerequisite:** This decision document merged. Owner approval recorded.
- **Exact candidate files (all new):**
  - `scripts/build-release-manifest.cjs` — build script that reads `main` HEAD SHA and writes `/.well-known/release.json` with the minimal shape from §5.4. Fails if SHA cannot be determined.
  - `tests/contracts/release-sha-manifest-contract.test.cjs` — contract test that validates JSON schema, SHA format (40-char hex), only `release_sha` and `contract_version` fields present, and that the file is generated during `npm run build`.
  - `docs/ops/RELEASE_SHA_MANIFEST_CONTRACT.md` — contract document defining the manifest shape, cache policy, and stop conditions.
  - `_headers` entry for `/.well-known/release.json` — `Cache-Control: max-age=60, stale-while-revalidate=30` (modifies existing `_headers` file; this is a separate implementation child, not this docs-only PR).
- **Tests:**
  - Contract test: JSON schema validation, SHA format, no extra fields, build-time generation.
  - Source-static test: file existence after `npm run build`.
  - No CI workflow modification required — tests run via existing `npm test` glob.
- **Failure handling:**
  - Build script exits non-zero if `git rev-parse HEAD` fails or returns non-40-char output.
  - Contract test fails if manifest is missing, malformed, or contains extra fields.
  - No runtime fallback — if the manifest is not generated, the build fails.
- **Rollback:**
  - Remove `scripts/build-release-manifest.cjs`.
  - Remove `tests/contracts/release-sha-manifest-contract.test.cjs`.
  - Remove `docs/ops/RELEASE_SHA_MANIFEST_CONTRACT.md`.
  - Remove `_headers` entry for `/.well-known/release.json`.
  - No existing file is destructively modified — only additions and a single `_headers` line removal.
- **Stop condition:**
  - Decision document reviewed and merged.
  - Implementation child Issue created with owner approval.
  - Contract test passes on `main`.
  - Manifest is served at `/.well-known/release.json` with correct `Cache-Control` and `content-type: application/json`.
  - No private payload exposure proven by contract test.
  - #3699 referenced but not closed.
- **Not-authorized boundary:**
  - No Cloudflare API call.
  - No Wrangler deploy.
  - No Production mutation.
  - No automatic stale-detection cron.
  - No CI workflow modification.
  - No SHA file committed to repository (build-time generation only).
  - No mutable runtime write.

---

## 7. Prohibitions

This document authorizes no implementation. The following remain prohibited:

```text
no runtime/script/test/workflow/package changes
no browser, Production, Preview, Cloudflare, API, DB, provider, or secrets access
no rebase/reset/amend/force push
no PR Ready/merge/parent closure
no CI commit-back (no SHA file committed to repository)
no mutable runtime write
no automatic deployment or rollback
no provider API/dashboard dependency
no environment dump
no branch name, actor, email, timestamp, build URL, account/project ID
```

Cloudflare deployment ID must never be used as a canonical source SHA.

---

## 8. Current Evidence Summary

`OBSERVED_CURRENT_FACT` at base SHA `ff5dc6a76b9909301a27245b91ef8a194f88b277`:

| Asset | Status | Source |
|---|---|---|
| Release SHA exposure mechanism | Absent | repository |
| Deployment SHA annotation file | Absent | no deploy manifest |
| `x-lovebud-release-sha` header | Absent | `functions/api/[[path]].js` |
| `/.well-known/release.json` | Absent | repository |
| `/release-sha.txt` | Absent | repository |
| `<meta name="lovebud-release-sha">` | Absent | HTML templates |
| `/api/release` endpoint | Absent | `functions/api/` |
| Cloudflare deployment ID as SHA | Forbidden | hard boundary §3.1 |
| Provider API/dashboard dependency | Forbidden | hard boundary §3.1 |
| CI commit-back | Forbidden | hard boundary §3.1 |
| Mutable runtime write | Forbidden | hard boundary §3.1 |
| Automatic deployment/rollback | Forbidden | hard boundary §3.1 |

`UNRESOLVED`: Cloudflare Pages deployment status, Modal runtime logs, Firebase Auth events, and Neon database health are observable only through provider dashboards, which are outside repository evidence boundaries. Provider-native deployment metadata is `NOT_AUTHORIZED`.

---

*Refs #3740*
*Refs #3734 — completed*
*Refs #3673 — Keep OPEN*
*Refs #3699 — Keep OPEN*
*Refs #3425 — Keep OPEN*
*Refs #1882 — Keep OPEN*
