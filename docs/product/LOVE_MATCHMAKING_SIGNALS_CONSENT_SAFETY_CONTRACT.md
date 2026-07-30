# Love Matchmaking — Signals, Consent, and Safety Contract (Phase 0)

**Parent issue:** #3560 — Keep OPEN
**Child issue:** #3718
**Refs:** #3425 — Keep OPEN · #1882 — Keep OPEN
**Status:** PROPOSED
**Phase:** Phase 0 — contract only. No runtime implementation authorized.
**Baseline:** `origin/main` `235ec59b2a5a40e0cf0115ebe45b2c6e50abbcdc`

---

## 1. Scope

This contract defines the signal taxonomy, consent model, and safety boundaries for
Love Matchmaking. It is the authoritative reference for all Phase 1–5 implementation
children. No implementation is authorized by this document.

---

## 2. Signal taxonomy

Love Matchmaking uses seven signal categories, derived from consented LoveBud
records (`docs/product/PRODUCT_IDENTITY.md:9`; `docs/engineering/API_CONTRACT.md:94-110`
Memory interface; `modal_compute/owner_reads.py:116-131` trees query).

### 2.1 Content signals

- **Definition:** same source, artist, topic, event, era, or work.
- **Source:** `Memory.source`, `Memory.sourceUrl`, `Memory.sourceType`,
  `Memory.artist` (`docs/engineering/API_CONTRACT.md:94-110`;
  `modal_compute/owner_reads.py:268`).
- **Example:** "You and this person both recorded four moments from the same era."

### 2.2 Moment signals

- **Definition:** same or semantically equivalent scene, quote, event, or turning
  point.
- **Source:** `Memory.timestamp` (the specific point in the source), `Memory.title`,
  `Memory.memo` (only if consented).
- **Example:** "You both selected the same scene at 1:23 in the performance."

### 2.3 Emotional interpretation

- **Definition:** similar emotions, meanings, motivations, and personal reactions.
- **Source:** `Memory.emotionTags` (`docs/engineering/API_CONTRACT.md:105`;
  `modal_compute/owner_reads.py:268`).
- **Example:** "Your emotional flow is similar: waiting → excitement → pride."

### 2.4 Narrative trajectory

- **Definition:** similar sequences such as discovery → immersion → waiting →
  disappointment → return → pride.
- **Source:** the ordered sequence of moments and emotion tags across a tree
  (`docs/product/PRODUCT_IDENTITY.md:86-87` tree as emotional path;
  `modal_compute/owner_reads.py:116-131` trees query).
- **Example:** "Your LoveTree stages follow a similar path."

### 2.5 Attention pattern

- **Definition:** preference for interviews, performances, behind-the-scenes material,
  growth stories, humor, comfort, or other recurring forms.
- **Source:** `Memory.sourceType`, `Memory.source` (content form analysis),
  `Memory.emotionTags`.
- **Example:** "Both of you respond more strongly to interviews and growth stories
  than to performance clips."

### 2.6 Temporal pattern

- **Definition:** how attachment and emotion change over time.
- **Source:** `Memory.createdAt`, `Memory.timestamp`, `Memory.updatedAt`
  (`docs/engineering/API_CONTRACT.md:108-109`).
- **Example:** "Your attachment peaked at the same point in the release timeline."

### 2.7 Multilingual similarity

- **Definition:** records written in different languages but expressing similar meaning.
- **Source:** `Memory.memo`, `Memory.emotionTags` (cross-language semantic analysis).
- **Example:** "Six moments express similar meaning across different languages."

---

## 3. Distinction between signal types

The system must distinguish:

| Comparison | Meaning | Signal category |
|---|---|---|
| Same content | Both liked the same source/artist/work | Content (§2.1) |
| Same moment | Both selected the same scene/quote/turning point | Moment (§2.2) |
| Similar interpretation | Both reacted with similar emotions/meanings | Emotional interpretation (§2.3) |
| Similar long-term path | Both followed a similar emotional/narrative trajectory | Narrative trajectory (§2.4) |

A match may combine multiple signal types. Each signal in a match explanation must be
labeled with its category so the user understands the basis of the suggestion
(issue #3560 §Explainability requirement).

---

## 4. Explainability obligations

- A match score alone is insufficient. Users must be able to understand why a
  connection was suggested (issue #3560 §Explainability requirement).
- Match explanations use the signal categories (§2) and must include:
  - Which content/moments overlapped.
  - Which emotions/interpretations were similar.
  - Which narrative trajectory was similar.
  - Which attention patterns were similar.
  - Which cross-language similarities were found.
- **Raw private text must not be exposed** to explain a match. Explanations use
  signal summaries, not raw `Memory.memo` content (issue #3560 §Consent and privacy
  principles).
- **Prohibited claims:** destiny, psychological diagnosis, personality certainty, or
  objective compatibility (issue #3560 §Explainability requirement; issue #3718
  §Hard boundaries).
- Explanations must be auditable: the system must record which signals contributed
  to a match and why, for user correction and safety review (issue #3560 §Open
  product questions #4).

---

## 5. Matching opt-in

- Matching participation requires **separate explicit consent**, distinct from public
  visibility (issue #3560 §Consent and privacy principles).
- Public visibility does not automatically equal consent to person matching
  (issue #3560 §Consent and privacy principles; `docs/engineering/API_CONTRACT.md:192-210`
  public visibility ≠ browse eligibility).
- Consent is **fail-closed**: if consent is absent, the signal is not used for
  matching (issue #3560 §Consent and privacy principles; issue #3718 §Hard boundaries).
- Consent is **revocable** at any time (§10).
- The consent UI must clearly separate:
  - "Who can see my LoveTree?" (visibility)
  - "Who can discover me through emotional resonance?" (matching consent)

---

## 6. Field/tree/moment/signal-level inclusion controls

Users control which data may be used for matching:

- **Field-level:** which fields (source, moment, emotion, trajectory, attention,
  temporal, multilingual) may be used.
- **Tree-level:** which trees may contribute signals.
- **Moment-level:** which moments may contribute signals.
- **Signal-level:** which signal categories may be used for matching.
- Controls are granular: a user may opt into content and moment signals but exclude
  emotional-interpretation signals, or exclude a specific tree.
- Private trees and private moments are excluded by default (issue #3560 §Consent and
  privacy principles; `docs/engineering/API_CONTRACT.md:192-210`).
- Memory visibility omitted → inherits parent tree visibility
  (`docs/product/PRODUCT_IDENTITY.md:37`). If the parent tree is private, the memory
  is private and excluded from matching.

---

## 7. Revocation, deletion, pause, hide, block, and report

| Action | Behavior |
|---|---|
| **Revocation** | User revokes matching consent for a field/tree/moment/signal. The signal is immediately removed from the API and the derived resonance profile is invalidated. Existing matches depending on the revoked signal are re-evaluated. Pending connection requests involving the revoked signal are canceled. |
| **Deletion** | User deletes a tree, memory, or moment. The corresponding consent is revoked and the derived signal is invalidated in Matchmaking. Deletion propagates via webhook or poll (§9). |
| **Pause** | User pauses discovery. They stop receiving match suggestions and stop appearing as a match candidate. Existing connections and messages are preserved. |
| **Hide** | User hides a specific match suggestion. The suggestion is suppressed for the hiding user. The hidden user is not notified. |
| **Block** | User blocks another user. The blocked user cannot see the blocker's profile, send messages, or appear in match suggestions. Blocking is unilateral and reversible. |
| **Report** | User reports another user or content. The report is queued for moderation review. The reported user's match suggestions involving the reporting user are suspended pending review. |

All actions are logged with safe status labels only (no raw payloads, user IDs in
logs, or private data) (`docs/product/TREE_MOMENT_SOCIAL_MODEL.md:172`;
`docs/ops/AGENT_SECURITY.md`).

---

## 8. Private-data fail-closed rules

- **Private LoveTrees and private moments are excluded by default** (issue #3560
  §Consent and privacy principles).
- **Public visibility does not automatically equal consent to person matching**
  (issue #3560 §Consent and privacy principles).
- **Matching participation requires separate explicit consent** (issue #3560
  §Consent and privacy principles).
- **Raw private text must not be exposed** to another user merely to explain a match
  (issue #3560 §Consent and privacy principles).
- If any consent check fails, the signal is not used. The system fails closed.
- The signal API returns only explicitly opted-in signals. No fallback to public
  data without consent.
- Client-side hiding is not sufficient. All consent checks are enforced at the
  server/runtime boundary (`docs/product/TREE_MOMENT_SOCIAL_MODEL.md:70`;
  `docs/engineering/API_CONTRACT.md:440-456`).

---

## 9. Prohibited sensitive-trait inference

- The system must **not** generate or use inferred sensitive traits (e.g., political
  opinion, religious belief, sexual orientation, mental health, disability, etc.) as
  matching labels without an explicitly reviewed policy (issue #3560 §Consent and
  privacy principles; issue #3718 §Hard boundaries).
- Emotion tags and interpretations are user-provided, not inferred. The system may
  not infer sensitive traits from emotion tags, source content, or temporal patterns.
- Any future sensitive-trait policy must undergo explicit review and approval before
  implementation.
- Age, gender, nationality, and location are optional user-controlled constraints,
  not the primary matching basis (issue #3560 §Consent and privacy principles).
- Demographic-first ranking is prohibited (issue #3560 §Non-goals; issue #3718
  §Hard boundaries).

---

## 10. Minor/adult separation prerequisites

- **Minor/adult separation and safety rules must be defined before any open connection
  or messaging flow** (issue #3560 §Consent and privacy principles; issue #3718
  §minor/adult prerequisite).
- Minors and adults must not be matched with each other by default.
- Age verification must be defined before any matching is enabled for users who may
  be minors.
- Parental/guardian consent mechanisms for minors must be defined before minors
  participate in matching.
- These are prerequisites, not implementation tasks. No matching involving minors is
  authorized until the policy is defined and approved.

---

## 11. Spam/harassment and moderation boundaries

- **Spam/harassment prevention** is a Matchmaking responsibility (issue #3560
  §Safety and governance model).
- **Moderation boundaries:**
  - Tree owners may moderate tree/moment comments in LoveBud
    (`docs/product/TREE_MOMENT_SOCIAL_MODEL.md:134-149`).
  - Matchmaking moderation (blocking, reporting, abuse handling) is separate from
    LoveBud comment moderation.
  - A first implementation must not add public write comments without a moderation
    baseline (`docs/product/TREE_MOMENT_SOCIAL_MODEL.md:136`).
- **Rate limiting:** Matchmaking must implement rate limits for connection requests,
  messages, and reports. LoveBud's existing rate limiting is for tree/moment comments
  only (`modal_compute/social_rate_limit.py`).
- **Appeal boundaries:** users can appeal moderation decisions. The appeal process
  is defined in a later phase.
- **Audit trail:** deleted/moderated content retains a safe audit trail (status labels
  only, no raw payloads) (`docs/product/TREE_MOMENT_SOCIAL_MODEL.md:147`;
  `docs/ops/AGENT_SECURITY.md`).

---

## 12. Bilateral connection state before messaging

- **Messaging is unavailable until the required bilateral connection state is reached**
  (issue #3560 §Consent and privacy principles; issue #3560 §Messaging).
- The connection flow:
  1. User A receives a match suggestion.
  2. User A sends a resonance or connection request to User B.
  3. User B accepts or rejects.
  4. If accepted, bilateral connection state is established.
  5. Only after bilateral connection state is messaging enabled.
- Unilateral requests do not enable messaging. Both parties must consent.
- Users can withdraw consent from a connection at any time, which disables messaging.

---

## 13. Limited profile disclosure boundary

- **Before mutual acceptance:**
  - Only a limited, bounded profile preview is shown.
  - No raw private text.
  - No full emotional trajectory.
  - No contact information.
  - Only shared themes, similar flow, and bounded signal summaries.
- **After mutual acceptance:**
  - Additional profile fields may be disclosed, as defined by the user's disclosure
  preferences.
  - The user controls which fields are visible after acceptance.
  - Messaging becomes available.
- The disclosure boundary is user-controlled and granular (issue #3560 §Open product
  questions #9).

---

## 14. Synthetic/offline validation requirements

- **Phase 2 offline resonance prototype** uses synthetic or explicitly consented test
  data only (issue #3560 §Phase 2; issue #3718 §Required child plan #3).
- **No production data** is used for validation (issue #3560 §Non-goals; issue #3718
  §Hard boundaries).
- The prototype evaluates whether similarity signals produce understandable and useful
  matches.
- The prototype must not connect real users or send real messages.
- Validation evidence is recorded and reviewed before Phase 3 (separate product
  prototype).

---

## 15. Minimum data and cold-start rules

- A user must have a **minimum amount of consented public record history** before
  matching becomes meaningful (issue #3560 §Open product questions #5).
- The exact minimum is a Phase 1 child issue (issue #3718 §Required child plan #1).
- New users without enough records are not shown as match candidates and do not
  receive match suggestions until they meet the minimum threshold.
- Cold-start behavior is validated through synthetic/offline prototypes (§14).
- The minimum data threshold is fail-closed: if a user does not meet it, no matching
  occurs.

---

## 16. Readiness gates

### 16.1 Connection-request readiness gate

Before connection requests are enabled:

1. Matching-consent controls are implemented and accepted (issue #3718 §Required
   child plan #2).
2. The offline resonance prototype validates signal usefulness (issue #3718 §Required
   child plan #3).
3. Explainability evaluation is complete (issue #3718 §Required child plan #4).
4. The connection-request state model is defined and implemented (issue #3718 §Required
   child plan #6).
5. Limited profile disclosure boundary is defined (§13).

### 16.2 Messaging readiness gate

Before messaging is enabled:

1. Connection-request state is operational (§16.1).
2. Moderation/block/report readiness is complete (issue #3718 §Required child plan #7).
3. Minor/adult separation policy is defined and enforced (§10).
4. Bilateral connection state is the only path to messaging (§12).
5. Spam/harassment prevention is operational (§11).
6. Messaging is sequenced after all safety, consent, moderation, and connection-state
   contracts are operational (issue #3560 §Phase 5; issue #3718 §Required child plan #8).

---

## 17. Ordered child plan

The following eight child issues are ordered by dependency. Each has a narrow scope,
owner, evidence type, and stop condition.

### Child 1 — LoveBud interoperability/data-export contract

- **Scope:** Define the consent-aware signal API that exports only explicitly
  opted-in LoveBud signals (content, moment, emotion, trajectory, attention, temporal,
  multilingual). Define the API endpoint, version, response shape, and consent
  filtering logic.
- **Dependency:** None (foundational).
- **Evidence:** API contract document; static contract tests; Phase 1 LoveBud
  foundations (consent controls).
- **Owner:** Web Developer (LoveBud).
- **Stop condition:** The consent-aware signal API contract is accepted and a static
  contract test verifies that non-consented signals are excluded.
- **Refs:** issue #3560 §LoveBud boundary map; issue #3718 §Required child plan #1.

### Child 2 — Matching-consent controls

- **Scope:** Implement matching-consent controls in LoveBud: explicit opt-in to person
  matching, separate from public visibility. Field/tree/moment/signal-level inclusion
  controls. Fail-closed enforcement at the server boundary.
- **Dependency:** Child 1 (data-export contract).
- **Evidence:** Consent UI; server-side enforcement tests; static contract tests
  verifying fail-closed behavior.
- **Owner:** Web Developer (LoveBud).
- **Stop condition:** A user can opt into/out of matching for specific fields/trees/
  moments/signals, and the signal API returns only opted-in signals.
- **Refs:** issue #3560 §Consent and privacy principles; issue #3718 §Required child
  plan #2.

### Child 3 — Synthetic/offline resonance prototype

- **Scope:** Build an offline prototype that constructs derived resonance profiles from
  synthetic or explicitly consented test data and evaluates whether similarity signals
  produce understandable and useful matches. No production data. No real-user
  connections or messages.
- **Dependency:** Child 2 (consent controls).
- **Evidence:** Prototype output; match explanation samples; validation report
  comparing signal categories to human-judged similarity.
- **Owner:** Web Developer (Matchmaking prototype).
- **Stop condition:** The prototype demonstrates that at least 3 of 7 signal categories
  produce understandable match explanations, validated against synthetic ground truth.
- **Refs:** issue #3560 §Phase 2; issue #3718 §Required child plan #3.

### Child 4 — Explainability evaluation

- **Scope:** Evaluate whether match explanations are understandable to users without
  exposing private text. Test explanation clarity, signal-category labeling, and
  user correction paths.
- **Dependency:** Child 3 (prototype).
- **Evidence:** User-facing explanation samples; usability evaluation; correction-path
  design.
- **Owner:** Web Developer (Matchmaking) + UX.
- **Stop condition:** Match explanations are understandable, labeled by signal
  category, do not expose raw private text, and users can correct/remove an
  inaccurate derived profile.
- **Refs:** issue #3560 §Explainability requirement; issue #3718 §Required child plan
  #4.

### Child 5 — Separate product shell if approved

- **Scope:** If the architecture decision (Option A) is accepted and repository
  creation is approved, create the separate Matchmaking repository, design system,
  and product shell. Wire the consent-aware signal API.
- **Dependency:** Children 1–4 (contract, consent, prototype, explainability).
- **Evidence:** Repository created; design system defined; signal API integrated;
  static contract tests passing.
- **Owner:** Web Developer (Matchmaking).
- **Stop condition:** The Matchmaking repository exists, the design system is defined,
  and the consent-aware signal API is integrated and tested.
- **Refs:** issue #3560 §Phase 3; issue #3718 §Required child plan #5.

### Child 6 — Connection-request state

- **Scope:** Implement the connection-request state model: send/accept/reject
  resonance or connection requests. Bilateral connection state. Limited profile
  disclosure before/after acceptance.
- **Dependency:** Child 5 (product shell) + Child 4 (explainability).
- **Evidence:** Connection-request state machine; API; tests for send/accept/reject;
  profile disclosure boundary tests.
- **Owner:** Web Developer (Matchmaking).
- **Stop condition:** A user can send a connection request, the recipient can accept/
  reject, bilateral state is established, and limited profile disclosure is enforced.
- **Refs:** issue #3560 §Product flow hypothesis; issue #3718 §Required child plan #6.

### Child 7 — Moderation/block/report readiness

- **Scope:** Implement blocking, reporting, spam/harassment prevention, and
  moderation boundaries for person-to-person interactions. Rate limiting for
  requests, messages, and reports. Audit trail with safe labels.
- **Dependency:** Child 6 (connection state).
- **Evidence:** Block/report API; rate-limit tests; moderation boundary tests;
  audit-trail samples with safe labels.
- **Owner:** Web Developer (Matchmaking).
- **Stop condition:** A user can block, report, and rate-limited actions are enforced;
  moderation boundaries are isolated from LoveBud comment moderation.
- **Refs:** issue #3560 §Safety and governance model; issue #3718 §Required child plan
  #7.

### Child 8 — Messaging after safety gates

- **Scope:** Implement messaging, available only after bilateral connection state and
  all safety gates (moderation, block/report, minor/adult separation, spam
  prevention) are operational.
- **Dependency:** Children 6 and 7 (connection state + moderation).
- **Evidence:** Messaging API; tests verifying messaging is blocked without bilateral
  state; tests verifying messaging is blocked before safety gates are operational.
- **Owner:** Web Developer (Matchmaking).
- **Stop condition:** Messaging is enabled only after bilateral connection state is
  established and all safety gates are operational; messaging is blocked otherwise.
- **Refs:** issue #3560 §Phase 5; issue #3718 §Required child plan #8.

---

## 18. Unresolved decisions

1. Exact minimum data threshold for matching (Child 1).
2. Exact consent-aware signal API endpoint and version (Child 1).
3. Exact identity/account-linking mechanism (Firebase UID binding vs. separate auth)
   (`LOVE_MATCHMAKING_ARCHITECTURE_DECISION.md:17`).
4. Exact data-deletion propagation mechanism (webhook vs. poll)
   (`LOVE_MATCHMAKING_ARCHITECTURE_DECISION.md:17`).
5. Exact minor/adult separation and age-verification mechanism (§10).
6. Exact Matchmaking deployment target and infrastructure
   (`LOVE_MATCHMAKING_ARCHITECTURE_DECISION.md:17`).
7. Whether Matchmaking should reuse LoveBud's Firebase project or create a new one
   (`LOVE_MATCHMAKING_ARCHITECTURE_DECISION.md:17`).
8. Whether the Matchmaking repository should be under `skerishKang/` or a separate
   organization (`LOVE_MATCHMAKING_ARCHITECTURE_DECISION.md:17`).
9. Exact relationship-intent options (friendship, fandom peer, creative partner, open
   connection) (issue #3560 §Open product questions #2).
10. Whether the system should show exact scores, bands, or only shared themes
    (issue #3560 §Open product questions #7).
11. How multilingual records preserve nuance while enabling comparison
    (issue #3560 §Open product questions #8).

These are recorded for Phase 1–3 resolution.
