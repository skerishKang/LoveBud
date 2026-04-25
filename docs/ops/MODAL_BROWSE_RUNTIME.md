# MODAL_BROWSE_RUNTIME

LoveBud browse/public summary 경로에서 Modal을 1순위 읽기/계산 계층으로 유지하기 위한 운영 기준입니다.

---

## 1. 현재 기준 경로

- Cloudflare Pages 프런트(`https://lovebud.pages.dev`)는 browse 진입 시 직접 Modal을 호출하지 않습니다.
- 프런트는 same-origin `/api/community/trees?view=summary&sort=latest&limit=3`를 호출합니다.
- Cloudflare Pages `functions/api/[[path]].js`가 `view=summary` 요청을 받으면 먼저 Modal의 `/modal/browse/latest?limit=<n>`를 호출합니다.
- Modal 응답이 실패하거나 비어 있으면 Cloudflare Pages route가 Vercel upstream으로 fallback 합니다.

현재 주경로:

1. 브라우저 → `https://lovebud.pages.dev/api/community/trees?view=summary&sort=latest&limit=3`
2. Cloudflare Pages `functions/api/[[path]].js`
3. Modal `/modal/browse/latest`
4. 실패 시 Vercel upstream fallback

중요:

- 현재 main 기준 browse summary의 same-origin entry는 Cloudflare Pages `/api/community/trees`입니다.
- Vercel은 브라우저의 직접 진입점이 아니라 upstream / secondary 계층입니다.
- Netlify는 fallback / legacy 계층입니다.

---

## 2. main 기준 Modal browse 계약

`modal_compute/app.py` 기준 엔드포인트:

- `GET /modal/health`
- `GET /modal/browse/latest?limit=1..60&sort=latest|popular`
- `GET /modal/browse/growing?limit=3..12`
- `GET /modal/community/memories`
- `GET /modal/memories/{memory_id}`
- `GET /modal/trees/{tree_id}`
- `GET /modal/private/trees`
- `POST /modal/private/trees`
- `GET /modal/private/trees/{tree_id}`
- `GET /modal/private/memories`
- `POST /modal/private/memories`

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

---

## 3. Visibility / private storage 정책

### 3.1 현재 Modal 구현

현재 Modal private owner write path는 private-first입니다.

- `/modal/private/trees` POST는 tree visibility 기본값을 `private`으로 처리합니다.
- `/modal/private/trees` POST에 `visibility: public`이 들어오면 현재 구현은 409를 반환합니다.
- `/modal/private/memories` POST는 memory visibility 기본값을 `private`으로 처리합니다.
- Plus entitlement 검증은 아직 없습니다.

### 3.2 목표 정책

CTO 결정 기준 목표 정책은 **public-first + Plus private**입니다.

- 신규 tree는 public-first 방향으로 전환합니다.
- 기존 private tree는 자동 public 전환하지 않고 grandfathered private으로 유지합니다.
- private 생성/전환은 Plus entitlement source 확정 후 backend에서 검증합니다.
- public visibility와 browse 노출 조건은 분리합니다.
- createTree payload만 단독으로 public 변경하는 것은 금지합니다.
- Netlify와 Modal 정책은 반드시 동기화합니다.

### 3.3 Modal 전환 원칙

Modal은 Netlify/API 정책과 동시에 바뀌어야 합니다.

금지:

- Netlify는 public-first인데 Modal은 private-first로 남기는 상태
- Modal은 public-first인데 Netlify는 private-first로 남기는 상태
- Cloudflare route가 Modal/Netlify 차이를 숨기도록 방치하는 상태
- Plus entitlement 없이 Modal private write만 frontend에서 숨기는 상태

전환 시 필요한 항목:

- `/modal/private/trees` POST default visibility 변경 여부
- private 생성 시 entitlement check
- public → private toggle endpoint가 Modal에 추가될 경우 동일 entitlement check
- grandfathered private owner read 유지
- public browse filters 유지

Decision-needed:

- Modal이 user plan을 직접 조회할지, upstream/API layer에서 검증할지
- Modal secret/env로 entitlement source에 접근할지
- Modal private endpoint의 Plus-required error contract

---

## 4. 품질 가드와 publication guard 구분

Modal summary SQL은 browse summary 품질을 위해 아래 조건을 직접 강제합니다.

- `trees.visibility = 'public'`
- public memories `HAVING count(*) >= 3`

따라서 browse latest summary는 공개 순간 3개 이상인 공개 트리만 반환해야 합니다.

중요:

- 이 조건은 **browse summary display filter / quality filter**입니다.
- `visibility: public` 자체와 같은 의미가 아닙니다.
- public-first 전환 후에도 public tree가 곧바로 browse에 노출되는 것은 아닙니다.
- publication/visibility 전환 guard와 browse display filter를 혼동하지 않습니다.

전환 후 권장 해석:

| 개념 | 의미 | Modal browse 영향 |
|------|------|-------------------|
| public visibility | 공개 접근 가능한 tree 상태 | 필요 조건 |
| browseEligible | 둘러보기 카드 노출 가능 상태 | summary 반환 조건 |
| public memory count | 공개 memory 개수 | 품질 threshold |
| grandfathered private | 기존 private 유지 상태 | browse 제외 |
| Plus private | 유료 private 보관 상태 | browse 제외 |

---

## 5. CORS 기준

`modal_compute/app.py` 기본 허용 origin 예시:

- `https://lovebud.pages.dev`
- `https://lovebud.vercel.app`
- `https://lovebud.netlify.app`

운영에서는 필요 시 `CORS_ALLOWED_ORIGINS`로 덮어씁니다.

---

## 6. 필수 운영 환경 변수

### Cloudflare Pages

- `MODAL_BASE_URL`
  - Cloudflare Pages `functions/api/[[path]].js`가 browse summary용 Modal upstream으로 사용
- `LOVEBUD_UPSTREAM_ORIGIN`
  - Modal 실패 시 fallback upstream origin으로 사용

### Modal secret/runtime

- `DATABASE_URL`
  - Modal secret `lovebud-db`에서 주입

### Optional

- `CORS_ALLOWED_ORIGINS`
  - 콤마 구분 문자열
  - 기본값이 있더라도 운영에서는 명시 설정 권장

### Decision-needed for Plus private

- Plus entitlement source env/secret
- plan lookup endpoint or DB table
- entitlement cache policy
- Plus-required error code/status

---

## 7. 운영 체크리스트

1. Cloudflare Pages 운영 환경에 `MODAL_BASE_URL`가 설정되어 있는지 확인
2. Cloudflare Pages 운영 환경에 `LOVEBUD_UPSTREAM_ORIGIN`가 설정되어 있는지 확인
3. Modal live endpoint에서 `/modal/health`가 200을 반환하는지 확인
4. `/modal/browse/latest?limit=3`가 배열을 반환하는지 확인
5. 각 item에 browse 카드가 기대하는 key가 모두 있는지 확인
6. Modal 장애 시 Cloudflare Pages route가 Vercel fallback으로 계속 browse를 살리는지 확인
7. public-first 전환 시 Netlify와 Modal create policy가 같은지 확인
8. Plus private 적용 시 Modal private write path가 entitlement를 검증하는지 확인
9. grandfathered private tree가 browse에 노출되지 않는지 확인

---

## 8. 데이터 shape 메모

현재 main 기준으로 browse 첫 렌더에 꼭 필요한 shape는 충족합니다.

운영 점검 필드:

- `representativeThumbnail`: 가능한 한 시각 카드에 바로 쓸 수 있는 값이어야 함
- `emotionTags`: browse chip/preview에 바로 쓸 수 있는 문자열 배열이어야 함
- `theme`: 현재 고정값이면 후속 개선 후보
- `timeRange`: 현재 비어 있으면 후속 개선 후보
- `visibility`: public이어야 browse summary 대상

---

## 9. 역할 분리

- Modal: browse summary 읽기/집계 1순위 계층
- Cloudflare Pages: same-origin entry + API 라우터
- Vercel: upstream / secondary entry 유지
- Netlify: fallback / legacy 유지

Visibility 정책 전환 후에도 프런트가 직접 Modal URL이나 Vercel/Netlify URL에 강결합되지 않도록 현재 구조를 기본값으로 둡니다.

---

## 10. public-first 전환 전 금지 사항

- createTree payload만 public으로 변경
- Modal만 public-first로 변경
- Netlify만 public-first로 변경
- 기존 private tree 자동 public 전환
- Plus entitlement 없이 private write를 정책상 완료로 선언
- browse latest filter에서 public memory threshold를 암묵적으로 제거

---

## 11. 이후 작업 분리

### Modal/backend 작업

- public-first create policy 반영
- private create entitlement guard
- public/private visibility transition 정책 반영
- grandfathered private 유지
- browse summary filter 유지

### Cloudflare/API routing 작업

- Modal failure fallback이 visibility 정책 불일치를 숨기지 않도록 점검
- API response/error contract 동기화

### Frontend 작업

- public-first UX copy
- Plus private 안내
- browse 노출 조건 설명

이 문서는 코드 변경 지시가 아니라 운영/정책 정합성 기준입니다.
