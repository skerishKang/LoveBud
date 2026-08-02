# LoveBud DB Migration Provenance Clean-Target Canonical Adoption Decision

## Decision summary

Current status: `CLEAN_TARGET_FIRST_SELECTED`

Issue #3840 completes Child 1 under Step 8 (environment adoption) for migration provenance (#3458).
The primary canonical adoption strategy selected for LoveBud is:

```text
Clean-target-first canonical adoption policy
```

Required decision markers:

```text
CLEAN_TARGET_FIRST_SELECTED

LEGACY_PRODUCTION_ADOPTION_DEFERRED

HISTORICAL_MIGRATION_FABRICATION_PROHIBITED

CANONICAL_STREAM_NOT_YET_CREATED

MANIFEST_ACTIVATION_NOT_AUTHORIZED

DATABASE_MUTATION_NOT_AUTHORIZED

RECOVERY_GATE_REQUIRED_BEFORE_TARGET_MUTATION

CANONICAL_BOOTSTRAP_DISPOSABLE_REHEARSAL_SELECTED
```

Key decision values:

```text
legacy Production adoption: DEFERRED_NOT_REJECTED

canonical stream state: NOT_YET_CREATED

manifest activation: NOT_AUTHORIZED

database mutation: NOT_AUTHORIZED
```

Parent issue #3458 remains open. This source-only decision grants no runtime, database, SQL, environment, provider, or Production authority.

---

## Strategic Context and Rationale

Previous architecture documentation provided a framework for adopting existing production databases (Phase B/C/D/E catalog collection and attestation). However, product owner disposition on Issue #3435 confirmed that legacy tree schema drift recovery is deferred as users create new LoveTrees and moments.

Attempting to force legacy Production DB adoption while schema drift recovery is deferred risks introducing unverified baseline assumptions or fabricating historical migration records for manual scripts that were never run through a canonical ledger.

To ensure fail-closed migration provenance without blocking operational progress, LoveBud selects a **clean target database environment** (a newly initialized PostgreSQL database) as its first canonical adoption target.

---

## Target Classes

LoveBud explicitly distinguishes three target classes:

### 1. `LEGACY_PRODUCTION_TARGET`
- Retains existing Phase B/C/D/E operator checklist framework and authority.
- Current execution status is `DEFERRED_NOT_AUTHORIZED`.
- Not deleted, completed, or marked obsolete.
- Requires separate evidence and explicit owner approval before any execution.

### 2. `CLEAN_CANONICAL_CANDIDATE`
- First canonical adoption candidate under #3458.
- Has no provider, project, branch, database, host, account, or environment binding yet.
- Not an active target yet (`canonical stream state: NOT_YET_CREATED`).
- Has zero database mutation authority (`database mutation: NOT_AUTHORIZED`).

### 3. `DISPOSABLE_POSTGRES_REHEARSAL_TARGET`
- Target for local and CI synthetic engine validation in Step 8 Child 2.
- Not a Production target.
- Uses no real credentials, secrets, or provider identifiers.
- Bounded strictly by disposable PostgreSQL 17.4 execution.

No real provider, project, branch, database, host, or account identifiers are authorized or recorded.

---

## Core Policy Declarations

### 1. `CLEAN_TARGET_FIRST_SELECTED`
A newly initialized PostgreSQL environment is selected as the primary canonical target for LoveBud migration provenance. Canonical migrations will construct the database schema starting from baseline bootstrap capability in Child 2.

### 2. `LEGACY_PRODUCTION_ADOPTION_DEFERRED`
Existing Production database adoption pathways (documented in `DB_MIGRATION_PROVENANCE_ADOPTION_OPERATOR_CHECKLIST.md` and related contracts) are retained as historical preparation frameworks. They are deferred (`DEFERRED_NOT_REJECTED`) and NOT deleted, closed, or executed by this decision. Any future adoption of an existing production database requires a separate owner approval event and evidence-backed schema identity verification.

### 3. `HISTORICAL_MIGRATION_FABRICATION_PROHIBITED`
Past manual SQL scripts, incident repairs, and pre-ledger runbooks listed in `migration-path-inventory.json` shall never be retroactively recorded as applied in the canonical ledger or canonical migration manifest. Applied migration records must represent actual execution by the canonical runner or an attested clean bootstrap.

Specific non-fabrication rules:
- Marking past scripts as applied without execution evidence is strictly prohibited.
- Generating fake applied timestamps is strictly prohibited.
- Generating fake operator identities is strictly prohibited.
- Generating fake environment records is strictly prohibited.
- Generating fake checksums is strictly prohibited.
- Treating an empty manifest as evidence of an empty live schema is strictly prohibited.
- Treating imported history as canonical execution history without externally attested vocabulary approval is strictly prohibited.
- Writing baseline ledger rows prior to clean bootstrap contract and rehearsal is strictly prohibited.

Any externally attested vocabulary requires a later separately reviewed child. No such attestation authority is created by #3840.

### 4. `CANONICAL_STREAM_NOT_YET_CREATED`
No canonical migration files or SQL definitions are created by Issue #3840. No exact migration timestamp, slug, filename, SQL body, ledger table name, or DDL sequence is pre-determined by Child 1.

Child 2 will define:
- one first canonical migration identity
- raw-byte SHA-256 checksum
- transaction mode
- risk class
- destructive-operation declaration
- ledger bootstrap ordering
- clean database reconstruction proof
- postcondition and expected-schema evidence boundary

### 5. `MANIFEST_ACTIVATION_NOT_AUTHORIZED`
All four committed migration provenance authority manifests (`canonical-migrations.json`, `expected-schema-manifest.json`, `precondition-registry.json`, `readonly-query-catalog.json`) remain in status `ADOPTION_REQUIRED` with empty collections (`[]` or `{}`). No status change to `ACTIVE` is authorized by this child.

### 6. `DATABASE_MUTATION_NOT_AUTHORIZED`
This child confers zero database connection, SQL execution, Docker/PostgreSQL container startup, provider configuration, secret inspection, or deployment pipeline mutation authority.

### 7. `RECOVERY_GATE_REQUIRED_BEFORE_TARGET_MUTATION`
Issue #3460 implementation waits until #3458 completion. Child 1 and Child 2 source and disposable work do not require live backup infrastructure. Any later real target mutation requires a valid pre-change recovery gate, a separately authorized target, and separate owner approval. Issue #3840 creates no backup, snapshot, restore, credential, or provider authority.

---

## Selected Next Child

Child 2 under Step 8 is selected as the next child:

```text
CANONICAL_BOOTSTRAP_DISPOSABLE_REHEARSAL_SELECTED
```

| Field | Setting |
|---|---|
| Selected Next Child | Canonical bootstrap migration & disposable PostgreSQL rehearsal |
| Step 8 Sub-Child | Child 2 |
| Step 8 Child 1 Status | Implemented by #3840 |
| Child 2 Scope | Define baseline canonical migration identity and test canonical runner against disposable PostgreSQL 17.4 |
| Database / Network Access | Disposable PostgreSQL 17.4 loopback container only in Child 2 |
| Production / Secrets Access | None |

---

## Exact Child 1 Source Boundary

```text
A docs/architecture/DB_MIGRATION_PROVENANCE_CLEAN_TARGET_ADOPTION_DECISION.md
A tests/contracts/db-migration-clean-target-adoption-decision-contract.test.cjs
M docs/architecture/DB_MIGRATION_PROVENANCE_NEXT_CHILD_DECISION.md
M docs/architecture/DB_MIGRATION_PROVENANCE_ADOPTION_OPERATOR_CHECKLIST.md
M tests/test-layer-classification.json
```

No sixth file is authorized.

---

## Prohibited Actions and Non-Goals

Issue #3840 does not:

- Create any SQL migration files;
- Pre-determine exact migration filenames, timestamps, slugs, DDL statements, or ledger table names;
- Modify `canonical-migrations.json`, `expected-schema-manifest.json`, `precondition-registry.json`, or `readonly-query-catalog.json`;
- Change any manifest status from `ADOPTION_REQUIRED` to `ACTIVE`;
- Connect to any database, network, Docker container, or PostgreSQL instance;
- Inspect or alter provider secrets, credentials, endpoints, or environment variables;
- Modify GitHub Actions CI workflows or deployment pipelines;
- Initiate or implement Issue #3460 (backup/recovery implementation);
- Close Issue #3458 or Issue #3840.

---

## Protected Issue Posture

Issue #3425 is a completed parent (`Refs #3425 — completed architecture-quality parent.`).

Active open issues maintained by this decision:

```text
Keep #3458 OPEN
Keep #3435 OPEN
Keep #3460 OPEN
Keep #3461 OPEN
Keep #1882 OPEN
```

---

## References

- Refs #3840.
- Refs #3839 — completed Step 8 readiness audit.
- Refs #3816 — completed Step 7 disposable PostgreSQL rehearsal.
- Refs #3657 — completed precondition authority program.
- Refs #3458 — Keep OPEN.
- Refs #3435 — Keep OPEN (deferred schema recovery).
- Refs #3460 — Keep OPEN.
- Refs #3461 — Keep OPEN.
- Refs #1882 — Keep OPEN.
- Refs #3425 — completed architecture-quality parent.
