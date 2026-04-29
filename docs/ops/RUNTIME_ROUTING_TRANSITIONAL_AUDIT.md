# Runtime Routing Transitional Layer Audit

> **Audit document only.**
> This document records the current state of runtime routing layers before any deprecation, deletion, deactivation, or route mapping change.
> No removal or routing action may be taken based solely on this document.
> All follow-up actions require separate CTO approval and production-equivalent validation.

---

## 1. Purpose

This document is a **runtime routing transitional layers audit** for the LoveBud project.

It is a **prerequisite audit** that must precede any:
- deletion or movement of transitional routing folders
- deactivation of fallback layers
- routing contract changes
- deprecation of legacy infrastructure

No action is taken in this PR. This document only records current state and defines questions to resolve.

---

## 2. Current Runtime Truth

| Role | Layer | Status |
|------|-------|--------|
| Official user-facing entry | **Cloudflare Pages** (`lovebud.pages.dev`) | ✅ Active production |
| Browser/API contract | same-origin `/api/*` | ✅ Active |
| Active API router | `functions/api/[[path]].js` | ✅ Active (Cloudflare Pages Functions) |
| Active compute/runtime priority | `modal_compute/` | ✅ Active |
| Legacy backend | `netlify/functions/*` | ⚠️ Legacy / fallback / artifact only |
| Legacy schema/seed | `netlify/sql/*` | ⚠️ Legacy artifact only |
| Transitional fallback | Vercel config/API code | 🔍 Deprecated transitional fallback — under audit |
| Legacy config | `netlify.toml` | ⚠️ Legacy artifact — not active production config |

### Active Production Entry Point

```
Official production URL: https://lovebud.pages.dev
Platform:               Cloudflare Pages
API contract:           same-origin /api/*
API router:             functions/api/[[path]].js
Compute backend:        modal_compute/
```

Neither Netlify nor Vercel serves as the active production backend for `lovebud.pages.dev`.

---

## 3. Current Active Flow

```
Browser
  └─▶  https://lovebud.pages.dev
         └─▶  same-origin /api/*
                └─▶  Cloudflare Pages Functions
                       └─▶  Modal compute (modal_compute/)
```

All browser API traffic flows through this path.
No fallback or alternative path is intentionally active in production.

---

## 4. Layer Inventory

The following layers are identified as transitional or requiring audit:

### 4.1 Cloudflare Pages Functions
- **Path:** `functions/api/[[path]].js`
- **Status:** ✅ Active production API router
- **Role:** Catches all same-origin `/api/*` requests and forwards to Modal
- **Action required:** None at this time

### 4.2 Modal Compute
- **Path:** `modal_compute/`
- **Status:** ✅ Active compute backend
- **Role:** Handles browse, community, and private read-heavy routes
- **Action required:** None at this time

### 4.3 Vercel Fallback / API Code
- **Path:** `vercel.json` and any Vercel-targeted API code
- **Status:** 🔍 Deprecated transitional fallback — under audit
- **Role:** Was transitional routing layer; current production role unconfirmed
- **Action required:** Audit whether any live traffic or contract tests still reference Vercel as a production entry; confirm safe deprecation path before any removal

### 4.4 Netlify Config and Functions
- **Path:** `netlify/functions/*`, `netlify.toml`
- **Status:** ⚠️ Legacy / fallback / artifact — not active production backend
- **Role:** Historical backend; preserved as artifact
- **Action required:** Confirm no active traffic; confirm no contract tests assert Netlify routes as production truth before any deprecation

### 4.5 Netlify SQL
- **Path:** `netlify/sql/*`
- **Status:** ⚠️ Legacy schema/seed artifact
- **Role:** Historical reference only; not active migration source of truth
- **Action required:** Confirm no tooling references these as active schema source before any removal

### 4.6 `js/postgres-client.js` Routing Comments
- **Path:** `js/postgres-client.js`
- **Status:** 🔍 Under audit
- **Role:** May contain routing comments or endpoint references reflecting older runtime truth
- **Action required:** Review whether comments reference Netlify, Vercel, or outdated API paths; update docs if stale (no code change in this PR)

### 4.7 Deployment and Ops Docs
- **Path:** `docs/ops/*`, `docs/**`
- **Status:** 🔍 Under audit
- **Role:** May contain references to legacy runtime paths (Netlify, Vercel, old API routes)
- **Action required:** Review for stale references to non-active production paths (follow-up PR C)

### 4.8 Tests / Contract Route Assertions
- **Path:** `tests/contracts/*`, `tests/**`
- **Status:** 🔍 Under audit
- **Role:** Contract tests may assert route expectations against older runtime truth
- **Action required:** Confirm all contract tests assert `lovebud.pages.dev` / Cloudflare Pages / Modal as the current production truth (follow-up PR B)

---

## 5. Questions to Resolve

The following questions must be answered before any deprecation or removal action:

1. **Which runtime path is official today?**
   → Cloudflare Pages (`lovebud.pages.dev`) + Modal compute. Needs explicit CTO sign-off on written record.

2. **Which fallback paths are intentionally supported?**
   → Unknown for Vercel. Netlify is legacy/artifact. Needs audit of live traffic and contract tests.

3. **Which transitional routes are legacy and safe to deprecate later?**
   → Vercel fallback routes and Netlify Functions are candidates. Not confirmed safe until Questions 1–2 are resolved.

4. **Which tests/docs still reference older runtime truth?**
   → `js/postgres-client.js` comments, deployment docs, and contract tests require review. See layer inventory §4.6–4.8.

5. **What production-equivalent validation is required before deleting fallback layers?**
   → At minimum: confirm no live traffic on Netlify/Vercel paths, confirm contract tests pass against Cloudflare + Modal only, CTO sign-off.

---

## 6. Non-Goals and Guardrails

This document and the PR that introduces it **do not** and **must not**:

- Delete or move any Netlify file or folder
- Delete or modify any Vercel config or code
- Change any Cloudflare Pages route mapping
- Change any browser API routing
- Modify env, config, or deploy settings
- Touch Search, Editor, or Detail UI work
- Modify or close PR #7
- Close Issue #119

All audit findings here are informational only. No action is taken.

---

## 7. Recommended Follow-up PR Split

| PR | Scope | Prerequisite |
|----|-------|--------------|
| **PR A** | Runtime routing audit doc (this PR) | None |
| **PR B** | Route contract/test guard review — confirm contract tests assert current production truth | PR A merged |
| **PR C** | Docs consistency update — fix stale runtime references in ops docs and comments if found | PR A merged |
| **PR D** | Optional legacy guard/checklist only — add deprecation checklist without removing anything | CTO approval after PR B + C |
| **PR E** | Any removal or deprecation — delete or deactivate fallback layers | Production-equivalent validation complete + separate CTO approval |

> **No PR D or PR E work may begin without explicit CTO approval.**
> PR B and PR C are safe to proceed as docs/audit-only work after this PR merges.

---

*Last updated: 2026-04-29*
*Scope: audit-only, docs-only, no runtime or route changes*
*Related: Refs #119*
