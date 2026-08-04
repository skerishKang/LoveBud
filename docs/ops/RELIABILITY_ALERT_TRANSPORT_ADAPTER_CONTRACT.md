# Reliability Alert Transport Adapter Contract

> Issue: #3874 (Reliability & Observability child of parent #3461 — Keep OPEN).
> Accepted audit: #3873 (`RELIABILITY_ALERT_PROVIDER_BINDING_AUDIT_COMPLETE` / `CHILD_SELECTED`).
> Prerequisite: #3861 / PR #3868 (provider-neutral alert envelope and delivery-state core).

## 1. Scope

This document defines the contract for the provider-unselected alert transport
adapter boundary (`js/observability/reliability-alert-transport-adapter.js`).
The adapter sits between the merged provider-neutral alert delivery core and a
future provider-specific transport. It proves the interface a future
provider-specific child must satisfy. It is NOT a generic fetch/webhook sender
and does not select or contact any real provider.

## 2. Provider-unselected decision

Accepted audit #3873 confirmed that real executable alert transport, webhook /
email / PagerDuty / Slack adapters, alert-specific secret placement, durable
dedupe persistence, delivery queue/retry/dead-letter state, scheduled alert
workflows, and operator kill switches are all ABSENT in the repository. This
child therefore fixes the provider posture:

```text
provider_class: PROVIDER_UNSELECTED
runtime_binding: NOT_BOUND
secret_status: NOT_REQUIRED_FOR_SOURCE_ADAPTER
preview_transport: DISABLED
production_transport: DISABLED
```

The adapter rejects any endpoint, URL, token, account, project, email, channel,
provider response body, or arbitrary provider metadata on input, in results, or
in documentation.

## 3. Canonical envelope input boundary

The adapter accepts exactly one canonical alert envelope already produced by
`js/observability/reliability-alert-delivery-core.js` (12 exact own keys):

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

The adapter NEVER recomputes severity/owner/dedupe semantics. It validates the
exact 12-key shape, the bounded merged #3835 enum vocabulary, the lowercase
40-hex `release_sha`, and the lowercase sha256-hex `dedupe_fingerprint`, then
consumes the envelope as opaque canonical authority.

## 4. Transport-control schema

The adapter accepts exactly one bounded transport-control object with these
fixed own keys:

```text
provider_class
runtime_binding
secret_status
transport_enabled
operator_disabled
retry_attempt_class
dedupe_state_class
release_sha
synthetic_effect_authorized
```

Bounded values:

```text
provider_class:
  PROVIDER_UNSELECTED

runtime_binding:
  NOT_BOUND

secret_status:
  NOT_REQUIRED_FOR_SOURCE_ADAPTER
  SECRET_ABSENT
  SECRET_INVALID
  SECRET_PRESENT_UNVERIFIED

transport_enabled:
  false   (exactly false in this child)

operator_disabled:
  true | false

retry_attempt_class:
  FIRST_ATTEMPT
  BOUNDED_RETRY_ELIGIBLE
  RETRY_EXHAUSTED

dedupe_state_class:
  DEDUPE_NOT_AVAILABLE
  DEDUPE_AVAILABLE_SYNTHETIC
  DEDUPE_INVALID

synthetic_effect_authorized:
  true | false
```

No numeric retry scheduling, timestamp, queue depth, endpoint, or secret value
is allowed. `retry_attempt_class` is a bounded advisory vocabulary only.

## 5. Result vocabulary

The adapter returns one fixed bounded result with exactly one of:

```text
TRANSPORT_NOT_ATTEMPTED_PROVIDER_UNSELECTED
TRANSPORT_NOT_ATTEMPTED_DISABLED
TRANSPORT_NOT_ATTEMPTED_OPERATOR_DISABLED
TRANSPORT_NOT_ATTEMPTED_SECRET_STATE
TRANSPORT_NOT_ATTEMPTED_DEDUPE_STATE
TRANSPORT_NOT_ATTEMPTED_INVALID_INPUT

TRANSPORT_EFFECT_ACCEPTED_SYNTHETIC
TRANSPORT_EFFECT_REJECTED_SYNTHETIC
TRANSPORT_EFFECT_TIMEOUT_SYNTHETIC
TRANSPORT_EFFECT_UNAVAILABLE_SYNTHETIC
TRANSPORT_EFFECT_FAILED_SANITIZED
```

Every result carries the fixed capability truth:

```text
provider_selected: false
runtime_bound: false
secret_read: false
network_performed: false
persistence_performed: false
queue_performed: false
preview_effect_performed: false
production_effect_performed: false
```

Synthetic outcomes prove adapter mapping only; even when the injected fake
effect runs, all capability flags remain false because no real network or
provider transport is performed.

## 6. Synthetic effect seam

The caller may inject at most one fake transport effect:

```text
invokeTransport(canonicalEnvelope, boundedControl)
```

Allowed synthetic response vocabulary:

```text
ACCEPTED
REJECTED
TIMEOUT
UNAVAILABLE
```

The adapter invokes the effect at most once, and only when ALL of the
following hold:

```text
synthetic_effect_authorized = true
provider_class = PROVIDER_UNSELECTED
runtime_binding = NOT_BOUND
transport_enabled = false
operator_disabled = false
valid secret state
valid dedupe state
valid release SHA
valid canonical envelope
```

The default provider-unselected production posture invokes the effect zero
times. Injected throws/rejections map to `TRANSPORT_EFFECT_FAILED_SANITIZED`
with zero leakage of error.message, stack, cause, statusText, response body,
URL, or provider details.

## 7. Kill switch and stop conditions

The adapter fails closed (effect count 0) when:

```text
provider remains unselected (default)
transport_enabled != false
operator_disabled = true
runtime binding invalid
release SHA invalid/missing or mismatched with the envelope
canonical envelope malformed or non-bounded
secret state invalid/missing for a future selected-provider proposal
dedupe state invalid
unknown/private field
privacy boundary violation
synthetic effect authorization absent
```

No outcome executes rollback, deploy halt, user-data mutation, DB mutation, or
Child 5 synthetic canary behavior.

## 8. Privacy exclusions

The adapter rejects and never echoes:

```text
token / secret / cookie / Authorization header
webhook or endpoint URL
email / channel / account / project / deployment identifier
provider response body
user / owner / tree / memory / comment / reaction ID
title / content / description
raw request / response
raw exception / message / stack / cause
exact timestamp
queue payload
free-form metadata
unknown key
```

## 9. Classification

The contract is registered exactly once in
`tests/test-layer-classification.json`:

```text
layer: EXECUTED_FAKE
capabilities: []
```

It executes the real adapter source with an injected fake transport effect and
no real external system or production resource.

## 10. Future provider-specific child prerequisites

This child satisfies NONE of the following by itself. A future
provider-specific child requires:

```text
explicit provider selection
approved runtime placement
approved secret store/injection
Preview/Production separation
bounded durable dedupe/queue decision
fresh provider-specific test authority
separate Production activation approval
```

## 11. Child 5 prohibition

Child 5 (Production synthetic canary) is NOT authorized. The adapter never
writes, executes, or triggers a synthetic write, rollback, deploy, or provider
mutation.

## 12. Test contract

`tests/contracts/reliability-alert-transport-adapter-contract.test.cjs` executes
the real adapter with bounded synthetic fixtures and proves: provider-unselected
default effect 0, transport disabled effect 0, operator disabled effect 0,
invalid/missing release SHA effect 0, unknown/private key effect 0, malformed
envelope effect 0, invalid secret state effect 0, invalid dedupe state effect 0,
synthetic ACCEPTED/REJECTED/TIMEOUT/UNAVAILABLE exact mapping with effect 1,
injected throw/rejection sanitized with effect 1, maximum effect count exactly
1, nested accessor/Proxy hostile input getter/trap count 0, raw leakage 0,
deeply frozen/detached input-result-export, byte-stable awaited results, all
capability flags false, and zero network/env/filesystem/storage/queue/provider
SDK capability.

Refs #3874.
Refs #3873 — accepted provider-binding audit.
Refs #3861 — completed Child 4A provider-neutral delivery core.
Refs #3461 — Keep OPEN.
Refs #1882 — Keep OPEN.
