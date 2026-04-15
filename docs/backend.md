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

## Top-level Dependencies

| Package | Version | Why |
|---------|---------|-----|
| `firebase-admin` | ^12.0.0 | `_lib/auth.js` calls `require('firebase-admin')` to verify ID tokens in protected functions |
| `pg` | ^8.12.0 | `_lib/db.js` calls `require('pg')` for Neon PostgreSQL connection pool |

Both are **server-side only** (Netlify Functions) — never bundled into the browser.
Netlify auto-installs `package.json` dependencies during build.

## Netlify 배포 설정

**package.json**: 루트에 위치하며 Netlify Functions 빌드 시 의존성 자동 설치  
**netlify.toml**: `[functions]` 섹션으로 Functions 디렉토리 지정, `[[redirects]]` 순서는 `/api/*` → `/*` (SPA fallback은 항상 마지막)  
빌드 에러 시 확인: Functions 로그에서 "Cannot find module" 오류 → package.json 의존성 누락 확인

## Current Status

**Implemented:**
- Browser-side fetch client (js/postgres-client.js) — API-first with mock fallback
- `_lib/` (auth, db, http, doc-store) — full CRUD scaffold
- `trees.js` — GET/POST with auth
- `tree-detail.js` — GET with access control
- `memories.js` — GET/POST with auth + ownership enforcement
- `memory-detail.js` — GET/PATCH/DELETE with ownership check
- `community-memories.js` — public read (no auth)
- SQL schema (netlify/sql/001_initial_schema.sql)

**GET 정책 (모두 인증 필수):**
- `/api/memories` GET: 인증된 사용자의 own trees 메모리만 조회 (treeId 지정 시 해당 tree 소유권 검증)
- `/api/memories/:memoryId` GET: 인증 필수. public memory는 anyone이 조회 가능, private memory는 owner만 조회 가능

**Ownership 검증 완료:**
- memories.js GET: 사용자가 소유한 트리의 메모리만 반환
- memories.js POST: body.treeId가 본인 소유 트리인지 검증 후 생성
- memory-detail.js GET: public anyone / private owner only
- memory-detail.js PATCH/DELETE: memory가 속한 tree의 owner만 수정/삭제 가능

**Frontend 연결 상태:**
- `search.html` — `window.apiClient.getCommunityMemories()` API 우선 + mock fallback 적용 완료
- `js/postgres-client.js` — 모든 메서드 API 우선, 실패 시 mock fallback

**Not yet implemented:**
- Neon PostgreSQL actual database + schema run
- detail.html API 연결 (postgres-client.js는 준비됨)
- editor.html API 연결 — createMemory, getMemoriesByTree 구현 완료

**Next step:**
1. Run `001_initial_schema.sql` against Neon PostgreSQL
2. Run `002_seed_demo_data.sql` for demo content (optional but recommended for public browsing)
3. Update Netlify environment variables (`FIREBASE_SERVICE_ACCOUNT_JSON`, `NETLIFY_DATABASE_URL`)

**시드 데이터 (Seed Data):**
- `002_seed_demo_data.sql` — 검증된 공개 콘텐츠 기반 데모 데이터
- 2개 public trees (BTS, Hearts2Hearts 샘플)
- 9개 public memories (공식 YouTube 채널 기반)
- `ON CONFLICT` 구문으로 재실행 시 업데이트 가능
- Neon 콘솔 또는 `psql`로 실행: `\i netlify/sql/002_seed_demo_data.sql`

**Detail 화면 API 연결 방법:**
- `apiClient.getMemory(memoryId)` — GET `/api/memories/:memoryId` 직접 호출
- `apiClient.getMemoriesByTree(treeId)` — GET `/api/memories?treeId=...` 호출
- `apiClient.getFirstTree()` — GET `/api/trees` 후 첫 번째 선택
- 모든 메서드는 API 실패 시 자동으로 mock-data.js fallback