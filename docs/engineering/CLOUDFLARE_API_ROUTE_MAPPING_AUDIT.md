# Cloudflare API Route Mapping Audit

> **Version:** 1.0
> **Last updated:** 2026-04-29
> **Related issue:** #223

---

## 1. Purpose

This document audits the Cloudflare Pages same-origin `/api/*` route mapping contract. It captures the current runtime path, contract questions, and guardrails before any route helper extraction.

---

## 2. Current Runtime Path

```text
browser
  → same-origin /api/*
    → Cloudflare Pages Functions under functions/api/[[path]].js
      → Modal backend (Modal base URL from env.MODAL_BASE_URL)
        → Neon database (via Modal)
```

### Active Route Handler

- `functions/api/[[path]].js` is the catch-all handler for recognized API routes
- Legacy `netlify/functions/*` is not the current production backend for `lovebud.pages.dev`

---

## 3. Audit Targets

### 3.1 Route Mapping (`functions/api/[[path]].js`)

| Cloudflare Path | Method | Modal Target | Notes |
|-----------------|--------|--------------|-------|
| `/api/community/trees` | GET | `/modal/browse/latest` | `view=summary` parameter for browse summary |
| `/api/community/trees` | GET | `/modal/browse/latest` | `sort=popular` maps to `/modal/browse/popular` (implicit) |
| `/api/community/growing-trees` | GET | `/modal/browse/growing` | Growing trees feed |
| `/api/community/memories` | GET | `/modal/community/memories` | Public memory hydration by treeId |
| `/api/trees` | GET | `/modal/private/trees` | Private trees list (requires auth) |
| `/api/trees` | POST | `/modal/private/trees` | Create tree (auth required) |
| `/api/memories` | GET | `/modal/private/memories` | Private memories list (requires auth) |
| `/api/memories` | POST | `/modal/private/memories` | Create memory (auth required) |
| `/api/trees/:id` | GET | `/modal/private/trees/:id` | Private owner view (with auth) |
| `/api/trees/:id` | GET | `/modal/trees/:id` | Public view (no auth) |
| `/api/trees/:id` | PUT | `/modal/private/trees/:id` | Update (auth required) |
| `/api/trees/:id` | DELETE | `/modal/private/trees/:id` | Delete (auth required) |
| `/api/memories/:id` | GET | `/modal/memories/:id` | Public memory read |
| `/api/memories/:id` | PUT | `/modal/private/memories/:id` | Update (auth required) |
| `/api/memories/:id` | DELETE | `/modal/private/memories/:id` | Delete (auth required) |

### 3.2 Modal Base URL Handling

- `env.MODAL_BASE_URL` from Cloudflare environment
- Stripped of trailing slash via `stripTrailingSlash()`
- Returns `null` if not configured (route falls through to 404)

### 3.3 Pass-through/Proxy Behavior

- Read routes: Proxy to Modal with optional auth header forwarding
- Write routes (PUT/POST/DELETE): Always proxied to Modal private endpoints
- Auth headers: Forwarded via `authorization` header from original request
- Responses: Wrapped with `x-lovebud-upstream: modal` header

### 3.4 Degraded/Fallback Behavior

| Condition | Response | Status |
|-----------|----------|--------|
| Modal URL not built (unrecognized route) | `{ error: 'Route not found' }` | 404 |
| Method not allowed on recognized route | `{ error: 'Method not allowed' }` | 405 |
| Modal unavailable (write) | `{ error: 'Modal backend unavailable' }` | 503 |
| Modal unavailable (read, modal-owned route) | `{ error: 'Modal backend unavailable' }` | 503 |

### 3.5 Private Write Route Mapping

PUT/DELETE routes for `/api/trees/:id` and `/api/memories/:id` are intentionally proxied to Modal private endpoints:
- `PUT /api/trees/:id` → `/modal/private/trees/:id`
- `DELETE /api/memories/:id` → `/modal/private/memories/:id`

---

## 4. Contract Questions

### 4.1 Route Ownership

**Which paths are owned by Cloudflare router?**
- Only paths that `buildModalUrl()` can construct a target for are "owned"
- All other paths return 404

**Which paths are proxied to Modal?**
- See mapping table in 3.1
- Community/routes: `/api/community/*` → Modal browse/community paths
- Private routes: `/api/trees`, `/api/memories` → Modal private paths

### 4.2 Private Write Routes

**Are PUT/DELETE private write routes intentionally proxied or excluded?**
- Intentionally proxied to Modal private endpoints
- Auth failure handled by Modal backend

### 4.3 Auth Header Passing

**How are auth headers/cookies passed?**
- `authorization` header extracted and forwarded to Modal
- No cookie handling (Firebase auth uses header-based auth)

### 4.4 Error Response Contract

**What should return 404/405/502/503?**

| Status | Condition |
|--------|-----------|
| 404 | Route not recognized by `buildModalUrl()` |
| 405 | Method not allowed on recognized route |
| 503 | Modal backend unavailable (fetch error) |
| 502 | Not currently implemented (Modal returning non-JSON) |

---

## 5. Guardrails

Before any route helper extraction:

- [ ] No active same-origin `/api/*` behavior change without explicit approval
- [ ] No cache behavior change in same PR
- [ ] No Vercel/Netlify reactivation
- [ ] No Modal route movement
- [ ] No auth policy change
- [ ] Tests before extraction

---

## 6. Recommended Next PR Sequence

1. **Docs-only audit** (this PR)
2. Route mapping contract tests
3. Helper extraction only after tests
4. No runtime behavior change unless separately approved

---

## 7. Related

- `docs/engineering/API_CONTRACT.md` - API response shape contracts
- `functions/api/[[path]].js` - Active route handler implementation
- Issue #223 - Repository structure follow-up tracker