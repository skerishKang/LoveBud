# LoveBud DB Migration Provenance Current-State Audit

## Audit baseline

| Field | Value |
| --- | --- |
| Audit issue | #3644 |
| Parent issue | #3458 |
| Architecture/quality parent | #3425 |
| Baseline `main` | `eb030c1d4751dfee45d65f5a420caebebac6ebcc` |
| Evidence date | 2026-07-24 |
| Database accessed | No |
| Production or staging accessed | No |
| SQL executed | No |
| Docker or PostgreSQL started | No |
| Secrets or credentials inspected | No |

This audit replaces the status conclusions in the previous audit baseline at `de1c4e416e33e2669157b2202a7bbd021779ad59`. The earlier evidence remains useful historically, but it predates the canonical runner protocol, orchestrator, pinned-session lock adapter, ledger adapter, adoption operator checklist, and CI-infrastructure governance amendment now present on `main`.

## Scope and evidence limits

This is a repository-state audit. It does not authorize or perform database access, migration execution, manifest activation, ledger bootstrap, deployment wiring, Production collection, provider-console work, or secret handling.

A source-tested adapter is classified as repository capability, not as proof that PostgreSQL or Production behavior occurred. Disposable PostgreSQL engine tests remain distinct from target-readonly evidence and Production evidence.

## Executive conclusion

The previous outcome `NO_SAFE_IMPLEMENTATION_CHILD_WITHOUT_OPERATOR_INPUT` is no longer accurate as a repository-wide conclusion.

Operator inputs are still required for Phase B Production-readonly catalog collection, but several repository-side implementation dependencies can proceed without those inputs. The most immediate dependency gap is the missing safe bridge between the pinned-session lock adapter and the ledger adapter:

- the lock adapter owns the pinned session and closure-private handle state;
- it exposes only `acquireAdvisoryLock`, `checkAdvisoryLock`, and `releaseAdvisoryLock`;
- the ledger adapter requires an injected `queryLockedSession({ lockHandle, query })` dependency;
- no current module can resolve an opaque lock handle to the captured pinned-session query callable.

The selected next child is therefore a source-tested pinned-session query broker, not Production collection and not a real database client.

---

## #3458 acceptance-criteria matrix

| # | Acceptance area | Status | Current evidence | Remaining boundary |
| --- | --- | --- | --- | --- |
| 1 | Canonical migration directory, runner, and ledger contract | `PARTIAL` | Reserved `db/migrations/`; canonical and ledger contracts; pure runner protocol; async orchestrator; source-tested lock and ledger adapters | No active manifest entries, ledger relation, real database composition, or end-to-end runner |
| 2 | Existing schema-changing paths classified | `COMPLETE` | `migration-path-inventory.json` and provenance validation cover known paths and classifications | Ongoing maintenance is required as paths change |
| 3 | Stable migration IDs and checksums | `PARTIAL` | Fixed ID/checksum contracts and source validation exist | Manifest is inactive and contains zero canonical migrations |
| 4 | Clean-database reconstruction | `NOT_STARTED` | Architecture intent and incident-specific disposable tests exist | No canonical stream or general reconstruction harness |
| 5 | Target ledger mismatch detection | `PARTIAL` | Synthetic gate comparison plus exact source-tested ledger read/append adapter | No ledger relation, no target ledger evidence, and no pinned-session query bridge |
| 6 | Target catalog drift detection | `PARTIAL` | Fingerprint normalizer, disposable catalog adapter, candidate builder, Production-readonly boundary and checklist | No approved Production collection; credential and abstract role mapping remain external inputs |
| 7 | Destructive DDL approval boundary | `PARTIAL` | Source scanner, declaration contract, approval-reference requirement, protocol boundaries | No active destructive canonical migration or deployment enforcement |
| 8 | Existing Production adoption without fabricated history | `PARTIAL` | Adoption contracts, PREPARED_ONLY plan, fail-closed boundary, operator checklist | Phase B inputs and approval are absent; no attestation or activation occurred |
| 9 | Rollback and forward-fix policy | `PARTIAL` | Policy, protocol, orchestrator recovery decisions, partial/unknown blocking semantics | No real canonical migration has exercised the policy |
| 10 | Deployment preflight enforcement | `NOT_STARTED` | Manual/source gate components only | No deploy hook or target gate integration |
| 11 | Sanitized observability | `NOT_STARTED` | Fixed sanitized result vocabularies exist in components | No integrated provenance observability surface |
| 12 | Legacy migration-path retirement | `PARTIAL` | Legacy paths are inventoried and classified | No retirement enforcement or mature canonical replacement stream |

No acceptance criterion is upgraded based solely on a contract file or synthetic mock. Criterion 2 remains the only currently complete parent criterion.

---

## Newly completed repository capabilities

### 1. Canonical runner protocol

The runner protocol is now a pure policy source of truth for:

- source and manifest readiness;
- exact committed-prefix ledger validation;
- next-migration derivation;
- no-op handling for an already-applied migration;
- execution authorization;
- completion and ledger-append authorization;
- destructive partial/unknown recovery classification;
- prohibition of down migration, automatic rollback, committed re-apply, ledger deletion, and ledger rewrite.

This is policy logic only. It does not call PostgreSQL.

### 2. Canonical runner orchestrator

The orchestrator now sequences eleven injected dependencies in a fixed order:

```text
validateSource -> loadManifest -> acquireAdvisoryLock -> readLedger ->
evaluatePrecondition -> canonical preflight -> executeMigration ->
evaluatePostcondition -> checkAdvisoryLock -> canonical completion ->
now -> appendLedgerRecord -> releaseAdvisoryLock
```

It provides:

- exact dependency validation;
- opaque lock-handle forwarding;
- exactly-once release after successful acquisition;
- no-op behavior without execution or append;
- fixed sanitized outcomes, blockers, recovery decisions, and events;
- no raw SQL, session, credential, ledger record, or error exposure.

It remains dependency-injected and performs no external effect itself.

### 3. PostgreSQL pinned-session advisory-lock adapter

The source-tested lock adapter now provides:

- a fixed global two-int advisory-lock key;
- non-blocking acquire;
- same-session lock verification;
- explicit unlock;
- a closure-private `WeakMap` for adapter-instance-specific opaque handles;
- captured query/release callables;
- exactly-once pool release;
- fail-closed status mapping and sanitized results.

The adapter deliberately imports no `pg` client and uses synthetic injected sessions.

### 4. PostgreSQL ledger read/append adapter

The source-tested ledger adapter now provides:

- fixed named read and append queries;
- fixed seven-field ledger records;
- append-only conflict behavior;
- exact all-own-key evidence validation;
- descriptor-snapshot and dense-array TOCTOU hardening;
- frozen read results;
- `APPENDED | FAILED | UNKNOWN` append mapping;
- opaque lock-handle forwarding;
- sanitized failure behavior.

It requires an injected `queryLockedSession` dependency and performs no database connection itself.

### 5. Adoption operator checklist

The completed operator checklist now documents the two Phase B external inputs and separates them from later approvals:

1. dedicated Production-readonly credential input;
2. abstract PostgreSQL role mapping;
3. separate Phase B bounded collection approval;
4. Phase C evidence review;
5. Phase D manifest activation decision;
6. Phase E ledger/bootstrap/canonical-stream decision.

The checklist creates no credential, role mapping, access, attestation, or authority.

### 6. CI infrastructure-unavailable governance

Repository governance now distinguishes:

- `CI_EXECUTED_FAILURE`;
- `CI_PENDING_EXECUTION`;
- `CI_UNAVAILABLE_INFRA`;
- `CI_GREEN`.

Billing exhaustion or runner non-allocation with zero executed steps is no longer misreported as a code-test failure. Verification must remain proportional to the changed scope.

---

## Exact pinned-session composition gap

### Current lock-adapter public surface

`createPostgresMigrationSessionLockAdapter` returns only:

```js
{
  acquireAdvisoryLock,
  checkAdvisoryLock,
  releaseAdvisoryLock
}
```

The acquired handle maps to closure-private state containing:

```js
{ session, query, release, lifecycle }
```

That state is intentionally not exposed.

### Current ledger-adapter dependency

`createPostgresMigrationLedgerAdapter` requires:

```js
createPostgresMigrationLedgerAdapter({ queryLockedSession })
```

and calls:

```js
queryLockedSession({ lockHandle, query })
```

### Missing capability

No current source module can safely perform all of the following:

1. validate that `lockHandle` belongs to the same lock-adapter instance;
2. require lifecycle `OPEN`;
3. use the query callable captured when the session was validated;
4. execute a repository adapter query on that exact pinned session;
5. preserve raw query results only for the consuming adapter's own strict evidence validation;
6. map invalid handles and query failures to a fixed sanitized broker failure;
7. avoid exposing the session, query callable, release callable, backend PID, URL, credential, or raw error.

Without this bridge, the ledger adapter and lock adapter are individually compatible with the orchestrator vocabulary but are not composable into one same-session dependency set.

---

## Other repository-side gaps

These gaps do not require Production credentials to design or source-test, but they follow the pinned-session broker in dependency order:

- source-validation adapter for `validateSource`;
- canonical-manifest loader for `loadManifest`;
- precondition adapter;
- migration execution adapter;
- postcondition adapter;
- runtime composition root that builds the full dependency set;
- disposable PostgreSQL rehearsal of the composed runner;
- clean-database reconstruction harness.

A real PostgreSQL `openSession` implementation, live ledger relation, canonical migration stream, and deployment integration remain separate later phases.

---

## Operator-input and repository-implementation separation

### Repository implementation dependencies

| ID | Dependency | Current state |
| --- | --- | --- |
| RI-1 | Pinned-session query broker | `NOT_STARTED` |
| RI-2 | Source/manifest adapters | `NOT_STARTED` |
| RI-3 | Precondition/execution/postcondition adapters | `NOT_STARTED` |
| RI-4 | Full dependency composition root | `NOT_STARTED` |
| RI-5 | Disposable composed-runner rehearsal | `NOT_STARTED` |
| RI-6 | Clean-database reconstruction | `NOT_STARTED` |

### External operator inputs

| ID | Input or decision | Current state |
| --- | --- | --- |
| OI-1 | Dedicated Production-readonly credential | `UNAVAILABLE` |
| OI-2 | Abstract PostgreSQL role mapping | `UNAVAILABLE` |
| OA-B | Phase B bounded read-only collection approval | `NOT_GRANTED` |
| OA-C | Phase C evidence and drift review | `NOT_REACHED` |
| OA-D | Manifest activation decision | `NOT_REACHED` |
| OA-E | Ledger bootstrap and canonical migration-stream approval | `NOT_REACHED` |

RI-1 through RI-5 can be developed with synthetic fixtures or disposable infrastructure under separately scoped children. OI-1/OI-2 are required only for target-readonly collection, not for the selected next source-tested child.

---

## Reconciled dependency graph

```text
CURRENT SOURCE FOUNDATION
runner protocol
  + orchestrator
  + pinned-session lock adapter
  + ledger adapter
        |
        v
RI-1 pinned-session query broker                  <-- selected next child
        |
        v
RI-2 source/manifest adapters
        |
        v
RI-3 precondition/execution/postcondition adapters
        |
        v
RI-4 dependency composition root
        |
        v
RI-5 disposable composed-runner rehearsal
        |
        +------------------------------+
        |                              |
        v                              v
RI-6 clean reconstruction       OI-1 + OI-2 + OA-B
                                       |
                                       v
                              target-readonly collection
                                       |
                                       v
                                  OA-C / OA-D
                                       |
                                       v
                    ledger bootstrap + canonical stream (OA-E)
                                       |
                                       v
                         deployment enforcement / observability
```

Repository-side source work and operator-input work are parallel dependency lanes. The absence of Production credentials does not block RI-1.

---

## Selected next outcome

`SAFE_IMPLEMENTATION_CHILD_SELECTED`

The exact child is defined in `DB_MIGRATION_PROVENANCE_NEXT_CHILD_DECISION.md`:

> Add a source-tested pinned-session query broker to the PostgreSQL migration session-lock adapter so the ledger adapter can execute its fixed queries through the same opaque-handle-bound session.

This child must not import `pg`, open a database connection, execute real SQL, start Docker/PostgreSQL, access Production, or alter manifests.

---

## Unsupported claims

Current evidence does not support any of the following:

- the migration system is Production-ready;
- the canonical migration manifest is active;
- a ledger relation exists;
- an authoritative applied-migration history exists;
- the lock and ledger adapters have executed against PostgreSQL;
- the ledger adapter is currently wired to the lock adapter;
- clean-database reconstruction works;
- deployment provenance is enforced;
- Production catalog evidence has been collected;
- any database or Production mutation occurred during this audit.

## Audit completion statement

This audit read repository and GitHub evidence only. It made no database connection, executed no SQL, started no Docker/PostgreSQL process, accessed no provider or Production environment, inspected no secret, and changed no runtime or manifest state.

Refs #3644.
Refs #3458 — Keep #3458 OPEN.
Refs #3425 — Keep #3425 OPEN.
Refs #3435 — Keep #3435 OPEN.
Refs #3437 — Keep #3437 OPEN.
Refs #1882 — Keep #1882 OPEN.
