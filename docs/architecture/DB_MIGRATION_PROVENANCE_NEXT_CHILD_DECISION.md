# LoveBud DB Migration Provenance Next-Child Decision

## Decision summary

Current status: `SAFE_IMPLEMENTATION_CHILD_SELECTED`

Issue #3809 completes Step 6 in the migration-precondition authority sequence. The current and only selected next child is:

```text
Step 7 — disposable PostgreSQL rehearsal
```

Current sequence posture:

```text
Steps 1–6 complete
Step 7 disposable PostgreSQL rehearsal selected but not implemented
Step 8 environment adoption not authorized
```

Issue #3657 remains the open parent authority. This source-only decision grants no runtime, database, SQL, environment, provider, or Production authority.

The historical audit baseline for Issue #3644 remains recorded as `eb030c1d4751dfee45d65f5a420caebebac6ebcc`. That SHA is historical evidence only and is not the implementation base for Issue #3678.

## Why the previous decision changed

The previous decision was written before completion of the evaluatePrecondition adapter and before implementation of the composition root. Issue #3802 completed Step 5, and Issue #3809 now completes Step 6 by adding the fail-closed composition root that wires the fixed authority resolver, the pinned-session lock adapter, and the evaluator into the frozen orchestrator-facing dependency surface.

Because Step 6 is now complete, the prior statement that Step 6 was the selected child is superseded. The ordered sequence advances by exactly one step: Step 7 (disposable PostgreSQL rehearsal) is selected for a separate future child, but it is not implemented here.

## Verified current incompatibility

The repository now has a fixed authority contract, registry validation, readonly query catalog, loader-resolver, evaluatePrecondition adapter, and the composition root. It still has no authorized disposable PostgreSQL rehearsal that executes the composed dependency surface against an ephemeral engine.

That missing rehearsal is the next incompatibility. It does not authorize skipping to environment adoption.

## Selected next child

### Current selection

| Field | Current decision |
|---|---|
| Selected child | Disposable PostgreSQL rehearsal |
| Sequence step | 7 |
| Steps 1–6 | Complete |
| Step 7 implementation in this child | No |
| Step 8 | Not authorized |
| Composition root selected | Yes (completed by Issue #3809) |
| Disposable PostgreSQL rehearsal selected | Yes (selected, not implemented) |
| Environment adoption selected | No |
| Production access | None |
| Database access | None |
| SQL execution | None |

The Step 7 child requires a separate exact Web CTO execution contract. This document selects Step 7 only; it does not implement it.

### Superseded historical selection retained for audit compatibility

The following historical Issue #3644 markers are retained literally as evidence only. They confer no current implementation authority:

```text
Selected child | Source-tested pinned-session query broker
POSTGRES_LOCKED_SESSION_QUERY_UNAVAILABLE
```

The prior historical file set was:

```text
scripts/migration-postgres-session-lock-adapter-core.cjs
tests/contracts/db-postgres-session-lock-adapter-contract.test.cjs
docs/architecture/db-postgres-session-lock-adapter-contract.md
docs/architecture/db-postgres-ledger-adapter-contract.md
```

Those paths are not changed by Issue #3678.

For exact #3644 source-only compatibility, this decision does not claim those later children are approved or ready. The `evaluatePrecondition` adapter is **not** implemented. No SQL query, adapter, DB connection, or registry entry is added. No Production mutation occurs.

The superseded Issue #3669 decision also stated:

```text
4. Precondition registry/catalog loader-resolver — selected as the only next child
```

That prior decision does not select a runtime adapter. It stated that Step 4 must not skip directly to Steps 5–8 and that Steps 5–8 are not selected by this decision. Those sentences remain historical evidence of the Step 3 posture. Issue #3678 now completes Step 4, selects Step 5 only, and keeps Steps 6–8 unauthorized.

Issue #3678 recorded the sequence posture as Steps 1–4 complete, Step 5 (evaluatePrecondition adapter) selected but not implemented, and Steps 6–8 not authorized. That posture is superseded by Issue #3802, which implements Step 5 and selects Step 6 (composition root) without implementing it. The historical Step-4-era wording is retained only as audit evidence.

Issue #3802 recorded the sequence posture as Steps 1–5 complete, Step 6 (composition root) selected but not implemented, and Steps 7–8 not authorized. That posture is superseded by Issue #3809, which implements Step 6 and selects Step 7 (disposable PostgreSQL rehearsal) without implementing it. The historical Step-5-era wording is retained only as audit evidence.

## Exact allowed files

Issue #3678 changes exactly:

```text
scripts/migration-precondition-authority-loader-resolver-core.cjs
tests/contracts/db-migration-precondition-authority-loader-resolver-contract.test.cjs
docs/architecture/db-migration-precondition-authority-loader-resolver-contract.md
tests/test-layer-classification.json
docs/architecture/DB_MIGRATION_PROVENANCE_NEXT_CHILD_DECISION.md
docs/architecture/db-schema-change-inventory.json
```

No other path is authorized. The sixth file is limited to one source-only inventory entry for the loader-resolver core under the bounded Web CTO amendment recorded on Issue #3678 and PR #3681.

## Prohibited files and areas

Issue #3678 does not modify:

- `package.json`, package lockfiles, or dependency declarations;
- `.github/**` workflows or CI policy;
- either committed registry/catalog authority under `db/migration-provenance/**`;
- existing registry validator, source-validation adapter, protocol, orchestrator, composition root, manifest adapter, lock adapter, ledger adapter, or broker;
- product, API, UI, Auth, CSS, and Cloudflare files;
- provider configuration, secrets, environment configuration, credentials, or endpoints;
- PR #3676 or PR #3677 branches/files.

## Explicit non-goals

Issue #3678 does not select or implement:

- Step 5 code or runtime `evaluatePrecondition` behavior;
- `queryLockedSession` invocation;
- lock-handle inspection;
- SQL execution, preparation, interpolation, tokenization, or safety approval;
- a database connection;
- Docker or PostgreSQL execution;
- composition-root integration;
- manifest, lock, ledger, or broker changes;
- registry or catalog activation;
- Production or staging access;
- provider, environment, credential, or secret access.

The committed catalog remains `ADOPTION_REQUIRED` with an empty `queries` plain object.

## Precondition authority child (#3657)

### Completed authority sequence

1. Precondition authority contract — completed by PR #3658.
2. Registry validator and source-validation integration — completed by PR #3660 / Issue #3659.
3. Fixed read-only query catalog contract — completed by PR #3675 / Issue #3669.
4. Fixed precondition registry/catalog loader-resolver — completed by Issue #3678.
5. Fail-closed `evaluatePrecondition` adapter — completed by Issue #3802.
6. Composition root (orchestrator-facing dependency surface) — completed by Issue #3809 (this child).

### Selected but not implemented

7. Disposable PostgreSQL rehearsal — selected as the only next child; not implemented by Issue #3809.

### Not authorized

8. Separately approved environment adoption — not authorized.

Steps 1–6 complete. Step 7 disposable PostgreSQL rehearsal selected but not implemented. Step 8 not authorized.

## Acceptance criteria

Issue #3678 is complete only when:

1. the exact six-file boundary is preserved;
2. the fixed registry loads by module-relative fixed path with lexical and realpath confinement;
3. current inactive authority returns `ADOPTION_REQUIRED` without loading or inspecting the catalog;
4. ACTIVE synthetic authority joins registry checks to catalog queries deterministically;
5. malformed, hostile, mismatched, or unavailable authority maps to `UNAVAILABLE`;
6. absent target or empty checks in otherwise safe ACTIVE authority maps to `NOT_FOUND`;
7. resolved checks preserve registry order and are detached and recursively frozen;
8. no SQL, broker, lock handle, DB, network, Docker/PostgreSQL, Production, provider, or secret action occurs;
9. focused checks and GitHub Actions Node 20 CI are green;
10. an independent Local Validator checks the exact PR head before merge.

## Verification requirements

Required source verification remains:

```text
node --check scripts/migration-precondition-authority-loader-resolver-core.cjs
node --check tests/contracts/db-migration-precondition-authority-loader-resolver-contract.test.cjs
node --test \
  tests/contracts/db-migration-precondition-authority-loader-resolver-contract.test.cjs \
  tests/contracts/db-migration-precondition-authority-contract.test.cjs \
  tests/contracts/db-migration-precondition-registry-source-validation-contract.test.cjs \
  tests/contracts/db-migration-readonly-query-catalog-contract.test.cjs \
  tests/contracts/test-layer-classification-contract.test.cjs
npm run check:migration-provenance
npm run lint
npm run build
git diff --check
```

Node 20 GitHub Actions CI remains the merge gate. Local Node 22 evidence cannot replace Node 20 CI.

## Rollback and forward-fix posture

Rollback is repository-only: revert the Issue #3678 implementation PR. No runtime state, database state, provider state, or Production state is created.

Any deterministic defect found before merge must be corrected by an additive commit. Rebase, reset, amend, force push, history rewrite, assertion weakening, retry increase, sleep, timeout increase, or test skip is not authorized.

## Completion boundary

Issue #3678 ends at the fixed source loader/resolver and selection of Step 5. It does not cross into evaluation, broker execution, lock handling, database access, SQL execution, PostgreSQL rehearsal, environment adoption, or Production evidence.

No database connection was opened, no SQL was executed, no Docker/PostgreSQL action occurred, and no Production or provider environment was accessed.

The PR must remain Draft. Issue #3678 and parent #3657 remain open until an authorized reviewer completes the required gates.

## Work that remains after the selected child

After a separately approved Step 5 child is complete, Steps 6–8 still require independent authority and evidence. Selection of Step 5 does not pre-authorize composition, disposable PostgreSQL rehearsal, or environment adoption.

## Decision completion statement

The migration-precondition authority sequence is now recorded as Steps 1–6 complete, Step 7 (disposable PostgreSQL rehearsal) selected but not implemented, and Step 8 (environment adoption) not authorized. Historical Issue #3644, Issue #3669, Issue #3678-era, and Issue #3802-era markers are retained only to preserve existing audit evidence.

## Protected issue posture

```text
Keep #3657 OPEN
Keep #3458 OPEN
Keep #3425 OPEN
Keep #3435 OPEN
Keep #3437 OPEN
Keep #1882 OPEN
```

## References

- Refs #3809.
- Refs #3802 — completed Step 5.
- Refs #3678 — completed Step 4.
- Refs #3669 — completed Step 3.
- Refs #3659 — completed Step 2.
- Refs #3657 — Keep OPEN.
- Refs #3644.
- Refs #3458 — Keep OPEN.
- Refs #3425 — Keep OPEN.
- Refs #3435 — Keep OPEN.
- Refs #3437 — Keep OPEN.
- Refs #1882 — Keep OPEN.
