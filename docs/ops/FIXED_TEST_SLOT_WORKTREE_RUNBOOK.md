# Fixed Test Slot Worktree Runbook

This runbook standardizes how LoveBud fixed test slots are assigned, deployed, and verified.

It exists to prevent shared working-directory churn, accidental branch overwrites, and ambiguous verification provenance when using fixed Cloudflare Pages test slots such as `test1`, `test2`, and `test3`.

## Purpose

Fixed test slot branches are verification branches. They are not feature branches and they are not general development branches.

Use this runbook when a PR needs browser, visual, runtime, Auth/API, Editor, Browse/Search, My Trees, Detail, or mobile smoke verification on a fixed slot.

This runbook clarifies:

- how a CTO/coordinator assigns a test slot;
- how to keep a slot dedicated to one PR at a time;
- how to use a slot-specific worktree instead of the main working directory;
- why `Updating files: 100%` is checkout/update progress, not a deletion prompt;
- when `git push --force-with-lease origin testN` is allowed;
- what must be reported as SHA provenance and verification evidence.

## Slot assignment rule

A fixed test slot must be explicitly assigned before deployment.

Required assignment fields:

| Field | Required value |
|---|---|
| Assigned slot | `test1` through `test10` |
| Slot URL | `https://testN.lovebud.pages.dev` |
| Target PR | PR number or branch purpose |
| Target branch | Feature/review branch to deploy |
| Expected head SHA | Commit SHA that must be deployed |
| Slot owner | Model/workstation currently verifying |
| Verification scope | Pages and flows to test |

Rules:

- One fixed test slot is assigned to one PR only until verification is complete.
- Do not mix multiple PRs in one slot.
- Do not reuse an assigned slot without a handoff or release note.
- Do not deploy from production URL for pre-merge PR verification.
- Do not report secrets, cookies, session values, localStorage values, tokens, SSH keys, or browser storage values.

Example assignment:

```text
Assigned slot: test3
Slot URL: https://test3.lovebud.pages.dev
Target branch: feat/editor-memory-mode-css-relocation
Expected head SHA: e5dc28a...
Verification scope: Editor memory mode visual smoke, mobile 375px, console check
```

## Worktree rule

Use a dedicated worktree per fixed test slot whenever possible.

Recommended local structure:

```text
LoveBud/          # normal development/review worktree
LoveBud-test1/    # test1 slot deployment worktree
LoveBud-test2/    # test2 slot deployment worktree
LoveBud-test3/    # test3 slot deployment worktree
```

Rules:

- Do not deploy fixed slots from the main development worktree unless explicitly approved.
- A test slot worktree should normally stay on its matching slot branch.
- `reset --hard` is allowed only in the assigned test slot worktree and only to align the slot branch to the approved target head.
- `reset --hard`, `clean`, `stash`, `restore`, and branch deletion are not allowed in a dirty general worktree.
- If the test slot worktree is dirty, stop and report. Do not clean it silently.

## What `Updating files` means

Git may print output like:

```text
Updating files: 100% (251/251), done.
```

This is normal checkout/update progress. It means Git updated the working tree files to match the target branch or commit. It is not a deletion confirmation prompt.

A deletion prompt or destructive operation is different. Stop if a command asks to delete, remove, clean, overwrite untracked files, retry deletion, or discard local changes.

## Standard slot worktree setup

Run this only when the slot worktree does not already exist.

```bash
git fetch origin
git worktree list

git worktree add ../LoveBud-test3 test3
cd ../LoveBud-test3

git fetch origin
git checkout test3
git status --short
```

If `git status --short` prints anything, stop and report.

Do not run `git clean`, `git stash`, `git restore`, or `git reset --hard` to hide an unexpected dirty state.

## Standard slot deployment procedure

Run this from the assigned test slot worktree only.

Example for `test3`:

```bash
git fetch origin
git branch --show-current
git status --short
```

Expected:

```text
test3
```

If the branch is not the assigned slot branch, stop and report.

If `git status --short` is not empty, stop and report.

Then align the slot branch to the approved target branch:

```bash
git reset --hard origin/<target-pr-branch>
git rev-parse HEAD
git push --force-with-lease origin test3
```

Rules:

- `git reset --hard origin/<target-pr-branch>` is allowed only in the assigned test slot worktree.
- `git push --force-with-lease origin testN` is allowed only for the assigned test slot branch.
- Never force-push `main`.
- Never force-push a normal PR branch unless the CTO explicitly approves that exact action.
- If the deployed SHA does not match the expected head SHA, stop and report.

## Verification provenance

Every fixed slot verification report must include:

| Field | Meaning |
|---|---|
| Assigned slot | `testN` |
| Slot URL | `https://testN.lovebud.pages.dev` |
| Slot worktree path | path only, no secret values |
| Target branch | branch deployed to the slot |
| Expected head SHA | expected commit |
| Deployed SHA | actual `git rev-parse HEAD` result |
| SHA match | yes/no |
| Dirty worktree before deploy | yes/no |
| Force-with-lease used | yes/no, slot branch only |
| Visual smoke result | pass/fail/not verified |
| Console/network result | fatal errors, API/runtime blockers, or none |
| Secret exposure | must be `NO` |

Do not paste browser cookies, session storage, localStorage, tokens, credentials, SSH keys, private key paths that expose sensitive names, or screenshots containing sensitive account data.

## Stop conditions

Stop immediately and report if any of the following occurs:

- wrong branch;
- dirty worktree;
- unexpected changed files;
- head SHA mismatch;
- slot already assigned to another PR;
- deletion retry prompt;
- command asks to clean, discard, overwrite, or remove local files;
- token, session, cookie, credential, localStorage, or SSH private key output risk;
- PR #7, prototype, reference, demo, or variant path appears in the changed files;
- PR #450 or YouTube PoC files appear in the changed files;
- target branch contains files outside the assigned PR scope;
- Cloudflare deployment does not reflect the expected SHA.

## Report template

```text
Fixed Test Slot Deployment Report

1. Assigned slot:
2. Slot URL:
3. Slot worktree path:
4. Target branch:
5. Expected head SHA:
6. Deployed SHA:
7. SHA match:
8. Dirty worktree before deploy:
9. Force-with-lease used on assigned slot branch only:
10. Changed files checked:
11. Changed files within PR scope:
12. Visual smoke result:
13. Mobile 375px result:
14. Console errors:
15. Network/API/runtime issues:
16. Auth/session/storage values exposed:
17. PR #7/prototype/reference/demo/variant touched:
18. PR #450 touched:
19. Final status:
```

## Coordinator prompt requirement

When assigning a fixed test slot, include the worktree requirement in the prompt:

```text
Assigned slot: test3
Required worktree: ../LoveBud-test3
Do not deploy from the main working directory.
Use `force-with-lease` only on the assigned test slot branch.
Expected head SHA: <sha>
```

This requirement prevents test slot deployment from being confused with feature branch development and makes SHA provenance explicit.