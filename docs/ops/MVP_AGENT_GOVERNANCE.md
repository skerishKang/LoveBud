# MVP Agent Governance

> **Status:** canonical source of truth — owner-approved (Issue #3442 comment `4947327550`; CI infrastructure-unavailable amendment: Issue #3642; separated execution-role model: Issue #3662)

This document is the **current canonical source of truth** for agent,
development, and browser governance in the LoveBud repository. Where any
other document conflicts with it, this document wins.

The authority for this document is the project owner's explicit approval in
Issue #3442, comment `4947327550`, together with the CI infrastructure
classification decision recorded in Issue #3642 and the execution-role decision
recorded in Issue #3662. Historical documents, runbooks, task summaries, and
closed-PR-specific instructions are **not** current authority outside their
explicitly named original scope. A restriction appearing in a repository
document is **not** by itself proof of owner approval.

## Authority

- Owner approval provenance: **#3442 comment `4947327550`** (the authoritative
  approval for the MVP implementation phase).
- CI infrastructure-unavailable amendment provenance: **Issue #3642**.
- Separated Web CTO / Web Developer / Local Validation operating-model
  provenance: **Issue #3662**.
- This document is the canonical source of truth for agent / development /
  browser governance.
- `docs/project/WEB_CTO_WEB_DEVELOPER_LOCAL_VALIDATION.md` is the focused source
  of truth for role allocation and handoff flow under Issue #3662.
- Historical documents and task-specific documents are not current authority
  outside their named, original context.
- The mere existence of a rule in a document does not prove owner approval.
- New project-specific blockers require traceable owner approval before they
  become normative (see *New restriction protocol*).

## Hard standing rules

Only the following are mandatory, enforced blockers. Everything else is
advisory or context-specific.

1. Do not expose or commit raw secrets, tokens, passwords, cookies,
   credentials, or private payloads (Firebase / Cloudflare / Modal / Neon, etc.).
2. Do not destructively delete or overwrite another worker's branch, worktree,
   stash, or uncommitted work.
3. Destructive production data deletion, destructive production schema change,
   or production security-policy change requires owner approval.
4. Do not merge on `CI_EXECUTED_FAILURE` or `CI_PENDING_EXECUTION`.
5. `CI_UNAVAILABLE_INFRA` is not a code failure. It may use the owner-approved
   alternative-evidence path in
   `docs/ops/CI_UNAVAILABLE_INFRA_MERGE_POLICY.md`.
6. Verify the expected PR head SHA, then squash merge.
7. Do not close #1882; use `Refs #1882` only.

## CI state classification

Use these exact states:

```text
CI_GREEN
CI_EXECUTED_FAILURE
CI_PENDING_EXECUTION
CI_UNAVAILABLE_INFRA
```

- `CI_GREEN`: required workflow jobs ran and passed.
- `CI_EXECUTED_FAILURE`: a relevant lint, build, test, or verification step ran
  and failed. This is a hard merge blocker.
- `CI_PENDING_EXECUTION`: a relevant job is genuinely queued or running. This
  is a temporary merge blocker.
- `CI_UNAVAILABLE_INFRA`: no relevant workflow step ran because of a confirmed
  billing, GitHub outage, runner allocation, or equivalent platform failure.
  This is neither proof of passing code nor a code failure.

A red workflow shell or job record with no executed steps may be classified as
`CI_UNAVAILABLE_INFRA` when the infrastructure cause is confirmed. A workflow
that actually reached a failing test step must be classified as
`CI_EXECUTED_FAILURE`.

The full evidence and merge requirements are defined in
`docs/ops/CI_UNAVAILABLE_INFRA_MERGE_POLICY.md`. This canonical classification
supersedes unqualified historical wording such as "CI must be green" or "do
not merge on red CI" when the workflow never executed for a confirmed
infrastructure reason.

## Allowed by default

The following are explicitly allowed by default. They are not gated behind a
special approval, a fixed slot, a PR comment, or a clean worktree.

- ordinary code, documentation, and test work on a branch / worktree
- starting and restarting a browser
- opening a new tab or new window
- navigation
- login / logout / re-authentication
- production
- PR preview
- branch preview
- fixed slot
- localhost
- disposable test environment
- DevTools
- CDP
- Hermes
- Playwright
- screenshots
- console / network / API inspection
- creating, editing, or deleting ordinary test data within task scope
- creating a PR, adding commits, and moving it to ready
- squash merge after remote diff review, expected-head confirmation, and either
  `CI_GREEN` or the documented `CI_UNAVAILABLE_INFRA` alternative-evidence path

## Owner-approved execution-role model

Issue #3662 establishes the default LoveBud execution roles:

```text
Web CTO
Web Developer
Local Validation
```

The lifecycle has four stages because the Web CTO participates before and
after implementation:

```text
user request
→ Web CTO contract
→ separate Web Developer implementation
→ Local Validation evidence
→ Web CTO independent final review
→ user decision / expected-head squash merge
```

Role allocation:

- **Web CTO:** remote verification, product/design/architecture contract,
  allowed/forbidden scope, tests/evidence definition, final independent review,
  READY / CONDITIONALLY_READY / NOT_READY, expected-head merge judgment.
- **Web Developer:** implementation in a separate web conversation/context,
  tests, feature-branch commits, Draft PR, CI correction, exact evidence report.
- **Local Validation:** exact-head checkout, local/environment/browser/auth/
  database/OS/provider execution, raw evidence, minimal explicitly authorized
  integration changes only.

The same production change should not be implemented and finally approved in
the same conversation/context. A Web CTO may author prototypes, design
references, copy, state contracts, or patch drafts, but production
implementation and final approval should remain independently separated.

This is the default operating model. A task may explicitly use another safe
arrangement, but it must preserve the hard standing rules and report the
resulting evidence limitation. Role-model deviation is not by itself a new
automatic merge blocker.

Older repository references that treat TF Leads, `UI Local`, `Feature Local`,
or a generic local executor as the default production coder are superseded for
current role allocation by Issue #3662 and
`docs/project/WEB_CTO_WEB_DEVELOPER_LOCAL_VALIDATION.md`.

## Advisory, not blockers

The following may be recommendations, but they are **not** automatic `BLOCKED`
reasons:

- one task per branch — violating it is not an automatic blocker
- draft PR by default — draft state is not an automatic blocker
- fixed slot — its absence is not an automatic blocker; a fixed slot is an evidence option, not a permission gate
- PR-specific Browser verification entrypoint comment — its absence is not an automatic blocker
- CTO-assigned URL — its absence is not an automatic blocker
- URL provenance recording
- narrow diff
- minimal-change preference
- local static server verification limits
- module size guidance
- large-refactor separate-audit guidance
- an explicitly reported, safe deviation from the default execution-role model

## Evidence model

The environment indicates *permission of a claim's strength*, not whether work
may proceed. It is evidence, not a license gate.

```text
LOCAL_EVIDENCE
PRE_MERGE_EVIDENCE
PRODUCTION_EVIDENCE
```

Examples:

```text
localhost UI behavior confirmed
→ LOCAL_EVIDENCE

branch behavior confirmed on PR Preview
→ PRE_MERGE_EVIDENCE

behavior confirmed on production after merge/deploy
→ PRODUCTION_EVIDENCE
```

If evidence is limited, report the limitation — do not stop the work.

## Dirty worktree

```text
dirty worktree discovered
→ preserve existing changes
→ use another worktree/branch or read-only inspection
→ not an automatic BLOCKED
```

Only an action that would actually discard work — `clean` / `reset` / `stash
drop` / overwrite — requires owner confirmation.

## New restriction protocol

A new mandatory blocker must include all of the following:

```text
restriction proposal
reason
scope
development-speed impact
alternatives
traceable owner approval reference
```

If the owner approval reference is missing, the restriction is:

```text
RECOMMENDATION_ONLY
```

---

*Supersedes conflicting historical guidance. Documents that previously treated
the items in *Advisory, not blockers* as automatic blockers are marked
`NON_NORMATIVE_OUTSIDE_NAMED_CONTEXT` or
`SUPERSEDED_BY_MVP_AGENT_GOVERNANCE`. Older role-allocation language is
superseded by Issue #3662 for current work.*

Refs #3662
Refs #3642
Refs #3442
Refs #3441
Refs #3437
Refs #3435
Refs #1882
