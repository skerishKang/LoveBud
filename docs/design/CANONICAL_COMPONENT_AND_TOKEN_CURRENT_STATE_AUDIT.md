# Canonical Component and Token Current-State Audit

Parent #3672 · Child #3674

## Exact baseline

| Field | Value |
|---|---|
| Repository | `skerishKang/LoveBud` |
| Audited ref | `origin/main` |
| Exact commit | `4beada4c8134afbdb791e98466db9ec1162f0a27` |
| Expected commit | `4beada4c8134afbdb791e98466db9ec1162f0a27` |
| Start drift | `NONE` |
| Class | Generic Tier 2 / U2 source-only audit |
| Browser, screenshot, Production | not used |

This SHA is the evidence boundary. A source name containing “canonical” is not final approval.

## Evidence limits

Read-only evidence was taken from `css/**`, `js/**`, `pages/**`, `index.html`, `docs/design/**`, `docs/product/**`, the two required policy documents, and representative source under `tests/contracts/**`.

| Requested test path | Exact-baseline result |
|---|---|
| `tests/contracts/**` | exists; representative contracts inspected |
| `tests/browser/**` | **does not exist**; `tests/browser` returned 404 |
| `tests/e2e/**` | **does not exist**; `tests/e2e` returned 404 |

A Chromium test is located at `tests/contracts/tree-card-composition-3578-browser-contract.test.cjs`; this does not make `tests/browser/` exist.

No browser, authenticated state, computed style, accessibility tree, screenshot, network trace, overflow measurement, Preview, or Production was used. Accordingly, 1440px and 390px are **future baseline targets**, not captured evidence. Static source cannot prove visual pass, focus non-clipping, contrast, or responsive correctness.

Candidate dispositions only: `CANONICAL_CANDIDATE`, `PAGE_SPECIFIC`, `LEGACY_CANDIDATE`, `DUPLICATE_CANDIDATE`, `UNRESOLVED`. This audit authorizes no deletion, consolidation, rename, or canonical approval.

## Token source matrix

| Category | Source / current state | Scope, behavior, risk | Candidate |
|---|---|---|---|
| color | `css/global/tokens.css`: primary/secondary/accent/background/surface/text/outline variables; literal colors remain in page CSS | global consumers; contrast not measured; global change risk critical | runtime variables `CANONICAL_CANDIDATE`; literals `UNRESOLVED` |
| typography | font-family, hero, section, eyebrow variables in `tokens.css`; base headings in `global-base.css` | Home/Browse/My Trees/Settings and Editor through global import; local scales remain | families `CANONICAL_CANDIDATE`; scale `UNRESOLVED` |
| spacing | page pads, hero/section gaps, card grid/content/media gaps in `tokens.css` | desktop/tablet/mobile values exist, but many literals remain; high shared impact | named shell/card tokens `CANONICAL_CANDIDATE`; broader scale `UNRESOLVED` |
| radius | global default/lg/full and LoveTree card/state/image tokens | page literals include 18/20/24/28/99/999px; focus clipping unmeasured | tokens `CANONICAL_CANDIDATE`; literals `DUPLICATE_CANDIDATE` |
| shadow | whisper and LoveTree card hover/active/ring tokens; panel/modal literals | state variants exist; forced-colors/contrast untested | shared card tokens `CANONICAL_CANDIDATE`; others `UNRESOLVED` |
| breakpoint | embedded media queries: shared shell 1024/768, page shell 480, Editor/page modules | no central runtime registry; reading/focus order unverified; high impact | `DUPLICATE_CANDIDATE` / `UNRESOLVED` |
| motion duration/easing | literal transitions across global/Search/card/modal/Editor; only proposed tokens in `docs/product/lovebud-motion-system-foundation.md` | multiple durations/easings; reduced-motion remains a future policy | `UNRESOLVED`; literals `DUPLICATE_CANDIDATE` |
| z-index | literals in noise overlay, modal, header, preview, Editor and media CSS | no scale in `tokens.css`; overlay/focus collisions unmeasured; critical | `UNRESOLVED` |
| surface/background | warm paper variables, `.bokeh-bg`, shared card/state surfaces plus page gradients | shared and page-specific translucency coexist; high impact | global `CANONICAL_CANDIDATE`; literals `PAGE_SPECIFIC` or `DUPLICATE_CANDIDATE` |
| focus ring | selector-local rules for shared card, sort select, Editor nodes; assorted inputs use `outline:none` plus `:focus` shadow | no common token; Browse filter spans lack native button semantics; critical | `UNRESOLVED` |

`css/global.css` imports `css/global/tokens.css` first and is the strongest runtime token-source candidate. `docs/design/UI_DESIGN_SYSTEM.md` is visual intent, not an exact registry: its sample names/values differ from runtime. The motion document explicitly marks its duration/easing set as proposed.

## Component pattern matrix

| Pattern | Exact source boundary | Consumers / variants / behavior | Risk and candidate |
|---|---|---|---|
| Page hero | Home `.home-v3-hero`; Browse/My Trees `.browse-curation-shell` + `.search-panel-header`; `search-hero-controls.css` | Home collage variant; public/owner copy variants; semantic `h1`; fluid/mobile rules | high; shared Browse/My Trees `CANONICAL_CANDIDATE`, Home `PAGE_SPECIFIC` |
| Primary/secondary button | `.btn-round.btn-primary/.btn-outline` in `global.css`; page-specific modal/action selectors | anchors/buttons across Home, My Trees, Editor; focus ownership fragmented | high; base `CANONICAL_CANDIDATE`, variants `UNRESOLVED` |
| Search input | `.search-input-wrapper/.search-input` in `search-controls.css`; imported by My Trees | public versus owner placeholder/ID; native input; `outline:none`; 40px mobile | high; `CANONICAL_CANDIDATE` with accessibility review |
| Filter chip | `.tag-chip`; Browse `<span>`, My Trees `<button>` | emotion versus owner-property variants; mobile horizontal scroll; semantic mismatch | high; visual `CANONICAL_CANDIDATE`, semantics `UNRESOLVED` |
| Card shell | `css/shared/love-tree-card-composition.css`; `LoveBudTreeCardComposition.buildCardElement()` | Browse/My Trees surface, selected, featured, visibility and slot variants; sanitized URLs/text; fail-closed dependencies; root focus-visible | critical; `CANONICAL_CANDIDATE` |
| Generic/compat card | `.lovetree-card` plus builder-emitted `.tree-card` and `.love-tree-card` | unknown wider consumers and contract-pinned dual classes | high; `LEGACY_CANDIDATE` / `DUPLICATE_CANDIDATE` |
| Result header | shared result slots in both page entrypoints and Search controls | public hidden owner-CTA versus populated owner CTA; select/view controls; 768px wrap | high; `CANONICAL_CANDIDATE` |
| Right-side hub | calm right rail, `.preview-hub`, shared scroll/slot CSS; Browse dynamic slots; My Trees static owner markup | public/dynamic versus owner/static actions and metadata; sticky desktop/mobile presentation | critical; skeleton `CANONICAL_CANDIDATE`, variants `PAGE_SPECIFIC` |
| Loading | Browse skeletons; My Trees `#state-loading`; shared spin keyframe | anonymous public skeleton versus labelled owner loading; skeletons aria-hidden | medium-high; visual `DUPLICATE_CANDIDATE`, semantics `PAGE_SPECIFIC` |
| Empty | Browse preview/search empty; My Trees page/hub empty; shared state tokens | no selection/results/owned trees/moments; copy and CTA vary | high; tokens `CANONICAL_CANDIDATE`, variants `PAGE_SPECIFIC` |
| Error | My Trees load/modal error; Settings live status; other page handlers | My Trees safe error projection tested; aria-live in modal/settings | high; `PAGE_SPECIFIC`, common contract `UNRESOLVED` |
| Media control | Home play button; Browse preview helpers; My Trees media slot; Editor video-focus | labelled Home control; preview/embed/editor variants; mobile panel differences | critical; `PAGE_SPECIFIC`, common model `UNRESOLVED` |
| Modal/dialog | My Trees create modal + actions/CSS; Editor panels/forms; Settings full-page card with dialog semantics | My Trees labelled modal, Escape/backdrop/cancel, busy/error states; focus trap/restoration not proven | critical; My Trees `PAGE_SPECIFIC`, shared contract `UNRESOLVED` |
| Focus treatment | card/sort `:focus-visible`, Editor node focus, assorted `:focus` shadows | no unified token or rendered clipping evidence | critical; `UNRESOLVED` |

## Critical-page source inventory

| Page/state | Entrypoint and source owners | Current structure and constraints |
|---|---|---|
| Home | `index.html`, global, `index.css`, `index-visual.css`, transitions/tree-view; `index.js` and shared modules | shared header; page-specific hero/actions/growth-stage media; global button/token impact |
| Browse | `pages/search.html`, global, shared card CSS, `search.css`; shared card plus Search render/preview/control modules | calm two-column shell; shared hero/search/result topology; dynamic public hub; skeleton results |
| My Trees | `pages/my-trees.html`, global, shared card CSS, `my-trees.css`; owner UI/actions/hub/modal modules | same shell/topology; explicit loading/error/empty/loaded states; static owner hub and create modal |
| Editor view | `pages/editor.html`, cascade-sensitive `editor.css`; `editor-detail-view-mode-template.js` delegates to shared canonical appreciation presentation | rail/canvas/detail shell; owner options; `.editor-readonly` hides mutation controls; very high risk |
| Editor edit | same entrypoint; edit/detail/form/action CSS/JS; `editor-detail-edit-mode-template.js` | inputs, knowledge mount, save/cancel/connect/delete; exact IDs and inline compatibility styles |
| Settings | `pages/settings.html`, global, split `settings.css`, `settings.js/bootstrap` | full-page settings card, profile form, status regions and logout; dialog semantics unresolved |

## Desktop/mobile structural targets

| Target | Future evidence required; no capture exists in this audit |
|---|---|
| 1440px | six critical pages/states: shell width, hero hierarchy, two-column/right-rail containment, result/card density, Editor rail/canvas balance, Settings containment, no horizontal clipping |
| 390px | reading/focus order, single-column/panel hierarchy, chip/search behavior, CTA reachability, modal containment, Editor panel toggles, no horizontal overflow |

Future evidence must separate public from authenticated states, Browse from owner My Trees, Editor view from edit, and loading/empty/error/selected states. A screenshot harness is not authorized here.

## Existing UI/static/browser evidence

| Evidence | Supports | Does not support |
|---|---|---|
| `UI_DESIGN_SYSTEM.md` and `BUTTON_BADGE_CHIP_BASELINE.md` | visual intent and historical viewport/control guidance | current visual pass or exact runtime authority |
| `BROWSE_MY_TREES_CANONICAL_STRUCTURE_AUDIT.md` | prior structure/duplication map | every later convergence or acceptance |
| UI rapid lane and screenshot policy | U2 routing and fact/judgment separation | page pass status |
| source/static contracts | pinned source and fake-DOM behavior | rendered layout unless actually executed for that outcome |
| card Chromium contract under `tests/contracts/` | repository contains real Playwright fixture coverage | execution in this audit or six-page/viewport coverage |

## Shared-impact source map

| Source | Consumers / impact |
|---|---|
| `css/global/tokens.css`, `global.css`, imported global modules | almost every critical page; critical risk |
| `lovetree-calm-page-shell.css` | Browse/My Trees geometry and right rail; high risk |
| Search hero/controls CSS | Browse plus My Trees imports; high risk |
| shared card CSS/JS | Browse/My Trees safe DOM, routes, states, focus; critical/security-sensitive |
| shared preview-hub modules | Browse/My Trees skeleton/scroll/slots with page overrides; high risk |
| shared canonical appreciation detail | Editor owner view and other appreciation consumers; critical |
| shared header JS/CSS | navigation/auth/language/mobile chrome; critical |
| page transitions/global transition polish | first-paint visibility/motion across entrypoints; high risk |

## Contract-test coupling analysis

Classifications apply to assertions, not whole filenames.

| Inspected assertion family | Classification and reason |
|---|---|
| shared-shell exact classes/files/import string/literal grid/obsolete wrappers | `IMPLEMENTATION_COUPLED` |
| auth-pending visibility and shell containment intent | `USER_OBSERVABLE_OUTCOME` intent, statically implementation-coupled |
| preview-hub exact slot IDs/order/render targets | `IMPLEMENTATION_COUPLED` |
| preview-hub scrolling/containment | `USER_OBSERVABLE_OUTCOME` intent with declaration coupling |
| Editor Arrow/Enter/Space navigation, focus restoration/visibility | `USER_OBSERVABLE_OUTCOME`; exact helper regex is `IMPLEMENTATION_COUPLED` |
| My Trees cancel/Escape/pending/success/error feedback | `USER_OBSERVABLE_OUTCOME` |
| My Trees auth status, safe errors, mutation/duplicate guards | `SECURITY_OR_AUTHORITY_INVARIANT` |
| shared card XSS/URL sanitization/fail-closed dependencies/route authority/no `mode=edit` | `SECURITY_OR_AUTHORITY_INVARIANT` |
| shared card dual classes/slot names/adapter call strings | `IMPLEMENTATION_COUPLED` |
| Chromium rendered CTA/structure | `USER_OBSERVABLE_OUTCOME`; same-origin route/sanitization is `SECURITY_OR_AUTHORITY_INVARIANT` |
| unread contracts | `UNRESOLVED`; not classified without source inspection |
| `tests/browser/**`, `tests/e2e/**` | not classifiable; paths absent |

Coverage does not make an implementation canonical. Some tests intentionally pin compatibility seams; changing them requires a later explicit outcome/authority/implementation decision.

## Confirmed drift

1. `docs/engineering/CSS_ARCHITECTURE.md` names old global paths (`base.css`, `header.css`) while active imports use `global-base.css`, `global-header.css` plus calm-shell, ready-state and transition modules.
2. The same document shows an older My Trees split; active `my-trees.css` imports renamed modules plus Search/shared preview modules.
3. `UI_DESIGN_SYSTEM.md` sample token names/values do not exactly match active `tokens.css`.
4. The motion foundation says Browse card hover/active was not observed in that audit; current shared card CSS contains explicit hover transition/transform.
5. Historical viewport documents often cite 375px; #3672/#3674 set 390px as the next target. Historical evidence is not a 390px capture.

No screenshot-to-source visual drift is confirmed.

## Legacy/duplicate candidates

- `.lovetree-card` versus `.tree-card`/`.love-tree-card` compatibility classes.
- selected-state aliases `love-tree-card-selected`, `is-selected`, `is-active`.
- overlapping Browse/My Trees hub CSS ownership.
- literal color/radius/shadow/motion families alongside tokens.
- the contract-described no-op preview-scroll alias.
- My Trees hidden layout-probe inline styles.
- Editor edit-template inline display/margin compatibility styles.

All remain candidates because unknown consumers, tests, cache behavior, owner/public semantics, or Editor cascade may require them.

## Compatibility constraints

Preserve unless a later narrow contract explicitly supersedes them:

- public/owner route and authority separation;
- safe URL/text projection and fail-closed card dependencies;
- stable IDs/classes used by renderers, tests, i18n, handlers and CSS;
- Browse dynamic hub versus My Trees owner actions/states;
- My Trees auth/loading/error/empty/create-flow mutation guards;
- Editor view/edit/read-only authority and cascade order;
- shared header auth/language behavior;
- focus visibility and reduced-motion expectations;
- #3425, #3458 and #1882 remaining open;
- parallel #3669 and #3671 untouched.

## Unresolved hypotheses

- semantic token coverage versus page-local literals;
- 1440/390 overflow, clipping and structural stability;
- Browse span-chip keyboard/assistive interaction;
- Search/modal focus after `outline:none` and ring clipping by overflow;
- z-index collisions across header, overlays, sheets, modal and Editor;
- Settings full-page dialog semantics;
- safe convergence level for loading/empty/error and the two hub rendering models;
- safe removal of compatibility card classes;
- shared control use in Editor without authority/save regressions;
- reliability of existing Chromium contracts in Local/CI.

## Unsupported claims

This audit does not claim visual pass, browser/screenshot evidence, final canonical approval, safe deletion, complete user-outcome test coverage, accessibility/contrast/overflow/motion pass, authenticated runtime exercise, Production/SHA parity, or implementation authorization.

## Audit conclusion

The baseline already has credible shared foundations: runtime tokens, a Browse/My Trees shell and upper-page topology, shared card CSS/DOM with security constraints, shared hub skeleton modules, and shared appreciation-detail presentation. “Canonical” nevertheless remains distributed across runtime source, historical documents, compatibility classes, page overrides and implementation-coupled tests.

The smallest dependency-proving next child is a **canonical component/variant inventory contract**. It must define visual versus authority variants before token migration, Browse/My Trees convergence, visual-baseline harness work, or acceptance recording. See `CANONICAL_COMPONENT_AND_VISUAL_BASELINE_NEXT_CHILD_DECISION.md`.

This audit is source-only and authorizes no implementation.

## Post-audit baseline drift assessment

| Field | Verified value |
|---|---|
| original audit baseline | `4beada4c8134afbdb791e98466db9ec1162f0a27` |
| new main | `125c074f4ff6af84ed75f71f0a5b65d2432a57fb` |
| drift source | PR #3675 |
| UI/CSS/JS/page/template/asset changes | none confirmed |
| audit conclusion impact | none, subject to exact source verification |

The exact PR #3675 drift inventory is:

```text
db/migration-provenance/readonly-query-catalog.json
docs/architecture/DB_MIGRATION_PROVENANCE_NEXT_CHILD_DECISION.md
docs/architecture/db-migration-readonly-query-catalog-contract.md
tests/contracts/db-migration-readonly-query-catalog-contract.test.cjs
tests/test-layer-classification.json
```

The exact `4beada4c8134afbdb791e98466db9ec1162f0a27...125c074f4ff6af84ed75f71f0a5b65d2432a57fb` source comparison confirms no overlap with the audited UI, CSS, JavaScript, page, template, asset, component, or visual-baseline source boundaries. The historical audit baseline remains `4beada4c8134afbdb791e98466db9ec1162f0a27`; it is not replaced by the new main SHA.

The audit conclusion is unchanged. No browser, screenshot, Preview, Production, runtime, Auth, API, database, cache, storage, or provider action was used to reach this bounded assessment.
