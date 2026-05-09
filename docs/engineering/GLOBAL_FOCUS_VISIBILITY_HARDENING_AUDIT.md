# Global Focus and Visibility Hardening Audit

Issue: #511

This document records the audit-first path for narrow global focus and visibility CSS hardening after #418 planning, #510 global token/readiness audit, and #512 browser smoke checklist disposition.

This is docs/inspection only. It does not authorize CSS implementation, broad `global.css` rewrites, selector removal, selector rename, JavaScript compensation, Search architecture work, Editor global state work, My Trees redesign, Auth/API/backend/package/workflow changes, or protected prototype/reference/demo/variant changes.

## Current disposition

#511 should be treated as a behavior-sensitive global CSS track. Focus and visibility selectors can affect keyboard accessibility, hidden/empty states, first paint, previews, forms, editor controls, and mobile layout across multiple surfaces.

The safe path is:

1. classify selector group,
2. identify affected surfaces,
3. make one narrow implementation PR only if needed,
4. verify with the #512 browser smoke checklist.

## Related source documents

| Document | Role |
| --- | --- |
| `docs/engineering/CSS_ARCHITECTURE.md` | CSS import hub and split ownership baseline. |
| `docs/engineering/GLOBAL_CSS_TOKEN_READINESS_AUDIT.md` | Token/readiness selector ownership and future PR split. |
| `docs/ops/GLOBAL_CSS_BROWSER_SMOKE_CHECKLIST.md` | Required desktop/mobile smoke and PASS/NOT_VERIFIED/BLOCKED reporting standard. |
| `docs/design/BUTTON_BADGE_CHIP_BASELINE.md` | Button, badge, chip tone and focus-ring baseline. |

## Selector group map

| Group | Current evidence | Risk level | Next action |
| --- | --- | --- | --- |
| Global focus-visible controls | `css/global.css` includes shared focus-visible rules for buttons and tag chips. | Medium | Keep stable unless a specific accessibility bug is found. |
| Header/navigation focus states | `css/global/header.css` and global control rules may affect nav/button focus. | Medium | Any change requires root/shared chrome smoke. |
| Global visibility/readiness selectors | Covered by `css/global/ready-state.css` and #510 readiness audit. | High | Do not change together with focus-visible rules. |
| Hidden/loading/empty helper behavior | Can affect Search/Browse, Editor, My Trees, and Auth surfaces. | High | Requires affected-surface inventory and #512 smoke matrix. |
| Shared interactive control states | Buttons, chips, badges, CTAs. | Medium | Keep token-only and selector behavior changes separate. |
| Page reveal/transition visibility | Connected to transition polish and page reveal documents. | High | Treat as motion/visibility track, not generic focus hardening. |

## Affected surface inventory

| Surface | Focus/visibility risk | Required verification before implementation merge |
| --- | --- | --- |
| Root/shared header/nav | Hidden icons, nav toggles, focus-ring loss, first paint flash | Desktop root smoke, mobile 375px smoke, no hidden nav controls |
| Home/Intro public pages | Hero CTA focus, reveal visibility, title/copy first paint | Public page desktop/mobile smoke |
| Search/Browse | Cards, selected preview, empty/loading/error states, scroll behavior | Search/Browse regression checklist from #512 |
| Editor | Controls, forms, preview/detail visibility, inline edit focus, empty/selected states | Fixed slot or explicitly scoped runtime smoke; do not overclaim static review |
| My Trees | Cards, lists, CTA, loading/empty states | Fixed slot for authenticated/user-data claims |
| Auth/Login | Input focus, submit button visibility, help/error text | Login smoke without printing sensitive values |

## Allowed future PR shapes

### PR A — Focus-visible selector audit or token-only clarification

Allowed:
- docs-only or token-reference clarification,
- no CSS behavior change,
- no runtime verification claim beyond static review.

### PR B — Narrow focus-visible hardening

Allowed:
- one selector family only,
- shared control focus state only,
- no readiness/visibility hidden-state changes in the same PR.

Required:
- static CSS review,
- root/shared chrome smoke,
- affected public page smoke,
- mobile 375px smoke,
- `PASS` and `NOT_VERIFIED` separated.

### PR C — Narrow visibility/helper hardening

Allowed:
- one hidden/visibility helper family only,
- no focus-visible token/control change in the same PR.

Required:
- affected surface inventory,
- #512 smoke matrix,
- fixed slot if Editor/My Trees/Auth runtime-sensitive behavior is claimed.

### PR D — Page reveal/transition visibility audit

Allowed:
- docs-only or very narrow page reveal verification plan.

Forbidden:
- no global transition rewrite,
- no page-wide motion application mixed with focus/visibility selector changes.

## Forbidden combinations

Do not combine:

- focus-visible selector changes with Material Symbols readiness selector changes,
- hidden/visibility helper changes with Search/Browse architecture changes,
- Editor runtime/global state cleanup with global CSS hardening,
- My Trees redesign with global visibility hardening,
- Auth/API/backend/package/workflow changes with CSS focus/visibility changes,
- broad `global.css` rewrite with any behavior-affecting selector change,
- PR #7/prototype/reference/demo/variant changes with #511 work,
- PR #450 changes with #511 work.

## Verification standard

Any implementation PR under #511 must cite `docs/ops/GLOBAL_CSS_BROWSER_SMOKE_CHECKLIST.md` and report:

- environment used,
- fixed slot required or not,
- deployed SHA match when runtime smoke is performed,
- root/shared chrome result,
- mobile 375px result,
- affected surface results,
- `PASS`, `NOT_VERIFIED`, and `BLOCKED` separately,
- fatal console error status,
- no private value exposure.

Static review alone is acceptable only for docs/inspection PRs.

## Closure criteria for #511

#511 can be closed when:

- global focus/visibility selector groups are classified,
- affected surfaces are documented,
- allowed future PR shapes are split narrowly,
- forbidden combinations are documented,
- #512 verification standard is referenced,
- the change remains docs/inspection only.

This document satisfies the audit/disposition portion of #511. Any future implementation should use a separate issue or PR with explicit CTO approval.

## Guardrails

- Docs/inspection only.
- No CSS implementation.
- No broad `global.css` rewrite.
- No selector removal or rename.
- No import order change.
- No JavaScript compensation for CSS behavior.
- No Search architecture work.
- No Editor global state work.
- No My Trees redesign.
- No Auth/API/backend/package/workflow changes.
- No PR #7/prototype/reference/demo/variant changes.
- No PR #450 changes.
- No `css/editor/status-settings.css` changes.
- No `css/editor/overrides.css` changes.
- No `css/editor.css` changes.
- No PR #527 changes.
- No Issue #513 changes.
