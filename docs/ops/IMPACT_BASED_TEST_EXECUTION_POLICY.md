# Impact-Based Test Execution Policy

> **Status:** current operating policy for test selection and Local Validation execution
> **Hard governance:** `MVP_AGENT_GOVERNANCE.md`
> **Role model:** `../project/WEB_CTO_WEB_DEVELOPER_LOCAL_VALIDATION.md`
> **PR checklist:** `PR_CHECKLIST.md`

## 1. Purpose

LoveBud treats local execution time as a scarce validation resource. The default is not to reproduce the entire GitHub Actions matrix on every developer machine or Local Validation worktree.

The goal is to prove the affected behavior with the smallest sufficient evidence, then use GitHub Actions as the canonical repository-wide CI execution layer.

```text
remote triage
→ exact diff and affected-behavior classification
→ focused developer checks
→ GitHub CI
→ Local Validation only for a declared trigger
→ Web CTO exact-head review
```

This policy reduces duplicate test execution. It does not weaken security, privacy, persistence, database, auth, or runtime acceptance criteria.

## 2. Test authority layers

Use three layers.

### Layer A — Focused developer checks

Run the smallest checks that directly prove the changed behavior before or immediately after push.

Examples:

```text
syntax/parser check
focused unit or contract test
changed-module test
page-specific static/CSS check
relevant typecheck/lint/build slice
git diff --check
```

A focused check must be selected because it covers a plausible regression from the diff, not because it is fast.

### Layer B — GitHub Actions CI

GitHub Actions is the normal authority for repository-wide and shared CI lanes.

If the exact PR head already executed the relevant CI lane successfully, do not repeat the same lane locally merely to duplicate evidence.

Use canonical CI classification:

```text
CI_GREEN
CI_EXECUTED_FAILURE
CI_PENDING_EXECUTION
CI_UNAVAILABLE_INFRA
```

An executed relevant failure remains a merge blocker. `CI_UNAVAILABLE_INFRA` uses the documented alternative-evidence path.

### Layer C — Local Validation

Local Validation is used only when the evidence cannot be obtained efficiently or correctly from focused Web checks plus GitHub CI.

Local work must have a declared trigger before it begins.

## 3. Local Validation trigger codes

Every handoff to Local Validation must name at least one trigger.

```text
L1_ENVIRONMENT_REQUIRED
L2_CI_FAILURE_REPRODUCTION
L3_CI_COVERAGE_GAP
L4_PRISTINE_MAIN_COMPARISON
L5_RUNTIME_BROWSER_REQUIRED
L6_BROAD_SHARED_REGRESSION
L7_CI_OR_TEST_INFRA_CHANGE
```

### L1_ENVIRONMENT_REQUIRED

Use when the test requires a full checkout, database, Docker, provider CLI, local secret without exposure, OS-specific behavior, device, GPU, or equivalent environment.

### L2_CI_FAILURE_REPRODUCTION

Use when an executed GitHub CI failure needs local reproduction, isolation, or debugging.

Local work starts from the exact failing head and the exact failing lane. Do not begin by running every suite.

### L3_CI_COVERAGE_GAP

Use when required behavior is not executed by the current GitHub CI registry or workflow.

Examples include a relevant test file omitted by a CI glob or a runtime path not represented in the matrix.

### L4_PRISTINE_MAIN_COMPARISON

Use when a failure may be pre-existing and branch-only versus pristine-main evidence is required.

Run the same minimal reproducer on the PR head and a clean current-main worktree. Do not use a broad full-suite comparison unless the failure cannot be isolated more narrowly.

### L5_RUNTIME_BROWSER_REQUIRED

Use for authenticated browser profiles, console/network evidence, browser-only APIs, runtime-sensitive responsive behavior, or user journeys that cannot be proven statically.

### L6_BROAD_SHARED_REGRESSION

Use when the changed source has genuinely broad blast radius and focused tests plus CI do not adequately cover plausible regressions.

Examples may include shared request boundaries, global runtime orchestration, common persistence/auth primitives, or widely reused infrastructure.

This trigger must identify the shared contract and the broader lane that covers it. File count alone is not sufficient.

### L7_CI_OR_TEST_INFRA_CHANGE

Use when the change itself modifies test discovery, CI workflows, package scripts, test harnesses, build orchestration, runtime matrices, or related infrastructure.

Because the execution machinery changed, broader local verification may be warranted before relying on that machinery.

## 4. No universal local full-suite rule

Do not run the full local suite by default.

A full or near-full local regression run is appropriate only when one or more of these are true:

- `L7_CI_OR_TEST_INFRA_CHANGE` applies;
- the change affects a broad shared runtime contract and the Web CTO explicitly selects the broader lane;
- the exact CI failure cannot be isolated with a narrower reproducer;
- GitHub CI is unavailable and the alternative-evidence policy requires broad local proof;
- an explicit task contract requires the full run for a stated risk reason.

The following are not sufficient reasons by themselves:

- a PR exists;
- source code changed;
- more than one file changed;
- Local Validation is already open;
- a previous unrelated PR used the full suite;
- a merge-forward happened without relevant overlap.

## 5. Exact-head and duplicate-execution rule

For every test result, record the tested head.

If exact-head GitHub CI has already passed a lane, Local Validation must not rerun that same lane unless a declared Local trigger explains what additional evidence the rerun provides.

If Local Validation already passed a lane and a later commit changes unrelated files, do not blindly rerun the lane. Re-evaluate the new commit's affected behavior first.

```text
new commit
→ inspect exact delta
→ determine affected behavior
→ rerun only newly affected checks
→ rely on exact-head CI for the normal full matrix
```

## 6. Merge-forward and current-main alignment

A merge-forward does not automatically require every previous local test to be repeated.

After aligning with current `main`:

1. inspect incoming commits and file overlap;
2. identify semantic overlap, not only path overlap;
3. run focused checks for behavior touched by the alignment;
4. let GitHub CI execute the normal matrix on the new exact head;
5. escalate locally only if one of the Local trigger codes applies.

If product source is unchanged by the merge-forward and there is no semantic overlap, previous local evidence may remain useful as historical evidence, while exact-head GitHub CI supplies the current-head gate.

## 7. CI failure handling

Do not respond to a red job with repeated broad reruns until it turns green.

Use:

```text
executed failure
→ identify exact failing step/subtest
→ determine branch-only vs pre-existing vs infrastructure
→ build the smallest reproducer
→ fix only if branch-caused
→ rerun the affected check
→ run relevant exact-head CI
```

For a suspected flake:

- preserve the exact failure name and logs;
- rerun the smallest affected lane once when useful;
- if classification still matters, compare the same reproducer with pristine current `main`;
- do not classify a failure as a flake merely because a rerun passed;
- record the isolation evidence in the PR/report.

## 8. Web CTO remote-first triage

Before assigning Local Validation, the Web CTO should classify open work remotely whenever possible.

Recommended statuses:

```text
READY
CI_ONLY
NARROW_FIX
LOCAL_REQUIRED
IMPLEMENTATION_REQUIRED
BLOCKED_BY_DEPENDENCY
```

Remote triage should inspect:

- current `main`;
- exact PR head and base;
- changed files and cumulative diff;
- CI state and exact failing lane;
- review findings;
- overlap with other active PRs;
- whether the requested evidence is already present.

The purpose is to avoid spending a full Local cycle to discover that no local work was required.

## 9. Parallel execution policy

Parallelism is most valuable for read-only analysis and independent, non-overlapping implementation.

Default model:

```text
1 Web CTO coordinator
+ multiple read-only remote forensic/review workers when useful
+ 1 active writer per remote branch
+ Local Validation only for trigger-qualified work
```

Two Local or implementation workers may run in parallel only when their branches and affected contracts are independent. Shared global CSS, common modules, test registries, package/CI infrastructure, database schema, auth/security boundaries, and other shared contracts should be serialized or explicitly partitioned.

Adding workers is not a substitute for reducing duplicate validation.

## 10. Local handoff contract

A Local Validation handoff must include:

```text
PR and exact head
Local trigger code(s)
exact commands or flows
why GitHub CI/focused Web evidence is insufficient
expected result
allowed file changes, if any
whether pristine-main comparison is required
stop condition
report fields
```

Avoid instructions such as `run everything`, `run all tests just in case`, or `fully verify` without naming the affected behavior and required lane.

## 11. Report minimums

A local report includes:

```text
starting/tested head
Local trigger code(s)
commands and exact counts
relevant failure/subtest names
branch-only vs pristine-main classification when used
files changed locally, if any
which checks were intentionally not rerun and why
remaining CI/evidence dependency
```

A Web CTO final report distinguishes:

- focused developer evidence;
- exact-head GitHub CI evidence;
- Local Validation evidence;
- pre-existing or flaky failures;
- remaining Production verification.

## 12. Safety and precedence

This document changes test-execution defaults, not hard safety governance.

It does not permit merge on `CI_EXECUTED_FAILURE` or `CI_PENDING_EXECUTION`, weaken protected Issue rules, expose secrets, destroy another worker's state, or bypass required security/privacy/database evidence.

Where historical documents prescribe universal local full-suite execution, this policy and the canonical governance/role documents supersede that default unless the historical document is explicitly invoked for its named technical scope.

Refs #3664.
Refs #3662.
Refs #1882 — Keep OPEN.
