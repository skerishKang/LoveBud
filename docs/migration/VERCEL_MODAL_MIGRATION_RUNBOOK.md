# Vercel & Modal Migration Status

본 문서는 Netlify 중심 구조에서 **Modal > Vercel > Netlify** 운영 구조로 전환된 현재 상태를 정리합니다.

## 1. 현재 기준

- 공식 서비스 주소: `https://lovebud.vercel.app/`
- Vercel은 공식 진입점입니다.
- Modal은 browse summary / representative preview / read-heavy aggregation의 1순위 계층입니다.
- Netlify는 fallback / legacy 계층입니다.

## 2. 현재까지 완료된 것

- Vercel `api/` 폴더 기반 same-origin API entry 구축
- `api/community/trees.js`에서 summary 요청 시 Modal 우선 호출 반영
- `api/community/memories.js`에서 representative preview 기준 Modal 우선 시도 반영
- `api/[...path].js`를 통한 Netlify upstream 유지
- 프런트 상대 경로(`/api/...`) 기준 통신 정리
- 실서비스 주소를 Vercel 기준으로 운영

## 3. 현재 계층 구조

1. **Modal**
   - browse summary
   - representative preview
   - public read aggregation
2. **Vercel**
   - 공식 프런트 엔트리
   - same-origin API router
3. **Netlify**
   - fallback / legacy upstream
   - 일부 기존 read/write 유지

## 4. 남아 있는 전이기 구조

아직 완전 제거되지 않은 항목:

- `api/community/memories.js`는 Modal representative preview를 먼저 시도하지만, 여전히 Netlify fallback 의존이 남아 있음
- catch-all `/api/*`는 Netlify upstream 사용
- 일부 기존 CRUD와 auth-required legacy 경로는 Netlify 의존이 남아 있음

즉, 현재 상태는 **Modal + Vercel이 앞단을 잡고, Netlify가 뒤에서 받치는 전이기 구조**입니다.

## 5. 운영에서 헷갈리면 안 되는 기준

- Netlify를 주서비스처럼 설명하지 않는다.
- `lovebud.netlify.app`는 공식 주소가 아니다.
- browse summary의 1순위는 Modal이다.
- preview hydrate도 Modal representative preview를 먼저 시도한다.
- Vercel은 단순 정적 호스팅이 아니라 same-origin API entry이다.

## 6. 환경 변수 기준

### Vercel
- `MODAL_BASE_URL`
- `NETLIFY_API_BASE_URL`
- `LOVEBUD_UPSTREAM_API_BASE`

### Modal
- `DATABASE_URL` (Modal secret)
- `CORS_ALLOWED_ORIGINS` (필요 시)

## 7. 다음 단계

- Netlify read 의존 범위를 더 줄일 수 있는지 검토
- Modal browse/preview 응답 품질(`theme`, `timeRange`, representative visual`) 지속 보완
- 운영 문서에서 Netlify 주경로 설명 제거 유지
- fallback은 남기되, 주경로 설명은 Modal/Vercel 기준으로 고정
