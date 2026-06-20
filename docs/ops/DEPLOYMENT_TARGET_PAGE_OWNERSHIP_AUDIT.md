# Deployment Target and Page Ownership Audit

**Status:** docs/audit-only
**Related:** Refs #2715, Refs #1882
**Production activation remains BLOCKED.**

---

## 1. Purpose and scope

This is the Issue #2715 `docs/audit-only` deployment target and page ownership audit for LoveBud.

It records the current deployment/runtime boundary and the ownership split between the deployed entry map and the `detail.html` / `view.html` page surfaces. It does **not** authorize implementation, runtime changes, deployment changes, environment changes, file deletion, file movement, legacy reactivation, or production activation.

Scope limits for this audit:

- No runtime changes.
- No deployment config changes.
- No Cloudflare env changes.
- No Scout/auth/API/DB changes.
- No Wrangler deploy, Cloudflare preview deploy, or manual production deploy.
- No file deletion, file movement, or legacy artifact reactivation from this audit alone.

`#1882` remains open. This audit only documents guardrails and ownership boundaries; it does not close, fix, or resolve that parent issue.

---

## 2. Current deployed/runtime target map

Official production address:

```text
https://lovebud.pages.dev/
```

Current active runtime flow:

```text
Browser
  -> same-origin /api/*
  -> Cloudflare Pages Functions
  -> Modal
  -> Neon
```

| Layer / path | Current posture | Ownership note |
|---|---|---|
| `https://lovebud.pages.dev/` | Official production frontend address | Browser-facing production domain for merge-after confirmation. |
| Cloudflare Pages | Active browser-facing frontend and same-origin API entry | Serves static frontend assets and owns the same-origin `/api/*` entry boundary. |
| `functions/api/**` | Active Cloudflare Pages Functions gateway | Active gateway for same-origin API requests from the browser. |
| `modal_compute/**` | Active backend compute/runtime | Active Modal runtime for backend compute and API handling. |
| Neon | Active database target | Runtime data target reached through the active Modal path. |
| Vercel | Deprecated transitional fallback under audit | Not the primary production runtime; retained only until file-level evidence and approval support later cleanup. |
| Netlify | Legacy artifact | Not an active production fallback for `lovebud.pages.dev`. |
| `netlify/functions/**` | Legacy artifact | Not the active production fallback path; removal requires separate file-level evidence and approval. |

Important guardrail: legacy or transitional files must not be called “removable” from this audit alone. Any future removal, movement, or reactivation requires exact file inventory, script/test/docs dependency audit, runtime impact review, and explicit approval.

---

## 3. Staging and preview boundary

PR verification boundary:

- Cloudflare Pages PR Preview is the normal pre-merge verification target for changed pages/routes.
- Already approved test or preview URLs are acceptable when explicitly assigned for the work.
- `https://lovebud.pages.dev/` is for merge-after production confirmation, not pre-merge branch verification.

This document does not perform, configure, or authorize:

- preview deploy;
- Wrangler deploy;
- Cloudflare environment variable changes;
- production activation.

---

## 4. Preservation table and no-removal guardrails

The following paths are preserved for this audit. This audit does not delete, move, rename, reactivate, or repurpose them.

| Preserved item | Current classification | No-removal guardrail |
|---|---|---|
| `functions/api/**` | Active Cloudflare Pages Functions gateway | Not a cleanup target in this audit; active same-origin API entry. |
| `modal_compute/**` | Active backend compute/runtime | Not a cleanup target in this audit; active Modal runtime. |
| `vercel.json` | Deprecated transitional fallback artifact | Preserve until exact Vercel file inventory, dependency audit, and approval are complete. |
| `_redirects` | Static route alias marker | Do not delete merely because the name sounds Netlify-related; it can mark static route aliases independent of Netlify runtime ownership. |
| `netlify.toml` | Legacy Netlify artifact | Preserve until exact file inventory, script/test/docs dependency audit, and approval are complete. |
| `netlify/functions/**` | Legacy Netlify Functions artifact | Preserve until exact file inventory, script/test/docs dependency audit, and approval are complete; not active production fallback. |

`_redirects` is a static route alias marker. The presence of “Netlify” in nearby legacy audit language is not sufficient evidence to delete it.

---

## 5. `detail.html` vs `view.html` ownership

### 5.1 `pages/detail.html` + `js/detail.js`

`pages/detail.html` and `js/detail.js` own the individual memory/detail reading surface.

This is a separate detail screen with detail-only hero, media, diary, connected flow, and reactions/comment presentation responsibilities. It is not a replacement for `pages/view.html`, and it is not a sub-implementation of the public viewer surface.

Access permission, visibility, and data source decisions are runtime policy decisions. This audit does not label `detail.html` as authenticated-only without runtime evidence.

### 5.2 `pages/view.html` + `js/viewer/**`

`pages/view.html` and `js/viewer/**` own the public/read-only tree canvas viewer surface.

This surface includes the tree canvas, public viewer UI, and public viewer adapters/helpers. It is a separate public viewer screen, not a target for blind consolidation into `detail.html` or the editor.

Shared UI fragments between `detail.html` and `view.html` do not change route ownership. If consolidation is desired, it requires a separate architecture audit and issue because the route ownership and user purpose are different.

---

## 6. Future small follow-up work

Future work should stay narrow and approval-gated:

- Actual Vercel/Netlify removal requires exact file inventory, script/test/docs dependency audit, runtime impact review, and CTO approval in a separate issue.
- `detail.html` / `view.html` consolidation requires a separate architecture audit and issue.
- Viewer/editor split or merge decisions require a separate architecture audit and issue.
- This audit does not create a cleanup issue.

---

## 7. Non-goals

This audit does not authorize:

- Cloudflare/Vercel/Netlify/Modal config changes.
- Environment variable changes.
- Runtime route changes.
- Scout/auth/API/DB changes.
- File deletion.
- File movement.
- Legacy platform reactivation.
- Production activation.

Production activation remains BLOCKED.
