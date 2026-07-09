# LoveBud Tree-Level Comment Runtime/API Prerequisites Audit

> **Issue:** #3376
> **Status:** Source-only audit — documentation and contract tests only
> **Parent track:** #3188 tree-level social (whole-tree comments surface)
> **Surface contract:** #3372 tree-level comment surface contract
> **Prior contract PR:** #3374 (merged `e89c2b31`)
> **Moment boundary reference only:** #3075
> **Tree-like runtime reference (unchanged):** #3370 tree-like `likes.js` activation
> **Always Refs only:** #1882

---

## 1. Purpose and posture

This document audits the **runtime/API prerequisites** that must exist before a tree-level comment client can be activated under #3188. It is the audit companion to the tree-level comment surface contract (#3372 / #3374).

It answers, with evidence from the current remote `main` runtime/API surface after #3375 (`1c1a854`), before this audit PR is merged:

1. Does a tree-level comment **read/list** endpoint exist?
2. Does a tree-level comment **create/write** endpoint exist?
3. Can moment-level comment routes/adapters be reused for tree-level comments, or is that dangerous?
4. What is the safe tree comment DTO shape and the `targetScope: "tree"` semantics?
5. What auth / visibility / idempotency / rate-limit prerequisites must be met before activation?

### 1.1 What this document is

- An audit of current tree-level comment runtime/API readiness.
- A prerequisite checklist for later tree comment implementation children.
- A boundary inventory separating tree-level (`treeId`) from moment-level (`(treeId, memoryId)`).

### 1.2 What this document is not

- Not UI implementation.
- Not CSS or layout change.
- Not client adapter or API call implementation.
- Not runtime/server behavior change. **#3370 tree-like runtime behavior is explicitly out of scope and unchanged.**
- Not DB migration or DB apply.
- Not production smoke, fixture use, tree writer activation, or production visual confirmation.
- Not a change to active Browse / My Trees / Editor / Scout / Hermes behavior.
- Not a change to moment-level #3075 behavior except as an explicit scope boundary.

**Activation posture:** tree-level comment UI and client adapters remain **blocked**. This audit alone does **not** authorize client activation, runtime change, or DB change.

---

## 2. Audit finding 1 — tree-level comment read/list endpoint

**Finding: ABSENT.**

Current `main` tree-scoped API surface (`functions/api/trees/[tree_id]/`):

| Path | Purpose | Comment read? |
|---|---|---|
| `likes.js` | Tree-like like GET/POST proxy (#3370) | No |
| `views.js` | Tree view tracking | No |
| `memories/[memory_id]/comments.js` | **Moment**-level public comment read | Moment only |
| `memories/[memory_id]/reactions.js` | Moment-level reaction read | No |

There is **no** `functions/api/trees/[tree_id]/comments.js`. There is **no** `GET /api/trees/:treeId/comments` route.

Client side, `js/postgres-client.js` exposes no tree comment reader:

- `fetchPublicMomentComments(treeId, memoryId)` → `/trees/:treeId/memories/:memoryId/comments` (moment-scoped)
- `fetchComments(memoryId)` → `/memories/:memoryId/comments` (moment-scoped)

**Prerequisite for activation:** a dedicated tree-target comment read route (`/api/trees/:treeId/comments`) and a matching client reader must be introduced in a later implementation child, with public-read visibility gating mirroring the moment public-read proxy.

---

## 3. Audit finding 2 — tree-level comment create/write endpoint

**Finding: ABSENT.**

`js/postgres-client.js` comment writers are all moment-target:

- `createComment(memoryId, body, idempotencyKey)` → `POST /memories/:memoryId/comments`

There is **no** `createTreeComment(treeId, body, idempotencyKey)` and **no** tree comment write route in `functions/api/trees/`.

**Prerequisite for activation:** a dedicated tree-target comment create route (`POST /api/trees/:treeId/comments`) plus a client writer must be introduced in a later implementation child, modeled on the #3370 tree-like `likes.js` proxy (auth-required, idempotency-required, safe errors).

---

## 4. Audit finding 3 — moment comment route/adapter reuse risk

**Finding: REUSE IS DANGEROUS — FORBIDDEN.**

The existing moment comment routes/adapters are **memory-target**, not tree-target:

| Existing | Target | Effect if reused for tree comments |
|---|---|---|
| `POST /memories/:memoryId/comments` (`createComment`) | `(treeId, memoryId)` moment | Would create a **moment** comment, not a whole-tree comment; violates `targetScope: "tree"` |
| `GET /api/trees/:treeId/memories/:memoryId/comments` | `(treeId, memoryId)` moment | Would read **moment** comments; not whole-tree |
| `fetchPublicMomentComments` / `fetchComments` | moment | Wrong target key; would pollute tree comment counts |

A tree-level comment must never reuse moment DOM IDs, moment client adapters, or moment API paths as if they were tree-scoped. Tree comments require **separate tree-target endpoints** with `targetScope: "tree"`.

This is consistent with the hard separation stated in #3372/#3075: tree-level and moment-level comments must never be merged into one ambiguous target.

---

## 5. Safe tree comment DTO shape

Expected safe shapes (carried from #3372, unchanged by this audit):

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

Every tree comment DTO must carry `targetScope: "tree"` (or equivalent tree-target semantics) so it cannot be confused with `targetScope: "memory"` moment comments.

---

## 6. Visibility boundary: public vs private/draft/non-public

| Tree state | Tree comment surface |
|---|---|
| Public tree, comment feature ready | Read list (public-read) + eligible authenticated write |
| Private / draft / missing / non-public | Hidden/blocked; no existence leak via distinct private error copy when product policy requires `not found` equivalence |

Public guest reads must not require mutation auth and must not return private account fields, raw DB rows, tokens, audit rows, or internal exception text. If the tree is not public/comment-eligible, the client must treat the outcome as **hidden/blocked** rather than rendering a private tree comment panel.

The moment public-read proxy (`require_public_memory_membership`) validates both tree and memory publicity; a tree comment reader must validate **tree** publicity only and must not inherit moment membership checks.

---

## 7. Guest read-only and authenticated write gating

| Actor | Tree comment read | Tree comment write |
|---|---|---|
| Guest / signed-out | Read-only when public tree + feature ready | Hidden / not mounted; no 401 mutation loops |
| Authenticated eligible visitor | Read-only load + empty/error states | Eligible when public tree + write path verified |
| Authenticated owner on public tree | Same read list | Same composer eligibility; owner moderation controls are **future separate contract** |
| Any actor on private/draft/non-public tree | Hidden/blocked | Hidden/blocked |

**Auth prerequisite:** the future tree comment write proxy must require a confirmed Authorization header before POST, returning a safe `401 Authorization required` (mirroring `likes.js`), and must never send unauthenticated mutation calls from guest UI.

---

## 8. Idempotency prerequisite (future tree comment create)

The #3370 tree-like `likes.js` proxy requires and forwards `Idempotency-Key` for POST:

- missing key → `400 IDEMPOTENCY_KEY_REQUIRED`
- invalid key (not `^[A-Za-z0-9._:-]{8,128}$`) → `400 IDEMPOTENCY_KEY_INVALID`
- valid key → forwarded unchanged to Modal `/modal/private/trees/{treeId}/likes`

**Prerequisite:** the future tree comment create endpoint must adopt the same idempotency requirement and key validation so repeated rapid submits cannot create duplicate tree comments. This audit does **not** implement it; it records the requirement.

---

## 9. Rate-limit prerequisite (future tree-scoped writes)

**Finding: no tree-scoped comment rate-limit exists yet** (the comment write path is absent).

**Prerequisite:** before tree comment write activation, a tree-scoped rate-limit boundary must be defined (per `treeId` / per actor) so comment creation cannot be abused. This mirrors the general safe-error posture but is a separate follow-up child. This audit does not implement rate limiting.

---

## 10. Safe error copy and raw/private exposure restriction

The #3370 `likes.js` proxy returns safe error JSON with `x-lovebud-route-status` and a sanitized `x-lovebud-request-id`; it never forwards raw Modal stack traces or DB rows to the client. A future tree comment proxy must follow the same safe-error contract:

| Backend/safe category | UI/HTTP mapping |
|---|---|
| Unauthenticated | `401 Authorization required`; guest read-only; no raw 401 body in UI |
| Not public / not found | Hidden or blocked comment surface |
| Idempotency key invalid/reused | `400 IDEMPOTENCY_KEY_*`; safe retry/guidance; no raw code dump |
| Rate limited / write unavailable | Safe retry later message |
| Validation failure | Field-level safe copy |
| Unknown failure | Generic safe failure + rollback for composer |

**No raw backend errors in UI.** Map to product-safe messages only.

**Raw/private exposure restriction:** docs, tests, examples, and reports must never include raw/private IDs, tokens, Authorization material, API base URLs, dashboard URLs, DB rows, or request/response bodies. Request-id and route-status are sanitized transport metadata only, not private values.

---

## 11. #3370 tree-like runtime boundary (unchanged)

This audit references `functions/api/trees/[tree_id]/likes.js` (#3370) only as the **pattern to mirror** for a future tree comment proxy. It:

- does **not** modify `likes.js`
- does **not** change tree-like like behavior
- does **not** add comments behavior to the tree-like runtime

The tree-like runtime remains exactly as activated in #3370 / #3374.

---

## 12. Follow-up child issue sequence before activation

Client/UI activation of whole-tree comments requires, in order, dedicated later children:

1. **Runtime hardening for tree comment target** — define/implement tree-target comment read + write endpoints with auth, visibility, idempotency, and safe errors (mirroring #3370 `likes.js`).
2. **DB / schema readiness** — if comment storage requires new tree-target tables/columns, a migration child (separate from moment comment schema).
3. **Authenticated runtime verification** — safe replay/idempotency/visibility behavior for tree comment read + write.
4. **Client adapter child** — `fetchTreeComments(treeId)` and `createTreeComment(treeId, body, idempotencyKey)` (new, tree-target; never reusing `fetchComments`/`createComment`).
5. **UI implementation child(s)** — follow the #3372 surface contract (header band / right hub / composer), guest read-only, no inert controls.
6. **Controlled non-production verification** before any production visual confirmation.

**This #3376 audit satisfies none of steps 1–6 by itself.**

---

## 13. Explicit non-goals

This document and its companion contract test:

- do **not** implement UI, CSS, or layout
- do **not** implement client adapters or API calls
- do **not** change runtime/server behavior, including #3370 tree-like runtime behavior
- do **not** apply DB migrations
- do **not** run production smoke or use fixtures
- do **not** activate tree writers
- do **not** change Browse / My Trees / Editor / Scout / Hermes active behavior
- do **not** change moment-level #3075 behavior beyond referencing it as a boundary
- do **not** close #3188, #3075, or #1882
- do **not** expose raw/private values in docs, tests, examples, or reports

For #1882, references must use **`Refs #1882` only**. Never use GitHub close keywords (`Closes`, `Fixes`, or `Resolves`) with issue 1882.

---

## 14. Related documents

- `docs/product/lovebud-tree-comment-surface-contract.md` — tree-level comment surface contract (#3372 / #3374)
- `docs/product/lovebud-tree-social-client-surface-contract.md` — whole-tree social client surface overview (#3356)
- `docs/product/lovebud-tree-target-runtime-hardening-boundary.md` — tree-target runtime hardening boundary (#3355)
- `docs/product/lovebud-tree-level-social-boundary-audit.md` — current tree social surface inventory
- `docs/product/lovebud-authenticated-moment-comment-write-boundary-audit.md` — moment comment write boundary (#3075 gate)
- `docs/product/TREE_LEVEL_COMMENTS_READ_CONTRACT.md` — tree comment read contract planning

---

## 15. Companion test

Focused source-level contract coverage lives in:

`tests/contracts/tree-comment-runtime-api-prerequisites-audit-contract.test.cjs`

The test asserts that the audit documents the absent tree comment endpoints, the dangerous moment-route reuse boundary, safe DTO/`targetScope:"tree"`, visibility/guest/auth prerequisites, idempotency and rate-limit prerequisites, safe-error/no-raw-output rules, #3370-unchanged boundary, activation-gated follow-up sequence, and forbidden-boundary language. It does not exercise network, browser, DB, or production runtime.
