# LoveBud Backend Runtime Notes

## Current production/test slot runtime truth

Current `lovebud.pages.dev` API entry is Cloudflare Pages same-origin `/api/*`, implemented by Pages Functions under `functions/api/*`.

Runtime ownership after the Pages Function boundary is route-specific:

```text
Browser
→ Cloudflare Pages same-origin /api/*
→ Cloudflare Pages Functions
   ├─ Direct-Neon for checked-in general CRUD/read-model route gates
   └─ Modal for explicit residual/default fallback and specialized compute
→ Neon PostgreSQL where persistence applies
```

Firebase Auth remains the current Product authentication authority during the shared-platform migration.

Earlier Production/test-slot observations that showed `x-lovebud-upstream: modal` for broad routes are **historical evidence**, not a current universal routing rule. Current ownership must be read from the concrete Pages Function route plus the checked-in `LB_*_RUNTIME` gate. #4422 is the current residual-Modal contraction authority.

`netlify/functions/*` is a legacy artifact only. It is not the current production backend for `lovebud.pages.dev`. Do not implement new backend policy in `netlify/functions/*` unless CTO explicitly reactivates Netlify runtime.

PR #38 remains historical evidence for the Netlify deprecation decision; it must not be used to infer that every current route is Modal-owned.

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

The public-first + Plus-private policy belongs to the active Cloudflare runtime, not the legacy Netlify artifact.

Current active implementation surfaces include:

- route-specific Cloudflare Pages Functions under `functions/api/*`;
- Direct-Neon helpers under `functions/_shared/*-direct-neon.js` where the checked-in route gate selects `direct_neon`;
- retained Modal fallback/residual/specialized endpoints under `modal_compute/`;
- Firebase verified identity projected into the current compatibility owner boundary;
- Neon PostgreSQL as the canonical writable Tree/Memory/social data authority.

For Direct-Neon private writes, the canonical private-storage entitlement source is Neon `public.users.private_storage_enabled` with strict-true semantics. Retained Modal compatibility code still has legacy entitlement behavior; #4531 owns the source-level rollback-parity reconciliation. Do not assume a runtime-gate rollback is business-semantics-equivalent until that contract is satisfied.

### Current active behavior status

Current Production behavior must be verified against the route-specific Cloudflare dispatch and checked-in gate, not against a generic "Cloudflare → Modal" topology.

- General CRUD/read-model migration is late-stage and predominantly Direct-Neon.
- Modal still participates in explicit residual/default fallback routes and specialized compute.
- Residual Modal removal, `MODAL_BASE_URL` removal, and `min_containers` changes are not implied by this document; #4422 governs those decisions.
- Public visibility remains separate from Browse/Search eligibility.
- Existing private content is not automatically made public.

---

## Current Status

**Active production/test slot entry and runtime layers:**

- Cloudflare Pages and Pages Functions under `functions/api/*`;
- checked-in Direct-Neon route gates for general CRUD/read-model work;
- retained Modal endpoints for explicit residual/fallback/specialized responsibilities;
- Neon PostgreSQL for canonical persisted Tree/Memory/social data;
- Firebase Auth as the current Product authentication authority.

**Legacy artifact still present:**

- `netlify/functions/*`
- `netlify.toml`
- Netlify route contract tests and docs references pending transition

## Runtime-truth maintenance

When documenting a route:

1. name the same-origin Pages Function entry;
2. identify the concrete route module/helper;
3. state the checked-in runtime gate when one exists;
4. distinguish an active Direct-Neon selection from a retained Modal fallback implementation;
5. use #4422 for residual Modal contraction state;
6. never promote historical route observations into a new current universal topology.

## Archive note

Immediate Netlify archive is not performed here.

Archive requires tests/docs reference transition first. In particular, `netlify.toml` and Netlify route contract tests still reference the legacy tree.
