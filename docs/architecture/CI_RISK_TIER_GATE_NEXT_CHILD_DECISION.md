# LoveBud CI Risk-Tier Gate Next-Child Decision

## Decision summary

| Field | Decision |
| --- | --- |
| Parent | `#3670` |
| Audit child | `#3671` |
| Exact baseline | `4beada4c8134afbdb791e98466db9ec1162f0a27` |
| Selected next child | **Machine-readable test-group registry and deterministic classification reporter** |
| Selection count | Exactly one |
| Generic risk tier | Tier 2 |
| UI class | NOT_APPLICABLE |
| Execution effect | Repository-source-only |
| Workflow effect | None authorized |
| Package-script effect | None authorized |
| Test-behavior effect | None authorized |

## Exact goal

Create one machine-readable authority that groups existing LoveBud tests and verification commands into deterministic execution products without changing when or how current CI executes them.

The child must:

1. preserve `tests/test-layer-classification.json` as the evidence-layer authority;
2. add a separate test-group registry for execution purpose, command, capability, runtime, platform, and comparison metadata;
3. add a deterministic source-only reporter that validates the registry against exact package scripts, test discovery, existing layer entries, supplemental paths, and known workflow commands;
4. emit stable human-readable and JSON summaries suitable for later branch/main comparison and risk-tier gate wiring;
5. fail closed on unclassified, duplicate, stale, overlapping, unsupported, or contradictory group membership;
6. correct only the currently confirmed supplemental classification defects needed to make the existing layer reporter internally consistent;
7. execute no tests, browsers, network calls, providers, Docker, PostgreSQL, database connections, or Production actions.

The child does **not** implement risk-tiered workflow partitioning. It creates the source authority required before that workflow-affecting decision.

## Why this child is first

The current repository has evidence-layer vocabulary but no machine-readable execution-group authority. The workflow cannot safely select Tier 1/2/3 gates until it can answer, deterministically:

- which paths belong to source-static, fake/unit-like, browser-local, DB-engine, manual remote/provider, and full-regression products;
- which command executes each group;
- which platform/runtime/capabilities each group requires;
- whether a path is default PR, supplemental, manual, or unavailable;
- whether branch and main results are comparable under identical conditions.

Selecting workflow partitioning first would encode human assumptions directly into CI before the underlying membership and comparison contracts are machine-verifiable.

## Risk tier

```text
Generic tier: Tier 2
UI class: NOT_APPLICABLE
Reason: repository-wide classification/reporting authority can affect later merge evidence, but this child changes no package command, workflow, test assertion, runtime, provider, database, or Production behavior.
Local Validation: NOT_REQUIRED unless source access is insufficient.
```

## Allowed files

The next child may change exactly these files:

1. `tests/ci-test-group-registry.json` — new machine-readable execution-group authority.
2. `scripts/report-ci-test-groups.cjs` — new deterministic source-only reporter.
3. `tests/contracts/ci-test-group-registry-contract.test.cjs` — focused contract for schema, reconciliation, and fail-closed behavior.
4. `docs/architecture/CI_TEST_GROUP_REGISTRY_CONTRACT.md` — normative source contract.
5. `tests/test-layer-classification.json` — bounded changes only:
   - classify the new contract test;
   - remove the two confirmed default-CI paths from the supplemental list where they conflict with reporter rules;
   - no reclassification of existing test evidence layers without separate proof.

No other path is allowed.

## Prohibited files and actions

### Files

- `package.json`
- `package-lock.json`
- `.github/workflows/**`
- any existing test file other than `tests/test-layer-classification.json`
- any runtime source under `js/**`, `functions/**`, `modal_compute/**`, or product routes
- any DB, migration, SQL, provider, Cloudflare, Modal, Neon, environment, or secret file
- the `#3669` branch or its five-file scope

### Behavior

- no test execution orchestration changes;
- no test deletion, skip, quarantine, timeout change, retry, sleep, or assertion weakening;
- no path-filter or risk-tier workflow wiring;
- no branch-protection changes;
- no browser launch;
- no network/provider access;
- no DB connection, SQL, Docker, or PostgreSQL execution;
- no Production or staging access;
- no flaky label or non-determinism classification without repeated evidence.

## Source-only or workflow-affecting

```text
SOURCE_ONLY
```

The reporter may read repository files and print deterministic summaries. It must not invoke `node --test`, npm scripts, shells, child processes, browsers, network clients, database clients, or workflows.

A later child must separately approve package/workflow integration.

## Registry minimum contract

The new registry must define an exact versioned schema with stable ordered groups. At minimum it must distinguish:

```text
SOURCE_STATIC
EXECUTED_FAKE
BROWSER_REAL_LOCAL
PROCESS_REAL_LOCAL
DB_ENGINE
PYTHON_SUPPLEMENTAL
REMOTE_OR_PROVIDER_MANUAL
FULL_DEFAULT_REGRESSION
```

Each group record must include exact bounded fields for:

- group ID;
- purpose;
- membership source or explicit paths;
- command reference;
- default PR execution state;
- required runtime;
- supported/observed platform;
- required capabilities;
- branch/main comparability prerequisites;
- artifact expectation;
- risk-gate eligibility;
- source status: `CONFIRMED`, `UNVERIFIED`, or `NOT_PRESENT` where applicable.

The registry must reference, not duplicate or replace, evidence-layer rationale authority.

## Reporter minimum contract

`report-ci-test-groups.cjs` must:

1. read `package.json`, `tests/test-layer-classification.json`, and `tests/ci-test-group-registry.json` from fixed repository-relative paths;
2. parse the exact default `node --test` glob command with fail-closed grammar equivalent to the current layer reporter;
3. enumerate default-CI files deterministically;
4. validate every default and supplemental path against exactly one appropriate execution group;
5. reject duplicate, stale, overlapping, default/supplemental-conflicting, or unsupported memberships;
6. validate the current seven DB-engine package commands and the `verify-static` command set without editing workflows;
7. emit deterministic vocabulary order and stable path order;
8. support a machine-readable JSON output mode and a human-readable summary mode;
9. include exact command/runtime/platform/capability metadata, but no credentials, URLs containing private data, cookies, payloads, row data, or raw logs;
10. return non-zero on registry or reconciliation failure;
11. execute no registered command.

## Acceptance criteria

1. The exact baseline package test globs reconcile with 764 default-CI paths.
2. Current evidence-layer counts remain 563 `SOURCE_STATIC`, 187 `EXECUTED_FAKE`, and 14 `EXECUTED_REAL_LOCAL` unless an independently proven baseline correction is included.
3. Seven DB-engine tests remain supplemental and map to seven existing package commands.
4. Ten Python supplemental paths remain visible as not executed by the active package/workflow topology.
5. The two confirmed invalid/in-default supplemental duplicates are removed through the bounded classification JSON correction.
6. Every default-CI and supplemental path has exactly one execution-group disposition.
7. Browser-real-local paths are distinguishable from other real-local process/filesystem paths without changing their existing evidence layer.
8. Manual remote/provider scripts are recorded as non-default and are not executed.
9. Full default regression is represented as an aggregate group over the exact package globs, not as a duplicate path authority.
10. Reporter output is byte-stable for identical repository content.
11. Unknown group, path, command, capability, runtime, platform, or artifact enum values fail closed.
12. No package, lockfile, workflow, runtime, test assertion, DB, provider, or Production behavior changes.
13. The focused contract and existing layer-classification contract pass.

## Verification

Required source-only verification:

```text
node --check scripts/report-ci-test-groups.cjs
node --check tests/contracts/ci-test-group-registry-contract.test.cjs
node --test \
  tests/contracts/ci-test-group-registry-contract.test.cjs \
  tests/contracts/test-layer-classification-contract.test.cjs
node scripts/report-test-layers.cjs
node scripts/report-ci-test-groups.cjs
node scripts/report-ci-test-groups.cjs --json
git diff --check
git diff --name-only origin/main...HEAD
git diff --stat origin/main...HEAD
```

The implementation report must record raw pass/fail totals and exact output digests for both reporter modes.

`npm run lint`, `npm run build`, `npm run verify`, and full `npm test` are not automatically required merely because this child is source-only. The Web CTO may require a broader command only if the actual implementation expands beyond the allowed scope.

## Rollback

Repository-only rollback:

```text
revert the next-child PR
```

No runtime state, workflow configuration, branch protection, database state, provider state, or Production state is created by this child.

## Later children not authorized

The following remain later independent children and are not approved by this decision:

1. risk-tiered PR gate partitioning;
2. workflow/path-filter changes;
3. branch/main dual execution;
4. Windows/Linux or Node runtime matrices;
5. shared port/temp/browser/process isolation changes;
6. standardized trace/screenshot/video/DOM/network artifacts;
7. nightly or scheduled full-regression workflows;
8. flaky-test quarantine, retry, rerun, timeout, sleep, or metrics;
9. branch-protection required-check changes;
10. remote/provider/Production smoke activation.

## Completion boundary

The selected child completes only when the registry and source-only reporter provide a deterministic, internally consistent execution topology over the existing tests and commands. It does not complete or partially implement any workflow-affecting gate.

Refs #3671.
Refs #3670.
Refs #3669 — parallel; do not touch.
Refs #3664.
Refs #3662.
Refs #3657 — Keep OPEN.
Refs #3458 — Keep OPEN.
Refs #3425 — Keep OPEN.
Refs #3435 — Keep OPEN.
Refs #3437 — Keep OPEN.
Refs #1882 — Keep OPEN.
