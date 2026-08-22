# Auth Three-Layer Mapping Contract — #4006

Parent: #4004 — Keep OPEN
Track: #4006
Unblocks: #4157 Tree Fork write-gate re-activation (#4164 deferral)
Status: PROTOTYPE_ONLY contract — documentation + local simulation, zero execution authority
Contract date: 2026-08-22
Baseline verified fresh: `origin/main` = `14930792751cab75bb0897989a196716be6b0d19`
Companion DDL proposal: `CANONICAL_USERS_TABLE_DDL_PROPOSAL_4006.md` /
`db/proposals/4006-canonical-users-auth-identity-proposal.sql`

Preflight and resource classification are recorded once in the companion DDL proposal (`RESOURCE_CLASS = PROPOSAL_ONLY_DOCUMENT_ARTIFACT`, `ARCHITECTURE_CONSISTENCY_GATE = PASS`). This contract performs zero provider/auth/DB mutation and therefore repeats no provider identity claims.

## 1. Three-layer model

```text
LAYER 1  VERIFIED PROVIDER IDENTITIES        (app_auth_identity)
         verified firebase_subject ─┐
                                    ├─ each row: (provider, subject,
         verified neon_subject ─────┘   status, verification_method)

                    resolves only through

LAYER 2  STABLE PRODUCT ACCOUNT              (app_account.id)
         ONE stable uuid per Product account across LoveBud + LoveTree;
         business ownership anchors here, never at Layer 1 or Layer 3.

                    projects during migration as

LAYER 3  LEGACY OWNER COMPATIBILITY          (users.id, users.account_id)
         Firebase-era owner subject kept as a transition-only projection
         (bridge doc sections 7 and F phases); never minted synthetically.
```

Rule: ownership flows strictly downward through Layer 2. A Layer 1 subject can never name a Layer 3 owner directly, and a Layer 3 value can never create or claim a Layer 1 identity.

## 2. Verification-before-mapping invariant

Rows enter `app_auth_identity` only AFTER cryptographic verification succeeds for that exact provider (bridge doc section 5). Unverified material (raw sub/uid claims, unverified emails, token shapes) cannot create, activate, or redirect any mapping. The prototype core models this as `verifiedEvidence === true` plus a non-empty `verification_method`; anything else fails closed before state changes.

## 3. R1 — Resolve rules

`resolve(provider, verifiedSubject)` outcomes (all frozen, all deny-by-default):

```text
identity unknown                          -> DENY  IDENTITY_UNKNOWN
identity revoked                          -> DENY  IDENTITY_REVOKED
account disabled                          -> DENY  ACCOUNT_DISABLED
account merged (no explicit policy yet)   -> DENY  ACCOUNT_MERGED_WITHOUT_POLICY
firebase identity, no legacy projection   -> DENY  AMBIGUOUS_OWNER_PROJECTION
neon identity, no legacy projection       -> HOLD  HOLD_NEW_NEON_ONLY_PRODUCT_WRITES
otherwise                                 -> ALLOW { accountId, legacyOwnerId }
```

The HOLD case implements bridge section 8: a brand-new Neon-only account may exercise non-owner-write proving paths but never durable Product owner writes until the Phase F stable-owner migration. DENY/HOLD outcomes are terminal for authorization purposes; they never fall through to weaker checks, and there is no email-based fallback resolver anywhere in the surface.

## 4. R2 — Link rules

Linking a verified identity onto an existing account:

```text
L1  Both sides verified. The caller supplies verified evidence for the NEW
    identity; authorization to touch the TARGET account comes from either
    (a) presenting a verified credential of an identity already active on
    that account, or (b) the explicit operator recovery flow (R3).
    Verified-but-unrelated credentials cannot select arbitrary targets.
L2  Email is never sufficient. Matching normalized email across providers
    creates no linkage, satisfies no requirement, and appears in no unique
    constraint. Two accounts may share a display email with zero coupling.
L3  Idempotent by shape. UNIQUE (provider, provider_subject) plus the
    one-active-per-provider-per-account partial indexes make duplicate or
    ambiguous activation unrepresentable; a re-attach of an identical active
    pair succeeds as a no-op with ZERO audit delta.
L4  Conflict is fail-closed. An active binding to a DIFFERENT account blocks
    every rebinding path (IDENTITY_ALREADY_BOUND). Moving requires the
    explicit operator recovery flow; nothing moves silently.
L5  Reactivation is scoped. A revoked identity reactivates only onto the
    SAME account it was revoked from, through the normal verified attach.
L6  Auditable exactly once. Every successful mutation appends exactly one
    auth_audit_log row transactionally; failed attempts append zero.
```

## 5. R3 — Recovery path

```text
recoveryUnlink(provider, subject):
  requires operatorAuthorized === true AND a written justification;
  otherwise RECOVERY_NOT_AUTHORIZED (fail closed);
  marks the identity revoked and audits action=recovery_used.

Relink afterwards follows ordinary R2 attach semantics (verified evidence
required; same-account scoping per L5).

Firebase remains the recovery anchor until bridge Phase G: every account
created in the Firebase era keeps its verified Firebase identity, so a lost
Neon credential never strands Product ownership.
```

## 6. R4 — Fail-closed catalog and zero-mutation guarantee

Any of these aborts the operation with zero state change: missing/failed verification, unknown provider or empty subject, inactive/unknown target account, active conflict elsewhere, second active identity for the same provider on one account, forbidden audit payload keys, unauthorized recovery/operator actions. There is no code path that mutates first and validates later.

## 7. Audit and privacy

Audit rows carry bounded fields only: action, actor_class, account_id, identity_provider, request_id, sanitized details JSONB. They intentionally omit raw provider subjects. Details keys matching email/token/hash/secret/password are rejected outright (AUDIT_PRIVACY_VIOLATION), enforcing the repo-wide no-secrets/no-private-payload guardrail at the contract level.

## 8. Regression matrix coverage (prototype slice)

Mapped against bridge doc section 13 items provable without providers:

```text
A/K -> scenario 3   valid mapped identities resolve to same account/owner
E   -> scenario 4   unmapped subject denied
F   -> scenarios 5-7 revoked/disabled/merged denied
G   -> scenarios 8-9 no auto-link by email; takeover attempts fail closed
I   -> scenarios 11-13 identity/provider uniqueness cannot cross accounts
L   -> scenario 14  Neon-only identity held away from legacy owner writes
M   -> scenario 15  ambiguous legacy projection denied (parity guard)
plus idempotency (10), audit exactly-once (16), audit privacy (17-18),
recovery path (19), caller-input non-mutation (20).
```

Runtime/token/session parity items (B/C/D/H/J and live OAuth) stay owned by the bridge document's later phases and remain OUT of this prototype's claims.

## 9. Nonprod validation scope

All R1-R4 behavior is proven by `tests/contracts/auth-mapping-linking-contract-4006.test.cjs` executing a pure in-memory state machine (layer EXECUTED_FAKE). No network, no database engine, no Firebase/Neon/Auth provider, no Production resource. The simulation mirrors the proposed constraint shapes so DDL adoption and runtime enforcement converge on one contract.

## 10. Non-goals

No Production provisioning, no auth cutover, no ownership rewrite, no password/OAuth migration claims (bridge sections D/E of #4006 required-work list own those separately), no merge/close actions, no expansion of the #4157 writer matrix.

Refs #4006. Refs #4004 — Keep OPEN. Refs #4157. Refs #4164.
Refs #1882 — Keep OPEN.
