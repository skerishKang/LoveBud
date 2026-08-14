# LoveTree Large Ordered Read (5K) Authority

**Issue:** #4028  
**Parent Epic:** #4024  
**Product parent:** #3897 — Keep OPEN  
**Platform authority:** #4004  
**Ordering dependency:** #4026  
**Completeness precedent:** #3924  
**Status:** Implementation-ready read contract; no runtime/schema implementation in this document.  
**Audited baseline:** LoveBud `main` `ba7d470385f8bf21471cb8d5eeb9a4846df7232d`  
**Last updated:** 2026-08-14

---

## 1. Decision

A LoveTree may contain up to 5,000 Moments, but ordinary Tree opening must not hydrate 5,000 full Moment objects.

Use:

```text
Tree shell + exact visible/owner count
+
bounded ordered Moment windows
+
explicit sequence version
+
opaque keyset cursor and direct sort-order range
```

Current LoveBud owner read (`created_at DESC`, default limit 100) is transitional and is not the large-Tree authority.

---

## 2. Canonical ordering dependency

#4026 selects `sort_order` as the preferred shared-schema ordering direction.

Large-read ordering:

```text
ORDER BY sort_order ASC, id ASC
```

The `id` tiebreaker is defensive. For canonical imported/editable Trees, non-null `sort_order` values should be unique within the Tree.

Large-tree endpoints must not use `created_at` as the canonical sequence.

---

## 3. Sequence-version requirement

Paging a mutable ordered Tree without a sequence version can produce silent skips/duplicates if the owner reorders, inserts or deletes Moments between requests.

Introduce a canonical logical concept:

```text
moment_sequence_version
```

Exact schema name/type may be finalized under #4004, but semantics are fixed:

- monotonic per Tree;
- incremented transactionally for structural Moment changes that can alter membership/order;
- reorder increments it;
- Moment insert/delete increments it;
- bulk import chunking follows a deliberate version strategy and exposes only a stable completed/import-safe view;
- ordinary title/memo edits that do not change sequence membership/order need not increment it.

A cursor is valid only for the sequence version it was issued against.

---

## 4. Tree shell

Candidate route:

```text
GET /api/trees/{treeId}
```

Owner/public authorization follows existing shared platform rules.

Large-tree shell additions conceptually include:

```json
{
  "tree": {
    "id": "...",
    "title": "...",
    "visibility": "private",
    "momentCount": 5000,
    "momentSequenceVersion": 42,
    "importState": "completed"
  }
}
```

`momentCount` must mean the count visible to the caller's projection:

- owner projection: all owner-visible canonical Moments;
- public projection: only Moments legally eligible for that public response.

Do not leak owner-only total counts through a public shell if hidden/private Moments exist.

---

## 5. Ordered Moment window endpoint

Candidate route:

```text
GET /api/trees/{treeId}/moments?limit=100&after=<opaque>
```

Initial authority:

```text
default limit = 100
maximum limit = 250
```

The max is a product/API ceiling, not a guarantee that every response reaches 250 if visibility/filtering or end-of-sequence intervenes.

Response concept:

```json
{
  "treeId": "...",
  "momentSequenceVersion": 42,
  "totalCount": 5000,
  "returnedCount": 100,
  "items": [],
  "nextCursor": "opaque-or-null"
}
```

Explicitly separate `totalCount` and `returnedCount`.

Never use the old pattern where a hidden `LIMIT` can be mistaken for the complete Tree.

---

## 6. Cursor authority

Opaque cursor logically contains or references:

```text
tree identity
caller projection/read mode as needed
moment_sequence_version
last sort_order
last Moment ID tiebreaker
cursor format version
```

Client must not construct or edit cursors.

### Cursor validation

If current Tree sequence version != cursor sequence version:

```text
409 or equivalent structured TREE_SEQUENCE_CHANGED
```

The client must refresh the relevant shell/window rather than silently continuing a stale sequence.

Do not silently reinterpret a stale cursor against a newly reordered Tree.

### Cursor confidentiality

Signing/encryption is implementation-specific. At minimum the cursor must be tamper-evident or safely validated server-side and must not embed private payload content.

---

## 7. Direct range / jump contract

Virtualized 5K editors need direct navigation to positions outside the first pages.

Support an explicit order-based window, conceptually:

```text
GET /api/trees/{treeId}/moments?fromOrder=1200&limit=200&sequenceVersion=42
```

Semantics:

- `fromOrder` is canonical LoveTree order, not database OFFSET;
- server queries by indexed `sort_order >= fromOrder`;
- response uses the requested/validated sequence version;
- if version changed, return structured sequence-change response;
- max 250 items.

This avoids expensive/unstable deep OFFSET pagination and supports minimap/search/direct-jump UI.

---

## 8. Backward navigation

If the UI needs previous windows, use either:

- a server-issued previous cursor; or
- bounded `toOrder`/reverse keyset semantics.

Do not require client-side reconstruction of previous cursors.

Exact response shape is implementation scope; deterministic sequence/version rules are not.

---

## 9. Imported Tree visibility during processing

#4027 target Trees are private/staged while importing.

Owner read during processing may expose progress-aware partial windows, but it must clearly report:

```text
importState != completed
current persisted count
job status/progress reference
```

Public read eligibility for incomplete import is prohibited.

When import completes, canonical count/order reconciliation must succeed before the Tree is reported as a complete imported sequence.

---

## 10. Owner/public projection

### Owner window may include

- canonical Moment content;
- `sortOrder`;
- owner-safe source state/provenance fields approved by #4026;
- import warnings;
- owner edit metadata.

### Public window

Must preserve existing security invariants:

- effective Tree/Moment visibility intersection;
- immediate visibility revocation;
- leak-safe missing/forbidden behavior;
- no private playlist provenance;
- no private/unavailable media fields disallowed by #4029.

Public `totalCount` counts only the public projection, not hidden owner Moments.

---

## 11. Index direction

Canonical shared database should support an index equivalent to:

```text
(tree_id, sort_order, id)
```

with appropriate handling of null legacy `sort_order` values.

The existing `lovetree-limone` partial unique `(tree_id, sort_order)` index is a convergence input.

Implementation must evaluate:

- unique partial index for canonical ordering;
- ordered range scan index;
- visibility filtering index needs for public reads;
- count strategy;
- transaction impact of reorder/version bumps.

No LoveBud-only index/migration outside #4004 canonical schema authority.

---

## 12. Legacy/null-order migration

5K imported Trees must never rely on null order.

For pre-existing LoveBud Moments lacking `sort_order`:

1. select deterministic migration ordering under #4004;
2. backfill in bounded/validated batches;
3. prove per-Tree uniqueness/completeness;
4. only then switch canonical reads to `sort_order` authority for those Trees.

Until migration completes, legacy routes may use explicit transitional fallback behavior, but the API must not claim a 5K ordered contract for a Tree whose canonical sequence is unresolved.

---

## 13. Search/direct-jump support

A 5K editor should not require loading all Moments to find one.

Future/canonical search route may return bounded matches with:

```text
Moment ID
sort_order
safe title/thumbnail snippet
match reason/category
moment_sequence_version
```

The editor then fetches an order window around the result.

Search implementation is separate; the key authority is that it returns canonical position/version and does not force full hydration.

---

## 14. Connection read scaling

A large Tree may also contain many Connections.

Do not assume that opening a 5K Tree should return every Connection edge and every full Moment object in one response.

The shared graph/read contract should support bounded Connection retrieval relevant to:

- selected Moment;
- current Moment window;
- current semantic-zoom cluster/viewport;
- explicit graph overview projection.

`lovetree-limone#162` is a UI/routing input, not a second data authority.

AI suggested relationships from #4030 are a separate projection and must not be mixed into canonical Connection reads without type distinction.

---

## 15. Lightweight overview

A future overview/minimap endpoint may provide a compact representation for all/large subsets of Moments, but it must be a deliberate projection rather than the full Moment schema.

Candidate overview data:

```text
Moment ID or opaque lightweight ref
sort_order
small type/category marker
optional tiny thumbnail/cluster key only when justified
```

No memo, full description, embed metadata, comments/social payload or heavy media fields.

Before adding a 5,000-row overview response, measure payload size and UI need. Semantic/cluster summaries may be better for some views.

---

## 16. Response/body ceilings

The route must maintain explicit maximum page size and bounded field projection.

If response-size/body safeguards exist at the shared Cloudflare boundary, large-read design must fit them instead of bypassing them.

The implementation should measure representative payloads at:

```text
100 Moments
200 Moments
250 Moments
```

with realistic title/memo/source metadata and choose any narrower field projection needed to remain safe.

---

## 17. Sequence mutation rules

### Reorder

Transactionally:

```text
validate owner
→ validate expected sequence version
→ update affected sort_order values safely
→ increment sequence version once
→ commit
```

### Insert/delete

Same expected-version discipline is recommended for editor mutations that depend on a known sequence.

### Concurrent edit

Stale editor mutation should return a conflict/precondition failure, not overwrite a newer sequence silently.

This authority does not define the exact reorder write API, only the read-version contract it must preserve.

---

## 18. Cache/freshness rules

Per #4004, freshness-sensitive owner/visibility reads must not depend on stale caching.

Large Moment windows containing private/owner data:

```text
no shared public cache
```

Public large windows may only use caching if immediate visibility revocation remains guaranteed under the established security contract. Do not add stale public caching merely to improve 5K performance.

Sequence-version mismatch is never masked by cache.

---

## 19. Error contract

Candidate structured categories:

```text
TREE_NOT_FOUND_OR_FORBIDDEN
TREE_SEQUENCE_CHANGED
INVALID_CURSOR
CURSOR_TREE_MISMATCH
CURSOR_PROJECTION_MISMATCH
INVALID_ORDER_RANGE
PAGE_LIMIT_EXCEEDED
TREE_IMPORT_INCOMPLETE
READ_CONFIGURATION_REQUIRED
```

Raw SQL/provider/private data never appears in error messages.

---

## 20. 300 / 1K / 5K verification

For each controlled fixture:

### Completeness

- canonical persisted count known;
- shell count matches caller projection;
- sequential windows cover exactly that set;
- no duplicates;
- no gaps;
- final cursor null/end state truthful.

### Order

- returned order exactly follows canonical `sort_order`;
- deep jump around position N returns correct bounded region;
- creation timestamps do not affect sequence.

### Mutation

- stale cursor rejected after reorder;
- fresh shell/window reflects new sequence;
- insert/delete version behavior correct.

### Security

- owner/public counts differ correctly when private Moments exist;
- private source provenance absent from public projection;
- visibility revocation takes effect immediately according to existing contracts.

### Performance

Record:

- query count;
- DB latency;
- total response bytes;
- backend CPU/runtime where measurable;
- frontend time-to-window usable via #4031 / `lovetree-limone#172`.

No Production 5K mutation solely to obtain evidence.

---

## 21. Required contract tests after implementation

1. default 100, max 250 enforced;
2. `totalCount` != `returnedCount` where appropriate;
3. 251 request rejected/clamped per explicit contract, never silently accepted as complete;
4. cursor tree binding enforced;
5. cursor sequence version enforced;
6. cursor tampering safely rejected;
7. deep `fromOrder` range works without OFFSET semantics;
8. ordered pages concatenate without gaps/duplicates;
9. stale cursor after reorder rejected;
10. stale expected sequence on reorder rejected;
11. public count/fields exclude private Moments/provenance;
12. owner sees authorized private Moments;
13. import-incomplete public read denied;
14. 300/1K/5K fixture traversal exact;
15. visibility revocation regression contracts preserved.

---

## 22. Non-goals

- no runtime route in this authority PR;
- no schema/index migration in this authority PR;
- no `limit=5000` shortcut;
- no deep SQL OFFSET as canonical jump mechanism;
- no creation-time ordering;
- no stale cursor reinterpretation;
- no full 5K heavy object response by default;
- no second `lovetree-limone` read authority;
- no AI candidate merging into canonical Connections.

---

## 23. Implementation split

1. shared schema `sort_order` + sequence-version convergence under #4004;
2. owner Tree shell/count/version;
3. owner ordered cursor/range endpoint;
4. public ordered projection with existing visibility security;
5. mutation/version conflict wiring;
6. compact search/jump/overview only as proven necessary;
7. 300 gate;
8. 1K gate with `lovetree-limone#172`;
9. 5K gate under #4031.

---

## 24. Authority verdict

```text
LARGE_TREE_DEFAULT_FULL_HYDRATION = PROHIBITED
CANONICAL_ORDER = sort_order
CANONICAL_SEQUENCE_VERSION = REQUIRED
DEFAULT_WINDOW = 100
MAX_WINDOW = 250
PAGINATION = OPAQUE KEYSET CURSOR
DEEP_JUMP = sort_order RANGE, NOT OFFSET
STALE_CURSOR_AFTER_STRUCTURE_CHANGE = REJECT
PUBLIC_TOTAL_COUNT = PUBLIC_PROJECTION_COUNT
SILENT_TRUNCATION_AS_COMPLETE = PROHIBITED
5K_TARGET = SUPPORTED_BY_ARCHITECTURE, GATED_BY EVIDENCE
RUNTIME_IMPLEMENTATION = NOT_YET_PERFORMED
```
