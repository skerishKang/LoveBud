# Love Matchmaking — Product Boundary (Phase 0)

**Parent issue:** #3560 — Keep OPEN
**Child issue:** #3718
**Refs:** #3425 — Keep OPEN · #1882 — Keep OPEN
**ADR status:** PROPOSED (see `LOVE_MATCHMAKING_ARCHITECTURE_DECISION.md`)
**Phase:** Phase 0 — product and boundary decision only. No runtime implementation authorized.
**Baseline:** `origin/main` `235ec59b2a5a40e0cf0115ebe45b2c6e50abbcdc`

---

## 1. User problem and product statement

### 1.1 User problem

LoveBud answers: *What did I love, remember, and feel?*

A person records videos, links, selected moments, emotions, notes, tags, and the
sequence of a LoveTree. The product is a warm, analog-scrapbook-style recorder of a
personal emotional journey. It is explicitly **not** a feed, a board, a bookmark
manager, or a generic community platform
(`docs/product/PRODUCT_IDENTITY.md:1-5`, `:81-93`).

The problem Love Matchmaking addresses is different:

> *Who has lived through a meaningfully similar emotional and narrative pattern, and
> do we both want to connect?*

LoveBud records are rich with the raw material for this question — shared source
content, overlapping scenes/moments, similar emotion tags and interpretations, and
similar LoveTree stages or emotional trajectories (`docs/project/WEB_CTO_WEB_DEVELOPER_LOCAL_VALIDATION.md`
references #3560; issue #3560 §Core matching principle). But LoveBud today has no
mechanism to turn those signals into a **bilateral, consent-aware, explainable
relationship-discovery experience**. Existing social is limited to tree-level and
moment-level comments/reactions only (`docs/product/TREE_MOMENT_SOCIAL_MODEL.md:1-9`),
with no social graph, no connection state, no blocking/reporting, and no messaging
(`modal_compute/app.py` exposes `tree_comments`, `comments`, `tree_likes`,
`tree_views` — no friends/follows/connection-request tables).

### 1.2 Product statement

> Love Matchmaking helps mutually consenting people discover others whose recorded
> emotional journeys genuinely resonate — through the moments and emotional paths they
> actually recorded, rather than primarily through age, gender, nationality, location,
> or a manually written profile.

The relationship does not need to be romantic. Possible outcomes include friendship,
fandom connection, creative collaboration, peer support, or other mutually chosen
relationships (issue #3560 §Product idea).

---

## 2. Romantic and non-romantic intents

Love Matchmaking is **intent-agnostic by default**. The matching signal is emotional
and narrative resonance, not demographic or romantic compatibility.

- **Non-romantic first:** friendship, fandom peer, creative partner, peer support,
  shared-interest resonance. These are the primary, default outcomes.
- **Romantic as one possible intent:** a user may optionally select a relationship-intent
  preference (e.g., open to romantic connection), but this is a **user-controlled
  constraint**, not the matching basis. Demographic-first ranking is prohibited
  (issue #3560 §Non-goals; issue #3718 §Hard boundaries).
- **No destiny/compatibility claims:** the system must not claim destiny, psychological
  diagnosis, personality certainty, or objective compatibility (issue #3560 §Explainability
  requirement).

---

## 3. Distinction from dating apps, friend apps, and ordinary social networks

| Dimension | Dating apps | Friend/social apps | Ordinary social networks | Love Matchmaking |
|---|---|---|---|---|
| Primary signal | Age, gender, location, photos, swipes | Mutual friends, shared groups, likes | Feed affinity, follows, likes | Recorded emotional/narrative resonance |
| Matching unit | Profile + photo | Social graph proximity | Content/feed affinity | Moment, tree, trajectory, resonance profile |
| Consent model | Implicit swipe = interest | Follow/request = interest | Public-by-default sharing | Explicit opt-in to matching; fail-closed |
| Connection gate | Swipe → chat | Follow → chat | Follow → feed | Resonance → limited preview → bilateral request → messaging |
| Data source | Self-written profile | Social graph + posts | Feed content | User's own recorded LoveBud moments/emotions |
| Explainability | Limited | Limited | Algorithmic feed opaque | Required: shared themes, similar flow, cross-language meaning |

Love Matchmaking is distinguished by matching on **recorded emotional journeys**
rather than demographic filters, social-graph proximity, or feed affinity. It reuses
LoveBud concepts and data contracts but uses a completely new design identity and
interaction model (issue #3560 §Why this may deserve a separate product boundary).

---

## 4. What remains a LoveBud-native capability

LoveBud remains the **recording product**. The following capabilities stay in LoveBud:

- Recording videos, links, and meaningful content into a LoveTree
  (`docs/product/PRODUCT_IDENTITY.md:9`; `modal_compute/memory_writes.py`)
- Selecting moments, emotions, notes, tags, and interpretations
  (`docs/product/PRODUCT_IDENTITY.md:9`; `docs/product/TREE_MOMENT_SOCIAL_MODEL.md:46-53`)
- The sequence and development of a LoveTree (the emotional path)
  (`docs/product/PRODUCT_IDENTITY.md:86-87`)
- Public moment save/remix with attribution (a LoveBud feature, issue #3560 §LoveBud-native moment reuse)
- Moment/tree similarity discovery (a LoveBud feature, issue #3560 §LoveTree and moment similarity discovery)
- User-facing self-analysis and explainability of one's own tree
  (issue #3560 §Phase 1 — LoveBud foundations)
- Public/private visibility and Plus-private-storage policy
  (`docs/engineering/API_CONTRACT.md:157-210`, `:240-256`; `docs/backend/backend.md:114-141`)
- Tree-level and moment-level comments/reactions (scoped social, not a connection graph)
  (`docs/product/TREE_MOMENT_SOCIAL_MODEL.md:1-9`; `modal_compute/tree_comments.py`,
  `modal_compute/comments.py`)
- Deletion of trees, memories, and comments with owner-boundary guards
  (`modal_compute/owner_writes.py:145-166` delete_owner_tree; `:delete_owner_memory`;
  `modal_compute/comments.py` soft_delete_own_comment)

---

## 5. What belongs only to Love Matchmaking

The following capabilities belong **only** to Love Matchmaking and must not be
implemented inside the LoveBud application:

- Matching-consent controls (explicit opt-in to person matching, separate from public visibility)
  (issue #3560 §Consent and privacy principles; issue #3718 §Required child plan #2)
- Derived resonance-profile construction and storage (content, moment, emotional-interpretation,
  narrative-trajectory, attention, temporal, multilingual similarity)
  (issue #3560 §Core matching principle; issue #3718 §Document 3)
- Explainable similarity discovery (match cards explaining shared themes, similar flow,
  cross-language meaning) (issue #3560 §Explainability requirement)
- Connection-request state (send/accept/reject resonance or connection requests)
  (issue #3560 §Product flow hypothesis; issue #3718 §Required child plan #6)
- Blocking, reporting, and moderation for person-to-person interactions
  (issue #3560 §Safety and governance model; issue #3718 §Required child plan #7)
- Messaging (only after bilateral consent and safety gates) (issue #3560 §Messaging;
  issue #3718 §Required child plan #8)
- Relationship-intent selection and limited profile disclosure boundaries
  (issue #3560 §Architecture questions; issue #3718 §profile disclosure boundary)
- Age/minor-adult separation and safety policy for open connection/messaging
  (issue #3560 §Consent and privacy principles; issue #3718 §minor/adult prerequisite)

---

## 6. Permitted interoperability boundaries

Love Matchmaking may interoperate with LoveBud **only** through explicit, consent-aware
contracts. The boundary is one-way export of consented signals, never tight coupling
to LoveBud's UI or database.

### 6.1 What may be shared

- **Consented public signals:** source content, public moments, public emotion tags,
  public narrative trajectory — only when the owner has explicitly opted into matching
  (issue #3560 §Consent and privacy principles; issue #3718 §Required child plan #1).
- **Derived resonance profile:** a derived, consent-scoped summary of similarity signals,
  stored in the Matchmaking system, not as a raw dump of LoveBud data
  (issue #3560 §Consent and privacy principles; issue #3718 §Document 2).
- **Identity binding:** the Firebase UID may be used to bind a LoveBud account to a
  Matchmaking account, but Matchmaking maintains its own relationship-intent profile,
  discovery preferences, and connection state (issue #3560 §Architecture questions;
  `docs/engineering/API_CONTRACT.md:237` canonical entitlement field
  `users/{uid}.privateStorageEnabled`).

### 6.2 What may NOT be shared

- Raw private text or private moment content may not be exposed to another user merely
  to explain a match (issue #3560 §Consent and privacy principles).
- Private LoveTrees and private moments are excluded by default (issue #3560 §Consent
  and privacy principles).
- Public visibility does not automatically equal consent to person matching
  (issue #3560 §Consent and privacy principles; `docs/engineering/API_CONTRACT.md:192-210`
  public visibility ≠ browse eligibility).
- Direct shared-database coupling is not assumed as the default (issue #3560 §Architecture
  questions; issue #3718 §Document 2).

---

## 7. Primary journeys: LoveBud records → mutual connection

```
LoveBud records
  → matching-consent controls (opt-in to person matching, per field/tree/moment/signal)
  → consented resonance profile (derived, explainable, fail-closed)
  → explainable similarity discovery (match card: shared themes, similar flow, cross-language meaning)
  → limited profile preview (no private text; bounded disclosure)
  → send a resonance or connection request
  → mutual acceptance (bilateral connection state)
  → friendship/connection state
  → messaging (only after safety, consent, moderation, and connection-state gates)
```

Each arrow is a separate, gated phase. Messaging is the last step and requires all
safety gates to be operational (issue #3560 §Product flow hypothesis; issue #3718
§Required child plan #8).

---

## 8. Cold-start behavior

### 8.1 New LoveBud users

A user with insufficient LoveBud history cannot meaningfully participate in matching.
Minimum data rules apply:

- A user must have a minimum amount of **consented public** record history before
  matching becomes meaningful (issue #3560 §Open product questions; issue #3718
  §minimum data and cold start).
- New users without enough records are not shown as match candidates to others and
  do not receive match suggestions until they meet the minimum threshold.

### 8.2 Cold-start validation

Cold-start behavior is validated through **synthetic/offline** resonance prototypes
before any real-user matching (issue #3560 §Phase 2 — Offline matching prototype;
issue #3718 §Required child plan #3). No production data is used for validation.

---

## 9. Phased validation roadmap

| Phase | Name | Scope | Evidence |
|---|---|---|---|
| 0 | Product and boundary decision | Decide what remains LoveBud; decide repository/application boundary; define signal, consent, safety contract | This document set |
| 1 | LoveBud foundations | Public moment save/remix with attribution; moment/tree similarity discovery; user-facing self-analysis and explainability; matching-consent controls | `docs/product/TREE_MOMENT_SOCIAL_MODEL.md` (social scope); issue #3560 §Phase 1 |
| 2 | Offline matching prototype | Synthetic or explicitly consented test data only; evaluate whether similarity signals produce understandable and useful matches | issue #3560 §Phase 2; issue #3718 §Required child plan #3 |
| 3 | Separate product prototype | Bounded Love Matchmaking experience using approved architecture boundary and distinct design direction | issue #3560 §Phase 3; issue #3718 §Required child plan #5 |
| 4 | Connection controls | Bilateral requests, block/report, safety policy, limited profile disclosure | issue #3560 §Phase 4; issue #3718 §Required child plan #6, #7 |
| 5 | Messaging | Only after safety, consent, moderation, and connection-state contracts are operational | issue #3560 §Phase 5; issue #3718 §Required child plan #8 |

---

## 10. Explicit non-goals

This Phase 0 decision does **not** authorize:

- Creating a new repository immediately (issue #3560 §Non-goals; issue #3718 §Hard boundaries)
- Implementing matching, friends, follows, or messaging now (issue #3560 §Non-goals)
- Changing the current LoveBud database or identity model (issue #3560 §Non-goals)
- Using private LoveTrees or private moments for matching (issue #3560 §Non-goals)
- Unrestricted direct messaging (issue #3560 §Non-goals)
- Dating or compatibility guarantees (issue #3560 §Non-goals)
- Demographic-first ranking (issue #3560 §Non-goals; issue #3718 §Hard boundaries)
- Sensitive-trait inference (issue #3560 §Non-goals; issue #3718 §Hard boundaries)
- Production data processing or migration (issue #3560 §Non-goals)
- A broad LoveBud UI redesign (issue #3560 §Non-goals)
- Mixing Scout implementation with matchmaking implementation (issue #3560 §Non-goals)
- Runtime implementation of any kind (issue #3718 §Hard boundaries)

---

## 11. Open product decisions

1. What is the primary unit of matching: moment, tree, trajectory, or combined
   resonance profile? (issue #3560 §Open product questions #1)
2. Should users choose relationship intent such as friendship, fandom peer, creative
   partner, or open connection? (issue #3560 §Open product questions #2)
3. How should similarity be explained without exposing private text?
   (issue #3560 §Open product questions #3)
4. How should users correct or remove an inaccurate derived profile?
   (issue #3560 §Open product questions #4)
5. What minimum amount of LoveBud history is required before matching becomes
   meaningful? (issue #3560 §Open product questions #5)
6. How should new users participate without enough records?
   (issue #3560 §Open product questions #6)
7. Should the system show exact scores, bands, or only shared themes?
   (issue #3560 §Open product questions #7)
8. How should multilingual records preserve nuance while enabling comparison?
   (issue #3560 §Open product questions #8)
9. Which parts of the profile are visible before and after mutual acceptance?
   (issue #3560 §Open product questions #9)
10. What is the correct boundary between public discovery and private connection?
    (issue #3560 §Open product questions #10)

These remain open pending Phase 1–2 validation and are recorded in
`LOVE_MATCHMAKING_SIGNALS_CONSENT_SAFETY_CONTRACT.md` §Unresolved decisions.

---

## 12. Stop conditions before implementation

Before any Love Matchmaking implementation or repository creation:

1. The product boundary (this document) is reviewed and accepted by Web CTO.
2. The architecture decision (`LOVE_MATCHMAKING_ARCHITECTURE_DECISION.md`) is accepted.
3. The signals, consent, and safety contract (`LOVE_MATCHMAKING_SIGNALS_CONSENT_SAFETY_CONTRACT.md`)
   is accepted.
4. Phase 1 LoveBud foundations are complete: matching-consent controls, moment/tree
   similarity discovery, and user-facing self-analysis/explainability.
5. Phase 2 offline resonance prototype validates that similarity signals produce
   understandable and useful matches using synthetic/consented data only.
6. A separate child issue is created for repository creation, if approved.

No implementation begins until product, architecture, data, and safety boundaries are
reviewed (issue #3560 §Acceptance criteria).
