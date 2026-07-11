# MVP Agent Governance

> **Status:** canonical source of truth — owner-approved (Issue #3442 comment `4947327550`)

This document is the **current canonical source of truth** for agent,
development, and browser governance in the LoveBud repository. Where any
other document conflicts with it, this document wins.

The authority for this document is the project owner's explicit approval in
Issue #3442, comment `4947327550`. Historical documents, runbooks, task
summaries, and closed-PR-specific instructions are **not** current authority
outside their explicitly named original scope. A restriction appearing in a
repository document is **not** by itself proof of owner approval.

## Authority

- Owner approval provenance: **#3442 comment `4947327550`** (the authoritative
  approval for this implementation phase).
- This document is the canonical source of truth for agent / development /
  browser governance.
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
4. Do not merge when CI is red or pending.
5. Verify the expected PR head SHA, then squash merge.
6. Do not close #1882; use `Refs #1882` only.

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
- squash merge after remote diff review, CI green, and expected-head
  confirmation

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

## Evidence model

The environment indicates *permission of a claim's strength*, not whether work
may proceed. It is evidence, not a license gate.

```
LOCAL_EVIDENCE
PRE_MERGE_EVIDENCE
PRODUCTION_EVIDENCE
```

Examples:

```
localhost UI behavior confirmed
→ LOCAL_EVIDENCE

branch behavior confirmed on PR Preview
→ PRE_MERGE_EVIDENCE

behavior confirmed on production after merge/deploy
→ PRODUCTION_EVIDENCE
```

If evidence is limited, report the limitation — do not stop the work.

## Dirty worktree

```
dirty worktree discovered
→ preserve existing changes
→ use another worktree/branch or read-only inspection
→ not an automatic BLOCKED
```

Only an action that would actually discard work — `clean` / `reset` / `stash
drop` / overwrite — requires owner confirmation.

## New restriction protocol

A new mandatory blocker must include all of the following:

```
restriction proposal
reason
scope
development-speed impact
alternatives
traceable owner approval reference
```

If the owner approval reference is missing, the restriction is:

```
RECOMMENDATION_ONLY
```

---

*Supersedes conflicting historical guidance. Documents that previously treated
the items in *Advisory, not blockers* as automatic blockers are marked
`NON_NORMATIVE_OUTSIDE_NAMED_CONTEXT` or `SUPERSEDED_BY_MVP_AGENT_GOVERNANCE`.*

Refs #3442
Refs #3441
Refs #3437
Refs #3435
Refs #1882
