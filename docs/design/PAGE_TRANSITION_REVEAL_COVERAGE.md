# Page Transition Reveal Coverage

## Purpose

Document current page transition and upward text reveal coverage before any shared transition implementation.

This document is audit/design-only. It does not add `css/page-transitions.css`, `js/page-transitions.js`, page opt-in markup, runtime behavior, or motion code.

Related issues:

- Parent UX roadmap: #239
- Coverage issue: #242

---

## Current problem

Active non-editor pages do not yet share a consistent page enter transition or upward text reveal system.

The current state is uneven:

- Home has a reveal pattern.
- Intro has page-specific tree growth motion.
- Login, Search, Detail, and My Trees do not share a common page enter/reveal system.

---

## Page coverage map

| Page | Page type | Current reveal / transition coverage | Risk level | Recommended next action |
|---|---|---|---|---|
| `index.html` | Brand Hero | Has `.reveal` based scroll reveal | Low | Use as one reference input, not necessarily exact global source |
| `pages/intro.html` | Brand Hero | Has tree grow animation; lacks shared hero text reveal | Low-medium | Candidate for first low-risk opt-in after shared assets exist |
| `pages/search.html` | Browse Header | No shared page enter transition | Medium | Delay until skeleton/data loading visibility is protected |
| `pages/detail.html` | Detail Hero | No shared page enter transition | Medium | Delay until placeholder replacement behavior is protected |
| `pages/my-trees.html` | Workspace Header | No shared page enter transition | Medium-high | Delay until auth-pending visibility behavior is protected |
| `pages/login.html` | Auth Card Entry | No shared page enter transition | Medium-high | Delay until redirect/auth modal behavior is protected |
| `pages/settings.html` | Settings Modal/Card Entry | Not first transition target | High | Keep separate from settings routing/history bugs |
| `pages/editor.html` | Editor workspace | Excluded | N/A | Do not include in this motion system |

---

## Recommended architecture

Preferred opt-in assets:

- `css/page-transitions.css`
- `js/page-transitions.js`

Do not add shared motion directly to `css/global.css`.

The motion system should be opt-in per page so runtime-sensitive pages can defer adoption.

---

## Required motion constraints

Any future implementation must:

- respect `prefers-reduced-motion`
- avoid blocking clicks or form input
- avoid full-page overlays
- keep Search skeleton visible immediately
- avoid delaying Detail placeholder replacement
- avoid changing My Trees auth-pending behavior
- avoid changing Login redirect/auth modal behavior
- avoid touching `pages/editor.html`
- avoid prototype/reference/demo/variant paths

---

## Candidate reveal primitives

### Page enter container

Use for low-risk static or mostly-static surfaces.

Candidate semantic class names:

- `.page-transition-root`
- `.page-enter-ready`
- `.page-enter-active`

### Upward text reveal

Use for headings, lead copy, and hero text blocks.

Candidate semantic class names:

- `.reveal-up`
- `.reveal-up-delay-1`
- `.reveal-up-delay-2`

### Reduced motion fallback

When `prefers-reduced-motion: reduce` is active:

- no transform animation
- no delayed opacity dependency
- content must be immediately visible

---

## Suggested PR sequence

1. **Docs-only coverage map** — this document.
2. **Shared transition asset-only PR** — add CSS/JS assets but do not opt in every page.
3. **Low-risk opt-in PR** — Home/Intro/Browse only if Search skeleton remains visible.
4. **Data/auth-sensitive opt-in PR** — Login/Detail/My Trees only after smoke validation.

---

## First implementation candidate

The first implementation PR should not attempt broad rollout.

Recommended first asset-only scope:

- add `css/page-transitions.css`
- add `js/page-transitions.js`
- include reduced-motion behavior
- include no page-specific runtime changes beyond explicit opt-in if CTO approves

Recommended first opt-in pages:

1. `index.html`
2. `pages/intro.html`

Search, Detail, My Trees, Login, and Settings should wait until runtime-specific smoke criteria are defined.

---

## Smoke criteria for later implementation

### Static/brand pages

- page content visible without JavaScript
- no horizontal overflow
- reduced motion honored
- primary CTA clickable immediately

### Search/Browse

- skeleton or loading state visible immediately
- data loading not delayed
- preview selection behavior unchanged
- no fatal console errors

### Detail

- placeholder state visible immediately
- runtime content replacement unaffected
- media/video handling unaffected

### My Trees

- auth-pending state visible/handled as before
- no redirect flicker regression
- tree cards/actions unaffected

### Login

- redirect notice behavior unchanged
- auth modal/controller behavior unchanged
- form inputs remain usable immediately

---

## Non-goals

- No Editor changes
- No Auth runtime changes
- No Search runtime changes
- No API/backend changes
- No CSS/JS implementation in this PR
- No direct `global.css` motion injection
- No prototype/reference/demo/variant changes

---

## Acceptance criteria for this docs stage

- Page coverage is documented.
- Page risk levels are separated.
- Opt-in architecture is defined.
- Runtime-sensitive pages are deferred.
- Future implementation PRs can be scoped safely.

---

Refs #242
Refs #239
