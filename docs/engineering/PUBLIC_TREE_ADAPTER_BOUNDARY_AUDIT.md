# Public tree adapter boundary audit

Refs #412

## Purpose

This document records the first docs-only architecture audit for Issue #412, following the frontend modularization considerations from Issue #72.

The goal is to map the current public tree adapter helper boundaries, export contract, loading-order dependencies, and preview behavior implications **before any JavaScript implementation changes are made**.

This PR is audit-only. It does not modify or refactor the adapter, its exports, or its usage sites.

## Scope

This audit covers:

- `js/api/public-tree-adapter.js` current responsibility map.
- Export contract expected by existing pages and modules.
- Script loading order across Search/Browse/Detail/Editor/My Trees.
- Preview data preparation pathways that depend on the adapter.
- Future utility split risks and guardrails.

## Current helper responsibility map

| Function | Responsibility | Affected surfaces |
|---|---|---|
| `sanitizeUrl(url)` | Basic URL sanitization — prepend https if scheme missing, return '' on invalid input | All URL outputs: thumbnail, sourceUrl, tree links |
| `isValidYouTubeVideoId(id)` | Validate 11-char YouTube video ID format | YouTube thumbnail/embed generation |
| `isYouTubeHost(url)` | Detect youtube.com, youtu.be, ytimg.com hosts | YouTube URL classification |
| `extractYouTubeVideoId(url)` | Extract 11-char video ID from various YouTube URL forms (watch, shorts, embed, live, youtu.be) | YouTube URL canonicalization |
| `extractYouTubeVideoIdFromThumbnail(url)` | Extract video ID from youtube thumbnail URLs (img.youtube.com/vi/ID/, i.ytimg.com/vi/ID/) | Thumbnail fallback logic |
| `buildCanonicalYouTubeThumbnailUrl(videoId)` | Build `i.ytimg.com/vi/ID/hqdefault.jpg` URL | Preview thumbnail rendering |
| `buildCanonicalYouTubeEmbedUrl(videoId)` | Build `youtube.com/embed/ID` URL | Detail/editor embed iframe src |
| `canonicalizeYouTubeSourceUrl(url)` | Convert any YouTube URL to canonical embed URL; non-YouTube URLs pass through sanitizeUrl | Memory source URL rendering |
| `canonicalizeYouTubeThumbnailUrl(url, fallbackSourceUrl)` | Resolve thumbnail URL from given URL or fallback to source URL parsing; return '' for invalid/empty | Card preview images, tree representative thumbnail |
| `unwrapTreeRecord(tree)` | Strip `{ data }` wrapper from API response or return raw object/empty object | All tree normalization entry points |
| `unwrapMemoryRecord(memory)` | Strip `{ data }` wrapper from memory API responses | All memory normalization entry points |
| `getRecordTreeId(record)` | Read `treeId` or `tree_id` with null fallback | Tree/memory relationship resolution |
| `normalizeBrowseTreeRecord(rawTree)` | Produce canonical tree shape with camelCase fields, compute `stage` via `estimateStage`, canonicalize thumbnail URL | Search/Browse tree cards, summary lists |
| `normalizeBrowseMemoryRecord(rawMemory)` | Produce canonical memory shape with camelCase fields, canonicalize source + thumbnail URLs | Preview cards, memory timeline, detail view |
| `estimateStage(count)` | Map memory count → Korean stage label ('새 트리', '입덕', '성장', '최애') | Tree stage badge rendering |
| `buildPublicTreeSummaryModels(apiTrees)` | Batch-normalize arrays of raw tree records, filter `visibility === 'public'`, compute minimal summary shape without memories | Search/Browse initial render, growing-trees section |
| `hydrateTreeWithPublicMemories(tree, apiMemories)` | Attach sorted memories, compute `timeRange`, aggregate distinct `emotionTags` (max 3), derive `representativeThumbnail` and `theme` from first memory, recalc `stage` and `memoryCount` | Selected tree preview (Search/Browse), Detail view memory list |
| `buildPublicTreeViewModels(apiTrees, apiMemories)` | Compose summary + hydration in one call — `buildPublicTreeSummaryModels(apiTrees).map(tree => hydrateTreeWithPublicMemories(tree, apiMemories))` | Potential future use; currently not directly called by page scripts |

**Note:** `window.__LoveBudApiClientInternals` internal attachment (lines 234-244) exposes a subset of helpers for runtime interop without full public adapter exposure.

## Current export contract

### Primary namespace

```javascript
window.LoveTreePublicTreeAdapter = { ... }
```

Exported keys (in order in source):

- `unwrapTreeRecord`
- `unwrapMemoryRecord`
- `getRecordTreeId`
- `normalizeBrowseTreeRecord`
- `normalizeBrowseMemoryRecord`
- `buildPublicTreeSummaryModels`
- `hydrateTreeWithPublicMemories`
- `buildPublicTreeViewModels`
- `sanitizeUrl`
- `isValidYouTubeVideoId`
- `isYouTubeHost`
- `extractYouTubeVideoId`
- `extractYouTubeVideoIdFromThumbnail`
- `buildCanonicalYouTubeThumbnailUrl`
- `buildCanonicalYouTubeEmbedUrl`
- `canonicalizeYouTubeSourceUrl`
- `canonicalizeYouTubeThumbnailUrl`

Total: **16 exported functions**.

### Internal bridge

After defining the namespace, the file optionally attaches a subset to `window.__LoveBudApiClientInternals` when present:

- `unwrapTreeRecord`
- `unwrapMemoryRecord`
- `getRecordTreeId`
- `normalizeBrowseTreeRecord`
- `normalizeYouTubeThumbnailUrl` (should be `canonicalizeYouTubeThumbnailUrl` — validates typo risk)
- `normalizeBrowseMemoryRecord`
- `canonicalizeYouTubeSourceUrl`
- `canonicalizeYouTubeThumbnailUrl`

**Breaking-change risk:** Any future removal/rename of the 8 primary normalization functions, or change to their return shape, will break `postgres-client.js` and Search data layer simultaneously.

## Loading-order risk assessment

### Current script order (verified)

**search.html**:
```html
<script src="../js/page-shell.js"></script>
<script src="../js/cache-utils.js"></script>
<script src="../js/api/auth-policy.js"></script>
<script src="../js/api/base-api-fetch.js"></script>
<script src="../js/api/public-tree-adapter.js"></script>  ← provides window.LoveTreePublicTreeAdapter
<script src="../js/postgres-client.js"></script>          ← reads window.LoveTreePublicTreeAdapter at init
<!-- Search modules… -->
```

**Other pages (editor.html, my-trees.html, detail.html)**:
```html
<script src="../js/page-shell.js"></script>
<script src="../js/cache-utils.js"></script>
<script src="../js/api/auth-policy.js"></script>
<script src="../js/api/base-api-fetch.js"></script>
<script src="../js/postgres-client.js"></script>          ← also reads window.LoveTreePublicTreeAdapter at init
```

**Risk:** `postgres-client.js` reads `window.LoveTreePublicTreeAdapter` at module load time (line 15). If `public-tree-adapter.js` fails to load or loads after `postgres-client.js`, `PublicTreeAdapter` will be `undefined` and all tree-preview API calls throw `'LoveTreePublicTreeAdapter not loaded'`.

**Pages affected by adapter dependency**:
- `pages/search.html` — Search data module (`search-index.js`, `search-data.js`) calls `buildPublicTreeSummaryModels` and `hydrateTreeWithPublicMemories` via `postgres-client.js`.
- `pages/editor.html` — Editor uses `postgres-client.js` for tree/memory operations; adapter is required for any public-tree preview or tree normalization.
- `pages/my-trees.html` — My Trees uses `postgres-client.js`; adapter is required for any public-facing tree normalization.
- `pages/detail.html` — Detail view uses `postgres-client.js`; adapter is required for memory/tree normalization and preview preparation.

**Future split risk:** If the adapter is split into multiple files (e.g., YouTube utils extracted into its own module), all dependent pages must update their `<script>` order to keep the adapter available before `postgres-client.js` runs. Any mismatch will cause `undefined` errors at runtime.

## Preview behavior implications

### Card preview (Search/Browse)
- `buildPublicTreeSummaryModels` supplies the card model shape (`id`, `title`, `visibility`, `representativeThumbnail`, `memoryCount`, `stage`, etc.).
- `canonicalizeYouTubeThumbnailUrl` determines the card image URL; incorrect resolution causes broken images or falls back to empty string.
- `estimateStage` is called at summary build time; changing its thresholds shifts stage badges across all public cards.

### Selected preview (Search/Browse)
- `hydrateTreeWithPublicMemories` enriches the selected tree with memory list, `timeRange`, distinct `emotionTags` (up to 3), and overrides `representativeThumbnail`/`theme` from the first memory if present.
- Preview rendering depends on `memories[0]?.thumbnail` for the large preview image; adapter's thumbnail canonicalization directly controls this.
- Memory timeline order is determined by `createdAt || timestamp` ascending; changing sort order will alter preview memory sequence.

### Detail view (Detail page)
- Detail page relies on `postgres-client.js` which internally calls `PublicTreeAdapter.hydrateTreeWithPublicMemories` and normalization helpers. Any shape change breaks Detail rendering.

### Editor (Editor page)
- Editor uses `postgres-client.js` for forks and updates; normalization consistency prevents data corruption when creating or editing trees/memories.

### My Trees (My Trees page)
- My Trees lists public + private trees; adapter normalization is used for card rendering consistency even for owned trees when public attributes are present.

## Recommendation

### Current state: Keep intact, split only when necessity is proven

The adapter is already reasonably factored. Its responsibilities are clear:
- YouTube URL handling (8 functions)
- Data unwrapping & ID extraction (4 functions)
- Normalization + hydration (4 functions)

**No immediate utility extraction is required.** The current single-file boundary preserves loading-order guarantees and avoids `<script>` reordering across four pages.

### If/when future split becomes necessary:

**PR A — YouTube URL utility extraction (docs-only contract map)**
- Document exact function signatures and all call-sites across `public-tree-adapter.js`, `postgres-client.js`, and any YouTube-specific UI code.
- Create `js/api/youtube-url-utils.js` as a separate module **without changing any adapters yet**.
- Document required `<script>` order: `youtube-url-utils.js` must load before `public-tree-adapter.js` AND before any file that calls its functions directly.

**PR B — Narrow adapter refactor to consume extracted utils**
- Modify `public-tree-adapter.js` to import/call the new utils module (script-tag inclusion in all 4 HTML pages).
- No function signature changes; only internal delegation.
- Require explicit page smoke verification that Search/Browse/Editor/My Trees card/preview rendering remains unchanged.

**PR C — Page-specific smoke verification**
- Before merging any split, run Cloudflare Preview smoke on:
  - Search initial render + tree card clicks + preview image load
  - Browse similar surfaces
  - Detail memory list & timestamps
  - Editor fork/tree-create flows
  - My Trees list rendering

**Caution:** Combining adapter split with Search architecture (#476), XSS audit (#417), or any visual redesign risks cascading scope creep. Keep adapter boundary work in its own narrow PRs.

## Guardrails

- Preserve existing `window.LoveTreePublicTreeAdapter` export name and all 16 function keys.
- Preserve `window.__LoveBudApiClientInternals` internal bridge attachment (if present).
- Do **not** combine adapter split with:
  - Search/Browse UI refactor (#476).
  - XSS/frontend security audit (#417).
  - Global CSS hardening (#418).
  - Runtime behavior changes to API client or AuthPolicy.
- Browser smoke **required** before any future adapter change merge (desktop + mobile 375px).
- No modifications to PR #7/prototype/reference/demo/variant paths.
- No modifications to PR #450/YouTube PoC files.

## Verification matrix

| Verification item | Status for this audit PR | Notes |
|---|---:|---|
| `git diff --check` | PASS | Required before PR report. |
| Docs-only changed files | YES | Only `docs/engineering/PUBLIC_TREE_ADAPTER_BOUNDARY_AUDIT.md` modified. |
| Adapter file inspected | YES | Full `js/api/public-tree-adapter.js` reviewed. |
| Adapter references inspected | YES | `js/search/search-index.js`, `js/search/data.js`, `js/postgres-client.js` checked. |
| Helper responsibility map | YES | All 16 functions categorized with surface impact. |
| Export contract documented | YES | Primary namespace + internal bridge fully listed. |
| Loading-order risk documented | YES | Script order across 4 pages analyzed, coupling to `postgres-client.js` flagged. |
| Preview behavior implications documented | YES | Card, preview, detail, editor, my-trees effects mapped. |
| Future split recommendation | YES | Current state preservation advised; conditional PR split plan defined. |
| JS files touched | NO | No implementation changes. |
| CSS files touched | NO | — |
| HTML/pages touched | NO | — |
| Runtime/API/Auth/backend modified | NO | — |
| package/workflow modified | NO | — |
| PR #7/prototype/reference/demo/variant touched | NO | — |
| PR #450 touched | NO | — |
| Secret/token/session/cookie/SSH key exposure | NO | — |

## Final audit status

Issue #412's public tree adapter boundaries are now documented. Future utility split work should follow the narrow PR sequence above, with browser smoke on all affected surfaces before merge.
