# LoveBud Generic Social Write Target Contract

> **Issue:** #3260
> **Status:** Documentation and contract definition only
> **Scope:** Define the generic idempotency and audit target model required before tree-level like writes can be hardened or exposed in the UI

---

## 1. Current-State Boundary

### 1.1 Moment social hardening is moment-specific

The current moment social write hardening schema (from `migration-harden-moment-social-writes.sql`) stores the write target using moment-named fields:

- `social_idempotency.target_memory_id` — the memory UUID that the idempotent write targets
- `social_audit_log.memory_id` — the memory UUID recorded in audit entries

These fields are **moment-specific**. Their column names, types, and constraints reflect a `memory` target kind.

### 1.2 Tree IDs must never be stored in legacy moment fields

Storing a tree UUID in `social_idempotency.target_memory_id` or `social_audit_log.memory_id` — merely because the column exists and happens to accept a UUID — is **prohibited**. Doing so would:

- corrupt the semantic meaning of those columns (a "memory_id" column containing a tree UUID)
- break any future query that filters or joins on `target_memory_id` assuming all values reference the `memories` table
- violate the unique `(actor_id, operation, idempotency_key)` constraint's implicit target scope

### 1.3 Current tree-like route lacks idempotency contract

The tree-like toggle route (`POST /modal/private/trees/{tree_id}/likes`) exists in `modal_compute/tree_likes.py` and is proxied by `functions/api/trees/[tree_id]/likes.js`. However:

- It does **not** require an `Idempotency-Key` header
- It does **not** call `reserve_and_verify_idempotency`
- It does **not** record entries in `social_idempotency` or `social_audit_log`
- It does **not** hold a per-actor/per-tree advisory transaction lock before read-modify-write
- It does **not** detect or reject replay of duplicate requests with the same key

The current tree-like write is functionally toggling a `tree_likes` row and updating `tree_social_counts.like_count`, but it lacks the hardening that moment reactions already have.

---

## 2. Canonical Generic Target Vocabulary

### 2.1 Target kind

`targetKind` is a discriminated string with exactly two canonical values:

| `targetKind` | Meaning |
|---|---|
| `memory` | The write target is a moment (memory) UUID |
| `tree` | The write target is a tree UUID |

No other values are defined or permitted.

### 2.2 Target ID

`targetId` is the UUID identifier corresponding to the `targetKind`:

- When `targetKind` = `memory`, `targetId` references `memories.id`
- When `targetKind` = `tree`, `targetId` references `trees.id`

### 2.3 Operation names

Operation names remain **explicit and scope-specific**. They are not generic.

| Existing operation | Target kind | Scope |
|---|---|---|
| `reaction.toggle` | `memory` | Moment reaction toggle |

| Future operation | Target kind | Scope |
|---|---|---|
| `tree.like.toggle` | `tree` | Tree like toggle |

This contract does **not** define comment operations, share operations, ranking, notifications, or any new target types.

---

## 3. Additive Compatibility Model

### 3.1 Recommended future migration strategy

The following requirements govern any future schema migration that introduces generic target fields:

#### 3.1.1 Existing moment writes remain compatible

Existing moment write records and current moment callers (e.g., `reactions.py` calling `reserve_and_verify_idempotency`) **must remain compatible** without code changes during a temporary compatibility window.

#### 3.1.2 Generic target fields are additive and backfilled

New generic columns (e.g., `target_kind`, `target_id`) are **added** to existing tables. After addition, they are **backfilled** from existing moment values:

- `target_kind` ← `'memory'`
- `target_id` ← `target_memory_id` (from `social_idempotency`) or `memory_id` (from `social_audit_log`)

#### 3.1.3 Existing moment writers retain current semantics

During the compatibility window, existing moment writers continue to populate legacy moment-only target fields (`target_memory_id`, `memory_id`). They may optionally also populate generic target fields, but the legacy fields remain the authoritative source for moment writes until the window closes.

#### 3.1.4 Future tree writes use generic fields only

Future tree write callers use **only** generic target fields (`target_kind` = `'tree'`, `target_id` = tree UUID). They do **not** populate legacy moment-only target fields (`target_memory_id`, `memory_id`).

#### 3.1.5 Generic target indexes and constraints preserve unique behavior

The unique constraint on `(actor_id, operation, idempotency_key)` in `social_idempotency` is **preserved**. Generic target indexes must ensure that the same actor + operation + idempotency key combination remains unique regardless of target kind.

The unique constraint semantics remain: the same `(actor_id, operation, idempotency_key)` triple can only map to one target + payload pair. A reused key with a different target or payload returns `409 IDEMPOTENCY_KEY_REUSED`.

#### 3.1.6 Migration defines an unambiguous target kind/id pair

Every row in `social_idempotency` and `social_audit_log` must have an unambiguous `(target_kind, target_id)` pair after backfill. No row may have `target_kind` or `target_id` as NULL after the backfill is complete and verified.

#### 3.1.7 No destructive rename or drop in the first migration

The first migration introducing generic target fields is **additive only**. No column is renamed or dropped. No constraint is removed. No index is dropped.

#### 3.1.8 NOT NULL relaxation only after population and verification

Any relaxation of legacy `NOT NULL` constraints on `target_memory_id` or `memory_id` may occur **only after**:

1. Generic `target_kind` and `target_id` fields are populated for all existing rows
2. A verification query confirms that every row has a valid `(target_kind, target_id)` pair
3. All runtime callers have been updated to read generic fields

#### 3.1.9 Legacy moment-only fields remain readable during compatibility window

Legacy fields (`target_memory_id` in `social_idempotency`, `memory_id` in `social_audit_log`) remain readable throughout the compatibility window. They are not dropped, obscured, or made inaccessible until a separate, explicitly approved follow-up migration after the window closes.

### 3.2 Compatibility window summary

| Phase | Moment writers | Tree writers | Legacy fields | Generic fields |
|---|---|---|---|---|
| Current (pre-migration) | Populate legacy only | Do not exist | Authoritative | Do not exist |
| Window (post-migration) | Populate legacy + optionally generic | Populate generic only | Readable, still authoritative for moment | Authoritative for tree |
| Post-window (future) | Populate generic only | Populate generic only | Read-only fallback, then deprecated | Authoritative |

---

## 4. Future Tree-Like Write Contract

This section defines the **exact expected behavior** for a later runtime child implementing `tree.like.toggle`. It is a specification, not an implementation.

### 4.1 Authentication and authorization

- **Authenticated POST only.** Unauthenticated requests receive `401`.
- **Parent tree must be public.** If the tree's visibility is not `public`, the endpoint returns `404` (not `403`, to avoid leaking existence of private trees).

### 4.2 Idempotency

- **Valid `Idempotency-Key` is required.** Missing or malformed key returns `400 IDEMPOTENCY_KEY_INVALID` or `400 IDEMPOTENCY_KEY_REQUIRED`.
- **Cloudflare forwards `Idempotency-Key` unchanged** to the Modal backend. The proxy does not generate, modify, or strip the header.
- **Same actor + operation + key + target + payload** → returns the stored safe result **without** a second mutation. This is a replay.
- **Same key with a different target or payload** → returns `409 IDEMPOTENCY_KEY_REUSED`. The key is bound to its first-seen target and payload.
- **Pending or unavailable reservation** → returns a safe retryable error (`500 SOCIAL_WRITE_UNAVAILABLE` with message "Request is already being processed. Please retry with the same key.").

### 4.3 Concurrency

- **Per-actor/per-tree advisory transaction lock** is required before read-modify-write. The lock key is derived from `(actor_id, tree_id)` using a deterministic hash, analogous to the existing `_reaction_advisory_lock` in `reactions.py`.
- The lock must be held within a single database transaction that encompasses the entire read-modify-write cycle.

### 4.4 Aggregate integrity

- **`likeCount` cannot become negative.** Any decrement must use `GREATEST(like_count - 1, 0)` or equivalent.
- **One active like per actor per tree** is enforced by the unique partial index `idx_tree_likes_tree_owner_active` on `tree_likes(tree_id, owner_id) WHERE deleted_at IS NULL`.
- **Different valid keys serialize without aggregate corruption.** The advisory lock ensures that concurrent requests for the same actor/tree pair are serialized. Different actor/tree pairs can proceed concurrently.

### 4.5 Duplicate UI clicks

- Duplicate UI clicks that send the same `Idempotency-Key` are handled as replays (safe, idempotent).
- Two distinct intentional keys for the same actor/tree pair are **not** treated as the same operation by this contract. The advisory lock serializes them, and the second key produces its own independent reservation and mutation.
- Client-side pending-state logic (debounce, button disabling, local optimistic state) is the responsibility of the frontend and is **not** specified by this contract.

### 4.6 Result DTO

The result of a tree-like toggle is limited to:

| Field | Type | Description |
|---|---|---|
| `treeId` | string (UUID) | The tree that was targeted |
| `active` | boolean | Whether the actor's like is currently active |
| `likeCount` | integer (non-negative) | The tree's total like count after the toggle |

**No raw auth header, token, database row, audit record, idempotency key, or internal exception is returned.**

---

## 5. Deployment and Verification Gates

The following order is **required** for any future implementation. Each gate must be explicitly approved before the next begins.

1. **Approved generic-schema migration** — Additive columns and indexes only. No destructive changes.
2. **Schema evidence and compatibility verification** — Confirm backfill is complete, every row has a valid `(target_kind, target_id)` pair, and existing moment writes still function.
3. **Modal/Cloudflare runtime hardening** — Implement `tree.like.toggle` with idempotency, advisory lock, audit, and safe result DTO. Cloudflare proxy forwards `Idempotency-Key`.
4. **Authenticated runtime verification** — Contract tests and manual verification that tree-like writes behave as specified (replay, conflict, retryable, aggregate integrity).
5. **Client pending-state and UI activation** — Frontend like button, optimistic state, error handling.
6. **Logged-in production visual confirmation** — Verify that the like button works end-to-end in production with a real authenticated user.

**This documentation issue performs none of these actions.**

---

## 6. Explicit Non-Goals

This document and its associated contract test:

- Do **not** include a schema migration
- Do **not** include runtime, API, Modal, or Cloudflare code
- Do **not** include a deploy
- Do **not** include a client adapter or like button activation
- Do **not** include any UI, CSS, or layout change
- Do **not** define a comment model or comment writes
- Do **not** define share counts or sorting
- Do **not** change Browse or My Trees
- Do **not** change #3075
- Do **not** change Editor, Scout, Hermes, any outside-project code, or `pr-comment-composer-verify`

---

## References

- `scripts/migration-harden-moment-social-writes.sql` — moment social hardening migration
- `scripts/migration-add-tree-social-counts.sql` — tree social counts foundation
- `modal_compute/social_idempotency.py` — idempotency reservation and replay logic
- `modal_compute/social_write_audit.py` — safe audit logging
- `modal_compute/reactions.py` — moment reaction toggle with idempotency
- `modal_compute/tree_likes.py` — tree like toggle (current, without idempotency)
- `modal_compute/app.py` — FastAPI route definitions
- `functions/api/trees/[tree_id]/likes.js` — Cloudflare proxy for tree likes
- `tests/contracts/moment-social-write-hardening-contract.test.cjs` — moment hardening contract tests
- `tests/contracts/tree-like-api-boundary-contract.test.cjs` — tree-like API boundary contract tests
