# Clean Canonical Bootstrap Rehearsal Contract

## Purpose

Locks the exact file boundary, naming, and invariants for the canonical bootstrap
migration rehearsal (Issue #3846, Step 8 Child 2). The bootstrap migration is the
first entry in the committed canonical migration manifest — it creates the
`schema_migration_ledger` table.

## Exactly 11 files

```text
A  db/migrations/20260802094500_bootstrap-migration-ledger.sql
M  db/migration-provenance/canonical-migrations.json
M  db/migration-provenance/expected-schema-manifest.json
A  scripts/migration-clean-bootstrap-orchestrator-core.cjs
A  docs/architecture/db-clean-canonical-bootstrap-rehearsal-contract.md
A  tests/contracts/db-clean-canonical-bootstrap-rehearsal-contract.test.cjs
A  tests/db-engine/clean-canonical-bootstrap-postgres.test.cjs
M  package.json
M  .github/workflows/ci.yml
M  tests/test-layer-classification.json
M  docs/architecture/DB_MIGRATION_PROVENANCE_NEXT_CHILD_DECISION.md
```

## Naming conventions

- Package script: `test:db-engine:clean-canonical-bootstrap`
- CI job: `db-engine-clean-canonical-bootstrap`
- DB-engine test: `tests/db-engine/clean-canonical-bootstrap-postgres.test.cjs`
- Source-static contract: `tests/contracts/db-clean-canonical-bootstrap-rehearsal-contract.test.cjs`
- Orchestrator core: `scripts/migration-clean-bootstrap-orchestrator-core.cjs`
- SQL migration: `db/migrations/20260802094500_bootstrap-migration-ledger.sql`
- Bootstrap migration ID: `20260802094500_bootstrap-migration-ledger`

## Engine and version

- PostgreSQL service image: `postgres:17.4-bookworm`
- Exact version assertion: `test "${VER}" = "170004"` (server_version_num)

## Loopback-only boundary

- `DB_ENGINE_MISSING_SYNTHETIC_ENV` — LB_TEST_PG* env required
- `DB_ENGINE_UNSAFE_HOST_REJECTED` — only 127.0.0.1, localhost, ::1
- `DB_ENGINE_UNSAFE_USER_REJECTED` — user must match `lovebud_ci*`
- `DB_ENGINE_UNSAFE_ADMIN_DB_REJECTED` — admin db must start with `lovebud_ci_`
- No `DATABASE_URL` env read anywhere in the DB-engine test or workflow
- No Production/Neon/Modal/provider URL references
- No local Docker fallback in test code

## Manifest invariant (committed authority)

`db/migration-provenance/canonical-migrations.json` must be:
- `status: "ADOPTION_REQUIRED"` (deploy activation stays blocked)
- `migrations` array contains exactly one entry: the bootstrap migration
- The migration entry uses the exact 13-field vocabulary:
  `id, name, path, checksum, depends_on, risk_class, transaction_mode,
  expected_preconditions, expected_postconditions, rollback_support,
  destructive_operations, owner_domain, approval_reference`
- `risk_class: "ADDITIVE"`, `transaction_mode: "REQUIRED"`,
  `depends_on: []`, `destructive_operations: []`
- `approval_reference: "issue:3846"`
- The `checksum` is the exact raw-byte sha256 of the on-disk SQL file
- **No** `bootstrap` top-level field (that field was unauthorized)

`db/migration-provenance/expected-schema-manifest.json` must be:
- `status: "ADOPTION_REQUIRED"`
- `critical_objects` contains exactly one entry:
  `{ name: "table:public.schema_migration_ledger", fingerprint: "sha256:…" }`
- The `fingerprint` is the repository catalog normalizer's ledger-table metadata
  fingerprint (computed via `migration-catalog-fingerprint-core.cjs`), which is
  **distinct** from the SQL raw-byte checksum
- **No** `bootstrap` top-level field

## SQL boundary

The bootstrap SQL (`db/migrations/20260802094500_bootstrap-migration-ledger.sql`)
creates exactly one table: `schema_migration_ledger` with the seven fixed ledger
columns (migration_id, content_checksum, applied_at, runner_version,
environment_class, deployed_commit, transaction_outcome). No other DDL, DML,
INSERT, UPDATE, DELETE, GRANT, REVOKE, or DROP is permitted in the bootstrap SQL
or in the DB-engine test code (beyond the committed bootstrap SQL, the
server_version_num assertion, catalog fingerprint collection, and bounded
read-only residual-lock verification).

## Orchestrator boundary (dedicated path)

`scripts/migration-clean-bootstrap-orchestrator-core.cjs` is the dedicated
bootstrap orchestrator. It:

- reads the committed manifests and the on-disk SQL file directly
- validates the committed authority (exactly one migration, exactly one expected
  critical object, raw-byte checksum, catalog-normalizer fingerprint)
- opens ONE pinned session and runs the bootstrap atomically:
  `validate committed manifest/source → verify exact one migration → verify exact
  one expected critical object → verify checksum → verify clean target evidence →
  verify explicit operation → verify target class → verify approval → BEGIN →
  execute exact committed SQL → insert exact ledger row → verify relation and row
  → COMMIT → verify catalog fingerprint → verify no residual state`
- on pre-commit failure: `ROLLBACK`; no committed ledger mutation
- on post-commit verification failure: committed state is reported truthfully;
  `ledgerAppended:true`, `COMMITTED_POST_VERIFICATION_FAILED`, operator investigation required
  remains

It does **NOT** delegate the success path to
`scripts/migration-runner-orchestrator-core.cjs` (`runCanonicalMigration`), does
**NOT** construct a synthetic `ACTIVE` manifest, and does **NOT** bypass the
generic runner's `RUNNER_MANIFEST_NOT_ACTIVE` gate. The generic runner and its
protocol core remain unchanged.

## Classification

- `tests/contracts/db-clean-canonical-bootstrap-rehearsal-contract.test.cjs`:
  `SOURCE_STATIC` in `entries`
- `tests/db-engine/clean-canonical-bootstrap-postgres.test.cjs`:
  `DB_ENGINE_EXECUTION` in `supplemental` with
  `defaultCi: false` and `capabilities: ["postgresql", "network"]`
- The superseded stub
  `tests/contracts/canonical-bootstrap-rehearsal-contract.test.cjs` and its
  classification entry are removed

## Parent completion posture

- Steps 1–7 complete
- Step 8 Child 1 clean-target adoption implemented by #3840
- Step 8 Child 2 canonical bootstrap rehearsal implemented by #3846
- Step 8 Child 3 (target attribution & catalog parity) not authorized
- Step 8 Child 4 (deploy gate & activation) not authorized
- Steps 3–4 do not precede Step 7/8 bootstrap rehearsal

## Production safety

- The bootstrap migration SQL is applied only on disposable PostgreSQL 17.4
  loopback databases via GitHub Actions.
- No Production, staging, Neon, or shared environment access.
- `LOCAL_DB_ENGINE_EXECUTION: NOT_EXECUTED_LOCALLY_BY_POLICY`
- Refs #3846, #3840, #3839, #3816, #3809, #3802, #3657, #3458, #3425, #3435, #3437, #1882
