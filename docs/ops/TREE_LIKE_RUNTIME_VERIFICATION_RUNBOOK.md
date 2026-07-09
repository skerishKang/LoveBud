# Tree-Like Runtime Verification Runbook

> **Issue:** #3362  
> **Status:** Docs-only operator-run procedure  
> **Unblocks:** #3361 `[Runtime][Social] Verify hardened tree-like write path before client activation`  
> **Verification target SHA:** `8a170a2ca70b73ee85fc0a1abebd73f8d54f0f96` (or a later CTO-approved SHA)

---

## 1. Purpose

This runbook defines a **safe operator-run procedure** so a trusted operator can complete the #3361 live authenticated runtime verification of the hardened tree-like write path (from #3359 / PR #3360) without exposing any raw/private value.

It exists because worker/sandbox contexts cannot reach the deployed runtime, Firebase session, safe test tree target, or Modal/DB. This document only defines the procedure and the sanitized evidence format. It does **not** perform verification and must not contain live results.

Rules enforced here:

- No raw URL, tree ID, memory ID, user/account ID, token, cookie, Firebase token, auth header, request/response body, DB row, DB connection string, dashboard URL, screenshot, or log value.
- Only a trusted operator with an assigned slot, approved SHA, and passing credential preflight may run the live checks.
- Evidence comments use only sanitized fields (route category, status, safe code, DTO keys, count delta, key-hash presence).

---

## 2. Preconditions

Before any live check:

- CTO / Ops Lead explicitly assigns a fixed test slot (`test1`–`test10`) or a production-equivalent safe preview per `TEST_PREVIEW_SLOTS.md`.
- Target SHA is stated and approved: `8a170a2ca70b73ee85fc0a1abebd73f8d54f0f96` or a later approved SHA. Do not infer the SHA from a branch name.
- The assigned slot is updated to the approved SHA using `--force-with-lease` only (see `TEST_PREVIEW_SLOTS.md` slot update procedure). Never plain `--force`, never `main`.
- Credential preflight passes via `QA_CREDENTIALS.md` (`npm run check:auth-credentials -- --key accounts.user`). Report only `CREDENTIAL_PREFLIGHT_PASS` / `CREDENTIAL_PREFLIGHT_BLOCKED` / `CREDENTIAL_FILE_BLOCKED`.
- A safe **public** test tree target exists. Its raw ID must **never** be posted; refer to it only as `public test tree target`.
- Optional non-public / missing target case is included only if a safe target is available without exposing any raw identifier.

---

## 3. Role boundaries

| Role | May | Must not |
|------|------|----------|
| Web / GitHub reviewer | check PR/draft state, head SHA, changed files, issue hygiene, docs-only scope | claim live verification from GitHub metadata alone; treat Preview URL existence as rendered/runtime PASS |
| Local / Ops slot executor | update the assigned slot branch to the approved SHA with `--force-with-lease`; check deploy status | modify PR head branch; push/force-push `main`; guess target SHA; use plain `--force` |
| Browser / operator verifier | use an authenticated browser/session on the assigned slot; record sanitized status/code/shape/delta | paste tokens, cookies, Firebase credentials, auth headers, request/response bodies, raw IDs, or screenshots containing secrets |

A verifier must not silently choose a slot when none was assigned. GitHub metadata cannot substitute for live authenticated execution.

---

## 4. Live checklist

For every check below, record:

- **route category only** (never the full URL)
- **expected sanitized status / code**
- **expected response shape keys only**
- **expected count delta only** (`+1`, `0`, `-1`)
- **what must not be pasted**

Route categories used:

- `POST /api/trees/{tree_id}/likes` — Cloudflare same-origin tree-like mutation route
- `GET /api/trees/{tree_id}/likes` — Cloudflare same-origin tree-like summary route
- `POST /modal/private/trees/{tree_id}/likes` — Modal private tree-like mutation
- `GET /modal/private/trees/{tree_id}/likes` — Modal private tree-like summary

### 4.1 Missing auth mutation

- Route category: `POST /api/trees/{tree_id}/likes`
- Expected: safe unauthorized response (status `401`), no upstream write.
- Response shape keys: only `error`.
- Count delta: `0` (no mutation).
- Must not paste: auth header, cookie, token, raw tree ID, request body.

### 4.2 Authenticated mutation without `Idempotency-Key`

- Route category: `POST /modal/private/trees/{tree_id}/likes` (or its same-origin `POST /api/...` form)
- Expected: safe `400` with code `IDEMPOTENCY_KEY_REQUIRED`. No mutation.
- Response shape keys: `error`, `code`.
- Count delta: `0`.
- Must not paste: raw key, auth header, token, raw tree ID, request body.

### 4.3 Authenticated mutation with malformed `Idempotency-Key`

- Route category: `POST /modal/private/trees/{tree_id}/likes`
- Expected: safe `400` with code `IDEMPOTENCY_KEY_INVALID`. No mutation.
- Response shape keys: `error`, `code`.
- Count delta: `0`.
- Must not paste: the malformed key value, auth header, token, raw tree ID, request body.

### 4.4 Authenticated valid first mutation

- Route category: `POST /modal/private/trees/{tree_id}/likes`
- Expected: mutation succeeds.
- Response shape keys exactly: `treeId`, `active`, `likeCount`. No other keys.
- Count delta: expected (`+1` on activate, `-1` on deactivate depending on prior state).
- Must not paste: the idempotency key, auth header, token, raw tree ID, raw response body.

### 4.5 Same-key replay

- Route category: `POST /modal/private/trees/{tree_id}/likes`
- Same actor + same target + same valid key as 4.4.
- Expected: authoritative safe DTO returned, no second toggle.
- Response shape keys: `treeId`, `active`, `likeCount`.
- Count delta: `0` compared with the first mutation result.
- Must not paste: the idempotency key (only report key-hash presence/absence), auth header, token, raw tree ID.

### 4.6 New-key second mutation

- Route category: `POST /modal/private/trees/{tree_id}/likes`
- Same actor + same target + a different valid key.
- Expected: next toggle applies.
- Response shape keys: `treeId`, `active`, `likeCount`.
- Count delta: expected (opposite of the prior state).
- Must not paste: either idempotency key, auth header, token, raw tree ID.

### 4.7 Non-public / missing target (if safely available)

- Route category: `POST /modal/private/trees/{tree_id}/likes` (or summary route)
- Expected: fail-closed safe `404`-style / not-found behavior. No existence leak.
- Response shape keys: `error` only.
- Count delta: `0`.
- Skip with explanation if no safe non-public/missing target is available without exposing a raw identifier.
- Must not paste: raw tree ID, auth header, token.

### 4.8 Log / audit privacy (if safely accessible)

- Check only via operator-safe logs/audit views; never paste log lines.
- Expected: no raw idempotency key, no token, no cookie, no auth header, no request body, no response body, no raw private ID.
- Confirm only: request key hash presence (`PRESENT`) / raw key presence (`ABSENT`).
- Report: pass/fail only. Do not paste logs.

---

## 5. Sanitized evidence template

Copy this into the #3361 comment. Do not add any raw/private value.

```text
[Tree-Like Runtime Verification Evidence — #3361]

- execution mode: live authenticated HTTP = YES / NO
- target SHA: <approved SHA>
- assigned slot label: <testN or safe label only; no raw URL>
- credential preflight: CREDENTIAL_PREFLIGHT_PASS / BLOCKED
- reference PR: #3360

| # | Live check | Status | Note |
|---|-----------|--------|------|
| 1 | Missing auth mutation | PASS / SKIPPED / BLOCKED | status 401; no mutation |
| 2 | No Idempotency-Key | PASS / SKIPPED / BLOCKED | code IDEMPOTENCY_KEY_REQUIRED |
| 3 | Malformed key | PASS / SKIPPED / BLOCKED | code IDEMPOTENCY_KEY_INVALID |
| 4 | Valid first mutation | PASS / SKIPPED / BLOCKED | keys treeId/active/likeCount; delta +/-1 |
| 5 | Same-key replay | PASS / SKIPPED / BLOCKED | delta 0; stored DTO |
| 6 | New-key 2nd mutation | PASS / SKIPPED / BLOCKED | delta expected |
| 7 | Non-public/missing | PASS / SKIPPED / BLOCKED | 404 fail-closed |
| 8 | Log/audit privacy | PASS / SKIPPED / BLOCKED | key hash only |

- skipped checks with reason: <list or "none">
- raw/private exposure: NO
- issue states: #3361 open, #3188 open, #3075 open, #1882 open
```

---

## 6. Forbidden evidence

Do not post any of the following in comments, docs, PRs, logs, screenshots, or reports:

- raw API base URL
- raw tree ID
- raw memory ID
- raw user / account ID
- bearer token
- cookie / session token / Firebase token
- auth header
- raw request body
- raw response body with identifiers / private values
- DB connection string
- raw DB rows
- dashboard URLs
- screenshots with IDs / secrets
- logs containing tokens / cookies / request bodies / private IDs / stack traces

Allowed evidence only: route category, sanitized status code, safe error code, response shape keys, count delta (`+1` / `0` / `-1`), pass/fail table, safe slot label, key-hash presence/absence, and commit SHA.

---

## 7. Completion rules

- #3362 is satisfied when this operator-run path is documented and linked from the verification issue.
- #3361 remains **open** until live authenticated runtime evidence (Section 4 + Section 5) is posted and accepted by the reviewer.
- Client / UI activation remains **blocked** until #3361 is accepted.
- #3188, #3075, #1882 remain **open**.

---

## 8. Cross-links

- Refs #3362
- Refs #3361
- Refs #3188
- Refs #3359
- Refs #3356
- Refs #3355
- Refs #3075
- Refs #1882

Related procedure docs:

- [TEST_PREVIEW_SLOTS.md](TEST_PREVIEW_SLOTS.md) — fixed slot assignment and update rules
- [QA_CREDENTIALS.md](QA_CREDENTIALS.md) — credential preflight and safe reporting
- [MODAL_RUNTIME_DIAGNOSTICS_WORKFLOW.md](MODAL_RUNTIME_DIAGNOSTICS_WORKFLOW.md) — Cloudflare ↔ Modal verification and request-ID correlation
- [AGENT_STARTUP_VERIFICATION_RULES.md](AGENT_STARTUP_VERIFICATION_RULES.md) — agent startup checklist and token-safe reporting
