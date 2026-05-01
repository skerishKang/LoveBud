# Global CSS hardening implementation plan

Refs #418

## Purpose

This document records the first docs-only planning step for Issue #418, following the CSS/HTML cleanup backlog disposition from Issue #137 and Issue #399.

The goal is to define a narrow, verifiable implementation sequence for global CSS hardening before any CSS, HTML, JavaScript, runtime, Auth, API, backend, package, or workflow changes are made.

This PR is planning-only. It does not implement global CSS changes.

## Scope

This plan covers future implementation boundaries for:

- `css/global.css` token consistency.
- Global ready-state behavior.
- Material Symbols ready-class consistency.
- Shared focus and visibility behavior.
- Global selectors that may unintentionally affect Search/Browse, Editor, or My Trees.
- Browser smoke requirements for behavior-affecting CSS changes.

## Current risk areas

| Risk area | Why it matters | Planning boundary |
|---|---|---|
| `css/global.css` token consistency | Global tokens can affect every page, including Search/Browse, Editor, My Trees, Auth, and shared navigation. | Audit and adjust one token family at a time. Do not rewrite the file broadly. |
| Ready-state class behavior | Ready-state selectors can affect initial render, transitions, layout visibility, and perceived loading behavior. | Treat any ready-state change as behavior-affecting CSS requiring browser smoke. |
| Material Symbols ready-class consistency | Icon font readiness can produce layout shift, invisible icons, or inconsistent fallback behavior. | Keep any future change narrow to symbol readiness and verify pages that render shared navigation/icons. |
| Shared focus behavior | Global focus selectors can improve keyboard visibility but may unintentionally change button, card, chip, editor, or modal states. | Harden only one selector group per PR and check keyboard-visible focus behavior. |
| Shared visibility behavior | Generic hidden/visible/display selectors can accidentally suppress page content, previews, empty states, or editor controls. | Require Search/Browse, Editor, and My Trees regression checks when selector scope is global. |
| Broad global selectors | Selectors such as generic `button`, `a`, `[hidden]`, `.ready`, `.is-*`, or layout utility classes can cascade into page-specific CSS. | Prefer narrow selector hardening and document affected surfaces before implementation. |

## Non-goals

- No broad `global.css` rewrite.
- No Search/UI/CSS/JS reorganization.
- No page-specific redesign.
- No CSS implementation in this planning PR.
- No HTML implementation in this planning PR.
- No JavaScript implementation in this planning PR.
- No runtime behavior change without browser smoke.
- No Auth/API/backend/database/package/workflow changes.
- No PR #7/prototype/reference/demo/variant changes.
- No PR #450/YouTube PoC file changes.

## Proposed PR split

### PR A: global token/readiness audit

Purpose:

- Inventory `css/global.css` token groups and readiness selectors.
- Identify which token/readiness selectors are safe, duplicated, stale, or ambiguous.
- Produce a narrow implementation candidate list without changing CSS behavior unless separately approved.

Allowed future implementation shape:

- One token family or readiness selector group per PR.
- Static CSS review plus page-impact notes.
- Browser smoke if any selector can alter visibility, animation, first paint, or page readiness.

Forbidden combinations:

- Do not combine token cleanup with Search/Browse CSS changes.
- Do not combine token cleanup with Editor or My Trees redesign.
- Do not combine with JS readiness logic changes.

### PR B: Material Symbols ready-class consistency

Purpose:

- Align Material Symbols ready-class usage where global CSS and loaded font state interact.
- Reduce icon flash, layout shift, or hidden-icon inconsistency without altering page structure.

Allowed future implementation shape:

- Limit changes to icon readiness selectors and directly related class names.
- Verify shared header/nav icons and representative icon surfaces.
- Avoid changing icon markup unless a separate HTML PR is explicitly approved.

Forbidden combinations:

- Do not reorganize shared header JavaScript.
- Do not redesign navigation.
- Do not touch prototype/reference/demo/variant paths.

### PR C: narrow global focus/visibility hardening

Purpose:

- Improve or normalize global focus/visibility behavior without creating page-specific regressions.
- Keep keyboard accessibility improvements narrow and testable.

Allowed future implementation shape:

- One selector group at a time, such as focus-visible, hidden/visibility helpers, or global interactive element states.
- Explicit before/after browser evidence for surfaces that can be affected.

Required regression checks:

- Desktop browser smoke.
- Mobile 375px smoke.
- Search/Browse card, preview, and empty-state visibility check.
- Editor controls and preview visibility check when affected by global selectors.
- My Trees card/list visibility check when affected by global selectors.

Forbidden combinations:

- Do not combine with Search architecture work.
- Do not combine with Editor global state work.
- Do not change runtime JavaScript to compensate for CSS behavior.

### PR D: post-implementation browser smoke checklist

Purpose:

- Record the verification matrix required after future behavior-affecting global CSS PRs.
- Keep smoke expectations consistent across desktop and mobile surfaces.

Allowed future implementation shape:

- Docs-only checklist, or checklist updates attached to a narrow CSS implementation PR.
- No workflow automation unless separately approved.

Forbidden combinations:

- Do not change GitHub Actions from Issue #418 alone.
- Do not treat static CSS review as equivalent to browser smoke for visibility or readiness changes.

## Verification matrix

| Verification item | Required for docs-only planning PR | Required for future CSS implementation PR | Notes |
|---|---:|---:|---|
| Static CSS review | Yes, as planning inventory only | Yes | Review selector reach before implementation. |
| `git diff --check` | Yes | Yes | Required before PR report. |
| Docs-only changed files | Yes | No | This PR must remain docs-only. |
| Desktop browser smoke | No | Yes for behavior-affecting CSS | Use Cloudflare Preview or approved fixed test slot when runtime-sensitive. |
| Mobile 375px smoke | No | Yes for global visibility/readiness/focus changes | Verify no mobile overflow, hidden content, or preview regression. |
| Search/Browse regression check | Documented only | Required when global selectors can affect Search/Browse | Especially card selection, preview visibility, empty states, and mobile scroll behavior. |
| Editor regression check | Documented only | Required when global selectors can affect Editor | Check controls, preview/detail rendering, and focus states. |
| My Trees regression check | Documented only | Required when global selectors can affect My Trees | Check card/list visibility, CTA visibility, and empty states. |
| Package/workflow review | Yes, confirm untouched | Yes, confirm untouched unless separately approved | Issue #418 does not authorize package or workflow changes. |
| Secret-safe reporting | Yes | Yes | Do not output tokens, cookies, sessions, credentials, localStorage values, or SSH private key values. |

## Browser smoke checklist for future implementation PRs

Use the smallest relevant subset for the selector being changed, but do not mark behavior-affecting CSS merge-ready without representative browser evidence.

- Desktop viewport:
  - Home/header render and icon readiness.
  - Search/Browse initial render.
  - Search/Browse card selection and preview visibility if selectors can affect cards/previews.
  - Editor render if selectors can affect controls, forms, visibility, or focus.
  - My Trees render if selectors can affect cards, lists, CTA, or empty states.
- Mobile 375px viewport:
  - Header/nav visibility.
  - Search/Browse scroll and selected preview behavior.
  - Editor controls and form visibility when affected.
  - My Trees list/card visibility when affected.
- Evidence rule:
  - Separate PASS from NOT_VERIFIED.
  - Static CSS review is not a substitute for browser smoke when visibility, readiness, focus, or layout may change.

## Parallel-work guardrails

- Do not touch `css/search/*` while PR #476 is active or merging.
- Do not touch Runtime/API/Auth/backend.
- Do not touch package or workflow files.
- Do not touch PR #7/prototype/reference/demo/variant paths.
- Do not touch PR #450/YouTube PoC files.
- Keep one risk area per future PR.
- Avoid any PR that mixes global CSS hardening with Search architecture, Editor global state, Auth fallback, or backend/runtime work.
- If another active PR touches the same global selector family, stop and request sequencing guidance.

## Future PR readiness gates

A future implementation PR should not be treated as merge-ready unless it includes:

- Exact selector/token group changed.
- Affected page/surface list.
- Static CSS review result.
- `git diff --check` result.
- Browser smoke result for any behavior-affecting change.
- Mobile 375px smoke result when global selectors can affect mobile layout or visibility.
- Explicit untouched confirmations for PR #7/prototype/reference/demo/variant and PR #450/YouTube PoC files.

## Final planning status

Issue #418 should proceed as a sequence of narrow, independently verifiable PRs. This planning document does not authorize CSS implementation by itself.