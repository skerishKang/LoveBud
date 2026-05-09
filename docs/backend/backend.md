# LoveBud Backend Runtime Notes

## Current production/test slot runtime truth

Current `lovebud.pages.dev` production/test slot API runtime is not Netlify Functions.

Observed production / test1 / test2 / test3 route matrix:

- `/api/trees`: `x-lovebud-upstream: modal`
- `/api/memories`: `x-lovebud-upstream: modal`
- `modal-function-call-id` exists
- `server: cloudflare`
- `cf-cache-status: DYNAMIC`
- No Netlify Functions invocation evidence was observed

Current active runtime path:

```text
Browser
→ Cloudflare Pages same-origin /api/*
→ Cloudflare Pages Functions under functions/api/*
→ Modal
→ Neon PostgreSQL
```

`netlify/functions/*` is a legacy artifact only. It is not the current production backend for `lovebud.pages.dev`. Do not implement new backend policy in `netlify/functions/*` unless CTO explicitly reactivates Netlify runtime.

PR #38 was closed because it targeted legacy `netlify/functions/*` rather than the active Cloudflare/Modal runtime.

---

## Legacy Netlify Functions artifact

The following section documents the legacy Netlify Functions implementation that remains in the repository for reference and pending archive decision.

It must not be read as the active production backend.

## Legacy Architecture

```text
Browser → Firebase Auth (login)
        → Netlify Functions (legacy artifact only)
        → Neon PostgreSQL
```

Auth: Firebase ID Token verified in each protected function via `requireUser(event)`.

## Legacy File Structure

```text
netlify/
├── functions/
│   ├── _lib/
│   │   ├── auth.js       ← Firebase token verification
│   │   ├── db.js         ← Neon PostgreSQL Pool
│   │   ├── http.js       ← CORS / response helpers
│   │   └── doc-store.js  ← LoveBud data access layer
│   ├── trees.js          ← legacy GET/POST  /api/trees
│   ├── tree-detail.js    ← legacy GET/PUT/DELETE /api/trees/:treeId
│   ├── memories.js       ← legacy GET/POST  /api/memories
│   ├── memory-detail.js  ← legacy GET/PATCH/DELETE /api/memories/:memoryId
│   ├── community-trees.js ← legacy GET /api/community/trees
│   └── community-memories.js ← legacy GET /api/community/memories
├── sql/
│   └── 001_initial_schema.sql
└── toml (netlify.toml legacy routes /api/* → function files)
```

## Legacy API Endpoints

These endpoint mappings describe the legacy Netlify implementation. The current `lovebud.pages.dev` runtime uses Cloudflare Pages Functions and Modal instead.

| Method | Path | Auth | Legacy description |
|--------|------|------|--------------------|
| GET | /api/trees | required | List user's trees |
| POST | /api/trees | required | Create a new tree |
| GET | /api/trees/:treeId | required* | Get tree + memories (*private requires owner) |
| PUT | /api/trees/:treeId | required | Update tree metadata / visibility |
| DELETE | /api/trees/:treeId | required | Delete tree |
| GET | /api/community/trees | none | Browse public tree summaries |
| GET | /api/community/memories | none | Public memories by treeId or community scope |
| GET | /api/memories | required | List memories (filter by treeId, parentId) |
| POST | /api/memories | required | Create a new memory |
| GET | /api/memories/:memoryId | required* | Get single memory (*public anyone / private owner) |
| PATCH | /api/memories/:memoryId | required | Update memory fields |
| DELETE | /api/memories/:memoryId | required | Delete memory |

## Legacy Auth Pattern

```javascript
const { requireUser } = require('./_lib/auth');
const user = await requireUser(event);
```

## Legacy Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `FIREBASE_SERVICE_ACCOUNT_JSON` | Yes | Firebase Admin service account for legacy Netlify runtime |
| `NETLIFY_DATABASE_URL` | Yes | Neon PostgreSQL connection string for legacy Netlify runtime |
| `CORS_ALLOWED_ORIGINS` | No | Comma-separated allowed origins |

## Legacy Top-level Dependencies

| Package | Version | Why |
|---------|---------|-----|
| `firebase-admin` | ^12.0.0 | Firebase ID token verification |
| `pg` | ^8.12.0 | Neon PostgreSQL connection pool |

Both are server-side only.

---

## Visibility / private storage policy note

The public-first + Plus private policy must be implemented against the active runtime, not this legacy artifact.

Active implementation targets:

- `functions/api/*` Cloudflare Pages Functions
- Modal private/public/community endpoints
- Modal/Neon data flow

Do not implement new visibility/private-storage behavior in `netlify/functions/*` unless Netlify runtime is explicitly reactivated.

### Current active behavior status

Current production behavior must be verified against Cloudflare/Modal runtime.

The legacy Netlify code may still describe older private-first behavior, but it is not authoritative for `lovebud.pages.dev` production/test slots.

### Target policy

CTO-approved direction is public-first + Plus private.

- New trees should transition to public-first in the active runtime.
- Existing private trees must not be automatically made public.
- Existing private trees are grandfathered private.
- Private creation and public → private transition require Plus entitlement after the entitlement source is defined.
- Public visibility and browse display eligibility are separate concepts.
- Cloudflare/Modal policy must be changed together.

---

## Current Status

**Active production/test slot backend:**

- Cloudflare Pages `functions/api/trees.js`
- Cloudflare Pages `functions/api/memories.js`
- Cloudflare Pages `functions/api/trees/[id].js` where applicable
- Cloudflare Pages `functions/api/[[path]].js`
- Modal `/modal/*` endpoints

**Legacy artifact still present:**

- `netlify/functions/*`
- `netlify.toml`
- Netlify route contract tests and docs references pending transition

---

## Public-first transition TODO

Before code changes:

1. Update active Cloudflare/Modal API contract and tests.
2. Define Plus entitlement source.
3. Define grandfathered private behavior.
4. Update Cloudflare and Modal policy together.
5. Separate visibility change from browse display eligibility.
6. Prepare frontend UX copy and error handling.

Implementation split:

### Active backend workstream

- Change active tree create behavior in Cloudflare/Modal path.
- Add entitlement guard for private creation in the active runtime.
- Add entitlement guard for public → private toggle in the active runtime.
- Preserve grandfathered private owner access.
- Keep browse summary filter separate.

### Modal workstream

- Mirror create tree policy.
- Mirror private endpoint entitlement policy.
- Keep browse latest/growing filters public-only.

### Frontend workstream

- Do not change createTree payload until backend/Modal are ready.
- Update My Trees create modal after API policy is ready.
- Update Editor visibility badge and toggle copy.
- Add Plus-required UX only after error contract is fixed.

---

## Archive note

Immediate archive is not performed in the Netlify legacy deprecation documentation PR.

Archive requires tests/docs reference transition first. In particular, `netlify.toml` and Netlify route contract tests still reference this legacy tree.
