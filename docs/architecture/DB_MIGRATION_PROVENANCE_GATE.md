# Database Migration Provenance Gate

Status: bootstrap implementation for Issue #3458. The source contract and pure-JS gate are implemented; a database runner, catalog adapter, and deployment wiring remain separate work.

This document defines the one future authoritative migration system for LoveBud. It does not apply SQL, open a database connection, inspect a live catalog, deploy a service, or claim that any historical script was applied.

The initial implementation lives in:

- `db/migrations/` — reserved canonical migration directory.
- `db/migration-provenance/canonical-migrations.json` — append-only canonical migration manifest.
- `db/migration-provenance/ledger-contract.json` — applied-ledger record contract.
- `db/migration-provenance/expected-schema-manifest.json` — sanitized expected catalog contract.
- `docs/architecture/migration-path-inventory.json` — deterministic repository path inventory.
- `scripts/check-migration-provenance.cjs` — source-only checker and evidence-comparison gate.

Run the repository-only check with:

```text
npm run check:migration-provenance
```

It is intentionally not a database runner. A target-environment decision requires sanitized ledger and catalog evidence files supplied by a future read-only adapter.

## A. Current State

LoveBud currently has several SQL artifacts in `scripts/`, manual runbooks, incident repair procedures, fixture seed scripts, and legacy direct inspection scripts. Source-level contracts prove portions of those files, but source proof is not evidence that a particular environment applied the same bytes in the same order.

The migration path inventory classifies each discovered path rather than retroactively promoting it. In particular:

- Existing `scripts/migration-*.sql` files are legacy compatibility artifacts until an approved adoption decision maps their postconditions to a baseline.
- Reconciliation and repair scripts are incident-only, not a reusable history.
- The tree-comments rollback artifact is rollback-only, not evidence that arbitrary down-migrations are safe.
- Seed scripts are fixture-only and never schema reconstruction inputs.
- Legacy direct inspection scripts are prohibited for new use because they do not emit the sanitized, bounded evidence shape required by this design.

There is no current authoritative applied-migration history. The design therefore treats historical state as `ADOPTION_REQUIRED`, not as a blank or guessed ledger.

Current runtime topology does not change this ownership boundary: Cloudflare Pages routes browser traffic, Modal owns backend compute, and database change authority must remain an explicit, separately approved database operation. Runtime source, API routes, UI, CSS, deployment configuration, and existing SQL artifacts are outside this bootstrap change.

## B. Canonical Ledger

The canonical ledger relation is named `schema_migration_ledger` by contract. Its actual DDL is deliberately deferred to the first approved bootstrap migration so that this implementation does not mutate a database.

Every committed record has these immutable facts:

| Field | Meaning |
| --- | --- |
| `migration_id` | Immutable `YYYYMMDDHHMMSS_slug` identifier. |
| `content_checksum` | SHA-256 checksum of the exact canonical migration file bytes. |
| `applied_at` | Database-generated or runner-recorded application time. |
| `runner_version` | Version of the approved migration runner. |
| `environment_class` | Environment class, not a connection target. |
| `deployed_commit` | Commit whose manifest expected the migration. |
| `transaction_outcome` | Committed outcome only; partial or failed work remains blocking evidence. |

The ledger never stores operator identity, credentials, connection strings, raw catalog output, or raw application rows. The full field and privacy contract is in `db/migration-provenance/ledger-contract.json`.

Ordering is append-only. A duplicate id, unknown id, edited checksum, reordered record, or missing record is a gate blocker. A runner must acquire one database-scoped advisory lock before it evaluates or writes ledger state. A retry is permitted only when the same immutable id and checksum are not already recorded as committed.

## C. Migration Manifest

`canonical-migrations.json` is the source-side manifest. Each future canonical migration must declare:

```text
id
name
path
checksum
depends_on
risk_class
transaction_mode
expected_preconditions
expected_postconditions
rollback_support
destructive_operations
owner_domain
approval_reference
```

The current canonical list is intentionally empty. Existing files are not copied into `db/migrations/`, and their past execution is not inferred. The first canonical entry may be added only after the adoption baseline and runner design are separately approved.

File renames are content changes for provenance purposes: the manifest path, immutable id, and checksum must be reviewed together. Migration content cannot be edited in place after application. A necessary correction is a new forward-fix migration with a new id.

Immutable identity, strictly ascending ordering, canonical path ownership (`db/migrations/<migration_id>.sql`), and byte-exact SHA-256 checksum semantics are defined and source-tested in `docs/architecture/db-migration-identity-order-checksum-contract.md`.

`transaction_mode` is explicit because some PostgreSQL operations cannot run inside a transaction. `REQUIRED` means one transaction must cover the change, `PROHIBITED` means the runner must reject a transaction wrapper, and `EXPLICIT` means the approved runner contract must define the boundary.

## D. Expected-Schema Manifest

The expected-schema manifest has a separate purpose from the migration manifest. It describes the post-migration state that a read-only catalog adapter must compare using sanitized fingerprints.

For each critical object, the eventual active manifest records only:

```text
name
fingerprint
```

The fingerprint input is canonicalized metadata for columns, types, nullability, defaults, primary keys, unique constraints, foreign keys and actions, indexes, triggers, RLS, views, materialized views, grants, and table kind. Raw catalog rows, object owner identities, endpoint names, and values from user data are not committed.

Deterministic fingerprint construction for sanitized structured catalog metadata is implemented as a source-only normalizer (Issue #3542):

- `db/migration-provenance/catalog-metadata-contract.json` — strict metadata contract, enums, bounds, prohibited fields
- `scripts/migration-catalog-fingerprint-core.cjs` — lexical SQL normalization, stable serialization, SHA-256 object fingerprints
- `scripts/build-migration-catalog-evidence.cjs` / `npm run build:migration-catalog-evidence` — explicit `--input` CLI that emits gate-compatible `{ name, fingerprint }` evidence only

The normalizer does not open a database, collect a live catalog, or activate expected-schema. Input must already be sanitized structured JSON. Fingerprints use a domain-separated envelope:

```text
domain = lovebud:migration-catalog-object
format_version / normalizer_version bound to 1.0
```

Quoted SQL literals preserve internal whitespace; comments outside quotes fail closed. The expected-schema manifest binds `normalizer_version` and `metadata_contract_path` while remaining `ADOPTION_REQUIRED` with empty `critical_objects`.

The committed manifest remains `ADOPTION_REQUIRED` with no live-object fingerprint. This means it is structurally valid but cannot authorize a target environment. An empty manifest must never be interpreted as an empty production schema.

### Disposable catalog adapter (Issue #3544)

A separate read-only PostgreSQL catalog adapter constructs sanitized metadata from `pg_catalog` for **explicitly allowlisted synthetic objects** only:

- `scripts/migration-catalog-postgres-adapter-core.cjs`
- `scripts/build-migration-catalog-evidence-from-postgres.cjs` / `npm run build:migration-catalog-evidence-from-postgres`
- Engine proof: `npm run test:db-engine:migration-catalog-adapter` on disposable `postgres:17.4-bookworm` (`server_version_num=170004`)

Hard boundaries:

- explicit connection arguments only (loopback + `lovebud_ci_*` database names); no `DATABASE_URL` / secrets / environment password fallback
- repository-owned constant SQL text only; no caller SQL; no shell interpolation
- `BEGIN READ ONLY` before catalog queries; mutation SQL is not an adapter capability
- abstract role mapping for grants/policies; raw role names never appear in evidence or failure output
- output always passes through the #3542 normalizer and emits only gate-compatible `{ name, fingerprint }` evidence
- does **not** authorize Production/Neon/staging inspection, expected-schema `ACTIVE` transition, or canonical migration adoption

### Inactive expected-schema candidate builder (Issue #3549)

Sanitized catalog evidence can be converted into a **reviewable inactive candidate** without activating committed manifests:

- `scripts/expected-schema-candidate-core.cjs` — pure validation, deterministic ordering, repository-owned fixed fields, existing-validator round-trip
- `scripts/build-expected-schema-candidate.cjs` / `npm run build:expected-schema-candidate -- --evidence <repo-relative.json>` — explicit evidence path, stdout-only candidate JSON

Hard boundaries:

- candidate `status` is always `ADOPTION_REQUIRED` (never `ACTIVE`)
- repository-owned fields (`fingerprint_algorithm`, `normalizer_version`, `metadata_contract_path`, `adoption_rule`, `comparison_scope`) come from the committed inactive template, not the caller
- `critical_objects` are built only from evidence `{ name, fingerprint }` in canonical code-point order
- committed `expected-schema-manifest.json` and `canonical-migrations.json` remain empty/inactive; the builder must not write them
- same-evidence `compareSchema(candidate, evidence)` has no schema mismatch, but overall provenance evaluation remains `GATE_ADOPTION_BASELINE_REQUIRED`
- evidence paths use repository-bound reads only: lexical confinement plus `realpath` containment so repository-local symlinks cannot escape the real repository root
- no database driver, `DATABASE_URL`, network, shell, or stdin

## E. Read-Only Provenance Gate

The gate is a pure comparison engine. It accepts only repository manifests plus two sanitized JSON evidence documents:

```text
ledger evidence: adoption status and ordered { id, checksum } records
catalog evidence: { name, fingerprint } records
```

It does not load an environment variable, call a database driver, use a network client, invoke a shell command, or deploy infrastructure. The later adapter owns connection handling and must emit the narrow evidence shape above.

The gate fails closed on all of the following:

- no ledger evidence or no catalog evidence;
- no approved adoption attestation;
- unknown, duplicate, missing, edited, or reordered migration records;
- missing, unexpected, malformed, or fingerprint-mismatched schema objects;
- a canonical destructive migration without `DESTRUCTIVE` risk, declared operations, and an approval reference.

The implementation has two modes:

| Mode | Invocation | Claim strength |
| --- | --- | --- |
| Source-only | `npm run check:migration-provenance` | Validates inventory, checksums, manifests, canonical directory, and static policy only. It makes no environment claim. |
| Target gate | `node scripts/check-migration-provenance.cjs --ledger-evidence <file> --catalog-evidence <file>` | Compares bounded read-only evidence. It returns `FAIL_CLOSED` unless every required fact matches. |

Environment policy is intentionally graduated:

- Local development may use source-only checks and synthetic fixtures only.
- CI must eventually prove deterministic clean-database reconstruction in disposable PostgreSQL; that is a #3459 implementation dependency.
- Preview and staging require the approved read-only adapter before they can claim target provenance.
- Production must run the read-only gate before migration application or traffic-changing deployment. Gate unavailability is a blocker, never a warning-only success.

## F. Destructive DDL Policy

The following operations are destructive or compatibility-sensitive and need an explicit approval reference, snapshot/rehearsal plan, and a documented recovery path:

| Operation class | Required policy |
| --- | --- |
| `DROP`, `TRUNCATE`, table replacement | Separate approval, isolated rehearsal, backup/restore decision. |
| Column removal or type narrowing | Compatibility impact assessment and forward-fix plan. |
| Nullable to non-null | Proven precondition and backfill safety review. |
| FK cascade expansion | Dependency and delete-behavior review. |
| Primary-key or identifier-type change | Consumer inventory and staged compatibility plan. |
| Data backfill or irreversible normalization | Bounded batches, reconciliation evidence, and recovery criteria. |

The source checker scans canonical migration files for destructive DDL. A detected destructive statement without a declared destructive operation fails source validation. This does not attempt to parse or approve legacy scripts; legacy paths stay classified in the inventory until they are retired or adopted by an owner decision.

The static destructive operation vocabulary, the full actual-vs-declared declaration rule, the recognized dynamic/procedural ambiguity signals that fail closed as `REVIEW_REQUIRED`, the structured approval-reference grammar (with placeholder vs invalid distinction), and the fail-closed error codes are defined and source-tested in `docs/architecture/db-destructive-ddl-approval-contract.md`. That contract is a static regular-expression guard, not a full PostgreSQL parser: recognized ambiguity signals fail closed, but the regex does not prove the absence of unrecognized PostgreSQL semantics, and a future parser/engine rehearsal remains a required complement.

## G. Existing Production Adoption

Adoption is a separate, read-only, explicitly approved change. Its required sequence is:

1. Capture only sanitized catalog metadata through a dedicated read-only adapter.
2. Canonicalize it into critical-object fingerprints without private identifiers or row data.
3. Record one adoption baseline with `ADOPTION_REQUIRED` history clearly separated from applied migration records.
4. Classify observed variance as known drift, unsupported legacy state, or unknown drift.
5. Obtain owner approval before changing either manifest status to `ACTIVE`.
6. Only then introduce the ledger bootstrap migration and runner.

The adoption baseline does not claim which historical scripts ran. It is an attested starting point, not fabricated migration history. No destructive mutation, backfill, cleanup, or repair is permitted merely to make adoption easier.

### Strict adoption-attestation evidence (Issue #3553)

Adoption evidence is **not** a bare status string. The repository-owned contract is:

- `db/migration-provenance/adoption-attestation-contract.json`
- pure validator: `scripts/adoption-attestation-core.cjs`

A valid attestation must bind:

- `baseline_commit` — exact lowercase 40-character Git SHA
- `canonical_manifest_digest` — SHA-256 of exact canonical manifest bytes
- `expected_schema_digest` — SHA-256 of exact expected-schema candidate/manifest bytes
- `catalog_evidence_digest` — SHA-256 of exact sanitized catalog evidence bytes
- abstract `environment_class` only (`DISPOSABLE_CI`, `PREVIEW`, `STAGING`, `PRODUCTION`)
- bounded `variance_classification` (`MATCH`, `KNOWN_DRIFT`, `UNSUPPORTED_LEGACY_STATE`, `UNKNOWN_DRIFT`)
- structured `approval_reference` (`issue:<n>` or `decision:<slug>`), never free-text `"approved"`
- ordered `applied_migrations` with immutable ids and checksums

The evidence document is only a **claim**. A protected invocation binding must supply the trusted expected values for:

```text
baseline_commit
canonical_manifest_digest
expected_schema_digest
catalog_evidence_digest
approval_reference
environment_class
attestation_scope
expected_migrations
```

`expected_migrations` is the repository-owned canonical migration sequence (`[{ id, checksum }]`). An empty array is valid while the committed canonical manifest remains inactive and empty. The validator never reconstructs this list from attestation evidence.

Target gate mode requires explicit trusted arguments (`--baseline-commit`, `--approval-reference`, `--environment-class`, `--attestation-scope`) plus repository-relative evidence paths. Canonical/expected-schema digests are computed from exact repository file bytes; catalog digests are computed from exact confined catalog-evidence file bytes. Semantically equal JSON with different bytes is a digest mismatch. The gate never constructs trusted digests by re-serializing caller-controlled objects.

Hard rules:

- bare `{ "adoption_status": "ATTESTED", "applied_migrations": [] }` fails closed
- self-consistent ATTESTED evidence without a complete trusted binding fails closed (`GATE_ADOPTION_TRUST_BINDING_REQUIRED`)
- host, database name, connection string, secret, operator identity, and raw catalog/row fields are prohibited
- `UNKNOWN_DRIFT` always blocks; `UNSUPPORTED_LEGACY_STATE` blocks without a separate approved policy path
- `KNOWN_DRIFT` requires bounded `known_variance_codes` and still does not activate manifests
- valid synthetic attestation never auto-activates committed manifests
- inactive committed manifests keep the overall gate at `FAIL_CLOSED` with `GATE_ADOPTION_BASELINE_REQUIRED`
- Production attestation remains a separately approved future task
- this child does not open Production/shared databases, execute SQL, or mutate schema

### Inactive adoption-baseline collection plan (Issue #3555)

Phase sequence for Production adoption:

```text
Phase A:
source-only PREPARED_ONLY collection plan

Phase B:
separately approved read-only target catalog collection

Phase C:
owner review of sanitized evidence and drift classification

Phase D:
separate manifest activation decision

Phase E:
ledger bootstrap and approved migration runner
```

Repository-owned Phase A artifacts:

- `db/migration-provenance/adoption-baseline-collection-plan-contract.json`
- `scripts/adoption-baseline-collection-plan-core.cjs`
- `scripts/build-adoption-baseline-collection-plan.cjs` / `npm run build:adoption-baseline-collection-plan`

The plan is always:

```text
plan_status = PREPARED_ONLY
environment_class = PRODUCTION
attestation_scope = PRODUCTION_READONLY
collection_mode = CATALOG_METADATA_ONLY
output_policy = SANITIZED_STDOUT_ONLY
```

It freezes the reviewed object allowlist, abstract role classes (`PUBLIC`, `APPLICATION`, `AUTHENTICATED`, `SERVICE`, `OWNER_CLASS`), mandatory read-only proofs, and sanitized output categories. Digests use domain-separated SHA-256:

```text
lovebud:adoption-baseline-collection-plan
lovebud:adoption-baseline-object-allowlist
```

Hard rules:

- merging #3555 grants **no** target access;
- merging #3555 grants **no** SQL authority;
- merging #3555 does **not** attest any environment;
- merging #3555 does **not** activate manifests;
- plan outputs never claim `ATTESTED`, `ACTIVE`, `APPLIED`, or mutation approval;
- prepared attestation drafts remain `UNATTESTED`;
- the overall provenance gate remains `FAIL_CLOSED` with `GATE_ADOPTION_BASELINE_REQUIRED`;
- a future execution child must reuse this reviewed plan unchanged or return for re-review.

### Production-readonly catalog connection boundary (Issue #3570)

Follow-up from #3569 (`COLLECTION_NOT_RUN_CONNECTION_BOUNDARY`).

#3569 confirmed the disposable catalog adapter is intentionally CI-only:

```text
mode = DISPOSABLE_CI
allowed host = loopback only
database prefix = lovebud_ci_
server version = exact 170004
explicit synthetic connection flags
no DATABASE_URL fallback
```

Those disposable restrictions remain exact. Production support is a **separate** fail-closed mode:

```text
mode = PRODUCTION_READONLY_CATALOG
purpose = catalog metadata collection only
objects = frozen adoption allowlist only
transaction = owned internally (BEGIN READ ONLY → confirm → queries → ROLLBACK)
output = sanitized catalog evidence only
```

Repository-owned boundary artifacts:

- `db/migration-provenance/production-readonly-catalog-boundary-contract.json`
- `scripts/production-readonly-catalog-boundary-core.cjs`
- `scripts/build-production-readonly-catalog-evidence-from-postgres.cjs`
- `npm run build:production-readonly-catalog-evidence-from-postgres`

Secret input policy:

- dedicated key only: `LOVEBUD_PRODUCTION_READONLY_DATABASE_URL`
- explicit repo-relative path under `.secrets/`
- no `--password` / `--host` / `--user` / `--database` argv
- no generic `DATABASE_URL` fallback
- secret values never appear in stdout/stderr/error context

URL / TLS policy:

- `postgres:` / `postgresql:` only
- remote non-loopback host required
- TLS required (`sslmode=require|verify-ca|verify-full` or equivalent)
- no hostname / provider project literals in source

Version policy:

- disposable CI: exact `server_version_num = 170004`
- Production-readonly: major 17 window (`170000 <= version < 180000`)

Role mapping:

- ignored local mapping file only
- abstract classes: `PUBLIC`, `APPLICATION`, `AUTHENTICATED`, `SERVICE`, `OWNER_CLASS`
- unknown raw role → fail closed; raw role names never logged or committed

Hard rules for #3570 itself:

- this child does **not** open a Production DB session;
- this child does **not** collect catalog evidence from Production;
- this child does **not** create/rotate credentials;
- this child does **not** activate manifests;
- a later Phase B collection child may use the boundary only after dedicated read-only credentials and role mapping exist.

## H. Rollback and Forward Fix

Transaction rollback, an explicit rollback artifact, a forward-fix migration, restore from an isolated copy, selective data repair, code rollback, and destructive database restore are different recovery mechanisms.

Every canonical manifest entry must declare `rollback_support`, but that field cannot promise a down migration by default. The normal recovery direction is forward-fix when application data or downstream code may depend on the changed schema. A rollback artifact can be used only when its own exact preconditions, rehearsal evidence, and approval reference pass.

If a migration starts but does not commit, the ledger must expose a blocking non-committed outcome. The runner must stop instead of silently retrying or continuing with later ids.

The fail-closed runner protocol that enforces this boundary — an ACTIVE-manifest requirement, an exact committed ledger prefix, manifest-derived target binding, idempotent no-op/retry rules, preconditions, ledger-append authorization that is bound to a re-evaluated canonical preflight (a forged preflight result never authorizes an append), bounded recovery decisions, and the prohibition on automatic down migrations, re-application of committed migrations, ledger deletion, and ledger history rewrite — is defined and source-tested as a pure contract in `docs/architecture/db-canonical-runner-protocol-contract.md`. That contract is a protocol definition, not a runner; it performs no database connection, SQL execution, ledger write, or advisory lock acquisition.

The dependency-injected async orchestrator that sequences synthetic dependencies around the protocol calls (source validation, manifest load, advisory-lock lifecycle, ledger read, precondition, preflight, execution, postcondition, lock recheck, completion, ledger append, lock release, sanitized result) is defined and source-tested in `docs/architecture/db-canonical-runner-orchestrator-contract.md`. It is not a runner and performs no database connection, SQL execution, real advisory lock, or real ledger write.

## I. Clean Database Reconstruction

The desired reconstruction contract is deterministic:

1. Start from a disposable empty PostgreSQL instance.
2. Apply canonical migrations in manifest order through the approved runner.
3. Validate the ledger checksum/order chain.
4. Produce the expected-schema fingerprints.
5. Compare them with the active expected-schema manifest.
6. Load fixtures only after schema reconstruction; fixture data is never a migration input.

The disposable PostgreSQL harness, runner execution, rollback rehearsal, and CI enforcement are intentionally delegated to #3459 and the child work below. This bootstrap does not claim those checks have run.

## J. Follow-Up Child Work

| Child | Goal | Allowed files | Dependencies | Risk | Production access requirement | Acceptance criteria | Rollback expectation |
| --- | --- | --- | --- | --- | --- | --- | --- |
| 1. Ledger bootstrap | Add ledger relation and runner ownership contract. | `db/migrations/**`, runner modules, tests. | Adoption owner approval. | High. | Separate approved migration window. | Immutable records and lock behavior proven in disposable DB. | Forward-fix unless pre-apply failure rolls back. |
| 2. Manifest tooling | Generate/check ids, checksums, ordering, and dependency graph. | provenance scripts and tests. | Child 1 format. | Medium. | None. | Edited, duplicate, and reordered inputs fail. | Code rollback only. |
| 3. Expected schema | Build canonical metadata normalizer and fingerprint manifest. | read-only adapter, manifests, tests. | Adoption policy. | High. | Read-only catalog access only. | Stable fingerprints cover required metadata categories. | Discard unapproved evidence; no DB mutation. |
| 4. Reconstruction | Rebuild a clean database from canonical migrations. | disposable DB harness and tests. | Children 1–3. | Medium. | None outside disposable DB. | Fresh schema matches expected manifest. | Dispose test database. |
| 5. Provenance adapter | Obtain sanitized ledger/catalog evidence for a target. | read-only adapter and tests. | Children 1–3. | High. | Read-only target access. | Missing/unknown/edited/drift states fail closed. | Disable adapter; no target mutation. |
| 6. DDL approval scanner | Enforce destructive-operation metadata and approval links. | checker, manifests, tests. | Child 2. | Medium. | None. | Every destructive canonical migration blocks without approval. | Code rollback only. |
| 7. Adoption baseline | Attest the existing schema without historical fabrication. | adoption records and documentation. | Child 3 and owner approval. | High. | Read-only production catalog access. | Known versus unknown drift is explicit and reviewable. | Revoke baseline status; no schema change. |
| 8. Deployment integration | Run target gate before migration/deploy actions. | deployment orchestration only after approval. | Children 4–7. | High. | Target read-only gate plus approved deploy flow. | Gate failure blocks action before traffic changes. | Remove integration; no automatic database rollback. |
| 9. Observability | Emit sanitized gate outcomes and reason categories. | observability modules and docs. | Child 5. | Medium. | None for local tests. | No raw catalog/row/identity material in events. | Disable telemetry path. |
| 10. Legacy retirement | Retire or explicitly preserve every manual path. | inventory, runbooks, narrow compatibility changes. | Adoption and owners. | Medium. | Depends on path. | No unclassified schema-changing entry remains. | Restore documentation only; no implicit SQL reversal. |

## Non-Goals of This Bootstrap

- No database connection or migration application.
- No production, staging, provider-console, or deployment access.
- No modification of existing SQL, rollback, repair, runtime, API, UI, CSS, workflow, or provider configuration.
- No claim that clean-database reconstruction, catalog comparison, or deployment integration already exists.
- No change to #3435, #3437, or #1882 status.

Refs #3458

Refs #3435

Refs #3437

Refs #1882

Keep #1882 OPEN.
