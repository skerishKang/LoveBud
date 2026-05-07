# v0.1 Visible Action Readiness Policy

- **Author:** LoveBud UI/UX Policy
- **Status:** DRAFT
- **Scope:** v0.1 UI Trust Pass release gate (Refs #681)
- **Related issues:** #605, #627, #636, #642, #647, #674, #682, #683, #776, #790, #825

---

## Purpose

Define which visible actions and CTAs in v0.1 must be fixed and verified before release, and which may be deferred to post-v0.1. Unlike a "hide unfinished features" policy, this document establishes that **broken MVP core flows must be fixed — not hidden — before release.**

---

## Core Rule

> **Visible v0.1 action must be fixed and verified before release. Do not hide broken MVP core flows to claim release readiness. Hiding/defer is allowed only for actions explicitly out of v0.1 scope.**

This means:
- If a CTA is visible in the v0.1 UI and part of the MVP core journey, it must work reliably.
- If it doesn't work yet, the correct response is to fix it — not to hide it, disable it, or leave a dead control.
- Hiding or deferring is reserved for features that are intentionally out of v0.1 scope (future features, paid/private entitlements, v0.2 features).

---

## Status Taxonomy

### READY
- Implemented and runtime-verified.
- If runtime-sensitive: verified on fixed-slot Cloudflare Pages deployment with confirmed SHA match.
- Loading, error, and recovery states are acceptable if they do not crash or hang.
- No secret/private data exposure to DOM, console, or network logs.

### FIX_BEFORE_RELEASE
- Required for v0.1/MVP core flow.
- Currently incomplete, unstable, or insufficiently verified.
- **Must be fixed via a narrow issue/PR — not hidden.**
- Until fixed: release blocker or release hold.

### DEFERRED_OUT_OF_SCOPE
- Outside v0.1 scope entirely.
- Future features, paid/private entitlements, placeholders, v0.2 features.
- Must be removed from the release surface or not exposed in production.
- Tracked via separate follow-up issue.

### REQUIRES_DECISION
- Not yet decided whether this is v0.1 core.
- Needs CTO/product decision.
- Not release-ready until decision is made.

---

## MVP Core Flows (FIX_BEFORE_RELEASE required, not hide)

The following are v0.1 MVP core actions. If any are broken or unverified, they must be **fixed before release**, not hidden:

- Signup / Login / Logout / Protected route blocking
- My Trees owned tree list loading
- First tree / first moment creation
- Editor open / edit / save / persistence
- Browse/Public core CTAs exposed in v0.1
- Mobile 375 core journey

---

## Verification Requirement

- Auth/API/My Trees/Editor/Browse-dependent visible actions must be verified on a **fixed-slot Cloudflare Pages deployment with a confirmed commit SHA match**, using a **real browser**.
- **localhost-only verification, text-only diff review, or GitHub metadata-only checks are not sufficient.**
- **Production destructive testing is prohibited** without explicit approval. Smoke testing on production is acceptable for non-destructive read-only flows.

---

## Screen-Specific Decision Table

### Login / Signup

| SCREEN | ACTION / CTA | MVP_STATUS | CURRENT_DECISION | REQUIRED_FIX_OR_VERIFICATION | RELATED_ISSUE | RELEASE_IMPACT |
|--------|-------------|------------|------------------|------------------------------|---------------|----------------|
| login.html | Login (Google + Email) | CORE | READY | Verified via PR #865/#866/#776 fixed-slot browser check | #776 | None |
| signup.html | Signup (Google + Email form) | CORE | READY | Verified via PR #866/#776 fixed-slot browser check | #776 | None |
| login.html | Settings / Account management | CORE if v0.1 route | FIX_BEFORE_RELEASE or DEFERRED_OUT_OF_SCOPE | Must verify Auth/settings route or defer until #825 passes | #825 | Release hold if exposed and broken |

### My Trees

| SCREEN | ACTION / CTA | MVP_STATUS | CURRENT_DECISION | REQUIRED_FIX_OR_VERIFICATION | RELATED_ISSUE | RELEASE_IMPACT |
|--------|-------------|------------|------------------|------------------------------|---------------|----------------|
| my-trees.html | Owned tree list load | CORE | FIX_BEFORE_RELEASE | Auth/API consistency must be verified with real login session | -- | Release blocker |
| my-trees.html | Primary open owned tree | CORE | FIX_BEFORE_RELEASE | My Trees -> Editor route must be verified | -- | Release blocker |
| my-trees.html | Create/manage/delete actions | CORE if visible | FIX_BEFORE_RELEASE | Destructive actions require explicit verification or defer if non-core | -- | Release hold if exposed and broken |
| my-trees.html | Private/public visibility display | REQUIRES_DECISION | FIX_BEFORE_RELEASE or DEFERRED depending on #674 audit | Awaiting #674 audit result | #674 | Decision required before release |

### Editor

| SCREEN | ACTION / CTA | MVP_STATUS | CURRENT_DECISION | REQUIRED_FIX_OR_VERIFICATION | RELATED_ISSUE | RELEASE_IMPACT |
|--------|-------------|------------|------------------|------------------------------|---------------|----------------|
| editor.html | Open existing tree | CORE | FIX_BEFORE_RELEASE | Full journey (auth -> my-trees -> editor) must be verified | -- | Release blocker |
| editor.html | Moment edit/save/persistence | CORE | FIX_BEFORE_RELEASE | Save success, cancel rollback, persistence across navigation must be verified | #627 | Release blocker |
| editor.html | Delete / destructive actions | CORE if exposed | FIX_BEFORE_RELEASE if exposed; otherwise DEFERRED_OUT_OF_SCOPE | Requires confirmation dialog, undo/recovery, verified data permanence | #636 | Release hold if exposed and broken |
| editor.html | Mobile populated canvas visibility | CORE if mobile MVP required | FIX_BEFORE_RELEASE | Related #790 | #790 | Release hold if mobile is v0.1 core |

### Browse / Public

| SCREEN | ACTION / CTA | MVP_STATUS | CURRENT_DECISION | REQUIRED_FIX_OR_VERIFICATION | RELATED_ISSUE | RELEASE_IMPACT |
|--------|-------------|------------|------------------|------------------------------|---------------|----------------|
| search.html | "이 트리 열기" | CORE if exposed in v0.1 | FIX_BEFORE_RELEASE | Target route readiness must be verified | #605, #647 | Release hold if exposed and broken |
| search.html | "내 러브트리로 가져오기" | CORE if MVP core; otherwise non-core | FIX_BEFORE_RELEASE if exposed; otherwise DEFERRED_OUT_OF_SCOPE | Import/fork recovery and ownership semantics must be verified | #605 | Release hold if exposed and broken |
| search.html | "감상 링크 복사" | CORE if exposed | READY only after copy success/failure UX verified; otherwise FIX_BEFORE_RELEASE | Clipboard API feedback (copied/error) must render correctly in all supported browsers | #605 | Release hold if exposed and broken |
| viewer | Public viewer read-only | CORE if public Browse is v0.1 core | FIX_BEFORE_RELEASE | Public tree render and read-only mode must be verified | -- | Release blocker if public browse is v0.1 core |

---

## Reporting Template

```
## Visible Action Readiness Report

Action:
Screen:
Destination:
Is v0.1/MVP core: YES/NO/DECISION_REQUIRED
Current status: READY / FIX_BEFORE_RELEASE / DEFERRED_OUT_OF_SCOPE / REQUIRES_DECISION
Required fix:
Required verification:
Related issue:
Release impact:
Secret/private data exposure: NO
```

---

## Guardrails

1. **Do not hide broken MVP core flows to claim release readiness.** Broken core flows are release blockers, not hide candidates.
2. **Do not expose unfinished future features as visible CTAs.** Any CTA that is DEFERRED_OUT_OF_SCOPE must not appear in the production UI.
3. **Do not merge runtime-sensitive action changes without fixed-slot verification.** For any Auth/API/My Trees/Editor/Browse-dependent action, localhost-only or text-only review is insufficient.
4. **Do not expose credentials, tokens, sessions, cookies, DB URLs, tree IDs, owner IDs, memory IDs, raw payloads, or private rows** to the DOM, console, or network logs.
5. **Do not touch PR #7 or prototype/reference/demo/variant paths.**

---

## Relationship to #681

This document defines the visible action readiness criteria for the v0.1 UI Trust Pass release gate (#681). Before #681 can be closed:

- Each core screen (Login/Signup, My Trees, Editor, Browse/Public) must have either **READY** status for all visible actions or an explicit **DEFERRED_OUT_OF_SCOPE** or **REQUIRES_DECISION** status.
- **MVP core flows (those marked CORE) cannot be deferred.** They must reach READY status before release.

PR #7 and all prototype/reference/demo/variant paths are explicitly excluded from this policy's scope and must not be modified.
