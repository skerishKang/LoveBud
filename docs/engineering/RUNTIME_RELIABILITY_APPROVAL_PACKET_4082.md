# Runtime Reliability Approval Packet — Issue #4082

Status: **PRE-ACTIVATION / NON-ACTIVATING**

Parent: #3461 — KEEP OPEN

Protected: #1882 — KEEP OPEN

Packet owner: WEB-3

Current-main reconciliation snapshot: `main@f7c8e3bcf8737046ec3049ec442c947eab1895bc`

Post-#4227 disabled NONPROD Provider Preview reconciliation: **PROVIDER PREVIEW COMPLETE / PASS; WORKER EXISTS; SQLITE DO NAMESPACE ESTABLISHED; CRON/SENTINEL/ALERT/PRODUCTION/PRODUCT REMAIN DISABLED OR UNBOUND**

Post-#4081 reconciliation: **COMPLETE FOR SOURCE AUTHORITY; RUNTIME ACTIVATION REMAINS UNAUTHORIZED**

Post-#4091 provenance source-model reconciliation: **COMPLETE FOR SOURCE MODEL; RUNNER ADOPTION / PRODUCTION PHASE-B REMAIN SEPARATELY UNAUTHORIZED**

This document is the bounded owner/Web-CTO decision packet requested by #4082. It records what source authority now exists, recommends runtime components, and enumerates every separate approval that still blocks Production capability.


### 2026-09-27 superseding current-authority reconciliation

This section supersedes stale state labels elsewhere in this packet where they conflict with later issue authority or completed #4227 evidence.

```text
CURRENT_MAIN = 569836d0a3df7a995cc02c4eef23d16f365eb1a5
DISABLED_NONPROD_PROVIDER_PREVIEW_REHEARSAL = PASS
WORKER_EXISTS = YES
SQLITE_DO_NAMESPACE = ESTABLISHED
SQLITE_STORAGE_BACKEND = SQLITE
SQLITE_DO_LIFECYCLE = ESTABLISHED
DO_INSTANCE_INITIALIZED = UNOBSERVED
CRON_TRIGGER_ATTACHED = NO
READ_ONLY_SENTINEL_ACTIVATION = NO
ALERT_DELIVERY_ACTIVATION = NO
PRODUCTION_RUNTIME_READ_AUTHORITY = NO
PRODUCTION_SYNTHETIC_WRITE_AUTHORITY = NO
```

Decision-only children already resolved the former design-selection gaps:

```text
PRIMARY_SCHEDULER = CLOUDFLARE_WORKER_CRON_TRIGGER_DEDICATED_RELIABILITY_WORKER / SELECTED_NOT_BOUND
PRIVATE_STORE = SQLITE_BACKED_CLOUDFLARE_DURABLE_OBJECT / SELECTED_NOT_BOUND
ALERT_PROVIDER = SLACK_APP_INCOMING_WEBHOOK / SELECTED_NOT_BOUND
DEAD_MAN_CONTROL_PLANE = MODAL_SCHEDULED_FUNCTION / SELECTED_NOT_BOUND
RUNTIME_BOUNDS = SELECTED_NOT_BOUND
INITIAL_COLLECTOR_SIGNAL_SET = SELECTED_NOT_BOUND
READONLY_EXECUTOR_SECURITY_ENVELOPE = SELECTED_NOT_BOUND
INITIAL_SIGNAL_CALIBRATION_POLICY = SELECTED_NOT_BOUND
AGGREGATE_COUNT_CALIBRATION = NO_NUMERIC_BASELINE_CALIBRATION / ABSOLUTE_ZERO_NONZERO_STRUCTURAL_INVARIANT
PARITY_EVIDENCE_CALIBRATION = NO_NUMERIC_CALIBRATION / CATEGORICAL_PARITY_TRANSLATION_ONLY
DEFERRED_SIGNAL_CALIBRATION = EXCLUDED
STRUCTURAL_RUNTIME_COMPOSITION_SOURCE = COMPLETE_#4500_#4501
CALIBRATION_FREE_HARD_SIGNALS = WIRED_SOURCE_ONLY
INITIAL_STRUCTURAL_SIGNAL_IDENTITY = DETERMINISTIC
```

`SELECTED_NOT_BOUND` is not activation authority. The remaining blockers are capability/binding gates, not provider-preview or component-selection gaps:

```text
NONPROD_RUNTIME_REHEARSAL_MATRIX = INCOMPLETE
CRON_ATTACHMENT_AUTHORITY = NO
READ_ONLY_DB_CREDENTIAL_RUNTIME_BINDING = NOT_CREATED
REAL_PRODUCTION_READONLY_COLLECTOR_BOUND = NO
PRODUCTION_RUNTIME_READ_AUTHORITY = NO
SLACK_APP_WEBHOOK_SECRET_BOUND = NO
ALERT_DELIVERY_ACTIVATION = NO
INDEPENDENT_DEAD_MAN_RUNTIME_BOUND = NO
SYNTHETIC_CANARY_ACTIVATION = NO
PRODUCTION_SYNTHETIC_WRITE_AUTHORITY = NO
PRODUCTION_ACTIVATION_AUTHORITY = NO
```

The completed #4227 Provider Preview does not itself authorize any of these gates.

It does **not** grant Production read authority, Production synthetic-write authority, scheduler activation, Durable Object binding, alert-provider binding, secret placement, QA-account creation, deployment authority, or schema mutation authority.

## 1. Authority dimensions — never collapse these axes

The following dimensions are independent:

```text
SOURCE_AUTHORITY = MERGED_FOR_#4061_#4079_#4080_#4081_#4091_#3861_#3874
RUNTIME_BINDING_DECISION = RECOMMENDATION_ONLY
PRODUCTION_ACTIVATION_AUTHORITY = NONE
```

A merged source contract is not a runtime binding. A selected runtime design is not Production activation authority. Production activation requires the exact separate approvals listed in this packet.

### Three independent activation gates

```text
READ_ONLY_SENTINEL_ACTIVATION = NO
SYNTHETIC_CANARY_ACTIVATION = NO
ALERT_DELIVERY_ACTIVATION = NO
```

Approval of one gate does not approve either of the others.

Current overall authority:

```text
APPROVAL_PACKET_PREPARATION = COMPLETE_CURRENTNESS_RECONCILIATION
PACKET_DOCUMENT_CURRENTNESS = CURRENT_AT_569836d0a3df7a995cc02c4eef23d16f365eb1a5
C4_RUNTIME_BINDING_APPROVAL_PACKET_READY = NO
RUNTIME_ACTIVATION = NO
PRODUCTION_READ_AUTHORITY = NO
PRODUCTION_SYNTHETIC_WRITE_AUTHORITY = NO
ALERT_PROVIDER_BINDING = NO
```

## 2. Current merged source-authority matrix

| Authority | Current state | Canonical source / consequence |
| --- | --- | --- |
| #4060 / PR #4061 structural schema + migration-parity sentinel | `MERGED_SOURCE_AUTHORITY` | `js/observability/reliability-structural-sentinel-query-catalog.js` and `js/observability/reliability-structural-sentinel-core.js`; consumes bounded #3860 parity outcomes only. `CATALOGUED != APPLIED`; Production collector capability remains absent. |
| #4079 / PR #4087 baseline-aware anomaly evaluation | `MERGED_SOURCE_AUTHORITY` | `js/observability/reliability-baseline-store-contract.js` and `js/observability/reliability-anomaly-evaluator-core.js`; pure/dependency-injected, raw measurements stay behind a private-store adapter boundary. |
| #4080 / PR #4084 write-outcome classification | `MERGED_SOURCE_AUTHORITY` | `js/observability/reliability-write-outcome-classifier-core.js`, `modal_compute/write_outcome_classification.py`, and `functions/_shared/write-outcome-edge-facts.js`; classification only, no write/retry/sink capability. |
| #4081 / PR #4090 synthetic canary lifecycle | `MERGED_SOURCE_AUTHORITY` | Merged into `main` by `7c454785c86a018a65908854c3bd2abd9613a081`; primary source `js/observability/reliability-canary-lifecycle-core.js`; Production capability remains `NONE`. |
| #4091 / PR #4092 catalog-populated adoption provenance model | `MERGED_SOURCE_AUTHORITY` | Merged into `main` by `590d22b22bbeaacb7157f402115e873b03ed1743`; `scripts/adoption-attestation-core.cjs` accepts `ADOPTION_REQUIRED + populated canonical catalog` as valid PREPARED/UNATTESTED input, keeps `prepared.applied_migrations = []`, and preserves `CATALOGUED != APPLIED` / `UNATTESTED != ACTIVE`. No runner activation or Phase-B authority is granted. |
| #3861 provider-neutral alert delivery core | `MERGED_SOURCE_AUTHORITY` | Bounded envelope/delivery-state authority only; no concrete provider. |
| #3874 provider-unselected transport adapter | `MERGED_SOURCE_AUTHORITY` | `js/observability/reliability-alert-transport-adapter.js`; `PROVIDER_UNSELECTED`, `NOT_BOUND`, Preview/Production transport disabled. |
| #4007 schema/data convergence documentation | `MERGED_READ_ONLY_EVIDENCE_AUTHORITY` | Live read-only catalog evidence exists, but it does not replace canonical migration provenance/runner adoption authority. |
| #4059 Memory `clientKey` runtime | `MERGED_CAPABILITY_GATED_RUNTIME_SOURCE` | Runtime source can honor Tree-scoped `clientKey` only when the required schema capability is present; #4059 did not authorize Production schema apply. |
| #4005 post-#4059 provenance governance | `OPEN_GOVERNANCE_AUTHORITY` | The latest central #4005 authority established live schema presence plus canonical provenance/adoption debt and `CANONICAL_RUNNER_ADOPTION = HOLD`. #4091 resolves the source-model composition defect only; no post-#4091 WEB-1/central verdict currently promotes runner adoption or Production Phase-B read authority. |

### #4061 structural/parity boundary

The runtime adapter must preserve the merged structural/parity separation:

```text
canonical expected-schema / #3860 bounded parity authority
-> bounded parity outcome
-> #4061 source-only parity translation
-> #3835 bounded sentinel result
```

The runtime must not create a second schema fingerprint/parity engine and must never infer `APPLIED` from a catalog entry.

### #4079 baseline boundary

The runtime store adapter may retain exact measurements privately, but the evaluator continues to receive only bounded baseline classifications. No Production threshold, cadence, or sensitivity may be invented as a source constant; all calibration is bounded owner-approved configuration.

### #4080 write-outcome boundary

The runtime telemetry adapter must keep these stages distinct:

```text
REQUEST_ACCEPTED
DB_TRANSACTION_COMMITTED
CANONICAL_ROW_RETURNED
FOLLOWUP_REREAD_VISIBLE
CLIENT_VISIBLE_SUCCESS
```

`WRITE_ACKNOWLEDGED != CANONICAL_REREAD_CONFIRMED` remains mandatory. `WRITE_STATUS_UNKNOWN` remains `retry_safe=false`; no runtime binding may add blind retry authority.

## 3. #4081 post-merge delta — exact contract consumed by runtime binding

#4081 is now merged source authority, not a pending dependency.

```text
#4081_STATE = MERGED_SOURCE_AUTHORITY
#4081_MERGE_MAIN_SHA = 7c454785c86a018a65908854c3bd2abd9613a081
#4081_PRIMARY_SOURCE = js/observability/reliability-canary-lifecycle-core.js
#4081_PRODUCTION_CAPABILITY = NONE
```

The runtime integration must preserve the merged lifecycle vocabulary and semantics without widening them:

```text
IDLE
-> AUTH_ACQUIRED
-> FIXTURE_READY
-> MEMORY_WRITE_DISPATCHED
-> MEMORY_WRITE_ACKNOWLEDGED
-> CANONICAL_REREAD_CONFIRMED
-> OWNER_READ_CONFIRMED
-> optional VISIBILITY_OBSERVED
-> CLEANUP_CONFIRMED | FIXTURE_RETAINED_DETERMINISTIC

failure/control terminals:
BOUNDED_STAGE_FAILURE | CLEANUP_FAILED | FENCED
```

Mandatory post-merge invariants:

- run fencing is explicit and bounded; stale or superseded runners cannot write or clean up;
- ownership is revalidated immediately before mutation/cleanup;
- ownership mismatch fails closed to `FENCED`;
- `WRITE_STATUS_UNKNOWN` performs canonical reread/reconciliation first, with no blind retry and no second dispatch;
- only a confirmed write outcome can proceed toward success;
- canonical reread requires explicit positive confirmation rather than non-throwing execution;
- post-write owner confirmation requires explicit positive owner match;
- post-write ownership loss is `FENCED`;
- configured Browse observation requires explicit negative confirmation for the standard private canary; malformed/throwing observation fails closed;
- injected effects are await-safe; rejected asynchronous effects are bounded failures;
- standard synthetic canary remains private and non-Browse-eligible;
- the fixed synthetic exclusion marker is `SYNTHETIC_CANARY_EXCLUDED`;
- no token, credential, email, UID, owner/tree/memory ID, fixture ID, fence token/generation, raw content, raw count, connection string, SQL, or raw error may cross the public boundary;
- merged source carries no network, database, provider, scheduler, timer, secret, filesystem-write, deployment, or Production capability.

Future runtime bindings may provide the injected effects only after their own approval gates. They must not modify, bypass, weaken, or reinterpret these source contracts.

## 4. Current runtime inventory

Current repository evidence supports the following placement facts:

- user-facing same-origin `/api/*` surfaces are under Cloudflare Pages Functions;
- Modal remains an existing application/background runtime and supports application-side secret injection patterns;
- repository GitHub Actions workflows are CI/concurrency workflows; no repository-owned scheduled reliability workflow exists;
- since PR #4149 merged, `workers/reliability-preview/reliability-preview-worker.mjs` publishes a dedicated reliability `scheduled()` handler source and `workers/reliability-preview/wrangler.reliability-preview.toml` declares an env-specific Cron trigger shape (`*/5 * * * *`) — SOURCE DECLARATION ONLY;
- the same Wrangler config declares a SQLite Durable Object class export (`ReliabilityPreviewStore`, storage="sqlite") and its environment binding — SOURCE DECLARATION ONLY;
- PROVIDER PREVIEW = PASS: the disabled NONPROD Worker exists and the `ReliabilityPreviewStore` Durable Object namespace is established on SQLite. No Durable Object instance initialization is claimed (`DO_INSTANCE_INITIALIZED = UNOBSERVED`). Cron remains unattached, sentinel and alert remain disabled, and no Production/Product capability is bound;
- #4079, #4080, #4081, #3861, and #3874 source modules are pure/source-only or injected-effect contracts, not live runtime integrations.

Therefore the packet recommends new **isolated reliability runtime components**, but does not create any of them.

### Post-#4149 NONPROD reliability-preview reconciliation (#4175)

PR #4149 published the eight-file NONPROD preview runtime package (#4148). The packet inventory keeps these axes strictly separated:

```text
SOURCE DECLARATION = EXISTS        (scheduled() entrypoint, SQLite DO export/binding, */5 cron shape, observability declaration)
PROVIDER RESOURCE  = CREATED_DISABLED_NONPROD   (Worker exists; SQLite DO namespace established)
CRON ACTIVATION    = NOT DONE      (no trigger attached)
PROVIDER PREVIEW   = PASS          (#4227 completed)
DO INSTANCE INITIALIZATION = UNOBSERVED
PRODUCTION AUTHORITY = NO
```

Release provenance (#4175): the exact deployed source revision is injected externally through `RELIABILITY_PREVIEW_RELEASE_SHA` — precisely one 40-character hexadecimal full SHA (lowercase normalization allowed); missing/malformed/non-hex/all-zero values classify `INVALID_RELEASE_SHA` and fail closed BEFORE any collector, store, or transport invocation. No SHA is hard-coded in source and there is no current-main fallback. The variable is plain deploy configuration, not a secret, so no value is recorded in this packet.

Kill-switch env wiring (#4175): the NONPROD preview worker passes `env[RELIABILITY_READ_ONLY_SENTINEL_ENABLED]` and `env[RELIABILITY_ALERT_DELIVERY_ENABLED]` into `createPreviewConfig(...)`. Values are trimmed and lowercased; normalized `"true"` enables a switch, while every other value stays DISABLED. The two switches stay independent and both default DISABLED. This wiring creates no Cloudflare variable and activates nothing.

Current unbound runtime seams: `previewCollectEffect()` remains `Promise.resolve([])`, so no real Production collector is bound. `calibrationBySignal` remains empty by design for the selected initial structural hard signals: #4499 selected no numeric calibration for aggregate-count/parity evidence, and #4500/#4501 wired those hard signals through the runner without weakening calibration requirements for future baseline-aware signals.

Dead-man reader status: `createPreviewDeadManReader()` remains a source factory only. #4207 selected a Modal scheduled function as the independent control plane and #4210 selected a 7-minute stale threshold, but the reader/runtime binding and bounded probe authority remain unbound (`DEAD_MAN_READER = SOURCE_FACTORY_ONLY`).

Provider Preview choreography is governed by the post-#4225 declarative-`exports` correction. The first three stages are now completed evidence from #4227; later capability stages remain independently gated:

```text
DECLARATIVE_EXPORTS_WRANGLER_MIN_VERSION = 4.107.0
WRANGLER_SELECTION = EXACT_PIN_AT_OR_ABOVE_MINIMUM
DRY_RUN_DEPLOY_VERSION_EQUALITY = REQUIRED
EXPORTS_MODEL = RETAIN
EXPORTS_WITH_VERSIONS_UPLOAD = FORBIDDEN
LEGACY_MIGRATIONS_SWITCH = FORBIDDEN_IN_THIS_LANE

1. source validation .................... COMPLETE / PASS
2. disabled NONPROD Provider deploy ..... COMPLETE / PASS (#4227; exact Wrangler 4.141.0; one deploy; retry 0)
3. disabled Provider evidence ........... COMPLETE / PASS (#4227; Worker exists; SQLite DO namespace established; instance initialization unobserved)
4. Cron attachment ...................... SEPARATE_OWNER_GATE / NOT AUTHORIZED
5. read-only sentinel ................... SEPARATE_OWNER_GATE / NOT AUTHORIZED
6. alert delivery ....................... SEPARATE_PROVIDER_SECRET_GATE / NOT AUTHORIZED
7. Production ........................... EXPLICIT_OWNER_WEB_CTO_GATE / NOT AUTHORIZED
```

The disabled base Provider deployment keeps `crons = []`, read-only sentinel OFF, alert delivery OFF, Production credential absent, and synthetic capability absent. A future Cron attachment is a separate provider/config mutation and must not silently broaden read-only, alert, Product, or Production authority. `compatibility_date` stays pinned at `2025-05-01` pending evidence of runtime semantic drift.

## 5. Scheduler decision

### Selected topology (not bound)

```text
PRIMARY_SCHEDULER = CLOUDFLARE_WORKER_CRON_TRIGGER_DEDICATED_RELIABILITY_WORKER
PRIMARY_SCHEDULER_STATE = SELECTED_NOT_BOUND
SCHEDULER_ACTIVATION = NO
CRON_ATTACHMENT_AUTHORITY = NO
```

A dedicated reliability Worker with a Cron Trigger is the preferred primary runner because it fits the repository's existing Cloudflare edge ownership while remaining outside normal user request paths.

Proposed execution shape:

```text
Cron Trigger
-> dedicated reliability Worker scheduled() handler
-> READ_ONLY_SENTINEL kill-switch check
-> run fence / ownership check
-> approved read-only collector
-> #4061 structural/parity translation
-> #4079 baseline evaluation
-> bounded state / heartbeat update
-> optional separately-approved alert delivery
```

Design requirements before activation:

- dedicated Worker identity/placement, not a user-facing route handler;
- environment-specific schedule configuration;
- bounded whole-run timeout;
- no-overlap lease/fence;
- bounded collector timeout;
- execution-history/log visibility containing bounded classes only;
- independent heartbeat/dead-man observer;
- immediate logical disable through the read-only sentinel kill switch;
- trigger removal as a second rollback mechanism;
- no broad application credential reuse;
- no runtime failure may block or delay primary application traffic.

Cloudflare Cron configuration changes, including deletion, may take time to propagate. Therefore trigger deletion is not the sole emergency control: the runtime kill switch must default to disabled and short-circuit the handler before capability use.

### Alternatives audited

**Modal scheduled function — secondary candidate, not selected as primary.** Modal supports cron/period schedules and execution logs, but current Modal scheduling has no direct pause operation; removing a schedule requires code/config change and redeployment. Modal remains a reasonable candidate control plane for an independent dead-man observer only after separate owner approval and a bounded cross-plane heartbeat design.

**GitHub Actions schedule — not selected as primary Production monitor.** Repository Actions are currently CI authority, not Production reliability runtime authority. Adding a scheduled workflow would introduce a new Production/control-plane role and does not satisfy the independent runtime ownership goal without a separate decision.

## 6. Private baseline / dedupe / heartbeat store decision

### Selected topology (not bound)

```text
PRIVATE_RELIABILITY_STORE = SQLITE_BACKED_CLOUDFLARE_DURABLE_OBJECT
PRIVATE_STORE_STATE = SELECTED_NOT_BOUND
PRIVATE_STORE_ACTIVATION = DISABLED_NONPROD_NAMESPACE_ESTABLISHED_ONLY
```

Why this store:

- Durable Object storage is private to the object and suited to serialized coordination;
- SQLite-backed Durable Object storage provides transactional/strongly-consistent state suitable for bounded baseline history, run fencing, dedupe state, and heartbeat state;
- the mutable reliability state remains separate from the application database and therefore does not require #4082 to add monitoring tables to Production Postgres;
- a dedicated namespace can be disabled/wiped independently from user data after separately-approved evidence handling.

### Allowed data classes

Only bounded/private reliability state is allowed:

```text
baseline_sample_history:
  signal_id from fixed source vocabulary
  exact measurement only inside private store
  bounded retention metadata

run_lease_and_fence:
  opaque run ownership key
  bounded expiry/generation state

heartbeat:
  last successful run time internally
  bounded last outcome class
  bounded source release SHA

dedupe:
  canonical bounded fingerprint
  bounded delivery-state class
  bounded expiry metadata

write_outcome_telemetry:
  #4080 bounded stage/outcome/evidence fields only
  no user payload or identifier
```

Forbidden even inside this store unless a future separately-reviewed contract explicitly changes the boundary:

```text
raw user content
title / description / memo
email / UID / owner ID / Tree ID / Memory ID
provider/account/project identifiers
secret or credential values
connection strings
raw SQL / raw database rows
raw request/response bodies
raw exception / stack
```

### Retention / corruption / unavailable behavior

Decision-only child #4210 selected the initial runtime bounds, but they remain not bound to an activated Production runtime.

```text
MAX_SAMPLES_PER_SIGNAL = 8640 / SELECTED_NOT_BOUND
MAX_HISTORY_AGE = 30d / SELECTED_NOT_BOUND
MAX_DEDUPE_ENTRIES = 2048 / SELECTED_NOT_BOUND
MAX_HEARTBEAT_HISTORY = 2016 / SELECTED_NOT_BOUND
```

Retention must be bounded by both count and/or age as appropriate and exercised in Preview/non-Production before activation.

Failure posture:

- store unavailable/corrupt/unreadable => `MONITORING_FAILED` or `AUTHORITY_UNAVAILABLE`, never `HEALTHY`;
- no new Product write is permitted as fallback;
- no fallback to application Postgres for mutable monitor state;
- read-only sentinel run must stop before publishing a healthy result if required baseline/fence state is unavailable;
- synthetic canary run must fail closed before mutation if fencing/store authority is unavailable;
- emergency disable uses the relevant independent kill switch;
- rollback removes the runtime binding/trigger only after confirming no capability remains active; stored bounded evidence is handled under a separate retention decision.

## 7. Production read-only executor design

The executor design is ready for owner review, but Production read authority is not granted.

```text
READ_ONLY_EXECUTOR_DESIGN = READY
PRODUCTION_READ_AUTHORITY = NO
PRODUCTION_READ_PHASE_B = OWNER_APPROVAL_REQUIRED
```

Mandatory enforcement layers:

1. **Dedicated least-privilege credential**
   - monitor-specific database role/credential;
   - `SELECT` only on an explicit approved relation/view allowlist;
   - no fallback to the application writer credential;
   - no DDL/DML grants;
   - no function/procedure execute grant where the callable object can mutate data.

2. **Read-only transaction enforcement**
   - explicit `READ ONLY` transaction for every collection unit;
   - bounded owner-approved statement/query timeout;
   - bounded connection/network timeout;
   - transaction always closed/rolled back after collection.

3. **Query/catalog enforcement**
   - reuse canonical expected-schema, #3860 parity, and #4061 translation authorities;
   - no caller-supplied SQL;
   - only approved fixed collectors;
   - bounded aggregate/provenance results only;
   - no raw user rows in monitoring output.

4. **Privacy/logging**
   - no database URL or credential value;
   - no role/provider/project/branch identity in public summaries;
   - no raw SQL;
   - no raw row;
   - no user identifier;
   - no raw database exception.

5. **Failure isolation**
   - timeout/unavailable authority/malformed result/partial result => fail closed;
   - monitoring failure must never block, mutate, or alter normal application traffic;
   - evidence from separate failed attempts must not be combined into fabricated completeness.

A symbolic future secret name may be proposed for review, for example `RELIABILITY_READONLY_DATABASE_URL`; this packet creates no secret and records no secret value.

## 8. Schema / migration provenance gate

Current schema/runtime evidence must remain separated into distinct authorities.

```text
SCHEMA_RUNTIME_AUTHORITY = MERGED_CAPABILITY_GATED_SOURCE_#4059
LIVE_SCHEMA_AUTHORITY = READ_ONLY_CATALOG_EVIDENCE_PRESENT_#4007
CANONICAL_MIGRATION_PROVENANCE = ADOPTION_REQUIRED
POST_#4091_PROVENANCE_MODEL = RESOLVED_SOURCE_CONTRACT
SOURCE_MODEL_COMPOSITION_DEFECT = RESOLVED
CATALOG_POPULATED_PREPARED_MODEL = VALID_PREPARED_UNATTESTED_SOURCE_INPUT
PREPARED_APPLIED_MIGRATIONS = []
FABRICATED_APPLIED_HISTORY = 0
CANONICAL_RUNNER_ADOPTION = HOLD_NOT_ACTIVE
PRODUCTION_PHASE_B_READ_AUTHORITY = NOT_AUTHORIZED
#4005_RUNTIME_GATE_IMPACT = BLOCKED
PRODUCTION_SCHEMA_MUTATION_REQUIRED = NO_FOR_THIS_PACKET
PRODUCTION_SCHEMA_MUTATION_AUTHORITY = NO
RUNTIME_ACTIVATION = NO
```

Current canonical/source facts:

- `db/migration-provenance/canonical-migrations.json` remains `ADOPTION_REQUIRED` with a populated two-entry canonical catalog;
- its activation rule still forbids retroactively declaring existing scripts applied and requires a separately approved adoption baseline before `ACTIVE`;
- #4091 / PR #4092 is merged source authority at `main@590d22b22bbeaacb7157f402115e873b03ed1743`;
- `scripts/adoption-attestation-core.cjs` now accepts `ADOPTION_REQUIRED + populated canonical migrations` as valid PREPARED/UNATTESTED source input and strictly validates populated catalog records instead of rejecting them solely for being non-empty;
- the prepared source draft keeps `applied_migrations = []`; canonical catalog membership is not historical execution evidence;
- therefore `CATALOGUED != APPLIED` and `UNATTESTED != ACTIVE` remain mandatory;
- #4091 does not change the canonical manifest to `ACTIVE`, attest historical migration execution, approve runner adoption, authorize Production DDL/DML, or approve Production Phase-B collection.

#4007 contains merged read-only live-catalog evidence and #4059 provides capability-gated runtime source. #4091 resolves the previously confirmed **source-model composition defect** between a populated `ADOPTION_REQUIRED` catalog and the prepared-attestation builder. It does not resolve the distinct governance questions of canonical runner adoption or Production Phase-B read approval.

The latest #4005 central authority currently available still records `CANONICAL_RUNNER_ADOPTION = HOLD`, and no post-#4091 WEB-1/central verdict is present that promotes that state. Likewise, no separate owner/Web-CTO Production Phase-B read approval is present. This packet therefore records the source blocker as resolved while keeping runner adoption and Production read capability inactive; it does not invent the pending WEB-1 conclusion.

Activation consequence:

```text
READ_ONLY_SCHEMA_PARITY_SOURCE = AVAILABLE
SOURCE_MODEL_BLOCKER_4091 = RESOLVED
CANONICAL_PROVENANCE_SOURCE_MODEL = VALID_PREPARED_UNATTESTED
CANONICAL_RUNNER_ADOPTION = HOLD_NOT_ACTIVE
PRODUCTION_PHASE_B_READ_AUTHORITY = NOT_AUTHORIZED
PRODUCTION_PARITY_COLLECTION = NOT_AUTHORIZED
RUNTIME_ACTIVATION = NO
```

No Production DDL/DML is required or authorized by this packet.

## 9. Alert delivery / provider state

Decision-only child #4208 selected Slack App Incoming Webhook as the alert provider, but no Slack resource, webhook secret, or delivery binding has been created.

```text
ALERT_PROVIDER = SLACK_APP_INCOMING_WEBHOOK
ALERT_PROVIDER_STATE = SELECTED_NOT_BOUND
ALERT_RUNTIME_BINDING = NOT_BOUND
ALERT_DELIVERY_ACTIVATION = NO
ALERT_PROVIDER_BINDING = NO
ALERT_SECRET_NAME = RELIABILITY_PREVIEW_SLACK_WEBHOOK_URL
ALERT_SECRET_PLACEMENT = NOT_AUTHORIZED
```

Provider selection is complete; provider activation is not. Any future alert-binding child must separately approve:

- Slack App/webhook resource creation;
- runtime placement and secret injection;
- Preview/Production separation;
- request timeout;
- bounded retry semantics;
- durable dedupe/queue choice if needed;
- delivery observability;
- provider-disable path;
- provider-health/self-failure detection.

The secret name is source-defined, but no secret is created and no secret value is recorded.

## 10. Independent heartbeat / dead-man design

The primary runner must not be the sole authority that decides whether the primary runner is alive.

```text
PRIMARY_RUNNER = CLOUDFLARE_CRON_RELIABILITY_WORKER / SELECTED_NOT_BOUND
HEARTBEAT_WRITER = PRIMARY_RUNNER_TO_PRIVATE_RELIABILITY_STORE / SELECTED_NOT_BOUND
DEAD_MAN_READER = SOURCE_FACTORY_ONLY
DEAD_MAN_CONTROL_PLANE = MODAL_SCHEDULED_FUNCTION / SELECTED_NOT_BOUND
DEAD_MAN_CONTROL_PLANE_INDEPENDENT = REQUIRED_NOT_BOUND
DEAD_MAN_STALE_THRESHOLD = 7m / SELECTED_NOT_BOUND
```

Required design:

1. Primary runner writes a bounded success/failure heartbeat after each run attempt, subject to private-store availability.
2. A separate control plane, not the primary Cron execution path, reads or probes only a bounded heartbeat projection.
3. The initial stale heartbeat threshold is selected as 7 minutes by #4210, but remains not bound until the independent dead-man runtime is separately authorized.
4. If the primary scheduler is silent, the independent reader must classify the heartbeat as stale and surface the condition without invoking the primary scheduler.
5. If the heartbeat store/probe is unavailable, the reader must classify monitoring authority as unavailable rather than treating missing evidence as healthy.
6. If the alert provider is unavailable, provider delivery failure must remain visible through the independent control-plane/operator health surface. A single provider cannot be considered proof of its own availability.
7. Duplicate primary runners are rejected by the private run lease/fence; a stale runner cannot write heartbeat as current authority after losing its fence.

A Modal scheduled function is the selected-not-bound independent dead-man control plane from #4207. This packet does not bind or activate it.

Unresolved owner decisions:

```text
DEAD_MAN_PLATFORM = MODAL_SCHEDULED_FUNCTION / SELECTED_NOT_BOUND
DEAD_MAN_STALE_THRESHOLD = 7m / SELECTED_NOT_BOUND
DEAD_MAN_BOUNDED_PROBE_AUTH = NOT_BOUND
ALERT_PROVIDER_SELF_MONITOR = OWNER_DECISION_REQUIRED
```

Decision-only child #4207 selects a Modal scheduled function as the independent dead-man control plane, and #4210 selects a 7-minute stale threshold. The reader/runtime binding and any bounded probe credential remain unbound, so dead-man readiness is **selected-but-not-bound and not activation-ready**.

## 11. Three independent kill switches

These are symbolic configuration names only. No Cloudflare env/secret/config is created or changed. As of #4175 the NONPROD preview worker reads these exact names from its environment inputs (source-level wiring only); the variables themselves are not created anywhere and both default DISABLED.

### A. Read-only sentinel

```text
SYMBOLIC_NAME = RELIABILITY_READ_ONLY_SENTINEL_ENABLED
OWNER = OWNER_DECISION_REQUIRED
DEFAULT = FALSE
FAILURE_DEFAULT = DISABLED
DISABLE_BEHAVIOR = scheduled read collection short-circuits before credential/database use
ROLLBACK = keep FALSE; remove trigger/binding after evidence capture
OBSERVABLE_STATE = bounded ENABLED/DISABLED runtime control class only
```

### B. Synthetic canary

```text
SYMBOLIC_NAME = RELIABILITY_SYNTHETIC_CANARY_ENABLED
OWNER = OWNER_DECISION_REQUIRED
DEFAULT = FALSE
FAILURE_DEFAULT = DISABLED
DISABLE_BEHAVIOR = lifecycle stops before QA auth/fixture/write dispatch
ROLLBACK = keep FALSE; revoke synthetic runtime binding separately after owner approval
OBSERVABLE_STATE = bounded ENABLED/DISABLED runtime control class only
```

### C. Alert delivery

```text
SYMBOLIC_NAME = RELIABILITY_ALERT_DELIVERY_ENABLED
OWNER = OWNER_DECISION_REQUIRED
DEFAULT = FALSE
FAILURE_DEFAULT = DISABLED
DISABLE_BEHAVIOR = envelope may be evaluated locally but no provider transport invocation occurs
ROLLBACK = keep FALSE; remove provider binding/credential after bounded evidence capture
OBSERVABLE_STATE = bounded ENABLED/DISABLED runtime control class only
```

No switch authorizes another switch. Unknown/missing/malformed control state fails disabled.

## 12. Synthetic canary activation gate

The merged #4081 harness is now source-complete. Production synthetic capability remains zero.

```text
SYNTHETIC_CANARY_SOURCE = MERGED_SOURCE_AUTHORITY
QA_IDENTITY = NOT_CREATED_BY_#4082
PRODUCTION_SYNTHETIC_WRITE_AUTHORITY = NO
SYNTHETIC_CANARY_ACTIVATION = NO
SYNTHETIC_CANARY_OWNER_APPROVAL_REQUIRED = YES
```

Before any Production synthetic write can be considered:

- owner-approved dedicated QA identity and exact ownership boundary;
- separately-approved credential placement;
- private run fence/lease bound and rehearsed;
- canonical Memory create/reread/owner-read/cleanup effects mapped without changing #4081 semantics;
- #4080 classifier bound for every write outcome;
- `WRITE_STATUS_UNKNOWN` reconciliation tested without second dispatch;
- synthetic exclusion occurs before ordinary-user baseline aggregation;
- private/non-Browse behavior proven through explicit negative observation;
- cleanup and retained-fixture behavior rehearsed;
- synthetic kill switch proven fail-disabled;
- Production activation receives explicit owner/Web-CTO approval separate from read-only sentinel and alert delivery.

## 13. Preview / non-Production rehearsal matrix

The #4227 disabled Provider Preview row is completed evidence. Every other row below remains a **plan** until separately executed and accepted.

| Rehearsal | Required evidence | Current status |
| --- | --- | --- |
| Disabled Provider Preview | Worker exists; SQLite DO namespace established; 404-only public surface; Cron/sentinel/alert/Production/Product disabled | `PASS_#4227` |
| Scheduler invocation | scheduled handler executes only in approved Preview/non-Production environment and records bounded run class | `PLANNED_NOT_EXECUTED` |
| Scheduler disabled | read-only kill switch short-circuits before DB credential use | `PLANNED_NOT_EXECUTED` |
| Baseline store happy path | bounded append/read/prune/retention behavior and deterministic evaluation | `PLANNED_NOT_EXECUTED` |
| Store unavailable | `MONITORING_FAILED`/`AUTHORITY_UNAVAILABLE`; never healthy; no fallback Product write | `PLANNED_NOT_EXECUTED` |
| Store corruption/malformed state | fail closed; bounded reset/rollback procedure | `PLANNED_NOT_EXECUTED` |
| DB collector timeout | bounded timeout, read-only transaction closes, normal Product path unaffected | `PLANNED_NOT_EXECUTED` |
| Malformed DB result | no fabricated completeness/healthy result | `PLANNED_NOT_EXECUTED` |
| Structural/parity mismatch | #4061 bounded non-success translation; no auto-migration | `PLANNED_NOT_EXECUTED` |
| Heartbeat stale | independent reader detects stale primary | `PLANNED_NOT_EXECUTED` |
| Heartbeat store unavailable | independent reader surfaces authority unavailable | `PLANNED_NOT_EXECUTED` |
| Duplicate runner | lease/fence rejects stale/superseded runner | `PLANNED_NOT_EXECUTED` |
| Alert provider unavailable | bounded delivery-unavailable result; Product path unaffected | `PLANNED_NOT_EXECUTED` |
| Alert kill switch ON/OFF | transport invocation count proves independent disable | `PLANNED_NOT_EXECUTED` |
| Synthetic canary disabled | zero QA auth/fixture/write capability invoked | `PLANNED_NOT_EXECUTED` |
| Synthetic source-only fake lifecycle | #4081 injected fake effects exercise lifecycle without Production capability | `PLANNED_NOT_EXECUTED` |
| Unknown-write reconciliation | canonical reread first; second write dispatch count remains zero | `PLANNED_NOT_EXECUTED` |
| Post-write ownership loss | `FENCED`; no cleanup mutation by stale owner | `PLANNED_NOT_EXECUTED` |
| Browse negative confirmation | standard canary remains private/non-Browse; malformed observer fails closed | `PLANNED_NOT_EXECUTED` |
| Privacy scan | no secret/token/UID/email/Tree/Memory/content/raw SQL/raw row/raw error leakage | `PLANNED_NOT_EXECUTED` |
| Rollback | all three kill switches independently disable; scheduler/provider/store bindings removable without Product-path dependency | `PLANNED_NOT_EXECUTED` |

No rehearsal row may be promoted to `PASS` until it is actually executed against the approved non-Production target and its bounded evidence is independently reviewed.

## 14. Privacy and capability boundary

Public/runtime telemetry may contain only bounded taxonomy fields already authorized by the merged reliability contracts, such as operation/stage/outcome classes, severity/action/owner classes, evidence-completeness classes, valid release SHA, bounded latency/count/deviation classes, and deterministic bounded fingerprints where authorized.

It must never emit:

```text
secret/token/cookie/authorization
credential or connection string
email/UID/user/owner/Tree/Memory identifier
fixture identifier or fence token/generation
raw title/content/memo/description
raw URL/query/request/response body
raw SQL or raw database row
raw provider/account/project/branch identity
raw exception/message/stack/cause
```

This packet modifies documentation only. It adds no runtime file, workflow, config, binding, secret, provider, schedule, database mutation, QA identity, or Production capability.

```text
PACKET_PRODUCTION_CAPABILITY = NONE
PRODUCTION_MUTATIONS = NONE
```

## 15. Activation prerequisites by capability

### Read-only sentinel

Required before `READ_ONLY_SENTINEL_ACTIVATION = YES` can even be proposed:

- #4091 source-model composition defect resolved, with canonical runner adoption/attestation still separately required before live provenance can be treated as active authority;
- dedicated least-privilege SELECT-only role/credential created under separate authority;
- approved relation/view allowlist;
- explicit read-only transaction + timeout enforcement;
- scheduler Worker and private-store bindings implemented in a separate runtime child;
- independent dead-man platform/owner decided;
- Preview/non-Production matrix executed and independently accepted;
- read-only kill switch proven fail-disabled;
- explicit owner/Web-CTO Production read Phase-B approval.

### Synthetic canary

Required before `SYNTHETIC_CANARY_ACTIVATION = YES` can even be proposed:

- all #4081 binding requirements in §12;
- dedicated QA identity and credential authority;
- write/cleanup/fence bindings proven in non-Production;
- synthetic exclusion before user baselines proven;
- synthetic kill switch proven fail-disabled;
- explicit owner/Web-CTO Production synthetic-write approval.

### Alert delivery

Required before `ALERT_DELIVERY_ACTIVATION = YES` can even be proposed:

- concrete provider selected;
- provider runtime binding and secret placement separately approved;
- Preview/sandbox delivery evidence;
- dedupe/retry/queue decision if applicable;
- provider health/self-failure observability decision;
- alert kill switch proven fail-disabled;
- explicit owner/Web-CTO Production alert-delivery approval.

## 16. Owner decision register

The packet is intentionally not an activation approval. Outstanding decisions include:

```text
PRIMARY_SCHEDULER = SELECTED_NOT_BOUND
PRIVATE_STORE = SELECTED_NOT_BOUND
READ_ONLY_CREDENTIAL_AND_ALLOWLIST = SELECTED_NOT_BOUND_SECURITY_ENVELOPE / CREDENTIAL_NOT_CREATED
CADENCE_AND_TIMEOUTS = SELECTED_NOT_BOUND
RETENTION_POLICY = SELECTED_NOT_BOUND
DEAD_MAN_PLATFORM = MODAL_SCHEDULED_FUNCTION / SELECTED_NOT_BOUND
DEAD_MAN_OWNER = SELECTED_NOT_BOUND
ALERT_PROVIDER = SLACK_APP_INCOMING_WEBHOOK / SELECTED_NOT_BOUND
ALERT_PROVIDER_SECRET_PLACEMENT = NOT_AUTHORIZED
QA_IDENTITY_AND_CREDENTIAL = OWNER_DECISION_REQUIRED
CANONICAL_RUNNER_ADOPTION = HOLD_NOT_ACTIVE
POST_#4091_#4005_REEVALUATION = OWNER_WEB_CTO_DECISION_REQUIRED
PRODUCTION_READ_PHASE_B = OWNER_APPROVAL_REQUIRED
PRODUCTION_SYNTHETIC_WRITE = OWNER_APPROVAL_REQUIRED
ALERT_DELIVERY_PRODUCTION = OWNER_APPROVAL_REQUIRED
```

## 17. Single-document decision summary

1. **What is source-complete?** #4061 structural/parity translation, #4079 baseline/anomaly core, #4080 write-outcome classification, #4081 synthetic lifecycle, #4091 catalog-populated PREPARED/UNATTESTED adoption model, #3861 bounded alert delivery core, and #3874 provider-unselected adapter are merged source authorities.
2. **What still needs owner approval?** Runtime/provider bindings and all three Production activation gates. Scheduler, private store, dead-man platform, alert provider, runtime bounds, initial signal set, read-only executor envelope, and initial structural calibration policy are selected-not-bound; credentials, collector binding, remaining non-Production rehearsal gates, QA identity, and Production capability approvals remain unactivated.
3. **Selected runtime components?** Dedicated Cloudflare Worker Cron Trigger for the primary runner and a SQLite-backed Durable Object for private bounded reliability state, both `SELECTED_NOT_BOUND`; the disabled NONPROD Worker/SQLite namespace now exists from #4227 but Cron remains unattached.
4. **What capability is currently zero?** Production read, Production synthetic write, alert delivery, scheduler/Cron activation, real collector binding, QA identity creation, secret placement, Product traffic, and schema mutation. The disabled NONPROD Worker and SQLite DO namespace are the only established provider resources from #4227.
5. **What remains before Production read?** #4091 has resolved the source-model composition defect, but canonical runner adoption remains HOLD/NOT ACTIVE and Production Phase-B read still requires separate explicit approval; least-privilege SELECT-only credential/allowlist, read-only transaction/timeouts, runtime bindings, dead-man, rehearsal evidence, and owner approval also remain.
6. **What remains before synthetic write?** QA identity/credential, exact #4081 effect binding, fencing/ownership/cleanup/reconciliation/exclusion rehearsal, independent kill switch, and explicit synthetic-write approval.
7. **What remains before alert delivery?** Slack App Incoming Webhook is already selected-not-bound; runtime/secret binding, delivery/dedupe/retry/health rehearsal, kill-switch proof, and explicit alert activation approval remain.
8. **Who detects monitor death?** Modal scheduled function is the selected-not-bound independent control plane; its reader/runtime binding and bounded probe authority remain unbound, so dead-man activation is not yet complete.
9. **How is immediate disable/rollback performed?** Three independent fail-disabled switches; scheduler trigger/provider/store bindings are secondary rollback/removal mechanisms and never substitute for the switches.
10. **What evidence is still required?** #4227 disabled Provider Preview is `PASS`; the remaining §13 runtime/capability rehearsal rows remain `PLANNED_NOT_EXECUTED` until separately authorized and executed.

## 18. Final packet disposition

The packet document is current after #4499/#4500/#4501, but the #4082 completion marker is still not satisfied. Historical CENTRAL authority held C4 until the required Preview/non-Production runtime rehearsal evidence and prerequisite capability authorities are actually present. #4227 proves only the disabled base Provider Preview; the remaining runtime/capability rehearsal rows in §13 are still unexecuted.

```text
PACKET_DOCUMENT_CURRENTNESS = CURRENT_AT_569836d0a3df7a995cc02c4eef23d16f365eb1a5
C4_RUNTIME_BINDING_APPROVAL_PACKET_READY = NO
C4_BLOCKER_CLASS = RUNTIME_REHEARSAL_AND_CAPABILITY_AUTHORITY
NONPROD_RUNTIME_REHEARSAL_MATRIX = INCOMPLETE
#4082_CLOSE = NO
#3461_KEEP_OPEN = YES
#1882_KEEP_OPEN = YES

RUNTIME_ACTIVATION = NO
PRODUCTION_READ_AUTHORITY = NO
PRODUCTION_SYNTHETIC_WRITE_AUTHORITY = NO
ALERT_PROVIDER_BINDING = NO
INITIAL_SIGNAL_CALIBRATION_POLICY = SELECTED_NOT_BOUND
AGGREGATE_COUNT_CALIBRATION = NO_NUMERIC_BASELINE_CALIBRATION
PARITY_EVIDENCE_CALIBRATION = CATEGORICAL_TRANSLATION_ONLY
STRUCTURAL_RUNTIME_COMPOSITION_SOURCE = COMPLETE_#4500_#4501
DISABLED_NONPROD_PROVIDER_PREVIEW_REHEARSAL = PASS

SOURCE_MODEL_BLOCKER_4091 = RESOLVED
CATALOG_POPULATED_PREPARED_MODEL = VALID_UNATTESTED
FABRICATED_APPLIED_HISTORY = 0
CANONICAL_RUNNER_ADOPTION = HOLD_NOT_ACTIVE
PRODUCTION_PHASE_B_READ_AUTHORITY = NOT_AUTHORIZED
#4005_RUNTIME_GATE_IMPACT = BLOCKED

PRIMARY_SCHEDULER = CLOUDFLARE_WORKER_CRON_TRIGGER_DEDICATED_RELIABILITY_WORKER
PRIMARY_SCHEDULER_STATE = SELECTED_NOT_BOUND
SCHEDULER_ACTIVATION = NO
CRON_ATTACHMENT_AUTHORITY = NO

PRIVATE_RELIABILITY_STORE = SQLITE_BACKED_CLOUDFLARE_DURABLE_OBJECT
PRIVATE_STORE_STATE = SELECTED_NOT_BOUND
PRIVATE_STORE_ACTIVATION = DISABLED_NONPROD_NAMESPACE_ESTABLISHED_ONLY

READ_ONLY_EXECUTOR_DESIGN = READY
PRODUCTION_READ_PHASE_B = NOT_AUTHORIZED__OWNER_APPROVAL_REQUIRED

ALERT_PROVIDER = SLACK_APP_INCOMING_WEBHOOK / SELECTED_NOT_BOUND
ALERT_DELIVERY_ACTIVATION = NO

DEAD_MAN_READER = SOURCE_FACTORY_ONLY
DEAD_MAN_CONTROL_PLANE = MODAL_SCHEDULED_FUNCTION / SELECTED_NOT_BOUND
DEAD_MAN_CONTROL_PLANE_INDEPENDENT = REQUIRED_NOT_BOUND

NONPROD_PREVIEW_SOURCE_PACKAGE = PUBLISHED_#4149_RECONCILED_#4175
RELEASE_SHA_PROVENANCE = INJECTED_FAIL_CLOSED_INVALID_RELEASE_SHA
KILL_SWITCH_ENV_WIRING = WIRED_SOURCE_LEVEL_DEFAULT_DISABLED
REAL_PRODUCTION_COLLECTOR = UNBOUND
INITIAL_STRUCTURAL_CALIBRATION = SELECTED_NOT_BOUND
BASELINE_AWARE_CALIBRATION = UNBOUND_UNTIL_SELECTED_SIGNAL_REQUIRES_IT
ACTUAL_PROVIDER_PREVIEW = PASS_#4227
NONPROD_RUNTIME_REHEARSAL_MATRIX = INCOMPLETE

RECOMMENDATION = COMPLETE_REMAINING_NONPROD_RUNTIME_REHEARSAL_GATES_BEFORE_C4
```

Refs #4082.
Refs #4091 / PR #4092.
Refs #4081 / PR #4090.
Refs #4080 / PR #4084.
Refs #4079 / PR #4087.
Refs #4060 / PR #4061.
Refs #4005 / PR #4007.
Refs #4058 / PR #4059.
Refs #3861.
Refs #3874.
Refs #3461 — KEEP OPEN.
Refs #1882 — KEEP OPEN.
