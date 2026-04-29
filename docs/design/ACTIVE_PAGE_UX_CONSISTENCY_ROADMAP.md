# Active Page UX Consistency Roadmap

## Purpose

This document records the active-page UX consistency roadmap for Issue #239 before implementation begins.

The goal is to align heading hierarchy, hero/header treatment, page copy, and motion/reveal behavior across operating pages without mixing documentation, copy, CSS, motion, or runtime changes in one PR.

This roadmap is planning-only. It does not approve direct implementation, page edits, CSS changes, JavaScript changes, runtime changes, or prototype/reference/demo cleanup.

## Page Scope

The active-page scope for this roadmap is:

- `index.html`
- `pages/intro.html`
- `pages/search.html`
- `pages/my-trees.html`
- `pages/detail.html`
- `pages/login.html`
- `pages/settings.html` classification only

`pages/settings.html` is included for classification so future card/modal entry behavior can be aligned, but it should not be treated as a broad first-phase implementation target without a separate plan.

## Excluded Scope

The following are explicitly excluded from this roadmap's implementation phases unless a separate CTO-approved task says otherwise:

- `pages/editor.html`
- PR #7
- prototype/reference/demo/variant paths
- quiet/hotspot/scrapbook demo/reference assets
- editor-specific quiet-first work
- runtime, data loading, auth, API, Modal, or database behavior

## Page Type Classification

| Page type | Pages | Primary UX role | Notes |
| --- | --- | --- | --- |
| Brand Hero | `index.html`, `pages/intro.html` | Brand entry, first impression, product positioning | Copy and hero rhythm should feel aligned without duplicating the exact layout. |
| Browse Header | `pages/search.html` | Discovery/browse entry | Must not interfere with search skeletons, result loading, preview behavior, or API-driven state. |
| Workspace Header | `pages/my-trees.html` | Authenticated owner workspace entry | Must preserve auth-pending behavior, loading/error/empty/loaded states, and create-tree flows. |
| Detail Hero | `pages/detail.html` | Public tree detail entry | Must preserve placeholder and hydrate behavior. |
| Auth Card Entry | `pages/login.html` | Authentication entry | Must preserve redirect target handling and auth boot behavior. |
| Settings Modal/Card Entry | `pages/settings.html` | Account/settings control surface | Classification only until a dedicated settings pass is approved. |

## Work Breakdown

### 1. Docs/design roadmap

Create this roadmap as the planning baseline for Issue #239.

Scope:

- Document active page types.
- Separate implementation phases.
- Define guardrails for future copy, CSS, and motion work.

Non-goals:

- No page HTML changes.
- No CSS changes.
- No JavaScript changes.
- No runtime behavior changes.

### 2. Copy-only Intro brand alignment

Recommended future PR type: copy-only.

Scope:

- Align `index.html` and `pages/intro.html` brand positioning.
- Keep layout and runtime unchanged.
- Avoid broad hero redesign.

Validation:

- Changed files limited to relevant page copy only.
- No CSS/JS/runtime changes.
- Browser smoke for landing and intro pages.

### 3. Copy-only Search/My Trees/Login heading refinement

Recommended future PR type: copy-only and page-specific.

Scope:

- Refine heading/subheading language for:
  - `pages/search.html`
  - `pages/my-trees.html`
  - `pages/login.html`
- Preserve current state containers, auth behavior, redirect behavior, and API/data loading.

Validation:

- No selector changes.
- No CSS/JS changes.
- Search and my-trees state behavior smoke required after copy changes.

### 4. Heading token/CSS hierarchy

Recommended future PR type: CSS-only after copy baseline is reviewed.

Scope:

- Define narrow heading hierarchy rules for active pages.
- Prefer page-scoped CSS over broad global rules.
- Avoid `css/global.css` motion or heading rewrites unless explicitly approved.

Validation:

- Changed files limited to approved page CSS files.
- Desktop and mobile visual smoke for each opted-in page.
- No runtime/API/Auth changes.

### 5. Shared transition/reveal asset PR

Recommended future PR type: asset-only.

Scope:

- Add shared transition/reveal assets only.
- Keep assets inert unless a page explicitly opts in.
- Respect `prefers-reduced-motion`.
- Avoid overlays and pointer-event blocking.

Relation:

- This is tracked primarily under Issue #242.
- PR #294 is the asset-only transition work and must not close Issue #239.

### 6. Low-risk page opt-in

Recommended future PR type: page-specific opt-in after shared assets exist.

Candidate pages:

- `index.html`
- `pages/intro.html`

Scope:

- Opt in only low-risk static/brand pages first.
- Avoid Search, My Trees, Detail, Login, and Settings until static pages pass smoke.

Validation:

- Desktop/mobile visual smoke.
- Reduced-motion behavior check.
- No click-blocking or delayed interaction.

### 7. Auth/data-sensitive page opt-in after smoke validation

Recommended future PR type: one page or one page group at a time.

Candidate pages:

- `pages/search.html`
- `pages/my-trees.html`
- `pages/detail.html`
- `pages/login.html`
- `pages/settings.html` only after dedicated settings approval

Required guardrail:

- Do not mask loading, auth-pending, skeleton, placeholder, error, empty, or loaded states.
- Do not delay API/data/auth execution.
- Do not add blocking overlays.
- Do not alter route, redirect, or event behavior.

## Guardrails

- No broad CSS changes.
- No runtime changes.
- No `css/global.css` motion implementation without explicit approval.
- No editor changes.
- No prototype/reference/demo/variant changes.
- No PR #7 changes.
- Split copy, CSS, motion, and runtime work into separate PRs.
- Keep each page opt-in small and independently verifiable.
- Do not mix Issue #239 UX consistency work with Issue #242 transition coverage implementation unless explicitly approved.
- Do not mix this work with Search/Auth/MyTrees/Editor/API/Modal implementation changes.

## Relation to Issue #242

Issue #242 handles page transition/reveal coverage and the motion asset/application sequence.

Issue #239 remains the parent UX consistency tracker for active-page heading, hero, copy, and visual rhythm alignment.

Therefore:

- #242 documentation and motion asset PRs should not close #239.
- PR #294 should not close #239.
- Future #242 page opt-in phases should be referenced from #239 only when they materially affect active-page UX consistency.
- #239 implementation should still split copy, heading hierarchy, and page motion adoption into separate PRs.

## Open Implementation Queue

Recommended order:

1. Merge docs-only roadmap after review.
2. Complete shared transition/reveal asset work under #242.
3. Run copy-only brand alignment for `index.html` and `pages/intro.html`.
4. Run copy-only heading refinements for Search/My Trees/Login.
5. Add narrow heading hierarchy CSS after copy settles.
6. Opt in static Brand Hero pages to shared reveal assets.
7. Opt in data/auth-sensitive pages only after smoke validation.

## Non-Closure Note

Issue #239 should remain open after this document lands because the implementation phases are still pending.
