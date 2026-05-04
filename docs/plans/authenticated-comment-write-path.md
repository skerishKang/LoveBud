# Authenticated Comment Write Path

Refs #756

## Purpose

Define the authenticated comment write path for public LoveTree social surfaces after read contracts, placeholder placement, and moderation baseline decisions are established.

This document is planning-only. It does not implement comment writing, API routes, database schema, Auth behavior, UI controls, or runtime behavior.

## Product boundary

Authenticated comment writing is a future public social feature. It must be enabled only when the runtime/API boundary can enforce permissions, moderation, rate limits, and safe failure behavior.

Client-only hiding is not sufficient. Any visible write affordance must map to an API path that enforces the same rule server-side.

## Write eligibility

A user may attempt to write a comment only when all of the following are true:

1. The user has an authenticated session.
2. The parent LoveTree is publicly readable.
3. The target social scope is valid:
   - tree-level comment target for the whole public LoveTree; or
   - moment-level comment target for a selected public moment.
4. The target is not deleted, hidden, moderated, or otherwise unavailable.
5. Rate-limit and abuse-control checks pass.
6. The write API can return a safe public response shape without exposing private identifiers.

Anonymous comment writing is out of scope for v0.1.

## Scope separation

Authenticated comment writing must keep two write scopes separate:

| Scope | Target | UI surface | Required guard |
|---|---|---|---|
| Tree-level comment | Whole public LoveTree | Public viewer tree-level social area | Parent tree public read guard |
| Moment-level comment | One selected public moment | Selected-moment social area | Parent tree public read guard + target moment public guard |

A tree-level comment must not be silently converted into a moment-level comment, and a moment-level comment must not roll up as if it belongs to the whole tree.

## UI state model

Future implementation should use a clear state machine.

| State | Meaning | User-facing behavior |
|---|---|---|
| `hidden` | Writing is not available in this phase or target | No composer shown |
| `login_required` | Viewer is not authenticated | Show login guidance only if write path is otherwise ready |
| `idle` | Authenticated user may write | Composer enabled |
| `submitting` | Comment is being sent | Disable duplicate submit and show progress |
| `success` | Comment was accepted | Show the new comment or success feedback |
| `retryable_failure` | Network or temporary failure | Safe error copy and retry affordance |
| `blocked_failure` | Auth, rate-limit, moderation, or permission failure | Safe explanation; no raw error payload |

Do not show a composer that looks active if the API write path is not implemented.

## Loading, success, failure, and retry behavior

### Loading

- Disable duplicate submit while request is pending.
- Preserve unsent text locally during a retryable failure.
- Avoid optimistic public insertion unless the API confirms the comment was accepted.

### Success

- Insert the accepted comment into the correct scope only.
- Clear the composer only after the API succeeds.
- Show a quiet success state when needed.
- Do not expose raw comment IDs or DB row values in UI or reports.

### Retryable failure

Retryable failures include network timeout, temporary API unavailability, or unknown server failure.

Required behavior:

- keep drafted text;
- show safe copy such as `댓글을 남기지 못했어요. 다시 시도해 주세요.`;
- expose retry;
- avoid raw exception details.

### Blocked failure

Blocked failures include logged-out state, permission failure, rate-limit, target unavailable, or moderation block.

Required behavior:

- do not retry automatically;
- show a safe reason category where available;
- do not expose private identifiers, policy internals, raw payloads, or backend stack traces.

## Delete-own-comment direction

Authenticated users should be able to soft-delete their own comments when the write system reaches the corresponding moderation phase.

Rules:

- author delete is soft-delete only;
- public display should show a safe deleted placeholder if thread continuity is needed;
- author delete must not hard-delete records directly;
- deleted comments must not appear as active public comments;
- restore is out of scope for normal users.

Delete-own-comment implementation depends on the moderation baseline and audit model.

## Owner moderation boundary interaction

Owner moderation is a separate capability from author write/delete.

Required boundary:

- authors may edit/delete their own comments according to the write policy;
- tree owners may hide or soft-delete comments on their own public LoveTree only when moderation APIs exist;
- owner moderation actions must not be exposed to non-owners;
- owner and author actions must produce distinct audit labels;
- client UI must not be the only enforcement layer.

## Abuse-control dependencies

Comment writing must not ship until the following are implemented or explicitly deferred with CTO approval:

| Dependency | Minimum expectation | Status in this plan |
|---|---|---|
| Auth gate | Write requires authenticated session | Required |
| Rate limiting | Prevent rapid repeated writes | Required before production enablement |
| Duplicate submit guard | Prevent duplicate comments from repeated clicks | Required |
| Soft-delete retention | Deleted comments are retained safely | Required |
| Audit log | Author/owner/system moderation actions are recorded | Required |
| Safe response shape | Public response omits private identifiers | Required |
| Moderation baseline | Owner/author/reporting policy is defined | Required dependency |

## API contract expectations

Future API implementation should provide safe status labels and avoid raw internal values.

Suggested response categories:

- `COMMENT_WRITE_ACCEPTED`
- `LOGIN_REQUIRED`
- `TARGET_NOT_PUBLIC`
- `TARGET_NOT_AVAILABLE`
- `RATE_LIMITED`
- `DUPLICATE_SUBMISSION`
- `MODERATION_BLOCKED`
- `RETRYABLE_FAILURE`
- `UNKNOWN_FAILURE`

Reports should use these status labels rather than raw IDs, owner values, database rows, tokens, sessions, cookies, or private payloads.

## Fixed-slot/API verification plan

Any implementation PR must be verified in a runtime target with deployed SHA matching the PR head.

Required report fields:

1. Target scope tested: TREE_LEVEL / MOMENT_LEVEL / BOTH.
2. Logged-out write behavior: PASS/FAIL/NOT_TESTED.
3. Logged-in write behavior: PASS/FAIL/NOT_TESTED.
4. Submit loading state: PASS/FAIL/NOT_TESTED.
5. Success state: PASS/FAIL/NOT_TESTED.
6. Retryable failure state: PASS/FAIL/NOT_TESTED.
7. Blocked failure state: PASS/FAIL/NOT_TESTED.
8. Delete-own-comment behavior: PASS/FAIL/NOT_TESTED.
9. Owner moderation boundary: PASS/FAIL/NOT_TESTED.
10. Rate-limit or duplicate guard: PASS/FAIL/NOT_TESTED.
11. Fatal console/network errors: NONE/PRESENT.
12. Secret/private payload exposure: NO.

## Implementation split

Future work should be split into narrow PRs:

| Unit | Scope | Depends on |
|---|---|---|
| A | Schema/audit support for comment records and soft-delete | Moderation baseline |
| B | Tree-level authenticated comment write API | Unit A |
| C | Moment-level authenticated comment write API | Unit A |
| D | Tree-level composer UI | Unit B |
| E | Moment-level composer UI | Unit C |
| F | Delete-own-comment API and UI | Units B/C + audit support |
| G | Owner moderation API and UI | Moderation baseline + audit support |

Do not combine write API, moderation controls, and broad social UI redesign into one PR.

## Out of scope

- anonymous comments;
- comment read contract implementation;
- reactions/counts implementation;
- Browse ranking changes;
- broad social redesign;
- unrelated Auth flows;
- Browse card redesign;
- My Trees card cleanup;
- package/workflow changes;
- PR #7 / prototype / reference / demo / variant paths.

## Status

- Planning: READY
- Runtime implementation: NOT STARTED
- Related issue: #756
- Parent social model: #622
- Related moderation baseline: #758
