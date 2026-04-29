# Page Transition Reveal Coverage Map

> **Docs-only. Coverage audit only.**
> This document maps the current page enter transition and upward text reveal coverage across active non-editor pages.
> No CSS or JS transition assets are created or modified by this document.
> No `css/page-transitions.css` or `js/page-transitions.js` exists yet.
> Any implementation requires separate CTO approval and smoke verification.

---

## 1. Current Coverage

### Coverage Status by Page

| Page | File | Page Enter Transition | Upward Text Reveal | Notes |
|------|------|----------------------|-------------------|-------|
| **Home** | `index.html` | ✅ Exists | ✅ Exists | Reveal coverage already present |
| **Intro / Tree Grow** | `pages/intro.html` | ⚠️ Tree grow animation only | ❌ No shared hero text reveal | Page-specific animation; not part of shared reveal system |
| **Login** | `pages/login.html` | ❌ None | ❌ None | No shared page enter transition |
| **Search / Browse** | `pages/search.html` | ❌ None | ❌ None | No shared page enter transition |
| **Detail** | `pages/detail.html` | ❌ None | ❌ None | No shared page enter transition |
| **My Trees** | `pages/my-trees.html` | ❌ None | ❌ None | No shared page enter transition |
| **Editor** | `pages/editor.html` | — Out of scope | — Out of scope | Editor excluded from this audit |

### Coverage Summary

- **Covered:** `index.html` (home) — shared reveal system is live here.
- **Partial / page-specific only:** `pages/intro.html` — tree grow animation is custom, not the shared reveal system.
- **Not covered:** `login`, `search`, `detail`, `my-trees` — no shared page enter transition or upward text reveal.

---

## 2. Page Risk Classification

### 2.1 Low-Risk — Public / Static Pages

Pages with no auth dependency and minimal or predictable data loading. Safest candidates for opt-in reveal.

| Page | Risk | Rationale |
|------|------|----------|
| `index.html` (Home) | ✅ Already covered | Reveal live; no additional risk |
| `pages/intro.html` | 🟡 Low | Static content; tree grow animation is self-contained. Text reveal can be added without data-load conflict. |

### 2.2 Data-Loaded Pages

Pages where content is populated asynchronously after DOM load. Reveal must not start before skeleton/placeholder is visible.

| Page | Risk | Rationale |
|------|------|----------|
| `pages/search.html` | 🟠 Medium | Search skeleton must remain visible during data load. Reveal must not obscure skeleton or block result rendering. Data load timing interaction requires explicit smoke test. |
| `pages/detail.html` | 🟠 Medium | Placeholder-driven layout. Detail tree data loads asynchronously. Reveal must not cause placeholder flicker or incorrect opacity state before data arrives. |

### 2.3 Auth-Sensitive Pages

Pages where auth state determines visible content or redirect behavior. Reveal must not interfere with auth guard execution.

| Page | Risk | Rationale |
|------|------|----------|
| `pages/login.html` | 🔴 High | Auth flow entry point. Any page-level animation that delays or obscures the login form risks confusing returning users or breaking auth redirect timing. |
| `pages/my-trees.html` | 🔴 High | Auth-pending state is a first-class UX state. Reveal must not render user-specific content before auth resolves. Auth-pending smoke test required before any reveal opt-in. |

### 2.4 Placeholder-Driven Detail Pages

`pages/detail.html` is both data-loaded and placeholder-driven. The tree structure is rendered incrementally as data arrives. Any reveal animation applied to placeholder elements must be verified to not:
- Cause a double-flash (placeholder reveal + data-populated re-render)
- Leave elements in a partially revealed opacity state if data load is slow or fails
- Conflict with existing skeleton or loading shimmer styles

---

## 3. Motion Guardrails

All page transition / reveal implementation must comply with these guardrails.

### 3.1 No Motion in global.css Directly

- Page transition and reveal animation rules must **not** be added to `global.css`.
- A dedicated `css/page-transitions.css` file (created in a future asset-only PR) is the correct location.
- `global.css` changes require their own review scope and are out of bounds for transition work.

### 3.2 prefers-reduced-motion Required

- Every animation or transition added must include a `@media (prefers-reduced-motion: reduce)` block that disables or replaces the animation with an instant state change.
- This is a non-negotiable accessibility requirement.

```css
/* Example pattern — not implemented yet */
@media (prefers-reduced-motion: reduce) {
  .page-enter-reveal {
    animation: none;
    opacity: 1;
    transform: none;
  }
}
```

### 3.3 No Overlay Blocking Clicks

- No transition overlay (`position: fixed`, `z-index` cover layer) may block user interaction.
- Any enter animation must use `opacity` / `transform` on content elements only.
- `pointer-events: none` must be set on any transitional wrapper during animation and removed on completion.

### 3.4 Search Skeleton Must Remain Visible

- On `pages/search.html`, the search skeleton (loading state) must be visible during data fetch.
- Reveal animation must not set the skeleton container to `opacity: 0` before data arrives.
- Reveal must trigger only after the data-loaded state is confirmed, or must apply only to above-skeleton hero/header elements.

### 3.5 Detail Placeholders Must Not Flicker Incorrectly

- On `pages/detail.html`, placeholder elements are populated in multiple async steps.
- Reveal animation must not cause a visible flicker between: placeholder render → reveal animation start → data replace.
- Safe approach: apply reveal only to stable non-placeholder structural elements (page header, breadcrumb) and leave tree content area untouched until data is confirmed.

### 3.6 My Trees Auth-Pending Behavior Must Remain Intact

- `pages/my-trees.html` shows an auth-pending state while Firebase Auth resolves.
- Page reveal must not execute before auth state is determined.
- The auth guard callback is the correct trigger point for any reveal on this page.
- If reveal fires before auth resolves, users may see a flash of authenticated content before being redirected.

---

## 4. Recommended PR Sequence

| PR | Scope | Prerequisite |
|----|-------|--------------|
| **PR A — This PR** | Coverage map docs only | None |
| **PR B** | Shared transition asset-only PR — create `css/page-transitions.css` and `js/page-transitions.js` with base classes and `prefers-reduced-motion` support. No page opt-in yet. | PR A merged + CTO approval |
| **PR C** | Home / Intro / Browse opt-in — add reveal class to `index.html` and `pages/intro.html` only. Smoke: home static, intro tree grow still works, search skeleton visible. | PR B merged + smoke pass |
| **PR D** | Login / Detail / My Trees opt-in — auth-sensitive and data-loaded pages. Requires auth-pending smoke, detail placeholder smoke, login auth flow smoke. | PR C merged + smoke pass + CTO approval |

> **No PR B or later may begin without explicit CTO approval.**
> PR sequence is sequential; no parallel opt-in PRs allowed.

---

*Last updated: 2026-04-29*
*Scope: docs-only, coverage audit, no CSS/JS/HTML/runtime changes*
*Related: Refs #242, Refs #239*
