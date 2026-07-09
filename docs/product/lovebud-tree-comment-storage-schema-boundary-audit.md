# LoveBud Tree-Level Comment Storage Schema Boundary Audit

> **Issue:** #3382
> **Status:** Source-only storage/schema boundary audit — documentation and contract tests only
> **Parent track:** #3188 tree-level social (whole-tree comments surface)
> **Predecessors:** #3378 tree comment runtime route contract (#3381), #3376/#3377 runtime/API prerequisites audit
> **Surface contract:** #3372 tree-level comment surface contract
> **Moment boundary reference only:** #3075
> **Tree-like runtime reference (unchanged):** #3370 tree-like `likes.js` activation
> **Always Refs only:** #1882

---

## 1. Purpose and posture

This document audits whether the current storage/schema/idempotency/audit-log foundation can safely support whole-tree comments, before any tree comment runtime route, DB migration, or writer is implemented. It is the storage-layer audit companion to #3378 (route contract).

It answers, with evidence from current `main` (`734bf1f5`) schema scripts:

1. Does a dedicated tree-comment storage table/shape exist?
2. Is the current moment-comment storage memory-target only?
3. Can moment-comment storage be reused directly for tree comments?
4. Do the social idempotency/audit tables support `target_kind = 'tree'` + `target_id = treeId`?
5. Where are `target_kind` / `target_id` present / missing / partial?
6. What migration prerequisites are needed before `POST /api/trees/:treeId/comments`?
7. How must tree comment rows separate from moment comment rows?
8. What visibility / auth / idempotency / rate-limit / moderation / deletion / ownership prerequisites apply?

### 1.1 What this document is

- An audit of current tree-comment storage/schema readiness.
- A precondition checklist for later tree comment storage/DB children.
- A boundary inventory separating tree-level (`treeId`) from moment-level (`(treeId, memoryId)`) at the schema layer.

### 1.2 What this document is not

- Not a DB migration. **No migration file is created.**
- Not a DB migration apply. No production/staging SQL is executed.
- Not runtime/API route implementation.
- Not writer/reader/client adapter implementation.
- Not UI implementation. **Not CSS or layout change.**
- Not Modal/Cloudflare/Firebase/auth/provider/production change.
- Not production smoke.
- **#3370 tree-like runtime behavior is explicitly out of scope and unchanged.**
- Not a change to moment-level #3075 behavior except as an explicit scope boundary.

**Activation posture:** tree-level comment storage does not exist yet. This audit alone does **not** authorize a migration, apply, runtime change, or writer change.

---

## 2. Audit finding 1 — dedicated tree-comment storage

**Finding: ABSENT.**

Current comment storage (`scripts/migration-add-reactions-comments.sql`) defines:

```sql
CREATE TABLE IF NOT EXISTS comments (
    id UUID PRIMARY KEY,
    memory_id UUID NOT NULL REFERENCES memories(id) ON DELETE CASCADE,
    owner_id VARCHAR(128) NOT NULL,
    body TEXT NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);
```

- `comments.memory_id` is a **non-null FK to `memories`** — strictly moment-target.
- There is **no `tree_id`**, **no `target_kind`**, and **no `target_id`** on `comments`.
- There is **no separate `tree_comments` table**.

**Prerequisite for activation:** a dedicated tree-target comment storage shape must be introduced in a later DB/schema child (either a new `tree_comments` table with `tree_id UUID REFERENCES trees(id)`, or a generic-target extension of `comments` carrying `target_kind`/`target_id`/`tree_id`). This audit does not create it.

---

## 3. Audit finding 2 — moment-comment storage is memory-target only

**Finding: CONFIRMED memory-target only.**

`comments` and `reactions` both reference `memories(id)` directly; `reactions` adds `idx_reactions_memory_owner_type` for per-user per-memory toggle. None of these carry tree-level targeting.

This confirms moment-comment storage is **memory-scoped**, consistent with #3075 `(treeId, memoryId)` boundary.

---

## 4. Audit finding 3 — moment-comment storage reuse for tree comments

**Finding: FORBIDDEN.**

Reusing `comments(memory_id)` for tree-level comments would:

- attach the row to a **moment**, not a tree (`memory_id` FK enforces moment scope)
- violate `targetScope: "tree"` from #3372/#3378
- pollute moment comment counts and moment comment reads

Tree comments require **separate tree-target storage** that carries `tree_id` (or generic `target_kind = 'tree'`, `target_id = treeId`) and never populates moment/legacy fields. Existing moment `comments` rows must remain untouched.

---

## 5. Audit finding 4 — idempotency/audit generic target readiness

**Finding: PRESENT and tree-ready (after Migration B).**

`scripts/migration-add-generic-social-targets.sql` (Migration A) added to `social_idempotency` and `social_audit_log`:

```sql
ALTER TABLE social_idempotency ADD COLUMN IF NOT EXISTS target_kind VARCHAR(16);
ALTER TABLE social_idempotency ADD COLUMN IF NOT EXISTS target_id UUID;
ALTER TABLE social_audit_log   ADD COLUMN IF NOT EXISTS target_kind VARCHAR(16);
ALTER TABLE social_audit_log   ADD COLUMN IF NOT EXISTS target_id UUID;
```

`scripts/migration-b-generic-social-targets-cutover.sql` (Migration B):

- made the generic pair **NOT NULL**
- relaxed legacy `target_memory_id`/`memory_id` NOT NULL
- replaced compatibility triggers so **`target_kind = 'tree'` with null legacy memory fields is permitted** (tree writers unblocked for generic targets)
- enforces `target_kind IN ('memory', 'tree')`

**Conclusion:** the social idempotency/audit layer **already supports `target_kind = 'tree'` + `target_id = treeId`** for future tree comment writes. The #3188/#3370 tree-like like activation proves tree-kind generic writes work end to end. The storage gap is the **comment row table**, not the idempotency/audit layer.

---

## 6. Audit finding 5 — `target_kind` / `target_id` presence map

| Artifact | `target_kind` / `target_id` | Tree-kind support |
|---|---|---|
| `social_idempotency` | **PRESENT** (NOT NULL after B) | **READY** (`'tree'` permitted) |
| `social_audit_log` | **PRESENT** (NOT NULL after B) | **READY** (`'tree'` permitted) |
| `comments` | **MISSING** | No tree targeting at all |
| `reactions` | **MISSING** | No tree targeting (likes use separate tree path) |

The generic-target columns are **present and tree-ready** on the idempotency/audit layer, but **absent on the comment storage layer**, which is the blocking gap for tree comments.

---

## 7. Migration prerequisites before `POST /api/trees/:treeId/comments`

1. A new migration child adding **tree-target comment storage** (new `tree_comments` table, or generic `target_kind`/`target_id`/`tree_id` on `comments`). It must:
   - carry `tree_id UUID REFERENCES trees(id)` (or generic `target_kind='tree'`, `target_id=treeId`)
   - carry `owner_id` / author identity
   - carry `body`, `created_at`, `updated_at`
   - never require `memory_id`
   - preserve existing moment `comments` rows and semantics (backward compatible)
2. Reuse the **existing** `social_idempotency` / `social_audit_log` generic target columns for the new tree comment writer (no new idempotency/audit table needed).
3. Add tree-scoped indexes (e.g. `idx_tree_comments_tree_id`) for list reads.
4. Keep the Migration B trigger guarantees: tree targets must not populate legacy memory fields; memory targets must match legacy.

This audit does **not** author that migration; it records the prerequisite.

---

## 8. Tree vs moment separation at storage layer

A tree comment row must be unambiguously tree-scoped:

| Field | Moment comment row | Tree comment row (future) |
|---|---|---|
| scope key | `memory_id` (FK to `memories`) | `tree_id` (FK to `trees`) or generic `target_kind='tree'`, `target_id=treeId` |
| legacy memory fields | populated | **must be null** (enforced by Migration B triggers) |
| generic `target_kind` | `'memory'` | `'tree'` |

The Migration B triggers reject a tree target that populates `target_memory_id`/`memory_id`, so a correct tree comment writer must set `target_kind='tree'`, `target_id=treeId`, and leave legacy memory fields null.

---

## 9. Visibility / auth / idempotency / rate-limit / moderation / deletion / ownership

| Prerequisite | State | Note |
|---|---|---|
| Public-tree read boundary | Required | Tree comment reads must validate **tree** publicity, not moment membership |
| Authenticated eligible write | Required | `POST` must require confirmed auth; safe `401`; no guest mutation loops |
| Idempotency | **READY** | Reuse `social_idempotency` with `target_kind='tree'`, `target_id=treeId` + per-action `Idempotency-Key` |
| Rate-limit | **ABSENT** | Tree-scoped rate-limit boundary still a separate follow-up child |
| Moderation | Required | Tree comment storage must define moderation state (separate from moment moderation) |
| Deletion | Required | Tree comment deletion must be owner/moderator-scoped and reconcile counts |
| Ownership | Required | `owner_id`/author identity on every tree comment row; `authorDisplayLabel` in export |

---

## 10. Safe DTO / export shape implications

Storage export to the client must follow the safe DTO from #3372/#3378:

```text
treeCommentListItem:
- id: string
- targetScope: "tree"
- body: string
- createdAt: string
- authorDisplayLabel: string | anonymous-safe label
```

Storage must never export raw `owner_id` tokens, DB rows verbatim, or internal audit fields to the public DTO. `authorDisplayLabel` must be a safe display label, not a raw account identifier.

---

## 11. Raw/private exposure restrictions

This audit and its artifacts must never expose raw/private values:

- **schema docs:** reference table/column names only; no row dumps, no real IDs
- **SQL examples:** illustrative only; no real data, tokens, or credentials
- **tests:** no real secrets, fixtures with real private values, or production rows
- **PR evidence:** sanitized status/code/shape only; no raw backend leakage
- **logs / reports:** no raw/private IDs, tokens, cookies, Authorization headers, API base URLs, dashboard URLs, DB rows, request/response bodies, private logs, or screenshots

---

## 12. #3370 tree-like runtime boundary (unchanged)

This audit references `functions/api/trees/[tree_id]/likes.js` (#3370) only as evidence that tree-kind generic-target writes already work through `social_idempotency`/`social_audit_log`. It:

- does **not** modify `likes.js`
- does **not** change tree-like like behavior
- does **not** add comment behavior to the tree-like runtime

---

## 13. Follow-up child sequence before runtime activation

In order, dedicated later children:

1. **DB/schema child** — add tree-target comment storage (new table or generic extension); indexes; backward-compatible with moment `comments`.
2. **Writer (Modal) child** — tree comment read/create using existing generic `social_idempotency`/`social_audit_log` with `target_kind='tree'`, `target_id=treeId`; owner/moderation/deletion semantics.
3. **Cloudflare route child** — implement `GET`/`POST /api/trees/:treeId/comments` (mirrors #3378/#3381 route contract and #3370 `likes.js`).
4. **Client adapter child** — `fetchTreeComments(treeId)` / `createTreeComment(treeId, body, idempotencyKey)`.
5. **UI child** — follow #3372 surface contract; guest read-only; no inert controls.
6. **Non-prod verification child** — controlled verification before any production visual confirmation.

**This #3382 audit satisfies none of steps 1–6 by itself.**

---

## 14. Explicit non-goals

This document and its companion contract test:

- do **not** create a DB migration
- do **not** apply a DB migration or execute any SQL (production or staging)
- do **not** implement runtime/API routes
- do **not** implement writer/reader/client adapters
- do **not** implement UI, CSS, or layout
- do **not** change Modal/Cloudflare/Firebase/auth/provider/production
- do **not** change Scout / #1882 implementation scope
- do **not** run production smoke or use fixtures
- do **not** change moment-level #3075 behavior beyond referencing it as a boundary
- do **not** close #3188, #3075, or #1882
- do **not** expose raw/private values in docs, tests, examples, or reports

For #1882, references must use **`Refs #1882` only**. Never use GitHub close keywords (`Closes`, `Fixes`, or `Resolves`) with issue 1882.

---

## 15. Related documents

- `docs/product/lovebud-tree-comment-runtime-route-contract.md` — tree comment runtime route contract (#3378 / #3381)
- `docs/product/lovebud-tree-comment-runtime-api-prerequisites-audit.md` — runtime/API prerequisites audit (#3376/#3377)
- `docs/product/lovebud-tree-comment-surface-contract.md` — tree-level comment surface contract (#3372 / #3374)
- `docs/product/lovebud-generic-social-write-target-contract.md` — generic target (`target_kind`/`target_id`) contract
- `scripts/migration-add-reactions-comments.sql` — moment comment storage (evidence)
- `scripts/migration-add-generic-social-targets.sql` — Migration A generic target columns (evidence)
- `scripts/migration-b-generic-social-targets-cutover.sql` — Migration B tree-kind enablement (evidence)

---

## 16. Companion test

Focused source-level contract coverage lives in:

`tests/contracts/tree-comment-storage-schema-boundary-audit-contract.test.cjs`

The test asserts the audit documents the absent tree-comment storage, moment-storage memory-target-only confirmation, reuse-forbidden boundary, `target_kind='tree'`/`target_id=treeId` readiness on idempotency/audit, migration prerequisites, tree vs moment storage separation, visibility/auth/idempotency/rate-limit/moderation/deletion/ownership prerequisites, safe DTO/export, raw/private exposure restrictions, #3370-unchanged boundary, and forbidden non-goals. It does not exercise network, browser, DB, or production runtime.
