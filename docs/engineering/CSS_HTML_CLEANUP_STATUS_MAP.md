# CSS/HTML Cleanup Status Map

**Status:** tracking map only  
**Related:** Issue #137  
**Base main SHA:** `ea52c5def3842a69d2e811d62ad56f9acf83b664`  

---

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
| PR #350 — my-trees class display state cleanup | Open / draft | Expected to complete the My Trees inline style/display state cleanup bucket before #137 closure, but it overlaps active My Trees work and should not run in parallel with #379. |
| PR #353 — browser verification entrypoint docs | Merged / ops docs | Supports verification workflow only. Not a CSS/HTML cleanup implementation. |
| PR #354 — local auto browser verification runbook | Historical ops reference | Supports browser verification workflow only. Not a CSS/HTML cleanup implementation. |

Notes:

- PR #353 and PR #354 improve verification readiness. They should not be counted as direct CSS/HTML cleanup implementation for #137.
- PR #302 and PR #347 are strategy/decision documents. They are prerequisites for safe implementation, not implementation completion.
- PR #328 and PR #357 complete the first editor overrides documentation/formatting steps, but do not authorize broad relocation.
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

Remaining work:

- Complete PR #350 or equivalent My Trees class/display state cleanup after active My Trees PRs settle.
- Confirm no JS/CSS/page runtime regression.
- Verify visual state behavior if any display-state behavior changed.

Rules:

- Do not duplicate PR #350 work in a separate branch unless PR #350 is abandoned or explicitly superseded.
- Keep My Trees cleanup separate from Search/Browse and Editor cleanup.
- Do not run PR #350 in parallel with PR #379 because they overlap My Trees state behavior.

---

## 4. Recommended sequence

Recommended sequence before considering Issue #137 closure:

1. Finish or supersede PR #350 after active My Trees work settles.
2. Land global CSS minimal hardening PRs one at a time, following PR #302/#347 strategy constraints.
3. Implement editor overrides relocation only if PR #357's audit identifies a safe ownership move and browser smoke is assigned.
4. Re-run an inline HTML handler scan before opening any editor inline event handler implementation PR.
5. Re-evaluate Issue #137.
6. If remaining work is still broad, split the leftovers into new specific issues rather than closing #137 prematurely.

---

## 5. Closure criteria for Issue #137

Do not close Issue #137 until at least one of these is true:

- all remaining cleanup buckets in this document are complete and verified; or
- the remaining buckets are explicitly split into new issues with clear ownership and acceptance criteria; or
- CTO approves reducing #137 to a tracking-only issue and records that decision separately.

Close keywords must not be used by this document.

---

## 6. Non-goals

This status map does not:

- change CSS;
- change JS;
- change HTML;
- change runtime behavior;
- close Issue #137;
- approve broad CSS splitting;
- approve token replacement implementation;
- approve editor fallback migration;
- modify PR #7;
- modify prototype/reference/demo/variant paths.

---

## 7. Guardrails

Future cleanup PRs must preserve these guardrails:

- No broad `global.css` split.
- No unrelated JS/CSS/HTML changes bundled into one PR.
- No runtime/Auth/API behavior changes in CSS cleanup PRs.
- No prototype/reference/demo/variant path changes unless explicitly approved.
- PR #7 remains untouched unless a future CTO-approved task explicitly says otherwise.
- Verification must distinguish docs-only, visual-only, and behavior-changing PRs.

---

## 8. Final status

Issue #137 remains open.

Current recommended next operational step: merge the status-map refresh, keep PR #350 blocked behind active My Trees work, then proceed to global CSS hardening implementation in narrow PRs or split any remaining broad work into dedicated issues.
