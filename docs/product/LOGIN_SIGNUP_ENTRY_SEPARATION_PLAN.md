# Login / Signup Entry Separation Plan

Refs #776
Refs #642
Refs #670

## Purpose

LoveBud needs clearer account-entry semantics before v0.1. The current login surface has historically mixed returning-user login, first-time signup/start language, Google continuation, email login, and account creation affordances in one page. That makes the user-facing question ambiguous: is this a login page, a signup page, or a combined account entry flow?

This document defines the product and verification boundary for separating returning-user login from first-time signup/start while preserving the existing Auth provider behavior unless a separate Auth implementation issue explicitly changes it.

## Problem statement

A single account-entry page can become confusing when it shows several visually similar actions:

- Google start/login;
- email start/login;
- first-time user helper copy;
- signup form fields;
- account creation submit;
- returning-user login copy.

The word `시작하기` is especially risky on a returning-user login page because it can mean either sign in, sign up, or begin onboarding. Issue #670 and the login CTA cleanup direction already identified this ambiguity at the copy level. Issue #776 expands the decision into a page-model boundary.

## Product model

LoveBud should treat account entry as two user-facing contexts:

| Context | Primary audience | Page role | Recommended route direction |
| --- | --- | --- | --- |
| Login | Existing users | Return to an existing account/session | `pages/login.html` |
| Signup / Start | First-time users | Start LoveBud and create or initialize account access | `pages/signup.html` or `pages/start.html` |

The underlying Google provider may remain the same if the Auth implementation uses one shared provider flow. The user-facing page copy should still distinguish intent.

## Login page direction

The login page should be optimized for returning users.

Recommended hierarchy:

1. Primary: `Google로 로그인`
2. Secondary: `이메일로 로그인`
3. Quiet link: `처음 오셨나요? 회원가입하기`

The login page should not show a full signup form by default. It may link to the signup/start route, but it should not make first-time onboarding compete with returning-user login.

Copy guidance:

- Use `로그인` for returning-user actions.
- Avoid `시작하기` as the main login page action label.
- Keep explanation compact; the login page is not the product-education surface.

## Signup / start page direction

The signup/start page should be optimized for first-time users.

Recommended hierarchy:

1. Primary: `Google로 시작하기`
2. Secondary: `이메일로 계정 만들기`
3. Quiet link: `이미 계정이 있나요? 로그인하기`

The page may explain that Google start can create or initialize account access through the same underlying provider flow. If email signup remains a form, it should live here or open from here rather than appearing as a default state on the login page.

Route naming options:

- `pages/signup.html`: clearer account-creation semantics;
- `pages/start.html`: softer onboarding semantics;
- defer the final route name until implementation if the product copy needs review.

## Required implementation decisions

Before runtime implementation, decide:

1. Final route name: `signup.html`, `start.html`, or another approved route.
2. Whether email signup appears inline on the signup/start page or opens after clicking `이메일로 계정 만들기`.
3. Whether Google signup and Google login share the same handler with page-context copy only.
4. Whether `pages/login.html` should keep any hidden signup DOM for compatibility or remove it entirely.
5. Whether current #642/#670 follow-up PRs are superseded or absorbed by the split.

## Auth and runtime boundary

This plan does not authorize Auth provider, backend, Firebase, database, or token behavior changes.

Allowed in a future implementation PR:

- route/page split for account-entry UI;
- login/signup i18n copy;
- HTML/CSS changes needed for the split;
- narrow JS delegation if the existing login/signup handlers need separate page bootstraps;
- shared handler reuse when behavior is identical.

Not allowed without separate approval:

- changing Firebase provider configuration;
- changing password or email-link policy;
- changing backend/API Auth semantics;
- changing session/token/cache security behavior;
- adding account settings/profile management;
- modifying unrelated Editor, My Trees, Browse, Detail, Modal, package, or workflow files.

## UX acceptance criteria

A future implementation should satisfy:

- returning users see a login-first page;
- first-time users have a clear signup/start route;
- `시작하기` is not used ambiguously on the returning-user login page;
- Google entry remains available if currently supported;
- email login remains available on the login page;
- email account creation, if supported, appears in signup/start context;
- links between login and signup/start are quiet but discoverable;
- mobile 375px does not create CTA crowding or overflow;
- desktop layout communicates one primary action per context.

## Verification requirements

Because this work touches Login/Auth UI, implementation PRs require deployed browser verification.

Required verification:

- fixed test slot or valid Cloudflare deployment with deployed SHA matching PR head;
- login page opens and shows returning-user hierarchy;
- signup/start link opens the signup/start route;
- signup/start route shows first-time hierarchy;
- Google action remains wired in intended contexts;
- email login remains wired on login page;
- email account creation remains wired on signup/start page if implemented;
- logged-in user behavior remains coherent;
- logged-out user behavior remains coherent;
- desktop screenshot review;
- mobile 375px screenshot review;
- fatal console/page errors: NONE;
- restricted private data exposure: NO.

Local-only, production-only, or text-only verification is not enough for final runtime PASS.

## Reporting guardrails

Reports must not include:

- credentials;
- tokens;
- sessions;
- cookies;
- headers;
- passwords;
- private keys;
- DB URLs;
- tree IDs;
- owner IDs;
- memory IDs;
- copied tree IDs;
- raw Auth payloads;
- DB row values.

Use safe status labels such as:

```text
LOGIN_PAGE_HIERARCHY_PASS
SIGNUP_ROUTE_PRESENT
AUTH_PROVIDER_WIRED
EMAIL_LOGIN_WIRED
EMAIL_SIGNUP_WIRED
MOBILE_375_PASS
SHA_MATCH_CONFIRMED
SECRET_EXPOSURE_NO
```

## Follow-up split recommendation

Preferred implementation split:

1. Docs/product decision record — this document.
2. Login page hierarchy cleanup if not already complete.
3. Signup/start route shell with copy and links.
4. Email signup DOM/handler separation if needed.
5. Fixed-slot browser verification and reconciliation of #642/#670/#776 status.

Do not combine this with broader Auth architecture refactors or account settings work.

## Current disposition

This document provides the product planning boundary for #776. It does not implement the route split and does not close #776. The issue should remain open until the runtime implementation and fixed-slot browser verification are complete or explicitly deferred.
