# Release Health Operator Summary Contract

Step 6 of 6 of the parent operations program #3673.

Direct issue: #3831 — Keep OPEN.
Parent: #3673 — Keep OPEN.

This document defines the deterministic operator-facing release summary boundary.
It is source-only. It consumes only the sanitized bounded evidence outputs
authorized by the Step 5 policy document and emits a canonical technical summary.
It never executes a recommendation and never touches Production, Preview,
providers, secrets, a database, or telemetry transport.

## Step 5 policy authority

The single authority for health states, response recommendations, precedence,
hard blockers, degraded rules, and rollback prerequisites is:

```text
docs/ops/RELEASE_HEALTH_THRESHOLD_AND_RESPONSE_POLICY.md
```

This Step 6 contract does not redefine those Step 5 concepts. It validates and
summarizes them.

## Exact 11-key output schema

The canonical summary object has exactly these 11 keys, in this fixed order, and
no other keys:

```text
1.  contract_version
2.  release_sha
3.  health_state
4.  response_recommendation
5.  evidence_completeness
6.  blocker_codes
7.  degraded_codes
8.  owner_decision_state
9.  technical_acceptance
10. product_acceptance
11. policy_authority
```

Fixed values:

```text
contract_version: 1
policy_authority: docs/ops/RELEASE_HEALTH_THRESHOLD_AND_RESPONSE_POLICY.md
```

`contract_version` and `policy_authority` cannot be injected or changed by a
caller.

## Exact enums

Health states (exactly four):

```text
HEALTHY
DEGRADED
BLOCKED
INSUFFICIENT_EVIDENCE
```

Response recommendations (exactly five):

```text
NO_ACTION
OBSERVE
FORWARD_FIX_REQUIRED
ROLLBACK_RECOMMENDED
OWNER_DECISION_REQUIRED
```

Evidence completeness:

```text
EVIDENCE_COMPLETE
EVIDENCE_INCOMPLETE
```

Technical acceptance (derived, never conflated with Product/UI acceptance):

```text
TECHNICAL_ACCEPTED
TECHNICAL_DEGRADED
TECHNICAL_BLOCKED
TECHNICAL_EVIDENCE_INSUFFICIENT
```

Owner decision state (derived):

```text
OWNER_ACTION_REQUIRED
OWNER_ACTION_NOT_REQUIRED
```

Product/UI acceptance (input and output, exactly three):

```text
PRODUCT_ACCEPTED
PRODUCT_REJECTED
PRODUCT_ACCEPTANCE_PENDING
```

## Exact blocker codes

```text
release_sha_mismatch
missing_or_invalid_release_manifest
required_route_failure
required_static_asset_failure
same_origin_unexpected_http_ge_400
fatal_pageerror_or_unhandled_browser_error
privacy_boundary_violation
validated_critical_journey_terminal_failure
required_health_check_failed
```

Unknown blocker codes are rejected.

## Exact degraded codes

```text
latency_bucket_gte_5_s
browser_console_error
browser_horizontal_overflow
successful_route_or_static_http_3xx
```

Unknown degraded codes are rejected.

## Release SHA

`release_sha` must be:

```text
lowercase hexadecimal
exactly 40 characters
```

Rejected forms include uppercase SHA, short SHA, branch names, tags, `UNKNOWN`,
`NOT_EXPOSED`, empty, and whitespace. The output SHA is byte-identical to the
validated input SHA.

## Consistency rules

### HEALTHY

```text
response_recommendation = NO_ACTION
blocker_codes = []
degraded_codes = []
evidence_completeness = EVIDENCE_COMPLETE
technical_acceptance = TECHNICAL_ACCEPTED
```

### DEGRADED

```text
response_recommendation = OBSERVE
blocker_codes = []
degraded_codes length >= 1
evidence_completeness = EVIDENCE_COMPLETE
technical_acceptance = TECHNICAL_DEGRADED
```

### BLOCKED

Allowed recommendations:

```text
FORWARD_FIX_REQUIRED
ROLLBACK_RECOMMENDED
OWNER_DECISION_REQUIRED
```

Required:

```text
blocker_codes length >= 1
evidence_completeness = EVIDENCE_COMPLETE
technical_acceptance = TECHNICAL_BLOCKED
```

`degraded_codes` may exist but can never downgrade a blocker.

### INSUFFICIENT_EVIDENCE

```text
response_recommendation = OWNER_DECISION_REQUIRED
blocker_codes = []
degraded_codes = []
evidence_completeness = EVIDENCE_INCOMPLETE
technical_acceptance = TECHNICAL_EVIDENCE_INSUFFICIENT
```

Missing evidence is never defaulted to `HEALTHY`. Contradictory combinations are
rejected fail-closed as `SUMMARY_IMPOSSIBLE_STATE`.

## Owner decision state derivation

```text
ROLLBACK_RECOMMENDED        -> OWNER_ACTION_REQUIRED
OWNER_DECISION_REQUIRED     -> OWNER_ACTION_REQUIRED
NO_ACTION                   -> OWNER_ACTION_NOT_REQUIRED
OBSERVE                     -> OWNER_ACTION_NOT_REQUIRED
FORWARD_FIX_REQUIRED        -> OWNER_ACTION_NOT_REQUIRED
```

`ROLLBACK_RECOMMENDED` is an advisory state that requires an owner decision; it
is never execution authorization.

## Product acceptance separation

Product/UI acceptance is never inferred from technical health. These valid
combinations must hold:

```text
HEALTHY + PRODUCT_ACCEPTANCE_PENDING
HEALTHY + PRODUCT_REJECTED
BLOCKED + PRODUCT_ACCEPTED
DEGRADED + PRODUCT_ACCEPTANCE_PENDING
```

`HEALTHY` never implies `PRODUCT_ACCEPTED`.

## Privacy exclusions

Input fields and outputs must never contain:

```text
raw body
raw exception
stack trace
URL or query string
cookie
token
authorization header
user content
private tree/memory/user identifier
provider/account/project metadata
deployment ID
database URL / connection string
request ID
raw timestamp
free-form metadata
unknown object key
```

Unknown object keys are rejected, never silently ignored. Values are never
echoed in error messages. Allowed outputs are the exact release SHA, bounded
enums, bounded sanitized codes, and the fixed policy-authority path.

## Advisory-only boundary

A recommendation is recorded in the summary; it is never executed. The module
implements no deployment, rollback, provider mutation, workflow dispatch, HTTP
request, notification transport, branch mutation, or merge capability.

## Immutability

```text
input array clone
deduplicate
lexicographic sort
deep freeze
input mutation after build leaves output unchanged
output mutation is prevented (frozen)
constants cannot be mutated
```

The final summary object and both code arrays are `Object.isFrozen(...) === true`.

## Byte stability

`serializeReleaseHealthOperatorSummary(summary)` returns a single canonical JSON
string preserving the fixed 11-key order. Identical semantic input returns
byte-identical JSON regardless of input array order or duplicates. There is no
trailing newline, timestamp, locale, random value, environment dependency,
filesystem path, host-dependent newline, or unordered iteration.

## Human formatter contract

`formatReleaseHealthOperatorSummary(summary)` derives deterministic text only
from the canonical summary object, with a fixed line order that:

```text
names technical status separately from Product/UI acceptance
states that recommendations are advisory and not executed
states whether owner action is required
cites the fixed Step 5 policy authority
```

Forbidden in human output: current time, locale formatting, random IDs,
absolute paths, environment names/values, raw errors, URLs, provider metadata,
and user content.

## Fixed validation codes

Errors carry only fixed sanitized codes and never echo input values:

```text
SUMMARY_INPUT_INVALID
SUMMARY_UNKNOWN_FIELD
SUMMARY_PRIVATE_FIELD_REJECTED
SUMMARY_RELEASE_SHA_INVALID
SUMMARY_UNKNOWN_ENUM
SUMMARY_IMPOSSIBLE_STATE
```

## Source-only status and non-actions

This contract performs no network access, no browser, no subprocess, no
filesystem write, no provider access, no database connection, no workflow
dispatch, no deployment, and no rollback. It only builds, serializes, and
formats a canonical summary from bounded synthetic fixtures.

## Explicit non-actions

```text
no Production/Preview execution
no Cloudflare/provider access or mutation
no deployment
no rollback
no workflow dispatch/change
no secret/env access
no DB/SQL
no telemetry transport/persistence
no raw/private payload
no Ready
no merge
no Issue closure
no parent closure
```

## Synthetic example (placeholder only)

```text
release_sha: 0123456789abcdef0123456789abcdef01234567
health_state: HEALTHY
response_recommendation: NO_ACTION
product_acceptance: PRODUCT_ACCEPTANCE_PENDING
```

The example above is a synthetic placeholder; it is not a real repository SHA
and contains no private data.

## Closure impact

This document completes only the ordered Step 6 implementation. Parent #3673
remains OPEN for a separate final completion review.

```text
#3831 Keep OPEN (direct issue)
#3673 Keep OPEN (parent)
#3670 Keep OPEN
#3672 Keep OPEN
#3425 Keep OPEN
#1882 Keep OPEN (use only Refs #1882)
```
