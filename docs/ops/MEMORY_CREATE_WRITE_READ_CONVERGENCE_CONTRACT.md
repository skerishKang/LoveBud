# Memory Create Write/Read Convergence Contract

> Issue: #3852 (Child 3A of parent #3461).
> Prerequisite: #3835 (privacy-safe reliability taxonomy), #3842 (read-only structural sentinel).
> Starting exact main: `49ae86ad049395d24289e808b0c6b93571e83e86`.

## 1. Scope

This document defines the contract for the memory-create write/read convergence boundary. It covers the Editor memory-create path only. Tree-create convergence remains a separately authorized Child 3B.

## 2. Operation class and stages

```text
operation_class: MEMORY_CREATE_CONVERGENCE

stages:
  REQUEST_DISPATCHED
  SERVER_ACKNOWLEDGED
  PERSISTED_REREAD_CONFIRMED
```

## 3. Outcome codes

```text
CONFIRMED
TRANSPORT_FAILED
ACKNOWLEDGEMENT_MISSING
ACKNOWLEDGED_REREAD_MISSING
MONITORING_FAILED
INSUFFICIENT_EVIDENCE
```

## 4. Convergence flow

```text
existing create dispatch
  -> server acknowledgement
  -> internal opaque identity retained only inside the convergence closure
  -> existing canonical reread authority, exactly once
  -> identity-presence decision
  -> #3835 bounded canonical summary
  -> optional sanitized in-page observer event
```

### 4.1 Server acknowledgement boundary

A successful `createMemory` response is classified as `SERVER_ACKNOWLEDGED`, not automatically as persisted success. The acknowledgement must contain a stable repository-owned internal identity (`id`). If the acknowledgement is missing, malformed, or lacks an `id`, the outcome is `ACKNOWLEDGEMENT_MISSING`.

### 4.2 Canonical reread

After acknowledgement, exactly one bounded canonical reread runs through the existing repository-owned read authority. The reread uses the acknowledged identity to confirm persistence.

- If the reread finds the created record with the same identity, the outcome is `CONFIRMED` and the stage advances to `PERSISTED_REREAD_CONFIRMED`.
- If the reread succeeds but cannot find the acknowledged identity, the outcome is `ACKNOWLEDGED_REREAD_MISSING`.
- If the reread itself fails (transport error, malformed response, authority unavailable), the outcome is `MONITORING_FAILED` or `INSUFFICIENT_EVIDENCE`. Reread rejection, malformed response, or authority unavailability is NOT divergence.

### 4.3 Stale-result protection

An operation-local monotonic token prevents stale earlier completions from overwriting a later operation summary. The token is never exposed publicly.

## 5. Privacy boundary

Public/observable summaries may contain only the #3835 bounded fields:

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

The stable internal identity is used only inside the bounded comparison closure and must never appear in:

```text
return value
canonical summary
observer event
thrown error
console
test snapshot
JSON serialization
```

## 6. Observer boundary

The optional in-page observer receives a sanitized, frozen summary. A missing or throwing observer must not alter the Editor save result. The observer must not:

```text
send network telemetry
write localStorage/sessionStorage/IndexedDB
write cookies
write filesystem or database state
call provider logging
emit console output containing dynamic values
activate an alert
schedule background work
```

## 7. Release SHA authority

The release SHA is supplied as a dependency to the convergence core. It must be a valid 40-character lowercase hex string. The core validates it and includes it in every summary. Missing or invalid release SHA is not mapped to success.

## 8. Write and reread count guarantees

```text
create write: exactly 1
post-ack canonical reread: maximum 1
monitoring retry: 0
second write: 0
```

## 9. Observer failure semantics

```text
observer missing -> save unchanged
observer throws -> save unchanged
observer slow -> does not block save result
```

## 10. Dependencies

The convergence core is pure and dependency-injected. It accepts:

```text
createMemory: function(payload) -> Promise<{ createdMemory, useApi } | null>
canonicalReread: function(identity) -> Promise<{ memories: [...] } | [...] | null>
taxonomy: object (reliability-sentinel-taxonomy.js)
releaseSha: string (40-char lowercase hex)
observer: function(summary) | null (optional)
```

The core must not contain fetch, XMLHttpRequest, provider SDK, database client, environment variable, localStorage, sessionStorage, IndexedDB, cookie, filesystem, setInterval, retry loop, alert delivery, or deployment logic.