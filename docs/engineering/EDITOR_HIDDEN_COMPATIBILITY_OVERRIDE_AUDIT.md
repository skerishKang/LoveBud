# Editor Hidden Compatibility Override Audit

Issue: #516

This document records the docs/inspection-only audit for the Group G hidden/compatibility selectors in `css/editor/overrides.css`.

This PR does not remove, relocate, or rename selectors. It does not change CSS, HTML, JavaScript, runtime behavior, Auth/API/backend/package/workflow files, PR #7 prototype/reference/demo/variant paths, or PR #450 files.

## Source baseline

The current hidden/compatibility selector block in `css/editor/overrides.css` hides several legacy or compatibility elements with `display: none !important`, followed by two low-risk spacing/text-width overrides:

- `.editor-status-section > h3`
- `.editor-flow-lead`
- `#sidebarMomentCount`
- `#sidebarFlowSummary`
- `#sidebarSelectionHint`
- `.editor-add-section-bottom`
- `.editor-tree-meta-section`
- `#detailEmptyStartBtn`
- `.editor-status-card` margin-top override
- `.editor-canvas-empty-guide__desc`

The earlier selector inventory classifies these as Group G Hidden/Compatibility selectors and marks the hidden display group as HOLD until usage is verified.

## Audit method

Repository search inspected the selector family across:

- `css/editor/overrides.css`
- `pages/editor.html`
- existing engineering selector inventory documentation

This audit is intentionally conservative. Search visibility in this document is not a deletion authorization. Any future removal or relocation still requires fresh file search, targeted diff review, and browser verification.

## Selector disposition table

| Selector | Current role | Reference evidence | Disposition | Future action |
| --- | --- | --- | --- | --- |
| `.editor-status-section > h3` | Hidden legacy/compatibility status heading | Present in `css/editor/overrides.css`; selector family documented in existing inventory | HOLD | Do not remove without confirming heading ownership in current Editor markup and smoke-testing sidebar/status states. |
| `.editor-flow-lead` | Hidden flow lead text | Present in `css/editor/overrides.css`; inventory marks Group G HOLD | HOLD | Confirm whether current copy model still needs compatibility hiding before any removal. |
| `#sidebarMomentCount` | Hidden moment count element | Present in `css/editor/overrides.css`; search indicates relation to `pages/editor.html`/inventory | HOLD | Treat as behavior-adjacent until JS/HTML references are checked immediately before implementation. |
| `#sidebarFlowSummary` | Hidden sidebar flow summary | Present in `css/editor/overrides.css`; search indicates relation to `pages/editor.html`/inventory | HOLD | Do not remove without checking empty/populated tree sidebar states. |
| `#sidebarSelectionHint` | Hidden sidebar selection hint | Present in `css/editor/overrides.css`; search indicates relation to `pages/editor.html`/inventory | HOLD | Verify selected-memory and no-selection states before any change. |
| `.editor-add-section-bottom` | Hidden add-section compatibility surface | Present in `css/editor/overrides.css`; search indicates relation to editor markup/inventory | HOLD | Any removal requires add-memory form and empty tree smoke. |
| `.editor-tree-meta-section` | Hidden tree meta compatibility surface | Present in `css/editor/overrides.css`; search indicates relation to editor markup/inventory | HOLD | Verify tree meta/status rendering before any removal or relocation. |
| `#detailEmptyStartBtn` | Hidden detail-panel empty-state button | Present in `css/editor/overrides.css`; search indicates relation to editor markup/inventory | HOLD | Do not remove while Editor empty-state CTA hierarchy depends on center-owned first action. |
| `.editor-status-card` margin-top override | Spacing normalization for status card | Present in `css/editor/overrides.css`; not a hidden selector | READY_FOR_NARROW_RELOCATION | May move to status/settings ownership only in a small CSS-only PR with sidebar/status smoke. |
| `.editor-canvas-empty-guide__desc` | Empty guide description width/rhythm | Present in `css/editor/overrides.css`; not a hidden selector | READY_FOR_NARROW_RELOCATION | May move to canvas/empty-state ownership only in a small CSS-only PR with empty editor canvas smoke. |

## Current conclusion

The hidden selector group should remain in place for now. The selectors are compatibility controls rather than simple dead CSS. Removal would be riskier than relocation and requires stronger proof than this audit provides.

The two non-hidden declarations have clearer ownership candidates:

- `.editor-status-card { margin-top: 0; }` can be considered for status/settings ownership.
- `.editor-canvas-empty-guide__desc` can be considered for canvas empty-state ownership.

Those should not be bundled with hidden-selector removal.

## Allowed future PR shapes

### PR A — No-op disposition / tracking only

Allowed:
- Keep hidden selectors in `css/editor/overrides.css`.
- Add comments or documentation only.

### PR B — Narrow spacing relocation

Allowed:
- Move `.editor-status-card` margin-top override only.
- CSS-only.
- Verify sidebar/status card spacing.

Forbidden:
- No hidden selector removal.
- No runtime changes.

### PR C — Narrow empty guide relocation

Allowed:
- Move `.editor-canvas-empty-guide__desc` only.
- CSS-only.
- Verify empty editor canvas and mobile 375px.

Forbidden:
- No hidden selector removal.
- No broad canvas/paper-tone consolidation.

### PR D — Hidden selector removal only after proof

Allowed only after fresh approval:
- Remove one hidden selector family at a time.
- Confirm no active HTML/JS/runtime dependency immediately before removal.
- Browser-verify empty editor state, populated tree state, selected memory state, add-memory form state, sidebar meta/status rendering, mobile 375px, and fatal console status.

## Forbidden combinations

Do not combine #516 work with:

- Editor paper tone/layout consolidation (#517)
- Editor detail JS responsibility cleanup (#518/#519/#520)
- Browse/Search performance work (#456)
- Search preview helper extraction (#424)
- Auth/API/backend/package/workflow changes
- PR #7 prototype/reference/demo/variant paths
- PR #450 files

## Verification standard for future implementation

Any future CSS implementation under #516 must report:

- exact selector family touched;
- fresh reference search result;
- changed files;
- whether CSS-only was preserved;
- empty editor state;
- populated tree state where reachable;
- selected memory state where reachable;
- add memory form state where reachable;
- sidebar meta/status rendering;
- mobile 375px editor smoke;
- horizontal overflow;
- fatal console errors;
- PASS / PARTIAL / NOT_VERIFIED separated.

## Closure criteria for #516

#516 can be closed when:

- Group G hidden/compatibility selectors are documented;
- current disposition is recorded;
- removal is explicitly blocked until proof and browser verification;
- safe future PR shapes are split;
- forbidden combinations are documented;
- no implementation is included in the audit PR.

This audit satisfies the docs/inspection portion of #516. Any future selector removal or relocation must be separately approved.

Refs #516
Refs #419
Refs #137
Refs #399
