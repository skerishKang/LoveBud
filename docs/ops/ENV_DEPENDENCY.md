# LoveBud 환경변수 의존성 맵

> 생성: 2026-04-16
> 목적: 환경변수 누락 시 어떤 증상이 나는지 추적 가능하게

## 1. 환경변수 → 엔드포인트 의존도

### NETLIFY_DATABASE_URL / DATABASE_URL

**우선순위**: `NETLIFY_DATABASE_URL` → `DATABASE_URL` → `POSTGRES_URL` (db.js:13-19)

**의존 엔드포인트** (간접: db.js → doc-store.js → 각 함수):

| 엔드포인트 | 메서드 | 인증 | 영향 |
|-----------|--------|------|------|
| `/api/trees` | GET | 선택 | 공개/사용자 트리 목록 조회 불가 → 503 |
| `/api/trees` | POST | 필수 | 트리 생성 불가 → 503 |
| `/api/trees/:treeId` | GET | 선택 | 트리 상세 조회 불가 → 503 |
| `/api/memories` | GET | 필수 | 메모리 목록 조회 불가 → 503 |
| `/api/memories` | POST | 필수 | 메모리 생성 불가 → 503 |
| `/api/memories/:memoryId` | GET | 필수 | 메모리 상세 조회 불가 → 503 |
| `/api/memories/:memoryId` | PATCH | 필수 | 메모리 수정 불가 → 503 |
| `/api/memories/:memoryId` | DELETE | 필수 | 메모리 삭제 불가 → 503 |
| `/api/community/memories` | GET | 없음 | 커뮤니티 메모리 조회 불가 → 503 |

**누락 시 증상**:
- 에러 메시지: `"Database is not configured"` (status 503)
- 세부 정보: `"Missing Postgres connection string (NETLIFY_DATABASE_URL or DATABASE_URL)"`
- 클라이언트 영향: 모든 데이터 관련 기능 동작 불가
- editor.js: API 실패 → mock fallback 동작 (데이터 저장 안됨)

### FIREBASE_SERVICE_ACCOUNT_JSON

**대체 가능**: `FIREBASE_SERVICE_ACCOUNT` (auth.js:19-20)

**의존 엔드포인트** (직접: auth.js → requireUser/getUserFromEvent):

| 엔드포인트 | 메서드 | 인증 | 누락 시 동작 |
|-----------|--------|------|------------|
| `/api/trees` | GET | 선택 | 인증 실패해도 공개 트리로 fallback → 정상 동작 |
| `/api/trees` | POST | 필수 | 503 에러 |
| `/api/trees/:treeId` | GET | 선택 | 공개 트리는 정상, 비공개는 403 대신 503 가능성 |
| `/api/memories` | GET | 필수 | 503 에러 |
| `/api/memories` | POST | 필수 | 503 에러 |
| `/api/memories/:memoryId` | GET/PATCH/DELETE | 필수 | 503 에러 |
| `/api/community/memories` | GET | 없음 | 정상 (인증 불필요) |

**누락 시 증상**:
- 에러 메시지: `"Missing Firebase service account: FIREBASE_SERVICE_ACCOUNT_JSON or FIREBASE_SERVICE_ACCOUNT"` (status 503)
- 클라이언트 영향: 로그인한 사용자의 모든 쓰기/권한 필요 동작 불가
- 읽기 전용(공개 트리)은 영향 없음

**JSON 파싱 실패 시**:
- 에러 메시지: `"Invalid Firebase service account JSON: <parse error>"` (status 503)
- 원인: 따옴표 이스케이프 오류, 잘린 JSON, 잘못된 타입 등

## 2. 엔드포인트 → 인증 필요 여부

| 엔드포인트 | GET | POST | PATCH | DELETE |
|-----------|-----|------|-------|--------|
| `/api/trees` | 선택 (공개 fallback) | 필수 | - | - |
| `/api/trees/:treeId` | 선택 (공개=OK, 비공개=owner) | - | - | - |
| `/api/memories` | 필수 | 필수 | - | - |
| `/api/memories/:memoryId` | 필수 | - | owner만 | owner만 |
| `/api/community/memories` | 불필요 | - | - | - |

### 인증 "선택" 의미

- `GET /api/trees`: Authorization 헤더 없어도 200 반환 (공개 트리만)
- `GET /api/trees/:treeId`: 공개 트리는 인증 없이 조회 가능
- 인증이 있으면 사용자 소유 트리 추가 노출

## 3. Local Fallback 의도와 한계

### editor.js

| 시나리오 | 동작 | 한계 |
|---------|------|------|
| API 정상 | API 데이터 우선, 캐시 갱신 | 없음 |
| API 실패 + 캐시 있음 | 캐시된 데이터로 UI 렌더링 | 캐시 만료 시 오래된 데이터 |
| API 실패 + 캐시 없음 | mock 함수(getTrees, getMemoriesByTree) 사용 | mock 데이터는 서버에 저장 안됨 |
| Firebase 로드 실패 + cached auth 있음 | 5초 대기 후 재시도, 실패 시 토스트 | API 호출 안함 (안전 장치) |
| Firebase 로드 실패 + cached auth 없음 | login.html로 리다이렉트 | editor 진입 불가 |

### my-trees.js

| 시나리오 | 동작 | 한계 |
|---------|------|------|
| API 정상 | 사용자 트리 목록 표시 | 없음 |
| API 실패 + 캐시 있음 | 캐시 트리 표시 | 오래된 데이터일 수 있음 |
| API 실패 + 캐시 없음 | 빈 배열 → 빈 상태 UI | 사용자가 트리가 없는 것으로 보임 |

### 핵심 원칙

1. **API 우선**: 항상 API를 먼저 시도
2. **캐시 차선**: API 실패 시 캐시 사용 (TTL: 트리 3분, 메모리 2분)
3. **Mock 최후**: 캐시도 없으면 mock 데이터 (데이터 저장 안됨)
4. **인증 가드**: Firebase 없으면 API 호출 차단 (안전)

## 4. 502 에러 원인 분석 가이드

502 = Netlify Functions가 응답을 반환하지 못함

### 체크 순서

1. **함수 로드 실패**: `require('firebase-admin')` 또는 `require('pg')` 실패
   - 확인: Netlify deploy log에서 "Cannot find module" 검색
   - 해결: `npm install` 후 재배포

2. **환경변수 누락**: 모듈 로드는 성공하지만 초기화 시 throw
   - 확인: Functions 로그에서 "Missing" 또는 "not configured" 검색
   - 해결: Netlify Dashboard에서 환경변수 설정

3. **초기화 에러**: firebase-admin.initializeApp() 실패
   - 확인: Functions 로그에서 "Invalid Firebase service account" 검색
   - 해결: JSON 포맷 확인 (이스케이프, 따옴표)

4. **DB 연결 타임아웃**: Pool 생성 후 쿼리 타임아웃
   - 확인: Functions 로그에서 "timeout" 또는 "ECONNREFUSED" 검색
   - 해결: Neon 상태 확인, 연결 문자열 확인
