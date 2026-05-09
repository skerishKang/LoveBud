# Shared Root JS Ownership Audit

> Status: audit only
> Related: #72
> Runtime impact: none

## 1. Purpose

This document is an audit-only record of root-level shared JavaScript files and their ownership before any move, rename, or wrapper extraction work.

It is NOT an implementation approval document. It documents current state, responsibility boundaries, and required follow-ups.

No JavaScript edits, page script order changes, file moves, or renames are authorized by this document alone.

## 2. Files in scope

| File | Current role | Current judgment | Follow-up needed |
|------|--------------|-------------------|------------------|
| `js/auth.js` | Authentication utilities and session management | Active, widely used | Consumer inventory before any refactor |
| `js/i18n.js` | Internationalization helpers and language switching | Active, UI-critical | Shared header boundary check before extraction |
| `js/firebase-config.js` | Firebase initialization and config contract | Active, Auth-dependent | Firebase config contract check before changes |
| `js/page-shell.js` | Page shell rendering and layout utilities | Active, header/footer related | Verify with SHARED_HEADER_CONFIG_HELPER_DECISION.md |
| `js/shared-header.js` | Header rendering, mobile nav, language, Auth helpers | Active, cross-page | Separate audit for helper extraction defer conditions |
| `js/postgres-client.js` | Browser-side PostgreSQL client utilities | Active, API-related | Browser API client rename only after explicit approval |

## 3. Current judgment

- **Broad root JS move/rename is FORBIDDEN.**
- Do NOT mix with Search / Editor / Detail / My Trees work.
- Root shared JS must be handled in separate audit/test phases, then implemented via focused PRs covering **one file or one responsibility at a time** with explicit approval.

## 4. Guardrails

- **Current browser globals must be preserved.** No `window.*` removals or renames without dedicated migration PR.
- **Page script loading order must be preserved.** Any dependency changes require SCRIPT_LOAD_ORDER.md review.
- **Shared header / i18n / firebase config / browser API client** each require separate boundary reviews.
- **PR #7 is untouched.** No auth flow changes.
- **Prototype/reference/demo/variant paths are untouched.**

## 5. Recommended follow-ups

Before any implementation PRs:

1. **Root JS consumer inventory**
   - Map every page and module that imports from each root JS file.
   - Document browser globals injected by each file.

2. **Shared header boundary check**
   - Review SHARED_HEADER_CONFIG_HELPER_DECISION.md defer conditions and triggers.
   - Confirm whether shared header is stable enough for helper extraction.

3. **Firebase config contract check**
   - Verify FIREBASE_CONFIG_CONTRACT.md still matches current Firebase init behavior.
   - Check AUTH_LOGIN_ACTIVE_PROVIDER_TRANSITION_PLAN.md for config migration phase gates.

4. **Browser API client rename implementation**
   - Only after explicit approval in a separate, focused PR.
   - Must include runtime smoke tests for all affected pages.

## 6. Non-goals

- No JavaScript edits.
- No page script order edits.
- No file moves.
- No file renames.
- No Issue #72 closure from this document alone.

This document maps Issue #72 root JS audit items. It does not authorize direct implementation, merge, deletion, or runtime cleanup.
