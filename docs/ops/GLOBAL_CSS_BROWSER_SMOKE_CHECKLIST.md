# Global CSS Browser Smoke Checklist

Issue: #512

This checklist defines the browser smoke standard for behavior-affecting global CSS work in LoveBud.

It is docs-only. It does not authorize CSS implementation, broad `global.css` rewrites, Search/UI/CSS/JS reorganization, Auth/API/backend changes, package changes, workflow changes, or protected prototype/reference/demo/variant changes.

## Purpose

Global CSS changes can affect many pages at once. Even small selectors for readiness, visibility, focus, layout, or shared controls can regress root navigation, Search/Browse previews, Editor controls, My Trees cards, login forms, or mobile layout.

This checklist creates one reporting standard so future global CSS PRs clearly separate:

- static review,
- desktop browser smoke,
- mobile 375px smoke,
- affected-surface checks,
- `PASS`, `NOT_VERIFIED`, and `BLOCKED` outcomes.

## When this checklist applies

Use this checklist for any PR that changes or may affect:

- `css/global.css`,
- files imported by `css/global.css`,
- global readiness selectors,
- global visibility helpers,
- global focus states,
- shared button/link/form control states,
- shared layout shells,
- first-paint or hidden/reveal behavior,
- Material Symbols or icon readiness behavior,
- any selector that can affect multiple pages.

Docs-only PRs that merely reference global CSS may cite this document without running browser smoke.

## Environment classification

| Change type | Required environment |
| --- | --- |
| Docs-only checklist/disposition | Static review only |
| Static CSS selector inventory | Static review; browser smoke optional |
| Global CSS implementation affecting public static pages | Cloudflare PR Preview or branch preview may be sufficient |
| Global CSS affecting Auth/API/user-state pages | Fixed test slot required |
| Global CSS affecting Editor, My Trees, Search data-backed behavior | Fixed test slot required unless explicitly scoped as public static observation |
| Production observation | Read-only public observation only; do not mutate data |

Do not report `PASS` for runtime-sensitive flows when only static review or PR Preview was used.

## Minimum smoke matrix

### 1. Root and shared chrome

Check:

- home page loads without blank first paint,
- header/nav remains visible and aligned,
- primary CTA remains visible,
- Material Symbols/icons are not hidden or oversized,
- focus-visible state is visible for keyboard navigation where reachable,
- no horizontal overflow at desktop and mobile 375px,
- no fatal console errors.

### 2. Intro/public static pages

Check if affected:

- hero layout remains stable,
- reveal/ready-state behavior does not hide content permanently,
- CTA and navigation remain clickable,
- mobile spacing remains readable,
- no fatal console errors.

### 3. Search/Browse

Check if affected:

- Browse/Search shell renders,
- cards remain visible,
- selected preview remains visible where reachable,
- loading, empty, and error states are not permanently hidden,
- scroll behavior is not hijacked or locked,
- mobile 375px layout has no horizontal overflow,
- distinguish static PR Preview from data-backed fixed-slot verification.

### 4. Editor

Check if affected:

- Editor shell renders,
- empty state remains visible,
- populated tree state remains visible where reachable,
- selected memory/detail state remains visible where reachable,
- forms and buttons are not hidden by global selectors,
- focus states do not break inline edit controls,
- mobile 375px editor smoke is recorded,
- fixed slot is required for Auth/API/runtime-sensitive claims.

### 5. My Trees

Check if affected:

- My Trees page loads after auth where required,
- cards/list states remain visible,
- empty state remains visible,
- CTA buttons remain visible and clickable,
- loading state is not permanently hidden,
- mobile 375px layout has no horizontal overflow,
- fixed slot is required for authenticated/user-data claims.

### 6. Auth/Login

Check if affected:

- login form renders,
- input focus states remain visible,
- submit button remains visible,
- error/help text remains visible where reachable,
- mobile 375px layout remains usable,
- no credential, token, cookie, session, or private payload values are printed in reports.

## PASS / NOT_VERIFIED / BLOCKED rules

Use `PASS` only when the requested behavior was checked in the correct environment.

Use `NOT_VERIFIED` when:

- a surface was not exercised,
- only static review was performed,
- a private/authenticated flow was intentionally excluded,
- fixed slot was required but not used,
- only PR Preview was used for runtime-sensitive behavior,
- a page loaded but the relevant state was not reachable.

Use `BLOCKED` when:

- required fixed slot is unavailable,
- deployed SHA cannot be matched to the PR head,
- auth/test data is unavailable,
- network or deployment issues prevent verification,
- an active overlapping PR owns the same files,
- verification would require exposing private values.

## Required report shape

Use this report shape for future behavior-affecting global CSS PRs.

```text
Global CSS Browser Smoke Report

1. PR number:
2. Branch:
3. Head SHA:
4. Changed files:
5. Environment used:
6. Fixed slot required: YES / NO
7. Fixed slot used:
8. Deployed SHA match: YES / NO / NOT_VERIFIED
9. Desktop root/shared chrome:
10. Mobile 375px root/shared chrome:
11. Search/Browse:
12. Editor:
13. My Trees:
14. Auth/Login:
15. PASS:
16. NOT_VERIFIED:
17. BLOCKED:
18. Fatal console errors:
19. Secret/private value exposure: NONE / STOP_AND_REPORT
20. Final recommendation:
```

## Relationship to #418

#512 is the verification/disposition layer for behavior-affecting global CSS work after #418 planning and PR #508 ready-state implementation.

#418 can only be closed separately if its completed planning and implementation work is accepted. This checklist does not itself implement global CSS changes.

## Closure criteria for #512

#512 can be closed when:

- a global CSS browser smoke checklist exists,
- desktop and mobile 375px smoke expectations are documented,
- root/shared chrome checks are documented,
- Search/Browse, Editor, My Trees, and Auth/Login regression checks are documented,
- `PASS`, `NOT_VERIFIED`, and `BLOCKED` reporting rules are documented,
- fixed-slot requirements are documented for runtime-sensitive flows,
- the change remains docs-only.

## Guardrails

- Docs-only.
- No CSS implementation.
- No broad `global.css` rewrite.
- No Search/UI/CSS/JS reorganization.
- No Auth/API/backend/package/workflow changes.
- No PR #7/prototype/reference/demo/variant changes.
- No PR #450 changes.
- No `css/editor/status-settings.css` changes.
- No `css/editor/overrides.css` changes.
- No `css/editor.css` changes.
- No PR #527 changes.
- No Issue #513 changes.
