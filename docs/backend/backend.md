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
│   │   ├── auth.js       ← Firebase token verification
│   │   ├── db.js         ← Neon PostgreSQL Pool
│   │   ├── http.js       ← CORS / response helpers
│   │   └── doc-store.js  ← LoveBud data access layer
│   ├── trees.js          ← GET/POST  /api/trees
│   ├── tree-detail.js    ← GET/PUT/DELETE /api/trees/:treeId
│   ├── memories.js       ← GET/POST  /api/memories
│   ├── memory-detail.js  ← GET/PATCH/DELETE /api/memories/:memoryId
│   ├── community-trees.js ← GET /api/community/trees
│   └── community-memories.js ← GET /api/community/memories
├── sql/
│   └── 001_initial_schema.sql
└── toml (netlify.toml routes /api/* → function files)
```

## API Endpoints

| Method | Path | Auth | Description |
|--------|------|------|-------------|
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

## Auth Pattern
```javascript
const { requireUser } = require('./_lib/auth');
const user = await requireUser(event);
```

## Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `FIREBASE_SERVICE_ACCOUNT_JSON` | Yes | Firebase Admin service account |
| `NETLIFY_DATABASE_URL` | Yes | Neon PostgreSQL connection string |
| `CORS_ALLOWED_ORIGINS` | No | Comma-separated allowed origins |

## Top-level Dependencies

| Package | Version | Why |
|---------|---------|-----|
| `firebase-admin` | ^12.0.0 | Firebase ID token verification |
| `pg` | ^8.12.0 | Neon PostgreSQL connection pool |

Both are server-side only.

---

## Visibility / private storage policy

### Current implementation

Current main implementation remains private-first.

- `POST /api/trees` defaults new tree visibility to `private`.
- `POST /api/trees` rejects `visibility: 'public'` with 409.
- `PUT /api/trees/:treeId` allows owner visibility update.
- private → public currently requires at least 3 public memories.
- public → private currently has no Plus entitlement guard.
- Existing private trees are stored as ordinary `visibility: 'private'` rows.

### Target policy

CTO-approved direction is public-first + Plus private.

- New trees should transition to public-first.
- Existing private trees must not be automatically made public.
- Existing private trees are grandfathered private.
- Private creation and public → private transition require Plus entitlement after the entitlement source is defined.
- Public visibility and browse display eligibility are separate concepts.
- Netlify and Modal policy must be changed together.

### Create tree policy

Current:

- Backend accepts `title` and optional `visibility`.
- Default visibility is `private`.
- `visibility: 'public'` is rejected.

Target:

- Default visibility becomes `public`.
- `visibility: 'private'` requires Plus entitlement.
- Entitlement source is not yet defined, so this is not implementable yet.
- Frontend create payload must not be changed alone.

Decision-needed:

- User plan source of truth
- DB schema or provider for entitlement
- Error status and response body for Plus-required private creation
- Grandfathered private marking strategy, if needed beyond existing visibility value

### Toggle visibility policy

Current:

- Owner can request visibility update through `/api/trees/:treeId`.
- private → public has a 3-public-memory publication guard.
- public → private is allowed for owner without plan check.

Target:

- public → private requires Plus entitlement unless the tree is grandfathered private or another CTO-approved exception applies.
- private → public should be treated as publishing or grandfathered-private release.
- Browse display eligibility remains separate from visibility.

Recommended target behavior:

| Transition | Target backend behavior |
|------------|--------------------------|
| public → private | require Plus entitlement |
| private → public | allow owner, then evaluate browse eligibility separately |
| grandfathered private → private | keep allowed for owner |
| grandfathered private → public | allow owner, no automatic re-private without entitlement unless approved |

### Browse display filter

Browse summary should not become a raw list of all public trees.

Recommended browse summary conditions:

- tree visibility is `public`
- public memory count meets display threshold, currently 3+
- browse quality filter passes

Public visibility means accessible public state. Browse display means curated/eligible for browse surfaces.

---

## Current Status

**Implemented:**
- Browser-side fetch client (`js/postgres-client.js`) — API-first with fallback
- `_lib/` auth, db, http, doc-store
- `trees.js` — GET/POST with auth
- `tree-detail.js` — GET/PUT/DELETE with access control and visibility update
- `memories.js` — GET/POST with auth + ownership enforcement
- `memory-detail.js` — GET/PATCH/DELETE with ownership check
- `community-trees.js` — browse public summaries
- `community-memories.js` — public read path
- SQL schema scaffold

**GET 정책:**
- `/api/memories` GET: authenticated user's own tree memories only
- `/api/memories/:memoryId` GET: public memory can be viewed publicly; private memory requires owner
- `/api/trees/:treeId` GET: public tree can be viewed; private tree requires owner

**Ownership 검증:**
- memories.js GET: returns memories for user's own trees
- memories.js POST: verifies body.treeId ownership before creation
- memory-detail.js GET: public anyone / private owner only
- memory-detail.js PATCH/DELETE: owner only
- tree-detail.js PUT/DELETE: owner only

**입력값 검증 규칙:**
- 필수 필드 누락 → 400
- UUID 파라미터 → UUID 형식 검증
- limit 파라미터 → bounded range
- visibility → `public` 또는 `private`만 허용
- sourceType → `youtube`, `soundcloud`, `bandcamp`, `spotify`, `apple`, `other`
- 문자열 필드 길이 제한 적용
- emotionTags → 배열, 최대 20개

---

## Public-first transition TODO

Before code changes:

1. Update API contract and tests.
2. Define Plus entitlement source.
3. Define grandfathered private behavior.
4. Update Netlify and Modal policy together.
5. Separate visibility change from browse display eligibility.
6. Prepare frontend UX copy and error handling.

Implementation split:

### Backend workstream

- Change `POST /api/trees` default visibility to public.
- Remove public-create 409 only when Modal equivalent is ready.
- Add entitlement guard for private creation.
- Add entitlement guard for public → private toggle.
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

## Not yet implemented / decision-needed

- Public-first create tree implementation
- Plus entitlement source
- Plus private backend guard
- Grandfathered private metadata strategy
- Entitlement error code/status contract
- User-facing copy for Plus private after payment policy is confirmed

---

## Seed data note

Seed/demo data remains public sample content and is not a private storage policy reference.

---

## Detail/API integration note

- `apiClient.getMemory(memoryId)` — GET `/api/memories/:memoryId`
- `apiClient.getMemoriesByTree(treeId)` — GET `/api/memories?treeId=...`
- `apiClient.getFirstTree()` — GET `/api/trees` then first item

Visibility policy changes must update the API client only after backend and Modal contracts are aligned.
