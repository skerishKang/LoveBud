# Active Page UX Consistency Roadmap

Refs #239

## Purpose

This document records the pre-implementation active page UX consistency audit and roadmap for LoveBud. It is documentation-only and does not authorize CSS, JavaScript, HTML, runtime, Auth, API, Search, My Trees, or Editor changes.

## Active page scope

Included active pages:

- `index.html`
- `pages/intro.html`
- `pages/search.html`
- `pages/my-trees.html`
- `pages/detail.html`
- `pages/login.html`
- `pages/settings.html` for classification only

Excluded surfaces:

- `pages/editor.html`
- PR #7
- prototype / reference / demo / variant paths
- preserved reference assets such as `quiet/**`, `hotspot-prototype/**`, `scrapbook-demo/**`, and equivalent historical design experiments

## Page type classification

| Page | Classification | Notes |
| --- | --- | --- |
| `index.html` | Brand Hero | Current visual source of truth. |
| `pages/intro.html` | Brand Hero | Structurally close to Home, but product-facing copy should prefer `러브트리` over generic `나무`. |
| `pages/search.html` | Browse Header | Needs heading and eyebrow hierarchy audit before CSS work. |
| `pages/my-trees.html` | Workspace Header | Should read as an emotional record space, not as a generic dashboard. |
| `pages/detail.html` | Detail Hero | Should remain a detail-focused page, not an oversized Brand Hero. |
| `pages/login.html` | Auth Card Entry | Auth flow should remain stable while copy aligns with product language. |
| `pages/settings.html` | Settings Modal/Card Entry | Classification only; runtime/history behavior belongs in a separate bug path. |

## Current findings

- Home is the current visual source of truth for active page tone, rhythm, and brand presence.
- Intro is visually related to Home but weakens brand language when it uses generic `나무` where product-facing copy should say `러브트리`.
- Search/Browse has a Browse Header role, but the heading hierarchy and eyebrow treatment need a focused audit before implementation.
- My Trees should align with the emotional record and memory-space framing rather than generic dashboard language.
- Detail should retain its detail-first role and avoid being promoted into a large Brand Hero pattern.
- Login may adopt product language while preserving auth entry behavior and redirect flows.
- Settings runtime/history bugs are outside this visual consistency roadmap.
- Shared page enter and upward text reveal are not consistently applied across active non-editor pages.

## Product language rules to preserve

Use product-facing language consistently where the user is learning, browsing, or returning to their own records:

- `러브트리`
- `첫 순간`
- `이어진 마음`
- `감정 경로`

Avoid generic language that dilutes the product identity when the page is product-facing. Generic terms may remain where a technical or neutral context needs them.

## Recommended PR sequence

1. Copy-only Intro hero brand alignment.
2. Copy-only Search, My Trees, and Login heading refinement.
3. Heading token and CSS hierarchy PR.
4. Shared page transition/reveal asset PR.
5. Low-risk opt-in transition application.
6. Auth/data-sensitive opt-in after smoke validation.

## Guardrails

- No runtime behavior changes.
- No Auth/API/Search/MyTrees JavaScript changes in copy-only PRs.
- No `pages/editor.html` changes.
- No PR #7 changes.
- No prototype/reference/demo/variant path changes.
- No broad CSS redesign.
- No global motion injection.
- Keep copy, CSS token, runtime routing, and motion changes split into separate PRs.

## Closure note

Issue #239 should remain open until the CTO decides the roadmap and follow-up implementation split satisfy the tracking goal. This document intentionally uses `Refs #239` and no close keyword.
