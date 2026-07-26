# Branching and Review

> **Role model:** `WEB_CTO_WEB_DEVELOPER_LOCAL_VALIDATION.md`
> **UI fast lane:** `UI_RAPID_ITERATION_LANE.md`
> **Governance:** `../ops/MVP_AGENT_GOVERNANCE.md`

## Core rules

- never edit or push directly to `main`;
- use a feature branch and PR;
- verify current remote state before writing;
- preserve other workers' branches, worktrees, stashes, and uncommitted state;
- one active writer per remote branch;
- verify exact head before squash merge.

## Branch assignment

The Web CTO may provide an exact existing branch or a proposed new branch. The Web Developer re-checks remote branches and open PRs before creating or reusing it.

For a new branch:

1. verify current `main` and related open work;
2. choose a descriptive unique branch;
3. record exact base SHA;
4. create the branch from that base;
5. do not reuse a merged PR source branch.

For an existing PR branch:

- verify exact remote head;
- do not create a parallel remote branch unless the contract requires it;
- do not push if another active writer owns the branch;
- use additive commits and fast-forward push only.

## UI micro branches

U0/U1 work should use small, disposable branches and PRs.

Examples:

```text
ui/copy-<surface>-<purpose>
ui/visual-<surface>-<purpose>
```

A new child Issue is not required for each micro branch. Reference the active product/UI objective when appropriate.

Do not combine unrelated visual requests merely to avoid creating PRs. Small related copy/visual adjustments on the same surface may be batched when they share one visual acceptance pass.

## PR state

Draft-by-default is advisory. A PR may be Draft or Ready according to the contract. Ready state is not final product approval and never replaces Web CTO exact-head review.

The Web Developer may create/update the PR but does not merge it. The Web CTO owns final merge judgment.

## Review depth by risk

### U0

Review:

- exact before/after copy;
- changed files;
- syntax/static safety;
- no behavior change;
- CI classification.

### U1

Review:

- affected selectors/tokens and values;
- page/shared scope;
- no DOM/runtime/visibility change;
- focused CSS/static evidence;
- CI classification.

### U2

Review structural DOM/layout/responsive/accessibility contracts and required browser evidence.

### U3 and backend/data/auth/security

Use the full architecture, runtime, regression, Local Validation, and evidence review required by the contract.

## Review outcomes

```text
READY
CONDITIONALLY_READY
NOT_READY
```

A report or test pass is evidence, not approval.

## Push and conflict handling

Before push:

- fetch remote;
- confirm remote branch head has not unexpectedly advanced;
- verify changed files and diff scope;
- do not force-push or rewrite shared history.

If the remote branch advanced, stop and reconcile explicitly. Do not overwrite another writer.

## Merge

- classify CI under canonical governance;
- confirm required evidence for the change class;
- re-read PR head immediately before merge;
- use expected-head squash merge;
- never use closing language for #1882; use `Refs #1882` only.

## Rapid correction after Production

For U0/U1 visual misses, create a new micro branch/PR from current `main`, apply the exact correction, run focused checks, merge safely, and re-check Production.

Do not force-push/reset `main`. Use a dedicated revert PR only when a small corrective PR is not safe.

Refs #3664.
Refs #3662.
Refs #1882 — Keep OPEN.
