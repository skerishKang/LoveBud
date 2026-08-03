# Tree Create Write/Read Convergence Contract

> Issue: #3855 (Child of parent #3461).
> Reuses: #3852 (memory-create convergence core), #3835 (privacy-safe reliability taxonomy), #3842 (read-only structural sentinel).
> Starting exact main: `9c737d8e7f3ce72edcdc6ca9b33103f220379b38`.

## 1. Scope

This document defines the contract for the tree-create write/read convergence boundary. It covers the My Trees create path only (`js/my-trees/my-trees-actions.js`, `pages/my-trees.html`). The memory-create path remains governed by its own contract (`MEMORY_CREATE_WRITE_READ_CONVERGENCE_CONTRACT.md`, #3852).

## 2. Operation class and stages

```text
operation_class: TREE_CREATE_CONVERGENCE

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
existing create dispatch (apiClient.createTree)
  -> server acknowledgement
  -> repository-owned tree identity retained only inside the convergence closure
  -> existing canonical reread authority (apiClient.getTrees), exactly once
  -> identity-presence decision
```

Identity rules — the only stable repository-owned identity is the acknowledged tree `id` (a non-empty string data property from the create acknowledgement). The following are never used as identity:

```text
title
visibility
timestamp
array position
count delta
redirect URL
cache contents
```

The UI-facing result of a create is never derived from monitoring: monitoring is fire-and-observe and never blocks the redirect, modal, validation, cache invalidation, toast, or user-visible result.

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

The stable acknowledged tree identity is used only inside the bounded comparison closure and must never appear in:

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

The optional in-page observer receives a sanitized, frozen summary. A missing or throwing observer must not alter the My Trees create result or redirect. The observer must not:

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

`js/my-trees/my-trees-actions.js` registers the same bounded same-origin page authority (`window.LoveBudReleaseManifestAuthority`) as the Editor (`pages/editor.html`). It cannot live in `pages/my-trees.html` markup: that page has an existing no-active-inline-script contract (`my-trees-inline-script-bootstrap-contract.test.cjs`), so the authority is registered by the actions module itself, before any create flow can run. It performs at most one `no-store` same-origin fetch to `/.well-known/release.json` per page, initiated lazily on the first read (so page load never issues a network request). The manifest contract is enforced exactly: only the own keys `release_sha` (40-char lowercase hex data property) and `contract_version` (`"1"`) are accepted; extra keys, missing keys, accessor keys, inherited keys, non-`"1"` contract versions, invalid SHAs, non-ok HTTP responses (`response.ok !== true`, e.g. 404 even with a valid-shaped JSON body), missing `response.json`, and malformed JSON all map to `UNAVAILABLE`. State distinguishes `PENDING` / `READY` / `UNAVAILABLE`.

It exposes three bounded members: `getCurrent()` (synchronous, frozen `{ ok: true, releaseSha }` or `{ ok: false, code: 'RELEASE_SHA_UNAVAILABLE' }`), `getState()` (`'PENDING' | 'READY' | 'UNAVAILABLE'`), and `whenReady()` (the async readiness seam that resolves the same frozen bounded result and shares the single in-flight fetch promise). It never persists to storage, never retries, and never schedules timers.

The actions runtime resolves the release SHA from that authority. When the manifest is PENDING the create is never blocked or duplicated: monitoring starts at dispatch and waits on the same in-flight release promise (`whenReady`), while the UI create result waits only for the API acknowledgement. When the manifest is in a terminal UNAVAILABLE state monitoring performs a safe skip with zero observer events. The convergence core still requires a valid 40-char lowercase hex release SHA for any `CONFIRMED` summary and never maps a missing/invalid SHA to success.

## 8. Write and reread count guarantees

```text
create write (apiClient.createTree): exactly 1
post-ack canonical reread (apiClient.getTrees): maximum 1
monitoring second write: 0
monitoring retry: 0
```

## 9. Observer failure semantics

```text
observer missing -> create/redirect unchanged
observer throws -> create/redirect unchanged
observer slow -> does not block redirect
```

## 10. Dependencies

The convergence core is the shared #3852 pure dependency-injected engine, used through a bounded generalization that keeps memory-create behavior byte-identical:

```text
operationClass: 'TREE_CREATE_CONVERGENCE'  (default remains MEMORY_CREATE_CONVERGENCE)
createKey: 'createTree'                    (default remains createMemory)
ackKey: 'createdTree'                      (default remains createdMemory)
createTree: function() -> Promise<{ createdTree, useApi } | null>   (wraps the real shared API promise)
canonicalReread: function() -> Promise<tree rows array> | null      (wraps apiClient.getTrees)
taxonomy: object (reliability-sentinel-taxonomy.js)
releaseSha: string (40-char lowercase hex) | null when releaseReadiness provided
releaseReadiness: function() -> Promise<{ ok, releaseSha }> | null (optional)
observer: function(summary) | null (optional)
```

The core fires `REQUEST_DISPATCHED` before awaiting anything. When `releaseSha` is deferred (release manifest still PENDING at create time), the core resolves it through `releaseReadiness` after recording `REQUEST_DISPATCHED` and before the canonical reread / final `CONFIRMED`. A missing or invalid resolved SHA produces a bounded `MONITORING_FAILED` — the operation is never classified `CONFIRMED` without a valid SHA.

The core must not contain fetch, XMLHttpRequest, provider SDK, database client, environment variable, localStorage, sessionStorage, IndexedDB, cookie, filesystem, setInterval, retry loop, alert delivery, or deployment logic.

### 10.1 Real My Trees wiring (#3855)

The real caller (`js/my-trees/my-trees-actions.js`) does not inject `releaseSha` or `canonicalReread`. The actions runtime resolves both internally:

```text
releaseSha       <- window.LoveBudReleaseManifestAuthority.getCurrent()  (READY only)
releaseReadiness <- window.LoveBudReleaseManifestAuthority.whenReady()    (PENDING only)
canonicalReread  <- window.apiClient.getTrees()   (the existing repository-owned read authority that
                                                    also backs the pre-create snapshot and reconciliation)
```

The canonical reread authority never fabricates an empty array for unavailable authority. The convergence core treats a transport rejection as `MONITORING_FAILED` and a non-array response as `INSUFFICIENT_EVIDENCE` — neither is ever classified `ACKNOWLEDGED_REREAD_MISSING`. Only a successful authoritative array reread without the acknowledged identity is `ACKNOWLEDGED_REREAD_MISSING`.

### 10.2 Exactly-once shared write promise

The actions runtime creates the real `window.apiClient.createTree` promise once per submit and shares the same promise between the UI result path and the convergence monitoring path:

```text
window.apiClient.createTree: exactly 1
second write: 0
monitoring retry: 0
```

The UI create result waits only for the actual API acknowledgement. The canonical reread, observer event, summary recording, and release telemetry are fire-and-observe and never block the redirect. When `window.apiClient.createTree` is absent, the existing demo-mode fallback still runs exactly as before with zero monitoring events (no real write exists to observe).

### 10.3 Dispatch-boundary (observer chronology)

Monitoring starts synchronously at the creation of the single API write promise — before the UI awaits it — so `REQUEST_DISPATCHED` is recorded before the transport settles, even when the release manifest is still `PENDING`:

```text
single API promise created (dispatchTreeCreateOnce)
-> monitoring task starts immediately
-> REQUEST_DISPATCHED recorded before API settlement
-> UI awaits only the same API promise
-> acknowledgement (SERVER_ACKNOWLEDGED after fulfillment / TRANSPORT_FAILED after rejection)
-> exactly one canonical reread when the release SHA is available
```

The UI acknowledgement completion may precede monitoring completion. Progress summaries emitted while the release SHA is unresolved simply omit the `release_sha` field (bounded semantics, privacy preserved); the final `CONFIRMED` always carries the valid release SHA.

On API rejection with an ambiguous status the existing product check-mode path still runs (reconciliation, check-status UI, no auto-redirect) while the core records `REQUEST_DISPATCHED` / `TRANSPORT_FAILED`. A local-fallback or demo-mode tree is never classified as `SERVER_ACKNOWLEDGED`, `PERSISTED_REREAD_CONFIRMED`, or `ACKNOWLEDGED_REREAD_MISSING`.

### 10.4 Cross-save stale observer gating

Every create flow through one `createNewTree` runtime instance claims the next monotonic generation from a counter shared across that instance. The caller's `convergenceObserver` is wrapped in a `guardedObserver` that drops every event from a flow which is no longer the latest-started one — this is the only cross-save stale boundary, because each per-flow convergence core carries its own internal token that cannot gate events across separately created cores.

```text
flow A starts -> generation 1
flow B starts -> generation 2
A REQUEST_DISPATCHED before B starts: delivered
A progress/final after B starts: dropped
B progress/final: delivered (final CONFIRMED exactly once)
stale A final: 0
stale A SERVER_ACKNOWLEDGED after B start: 0
stale A TRANSPORT_FAILED after B confirmed: 0
```

The generation value is a closure local shared by the actions runtime instance; it is never exposed in summaries, observer payloads, console output, errors, DOM, storage, or test snapshots. The guard remains active even when the caller injects no observer (events are gated then dropped; the create path, exactly-once API write, and at-most-one reread per successful create are unchanged). The same-core stale test (one core, two `converge` calls) remains valid for the core's internal token; the integration test proves the cross-save boundary through two real `driveCreateFlow`/`createNewTree` flows on one actions runtime with two separately created convergence cores.

## 11. Redirect non-blocking proof

The monitoring task is never awaited by the redirect path. Tests prove:

```text
monitoring slower than redirect -> UI redirect completes first
observer missing -> create + redirect unchanged
observer throwing -> create + redirect unchanged
release authority unavailable -> save not blocked, write still exactly once
reread rejection -> MONITORING_FAILED, redirect unchanged
identity absent in reread -> ACKNOWLEDGED_REREAD_MISSING, redirect unchanged
```

## 12. Preservation guarantees

The following are unchanged by this work:

```text
memory payload shape (createTree payload)
form validation
API endpoint
API request body
local fallback policy
toast text and conditions
check-mode status UI
redirect timing and target
modal markup / CSS
My Trees list loading
snapshot / reconciliation
cache invalidation
```

This work is an observability wiring correction on top of the existing #3852 convergence core — not a redesign of the product create behavior.

## 13. Test contract

`tests/contracts/tree-create-write-read-convergence-contract.test.cjs` executes the REAL production sources — `reliability-sentinel-taxonomy.js`, `reliability-write-read-convergence-core.js`, and `my-trees/my-trees-actions.js` — with injected fake transports (`createTree`, `getTrees`, release manifest authority). It proves:

```text
createTree exactly once
REQUEST_DISPATCHED before settlement
SERVER_ACKNOWLEDGED once
canonical reread maximum once
identity present -> CONFIRMED
identity absent -> ACKNOWLEDGED_REREAD_MISSING
create rejection -> TRANSPORT_FAILED
missing acknowledgement -> ACKNOWLEDGEMENT_MISSING
reread rejection -> MONITORING_FAILED
malformed reread -> INSUFFICIENT_EVIDENCE
observer failure does not block redirect
slow monitoring does not delay redirect
stale earlier events suppressed
raw tree identity/error leakage 0
missing release SHA cannot become CONFIRMED
memory-create #3852 regression 0
```

Classification: `EXECUTED_FAKE` (real source, injected fake dependencies; no real external system or production resource used).
