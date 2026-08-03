# Source-Only Fail-Closed Deploy Gate Contract

Source-only contract for Issue #3872 (Step 8 Child 4 first bounded
implementation under #3458). This document defines the bounded boundary of the
source-only fail-closed deploy gate decision core. It is a source/architecture
contract; it performs no provider binding, no target connection, no manifest
activation, no SQL, no database mutation, and no deployment integration.

Refs #3872, #3860, #3458, #1882.

## Purpose

One deterministic, descriptor-safe, fail-closed decision authority that
consumes only bounded sanitized evidence and decides whether a later,
separately approved canonical-target activation proposal is eligible at the
source level. It never decides, executes, or claims that a target is active or
that deployment occurred.

`DEPLOY_GATE_PRECONDITIONS_CONFIRMED` means only that bounded source-level
prerequisites are satisfied for a later separately approved operator action.

## Fixed bounded input schema

The core accepts exactly the following own enumerable data properties and
nothing else. Unknown keys, unknown enum values, accessors, and Proxy `get`
traps are rejected.

```text
contract_version                          "1.0"
release_sha                               lowercase 40-hex
canonical_manifest_status                 ADOPTION_REQUIRED | ACTIVE
canonical_manifest_checksum_posture       CHECKSUM_INTACT | CHECKSUM_MISMATCH | CHECKSUM_MISSING
expected_schema_status                    ADOPTION_REQUIRED | ACTIVE
expected_schema_critical_object_posture   CRITICAL_OBJECT_BOUND | CRITICAL_OBJECT_MISSING | CRITICAL_OBJECT_MISMATCH
ledger_provenance_verdict                 LEDGER_PROVENANCE_CONFIRMED | LEDGER_PROVENANCE_MISMATCH | LEDGER_PROVENANCE_EDITED | LEDGER_PROVENANCE_MISSING
target_attribution_verdict                TARGET_ATTRIBUTION_CONFIRMED | TARGET_ATTRIBUTION_INVALID | TARGET_ATTRIBUTION_MISSING
catalog_parity_verdict                    CATALOG_PARITY_CONFIRMED | CATALOG_PARITY_MISMATCH | CATALOG_PARITY_INSUFFICIENT
destructive_ddl_approval_verdict          DESTRUCTIVE_APPROVAL_CONFIRMED | DESTRUCTIVE_APPROVAL_MISSING | DESTRUCTIVE_APPROVAL_INVALID
recovery_gate_verdict                     RECOVERY_GATE_CONFIRMED | RECOVERY_GATE_REQUIRED | RECOVERY_GATE_INVALID | RECOVERY_GATE_MISSING
activation_approval_verdict               ACTIVATION_APPROVAL_CONFIRMED | ACTIVATION_APPROVAL_MISSING | ACTIVATION_APPROVAL_INVALID
```

Forbidden input (never accepted, never read):

```text
raw manifest object
raw SQL
catalog row
database name
host
port
URL
provider/account/project identifier
credential/secret
operator identity
email
timestamp
filesystem path
environment variable
arbitrary metadata
raw error
```

## Fixed verdict vocabulary

```text
DEPLOY_GATE_PRECONDITIONS_CONFIRMED
DEPLOY_GATE_BLOCKED_INVALID_INPUT
DEPLOY_GATE_BLOCKED_MANIFEST_AUTHORITY
DEPLOY_GATE_BLOCKED_LEDGER_PROVENANCE
DEPLOY_GATE_BLOCKED_TARGET_ATTRIBUTION
DEPLOY_GATE_BLOCKED_CATALOG_PARITY
DEPLOY_GATE_BLOCKED_DESTRUCTIVE_APPROVAL
DEPLOY_GATE_BLOCKED_RECOVERY_GATE
DEPLOY_GATE_BLOCKED_ACTIVATION_APPROVAL
DEPLOY_GATE_BLOCKED_INSUFFICIENT_EVIDENCE
```

Every result fixes the four mutation flags to `false`:

```text
activation_performed: false
deployment_performed: false
manifest_mutated: false
target_mutated: false
```

A positive verdict never implies that a target is active or that deployment
occurred.

## Recovery boundary

#3460 remains separate and OPEN. This child defines only the bounded recovery
evidence class:

```text
RECOVERY_GATE_CONFIRMED
RECOVERY_GATE_REQUIRED
RECOVERY_GATE_INVALID
```

Synthetic tests may model `RECOVERY_GATE_CONFIRMED`. No provider snapshot,
restore point, retention system, or restore drill is implemented here.

## Descriptor safety

All input is validated as exact own enumerable data properties. The following
must be zero:

```text
getter invocation
Proxy get trap invocation
inherited-field acceptance
unknown-field acceptance
raw dynamic error leakage
```

After validation, only local sanitized values are used; original object fields
are never re-read.

## Determinism and immutability

```text
same bounded input -> byte-identical JSON result
result: deeply frozen
exports: frozen
input: not mutated
returned arrays/objects: detached
```

The core exposes no capability for:

```text
fetch / XMLHttpRequest / WebSocket
filesystem
process.env
network
database
SQL
storage
timer/retry
provider SDK
deployment command
```

## Fail-closed gate order

```text
1. input shape and exact key set
2. contract_version
3. release_sha
4. canonical manifest status + checksum posture
5. expected-schema status + critical-object posture
6. ledger provenance
7. target attribution
8. catalog parity
9. destructive-DDL approval
10. recovery gate
11. activation approval
```

Any missing/edited/mismatched evidence fails closed with the corresponding
blocked verdict. Insufficient-evidence variants map to
`DEPLOY_GATE_BLOCKED_INSUFFICIENT_EVIDENCE`.

## Committed source posture

The committed manifests remain populated but `ADOPTION_REQUIRED` in source.
Synthetic positive fixtures may model a separately attested future activation
proposal, but the core never writes or changes tracked manifests.

## Decision posture

`DB_MIGRATION_PROVENANCE_NEXT_CHILD_DECISION.md` records:

```text
Step 8 Child 4 source-only decision core: IMPLEMENTED BY #3872, pending merge/independent CI
provider/environment binding: NONE
manifest ACTIVE transition: NONE
target activation: NONE
deployment integration: NONE
#3458 completion review: SELECTED AS THE ONLY NEXT CHILD
#3460: still waits for #3458 completion
legacy Production Phase B/C/D/E: DEFERRED_NOT_REJECTED
```

Exact next marker:

```text
MIGRATION_PROVENANCE_COMPLETION_REVIEW_SELECTED
```

The marker selects the #3458 completion review only. It does not authorize
provider binding, Production access, SQL, manifest activation, target mutation,
or deployment integration.

## Completion boundary

After independent exact-head source review and expected-head merge:

- keep #3458 OPEN;
- keep #3460 OPEN with no new implementation;
- keep #3435 OPEN/deferred;
- no Child 5 / no #3460 work in this PR;
- no manifest ACTIVE transition, target activation, or deploy integration.

Refs #3860 — completed Child 3.
Refs #3458 — Keep OPEN.
Refs #3435 — Keep OPEN/deferred.
Refs #3460 — Keep OPEN; implementation waits for #3458 completion.
Refs #1882 — Keep OPEN; use only `Refs #1882`.
