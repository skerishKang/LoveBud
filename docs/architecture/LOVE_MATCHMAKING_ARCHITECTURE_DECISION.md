# Love Matchmaking — Architecture Decision (Phase 0)

**ADR ID:** LOVE_MATCHMAKING_ARCHITECTURE_DECISION
**Parent issue:** #3560 — Keep OPEN
**Child issue:** #3718
**Refs:** #3425 — Keep OPEN · #1882 — Keep OPEN
**Status:** PROPOSED
**Phase:** Phase 0 — boundary decision only. No runtime implementation authorized.
**Baseline:** `origin/main` `235ec59b2a5a40e0cf0115ebe45b2c6e50abbcdc`

---

## 1. Context

LoveBud is a Cloudflare Pages frontend with same-origin `/api/*` entry, Cloudflare
Pages Functions, Modal compute, and Neon PostgreSQL. Its identity is Firebase Auth
(Firebase UID), its data model is `trees` and `memories` with `owner_id`, `visibility`,
`emotion_tags`, `source_type`, etc., and its social surface is limited to tree-level
and moment-level comments/reactions — there is no social graph, no connection state,
no blocking/reporting, and no messaging
(`docs/engineering/API_CONTRACT.md:9-17`; `docs/backend/backend.md:16-24`;
`modal_compute/app.py`; `modal_compute/owner_reads.py:116-131`;
`modal_compute/tree_comments.py`; `modal_compute/comments.py`).

Love Matchmaking introduces a fundamentally different user intent — relationship
discovery through recorded emotional/narrative resonance — and a set of responsibilities
that do not exist in LoveBud: bilateral consent, explainable similarity, connection
requests, blocking/reporting, age/minor safety, harassment/spam prevention, messaging
permissions, and relationship-intent selection (issue #3560 §Why this may deserve a
separate product boundary; issue #3560 §Open product questions).

This ADR evaluates four options and recommends a target boundary. It does **not**
create a repository (issue #3718 §Hard boundaries).

---

## 2. Options

### Option A — Separate repository and application

- Strongest product and security boundary.
- Independent design system and deployment.
- Explicit LoveBud data/API integration.
- Higher operational overhead.

### Option B — Isolated top-level product package in the LoveBud repository

- Shared infrastructure and contracts.
- Easier early experimentation.
- Risk of coupling matching responsibilities into the LoveBud application.

### Option C — Separate frontend with explicit shared backend services

- Independent experience with selected shared identity/data services.
- Requires strict API, authorization, consent, and versioning boundaries.

### Option D — Deferred because prerequisites are not ready

- No boundary decision; wait until LoveBud foundations (consent controls, similarity
  discovery, offline prototype) are complete.

---

## 3. Evaluation criteria

| Criterion | Weight | Rationale |
|---|---|---|
| Product intent separation | High | Matching intent ("who resonates?") differs materially from recording intent ("what did I feel?") |
| Safety/security boundary | High | Matching adds bilateral consent, blocking/reporting, minor/adult separation, harassment prevention |
| Consent isolation | High | Matching opt-in must be separate from public visibility; fail-closed |
| Data ownership/deletion | High | Derived resonance profiles and connection state must have independent lifecycle |
| Deployment independence | Medium | Independent rollback, release cadence, and design identity |
| Operational overhead | Medium | New repo/service has cost; must be justified by boundary value |
| Coupling risk | High | Shared code risks pulling matching logic into LoveBud's recording surface |

---

## 4. Comparison

| Criterion | A: Separate repo | B: Isolated package | C: Shared backend | D: Deferred |
|---|---|---|---|---|
| Product intent separation | Strong | Weak (same repo) | Medium (shared backend) | N/A |
| Safety/security boundary | Strong | Weak | Medium | N/A |
| Consent isolation | Strong | Weak (shared auth state) | Medium (shared identity) | N/A |
| Data ownership/deletion | Strong | Weak (shared DB risk) | Medium (shared services) | N/A |
| Deployment independence | Strong | Weak | Medium | N/A |
| Operational overhead | High | Low | Medium | None |
| Coupling risk | Low | High | Medium | N/A |
| Prerequisite readiness | Requires Phase 1+ | Requires Phase 1+ | Requires Phase 1+ | Blocks decision |

---

## 5. Decision

**Recommended option: A — Separate repository and application.**

### 5.1 Rationale

1. **Product intent is materially different.** LoveBud answers "What did I love,
   remember, and feel?" Love Matchmaking answers "Who has lived through a meaningfully
   similar emotional and narrative pattern?" This is not another social feature; it is
   a separate relationship-discovery product (issue #3560 §Why this may deserve a
   separate product boundary; `docs/product/PRODUCT_IDENTITY.md:1-5`).

2. **Matching responsibilities do not exist in LoveBud.** There is no social graph,
   no connection state, no blocking/reporting, no messaging, no age/minor safety
   policy, and no harassment/spam prevention in the current codebase
   (`modal_compute/app.py` exposes only `tree_comments`, `comments`, `tree_likes`,
   `tree_views`; `modal_compute/owner_reads.py:116-131` queries `trees` by `owner_id`
   only; `docs/product/TREE_MOMENT_SOCIAL_MODEL.md:1-9` defines tree/moment comments
   as the social scope, not a connection graph).

3. **Consent isolation is critical.** Public visibility must not equal consent to
   person matching. Matching opt-in must be a separate, fail-closed control
   (issue #3560 §Consent and privacy principles; `docs/engineering/API_CONTRACT.md:192-210`
   public visibility ≠ browse eligibility). A separate repository makes this boundary
   structurally enforceable.

4. **Safety boundary.** Matching introduces bilateral consent, explainable similarity,
   connection requests, blocking/reporting, and minor/adult separation. These should
   not be forced into the current LoveTree UI
   (issue #3560 §Why this may deserve a separate product boundary).

5. **Independent design identity.** The product may reuse LoveBud concepts and data
   contracts while using a completely new design system (issue #3560 §Why this may
   deserve a separate product boundary). A separate repository supports this.

6. **Coupling risk.** Option B risks coupling matching responsibilities into the
   LoveBud application, which the product strategy explicitly wants to avoid
   (issue #3560 §Why this may deserve a separate product boundary; issue #3425 §Module
   and domain boundaries).

### 5.2 Why not B

Option B (isolated top-level package in the same repo) shares infrastructure and
contracts, which lowers operational overhead. However, it risks coupling matching
responsibilities into the LoveBud application. Given that LoveBud's current social
scope is tree/moment comments only and has no connection graph, introducing matching
logic into the same repository would create a domain-boundary violation
(`docs/product/TREE_MOMENT_SOCIAL_MODEL.md:1-9`; issue #3425 §Module and domain
boundaries).

### 5.3 Why not C

Option C (separate frontend with shared backend services) offers an independent
experience with selected shared identity/data services. However, it requires strict
API, authorization, consent, and versioning boundaries that are harder to enforce
when identity and data services are shared. The matching product's consent and safety
requirements are distinct enough to warrant a fully separate boundary.

### 5.4 Why not D

Option D (deferred) avoids the decision entirely. However, Phase 0's explicit purpose
is to decide the boundary so that Phase 1–2 work can proceed with a clear target.
Deferring would leave Phase 1 (LoveBud foundations) without a boundary to build
toward. The prerequisites for **repository creation** are not ready, but the
**boundary decision** can and should be made now.

### 5.5 Status: PROPOSED

**Recommended target:** Option A (separate repository and application).
**ADR status:** PROPOSED.

This decision recommends Option A as the target architecture but does **not** create
a repository. The following are **UNAPPROVED** and deferred until Phase 1+
prerequisites are validated:

- Repository creation
- Auth provider
- Firebase project reuse
- Deployment target
- API transport
- Event/webhook/poll mechanism

The decision may transition to `ACCEPTED_FOR_NEXT_CHILD` once Phase 1 prerequisites
are validated and a repository-creation child issue is approved.

---

## 6. Repository/application boundary

- **LoveBud repository** (`skerishKang/LoveBud`): remains the recording product.
  Contains `js/`, `functions/`, `pages/`, `css/`, `modal_compute/`, `db/`,
  `docs/`. No matching logic, no connection state, no messaging.
- **Love Matchmaking repository** (to be created in a later phase): a separate
  repository with its own design system, deployment, identity/relationship-intent
  profile, connection state, moderation, and messaging systems. It consumes LoveBud
  data only through explicit, consent-aware API contracts.

The boundary is one-way: Matchmaking reads consented LoveBud signals via API; it
never writes back to LoveBud's recording data model.

---

## 7. Identity/account relationship

- **OBSERVED_CURRENT_FACT:** LoveBud identity is Firebase Auth (Firebase UID)
  (`js/auth/auth-firebase.js`; `docs/engineering/API_CONTRACT.md:237` canonical
  entitlement field `users/{uid}.privateStorageEnabled`).
- **UNRESOLVED:** The exact mechanism for binding a LoveBud account to a Matchmaking
  account is not decided. A stable account-link/external-subject contract is required,
  but the exact identity mechanism (same Firebase UID, separate auth, external-subject
  mapping) is unresolved.
- **UNRESOLVED:** Whether Matchmaking reuses LoveBud's Firebase project or creates a
  separate auth provider/project is unresolved.
- Matchmaking maintains its own **relationship-intent profile**, discovery preferences,
  connection state, and messaging state — independent of LoveBud's Plus/private-storage
  entitlement.
- Identity is never shared by assumption; it is shared only through an explicit,
  consent-aware account-linking contract (**PROPOSED_FUTURE_CONTRACT**).

---

## 8. API and version boundaries

- **PROPOSED_FUTURE_CONTRACT:** A consent-aware signal API is proposed for exporting
  only explicitly opted-in LoveBud signals to Matchmaking. The exact endpoint and
  version are **UNRESOLVED**.
- The proposed API must be:
  - **Authenticated** — no anonymous access.
  - **Audience-bound** — scoped to the requesting Matchmaking audience, not a public
    community endpoint.
  - **Least-privilege** — returns only the minimum derived features needed, never raw
    private text (see §11).
  - **Non-enumerable** — does not allow enumeration of users or signals.
  - **Versioned** — Matchmaking pins to a specific version.
  - **Consent-scoped** — returns only signals the owner has explicitly opted into for
    matching.
- **Important:** `public visibility` ≠ `matching consent`. Having matching consent
  does **not** make signals public community API data. The signal API is audience-bound
  and authenticated, never a public community endpoint.
- LoveBud's active API contract is Cloudflare Pages Functions → Modal
  (`docs/engineering/API_CONTRACT.md:9-17`; `docs/backend/backend.md:16-24`).
  `netlify/functions/*` is a legacy artifact only
  (`docs/engineering/API_CONTRACT.md:28`; `docs/backend/backend.md:26`). New signal
  APIs must be implemented in the active Cloudflare/Modal path, not in `netlify/functions/*`.

---

## 9. Data ownership and deletion

- **OBSERVED_CURRENT_FACT:** LoveBud data (trees, memories, comments, reactions) is
  owned and controlled by the LoveBud user. LoveBud's deletion semantics are
  owner-boundary-guarded (`modal_compute/owner_writes.py:145-166` `delete_owner_tree`
  with `DELETE FROM trees WHERE id = %s AND owner_id = %s`;
  `modal_compute/comments.py` `soft_delete_own_comment`).
- **PROPOSED_FUTURE_CONTRACT:** Derived resonance profiles and connection state are
  owned by the Matchmaking system. They are derived from consented LoveBud signals,
  not raw data dumps.
- **UNRESOLVED:** The exact deletion-propagation mechanism (webhook, polling, or other)
  is not decided. **NOT_AUTHORIZED** to implement any deletion-propagation mechanism
  in this Phase 0.
- **PROPOSED_FUTURE_CONTRACT:** When a LoveBud user deletes a tree, memory, or moment,
  the corresponding consent is revoked and the derived signal is invalidated in
  Matchmaking (removal from discovery, invalidation of derived profile, termination
  of active matching use, cleanup of pending requests). The exact propagation
  mechanism is a future child issue.
- **PROPOSED_FUTURE_CONTRACT:** Account deletion revokes all matching consent and
  triggers invalidation of derived resonance profiles and connection state in
  Matchmaking. Abuse reports, blocks, moderation records, and legal/safety audit
  records are governed by a separate retention/pseudonymization policy child — they
  are **not** unconditionally deleted.
- Direct shared-database coupling is not assumed. Matchmaking does not read LoveBud's
  `trees`/`memories` tables directly (issue #3560 §Architecture questions;
  `docs/backend/backend.md:16-24` active runtime is Cloudflare/Modal/Neon, not a
  shared DB for Matchmaking).

---

## 10. Consent propagation and revocation

- **PROPOSED_FUTURE_CONTRACT:** Consent flows from LoveBud (user opts into matching
  for specific fields/trees/moments/signals) to Matchmaking (via the proposed
  consent-aware signal API). The API returns only opted-in signals.
- **PROPOSED_FUTURE_CONTRACT:** A user may revoke matching consent at any time from
  either LoveBud or Matchmaking. Revocation is immediate and fail-closed:
  - The signal is removed from the API response.
  - The derived resonance profile is invalidated.
  - Active matching use of the signal terminates.
  - Pending connection requests involving the revoked signal are canceled.
  - The other party is **not** notified of the specific revocation, the revoked
    signal, the raw content, or any sensitive information. Only a generic state
    change (e.g., "connection no longer available") is visible, if at all.
- **UNRESOLVED:** The exact propagation mechanism (webhook, polling, or other) is not
  decided. **NOT_AUTHORIZED** to implement any propagation mechanism in this Phase 0.

---

## 11. Derived resonance-profile storage

- **PROPOSED_FUTURE_CONTRACT:** The resonance profile is a derived, consent-scoped
  summary stored in the Matchmaking system, not in LoveBud's database.
- It contains: content-overlap signals, moment-overlap signals, emotional-interpretation
  similarity, narrative-trajectory similarity, attention-pattern similarity, temporal
  pattern, and multilingual semantic similarity (issue #3560 §Core matching principle;
  issue #3718 §Document 3).
- **Private-data minimization:** Raw private text must **not** leave LoveBud. The
  recommended approach is **LoveBud-side/local derivation** — LoveBud derives
  consent-scoped minimized features and exports only those derived features, never
  raw `Memory.memo` text. Per-field consent alone does **not** authorize transmitting
  raw private text to Matchmaking.
- The profile is recomputed when consent changes or source data is updated.
- Users can correct or remove an inaccurate derived profile (issue #3560 §Open
  product questions #4).

---

## 12. Public/private signal handling

- **Private LoveTrees and private moments are excluded by default** (issue #3560
  §Consent and privacy principles; `docs/engineering/API_CONTRACT.md:192-210`).
- **Public visibility does not automatically equal consent to person matching**
  (issue #3560 §Consent and privacy principles).
- **Matching participation requires separate explicit consent** (issue #3560
  §Consent and privacy principles).
- Memory visibility omitted → inherits parent tree visibility
  (`docs/product/PRODUCT_IDENTITY.md:37`). If the parent tree is private, the memory
  is private and excluded from matching.
- Private trees do not expose social data to anonymous users
  (`docs/product/TREE_MOMENT_SOCIAL_MODEL.md:66-68`).

---

## 13. Moderation and messaging isolation

- **Moderation** (blocking, reporting, spam/harassment prevention, appeal boundaries)
  is a Matchmaking responsibility, isolated from LoveBud's tree/moment comment
  moderation (`docs/product/TREE_MOMENT_SOCIAL_MODEL.md:134-149`).
- **Messaging** is a Matchmaking responsibility, available only after bilateral
  connection state and safety gates are operational (issue #3560 §Messaging;
  issue #3718 §Required child plan #8).
- LoveBud's comment moderation (tree owner hides/deletes comments, author deletes own
  comments) does not extend to person-to-person interactions.
- Matchmaking moderation and messaging systems must not be implemented in LoveBud's
  codebase.

---

## 14. Deployment ownership

- **LoveBud** deploys on Cloudflare Pages (frontend) + Modal (compute) + Neon
  (PostgreSQL) (`docs/engineering/API_CONTRACT.md:9-17`; `docs/backend/backend.md:16-24`).
  Production URL: `https://lovebud.pages.dev/` (`AGENTS.md:6`).
- **Love Matchmaking** deploys on its own infrastructure (to be determined in a later
  phase), with its own domain, CI/CD, and rollback procedures.
- Deployments are independent. A Matchmaking deployment failure does not affect
  LoveBud's recording experience, and vice versa.
- Rollback: each product has independent rollback. Matchmaking can roll back its
  matching algorithm, resonance profile, or connection state without touching LoveBud.

---

## 15. Rollback and product separation

- **Product separation:** LoveBud remains the recording product. Matchmaking is a
  separate product with its own design identity. They are not merged by assumption
  (issue #3718 §Important boundary).
- **Rollback:** Matchmaking can roll back its matching algorithm, resonance profile
  construction, or connection-request state independently. LoveBud's recording data
  is never modified by Matchmaking.
- **Data rollback:** if a Matchmaking matching algorithm is rolled back, the derived
  resonance profiles are recomputed from the same consented signals. No LoveBud data
  is affected.

---

## 16. Direct shared-database decision

**Direct shared-database coupling is NOT allowed as the default.**

Rationale:
- LoveBud's active runtime is Cloudflare Pages Functions → Modal → Neon
  (`docs/engineering/API_CONTRACT.md:9-17`; `docs/backend/backend.md:16-24`).
- A shared database would couple Matchmaking's connection/messaging/moderation state
  to LoveBud's recording schema, violating the product boundary.
- It would make consent isolation structurally difficult (Matchmaking queries would
  risk accessing non-consented data).
- It would couple rollback and deployment lifecycles.
- LoveBud's schema is `trees` and `memories` with `owner_id`, `visibility`,
  `emotion_tags`, `source_type`, etc. (`modal_compute/owner_reads.py:116-131`;
  `modal_compute/tree_writes.py:51-63`). Matchmaking needs connection state,
  messaging state, moderation state, and relationship-intent profiles — none of
  which belong in LoveBud's schema.

Instead, Matchmaking communicates with LoveBud through a **consent-aware signal API**
that returns only explicitly opted-in signals.

---

## 17. New-repository prerequisites

Before a new Matchmaking repository is created, the following must be proven:

1. **Phase 1 LoveBud foundations complete:** matching-consent controls, moment/tree
   similarity discovery, and user-facing self-analysis/explainability
   (issue #3560 §Phase 1; issue #3718 §Required child plan #1, #2).
2. **Phase 2 offline resonance prototype:** synthetic/consented test data only;
   similarity signals produce understandable and useful matches
   (issue #3560 §Phase 2; issue #3718 §Required child plan #3).
3. **Explainability evaluation:** match explanations do not expose private text and
   are understandable to users (issue #3560 §Explainability requirement;
   issue #3718 §Required child plan #4).
4. **Consent and safety contract accepted:** the signals, consent, and safety contract
   is reviewed and accepted (issue #3718 §Document 3).
5. **Repository-creation child issue approved:** a separate child issue for repository
   creation is created and approved by Web CTO (issue #3718 §Required child plan #5).
6. **Identity/account-linking contract defined:** a stable account-link/external-subject
   contract is defined. Whether Matchmaking reuses LoveBud's Firebase project or creates
   a separate auth provider is resolved (issue #3560 §Architecture questions).
7. **Data-deletion propagation mechanism defined:** the mechanism by which LoveBud
   deletions propagate to Matchmaking is defined (**UNRESOLVED** — webhook, polling,
   or other; **NOT_AUTHORIZED** for implementation in this Phase 0)
   (issue #3560 §Consent and privacy principles).
8. **Minor/adult separation policy defined:** age verification and minor-safety
   boundaries for open connection/messaging (issue #3560 §Consent and privacy
   principles; issue #3718 §minor/adult prerequisite).

This ADR recommends Option A but does **not** create a repository. Repository creation
is deferred until all prerequisites are met.

---

## 18. Base44 Resonance — external comparison

This strategy is distinct from the separate Base44 Resonance project. There is **no
in-repository evidence** of a Base44 Resonance project in `skerishKang/LoveBud`
(no files, docs, or code reference Base44 or Resonance; verified via repository
search). Similarities (resonance-based matching, emotional journey signals) are noted
only as an **unresolved external-product comparison**. The projects are **not merged
by assumption**. If repository evidence of a Base44 Resonance project emerges, it must
be evaluated separately against this contract.

---

## 19. Unresolved decisions

The following remain **UNRESOLVED** and are **NOT_AUTHORIZED** for implementation in
this Phase 0:

1. Exact identity/account-linking mechanism (same Firebase UID, separate auth, or
   external-subject mapping).
2. Exact consent-aware signal API endpoint and version.
3. Exact data-deletion propagation mechanism (webhook, polling, or other).
4. Exact minor/adult separation and age-verification mechanism.
5. Exact Matchmaking deployment target and infrastructure.
6. Whether the Matchmaking repository should be under `skerishKang/` or a separate
   organization.
7. Whether Matchmaking should reuse LoveBud's Firebase project or create a new one.
8. Exact API transport (Cloudflare/Modal path, not `netlify/functions/*`).
9. Exact event/webhook/poll mechanism for consent/deletion propagation.

The following are **UNAPPROVED** — repository creation and all runtime/auth/deployment
decisions are deferred until Phase 1+ prerequisites are validated:

- Repository creation
- Auth provider
- Firebase project reuse
- Deployment target
- API transport
- Event/webhook/poll mechanism

These are recorded for Phase 1–3 resolution.

---

## 20. Ordered child gates (before real LoveBud data)

Before any real LoveBud data is used for matching, the following gates must be
passed in order. The synthetic/offline prototype uses **synthetic data only** until
all gates are passed.

1. **Authenticated audience contract** — define the audience-bound, authenticated,
   least-privilege signal API (PROPOSED_FUTURE_CONTRACT).
2. **Data minimization** — define LoveBud-side/local derivation and consent-scoped
   minimized feature export; raw private text never leaves LoveBud.
3. **Revocation/deletion semantics** — define removal from discovery, derived-profile
   invalidation, active-matching termination, and pending-request cleanup.
4. **Threat model** — define threat model for consent, signal, and connection state.
5. **Sensitive-trait exclusion** — define the prohibited sensitive-trait inference
   list and enforcement.
6. **Adult-only gate** — define the 18+ adults-only boundary and minor prohibition.

Only after all six gates are passed may the synthetic/offline prototype transition to
using real LoveBud data (issue #3718 §Required child plan #3).

These gates are **NOT_AUTHORIZED** for implementation in this Phase 0.
