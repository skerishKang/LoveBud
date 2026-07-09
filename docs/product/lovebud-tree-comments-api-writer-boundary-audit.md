# LoveBud Tree-Level Comment API / Writer Boundary Audit

> **Issue:** #3393
> **Status:** Source-only API/writer boundary audit — documentation and contract tests only
> **Parent track:** #3188 tree-level social (whole-tree comments surface)
> **Predecessors:** #3388/#3392 tree comment storage schema foundation, #3382/#3385 storage schema boundary audit, #3376/#3377 runtime/API prerequisites audit, #3378/#3381 runtime route contract
> **Surface contract:** #3372 tree-level comment surface contract
> **Moment boundary reference only:** #3075
> **Tree-like runtime reference (pattern to mirror):** #3370 tree-like `likes.js` + `modal_compute/tree_likes.py`
> **Always Refs only:** #1882

---

## 1. Purpose and posture

This document audits the **future tree-level comment API / write / read boundary** before any implementation, as the next step after the #3388/#3392 `tree_comments` schema foundation. It is the API/writer audit companion to the prior schema audit.

It answers, with evidence from current `main` (`24e1fcf`) source:

1. Where should the future tree-comment API route live?
2. Which existing social route/action shell, auth helper, idempotency helper, audit helper, and visibility helper can be reused or must be avoided?
3. What is the future write target (tree vs moment)?
4. What is the future read behavior?
5. What write prerequisites apply (auth, visibility, ownership, moderation, deletion, rate-limit, idempotency, audit)?
6. What is the safe error boundary?

### 1.1 What this document is

- An audit of the future tree comment API/write/read boundary.
- A prerequisite/reuse checklist for later tree comment implementation children.
- A boundary inventory separating tree-level (`treeId`) from moment-level (`(treeId, memoryId)`).

### 1.2 What this document is not

- Not API route implementation.
- Not writer/reader/storage helper implementation.
- Not client adapter / UI / CSS / modal / drawer implementation.
- Not SQL execution. **Not a change to the #3388 schema artifact.**
- Not Cloudflare config / Firebase / auth runtime / provider wiring change.
- Not production smoke.
- **#3370 tree-like runtime behavior is explicitly out of scope and unchanged.**
- Not a change to moment-level #3075 behavior except as an explicit scope boundary.

**Activation posture:** tree-level comment API/writer/read do not exist yet. This audit alone does **not** authorize route/writer/reader implementation.

---

## 2. Future tree-comment API route location candidates

Mirror the tree-like runtime layout (`functions/api/trees/[tree_id]/likes.js`):

| Candidate route | Method | Purpose | Pattern |
|---|---|---|---|
| `POST /api/trees/:treeId/comments` | POST | Create whole-tree comment | mirror `likes.js` POST (auth + idempotency) |
| `GET /api/trees/:treeId/comments` | GET | List whole-tree comments (public-read) | mirror `fetch_public_tree_like_count` read gate |

These are **dedicated tree-target** routes (`target_kind = 'tree'`). They must not reuse the moment comment route `functions/api/trees/[tree_id]/memories/[memory_id]/comments.js`.

---

## 3. Reuse / avoid inventory of existing social helpers

| Existing helper | Location | Reuse for tree comments? |
|---|---|---|
| Tree-like Cloudflare proxy | `functions/api/trees/[tree_id]/likes.js` | **REUSE pattern** — auth-required 401, `Idempotency-Key` required+validated for POST, safe `x-lovebud-route-status` errors |
| Tree-like writer | `modal_compute/tree_likes.py` | **REUSE pattern** — `validate_required_uuid(tree_id,"treeId")`, `require_public_tree_for_like`, advisory lock, generic idempotency, audit |
| Generic idempotency | `modal_compute/social_idempotency.py` `reserve_and_verify_idempotency_target(cur, actor_id, operation, key, target_kind, target_id, body)` | **REUSE** — already supports `target_kind='tree'`, `target_id=treeId` |
| Generic audit | `modal_compute/social_write_audit.py` `record_audit_target(cur, actor_id, target_kind, target_id, action, outcome_code, request_key_hash)` | **REUSE** — stores safe metadata only (no body/token/exception) |
| Visibility gate | `require_public_tree_for_like` (tree) | **REUSE** for tree comment write/read public gate |
| Moment comment writer | `modal_compute/comments.py` `create_comment(memory_id, ...)` | **AVOID** — memory-target; uses legacy `reserve_and_verify_idempotency(..., memory_id, ...)` and `require_memory_visible_or_owner` |
| Moment comment client | `createComment`, `fetchComments`, `fetchPublicMomentComments` | **AVOID** — memory-target adapters |

The generic (`target_kind`/`target_id`) idempotency and audit helpers were explicitly built for Gate-B-aligned tree-target writers, so a future tree comment writer should call `reserve_and_verify_idempotency_target(..., "tree", tree_id, body)` and `record_audit_target(..., "tree", tree_id, action, ...)`, **not** the legacy memory-target variants.

---

## 4. Future write target

A tree comment write must target the whole tree, never a moment:

| Field | Value |
|---|---|
| storage | `tree_comments.tree_id` (FK → `trees`) |
| generic target | `target_kind = 'tree'` |
| generic target id | `target_id = treeId` |
| separation | **no `memory_id`**; never populate legacy moment fields |

This matches the #3388 schema foundation and keeps tree comments strictly separate from selected-moment comments (`(treeId, memoryId)`) of #3075.

---

## 5. Future read behavior

- `GET /api/trees/:treeId/comments` must list **only comments where `tree_comments.tree_id = :treeId`**.
- The requested tree must be **public** (`visibility = 'public'`); non-public/private/draft trees return a hidden/blocked surface, never another tree's comments.
- Mirror `fetch_public_tree_like_count` which reads only the requested public tree and falls back to a safe zero when the aggregate row is missing.
- Never leak private/draft tree comment lists or raw DB rows to the client.

---

## 6. Future write prerequisites

| Prerequisite | State / source | Note |
|---|---|---|
| Auth | confirmed session required before POST | mirror `likes.js` 401 `Authorization required` |
| Public visibility | tree must be `public` | reuse `require_public_tree_for_like` |
| Ownership / non-owner participation | any authenticated eligible actor may comment on a public tree; owner sees own comments; owner moderation is separate | distinct from moment ownership rules |
| Moderation | tree-scoped moderation state required | separate from moment `comment.hide`/`soft_delete`; needs `tree.comment.*` audit actions added to `SAFE_ACTIONS` |
| Deletion | tree comment soft-delete required | separate `tree_comments.deleted_at`; separate from moment `comments.soft_delete` |
| Rate-limit | tree-scoped rate-limit required | `modal_compute/social_rate_limit.check_comment_rate_limits` exists for moment scope; a tree-scoped variant is a separate follow-up child |
| Duplicate / idempotency | reuse `reserve_and_verify_idempotency_target` with `target_kind='tree'`, `target_id=treeId` | prevents double-submit / replay second insert |
| Audit logging | reuse `record_audit_target(..., "tree", treeId, action, "success", request_key_hash=key_hash)` | stores SHA-256 of idempotency key, never raw key/body/token |

---

## 7. Safe error boundary

All tree comment writes/reads must follow the existing safe-error contract:

- Raise `SocialWriteError` / `HTTPException` with a `code` and safe `message` (never raw backend/auth/provider details).
- The Cloudflare proxy returns safe `x-lovebud-route-status` (e.g. `missing-authorization`, `idempotency-key-required`, `idempotency-key-invalid`, `modal-timeout`, `modal-unavailable`) and a sanitized `x-lovebud-request-id`.
- The audit log stores **only** safe metadata: `actor_id`, `target_kind`, `target_id`, `action` (from `SAFE_ACTIONS`), `outcome_code`, and `request_key_hash` (SHA-256 of the idempotency key).
- **NEVER stored/exposed:** comment body, Firebase token, Authorization header, raw exception/stack trace, full request/response payload, browser fingerprint, or IP address.

---

## 8. Separation from #3075 moment-comment route/composer

- The moment comment route `functions/api/trees/[tree_id]/memories/[memory_id]/comments.js` and writer `modal_compute/comments.py` are **memory-target only** and must not be reused for tree comments.
- The moment client adapters `createComment` / `fetchComments` / `fetchPublicMomentComments` are **memory-target only** and must not be reused.
- A future tree comment writer/reader must use the **generic** idempotency/audit helpers with `target_kind='tree'`, plus dedicated `tree.comment.*` audit actions, and a separate `tree_comments` reader.
- #3075 moment-level behavior is referenced only as a boundary; it is not modified.

---

## 9. Future child split

In order, dedicated later children:

1. **Route/write helper child** — implement `POST /api/trees/:treeId/comments` + `modal_compute/tree_comments.py` writer mirroring `tree_likes.py` (auth, public visibility, advisory lock, generic idempotency, audit). Add `tree.comment.create` / `tree.comment.create.replay` to `SAFE_ACTIONS`.
2. **Read/list helper child** — implement `GET /api/trees/:treeId/comments` reader + `fetchTreeComments(treeId)` client adapter (new, tree-target; never reuse `fetchComments`).
3. **UI surface child** — follow #3372 surface contract (header band / right hub / composer), guest read-only, no inert controls.
4. **Moderation/deletion child** — tree-scoped moderation state, soft-delete, and `tree.comment.soft_delete` / `tree.comment.hide` audit actions (separate from moment).
5. **Non-prod verification child** — controlled verification before any production visual confirmation.

**This #3393 audit satisfies none of steps 1–5 by itself.**

---

## 10. Explicit non-goals

This document and its companion contract test:

- do **not** implement API routes
- do **not** implement writer/reader/storage helpers
- do **not** implement client adapters or UI/CSS/modal/drawer
- do **not** execute SQL or change the #3388 schema artifact
- do **not** change Cloudflare config / Firebase / auth runtime / provider wiring
- do **not** run production smoke
- do **not** change Scout / #1882 implementation behavior
- do **not** change moment-level #3075 behavior beyond referencing it as a boundary
- do **not** close #3188, #3075, or #1882
- do **not** expose raw/private values in docs, tests, examples, or reports

For #1882, references must use **`Refs #1882` only**. Never use GitHub close keywords (`Closes`, `Fixes`, or `Resolves`) with issue 1882.

---

## 11. Related documents

- `docs/product/lovebud-tree-comment-storage-schema-boundary-audit.md` — storage schema boundary audit (#3382/#3385)
- `scripts/migration-add-tree-comments.sql` — tree comment schema foundation (#3388/#3392)
- `docs/product/lovebud-tree-comment-runtime-route-contract.md` — tree comment runtime route contract (#3378/#3381)
- `docs/product/lovebud-tree-comment-surface-contract.md` — tree-level comment surface contract (#3372/#3374)
- `functions/api/trees/[tree_id]/likes.js` — tree-like Cloudflare proxy (#3370, pattern)
- `modal_compute/tree_likes.py` — tree-like Modal writer (pattern)
- `modal_compute/social_idempotency.py` — generic target idempotency helper (reuse)
- `modal_compute/social_write_audit.py` — generic target audit helper (reuse)

---

## 12. Companion test

Focused source-level contract coverage lives in:

`tests/contracts/tree-comments-api-writer-boundary-audit-contract.test.cjs`

The test asserts the audit documents the future route location, helper reuse/avoid inventory, write target (`tree_comments.tree_id` / `target_kind='tree'` / `target_id=treeId` / no `memory_id`), read behavior (requested public tree only), write prerequisites, safe error boundary, #3075 separation, and future child split. It does not exercise network, browser, DB, or production runtime.
