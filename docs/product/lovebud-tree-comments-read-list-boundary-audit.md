# LoveBud Tree-Level Comment Read / List Boundary Audit

> **Issue:** #3400
> **Status:** Source-only read/list boundary audit — documentation and contract tests only
> **Parent track:** #3188 tree-level social (whole-tree comments surface)
> **Predecessors:** #3396 tree comment create route/writer helper, #3398 tree comment create/write path (route + writer), #3394 tree comment API/writer boundary audit, #3393 writer boundary audit, #3388/#3392 tree comment storage schema foundation, #3382/#3385 storage schema boundary audit, #3376/#3377 runtime/API prerequisites audit, #3378/#3381 runtime route contract
> **Surface contract:** #3372 tree-level comment surface contract
> **Moment boundary reference only:** #3075
> **Tree-like runtime reference (pattern to mirror):** #3370 tree-like `likes.js` + `modal_compute/tree_likes.py`; for the public-read gate, mirror `fetch_public_tree_like_count`
> **Always Refs only:** #1882

---

## 1. Purpose and posture

This document audits the **future tree-level comment read / list boundary** as the next step after the #3398 create/write path. The create path exists (`POST /api/trees/:treeId/comments` + `modal_compute/tree_comments.create_tree_comment`). This audit fixes, in documentation and contract tests only, what the **dedicated tree-target read/list** boundary must look like before any implementation child.

It answers, with evidence from current `main` (`10cf52d4`) source:

1. What is the current #3398 create/write convention to mirror and never break?
2. Where should the future `GET /api/trees/:treeId/comments` route live?
3. Where should the future Modal/Python reader/helper live?
4. What public-tree visibility gate must run before returning comments?
5. How must missing / private / non-public trees behave so comment existence is never leaked?
6. What request parameters and response shape are safe?
7. What is the pagination / sorting posture (and what remains unresolved)?
8. What is the safe error taxonomy?
9. How is this strictly separated from #3075 moment comments?
10. What future child split follows?

### 1.1 What this document is

- An audit of the future tree comment read/list boundary.
- A prerequisite/reuse checklist for later tree comment read/list implementation children.
- A boundary inventory separating tree-level (`treeId`) from moment-level (`(treeId, memoryId)`).

### 1.2 What this document is not

- Not API route implementation. **No `GET` runtime is added to `comments.js`.**
- Not reader/helper implementation. **`modal_compute/tree_comments.py` is unchanged in behavior.**
- Not client adapter / UI / CSS / modal / drawer implementation.
- Not SQL execution. **Not a change to the #3388 schema artifact.**
- Not Cloudflare config / Firebase / auth runtime / provider wiring change.
- Not production smoke.
- **#3370 tree-like runtime behavior is explicitly out of scope and unchanged.**
- Not a change to moment-level #3075 behavior except as an explicit scope boundary.

**Activation posture:** tree-level comment read/list does not exist yet. This audit alone does **not** authorize route/reader implementation.

---

## 2. Current #3398 create/write convention (source-check)

The create path (`10cf52d4`, PR #3398) established the following tree-target write contract, which the read/list boundary must respect and never break:

| Concern | #3398 create convention | Source |
|---|---|---|
| Route file | `functions/api/trees/[tree_id]/comments.js` | POST-focused proxy; non-POST → `405 method-not-allowed`, `allow: 'POST'` |
| Method posture | POST only; no GET handler exposed | `comments.js:57` `buildMethodNotAllowedResponse(requestId)` with `allow: 'POST'`; `onRequestPost` / `onRequest` both call `proxyTreeCommentCreate` which early-returns 405 for non-POST |
| Auth | confirmed Authorization header required before write → `401 missing-authorization` | `comments.js:17`, `:128` |
| Idempotency | `Idempotency-Key` required (`400 IDEMPOTENCY_KEY_REQUIRED`) and validated (`400 IDEMPOTENCY_KEY_INVALID`, `^[A-Za-z0-9._:-]{8,128}$`) | `comments.js:70`, `:139-142` |
| Visibility gate | `require_public_tree_for_like(tree_id)` before write; non-public/missing tree → safe `404 Tree not found` | `tree_comments.py:62` |
| Storage target | `tree_comments` only; `target_kind='tree'`, `target_id=tree_id`; **no `memory_id`** | `tree_comments.py:106-114` |
| Writer | `create_tree_comment(tree_id, owner_id, body, idempotency_key)` | `tree_comments.py:32` |
| Safe DTO | `normalize_tree_comment_row` returns `id, treeId, ownerId, body, createdAt, updatedAt` | `tree_comments.py:21-29` |
| Audit | `record_audit_target(..., 'tree', tree_id, 'tree.comment.create', 'success', request_key_hash=sha256(key))` | `tree_comments.py:124-129` |
| Modal route | `POST /modal/private/trees/{tree_id}/comments` → `create_tree_comment` | `app.py` (post #3398) |

The read/list audit explicitly does **not** change any of the above. The create route stays POST/create-focused; read/list is a separate implementation child.

---

## 3. Future `GET /api/trees/:treeId/comments` route boundary candidate

Mirror the dedicated tree-target layout from #3378 and the already-merged create route:

| Candidate route | Method | Purpose | Pattern |
|---|---|---|---|
| `GET /api/trees/:treeId/comments` | GET | List whole-tree comments (public-read when eligible) | dedicated `treeId`-only route; public-tree gate; safe errors; no `memoryId` segment |

Boundary rules for the future route:

- It is a **dedicated tree-target** route (`target_kind = 'tree'`). It must **not** reuse `functions/api/trees/[tree_id]/memories/[memory_id]/comments.js` or any moment comment route.
- The future route should live in the **same `comments.js` file** as the create proxy (sibling `GET` handler), or a separate tree-target file — either is acceptable as long as it stays `treeId`-only and does not mutate. **This audit does not implement it.**
- Guest / signed-out read must be allowed **without** an Authorization header (read-only public surface). This is the opposite auth posture from the create route and must be intentional.
- The future `GET` must **not** forward `Idempotency-Key` (idempotency is a write concern only).
- Forwarding to Modal must use the same `buildModalUrl` tree-id extraction so the path parameter is consistently `parts[2]` and URL-encoded.

---

## 4. Future Modal/Python reader/helper location candidate

| Candidate | Location | Reuse / note |
|---|---|---|
| Reader | `modal_compute/tree_comments.fetch_tree_comments(tree_id, limit, cursor)` (new function, adjacent to `create_tree_comment`) | reuse `get_db_connection` / `run_db_with_retry` helpers; tree-target only |
| Visibility gate | `require_public_tree_for_like(tree_id)` (already in `tree_likes.py`, reused by #3398) | reuse for read public gate; non-public/missing → safe `404` |
| Route registration | `get_tree_comments` at `/modal/private/trees/{tree_id}/comments` GET in `modal_compute/app.py` | mirror the #3398 `post_tree_comment` path; auth posture (guest read, no required Authorization) is an implementation-child decision (the `/modal/private/` prefix is the existing sibling path convention, not an auth requirement) |
| Listing normalize | `normalize_public_tree_comment_row` (new, tree-target) | safe field subset; never return raw `owner_id` |

The reader must query **only** `tree_comments` where `tree_comments.tree_id = :treeId`. It must never join or read the moment `comments` table.

---

## 5. Public-tree visibility gate before returning comments

- The read path must validate **tree** publicity only (not moment membership), mirroring `require_public_tree_for_like` and `fetch_public_tree_like_count`.
- If the tree is **public and comment-eligible**, return the bounded comment list.
- If the tree is **private / draft / missing / non-public**, the request must be answered with a **hidden/blocked** outcome and must **not** reveal whether comments exist. The implementation child chooses the exact HTTP mapping, but the boundary rule is: a non-public tree must never return another tree's comments and must never signal "this tree has N comments but is private".

---

## 6. Non-leaking not-found / private posture

To avoid leaking comment existence or tree privacy state:

- **Missing tree** and **private/non-public tree** must collapse to the **same safe response** (no existence leak). Specifically, both return the same `404 Tree not found` (or same hidden/blocked surface) so a caller cannot distinguish "tree exists but private" from "tree does not exist".
- The response must never include:
  - raw backend errors / exception text
  - DB rows / raw query output
  - account identifiers unless explicitly safe/public
  - auth headers / tokens
  - request/response bodies verbatim
  - private logs
  - screenshots
- Transport metadata (`x-lovebud-route-status`, sanitized `x-lovebud-request-id`) is safe, non-private output only.

---

## 7. Request parameters

| Parameter | Required | Notes |
|---|---|---|
| `treeId` | yes | path segment `parts[2]`; validated as UUID; invalid → `400 INVALID_TREE_ID` |
| `cursor` | optional | opaque, stable pagination cursor. **UNRESOLVED** — current moment comment reads (`fetch_public_comments`, `fetch_comments`) use `limit`-only with no cursor; introducing a cursor for tree comments does not match the current moment-read convention. Final cursor format/encoding is left to the implementation child. |
| `limit` | optional | positive integer bounded (recommend clamp to a safe max, e.g. `1..50`, default `20`). Matches the current `limit`-based moment-read convention. Invalid → `400 INVALID_PAGINATION`. |

The `cursor` parameter is documented as a candidate but explicitly **UNRESOLVED** because it does not align with the existing limit-only moment-read convention. The implementation child must decide whether to adopt offset/limit, keyset cursor, or keep limit-only.

---

## 8. Response shape (safe fields only)

A bounded list of safe comment records:

```text
treeCommentList:
- id: string                 # comment UUID
- treeId: string (UUID)      # tree-target identity only
- body: string               # bounded, validated comment text
- createdAt: string          # ISO-8601
- updatedAt: string          # ISO-8601
- authorDisplayLabel: string # anonymous-safe public display metadata (see §9)
```

Required safe fields (per task): `id`, `treeId`, `body`, `createdAt`, `updatedAt`. The list payload is bounded (no unbounded return) and includes a stable `nextCursor` only if the implementation child adopts cursor pagination; with limit-only it returns a fixed page.

No raw account identifiers, no `target_kind`/`target_id` internals, no audit rows, no moderation flags in the public read shape unless a separate moderation/visibility contract adds them.

---

## 9. Commenter identity policy

The #3398 writer's `normalize_tree_comment_row` returns a raw `ownerId` (`tree_comments.py:25`). The **read/list surface must NOT return that raw `ownerId` to clients.** Policy:

- The read list returns **`authorDisplayLabel`** — a public, display-only metadata label (anonymous-safe, e.g. a stable display name or an anonymous/deferred placeholder).
- Raw `ownerId` / account identifier is **replaced** by `authorDisplayLabel`; it is never exposed in the response.
- If a public display label is unavailable, the record uses a **hidden/deferred** placeholder rather than leaking the raw account id.

This aligns with the #3378 route contract (`authorDisplayLabel`, "never raw account IDs").

---

## 10. Pagination / sorting posture

- **Sorting:** unresolved as a final decision. The current moment comment reads use `ORDER BY created_at ASC` (oldest-first). For tree comments, the choice between **newest-first** and **oldest-first** is left to the implementation child; this audit recommends mirroring the moment convention (oldest-first) for consistency but marks it **UNRESOLVED** to stay within audit-only scope.
- **Stable cursor rule:** unresolved. If a cursor is adopted, it must be an opaque, server-issued, stable token (no raw offset/DB-row exposure) and must produce stable ordering across pages. Until the implementation child decides pagination mechanics (§7), the stable cursor rule is unresolved.

---

## 11. Safe error taxonomy

| Condition | Safe HTTP | Safe code / status |
|---|---|---|
| Invalid tree id (not UUID / missing) | `400` | `INVALID_TREE_ID` |
| Not found / private / non-public | `404` | `Tree not found` (collapse, no existence leak) |
| Invalid pagination (limit out of range / bad cursor) | `400` | `INVALID_PAGINATION` |
| Backend unavailable / timeout | `503` / `504` | `modal-unavailable` / `modal-timeout` (`x-lovebud-upstream: modal`) |

All errors are product-safe: no raw backend/auth/provider details, no DB rows, no token/header, no stack trace. The Cloudflare proxy returns safe `x-lovebud-route-status` and a sanitized `x-lovebud-request-id`.

---

## 12. Strict separation from #3075 moment comments

- The moment comment route `functions/api/trees/[tree_id]/memories/[memory_id]/comments.js` and writer `modal_compute/comments.py` are **memory-target only** (`(treeId, memoryId)`) and must not be reused for tree comments.
- The moment client adapters `createComment` / `fetchComments` / `fetchPublicMomentComments` are **memory-target only** and must not be reused.
- A future tree comment reader must use the **generic** tree-target `tree_comments` table and a separate `fetch_tree_comments(treeId)` reader, never the moment `comments` table or `fetch_comments`.
- #3075 moment-level behavior is referenced only as a boundary; it is not modified.

---

## 13. No raw/private response

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

## 14. Future child split

In order, dedicated later children:

1. **Read/list contract** — finalize response DTO, pagination/sorting decision (resolve §7/§10), error mapping (this audit is the prerequisite).
2. **Read/list implementation** — implement `GET /api/trees/:treeId/comments` + `fetch_tree_comments` reader (new, tree-target; never reuse `fetchComments`); reuse `require_public_tree_for_like`.
3. **UI/client integration** — `fetchTreeComments(treeId)` client adapter (new, tree-target) + surface composer/list per #3372; guest read-only, no inert controls.
4. **Moderation/deletion** — tree-scoped moderation state, soft-delete, and `tree.comment.soft_delete` / `tree.comment.hide` audit actions (separate from moment).
5. **Non-prod verification** — controlled verification before any production visual confirmation.

**This #3400 audit satisfies none of steps 1–5 by itself.**

---

## 15. Explicit non-goals

This document and its companion contract test:

- do **not** implement the `GET`/read/list route runtime
- do **not** change `functions/api/trees/[tree_id]/comments.js` runtime behavior (stays POST/create-focused)
- do **not** change `modal_compute/tree_comments.py` runtime behavior
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

## 16. Related documents

- `docs/product/lovebud-tree-comments-api-writer-boundary-audit.md` — writer boundary audit (#3394)
- `functions/api/trees/[tree_id]/comments.js` + `modal_compute/tree_comments.py` — #3396 / #3398 create route + writer helper (source-only referenced)
- `functions/api/trees/[tree_id]/comments.js` — #3398 create route (POST-focused, source-only referenced)
- `modal_compute/tree_comments.py` — #3398 writer `create_tree_comment` (source-only referenced)
- `docs/product/lovebud-tree-comment-runtime-route-contract.md` — tree comment runtime route contract (#3378/#3381)
- `docs/product/lovebud-tree-comment-runtime-api-prerequisites-audit.md` — runtime/API prerequisites audit (#3376/#3377)
- `docs/product/lovebud-tree-comment-storage-schema-boundary-audit.md` — storage schema boundary audit (#3382/#3385)
- `scripts/migration-add-tree-comments.sql` — tree comment schema foundation (#3388/#3392)
- `modal_compute/social_write_audit.py` — generic target audit helper (reuse)
- `modal_compute/comments.py` — moment comment writer/reader (boundary reference only, NOT reused)

---

## 17. Companion test

Focused source-level contract coverage lives in:

`tests/contracts/tree-comments-read-list-boundary-audit-contract.test.cjs`

The test asserts the audit documents the #3398 create convention, future `GET` route boundary candidate, future reader/helper candidate, public-tree visibility gate, non-leaking not-found/private posture, request parameters (including the unresolved `cursor`), safe response fields, commenter identity policy (`authorDisplayLabel`, not raw `ownerId`), pagination/sorting posture (or explicit unresolved), safe error taxonomy, strict #3075 moment-comment separation, no Scout behavior, and no runtime read/list implementation in this child. It also source-checks that the existing #3398 create route remains POST/create-focused and that this PR does not implement GET/list runtime behavior. It does not exercise network, browser, DB, or production runtime.
