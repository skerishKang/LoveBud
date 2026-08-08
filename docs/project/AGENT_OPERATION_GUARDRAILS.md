# Agent Operation Guardrails

> **Hard-governance precedence:** `docs/ops/MVP_AGENT_GOVERNANCE.md`
> **Role model:** `WEB_CTO_WEB_DEVELOPER_LOCAL_VALIDATION.md`
> **UI fast lane:** `UI_RAPID_ITERATION_LANE.md`

## Purpose

Safety must not become process inflation. Agents should inspect, implement, test, browse, and collect evidence as required while avoiding secret exposure, destructive actions, conflicting writers, and out-of-scope changes.

## Role boundaries

### Web CTO

- verifies current remote state;
- fixes scope, risk class, design, tests, and evidence;
- decides whether Local Validation is required;
- does not implement and finally approve the same production change in one context;
- owns final READY/NOT_READY and expected-head merge judgment.

### Web Developer

- implements in a separate web context;
- writes branch code/tests/docs;
- maintains PR and CI corrections;
- returns exact evidence;
- does not make final product or merge decisions.

### Local Validation

- runs exact-head local/environment/browser checks only when required;
- returns raw evidence;
- does not invent design or broadly rewrite source;
- makes only explicitly authorized minimal integration changes.

## Risk-proportional verification

Every task must use the smallest evidence set that proves the affected behavior.

For UI:

- U0/U1: no automatic Local Validation, fixed slot, screenshots, desktop/mobile matrix, or full suite;
- U2: focused structural tests and conditional layout/browser evidence;
- U3: full relevant runtime/auth/API/data/cache/storage evidence.

Do not escalate process merely because a file is HTML or CSS. Escalate when actual behavior, shared/global impact, accessibility semantics, or runtime state changes.

## File inspection versus secret exposure

Reading ordinary source/configuration structure is allowed. The forbidden action is exposing restricted values.

Allowed:

- inspect required repository and local configuration structure;
- check file/key presence;
- load approved secrets into authorized processes without displaying values;
- use `gh`, provider CLIs, databases, Playwright, and test runners;
- report redacted status labels.

Forbidden:

- raw or partial secret values;
- credentials, cookies, sessions, Authorization headers, private keys, database URLs, or private payloads in visible output;
- environment/secret-file dumps;
- committing generated secret-bearing files.

If exposure occurs, stop and report `SECURITY_INCIDENT_SECRET_EXPOSURE` without repeating the value.

## Browser evidence

Browser tooling, navigation, login, DevTools, Playwright, screenshots, preview, fixed slot, localhost, and Production are allowed.

Evidence levels:

```text
LOCAL_EVIDENCE
PRE_MERGE_EVIDENCE
PRODUCTION_EVIDENCE
```

- Environment changes evidence strength, not permission.
- Preview/fixed slot absence is not an automatic blocker.
- Do not search for or deploy preview/fixed-slot environments unless assigned.
- Merge-first Production verification is the default final UI/Auth/runtime confirmation.

## Screenshot judgment

Executors may report factual observations and capture evidence. Final subjective visual judgment belongs to the Web CTO/user.

Screenshot requirements are class-dependent:

- U0: normally not required;
- U1: optional pre-merge;
- U2: normally useful for affected layouts/states;
- U3: required when browser/runtime state is part of acceptance.

## Parallel sessions

- check for active writers before assigning work;
- one active writer per remote branch;
- do not send coding work to Local Validation;
- do not send final merge authority to Web Developer;
- split by non-overlapping branch/worktree/file/surface responsibility;
- re-check remote head before push;
- never push the same remote branch simultaneously from two computers.

Recommended states:

```text
NO_ACTIVE_DUPLICATE_PROMPT_FOUND
ACTIVE_EXECUTOR_ALREADY_ASSIGNED
PROMPT_WITHHELD_DUPLICATE_RISK
PARALLEL_SAFE_SPLIT_DEFINED
REMOTE_BRANCH_SINGLE_WRITER_CONFIRMED
```

## Scope switches

Do not silently switch to unrelated work. When the user explicitly switches targets, record the new target and preserve current branch/worktree state. Do not merge, close, ready, deploy, or modify another scope without direction.

## Implementation contract

A Web CTO contract should include:

```text
Repository / Issue / PR
exact base and target
objective and outcome
risk or UI class
non-goals
allowed/forbidden paths
implementation shape
focused tests
Local Validation decision
Production check
acceptance criteria
protected Issues
stop conditions
report format
```

For UI, include exact copy, target structure/states, existing IDs/handlers to preserve, tokens/motion/breakpoints, and prototype/screenshots when useful.

## Handoff to Local Validation

Create this handoff only when Local is required. Include exact head, commands, expected behavior, browser/auth/viewports, evidence, allowed local changes, and forbidden destructive commands.

For U0/U1, route Web Developer evidence directly back to Web CTO unless a specific local gap exists.

## Patch-package fallback

When direct Web implementation is unsuitable, provide repository-relative changed files, unified patch, manifest, apply instructions, test plan, and review notes. Local applies and tests; it does not redesign.

## Dirty worktree and artifacts

A dirty worktree is not an automatic blocker.

```text
dirty worktree
→ preserve
→ use another worktree/branch or read-only inspection
→ do not clean/reset/stash-drop/overwrite
```

Keep screenshots, reports, backups, and artifacts outside the repository unless committed fixtures are explicitly required.

Before push, check `git status --short` and the changed-file list. Unexpected files require scope review, not destructive cleanup.

## Completion standard

Reports must separate:

- exact baseline/final SHA;
- changed versus already present;
- focused checks, CI, and browser evidence;
- pristine-main versus branch-only failures;
- verified versus unverified;
- Local required versus skipped;
- implementation complete versus merge candidate versus merged;
- merge versus Issue closure.

The Web CTO reviews remote evidence and the pre-fixed contract, not summaries alone.

## Related documents

- `docs/ops/MVP_AGENT_GOVERNANCE.md`
- `docs/project/WEB_CTO_WEB_DEVELOPER_LOCAL_VALIDATION.md`
- `docs/project/UI_RAPID_ITERATION_LANE.md`
- `docs/project/ROLE_SESSION_TEMPLATES.md`
- `docs/project/LOCAL_MODEL_WORKFLOW.md`

Refs #3664.
Refs #3662.
Refs #1882 — Keep OPEN.
