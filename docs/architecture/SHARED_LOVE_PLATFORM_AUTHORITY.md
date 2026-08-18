# Shared Love Platform Authority — LoveBud + LoveTree

Status: **NORMATIVE CROSS-REPOSITORY ARCHITECTURE GUARDRAIL**  
Owner authority: `skerishKang/LoveBud#4004`  
LoveTree mirror/guardrail: `skerishKang/lovetree-limone#152`  
Data/schema reconciliation: `skerishKang/LoveBud#4005`  
Auth migration: `skerishKang/LoveBud#4006`  
Shared API foundation: `skerishKang/LoveBud#4094`

## 1. Immutable product architecture invariants

Unless the Product Owner explicitly changes the architecture, all implementation, test, provider, deployment, and migration work must preserve these invariants:

```text
LoveBud + LoveTree
= ONE product identity authority
= ONE shared backend/API authority
= ONE canonical writable Tree/Memory/social data authority
```

Target topology:

```text
LoveBud frontend ─┐
                  ├─ same-origin adapter / Service Binding
LoveTree frontend ┘
          ↓
shared love-platform-api
          ↓
canonical Neon data authority
```

The separate `lovetree-limone` database may remain temporarily for compatibility/MVP proving, but it is **TRANSITIONAL_BRIDGE_NONCANONICAL**. It must not be expanded into a second permanent canonical backend.

## 2. Authentication authority

Current product identity provider during migration:

```text
Firebase Auth
```

Target candidate:

```text
Neon Auth
```

Migration mode:

```text
STAGED / PROVIDER-NEUTRAL ACCOUNT MAPPING
NOT BIG-BANG
```

Business ownership must converge through a stable product account boundary such as:

```text
app_account
  ├─ auth_identity(provider=firebase, subject=<legacy uid>)
  └─ auth_identity(provider=neon, subject=<neon auth subject>)
```

A Neon Auth prototype, branch, test tenant, or E2E identity does **not** become Product authority merely because it exists.

## 3. Resource classification is mandatory before mutation

Before creating, configuring, binding, deploying, deleting, or reusing any Firebase, Neon, Cloudflare, Auth, Worker, database, secret, route, or account resource, classify it as exactly one of:

```text
CANONICAL_PRODUCT_AUTHORITY
TRANSITIONAL_BRIDGE_NONCANONICAL
TEST_ISOLATION_ONLY
PROTOTYPE_ONLY
HISTORICAL_EVIDENCE_ONLY
UNKNOWN_STOP
```

`UNKNOWN_STOP` means zero mutation until classification is resolved.

### Test isolation rule

A resource created for an E2E issue may be intentionally separate from Product infrastructure. That is allowed only as:

```text
TEST_ISOLATION_ONLY
```

It must never be interpreted as authorization to create:

- a second LoveTree Product auth authority;
- a second permanent LoveTree canonical database;
- a second permanent shared API authority;
- a new Product account namespace;
- a Production cutover.

Therefore:

```text
DEDICATED_E2E_FIREBASE != NEW_PRODUCT_AUTHORITY
ISOLATED_E2E_WORKER != NEW_SHARED_BACKEND
DISPOSABLE_NEON_BRANCH != NEW_CANONICAL_DB
```

## 4. Authority resolution order

When documents, issue bodies, comments, reports, code, or provider state disagree, resolve authority in this order:

1. **Latest explicit Product Owner architecture decision.**
2. **Current parent architecture authority:** LoveBud `#4004` + LoveTree `#152`.
3. **Fresh current provider/repository evidence** for the exact resource being acted on.
4. **Latest specialized convergence authority:** `#4005` for DB/schema/data, `#4006` for auth, current shared-API child for backend runtime.
5. Latest issue/PR correction comment that explicitly supersedes older state.
6. Current issue body when it is not marked historical/stale.
7. Historical issue comments, old reports, old SHAs, prototypes, and snapshots — evidence only.

A lower layer must never silently override a higher layer.

## 5. Snapshot freshness rule

Counts, branch IDs, SHAs, provider project contents, schemas, PR heads, and deployment identities are **observations**, not architecture.

Before using any such value as current authority:

```text
FRESH_QUERY_REQUIRED = YES
```

Historical example that caused confusion:

```text
36 users / 45 Trees / 287 Memories
```

That snapshot was later reconciled as **non-default child-lineage historical evidence**, not the current default/deployed LoveBud database state. Any document that still contains those numbers without that qualifier must be treated as stale state evidence.

Architecture decisions such as “one shared backend/auth/data authority” remain valid independently of changing row counts.

## 6. Mandatory architecture consistency gate for Auth/DB/Provider work

Any worker touching or planning Auth, Firebase, Neon, Cloudflare Worker, database, provider config, shared API, Production/Preview routes, or E2E infrastructure must complete this gate **before mutation**:

```text
ARCHITECTURE_CONSISTENCY_GATE

PARENT_4004_READ = YES
LOVETREE_152_READ = YES
DATA_4005_READ_IF_RELEVANT = YES/NA
AUTH_4006_READ_IF_RELEVANT = YES/NA
CURRENT_REMOTE_FRESH = YES
CURRENT_PROVIDER_IDENTITY_FRESH = YES/NA
RESOURCE_CLASS = <one classification>
SECOND_CANONICAL_WRITER_CREATED = NO
SECOND_PRODUCT_AUTHORITY_CREATED = NO
TEST_RESOURCE_PROMOTED_TO_PRODUCT = NO
PRODUCT_CUTOVER_EXPLICITLY_AUTHORIZED = YES/NO
ARCHITECTURE_CONSISTENCY_GATE = PASS/STOP
```

If the gate is `STOP`, no provider or database mutation may proceed.

## 7. Worker prompt rule

Every future worker prompt involving Auth/DB/provider/backend infrastructure must contain, near the top:

```text
READ FIRST — CROSS-REPO ARCHITECTURE
LoveBud#4004
LoveTree#152
LoveBud#4005 when DB/schema/data is involved
LoveBud#4006 when auth/identity is involved

Do not infer Product authority from an E2E/prototype resource.
Classify every target resource before mutation.
```

The worker must report the completed architecture consistency gate in its final report.

## 8. Current-state document hygiene

Documents must distinguish:

```text
ARCHITECTURE_DECISION
CURRENT_RUNTIME_STATE
PROTOTYPE_STATE
TEST_ISOLATION_STATE
HISTORICAL_SNAPSHOT
```

Do not use the word `current` for a dated provider/database observation unless it is fresh-verified in that work session.

When a later reconciliation invalidates a snapshot, the old document must either:

- be corrected; or
- carry an explicit `HISTORICAL_SNAPSHOT / NOT CURRENT AUTHORITY` banner.

## 9. Specific #67 interpretation

LoveTree Issue `#67` is an E2E acceptance lane. Any dedicated Firebase/Worker/Neon resource used there is **test isolation only**.

It does not change these Product facts:

```text
CURRENT_PRODUCT_AUTH_DURING_MIGRATION = SHARED_FIREBASE_AUTH
TARGET_AUTH = STAGED_NEON_AUTH_MIGRATION
TARGET_BACKEND = SHARED_LOVE_PLATFORM_API
TARGET_CANONICAL_DATA = ONE_SHARED_NEON_AUTHORITY
```

If #67 can be executed against a safe representative shared-platform non-Production topology without weakening isolation, prefer that over inventing a parallel Product stack. If a dedicated test tenant is necessary, keep it quarantined and non-authoritative.

## 10. Merge/cutover rule

A green test, isolated provider deployment, prototype, or exact-head CI result proves only its stated scope.

It never implicitly authorizes:

```text
PRODUCT_AUTH_CUTOVER
CANONICAL_DB_CUTOVER
SHARED_API_PRODUCTION_ROUTING
FIREBASE_RETIREMENT
LOVETREE_DB_PROMOTION
```

Those require explicit Product/Integration authority after current-state parity and rollback evidence.
