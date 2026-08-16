# LoveTree Private YouTube 5K RFC — Child Authority Reconciliation

**Parent umbrella RFC:** `LOVETREE_PRIVATE_YOUTUBE_PLAYLIST_IMPORT_5K_RFC.md`  
**Product parent:** #3897 — Keep OPEN  
**Future Epic:** #4024  
**Shared platform authority:** #4004  
**Child authorities:** #4025, #4026, #4027, #4028, #4029, #4031  
**Status:** Normative planning addendum. No runtime/schema/provider/Production/Preview implementation is authorized by this document.

---

## 1. Authority rule

The umbrella RFC intentionally described the product and architecture at a broad level. Subsequent child-RFC reviews selected additional correctness and security invariants that are narrower than some of that original wording.

For implementation planning, this addendum is a **normative extension of the umbrella RFC**.

Where the earlier umbrella RFC is broad or ambiguous, the corresponding child authority and the invariants below **supersede the broad wording**. Runtime work must not start by satisfying only the older umbrella checklist while bypassing a child-selected gate.

The implementation sequence remains future work. This document only reconciles the planning authority.

---

## 2. OAuth reconnect and refresh-credential convergence

Authority: #4025 / PR #4032.

The future provider-account model must have one canonical active connection authority for the same application actor, provider, and provider identity.

Required behavior:

```text
same actor + same provider + same provider identity
→ one canonical active connection authority
```

Reconnect semantics must be explicit:

- reconnect **without** a newly issued `refresh_token` must preserve a still-valid stored refresh credential rather than clearing it;
- reconnect **with** a new refresh token must atomically rotate the encrypted credential and its credential generation/version;
- disconnect/revoke must invalidate superseded credential generations;
- import jobs must not silently continue using a superseded provider connection or credential generation;
- browser state must never become the canonical long-lived provider credential authority.

A future implementation may choose exact table/field names, but it must prove credential-generation convergence and stale-credential rejection.

---

## 3. Imported-Moment visibility lifecycle must be selected explicitly

Authority: #4026 / PR #4033.

The earlier phrase `private/draft/staged` is not sufficient runtime authority because the current canonical visibility model uses literal visibility semantics that must remain unambiguous.

Before import writes are implemented, the child authority must select one coherent lifecycle, for example:

```text
MODEL A
Tree remains private/incomplete
+ publishable Moments may already carry public visibility
+ effective public exposure remains zero because Tree visibility is private

or

MODEL B
Tree and imported Moments remain private during import/review
+ final publication transactionally promotes exactly the owner-approved Moments
```

The exact selected model is a child/domain decision, but these invariants are mandatory:

- incomplete import public exposure = 0;
- failed import public exposure = 0;
- cancelled import public exposure = 0;
- no hidden `draft`/`staged` pseudo-visibility may conflict with canonical literal visibility semantics;
- final publication behavior must match the selected lifecycle exactly;
- source playlist privacy never determines LoveTree/Moment visibility automatically.

---

## 4. Async executor lease fencing is separate from item idempotency

Authority: #4027 / PR #4034.

A durable resumable import job needs protection against an old executor resuming after its lease has expired and another executor has taken ownership.

Required authority:

```text
lease acquisition / takeover
→ monotonic fencing generation
   or transactionally equivalent fencing authority
```

Every authoritative mutation performed by an executor must prove that it still owns the current generation, including:

- checkpoint writes;
- processed/succeeded/failed counts;
- item persistence decisions;
- lease renewal;
- job status transitions;
- cancellation acknowledgement;
- terminal `completed|partial_failed|failed|cancelled` transitions.

A stale executor that resumes after takeover must perform:

```text
AUTHORITATIVE_MUTATIONS = 0
```

Item-level idempotency prevents duplicate item effects; it does **not** replace stale-worker fencing.

---

## 5. Provider cross-page enumeration must prove snapshot coherence

Authority: #4027 / PR #4034.

A 300/1K/5K `playlistItems.list` traversal may span many provider pages. Provider page tokens must not be treated as if they provided database-style snapshot isolation.

A long import must account for source membership/order changes during enumeration.

The future job authority therefore needs bounded coherence evidence such as:

- bounded revalidation of playlist state;
- a server-controlled occurrence/order fingerprint;
- equivalent source revision/coherence proof.

Important invariants:

- total-count equality alone is insufficient;
- remove+insert or reorder can preserve the same total count while changing the snapshot;
- a mixed-version enumeration must not be committed as a truthful `completed` snapshot;
- retry/restart behavior must preserve occurrence identity and source-order truthfulness.

Exact provider-specific mechanics remain a child implementation decision.

---

## 6. Public ordered-read cursor freshness requires public-projection authority

Authority: #4028 / PR #4035.

A structural `moment_sequence_version` can protect order changes, but it is not sufficient by itself to fence visibility-only changes in a public projection.

Public cursor/range reads require a public-projection revision/fingerprint or transactionally equivalent membership authority.

Mandatory behavior:

- current Tree/Moment visibility is rechecked before public data is returned;
- content revoked since cursor issuance is never preserved merely to maintain cursor continuity;
- a stale public cursor rejects/restarts when its projection membership authority is no longer current;
- a stale cursor must not silently skip newly-public Moments that now belong earlier in the ordered projection;
- owner and public read models may share structural order while maintaining distinct projection-freshness authority.

Security/revocation correctness is higher priority than keeping an old cursor apparently continuous.

---

## 7. Publication preflight needs dedicated freshness authority

Authority: #4029 / PR #4036.

`moment_sequence_version` alone is not an authorization/publication freshness token because publication eligibility also depends on state such as:

- Tree visibility/publication intent;
- Moment visibility;
- source/media availability classification;
- owner include/exclude decisions;
- relevant provenance/source state;
- other publication-policy inputs selected by the child authority.

Final publication therefore requires a dedicated `publication_revision`, server-issued eligibility/input fingerprint, or transactionally equivalent authority that covers **every publication-relevant mutation**.

Required behavior:

```text
preflight evidence becomes stale
→ final publish rejects/re-runs preflight
→ stale eligibility is never silently accepted
```

Final publication semantics must also match the imported-Moment visibility lifecycle selected under #4026.

---

## 8. Reconciled umbrella implementation-start gate

The private/account-owned playlist runtime must not begin merely because the original umbrella RFC exists.

Before runtime/schema/provider implementation starts, all of the following must be selected or explicitly waived by the Web CTO/product owner with evidence:

```text
UMBRELLA_PRODUCT_DIRECTION = APPROVED
SHARED_PLATFORM_AUTHORITY_4004 = PRESERVED
OAUTH_RECONNECT_CONVERGENCE = SELECTED
IMPORT_VISIBILITY_LIFECYCLE = SELECTED
ASYNC_LEASE_FENCING = SELECTED
PROVIDER_SNAPSHOT_COHERENCE = SELECTED
PUBLIC_PROJECTION_CURSOR_FRESHNESS = SELECTED
PUBLICATION_FRESHNESS_AUTHORITY = SELECTED
CROSS_REPO_300_1K_5K_E2E_GATES = DEFINED
AI_RELATIONSHIP_DISCOVERY = NON_BLOCKING
```

And the following remain forbidden as a shortcut:

- Production OAuth/provider credential setup from planning docs;
- Production schema/data mutation;
- second LoveTree writable canonical backend;
- auto-publication on import completion;
- treating playlist adjacency as semantic Connection authority;
- treating page-token continuity as source snapshot isolation;
- treating item idempotency as stale-executor fencing;
- treating structural sequence version as sufficient public/publication freshness authority.

---

## 9. Reconciled planning verdict

With this addendum, the umbrella planning authority should be interpreted as:

```text
PRODUCT_DIRECTION_SOUND
CHILD_AUTHORITY_MAP_SOUND
OAUTH_RECONNECT_CONVERGENCE_REQUIRED
IMPORT_VISIBILITY_LIFECYCLE_REQUIRED
LEASE_FENCING_REQUIRED
PROVIDER_SNAPSHOT_COHERENCE_REQUIRED
PUBLIC_PROJECTION_CURSOR_FRESHNESS_REQUIRED
PUBLICATION_FRESHNESS_REQUIRED
FUTURE_RFC_RECONCILIATION = COMPLETE
NO_RUNTIME_IMPLEMENTATION_AUTHORIZED
```

This is a planning reconciliation only. It does not make #4024 or its implementation children current-priority work, and it does not block unrelated LoveBud or shared-platform work.

Refs #3897 — Keep OPEN.  
Refs #4024.  
Refs #4025.  
Refs #4026.  
Refs #4027.  
Refs #4028.  
Refs #4029.  
Refs #4031.  
Refs #4004.  
Refs #1882 — Keep OPEN; use only `Refs #1882`.
