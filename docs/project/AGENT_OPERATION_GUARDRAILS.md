# Agent Operation Guardrails

This document defines operational guidance for LoveBud agents when broad repository rules can be misread as a reason to avoid required work or when implementation, validation, and final approval roles can be confused.

`AGENTS.md` remains the repository-wide entrypoint. Detailed execution-role behavior lives in focused project documents.

> **Canonical precedence:** `docs/ops/MVP_AGENT_GOVERNANCE.md` is the source of truth for hard blockers, CI classification, browser permission, dirty-worktree handling, and merge governance. This document defines safe operating behavior and role boundaries; it does not add new hard blockers.

> **Role model:** `WEB_CTO_WEB_DEVELOPER_LOCAL_VALIDATION.md` is the focused source of truth for Web CTO, Web Developer, and Local Validation responsibilities approved in Issue #3662.

## Purpose

Agents must be safe, but safety must not block legitimate repository inspection, implementation, testing, browser use, or evidence collection.

The intended model is:

- inspect the files needed for the authorized task;
- use the stronger web context for planning and implementation;
- use local execution for environment-dependent validation;
- do not expose secrets or private payloads;
- report exact evidence rather than unsupported completion claims;
- stop only when actual exposure, destructive action, conflicting writers, or out-of-scope risk occurs.

## Execution-role boundaries

### Web CTO

The Web CTO:

- verifies current remote state;
- defines objective, non-goals, allowed/forbidden paths, implementation shape, tests, and evidence;
- may create prototypes, design references, copy, state diagrams, or patch drafts;
- does not implement and finally approve the same production change in the same conversation/context;
- returns after implementation and Local Validation for independent final review;
- owns READY / CONDITIONALLY_READY / NOT_READY and expected-head squash-merge judgment.

### Web Developer

The Web Developer:

- works in a separate web conversation/context;
- implements code/tests/docs on a feature branch;
- creates or updates the Draft PR;
- inspects CI and fixes executed code failures;
- submits exact SHA/diff/test evidence;
- does not make final product or merge decisions.

### Local Validation

Local Validation:

- checks out the exact PR head;
- runs tests, build, browser, auth, database, provider, and OS-dependent verification;
- returns raw evidence;
- does not independently redesign or broadly rewrite production source;
- makes only explicitly authorized minimal integration changes.

## File inspection versus secret exposure

Security rules must not be interpreted as “do not open files.”

Allowed:

- reading repository files needed for the task;
- reading local configuration structure when required;
- checking whether required files exist;
- checking whether required key names are present;
- loading approved local secret files into a process environment for authorized commands;
- using secrets through approved tools such as `gh`, `wrangler`, Firebase tooling, npm scripts, Playwright, databases, or local test runners;
- reporting redacted statuses only, for example:
  - `FILE_READ: YES`
  - `SECRET_FILE_EXISTS: YES`
  - `REQUIRED_KEYS_PRESENT: YES`
  - `TOKEN_VALUE_PRINTED: NO`

Forbidden:

- printing raw or partial secret values;
- printing credential prefixes, suffixes, or last characters;
- printing session, cookie, authorization header, private key, credential, database URL, or private identifier values;
- copying restricted values into chat, logs, PR comments, Issue comments, screenshots, docs, or commits;
- running commands whose purpose is to dump all environment variables or secret-file contents to visible output;
- committing secret files or generated files containing secret values.

Clarification:

- the prohibited action is exposure, not ordinary inspection;
- if a file contains secrets, avoid displaying values and report only presence/status;
- if a secret is accidentally displayed, stop and report `SECURITY_INCIDENT_SECRET_EXPOSURE` without repeating the value.

## Browser verification and evidence levels

Browser tooling, login, navigation, DevTools, Playwright, screenshots, preview, fixed slot, localhost, and Production are allowed by default under canonical governance.

The environment determines evidence strength, not permission to work.

```text
LOCAL_EVIDENCE
PRE_MERGE_EVIDENCE
PRODUCTION_EVIDENCE
```

### LOCAL_EVIDENCE

Examples:

- localhost;
- local static server;
- local API/backend/database;
- authenticated local browser profile.

Dynamic pages may have evidence limitations on localhost. Report the limitation rather than declaring an automatic blocker.

### PRE_MERGE_EVIDENCE

Examples:

- PR Preview;
- branch preview;
- fixed slot;
- disposable test environment.

When pre-merge browser evidence is explicitly assigned, verify:

- exact deployed PR head or target SHA;
- URL provenance;
- login/session requirements;
- requested desktop/mobile viewports;
- console/network/API status;
- PASS / FAIL / PARTIAL / NOT_VERIFIED separately.

Preview or fixed-slot absence is not an automatic blocker.

### PRODUCTION_EVIDENCE

Production evidence is collected after merge/deploy from the exact main SHA reflected at `https://lovebud.pages.dev/`.

The current default for UI/Auth/runtime final visual acceptance is merge-first Production verification. Agents should not search for preview URLs or deploy fixed slots unless the Web CTO contract assigns that evidence.

## Test-account handling

For browser verification requiring login:

- use the latest approved QA/test credential source;
- do not print credential values;
- report only `APPROVED_QA_CREDENTIAL_SOURCE_USED: YES/NO`;
- if the approved account fails, use the authorized refresh/signup path when in scope;
- store new account information only in the approved local secret source;
- never write credentials into PRs, Issues, docs, screenshots, logs, or chat.

Approved redacted labels include:

```text
TEST_ACCOUNT_LOGIN: PASS
TEST_ACCOUNT_LOGIN: FAIL
TEST_ACCOUNT_REFRESHED: YES
TEST_ACCOUNT_FILE_UPDATED: YES
```

## Parallel model and prompt hygiene

LoveBud may use multiple computers and sessions in parallel.

Rules:

- check whether the same PR/Issue already has an active Web Developer or Local Validation session;
- do not assign two active writers to the same remote branch;
- do not send a coding prompt to Local Validation;
- do not send a merge/finalization prompt to the Web Developer;
- split parallel work by non-overlapping branches, worktrees, files, surfaces, or responsibilities;
- report the active writer, branch, worktree, file ownership, and expected merge order;
- re-check remote head immediately before push;
- do not push the same remote branch simultaneously from two computers.

Recommended labels:

```text
NO_ACTIVE_DUPLICATE_PROMPT_FOUND
ACTIVE_EXECUTOR_ALREADY_ASSIGNED
PROMPT_WITHHELD_DUPLICATE_RISK
PARALLEL_SAFE_SPLIT_DEFINED
REMOTE_BRANCH_SINGLE_WRITER_CONFIRMED
```

## Out-of-scope user input handling

When user input does not match the active PR/Issue/task:

- do not silently switch scope;
- if the user clearly requests a switch, record the new target and proceed;
- if a pasted report belongs to another PR/Issue, call out the mismatch;
- do not merge, close, ready, deploy, or modify another scope without explicit direction;
- preserve the current branch/worktree state when switching contexts.

Standard confirmation when needed:

> This appears to be about PR/Issue X, while the active task is PR/Issue Y. Should I switch scope to X?

## Web CTO implementation contract

Before Web Developer coding, the Web CTO should provide:

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
Required implementation shape
Required tests
Required local/browser evidence
Acceptance criteria
Protected Issues
Stop conditions
Final report format
```

For UI work, include when useful:

- target desktop/mobile structure;
- existing IDs/classes/functions/handlers to preserve;
- expected DOM ownership;
- state transitions;
- exact copy;
- CSS tokens, motion, breakpoints;
- target screenshot or standalone prototype.

Do not ask the Web Developer or Local Validation to invent an unspecified product or visual direction.

## Web Developer handoff to Local Validation

The Web Developer should provide:

```text
PR number
Remote branch
Exact head SHA
Expected base/main SHA
Worktree instructions
Commands to execute
Expected pass/fail behavior
Browser routes/URLs
Auth requirements
Viewport requirements
Console/network expectations
Evidence to collect
Authorized local changes
Forbidden destructive commands
```

The handoff must distinguish:

- implementation tests already executed;
- CI state;
- environment evidence still required;
- known limitations;
- pristine-main failures already identified.

## Local Validation failure return

When a source correction is required, Local Validation should return:

```text
exact tested SHA
command
relevant raw error
reproduction steps
expected behavior
actual behavior
browser viewport/auth state
console/network/API result
local source files modified: NONE or exact list
```

Local Validation should not turn a failing test into a broad local rewrite.

## Direct GitHub implementation and patch-package fallback

Direct feature-branch implementation by the separate Web Developer is the default.

When direct GitHub implementation is unsuitable, use a patch package:

```text
change-package/
├─ files/
├─ changes.patch
├─ MANIFEST.json
├─ APPLY.md
├─ TEST_PLAN.md
└─ REVIEW_NOTES.md
```

The package must preserve repository-relative paths and exact base SHA. Local Validation applies and tests it; it does not redesign the patch.

## Dirty worktree and artifact hygiene

A dirty worktree is not an automatic blocker.

```text
dirty worktree discovered
→ preserve existing changes
→ use another worktree/branch or read-only inspection
→ do not clean/reset/stash-drop/overwrite
```

Local screenshots, reports, backups, and artifacts should remain outside the repository unless the task explicitly requires committed fixtures.

Task-specific untracked debris may be removed individually after confirming ownership. Do not use `git clean`.

## Completion standard

A task is not complete merely because a command passed or a developer reported success.

Reports must separate:

- code changed versus already present;
- exact baseline and final remote SHA;
- local checks versus CI checks versus browser evidence;
- pristine-main failures versus branch-only failures;
- verified versus unverified;
- implementation done versus local validation done;
- merge candidate versus merged;
- merged versus Issue closure disposition.

The Web CTO final review must use remote evidence and the pre-fixed contract, not only the summaries from the Web Developer or Local Validation.

## Related documents

- `docs/ops/MVP_AGENT_GOVERNANCE.md`
- `docs/project/WEB_CTO_WEB_DEVELOPER_LOCAL_VALIDATION.md`
- `docs/project/ROLE_SESSION_TEMPLATES.md`
- `docs/project/PROJECT_OPERATING_MODEL.md`
- `docs/project/REPORTING_CHAIN.md`
- `docs/project/LOCAL_MODEL_WORKFLOW.md`

Refs #3662.  
Refs #1882 — Keep OPEN.
