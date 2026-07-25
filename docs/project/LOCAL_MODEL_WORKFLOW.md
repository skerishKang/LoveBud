# Local Model Workflow

> **Default role:** Local Validation  
> **Role model:** `WEB_CTO_WEB_DEVELOPER_LOCAL_VALIDATION.md`  
> **UI fast lane:** `UI_RAPID_ITERATION_LANE.md`  
> **Hard-governance precedence:** `../ops/MVP_AGENT_GOVERNANCE.md`

## Purpose

Local work is reserved for evidence that requires a full checkout or local environment. The local model is not the default production coder or UI designer.

## When Local Validation is used

Use Local Validation only when the Web CTO/Web Developer handoff marks it `REQUIRED` or when exact-head evidence needs:

- repository-wide commands unavailable to Web;
- actual database, Docker, provider, device, GPU, or OS behavior;
- local secret use without value exposure;
- authenticated browser profile;
- runtime-sensitive desktop/mobile, console, network, API, or persistence evidence;
- pristine-main comparison for broad regressions.

## When Local Validation is skipped

Local Validation is skipped by default for:

- U0 copy-only changes;
- U1 page-scoped visual-only changes;
- docs-only changes with no local contract need;
- changes fully evidenced by remote diff, focused checks, CI classification, and post-merge Production confirmation.

Do not create a local worktree or local prompt merely because an HTML/CSS file changed.

## Startup

1. Confirm the target PR, remote branch, and expected exact head.
2. `git fetch origin --prune`.
3. Inspect `git worktree list --porcelain` and `git status --short`.
4. Preserve dirty/staged/untracked/stash/worktree state.
5. Use a dedicated worktree at the exact PR head.
6. Report repository, worktree, branch, expected/actual head, base, and clean/dirty state.

Forbidden without explicit approval:

```text
git reset --hard
git clean
git stash drop
force push
existing worktree/branch deletion
secret value output
```

## Allowed work

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

Minimal source changes require explicit file-level authorization. Product-source defects normally return to the Web Developer.

## Risk-proportional UI handling

### U0/U1

Local receives no task by default.

If Local is explicitly requested, execute only the named check. Do not expand a copy/visual micro-change into full-suite testing or broad browser QA without a revised contract.

### U2

Run the structural/layout/browser checks explicitly assigned. Desktop/mobile evidence is required only for affected breakpoints/states, not automatically for every page.

### U3

Run the full relevant runtime/auth/API/cache/storage/browser evidence defined by the contract.

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

## Browser evidence

```text
LOCAL_EVIDENCE
PRE_MERGE_EVIDENCE
PRODUCTION_EVIDENCE
```

- Preview/fixed slot is optional evidence, not a permission gate.
- Do not search for preview URLs or deploy a fixed slot unless assigned.
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

## Final report

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

## Related documents

- [WEB_CTO_WEB_DEVELOPER_LOCAL_VALIDATION.md](./WEB_CTO_WEB_DEVELOPER_LOCAL_VALIDATION.md)
- [UI_RAPID_ITERATION_LANE.md](./UI_RAPID_ITERATION_LANE.md)
- [ROLE_SESSION_TEMPLATES.md](./ROLE_SESSION_TEMPLATES.md)
- [VERIFICATION_AND_EVIDENCE.md](./VERIFICATION_AND_EVIDENCE.md)
- [../ops/MVP_AGENT_GOVERNANCE.md](../ops/MVP_AGENT_GOVERNANCE.md)

Refs #3664.  
Refs #3662.  
Refs #1882 — Keep OPEN.
