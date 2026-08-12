# Shared Neon Auth Branch Prototype — #4006

Parent: #4004  
Track: #4006  
Audit/prototype date: 2026-08-12  
LoveBud main baseline: `cc6cb26854e4cc692d3109debe05b0de1ab23a89`

## 1. Purpose

Validate, without changing production authentication, whether Neon Auth can coexist with the current LoveBud production-data lineage on an isolated Neon branch and provide the basis for a future shared LoveBud/LoveTree identity authority.

This document records only evidence actually obtained in the branch prototype. It does **not** claim that Firebase migration, password migration, browser SSO, or production cutover is complete.

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
- unique `(provider, provider_subject)` identity mapping;
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

Existing users must prove control of both sides through a secure migration/link flow or another evidence-based migration path.

Google/OAuth users and Email/Password users may require different flows.

### Stage D — provider retirement

Only after account coverage, ownership parity, Login/redirect/logout parity, and rollback evidence are complete can Firebase acceptance be disabled.

## 11. Password migration remains unresolved

This prototype did not export Firebase credential hashes and did not test password-hash import into Neon Auth.

Therefore none of the following can yet be claimed:

```text
PASSWORD_HASH_IMPORT_SUPPORTED_AND_TESTED
FORCED_PASSWORD_RESET_REQUIRED
JUST_IN_TIME_ACCOUNT_LINK_REQUIRED
```

#4006 must obtain explicit evidence before choosing one.

No password/hash conversion should be invented from schema similarity.

## 12. OAuth/shared-login work remains unresolved

This prototype proves Neon Auth can be provisioned on the canonical database lineage without touching production. It does **not** yet prove:

- Google OAuth configuration for LoveBud/LoveTree;
- production redirect/trusted-origin behavior;
- one-login browser SSO across final domains;
- logout propagation across apps;
- session exchange through the proposed shared API/service-binding topology.

Those remain the next runtime prototype.

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

It also reinforces the LoveTree #152 guardrail: do not independently provision a permanent LoveTree Neon Auth authority.

## 14. Interaction with Modal migration

Neon Auth feasibility does not require Modal.

The eventual shared Cloudflare API can validate/consume the selected shared auth session/token and enforce domain authorization before accessing Neon.

Modal remains orthogonal specialized compute and should not become the identity authority.

## 15. Next experiments

The safe next #4006 steps are:

1. inventory Firebase provider counts and ownership coverage read-only;
2. design `app_account` / `app_auth_identity` on a temporary Neon branch;
3. create synthetic **non-production** Neon Auth users and test sign-in/session/JWKS validation;
4. verify token validation from a Cloudflare Worker test seam;
5. test Google OAuth only against approved test origins;
6. determine Email/Password migration strategy from supported credential-import evidence;
7. define shared LoveBud/LoveTree login/redirect topology;
8. only then propose a staged production migration PR.

## 16. Prototype verdict

```text
ITERATE_AUTH_PROTOTYPE
```

Reason:

```text
PASS: branch-local Neon Auth provisioning
PASS: canonical public data preserved on child branch
PASS: production branch remained without neon_auth
PASS: schema proves provider identity must be mapped, not substituted
PENDING: Firebase provider inventory
PENDING: account-link data model branch prototype
PENDING: synthetic signup/login/session validation
PENDING: password migration evidence
PENDING: OAuth/shared-domain SSO validation
```

Neon Auth is a viable shared-auth candidate, but production migration is not yet authorized.

Refs #4004
Refs #4005
Refs #4006
