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

`pages/editor.html` registers a bounded same-origin page authority (`window.LoveBudReleaseManifestAuthority`) before the form-save runtime. It performs at most one `no-store` same-origin fetch to `/.well-known/release.json` per page, initiated lazily on the first read (so page load never issues a network request). The manifest contract is enforced exactly: only the own keys `release_sha` (40-char lowercase hex data property) and `contract_version` (`"1"`) are accepted; extra keys, missing keys, accessor keys, inherited keys, non-`"1"` contract versions, invalid SHAs, non-ok HTTP responses (`response.ok !== true`, e.g. 404 even with a valid-shaped JSON body), missing `response.json`, and malformed JSON all map to `UNAVAILABLE`. State distinguishes `PENDING` / `READY` / `UNAVAILABLE`.

It exposes three bounded members: `getCurrent()` (synchronous, frozen `{ ok: true, releaseSha }` or `{ ok: false, code: 'RELEASE_SHA_UNAVAILABLE' }`), `getState()` (`'PENDING' | 'READY' | 'UNAVAILABLE'`), and `whenReady()` (the async readiness seam that resolves the same frozen bounded result and shares the single in-flight fetch promise). It never persists to storage, never retries, and never schedules timers.

The save runtime resolves the release SHA from that authority. When the manifest is PENDING the memory save is never blocked or duplicated: monitoring starts at dispatch and waits on the same in-flight release promise (`whenReady`), while the UI save result waits only for the API acknowledgement. When the manifest is in a terminal UNAVAILABLE state monitoring performs a safe skip with zero observer events. The convergence core still requires a valid 40-char lowercase hex release SHA for any `CONFIRMED` summary and never maps a missing/invalid SHA to success.

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
releaseSha: string (40-char lowercase hex) | null when releaseReadiness provided
releaseReadiness: function() -> Promise<{ ok, releaseSha }> | null (optional)
observer: function(summary) | null (optional)
```

The core fires `REQUEST_DISPATCHED` before awaiting anything. When `releaseSha` is deferred (release manifest still PENDING at save time), the core resolves it through `releaseReadiness` after recording `REQUEST_DISPATCHED` and before the canonical reread / final `CONFIRMED`. A missing or invalid resolved SHA produces a bounded `MONITORING_FAILED` — the operation is never classified `CONFIRMED` without a valid SHA.

The core must not contain fetch, XMLHttpRequest, provider SDK, database client, environment variable, localStorage, sessionStorage, IndexedDB, cookie, filesystem, setInterval, retry loop, alert delivery, or deployment logic.

### 10.1 Real Editor wiring (#3852)

The real caller (`editor-memory-form.js`) does not inject `releaseSha` or `canonicalReread`. The save runtime resolves both internally:

```text
releaseSha       <- window.LoveBudReleaseManifestAuthority.getCurrent()  (READY only)
releaseReadiness <- window.LoveBudReleaseManifestAuthority.whenReady()    (PENDING only)
canonicalReread  <- window.LoveBudEditorDataLoader.createCanonicalReread({
                     treeId, apiClient: window.apiClient, normalizeMemory })
```

The canonical reread authority is `createCanonicalReread` in `editor-data-loader.js`:

```text
authority unavailable (no treeId / no apiClient / no getMemoriesByTree)
  -> fixed sanitized rejection CANONICAL_REREAD_AUTHORITY_UNAVAILABLE
transport rejection
  -> fixed sanitized rejection CANONICAL_REREAD_TRANSPORT_FAILED
malformed response (not an array)
  -> fixed malformed result { malformed: true }  (core: INSUFFICIENT_EVIDENCE)
valid array -> { memories: filtered }
valid empty array [] -> { memories: [] } (authoritative; core: ACKNOWLEDGED_REREAD_MISSING)
```

### 10.2 Exactly-once shared write promise

The save runtime creates the real `window.apiClient.createMemory` promise once per save and shares the same promise between the UI result path and the convergence monitoring path:

```text
window.apiClient.createMemory: exactly 1
second write: 0
monitoring retry: 0
```

The UI save result waits only for the actual API acknowledgement. The canonical reread, observer event, summary recording, and release telemetry are fire-and-observe and never block the save. Monitoring catch logs only `[editor] Convergence monitoring unavailable` — never a raw error, stack, identity, or payload.

### 10.3 First-save boundary (observer chronology)

Monitoring starts synchronously at the creation of the single API write promise — before the UI awaits it — so `REQUEST_DISPATCHED` is recorded before the transport settles, even when the release manifest is still `PENDING`:

```text
single API promise created
-> monitoring task starts immediately
-> REQUEST_DISPATCHED recorded before API settlement
-> UI awaits only the same API promise
-> acknowledgement (SERVER_ACKNOWLEDGED after fulfillment / TRANSPORT_FAILED after rejection)
-> exactly one canonical reread when the release SHA is available
```

The UI acknowledgement completion may precede monitoring completion. Progress summaries emitted while the release SHA is unresolved simply omit the `release_sha` field (bounded semantics, privacy preserved); the final `CONFIRMED` always carries the valid release SHA.

On API rejection the UI local fallback still runs once (returned `useApi: false`) while the core records `REQUEST_DISPATCHED` / `TRANSPORT_FAILED`. A local-fallback memory is never classified as `SERVER_ACKNOWLEDGED`, `PERSISTED_REREAD_CONFIRMED`, or `ACKNOWLEDGED_REREAD_MISSING`.

### 10.4 Cross-save stale observer gating

Every save through one `createEditorMemoryFormSave` runtime instance claims the next monotonic generation from a counter shared across that instance. The real caller's `convergenceObserver` is wrapped in a `guardedObserver` that drops every event from a save which is no longer the latest-started one — this is the only cross-save stale boundary, because each per-save convergence core carries its own internal token that cannot gate events across separately created cores.

```text
save A starts -> generation 1
save B starts -> generation 2
A REQUEST_DISPATCHED before B starts: delivered
A progress/final after B starts: dropped
B progress/final: delivered (final CONFIRMED exactly once)
stale A final: 0
stale A SERVER_ACKNOWLEDGED after B start: 0
stale A TRANSPORT_FAILED after B confirmed: 0
```

The generation value is a closure local shared by the runtime instance; it is never exposed in summaries, observer payloads, console output, errors, DOM, storage, or test snapshots. The guard remains active even when the caller injects no observer (events are gated then dropped; the save path, exactly-once API write, and at-most-one reread per successful save are unchanged). The same-core stale test (one core, two `converge` calls) remains valid for the core's internal token; the integration above proves the cross-save boundary through two real `createMemoryWithFallback` calls on one save runtime.