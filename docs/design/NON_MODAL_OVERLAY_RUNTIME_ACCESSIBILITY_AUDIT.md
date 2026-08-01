# Non-Modal Overlay Runtime Accessibility Audit

Status: runtime audit record for Issue #3799 (parent design-system program #3672 — Keep OPEN).
Scope: the first source-backed **and real-local-browser** runtime map of LoveBud surfaces that look or behave like overlays but are **not** part of the six canonical true modals. It converts the remaining non-true-modal semantic gaps from source assumptions into runtime-confirmed bounded work. It does not authorize product implementation and does not propose one universal overlay component.

## 1. Status and exact baseline

```text
Status:        AUDIT RECORD — no product code change authorized
Repository:    skerishKang/LoveBud
Issue:         #3799 — Runtime-map non-modal panels, drawers, sheets, and popovers
Parent:        #3672 — Keep OPEN
Authorities:   #3788 MODAL_DIALOG_OWNERSHIP_BOUNDARY_DECISION.md (completed)
               #3753 FORCED_COLORS_FOCUS_COVERAGE_AUDIT.md (completed)
               SECONDARY_ACTION_FOCUS_TREATMENT_DECISION.md
               #3706 CANONICAL_COMPONENT_VARIANT_INVENTORY_CONTRACT.md
issue-created main: 38f4b5bd214e24f1f5fc4c1d5cc890803931ff9d
actual origin/main: 38f4b5bd214e24f1f5fc4c1d5cc890803931ff9d (at audit time)
main drift:         origin/main advanced during the audit to dbe74ca1c4bca66c897efadd3972c9b3839ff94d
                    (two commits: 38ca3be4b feat(a11y) share modal lifecycle across core dialogs =
                    the #3795/#3797 six true-modal work, explicitly out of this audit's scope; and
                    dbe74ca1c docs(ci) failure-artifact contract). The drift touches only the six
                    canonical true modals and CI docs — none of the audited non-modal surfaces
                    (settings, scout, AI panel, editor panels/popovers, browse/my-trees sheets,
                    entity-search, connect-existing, native confirm owners) changed.
audited ref:        origin/main 38f4b5bd214e24f1f5fc4c1d5cc890803931ff9d
```

Evidence vocabulary (required by #3799):

```text
TRUE_MODAL_OUT_OF_SCOPE      canonical six-modality boundary (#3788/#3795) — not this audit's surface set
NON_MODAL_PANEL_CORRECT      persistent/side surface with correct non-modal semantics
MODAL_SEMANTICS_OVER_APPLIED dialog/modal role claimed where behavior is not modal
MODAL_SEMANTICS_MISSING      visual overlay with no role/name/lifecycle at all
DISCLOSURE_OR_POPOVER        positioned popover/menu/disclosure, not a modal
MOBILE_DRAWER_VARIANT        bottom-sheet/drawer variant, page-owned
INLINE_CONFIRMATION          inline expanded confirmation region
NATIVE_BROWSER_CONFIRMATION  window.confirm()/prompt() authority
DECORATIVE_NOT_INTERACTIVE   pointer-events:none decoration
LEGACY_OR_DORMANT            unlinked/experimental/stale surface
SEMANTICALLY_INCOMPLETE      partial lifecycle; cannot be called a true modal or a clean panel
RUNTIME_CORRECT              browser-verified correct behavior
RUNTIME_DEFECT_CONFIRMED     browser-verified defect
UNRESOLVED_RUNTIME           claim only a real AT/Production could prove
NOT_APPLICABLE               not relevant to a surface
```

Evidence strength:

```text
SOURCE_CONFIRMED             read from current source at the baseline SHA
REAL_LOCAL_CONFIRMED         observed in a real browser over a local ephemeral server
ACCESSIBILITY_TREE_CONFIRMED CDP Accessibility.getPartialAXTree/getFullAXTree
COMPUTED_STYLE_CONFIRMED     getComputedStyle / forced-colors emulation
NEGATIVE_CONTROL_CONFIRMED   NC1-NC10 disposable-control runs
INFERENCE_ONLY               not directly observed
```

## 2. Scope and evidence limits

- Scope: settings full-page card, Scout draft overlay, LoveBud AI panel, editor desktop detail panel, editor mobile panels/drawers, Browse mobile preview sheet, My Trees mobile preview sheet, editor toolbar/menu/overflow popovers, entity-search/autocomplete, connect-existing inline flow, and active native `confirm()`/`prompt()` owner actions.
- Dormant/unlinked surfaces are recorded for existence and status only: `pages/chat-first-workspace.html`, `pages/kimi-v2/my-trees.html`.
- Decorative overlays (`noise-overlay`, kimi-v2 `tree-overlay`) are confirmed and classified only.
- Method: Node 20+ (`node v22.23.1`), Playwright Chromium (`chromium-1234`, headless), local ephemeral HTTP server (`127.0.0.1:8731`) serving the real worktree HTML/JS/CSS, real active product scripts, and synthetic safe fixtures. All external dependencies (Firebase SDK URLs, same-origin `/api/*`) are stubbed at the route level; `window.apiClient` and `window.LoveTreePublicTreeAdapter` are the real `postgres-client.js`/`public-tree-adapter.js` driven by synthetic `/api/*` responses.
- No Production, no Preview-as-proof, no real login, no private IDs, no API write, no DB/cache/storage, no real external network (every external URL was intercepted and fulfilled locally).
- Harness did not pre-create any state later attributed to a product controller; overlays were opened through real triggers or the product controller's own public API.
- Evidence artifacts (DOM/AX/computed-style/activeElement/keyboard/health JSON, fixtures, controls) live only under the disposable directory `/tmp/kilo/nmo-3799/` and are not committed.

## 3. Source inventory and active/dormant determination

Active surfaces (loaded by current pages):

| Surface | Owner HTML/JS | Owner CSS | Loaded by |
|---|---|---|---|
| Settings full-page card | `pages/settings.html:19` `js/settings.js` (`closeSettings`, `bindCloseInteractions`) | `css/settings/**` | settings.html |
| Scout draft overlay | `js/scout/scout-draft-ui.js` (`createModalInDOM`, `openModal`, `closeModal`, `showPreview`) | `css/scout/scout-draft.css` | editor.html:241-245 |
| LoveBud AI panel sheet | `js/ai/lovebud-ai-panel.js` (`LoveBudAIPanel.open/close`, `createDOM`, `updateState`) | `css/components/lovebud-ai-panel.css` | editor/search/my-trees/intro |
| Editor desktop detail panel | `js/editor/templates/editor-detail-panel-shell-template.js`, `js/editor/editor-rail-collapse.js` | `css/editor/**` | editor.html |
| Editor mobile panels/drawers | `js/editor/editor-mobile-panel-hierarchy.js` (`openPanel`, `closePanel`, `trapTabKey`, `applyClosedState`, `applyDesktopState`, `cleanupDesktopState`, `syncViewportState`) | `css/editor/**` | editor.html:128 |
| Browse mobile preview sheet | `js/search/search-mobile-preview-sheet.js` (`showSheetOverlay`, `hideSheetOverlay`, `setMobilePreviewOpen`, `syncPreviewVisibility`, `patchSearchUIFactory`) | `css/search/search-responsive/mobile-preview.css` | search.html:189 |
| My Trees mobile preview sheet | `js/my-trees/my-trees-mobile-preview-sheet.js` (`showSheetOverlay`, `hideSheetOverlay`, `setMobilePreviewOpen`, `closeMobilePreview`, hub patch, Escape) | `css/my-trees/my-trees-preview-hub/responsive.css` + shared `search-preview-sidebar.css` | my-trees.html:152 |
| Editor floating-toolbar dropdown | `js/editor/editor-floating-toolbar-dropdown.js` (`showDropdown`, `hideDropdown`, `toggleDropdown`, `bindDropdownEvents`) | `css/editor/editor-floating-toolbar/dropdown.css` | editor.html:156 |
| Editor view-options panel | `js/editor/editor-i18n-refresh.js` (`ensureViewOptionsControl`, `closeViewOptionsPanel`) | injected `#editorViewOptionsStyles` | editor.html:260 |
| Entity-search/autocomplete | `js/editor/editor-knowledge-link-ui.js` (`createSearchContainer`, `showDropdown`, `hideDropdown`, `selectEntity`, keyboard) | `css/editor/editor-detail-content/detail-info.css:266-393` | editor.html:194 |
| Connect-existing inline flow | `js/editor/templates/editor-detail-edit-mode-template.js:32-60`, `js/editor/editor-bindings.js` (`createConnectExistingController`) | editor detail edit CSS | editor.html |
| Native `confirm()`/`prompt()` | `js/editor/editor-memory-actions.js:870`, `js/editor/editor-canvas.js:134` (active); `js/my-trees/my-trees-actions.js:315,338` (trigger ids absent from page DOM); `js/utils/ui.js:173` (`LoveBudUI.showConfirm`, no callers) | n/a | editor.html, my-trees.html |

Dormant/unlinked (existence + status only):

```text
pages/chat-first-workspace.html — prototype "대화로 시작하는 러브트리"; loads only js/chat-first-workspace.js
   (no shared-header/auth/i18n). Contains .cfw-bottom-sheet (#cfwBottomSheet) + .cfw-bottom-sheet-overlay
   with no role/aria. No inbound nav links from any active page. LEGACY_OR_DORMANT.
pages/kimi-v2/my-trees.html — static design variant, 0 scripts, inline onclick location.href only.
   Contains .tree-overlay visibility badges (x3). No inbound links from active pages. LEGACY_OR_DORMANT.
```

Decorative (`DECORATIVE_NOT_INTERACTIVE`): `.noise-overlay` (`css/global/global-base.css:24-33`, `pointer-events:none`, opacity 0.04, z-index 9999, present on 13 pages, no JS handlers, no `aria-hidden`); kimi-v2 `.tree-overlay` (`assets/css/kimi-v2/my-trees.css:179-183`, static badges, no handlers).

## 4. Canonical classification criteria

A surface is classified by its **interaction contract**, never by appearance:

```text
TRUE_MODAL_OUT_OF_SCOPE  = in the six canonical modals (#3788/#3795); full lifecycle (role=dialog,
                           aria-modal, name, initial focus, Tab wrap, Escape, restore) already bounded there.
MODAL_SEMANTICS_OVER_APPLIED = declares role=dialog/aria-modal=true but has no trap, no scroll lock,
                           or its close path is page navigation (Settings card, AI panel sheet).
MODAL_SEMANTICS_MISSING  = visual overlay with no role, no aria-modal, no accessible name (Scout).
NON_MODAL_PANEL_CORRECT  = no dialog role and behavior matches non-modal panel/drawer (desktop detail
                           panel, preview sheets' sheet role, connect-existing inline).
MOBILE_DRAWER_VARIANT    = bottom-sheet/drawer layout that is a page-owned non-modal surface.
DISCLOSURE_OR_POPOVER    = positioned popover/menu with a trigger relationship (dropdown, view options).
INLINE_CONFIRMATION      = inline expanded region inside a page flow (connect-existing sections).
NATIVE_BROWSER_CONFIRMATION = window.confirm()/prompt() with UA authority.
SEMANTICALLY_INCOMPLETE  = partial lifecycle (Escape or backdrop present but no focus entry/restore,
                           or runtime role toggling, or missing ARIA roles) — not a true modal, not a
                           clean non-modal panel.
RUNTIME_DEFECT_CONFIRMED = a browser-observed broken behavior (unhandled exception, lost focus cue).
```

Decisions explicitly avoided: no single universal overlay component; no native `<dialog>` mandate; the six canonical modals remain out of scope.

## 5. Settings runtime audit

Surface: full-page card `#settingsCard` (`pages/settings.html:19`) carrying `role="dialog" aria-modal="true" aria-labelledby="settingsTitle"`.

| Question | Runtime observation | Strength |
|---|---|---|
| AX role / name / modal | `role=dialog`, name `설정`, `modal: true` | ACCESSIBILITY_TREE_CONFIRMED |
| Background reachability | Tab from the card reaches `#shared-header` links; AX full tree still lists header links; no focus trap anywhere | REAL_LOCAL_CONFIRMED |
| Initial focus | `document.activeElement` = BODY after boot | REAL_LOCAL_CONFIRMED |
| Escape | non-edit mode: `closeSettings()` navigates away — observed `settings.html → index.html` | REAL_LOCAL_CONFIRMED |
| Outside-click | clicks on content outside the card are `preventDefault`+`stopPropagation`-blocked (no close, no navigation) | REAL_LOCAL_CONFIRMED |
| Close button | `#settingsCloseBtn` click navigates (page-level close), it does not dismiss an overlay | SOURCE_CONFIRMED |
| Body scroll | no scroll lock; `body overflow: visible` | COMPUTED_STYLE_CONFIRMED |
| Mobile semantics | same `role=dialog aria-modal=true` at 390×844 — no semantic switch | REAL_LOCAL_CONFIRMED |
| Reduced motion | `transition: all` computed on the card; no page-level reduced-motion gate observed | COMPUTED_STYLE_CONFIRMED |

Classification: **MODAL_SEMANTICS_OVER_APPLIED** (page surface labeled dialog; close is navigation; no trap/scroll-lock; background keyboard-reachable). Runtime behavior is otherwise `RUNTIME_CORRECT` for a page (Escape/close navigate intentionally), so the defect is the **semantic over-application**, not a crash.

## 6. Scout runtime audit

Surface: dynamically created overlay `#scoutDraftModal.scout-draft-modal-overlay` + inner `.scout-draft-modal` (`js/scout/scout-draft-ui.js:116-272`).

| Question | Runtime observation | Strength |
|---|---|---|
| AX role / name | `#scoutDraftModal` AX `role=generic`, name `""`; no `aria-modal`; no `aria-hidden` | ACCESSIBILITY_TREE_CONFIRMED |
| Open trigger | `LoveBudScoutDraftUI.open` (bridged singleton from `js/editor.js:712-721`); also `ftbScoutAction` | SOURCE_CONFIRMED |
| Initial focus | focus → `#scoutSourceUrlInput` (controller `setTimeout` 50ms) | REAL_LOCAL_CONFIRMED |
| Tab / Shift+Tab | focus passes through the modal into background controls — **no trap** | REAL_LOCAL_CONFIRMED |
| Escape | closes (controller `escHandler` with `stopPropagation`) | REAL_LOCAL_CONFIRMED |
| Outside click | closes (`outsideClickHandler`, capture phase) | REAL_LOCAL_CONFIRMED |
| Focus restoration | **none** — after close `document.activeElement` remains inside the (now `display:none`) form (`#scoutDraftSuggestBtn`) | REAL_LOCAL_CONFIRMED |
| Body scroll | editor body `overflow:hidden` is the page's persistent app-shell layout (also present with the modal closed); the Scout controller itself does not lock scroll | COMPUTED_STYLE_CONFIRMED + SOURCE_CONFIRMED |
| Listener cleanup | CDP `DOMDebugger.getEventListeners`: document `keydown` 2 (baseline) → 3 (open, `escHandler`) → 2 (closed); `click` 8 → 9 → 8. Cleanup correct; reopen adds exactly one set | REAL_LOCAL_CONFIRMED (CDP) |
| Reopen idempotence | open/close/open/close behaves identically; no accumulation | REAL_LOCAL_CONFIRMED |
| Reduced motion | `.scout-draft-modal.is-open { animation: scout-fade-in 0.2s ease-out }` (`css/scout/scout-draft.css:28`) still animates under `prefers-reduced-motion: reduce` | COMPUTED_STYLE_CONFIRMED |

Classification: **MODAL_SEMANTICS_MISSING** (visual overlay with no role, no accessible name, no focus trap, no focus restoration, no scroll lock). Its Escape/outside-click/cleanup behavior is `RUNTIME_CORRECT`; the semantics and focus lifecycle are absent.

## 7. LoveBud AI panel runtime audit

Surface: `#lovebud-ai-side-panel.lovebud-ai-panel-container` → `.lovebud-ai-panel-sheet` (`js/ai/lovebud-ai-panel.js`).

| Question | Runtime observation | Strength |
|---|---|---|
| AX (closed) | container `aria-hidden="true"`; not focusable | SOURCE_CONFIRMED + REAL_LOCAL_CONFIRMED |
| AX (open) | sheet `role=dialog`, `aria-modal=true`, `aria-labelledby="lovebud-ai-panel-title"` (name `LoveBud Scout AI`) | ACCESSIBILITY_TREE_CONFIRMED |
| Open trigger | `data-lovebud-ai-trigger` click delegation → toggle; also `LoveBudAIPanel.open()` | SOURCE_CONFIRMED |
| Initial focus | focus → `#lovebudAIPanelInput` (controller `setTimeout` 100ms) | REAL_LOCAL_CONFIRMED |
| Tab / Shift+Tab | focus moves out of the sheet into background controls — **no trap** | REAL_LOCAL_CONFIRMED |
| Escape | closes (single `window` keydown listener registered once at init; gated by `isOpen`) | REAL_LOCAL_CONFIRMED |
| Reopen idempotence | CDP listener deltas across open/close/open/close: document `keydown` 2→2→2→2, `click` 9→9→9→9, window `keydown` 2→2→2→2 — **no duplication** | REAL_LOCAL_CONFIRMED (CDP) |
| Focus restoration | **none** — after Escape, `document.activeElement` is `""`/body; the invoker is not refocused | REAL_LOCAL_CONFIRMED |
| Backdrop / close button | `.lovebud-ai-panel-backdrop` click and `data-lovebud-ai-close` click both close | REAL_LOCAL_CONFIRMED |
| Trigger `aria-expanded` | toggled `true`/`false` in `updateState()` on every trigger | REAL_LOCAL_CONFIRMED |
| Body class | `lovebud-ai-panel-open` toggled on open/close | REAL_LOCAL_CONFIRMED |
| Mobile | at 390×844 the sheet keeps `role=dialog aria-modal=true`; layout becomes a bottom sheet via CSS — **role does not switch** at the breakpoint | REAL_LOCAL_CONFIRMED + COMPUTED_STYLE_CONFIRMED |
| Reduced motion | `.lovebud-ai-panel-sheet { transition: transform 0.38s cubic-bezier(0.16,1,0.3,1) }` (`lovebud-ai-panel.css:144`) still transitions under `prefers-reduced-motion: reduce` | COMPUTED_STYLE_CONFIRMED |

Classification: **MODAL_SEMANTICS_OVER_APPLIED** (declares `role=dialog aria-modal=true` yet is a non-modal sheet with no trap, no scroll lock, no focus restoration) and **SEMANTICALLY_INCOMPLETE**. The trigger/aria-expanded/backdrop/Escape behavior is `RUNTIME_CORRECT`; listener hygiene is verified clean.

## 8. Editor desktop/mobile panel audit

### 8.1 Desktop detail panel

Owner: `#detailPanel` `<aside>` (`editor-detail-panel-shell-template.js`), desktop collapse via `js/editor/editor-rail-collapse.js`.

| Question | Runtime observation | Strength |
|---|---|---|
| Role / aria-modal | `role=null`, `aria-modal=null`, `aria-hidden="false"`; AX role `complementary` (aside), name `""` | ACCESSIBILITY_TREE_CONFIRMED |
| Selection | selecting a `.memory-node` renders view-mode detail; the panel never acquires dialog semantics | REAL_LOCAL_CONFIRMED |
| Rail collapse | `#editorRightRailCollapseBtn` click → panel `inert=true`, `aria-hidden="true"`, button `aria-expanded="false"` | REAL_LOCAL_CONFIRMED |

Classification: **NON_MODAL_PANEL_CORRECT** — the desktop panel carries no modal semantics; collapse isolation is correct.

### 8.2 Mobile panels/drawers

Owner: `js/editor/editor-mobile-panel-hierarchy.js` (`MOBILE_QUERY = '(max-width: 768px)'`), static toggles `#mobileTreePanelToggle`/`#mobileDetailPanelToggle`/`#editorMobilePanelBackdrop` in `pages/editor.html`.

| Question | Runtime observation | Strength |
|---|---|---|
| Open (mobile 390px) | tree panel: sidebar `role=dialog`, `aria-modal=true`, `aria-label="트리 정보"`, `tabindex=-1`; toggle `aria-expanded=true`; layout `.has-mobile-panel-open`; backdrop visible; focus → `#mobileSidebarPanelCloseBtn` | ACCESSIBILITY_TREE_CONFIRMED + REAL_LOCAL_CONFIRMED |
| AX (open) | sidebar AX `role=dialog`, name `트리 정보`, `modal=true` | ACCESSIBILITY_TREE_CONFIRMED |
| Tab / Shift+Tab | focus wraps inside the panel (`trapTabKey`) — 8-key sequence all `IN_PANEL` | REAL_LOCAL_CONFIRMED |
| Escape | closes; focus restored to `#mobileTreePanelToggle` | REAL_LOCAL_CONFIRMED |
| Backdrop click | closes | REAL_LOCAL_CONFIRMED |
| Close button | `#mobileSidebarPanelCloseBtn` closes | SOURCE_CONFIRMED |
| Mobile → desktop transition | resize 390→1440: `is-mobile-panel-open` removed, `role`/`aria-modal` removed, `aria-hidden="false"`, backdrop hidden, layout class cleaned — **no stale drawer state** | REAL_LOCAL_CONFIRMED |

Classification: **MOBILE_DRAWER_VARIANT** whose drawer lifecycle (trap, Escape, restore, backdrop, transition cleanup) is `RUNTIME_CORRECT`; the runtime toggling of `role=dialog`/`aria-modal` on a persistent panel that is non-modal on desktop is flagged **SEMANTICALLY_INCOMPLETE** (the semantic contract changes with the viewport).

## 9. Browse preview-sheet audit

Surface: static `#previewSidebar` (`pages/search.html:108`) + controller `js/search/search-mobile-preview-sheet.js`.

| Question | Runtime observation | Strength |
|---|---|---|
| Open (480-768px) | card click → sheet `.is-open`, overlay `.preview-sheet-overlay` (`aria-hidden="true"`), body `preview-sheet-open` + `style.top` offset, body `overflow:hidden position:fixed` (scroll lock) | REAL_LOCAL_CONFIRMED |
| Open at 390px | **card click at `<480px` navigates to `view.html?treeId=…`** instead of opening the sheet (`shouldUseMobileOpen() = innerWidth < 480` → `getCardActivationAction` returns `open` → `window.location.href = viewerHref`, `search-card-events.js:20-31,72`) | REAL_LOCAL_CONFIRMED + SOURCE_CONFIRMED |
| Persists to 390px | sheet opened at 640px stays `.is-open` after resize to 390×844 | REAL_LOCAL_CONFIRMED |
| AX / role | sheet has no `role`/`aria-modal`/`aria-hidden`; AX `role=complementary` (aside), name `""` | ACCESSIBILITY_TREE_CONFIRMED |
| Focus | focus stays on the selected card (`#tree-card-audit-tree-1`); **no focus entry and no focus restoration** | REAL_LOCAL_CONFIRMED |
| Escape | **not handled** — Escape leaves the sheet open | REAL_LOCAL_CONFIRMED |
| Backdrop click | closes (`ui.clearSelectedPreview`) | REAL_LOCAL_CONFIRMED |
| Close button | `#previewMobileClose` closes | REAL_LOCAL_CONFIRMED |
| Scroll cleanup | after close: `preview-sheet-open` removed, `body.style.top` cleared, overlay removed | REAL_LOCAL_CONFIRMED |
| Mobile → desktop | resize to 1440 removes `.is-open` and overlay | REAL_LOCAL_CONFIRMED |
| URL/selection preservation | selection kept in `state.selectedTreeId`; `?tree=` URL param synced (`search-url-state.js`); close preserves open state via `preserveOpenState` wrapper | SOURCE_CONFIRMED |
| Reduced motion | `.preview-sidebar` slide-up suppressed (transition/animation `none`) under `reduce` | COMPUTED_STYLE_CONFIRMED |

Classification: **MOBILE_DRAWER_VARIANT**, non-modal by design and **NON_MODAL_PANEL_CORRECT** for role semantics; **SEMANTICALLY_INCOMPLETE** because it has no Escape handler and no focus management. The `<480px` viewer navigation is the product's current open policy, recorded as a runtime behavior (not a crash).

## 10. My Trees preview-sheet audit

Surface: static `#myTreesHubPanel` (`pages/my-trees.html:75`) + controller `js/my-trees/my-trees-mobile-preview-sheet.js`. Independent implementation (not shared with Browse).

| Question | Runtime observation | Strength |
|---|---|---|
| Open | **auto-opens on mobile when a tree exists** (`hub.showContent` patch), otherwise card click (`onCardClick` patch) | REAL_LOCAL_CONFIRMED + SOURCE_CONFIRMED |
| Scroll lock | identical pattern: body `preview-sheet-open` + `style.top` + `overflow:hidden position:fixed` | REAL_LOCAL_CONFIRMED |
| AX / role | no `role`/`aria-modal`; overlay `aria-hidden="true"` | ACCESSIBILITY_TREE_CONFIRMED |
| Escape | **handled** — closes (`my-trees-mobile-preview-sheet.js:99-104`) | REAL_LOCAL_CONFIRMED |
| Backdrop click | closes | REAL_LOCAL_CONFIRMED |
| Close button | `#myTreesHubClose` closes | REAL_LOCAL_CONFIRMED |
| Scroll cleanup | `preview-sheet-open` removed and `style.top` cleared after close | REAL_LOCAL_CONFIRMED |
| Focus management | **none** (entry or restoration) | SOURCE_CONFIRMED |
| Media-query listener | `addEventListener('change', …)` with no removal/cleanup in source | SOURCE_CONFIRMED |

Classification: **MOBILE_DRAWER_VARIANT**, **NON_MODAL_PANEL_CORRECT** for role semantics; **SEMANTICALLY_INCOMPLETE** for missing focus management. Escape handling is `RUNTIME_CORRECT` (unlike Browse). The two sheets are `DUPLICATE_CANDIDATE` scroll-lock/overlay implementations (see #3788 §13.2).

## 11. Toolbar/menu/entity popover audit

### 11.1 Editor floating-toolbar "..." dropdown

Owner: `#ftbMoreBtn` + `#ftbDropdown[role=menu][aria-label="추가 행동"]` (`editor-floating-toolbar-template.js:16-45`), controller `editor-floating-toolbar-dropdown.js`.

| Question | Runtime observation | Strength |
|---|---|---|
| Static semantics | `role=menu`, 6 `role=menuitem` items; trigger `aria-haspopup="true"` `aria-expanded="false"`; **no `aria-controls`** on the trigger | ACCESSIBILITY_TREE_CONFIRMED + SOURCE_CONFIRMED |
| Open (edit-mode flow) | enter edit mode + select node → toolbar visible; `#ftbMoreBtn` click → dropdown visible, `aria-expanded="true"`; AX `role=menu`, name `추가 행동` | ACCESSIBILITY_TREE_CONFIRMED + REAL_LOCAL_CONFIRMED |
| Escape | toolbar-level `keydown` closes the dropdown (also hides toolbar/deselects) | REAL_LOCAL_CONFIRMED |
| Outside click | `document` click outside dropdown+trigger closes | REAL_LOCAL_CONFIRMED |
| Focus management | **none** on open/close; focus stays on the trigger; menu-item arrow navigation is not implemented (arrows drive toolbar buttons only) | SOURCE_CONFIRMED |
| Confirmed defect | Escape branch calls `emptySpot.click()` on `.canvas-svg`, which is an `SVGElement`; Chromium has no `SVGElement.prototype.click` — **unhandled `TypeError: emptySpot.click is not a function`** whenever the toolbar holds keyboard focus during Escape | REAL_LOCAL_CONFIRMED |

Classification: **DISCLOSURE_OR_POPOVER** with one **RUNTIME_DEFECT_CONFIRMED** (see §17 D1).

### 11.2 Editor view-options panel

Owner: `#editorViewOptionsBtn` + `#editorViewOptionsPanel` (no role), `js/editor/editor-i18n-refresh.js:121-192`.

| Question | Runtime observation | Strength |
|---|---|---|
| Trigger | `aria-expanded` toggles, `aria-controls="editorViewOptionsPanel"` | REAL_LOCAL_CONFIRMED |
| Panel role | **no role** (AX `role=generic`) | ACCESSIBILITY_TREE_CONFIRMED |
| Open/close | click toggles `hidden`; Escape and outside-click close; `aria-expanded` resyncs | REAL_LOCAL_CONFIRMED |
| Focus | no focus moved into the panel on open; no restoration | SOURCE_CONFIRMED |

Classification: **DISCLOSURE_OR_POPOVER**, `SEMANTICALLY_INCOMPLETE` (no role, no focus move).

### 11.3 Entity-search / autocomplete

Owner: `js/editor/editor-knowledge-link-ui.js` (`.entity-search-input`, `.entity-search-dropdown`, `.entity-search-dropdown-item`).

| Question | Runtime observation | Strength |
|---|---|---|
| ARIA roles | **none** — no `combobox`, no `listbox`, no `option`, no `aria-expanded`, no `aria-controls`, no `aria-activedescendant` | SOURCE_CONFIRMED |
| Keyboard | ArrowUp/Down cycles highlight, Enter selects, Escape hides, blur hides after 200ms | SOURCE_CONFIRMED |
| Close policy | blur-based only; no outside-click handler | SOURCE_CONFIRMED |
| Focus | stays in the input; no restoration needed but no listbox announcement either | SOURCE_CONFIRMED |

Classification: **DISCLOSURE_OR_POPOVER** / **SEMANTICALLY_INCOMPLETE** (fully missing ARIA for an autocomplete; the live editor path requires a selected memory in edit mode, so runtime AX evidence was not reachable headlessly — marked `UNRESOLVED_RUNTIME` for announcement behavior).

## 12. Connect-existing runtime audit

Owner: inline sections in `editor-detail-edit-mode-template.js:32-60` (`connectExistingCtaSection` / `PendingSection` / `ConfirmSection`), controller `createConnectExistingController` in `js/editor/editor-bindings.js:377-637`.

| Question | Runtime observation | Strength |
|---|---|---|
| Semantics | **no `role=dialog`, no `aria-modal`, no `aria-expanded`, no inert**; plain inline card toggling `hidden`/`style.display` + `aria-hidden` | SOURCE_CONFIRMED |
| Focus order | no focus trap; flow proceeds by clicking canvas nodes (pending-connect mode) | SOURCE_CONFIRMED |
| Cancel/back | pending cancel and confirm-cancel reset the flow and return to the CTA | SOURCE_CONFIRMED |
| Page blocking | **none** — canvas interaction is not blocked; only the add-memory form's own region-inert (`#detailContent`) applies while that form is open | SOURCE_CONFIRMED |
| NC10 | a disposable copy declaring `role=dialog aria-modal=true` on the connect card was correctly detected as non-modal (focus escapes to background) | NEGATIVE_CONTROL_CONFIRMED |

Classification: **INLINE_CONFIRMATION** / **NON_MODAL_PANEL_CORRECT**; `RUNTIME_CORRECT` for inline semantics. It must never be labeled a modal.

## 13. Native confirm/prompt inventory

| Owner | Call | Operation | Status |
|---|---|---|---|
| `js/editor/editor-memory-actions.js:870` | `confirm(i18n('delete_confirm'))` | delete selected moment | ACTIVE (`NATIVE_BROWSER_CONFIRMATION`) |
| `js/editor/editor-canvas.js:134` | `window.confirm('이 순간의 연결을 해제할까요?')` | disconnect edge | ACTIVE (`NATIVE_BROWSER_CONFIRMATION`) |
| `js/my-trees/my-trees-actions.js:315` | `prompt(rename_tree_prompt)` | rename tree | DORMANT — trigger `#manageRenameBtn` (looked up in `my-trees-manage-summary.js:55`) absent from current page HTML |
| `js/my-trees/my-trees-actions.js:338` | `confirm(delete_tree_confirm)` | delete tree | DORMANT — trigger `#manageDeleteBtn` (`my-trees-manage-summary.js:56`) absent from current page HTML |
| `js/utils/ui.js:173` | `LoveBudUI.showConfirm` wrapper | generic confirm | DEAD — no runtime callers |

Runtime check: `window.confirm`/`window.prompt` are native functions on the editor page. The editor flows keep native authority for destructive confirmations; the My Trees flows are effectively unreachable today (recorded, not triggered). Any future styled destructive dialog must preserve `delete_tree_confirm`/`rename_tree_prompt` semantics under My Trees owner authority (#3788 §8).

## 14. Cross-surface focus/Escape/scroll/restoration matrix

| Surface | Initial focus | Tab/Shift+Tab | Escape | Backdrop/outside | Focus restoration | Body scroll lock |
|---|---|---|---|---|---|---|
| Settings card | body (none) | no trap (escapes) | navigates away | blocked (no close) | n/a (navigation) | none |
| Scout overlay | `#scoutSourceUrlInput` | no trap | closes | closes | **none** | none (page-level) |
| AI panel sheet | `#lovebudAIPanelInput` | no trap | closes | closes | **none** | none |
| Editor desktop detail | n/a (persistent) | n/a | n/a | n/a | n/a | none |
| Editor mobile drawer | `#mobileSidebarPanelCloseBtn` | **trapped (wrap)** | closes | closes | **restored to toggle** | none |
| Browse preview sheet | none (stays on card) | n/a | **not handled** | closes | **none** | `body.preview-sheet-open` + `style.top` |
| My Trees preview sheet | none | n/a | **handled** | closes | **none** | `body.preview-sheet-open` + `style.top` |
| FTB dropdown | none (stays on trigger) | n/a (toolbar roving) | closes (toolbar-level) | closes | **none** | none |
| View-options panel | none (stays on button) | n/a | closes | closes | **none** | none |
| Entity-search | input | arrows/Enter (input) | hides dropdown | blur-based only | stays in input | none |
| Connect-existing | none | n/a | n/a | n/a | n/a | none |

## 15. Accessibility-tree and computed-style evidence matrix

| Surface | AX role (open) | AX name | aria-modal | Evidence strength |
|---|---|---|---|---|
| `#settingsCard` | dialog | 설정 | true | ACCESSIBILITY_TREE_CONFIRMED |
| `#scoutDraftModal` | generic | (empty) | — | ACCESSIBILITY_TREE_CONFIRMED |
| `.lovebud-ai-panel-sheet` | dialog | LoveBud Scout AI | true | ACCESSIBILITY_TREE_CONFIRMED |
| `#detailPanel` (desktop) | complementary | (empty) | — | ACCESSIBILITY_TREE_CONFIRMED |
| editor sidebar (mobile drawer) | dialog | 트리 정보 | true | ACCESSIBILITY_TREE_CONFIRMED |
| `#previewSidebar` (Browse) | complementary | (empty) | — | ACCESSIBILITY_TREE_CONFIRMED |
| `#myTreesHubPanel` (My Trees) | complementary | (empty) | — | ACCESSIBILITY_TREE_CONFIRMED |
| `#ftbDropdown` | menu | 추가 행동 | — | ACCESSIBILITY_TREE_CONFIRMED |
| `#editorViewOptionsPanel` | generic | (empty) | — | ACCESSIBILITY_TREE_CONFIRMED |

Computed-style highlights (COMPUTED_STYLE_CONFIRMED): Browse/My Trees scroll-lock `body { position:fixed; overflow:hidden }` + `style.top` offset; mobile drawer role switch (editor) at `(max-width:768px)`; AI sheet bottom-sheet geometry at 390px; reduced-motion gaps (§16).

## 16. Forced-colors and reduced-motion findings

Forced-colors (CDP `Emulation.setEmulatedMedia` forced-colors active):

| Control | Focus indicator under WHCM | Finding |
|---|---|---|
| `.settings-close-btn:focus-visible` | `outline: solid 2px` preserved | adequate structure (color mapped to system color) |
| editor mobile close button | `outline: auto 1px` (UA default) | preserved |
| `.search-input:focus` (Browse) | **`outline: none`, `box-shadow: none`** — only a border-color change survives | **RUNTIME_CONFIRMED `MISSING_COVERAGE`** (matches #3753 §2) |

Reduced-motion (Chromium `prefers-reduced-motion: reduce`):

| Surface | Open animation/transition | Finding |
|---|---|---|
| Scout `.scout-draft-modal.is-open` | `animation: scout-fade-in 0.2s ease-out` still applies | reduced-motion gap (no `prefers-reduced-motion` gate) |
| AI `.lovebud-ai-panel-sheet` | `transition: transform 0.38s …` still applies | reduced-motion gap |
| Browse `.preview-sidebar` | transition/animation `none` | correct |
| Editor mobile drawer | transition/animation `none` | correct |
| Settings card | `transition: all` computed | gap (matches #3753 "reduced-motion NOT YET IMPLEMENTED") |

## 17. Confirmed defects versus correct non-modal patterns

### Confirmed defects (`RUNTIME_DEFECT_CONFIRMED`)

**D1 — Editor floating-toolbar Escape throws `emptySpot.click is not a function`.**
- Source owner: `js/editor/editor-floating-toolbar-keyboard.js` Escape branch (toolbar `keydown`, calls `canvasArea.querySelector('.canvas-svg').click()`).
- Selector/identifier: `.canvas-svg` (SVGElement) inside `#canvasArea`; triggered from `#ftbMoreBtn` focus.
- Browser scenario: editor (owner, edit mode) → select `.memory-node` → focus `#ftbMoreBtn` → press Escape.
- Expected contract: Escape deselects, hides toolbar/dropdown, and clears the detail-panel selection by clicking the empty canvas.
- Observed: `TypeError: emptySpot.click is not a function` is thrown as an unhandled pageerror; the "clear detail selection via canvas click" side effect never runs (deselect and `hideToolbar()` execute before the throw).
- User impact: keyboard Escape inside the floating toolbar leaves the detail-panel selection semantics uncleared and surfaces an uncaught console error; Chromium exposes no `SVGElement.prototype.click`.
- Minimum correction scope: guard with `typeof emptySpot.click === 'function'` or dispatch a `MouseEvent('click', { bubbles: true })` on the canvas spot; bounded to `editor-floating-toolbar-keyboard.js`.

**D2 — Settings card: `role=dialog` + `aria-modal=true` over-applied to a full-page surface.**
- Source owner: `pages/settings.html:19` (`#settingsCard`); close semantics in `js/settings.js:74-91,1013-1047`.
- Browser scenario: any settings load (desktop or mobile).
- Expected contract: a page should not be announced as a modal dialog with `aria-modal=true` while background content stays keyboard-reachable and close is a page navigation.
- Observed: AX `role=dialog`, `modal=true`; Tab freely reaches the background header; Escape/close navigate away.
- User impact: screen-reader users hear "dialog" and may expect a trapped overlay; there is none. This is the single clearest over-application in the surface set.
- Minimum correction scope: remove `role=dialog`/`aria-modal` from `#settingsCard` (or convert to a genuine overlay with trap/restore); bounded to `pages/settings.html` + `js/settings.js` close contract.

**D3 — AI panel sheet: `aria-modal=true` declared without trap, scroll lock, or focus restoration.**
- Source owner: `js/ai/lovebud-ai-panel.js:89-93` (sheet `role=dialog aria-modal=true`), `open/close/updateState`.
- Browser scenario: open the AI panel from any hosting page; Tab/Shift+Tab; Escape; reopen.
- Expected contract: a surface declared `aria-modal=true` should contain focus while open and restore it on close.
- Observed: Tab leaves the sheet; Escape leaves focus on body; no restoration; body not scroll-locked.
- User impact: a "modal" that is actually a non-modal sheet; keyboard/screen-reader expectation mismatch.
- Minimum correction scope: either add a real modal lifecycle (trap + restore + scroll lock) or drop `aria-modal`/`role=dialog` and expose it as a complementary sheet; bounded to `lovebud-ai-panel.js` + `css/components/lovebud-ai-panel.css`.

**D4 — Scout overlay: `MODAL_SEMANTICS_MISSING`.**
- Source owner: `js/scout/scout-draft-ui.js:116-272` (`createModalInDOM`, `openModal`, `closeModal`).
- Browser scenario: open the Scout draft overlay (editor); inspect AX tree; Tab; Escape; close.
- Expected contract: an interactive overlay that traps-style Escape and outside-click close should at minimum expose an accessible name/role and manage focus.
- Observed: AX `role=generic` with empty name; no `aria-modal`; no trap; no restoration; no scroll lock.
- User impact: screen-reader users get no dialog/region announcement and no focus contract.
- Minimum correction scope: add an accessible name and role (or a complementary/region semantics), initial-focus + guarded restore + optional scroll lock, all inside `scout-draft-ui.js`/`scout-draft.css`.

**D5 — Browse preview sheet: no Escape handler and no focus management.**
- Source owner: `js/search/search-mobile-preview-sheet.js` (overlay/close only).
- Browser scenario: open sheet on mobile; press Escape; Tab.
- Expected contract: a closing drawer reached by keyboard should honor Escape and manage focus entry/restoration.
- Observed: Escape does nothing; focus remains on the invoking card; after close no restoration is needed because focus never moved.
- User impact: keyboard-only users cannot dismiss the sheet with Escape (My Trees already handles Escape).
- Minimum correction scope: add Escape close and, if focus is moved into the sheet on open, restore it on close; bounded to `search-mobile-preview-sheet.js`.

**D6 — Entity-search autocomplete has no ARIA contract.**
- Source owner: `js/editor/editor-knowledge-link-ui.js` (`.entity-search-input/.entity-search-dropdown`).
- Browser scenario: not reachable headlessly without a selected memory in edit mode (`UNRESOLVED_RUNTIME` for live behavior); source-confirmed zero ARIA.
- Expected contract: combobox/listbox/option roles with `aria-expanded`, `aria-controls`, `aria-activedescendant`.
- User impact: screen-reader users receive no autocomplete semantics.
- Minimum correction scope: add the combobox contract in `editor-knowledge-link-ui.js` (no shell change).

### Correct non-modal patterns (`RUNTIME_CORRECT` / `NON_MODAL_PANEL_CORRECT`)

- Editor desktop detail panel: no dialog role; collapse uses `inert` + `aria-hidden` (correct isolation).
- Editor mobile drawer lifecycle: Tab trap, Escape, backdrop, focus restore, and clean mobile↔desktop transition cleanup (no stale `is-mobile-panel-open`/`role`).
- My Trees preview sheet: Escape handled; scroll-lock class/`style.top` cleaned on every close path.
- Browse sheet: non-modal role semantics are correct (no false dialog label); scroll cleanup correct.
- Connect-existing: inline, never modal; no page blocking.
- Listener hygiene: Scout adds exactly one Escape/outside-click listener pair per open and removes it on close (CDP-verified); AI panel binds once at init and never duplicates across reopen.
- Trigger `aria-expanded`/`aria-controls`: AI panel triggers and the view-options button sync correctly.

## 18. Compatibility identifiers

Identifiers a later implementation child must preserve or deliberately migrate (`COMPATIBILITY_IDENTIFIER`, SOURCE_CONFIRMED):

```text
Settings:      #settingsCard, #settingsCloseBtn, #settingsTitle, closeSettings(), bindCloseInteractions()
               (settings.js:74-91,1013-1047; settings.html:19-21)
Scout:         #scoutDraftModal, .scout-draft-modal-overlay, .scout-draft-modal, #scoutDraftCloseBtn,
               #scoutSourceUrlInput, #scoutDraftSaveBtn, #scoutDraftCancelBtn, #scoutDraftPreviewBtn,
               #scoutDraftSuggestBtn, LoveBudScoutDraftUI.open/close/isOpen, createScoutDraftUI(deps)
AI panel:      #lovebud-ai-side-panel, .lovebud-ai-panel-sheet, -backdrop, -close-btn,
               data-lovebud-ai-panel/-overlay/-close/-trigger, aria-labelledby="lovebud-ai-panel-title",
               body.lovebud-ai-panel-open, LoveBudAIPanel.init/open/close/toggle/isOpen
Editor desktop: #detailPanel, #editorRightRailCollapseBtn (aria-controls="detailPanel"),
               editor-rail-collapse.js setInert
Editor mobile: #mobileTreePanelToggle, #mobileDetailPanelToggle, #editorMobilePanelBackdrop,
               #mobileSidebarPanelCloseBtn, #mobileDetailPanelCloseBtn, .is-mobile-panel-open,
               .has-mobile-panel-open, openPanel/closePanel/trapTabKey/applyClosedState/applyDesktopState,
               MOBILE_QUERY '(max-width: 768px)' (editor-mobile-panel-hierarchy.js)
Browse sheet:  #previewSidebar, #previewMobileClose, .preview-sheet-overlay, .preview-sidebar.is-open,
               body.preview-sheet-open, setMobilePreviewOpen/syncPreviewVisibility, shouldUseMobileOpen
               (search-card-events.js:20-31), selectTree openMobilePreview option
My Trees sheet: #myTreesHubPanel, #myTreesHubClose, .preview-sheet-overlay, body.preview-sheet-open,
               LoveBudMyTreesPreviewHub.onCardClick/showPlaceholder/showContent patches
FTB dropdown:  #ftbMoreBtn (aria-expanded/aria-haspopup), #ftbDropdown[role=menu], [role=menuitem],
               LoveBudFloatingToolbarDropdown.show/hide/toggle
View options:  #editorViewOptionsBtn, #editorViewOptionsPanel, closeViewOptionsPanel()
Entity search: .entity-search-input, .entity-search-dropdown, .entity-search-dropdown-item,
               .entity-search-chip, selectedEntities, selectEntity()
Connect-existing: #editConnectExistingCard, #connectExistingCtaBtn, #connectExistingPendingSection,
               #connectExistingConfirmSection, createConnectExistingController
Native dialogs: delete_confirm (editor), edge-disconnect confirm copy, delete_tree_confirm,
               rename_tree_prompt (My Trees dormant)
```

## 19. UNRESOLVED_RUNTIME

```text
1. Whether aria-modal=true on Settings/AI sheet causes real AT (NVDA/VoiceOver) to hide the background.
   CDP getFullAXTree still lists background nodes; aria-modal exclusion is applied by AT, not provable
   headlessly without a real assistive technology. (Real AT needed.)
2. The <480px Browse "open → view.html" policy (shouldUseMobileOpen) — recorded as behavior; product
   intent (sheet vs viewer at smallest widths) not confirmed by an owner.
3. Entity-search live AX behavior — unreachable headlessly without edit-mode memory selection; the
   combobox/listbox contract absence is SOURCE_CONFIRMED but live announcements are not.
4. My Trees native confirm/prompt reachability — ids absent from current page DOM, but an owner may
   later wire alternate triggers; runtime trigger not exercised (destructive actions not executed).
5. Actual screen-reader announcement of runtime role=dialog toggling on the editor mobile drawers.
```

## 20. Ordered future implementation children — maximum 3

All bounded, independently reviewable, and under the #3672 program; none implemented by this audit. No universal overlay component is proposed; every fix stays page-owned.

**Child 1 — Semantic gap closure for dialog-labeled surfaces** (U3 runtime-sensitive; highest impact).
- Scope: D2 (Settings role/aria-modal removal), D3 (AI sheet semantics — add real lifecycle or drop dialog claims), D4 (Scout role/name + focus), D5 (Browse Escape + focus), D6 (entity-search combobox contract), and the editor-mobile `role=dialog` runtime toggling decision (keep drawer semantics + document, or add a full trap when in dialog state).
- Candidate files: `pages/settings.html`, `js/settings.js`, `js/ai/lovebud-ai-panel.js`, `js/scout/scout-draft-ui.js`, `js/search/search-mobile-preview-sheet.js`, `js/editor/editor-knowledge-link-ui.js`, `js/editor/editor-mobile-panel-hierarchy.js`, per-surface CSS.
- Browser verification: YES (AX tree + focus/keyboard + WHCM per touched surface).
- Non-overlap: no shared helper extraction (Child 2), no `<dialog>` pilot (not in this set).

**Child 2 — Editor floating-toolbar Escape defect + dropdown contract** (U3 runtime-sensitive).
- Scope: D1 fix (`emptySpot` click guard) and the `#ftbDropdown` contract (add `aria-controls` on `#ftbMoreBtn`, decide menu-vs-popover semantics, add focused-item management or document roving limitations).
- Candidate files: `js/editor/editor-floating-toolbar-keyboard.js`, `js/editor/editor-floating-toolbar-dropdown.js`, `js/editor/editor-floating-toolbar-template.js`.
- Browser verification: YES (Escape regression + AX menu name/controls + keyboard).
- Non-overlap: does not touch settings/scout/AI semantics (Child 1).

**Child 3 — Forced-colors + reduced-motion runtime closure for non-modal surfaces** (U2/U3).
- Scope: runtime-confirmed gaps — `.search-input` WHCM focus loss (box-shadow-only), Scout `scout-fade-in`, AI sheet 0.38s transform transition, settings `transition: all`; add `@media (prefers-reduced-motion: reduce)` and WHCM-safe focus indicators per surface.
- Candidate files: `css/search/search-controls.css`, `css/scout/scout-draft.css`, `css/components/lovebud-ai-panel.css`, `css/settings/**`.
- Browser verification: YES (forced-colors emulation + reduced-motion emulation; extends #3753).
- Non-overlap: no JS/ARIA changes; CSS-only.

## 21. Explicit non-actions

```text
no product HTML/CSS/JS change
no test/registry/classification change
no package/lockfile/workflow change
no Production/Preview/Cloudflare mutation
no real account/private data/token/cookie/API/DB/provider access
no modification of PR #3797/#3780 or #3794 worktrees
no Ready/merge/Issue closure by the worker (including #3672 and #1882; Refs only)
no reset/clean/stash/rebase/amend/force push
no screenshots/traces/videos in the repository
no new universal overlay component
```

## 22. Repository-only rollback

This record is additive (one new `docs/` file). Rollback is branch deletion / revert of the single-file Draft PR with no runtime state. Future children are rollback-safe per PR: each carries its own contract update, making surface change + contract guard atomic (the pattern established by the modal-related contracts).

Refs #3799.
Refs #3788 — completed source authority.
Refs #3753 — completed focus audit.
Refs #3672 — Keep OPEN.
Refs #1882 — Keep OPEN.
