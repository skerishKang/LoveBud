# Canonical Memory Lineage Write Contract — #4005

Parent: #4004  
Track: #4005  
Contract date: 2026-08-12  
LoveBud source baseline: `cc6cb26854e4cc692d3109debe05b0de1ab23a89`  
LoveTree schema source baseline: `06dfb7e52a3c5a96d309142bbeb06a3445a18f96`

## 1. Purpose

Define the runtime boundary that must exist before the branch-proven `memories.client_key` / `memories.sort_order` schema can become a Production migration.

This document is source/contract only. It deliberately does not modify `modal_compute/memory_writes.py`, `modal_compute/validation.py`, `modal_compute/owner_reads.py`, Cloudflare routes, frontend adapters, or Production schema.

## 2. Collision / sequencing decision

Runtime implementation of `clientKey` / `sortOrder` is intentionally deferred because the authoritative Memory write path (`modal_compute/memory_writes.py`) has active overlapping work that must land first.

Current PR state (reconciled at 2026-08-15):

- #3999 — **MERGED** (2026-08-13). The Memory Cloudflare proxy request-body boundary is closed and is no longer an open blocker. Did **not** implement `clientKey` / `sortOrder` runtime support.
- #3992 — **MERGED** (2026-08-14). Refactored `modal_compute/memory_writes.py` onto a shared strict `validate_emotion_tags()` helper.
- #3969 — **MERGED** (2026-08-14). Parent Tree visibility fail-closed correction applied.

These three historical overlaps are resolved. #3951 Memory parent-cycle atomicity / concurrency is CLOSED/completed and #4048 is MERGED (verified 2026-08-16), so `modal_compute/memory_writes.py` transaction authority is no longer an active OPEN/DRAFT overlap. #4005 remains docs-only and does not introduce any concurrent edit to `memory_writes.py`.

Verdict:

```text
SOURCE_CONTRACT_NOW
RUNTIME_IMPLEMENTATION_AFTER_MEMORY_WRITE_PR_RECONCILIATION
```

## 3. Current LoveBud runtime evidence

### 3.1 Create

Current `create_owner_memory()`:

- validates `treeId`, parent membership, visibility and storage entitlement;
- generates a new UUID server-side for every create;
- inserts the existing Memory fields only;
- does not read or persist `clientKey` or `sortOrder`;
- does not return either field.

### 3.2 Update

Current `update_owner_memory()` uses an explicit allowlist. Neither `clientKey` nor `sortOrder` is allowed.

Consequences today:

```text
PATCH clientKey  -> unsupported-field rejection
PATCH sortOrder  -> unsupported-field rejection
```

That fail-closed behavior should remain until each field has an explicit write contract.

### 3.3 Reads / normalization

Current owner Memory reads do not select `client_key` or `sort_order`, and `normalize_memory_row()` does not expose `clientKey` or `sortOrder`.

The standard API shape remains flat camelCase, so future exposure must use:

```text
clientKey
sortOrder
```

not raw snake_case names.

## 4. Schema contract already proven on a child branch

The exact LoveTree schema defines:

```text
client_key  nullable text
sort_order  nullable integer
```

with:

```text
UNIQUE (tree_id, client_key)
UNIQUE (tree_id, sort_order) WHERE sort_order IS NOT NULL
```

The #4005 isolated Neon branch proved that shape can be added to the canonical snapshot present at execution time (287 Memory rows, historical prototype record) without backfill or row loss, and that both uniqueness rules execute as intended. **Live reconciliation (2026-08-16):** the current live default catalog does not reproduce the 287-row snapshot (prototype branch `br-bitter-shape-a1yp6iup` now holds 7 trees / 5 memories in `neondb`); the 36/45/287 snapshot is **found on the non-default child lineage** (`br-bitter-shadow-a13dfg3c`), not on the current default/deployed lineage. The proof remains valid as executed branch evidence; the snapshot reference is historical-at-execution-time non-default-child evidence.

## 5. `clientKey` semantic decision

### 5.1 Meaning

`clientKey` is a **Tree-scoped stable client-origin identity for one logical Memory**.

It is not:

- the database primary key;
- an authenticated user ID;
- a request ID;
- a globally unique key;
- a replacement for the server-generated Memory UUID.

The server UUID remains canonical record identity. `clientKey` exists to let a client identify the same logical create across retry/offline/replay boundaries without manufacturing the canonical UUID itself.

### 5.2 Scope

Uniqueness scope is exactly:

```text
(treeId, clientKey)
```

The same `clientKey` may exist in different Trees.

### 5.3 Create behavior

Target create request shape is additive:

```ts
interface CreateMemoryLineageFields {
  clientKey?: string | null;
}
```

Compatibility rule:

```text
omitted clientKey -> persist NULL
```

No synthetic backfill and no server-generated `clientKey` for legacy callers.

### 5.4 Validation

The runtime implementation must add a dedicated strict validator rather than silently coercing malformed non-string input.

Required behavior:

```text
omitted / null -> NULL
string         -> normalized according to one explicit bounded string policy
non-string     -> bounded HTTP 400 before DB mutation
```

The exact maximum string length is not established by the LoveTree schema and is therefore **not invented in this document**. It must be fixed by the implementation PR with contract coverage before activation.

### 5.5 Immutability

Initial vNext rule:

```text
clientKey is create-only / immutable through ordinary Memory PATCH
```

Reason: changing the stable lineage identity after creation defeats its retry/offline purpose and complicates reconciliation.

The current update allowlist should continue rejecting `clientKey` until a separately authorized identity-repair operation exists.

### 5.6 Duplicate create behavior

A duplicate `(tree_id, client_key)` must never surface as a raw PostgreSQL constraint error or create a second Memory.

The implementation must convert the race-safe unique-index outcome into one bounded application result.

Target behavior:

```text
first create                           -> create canonical Memory
same Tree + same clientKey retry       -> resolve existing canonical Memory
same clientKey in a different Tree     -> allowed
```

A retry therefore converges to one canonical Memory ID.

This contract does not require the client to supply or predict that UUID.

If later product policy needs to distinguish exact replay from accidental key reuse with divergent payload, that requires an explicit request-fingerprint contract; this document does not silently infer payload equivalence from the key alone.

## 6. `sortOrder` semantic boundary

### 6.1 What is proven

The storage shape proves only:

```text
nullable integer
unique per Tree when non-null
```

The current source evidence does **not** establish:

- 0-based vs 1-based ordering;
- contiguous numbering requirement;
- negative-value policy;
- whether insertion should auto-allocate the next number;
- how sibling/tree-wide ordering interacts with `parentId`;
- reorder conflict semantics.

Those rules must not be guessed.

### 6.2 Initial compatibility rule

Until an ordering product contract is approved:

```text
legacy/current create with no sortOrder -> NULL
ordinary Memory PATCH                   -> sortOrder remains unsupported
existing Memories (287 at prototype execution time) -> stay NULL
```

### 6.3 Reorder operation requirement

If `sortOrder` becomes user-editable, ordinary single-row PATCH is not sufficient for swap/reorder semantics because the Tree-scoped unique index can reject transient duplicate positions.

A future reorder implementation should therefore use a dedicated transaction-level operation that can update the complete affected ordering set atomically.

Required invariants for that future operation:

- all target Memories belong to the authenticated owner's target Tree;
- no cross-Tree Memory can be reordered;
- final non-null order values are unique within the Tree;
- a failed reorder rolls back all order changes;
- concurrent reorder requests serialize or otherwise converge without partial order state;
- raw constraint names/SQLSTATE are not exposed to the client.

The exact endpoint/payload and 0/1-based numbering remain a separate product decision.

## 7. Read / response compatibility

When runtime support is eventually activated, owner Memory responses may add these fields additively:

```ts
interface MemoryLineageResponseExtension {
  clientKey?: string | null;
  sortOrder?: number | null;
}
```

Compatibility requirements:

- old rows remain valid with `null` values;
- no reader may fabricate values for legacy rows;
- public/Browse exposure is a separate privacy/product decision and is not implied by owner-write support;
- snake_case DB names must not leak through the flat camelCase API boundary.

## 8. Fork / copy boundary

Current `fork_public_tree()` copies public Memory content into newly generated destination Memory UUIDs and currently knows nothing about `client_key` / `sort_order`.

When lineage fields become runtime-active, fork behavior must be explicitly decided rather than inherited accidentally.

Safe initial rule:

```text
fork-created Memories do not receive source clientKey by default
```

Rationale: `clientKey` represents client-origin identity for a logical create. A server-generated fork is a new logical record set with new canonical UUIDs.

For `sortOrder`, preservation may be desirable if it represents display order, but this must wait for the ordering semantic decision above.

The four LoveTree migration-candidate Memories are a different case: they already carry source-system lineage metadata and may preserve their existing `client_key` / `sort_order` during a controlled cross-database migration after #4006 identity mapping is proven. Migration preservation is not the same operation as a user-initiated fork.

## 9. Error boundary

Future runtime code must map storage conflicts to bounded application codes rather than leaking database details.

Candidate fixed classifications:

```text
MEMORY_CLIENT_KEY_CONFLICT
MEMORY_SORT_ORDER_CONFLICT
```

Exact HTTP status is intentionally left to the implementation PR so it can align with existing LoveBud duplicate/conflict contracts.

## 10. Expected implementation surface after overlap clears

Likely runtime files, subject to fresh current-main inspection at implementation time:

```text
modal_compute/memory_writes.py
modal_compute/owner_reads.py
modal_compute/validation.py
relevant Memory create/read contract tests
docs/engineering/API_CONTRACT.md
```

Cloudflare Pages Functions should remain transport/proxy boundaries unless a concrete request-shape guard requires a narrow change. New schema policy must not be implemented in legacy Netlify artifacts.

The exact file list must be re-derived from then-current main and open PRs before implementation.

## 11. Required regression matrix

Before runtime activation, tests must prove at minimum:

```text
A. create without clientKey -> succeeds, NULL lineage
B. create with valid clientKey -> persists/returns canonical value
C. malformed non-string clientKey -> 400 before DB mutation
D. same Tree + same clientKey sequential retry -> one canonical Memory
E. same Tree + same clientKey concurrent create -> one canonical Memory
F. same clientKey across different Trees -> independent success
G. ordinary PATCH clientKey -> rejected
H. legacy reads with NULL lineage -> no fabricated value
I. owner read camelCase response -> clientKey/sortOrder only when contract activated
J. fork -> does not accidentally inherit clientKey
K. sortOrder direct PATCH remains rejected until reorder contract exists
```

DB-engine coverage is required for D/E because source-only tests cannot prove uniqueness/concurrency behavior.

## 12. Migration gate

The repository's canonical migration manifest (`db/migration-provenance/canonical-migrations.json`) remains `status: ADOPTION_REQUIRED`. However, its `migrations` array is no longer empty: it currently contains two catalogued canonical migrations:

1. `20260802094500_bootstrap-migration-ledger`
2. `20260812213000_add-tree-appreciation-orders`

This demonstrates that **canonical catalog population can proceed while ADOPTION_REQUIRED**. The manifest activation/runner adoption is a separate gate from catalog entry addition. No Production apply is authorized until the repository's adoption protocol and runner requirements are satisfied.

The branch-proven schema and this write contract therefore remain preparatory evidence only. A forward canonical migration artifact for `client_key` / `sort_order` could be catalogued while the manifest stays ADOPTION_REQUIRED, but must not be applied to Production or default-branch Neon until the adoption gate clears.

No new executable Production migration should be added through legacy `scripts/migration-*.sql` as a workaround.

## 13. Verdict

```text
GO_CLIENT_KEY_STABLE_IDENTITY_CONTRACT
GO_NULLABLE_BACKWARD_COMPATIBILITY
HOLD_SORT_ORDER_PRODUCT_SEMANTICS
HOLD_MEMORY_RUNTIME_IMPLEMENTATION_SEPARATE_CHILD_REQUIRED
HOLD_CANONICAL_MANIFEST_ADOPTION
HOLD_PRODUCTION_MIGRATION
CANONICAL_MIGRATION_CATALOG_ENTRY_ALLOWED_WHILE_ADOPTION_REQUIRED
```

## 14. Safety

- documentation only in GitHub
- no Product runtime file mutation
- no Production/default DB mutation
- no schema execution in this step
- no Firebase/Cloudflare/Modal deployment mutation
- no LoveTree mutation
- no Ready/merge action

Refs #4004
Refs #4005
Refs #3992
Refs #3969
Refs #3999
