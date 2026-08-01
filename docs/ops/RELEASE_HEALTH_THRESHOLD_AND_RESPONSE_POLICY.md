# Release Health Threshold and Response Policy

> **Status:** Step 5 of 6 — source-only decision policy. No automatic execution.
> **Direct issue:** #3824 — Keep OPEN
> **Parent:** #3673 — Keep OPEN
> **Related:** #3670, #3672, #3425 — Keep OPEN. #1882 — Keep OPEN; use only `Refs #1882`.
> **Authority:** This single document is the one-document policy authority for release health states and response recommendations. No other document defines or overrides these states, recommendations, precedence, or prerequisites.
> **Base SHA:** `9b0be4f1198de619768b7f7e0253135e70dda594`

This document defines deterministic, privacy-safe release health states and response recommendations. It consumes only already-authorized sanitized evidence produced by the canonical release health taxonomy, the Cloudflare-supplied smoke runner, and the critical journey instrumentation foundation. It does not execute Production smoke, collect telemetry, modify workflows, deploy, rollback, or mutate any provider/environment.

---

## 1. Scope and Non-Actions

This policy produces **policy outputs only**: a top-level health state and a response recommendation for a correlated release. It never performs an action itself.

### In scope

- Classify a release against its correlated evidence into exactly one of four health states.
- Emit exactly one of five response recommendations.
- Define deterministic precedence, hard blockers, degraded signals, evidence-completeness rules, latency diagnostics, forward-fix defaults, and rollback prerequisites.
- Provide an owner decision boundary and a Step 6 operator-summary handoff contract.

### Non-actions (NOT_AUTHORIZED)

```text
Production URL execution
Preview URL execution
Cloudflare/API/provider access or mutation
deployment
rollback execution
secret/env access
DB/SQL access
telemetry transport or persistence
workflow mutation
Ready / merge / Issue closure / parent closure
```

Rollback **execution** is always `NOT_AUTHORIZED` in this policy. `ROLLBACK_RECOMMENDED` is a recommendation only, and it still requires owner approval before any execution by an authorized operator.

---

## 2. Evidence Inputs

Only the following bounded, sanitized evidence classes are valid policy inputs. Each is produced by an already-authorized deterministic source.

```text
release identity:
  expected_release_sha        (40-char hex, repository-derived)
  observed_release_sha        (40-char hex | UNKNOWN | NOT_EXPOSED)
  release_match_state         (MATCH | MISMATCH | UNKNOWN | NOT_EXPOSED)
  release_manifest_valid      (true | false | UNKNOWN)

route evidence:
  route_operation             (bounded operation code)
  route_status_class          (HTTP_2XX | HTTP_3XX | HTTP_4XX | HTTP_5XX | HTTP_OTHER | NOT_MEASURED)
  route_body_present          (true | false | UNKNOWN)

static asset evidence:
  static_operation            (bounded operation code)
  static_status_class         (same HTTP status classes)
  static_content_type_class   (JSON | CSS | JAVASCRIPT | HTML | OTHER | NOT_MEASURED)

same-origin evidence:
  same_origin_http_blocker    (true | false | UNKNOWN)

browser runtime evidence:
  browser_fatal_error         (true | false | UNKNOWN)
  browser_console_error       (true | false | UNKNOWN)
  browser_network_failure     (true | false | UNKNOWN)
  browser_horizontal_overflow (true | false | UNKNOWN)

critical journey evidence:
  journey                     (bounded journey code, e.g. JOURNEY_AUTHENTICATED_MY_TREES_LOAD)
  journey_terminal            (TERMINAL_SUCCESS | TERMINAL_FAILURE | CANCELLED | TIMED_OUT | DUPLICATE_SUPPRESSED | NOT_MEASURABLE)
  journey_failure_code        (bounded sanitized failure code | NONE)

latency evidence:
  latency_bucket              (LT_250_MS | LT_500_MS | LT_1_S | LT_2_S | LT_5_S | GTE_5_S | TIMEOUT_OR_UNKNOWN)

required health check evidence:
  required_check_result       (PASSED | FAILED | UNKNOWN)

privacy boundary evidence:
  privacy_boundary_pass       (true | false | UNKNOWN)
```

All evidence values are bounded enums only. This policy never invents a metric or trigger that the current source does not support (see `scripts/release-health-taxonomy.cjs`, `scripts/cloudflare-supplied-url-smoke.cjs`, `js/observability/journey-outcome-taxonomy.js`).

---

## 3. Privacy Boundary

The following are **never** valid policy inputs, decision evidence, or policy output. A presence of any of these in policy inputs or outputs is a `PRIVACY_BOUNDARY_VIOLATION`:

```text
raw body
raw exception
stack trace
URL (with or without query)
query string values
token
cookie
authorization header
user content
private identifier (treeId, memoryId, Firebase UID, user ID, UUID)
provider/account/project metadata
deployment ID
database URL / connection string
request ID
raw timestamp
free-form metadata
```

Allowed outputs are bounded enum/bucket values only: health state, recommendation, bounded status classes, bounded latency buckets, bounded sanitized error codes, and bounded result buckets.

---

## 4. Health States

Exactly four top-level release health states:

```text
HEALTH_STATES:
  HEALTHY
  DEGRADED
  BLOCKED
  INSUFFICIENT_EVIDENCE
```

Exactly one state is emitted per correlated release decision.

---

## 5. Response Recommendations

Exactly five response recommendations:

```text
RESPONSE_RECOMMENDATIONS:
  NO_ACTION
  OBSERVE
  FORWARD_FIX_REQUIRED
  ROLLBACK_RECOMMENDED
  OWNER_DECISION_REQUIRED
```

Exactly one recommendation is emitted per decision. Recommendations are never executed automatically.

---

## 6. Evidence Completeness

No required evidence is ever defaulted to success. If any required evidence class is `UNKNOWN`, `TIMEOUT_OR_UNKNOWN`, missing, stale, or incomplete, the release is **not** `HEALTHY`.

Required evidence completeness for any release decision:

```text
REQUIRED_EVIDENCE:
  expected_release_sha known
  observed_release_sha known (or NOT_EXPOSED with manifest authority)
  release_manifest_valid known
  release_match_state known
  required route checks measured
  required static asset checks measured
  required browser health measured
  required critical journey evidence measured
  privacy_boundary_pass known
```

A release whose required evidence is incomplete is `INSUFFICIENT_EVIDENCE` (or `BLOCKED` when a specific check contract requires it).

---

## 7. Decision Precedence

Single deterministic precedence, high to low. A higher-priority condition is never overridden by a lower-priority condition:

```text
PRECEDENCE (high -> low):
  PRIVACY_OR_SAFETY_VIOLATION
  > RELEASE_IDENTITY_MISMATCH
  > REQUIRED_FUNCTIONAL_BLOCKER
  > INSUFFICIENT_REQUIRED_EVIDENCE
  > DEGRADED_SIGNAL
  > HEALTHY
```

`HEALTHY` is the lowest-priority classification: it is only reached when every higher-priority condition is false and all required evidence is present and passing.

---

## 8. Hard Blockers (BLOCKED)

When the following are tied to the exact deployed release and produced by an authorized deterministic check, the release is `BLOCKED`:

```text
HARD_BLOCKERS:
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

A hard blocker is never downgraded by a degraded or healthy signal. Third-party noise, optional signals, or unmeasured data are **not** hard blockers without authorized evidence.

---

## 9. Degraded Signals (DEGRADED)

Bounded nonfatal signals without a functional failure produce `DEGRADED`:

```text
DEGRADED_SIGNALS:
  latency_bucket GTE_5_S on a required deterministic smoke operation
    -> DEGRADED unless the operation also fails its explicit timeout/functional contract
  browser_console_error (nonfatal, bounded)
  browser_horizontal_overflow (bounded, within tolerance)
  route/static status class HTTP_3XX with successful terminal result (bounded)
```

`DEGRADED` is never used to mask a hard blocker.

---

## 10. Latency Boundary

Latency buckets are diagnostic inputs, not automatically proven rollback thresholds. No API p95 or user-impact threshold is invented here because the merged source does not support one.

```text
LATENCY_RULE:
  TIMEOUT_OR_UNKNOWN on a required check:
    -> INSUFFICIENT_EVIDENCE or BLOCKED according to the check contract
  GTE_5_S on a required deterministic smoke operation:
    -> DEGRADED
    unless the operation also fails its explicit timeout/functional contract:
    -> BLOCKED
```

Any stronger threshold requires separate source-supported justification.

---

## 11. Forward-Fix Rule

`FORWARD_FIX_REQUIRED` is the default response for a release-linked blocker when **all** are true:

```text
FORWARD_FIX_CONDITIONS:
  application reachable
  no security/privacy/data-integrity emergency proven
  bounded corrective release feasible
  rollback compatibility unknown or unsafe
```

A security/privacy/data-integrity emergency that is proven escalates to `OWNER_DECISION_REQUIRED`.

---

## 12. Rollback Prerequisites

`ROLLBACK_RECOMMENDED` may be emitted only when **all** are true:

```text
ROLLBACK_PREREQUISITES:
  exact deployed bad SHA identified
  exact known-good rollback target SHA identified
  blocker causally linked to the bad SHA
  rollback path operationally available
  no DB/schema/data/provider incompatibility known
  rollback does not cross an irreversible migration boundary
  owner approval required before execution
```

If any prerequisite is `UNKNOWN`, emit `OWNER_DECISION_REQUIRED` or `FORWARD_FIX_REQUIRED`. Never recommend rollback by guess.

Automatic rollback execution is `NOT_AUTHORIZED`.

---

## 13. Owner Decision Boundary

`OWNER_DECISION_REQUIRED` is emitted when:

```text
OWNER_DECISION_CONDITIONS:
  a proven security/privacy/data-integrity emergency
  a rollback prerequisite is UNKNOWN and forward-fix is not clearly safe
  the recommended response would cross a documented irreversible boundary
  evidence is insufficient and the check contract requires a human decision
```

Owner approval is always required before any rollback or emergency action.

---

## 14. Technical vs Product Acceptance

Technical release health is strictly separated from subjective judgment:

```text
NOT_HEALTH_EVIDENCE:
  subjective visual judgment
  product acceptance
  authenticated visual acceptance
  content/copy preference
  UI/Product approval
```

`HEALTHY` never implies UI/Product approval. A release may be technically `HEALTHY` while product/visual acceptance is still pending.

---

## 15. Operator-Summary Handoff (Step 6)

Step 6 operator-facing summaries consume this policy's outputs without any raw payload:

```text
HANDOFF_CONTRACT:
  output fields: health_state, response_recommendation, bounded evidence enums, bounded sanitized codes
  forbidden: raw body, raw exception, stack, URL, token, cookie, authorization, user content,
             private identifiers, provider/account/project metadata, database URL
  each summary cites the exact correlated release SHA and the policy authority document
```

A later Step 6 summary may never include a field this policy forbids.

---

## 16. Decision Examples

```text
EXAMPLE_1:
  evidence: manifest valid, SHA MATCH, routes 2XX, static 2XX, browser clean,
            journey TERMINAL_SUCCESS, privacy pass, all required evidence present
  state: HEALTHY
  recommendation: NO_ACTION

EXAMPLE_2:
  evidence: SHA MISMATCH (deployed != expected)
  state: BLOCKED
  recommendation: FORWARD_FIX_REQUIRED (default) unless rollback prerequisites all known

EXAMPLE_3:
  evidence: SHA MATCH, routes 2XX, static 2XX, GTE_5_S latency on required op,
            no explicit timeout/functional failure, journey TERMINAL_SUCCESS
  state: DEGRADED
  recommendation: OBSERVE

EXAMPLE_4:
  evidence: required critical journey evidence missing (UNKNOWN)
  state: INSUFFICIENT_EVIDENCE
  recommendation: OWNER_DECISION_REQUIRED

EXAMPLE_5:
  evidence: validated critical journey TERMINAL_FAILURE tied to exact bad SHA,
            known-good target SHA known, causal link proven, rollback path available,
            no schema/data incompatibility, no irreversible migration
  state: BLOCKED
  recommendation: ROLLBACK_RECOMMENDED (owner approval still required)
```

---

## 17. Closure Impact

This document completes only Step 5 of 6. It does not close any issue.

```text
#3824 Keep OPEN (direct issue)
#3673 Keep OPEN (parent)
#3670 Keep OPEN
#3672 Keep OPEN
#3425 Keep OPEN
#1882 Keep OPEN (use only Refs #1882)
```

Step 6 (operator-facing summary/reporting) is the next future step and remains OPEN.
