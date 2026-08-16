# MVP Agent Governance

> **Status:** canonical source of truth — owner-approved
> **Approval provenance:** Issue #3442 comment `4947327550`; CI amendment #3642; separated execution roles #3662; UI Rapid Iteration Lane #3664; parallel semantic-authority amendment #3994 / owner direction 2026-08-12

This document is the canonical source of truth for LoveBud hard blockers, CI classification, browser permission, role-allocation authority, parallel writer ownership, and merge governance. Conflicting historical documents are non-normative outside their named original context.

## Authority

- MVP implementation governance: #3442 comment `4947327550`;
- CI infrastructure-unavailable classification: #3642;
- Web CTO / Web Developer / Local Validation model: #3662;
- risk-proportional UI Rapid Iteration Lane: #3664;
- current multi-model semantic-authority coordination: #3994;
- focused role source: `docs/project/WEB_CTO_WEB_DEVELOPER_LOCAL_VALIDATION.md`;
- focused parallel-work source: `docs/ops/PARALLEL_WORKTREE_AGENT_POLICY.md`;
- focused UI source: `docs/project/UI_RAPID_ITERATION_LANE.md`.

A restriction in a repository document is not automatically a hard blocker. New hard blockers require traceable owner approval. The #3994 parallelism amendment is authoritative for active multi-model work because it was explicitly owner-directed to prevent competing implementations while the platform migration and independent Web CTO work proceed in parallel.

## Hard standing rules

Only these are mandatory enforced blockers:

1. Never expose or commit raw secrets, tokens, passwords, cookies, credentials, private keys, database URLs, authorization headers, or private payloads.
2. Never destructively delete, overwrite, reset, clean, drop, or force-update another worker's branch, worktree, stash, or uncommitted state.
3. Destructive Production data deletion, destructive Production schema change, or Production security-policy change requires owner approval.
4. Do not merge on `CI_EXECUTED_FAILURE` or `CI_PENDING_EXECUTION`.
5. `CI_UNAVAILABLE_INFRA` is not a code failure and may use the documented alternative-evidence path.
6. An implementation worker must not Ready-transition or merge its own active PR unless a task-specific owner instruction explicitly delegates that integration authority. Any authorized merge requires independent review, expected-head SHA verification, and acceptable CI/evidence; squash is the default merge method unless a narrower task contract says otherwise.
7. During multi-model/parallel implementation, enforce `ONE WRITER PER BRANCH`, `ONE WRITER PER FILE`, and `ONE WRITER PER SEMANTIC AUTHORITY`. YELLOW/RED authority overlap blocks competing implementation until sequencing or ownership transfer is explicit.
8. Never close #1882; use `Refs #1882` only.

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

- ordinary branch/worktree code, docs, and test work within assigned authority;
- direct feature-branch implementation by a separate Web Developer or designated implementation owner;
- read-only remote review, CI forensic work, and review findings on another worker's active authority;
- browser start/restart, tabs, navigation, login/logout/re-authentication;
- localhost, Production, PR/branch preview, fixed slot, disposable environments when the task permits that evidence source;
- DevTools, CDP, Playwright, screenshots, console/network/API inspection;
- ordinary in-scope test-data creation/edit/deletion when the task permits it;
- PR creation, normal additive commits, push, and Draft PR maintenance within the assigned branch/authority.

Ready transition and merge are integration actions, not ordinary implementation actions in an active multi-model lane. They require the applicable task/owner authorization and the independent-review gate above.

## Owner-approved execution model

Default roles:

```text
Web CTO
Web Developer / designated implementation owner
Local Validation when required
```

Lifecycle:

```text
user request
→ Web CTO contract / authority allocation
→ separate Web Developer or implementation owner
→ Local Validation only when required
→ Web CTO independent final review
→ user decision / authorized expected-head merge
```

The same production change should not be implemented and finally approved in the same context. Web CTO may create designs, prototypes, exact copy, state contracts, patch drafts, remote forensic findings, or non-overlapping backlog corrections; a separate implementation owner implements active platform/runtime changes and reports a new exact head for independent review.

Older references to TF Leads, `UI Local`, `Feature Local`, or a generic local executor as the default production coder are superseded for current role allocation.

## Parallel multi-model authority

Parallel work is encouraged only when implementation authority is non-conflicting. Branch and file separation are necessary but not sufficient.

Always classify the intended write before mutation:

```text
GREEN  = branch, path, and semantic authority are independent
          → parallel implementation allowed

YELLOW = files differ but semantic authority is shared
          → parallel read/review/CI forensic allowed; implementation is sequenced

RED    = same branch, same file, or same core semantic authority
          → one active writer only
```

Representative semantic authorities include:

```text
AUTH / session / account / token
DB schema / migration / manifest
DB transport / driver
API runtime / routing / Service Binding
Tree write
Memory write
social write
visibility
owner / entitlement mapping
Modal contraction / shared-platform runtime
```

When an active writer exists:

- other agents may inspect, compare, run read-only forensic work, and leave review findings;
- they must not create a competing implementation for the same authority;
- blocking findings are corrected by the active writer on that writer's branch unless ownership is explicitly transferred;
- after a dependency merges, dependent branches re-check current main, file overlap, semantic overlap, and exact-head CI before proceeding.

This rule is the highest-priority coordination rule for an explicitly declared multi-model parallel lane. It exists to preserve development parallelism without creating two sources of implementation authority.

Feature-branch history must remain additive. Rebase, published-history amend/rewrite, and force-push are not normal feature-branch alignment tools. Current-main alignment uses normal merge-forward where required.

A separately assigned fixed test-slot branch is ephemeral verification infrastructure, not a feature implementation branch. The limited `--force-with-lease` procedure in `docs/ops/TEST_PREVIEW_SLOTS.md` remains valid only for that explicitly assigned slot and never authorizes force-updating a feature PR branch or `main`.

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

- one task per branch outside a declared multi-model authority lock;
- Draft PR by default outside a declared lane that explicitly requires Draft;
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

Within an explicitly declared multi-model lane, writer ownership and no-competing-implementation rules are not advisory; they are the lane's active coordination authority.

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

- this document for hard blockers, CI classification, multi-model writer authority, and merge governance;
- `docs/ops/PARALLEL_WORKTREE_AGENT_POLICY.md` for the operational branch/path/semantic-authority lock procedure;
- `docs/project/WEB_CTO_WEB_DEVELOPER_LOCAL_VALIDATION.md` for role allocation;
- `docs/project/UI_RAPID_ITERATION_LANE.md` for UI process weight;
- `docs/ops/MERGE_FIRST_PRODUCTION_VERIFICATION_WORKFLOW.md` for current browser/Production evidence flow;
- `docs/ops/TEST_PREVIEW_SLOTS.md` only for explicitly assigned ephemeral fixed-slot update/restore operations.

Refs #3994.
Refs #3664.
Refs #3662.
Refs #3642.
Refs #3442.
Refs #3441.
Refs #3437.
Refs #3435.
Refs #1882 — Keep OPEN.
