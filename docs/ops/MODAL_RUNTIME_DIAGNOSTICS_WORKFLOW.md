# Modal Runtime Diagnostics Workflow

Issue: #473

This runbook defines a redaction-safe workflow for diagnosing LoveBud runtime failures across browser observations, Cloudflare Pages Functions, Modal backend behavior, GitHub deployment status, and request ID correlation.

This document is operator guidance only. It does not authorize runtime code changes, Cloudflare configuration changes, Modal deployment changes, workflow changes, third-party logging adoption, or PR #7/prototype/reference/demo/variant changes.

## Goals

- Give operators one workflow for Cloudflare and Modal runtime diagnostics.
- Separate browser, proxy, backend, database, auth, timeout, malformed-response, and deployment-mismatch symptoms.
- Use request IDs when available to correlate one request across layers.
- Keep all reports secret-safe and private-payload-safe.
- Classify every verification as `PASS`, `NOT_VERIFIED`, or `BLOCKED`.

## Redaction policy

Never print, paste, screenshot, commit, or quote the value of any of the following:

- Authorization headers
- cookies
- session values
- access tokens
- refresh tokens
- API keys
- Firebase service account material
- private keys
- raw request bodies
- private tree or memory content
- OAuth callback/session material
- test-account passwords or session state

Use safe status language instead:

- `PRESENT`
- `ABSENT`
- `UNKNOWN`
- `401 observed`
- `403 observed`
- `5xx observed`
- `timeout observed`
- `request ID present`
- `request ID absent`
- `fixed slot SHA matched`
- `fixed slot SHA mismatch`
- `no secret values exposed`

Do not include partial values, prefixes, suffixes, screenshots, copied browser storage, decoded credentials, or raw log lines that contain sensitive data.

## Environment classification

Before diagnosing a runtime symptom, classify the environment.

| Environment | Appropriate use | Not sufficient for |
| --- | --- | --- |
| Local static check | File presence, import paths, route mapping, docs-only validation | Auth/API/runtime PASS |
| Cloudflare PR Preview | Static public pages, PR deployment existence, public non-login smoke | Login/Auth/API/DB-backed final PASS |
| Fixed test slot | Auth, API, DB-backed, Editor, My Trees, Browse/Search runtime flows | Production-only incident confirmation |
| Production observation | Confirm user-facing production symptom or public read behavior | Mutating tests, private data probing, unsafe experiments |

Rules:

- Auth/API/runtime browser verification requires a fixed test slot unless the task explicitly asks for production observation.
- One fixed test slot belongs to one PR until verification completes.
- A slot verification is not valid unless the deployed slot SHA matches the expected PR head SHA.
- If the slot SHA cannot be confirmed, report `BLOCKED` or `NOT_VERIFIED`, not `PASS`.
- Production observation must avoid private/authenticated payload exposure unless there is an explicit, secret-safe incident procedure.

## Request ID correlation

LoveBud uses a non-sensitive request ID header for runtime correlation.

Expected request ID behavior:

1. Cloudflare Pages Functions generate or preserve `x-lovebud-request-id`.
2. Cloudflare forwards the request ID to Modal for Modal-owned routes.
3. Cloudflare exposes the request ID on responses where applicable.
4. Modal route logging can include the request ID in redaction-safe metadata.

Safe reporting:

- You may report whether a request ID is present or absent.
- Do not paste the request ID value unless the task specifically requires a short non-sensitive identifier for correlation and the report channel is approved for that value.
- Prefer `request ID present` over copying the exact value.
- Never combine request ID reporting with token, cookie, session, or private payload values.

## Diagnostics flow

### 1. Confirm GitHub and deployment provenance

Record:

- Repository
- Issue or PR number
- Branch
- Expected head SHA, if a PR is involved
- Deployed SHA, if checking a fixed slot or preview
- Deployment URL provenance: PR Preview, Branch Preview, fixed slot, production, or local

Classification:

- `PASS`: expected SHA and deployed SHA match when a slot/preview match is required.
- `NOT_VERIFIED`: SHA could not be checked but the task does not require final runtime PASS.
- `BLOCKED`: SHA mismatch or missing fixed slot prevents valid runtime verification.

### 2. Reproduce the browser symptom safely

Check only what the task authorizes.

Allowed observations:

- URL path and environment type
- HTTP status code
- JSON parse success/failure
- route category
- visible error category
- request ID presence
- upstream/degraded header presence
- console error category without private values

Forbidden observations:

- cookie/session/browser storage values
- Authorization header values
- Firebase token values
- private request or response payload values
- private tree or memory content

### 3. Inspect Cloudflare proxy behavior

For same-origin `/api/*` routes, check whether Cloudflare returns the expected upstream classification.

Relevant safe signals:

- `x-lovebud-upstream: modal`
- `x-lovebud-request-id` present
- `x-lovebud-degraded: modal-unavailable`
- `x-lovebud-route-status: unhandled`
- HTTP 404 for unhandled route
- HTTP 405 for method mismatch
- HTTP 503 for Modal unavailable

Do not expose Cloudflare secret bindings, environment variable values, cookies, Authorization headers, or private payloads.

### 4. Inspect Modal behavior safely

Use Modal diagnostics only in a redaction-safe way.

Safe Modal log fields:

- request ID present/absent
- route pattern or endpoint category
- method
- status code
- coarse error category
- duration bucket
- timestamp or relative timing

Forbidden Modal log content:

- Authorization headers
- cookies
- session values
- access tokens
- API keys
- Firebase credentials
- raw request bodies
- raw private tree or memory content
- full stack traces that contain sensitive values

If logs cannot be accessed safely, report `NOT_VERIFIED` or `BLOCKED` and explain the limitation without dumping log content.

### 5. Classify the failure

Use the narrowest safe category.

| Symptom | Likely category | Safe report wording |
| --- | --- | --- |
| 401 | Auth/session | `401 observed; auth/session category` |
| 403 | Auth/entitlement/access policy | `403 observed; access policy category` |
| 404 on expected public detail | not found or visibility guard | `404 observed; public detail not available or hidden` |
| 405 | method mismatch | `405 observed; method not allowed` |
| 500 | backend exception | `5xx observed; backend unexpected-error category` |
| 503 with Modal degraded header | Modal unavailable/proxy upstream | `503 observed; modal-unavailable category` |
| timeout | upstream or network timeout | `timeout observed` |
| invalid JSON | malformed response | `malformed JSON observed` |
| deployed SHA mismatch | deployment mismatch | `fixed slot SHA mismatch` |
| missing request ID | correlation gap | `request ID absent` |

## Verification targets by task type

### Public read smoke

Use public GET routes only. Confirm:

- HTTP status
- JSON parse
- upstream/degraded header status
- request ID presence
- no 500/503 unless the task is testing failure behavior

Do not use authenticated routes or private payloads.

### Auth/API runtime smoke

Use a fixed test slot. Confirm:

- assigned slot
- deployed SHA matches PR head SHA
- login/auth state can be established without exposing credentials
- same-origin `/api/*` path is used
- response status and request ID presence
- no private payload values in report

### Deployment mismatch investigation

Confirm:

- expected PR head SHA
- Cloudflare deployment SHA
- branch preview or fixed slot URL provenance
- whether stale content is served
- whether browser result should be `BLOCKED` instead of `PASS`

## Report templates

### Browser runtime verification report

```text
Browser Runtime Verification Report

1. Computer/model:
2. Environment type: local / PR Preview / Branch Preview / fixed slot / production
3. URL provenance:
4. Expected head SHA:
5. Deployed SHA:
6. SHA match: YES / NO / NOT_VERIFIED
7. Routes tested:
   - route:
   - method:
   - status:
   - JSON parse:
   - upstream/degraded headers:
   - request ID: PRESENT / ABSENT / NOT_VERIFIED
8. PASS:
9. NOT_VERIFIED:
10. BLOCKED:
11. Secret/private payload exposure: NONE / STOP_AND_REPORT
12. Final recommendation:
```

### API/Auth failure report

```text
API/Auth Failure Report

1. Computer/model:
2. Environment type:
3. Fixed test slot:
4. Slot SHA match:
5. Flow tested:
6. Status observed: 401 / 403 / 5xx / timeout / other
7. Request ID: PRESENT / ABSENT / NOT_VERIFIED
8. Auth material exposure: NONE
9. Private payload exposure: NONE
10. Classification:
11. PASS:
12. NOT_VERIFIED:
13. BLOCKED:
14. Recommended next step:
```

### Deployment mismatch report

```text
Deployment Mismatch Report

1. Computer/model:
2. PR/branch:
3. Expected head SHA:
4. Deployment URL:
5. Deployment SHA:
6. SHA match: YES / NO / NOT_VERIFIED
7. Browser verification validity: PASS / NOT_VERIFIED / BLOCKED
8. Secret/private payload exposure: NONE
9. Required action:
```

### Secret-safe log review report

```text
Secret-Safe Log Review Report

1. Computer/model:
2. Log source: Cloudflare / Modal / browser console / GitHub Actions
3. Time window or request category:
4. Request ID: PRESENT / ABSENT / NOT_VERIFIED
5. Fields observed, values omitted:
6. Error category:
7. Sensitive values exposed: NO / STOP_AND_REPORT
8. Private payload exposed: NO / STOP_AND_REPORT
9. PASS:
10. NOT_VERIFIED:
11. BLOCKED:
12. Recommended next step:
```

## PASS / NOT_VERIFIED / BLOCKED rules

Use `PASS` only when the claim was actually verified in the correct environment.

Use `NOT_VERIFIED` when:

- the environment cannot prove the requested runtime property,
- a log source was not available,
- a route was not exercised,
- a private/authenticated path was intentionally excluded,
- the task only performed static inspection.

Use `BLOCKED` when:

- fixed slot SHA mismatch prevents valid runtime verification,
- required credentials or access are unavailable,
- DNS/network access prevents the test,
- logs cannot be reviewed safely,
- the worktree is dirty and policy requires stopping,
- a required route cannot be reached due to deployment or environment failure.

## Closure criteria for diagnostics tasks

A diagnostics task can be closed when:

- the correct environment was used,
- request/deployment provenance was recorded,
- results separate `PASS`, `NOT_VERIFIED`, and `BLOCKED`,
- no sensitive values or private payloads were exposed,
- request ID correlation was checked when applicable,
- Cloudflare and Modal responsibility boundaries were classified,
- any unresolved runtime gap has a separate follow-up issue.

## Related issues

- #415: observability and runtime logging strategy audit
- #470: redaction-safe request correlation
- #472: redaction-safe Modal structured logging using request IDs
- #473: this runbook
