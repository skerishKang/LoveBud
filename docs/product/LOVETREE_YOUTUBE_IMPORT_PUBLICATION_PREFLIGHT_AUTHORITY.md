# LoveTree YouTube Import Publication Preflight Authority

**Issue:** #4029  
**Parent Epic:** #4024  
**Product parent:** #3897 — Keep OPEN  
**Platform authority:** #4004  
**Dependencies:** #4026 domain/provenance authority, #4028 public/owner read authority  
**Status:** Implementation-ready publication/privacy contract; no runtime implementation in this document.  
**Audited baseline:** LoveBud `main` `e282f610261d2562af51ce7da1506fbe3faa3c90`
**Last updated:** 2026-08-16
**Blocker corrections applied:** Web CTO review `4943690097` (publication freshness authority) + Web CTO follow-up `5301905315` (explicit final visibility transition)

---

## 1. Core decision

These visibility decisions are independent:

```text
YouTube source playlist visibility
!=
YouTube individual video availability/privacy
!=
LoveTree visibility
!=
LoveTree Moment visibility
```

A user may keep the source YouTube playlist **private forever**.

LoveBud/LoveTree may read that playlist with the user's OAuth authorization, create an independent private-first LoveTree snapshot, and later let the owner publish the LoveTree after a separate media-level preflight.

LoveBud must never change the source playlist's YouTube privacy setting as part of import or publication.

---

## 2. Official media signals

YouTube `video.status` provides relevant signals including:

```text
privacyStatus = public | unlisted | private
embeddable = true | false
```

`videos.list` can retrieve video resources by ID and has a low read quota cost. The implementation may batch provider checks according to current YouTube API limits and provider policy.

Official references reviewed:

- `https://developers.google.com/youtube/v3/docs/videos/list`
- `https://developers.google.com/youtube/v3/docs/videos`
- `https://developers.google.com/youtube/v3/guides/authentication`
- YouTube API Services Terms and Developer Policies

Provider data is an input to publication policy. It is not a reason to expose raw provider responses publicly.

---

## 3. Imported Tree default

Every playlist-derived Tree begins canonical-publication-private:

```text
Tree.visibility = private
ALL imported Moment.visibility = private
```

(`draft` / `staged` / `importing` are import lifecycle concepts, NOT canonical visibility values. The canonical visibility vocabulary is not extended with pseudo-values; import lifecycle state remains a separate server-side concept.)

Import completion means:

> the snapshot was successfully represented as canonical Tree/Moment data.

It does **not** mean:

> the source or Tree is safe/approved for public publication.

Automatic publish after import is prohibited.

---

## 4. Publication preflight requirement

Before changing an imported Tree from private/staged to public, the server must evaluate the current public eligibility of its source-media Moments.

Candidate route shape:

```text
POST /api/trees/{treeId}/publication-preflight
```

Owner-only.

The preflight must operate on current canonical Tree membership + current source availability signals, not only on stale data captured at initial import.

Candidate summary:

```json
{
  "ok": true,
  "treeId": "opaque",
  "sequenceVersion": 42,
  "publicationRevision": 17,
  "checkedAt": "2026-08-16T00:00:00Z",
  "validUntil": "2026-08-16T01:00:00Z",
  "summary": {
    "total": 5000,
    "publicEmbeddable": 4970,
    "publicLinkOnly": 10,
    "unlistedReview": 12,
    "privateOrUnavailable": 7,
    "unknown": 1
  },
  "publishReady": false
}
```

Exact names are implementation scope; distinction is authoritative.

---

## 5. Publication classification

Recommended normalized categories:

### `public_embeddable`

Provider currently reports public and embeddable.

Default publication behavior:

```text
eligible
```

subject to ordinary LoveTree visibility/media policy.

### `public_link_only`

Provider reports public but non-embeddable, while a normal YouTube watch-page link remains appropriate.

Default behavior:

```text
eligible only if LoveTree has a clear link-out fallback
```

Do not render a broken iframe as if playback is available.

If the current LoveTree viewer has no supported link-only representation, classify as review/hold instead of falsely marking publish-ready.

### `unlisted_review`

Provider reports unlisted.

Default behavior:

```text
requires explicit owner review/confirmation before public LoveTree publication
```

Reason:

An unlisted video is intentionally not normally discoverable in YouTube's public discovery surfaces. Putting its video identity/link into a public LoveTree can increase discovery beyond the user's previous context.

LoveBud must not silently treat `unlisted` as equivalent to `public` for publication.

### `private_or_unavailable`

Provider reports private, or current authorized/public checks show that the media cannot be accessed by a public viewer.

Default behavior:

```text
not publicly playable
must be excluded/held/private before Tree publication
```

Do not leak private-media titles, thumbnails, descriptions or provider account/source details to public viewers if those fields are not independently public.

### `unknown`

Availability could not be confidently evaluated due to provider failure, missing identity, timeout or ambiguous response.

Default behavior:

```text
fail closed
```

Unknown does not count as public-ready.

---

## 6. Preflight action model

For non-ready Moments, the owner must get explicit choices that preserve data rather than silently deleting it.

Candidate actions:

```text
exclude from public projection / keep private
retry availability check
open/review source where authorized
cancel publication
```

For unlisted media:

```text
explicitly include in public LoveTree
or
keep private/excluded
```

The product may later support per-Moment visibility, publication variants or redacted placeholders. The first implementation should choose the simplest existing canonical visibility mechanism rather than inventing a parallel publication database.

---

## 7. No automatic deletion

Publication preflight does not delete Moments.

If a source item is private/unavailable:

```text
canonical private owner Moment remains
public projection withholds/holds it
```

unless the owner explicitly deletes the Moment through normal Tree editing.

This preserves the user's private snapshot and its source ordering/history.

---

## 8. Source playlist provenance privacy

A public LoveTree does not automatically expose:

- private playlist ID;
- private playlist URL;
- private playlist title;
- provider connection/account identity;
- import job ID;
- source snapshot internal reference;
- private playlist visibility state.

Public viewer needs the approved Moment media presentation, not the owner's private collection provenance.

If a future feature offers source attribution, private collection attribution is opt-in and separately reviewed.

---

## 9. Public media identity

For a publishable public YouTube video, exposing the normal watch/embed video ID/URL is expected for playback/linking.

For unlisted media, that exposure itself is why explicit review is required.

For private/unavailable media, do not expose the provider media identity merely because it exists in owner provenance.

The owner projection may retain it behind authentication as needed for refresh/retry.

---

## 10. Preflight freshness

Do not rely forever on `source_state` captured during import.

Publication preflight should re-check media availability close to publication time.

Recommended freshness model:

```text
preflight result has:
- checked_at
- tree moment_sequence_version
- publication_revision (Section 24)
- provider state snapshot/version metadata as needed
- short validity window (TTL / valid_until)
```

`moment_sequence_version` alone is NOT sufficient publication freshness: a visibility/media/source/owner-decision change can change the publication outcome without changing the structural sequence. `publication_revision` advances on every such mutation (Sections 24–25).

If Tree membership/order changes, publication-relevant state changes, or the preflight expires, final publish must revalidate or reject the stale preflight.

The exact validity duration is configurable and should balance provider quota with privacy correctness.

For high-risk transitions from private Tree → public Tree, correctness wins over avoiding a small number of provider read calls.

---

## 11. Sequence/version binding

Preflight binds to the canonical authorities selected across the YouTube import RFCs. Three distinct semantic authorities exist:

```text
moment_sequence_version    = STRUCTURAL SEQUENCE REVISION      — ordered canonical set/order binding
public_projection_revision = ORDERED-READ PROJECTION REVISION  — #4028/#4035 public read membership revision
publication_revision       = PUBLICATION PREFLIGHT/PUBLISH FRESHNESS — this document (Section 24)
```

Preflight result is bound to (conceptually):

```text
preflight.tree_id
preflight.moment_sequence_version
preflight.publication_revision
preflight.checked_at
preflight.valid_until (TTL)
```

Final publish accepts only a preflight whose `moment_sequence_version` AND `publication_revision` are both compatible/current, and whose TTL is unexpired.

If the owner adds/removes/reorders source Moments after preflight:

```text
PUBLICATION_PREFLIGHT_STALE
```

and a fresh preflight is required.

If any publication-relevant mutation occurs (Section 25 P1–P12) — including visibility/media/source/owner-decision changes that do NOT change the structural sequence — the preflight is stale even though `moment_sequence_version` may be unchanged, because `publication_revision` advanced.

Reorder semantics: reorder may not change media eligibility, but V1 conservatively binds preflight to `moment_sequence_version` as well, so any reorder invalidates the reviewed preflight and requires a fresh one (the user reviewed a specific canonical set/order).

---

## 12. Final publish gate

Candidate publish route remains separate from preflight:

```text
POST /api/trees/{treeId}/publish
```

Request carries a server-issued preflight reference/version, not a client-authored list of “safe” media states.

Server validates:

1. actor still owns Tree;
2. Tree is eligible for publication;
3. import is completed/reconciled;
4. preflight belongs to this Tree/actor;
5. preflight is current/non-expired — TTL valid AND `publication_revision` current;
6. `moment_sequence_version` compatible/current AND `publication_revision` compatible/current;
7. provider/media eligibility result still valid according to contract;
8. all blocking Moments are resolved;
9. unlisted owner decisions are still current/recorded;
10. visibility promotion plan matches the reviewed preflight (exact approved/public-eligible set);
11. final canonical visibility mutation — approved Moments + Tree — is ONE atomic transaction; any mid-publish failure rolls back (zero partial public state);
12. public reread exposes only the permitted projection.

A client cannot mint publication authority: `publication_revision` and the preflight reference are server-issued/checked. A stale browser cannot bypass current server policy by posting `publishReady: true`.

---

## 13. Provider checking strategy for 5K

A 5K Tree can require many media checks.

`videos.list` should be batched by provider-supported ID groups rather than one call per Moment.

Recommended architecture:

```text
collect unique media IDs requiring revalidation
→ batch provider checks
→ map results back to source occurrence Moments
→ persist/cache only bounded normalized availability state
→ produce preflight summary + exception set
```

Duplicate video occurrences can share one provider availability lookup while preserving separate Moment decisions.

Do not make 5,000 individual provider requests.

Exact batch size follows current YouTube API constraints and implementation tests.

---

## 14. Missing provider result

If `videos.list` does not return a requested ID, do not assume it is public.

Normalize as:

```text
private_or_unavailable
or
unknown
```

based on the evidence and authenticated context.

Fail closed for publication.

No raw provider error body to browser.

---

## 15. Link-only behavior

LoveTree's primary media presentation may favor embedded YouTube playback.

`status.embeddable=false` means the app cannot truthfully promise inline playback.

Before allowing a `public_link_only` Moment:

- verify normal public watch link is appropriate;
- UI clearly displays link-out/open-on-YouTube behavior;
- viewer does not show a permanently failing player as the main interaction.

If product wants embed-only public Moments, then non-embeddable videos become review/hold instead. This is a UI/product choice that must be fixed before runtime publish implementation.

---

## 16. Unlisted explicit consent record

If owner chooses to include unlisted media in a public LoveTree, record a bounded canonical decision, conceptually:

```text
moment_id
publication_decision = include_unlisted
actor_id
source_state_at_decision = unlisted
confirmed_at
preflight_id/version
```

Do not store the consent only in client state.

If source state later changes to private/unavailable, the public viewer must fail closed despite earlier unlisted consent.

---

## 17. Post-publication source changes

Snapshot import is independent from source sync, but public playback state can change later on YouTube.

V1 rule:

- LoveTree content does not automatically reorder/delete based on source changes;
- viewer/media adapter must already fail gracefully if source becomes unavailable;
- a future periodic or on-demand availability refresh may mark public Moments unavailable/held;
- such refresh must never expose newly private data;
- if a previously public video becomes private, public projection/playback should stop exposing private-only provider metadata as soon as the application learns of the change.

Do not attempt to change the YouTube video's privacy.

---

## 18. Public Tree count/read implications

#4028 public reads must count only the public-eligible/visible projection.

Example owner Tree:

```text
5000 total owner Moments
4992 public-eligible
8 private/held
```

Public shell:

```text
momentCount = 4992
```

unless product explicitly renders safe public placeholders for held items. Do not leak “8 hidden private source items” merely through counts unless approved.

Owner shell can show full 5000 + preflight summary.

---

## 19. Import state gate

Only a completed/reconciled import can proceed to publication preflight.

Reject:

```text
queued
processing
partial_failed
failed
cancelled
```

for ordinary public publish.

A future owner may manually resolve a partial import into a complete Tree, but that requires explicit canonical state transition before publish.

---

## 20. Error categories

Candidate browser-safe categories:

```text
PUBLICATION_NOT_OWNER
PUBLICATION_IMPORT_INCOMPLETE
PUBLICATION_PREFLIGHT_REQUIRED
PUBLICATION_PREFLIGHT_STALE
PUBLICATION_BLOCKED_PRIVATE_MEDIA
PUBLICATION_UNLISTED_REVIEW_REQUIRED
PUBLICATION_MEDIA_UNKNOWN
PUBLICATION_PROVIDER_REAUTH_REQUIRED
PUBLICATION_PROVIDER_UNAVAILABLE
PUBLICATION_SEQUENCE_CHANGED
```

Do not return private video titles/IDs in generic error messages.

Detailed owner UI can receive bounded item refs after authorization.

---

## 21. Required UI contract

Owner sees:

```text
Ready to publish: 4,970
Link-only: 10
Unlisted — review: 12
Private/unavailable — keep private or exclude: 7
Unknown — retry: 1
```

Actions are explicit.

Do not use frightening “your private playlist will become public” copy, because that is false.

Correct copy should explain:

> Your YouTube playlist stays unchanged. Publishing affects this LoveTree only. Some individual videos may need review before they can appear publicly.

---

## 22. Security/privacy tests required after implementation

1. private source playlist remains unchanged through import/publish;
2. import completion does not publish;
3. unauthenticated/non-owner preflight rejected;
4. preflight on incomplete import rejected;
5. public+embeddable classified eligible;
6. public+non-embeddable follows selected link-only/hold policy;
7. unlisted requires explicit review;
8. private/unavailable blocks public media projection;
9. missing/unknown provider result fails closed;
10. private playlist identity absent from public response;
11. private media identity/metadata absent where not independently public;
12. stale preflight rejected after Tree sequence change;
13. preflight from Tree A cannot publish Tree B;
14. client-authored `publishReady` cannot bypass server result;
15. duplicated video occurrences share provider check safely but keep separate Moment decisions;
16. 5K provider validation uses bounded batching, not N individual requests;
17. public count reflects public projection only;
18. visibility revocation/current security contracts remain intact.

---

## 23. Non-goals

- no source playlist privacy mutation;
- no YouTube video privacy mutation;
- no auto-publish;
- no raw OAuth/provider response exposure;
- no automatic deletion of unavailable Moments;
- no assumption unlisted == public;
- no assumption public == embeddable;
- no 5,000 provider calls for 5,000 Moments;
- no publication from partial/failed import;
- no runtime publish implementation in this authority PR.

---

## 24. Publication freshness authority

#4029 selects one explicit server-controlled authority for publication/preflight freshness:

```text
publication_revision
= server-controlled monotonic revision of publication-relevant canonical state
```

`publication_revision` is incremented transactionally with every mutation that can change a publication outcome. Only the server issues/checks it; a client can never mint or supply it.

Relationship to the other authorities:

```text
moment_sequence_version    = STRUCTURAL SEQUENCE REVISION      — ordered canonical set/order binding
public_projection_revision = ORDERED-READ PROJECTION REVISION  — #4028/#4035 public read membership revision
publication_revision       = PUBLICATION PREFLIGHT/PUBLISH FRESHNESS — this document
```

All three are semantically distinct:

```text
moment_sequence_version != public_projection_revision != publication_revision
```

`!=` means distinct semantic responsibility. It does NOT mandate three physical columns: whether future implementation shares one storage generation or uses separate columns is a future implementation decision. Semantic authority stays distinct.

`publication_revision` is NOT a general content revision: title/memo/display-content edits that do not change publication outcome must not bump it.

This closes the stale-preflight hole:

```text
preflight(sequenceVersion=42, publication_revision=R17)
→ visibility / media / source / owner-decision mutation (no insert/delete/reorder)
→ moment_sequence_version still 42 (structural sequence unchanged)
→ publication_revision = R18 (incremented transactionally with the mutation)
→ old preflight cannot appear current; PUBLICATION_PREFLIGHT_STALE
```

---

## 25. Publication revision invalidation matrix

The freshness authority must invalidate a stale preflight on at least:

```text
P1.  Moment add
P2.  Moment remove
P3.  relevant Moment visibility change
P4.  Tree visibility change
P5.  source/media identity change affecting the provider lookup target
P6.  canonical state change affecting public / link-only / unlisted / private / unavailable / unknown classification
P7.  unlisted include decision
P8.  unlisted exclude/revoke decision
P9.  approved public projection membership change
P10. any owner mutation affecting publication eligibility
P11. blocking-item resolution change
P12. provider/media preflight target set change
```

Role separation:

```text
moment_sequence_version = ordered canonical set binding
publication_revision    = publication eligibility/preflight freshness binding
```

Reorder semantics: reorder does not by itself change media eligibility, but V1 conservatively keeps the preflight bound to the reviewed canonical set/order — any reorder makes the preflight stale (`PUBLICATION_PREFLIGHT_STALE`) and requires a fresh one, even if `publication_revision` did not need to advance. This keeps the publish target exactly bound to what the user reviewed.

---

## 26. Final visibility transition

Selected staging model (mirrors the current #4026/#4033 direction):

```text
During import/review:
  Tree.visibility = private
  ALL imported Moment.visibility = private
  (the ordinary omitted-visibility write path under a private Tree naturally persists
   imported Moments as canonical private)
Import lifecycle state (queued / processing / partial_failed / failed / cancelled / completed)
  is a SEPARATE server-side concept — never a canonical visibility pseudo-value
Import completion != publication
Final publication = explicit owner action
```

```text
FINAL_PUBLICATION_VISIBILITY_TRANSITION = APPROVED_MOMENTS + TREE ATOMIC PROMOTION
```

The final publish contract (single atomic boundary):

1. current fresh preflight verified — not expired, `publication_revision` current, `moment_sequence_version` compatible;
2. exact approved/public-eligible Moment set fixed from the reviewed preflight;
3. blocked / private / unavailable / unknown / rejected-unlisted Moments stay private (owner-preserved canonical Moments, never in any public projection or public count);
4. exactly the approved/public-eligible Moments are promoted to canonical public;
5. the Tree is promoted to canonical public;
6. steps 4–5 happen in one transaction / atomic publish boundary;
7. any mid-publish failure rolls back — zero partial public state, no half-promoted Tree;
8. public reread verifies the exposed projection matches exactly the permitted set.

Under this model, final publish never changes Tree visibility alone: promoting only the Tree under an all-private staging model would yield a public Tree with no public Moments (a broken projection), and promoting Moments while the Tree stays private would keep effective public exposure zero. The promotion is always the approved set + Tree together.

---

## 27. Failure / partial import safety

Public exposure must be 0 in every import lifecycle state:

```text
queued
processing / importing
partial_failed
failed
cancelled
```

Import completion alone never publishes. Only the explicit final publication action (Section 26) can expose any public surface.

Private / unavailable / rejected / unresolved items remain owner-preserved canonical Moments, but are never exposed through any public projection — including counts (Section 18) and playback surfaces.

LoveBud never mutates YouTube source playlist privacy or video privacy (Sections 1, 17, 23).

---

## 28. Future contract test matrix

Runtime test code is NOT implemented in this authority PR. When publication runtime lands, at least the following contract tests are required:

```text
F1.  preflight → Moment add → stale
F2.  preflight → Moment remove → stale
F3.  preflight → Moment visibility change → stale
F4.  preflight → Tree visibility-relevant change → stale
F5.  preflight → media/source identity change → stale
F6.  preflight → unlisted include decision change → stale
F7.  preflight → unlisted revoke/exclude → stale
F8.  no publication-relevant mutation + unexpired preflight → may remain valid
F9.  stale preflight cannot publish via client `publishReady: true`
F10. Tree A preflight cannot publish Tree B
F11. blocked/private item remains private after successful publication
F12. approved public-eligible Moment promotion + Tree promotion atomic
F13. failure mid-publish → zero partial public state
F14. partial_failed/importing Tree cannot publish
F15. source playlist remains unchanged
F16. public reread matches exactly approved/public-eligible projection
F17. publication_revision stale while structural sequence unchanged → publish reject
F18. moment_sequence_version stale while publication_revision unchanged → publish reject / re-preflight per contract
```

---

## 29. Implementation split

After authority approval:

1. normalized media availability adapter/batch contract;
2. publication preflight server route + persisted/ephemeral preflight authority;
3. owner preflight UI;
4. unlisted explicit decision persistence if required;
5. server publish gate binding to current preflight/sequence;
6. public projection hardening under #4028;
7. 300/1K/5K preflight/load evidence under #4031.

---

## 30. Authority verdict

```text
SOURCE_PLAYLIST_PRIVACY_MUTATION = PROHIBITED
IMPORT_COMPLETE_TO_AUTO_PUBLIC = PROHIBITED
PUBLICATION_AUTHORITY = LOVETREE OWNER + SERVER PREFLIGHT
MEDIA_PUBLICATION_CHECK = PER UNIQUE MEDIA, BATCHED
PUBLIC_EMBEDDABLE = ELIGIBLE_BY_DEFAULT
PUBLIC_NON_EMBEDDABLE = LINK_ONLY_IF UI SUPPORTS IT, OTHERWISE HOLD
UNLISTED = EXPLICIT_OWNER_REVIEW_REQUIRED
PRIVATE_OR_UNAVAILABLE = PUBLICATION_WITHHELD
UNKNOWN = FAIL_CLOSED
PRIVATE_SOURCE_PROVENANCE_PUBLIC = PROHIBITED
PREFLIGHT_SEQUENCE_BINDING = REQUIRED
PUBLICATION_FRESHNESS_AUTHORITY = SERVER-CONTROLLED publication_revision
MOMENT_SEQUENCE_VERSION_ROLE = STRUCTURAL_ONLY
PUBLIC_PROJECTION_REVISION_ROLE = ORDERED_READ_ONLY
PUBLICATION_REVISION_ROLE = PREFLIGHT/PUBLISH_FRESHNESS
FINAL_VISIBILITY_TRANSITION = APPROVED_MOMENTS + TREE ATOMIC PROMOTION
STALE_PREFLIGHT_BYPASS = PROHIBITED
RUNTIME_IMPLEMENTATION = NOT_YET_PERFORMED
```
