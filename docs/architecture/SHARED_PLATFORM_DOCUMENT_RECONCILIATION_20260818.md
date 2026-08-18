# Shared Platform Document Reconciliation — 2026-08-18

Scope: LoveBud/LoveTree shared Auth, backend, DB, Runtime E2E, and convergence authority.

This audit separates **architecture decisions** from **dated runtime/provider snapshots**. The architecture is stable; several old `current` state statements are not.

## Executive result

```text
SHARED_AUTH_BACKEND_DATA_ARCHITECTURE = CONSISTENT
FIREBASE_TO_NEON_AUTH_STAGED_DIRECTION = CONSISTENT
SECOND_CANONICAL_LOVETREE_BACKEND = FORBIDDEN
DOCUMENT_CURRENT_STATE_DRIFT = FOUND
E2E_TEST_ISOLATION_VS_PRODUCT_AUTHORITY_AMBIGUITY = FOUND
REMEDIATION_REQUIRED = YES
```

## Authority matrix

| Source | Classification | Finding | Action |
|---|---|---|---|
| LoveBud #4004 | `ARCHITECTURE_DECISION` + stale dated evidence | Shared platform decision is correct. The embedded `36 users / 45 Trees / 287 Memories` and related `public.users` rationale are not current default/deployed DB facts after #4005 reconciliation. | Keep architecture; mark old data snapshot historical and point current data claims to #4005 fresh reconciliation. |
| LoveBud #4005 issue body | `DATA_CONVERGENCE_AUTHORITY` with stale initial snapshot | Body still describes the original 36/45/287 database and LoveTree-only `client_key`/`sort_order` differences. The later #4005 audit found the current default LoveBud `neondb` does not match that snapshot and already has those schema capabilities. | Rewrite current-state section. Preserve old numbers only as historical child-lineage evidence. |
| `canonical-neon-schema-data-convergence-audit-4005.md` | `LATEST_DETAILED_DATA_RECONCILIATION` | Best current repository document for the 2026-08-16 DB audit. It explicitly reclassifies 36/45/287 as non-default-child historical evidence and records current-default catalog findings. | Keep; still require fresh provider query for future mutable work. |
| `canonical-memory-lineage-branch-prototype-4005.md` | `HISTORICAL_PROTOTYPE_EVIDENCE` | Already contains a strong live-reconciliation banner. Prototype result remains valid as executed proof but its snapshot is not current authority. | No destructive edit. Treat as historical prototype. |
| `canonical-memory-lineage-write-contract-4005.md` | `HISTORICAL_CONTRACT_EVIDENCE` | Useful semantic design, but its descriptions of current runtime support predate later #4058/#4059 work and must not be treated as current runtime truth without fresh source inspection. | Preserve as provenance; current runtime claims require fresh source/issue re-read. |
| `cloudflare-neon-runtime-feasibility-audit-4000.md` | `HISTORICAL_FORENSIC_RECONCILED_BY_4004` | Correctly says #4004 superseded dual-backend direction, but its reconciliation section still repeats the old 36/45/287 data-authority snapshot as though current. | Treat that data line as historical; #4005 is current data reconciliation authority. |
| LoveBud #4006 | `AUTH_MIGRATION_AUTHORITY` with stale DB evidence | Shared Firebase → staged Neon Auth architecture is correct. The body’s 36 `public.users` / 34-owner current-state claim is stale for current default/deployed lineage. | Rewrite evidence section; keep stable-account/provider mapping and staged migration model. |
| LoveTree #152 | `LOVETREE_PLATFORM_GUARDRAIL` with stale comparative evidence | Core rule is correct. `LoveBud materially more live state` and `LoveTree newer schema refinements` are no longer safe current claims after #4005 reconciliation. | Rewrite data-evidence section; make canonical choice independent of row-count rhetoric. |
| LoveTree #202 | `TRANSITIONAL_MVP_BRIDGE_AUTHORITY` | Architecture is sound: LoveTree bridge is bounded and portable to shared platform. Embedded SHAs are explicitly historical. | Keep. Add future worker preflight reference where needed. |
| LoveTree #67 | `TEST_ISOLATION_E2E_AUTHORITY` | Safety requirement for non-Production disposable identity is valid, but wording can be misread as authorization to build a new LoveTree Product Auth/DB/Worker stack. | Reframe dedicated resources as `TEST_ISOLATION_ONLY`; require shared-platform architecture preflight before provider mutation. |
| LoveTree #201 | `MVP_COORDINATION_AUTHORITY` | Does not choose a second backend, but infrastructure workers can operate from child issues without rereading #4004/#152. | Add mandatory cross-repo architecture gate for Auth/DB/provider work. |

## Current architecture facts that must not drift

```text
PRODUCT_AUTH_AUTHORITY_COUNT = 1
PRODUCT_BACKEND_API_AUTHORITY_COUNT = 1
CANONICAL_WRITABLE_TREE_MEMORY_SOCIAL_DATA_AUTHORITY_COUNT = 1
CURRENT_AUTH_DURING_MIGRATION = FIREBASE
TARGET_AUTH_CANDIDATE = NEON_AUTH
AUTH_MIGRATION = STAGED_PROVIDER_NEUTRAL_ACCOUNT_MAPPING
LOVETREE_SEPARATE_DB = TRANSITIONAL_BRIDGE_NONCANONICAL
```

## Snapshot rule

The following is **not** a current-default architecture fact:

```text
36 users / 45 Trees / 287 Memories
```

It is historical non-default-child lineage evidence. Any future document using those numbers must label the exact branch/resource and observation date.

Likewise, current row counts must never decide architecture. The canonical/shared authority decision comes from #4004/#152 and security/runtime convergence evidence, not whichever database happens to contain more rows on a given day.

## E2E rule

A separate E2E Firebase project, Worker, or Neon branch may be useful for mutation safety. It remains:

```text
TEST_ISOLATION_ONLY
```

and cannot implicitly authorize:

```text
NEW_LOVETREE_PRODUCT_AUTH
NEW_LOVETREE_CANONICAL_DB
NEW_PERMANENT_LOVETREE_BACKEND
PRODUCT_CUTOVER
```

## Preventive controls

1. New normative shared-platform authority document in both repositories.
2. Machine-readable authority manifest in both repositories.
3. Mandatory `ARCHITECTURE_CONSISTENCY_GATE` before Auth/DB/provider/E2E infrastructure mutation.
4. Mandatory resource classification before mutation.
5. Fresh-query requirement for provider state, row counts, branch IDs, SHAs, PR heads, and deployment identities.
6. Worker prompts must explicitly read #4004/#152 and #4005/#4006 when relevant.
7. Historical/prototype docs stay as provenance but are not current authority.
8. Issue bodies containing stale `current` claims should be corrected rather than relying only on later comments.

## Required worker report fields

```text
PARENT_4004_READ
LOVETREE_152_READ
DATA_4005_READ_IF_RELEVANT
AUTH_4006_READ_IF_RELEVANT
CURRENT_REMOTE_FRESH
CURRENT_PROVIDER_IDENTITY_FRESH_IF_RELEVANT
RESOURCE_CLASS
SECOND_CANONICAL_WRITER_CREATED = NO
SECOND_PRODUCT_AUTHORITY_CREATED = NO
TEST_RESOURCE_PROMOTED_TO_PRODUCT = NO
ARCHITECTURE_CONSISTENCY_GATE = PASS/STOP
```

No Product/provider mutation was performed by this documentation audit.
