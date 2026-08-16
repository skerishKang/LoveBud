# Stable Account Mapping Branch Prototype — #4006

Parent: #4004  
Track: #4006  
Prototype date: 2026-08-12  
LoveBud base: `cc6cb26854e4cc692d3109debe05b0de1ab23a89`

## Purpose

Validate a stable application-account boundary between current Firebase-shaped product ownership and future Neon Auth identities without replacing existing owner IDs or mutating Production.

## Isolated Neon Auth branch

```text
name: auth-4006-neon-auth-prototype-20260812
branch id: br-purple-cloud-a1s489o6
parent: br-little-fire-a18brh25
```

Neon Auth was provisioned only on this non-default child branch. The parent/default production database remains without the `neon_auth` schema.

At prototype execution time, the branch retained the historical non-default-child 36/45/287 snapshot used for this prototype (not current default/deployed authority):

```text
public.users     36
public.trees     45
public.memories 287
```

Neon Auth initially has zero user/account/session rows, so provisioning did not reinterpret or replace the 36 product identities present in that historical child snapshot.

## Stable account mapping model

The child branch now contains an experimental mapping layer:

```text
app_accounts
app_auth_identities
app_auth_link_events
app_legacy_owner_accounts  (compatibility view)
app_identity_reconciliation_cases
```

Core invariants:

- application account identity is independent of auth provider;
- provider subject is unique per provider;
- one application account may have at most one active row per provider in this prototype;
- Firebase and Neon subjects are never assumed to be the same identifier;
- provider linking is auditable;
- ambiguous/stale subjects are quarantined instead of auto-linked.

## Legacy Firebase bootstrap result

Each `public.users.id` present in that historical 36-user child snapshot was registered as a Firebase-provider identity attached to a new stable application account on the child branch only.

Verification:

```text
legacy public.users:             36
app_accounts:                    36
Firebase auth identities:        36
bootstrap audit events:          36
legacy users without mapping:     0
duplicate account/provider groups: 0
unmapped non-null Tree owner rows: 0
```

No `public.users.id`, `trees.owner_id`, Memory ownership, or social ownership value was rewritten.

## Legacy social identity exception

The historical snapshot's social tables contain owner subjects not represented in that snapshot's `public.users`.

Observed unresolved rows:

```text
comments:       6
reactions:      2
tree_comments:  1
tree_likes:     1
```

Cross-table grouping shows these 10 rows resolve to exactly **two distinct legacy subjects**, not ten independent identities:

```text
legacy subject A: 7 rows across comments + reactions
legacy subject B: 3 rows across reactions + tree_comments + tree_likes
```

These two subjects were **not** converted into accounts and were **not** linked to any existing user. They were inserted into `app_identity_reconciliation_cases` as unresolved evidence.

This is a deliberate account-takeover prevention rule: stale subject equality or historical activity is insufficient evidence to establish current account ownership.

## Firebase runtime provider inventory

Current LoveBud exact-main source confirms that migration parity must cover more than one sign-in call.

Observed active Firebase capabilities include:

1. email/password login;
2. email/password signup;
3. display-name profile update during signup;
4. Google OAuth login;
5. Google popup flow;
6. Google redirect fallback/embedded-browser flow;
7. persisted auth state / auth-state callback behavior;
8. password-reset email flow.

The existing Login-controller transition plan remains relevant for UI/controller/redirect semantics, but #4006 is a separate explicit provider-migration track.

No production provider setting was changed during this inventory.

## Managed Neon Auth configuration evidence

Only non-secret configuration shape/flags were read from the child branch. No OAuth credential or endpoint secret was emitted or committed.

Observed child-branch configuration:

```text
email/password enabled:             true
signup disabled:                    false
require email verification:         false
auto-sign-in after verification:    true
send verification on signup:        false
send verification on signin:        false
configured social providers:        1
social provider observed:            google (shared configuration)
allow localhost:                    true
trusted origins configured:         0
```

Interpretation:

- email/password synthetic-user testing is configuration-compatible on the child branch;
- Google is present as the first OAuth parity candidate;
- deployed LoveBud/LoveTree browser OAuth must remain `HOLD` until explicit trusted origins/callback configuration is added through the supported Neon Auth management surface;
- direct SQL editing of managed Auth configuration is intentionally avoided.

Neon documents the current branchable Auth implementation as Better Auth-based, with branch-scoped users/sessions/config/JWKS and branch-specific Auth endpoints. Better Auth's standard email/password lifecycle exposes sign-up, sign-in, session-cookie and sign-out flows; the intended test is therefore an end-to-end synthetic lifecycle through the managed endpoint rather than manually inserting rows into `neon_auth` tables.

A later network-capable run executed that synthetic lifecycle through the managed child endpoint: email/password signup, signin, session-token validation, logout and post-logout rejection all passed (19 PASS / 2 BYPASS / 0 FAIL). The GET /session REST endpoint is not exposed by the managed API, so session validation is token-based (BYPASS). Origin validation passed (missing origin → 400; untrusted origin → 403). No direct-table imitation of signup/session state was performed.

## Identity migration rule

The prototype rejects direct substitution such as:

```text
Firebase UID -> Neon Auth UUID across owner_id columns
```

The intended target is conceptually:

```text
stable app account
  |- firebase provider subject (legacy / transition)
  `- neon provider subject     (new auth)
```

Product authorization should progressively resolve through the stable application account boundary before Firebase can be removed.

## Next evidence required

Before any production cutover, each item with its current evidence status:

1. **synthetic Neon Auth sign-up/sign-in/sign-out against the child Auth endpoint** — **COMPLETED / PASS** (19 PASS / 2 BYPASS / 0 FAIL on the managed endpoint);
2. **link synthetic Neon identities to dedicated test app accounts and verify uniqueness/relink rejection** — **DESIGN VERIFIED** via the branch uniqueness constraints; managed JIT runtime **NOT PROVEN** (no account-linking API in the managed endpoint);
3. **session/JWT verification and logout/revocation behavior** — **COMPLETED / PASS** for the tested email/password lifecycle (JWKS EdDSA, malformed/no-auth rejection, signout invalidation); GET /session endpoint **BYPASS**;
4. **password migration/reset strategy** rather than assuming Firebase password hashes can be moved transparently — **JIT preferred path confirmed**; managed JIT runtime **NOT PROVEN**; forced reset remains the fallback;
5. **Google OAuth callback/trusted-origin behavior for LoveBud and LoveTree on non-production Auth** — **BLOCKED_ZERO_TRUSTED_ORIGINS** (0 trusted origins configured on the child; owner action required);
6. **current Firebase provider configuration inventory using non-mutating access** — **BLOCKED_BY_OWNER_ACCESS** (no Firebase Admin credentials available);
7. **resolution policy for the two unresolved legacy subjects** — **REMAINS REQUIRED** (both subjects quarantined in `app_identity_reconciliation_cases`; policy not yet defined);
8. **application/runtime contracts before changing product routes** — **REMAINS REQUIRED / HOLD**.

## Verdict

```text
GO_STABLE_ACCOUNT_MAPPING_MODEL
GO_EMAIL_PASSWORD_BRANCH_TEST_CONFIGURATION
HOLD_BROWSER_OAUTH_TRUSTED_ORIGINS
ITERATE_NEON_AUTH_SESSION_PROTOTYPE
HOLD_PRODUCTION_AUTH_CUTOVER
```

## Safety

- all schema/data writes in this document occurred only on `br-purple-cloud-a1s489o6`
- no Production Neon Auth provisioning
- no Production user/session mutation
- no existing product owner ID rewrite
- no Firebase export/import/provider mutation
- no direct SQL mutation of managed Neon Auth config/users/sessions
- no Cloudflare deployment/secret/binding change
- no LoveBud/LoveTree runtime change
- no Modal change
- no merge requested

Refs #4004
Refs #4006
