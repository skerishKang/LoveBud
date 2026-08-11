# Web CTO, Web Developer, and Local Validation Operating Model

> **Status:** owner-approved operating model — Issue #3662
> **UI acceleration amendment:** Issue #3664
> **Hard-governance authority:** `../ops/MVP_AGENT_GOVERNANCE.md`
> **Test-execution authority:** `../ops/IMPACT_BASED_TEST_EXECUTION_POLICY.md`

## 1. Purpose

LoveBud uses stronger web models for product planning and implementation while reducing local-model work to tasks that actually require a full checkout, operating-system tools, local secrets, authenticated browser sessions, databases, providers, devices, or broad runtime evidence.

Independent review must remain real. The same conversation/context should not both implement a production change and give the final Web CTO approval for that change.

Low-risk UI changes use the risk-proportional process in `UI_RAPID_ITERATION_LANE.md` rather than the full backend-grade flow.

Test execution is impact-based. Focused developer checks prove the changed behavior, GitHub Actions is the normal repository-wide CI execution layer, and Local Validation is assigned only when a declared trigger requires evidence that focused Web checks plus CI cannot supply.

## 2. Roles and lifecycle

The three execution roles are:

```text
Web CTO
Web Developer
Local Validation
```

The normal lifecycle has four stages because the Web CTO participates before and after implementation.

```text
User request
→ Web CTO remote triage and contract
→ separate Web Developer implementation + focused checks
→ GitHub Actions relevant/full matrix
→ Local Validation only when trigger-qualified evidence is required
→ Web CTO independent final review
→ user decision / expected-head squash merge
```

Local Validation is conditional, not ceremonial. It is omitted when the change class and available evidence do not require a local environment.

## 3. Web CTO

The Web CTO owns:

- current remote-state verification;
- product objective and user-visible outcome;
- architecture and visual direction;
- explicit non-goals;
- allowed and forbidden paths;
- protected Issue wording;
- change-risk classification;
- affected-behavior and plausible-regression classification;
- acceptance criteria and required tests/evidence;
- final remote diff, CI, evidence, and merge judgment.

### Before implementation

The Web CTO must:

1. verify current `main`, related Issues/PRs, branches, comments, and CI;
2. classify the work, including `U0/U1/U2/U3` for UI changes;
3. define the exact outcome and behavior that must remain unchanged;
4. select focused tests based on affected behavior rather than file count;
5. state whether Local Validation is `REQUIRED`, `CONDITIONAL`, or `NOT_REQUIRED`;
6. when Local may be required, name the applicable trigger code from `IMPACT_BASED_TEST_EXECUTION_POLICY.md`;
7. define safe parallel boundaries.

Before spending a Local cycle, the Web CTO should use remote evidence to classify the work whenever possible:

```text
READY
CI_ONLY
NARROW_FIX
LOCAL_REQUIRED
IMPLEMENTATION_REQUIRED
BLOCKED_BY_DEPENDENCY
```

### During implementation

The Web CTO may clarify or explicitly revise the contract, inspect remote progress, stop overlap, or split scope. It must not silently lower acceptance criteria to match the implementation.

### Final review

The Web CTO independently checks:

- exact PR head, base, merge base, ahead/behind;
- changed files and cumulative remote diff;
- scope and non-goals;
- whether tests prove the affected behavior;
- CI classification;
- whether any Local Validation added distinct required evidence rather than duplicating already-green exact-head CI;
- Local Validation evidence when required and exact-head match;
- browser/auth/API/database evidence when required;
- security, privacy, cache, accessibility, and regression risk;
- PR body and Issue linkage;
- expected head immediately before squash merge.

Final judgment:

```text
READY
CONDITIONALLY_READY
NOT_READY
```

## 4. Web Developer

The Web Developer operates in a separate web conversation/context from the Web CTO and owns implementation, implementation tests, branch commits, PR maintenance, and CI-driven correction.

Responsibilities:

- re-verify the supplied baseline and current remote state;
- create or use the assigned feature branch;
- implement the smallest change satisfying the contract;
- write focused tests/contracts required by the change class;
- run the smallest sufficient developer checks for affected behavior;
- create additive commits;
- create or update the PR;
- inspect CI and correct executed code failures;
- report exact SHA, diff, tests, CI, and remaining evidence needs.

The Web Developer does not:

- make final product acceptance or merge decisions;
- close protected parent Issues;
- expand product, architecture, dependencies, data models, or APIs without approval;
- treat test or CI success as final CTO approval;
- run unrelated full local suites merely because source changed;
- force-push, destructively reset, clean, or delete another worktree without approval.

Direct GitHub implementation is the default when repository files are accessible and no full local authoring environment is required.

```text
exact baseline
→ feature branch
→ code and focused tests
→ additive commit
→ PR
→ GitHub CI inspection/correction
```

`main` is never edited directly.

## 5. Local Validation

Local Validation is an execution and evidence role, not the default coding, design, or repository-wide test runner.

Use it only when at least one declared trigger from `../ops/IMPACT_BASED_TEST_EXECUTION_POLICY.md` applies:

```text
L1_ENVIRONMENT_REQUIRED
L2_CI_FAILURE_REPRODUCTION
L3_CI_COVERAGE_GAP
L4_PRISTINE_MAIN_COMPARISON
L5_RUNTIME_BROWSER_REQUIRED
L6_BROAD_SHARED_REGRESSION
L7_CI_OR_TEST_INFRA_CHANGE
```

Typical reasons include:

- full-checkout test/build commands unavailable to Web;
- local secret usage without value exposure;
- actual database, Docker, provider CLI, GPU, device, or OS behavior;
- authenticated browser profile;
- runtime-sensitive desktop/mobile, console, network, or API evidence;
- exact reproduction of an executed GitHub CI failure;
- a CI/test discovery gap that leaves required behavior unexecuted;
- branch-only versus pristine-main failure classification;
- broad shared regression evidence that focused tests plus normal CI do not adequately prove;
- CI/test infrastructure changes whose execution machinery itself needs validation.

Responsibilities:

- check out the exact remote PR head in a dedicated worktree;
- preserve all existing worker state;
- execute only the assigned commands and flows;
- start from the smallest reproducer when debugging an executed failure;
- collect raw counts, logs, screenshots, and environment evidence;
- distinguish pristine-main failures from branch-only failures when required;
- return exact evidence without rewriting acceptance criteria.

If exact-head GitHub CI already passed the same lane, Local Validation must not rerun it solely for duplicate evidence. The handoff must state what additional Local evidence is required.

Local Validation normally does not redesign or broadly rewrite production source. A product-source defect returns to the Web Developer unless the contract authorizes a precise minimal change.

A local report includes:

```text
repository/worktree
local and remote branch
starting and tested head
Local trigger code(s)
status before/after
commands and counts
relevant raw failures/subtests
branch-only vs pristine-main classification when used
browser/auth/console/network state
checks intentionally not rerun and why
remaining untracked files
reset/stash/clean used: YES/NO
```

## 6. Execution modes

### Mode A — Direct GitHub implementation

Default for most repository work.

```text
Web CTO contract
→ Web Developer direct branch implementation + focused checks
→ GitHub CI
→ Local Validation only if trigger-qualified evidence is required
→ Web CTO final review
```

### Mode B — Patch package

Use when direct Web repository editing is unsuitable.

The Web Developer prepares:

```text
change-package/
├─ files/
├─ changes.patch
├─ MANIFEST.json
├─ APPLY.md
├─ TEST_PLAN.md
└─ REVIEW_NOTES.md
```

Local Validation applies the exact package and executes the test plan. It does not redesign the patch or expand the test plan without an evidence-based trigger.

### Mode C — Local-environment validation loop

Use for database/provider/OS/device/authenticated-browser dependencies or exact CI-failure reproduction.

```text
Web Developer implementation
→ Local Validation exact trigger-qualified execution
→ raw failure evidence
→ Web Developer correction
→ Local Validation reruns only newly affected evidence when still required
→ GitHub CI exact-head matrix
```

### Mode D — UI Rapid Iteration Lane

Use `UI_RAPID_ITERATION_LANE.md`.

```text
U0/U1:
Web CTO contract
→ Web Developer direct edit
→ focused checks
→ Web CTO final review and merge
→ Production visual confirmation

U2:
Web CTO design/prototype
→ Web Developer implementation
→ focused tests
→ conditional Local Validation
→ Web CTO final review

U3:
full relevant runtime path
→ Local only when the runtime/environment trigger applies
```

## 7. Independent-review safeguard

The Web CTO and Web Developer use separate conversations/contexts for the same production change.

The Web CTO reviews evidence, not the developer's private reasoning:

- exact head and commit list;
- changed files and diff;
- tests and counts;
- CI state;
- known limitations;
- Local Validation evidence when required.

A Web CTO may author prototypes, design references, exact copy, state contracts, or patch drafts. A separate Web Developer must implement or independently review production changes before final CTO approval.

## 8. UI and design work

The Web CTO owns product/visual direction. The Web Developer should not be asked to invent unspecified design.

The Web CTO may provide:

- standalone HTML/CSS/JS UI Lab prototypes;
- screenshots or visual references;
- exact DOM and CSS-token specifications;
- loading/loaded/empty/error state definitions;
- motion and responsive rules;
- exact copy.

Risk classification controls the process:

- U0/U1: Local skipped by default; Production is the fast final visual loop.
- U2: structural evidence and conditional browser/local validation.
- U3: full relevant runtime evidence, without unrelated full-suite duplication.

## 9. Parallel work

Parallel execution requires:

- separate branches;
- separate local worktrees when local work exists;
- non-overlapping file ownership or explicit responsibility boundaries;
- one active writer per remote branch;
- no simultaneous push from two computers to one branch;
- remote-head check before push;
- latest-main relationship check before merge.

Parallelize read-only remote forensic/review work aggressively when it shortens classification time. Multiple Web implementation or Local workers are useful only when branches and affected contracts are genuinely independent.

Shared tokens, global CSS, common components, shared JavaScript, test registries, package/CI infrastructure, database schema, auth/security boundaries, and other shared contracts require one active writer or serialized order unless explicitly partitioned.

Adding Local workers is not a substitute for reducing duplicate test execution.

## 10. Evidence and CI

Canonical CI states:

```text
CI_GREEN
CI_EXECUTED_FAILURE
CI_PENDING_EXECUTION
CI_UNAVAILABLE_INFRA
```

Browser evidence levels:

```text
LOCAL_EVIDENCE
PRE_MERGE_EVIDENCE
PRODUCTION_EVIDENCE
```

Preview/fixed-slot environments are evidence options, not permission gates. Merge-first Production verification is the current default unless the task explicitly requests pre-merge browser evidence.

Verification effort is risk-proportional and impact-based. Focused developer checks prove the changed behavior; GitHub Actions is the normal repository-wide CI execution authority; Local Validation provides only trigger-qualified additional evidence.

For an executed CI failure:

```text
exact failing step/subtest
→ smallest reproducer
→ branch-only / pristine-main / infrastructure classification
→ smallest corrective change when branch-caused
→ affected rerun
→ relevant exact-head CI
```

Do not repeatedly rerun broad suites until green. A passing rerun alone does not prove that a prior failure was a flake.

After merge-forward/current-main alignment, inspect incoming commits for path and semantic overlap. Rerun newly affected focused checks, then rely on exact-head GitHub CI for the normal matrix unless a Local trigger requires more evidence.

Reports separate:

- implemented versus already present;
- branch-only versus pristine-main failures;
- executed failure versus CI infrastructure unavailability;
- local, preview, and Production evidence;
- implementation complete versus merge candidate versus merged;
- merge versus Issue closure.

## 11. Handoff minimums

### Web CTO → Web Developer

```text
Repository
Issue/PR
exact base and target branch
objective and user-visible outcome
risk/UI class
affected behavior / blast radius
non-goals
allowed/forbidden paths
required implementation
focused tests
Local Validation requirement
Local trigger code(s), if applicable
acceptance criteria
protected Issues
stop conditions
report format
```

### Web Developer → Local Validation

Only when Local Validation is required:

```text
PR and exact head
remote branch
Local trigger code(s)
worktree instructions
exact commands/flows and expected results
why focused Web checks + GitHub CI are insufficient
browser/auth/viewports/flows when applicable
whether pristine-main comparison is required
required evidence
allowed local changes
forbidden destructive commands
stop condition
```

Do not hand off vague instructions such as `run everything`, `run all tests just in case`, or `fully verify` without naming the affected behavior and required lane.

### Web Developer → Web CTO when Local is not required

```text
exact head
changed files/diff
risk classification
affected behavior
focused checks
CI classification
Local Validation: NOT_REQUIRED with reason
remaining Production check
```

## 12. Governance boundary

This document allocates roles and evidence. It does not add or remove hard blockers beyond `MVP_AGENT_GOVERNANCE.md`.

The following remain authoritative:

- never expose secrets or private payloads;
- never destroy another worker's state;
- production-destructive actions require approval;
- do not merge on `CI_EXECUTED_FAILURE` or `CI_PENDING_EXECUTION`;
- use the documented alternative-evidence path for `CI_UNAVAILABLE_INFRA`;
- verify expected head, then squash merge;
- never close #1882 and use `Refs #1882` only.

Refs #3664.
Refs #3662.
Refs #1882 — Keep OPEN.
