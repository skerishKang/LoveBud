# CI Failure Artifact Standard Decision

Source-only CI reliability architecture decision for Issue #3791 (parent reliability program #3670, Keep OPEN). Defines the canonical sanitized evidence contract for CI failures across every LoveBud test group, without authorizing any workflow, package, script, test, registry, browser, Production, or provider change.

## 1. Status and exact source baseline

```text
Status:      DRAFT decision record — pending Web CTO review
Baseline:    origin/main 38f4b5bd214e24f1f5fc4c1d5cc890803931ff9d
Branch:      docs/ci-failure-artifact-standard-3791-c1-fresh
Issue:       #3791 — Define sanitized failure-artifact contract without workflow changes
Parent:      #3670 — Keep OPEN (ordered step 5: failure artifact standardization)
Prerequisites: #3671/PR #3676 topology audit, #3685/PR #3686 group registry+reporter,
               #3710/PR #3711 risk-tier gate planner, #3715/PR #3720 isolation hardening
Authorities: docs/architecture/CI_TEST_RELIABILITY_CURRENT_STATE_AUDIT.md
             docs/architecture/CI_TEST_GROUP_REGISTRY_CONTRACT.md
             docs/architecture/CI_RISK_TIER_GATE_POLICY_CONTRACT.md
             docs/architecture/CI_TEST_ISOLATION_HARDENING_DECISION.md
             docs/ops/WORK_RISK_TIER_POLICY.md, docs/ops/PR_CHECKLIST.md
             docs/project/VERIFICATION_AND_EVIDENCE.md
```

Evidence vocabulary (Issue #3791):

```text
SOURCE_CONFIRMED             directly read from current source
CURRENTLY_EMITTED            output that current CI/test code actually produces
EPHEMERAL_ONLY               output confirmed by source/runtime to exist only in the runner-local
                              session and not preserved by the remote platform
PERSISTED_ARTIFACT           output that persists on disk/remote
SANITIZED_ALLOWED            fixed repo paths, operation codes, SHA, file/command names,
                             runtime/platform ids, bounded HTTP status classes, aggregate counts
PROHIBITED_SENSITIVE         must never appear in any artifact (see §8)
MISSING_REQUIRED_EVIDENCE    evidence required by this contract but not currently emitted
GROUP_SPECIFIC               a per-test-group contract
PLATFORM_SPECIFIC            a per-platform contract
IMPLEMENTATION_REQUIRED_LATER  deferred to the one future child
UNRESOLVED_RUNTIME           browser/runner-only claim not provable from source
NOT_APPLICABLE               not relevant for a given group/field
```

## 2. Scope and evidence limits

- Scope: define the canonical sanitized failure-artifact contract (metadata, comparison evidence, allowed artifacts, sanitization, retention, classification proof, fail-closed rules, machine/human summary boundary) for every canonical test group, sourced entirely from current `origin/main`.
- Evidence boundary: `.github/workflows/ci.yml`, `package.json`, `scripts/report-ci-test-groups.cjs`, `scripts/plan-ci-risk-gates.cjs`, `tests/ci-test-group-registry.json`, `tests/ci-risk-gate-policy.json`, `tests/test-layer-classification.json`, the listed architecture/ops docs, and representative browser/process/DB-engine contracts read only for their output behavior.
- Limits: no workflow/package/script/test/registry edit; no browser/Playwright/screenshot/test execution; no Production/Cloudflare/provider/DB/API/Auth action. Browser-only or runner-only claims are `UNRESOLVED_RUNTIME`. "Persisted/uploaded/retained" is claimed only where source proves it; everything else is `CURRENTLY_EMITTED` with platform persistence/retention recorded as `UNRESOLVED_RUNTIME` or `MISSING_REQUIRED_EVIDENCE`. `EPHEMERAL_ONLY` is used only where source/runtime confirms the output exists solely in the runner-local session.

## 3. Current artifact/output inventory

Workflow (`SOURCE_CONFIRMED`): `.github/workflows/ci.yml` has one `verify-static` job (Ubuntu, Node 20, Playwright Chromium; runs `npm run lint`, `npm run build`, `npm test`, `npm run verify`) and seven DB-engine jobs (Ubuntu, Node 20, ephemeral `postgres:17.4-bookworm` service; each runs one `npm run test:db-engine:*` with a 15-minute timeout). The workflow contains **no** `upload-artifact`, no trace/video/HAR/DOM-snapshot/screenshot-bundle step, and no normalized failure-packet step.

Runner/posture (`SOURCE_CONFIRMED`):

| Job | Posture |
|---|---|
| `verify-static` | logs only (`CURRENTLY_EMITTED`; platform persistence/retention `UNRESOLVED_RUNTIME`) |
| `db-engine-tree-comments` | logs only, 15 min timeout |
| `db-engine-trees-schema` | logs only, 15 min timeout |
| `db-engine-generic-social-a-guard` / `-a` / `-b-guard` / `-b` | logs only, 15 min timeout |
| `db-engine-migration-catalog-adapter` | logs only, 15 min timeout |

Commands (`SOURCE_CONFIRMED`, `package.json`): `test` = `node --test tests/smoke/*.test.cjs tests/routes/*.test.cjs tests/contracts/*.test.cjs`; seven `test:db-engine:*` = `node --test --test-concurrency=1 tests/db-engine/<suite>.test.cjs`; `test:layers` = `node scripts/report-test-layers.cjs`; `verify` = `node scripts/pre-deploy.cjs`; manual-only `test:screenshots` = `node scripts/capture-screenshots.cjs`, `test:batch` = `node scripts/batch-test-runner.cjs`, `test:e2e:*`.

Current emitted vs persisted (`SOURCE_CONFIRMED`):

- `CURRENTLY_EMITTED`: TAP test output (node:test), GitHub Actions step logs, `pre-deploy.cjs` console diagnostics, `report-test-layers.cjs` console report. None are uploaded as artifacts (`no upload-artifact` proven in `ci.yml`). Repository source proves emission, not remote persistence: whether the platform retains these (and for how long, per organization/repository settings) is `UNRESOLVED_RUNTIME`/`MISSING_REQUIRED_EVIDENCE`, so no runner-session-expiry claim is made.
- `PERSISTED_ARTIFACT`: only the manual local screenshot tool `capture-screenshots.cjs` writing under `docs/test-scenarios/results/<folder>/screenshots/*.png` and `batch-test-runner.cjs` (both in the `REMOTE_OR_PROVIDER_MANUAL` group); `docs/test-scenarios/` is gitignored (`.gitignore:86`) with six historical tracked result files. These are manual local artifacts, not CI products.
- DB-engine credential posture (`SOURCE_CONFIRMED`): synthetic `POSTGRES_PASSWORD` is an expression-only `format('{0}-{1}', github.run_id, github.run_attempt)` job-derived value — an artifact must never echo it or a derived DB URL.
- The current-state audit independently confirms: "Standard PR evidence is logs; no common trace, video, HAR, DOM snapshot, screenshot bundle, or normalized JSON failure packet is uploaded" and "No path filter, risk label, test matrix, scheduled trigger, retry rule, or standard `upload-artifact` step was found."

Registry artifact expectations (`SOURCE_CONFIRMED`, `tests/ci-test-group-registry.json` `artifact_expectation_enum` + per-group `artifact_expectation`):

```text
SOURCE_STATIC            TAP test output
EXECUTED_FAKE            TAP test output
BROWSER_REAL_LOCAL       TAP test output (runtime node_browser; requires Playwright Chromium)
PROCESS_REAL_LOCAL       TAP test output
DB_ENGINE                TAP test output (postgresql_ephemeral)
PYTHON_SUPPLEMENTAL      stdout or tool report (manual/cross_platform)
REMOTE_OR_PROVIDER_MANUAL  command-defined; none registered by this child (NOT_EXECUTED)
FULL_DEFAULT_REGRESSION  combined TAP output from all default-CI groups
```

## 4. Test-group evidence matrix

Per-group canonical artifact contract (`SOURCE_CONFIRMED` registry fields + this decision). `ALLOWED` = sanitized artifact types this contract permits for the group.

| Group | Command (source) | Runtime/Platform | Currently emitted | Allowed artifact types | ci_state / failure_class this group can prove |
|---|---|---|---|---|---|
| SOURCE_STATIC | `npm test` glob | node / ubuntu | TAP | TAP summary (sanitized), aggregate counts, failing file/test names | BRANCH_ONLY, MAIN_BASELINE, NON_DETERMINISTIC, PLATFORM_ONLY(na) |
| EXECUTED_FAKE | `npm test` glob | node / ubuntu | TAP | TAP summary, aggregate counts, failing file/test names | BRANCH_ONLY, MAIN_BASELINE, NON_DETERMINISTIC |
| BROWSER_REAL_LOCAL | `npm test` glob | node_browser / ubuntu | TAP (+ in-contract pageerror/console counters) | TAP summary, sanitized pageerror/console/requestfailed counts, optional sanitized DOM/text snapshot (no private values) | BRANCH_ONLY, MAIN_BASELINE, PLATFORM_ONLY(na), NON_DETERMINISTIC |
| PROCESS_REAL_LOCAL | `npm test` glob | node / ubuntu | TAP | TAP summary, process stdout/stderr summary (sanitized), child-process/filename evidence | BRANCH_ONLY, MAIN_BASELINE, NON_DETERMINISTIC |
| DB_ENGINE | `npm run test:db-engine:*` (7) | postgresql_ephemeral / ubuntu | TAP (+ psql `SHOW server_version_num`) | TAP summary, pg version line, bounded SQL/operation codes (no SQL bodies with private values), aggregate migration counts | BRANCH_ONLY, MAIN_BASELINE, NON_DETERMINISTIC; ci_state CI_UNAVAILABLE_INFRA (service) |
| PYTHON_SUPPLEMENTAL | manual / separate Python | python / cross_platform | none (MANUAL) | stdout or tool report (sanitized) | PLATFORM_SPECIFIC only (manual evidence, not CI) |
| REMOTE_OR_PROVIDER_MANUAL | NOT_EXECUTED (inventory only) | manual / manual | none | command-defined by the operator; never auto-uploaded; sanitized per §8 | manual/provider classification only |
| FULL_DEFAULT_REGRESSION | `npm test` (exact) | aggregate / ubuntu | TAP (combined) | combined TAP summary, per-group aggregate counts, failure inventory | BRANCH_ONLY, MAIN_BASELINE, NON_DETERMINISTIC (aggregate-level) |

`NOT_APPLICABLE`: screenshot/video artifacts for SOURCE_STATIC/EXECUTED_FAKE/PROCESS_REAL_LOCAL/DB_ENGINE (no rendering); DOM/network artifacts for SOURCE_STATIC/EXECUTED_FAKE; DB summaries for non-DB groups.

## 5. Canonical failure-artifact schema

A canonical failure packet is a machine-readable JSON document (`SOURCE_CONFIRMED` fields + this decision's canonical definition). Every artifact must carry at minimum:

```json
{
  "schema_version": "1.0",
  "failure_id": "<repo_slug>|<sha>|<group>|<command_id>|<attempt>|<run_id>",
  "sha": "<exact source SHA>",
  "branch": "<branch name or 'main'>",
  "command": "<allowlisted canonical npm/node command, no secret-bearing arguments>",
  "command_id": "<bounded allowlisted command identifier or deterministic hash of the sanitized canonical command>",
  "runtime": "node | node_browser | postgresql_ephemeral | python | manual | aggregate",
  "platform": "ubuntu | cross_platform | manual",
  "test_group": "SOURCE_STATIC | EXECUTED_FAKE | BROWSER_REAL_LOCAL | PROCESS_REAL_LOCAL | DB_ENGINE | PYTHON_SUPPLEMENTAL | REMOTE_OR_PROVIDER_MANUAL | FULL_DEFAULT_REGRESSION",
  "attempt": "<positive integer>",
  "outcome": "PASS | FAIL | ERROR | SKIP | CANCELLED | INFRA_UNAVAILABLE | PENDING",
  "ci_state": "CI_GREEN | CI_EXECUTED_FAILURE | CI_PENDING_EXECUTION | CI_UNAVAILABLE_INFRA",
  "failure_class": "BRANCH_ONLY_FAILURE | MAIN_BASELINE_FAILURE | PLATFORM_ONLY_FAILURE | NON_DETERMINISTIC_FAILURE | UNCLASSIFIED",
  "environment": { "os": "ubuntu-latest", "node": "20", "postgres": "17.4" },
  "failing_files": ["<repo-relative test path>"],
  "failing_tests": ["<sanitized test name>"],
  "aggregate_counts": { "<group>": { "total": 0, "passed": 0, "failed": 0 } },
  "comparison": {
    "branch_sha": "<sha>", "main_sha": "<sha>", "pristine_main_sha": "<sha>",
    "commands_equal": true,
    "branch_failures": [], "main_failures": [],
    "branch_only_failures": [], "platform_matrix": {}, "attempt_history": []
  },
  "artifacts": [{ "type": "tap|log|screenshot|video|dom|console|network|process|db_summary", "path": "<relative>", "sanitized": true }],
  "machine_summary": { "bounded": true },
  "human_summary": "<bounded description, no private values>"
}
```

Schema rules:

- `ci_state` records whether the relevant work executed and its result; `failure_class` records the causal comparison classification. A branch test that executed and failed with no main comparison yet is `ci_state: CI_EXECUTED_FAILURE` + `failure_class: UNCLASSIFIED`. The hybrid values `CI_EXECUTED_MAIN_REGRESSION`, `CI_EXECUTED_MAIN_FAILURE`, `CI_EXECUTED_BRANCH_FAILURE` are not part of this contract's canonical vocabulary.
- `failure_id` never contains a raw command, shell argument, or private URL. `command_id` is a bounded identifier from the canonical allowlist (registry/package commands) or the deterministic hash of the sanitized canonical command.
- `command` accepts only canonical allowlisted commands; secret-bearing CLI arguments (tokens, passwords, URLs, query strings) are prohibited. If a command contains such a value, it is redacted; if redaction leaves command identity ambiguous, the packet is rejected.
- Manual/provider commands are split into a bounded `operation ID` (in `command_id`) and a sanitized command summary (in `command`); the raw invocation never appears.

## 6. Required versus optional fields

Required for every packet (a packet missing any of these is incomplete and fails closed):

```text
schema_version, failure_id, sha, branch, command, command_id, runtime, platform, test_group,
attempt, outcome, ci_state, failure_class, environment, failing_files, failing_tests,
aggregate_counts, machine_summary, artifacts[]
```

Required only when `failure_class` is not `UNCLASSIFIED`:

```text
comparison.branch_sha + comparison.main_sha + comparison.commands_equal
comparison.branch_failures + comparison.main_failures
comparison.branch_only_failures (for BRANCH_ONLY_FAILURE)
comparison.platform_matrix (for PLATFORM_ONLY_FAILURE)
comparison.attempt_history (for NON_DETERMINISTIC_FAILURE)
```

Required only when `ci_state` is `CI_UNAVAILABLE_INFRA`:

```text
which relevant step did not execute
bounded reason why it did not execute
```

Optional:

```text
human_summary (bounded), per-artifact file paths (only if an artifact was persisted),
screenshot/video/dom/console/network/process/db_summary entries (group-allowed types only)
```

## 7. Branch/main/platform/non-determinism proof rules

A failure carries two orthogonal axes: `ci_state` (execution presence and result) and `failure_class` (causal comparison). Neither is self-awarded; both require comparable evidence (`SOURCE_CONFIRMED` comparability fields in the registry + `docs/project/VERIFICATION_AND_EVIDENCE.md` §11 pristine-main comparison + `docs/ops/MVP_AGENT_GOVERNANCE.md` CI vocabulary):

- **`ci_state`**: whether the relevant work executed and its result. `CI_EXECUTED_FAILURE` requires evidence an executed step failed; `CI_PENDING_EXECUTION` requires evidence the work is queued/running; `CI_UNAVAILABLE_INFRA` requires evidence no relevant step executed (billing, outage, runner allocation, service container not started); `CI_GREEN` requires evidence the executed work passed.
- **`failure_class`** (only meaningful when `ci_state` is a failure):
  - **BRANCH_ONLY_FAILURE**: same exact command (`commands_equal: true`), same globs, fails on branch SHA, passes on pristine main SHA. Evidence: `branch_sha`, `main_sha`, `branch_failures`, `main_failures` (empty), `branch_only_failures`. Registry comparability: "same node --test command, same globs, deterministic per-path membership".
  - **MAIN_BASELINE_FAILURE**: same exact command fails on pristine main SHA → not branch-caused; report `main_sha` + `main_failures` and do not attribute to the branch.
  - **PLATFORM_ONLY_FAILURE**: same SHA + command, fails on one platform/runtime, passes on another (e.g., ubuntu CI vs cross_platform/manual; node-version matrix). Evidence: `platform_matrix` with per-platform outcomes. The registry has only `ubuntu`/`cross_platform`/`manual` platforms today — a real ubuntu-vs-other comparison is `MISSING_REQUIRED_EVIDENCE` until a comparison lane exists.
  - **NON_DETERMINISTIC_FAILURE**: identical SHA + command + platform, attempt N fails, a later attempt with the exact same SHA passes, with no source change between attempts. Evidence: `attempt_history` (attempt numbers + outcomes + exact same `sha`). Does not authorize retry/skip/quarantine/assertion changes (`SOURCE_CONFIRMED` isolation audit: "hypotheses … do not authorize retry, sleep, timeout increase, skip, quarantine, or assertion weakening").
  - **UNCLASSIFIED**: any executed failure without the comparison/attempt/infra evidence above. Example: a branch test executed and failed with no main comparison yet → `ci_state: CI_EXECUTED_FAILURE` + `failure_class: UNCLASSIFIED`.
- The four CI states remain the merge-gate vocabulary; the artifact packet supplies the evidence for them but does not replace them. The former hybrid values `CI_EXECUTED_MAIN_REGRESSION`, `CI_EXECUTED_MAIN_FAILURE`, `CI_EXECUTED_BRANCH_FAILURE` are not part of this contract's canonical vocabulary.

## 8. Sanitization and prohibited-data matrix

`PROHIBITED_SENSITIVE` — never persist or echo in any artifact, summary, log, screenshot, DOM snapshot, or console/network/process/DB summary:

```text
credentials; secrets; tokens; cookies; authorization headers; API keys
DB URLs; connection strings; passwords (incl. the expression-derived CI POSTGRES_PASSWORD)
raw request or response bodies
private tree IDs, memory IDs, user IDs
user-generated content (titles, memo text, comments)
provider/account/project identifiers (Firebase project, Modal, Neon, Cloudflare, Vercel, Netlify)
private URLs
raw stack traces containing private paths or values
```

`SANITIZED_ALLOWED` (only when source evidence supports them):

```text
fixed repository-relative paths (e.g., tests/contracts/foo.test.cjs)
sanitized operation codes (e.g., HTTP status classes "400-499", migration op names)
exact source SHA; branch names; command names; runtime/platform identifiers
test file names; sanitized test names (no private payloads)
bounded HTTP/status classes; aggregate pass/fail counts
environment identifiers (os/node/postgres versions)
```

Rule: a raw value must be sanitized to its class (e.g., `<TOKEN>`, `<DB_URL>`, `<TREE_ID>`) before it may appear; if a value cannot be sanitized without ambiguity, it is omitted. The release observability audit's Production taxonomy and the governance secret rule ("Never expose … credentials, cookies, sessions, tokens, private IDs, private payloads, database URLs, or authorization headers in evidence" — `VERIFICATION_AND_EVIDENCE.md` §12) are the authority.

## 9. Artifact naming and retention decision

- Naming (`SANITIZED_ALLOWED`): every persisted artifact path/name component is built only from bounded slugs — `repo_slug`, `branch_slug`, `group_slug`, `command_id` — plus `sha[:12]` and `attempt<N>`. No raw `<repo>`, `<branch>`, or command string is ever placed in a filename or path.
- Slug rule (applied to every persisted path component): allowed characters `[a-z0-9._-]`; lowercase normalization; consecutive separators collapsed; leading/trailing `.` and `-` trimmed; fixed maximum length; empty result forbidden; `/` and `\` forbidden; `..` forbidden; absolute paths forbidden; path traversal forbidden; NUL/control characters forbidden. If the original value cannot be normalized safely, a deterministic hash of it is used instead.
- `command_id` is the allowlisted identifier or the deterministic hash of the sanitized canonical command (see §5); raw commands, raw shell arguments, and private URLs never appear in `failure_id` or artifact filenames.
- Retention: CI logs and TAP output are `CURRENTLY_EMITTED`. Repository source proves emission but not remote persistence or exact retention; the platform-managed persistence/retention (organization/repository settings, download window) is `UNRESOLVED_RUNTIME`/`MISSING_REQUIRED_EVIDENCE`, and no runner-session-expiry assertion is made.
- Persisted artifacts (only when the one future child adds an emitter): sanitized packets and sanitized group-allowed files only, stored under a gitignored path (the repo already ignores `docs/test-scenarios/`; a CI packet directory must also be gitignored), retained for the PR lifecycle plus a bounded window (decision: 30 days) then deletable; never force-pushed or committed. The six historical tracked `docs/test-scenarios/results/` files are manual-local, not CI artifacts, and are unaffected.
- No artifact may be uploaded unless a future workflow step adds `upload-artifact`; that step is `IMPLEMENTATION_REQUIRED_LATER` and never authorized by this document.

## 10. Human versus machine summary boundary

- `machine_summary`: structured fields only (schema §5) — counts, failing file/test names, comparison results, platform matrix, attempt history, sanitized operation codes. Consumed by reviewers/tools; no free-form prose.
- `human_summary`: a bounded description (a few sentences) for a reviewer, produced from the machine fields; must not add private values or raw payloads; if it cannot be written without sensitive content, it is omitted rather than redacted-in-place.
- Raw logs that are not persisted as artifacts stay outside both summaries; the machine packet references a persisted raw log only by a sanitized relative path. Logs that are only `CURRENTLY_EMITTED` (platform persistence `UNRESOLVED_RUNTIME`) are never cited as evidence of expiry.
- Boundary rule: a human summary must be reproducible from the machine packet; a reviewer must never need to open a raw log to classify a failure, only to inspect a sanitized artifact referenced by the packet.

## 11. Fail-closed completeness rules

- A packet missing any required field (§6) is `incomplete`: its `ci_state` is recorded from whatever executed work proves it, and its `failure_class` must be `UNCLASSIFIED`. An unclassified failure cannot be cited as branch-only, main-baseline, platform-only, or non-deterministic.
- A `ci_state: CI_EXECUTED_FAILURE` without the §7 comparison evidence (branch + main SHA + `commands_equal`) cannot carry `failure_class: BRANCH_ONLY_FAILURE` or `MAIN_BASELINE_FAILURE`; it is `UNCLASSIFIED`.
- `ci_state: CI_UNAVAILABLE_INFRA` requires proof that no relevant step executed; a packet asserting it with evidence of executed failing steps is rejected.
- `ci_state` and `failure_class` are independent axes: a packet must never collapse them (e.g., no `CI_EXECUTED_BRANCH_FAILURE`-style hybrid value).
- Aggregate counts must reconcile with the reported failing files; a mismatch fails closed.
- If sanitization cannot be verified as complete for an artifact, that artifact is dropped from the packet rather than included unsanitized.
- A `command` or `failure_id` containing a raw secret-bearing argument, or a command whose redaction leaves identity ambiguous, causes the packet to be rejected.

## 12. Compatibility identifiers

Identifiers the one future child must preserve or deliberately migrate (`COMPATIBILITY_IDENTIFIER`, `SOURCE_CONFIRMED`):

- Group enum order: `SOURCE_STATIC, EXECUTED_FAKE, BROWSER_REAL_LOCAL, PROCESS_REAL_LOCAL, DB_ENGINE, PYTHON_SUPPLEMENTAL, REMOTE_OR_PROVIDER_MANUAL, FULL_DEFAULT_REGRESSION` (registry `group_enum`; reporter `CANONICAL_GROUP_ENUM`).
- Layer vocabulary: `SOURCE_STATIC, EXECUTED_FAKE, EXECUTED_REAL_LOCAL, EXTERNAL_INTEGRATION, PRODUCTION_SMOKE, DB_ENGINE_EXECUTION` (classification).
- CI states (`ci_state`): `CI_GREEN, CI_EXECUTED_FAILURE, CI_PENDING_EXECUTION, CI_UNAVAILABLE_INFRA` (governance).
- Failure classes (`failure_class`): `BRANCH_ONLY_FAILURE, MAIN_BASELINE_FAILURE, PLATFORM_ONLY_FAILURE, NON_DETERMINISTIC_FAILURE, UNCLASSIFIED`. The former hybrid values `CI_EXECUTED_MAIN_REGRESSION`, `CI_EXECUTED_MAIN_FAILURE`, `CI_EXECUTED_BRANCH_FAILURE` are not part of this contract's canonical vocabulary and must not be re-introduced.
- Commands: `npm test`, `npm run test:db-engine:{tree-comments,trees-schema,generic-social-a-guard,generic-social-a,generic-social-b-guard,generic-social-b,migration-catalog-adapter}`, `npm run test:layers`, `npm run verify`.
- Registries: `tests/ci-test-group-registry.json` (`artifact_expectation_enum`, per-group `artifact_expectation`), `tests/ci-risk-gate-policy.json` (`execution_group_enum`), `tests/test-layer-classification.json`.
- Scripts: `scripts/report-ci-test-groups.cjs`, `scripts/plan-ci-risk-gates.cjs`, `scripts/report-test-layers.cjs`, `scripts/pre-deploy.cjs`, `scripts/capture-screenshots.cjs` (output under gitignored `docs/test-scenarios/`).
- Workflow: `.github/workflows/ci.yml` job names and commands (no `upload-artifact` today).

## 13. `UNRESOLVED_RUNTIME`

1. GitHub Actions platform persistence and the exact retention period for step logs (organization/repository settings, download window) are not provable from repository source — recorded as `UNRESOLVED_RUNTIME`/`MISSING_REQUIRED_EVIDENCE`; the contract asserts `CURRENTLY_EMITTED` only, and makes no runner-session-expiry claim.
2. Whether Playwright pageerror/console events in browser contracts ever capture values that would need sanitization beyond counts (depends on future capture code — `UNRESOLVED_RUNTIME`).
3. Whether a real ubuntu-vs-other platform comparison is achievable without a comparison lane (currently `MISSING_REQUIRED_EVIDENCE`).
4. DB-engine service failure classification in practice (service container startup vs test execution failure distinction is runner-observable).

## 14. One next implementation child (maximum)

Child 1 — **Sanitized failure-packet emitter + bounded upload** (U3 CI architecture):

- Exact boundary: add a repo-relative script `scripts/emit-ci-failure-packet.cjs` that, from the current TAP/step output of `npm test` and the DB-engine suites, writes the canonical JSON packet (§5) into a gitignored directory (e.g., `ci-failure-artifacts/`), applies §8 sanitization and §9 slug naming, computes §7 comparison fields when a pristine-main SHA is supplied, and emits only `SANITIZED_ALLOWED` content. Optionally add a single `upload-artifact` step in `.github/workflows/ci.yml` gated to failed runs with the packet + group-allowed sanitized files (bounded retention 30 days). Existing test files are not modified by this decision or by the child; the child may add exactly one new source-static packet contract (e.g., `tests/contracts/ci-failure-packet-contract.test.cjs`). Whether registry/classification registration is required for that contract is decided in the child's own exact scope, not by this document.
- Candidate files: `scripts/emit-ci-failure-packet.cjs` (new), `.github/workflows/ci.yml` (one conditional step — workflow change is the explicit scope of this child), `.gitignore` (one entry for the packet dir), and one new source-static packet contract `tests/contracts/ci-failure-packet-contract.test.cjs` (schema/sanitization/slug rules) — all `IMPLEMENTATION_REQUIRED_LATER`. Existing test files are not modified; the packet contract is additive and its registry/classification registration, if any, is decided in the child's exact scope.
- Browser verification: not required (no rendering); CI verification of the new step only.
- Non-overlap: no changes to test files, registry, classification, reporters' count logic, or any current CI behavior; the emitter is additive.

No second child is proposed.

## 15. Explicit non-actions

This decision does not authorize, and no worker may perform under this document:

```text
no workflow/package/script/test/registry/classification change
no browser/Playwright/screenshot/test execution
no upload-artifact or artifact upload of any kind in this child
no Production/Cloudflare/provider/DB/API/Auth action
no Ready/merge/Issue closure
no modification of PR #3780/#3783/#3787/#3789 or their worktrees
no reset/clean/stash/rebase/amend/force push
no recovery or deletion of old branches/worktrees
no Closes/Fixes/Resolves on #3670/#3673/#3672/#3425/#1882 (Refs only)
```

## 16. Rollback

- This record is additive (one new `docs/architecture/` file); rollback is branch deletion / revert of the single-file Draft PR with no CI behavior change.
- The future emitter child is rollback-safe per PR: it adds a script + one gated workflow step and its contract test atomically, and removing the step restores the current logs-only posture.

Refs #3791.
Refs #3670 — Keep OPEN.
Refs #3673 — parallel; Keep OPEN.
Refs #3672 — parallel; Keep OPEN.
Refs #3425 — Keep OPEN.
Refs #1882 — Keep OPEN.
