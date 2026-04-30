# CSS/HTML Cleanup Status Map

**Status:** tracking map only
**Related:** Issue #137
**Base main SHA:** `ff11a4b`---

## 1. Purpose

This document maps the remaining CSS/HTML cleanup backlog tracked under Issue #137.

It is not an implementation plan with merge authority. It does not close Issue #137, approve broad CSS rewrites, or modify runtime behavior. It exists to separate completed, in-progress, and remaining cleanup work so that later PRs can stay small and reviewable.

This PR is docs-only.

---

## 2. Completed, in-progress, and stale references

| Reference | Status | Role in #137 cleanup |
|---|---|---|
| PR #302 — global CSS hardening strategy v1 | Merged | Added the initial `GLOBAL_CSS_HARDENING_STRATEGY.md` strategy document. |
| PR #347 — global CSS hardening strategy v2 | Merged | Expanded the global CSS strategy with token, ready-class, icon hiding, transition, and PR split decisions. |
| PR #328 — editor overrides formatting-only cleanup | Merged | Completed the formatting-only cleanup around editor overrides. It is not a role-based relocation implementation. |
| PR #357 — editor overrides relocation audit | Merged | Documented editor override ownership and relocation guardrails before any selector movement. |
| PR #285 — my-trees inline display cleanup history | Historical reference | Prior My Trees display-state cleanup context; use only as history when deciding remaining My Trees cleanup. |
| PR #350 — my-trees class display state cleanup | Merged / accepted | Completed the My Trees inline style/display state cleanup bucket. My Trees post-merge regression was verified and accepted. |
| PR #353 — browser verification entrypoint docs | Merged / ops docs | Supports verification workflow only. Not a CSS/HTML cleanup implementation. |
| PR #354 — local auto browser verification runbook | Historical ops reference | Supports browser verification workflow only. Not a CSS/HTML cleanup implementation. |

Notes:

- PR #353 and PR #354 improve verification readiness. They should not be counted as direct CSS/HTML cleanup implementation for #137.
- PR #302 and PR #347 are strategy/decision documents. They are prerequisites for safe implementation, not implementation completion.
- PR #328 and PR #357 complete the first editor overrides documentation/formatting steps, but do not authorize broad relocation.
- PR #350 completed the My Trees inline style/display state cleanup bucket and was accepted after post-merge regression verification.
- The previously listed `pages/editor.html` inline `onmousedown="event.stopPropagation()"` finding is not present in current `main`; treat that item as stale unless rediscovered in a fresh audit.

---

## 3. Remaining cleanup buckets

### 3.1 `global.css` hardening implementation PRs

Remaining work:

- Inventory and consolidate duplicate `:root` token blocks only after strategy review.
- Audit `--control-*` token declarations and usage before any removal or relocation.
- Evaluate Material Symbols ready-class split between `.ms-fonts-loaded` and `html.material-symbols-ready`.
- Treat global `.material-symbols-outlined` hiding rule as high-risk and avoid behavior changes without browser smoke.
- Keep `transition: none` changes out of structural hardening PRs; route them to UX polish only.

Rules:

- One risk area per PR.
- No broad CSS split.
- No selector/property/value behavior change mixed with docs or audit-only PRs.
- Desktop and mobile smoke required for any CSS behavior change.

### 3.2 Editor overrides role-based relocation implementation

Remaining work:

- Use PR #357's audit before moving any selector.
- Decide whether any override belongs in a page owner CSS file or should remain in its current owner file.
- Move rules only after ownership is explicit and a visual verification target is assigned.

Rules:

- Do not combine override relocation with editor JS refactors.
- Do not combine override relocation with global token cleanup.
- If visual behavior changes, browser smoke is required on editor page.

### 3.3 Editor inline event handler cleanup

Current state:

- The previously recorded `pages/editor.html` inline `onmousedown="event.stopPropagation()"` finding is stale on current `main`.
- No implementation PR should be opened for that exact handler unless a fresh scan rediscovers it.

Remaining work:

- Keep future inline handler cleanup audit-only unless a current handler is found.
- If a current handler is found later, move behavior to JS modules only after ownership and script order are understood.

Rules:

- This is JS/HTML behavior cleanup, not CSS cleanup.
- Do not mix with Editor fallback/global-state migration.
- Do not mix with CSS override relocation.

### 3.4 My Trees inline style cleanup completion via PR #350

Status: Completed

- PR #350 completed the My Trees inline style/display state cleanup bucket.
- PR #379 completed the My Trees state transition recovery.
- My Trees post-merge regression was verified and accepted (loaded state, auth/re-login, API failure app-level, mobile loaded state).

Remaining work:

- No remaining My Trees inline style cleanup work in this bucket unless new gaps are identified.

Rules:

- Keep My Trees cleanup separate from Search/Browse and Editor cleanup.

---

## 4. Issue #137 closure disposition

Issue #137 should not be closed directly from its original backlog state.

The current disposition is to separate completed or stale cleanup buckets from remaining implementation follow-ups. After that split is recorded in issue comments or follow-up issue links, #137 can be considered for administrative closure as completed tracking work.

Closure disposition:

- #137 can be closed after follow-up issue links are created and added to the issue comment or body.
- Closing #137 does not authorize broad CSS rewrites.
- Future implementation must remain one PR per risk area.
- Visual or runtime-sensitive follow-ups must use browser and Cloudflare validation when applicable.
- Selector movement remains prohibited unless a specific implementation PR has ownership, verification scope, and CTO approval.

### 4.1 Completed or no-op buckets

The following buckets are completed or no longer actionable under current `main`:

| Bucket | Disposition | Evidence / note |
|---|---|---|
| My Trees inline display cleanup | Completed / accepted | PR #350 completed the inline display cleanup bucket; PR #379 completed the related My Trees state transition recovery; post-merge regression was accepted. |
| Editor inline `onmousedown` handler | Stale / no-op | The previously recorded `pages/editor.html` inline `onmousedown="event.stopPropagation()"` finding is not present on current `main`. |
| Editor overrides formatting cleanup | Completed | PR #328 completed formatting-only cleanup around editor overrides. |
| Editor overrides relocation audit | Completed | PR #357 documented ownership and relocation guardrails before any selector movement. |
| Global CSS hardening strategy | Completed as strategy | PR #302 and PR #347 completed the strategy and decision baseline. Implementation remains separate. |

### 4.2 Transferred follow-up buckets

The following buckets should move to dedicated follow-up issues before #137 is closed:

| Follow-up bucket | Recommended disposition | Required guardrail |
|---|---|---|
| Global CSS hardening implementation | New implementation issue or narrow issue set | One risk area per PR; no broad `global.css` rewrite; browser smoke for behavior-affecting CSS. |
| Editor overrides role-based relocation implementation | New editor CSS ownership issue | Use PR #357 audit; no selector movement without ownership and editor visual verification. |
| `transition: none` UX polish | Optional separate UX polish issue if CTO wants it tracked separately | Treat as visual/UX polish, not structural hardening; validate nav/auth/icon-loading behavior. |

### 4.3 Closure rule

#137 can move to closure only when all of the following are true:

1. follow-up issue links exist for remaining implementation buckets;
2. the #137 tracker comment or body lists those follow-up links;
3. the tracker states that closure is administrative and does not authorize implementation;
4. no close keyword is used accidentally from a PR body;
5. no CSS/JS/HTML/runtime files are changed as part of the disposition.

---

## 5. Recommended sequence

Recommended sequence before considering Issue #137 closure:

1. Create follow-up issue links for global CSS hardening implementation.
2. Create follow-up issue links for editor overrides role-based relocation implementation.
3. Optionally split `transition: none` UX polish if CTO wants separate tracking.
4. Add those links to the #137 tracker comment or body.
5. Close #137 only as administrative tracking completion, not as implementation approval.

---

## 6. Closure criteria for Issue #137

Do not close Issue #137 until at least one of these is true:

- all remaining cleanup buckets in this document are complete and verified; or
- the remaining buckets are explicitly split into new issues with clear ownership and acceptance criteria; or
- CTO approves reducing #137 to a tracking-only issue and records that decision separately.

Close keywords must not be used by this document.

---

## 7. Non-goals

This status map does not:

- change CSS;
- change JS;
- change HTML;
- change runtime behavior;
- close Issue #137;
- approve broad CSS splitting;
- approve token replacement implementation;
- approve editor fallback migration;
- approve selector movement;
- modify `pages/editor.html`;
- modify PR #7;
- modify prototype/reference/demo/variant paths.

---

## 8. Guardrails

Future cleanup PRs must preserve these guardrails:

- No CSS/JS/HTML/runtime changes in docs-only disposition PRs.
- No selector movement without a dedicated implementation PR.
- No broad `global.css` split.
- No unrelated JS/CSS/HTML changes bundled into one PR.
- No runtime/Auth/API behavior changes in CSS cleanup PRs.
- No `pages/editor.html` changes in disposition docs PRs.
- No prototype/reference/demo/variant path changes unless explicitly approved.
- PR #7 remains untouched unless a future CTO-approved task explicitly says otherwise.
- Verification must distinguish docs-only, visual-only, and behavior-changing PRs.

---

## 9. Final status

Issue #137 remains open.

Current recommended next operational step: create follow-up issues for the remaining implementation buckets, add those links to #137, then consider administrative closure of #137 without authorizing broad CSS rewrites.
