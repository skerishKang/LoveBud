# #3197 — Social Runtime Fixture Governance Contract

> This document governs controlled social runtime fixture and dedicated test identity
> for #3183 comment lifecycle verification. It is source-controlled and credentials-free.
> It does **not** provision any fixture, issue any credential, or authorize production writes.

## References

- #3183 — v24 controlled comment lifecycle verification (blocked: fixture unavailable)
- #3197 — this issue: social runtime fixture governance
- #3184 — browse social features (not started)
- #3075 — social runtime UI (not started)
- #1882 — lovebud live integration test harness (open, always Refs only)

---

## 1. Dedicated Test Identity

A dedicated non-user test identity is required for lifecycle verification. It must:

- be separate from any real user account
- not be used for any purpose other than controlled lifecycle runs
- not have its credential, token, email, UID, or any identifying value recorded in
  repository, PR, issue, log, or handoff

## 2. Controlled Public Fixture

The fixture comprises one public tree and one public memory on that tree. It must:

- contain synthetic, non-production-content only
- be intentionally readable via public guest GET endpoints (no auth required)
- not expose its tree ID, memory ID, or any path parameter in documented form
- not be referenced by any production-facing UI or search index

## 3. Disposable Synthetic Comment Lifecycle

Each verification run creates exactly one synthetic comment on the fixture memory.
The lifecycle order is:

1. Create: POST 1 synthetic comment via authenticated API
2. Self-delete: DELETE that comment via the same authenticated identity
3. Guest confirm: GET public comments — deleted comment must not appear
4. Repeat delete: DELETE the same comment again — must return deterministic result

The comment body is a runtime-only value. It must not be stored, logged, or reported.

## 4. Safe Evidence and Reporting Boundary

Reports from any lifecycle run must contain **only**:

- HTTP status code
- upstream indicator (x-lovebud-upstream)
- request ID (x-lovebud-request-id)
- safe category (error_category) and safe phase (failure_phase)
- deterministic result pass/fail

The following must **never** be included in any report, log, handoff, or evidence:

- token, credential, cookie
- UID, email, account identifier
- tree ID, memory ID, comment ID
- comment body text
- full response body
- raw Modal log
- SQL query, SQLSTATE, DB error

## 5. Governance Completion Boundary

Approval of this governance document does **not** authorize:

- Firebase identity creation
- token or credential issuance
- fixture tree or memory creation
- any production write operation
- any DB/SQL access or migration
- Cloudflare, Firebase, or Modal configuration or secret changes
- any browser-based social interaction
- #3184 or #3075 UI work

Fixture provisioning requires a separate, explicit production-fixture approval
after #3197 governance is merged.

## 6. Out-of-Scope Operations

The following are permanently out of scope for this governance and for any
lifecycle verification conducted under it:

- direct DB/SQL queries or migrations
- Cloudflare Pages / Functions config or secret changes
- Firebase project config or secret changes
- Modal deploy, rollback, config, or secret changes
- package or dependency changes
- source code edits (tests excepted for contract-only additions)
- real user data access or exposure

## 7. Issue Status Governance

- #3183 remains open until fixture availability AND runtime lifecycle PASS
- #3184 and #3075 UI work must not be started under this governance
- #1882 remains open; this issue uses Refs #1882 only, never Fixes

## 8. Policy Invariants

These invariants must hold at all times:

- No fixture identity, token, email, UID, tree/memory/comment ID, or comment body
  is ever checked into source control, issues, PRs, handoffs, or evidence reports.
- No production URL is used as an example in governance documentation.
- No sensitive fragment is printed by any contract test output.
- Governance completion is purely documentary — it does not flip any runtime flag
  or enable any new API path.
