# Loading State Current-State Audit

> **Parent #3688** · **Child #3689**
> **Class:** Generic Tier 2 / U2 source-only audit
> **Ref:** `origin/main` `36bdb3a53d3b716a0e7555ffc51d2043ac701074`
> **Browser / screenshot / Production:** not used

---

## 1. Evidence boundary

| Field | Value |
|---|---|
| Repository | `skerishKang/LoveBud` |
| Audited ref | `origin/main` |
| Exact commit | `36bdb3a53d3b716a0e7555ffc51d2043ac701074` |
| Expected commit | `36bdb3a53d3b716a0e7555ffc51d2043ac701074` |
| Start drift | `NONE` |
| Class | Generic Tier 2 / U2 source-only audit |
| Browser / screenshot / Production | not used |

This SHA is the evidence boundary. Every statement below is marked as one of:

| Marker | Meaning |
|---|---|
| `CONFIRMED_CURRENT_SOURCE` | Directly observed in current `origin/main` source |
| `HISTORICAL_ONLY` | Found only in past issues or archived docs; not current source |
| `INFERRED` | Reasonable inference from surrounding source; not directly observed |
| `UNKNOWN` | Cannot be determined from current source alone |

No inference is presented as confirmed runtime behavior.

---

## 2. Source-grounded matrix

### 2.1 Home hero thumbnail/card media

| Field | Finding |
|---|---|
| page | Home (`index.html`) |
| route | `/` |
| region | `.home-v3-collage` — card thumbnails within `growth-stage-card-media` |
| stable shell before data | CONFIRMED_CURRENT_SOURCE — all card shells are in static HTML. No initial data fetch required. |
| initial markup | CONFIRMED_CURRENT_SOURCE — four cards with inline SVG, fallback spans, and i18n attributes |
| loading visual | CONFIRMED_CURRENT_SOURCE — no loading indicator for thumbnails. Image placeholder is the `growth-stage-card-fallback` span. |
| loading copy | CONFIRMED_CURRENT_SOURCE — none. Thumbnail images have no loading copy. |
| runtime/data dependency | CONFIRMED_CURRENT_SOURCE — YouTube thumbnail images from `https://i.ytimg.com/vi/<id>/maxresdefault.jpg` (primary) or `/mqdefault.jpg` (fallback). Fetched lazily (`img.loading = 'lazy'`). |
| state owner file | CONFIRMED_CURRENT_SOURCE — `js/index-inline-init.js`: `applyArtistToCard()`, `initHeroGrowthCycle()` |
| state owner function | CONFIRMED_CURRENT_SOURCE — `applyArtistToCard()` (per-card thumbnail load), `thumbnailForArtistAt()` (URL resolution) |
| entry trigger | CONFIRMED_CURRENT_SOURCE — growth cycle phase → card content flip → `applyArtistToCard()` → img src set |
| ready transition | CONFIRMED_CURRENT_SOURCE — `img.addEventListener('load')` → existing img removed, new img gets `is-loaded` class → opacity transition 0.5s |
| partial-ready behavior | CONFIRMED_CURRENT_SOURCE — each card's thumbnail loads independently. Cards reveal via stagger (featured → supporting 120ms intervals). |
| empty behavior | UNKNOWN — no empty state defined for missing thumbnails if both maxresdefault and mqdefault fail. |
| degraded behavior | CONFIRMED_CURRENT_SOURCE — thumbnail error handling: maxresdefault fails → fall back to mqdefault. If mqdefault also fails → remove img, add `has-thumbnail-error` class to media. |
| error behavior | INFERRED — thumbnail failure results in `has-thumbnail-error` class (fallback text/title visible). No interactive error state. |
| retry behavior | UNKNOWN — no retry mechanism for thumbnail load failures after fallback chain exhausted. |
| long-wait behavior | UNKNOWN — no long-wait message or timeout for thumbnail loading. |
| ARIA/live-region behavior | CONFIRMED_CURRENT_SOURCE — thumbnail images have `alt=''` (decorative). The `growth-stage-caption` has `aria-live="polite"` but this announces the decorative stage progression, not thumbnail loading. Thumbnail loading has no `aria-live` announcement. No `aria-busy` on card media containers. |
| reduced-motion behavior | CONFIRMED_CURRENT_SOURCE — growth stage animation stops. Thumbnail image loading/opacity transition continues? INFERRED: image opacity transition may still play. |
| layout-stability strategy | INFERRED — card positions are grid-based. Thumbnail container has fixed aspect-ratio (16/9), so image loads do not shift layout. |
| privacy boundary | CONFIRMED_CURRENT_SOURCE — no private data. YouTube video IDs are public. |
| historical reference | INFERRED — issues #3624, #3626, #3628, #3630, #3640. |
| current disposition | CONFIRMED_CURRENT_SOURCE — per-card thumbnail loading with fallback chain. Missing: explicit loading copy, long-wait, retry, timeout, `aria-busy`. |
| candidate shared primitive | INFERRED — thumbnail fallback chain pattern (maxresdefault → mqdefault → hidden + CSS class). |
| implementation risk | Low — thumbnails are per-card and do not block page content. |

### 2.2 Home video modal/player

| Field | Finding |
|---|---|
| page | Home (`index.html`) |
| route | `/` |
| region | `.hero-video-modal` (dynamically created) |
| stable shell before data | CONFIRMED_CURRENT_SOURCE — modal does not exist until user clicks. No pre-rendered shell. |
| initial markup | CONFIRMED_CURRENT_SOURCE — none in HTML. Entire modal is created by JS. |
| loading visual | CONFIRMED_CURRENT_SOURCE — none. Modal opens with iframe appended immediately. No loading indicator between click and iframe ready. |
| loading copy | CONFIRMED_CURRENT_SOURCE — none. No loading text or status shown while iframe loads. |
| runtime/data dependency | CONFIRMED_CURRENT_SOURCE — YouTube iframe via `https://www.youtube-nocookie.com/embed/<id>?autoplay=1&rel=0`. Created after user click on card media. |
| state owner file | CONFIRMED_CURRENT_SOURCE — `js/index-inline-init.js`: `openVideoModal()`, `closeVideoModal()`, `youtubeEmbedUrl()` |
| state owner function | CONFIRMED_CURRENT_SOURCE — `openVideoModal()` (creates modal + iframe), `closeVideoModal()` (removes modal + resumes cycle) |
| entry trigger | CONFIRMED_CURRENT_SOURCE — user click on card media (`growth-stage-card-media` click handler) → `openVideoModal()` |
| ready transition | CONFIRMED_CURRENT_SOURCE — iframe appended. No load listener — transition is immediate (iframe may still be loading). |
| partial-ready behavior | UNKNOWN — modal blocks interaction until closed. No intermediate state between click and iframe ready. |
| empty behavior | UNKNOWN — not applicable; modal is only created when a video is selected. |
| degraded behavior | UNKNOWN — no iframe error listener. If iframe fails to load, user sees a blank dark overlay with no error message. |
| error behavior | UNKNOWN — no iframe load or error listener. If YouTube embed fails (e.g., blocked, invalid ID, network error), the modal shows a black box with no fallback. |
| retry behavior | UNKNOWN — no retry for iframe load failure. The only available action is closing the modal. |
| long-wait behavior | UNKNOWN — no long-wait message. If iframe takes long to load, user sees black box with no status. |
| ARIA/live-region behavior | CONFIRMED_CURRENT_SOURCE — modal has `role="dialog"`, `aria-modal="true"`, `aria-label` set to video title. Focus trapped inside modal. Close button focusable. No `aria-live` or `aria-busy` for iframe loading. |
| reduced-motion behavior | CONFIRMED_CURRENT_SOURCE — modal fade animation stops. Iframe content unaffected. |
| layout-stability strategy | CONFIRMED_CURRENT_SOURCE — modal is `position:fixed` overlay; no layout shift. |
| privacy boundary | CONFIRMED_CURRENT_SOURCE — YouTube video IDs are public. Modal uses `youtube-nocookie.com` for privacy-enhanced embed. |
| historical reference | INFERRED — #3624 (modal player), #3630 (large player). |
| current disposition | CONFIRMED_CURRENT_SOURCE — user-triggered modal with no iframe load/error handling. Missing: loading state, error state, long-wait state, retry, fallback navigation link. |
| candidate shared primitive | INFERRED — modal iframe loading pattern (poster/branded background + loading status → iframe load resolves → error shows safe close + YouTube link). |
| implementation risk | Low — modal is isolated from page lifecycle. Current behavior: black box on failure is a UX gap. |

### 2.3 Home hero copy and CTA

| Field | Finding |
|---|---|
| page | Home (`index.html`) |
| region | `.home-v3-copy` (title, desc, CTA, note, intro link) |
| stable shell before data | CONFIRMED_CURRENT_SOURCE — all copy is in static HTML with `data-i18n` attributes. No data fetch. |
| initial markup | CONFIRMED_CURRENT_SOURCE — full title, eyebrow, description, CTAs, note, intro link are in HTML. |
| loading visual | CONFIRMED_CURRENT_SOURCE — none. Content is immediately visible (after page-transition `reveal`). |
| loading copy | CONFIRMED_CURRENT_SOURCE — none. Not needed. |
| runtime/data dependency | CONFIRMED_CURRENT_SOURCE — only i18n resolution. |
| state owner file | CONFIRMED_CURRENT_SOURCE — `js/index-inline-init.js` |
| state owner function | CONFIRMED_CURRENT_SOURCE — `initHeroCopyLoop()` |
| entry trigger | CONFIRMED_CURRENT_SOURCE — `DOMContentLoaded` → `bootstrap()` |
| ready transition | CONFIRMED_CURRENT_SOURCE — no loading → immediately ready. `reveal` class fades in via page-transitions.js. |
| partial-ready behavior | CONFIRMED_CURRENT_SOURCE — headline alternates between two copy sets (set 1 and set 2) on a timer via `__lovebudHeroCopyToggle()`. |
| empty behavior | UNKNOWN — not applicable; static content is always present. |
| degraded behavior | INFERRED — if i18n fails, fallback Korean text is in `data-i18n` attributes as inline HTML content. |
| error behavior | UNKNOWN — no error path for copy. |
| retry behavior | UNKNOWN — none. |
| long-wait behavior | UNKNOWN — none. |
| ARIA/live-region behavior | UNKNOWN — no `aria-live` on copy area. |
| reduced-motion behavior | CONFIRMED_CURRENT_SOURCE — set 1 stays active; set 2 stays hidden. |
| layout-stability strategy | CONFIRMED_CURRENT_SOURCE — loop container height is stabilized via `stabilizeHeight()`, so CTA/note/intro link never move. |
| privacy boundary | CONFIRMED_CURRENT_SOURCE — no private data. |
| historical reference | HISTORICAL_ONLY — issue #2662 adjusted mobile hero title size. |
| current disposition | CONFIRMED_CURRENT_SOURCE — static copy with decorative alternating headline. |
| candidate shared primitive | INFERRED — none needed. |
| implementation risk | Low. |

### 2.4 Browse result shell

| Field | Finding |
|---|---|
| page | Browse (`pages/search.html`) |
| route | `/pages/search` |
| region | `.browse-curation-shell`, `.browse-utility-row`, `.browse-results-head` |
| stable shell before data | CONFIRMED_CURRENT_SOURCE — eyebrow, title, subtitle, search input, filter chips, and results heading are in HTML. |
| initial markup | CONFIRMED_CURRENT_SOURCE — all header/shell elements are present with i18n keys. |
| loading visual | CONFIRMED_CURRENT_SOURCE — skeleton cards are in HTML inside `#resultsList` (3 `search-skeleton-card` divs). |
| loading copy | INFERRED — skeleton cards have no loading text; they are purely visual (`aria-hidden="true"`). |
| runtime/data dependency | CONFIRMED_CURRENT_SOURCE — `window.apiClient.getPublicTrees()` is the primary data dependency. |
| state owner file | CONFIRMED_CURRENT_SOURCE — `js/search.js` (orchestrator), `js/search/search-data.js` (data loading), `js/search/search-card-renderer.js` (render) |
| state owner function | CONFIRMED_CURRENT_SOURCE — `searchData.loadPublicTrees()` in `search-data.js` |
| entry trigger | CONFIRMED_CURRENT_SOURCE — `DOMContentLoaded` in `js/search.js` → `searchData.loadPublicTrees()` |
| ready transition | CONFIRMED_CURRENT_SOURCE — Initial HTML shows skeleton cards. API response → `CardRenderer.renderResults()` replaces skeletons. Page transitions: `.page-transition-enter`, `.reveal-up`, `.reveal-fade`. |
| partial-ready behavior | CONFIRMED_CURRENT_SOURCE — stale-while-revalidate: cached trees render immediately, then API refresh replaces them. `isDemo` flag renders a demo badge for cached data. |
| empty behavior | CONFIRMED_CURRENT_SOURCE — `renderNoTreesState()` (no trees at all) and `renderEmptySearchState()` (filter matches zero). Both render into `#resultsList` with empty-state HTML. |
| degraded behavior | CONFIRMED_CURRENT_SOURCE — if API fails and cache exists, cache is shown. `isFromCache = true`, `apiTreesLoaded = false`. |
| error behavior | CONFIRMED_CURRENT_SOURCE — `renderLoadErrorState()` in UI. `search.errorHeading` (ko: 불러오지 못했어요), `search.errorBody` (ko: 네트워크 상태를 확인하고 다시 시도해 주세요). |
| retry behavior | INFERRED — `search.retryButton` i18n key exists (ko: 다시 시도). But the HTML does NOT have a retry button rendered by default. The `renderLoadErrorState()` is called from `renderResults()` when `state.loadError !== null && !state.isFromCache && state.allTrees.length === 0`. UNKNOWN whether this retry renders a clickable button. |
| long-wait behavior | UNKNOWN — no long-wait message or timeout defined. |
| ARIA/live-region behavior | CONFIRMED_CURRENT_SOURCE — skeleton cards are `aria-hidden="true"`. Preview sidebar uses `.preview-empty-state`, `.preview-state-empty`, `.preview-state-loading`, `.preview-state-no-moments` as CSS classes (no ARIA live regions observed). |
| reduced-motion behavior | CONFIRMED_CURRENT_SOURCE — `searchSkeletonPulse` stops in `search-card-renderer.js` under `@media (prefers-reduced-motion: reduce)`. |
| layout-stability strategy | CONFIRMED_CURRENT_SOURCE — skeleton cards match real card structure: same grid, same card classes (`tree-card`, `tree-card-media`, `tree-card-body`). |
| privacy boundary | CONFIRMED_CURRENT_SOURCE — no private data in skeleton HTML. |
| historical reference | HISTORICAL_ONLY — #691 (Browse latency measurement) is completed and documented in `BROWSE_LOADING_RUNTIME_EVIDENCE.md`. |
| current disposition | CONFIRMED_CURRENT_SOURCE — functional: skeleton → cache or API → results or empty or error. Retry mechanism presence UNKNOWN from source alone. |
| candidate shared primitive | CONFIRMED_CURRENT_SOURCE — skeleton card HTML/CSS is already loosely shared with My Trees (same `search-skeleton-card` classes). |
| implementation risk | Medium — Browse is the primary public surface. Changing skeleton structure affects both Browse and My Trees. |

### 2.5 Browse card grid

| Field | Finding |
|---|---|
| page | Browse (`pages/search.html`) |
| region | `#resultsList` |
| stable shell before data | CONFIRMED_CURRENT_SOURCE — skeleton cards are pre-rendered in HTML. |
| initial markup | CONFIRMED_CURRENT_SOURCE — 3 skeleton cards + demo badge slot. |
| loading visual | CONFIRMED_CURRENT_SOURCE — shimmer animation on skeleton blocks. |
| loading copy | CONFIRMED_CURRENT_SOURCE — none. Skeleton cards are `aria-hidden="true"`. |
| runtime/data dependency | CONFIRMED_CURRENT_SOURCE — `window.apiClient.getPublicTrees()` |
| state owner file | CONFIRMED_CURRENT_SOURCE — `js/search/search-card-renderer.js` |
| state owner function | CONFIRMED_CURRENT_SOURCE — `renderLoading()`, `renderResults()`, `renderSkeletonGrid()`, `_addAnimations()` |
| entry trigger | CONFIRMED_CURRENT_SOURCE — `loadPublicTrees()` |
| ready transition | CONFIRMED_CURRENT_SOURCE — `renderResults()` replaces innerHTML of `#resultsList`. Fade-in via CSS animation `fadeIn`. |
| partial-ready behavior | CONFIRMED_CURRENT_SOURCE — cached trees render first (`isDemo` mode shows badge). |
| empty behavior | CONFIRMED_CURRENT_SOURCE — `renderNoTreesState()`, `renderEmptySearchState()` with i18n copy and icon. |
| degraded behavior | CONFIRMED_CURRENT_SOURCE — cache-first, API-refresh pattern. |
| error behavior | CONFIRMED_CURRENT_SOURCE — error state rendered as card-like message (not full-page). |
| retry behavior | UNKNOWN — the error state may include a retry action but cannot be confirmed from source alone. |
| long-wait behavior | UNKNOWN — no long-wait state. |
| ARIA/live-region behavior | CONFIRMED_CURRENT_SOURCE — skeleton cards use `aria-hidden="true"`. Real cards have `role="button"` and `tabindex="0"`. No `aria-busy` on container. |
| reduced-motion behavior | CONFIRMED_CURRENT_SOURCE — skeleton pulse stops. FadeIn animation may still play (INFERRED: CSS keyframe may have no reduction guard). |
| layout-stability strategy | CONFIRMED_CURRENT_SOURCE — skeleton uses same card structure and grid as real cards. |
| privacy boundary | CONFIRMED_CURRENT_SOURCE — no private data. |
| historical reference | HISTORICAL_ONLY — #691 (Browse latency measurement). |
| current disposition | CONFIRMED_CURRENT_SOURCE — functional skeleton-based loading with empty/error states. |
| candidate shared primitive | INFERRED — skeleton grid pattern is shared with My Trees. |
| implementation risk | Medium. |

### 2.6 Browse preview hub

| Field | Finding |
|---|---|
| page | Browse (`pages/search.html`) |
| region | `#previewSidebar` |
| stable shell before data | CONFIRMED_CURRENT_SOURCE — preview sidebar has static "감상 허브" header, close button, and preview-empty-state with placeholder text. |
| initial markup | CONFIRMED_CURRENT_SOURCE — empty state: "러브트리를 고르면 이어진 순간의 흐름이 여기에 열려요." |
| loading visual | CONFIRMED_CURRENT_SOURCE — CSS class `preview-state-loading` exists. Preview renderer shows a loading state via `ui.renderPreviewLoadingState()`. |
| loading copy | CONFIRMED_CURRENT_SOURCE — `search.previewLoadingLead` (ko: 대표 순간을 불러오는 중이에요.), `search.previewLoadingHeading` (ko: 감상 허브를 여는 중), `search.previewLoadingBody` (ko: 대표 순간이 열려요.) |
| runtime/data dependency | CONFIRMED_CURRENT_SOURCE — `window.apiClient.getPublicTreePreview()` or cache |
| state owner file | CONFIRMED_CURRENT_SOURCE — `js/search/search-preview-renderer.js`, `js/search/search-preview-state.js`, `js/search/search-preview-cache.js` |
| state owner function | CONFIRMED_CURRENT_SOURCE — `hydrateSelectedTreePreview()` in `search-data.js` |
| entry trigger | CONFIRMED_CURRENT_SOURCE — `selectTree()` → `hydrateSelectedTreePreview()` |
| ready transition | CONFIRMED_CURRENT_SOURCE — `PreviewRenderer.updatePreview()` populates preview. CSS classes change from `preview-state-empty`/`preview-state-loading` to `preview-state-media`/`preview-state-thumbnail`. |
| partial-ready behavior | INFERRED — preview may show while tree data is still hydrating. |
| empty behavior | CONFIRMED_CURRENT_SOURCE — `preview-empty-state` with placeholder text. Separate `preview-state-no-moments` for tree with moments not yet visible. |
| degraded behavior | CONFIRMED_CURRENT_SOURCE — preview cache TTL 5 min. If preview hydration fails, `ui.clearSelectedPreview()` is called. |
| error behavior | INFERRED — hydration failure logs warning and clears preview. No explicit error state in preview sidebar. |
| retry behavior | UNKNOWN — no retry for preview hydration failure. |
| long-wait behavior | UNKNOWN — no long-wait message. |
| ARIA/live-region behavior | UNKNOWN — preview states use CSS classes, not ARIA live regions. |
| reduced-motion behavior | UNKNOWN — no reduced-motion override observed in preview CSS. |
| layout-stability strategy | CONFIRMED_CURRENT_SOURCE — preview sidebar has fixed layout; content replaces inline. |
| privacy boundary | CONFIRMED_CURRENT_SOURCE — public tree data only. |
| historical reference | HISTORICAL_ONLY — #907 preview hub shell, #2825 flow stage clicks. |
| current disposition | CONFIRMED_CURRENT_SOURCE — preview has loading state but no error/retry state. |
| candidate shared primitive | INFERRED — My Trees preview hub mirrors Browse preview structure. |
| implementation risk | Medium — shared with My Trees preview hub. |

### 2.7 Browse incremental loading

| Field | Finding |
|---|---|
| page | Browse (`pages/search.html`) |
| region | Below `#resultsList` |
| stable shell before data | CONFIRMED_CURRENT_SOURCE — sentinel div created by JS. |
| initial markup | CONFIRMED_CURRENT_SOURCE — none in HTML. Created by `createScrollLoadSentinel()` in `search-scroll-load.js`. |
| loading visual | CONFIRMED_CURRENT_SOURCE — sentinel shows progress_activity icon + "Loading more LoveTrees..." text. |
| loading copy | CONFIRMED_CURRENT_SOURCE — "Loading more LoveTrees..." (hardcoded English). |
| runtime/data dependency | CONFIRMED_CURRENT_SOURCE — `window.apiClient.getPublicTrees()` |
| state owner file | CONFIRMED_CURRENT_SOURCE — `js/search/search-scroll-load.js` |
| state owner function | CONFIRMED_CURRENT_SOURCE — `ensureScrollLoadSentinel()`, `requestScrollLoadMoreWithContext()` |
| entry trigger | CONFIRMED_CURRENT_SOURCE — `IntersectionObserver` watches sentinel. Scroll/wheel/touch/keyboard intent. |
| ready transition | CONFIRMED_CURRENT_SOURCE — sentinel `is-loading` class toggled. Cards appended to results list. |
| partial-ready behavior | CONFIRMED_CURRENT_SOURCE — sentinel hidden when `currentLimit >= 60` or `hasMoreTrees = false`. |
| empty behavior | CONFIRMED_CURRENT_SOURCE — sentinel hidden when no more data. |
| degraded behavior | INFERRED — API failure during incremental load may silently fail. |
| error behavior | UNKNOWN — no error state observed for incremental load failure. |
| retry behavior | UNKNOWN — sentinel may retry on scroll but behavior is UNKNOWN from source alone. |
| long-wait behavior | UNKNOWN — no long-wait message. |
| ARIA/live-region behavior | INFERRED — `aria-hidden="true"` when done. No `aria-busy`. |
| reduced-motion behavior | UNKNOWN — sentinel animation may not respect reduced motion. |
| layout-stability strategy | INFERRED — cards appended at bottom, no layout shift above viewport. |
| privacy boundary | CONFIRMED_CURRENT_SOURCE — public data only. |
| historical reference | UNKNOWN — scroll load appears to be an ongoing implementation. |
| current disposition | CONFIRMED_CURRENT_SOURCE — functional incremental loading with sentinel. Korean loading copy is UNKNOWN (hardcoded English present). |
| candidate shared primitive | INFERRED — pattern could be shared with My Trees. |
| implementation risk | Low-Medium — scroll behavior may need cross-page consistency. |

### 2.8 My Trees result shell

| Field | Finding |
|---|---|
| page | My Trees (`pages/my-trees.html`) |
| route | `/pages/my-trees` |
| region | `.browse-curation-shell`, `.my-trees-finder`, `.my-trees-results-head` |
| stable shell before data | CONFIRMED_CURRENT_SOURCE — eyebrow, title, description, search input, filter chips, sort controls, create button are in initial HTML. |
| initial markup | CONFIRMED_CURRENT_SOURCE — all shell elements present with i18n keys. |
| loading visual | CONFIRMED_CURRENT_SOURCE — initial `my-trees-auth-pending` class hides entire container. After auth, loading state shows spinner + skeleton grid + text. |
| loading copy | CONFIRMED_CURRENT_SOURCE — `myTrees.loading` (ko: 러브트리 목록을 불러오는 중...) |
| runtime/data dependency | CONFIRMED_CURRENT_SOURCE — `window.apiClient.getTrees()` (authenticated) |
| state owner file | CONFIRMED_CURRENT_SOURCE — `js/my-trees/my-trees-page.js` (state machine), `js/my-trees/my-trees-data.js` (data loading), `js/my-trees.js` (orchestrator) |
| state owner function | CONFIRMED_CURRENT_SOURCE — `loadTrees()`, `setState()`. State constants: `STATE.LOADING`, `STATE.LOADED`, `STATE.EMPTY`, `STATE.ERROR`. |
| entry trigger | CONFIRMED_CURRENT_SOURCE — auth ready → `bootMyTrees()` → `startMyTrees()` → `loadTrees()`. BFCache recovery via `pageshow`. |
| ready transition | CONFIRMED_CURRENT_SOURCE — `setState(STATE.LOADED)` → `#state-loaded` shown with rendered tree cards. |
| partial-ready behavior | INFERRED — cache-first pattern: `myTreesBootedFromCache`. |
| empty behavior | CONFIRMED_CURRENT_SOURCE — `setState(STATE.EMPTY)` → `#state-empty` shown with icon, heading, desc, and create button. |
| degraded behavior | CONFIRMED_CURRENT_SOURCE — if auth session cached but API fails, BFCache recovery attempts to reload. Error type can be `auth`, `server`, `network`, `generic`. |
| error behavior | CONFIRMED_CURRENT_SOURCE — `setState(STATE.ERROR)` → `#state-error` shown with icon, title, desc, and retry button (`#retryLoadBtn`). Error type is passed via `_applyErrorStateMessage(errorType)`. |
| retry behavior | CONFIRMED_CURRENT_SOURCE — retry button `#retryLoadBtn` calls `loadTrees()`. Error also has retry button in `error-state` div. |
| long-wait behavior | UNKNOWN — no long-wait message or timeout. |
| ARIA/live-region behavior | CONFIRMED_CURRENT_SOURCE — `state-hidden` elements get `aria-hidden="true"`. `state-visible`/`state-visible-block` remove `aria-hidden`. |
| reduced-motion behavior | CONFIRMED_CURRENT_SOURCE — skeleton grid uses same `search-skeleton-card` as Browse (pulse stops under reduced motion). Spinner animation may continue (INFERRED: `spin` keyframe has no reduction guard). |
| layout-stability strategy | CONFIRMED_CURRENT_SOURCE — skeleton grid matches real card grid structure. `state-visible`/`state-hidden` toggle display. `my-trees-auth-pending` uses `visibility: hidden` to prevent layout shift. |
| privacy boundary | CONFIRMED_CURRENT_SOURCE — tree list requires auth. No tree IDs exposed in error messages. |
| historical reference | HISTORICAL_ONLY — #616 My Trees loading continuation. |
| current disposition | CONFIRMED_CURRENT_SOURCE — complete state machine with loading, empty, error, retry. Best-documented loading pattern in the app. |
| candidate shared primitive | INFERRED — state class pattern (`state-visible`, `state-hidden`, `state-visible-block`) and error type dispatch. |
| implementation risk | Low — isolated to My Trees page. |

### 2.9 My Trees card grid

| Field | Finding |
|---|---|
| page | My Trees (`pages/my-trees.html`) |
| region | `#treesContainer` → `#state-loading` / `#state-loaded` |
| stable shell before data | CONFIRMED_CURRENT_SOURCE — `#treesContainer` has `#state-loading` with spinner + skeleton grid visible initially. |
| initial markup | CONFIRMED_CURRENT_SOURCE — 3 skeleton cards inside `#state-loading`. |
| loading visual | CONFIRMED_CURRENT_SOURCE — spinner (`18px` rotating circle) + skeleton grid (3 cards) + loading text. |
| loading copy | CONFIRMED_CURRENT_SOURCE — "러브트리 목록을 불러오는 중..." (in HTML, not i18n). |
| runtime/data dependency | CONFIRMED_CURRENT_SOURCE — `window.apiClient.getTrees()` |
| state owner file | CONFIRMED_CURRENT_SOURCE — `js/my-trees/my-trees-render.js`, `js/my-trees/my-trees-page.js` |
| state owner function | CONFIRMED_CURRENT_SOURCE — `renderTrees()` → `myTreesRender.renderTrees()`. Fallback: manually builds `trees-grid`. |
| entry trigger | CONFIRMED_CURRENT_SOURCE — `loadTrees()` → API → `renderTrees()`. |
| ready transition | CONFIRMED_CURRENT_SOURCE — `setState(STATE.LOADED)` → `#state-loaded` shown with grid div. |
| partial-ready behavior | INFERRED — cache-first rendering. |
| empty behavior | CONFIRMED_CURRENT_SOURCE — `STATE.EMPTY` shows `#state-empty` with "아직 러브트리가 없어요", icon, create button. |
| degraded behavior | CONFIRMED_CURRENT_SOURCE — error states with typed messages. |
| error behavior | CONFIRMED_CURRENT_SOURCE — `STATE.ERROR` with `_applyErrorStateMessage()`. |
| retry behavior | CONFIRMED_CURRENT_SOURCE — `#retryLoadBtn` in `#state-error`. |
| long-wait behavior | UNKNOWN — no long-wait state. |
| ARIA/live-region behavior | CONFIRMED_CURRENT_SOURCE — `#state-loading` does not have `aria-live`; state visibility is managed via display classes. |
| reduced-motion behavior | INFERRED — skeleton animation stops (shared Browse CSS). Spinner may continue. |
| layout-stability strategy | CONFIRMED_CURRENT_SOURCE — skeleton grid has same 3-column layout as real card grid. |
| privacy boundary | CONFIRMED_CURRENT_SOURCE — auth-protected page. |
| historical reference | HISTORICAL_ONLY — #616 My Trees loading continuation. |
| current disposition | CONFIRMED_CURRENT_SOURCE — complete card loading lifecycle. |
| candidate shared primitive | INFERRED — skeleton grid pattern shared with Browse. |
| implementation risk | Low. |

### 2.10 My Trees preview hub

| Field | Finding |
|---|---|
| page | My Trees (`pages/my-trees.html`) |
| region | `#myTreesHubPanel` |
| stable shell before data | CONFIRMED_CURRENT_SOURCE — sidebar has header, badge, placeholder text, and empty action slots in HTML. |
| initial markup | CONFIRMED_CURRENT_SOURCE — placeholder: "왼쪽에서 내 러브트리를 고르면 이어진 순간과 관리 흐름이 여기에 열려요." Empty state with `preview-state-empty` class. |
| loading visual | INFERRED — `preview-state-loading` CSS class exists but no explicit loading copy for My Trees hub. |
| loading copy | UNKNOWN — Browse preview has loading copy (`search.previewLoadingLead`), but My Trees hub does not appear to have equivalent i18n. |
| runtime/data dependency | CONFIRMED_CURRENT_SOURCE — tree data (already loaded for card grid), preview hub reads from memory. |
| state owner file | CONFIRMED_CURRENT_SOURCE — `js/my-trees/my-trees-preview-hub.js` |
| state owner function | CONFIRMED_CURRENT_SOURCE — `showPlaceholder()`, `showContent()` (inferred), `.onCardClick()` |
| entry trigger | CONFIRMED_CURRENT_SOURCE — card click → `onCardClick(tree)` |
| ready transition | CONFIRMED_CURRENT_SOURCE — `is-empty`/`is-loaded` classes toggle. Content slots populated. |
| partial-ready behavior | UNKNOWN — hub may show while tree data hydrates. |
| empty behavior | CONFIRMED_CURRENT_SOURCE — placeholder shown when no tree selected. `preview-state-no-moments` when tree has no moments. |
| degraded behavior | UNKNOWN — hub behavior when tree data is partial. |
| error behavior | UNKNOWN — no explicit error state in hub. |
| retry behavior | UNKNOWN — none observed. |
| long-wait behavior | UNKNOWN — none. |
| ARIA/live-region behavior | UNKNOWN — no ARIA live regions observed. |
| reduced-motion behavior | UNKNOWN — none observed. |
| layout-stability strategy | CONFIRMED_CURRENT_SOURCE — fixed sidebar layout, content replaces inline. |
| privacy boundary | CONFIRMED_CURRENT_SOURCE — owner data; tree IDs may be exposed in DOM attributes. |
| historical reference | HISTORICAL_ONLY — #2835 summary-slot-align. |
| current disposition | CONFIRMED_CURRENT_SOURCE — preview hub works but lacks dedicated loading/error states. |
| candidate shared primitive | INFERRED — strongly mirrors Browse preview hub. |
| implementation risk | Medium — shared architecture with Browse preview. |

### 2.11 Editor page shell and auth readiness

| Field | Finding |
|---|---|
| page | Editor (`pages/editor.html`) |
| region | Page shell, shared header, auth |
| stable shell before data | CONFIRMED_CURRENT_SOURCE — `editor-preload` class on body. Shared header mount point. Editor layout is in HTML. |
| initial markup | CONFIRMED_CURRENT_SOURCE — shell mounts (`#editorSidebarTemplateMount`, `#canvasArea`, detail panel mounts) are empty divs. Templates are loaded via `<script type="module">`. |
| loading visual | CONFIRMED_CURRENT_SOURCE — none explicitly. `editor-preload` class on body (CSS may use this for opacity). |
| loading copy | UNKNOWN — no loading text in shell HTML. |
| runtime/data dependency | CONFIRMED_CURRENT_SOURCE — auth (Firebase), tree data from URL params, memory data from API. |
| state owner file | CONFIRMED_CURRENT_SOURCE — `js/editor/editor-page-shell-init.js`, `js/editor/editor-initial-load-flow.js`, `js/editor/editor-shell-startup.js`, `js/editor/editor-data-loader.js` |
| state owner function | CONFIRMED_CURRENT_SOURCE — `initEditorPageShell()`, `runEditorInitialLoadFlow()`, `loadInitialEditorTree()` |
| entry trigger | CONFIRMED_CURRENT_SOURCE — `DOMContentLoaded` → script execution cascade. `editor-page-shell-init.js` is the last script. |
| ready transition | INFERRED — templates mount into shell mounts. Canvas initializes. |
| partial-ready behavior | INFERRED — tree loads first, then memories. |
| empty behavior | CONFIRMED_CURRENT_SOURCE — empty canvas guide shown via `#editorEmptyGuideTemplateMount`. |
| degraded behavior | INFERRED — tree load failure shows error state via `renderTreeLoadError()`. |
| error behavior | CONFIRMED_CURRENT_SOURCE — tree load error with `errorTitle` and `errorDesc`. Auth required shows toast + redirect. |
| retry behavior | INFERRED — no explicit retry button for tree load. |
| long-wait behavior | UNKNOWN — none. |
| ARIA/live-region behavior | CONFIRMED_CURRENT_SOURCE — `tree_access_denied` i18n. Editor panels have ARIA labels. |
| reduced-motion behavior | INFERRED — page-transitions respect reduced motion. |
| layout-stability strategy | CONFIRMED_CURRENT_SOURCE — empty shell mounts preserve layout. |
| privacy boundary | CONFIRMED_CURRENT_SOURCE — auth-protected. Tree IDs in URL. |
| historical reference | HISTORICAL_ONLY — #624 (Editor title-loading) completed. |
| current disposition | CONFIRMED_CURRENT_SOURCE — auth-gated page with shell-initialization loading. No explicit loading skeleton for shell. |
| candidate shared primitive | INFERRED — editor page shell init pattern. |
| implementation risk | High — editor is the most complex page. |

### 2.12 Editor tree identity/title

| Field | Finding |
|---|---|
| page | Editor (`pages/editor.html`) |
| region | Sidebar tree title area |
| stable shell before data | INFERRED — sidebar template mount starts empty. |
| initial markup | CONFIRMED_CURRENT_SOURCE — none in initial HTML. |
| loading visual | UNKNOWN — no skeleton observed for sidebar title. |
| loading copy | INFERRED — `editor_sidebar_flow_summary_empty` (ko: 첫 순간이 심어지면 흐름이 여기서 이어져요) may show before title loads. |
| runtime/data dependency | CONFIRMED_CURRENT_SOURCE — `window.apiClient.getTree()` |
| state owner file | CONFIRMED_CURRENT_SOURCE — `js/editor/editor-sidebar-ui.js`, `js/editor/editor-initial-load-flow.js` |
| state owner function | CONFIRMED_CURRENT_SOURCE — `runEditorInitialLoadFlow()` → `loadInitialEditorTree()` |
| entry trigger | CONFIRMED_CURRENT_SOURCE — editor startup → URL tree ID → load tree |
| ready transition | INFERRED — tree data synced via `syncCurrentTreeData()`. |
| partial-ready behavior | INFERRED — memories may load after tree identity. |
| empty behavior | CONFIRMED_CURRENT_SOURCE — `editor_canvas_empty_title` (ko: 이 트리의 첫 순간을 기록해볼까요?) |
| degraded behavior | INFERRED — tree load failure shows error. |
| error behavior | CONFIRMED_CURRENT_SOURCE — `renderTreeLoadError()` with styled error panel. |
| retry behavior | UNKNOWN — no retry for tree load in editor. |
| long-wait behavior | UNKNOWN — none. |
| ARIA/live-region behavior | UNKNOWN — not observed. |
| reduced-motion behavior | INFERRED — global reduced-motion applies. |
| layout-stability strategy | INFERRED — empty mount with minimum height. |
| privacy boundary | CONFIRMED_CURRENT_SOURCE — tree ID in URL. |
| historical reference | HISTORICAL_ONLY — #624 (Editor title-loading) completed. |
| current disposition | INFERRED — functional but no explicit loading state for tree title. |
| candidate shared primitive | INFERRED — tree-load pattern. |
| implementation risk | Medium — tree identity is core to editor. |

### 2.13 Editor memory list

| Field | Finding |
|---|---|
| page | Editor (`pages/editor.html`) |
| region | Canvas nodes |
| stable shell before data | INFERRED — empty canvas area. |
| initial markup | CONFIRMED_CURRENT_SOURCE — empty `#canvasSvg` and shell mounts. |
| loading visual | CONFIRMED_CURRENT_SOURCE — `editor-canvas-node.js` creates per-node img + skeleton div (`node-skeleton` class). |
| loading copy | INFERRED — per-node skeleton is visual-only (no text). |
| runtime/data dependency | CONFIRMED_CURRENT_SOURCE — `window.apiClient.getMemories()` via `loadEditorMemories()` |
| state owner file | CONFIRMED_CURRENT_SOURCE — `js/editor/editor-canvas-node.js`, `js/editor/editor-data-loader.js` |
| state owner function | CONFIRMED_CURRENT_SOURCE — `createNodeImageSection()`, `loadEditorMemories()` |
| entry trigger | CONFIRMED_CURRENT_SOURCE — tree loaded → memories loaded → canvas nodes created |
| ready transition | INFERRED — canvas nodes rendered with node cards. |
| partial-ready behavior | INFERRED — tree loads before memories. |
| empty behavior | CONFIRMED_CURRENT_SOURCE — `editor_canvas_empty_title`, `editor_canvas_empty_eyebrow`, `editor_canvas_empty_desc` in i18n. |
| degraded behavior | UNKNOWN — what happens when memories partially load. |
| error behavior | INFERRED — memory load failure may be silent. |
| retry behavior | UNKNOWN — none observed. |
| long-wait behavior | UNKNOWN — none. |
| ARIA/live-region behavior | UNKNOWN — nodes have `role="button"` and `aria-label` after creation. |
| reduced-motion behavior | INFERRED — canvas animation may not have reduction guards. |
| layout-stability strategy | INFERRED — absolute positioning of nodes. |
| privacy boundary | CONFIRMED_CURRENT_SOURCE — auth-protected. Memory IDs in DOM. |
| historical reference | UNKNOWN — earlier memory-loading work likely predates this audit. |
| current disposition | CONFIRMED_CURRENT_SOURCE — per-node image skeleton pattern exists. No list-level loading skeleton. |
| candidate shared primitive | INFERRED — per-node image skeleton pattern. |
| implementation risk | Medium. |

### 2.14 Editor selected detail

| Field | Finding |
|---|---|
| page | Editor (`pages/editor.html`) |
| region | Detail panel |
| stable shell before data | INFERRED — empty detail panel shell. |
| initial markup | CONFIRMED_CURRENT_SOURCE — detail panel mounts are empty divs. |
| loading visual | INFERRED — empty state shown before selection. |
| loading copy | CONFIRMED_CURRENT_SOURCE — `detail_empty_title` (ko: 아직 선택한 순간이 없어요), `detail_empty_desc` (ko: 첫 순간은 가운데에서 시작하세요.) |
| runtime/data dependency | CONFIRMED_CURRENT_SOURCE — memory data (already loaded for canvas). |
| state owner file | CONFIRMED_CURRENT_SOURCE — `js/editor/editor-detail-ui.js`, `js/editor/editor-detail-tree-meta.js` |
| state owner function | INFERRED — detail panel re-renders on selection. |
| entry trigger | CONFIRMED_CURRENT_SOURCE — node click on canvas → selection. |
| ready transition | INFERRED — detail panel populates. |
| partial-ready behavior | UNKNOWN — selection may work before full detail is ready. |
| empty behavior | CONFIRMED_CURRENT_SOURCE — detail empty state template. |
| degraded behavior | UNKNOWN — none observed. |
| error behavior | UNKNOWN — none observed for detail panel. |
| retry behavior | UNKNOWN — none. |
| long-wait behavior | UNKNOWN — none. |
| ARIA/live-region behavior | UNKNOWN — none observed. |
| reduced-motion behavior | INFERRED — global reduced-motion applies. |
| layout-stability strategy | INFERRED — detail panel has fixed layout. |
| privacy boundary | CONFIRMED_CURRENT_SOURCE — auth-protected. |
| historical reference | UNKNOWN — panel has seen iterations. |
| current disposition | INFERRED — functional but no explicit loading state for detail panel selection. |
| candidate shared primitive | INFERRED — detail panel pattern. |
| implementation risk | Low. |

### 2.15 Editor media

| Field | Finding |
|---|---|
| page | Editor (`pages/editor.html`) |
| region | Per-node media in canvas |
| stable shell before data | CONFIRMED_CURRENT_SOURCE — per-node: skeleton div created by `createNodeImageSection()` |
| initial markup | CONFIRMED_CURRENT_SOURCE — none in HTML. JS creates `node-skeleton` div. |
| loading visual | CONFIRMED_CURRENT_SOURCE — skeleton div shown until image loads (`img.onload` → `hideNodeSkeleton()`). |
| loading copy | CONFIRMED_CURRENT_SOURCE — none (visual-only skeleton). |
| runtime/data dependency | CONFIRMED_CURRENT_SOURCE — YouTube thumbnail images per memory. |
| state owner file | CONFIRMED_CURRENT_SOURCE — `js/editor/editor-canvas-node.js` |
| state owner function | CONFIRMED_CURRENT_SOURCE — `createNodeImageSection()`, `hideNodeSkeleton()`, `handleNodeImageError()` |
| entry trigger | CONFIRMED_CURRENT_SOURCE — canvas node creation → image src set |
| ready transition | CONFIRMED_CURRENT_SOURCE — `img.classList.add('loaded')`, `skeleton.style.display = 'none'` |
| partial-ready behavior | CONFIRMED_CURRENT_SOURCE — each image loads independently. |
| empty behavior | CONFIRMED_CURRENT_SOURCE — if no thumbnail, skeleton falls back to music note (`"\u266A"`). |
| degraded behavior | CONFIRMED_CURRENT_SOURCE — YouTube thumbnail fallback chain: hqdefault → mqdefault → default. |
| error behavior | CONFIRMED_CURRENT_SOURCE — after all fallbacks fail, img hidden and skeleton shows music note. |
| retry behavior | UNKNOWN — no retry for image errors. |
| long-wait behavior | UNKNOWN — none. |
| ARIA/live-region behavior | UNKNOWN — no ARIA on node images. |
| reduced-motion behavior | UNKNOWN — skeleton is static (no animation). |
| layout-stability strategy | INFERRED — absolute-positioned nodes, skeleton has fixed dimensions. |
| privacy boundary | CONFIRMED_CURRENT_SOURCE — video IDs exposed in DOM. |
| historical reference | UNKNOWN — editor media loading. |
| current disposition | CONFIRMED_CURRENT_SOURCE — functional per-node image loading with fallback chain. |
| candidate shared primitive | CONFIRMED_CURRENT_SOURCE — image-skeleton + fallback chain pattern (mirrors Browse thumbnail handling). |
| implementation risk | Low. |

### 2.16 Editor connected/context information

| Field | Finding |
|---|---|
| page | Editor (`pages/editor.html`) |
| region | Sidebar tree context, flow summary |
| stable shell before data | INFERRED — sidebar template mount starts empty. Templates populate after data. |
| initial markup | CONFIRMED_CURRENT_SOURCE — none in initial HTML. |
| loading visual | UNKNOWN — no loading skeleton for connected info. |
| loading copy | CONFIRMED_CURRENT_SOURCE — `sidebar_flow_summary_empty` (ko: 첫 순간이 심어지면 흐름이 여기서 이어져요) |
| runtime/data dependency | CONFIRMED_CURRENT_SOURCE — tree data, memories |
| state owner file | CONFIRMED_CURRENT_SOURCE — `js/editor/editor-sidebar-ui.js` |
| state owner function | INFERRED — `updateSidebarTreeActions()` and related. |
| entry trigger | CONFIRMED_CURRENT_SOURCE — tree loaded → sidebar populated |
| ready transition | INFERRED — sidebar templates render into mount. |
| partial-ready behavior | INFERRED — memories may update sidebar as they load. |
| empty behavior | CONFIRMED_CURRENT_SOURCE — empty tree summary. |
| degraded behavior | UNKNOWN — none observed. |
| error behavior | UNKNOWN — none observed for sidebar context. |
| retry behavior | UNKNOWN — none. |
| long-wait behavior | UNKNOWN — none. |
| ARIA/live-region behavior | UNKNOWN — not observed. |
| reduced-motion behavior | INFERRED — global reduced-motion. |
| layout-stability strategy | INFERRED — sidebar mount has layout dimensions. |
| privacy boundary | CONFIRMED_CURRENT_SOURCE — auth-protected. |
| historical reference | UNKNOWN — sidebar has seen iterations. |
| current disposition | INFERRED — functional but no explicit loading state for connected info. |
| candidate shared primitive | INFERRED — sidebar context pattern. |
| implementation risk | Low. |

### 2.17 Detail current moment

| Field | Finding |
|---|---|
| page | Detail (`pages/detail.html`) |
| route | `/pages/detail?id=xxx` |
| region | `#detailHero`, `#videoMain`, `#memoryTitle`, diary area |
| stable shell before data | CONFIRMED_CURRENT_SOURCE — hero section with placeholder text: "현재 순간 준비 중", "남겨진 순간을 불러오고 있어요", "순간이 열리면 이어진 흐름은 따로 불러올게요." |
| initial markup | CONFIRMED_CURRENT_SOURCE — full shell with placeholder copy and `detail-media-loading` in video area. |
| loading visual | CONFIRMED_CURRENT_SOURCE — `detail-media-loading` div with hourglass icon + "대표 장면을 준비하고 있어요" text. |
| loading copy | CONFIRMED_CURRENT_SOURCE — "대표 장면을 준비하고 있어요" (in HTML), "남겨진 순간을 불러오고 있어요" (hero title), "순간이 열리면 이어진 흐름은 따로 불러올게요." (hero desc). |
| runtime/data dependency | CONFIRMED_CURRENT_SOURCE — `window.apiClient.getMemory()`, `window.apiClient.getTree()`, `window.apiClient.getMemoriesByTree()` |
| state owner file | CONFIRMED_CURRENT_SOURCE — `js/detail/detail-loader.js`, `js/detail/detail-render.js`, `js/detail/detail-loading-error-boundary.js` |
| state owner function | CONFIRMED_CURRENT_SOURCE — `loadCurrentDetail()`, `renderMemoryBase()`, `renderMissingMemoryState()` |
| entry trigger | CONFIRMED_CURRENT_SOURCE — `DOMContentLoaded` → `detail.js` → `loadCurrentDetail()` |
| ready transition | CONFIRMED_CURRENT_SOURCE — `renderMemoryBase()` populates all fields. |
| partial-ready behavior | CONFIRMED_CURRENT_SOURCE — memory renders immediately (from cache or API), tree + connected moments load in background. Staged rendering: memory base → tree context → connected fragments. |
| empty behavior | CONFIRMED_CURRENT_SOURCE — if memory not found: `renderMissingMemoryState()` with fallback UI (icon, title, desc, two CTA buttons). |
| degraded behavior | CONFIRMED_CURRENT_SOURCE — multiple degraded reasons: `missing-tree-id`, `context-loading`, `tree-and-memories-load-failed`, `memories-load-failed`, `tree-load-partial`. Each has specific warm copy. |
| error behavior | CONFIRMED_CURRENT_SOURCE — missing memory state has proper fallback with navigation CTA. Tree/memories load failures degrade gracefully with warm copy. |
| retry behavior | UNKNOWN — no retry button for detail page errors. |
| long-wait behavior | UNKNOWN — no long-wait message or timeout. |
| ARIA/live-region behavior | CONFIRMED_CURRENT_SOURCE — `detail-media-loading` has `role="status"` and `aria-live="polite"`. |
| reduced-motion behavior | INFERRED — page-transitions respect reduced motion. |
| layout-stability strategy | CONFIRMED_CURRENT_SOURCE — placeholder text has same structure as real content. `detail-media-loading` has min-height. |
| privacy boundary | CONFIRMED_CURRENT_SOURCE — memory ID in URL. |
| historical reference | CONFIRMED_CURRENT_SOURCE — #646 detail loading work is documented as completed. Detail page has `detail-loader.js` + `detail-loading-error-boundary.js` with `#646` cache-bust query param on CSS/JS. |
| current disposition | CONFIRMED_CURRENT_SOURCE — best-documented loading pattern after My Trees. Has staged loading, degraded states with warm copy, and ARIA. Missing retry. |
| candidate shared primitive | CONFIRMED_CURRENT_SOURCE — staged loading pattern (memory first, tree/memories in background), degraded reason taxonomy, warm degraded copy. |
| implementation risk | Low — isolated to detail page. |

### 2.18 Detail media

| Field | Finding |
|---|---|
| page | Detail (`pages/detail.html`) |
| region | `#videoMain` |
| stable shell before data | CONFIRMED_CURRENT_SOURCE — `detail-media-loading` div with hourglass icon + "대표 장면을 준비하고 있어요". |
| initial markup | CONFIRMED_CURRENT_SOURCE — loading div is in initial HTML. |
| loading visual | CONFIRMED_CURRENT_SOURCE — `detail-media-loading` has gradient background, hourglass icon, and loading text. |
| loading copy | CONFIRMED_CURRENT_SOURCE — "대표 장면을 준비하고 있어요" (hardcoded in HTML, not i18n). |
| runtime/data dependency | CONFIRMED_CURRENT_SOURCE — memory's video URL (sourceUrl/representativeThumbnail). |
| state owner file | CONFIRMED_CURRENT_SOURCE — `js/detail/detail-render.js`, `js/detail/detail-video.js` |
| state owner function | CONFIRMED_CURRENT_SOURCE — `renderMemoryBase()` → `buildVideoMainMarkup()` |
| entry trigger | CONFIRMED_CURRENT_SOURCE — memory loaded → `renderMemoryBase()` |
| ready transition | CONFIRMED_CURRENT_SOURCE — `buildVideoMainMarkup()` replaces loading div with video embed or image. |
| partial-ready behavior | UNKNOWN — may show loading until video embed is ready. |
| empty behavior | CONFIRMED_CURRENT_SOURCE — if memory has no video, `buildVideoMainMarkup()` provides fallback. |
| degraded behavior | INFERRED — missing thumbnail fallback. |
| error behavior | UNKNOWN — video embed error handling not observed. |
| retry behavior | UNKNOWN — none. |
| long-wait behavior | UNKNOWN — none. |
| ARIA/live-region behavior | CONFIRMED_CURRENT_SOURCE — loading state uses `role="status"` and `aria-live="polite"`. |
| reduced-motion behavior | UNKNOWN — media loading animation may continue under reduced motion. |
| layout-stability strategy | CONFIRMED_CURRENT_SOURCE — `.video-main` has fixed aspect-ratio (16/9). |
| privacy boundary | CONFIRMED_CURRENT_SOURCE — public memory data only. |
| historical reference | CONFIRMED_CURRENT_SOURCE — #646 loading work. |
| current disposition | CONFIRMED_CURRENT_SOURCE — functional loading state with proper ARIA. |
| candidate shared primitive | INFERRED — video loading pattern. |
| implementation risk | Low. |

### 2.19 Detail tree context

| Field | Finding |
|---|---|
| page | Detail (`pages/detail.html`) |
| region | `#treeContext` |
| stable shell before data | CONFIRMED_CURRENT_SOURCE — empty `#treeContext` div. |
| initial markup | CONFIRMED_CURRENT_SOURCE — empty div, no placeholder. |
| loading visual | CONFIRMED_CURRENT_SOURCE — `detail-context-state-loading` with hourglass icon + "트리 흐름 확인 중" + description. Rendered by `renderTreeContext()` when `degradedReason === 'context-loading'`. |
| loading copy | CONFIRMED_CURRENT_SOURCE — `tree_context_loading_kicker` (ko: 트리 흐름 확인 중), `tree_context_loading_desc` (ko: 현재 순간은 먼저 열어두었어요. 이어진 트리 흐름을 잠시 불러오고 있어요.) |
| runtime/data dependency | CONFIRMED_CURRENT_SOURCE — `window.apiClient.getTree()`, `window.apiClient.getMemoriesByTree()` |
| state owner file | CONFIRMED_CURRENT_SOURCE — `js/detail/detail-render.js` |
| state owner function | CONFIRMED_CURRENT_SOURCE — `renderTreeContext()` |
| entry trigger | CONFIRMED_CURRENT_SOURCE — `loadCurrentDetail()` → staged rendering (first staging, then after tree/memories load). |
| ready transition | CONFIRMED_CURRENT_SOURCE — `renderTreeContext()` updates the tree context block with tree title, moment count, and context message. |
| partial-ready behavior | CONFIRMED_CURRENT_SOURCE — staged rendering: first rendering shows `context-loading` degraded state before tree/memories load. |
| empty behavior | CONFIRMED_CURRENT_SOURCE — if no tree context or treeMomentCount <= 0, context is hidden. |
| degraded behavior | CONFIRMED_CURRENT_SOURCE — four degraded types with warm copy: `missing-tree-id`, `tree-and-memories-load-failed`, `tree-load-partial`, `memories-load-failed`. |
| error behavior | CONFIRMED_CURRENT_SOURCE — load failures produce warm degraded HTML, not a disruptive error panel. |
| retry behavior | UNKNOWN — no retry for tree context. |
| long-wait behavior | UNKNOWN — none. |
| ARIA/live-region behavior | UNKNOWN — tree context uses styled divs, not ARIA regions. |
| reduced-motion behavior | INFERRED — global reduced-motion. |
| layout-stability strategy | INFERRED — content replaces inline; context block has layout space. |
| privacy boundary | CONFIRMED_CURRENT_SOURCE — tree ID used internally. Moment count exposed. |
| historical reference | CONFIRMED_CURRENT_SOURCE — #646 detail loading work. |
| current disposition | CONFIRMED_CURRENT_SOURCE — best-in-class degraded state pattern with warm, varied copy for each failure type. |
| candidate shared primitive | CONFIRMED_CURRENT_SOURCE — degraded reason taxonomy, warm degraded copy pattern. |
| implementation risk | Low. |

### 2.20 Detail connected moments

| Field | Finding |
|---|---|
| page | Detail (`pages/detail.html`) |
| region | `.connected-section` |
| stable shell before data | CONFIRMED_CURRENT_SOURCE — connected section has heading: "이어진 흐름 준비 중" + "현재 순간이 열리면 연결된 기억을 이어서 불러올게요." |
| initial markup | CONFIRMED_CURRENT_SOURCE — heading with placeholder, empty grid. |
| loading visual | CONFIRMED_CURRENT_SOURCE — `connected-loading-state` class exists in CSS but loading state rendering is not directly observed in initial HTML. |
| loading copy | CONFIRMED_CURRENT_SOURCE — "이어진 흐름 준비 중", "현재 순간이 열리면 연결된 기억을 이어서 불러올게요." |
| runtime/data dependency | CONFIRMED_CURRENT_SOURCE — memories API |
| state owner file | CONFIRMED_CURRENT_SOURCE — `js/detail/detail-connected.js` (inferred), `js/detail/detail-loader.js` |
| state owner function | CONFIRMED_CURRENT_SOURCE — `renderConnectedFragments()` |
| entry trigger | CONFIRMED_CURRENT_SOURCE — memory loaded → connected moments load |
| ready transition | INFERRED — fragments grid populated. |
| partial-ready behavior | INFERRED — connected moments load after tree context. |
| empty behavior | CONFIRMED_CURRENT_SOURCE — if no connected moments, section stays in placeholder state. |
| degraded behavior | INFERRED — degraded types propagate to connected section. |
| error behavior | INFERRED — errors produce degraded copy. |
| retry behavior | UNKNOWN — none. |
| long-wait behavior | UNKNOWN — none. |
| ARIA/live-region behavior | UNKNOWN — not observed. |
| reduced-motion behavior | INFERRED — global reduced-motion. |
| layout-stability strategy | INFERRED — connected section has layout space. |
| privacy boundary | CONFIRMED_CURRENT_SOURCE — public data. |
| historical reference | CONFIRMED_CURRENT_SOURCE — #646 detail loading work. |
| current disposition | CONFIRMED_CURRENT_SOURCE — placeholder with loading-state CSS. Loading copy exists. |
| candidate shared primitive | INFERRED — connected loading pattern. |
| implementation risk | Low. |

### 2.21 Public viewer shell

| Field | Finding |
|---|---|
| page | Viewer (`pages/tree.html`) |
| route | `/pages/tree?treeId=xxx` |
| region | `#viewerTreeShell` |
| stable shell before data | CONFIRMED_CURRENT_SOURCE — topbar (back link, public badge), viewer shell with three state containers. |
| initial markup | CONFIRMED_CURRENT_SOURCE — all state containers are in HTML with `hidden` attribute. Loading state: spinner icon + "러브트리를 불러오는 중이에요". Empty state: icon + "아직 공개된 순간이 없어요". Error state: icon + "러브트리를 불러오지 못했어요. 다시 시도해 주세요." + retry button. |
| loading visual | CONFIRMED_CURRENT_SOURCE — spinner icon (`progress_activity` Material Symbol) + loading text. |
| loading copy | CONFIRMED_CURRENT_SOURCE — `viewer.loading` (ko: 러브트리를 불러오는 중이에요) — in HTML and i18n. |
| runtime/data dependency | CONFIRMED_CURRENT_SOURCE — `window.apiClient.getCommunityMemories()` |
| state owner file | CONFIRMED_CURRENT_SOURCE — `js/viewer/tree-viewer.js`, `js/viewer/viewer-init-flow.js`, `js/viewer/viewer-render-state.js` |
| state owner function | CONFIRMED_CURRENT_SOURCE — `startViewer()` → `initViewer()`. `RS.showLoading()`, `RS.renderEmpty()`, `RS.renderError()`, `RS.renderDeterministicFallback()`. |
| entry trigger | CONFIRMED_CURRENT_SOURCE — `DOMContentLoaded` → `setupRetry()` → `initViewer()` |
| ready transition | CONFIRMED_CURRENT_SOURCE — `RS.show(SEL.treeContainer)` → `ShellRender.renderShell()` populates tree. |
| partial-ready behavior | CONFIRMED_CURRENT_SOURCE — `renderDeterministicFallback()` renders shell with fallback data when memories are empty/null but tree ID is confirmed. |
| empty behavior | CONFIRMED_CURRENT_SOURCE — `renderEmpty()` shows "아직 공개된 순간이 없어요". |
| degraded behavior | CONFIRMED_CURRENT_SOURCE — deterministic fallback renders shell with hardcoded defaults when memories empty. |
| error behavior | CONFIRMED_CURRENT_SOURCE — `renderError()` shows error + retry button. |
| retry behavior | CONFIRMED_CURRENT_SOURCE — `#viewerRetryBtn` calls `initViewer()` again. Binds via `RetrySetup`. |
| long-wait behavior | UNKNOWN — no long-wait message or timeout. |
| ARIA/live-region behavior | UNKNOWN — state containers use `hidden` attribute. No `aria-live` on state containers. |
| reduced-motion behavior | UNKNOWN — spinner animation may continue under reduced motion (inferred: `@keyframes spin` has no reduction guard). |
| layout-stability strategy | CONFIRMED_CURRENT_SOURCE — state containers have `hidden` attribute; only one is visible at a time. Viewer shell has layout dimensions. |
| privacy boundary | CONFIRMED_CURRENT_SOURCE — tree ID in URL. View events sent with anonymous actor key. |
| historical reference | HISTORY_ONLY — #953 modules, #3060 deterministic fallback. |
| current disposition | CONFIRMED_CURRENT_SOURCE — well-structured viewer with loading, empty, error, retry, and deterministic fallback. |
| candidate shared primitive | CONFIRMED_CURRENT_SOURCE — viewer state container pattern (loading/empty/error with retry). |
| implementation risk | Low. |

### 2.22 Public viewer tree and memory count

| Field | Finding |
|---|---|
| page | Viewer (`pages/tree.html`) |
| region | `#viewerTreeContainer` → tree title, meta (memory count) |
| stable shell before data | CONFIRMED_CURRENT_SOURCE — `#viewerTreeContainer` starts hidden. |
| initial markup | CONFIRMED_CURRENT_SOURCE — empty `#viewerTreeTitle` and `#viewerTreeMeta`. |
| loading visual | CONFIRMED_CURRENT_SOURCE — none separate from shell loading state. |
| loading copy | CONFIRMED_CURRENT_SOURCE — covered by shell loading state. |
| runtime/data dependency | CONFIRMED_CURRENT_SOURCE — memories data |
| state owner file | CONFIRMED_CURRENT_SOURCE — `js/viewer/tree-viewer.js`, `js/viewer/public-tree-viewer.js` |
| state owner function | CONFIRMED_CURRENT_SOURCE — `renderTree()`, `setContent(SEL.treeTitle, ...)`, `setContent(SEL.treeMeta, ...)` |
| entry trigger | CONFIRMED_CURRENT_SOURCE — memories loaded → `renderTree()` |
| ready transition | CONFIRMED_CURRENT_SOURCE — title and meta populated. |
| partial-ready behavior | INFERRED — title may be inferred from first memory. |
| empty behavior | CONFIRMED_CURRENT_SOURCE — viewer empty state. |
| degraded behavior | CONFIRMED_CURRENT_SOURCE — deterministic fallback with hardcoded title. |
| error behavior | CONFIRMED_CURRENT_SOURCE — viewer error state. |
| retry behavior | CONFIRMED_CURRENT_SOURCE — viewer retry button. |
| long-wait behavior | UNKNOWN — none. |
| ARIA/live-region behavior | UNKNOWN — title is plain heading. |
| reduced-motion behavior | INFERRED — global reduced-motion. |
| layout-stability strategy | CONFIRMED_CURRENT_SOURCE — container starts hidden; no flash of empty content. |
| privacy boundary | CONFIRMED_CURRENT_SOURCE — tree title from public data. |
| historical reference | UNKNOWN — earlier viewer work. |
| current disposition | CONFIRMED_CURRENT_SOURCE — functional but minimal. |
| candidate shared primitive | INFERRED — tree title/meta loading pattern. |
| implementation risk | Low. |

---

## 3. Twenty explicit answers

### 3.1 Which states are actual runtime states?

CONFIRMED_CURRENT_SOURCE:
- My Trees: `LOADING`, `LOADED`, `EMPTY`, `ERROR` — full state machine with `setState()`
- Viewer (tree.html): loading, empty, error, tree-container-visible — `showLoading()`, `renderEmpty()`, `renderError()`, `renderDeterministicFallback()`
- Detail: loading, memory-loaded (partial), tree/memories-loaded, missing-memory, degraded (4 types) — staged loading with degraded taxonomy
- Browse: loading (skeleton), cache-loaded, api-loaded, empty (no-trees), empty (search), error — stale-while-revalidate pattern

INFERRED:
- Editor: loading (shell start), tree-loaded, memories-loaded — no explicit state enum

### 3.2 Which are decorative skeleton or shimmer only?

CONFIRMED_CURRENT_SOURCE:
- Browse card grid: skeleton cards with shimmer animation (`searchSkeletonPulse`). These are `aria-hidden="true"` and are purely decorative loading indicators.
- My Trees card grid: same skeleton cards, same decorative purpose.
- Browse preview sidebar: `preview-state-loading` is a CSS class (visual state), not a decorative shimmer per se.
- Editor per-node images: `node-skeleton` div shown during image load. No shimmer animation; static placeholder.

### 3.3 Which page shows default or fallback content before real data?

CONFIRMED_CURRENT_SOURCE:
- **Detail page**: placeholder text throughout ("현재 순간 준비 중", "남겨진 순간을 불러오고 있어요") before memory data arrives.
- **Browse preview hub**: placeholder text ("러브트리를 고르면 이어진 순간의 흐름이 여기에 열려요") before selection.
- **My Trees preview hub**: placeholder text ("왼쪽에서 내 러브트리를 고르면...") before selection.
- **Home**: no loading needed; all content is static.
- **Editor**: detail panel shows placeholder before selection ("아직 선택한 순간이 없어요").

INFERRED: Editor sidebar shows empty summary text before tree data.

### 3.4 Which primary content waits unnecessarily for secondary data?

CONFIRMED_CURRENT_SOURCE:
- **Detail page**: primary content (memory) loads first via `loadCurrentDetail()` — tree and connected moments load in background. This is correct progressive rendering.
- **Browse**: primary content (tree cards) loads first; preview hub is lazy-loaded on selection. This is correct.
- **Editor**: tree identity loads first; memories load second. This is correct ordering.
- **My Trees**: tree list loads; preview hub is lazy on card click. Correct.

INFERRED: No unnecessary waiting observed. The architecture generally loads primary before secondary.

### 3.5 Which pages already reveal ready regions progressively?

CONFIRMED_CURRENT_SOURCE:
- **Detail**: memory base first → tree context → connected moments. Staged rendering with degraded copy between stages. Best progressive reveal in the app.
- **Browse**: skeleton → cache (stale) → API (fresh). Preview hub hydrates on demand.
- **Viewer (tree.html)**: loading → tree shell + memories.
- **My Trees**: loading → tree cards. Preview hub on demand.

### 3.6 Which skeletons preserve real layout?

CONFIRMED_CURRENT_SOURCE:
- **Browse skeleton cards**: same `.tree-card` structure, same `.tree-card-media` + `.tree-card-body` grid layout, same grid in `#resultsList`. Content dimensions mirror real cards.
- **My Trees skeleton cards**: same structure, same grid in `.trees-skeleton-grid` as `.trees-grid`.

### 3.7 Which skeletons expose implementation details without helping the user?

CONFIRMED_CURRENT_SOURCE:
- Browse and My Trees skeleton cards expose no private information. They are `aria-hidden="true"`.
- Editor `node-skeleton` is internal to node rendering and not visible without the node being in the canvas.

No harmful skeleton exposure found.

### 3.8 Which loading states can remain indefinitely?

CONFIRMED_CURRENT_SOURCE:
- **Browse**: if API never responds and no cache available, loading skeleton remains. No timeout observed.
- **My Trees**: no timeout observed for tree list loading.
- **Detail**: staged loading shows degraded copy, but if API never responds and no cache, the `context-loading` degraded state persists.
- **Viewer (tree.html)**: loading state persists until API responds. No timeout observed.
- **Editor**: no timeout for tree/memory loading.

INFERRED: All pages lack timeout/abort mechanisms for loading states.

### 3.9 Which errors can be mistaken for loading or empty?

CONFIRMED_CURRENT_SOURCE:
- **Browse**: error state renders into `#resultsList` similarly to empty state. Both are card-renderer output.
- **Detail**: degraded states intentionally look like warm messages rather than errors. A user might not distinguish between "context-loading" (temporary) and "tree-and-memories-load-failed" (permanent).
- **My Trees**: error state is visually distinct from loading and empty (separate `#state-*` divs with different styling). Low confusion risk.
- **Viewer**: error state is distinct from loading/empty (separate containers with different copy). Low confusion risk.

### 3.10 Which pages have no retry state?

CONFIRMED_CURRENT_SOURCE:
- **Home**: not needed (no data dependency).
- **Browse**: retry button may exist (INFERRED from i18n key), but no retry mechanism observed.
- **Detail**: no retry button.
- **Editor**: no retry button for tree load failure.

CONFIRMED_CURRENT_SOURCE with retry:
- **My Trees**: retry button `#retryLoadBtn`.
- **Viewer (tree.html)**: retry button `#viewerRetryBtn`.

### 3.11 Which pages have no long-wait state?

CONFIRMED_CURRENT_SOURCE: **All pages** lack a long-wait state. None define a timeout threshold or long-wait message. Users see either loading indicators (skeleton/spinner) indefinitely, or degraded/error copy after failure.

### 3.12 Where is loading copy stored?

| Source | Location | Example (ko) |
|---|---|---|
| HTML (initial markup) | `pages/search.html`, `pages/my-trees.html`, `pages/detail.html`, `pages/tree.html` | "대표 장면을 준비하고 있어요", "러브트리를 불러오는 중이에요" |
| JS literal | `js/my-trees/my-trees-page.js` | "러브트리 목록을 불러오는 중..." |
| i18n | `js/i18n/i18n-search.js`, `js/i18n/i18n-viewer.js` | `search.previewLoadingLead`, `viewer.loading` |
| CSS pseudo-content | Not observed | N/A |

### 3.13 Which regions use `aria-live`, `aria-busy`, `role=status`, or no accessible status?

CONFIRMED_CURRENT_SOURCE:
- **`aria-live="polite"`**: Detail page `#detailHeroKicker`, `detail-media-loading`. (Home `growth-stage-caption` also has `aria-live="polite"` but this announces decorative stage progression, not API/media loading — excluded from actual loading count.)
- **`role="status"`**: Detail page `detail-media-loading`.
- **`aria-busy`**: Not observed on any region.
- **No accessible status**: All skeleton containers (Browse/My Trees), state containers (My Trees `#state-loading`, Viewer `#viewerLoadingState`), preview loading states (Browse/My Trees preview hub).

### 3.14 Which motion continues under reduced-motion preferences?

CONFIRMED_CURRENT_SOURCE:
- **Spinner animation** (`@keyframes spin`): used by My Trees loading spinner and Viewer loading spinner. Neither has a `prefers-reduced-motion` guard. These continue under reduced motion.
- **`page-transitions.js`**: correctly checks `prefersReducedMotion()` and marks all nodes visible immediately without animation.

CONFIRMED_CURRENT_SOURCE with reduced-motion guards:
- **Browse skeleton pulse**: `searchSkeletonPulse` stops.
- **Home hero cycle**: static first-artist completed network displayed.
- **Home headline swap**: only set 1 shown.
- **Global transition polish**: `transition: none` for all navigational elements.

### 3.15 Which #646 behavior must remain unchanged?

CONFIRMED_CURRENT_SOURCE (#646 completed — Detail loading):
- Memory-first staged loading: memory base renders before tree and connected moments.
- Degraded reason taxonomy: `missing-tree-id`, `context-loading`, `tree-and-memories-load-failed`, `memories-load-failed`, `tree-load-partial`.
- Warm degraded copy: each degraded reason has specific, empathetic Korean/English copy.
- Cache-mediated loading: memory cache → API → fallback.
- ARIA on media loading: `role="status"` and `aria-live="polite"`.
- Missing memory fallback: `renderMissingMemoryState()` with navigation CTAs.
- These must remain unchanged because later loading contracts depend on them and #3688 (loading parent) explicitly says "Keep OPEN" — meaning #646's detail loading pattern is the established reference, not a candidate for immediate change.

### 3.16 Which #691 findings are historical rather than current?

HISTORICAL_ONLY (#691 completed — Browse latency measurement):
- `docs/engineering/BROWSE_LOADING_RUNTIME_EVIDENCE.md` defines evidence requirements but does not reflect current Browse implementation details.
- Specific latency measurements from #691 are not present in current source.
- The evidence checklist format is historical; current Browse uses different patterns (stale-while-revalidate via cache, skeleton-first rendering).
- #691's prefetch considerations are not observable in current `main` source.

### 3.17 Which #624 behavior is already complete?

HISTORICAL_ONLY (#624 completed — Editor title-loading):
- Editor tree identity/title loading from URL parameters.
- Title rendering in sidebar after tree data arrives.
- Fallback to "새 러브트리" when no title provided.
- These behaviors are present in current editor source but cannot be confirmed as originating from #624 specifically.

### 3.18 Which Home source overlaps with PR #3640?

CONFIRMED_CURRENT_SOURCE (from remote PR metadata): PR #3640 (`ux(home): add mixed-artist center-spotlight showcase`) is currently **OPEN Draft** with head SHA `fc84124a9a047cb2e80667e06cd46f7a8626df15`.

Exact changed files in PR #3640 (from remote PR API):
- `css/index/visual/animations.css`
- `css/index/visual/growth-stage.css`
- `css/index/visual/responsive.css`
- `index.html`
- `js/i18n/i18n-home-v3.js`
- `js/index-inline-init.js`
- `tests/contracts/home-growth-stage-visual-contract.test.cjs`
- `tests/contracts/home-mixed-artist-spotlight-3625-contract.test.cjs`
- `tests/contracts/index-home-hero-real-tree-contract.test.cjs`
- `tests/contracts/index-visual-css-contracts.test.cjs`
- `tests/test-layer-classification.json`

Overlap with Home loading source:
- `index.html` — hero section, card structure
- `js/index-inline-init.js` — growth cycle, copy loop, modal player, thumbnail loading
- `js/i18n/i18n-home-v3.js` — hero i18n keys
- `css/index/visual/animations.css` — growth-stage animations
- `css/index/visual/growth-stage.css` — card layout and transitions
- `css/index/visual/responsive.css` — mobile hero behavior

PR #3640 overlap danger: Modifying Home loading states while PR #3640 is open would cause merge conflicts or behavioral regressions. Home should remain deferred until PR #3640 is resolved.

### 3.19 Which primitives can be visual-only?

CONFIRMED_CURRENT_SOURCE — the following loading primitives are purely visual (no runtime logic):
- Skeleton card shimmer animation (CSS `@keyframes`)
- Skeleton card structure (HTML + CSS grid)
- Spinner animation (CSS `@keyframes spin`)
- `preview-state-empty`/`preview-state-loading` CSS classes (visual styling only)
- State section display classes (`state-visible`, `state-hidden`, `state-visible-block`)

These can be extracted as shared CSS primitives without affecting runtime behavior.

### 3.20 Which state transitions must remain page-owned runtime logic?

CONFIRMED_CURRENT_SOURCE — these state transitions are inherently page-specific and must remain owned by each page's runtime:
- **My Trees** `setState()`: transitions depend on auth state, tree ownership, create-tree flow.
- **Browse** `loadPublicTrees()`: stale-while-revalidate, URL state, scroll continuation.
- **Detail** `loadCurrentDetail()`: staged loading, memory → tree → connected.
- **Editor** `runEditorInitialLoadFlow()`: tree identity → memories → canvas render.
- **Viewer** `initViewer()`: tree ID → memories → shell render.
- **Home** `initHeroGrowthCycle()`: JS state machine, timer, modal player.

These cannot be extracted to a shared loading primitive without breaking page-specific behavior.

---

## 4. Summary of findings

| Finding | Count |
|---|---|
| Pages audited | 7 (Home, Browse, My Trees, Editor, Detail, Viewer/tree.html, Public Viewer/view.html) |
| Regions audited | 22 |
| Confirmed current-source owners | 21 (all regions confirmed in current source) |
| Historical-only references | 6 (#646, #691, #624 detail; #901, #907, #2825 historical) |
| Pages with retry | 2 (My Trees, Viewer/tree.html) |
| Pages with long-wait state | 0 |
| Pages with timeout mechanism | 0 |
| Pages using `aria-live` for actual API/media loading | **1** (Detail: `detail-media-loading` only — Home `growth-stage-caption` is decorative stage progression, not loading) |
| Pages with `role="status"` | 1 (Detail: `detail-media-loading`) |
| Pages with `aria-busy` | 0 |
| Pages with reduced-motion for all motion | 0 (spinners and some animations lack guards) |
| Best-documented loading | Detail (#646 pattern) |
| Most complete state machine | My Trees (LOADING, LOADED, EMPTY, ERROR with retry) |
| Most incomplete | Editor (no explicit loading, empty, error, or retry states visible in source) |
