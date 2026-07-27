# Canonical Staged-Loading Decision

> **Parent #3688** · **Child #3689** · **Ref #3672 — Keep OPEN**
> **Status:** Normative decision document
> **Class:** Generic Tier 2 / U2 source-only (this document is source-only; implementation children have their own classifications per §9.4)
> **Audit baseline:** `origin/main` `36bdb3a53d3b716a0e7555ffc51d2043ac701074`
> **Browser / screenshot / Production:** not used

---

## 1. Canonical state vocabulary

### 1.1 Approved states

| State | Entry condition | Exit condition | Visual treatment | Copy treatment | Enabled user actions | ARIA behavior | Retry availability | Coexists with READY siblings? |
|---|---|---|---|---|---|---|---|---|
| **INITIAL** | Page navigated to; no data request started | First data request begins | No visible indicator; page shell may show static placeholder content | Static placeholder or shell copy that does not claim a loading state | None blocking; user may navigate away | Container not announced as loading | Not applicable | Yes — shell content ready before data |
| **PENDING** | Data request started; no response yet | First response received (success or failure) | Optional: no indicator for fast responses. Skeleton or branded background for slower data. | Silent (no copy) | None blocking; user may navigate away. Interactive shell controls remain operable. | No announcement. If indicator is visual-only, `aria-hidden="true"`. | Not applicable | Yes — other READY sibling regions may be fully interactive |
| **LOADING** | Timer threshold exceeded (see §3) while PENDING | Response received | Skeleton matching real layout, OR compact spinner + inline text. Max one prominent indicator per viewport. | Short inline copy: "로딩 중" / "Loading" or similar. Not a full sentence. | All already-READY regions remain interactive. PENDING/LOADING regions are not actionable. | `aria-busy="true"` on region container. `role="status"` on the loading indicator. Polite announcements only. | No retry needed during loading | Yes — READY siblings coexist and remain interactive |
| **PARTIAL** | Primary content usable; secondary content still LOADING or PENDING | Secondary content READY or explicitly failed | Primary content normally rendered. Secondary content shows per-region PENDING/LOADING indicator. | Primary content copy is full. Secondary region shows its own PENDING/LOADING copy. | All primary content actions enabled. Secondary region actions disabled. | `aria-busy` only on secondary region | Secondary region may have retry | Yes — by definition PARTIAL means at least one READY sibling exists |
| **READY** | Required data received and rendered | User navigates away or data becomes stale | Full content rendered. No loading indicator visible. | Full content copy. | All page-appropriate actions enabled. | Normal document semantics. No loading-related ARIA. | Not needed | Yes |
| **EMPTY** | Data request succeeded; result set is empty | User takes action or data changes | Centered, warm-toned empty state panel with icon + heading + short description + single CTA | Heading is emotion-action-oriented, not system-status. "데이터 없음" / "0개" prohibited. | Primary: single CTA (create, browse, or retry). Secondary: none. | `role="status"` on the empty state panel. Polite announcement. | Not applicable for empty-from-API / applicable for empty-after-filter | Yes — empty region coexists with READY siblings (e.g., empty search + READY shell) |
| **DEGRADED** | Secondary data permanently unavailable; primary content still usable | User navigates away or data changes | Primary content normally rendered. Affected secondary region shows warm-toned degraded-message panel (not a red error box). | Warm, empathetic copy explaining what is unavailable and what remains usable. No technical details. | All primary actions enabled. Secondary actions disabled. | `role="status"` on degraded region. | No retry for permanent unavailability / Yes for temporary degradation | Yes — degraded is by definition a state where primary content is READY |
| **ERROR** | Data request failed; primary content cannot be rendered | User retries or navigates away | Centered error panel with icon + heading + body + retry button. Could also show warm error-recovery copy when primary is unusable. | Short heading: "불러오지 못했어요" / "Could not load". Short body with user-directed action. Technical details prohibited. | Retry button (primary). Navigation to fallback page (secondary). | `role="alert"` on error panel (only when primary content fails or user-triggered action produces the error) — see §7.2. | Yes — single retry button that restarts the failed request | No — ERROR replaces the affected content region. READY siblings remain visible but the errored region cannot be READY. |
| **RETRYING** | User clicked retry OR automatic retry triggered | Result received (success or failure) | Same as LOADING (skeleton or spinner) | "다시 시도하는 중" / "Retrying..." | Retry button disabled and shows loading state. | Same as LOADING | Retry button disabled during retry | Yes — READY siblings coexist |

### 1.2 States explicitly rejected

| State | Reason for rejection |
|---|---|
| `STALE` | Indistinguishable from READY in practice. Stale data is still data; if freshness matters, refresh is a separate action, not a distinct UI state. |
| `LOADING_MORE` | Subsumed by `LOADING` on the incremental-load region. No separate vocabulary needed. |
| `CACHED` | Implementation detail, not a user-facing state. Cache hit results in READY with shorter latency. |
| `OFFLINE` | Not needed as separate state; network failure produces `ERROR`. Persistent offline can be handled by existing error + retry patterns. |
| `TIMEOUT` | Subsumed by `ERROR` with specific degraded copy. No separate state needed. |

---

## 2. Page and region ownership

### 2.1 Definitions

| Concept | Definition |
|---|---|
| Page-level state owner | The script or module that determines the page's overall state (e.g., `LOADING`, `ERROR`, `READY`) |
| Region-level state owner | The module responsible for a specific region's loading lifecycle |
| Primary content | The content the user came to see; must render before secondary content can block the page |
| Secondary content | Supporting content that must not keep the page in LOADING after primary content is usable |

### 2.2 Page-specific ownership

| Page | Page-level state owner | Primary content | Secondary content |
|---|---|---|---|
| **Home** | `js/index-inline-init.js` | Static HTML visible immediately | Thumbnail images (lazy) |
| **Browse** | `js/search.js` (orchestrator) | Public tree card grid | Preview hub, incremental loading |
| **My Trees** | `js/my-trees.js` → `myTreesPage.setState()` | Owner tree card grid | Preview hub |
| **Editor** | `js/editor/editor-initial-load-flow.js` | Tree identity/title → memories | Detail panel, flow summary |
| **Detail** | `js/detail/detail-loader.js` | Current memory | Tree context, connected moments |
| **Viewer (tree.html)** | `js/viewer/tree-viewer.js` | Tree visualization + memory count | Detail panel |

### 2.3 Region-level ownership

| Page | Region | Owner module | Owner function |
|---|---|---|---|
| Browse | Card grid | `js/search/search-data.js`, `js/search/search-card-renderer.js` | `loadPublicTrees()`, `renderLoading()` |
| Browse | Preview hub | `js/search/search-data.js` | `hydrateSelectedTreePreview()` |
| Browse | Incremental scroll | `js/search/search-scroll-load.js` | `ensureScrollLoadSentinel()` |
| My Trees | Card grid | `js/my-trees/my-trees-data.js`, `js/my-trees/my-trees-render.js` | `loadTrees()`, `renderTrees()` |
| My Trees | Preview hub | `js/my-trees/my-trees-preview-hub.js` | `onCardClick()` |
| Detail | Current moment | `js/detail/detail-render.js` | `renderMemoryBase()` |
| Detail | Tree context | `js/detail/detail-render.js` | `renderTreeContext()` |
| Detail | Connected moments | `js/detail/detail-render.js` | `renderConnectedFragments()` |
| Editor | Tree identity | `js/editor/editor-data-loader.js` | `loadInitialEditorTree()` |
| Editor | Memories | `js/editor/editor-data-loader.js` | `loadEditorMemories()` |
| Viewer | Shell + tree | `js/viewer/viewer-init-flow.js` | `initViewer()` |
| Viewer | Tree details | `js/viewer/tree-viewer.js` | `renderTree()` |

### 2.4 Rule: Secondary region independence

> A secondary region must not keep the entire page in a loading state after primary content is usable.

**Implementation:** Primary content renders as soon as its data arrives. Secondary regions manage their own LOADING/ERROR/DEGRADED states independently. The page-level state becomes PARTIAL (or READY with degraded siblings) once primary content is READY.

---

## 3. Timing policy

### 3.1 Exact thresholds

| Threshold | Value | Rationale |
|---|---|---|
| `INDICATOR_DISPLAY_DELAY` | **300–500ms** (bounded range; page child chooses exact value; default 500ms) | Minimal delay before showing the skeleton/spinner. Responses faster than this threshold skip the indicator entirely (prevents flash). |
| `EXPLICIT_LOADING_COPY_THRESHOLD` | **1500–2000ms** (bounded range; page child chooses exact value) | After this threshold while still PENDING, the loading indicator must include inline copy explaining what is loading. Prevents silent loading during long waits. |
| `LONG_WAIT_THRESHOLD` | **8000ms** (default) | After this duration of LOADING, show a long-wait message acknowledging the delay and reassuring the user. The message may include a retry option. Not an abort signal. |
| `ERROR_ESCALATION_THRESHOLD` | **15000ms** (default UI escalation point) | UI escalates from LOADING to ERROR state with retry option. This is a UI presentation threshold — it does NOT mandate aborting the underlying network request. |

**`MINIMUM_INDICATOR_DURATION` is rejected.** There is no minimum display time for a loading indicator. If content becomes ready while an indicator is visible, replace the indicator with the ready content immediately. A non-blocking opacity transition (≤200ms) may occur, but the ready content must already be rendered in the DOM.

### 3.2 Timing principles

1. **Indicator appearance may be delayed**: The INDICATOR_DISPLAY_DELAY allows fast responses to skip the indicator entirely. This prevents flash.
2. **Ready content must never be delayed**: If content arrives before INDICATOR_DISPLAY_DELAY elapses, show it immediately — do not artificially hold the indicator.
3. **If content becomes ready after an indicator appeared, replace it immediately**: The ready content must be rendered in the DOM. A non-blocking opacity transition (≤200ms) may occur, but the content must already be in the DOM.
4. **Remain truthful**: Never show a fake progress bar or arbitrary percentage. Loading is either pending, in progress, or done.
5. **Avoid fake progress**: No `setInterval`-based progress simulation. Real download progress only (if available).
6. **Avoid arbitrary sleeps**: No `setTimeout` to delay content rendering. Thresholds are maximums, not minimums.
7. **Avoid delaying already ready content**: When PARTIAL state is reached, render primary content immediately without waiting for secondary data.
8. **UI escalation is not request abort**: The ERROR_ESCALATION_THRESHOLD transitions the UI to an error presentation. The actual network request abort/cancellation is a separate, page/operation-owned U3 decision. The UI may show an error while the request is still in-flight (e.g., for a retry-attempt).

### 3.3 PENDING → LOADING transition

Between 0ms and EXPLICIT_LOADING_COPY_THRESHOLD, the data is in PENDING state. The page may show:
- **0–INDICATOR_DISPLAY_DELAY**: No indicator (fast path, prevents flash)
- **INDICATOR_DISPLAY_DELAY – EXPLICIT_LOADING_COPY_THRESHOLD**: Skeleton or spinner without copy (PENDING with visual indicator)
- **EXPLICIT_LOADING_COPY_THRESHOLD+**: LOADING with copy + `aria-busy="true"`

---

## 4. Presentation policy

### 4.1 Indicator selection by context

| Context | Recommended treatment | Rationale |
|---|---|---|
| **No data dependency** (e.g., Home static shell/copy) | No indicator needed | Content is in initial HTML |
| **Shell before data** (e.g., Browse card grid, My Trees card grid) | Skeleton matching real layout | Preserves layout stability, gives visual coherence |
| **Media loading** (e.g., thumbnails, video embeds) | Poster or branded background + inline spinner. For user-triggered media (e.g., clicked video), a dedicated modal-region loading state with poster, loading status, and safe close/fallback. | Media dimensions are known (e.g., 16:9); poster prevents layout shift. User-triggered media needs its own contract because the user explicitly initiated the action. |
| **Preview hydration** (e.g., Browse/My Trees preview hub) | Compact spinner + inline loading text (icon + 1 line) | Preview is secondary content; should not dominate the page |
| **Incremental list loading** (e.g., Browse scroll) | Compact sentinel spinner + "Loading more..." text | Appended to list; should not shift existing content |
| **Tree/memory enumeration** (e.g., Editor, Detail) | Skeleton or placeholder with branded background | Tree data is primary; skeleton communicates structure |
| **Long wait** (EXPLICIT_LOADING_COPY_THRESHOLD exceeded) | Existing indicator + inline loading copy explaining what is loading | User needs to know what is taking time |
| **Very long wait** (LONG_WAIT_THRESHOLD exceeded) | Long-wait message with apology + retry option | User needs to know something is wrong and what they can do |
| **Degraded state** | Warm-toned message panel (not red/error styling) | Secondary content unavailable but primary is usable |
| **Error state** | Error panel with retry button (acceptable red/alert styling for primary content) | Primary content failed; user needs clear recovery action |

### 4.2 Prohibitions

1. **Multiple equally prominent indicators for one operation**: If the page is loading one thing, show exactly one primary indicator. Avoid showing a page-level spinner AND a region-level skeleton simultaneously for the same data dependency.
2. **Full-page blocking after usable content is ready**: Once primary content is READY, do not show a full-page spinner or overlay. Secondary content regions manage their own states independently.
3. **Indefinite content-looking skeleton**: A skeleton that looks like real content but never resolves must not remain indefinitely. Enforce TIMEOUT_ERROR_THRESHOLD to transition to ERROR or DEGRADED.
4. **Silent loading with no explanation during long waits**: After EXPLICIT_LOADING_COPY_THRESHOLD, loading copy must be visible.
5. **Error rendered as empty**: An API failure must produce ERROR or DEGRADED state, not EMPTY. An empty result set (valid API response with zero items) must produce EMPTY, not ERROR.

---

## 5. Page direction

### 5.1 Approved directions (do not implement)

| Page | Approved direction |
|---|---|
| **Home static shell/copy** | READY immediately. Static title, eyebrow, description, CTAs, note, intro link remain immediately usable. No data dependency. |
| **Home remote thumbnails** | Per-card media dependency. Each YouTube thumbnail image has its own loading lifecycle via `img.load`/`img.error` listeners. Current fallback chain (maxresdefault → mqdefault) is correct. Missing: explicit loading copy, long-wait state, retry, timeout, `aria-busy`. Thumbnail images are lazy-loaded (`loading="lazy"`), not decorative placeholders; they represent real remote content. |
| **Home video modal (clicked iframe)** | User-triggered remote media dependency. The modal (`hero-video-modal`) is created by `openVideoModal()` in `js/index-inline-init.js`. The `youtube-nocookie` iframe is appended immediately after click with no load listener, no error listener, no loading status, no long-wait status, no retry state, and no external-link fallback within the modal for loading/error states. Requires its own modal-region loading/degraded/error contract: stable poster/branded background, one loading status that resolves on iframe load, long-wait/error fallback that provides a safe close action and the original YouTube link as a navigation fallback. No page-wide loading overlay. |
| **Browse cards** | Keep skeleton-first pattern. Extract skeleton CSS into shared `primitives/` if reused. Add long-wait message after 8s. Add error/retry panel for primary card grid (currently missing). Ensure Korean copy for incremental loading sentinel. |
| **My Trees cards** | Keep state machine pattern (LOADING/LOADED/EMPTY/ERROR/RETRY). This is the reference implementation for card-grid loading. Add long-wait message after 8s. Add timeout transition to ERROR. |
| **Editor regions** | Needs the most work. Add explicit loading state for tree identity, memories, and detail panel. Currently relies on template mounts (inferred READY) without visible loading indicators. |
| **Detail regions** | Keep staged loading pattern. This is the reference implementation for detail-page loading. Add timeout for connected-moments loading. Add retry button for primary memory load. |
| **Public viewer** | Keep existing loading/empty/error/retry pattern. This is the reference for viewer loading. Add long-wait message. Ensure spinner respects reduced motion. |

---

## 6. Copy taxonomy

### 6.1 Semantic roles and i18n naming

| Semantic role | Proposed i18n key prefix | Korean copy | English copy |
|---|---|---|---|
| Page preparation | `loading.page.prepare` | 페이지를 준비하는 중 | Preparing the page |
| Media loading | `loading.media.load` | 영상을 불러오는 중 | Loading media |
| List loading | `loading.list.load` | 목록을 불러오는 중 | Loading the list |
| Region loading | `loading.region.load` | 내용을 불러오는 중 | Loading content |
| Long wait | `loading.long.wait` | 평소보다 오래 걸리고 있어요. 잠시만 기다려 주세요. | This is taking longer than usual. Please wait. |
| Degraded | `loading.degraded` | 일부 내용을 불러오지 못했지만 나머지는 계속 볼 수 있어요. | Some content could not load, but the rest is still available. |
| Error primary | `loading.error.primary` | 불러오지 못했어요 | Could not load |
| Error body | `loading.error.body` | 네트워크 상태를 확인하고 다시 시도해 주세요. | Check your connection and try again. |
| Retrying | `loading.retrying` | 다시 시도하는 중 | Retrying |
| Retry action | `loading.retry.action` | 다시 시도 | Retry |

### 6.2 Page-specific variation

Page-specific language may vary, but the semantic role must remain consistent. For example:
- Detail page uses "대표 장면을 준비하고 있어요" (media loading role)
- My Trees uses "러브트리 목록을 불러오는 중..." (list loading role)
- Viewer uses "러브트리를 불러오는 중이에요" (page preparation role)

Each of these maps to one of the semantic roles above. Future implementations should use consistent i18n keys (prefixes) even if page-specific copy varies.

---

## 7. Accessibility and motion

### 7.1 ARIA behavior

| Attribute | Ownership | Behavior |
|---|---|---|
| `role="status"` | Region-level loading indicator | Announce when loading state begins and ends. Use `aria-live="polite"`. |
| `aria-live` politeness | All loading regions | `polite` for loading updates. `assertive` only for errors (transition to ERROR). |
| `aria-busy="true"` | Region container | Applied when the region is in LOADING or RETRYING state. Removed when READY, EMPTY, ERROR, or DEGRADED. |
| Announcement deduplication | Page-level | If a region transitions through PENDING → LOADING → READY quickly (< 500ms), suppress intermediate announcements. Only announce LOADING if it persists past `SKELETON_DISPLAY_THRESHOLD` (500ms). |

### 7.2 Focus behavior

Focus may move to the error panel or retry button only when:
1. **Primary page content fully fails**: The content the user came to see cannot render at all (e.g., tree not found on Detail, memories failed on Viewer).
2. **User-triggered retry replaces context**: The user explicitly clicked retry and the result replaces the full errored region.
3. **Current focus target is removed**: The currently focused element is about to be removed from the DOM, and moving focus prevents loss.

Focus must NOT be taken away for:
- Secondary preview failures (Browse/My Trees preview hub hydration)
- Connected moments loading failures (Detail connected section)
- Background refresh failures
- Per-element thumbnail/image failures
- Any degraded sibling region where the errored content is not the user's primary focus

Secondary region errors use bounded polite announcements (`aria-live="polite"`) or inline status indicators. The current user focus is preserved.

`role="alert"` is reserved for primary blocking errors or user-triggered failures that require immediate awareness. It must not be applied universally to all error states. |

### 7.3 Reduced-motion behavior

| Element | Reduced-motion behavior |
|---|---|
| Skeleton shimmer | Pause animation. Show static skeleton with opacity only (no moving gradient). |
| Spinner | Stop rotation. Show static spinner icon in its default position. |
| Skeleton reveal (e.g., cards appearing) | Show all cards immediately without staggered reveal animation. |
| Progress transitions | No transition animations. Content appears instantly. |

### 7.4 Static fallback for shimmer/spinner

When `prefers-reduced-motion: reduce` is active:
- Shimmer: replace animated gradient with a static, low-contrast background color (`rgba(144,73,81,0.07)`)
- Spinner: display the Material Symbol in its default position without rotation animation; use a static icon like `progress_activity` without animation

### 7.5 Contrast requirements

- Loading indicator text must meet WCAG 2.1 AA contrast ratio (4.5:1 for normal text, 3:1 for large text)
- Skeleton placeholder colors must have sufficient contrast against the background to be perceivable, but must NOT have enough contrast to be mistaken for real content
- Error text must meet normal contrast requirements

### 7.6 Skeleton exclusion from content semantics

- ALL skeleton elements must have `aria-hidden="true"` to exclude them from the accessibility tree
- Skeleton text/headings must not be announced by screen readers
- Skeleton containers must NOT have `role` attributes that would announce them as content

---

## 8. Privacy and evidence

### 8.1 Prohibited exposure

The following must never appear in loading states, error copy, skeletons, console logs, or any user-visible output:

| Prohibited item | Example |
|---|---|
| Tree IDs | `tree-abc123` (internal ID) |
| Memory IDs | `mem-xyz789` |
| Owner IDs | `user_42` |
| Tokens | Firebase JWT, session tokens |
| Cookies | Session cookies, auth cookies |
| Sessions | Session store keys |
| DB rows | Raw SQL result sets |
| Raw payloads | Unparsed API JSON responses |
| Provider responses | Full Firebase auth response |
| Private URLs | Pre-signed S3 URLs, private storage paths |

### 8.2 Privacy-safe patterns

- Tree/memory identifiers in clone/copy/skeleton DOM: use generic placeholders (`data-video-id`, not the actual video ID)
- Logging: use `console.warn` with generic messages only (`[search/data] API 로드 실패:`, not the full error payload)
- Cache keys: generic prefixes only (`my_trees_list`, `memory_`, `tree_`)

---

## 9. Next-child decision

### 9.1 Selected child: Shared loading-state visual and copy primitives

This is Parent #3688's ordered child 2.

| Field | Value |
|---|---|
| **Selected child** | Shared loading-state visual and copy primitives (presentation-only) |
| **Reason** | Before any page integration, the canonical visual and copy primitives must exist as sharable assets. No page currently has a shared loading primitive — each implements independently. This child establishes the shared contract that subsequent page integrations reference. It does not require runtime behavior (no fetch, no timer, no state machine, no retry execution, no page orchestration). |
| **Scope** | Presentation-only: no fetch, no timer, no request timeout, no state machine, no retry execution, no page orchestration. |
| **Commonization candidates** | Inline loading status structure, long-wait message structure, degraded message structure, error/retry presentation structure, skeleton accessibility convention, spinner/reduced-motion convention, canonical copy-role/i18n naming contract. |
| **Exact expected source boundary** | New shared CSS primitives would go in `css/primitives/` (directory does not yet exist on `origin/main`). Shared i18n keys would go in `js/i18n/i18n-shared.js` or a new `js/i18n/i18n-loading.js`. Shared copy roles reference the taxonomy defined in §6. These paths do not exist on current `origin/main` — they are **proposed** source boundaries that must be created by the implementation child. |
| **Risk classification** | Generic Tier 2 / U2 (structural UI). Visual and copy changes only; no runtime sensitivity. |
| **Required focused tests** | 1. Contract test: shared loading status renders with correct ARIA 2. Contract test: skeleton elements are `aria-hidden="true"` 3. Contract test: spinner pauses under reduced motion 4. Visual comparison: shared skeleton vs page-specific skeleton layout stability |
| **Required browser evidence** | Not required for shared primitives (presentation-only). Optional visual comparison for skeleton layout stability. |
| **Known source overlap** | None. Shared primitives are new files. |
| **Known PR drift risk** | Low — new files do not conflict with open PRs. |

### 9.2 Page-owned runtime (must NOT be shared)

The following must remain page-owned runtime logic. The shared primitive child does not extract them:

- `loadPublicTrees()` (Browse)
- `setState()` (My Trees)
- `runEditorInitialLoadFlow()` (Editor)
- `loadCurrentDetail()` (Detail staged loader)
- `initViewer()` (Viewer)
- `initHeroGrowthCycle()` and `openVideoModal()` (Home media/modal lifecycle)

### 9.3 First page integration priority

After the shared-primitives child, the first page integration priority is:

| Priority | Surface | Reason |
|---|---|---|
| **1st** | Browse + My Trees loading communication convergence | Highest current user-visible DB/API-backed pain. Existing shared skeleton structure already spans both pages. Both need clear loading/empty/error distinctions. Home remains blocked by PR #3640. |
| **2nd** | Viewer (tree.html) | Already has functional loading/empty/error/retry; lowest integration cost. |
| **3rd** | Detail | Keep as reference/regression-preservation surface. Already has #646 reference behavior. Deferred to preserve its working pattern during the first wave of integration. |
| **4th** | Editor | Highest complexity U3 child. Deferred until shared primitives are stable. |
| **5th** | Home | Blocked by PR #3640. Cannot begin until PR #3640 is resolved. |

### 9.4 Risk classification for subsequent children

| Child type | Classification |
|---|---|
| Shared visual/copy primitive (presentation-only) | Generic Tier 2 / U2 |
| Browse/My Trees/Editor/Detail/Home runtime integration (involves timer, data transition, retry, auth readiness, iframe lifecycle, fixed-slot validation) | Generic Tier 3 / U3 |

API read alone does not lower to U2. Any child that changes timer, data transition, retry, auth readiness, iframe lifecycle, or requires fixed-slot validation is U3.

---

## 10. Historical disposition

| Issue | Status | Relationship |
|---|---|---|
| #646 | COMPLETED | Detail loading work. Current reference implementation for staged loading. |
| #691 | COMPLETED | Browse latency measurement. Evidence document is HISTORICAL_ONLY; current Browse uses different patterns. |
| #624 | COMPLETED | Editor title-loading work. Behavior present in current editor source. |
| #3672 | OPEN — Keep OPEN | Design System parent. Loading-state visual tokens depend on this. |
| #3688 | OPEN — Keep OPEN | Loading parent. This document is a child of #3688. |
| #3640 | OPEN Draft — Do not modify | Home hero work. Blocks Home loading-state work. |
| #3664 | Referenced | UI rapid iteration policy. Loading-state UI changes follow U2 classification. |
| #3670 | OPEN — Keep OPEN | Referenced in PR |
| #3657 | OPEN — Keep OPEN | Referenced in PR |
| #3458 | OPEN — Keep OPEN | Referenced in PR |
| #3425 | OPEN — Keep OPEN | Referenced in PR |
| #3435 | OPEN — Keep OPEN | Referenced in PR |
| #3437 | OPEN — Keep OPEN | Referenced in PR |
| #1882 | OPEN — Keep OPEN | Never close. Use `Refs #1882` only. |

### 10.1 Important caveat

> **#646 solved the detail-page loading system, not the product-wide loading system.** The product-wide canonical vocabulary and shared loading primitives do not exist in current source. Each page implements loading independently. This document establishes the product-wide contract that #646's detail page was the first implementation of, but the product-wide system remains to be built.

---

## 11. Summary

| Decision | Value |
|---|---|
| Canonical states | 9 (INITIAL, PENDING, LOADING, PARTIAL, READY, EMPTY, DEGRADED, ERROR, RETRYING) |
| Rejected states | 5 (STALE, LOADING_MORE, CACHED, OFFLINE, TIMEOUT) |
| Timing thresholds | INDICATOR_DISPLAY_DELAY: 300–500ms, EXPLICIT_LOADING_COPY: 1500–2000ms, LONG_WAIT: 8000ms, ERROR_ESCALATION: 15000ms |
| MINIMUM_INDICATOR_DURATION | Rejected (0ms; ready content must never be delayed by indicator display) |
| UI escalation vs request abort | Separated. ERROR_ESCALATION_THRESHOLD is UI-presentation only. Actual abort is page/operation-owned U3. |
| Prohibitions | 5 (multiple indicators, full-page blocking, indefinite skeleton, silent long-wait, error-as-empty) |
| Selected next child | Shared loading-state visual and copy primitives (presentation-only; Parent #3688 child 2) |
| First page integration priority | Browse + My Trees loading communication convergence |
| Deferred children | Detail (reference surface), Editor (U3), Home (blocked by PR #3640) |
| Blocked by PR #3640 | Home (until PR #3640 resolved) |
