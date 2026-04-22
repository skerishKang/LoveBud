# Vercel & Modal Migration Status

본 문서는 LoveBud가 Netlify 중심 구조에서 **Modal > Vercel > Netlify** 우선순위 구조로 이동하는 현재 상태를 정리합니다.

현재 기준:
- 실서비스 프론트: `https://lovebud.vercel.app/`
- 브라우저는 가능하면 **same-origin `/api`** 만 사용
- Netlify는 주경로가 아니라 fallback 또는 단계적 제거 대상

---

## 1. 현재 반영 상태

### 완료된 것
- **브라우저 상대 경로 정리**: 프론트는 `/api/...` 형태의 same-origin 경로를 기본으로 사용합니다.
- **Vercel API 엔트리 정리**: Vercel `api/` 라우트가 same-origin 엔트리 역할을 담당합니다.
- **Browse 가속 방향 정리**: browse summary 및 read-heavy 처리에서 Modal 우선 원칙을 사용합니다.
- **Catch-all Proxy 유지**: 특정되지 않은 `/api/*` 요청은 Vercel same-origin 엔트리 뒤에서 upstream fallback 으로 전달될 수 있습니다.

### 아직 남아 있는 것
- **Netlify upstream 제거 미완료**: Vercel same-origin 뒤에 남아 있는 Netlify fallback 의존을 단계적으로 축소해야 합니다.
- **Write 경로 완전 이관 미완료**: 일부 CRUD 쓰기 경로는 아직 Netlify upstream fallback 성격을 가질 수 있습니다.

---

## 2. 운영 계층

현재 운영 우선순위는 아래와 같습니다.

1. **Modal**
   - browse summary
   - read-heavy 계산
   - 복합 데이터 처리

2. **Vercel**
   - 실서비스 프론트
   - same-origin `/api`
   - 라우팅 / 프록시 / 엔트리

3. **Netlify**
   - fallback upstream
   - 단계적 제거 대상 레거시 경로

---

## 3. 핵심 원칙

### 브라우저 원칙
- 브라우저는 외부 API 호스트를 직접 기본값으로 사용하지 않습니다.
- 가능하면 **same-origin `/api`** 만 사용합니다.

### 인프라 원칙
- Modal은 성능과 계산 중심 계층입니다.
- Vercel은 실서비스 프론트와 API 진입점입니다.
- Netlify는 fallback 으로만 남기고 축소합니다.

### 정책 구분 원칙
- browse display filter 와 publication guard 는 같은 문제로 다루지 않습니다.
- browse filter 는 read/display 정책입니다.
- publication guard 는 write/state transition 정책입니다.

---

## 4. 남은 과제

- [ ] Netlify fallback upstream 제거 범위 정의
- [ ] write 경로의 Vercel native 이관 범위 결정
- [ ] Modal browse summary 캐시 정책 고도화
- [ ] Vercel / Firebase 도메인 승인 상태 점검 유지

---

## 5. 환경 변수 체크리스트

현재 운영 문서 기준으로 점검 대상은 아래와 같습니다.

- `MODAL_BASE_URL`
- `LOVEBUD_UPSTREAM_API_BASE`
- `DATABASE_URL`
- `FIREBASE_SERVICE_ACCOUNT_JSON`

필요 시 관련 상세는 `docs/ops/OPERATIONS.md` 와 함께 봅니다.
