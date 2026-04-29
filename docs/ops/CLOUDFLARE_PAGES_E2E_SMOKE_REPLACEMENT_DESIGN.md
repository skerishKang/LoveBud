# Cloudflare Pages E2E Smoke Replacement Design

> **Status:** DESIGN_PROPOSAL
> **Source:** Issue #136
> **Type:** Docs-only proposal — no workflow, test runner, runtime, or deployment changes

---

## 1. Purpose

This document proposes a replacement path for the removed Netlify dev based CI E2E smoke coverage.

The active LoveBud deployment target is Cloudflare Pages, with browser requests using same-origin `/api/*` routes through Cloudflare Pages Functions to the Modal backend and Neon database. Any replacement E2E smoke strategy must align with that runtime boundary instead of restoring Netlify dev as a CI dependency.

This PR does not implement a workflow. It defines decision points, minimum gates, and a follow-up split for later implementation PRs.

---

## 2. Current CI Baseline

### 2.1 Workflow Coverage

The current CI baseline is expected to remain centered on `.github/workflows/ci.yml` and package scripts such as:

- `npm run lint`
- `npm run build`
- `npm run test`
- `npm run verify`

These checks provide repository-level quality gates, syntax/build/test coverage, and project-specific verification hooks.

### 2.2 What This Baseline Does Not Guarantee

The baseline does not automatically prove that a deployed Cloudflare Pages PR Preview can:

- serve the target page under the same path as production;
- route same-origin `/api/*` calls correctly;
- complete Auth/session-dependent flows;
- reach Modal upstream services successfully;
- exercise fixed test slots such as `test1` through `test5` safely.

### 2.3 No Netlify Dev Reintroduction

Netlify dev must not be restored as a replacement CI smoke path. Netlify is not the active runtime target for this project and should not become a new CI dependency for E2E coverage.

---

## 3. Replacement Design Questions

### 3.1 PR Preview URL Obtainability

A Cloudflare Pages based smoke path first needs a reliable way to obtain the correct PR Preview URL.

Questions to settle before automation:

- Is the PR Preview URL available as a GitHub check, deployment record, or bot comment?
- Can CI read it without extra secrets?
- Is the URL stable enough during a workflow run, or does it require polling?
- How should the workflow fail if the preview URL is absent, delayed, or replaced?

A design should prefer official deployment metadata over parsing comments when practical. Comment parsing may be acceptable only as an interim adapter with clear failure behavior.

### 3.2 Fixed Test Slots: Manual-Only vs CI-Safe

The fixed slots `test1` through `test5` are useful for production-equivalent verification, but automated mutation of these slots can conflict with parallel work.

Questions to settle:

- Are fixed slots reserved exclusively through a human/CTO assignment process?
- Can CI safely read a slot without mutating it?
- Can CI safely deploy to a slot, or must that remain manual-only?
- How should a workflow detect that a slot is already assigned to another PR?

Default design position: fixed slot deployment remains manual-only until an explicit locking or assignment mechanism exists.

### 3.3 Static-Only Smoke Candidates

Static-only checks are the safest first automation candidates because they avoid Auth, API, database, and upstream service dependencies.

Candidate pages:

- `/`
- `/pages/intro.html`
- `/pages/search.html` only for static shell availability, not search data correctness
- `/pages/login.html` only for render availability, not sign-in completion

Candidate assertions:

- HTTP 200 or expected redirect-free load;
- page title exists;
- key static selector exists;
- no fatal JavaScript error on initial load;
- mobile viewport shell renders without blank screen.

Static-only smoke should not be described as full runtime coverage.

### 3.4 `/api/*` Dependent Candidates

API-dependent smoke requires same-origin routing through Cloudflare Pages Functions and Modal.

Candidate checks:

- public read endpoint returns an expected non-secret status or shape;
- unauthenticated private endpoint returns expected 401 or 403 behavior;
- API gateway does not expose secret values in error responses.

Questions to settle:

- Which endpoints are safe for CI without a test account?
- Which responses are stable enough to assert?
- How should transient Modal or Neon failures be classified?

### 3.5 Auth/Session Dependent Candidates

Auth/session smoke is higher risk because it may require test credentials, browser session setup, provider behavior, and cleanup.

Candidate checks for a later phase:

- unauthenticated protected page redirects to login;
- confirmed auth cache is reconciled correctly;
- logout clears protected access;
- test account login works only in an explicitly assigned test slot.

Auth smoke must not be mixed into the first replacement PR unless credentials, isolation, cleanup, and flake handling are already approved.

### 3.6 Modal Upstream Dependent Candidates

Modal upstream checks should be separated from static and Auth checks.

Candidate checks:

- same-origin route reaches Modal for a non-mutating endpoint;
- Modal error classification is visible without leaking internals;
- timeout behavior is bounded and reported clearly.

Questions to settle:

- Which Modal route is safe and non-mutating?
- What response is expected in unauthenticated mode?
- Should Modal upstream failures block all PRs, or only runtime-labeled PRs?

---

## 4. Minimum Acceptable Replacement

### 4.1 Temporary Manual Gate

The minimum acceptable replacement can start as a docs-only manual gate while automation is designed.

Manual gate requirements:

- identify the exact URL tested;
- classify URL source as PR Preview, Branch Preview, fixed test slot, local-only, or production;
- record viewport and browser used;
- record whether the test is static-only, API-dependent, Auth-dependent, or Modal-dependent;
- attach evidence without exposing credentials, cookies, tokens, or session data.

### 4.2 Semi-Automated Smoke Possibility

A semi-automated option can run Playwright locally or in CI against an explicitly supplied URL.

Requirements:

- the URL must be passed as an input or environment variable;
- the workflow must not deploy or mutate fixed slots;
- the workflow must not require secrets for static-only checks;
- failures must distinguish preview URL unavailable from page smoke failure.

This option is suitable as an intermediate step if fully automated PR Preview discovery is not yet reliable.

### 4.3 Fully Automated Cloudflare PR Preview Smoke Later

A full automated path can be considered after preview URL discovery is reliable.

Expected shape:

1. Wait for Cloudflare Pages PR Preview deployment.
2. Resolve the preview URL through deployment metadata or a documented fallback.
3. Run static-only public page smoke first.
4. Add API-dependent smoke only after stable endpoint contracts are documented.
5. Add Auth/runtime smoke only after test account and slot isolation are approved.

---

## 5. Guardrails

This design does not authorize implementation. Follow-up PRs must preserve these guardrails:

- Do not restore Netlify dev workflows.
- Do not change `.github/workflows/**` in this PR.
- Do not change Playwright config, test runner behavior, or package scripts in this PR.
- Do not mutate fixed test slots.
- Do not include secrets, tokens, cookies, sessions, credentials, or partial credential identifiers in docs or logs.
- Do not mix with Auth blocker work.
- Do not mix with UI, CSS, Search, editor, or runtime implementation work.
- Do not close Issue #136 from a design-only PR.
- Do not touch PR #7, prototype, reference, demo, or variant assets.

---

## 6. Follow-up PR Split

| Follow-up | Scope | Notes |
|---|---|---|
| PR A | Current workflow coverage inventory | Document what `.github/workflows/ci.yml` and package scripts currently cover. No behavior changes. |
| PR B | Static public smoke workflow proof of concept | Cloudflare PR Preview or supplied URL only. No Auth/API mutation. |
| PR C | Fixed-slot manual runbook tightening | Clarify assignment, evidence, and non-overlap rules for `test1` through `test5`. |
| PR D | API-dependent smoke design/POC | Non-mutating same-origin `/api/*` checks only. |
| PR E | Auth/runtime smoke design | Requires approved test account, slot isolation, cleanup rules, and flake policy. |

Each follow-up should be independently reviewable and should not combine docs, workflow implementation, Auth changes, and runtime changes in one PR.

---

## 7. Recommended Decision Path

Recommended order:

1. Keep current CI baseline unchanged.
2. Use manual Cloudflare Pages evidence as the temporary gate.
3. Add static-only smoke against an explicitly supplied URL.
4. Add automated PR Preview URL discovery after it is reliable.
5. Add API-dependent and Auth-dependent smoke only after contracts and isolation are documented.

This sequence preserves forward progress without reintroducing legacy runtime assumptions.

---

## 8. Verification Checklist for This PR

- [ ] `git diff --check` passes
- [ ] Changed files limited to this design document and optional index links
- [ ] No workflow, package, Playwright, test, runtime, JS, CSS, or HTML changes
- [ ] No fixed test slot mutation
- [ ] No secret/token/cookie/session/credential values
- [ ] No `close`/`fixes`/`resolves` keywords for #136

---

## Notes

Issue #136 remains open. This document is a design proposal only and does not implement a Cloudflare Pages E2E smoke workflow.
