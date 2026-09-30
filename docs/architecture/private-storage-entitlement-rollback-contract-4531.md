# Private-Storage Entitlement Rollback Contract (#4531)

```text
Authority: refs #4531 #4000 #4004 #4422 #4425 #4390
Class: SOURCE_ONLY_CONTRACT (docs + contract test only)
Runtime change: NONE
Gate value change: NONE
Production DB read/write: NONE
Firestore / provider / Cloudflare / Modal mutation: NONE
Matrix binding: docs/architecture/direct-neon-readiness-matrix-4311.json (authoritative JSON)
Matrix rendering: docs/architecture/DIRECT_NEON_READINESS_MATRIX_4311.md
Contract doc: docs/architecture/private-storage-entitlement-rollback-contract-4531.md
Guard contract test: tests/contracts/private-storage-entitlement-rollback-parity-4531.test.cjs
```

## 1. Purpose

Private-storage Product routes are Production-live on Direct-Neon behind per-route runtime
gates. Every one of those routes still has a retained Modal path that becomes active if the
gate is removed or unset. The retained Modal path decides private-storage entitlement from a
different authority than Direct-Neon.

This contract records, mechanically and in checked-in source, that:

```text
removing or unsetting a private-storage runtime gate
is a TECHNICAL ROUTING ROLLBACK.

It is NOT currently a BUSINESS-SEMANTICS-PRESERVING rollback,
because the retained Modal entitlement rule is not equivalent
to the canonical Neon entitlement rule.
```

This is a documentation and guard-test slice. It changes no runtime behavior, no gate value,
and no historical live evidence.

## 2. Non-goals (explicit)

```text
Modal -> Neon config, credential, or client rewrite: NOT IN SCOPE
modal_compute/auth.py semantics rewrite: NOT IN SCOPE
modal_compute/tree_writes.py / memory_writes.py transaction refactor: NOT IN SCOPE
functions/_shared/private-storage-entitlement-neon.js change: NOT IN SCOPE
wrangler.toml / .env.example gate change: NOT IN SCOPE
Production DB connection, SQL, DDL/DML: NOT IN SCOPE
Firestore or any provider readback: NOT IN SCOPE
Cloudflare / Modal deploy or mutation: NOT IN SCOPE
Product canary: NOT IN SCOPE
```

Making the retained Modal path entitlement-equivalent to Direct-Neon requires a separate
implementation authority that also resolves the ordering and transaction-scope gaps recorded
in section 4. This contract deliberately does not attempt it.

## 3. Canonical entitlement authority (Direct-Neon)

Source of truth:

```text
filesystem: functions/_shared/private-storage-entitlement-neon.js
export:     PRIVATE_STORAGE_ENTITLEMENT_NEON_CONTRACT
SQL:        SELECT private_storage_enabled FROM public.users WHERE id = $1 LIMIT 1 FOR SHARE;

sourceOfTruth        = neon.public.users.private_storage_enabled
truthRule            = strict-boolean-true
defaultEntitled      = false
transactionScoped    = true          (caller passes an already-open Direct-Neon transaction)
rowLock              = FOR SHARE     (entitlement row read under the same transaction)
firestoreRequired    = false
serviceAccountRequired = false
cache                = none
```

Evaluation rule (as implemented):

```text
result.entitled = (row?.private_storage_enabled === true)

true                        -> ENTITLED
false                       -> NOT ENTITLED (fail closed)
null                        -> NOT ENTITLED
missing column / missing row-> NOT ENTITLED
malformed (e.g. 1, "true")  -> NOT ENTITLED (strict boolean identity, no truthiness/coercion)
query failure (tx.query throws) -> PrivateStorageEntitlementError(UNAVAILABLE),
                                   never collapsed into "free user"
invalid principal           -> PrivateStorageEntitlementError(PRINCIPAL_INVALID)
```

Key properties for rollback reasoning:

```text
ENTITLEMENT_BEFORE_MUTATION    = YES on the Direct-Neon path (the helper is called inside the
                                 same transaction that performs the write)
ENTITLEMENT_SCOPE              = same Direct-Neon transaction as the mutation
ENTITLEMENT_ROW_LOCK           = FOR SHARE
AVAILABILITY_FAILURE_IS_NOT_FREE = YES (query failure fails closed as UNAVAILABLE)
```

## 4. Retained Modal path (legacy compatibility authority)

Source of truth:

```text
filesystem: modal_compute/auth.py
function:   user_has_plus_entitlement(uid)  (gate: require_plus_for_private_storage(uid, visibility))

sourceOfTruth   = firestore users/{uid}
firestoreRead   = get_firestore_client().collection("users").document(uid).get()
no-document     = NOT ENTITLED (snapshot.exists is False -> return False)
read failure    = EntitlementCheckUnavailableError (never collapsed into "free user")
```

Allow rule (ANY of the following, evaluated in this order):

```text
privateStorageEnabled truthy   (is_entitlement_truthy: True | 1 | "true" | "1")
plan == "plus"  or  plan == "admin"
plus truthy
entitlements.privateStorage truthy
```

Structural divergences from the Direct-Neon authority:

```text
1. DIFFERENT SOURCE        : Firestore users/{uid} vs Neon public.users row.
2. DIFFERENT TRUTH RULE    : Firestore multi-field truthiness/legacy aliases vs strict boolean
                             identity on a single Neon column. Modal allows 1 / "true" / "1"
                             and three legacy plan/flag aliases; Neon allows only boolean true.
3. MULTIPLE ALLOW FIELDS   : a legacy plan or flag field can grant entitlement even when the
                             canonical Neon column says false.
4. NO TRANSACTION SCOPE    : modal_compute write helpers do not pass a write transaction into
                             the entitlement helper, so the Modal entitlement read is not
                             bound to the same transaction as the mutation.
5. ORDERING DIFFERENCE     : on the Modal Tree Create path ensure_owner_user_exists(...) runs
                             BEFORE the entitlement check, whereas the Direct-Neon path checks
                             entitlement before mutation inside one transaction.
```

Consequently a mechanical `auth.py` -> `SELECT public.users.private_storage_enabled` rewrite
would not by itself prove parity: it would still leave the transaction-scope and
ordering differences above unresolved.

## 5. Symbolic truth table (source behavior, synthetic only)

No user/profile data, provider call, or Production read is used to build this table. Each cell
is the outcome of the checked-in source rule for a synthetic input pair.

| Case | Direct-Neon (canonical) | Retained Modal (legacy) |
|---|---|---|
| Neon `private_storage_enabled = true`, Firestore document empty/free | ALLOW | DENY |
| Neon `false`, Firestore `privateStorageEnabled = true` | DENY | ALLOW |
| Neon `false`, Firestore `plan = "plus"` | DENY | ALLOW |
| Neon `false`, Firestore `plan = "admin"` | DENY | ALLOW |
| Neon `false`, Firestore `plus = true` | DENY | ALLOW |
| Neon `false`, Firestore `entitlements.privateStorage = true` | DENY | ALLOW |
| Neon `false`, Firestore `privateStorageEnabled = 1` or `"true"` | DENY (strict identity) | ALLOW (truthy coercion) |
| Both non-entitled (Neon `false`/`null`/missing, Firestore free/empty) | DENY | DENY |
| Firestore document absent, Neon `true` | ALLOW | DENY |
| Neon entitlement read unavailable (query failure) | UNAVAILABLE | depends on the independent Firestore result |
| Firestore unavailable while Neon `true` | ALLOW on Direct-Neon | UNAVAILABLE on Modal |
| public / non-private request (visibility != private) | entitlement lookup skipped | entitlement lookup skipped |

Both mismatch directions exist:

```text
ROLLBACK_CAN_WIDEN_ELIGIBILITY = YES
  witness: Neon private_storage_enabled = false, Firestore plan = "plus"
           Direct-Neon DENY  ->  retained Modal ALLOW
           (also: Neon false + any legacy alias field)

ROLLBACK_CAN_NARROW_ELIGIBILITY = YES
  witness: Neon private_storage_enabled = true, Firestore document free/empty (or absent)
           Direct-Neon ALLOW ->  retained Modal DENY
```

Therefore gate rollback is a routing change with a Product-visible entitlement decision
difference in both directions.

## 6. Required conclusions

```text
CANONICAL_PRODUCT_ENTITLEMENT_AUTHORITY          = neon.public.users.private_storage_enabled
DIRECT_NEON_RULE                                 = strict boolean true
DIRECT_NEON_TRANSACTION_SCOPED                   = YES
DIRECT_NEON_ROW_LOCK                             = FOR SHARE
MODAL_ENTITLEMENT_AUTHORITY                      = firestore users/{uid}
MODAL_LEGACY_COMPATIBILITY_RULE                  = FIRESTORE_MULTI_FIELD_LEGACY
DIRECT_NEON_MODAL_ENTITLEMENT_PARITY             = NOT_PROVEN_DIVERGENT_BY_SOURCE
TECHNICAL_GATE_ROLLBACK_AVAILABLE                = YES
BUSINESS_SEMANTICS_PRESERVING_ROLLBACK           = NO
BUSINESS_SEMANTICS_EQUIVALENCE                   = NOT_PROVEN
ENTITLEMENT_PARITY_STATUS                        = NOT_PROVEN_DIVERGENT_BY_SOURCE
CENTRAL_REVIEW_REQUIRED_BEFORE_PRIVATE_ROLLBACK  = YES
ROLLBACK_REQUIRES_CENTRAL_REVIEW                 = YES
```

## 7. Technical routing rollback vs business semantics rollback

These two statements are separate and must not be merged:

```text
TECHNICAL:  the gate can be removed/unset, dispatch falls back to the retained Modal path,
            and no DB, ACL, schema, or entitlement-column rollback is required merely for
            that routing change.                            -> TRUE

BUSINESS:   the retained Modal path decides private-storage entitlement differently from the
            canonical Neon authority, so the same route can flip its entitlement decision for
            the same principal.                             -> NOT EQUIVALENT
```

So `GATE_ONLY_ROLLBACK` may not stand alone for a private entitlement-dependent route. Every
such matrix row must additionally carry:

```text
TECHNICAL_GATE_ROLLBACK_AVAILABLE=YES
BUSINESS_SEMANTICS_PRESERVING_ROLLBACK=NO
BUSINESS_SEMANTICS_EQUIVALENCE=NOT_PROVEN
ENTITLEMENT_PARITY_STATUS=NOT_PROVEN_DIVERGENT_BY_SOURCE
CENTRAL_REVIEW_REQUIRED_BEFORE_PRIVATE_ROLLBACK=YES
```

The marker set above is the smallest change that fits the existing matrix field structure:
it is appended to the existing per-route `rollback_authority` string and the rendered
`next action` cell, and it introduces no new repository-wide enum or vocabulary block.

## 8. Affected private entitlement-dependent routes

```text
matrix row id                    runtime gate
tree-private-create              LB_TREE_PRIVATE_CREATE_WRITE_RUNTIME
tree-private-visibility-update   LB_TREE_PRIVATE_VISIBILITY_WRITE_RUNTIME
memory-private-create            LB_MEMORY_PRIVATE_CREATE_WRITE_RUNTIME
memory-private-visibility-update LB_MEMORY_PRIVATE_VISIBILITY_WRITE_RUNTIME
```

Each of these routes evaluates the private-storage entitlement guard on the Direct-Neon path
and, when the gate is unset, falls back to a retained Modal path that evaluates the legacy
Firestore rule. Every one of them is covered by the guard above, and the guard contract test
fails if any of these rows loses the semantics caveat.

Routes without private-storage entitlement dependence (for example anonymous public reads, or
private-write routes with no entitlement guard) are out of scope and are not required to carry
the marker set.

## 9. Historical live evidence is preserved, not re-litigated

This contract does not invalidate, downgrade, or rewrite any historical activation evidence:

```text
PRODUCTION_LIVE                        retained
LIVE_GATE_VERIFIED                     retained
provider / deployment readback PASS     retained
Product non-Plus 403 proof              retained
Product Plus-positive lifecycle proof   retained
bounded temporary entitlement DML + mandatory restore evidence  retained
exact-main SHAs and CENTRAL comment ids retained
```

Two facts hold at the same time and this contract asserts both:

```text
1. the Direct-Neon private routes are Production-live at their cited exact-head evidence; and
2. their retained Modal rollback entitlement semantics are not equivalent to the canonical
   Direct-Neon entitlement semantics.
```

Nothing here changes a matrix classification other than adding the rollback-semantics guard to
`rollback_authority`; `source_state`, `source_parity`, `privilege_state`, `live_provider_state`,
`checked_in_gate`, `live_gate_state`, `production_live`, and `disposition_4239` are untouched.

## 10. Mutation accounting for this slice

```text
PRODUCTION_CONNECTION_COUNT = 0
PRODUCTION_READ_COUNT       = 0
PRODUCTION_WRITE_COUNT      = 0
SQL / DDL / DML             = 0
FIRESTORE_READ/WRITE        = 0
PROVIDER_MUTATION_COUNT     = 0
CLOUDFLARE_MUTATION_COUNT   = 0
MODAL_MUTATION_COUNT        = 0
DEPLOY_COUNT                = 0
GATE_VALUE_CHANGED          = NO
RUNTIME_CODE_CHANGED        = NO
SECRET_VALUE_EXPOSED        = NO
```

## 11. Unresolved / future authority

```text
UNRESOLVED: proving or implementing Modal -> Neon entitlement equivalence
            (source rewrite + transaction-scope + entitlement-before-mutation ordering)
            requires a separate implementation authority and is NOT authorized here.

UNRESOLVED: whether the retained Firestore legacy entitlement aliases
            (privateStorageEnabled / plan / plus / entitlements.privateStorage)
            should be dropped, migrated, or mapped to the canonical Neon column
            is a Product/ops decision tracked as a separate contract-needed item.

NEXT_CENTRAL_ACTION: review this contract, the matrix guard rows, and the guard test;
                     approve or reject the markers before any private-route gate rollback
                     is treated as business-semantics-preserving.
```
