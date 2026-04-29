# Shared Header Config Helper Extraction Decision

**Status:** DECISION_RECORD
**Related:** Issue #223
**Scope:** `js/shared-header.js` helper/config extraction decision only
**Decision:** Defer immediate helper extraction; keep current runtime behavior unchanged

---

## 1. Purpose

This document records the engineering decision for the shared header config/helper extraction item in Issue #223.

The current shared header file owns markup generation and header-specific behavior. Its present size and responsibility shape do not require an immediate extraction PR. The preferred path is to defer extraction until clear complexity triggers appear or until header behavior tests are available.

This decision record is docs-only. It does not modify `js/shared-header.js`, page markup, CSS, Auth handoff, mobile navigation, language behavior, or runtime behavior.

---

## 2. Current Shared Header Responsibility Summary

`js/shared-header.js` currently owns these surfaces.

### 2.1 Render

- Builds the shared header markup for root and `pages/` contexts.
- Renders navigation links and active menu state.
- Renders the LoveTree logo link.
- Renders the auth container expected by the Auth layer.
- Renders cached confirmed-session user avatar markup when available.

### 2.2 Mobile Navigation

- Binds the mobile nav toggle button.
- Opens and collapses the mobile nav panel.
- Collapses the panel on outside click.
- Collapses the panel after nav link/button interaction on mobile width.

### 2.3 Language Toggle

- Renders the language toggle markup.
- Binds the language dropdown trigger and options.
- Calls existing language globals such as `setCurrentLang`, `applyI18n`, and `triggerLangChange` when available.
- Re-renders the shared header on `lovebud-lang-change`.

### 2.4 Auth Handoff

- Preserves `#auth-nav` and `#auth-nav-container` handoff points.
- Calls `window.initAuth()` after dynamic header render when available.
- Uses confirmed auth cache only for immediate header display.
- Leaves final Auth state reconciliation to the Auth modules.

### 2.5 Path and Context Helpers

- Detects current page and root/pages context.
- Generates context-aware nav links.
- Computes settings return targets.
- Adjusts settings links with `returnTo` when appropriate.
- Computes login redirect links for protected destinations.

---

## 3. Extraction Candidate Decision

### 3.1 Candidate: Static Config and Path Helpers

Potential extraction targets:

- `MENU_CONFIG`
- `PAGE_ACTIVE_MAP`
- `getCurrentPage()`
- `getContextType()`
- `isEditorPage()`
- `isLoginPage()`
- `isSettingsPath()`
- `getCurrentReturnToTarget()`
- `appendSettingsReturnTo()`
- `getLoginRedirectHref()`

These are valid future extraction candidates because they are comparatively pure and could be moved without changing header behavior if adequate coverage exists.

### 3.2 Immediate Extraction Decision

Immediate extraction is deferred.

Rationale:

- The current file size is acceptable relative to the repository's thin-entrypoint policy and current risk profile.
- Responsibilities are cohesive around shared header rendering and header-specific behavior.
- The file does not currently block more urgent Issue #223 work such as API route mapping contracts or Cloudflare/Modal boundary hardening.
- The shared header has Auth, language, mobile nav, cached session, and path-context coupling. A premature helper split would add script-order and browser-global surface area before behavior tests exist.
- PR #330 already captured inline handler/style concerns as an audit path. This decision record should not combine with CSP or inline handler implementation work.

### 3.3 Defer Conditions

Extraction remains deferred while all of the following are true:

- `js/shared-header.js` remains a cohesive owner of header render and header-specific behavior.
- Config/path helper duplication does not spread into page scripts or other modules.
- Header behavior remains easy to review in a single file.
- No change requires a separate reusable header path/context API.
- Browser smoke remains the primary protection for header changes.

---

## 4. Guardrails

Any future shared header extraction PR must preserve these guardrails:

- Do not change `window.initAuth()` handoff timing or semantics.
- Do not rename or remove `#auth-nav` or `#auth-nav-container` contracts without a separate Auth migration decision.
- Do not change mobile nav open, collapse, outside-click, or link-click behavior.
- Do not change language toggle dropdown behavior or `lovebud-lang-change` refresh behavior.
- Do not change confirmed-session cache display semantics.
- Do not combine config/helper extraction with CSP hardening.
- Do not combine config/helper extraction with inline handler/style cleanup.
- Do not modify PR #7 or prototype/reference/demo/variant paths.
- Do not broaden into page, CSS, Auth, API, or runtime changes.

---

## 5. Follow-up Trigger

A future extraction PR becomes justified if one or more of these triggers appear.

### 5.1 File Size or Complexity Threshold

Consider extraction if `js/shared-header.js` materially grows beyond its current cohesive role, for example:

- navigation config expands into multiple feature-flagged variants;
- auth placeholder rendering gains multiple states;
- language toggle behavior becomes multi-component;
- settings return logic is reused outside shared header;
- the file becomes difficult to review as a single unit.

### 5.2 Repeated Path Helper Duplication

Consider extraction if multiple files start duplicating:

- root vs `pages/` path detection;
- settings return target generation;
- protected-link login redirect generation;
- active menu mapping.

At that point, a small `shared-header-config` or `shared-header-paths` helper may reduce duplication without changing behavior.

### 5.3 Header Behavior Contract Test Availability

Prefer extraction after tests or smoke coverage can verify:

- root page nav link generation;
- pages-context nav link generation;
- active menu state;
- login page auth container variant;
- confirmed-session cached avatar render;
- settings `returnTo` preservation;
- mobile nav toggle/collapse;
- language toggle option handling;
- `window.initAuth()` post-render handoff.

### 5.4 Browser Smoke Matrix

Before any implementation extraction, run at least this browser smoke matrix:

| Area | Scenario | Expected result |
|---|---|---|
| Root header | `/index.html` or `/` | Header renders, logo/home/search/my-trees links use root-safe paths |
| Pages header | `/pages/search.html` | Header renders, active Search state is preserved |
| Detail header | `/pages/detail.html` | Search nav remains active for detail context |
| Login page | `/pages/login.html` | Uses `#auth-nav-container`; no duplicate auth render |
| Settings page | `/pages/settings.html` | Settings link does not create recursive `returnTo` |
| Cached session | Confirmed auth cache present | Cached avatar appears before Auth reconciliation |
| No session | Confirmed auth cache absent | Auth placeholder renders and later Auth handoff can replace it |
| Mobile nav | Width <= 768px | Toggle opens/collapses panel, link click collapses panel |
| Language toggle | Language option selected | Existing language globals run and header refreshes |
| Auth handoff | `window.initAuth()` available | Header render invokes Auth handoff without fatal error |

Runtime/Auth smoke should use the project's URL provenance and fixed-slot rules when browser state, API, or Auth behavior is involved.

---

## 6. Recommended Current Action

Current recommendation:

- Do not implement shared header config/helper extraction now.
- Record this item as deferred with explicit triggers.
- Keep Issue #223 focused on higher-impact runtime boundary and contract work.
- Revisit extraction only when the follow-up triggers in this document are met.

This preserves implementation bandwidth and avoids introducing new script-order or browser-global surfaces before the header has dedicated behavior coverage.

---

## 7. Completion Checklist for This PR

- [ ] Decision document added under `docs/engineering/`.
- [ ] Optional engineering index link added only if there is no collision risk.
- [ ] No `js/shared-header.js` change.
- [ ] No page, CSS, Auth, API, or runtime change.
- [ ] No CSP or inline handler implementation work.
- [ ] No issue state change.
- [ ] PR #7 untouched.
