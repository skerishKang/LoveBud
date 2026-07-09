# Moment Social Write Gate A — Runtime Smoke Contract

> **Issue:** #3265
> **Status:** Documentation and contract definition only
> **Scope:** Define the controlled public-fixture smoke contract for Migration A Gate A. No DB, API, deploy, runtime smoke, migration, rollback, credential inspection, GitHub mutation, push, PR, merge, or production action occurs in this task.

---

## 1. Purpose

This document defines the contract and checklist for a **future, separately approved runtime smoke** that verifies the authenticated public social-write path (moment reactions and comments) continues to function after Migration A (generic social target preparation) has been applied.

The smoke is a **controlled, pre-approved, fixture-based** verification. It is not a production test. It does not use real user accounts, Trees, memories, or content.

---

## 2. Public-path runtime requirement

The intended authenticated public social-write path requires **both** of the following to be publicly visible:

- The **parent LoveTree** must have `visibility = 'public'`.
- The **target memory** must have `visibility = 'public'`.

This is a runtime authorization requirement enforced by `require_memory_visible_or_owner_cursor()` in `modal_compute/write_validation.py`. Non-owner authenticated users may only write to a memory when both the tree and the memory are public.

> **Important:** "Public" is a runtime requirement, not a license to use real user content. The smoke must use a dedicated, separately approved fixture — never real user data.

### 2.1 Unlisted / non-discoverable capability

There is no unlisted or non-discoverable visibility state for LoveBud trees or memories. The only stored visibility values are `"public"` and `"private"`, enforced by `validate_visibility()` in `modal_compute/validation.py`.

This contract does **not** assume or claim any unlisted/non-discoverable capability. The future smoke operates solely within the public visibility path.

---

## 3. Fixture requirements

### 3.1 Approved fixture in the smoke runtime environment

The only acceptable future fixture is a separately approved dedicated test identity plus a dedicated public test Tree and public test memory in the approved runtime environment for the Gate A smoke. When the approved Gate A smoke verifies the production public path, the dedicated fixture may be provisioned in production only after a separate explicit approval. It must remain isolated from real user accounts, Trees, memories, comments, reactions, and content.

### 3.2 Prohibitions

- **Do not** use, repurpose, modify, or expose real user accounts, Trees, memories, comments, reactions, or production content.
- **Do not** create any fixture, test identity, test Tree, or test memory during this task.
- **Do not** claim an unlisted/non-discoverable mode — the source code and product policy do not support it.

### 3.3 Corrected fixture concept

A separately approved dedicated public fixture may be used only for the future public-path smoke. Public visibility is required for the intended authorization path, while operational containment comes from dedicated ownership, safe content, approval, and strict evidence handling.

---

## 4. Scope boundary

This task:

- Creates no DB connection, runtime smoke, API call, deploy, Modal action, Cloudflare action, migration, rollback, or source-runtime change.
- Changes no runtime, schema, API, client, or UI code.
- Does **not** execute, schedule, or authorize any of the above.

---

## 5. Future smoke approval checklist

Before any operator may run the future controlled smoke, the following must be confirmed and explicitly approved:

1. **Explicit approval of dedicated test identity and fixture.**
2. **Confirmation that fixture Tree and target memory are public** (`visibility = 'public'`).
3. **Confirmation that fixture has safe non-personal content and non-identifying naming.**
4. **Confirmation that the operator can run only through an approved opaque credential path** (no raw token or password in command lines, logs, or output).
5. **Cancellation when any of the above cannot be established safely.**

If fixture identity, visibility, authorization, or containment cannot be established safely, the smoke is **cancelled**. No fallback to real user data or production content is permitted.

---

## 6. Future smoke sequence

The following contract-level sequence is defined for the future separately approved smoke. It is **not** executed in this task.

### 6.1 Preflight

- Confirm fixture identity and fixture Tree/memory existence.
- Confirm both fixture Tree and fixture memory have `visibility = 'public'`.
- Confirm no prior smoke state (idempotency keys, audit rows) for this fixture.
- Confirm the operator has a valid, opaque authentication credential.

### 6.2 Controlled reaction action

- Issue one authenticated POST to the reactions endpoint targeting the fixture memory.
- Include a valid `Idempotency-Key`.
- Verify the response shape is a safe DTO (type, active, counts, total — no raw identifiers).

### 6.3 Idempotency replay expectation

- Replay the exact same reaction request (same key, same body).
- Expect a deterministic response matching the initial action.
- No second mutation occurs.

### 6.4 Controlled comment action

- Issue one authenticated POST to the comments endpoint targeting the fixture memory.
- Include a valid `Idempotency-Key` (different key from the reaction).
- Verify the response shape is a safe comment representation.

### 6.5 Response/result verification at sanitized aggregate level

- Verify only that the operation completed successfully (status 2xx).
- Verify response structure matches the expected safe DTO.
- Verify idempotent replay returns the same result.
- Do **not** verify specific row values, actor IDs, timestamps, or internal state.

### 6.6 Cleanup and evidence capture

- The operator captures evidence at aggregate level only:
  - `PASS` — all steps completed successfully
  - `PARTIAL` — some steps passed, some failed at contract level
  - `BLOCKED` — preflight or critical step failed
- No raw actor, account, Tree, memory, comment, reaction, audit, or credential data is captured.
- The fixture is left in place for potential future smoke runs.

---

## 7. Evidence and output prohibitions

### 7.1 Prohibited output

The smoke must **not** output:

- Raw identifiers (user UIDs, Tree UUIDs, memory UUIDs, comment IDs, reaction IDs)
- Tokens (Firebase, Modal, Cloudflare, GitHub, session)
- Authorization headers
- Cookies
- Passwords
- Connection strings
- Request bodies
- Raw audit rows
- Shell-expanded secrets
- `.secrets` content

### 7.2 Prohibited commands

The smoke must **not** use:

- `grep` against secret files or variables
- `cat` against secret files
- `echo` expansions of secrets
- `printenv` or full environment dumps
- Shell tracing (`set -x`, `set -v`) that exposes secret values
- Any similar secret-output inspection against secret files or environment variables

### 7.3 Safe evidence only

Only the following are acceptable as evidence:

| Value | Meaning |
|-------|---------|
| `PASS` | All contract steps completed successfully |
| `PARTIAL` | Some contract steps passed, some failed |
| `BLOCKED` | Preflight or critical step failed |
| `count` | Sanitized counts (e.g., reaction count, comment count) |
| `category` | Sanitized category labels |

No raw actor, account, Tree, memory, comment, reaction, audit, or credential data may appear in evidence.

---

## 8. Failed/unavailable fixture consequences

Failed or unavailable fixture verification does **not** authorize any of the following:

- Rollback
- Migration B
- Tree runtime hardening
- Tree writer activation
- UI activation
- Browse, My Trees, Editor, Scout, Hermes changes
- `pr-comment-composer-verify` changes

---

## 9. Rollback boundary

Any future rollback remains **runtime-first and separately approved**. This documentation task changes neither runtime nor schema.

---

## 10. Explicit non-goals

This contract and its associated test:

- Do **not** include a Modal deployment
- Do **not** include a Cloudflare deployment
- Do **not** include database execution
- Do **not** reference or authorize Issue #3075
- Do **not** change Browse, My Trees, Editor, Scout, or Hermes
- Do **not** change `pr-comment-composer-verify`
- Do **not** include any UI, CSS, or layout change
- Do **not** include any runtime smoke, API call, migration, or rollback

---

## 11. Approved runner and invocation

A repository-native runner now exists so the future separately approved smoke
can be executed without improvising ad-hoc requests.

- Runner: `scripts/smoke-gate-a-moment-social-write.mjs`
- Package script: `npm run smoke:gate-a`

### 11.1 Required opaque operator inputs (env-only)

The runner reads **only** env inputs supplied by the operator through a private
secret channel. It never hard-codes fixture IDs, tree IDs, memory IDs, account
IDs, URLs, tokens, or idempotency keys.

| Env var | Purpose |
|---------|---------|
| `GATE_A_API_BASE` | API proxy base URL (operator-supplied) |
| `GATE_A_TREE_ID` | Opaque fixture parent tree id (operator-supplied) |
| `GATE_A_MEMORY_ID` | Opaque fixture target memory id (operator-supplied) |
| `GATE_A_AUTHORIZATION` | Opaque Firebase bearer token (operator-supplied, never logged) |
| `GATE_A_REACTION_KEY` | Idempotency key for the reaction write (operator-supplied) |
| `GATE_A_COMMENT_KEY` | Idempotency key for the comment write (operator-supplied) |

Optional: `GATE_A_TIMEOUT_MS` (request timeout, default 30000).

### 11.2 Fail-closed behavior

If any required input is missing, the runner immediately emits
`smokeStatus: BLOCKED_MISSING_ENV` with all sub-checks `NOT_RUN`, and exits
without performing any network call. No fallback to defaults or real-user data.

### 11.3 Allowed output

The runner emits **only** the typed, sanitized Gate A evidence block:

```
smokeStatus: PASS | FAIL | BLOCKED_<CATEGORY>
reactionWrite: PASS | FAIL | NOT_RUN
commentWrite: PASS | FAIL | NOT_RUN
publicVisibility: PASS | FAIL | NOT_RUN
legacyCompatibility: PASS | FAIL | NOT_RUN
genericTargetIntegrity: PASS | FAIL | NOT_RUN
triggerCompatibility: PASS | FAIL | NOT_RUN
secret/private exposure: NONE | STOP_AND_REPORT
```

No raw identifiers, tokens, request/response bodies, headers, audit rows, or
credentials are printed. `publicVisibility` is verified via the guest-safe
public read endpoint; `reactionWrite`/`commentWrite` go through the
authenticated write path gated by `require_memory_visible_or_owner_cursor()`.

### 11.4 Contract test

`tests/contracts/gate-a-moment-social-write-smoke-runner-contract.test.cjs`
proves: missing env yields `BLOCKED_MISSING_ENV`; output shape is the typed
evidence block; forbidden raw/private fields are never printed; the runner
contains no committed fixture identifiers or credentials.
- Do **not** create, modify, or expose any user account, Tree, memory, comment, or reaction
