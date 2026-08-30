# MVP Agent Governance

> **Status:** canonical source of truth — owner-approved
> **Approval provenance:** Issue #3442 comment `4947327550`; CI amendment #3642; separated execution roles #3662; UI Rapid Iteration Lane #3664; parallel semantic-authority amendment #3994 / owner direction 2026-08-12; autonomous advanced/frontier implementation amendment / owner direction 2026-08-17; Production-first / Rollback-first amendment / owner direction 2026-08-30

This document is the canonical source of truth for LoveBud hard blockers, CI classification, browser permission, role-allocation authority, parallel writer ownership, autonomous advanced/frontier implementation entry, Production correction sequencing, and merge governance. Conflicting historical documents are non-normative outside their named original context.

## Authority

- MVP implementation governance: #3442 comment `4947327550`;
- CI infrastructure-unavailable classification: #3642;
- Web CTO / Web Developer / Local Validation model: #3662;
- risk-proportional UI Rapid Iteration Lane: #3664;
- current multi-model semantic-authority coordination: #3994;
- autonomous advanced/frontier implementation lane: owner direction 2026-08-17;
- Production-first / Rollback-first sequencing: owner direction 2026-08-30;
- focused role source: `docs/project/WEB_CTO_WEB_DEVELOPER_LOCAL_VALIDATION.md`;
- focused autonomous implementation source: `docs/project/AUTONOMOUS_FRONTIER_IMPLEMENTATION_LANE.md`;
- focused parallel-work source: `docs/ops/PARALLEL_WORKTREE_AGENT_POLICY.md`;
- focused UI source: `docs/project/UI_RAPID_ITERATION_LANE.md`;
- focused Production sequencing source: `docs/ops/PRODUCTION_FIRST_ROLLBACK_FIRST_POLICY.md`.

A restriction in a repository document is not automatically a hard blocker. New hard blockers require traceable owner approval. The #3994 parallelism amendment is authoritative for active multi-model work because it was explicitly owner-directed to prevent competing implementations while the platform migration and independent Web CTO work proceed in parallel.

The 2026-08-17 autonomous implementation amendment is also owner-approved. It adds a valid alternative implementation entry path for advanced/frontier-capability models: a capable model may discover and implement a bounded, non-conflicting Issue before receiving a Web CTO instruction, then submit the exact result for independent CTO verification. Lack of a prior CTO assignment is not itself a defect under that lane.

The 2026-08-30 Production-first / Rollback-first amendment is owner-approved. It separates **source merge readiness** from **reversible Production correction authority**. Pre-Production testing is not an automatic blocker for an otherwise authorized, bounded, observable, reversible Production correction. The operator captures a rollback point, applies the smallest Production change, verifies immediately, and rolls back first on material failure. Task-specific explicit approval boundaries remain authoritative.

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
9. A reversible Production correction must have a captured rollback point and an immediate post-change verification signal before mutation.
10. A task-specific explicit Production approval requirement remains a hard boundary even when the change is reversible. Production-first changes the sequencing default; it does not manufacture missing authority.

`CI_EXECUTED_FAILURE` and `CI_PENDING_EXECUTION` remain **merge blockers**. They are not automatically Production-correction blockers when a separate Production action is already authorized and qualifies under `docs/ops/PRODUCTION_FIRST_ROLLBACK_FIRST_POLICY.md`.

Autonomous advanced/frontier implementation does not weaken any hard standing rule. In particular, it does not grant Ready, merge, protected-Issue close, Production/provider/config/secret mutation, real-user mutation, destructive git, or competing semantic-authority permission unless the governing task separately grants that Production authority.

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

CI classification answers whether source integration is acceptable. It must not be silently reused as a different question — whether an independently authorized reversible Production correction may execute.

## Allowed by default

The following are allowed without special approval unless a narrower task contract says otherwise:

- ordinary branch/worktree code, docs, and test work within assigned authority;
- direct feature-branch implementation by a separate Web Developer or designated implementation owner;
- owner-approved autonomous advanced/frontier implementation of a bounded, non-conflicting Issue after fresh remote/ownership inspection, including selecting or creating the bounded Issue, feature-branch source/docs/test work, additive commits, normal push, Draft PR creation, and correction of self-introduced CI failures;
- read-only remote review, CI forensic work, and review findings on another worker's active authority;
- browser start/restart, tabs, navigation, login/logout/re-authentication;
- localhost, Production, PR/branch preview, fixed slot, disposable environments when the task permits that evidence source;
- DevTools, CDP, Playwright, screenshots, console/network/API inspection;
- ordinary in-scope test-data creation/edit/deletion when the task permits it;
- PR creation, normal additive commits, push, and Draft PR maintenance within the assigned branch/authority;
- a bounded reversible Production correction when the task already grants Production mutation authority, the target is fresh, rollback is captured, and immediate verification is available.

For the autonomous frontier lane, “assigned authority” may be established by the worker's fresh collision-safe selection of an unowned bounded Issue or by creating a bounded child Issue, provided no existing branch/file/semantic authority is being competed with. That self-selection remains provisional implementation ownership, not final product acceptance.

Ready transition and merge are integration actions, not ordinary implementation actions in an active multi-model lane. They require the applicable task/owner authorization and the independent-review gate above.

Production correction authority is a separate question. A task may authorize a reversible Production action even while a related source PR remains Draft or CI-blocked; conversely, a merge-ready PR does not itself authorize Production/provider/DB mutation when the task requires separate approval.

## Owner-approved execution model

Default roles:

```text
Web CTO
Web Developer / designated implementation owner
Local Validation when required
```

Default lifecycle for ordinary source integration:

```text
user request
→ Web CTO contract / authority allocation
→ separate Web Developer or implementation owner
→ Local Validation only when required
→ Web CTO independent final review
→ user decision / authorized expected-head merge
```

Owner-approved autonomous advanced/frontier lifecycle:

```text
advanced/frontier implementation model
→ fresh current-main / Issue / PR / ownership inspection
→ select or create a bounded non-conflicting Issue
→ feature-branch implementation + focused tests
→ Draft PR + exact evidence
→ Web CTO independent post-implementation review
→ user decision / authorized expected-head merge
```

The second lifecycle is not a protocol violation merely because the CTO did not allocate the work first. The Web CTO must judge the resulting implementation on its actual technical, architectural, collision, safety, test, and CI evidence.

The same production source change should not normally be implemented and finally merged by the same implementation worker unless task-specific owner authority explicitly permits it. Web CTO may create designs, prototypes, exact copy, state contracts, patch drafts, remote forensic findings, or non-overlapping backlog corrections; a separate implementation owner may implement active platform/runtime source changes and report a new exact head for independent review.

That separation does not require a reversible Production incident correction to wait for a separate staging or test worker. When the Production action is separately authorized and rollback-ready, use the Production-first lane below.

An advanced/frontier autonomous worker may itself be the separate implementation owner. Its completion report is evidence input, not final CTO acceptance.

Older references to TF Leads, `UI Local`, `Feature Local`, or a generic local executor as the default production coder are superseded for current role allocation. This does not prohibit a specifically designated advanced/frontier local implementation model from operating under `docs/project/AUTONOMOUS_FRONTIER_IMPLEMENTATION_LANE.md`.

## Production-first / Rollback-first execution

For reversible Production correction, the default sequence is:

```text
fresh Production target/state
→ identify smallest mutation
→ capture previous value/version/SHA/config as rollback point
→ confirm task-specific Production authority
→ apply Production correction
→ immediate post-change verification
→ keep if healthy
→ rollback first if materially unhealthy
→ investigate and prepare follow-up after recovery
```

Do not turn local/staging/preview/CI completion into an automatic Production blocker solely because those checks have not finished.

Use pre-mutation work only to answer the questions that matter for safe direct operation:

```text
IS_THE_TARGET_CURRENT = YES
IS_THE_CHANGE_AUTHORIZED = YES
IS_THE_CHANGE_BOUNDED = YES
ROLLBACK_POINT_CAPTURED = YES
ROLLBACK_CREDIBLE = YES
POST_CHANGE_SIGNAL_DEFINED = YES
SECRET_PRIVATE_BOUNDARY_SAFE = YES
```

If any required answer is NO, stop and resolve that specific gap. Do not substitute a generic full test suite for a missing rollback plan or missing Production authority.

### Production-first eligible examples

- reversible runtime/config flags;
- known-version deployment switch with previous deployment retained;
- bounded route/provider configuration correction;
- small reversible data correction with previous value captured;
- separately authorized read-only Production diagnostic/reconciliation session;
- other narrow changes that can be observed and restored promptly.

### Stronger recovery preparation required

The following are not ordinary Production-first candidates unless a credible recovery strategy exists:

- destructive schema migration;
- irreversible data deletion;
- broad overwrite/mass rewrite;
- privilege/security-policy mutation;
- credential mutation without rollback/dual-validity path;
- destructive provider-resource deletion;
- any operation whose prior state cannot be reconstructed promptly.

The purpose of additional preparation is recovery assurance, not testing for its own sake.

### Failure handling

When a material regression is confirmed and rollback is available:

```text
ROLLBACK FIRST
→ verify recovery
→ preserve evidence
→ then perform forensics/root-cause analysis
```

Do not leave Production broken merely to gather more evidence.

Detailed policy: `docs/ops/PRODUCTION_FIRST_ROLLBACK_FIRST_POLICY.md`.

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

An autonomous advanced/frontier worker must perform this same authority check before self-selecting work. “I found the Issue myself” never overrides an existing writer lock.

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
- Production visual confirmation is the normal final loop under merge-first policy for ordinary source integration.

This is risk-proportional verification, not removal of quality controls. JavaScript behavior, DOM/focus/visibility semantics, auth/API/data/cache/storage, broad global/shared impact, dependencies, privacy, or security escalate to U2/U3.

A separately authorized reversible Production UI/runtime correction may use the Production-first lane instead of waiting for preview/local/full-suite completion, provided rollback and immediate verification are available.

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
- a safe reported deviation from the default role flow;
- prior CTO assignment when a designated advanced/frontier worker validly used the autonomous implementation lane;
- completed local/staging/preview/CI evidence before an otherwise authorized reversible Production correction.

Within an explicitly declared multi-model lane, writer ownership and no-competing-implementation rules are not advisory; they are the lane's active coordination authority.

## Evidence model

```text
LOCAL_EVIDENCE
PRE_MERGE_EVIDENCE
PRODUCTION_EVIDENCE
POST_CHANGE_EVIDENCE
ROLLBACK_EVIDENCE
```

Environment controls evidence strength, not permission. If evidence is limited, report the limitation rather than inventing a blocker.

For a Production-first correction, the highest-value immediate evidence is the exact Production before-state, change applied, rollback point, post-change behavior, and rollback result if used. Tests and CI may follow as regression/source-integration evidence.

For autonomous implementation, the worker's own completion report remains an evidence input. The Web CTO independently fresh-verifies current `main`, Issue/PR purpose, exact head/base/diff, writer ownership, tests, CI, and relevant architecture/safety boundaries before source-integration classification.

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

A proposed rule that requires all Production corrections to wait for pre-Production testing/CI is a new blocker and therefore needs explicit owner approval. The current owner-approved default is Production-first / Rollback-first for reversible corrections.

## Precedence

The following supersede conflicting historical process language:

- this document for hard blockers, CI classification, Production correction sequencing, multi-model writer authority, autonomous advanced/frontier implementation entry, and merge governance;
- `docs/ops/PRODUCTION_FIRST_ROLLBACK_FIRST_POLICY.md` for the focused reversible Production correction and rollback-first procedure;
- `docs/ops/PARALLEL_WORKTREE_AGENT_POLICY.md` for the operational branch/path/semantic-authority lock procedure;
- `docs/project/WEB_CTO_WEB_DEVELOPER_LOCAL_VALIDATION.md` for default role allocation;
- `docs/project/AUTONOMOUS_FRONTIER_IMPLEMENTATION_LANE.md` for the owner-approved self-directed implementation exception and CTO post-implementation review behavior;
- `docs/project/UI_RAPID_ITERATION_LANE.md` for UI process weight;
- `docs/ops/MERGE_FIRST_PRODUCTION_VERIFICATION_WORKFLOW.md` for ordinary source-merge-to-Production browser/evidence flow; it does not override the Production-first policy for separately authorized reversible Production corrections;
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