# Ephemeral Production Diagnostic Activation Contract (#4311)

```text
Authority: refs #4000 #4004
Predecessors: #4239 (readiness reconciliation), #4295/#4304 (source-only reconciliation helper),
  #4297 (consumed historical activation), #4283 (HOLD that motivated this contract),
  PR #4312 (ephemeral activation candidate pattern), PR #4313 (runtime-role ACL attestation runner)
Refs #1882 — KEEP OPEN.
Classification: ARCHITECTURE CONTRACT. This document authorizes no Production connection,
  no GRANT/REVOKE, no DML/DDL, no deployment, and no gate activation by itself.
```

## 1. Problem

The Direct-Neon migration separates eight distinct states:

```text
source helper exists
source CI green
runtime parity proven
DB privilege proven
checked-in Production gate
live Cloudflare state
Production diagnostic execution authority
post-cutover attestation
```

That separation is correct. What was missing is a single repeatable activation
mechanism for **ephemeral, one-session Production diagnostics** tied to the exact
current `main` SHA. #4283 demonstrated the failure mode: a Production read-only
catalog session discovered an unmapped grantee, failed closed, the reviewed #4295
helper is source-only by design, and the only activation approval (#4297) was
consumed on an older head. Current `main` therefore carried no reusable execution
authority, and every future reconciliation would re-derive ad-hoc rules about which
historical approval, branch, gate, and private mapping state may be reused.

## 2. Authoritative matrix

`docs/architecture/direct-neon-readiness-matrix-4311.json` is the single current
registry for every Direct-Neon Product route candidate under #4000. Rules:

1. Every route has exactly one current value per state dimension.
2. Every value is bound to an `as_of_main_sha` or a cited evidence ref.
3. `SOURCE_READY` never implies `RUNTIME_READY`; `RUNTIME_READY` never implies
   `PRIVILEGE_READY`; `PRIVILEGE_READY` never implies `PRODUCTION_CONFIGURED`;
   `PRODUCTION_CONFIGURED` never implies `LIVE_PROVEN`; `LIVE_PROVEN` never
   implies `PRODUCTION_LIVE` for sibling routes.
4. `DIAGNOSTIC_EXECUTION_AUTHORIZED` is only ever set by a fresh owner approval
   recorded on the owning issue at the exact current main SHA, and is immediately
   `CONSUMED` after one session or `INVALIDATED_STALE_MAIN` after any main movement.
5. Historical approvals and historical dispositions (the `disposition_4239` field)
   are audit evidence only. They are never executable authority.
6. A route with no gate is classified explicitly (including `KEEP_MODAL_BY_DESIGN`)
   rather than left to inference from absence.
7. The matrix is updated in the same PR that changes any classified state, and the
   contract test fails if a Direct-Neon helper or `LB_*_RUNTIME` gate exists on
   `main` without exactly one matrix entry.

State vocabulary (per dimension):

```text
source_state:      SOURCE_READY | SOURCE_IN_PROGRESS | SOURCE_MISSING | KEEP_MODAL_BY_DESIGN
source_parity:     PASS_AT_CITED_SHA | NOT_FRESHLY_PROVEN
runtime_state:     RUNTIME_PROVEN_AT_CITED_SHA | NOT_FRESHLY_PROVEN
privilege_state:   PRIVILEGE_PROVEN_AT_CITED_SHA | PRIVILEGE_UNPROVEN | PRIVILEGE_BLOCKED
checked_in_gate:   CHECKED_IN_PRODUCTION_GATE | NOT_CHECKED_IN
live_provider:     LIVE_PROVEN_AT_CITED_SHA | NOT_FRESHLY_VERIFIED
live_gate_state:   LIVE_GATE_VERIFIED | LIVE_GATE_READ_REQUIRED | LIVE_GATE_NOT_INTENDED
diagnostic_auth:   AUTHORIZED_ONE_SESSION_AT_CITED_SHA | NOT_AUTHORIZED | CONSUMED | INVALIDATED_STALE_MAIN
production_live:   PRODUCTION_LIVE | NOT_PRODUCTION_LIVE
```

## 3. Ephemeral activation lifecycle

A Production diagnostic session executes only through this lifecycle. Each phase is
gated; skipping a phase is a contract violation and must fail closed.

```text
P0 REQUEST
   Owning issue (e.g. #4283) states: exact current main SHA, helper path,
   credential boundary, object allowlist, session bound, and expected sanitized
   evidence. Zero Production contact.

P1 CANDIDATE
   From the exact main SHA, create an unmerged ephemeral branch whose only source
   delta flips the reviewed helper's
   PRODUCTION_*_EXECUTION_ENABLED gate to true and binds a source-fixed
   approval reference (issue:<n> | decision:<id>). No other source change.
   The helper must reject any approval reference that is not the source-bound one
   before reading any private input or opening any session.

P2 GATE
   Push the candidate, obtain exact-head CI green, and obtain independent review.
   The candidate PR remains DRAFT and is never merged. Merging any flipped gate
   into main is prohibited.

P3 AUTHORIZATION
   The owner posts exactly one approval comment binding:
   the candidate head SHA, the approval reference, the session count (= 1),
   and the permitted outcome classes. Authority exists only at that head SHA.

P4 EXECUTION
   One bounded session using only:
     current main exact SHA (or the reviewed candidate head for the flipped gate)
     reviewed source-only helper
     existing dedicated Production-readonly credential boundary
     existing private role mapping
     fixed object/catalog allowlist
     BEGIN READ ONLY
     transaction_read_only = on verification
     ROLLBACK
     forced disconnect
     sanitized stdout (counts/categories only)
     private-only artifacts under .secrets/** (raw role/grantee identifiers)
   The candidate must not accept caller-controlled host, port, user, password,
   connection string, SQL, object list, or schema/table override.

P5 ATTESTATION
   Record the standardized outcome on the owning issue:
     DIAGNOSTIC_EXECUTED_CLEAN          session ran, allowlist honored, rollback+disconnect proven
     DIAGNOSTIC_FAIL_CLOSED             bounded refusal before or at connect; no mutation possible
     DIAGNOSTIC_EVIDENCE_INCONCLUSIVE   ran but evidence incomplete; no state may advance
     DIAGNOSTIC_UNEXPECTED_FAIL         contract-violating behavior; triggers immediate cleanup + review
   Any unmapped grantee result routes to the #4295 reconciliation helper through a
   fresh P0–P4 cycle; it never extends the current session's authority.

P6 CLEANUP
   Deterministic, same-day:
     mark the approval comment CONSUMED on the owning issue,
     close (never merge) the candidate PR,
     delete the ephemeral branch,
     confirm main contains no flipped gate,
     update the matrix row's last_exact_head_evidence and diagnostic_auth.
```

## 4. Invalidation rules

```text
MAIN_MOVED      any new main commit after P3 invalidates unconsumed authority;
                the candidate must be re-created from the new SHA (P1 restart).
CONSUMED        one approval authorizes exactly one session; reuse is prohibited
                even at the same SHA.
SUPERSEDED      a newer approval on the same issue replaces the older one; the
                older comment becomes HISTORICAL_EVIDENCE_ONLY.
LEAKAGE         any raw role/grantee/credential identifier outside .secrets/**
                in stdout, logs, issues, or committed files is an immediate
                DIAGNOSTIC_UNEXPECTED_FAIL and cleanup trigger.
```

PR #4312 is the reference example of a superseded candidate: it is source-bound to
`issue:4295` at base `78318d5c…`; current main has moved, so its execution authority
is `INVALIDATED_STALE_MAIN` even though its branch still exists. It must not be
re-merged, re-based into authority, or executed without a fresh P1–P4 cycle.

## 5. Architecture invariants preserved

```text
Cloudflare = primary web/API runtime
Neon       = canonical relational Product data authority
Firebase   = current Product auth authority during migration
Modal      = specialized compute only where justified; retained routes are listed
             explicitly in the matrix, never inferred from absence
```

This contract never authorizes: replacing Neon, shutting down Firebase, globally
removing Modal, introducing Redis by default, creating a second writable Product
authority, activating every Direct-Neon gate at once, or mutating Production to
populate the matrix.

## 6. Completion criteria mapping

| #4311 criterion | Mechanism |
|---|---|
| 1 current authoritative matrix | `direct-neon-readiness-matrix-4311.json` + this contract |
| 2 exactly one classification per route | contract test enforces uniqueness per dimension |
| 3 no reuse after main movement/consumption | §4 invalidation rules, enforced by P3 head-SHA binding |
| 4 one-session diagnostic without touching main | P1–P6 lifecycle on an unmerged ephemeral branch |
| 5 explicit #4283-style path | unmapped-grantee → fresh #4295-helper cycle via P0–P4 |
| 6 no Product mutation from diagnostics | §3 P4 safety model; helper-level source-bound gate + READ ONLY + rollback |
| 7 standardized evidence/attestation | P5 outcome vocabulary + sanitized stdout + private artifacts |
| 8 explicit Modal-retained routes | matrix `modal_retained_by_design` + KEEP_MODAL_BY_DESIGN |
| 9 gates and live state tracked separately | `checked_in_gate` vs `live_gate_state` vs `live_provider_state` |
| 10 survives main movement | `as_of_main_sha` binding + contract test + INVALIDATED_STALE_MAIN |

## 7. Related repository assets

```text
scripts/run-production-readonly-role-mapping-reconciliation.cjs   #4295 source-only helper
scripts/role-mapping-reconciliation-core.cjs                      reconciliation core
scripts/run-production-readonly-runtime-role-acl-attestation.cjs   #4283/#4313 ACL attestation runner
scripts/run-production-readonly-catalog-collection.cjs            catalog collection runner
docs/architecture/db-schema-change-inventory.json                 runner inventory registration
tests/contracts/direct-neon-readiness-matrix-contract.test.cjs    matrix structural authority
```
