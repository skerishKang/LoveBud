# Schema Orphan & Write-Read Sentinel Taxonomy — Policy

> Issue: #3835 (Reliability & Observability child of parent #3461).
> Prerequisite: #3834 (comprehensive audit, ACCEPTED) — the audit identified structural/orphan/write-read divergence boundaries. This document, together with `js/observability/reliability-sentinel-taxonomy.js` and its contract test, defines a **source-only** privacy-safe taxonomy and policy. No sentinel is executed in this child.

## 1. Scope and current state

This document is a **source-only taxonomy/policy** authority. It explicitly does NOT change or claim any runtime state.

```text
source-only taxonomy/policy   : YES
DB unverified                 : YES
Production unverified         : YES
provider unverified           : YES
no sentinel executed          : YES
no alert delivered            : YES
no synthetic write            : YES
```

Nothing in this document, nor in `js/observability/reliability-sentinel-taxonomy.js`, may execute a schema query, join a database, contact a provider, write to a filesystem, deliver an alert, or simulate a user write. All such actions are out of scope here and require a separately authorized child.

## 2. Structural semantics — distinct classify categories

The taxonomy distinguishes the following semantic classes. These are **classification** definitions only; they do not authorize any query.

### 2.1 Valid root memory

```text
valid root memory:
  parent_id IS NULL
```

A memory with `parent_id` null is a valid root node. `parent_id IS NULL` is **never** an orphan.

### 2.2 Parent-memory orphan candidate

```text
parent-memory orphan candidate:
  parent_id IS NOT NULL
  AND no matching parent memory
```

An orphan candidate only exists when `parent_id` is populated (`IS NOT NULL`) AND no parent memory with that id can be found. The null-parent root case is excluded.

### 2.3 Tree orphan candidate

```text
tree orphan candidate:
  memory.tree_id references no matching tree
```

A memory whose `tree_id` refers to no present `trees` row is a tree-orphan candidate. This is cross-entity (memories → trees).

### 2.4 Generic social orphan candidate

```text
generic social orphan candidate:
  target_kind selects a known parent class
  AND target_id has no matching parent in that class
```

A generic social target (`target_kind` in a known parent class, e.g. `memory` or `tree`) whose `target_id` matches no parent of the declared class is a generic social orphan candidate.

## 5. Constraints and boundary port

The taxonomy and this policy must remain privacy-safe and must not assume specific production facts:

```text
- parent_id IS NULL is NEVER classified as orphan
- current Production UUID/TEXT state is NOT confirmed here (ARCHITECTURAL_RISK only)
- current row counts are NOT recorded as permanent thresholds
- NO real SQL / DB query is added by this document
```

### Privacy boundary

The taxonomy rejects, on both input and output, any of the following identifiers:

```text
token, cookie, authorization, email, user_id, owner_id, tree_id, memory_id,
target_id, title, description, content, url, query, request_body,
response_body, raw_error, exception, stack, database_url, request_id,
provider_id, account_id, project_id, timestamp, metadata
```

Rejection is **key-based strict** (exact key match), never substring, so legitimate bounded enum names such as `owner_action` and `baseline_deviation` are never falsely rejected. Raw identifiers are not hashed or stored by this child.

The taxonomy only accepts the ten allowed fields:

```text
operation_class
stage
outcome_code
release_sha
latency_bucket
count_bucket
baseline_deviation
severity
owner_action
evidence_completeness
```

## 6. Enumerations (canonical)

The canonical enumerations live in `js/observability/reliability-sentinel-taxonomy.js`. They are:

### Operation classes

```text
STRUCTURAL_SCHEMA_CHECK
TREE_PARENT_INTEGRITY_CHECK
MEMORY_PARENT_INTEGRITY_CHECK
SOCIAL_TARGET_INTEGRITY_CHECK
BROWSE_ELIGIBILITY_BASELINE_CHECK
TREE_CREATE_CONVERGENCE
MEMORY_CREATE_CONVERGENCE
PUBLIC_THRESHOLD_CONVERGENCE
```

### Ordered convergence stages (immutable order)

```text
REQUEST_DISPATCHED
SERVER_ACKNOWLEDGED
PERSISTED_REREAD_CONFIRMED
UI_RENDER_CONFIRMED
BROWSE_ELIGIBILITY_CONFIRMED
```

### Bounded outcome codes

```text
CONFIRMED
TRANSPORT_FAILED
ACKNOWLEDGEMENT_MISSING
ACKNOWLEDGED_REREAD_MISSING
REREAD_CONFIRMED_UI_MISSING
PUBLIC_THRESHOLD_NOT_CONFIRMED
SCHEMA_AUTHORITY_UNAVAILABLE
STRUCTURAL_DRIFT_DETECTED
ORPHAN_SIGNAL_DETECTED
BASELINE_DISCONTINUITY_DETECTED
MONITORING_FAILED
INSUFFICIENT_EVIDENCE
```

Free-form codes are rejected.

### Baseline-deviation classes (no numeric threshold embedded)

```text
NONE
EXPECTED_VARIATION
MATERIAL_DEVIATION
CRITICAL_DISCONTINUITY
UNKNOWN
```

### Severity

```text
INFO
WARNING
BLOCKING
```

### Advisory owner actions (enum only — never executed)

```text
NO_ACTION
OBSERVE
INVESTIGATE
STOP_SYNTHETIC_WRITES
OWNER_DECISION_REQUIRED
```

`STOP_SYNTHETIC_WRITES` is a plain enum. There is no synthetic writer in the current runtime.

### Evidence completeness

```text
complete
partial
missing
invalid
```

Missing or invalid evidence can never resolve an outcome that claims `CONFIRMED`. The taxonomy fails closed on such input.

## 7. Capability boundary

The taxonomy module declares **zero capabilities**:

```text
network:  0
provider: 0
DB/SQL:   0
filesystem-write: 0
alert delivery:   0
synthetic write:  0
```

It is a pure, deterministic, byte-stable source authority. Identical input always yields byte-identical canonical output.

## 8. Classification

The `tests/contracts/schema-orphan-write-read-sentinel-taxonomy-contract.test.cjs` contract is classified:

```text
SOURCE_STATIC
```

It is not registered in any browser or process group registry; `tests/ci-test-group-registry.json` is out of scope and is not modified by this child.

## 9. Status and ownership

- This source/policy does not change any existing release-health state, recommendation, precedence, rollback, blocker/degraded rule, rollback prerequisite, owner-approval gate, privacy meaning, or Step 6 handoff.
- The remaining children in #3461 (read-only sentinel, convergence instrumentation, provider/deployment/alert delivery, separately authorized Production synthetic canary) remain separately scoped.

Refs #3835.
Refs #3834 — completed.
Refs #3461 — Keep OPEN.
Refs #1882 — Keep OPEN.