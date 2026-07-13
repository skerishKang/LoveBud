# Agent Operation Guardrails

This document defines operational guidance for LoveBud agents when a broad `AGENTS.md` rule can be misread as a reason to avoid required work.

`AGENTS.md` should remain the entrypoint and index. Detailed behavior rules should live in focused project/ops/engineering documents like this one.

## Purpose

Agents must be safe, but safety must not block legitimate repository inspection, implementation, and browser verification.
>
> **Canonical precedence:** `docs/ops/MVP_AGENT_GOVERNANCE.md` (owner-approved #3442 comment `4947327550`) is the source of truth for blocker / allowed-by-default decisions. Browser tooling and routine work are allowed by default; only the 6 hard rules are mandatory. Conflicting sections are `NON_NORMATIVE_OUTSIDE_NAMED_CONTEXT`.

The intended model is:

- inspect the files needed for the authorized task;
- do not print, paste, commit, screenshot, or summarize restricted values;
- report only redacted status labels;
- stop only when actual exposure or out-of-scope risk occurs.

## File inspection versus secret exposure

Security rules must not be interpreted as "do not open files".

Allowed:

- Reading repository files needed for the task.
- Reading local configuration files when required to understand file structure, key names, expected environment variables, or tool configuration.
- Checking whether required files exist.
- Checking whether required key names are present.
- Loading approved local secret files into a process environment for authorized commands.
- Using secrets through approved tools such as `gh`, `wrangler`, Firebase tooling, npm scripts, Playwright, or local test runners.
- Reporting redacted statuses only, for example:
  - `FILE_READ: YES`
  - `SECRET_FILE_EXISTS: YES`
  - `REQUIRED_KEYS_PRESENT: YES`
  - `TOKEN_VALUE_PRINTED: NO`

Forbidden:

- Printing raw secret values.
- Printing partial secret values, prefixes, suffixes, or last characters.
- Printing session, cookie, authorization header, private key, credential, database URL, or private identifier values.
- Copying secret values into chat, logs, PR comments, issue comments, screenshots, docs, or commits.
- Running commands whose purpose is to dump all environment variables or secret file contents to visible output.
- Committing secret files or generated files that contain secret values.

Clarification:

- An agent may inspect files and commands to do the work.
- The forbidden action is exposing restricted values, not reading ordinary source files or configuration structure.
- If a file contains secrets, the agent should avoid displaying the value and report only presence/status.
- If a secret is accidentally displayed, stop and report `SECURITY_INCIDENT_SECRET_EXPOSURE` without repeating the value.

## Browser verification and fixed test slots

Runtime-sensitive UI work must use the current fixed-slot verification policy.

This applies especially to:

- Browse / Search
- Editor
- My Trees
- Auth / Login
- `/api/*` dependent pages
- Cloudflare Pages Functions dependent pages
- Modal-dependent flows
- Firebase session dependent flows

Required before final browser PASS:

1. Deploy the exact PR head SHA or current-main target SHA to a fixed test slot.
2. Confirm the slot URL.
3. Confirm deployed SHA prefix match.
4. Use a login-capable browser path when the page requires auth/session state.
5. Report PASS / FAIL / NOT_VERIFIED / BLOCKED separately.
6. Do not treat production or localhost-only verification as final pre-merge proof for these flows.

## Test account handling

For browser verification that requires login, agents should use the latest approved test account source.

Rules:

- Use the current approved QA/test credential source before assuming auth is blocked.
- Do not print credential values.
- Report only `APPROVED_QA_CREDENTIAL_SOURCE_USED: YES/NO`.
- If the approved test account no longer works, attempt the approved signup or test-account refresh path if that is in scope.
- If a new test account is created, record it only in the approved local test-account file or approved secret store.
- Never commit test credential values.
- Never write test credential values into PR comments, issue comments, docs, screenshots, logs, or chat.
- Report only redacted state:
  - `TEST_ACCOUNT_LOGIN: PASS`
  - `TEST_ACCOUNT_LOGIN: FAIL`
  - `TEST_ACCOUNT_REFRESHED: YES`
  - `TEST_ACCOUNT_FILE_UPDATED: YES`

If the test account file path is provided, agents may use that file locally. They must not print its contents.

## Parallel model and prompt hygiene

LoveBud often uses multiple models or executors in parallel. Agents must avoid duplicate or conflicting prompts.

Rules:

- Before issuing a new executor prompt, check whether the same PR/issue already has an active prompt or recent report.
- Do not send two different agents the same implementation task unless the user explicitly asks for parallel execution.
- Do not give a verification executor a coding prompt.
- Do not give a coding executor a merge/finalization prompt.
- If another executor is already working on the same PR/issue, report that status instead of generating another overlapping prompt.
- If parallel work is intentional, split by non-overlapping files, surfaces, or responsibilities.

Recommended report labels:

- `NO_ACTIVE_DUPLICATE_PROMPT_FOUND`
- `ACTIVE_EXECUTOR_ALREADY_ASSIGNED`
- `PROMPT_WITHHELD_DUPLICATE_RISK`
- `PARALLEL_SAFE_SPLIT_DEFINED`

## Out-of-scope user input handling

When the user provides content that does not match the active PR/issue/task, do not silently switch scope.

Rules:

- If the active task is PR-specific and the user provides unrelated work, ask once for confirmation before changing task.
- If the user clearly says "next", "switch", "do this instead", or gives an explicit new target, proceed with the new target after recording the switch.
- If the pasted report appears to belong to a different PR/issue than the active one, call out the mismatch and ask whether to treat it as a task switch.
- Do not merge, close, ready, deploy, or create PRs for a different scope without explicit confirmation.

Standard confirmation:

> This appears to be about PR/Issue X, while the active task is PR/Issue Y. Should I switch scope to X?

## Implementation handoff guidance

For coding tasks, the lead/CTO agent should provide enough implementation shape that a lower-capability local executor can implement safely.

Include when useful:

- target files;
- files not to touch;
- existing DOM IDs/classes/functions/event handlers to preserve;
- expected DOM structure or expected implementation shape;
- pseudo diff or patch draft;
- required cache-key or script-order changes;
- verification commands;
- fixed-slot/browser verification requirement;
- explicit non-goals and stop conditions.

Do not use a pseudo diff as permission for broad rewrites. The implementation executor must still inspect the latest current file state and apply the smallest safe change.

Standard handoff language:

> Provide an expected implementation shape before coding. Reuse existing IDs, handlers, and DOM contracts whenever possible. Do not create parallel controls or duplicate event paths unless explicitly required. Treat pseudo diff as guidance, not as permission for broad rewrites.

## Completion standard

A task is not complete merely because a local command passed.

Completion reports must separate:

- code changed versus already present on main;
- local checks versus browser/fixed-slot checks;
- verified versus not verified;
- implementation done versus merge candidate;
- merge done versus issue closure disposition.

For runtime-sensitive work, fixed-slot/SHA-match evidence strengthens the claim (PRODUCTION_EVIDENCE / PRE_MERGE_EVIDENCE) but its absence is not an automatic BLOCKED; report the evidence limitation. Browser tooling itself is allowed by default (canonical policy).
