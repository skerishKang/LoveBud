# Active Work Board & Parallel PR Ownership Policy

**Scope:** Operational policy for parallel work management across multiple agents/workers on the LoveBud repository.

**Status:** Active | **Effective:** Immediately | **Applies to:** All concurrent work

---

## 1. Purpose

LoveBud operates with multiple agents/workers performing parallel tasks. This policy defines how work is tracked, owned, and coordinated to prevent conflicts, ensure clear handoffs, and maintain a single source of truth for "what is being worked on right now."

This is not a task assignment system — it is a **visibility and coordination layer** that makes in-progress work explicit across the team.

---

## 2. Board Fields (the "Active Work Board" record structure)

Each active work entry (one row/card on the board) MUST contain:

| Field | Type | Description | Required |
|-------|------|-------------|----------|
| `id` | string | Unique identifier (e.g., `AGENT-20260430-001` or PR/worktree reference) | Yes |
| `owner` | string | Agent name or human identifier | Yes |
| `branch` | string | Git branch name (if applicable) | Yes |
| `title` | string | One-line summary of the work scope | Yes |
| `status` | enum | `in_progress`, `blocked`, `review`, `merged`, `abandoned` | Yes |
| `scope` | string | Affected paths or subsystems (e.g., `pages/editor.html`, `docs/ops/`) | Yes |
| `discovery_url` | string | PR/issue/artifact URL (if exists) | No |
| `test_slot` | string | Assigned Cloudflare test slot URL (if allocated) | No |
| `blocked_reason` | string | Why `blocked` (dependency, conflict, missing secret) | Conditional |
| `last_update` | timestamp | ISO 8601 timestamp of last status change | Yes |
| `handoff_notes` | string | Context for next worker or reviewer | No |

**Storage format:** Markdown table in `docs/ops/ACTIVE_WORK_BOARD.md` (single file, canonical board).

---

## 3. Status Definitions

| Status | Meaning | Transition triggers |
|--------|---------|---------------------|
| `in_progress` | Actively being worked on; branch exists; changes not ready for review | Start of any work; manual |
| `blocked` | Waiting on external dependency (secret, test slot, API) before continuing | Dependency arrival → `in_progress` |
| `review` | Work complete locally, PR created, awaiting human/agent review | PR draft published → `review` |
| `merged` | Changes merged to `main` branch | PR merged → `merged` |
| `abandoned` | Work discontinued; branch may be deleted | Owner abandon note → `abandoned` |

**Rule:** Status changes are recorded by the owner only. Observers may suggest but not unilaterally change.

---

## 4. Parallel Work Rules (Concurrent Work Safety)

### 4.1 Same-file conflict prevention
- If two entries target **overlapping file paths**, the later-comer MUST:
  1. Comment on the earlier owner's PR/thread (if exists)
  2. Propose explicit coordination (handoff or merge order)
  3. Wait for conflict resolution before modifying overlapping files

### 4.2 Same-component proximity
- For adjacent, non-overlapping files in same feature area (e.g., `editor.html` + `editor.css`), owners should still:
  - Announce intent in channel/thread
  - Consider time-boxed handoff windows to avoid merge conflicts

### 4.3 Test slot allocation
- One PR/test slot per active entry unless slots are truly isolated.
- If slot is shared, owners coordinate access schedule in handoff notes.

---

## 5. Conflict Detection & Resolution Rules

### 5.1 Automatic signals (observable via git/PR API)
- **Branch name collision:** Reject `git worktree add` / `git checkout -b` if target branch exists remotely and owner differs.
- **File path overlap:** On PR draft, `git diff origin/main...HEAD --name-only` compared against other active entries' `scope` fields. Flag overlaps > 0.
- **PR draft overlap:** If two draft PRs touch lovebud/lovebud repo and shared file paths, mark both `blocked` until resolved.

### 5.2 Manual coordination
- Owners encountering potential conflict MUST:
  1. Document overlap in `blocked_reason`
  2. Tag other owner in thread/comment
  3. Propose merge order or handoff

### 5.3 Resolution outcomes
- Merge order agreed → proceed, status stays `in_progress` / `review`
- Handoff accepted → old owner sets `abandoned`, new owner creates new entry with `discovery_url` linking to predecessor
- No agreement within 24h → escalate to CTO (per `docs/project/REPORTING_CHAIN.md`)

---

## 6. Fixed Test Slot Tracking

Cloudflare Pages test slots are shared, finite resources.

**Assignment:**
- Test slot URL is recorded in active entry `test_slot` field upon creation.
- Slot URLs themselves are **not secret** (public preview URLs), but allocation is exclusive.
- If a slot is pre-assigned per `docs/ops/TEST_PREVIEW_SLOTS.md`, use that mapping.

**Wait queue:**
- If no slot free, entry status `blocked` with `blocked_reason: "awaiting-test-slot-<slot-name>"`.
- When slot freed (PR merged/abandoned), next `blocked` entry claiming it moves to `in_progress`.

**Rotation policy:**
- Do not hold a test slot after PR merged; release immediately.
- Do not "reserve" slots for future work without active branch.

---

## 7. Dirty Worktree / Lock Handling

Any agent encountering a git worktree with:
- `index.lock` or `.git/index.lock` present
- Staged changes that are not part of active work
- Untracked temp/backup artifacts inside repo

**MUST:**
1. Halt work immediately.
2. Report `dirty-work-tree` condition with:
   - `git status --short` output
   - `git diff --name-only` if safe
3. NOT attempt `git clean` / `git reset --hard` without explicit human OK.

**Cleanup protocol:**
- Human or authorized agent runs cleanup on that worktree only.
- Worktree marked `blocked` until lock cleared.

---

## 8. Handoff & Final Report Format

When an entry transitions to `merged` or `abandoned`, owner adds a one-line note to `handoff_notes`:

```
[merged] PR #460 merged to main; editor empty-state CTA fixed; no follow-ups.
[abandoned] Scope too large for single branch; split into #461 (API) + #462 (UI).
[blocked→in_progress] Test slot CF-03 allocated; smoke check GREEN; proceeding to CI.
```

For `abandoned` entries, also create a follow-up issue/PR if work continues elsewhere and link via `discovery_url`.

---

## 9. Protected Scopes (read-only zones)

Certain files/paths are **protection scope** — do not modify without explicit cross-agent approval:

- `AGENTS.md` (unless your task is explicitly to modify it)
- `docs/ops/ACTIVE_WORK_BOARD.md` (this board file; only board-maintainer role may edit entries other than their own status)
- `docs/project/REPORTING_CHAIN.md`
- Any file under `docs/engineering/` with `source-of-truth` header note

If your work touches protected scope:
1. Create a separate, minimal PR touching only protected files.
2. Do NOT bundle with feature/fix changes.
3. Tag CTO in PR description using `@` mention.

---

## 10. Relationship to Existing Automation & Guardrails

This policy **does not replace** existing automation. It operates alongside:

- Local PR guardrail scripts (e.g., `scripts/check-pr-guardrails.js`) — still enforced pre-commit.
- Smoke test pre-checks (e.g., `scripts/cloudflare-supplied-url-smoke.js`) — still required before marking `review`.
- Existing `docs/ops/*` policies (E2E smoke, auth test slots) — remain in force; this policy only adds **parallel-work coordination layer**.

**Key integration points:**
- `status: review` implies smoke test passed (PR template gate).
- `test_slot` field must match slot allocated by `docs/ops/TEST_PREVIEW_SLOTS.md`.
- `scope` changes trigger conflict detection against other active entries' `scope`.

---

## 11. Entry Lifecycle & Cleanup

**Creation:** At work start (branch creation or investigation), owner adds entry to `docs/ops/ACTIVE_WORK_BOARD.md`.

**Update:** On status change, owner edits their own row (timestamp + status + notes). No deletion.

**Archival:** Monthly (or on `main` merge day), CTO archives entries older than 30 days with status `merged`/`abandoned` to `docs/ops/ARCHIVED_WORK_BOARD_YYYY-MM.md`.

**Active board size:** Keep under 30 entries; if >25, prioritize and close stale entries.

---

## 12. Enforcement & Observability

- **Self-enforced:** Owners responsible for accurate entries.
- **Audit trigger:** CI step (future) could parse board file for `in_progress` entries and verify corresponding branches exist.
- **Dispute resolution:** See `docs/project/REPORTING_CHAIN.md` → escalate to CTO.

---

**TL;DR:** Declare your work on the Active Work Board before starting. Keep your entry up-to-date. Coordinate on overlaps. Respect test slots. Clean up on merge. This is our single source of truth for parallel work.
