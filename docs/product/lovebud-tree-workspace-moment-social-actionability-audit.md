# LoveBud Tree Workspace Moment Social Actionability Audit

## Status

- Refs: #3075, #3188, #3264, #1882
- Parent issue: #3075 — Make moment likes and comments actionable in Tree Workspace view mode
- Related: #3188 (tree-level social), #3264 (Migration A verification)
- Audit date: 2026-07-09
- Audited branch baseline: `main` at `7aa8952e578b544e84b086e15d220928f5af5ed0`
- Scope: source-level audit, no production smoke, no DB migration, no deployment
- Runtime behavior change: none
- Database/schema migration: none
- API behavior change: none
- Frontend behavior change: none

## Executive Summary

The Tree Workspace view mode moment social surface is partially implemented. Like/comment rendering and read paths are live and operational. Write paths (like toggles, comment composer) exist but are gated behind auth and not fully wired in the default public canvas init flow. Key gaps remain around stale placeholder text, hardcoded guest mode override, missing comment deletion UI, and incomplete API contract documentation.

## 1. Current UI Surface

### Moment Reactions Card (`js/viewer/public-viewer-detail-view-mode-template.js:42-90`)

The selected moment social row renders inside `#momentReactionsCard` with:

| Element | Type | Initial State | Purpose |
|---------|------|---------------|---------|
| `#momentReactionLikeStatus` | `<span>` | Shows `⋯` | Loading/static like count display |
| `#momentReactionLikeButton` | `<button>` | `disabled`, `display:none`, `aria-pressed="false"` | Like toggle button |
| `#momentReactionLikeGuestNote` | `<span>` | Visible | "로그인하면 좋아요를 남길 수 있어요." |
| `#momentReactionWriteError` | `<div>` | Hidden | Error display slot |
| `#momentReactionCommentStatus` | `<button>` | `disabled` | Comment count toggle |
| `#momentCommentsPanel` | `<section>` | `hidden` | Comment list container |
| `#momentReactionNote` | `<span>` | Visible | Defaults to "반응 기능은 준비 중이에요." |

Controls are `<button>` elements, not static text. The like button is hidden by default. The comment toggle is disabled until data loads. The placeholder text "반응 기능은 준비 중이에요." is overwritten in most code paths but remains the default.

### Comment Panel (`js/viewer/public-viewer-detail-view-mode-template.js:80-88`)

Contains `<ul id="momentCommentsList">` populated dynamically when the panel opens.

### Comment Composer (`js/viewer/public-viewer-authenticated-comment-composer.js`)

Dynamic DOM (not pre-rendered). Created when panel opens for authenticated users. Composer includes textarea (maxLength=5000), submit/cancel buttons, error/success states. Guest mode shows note "댓글은 읽을 수 있어요. 로그인하면 댓글을 남길 수 있어요."

### Current Actionability

- **Read-only users**: See count and guest note only. No actionable control.
- **Authenticated users via `public-viewer-canvas-entry.js`**: Like button enabled with optimistic update. Comment composer available.
- **Authenticated users via `public-canvas-init.js`** (hardcoded fallback): Forced guest mode — never sees actionable controls.

## 2. Current Data Source

Social counts are loaded from real API endpoints, not placeholders or static values.

| Source (client function, `js/postgres-client.js`) | Client Route (via `/api/...`) | Auth | Returns |
|--------|----------|------|---------|
| `fetchReactionSummary(memoryId)` | `GET /api/memories/{memory_id}/reactions` | Required | `{ counts: { like: int }, total: int, userReactions: [...] }` |
| `fetchComments(memoryId)` | `GET /api/memories/{memory_id}/comments` | Optional | `{ comments: [...], nextCursor: null }` |
| `fetchPublicMomentReactionSummary(treeId, memoryId)` | `GET /api/trees/{tree_id}/memories/{memory_id}/reactions` | None (publicRead) | Anonymous aggregate counts |
| `fetchPublicMomentComments(treeId, memoryId)` | `GET /api/trees/{tree_id}/memories/{memory_id}/comments` | None (publicRead) | `{ id, body, createdAt }` |
| `toggleReaction(memoryId, type, idempotencyKey)` | `POST /api/memories/{memory_id}/reactions` | Required | Server confirmation |
| `createComment(memoryId, body, idempotencyKey)` | `POST /api/memories/{memory_id}/comments` | Required | Created comment object |

Client routes use base path `/api/...`. The Cloudflare Functions layer dispatches to Modal backend routes with corresponding GET/POST methods. See Section 3 for backend (Modal) implementation details.

Loading state shows `⋯`. Unavailable state shows `—`. Success state shows real integer.

## 3. Current API/Auth/Visibility Boundary

### Moment-Level Endpoints (separate from tree-level)

| Method | Endpoint | Auth | Idempotency | Public Read |
|--------|----------|------|-------------|-------------|
| GET | `/api/trees/{tree_id}/memories/{memory_id}/reactions` | No | N/A | Guest-safe aggregate |
| GET | `/api/trees/{tree_id}/memories/{memory_id}/comments` | No | N/A | Guest-safe (id/body/createdAt only) |
| GET | `/api/memories/{memory_id}/reactions` | Required | N/A | Auth passthrough |
| POST | `/api/memories/{memory_id}/reactions` | Required | Yes (Idempotency-Key) | Auth passthrough |
| GET | `/api/memories/{memory_id}/comments` | Required | N/A | Auth passthrough |
| POST | `/api/memories/{memory_id}/comments` | Required | Yes (Idempotency-Key) | Auth passthrough |
| DELETE | `/api/comments/{comment_id}` | Required | N/A | Owner/author only |

### Backend (Modal)

| Module | Key Functions | Notes |
|--------|---------------|-------|
| `modal_compute/reactions.py` | `toggle_reaction()`, `fetch_public_reaction_counts()`, `fetch_reaction_summary()` | Advisory lock, idempotency table, audit logging |
| `modal_compute/comments.py` | `create_comment()`, `fetch_public_comments()`, `soft_delete_own_comment()`, `hide_comment_by_tree_owner()` | Rate limiting (10/min/actor, 3/min/actor-memory) |
| `modal_compute/app.py` | Routes for `/modal/private/memories/{id}/reactions`, `/modal/private/memories/{id}/comments`, `/modal/public/trees/{tid}/memories/{mid}/reactions`, etc. | Public routes validate tree/memory membership |

### Client-Side

| File | Functions |
|------|-----------|
| `js/postgres-client.js` | `toggleReaction`, `fetchReactionSummary`, `createComment`, `fetchPublicMomentReactionSummary`, `fetchPublicMomentComments` |
| `js/api/base-api-fetch.js` | Generic `apiFetch()` with auth header injection, 401 retry, error normalization |

### Visibility Guard

- Public read endpoints (`/api/trees/{tree_id}/memories/...`) validate that the tree is public and the memory belongs to the tree before returning data.
- Private endpoints (`/api/memories/{memory_id}/...`) require auth and pass through to Modal's auth layer.

## 4. Guest Behavior

### Current State

- Guest users see like count and comment count rendered from public-read endpoints.
- Like button is hidden (`display:none`) or disabled.
- Guest note "로그인하면 좋아요를 남길 수 있어요." is displayed.
- Comment toggle is clickable (opens panel showing comments read-only).
- Comment composer is replaced with guest note "댓글은 읽을 수 있어요. 로그인하면 댓글을 남길 수 있어요."

### Potential 401 Noise

- Guest UI is properly gated: no unauthorized mutation calls are made.
- Public read endpoints do not require Authorization header.
- Private API methods (`toggleReaction`, `fetchReactionSummary`) are not called in guest mode due to `isAuthConfirmed` guard.

### Sign-In Affordance

- Guest notes provide descriptive text but do not include actionable sign-in links/buttons.
- Recommendation: add CTA link to login page in guest notes.

## 5. Authenticated Behavior

### Like Toggle

- **Wired**: Yes — `public-viewer-authenticated-like.js:282-379`
- **Optimistic update**: Yes — saves previous state, updates UI immediately, reconciles or rollbacks on failure
- **Write token system**: Uses `nextWriteToken` / `activeWriteToken` for stale instance detection
- **In-flight guard**: `if (inFlight) return;` prevents duplicate submission
- **Rollback**: Restores previous `aria-pressed`, count, shows error notice on failure
- **Limitation**: Only functional via `public-viewer-canvas-entry.js` auth path; hardcoded fallback in `public-canvas-init.js:251` forces guest mode

### Comment Composer

- **Wired**: Yes — `public-viewer-authenticated-comment-composer.js:52-255`
- **Composer DOM**: Dynamic — created/destroyed on panel open/close (draft state lost)
- **Idempotency**: Client generates `composerDraftIdemKey = 'c-' + Date.now().toString(36) + '-' + Math.random().toString(36).slice(2, 10)` on each submit attempt
- **In-flight guard**: `submitBtn.disabled = true; submitBtn.textContent = '등록 중...'`
- **Stale instance guard**: `instanceToken` prevents stale callback handling
- **No optimistic rendering**: Re-fetches full comment list on success via `reconcilePublicSummary()`
- **Validation**: Whitespace check before submit; error preserves input; success clears input
- **No comment deletion UI**: Backend supports `soft_delete_own_comment` but no frontend control exists

## 6. Conflict with #3188 (Tree-Level Social)

### Separation Maintained

**Existing committed artifacts (verified against `main` at `7aa8952e`)**:

- **`modal_compute/tree_likes.py:183-244`** — `toggle_tree_like()` implementation using `tree_likes` DB table and `tree_social_counts` summary table for per-tree aggregate counts.
- **`functions/api/trees/[tree_id]/likes.js`** — Cloudflare endpoint for `/api/trees/{tree_id}/likes` with `GET` and `POST` handlers (auth required). The frontend tree-level like toggle in `js/viewer/viewer-click-actions.js:16` toggles a CSS class only and does NOT call this endpoint — the endpoint exists but lacks client wiring.
- **`docs/engineering/API_CONTRACT.md` Section 5 (planned fields)** — lists `likeCount`, `reactionCount`, `bookmarkCount` as planned additive fields on tree summary, but these are NOT currently assigned in browse/tree payloads.

**Note on #3264 direction**: The generic social target migration (#3264) may rename or restructure reaction/comment tables. This audit describes the current committed state (`7aa8952e`) and does not predict post-migration schema. Moment-level and tree-level separation is source-verifiable at this commit.

| Aspect | Moment-Level (#3075) | Tree-Level (#3188) |
|--------|---------------------|-------------------|
| Database table | `reactions` (existing) | `tree_likes`, `tree_social_counts` (existing) |
| API endpoints | `/api/memories/{id}/reactions`, `/api/memories/{id}/comments` (existing) | `/api/trees/{id}/likes` (existing endpoint, no client UI wiring) |
| UI location | Detail panel `#momentReactionsCard` | Viewer shell action dock |
| Like scope | Per-moment | Per-tree |
| Comments scope | Per-moment comments (existing) | Future tree-level comments (planned) |
| Current state | Read/write implemented | Endpoint exists but frontend toggle is decorative only |

### Risk Areas

1. **Search preview social slot** (`js/search/search-share-link.js:104-105`): Reads `likeCount`, `commentCount` from tree object. These fields are not yet assigned in tree summary payloads (per API contract Section 5 — planned but not assigned). The preview always renders `—`.

2. **Old visitor viewer** (`js/visitor-viewer/visitor-viewer-panels.js:187-189`): Shows "트리 전체 댓글" panel with input field — purely cosmetic, no API backing.

3. **Comment scope**: Implementation must keep moment comments and future tree comments as separate features. Do not conflate `#momentCommentsPanel` with future tree-level comment endpoint.

## 7. Gaps

| # | Gap | Severity | Suggested Child Issue |
|---|-----|----------|----------------------|
| 1 | `public-canvas-init.js:251` hardcodes `hasConfirmedAuthSession: function() { return false; }` — never authenticates social for view.html entry | Medium | Fix auth policy override in public-canvas-init |
| 2 | Stale default text "반응 기능은 준비 중이에요." in template — overwritten in most paths but incorrect default | Low | Update template default text |
| 3 | No comment deletion UI despite backend support (`soft_delete_own_comment`, `hide_comment_by_tree_owner`) | Medium | Add comment deletion UI for author and tree owner |
| 4 | No formal API contract for reaction/comment response shapes (frontend validates defensively) | Low | Document reaction/comment response contracts |
| 5 | Search preview social counts always `—` (reads unassigned tree-level fields) | Low | Wire tree-level social counts into search preview payload |
| 6 | Auth gating bypass via `toggleReaction` / `fetchReactionSummary` on private endpoint — no `publicRead: true` flag available for fallback | Low | Add `publicRead` option to `toggleReaction` |
| 7 | Comment composer DOM destroyed on panel close (no draft persistence) | Low | Preserve comment draft across panel open/close |
| 8 | No rate limiting on reactions (comments have rate limits, reactions do not) | Medium | Add reaction rate limiting |
| 9 | No sign-in CTA link in guest notes | Low | Add login link to guest social notes |

## 8. Non-Goals

- This audit does not activate tree-level social endpoints (scoped to #3188).
- This audit does not close #1882 (Scout MVP remains a separate product track).
- This audit does not run #3264 production smoke or use production fixtures.
- This audit does not perform DB migration or schema changes.
- This audit does not deploy to Cloudflare Pages, Modal, or Vercel.
- This audit does not change Browse/My Trees visual layout.
- This audit does not change Scout.
- This audit does not close #3075 — implementation child issues must be created and completed first.

## 9. Recommended Child Issues

1. **Fix auth policy override in public-canvas-init** — Replace hardcoded `hasConfirmedAuthSession: false` with real auth policy check.
2. **Update template default text** — Replace "반응 기능은 준비 중이에요." with descriptive loading/text.
3. **Add comment deletion UI** — Wire `DELETE /api/comments/{id}` for comment author and tree owner.
4. **Document reaction/comment API contracts** — Add formal response shape specs to `API_CONTRACT.md`.
5. **Wire tree-level social counts into search preview** — Assign `likeCount`/`commentCount` in tree summary payloads.
6. **Add publicRead fallback for toggleReaction** — Ensure guest-safe fallback path if auth gate is bypassed.
7. **Preserve comment draft across panel close** — Simple localStorage or in-memory draft persistence.

## References

- #3075 — [UX][Social] Make moment likes and comments actionable in Tree Workspace view mode
- #3188 — [Social][Tree] Add tree-level likes and comments (must be kept separate)
- #3264 — [DB][Social] Apply Migration A and collect Verification Gate A evidence (handled on 컴1)
- #1882 — [PRODUCT] Explore LoveBud Scout link-based fan assistant MVP (must not close)
