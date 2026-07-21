# LoveBud DB Migration Provenance Current-State Audit

## Audit Baseline

| Field | Value |
| --- | --- |
| Audit issue | [#3620](https://github.com/skerishKang/LoveBud/issues/3620) |
| Parent issue | [#3458](https://github.com/skerishKang/LoveBud/issues/3458) |
| Baseline commit | `de1c4e416e33e2669157b2202a7bbd021779ad59` |
| Audit date | 2026-07-22 |
| Auditor model | DeepSeek V4 Pro (primary) |
| Database accessed | No |
| Production accessed | No |
| SQL executed | No |
| Secrets accessed | No |
| Files modified | None (read-only) |

## Scope and Non-Authority

This audit examines the current repository state on `main` at the baseline commit. It does not:

- Connect to any database, Production, staging, or shared environment
- Execute SQL, apply migrations, or mutate schema/data/security state
- Access `.secrets/`, `DATABASE_URL`, credentials, or provider consoles
- Activate committed manifests (`canonical-migrations.json`, `expected-schema-manifest.json`)
- Modify existing files, runbooks, SQL, CI, or runtime code
- Claim that source-only checks prove target-environment compatibility

This audit is an evidence-based classification of what exists in the repository. It is not a database audit, a deployment gate, or a Production authorization.

## Evidence Method

Each classification below is derived from cross-referencing:

1. **Current repository files**: direct reads of `docs/architecture/`, `db/`, `scripts/`, `tests/`, `package.json`, `.github/workflows/ci.yml`
2. **GitHub issue/PR history**: `gh issue view` and `gh pr view` for all children under #3458
3. **Source code traceability**: implementation ownership verified by reading source files, not inferred from filenames

Claims are qualified. A file's existence is not equated with working implementation. A contract's existence is not equated with Production enforcement.

---

## Parent Acceptance-Criteria Matrix

Each criterion from [#3458](https://github.com/skerishKang/LoveBud/issues/3458) is classified against current `main`.

### 1. Canonical migration directory/runner/ledger contract

**Classification**: PARTIAL

**Repository evidence**:
- `db/migrations/` directory exists (reserved) — contains only `README.md`
- `db/migration-provenance/ledger-contract.json` — canonical contract defining `schema_migration_ledger` relation, required fields, ordering, concurrency, and partial-apply rules
- `db/migration-provenance/canonical-migrations.json` — source-side manifest contract with field definitions
- `scripts/migration-provenance-core.cjs` (642 lines) — validates inventory, migration manifests, checksums, destructive DDL patterns; source-only
- `scripts/check-migration-provenance.cjs` — CLI gate with source-only and target gate modes

**Issue/PR evidence**:
- PR #3474 (MERGED 2026-07-13): delivered the bootstrap gate and contract infrastructure

**Test layer**: SOURCE_STATIC (`tests/contracts/migration-provenance-gate-contract.test.cjs`)

**What it proves**:
- Source-only contract validation works: checksums, classification, destructive DDL detection, manifest field completeness
- Ledger contract defines immutable shape, ordering rules, concurrency rules
- Directory reservation and activation rules are documented

**What it does not prove**:
- No ledger DDL has been executed (relation is deferred)
- No migration runner implementation exists
- No canonical migration entries exist (`migrations: []`)
- No migration has been applied, recorded, or verified in any environment

**Dependency**: Ledger bootstrap migration (separately approved)
**Next action**: Remains a future child after adoption baseline

---

### 2. Schema-changing path classification

**Classification**: COMPLETE

**Repository evidence**:
- `docs/architecture/migration-path-inventory.json` — inventories 30 repository paths across 9 classification categories
- `scripts/migration-provenance-core.cjs` — validates inventory classification enum, required fields, and checksum consistency

**Issue/PR evidence**:
- Delivered in PR #3474 as part of gate bootstrap

**Test layer**: SOURCE_STATIC

**What it proves**:
- Every known schema-changing path is inventoried and classified
- Classifications include: CANONICAL_CANDIDATE, LEGACY_COMPATIBILITY, MANUAL_ONLY, INCIDENT_REPAIR_ONLY, ROLLBACK_ONLY, TEST_FIXTURE_ONLY, DEPRECATED, PROHIBITED_FOR_NEW_USE, UNCLEAR_REQUIRES_DECISION
- Source checker validates inventory consistency

**What it does not prove**:
- Classifications are not enforced at deployment time
- No mechanism prevents new unclassified paths from being added

**Dependency**: None (self-contained)
**Next action**: Maintain as new paths are added

---

### 3. Stable migration IDs and checksums

**Classification**: PARTIAL

**Repository evidence**:
- `db/migration-provenance/canonical-migrations.json` — defines `YYYYMMDDHHMMSS_slug` format, `sha256` algorithm
- `scripts/migration-provenance-core.cjs` — validates `MIGRATION_ID_PATTERN` and `SHA256_PATTERN`
- Source checker validates checksums byte-for-byte

**Test layer**: SOURCE_STATIC

**What it proves**:
- ID format and checksum algorithm are contractually defined
- Source validator rejects invalid IDs and checksums

**What it does not prove**:
- No actual migrations exist to assign IDs or checksums to
- No mechanism prevents content changes to files that share an ID
- File rename + ID preservation behavior is not exercised

**Dependency**: First canonical migration entry
**Next action**: Exercised when first canonical migration is added

---

### 4. Clean-database reconstruction

**Classification**: NOT_STARTED

**Repository evidence**:
- No migration runner exists
- No reconstruction harness exists
- DB engine tests exist for specific incident paths (tree comments reconcile, generic social migrations A/B) but these are incident-specific, not a general reconstruction pipeline
- Architecture doc Section I defines the desired contract

**Issue/PR evidence**:
- #3459 (CLOSED) was the original designated child; the gateway PR #3474 delivered provenance infrastructure but not reconstruction
- No CI job rebuilds a clean database from canonical migrations

**Test layer**: None (no test exists)

**What it proves**: Nothing — not implemented

**What it does not prove**: N/A

**Dependency**: Ledger bootstrap, migration runner, canonical migrations
**Next action**: Multi-phase future work

---

### 5. Target ledger mismatch detection

**Classification**: PARTIAL

**Repository evidence**:
- `scripts/check-migration-provenance.cjs` — target gate mode accepts `--ledger-evidence` and `--catalog-evidence` arguments
- Gate fails closed on missing/invalid evidence and mismatched migration records
- Ledger evidence contract is defined

**Test layer**: SOURCE_STATIC (gate logic tested with synthetic evidence)

**What it proves**:
- Gate comparison engine works with synthetic evidence
- Missing, duplicate, reordered, and checksum-mismatched records are detected

**What it does not prove**:
- No target ledger evidence has been collected (no adapter for Production/staging)
- Source-only mode is the only currently functional mode
- No CI job runs target gate mode against a real database

**Dependency**: Read-only target adapter
**Next action**: Requires target adapter implementation

---

### 6. Target catalog drift detection

**Classification**: PARTIAL

**Repository evidence**:
- `scripts/migration-catalog-fingerprint-core.cjs` (969 lines) — deterministic sanitized fingerprint normalizer
- `scripts/migration-catalog-postgres-adapter-core.cjs` — disposable read-only pg_catalog adapter
- `scripts/build-migration-catalog-evidence.cjs` — explicit `--input` CLI for pre-sanitized catalog evidence
- `scripts/build-migration-catalog-evidence-from-postgres.cjs` — disposable CI-only adapter invocation
- `db/migration-provenance/catalog-metadata-contract.json` (280 lines) — strict metadata contract
- `scripts/expected-schema-candidate-core.cjs` — candidate builder from evidence

**Issue/PR evidence**:
- PR #3543 (MERGED): catalog fingerprint normalizer
- PR #3546 (MERGED): disposable read-only adapter
- PR #3550 (MERGED): inactive expected-schema candidate builder

**Test layer**: SOURCE_STATIC (contract tests) + DB_ENGINE_EXECUTION (disposable PostgreSQL `server_version_num=170004`)

**CI**: `db-engine-migration-catalog-adapter` job in `ci.yml`

**What it proves**:
- Fingerprint normalizer produces deterministic fingerprints from sanitized catalog metadata
- Disposable adapter reads sanitized metadata from synthetic allowlisted objects on PostgreSQL 17.4
- Candidate builder validates evidence and produces reviewable candidates

**What it does not prove**:
- No target catalog evidence has been collected (disposable CI only)
- Disposable adapter is explicitly loopback-only, `lovebud_ci_*` database prefix only
- Adapter cannot connect to Production, staging, or any non-loopback target
- Expected-schema manifest remains `ADOPTION_REQUIRED` with empty `critical_objects`

**Dependency**: Production-readonly boundary + dedicated credentials + abstract role mapping
**Next action**: Blocked on operator input

---

### 7. Destructive DDL approval boundary

**Classification**: PARTIAL

**Repository evidence**:
- `scripts/migration-provenance-core.cjs` — `DESTRUCTIVE_SQL_PATTERN` regex scans canonical migration SQL for destructive statements
- `canonical-migrations.json` — `destructive_ddl_rule` requires `DESTRUCTIVE` risk, declared operations, and approval reference
- Architecture doc Section F defines destructive operation classes and policies

**Test layer**: SOURCE_STATIC (pattern detection validated)

**What it proves**:
- Source scanner detects destructive DDL patterns
- Manifest contract requires approval metadata for destructive migrations

**What it does not prove**:
- No destructive canonical migration exists to test the full boundary end-to-end
- Pattern is regex-based, not a SQL parser — may have false negatives for complex DDL
- No deployment gate enforces destructive-approval check before Production apply

**Dependency**: First destructive canonical migration
**Next action**: Exercised when first destructive migration is added

---

### 8. Existing Production adoption without fabricated history

**Classification**: PARTIAL

**Repository evidence**:
- `db/migration-provenance/adoption-attestation-contract.json` (142 lines) — strict attestation contract
- `scripts/adoption-attestation-core.cjs` (1339 lines) — pure validator
- `db/migration-provenance/adoption-baseline-collection-plan-contract.json` (461 lines) — PREPARED_ONLY plan with allowlist
- `scripts/adoption-baseline-collection-plan-core.cjs` — plan contract validator
- `scripts/build-adoption-baseline-collection-plan.cjs` — plan builder CLI
- `scripts/production-readonly-catalog-boundary-core.cjs` (793 lines) — fail-closed boundary
- `db/migration-provenance/production-readonly-catalog-boundary-contract.json` (76 lines)
- Architecture doc Section G defines adoption sequence (phases A-E)

**Issue/PR evidence**:
- PR #3554 (MERGED): adoption attestation contract
- PR #3556 (MERGED): adoption baseline collection plan
- PR #3571 (MERGED): Production-readonly catalog boundary
- #3569 (CLOSED): Production catalog collection → `COLLECTION_NOT_RUN_CONNECTION_BOUNDARY`
- #3572 (CLOSED): retry readiness audit → `NO_RETRY`

**Test layer**: SOURCE_STATIC (contract tests for attestation, collection plan, boundary)
No Production collection has occurred.

**What it proves**:
- Adoption evidence contract is strict and fail-closed
- Collection plan defines exact allowlist (9 tables), abstract role classes (5), and read-only proofs
- Production-readonly boundary defines dedicated secret key (`LOVEBUD_PRODUCTION_READONLY_DATABASE_URL`), URL/TLS policy, version policy (major 17)
- Plan status is always `PREPARED_ONLY` — never `ATTESTED` or `ACTIVE`

**What it does not prove**:
- No Production catalog has been collected
- No adoption attestation has been issued
- No manifest activation has occurred
- Dedicated read-only credentials do not exist in the repository
- Abstract role mapping file does not exist in the repository
- Collection plan has not been reviewed by owner

**Dependency**: Dedicated read-only credentials + owner-reviewed role mapping + owner approval
**Next action**: Blocked on operator input

---

### 9. Rollback/forward-fix policy

**Classification**: PARTIAL

**Repository evidence**:
- Architecture doc Section H defines rollback/forward-fix policy
- `canonical-migrations.json` — each entry must declare `rollback_support`
- `db/migration-provenance/ledger-contract.json` — non-committed outcomes block subsequent application
- Inventory classifies `scripts/rollback-tree-comments-legacy-reconcile.sql` as ROLLBACK_ONLY

**Test layer**: SOURCE_STATIC (policy documented, inventory classified)

**What it proves**:
- Policy is documented: forward-fix is preferred recovery direction
- Partial-apply blocking is contractually defined
- Existing rollback artifact is explicitly classified as incident-specific

**What it does not prove**:
- No canonical migration has exercised rollback or forward-fix
- Rollback artifact has not been validated as safe against current Production state
- No runner implements the partial-apply blocking behavior

**Dependency**: Migration runner + actual migrations
**Next action**: Exercised when migration runner is implemented

---

### 10. Deployment preflight enforcement

**Classification**: NOT_STARTED

**Repository evidence**:
- No deployment gate integration exists
- `npm run check:migration-provenance` is a manual source-only check
- `npm run ci` runs `lint`, `build`, `test`, `verify` — no provenance check
- No CI job runs target gate mode (`--ledger-evidence`, `--catalog-evidence`)
- No pre-deploy or deploy hook calls the provenance gate

**Test layer**: None (no deployment test)

**What it proves**: Nothing — not implemented

**What it does not prove**: N/A

**Dependency**: Target adapter, Production catalog collection, adoption attestation, ledger bootstrap
**Next action**: Multi-phase future work after adoption

---

### 11. Sanitized observability

**Classification**: NOT_STARTED

**Repository evidence**:
- Architecture doc Section J, child 9 defines observability scope
- No observability module exists
- `scripts/report-test-layers.cjs` reports deterministic classification but is not a provenance observability module

**Test layer**: None

**What it proves**: Nothing — not implemented

**What it does not prove**: N/A

**Dependency**: Target adapter, gate integration
**Next action**: Future work

---

### 12. Legacy migration path retirement

**Classification**: PARTIAL

**Repository evidence**:
- `docs/architecture/migration-path-inventory.json` classifies 30 paths with retirement disposition recommendations
- Legacy SQL files in `scripts/migration-*.sql` are classified as LEGACY_COMPATIBILITY
- Inspection scripts (`inspect-schema.*`, `verify-db.*`) are PROHIBITED_FOR_NEW_USE
- `docs/migration/POSTGRES_MIGRATION.md` is DEPRECATED

**Test layer**: SOURCE_STATIC

**What it proves**:
- Every legacy path is cataloged and classified
- Disposition recommendations are documented

**What it does not prove**:
- No legacy path has been physically retired, removed, or blocked from execution
- Legacy SQL files remain executable by operators
- No enforcement prevents new use of prohibited scripts

**Dependency**: Adoption baseline, canonical migration stream maturity
**Next action**: Deferred until canonical stream is established

---

## Artifact Ownership and Trust Classification

| Artifact | Path | Classification | Rationale |
| --- | --- | --- | --- |
| Canonical migration manifest | `db/migration-provenance/canonical-migrations.json` | CANONICAL_SOURCE_CONTRACT | Source-side manifest; currently inactive with empty migrations |
| Ledger contract | `db/migration-provenance/ledger-contract.json` | CANONICAL_SOURCE_CONTRACT | Defines immutable ledger record shape and rules |
| Expected-schema manifest | `db/migration-provenance/expected-schema-manifest.json` | CANONICAL_SOURCE_CONTRACT | Source-side manifest; currently inactive with empty critical_objects |
| Catalog metadata contract | `db/migration-provenance/catalog-metadata-contract.json` | CANONICAL_SOURCE_CONTRACT | Strict fingerprint normalizer contract |
| Adoption attestation contract | `db/migration-provenance/adoption-attestation-contract.json` | CANONICAL_SOURCE_CONTRACT | Strict attestation evidence contract |
| Adoption baseline collection plan contract | `db/migration-provenance/adoption-baseline-collection-plan-contract.json` | INACTIVE_ADOPTION_ARTIFACT | PREPARED_ONLY; grants no access or authority |
| Production-readonly catalog boundary contract | `db/migration-provenance/production-readonly-catalog-boundary-contract.json` | PRODUCTION_READONLY_CAPABLE_SOURCE | Source-only policy; not yet authorized for Production use |
| Migration path inventory | `docs/architecture/migration-path-inventory.json` | CANONICAL_SOURCE_CONTRACT | Classifies all schema-changing paths |
| Provenance gate architecture | `docs/architecture/DB_MIGRATION_PROVENANCE_GATE.md` | CANONICAL_SOURCE_CONTRACT | Architecture design document |
| Source checker | `scripts/check-migration-provenance.cjs` | CANONICAL_SOURCE_CONTRACT | Source-only gate implementation |
| Provenance core | `scripts/migration-provenance-core.cjs` | CANONICAL_SOURCE_CONTRACT | Core validation logic |
| Catalog fingerprint core | `scripts/migration-catalog-fingerprint-core.cjs` | CANONICAL_SOURCE_CONTRACT | Deterministic fingerprint normalizer |
| Disposable pg_catalog adapter | `scripts/migration-catalog-postgres-adapter-core.cjs` | DISPOSABLE_ONLY_EXECUTION | CI-only; loopback, `lovebud_ci_*`, version `170004` |
| Expected-schema candidate core | `scripts/expected-schema-candidate-core.cjs` | CANONICAL_SOURCE_CONTRACT | Candidate builder; never activates manifests |
| Adoption attestation core | `scripts/adoption-attestation-core.cjs` | CANONICAL_SOURCE_CONTRACT | Pure attestation evidence validator |
| Adoption baseline collection plan core | `scripts/adoption-baseline-collection-plan-core.cjs` | CANONICAL_SOURCE_CONTRACT | Plan contract validator |
| Production-readonly boundary core | `scripts/production-readonly-catalog-boundary-core.cjs` | PRODUCTION_READONLY_CAPABLE_SOURCE | Fail-closed boundary; grants no live collection authority |
| Production collection runner | `scripts/run-production-readonly-catalog-collection.cjs` | BLOCKED_OPERATOR_INPUT | Requires dedicated `LOVEBUD_PRODUCTION_READONLY_DATABASE_URL` |
| Build-from-postgres evidence scripts | `scripts/build-migration-catalog-evidence-from-postgres.cjs`, `scripts/build-production-readonly-catalog-evidence-from-postgres.cjs` | DISPOSABLE_ONLY_EXECUTION | Explicit CI-only connection constraints |
| Legacy migration SQL | `scripts/migration-*.sql` | HISTORICAL_LEGACY | Pre-ledger compatibility artifacts; classified in inventory |
| Repair/reconcile SQL | `scripts/migration-repair-*.sql`, `scripts/migration-reconcile-*.sql` | INCIDENT_ONLY | Incident-specific; not reusable migration history |
| Rollback artifacts | `scripts/rollback-*.sql` | INCIDENT_ONLY | Explicit rollback; not safe generic down migration |
| Legacy inspection scripts | `scripts/inspect-schema.*`, `scripts/verify-db.*` | PROHIBITED_FOR_NEW_USE | Direct connection without sanitized evidence envelope |
| Seed/fixture scripts | `scripts/seed-*` | HISTORICAL_LEGACY | Fixture-only; never schema reconstruction inputs |
| Pre/postcondition validators | `scripts/validate-generic-social-*.sql` | CANONICAL_SOURCE_CONTRACT | Read-only execution guards for specific migration paths |
| Migration directory | `db/migrations/` | CANONICAL_SOURCE_CONTRACT | Reserved; empty (only README.md) |
| DB engine tests | `tests/db-engine/*.test.cjs` | DISPOSABLE_ONLY_EXECUTION | Disposable PostgreSQL 17.4 CI tests |
| Adoption baseline collection runner | `scripts/build-adoption-baseline-collection-plan.cjs` | INACTIVE_ADOPTION_ARTIFACT | Produces PREPARED_ONLY plans; no target access |
| Phase B collection receipt | `scripts/phase-b-collection-receipt-core.cjs` | BLOCKED_OPERATOR_INPUT | Designed for Phase B catalog receipt; operator input required |

---

## Completed Child and PR Dependency Map

| Child Issue | PR | State | Title | Delivered | Manifest Status After |
| --- | --- | --- | --- | --- | --- |
| #3459 | PR #3474 | CLOSED / MERGED | Read-only provenance gate bootstrap | Gate infrastructure, inventory, source checker | `ADOPTION_REQUIRED`, empty |
| #3542 | PR #3543 | CLOSED / MERGED | Catalog fingerprint normalizer | Deterministic sanitized fingerprints | `ADOPTION_REQUIRED`, empty |
| #3544 | PR #3546 | CLOSED / MERGED | Disposable pg_catalog adapter | CI-only catalog metadata collection | `ADOPTION_REQUIRED`, empty |
| #3549 | PR #3550 | CLOSED / MERGED | Inactive expected-schema candidates | Candidate builder from evidence | `ADOPTION_REQUIRED`, empty |
| #3553 | PR #3554 | CLOSED / MERGED | Adoption attestation evidence | Strict attestation contract + validator | `ADOPTION_REQUIRED`, empty |
| #3555 | PR #3556 | CLOSED / MERGED | Adoption baseline collection plan | PREPARED_ONLY plan with allowlist | `ADOPTION_REQUIRED`, empty |
| #3569 | — | CLOSED | Production catalog collection | NOT COLLECTED (`COLLECTION_NOT_RUN_CONNECTION_BOUNDARY`) | No change |
| #3570 | PR #3571 | CLOSED / MERGED | Production-readonly boundary | Source-only boundary contract + core | No change |
| #3572 | — | CLOSED | Retry readiness audit | `NO_RETRY` | No change |

**Key observation**: All merged PRs are source-contract or disposable-CI work. No Production database has been accessed. No manifest has been activated. No migration has been applied.

---

## Test-Layer Map

### SOURCE_STATIC

**Current files/jobs**:
- `tests/contracts/migration-provenance-gate-contract.test.cjs`
- `tests/contracts/migration-catalog-fingerprint-contract.test.cjs`
- `tests/contracts/migration-catalog-postgres-adapter-contract.test.cjs`
- `tests/contracts/expected-schema-candidate-contract.test.cjs`
- `tests/contracts/adoption-attestation-contract.test.cjs`
- `tests/contracts/adoption-baseline-collection-plan-contract.test.cjs`
- `tests/contracts/production-readonly-catalog-boundary-contract.test.cjs`
- Run via `npm test` as part of default CI

**Proves**:
- Contract validation logic is correct (checksums, classifications, field validation)
- Fingerprint normalizer produces deterministic outputs
- Attestation validator rejects bare evidence and unbound attestations
- Production boundary validates URL, TLS, version, and allowlist policy without connecting

**Does not prove**:
- Any database-level behavior
- Any Production or target-environment compatibility
- That source-only gate output reflects any real environment state

**Remaining gap**: All source-static tests pass but none prove target-environment provenance

### POSTGRES_ENGINE_DISPOSABLE (DB_ENGINE_EXECUTION)

**Current files/jobs**:
- `tests/db-engine/migration-catalog-postgres-adapter-engine.test.cjs`
- `tests/db-engine/tree-comments-reconcile-postgres.test.cjs`
- `tests/db-engine/trees-schema-foothold-postgres.test.cjs`
- `tests/db-engine/generic-social-a-postgres.test.cjs`
- `tests/db-engine/generic-social-b-postgres.test.cjs`
- `tests/db-engine/generic-social-a-guard-postgres.test.cjs`
- `tests/db-engine/generic-social-b-guard-postgres.test.cjs`
- CI jobs: `db-engine-migration-catalog-adapter`, `db-engine-tree-comments`, `db-engine-trees-schema`, `db-engine-generic-social-*`

**Proves**:
- Disposable catalog adapter correctly reads `pg_catalog` from synthetic allowlisted objects on PostgreSQL 17.4
- Tree comments reconcile, trees schema foothold, and generic social migrations are validated in disposable environments

**Does not prove**:
- Disposable adapter is explicitly loopback-only, `lovebud_ci_*` database prefix only
- Disposable adapter cannot represent Production catalog state
- Version equivalence to Production (exact `170004` vs Production major-17 window `170000 <= version < 180000`) is not guaranteed

**Remaining gap**: No clean-database reconstruction test exists; no canonical migration is applied in disposable PostgreSQL

### TARGET_READONLY_INTEGRATION

**Current files/jobs**: None

**Proves**: Nothing — not implemented

**Remaining gap**: No target read-only adapter exists; no staging or Production catalog has been collected

### PRODUCTION_RUNTIME_EVIDENCE

**Current files/jobs**: None

**Proves**: Nothing — no Production collection has occurred

**Remaining gap**: Requires dedicated read-only credentials, abstract role mapping, and owner approval

### DEPLOYMENT_ENFORCEMENT

**Current files/jobs**: None

**Proves**: Nothing — not implemented

**Remaining gap**: No deployment gate integration exists; provenance check is manual `npm run` only

---

## Production and Operator-Input Boundary

The following items are blocked on operator input, not on repository implementation gaps:

| Blocker | What is needed | Repository state |
| --- | --- | --- |
| Dedicated read-only credentials | `LOVEBUD_PRODUCTION_READONLY_DATABASE_URL` under `.secrets/` | Contract defines the key; value does not exist in repository |
| Abstract role mapping | Mapping file for PostgreSQL roles → abstract classes (PUBLIC, APPLICATION, AUTHENTICATED, SERVICE, OWNER_CLASS) | Contract defines the classes; mapping file does not exist in repository |
| Owner review of collection plan | Approval of the reviewed object allowlist (9 tables) in `adoption-baseline-collection-plan-contract.json` | Plan is PREPARED_ONLY; not owner-reviewed |
| Adoption attestation approval | Owner decision to authorize Phase B collection and Phase D manifest activation | No attestation has been issued |
| Manifest activation | Owner decision to change `canonical-migrations.json` and `expected-schema-manifest.json` status from `ADOPTION_REQUIRED` to `ACTIVE` | Both manifests are `ADOPTION_REQUIRED` |

These are not repository bugs. They are gated decisions that the architecture correctly defers to separate approval.

---

## Remaining Gap Register

| ID | Gap | Classification | Dependency |
| --- | --- | --- | --- |
| G-01 | No migration runner implementation | NOT_STARTED | Ledger bootstrap, canonical migrations |
| G-02 | No canonical migration entries | NOT_STARTED | Adoption baseline, owner approval |
| G-03 | No ledger relation (DDL not executed) | NOT_STARTED | Ledger bootstrap migration |
| G-04 | No Production catalog evidence collected | BLOCKED_OPERATOR_INPUT | Dedicated credentials, role mapping |
| G-05 | No clean-database reconstruction | NOT_STARTED | G-01, G-02, G-03 |
| G-06 | No deployment preflight enforcement | NOT_STARTED | G-04, G-05 |
| G-07 | No target ledger evidence | BLOCKED_OPERATOR_INPUT | Target adapter, Production access |
| G-08 | No sanitized observability | NOT_STARTED | G-07 |
| G-09 | Legacy path retirement not executed | NOT_STARTED | Adoption baseline |
| G-10 | No destructive DDL rehearsal in CI | NOT_STARTED | G-01, G-02 |
| G-11 | Abstract role mapping file missing | BLOCKED_OPERATOR_INPUT | Owner review |
| G-12 | Owner review of adoption collection plan not performed | BLOCKED_OPERATOR_INPUT | Owner action |

---

## Stale or Contradictory Documentation

| Location | Issue | Recommendation |
| --- | --- | --- |
| `DB_MIGRATION_PROVENANCE_GATE.md` Section J, Child 1 | Describes "Ledger bootstrap" as a pending child, but multiple intermediate children (#3542-#3572) have been completed since | STALE_SUPERSEDED — Section J should be re-baselined with current status (this audit supersedes it for status tracking) |
| `docs/architecture/migration-path-inventory.json` | `baseline_sha` is `5d601154c...` which predates the current main baseline | Not a bug; inventory was created at that SHA. The entries remain valid at current main. |
| `DB_MIGRATION_PROVENANCE_GATE.md` line 3 | States "bootstrap implementation for Issue #3458" — this is accurate for the source-only gate but the broader #3458 implementation now spans 9 merged PRs | Should be updated to clarify source-only gate vs full provenance system |

---

## Claims That Current Evidence Does Not Support

The following claims would be unsupported by current evidence:

1. "The migration system is ready for Production" — No Production catalog has been collected; manifests are `ADOPTION_REQUIRED`; no adoption has occurred.
2. "Clean-database reconstruction works" — No reconstruction test exists; no migration runner exists.
3. "The deployment gate enforces schema provenance" — No deployment integration exists; no CI job runs target gate mode.
4. "An authoritative applied-migration history exists" — Ledger relation has not been created; no migration has been authoritatively recorded.
5. "Production schema is attested" — No attestation has been issued; collection plan is `PREPARED_ONLY`.
6. "Canonical migrations exist" — `canonical-migrations.json` has `migrations: []`; `db/migrations/` is empty.

---

## Current Fail-Closed State

### canonical-migrations.json
- **Status**: `ADOPTION_REQUIRED`
- **Migrations count**: 0 (empty array)
- **Interpretation**: No canonical migration has been approved. This is not a blank production schema claim.

### expected-schema-manifest.json
- **Status**: `ADOPTION_REQUIRED`
- **Critical objects count**: 0 (empty array)
- **Interpretation**: No sanitized catalog fingerprints have been committed. This is not a blank production schema claim.

### Production catalog collection
- **Run status**: `COLLECTION_NOT_RUN` (#3569 outcome)
- **Retry**: `NO_RETRY` (#3572 outcome)
- **Current boundary**: `FAIL_CLOSED` with `GATE_ADOPTION_BASELINE_REQUIRED`

### Production ledger
- **Authoritative evidence**: None exists
- **Ledger relation**: Not created (DDL deferred)
- **Applied migration records**: None

### Overall target provenance
- **Decision**: `FAIL_CLOSED`
- **Reason**: No adoption baseline has been attested. No Production catalog has been collected. Manifests are `ADOPTION_REQUIRED`. No ledger relation exists. The system correctly fails closed on all target gate inquiries.

The current fail-closed state is **correct and intended**. The architecture was designed to remain fail-closed until adoption is separately approved.

---

## Reproduction Commands

To reproduce the source-only provenance check:

```text
npm run check:migration-provenance
```

To run the test-layer classification:

```text
npm run test:layers
```

To run all provenance-related contract tests:

```text
npm test -- --test-name-pattern="migration|adoption|catalog|expected-schema|production-readonly"
```

---

## Final Audit Conclusion

The #3458 migration provenance architecture has made substantial progress in source-contract and disposable-CI layers. Seven of nine completed children delivered source-only validation, contract infrastructure, and CI-only disposable PostgreSQL verification.

The architecture correctly remains fail-closed on all target-environment questions. No Production database has been accessed. No manifest has been activated. No migration has been applied.

The primary remaining gap is not a repository implementation deficit but an operator-input boundary: dedicated read-only credentials, abstract role mapping, and owner review of the adoption collection plan are required before any Production catalog collection or attestation can proceed.

After that boundary is resolved, the next implementation children are: migration runner and ledger bootstrap migration (depend on the adoption baseline being attested), clean-database reconstruction, and deployment gate integration.

Refs #3620.
Refs #3458 — Keep #3458 OPEN.
Refs #3425 — Keep #3425 OPEN.
Refs #3435 — Keep #3435 OPEN.
Refs #3437 — Keep #3437 OPEN.
Refs #1882 — Keep #1882 OPEN.
