# #3201 — Moment Social Write Readiness Gate

> This document defines the boundary for eventual actionable social UX (the #3075
> parent issue). It does **not** enable like/comment write UI, perform any runtime
> or production action, or close any open issue.

## References

- #3184 — Public read-only selected-moment social summary (complete)
- #3075 — Actionable social UX for moment likes/comments (parent, not started)
- #3201 — This gate: documentation-and-contract baseline
- #3192 — Controlled runtime fixture governance
- #1882 — LoveBud live integration test harness (open, always Refs only)

---

## 1. Current Boundary

- **#3184 is complete.** The public Tree Workspace detail panel now reads
  reaction aggregates and bounded comment totals through guest-safe public-read
  APIs. The surface is read‑only: no like toggle, no comment composer, no
  sign‑in prompt, no mutation affordance.
- **#3075 remains the parent** for any future actionable social UX that adds
  like/comment write surfaces. This document and its companion contract test do
  not enable such UI.
- **No write UI has been implemented or wired.** Every future implementation
  issue under #3075 must satisfy the decision table in section 2, the
  authenticated-write rules in section 3, and the controlled-lifecycle protocol
  in section 4 before production activation.

---

## 2. Source-of-Truth API Decision Table

| Viewer state | Social read | Social write | Authority |
|---|---|---|---|
| Guest / no auth | `fetchPublicMomentReactionSummary(treeId, memoryId)` + `fetchPublicMomentComments(treeId, memoryId)` | None — no write affordance | Public guest-safe API |
| Confirmed authenticated viewer | `fetchPublicMomentReactionSummary(treeId, memoryId)` + `fetchPublicMomentComments(treeId, memoryId)` for public display; private `fetchReactionSummary(memoryId)` for auth-specific reaction state only | `toggleReaction(memoryId, type, idempotencyKey)` and `createComment(memoryId, body, idempotencyKey)` only after explicit user activation + confirmed auth session | Authenticated API + guest-safe public read for display |
| Auth unknown / not ready | Same as guest — no private social request may be issued | None | Public guest-safe API only |
| Root, missing, private, mismatched, or unavailable selected moment | No social request is issued | None | N/A — social card hidden |

### Display Rule

- Public comment display **must always** use the guest-safe public comments
  reader (`fetchPublicMomentComments(treeId, memoryId)`), including for
  signed‑in viewers.
- The private `fetchComments(memoryId)` must **not** be used for the public Tree
  Workspace comment display because it returns account‑scoped fields that the
  public surface does not need.

---

## 3. Authenticated Write Boundaries

Any future implementation that adds like or comment write surfaces **must**:

1. Require explicit user activation (e.g. button click, not pre‑fetch or
   speculative call).
2. Confirm an authenticated session at the time of the activation.
3. Batch the write through the authenticated API:
   - `toggleReaction(memoryId, type, idempotencyKey)`
   - `createComment(memoryId, body, idempotencyKey)`
4. After the write, reconcile the public read‑only display via the same
   guest‑safe public read endpoints (section 2), never via the private read
   path.
5. Never leak idempotency key, raw write response, token, UID, or comment body
   to the user‑facing UI, error surface, or accessibility tree.

---

## 4. Controlled Runtime Verification Protocol

Any future runtime lifecycle verification under #3075 must follow the protocol
established in #3192:

- Use **only** the designated non-user test identity and synthetic public fixture.
- Perform a **reversible** reaction lifecycle: toggle reaction → public‑read
  reconciliation → toggle again → confirm removal.
- Perform a **controlled** comment lifecycle: create → public‑read visibility
  → self‑delete → public‑read filtering.
- Report **outcome categories only** (PASS / BLOCKED / FAIL + safe category).
- **Never** put tokens, UIDs, emails, fixture IDs, fixture URLs, comment bodies,
  raw responses, raw logs, stack traces, or request payloads in docs, tests,
  PRs, issues, or reports.

---

## 5. Permanent Exclusions

The following are permanently out of scope for this gate and for any
implementation work conducted under it:

- Reaction/comment UI, composer, drawer, sign‑in affordance, or optimistic
  mutation.
- Backend, API, DB, schema, migration, config, package, dependency,
  deployment, or rollback changes.
- Browse, My Trees, tree‑level social, moderation UI, or Scout‑related work.
- Direct SQL, database inspection, real‑user data access, or runtime production
  calls.
- Closing #3201, #3075, #3192, or #1882 by this gate alone.

---

## 6. Posture

This gate is purely documentary. It does not flip any runtime flag, wire any
UI path, or enable any production behavior. Every future issue that adds
actionable social UX must reference this gate and satisfy its requirements
before production activation.
