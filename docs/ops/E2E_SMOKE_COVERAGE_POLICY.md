# E2E Smoke Coverage Policy

## Purpose

This document defines the E2E smoke coverage and execution policy for Issue #413.

It classifies existing and future LoveBud smoke scenarios by execution environment, runtime dependency, authentication requirement, evidence requirement, and follow-up ownership.

This is a docs-only policy document.

Non-goals:

- No GitHub Actions workflow change.
- No Playwright or E2E test implementation change.
- No package or dependency change.
- No runtime, client, backend, Cloudflare, Modal, Firebase, or database change.
- No required check is introduced by this document.
- No credential, token, cookie, session, or test-account value is included.
- No PR #7, prototype, reference, demo, or variant path change.

Refs #413

---

## Current policy framing

Default CI should remain lightweight until smoke stability and environment requirements are documented.

Current default CI is expected to focus on static and non-runtime-sensitive checks such as lint, build, Node tests, route tests, contract tests, and verification scripts. E2E smoke coverage may be used manually or in scoped follow-up workflows, but should not become a default required check without a separate reviewed change.

Runtime-sensitive flows require a verified environment source:

1. Cloudflare Pages PR Preview when available and sufficient.
2. Assigned fixed test slot when Firebase Auth, same-origin API, Cloudflare Functions, Modal, or database behavior must be verified against a stable URL.
3. Local static server only as a limited layout or script-load reference when the tested flow does not depend on Auth, API, Cloudflare Functions, Modal, or persisted data.

Production URL is not pre-merge truth. It reflects current deployed main, not an unmerged branch.

Auth and test-account flows require secret-safe handling. Reports may mention that credentials, cookies, sessions, or tokens are present or used through approved local/CI secret stores, but must never print, paste, screenshot, summarize, or partially reveal their values.

---

## Coverage matrix categories

| Category | Meaning | Default policy |
|---|---|---|
| CI candidate | Stable, deterministic, non-secret, low runtime dependency smoke that can run without privileged console state | Eligible for a separate future workflow or opt-in check after review |
| Manual local only | Useful for local layout, script-load, or static regression reference, but not authoritative for runtime behavior | May be used as supporting evidence only |
| Cloudflare Preview candidate | Needs deployed branch assets and same-origin path behavior, but does not require stable test-account state or durable data | Prefer PR Preview URL when available |
| Fixed test slot required | Needs stable URL, Firebase/Auth/API/DB/Modal behavior, or repeatable state across runs | Assign one slot to one PR until verification completes |
| Auth/test account required | Requires login, token acquisition, session transition, private data, editor save/delete, or owner-only views | Requires approved secret-safe handoff and value redaction |
| Unstable/deferred | Flaky, environment-dependent, missing data setup, or not yet scoped | Do not make required; document gap and follow-up owner |

---

## Current E2E smoke script classification

The script names below reflect the current smoke inventory concept from `package.json`. This document does not change those scripts.

| Smoke path | Primary area | Suggested category | Notes |
|---|---|---|---|
| `test:e2e:search-detail` | Search/Browse + Detail | Cloudflare Preview candidate; fixed test slot required if API/data provenance matters | Search/Browse and Detail rely on deployed assets and same-origin `/api` behavior. Local-only PASS is not enough for runtime-sensitive evidence. |
| `test:e2e:auth-guard` | Auth/Login + protected route guard | Fixed test slot required; auth/test account required | Must verify redirect/session behavior without exposing token, cookie, or session values. |
| `test:e2e:editor-save` | Editor | Fixed test slot required; auth/test account required | Save flow depends on authenticated owner context, API gateway, Modal/backend, and persisted data behavior. |
| `test:e2e:editor-delete` | Editor | Fixed test slot required; auth/test account required | Destructive or state-changing checks require isolated test data and clear cleanup evidence. |
| `test:e2e:login-success` | Auth/Login | Fixed test slot required; auth/test account required | Requires secret-safe credential handling and explicit session redaction in reports. |
| `test:e2e:login-timeout` | Auth/Login | CI candidate only if fully deterministic; otherwise manual or Cloudflare Preview candidate | Timeout behavior can be environment-sensitive. Do not make required until stability is demonstrated. |
| `test:e2e:ui-regression` | Shared UI/page smoke | CI candidate for non-auth static paths; Cloudflare Preview candidate for deployed asset checks | Split static visual/load smoke from runtime-sensitive Auth/API smoke. |
| `test:e2e:ci` | Aggregate E2E command | Unstable/deferred as a default required check | Do not enable as required CI until component scripts are classified, stable, and environment-provisioned. |

---

## Page and domain matrix

| Page/domain | Primary risks | Suggested execution policy | Evidence required |
|---|---|---|---|
| Search/Browse | API gateway, Modal browse summary, cache behavior, public visibility vs browse eligibility, preview hydration | Cloudflare Preview candidate; fixed test slot if data/API assertions are required | URL provenance, viewport, console fatal errors, network/API status, upstream evidence when available |
| Detail | Public tree/memory detail, private fallback behavior, 404/permission states | Cloudflare Preview candidate; fixed test slot for auth/private detail paths | Detail URL, auth state category only, console/network results, no sensitive screenshots |
| Auth/Login | Firebase initialization, redirect preservation, timeout/offline behavior, login success/failure | Fixed test slot required; auth/test account required | Auth state transitions by status only, no credential/token/session values, redirect URL evidence without sensitive params |
| My Trees | Owner-only tree list/create/update/delete, private/public visibility, Plus private storage policy | Fixed test slot required; auth/test account required | Test data isolation, owner/non-owner expectation, API result status, no private content leakage |
| Editor | Memory create/update/delete, autosave/cache behavior, tree ownership, private memory handling | Fixed test slot required; auth/test account required | Save/delete outcome, API status, console fatal errors, cleanup status, screenshot redaction |
| Settings | Auth-gated page behavior, account/session state, return navigation | Cloudflare Preview candidate for static/navigation checks; fixed test slot for auth state checks | Redirect behavior, viewport, console fatal errors, auth state category only |
| API gateway / Modal backend | `/api/*` routing, Cloudflare Functions, Modal upstream, status/body contract, degraded behavior | Contract tests for stable cases; fixed test slot or supplied URL smoke for deployed runtime behavior | Request path, response status, safe headers such as upstream/degraded status, no secret-bearing headers |

---

## Evidence requirements

Every E2E smoke report should separate PASS, FAIL, BLOCKED, and NOT_VERIFIED.

Required evidence fields:

- Tested URL and URL provenance:
  - Cloudflare PR Preview URL, assigned fixed test slot URL, supplied preview URL, or local URL.
- Branch or deployment SHA when available.
- Viewport:
  - desktop and/or mobile dimensions used.
- Console result:
  - fatal console errors: NONE or list message class/path only.
- Network/API result:
  - failed requests, status codes, route paths, and safe response category.
  - do not print Authorization headers, cookies, tokens, session values, or credential-bearing payloads.
- Auth/session handling:
  - report only status categories such as anonymous, authenticated test account, redirected, token present, token missing, session cleared.
  - never print token, cookie, session, user credential, credential prefix/suffix, or local storage values.
- Screenshot policy:
  - screenshots may be used for non-sensitive UI evidence.
  - do not include screenshots showing credentials, session material, private user data, personal account identifiers, or unreleased sensitive content.
  - if a screenshot would expose sensitive content, report `SCREENSHOT_SKIPPED_SENSITIVE_CONTENT` instead.

---

## Follow-up split

Recommended follow-up sequence:

1. PR A: docs-only matrix.
   - This policy document.
   - No workflow, test, runtime, or credential changes.
2. PR B: optional non-auth E2E workflow.
   - Separate review only after stable non-auth candidates are identified.
   - Should avoid required-check status initially.
3. PR C: auth/test-slot E2E policy.
   - Define test account handoff, fixed slot assignment, redaction, cleanup, and evidence procedure.
   - No credential values in repository, PRs, issues, logs, or screenshots.
4. PR D: page-specific smoke improvements.
   - Split by page/domain to avoid broad flaky aggregate changes.
   - Keep Search/Browse, Auth/Login, My Trees, Editor, Settings, and API gateway changes separate when possible.

---

## Guardrails

- Do not modify `.github/workflows/**` from this policy PR.
- Do not modify `package.json` or lockfiles from this policy PR.
- Do not implement or expand Playwright/E2E tests from this policy PR.
- Do not modify runtime, client, backend, Firebase, Cloudflare, Modal, Netlify, Vercel, or database configuration from this policy PR.
- Do not make any E2E smoke a required check from this policy PR.
- Do not expose test credentials, tokens, cookies, session values, service-account material, API keys, or secret values.
- Do not use production URL as pre-merge source of truth.
- Use Cloudflare Preview or fixed test slots for runtime-sensitive browser flows.
- Do not touch PR #7 or prototype/reference/demo/variant paths.
- Use non-completing issue references only for #413 unless CTO explicitly authorizes issue closure.

---

## Review checklist for future E2E PRs

Before adding any workflow or E2E implementation change, answer:

- Is the scenario deterministic enough for CI?
- Does it require deployed branch assets?
- Does it require Firebase Auth or a test account?
- Does it mutate persistent state?
- Does it require Cloudflare Functions or Modal backend behavior?
- Is a fixed test slot assigned if needed?
- Are credentials and sessions handled without value exposure?
- Is evidence separated into PASS, FAIL, BLOCKED, and NOT_VERIFIED?
- Is production URL avoided as pre-merge proof?
- Are PR #7 and prototype/reference/demo/variant paths untouched?

Refs #413
