# LoveBud Tree-Target Social Runtime Hardening Boundary

> **Issue:** #3355  
> **Status:** Source-only inventory and future hardening contract  
> **Scope:** Document the current tree-level social runtime surface and the
> required boundary for a later `target_kind = 'tree'` write hardening PR  
> **After:** Migration B / Verification Gate B (#3352 / #3354)

---

## 1. Purpose

Migration B is applied and Gate B evidence is accepted. The database schema
now permits future rows with:

- `target_kind = 'tree'`
- `target_id = <tree UUID>`
- legacy moment fields (`target_memory_id` / `memory_id`) left unset

This document is the **next small planning slice** before any server runtime
mutation. It inventories what exists today and defines the exact hardening
contract for a later implementation child.

**This issue does not activate tree writers, change runtime behavior, apply
schema changes, run production smoke, or enable client/UI.**

---

## 2. Current inventory (source-level)

### 2.1 Entrypoints and modules

| Layer | Path | Role today |
|---|---|---|
| Modal public tree detail | `modal_compute/app.py` public tree GET | Embeds public `likeCount` via `fetch_public_tree_like_count` |
| Modal authenticated write | `POST /modal/private/trees/{tree_id}/likes` | Calls `toggle_tree_like` |
| Modal authenticated read | `GET /modal/private/trees/{tree_id}/likes` | Calls `fetch_tree_like_summary` |
| Modal implementation | `modal_compute/tree_likes.py` | Visibility gate, toggle, aggregate update, safe DTO |
| Cloudflare same-origin proxy | `functions/api/trees/[tree_id]/likes.js` | Proxies GET/POST to Modal private likes path; requires `Authorization` |
| Aggregate tables | `tree_likes`, `tree_social_counts` (from tree social counts migration) | Per-actor active like rows + tree-level `like_count` |
| Moment social hardening (contrast) | `reactions.py`, `comments.py`, `social_idempotency.py`, `social_write_audit.py`, `social_errors.py` | Idempotency, audit, advisory locks, typed social errors for **memory** targets |
| Cloudflare moment proxies (contrast) | `functions/api/memories/[id]/reactions.js`, `.../comments.js` | Require and forward `Idempotency-Key` for moment mutations |

There is **no** tree-level comments write/read route distinct from moment
comments. Public moment comments remain under
`/trees/{tree_id}/memories/{memory_id}/comments` and are **memory-target**
scope, not tree-target social writes.

### 2.2 Capability matrix (current tree-like runtime)

| Capability | Present? | Evidence summary |
|---|---|---|
| Public read of aggregate like count | **Yes (limited)** | Public tree detail sets `likeCount` from `fetch_public_tree_like_count`; non-public trees fail closed as not found |
| Authenticated write route | **Yes (unhardened)** | `POST /modal/private/trees/{tree_id}/likes` + Cloudflare proxy POST |
| Authenticated actor summary read | **Yes** | `GET .../likes` returns `{ treeId, active, likeCount }` for public trees only |
| Visibility checks on write/summary | **Yes** | `require_public_tree_for_like` returns **404** when missing or not `public` |
| Guest mutation blocked at proxy | **Yes (auth header gate)** | Cloudflare likes proxy returns 401 when `Authorization` is missing |
| `Idempotency-Key` required | **No** | Tree likes Modal handlers and CF proxy do not require or forward the key |
| Idempotency reservation / replay | **No** | `toggle_tree_like` does not call `reserve_and_verify_idempotency` |
| Social audit logging | **No** | Tree likes do not call `record_audit` / `social_audit_log` |
| Generic target pair on write | **No** | Tree likes do not write `social_idempotency` / `social_audit_log` at all |
| Per-actor/per-tree advisory lock | **No** | No `pg_advisory_xact_lock` in `tree_likes.py` (contrast: reactions use `_reaction_advisory_lock`) |
| Safe replay of same key | **No** | Repeated POSTs without a key re-toggle; not key-bound replay |
| Aggregate non-negative integrity | **Partial yes** | Decrement uses `GREATEST(like_count - 1, 0)`; unique active index exists |
| One active like per actor/tree | **Partial yes** | Unique partial index on `tree_likes(tree_id, owner_id) WHERE deleted_at IS NULL` |
| Typed social error taxonomy | **No (tree path)** | Tree likes raise generic `HTTPException`; moment path uses `SocialWriteError` codes |
| Cloudflare forwards `Idempotency-Key` | **No (tree path)** | Likes proxy forwards only accept + authorization + request-id |
| Tree IDs never stored in legacy memory fields | **N/A today / required later** | Current tree likes do not touch `social_*` tables; future hardened writers must use generic tree pair only |
| Tree-level comments runtime | **Absent** | No tree-scoped comment mutation surface; moment comments remain separate (#3075 boundary) |

### 2.3 What “exists but is not hardened” means

The product already has a **functional** authenticated tree-like toggle and a
public aggregate count for public trees. Gate B only unlocked the **schema
path** for generic tree targets. The existing toggle is **not** yet a
Gate-B-aligned hardened writer:

- It does not reserve idempotency rows with `target_kind = 'tree'`.
- It does not audit with a tree generic target.
- It does not serialize concurrent actor/tree mutations with an advisory lock.
- It does not provide key-bound replay DTOs.

Until a separate runtime hardening PR lands, the tree-like path must be
treated as **pre-hardening / not yet eligible** for UI activation that depends
on idempotent social write semantics.

---

## 3. Future runtime hardening contract (`target_kind = 'tree'`)

This section is the contract for a **later** implementation PR. It is not
implemented by this document.

### 3.1 Operation identity

| Item | Contract |
|---|---|
| Canonical operation | `tree.like.toggle` |
| Target pair | `target_kind = 'tree'`, `target_id = <tree UUID>` |
| Legacy moment fields | Must remain **unset** (`NULL`) for tree writes |
| Forbidden shortcut | Tree UUIDs must **never** be stored in `target_memory_id` or `memory_id` |

### 3.2 Authentication and visibility

- **Authenticated POST only** for mutations. Missing/invalid auth → `401`.
- **Parent tree must be `public`.** Missing or non-public → **`404`** (not
  `403`), so private/draft trees are not existence-leaked through social
  summaries or writes.
- Public aggregate read for like count remains public-tree-only and must not
  invent rows solely to advertise private trees.
- Guests must not mutate. Guest UI must not spam mutation endpoints and create
  **noisy 401 loops**; guest affordances remain read-only / sign-in directed
  until a separate client activation task.

### 3.3 Idempotency and replay

- Mutations **require** a valid `Idempotency-Key` (same format family as moment
  social writes: 8–128 ASCII from `[A-Za-z0-9._:-]`).
- Missing key → `400` with code `IDEMPOTENCY_KEY_REQUIRED`.
- Malformed key → `400` with code `IDEMPOTENCY_KEY_INVALID`.
- Cloudflare tree-likes proxy **must forward `Idempotency-Key` unchanged**
  (must not generate, rewrite, or strip it).
- Same actor + operation + key + target + payload → **replay**: return the
  stored authoritative safe DTO **without** a second mutation.
- Same key with different target or payload → `409 IDEMPOTENCY_KEY_REUSED`.
- Pending / unavailable reservation → safe retryable error
  (`SOCIAL_WRITE_UNAVAILABLE` or equivalent typed social error), not a silent
  second toggle.

### 3.4 Concurrency and aggregate integrity

- Before read-modify-write, acquire a **per-actor/per-tree** transaction
  advisory lock (hash of `(actor_id, tree_id)`), analogous to
  `_reaction_advisory_lock` for moments.
- Hold the lock inside the same DB transaction that performs reservation,
  mutation, aggregate update, and audit.
- `likeCount` must never go negative (`GREATEST(like_count - 1, 0)` or
  equivalent).
- At most one active like per actor per tree remains enforced by the existing
  unique partial index (or a successor with equal strength).

### 3.5 Audit identity

- Successful and safely classifiable failed tree-like writes that participate
  in the hardened path should record **minimal** audit metadata using the
  generic target model after Gate B:
  - actor id
  - `target_kind = 'tree'`
  - `target_id = tree UUID`
  - action such as `tree.like.toggle` / `tree.like.toggle.replay`
  - outcome code
  - request key hash (never raw key)
- Never store Authorization headers, tokens, cookies, raw payloads, stack
  traces, IPs, or browser fingerprints in audit rows.

### 3.6 Authoritative safe DTO

Tree-like toggle responses remain limited to:

| Field | Type | Meaning |
|---|---|---|
| `treeId` | string (UUID) | Targeted tree |
| `active` | boolean | Whether the actor’s like is active after the operation / replay |
| `likeCount` | integer ≥ 0 | Tree aggregate after the operation / replay |

No raw auth material, DB rows, audit rows, idempotency keys, or internal
exception text may be returned.

### 3.7 Error and observability taxonomy

Future tree-like hardening should reuse or extend the moment social error
vocabulary where appropriate:

- `IDEMPOTENCY_KEY_REQUIRED`
- `IDEMPOTENCY_KEY_INVALID`
- `IDEMPOTENCY_KEY_REUSED`
- `SOCIAL_WRITE_UNAVAILABLE`
- visibility not-found as plain `404` without leaking private existence

Observability may attach request-id headers already used by Cloudflare
proxies, but must not log secrets or private identifiers in operator reports.

### 3.8 Comments / reactions semantics at the tree boundary

- **Moment reactions and moment comments** remain memory-target hardened paths
  (`target_kind = 'memory'`). This contract does **not** change #3075 moment
  behavior.
- **Tree-level comments** are **out of scope** for the first tree-target
  hardening child. If introduced later, they require their own operation names,
  idempotency, visibility, and audit contracts; they must not reuse moment
  legacy fields for tree IDs.
- Duplicate-prevention for tree likes is **key-bound idempotency + advisory
  lock + unique active like**, not client-only debounce.

### 3.9 Guest and client activation boundary

- Hardened server runtime may exist before UI activation.
- Client adapter, like-button pending state, and production visual confirmation
  are **separate** children after authenticated runtime verification.
- Guest surfaces must remain non-mutating and must not poll authenticated write
  endpoints in a way that generates noisy 401 storms.

---

## 4. Implementation order (unchanged product gate chain)

Required order from the generic social write target contract (#3260), restated
for implementers after Gate B:

1. ~~Migration A artifact + apply + Gate A~~ — complete  
2. ~~Migration B artifact + apply + Gate B~~ — complete  
3. **Modal + Cloudflare tree-like runtime hardening** (future child; this doc
   is the contract for that child)  
4. Authenticated runtime verification (replay, conflict, retryable, aggregates)  
5. Client pending-state / UI activation  
6. Logged-in production visual confirmation  

**This document performs step 3 planning only — not implementation.**

---

## 5. Explicit non-goals

This inventory/contract and its tests:

- Do **not** change Modal, Cloudflare, client, or UI runtime behavior
- Do **not** deploy Modal or Cloudflare
- Do **not** apply or edit DB migrations
- Do **not** run production smoke or use fixtures
- Do **not** activate tree writers
- Do **not** change moment-level #3075 behavior
- Do **not** change Browse, My Trees, Editor, Scout, Hermes, or outside-project code
- Do **not** define share counts, social sorting, or tree comment product UI
- Do **not** print or require raw/private values (tokens, IDs in reports, connection strings, payloads)

---

## 6. References

- `docs/product/lovebud-generic-social-write-target-contract.md`
- `docs/ops/generic-social-targets-migration-a-runbook.md`
- `docs/ops/generic-social-targets-migration-b-runbook.md`
- `scripts/migration-add-generic-social-targets.sql`
- `scripts/migration-b-generic-social-targets-cutover.sql`
- `scripts/migration-add-tree-social-counts.sql`
- `modal_compute/tree_likes.py`
- `modal_compute/reactions.py` (moment hardening reference)
- `modal_compute/social_idempotency.py`
- `modal_compute/social_write_audit.py`
- `functions/api/trees/[tree_id]/likes.js`

Refs #3355  
Refs #3188  
Refs #3354  
Refs #3353  
Refs #3352  
Refs #3264  
Refs #3262  
Refs #3260  
Refs #3075  
Refs #1882  
