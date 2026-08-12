# Shared Neon Auth Branch Prototype — #4006

Parent: #4004  
Track: #4006  
Audit/prototype date: 2026-08-12  
LoveBud main baseline: `cc6cb26854e4cc692d3109debe05b0de1ab23a89`

## 1. Purpose

Validate, without changing production authentication, whether Neon Auth can coexist with the current LoveBud production-data lineage on an isolated Neon branch and provide the basis for a future shared LoveBud/LoveTree identity authority.

This document records only evidence actually obtained in the branch prototype and the later read-only #4006 architecture decisions derived from that evidence. It does **not** claim that Firebase migration, managed-endpoint account linking, browser OAuth E2E, or production cutover is complete.

## 2. Safety boundary

Production remained unchanged.

Actions performed:

- read the existing Drive `AUTH_LOGIN_ACTIVE_PROVIDER_TRANSITION_PLAN.md`;
- create one Neon child branch from the canonical-candidate `133-relovetree` project;
- provision Neon Auth on that child branch only;
- inspect branch schemas/table counts/constraints with read-only SQL;
- re-check the parent/default branch to prove Neon Auth was not provisioned there.

Not performed:

- no production Neon Auth provisioning;
- no Firebase user mutation/export/import;
- no production password or session change;
- no Cloudflare deployment/binding/secret mutation;
- no LoveBud or LoveTree runtime mutation;
- no test/end-user account creation;
- no production Tree/Memory/social DML;
- no auth provider cutover.

## 3. Existing Drive auth plan compatibility

The earlier `AUTH_LOGIN_ACTIVE_PROVIDER_TRANSITION_PLAN.md` is a scoped Login-controller transition plan. It deliberately preserves Firebase/session/redirect behavior for that specific transition and explicitly prohibits combining the UI/controller handoff with backend/provider changes.

That historical constraint remains useful as a migration invariant:

- Login DOM/controller ownership should not be rewritten at the same time as the auth provider;
- redirect/error/logout behavior needs explicit parity tests;
- provider migration should be a separate policy/runtime track.

It does **not** establish Firebase as a permanent platform requirement. #4004/#4006 are the later explicit platform-policy track that can evaluate a new provider while preserving the older UI/controller contracts.

## 4. Isolated Neon branch

Prototype branch:

```text
project: 133-relovetree
branch: auth-4006-neon-auth-prototype-20260812
branch id: br-purple-cloud-a1s489o6
parent: br-little-fire-a18brh25
default: false
protected: false
```

The branch inherits the canonical product data snapshot.

Verified after Neon Auth provisioning:

```text
public.users:    36
public.trees:    45
public.memories: 287
```

Therefore provisioning Neon Auth did not replace or erase the existing product schema/data on this isolated branch.

## 5. Neon Auth provisioning result

Neon Auth provisioning succeeded on the isolated branch and created a branch-local `neon_auth` schema.

Observed auth tables:

```text
account
invitation
jwks
member
organization
project_config
session
user
verification
```

Immediately after provisioning:

```text
neon_auth.user:         0
neon_auth.account:      0
neon_auth.session:      0
neon_auth.verification: 0
neon_auth.project_config: 1
```

No production users were imported or linked by provisioning itself.

A branch-specific Auth endpoint and JWKS endpoint were issued. They are intentionally not copied into this repository document because callers should resolve environment-specific auth configuration from runtime configuration, not from committed source.

## 6. Production isolation proof

After provisioning the child branch, the parent/default production database was queried again:

```text
SELECT schema_name
FROM information_schema.schemata
WHERE schema_name = 'neon_auth';
```

Result:

```text
0 rows
```

Therefore the prototype demonstrates the key branch-isolation property required by #4006:

```text
child branch: neon_auth exists
parent/default production branch: neon_auth absent
```

This is sufficient evidence to continue auth experiments without provisioning the production branch.

## 7. Neon Auth identity shape observed

The branch schema confirms that Neon Auth user IDs are UUID-based and separate from the existing product `public.users.id` values.

Key observed relationships:

```text
neon_auth.user.id
  ← neon_auth.account.userId
  ← neon_auth.session.userId
```

`neon_auth.account` also contains provider/account identifiers and optional provider credential/token fields. `neon_auth.session` owns session tokens and expiry metadata.

This confirms a critical #4004 design conclusion:

> Product ownership must not be migrated by assuming a Neon Auth user ID equals the existing Firebase-shaped owner ID.

The durable business identity needs an explicit mapping boundary.

## 8. Recommended canonical identity model

Do not point `trees.owner_id`, social actor IDs, or other domain ownership directly at `neon_auth.user.id` during the provider transition.

Preferred logical boundary:

```text
app_account
  id = stable Love platform account id

app_auth_identity
  account_id
  provider
  provider_subject
  verified/link metadata
```

Transition shape:

```text
Firebase subject ─┐
                  ├── app_account ── Tree / Memory / social ownership
Neon Auth subject ┘
```

This avoids a second ownership rewrite if the authentication provider changes again in the future and permits a bounded Firebase→Neon migration.

### 8.1 Identity namespace gate

The current prototype key shape `(provider, provider_subject)` is acceptable only while each provider name identifies exactly one trusted authority. Current repository evidence converges on the same Firebase project namespace for both products:

```text
CURRENT_FIREBASE_NAMESPACE = relovetree
SINGLE_FIREBASE_AUTHORITY_REQUIRED = YES
RUNTIME_ISSUER_PROJECT_MATCH_BEFORE_SEEDING = REQUIRED
```

Repository configuration is not sufficient proof for a future cutover because deployed configuration may drift. Before any production identity seeding or dual-provider acceptance, verify the runtime Firebase issuer/project actually matches the intended authority.

If the platform later accepts more than one Firebase project/tenant, or more than one independent Neon Auth authority, promote the identity key before accepting that second authority:

```text
(provider, provider_subject)
```

becomes an issuer-scoped form such as:

```text
(provider, provider_issuer, provider_subject)
```

Do not use email to reconcile issuer/namespace collisions.

## 9. Why direct ID replacement is unsafe

Current canonical data already has active ownership keyed by existing user IDs. #4005 confirmed that the LoveBud lineage has real account/product data and that current non-null Tree owners resolve against `public.users`.

Neon Auth generated a distinct UUID-oriented identity schema.

Therefore a migration such as:

```text
UPDATE trees SET owner_id = neon_auth.user.id ...
```

must **not** be the first auth migration step.

It would couple product ownership to the new provider and create unnecessary risk across Tree, Memory social, comments, idempotency, audit and historical records.

## 10. Safe staged migration shape

### Stage A — identity compatibility layer

On a temporary schema branch first, design additive account/identity mapping tables without changing current ownership behavior.

Requirements:

- stable platform account ID;
- unique `(provider, provider_subject)` identity mapping under the single-authority gate above;
- explicit link status/audit metadata;
- no linking solely on an unverified email;
- deterministic idempotent linking;
- no current owner rewrite.

### Stage B — runtime resolver

Shared Cloudflare API accepts the active authentication token and resolves it to one stable app account.

During transition:

```text
Firebase token → Firebase subject → app_account
Neon Auth token → Neon subject → app_account
```

Domain authorization consumes the stable account, not raw provider identity.

### Stage C — account linking

Existing users must prove control through a secure migration/link flow or another evidence-based migration path. Google/OAuth users and Email/Password users may require different flows.

### Stage D — provider retirement

Only after account coverage, ownership parity, Login/redirect/logout parity, and rollback evidence are complete can Firebase acceptance be disabled.

## 11. Password migration decision narrowed

The prototype did not export Firebase credential hashes and did not test password-hash import into managed Neon Auth. Later read-only #4006 evidence establishes that the existence of a credential field in the managed Auth schema is **not** proof that Firebase modified-scrypt hashes can be imported or verified.

Current gate:

```text
PASSWORD_HASH_IMPORT_SUPPORTED_AND_TESTED: NO
HOLD_FIREBASE_HASH_EXPORT_FOR_MIGRATION: YES
PREFERRED_NONPROD_TEST_PATH: JUST_IN_TIME_ACCOUNT_LINK_REQUIRED
FALLBACK_PATH: FORCED_PASSWORD_RESET_REQUIRED
JIT_MANAGED_ENDPOINT_E2E: PENDING
PRODUCTION_AUTH_CUTOVER: HOLD
```

The preferred staged candidate is therefore `JUST_IN_TIME_ACCOUNT_LINK_REQUIRED`, not direct hash conversion. The future non-production proof must require:

1. successful existing Firebase authentication to prove control;
2. deterministic resolution of the verified Firebase subject to exactly one `app_account`;
3. fail-closed handling for ambiguous or unmapped subjects;
4. Neon credential/session establishment only for that resolved account;
5. idempotent, auditable linking;
6. no link based only on email, especially unverified email.

If managed Neon Auth cannot support a safe JIT flow, the fallback is `FORCED_PASSWORD_RESET_REQUIRED`, also bound to a deterministically resolved existing `app_account` rather than email matching.

This decision remains pending managed-endpoint E2E. No password/hash conversion should be invented from schema similarity, and sensitive Firebase hash material should not be exported merely to test an undocumented path.

## 12. Shared-app SSO topology selected; runtime proof pending

The architecture decision portion is no longer open-ended. Current LoveBud and LoveTree production origins are separate hosts under unrelated suffixes, so the migration must not depend on direct cross-application cookie sharing.

Selected topology:

```text
SSO_TOPOLOGY: SEPARATE_APP_ORIGINS_USING_CENTRAL_AUTH_REDIRECT_SESSION_EXCHANGE
SHARED_APP_ACCOUNT_AUTHORITY: REQUIRED
DIRECT_CROSS_APP_COOKIE_SHARING: NOT_REQUIRED
NONPROD_TRUSTED_ORIGIN_E2E: PENDING
GOOGLE_OAUTH_BRANCH_E2E: PENDING
PRODUCTION_TRUSTED_ORIGIN_CHANGE: HOLD
PRODUCTION_AUTH_CUTOVER: HOLD
```

Target logical flow:

```text
LoveBud origin ─┐
                ├─> shared platform auth authority ─> verified provider subject
LoveTree origin ┘                                  └─> app_auth_identity
                                                       └─> stable app_account
```

Each app keeps only session/token material appropriate to its own origin/runtime. Both applications resolve the verified provider identity through the same stable account authority.

Future branch E2E must prove at least:

- both fixed non-production origins are explicitly trusted;
- return targets are allowlisted per app and cannot become open redirects;
- state/return-target integrity is protected;
- sessions from either app resolve to the same `app_account`;
- logout/session-expiry behavior is defined for both apps;
- no client-supplied `app_account` is trusted;
- ambiguous/unmapped identities fail closed;
- wildcard PR-preview origins are not assumed safe or supported.

The current child has `trusted origins = 0`, so browser OAuth remains HOLD until fixed non-production origins/callbacks are configured through the supported management surface.

## 13. Interaction with LovePortal/LoveTree shared architecture

The branch result supports the #4004 topology:

```text
LovePortal / LoveBud / LoveTree
            ↓
      shared identity authority
            ↓
      love-platform-api
            ↓
       canonical Neon
```

The auth service can branch with the canonical Neon lineage, while LoveBud/LoveTree remain clients of one shared account authority.

Fresh cross-app audit also confirms current LoveTree product auth is Firebase, not Supabase, and both applications currently use Firebase subjects directly as business owner/actor IDs. Do not add a `supabase` provider based on stale evidence.

It also reinforces the LoveTree #152 guardrail: do not independently provision a permanent LoveTree Neon Auth authority.

## 14. Interaction with Modal migration

Neon Auth feasibility does not require Modal.

The eventual shared Cloudflare API can validate/consume the selected shared auth session/token and enforce domain authorization before accessing Neon.

Modal remains orthogonal specialized compute and should not become the identity authority.

## 15. Next experiments

The safe next #4006 steps are now:

1. run synthetic Neon Auth sign-up/sign-in/sign-out against the existing non-production child Auth endpoint from a network-capable runner;
2. test the preferred JIT existing-account link flow without exporting Firebase password hashes;
3. verify provider-specific token/session/JWKS validation and logout/revocation behavior;
4. configure and validate fixed non-production trusted origins/callbacks for both LoveBud and LoveTree;
5. prove central redirect/session exchange maps both applications to the same stable `app_account` without cross-origin cookie assumptions;
6. verify the actual runtime Firebase issuer/project namespace before any production identity seeding;
7. define resolution policy for unresolved legacy social subjects;
8. add runtime contracts before changing Product owner routes;
9. only then propose a staged production migration PR.

## 16. Prototype verdict

```text
GO_STABLE_ACCOUNT_MAPPING_MODEL
GO_AUTHENTICATED_PRINCIPAL_ABSTRACTION
GO_EXISTING_ACCOUNT_COMPATIBILITY_RESOLVER
GO_MAPPING_UNIQUENESS_MODEL
GO_EMAIL_PASSWORD_BRANCH_TEST_CONFIGURATION
PREFERRED_PASSWORD_PATH: JUST_IN_TIME_ACCOUNT_LINK_REQUIRED
SSO_TOPOLOGY: SEPARATE_APP_ORIGINS_USING_CENTRAL_AUTH_REDIRECT_SESSION_EXCHANGE
HOLD_NEW_NEON_ONLY_PRODUCT_WRITES
HOLD_BROWSER_OAUTH_TRUSTED_ORIGINS
HOLD_MULTI_ISSUER_IDENTITY_ACCEPTANCE
HOLD_ENTITLEMENT_AUTHORITY_MIGRATION
HOLD_STABLE_PRODUCT_OWNER_CUTOVER
HOLD_PRODUCTION_AUTH_CUTOVER
```

Reason:

```text
PASS: branch-local Neon Auth provisioning
PASS: canonical public data preserved on child branch
PASS: production branch remained without neon_auth
PASS: stable account / legacy Firebase mapping prototype
PASS: existing-account compatibility resolver and uniqueness model
PASS: password migration path narrowed without unsupported hash import
PASS: shared-app SSO topology selected
PASS: current single Firebase namespace gate documented
PENDING: managed-endpoint signup/session/JIT-link E2E
PENDING: non-production trusted-origin + Google OAuth E2E
PENDING: provider-neutral server/runtime acceptance
PENDING: entitlement and stable Product-owner migration
```

Neon Auth remains a viable shared-auth candidate, but Production auth cutover is not authorized.

Refs #4004
Refs #4005
Refs #4006
