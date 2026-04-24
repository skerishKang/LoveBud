# LoveBud Runtime Routing Truth Draft - 2026-04-25

This draft records the confirmed route precedence for the production `/api/trees`
path before updating the canonical deployed-entry documentation.

## Confirmed route truth

### `/api/trees`

- Route winner: `functions/api/trees.js`
- `GET /api/trees`: forwards to Modal `/modal/private/trees`
- `POST /api/trees`: forwards to Modal `/modal/private/trees`
- Response marker: `x-lovebud-upstream: modal`
- Production observation: QA tree creation returned `x-lovebud-upstream: modal`
- Interpretation: the production observation is consistent with the current main
  code path.

`functions/api/trees.js` is more specific than `functions/api/[[path]].js`, so
the catch-all function is not the direct handler for `/api/trees`.

### `/api/memories`

- Route winner: `functions/api/memories.js`
- `GET /api/memories`: forwards to Modal `/modal/private/memories`
- `POST /api/memories`: forwards to Modal `/modal/private/memories`
- Response marker: `x-lovebud-upstream: modal`

### `/api/trees/:id`

- Route-specific file exists: `functions/api/trees/[id].js`
- Confirmed handler: `GET`
- Modal target:
  - authenticated request: `/modal/private/trees/:id`
  - unauthenticated/public fallback: `/modal/trees/:id`
- Non-GET methods are not confirmed by this draft.

## Catch-all behavior

`functions/api/[[path]].js` remains the fallback/catch-all handler for `/api/*`
routes that do not have a more specific Cloudflare Pages Function route.

Current catch-all behavior:

- GET requests: try Modal read routing when the path is recognized.
- Browse summary requests: may use the Cloudflare cache before Modal.
- Modal read failure before response: falls back to Vercel.
- Non-GET requests handled by the catch-all: fall through to the configured
  upstream origin.
- Default upstream origin in code: `https://lovebud.vercel.app`
- Env override: `LOVEBUD_UPSTREAM_ORIGIN`
- Fallback response marker: `x-lovebud-upstream: vercel`

The Vercel fallback risk is therefore separated from `/api/trees` creation. It
still exists for catch-all routes and should be handled by the Vercel
deprecation audit.

## Vercel fallback risk

Vercel is not the direct production path for `POST /api/trees`.

Vercel is not the primary production runtime. It remains a transitional
fallback/secondary adapter pending production route matrix verification. Do not
remove Vercel files until the route matrix confirms there is no dependency, or
until every observed dependency has an approved Cloudflare-to-Modal or
Cloudflare-to-Netlify replacement.

Remaining risk areas:

- `/api/*` routes without route-specific Cloudflare handlers
- catch-all non-GET requests
- Modal read failures that fall back to Vercel
- `api/[...path].js` transitional adapter, which can self-proxy if deployed on
  Vercel without `LOVEBUD_UPSTREAM_API_BASE`

Known Vercel references to audit before removal:

- `functions/api/[[path]].js`: catch-all fallback via
  `LOVEBUD_UPSTREAM_ORIGIN`, defaulting to `https://lovebud.vercel.app`
- `api/[...path].js`: transitional Vercel catch-all adapter via
  `LOVEBUD_UPSTREAM_API_BASE`, defaulting to `https://lovebud.vercel.app/api`
- `vercel.json`: deployment configuration for the transitional adapter
- `README.md`, `docs/ops/*`, and `docs/migration/*`: Vercel described as
  upstream, secondary entry, or fallback
- CORS allow-origin entries that still include `https://lovebud.vercel.app`

This draft does not approve deleting Vercel paths. It only separates the
`/api/trees` route truth from the remaining catch-all fallback risk.

## Vercel deprecation guardrails

Do not make absolute removal or full-coverage claims until the production route
matrix and external link audit are complete. In particular, do not claim that
Vercel has no dependency, that Vercel can be removed immediately, that Netlify
has no remaining role, or that every write path is Modal-backed.

Allowed deprecation language:

- "Vercel is not the primary production runtime."
- "Vercel remains a transitional fallback/secondary adapter pending route
  matrix verification."
- "Vercel files must not be removed until production route matrix confirms no
  dependency or approved replacement routes are in place."

Removal preconditions:

- Production route matrix is complete.
- `x-lovebud-upstream: vercel` is not observed, or each observed route has an
  approved replacement path.
- Cloudflare catch-all fallback no longer relies on Vercel as its default
  upstream.
- Documentation, tests, and external links no longer treat `lovebud.vercel.app`
  as an active runtime dependency.
- Netlify legacy write paths have a documented preserve-or-retire decision.

## Intermittent `/api/trees` 500 follow-up

Because `POST /api/trees` is handled by `functions/api/trees.js` and forwarded
to Modal, any future intermittent 500 on new tree creation should be traced
through the Modal write path first.

Required evidence on recurrence:

- `POST /api/trees` status
- request payload, especially `visibility`
- Authorization header presence only, not the token value
- `x-lovebud-upstream`
- `modal-function-call-id`
- response body
- console error

If `modal-function-call-id` is present, use it to locate the corresponding
Modal invocation and inspect Modal/DB/Auth behavior.

## Do not finalize yet

Do not state these items as confirmed until separately verified:

- Cloudflare Pages production deploy commit SHA
- Cloudflare Pages production branch
- Cloudflare Pages production deploy time
- Cloudflare production values for `MODAL_BASE_URL` and
  `LOVEBUD_UPSTREAM_ORIGIN`
- Whether all non-GET detail routes are covered by Cloudflare/Modal
- Whether any external clients still call `lovebud.vercel.app`
- Whether Netlify legacy write paths should be preserved or retired

## Proposed canonical doc update

After CTO approval, update `docs/ops/DEPLOYED_ENTRY_MAP.md`:

- Add `/api/trees` as `functions/api/trees.js -> Modal /modal/private/trees`.
- Add `/api/memories` as `functions/api/memories.js -> Modal /modal/private/memories`.
- Keep `/api/community/*`, `/api/memories/:id`, and other unmatched routes under
  `functions/api/[[path]].js`.
- Change Vercel language from "secondary/upstream" to "deprecated fallback under
  audit" once the deprecation audit is approved.
