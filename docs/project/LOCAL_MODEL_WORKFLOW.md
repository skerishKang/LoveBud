# Local Model Workflow

> **Default role:** Local Validation
> **Role model:** `WEB_CTO_WEB_DEVELOPER_LOCAL_VALIDATION.md`
> **Autonomous advanced/frontier exception:** `AUTONOMOUS_FRONTIER_IMPLEMENTATION_LANE.md`
> **UI fast lane:** `UI_RAPID_ITERATION_LANE.md`
> **Hard-governance precedence:** `../ops/MVP_AGENT_GOVERNANCE.md`

## Purpose

Ordinary local work is reserved for evidence that requires a full checkout or local environment. The ordinary `Local Validation` role is not the default production coder or UI designer.

This does **not** prohibit an explicitly designated advanced/frontier local implementation model from using the owner-approved autonomous implementation lane. Such a model may inspect the repository, select or create a bounded non-conflicting Issue, implement it, test it, open a Draft PR, and then bring the result to the Web CTO for independent verification. Lack of a prior CTO instruction is not itself a defect in that lane.

Keep the roles distinct:

```text
ORDINARY LOCAL VALIDATION
= assigned evidence / environment execution role

AUTONOMOUS ADVANCED/FRONTIER LOCAL IMPLEMENTER
= self-directed bounded feature-branch implementation role
  governed by AUTONOMOUS_FRONTIER_IMPLEMENTATION_LANE.md
```

## When Local Validation is used

Use Local Validation only when the Web CTO/Web Developer handoff marks it `REQUIRED` or when exact-head evidence needs:

- repository-wide commands unavailable to Web;
- actual database, Docker, provider, device, GPU, or OS behavior;
- local secret use without value exposure;
- authenticated browser profile;
- runtime-sensitive desktop/mobile, console, network, API, or persistence evidence;
- pristine-main comparison for broad regressions.

These trigger rules apply to the `Local Validation` role. They do not require an advanced/frontier implementation model to wait for a CTO handoff before beginning a safe, non-conflicting autonomous implementation under the dedicated frontier policy.

## When Local Validation is skipped

Local Validation is skipped by default for:

- U0 copy-only changes;
- U1 page-scoped visual-only changes;
- docs-only changes with no local contract need;
- changes fully evidenced by remote diff, focused checks, CI classification, and post-merge Production confirmation.

Do not create a local worktree or local prompt merely because an HTML/CSS file changed.

This skip rule means “do not add a redundant Local Validation cycle.” It does not invalidate a separately designated autonomous local implementation worker that is already acting as the implementation owner.

## Startup

### Ordinary Local Validation

1. Confirm the target PR, remote branch, and expected exact head.
2. `git fetch origin --prune`.
3. Inspect `git worktree list --porcelain` and `git status --short`.
4. Preserve dirty/staged/untracked/stash/worktree state.
5. Use a dedicated worktree at the exact PR head.
6. Report repository, worktree, branch, expected/actual head, base, and clean/dirty state.

### Autonomous advanced/frontier local implementation

Before writing:

1. fresh-query current remote `main`;
2. inspect relevant Issues, open PRs, active branches, and changed-file ownership;
3. check semantic-authority ownership, not only file overlap;
4. select an existing unowned Issue or create one bounded child Issue;
5. use a dedicated feature branch/worktree;
6. keep all implementation history additive;
7. create a Draft PR and report the exact result to the Web CTO for independent review.

Mandatory coordination remains:

```text
ONE WRITER PER BRANCH
ONE WRITER PER FILE
ONE WRITER PER SEMANTIC AUTHORITY
```

Forbidden without explicit approval:

```text
git reset --hard
git clean
git stash drop
force push
rebase published feature history
amend published feature history
existing worktree/branch deletion
secret value output
Ready transition
merge
Production/provider/config mutation
Production/real-user DB mutation
```

## Allowed work

### Ordinary Local Validation

- dependency installation;
- assigned lint/typecheck/build/test commands;
- database/Docker/local-service execution;
- Windows/PowerShell/provider/device checks;
- authenticated browser and responsive verification;
- console/network/API inspection;
- screenshots/videos/artifacts outside the repository;
- key/file presence checks without values;
- exact patch-package application;
- pristine-main comparison;
- raw failure reproduction.

Minimal source changes in the `Local Validation` role require explicit file-level authorization. Product-source defects normally return to the Web Developer.

### Autonomous advanced/frontier implementation

When the model is explicitly operating under `AUTONOMOUS_FRONTIER_IMPLEMENTATION_LANE.md`, it may additionally:

- identify a bounded useful implementation problem;
- create/select a non-conflicting Issue;
- author in-scope source/docs/tests;
- create additive commits and normal pushes;
- open and maintain a Draft PR;
- inspect and correct CI failures caused by its own change;
- report exact evidence for CTO verification.

Those implementation actions do not need retroactive CTO authorization merely because the model found the Issue first. They remain subject to collision, safety, external-state, Ready, merge, and protected-Issue gates.

## Risk-proportional UI handling

### U0/U1

Ordinary Local Validation receives no task by default.

If Local Validation is explicitly requested, execute only the named check. Do not expand a copy/visual micro-change into full-suite testing or broad browser QA without a revised contract.

An autonomous advanced/frontier implementation owner may still self-select a safe U0/U1/U2/U3 implementation if it satisfies its separate ownership and risk rules.

### U2

Run the structural/layout/browser checks explicitly assigned. Desktop/mobile evidence is required only for affected breakpoints/states, not automatically for every page.

### U3

Run the full relevant runtime/auth/API/cache/storage/browser evidence defined by the contract.

An autonomous implementation model handling U3 must still stop before separately gated Production/provider/secret/real-user mutations unless explicit authority exists.

## Test reporting

For each command report:

```text
command
exit status
pass/fail count
relevant raw error
exact tested SHA
```

When branch failures occur, compare with a pristine-main worktree when practical and report:

```text
pristine-main failures
branch failures
branch-only failures
```

Do not claim `branch-only failures = 0` without the compared SHA and command.

For autonomous implementation, also report:

```text
selected/created Issue
starting main SHA
branch/worktree
final head SHA
changed files
Draft PR
exact-head CI state
known collision/dependency/external gates
```

## Browser evidence

```text
LOCAL_EVIDENCE
PRE_MERGE_EVIDENCE
PRODUCTION_EVIDENCE
```

- Preview/fixed slot is optional evidence, not a permission gate.
- Do not search for preview URLs or deploy a fixed slot unless assigned or separately authorized by the applicable implementation contract.
- Merge-first Production verification remains the default final UI/Auth/runtime confirmation.
- Localhost limitations must be reported, not converted into an automatic blocker.

## Secret handling

Never print or persist credentials, tokens, cookies, sessions, private payloads, database URLs, or identifiers in chat, logs, screenshots, Issues, PRs, or commits.

Report only safe states such as:

```text
PRESENT
MISSING
EXISTS
GITIGNORED
LOGIN_PASS
LOGIN_FAIL
```

## Artifact hygiene

Store local screenshots, logs, reports, backups, and ZIPs outside the repository unless committed fixtures are explicitly required.

Task-owned untracked debris may be removed one file at a time after ownership confirmation. Never use `git clean`.

## Failure return

### Ordinary Local Validation

Return to the Web Developer:

```text
exact tested SHA
command
relevant raw error
reproduction steps
expected behavior
actual behavior
browser/auth/viewport state
console/network/API result
local source files modified: NONE or exact list
```

Do not turn a failed check into an unapproved broad rewrite.

### Autonomous advanced/frontier implementation

A self-directed worker may correct its own bounded implementation and CI failures on its own feature branch. It should stop and return to the Web CTO when:

- another writer/semantic authority is discovered;
- the safe fix requires scope expansion into a separate authority;
- product intent becomes ambiguous;
- Production/provider/secret/real-user mutation would be required;
- a dependency must merge first;
- the implementation should be preserved but integration sequencing is unclear.

## Final report

### Ordinary Local Validation report

```text
## Local Validation report

### Baseline
- repository/worktree:
- local/remote branch:
- expected/tested head:
- base/main:
- clean/dirty before:
- reset/stash/clean used:

### Commands
- command/result/count/error:

### Comparison
- pristine-main SHA/failures:
- branch failures:
- branch-only failures:

### Browser/environment
- evidence level:
- URL/auth/viewports/flows:
- console/network/API/database/provider/OS:
- screenshots/artifacts:

### Repository state
- git diff --check:
- git status --short:
- remaining untracked:
- source files modified locally:

### Unverified
- item/reason:

### Final status
LOCAL_VALIDATION_PASS / LOCAL_VALIDATION_FAIL / LOCAL_VALIDATION_PARTIAL
```

### Autonomous advanced/frontier implementation report

```text
## Autonomous implementation report

problem / selected-or-created Issue
starting main SHA
branch/worktree
final head SHA
changed files
implemented behavior
focused tests + regression tests
exact-head CI
Draft PR
known limitations / dependencies
external/Production/provider/DB mutation = NONE or exact separately-authorized action
Ready = NO unless separately delegated
Merge = NO unless separately delegated
```

The Web CTO then independently verifies and classifies the implementation under `AUTONOMOUS_FRONTIER_IMPLEMENTATION_LANE.md`.

## Related documents

- [WEB_CTO_WEB_DEVELOPER_LOCAL_VALIDATION.md](./WEB_CTO_WEB_DEVELOPER_LOCAL_VALIDATION.md)
- [AUTONOMOUS_FRONTIER_IMPLEMENTATION_LANE.md](./AUTONOMOUS_FRONTIER_IMPLEMENTATION_LANE.md)
- [UI_RAPID_ITERATION_LANE.md](./UI_RAPID_ITERATION_LANE.md)
- [ROLE_SESSION_TEMPLATES.md](./ROLE_SESSION_TEMPLATES.md)
- [VERIFICATION_AND_EVIDENCE.md](./VERIFICATION_AND_EVIDENCE.md)
- [../ops/MVP_AGENT_GOVERNANCE.md](../ops/MVP_AGENT_GOVERNANCE.md)

Refs #3664.
Refs #3662.
Refs #1882 — Keep OPEN.