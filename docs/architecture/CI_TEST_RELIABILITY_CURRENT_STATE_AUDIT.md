# LoveBud CI Test Reliability Current-State Audit

## Exact baseline

| Field | Value | Status |
| --- | --- | --- |
| Repository | `skerishKang/LoveBud` | CONFIRMED |
| Parent / child | `#3670` / `#3671` | CONFIRMED |
| Historical audit baseline | `4beada4c8134afbdb791e98466db9ec1162f0a27` | CONFIRMED |
| Current refreshed `main` | `e0cb7b95085e6d6bafdfccb07a55060c340741b7` | CONFIRMED |
| Merge-forward commit | `a8d4649de62b5f12af472064f2736cdb940251ff` | CONFIRMED |
| Work class | Generic Tier 2; source-only; UI not applicable | CONFIRMED |
| Runtime, package, workflow, and test behavior | unchanged by this audit | CONFIRMED |

This document audits repository-source CI topology. It does not execute or alter tests, browsers, providers, databases, deployments, or Production.

## Refresh history

The original audit was created at `4beada4c8134afbdb791e98466db9ec1162f0a27` with:

```text
default CI total: 764
SOURCE_STATIC: 563
EXECUTED_FAKE: 187
EXECUTED_REAL_LOCAL: 14
```

Current `main` contains three later commits:

1. `125c074f4ff6af84ed75f71f0a5b65d2432a57fb` — PR #3675 added one new default-CI `SOURCE_STATIC` contract;
2. `534f9ecf3cddf8d3b84acfc6029ca1e5a07fbec6` — PR #3677 added design-system audit documents only;
3. `e0cb7b95085e6d6bafdfccb07a55060c340741b7` — merged PR #3681 completed Issue #3678 and added one new default-CI `SOURCE_STATIC` contract.

The verified cumulative count delta is therefore:

```text
default CI total: 764 → 766
SOURCE_STATIC: 563 → 565
EXECUTED_FAKE: 187 → 187
EXECUTED_REAL_LOCAL: 14 → 14
```

No historical count was silently overwritten. The original baseline remains part of the audit record.

## Evidence inspected

Current-source evidence includes:

- `package.json` and its exact script call graph;
- `.github/workflows/ci.yml`;
- `tests/test-layer-classification.json`;
- `scripts/report-test-layers.cjs`;
- lint, build, verify, environment, browser, and DB-engine support scripts;
- representative source-static, fake-runtime, real-local browser/process, Python supplemental, and DB-engine tests;
- `AGENTS.md`, `docs/ops/WORK_RISK_TIER_POLICY.md`, `docs/ops/CI_UNAVAILABLE_INFRA_MERGE_POLICY.md`, and `docs/ops/PR_CHECKLIST.md`;
- exact commit comparison from `4beada4c...` to `e0cb7b9...`.

## Evidence limits

- **CONFIRMED:** `.github/workflows/ci.yml` is the active indexed CI workflow inspected here.
- **UNVERIFIED:** branch-protection required-check configuration is not proved by repository source.
- **NOT_RUN:** local tests, browser execution, Docker/PostgreSQL, database/provider/remote/Production access, duration measurement, repeated runs, and historical-failure reproduction.
- **NOT_CLAIMED:** no named test is classified as flaky.

## Package script call graph

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

The workflow does not call `npm run ci`; `verify-static` calls lint, build, test, and verify as separate steps.

| Group | Exact script/command | Active PR workflow |
| --- | --- | --- |
| static lint | `node scripts/lint-static.js` | yes |
| static build | `node scripts/build-static.js` | yes |
| default regression | exact three `*.test.cjs` globs | yes |
| layer report | `node scripts/report-test-layers.cjs` | no explicit step |
| static verify | `node scripts/pre-deploy.cjs` | yes |
| DB engine | seven one-file PostgreSQL scripts | yes, separate jobs |
| manual browser | batch, screenshot, and E2E scripts | no |
| remote/provider | Cloudflare, Gate A, and credential scripts | no |
| extended environment verification | DB/Firebase/remote-capable scripts | no |

## Workflow and job matrix

| Job | Runner and resources | Command class | Timeout | Artifact posture |
| --- | --- | --- | --- | --- |
| `verify-static` | Ubuntu, Node 20, Playwright Chromium | lint, build, 766-file default regression, verify | no job-level timeout declared | logs only |
| `db-engine-tree-comments` | PostgreSQL 17.4 disposable service | one DB-engine test | 15 min | logs only |
| `db-engine-trees-schema` | PostgreSQL 17.4 disposable service | one DB-engine test | 15 min | logs only |
| `db-engine-generic-social-a-guard` | PostgreSQL 17.4 disposable service | one DB-engine test | 15 min | logs only |
| `db-engine-generic-social-a` | PostgreSQL 17.4 disposable service | one DB-engine test | 15 min | logs only |
| `db-engine-generic-social-b-guard` | PostgreSQL 17.4 disposable service | one DB-engine test | 15 min | logs only |
| `db-engine-generic-social-b` | PostgreSQL 17.4 disposable service | one DB-engine test | 15 min | logs only |
| `db-engine-migration-catalog-adapter` | PostgreSQL 17.4 disposable service | one DB-engine test | 15 min | logs only |

No path filter, risk label, test matrix, scheduled trigger, retry rule, or standard upload-artifact step was found in the inspected workflow.

## Current test-layer inventory

`tests/test-layer-classification.json` defines the ordered default-CI vocabulary:

```text
SOURCE_STATIC
EXECUTED_FAKE
EXECUTED_REAL_LOCAL
EXTERNAL_INTEGRATION
PRODUCTION_SMOKE
DB_ENGINE_EXECUTION
```

| Scope | Layer | Current count | Historical count |
| --- | --- | ---: | ---: |
| default CI | `SOURCE_STATIC` | 565 | 563 |
| default CI | `EXECUTED_FAKE` | 187 | 187 |
| default CI | `EXECUTED_REAL_LOCAL` | 14 | 14 |
| default CI | `EXTERNAL_INTEGRATION` | 0 | 0 |
| default CI | `PRODUCTION_SMOKE` | 0 | 0 |
| default CI | `DB_ENGINE_EXECUTION` | 0 | 0 |
| default CI total | all | 766 | 764 |
| supplemental | `SUPPLEMENTAL_PYTHON` | 10 | 10 |
| supplemental | `DB_ENGINE_EXECUTION` | 7 | 7 |
| supplemental | `EXECUTED_FAKE` | 1 | 1 |
| supplemental | `SOURCE_STATIC` | 1 | 1 |
| supplemental total | all | 19 | 19 |

Current default-path distribution is one smoke test, 81 route tests, and 684 contract tests.

## Confirmed classification inconsistency

The existing layer reporter permits supplemental layers only `SUPPLEMENTAL_PYTHON` and `DB_ENGINE_EXECUTION` and rejects supplemental paths also discovered by default globs. The committed supplemental list still contains:

- `tests/contracts/tree-card-composition-3578-contract.test.cjs` as `EXECUTED_FAKE`;
- `tests/contracts/db-migration-precondition-registry-source-validation-contract.test.cjs` as `SOURCE_STATIC`.

Both are default-CI contract paths. This remains a confirmed source inconsistency. The audit does not alter it.

## Execution topology

| Execution product | Current path | Active PR CI |
| --- | --- | --- |
| source-static contracts | default globs | yes, mixed in `npm test` |
| fake/unit-like execution | default globs | yes, mixed in `npm test` |
| real local browser/process | 14 `EXECUTED_REAL_LOCAL` files | yes, mixed in `npm test` |
| disposable DB engine | seven `tests/db-engine/*.test.cjs` jobs | yes, separate jobs |
| Python supplemental | ten `.py` paths | no discovered package/workflow runner |
| manual browser E2E/screenshots | scripts outside default CI | no |
| remote/provider/network | remote verification and smoke scripts | no |
| full regression | exact 766-file `npm test` | yes, every PR |

The evidence-layer inventory is not an execution-group authority. It does not own command selection, runtime, platform, capability, artifact, comparison, or risk-gate metadata.

## Runtime, isolation, and artifacts

- CI is Ubuntu with Node 20; no active Windows/Linux or Node-version matrix was found.
- Browser contracts use Playwright Chromium; representative fixtures use isolated contexts and local HTTP servers.
- DB jobs use loopback-only disposable PostgreSQL 17.4 services and synthetic job credentials.
- Temp-filesystem contracts generally use `os.tmpdir()` and randomized directories.
- Manual browser scripts may use shared localhost defaults and repository-local output paths.
- Standard PR evidence is logs; no common trace, video, HAR, DOM snapshot, screenshot bundle, or normalized JSON failure packet is uploaded.

## Branch/main comparison capability

- Governance requires exact main, merge base, head, diff, and CI review.
- Active CI executes only the checked-out event revision.
- It does not run the same command against pristine `main` and classify branch-only versus main-baseline failures.
- No machine-emitted result record binds SHA, command, OS, Node, lockfile digest, attempt, and normalized outcome digest.

## Risk-tier policy versus actual gates

| Policy intent | Actual workflow | Confirmed gap |
| --- | --- | --- |
| Tier 1 focused source evidence | every PR runs 766 default tests plus seven DB jobs | no machine-wired Tier 1 selection |
| Tier 2 focused behavior plus conditional browser | all 14 real-local tests run for every PR | no affected-scope selection |
| Tier 3 relevant integration/environment evidence | no risk-triggered provider/auth/remote lane | strict evidence remains scope-specific/manual |
| avoid unrelated full suites | no path/risk condition | policy and workflow are not connected |
| distinguish executed failure from unavailable infrastructure | policy vocabulary exists | no normalized machine classification packet |

## Confirmed gaps

1. No machine-readable execution-group authority over purpose, command, runtime, platform, capability, artifact, comparison, and risk metadata.
2. No deterministic branch/main same-command comparator.
3. Risk tiers do not select workflow gates.
4. The default suite mixes source-static, fake, browser/process-real, and filesystem contracts.
5. The layer reporter is not an explicit workflow product.
6. Two supplemental entries conflict with reporter rules.
7. No Windows/Linux or Node-version comparison matrix.
8. No standardized failure-artifact packet.
9. No scheduled full-regression lane.
10. No evidence-backed flaky-test data model, expiry, or first-pass metric.
11. Python supplemental tests have no discovered package/workflow runner.
12. Manual browser scripts can share localhost/output defaults.

## Hypotheses

The following remain hypotheses, not established defects:

- concurrent Chromium/local-server tests may contend for host resources;
- browser waits may become host-load sensitive;
- process globals or timers may leak where cleanup is incomplete;
- Windows-local and Ubuntu-CI behavior may diverge;
- manual timeout races may not cancel underlying work;
- fixed localhost defaults may collide.

These hypotheses do not authorize retry, sleep, timeout increase, skip, quarantine, or assertion weakening.

## Unsupported claims

This audit does not establish that any named test is flaky, that a prior failure was non-deterministic, that every job is required by branch protection, that all tests are fast, that current logs are sufficient, or that any existing gate can be removed immediately.

## Audit conclusion

**CONFIRMED:** LoveBud currently has an evidence-layer inventory, deterministic layer reporter, Ubuntu/Node 20 PR workflow, 766 default-CI tests, and seven isolated disposable-PostgreSQL jobs.

**CONFIRMED:** it does not yet have a deterministic risk-tiered gate system. The first dependency remains a machine-readable test-group registry and source-only reporter that reconciles package globs, evidence layers, supplemental paths, commands, capabilities, platforms, artifacts, and comparison metadata without changing execution.

The single selected next child is defined in `docs/architecture/CI_RISK_TIER_GATE_NEXT_CHILD_DECISION.md`.

Refs #3671.
Refs #3670.
Refs #3675 — merged.
Refs #3677 — merged; docs-only count-neutral drift.
Refs #3678 — completed.
Refs #3681 — merged; one default-CI `SOURCE_STATIC` count delta.
Refs #3669 — completed.
Refs #3664.
Refs #3662.
Refs #3657 — Keep OPEN.
Refs #3458 — Keep OPEN.
Refs #3425 — Keep OPEN.
Refs #3435 — Keep OPEN.
Refs #3437 — Keep OPEN.
Refs #1882 — Keep OPEN.
