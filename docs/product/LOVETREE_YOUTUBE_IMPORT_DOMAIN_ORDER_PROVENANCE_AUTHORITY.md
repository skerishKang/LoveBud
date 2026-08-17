# LoveTree YouTube Import Domain / Ordering / Provenance Authority

**Issue:** #4026  
**Parent Epic:** #4024  
**Product parent:** #3897 — Keep OPEN  
**Platform authority:** #4004  
**Planning RFC:** #4023  
**Status:** Implementation-ready domain contract; no schema/runtime implementation in this document.  
**Audited baseline:** LoveBud `main` `ba7d470385f8bf21471cb8d5eeb9a4846df7232d`; `lovetree-limone` inspected at `5a96861f5bbbdf65fbadeab614d50fd300db69a7`.  
**Last updated:** 2026-08-14

---

## 1. Decision summary

The canonical snapshot mapping is:

```text
one selected YouTube playlist snapshot
→ one LoveTree

one returned playlist-item occurrence
→ one Moment
```

A repeated video at two playlist positions creates **two imported Moment occurrences by default**. The importer must not collapse them solely because `videoId` matches.

Three concepts remain separate:

```text
source occurrence identity
current LoveTree ordering
semantic LoveTree Connection
```

Playlist adjacency creates canonical semantic Connections: **0**.

---

## 2. Current-state findings

### LoveBud current model

Current LoveBud Memory writes already persist useful source fields:

- title
- memo
- artist
- source / source URL
- source type
- thumbnail
- channel identity
- visibility

But current LoveBud owner reads use:

```text
ORDER BY created_at DESC
LIMIT 100 (default)
```

and current LoveBud code does not expose canonical `sort_order`, source playlist position, import provenance or external playlist-item occurrence identity.

### `lovetree-limone` convergence input

The inspected `lovetree-limone` schema already contains:

```text
memories.sort_order integer nullable
unique partial index (tree_id, sort_order) WHERE sort_order IS NOT NULL
```

#4004 explicitly identifies `sort_order` as one of the newer LoveTree schema refinements to evaluate for the canonical shared schema.

**Decision:** use `sort_order` as the preferred canonical ordering name during #4004 convergence unless a later shared-schema decision replaces it consistently in both products.

Do not introduce a competing `order_index` field in LoveBud while `sort_order` convergence is active.

---

## 3. Canonical Moment ordering

### 3.1 `sort_order`

Required semantics:

- nullable for backward compatibility during migration;
- integer;
- scoped to one Tree;
- deterministic;
- imported snapshots receive explicit values independent of insertion time;
- initial imported order follows source playlist position;
- later user reorder changes `sort_order` only, not source provenance;
- ordinary reads use canonical order with an explicit legacy fallback during migration, never creation timing as the permanent authority.

Recommended initial import values:

```text
source position 0 → sort_order 0
source position 1 → sort_order 1
...
```

If the provider returns non-contiguous/irregular positions, normalize the LoveTree canonical order to a deterministic contiguous sequence while storing the provider's original source position separately.

### 3.2 uniqueness

Preferred canonical invariant:

```text
(tree_id, sort_order) unique when sort_order IS NOT NULL
```

This already has a precedent in `lovetree-limone`.

Reorder implementation must use a transaction-safe strategy that cannot violate the unique constraint midway through a reorder. Exact SQL is implementation scope.

### 3.3 legacy fallback

Existing Moments without `sort_order` must remain readable during migration.

The shared-schema migration authority must select one deterministic transitional fallback and then backfill/normalize before declaring `sort_order` universal.

Do not silently mix null and non-null ordering with unstable database row order.

---

## 4. Source occurrence provenance

Canonical Moment content should not be polluted with provider-specific identity fields merely for import bookkeeping.

**Preferred model:** keep canonical presentation/content fields on `memories`, and store imported-source occurrence provenance in a dedicated one-to-one provenance record.

Candidate canonical concept:

```text
memory_source_provenance
```

Required logical fields:

```text
memory_id                  FK → canonical Moment
provider                   youtube
external_collection_ref    source playlist identifier/reference
external_item_ref          playlist-item occurrence identifier
external_media_ref         underlying video/media identifier when available
source_position            provider-reported snapshot position
snapshot_ref               import snapshot/batch identity
import_job_id              durable import job identity
source_state               normalized availability state
imported_at
last_source_checked_at      nullable
```

Exact names/types are schema-implementation scope, but these concepts are authoritative.

### Privacy rule

Provider collection identity is owner/internal provenance by default. It is **not** automatically part of a public Moment/Tree projection.

A public LoveTree does not need to reveal which private playlist supplied it.

---

## 5. Occurrence identity vs media identity

Do not conflate:

```text
playlist item ID / occurrence
video ID / media
Moment ID
```

Example:

```text
playlist item X → video ABC → source position 10 → Moment M1
playlist item Y → video ABC → source position 98 → Moment M2
```

M1 and M2 are distinct snapshot occurrences.

This preserves:

- source sequence;
- intentional repetition;
- later diff/refresh behavior;
- independent user edits in LoveTree.

Future UI may offer a deduplication review, but import must not perform destructive dedupe implicitly.

---

## 6. Source-state matrix

Normalize source items into explicit categories before persistence/reporting.

Recommended V1 categories:

```text
available
unlisted
private_or_unavailable
removed_or_unknown
metadata_partial
```

Exact enum strings may change, but the distinctions must survive.

### Available public item

Create normal Moment with source metadata + provenance.

### Unlisted item

Create owner-visible Moment and provenance. Publication policy is deferred to #4029 and must require explicit review/disclosure rather than assuming equivalence with public media.

### Private/unavailable item

If the authorized source enumeration returns an occurrence but complete public-playable metadata is unavailable, preserve the occurrence as a **placeholder-capable Moment** rather than silently deleting its position from the snapshot.

Required characteristics:

- stable Moment identity;
- source occurrence provenance;
- owner-visible availability state;
- no false public-playable URL/thumbnail claim;
- publication fails closed until #4029 policy resolves it.

### Removed/unknown

Preserve only if provider enumeration gives enough evidence that an occurrence exists. Do not fabricate unavailable Moments to make a provider-reported count match.

### Provider count mismatch

If provider metadata says an expected item count but enumeration cannot account for all items, the job must report a truthful partial/held state under #4027. Do not invent rows and do not claim completeness.

---

## 7. Tree-level import provenance

The target Tree should not require a public `source_playlist_url` field.

The durable import job/snapshot supplies Tree-level source provenance:

```text
provider = youtube
source collection ref
provider connection ref
snapshot/import job ref
captured item count
captured-at
```

Public Tree reads should expose only approved attribution needed for user-facing media, not private collection identity.

If a future product feature lets the owner display “Imported from my YouTube playlist,” that is a separate opt-in presentation decision.

---

## 8. Snapshot semantics

V1 is a snapshot, not a live mirror.

At snapshot completion:

- imported Moments become independent canonical LoveTree data;
- source provenance remains as history/context;
- user may edit title, memo, ordering, Connections and visibility according to product permissions;
- edits do not mutate YouTube;
- later YouTube changes do not automatically mutate LoveTree.

### Future refresh

A future refresh operation must compute a source diff before mutation:

```text
added occurrences
removed occurrences
moved/reordered occurrences
metadata changes
availability changes
```

The user must review/accept changes that alter a LoveTree, especially if the Tree is public.

Automatic background source sync into a public Tree is prohibited by this authority.

---

## 9. Connection boundary

Import writes:

```text
Moment rows: yes
ordering/provenance: yes
semantic Connections: no, unless separately and explicitly user-authored
```

Do not encode playlist sequence as:

- `parent_id` semantic lineage;
- `connection_reason`;
- canonical Connection edge;
- WHY NEXT;
- AI relationship.

Source order belongs to ordering/provenance.

AI suggestions belong to #4030 and remain non-canonical until accepted.

---

## 10. Visibility boundary

Target Tree during import:

```text
private/draft/staged
```

Imported Moments inherit a private-safe state during construction.

No item source state may cause automatic Tree publication.

Final visibility/publication behavior is governed by #4029.

Source playlist visibility is never copied into LoveTree visibility as a direct rule.

---

## 11. Idempotency keys for domain identity

#4027 owns job idempotency, but domain authority requires enough identity to make it possible.

Within one import job/snapshot:

```text
(import_job_id, external_item_ref)
```

should identify one imported occurrence when the provider supplies a stable playlist-item ID.

Fallback identity if provider occurrence ID is absent must be explicitly versioned and derived from enough snapshot context to avoid collapsing duplicate video occurrences; e.g. collection + source position + media ref + snapshot identity.

Do not use `videoId` alone as the import uniqueness key.

An explicit “import this playlist again as a new Tree” is a separate new import job and may legitimately create a new set of Moments.

---

## 12. Canonical public/owner projections

### Owner projection may include

- source availability state;
- import job/snapshot status/reference where useful;
- original source position;
- provider attribution;
- warnings about unavailable/unlisted media.

### Public projection must not include by default

- private playlist identifier;
- private playlist title;
- provider connection/account identifier;
- import-job internal ID;
- source-state diagnostics that leak private collection membership;
- inaccessible private-video metadata not otherwise public.

Public media source URLs/IDs are only exposed when the media-level publication policy allows it.

---

## 13. Migration direction under #4004

The canonical shared schema should converge rather than add a LoveBud-only import model.

Preferred sequence:

1. classify current LoveBud and `lovetree-limone` schema differences;
2. adopt one canonical `sort_order` contract;
3. backfill existing Moments safely;
4. add provenance/import-job schema only to the canonical database;
5. expose one shared API contract to both frontends;
6. make `lovetree-limone` consume the shared model and stop independent production writes.

No dual-write ordering/provenance system.

---

## 14. Required implementation tests

### Mapping

- one source occurrence → one Moment;
- same video at two positions → two Moments;
- provider item identity preserved;
- unavailable occurrence policy preserved;
- no source occurrence silently dropped after successful enumeration.

### Ordering

- import order matches normalized source order;
- concurrent/chunked inserts cannot scramble order;
- reads do not depend on `created_at`;
- reorder changes canonical `sort_order` without changing source position;
- `(tree_id, sort_order)` uniqueness preserved transactionally.

### Provenance/privacy

- provenance belongs to correct Moment/Tree/job;
- actor B cannot read actor A private import provenance;
- public Tree response omits private playlist identity;
- raw provider account/connection identity not leaked.

### Connections

- import of N playlist items creates semantic Connections: 0;
- later user-created Connections remain independent of source position.

### Completeness

- enumerated count, persisted Moment count and provenance count converge;
- mismatch yields explicit partial/failure state, never success with hidden truncation.

---

## 15. Non-goals

- no schema migration in this authority PR;
- no 5K worker implementation;
- no OAuth implementation;
- no public publication logic;
- no AI deduplication/semantic linking;
- no automatic source refresh;
- no second canonical database;
- no `videoId`-only uniqueness rule;
- no playlist adjacency → Connection conversion.

---

## 16. Implementation split

After this authority is approved:

1. canonical shared `sort_order` convergence/migration work under #4004;
2. provenance schema contract/migration;
3. normalization/adapters for provider occurrence → canonical Moment payload;
4. #4027 async job uses the domain contract for chunk writes;
5. #4028 reads canonical `sort_order` and bounded windows;
6. #4029 consumes source-state/provenance for publication preflight.

---

## 17. Authority verdict

```text
PLAYLIST_SNAPSHOT_TO_TREE = ONE_TO_ONE
PLAYLIST_ITEM_OCCURRENCE_TO_MOMENT = ONE_TO_ONE_BY_DEFAULT
DUPLICATE_VIDEO_OCCURRENCES = PRESERVE
CANONICAL_ORDER_NAME = sort_order (preferred #4004 convergence direction)
SOURCE_POSITION = SEPARATE_PROVENANCE
SOURCE_ITEM_ID != VIDEO_ID != MOMENT_ID
PLAYLIST_ADJACENCY_TO_CONNECTION = PROHIBITED
SNAPSHOT_AUTO_SYNC = PROHIBITED_V1
PRIVATE_SOURCE_PROVENANCE_PUBLIC_LEAK = PROHIBITED
RUNTIME_SCHEMA_IMPLEMENTATION = NOT_YET_PERFORMED
```
