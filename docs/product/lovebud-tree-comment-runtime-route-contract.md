# LoveBud Tree-Level Comment Runtime Route Contract

> **Issue:** #3378
> **Status:** Source-only route contract — documentation and contract tests only
> **Parent track:** #3188 tree-level social (whole-tree comments surface)
> **Audit predecessors:** #3376 tree comment runtime/API prerequisites audit, #3377 base refresh
> **Surface contract:** #3372 tree-level comment surface contract
> **Prior contract PR:** #3374 (merged `e89c2b31`)
> **Moment boundary reference only:** #3075
> **Tree-like runtime reference (unchanged):** #3370 tree-like `likes.js` activation
> **Always Refs only:** #1882

---

## 1. Purpose and posture

This document defines the **dedicated tree-level comment runtime route contract** as the next step after the #3376/#3377 audit. It fixes, in documentation and contract tests only, what dedicated tree-target read and create routes must look like before any implementation.

### 1.1 What this document is

- A route contract for **tree-scoped** comment endpoints (`target_kind = 'tree'`, `target_id = <tree UUID>`).
- A definition of safe DTO shapes, auth/visibility/idempotency/rate-limit boundaries, and error mapping.
- A handoff spec for later implementation children.

### 1.2 What this document is not

- Not runtime/API implementation.
- Not `functions/api/**` route file creation.
- Not client adapter or API call implementation.
- Not UI implementation.
- Not CSS or layout change.
- Not DB schema / migration / apply.
- Not Modal/Cloudflare/Firebase/auth/provider/production change.
- Not production smoke.
- **#3370 tree-like runtime behavior is explicitly out of scope and unchanged.**
- Not a change to moment-level #3075 behavior except as an explicit scope boundary.

**Activation posture:** the tree comment routes do not exist yet. This contract alone does **not** authorize route implementation, runtime change, or DB change.

---

## 2. Dedicated tree-target routes

| Verb | Route | Target | Purpose |
|---|---|---|---|
| `GET` | `/api/trees/:treeId/comments` | `treeId` only | List whole-tree comments (public-read when eligible) |
| `POST` | `/api/trees/:treeId/comments` | `treeId` only | Create a whole-tree comment (authenticated eligible) |

These are **dedicated tree-target** routes. There must be no `memoryId` segment in the tree comment path.

Equivalent dedicated tree-target routes are acceptable only if they preserve `targetScope: "tree"` and `treeId`-only targeting. The contract forbids overloading moment routes.

---

## 3. `targetScope: "tree"` semantics

Every tree comment request and response must carry `targetScope: "tree"` (or equivalent tree-target semantics). This is the hard separator from moment comments:

| Scope | Target key | Product meaning |
|---|---|---|
| **Tree-level comments** (this contract) | `treeId` only | Discussion about the full public LoveTree |
| **Selected-moment comments** (#3075) | `(treeId, memoryId)` | Comment on one selected moment/node |

A tree comment must never reuse moment DOM IDs, moment client adapters, or moment API paths as if they were tree-scoped.

---

## 4. Moment route/adapter reuse forbidden

The following existing moment-target surfaces must **not** be reused for tree-level comments:

| Existing | Target | Why reuse is forbidden |
|---|---|---|
| `POST /memories/:memoryId/comments` (`createComment`) | `(treeId, memoryId)` moment | Would create a **moment** comment, not a whole-tree comment |
| `GET /api/trees/:treeId/memories/:memoryId/comments` | `(treeId, memoryId)` moment | Would read **moment** comments; not whole-tree |
| `fetchComments(memoryId)` | moment | Wrong target key |
| `fetchPublicMomentComments(treeId, memoryId)` | moment | Wrong target key |
| `createComment(memoryId, body, idempotencyKey)` | moment | Wrong target key |

Tree comments require **separate tree-target endpoints** and separate client readers/writers (`fetchTreeComments(treeId)`, `createTreeComment(treeId, body, idempotencyKey)`) introduced in a later client adapter child.

---

## 5. Visibility boundary: public vs private/draft/non-public

| Tree state | Tree comment read/list | Tree comment create |
|---|---|---|
| Public tree, comment feature ready | Read list (public-read gate) | Eligible authenticated write |
| Private / draft / missing / non-public | Hidden/blocked; no existence leak via distinct private error copy when product policy requires `not found` equivalence | Hidden/blocked |

The read route must validate **tree** publicity only (not moment membership). If the tree is not public/comment-eligible, the client must treat the outcome as **hidden/blocked** rather than rendering a private tree comment panel.

Public guest reads must not require mutation auth and must not return private account fields, raw DB rows, tokens, audit rows, or internal exception text.

---

## 6. Guest read-only and authenticated write gating

| Actor | Tree comment read | Tree comment write |
|---|---|---|
| Guest / signed-out | Read-only when public tree + feature ready | Hidden / not mounted; no 401 mutation loops |
| Authenticated eligible visitor | Read-only load + empty/error states | Eligible when public tree + write path verified |
| Authenticated owner on public tree | Same read list | Same composer eligibility; owner moderation controls are **future separate contract** |
| Any actor on private/draft/non-public tree | Hidden/blocked | Hidden/blocked |

**Write gate prerequisite:** the `POST /api/trees/:treeId/comments` route must require a confirmed Authorization header before mutating, returning a safe `401 Authorization required` (mirroring the #3370 `likes.js` proxy), and must never send unauthenticated mutation calls from guest UI.

---

## 7. Idempotency-key requirement (create)

The future `POST` route must adopt the same idempotency requirement and key validation as the #3370 tree-like `likes.js` proxy:

- missing `Idempotency-Key` → `400 IDEMPOTENCY_KEY_REQUIRED`
- invalid key (not `^[A-Za-z0-9._:-]{8,128}$`) → `400 IDEMPOTENCY_KEY_INVALID`
- valid key → forwarded unchanged to the upstream tree comment writer

This prevents duplicate tree comments from repeated rapid submits. This contract does **not** implement it; it records the requirement.

---

## 8. Tree-scoped rate-limit prerequisite

The tree comment write path does not yet exist, so no tree-scoped comment rate-limit exists. Before write activation, a **tree-scoped rate-limit boundary** (per `treeId` / per actor) must be defined so comment creation cannot be abused. This is a separate follow-up child; this contract does not implement rate limiting.

---

## 9. Safe DTO shapes

```text
treeCommentSummary:
- treeId: string (UUID)           # identity only; not shown as raw UI chrome
- commentCount: integer >= 0      # authoritative aggregate when present
- commentsFeatureReady: boolean   # explicit readiness if needed

treeCommentListItem:
- id: string
- targetScope: "tree"
- body: string
- createdAt: string
- authorDisplayLabel: string | anonymous-safe label

treeCommentMutationResult:
- id: string
- targetScope: "tree"
- body: string
- createdAt: string
- authorDisplayLabel: string | anonymous-safe label
```

Every tree comment DTO must carry `targetScope: "tree"` and a safe `authorDisplayLabel` (never raw account IDs). Optimistic counts must reconcile to the authoritative safe DTO after settle.

---

## 10. Safe error mapping

| Backend/safe category | HTTP/UI mapping |
|---|---|
| Unauthenticated | `401 Authorization required`; guest read-only; no raw 401 body in UI |
| Not public / not found | Hidden or blocked comment surface |
| Idempotency key invalid/reused | `400 IDEMPOTENCY_KEY_*`; safe retry/guidance; no raw code dump |
| Rate limited / write unavailable | Safe retry later message |
| Validation failure | Field-level safe copy |
| Unknown failure | Generic safe failure + rollback for composer |

**No raw backend errors in UI.** Map to product-safe messages only.

---

## 11. No raw/private value exposure

Docs, tests, examples, and reports must never include raw/private IDs, tokens, cookies, Authorization headers, API base URLs, dashboard URLs, DB rows, request/response bodies, private logs, or screenshots. Transport metadata such as `x-lovebud-route-status` and a sanitized `x-lovebud-request-id` are safe, non-private output only.

---

## 12. #3370 tree-like runtime boundary (pattern only, unchanged)

This contract references `functions/api/trees/[tree_id]/likes.js` (#3370) only as the **pattern to mirror** for the future tree comment proxy. It:

- does **not** modify `likes.js`
- does **not** change tree-like like behavior
- does **not** add comments behavior to the tree-like runtime

The tree-like runtime remains exactly as activated in #3370 / #3374 / #3377.

---

## 13. Future implementation handoff

Dedicated later children, in order:

1. **Runtime route child** — implement `GET`/`POST /api/trees/:treeId/comments` with auth, visibility, idempotency, rate-limit, and safe errors (mirroring #3370 `likes.js`).
2. **DB/schema child** — if comment storage requires new tree-target tables/columns, a migration child (separate from moment comment schema).
3. **Client adapter child** — `fetchTreeComments(treeId)` and `createTreeComment(treeId, body, idempotencyKey)` (new, tree-target; never reusing `fetchComments`/`createComment`).
4. **UI child** — follow the #3372 surface contract (header band / right hub / composer), guest read-only, no inert controls.
5. **Non-prod verification child** — controlled verification before any production visual confirmation.

**This #3378 contract satisfies none of steps 1–5 by itself.**

---

## 14. Explicit non-goals

This document and its companion contract test:

- do **not** implement runtime/API or create `functions/api/**` route files
- do **not** implement client adapters or API calls
- do **not** implement UI, CSS, or layout
- do **not** apply DB migrations
- do **not** run production smoke or use fixtures
- do **not** activate tree writers
- do **not** change Browse / My Trees / Editor / Scout / Hermes active behavior
- do **not** change moment-level #3075 behavior beyond referencing it as a boundary
- do **not** close #3188, #3075, or #1882
- do **not** expose raw/private values in docs, tests, examples, or reports

For #1882, references must use **`Refs #1882` only**. Never use GitHub close keywords (`Closes`, `Fixes`, or `Resolves`) with issue 1882.

---

## 15. Related documents

- `docs/product/lovebud-tree-comment-runtime-api-prerequisites-audit.md` — prerequisites audit (#3376/#3377)
- `docs/product/lovebud-tree-comment-surface-contract.md` — tree-level comment surface contract (#3372 / #3374)
- `docs/product/lovebud-tree-social-client-surface-contract.md` — whole-tree social client surface overview (#3356)
- `docs/product/lovebud-tree-target-runtime-hardening-boundary.md` — tree-target runtime hardening boundary (#3355)
- `docs/product/lovebud-authenticated-moment-comment-write-boundary-audit.md` — moment comment write boundary (#3075 gate)

---

## 16. Companion test

Focused source-level contract coverage lives in:

`tests/contracts/tree-comment-runtime-route-contract.test.cjs`

The test asserts dedicated tree read/create route semantics, `targetScope: "tree"`, moment route/adapter reuse forbidden, visibility/guest/auth gating, idempotency and rate-limit prerequisites, safe DTO/error/no-raw-output rules, #3370 pattern-only boundary, implementation handoff, and forbidden-boundary language. It does not exercise network, browser, DB, or production runtime.
