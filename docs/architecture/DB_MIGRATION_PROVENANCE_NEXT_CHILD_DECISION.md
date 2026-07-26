# LoveBud DB Migration Provenance Next-Child Decision

## Decision summary

Status: `SAFE_IMPLEMENTATION_CHILD_SELECTED`

Issue #3669 completes the third source-static precondition-authority step. The current and only selected next child is:

```text
Step 4 — precondition registry/catalog loader-resolver
```

The previous pinned-session query-broker selection is `SUPERSEDED` and has no current implementation authority.

Audit continuity:

```text
Audit issue: #3644
Audit baseline SHA: eb030c1d4751dfee45d65f5a420caebebac6ebcc
```

## Why the previous decision changed

The source-tested pinned-session query broker was an earlier repository gap and was subsequently implemented. The canonical precondition sequence has since advanced through the authority contract, registry validator/source-validation integration, and fixed read-only query catalog contract.

The next decision must therefore move forward to deterministic loading and resolution of the two fixed repository authorities rather than select or reselect a runtime broker.

## Verified current incompatibility

The current precondition registry and the newly fixed catalog are separate repository authorities. No selected child currently loads both, validates both, resolves a stable `query_reference`, and returns a detached authority-owned projection.

That is the exact current gap. It does not authorize runtime query execution.

## Selected next child

### Current selection

| Field | Current decision |
|---|---|
| Selected child | Precondition registry/catalog loader-resolver |
| Sequence step | 4 |
| Runtime adapter selected | No |
| `evaluatePrecondition` selected | No |
| `queryLockedSession` call selected | No |
| Database connection selected | No |
| SQL execution selected | No |
| Production adoption selected | No |

This decision does not select a runtime adapter.

The selected child may define deterministic loading, source validation, authority-preserving projection, and resolution between:

```text
db/migration-provenance/precondition-registry.json
db/migration-provenance/readonly-query-catalog.json
```

Its exact files and runtime-neutral interface require a separate Web CTO contract.

### Superseded historical record

The following literal markers are retained only so the #3644 current-state audit contract can identify the previously selected child. They are not a current selection and confer no implementation authority:

```text
Selected child | Source-tested pinned-session query broker
POSTGRES_LOCKED_SESSION_QUERY_UNAVAILABLE
```

The historical broker file set was:

```text
scripts/migration-postgres-session-lock-adapter-core.cjs
tests/contracts/db-postgres-session-lock-adapter-contract.test.cjs
docs/architecture/db-postgres-session-lock-adapter-contract.md
docs/architecture/db-postgres-ledger-adapter-contract.md
```

Those paths are not allowed changes for Issue #3669.

## Exact allowed files

The cumulative changed-file boundary for Issue #3669 is exactly:

```text
db/migration-provenance/readonly-query-catalog.json
docs/architecture/db-migration-readonly-query-catalog-contract.md
tests/contracts/db-migration-readonly-query-catalog-contract.test.cjs
tests/test-layer-classification.json
docs/architecture/DB_MIGRATION_PROVENANCE_NEXT_CHILD_DECISION.md
```

## Prohibited files and areas

Issue #3669 must not change:

```text
package.json
package-lock.json
.github/**
scripts/**
functions/**
db/migration-provenance/precondition-registry.json
db/migration-provenance/canonical-migrations.json
db/migration-provenance/expected-schema-manifest.json
product, API, UI, Auth, CSS, and Cloudflare files
```

The broader historical pattern `db/migration-provenance/**` remains protected except for the one exact new file explicitly allowed above.

secrets, environment configuration, provider configuration, credentials, endpoints, and operator identity are prohibited.

## Explicit non-goals

This decision does not select or implement:

- a runtime adapter;
- `evaluatePrecondition`;
- a pinned-session broker call;
- `queryLockedSession` invocation;
- a database connection;
- SQL execution;
- Docker or PostgreSQL execution;
- runtime composition;
- catalog activation;
- Production or staging access;
- secret inspection;
- environment/provider modification.

## Acceptance criteria

Issue #3669 is accepted only when:

1. the fixed catalog exists with exact inactive JSON;
2. the normative catalog contract defines authority separation and future ACTIVE schema;
3. the source-static contract verifies the required boundary;
4. the classification registry contains the new test exactly once as `SOURCE_STATIC`;
5. this decision records Steps 1–3 complete and Step 4 as the only next child;
6. the cumulative diff contains exactly five allowed files;
7. all required checks and CI are green.

## Verification requirements

Required verification includes:

```text
node --check tests/contracts/db-migration-readonly-query-catalog-contract.test.cjs
focused node --test contract set
npm run check:migration-provenance
git diff --check
npm run lint
npm run build
npm run verify
npm test
```

Failures must remain visible. No timeout increase, retry, sleep, skip, assertion weakening, or failure reclassification is allowed.

## Rollback and forward-fix posture

Rollback is repository-only: revert Issue #3669's five-file change as one unit.

No database rollback, SQL rollback, credential rotation, provider action, environment action, or Production action is required because none is performed.

A later defect must be handled by an additive forward-fix child. No rebase, reset, amend, force push, or history rewrite is authorized.

## Completion boundary

Issue #3669 completes only the fixed read-only query catalog source-static authority.

It does not complete Step 4, a runtime adapter, database integration, SQL execution, disposable PostgreSQL rehearsal, or environment adoption. It does not authorize Ready conversion, merge, or Issue closure by the Web Developer.

## Work that remains after the selected child

The canonical sequence is:

1. Precondition authority contract — completed by PR #3658.
2. Registry validator and source-validation integration — completed by PR #3660 / Issue #3659.
3. Fixed read-only query catalog contract — completed by Issue #3669.
4. Precondition registry/catalog loader-resolver — selected as the only next child.
5. `evaluatePrecondition` adapter — future child, not selected.
6. Composition root — future child, not selected.
7. Disposable PostgreSQL rehearsal — future child, not selected.
8. Separately approved environment adoption — future child, not selected.

Steps 5–8 are not selected by this decision.

Step 4 must not skip directly to Steps 5–8.

This decision does not claim those later children are approved or ready.

## Precondition authority child (#3657)

### Current non-runtime boundary

- The `evaluatePrecondition` adapter is **not** implemented.
- No SQL query, adapter, DB connection, or registry entry is added by Issue #3669.
- No Production mutation occurs.

Authority constraints carried forward:

- Registry authority owns `migration_id`, `check_id`, `query_reference`, and `expected`.
- Catalog authority owns the fixed query object and raw result contract.
- No adapter, manifest, environment variable, caller argument, alternate file, path, URL, credential, operator identity, hostname, or dynamic input may override or supplement either authority.
- The committed catalog remains `ADOPTION_REQUIRED` with an empty `queries` plain object.

Issue #3657 remains open as the canonical migration precondition authority parent.

## Decision completion statement

Current authority outcome:

```text
SAFE_IMPLEMENTATION_CHILD_SELECTED
CURRENT: Step 4 precondition registry/catalog loader-resolver
SUPERSEDED: source-tested pinned-session query broker
```

| Capability | Issue #3669 action |
|---|---|
| Production access | None |
| Database access | None |
| SQL execution | None |
| Docker/PostgreSQL execution | None |
| Secret inspection | None |
| Environment/provider modification | None |

No database connection was opened, no SQL was executed, and no Production or provider environment was accessed.

Protected issue posture:

```text
Keep #3458 OPEN
Keep #3425 OPEN
Keep #3435 OPEN
Keep #3437 OPEN
Keep #1882 OPEN
Keep #3657 OPEN
```

References:

- Refs #3669
- Refs #3657
- Refs #3659 — completed
- Refs #3660 — merged
- Refs #3658 — completed
- Refs #3652
- Refs #3650
- Refs #3646
- Refs #3644
- Refs #3458 — Keep OPEN
- Refs #3425 — Keep OPEN
- Refs #3435 — Keep OPEN
- Refs #3437 — Keep OPEN
- Refs #1882 — Keep OPEN
