# functions/ — Cloudflare Pages Functions (Active Runtime Entry)

## Role

`functions/api/[[path]].js` is the **active same-origin `/api/*` entry point** for this project, served via Cloudflare Pages Functions.

## Request Flow

```
browser → same-origin /api/* → Cloudflare Pages Functions → Modal compute
```

All browser API requests route through this entry. Modal compute handles the backend execution.

## Ownership Rules

- **Do not modify `functions/api/[[path]].js`** without CTO approval and accompanying contract tests.
- **Route additions** require CTO approval and contract tests before merge.
- **Do not output or commit secrets/env values** anywhere in this folder.
- **Do not change direct runtime behavior** (routing logic, auth, response shape) without explicit approval.

## Active Production Path

`lovebud.pages.dev` production path:

```
Cloudflare Pages (this folder) → Modal compute (modal_compute/)
```

Netlify Functions are **not** the active production backend. See `netlify/README.md`.
