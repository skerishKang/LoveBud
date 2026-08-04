# Source-Only Pre-Change Recovery Gate Contract

Source-only contract for Issue #3880 (first bounded recovery child under #3460).
This document defines the bounded boundary of the source-only pre-change recovery
gate decision core. It is a source/architecture contract; it performs no provider
binding, no database connection, no SQL, no snapshot/branch/restore/reset action,
and no Production mutation.

Refs #3880, #3460, #3878, #1882.

## 1. Source-only authority

The core is a pure, deterministic, descriptor-safe, fail-closed decision authority.
It consumes only bounded sanitized recovery evidence and decides whether risky
database operations may proceed at the source level.

`RECOVERY_GATE_CONFIRMED` means only that bounded source-level recovery
prerequisites are modeled as satisfied for a later separately approved operator
action. It does not prove any of the following:

```text
a live snapshot exists
provider capability is confirmed
a restore is possible
any Production mutation is approved
```

The core never contacts a provider, never reads a secret or environment variable,
never opens a network or database connection, never creates a snapshot or branch,
never performs a restore or reset, and never mutates Production. All nine
capability flags are fixed `false` in every result:

```text
provider_contacted: false
secret_read: false
network_performed: false
database_connected: false
snapshot_created: false
branch_created: false
restore_performed: false
reset_performed: false
production_mutated: false
```

## 2. Exact input schema

The core accepts exactly the following own enumerable data properties and nothing
else. Unknown keys, unknown enum values, accessors, Proxy `get` traps, inherited
fields, and hostile thrown objects are rejected without being read.

```text
policy_version                             "1.0"
operation_risk_class                       TIER_1 | TIER_2 | TIER_3
provider_capability_status                 PROVIDER_CAPABILITY_CONFIRMED | PROVIDER_CAPABILITY_UNVERIFIED
recovery_point_status                      RECOVERY_POINT_VALID | RECOVERY_POINT_STALE | RECOVERY_POINT_MISSING | RECOVERY_POINT_STATUS_UNKNOWN
recovery_point_age_class                   AGE_WITHIN_RPO | AGE_EXCEEDS_RPO
retention_class                            RETENTION_CONFIRMED | RETENTION_UNVERIFIED | RETENTION_ABSENT
restore_drill_status                       RESTORE_DRILL_CONFIRMED | RESTORE_DRILL_NOT_CONFIRMED | RESTORE_DRILL_OVERDUE
restore_target_class                       RESTORE_TARGET_ISOLATED_COPY | RESTORE_TARGET_NON_PRODUCTION | RESTORE_TARGET_UNVERIFIED
schema_verification_status                 PRESENT | ABSENT | UNVERIFIED
relational_verification_status             PRESENT | ABSENT | UNVERIFIED
approval_status                            PRESENT | ABSENT | UNVERIFIED
```

The operation risk classes are the exact bounded tiers of
`docs/ops/WORK_RISK_TIER_POLICY.md` (Tier 1 low / Tier 2 medium / Tier 3 high).
The recovery policy applies its pre-change gate to Tier 3 and destructive
operations (`docs/ops/DATABASE_SNAPSHOT_RETENTION_RESTORE_DRILL_POLICY.md` §4, §6).

Forbidden input (never accepted, never read):

```text
timestamp
snapshot ID
branch ID
project/account/database ID
host
port
URL
credential
operator identity
row data
raw provider response
raw error
free-form metadata
unknown key
```

## 3. Exact result vocabulary

```text
RECOVERY_GATE_CONFIRMED
RECOVERY_GATE_BLOCKED_PROVIDER_CAPABILITY
RECOVERY_GATE_BLOCKED_RECOVERY_POINT_MISSING
RECOVERY_GATE_BLOCKED_RECOVERY_POINT_STALE
RECOVERY_GATE_BLOCKED_RECOVERY_POINT_UNKNOWN
RECOVERY_GATE_BLOCKED_RESTORE_DRILL_OVERDUE
RECOVERY_GATE_BLOCKED_SCHEMA_VERIFICATION
RECOVERY_GATE_BLOCKED_RELATIONAL_VERIFICATION
RECOVERY_GATE_BLOCKED_APPROVAL
RECOVERY_GATE_BLOCKED_INVALID_INPUT
```

Every result is deeply frozen, detached, and byte-stable. The export surface is
frozen and exposes no debug or test seam.

## 4. Fail-closed matrix

The gate evaluates evidence in fixed order and returns the first blocked result:

```text
PROVIDER_CAPABILITY_UNVERIFIED            -> RECOVERY_GATE_BLOCKED_PROVIDER_CAPABILITY
RECOVERY_POINT_MISSING                    -> RECOVERY_GATE_BLOCKED_RECOVERY_POINT_MISSING
RECOVERY_POINT_STALE                      -> RECOVERY_GATE_BLOCKED_RECOVERY_POINT_STALE
RECOVERY_POINT_STATUS_UNKNOWN             -> RECOVERY_GATE_BLOCKED_RECOVERY_POINT_UNKNOWN
AGE_EXCEEDS_RPO                           -> RECOVERY_GATE_BLOCKED_RECOVERY_POINT_STALE
RESTORE_DRILL_OVERDUE (Tier 3)            -> RECOVERY_GATE_BLOCKED_RESTORE_DRILL_OVERDUE
RESTORE_DRILL_NOT_CONFIRMED (Tier 3)      -> RECOVERY_GATE_BLOCKED_RESTORE_DRILL_OVERDUE
schema_verification ABSENT | UNVERIFIED   -> RECOVERY_GATE_BLOCKED_SCHEMA_VERIFICATION
relational_verification ABSENT|UNVERIFIED -> RECOVERY_GATE_BLOCKED_RELATIONAL_VERIFICATION
approval ABSENT | UNVERIFIED              -> RECOVERY_GATE_BLOCKED_APPROVAL
```

The restore-drill condition applies at the risk tier the recovery policy requires:
the drill gates Tier 3 / destructive operations only
(`DATABASE_SNAPSHOT_RETENTION_RESTORE_DRILL_POLICY.md` §4 and §6: `RESTORE_DRILL_OVERDUE`
blocks Tier 3 DB changes). It is not applied to low-risk operations; the policy does
not require a pre-change recovery gate for Tier 1. This follows the policy authority
and does not relax any requirement.

Only a synthetic positive fixture can produce `RECOVERY_GATE_CONFIRMED`.

## 5. RPO/RTO targets versus provider-confirmed capability

The gate distinguishes policy targets from confirmed capability:

```text
RPO/RTO/retention values  -> policy selections (PROPOSED_NOT_CONFIRMED as project SLAs)
provider_capability_status -> must be PROVIDER_CAPABILITY_CONFIRMED or the gate blocks
recovery_point_status      -> must be RECOVERY_POINT_VALID or the gate blocks
```

The gate never assumes the current Neon plan, the current history window, the
presence of a daily snapshot, or the validity of a live recovery point. Any of
those asserted from this contract would be incorrect.

## 6. Pre-change recovery-point requirement

Per the recovery policy, a Tier 3 or destructive operation requires a valid,
change-bound pre-change recovery point (age within the ≈0 / ≤1 hour RPO, creation
confirmed). The gate models that requirement as:

```text
recovery_point_status = RECOVERY_POINT_VALID
recovery_point_age_class = AGE_WITHIN_RPO
```

Any other recovery-point status or age class fails closed before the operation may
proceed.

## 7. Restore-drill boundary

The drill requirement follows the policy cadence (quarterly at minimum, plus before
any release with a Tier 3 database change). The gate models:

```text
restore_drill_status = RESTORE_DRILL_CONFIRMED
```

`RESTORE_DRILL_OVERDUE` and `RESTORE_DRILL_NOT_CONFIRMED` both block a Tier 3
operation with `RECOVERY_GATE_BLOCKED_RESTORE_DRILL_OVERDUE`. The alert delivery
runtime for stale recovery points belongs to Issue #3461; this child defines only
the recovery-point health vocabulary and classification.

## 8. Schema and relational verification boundary

Schema verification and relational invariant verification are distinct gate
conditions. A restored copy must be verified against the expected-schema manifest
and ledger authority and for representative relational invariants before a change
may proceed. The gate models both as `PRESENT`; `ABSENT` or `UNVERIFIED` blocks.

## 9. Approval boundary

Separate explicit owner approval is required for Production restore and for
destructive/Production data operations. The gate models approval as `PRESENT`;
`ABSENT` or `UNVERIFIED` blocks. A confirmed gate is not an approval.

## 10. Sanitized metadata exclusions

The gate never accepts or returns:

```text
actual timestamps
snapshot IDs
branch IDs
project/account/database IDs
host/port/URLs
credentials
raw provider responses
database rows
operator identity
free-form metadata
```

## 11. Production restore prohibition

This contract prohibits any automatic Production restore, automatic branch reset,
and immediate in-place restore. Production restore remains a last resort that
requires isolated-copy verification, separate explicit owner approval, and the
≤8h RTO boundary from the recovery policy. The gate never authorizes a restore.

## 12. Provider remediation and re-inspection dependency

Provider configuration remediation (Layer A: history window ≥ 24h and a scheduled
recovery-point cadence) and a fresh read-only re-inspection remain required before
any live `RECOVERY_POINT_VALID` assertion. Until then the gate fails closed on
`PROVIDER_CAPABILITY_UNVERIFIED`. This source-only child depends on no provider
state and performs zero provider effects.

## 13. Alert-delivery separation (#3461)

This child defines the recovery-point health vocabulary and stale/missing
classification. Actual provider transport, queueing, notification endpoints, and
alert delivery runtime remain owned by the parallel reliability program (#3461).
No duplicate alert implementation is selected here.

## 14. Immutability and determinism

Required invariants:

```text
input is never mutated
caller object is never frozen
local sanitized snapshot is detached
result is deeply frozen and detached
export surface is frozen
returned arrays are frozen
same bounded input twice -> byte-identical JSON result
```
