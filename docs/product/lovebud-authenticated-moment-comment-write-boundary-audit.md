# Authenticated Moment Comment Write Boundary Audit

**SOURCE-LEVEL READY; COMPOSER UI NOT YET AUTHORIZED**

This audit documents the static source-level evidence for the authenticated moment-comment write boundary. It distinguishes static source evidence from runtime evidence. No runtime mutation, production write, moderation UI, or composer behavior has been tested.

---

## References

- #3225 — This audit issue
- #3075 — Actionable social UX for moment likes/comments (parent, not started)
- #1882 — Parent product issue (OPEN, always Refs only)
- #3201 — Moment Social Write Readiness Gate (complete)
- #3184 — Public read-only selected-moment social summary (complete)

---

## 1. Static Source Map (Verified from Current Code)

### 1.1 Browser Adapter (`js/postgres-client.js`)

- `createComment(memoryId, body, idempotencyKey)` — accepts optional `idempotencyKey` parameter, forwards to `/memories/${memoryId}/comments` POST
- Private `fetchComments(memoryId)` — authenticated reader returning account-scoped fields (id, memoryId, ownerId, body, createdAt, updatedAt)
- Guest-safe `fetchPublicMomentComments(treeId, memoryId)` — uses `publicRead: true`, targets `/trees/${treeId}/memories/${memoryId}/comments`

### 1.2 Cloudflare Private Comments Proxy (`functions/api/memories/[id]/comments.js`)

- POST validates `Idempotency-Key` header (required, format `^[A-Za-z0-9._:\-]{8,128}$`)
- Bounded body forwarding (max 128KB)
- Forwards `Authorization` header only when provided by caller
- Routes to Modal private endpoint: `/modal/private/memories/${memoryId}/comments`

### 1.3 Modal Private Write Route (`modal_compute/app.py`)

- `POST /modal/private/memories/{memory_id}/comments`
- Requires `require_firebase_user(authorization)` — Firebase auth mandatory
- Calls `create_comment(memory_id, user["uid"], body, idempotency_key=x_idempotency_key)`

### 1.4 Core Write Protection (`modal_compute/comments.py`)

- **Nonempty body validation** with max 5000 characters (`validate_optional_string(body, 5000)`)
- **Visible-or-owner authorization guard** via `require_memory_visible_or_owner_cursor(cur, safe_memory_id, owner_id)` — checks both memory and tree visibility for non-owners, short-circuits for tree owner
- **Idempotency reserve/replay behavior** via `reserve_and_verify_idempotency` — returns replay with `resultPayload` if key exists; detects hidden/deleted original comment and raises `IDEMPOTENCY_RESULT_UNAVAILABLE` (410)
- **Comment rate-limit check** via `check_comment_rate_limits(cur, owner_id, safe_memory_id)` — actor-wide and per-memory limits
- **Audit recording** via `record_audit` — action `comment.create` or `comment.create.replay`, stores `request_key_hash`, excludes sensitive fields
- **Transaction commit/rollback** — single transaction wraps authorization, idempotency, rate-limit, insert, audit
- **Replay result unavailable behavior** — if original comment status != 'visible' or `deleted_at` is not null, raises 410

### 1.5 Public Display Boundary

- Cloudflare GET proxy: `functions/api/trees/[tree_id]/memories/[memory_id]/comments.js` — GET-only, no `Authorization` forwarding, targets `/modal/public/trees/{tree_id}/memories/{memory_id}/comments`
- Modal public route: `GET /modal/public/trees/{tree_id}/memories/{memory_id}/comments` — calls `require_public_memory_membership(tree_id, memory_id)` validating both tree and memory are public, then `fetch_public_comments(safe_memory_id, limit=limit)`
- **Public DTO limited to `id`, `body`, `createdAt`** — `normalize_public_comment_row` explicitly excludes `ownerId`, `memoryId`, `updatedAt`
- **Public Tree Workspace display must continue using only the public reader** (`fetchPublicMomentComments`), not private `fetchComments` — verified in viewer detail UI and canvas entry/injection points

### 1.6 Existing Static Evidence

- `docs/product/lovebud-moment-social-write-readiness-contract.md` — defines the source-of-truth API decision table, authenticated write boundaries, controlled runtime verification protocol, and permanent exclusions
- `tests/contracts/moment-social-write-readiness-contract.test.cjs` — asserts document structure, decision table, display rule, authenticated write boundaries, controlled lifecycle protocol, permanent exclusions, and regression guards
- `tests/contracts/moment-social-write-hardening-contract.test.cjs` — verifies Firebase auth on private routes, visibility guard bypass fix, idempotency key mandatory, transaction-bound idempotency, reaction/comment contracts, rate limit contracts, audit contracts, social error DTO, lifecycle authority, CF proxy contracts, browser client contracts, UUID insert contracts, result payload contracts, reaction response minimization, transaction-local authorization, rate limit unavailable, lifecycle audit, no TTL cleanup claim, scope guards, private route regression preservation, no raw DB error envelope

**What those already prove:** Firebase auth on private write routes, visibility guards with tree-owner bypass, mandatory idempotency keys with format validation, transaction-bound idempotency with replay, rate limiting with atomic increments, audit logging without sensitive fields, error DTO stability, soft-delete/hide lifecycle, CF proxy validation/forwarding, browser client idempotency helpers, application-generated UUIDs for rate-limit/audit tables, replay result payloads, minimal reaction DTOs, cursor-local authorization inside transactions, rate-limit failure rollback semantics, lifecycle audit in same transaction.

**What they cannot prove:** Runtime mutation behavior, production write paths, moderation UI behavior, composer UI behavior, end-to-end idempotency replay under concurrency, real Firebase token exchange, controlled lifecycle protocol execution.

---

## 2. Conclusion

**Source-level API and guardrails exist.** The complete write path from browser adapter → Cloudflare proxy → Modal private route → core `create_comment` function enforces:

- Firebase authentication
- Visible-or-owner authorization (with tree-owner bypass)
- Nonempty body ≤ 5000 chars
- Mandatory idempotency key with format validation
- Transaction-bound idempotency reserve/replay
- Per-actor and per-memory rate limits
- Audit logging without sensitive data
- Atomic commit/rollback
- Replay safety for hidden/deleted comments

**Existing static tests cover** Firebase auth, visibility, idempotency, rate limits, audit logging, safe public read DTOs, and lifecycle primitives.

**This does NOT authorize a composer UI yet.**

**A separate explicitly authorized controlled runtime lifecycle gate is required before any comment composer:**

1. Designated synthetic test identity and fixture only
2. Authenticated create comment
3. Public-read reconciliation for the same selected moment
4. Duplicate-submit/idempotency behavior
5. Safe blocked/retry categories
6. Controlled cleanup through the supported lifecycle
7. No tokens, UIDs, emails, fixture IDs, bodies, raw responses, raw logs, or secrets in documentation or reports

---

## 3. Required Reference Markers

Refs #3075
Refs #3201
Refs #3184
Refs #3218
Refs #3225
Refs #1882