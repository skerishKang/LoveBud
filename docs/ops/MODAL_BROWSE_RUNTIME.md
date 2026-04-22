# MODAL_BROWSE_RUNTIME

LoveBud browse/public summary 경로에서 Modal을 1순위 읽기/계산 계층으로 유지하기 위한 운영 기준입니다.

## 1. 현재 기준 경로

- Vercel 프런트(`https://lovebud.vercel.app`)는 browse 진입 시 직접 Modal을 호출하지 않습니다.
- 프런트는 same-origin `/api/community/trees?view=summary&sort=latest&limit=3`를 호출합니다.
- Vercel `api/community/trees.js`가 `view=summary` 요청을 받으면 **먼저 Modal**의 `/modal/browse/latest?limit=<n>`를 호출합니다.
- Modal 응답이 실패하거나 비어 있으면 Vercel route가 Netlify `/community/trees` upstream으로 fallback 합니다.

즉, 현재 주경로는 아래와 같습니다.

1. 브라우저 → `https://lovebud.vercel.app/api/community/trees?view=summary&sort=latest&limit=3`
2. Vercel `api/community/trees.js`
3. Modal `/modal/browse/latest`
4. 실패 시 Netlify `/community/trees` fallback

중요:
- 현재 main 기준 browse summary의 same-origin entry는 **Vercel `/api/community/trees`** 입니다.
- Netlify는 브라우저의 직접 진입점이 아니라 fallback / upstream 계층입니다.

## 2. main 기준 Modal browse 계약

`modal_compute/app.py` 기준 엔드포인트:

- `GET /modal/health`
- `GET /modal/browse/latest?limit=1..3`

Modal browse summary는 아래 key를 flat camelCase로 반환합니다.

- `id`
- `title`
- `visibility`
- `createdAt`
- `updatedAt`
- `representativeThumbnail`
- `memoryCount`
- `emotionTags`
- `stage`
- `theme`
- `timeRange`
- `representativeMemorySourceUrl`

## 3. 품질 가드와 publication guard 구분

Modal summary SQL은 browse summary 품질을 위해 아래 조건을 직접 강제합니다.

- `trees.visibility = 'public'`
- public memories `HAVING count(*) >= 3`

따라서 browse latest summary는 **공개 순간 3개 이상**인 공개 트리만 반환해야 합니다.

중요:
- 이 문서에서 설명하는 조건은 **browse summary display filter / quality filter** 맥락입니다.
- 트리를 public으로 전환할 수 있는지 결정하는 **publication guard**와 혼동하지 않습니다.
- publication guard 운영 기준은 `docs/engineering/BROWSE_FILTER_VS_PUBLICATION_GUARD.md`를 따릅니다.

## 4. CORS 기준

`modal_compute/app.py` 기본 허용 origin:

- `https://lovebud.vercel.app`
- `https://lovebud.netlify.app`

운영에서는 필요 시 `CORS_ALLOWED_ORIGINS`로 덮어씁니다.

## 5. 필수 운영 환경 변수

### Vercel
- `MODAL_BASE_URL`
  - Vercel `api/community/trees.js`가 browse summary용 Modal upstream으로 사용
- `NETLIFY_API_BASE_URL`
  - Modal 실패 시 Netlify fallback upstream으로 사용

### Modal secret/runtime
- `DATABASE_URL`
  - Modal secret `lovebud-db`에서 주입

### Optional
- `CORS_ALLOWED_ORIGINS`
  - 콤마 구분 문자열
  - 기본값이 있더라도 운영에서는 명시 설정 권장

## 6. 운영 체크리스트

1. Vercel 운영 환경에 `MODAL_BASE_URL`가 설정되어 있는지 확인
2. Vercel 운영 환경에 `NETLIFY_API_BASE_URL`가 설정되어 있는지 확인
3. Modal live endpoint에서 `/modal/health`가 200을 반환하는지 확인
4. `/modal/browse/latest?limit=3`가 배열을 반환하는지 확인
5. 각 item에 browse 카드가 기대하는 key가 모두 있는지 확인
6. Modal 장애 시 Vercel route가 Netlify fallback으로 계속 browse를 살리는지 확인

## 7. 데이터 shape 메모

현재 main 기준으로 browse 첫 렌더에 꼭 필요한 shape는 충족합니다.
다만 아래 필드는 운영 점검 시 함께 봅니다.

- `representativeThumbnail`: 가능한 한 시각 카드에 바로 쓸 수 있는 값이어야 함
- `emotionTags`: browse chip/preview에 바로 쓸 수 있는 문자열 배열이어야 함
- `theme`: 현재 고정값이면 후속 개선 후보
- `timeRange`: 현재 비어 있으면 후속 개선 후보

## 8. 역할 분리

- Modal: browse summary 읽기/집계 1순위 계층
- Vercel: same-origin entry + API 라우터
- Netlify: fallback / upstream 유지

이 원칙은 유지하되, 프런트가 직접 Modal URL이나 Netlify URL에 강결합되지 않도록 현재 구조를 기본값으로 둡니다.
