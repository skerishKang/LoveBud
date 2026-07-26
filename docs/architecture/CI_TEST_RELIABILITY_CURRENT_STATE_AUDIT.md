# LoveBud CI Test Reliability Current-State Audit

## Exact baseline

| Field | Value | Status |
| --- | --- | --- |
| Repository | `skerishKang/LoveBud` | CONFIRMED |
| Parent / child | `#3670` / `#3671` | CONFIRMED |
| Exact `main` | `4beada4c8134afbdb791e98466db9ec1162f0a27` | CONFIRMED |
| Baseline commit | `chore: remove accidental empty placeholder` | CONFIRMED |
| Work class | Generic Tier 2; source-only; UI not applicable | CONFIRMED |
| Runtime, package, workflow, test behavior | unchanged | CONFIRMED |

This audit records repository-source topology. It does not execute or alter tests, browsers, providers, databases, deployments, or Production.

## Evidence limits

Exact-baseline evidence inspected directly:

- `package.json`;
- `.github/workflows/ci.yml`;
- `tests/test-layer-classification.json`;
- `scripts/lint-static.js`, `scripts/build-static.js`, `scripts/pre-deploy.cjs`, `scripts/verify-env.cjs`, `scripts/report-test-layers.cjs`;
- `scripts/batch-test-runner.cjs`, `scripts/capture-screenshots.cjs`, representative `scripts/e2e-*-smoke.cjs` paths;
- representative browser contracts, temp-filesystem contracts, DB-engine tests, and `tests/db-engine/helpers/postgres-disposable-harness.cjs`;
- `AGENTS.md`, `docs/ops/WORK_RISK_TIER_POLICY.md`, `docs/ops/CI_UNAVAILABLE_INFRA_MERGE_POLICY.md`, `docs/ops/PR_CHECKLIST.md`.

Limits:

- **CONFIRMED:** repository searches for checkout/setup-node/Ubuntu identify `.github/workflows/ci.yml`; no `actions/upload-artifact` reference was found.
- **UNVERIFIED:** the connector did not expose a direct workflow-directory listing or branch-protection required-check configuration. This audit therefore does not claim proof that an unindexed workflow cannot exist or that all eight jobs are required checks.
- **NOT_RUN:** tests, browsers, Docker/PostgreSQL, database/provider/remote/Production access, duration measurement, reruns, and historical-failure reproduction.
- **NOT_RUN:** no failed test is classified as flaky.

## Package script call graph

### Primary chain

```text
npm run ci
├─ npm run lint   -> node scripts/lint-static.js
├─ npm run build  -> node scripts/build-static.js
├─ npm run test   -> node --test
│  ├─ tests/smoke/*.test.cjs
│  ├─ tests/routes/*.test.cjs
│  └─ tests/contracts/*.test.cjs
└─ npm run verify -> node scripts/pre-deploy.cjs
```

The workflow does not call `npm run ci`; `verify-static` calls the four child commands as separate steps.

### Exact script topology

| Group | Exact script/command | Status |
| --- | --- | --- |
| static lint | `lint`: `node scripts/lint-static.js` | CONFIRMED |
| static build | `build`: `node scripts/build-static.js` | CONFIRMED |
| default regression | `test`: exact three `*.test.cjs` globs above | CONFIRMED |
| layer report | `test:layers`: `node scripts/report-test-layers.cjs` | CONFIRMED; not an explicit CI step |
| static verify | `verify`: `node scripts/pre-deploy.cjs` | CONFIRMED |
| extended verify | `verify:full`, `verify:remote`, `verify:env`, `verify:env:remote` | CONFIRMED; NOT_RUN; outside active PR workflow |
| DB engine | seven `test:db-engine:*` scripts, each `node --test --test-concurrency=1 <one file>` | CONFIRMED |
| manual browser | `test:batch`, `test:batch:headed`, `test:screenshots*`, `test:e2e:*`, `test:e2e:ci` | CONFIRMED; outside active CI |
| remote/provider | `smoke:cloudflare`, `smoke:gate-a`, `check:auth-credentials` | CONFIRMED; outside active CI |
| provenance | `check:migration-provenance`, evidence/candidate builders and collection scripts | CONFIRMED; not explicit PR-workflow steps |
| local aggregate | `ci`: `npm run lint && npm run build && npm run test && npm run verify` | CONFIRMED |

Exact behavior notes:

- `lint-static.js` walks from `process.cwd()`, checks `.html/.js/.mjs/.cjs`, fails tabs and missing HTML doctypes, and warns on CRLF/trailing whitespace.
- `build-static.js` only requires `index.html`; there is no bundle/compile step.
- `pre-deploy.cjs` checks JS syntax, i18n, API-file presence, HTML structure, required paths, and installed dependencies. Default `verify` skips environment/DB/Firebase work.
- `verify-env.cjs` can read database/Firebase variables, execute `SELECT 1`, use Firebase Admin, and perform remote `fetch`; it is not called by active PR CI.
- `verify` does not call `npm test`; the workflow sequencing is explicit.

## Workflow/job matrix

### Workflow contract

| Path | Trigger | Schedule | Runner | Node | Install | Merge relevance |
| --- | --- | --- | --- | --- | --- | --- |
| `.github/workflows/ci.yml` | all `pull_request`; `push` to `main` | NOT_PRESENT | `ubuntu-latest` | `20` | `npm ci` | PR/push status checks; branch-protection requirement UNVERIFIED |

### Jobs

| Job | Resources | Command | Timeout | Artifact |
| --- | --- | --- | --- | --- |
| `verify-static` | Ubuntu, Node 20, Playwright Chromium installed with OS deps | lint, build, `npm test`, verify | no job-level timeout declared | workflow logs only |
| `db-engine-tree-comments` | PostgreSQL `17.4-bookworm`, loopback `5432`, apt `psql` | `test:db-engine:tree-comments` | 15 min | logs only |
| `db-engine-trees-schema` | same | `test:db-engine:trees-schema` | 15 min | logs only |
| `db-engine-generic-social-a-guard` | same | `test:db-engine:generic-social-a-guard` | 15 min | logs only |
| `db-engine-generic-social-a` | same | `test:db-engine:generic-social-a` | 15 min | logs only |
| `db-engine-generic-social-b-guard` | same | `test:db-engine:generic-social-b-guard` | 15 min | logs only |
| `db-engine-generic-social-b` | same | `test:db-engine:generic-social-b` | 15 min | logs only |
| `db-engine-migration-catalog-adapter` | same | `test:db-engine:migration-catalog-adapter` | 15 min | logs only |

All DB jobs use synthetic job-derived credentials, `LB_TEST_PG*`, exact server-version assertion `170004`, and one test file per job. There are no path filters, risk labels, matrices, scheduled triggers, retries, or upload-artifact steps in the inspected workflow.

## Test-layer inventory

`tests/test-layer-classification.json` defines this ordered vocabulary:

```text
SOURCE_STATIC
EXECUTED_FAKE
EXECUTED_REAL_LOCAL
EXTERNAL_INTEGRATION
PRODUCTION_SMOKE
DB_ENGINE_EXECUTION
```

It defines exact default globs matching `package.json` and states that classification is content-evidence based, not filename based.

### Current counts

| Scope | Layer | Count | Status |
| --- | --- | ---: | --- |
| default CI | `SOURCE_STATIC` | 563 | CONFIRMED |
| default CI | `EXECUTED_FAKE` | 187 | CONFIRMED |
| default CI | `EXECUTED_REAL_LOCAL` | 14 | CONFIRMED |
| default CI | `EXTERNAL_INTEGRATION` | 0 | CONFIRMED |
| default CI | `PRODUCTION_SMOKE` | 0 | CONFIRMED |
| default CI | `DB_ENGINE_EXECUTION` | 0 | CONFIRMED |
| default CI total | all | 764 | CONFIRMED |
| supplemental | `SUPPLEMENTAL_PYTHON` | 10 | CONFIRMED |
| supplemental | `DB_ENGINE_EXECUTION` | 7 | CONFIRMED |
| supplemental | `EXECUTED_FAKE` | 1 | CONFIRMED |
| supplemental | `SOURCE_STATIC` | 1 | CONFIRMED |
| supplemental total | all | 19 | CONFIRMED |

Default-path distribution: one smoke test; 81 route tests; 682 contract tests. Supplemental capability values include `postgresql`, `child_process`, and `filesystem` on seven DB tests, plus one `playwright-optional` entry.

### Confirmed inventory/reporter inconsistency

`report-test-layers.cjs` allows supplemental layers only `SUPPLEMENTAL_PYTHON` and `DB_ENGINE_EXECUTION`, and rejects supplemental paths that are also default-CI paths. The committed supplemental list nevertheless contains:

- `tests/contracts/tree-card-composition-3578-contract.test.cjs` as `EXECUTED_FAKE`;
- `tests/contracts/db-migration-precondition-registry-source-validation-contract.test.cjs` as `SOURCE_STATIC`.

Both paths are also discovered by the default contract glob. This is a **CONFIRMED source inconsistency**. `npm run test:layers` was **NOT_RUN**, so no runtime result is claimed.

## Test discovery and execution topology

### Default discovery

`report-test-layers.cjs` reads `package.json.scripts.test`, accepts only fail-closed `node --test <directory>/*.test.cjs` grammar, normalizes separators, reads each directory non-recursively, sorts paths, and reconciles them with the classification inventory.

Consequences:

- exact files directly under `tests/smoke`, `tests/routes`, and `tests/contracts` are discovered;
- nested tests are not discovered by the default globs;
- Python and `tests/db-engine/**` are not in default `npm test`;
- default `node --test` has no explicit global `--test-concurrency`, so file-level scheduling uses Node defaults;
- individual DB scripts enforce `--test-concurrency=1`.

### Existing execution groups

| Execution product | Existing path | Active PR CI |
| --- | --- | --- |
| source-static/contract | default globs | yes, mixed in `npm test` |
| fake/unit-like execution | default globs, often `node:vm`/fakes | yes, mixed |
| real local browser/process | 14 `EXECUTED_REAL_LOCAL` files | yes, mixed in `npm test` |
| disposable DB engine | seven `tests/db-engine/*.test.cjs` scripts/jobs | yes, separate jobs |
| Python supplemental | ten `.py` paths | NOT_PRESENT in package/workflow topology |
| manual browser E2E/screenshots | `scripts/e2e-*`, batch, capture scripts | no |
| remote/provider/network | remote verify/smoke/credential scripts | no |
| full regression | exact 764-file `npm test` | yes, every PR |

The evidence layer is not an execution-group authority: it does not define command ownership, duration class, platform requirement, port/temp/process ownership, artifact expectation, or risk-gate relevance.

## Runtime and platform assumptions

- **CONFIRMED:** CI is Ubuntu/Node 20. `package.json` has no `engines.node` declaration.
- **CONFIRMED:** repository governance declares Windows and PowerShell 7 as the primary local environment and WSL as explicit-only.
- **CONFIRMED:** reporter/path-heavy code generally uses `path.join/resolve/sep` and separator normalization; DB harness uses `spawnSync(..., shell:false, windowsHide:true)`.
- **UNVERIFIED:** the full 764-file suite is equivalent across Windows/PowerShell and Ubuntu/Node 20; no active OS/Node matrix proves it.
- **CONFIRMED:** browser contracts require Playwright Chromium; CI installs Chromium once before the mixed default suite.
- **CONFIRMED:** manual browser scripts commonly default to `http://localhost:8888` via `LOVEBUD_URL` override.
- **CONFIRMED:** representative browser contracts bind `127.0.0.1` on ephemeral port `0`; DB jobs use fixed `127.0.0.1:5432` in isolated jobs.
- **CONFIRMED:** temp-fixture contracts use `os.tmpdir()` plus `mkdtempSync`; DB names include scenario, process ID, and random bytes.

## Shared-resource/isolation inventory

### Browser/server

Representative settings contracts:

- create one server and browser in `before`;
- create a fresh browser context per fixture;
- capture page errors, console errors, request failures, and CSP messages in memory;
- route selected Firebase/font URLs to controlled responses;
- close contexts, browser, and server in teardown.

Manual batch/capture scripts instead use shared localhost defaults and write under `docs/test-scenarios/results`. Batch execution uses `waitForTimeout` and a five-minute `Promise.race`; a timeout does not prove cancellation of underlying work.

### Database/process

The shared DB harness:

- accepts loopback hosts only and synthetic `lovebud_ci*` identities;
- uses fixed/default port `5432` and optional `PSQL_BIN`;
- creates randomized disposable databases;
- applies SQL with `psql`, closes clients, and force-drops DBs in `finally`;
- records cleanup failures in `globalThis.__lb_db_cleanup_errors`.

### Global/time/environment

- browser fixtures use DOM/window/localStorage globals, `window.__lb*` trackers, timers, and Playwright waits;
- DB tests use `LB_TEST_PG*`; manual browser scripts use `LOVEBUD_URL`; extended verification can use DB/Firebase/remote variables;
- **NOT_PRESENT:** a central resource registry for ports, temp paths, browser instances, child processes, timers, cleanup outcomes, or environment requirements.

## Failure artifact inventory

| Evidence | Default PR CI | Status |
| --- | --- | --- |
| TAP/stdout/stderr and lint/build/verify text | workflow logs | CONFIRMED |
| DB bounded failure text | workflow logs | CONFIRMED |
| page/console/request/CSP evidence | selected tests assert in memory and emit assertion/log output | CONFIRMED |
| screenshots | no standard CI upload; manual scripts write PNGs | CONFIRMED |
| trace | none found | NOT_PRESENT |
| video | none found | NOT_PRESENT |
| HAR/network archive | none found | NOT_PRESENT |
| DOM snapshot | no standard artifact | NOT_PRESENT |
| normalized JSON failure packet | no standard artifact/upload | NOT_PRESENT |

There is no common artifact root bound to exact SHA, workflow job, test ID, attempt, platform, and command digest.

## Branch/main comparison capability

- **CONFIRMED:** governance requires exact main/base/merge-base/head/diff review and distinguishes verified/unverified and pristine-main/branch-only failures conceptually.
- **CONFIRMED:** active CI runs only the event checkout. It does not rerun the same command against exact pristine main or compare normalized results.
- **CONFIRMED:** implemented CI vocabulary is `CI_GREEN`, `CI_EXECUTED_FAILURE`, `CI_PENDING_EXECUTION`, `CI_UNAVAILABLE_INFRA`.
- **NOT_PRESENT:** machine-emitted `BRANCH_ONLY_FAILURE`, `MAIN_BASELINE_FAILURE`, `PLATFORM_ONLY_FAILURE`, or `NON_DETERMINISTIC_FAILURE`.
- **NOT_PRESENT:** a result record binding exact SHA, command, OS, Node, lockfile digest, attempt, and outcome digest.
- **UNVERIFIED:** current baseline full-suite result; it was not executed here.

## Risk-tier policy versus actual gates

| Policy | Actual workflow | Gap |
| --- | --- | --- |
| Tier 1: focused syntax/static/contract evidence | every PR runs 764 default tests plus seven DB jobs | policy not machine-wired |
| Tier 2: focused behavior plus conditional browser | all 14 real-local tests run for every PR; manual E2E remains outside | no affected-scope selection |
| Tier 3: relevant regression/integration/environment | no risk-triggered provider/auth/remote lane | strict evidence remains manual/scope-specific |
| avoid unrelated full suites for small changes | no path/risk conditions | documented and actual gates differ |
| executed failure blocks merge | raw job failure exists | aligned, but no branch/main classifier |
| infrastructure unavailable is distinct | docs policy exists | no machine-generated classification packet |

## Confirmed gaps

1. No machine-readable execution-group authority over commands, capabilities, platforms, artifacts, comparison rules, and risk relevance.
2. No deterministic branch/main same-command comparator.
3. Risk tiers do not select workflow gates; every PR receives the same eight jobs.
4. `npm test` mixes source-static, fake, real browser/process, and filesystem contracts.
5. The existing layer reporter is not an active workflow product.
6. Two supplemental entries conflict with the reporter's own schema/default-CI separation.
7. No Windows/Linux or Node-version comparison matrix.
8. No standardized failure-artifact packet.
9. No scheduled/nightly full-regression lane.
10. No flaky-governance data model, expiry, first-pass metric, or evidence-backed non-determinism state.
11. Python supplemental tests have no discovered package/workflow runner.
12. Manual browser scripts use shared localhost defaults and repo-local output paths.

## Hypotheses

- **HYPOTHESIS:** concurrent Chromium/local-server tests can contend for CPU, memory, or startup time.
- **HYPOTHESIS:** browser waits can become host-load sensitive without application non-determinism.
- **HYPOTHESIS:** process globals/timers can leak where cleanup is incomplete.
- **HYPOTHESIS:** Windows-local and Ubuntu-CI behavior can diverge for cwd, executable lookup, and process semantics.
- **HYPOTHESIS:** manual `Promise.race` timeouts may leave underlying work running.
- **HYPOTHESIS:** fixed `localhost:8888` manual runs can collide.

These hypotheses do not authorize retries, sleeps, timeout increases, skips, quarantine, or assertion weakening.

## Unsupported claims

This audit does not establish that any named test is flaky; that a prior failure was non-deterministic; that baseline main currently passes or fails; that one OS/Node version is less reliable; that every DB job is required by branch protection; that all tests are fast; that current logs are sufficient; or that any gate can be removed immediately.

## Audit conclusion

**CONFIRMED:** LoveBud has a useful evidence-layer inventory, deterministic layer reporter, Ubuntu/Node 20 PR workflow, 764 default tests, and seven isolated disposable-PostgreSQL jobs.

**CONFIRMED:** it does not yet have a deterministic risk-tiered gate system. The first dependency is a machine-readable test-group registry and source-only classification reporter that reconciles package globs, evidence layers, supplemental paths, commands, capabilities, platform assumptions, artifacts, and comparison metadata without changing execution.

The single selected next child is defined in `docs/architecture/CI_RISK_TIER_GATE_NEXT_CHILD_DECISION.md`.

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
