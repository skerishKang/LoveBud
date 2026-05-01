# Global CSS Token and Readiness Selector Audit

Issue: #510

This document records the current `css/global.css` token and readiness selector ownership audit after #418 planning, PR #508 ready-state implementation, and #512 browser smoke checklist disposition.

This is docs/inspection only. It does not authorize CSS implementation, broad `global.css` rewrite, selector movement, JavaScript readiness changes, Search/Browse CSS changes, Editor or My Trees redesign, Auth/API/backend/package/workflow changes, or protected prototype/reference/demo/variant changes.

## Current file ownership

| File | Current role | Ownership note |
| --- | --- | --- |
| `css/global.css` | Global import hub plus shared foundation/control classes | Owns import order and shared visual primitives only. Should not become a page-specific stylesheet. |
| `css/global/tokens.css` | Global token source | Owns brand palette, surface, radius, spacing, typography, LoveTree shared foundation, and PR2/PR3 control tokens. |
| `css/global/base.css` | Base element/reset layer | Not audited in this PR; preserve import order. |
| `css/global/header.css` | Shared header/nav layer | Not audited in this PR; preserve import order. |
| `css/global/ready-state.css` | Material Symbols/global readiness layer | Owns canonical icon-readiness selector behavior and legacy aliases. |
| `css/global/transition-polish.css` | Shared transition polish layer | Not audited in this PR; preserve import order. |

## Import order baseline

Current `css/global.css` import order:

```css
@import url('./global/tokens.css');
@import url('./global/base.css');
@import url('./global/header.css');
@import url('./global/ready-state.css');
@import url('./global/transition-polish.css');
```

This order is meaningful:

1. tokens first, because all later layers consume variables.
2. base before shared components.
3. header before readiness/transition polish.
4. ready-state before transition polish so readiness-specific icon visibility can settle before broader polish.

Do not reorder from #510 alone.

## Token group inventory

| Token group | Location | Status | Notes |
| --- | --- | --- | --- |
| Brand palette | `css/global/tokens.css` | `OK_AS_IS` | `--primary`, `--primary-rgb`, `--primary-vibrant`, `--primary-soft`, `--secondary`, warm accents. |
| Surface/text palette | `css/global/tokens.css` | `OK_AS_IS` | Background, surface, and text tokens remain central. |
| Radius tokens | `css/global/tokens.css` | `OK_AS_IS` | `--radius-default`, `--radius-lg`, `--radius-full`. |
| LoveTree shared foundation | `css/global/tokens.css` + `css/global.css` | `WATCH` | `--lovetree-*` tokens power `.lovetree-page-shell`, `.lovetree-soft-surface`, `.lovetree-card`, `.lovetree-pill`, `.lovetree-chip`. Future changes affect Search/Browse and other shared surfaces. |
| Page spacing tokens | `css/global/tokens.css` | `WATCH` | `--page-*`, `--hero-gap`, `--section-gap`, `--divider-margin`; potential overlap with `--lovetree-page-*`. Do not consolidate without visual checks. |
| Typography/accent tokens | `css/global/tokens.css` + `css/global.css` | `WATCH` | PR2 title/accent alignment depends on these tokens. Future change requires public page smoke. |
| PR3 control tokens | `css/global.css` root block | `AUDIT_NEEDED` | Control tokens currently live in `css/global.css`, not `tokens.css`. This is acceptable for now but should be revisited before more control token expansion. |
| Material Symbols readiness transition token | `css/global/ready-state.css` | `OK_AS_IS` | `--lovetree-icon-ready-transition` is readiness-scoped and should stay near readiness selectors. |

## Readiness selector inventory

| Selector or alias | Location | Status | Notes |
| --- | --- | --- | --- |
| `.material-symbols-outlined` base hidden state | `css/global.css` and `css/global/ready-state.css` | `DUPLICATE_CANDIDATE` | Both files currently define icon hidden/ready behavior. Do not remove from #510 alone. Future consolidation must verify no raw icon text flash. |
| `html.material-symbols-ready .material-symbols-outlined` | `css/global.css` and `css/global/ready-state.css` | `CANONICAL_READY_CLASS` | Canonical class. Preserve. |
| `html.ms-fonts-loaded ...` | `css/global/ready-state.css` | `LEGACY_ALIAS` | Keep for compatibility with older header/auth code paths. |
| `.material-symbols-outlined.ms-ready` | `css/global/ready-state.css` | `LEGACY_ALIAS` | Element-level alias. Keep until JS ownership confirms it is unused. |
| `.mobile-nav-toggle::before` ready-state suppression | `css/global/ready-state.css` | `OK_AS_IS` | Header/mobile-nav-specific readiness behavior lives in ready-state layer. |
| `html:not(.material-symbols-ready):not(.ms-fonts-loaded) ...` | `css/global/ready-state.css` | `OK_AS_IS` | Prevents mobile nav raw icon text before fonts are ready. |

## Observed duplication and ambiguity

### 1. Material Symbols readiness exists in two places

`css/global.css` contains a Material Symbols fallback text guard near the middle of the file, while `css/global/ready-state.css` contains the newer #418/#508 ready-state hardening with canonical and legacy selectors.

Disposition:
- Do not remove either block from #510.
- Future consolidation should be one narrow PR only.
- Required verification: `GLOBAL_CSS_BROWSER_SMOKE_CHECKLIST.md` root/header/mobile smoke, no raw icon text, no hidden icons after readiness.

### 2. Control tokens live in `css/global.css`

The PR3 control token `:root` block currently lives in `css/global.css`, not `css/global/tokens.css`.

Disposition:
- Accept as current state.
- Future movement into `tokens.css` can be considered only as a token-only PR.
- Do not combine token movement with selector behavior changes.

### 3. Shared foundation tokens and page spacing tokens overlap by purpose

`--lovetree-page-*` and `--page-*` tokens both describe page shell rhythm, but they serve different staged UI cleanup paths.

Disposition:
- Keep both for now.
- Do not consolidate without Search/Browse, Intro/Home, and shared shell visual smoke.

## Future PR candidates

| Candidate | Scope | Preconditions | Verification |
| --- | --- | --- | --- |
| Ready-state dedupe audit | Decide whether the old Material Symbols fallback block in `css/global.css` can be removed or moved | Static selector search and JS readiness ownership check | #512 root/header/mobile smoke; raw icon text check |
| Control token relocation | Move PR3 control tokens from `css/global.css` to `css/global/tokens.css` if desired | Confirm no cascade/order dependency | Static review plus public page smoke |
| Page shell token clarification | Document or align `--lovetree-page-*` vs `--page-*` usage | Search/Browse/Home/Intro affected surface list | Desktop and mobile 375px public page smoke |
| Typography token impact audit | Verify PR2 typography/accent token consumers | Identify Home/Intro/Browse consumers | Public page visual smoke |

## Required verification for future implementation

Use `docs/ops/GLOBAL_CSS_BROWSER_SMOKE_CHECKLIST.md` for any implementation PR that changes token values, readiness selectors, visibility/focus selectors, or import order.

Minimum expectations:

- static CSS review,
- root/shared chrome smoke,
- mobile 375px smoke,
- no raw Material Symbols text flash,
- no permanently hidden icons,
- Search/Browse checks if shared cards/chips/previews can be affected,
- Editor/My Trees/Auth checks only if runtime-sensitive surfaces are affected,
- separate `PASS`, `NOT_VERIFIED`, and `BLOCKED` outcomes.

## Closure criteria for #510

#510 can be closed when:

- token groups are inventoried,
- readiness selectors and aliases are inventoried,
- duplicated or ambiguous readiness/token ownership is documented,
- future PR candidates are split narrowly,
- #512 verification checklist is referenced for implementation work,
- the change remains docs/inspection only.

## Guardrails

- Docs/inspection only.
- No CSS implementation.
- No `css/global.css` rewrite.
- No selector removal or rename.
- No import order change.
- No JavaScript readiness logic change.
- No Search/Browse CSS changes.
- No Editor or My Trees redesign.
- No Auth/API/backend/package/workflow changes.
- No PR #7/prototype/reference/demo/variant changes.
- No PR #450 changes.
- No `css/editor/status-settings.css` changes.
- No `css/editor/overrides.css` changes.
- No `css/editor.css` changes.
- No PR #527 changes.
- No Issue #513 changes.
