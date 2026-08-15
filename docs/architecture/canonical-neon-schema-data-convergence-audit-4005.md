# Canonical Neon Schema + Data Authority Audit — #4005

Parent: #4004  
Track: #4005  
Audit date: 2026-08-12  
LoveBud authoritative main at branch creation: `cc6cb26854e4cc692d3109debe05b0de1ab23a89`  
LoveTree authoritative main observed during audit: `06dfb7e52a3c5a96d309142bbeb06a3445a18f96`  

**FINAL RECONCILIATION BASIS (re-queried 2026-08-16):**

LoveBud alignment basis (current authoritative main): `4814190982655c55e72bc01d3d2b6663138ecfa6` (re-queried 2026-08-16; prior reconciliation basis `c5de1d14e7b0c4b9c07586cc6655f7d4c9d2ffbd` retained as historical provenance, not current).

PR #4007: a plain merge-forward from current main completed without conflicts (historical/intermediate merge-forward commit `86ab1ba91345d14ed208ac4772cd158281281aa2`); the current PR head is authoritative from GitHub PR metadata and is intentionally not self-pinned in this document.
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

Observed PostgreSQL server:

```text
17.10
```

Observed application counts:

```text
public.users          36
public.trees          45
public.memories       287
public.tree_likes      9
public.tree_comments   3
```

There are 34 distinct non-null Tree owners, and all currently non-null Tree owner IDs resolve to a `public.users` row.

Additional mature state includes:

```text
ai_logs
community_posts
community_comments
community_moderation_logs
social_audit_log
social_idempotency
social_rate_limits
tree_view_dedup_events
```

This project also contains the production lineage of the security/concurrency work currently represented in LoveBud contracts.

### 3.2 Separate LoveTree project: `lovetree-limone`

Observed PostgreSQL server:

```text
18.4
```

Observed application counts:

```text
public.trees          7
public.memories       4
public.tree_likes     0
public.tree_comments  0
```

It has no `public.users` table.

### 3.3 Authority decision

The existing LoveBud / `133-relovetree` database lineage is the correct **candidate canonical production data authority**.

Reasons:

1. it contains substantially more real application state;
2. it has the current account/user relation used by Tree ownership;
3. it contains the mature social/idempotency/audit/dedup lineage;
4. current LoveBud product/security contracts are already built around its semantics;
5. moving authority to the smaller LoveTree database would create unnecessary data migration and security-contract risk.

This does **not** mean the LoveTree schema should be ignored. Several LoveTree schema refinements are useful candidates to port additively into canonical schema vNext.

---

## 4. Structural comparison

## 4.1 Schemas / extensions / RLS / views

### LoveBud candidate

Observed non-system schemas:

```text
public
drizzle
```

Extensions:

```text
plpgsql
pgcrypto
```

Public RLS policies: none observed.  
Public views: none observed.

### LoveTree

Observed non-system schema:

```text
public
```

Extension:

```text
plpgsql
```

Public RLS policies: none observed.  
Public views: none observed.

Neither database currently has a `neon_auth` schema.

## 4.2 Enum strategy

LoveBud currently uses text/varchar + checks or runtime validation for the core values inspected; no public PostgreSQL enum types were observed.

LoveTree defines:

```text
comment_status  = visible | deleted
reaction_type   = like | love | laugh | wow | sad | angry
social_outcome  = ok | duplicate | not_found | forbidden | rate_limited | error
source_type     = youtube | video | song | book | person | travel | other | link
visibility      = private | unlisted | public
```

This is **not** a safe wholesale migration target.

Notably, LoveTree includes `unlisted`, while current canonical LoveBud production Tree visibility data observed is `public` plus two legacy null rows. Adding `unlisted` is a product-policy decision, not merely a storage refactor.

Current LoveBud Memory source-type data also contains one blank `source_type` value, which would fail a strict LoveTree-style enum conversion without prior classification/normalization.

Decision:

```text
ENUM_WHOLESALE_PORT = HOLD
```

Use existing canonical semantics during initial convergence. Any enum conversion requires a separate compatibility/data-cleanup decision.

## 4.3 Trees

### Canonical LoveBud characteristics

- `owner_id`, `title`, `visibility`, `keywords`, timestamps currently permit legacy null state in schema/data.
- `memo` and `artist` are non-null.
- `client_key` exists.
- unique `(owner_id, client_key)` exists.
- two legacy Tree rows currently have null owner/title/visibility/etc.; both have zero current Memory, social-count and Tree-comment dependencies.

### LoveTree refinements

- stronger non-null requirements;
- enum visibility;
- JSONB keywords;
- index on `owner_id`;
- index on `(visibility, created_at)`;
- same owner/client-key uniqueness concept.

### Decision

```text
Tree authority                     = LOVEBUD_CANONICAL
owner/client-key uniqueness        = SAME_SEMANTIC
owner index                         = LOVETREE_IMPROVEMENT_TO_EVALUATE
visibility+created index            = LOVETREE_IMPROVEMENT_TO_EVALUATE
NOT NULL wholesale                  = HOLD_LEGACY_DATA
JSONB keywords conversion           = HOLD_NO_CURRENT_NEED
unlisted visibility                 = PRODUCT_DECISION_REQUIRED
```

The two legacy null Tree rows must be classified before tightening nullability. They currently appear structurally inert, but this audit does not authorize deletion.

## 4.4 Memories

### Canonical LoveBud characteristics

- 287 rows;
- `emotion_tags` stored as an array;
- `source_type` and `visibility` stored as text-like values;
- no `client_key` or `sort_order` columns observed;
- current `tree_id` index and visibility index exist;
- parent relationships have no observed orphan-parent rows.

### LoveTree refinements

LoveTree adds:

```text
client_key
sort_order
```

with:

- unique `(tree_id, client_key)`;
- partial unique `(tree_id, sort_order)` when sort order is non-null;
- FK `tree_id → trees.id`;
- self-FK `parent_id → memories.id`;
- index `(visibility, created_at)`;
- JSONB emotion tags;
- enum visibility/source type.

All four current LoveTree Memory rows have both `client_key` and `sort_order` populated.

### Critical canonical-data blocker to strict FK parity

The canonical LoveBud database currently contains:

```text
125 Memories referencing Tree IDs no longer present in public.trees
45 distinct missing Tree IDs
observed orphan-Memory date range: 2026-05-18 through 2026-07-09
```

No orphan `parent_id` references were observed.

Therefore adding an immediate `memories.tree_id → trees.id` FK to canonical production would be unsafe and may fail validation or force destructive handling of historical data.

Decision:

```text
client_key                           = LOVETREE_IMPROVEMENT_TO_PORT_ADDITIVELY
sort_order                           = LOVETREE_IMPROVEMENT_TO_PORT_ADDITIVELY
(tree_id, client_key) uniqueness     = PORT_AFTER_BACKFILL/WRITE_CONTRACT
(tree_id, sort_order) uniqueness     = PORT_AFTER_ORDERING_CONTRACT
parent FK                            = CANDIDATE_AFTER_BRANCH_VALIDATION
tree FK                              = HOLD_LEGACY_ORPHAN_CLASSIFICATION
visibility+created index             = CANDIDATE
ARRAY → JSONB emotion_tags           = HOLD_NO_CURRENT_MIGRATION_JUSTIFICATION
enum visibility/source_type          = HOLD_DATA_AND_PRODUCT_COMPATIBILITY
```

Do not synthesize arbitrary client keys or sort order for 287 existing Memories merely to satisfy a new constraint. Existing data should remain valid while new-write contracts can begin populating the new fields.

## 4.5 Tree likes

Canonical LoveBud uses soft-delete semantics and a partial active-like uniqueness rule:

```text
unique(tree_id, owner_id) where deleted_at is null
```

Observed rows:

```text
total tree_likes:      9
soft-deleted rows:      7
```

LoveTree uses unconditional unique `(tree_id, owner_id)` and has no current like records.

Canonical LoveBud also has 8 Tree-like rows associated with one Tree ID no longer present in `trees`.

Decision:

```text
LoveBud soft-delete like semantics = LOVEBUD_CANONICAL
LoveTree unconditional uniqueness  = DO_NOT_PORT
Tree FK tightening                 = HOLD_LEGACY_ORPHAN_CLASSIFICATION
```

The recent LoveBud/LoveTree social implementations already demonstrate that re-like/restore concurrency behavior is product logic, not a trivial schema equivalence.

## 4.6 Tree comments

LoveBud's Tree-comment lineage is richer and transitional:

- canonical `owner_id` / body / target fields;
- legacy author/display-name and payload/deletion compatibility fields;
- FK to Tree;
- an author FK to `users` for the legacy author field;
- checks that generic target semantics remain Tree-scoped.

LoveTree has the simpler modern surface but no actual Tree-comment data.

No orphan Tree-comment Tree references were observed in canonical LoveBud.

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

Observed LoveBud triggers:

```text
trg_social_audit_log_sync_generic_target
  BEFORE INSERT / UPDATE

trg_social_idempotency_sync_generic_target
  BEFORE INSERT / UPDATE
```

LoveTree uses more direct FK-oriented schema definitions but lacks these production compatibility triggers.

Canonical LoveBud currently also has two social-count rows for Tree IDs no longer present in `trees`.

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

The seven LoveTree Trees are owned by three distinct owner subjects.

- Owner group A: 1 Tree, 0 Memories; owner subject does **not** currently match a canonical LoveBud `users.id`.
- Owner group B: 2 Trees, 1 Memory; owner subject matches a canonical LoveBud user.
- Owner group C: 4 Trees, 3 Memories; owner subject matches a canonical LoveBud user.

Therefore:

```text
6 / 7 LoveTree Trees map to existing canonical LoveBud user identities.
4 / 4 LoveTree Memories belong to those matched-owner Trees.
1 / 7 LoveTree Trees has unresolved owner mapping and has no Memory rows.
```

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

LoveTree data observed:

```text
7 / 7 Trees are public
4 / 4 Memories are public
4 / 4 Memories resolve to an existing LoveTree Tree
0 orphan Memories
7 / 7 Trees have client_key
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

Observed legacy compatibility state:

```text
2 Trees with null owner/title/visibility/timestamps/keywords
125 orphan Memories across 45 missing Tree IDs
8 orphan Tree-like rows across 1 missing Tree ID
2 orphan Tree-social-count rows
0 orphan Tree comments
1 Memory with blank source_type
```

This is the main reason **LoveTree's stricter schema cannot simply replace the LoveBud schema**.

The correct strategy is additive convergence plus deliberate legacy classification.

No deletion/repair inference is made by this audit. Historical rows may represent deleted Tree history, old fixtures, migration residue, or intentionally retained legacy state; each category must be determined from provenance/runtime contracts before destructive action.

---

## 7. Canonical schema vNext decision

Canonical vNext should begin from the LoveBud production lineage, with selected LoveTree improvements added only where they have clear product/runtime value.

### 7.1 Keep as canonical now

```text
LoveBud users/account-linked ownership lineage
LoveBud Tree/Memory IDs and production data
LoveBud soft-delete Tree-like semantics
LoveBud social idempotency/audit/rate-limit contracts
LoveBud visibility-revocation security contracts
LoveBud generic social target compatibility until runtime is converged
```

### 7.2 Port additively first

Highest-confidence LoveTree improvements:

```text
Memory client_key capability
Memory sort_order capability
supporting indexes/uniqueness only after compatibility evidence
Tree owner lookup index if query evidence supports it
Tree/Memory visibility+created indexes if query evidence supports them
```

### 7.3 Explicitly do not port wholesale

```text
PostgreSQL 18 merely because LoveTree already uses it
enum visibility including unlisted
all NOT NULL constraints
ARRAY → JSONB conversions
unconditional Tree-like uniqueness
strict Tree FKs before legacy orphan classification
LoveTree database itself as production authority
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

Initial candidates:

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
- two structurally inert null Tree rows;
- blank source type row.

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

Recommended first schema prototype:

```text
Memory client_key (nullable compatibility)
Memory sort_order (nullable compatibility)
new-write/index contract validation
```

Separately, #4006 can test Neon Auth on its own non-production Neon branch without touching production auth.

Those two tracks can run in parallel because one tests domain schema evolution and the other tests identity infrastructure.

---

## A. Exact schema-diff coverage matrix

The following table documents the completeness of each #4005-required schema dimension in this audit document. `SCHEMA_AUTHORITY_CONFIRMED` means the current repository source or read-only DB inspection supports the claim; `CURRENT_LIVE_DB_NOT_REVERIFIED` means fresh live access was not available at final reconciliation.

| Dimension | Coverage in this doc | Status |
|---|---|---|
| Schemas | public + drizzle (LoveBud), public (LoveTree); no neon_auth in either | SCHEMA_AUTHORITY_CONFIRMED |
| Tables | users, trees, memories, tree_likes, tree_comments, social_audit_log, social_idempotency, social_rate_limits, tree_view_dedup_events, community_posts, community_comments, community_moderation_logs, ai_logs (LoveBud); trees, memories, tree_likes, tree_comments (LoveTree) | SCHEMA_AUTHORITY_CONFIRMED |
| Columns | Core application columns described semantically per table; exhaustive per-column type/nullability/default matrix not emitted (would require fresh live catalog dump) | PARTIAL_NOT_EXHAUSTIVE |
| Types | text/varchar, integer, uuid, boolean, timestamp observed; enum types listed for LoveTree; pgcrypto extension present in LoveBud | SCHEMA_AUTHORITY_CONFIRMED |
| Nullability | Key nullable/non-null patterns identified per table; legacy null rows documented | SCHEMA_AUTHORITY_CONFIRMED |
| Defaults | `gen_random_uuid()` observed for UUID-shaped PKs (e.g. `users.id`, `memories.id`); `trees.id` and `tree_appreciation_orders.tree_id` are TEXT PKs (no `gen_random_uuid()`), per current repository authority; `deleted_at` nullable timestamps; `created_at`/`updated_at` with `now()`. Full per-table default matrix not re-verified against a fresh live catalog. | SCHEMA_AUTHORITY_CONFIRMED (UUID-shaped PKs, TEXT PKs) / CURRENT_LIVE_DB_NOT_REVERIFIED (full per-table matrix) |
| PK | `trees.id` = TEXT (FK contract target; TEXT→UUID conversion prohibited per current authority) — source-grounded via `db/migrations/20260812213000_add-tree-appreciation-orders.sql` (`tree_id TEXT ... REFERENCES public.trees(id)`) plus current repo authority; `tree_appreciation_orders` PK = `tree_id` TEXT — source-grounded; `users.id` = UUID (server-generated `gen_random_uuid()`) per source defaults — source-grounded; remaining application-table PK types were NOT re-verified against a fresh live catalog. | SCHEMA_AUTHORITY_CONFIRMED (trees, tree_appreciation_orders, users) / CURRENT_LIVE_DB_NOT_REVERIFIED (other tables) |
| FK | `tree_appreciation_orders.tree_id` TEXT → `public.trees(id)` — source-grounded (`db/migrations/20260812213000_add-tree-appreciation-orders.sql`); this is consistent with `trees.id` being TEXT. `trees.owner_id` = TEXT (nullable) per current schema foothold; a `trees.owner_id → users.id` FK is NOT asserted as a current canonical fact (source/live authority does not prove the UUID→users.id relationship here) — `INSUFFICIENT_LIVE_EVIDENCE`. `memories.parent_id → memories.id` self-FK and `memories.tree_id → trees.id` FK were NOT re-verified against a fresh live catalog (LoveTree defines `memories.tree_id → trees.id`, which canonically lacks given 125 orphan Memories) — `CURRENT_LIVE_DB_NOT_REVERIFIED` / `INSUFFICIENT_LIVE_EVIDENCE`. | SCHEMA_AUTHORITY_CONFIRMED (tree_appreciation_orders.tree_id→trees) / INSUFFICIENT_LIVE_EVIDENCE (other FKs) |
| UNIQUE | `(owner_id, client_key)` on trees; soft-delete partial unique on tree_likes; LoveTree adds `(tree_id, client_key)` and partial `(tree_id, sort_order)` on memories | SCHEMA_AUTHORITY_CONFIRMED |
| CHECK | No observed named CHECK constraints beyond application-level validation | CURRENT_LIVE_DB_NOT_REVERIFIED |
| Indexes | trees.owner_id, memories.tree_id, memories.visibility, social audit/idempotency operational indexes; LoveTree adds visibility+created_at composite | SCHEMA_AUTHORITY_CONFIRMED |
| Enums | LoveBud: none (text/varchar); LoveTree: comment_status, reaction_type, social_outcome, source_type, visibility | SCHEMA_AUTHORITY_CONFIRMED |
| Triggers | `trg_social_audit_log_sync_generic_target`, `trg_social_idempotency_sync_generic_target` in LoveBud | SCHEMA_AUTHORITY_CONFIRMED |
| Views | None observed in either database | SCHEMA_AUTHORITY_CONFIRMED |
| Materialized views | None observed | SCHEMA_AUTHORITY_CONFIRMED |
| Extensions | LoveBud: plpgsql, pgcrypto; LoveTree: plpgsql | SCHEMA_AUTHORITY_CONFIRMED |
| Privileges/grants | Not exhaustively inventoried; no custom grant/revoke patterns observed in inspected catalog metadata | CURRENT_LIVE_DB_NOT_REVERIFIED |
| RLS | No RLS policies observed in either database | SCHEMA_AUTHORITY_CONFIRMED |

Dimensions marked `CURRENT_LIVE_DB_NOT_REVERIFIED` require fresh live PostgreSQL catalog queries to complete. The repository source (migration files, Drizzle schema definitions) provides partial evidence but does not reflect privilege/check-constraint drift.

## B. Persisted ownership-subject inventory

The following tables and columns persist provider-shaped/Firebase-like actor subjects. SCHEMA_AUTHORITY_CONFIRMED means the column exists in current source; LIVE_VALUE_POPULATION_NOT_REVERIFIED means actual value provenance (Firebase UID vs future app_account) was not re-verified at final reconciliation.

| Table | Column | Semantic role | Current subject shape | FK/constraint evidence | Runtime writers | Future app_account migration impact | Confidence |
|---|---|---|---|---|---|---|---|
| users | id | Primary account identity | UUID (server-generated); linked to Firebase auth subject via auth session, not direct FK | PK; referenced by tree_comments.author_id, tree_likes.owner_id, community_* tables per prior inspection (a `trees.owner_id → users.id` FK is NOT proven by current authority — `trees.owner_id` is TEXT, type-incompatible with a UUID PK FK) | Auth bootstrap, session resolution | HIGH — canonical identity target for #4006 | SCHEMA_AUTHORITY_CONFIRMED (UUID/reference pattern per prior inspection); LIVE_VALUE_POPULATION_NOT_REVERIFIED |
| trees | owner_id | Tree ownership authority | TEXT (nullable) per current schema foothold; UUID→users.id relationship NOT asserted as current canonical fact | no `trees.owner_id → users.id` FK proven by current source/live authority (TEXT vs UUID PK type-incompatible); unique with client_key | create_owner_tree, fork_public_tree | subject-shape mapping pending #4006 identity proof | INSUFFICIENT_LIVE_EVIDENCE (TEXT type source-grounded; FK→users.id not proven) |
| memories | tree_id → trees.owner_id | Indirect Memory ownership authority | Transitive through trees.owner_id | No direct FK (125 orphan Memories); INNER JOIN trees in transaction | create_owner_memory, update_owner_memory | Transitive via tree ownership | SCHEMA_AUTHORITY_CONFIRMED; LIVE_VALUE_POPULATION_NOT_REVERIFIED |
| tree_likes | owner_id | Actor identity for likes | UUID-shaped per prior inspection; UUID→users.id FK not re-verified against fresh live catalog | FK → users.id (prior inspection, INSUFFICIENT_LIVE_EVIDENCE); partial unique (tree_id, owner_id) where deleted_at is null | toggle_like | Must map to app_account | INSUFFICIENT_LIVE_EVIDENCE |
| tree_comments | author_id | Actor identity for comments | UUID-shaped per prior inspection; UUID→users.id FK not re-verified against fresh live catalog | FK → users.id (prior inspection, INSUFFICIENT_LIVE_EVIDENCE) | create_tree_comment | Must map to app_account | INSUFFICIENT_LIVE_EVIDENCE |
| social_audit_log | actor_id | Audit trail actor | UUID-shaped per prior inspection; not re-verified against fresh live catalog | Operational index; used in social audit triggers | Social write routes | Audit identity must survive account migration | INSUFFICIENT_LIVE_EVIDENCE |
| social_idempotency | actor_id | Idempotency key scope | UUID-shaped per prior inspection; not re-verified against fresh live catalog | Operational index | Social write routes | Idempotency scope must survive account migration | INSUFFICIENT_LIVE_EVIDENCE |
| social_rate_limits | actor_id | Rate limit subject | UUID-shaped per prior inspection; not re-verified against fresh live catalog | Operational index | Rate-limit middleware | Rate-limit identity must survive account migration | INSUFFICIENT_LIVE_EVIDENCE |
| tree_view_dedup_events | actor_id | View deduplication scope | UUID-shaped (nullable) per prior inspection; not re-verified against fresh live catalog | Operational index | View recording | Dedup scope optional for unauthenticated views | INSUFFICIENT_LIVE_EVIDENCE |
| community_posts | author_id | Community post author | UUID-shaped per prior inspection; UUID→users.id FK not re-verified | FK → users.id inferred (prior inspection, INSUFFICIENT_LIVE_EVIDENCE) | Community routes | Must map to app_account | INSUFFICIENT_LIVE_EVIDENCE; LIVE_VALUE_POPULATION_NOT_REVERIFIED |
| community_comments | author_id | Community comment author | UUID-shaped per prior inspection; UUID→users.id FK not re-verified | FK → users.id inferred (prior inspection, INSUFFICIENT_LIVE_EVIDENCE) | Community routes | Must map to app_account | INSUFFICIENT_LIVE_EVIDENCE; LIVE_VALUE_POPULATION_NOT_REVERIFIED |
| community_moderation_logs | moderator_id | Moderation actor | UUID-shaped per prior inspection; UUID→users.id FK not re-verified | FK → users.id inferred (prior inspection, INSUFFICIENT_LIVE_EVIDENCE) | Moderation routes | Audit identity | INSUFFICIENT_LIVE_EVIDENCE; LIVE_VALUE_POPULATION_NOT_REVERIFIED |

**Count**: 12 tables, 12 subject columns identified. Current repository authority establishes `trees.owner_id` as TEXT (not UUID) and does NOT prove a `trees.owner_id → users.id` FK; other subject columns are described as UUID-shaped references to `users.id` from prior inspection but were NOT re-verified against a fresh live catalog (`CURRENT_LIVE_DB_NOT_REVERIFIED` / `INSUFFICIENT_LIVE_EVIDENCE` apply where live value/type provenance is unverified). No direct Firebase UID column was observed. The Firebase subject is resolved through the auth session layer (Cloudflare/Modal) and mapped to the internal UUID at write time; the raw Firebase subject is not persisted in application tables.

**No raw UID, email, provider subject, or private identifier was emitted in this document.**

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
- **PRODUCTION_SCHEMA_EXISTS**: Yes — current authority (#4043) confirms `public.tree_appreciation_orders` canonical shape already exists in Production/default-branch Neon and schema/runtime activation occurred. This is historical/current Production schema state, NOT a new #4005 convergence apply.
- **CANONICAL RUNNER ADOPTION / ADOPTION ATTESTED**: No — `status: ADOPTION_REQUIRED`; a separately approved adoption baseline is required before any status transition.
- **#4005_NEW_CONVERGENCE_APPLY_AUTHORIZED**: No — a new #4005 convergence action requires ACTIVE manifest + runner protocol compliance; not authorized.
- **PRODUCTION_MIGRATION (new apply)**: NOT_AUTHORIZED — preserved for NEW #4005 convergence action. This does NOT deny historical/current Production schema activation (PRODUCTION_SCHEMA_EXISTS above).

### D.1 Adoption-gate verification item (schema-drift audit 2026-08-16)

Read-only drift audit (`COMP2_CANONICAL_SCHEMA_DRIFT_AUDIT_REPORT`, reconciliation basis current authoritative main `4814190982655c55e72bc01d3d2b6663138ecfa6`; prior basis `c5de1d14e7b0c4b9c07586cc6655f7d4c9d2ffbd` retained as historical provenance) confirmed all repository-side dimensions are drift-free: both catalog checksums match the on-disk SQL byte-for-byte, both expected-schema critical objects correspond 1:1 to the two migrations' postconditions, and the runtime `tree_appreciation_orders` writer (`modal_compute/appreciation_orders.py`) matches migration #2's DDL exactly. Live-catalog dimensions are `INSUFFICIENT_LIVE_EVIDENCE` (no approved read-only connection available at audit time).

One flagged adoption-gate verification item (NOT a code change; no PR required now):

- Migration `20260812213000` declares `tree_id TEXT ... REFERENCES public.trees(id)`. The db-engine proof applies it only against a synthetic TEXT parent (`appreciation-order-schema-3982.cjs` creates `trees(id TEXT PRIMARY KEY)`). Current repository authority establishes `public.trees.id` as TEXT (`TEXT→UUID` conversion prohibited; `trees` schema foothold `owner_id` = TEXT nullable), so the TEXT FK is type-consistent with the parent PK and the prior uuid-incompatibility concern does NOT apply under current authority. This is source-grounded (`db/migrations/20260812213000_add-tree-appreciation-orders.sql` TEXT FK target + current repo authority), not a fresh live catalog re-verification.
- Resolution: `trees.id` TEXT is the current source-grounded authority; a fresh approved read-only catalog check remains classified `CURRENT_LIVE_DB_NOT_REVERIFIED` until performed, but the TEXT-FK type concern is resolved by current authority.

Therefore `ADOPTION_REQUIRED → catalog must be empty` is incorrect. The current-main authority proves catalog entries can exist while the manifest stays ADOPTION_REQUIRED. The actual gate is Production/runner activation, not catalog entry addition.

## 11. Verdict

```text
FINAL_VERDICT                             = GO_CANONICAL_SCHEMA_BRANCH_PROTOTYPE (additive branch prototype proven; see scoping below)
CANONICAL_DATA_AUTHORITY_DIRECTION        = GO (LoveBud / 133-relovetree lineage)
SCHEMA_DIFF_COMPLETENESS                  = PARTIAL (exhaustive per-column/privilege matrix requires fresh live catalog; see Appendix A)
OWNERSHIP_SUBJECT_INVENTORY_COMPLETENESS  = SUBSTANTIAL (12 tables, 12 columns; per current authority `trees.owner_id` is TEXT, not UUID→users.id; other subject columns UUID-shaped per prior inspection but NOT re-verified against fresh live catalog; no direct Firebase UID persistence claimed)
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
