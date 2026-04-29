# Public Tree Adapter: YouTube Utility Split Audit

**Status:** AUDIT_ONLY — no implementation in this PR  
**Source issue:** #72 (Audit: public tree adapter and YouTube utility split)  
**Related:** #65 (Search JS responsibility split sequence)  
**Audited file:** `js/api/public-tree-adapter.js`  
**Date:** 2026-04-29

---

## 1. Audit Target

`js/api/public-tree-adapter.js` currently serves two responsibilities:

| Responsibility | Functions |
|---|---|
| **YouTube URL / thumbnail utility** | `sanitizeUrl`, `isValidYouTubeVideoId`, `isYouTubeHost`, `extractYouTubeVideoId`, `extractYouTubeVideoIdFromThumbnail`, `buildCanonicalYouTubeThumbnailUrl`, `buildCanonicalYouTubeEmbedUrl`, `canonicalizeYouTubeSourceUrl`, `canonicalizeYouTubeThumbnailUrl` |
| **Public tree data normalization / model building** | `unwrapTreeRecord`, `unwrapMemoryRecord`, `getRecordTreeId`, `normalizeBrowseTreeRecord`, `normalizeBrowseMemoryRecord`, `buildPublicTreeSummaryModels`, `hydrateTreeWithPublicMemories`, `buildPublicTreeViewModels`, `estimateStage` |

All YouTube utility functions are currently exposed on `window.LoveTreePublicTreeAdapter` and also assigned to `window.__LoveBudApiClientInternals` where available.

---

## 2. Current Contract to Preserve

### 2.1 Namespace contract

```js
window.LoveTreePublicTreeAdapter = {
  // model builders
  buildPublicTreeSummaryModels,
  hydrateTreeWithPublicMemories,
  buildPublicTreeViewModels,
  normalizeBrowseTreeRecord,
  normalizeBrowseMemoryRecord,
  unwrapTreeRecord,
  unwrapMemoryRecord,
  getRecordTreeId,
  // YouTube utils (currently co-located)
  sanitizeUrl,
  isValidYouTubeVideoId,
  isYouTubeHost,
  extractYouTubeVideoId,
  extractYouTubeVideoIdFromThumbnail,
  buildCanonicalYouTubeThumbnailUrl,
  buildCanonicalYouTubeEmbedUrl,
  canonicalizeYouTubeSourceUrl,
  canonicalizeYouTubeThumbnailUrl
};
```

Any extraction plan **must** keep `window.LoveTreePublicTreeAdapter.*` fully intact.

### 2.2 Thumbnail URL behavior to preserve

- `canonicalizeYouTubeThumbnailUrl(url, fallbackSourceUrl)` — extracts video ID from thumbnail URL or source URL, canonicalizes to `https://i.ytimg.com/vi/{videoId}/hqdefault.jpg`
- Non-YouTube thumbnails pass through if `!isYouTubeHost(url)`
- Invalid or missing IDs return `''`

### 2.3 Internal client internals contract

```js
window.__LoveBudApiClientInternals = {
  unwrapTreeRecord,
  unwrapMemoryRecord,
  getRecordTreeId,
  normalizeBrowseTreeRecord,
  normalizeBrowseMemoryRecord,
  canonicalizeYouTubeSourceUrl,
  canonicalizeYouTubeThumbnailUrl
};
```

This contract must survive extraction unchanged.

### 2.4 Consumer expectations

| Consumer | Dependency |
|---|---|
| `js/search-card-renderer.js` (→ `js/search/card-renderer.js` post #338) | `representativeThumbnail` from model output |
| `js/search-preview-renderer.js` (→ `js/search/preview-renderer.js` post #338) | `thumbnail`, `sourceUrl` from model output |
| `js/search.js` / `js/search/index.js` | `LoveTreePublicTreeAdapter.buildPublicTreeSummaryModels` |
| `js/postgres-client.js` | `__LoveBudApiClientInternals.*` |

---

## 3. YouTube Utility Function Inventory

### 3.1 Pure utility candidates (no DOM, no model dependency)

| Function | Lines (approx) | Purity | Split candidate |
|---|---|---|---|
| `sanitizeUrl(url)` | ~7 | ✅ pure | ✅ yes |
| `isValidYouTubeVideoId(id)` | ~3 | ✅ pure | ✅ yes |
| `isYouTubeHost(url)` | ~8 | ✅ pure | ✅ yes |
| `extractYouTubeVideoId(url)` | ~11 | ✅ pure | ✅ yes |
| `extractYouTubeVideoIdFromThumbnail(url)` | ~6 | ✅ pure | ✅ yes |
| `buildCanonicalYouTubeThumbnailUrl(videoId)` | ~3 | ✅ pure | ✅ yes |
| `buildCanonicalYouTubeEmbedUrl(videoId)` | ~3 | ✅ pure | ✅ yes |
| `canonicalizeYouTubeSourceUrl(url)` | ~5 | ✅ pure | ✅ yes |
| `canonicalizeYouTubeThumbnailUrl(url, fallbackSourceUrl)` | ~15 | ✅ pure | ✅ yes |

All 9 YouTube utility functions are **pure** (no DOM reads, no `window.*` side effects, no async). They depend only on each other and can safely be extracted.

### 3.2 Adapter-only functions (stay in adapter)

| Function | Reason |
|---|---|
| `unwrapTreeRecord` | model contract |
| `unwrapMemoryRecord` | model contract |
| `getRecordTreeId` | model contract |
| `normalizeBrowseTreeRecord` | calls YouTube utils + model |
| `normalizeBrowseMemoryRecord` | calls YouTube utils + model |
| `estimateStage` | model domain logic |
| `buildPublicTreeSummaryModels` | model builder |
| `hydrateTreeWithPublicMemories` | model builder |
| `buildPublicTreeViewModels` | model builder |

---

## 4. Candidate Future Utility: `js/utils/youtube-url.js`

### 4.1 Proposed scope

```js
// js/utils/youtube-url.js
// window.LoveBudYouTubeUrl
(function () {
  // sanitizeUrl, isValidYouTubeVideoId, isYouTubeHost,
  // extractYouTubeVideoId, extractYouTubeVideoIdFromThumbnail,
  // buildCanonicalYouTubeThumbnailUrl, buildCanonicalYouTubeEmbedUrl,
  // canonicalizeYouTubeSourceUrl, canonicalizeYouTubeThumbnailUrl
  window.LoveBudYouTubeUrl = { ... };
})();
```

### 4.2 Constraints

- **Pure helper only** — no DOM access, no fetch, no state
- **No broad `LoveBudMedia` abstraction** — this PR proposes YouTube-specific utility only
- **No Search grouping dependency** — script order must remain valid before and after Search grouping PRs (#336/#337/#338)
- **Namespace isolation** — `window.LoveBudYouTubeUrl` is new; `window.LoveTreePublicTreeAdapter` keeps all existing keys via compatibility delegation

### 4.3 Adapter delegation pattern (post-extraction)

```js
// js/api/public-tree-adapter.js (post-extraction)
const YT = window.LoveBudYouTubeUrl; // must be loaded before adapter

window.LoveTreePublicTreeAdapter = {
  // model builders unchanged
  buildPublicTreeSummaryModels,
  ...
  // YouTube utils: delegated to LoveBudYouTubeUrl, re-exposed for compatibility
  sanitizeUrl: YT.sanitizeUrl,
  canonicalizeYouTubeThumbnailUrl: YT.canonicalizeYouTubeThumbnailUrl,
  ...
};
```

---

## 5. Script Order Questions

| Question | Current answer | Risk |
|---|---|---|
| Must `pages/search.html` load utility before adapter? | Yes — adapter must load after utility | LOW: simple order addition |
| Do detail/public pages also depend on adapter? | VERIFY — `pages/detail.html` likely loads adapter | MEDIUM: need to audit detail.html script block |
| Does `postgres-client.js` use `__LoveBudApiClientInternals`? | YES — assigned in adapter | LOW: compatibility wrapper covers this |
| Does any page use `LoveTreePublicTreeAdapter.canonicalizeYouTubeThumbnailUrl` directly? | VERIFY — check all non-search pages | MEDIUM: if yes, compatibility delegation is mandatory |

### 5.1 Pages requiring script order audit before implementation

- [ ] `pages/search.html` — add `utils/youtube-url.js` before `api/public-tree-adapter.js`
- [ ] `pages/detail.html` — verify if adapter is loaded; add utility before adapter if so
- [ ] Any other page loading `public-tree-adapter.js` — find all references

---

## 6. Guardrails

- No implementation in this PR
- No adapter behavior changes
- No thumbnail URL output changes
- No `i.ytimg.com` / `hqdefault` fallback changes
- No Search URL state / data loading / preview changes
- No page script order changes
- No CSS changes
- No `pages/search.html` changes
- No PR #7/prototype/reference/demo/variant changes
- No broad `LoveBudMedia` namespace
- No bundler/module system changes

---

## 7. Follow-up PR Proposal

| Step | PR | Scope | Pre-condition |
|---|---|---|---|
| **A** | test-only thumbnail/URL contract | Contract coverage for `canonicalizeYouTubeThumbnailUrl`, `extractYouTubeVideoId` | None |
| **B** | `js/utils/youtube-url.js` extraction | Create utility file, no adapter changes | Step A green |
| **C** | adapter delegation | Adapter imports from utility, re-exposes for compatibility | Step B smoke |
| **D** | page script order | Add utility `<script>` before adapter on affected pages | Step C green |
| **E** | Cloudflare/fixed slot Browse/Search visual smoke | thumbnail render, card thumbnail, preview thumbnail | Step D green |

> ⚠️ Steps B–E must each be separate PRs. No combined extraction + adapter + script order in one PR.

> ⚠️ Steps B–E must not begin until Search JS grouping (#338), data split (#336), and URL state/controls (#337) are merged and stable on `main`.

---

## 8. Verification Checklist

- [x] `git diff --check` — docs-only, no whitespace errors
- [x] Changed files limited to `docs/engineering/PUBLIC_TREE_YOUTUBE_UTILITY_SPLIT_AUDIT.md`
- [x] No JS/CSS/page/API/runtime changes
- [x] No close keywords for #72 or #65
- [x] PR #336/#337/#338/#339/#340 untouched
- [x] PR #7/prototype/reference/demo/variant paths untouched
