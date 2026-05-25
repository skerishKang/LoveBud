# Legacy Runtime Guardrails

Issue: #1078

This document prevents future backend, API, and security policy work from being implemented in legacy runtime artifacts by mistake.

## Current active runtime

The active runtime path is:

```text
browser
→ same-origin /api/*
→ Cloudflare Pages Functions under functions/api/*
→ Modal under modal_compute/*
```

New backend/API/security policy work should target the active Cloudflare Pages Functions + Modal runtime unless the CTO explicitly reactivates another runtime.

## Legacy and transitional artifacts

| Path | Current treatment | Guardrail |
| --- | --- | --- |
| `netlify/functions/**` | legacy artifact / removal-audit candidate | Do not implement new active backend policy here unless Netlify runtime is explicitly reactivated. |
| `netlify.toml` | legacy artifact / removal-audit candidate | Do not delete or repurpose without a separate removal/audit issue. |
| `vercel.json` | transitional / secondary-entry artifact | Do not classify as automatically removable from filename alone. |
| `_redirects` | shared static-host routing artifact candidate | Do not classify as Netlify-only without checking Cloudflare Pages behavior. |

## Required PR posture

A PR that changes legacy runtime paths should state:

```text
Legacy runtime path changed: YES
Reason: audit/docs/explicit reactivation/removal-approved
Active runtime behavior changed: YES/NO
Cloudflare/Modal behavior changed: YES/NO
Owning issue: <issue or PR reference>
```

If a PR introduces new auth, visibility, owner guard, entitlement, private storage, public read, write route, API response shape, or security policy, the default target is:

```text
functions/api/*
modal_compute/*
docs/engineering/API_CONTRACT.md
```

Do not add that policy only under `netlify/functions/*` or a Vercel-only path.

## Allowed changes without runtime reactivation

Allowed examples:

- documentation that marks a path as legacy;
- audit inventory;
- tests or guardrails that prevent wrong-target implementation;
- removal planning documents;
- explicit compatibility comments that do not change active behavior.

## Forbidden without explicit approval

Forbidden examples:

- implementing a new active API route only in `netlify/functions/*`;
- changing owner/private/public visibility policy only in legacy runtime files;
- deleting `netlify.toml`, `vercel.json`, `_redirects`, or `netlify/functions/**` as incidental cleanup;
- treating `_redirects` as Netlify-only without Cloudflare Pages verification;
- using legacy runtime files as evidence that production behavior has changed.

## Verification

Docs/check-only PRs:

- docs review;
- static guardrail check if a script/check changes;
- no runtime verification required.

Runtime PRs that touch active files:

- relevant contract tests;
- Cloudflare Preview or fixed-slot smoke where API/Auth/data-loaded behavior is affected;
- report verified and unverified items separately.

## Related documentation

- `docs/ops/LEGACY_DEPLOYMENT_ARTIFACT_AUDIT.md` — legacy deployment artifact classification, ownership, and artifact-specific rules
- `docs/ops/RUNTIME_ROUTING_TRANSITIONAL_AUDIT.md` — runtime routing transitional layer audit (prerequisite for routing changes)
- `docs/engineering/CLOUDFLARE_API_ROUTE_MAPPING_AUDIT.md` — Cloudflare Pages same-origin `/api/*` route mapping audit
- `netlify/README.md` — legacy Netlify path ownership and prohibition rules
- `README.md` — project-level service description, naming conventions, and full doc index
