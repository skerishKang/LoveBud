# Web CTO, Web Developer, and Local Validation Operating Model

> **Status:** owner-approved operating model — Issue #3662  
> **Governance precedence:** `docs/ops/MVP_AGENT_GOVERNANCE.md` remains the canonical source of truth for hard blockers, CI classification, browser permission, and merge governance.

## 1. Purpose

This document defines LoveBud's default execution model for repository work.

The objective is to use the stronger web model for planning and implementation while reducing local-model work to the tasks that require a full checkout, operating-system tools, local secrets, actual authenticated sessions, databases, browsers, or device/runtime access.

The model must preserve independent review. The same conversation/context should not both implement a production change and give the final CTO approval for that change.

## 2. Default role set

LoveBud uses three execution roles.

```text
Web CTO
Web Developer
Local Validation
```

The lifecycle contains four stages because the Web CTO participates at both the beginning and the end.

```text
User request
→ Web CTO contract
→ Web Developer implementation
→ Local Validation evidence
→ Web CTO independent final review
→ user product decision / expected-head squash merge
```

The existing documentation, UI, and feature workstream labels may still be used to classify work. They do not create additional executor roles.

## 3. Web CTO

The Web CTO owns product scope, architecture, design direction, acceptance criteria, evidence requirements, final remote review, and merge judgment.

### Before implementation

The Web CTO must:

- verify the current remote `main` SHA;
- inspect relevant open Issues, PRs, branches, comments, and previous evidence;
- define the objective and user-visible outcome;
- define explicit non-goals;
- fix the allowed and forbidden file scopes;
- identify protected Issues and required reference wording;
- specify expected implementation shape when useful;
- define tests before implementation;
- define local/browser evidence required after implementation;
- identify whether work may run in parallel with another task.

### During implementation

The Web CTO may:

- answer product or contract questions;
- amend the work contract explicitly;
- inspect remote progress without rewriting the implementation;
- stop overlapping or out-of-scope work;
- split work into smaller children when evidence shows the scope is too large.

The Web CTO should not silently lower acceptance criteria to match the implementation that was produced.

### Final review

After implementation and local evidence, the Web CTO must independently re-check:

- exact PR head SHA;
- base and merge-base relationship;
- changed files and additions/deletions;
- actual remote diff rather than the developer summary;
- allowed/forbidden scope;
- tests and whether they prove externally meaningful behavior;
- CI state using the canonical classification;
- local evidence and whether it was produced from the exact PR head;
- browser, auth, console, network, API, or database evidence where applicable;
- security, privacy, cache, and regression risks;
- PR body and Issue linkage;
- expected-head SHA immediately before squash merge.

The final judgment is one of:

```text
READY
CONDITIONALLY_READY
NOT_READY
```

## 4. Web Developer

The Web Developer operates in a separate web conversation/context from the Web CTO.

The Web Developer owns implementation, implementation tests, Draft PR maintenance, and CI-driven correction.

### Responsibilities

- re-verify the repository and exact baseline supplied by the CTO;
- create or use the assigned feature branch;
- read the latest relevant source files;
- implement code, tests, contracts, and required documentation;
- preserve existing architecture and public surfaces unless the contract authorizes a change;
- create additive commits;
- create or update a Draft PR;
- inspect CI and correct executed code failures;
- report exact SHA, diff, tests, CI, and known limitations;
- stop and report when the allowed scope is insufficient.

### Restrictions

The Web Developer does not:

- make the final product decision;
- merge the PR unless the Web CTO explicitly returns with approval;
- close protected parent Issues;
- redesign the product outside the CTO contract;
- broaden architecture, dependencies, data models, or API contracts without explicit approval;
- treat a local or CI pass as final CTO approval;
- use force push, destructive reset, cleanup, or worktree deletion without explicit authorization.

### Direct GitHub implementation

Direct GitHub implementation is the default when:

- the repository and exact files are accessible;
- the change is reviewable through branch commits and a PR;
- CI can provide useful evidence;
- no full local environment is required to author the change.

The Web Developer should use:

```text
exact baseline SHA
→ feature branch
→ code and tests
→ additive commit(s)
→ Draft PR
→ CI inspection and correction
```

`main` must not be edited directly.

## 5. Local Validation

Local Validation is an execution and evidence role, not the default design or coding role.

### Responsibilities

- check out the exact remote PR head in a dedicated branch/worktree;
- preserve existing dirty, staged, untracked, stash, branch, and worktree state;
- install dependencies when required;
- run the exact focused and regression commands defined by the contract;
- run build, typecheck, lint, database, Docker, provider, or OS-dependent commands;
- verify actual browser behavior, authenticated sessions, responsive layouts, console, network, and API results;
- collect raw logs, test counts, screenshots, videos, or artifacts outside the repository when appropriate;
- compare branch failures with pristine-main failures;
- return exact evidence without rewriting the success criteria.

### Source-code changes

Local Validation should not independently redesign or broadly rewrite production source.

The following minimal changes may be authorized explicitly:

- local path corrections;
- environment or port wiring;
- OS-specific command adjustment;
- a narrowly specified repository integration change;
- application of an exact patch package supplied by the Web Developer.

When a product-source fix is needed, Local Validation normally returns the failure evidence to the Web Developer.

### Required baseline evidence

A local report should include:

```text
repository path
worktree path
local branch
remote branch
starting HEAD
final tested HEAD
git status --short before and after
commands executed
test/build summaries
raw relevant failure logs
browser viewport and auth state
console/network result
remaining untracked files
reset/stash/clean used: YES/NO
```

A statement such as “all tests passed” is not sufficient without the command and count evidence.

## 6. Execution modes

### Mode A — Direct GitHub implementation

This is the default.

```text
Web CTO contract
→ Web Developer direct branch implementation
→ Draft PR and GitHub CI
→ Local Validation when environment evidence is required
→ Web CTO final review
```

### Mode B — Patch package

Use this when direct repository editing is unsuitable or a full local checkout is needed for safe application.

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

`MANIFEST.json` should contain:

- repository;
- exact base commit;
- target branch;
- allowed paths;
- changed-file list;
- file hashes when useful.

Local Validation applies the package, runs the defined commands, and returns the evidence. It does not redesign the patch.

### Mode C — Local-environment validation loop

Use this for work depending on:

- local secrets;
- actual databases;
- Docker or native services;
- Windows/PowerShell-specific behavior;
- local AI models, GPU, drivers, or devices;
- authenticated browser profiles;
- provider CLIs or dashboards.

The loop is:

```text
Web Developer implementation
→ Local Validation execution
→ raw failure evidence
→ Web Developer correction
→ Local Validation re-execution
```

## 7. Independent-review safeguard

The Web CTO and Web Developer should use separate conversations/contexts for the same production change.

Only result evidence needs to return to the Web CTO:

- branch and exact head;
- commit list;
- changed files and diff summary;
- tests executed and counts;
- CI state and job evidence;
- known limitations;
- local validation evidence.

The Web CTO does not need the developer's private reasoning. The final review is based on repository evidence and the pre-fixed contract.

If the Web CTO directly authors a prototype, patch draft, design asset, or reference implementation, that artifact must still be implemented or independently reviewed in the Web Developer context before final CTO approval.

## 8. UI and design work

For UI work, the Web CTO owns the product and visual contract before implementation.

Recommended sequence:

```text
Web CTO design / prototype
→ user visual direction approval
→ Web Developer production implementation
→ Local Validation desktop/mobile/auth/browser evidence
→ Web CTO remote and production review
```

The Web CTO may prepare:

- standalone HTML/CSS/JS prototypes;
- target screenshots or visual references;
- DOM and CSS-token specifications;
- state diagrams;
- loading, empty, error, and success-state definitions;
- motion values and responsive behavior;
- exact copy.

The Web Developer should not be asked to invent an unspecified visual direction.

## 9. Parallel work

Parallel execution is allowed when the split is explicit and safe.

Required conditions:

- separate branches;
- separate worktrees for local work;
- no overlapping file ownership, or an explicit responsibility boundary;
- one active writer per remote branch;
- no simultaneous push from two computers to the same remote branch;
- remote-head re-check immediately before push;
- latest-main relationship re-check before merge.

Example:

```text
Computer 1 / DB PR
scripts/**
docs/architecture/**
DB contract tests

Computer 2 / Loading UI PR
pages/**
css/**
js/search/**
js/my-trees/**
js/editor/**
UI contract tests
```

If the same file must be changed by two tasks, serialize the work or define an explicit dependency order.

## 10. Evidence and CI

Use the canonical CI labels:

```text
CI_GREEN
CI_EXECUTED_FAILURE
CI_PENDING_EXECUTION
CI_UNAVAILABLE_INFRA
```

Browser evidence levels are:

```text
LOCAL_EVIDENCE
PRE_MERGE_EVIDENCE
PRODUCTION_EVIDENCE
```

A preview or fixed slot is evidence, not a permission gate. Its absence is not an automatic blocker. Merge-first Production verification remains the current default for UI/Auth/runtime final visual acceptance unless a task explicitly assigns pre-merge browser evidence.

Local and web reports must separate:

- implemented versus already present;
- branch-only failures versus pristine-main failures;
- executed test failure versus CI infrastructure unavailability;
- local/static evidence versus preview evidence versus Production evidence;
- implementation complete versus merge candidate versus merged;
- merged versus Issue closure disposition.

## 11. Handoff artifacts

### Web CTO → Web Developer

Required fields:

```text
Repository
Issue / PR
Base branch
Exact base SHA
Target branch
Objective
User-visible outcome
Non-goals
Allowed paths
Forbidden paths
Required implementation
Required tests
Required local evidence
Acceptance criteria
Protected Issues
Stop conditions
Final report format
```

### Web Developer → Local Validation

Required fields:

```text
PR number
Remote branch
Exact head SHA
Worktree instructions
Commands to execute
Expected pass/fail behavior
Browser URLs or route targets
Auth requirements
Viewport requirements
Evidence to collect
Files local validation may change, if any
Forbidden cleanup/destructive commands
```

### Local Validation → Web CTO

Required fields:

```text
Exact tested SHA
Clean/dirty state
Commands and counts
Pristine comparison
Browser/auth/console/network evidence
Screenshots/artifact references
Unverified areas
Environment-only limitations
```

## 12. Governance boundary

This operating model allocates roles and evidence flow. It does not add new hard blockers beyond `docs/ops/MVP_AGENT_GOVERNANCE.md`.

The following remain authoritative:

- never expose secrets or private payloads;
- never destroy another worker's state;
- production-destructive actions require approval;
- do not merge on `CI_EXECUTED_FAILURE` or `CI_PENDING_EXECUTION`;
- use the documented alternative-evidence path for `CI_UNAVAILABLE_INFRA`;
- verify expected head, then squash merge;
- never close #1882 and use `Refs #1882` only.

Refs #3662.  
Refs #1882 — Keep OPEN.
