# Auth Alert Usage Audit

> **Status:** AUDIT_ONLY
> **Source:** Issue #78
> **Type:** Docs-only — no alert replacement, UI behavior change, or JavaScript change

---

## 1. Purpose

This document inventories current `alert()` usage in auth-related flows before any UX cleanup.

Issue #78 tracks Auth architecture, global exports, token cache, alert usage, and other staged cleanup items. This document addresses the `alert()` usage audit slice only.

This PR does not replace alerts, introduce toast UI, change inline errors, or modify runtime behavior.

---

## 2. Current Findings

Current auth-related `alert()` calls are concentrated in:

- `js/auth/auth-login-page.js`
- `js/auth.js`

A repository-wide search also finds non-auth or historical/reference occurrences, including demo and conversation/audit documents. Those are outside this auth-flow cleanup scope and must not be modified as part of this audit.

---

## 3. Auth Alert Call Inventory

### 3.1 `js/auth/auth-login-page.js`

| Flow | Alert message/source | Classification | Notes |
|---|---|---|---|
| Email auth submit | `envError` | login/signup environment | Firebase/config/environment readiness surfaced as blocking alert |
| Email auth submit | `이메일과 비밀번호를 모두 입력해 주세요.` | validation | Missing email/password |
| Email auth submit | `닉네임을 입력해 주세요.` | signup validation | Signup mode only |
| Email auth submit | `비밀번호는 최소 8자 이상이어야 합니다.` | validation | Applies to login/signup modal flow |
| Email auth submit | `Firebase가 초기화되지 않았습니다. 페이지를 새로고침해 주세요.` | login/signup environment | Firebase app missing after init attempt |
| Email auth catch | `friendlyMessage || '인증 중 오류가 발생했습니다.'` | login/signup error | Friendly Firebase/Auth error fallback |
| Legacy signup form | `envError` | signup environment | Separate signup form path |
| Legacy signup form | `닉네임, 이메일, 비밀번호를 입력해주세요.` | signup validation | Missing required signup fields |
| Legacy signup form | `비밀번호는 최소 8자 이상이어야 합니다.` | signup validation | Password length |
| Legacy signup catch | `friendlyMessage || '회원가입 중 오류가 발생했습니다.'` | signup error | Friendly Firebase/Auth error fallback |

### 3.2 `js/auth.js`

`js/auth.js` still contains legacy compatibility and fallback paths. It may duplicate some alert behavior when the delegated login-page module is unavailable or when legacy flows are active.

Classifications to preserve in future review:

| Flow | Classification | Notes |
|---|---|---|
| Login/email auth errors | login error | Should move to inline form error first |
| Signup/email auth errors | signup error | Should move to inline form error first |
| Missing fields/password validation | validation | Should be inline and accessible near form fields |
| Firebase/config initialization failure | environment/runtime notice | Candidate for non-blocking notice or inline modal error |
| Logout feedback, if present in legacy fallback | logout | Candidate for toast or silent success depending UX policy |
| Redirect/auth-required notice | redirect | Prefer existing page notice/inline notice rather than blocking alert |

---

## 4. Flow Classification

### Login

Login alert usage should be treated as highest UX priority because it blocks the authentication path.

Preferred future replacement:

- inline form error near the email/password fields;
- preserve current friendly Firebase error mapping;
- preserve disabled submit / original text restoration behavior;
- do not change redirect handling in the same PR.

### Signup

Signup alert usage overlaps with validation and Firebase error feedback.

Preferred future replacement:

- inline field-level or form-level error;
- accessible error association for required nickname/email/password;
- keep password policy changes separate unless explicitly approved.

### Logout

Logout should not be mixed with login/signup alert cleanup.

Preferred future replacement:

- toast or non-blocking confirmation only if the current UI needs explicit feedback;
- no behavior change to cache clearing, Firebase sign-out, or redirect flow.

### Redirect

Redirect/auth-required messaging should use existing page notices where possible.

Preferred future replacement:

- page-level notice or inline notice;
- no blocking alert during automatic redirect.

### Validation

Validation alerts are good first candidates for inline errors.

Preferred future replacement:

- form-level message container first;
- later field-level associations if design supports it;
- avoid expanding scope into broader Auth architecture.

---

## 5. Replacement Candidates

Potential future replacement patterns:

1. Inline form error for login/signup modal.
2. Inline field-level validation for missing email/password/nickname.
3. Non-blocking toast for general feedback only after a shared toast pattern is approved.
4. Page-level redirect notice for auth-required or redirect context.

Do not introduce multiple feedback systems in one PR.

---

## 6. Guardrails

Future implementation must follow these guardrails:

- Do not remove all auth alerts in one broad PR.
- Do not combine alert replacement with token cache cleanup.
- Do not combine alert replacement with namespace migration.
- Do not combine alert replacement with Firebase config changes.
- Do not change login/logout redirect behavior in the same PR.
- Do not modify PR #7 or prototype/reference/demo/variant paths.
- Preserve current friendly error mapping.
- Preserve current submit-button disabled/restoration behavior.
- Keep Auth/Login runtime smoke mandatory before merge.

---

## 7. Recommended Implementation Split

Recommended staged cleanup:

| Step | Scope | Notes |
|---|---|---|
| PR A | Audit docs only | This PR |
| PR B | Login/signup inline error container | Replace validation and auth failure alerts in login/signup only |
| PR C | Redirect notice cleanup | Only if blocking redirect alerts remain |
| PR D | Logout/general feedback cleanup | Toast or non-blocking notice if needed |
| PR E | Remove any remaining legacy fallback alerts | Only after delegated modules are confirmed loaded everywhere |

---

## 8. Verification Requirements for Future Implementation

Any future alert replacement implementation must verify:

- email login success;
- email login failure;
- signup success;
- signup validation failure;
- Google login unaffected;
- logout baseline;
- redirect parameter preserved;
- unauthenticated protected-page redirect baseline;
- mobile login modal layout;
- no fatal console errors.

Use Cloudflare Preview or an assigned fixed test slot for production-equivalent Auth verification.

---

## 9. Next Recommended PR

The next safest implementation PR is a small login/signup inline error PR that replaces only the modal validation/auth-error alerts, preserves current friendly error mapping, and leaves logout/redirect/general feedback unchanged.

---

## Verification Checklist

- [ ] `git diff --check` passes.
- [ ] Changed files limited to `docs/security/AUTH_ALERT_USAGE_AUDIT.md`.
- [ ] No JavaScript changes.
- [ ] No alert replacement.
- [ ] No UI behavior changes.
- [ ] No close keywords for Issue #78.

---

## Related

Refs #78
