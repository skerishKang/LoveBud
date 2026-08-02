# LoveBud DB Migration Provenance Clean-Target Canonical Adoption Decision

## Decision summary

Current status: `CLEAN_TARGET_FIRST_SELECTED`

Issue #3840 completes Child 1 under Step 8 (environment adoption) for migration provenance (#3458).
The primary canonical adoption strategy selected for LoveBud is:

```text
Clean-target-first canonical adoption policy
```

Sequence posture:

```text
Steps 1–7 complete
Step 8 Child 1 clean-target adoption policy selected and implemented by #3840
Step 8 Child 2 canonical bootstrap migration & disposable rehearsal selected for next child
Legacy Production DB adoption deferred (not deleted/closed; preserved for future explicit approval)
Historical migration record fabrication strictly prohibited
Four migration provenance manifests remain ADOPTION_REQUIRED and empty
Zero database, provider, network, secret, or deployment mutation authorized
```

Parent issue #3458 remains open. This source-only decision grants no runtime, database, SQL, environment, provider, or Production authority.

---

## Strategic Context and Rationale

Previous architecture documentation provided a framework for adopting existing production databases (Phase B/C/D/E catalog collection and attestation). However, product owner disposition on Issue #3435 confirmed that legacy tree schema drift recovery is deferred as users create new LoveTrees and moments.

Attempting to force legacy Production DB adoption while schema drift recovery is deferred risks introducing unverified baseline assumptions or fabricating historical migration records for manual scripts that were never run through a canonical ledger.

To ensure fail-closed migration provenance without blocking operational progress, LoveBud selects a **clean target database environment** (a newly initialized PostgreSQL database) as its first canonical adoption target.

---

## Core Policy Declarations

### 1. `CLEAN_TARGET_FIRST_SELECTED`
A newly initialized PostgreSQL environment is selected as the first canonical target for LoveBud migration provenance. Canonical migrations will construct the database schema from step 0 (starting with a canonical bootstrap migration in Child 2).

### 2. `LEGACY_PRODUCTION_ADOPTION_DEFERRED`
Existing Production database adoption pathways (documented in `DB_MIGRATION_PROVENANCE_ADOPTION_OPERATOR_CHECKLIST.md` and related contracts) are retained as historical preparation frameworks. They are **deferred** and NOT deleted, closed, or executed by this decision. Any future adoption of an existing production database requires a separate owner approval event and evidence-backed schema identity verification.

### 3. `HISTORICAL_MIGRATION_FABRICATION_PROHIBITED`
Past manual SQL scripts, incident repairs, and pre-ledger runbooks listed in `migration-path-inventory.json` shall **never** be retroactively recorded as applied in the canonical ledger or canonical migration manifest. Applied migration records must represent actual execution by the canonical runner or an attested clean bootstrap.

### 4. `CANONICAL_STREAM_NOT_YET_CREATED`
No canonical migration SQL files or bootstrap definitions are created by Issue #3840. The first canonical migration file (creating `schema_migration_ledger` and baseline schema) will be introduced in Child 2.

### 5. `MANIFEST_ACTIVATION_NOT_AUTHORIZED`
All four committed migration provenance authority manifests (`canonical-migrations.json`, `expected-schema-manifest.json`, `precondition-registry.json`, `readonly-query-catalog.json`) remain in status `ADOPTION_REQUIRED` with empty collections (`[]` or `{}`). No status change to `ACTIVE` is authorized by this child.

### 6. `DATABASE_MUTATION_NOT_AUTHORIZED`
This child confers zero database connection, SQL execution, Docker/PostgreSQL container startup, provider configuration, secret inspection, or deployment pipeline mutation authority.

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
| Child 2 Scope | Add `db/migrations/20260802000000_bootstrap_ledger.sql`, test canonical runner against disposable PostgreSQL 17.4 |
| Database / Network Access | Disposable PostgreSQL 17.4 loopback container only in Child 2 |
| Production / Secrets Access | None |

---

## Prohibited Actions and Non-Goals

Issue #3840 does not:

- Create any `*.sql` migration files or bootstrap scripts;
- Modify `canonical-migrations.json`, `expected-schema-manifest.json`, `precondition-registry.json`, or `readonly-query-catalog.json`;
- Change any manifest status from `ADOPTION_REQUIRED` to `ACTIVE`;
- Connect to any database, network, Docker container, or PostgreSQL instance;
- Inspect or alter provider secrets, credentials, endpoints, or environment variables;
- Modify GitHub Actions CI workflows or deployment pipelines;
- Initiate or implement Issue #3460 (backup/recovery implementation);
- Close Issue #3458 or Issue #3840.

---

## Protected Issue Posture

```text
Keep #3458 OPEN
Keep #3425 OPEN
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
- Refs #3425 — Keep OPEN.
- Refs #3435 — Keep OPEN (deferred schema recovery).
- Refs #3460 — Keep OPEN.
- Refs #3461 — Keep OPEN.
- Refs #1882 — Keep OPEN.
