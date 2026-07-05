# Controlled Moment Comment Runtime Lifecycle Gate

**PROTOCOL DESIGN READY; RUNTIME EXECUTION NOT AUTHORIZED**

This document defines the execution protocol for a future controlled authenticated moment-comment runtime lifecycle verification. It is a design document only — it does not authorize runtime execution, composer UI, or any production mutation.

---

## References

- #3227 — This design document
- #3225 — Authenticated moment-comment write boundary audit (complete, source-level)
- #3075 — Actionable social UX for moment likes/comments (open, always Refs only)
- #3218 — Public read-only moment comments panel (complete)
- #1882 — Parent product issue (open, always Refs only)

---

## 1. Purpose and Decision

This gate assumes the static audit conclusions from #3225 / PR #3226:
- Source-level write boundary is ready
- Firebase auth, visibility guard, idempotency, rate limiting, audit, and atomic commit/rollback are in place
- Composer UI is not authorized

This document specifies the **runtime execution protocol** for a future controlled verification. Its successful merge does **not** authorize any of the following:
- Runtime execution
- Composer UI
- Any mutation API call
- Any production or browser-based behavior

Even if this gate is approved and merged, the composer UI remains unauthorized without a separate explicit composer authorization issue.

---

## 2. Identity and Fixture Isolation

**This document does not select or authorize an execution environment.** A separate explicit execution authorization is required before any runtime call. That separate authorization must pre-approve the isolated environment and designated non-user synthetic identity.

**Designated identity and fixture for future runtime verification (requires separate execution authorization):**
- Designated synthetic test identity (Firebase test user, no real user association)
- Synthetic public tree with synthetic moments

**Prohibited:**
- Real user accounts
- Real user personal accounts
- Real user content
- Non-designated fixtures
- This document does not authorize production, staging, browser, or Firebase session execution

**If isolation cannot be proven in advance: immediately `BLOCKED`, stop without making any runtime call.**

**No tokens, UIDs, emails, fixture IDs, fixture URLs, or comment bodies may appear in any documentation, PR, issue, or report.**

---

## 3. Preflight Stop Conditions

Stop and abort without making any runtime call if **any** of the following are true:

1. Synthetic identity or fixture isolation is unclear or unproven
2. Auth scope or visibility scope does not match expectations
3. Cleanup authority or lifecycle support is unclear
4. There is risk that raw responses or sensitive data could be recorded
5. Selected moment scope cannot be guaranteed

If any of these conditions are met: output `BLOCKED` with a safe coarse category, then stop. Do not proceed to any runtime call.

---

## 4. Minimal Future Runtime Sequence

If all preflight conditions pass, the minimal runtime sequence is:

1. **Synthetic identity/fixture confirmation** — confirm the designated synthetic identity and fixture are available
2. **Authenticated create comment** — using the private authenticated endpoint, create one comment with a known idempotency key on a designated synthetic moment
3. **Public-read reconciliation** — read the same moment's public comments via the public read path; verify the new comment appears with correct fields
4. **Duplicate submit / idempotency replay** — submit again with the same idempotency key; verify the replay is returned, not a duplicate
5. **Safe blocked / retry category** — verify blocked results are categorized correctly as safe-blocked (do not retry) vs retryable
6. **Cleanup** — clean up through the supported lifecycle authority (e.g., soft-delete via the authorized self-deletion route if available and in-scope)

Each step records only:
- Step name
- Outcome: `PASS` / `BLOCKED` / `FAIL`
- Coarse safe category (e.g., `safe-auth`, `safe-idempotency`, `safe-visibility`)

**Note on audit:** The source-level audit in #3225 confirmed the presence of audit recording guardrails. This protocol does **not** authorize direct database inspection, audit-log retrieval, or audit-log review. Runtime verification reporting is limited to step name, `PASS/BLOCKED/FAIL`, and coarse safe category only.

---

## 5. Pass / Fail / Blocked Rules

- **Replay creates a duplicate comment → `FAIL`** (idempotency violation)
- **Public read returns a different moment's data → `FAIL`** (stale selected-moment overwrite)
- **Public reconciliation is not scoped to the designated selected moment → `FAIL`**
- **Unexpected authorization or visibility result → `BLOCKED` or `FAIL`** depending on scope confidence
- **Cleanup outcome cannot be confirmed safely → `BLOCKED`**
- **During runtime execution, if scope-external data is reached → immediately abort**
- **If at any point confidence in scope boundary is lost → `BLOCKED`, stop**

---

## 6. Safe Error and Retry Taxonomy

**Retryable (safe to retry):**
- Transient network timeouts
- Rate limit responses with appropriate backoff and within scope limits
- 5xx errors from the public read path only, with scope-confirmed moments

**Immediately blocked (do not retry):**
- Any response containing unexpected authorization scopes
- Any mutation that would expand scope beyond the designated moment
- Idempotency key rotation to bypass rate limits
- Any operation that mutates non-designated data

**Never record in logs, reports, or documentation:**
- Raw backend payloads
- HTTP headers
- Stack traces
- Token values
- UID values
- Email addresses
- Comment bodies
- Fixture IDs or URLs
- Request authorization headers

---

## 7. Evidence, Redaction, and Retention

**Allowed in verification reports:**
- Step name
- Outcome (`PASS` / `BLOCKED` / `FAIL`)
- Coarse safe category only

**Never record:**
- Tokens
- UIDs
- Emails
- Fixture IDs
- Fixture URLs
- Comment bodies
- Raw responses
- Raw logs
- Request headers
- Secrets
- Stack traces
- Backend payloads

**Temporary verification notes:**
- Must be deleted after review unless retention is explicitly approved
- Temporary notes are not references for future implementation

**Execution results are reference material for future composer discussion only — they do not constitute automatic implementation authorization.**

---

## 8. Execution Authorization Boundary

This document's merge does **not** authorize runtime execution. A separate explicit execution authorization issue is required before any runtime call.

Even if the runtime gate is successful:
- Composer UI requires a separate narrow authorization issue
- Separate review is required for composer behavior, error states, and UX
- #3075 remains open
- #1882 remains open

The gap between "runtime gate passes" and "composer authorized" is intentional and requires a separate decision.

---

## 9. Permanent Exclusions

The following are permanently excluded from this gate and any future authorization built upon it:

- Composer UI, comment drawer, submit button, optimistic UI
- Source code or runtime code changes
- Backend, API, Cloudflare, Modal, Firebase, database, schema, migration, configuration, deployment changes
- Browser or production runtime execution
- Likes functionality
- Browse, My Trees, Editor, or Scout changes
- Closing or resolving #3075 or #1882
- Direct database inspection, audit-log retrieval, or audit-log review

---

## 10. Verification Protocol Summary

```
PREFIGHT          → BLOCKED if isolation unclear
                    ↓
CREATE COMMENT    → record PASS/BLOCKED/FAIL + safe category
                    ↓
PUBLIC READ       → confirm same moment, correct fields
                    ↓
IDEMPOTENCY REPLAY → confirm no duplicate, correct replay
                    ↓
BLOCKED/RETRY     → confirm correct taxonomy
                    ↓
CLEANUP           → confirm lifecycle authority
                    ↓
REPORT            → step + outcome + coarse category ONLY
                    no tokens / UIDs / bodies / raw data
```

Each outcome is a data point for future composer authorization discussion — never a binding implementation decision.

Refs #3227
Refs #3225
Refs #3075
Refs #3218
Refs #1882