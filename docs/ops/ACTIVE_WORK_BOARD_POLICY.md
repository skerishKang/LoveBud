# Active Work Board and Parallel PR Ownership Policy

## Purpose

Prevent conflicts when multiple AI models, workers, computers, and fixed test slots work in parallel. Provide visibility into active work so the CTO does not need to manually remember every active PR, branch, file scope, and test slot. Maintain existing principles: no direct `main` pushes, PR-only merge flow, and PR #7/prototype/reference/demo/variant protection.

## Active Work Board Fields

Standard board row format for tracking active work:

```text
- Work ID:
- Issue:
- PR:
- Branch:
- Assigned worker/model:
- Assigned computer/worktree:
- Status:
  - planned
  - assigned
  - in_progress
  - waiting_review
  - blocked
  - ready_for_merge_candidate
  - merged
  - abandoned
- Allowed files:
- Forbidden files:
- Related PRs to avoid:
- Fixed test slot:
- Expected head SHA:
- Slot deployed SHA:
- Verification class:
  - docs_only
  - static_public_page
  - runtime_browser
  - auth_required
  - fixed_slot_required
- Last handoff/report:
- Blockers:
- CTO decision needed:
```

## Status Definitions

- **planned**: Work identified but not yet assigned
- **assigned**: Work assigned to worker/model/computer
- **in_progress**: Active work in progress
- **waiting_review**: Work complete, awaiting review/merge decision
- **blocked**: Work cannot proceed due to dependencies or conflicts
- **ready_for_merge_candidate**: All verification passed, ready for merge consideration
- **merged**: Work merged and completed
- **abandoned**: Work cancelled or superseded

## Parallel Work Rules

- One PR has one active owner worker/model at a time
- Two workers cannot modify the same branch simultaneously
- Check board for overlap before touching file ranges that might conflict
- STOP immediately if touching files outside allowed files for an active PR
- Do not touch PRs handled by other models without explicit CTO instruction
- Do not duplicate work on delegated PRs like #450
- Do not duplicate work on issues handled by other models like #464
- Do not mix UI queue, runtime queue, and docs queue work

## Conflict / Overlap Warning Rules

- **Index file conflicts**: If multiple PRs modify the same index file, sequencing is required
  - Examples: `docs/security/security_index.md`, `docs/product/product_index.md`, `docs/ops/ops_index.md`
- **Runtime file conflicts**: PRs modifying the same runtime JS file cannot merge before browser/fixed-slot verification
- **File classification**: 
  - `pages/**`, `css/**`, `js/**` classified as UI/runtime queue
  - `docs/**` classified as docs queue
- **Docs-only scope loss**: A docs-only PR that includes runtime files loses docs-only status
- **Workflow/package changes**: Require separate authorization

## Fixed Test Slot Tracking

- Work requiring fixed slots must specify the slot on the board
- Compare slot branch/deployed SHA with PR head SHA before proceeding
- PASS is forbidden if slot SHA is not confirmed
- Report as NOT_VERIFIED or BLOCKED if slot is missing
- Slot assignment is not performed by this document

## Dirty Worktree Handling

- STOP if `git status --short` is not empty
- Do not suggest commit/stash/restore/reset/clean operations
- Preserve dirty/untracked files
- Require clean worktree assignment

## Handoff/Report Format

Standard format for work handoff and status reports:

```text
Work Handoff Report

- Work ID:
- Issue:
- PR:
- Branch:
- Current head SHA:
- Base/main SHA:
- Status:
- Changed files:
- Allowed files matched:
- Forbidden files touched:
- Tests/checks run:
- Browser/fixed-slot verification:
- Slot:
- Slot SHA:
- Blockers:
- Next action:
- Merge performed:
- Issues closed:
- Protected paths touched:
```

## Protected Scopes

- **PR #7/prototype/reference/demo/variant**: Protected, do not touch
- **PR #450**: Protected if delegated/active elsewhere
- **Issue #464**: Protected if delegated/active elsewhere
- **UI PRs**: Should not be mixed with docs/process/runtime queues
- **Secrets**: Never output secret/token/cookie/session/credential values

## Relationship to Automation

- This PR establishes policy/docs layer only
- GitHub automation/check scripts are follow-up work
- GitHub Actions workflow changes are outside this PR scope
- Required checks are outside this PR scope
- Branch deletion/cleanup is outside this PR scope

## Current Active Work Examples

### Example 1: YouTube Segment Player PoC
```text
- Work ID: pr450-youtube-poc
- Issue: #366, #362
- PR: #450
- Branch: poc/youtube-segment-player-runtime-scaffold
- Assigned worker/model: [model handling #450]
- Assigned computer/worktree: [assigned computer]
- Status: ready_for_merge_candidate
- Allowed files: css/product/youtube-segment-player-poc.css, docs/product/YOUTUBE_SEGMENT_PLAYER_POC_RUNTIME_NOTES.md, docs/product/product_index.md, js/product/youtube-segment-player-poc.js, pages/youtube-segment-player-poc.html
- Forbidden files: PR #7/prototype/reference/demo/variant, runtime files outside PoC scope
- Related PRs to avoid: #460/#462/#463 UI queue
- Fixed test slot: not required (contained PoC)
- Expected head SHA: 12b7cf4b3648b2838598788880a2a4765c36589c
- Slot deployed SHA: N/A
- Verification class: runtime_browser (blocked by tool)
- Last handoff/report: [date/time]
- Blockers: Browser tool transport error
- CTO decision needed: Manual browser verification before draft release
```

### Example 2: Agent Startup Rules
```text
- Work ID: issue464-agent-startup
- Issue: #464
- PR: TBD
- Branch: TBD
- Assigned worker/model: [model handling #464]
- Assigned computer/worktree: [assigned computer]
- Status: in_progress
- Allowed files: docs/runbook, PR template, GitHub Actions workflow (requires authorization)
- Forbidden files: runtime files, UI files, PR #7/prototype/reference/demo/variant
- Related PRs to avoid: #450, UI queue
- Fixed test slot: N/A
- Expected head SHA: TBD
- Slot deployed SHA: N/A
- Verification class: docs_only
- Last handoff/report: [date/time]
- Blockers: CTO authorization needed for workflow changes
- CTO decision needed: YES (for PR 3 - CI PR body guard)
```

## Implementation Notes

This policy is intentionally lightweight and focused on coordination. It does not:
- Modify any code or runtime behavior
- Assign or manage actual test slots
- Perform GitHub Actions workflow changes
- Create required checks or automation
- Delete branches or merge PRs

The goal is to provide a durable, human-readable board format that prevents duplicate work and conflicts while parallel AI/workstation tasks are active.
