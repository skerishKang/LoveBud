# modal_compute/ — Modal Compute (Retained Runtime Surface)

## Role

`modal_compute/` remains an active runtime component, but it is **not the universal Production backend** for LoveBud.

Modal is retained for explicit residual/default fallback routes and specialized compute. General CRUD/read-model traffic increasingly runs through checked-in Direct-Neon routes selected by Cloudflare Pages Functions.

## Route Targeting

- Cloudflare Pages Functions own the same-origin `/api/*` entry and select the upstream per route.
- A Modal endpoint can remain in source as fallback/rollback compatibility even when the corresponding Production gate selects Direct-Neon.
- Residual general Modal routes and specialized-compute ownership are governed by #4422; do not infer current ownership from endpoint presence alone.
- Route contracts must stay synchronized with the Cloudflare Pages Functions router and route-specific modules.

## Ownership Rules

- **Modal deploy requires separate CTO approval** before any deployment to production.
- **Do not output or commit Modal secrets** anywhere in this folder or the repository.
- **Do not modify route contracts** without updating the corresponding Cloudflare Pages Functions route and running contract tests.
- **Do not add new routes** without CTO approval and contract test coverage.

## Active Production Participation

```text
browser
→ /api/*
→ Cloudflare Pages Functions
   ├─ Direct-Neon for checked-in general CRUD/read-model gates
   └─ Modal compute (this folder) for explicit residual/fallback/specialized paths
```

Netlify Functions are **not** part of the active production compute path. See `netlify/README.md`.
