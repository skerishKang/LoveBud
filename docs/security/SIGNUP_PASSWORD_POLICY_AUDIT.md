# Signup Password Policy Audit

> **Status:** AUDIT_CAPTURED  
> **Source:** Issue #224  
> **Type:** Docs-only — no JS, Auth, Firebase, i18n, or runtime changes in this document

---

## 1. Purpose

This document captures the audit for signup password complexity validation in LoveBud.

Before any validation logic, Firebase configuration, or i18n copy is changed, this document maps the current validation path, compares policy options, records UX and security guardrails, and defines the verification matrix required before any implementation PR.

No code changes are made in this document. `js/auth.js`, `js/auth/**`, `pages/login.html`, Firebase config, and all i18n assets are read-only with respect to this PR.

---

## 2. Audit Source

| Field | Value |
|---|---|
| Source issue | Issue #224 |
| Audit target | Signup password validation path |
| Related files (read-only) | `js/auth.js`, `js/auth/auth-firebase.js`, `pages/login.html` or equivalent signup page |
| Firebase provider | Email/Password (Firebase Auth) |

---

## 3. Current Validation Audit

### 3.1 Signup Form Validation Path

| Step | Location | Notes |
|---|---|---|
| Frontend form validation | Signup form JS (in `js/auth.js` or `js/auth/auth-firebase.js`) | **VERIFY: exact validation entry point** |
| Password field constraints | HTML `minlength` / `pattern` attribute or JS | **VERIFY: attribute vs. JS-driven** |
| Current minimum length | 6 characters (Firebase Auth minimum) | **VERIFY: frontend enforces or relies on Firebase rejection** |
| Submit guard | Validation fires before `createUserWithEmailAndPassword` call | **VERIFY: pre-submit or post-error** |
| Error display | `alert()` or inline error element | **VERIFY: current error surface** (see Issue #78 item 4 alert audit) |

### 3.2 Password Reset / New-Password Path

| Path | Present in codebase | Notes |
|---|---|---|
| Firebase `sendPasswordResetEmail` flow | **VERIFY** | If present, new-password validation occurs on Firebase side only |
| Custom new-password form | **VERIFY** | If absent, no frontend complexity validation applies to reset flow |

**Important:** Stronger frontend validation should apply only to the signup flow (and custom new-password form if present) in the first implementation. Do not apply to login or Google login flows.

### 3.3 Firebase Auth Constraints

| Constraint | Value |
|---|---|
| Absolute minimum password length | 6 characters (Firebase enforced) |
| Maximum password length | No hard limit in Firebase Auth |
| Character set restrictions | None in Firebase Auth |
| Complexity rules | None in Firebase Auth — frontend must enforce |
| Google / OAuth login | No password — unaffected by any frontend validation |

### 3.4 Frontend-Only vs. Provider Policy Distinction

| Layer | Who enforces | Can be bypassed |
|---|---|---|
| Firebase Auth minimum (6 chars) | Firebase backend | No — `createUserWithEmailAndPassword` will reject |
| Frontend complexity validation | Browser JS (current or future) | Yes — JS-disabled or direct API call bypasses |
| Firebase Security Rules | Firebase backend | No |

**Implication:** Frontend complexity validation is a UX guardrail, not a security enforcement boundary. Server-side enforcement (if required) needs a separate plan.

---

## 4. Policy Options

| Option | Rule | User impact | Implementation cost |
|---|---|---|---|
| **A — Current** | Minimum 6 characters only (Firebase minimum) | No change | None |
| **B — Minimum length increase** | Minimum 8 characters | Minor friction; recommended baseline | Low |
| **C — Length + character class** | Minimum 8 chars + at least 1 letter + 1 number | Moderate friction; common standard | Low-Medium |
| **D — Length + class + symbol** | Minimum 8 chars + letter + number + symbol | Higher friction; not recommended without clear need | Medium |
| **E — Inline real-time validation** | Any of B–D with live per-field feedback before submit | Best UX for complex rules | Medium |

### Recommended First Step

**Option C (minimum 8 chars + letter + number)** with **inline real-time validation (Option E UX pattern)** is the recommended starting point, subject to product policy decision.

- Does not block existing accounts (login path unchanged).
- Clear inline error before submit reduces frustration.
- Korean and English copy required before implementation.

### i18n Copy Requirements

Before any validation UI is added, Korean and English error copy must be defined:

| Error condition | Korean copy candidate | English copy candidate |
|---|---|---|
| Password too short | `비밀번호는 8자 이상이어야 해요` | `Password must be at least 8 characters` |
| Missing letter | `영문자를 포함해 주세요` | `Include at least one letter` |
| Missing number | `숫자를 포함해 주세요` | `Include at least one number` |
| Missing symbol (if Option D) | `특수문자를 포함해 주세요` | `Include at least one special character` |

> **These are candidates only.** Final copy requires product/UX review. No i18n keys are added in this PR.

---

## 5. UX and Security Considerations

| Consideration | Rule |
|---|---|
| **Existing login passwords** | Stronger validation must **not** apply to the login path — existing accounts must not be locked out |
| **Signup / new-password only** | Complexity validation applies to `createUserWithEmailAndPassword` and custom new-password form only, unless separately approved |
| **Error copy before submit** | Inline validation error must be visible before the user clicks submit; not only after server rejection |
| **Accessible error association** | Error message must be associated with the password `<input>` via `aria-describedby` or equivalent |
| **Mobile form layout** | Inline error must not overflow or obscure the submit button on narrow viewports (375px) |
| **Google / OAuth login** | Completely unaffected — no password field present |
| **Password reset flow** | If `sendPasswordResetEmail` is the only reset path, no new-password form exists frontend-side; no validation change needed |
| **No server-side enforcement** | If regulatory or security policy requires server-side enforcement, this is a separate workstream beyond this audit |

---

## 6. Guardrails

- **No validation logic change in this document or its PR.**
- **No Firebase provider, config, or security rules change.**
- **No login behavior change.**
- **No password reset behavior change.**
- **No i18n key or copy addition in this PR.**
- **No PR #319, #320, #321, #322 contact.**
- **No PR #7 or prototype/reference/demo/variant file changes.**
- **Issue #224 remains open** — this document does not close, fix, or resolve it.

---

## 7. Verification Matrix (Required Before Any Implementation PR)

All rows must pass on both desktop and mobile before any validation implementation PR is merged.

### Desktop (Chrome / Firefox / Safari — 1280px+)

- [ ] Signup with a valid password (meets new policy) → account created successfully
- [ ] Signup with an invalid password (too short, missing class) → inline error shown before submit
- [ ] Login with an existing account (password predates new policy) → login succeeds
- [ ] Google login → unaffected; no password field, login succeeds
- [ ] Password reset (if present) → reset email sent; new-password form (if present) validated correctly
- [ ] No duplicate submit event on rapid double-click
- [ ] No fatal console errors or network 4xx/5xx blockers on signup page

### Mobile (Chrome / Safari — 375px – 430px)

- [ ] Signup form renders correctly at narrow viewport
- [ ] Inline error visible without obscuring submit button
- [ ] Password field keyboard opens correctly; no layout shift
- [ ] Error message tap targets and text size correct (not below 12px)
- [ ] Submit button tap target ≥ 44px

---

## 8. Follow-Up PR Split Proposal

| PR | Scope | Pre-condition |
|---|---|---|
| **PR A** | Audit docs (this PR) | — |
| **PR B** | Policy decision update to this doc or a product policy doc | CTO/product review of Option A–E |
| **PR C** | i18n copy addition (Korean + English error strings) | PR B approved |
| **PR D** | Frontend validation implementation (complexity rule + inline error UI) | PR C merged; Section 7 smoke baseline documented |
| **PR E** | Auth smoke verification runbook update | PR D merged; Section 7 matrix fully passing |

---

## 9. Verification Checklist (This PR)

- [ ] `git diff --check` passes
- [ ] Changed files limited to `docs/security/SIGNUP_PASSWORD_POLICY_AUDIT.md`
- [ ] No JS/Auth/Firebase/i18n/runtime changes
- [ ] No `close`/`fixes`/`resolves` keywords for #224
