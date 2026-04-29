# modal_compute/ — Modal Compute (Active Runtime Priority)

## Role

`modal_compute/` is the **active compute and runtime priority** for this project.

All backend execution for production routes runs here via Modal deployment.

## Route Targeting

- **Browse, community, and private read-heavy routes** are routed to Modal by default.
- Route contract must stay in sync with the Cloudflare Pages Functions router (`functions/api/[[path]].js`).

## Ownership Rules

- **Modal deploy requires separate CTO approval** before any deployment to production.
- **Do not output or commit Modal secrets** anywhere in this folder or the repository.
- **Do not modify route contracts** without updating `functions/api/[[path]].js` and running contract tests.
- **Do not add new routes** without CTO approval and contract test coverage.

## Active Production Path

```
browser → /api/* → Cloudflare Pages Functions → Modal compute (this folder)
```

Netlify Functions are **not** part of the active production compute path. See `netlify/README.md`.