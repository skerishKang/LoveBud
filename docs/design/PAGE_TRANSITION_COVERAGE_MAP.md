# Page Transition Coverage Map

Refs #242

## Purpose

This document records current active non-editor page transition and upward text reveal coverage before implementation. It is documentation-only and does not add motion assets, page opt-ins, CSS, JavaScript, HTML, or runtime behavior changes.

## Current coverage

| Page | Current transition/reveal coverage | Status |
| --- | --- | --- |
| `index.html` | `.reveal` based scroll reveal exists. | PARTIAL |
| `pages/intro.html` | Tree grow animation exists, but no shared hero text reveal or shared page enter transition. | PARTIAL |
| `pages/login.html` | No shared page enter transition. | MISSING |
| `pages/search.html` | No shared page enter transition. | MISSING |
| `pages/detail.html` | No shared page enter transition. | MISSING |
| `pages/my-trees.html` | No shared page enter transition. | MISSING |

## Direction

Do not add motion directly to `css/global.css`.

Preferred future opt-in assets:

- `css/page-transitions.css`
- `js/page-transitions.js`

Implementation should happen only after documentation and page-type classification. Motion assets should be inert until a page explicitly opts in.

## Risk notes

- Search skeleton must remain visible immediately.
- Detail placeholders must not be hidden from runtime replacement.
- My Trees auth-pending visibility must not regress.
- Login redirect notice and auth modal behavior must not be blocked.
- Motion must respect `prefers-reduced-motion`.
- No overlay or transition may block clicks.
- Transition setup must not delay API, Auth, data loading, or route handling.

## Recommended PR sequence

1. Docs-only coverage map.
2. Shared transition asset-only PR.
3. Home/Intro/Browse opt-in PR.
4. Login/Detail/MyTrees opt-in PR after smoke validation.

## Guardrails

- No `pages/editor.html` changes.
- No Auth runtime changes.
- No Search runtime changes.
- No API/backend changes.
- No prototype/reference/demo/variant changes.
- No PR #7 changes.
- No motion implementation in this docs-only PR.
- No close keyword for Issue #242 unless CTO decides the audit phase is complete.

## Closure note

Issue #242 should remain open unless the CTO decides this docs-only coverage map satisfies the audit phase. This document intentionally uses `Refs #242` and no close keyword.
