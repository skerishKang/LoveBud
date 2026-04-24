# Runtime Routing Truth Draft 2026-04-25

> Status: Draft
>
> Scope: production API routing investigation note
>
> Verification state: Pending Cloudflare verification
>
> Do not treat this document as final production truth.

This document records an interim investigation result for LoveBud production API routing.

It is intentionally written as a draft because Cloudflare Pages route precedence, production deploy commit, and environment variables still need direct verification.

---

## 1. Observed production behavior

The following behavior was observed during QA with a logged-in session:

- `POST /api/trees` returned `200`.
- The response included `x-lovebud-upstream: modal`.
- The response included a `modal-function-call-id` header.
- A private tree was created successfully for the QA account.
- The frontend navigated to `editor?treeId=...` after creation.

Interpretation:

- The successful QA request appears to have been handled by Modal.
- The request was not a publication guard failure.
- The observed request used private tree creation semantics.

Non-final note:

- This observation does not by itself prove that every production `POST /api/trees` request always uses Modal.
- Cloudflare route precedence and deployed function code still need confirmation.

---

## 2. Current main-code routing candidates

The current repository contains multiple possible API routing layers or legacy paths.

### 2.1. Cloudflare route-specific function candidate

Potential path:

```text
functions/api/trees.js
```

Reason to verify:

- If this file exists in the deployed Cloudflare artifact, it may win over the catch-all route for `/api/trees`.
- This could explain why production `POST /api/trees` reaches Modal even if the catch-all function in current main only performs Modal reads.

Verification needed:

- Confirm whether `functions/api/trees.js` exists in current main and/or in the deployed Cloudflare artifact.
- Confirm Cloudflare Pages Functions route precedence for route-specific files versus `functions/api/[[path]].js`.

### 2.2. Cloudflare catch-all fallback

Potential path:

```text
functions/api/[[path]].js
```

Current understanding:

- This catch-all is the general same-origin `/api/*` entrypoint for Cloudflare Pages.
- In the currently reviewed main-code shape, Modal routing in this file is read-oriented.
- If `tryModalRead()` only accepts `GET`, then a `POST /api/trees` request would not be expected to use the Modal read branch.
- The request would likely fall through to its fallback upstream path unless another route-specific function wins first.

Verification needed:

- Confirm the exact deployed `functions/api/[[path]].js` content in Cloudflare production.
- Confirm whether production is deploying the same commit and file content as GitHub main.

### 2.3. Vercel transitional adapter

Potential path:

```text
api/[...path].js
```

Current understanding:

- Vercel remains in the repository as a transitional catch-all API adapter.
- It can forward API requests to another upstream when configured.
- It should not be assumed to be in the successful QA write path because the observed response included `x-lovebud-upstream: modal` and `modal-function-call-id`.

Verification needed:

- Confirm whether Cloudflare fallback still points to Vercel in production.
- Confirm whether Vercel receives any traffic for `POST /api/trees` during successful QA creation.
- Confirm whether `LOVEBUD_UPSTREAM_API_BASE` exists in Vercel and what it points to.

### 2.4. Netlify legacy write

Potential path:

```text
netlify/functions/trees.js
```

Current understanding:

- Netlify legacy write logic still exists.
- Netlify can handle `/api/trees` through its redirects and function mapping.
- Its existence does not prove it is used by the current production Cloudflare path.

Verification needed:

- Confirm whether any successful QA `POST /api/trees` request reaches Netlify logs.
- Confirm whether Netlify remains a fallback-only path or still receives write traffic in some conditions.

### 2.5. Modal write endpoint

Potential path:

```text
modal_compute/app.py
POST /modal/private/trees
```

Current understanding:

- Modal contains a private tree creation endpoint.
- The QA response headers strongly suggest this endpoint, or a Modal-adjacent route, handled the successful write.

Verification needed:

- Confirm Modal logs for the QA request.
- Confirm the request path and handler name in Modal logs.
- Confirm the Cloudflare route that forwarded to Modal.

---

## 3. Statements that must not be finalized yet

Until Cloudflare deploy metadata, route precedence, and environment variables are verified, do not write the following as final production truth:

1. `Cloudflare production is inconsistent with main.`
2. `The Vercel proxy loop is the current cause.`
3. `The Netlify write path is no longer used.`
4. `POST /api/trees always uses the catch-all route.`

Allowed draft wording:

- `Observed QA behavior suggests Modal handled a successful POST /api/trees request.`
- `Current main-code reading does not fully explain the observed Modal write response unless another route or deployed artifact differs.`
- `Cloudflare route precedence and production deploy commit remain open verification items.`

---

## 4. Items that require verification

### 4.1. Cloudflare route precedence

Confirm how Cloudflare Pages Functions resolves these candidates:

```text
functions/api/trees.js
functions/api/[[path]].js
```

Questions:

- Does a route-specific `functions/api/trees.js` win over the catch-all route?
- Does method-specific behavior exist in the deployed route file?
- Which function actually handles production `POST /api/trees`?

### 4.2. Route winner for `/api/trees`

Confirm whether `functions/api/trees.js` is the route winner for:

```text
POST https://lovebud.pages.dev/api/trees
GET  https://lovebud.pages.dev/api/trees
```

Evidence to collect:

- Cloudflare Pages function logs
- deployment artifact file list
- route matching output if available
- response headers from logged-in and logged-out requests

### 4.3. Cloudflare production deploy commit

Confirm:

- latest Cloudflare Pages production deployment commit SHA
- whether it equals GitHub `main`
- whether the deployed artifact includes any function not present or not current in GitHub `main`

### 4.4. Cloudflare environment variables

Confirm production values or presence for:

```text
MODAL_BASE_URL
LOVEBUD_UPSTREAM_ORIGIN
```

Do not expose secret values in public reports.

For reporting, record only:

- present / missing
- target service class if safe to disclose, for example `Modal`, `Vercel`, `Netlify`
- whether value matches the intended routing policy

### 4.5. Vercel adapter residual impact

Confirm:

- whether Cloudflare fallback can still reach Vercel
- whether Vercel receives production API traffic
- whether `api/[...path].js` remains necessary for any user-facing path
- whether Vercel can be marked deprecated after Modal write routing is confirmed

---

## 5. Follow-up decision candidates

These are not decisions yet. They are candidate outcomes after verification.

### 5.1. Document Cloudflare to Modal write path as official truth

If Cloudflare production is intentionally routing writes to Modal, then update confirmed operations docs to say:

```text
Cloudflare Pages same-origin /api write requests route to Modal for private tree/memory writes.
```

Required before finalizing:

- Confirm route winner.
- Confirm production deploy commit.
- Confirm Modal logs.
- Confirm failure/fallback behavior.

### 5.2. Deprecate Vercel transitional adapter

If Vercel is not part of the active production write path and no longer needed for read fallback, consider marking it deprecated.

Required before finalizing:

- Confirm no active production dependency.
- Confirm fallback replacement path.
- Confirm docs and deploy checklist updates.

### 5.3. Preserve or retire Netlify legacy write

If Netlify no longer receives active write traffic, decide whether to preserve it as emergency fallback or retire it.

Required before finalizing:

- Confirm current traffic.
- Confirm env health.
- Confirm whether any branch preview or legacy domain still uses Netlify writes.

---

## 6. Current draft conclusion

Current observed production behavior suggests:

```text
POST /api/trees can succeed through a Modal-backed path in production.
```

Current repository reading still leaves open questions:

```text
Which Cloudflare Pages function wins for /api/trees?
Is the deployed Cloudflare artifact identical to GitHub main?
Are MODAL_BASE_URL and LOVEBUD_UPSTREAM_ORIGIN configured in a way that explains the observed behavior?
Does Vercel receive any traffic for the successful write path?
```

Therefore, this draft should remain pending until Cloudflare verification is complete.
