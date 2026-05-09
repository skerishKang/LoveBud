# Cloudflare Pages E2E Smoke Replacement Proposal

**Status:** Proposal — docs-only  
**Issue:** [#136](https://github.com/skerishKang/LoveBud/issues/136)  
**Scope:** Define the replacement path for the removed Netlify-dev E2E smoke workflow.  

> This document does not implement a workflow. It defines the staged replacement strategy for Cloudflare Pages + Modal based smoke verification.

---

## 1. Background

PR #108 removed the Netlify-dev based E2E smoke workflow. That removal is correct because Netlify is no longer the active LoveBud runtime or fallback target.

The active verification direction is:

1. Cloudflare Pages for the frontend entry.
2. Same-origin `/api/*` from the browser.
3. Modal as the active backend/runtime target.
4. Fixed test slots or Cloudflare Preview URLs for pre-merge browser verification.

The current gap is that CI still relies on static verification and Node-based tests, while browser/runtime-dependent behavior is verified manually.

---

## 2. Existing Coverage Inputs

This proposal builds on the existing Issue #136 docs:

| Document | Role |
|----------|------|
| `ISSUE_136_WORKFLOW_COVERAGE_INVENTORY.md` | Page and API coverage inventory from production exploration. |
| `FIXED_SLOT_MANUAL_E2E_GATE.md` | Manual fixed-slot gate while automated smoke is not available. |
| `BROWSER_VERIFICATION_URL_POLICY.md` | URL provenance and browser verification source rules. |
| `TEST_PREVIEW_SLOTS.md` | Fixed preview slot operations. |
| `LOCAL_BROWSER_VERIFICATION_STARTUP.md` | Local/browser verification startup rules. |
| `KNOWN_CI_E2E_BLOCKERS.md` | Known CI/E2E blocker classification. |

---

## 3. Current CI Coverage

Current CI is expected to cover repository-local checks such as:

- lint
- build/static validation
- Node test files
- static verification scripts

Current CI does **not** provide a production-like browser smoke against Cloudflare Pages + Modal for each PR.

This means CI can catch static/script/test regressions, but the following remain outside automated CI unless explicitly verified elsewhere:

- Cloudflare Pages deployment behavior.
- Same-origin `/api/*` behavior from an actual browser page.
- Modal upstream reachability from the deployed page.
- Browser console/runtime failures after script loading.
- Layout regressions such as horizontal overflow.
- Auth/session boundary behavior.

---

## 4. Replacement Strategy

Use a staged replacement rather than immediately introducing a broad E2E workflow.

| Phase | Status | Description |
|-------|--------|-------------|
| Phase 0 | Active | Manual fixed-slot gate with SHA provenance and evidence reporting. |
| Phase 1 | Proposed | Semi-automated smoke command that accepts a supplied Cloudflare URL. |
| Phase 2 | Proposed | GitHub Actions workflow using a manually supplied or discovered Cloudflare Preview URL. |
| Phase 3 | Future | Fully automated PR Preview URL discovery and smoke execution if Cloudflare mechanics prove reliable. |

---

## 5. Phase 0 — Manual Gate

Phase 0 is already documented in `FIXED_SLOT_MANUAL_E2E_GATE.md`.

Use Phase 0 when:

- A PR changes runtime-sensitive frontend behavior.
- The PR depends on `/api/*`, Auth, Modal, Search/Browse, Editor, My Trees, or Settings behavior.
- Cloudflare Preview URL discovery is not reliable enough for CI.
- A fixed test slot is explicitly assigned and SHA-aligned.

Phase 0 must continue to prohibit final PASS from local static server for Browse/Search/Auth/API/data-loaded pages.

---

## 6. Phase 1 — Supplied URL Smoke Command

Phase 1 should add a local command or script that accepts an explicit URL, for example:

```text
SMOKE_BASE_URL=https://testN.lovebud.pages.dev npm run smoke:cloudflare
```

Recommended properties:

- The command must not deploy anything.
- The command must not guess the PR URL.
- The command must require an explicit base URL.
- The command must report page, viewport, console fatal status, network blocker status, and horizontal overflow status.
- The command must distinguish frontend regression from Modal upstream outage.
- The command must avoid credential/session/token output.

Phase 1 can run locally first and later be reused by CI.

---

## 7. Phase 2 — GitHub Actions With Supplied URL

Phase 2 should add a workflow only after Phase 1 is stable.

Possible workflow shape:

- Trigger: `workflow_dispatch` or PR comment-controlled manual dispatch.
- Required input: `base_url`.
- Optional input: `expected_sha`.
- Run the Phase 1 supplied-URL smoke command.
- Require URL provenance evidence in the workflow summary.

This avoids brittle automatic PR Preview discovery while still making browser smoke reproducible in CI.

---

## 8. Phase 3 — Automatic Preview URL Discovery

Phase 3 is only allowed after Cloudflare Pages PR Preview mechanics are confirmed reliable.

Required proof before Phase 3:

1. The workflow can determine the correct Cloudflare Preview URL for the PR branch.
2. The workflow can confirm the deployed commit or equivalent provenance.
3. The workflow fails closed on SHA mismatch.
4. The workflow does not rely on production URL before merge.
5. The workflow does not overwrite fixed test slots.

If any condition is not satisfied, stay on Phase 2.

---

## 9. Minimum Smoke Targets

### P0 Public Smoke

| Target | Classification | Required checks |
|--------|----------------|-----------------|
| `/` | static-only | Page loads, CTA/header visible, no fatal console error, no horizontal overflow. |
| `/pages/intro.html` | static-only | Page loads, primary CTA visible, no fatal console error, no horizontal overflow. |
| `/pages/search.html` | API-dependent | Cards or valid empty/error state render, `/api/*` not blocked, preview selection works when data exists. |

### P1 Public Interaction Smoke

| Target | Classification | Required checks |
|--------|----------------|-----------------|
| Search category/sort | API-dependent | URL state updates and refresh restore work. |
| Search preview | API-dependent | Card click updates preview panel. |
| Direct tree link | API-dependent | A valid tree link opens preview when fixture exists. |
| Mobile Search | API-dependent/layout | No horizontal overflow; preview behavior matches mobile design. |

### P2 Auth Boundary Smoke

| Target | Classification | Required checks |
|--------|----------------|-----------------|
| `/pages/login.html` | auth-boundary | Login UI renders; no credential values logged. |
| `/pages/my-trees.html` | auth/session-dependent | Logged-out or credentialed boundary behavior is classified correctly. |
| `/pages/editor.html` | auth/session-dependent | Logged-out redirect or pre-auth placeholder behavior is classified correctly. |

Auth/session-dependent smoke must remain manual or gated by approved QA credential workflow until credential handling is stable.

---

## 10. Failure Classification

| Failure | Classification | Merge impact |
|---------|----------------|--------------|
| Fatal browser console error in changed page | PR blocker | Fix before merge. |
| `/api/*` frontend route failure caused by PR | PR blocker | Fix before merge. |
| Modal upstream outage unrelated to PR | Environment blocker | Do not mark PR fail; report BLOCKED. |
| SHA mismatch between slot/preview and PR head | Verification blocker | Do not report PASS. |
| YouTube thumbnail 404 only | Usually non-blocking | Record as non-critical unless UI breaks. |
| Horizontal overflow on target viewport | PR blocker unless pre-existing and documented | Classify before merge. |

---

## 11. Guardrails

- Do not restore Netlify-dev based E2E.
- Do not treat Netlify as active fallback.
- Do not use production URL as pre-merge PASS target.
- Do not use local static server as final PASS for `/api/*`, Auth, or data-loaded pages.
- Do not overwrite fixed test slots without assignment/release.
- Do not output credential, token, cookie, session, header, password, or ZIP password values.
- Do not touch PR #7, prototype, reference, demo, or variant paths.
- Do not combine this with Auth blocker work under Issue #133.

---

## 12. Recommended Next PRs

1. **Phase 1 script proposal / implementation PR**
   - Add supplied-URL smoke command.
   - No GitHub Actions workflow yet.
   - Use public/static and Search/Browse targets only.

2. **Phase 2 workflow PR**
   - Add `workflow_dispatch` smoke workflow with explicit `base_url` input.
   - No automatic URL discovery yet.

3. **Auth smoke design PR**
   - Separate from public smoke.
   - Depends on QA credential workflow stability.

---

## 13. Acceptance Criteria Mapping

| Issue #136 criterion | Status in this proposal |
|----------------------|-------------------------|
| Post-PR #108 CI gap documented | Covered. |
| Netlify dev not reintroduced | Covered. |
| Cloudflare Pages + Modal remains direction | Covered. |
| Clear next step for automated/semi-automated smoke | Covered via Phase 1 and Phase 2. |
| Auth blocker remains separate | Covered. |

---

## 14. Issue Closure

This proposal alone should **not** close Issue #136.

Issue #136 can move toward closure only after the team either:

1. lands a minimal supplied-URL smoke command and documents manual use as the accepted replacement for now, or
2. lands a GitHub Actions workflow that runs against an explicit or reliably discovered Cloudflare Pages URL.
