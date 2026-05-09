# Editor Detail UI Responsibility Audit

Issue: #518

This is a docs/inspection-only audit for `js/editor/editor-detail-ui.js`.

No JavaScript, CSS, HTML, runtime, backend, package, workflow, PR #7, or PR #450 files are changed by this audit.

## Purpose

`js/editor/editor-detail-ui.js` currently combines detail panel rendering, sidebar status rendering, inline edit rendering, and action binding inside one factory. This document records responsibility boundaries before any implementation split.

## Current module boundary

Current module:

- `js/editor/editor-detail-ui.js`
- factory: `createEditorDetailUI(deps)`

Primary dependency groups:

- DOM mount: `detailPanel`
- copy and formatting: `i18n`, title/hint/info resolvers
- editor state readers: selected node, tree memories, current tree data, root id, local save mode
- UI actions: toast, visibility update, open detail, focus selected moment, selected memory field update

The module is UI-heavy but behavior-linked because it builds DOM nodes and binds interaction handlers.

## Responsibility buckets

| Bucket | Current responsibility | Risk | Future direction |
| --- | --- | --- | --- |
| Copy and formatting | fallback text, replacement formatting, display tag fallback | LOW | Keep local unless reused elsewhere. |
| Button and icon construction | pill buttons, inline icons, share/detail action buttons | MEDIUM | Extract only with action smoke. |
| Tree state derivation | root/non-root memory counts and empty state flags | MEDIUM | Keep near detail UI unless a state selector helper is approved. |
| Tree meta rendering | current tree card, visibility badge, count text, action row | MEDIUM | Candidate for one narrow tree-meta helper PR. |
| Empty/reset state | clearing detail fields, empty detail state, footer/action visibility | MEDIUM | Candidate for one narrow empty-state helper PR. |
| Sidebar status rendering | sidebar title, visibility text, moment count, flow summary, add-memory copy | MEDIUM | Candidate for one narrow sidebar-status helper PR. |
| Current moment card | badge, title, hint, thumbnail, date, tags, memo body | HIGH | Split only with full selected-memory smoke. |
| Inline title edit | title edit button, input, save/cancel/error behavior | HIGH | Candidate for one narrow title-edit helper PR. |
| Inline memo edit | memo edit button, textarea, hint, save/cancel behavior | HIGH | Candidate for one narrow memo-edit helper PR. |
| Inline style ownership | style assignments on generated nodes | HIGH | Audit separately before moving styles to CSS. |

## Main concerns

1. Detail rendering and interaction binding are mixed.
2. Tree meta and sidebar status responsibilities are in the same factory.
3. Title and memo editing should not be extracted together.
4. Inline style cleanup should not be mixed with behavior extraction.
5. Empty state and selected-memory state share reset paths.

## Future PR split

### PR A — Tree meta renderer only

Allowed files:
- `js/editor/editor-detail-ui.js`
- optional new tree-meta helper
- `pages/editor.html` only for a narrow script include if required

Forbidden:
- inline edit changes
- sidebar status changes
- data/API changes
- CSS migration

Required smoke:
- empty editor
- populated tree
- selected memory
- mobile 375px

### PR B — Title inline edit only

Allowed:
- move title edit UI construction and save/cancel handling into a helper
- preserve selected-memory title update behavior

Forbidden:
- memo edit changes
- tree meta changes
- CSS migration

Required smoke:
- selected memory title edit open
- validation/error rendering
- save path where safely testable
- cancel path
- mobile 375px

### PR C — Memo inline edit only

Allowed:
- move memo edit UI construction and save/cancel handling into a helper
- preserve selected-memory memo update behavior

Forbidden:
- title edit changes
- tree meta changes
- CSS migration

Required smoke:
- selected memory memo edit open
- hint rendering
- save path where safely testable
- cancel path
- mobile 375px

### PR D — Sidebar status only

Allowed:
- move sidebar title, visibility, count, flow summary, selection hint, and add-memory copy updates into a helper

Forbidden:
- detail card rendering changes
- inline edit changes
- add-memory form behavior changes

Required smoke:
- empty tree sidebar
- populated tree sidebar
- selected memory sidebar
- add-memory intro/button copy
- mobile 375px

### PR E — Inline style ownership audit

Allowed:
- docs-only audit of inline styles and future CSS ownership candidates

Forbidden:
- moving styles to CSS in the same PR as JS extraction
- broad visual redesign

## Forbidden combinations

Do not combine #518 implementation work with:

- `js/editor.js` rewrite
- broad `pages/editor.html` rewrite
- data loading changes
- backend or package changes
- CSS relocation or visual redesign
- #517 paper tone/layout work
- #516 hidden compatibility follow-up
- #456 or #424 Browse/Search work
- My Trees work
- PR #7 paths
- PR #450 files

## Browser smoke requirements for future implementation

Any behavior-affecting implementation under #518 requires a valid browser verification target decision before handoff.

Use `docs/ops/BROWSER_VERIFICATION_SLOT_GATE.md` before assigning a verifier.

Required checks by touched area:

- empty editor state
- populated tree state
- selected memory detail panel
- title edit mode if title edit is touched
- memo edit mode if memo edit is touched
- add memory form state if sidebar/add copy is touched
- tree status/settings panel if sidebar status is touched
- action visibility if action buttons are touched
- mobile 375px editor smoke
- horizontal overflow
- fatal console errors
- PASS / PARTIAL / NOT_VERIFIED separated

## Closure criteria

#518 can be closed when:

- responsibility buckets are documented;
- future implementation PRs are split by one responsibility each;
- allowed and forbidden files are listed;
- browser smoke requirements are documented;
- no implementation is included in the audit PR.

This audit satisfies the docs/inspection portion of #518. Any implementation requires separate approval.

Refs #518
Refs #422
Refs #223
Refs #400
