# Canonical Neon Schema + Data Authority Audit — #4005

Parent: #4004  
Track: #4005  
Audit date: 2026-08-12  
LoveBud authoritative main at branch creation: `cc6cb26854e4cc692d3109debe05b0de1ab23a89`  
LoveTree authoritative main observed during audit: `06dfb7e52a3c5a96d309142bbeb06a3445a18f96`  

**FINAL RECONCILIATION BASIS (historical provenance):**

LoveBud alignment basis at final reconciliation: `4814190982655c55e72bc01d3d2b6663138ecfa6` (retained as historical reconciliation provenance; earlier basis `c5de1d14e7b0c4b9c07586cc6655f7d4c9d2ffbd` also historical). This document does not assert a self-pinned "current main".

PR #4007: a plain merge-forward from main completed without conflicts (historical/intermediate merge-forward commit `86ab1ba91345d14ed208ac4772cd158281281aa2`); the current PR head is authoritative from GitHub PR metadata and is intentionally not self-pinned in this document.
Runtime-write authority: #3951 is CLOSED/completed and #4048 is MERGED (verified 2026-08-16); `modal_compute/memory_writes.py` transaction authority is therefore resolved, not an active OPEN/DRAFT overlap. #4007 remains docs-only and does not introduce any runtime write.  
Historical overlaps #3992, #3969, #3999: all MERGED (verified 2026-08-16).

## 1. Scope and safety

This is a read-only database/schema audit plus documentation branch.

No Production DDL/DML, no data copy, no data deletion, no Neon Auth provisioning, no Cloudflare binding/deploy change, no Firebase mutation, no Modal configuration change, and no LoveTree code mutation were performed.

The audit used:

- current GitHub repository state for LoveBud and `lovetree-limone`;
- recent Google Drive project material to race-check parallel work ownership;
- the owner's authenticated read-only Cloudflare forensic report;
- direct read-only SQL against the two current Neon projects.

## 2. Parallel-work collision assessment

### 2.1 LoveTree

Current open LoveTree work is dominated by Design Fidelity / Design Lab / Lineage / V4 visual-fidelity streams. The active PRs inspected explicitly exclude Auth/API/DB/Firebase/Worker/Production mutation.

Examples include current Design Fidelity orchestration and Lineage 54/55/56/57/58, Memory Anatomy, Moment Orbit and V4 fidelity streams.

Therefore this #4005 database audit does not share branch or file ownership with those streams.

### 2.2 LoveBud

LoveBud has many existing backend/security Draft PRs, but they primarily modify current Modal/Python implementation, current Pages Function routes, contracts and migration manifests.

This audit intentionally does not modify those runtime files. It writes only this architecture document on:

```text
docs/4005-canonical-neon-convergence-audit
```

### 2.3 Verdict

```text
PARALLEL_BACKEND_AUDIT_SAFE
```

The schema/data convergence audit is independently reviewable and can proceed while current UI/Lineage work and legacy Modal security PRs continue.

---

## 3. Candidate data authorities

Two independent Neon projects currently contain Tree/Memory state.

### 3.1 LoveBud-era canonical candidate: `133-relovetree`

Observed PostgreSQL server (live read-only catalog, 2026-08-16):

```text
17.10
```

**Live catalog reconciliation (2026-08-16) — fresh read-only `information_schema`/`pg_catalog` inspection of the production/default branch `br-little-fire-a18brh25`.** Two databases exist on the branch. The canonical application database is `neondb` (the repository `.env.example` resolves `NETLIFY_DATABASE_URL`/`DATABASE_URL` to the `/neondb` database).

Live `neondb` application schema (11 base tables):

```text
comments
memories
reactions
social_audit_log
social_idempotency
social_rate_limits
tree_comments
tree_likes
tree_social_counts
tree_view_dedup_events
trees
```

Live `neondb` aggregate counts (sanitized; no row content):

```text
public.trees           7  (6 public / 1 private; 2 distinct non-null owner_ids; 0 null owner_id)
public.memories        5  (4 public / 1 private; 0 orphan tree_id)
public.tree_social_counts  6
comments / reactions / tree_likes / tree_comments / social_audit_log / social_idempotency / social_rate_limits / tree_view_dedup_events  0
```

**No `public.users`, `ai_logs`, `community_posts`, `community_comments`, `community_moderation_logs`, `schema_migration_ledger`, or `tree_appreciation_orders` table exists in the live `neondb` or `lovebud` database on the production branch.** The earlier documented snapshot (`36 users / 45 Trees / 287 Memories` with a `users` table and community/ai_logs tables) is **not reproducible from the current live catalog**. It predates the current canonical schema lineage and must be treated as historical/documented evidence only until owner confirmation of the source database that produced it.

A separate legacy `lovebud` database on the same branch holds a UUID-id schema (`trees.id uuid`, 174 rows; `memories.id uuid`, 254 rows) with no `users` table; it is not the canonical `/neondb` application database.

### 3.2 Separate LoveTree project: `lovetree-limone`

Observed PostgreSQL server (live read-only catalog, 2026-08-16):

```text
18.4
```

**Live catalog reconciliation (2026-08-16) — fresh read-only inspection of the production/default branch `br-holy-scene-azwi84gb` (`neondb` database).** The documented 7-Tree / 4-Memory snapshot is **live-verified**:

```text
public.trees           7  (all public; 3 distinct non-null owner_ids; 0 null owner_id)
public.memories        4  (all public; 0 orphan tree_id)
public.tree_social_counts  7
comments / reactions / tree_likes / tree_comments / social_audit_log / social_idempotency / social_rate_limits / tree_view_dedup_events  0
```

It has **no `public.users` table** (live-verified), and its 11-table application schema is structurally identical to LoveBud's `neondb` schema (see §4), differing only by the three nullable Memory columns LoveBud added (`connection_reason`, `discovery_date`, `video_offset_seconds`).

### 3.3 Authority decision

The existing LoveBud / `133-relovetree` database lineage is the correct **candidate canonical production data authority**.

Reasons:

1. its live `neondb` catalog (production/default branch `br-little-fire-a18brh25`) is the canonical application database, carrying the 11-table schema the LoveBud product is built on (live-verified 2026-08-16);
2. its Tree ownership is exercised through `trees.owner_id` (`text NOT NULL`, 2 distinct non-null live owners, 0 null); the earlier "current account/user relation" rationale was based on the 36-user `public.users` snapshot, which is classified **`HISTORICAL_NOT_REPRODUCED`** and requires owner lineage confirmation before any account-relation claim is re-asserted;
3. it contains the mature social/idempotency/audit/dedup lineage;
4. current LoveBud product/security contracts are already built around its semantics;
5. moving authority to the smaller LoveTree database would create unnecessary data migration and security-contract risk.

This does **not** mean the LoveTree schema should be ignored. Any genuine LoveTree-only improvement remains a candidate to port additively into canonical schema vNext; on the currently live-verified dimensions the two databases are structurally identical, so no such pending port exists today (see §4.3/§4.4 dispositions).

---

## 4. Structural comparison

## 4.1 Schemas / extensions / RLS / views

### LoveBud candidate

Observed non-system schemas (live-verified 2026-08-16):

```text
public
drizzle  (drizzle.__drizzle_migrations; 0 rows applied live)
```

Extensions (live-verified):

```text
plpgsql
```

**No `pgcrypto` extension is installed live** (earlier documentation listing `pgcrypto` is not reproduced by the live catalog).

Public RLS policies: none observed (live-verified).
Public views / materialized views: none observed (live-verified).
Public triggers: **none observed (live-verified)** — the earlier documented `trg_social_audit_log_sync_generic_target` / `trg_social_idempotency_sync_generic_target` triggers are not present in the live catalog.
Custom privileges/ACLs: **none** — no table carries a non-default `relacl`; the only dedicated role is the read-only catalog role `lb_ro_709d5f3e68f774d2` used for this audit.

### LoveTree

Observed non-system schema (live-verified 2026-08-16):

```text
public
```

Extension (live-verified):

```text
plpgsql
```

Public RLS policies: none observed (live-verified).
Public views / materialized views: none observed (live-verified).
Public triggers: none observed (live-verified).
Custom privileges/ACLs: none (live-verified).

Neither database currently has a `neon_auth` schema (live-verified; production branches only).

## 4.2 Enum strategy

**Live catalog reconciliation (2026-08-16): both LoveBud `neondb` and LoveTree `neondb` define the same five PostgreSQL enum types** (live-verified via `pg_type`/`pg_enum`):

```text
comment_status  = visible | deleted
reaction_type   = like | love | laugh | wow | sad | angry
social_outcome  = ok | duplicate | not_found | forbidden | rate_limited | error
source_type     = youtube | video | song | book | person | travel | other | link
visibility      = private | unlisted | public
```

This corrects the earlier claim that LoveBud used text/varchar with no enums: the live canonical LoveBud schema is enum-based, and `visibility` already includes `unlisted` on both sides. The enum sets are therefore **not a LoveTree-only difference**; the two databases are enum-identical.

Remaining nuance: the earlier documented legacy blank `source_type` value and legacy null-visibility Tree rows belong to the non-reproducible historical snapshot (§3.1/§6); the current live snapshot has 0 null visibility rows and no blank source_type was observed in the 5 live Memories.

Decision:

```text
ENUM_WHOLESALE_PORT = HOLD
```

Use existing canonical semantics during initial convergence. Any enum conversion requires a separate compatibility/data-cleanup decision.

## 4.3 Trees

### Canonical LoveBud characteristics

- **`owner_id` is `text NOT NULL` in the live catalog** (live-verified 2026-08-16; 2 distinct non-null owner_ids, 0 null); the earlier "nullable owner_id" wording reflected the non-reproducible historical snapshot.
- `id` is `text NOT NULL` PRIMARY KEY (live-verified; **not** UUID).
- `title`, `memo`, `artist` are `text NOT NULL`; `visibility` is enum NOT NULL; `keywords` is `jsonb NOT NULL`; timestamps `timestamptz NOT NULL`.
- `client_key` exists (nullable `text`).
- unique `(owner_id, client_key)` exists (live-verified index `trees_owner_client_key_uniq`).
- index `trees_visibility_created_at_idx` and `trees_owner_id_idx` exist (live-verified).

### LoveTree refinements

**Live reconciliation (2026-08-16):** every item below is **already present in the live LoveBud `neondb` catalog** (live-verified: `owner_id`/`title`/`memo`/`artist`/`visibility`/`keywords` NOT NULL; enum `visibility` incl. `unlisted`; `keywords` `jsonb NOT NULL`; indexes `trees_owner_id_idx` and `trees_visibility_created_at_idx`; unique `trees_owner_client_key_uniq`). These are therefore **not pending LoveTree→LoveBud ports** — the two live databases are structurally identical on the Trees dimension.

- stronger non-null requirements (present live in both);
- enum visibility (present live in both);
- JSONB keywords (present live in both);
- index on `owner_id` (present live in both);
- index on `(visibility, created_at)` (present live in both);
- same owner/client-key uniqueness concept (present live in both).

### Decision

```text
Tree authority                     = LOVEBUD_CANONICAL
owner/client-key uniqueness        = SAME_SEMANTIC_CURRENTLY (identical live index in both DBs)
owner index                         = SAME_SEMANTIC_CURRENTLY (trees_owner_id_idx present live in both)
visibility+created index            = SAME_SEMANTIC_CURRENTLY (trees_visibility_created_at_idx present live in both)
NOT NULL wholesale                  = HOLD (no live NOT NULL gap on Trees core columns; blanket tightening not authorized)
JSONB keywords                      = SAME_SEMANTIC_CURRENTLY (jsonb NOT NULL in both)
unlisted visibility                 = SAME_SEMANTIC_CURRENTLY (enum value present in both; product usage decision remains separate)
```

**Live reconciliation (2026-08-16):** the historical "two legacy null Tree rows" belong to the non-reproducible historical snapshot only — the current live catalog has **0 null-owner_id and 0 null-visibility Tree rows** (`trees.owner_id` is `text NOT NULL`, 0 null). They are no longer a current blocker; if the historical snapshot lineage is re-confirmed by the owner, classification of those rows would still not authorize deletion under this audit.

## 4.4 Memories

### Canonical LoveBud characteristics (live-verified 2026-08-16)

- **5 rows live** (not 287; the 287-row snapshot is historical and not reproducible from the current live catalog, §3.1);
- `emotion_tags` stored as `jsonb NOT NULL`;
- `source_type` and `visibility` stored as enum values;
- **`client_key` (`text` nullable) and `sort_order` (`int4` nullable) exist live**, along with unique `memories_tree_client_key_uniq` and partial unique `memories_tree_sort_order_uniq_partial`;
- **three additional nullable columns exist live in LoveBud only**: `connection_reason` (`text`), `discovery_date` (`date`), `video_offset_seconds` (`int4`) — LoveTree does not have these;
- live FKs: `memories.tree_id → trees.id` and `memories.parent_id → memories.id` both exist (FK-parity blocker from the historical snapshot is not reproducible live: 0 orphan-tree Memories);
- index `memories_visibility_created_at_idx` exists.

### LoveBud vs LoveTree Memory exact diff (live)

```text
columns: LoveBud 100 total vs LoveTree 97 total
only in LoveBud: memories.connection_reason, memories.discovery_date, memories.video_offset_seconds (all nullable)
only in LoveTree: none
constraints: 99 == 99 (semantic identity)
indexes:    33 == 33 (semantic identity)
enums:       5 == 5  (identical)
```

### Memory lineage columns — live state (both databases)

**Live reconciliation (2026-08-16):** `client_key` (`text`, nullable) and `sort_order` (`int4`, nullable) **already exist in both live LoveBud and LoveTree `neondb` databases**, together with unique `memories_tree_client_key_uniq` and partial unique `memories_tree_sort_order_uniq_partial` (identical in both; live-verified). These are **not** a LoveTree-only addition awaiting port to LoveBud — there is no pending client_key/sort_order port decision.

```text
client_key
sort_order
```

Present in both live databases:

- unique `(tree_id, client_key)`;
- partial unique `(tree_id, sort_order)` when sort order is non-null;
- FK `tree_id → trees.id`;
- self-FK `parent_id → memories.id`;
- index `(visibility, created_at)`;
- JSONB emotion tags;
- enum visibility/source type.

The only live Memory-column difference between the two databases is the three extra nullable columns present in LoveBud only (`connection_reason`, `discovery_date`, `video_offset_seconds`, §3.2/§4.4 above).

### Critical canonical-data blocker to strict FK parity (historical vs live)

The **historical** canonical snapshot documented:

```text
125 Memories referencing Tree IDs no longer present in public.trees
45 distinct missing Tree IDs
observed orphan-Memory date range: 2026-05-18 through 2026-07-09
```

**Live reconciliation (2026-08-16): this orphan condition is not reproducible in the current live `neondb` catalog — all 5 live Memories resolve to an existing `trees.id`, and `memories.tree_id → trees.id` FK is enforced live.** The orphan risk therefore remains a historical-snapshot property pending owner confirmation of the source lineage; it must not be re-asserted as current live state.

Therefore any new FK-tightening/constraint-application action aimed at the **historical** snapshot lineage would be unsafe and may fail validation or force destructive handling of historical data; for the **current live catalog** no such action is needed because `memories.tree_id → trees.id` and `memories.parent_id → memories.id` are already enforced live in both databases (live-verified).

Decision:

```text
client_key                           = SAME_SEMANTIC_CURRENTLY (present in both live DBs)
sort_order                           = SAME_SEMANTIC_CURRENTLY (present in both live DBs)
(tree_id, client_key) uniqueness     = SAME_SEMANTIC_CURRENTLY (identical live index in both)
(tree_id, sort_order) uniqueness     = SAME_SEMANTIC_CURRENTLY (identical partial unique in both)
parent FK                            = PRESENT_LIVE_BOTH (memories.parent_id → memories.id)
tree FK                              = PRESENT_LIVE_BOTH (memories.tree_id → trees.id); historical orphan classification remains only for the non-reproduced snapshot lineage
visibility+created index             = SAME_SEMANTIC_CURRENTLY (memories_visibility_created_at_idx in both)
emotion_tags                         = SAME_SEMANTIC_CURRENTLY (jsonb NOT NULL in both)
enum visibility/source_type          = SAME_SEMANTIC_CURRENTLY (same 5 enums in both)
```

Do not synthesize arbitrary client keys or sort order for the **historical 287-Memory prototype snapshot** merely to satisfy a new constraint (the live catalog holds 5 Memories, §3.1). Existing data should remain valid while new-write contracts can begin populating the new fields.

## 4.5 Tree likes

**Live reconciliation (2026-08-16):** `tree_likes` has **0 rows live** (both databases), columns are `id`, `tree_id`, `owner_id` (all `text NOT NULL`), `created_at`, nullable `deleted_at`. **Both live databases carry the identical unique `(tree_id, owner_id)` index `tree_likes_tree_owner_uniq`** (live-verified) — there is no live uniqueness difference between LoveBud and LoveTree. The earlier "LoveBud soft-delete / partial active-like uniqueness" rule (`unique(tree_id, owner_id) where deleted_at is null`) and the 9-row / 7-soft-deleted / 8-orphan-like snapshot are historical and not reproducible live.

Decision:

```text
tree_likes uniqueness (live)        = SAME_SEMANTIC_CURRENTLY (identical unique (tree_id, owner_id) index in both live DBs)
soft-delete / partial-unique rule   = HISTORICAL_SNAPSHOT_NOT_REPRODUCED_LIVE
Tree FK tightening                  = HOLD_LEGACY_ORPHAN_CLASSIFICATION
```

The recent LoveBud/LoveTree social implementations already demonstrate that re-like/restore concurrency behavior is product logic, not a trivial schema equivalence.

## 4.6 Tree comments

LoveBud's Tree-comment lineage is richer and transitional:

- canonical `owner_id` / body / target fields;
- legacy author/display-name and payload/deletion compatibility fields;
- FK to Tree;
- an author FK to `users` for the legacy author field;
- checks that generic target semantics remain Tree-scoped.

**Live reconciliation (2026-08-16):** live `tree_comments` columns are `id`, `tree_id`, `owner_id`, `body`, `target_kind`, nullable `target_id`, timestamps — all `text NOT NULL` except `target_id`. Live FK `tree_comments.tree_id → trees.id` exists; **there is no `users` table live, so no author→users FK is present** (the legacy author-field shape belongs to the historical snapshot). 0 rows live in both databases.

LoveTree has the simpler modern surface but no actual Tree-comment data (live-verified).

No orphan Tree-comment Tree references were observed in canonical LoveBud (live: 0 rows).

Decision:

```text
Tree-comment authority = LOVEBUD_CANONICAL
```

Simplification should happen only after runtime contracts have stopped using legacy compatibility fields.

## 4.7 Social counts / dedup / idempotency / audit

LoveBud contains the more mature operational lineage:

- additional generic-target synchronization constraints;
- triggers that synchronize legacy/generic social target representation for audit/idempotency rows;
- more operational indexes;
- current production rows/history.

**Live reconciliation (2026-08-16): no triggers exist in the live LoveBud catalog** — the documented `trg_social_audit_log_sync_generic_target` and `trg_social_idempotency_sync_generic_target` triggers are not present (`pg_trigger` returns none). The live schema is FK- and index-driven only.

LoveTree uses more direct FK-oriented schema definitions (live-verified; identical constraint/index sets to LoveBud).

Live `tree_social_counts`: LoveBud 6 rows, LoveTree 7 rows (no orphan assertion made; FK `tree_social_counts.tree_id → trees.id` exists live). The earlier two-orphan-social-count claim belongs to the historical snapshot.

Decision:

```text
social/idempotency/audit semantic authority = LOVEBUD_CANONICAL
LoveTree definitions                         = IMPLEMENTATION_REFERENCE_ONLY
strict FK expansion                          = HOLD_LEGACY_ORPHAN_CLASSIFICATION
```

---

## 5. LoveTree 7-Tree / 4-Memory data classification

No private text/content was emitted during classification. IDs and owner subjects were compared through hashes/aggregate relations only.

### 5.1 Ownership overlap

The seven LoveTree Trees are owned by three distinct owner subjects (live-verified: 3 distinct non-null `owner_id` values, 0 null).

- Owner group A: 1 Tree, 0 Memories; owner subject does **not** currently match a canonical LoveBud `users.id`.
- Owner group B: 2 Trees, 1 Memory; owner subject matches a canonical LoveBud user.
- Owner group C: 4 Trees, 3 Memories; owner subject matches a canonical LoveBud user.

Therefore:

```text
6 / 7 LoveTree Trees map to existing canonical LoveBud user identities.
4 / 4 LoveTree Memories belong to those matched-owner Trees.
1 / 7 LoveTree Trees has unresolved owner mapping and has no Memory rows.
```

**Live reconciliation (2026-08-16):** the 7/4 row counts and 3-distinct-owner claim are live-verified. The "maps to canonical `users.id`" matching was derived from the historical snapshot lineage (the live catalog has no `users` table); it remains a documented-match result pending #4006 stable-account verification against the current lineage.

### 5.2 Collision / duplicate signals

Hash-only comparison found:

```text
Tree ID collisions with canonical LoveBud:       0 / 7
Memory ID collisions with canonical LoveBud:     0 / 4
owner + client_key matches in canonical LoveBud: 0 / 7
```

This means the records are **not proven duplicates** of canonical records by the strongest existing stable keys checked.

It also means they must not be silently discarded merely because two owner subjects already exist in the canonical user table.

### 5.3 Structural health

LoveTree data observed (live-verified 2026-08-16):

```text
7 / 7 Trees are public
4 / 4 Memories are public
4 / 4 Memories resolve to an existing LoveTree Tree
0 orphan Memories
7 / 7 Trees have client_key (7 trees, 0 null client_key)
4 / 4 Memories have client_key
4 / 4 Memories have sort_order
```

### 5.4 Classification

```text
Owner B: 2 Trees / 1 Memory → MIGRATE_CANDIDATE
Owner C: 4 Trees / 3 Memories → MIGRATE_CANDIDATE
Owner A: 1 Tree / 0 Memory   → HOLD_OWNER_MAPPING
```

`MIGRATE_CANDIDATE` does not authorize copying yet. Before migration, #4006 identity mapping must prove that the matching legacy auth subjects resolve to the same stable app accounts, and a private/non-public payload comparison must confirm these are intended user records rather than preview/test artifacts.

The unresolved owner Tree remains `HOLD` until its identity/provenance is known.

---

## 6. Canonical LoveBud legacy-data compatibility findings

The canonical candidate is clearly the stronger data authority, but it is not a clean greenfield schema.

Observed legacy compatibility state (historical snapshot):

```text
2 Trees with null owner/title/visibility/timestamps/keywords
125 orphan Memories across 45 missing Tree IDs
8 orphan Tree-like rows across 1 missing Tree ID
2 orphan Tree-social-count rows
0 orphan Tree comments
1 Memory with blank source_type
```

**Live reconciliation (2026-08-16):** the current live `neondb` snapshot does **not** reproduce any of these legacy conditions — live Trees are 6 public / 1 private with 0 null `owner_id`; all 5 Memories resolve to an existing Tree; and the strict FKs (`memories.tree_id → trees.id`, `memories.parent_id → memories.id`, `tree_likes.tree_id → trees.id`, `tree_comments.tree_id → trees.id`, `tree_social_counts.tree_id → trees.id`, `tree_view_dedup_events.tree_id → trees.id`) are enforced live. The legacy conditions are therefore properties of the historical snapshot lineage and must remain classified as such (owner confirmation of source lineage required) rather than as current live state.

This is still the main reason **LoveTree's stricter schema cannot be assumed to replace the LoveBud schema without lineage confirmation** — the live catalogs are structurally near-identical, so the meaningful remaining differences are the three extra nullable LoveBud Memory columns and lineage/provenance questions, not a wholesale constraint gap.

The correct strategy remains additive convergence plus deliberate legacy classification.

No deletion/repair inference is made by this audit. Historical rows may represent deleted Tree history, old fixtures, migration residue, or intentionally retained legacy state; each category must be determined from provenance/runtime contracts before destructive action.

---

## 7. Canonical schema vNext decision

Canonical vNext should begin from the LoveBud production lineage (candidate canonical authority; the 36/45/287 historical snapshot requires owner lineage confirmation). Per the live-verified 2026-08-16 catalogs, the two databases are structurally near-identical: the dimensions previously framed as "LoveTree improvements to port" (Memory `client_key`/`sort_order`, supporting indexes/uniqueness, Tree owner index, Tree/Memory visibility+created indexes, the 5 enums incl. `unlisted`, JSONB emotion tags, Trees core NOT NULL shape, current FKs, unconditional `tree_likes` uniqueness) are **already present in both live databases**. vNext therefore contains no pending cross-database schema port for those dimensions; the remaining vNext decisions are product/runtime semantics (e.g. sortOrder reorder), the LoveBud-only nullable Memory columns, lineage/provenance confirmation, and the separate PostgreSQL major-version platform decision.

### 7.1 Keep as canonical now

```text
LoveBud / 133-relovetree production lineage (candidate canonical authority; 36/45/287 historical snapshot = HISTORICAL_NOT_REPRODUCED, owner lineage confirmation required)
LoveBud Tree/Memory IDs and production data
Tree ownership through trees.owner_id (text NOT NULL live; no users table / owner_id→users FK exists live)
LoveBud social idempotency/audit/rate-limit contracts
LoveBud visibility-revocation security contracts
LoveBud generic social target compatibility until runtime is converged
```

The earlier "users/account-linked ownership lineage" and "soft-delete Tree-like semantics" bullets reflected the non-reproduced historical snapshot (no `users` table live; `tree_likes` uniqueness is the identical unconditional `(tree_id, owner_id)` index in both live DBs). That snapshot evidence is preserved only as `HISTORICAL_NOT_REPRODUCED` (§4/§6) and is not asserted as current canonical state.

### 7.2 Already present in both live databases (no port required)

Live-verified 2026-08-16 — none of these is a pending LoveTree→LoveBud port:

```text
Memory client_key (text, nullable)      = already present in both live DBs (memories_tree_client_key_uniq)
Memory sort_order (int4, nullable)      = already present in both live DBs (memories_tree_sort_order_uniq_partial)
supporting indexes/uniqueness           = already present in both live DBs
Tree owner lookup index                 = trees_owner_id_idx present in both live DBs
Tree/Memory visibility+created indexes  = trees_visibility_created_at_idx / memories_visibility_created_at_idx present in both live DBs
```

### 7.3 Explicitly do not port wholesale

The following are genuine non-port / HOLD items (not already-live dimensions):

```text
PostgreSQL 18 as a platform upgrade       = HOLD — separate runtime/operations decision with its own compatibility/rollback evidence; NOT framed as a LoveTree schema-port difference
LoveTree database as production authority = NO — canonical direction remains LoveBud / 133-relovetree lineage
Wholesale NOT NULL / FK tightening and enum/check normalization as a blanket action = HOLD — no live gap exists (Trees core NOT NULL, current FKs, and the 5 enums incl. unlisted are already aligned in both live DBs); blanket tightening is not authorized
LoveBud-only nullable Memory columns (connection_reason, discovery_date, video_offset_seconds) = HOLD — product decision required (retain/retire); do not silently copy to LoveTree
Destructive handling of historical orphan/null/soft-delete evidence = HOLD — HISTORICAL_NOT_REPRODUCED pending owner lineage confirmation; no deletion/repair inference
```

PostgreSQL 17→18 should be a separate platform upgrade with its own compatibility/rollback evidence, not bundled into cross-database convergence.

---

## 8. Proposed branch-first convergence sequence

### Stage 0 — freeze semantic authority, not runtime development

- `133-relovetree` remains canonical candidate.
- LoveTree DB remains intact and readable.
- Do not introduce permanent dual writes.
- Continue runtime work only behind APIs/contracts that can target the future shared authority.

### Stage 1 — additive schema prototype on a Neon branch

Create a child branch from canonical Neon and test only additive vNext candidates first.

Initial candidates (live reconciliation 2026-08-16: these schema shapes already exist in both live DBs; the additive branch prototype was executed and proven on `br-bitter-shape-a1yp6iup`, §C):

- nullable Memory `client_key`;
- nullable Memory `sort_order`;
- non-destructive supporting indexes where justified.

Do not add strict FK/NOT NULL/enum conversion in this first branch.

### Stage 2 — runtime compatibility

Shared Cloudflare API adapters must support:

- existing canonical rows where new fields are null;
- new writes populating client keys;
- explicit ordering only where product contracts define it;
- existing visibility semantics.

### Stage 3 — stable account mapping

Coordinate with #4006:

- establish stable app account identity;
- prove Firebase/Neon Auth subjects map to the same account;
- do not rewrite ownership based on email guesswork.

### Stage 4 — LoveTree data migration rehearsal

On a temporary canonical branch:

- migrate only the six matched-owner Tree records + four dependent Memories after provenance confirmation;
- preserve original IDs because current collision check is clean;
- preserve current visibility/content semantics;
- verify row counts and API response parity;
- keep the unresolved-owner Tree out of automatic import.

If provenance later proves some records are test-only, classify them before production migration instead of copying them by default.

### Stage 5 — legacy orphan classification

Before strict FK convergence, classify canonical orphan data:

- missing-Tree Memories;
- orphan Tree likes;
- orphan social counts;
- two structurally inert null Tree rows (historical snapshot lineage only — live has 0 null-owner_id and 0 null-visibility Tree rows);
- blank source type row (historical snapshot lineage only — none observed among the 5 live Memories).

Possible final treatments include preserve-in-place, archive, canonical parent restoration, or explicit legacy quarantine, but none is selected without evidence.

### Stage 6 — optional constraint tightening

Only after Stage 5:

- evaluate Tree/Memory FKs;
- evaluate NOT NULL tightening;
- evaluate enum/check normalization;
- simplify transitional social fields/triggers only after all runtime consumers have converged.

---

## 9. Relationship to shared backend / auth work

This audit supports #4004's target:

```text
LoveBud ─┐
         ├→ shared Cloudflare API → canonical Neon
LoveTree ┘
```

It also strengthens the requirement in #4006 that authentication-provider IDs must stop being the permanent business-account identity.

The fact that two of three LoveTree owner subjects already match canonical `users.id` is useful migration evidence, but it is **not** sufficient to skip a stable account/identity mapping layer.

---

## 10. Immediate next safe work

The next database mutation, if authorized, should be **only on a temporary Neon branch** and should test an additive canonical-vNext slice.

Recommended first schema prototype (live reconciliation 2026-08-16: the client_key/sort_order schema shape already exists in both live databases; the additive branch prototype was executed and proven on `br-bitter-shape-a1yp6iup`, §C — remaining work is runtime/product write-contract validation, not schema porting):

```text
Memory client_key (nullable compatibility)
Memory sort_order (nullable compatibility)
new-write/index contract validation
```

Separately, #4006 can test Neon Auth on its own non-production Neon branch without touching production auth.

Those two tracks can run in parallel because one tests domain schema evolution and the other tests identity infrastructure.

---

## A. Exact schema-diff coverage matrix

The following table documents the completeness of each #4005-required schema dimension in this audit document. `SCHEMA_AUTHORITY_CONFIRMED` means the current repository source or read-only DB inspection supports the claim; `CURRENT_LIVE_DB_NOT_REVERIFIED` means fresh live access was not available at the time that specific row was last written (rows are live-verified 2026-08-16 unless stated otherwise).

| Dimension | Coverage in this doc | Status |
|---|---|---|
| Schemas | live: LoveBud `neondb` = public + drizzle (drizzle.__drizzle_migrations, 0 rows applied); LoveTree `neondb` = public; no neon_auth in either production branch | SCHEMA_AUTHORITY_CONFIRMED (live 2026-08-16) |
| Tables | live (LoveBud `neondb`): comments, memories, reactions, social_audit_log, social_idempotency, social_rate_limits, tree_comments, tree_likes, tree_social_counts, tree_view_dedup_events, trees (11); live (LoveTree `neondb`): same 11-table set. No `users`, `community_*`, `ai_logs`, `schema_migration_ledger`, or `tree_appreciation_orders` table exists live (historical docs claimed these). | SCHEMA_AUTHORITY_CONFIRMED (live) |
| Columns | exhaustive live per-column matrix captured: LoveBud 100 columns, LoveTree 97 columns; exact diff = LoveBud-only `memories.connection_reason` (text), `memories.discovery_date` (date), `memories.video_offset_seconds` (int4), all nullable | COMPLETE (live) |
| Types | live: text, int4, jsonb, date, timestamptz, plus 5 user-defined enum types in BOTH databases; NO uuid-typed application columns in `neondb` (all IDs are text); the legacy `lovebud` database (separate lineage) uses uuid ids | SCHEMA_AUTHORITY_CONFIRMED (live) |
| Nullability | live per-column matrix captured (NOT NULL enforced via named CHECK `x_not_null` constraints, e.g. `trees_owner_id_not_null`); `trees.owner_id` is TEXT NOT NULL live; 0 null owner_id rows | COMPLETE (live) |
| Defaults | live: no `gen_random_uuid()` defaults in `neondb` (ids are client-supplied text); `created_at`/`updated_at` timestamptz NOT NULL with defaults; `tree_social_counts.like_count`/`view_count`/`request_count` default 0; full per-table default matrix captured | COMPLETE (live) |
| PK | live: every table PK is `text` (e.g. `trees_pkey` on `trees.id text`, `memories_pkey` on `memories.id text`); `tree_social_counts` PK = `tree_id text`; `tree_appreciation_orders` does not exist live; the legacy `lovebud` lineage uses uuid PKs | SCHEMA_AUTHORITY_CONFIRMED (live) |
| FK | live FK set (both databases, identical): memories.tree_id→trees.id, memories.parent_id→memories.id, comments.memory_id→memories.id, reactions.memory_id→memories.id, social_audit_log.memory_id→memories.id, social_idempotency.target_memory_id→memories.id, social_rate_limits.memory_id→memories.id, tree_comments.tree_id→trees.id, tree_likes.tree_id→trees.id, tree_social_counts.tree_id→trees.id, tree_view_dedup_events.tree_id→trees.id. No owner_id→users FK exists (no users table live). `tree_appreciation_orders.tree_id→trees(id)` remains source-grounded migration contract only (table absent live). | COMPLETE (live) |
| UNIQUE | live: memories(tree_id, client_key), partial memories(tree_id, sort_order) WHERE sort_order IS NOT NULL, trees(owner_id, client_key), tree_likes(tree_id, owner_id), reactions(memory_id, owner_id, type), social_idempotency(actor_id, operation, idempotency_key), tree_view_dedup unique — identical in both databases | SCHEMA_AUTHORITY_CONFIRMED (live) |
| CHECK | live: named NOT NULL check constraints exist across all tables in both databases (e.g. `trees_id_not_null`, `memories_title_not_null`, `comments_body_not_null`); LoveBud names are auto-generated numeric forms, LoveTree uses semantic names; no domain-value CHECK constraints observed | COMPLETE (live) |
| Indexes | live: 33 indexes in each database with identical semantics (trees.owner_id, trees.visibility+created_at, memories.tree_id, memories.visibility+created_at, social audit/idempotency/rate-limit/dedup operational indexes, comments/reactions memory+owner indexes) | SCHEMA_AUTHORITY_CONFIRMED (live) |
| Enums | live: both LoveBud and LoveTree define the same 5 enums — comment_status (visible, deleted), reaction_type (like, love, laugh, wow, sad, angry), social_outcome (ok, duplicate, not_found, forbidden, rate_limited, error), source_type (youtube, video, song, book, person, travel, other, link), visibility (private, unlisted, public) | COMPLETE (live; corrects earlier "LoveBud: none" claim) |
| Triggers | live: none in either database (`pg_trigger` returns zero non-internal triggers); earlier documented `trg_social_audit_log_sync_generic_target` / `trg_social_idempotency_sync_generic_target` are not present | COMPLETE (live; corrects earlier claim) |
| Views | none live (both databases) | SCHEMA_AUTHORITY_CONFIRMED (live) |
| Materialized views | none live (both databases) | SCHEMA_AUTHORITY_CONFIRMED (live) |
| Extensions | live: plpgsql in both; NO pgcrypto (corrects earlier LoveBud claim) | SCHEMA_AUTHORITY_CONFIRMED (live) |
| Privileges/grants | live: no table carries a non-default `relacl`; no custom grants/revokes; dedicated read-only role `lb_ro_709d5f3e68f774d2` exists on LoveBud `neondb` for this audit | COMPLETE (live) |
| RLS | no RLS policies live (both databases) | SCHEMA_AUTHORITY_CONFIRMED (live) |

All 18 #4005-required dimensions are now backed by fresh live read-only catalog evidence collected 2026-08-16 (`information_schema` + `pg_catalog` via the dedicated `lb_ro_…` read-only role on LoveBud and read-only owner-role catalog queries on LoveTree). Historical claims that the live catalog does not reproduce (users/community/ai_logs tables, pgcrypto, triggers, 36/45/287 snapshot) are explicitly marked historical and require owner lineage confirmation before being re-asserted.

## B. Persisted ownership-subject inventory

The following tables and columns persist actor/owner subjects. **Live-verified 2026-08-16** — every column below was observed in the live `neondb` catalog of the applicable database; all subject columns are `text NOT NULL` (no UUID-shaped application columns, no direct Firebase UID column). Firebase/provider subjects are resolved through the auth session layer and mapped to these text subjects at write time; the raw Firebase subject is not persisted.

| Table | Column | Semantic role | Live subject shape | FK/constraint evidence (live) | Runtime writers | Future app_account migration impact | Confidence |
|---|---|---|---|---|---|---|---|
| trees | owner_id | Tree ownership authority | `text NOT NULL` (2 distinct non-null live owners; 0 null) | no owner_id FK (no users table live); unique with client_key (`trees_owner_client_key_uniq`); index `trees_owner_id_idx` | create_owner_tree, fork_public_tree | Must map to app_account (no `users` table to reference) | SCHEMA_AUTHORITY_CONFIRMED (live) |
| memories | tree_id → trees.owner_id | Indirect Memory ownership authority | Transitive through trees.owner_id | live FK `memories.tree_id → trees.id`; 0 orphan-tree Memories live | create_owner_memory, update_owner_memory | Transitive via tree ownership | SCHEMA_AUTHORITY_CONFIRMED (live) |
| tree_likes | owner_id | Actor identity for likes | `text NOT NULL` (0 rows live) | live unique `tree_likes_tree_owner_uniq`; FK `tree_likes.tree_id → trees.id` | toggle_like | Must map to app_account | SCHEMA_AUTHORITY_CONFIRMED (live) |
| tree_comments | owner_id | Actor identity for comments | `text NOT NULL` (0 rows live; column is `owner_id`, not `author_id`) | FK `tree_comments.tree_id → trees.id`; index `tree_comments_owner_id_idx` | create_tree_comment | Must map to app_account | SCHEMA_AUTHORITY_CONFIRMED (live) |
| comments | owner_id | Memory-comment actor | `text NOT NULL` (0 rows live) | FK `comments.memory_id → memories.id`; index `comments_owner_id_idx` | memory comment routes | Must map to app_account | SCHEMA_AUTHORITY_CONFIRMED (live) |
| reactions | owner_id | Memory-reaction actor | `text NOT NULL` (0 rows live) | unique `reactions_memory_owner_type_uniq`; FK `reactions.memory_id → memories.id` | memory reaction routes | Must map to app_account | SCHEMA_AUTHORITY_CONFIRMED (live) |
| social_audit_log | actor_id | Audit trail actor | `text NOT NULL` (0 rows live) | index `social_audit_log_actor_id_idx`; FK `memory_id → memories.id` | Social write routes | Audit identity must survive account migration | SCHEMA_AUTHORITY_CONFIRMED (live) |
| social_idempotency | actor_id | Idempotency key scope | `text NOT NULL` (0 rows live) | unique `social_idempotency_actor_op_key_uniq` | Social write routes | Idempotency scope must survive account migration | SCHEMA_AUTHORITY_CONFIRMED (live) |
| social_rate_limits | actor_id | Rate limit subject | `text NOT NULL` (0 rows live) | index `social_rate_limits_scope_actor_idx` | Rate-limit middleware | Rate-limit identity must survive account migration | SCHEMA_AUTHORITY_CONFIRMED (live) |
| tree_view_dedup_events | actor_key | View deduplication scope | `text NOT NULL` (0 rows live; column is `actor_key`, not `actor_id`) | unique `tree_view_dedup_event_uniq`; index `tree_view_dedup_tree_actor_idx` | View recording | Dedup scope must survive account migration | SCHEMA_AUTHORITY_CONFIRMED (live) |

**Count**: 10 tables, 10 subject columns live-verified. No `users` table exists live, so no `owner_id/actor_id → users.id` FK is present; the documented `users`-referencing inventory (12 tables incl. community_* / ai_logs) belongs to the historical snapshot lineage and requires owner confirmation. No direct Firebase UID column was observed. Values were inspected only through aggregate counts and column metadata — **no raw UID, email, provider subject, or private identifier was emitted in this document.**

## C. Memory lineage current-authority conclusion

### clientKey / sortOrder schema readiness

The additive schema is branch-proven on `br-bitter-shape-a1yp6iup`. No conflict with current-main schema exists. `modal_compute/memory_writes.py` currently rejects both fields via the PATCH allowlist.

### Active writer overlap

| Component | Active owner | Status | Impact on #4007 |
|---|---|---|---|
| modal_compute/memory_writes.py | #3951 (CLOSED), #4048 (MERGED) | resolved; CI GREEN | #4007 docs-only — must not touch runtime |
| Migration manifest | #3846/#3998 | MERGED | Documented; no change needed |
| Memory proxy boundary | #3999 | MERGED | No longer blocking |
| Emotion tags validation | #3992 | MERGED | No longer blocking |
| Parent visibility fix | #3969 | MERGED | No longer blocking |

## D. Canonical migration authority semantics

Current `db/migration-provenance/canonical-migrations.json`:

```
status: ADOPTION_REQUIRED
migrations: [
  { id: "20260802094500_bootstrap-migration-ledger" },
  { id: "20260812213000_add-tree-appreciation-orders" }
]
```

Key semantic distinction:

- **CANONICAL CATALOG POPULATED**: Yes (2 entries) — catalog entry addition is permitted while ADOPTION_REQUIRED.
- **PRODUCTION_SCHEMA_EXISTS**: NOT REPRODUCED BY LIVE CATALOG (2026-08-16) — the #4043-based claim that `public.tree_appreciation_orders` already exists in Production/default-branch Neon is **not reproduced** by the fresh live read-only catalog: the table is absent from both `neondb` and `lovebud` databases on the production branch `br-little-fire-a18brh25` (as are `schema_migration_ledger` and `users`). This is recorded as `CATALOGUED_BUT_ABSENT_LIVE` and requires **owner reconciliation** (the #4043 activation claim may reference a different branch/database/project or predate a reset). It is NOT treated as a new #4005 convergence apply and does not grant adoption authority.
- **CANONICAL RUNNER ADOPTION / ADOPTION ATTESTED**: No — `status: ADOPTION_REQUIRED`; a separately approved adoption baseline is required before any status transition.
- **#4005_NEW_CONVERGENCE_APPLY_AUTHORIZED**: No — a new #4005 convergence action requires ACTIVE manifest + runner protocol compliance; not authorized.
- **PRODUCTION_MIGRATION (new apply)**: NOT_AUTHORIZED — preserved for NEW #4005 convergence action. Historical/current Production schema activation claims (PRODUCTION_SCHEMA_EXISTS above) are now classified `CATALOGUED_BUT_ABSENT_LIVE` pending owner reconciliation and do not grant adoption authority.

### D.1 Adoption-gate verification item (schema-drift audit 2026-08-16)

Read-only drift audit (reconciliation basis `4814190982655c55e72bc01d3d2b6663138ecfa6` retained as historical provenance; earlier basis `c5de1d14e7b0c4b9c07586cc6655f7d4c9d2ffbd`) confirmed all repository-side dimensions are drift-free: both catalog checksums match the on-disk SQL byte-for-byte, both expected-schema critical objects correspond 1:1 to the two migrations' postconditions, and the runtime `tree_appreciation_orders` writer (`modal_compute/appreciation_orders.py`) matches migration #2's DDL exactly. **The live-catalog dimension is now upgraded from `INSUFFICIENT_LIVE_EVIDENCE` to live-verified (2026-08-16)** via the dedicated `lb_ro_…` read-only role on LoveBud and read-only owner-role catalog queries on LoveTree: the migration-ledger critical objects (`public.schema_migration_ledger`, `public.tree_appreciation_orders`) are **catalogued but absent from the live catalog** on the production branch (both `neondb` and `lovebud` databases), which is recorded as `CATALOGUED_BUT_ABSENT_LIVE` and requires owner reconciliation.

One flagged adoption-gate verification item (NOT a code change; no PR required now):

- Migration `20260812213000` declares `tree_id TEXT ... REFERENCES public.trees(id)`. The db-engine proof applies it only against a synthetic TEXT parent (`appreciation-order-schema-3982.cjs` creates `trees(id TEXT PRIMARY KEY)`). **Live-verified 2026-08-16**: the live catalog confirms `public.trees.id` is `text` (PK) and `public.trees.owner_id` is `text NOT NULL`, so the TEXT FK is type-consistent with the parent PK — the prior uuid-incompatibility concern does NOT apply. This is now backed by fresh live catalog evidence (previously source-grounded only).
- Resolution: `trees.id` TEXT is live-verified (not merely source-grounded). The migration #2 target object itself (`public.tree_appreciation_orders`) is `CATALOGUED_BUT_ABSENT_LIVE` on the production branch — the catalog entry exists and its SQL checksum matches on-disk, but the object does not exist in the live catalog; runner/adoption authority remains `ADOPTION_REQUIRED`/HOLD pending owner reconciliation of the #4043 activation claim.

Therefore `ADOPTION_REQUIRED → catalog must be empty` is incorrect. The current-main authority proves catalog entries can exist while the manifest stays ADOPTION_REQUIRED. The actual gate is Production/runner activation, not catalog entry addition.

## 11. Verdict

```text
FINAL_VERDICT                             = GO_CANONICAL_SCHEMA_BRANCH_PROTOTYPE (additive branch prototype proven; see scoping below)
CANONICAL_DATA_AUTHORITY_DIRECTION        = GO (LoveBud / 133-relovetree lineage) — with owner-action gate: the documented canonical snapshot (36 users / 45 Trees / 287 Memories + users/community/ai_logs tables) is NOT reproducible from the live catalog on any LoveBud branch/database; owner lineage confirmation of the snapshot source DB is REQUIRED before data-authority acceptance is claimed
SCHEMA_DIFF_COMPLETENESS                  = COMPLETE (all 18 #4005-required dimensions live-verified 2026-08-16 via dedicated `lb_ro_…` read-only role + owner-role catalog queries; LoveBud `neondb` vs LoveTree `neondb`; see Appendix A)
EXACT_SCHEMA_DIFF                         = COMPLETE (live fingerprint diff: LoveBud 100 columns vs LoveTree 97 — exactly 3 extra nullable `memories` columns on LoveBud: `connection_reason`, `discovery_date`, `video_offset_seconds`; all other dimensions — constraints, indexes, enums, triggers, views, extensions, RLS, privileges — identical)
SEMANTIC_DECISION_RECONCILIATION          = PASS (historical-vs-current contradictions removed: client_key/sort_order and their uniqueness dispositions are SAME_SEMANTIC_CURRENTLY (both live DBs); tree_likes uniqueness identical in both live DBs; "two legacy null Tree rows" and 287-Memory references restricted to the non-reproduced historical snapshot)
CANONICAL_SCHEMA_VNEXT                   = DEFINED (§7 — no pending cross-database schema ports; all previously "LoveTree-to-port" dimensions already present in both live DBs; remaining vNext decisions = product/runtime semantics, LoveBud-only Memory columns, lineage confirmation, PostgreSQL platform decision)
LIVE_36_45_287_LINEAGE                    = OWNER_CONFIRMATION_REQUIRED (classified HISTORICAL_NOT_REPRODUCED; not re-asserted as current live state)
CURRENT_DEFAULT_APPRECIATION_SCHEMA       = ABSENT (public.tree_appreciation_orders absent live on the production branch — CATALOGUED_BUT_ABSENT_LIVE, §D)
ISSUE4005_ACCEPTANCE                      = PARTIAL (exact schema diff now live-satisfied; canonical DATA snapshot 36/45/287 not reproducible live → owner lineage confirmation required before full acceptance)
OWNERSHIP_SUBJECT_INVENTORY_COMPLETENESS  = COMPLETE (10 tables, 10 subject columns live-verified; no `users` table exists live so no owner_id→users FK; `trees.owner_id` = TEXT NOT NULL; no direct Firebase UID column observed; values inspected via aggregates/column metadata only)
MEMORY_LINEAGE_SCHEMA_READINESS           = BRANCH_PROVEN (go_additive)
RUNTIME_IMPLEMENTATION_AUTHORITY          = HOLD (#4007 is docs/audit contract only; runtime implementation requires a separate child issue; sortOrder product/reorder semantics unresolved; canonical migration adoption HOLD; Production apply NOT AUTHORIZED)
CANONICAL_MIGRATION_ADOPTION              = HOLD (status ADOPTION_REQUIRED; catalog population allowed)
PRODUCTION_MIGRATION                      = NOT AUTHORIZED
MEMORY_RUNTIME_IMPLEMENTATION_IN_THIS_PR  = NOT PERFORMED (docs-only scope preserved)
```

Scoping: `GO_CANONICAL_SCHEMA_BRANCH_PROTOTYPE` covers only the executed, verified additive Memory lineage prototype on the isolated Neon child branch (287/287 rows, identical checksums, uniqueness probe proven). It does not authorize Production convergence: `PRODUCTION_MIGRATION` remains `NOT AUTHORIZED` and `CANONICAL_MIGRATION_ADOPTION` remains `HOLD`. Branch proof is not Production authority.

With constraints:

```text
CANONICAL_DATA_AUTHORITY = LoveBud / 133-relovetree lineage
LOVETREE_DB              = migration source / implementation reference, not second writer
LOVETREE_6_TREES_4_MEMS  = MIGRATE_CANDIDATE pending identity + provenance confirmation
LOVETREE_1_TREE           = HOLD_OWNER_MAPPING
STRICT_FK_CONVERGENCE     = HOLD until canonical orphan classification
ENUM/JSONB_CONVERSION     = HOLD
POSTGRES_18_UPGRADE       = separate future track
PRODUCTION_MUTATION       = NONE
```
