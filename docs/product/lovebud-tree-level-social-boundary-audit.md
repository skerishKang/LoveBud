# LoveBud Tree-Level Social Boundary Audit

**Audit ID:** `docs/product/lovebud-tree-level-social-boundary-audit.md`
**Issue:** #3245 — `[Audit][Social][Tree] Map canonical tree-level social boundaries before UI`
**Parent:** Refs #3188
**Reference:** Refs #1882
**Audit SHA:** `14be45fa1cbfbd85cca53737f3e5f887940057bd`
**Date:** 2026-07-06
**Classification:** Evidence-only source audit — no runtime, no credentials, no production data

---

## 1. Executive Conclusion

**`NO SUPPORTED TREE-LEVEL SOCIAL RUNTIME`**

The repository has zero active tree-level social UI, zero client-side callers for any tree-level social endpoint, and no tree-level comment backend path. One authenticated tree-level like endpoint exists server-side, but it is unreachable from any client adapter. Tree-level social counts shown on My Trees and Browse/Search tree cards are read-only display values derived from tree-list API responses, not from any dedicated social count endpoint.

---

## 2. What Exists vs. What Is Moment-Level

### 2.1 Confirmed Tree-Level Paths

#### A. Tree-level like endpoint (server-side only — unreachable from client)

| Layer | Path | Methods | Auth | Backend handler |
|---|---|---|---|---|
| Cloudflare | `/api/trees/:treeId/likes` | GET, POST | Required | `functions/api/trees/[tree_id]/likes.js` → `POST /modal/private/trees/:treeId/likes` |
| Modal | `/modal/private/trees/:treeId/likes` | GET, POST | Firebase required | `modal_compute/tree_likes.py` |

**Backend functions in `modal_compute/tree_likes.py`:**

- `fetch_public_tree_like_count(tree_id)` — public read, returns `like_count` integer, no auth. Called from `app.py` line 251 when serving public tree detail.
- `fetch_tree_like_summary(tree_id, owner_id)` — authenticated read, returns `{treeId, active, likeCount}`. Includes `active` (whether current user has liked).
- `toggle_tree_like(tree_id, owner_id)` — authenticated write (toggle like/unlike), returns `{treeId, active, likeCount}`.

**Backend functions in `modal_compute/tree_views.py`:**

- `fetch_public_tree_view_count(tree_id)` — public read, returns `view_count` integer. Called from `app.py` line 252.

**Key backend properties of tree-level like:**

| Property | Value |
|---|---|
| Idempotency | Not implemented — unlike moment-level reactions/comments |
| Rate limiting | Not implemented — unlike comment creation |
| Audit logging | Not implemented — `tree_like` is not in `SAFE_ACTIONS` in `social_write_audit.py` |
| Moderation/deletion | Soft-delete only (`deleted_at` column); no admin deletion path |
| Ownership | Only the reacting user can unlike their own like |
| Account-data exposure | `owner_id` stored in `tree_likes` table; `ownerId` returned in `fetch_tree_like_summary` response |
| Visibility | Tree must be `public` to receive likes (404 otherwise) |

#### B. Tree-level reaction display surfaces (read-only, display-only)

These are UI components that render social counts for a tree card in My Trees or Browse/Search. The counts are read from pre-loaded tree list objects and are **not fetched from a dedicated social endpoint**.

**`js/my-trees/my-trees-ui.js`** lines 294–388:
- `getTreeLikeCount(tree)` — reads `tree.likeCount || tree.likes || 0`
- `getTreeViewCount(tree)` — reads `tree.viewCount || tree.views || 0`
- Renders 4 reaction metrics per tree card: `visibility` (조회수), `favorite` (좋아요), `chat_bubble` (댓글), `share` (공유)
- Uses `normalizedTree.commentCount || normalizedTree.comment_count || 0`
- Uses `normalizedTree.shareCount || normalizedTree.share_count || 0`

**`js/search/search-card-renderer.js`** lines 145–179:
- `getTreeReactionCounts(tree)` — reads `likeCount`, `commentCount`, `shareCount` from tree object properties (multiple fallback key names)
- `renderTreeReactionMetrics(tree)` — renders same 4-metric row in browse cards

**`js/search/search-share-link.js`** lines 104–136:
- `resolveSocialCount(tree, ['likeCount', 'likesCount', 'likes', 'like_count'])` and similar for comments/shares
- Used in share-link generation for browse cards

**Source of tree card social count data:** These values come from tree list API responses. The `/modal/trees/{tree_id}` endpoint (app.py line 251–252) adds `likeCount` and `viewCount` from `tree_social_counts` table. `commentCount` and `shareCount` are not added by any tree detail endpoint — they appear to come from tree list responses that include them as pre-computed fields.

#### C. Legacy tree-level UI in viewer state (non-functional placeholders)

**`js/viewer/viewer-state.js`** line 113:
- `treeComments: []` — empty placeholder array in fallback data skeleton; never populated from API
- `likedTree: false` — hardcoded, never hydrated

**`js/viewer/viewer-handler-factory.js`**:
- `toggleLike()` — pure local toggle `state.likedTree = !state.likedTree`, no API call

**`js/viewer/viewer-click-actions.js`**:
- `data-action="toggle-like"` and `data-action="open-tree-comments"` action handlers that call the local handlers above

**`js/viewer/viewer-shell-render.js`**:
- Renders `data-action="open-tree-comments"` button with aria-label `"트리 댓글 보기"`

**Verdict:** These are dead/unreachable UI hooks. No viewer code wires them to any API.

#### D. Visitor-viewer prototype (separate branch, not integrated)

The `js/visitor-viewer/` directory contains a complete tree-level social prototype, loaded from:
- `pages/tree.html`
- `pages/public-tree-viewer-shell.html`

**`js/visitor-viewer/visitor-viewer.js`** lines 77–170:
- Tree-level action dock with like toggle (`toggleLike()`), tree comment count, share
- `state.likedTree` toggled locally, counts from mock `data.tree.metrics`
- NOT integrated into production `pages/view.html` or any production viewer

**`js/visitor-viewer/visitor-viewer-panels.js`** lines 179–190:
- Tree-level comment panel: `renderTreeCommentsPanel()`, `vv-panel-tree-comments`
- Comment input with placeholder `"트리 전체에 댓글 남기기"`
- Tree-scope notice: "트리 전체 댓글은 흐름, 큐레이션, 만든 사람의 기억에 대한 반응입니다."
- Sort tabs: 인기순 / 최신순

**Status:** Prototype-only. `git log` shows last activity on `ea4c2c09c` (CSP enforcement). Not loaded from `pages/view.html`. Not connected to any production API route.

### 2.2 Moment-Level Social (Completed, Not Tree-Level)

The four completed moment-level social modules are **strictly scoped to `memoryId`** and must not be confused with tree-level equivalents:

| Module | Scope | Primary key | Key evidence |
|---|---|---|---|
| `public-viewer-read-only-social-summary.js` | Moment | `(treeId, memoryId)` pair | `fetchPublicMomentReactionSummary(treeId, memoryId)`, DOM IDs prefixed `moment`, `lastLoadedMemoryId` stale guard |
| `public-viewer-authenticated-like.js` | Moment | `memoryId` | `toggleReaction(memoryId, ...)`, `fetchReactionSummary(memoryId)`, `lastLoadedMemoryId` guard, DOM IDs prefixed `moment` |
| `public-viewer-authenticated-comment-composer.js` | Moment | `memoryId` | `createComment(subCtx.memoryId, ...)`, stale guard checks `activeContext.memoryId !== subCtx.memoryId`, composer mounted inside moment comments panel |
| `public-viewer-detail-ui.js` (social portions) | Moment | `memoryId` via `resolveSocialContext()` | Resolves `memoryId` from selected node, passes moment context to all social boundaries |

**Moment-level API routes in `functions/api/`:**
- `GET/POST /api/memories/:memoryId/reactions` — authenticated reaction toggle
- `GET/POST /api/memories/:memoryId/comments` — authenticated comment CRUD
- `GET /api/trees/:treeId/memories/:memoryId/reactions` — public moment reaction read
- `GET /api/trees/:treeId/memories/:memoryId/comments` — public moment comment read

**None of these routes accept a `treeId` alone as the primary scope key for reactions or comments.**

---

## 3. Existing Canonical Client Adapters

**`js/postgres-client.js` — `createMemoryApi()` factory (the only social API client):**

| Method | Endpoint | Scope |
|---|---|---|
| `fetchPublicMomentReactionSummary(treeId, memoryId)` | `GET /api/trees/:treeId/memories/:memoryId/reactions` | Moment (public read) |
| `fetchPublicMomentComments(treeId, memoryId)` | `GET /api/trees/:treeId/memories/:memoryId/comments` | Moment (public read) |
| `fetchReactionSummary(memoryId)` | `GET /api/memories/:memoryId/reactions` | Moment (auth read) |
| `toggleReaction(memoryId, type, key)` | `POST /api/memories/:memoryId/reactions` | Moment (auth write) |
| `createComment(memoryId, body, key)` | `POST /api/memories/:memoryId/comments` | Moment (auth write) |
| `fetchComments(memoryId)` | `GET /api/memories/:memoryId/comments` | Moment (auth read) |

**No tree-level client adapter exists.** Specifically:
- No `fetchTreeLikeCount(treeId)`, `toggleTreeLike(treeId, key)`, `fetchTreeComments(treeId)`, or `createTreeComment(treeId, body, key)` function exists.
- Zero client-side JavaScript calls to `/api/trees/:treeId/likes`.
- Zero client-side calls to any tree-level social write endpoint.

---

## 4. Source-Level Security & Operational Boundaries

### 4.1 Tree-level like endpoint (`functions/api/trees/[tree_id]/likes.js`)

| Boundary | Status |
|---|---|
| Authorization | Required — 401 if missing `Authorization` header |
| Rate limiting | None at Cloudflare layer |
| Idempotency | None — not forwarded to Modal |
| Visibility check | Modal backend returns 404 if tree is not public |
| Duplicate submission | Not protected — no idempotency key enforcement |
| Account-data exposure | `owner_id` stored in `tree_likes`; `active` boolean in summary response for the reacting user |
| Audit trail | Not recorded — `tree_like` not in `SAFE_ACTIONS` |

### 4.2 Tree-level comment route

| Boundary | Status |
|---|---|
| Route | **Does not exist** — no Cloudflare function, no Modal handler, no DB table |
| Any fallback | None |

### 4.3 Tree-level social display

| Boundary | Status |
|---|---|
| Tree comment count source | Pre-computed in tree list response; no dedicated endpoint; no verification of accuracy |
| Tree like count source | From `tree_social_counts.like_count` joined into tree responses |
| Tree share count source | Pre-computed in tree list response; no dedicated endpoint |

---

## 5. Findings Summary

### 5.1 Tree-level reaction/comment counts, placeholders, and display surfaces

| Finding | Location | Type |
|---|---|---|
| Tree card reaction metrics (like/comment/share/view) | `js/my-trees/my-trees-ui.js` lines 294–388 | Read-only display |
| Tree card reaction metrics (browse) | `js/search/search-card-renderer.js` lines 145–179 | Read-only display |
| Tree comment panel (prototype) | `js/visitor-viewer/visitor-viewer-panels.js` lines 179–190 | Prototype only |
| Tree comment data placeholder | `js/viewer/viewer-state.js` line 113 (`treeComments: []`) | Dead placeholder |
| Tree like state placeholder | `js/viewer/viewer-state.js` (`likedTree: false`) | Dead placeholder |
| Tree like count in detail | `app.py` line 251 (`likeCount` added to tree detail response) | Server-side read |
| Tree view count in detail | `app.py` line 252 (`viewCount` added to tree detail response) | Server-side read |

### 5.2 Canonical client adapters and server routes

| Capability | Route | Client adapter | Status |
|---|---|---|---|
| Public tree like count (read) | `GET /modal/public/trees/:treeId` (internal) → adds `likeCount` | None — embedded in tree detail response | **Active** — powers tree card display counts |
| Authenticated tree like (read own state) | `GET /api/trees/:treeId/likes` | **None** | Unreachable — no client caller |
| Authenticated tree like (write toggle) | `POST /api/trees/:treeId/likes` | **None** | Unreachable — no client caller |
| Public tree comment count | No route | None | **Does not exist** |
| Authenticated tree comment write | No route | None | **Does not exist** |
| Tree-level reaction summary UI | No route | None | **Does not exist** |

### 5.3 Moment-level vs. tree-level distinction

Every confirmed tree-level path is explicitly different from the moment-level implementation:

| Moment-level (completed) | Tree-level (audited) |
|---|---|
| `GET/POST /api/memories/:memoryId/reactions` | `GET/POST /api/trees/:treeId/likes` — different endpoint, different table (`tree_likes` vs `reactions`) |
| Idempotency-key required for writes | No idempotency for tree likes |
| `SAFE_ACTIONS` audit logging | No audit for tree likes |
| `rate_limit` + `check_and_increment_rate_limit` for writes | No rate limiting for tree likes |
| `public-viewer-read-only-social-summary.js` — moment-scoped | No equivalent for tree |
| `public-viewer-authenticated-like.js` — moment-scoped | No client-side caller for tree likes |
| `public-viewer-authenticated-comment-composer.js` — moment-scoped | No tree-level comment route exists |

---

## 6. Contract Test Boundary

No implementation contract is added in this evidence-only audit.

A future tree-level read or write implementation must add its own focused contract tests for:

- tree scope versus moment scope;
- public/private data boundary;
- loading/unavailable behavior;
- authenticated write eligibility;
- idempotency, rate-limit, and audit behavior where a write path is introduced.

Do not require moment-level wrappers to reject a tree UUID solely by UUID shape. Both identifiers use the same structural format, and the correct boundary must be established by separate tree-level adapters and explicit server-side scope/visibility checks when such a feature is implemented.

---

## 7. Recommended Next Child Slice

**Read-only tree-level social count display via a canonical API seam.**

Rationale: Tree card display currently relies on `likeCount`/`commentCount`/`shareCount` embedded in tree list responses. The source of `commentCount` and `shareCount` in tree list responses is not traceable to a verified DB column or endpoint. Before any tree-level like toggle or comment write UI is built, the single canonical read path for tree social counts should be:

1. Identified: Does `tree_social_counts` have a `comment_count` column? If not, what is the source of tree `commentCount` in tree list responses?
2. Verified: Is `tree_social_counts.like_count` synchronized correctly with `tree_likes` inserts/deletes?
3. Exposed: A dedicated `GET /api/trees/:treeId/social-counts` endpoint (or equivalent) that returns `{likeCount, commentCount, shareCount, viewCount}` for a tree, replacing reliance on embedded fields in tree list responses.

This is a **runtime-readiness-first** slice: read-only, no auth state mutation, no comment composition UI.

**Do not combine** this with a tree-level like toggle or comment composer in the same implementation slice.

---

## 8. Files Audited

### Cloudflare Functions (API layer)
- `functions/api/trees/[tree_id]/likes.js` — tree-level like proxy
- `functions/api/trees/[tree_id]/views.js` — tree-level view counter
- `functions/api/trees/[tree_id]/memories/[memory_id]/reactions.js` — moment-level public reaction read
- `functions/api/trees/[tree_id]/memories/[memory_id]/comments.js` — moment-level public comment read
- `functions/api/memories/[id]/reactions.js` — moment-level auth reaction
- `functions/api/memories/[id]/comments.js` — moment-level auth comment

### Modal Backend (compute layer)
- `modal_compute/tree_likes.py` — tree like toggle/summary/count functions
- `modal_compute/tree_views.py` — tree view count functions
- `modal_compute/app.py` — tree detail endpoint (lines 235–259), tree likes endpoints (lines 389–404)
- `modal_compute/public_reads.py` — `fetch_public_tree`, tree list queries
- `modal_compute/social_write_audit.py` — `SAFE_ACTIONS` definition
- `modal_compute/validation.py` — `normalize_tree_row`

### Client Adapters (js layer)
- `js/postgres-client.js` — `createMemoryApi()` — all social calls

### Viewer Social Modules (moment-level, confirmed distinct)
- `js/viewer/public-viewer-read-only-social-summary.js`
- `js/viewer/public-viewer-authenticated-like.js`
- `js/viewer/public-viewer-authenticated-comment-composer.js`
- `js/viewer/public-viewer-detail-ui.js` (social portions)

### Viewer State (tree-level placeholders)
- `js/viewer/viewer-state.js`
- `js/viewer/viewer-handler-factory.js`
- `js/viewer/viewer-click-actions.js`
- `js/viewer/viewer-shell-render.js`

### Tree Card Display (read-only)
- `js/my-trees/my-trees-ui.js`
- `js/my-trees/my-trees-preview-hub.js`
- `js/search/search-card-renderer.js`
- `js/search/search-share-link.js`

### Visitor-Viewer Prototype
- `js/visitor-viewer/visitor-viewer.js`
- `js/visitor-viewer/visitor-viewer-panels.js`
- `js/visitor-viewer/visitor-viewer-data.js`
- `js/visitor-viewer/visitor-viewer-render-tree.js`