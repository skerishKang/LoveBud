# LoveBud MVP — Backend Functions

## Overview
Netlify Functions backend for LoveBud MVP. Data stored in Neon PostgreSQL.

## Architecture
```
Browser → Firebase Auth (login)
        → Netlify Functions (this folder)
        → Neon PostgreSQL (actual data)
```

Auth: Firebase ID Token verified in each protected function via `requireUser(event)`.

## File Structure
```
netlify/
├── functions/
│   ├── _lib/
│   │   ├── auth.js       ← Firebase token verification (from 133)
│   │   ├── db.js         ← Neon PostgreSQL Pool (from 133)
│   │   ├── http.js       ← CORS / response helpers (from 133)
│   │   └── doc-store.js  ← LoveBud data access layer (NEW)
│   ├── trees.js          ← GET/POST  /api/trees
│   ├── tree-detail.js    ← GET       /api/trees/:treeId
│   ├── memories.js       ← GET/POST  /api/memories
│   ├── memory-detail.js  ← GET/PATCH/DELETE /api/memories/:memoryId
│   └── community-memories.js ← GET   /api/community/memories
├── sql/
│   └── 001_initial_schema.sql
└── toml (netlify.toml routes /api/* → function files)
```

## API Endpoints

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | /api/trees | optional | List user's trees (auth) or public trees (anon) |
| POST | /api/trees | required | Create a new tree |
| GET | /api/trees/:treeId | required* | Get tree + memories (*private requires owner) |
| GET | /api/memories | required | List memories (filter by treeId, parentId) |
| POST | /api/memories | required | Create a new memory |
| GET | /api/memories/:memoryId | required | Get single memory |
| PATCH | /api/memories/:memoryId | required | Update memory fields |
| DELETE | /api/memories/:memoryId | required | Delete memory |
| GET | /api/community/memories | none | Public root-level memories from all trees |

## Auth Pattern (per-function)
```javascript
const { requireUser } = require('./_lib/auth');
// In handler:
const user = await requireUser(event); // throws 401 if not authenticated
```

## Environment Variables (Netlify)

| Variable | Required | Description |
|----------|----------|-------------|
| `FIREBASE_SERVICE_ACCOUNT_JSON` | Yes | Firebase Admin service account |
| `NETLIFY_DATABASE_URL` | Yes | Neon PostgreSQL connection string |
| `CORS_ALLOWED_ORIGINS` | No | Comma-separated allowed origins |

## Current Status

**Implemented:**
- `_lib/` (auth, db, http, doc-store) — full CRUD scaffold
- `trees.js` — GET/POST with auth
- `tree-detail.js` — GET with access control
- `memories.js` — GET/POST with auth
- `memory-detail.js` — GET/PATCH/DELETE scaffold
- `community-memories.js` — public read (no auth)
- SQL schema (netlify/sql/001_initial_schema.sql)

**Not yet implemented:**
- Tree ownership enforcement in memories.js (GET list)
- Memory ownership enforcement in memory-detail.js (PATCH/DELETE)
- Browser-side fetch client (js/postgres-client.js) — not built yet
- Integration with mock-data.js fallback (not done yet)
- Neon PostgreSQL actual database + schema run

**Next step for frontend integration:**
1. Run `001_initial_schema.sql` against Neon PostgreSQL
2. Create `js/postgres-client.js` — window.db wrapper with fetch() calls
3. In each HTML page, load postgres-client.js and use window.db.trees/memories instead of mock-data.js
4. Update netlify.toml auth env vars in Netlify dashboard