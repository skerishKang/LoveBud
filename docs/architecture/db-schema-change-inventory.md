# LoveBud Repository Schema-Change Inventory

Status: first small slice of Issue #3458 (design-work item 1 — inventory every schema-changing path). This is a read-only repository audit and classification. It is an inventory and a static guard, not a migration runner, not a database connection, and not an adoption decision.

## Baseline

| Field | Value |
| --- | --- |
| Repository | `skerishKang/LoveBud` |
| Baseline `origin/main` SHA | `cba2577195d9d29d5bbc7b835b765eb5a0e6b99d` |
| Branch | `docs/db-schema-change-inventory-3458` |
| Issue | #3458 |
| Machine-readable inventory | `docs/architecture/db-schema-change-inventory.json` |
| Static guard | `tests/contracts/db-schema-change-inventory-contract.test.cjs` |

## Scope

This inventory enumerates every repository path that can create, alter, drop, repair, seed, or otherwise change (or claim to change) the database schema, plus the read-only provenance tooling that bounds such change. Covered path classes:

- SQL migration files (`scripts/migration-*.sql`)
- SQL incident-repair and reconcile files
- SQL rollback files
- SQL read-only validation guards (`scripts/validate-*.sql`)
- Manual data-mutation SQL (`docs/ops/*.sql`)
- Read-only provenance / catalog tooling (`scripts/*.cjs`)
- Seed and data scripts (`scripts/seed-*`, `run_seed`, `insert-memories`, `fix-tree-visibility`, legacy `*.ps1` seed helpers)
- Direct-connect diagnostic scripts (prohibited for new use)
- DB-engine test harnesses (`tests/db-engine/*.test.cjs`) and their fixture SQL (`tests/db-engine/fixtures/*.sql`)
- The CI workflow that executes DDL inside ephemeral PostgreSQL containers (`.github/workflows/ci.yml`)
- The reserved canonical migration stream (`db/migrations/`, `db/migration-provenance/*`)
- Documentation runbooks that contain manual SQL procedures
- Verified-negative runtime surfaces (Python compute layer, Cloudflare Functions)

## Non-Goals

- No Production, staging, Neon, Firebase, or Cloudflare access.
- No `DATABASE_URL` or secret usage (names may be referenced; values never).
- No SQL execution and no migration application.
- No Docker/PostgreSQL startup by this work (CI's own ephemeral containers are documented, not invoked here).
- No modification of any existing migration, runtime, API, auth, UI, CSS, or CI behavior.
- No implementation of #3435 or #3437.
- No promotion of any legacy path to canonical status. Classification is descriptive, not an adoption decision.
- No fabrication of historical application records.

## Relation to migration-path-inventory.json

`docs/architecture/migration-path-inventory.json` already exists in `main` and remains the authoritative detailed provenance inventory for the migration / repair / runbook / seed / diagnostic paths it covers (per-file checksums and evidence). This inventory does **not** replace or modify it.

This inventory is a broader schema-change surface catalog:

- It carries the existing classifications forward by cross-reference (same `canonical_status` vocabulary, no divergence).
- It adds the schema-execution surface the migration-path inventory does not enumerate: CI ephemeral execution, DB-engine test harnesses, test-fixture SQL, read-only provenance/catalog tooling, the reserved canonical stream, legacy seed/repair helpers, and verified-negative runtime surfaces.

Where an entry overlaps `migration-path-inventory.json`, the classification there is treated as authoritative and is carried forward unchanged.

## Classification Vocabulary

The `canonical_status` vocabulary is intentionally identical to `migration-path-inventory.json`:

| Status | Meaning |
| --- | --- |
| `CANONICAL_CANDIDATE` | Part of the future canonical read-only / provenance direction. NOT a claim of an approved Production migration route. |
| `LEGACY_COMPATIBILITY` | Pre-ledger historical artifact; new execution prohibited until an approved adoption decision maps postconditions to a baseline. |
| `MANUAL_ONLY` | Manual operator procedure requiring separate approval; not represented in an applied ledger. |
| `INCIDENT_REPAIR_ONLY` | Incident-specific and approval-gated; not reusable migration history. |
| `ROLLBACK_ONLY` | Explicit paired rollback artifact; not a generic down-migration; not safe to rerun after success. |
| `TEST_FIXTURE_ONLY` | Fixture / disposable-CI only; never a schema-reconstruction input for Production. |
| `DEPRECATED` | Historical reference only; new use prohibited. |
| `PROHIBITED_FOR_NEW_USE` | Must not be used for new work (e.g., direct-connect diagnostics without a sanitized evidence envelope). |
| `UNCLEAR_REQUIRES_DECISION` | Insufficient evidence; requires an owner decision. |

Important: existing migration files are **not** auto-classified as canonical. Each path is classified descriptively; where evidence is insufficient the entry is left for an owner decision rather than guessed.

## Static Guard

The guard `tests/contracts/db-schema-change-inventory-contract.test.cjs` is a source-only, read-only inventory-completeness check. It fails closed when a new schema-changing artifact is added but not registered in `docs/architecture/db-schema-change-inventory.json`.

Detection rules:

- `RULE_SQL`: every tracked `*.sql` file (outside excluded directories) must be registered.
- `RULE_DDL_SCRIPT`: every `*.cjs/*.js/*.mjs/*.py` file under `scripts/`, `modal_compute/`, or `functions/` whose content contains a DDL statement pattern (`CREATE TABLE/INDEX/POLICY/TRIGGER/SCHEMA`, `CREATE OR REPLACE FUNCTION`, `ALTER TABLE/POLICY`, `DROP TABLE/INDEX/TRIGGER`, `TRUNCATE`, `ENABLE ROW LEVEL SECURITY`) must be registered.
- `RULE_RUNNER_NAME`: every non-test `*.cjs/*.js/*.mjs/*.py/*.sh/*.ps1` file (outside `tests/`) whose basename signals a migration runner or schema-repair path (`migration|rollback|seed|repair|reconcile|adopt|inspect-schema|verify-db`) must be registered.
- `RULE_DOC_SQL`: every `*.md` file under `docs/ops/`, `docs/architecture/`, or `docs/product/` whose basename signals an operator/runbook/manual procedure (`runbook|migrat|repair|recover|reconcil|rollback|foothold|bulk|seed`) **and** that embeds a fenced ` ```sql ` block containing a DDL statement pattern must be registered. Precision = runbook-style name **AND** fenced DDL. This catches manual SQL procedure documents while excluding explanatory naming/status/audit docs and prose-only architecture docs (their DDL mentions are not executable procedures). Runbooks that delegate DDL to a separate inventoried `*.sql` artifact and embed only read-only verification queries are intentionally not flagged by this rule (their schema-changing capability is captured via the artifact entry).

Explicit exclusions (false-positive and generated/vendor handling): `node_modules/`, `.git/`, `dist/`, `build/`, `coverage/`, `vendor/`, `.local/`, `.hermes/`, `docs/conversation/`, `package-lock.json`, the two inventory JSON files, and the guard test file itself.

The guard also verifies: required entry fields, enum validity, no duplicate paths, no stale entries (every registered path exists on disk), and two hard verified-negative DDL invariants — the Python compute layer (`modal_compute/**/*.py`) and the Cloudflare Functions runtime (`functions/**/*.{js,cjs,mjs}`) must contain no literal schema-changing DDL. These invariants fail the guard regardless of inventory registration; registering a path does not satisfy them.

Run the focused guard:

```text
node --test tests/contracts/db-schema-change-inventory-contract.test.cjs
```

Limitation: this guard is a static inventory-omission guard. It does **not** connect to PostgreSQL, does **not** run migrations, and does **not** guarantee runtime schema correctness. It is not a substitute for the disposable-CI DB-engine tests (`npm run test:db-engine:*`) or the read-only provenance gate (`npm run check:migration-provenance`).

## Verified-Negative Surfaces

| Surface | Finding |
| --- | --- |
| `modal_compute/` (Python runtime data layer) | Verified to contain no literal DDL. Issues DML only. Not a schema-change path. Hard invariant: any literal DDL under `modal_compute/**/*.py` fails the guard regardless of inventory registration. |
| `functions/` (Cloudflare Pages Functions / same-origin `/api`) | Verified to contain no inline DDL and no direct DB schema operations; requests proxy to Modal. Not a schema-change path. Hard invariant: any literal DDL under `functions/**/*.{js,cjs,mjs}` fails the guard regardless of inventory registration (registering a path does not satisfy it). |

## Category Breakdown

83 inventory entries plus 2 verified-negative surfaces.

By `canonical_status`:

| Canonical status | Count |
| --- | --- |
| `CANONICAL_CANDIDATE` | 27 |
| `LEGACY_COMPATIBILITY` | 9 |
| `MANUAL_ONLY` | 6 |
| `INCIDENT_REPAIR_ONLY` | 9 |
| `ROLLBACK_ONLY` | 1 |
| `TEST_FIXTURE_ONLY` | 24 |
| `DEPRECATED` | 2 |
| `PROHIBITED_FOR_NEW_USE` | 4 |
| `UNCLEAR_REQUIRES_DECISION` | 0 |

By category:

| Category | Count |
| --- | --- |
| `sql_migration` | 9 |
| `sql_incident_repair` | 2 |
| `sql_rollback` | 1 |
| `sql_validation_guard` | 4 |
| `sql_data_mutation` | 1 |
| `provenance_tooling` | 11 |
| `catalog_adapter` | 5 |
| `direct_connect_diagnostic` | 4 |
| `seed_or_data_script` | 12 |
| `test_fixture_sql` | 9 |
| `db_engine_test` | 7 |
| `ci_workflow` | 1 |
| `canonical_stream` | 8 |
| `doc_runbook` | 10 |

Flags: 5 entries are `destructive`; 20 entries are `production_capable` (technically a route that could change a Production schema if an operator runs it; read-only validators, ephemeral-CI fixtures/tests, disposable loopback adapters, and pure-JS cores are not).

## Inventory by category

`D` = destructive, `P` = production-capable. Full machine-readable detail (operations, idempotency, execution actor, automation, ledger candidacy, notes) is in `docs/architecture/db-schema-change-inventory.json`.

### canonical_stream (8)

| Path | Engine | Canonical status | Destructive | Prod-capable |
| --- | --- | --- | --- | --- |
| `db/migrations/README.md` | postgres | CANONICAL_CANDIDATE | no | no |
| `db/migration-provenance/canonical-migrations.json` | none | CANONICAL_CANDIDATE | no | no |
| `db/migration-provenance/ledger-contract.json` | none | CANONICAL_CANDIDATE | no | no |
| `db/migration-provenance/expected-schema-manifest.json` | none | CANONICAL_CANDIDATE | no | no |
| `db/migration-provenance/catalog-metadata-contract.json` | none | CANONICAL_CANDIDATE | no | no |
| `db/migration-provenance/adoption-attestation-contract.json` | none | CANONICAL_CANDIDATE | no | no |
| `db/migration-provenance/adoption-baseline-collection-plan-contract.json` | none | CANONICAL_CANDIDATE | no | no |
| `db/migration-provenance/production-readonly-catalog-boundary-contract.json` | none | CANONICAL_CANDIDATE | no | no |

### sql_validation_guard (4)

| Path | Engine | Canonical status | Destructive | Prod-capable |
| --- | --- | --- | --- | --- |
| `scripts/validate-generic-social-a-preflight.sql` | postgres | CANONICAL_CANDIDATE | no | no |
| `scripts/validate-generic-social-a-postcondition.sql` | postgres | CANONICAL_CANDIDATE | no | no |
| `scripts/validate-generic-social-b-preflight.sql` | postgres | CANONICAL_CANDIDATE | no | no |
| `scripts/validate-generic-social-b-postcondition.sql` | postgres | CANONICAL_CANDIDATE | no | no |

### provenance_tooling (10)

| Path | Engine | Canonical status | Destructive | Prod-capable |
| --- | --- | --- | --- | --- |
| `scripts/migration-provenance-core.cjs` | none | CANONICAL_CANDIDATE | no | no |
| `scripts/check-migration-provenance.cjs` | none | CANONICAL_CANDIDATE | no | no |
| `scripts/migration-catalog-fingerprint-core.cjs` | none | CANONICAL_CANDIDATE | no | no |
| `scripts/build-migration-catalog-evidence.cjs` | none | CANONICAL_CANDIDATE | no | no |
| `scripts/expected-schema-candidate-core.cjs` | none | CANONICAL_CANDIDATE | no | no |
| `scripts/build-expected-schema-candidate.cjs` | none | CANONICAL_CANDIDATE | no | no |
| `scripts/adoption-attestation-core.cjs` | none | CANONICAL_CANDIDATE | no | no |
| `scripts/adoption-baseline-collection-plan-core.cjs` | none | CANONICAL_CANDIDATE | no | no |
| `scripts/build-adoption-baseline-collection-plan.cjs` | none | CANONICAL_CANDIDATE | no | no |
| `scripts/phase-b-collection-receipt-core.cjs` | none | CANONICAL_CANDIDATE | no | no |
| `scripts/run-production-readonly-runtime-role-acl-attestation.cjs` | postgres | CANONICAL_CANDIDATE | no | no |

### catalog_adapter (5)

| Path | Engine | Canonical status | Destructive | Prod-capable |
| --- | --- | --- | --- | --- |
| `scripts/migration-catalog-postgres-adapter-core.cjs` | postgres_ephemeral_ci | CANONICAL_CANDIDATE | no | no |
| `scripts/build-migration-catalog-evidence-from-postgres.cjs` | postgres_ephemeral_ci | CANONICAL_CANDIDATE | no | no |
| `scripts/production-readonly-catalog-boundary-core.cjs` | none | CANONICAL_CANDIDATE | no | no |
| `scripts/build-production-readonly-catalog-evidence-from-postgres.cjs` | postgres | CANONICAL_CANDIDATE | no | no |
| `scripts/run-production-readonly-catalog-collection.cjs` | postgres | CANONICAL_CANDIDATE | no | no |

### sql_migration (9)

| Path | Engine | Canonical status | Destructive | Prod-capable |
| --- | --- | --- | --- | --- |
| `scripts/migration-add-channel-fields.sql` | postgres | LEGACY_COMPATIBILITY | no | yes |
| `scripts/migration-add-generic-social-targets.sql` | postgres | LEGACY_COMPATIBILITY | no | yes |
| `scripts/migration-add-reactions-comments.sql` | postgres | LEGACY_COMPATIBILITY | no | yes |
| `scripts/migration-add-tree-comments.sql` | postgres | LEGACY_COMPATIBILITY | no | yes |
| `scripts/migration-add-tree-metadata.sql` | postgres | LEGACY_COMPATIBILITY | no | yes |
| `scripts/migration-add-tree-social-counts.sql` | postgres | LEGACY_COMPATIBILITY | no | yes |
| `scripts/migration-add-tree-view-tracking.sql` | postgres | LEGACY_COMPATIBILITY | no | yes |
| `scripts/migration-b-generic-social-targets-cutover.sql` | postgres | LEGACY_COMPATIBILITY | no | yes |
| `scripts/migration-harden-moment-social-writes.sql` | postgres | LEGACY_COMPATIBILITY | no | yes |

### sql_incident_repair (2)

| Path | Engine | Canonical status | Destructive | Prod-capable |
| --- | --- | --- | --- | --- |
| `scripts/migration-reconcile-tree-comments-legacy-schema.sql` | postgres | INCIDENT_REPAIR_ONLY | yes | yes |
| `scripts/migration-repair-trees-schema-3435.sql` | postgres | INCIDENT_REPAIR_ONLY | no | yes |

### sql_rollback (1)

| Path | Engine | Canonical status | Destructive | Prod-capable |
| --- | --- | --- | --- | --- |
| `scripts/rollback-tree-comments-legacy-reconcile.sql` | postgres | ROLLBACK_ONLY | yes | yes |

### sql_data_mutation (1)

| Path | Engine | Canonical status | Destructive | Prod-capable |
| --- | --- | --- | --- | --- |
| `docs/ops/bulk-public-all-test-data.sql` | postgres | MANUAL_ONLY | no | yes |

### seed_or_data_script (12)

| Path | Engine | Canonical status | Destructive | Prod-capable |
| --- | --- | --- | --- | --- |
| `scripts/seed-public-trees.cjs` | postgres | TEST_FIXTURE_ONLY | no | no |
| `scripts/seed-public-trees.js` | postgres | TEST_FIXTURE_ONLY | no | no |
| `scripts/seed-public-multi-branch-fixture.cjs` | postgres | TEST_FIXTURE_ONLY | no | no |
| `scripts/seed-public-multi-branch-fixture.js` | postgres | TEST_FIXTURE_ONLY | no | no |
| `scripts/run_seed.cjs` | postgres | TEST_FIXTURE_ONLY | no | no |
| `scripts/run_seed.js` | postgres | TEST_FIXTURE_ONLY | no | no |
| `scripts/insert-memories.cjs` | postgres | MANUAL_ONLY | no | no |
| `scripts/fix-tree-visibility.cjs` | postgres | INCIDENT_REPAIR_ONLY | no | no |
| `scripts/fix-tree-visibility.js` | postgres | INCIDENT_REPAIR_ONLY | no | no |
| `scripts/prepare-legacy-tree-entity-repair.cjs` | none | INCIDENT_REPAIR_ONLY | no | no |
| `scripts/run-seed.ps1` | postgres | TEST_FIXTURE_ONLY | no | no |
| `scripts/verify-seed.ps1` | postgres | TEST_FIXTURE_ONLY | no | no |

### direct_connect_diagnostic (4)

| Path | Engine | Canonical status | Destructive | Prod-capable |
| --- | --- | --- | --- | --- |
| `scripts/inspect-schema.cjs` | postgres | PROHIBITED_FOR_NEW_USE | no | no |
| `scripts/inspect-schema.js` | postgres | PROHIBITED_FOR_NEW_USE | no | no |
| `scripts/verify-db.cjs` | postgres | PROHIBITED_FOR_NEW_USE | no | no |
| `scripts/verify-db.js` | postgres | PROHIBITED_FOR_NEW_USE | no | no |

### test_fixture_sql (9)

| Path | Engine | Canonical status | Destructive | Prod-capable |
| --- | --- | --- | --- | --- |
| `tests/db-engine/fixtures/generic-social-a-legacy.sql` | postgres_ephemeral_ci | TEST_FIXTURE_ONLY | no | no |
| `tests/db-engine/fixtures/generic-social-a-guard-legacy.sql` | postgres_ephemeral_ci | TEST_FIXTURE_ONLY | no | no |
| `tests/db-engine/fixtures/generic-social-b-guard-legacy.sql` | postgres_ephemeral_ci | TEST_FIXTURE_ONLY | no | no |
| `tests/db-engine/fixtures/generic-social-b-rehearsal-legacy.sql` | postgres_ephemeral_ci | TEST_FIXTURE_ONLY | no | no |
| `tests/db-engine/fixtures/generic-social-b-rehearsal-empty-legacy.sql` | postgres_ephemeral_ci | TEST_FIXTURE_ONLY | no | no |
| `tests/db-engine/fixtures/tree-comments-legacy.sql` | postgres_ephemeral_ci | TEST_FIXTURE_ONLY | no | no |
| `tests/db-engine/fixtures/trees-schema-damaged.sql` | postgres_ephemeral_ci | TEST_FIXTURE_ONLY | no | no |
| `tests/db-engine/fixtures/migration-catalog-postgres-adapter/synthetic-baseline.sql` | postgres_ephemeral_ci | TEST_FIXTURE_ONLY | no | no |
| `tests/db-engine/fixtures/hub-layout-fingerprint-4346/prerequisite.sql` | postgres_ephemeral_ci | TEST_FIXTURE_ONLY | no | no |

### db_engine_test (7)

| Path | Engine | Canonical status | Destructive | Prod-capable |
| --- | --- | --- | --- | --- |
| `tests/db-engine/tree-comments-reconcile-postgres.test.cjs` | postgres_ephemeral_ci | TEST_FIXTURE_ONLY | yes | no |
| `tests/db-engine/trees-schema-foothold-postgres.test.cjs` | postgres_ephemeral_ci | TEST_FIXTURE_ONLY | no | no |
| `tests/db-engine/generic-social-a-postgres.test.cjs` | postgres_ephemeral_ci | TEST_FIXTURE_ONLY | no | no |
| `tests/db-engine/generic-social-a-guard-postgres.test.cjs` | postgres_ephemeral_ci | TEST_FIXTURE_ONLY | no | no |
| `tests/db-engine/generic-social-b-postgres.test.cjs` | postgres_ephemeral_ci | TEST_FIXTURE_ONLY | no | no |
| `tests/db-engine/generic-social-b-guard-postgres.test.cjs` | postgres_ephemeral_ci | TEST_FIXTURE_ONLY | no | no |
| `tests/db-engine/migration-catalog-postgres-adapter-engine.test.cjs` | postgres_ephemeral_ci | TEST_FIXTURE_ONLY | no | no |

### ci_workflow (1)

| Path | Engine | Canonical status | Destructive | Prod-capable |
| --- | --- | --- | --- | --- |
| `.github/workflows/ci.yml` | postgres_ephemeral_ci | TEST_FIXTURE_ONLY | yes | no |

### doc_runbook (10)

| Path | Engine | Canonical status | Destructive | Prod-capable |
| --- | --- | --- | --- | --- |
| `docs/ops/generic-social-targets-migration-a-runbook.md` | postgres | MANUAL_ONLY | no | yes |
| `docs/ops/generic-social-targets-migration-b-runbook.md` | postgres | MANUAL_ONLY | no | yes |
| `docs/ops/moment-social-write-hardening-migration-runbook.md` | postgres | MANUAL_ONLY | no | yes |
| `docs/ops/lovebud-trees-schema-foothold-3435.md` | postgres | INCIDENT_REPAIR_ONLY | no | yes |
| `docs/product/lovebud-tree-comments-legacy-schema-reconciliation-runbook.md` | postgres | INCIDENT_REPAIR_ONLY | yes | yes |
| `docs/ops/MIGRATE_BULK_PUBLIC_20260419.md` | postgres | DEPRECATED | no | no |
| `docs/ops/LEGACY_TREE_ENTITY_REPAIR_RUNBOOK.md` | postgres | INCIDENT_REPAIR_ONLY | no | yes |
| `docs/product/lovebud-legacy-tree-entity-recovery-contract.md` | postgres | INCIDENT_REPAIR_ONLY | no | yes |
| `docs/ops/bulk-public-sample-trees.md` | postgres | MANUAL_ONLY | no | no |
| `docs/migration/POSTGRES_MIGRATION.md` | postgres | DEPRECATED | no | no |

## Production / Database / SQL Boundary

| Question | Answer |
| --- | --- |
| SQL executed | No |
| Production accessed | No |
| Database accessed | No database connection was opened by this work |
| Secrets used | No `DATABASE_URL` or secret value was used (names referenced only) |
| Migration applied | No |
| Existing migration modified | No |
| #3435 / #3437 implemented | No |
| Live schema inspection performed | No |

CI note: `.github/workflows/ci.yml` starts ephemeral PostgreSQL service containers and runs DB-engine tests that apply fixture/migration SQL **inside the disposable container only**. That schema execution is strictly CI-ephemeral; no Production, staging, or shared database is reached. This work documents that path but does not invoke it.

## Known Gaps

- A parallel branch `codex/3458-migration-provenance` exists on the remote. It is **not merged** and has **no open PR**. It uses different filenames (`docs/architecture/migration-path-inventory.json`, `DB_MIGRATION_PROVENANCE_GATE.md`) and overlaps conceptually with work already in `main`. This inventory uses distinct filenames and does not conflict, but the two efforts should be reconciled by an owner.
- `docs/ops/LEGACY_TREE_ENTITY_REPAIR_RUNBOOK.md` and `docs/product/lovebud-legacy-tree-entity-recovery-contract.md` are newly enumerated here (not present in `migration-path-inventory.json`). Their exact disposition requires owner confirmation; they are classified `INCIDENT_REPAIR_ONLY` descriptively.
- Two legacy PowerShell seed helpers (`scripts/run-seed.ps1`, `scripts/verify-seed.ps1`) reference a database URL environment variable and a hardcoded legacy local path; `verify-seed.ps1` also embeds hardcoded row identifiers. They are documented as legacy fixture/verification helpers; their embedded identifiers were intentionally **not** propagated into this inventory.
- The canonical migration stream (`db/migrations/`, `db/migration-provenance/*`) is reserved and inactive (`ADOPTION_REQUIRED`) with two catalogued migrations under `db/migrations/`; catalog population is distinct from runner activation. No historical application records are fabricated.
- Documentation runbooks that contain fenced SQL are inventoried as a curated list. The static guard intentionally enforces executable artifacts (`*.sql`, DDL-bearing scripts, runner-named scripts) rather than prose, to avoid false positives from chat logs, debug guides, and POC plans that merely mention DDL.
- `UNCLEAR_REQUIRES_DECISION` count is 0 today, but owner decisions are still required for the `pending_owner_decision` ledger-candidacy flags on legacy migration paths.

## Protected Issues

Refs #3458 - Keep #3458 OPEN.

Refs #3425 - Keep #3425 OPEN.

Refs #3435 - Keep #3435 OPEN.

Refs #3437 - Keep #3437 OPEN.

Refs #1882 - Keep #1882 OPEN.
