# functions/ — Cloudflare Pages Functions (Active Runtime Entry)

## Role

`functions/api/` is the **active same-origin `/api/*` runtime surface** for this project, served via Cloudflare Pages Functions.

Route-specific modules and the catch-all `functions/api/[[path]].js` cooperate to select the runtime for each API path.

## Request Flow

```text
browser
→ same-origin /api/*
→ Cloudflare Pages Functions
   ├─ Direct-Neon for checked-in general CRUD/read-model route gates
   └─ Modal for explicit residual/default fallback and specialized compute
→ Neon PostgreSQL where persistence applies
```

The upstream is route-specific. Do not infer that every request passes through Modal merely because a Modal endpoint or fallback implementation exists.

## Runtime selection rules

- Current Production configuration checks in many `LB_*_RUNTIME = "direct_neon"` gates for general Tree/Memory/social reads and writes.
- Unset/modal/unknown gates preserve the reviewed fallback/default behavior for that route.
- Once a Direct-Neon write execution begins, its helper must fail closed according to its contract rather than silently replaying the same request through Modal.
- Residual Modal contraction and retained specialized-compute ownership are tracked under #4422.

## Ownership Rules

- **Do not modify `functions/api/[[path]].js`** without CTO approval and accompanying contract tests.
- **Route additions** require CTO approval and contract tests before merge.
- **Do not output or commit secrets/env values** anywhere in this folder.
- **Do not change direct runtime behavior** (routing logic, auth, response shape) without explicit approval.

## Active Production Path

`lovebud.pages.dev` enters the API through Cloudflare Pages Functions. The next hop is selected by the concrete route and checked-in runtime gate: Direct-Neon is the primary general CRUD/read-model path, while Modal remains for explicit residual/fallback and specialized-compute responsibilities.

Netlify Functions are **not** the active production backend. See `netlify/README.md`.
