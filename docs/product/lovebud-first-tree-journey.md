# First-Tree Journey & Automatic Hub Fallback

**Issue:** #2977  
**Status:** Analysis & Design Document  
**Date:** 2026-07-02  
**Scope:** `js/` directory only — `pages/` files untouched  

---

## Table of Contents

1. [Overview](#1-overview)
2. [Current Initial Load Flow Analysis](#2-current-initial-load-flow-analysis)
3. [First-Tree Journey Definition](#3-first-tree-journey-definition)
4. [Automatic Hub Fallback Design](#4-automatic-hub-fallback-design)
5. [Empty State UX Recommendations](#5-empty-state-ux-recommendations)
6. [File-by-File Analysis](#6-file-by-file-analysis)
7. [Implementation Roadmap](#7-implementation-roadmap)
8. [Related Issues & Dependencies](#8-related-issues--dependencies)

---

## 1. Overview

### Problem Statement

New LoveBud users who have just signed up have zero trees. The current UX shows a static "아직 러브트리가 없어요" (No LoveTrees yet) empty state with a CTA to create one. This is functional but misses an opportunity to:

- Guide the user through their **first-tree journey** (signup → first tree → first moment → Browse exposure)
- Provide a **hub fallback** when no trees exist (redirect to Browse/discover instead of dead-end empty state)
- Surface the product's core emotional value proposition before the user has created content

### Key Terminology

| Term | Definition |
|------|------------|
| **First-Tree Journey** | The complete onboarding flow from signup to the user's first tree being discoverable in Browse |
| **Hub Fallback** | What the system shows when a user has zero trees — ideally not a dead-end but a forward-looking destination |
| **Empty State** | The UI state displayed when tree list is empty (loading, loaded-with-data, empty, error) |
| **Appreciation Hub** | The sidebar/preview panel that shows tree details when selected (e.g., My Trees preview hub, Browse selected hub) |

---

## 2. Current Initial Load Flow Analysis

### 2.1 Home Page (`js/index.js`)

**File:** `js/index.js`, `js/index-inline-init.js`

The landing page (`index.html`) is a public marketing surface that:
- Renders a hero section with alternating copy (rotating every 3.5s)
- Fetches popular/latest public trees from `/api/community/trees` for growth-stage card thumbnails
- Initiates **Browse prefetch** via `LoveBudBrowsePrefetch.init()` for public tree discovery
- Has a **login / signup** CTA (no auth guard — it's public)

The index page does NOT have an auth-dependent empty state — it always shows marketing content. The first-tree journey begins **after** signup/login.

**Flow:**
```
index.html → signup.html / login.html → (auth redirect) → my-trees.html
```

### 2.2 My Trees Page (`js/my-trees.js`)

**File:** `js/my-trees.js` (514 lines, main orchestrator)

This is the primary user-facing page post-login. Its startup sequence:

1. **Auth Guard** (`DOMContentLoaded`):
   - Reads cached auth state from `localStorage` (`lovebud_auth_cache`)
   - Waits for `LoveBudAuthBootstrap.whenReady()` or `registerOnAuthReady`
   - If no user → redirect to login with `?redirect=my-trees`

2. **Boot Sequence** (`bootMyTrees`):
   - Sets up header "새 러브트리" button
   - Sets up retry button
   - Calls `loadTrees()` which invokes `LoveBudMyTreesData.loadTrees()`

3. **Data Loading** (`loadTrees` → `js/my-trees/my-trees-data.js`):
   - Checks in-memory cache (`LoveBudCache`)
   - Falls back to persistent cache (`localStorage` `lovebud_my_trees_list_cache` with 3min TTL)
   - If cached data exists → renders immediately (optimistic UI)
   - Calls `apiClient.getTrees()` to fetch fresh data
   - On success → normalizes, caches, renders
   - On failure → classifies error (auth/server/network/generic), uses cached fallback or error state

4. **Rendering** (`renderTrees` → `js/my-trees/my-trees-render.js` → `js/my-trees/my-trees-ui.js`):
   - Delegates to `LoveBudMyTreesUI.renderTrees()` if available
   - Falls back to minimal DOM rendering
   - If trees array is empty → calls `setState(STATE.EMPTY)`
   - If trees exist → renders cards with batching (first 4, then 6 per scroll batch)
   - Auto-selects first tree for preview hub

5. **State Management** (`js/my-trees/my-trees-page.js`):
   - States: `LOADING` | `LOADED` | `EMPTY` | `ERROR`
   - Each state toggles visibility of corresponding DOM sections (`#state-loading`, `#state-loaded`, `#state-empty`, `#state-error`)

### 2.3 Editor Initial Load Flow (`js/editor/editor-initial-load-flow.js`)

**File:** `js/editor/editor-initial-load-flow.js` (109 lines)

Editor entry flow:

1. `editor.js` → `resolveEditorEntryDependencies()` → `createEditorStartupContext()` → `runEditorInitialLoadFlow()`

2. **Tree Loading** (`runEditorInitialLoadFlow`):
   - Calls `editorDataLoader.loadInitialEditorTree()` with URL params (`treeId`)
   - If no tree returned:
     - If `authRequired` → redirect to login
     - If `urlTreeId` specified → renders error state with retry/back-to-my-trees buttons
     - Otherwise → marks editor ready (stops silently — no tree to edit)
   - If tree loaded:
     - Syncs tree data to `window.currentTreeData`
     - Loads memories via `editorDataLoader.loadEditorMemories()`
     - Returns `{ status: 'ready', tree, treeId, ... }`

3. **Empty Tree Handling** in Editor:
   - `updateCanvasEmptyGuide()` in `js/editor/editor-empty-guide-ui.js` checks if memories exist
   - If no visible moments → shows `#canvasEmptyGuide` with "첫 순간 심기" (Plant First Moment) CTA
   - The editor always has a valid tree ID (created or loaded), so "no tree" in editor means the tree has no memories yet

### 2.4 Viewer Init Flow (`js/viewer/viewer-init-flow.js`)

**File:** `js/viewer/viewer-init-flow.js` (134 lines)

The deterministic fallback pattern for the public viewer:

1. Gets `treeId` from route
2. If no `treeId` → `RS.renderEmpty()` (empty state)
3. Calls `DataLoader.loadPublicData(treeId)` to fetch memories
4. If no memories → `RS.renderEmpty()`
5. On error → `RS.renderError()` with retry capability

This is the **deterministic fallback** referenced in #3060 — each stage has an explicit fallback route.

### 2.5 Auth Session Flow (`js/auth/auth-session.js`)

Post-login redirect:
- On first successful auth, attempts `preloadRedirectTargetData()` for the redirect target
- Default redirect target (no `returnTo`/`redirect` param): `my-trees.html`
- Fetches user's first tree (`apiClient.getTrees()` → `apiClient.getTree(firstTreeId)`) to warm caches

---

## 3. First-Tree Journey Definition

The complete path a new user takes from signup to first Browse exposure:

### Stage 1: Signup → First Landing

```
signup.html → (auth success) → redirect → my-trees.html
```

**Current behavior:**
- User signs up, is authenticated, redirected to `my-trees.html`
- My Trees page shows **empty state**: "아직 러브트리가 없어요" + "새 러브트리 만들기" CTA
- The empty state is visually sparse — a centered text message with a button

**Gap:** No onboarding narrative. No explanation of what a LoveTree is or why to create one.

### Stage 2: First Tree Creation

```
my-trees.html → "새 러브트리 만들기" → create tree modal → editor
```

**Current behavior:**
- CTA opens a modal (`#createTreeModalBackdrop`) with:
  - Title input (pre-filled: "나의 첫 러브트리")
  - Start goal card: "둘러보기에 소개될 트리로 키우기" (Grow this tree toward Browse introduction)
  - Description: "좋아하는 순간을 3개 이상 남기면 둘러보기에 소개될 수 있어요."
- On submit → `apiClient.createTree({ title, visibility: 'public' })` → redirect to editor with `?treeId=xxx`
- Creation flow has robust error handling with reconciliation (snapshot → check mode)

**Key files:** `js/my-trees/my-trees-actions.js` (`createNewTree`), `js/my-trees.js` (`createNewTree` wrapper)

### Stage 3: First Moment Addition

```
editor?treeId=xxx → add first memory → canvas & detail panel update
```

**Current behavior:**
- Editor loads with tree ID and shows empty canvas guide: "이 트리의 첫 순간을 기록해볼까요?"
- Primary CTA: `#canvasEmptyStartBtn` → `showAddMemoryForm()`
- Canvas empty guide is hidden when first memory is added
- Detail panel shows empty state until a memory is selected

**Key files:** `js/editor/editor-empty-guide-ui.js`, `js/editor/editor-initial-load-flow.js`, `js/editor.js`

### Stage 4: Browse Exposure (3+ Moments)

Once the tree has **3 or more moments**, it becomes eligible for Browse discovery:
- The creation modal explicitly states this goal
- On the My Trees page, cards show moment count and representative thumbnail
- The tree appears in Browse's `/api/community/trees` endpoint when visibility is `public`
- Browse prefetch warms the cache for faster listing

### Journey Map

```
┌──────────────────────────────────────────────────────────────────┐
│                    FIRST-TREE JOURNEY MAP                        │
├──────────────────────────────────────────────────────────────────┤
│                                                                  │
│  ┌─────────┐    ┌──────────┐    ┌────────┐    ┌─────────────┐  │
│  │ SIGNUP  │───▶│ MY TREES │───▶│EDITOR  │───▶│ BROWSE      │  │
│  │         │    │ (empty)  │    │(1st     │    │ (3+ moments)│  │
│  │ /signup │    │          │    │ moment) │    │             │  │
│  └─────────┘    └──────────┘    └────────┘    └─────────────┘  │
│       │              │              │               │           │
│       │ Auth         │ Empty        │ Empty         │ Public    │
│       │ redirect     │ state + CTA  │ canvas guide  │ discovery │
│       ▼              ▼              ▼               ▼           │
│  ┌─────────┐    ┌──────────┐    ┌────────┐    ┌─────────────┐  │
│  │my-trees │    │ "첫 트리  │    │"첫 순간 │    │ Browse card │  │
│  │.html    │    │ 만들기"   │    │심기" CTA│    │ with moment │  │
│  │         │    │ 모달      │    │        │    │ count       │  │
│  └─────────┘    └──────────┘    └────────┘    └─────────────┘  │
│                                                                  │
└──────────────────────────────────────────────────────────────────┘
```

---

## 4. Automatic Hub Fallback Design

### 4.1 What is a Hub Fallback?

When a user has **no trees**, instead of showing a blank/empty state, the system should **automatically fall back** to a meaningful destination — the **Browse/discover hub** where the user can explore public LoveTrees.

### 4.2 Current Fallback Chain

```
my-trees.html page load
  │
  ├── Auth check → FAIL → redirect to login
  │
  ├── Cache check → HIT → show cached trees (optimistic)
  │
  ├── API getTrees() → SUCCESS
  │     ├── trees.length > 0 → render tree cards
  │     └── trees.length === 0 → STATE.EMPTY → show empty state
  │
  └── API getTrees() → FAILURE
        ├── cache available → show cached + warning toast
        └── no cache → STATE.ERROR → show error state
```

**Current empty state (`STATE.EMPTY`):**
- Shows `#state-empty` section
- Contains: title ("아직 러브트리가 없어요"), description ("첫 러브트리를 만들어 시작해보세요."), CTA ("새 러브트리 만들기")
- No hub fallback → user must create a tree or leave

### 4.3 Proposed Fallback Architecture

```
my-trees.html page load (user authenticated, trees === 0)
  │
  ├── Show enhanced empty state with:
  │     ├── Onboarding narrative (what is a LoveTree?)
  │     ├── "첫 러브트리 만들기" primary CTA
  │     └── "둘러보기에서 탐색" secondary CTA → Browse page
  │
  └── Auto-hub fallback (configurable):
        ├── Show Browse preview hub inline → fetch featured public trees
        │     and display them in the My Trees layout
        │
        └── OR: Auto-redirect to Browse after delay with
              a toast: "아직 트리가 없어요. 둘러보기에서 다른 트리를 살펴보세요."
```

### 4.4 Implementation Options

#### Option A: Inline Browse Preview Hub (Recommended)

When `trees.length === 0` AND user is authenticated:

1. Render a **Browse preview hub** inside the My Trees page layout
2. Fetch featured/public trees from `/api/community/trees?sort=popular&limit=6`
3. Display them as a "둘러보기 추천" (Browse Recommendations) section
4. Keep the "첫 러브트리 만들기" CTA visible

**Advantages:**
- User stays on My Trees page
- Immediate value — shows what LoveBud looks like in the wild
- Gentle onboarding — "look what others have made, then create your own"

#### Option B: Auto-redirect to Browse

When `trees.length === 0`:
1. Show a brief interstitial toast: "아직 트리가 없어요. 둘러보기로 이동합니다."
2. After 2-3s, redirect to `pages/search` (Browse page)

**Advantages:**
- Simpler to implement
- User immediately sees public content
- No layout changes needed on My Trees page

**Disadvantages:**
- Disorienting redirect
- Loses the create-tree CTA context

#### Option C: Hybrid (Recommended for v1)

Combine both: show the enhanced empty state with inline Browse preview AND keep the secondary Browse entry point.

### 4.5 Data Flow for Hub Fallback

```javascript
// In LoveBudMyTreesData.loadTrees() or a new fallback module
async function loadTreesWithHubFallback(options) {
  const result = await loadTrees(options);
  
  // If no trees and user is authenticated → trigger hub fallback
  if (result.trees.length === 0 && isAuthenticated()) {
    if (config.enableHubFallback) {
      await showBrowseHubFallback();
    }
  }
  return result;
}

async function showBrowseHubFallback() {
  try {
    const response = await fetch(
      '/api/community/trees?view=summary&sort=popular&limit=6',
      { headers: { Accept: 'application/json' } }
    );
    const featuredTrees = await response.json();
    
    if (Array.isArray(featuredTrees) && featuredTrees.length > 0) {
      renderBrowseHubFallback(featuredTrees);
    }
  } catch (e) {
    // Silent fallback — keep original empty state
    console.warn('[hub-fallback] Failed to load featured trees:', e.message);
  }
}
```

### 4.6 Module Ownership

| Module | Responsibility |
|--------|---------------|
| `js/my-trees/my-trees-data.js` | Add `loadTreesWithHubFallback()` alongside existing `loadTrees()` |
| `js/my-trees/my-trees-hub-fallback.js` | **New file** — Browse preview rendering in My Trees layout |
| `js/my-trees/my-trees-page.js` | Add `STATE.HUB_FALLBACK` state (optional) |
| `js/my-trees.js` | Wire hub fallback after empty state detection |
| Existing: `js/browse-prefetch.js` | Already prefetches public trees — can reuse cached data |

---

## 5. Empty State UX Recommendations

### 5.1 Current Empty State (My Trees)

- **Title:** "아직 러브트리가 없어요"
- **Description:** "첫 러브트리를 만들어 시작해보세요."
- **CTA:** "새 러브트리 만들기" (→ modal → editor)
- **Visual:** Minimal centered text + button

### 5.2 Current Empty State (Editor)

- **Canvas guide:** "이 트리의 첫 순간을 기록해볼까요?"
- **CTA:** "첫 순간 심기" (→ memory form)
- **Detail panel:** "첫 순간이 트리를 깨워요" / "첫 순간을 심으면 이 패널이 현재 순간 허브로 바뀝니다."

### 5.3 Current Empty State (Viewer)

- **Viewer empty:** "RS.renderEmpty()" → generic empty message
- **Viewer fallback:** deterministic fallback through DataLoader → if no data, render empty

### 5.4 Proposed Empty State Improvements

#### My Trees — No Trees At All

```html
<!-- Enhanced empty state -->
<div id="state-empty" class="my-trees-empty-enhanced">
  <!-- Onboarding narrative -->
  <div class="empty-hero-icon">🌱</div>
  <h2>러브트리, 첫 순간을 기다리고 있어요</h2>
  <p class="empty-description">
    러브트리는 감정이 이어진 순간을 기록하는 공간이에요.  
    첫 순간을 심으면 트리가 자라기 시작합니다.
  </p>
  
  <!-- Primary CTA -->
  <button id="createTreeBtn" class="btn-round btn-primary">
    <span class="material-symbols-outlined">add_circle</span>
    첫 러브트리 만들기
  </button>
  
  <!-- Browse preview hub fallback section -->
  <div class="hub-fallback-section">
    <h3 class="hub-fallback-heading">둘러보기 추천</h3>
    <p class="hub-fallback-subtext">다른 사람의 러브트리를 살펴보고 영감을 얻어보세요</p>
    <div id="hubFallbackGrid" class="hub-fallback-grid">
      <!-- Dynamically populated featured trees -->
    </div>
    <a href="pages/search" class="btn-round btn-outline" style="margin-top:16px;">
      <span class="material-symbols-outlined">explore</span>
      둘러보기에서 더 보기
    </a>
  </div>
</div>
```

#### My Trees — Search Returns No Results (Already Exists)

The current search-empty state is adequate:
- Icon: `search_off`
- Text: "조건에 맞는 러브트리가 없어요."
- Subtext: "검색어를 지우거나 필터를 전체로 바꿔보세요."

#### Editor — No Memories

The current empty canvas guide already has good UX:
- Eyebrow: "시작하기"
- Title: "이 트리의 첫 순간을 기록해볼까요?"
- CTA: "첫 순간 심기"
- Hint: "캔버스를 두 번 클릭해도 새 순간을 시작할 수 있어요."

**Suggested enhancement:** Add a brief product narrative: "러브트리는 감정이 이어진 순간을 기록하는 공간이에요. 지금 마음이 머문 장면, 다시 보고 싶은 순간을 남겨보세요."

### 5.5 i18n Keys to Add

```javascript
// Proposed new i18n keys for empty state enhancement
'empty_state_onboarding_title': {
  ko: '러브트리, 첫 순간을 기다리고 있어요',
  en: 'Your LoveTree is waiting for its first moment'
},
'empty_state_onboarding_desc': {
  ko: '러브트리는 감정이 이어진 순간을 기록하는 공간이에요. 첫 순간을 심으면 트리가 자라기 시작합니다.',
  en: 'A LoveTree is a space to record connected emotional moments. Plant your first moment and watch it grow.'
},
'empty_state_browse_cta': {
  ko: '둘러보기에서 탐색',
  en: 'Explore Browse'
},
'empty_state_hub_fallback_heading': {
  ko: '둘러보기 추천',
  en: 'Browse Recommendations'
},
'empty_state_hub_fallback_subtext': {
  ko: '다른 사람의 러브트리를 살펴보고 영감을 얻어보세요',
  en: 'Explore other LoveTrees for inspiration'
},
'empty_state_viewer_empty': {
  ko: '이 트리에는 아직 공개된 순간이 없어요',
  en: 'This tree has no public moments yet'
}
```

---

## 6. File-by-File Analysis

### 6.1 `js/index.js` (46 lines)

| Aspect | Detail |
|--------|--------|
| **Role** | Home page init — scroll animations, language toggle, Browse prefetch |
| **Auth** | None — public page |
| **Empty State** | N/A — always shows marketing content |
| **Hub Fallback** | Not applicable |
| **Key Function** | `setupBrowseSafePrefetch()` → warms Browse cache |
| **Dependencies** | `LoveBudBrowsePrefetch` (from `js/browse-prefetch.js`) |

### 6.2 `js/index-inline-init.js` (162 lines)

| Aspect | Detail |
|--------|--------|
| **Role** | Hero section with rotating copy sets, fetches popular trees for growth-stage cards |
| **Empty State** | Graceful degradation — if fetch fails, cards keep CSS gradient fallback |
| **Hub Fallback** | Fetches `/api/community/trees?view=summary&sort=popular&limit=8` then falls back to `latest` |
| **Key Pattern** | `fetchTrees('popular').catch(() => fetchTrees('latest'))` — cascade fallback |

### 6.3 `js/my-trees.js` (514 lines)

| Aspect | Detail |
|--------|--------|
| **Role** | Main orchestrator for My Trees page — auth guard, data loading, rendering, CTAs |
| **States** | LOADING → LOADED / EMPTY / ERROR |
| **Empty State Handling** | Delegates to `myTreesPage.setState(STATE.EMPTY)` when trees array is empty |
| **Hub Fallback** | None currently. Has `autoSelectFirstTree()` for non-empty state |
| **Key Functions** | `bootMyTrees()`, `loadTrees()`, `createNewTree()`, `renderTrees()` |
| **Sub-module Delegation** | All real work delegated to `my-trees/` sub-modules |
| **Hub Integration** | Initializes `LoveBudMyTreesPreviewHub` after boot |

### 6.4 `js/my-trees/my-trees-page.js` (183 lines)

| Aspect | Detail |
|--------|--------|
| **Role** | State constants (LOADING/LOADED/EMPTY/ERROR), state section visibility toggling, button bindings |
| **Empty State** | `setState(STATE.EMPTY)` → shows `#state-empty` section, hides all others |
| **Error Handling** | Differentiates auth/server/network/generic error messages |
| **Key Functions** | `setState()`, `_applyErrorStateMessage()` |

### 6.5 `js/my-trees/my-trees-state.js` (100 lines)

| Aspect | Detail |
|--------|--------|
| **Role** | Tree collection sorting (recent/oldest/name), selected tree ID tracking |
| **Empty State** | N/A — pure data helpers, no UI |
| **Key Functions** | `sortTrees()`, `bindSortSelect()`, `setLastTreesData()` |

### 6.6 `js/my-trees/my-trees-data.js` (365 lines)

| Aspect | Detail |
|--------|--------|
| **Role** | Cache management, tree loading from API, memory metadata enrichment |
| **Empty State** | When `loadTrees()` succeeds with empty array → `renderTrees([])` → caller decides empty state |
| **Caching** | Dual-layer: in-memory `LoveBudCache` + persistent `localStorage` with 3min TTL |
| **Error Classification** | `classifyLoadError()` — auth (401/403), server (5xx), network (0), generic |
| **Preloading** | `preloadFirstTreeDetail()` — warms first tree's detail + memories in background |
| **Key Functions** | `loadTrees()`, `enrichTreesWithMemoryMeta()` |

### 6.7 `js/my-trees/my-trees-actions.js` (703 lines)

| Aspect | Detail |
|--------|--------|
| **Role** | Tree CRUD: create, rename, delete, toggle visibility |
| **Empty State** | Shows creation modal with pre-filled title "나의 첫 러브트리" |
| **Creation Flow** | Modal → `apiClient.createTree()` → redirect to editor |
| **Error Handling** | Robust: auth errors, rate limits, server errors, reconciliation fallback |
| **Key Functions** | `createNewTree()`, `setupCreateTreeModal()`, `openCreateTreeModal()` |

### 6.8 `js/my-trees/my-trees-render.js` (117 lines)

| Aspect | Detail |
|--------|--------|
| **Role** | Rendering orchestration, selection state, delegation to UI module |
| **Empty State** | If trees length is 0 → `setState(stateEnum.EMPTY)` |
| **Key Functions** | `renderTrees()`, `sortTrees()`, `applyTreeSelection()` |

### 6.9 `js/my-trees/my-trees-ui.js` (580 lines)

| Aspect | Detail |
|--------|--------|
| **Role** | Tree card rendering, batch loading, visual helpers |
| **Empty State** | When `trees.length === 0` → `setState(stateEnum.EMPTY)` |
| **Batch Rendering** | First 4 cards synchronously, then 6 per scroll batch via IntersectionObserver |
| **Card Visuals** | Thumbnail, title, visibility badge, metrics (views/likes/comments/shares), mini tree SVG |

### 6.10 `js/my-trees/my-trees-preview-hub.js` (728 lines)

| Aspect | Detail |
|--------|--------|
| **Role** | Selected-tree appreciation hub (sidebar panel) for My Trees page |
| **Empty State** | Shows placeholder when no tree is selected: `#myTreesHubPlaceholder` |
| **Flow** | Tree title → meta badge → flow moments → primary action |
| **Key Functions** | `onCardClick()`, `showPlaceholder()`, `showTreePreview()` |

### 6.11 `js/editor/editor-initial-load-flow.js` (109 lines)

| Aspect | Detail |
|--------|--------|
| **Role** | Editor initial data loading: tree + memories |
| **Empty Tree Handling** | If tree not found with `urlTreeId` → error state with retry. If no tree and no id → stops silently |
| **Empty Memories** | Returns `memoriesCount: 0` — caller (editor.js) decides empty guide visibility |
| **Key Pattern** | Deterministic async flow: load tree → load memories → return status |

### 6.12 `js/editor/editor-empty-guide-ui.js` (197 lines)

| Aspect | Detail |
|--------|--------|
| **Role** | Canvas empty guide visibility management |
| **Empty State** | Guide visible when tree has no "visible moments" (real content, not root placeholders) |
| **CTA** | "첫 순간 심기" button → `showAddMemoryForm()` |
| **Key Functions** | `updateCanvasEmptyGuide()`, `hasVisibleMoment()` |

### 6.13 `js/editor/editor-entry-fallbacks.js` (143 lines)

| Aspect | Detail |
|--------|--------|
| **Role** | Fallback factories for editor if canonical modules are absent |
| **Pattern** | `createInlineShowToastFallback`, `createInlineRedirectToEditorLoginFallback`, `createInlineRenderTreeLoadErrorFallback` |
| **Fallback Rendering** | `renderTreeLoadError` shows 🌱 icon + error title/desc + retry/my-trees buttons |

### 6.14 `js/viewer/viewer-init-flow.js` (134 lines)

| Aspect | Detail |
|--------|--------|
| **Role** | Public viewer initialization with deterministic fallback |
| **Empty State** | `RS.renderEmpty()` — called when no treeId or no memories |
| **Fallback Chain** | `getTreeId()` → `loadPublicData()` → `buildBranches()` → render. Each step has error handling |
| **Error State** | `RS.renderError()` — error display with retry |

### 6.15 `js/my-trees/my-trees-page-bootstrap.js` (31 lines)

| Aspect | Detail |
|--------|--------|
| **Role** | Common header rendering + tree view mode switcher init |
| **Empty State** | N/A — pure init bootstrap |
| **Key Functions** | Initializes `LoveBudTreeViewModeSwitcher` with default mode `large` |

---

## 7. Implementation Roadmap

### Phase 1: Enhanced Empty State (no code changes to pages/)

| Step | File(s) | Description |
|------|---------|-------------|
| 1.1 | `js/i18n/i18n-my-trees.js` | Add new i18n keys for onboarding narrative |
| 1.2 | `js/my-trees/my-trees-page.js` | Add `STATE.HUB_FALLBACK` constant (optional — can reuse EMPTY with enhanced DOM) |
| 1.3 | `js/my-trees/my-trees-ui.js` | Enhance `renderTrees()` or add `renderEmptyWithHubFallback()` to show inline Browse preview |
| 1.4 | `js/my-trees/my-trees-data.js` | Add `loadTreesWithHubFallback()` — after load, if trees===0, fetch featured public trees |
| 1.5 | `js/my-trees.js` | Wire hub fallback in `renderTrees()` empty branch |

### Phase 2: Hub Fallback Module

| Step | File(s) | Description |
|------|---------|-------------|
| 2.1 | `js/my-trees/my-trees-hub-fallback.js` | **New file** — renders featured public tree cards in empty state |
| 2.2 | `js/my-trees.js` | Import and initialize hub fallback module |
| 2.3 | `js/browse-prefetch.js` | Optionally share cached Browse data with hub fallback |

### Phase 3: Onboarding Narrative

| Step | File(s) | Description |
|------|---------|-------------|
| 3.1 | `js/i18n/i18n-my-trees.js` | Finalize all onboarding copy |
| 3.2 | `js/my-trees/my-trees-ui.js` | Style enhanced empty state with narrative hero section |
| 3.3 | CSS (not in scope) | Style the hub fallback grid and onboarding section |

### Phase 4: Editor Empty State Enhancement

| Step | File(s) | Description |
|------|---------|-------------|
| 4.1 | `js/editor/editor-empty-guide-ui.js` | Add onboarding narrative text to empty canvas guide |
| 4.2 | `js/editor/editor-shell-startup.js` | Update copy in `applyEditorShellCopy()` |
| 4.3 | `js/editor/editor-save-status.js` | No changes needed |

---

## 8. Related Issues & Dependencies

### Completed Issues

| Issue | Description | Status |
|-------|-------------|--------|
| #3061 | Appreciation order guide | ✅ Done |
| #3060 | Viewer fallback (deterministic fallback in viewer-init-flow.js) | ✅ Done |
| #3058 | Hub-layout API | ✅ Done |
| #3059 | Editor save status | ✅ Done |

### Related Issues

| Issue | Description | Relationship |
|-------|-------------|--------------|
| #2977 | First-tree journey + hub fallback (this) | — |
| #800 | Browse tree-first discovery plan | Defines Browse as tree-first; hub fallback feeds into this |
| #1488 | Card metrics unification | Card visuals are part of hub fallback rendering |
| #2448 | Empty moment content refinement | Used by editor-empty-guide-ui.js for real content detection |
| #2449 | Empty guide CTA simplification | Simplified editor empty state to single primary CTA |

### Design Constraints

1. **No `pages/` file modifications** — all changes must be in `js/` directory
2. **Backward compatibility** — new hub fallback must degrade gracefully (old browsers, API failures)
3. **Cache-first UX** — My Trees already shows cached data optimistically; hub fallback should follow same pattern
4. **Deterministic fallback chain** (per #3060 pattern) — every load stage must have an explicit fallback
5. **No auth exposure** — do not expose tokens, user IDs, or session data in fallback rendering

---

## Appendix A: State Machine Overview

```
                    ┌──────────────────────┐
                    │   Page Load Start     │
                    └──────────┬───────────┘
                               │
                    ┌──────────▼───────────┐
                    │   Auth Check          │
                    │   (cached + bootstrap)│
                    └──────────┬───────────┘
                               │
                ┌──────────────┼──────────────┐
                │              │              │
     ┌──────────▼──────────┐   │   ┌─────────▼─────────┐
     │  Auth Pending       │   │   │  Not Authenticated │
     │  (wait for ready)   │   │   │  → redirect login  │
     └─────────────────────┘   │   └───────────────────┘
                               │
                    ┌──────────▼───────────┐
                    │   Load Trees (API)    │
                    └──────────┬───────────┘
                               │
                ┌──────────────┼──────────────┐
                │              │              │
     ┌──────────▼──────────┐   │   ┌─────────▼─────────┐
     │  Cache Hit          │   │   │  API Error         │
     │  → show cached      │   │   │  → cache? → cached │
     │  → refresh in bg    │   │   │  → no cache → error│
     └─────────────────────┘   │   └───────────────────┘
                               │
                    ┌──────────▼───────────┐
                    │  trees.length === 0  │
                    └──────────┬───────────┘
                               │
                ┌──────────────┼──────────────┐
                │              │              │
     ┌──────────▼──────────┐   │   ┌─────────▼─────────┐
     │  ENHANCED EMPTY     │   │   │  Render Tree Cards │
     │  + Hub Fallback     │   │   │  + Preview Hub     │
     │  (Browse featured)  │   │   └───────────────────┘
     └─────────────────────┘   │
                               │
                    ┌──────────▼───────────┐
                    │  "새 러브트리 만들기" │
                    │  → modal → editor    │
                    └──────────────────────┘
```

## Appendix B: Current Empty State DOM Structure

```html
<!-- From pages/my-trees.html (reference only — do not modify) -->
<div id="state-empty" class="my-trees-state state-hidden" role="status">
  <div class="my-trees-empty-state">
    <div class="my-trees-empty-icon">
      <span class="material-symbols-outlined">psychiatry</span>
    </div>
    <h2 data-i18n="empty_state_title">아직 러브트리가 없어요</h2>
    <p data-i18n="empty_state_desc">첫 러브트리를 만들어 시작해보세요.</p>
    <button id="createTreeBtn" class="btn-round btn-primary">
      <span class="material-symbols-outlined">add_circle</span>
      새 러브트리 만들기
    </button>
  </div>
</div>
```

The enhanced empty state can be created entirely in JS by targeting the existing `#state-empty` container. No HTML changes required.

---

*End of document. This analysis covers `js/` directory only — no `pages/` files were modified.*
