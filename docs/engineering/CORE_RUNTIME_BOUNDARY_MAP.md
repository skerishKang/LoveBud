# Core Runtime Boundary Map

## Purpose

This document defines the core module ownership and runtime boundary map for LoveBud.

It is a docs-only reference for Issue #428. It does not authorize code refactoring, file moves, ES module conversion, bundler adoption, runtime behavior changes, or multi-domain implementation work.

Goals:

- make core runtime owner domains explicit
- reduce repeated external-review false positives
- separate frontend, API gateway, Modal backend, database, and Firebase Auth responsibilities
- clarify which verification environment is required for each domain
- provide follow-up split guidance before implementation PRs

Refs #428

---

## Runtime path summary

Current runtime path:

```text
browser pages
→ browser-global JavaScript modules
→ same-origin /api/*
→ Cloudflare Pages Functions under functions/api/*
→ Modal backend under modal_compute/*
→ Neon DB
```

Firebase role:

```text
Firebase Web SDK
→ client bootstrap / auth state / ID token acquisition
→ Authorization header for same-origin /api/*
```

Firebase is not the primary application database for the active tree/memory runtime. It provides browser auth bootstrap and authenticated user identity. Modal verifies Firebase ID tokens and applies backend-side owner and entitlement boundaries.

Runtime interpretation rules:

- Browser pages own DOM entry, script loading, and page shell behavior.
- Browser JavaScript owns UI state, adapters, client-side normalization, auth bootstrap coordination, and same-origin API calls.
- Same-origin `/api/*` is the browser-facing API boundary.
- Cloudflare Pages Functions own route mapping, request forwarding, safe degraded responses, and upstream provenance headers.
- Modal owns backend route policy, DB queries, writes, auth verification, entitlement checks, and response normalization.
- Neon DB owns persistent tree/memory data.
- Netlify remains a legacy artifact unless explicitly reactivated by CTO decision.
- Vercel remains secondary/transitional infrastructure, not the default browser-facing source of truth.

---

## Frontend owner domains

| Domain | Primary files / areas | Owner responsibility | Boundary notes |
|---|---|---|---|
| Auth/bootstrap/session/cache | `js/auth.js`, `js/auth/*`, `pages/login.html`, shared protected-page loaders | Firebase bootstrap, auth state observation, protected-route redirect, logout/session cleanup, auth UI state, cache compatibility | Do not mix Auth provider changes with page UI polish. Auth changes usually need fixed test slot verification. |
| API client | `js/api/*`, API facade globals used by page modules | Build same-origin `/api/*` calls, attach safe auth headers, parse API errors, preserve flat camelCase expectations | Does not own Cloudflare route policy or Modal SQL/write rules. Do not hardcode external Modal/Vercel/Netlify targets in browser defaults. |
| Search/Browse | `pages/search.html`, `js/search/*`, browse adapters, search CSS | Public browse display, summary cards, preview hydration, public tree visibility display, browse eligibility presentation | Browse display filter is not publication/write guard. Runtime-sensitive checks need Cloudflare Preview or fixed test slot. |
| Detail | `pages/detail.html`, `js/detail/*`, detail CSS | Public tree/memory detail presentation, unavailable/not-found state, optional auth-aware owner/public fallback display | Detail should not assume private access client-side. API/Modal owns private read boundary. |
| My Trees | `pages/my-trees.html`, `js/my-trees/*`, my-trees CSS | Owner tree list, create/update/delete UI, visibility controls, owner-only state presentation | Owner authorization and Plus/private storage enforcement must be backend-side. UI lock is not the security boundary. |
| Editor | `pages/editor.html`, `js/editor.js`, `js/editor/*`, editor CSS | Memory editing UI, editor state, current tree context, save/delete flows, fallback compatibility, editor-specific rendering | Editor global state and fallback extraction require audit gates. Do not combine Editor refactor with Auth/API policy changes. |
| Settings | `pages/settings.html`, `js/settings.js`, settings CSS | Account/settings page behavior, auth-pending state, return navigation, settings page shell | Auth-gated behavior must not be judged by local static server alone. |
| Shared header / page shell | shared header scripts/styles, page-level nav shell, mobile menu | Header rendering, nav state, language selector, shared page affordances | Shared header changes can affect all pages. Keep helper/config changes separate from feature behavior. |
| i18n | `js/i18n/*` and related globals | Language state, translation lookup, locale-safe text switching | Do not couple i18n changes with runtime/API changes unless explicitly scoped. |
| Firebase web config/init | `js/firebase-config.js` and initialization helpers | Browser Firebase SDK initialization config and auth bootstrap dependency | Firebase Web config is public-by-design. Do not treat visible Web config alone as a secret exposure blocker. |

---

## Backend and runtime owner domains

| Domain | Primary files / areas | Owner responsibility | Boundary notes |
|---|---|---|---|
| Browser API client | `js/api/*` | Same-origin request construction, token header attachment, response/error handling for page code | May classify auth status but must not become owner of backend authorization policy. |
| Cloudflare API gateway | `functions/api/*` | `/api/*` route ownership, Modal target mapping, method handling, degraded responses, cache where applicable, upstream headers | Should not implement new business policy that belongs in Modal unless explicitly scoped. Keep route ownership matrix updated. |
| Modal routes | `modal_compute/app.py` and future route/service splits | FastAPI routes, public/private route separation, browse summary behavior, owner reads/writes, fork behavior | Modal is active backend policy owner. Changes require route/contract/security verification. |
| Modal auth | `modal_compute/auth.py` | Firebase ID token verification, Firebase Admin use, private storage entitlement checks | Secret values must remain env-secret based and never be printed. Frontend-only Plus lock is insufficient. |
| Modal DB access | `modal_compute/db.py` | Neon connection pool, retry/reset behavior, DB connection lifecycle | Browser and Cloudflare should not access Neon directly. |
| Modal validation/serialization | `modal_compute/validation.py` | UUID/visibility/string validation, flat camelCase response normalization | API contract changes require docs and tests. Legacy `{id, data}` should not be reintroduced. |
| Neon DB | external DB used by Modal | Persistent tree/memory rows and relational owner boundaries | Access must go through Modal runtime policy, not browser direct access. |
| Firebase Auth / Firestore profile | Firebase Console and Admin SDK usage | Auth identity and selected entitlement/profile checks | Firestore Rules and Console posture are separate ops/security domains; do not conflate with Neon tree/memory persistence. |

---

## `window.*` namespace contracts

LoveBud currently uses HTML script loading and browser-global module patterns. `window.*` contracts are therefore runtime APIs, not incidental implementation details.

Responsibilities:

- Each browser-global namespace must have one primary owner module.
- Compatibility aliases should preserve existing page behavior while extraction is staged.
- New namespaces should be explicit, named, and documented when they become cross-file contracts.
- Root compatibility files may expose facades, but should not accumulate new feature logic.
- Loading order changes must be treated as runtime-sensitive changes.

Compatibility alias policy:

- Keep existing aliases stable until dependent pages are migrated and verified.
- Do not delete aliases in the same PR that adds new helper modules unless the task explicitly authorizes removal and verification.
- Document alias ownership before implementation cleanup.
- Avoid creating multiple aliases for the same responsibility without a migration plan.

Loading-order risk:

- `type="module"` changes execution timing, scope, and global availability.
- Do not convert scripts to ES modules unless explicitly authorized.
- Do not introduce bundler assumptions into current browser-global runtime without a separate architecture decision.
- Page script order changes require page-level smoke evidence and, for auth/API pages, Cloudflare Preview or fixed test slot evidence.

---

## Verification requirements by domain

| Change domain | Docs-only | Local browser | Cloudflare Preview | Fixed test slot |
|---|---:|---:|---:|---:|
| Documentation only | Required | Not required unless rendering links manually | Not required | Not required |
| Static copy/CSS on public non-API page | Helpful | Usually sufficient for layout reference | Preferred for deployed asset confidence | Usually not required |
| Shared header/page shell | Helpful | Required for basic smoke | Preferred because cross-page impact is broad | Required if auth/session state is involved |
| Search/Browse | Helpful | Supporting evidence only | Required for deployed branch/API path behavior | Required when API/data assertions, auth, or stable data are needed |
| Detail | Helpful | Supporting evidence only | Required for public deployed detail behavior | Required for private/auth fallback behavior |
| Auth/Login | Helpful | Not sufficient for final pass | Useful but may be insufficient | Required for login/session/redirect behavior |
| My Trees | Helpful | Not sufficient for final pass | Useful but may be insufficient | Required for owner-only/API/write behavior |
| Editor | Helpful | Not sufficient for final pass | Useful but may be insufficient | Required for save/delete/auth/API behavior |
| Settings | Helpful | Supporting evidence for static shell | Preferred | Required for auth-gated behavior |
| Cloudflare API gateway | Required for policy changes | Not sufficient | Required for route behavior | Required if auth/data/write behavior matters |
| Modal backend | Required for policy changes | Not sufficient | Not sufficient by itself | Required with assigned slot or controlled runtime target |

Evidence should separate PASS, FAIL, BLOCKED, and NOT_VERIFIED. Reports must not include credential, token, cookie, session, service-account, private key, or secret values.

---

## Follow-up split

Recommended follow-up sequence after this docs-only map:

1. Namespace inventory.
   - Inventory `window.*` namespaces, aliases, owners, and dependent pages.
   - Docs-only first.
2. Storage/auth cache inventory.
   - Inventory `localStorage` and `sessionStorage` keys, auth cache behavior, ownership, and cleanup paths.
   - Do not print values.
3. API client naming audit.
   - Clarify `LoveBud` vs `LoveTree` API client facade names and compatibility aliases.
   - Docs-only before implementation.
4. Search-specific implementation.
   - Only after Search/Browse ownership and script-order boundaries are documented.
   - Keep display filter logic separate from publication guard logic.
5. Editor-specific implementation.
   - Only after Editor fallback/global state audit gates are satisfied.
   - Do not combine with Auth provider changes.
6. Auth-specific implementation.
   - Only after Auth/Login provider transition gates and fixed test slot requirements are satisfied.
   - Do not combine with unrelated UI or API cleanup.

---

## Guardrails

- No code refactor from this document.
- No file moves from this document.
- No ES module conversion.
- No bundler adoption.
- No multi-domain implementation PR.
- No broad fallback cleanup without owner docs and verification plan.
- No runtime/client/backend/package/workflow changes.
- No Firebase/Cloudflare/Modal/Netlify/Vercel config changes.
- No secret, token, cookie, session, credential, service-account, or private key value exposure.
- No PR #7, prototype, reference, demo, or variant path changes.
- Use non-completing issue references only for #428 unless CTO explicitly authorizes final issue completion.

---

## Review checklist

Before proposing implementation work that touches core runtime modules, answer:

- Which owner domain owns the change?
- Which adjacent domains must remain unchanged?
- Which browser-global namespace or compatibility alias is affected?
- Does the change alter script loading order?
- Does the change require Cloudflare Preview or fixed test slot verification?
- Does it require auth/test-account handling?
- Does it touch API response shape or backend authorization policy?
- Can it be split into a narrower PR?
- Are PR #7 and prototype/reference/demo/variant paths untouched?

Refs #428
