# Web CTO, Web Developer, and Local Validation Operating Model

> **Status:** owner-approved operating model — Issue #3662
> **UI acceleration amendment:** Issue #3664
> **Hard-governance authority:** `../ops/MVP_AGENT_GOVERNANCE.md`

## 1. Purpose

LoveBud uses stronger web models for product planning and implementation while reducing local-model work to tasks that actually require a full checkout, operating-system tools, local secrets, authenticated browser sessions, databases, providers, devices, or broad runtime evidence.

Independent review must remain real. The same conversation/context should not both implement a production change and give the final Web CTO approval for that change.

Low-risk UI changes use the risk-proportional process in `UI_RAPID_ITERATION_LANE.md` rather than the full backend-grade flow.

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
→ Web CTO contract
→ separate Web Developer implementation
→ Local Validation when required
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
- acceptance criteria and required tests/evidence;
- final remote diff, CI, evidence, and merge judgment.

### Before implementation

The Web CTO must:

1. verify current `main`, related Issues/PRs, branches, comments, and CI;
2. classify the work, including `U0/U1/U2/U3` for UI changes;
3. define the exact outcome and behavior that must remain unchanged;
4. select focused tests based on affected behavior rather than file count;
5. state whether Local Validation is `REQUIRED`, `CONDITIONAL`, or `NOT_REQUIRED`;
6. define safe parallel boundaries.

### During implementation

The Web CTO may clarify or explicitly revise the contract, inspect remote progress, stop overlap, or split scope. It must not silently lower acceptance criteria to match the implementation.

### Final review

The Web CTO independently checks:

- exact PR head, base, merge base, ahead/behind;
- changed files and cumulative remote diff;
- scope and non-goals;
- whether tests prove the affected behavior;
- CI classification;
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
- create additive commits;
- create or update the PR;
- inspect CI and correct executed code failures;
- report exact SHA, diff, tests, CI, and remaining evidence needs.

The Web Developer does not:

- make final product acceptance or merge decisions;
- close protected parent Issues;
- expand product, architecture, dependencies, data models, or APIs without approval;
- treat test or CI success as final CTO approval;
- force-push, destructively reset, clean, or delete another worktree without approval.

Direct GitHub implementation is the default when repository files are accessible and no full local authoring environment is required.

```text
exact baseline
→ feature branch
→ code and focused tests
→ additive commit
→ PR
→ CI inspection/correction
```

`main` is never edited directly.

## 5. Local Validation

Local Validation is an execution and evidence role, not the default coding or design role.

Use it when the work requires one or more of:

- full-checkout test/build commands unavailable to Web;
- local secret usage without value exposure;
- actual database, Docker, provider CLI, GPU, device, or OS behavior;
- authenticated browser profile;
- runtime-sensitive desktop/mobile, console, network, or API evidence;
- broad regression comparison against pristine `main`.

Responsibilities:

- check out the exact remote PR head in a dedicated worktree;
- preserve all existing worker state;
- execute only the assigned commands and flows;
- collect raw counts, logs, screenshots, and environment evidence;
- distinguish pristine-main failures from branch-only failures;
- return exact evidence without rewriting acceptance criteria.

Local Validation normally does not redesign or broadly rewrite production source. A product-source defect returns to the Web Developer unless the contract authorizes a precise minimal change.

A local report includes:

```text
repository/worktree
local and remote branch
starting and tested head
status before/after
commands and counts
relevant raw failures
browser/auth/console/network state
remaining untracked files
reset/stash/clean used: YES/NO
```

## 6. Execution modes

### Mode A — Direct GitHub implementation

Default for most repository work.

```text
Web CTO contract
→ Web Developer direct branch implementation
→ CI
→ Local Validation only if required by the contract
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

Local Validation applies the exact package and executes the test plan. It does not redesign the patch.

### Mode C — Local-environment validation loop

Use for database/provider/OS/device/authenticated-browser dependencies.

```text
Web Developer implementation
→ Local Validation execution
→ raw failure evidence
→ Web Developer correction
→ Local Validation re-execution
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
full Mode A/C runtime path
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
- U3: full runtime evidence.

## 9. Parallel work

Parallel execution requires:

- separate branches;
- separate local worktrees when local work exists;
- non-overlapping file ownership or explicit responsibility boundaries;
- one active writer per remote branch;
- no simultaneous push from two computers to one branch;
- remote-head check before push;
- latest-main relationship check before merge.

Shared tokens, global CSS, common components, and shared JavaScript require one active writer or serialized order.

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

Verification effort is risk-proportional. U0/U1 do not require unrelated full-suite tests or Local Validation merely because an HTML/CSS file changed. U2/U3 use the focused and regression evidence appropriate to their actual behavior.

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
non-goals
allowed/forbidden paths
required implementation
focused tests
Local Validation requirement
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
worktree instructions
commands and expected results
browser/auth/viewports/flows
required evidence
allowed local changes
forbidden destructive commands
```

### Web Developer → Web CTO when Local is not required

```text
exact head
changed files/diff
risk classification
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
