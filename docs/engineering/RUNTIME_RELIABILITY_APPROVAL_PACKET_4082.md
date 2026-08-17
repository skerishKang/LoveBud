# Runtime Reliability Approval Packet — Issue #4082

Status: **PRE-ACTIVATION / NON-ACTIVATING**

Parent: #3461 — KEEP OPEN  
Protected: #1882 — KEEP OPEN  
Owner for packet preparation: WEB-3  
Source snapshot used for this packet: `main@b02ffe9984e14f68ebfaa91d0b14d8e7dd9c03ae`

This document is the bounded owner/Web-CTO decision packet requested by #4082. It defines future runtime bindings and the gates that must be approved before activation. It does **not** grant Production read authority, Production synthetic-write authority, alert-provider binding, scheduler activation, provider mutation, or secret placement.

Status vocabulary used below:

- `DECIDED`: fixed by merged repository authority or current Web CTO authority.
- `PROPOSED`: recommended design, not yet activation authority.
- `BLOCKED`: cannot be activated until the named dependency/gate is satisfied.
- `OWNER_DECISION_REQUIRED`: an explicit owner/Web CTO choice or configuration is still required.

## 1. Authority / non-authority

**DECIDED**

Current #4082 authority:

```text
APPROVAL_PACKET_PREPARATION = ALLOWED
RUNTIME_ACTIVATION = NO
PRODUCTION_READ_AUTHORITY = NO
PRODUCTION_SYNTHETIC_WRITE_AUTHORITY = NO
ALERT_PROVIDER_BINDING = NO
```

This packet must not:

- query Production;
- write Production or any user dataset;
- create or apply schema;
- bind a provider or secret;
- activate a scheduler;
- send a real alert;
- start a Production synthetic canary;
- mutate Cloudflare, Modal, Firebase, or database configuration;
- alter the source-only #4079/#4080/#4081 contracts;
- modify `tests/test-layer-classification.json`.

The three activation authorities are separate and remain independently disabled:

1. read-only sentinel activation;
2. synthetic canary activation;
3. alert delivery activation.

No one switch or approval may implicitly enable another.

## 2. Dependency matrix

| Dependency | State | Packet consequence |
| --- | --- | --- |
| #4060 / PR #4061 structural schema + migration parity | `DECIDED: COMPLETE / MERGED` | Reuse the merged structural/parity boundary. Do not implement a second parity engine. |
| #4079 baseline/anomaly evaluation core | `DECIDED: COMPLETE / MERGED` | Reuse `reliability-baseline-store-contract.js` and `reliability-anomaly-evaluator-core.js`; runtime store remains an injected adapter. |
| #4080 write-outcome classifier | `DECIDED: COMPLETE / MERGED` | Consume the canonical five-stage/write-outcome vocabulary. `WRITE_STATUS_UNKNOWN` is never blind-retry authority. |
| #4081 synthetic canary lifecycle | `BLOCKED: PENDING_4081_EXACT_HEAD` | No synthetic activation. Post-merge audit is mandatory before synthetic exclusion/fencing/cleanup can be approved. |
| #3861 alert envelope/delivery core | `DECIDED: COMPLETE` | Reuse canonical bounded alert envelope, severity/owner/advisory mappings, and dedupe fingerprint. |
| #3874 provider-unselected transport adapter | `DECIDED: COMPLETE` | Provider remains `PROVIDER_UNSELECTED`; no real runtime/provider binding exists. |
| #4004 backend convergence | `DECIDED: ACTIVE ARCHITECTURE AUTHORITY` | Prefer future Cloudflare-native placement; Modal remains for specialized/background workloads. |
| Production schema/provenance usability | `BLOCKED` | Current convergence authority still distinguishes catalogued state from applied/live state and retains adoption/runtime holds. |
| Production read-only Phase B | `BLOCKED` | #4082 grants no Production read authority. |
| QA/synthetic identity | `BLOCKED: PENDING_4081_EXACT_HEAD / OWNER APPROVAL` | No canary schedule until exact lifecycle/identity authority is reviewed. |

### Required post-#4081 recheck

Before any synthetic rehearsal is promoted beyond source-only evidence, verify the exact merged #4081 head for:

- public lifecycle state names;
- run ownership and fencing token semantics;
- stale-run rejection;
- cleanup ordering and cleanup-failure posture;
- standard canary privacy/non-Browse isolation;
- synthetic provenance sufficient to exclude canary records before baseline aggregation;
- `WRITE_STATUS_UNKNOWN` handling and no-blind-retry behavior;
- test-layer/registry authority;
- absence of provider/Production capability that was not separately approved.

Until this recheck passes:

```text
PENDING_4081_EXACT_HEAD = YES
SYNTHETIC_CANARY_ACTIVATION = NO
```

## 3. Current runtime inventory

**DECIDED from repository evidence**

Current repository/runtime posture:

- Cloudflare Pages Functions provide current same-origin `/api/*` runtime entry surfaces.
- Modal ASGI is an existing runtime and supports named-secret injection in current application code.
- Repository GitHub Actions workflows are CI/concurrency workflows triggered by pull/push authority; no repository-owned scheduled reliability workflow is present.
- No repository `scheduled()` reliability handler or Cloudflare Cron configuration is present.
- No repository Modal periodic/cron reliability function is present.
- `js/observability/reliability-baseline-store-contract.js` is pure dependency-injected source with no DB/network/provider/env/timer capability.
- `js/observability/reliability-alert-delivery-core.js` is provider-neutral source authority only.
- `js/observability/reliability-alert-transport-adapter.js` is explicitly provider-unselected, runtime-unbound, transport-disabled source authority.
- Accepted #3873/#3874 authority records no executable alert transport, alert-specific secret placement, durable dedupe/queue/retry/dead-letter state, scheduled alert workflow, or operator kill switch.
- Repository search found no `MONITOR_SILENT` runtime implementation; dead-man ownership therefore remains a runtime design gate, not existing authority.

Existing environment-symbol names that are relevant only as repository inventory include:

```text
DATABASE_URL
NETLIFY_DATABASE_URL
POSTGRES_URL
FIREBASE_SERVICE_ACCOUNT_JSON
FIREBASE_SERVICE_ACCOUNT
MODAL_BASE_URL
```

These existing broad application names are **not** automatically approved for reliability runtime. In particular, a broad application database credential must not be reused as the future monitor's least-privilege read-only credential merely because it exists.

## 4. Scheduler decision

### Candidate A — Cloudflare Worker Cron Trigger

**PROPOSED / selected recommendation**

Placement:

```text
dedicated reliability Worker
  -> scheduled handler
  -> kill-switch check
  -> run fence
  -> read-only collector
  -> baseline evaluator
  -> bounded telemetry/alert envelope
  -> heartbeat update
```

Reasons for recommendation:

- aligns with #4004's target Cloudflare-native shared backend direction;
- keeps reliability execution outside the user request path;
- supports environment-scoped scheduler configuration and a small dedicated runtime;
- can isolate the monitor credential/bindings from the current application credential surface;
- can be disabled independently from user-facing routes;
- current provider documentation supports Cron Triggers and a `scheduled()` handler on Workers, including current Free-plan availability subject to account quota;
- current provider documentation provides scheduled-event execution history/logging surfaces.

Required before approval:

- exact Worker placement/name;
- account/plan quota check at activation time;
- Preview/non-Production scheduled-handler rehearsal;
- bounded execution timeout and no-overlap fencing;
- explicit scheduler retry posture;
- independent heartbeat observer;
- separate read/synthetic/alert kill switches.

### Candidate B — Modal scheduled function

**PROPOSED ALTERNATIVE, NOT SELECTED**

Modal supports scheduled functions, but repository authority currently contains no reliability schedule. #4004 also moves ordinary API/CRUD responsibility toward Cloudflare while retaining Modal for specialized/background work. Modal remains a credible independent-control-plane candidate for dead-man observation or fallback scheduling, but should not become the primary reliability runner without an explicit owner decision.

Current provider documentation notes that an active Modal schedule is deployed with the app and schedule removal requires changing/redeploying the schedule configuration rather than a standalone pause operation. That is a weaker operator-disable property than a dedicated runtime kill-switch plus separately removable trigger.

### Candidate C — GitHub Actions `schedule`

**NOT RECOMMENDED FOR PRIMARY PRODUCTION RUNNER**

The repository currently uses GitHub Actions as CI authority, not scheduled Production monitoring authority. A future scheduled workflow is technically possible, but scheduled Actions may be delayed under load and public-repository schedules have platform lifecycle behavior outside the application runtime. It is therefore a poor primary Production monitor and should not be used as the only dead-man authority without an explicit reliability acceptance decision.

### Scheduler decision

```text
SCHEDULER_RECOMMENDATION = PROPOSED_CLOUDFLARE_CRON_DEDICATED_RELIABILITY_WORKER
SCHEDULER_APPROVED = NO
SCHEDULER_DECISION_STATE = OWNER_DECISION_REQUIRED
```

No Cron Trigger, Worker, schedule, deployment, or provider configuration is created by this packet.

## 5. Cadence / calibration authority

**OWNER_DECISION_REQUIRED**

No Production cadence is authorized as a source constant.

Required runtime configuration must define, outside the pure source cores:

- normal cadence;
- bounded minimum cadence;
- bounded maximum cadence;
- baseline warm-up requirement;
- baseline sufficiency rule;
- incident-burst policy;
- backoff class;
- collector statement timeout;
- network/runtime timeout;
- maximum run duration;
- maximum bounded retry count for safe read-only collection;
- no-overlap lease/fence expiry;
- alert suppression window.

The packet intentionally specifies **no numeric cadence**.

```text
CADENCE_SOURCE = OWNER_CONFIG_REQUIRED
CALIBRATION_OWNER = OWNER_CONFIG_REQUIRED
```

#4079 calibration remains injected bounded configuration. Absence or insufficiency of baseline evidence must remain `BASELINE_NOT_ESTABLISHED`, `INSUFFICIENT_EVIDENCE`, `MONITORING_FAILED`, or `AUTHORITY_UNAVAILABLE` as appropriate; it must not collapse to `HEALTHY`.

## 6. Private baseline store decision

### Candidate A — SQLite-backed Cloudflare Durable Object

**PROPOSED / selected recommendation**

Recommended future adapter properties:

- one private, non-public reliability namespace;
- exact/raw measurements never returned through a public API or GitHub evidence;
- strongly consistent/transactional per-object storage;
- atomic append/prune/update for one signal-history authority;
- bounded retained sample count and bounded age;
- serialized ownership useful for run fencing and dedupe-state updates;
- separate logical records for baseline history, run lease/fence, heartbeat, and bounded dedupe state;
- easy namespace wipe/rollback after an approved evidence export containing bounded classes only;
- no user-content payloads.

Current Cloudflare documentation states SQLite-backed Durable Objects are available on Workers Free and Paid plans and provide private strongly consistent transactional storage. Account plan/quota and cost must be rechecked immediately before activation; this packet does not assume unused quota.

### Candidate B — dedicated Neon monitoring state

**BLOCKED / NOT RECOMMENDED AS FIRST CHOICE**

A dedicated monitoring table/store could provide transactions, but adding monitor-history schema to the canonical application database would require schema authority and write authority that #4082 explicitly does not grant. It also weakens the clean separation between Production read-only monitoring and the monitor's own mutable state. Do not add such a table under this issue.

### Candidate C — generic key/value state

**NOT SELECTED**

The runtime requires deterministic concurrent-run prevention, bounded history mutation, heartbeat state, and durable dedupe state. A generic state mechanism must prove atomic/concurrency semantics before selection. No repository-backed implementation is currently approved.

### Retention boundary

**OWNER_DECISION_REQUIRED**

Retention must be configured as bounded policy, not inferred from current row totals:

```text
max_samples_per_signal = OWNER_CONFIG_REQUIRED
max_history_age = OWNER_CONFIG_REQUIRED
max_dedupe_entries = OWNER_CONFIG_REQUIRED
max_heartbeat_history = OWNER_CONFIG_REQUIRED
```

Exact event timestamps/counts may remain private inside the store only where required for evaluation/expiry. Public summaries and alerts carry only existing bounded taxonomy/classes.

### Synthetic exclusion

**BLOCKED**

Ordinary-user baseline aggregation must exclude synthetic canary effects before samples enter baseline history. #4079's injected store contract intentionally does not know user/synthetic provenance, and #4081 is not yet merged.

Required future adapter order:

```text
collector result
-> provenance/isolation check
-> reject synthetic canary contribution from ordinary baseline
-> private bounded baseline store
-> #4079 bounded evaluation boundary
```

Until the merged #4081 lifecycle provides exact provenance/ownership evidence and this pre-store exclusion is contract-tested:

```text
SYNTHETIC_BASELINE_EXCLUSION_BLOCKER = YES
SYNTHETIC_BASELINE_EXCLUSION = BLOCKED_ON_4081
```

## 7. Production read-only executor enforcement

**PROPOSED / activation BLOCKED**

The Production collector must use a credential that cannot write even if application code is defective.

Required enforcement layers:

1. **Credential/role separation**
   - dedicated monitor credential;
   - SELECT-only grants on the minimum canonical catalog/schema surfaces;
   - no application writer credential fallback;
   - no DDL/DML grants.

2. **Transaction enforcement**
   - DB role/session defaults to read-only where supported;
   - each collection unit opens an explicit read-only transaction;
   - statement timeout is applied from owner-approved bounded config;
   - transaction is always closed/rolled back after collection.

3. **Query enforcement**
   - use the existing structural-sentinel/query/parity catalog authority;
   - no caller-supplied SQL;
   - bounded aggregate/provenance results only;
   - bounded result size;
   - no raw user rows emitted into monitoring output.

4. **Network/runtime enforcement**
   - owner-configured network deadline;
   - bounded whole-run deadline;
   - cancellation on timeout;
   - concurrent run prevented by a private fence/lease.

5. **Failure posture**
   - timeout, unavailable authority, malformed/missing schema evidence, partial result, or store failure never becomes healthy;
   - use existing `MONITORING_FAILED`, `AUTHORITY_UNAVAILABLE`, `INSUFFICIENT_EVIDENCE`, or the already-authorized bounded taxonomy as applicable;
   - safe read-only retry may occur only under an owner-approved bounded policy; partial evidence from different attempts must not be combined into fabricated completeness.

6. **Audit/privacy**
   - log bounded operation class, outcome class, release SHA, duration/latency bucket, and fixed failure category only;
   - no database URL, role, provider/project/branch identity, raw SQL, raw row, user identifier, request body, response body, or raw exception.

Proposed secret name, not canonical:

```text
PROPOSED_SECRET_NAME: RELIABILITY_READONLY_DATABASE_URL
```

This name must not be created or bound until Phase B approval chooses the runtime secret store and verifies least privilege.

```text
PRODUCTION_READ_PHASE_B_APPROVED = NO
READ_ONLY_SENTINEL_ACTIVATION = NO
```

## 8. Write-outcome telemetry sink

**PROPOSED / not bound**

The sink consumes #4080 results; it does not define a new write vocabulary.

Required semantics:

- preserve all five #4080 write stages;
- never treat acknowledgement as canonical reread confirmation;
- preserve `WRITE_STATUS_UNKNOWN`;
- `WRITE_STATUS_UNKNOWN` always remains `retry_safe=false` and cannot initiate blind write retry;
- reject unknown/private fields before persistence;
- never store raw request/response payload, raw error, URL, SQL, user/Tree/Memory identifiers, content, or provider identity;
- sink failure never blocks or mutates the normal user write path;
- telemetry failure is monitoring failure, not write success;
- public alerting consumes only the existing bounded outcome/stage/evidence fields.

Recommended state placement is the same private reliability state authority selected for baseline/dedupe, but in a separate logical record family with separate retention policy. Binding a live write-path producer to that sink requires a separate integration approval and source review.

```text
TELEMETRY_SINK_BINDING = NO
```

## 9. Alert provider / dedupe

### Current provider state

**DECIDED**

Merged #3874 authority is:

```text
provider_class = PROVIDER_UNSELECTED
runtime_binding = NOT_BOUND
production_transport = DISABLED
preview_transport = DISABLED
```

The accepted #3873 audit found no executable provider transport, alert-specific secret placement, durable dedupe/queue/retry/dead-letter state, scheduled alert workflow, or provider binding.

### Provider candidates

**OWNER_DECISION_REQUIRED**

The repository does not currently authorize a concrete provider. Candidate classes remain evaluation inputs only:

- external incident/on-call provider;
- external bounded webhook transport;
- bounded email/notification transport.

A provider may be selected only after comparing:

- free/paid account fit;
- owner routing/escalation;
- secret injection/rotation;
- request timeout;
- bounded retry behavior;
- provider rate limits;
- delivery observability;
- recovery notifications;
- Preview/sandbox isolation;
- provider disable path.

No provider name is canonicalized by this packet.

```text
ALERT_PROVIDER_RECOMMENDATION = OWNER_DECISION_REQUIRED
ALERT_PROVIDER_APPROVED = NO
ALERT_PROVIDER_BINDING = NO
```

### Alert body

Reuse `reliability-alert-delivery-core.js` canonical bounded envelope. Do not add provider metadata or free-form fields. Severity/owner/advisory mappings remain the merged source authority (`INFO`, `WARNING`, `BLOCKING` and its fixed owner/action mappings); the provider adapter only transports them.

### Durable dedupe

**PROPOSED**

Persist only:

- canonical `dedupe_fingerprint`;
- bounded delivery state;
- bounded retry-attempt class;
- expiry/suppression metadata required by owner-configured retention.

Do not persist raw alert envelopes, content, IDs, URLs, provider bodies, raw exceptions, or arbitrary metadata.

Suppression-window duration is not invented here:

```text
ALERT_SUPPRESSION_WINDOW = OWNER_CONFIG_REQUIRED
```

If dedupe state is unavailable or invalid, use the existing fail-closed transport posture; do not fan out duplicate alerts speculatively.

Recovery notification must be a bounded transition generated from existing authorized state/outcome classes, not a raw incident narrative. Exact provider recovery behavior is part of provider-specific approval.

## 10. Heartbeat / dead-man ownership

**OWNER_DECISION_REQUIRED**

The monitor runner must publish a private heartbeat only after a bounded run-state transition. The runner itself cannot be the sole authority that decides whether it is silent.

Required architecture:

```text
primary scheduler / runner
  -> private heartbeat update

independent observer on a different scheduling/control-plane authority
  -> read heartbeat freshness
  -> distinguish authorized-disable from unexpected silence
  -> emit existing bounded monitoring-failure/alert path
```

The independent observer must detect or conservatively classify:

- runner crash;
- primary scheduler failure;
- deployment failure;
- primary store failure;
- provider failure;
- network partition.

A heartbeat/store/observer failure never maps to `HEALTHY`.

If Cloudflare Cron is approved as the primary runner, the dead-man observer must not depend solely on the same Cloudflare Cron trigger/control plane. Modal scheduling is a plausible separate-control-plane candidate consistent with #4004's retained background-work role; a dedicated external observer is another candidate. GitHub Actions is not recommended as the sole dead-man due to scheduling delay/lifecycle characteristics.

Final heartbeat/dead-man owner remains:

```text
HEARTBEAT_OWNER = OWNER_DECISION_REQUIRED
DEADMAN_OWNER = OWNER_DECISION_REQUIRED
HEARTBEAT_OWNER_APPROVED = NO
```

## 11. Kill switches

All names below are **proposed config names**, not existing canonical bindings.

### A. Read-only sentinel

```text
PROPOSED_CONFIG_NAME: RELIABILITY_READ_SENTINEL_ENABLED
owner: OWNER_DECISION_REQUIRED
default before activation: false
disable effect:
  scheduler may still invoke, but runner exits before DB credential resolution/query
residual effect:
  dead-man observer must recognize an authoritative operator-disabled posture
verification:
  query count remains zero after disable; user routes unchanged
```

### B. Synthetic canary

```text
PROPOSED_CONFIG_NAME: RELIABILITY_SYNTHETIC_CANARY_ENABLED
owner: OWNER_DECISION_REQUIRED
default before activation: false
disable effect:
  no synthetic write dispatch; cleanup of already-owned artifacts still follows #4081 authority
residual effect:
  owned cleanup may remain required for a run already started
verification:
  no new synthetic dispatch; stale run cannot regain ownership
```

### C. Alert delivery

```text
PROPOSED_CONFIG_NAME: RELIABILITY_ALERT_DELIVERY_ENABLED
owner: OWNER_DECISION_REQUIRED
default before activation: false
disable effect:
  map future runtime control to operator-disabled/transport-disabled posture before provider effect
residual effect:
  private monitor evaluation/heartbeat may continue; no provider delivery
verification:
  provider effect count stays zero while monitoring state remains observable
```

The three switches must be independently deployable/revocable and must not share one ambiguous master permission.

## 12. Rollback

**PROPOSED**

Rollback order is deliberately capability-reducing:

1. disable alert delivery;
2. disable synthetic canary dispatch;
3. disable read-only sentinel query execution;
4. remove/disable the primary scheduler trigger if necessary;
5. revoke/unbind alert-provider secret/binding;
6. revoke/unbind read-only monitor credential;
7. disable the independent observer only after confirming the primary runner is intentionally inactive;
8. preserve only bounded forensic state required for review;
9. wipe the private baseline/dedupe namespace if owner-approved and no forensic retention requirement remains;
10. verify user-facing application routes, writes, auth, and data are unchanged;
11. verify no stale scheduled run can reacquire ownership after rollback.

Rollback must not require application DB DDL/DML.

## 13. Secret-name inventory

### Existing repository symbolic names

Inventory only; not approved for the reliability runtime:

```text
DATABASE_URL
NETLIFY_DATABASE_URL
POSTGRES_URL
FIREBASE_SERVICE_ACCOUNT_JSON
FIREBASE_SERVICE_ACCOUNT
MODAL_BASE_URL
```

No value was inspected or recorded.

### Proposed future names

Not canonical until owner/Web CTO approval:

```text
PROPOSED_SECRET_NAME: RELIABILITY_READONLY_DATABASE_URL
PROPOSED_SECRET_NAME: RELIABILITY_ALERT_PROVIDER_TOKEN
```

If the selected provider does not use a token-shaped secret, the second name must be replaced by a provider-appropriate symbolic name during the provider-specific child. Do not create generic aliases that encourage fallback to a broader application credential.

## 14. Privacy controls

**DECIDED requirements / audit PASS for this document**

Runtime and evidence must never expose:

- secret values or connection strings;
- email or authorization data;
- user/owner/Tree/Memory/comment/reaction identifiers;
- raw request/response body;
- title/content/description;
- raw SQL or catalog rows;
- raw errors/stacks/provider responses;
- provider account/project/deployment identifiers;
- exact raw baseline counts in public/GitHub output.

Allowed public evidence is bounded taxonomy/classes, release SHA, bounded latency/deviation/evidence classes, canonical dedupe fingerprint, and fixed delivery/monitoring outcome classes already authorized by the source cores.

Exact/raw baseline measurements may exist only inside the approved private baseline store and must be excluded from alerts and GitHub evidence.

## 15. Preview / non-Production rehearsal

**PROPOSED / execution not authorized by this packet**

Run only after a separate Preview/non-Production provider/runtime authorization.

Required rehearsal matrix:

1. **Scheduler invocation**
   - invoke the scheduled handler in non-Production;
   - prove correct environment binding;
   - prove concurrent invocation is fenced;
   - prove a stale lease cannot continue.

2. **Private baseline store**
   - write/read bounded synthetic baseline history;
   - atomic concurrent update;
   - retention prune;
   - bounded wipe;
   - store unavailable -> non-healthy;
   - no public raw count exposure.

3. **Read-only collector**
   - allowed read succeeds against non-Production data;
   - DML and DDL attempts are denied by credential/transaction authority;
   - statement timeout -> bounded failure;
   - network timeout -> bounded failure;
   - partial result is not treated as complete;
   - schema authority unavailable/mismatch -> non-success.

4. **#4080 telemetry**
   - all canonical write stages remain distinct;
   - acknowledged-but-reread-missing;
   - `WRITE_STATUS_UNKNOWN` -> no blind retry;
   - sink unavailable -> user path remains governed only by canonical application behavior while monitoring records failure.

5. **Heartbeat/dead-man**
   - healthy heartbeat;
   - runner crash/silence;
   - scheduler disabled unexpectedly;
   - store unavailable;
   - network partition simulation;
   - observer failure;
   - deliberate operator disable does not masquerade as an incident, but loss of disable-state authority fails closed.

6. **Alert transport**
   - provider sandbox/fake effect only until provider-specific Preview authority exists;
   - timeout/reject/unavailable;
   - retry bound;
   - canonical dedupe suppression;
   - recovery notification;
   - provider kill switch -> effect count zero.

7. **Kill switches / rollback**
   - independently toggle read-only, synthetic, and alert controls;
   - prove no cross-activation;
   - remove scheduler;
   - unbind proposed nonprod secrets;
   - verify no stale invocation resumes.

8. **Synthetic exclusion**
   - after #4081 exact-head integration, create only approved non-Production synthetic fixtures;
   - prove canary-originated effects are removed before ordinary-user baseline aggregation;
   - prove cleanup failure cannot cause a synthetic sample to become ordinary baseline authority.

9. **Privacy/log audit**
   - scan logs, alert body, store/public boundary, CI evidence;
   - raw private data/secret values/identifiers must be zero.

Required result before Production activation:

```text
PREVIEW_REHEARSAL_PASS = YES
```

Current result:

```text
PREVIEW_REHEARSAL_PASS = NO
```

because no rehearsal has been authorized or executed by #4082.

## 16. Synthetic isolation

**BLOCKED ON #4081**

The runtime adapter must maintain two distinct private facts:

```text
sample provenance = ordinary vs approved synthetic authority
baseline eligibility = ordinary-only for user baseline aggregation
```

These are conceptual private runtime facts, not new public taxonomy. The exact implementation must consume the merged #4081 provenance/lifecycle contract rather than invent a parallel canary vocabulary.

Required invariant:

```text
synthetic canary artifact/effect
  NEVER
ordinary-user baseline sample
```

If provenance is missing, malformed, stale, or cleanup/ownership is uncertain, the sample is excluded and monitoring remains non-healthy/insufficient rather than treating it as ordinary evidence.

## 17. Remaining blockers

**BLOCKED / OWNER_DECISION_REQUIRED**

Activation blockers:

1. `PENDING_4081_EXACT_HEAD`.
2. Production schema/provenance usability is not yet an approved activation premise; current convergence work retains adoption/runtime holds.
3. Production read-only Phase B approval is absent.
4. Scheduler recommendation is not owner-approved and cadence values are unset.
5. Private baseline-store provider/binding/retention is not owner-approved.
6. Synthetic baseline exclusion is not yet proven against merged #4081.
7. Alert provider is explicitly unselected.
8. Alert secret placement/rotation owner is not approved.
9. Durable dedupe/suppression persistence is not bound.
10. Independent heartbeat/dead-man owner is not selected.
11. Kill-switch names/owners are proposed only and not proven in a rehearsal.
12. Preview/non-Production rehearsal is not executed.
13. Production synthetic-write authority remains separately absent.

## 18. Explicit activation checklist

| Gate | Current state |
| --- | --- |
| #4079 COMPLETE | YES |
| #4080 COMPLETE | YES |
| #4081 COMPLETE | NO — `PENDING_4081_EXACT_HEAD` |
| STRUCTURAL_PARITY_COMPLETE | YES |
| SCHEMA_PROVENANCE_APPROVED | NO |
| PRODUCTION_READ_PHASE_B_APPROVED | NO |
| PRIVATE_BASELINE_STORE_APPROVED | NO |
| SCHEDULER_APPROVED | NO |
| ALERT_PROVIDER_APPROVED | NO |
| HEARTBEAT_OWNER_APPROVED | NO |
| KILL_SWITCH_PROVEN | NO |
| PREVIEW_REHEARSAL_PASS | NO |
| PRIVACY_AUDIT_PASS | YES — packet/document boundary only |
| READ_ONLY_SENTINEL_ACTIVATION | NO |
| SYNTHETIC_CANARY_ACTIVATION | NO |
| ALERT_DELIVERY_ACTIVATION | NO |

## Owner/Web CTO decisions required

Before activation, explicitly decide:

1. approve/reject the proposed Cloudflare Cron dedicated reliability Worker;
2. supply cadence/timeout/backoff/fence bounds;
3. approve/reject the proposed SQLite-backed Durable Object private baseline/dedupe/heartbeat store;
4. define retention bounds;
5. approve a least-privilege Production read-only credential and Phase B execution boundary;
6. select a concrete alert provider and secret-store/rotation owner, or keep alert delivery disabled;
7. define alert suppression/retry bounds;
8. select an independent dead-man owner/control plane;
9. approve the three independent kill-switch names/owners;
10. approve Preview/non-Production rehearsal authority;
11. after #4081 merges, accept/reject the exact synthetic provenance/fencing/cleanup/exclusion contract;
12. separately approve or reject Production synthetic-write activation.

## Packet completion state

This document is complete as a **pre-activation decision packet**, but the runtime binding completion marker is deliberately withheld while source/runtime prerequisites remain open.

```text
APPROVAL_PACKET_PREPARATION = COMPLETE
C4_RUNTIME_BINDING_APPROVAL_PACKET_READY = NO
READY_FOR_WEB_CTO_REAUDIT = YES

RUNTIME_ACTIVATION = NO
PRODUCTION_READ_AUTHORITY = NO
PRODUCTION_SYNTHETIC_WRITE_AUTHORITY = NO
ALERT_PROVIDER_BINDING = NO

READY = NO
MERGE = NO
#3461_CLOSE = NO
#1882_CLOSE = NO
```
