# LoveBud 배포 체크리스트

> 생성: 2026-04-16
> 갱신: 2026-04-22 (Firebase Console 운영 체크리스트 추가)
> 목적: 배포 전후 502/런타임 장애 재발 방지

## 0. 빠른 자동 검증 (1분)

```bash
# 구문/i18n/라우트/파일 존재 — env/DB 의존 없이 즉시 실행
npm run verify

# 위 + env/DB/Firebase 로컬 검사
npm run verify:full

# 위 + 원격 엔드포인트 응답 확인
npm run verify:remote
```

검사 항목:
1. JS 구문 오류 (`node --check` — env 없이 초고속)
2. i18n key 정합성 (HTML/JS ↔ dictionary 교차 검증)
3. netlify.toml 라우트 ↔ 함수 파일 존재
4. HTML 기본 구조 (DOCTYPE/html/head/body)
5. 필수 파일 존재
6. node_modules 의존성 설치
7. env/DB/Firebase (--full 또는 --remote 시)

## 1. 배포 전 확인 (Push 전)

### 1-1. 환경변수 필수 확인

```bash
netlify env:list
```

반드시 존재해야 하는 변수:

| 변수 | 대상 | 누락 시 증상 |
|------|------|-------------|
| `NETLIFY_DATABASE_URL` | DB 연결 | 모든 API 503, `db.js` throw |
| `FIREBASE_SERVICE_ACCOUNT_JSON` | 인증 | POST/인증 필요 API 503 |
| `DATABASE_URL` | DB fallback | NETLIFY_DATABASE_URL 있으면 생략 가능 |

### 1-2. 함수 의존성 확인

```bash
# node_modules에 firebase-admin, pg 포함 확인
ls node_modules/firebase-admin/package.json
ls node_modules/pg/package.json
```

Netlify Functions는 `netlify/functions/` 디렉토리 기준으로 번들링됨.
`package.json`에 `firebase-admin`, `pg`가 반드시 포함되어야 함.

### 1-3. 함수 문법 검증

```bash
node -e "require('./netlify/functions/trees.js')"
node -e "require('./netlify/functions/memories.js')"
node -e "require('./netlify/functions/_lib/auth.js')"
node -e "require('./netlify/functions/_lib/db.js')"
```

`require`가 throw하면 배포 후 502 발생.

### 1-4. .env 동기화 확인 (로컬 → Netlify)

- `.env`에 `NETLIFY_DATABASE_URL`과 `DATABASE_URL`이 동일한 값인지
- `FIREBASE_SERVICE_ACCOUNT_JSON`이 유효한 JSON인지
  ```bash
  node -e "JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT_JSON || '{}'); console.log('OK')"
  ```

### 1-5. Firebase Console 운영/보안 체크리스트

> 중요: `js/firebase-config.js`의 Firebase 웹 클라이언트 설정값은 **완전히 숨기는 비밀값이 아닙니다.**
> 실제 보호는 Firebase Console의 Authorized Domains, 로그인 제공업체 설정, Rules, App Check에 의존합니다.

#### A. Authorized Domains 점검
- Firebase Console → Authentication → Settings → Authorized domains 확인
- 현재 실제 운영 도메인만 유지
- 꼭 필요한 경우만 아래 로컬 개발 도메인 유지
  - `localhost`
  - `127.0.0.1`
- 예전 실도메인, 임시 스테이징, 더 이상 쓰지 않는 preview 도메인 삭제 검토
- 도메인 정리 기준:
  - 현재 실제 로그인 진입에 쓰는가?
  - 지금도 배포/검증에 필요한가?
  - 소유가 불명확한 도메인은 남겨두지 않는가?

#### B. 로그인 제공업체 최소화
- Firebase Console → Authentication → Sign-in method 확인
- 실제로 사용하는 제공업체만 활성화
- 사용하지 않는 OAuth provider는 비활성화
- 테스트용/과거 실험용 provider가 남아 있지 않은지 점검

#### C. Firestore / Storage / 기타 Rules 점검
- Firestore 사용 시 Rules가 `allow read, write: if true;` 같은 공개 전체 허용 상태가 아닌지 점검
- Storage 사용 시 Rules가 무제한 공개 쓰기 상태가 아닌지 점검
- 현재 LoveBud에서 Firebase는 주로 인증용이지만, 추가 제품 확장 전에 Rules 기본값을 다시 확인
- “안 쓰는 서비스라도 기본 공개 상태로 열려 있지 않은지” 확인

#### D. App Check 검토
- Firebase Console → App Check 활성화 가능성 검토
- 지금 당장 강제 적용이 어려워도, 최소한 웹앱 대상 적용 여부를 검토하고 운영 메모 남기기
- 추후 abuse/스크래핑/무단 호출 우려가 커질 경우 우선순위 상향

#### E. 로컬 개발 허용 기준
- `localhost`, `127.0.0.1`은 실제 로컬 개발/검증에 필요하면 유지 가능
- 단, 그 외 임시 사설 IP/과거 개인 도메인은 원칙적으로 제거 검토
- 로컬 개발이 끝났다고 해서 `localhost`를 무조건 제거할 필요는 없지만, 운영 도메인과 혼동되지 않게 관리

#### F. 예전 도메인 / 스테이징 도메인 정리 기준
- 아래 중 하나라도 아니면 제거 검토
  1. 현재 운영 중인 실도메인
  2. 현재 활성 배포 검증에 실제 사용하는 도메인
  3. 현재 팀이 명확히 관리하는 staging 도메인
- 오래된 Netlify preview, 과거 캠페인 도메인, 개인 테스트 도메인은 정리 우선순위 높음

## 2. 배포 후 확인 (Push 후 Netlify 배포 완료 대기)

### 2-1. 기본 엔드포인트 응답 확인

```bash
# 인증 없이 동작해야 하는 엔드포인트
curl -s -o /dev/null -w "%{http_code}" https://lovebud.netlify.app/api/trees
# 기대: 200

curl -s -o /dev/null -w "%{http_code}" https://lovebud.netlify.app/api/community/memories
# 기대: 200

# 공개 트리 상세 (시드 데이터가 있다면)
curl -s -o /dev/null -w "%{http_code}" https://lovebud.netlify.app/api/trees/<PUBLIC_TREE_ID>
# 기대: 200 또는 404
```

### 2-2. 502/503 미발생 확인

```bash
# 502 = 함수 로드/실행 실패 (의존성 누락, 문법 에러)
# 503 = 환경변수 누락 (db.js, auth.js에서 throw)
curl -s https://lovebud.netlify.app/api/trees | head -c 200
# {"error":...} 가 아닌 HTML이면 502 의심
```

### 2-3. 브라우저 핵심 플로우 확인

| 플로우 | URL | 확인 사항 |
|--------|-----|-----------|
| 홈 | `/` | 정상 로드, 콘솔 에러 없음 |
| 검색 | `/search.html` | 공개 트리 표시 |
| 상세 | `/detail.html?id=<ID>` | null/빈 상태에서 무너지지 않음 |
| 에디터 | `/editor.html?treeId=<ID>` | 로그인 가드, 트리 로드 |
| 로그인 | `/login.html` | Firebase 인증 동작 |

### 2-4. Netlify Functions 로그 확인

```bash
netlify functions:log trees
```

502가 나온다면:
1. 환경변수 누락 여부 (503 에러 메시지 확인)
2. `firebase-admin` 로드 실패 여부
3. DB 연결 타임아웃 여부

## 3. 장애 발생 시 대응

### 3-1. /api/trees 502

| 원인 | 확인 | 해결 |
|------|------|------|
| `firebase-admin` 모듈 없음 | `node -e "require('firebase-admin')"` | `npm install` |
| `FIREBASE_SERVICE_ACCOUNT_JSON` 누락 | `netlify env:list` | Netlify Dashboard에서 설정 |
| `NETLIFY_DATABASE_URL` 누락 | `netlify env:list` | Netlify Dashboard에서 설정 |
| 함수 문법 에러 | Netlify deploy log | 코드 수정 후 재배포 |
| Neon 연결 불가 | `psql "$NETLIFY_DATABASE_URL" -c "SELECT 1"` | Neon 상태 확인 |

### 3-2. editor.js 런타임 에러

| 증상 | 원인 | 해결 |
|------|------|------|
| 빈 화면 | Firebase 로드 실패 + cached auth 없음 | Firebase SDK 로드 확인 |
| 트리 없음 | API 401/403 + mock fallback 없음 | 로그인 상태 확인 |
| 메모리 추가 안됨 | createMemory API 실패 | 콘솔 에러 확인 |

### 3-3. 환경변수 누락 증상 매핑

| 누락 변수 | 영향 엔드포인트 | 에러 코드 | 에러 메시지 |
|-----------|---------------|----------|------------|
| `NETLIFY_DATABASE_URL` + `DATABASE_URL` | 모든 API | 503 | "Database is not configured" |
| `FIREBASE_SERVICE_ACCOUNT_JSON` | POST /api/trees, /api/memories, /api/memories/:id | 503 | "Missing Firebase service account" |
| `FIREBASE_SERVICE_ACCOUNT_JSON` | GET /api/trees (인증 시도) | 공개 트리로 fallback | 정상 동작 (의도됨) |
| `FIREBASE_SERVICE_ACCOUNT_JSON` | GET /api/trees/:id (공개) | 정상 | 인증 불필요 |

## 4. 정기 확인 (권장)

- 주 1회: `netlify env:list` 로 환경변수 존재 확인
- 배포마다: 2-1, 2-2 체크리스트 실행
- 월 1회: Neon 연결 상태 확인 (`psql` 또는 Neon Console)
- 월 1회: Firebase Authorized Domains / Sign-in method / Rules / App Check 검토
