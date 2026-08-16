# LoveTree Private YouTube Playlist → LoveTree 5K Import RFC

**Parent:** #3897 — Keep OPEN  
**Related platform authority:** #4004  
**Existing public-preview authority:** `docs/product/LOVETREE_PUBLIC_YOUTUBE_PLAYLIST_PREVIEW_AUTHORITY.md`  
**Existing bulk-import design input:** `docs/engineering/ASYNC_BULK_IMPORT_API_DESIGN.md`  
**Status:** Product/architecture RFC. No runtime implementation authorized by this document alone.  
**Baseline:** LoveBud `main` at `ba7d470385f8bf21471cb8d5eeb9a4846df7232d`; `lovetree-limone` `main` inspected at `5a96861f5bbbdf65fbadeab614d50fd300db69a7`.  
**Date:** 2026-08-14

---

## 1. Product decision

The primary owned-playlist product is **not** “make a YouTube playlist public and import the public URL.”

The intended product is:

```text
my YouTube account
→ my playlist, including a private playlist I own
→ LoveBud reads it with user-authorized YouTube access
→ one playlist snapshot becomes one LoveTree
→ each valid playlist item becomes one Moment
→ the new LoveTree starts private/draft
→ the user edits/organizes the LoveTree
→ the user may separately publish the LoveTree
```

The original YouTube playlist privacy must not be changed by LoveBud.

These are two independent visibility domains:

```text
YouTube source playlist visibility
!=
LoveTree visibility
```

A private source playlist can therefore produce a public LoveTree **only after** a separate LoveTree publication decision and a media-level publication check.

The existing public-playlist URL preview remains useful as a secondary intake path for other people's public collections and for low-friction preview. It is not the authority for importing the user's private account-owned playlists.

---

## 2. Product thesis

The import should reduce cold-start work without pretending that a copied playlist is already a meaningful LoveTree.

```text
existing personal collection
→ ordered imported Moments
→ independent LoveTree
→ user editing / curation
→ optional AI relationship discovery
→ user-confirmed Connections
→ deliberate LoveTree publication
```

Import is the **intake layer**. LoveTree meaning is built on top of the imported Moments.

---

## 3. Architectural scale target

Design the data/API/import architecture for:

```text
1 LoveTree = up to 5,000 imported Moments
```

This is an architectural target, not permission to enable 5,000-item production imports on day one.

Rollout/load gates:

```text
Gate A: 300 Moments
Gate B: 1,000 Moments
Gate C: 5,000 Moments
```

Each gate must prove import completeness, deterministic ordering, read performance, editor/view performance, cancellation/failure behavior, and privacy before the next ceiling is enabled.

Do not design a 300-only schema/API and later replace it for 5,000. The first canonical contracts should be 5K-capable while rollout remains gated.

---

## 4. Current-state findings that constrain this RFC

### 4.1 Current LoveBud preview is intentionally bounded to public playlists

The existing authority and runtime preview slice use a server-side YouTube Data API key and a one-page/50-item ceiling. That is useful for public preview but cannot authorize access to a user's private account-owned playlist.

The owned-playlist path therefore requires a separate user authorization boundary.

### 4.2 Current LoveBud Moment read is not a 5K read contract

Current `modal_compute/owner_reads.py` reads owner Moments with a default limit of 100 and orders them by `created_at DESC`.

That is not sufficient for a 5,000-item ordered playlist-derived Tree.

Do not solve this by changing the default to 5,000. Large Trees need explicit cursor/range/window reads.

### 4.3 Current LoveBud Moment write model has source metadata but no canonical source ordering/provenance

Current LoveBud writes already carry useful media/source fields such as source URL/type, thumbnail, channel identity, title, memo and visibility.

The existing public-preview authority has already identified missing persisted concepts including source ordering, external source identity/provenance and source availability.

### 4.4 `lovetree-limone` already contains a stronger ordering precedent

At the inspected `lovetree-limone` baseline, `db/schema.ts` already contains `memories.sort_order` and a partial unique index on `(tree_id, sort_order)`.

This is a useful convergence input, especially because #4004 already prohibits two independently writable canonical Tree/Memory models.

This RFC does **not** authorize a standalone LoveBud migration that ignores #4004. The final canonical ordering schema must be selected as part of shared schema convergence.

### 4.5 Large visual exploration has already exceeded ordinary card-list scale

`lovetree-limone` Issue #160 records a current synthetic fixture of exactly 1,000 Moment nodes for the 3D Moment Cluster Explorer, with semantic zoom and cluster/bridge exploration as a distinct presentation concept.

That does not prove 5,000 production Moments are ready, but it proves that the newer LoveTree design direction already contemplates Tree experiences substantially larger than the current LoveBud 100-item owner read.

---

## 5. Authentication and YouTube account boundary

### 5.1 Application identity and YouTube authorization are separate

The application must distinguish:

```text
LoveBud/LoveTree account identity
from
YouTube account authorization
```

The current application identity may continue through the active shared identity migration architecture. The YouTube authorization grants permission to read that user's account-owned YouTube data.

Do not treat a Firebase/Neon/shared application session as implicit permission to read YouTube private data.

### 5.2 Minimum permission principle

The owned-playlist flow should request the minimum reviewed YouTube read scope required to:

- discover playlists owned by the authorized account;
- read the selected playlist metadata;
- enumerate items in the selected playlist;
- read only additional item/video metadata needed for the LoveTree import/publish contract.

The first owned-playlist slice is read-only. No YouTube mutation permission is justified.

### 5.3 Token handling requirements

Before implementation, the OAuth child must define:

- authorization-code/PKCE or equivalent approved server flow;
- redirect/callback authority;
- token encryption-at-rest strategy if refresh credentials are stored;
- token expiry/refresh behavior;
- revocation and account disconnect;
- delete-on-disconnect/data-retention semantics;
- Preview/Production separation;
- no OAuth token, authorization code, API key or provider response body in logs;
- strict account binding between the LoveTree actor and the stored provider authorization.

Do not place long-lived provider credentials in browser storage as the canonical authorization state.

---

## 6. Import semantics

### 6.1 Base mapping

For the first snapshot-import version:

```text
one selected YouTube playlist
→ one LoveTree

one playlist item
→ one imported Moment
```

This is intentionally simple.

AI must not decide at import time that several playlist items should be silently merged into one Moment. The source collection should be faithfully represented before enrichment.

### 6.2 Snapshot first, not automatic synchronization

V1 should be:

```text
SNAPSHOT IMPORT
```

not continuous automatic sync.

Reason:

A user may add a new video to a private source playlist later. Automatically reflecting that source change into an already-public LoveTree can unintentionally publish something the user never reviewed for LoveTree publication.

A future “refresh from YouTube” flow may exist, but it must:

1. fetch source changes;
2. show a bounded diff;
3. require explicit user acceptance for additions/removals/reorders that affect the LoveTree;
4. never silently publish new source content.

### 6.3 Playlist adjacency is not a Connection

Preserve the #3897 invariant:

```text
playlist/source order = ordering/playback metadata
Connection = meaningful LoveTree relationship
```

Importing item 20 immediately after item 19 does not create a semantic, emotional or causal Connection.

### 6.4 Duplicate playlist items

A YouTube playlist may intentionally contain the same video more than once.

Default policy for the source-faithful snapshot should therefore be:

```text
playlist item identity is primary for import occurrence
video identity is metadata
```

If the same video appears twice at two source positions, the importer should not silently collapse the two occurrences unless the user explicitly chooses deduplication in a later review flow.

### 6.5 Deleted/private/unavailable source items

Do not silently drop an item solely because complete media metadata is unavailable.

The import contract must distinguish at least:

```text
IMPORTABLE
SOURCE_PRIVATE_OR_UNAVAILABLE
METADATA_PARTIAL
REMOVED_OR_UNKNOWN
```

The exact persisted representation remains a domain/schema child decision.

An unavailable occurrence may become a placeholder Moment if doing so is necessary to preserve source order/context, but publication and playback rules must remain fail-closed.

---

## 7. Ordering and provenance model

A 5K import requires two different concepts.

### 7.1 LoveTree canonical order

A mutable canonical ordering field controls the current LoveTree order after user editing.

The existing `lovetree-limone` `sort_order` precedent should be evaluated as the preferred canonical naming/input during #4004 schema convergence.

### 7.2 Source snapshot position

An immutable or append-only provenance position records where the occurrence was located in the imported YouTube snapshot.

Conceptually:

```text
source_position = original YouTube playlist position at import
sort_order      = current LoveTree order
```

The exact field names are not authorized here.

Required properties:

- stable deterministic ordering;
- a user reorder does not destroy source provenance;
- source refresh/diff can compare against prior snapshot positions;
- repeated video IDs at distinct positions remain distinguishable;
- ordering does not depend on `created_at` timing;
- worker concurrency cannot reorder Moments accidentally.

### 7.3 Import/source identity

The canonical model must also preserve enough source identity for idempotency and later source-diff work, without exposing private provider identifiers in public views unnecessarily.

Candidate concepts to evaluate:

```text
provider
external_collection_id
external_item_id
external_media_id
source_position
import_job_id / import_batch_id
imported_at
source_availability_state
```

Do not overload `memo` or a display title with provenance.

---

## 8. 5K import execution model

### 8.1 Never make 5,000 individual browser write requests

The browser must not execute one ordinary Moment POST per item.

### 8.2 Never process the entire import in one long synchronous request

Reuse the direction already established in `ASYNC_BULK_IMPORT_API_DESIGN.md`:

```text
request accepted
→ durable import job
→ bounded worker chunks
→ progress/status
→ resumable/idempotent item processing
```

### 8.3 Candidate high-level API

Exact route naming remains an API child decision, but the interaction shape should be similar to:

```text
POST /api/imports/youtube
→ authenticated actor
→ selected provider account + playlist
→ create private/draft Tree or staged import target
→ create durable job
→ 202 Accepted + jobId

GET /api/imports/{jobId}
→ queued | processing | completed | partial_failed | failed | cancelled
→ total/processed/succeeded/failed counts

POST /api/imports/{jobId}/cancel
→ optional, if cancellation is safely supported
```

The accepted response must never imply that all Moments already exist.

### 8.4 Chunking

Worker behavior must be bounded independently at the provider and database layers.

Provider enumeration naturally uses provider pagination. Persisted Moment creation should use bounded transaction chunks rather than one giant 5K transaction or 5K independent transactions.

Exact chunk size must be benchmarked against the selected canonical Cloudflare/Modal/shared API + Neon runtime. Do not hard-code an RFC guess as production authority.

### 8.5 Idempotency

At minimum define:

- actor-scoped import idempotency key;
- source playlist + snapshot request fingerprint;
- same-key/same-request replay;
- same-key/different-request conflict;
- item-level occurrence identity;
- retry after partial failure;
- intentional “import again as a new Tree” path;
- resume after worker/process interruption.

A browser retry must not create a second 5,000-Moment Tree accidentally.

---

## 9. 5K read contract

Large Trees need an explicit read model.

Do not return 5,000 full Moment objects by default on every Tree open.

Candidate behavior:

```text
GET tree shell
→ tree metadata
→ momentCount
→ lightweight aggregate/view metadata

GET ordered Moments with cursor/range
→ bounded page/window, e.g. 100–250 items
→ stable sort/order cursor
→ next cursor / range metadata
```

Requirements:

- deterministic order;
- cursor/range remains stable under normal browsing;
- permission/visibility checks happen before private data is returned;
- public and owner read models may differ in fields but share ordering semantics;
- no silent hard truncation presented as a complete Tree;
- counts distinguish total Moments from returned window size.

Issue #3924 is relevant evidence that silent upper bounds are dangerous: a Tree operation must not claim completeness while dropping eligible Moments.

---

## 10. Large editor/view contract

A Tree may contain 5,000 Moments without rendering 5,000 heavyweight cards/players simultaneously.

### 10.1 Rendering invariant

```text
5,000 Moments may exist in one Tree
!=
5,000 full DOM cards/iframes/media decoders must be active at once
```

The newer LoveTree UI should use a combination of:

- virtualization/windowing;
- semantic zoom;
- lightweight overview dots/cluster summaries;
- bounded detail windows;
- lazy media decode/load;
- selected-only or near-viewport active playback;
- minimap/search/direct jump for large navigation.

### 10.2 300 / 1K / 5K gates

At each gate measure at minimum:

- initial shell render time;
- time to first usable interaction;
- memory consumption trend;
- scroll/zoom/pan responsiveness where applicable;
- selection/jump latency;
- number of mounted heavyweight Moment surfaces;
- network payload size per read window;
- mobile 390×844 behavior;
- reduced-motion behavior;
- console/page errors;
- correctness after reorder and direct jump.

### 10.3 Existing newer-UI inputs

Cross-repository design inputs should explicitly reuse rather than duplicate:

- `lovetree-limone` #141 shared runtime primitives;
- #160 semantic zoom / 1,000 synthetic Moment cluster exploration;
- #162 dynamic Connection-routing capability review;
- current canonical/free graph/editor work.

No Design Lab prototype becomes production authority merely because it handles a large synthetic fixture.

---

## 11. Publication boundary

### 11.1 Source playlist privacy is not the publication decision

A private source playlist can remain private forever.

Publishing the LoveTree does not publish or mutate the playlist object.

### 11.2 Source media availability is evaluated separately

Example:

```text
private playlist
├─ public video A
├─ public video B
└─ public video C
```

The LoveTree may publish A/B/C as Moments, subject to normal LoveTree visibility and media policy.

But:

```text
private playlist
├─ public video A
├─ private/unavailable video B
└─ public video C
```

must not result in LoveTree publication pretending B is publicly playable.

A future publication preflight should classify media-level states and allow the user to exclude/hold unavailable items.

### 11.3 Unlisted media requires an explicit product/privacy decision

An unlisted video may technically be playable by anyone with its identifier/link. Including it in a public LoveTree can expand discovery of that video.

Therefore unlisted source media should not be treated as identical to public media without a deliberate publication policy and user-facing disclosure.

### 11.4 Private-first LoveTree creation

Imported Trees must start private/draft/staged according to the canonical shared product model.

Import completion is never an implicit publish action.

---

## 12. AI relationship discovery boundary

AI enrichment is a future layer, not a prerequisite for faithfully importing 5,000 source items.

The import pipeline should leave room for later metadata/embedding analysis, but must not fabricate canonical Connections during snapshot creation.

Required future separation:

```text
source relationship/order metadata
AI relationship candidate
user-confirmed LoveTree Connection
```

The semantic relationship system is specified separately in `LOVETREE_AI_SEMANTIC_RELATIONSHIP_DISCOVERY_RFC.md`.

---

## 13. Cross-repository ownership

Follow #4004.

### LoveBud / shared platform authority owns

- provider authorization boundary;
- canonical account/provider binding;
- canonical domain/schema decisions;
- import jobs and idempotency;
- provider adapters;
- canonical Tree/Moment persistence;
- large ordered read API;
- publication boundary and privacy;
- operational limits, quota, telemetry and kill switch;
- Production deployment authority.

### `lovetree-limone` owns/prototypes

- large-Tree editor/view interaction;
- virtualization/windowing presentation;
- semantic zoom and minimap interaction;
- import-selection and progress experience;
- publication preflight UX;
- visual integration of AI relationship candidates.

### Integration rule

No second writable import database or second canonical Tree/Moment store may be created in `lovetree-limone`.

The newer UI consumes the shared canonical API/data contract.

---

## 14. Security/privacy/logging

Never log or expose in operational telemetry:

- OAuth access/refresh tokens;
- authorization codes;
- provider API keys;
- Firebase/Neon/shared session credentials;
- raw private playlist URL or title;
- raw private playlist item titles/descriptions;
- raw provider response bodies;
- private Tree/Moment text;
- account identifiers where category-level telemetry is sufficient.

Allowed operational telemetry should remain bounded/category-level, e.g.:

```text
provider = youtube
operation = import
item_count_bucket = 1001-5000
job_result = completed|partial_failed|failed
provider_error_category
latency_bucket
chunk_retry_count_bucket
```

Provider quota and authorization failures must fail closed without exposing raw provider error bodies to the browser.

---

## 15. Non-goals for the first implementation sequence

The following are explicitly not required in the first owned-playlist import implementation:

- changing a YouTube playlist from private to unlisted/public;
- auto-publishing a LoveTree after import;
- automatic continuous source synchronization;
- importing Watch History or Watch Later through unsupported paths;
- downloading/re-hosting YouTube media;
- creating semantic Connections from playlist adjacency;
- running AI across all pairs of Moments synchronously during import;
- rendering 5,000 full cards or iframes at once;
- a giant cross-repository PR;
- direct Production schema/data mutation from a planning issue;
- bypassing #4004 canonical schema/backend convergence.

---

## 16. Ordered work packages before implementation

Create independently reviewable children in this order:

1. **OAuth/private-playlist authority**
   - provider account connection;
   - minimum scope;
   - token lifecycle;
   - private playlist discovery/read contract.

2. **Domain/order/provenance authority**
   - item → Moment mapping;
   - duplicate/unavailable policy;
   - `sort_order` convergence decision;
   - source position/provenance model;
   - snapshot versus refresh semantics.

3. **5K import job authority**
   - durable job/item model;
   - chunking;
   - idempotency;
   - resume/cancel/partial failure;
   - 300/1K/5K operational gates.

4. **Large ordered read authority**
   - tree shell/count;
   - cursor/range Moment reads;
   - no silent truncation;
   - owner/public field and visibility boundary.

5. **Publication preflight authority**
   - playlist privacy vs media availability;
   - public/private/unlisted source item policy;
   - explicit exclusion/hold states;
   - import completion never publishes.

6. **New LoveTree large-editor integration contract**
   - cross-repository UI issue;
   - 300/1K/5K performance gates;
   - virtualization/windowing;
   - semantic zoom/search/jump;
   - same canonical Tree/Moment dataset.

7. **Cross-repository E2E acceptance plan**
   - private playlist → snapshot job → ordered Moments → new editor → publication preflight;
   - no Production mutation until separately approved.

AI semantic relationship discovery proceeds under a separate future Epic and must not block faithful snapshot import.

---

## 17. Implementation start gate

Runtime/schema/provider implementation should not begin until the following planning artifacts are approved or explicitly waived by the CTO/product owner:

- this RFC merged or replaced by a newer authority;
- OAuth/private-playlist authority child has a selected design;
- canonical order/provenance naming is aligned with #4004 schema convergence;
- async import job contract has explicit idempotency/chunking states;
- large ordered read contract eliminates silent truncation;
- cross-repository large-editor issue defines 300/1K/5K gates;
- publication privacy boundary is explicit.

---

## 18. Acceptance criteria for this RFC phase

This planning phase is complete when:

- the product intent explicitly supports account-owned private playlists without changing their YouTube visibility;
- one playlist snapshot maps to one LoveTree;
- one playlist item occurrence maps to one Moment by default;
- 5,000 Moments is the architecture target with staged rollout gates;
- source order and semantic Connection remain separate;
- mutable LoveTree order and immutable source position are separate concepts;
- import is asynchronous/idempotent/resumable by design;
- large reads are paged/windowed and cannot silently claim completeness;
- large UI does not require 5,000 heavyweight mounted surfaces;
- LoveTree publication is separate from source playlist privacy;
- private/unavailable media publication is fail-closed;
- AI relationship discovery is a separate future layer;
- LoveBud/shared platform remains canonical backend/data authority;
- `lovetree-limone` remains the large-editor/visual integration consumer of that authority;
- no runtime/schema/Production mutation occurs in the RFC PR.

---

## 19. Product statement

> A private YouTube playlist can remain private. LoveTree imports its ordered contents with the user's authorization, turns them into an independent private-first Tree, and lets the user decide what the LoveTree eventually means and whether it should be published.
