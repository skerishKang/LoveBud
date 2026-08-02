# Modal and Dialog Ownership Boundary Decision

Source-only architecture/design-system decision for Issue #3788 (parent design-system program #3672). Determines the canonical modal/dialog taxonomy and ownership boundaries for LoveBud. No runtime, markup, CSS, JavaScript, test-harness, browser, or Production change is authorized by this document.

## 1. Status and exact source baseline

```text
Status:      FINAL merged decision authority
Baseline:    origin/main 1ae856c52c7af1a8d4d2e4a7978ab46fe603a18f
Issue:       #3788 — Decide canonical modal and dialog ownership boundaries (source-only) — CLOSED completed
Merge:       PR #3789 — bfebb14b174ebc68eec4b7e7f02f668086b366a5
Parent:      #3672 — Keep OPEN
Authorities: #3706 CANONICAL_COMPONENT_VARIANT_INVENTORY_CONTRACT.md (§4.13 Modal/Dialog)
             #3753 FORCED_COLORS_FOCUS_COVERAGE_AUDIT.md (§6 Modal/dialog controls)
             SECONDARY_ACTION_FOCUS_TREATMENT_DECISION.md
```

Evidence vocabulary (Issue #3788):

```text
SOURCE_CONFIRMED             directly read from current source
TRUE_MODAL_DIALOG            full modal lifecycle in source
NON_MODAL_PANEL              persistent/side surface without modal semantics
POPOVER_OR_MENU              dropdown/positioned popover, not a modal
PAGE_OWNED                   surface owned by a single page
AUTHORITY_OWNED              shared/design-system owned
SHARED_PRESENTATION_CANDIDATE  visual tokens safe to share
SHARED_LIFECYCLE_CANDIDATE     accessibility lifecycle safe to share
SEMANTICALLY_INCOMPLETE      missing modal semantics/lifecycle
DUPLICATE_CANDIDATE          repeated near-identical implementation
LEGACY_CANDIDATE             native/experimental surface not converged
COMPATIBILITY_IDENTIFIER     selector/id/helper a later child must preserve
IMPLEMENTATION_REQUIRED_LATER  deferred to a future child (max 3)
UNRESOLVED_RUNTIME           browser-observable claim not provable from source
NOT_APPLICABLE               not relevant to a given surface
```

## 2. Scope and evidence limits

- Scope: inventory and classify every active modal, dialog, overlay, drawer, popover, and modal-like surface in current LoveBud source; separate true modals from non-modal panels; record ownership for shell creation, open/close lifecycle, focus, Escape, backdrop, scroll lock, inert/aria-hidden isolation, accessible naming, destructive confirmation, and cleanup; decide which responsibilities may become shared and which must remain page/authority-owned.
- Evidence boundary: `index.html`, the active `pages/*.html`, `js/index-inline-init.js`, `js/editor/**`, `js/settings.js`, `js/search/**`, `js/my-trees/**`, `js/detail/**`, `js/shared/**`, `js/auth/**`, `js/scout/**`, `js/ai/**`, `css/index/**`, `css/editor/**`, `css/settings*.css`, `css/search/**`, `css/my-trees/**`, `css/detail/**`, `css/shared/**`, `css/components/**`, the three design authorities, and the source-static/browser contracts that lock modal selectors.
- Limits: no browser, Playwright, screenshot, Preview, Production, local runtime, API, DB, provider, or real-login verification. Claims only a browser could prove are labeled `UNRESOLVED_RUNTIME`. This decision is independent of #3783/#3787/#3780 and does not modify them or #3786 (parallel filter-chip decision).

## 3. Discovery method and source inventory

Method: `rg` over pages/js/css/tests for `role="dialog"`, `aria-modal`, `aria-labelledby`, `aria-describedby`, `showModal`, `<dialog`, `modal`, `overlay`, `backdrop`, `inert`, `Escape`, `keydown`, `focus`, `restore`, `confirm`, `destructive`, `close button`; then read each active controller and its markup/CSS. Active (loaded) sources were separated from dormant/experimental sources by checking page `<script>` loading and nav linkage.

Key source facts:

- No current source uses native `<dialog>` or `showModal()` — every modal is a bespoke controller over regular elements.
- No `inert` polyfill bootstrap exists; `inert` is used natively only by the Editor memory-form modal (`js/editor/editor-memory-form.js:125-131`) and the rail-collapse helper (`js/editor/editor-rail-collapse.js:56-62`).
- Native `confirm()`/`prompt()` are used for My Trees destructive flows (`js/my-trees/my-trees-actions.js:338`, `~310`), not styled dialogs.
- The canonical inventory records the family as "Dispersed. No single modal authority." (`CANONICAL_COMPONENT_VARIANT_INVENTORY_CONTRACT.md:316-323`) with approved variants `hero-video-modal`, `editor-memory-form-modal`, `settings-card-dialog`, `editor-rename-modal`, `editor-connect-modal`.
- `pages/kimi-v2/my-trees.html` and `pages/chat-first-workspace.html` are not linked from the active nav (`rg` finds no inbound references from other pages) and are treated as experimental/legacy surfaces.

## 4. Modal/dialog surface matrix

| Surface | Purpose | Page | Semantic type | role/aria-modal | Accessible name | Focus trap | Escape | Backdrop click | Scroll lock | Background isolation | Destructive/privacy | Disposition |
|---|---|---|---|---|---|---|---|---|---|---|---|---|
| Home video modal | Watch YouTube moment | index | Media modal | `role="dialog"` + `aria-modal="true"` + `aria-label` | `video.title + ' - YouTube'` | Tab wrap + focusin redirect | Yes | No (none) | No | No | No (public media) | TRUE_MODAL_DIALOG, PAGE_OWNED |
| Editor new-moment form | Author a moment | editor | Form modal | `role="dialog"` + `aria-modal="true"` | title/eyebrow text | Tab wrap | Yes | Outside-click closes | No (source) | `inert`+`aria-hidden` on `#detailContent`/topbar/guide | Authoring (owner) | TRUE_MODAL_DIALOG, PAGE_OWNED |
| Editor rename modal | Rename tree | editor | Form modal | `role="dialog"` + `aria-modal="true"` | `aria-labelledby`/`aria-describedby` | not observed in read section | Yes | Backdrop click closes | No | No | Owner edit | TRUE_MODAL_DIALOG (trap unverified), PAGE_OWNED |
| Editor shortcuts help | Shortcuts reference | editor | Info dialog | `role="dialog"` + `aria-modal="true"` | `aria-labelledby`/`aria-describedby` | Tab wrap | Yes | No | No | No | No | TRUE_MODAL_DIALOG, PAGE_OWNED |
| My Trees create-tree | Create a tree | my-trees | Form modal | `role="dialog"` + `aria-modal="true"` | `aria-labelledby` | not present in source | Yes (gated while submitting) | Backdrop click closes | Yes (`body overflow`) | No (only body lock) | Owner create | TRUE_MODAL_DIALOG (no trap/describedby), PAGE_OWNED |
| Auth email modal | Email login/signup | login/signup | Auth form modal | `role="dialog"` + `aria-modal="true"` | `aria-labelledby`/`aria-describedby` | Tab wrap | Yes | Backdrop click closes | No | No | Auth/privacy | TRUE_MODAL_DIALOG, AUTHORITY_OWNED (auth) |
| Settings card | Edit profile/account | settings | Page card over-labeled dialog | `role="dialog"` + `aria-modal="true"` | `aria-labelledby="settingsTitle"` | No | Yes (cancel edit or close) | Click blocked (not closed) | No | No | Account privacy | NOT a true modal — PAGE_OWNED surface, `SEMANTICALLY_INCOMPLETE` |
| Editor detail panel | Inspect/edit a moment | editor | Side panel | none | n/a | n/a | n/a | n/a | n/a | n/a | Owner edit | NON_MODAL_PANEL, PAGE_OWNED |
| Editor mobile panels (sidebar/detail) | Mobile drawer navigation | editor | Drawer (mobile) / panel (desktop) | toggled `role=dialog`+`aria-modal` only on mobile | panel content | Tab wrap (mobile) | Yes (mobile) | Backdrop closes | No | No | Owner | Hybrid NON_MODAL_PANEL↔drawer, `SEMANTICALLY_INCOMPLETE` |
| AI panel sheet | Scout AI suggestions | editor | Sheet/drawer | `role="dialog"` + `aria-modal="true"` | `aria-labelledby` | No (source) | Yes | Backdrop closes | No | No | No (local stub) | Sheet with dialog role, `SEMANTICALLY_INCOMPLETE` |
| Search/My Trees mobile preview sheets | Read a tree preview | search/my-trees | Drawer | none (`.is-open`) | n/a | No | Yes | Overlay closes | Body class `preview-sheet-open` | No | Public/owner preview | NON_MODAL_PANEL (drawer), PAGE_OWNED |
| Editor "..." toolbar dropdown | Secondary actions | editor | Popover/menu | none | n/a | No | n/a (positioned) | outside closes | No | No | Owner actions | POPOVER_OR_MENU, PAGE_OWNED |
| Entity search dropdown | Link entity search | editor | Popover | none | n/a | No | Yes | outside closes | No | No | No | POPOVER_OR_MENU, PAGE_OWNED |
| Editor view-options panel | Layout options | editor | Popover | none | n/a | No | Yes | outside closes | No | No | No | POPOVER_OR_MENU, PAGE_OWNED |
| Scout draft modal | Draft/save scout memo | editor | Visual overlay | none | none | No | Yes | No | No | No | No | Overlay without dialog semantics, `SEMANTICALLY_INCOMPLETE` |
| Connect-existing flow | Link an existing moment | editor | Inline expanded region | none | n/a | No | n/a | n/a | n/a | n/a | Owner edit | NON_MODAL_PANEL (inline), PAGE_OWNED |
| Chat-first-workspace bottom sheet | Workspace prototype | chat-first-workspace (unlinked) | Bottom sheet | none | n/a | No | Yes | Overlay | No | No | No | Experimental, LEGACY_CANDIDATE |
| Native `confirm()`/`prompt()` | Delete/rename tree | my-trees | Native dialog | n/a | n/a | n/a (UA) | n/a | n/a | n/a | n/a | Destructive (delete) | LEGACY_CANDIDATE |
| `noise-overlay` / `tree-overlay` | Decorative grain / kimi-v2 | all / kimi-v2 | Not a surface | none | n/a | n/a | n/a | n/a | n/a | n/a | n/a | NOT_APPLICABLE (decorative/experimental) |

Representative test coverage per surface (`SOURCE_CONFIRMED`): Home modal — `home-youtube-growth-cycle-3624-contract.test.cjs`, `home-video-modal-loading-3707-browser-contract.test.cjs`, `home-thumbnail-loading-browser-contract.test.cjs`; Editor memory form — `editor-add-memory-form-template-contract.test.cjs`, `editor-add-memory-focus-lifecycle-contract.test.cjs`, `editor-authoring-shell-continuity-3483.test.cjs`, `editor-form-isolation-connect-flow-3504.test.cjs`; Editor mobile panels — `editor-mobile-panel-hierarchy-contract.test.cjs`; My Trees create — `my-trees-create-feedback-contract.test.cjs`, `icon-only-control-accessibility-inventory-contract.test.cjs`; Auth email — `auth-email-entry-contract.test.cjs`, `auth-email-feedback-contract.test.cjs`; Settings — `settings-css-contracts.test.cjs`; Scout draft — none found.

## 5. True-modal versus non-modal classification

True modal dialogs (source-confirmed full lifecycle, `TRUE_MODAL_DIALOG`):

1. **Home video modal** — `js/index-inline-init.js` (`openVideoModal`/`closeVideoModal`/`onModalKeydown`/`onDocumentFocusIn`/`cleanupModalTimers`), markup created at runtime (`.hero-video-modal`, `role="dialog" aria-modal="true" aria-label`), CSS `css/index/visual/growth-stage.css:704-920`. Tab wrap + focusin re-direct, Escape, focus restore to `modalReturnFocus`, stale-attempt guard (`modalAttemptId`), LOADING/LONG_WAIT/READY/ERROR/RETRYING state machine.
2. **Editor new-moment form modal** — `#addMemoryForm.editor-memory-form-modal` (template `js/editor/templates/editor-add-memory-form-template.js:3`), controller `js/editor/editor-memory-form.js`. Inert + `aria-hidden` background isolation (`setEmptyGuideSuppressed`), Tab trap (`focusTrap`), Escape (`escHandler`), outside-click close, initial focus (`urlInput.focus()`), guarded focus restore (`restoreFocusToInvoker`). Body scroll lock absent in source.
3. **Editor rename modal** — `js/editor/editor-rename-ui.js` (dynamic `#editorRenameModal` + `#editorRenameModalBackdrop` + `.editor-rename-modal-card` with `role="dialog" aria-modal="true" aria-labelledby/describedby`), backdrop click close, Escape, `lastFocusedEl` restore.
4. **Editor shortcuts help modal** — `js/editor/editor-shortcuts-help.js` (dynamic `#editorShortcutHelpModal`/`#editorShortcutHelpDialog`, `role="dialog" aria-modal="true"`, Tab wrap, Escape, `lastFocusedEl` restore).
5. **My Trees create-tree modal** — `pages/my-trees.html:113-119` (`#createTreeModalBackdrop` + `.create-tree-modal` with `role="dialog" aria-modal="true" aria-labelledby`), controller `js/my-trees/my-trees-actions.js` (`openCreateTreeModal`/`closeModal`). Initial focus, Escape gated while submitting, backdrop click, close/cancel, focus restored before `aria-hidden`, body scroll lock. No Tab trap, no `aria-describedby`.
6. **Auth email modal** — `pages/login.html:76` / `pages/signup.html:64` (`#email-auth-modal` `role="dialog" aria-modal="true" aria-labelledby/describedby`), controller `js/auth/auth-login-page.js` (`openModal` display-then-focus, `closeModal` restore to `lastTriggerButton`, unified Escape + Tab trap, backdrop click).

Non-modal despite overlay treatment (`NON_MODAL_PANEL` / `POPOVER_OR_MENU` / `PAGE_OWNED`):

- **Settings card** — a full page (`pages/settings.html` layout + `#shared-header`) that carries `role="dialog" aria-modal="true"` on the whole card (`settings.html:19`). It is not a modal overlay: backdrop clicks are blocked rather than closing (`js/settings.js:1017-1032`), no focus trap, no scroll lock. The dialog role is over-applied to a page. `SEMANTICALLY_INCOMPLETE`.
- **Editor detail panel** — persistent side panel with no dialog role (template has none).
- **Editor mobile panels** — the same sidebar/detail elements become `role="dialog" aria-modal="true"` drawers only on mobile (`js/editor/editor-mobile-panel-hierarchy.js` `openPanel`/`applyClosedState`/`applyDesktopState`, `trapTabKey`), with a backdrop and Escape. Dialog semantics are toggled at runtime on a non-modal panel — `SEMANTICALLY_INCOMPLETE` hybrid.
- **Search/My Trees mobile preview sheets** — drawers (`previewSidebar.is-open`) with overlay + Escape, no dialog role by design.
- **Editor floating-toolbar dropdown, entity-search dropdown, view-options panel** — positioned popovers/menus with outside-click and Escape close, no dialog semantics. `POPOVER_OR_MENU`.
- **Connect-existing flow** — inline confirm sections inside the detail edit-mode template (`editor-detail-edit-mode-template.js:34-53`), not a modal.
- **Scout draft modal** — visual overlay (`scout-draft-ui.js:121-283`) with NO `role`/`aria-modal`/accessible name. `SEMANTICALLY_INCOMPLETE`.
- **Chat-first-workspace bottom sheet** and **kimi-v2 `tree-overlay`** — unlinked experimental surfaces. `LEGACY_CANDIDATE`.

## 6. Accessibility lifecycle comparison

| Responsibility | Home modal | Memory form | Rename | Shortcuts | Create-tree | Auth email | Settings | Mobile panels | AI sheet | Preview sheets |
|---|---|---|---|---|---|---|---|---|---|---|
| Accessible name | `aria-label` | text heading | `aria-labelledby`+`describedby` | both | `aria-labelledby` | both | `aria-labelledby` | none (content) | `aria-labelledby` | none |
| Initial focus | iframe/video area (tabindex=-1) | `urlInput.focus()` | input (expected) | panel | `titleInput.focus()` | `emailInput.focus()` display-then-focus | `input.focus()` per edit mode | panel focus | none in source | none |
| Focus trap | Tab wrap + focusin re-direct | Tab wrap | not observed in read section | Tab wrap | none in source | Tab wrap | none | Tab wrap (mobile) | none in source | none |
| Escape | close | close (`stopPropagation`) | close | close | close (gated while submitting) | close | cancel-edit or close | close (mobile) | close | close (mobile) |
| Backdrop click | none | outside-click close | closes | none | closes (`event.target===backdrop`) | closes | blocked (not closed) | closes | closes | overlay closes |
| Scroll lock | no | no (source) | no | no | yes (`body overflow:hidden`) | no | no | no | no | body class `preview-sheet-open` |
| Background isolation | none | `inert`+`aria-hidden` regions | none | none | none (only body lock) | none | none | `aria-hidden` on closed panel | none | overlay `aria-hidden` |
| Focus restoration | `modalReturnFocus.focus()` | `restoreFocusToInvoker()` guarded | `lastFocusedEl` | `lastFocusedEl` | restore before `aria-hidden` | `lastTriggerButton` | n/a | `returnFocusEl` | none in source | none |
| Cleanup | timers+listeners+remove | listeners removed; form hidden | listeners removed | listeners removed | Escape listener removed | idempotent `replaceEventListener` | listeners persist (page) | state reset | n/a | media-query listener |

Shared patterns observed across the true modals (duplicate logic): Tab-wrap focus trap (Home, memory form, shortcuts, auth, mobile panels), Escape-close with optional busy gate (create-tree, memory form, auth), focus-restore-to-invoker with a stored element (Home, memory form, rename, shortcuts, create-tree, auth), scroll-lock (`body.style.overflow` create-tree; body class preview sheets). These are `DUPLICATE_CANDIDATE` implementations of the same accessibility responsibilities.

## 7. Visual-shell ownership comparison

- Home video modal: `css/index/visual/growth-stage.css` — page-owned shell (`.hero-video-modal`, `.hero-video-modal-panel`, `.hero-video-modal-player`, `.hero-video-modal-close`; fade/pop animations). `PAGE_OWNED`.
- Editor memory form: `css/editor/editor-add-memory-form*` (`.editor-memory-form-modal`) — page-owned.
- Rename: `css/editor/editor-overrides.css` (`.editor-rename-modal*`) — page-owned.
- Create-tree: `css/my-trees/my-trees-create-modal.css` — page-owned.
- Auth email: auth CSS (`.login-email-modal*`) — auth-owned.
- Settings: `css/settings/components.css` (`.settings-card`, `.settings-close-btn`) — page-owned.
- AI sheet: `css/ai/lovebud-ai-panel.css` (`.lovebud-ai-panel-sheet`, `-backdrop`) — page-owned.
- No shared modal shell exists. Visual tokens shared across surfaces (radius, focus ring, scrims) are the only `SHARED_PRESENTATION_CANDIDATE` items (e.g., `--control-focus-ring`, chip/card radii); the shells themselves are not candidates because their geometry differs materially (media panel, form card, drawer, bottom sheet).

## 8. Authority/privacy/destructive-action boundaries

Responsibilities that must remain page/authority-owned (`SOURCE_CONFIRMED`):

- **Media authority** — Home modal owns the iframe player lifecycle, 8s LONG_WAIT / 30s TIMEOUT timers, retry, and `modalAttemptId` stale guard (`js/index-inline-init.js`). No other surface has media playback.
- **Authoring/editing authority** — Editor memory form owns region-specific inert isolation (`#detailContent`/topbar/empty-guide, `editor-memory-form.js:122-167`); rename owns the title save; connect-existing owns inline confirm sections. These are editor-owner semantics.
- **Destructive-action authority** — My Trees delete uses native `confirm()` (`my-trees-actions.js:338`) and rename uses native `prompt()` (`~310`); a future styled destructive dialog must remain under My Trees owner authority and preserve `delete_tree_confirm`/`rename_tree_prompt` semantics.
- **Privacy/auth authority** — Auth email modal (`#email-auth-modal`, `auth-login-page.js`) handles login/signup with auth state; settings handles account data. Neither may be re-parented to a shared component.
- **Owner/public difference** — Home modal is public discovery media; Editor/My Trees are owner contexts; preview sheets serve both but are page-owned drawers. The loading-program boundary (#3688) keeps loading-state UI separate from modal lifecycle (`home-video-modal-loading*` states are page-owned).

## 9. Canonical minimum contract

A LoveBud **true modal dialog** must satisfy, at minimum:

```text
1.  role="dialog" + aria-modal="true" on the modal element
2.  an accessible name: aria-labelledby (preferred) or aria-label
3.  an initial focus target set after the modal becomes visible
4.  focus containment (Tab / Shift+Tab wrap) while open
5.  Escape closes, or is explicitly gated by a busy/submitting state
6.  a visible close control (close button and/or explicit cancel)
7.  focus restored to the invoker on close (guarded: connected/visible/enabled)
8.  background isolation: body scroll lock and/or inert + aria-hidden of the background regions
9.  cleanup of all listeners and timers added for the open state
```

`SOURCE_CONFIRMED` baseline against this contract: Home modal satisfies 1-7,9 (8 partial); memory form satisfies 1-7,9 and adds inert isolation (8) but no scroll lock; rename satisfies 1-3,5-7,9 (4 unverified in read section); shortcuts satisfies 1-7,9; create-tree satisfies 1-3,5-7,9 and body scroll lock (4,8-partial missing); auth satisfies 1-9 fully except body scroll lock; settings satisfies 1-3 only. The decision does not authorize changing any of them now.

## 10. Shared versus page-owned responsibilities

Decision: **standardize the accessibility lifecycle responsibilities as shared candidates; keep every visual shell and domain controller page-owned.**

- Safe to share (`SHARED_LIFECYCLE_CANDIDATE`): a small modal-a11y helper set covering Tab-wrap focus trap, Escape close (with a busy gate option), guarded focus restore, body scroll lock/unlock, and open-time initial focus. These responsibilities are already repeated near-identically in five controllers (section 6) with no surface-specific variation that would justify divergence.
- Safe to share as presentation (`SHARED_PRESENTATION_CANDIDATE`): scrim/overlay token and focus-ring/radius tokens only. NOT full shell markup — shells differ materially (media panel vs form card vs drawer vs bottom sheet).
- Must remain page-owned: media lifecycle (Home), form submission/submitting guards (memory form, create-tree, auth), inert-region selection (editor), destructive confirmation (My Trees), privacy/auth handling (auth, settings), mobile↔desktop semantic switching (editor panels), and each close-on-backdrop policy where it deliberately differs (settings blocks backdrop close; others close).
- Neither full sharing nor a single `Modal` component is approved at this stage; the surfaces' domain authority is too different, and no browser evidence yet supports a unified shell.

## 11. Native `<dialog>` decision status

`UNRESOLVED` — not approved, not prohibited, not mandated.

- No current source uses `<dialog>`/`showModal()`. Adopting it would be a migration of six controllers plus media/form lifecycle with no source precedent.
- Native `<dialog>` could technically replace the bespoke trap/Escape/scroll-lock logic, but the Home media modal (iframes, timers, retry), the editor inert-region isolation, and the submitting guards are surface-specific and would still need bespoke wiring.
- Decision: defer. A future child may evaluate `<dialog>` against ONE reference surface (e.g., the shortcuts help or rename dialog) with browser evidence before any broader mandate. Marked `UNRESOLVED_RUNTIME` for real-world focus/announcement behavior.

## 12. Compatibility identifiers

Identifiers a later implementation must preserve or deliberately migrate (`COMPATIBILITY_IDENTIFIER`, `SOURCE_CONFIRMED`):

Home video modal:
- `.hero-video-modal`, `.hero-video-modal-panel`, `.hero-video-modal-player`, `.hero-video-modal-close`, `.hero-video-modal-loading*`, `.hero-video-modal-error*`, `.hero-video-modal-retry-btn`, `.is-long-wait` (`css/index/visual/growth-stage.css:704-920`).
- `openVideoModal`, `closeVideoModal`, `retryVideoModal`, `cleanupModalTimers`, `handleModalIframeLoad/Error/LongWait/Timeout`, `showModalError`, `createModalLoadingEl`, `modalAttemptId`, `modalReturnFocus` (`js/index-inline-init.js`).

Editor memory form:
- `#addMemoryForm`, `.editor-memory-form-modal`, `#addMemoryFormEyebrow/Title/Intro`, `.memory-create-section`.
- `showAddMemoryForm`, `hideAddMemoryForm`, `focusTrap`, `escHandler`, `outsideClickHandler`, `setEmptyGuideSuppressed`, `restoreFocusToInvoker`, `_addMemoryInvoker`, `isFormOpen` (`js/editor/editor-memory-form.js`).
- `#detailContent` inert/`aria-hidden` gating; `.is-memory-form-open` classes; `#editorMemoryFormContext`.

Editor rename:
- `#editorRenameModal`, `#editorRenameModalBackdrop` (`data-rename-modal-close`), `.editor-rename-modal-card`, `#editorRenameModalTitle/Desc/Input/Error/Cancel/Save`, `closeRenameModal`, `lastFocusedEl` (`js/editor/editor-rename-ui.js`); `.editor-rename-modal-*` CSS.

Editor shortcuts help:
- `#editorShortcutHelpModal`, `#editorShortcutHelpDialog`, `#editorShortcutHelpCloseBtn`, `lastFocusedEl` (`js/editor/editor-shortcuts-help.js`).

My Trees create-tree:
- `#createTreeModalBackdrop`, `.create-tree-modal*` classes, `#createTreeModalTitle/Form/CloseBtn/CancelBtn/SubmitBtn`, `createTreeModalState`, `openCreateTreeModal`, `closeModal`, `setSubmitting`, `setError`, `createFlowGuard`, `isSubmitting` (`js/my-trees/my-trees-actions.js`); i18n `myTrees.create_modal_*`; `delete_tree_confirm`, `rename_tree_prompt` (native confirm/prompt copy).

Auth email modal:
- `#email-auth-modal`, `.login-email-modal`, `.login-email-modal-card`, `#email-auth-*` (title/helper/email/display-name/submit/toggle/close), `openModal`, `closeModal`, `lastTriggerButton`, `__lovebudEmailEntryKeydown/Close/Backdrop/LoginOpen/SignupOpen` replace-listener keys (`js/auth/auth-login-page.js`).

Editor mobile panels:
- `openPanel`, `closePanel`, `trapTabKey`, `applyClosedState`, `applyDesktopState`, `.is-mobile-panel-open`, `.editor-mobile-panel-backdrop`, `#mobileSidebarPanelCloseBtn`, `#mobileDetailPanelCloseBtn`, `#mobileTreePanelToggle`, `#mobileDetailPanelToggle`, `returnFocusEl` (`js/editor/editor-mobile-panel-hierarchy.js`).

Other:
- `#settingsCard`, `#settingsCloseBtn`, `closeSettings`, `bindCloseInteractions` (`js/settings.js`, `pages/settings.html`).
- `LoveBudAIPanel.open/close/toggle`, `.lovebud-ai-panel-sheet/-backdrop/-close-btn`, `data-lovebud-ai-panel/-overlay/-close` (`js/ai/lovebud-ai-panel.js`).
- Preview sheets: `previewSidebar.is-open`, `.preview-sheet-overlay`, body class `preview-sheet-open`.
- Scout: `#scoutDraftModal`, `.scout-draft-modal`, `.scout-draft-modal-overlay`, `scout-draft-modal-*`.
- Settings/forced-colors: `.settings-close-btn:focus-visible` (2px `--primary` outline), `.hero-video-modal-close:focus-visible` (`rgba(255,255,255,0.85)` outline), `.editor-rename-modal-input:focus` (`outline:none` + box-shadow — flagged `MISSING_COVERAGE` in WHCM by `FORCED_COLORS_FOCUS_COVERAGE_AUDIT.md:104`), `.create-tree-*` focus gaps (`:99-101`).

## 13. Confirmed gaps and duplicates

Confirmed gaps (`SEMANTICALLY_INCOMPLETE`):

1. Settings card: `role="dialog" aria-modal="true"` on a full page; backdrop click blocked instead of closing; no trap/scroll lock — the dialog role overstates a page surface.
2. Scout draft modal: visual overlay with no `role`/`aria-modal`/accessible name.
3. AI panel sheet: dialog role present but no focus trap, no scroll lock, no focus restoration in source.
4. Editor rename modal: Tab trap not observed in the read section (unverified).
5. My Trees create-tree modal: no Tab trap, no `aria-describedby`.
6. Editor memory form: no body scroll lock (only region inert/aria-hidden).
7. Editor mobile panels: `role=dialog`/`aria-modal` toggled at runtime on non-modal panels.
8. Forced-colors focus gaps on modal controls (`.editor-rename-modal-input` box-shadow-only `MISSING_COVERAGE`; `.hero-video-modal-*` `PARTIAL_COVERAGE`; `.create-tree-modal-*` `UNRESOLVED` per `FORCED_COLORS_FOCUS_COVERAGE_AUDIT.md:99-104`).

Duplicates (`DUPLICATE_CANDIDATE`):

1. Five near-identical Tab-wrap/Escape/restore implementations (Home, memory form, shortcuts, auth, mobile panels) with no shared helper.
2. Two mobile preview sheets (search + my-trees) with duplicated overlay/Escape logic.
3. Native `confirm()`/`prompt()` alongside styled modals for destructive flows.
4. Settings card-dialog and the "settings" page are one surface described two ways (inventory variant `settings-card-dialog` vs actual `.settings-card` page).

## 14. `UNRESOLVED_RUNTIME` items

1. Whether the Home modal's focusin re-direct and iframe `tabindex=-1` behave correctly in real browsers (focus containment with embedded iframe).
2. Whether the editor memory form's region-inert isolation fully prevents background focus in browsers without native `inert` support.
3. Whether the create-tree modal's missing Tab trap lets focus escape in practice.
4. Whether the AI sheet is focusable/announced correctly given no trap or restore in source.
5. Whether the mobile-panel runtime `role=dialog` toggling announces correctly when panels switch desktop↔mobile.
6. Whether the settings full-page card's `aria-modal="true"` causes AT to hide the page background in a browser.
7. Actual screen-reader announcements for `role="dialog"`+`aria-modal` on each surface; forced-colors focus adequacy per audit (`PARTIAL_COVERAGE`/`MISSING_COVERAGE`/`UNRESOLVED`).
8. Whether native `<dialog>` would preserve the media/form lifecycle behavior for a reference surface.

## 15. Future children — maximum 3

Child 1 — **Shared modal accessibility lifecycle helper** (U3 runtime-sensitive):
- Surfaces: the six true modals (Home, memory form, rename, shortcuts, create-tree, auth) and the two drawers that want dialog semantics (AI sheet, mobile panels).
- Candidate files: new `js/shared/modal-a11y.js` (or `js/shared/`) providing `trapFocus`, `bindEscapeClose`, `restoreFocus`, `lockBodyScroll`, `focusOnOpen`; adoption in the six controllers.
- Implementation boundary: extract the duplicate Tab-wrap/Escape/restore/scroll-lock logic; no visual shell change; no markup change outside wiring.
- Authority boundary: shared helper is `AUTHORITY_OWNED` (design system); each controller stays `PAGE_OWNED` for domain behavior.
- Accessibility requirements: identical contract (section 9) enforced per surface; busy-gate Escape preserved (create-tree/memory-form).
- Test type: source-static contract for the helper API + U3 focused keyboard/browser contract per adopted surface.
- Browser verification: **YES** (keyboard focus, Escape, WHCM focus).
- Non-overlap: no visual/CSS change; does not fix surface-specific semantics (Child 2) or evaluate `<dialog>` (Child 3).

Child 2 — **Semantic gap closure for dialog-role surfaces** (U3 runtime-sensitive):
- Surfaces: settings card (role over-application), scout draft modal (no ARIA), AI sheet (missing lifecycle), create-tree (trap + describedby), memory form (scroll lock), mobile panels (role toggling).
- Candidate files: `pages/settings.html`+`js/settings.js`, `js/scout/scout-draft-ui.js`, `js/ai/lovebud-ai-panel.js`, `js/my-trees/my-trees-actions.js`, `js/editor/editor-memory-form.js`, `js/editor/editor-mobile-panel-hierarchy.js`, plus per-surface CSS.
- Implementation boundary: add the missing semantics/lifecycle per surface; do not restructure shells.
- Authority boundary: each fix stays page-owned; shared pieces only if Child 1 already exists.
- Accessibility requirements: full contract (section 9) for any surface labeled a dialog; non-dialog surfaces must drop misleading roles (settings) or gain none.
- Test type: per-surface source-static + focused U2/U3 browser contracts (settings role, scout ARIA, AI focus, create-tree trap, memory-form scroll).
- Browser verification: **YES**.
- Non-overlap: no shared-helper creation (Child 1); no `<dialog>` evaluation (Child 3); touches surfaces individually.

Child 3 — **Native `<dialog>` evaluation + canonical contract codification** (U0/U1 doc + U3 pilot):
- Surfaces: one reference surface (shortcuts help or rename dialog) as the `<dialog>` pilot; plus documentation.
- Candidate files: `docs/design/CANONICAL_COMPONENT_VARIANT_INVENTORY_CONTRACT.md` (§4.13 update), a new source-static contract codifying the canonical minimum modal contract (section 9) and the disposition of every surface (section 4), and the pilot surface's controller/CSS.
- Implementation boundary: evaluate and pilot native `<dialog>` on ONE surface with browser evidence; do not mandate migration elsewhere.
- Authority boundary: design-system authority codifies; pilot stays page-owned.
- Accessibility requirements: native dialog top-layer behavior, focus, Escape, scroll-lock via `::backdrop`; WHCM check.
- Test type: source-static contract + one U3 browser contract for the pilot.
- Browser verification: **YES** for the pilot only.
- Non-overlap: depends on Child 1 (helper) and Child 2 (semantics) not being blocked by it; no shell/controller rewrites of other surfaces.

Children 1-3 are bounded and separately reviewable; none is implemented by this decision.

## 16. Explicit non-actions

This decision does not authorize, and no worker may perform under this document:

```text
no index.html or pages/** change
no css/** change
no js/** change
no tests/** or registry change
no package/lockfile/workflow change
no browser or Playwright
no screenshots
no Preview or Production operation
no actual modal interaction claim beyond source evidence
no real login or private data
no API/DB/provider mutation
no modification of PR #3783, #3787, #3780, or their worktrees
no Ready transition
no merge
no Issue closure by the worker
no rebase/reset/amend/force push
no Closes/Fixes/Resolves on #3672, #3688, or #1882 (Refs only)
```

## 17. Rollback

- This record is additive (one new `docs/` file); rollback is branch deletion / revert of the single-file Draft PR with no runtime state.
- Future children are rollback-safe per PR: each carries its own contract update, making surface change + contract guard atomic (following the pattern established by the modal-related contracts in section 4).

Refs #3788.
Refs #3672 — Keep OPEN.
Refs #3706 — completed.
Refs #3753 — completed.
Refs #3688 — Keep OPEN.
Refs #1882 — Keep OPEN.
