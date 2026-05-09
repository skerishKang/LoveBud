# Page Module Grouping Audit

> Status: audit only
> Related: #410, #72
> Runtime impact: none

## 1. Purpose

Issue #410 tracks the remaining page-level JavaScript module grouping audit after the Issue #72 JS Architecture Cleanup Tracker closure disposition.

This document records the current file responsibility map, candidate grouping list by page, risk classification, and recommended next implementation posture for page-owned JavaScript files.

This document is documentation-only. It does not approve implementation, file moves, page markup changes, script load-order changes, broad JavaScript tree reorganization, Search grouping restart, Auth changes, Editor changes, or PR #7/prototype/reference/demo/variant changes.

## 2. Scope

In scope:

- `js/detail.js`
- `js/my-trees.js`
- `js/my-trees/**`
- `js/index.js`
- `js/settings.js`
- possible future page owner paths such as:
  - `js/detail/index.js`
  - `js/home/index.js`
  - `js/settings/index.js`

Out of scope:

- implementation
- file moves
- broad JS tree reorganization
- Search grouping restart from old PR #73
- Auth runtime changes
- Editor runtime changes
- page markup/script-order changes
- PR #7/prototype/reference/demo/variant changes

## 3. Current file responsibility map

| Area | Current file or path | Current responsibility | Current grouping posture |
| --- | --- | --- | --- |
| Detail | `js/detail.js` | Detail page bootstrap/orchestration and detail-page runtime behavior. | Keep as current single page entry until a dedicated Detail boundary audit proves a split is useful. |
| My Trees legacy entry | `js/my-trees.js` | Legacy or compatibility page entry responsibility for My Trees flows. | Do not reorganize while active My Trees work is unsettled. Treat as high-risk because it can interact with auth/API/data state. |
| My Trees modules | `js/my-trees/**` | Existing My Trees page-specific module family. | Keep page-specific. Any grouping change must be one narrow My Trees PR after active My Trees PRs settle. |
| Home | `js/index.js` | Home/landing page behavior and public entry interactions. | Possible future `js/home/` owner path is low priority. Defer unless home logic grows or ownership becomes ambiguous. |
| Settings | `js/settings.js` | Settings page behavior, account/session-adjacent controls, and navigation-sensitive page interactions. | Keep as current page entry until a Settings-specific load-order and auth/session audit is done. |
| Possible Detail owner path | `js/detail/index.js` | Not currently approved as an implementation target. Candidate namespace only. | Documentation candidate; no file creation approved here. |
| Possible Home owner path | `js/home/index.js` | Not currently approved as an implementation target. Candidate namespace only. | Documentation candidate; no file creation approved here. |
| Possible Settings owner path | `js/settings/index.js` | Not currently approved as an implementation target. Candidate namespace only. | Documentation candidate; no file creation approved here. |

## 4. Candidate grouping list by page

| Page/domain | Candidate grouping | Candidate value | Current decision |
| --- | --- | --- | --- |
| Detail | Split `js/detail.js` into a page owner folder such as `js/detail/index.js` plus narrow helpers only if responsibility boundaries are clear. | May clarify bootstrap vs detail rendering/data orchestration if the file grows or receives repeated edits. | Defer implementation. First follow-up should be a Detail-only boundary audit if implementation pressure appears. |
| My Trees | Normalize `js/my-trees.js` and `js/my-trees/**` ownership after active My Trees work settles. | Could reduce legacy entrypoint ambiguity and concentrate page modules. | Defer. Highest collision risk with active/parallel My Trees work. |
| Home | Consider `js/home/index.js` only if `js/index.js` ownership becomes ambiguous or home behavior expands. | Could make public home ownership more explicit. | Defer as low priority. No implementation justified now. |
| Settings | Consider `js/settings/index.js` only after settings auth/session/navigation boundaries are documented. | Could clarify Settings page ownership. | Defer. Requires Settings-specific audit before any file move. |

## 5. Risk classification by page

| Page/domain | Risk | Reason | Verification if implementation occurs |
| --- | --- | --- | --- |
| Detail | Medium | Detail page behavior is runtime-visible and may depend on data loading, rendering order, and page-specific state. | Cloudflare Preview may be enough for public static rendering only; data/runtime behavior needs fixed test slot if Auth/API/user state is involved. |
| My Trees | High | My Trees is auth/API/data-sensitive and often overlaps with active PRs. A grouping change can collide with state, loading, cards, actions, or page modules. | Fixed test slot required for final PASS. Verify deployed SHA matches PR head SHA. |
| Home | Low to medium | Home is public and lower runtime risk, but it is the visual/brand baseline and should not be destabilized by unnecessary JS movement. | Cloudflare Preview is usually sufficient for public static behavior; browser smoke required if interactions change. |
| Settings | Medium to high | Settings is session/navigation-sensitive and can interact with account state, return paths, and auth-adjacent behavior. | Fixed test slot required if login/session/account behavior is involved. |

## 6. Recommendation

Do not start broad page module reorganization from this audit.

Current recommendation: defer implementation until a specific page/domain has enough change pressure to justify a narrow PR.

If a first implementation path becomes justified later, the safest first candidate is one of:

1. Detail-only boundary audit before any code movement.
2. Home-only grouping only if `js/index.js` grows or its ownership becomes ambiguous.

Do not choose My Trees as the first implementation candidate while active My Trees work is unsettled. Do not choose Settings before a settings-specific auth/session/navigation boundary audit.

## 7. Safe sequence

1. Keep this audit as the closure document for Issue #410.
2. Do not reopen Search grouping from old PR #73 through this path.
3. Do not reorganize all page modules at once.
4. If future implementation is justified, create one issue/PR for one page/domain only.
5. Require Cloudflare Preview or fixed test slot verification according to the risk classification above.
6. Keep Auth, Editor, Search, Detail, My Trees, Home, and Settings changes separated unless explicitly scoped by the CTO.

## 8. Guardrails

- No JavaScript moves from this audit.
- No page markup changes from this audit.
- No script load-order changes from this audit.
- No runtime behavior changes.
- No broad JavaScript tree reorganization.
- Do not mix page grouping with Search, Editor, Auth, or My Trees fixes.
- Do not touch PR #7.
- Do not modify prototype/reference/demo/variant paths.
- Do not add package dependencies.
- Do not change GitHub Actions workflows.

## 9. Recommended follow-ups

| Follow-up | Type | Notes |
| --- | --- | --- |
| Detail module boundary audit | audit | Determine bootstrap vs orchestrator responsibilities before any Detail file movement. |
| My Trees module boundary audit | audit | Run only after active My Trees PRs settle. |
| Home module boundary audit | audit | Low priority; use only if `js/index.js` grows or ownership becomes unclear. |
| Settings module boundary audit | audit | Requires settings auth/session/navigation boundary review first. |

## 10. Non-goals

- No Issue #72 closure.
- No implementation.
- No file movement.
- No script load-order changes.
- No broad JavaScript tree reorganization.
- No Search grouping restart from old PR #73.
- No Auth runtime changes.
- No Editor runtime changes.
- No PR #7/prototype/reference/demo/variant changes.
