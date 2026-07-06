# Gate A Runtime Smoke Contract — Moment Social Write

> **Issue:** #3265
> **Status:** Contract/planning artifact only. No DB, API, secret, fixture, identity, or runtime action occurs in this document.
> **Refs:** #3264, #1882

---

## 1. Scope and Status

This is a **contract/planning artifact only**. It does not execute any of the following:

- Database migration or `psql`
- `curl`, fetch, or any HTTP request
- Runtime smoke operation
- Fixture creation or test-account creation
- Modal or Cloudflare deployment
- UI activation

Issue #3264 remains **PARTIAL** until a separately approved runtime smoke is executed successfully. Migration B and all tree runtime work, including tree idempotency handlers, tree writer activation, and tree runtime hardening, remain **blocked** regardless of Verification Gate A schema evidence.

---

## 2. Public-Write Prerequisite

A real authenticated moment social write — reaction toggle or comment create — requires **both** of the following:

1. **Public parent LoveTree** — `trees.visibility = 'public'`
2. **Public target memory** — `memories.visibility = 'public'`

This is enforced at the database transaction level by `require_memory_visible_or_owner_cursor` in `modal_compute/write_validation.py`. For a non-owner authenticated actor:

- If either the tree or the memory is not `'public'`, the guard returns `404` (leak-safe).
- A private-visibility tree or memory is **not a valid substitute** for the intended public-write smoke path.
- The tree owner can bypass visibility checks, but an owner-only fixture would not exercise the real public third-party write contract.

### 2.1 Unlisted / Non-Discoverable Mode

The current source does **not** provide a supported unlisted, hidden, or non-discoverable fixture mode. The visibility model is binary (`'public'` or `'private'`). The legacy node parser in `public_reads.py` (`_is_public_legacy_node`) accepts only `visibility == "public"` or absent (defaults to `"public"`). The write authorization guard in `write_validation.py` rejects any non-`'public'` value as `404`.

Therefore:

- **Do not assume** an unlisted/non-discoverable capability exists unless source and established product policy explicitly prove it.
- If an unlisted mode is absent or uncertain, fixture provisioning requires **separate CTO approval** and explicit product acceptance of the limited public exposure.

---

## 3. Fixture and Test-Identity Selection Contract

Any future approved fixture provisioning **must** satisfy all of the following before a runtime smoke may proceed:

- [ ] Dedicated non-user test identity (e.g. `test-smoke-<purpose>`)
- [ ] Dedicated non-user test tree and test memory owned by the test identity
- [ ] No use, repurposing, mutation, or inspection of any real user account, tree, or memory
- [ ] Data-minimized, non-personal, non-sensitive fixture text (no real names, emails, PII, credentials)
- [ ] Clear test-only naming convention visible in the tree title and memory content
- [ ] Explicit fixture owner and operator approval documented before smoke execution
- [ ] Documented authorization to run the smoke (who, when, which scope, which fixture)
- [ ] Documented cancellation and stop criteria (any unexpected behavior stops immediately)
- [ ] No assumption that automated cleanup or deletion support exists unless source explicitly proves it
- [ ] No fixture creation occurs in this task

---

## 4. Controlled Reaction/Comment Smoke Sequence

This section defines the later approved smoke sequence at the contract level only. No real URLs, cookies, headers, access tokens, Firebase tokens, account IDs, tree IDs, memory IDs, request bodies, idempotency keys, or exact shell commands that could expose credentials are included.

### 4.1 Pre-Mutation Eligibility

Before any mutation:

1. Confirm the fixture's eligibility:
   - The test tree is public (`visibility = 'public'`)
   - The test memory is public (`visibility = 'public'`)
   - The test memory belongs to the test tree
   - The test identity exists and is authenticated
2. If any check fails, stop immediately and record `BLOCKED`.

### 4.2 Reaction Smoke

1. **Initial reaction toggle**
   - Perform an authenticated `reaction.toggle` operation on the fixture memory with a valid idempotency key.
   - Capture only: success/fail category; no raw request/response body, no raw identifiers.

2. **Reaction replay**
   - Replay the same logical request (same actor, same idempotency key, same target, same payload).
   - Require deterministic response (not a second toggle). The replay must not change the logical state.
   - Capture only: replay success/fail category.

### 4.3 Comment Smoke

1. **Initial comment create**
   - Perform an authenticated `comment.create` operation on the fixture memory with a valid idempotency key.
   - Capture only: success/fail category; no raw request/response body.

2. **Comment replay**
   - Replay the same logical request (same actor, same idempotency key, same target, same payload).
   - Require one logical comment result (not a duplicate comment).
   - Capture only: replay success/fail category.

### 4.4 Safe Error/Response Boundaries

- Expected error responses must use the `SocialWriteError` DTO shape (top-level `error` and `code` fields).
- No raw database error, stack trace, or internal exception propagated to the response.
- Stop immediately on any unexpected HTTP status, response shape, or authorization rejection.

### 4.5 Evidence Capture

Only sanitized aggregate or boolean evidence may be captured:

- Fixture eligibility outcome (PASS / BLOCKED)
- Reaction initial result category (SUCCESS / FAIL / SAFE_ERROR)
- Reaction replay result category (SUCCESS / FAIL)
- Comment initial result category (SUCCESS / FAIL / SAFE_ERROR)
- Comment replay result category (SUCCESS / FAIL)

No raw identifiers, request bodies, response bodies, tokens, connection strings, or database rows may be captured.

---

## 5. Secret-Handling Hard Boundary

- Never read, print, search, `grep`, `cat`, `sed`, `awk`, `echo`, `printenv`, trace, or otherwise output `.secrets` directory contents or environment variables.
- Never log a command with expanded credentials.
- Secret injection (where needed for an authorized runtime operation) must remain opaque to command output.
- No secret rotation, secret-file update, or Neon credential action occurs in this repository task.
- Any suspected credential exposure immediately stops the operation and requires private operator-side rotation or revocation before any future database work.

---

## 6. Evidence and Decision Rules

### 6.1 Evidence Categories

| Category | Meaning |
|---|---|
| `PASS` | Approved fixture exists, all checks pass, deterministic replay confirmed |
| `PARTIAL` | Schema already valid but fixture/procedure remains unavailable |
| `BLOCKED` | Approval, identity, fixture, or secret-safety condition missing |
| `FAILED` | Approved smoke runs but response/authorization/idempotency behavior deviates |

### 6.2 Outcome Consequences

`PARTIAL`, `BLOCKED`, or `FAILED` outcome **never authorizes**:

- Migration B
- Tree writer activation
- Tree runtime hardening (idempotency, advisory lock, audit)
- Modal or Cloudflare deployment
- UI activation (like button, comment form)

Only a verified `PASS` outcome may unblock the next gate.

---

## 7. Rollback and Exclusion Boundaries

### 7.1 Rollback

- This artifact itself changes no runtime or schema, so it creates no rollback action.
- Later runtime rollback (if needed) must precede any separately approved schema rollback.

### 7.2 Explicit Exclusions

The following scope is explicitly excluded and **must not** be added:

- Browse
- My Trees
- Editor
- Scout
- Hermes
- #3075
- Outside-project code
- `pr-comment-composer-verify`
