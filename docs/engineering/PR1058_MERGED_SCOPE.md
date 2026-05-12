# PR #1058 — Browse appreciation hub scroll and media cleanup — merged scope

## Purpose

This document records the final merged scope of PR #1058 (`fix(search): integrate Browse hub scroll and media cleanup (#1058)`). The PR was merged with **10 files changed** across CSS, JS, and HTML layers. This record exists so that future Browse hub work, refactoring, or cleanup can reference the complete set of changes.

## Merged files (10 total)

### Modified files

| # | File | Type | Change summary |
|---|------|------|---------------|
| 1 | `css/search.css` | CSS import hub | Added `@import` lines for the 4 new CSS sub-modules added by this PR |
| 2 | `js/search/search-data-adapter.js` | JS data layer | Normalized Browse memory source URL derivation; refactored legacy build helpers (172 lines changed, 114 removed) |
| 3 | `pages/search.html` | HTML page | Added `<script>` tags for the 3 new JS patch modules |

### New CSS files

| # | File | Issue ref | Purpose |
|---|------|-----------|---------|
| 4 | `css/search/search-preview-scroll-fix.css` | #1054 | Allow the Browse appreciation hub to scroll independently on desktop (`max-height: calc(100dvh - 120px)` with `overflow-y: auto`); mobile `overscroll-behavior: contain` |
| 5 | `css/search/search-preview-media-cleanup.css` | #1052 | Remove non-functional `.video-container::before` overlay pseudo-element |
| 6 | `css/search/search-preview-media-no-overlays.css` | #1052 | Remove non-functional Browse media overlays (`.video-container::before`, `[data-preview-overlay]`, iframe wrapper `<div>`, `.tree-card-preview-strip-media`) |
| 7 | `css/search/search-preview-social-bar.css` | #1058 | Browse appreciation hub social action bar: `.preview-social-shell`, `.preview-social-bar` (3-column grid), `.preview-social-action` buttons with hover/focus-visible states, `.preview-comments-panel` |

### New JS files

| # | File | Issue ref | Purpose |
|---|------|-----------|---------|
| 8 | `js/search/search-preview-hub-dom-patch.js` | #1058 | DOM-level Browse hub final layout patch: hides non-functional elements (`#previewTreeStats`, `.tree-meta`, stale fallback copy), wires social action bar, manages preview desc visibility |
| 9 | `js/search/search-preview-media-embed-patch.js` | #1053 | Normalize Browse hub YouTube iframe sources: parses YouTube video IDs from various URL formats (youtu.be, youtube.com, ytimg.com) without changing API shape |
| 10 | `js/search/search-preview-playable-hub-patch.js` | #1053/#1058 | Playable Browse hub media embedding per-tree selected-moment tracking, flow moment switching (`이어진 흐름` items), hub action layout (open tree, share link, bring into My Trees), inline playback rendering |

## File dependency context

### CSS load order

`css/search.css` imports all search CSS sub-modules. The 4 new files from this PR are imported in this order (after the existing preview sidebar styles):

```text
@import url("./search/search-preview-sidebar.css");     /* existing */
@import url("./search/search-preview-scroll-fix.css");   /* PR #1058 */
@import url("./search/search-preview-media-cleanup.css");/* PR #1058 */
@import url("./search/search-preview-media-no-overlays.css"); /* PR #1058 */
@import url("./search/search-preview-social-bar.css");   /* PR #1058 */
```

### JS load order (within Search submodules)

In `pages/search.html`, the 3 new JS files are loaded after the existing preview helpers and before the orchestrator module:

```text
<script src="../js/search/search-preview-renderer.js">  <!-- existing -->
<script src="../js/search/search-preview-playable-hub-patch.js">  <!-- PR #1058 -->
<script src="../js/search/search-preview-hub-dom-patch.js">      <!-- PR #1058 -->
<script src="../js/search/search-preview-media-embed-patch.js">  <!-- PR #1058 -->
<script src="../js/search/search-preview-cache.js">     <!-- existing -->
```

## Related issues

| Issue | Description | Status |
|-------|-------------|--------|
| #1052 | Remove non-functional Browse media overlays | Merged in PR #1058 |
| #1053 | Normalize Browse hub YouTube iframe sources | Merged in PR #1058 |
| #1054 | Allow Browse hub to scroll independently | Merged in PR #1058 |
| #1058 | Integrate Browse hub scroll and media cleanup | Merged |

## Verification notes

- All CSS files are imported through `css/search.css` (cache key `v20260512-1058-4`)
- All JS files are loaded through `pages/search.html` script tags
- No new globals are exposed by the patch modules (they use IIFE wrappers)
- The 3 patch modules are not part of the `js/search/search-preview-renderer.js` extraction plan — they are standalone hotfix modules that may be reconciled into the renderer in future cleanup PRs
