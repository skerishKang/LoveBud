# Schema Orphan Read-Only Structural Sentinel — Contract

> Issue: #3842 (Reliability & Observability child of parent #3461).
> Issue: #4060 (Structural schema / migration-parity sentinel integration).
> Prerequisite: #3835 (taxonomy/policy, completed) and #3834 (boundary audit, completed).
> Reactivation authorities: #3458 (canonical migration/expected-schema authority,
> completed) and #3860 (read-only target attribution & catalog parity core,
> completed — reused for vocabulary only, never extended to Production scope).
> This document is a **source-only** contract for a fixed, privacy-safe,
> read-only structural sentinel query and evaluation authority.

## 1. Scope and current state

This child implements a deterministic, privacy-safe, read-only structural
sentinel authority:

```text
source-only local implementation : YES
local DB-engine execution         : NOT_EXECUTED_LOCALLY_BY_POLICY
authoritative DB-engine validation: FRESH_EXACT_HEAD_GITHUB_ACTIONS_REQUIRED
Production verification           : NO
alert delivery                    : NO
synthetic writes                  : NO
```

Local PostgreSQL/Docker/provider execution is prohibited. The PostgreSQL 17.4
DB-engine test is authored as source; its authoritative execution must occur
only through fresh exact-head GitHub Actions.

## 2. Architecture

```text
fixed query catalog
    ↓
query descriptor validation
    ↓
injected read-only executor
    ↓
strict one-row aggregate result validation
    ↓
privacy-safe sentinel evaluator
    ↓
#3835 canonical summary/taxonomy output
```

The executor is dependency-injected for contracts and disposable DB-engine
rehearsal. It must not accept caller-selected SQL, paths, URLs, environment
variables, credentials, or arbitrary metadata.

## 3. Executable signal classes

The following two aggregate signals are executable (table/column authority is
confirmed by exact current source):

```text
MEMORY_TREE_PARENT_ORPHAN_COUNT
  memories.tree_id is non-null
  and no matching trees.id exists

MEMORY_PARENT_ORPHAN_COUNT
  memories.parent_id is non-null
  and no matching parent memory exists
```

Important:

```text
memories.parent_id IS NULL
= valid root memory
= NOT an orphan
```

Both queries are fixed repository-owned single `SELECT` statements returning
exactly one row with the approved aggregate alias `count`.

## 4. Deferred signal classes

The following remain deferred with the fixed prerequisite
`CANONICAL_SCHEMA_AUTHORITY_REQUIRED` and no executable SQL:

```text
TREE_SOCIAL_TARGET_ORPHAN_COUNT
TREE_COMMENT_TARGET_ORPHAN_COUNT
PUBLIC_MEMORY_PARENT_ORPHAN_COUNT
BROWSE_ELIGIBLE_ENTITY_COUNT
```

Source authority is not sufficiently established to invent SQL for these
signals. They stay in the fixed `DEFERRED` descriptor mode.

## 4.1 Parity-evidence signal classes (reactivated by #4060)

`STRUCTURAL_SCHEMA_DRIFT_CHECK` and `MIGRATION_LEDGER_CATALOG_PARITY_CHECK` are
no longer merely `CANONICAL_SCHEMA_AUTHORITY_REQUIRED`-deferred. They are
`PARITY_EVIDENCE` descriptor mode: they carry **no SQL** and are evaluated only
against **bounded sanitized parity evidence** supplied through the source-only
translation seam. They are NOT converted into aggregate count-row queries; a
parity signal is a canonical-parity evidence signal, not a count signal.

Architecture boundary (never crossed):

```text
#3458 / #3860 canonical parity authority
        ↓
bounded sanitized parity evidence
        ↓
source-only translation seam (this sentinel core)
        ↓
#3461 structural sentinel result (#3835 taxonomy)
```

Each parity descriptor carries a fixed frozen `parity_contract` declaring the
bounded evidence shape: evidence `format_version` `1.0`, normalizer version
`1.0`, the #3860 object-name pattern
(`table|view|materialized_view: schema.object`), the `sha256:[0-9a-f]{64}`
fingerprint pattern, and supported authority status `ADOPTION_REQUIRED`.

### Outcome mapping (exact reuse of the #3860 vocabulary)

The sentinel consumes #3860's bounded outcome strings and maps them to the
bounded #3835 public vocabulary. No new synonymous vocabulary is created:

```text
PARITY_CONFIRMED            -> CONFIRMED (structural evidence success)
PARITY_MISMATCH             -> STRUCTURAL_DRIFT_DETECTED (bounded non-success)
AUTHORITY_ADOPTION_REQUIRED -> SCHEMA_AUTHORITY_UNAVAILABLE (never live-applied
                               success; owner decision required)
CATALOG_COLLECTION_FAILED   -> MONITORING_FAILED (sanitized failure)
INSUFFICIENT_EVIDENCE       -> INSUFFICIENT_EVIDENCE (never success)
```

`CATALOG_COLLECTION_FAILED` is an existing #3860 state and is explicitly mapped
to the public sentinel `MONITORING_FAILED` state.

### Fixed semantics (contract)

```text
CATALOGUED != APPLIED
  A repository migration entry / committed critical object existing in the
  authority is NEVER by itself evidence that the object exists in the observed
  live catalog. Only observed evidence objects can confirm parity.

ADOPTION_REQUIRED != LIVE_APPLIED
  An authority status of ADOPTION_REQUIRED (or an empty committed critical
  object list -> AUTHORITY_ADOPTION_REQUIRED) is never mapped to a healthy
  live-applied success.

fail closed on:
  malformed bounded evidence, missing expected object, duplicate critical
  object, unknown version, unsupported authority status, collector failure,
  missing result, ambiguous parity, unexpected extra fields.
```

Parity summaries carry no `count_bucket` (they are not count signals).

## 5. Query safety contract

Every executable query must:

```text
be repository-owned and fixed
be a single SELECT or WITH...SELECT statement
return exactly one row
return only approved aggregate aliases
contain no user parameters or identifiers in output
contain no semicolon-chained statement
contain no INSERT/UPDATE/DELETE/MERGE/UPSERT/TRUNCATE/DROP/ALTER/CREATE/GRANT/REVOKE/COPY/CALL/DO/EXECUTE
contain no pg_sleep, dblink, network, file, or extension-management capability
contain no comments that can conceal a second statement
```

Unsafe SQL is never silently stripped; it is rejected fail closed.

## 6. Result boundary

The raw executor result is accepted only when it is an ordinary or
null-prototype object with exact own keys defined by the descriptor.

```text
rejected:
  zero rows
  2+ rows
  extra columns
  missing columns
  negative counts
  non-integer counts
  unsafe bigint conversion
  NaN / Infinity
  stringified objects
  raw IDs
  raw rows
  raw SQL errors
  prototype/inherited fields
  Proxy / accessor input
  unknown descriptor/result fields
```

The public summary contains only bounded #3835 fields:

```text
operation_class
stage
outcome_code
release_sha
count_bucket
baseline_deviation
severity
owner_action
evidence_completeness
```

No exact aggregate count is permitted in the public canonical summary.

## 7. Baseline boundary

This child must not hard-code numeric Production thresholds. It may accept a
separately supplied bounded baseline classification or a synthetic-test-only
policy seam, but it must reject caller-provided arbitrary numeric threshold
maps.

Required behavior:

```text
zero orphan candidates + complete evidence
→ CONFIRMED / NONE

positive orphan candidates + complete evidence
→ ORPHAN_SIGNAL_DETECTED

schema/query authority unavailable
→ SCHEMA_AUTHORITY_UNAVAILABLE or INSUFFICIENT_EVIDENCE

executor failure or malformed result
→ MONITORING_FAILED or INSUFFICIENT_EVIDENCE
```

Missing evidence is never mapped to success.

## 8. Files

```text
A js/observability/reliability-structural-sentinel-query-catalog.js
A js/observability/reliability-structural-sentinel-core.js
A docs/ops/SCHEMA_ORPHAN_STRUCTURAL_SENTINEL_READONLY_CONTRACT.md
A tests/contracts/schema-orphan-structural-sentinel-readonly-contract.test.cjs
A tests/db-engine/schema-orphan-structural-sentinel-postgres.test.cjs
M tests/test-layer-classification.json
M package.json
M scripts/report-ci-test-groups.cjs
M tests/contracts/ci-test-group-registry-contract.test.cjs
M tests/contracts/db-precondition-composition-root-postgres-rehearsal-contract.test.cjs
M .github/workflows/ci.yml
```

The SOURCE_STATIC contract test is registered as `SOURCE_STATIC`. The
DB-engine test is classified as supplemental `DB_ENGINE_EXECUTION`
(`defaultCi:false`, capabilities `postgresql, network`) and is wired
to an isolated GitHub Actions job `db-engine-structural-sentinel`.

## 9. Classification

```text
tests/contracts/schema-orphan-structural-sentinel-readonly-contract.test.cjs
→ SOURCE_STATIC

tests/db-engine/schema-orphan-structural-sentinel-postgres.test.cjs
→ supplemental DB_ENGINE_EXECUTION, defaultCi:false, capabilities postgresql, network
```

The canonical count authority derives new counts automatically (no unrelated
count-literal edits).

## 10. CI / DB-engine rehearsal

The DB-engine test is classified as supplemental `DB_ENGINE_EXECUTION`
(`defaultCi:false`, capabilities `postgresql, network`) and is wired to
an isolated GitHub Actions job `db-engine-structural-sentinel`.

```text
DB-engine source classified
isolated GitHub Actions job wired
local DB execution prohibited
authoritative PostgreSQL evidence pending fresh exact-head CI
```

The job runs on `ubuntu-latest` with Node 20 and `postgres:17.4-bookworm`.
It asserts `server_version_num = 170004` and uses only `LB_TEST_PG*`
loopback synthetic credentials. It executes exactly one package script:
`npm run test:db-engine:structural-sentinel`. No `DATABASE_URL`, repository
secret, provider secret, or local fallback is used. The reporter's
`EXPECTED_DB_ENGINE_SCRIPTS.length` (derived canonical authority) equals the
package `test:db-engine:*` script count, the supplemental `DB_ENGINE_EXECUTION`
count, and the workflow's `170004` occurrence count — derived cardinality, no new literal `9`.

## 11. Capability boundary

The catalog and core declare zero capabilities:

```text
network:        0
provider:       0
DB/SQL execute: 0 (core never executes SQL itself)
filesystem:     0
alert delivery: 0
synthetic write:0
```

## 12. Status and ownership

- This child does not modify product, Auth, API, UI, CSS, Modal runtime,
  Cloudflare runtime, migration manifests, lockfiles, provider
  configuration, or release-health semantics.
- package.json is modified only to register the isolated DB-engine
  rehearsal script; no dependency, lockfile, provider, or release-health
  change is introduced.
- #3461 remains OPEN.
- #4060 reactivates `STRUCTURAL_SCHEMA_DRIFT_CHECK` and
  `MIGRATION_LEDGER_CATALOG_PARITY_CHECK` as `PARITY_EVIDENCE` descriptors with
  the #3860 vocabulary mapping above. #3860 itself is NOT extended to
  Production scope: it remains `DISPOSABLE_POSTGRES_REHEARSAL_TARGET` /
  `CI_EPHEMERAL` only; the sentinel never connects to a database, provider, or
  deployment target.
- Child 3 (write-acknowledgement vs canonical-reread instrumentation), Child 4
  (provider/deployment/alert delivery), and Child 5 (Production synthetic
  canary) remain separately authorized.

Refs #3842.
Refs #4060.
Refs #3835 — completed.
Refs #3834 — completed.
Refs #3458 — completed.
Refs #3860 — completed.
Refs #3461 — Keep OPEN.
Refs #1882 — Keep OPEN.
