# LoveBud Tree-Level Comment Read / List Route Contract

> **Issue:** #3404
> **Status:** Source-only route contract — documentation and contract tests only
> **Parent track:** #3188 tree-level social (whole-tree comments surface)
> **Predecessors:** #3401 tree comment read/list boundary audit, #3400 tree comment read/list boundary audit issue, #3398 tree comment create/write path (route + writer), #3396 tree comment create route/writer helper, #3394 tree comment API/writer boundary audit, #3393 writer boundary audit, #3388/#3392 tree comment storage schema foundation, #3382/#3385 storage schema boundary audit, #3376/#3377 runtime/API prerequisites audit, #3378/#3381 runtime route contract
> **Surface contract:** #3372 tree-level comment surface contract
> **Moment boundary reference only:** #3075
> **Tree-like runtime reference (pattern to mirror):** #3370 tree-like `likes.js` + `modal_compute/tree_likes.py`; for the public-read gate, mirror `fetch_public_tree_like_count`
> **Always Refs only:** #1882

---

## 1. Purpose and posture

This document defines the **dedicated tree-level comment read / list route contract** as the next step after the #3401 read/list boundary audit. The create path exists (`POST /api/trees/:treeId/comments` + `modal_compute/tree_comments.create_tree_comment`, #3398). This contract fixes, in documentation and contract tests only, what the **dedicated tree-target `GET` read/list** route must look like before any implementation child.

It answers, with evidence from current `main` (`c171e72`) source:

1. What is the future `GET /api/trees/:treeId/comments` route/method contract?
2. Where should the future Modal/Python reader/helper live?
3. What are the request parameter and response DTO contracts?
4. What is the public-tree visibility gate before returning comments?
5. How must missing / private / non-public trees behave so comment existence is never leaked?
6. What is the pagination / sorting posture?
7. What is the safe error taxonomy?
8. How is this strictly separated from #3075 moment comments?
9. What future child split follows?

### 1.1 What this document is

- A route contract for **tree-scoped** comment read/list (`target_kind = 'tree'`, `target_id = <tree UUID>`).
- A definition of safe DTO shapes, visibility/idempotency/auth boundaries (read-only), and error mapping.
- A handoff spec for later implementation children.

### 1.2 What this document is not

- Not runtime/API implementation. **No `GET` runtime is added to `comments.js`.**
- Not reader/helper implementation. **`fetch_tree_comments` is NOT implemented in this PR.** `modal_compute/tree_comments.py` is unchanged in behavior.
- Not client adapter / UI / CSS / modal / drawer implementation.
- Not SQL execution. **Not a change to the #3388 schema artifact.**
- Not Cloudflare config / Firebase / auth runtime / provider wiring change.
- Not production smoke.
- **#3370 tree-like runtime behavior is explicitly out of scope and unchanged.**
- Not a change to moment-level #3075 behavior except as an explicit scope boundary.

**Activation posture:** the tree comment read/list route does not exist yet. This contract alone does **not** authorize route/reader implementation.

---

## 2. Route / method contract

| Verb | Route | Target | Auth | Purpose |
|---|---|---|---|---|
| `GET` | `/api/trees/:treeId/comments` | `treeId` only | No mutation auth (public-read eligible) | List whole-tree comments (public-read when eligible) |

Boundary rules:

- This is a **dedicated tree-target** route (`target_kind = 'tree'`). It must **not** reuse `functions/api/trees/[tree_id]/memories/[memory_id]/comments.js` or any moment comment route.
- The future route should live in the **same `comments.js` file** as the create proxy (a sibling `GET` handler) or a separate tree-target file — either is acceptable as long as it stays `treeId`-only and does not mutate. **This contract does not implement it.**
- It is a **public-read eligible surface**: guest / signed-out reads are allowed **without** an Authorization header (the opposite of the create route, which requires confirmed auth). The read route must never send a 401 mutation-loop to guests.
- The future `GET` must **not** forward `Idempotency-Key` (idempotency is a write concern only).
- Forwarding to Modal must reuse the same `buildModalUrl` tree-id extraction so the path parameter is consistently `parts[2]` and URL-encoded.
- No mutation: the route never writes `tree_comments`, never invokes the create writer, and never requires an idempotency key.

---

## 3. Future Modal/Python reader/helper candidate

| Candidate | Location | Reuse / note |
|---|---|---|
| Reader | `modal_compute/tree_comments.fetch_tree_comments(tree_id, limit, cursor)` (new function, adjacent to `create_tree_comment`) | reuse `get_db_connection` / `run_db_with_retry` helpers; tree-target only |
| Visibility gate | `require_public_tree_for_like(tree_id)` (already in `tree_likes.py`, reused by #3398) | reuse for read public gate; non-public/missing → safe `404` |
| Route registration | `get_tree_comments` at `/modal/private/trees/{tree_id}/comments` GET in `modal_compute/app.py` | mirror the #3398 `post_tree_comment` path; auth posture (guest read, no required Authorization) is an implementation-child decision (the `/modal/private/` prefix is the existing sibling path convention, not an auth requirement) |
| Listing normalize | `normalize_public_tree_comment_row` (new, tree-target) | safe field subset; never return raw `owner_id` |

The reader must query **only** `tree_comments` where `tree_comments.tree_id = :treeId`. It must never join or read the moment `comments` table. **This candidate is documented only; it is NOT implemented in this PR.**

---

## 4. Request parameter contract

| Parameter | Required | Validation / notes |
|---|---|---|
| `treeId` | yes (path) | validated as UUID via `validate_required_uuid(tree_id, "treeId")`; invalid → `400 INVALID_TREE_ID` |
| `limit` | optional | positive integer; clamped to safe bounds (recommend default `20`, min `1`, max `50`); invalid → `400 INVALID_PAGINATION` |
| `cursor` | optional, **not adopted in this contract** | IF a future implementation adopts cursor pagination, it must be an **opaque, server-issued, non-leaking token** (no raw offset / DB-row / primary-key exposure). This contract keeps pagination **limit-only**; `nextCursor` is therefore absent from the response unless a later implementation child adopts cursor pagination. |

The `cursor` parameter is documented as a candidate but is **not adopted** by this contract (limit-only chosen to mirror the existing moment-read convention). Should a future child adopt it, the opaque/non-leaking rule above is binding.

---

## 5. Response DTO

A bounded list of safe comment records:

```text
treeCommentList:
- comments: array<treeCommentListItem>   # bounded by limit
- nextCursor: string | null               # present only if cursor pagination is adopted (absent in this contract)

treeCommentListItem:
- id: string                 # comment UUID
- treeId: string (UUID)      # tree-target identity only
- body: string               # bounded, validated comment text
- createdAt: string          # ISO-8601
- updatedAt: string          # ISO-8601
- authorDisplayLabel: string # anonymous-safe public display metadata (never raw ownerId)
```

Required safe fields: `id`, `treeId`, `body`, `createdAt`, `updatedAt`, `authorDisplayLabel`. The list payload is **bounded** (never unbounded) and the returned records carry only safe fields:

- no raw account identifiers (`ownerId` / `owner_id` is replaced by `authorDisplayLabel`)
- no `target_kind`/`target_id` internals
- no audit rows, moderation flags, or write metadata in the public read shape unless a separate moderation/visibility contract adds them
- `nextCursor` is present only if cursor pagination is adopted (absent here)

---

## 6. Public-tree visibility gate

- The read path must validate **tree** publicity only (not moment membership), mirroring `require_public_tree_for_like` and `fetch_public_tree_like_count`.
- If the tree is **public and comment-eligible**, return the bounded comment list.
- If the tree is **private / draft / missing / non-public**, the request must be answered with a **hidden/blocked** outcome and must **not** reveal whether comments exist.

The contraction reuses the same safe `404 Tree not found` posture as the write path: a non-public tree returns the same safe not-found as a missing tree, so comment existence is never leaked across the public/private boundary.

---

## 7. Non-leaking not-found / private behavior

To avoid leaking comment existence or tree privacy state:

- **Missing tree** and **private/non-public tree** collapse to the **same safe response** (no existence leak). Both return the same `404 Tree not found` (or same hidden/blocked surface) so a caller cannot distinguish "tree exists but private" from "tree does not exist".
- The response must never include:
  - raw backend errors / exception text
  - DB rows / raw query output
  - account identifiers unless explicitly safe/public (raw `ownerId` is excluded)
  - auth headers / tokens
  - request/response bodies verbatim
  - private logs
  - screenshots
- Transport metadata (`x-lovebud-route-status`, sanitized `x-lovebud-request-id`) is safe, non-private output only.

---

## 8. Pagination / sorting posture (resolved)

- **Pagination:** **limit-only** (default `20`, clamped `1..50`). Cursor pagination is **not adopted** in this contract. If a future implementation child adopts cursor pagination, the token must be opaque and non-leaking (§4).
- **Sorting:** **oldest-first** (`ORDER BY created_at ASC`). This mirrors the existing moment comment public-read convention (`modal_compute/comments.fetch_public_comments` / `fetch_comments` use `created_at ASC`) for consistency and stable, chronological surfacing of whole-tree discussion.
- **Stable ordering:** within a page, ordering is by `created_at ASC`, then by `id ASC` as a deterministic tiebreaker so the list is stable and reproducible.

These decisions are resolved in this contract (the #3401 audit left them open; this contract closes them as limit-only + oldest-first).

---

## 9. Safe error taxonomy

| Condition | Safe HTTP | Safe code / status |
|---|---|---|
| Invalid tree id (not UUID / missing) | `400` | `INVALID_TREE_ID` |
| Invalid pagination (`limit` out of range / bad `cursor`) | `400` | `INVALID_PAGINATION` |
| Not found / private / non-public | `404` | `Tree not found` (collapse, no existence leak) |
| Upstream unavailable | `503` | `modal-unavailable` (`x-lovebud-upstream: modal`) |
| Upstream timeout | `504` | `modal-timeout` (`x-lovebud-upstream: modal`) |
| Unexpected failure | `500` (safe) | generic safe failure; no raw detail |

All errors are product-safe: no raw backend/auth/provider details, no DB rows, no token/header, no stack trace. The Cloudflare proxy returns safe `x-lovebud-route-status` and a sanitized `x-lovebud-request-id`.

---

## 10. Strict separation from #3075 moment comments

- The moment comment route `functions/api/trees/[tree_id]/memories/[memory_id]/comments.js` and writer/reader `modal_compute/comments.py` are **memory-target only** (`(treeId, memoryId)`) and must not be reused for tree comments.
- The moment client adapters `createComment` / `fetchComments` / `fetchPublicMomentComments` are **memory-target only** and must not be reused.
- A future tree comment reader must use the **generic** tree-target `tree_comments` table and a separate `fetch_tree_comments(treeId)` reader, never the moment `comments` table or `fetch_comments`.
- **No `memory_id`** appears anywhere in the tree comment read path.
- #3075 moment-level behavior is referenced only as a boundary; it is not modified.

---

## 11. No raw/private response

The read/list surface, docs, tests, examples, and reports must never include:

- raw backend errors / exception text
- DB rows / raw query output
- account identifiers unless explicitly safe/public (raw `ownerId` is excluded)
- auth headers / tokens / cookies
- request/response bodies verbatim
- private logs
- screenshots
- Cloudflare preview / dashboard URLs, API base URLs

Transport metadata such as `x-lovebud-route-status` and a sanitized `x-lovebud-request-id` are safe, non-private output only.

---

## 12. Future child split

In order, dedicated later children:

1. **Read/list implementation** — implement `GET /api/trees/:treeId/comments` + `fetch_tree_comments` reader (new, tree-target; never reuse `fetchComments`); reuse `require_public_tree_for_like`; honor this contract's request/response/error/pagination/sorting rules.
2. **Client/UI integration** — `fetchTreeComments(treeId)` client adapter (new, tree-target) + surface list per #3372; guest read-only, no inert controls.
3. **Moderation/deletion** — tree-scoped moderation state, soft-delete, and `tree.comment.soft_delete` / `tree.comment.hide` audit actions (separate from moment).
4. **Non-prod verification** — controlled verification before any production visual confirmation.
5. **Production activation** — only after separate explicit approval (not this contract).

**This #3404 contract satisfies none of steps 1–5 by itself.**

---

## 13. Explicit non-goals

This document and its companion contract test:

- do **not** implement the `GET`/read/list route runtime
- do **not** implement `fetch_tree_comments` or any reader/helper
- do **not** change `functions/api/trees/[tree_id]/comments.js` runtime behavior (stays POST/create-focused)
- do **not** change `modal_compute/tree_comments.py` runtime behavior
- do **not** change `modal_compute/app.py` runtime behavior (no GET tree-comments registration added)
- do **not** implement client adapters or UI/CSS/modal/drawer
- do **not** integrate Tree Workspace
- do **not** implement moderation/deletion/notification/ranking/sorting UI
- do **not** change Scout files
- do **not** change #1882 implementation behavior
- do **not** change moment-level #3075 behavior beyond referencing it as a boundary
- do **not** change DB schema / migration
- do **not** execute production/staging SQL
- do **not** run production smoke
- do **not** close #3188, #3075, or #1882
- do **not** expose raw/private values in docs, tests, examples, or reports

For #1882, references must use **`Refs #1882` only**. Never use GitHub close keywords (`Closes`, `Fixes`, or `Resolves`) with issue 1882.

---

## 14. Related documents

- `docs/product/lovebud-tree-comments-read-list-boundary-audit.md` — read/list boundary audit (#3401, #3400)
- `docs/product/lovebud-tree-comments-api-writer-boundary-audit.md` — writer boundary audit (#3394)
- `functions/api/trees/[tree_id]/comments.js` — #3398 / #3396 create route (POST-focused, source-only referenced)
- `modal_compute/tree_comments.py` — #3398 / #3396 writer `create_tree_comment` (source-only referenced)
- `docs/product/lovebud-tree-comment-runtime-route-contract.md` — tree comment runtime route contract (#3378/#3381)
- `docs/product/lovebud-tree-comment-runtime-api-prerequisites-audit.md` — runtime/API prerequisites audit (#3376/#3377)
- `docs/product/lovebud-tree-comment-storage-schema-boundary-audit.md` — storage schema boundary audit (#3382/#3385)
- `scripts/migration-add-tree-comments.sql` — tree comment schema foundation (#3388/#3392)
- `modal_compute/comments.py` — moment comment writer/reader (boundary reference only, NOT reused)

---

## 15. Companion test

Focused source-level contract coverage lives in:

`tests/contracts/tree-comments-read-list-route-contract.test.cjs`

The test asserts the route/method contract (GET, public-read, no mutation), reader/helper candidate (`fetch_tree_comments` documented, not implemented), request parameters (`treeId` UUID, bounded `limit`, optional non-leaking `cursor`), response DTO safe fields (`id`, `treeId`, `body`, `createdAt`, `updatedAt`, `authorDisplayLabel`, optional `nextCursor`), public-tree visibility gate, non-leaking not-found/private posture, resolved pagination/sorting (limit-only, oldest-first), safe error taxonomy, strict #3075 moment-comment separation, and that `comments.js` remains POST/create-focused with no GET handler, `tree_comments.py` has no `fetch_tree_comments` reader, and `app.py` has no GET tree-comments registration. It does not exercise network, browser, DB, or production runtime.
