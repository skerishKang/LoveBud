# Auth Principal Compatibility Bridge — #4006

Parent: #4004  
Track: #4006  
Contract date: 2026-08-12  
LoveBud source baseline: `cc6cb26854e4cc692d3109debe05b0de1ab23a89`

## 1. Purpose

Define the backend/client compatibility boundary required to move authentication from Firebase toward Neon Auth **without changing Product ownership identity by accident**.

This document is source/contract only. It does not switch the active login provider, modify Production Auth settings, deploy Cloudflare/Modal, or rewrite Product owner IDs.

## 2. Current source-of-truth auth path

Current exact-main auth state splits into five distinct boundaries:

- **CLIENT TOKEN ACQUISITION BOUNDARY**: provider-neutral seam landed on main; default implementation remains Firebase.
- **ACTIVE LOGIN PROVIDER**: Firebase.
- **SERVER VERIFIER**: Firebase-only.
- **PRODUCT OWNER AUTHORITY**: Firebase legacy subject.
- **ENTITLEMENT AUTHORITY**: Firestore keyed by Firebase UID.

The active runtime flow is Firebase end to end:
```text
browser Firebase currentUser
  -> Firebase ID token
  -> Authorization: Bearer <token>
  -> Cloudflare same-origin API proxy
  -> Modal private route
  -> require_firebase_user()
  -> verified Firebase uid
  -> owner read/write/social function
  -> Product owner_id comparison
```

### 2.1 Client token preparation

`js/api/base-api-fetch.js` on current main exposes a provider-neutral client token seam:

- `getAuthTokenProvider()` selects the active token provider;
- `window.LoveBudAuthTokenProvider` is the injection seam for a non-default provider;
- the default/active provider adapter remains `createFirebaseAuthTokenProvider()`, which resolves the principal from live `firebase.auth().currentUser`;
- the active provider exposes `getCurrentPrincipal()` and `getAccessToken()`;
- principal/token mismatch is fail-closed, and a missing token `principalId` is also fail-closed;
- the session-scoped token cache record keeps a `uid` field as a Phase-A compatibility shape;
- clears confirmed auth state on authenticated 401 behavior.

The default provider is Firebase. This is a provider-neutral transport with a Firebase default — it is **not** Neon login activation and **not** a stable account ID migration.

### 2.2 Modal verification

`modal_compute/auth.py::require_firebase_user()` currently:

- requires a Bearer token;
- reads the JWT header;
- refreshes trusted Firebase signing certificates;
- validates the token with the Firebase project audience and exact Firebase issuer;
- derives the Product subject from verified `uid` / `sub`;
- returns `{uid, email, decoded}`.

### 2.3 Private route ownership

`modal_compute/app.py` calls `require_firebase_user()` throughout private Tree/Memory/social routes and passes `user["uid"]` into owner operations.

The existing Product tables and writer checks therefore treat the Firebase subject itself as ownership identity.

### 2.4 Entitlement coupling

Private-storage Plus entitlement is also Firebase-coupled today:

```text
Firebase uid
  -> Firestore users/{uid}
  -> privateStorageEnabled / compatibility entitlement fields
```

Auth-provider migration and entitlement-source migration are separate concerns and must not be conflated.

## 3. Why a direct provider swap is unsafe

Changing the browser login implementation to return a Neon Auth token while leaving the backend unchanged would fail because:

1. Modal currently validates Firebase issuer/audience/certificates only;
2. the verified subject is passed directly as Product `owner_id`;
3. Neon Auth subject UUIDs are not the existing Firebase owner strings;
4. token cache identity checks assume Firebase `uid`;
5. private-storage entitlement reads Firestore by that Firebase UID.

Therefore this is prohibited:

```text
Neon login UI -> send Neon token -> pretend Neon subject == existing owner_id
```

## 4. Provider-neutral authenticated principal

Target internal backend abstraction:

```ts
interface AuthenticatedPrincipal {
  provider: 'firebase' | 'neon';
  subject: string;
  accountId: string;       // stable application-account UUID
  legacyOwnerId: string | null;
  email?: string;
}
```

Meaning:

- `provider` / `subject` identify the cryptographically verified auth identity;
- `accountId` identifies the stable LoveBud application account;
- `legacyOwnerId` is a transition-only compatibility projection to current Product owner columns;
- `email` is metadata and MUST NOT be an ownership/linking key.

## 5. Verification-before-mapping invariant

Identity mapping may occur **only after token verification succeeds**.

Required sequence:

```text
1. parse enough token metadata to select a configured trusted verifier
2. verify signature + issuer + audience + time claims with that provider
3. extract verified provider subject
4. resolve (provider, verified subject) in app_auth_identities
5. resolve stable account
6. resolve current legacy Product owner subject if compatibility mode requires it
7. authorize Product operation
```

Never:

- trust an unverified `sub`, `uid`, email or issuer as Product identity;
- link an identity by matching email alone;
- accept an unknown issuer because its token shape resembles Firebase/Neon;
- fall through from one failed trusted-provider validation into an unrelated weaker verifier;
- expose raw token/JWKS/credential material in application errors.

## 6. Database compatibility resolver proven on the child branch

The #4006 isolated branch now contains:

```text
public.app_authenticated_owner_resolution
```

Conceptual projection:

```text
(provider, provider_subject)
  -> stable account_id
  -> active Firebase identity on that account
  -> legacy_owner_id
```

This view is a prototype compatibility boundary only; it is not a Production schema authority yet.

### 6.1 Historical child-snapshot user proof

```text
Firebase subjects represented in that historical 36-user child snapshot resolving to their corresponding legacy owners: 36 / 36
```

### 6.2 Synthetic cross-provider mapping proof

A temporary synthetic Neon provider subject was attached to one existing stable account **only in the #4006 child branch**.

Observed:

```text
Neon subject -> stable account -> existing Firebase legacy owner: PASS
second Neon identity on same account/provider: unique violation
same Neon provider subject on a different account: unique violation
```

All synthetic Neon identity rows were removed at the end of the probes:

```text
retained provider='neon' probe identities: 0
```

No `neon_auth.user` or session row was fabricated for these mapping probes.

## 7. Existing-account compatibility mode

The first dual-provider runtime slice should support **existing mapped accounts only**.

For a verified Neon principal whose `app_auth_identities` record resolves to an app account that also has an active Firebase identity:

```text
verified Neon subject
  -> accountId
  -> legacyOwnerId (Firebase subject)
  -> existing Product owner checks
```

This permits backend authorization parity without rewriting all Product owner columns in the same PR.

### 7.1 Fail-closed cases

The compatibility resolver must reject/deny when:

- provider subject is unknown;
- identity link state is revoked or ambiguous;
- account is disabled/merged without an explicit resolution policy;
- multiple legacy identities would make owner projection ambiguous;
- Neon identity belongs to an app account with no legacy Product owner subject in a route still using legacy ownership.

No email-based fallback.

## 8. New Neon-only account gate

A brand-new Neon-only account does not have a Firebase legacy owner subject.

Until Product ownership is migrated to stable `app_account` identity, such an account must **not** be silently written into existing owner columns under a synthetic Firebase-like value.

Initial gate:

```text
existing linked account -> compatibility owner access can be tested
new Neon-only account   -> HOLD Product owner writes
```

Neon-only signup UI/session validation can still be tested in non-production, but durable Product ownership writes require the later stable-owner migration.

## 9. Entitlement transition boundary

During existing-account compatibility mode, `legacyOwnerId` can preserve the current Firestore entitlement lookup for already-linked users:

```text
Neon verified principal
  -> accountId
  -> legacyOwnerId
  -> existing Firestore entitlement read
```

This is a temporary bridge, not the target architecture.

Target state:

```text
stable app account
  -> canonical entitlement source
```

The entitlement source should be migrated independently and proven before Firebase/Firestore is removed.

New Neon-only accounts must not receive private-storage access by inventing a Firebase document key.

## 10. Client token/cache transition

The provider-neutral client seam is already on current main: `getAuthTokenProvider()` / `window.LoveBudAuthTokenProvider` exist, the default Firebase provider serves the current Firebase `currentUser` as principal, and the cache record's `uid` field is retained as a Phase-A compatibility shape. The injected-provider contract fails closed on principal/token coherence and on a missing token `principalId`.

A later provider-neutral session path can replace `resolveExpectedAuthUid()` with a confirmed principal/session abstraction when Neon client activation actually lands. This is not a stable account ID migration and not Neon login activation.

Target cache metadata should be provider-neutral, for example conceptually:

```ts
interface AuthTokenCacheIdentity {
  provider: 'firebase' | 'neon';
  subject: string;
  expiresAt: number;
}
```

Security boundary:

- client-side subject metadata is cache-coherency data only;
- server authorization must always use the verified token + server-side mapping;
- provider switch/account switch must clear incompatible cached tokens and private caches;
- existing confirmed-session retry/401-clearing behavior must remain covered by regression tests.

Exact storage keys and session representation are implementation details to be decided in the runtime PR; this contract does not authorize rewriting them now.

## 11. Backend migration phases

### Phase A — principal abstraction, Firebase-only behavior

Refactor `require_firebase_user()` call sites behind a provider-neutral principal boundary while still accepting **only Firebase**.

Acceptance:

```text
same Firebase token -> same legacy owner_id -> same authorization behavior
```

This is the lowest-risk runtime refactor because provider policy does not change.

### Phase B — non-production Neon verifier

Add a pinned/configured Neon verifier in a test environment only.

Required:

- exact expected issuer/audience policy;
- trusted JWKS source from managed Auth configuration;
- bounded JWKS outage behavior;
- unknown issuer rejection;
- token expiry/not-before checks;
- active identity mapping required.

### Phase C — existing-account dual-auth compatibility

For a verified mapped Neon identity, resolve `legacyOwnerId` and prove access to the same owner Tree/Memory data as the linked Firebase identity.

No new-account Product writes yet.

### Phase D — provider-neutral browser session/token path

Transition the client auth/token cache without changing Product ownership or entitlement semantics in the same slice.

**Landed foundation vs. target phase:** the client provider-neutral seam (Phase A of the client work, #4010) is already on current main — `getAuthTokenProvider()` / `window.LoveBudAuthTokenProvider`, Firebase default adapter, fail-closed principal/token coherence, and the `uid`-shaped compatibility cache record. That is a foundation only; Phase D as a whole (full provider-neutral session path with a Neon-capable client) is **not complete**, and Neon client provider activation remains NOT DONE.

### Phase E — entitlement authority migration

Move Plus/private-storage entitlement from Firebase UID/Firestore toward stable account identity with independent parity evidence.

### Phase F — stable Product owner migration

Move Product ownership references away from Firebase subject strings toward stable account identity using separately reviewed additive/backfill/cutover migrations.

Only after this phase can new Neon-only accounts perform unrestricted Product owner writes without compatibility projection.

### Phase G — Firebase retirement

Firebase token verification, Firebase auth UI/provider calls, legacy owner projection and Firestore entitlement dependency may be removed only after all preceding parity gates pass.

## 12. Login-provider parity matrix

Current Firebase functionality that must remain accounted for:

```text
email/password login
email/password signup
display-name update during signup
Google popup login
Google redirect fallback
persisted auth-state/bootstrap behavior
password-reset email
logout/session clearing
```

Current child Neon Auth configuration supports email/password signup and has one Google provider configured. The synthetic email/password lifecycle through the managed endpoint is PASS-proven (19 PASS / 2 BYPASS / 0 FAIL, including origin validation: missing origin → 400, untrusted origin → 403). Deployed browser OAuth remains BLOCKED_ZERO_TRUSTED_ORIGINS (0 trusted origins configured on the child).

Provider feature availability alone is not cutover evidence; session, callback, ownership and rollback parity must be tested.

## 13. Required regression matrix

Before dual-provider runtime activation:

```text
A. valid Firebase token -> same account/legacy owner as before
B. invalid Firebase token -> rejected
C. Firebase cert/JWKS dependency outage -> bounded fail-closed behavior
D. valid mapped Neon token -> stable account -> correct legacy owner
E. valid unmapped Neon token -> no Product owner access
F. ambiguous/revoked mapping -> no Product owner access
G. email match without explicit identity link -> no auto-link
H. malformed/unknown issuer token -> rejected
I. Firebase and Neon linked identities cannot cross into another account
J. account switch clears incompatible client token/private cache
K. linked Neon identity sees same existing Tree/Memory ownership as Firebase identity
L. new Neon-only identity cannot create legacy-owner Product rows before stable-owner migration
M. private-storage entitlement remains parity-correct for linked existing accounts
```

DB-engine tests must cover mapping uniqueness. Token-verifier tests must use provider-specific signing fixtures or a non-production managed endpoint; direct inserts into managed Auth user/session tables are not valid session evidence.

## 14. Expected runtime overlap surface

Likely future files, re-derived from fresh main before implementation:

```text
modal_compute/auth.py
modal_compute/app.py
js/api/base-api-fetch.js
js/auth/* and/or js/login/* provider boundary
relevant auth/bootstrap/API contract tests
```

Because these are high-blast-radius auth files, implementation must start from then-current main and recheck every open Auth/security PR before mutation.

## 15. Verdict

```text
GO_AUTHENTICATED_PRINCIPAL_ABSTRACTION
GO_EXISTING_ACCOUNT_COMPATIBILITY_RESOLVER
GO_MAPPING_UNIQUENESS_MODEL
HOLD_NEW_NEON_ONLY_PRODUCT_WRITES
HOLD_BROWSER_OAUTH_TRUSTED_ORIGINS
HOLD_ENTITLEMENT_AUTHORITY_MIGRATION
HOLD_STABLE_PRODUCT_OWNER_CUTOVER
HOLD_PRODUCTION_AUTH_CUTOVER
```

## 16. Safety

- GitHub change is documentation only
- compatibility view exists only in isolated Neon child branch `br-purple-cloud-a1s489o6`
- mapping probes left zero synthetic Neon identity rows
- no managed Auth user/session fabrication
- no Production/default Neon mutation
- no Firebase provider/config/data mutation
- no Cloudflare/Modal deployment mutation
- no login/runtime source mutation
- no Ready/merge action

Refs #4004
Refs #4006
