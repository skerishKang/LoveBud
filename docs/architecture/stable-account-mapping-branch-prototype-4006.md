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

The branch retains the canonical product snapshot:

```text
public.users     36
public.trees     45
public.memories 287
```

Neon Auth initially has zero user/account/session rows, so provisioning did not reinterpret or replace the existing 36 product identities.

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

Each current `public.users.id` was registered as a Firebase-provider identity attached to a new stable application account on the child branch only.

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

Historical social tables contain owner subjects no longer represented in `public.users`.

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

Before any production cutover:

1. create synthetic Neon Auth identities on the child branch only;
2. link synthetic Neon identities to dedicated test app accounts and verify uniqueness/relink rejection;
3. validate session/JWT verification and logout/revocation behavior;
4. determine password migration/reset strategy rather than assuming Firebase password hashes can be moved transparently;
5. validate Google OAuth callback/trusted-origin behavior for both LoveBud and LoveTree domains;
6. inventory current Firebase provider configuration using non-mutating access where available;
7. define resolution policy for the two unresolved legacy subjects;
8. add application/runtime contracts before changing product routes.

## Verdict

```text
GO_STABLE_ACCOUNT_MAPPING_MODEL
ITERATE_NEON_AUTH_SESSION_PROTOTYPE
HOLD_PRODUCTION_AUTH_CUTOVER
```

## Safety

- all schema/data writes in this document occurred only on `br-purple-cloud-a1s489o6`
- no Production Neon Auth provisioning
- no Production user/session mutation
- no existing product owner ID rewrite
- no Firebase export/import/provider mutation
- no Cloudflare deployment/secret/binding change
- no LoveBud/LoveTree runtime change
- no Modal change
- no merge requested

Refs #4004
Refs #4006
