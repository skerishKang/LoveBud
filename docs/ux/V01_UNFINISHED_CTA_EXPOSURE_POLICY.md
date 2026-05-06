# v0.1 Unfinished CTA Exposure Policy

- **Author:** LoveBud UI/UX Policy
- **Status:** DRAFT
- **Scope:** v0.1 UI Trust Pass release gate (Refs #681)
- **Related issues:** #605, #627, #636, #642, #682, #776, #683

---

## Purpose

Define which CTAs (call-to-action controls) may be exposed to users in v0.1 and which must be fixed, hidden, or deferred. Prevent unfinished, unverified, or destructive actions from reaching production users before their behavior is validated.

---

## Core Rule

> **No CTA may be exposed to a production user unless its complete user-visible flow — including success, error, loading, recovery, and destructive paths — has been verified on a fixed-slot deployment with a matching commit hash.**

"Works on my machine" or "passes lint" is not sufficient for any CTA that:
- Requires authentication
- Writes or deletes data
- Calls a backend API
- Navigates to a runtime-dependent page
- Appears behind a dynamic UI shell (Editor, My Trees, Browse)

---

## CTA Status Taxonomy

| Status | Meaning |
|--------|---------|
| **READY** | CTA is implemented, verified on fixed slot, and safe for production exposure. |
| **FIX_BEFORE_EXPOSURE** | CTA exists in the UI but has known gaps (unverified target, missing error handling, unvalidated destructive path). Must be fixed or hidden before v0.1 release. |
| **HIDDEN_OR_DEFERRED** | CTA is intentionally hidden (commented out, feature-flagged, or behind a dev-only path) or explicitly deferred to post-v0.1. |

---

## Ready CTA Requirements

A CTA is **READY** only when all of the following are true:

1. **Implemented** — The control renders, responds to interaction, and reaches its intended destination.
2. **Runtime-verified** — Any runtime-dependent behavior (API call, auth gate, dynamic navigation) has been verified on a fixed-slot deployment with matching SHA.
3. **Loading/error state acceptable** — If the CTA triggers an async operation, the loading and error states must exist and not crash or hang.
4. **Recovery/back/close behavior acceptable** — The user can recover from the CTA's outcome (navigate back, dismiss modal, retry on failure).
5. **No private/secret exposure** — The CTA does not leak auth tokens, user IDs, DB row references, or other secrets to the DOM, console, or network logs visible to the user.

---

## Verification Requirement

- **CTAs that depend on Auth, API, My Trees, Editor, or Browse** must be verified on a fixed-slot Cloudflare Pages deployment with a confirmed commit SHA match, using a real browser (not curl, not localhost-only).
- **Text-only/static CTAs** (e.g., footer links, static informational links) may be verified by code review and local HTML inspection.
- **CTAs that trigger destructive or data-loss actions** require explicit destructive-flow verification (confirm dialog, undo or recovery path, data permanence understanding).
- **localhost-only verification, text-only diff review, or production destructive testing** are not acceptable substitutes for fixed-slot browser verification of runtime-dependent CTAs.

---

## Screen-Specific Decision Table

### Browse Selected Hub

| CTA_LABEL | SCREEN | DESTINATION | STATUS | REQUIRED_FIX_OR_DEFER_REASON | VERIFICATION_REQUIRED | RELATED_ISSUE |
|-----------|--------|-------------|--------|------------------------------|----------------------|---------------|
| 이 트리 열기 | Browse selected hub | Detail page | FIX_BEFORE_EXPOSURE | Target route readiness and shared-memory/fork flow not yet verified | Fixed-slot browser | #605 |
| 내 러브트리로 가져오기 | Browse selected hub | Import/fork | FIX_BEFORE_EXPOSURE or HIDDEN_OR_DEFERRED | Import/fork recovery and ownership semantics not fully verified | Fixed-slot browser | #605 |
| 감상 링크 복사 | Browse selected hub | Clipboard | READY only if copy success/failure UX verified | Must confirm clipboard API feedback (copied/error) renders correctly in all supported browsers | Fixed-slot browser | #605 |

### Login / Account Entry

| CTA_LABEL | SCREEN | DESTINATION | STATUS | REQUIRED_FIX_OR_DEFER_REASON | VERIFICATION_REQUIRED | RELATED_ISSUE |
|-----------|--------|-------------|--------|------------------------------|----------------------|---------------|
| Google로 로그인 | Login page (login.html) | Firebase OAuth | READY | Verified via PR #865/#866 fixed-slot browser check | Already verified | #776 |
| 이메일로 로그인 | Login page (login.html) | Email auth modal | READY | Verified via PR #865/#866 fixed-slot browser check | Already verified | #776 |
| Google로 시작하기 | Signup page (signup.html) | Firebase OAuth | READY | Verified via PR #866 fixed-slot browser check | Already verified | #776 |
| 이메일로 계정 만들기 | Signup page (signup.html) | Email signup form | READY | Verified via PR #866 fixed-slot browser check (form validation present) | Already verified | #776 |
| Settings / Account management | Login page -> redirect | Settings | FIX_BEFORE_EXPOSURE | Auth/settings route not yet verified with real session | Fixed-slot browser | -- |

### My Trees

| CTA_LABEL | SCREEN | DESTINATION | STATUS | REQUIRED_FIX_OR_DEFER_REASON | VERIFICATION_REQUIRED | RELATED_ISSUE |
|-----------|--------|-------------|--------|------------------------------|----------------------|---------------|
| Primary open owned tree | My Trees | Detail page | READY only after fixed-slot Auth/My Trees verification | Auth-gated list + detail navigation must be verified with real login session | Fixed-slot browser | #681 |
| Create/manage/delete actions | My Trees | Create/edit/delete flows | Classify separately | Destructive/manage actions require explicit verification or defer | Fixed-slot browser | -- |

### Editor

| CTA_LABEL | SCREEN | DESTINATION | STATUS | REQUIRED_FIX_OR_DEFER_REASON | VERIFICATION_REQUIRED | RELATED_ISSUE |
|-----------|--------|-------------|--------|------------------------------|----------------------|---------------|
| Moment edit/save | Editor | Save API | READY only if save/cancel/persistence verified | Save success, cancel rollback, and persistence across navigation must be verified | Fixed-slot browser | #627 |
| Delete / destructive actions | Editor | Delete API | FIX_BEFORE_EXPOSURE or HIDDEN_OR_DEFERRED | Destructive actions require confirmation dialog, undo or recovery path, and verified data permanence understanding | Fixed-slot browser | #636 |
| Placeholder / future controls | Editor | -- | HIDDEN_OR_DEFERRED | Not implemented -- must not be exposed as dead or misleading CTAs | Not applicable | -- |

---

## Status Fields Reference

Each row in a decision table contains:

| Field | Description |
|-------|-------------|
| `CTA_LABEL` | The user-visible text or icon label of the control. |
| `SCREEN` | The page or view where the CTA appears. |
| `DESTINATION` | The target route, API endpoint, or action triggered. |
| `STATUS` | One of `READY`, `FIX_BEFORE_EXPOSURE`, `HIDDEN_OR_DEFERRED`. |
| `REQUIRED_FIX_OR_DEFER_REASON` | Explanation of what is missing or why deferral is acceptable. |
| `VERIFICATION_REQUIRED` | The type of verification needed (fixed-slot browser, code review, etc.). |
| `RELATED_ISSUE` | GitHub issue tracking the gap or verification. |

---

## Reporting Template

When filing a CTA-related issue or audit result, include:

```markdown
### CTA: <CTA_LABEL>
- **Screen:** <SCREEN>
- **Status:** READY | FIX_BEFORE_EXPOSURE | HIDDEN_OR_DEFERRED
- **Evidence:** <link to fixed-slot deployment, verification comment, screenshot, or code reference>
- **Gap:** <what is missing or not yet verified>
- **Recommendation:** <fix before exposure, hide, or defer to post-v0.1>
```

---

## Guardrails

1. **No CTA may be marked READY based on localhost-only verification** for any Auth/API/My Trees/Editor/Browse-dependent action.
2. **No CTA that triggers data mutation (create, update, delete, fork, import) may be exposed without destructive-flow verification** including confirmation, recovery, and error paths.
3. **No placeholder, disabled, or "coming soon" CTA may be visible in the production UI** unless explicitly approved for v0.1 as a read-only informational element.
4. **Any CTA that was previously READY but whose implementation changes** must be re-verified at the same bar before the change ships.
5. **CTAs with status FIX_BEFORE_EXPOSURE must be resolved or hidden before the v0.1 release cut.**

---

## Relationship to #681

This document is owned by the v0.1 UI Trust Pass release gate (#681). It serves as the audit framework for determining which CTAs are trustworthy enough for production users. The decision tables should be updated as issues are resolved and new CTAs are added or removed.
