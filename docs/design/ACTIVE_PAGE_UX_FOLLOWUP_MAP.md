# Active page UX follow-up map

Refs #239

## Purpose

This document refreshes the Issue #239 active page UX consistency follow-up map without changing CSS, HTML, JavaScript, runtime behavior, or page markup.

Issue #239 remains a planning and tracking issue for page-level copy, heading, hierarchy, and motion consistency. This document does not authorize implementation.

## Scope

Map active pages by page type and split future work into safe PR units:

- copy-only PRs
- CSS token / heading hierarchy PRs
- motion / reveal asset PRs
- opt-in application PRs with browser smoke where runtime-sensitive

## Non-goals

- No CSS changes.
- No JS changes.
- No HTML/page markup changes.
- No runtime/Auth/API/Search/MyTrees changes.
- No `pages/editor.html` changes.
- No PR #7/prototype/reference/demo/variant changes.
- No global motion rollout from this document.

## Active page classification

| Page | Page type | Follow-up focus | Implementation guardrail |
|---|---|---|---|
| `index.html` | Brand Hero | Source-of-truth tone and visual hierarchy | Treat as reference baseline; avoid broad restyling. |
| `pages/intro.html` | Brand Hero | Copy alignment with LoveTree language | Prefer copy-only PR before CSS changes. |
| `pages/search.html` | Browse Header | Browse/Search heading hierarchy and eyebrow/copy audit | Do not change Search runtime modules in design/copy PRs. |
| `pages/my-trees.html` | Workspace Header | Reduce dashboard-like wording and align with emotional record space | Keep data/Auth behavior unchanged. |
| `pages/detail.html` | Detail Hero | Keep detail-specific hierarchy distinct from Brand Hero | Do not expand into full Brand Hero without design approval. |
| `pages/login.html` | Auth Card Entry | Product-language copy and accessibility copy polish | Do not change Auth provider behavior in copy-only PRs. |
| `pages/settings.html` | Settings Modal/Card Entry | Classification only; navigation/runtime bugs stay separate | Do not combine route/history fixes with UX consistency work. |
| `pages/editor.html` | Excluded | Out of #239 implementation scope | Editor remains excluded from active page UX consistency PRs. |

## Recommended PR sequence

1. `copy(intro): align hero brand language`
   - Allowed: Intro copy only.
   - Forbidden: CSS, runtime, page routing, PR #7/prototype/reference/demo/variant.

2. `copy(search): refine browse heading language`
   - Allowed: Search heading/copy text only if approved.
   - Forbidden: Search API, adapter, renderer, state, or event behavior.

3. `copy(my-trees): align workspace heading language`
   - Allowed: heading/subcopy only.
   - Forbidden: Auth-gated data flow, tree CRUD behavior.

4. `css(pages): define active page heading hierarchy tokens`
   - Allowed: narrow token or page-heading CSS after audit.
   - Forbidden: broad global CSS rewrite or visual redesign.

5. `ux(motion): add opt-in page transition reveal assets`
   - Allowed: reusable transition/reveal asset only.
   - Forbidden: automatic application to all pages.

6. `ux(motion): apply transition reveal to low-risk pages`
   - Allowed: opt-in low-risk page application after smoke plan.
   - Forbidden: Auth/API/data-sensitive pages without Cloudflare Preview or fixed slot verification.

7. `ux(motion): apply transition reveal to auth/data-sensitive pages`
   - Allowed: only after stable smoke matrix.
   - Forbidden: local-only PASS for Auth/API/data-loaded pages.

## Copy and token split rule

Do not combine these concerns in one PR unless CTO explicitly approves:

- copy language changes;
- CSS hierarchy tokens;
- motion asset creation;
- page-level motion application;
- runtime route/history fixes;
- Search/MyTrees/Auth data behavior.

## Browser verification policy

Static copy or docs-only PRs may be reviewed with GitHub diff and static preview.

Any PR touching Auth/API/data-loaded pages must use the project verification policy:

- Cloudflare Pages PR Preview URL when available;
- fixed test slot where PR Preview is insufficient;
- production only after merge and deployment.

## Closure note

This document supports Issue #239 planning and follow-up sequencing. It does not complete all #239 implementation work by itself.

Issue #239 can move toward phase closure only after CTO decides that roadmap and follow-up sequencing are sufficient, or after linked implementation PRs complete the agreed copy/CSS/motion steps.
