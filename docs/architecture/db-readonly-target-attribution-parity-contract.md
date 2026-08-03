# Read-Only Target Attribution & Catalog Parity Preflight Contract

Source-only contract for Issue #3860 (Step 8 Child 3 under #3458). This
document defines the bounded boundary of the read-only target attribution and
catalog parity preflight. It is a source/architecture contract; it does not
connect to any database, provider, or Production environment.

Refs #3860, #3458, #1882.

## Purpose

One privacy-safe, fail-closed boundary that:

- attributes a target only by bounded non-secret classes;
- validates explicit boundary approval;
- validates the committed expected-schema authority remains `ADOPTION_REQUIRED`;
- invokes at most one injected read-only catalog collection effect;
- compares sanitized object identity and fingerprint against the committed
  expected critical-object vocabulary deterministically;
- returns one bounded frozen result.

`PARITY_CONFIRMED` is a parity result only. It never implies manifest
activation, target activation, deployment gating, or schema mutation. The
committed manifests remain `ADOPTION_REQUIRED` unless a separately approved
adoption procedure changes them.

## Fixed operation and attribution vocabulary

```text
operation:          READ_ONLY_TARGET_ATTRIBUTION_CATALOG_PARITY
target_class:       DISPOSABLE_POSTGRES_REHEARSAL_TARGET
environment_class:  CI_EPHEMERAL
boundary_approval:  true
release_sha:        lowercase 40-hex, optional, bounded
```

The core accepts only bounded classes and booleans. It never accepts or exposes:

```text
host
port
database name
provider
project/account identifier
URL
credential/secret
connection string
operator identity
email/user ID
raw catalog row
raw SQL result
backend PID
private timestamp
filesystem path
environment variable
arbitrary SQL
```

## Required outcomes

```text
PARITY_CONFIRMED
PARITY_MISMATCH
TARGET_ATTRIBUTION_INVALID
APPROVAL_INVALID
AUTHORITY_ADOPTION_REQUIRED
EXPECTED_SCHEMA_INVALID
CATALOG_COLLECTION_FAILED
INSUFFICIENT_EVIDENCE
```

- `TARGET_ATTRIBUTION_INVALID`: unknown operation, wrong target/environment
  class, malformed release SHA, unknown config key, or descriptor/Proxy hostile
  config. Collection effect count is zero.
- `APPROVAL_INVALID`: `boundary_approval` is missing or not exactly `true`.
  Collection effect count is zero.
- `EXPECTED_SCHEMA_INVALID`: committed authority is malformed, status is not
  `ADOPTION_REQUIRED` (including synthetic `ACTIVE`), critical-object name or
  fingerprint is invalid, or a critical object is duplicate or carries an
  unknown/private field. Collection effect count is zero.
- `AUTHORITY_ADOPTION_REQUIRED`: committed authority is valid `ADOPTION_REQUIRED`
  but its critical-object vocabulary is empty; informational fail-closed
  posture, not activation. Collection effect count is zero.
- `CATALOG_COLLECTION_FAILED`: the injected read-only collection effect threw or
  rejected. No raw error, message, stack, or connection detail escapes.
- `INSUFFICIENT_EVIDENCE`: observed evidence is malformed, hostile, missing,
  duplicate, carries unknown/private fields, or has a malformed fingerprint.
- `PARITY_MISMATCH`: observed evidence is well-formed but the observed object
  identity or fingerprint set differs from the committed expected vocabulary.
- `PARITY_CONFIRMED`: observed evidence is well-formed and exactly matches the
  committed expected critical-object vocabulary. `authorityStatus` remains
  `ADOPTION_REQUIRED` and no activation is implied.

## Required sequence

```text
validate fixed operation
validate bounded target attribution
validate explicit boundary approval
validate committed expected-schema authority
validate exact expected critical-object vocabulary
collect sanitized observed catalog evidence through one injected read-only effect
compare sanitized object identity/fingerprint deterministically
return one bounded frozen result
```

## Read-only requirement

The preflight path may issue only existing repository-authorized read-only
catalog `SELECT`s through the existing migration catalog PostgreSQL adapter
authority. It never issues or authorizes:

```text
CREATE
ALTER
DROP
INSERT
UPDATE
DELETE
TRUNCATE
GRANT
REVOKE
LOCK mutation
migration execution
ledger append
manifest write
```

Fixture setup in the CI test may create a disposable synthetic database/table
before invoking the preflight. That setup is test-harness authority only and is
separated from the read-only preflight invocation and query-count evidence.

## PostgreSQL 17.4 rehearsal

Execution is authorized only in fresh GitHub Actions using:

```text
postgres:17.4-bookworm
server_version_num = 170004
loopback LB_TEST_PG* synthetic job credentials
repository disposable PostgreSQL harness
```

The rehearsal must prove:

```text
R1 attributed parity confirmation (PARITY_CONFIRMED; manifest stays ADOPTION_REQUIRED)
R2 catalog mismatch (PARITY_MISMATCH; no raw catalog row or DDL leakage; no mutation)
R3 wrong attribution / missing approval fails before connection effects
R4 collection failure maps to CATALOG_COLLECTION_FAILED with no raw leakage
R5 insufficient/hostile evidence fails closed without getter/trap leakage
R6 read-only query proof (every preflight statement is a fixed read-only catalog query; mutation count 0)
R7 no activation or residual state (both manifests ADOPTION_REQUIRED; no ledger append; sessions released; DB removed)
```

## Source-static contract

`tests/contracts/db-readonly-target-attribution-parity-contract.test.cjs` locks:

- exact operation and attribution vocabulary;
- fixed sanitized result/error vocabulary;
- exact committed critical-object binding (`table:public.schema_migration_ledger`);
- committed manifests remain populated but `ADOPTION_REQUIRED`;
- no provider/database/operator/private identifier fields;
- no environment, URL, secret, path, arbitrary SQL, or raw catalog input in the core;
- one injected read-only collection effect maximum;
- connection/collection effect count zero for invalid attribution/approval/authority;
- mutation count zero in the preflight path;
- deterministic ordering, detached/frozen result, descriptor-safe input handling;
- exact package script and CI job/image/version;
- Child 4 and #3460 remain unauthorized; #3458 remains OPEN.

Negative controls (in-memory only; no tracked-file mutation):

```text
NC1 unknown operation
NC2 wrong target/environment class
NC3 missing approval
NC4 malformed release SHA
NC5 manifest ACTIVE synthetic input
NC6 missing/duplicate/extra critical object
NC7 malformed or mismatched fingerprint
NC8 injected raw/private fields
NC9 accessor/Proxy hostile input
NC10 collector throw/reject
NC11 mutation SQL attempt
NC12 provider/Production identifier attempt
```

## Core properties

The core is dependency-injected, deterministic, descriptor-safe, sanitized,
frozen/detached, and read-only. It cannot read environment variables,
filesystem paths, URLs, credentials, arbitrary SQL, or provider identifiers.
All failure results are bounded frozen objects with no raw error, stack, or
connection detail leakage.

## CI contract

One package script:

```text
test:db-engine:readonly-target-attribution-parity
node --test --test-concurrency=1 tests/db-engine/readonly-target-attribution-parity-postgres.test.cjs
```

One CI job:

```text
db-engine-readonly-target-attribution-parity
ubuntu-latest
timeout-minutes: 15
Node 20
postgres:17.4-bookworm
server_version_num 170004
synthetic job-derived password
loopback LB_TEST_PG* only
runs only test:db-engine:readonly-target-attribution-parity
```

Existing DB-engine job semantics are unchanged.

## Classification

```text
tests/contracts/db-readonly-target-attribution-parity-contract.test.cjs
  layer: SOURCE_STATIC

tests/db-engine/readonly-target-attribution-parity-postgres.test.cjs
  layer: DB_ENGINE_EXECUTION
  defaultCi: false
  capabilities: postgresql, network
```

## Next-child decision posture

`docs/architecture/DB_MIGRATION_PROVENANCE_NEXT_CHILD_DECISION.md` records:

```text
Step 8 Child 1 complete
Step 8 Child 2 complete
Step 8 Child 3 implemented by this issue, pending merge/independent CI
Step 8 Child 4 selected as the only next child but not implemented
both manifests remain ADOPTION_REQUIRED
no provider/environment binding
no Production access
no manifest ACTIVE transition
no deploy integration
```

Exact next marker:

```text
FAIL_CLOSED_DEPLOY_GATE_TARGET_ACTIVATION_SELECTED
```

The marker selects Step 8 Child 4 only. It does not authorize Child 4
implementation in this PR.

## Completion boundary

After independent exact-head source review, fresh green CI including
`db-engine-readonly-target-attribution-parity`, and expected-head squash merge:

- close this child completed;
- keep #3458 OPEN;
- create/authorize Child 4 separately;
- keep #3460 OPEN with no new implementation.

Refs #3846 — completed Step 8 Child 2.
Refs #3458 — Keep OPEN.
Refs #3435 — deferred; Keep OPEN.
Refs #3460 — Keep OPEN; implementation waits for #3458 completion.
Refs #1882 — Keep OPEN; use only `Refs #1882`.
