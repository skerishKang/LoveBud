# netlify/functions/ — Legacy Functions (NOT Active Production Backend)

## Role

Netlify Functions in this folder are **legacy / fallback / artifact only**.

They are **not** the current official production backend for `lovebud.pages.dev`.

## Ownership Rules

- **Do not implement new production auth or API policy here.**
- All active route work belongs in:
  - `functions/api/[[path]].js` (Cloudflare Pages Functions entry)
  - `modal_compute/` (Modal compute backend)
- **Do not reactivate** these functions for production traffic without CTO approval.
- **Do not delete or move** files without CTO approval.

## Active Production Path

```
browser → /api/* → Cloudflare Pages Functions (functions/) → Modal compute (modal_compute/)
```

Netlify is not in the active production path.
