# Love Matchmaking — Interoperability and Signal Export Contract (Phase 0 follow-up)

**Parent issue:** #3560 — Keep OPEN
**Child issue:** #3730
**Completed Phase 0:** #3718 / PR #3723
**Refs:** #3425 — Keep OPEN · #1882 — Keep OPEN
**Status:** PROPOSED
**Phase:** Source-only contract. No API, DB, schema, Auth, storage, queue, webhook, provider, or runtime implementation authorized.
**Baseline:** `origin/main` `292b7ac5029da41ce29f1e659f7817959f497281`

---

## 1. Current versus future authority

| Label | Meaning |
|---|---|
| **OBSERVED_CURRENT_FACT** | Verified against current `origin/main` repository state. |
| **PROPOSED_FUTURE_CONTRACT** | Proposed contract for the future Matchmaking product; not yet implemented. |
| **UNRESOLVED** | Decision not yet made; implementation NOT_AUTHORIZED until resolved. |
| **NOT_AUTHORIZED** | Explicitly prohibited in this Phase 0 follow-up. |

No non-existent API, queue, webhook, repository, identity link, or deletion-propagation mechanism is described as current.

---

## 2. Trust boundaries

### 2.1 Actors

| Actor | Description | Label |
|---|---|---|
| **LoveBud recording product** | The current LoveBud application: Cloudflare Pages frontend, Pages Functions, Modal compute, Neon PostgreSQL. Records trees, memories, moments, emotions, notes, tags. | OBSERVED_CURRENT_FACT |
| **Future Matchmaking product** | A separate product (repository TBD) that consumes consented, minimized derived signals to perform explainable similarity discovery and relationship matching. | PROPOSED_FUTURE_CONTRACT |
| **LoveBud account subject** | The user who owns LoveBud trees/memories. Authenticated via Firebase Auth (Firebase UID). | OBSERVED_CURRENT_FACT |
| **Matchmaking account subject** | The user in the future Matchmaking product. Identity link to LoveBud is UNRESOLVED. | UNRESOLVED |
| **Consent authority** | The LoveBud account subject, who grants/revokes matching-consent per field/tree/moment/signal. | PROPOSED_FUTURE_CONTRACT |
| **Export producer** | LoveBud, which produces minimized derived signals in response to authenticated, consent-scoped pull requests. | PROPOSED_FUTURE_CONTRACT |
| **Export consumer** | The future Matchmaking product, which consumes exported signals. | PROPOSED_FUTURE_CONTRACT |
| **Moderation/safety authority** | The future Matchmaking product's moderation system (blocking, reporting, abuse handling). Isolated from LoveBud's tree/moment comment moderation. | PROPOSED_FUTURE_CONTRACT |
| **Operator** | Infrastructure operator with access to logs/metrics. Must not access raw private content. | PROPOSED_FUTURE_CONTRACT |

### 2.2 Security requirements

| Requirement | Definition |
|---|---|
| **Authentication** | The export consumer must present a valid, audience-bound credential. No anonymous access. |
| **Authorization** | The export producer must verify that the requesting consumer is authorized for the specific subject's consent scope. |
| **Audience** | Exports are audience-bound to the requesting Matchmaking consumer, not a public community endpoint. |
| **Purpose limitation** | Exports are limited to matching/similarity-discovery purposes only. No other use permitted. |
| **Least privilege** | Exports return only the minimum derived features needed, never raw private text. |
| **Replay resistance** | Each export request includes a bounded validity window; cached/stale exports are rejected. |
| **Non-enumerability** | The export interface must not allow enumeration of subjects, trees, moments, or signals. |

---

## 3. Export model

### 3.1 Comparison

| Model | Pros | Cons | Disposition |
|---|---|---|---|
| Request/response export | Simple, synchronous | Requires live coupling | PROPOSED_FUTURE_CONTRACT (narrow use) |
| Signed one-time export package | Offline-capable, tamper-evident | Complex key management | UNRESOLVED |
| **Pull API** | Authenticated, audience-bound, least-privilege, versioned, non-enumerable | Requires live consumer | **RECOMMENDED** |
| Push event/webhook | Real-time | Requires consumer endpoint, replay/race risks | UNRESOLVED |
| Shared database | Low latency | Direct shared-DB coupling = NOT_AUTHORIZED | **NOT_AUTHORIZED** |
| Shared storage bucket | Offline-capable | Raw leakage risk, access control complexity | UNRESOLVED |

### 3.2 Recommended model: Pull API

**Recommended future model: Pull API.**

The export producer (LoveBud) exposes an authenticated, audience-bound, consent-scoped pull endpoint. The export consumer (Matchmaking) requests signals for a specific subject with a valid consumer credential and a purpose code. The producer verifies consent and returns only minimized derived features.

**NOT_AUTHORIZED:**
- Direct shared-database coupling (issue #3560 §Architecture questions; `docs/backend/backend.md:16-24` active runtime is Cloudflare/Modal/Neon, not a shared DB for Matchmaking).
- Public community endpoint export (signals are audience-bound and authenticated, never public).

**Implementation is DEFERRED** until the following prerequisites are met:
1. Identity-link decision (§7).
2. Consent-control UX contract (Child 2).
3. Data-minimization schema (§4).
4. Threat-model validation (§9).
5. Versioning contract (§8).

The exact endpoint path and transport are UNRESOLVED.

---

## 4. Data minimization

### 4.1 Allowed derived fields

Only the following bounded categories may be exported, and only after explicit per-field consent:

| Category | Description | Example |
|---|---|---|
| **Signal category enum** | Which signal categories are consented (content, moment, emotional-interpretation, narrative-trajectory, attention, temporal, multilingual). | `["content", "moment"]` |
| **Coarse derived feature bucket** | Aggregated, non-raw signal features. | `content_overlap_bucket: "low"` |
| **Coarse temporal pattern bucket** | Binned temporal patterns, not precise timestamps. | `temporal_pattern: "early_peak"` |
| **Language/locale bucket** | Coarse language/locale grouping, not raw text. | `language: "ko"` |
| **Explainability label enum** | Bounded labels for match explanations, not raw text. | `explanation_label: "shared_era"` |
| **Source-scope consent reference** | Bounded opaque reference to the consent grant scope, not raw content. No linkable identifiers. | `consent_ref: "<opaque_scope_ref>"` |
| **Validity/expiry state** | Whether the export is still valid. | `valid: true` |

### 4.2 Prohibited data

The following must NEVER leave LoveBud:

```text
raw title/memo/comment/description
raw transcript
raw media URL
raw private tree or moment data
Firebase UID unless separately approved identity-link contract
email/phone
political/religious/sexual/health/disability/ethnicity inference
precise location
free-text model rationale
embeddings or vectors without separate privacy review
provider payload
```

### 4.3 Consent object

Minimum bounded fields for a future consent grant:

| Field | Description |
|---|---|
| `consent_grant_id` or non-linkable alternative | UNRESOLVED — if persistent identifiers are used, they must be non-linkable across contexts unless a separate identity-link contract is approved. If unresolved, fail closed (no export). |
| `subject_link_reference_class` | UNRESOLVED — how the subject is linked between LoveBud and Matchmaking. |
| `purpose_code` | Bounded enum (e.g., `matching_similarity`). |
| `source_scope` | UNRESOLVED — bounded opaque consent-scope reference class (not raw tree_id lists or "all_consented_public"). Public visibility ≠ matching consent. If a safe reference design is unresolved, fail closed (no export). |
| `signal_category_allowlist` | Which signal categories are consented. |
| `granted_at_bucket` | Coarse time bucket (not precise timestamp). |
| `expires_at_bucket` | Coarse expiry bucket. |
| `revocation_state` | `active` / `revoked`. |
| `version` | Contract version. |
| `consumer_audience` | Which Matchmaking consumer is authorized. |

**Persistent identifier decision: UNRESOLVED.** If unresolved, fail closed — no export occurs.

**Public visibility must never equal matching consent.** A tree/memory may be public but not consented for matching.

---

## 5. Revocation and deletion

### 5.1 Revocation flow

When a subject revokes matching consent:

1. **New export stop** — the export producer stops returning the revoked signal in future pull responses.
2. **Pending export cancellation** — any in-flight export response containing the revoked signal is invalidated before delivery.
3. **Consumer invalidation** — the consumer must invalidate any cached/exported data containing the revoked signal.
4. **Active match re-evaluation** — matches that depended on the revoked signal are re-evaluated.
5. **Derived profile deletion or tombstoning** — the derived resonance profile is deleted or tombstoned.
6. **Safe retention exception** — abuse reports, blocks, moderation records, and legal/safety audit records are retained per a separate retention/pseudonymization policy child. They are **not** unconditionally deleted.
7. **Non-disclosure** — the other party is not notified of the specific revocation, the revoked signal, the raw content, or any sensitive information. Only a generic state change (e.g., "connection no longer available") is visible, if at all.
8. **Acknowledgement/evidence** — revocation is acknowledged with a privacy-safe receipt (no private payload).

### 5.2 Deletion flow

When a subject deletes a tree, memory, or moment:

1. The corresponding consent is revoked.
2. The derived signal is invalidated (same flow as §5.1).
3. The exact deletion-propagation mechanism (webhook, polling, or other) is UNRESOLVED and NOT_AUTHORIZED for implementation in this Phase 0.

### 5.3 Consumer obligations

The consumer must:
- Honor `revocation_state` in every export response.
- Invalidate cached data on revocation.
- Re-evaluate matches that depended on revoked signals.
- Not retain raw private content.
- Retain safety/moderation/audit records per a separate policy.

---

## 6. Identity-link boundary

### 6.1 Comparison

| Model | Description | Disposition |
|---|---|---|
| Same Firebase UID | Matchmaking uses the same Firebase UID as LoveBud. | UNRESOLVED — not selected by assumption. |
| Separate auth + external subject link | Matchmaking has its own auth; links to LoveBud via an external subject mapping. | PROPOSED_FUTURE_CONTRACT (preferred). |
| One-time account linking | User links accounts once via a verified flow. | PROPOSED_FUTURE_CONTRACT (prerequisite). |
| No identity link for synthetic prototype | Synthetic prototype uses no real identifiers. | PROPOSED_FUTURE_CONTRACT (required prototype boundary). |

### 6.2 Prerequisites and stop conditions

- **Prerequisite:** A stable account-link/external-subject contract is defined and approved.
- **Prerequisite:** Whether Matchmaking reuses LoveBud's Firebase project or creates a separate auth provider is resolved.
- **Stop condition:** The identity-link contract is accepted by Web CTO and a separate child issue is created for implementation.

**Do not select same Firebase project or same UID by assumption.** The Firebase UID is not exported unless a separate identity-link contract is approved.

---

## 7. Versioning and compatibility

### 7.1 Version domains

| Domain | Description |
|---|---|
| **Contract version** | The interoperability/export contract version. |
| **Signal taxonomy version** | The signal category enum version. |
| **Consent version** | The consent object schema version. |
| **Producer version** | The LoveBud export producer version. |
| **Consumer version** | The Matchmaking consumer version. |

### 7.2 Compatibility policy

- **Backward compatibility:** New versions must be backward-compatible (additive only).
- **Unsupported-version behavior:** If the consumer version is unsupported, the producer must refuse the export (fail closed).
- **Fail-closed behavior:** Any version mismatch, consent mismatch, or audience mismatch results in no export.

---

## 8. Threat model

| Threat | Prevention | Detection evidence | Residual risk | Stop condition |
|---|---|---|---|---|
| **Endpoint enumeration** | Non-enumerable API; no user/tree/moment listing. | API design review; non-enumerability test. | UNRESOLVED — pending non-enumerability test. | Non-enumerability test passes. |
| **Consent replay** | Bounded validity window; consent state checked per request. | Consent-state check in producer. | UNRESOLVED — pending validity-window test. | Validity-window test passes. |
| **Cross-user export** | Subject-specific consent verification per request. | Per-request consent audit log. | UNRESOLVED — pending consent-verification test. | Consent-verification test passes. |
| **Stale consent** | Consent state re-checked on every request. | Consent-state freshness check. | UNRESOLVED — pending freshness-check test. | Freshness-check test passes. |
| **Consumer overcollection** | Least-privilege response; only consented categories. | Response schema validation. | UNRESOLVED — pending schema-validation test. | Schema-validation test passes. |
| **Raw-content leakage** | Data-minimization filter; no raw text in response. | Response content scan. | UNRESOLVED — pending content-scan test. | Content-scan test passes. |
| **Sensitive-trait reconstruction** | Prohibited inference list enforced; no embeddings/vectors. | Inference-list enforcement check. | UNRESOLVED — pending inference-list test. | Inference-list test passes. |
| **Linkability/re-identification** | Non-linkable identifiers; no persistent IDs unless approved. | Identifier-linkability audit. | UNRESOLVED — pending identifier-linkability audit. | Identifier audit passes or fail closed. |
| **Retention drift** | Consumer retention policy enforced; tombstoning on revocation. | Retention-policy audit. | UNRESOLVED — pending retention-policy audit. | Retention-audit passes. |
| **Revocation race** | Revocation checked before response; pending exports invalidated. | Revocation-race test. | UNRESOLVED — pending revocation-race test. | Race test passes. |
| **Forged consumer audience** | Audience-bound credential verification. | Credential-verification test. | UNRESOLVED — pending credential-verification test. | Credential test passes. |
| **Operator misuse** | Operator access logs; no raw content access. | Operator-access audit log. | UNRESOLVED — pending operator-access audit. | Audit-log test passes. |

### 8.1 Audit evidence requirements

All audit-log and detection evidence referenced in this contract must be explicitly bounded and sanitized:

- **No raw identifiers** — no raw user IDs, tree IDs, moment IDs, or Firebase UIDs in audit logs.
- **No raw content** — no raw titles, memos, comments, transcripts, or media URLs in audit logs.
- **Bounded fields only** — only coarse event type, consent-scope opaque reference, purpose code, audience, and coarse time bucket.
- **Separate retention policy** — audit records are retained per a separate, explicitly-defined retention/pseudonymization policy child (Unresolved item #9). No logging implementation is authorized in this Phase 0.
- **No logging implementation authorized** — this contract defines the evidence boundary only; no audit/logging code, queue, or storage is authorized here.

---

## 9. Synthetic prototype boundary

Before real LoveBud data is authorized for export:

- **Synthetic/offline data only** — no Production user records.
- **No real identifiers** — no Firebase UID, email, phone, or other real identifiers.
- **No Production record inspection** — no access to Production databases, logs, or user records.
- **No private logs** — no logging of private content.
- **No provider connection** — no Firebase, Modal, Neon, or Cloudflare action.
- **No repository creation** — no new repository unless a later child approves it.
- **No browser/Preview/Production action** — no browser, Preview, Production, Cloudflare, Firebase, Modal, or Neon action.

The synthetic prototype uses only synthetic fixtures defined by the export schema (§4).

---

## 10. Ordered next children

| # | Child | Scope | Dependency | Evidence | Likely files | Rollback | Stop condition |
|---|---|---|---|---|---|---|---|
| 1 | Identity-link decision | Define the account-link/external-subject contract; resolve Firebase project reuse. | None | Contract doc; Web CTO approval | `docs/architecture/LOVE_MATCHMAKING_IDENTITY_LINK_CONTRACT.md` | Revert doc | Contract accepted by Web CTO. |
| 2 | Consent-control UX contract | Define the matching-consent UX and server-side enforcement in LoveBud. | #3718 (Phase 0) | UX mock; server-side enforcement tests | `docs/product/LOVE_MATCHMAKING_CONSENT_CONTROLS.md` | Revert doc | Consent UX accepted; fail-closed enforcement verified. |
| 3 | Synthetic export fixture/schema | Define the synthetic export fixture and schema for offline prototype. | This doc | Fixture schema; synthetic test data | `docs/architecture/LOVE_MATCHMAKING_EXPORT_FIXTURE_SCHEMA.md` | Revert doc | Fixture schema accepted; synthetic data generated. |
| 4 | Threat-model validation | Validate the threat model against the export schema. | Child 3 | Threat-model validation report | `docs/architecture/LOVE_MATCHMAKING_THREAT_MODEL_VALIDATION.md` | Revert doc | All threats mitigated or residual risk accepted. |
| 5 | Revocation/deletion acknowledgement contract | Define the revocation/deletion acknowledgement flow. | Child 2 | Contract doc; acknowledgement test | `docs/architecture/LOVE_MATCHMAKING_REVOCATION_ACK_CONTRACT.md` | Revert doc | Acknowledgement contract accepted; test passes. |
| 6 | Offline resonance prototype | Build the offline prototype using synthetic data only. | Children 3, 4, 5 | Prototype output; validation report | `docs/architecture/LOVE_MATCHMAKING_OFFLINE_PROTOTYPE.md` | Revert doc | Prototype demonstrates understandable matches from synthetic data. |

---

## 11. Unresolved items

1. Exact export endpoint path and transport (PROPOSED_FUTURE_CONTRACT).
2. Whether persistent identifiers are allowed in the consent object (UNRESOLVED → fail closed).
3. Bounded opaque consent-scope reference class for `source_scope` — no raw tree_id lists or "all_consented_public"; public visibility ≠ matching consent (UNRESOLVED → fail closed).
4. Whether Matchmaking reuses LoveBud's Firebase project or creates a separate auth provider (UNRESOLVED).
5. Exact identity-link mechanism (same UID, separate auth, one-time link) (UNRESOLVED).
6. Exact deletion-propagation mechanism (webhook, polling, or other) (UNRESOLVED).
7. Signed one-time export package viability (UNRESOLVED).
8. Push event/webhook viability (UNRESOLVED).
9. Shared storage bucket viability (UNRESOLVED).
10. Retention/pseudonymization policy for safety/moderation/audit records (UNRESOLVED).
11. Backward-compatibility policy details (PROPOSED_FUTURE_CONTRACT).

These are recorded for Phase 1 resolution. All are NOT_AUTHORIZED for implementation in this Phase 0 follow-up.

---

## 12. References

- `docs/engineering/API_CONTRACT.md:9-17` — Cloudflare Pages Functions → Modal runtime.
- `docs/backend/backend.md:16-24` — active runtime path (Cloudflare/Modal/Neon).
- `docs/engineering/API_CONTRACT.md:28` — `netlify/functions/*` is legacy artifact only.
- `docs/engineering/API_CONTRACT.md:94-136` — Memory and Tree data model.
- `docs/engineering/API_CONTRACT.md:157-210` — visibility/private-storage policy.
- `docs/engineering/API_CONTRACT.md:237` — canonical entitlement field `users/{uid}.privateStorageEnabled`.
- `docs/engineering/API_CONTRACT.md:440-456` — owner write guard principles.
- `docs/product/PRODUCT_IDENTITY.md:37` — memory visibility inherits parent tree visibility.
- `docs/product/TREE_MOMENT_SOCIAL_MODEL.md:66-68` — private trees do not expose social data.
- `docs/product/TREE_MOMENT_SOCIAL_MODEL.md:134-149` — moderation baseline.
- `modal_compute/owner_reads.py:116-131` — trees query by owner_id.
- `modal_compute/owner_writes.py:145-166` — delete_owner_tree with owner guard.
- `modal_compute/comments.py` — soft_delete_own_comment.
- `js/auth/auth-firebase.js` — Firebase Auth integration.
- `docs/architecture/LOVE_MATCHMAKING_ARCHITECTURE_DECISION.md` — Phase 0 architecture decision.
- `docs/product/LOVE_MATCHMAKING_SIGNALS_CONSENT_SAFETY_CONTRACT.md` — Phase 0 signals/consent/safety contract.
- `docs/product/LOVE_MATCHMAKING_PRODUCT_BOUNDARY.md` — Phase 0 product boundary.
