# MVP Agent Governance

> **Status:** canonical source of truth — owner-approved
> **Approval provenance:** Issue #3442 comment `4947327550`; CI amendment #3642; separated execution roles #3662; UI Rapid Iteration Lane #3664

This document is the canonical source of truth for LoveBud hard blockers, CI classification, browser permission, role-allocation authority, and merge governance. Conflicting historical documents are non-normative outside their named original context.

## Authority

- MVP implementation governance: #3442 comment `4947327550`;
- CI infrastructure-unavailable classification: #3642;
- Web CTO / Web Developer / Local Validation model: #3662;
- risk-proportional UI Rapid Iteration Lane: #3664;
- focused role source: `docs/project/WEB_CTO_WEB_DEVELOPER_LOCAL_VALIDATION.md`;
- focused UI source: `docs/project/UI_RAPID_ITERATION_LANE.md`.

A restriction in a repository document is not automatically a hard blocker. New hard blockers require traceable owner approval.

## Hard standing rules

Only these are mandatory enforced blockers:

1. Never expose or commit raw secrets, tokens, passwords, cookies, credentials, private keys, database URLs, authorization headers, or private payloads.
2. Never destructively delete, overwrite, reset, clean, drop, or force-update another worker's branch, worktree, stash, or uncommitted state.
3. Destructive Production data deletion, destructive Production schema change, or Production security-policy change requires owner approval.
4. Do not merge on `CI_EXECUTED_FAILURE` or `CI_PENDING_EXECUTION`.
5. `CI_UNAVAILABLE_INFRA` is not a code failure and may use the documented alternative-evidence path.
6. Verify the expected PR head SHA, then squash merge.
7. Never close #1882; use `Refs #1882` only.

## CI classification

Use exactly:

```text
CI_GREEN
CI_EXECUTED_FAILURE
CI_PENDING_EXECUTION
CI_UNAVAILABLE_INFRA
```

- **CI_GREEN:** required relevant jobs executed and passed.
- **CI_EXECUTED_FAILURE:** a relevant lint/build/test/verification step executed and failed; merge blocker.
- **CI_PENDING_EXECUTION:** a relevant job is queued/running; temporary merge blocker.
- **CI_UNAVAILABLE_INFRA:** no relevant step executed because of billing, outage, runner allocation, or equivalent infrastructure failure; neither PASS nor code failure.

A red job shell with no steps/logs may be `CI_UNAVAILABLE_INFRA`. An actually executed failing step is `CI_EXECUTED_FAILURE`.

## Allowed by default

The following are allowed without special approval:

- ordinary branch/worktree code, docs, and test work;
- direct feature-branch implementation by a separate Web Developer;
- browser start/restart, tabs, navigation, login/logout/re-authentication;
- localhost, Production, PR/branch preview, fixed slot, disposable environments;
- DevTools, CDP, Playwright, screenshots, console/network/API inspection;
- ordinary in-scope test-data creation/edit/deletion;
- PR creation, additive commits, and Ready transition when the contract permits;
- expected-head squash merge after final review and acceptable CI/evidence.

## Owner-approved execution model

Default roles:

```text
Web CTO
Web Developer
Local Validation when required
```

Lifecycle:

```text
user request
→ Web CTO contract
→ separate Web Developer implementation
→ Local Validation only when required
→ Web CTO independent final review
→ user decision / expected-head squash merge
```

The same production change should not be implemented and finally approved in the same context. Web CTO may create designs, prototypes, exact copy, state contracts, or patch drafts; a separate Web Developer implements or independently reviews production changes.

Older references to TF Leads, `UI Local`, `Feature Local`, or a generic local executor as the default production coder are superseded for current role allocation.

## UI Rapid Iteration Lane

UI work is classified:

```text
U0 copy-only
U1 visual-only
U2 structural UI
U3 runtime-sensitive UI
```

Owner-approved defaults:

- U0/U1 skip Local Validation by default;
- U0/U1 do not require a new child Issue for every micro correction;
- U0/U1 do not require unrelated full-suite tests, fixed slot, pre-merge screenshots, or universal desktop/mobile QA merely because HTML/CSS changed;
- U2 uses focused structural tests and conditional browser/Local evidence;
- U3 uses the full relevant runtime path;
- Production visual confirmation is the normal final loop under merge-first policy.

This is risk-proportional verification, not removal of quality controls. JavaScript behavior, DOM/focus/visibility semantics, auth/API/data/cache/storage, broad global/shared impact, dependencies, privacy, or security escalate to U2/U3.

## Advisory, not automatic blockers

The following may be useful but are not automatic blockers unless the task contract and actual risk require them:

- one task per branch;
- Draft PR by default;
- fixed slot or preview;
- PR-specific browser entrypoint comment;
- CTO-assigned URL;
- clean worktree;
- Local Validation for every change;
- full lint/build/test/verify suite for every PR;
- pre-merge screenshots for every UI change;
- desktop+375px checks when one viewport cannot be affected;
- new child Issue for every U0/U1 change;
- narrow diff/minimal-change preference;
- module-size/refactor guidance;
- a safe reported deviation from the default role flow.

## Evidence model

```text
LOCAL_EVIDENCE
PRE_MERGE_EVIDENCE
PRODUCTION_EVIDENCE
```

Environment controls evidence strength, not permission. If evidence is limited, report the limitation rather than inventing a blocker.

## Dirty worktree

```text
dirty worktree
→ preserve existing changes
→ use another worktree/branch or read-only inspection
→ do not clean/reset/stash-drop/overwrite
```

Dirty state itself is not an automatic blocker.

## New restriction protocol

A proposed mandatory blocker must include:

```text
restriction
reason
scope
development-speed impact
alternatives
traceable owner approval
```

Without owner approval it is:

```text
RECOMMENDATION_ONLY
```

## Precedence

The following supersede conflicting historical process language:

- `docs/project/WEB_CTO_WEB_DEVELOPER_LOCAL_VALIDATION.md` for role allocation;
- `docs/project/UI_RAPID_ITERATION_LANE.md` for UI process weight;
- `docs/ops/MERGE_FIRST_PRODUCTION_VERIFICATION_WORKFLOW.md` for current browser/Production flow;
- this document for hard blockers and CI classification.

Refs #3664.
Refs #3662.
Refs #3642.
Refs #3442.
Refs #3441.
Refs #3437.
Refs #3435.
Refs #1882 — Keep OPEN.
