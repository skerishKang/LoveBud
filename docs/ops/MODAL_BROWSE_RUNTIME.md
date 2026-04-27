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
- `PUT /modal/private/trees/{tree_id}`
- `DELETE /modal/private/trees/{tree_id}`
- `GET /modal/private/memories`
- `POST /modal/private/memories`
- `PUT /modal/private/memories/{memory_id}`
- `DELETE /modal/private/memories/{memory_id}`

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

현재 main 기준 Modal owner write path는 **public-first create + Plus private guard** 상태입니다.

- `/modal/private/trees` POST는 tree visibility 기본값을 `public`으로 처리합니다.
- My Trees 생성 payload도 `visibility: public`을 명시합니다.
- `/modal/private/trees` POST에 `visibility: private`이 들어오면 Modal은 private storage entitlement를 확인합니다.
- `/modal/private/memories` POST에서 memory visibility가 생략되면 parent tree visibility를 상속합니다.
- tree 또는 memory visibility를 `private`으로 생성하거나 전환하는 path는 private storage entitlement guard를 탑니다.
- 기존 private tree를 자동 public 전환하지 않습니다.

### 3.2 현재 정책 상태

CTO 기준 정책인 **public-first + Plus private**은 현재 main의 Modal/My Trees create path에 부분 반영되어 있습니다.

현재 반영됨:

- 신규 tree create 기본값은 `public`
- My Trees 생성 payload는 `visibility: public` 명시
- private tree/memory 생성 또는 private 전환 시 Plus entitlement guard 호출
- 기존 private tree 자동 public 전환 금지
- public visibility와 Browse/Search eligibility 분리
- anonymous public read path에서 parent tree visibility guard 유지

계속 분리해서 봐야 할 항목:

- public tree가 곧바로 Browse/Search에 소개되는 것은 아님
- Browse/Search summary는 public memory count / quality filter를 통과한 tree만 반환
- grandfathered private tree의 기존 사용자 경험은 별도 정책으로 유지

### 3.3 Modal runtime contract-needed 항목

현재 Modal은 active runtime 기준으로 public-first create와 private entitlement guard를 수행합니다. 다만 다음 항목은 아직 정책/계약으로 독단 확정하지 않습니다.

Contract-needed:

- `users/{uid}.privateStorageEnabled` 외 compatibility entitlement fields를 장기 계약으로 유지할지 여부
- Plus-required HTTP status와 error body shape를 API contract로 고정할지 여부
- grandfathered private owner의 신규 private storage 제한/허용 UX
- private 전환 실패 시 frontend toast/i18n 문구
- Settings/결제 UX와 private storage 안내 문구
- Browse/Search threshold의 장기 정책화 여부

---

## 4. 품질 가드와 publication guard 구분

Modal summary SQL은 browse summary 품질을 위해 아래 조건을 직접 강제합니다.

- `trees.visibility = 'public'`
- public memories `HAVING count(*) >= 3`

따라서 browse latest summary는 공개 순간 3개 이상인 공개 트리만 반환해야 합니다.

중요:

- 이 조건은 **browse summary display filter / quality filter**입니다.
- `visibility: public` 자체와 같은 의미가 아닙니다.
- public-first create 상태에서도 public tree가 곧바로 browse에 노출되는 것은 아닙니다.
- publication/visibility 전환 guard와 browse display filter를 혼동하지 않습니다.

현재 해석:

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
- `FIREBASE_SERVICE_ACCOUNT_JSON`
  - private storage entitlement lookup에 필요한 Firebase Admin service account JSON
- `FIREBASE_PROJECT_ID`
  - Firebase ID token verification 및 Admin project 검증에 사용

### Optional

- `CORS_ALLOWED_ORIGINS`
  - 콤마 구분 문자열
  - 기본값이 있더라도 운영에서는 명시 설정 권장

### Contract-needed for Plus private

- canonical 외 compatibility entitlement fields의 장기 지원 여부
- entitlement cache policy
- Plus-required error code/status
- Plus-required response body shape

---

## 7. 운영 체크리스트

1. Cloudflare Pages 운영 환경에 `MODAL_BASE_URL`가 설정되어 있는지 확인
2. Cloudflare Pages 운영 환경에 `LOVEBUD_UPSTREAM_ORIGIN`가 설정되어 있는지 확인
3. Modal live endpoint에서 `/modal/health`가 200을 반환하는지 확인
4. `/modal/browse/latest?limit=3`가 배열을 반환하는지 확인
5. 각 item에 browse 카드가 기대하는 key가 모두 있는지 확인
6. Modal 장애 시 Cloudflare Pages route가 Vercel fallback으로 계속 browse를 살리는지 확인
7. tree create에서 visibility 생략 시 `public`으로 생성되는지 확인
8. My Trees create payload가 `visibility: public`을 명시하는지 확인
9. private tree/memory create 또는 private 전환 시 Modal private write path가 entitlement를 검증하는지 확인
10. grandfathered private tree가 browse에 노출되지 않는지 확인

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

- Modal: browse summary 읽기/집계 1순위 계층 + active private owner write target
- Cloudflare Pages: same-origin entry + API 라우터
- Vercel: upstream / secondary entry 유지
- Netlify: fallback / legacy 유지

Visibility 정책 이후에도 프런트가 직접 Modal URL이나 Vercel/Netlify URL에 강결합되지 않도록 현재 구조를 기본값으로 둡니다.

---

## 10. 구현 상태와 금지 사항

현재 main은 public-first create와 Plus private guard를 일부 반영했습니다. 다음 shortcut은 여전히 금지합니다.

- 기존 private tree 자동 public 전환
- public visibility를 Browse/Search 자동 노출로 설명
- Plus entitlement guard를 frontend-only로 간주
- Plus-required HTTP status/body shape를 문서에서 독단 확정
- browse latest filter에서 public memory threshold를 암묵적으로 제거
- Netlify legacy artifact에 신규 backend 정책을 구현

---

## 11. 이후 작업 분리

### Modal/backend 작업

- Plus-required error status/body contract 고정
- compatibility entitlement fields의 장기 지원 여부 결정
- grandfathered private 세부 UX와 backend 예외 처리 정리
- browse summary filter 유지 여부의 장기 정책화

### Cloudflare/API routing 작업

- Modal failure fallback이 visibility 정책 불일치를 숨기지 않도록 점검
- API response/error contract 동기화

### Frontend 작업

- Plus-required 실패 toast/i18n 문구
- Settings/결제 UX와 private storage 안내
- browse 노출 조건 설명

이 문서는 코드 변경 지시가 아니라 현재 main runtime 상태와 남은 계약 필요 항목을 동기화한 운영 문서입니다.
