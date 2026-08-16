# LoveTree YouTube Import — Visibility / Publication Lifecycle Addendum

**Issue:** #4026  
**Parent Epic:** #4024  
**Product parent:** #3897 — Keep OPEN  
**Platform authority:** #4004  
**Base authority:** `LOVETREE_YOUTUBE_IMPORT_DOMAIN_AUTHORITY.md`  
**Publication authority:** #4029  
**QA authority:** #4031  
**Status:** Normative future-domain addendum. No schema/runtime/import/Production/Preview/provider mutation is authorized here.

---

## 1. Selected model

The canonical future import lifecycle uses **Model B — Tree + selected Moment promotion**.

During import and owner review:

```text
Tree.visibility = private
imported Moment.visibility = private
```

Final publication is an explicit owner action. It must transactionally promote:

```text
exactly owner-approved + public-eligible imported Moments
→ visibility = public

and the Tree
→ visibility = public
```

Held, blocked, unavailable, unknown, or owner-excluded Moments remain private unless a later explicit owner action changes them under canonical rules.

This model is selected because it preserves a literal fail-closed state throughout a potentially long 300/1K/5K import and review lifecycle. It does not depend on every public reader correctly intersecting a private Tree with already-public child rows during incomplete import.

---

## 2. No `draft` / `staged` pseudo-visibility

Import lifecycle and publication eligibility are **not** new values in the canonical visibility column.

Do not introduce values such as:

```text
draft
staged
importing
held
```

into the existing `public|private` visibility contract merely to model import state.

Use a separate import/job/publication lifecycle authority for states such as:

```text
importing
review_required
ready_for_preflight
preflight_stale
publishable
completed
partial_failed
failed
cancelled
```

Exact names belong to later schema/runtime authority.

---

## 3. Imported occurrence visibility by provider/source state

At creation time, **every imported occurrence is private**, independent of provider availability classification.

The provider/source state remains separate metadata/provenance authority.

### Available/publicly playable evidence

```text
Memory/Moment visibility = private during import/review
provider/source availability = preserved separately
publication eligibility = may become eligible after #4029 preflight
```

### Unlisted provider source

Provider `unlisted` does not automatically make the LoveTree Moment public or private beyond the selected import default.

```text
Memory/Moment visibility = private during import/review
provider state = preserved
publication eligibility = policy/preflight decision
```

No automatic source-privacy mutation is performed.

### Private / unavailable / deleted / blocked source occurrence

```text
Memory/Moment visibility = private
occurrence row/snapshot = preserved when representable
publication eligibility = false / held unless later fresh provider evidence changes authority
```

Do not silently drop the occurrence merely because it cannot currently be published or played.

### Unknown / malformed partial provider evidence

```text
Memory/Moment visibility = private
publication eligibility = false until bounded fresh evidence resolves it
```

Unknown must fail closed.

---

## 4. Incomplete import exposure invariant

For every non-terminal-or-not-yet-published state, including at minimum:

```text
queued
processing
checkpointed
review_required
partial_failed
failed
cancelled
preflight_stale
```

the required public exposure is:

```text
Tree public exposure = 0
Imported Moment public exposure = 0
Browse/public-read eligibility = 0
```

No page, Browse/read model, embed, or cache may treat import completion/progress as publication.

Import `completed` also does **not** automatically mean public. Completion means the snapshot/import job is complete; publication remains a separate explicit owner operation.

---

## 5. Owner review contract

After import completion, the owner may:

- inspect the complete imported occurrence set;
- edit supported LoveTree fields under canonical owner contracts;
- exclude/hold individual Moments from publication;
- resolve unavailable/unknown items where future provider evidence permits;
- reorder using the canonical mutable order authority selected by #4026;
- request publication preflight.

The owner does not need to delete private/held occurrences merely to publish the rest of the Tree.

Private held rows remain owner-visible canonical state unless explicitly deleted under normal owner deletion rules.

---

## 6. Final publication transaction

Final publication authority belongs to #4029 and must use a fresh publication revision/fingerprint covering all publication-relevant inputs.

When the owner confirms publish against current preflight authority, the canonical transaction must perform, conceptually:

```text
lock/fence current Tree publication authority
validate owner
validate import is terminal and publishable
validate publication revision/fingerprint is current
validate selected Moment set + eligibility
update exactly selected public-eligible Moments: private → public
keep held/excluded/ineligible Moments private
update Tree: private → public
commit atomically
canonical reread
```

If any required predicate has changed since preflight:

```text
ROLLBACK
→ no partial publication
→ preflight must be refreshed
```

The transaction may use batching/SQL set operations internally, but the externally observable state must never expose a half-promoted Tree.

---

## 7. Publication rollback and concurrency

Required invariants:

- concurrent owner edits that affect eligibility/order/publication inputs invalidate or fence stale publication attempts;
- a publication attempt using stale revision/fingerprint performs zero partial public transition;
- a 300/1K/5K selected-set promotion is one logical publication transaction;
- failure before commit leaves Tree and all imported Moments in their previous visibility states;
- canonical reread after commit confirms Tree and selected Moment visibility;
- held/private rows remain private after successful publication;
- later unpublish/revocation follows the then-current canonical visibility contract and must be immediately respected by public readers.

---

## 8. Interaction with order/provenance semantics

Visibility does not change these #4026 invariants:

```text
playlist-item occurrence identity
!= underlying video identity
!= canonical Moment identity

source snapshot position
!= mutable LoveTree order

playlist adjacency
!= semantic Connection
```

A private held occurrence remains part of owner-visible snapshot/order/provenance history even if it is excluded from the public projection.

Public ordered reads therefore need the projection-freshness authority selected by #4028, not merely structural sequence versioning.

---

## 9. Required implementation tests

Future implementation must prove at minimum:

1. new import Tree starts private;
2. every newly imported Moment starts private regardless of provider availability state;
3. unavailable/private/unknown occurrences are preserved as private rows rather than silently dropped;
4. import `processing` exposes zero public Tree/Moment rows;
5. `partial_failed`, `failed`, and `cancelled` expose zero public Tree/Moment rows;
6. import `completed` without explicit publish still exposes zero public Tree/Moment rows;
7. publication preflight identifies exactly public-eligible + owner-approved Moments;
8. final publish promotes exactly that Moment set plus the Tree atomically;
9. held/excluded/ineligible Moments remain private after Tree publication;
10. stale publication revision causes zero partial visibility mutation;
11. concurrent owner edit versus publication fails/fences safely;
12. canonical reread confirms exact visibility state after commit;
13. public projection excludes private held Moments even when Tree is public;
14. no `draft/staged/importing` pseudo-value is written into canonical visibility;
15. source playlist privacy is never mutated.

300/1K/5K cross-repository E2E acceptance is coordinated with #4031.

---

## 10. Reconciled domain verdict

```text
IMPORT_VISIBILITY_MODEL = TREE_PLUS_SELECTED_MOMENT_PROMOTION
TREE_DURING_IMPORT = PRIVATE
ALL_IMPORTED_MOMENTS_DURING_IMPORT = PRIVATE
IMPORT_COMPLETION_AUTO_PUBLICATION = FORBIDDEN
FINAL_PUBLICATION = EXPLICIT_OWNER_ACTION
FINAL_PUBLICATION_TRANSACTION = TREE_PLUS_EXACT_SELECTED_PUBLIC_ELIGIBLE_MOMENTS
HELD_OR_INELIGIBLE_MOMENTS = REMAIN_PRIVATE
INCOMPLETE_FAILED_CANCELLED_PUBLIC_EXPOSURE = ZERO
VISIBILITY_PSEUDO_STATES = FORBIDDEN
PUBLICATION_FRESHNESS = DELEGATED_TO_4029_DEDICATED_AUTHORITY
RUNTIME_IMPLEMENTATION = NOT_YET_PERFORMED
```

This is future planning only. It authorizes no schema migration, import write, provider call, Production/Preview mutation, or public cutover.

Refs #4026.  
Refs #4027.  
Refs #4029.  
Refs #4031.  
Refs #4024.  
Refs #4004.  
Refs #3897 — Keep OPEN.  
Refs #1882 — Keep OPEN; use only `Refs #1882`.
