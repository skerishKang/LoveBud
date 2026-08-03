# Reliability Alert Delivery Core Contract

> Issue: #3861 (Reliability & Observability Child 4A of parent #3461 — Keep OPEN).
> Source authority: #3835 (privacy-safe reliability taxonomy), #3851 (read-only structural sentinel), #3852 / #3855 (write/read convergence).
> Child 4B (concrete provider/deployment binding) — NOT AUTHORIZED.
> Child 5 (Production synthetic canary) — NOT AUTHORIZED.

## 1. Scope

This document defines the contract for the provider-neutral alert delivery core
(`js/observability/reliability-alert-delivery-core.js`). The core consumes only
the already-sanitized bounded outputs of the merged structural-sentinel and
write/read-convergence authorities, builds one canonical alert envelope,
applies fail-closed severity / owner / dedupe policy, and invokes at most one
injected provider-neutral delivery effect.

It is a pure dependency-injected authority with zero capability. It must not
inspect the DOM, environment variables, filesystem, network, provider SDKs,
storage, database, or Production configuration, and must never throw across the
producer boundary.

## 2. Accepted alert sources

Exactly two source classes are accepted:

```text
STRUCTURAL_SENTINEL
WRITE_READ_CONVERGENCE
```

Each source accepts only a fixed bounded subset of the merged reliability
taxonomy operation classes:

```text
STRUCTURAL_SENTINEL
  STRUCTURAL_SCHEMA_CHECK
  TREE_PARENT_INTEGRITY_CHECK
  MEMORY_PARENT_INTEGRITY_CHECK
  SOCIAL_TARGET_INTEGRITY_CHECK
  BROWSE_ELIGIBILITY_BASELINE_CHECK

WRITE_READ_CONVERGENCE
  TREE_CREATE_CONVERGENCE
  MEMORY_CREATE_CONVERGENCE
  PUBLIC_THRESHOLD_CONVERGENCE
```

Unknown source classes, unknown operation classes, and non-alertable
source/operation combinations fail closed before the delivery effect.

## 3. Canonical envelope

The canonical envelope contains exactly these 12 own keys (fixed order):

```text
contract_version
source_class
operation_class
outcome_code
severity
advisory_action
owner_class
evidence_completeness
release_sha
latency_bucket
baseline_deviation_class
dedupe_fingerprint
```

`release_sha` is lowercase 40-char hex only. A field not applicable to a source
uses the fixed bounded value `NOT_APPLICABLE` (for example `latency_bucket` for
a structural sentinel that does not measure create latency, or
`baseline_deviation_class` for a convergence alert that carries none). No
free-form metadata and no unknown key is ever accepted.

## 4. Severity, owner, and advisory-action mapping

Severity uses the merged #3835 taxonomy values:

```text
INFO
WARNING
BLOCKING
```

Advisory action uses the merged #3835 owner-action vocabulary:

```text
NO_ACTION
OBSERVE
INVESTIGATE
STOP_SYNTHETIC_WRITES
OWNER_DECISION_REQUIRED
```

`STOP_SYNTHETIC_WRITES` and `OWNER_DECISION_REQUIRED` are advisory outputs only.
This core executes no rollback, deploy, write, provider mutation, or
synthetic-stop action; Child 5 (the synthetic canary) does not exist.

Bounded owner classes are defined exactly by this child:

```text
RELIABILITY_OWNER
DATABASE_OWNER
PRODUCT_OWNER
```

The owner class is derived from the outcome code by one fixed deterministic
rule (see `OWNER_CLASS_BY_OUTCOME` in the core):

```text
STRUCTURAL_DRIFT_DETECTED        -> DATABASE_OWNER
ORPHAN_SIGNAL_DETECTED           -> DATABASE_OWNER
BASELINE_DISCONTINUITY_DETECTED  -> DATABASE_OWNER
ACKNOWLEDGED_REREAD_MISSING      -> RELIABILITY_OWNER
MONITORING_FAILED                -> RELIABILITY_OWNER
ACKNOWLEDGEMENT_MISSING          -> RELIABILITY_OWNER
TRANSPORT_FAILED                 -> RELIABILITY_OWNER
INSUFFICIENT_EVIDENCE            -> RELIABILITY_OWNER
SCHEMA_AUTHORITY_UNAVAILABLE     -> RELIABILITY_OWNER
PUBLIC_THRESHOLD_NOT_CONFIRMED   -> PRODUCT_OWNER
REREAD_CONFIRMED_UI_MISSING      -> PRODUCT_OWNER
any other valid outcome          -> RELIABILITY_OWNER (fixed default)
```

## 5. Dedupe fingerprint

`dedupe_fingerprint` is a deterministic SHA-256 (hex) over the canonical bounded
envelope fields before delivery-state fields are added:

```text
contract_version
source_class
operation_class
outcome_code
severity
advisory_action
owner_class
evidence_completeness
release_sha
latency_bucket
baseline_deviation_class
```

It never hashes raw IDs, text, URLs, errors, timestamps, provider metadata, or
caller-selected arbitrary data. The caller may supply only a prior bounded
fingerprint set (single string or array of lowercase sha256 hex strings) through
a descriptor-safe input. The core:

```text
validates lowercase sha256 hex fingerprints
sorts and dedupes them deterministically
suppresses an exact duplicate before delivery (DELIVERY_SUPPRESSED_DUPLICATE)
never persists dedupe state itself
never reads storage or timestamps
```

This child does not implement time-window persistence or durable queues; those
belong to Child 4B.

## 6. Delivery effect contract

The caller injects exactly one provider-neutral function:

```text
deliverAlert(envelope)
```

The core invokes it at most once, and only after full validation and dedupe
evaluation. Allowed injected response vocabulary:

```text
ACCEPTED
REJECTED
TIMEOUT
UNAVAILABLE
```

Canonical delivery outcomes:

```text
DELIVERY_ACCEPTED
DELIVERY_REJECTED
DELIVERY_TIMEOUT
DELIVERY_UNAVAILABLE
DELIVERY_SUPPRESSED_DUPLICATE
DELIVERY_NOT_ATTEMPTED_INVALID_INPUT
DELIVERY_NOT_ATTEMPTED_INSUFFICIENT_EVIDENCE
DELIVERY_FAILED_SANITIZED
```

An injected throw or rejection maps to `DELIVERY_FAILED_SANITIZED`. No raw
error, message, stack, cause, URL, status text, or provider response may escape.
Monitoring or delivery failure never throws into or blocks the normal user
write/read path.

## 7. Privacy exclusions

The core rejects and never echoes:

```text
token
cookie
authorization header
email
owner/user/tree/memory/comment/reaction IDs
title / description / content
raw URL / query
raw request / response body
raw exception / message / stack / cause
provider / account / project / deployment identifiers
endpoint / webhook URL
database URL
request ID
exact timestamp
free-form metadata
unknown object key
```

Accessor and Proxy hostile inputs fail without getter/trap leakage, and raw
values never appear in results, thrown errors, or the fingerprint.

## 8. Non-blocking behavior

The core never awaits, mutates, or blocks the normal user write/read path. The
delivery effect is fire-and-observe: its outcome is returned as a bounded
frozen result, and any failure is sanitized. No retry, no timer, no alert
queue is scheduled by this core.

## 9. Stop conditions (advisory outputs only)

The following conditions are advisory stop signals surfaced through the bounded
outcome vocabulary. No automatic Production action is executed:

```text
privacy-boundary violation                     -> DELIVERY_NOT_ATTEMPTED_INVALID_INPUT
unknown/invalid authority input                -> DELIVERY_NOT_ATTEMPTED_INVALID_INPUT
invalid or missing release SHA                 -> DELIVERY_NOT_ATTEMPTED_INVALID_INPUT
insufficient evidence                          -> DELIVERY_NOT_ATTEMPTED_INSUFFICIENT_EVIDENCE
repeated BLOCKING outcome                      -> suppressed via deterministic dedupe fingerprint
provider effect unavailable or throwing        -> DELIVERY_UNAVAILABLE / DELIVERY_FAILED_SANITIZED
```

`STOP_SYNTHETIC_WRITES` and `OWNER_DECISION_REQUIRED` are advisory-only action
values; the core never executes them.

## 10. Runbook ownership

The bounded owner classes designate the responsible human-runbook owner for an
alert:

```text
DATABASE_OWNER      -> database / schema integrity runbook
RELIABILITY_OWNER   -> reliability observability runbook
PRODUCT_OWNER       -> product / user-visible experience runbook
```

Runbook ownership is advisory routing metadata, not an automated dispatch.

## 11. Child 4B boundary

Child 4B (concrete provider/deployment binding and secret placement) is NOT
authorized. This core contains zero provider endpoint, URL, credential, secret,
account, or Production binding. No dedupe persistence or durable queue is
implemented here.

## 12. Child 5 boundary

Child 5 (Production synthetic canary) is NOT authorized. The core never writes,
executes, or triggers a synthetic write, rollback, deploy, or provider mutation.

## 13. Test contract

The Child 4A test group is added to
`tests/contracts/schema-orphan-write-read-sentinel-taxonomy-contract.test.cjs`
and executes the real alert core with bounded synthetic fixtures. It proves
scenarios A1-A15: valid structural alert, valid write/read divergence alert,
duplicate suppression, invalid SHA, unknown source/operation/outcome,
insufficient evidence, the four injected response mappings, throw/rejection
sanitization, private/unknown field rejection, descriptor/accessor/Proxy
safety, frozen/detached envelope and result, byte stability, non-throwing
boundary, effect maximum exactly 1, and zero forbidden capability.
