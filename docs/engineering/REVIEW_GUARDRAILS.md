# LoveBud Review Guardrails

이 문서는 코드 리뷰나 저장소 점검 시 반복적으로 나오는 오판을 줄이기 위한 가드레일입니다.

목적은 리뷰를 막는 것이 아니라, **현재 `main` 기준과 운영 계약을 무시한 generic 지적**을 줄이는 것입니다.

---

## 먼저 확인할 전제

- 공식 사용자-facing 주소: `https://lovebud.pages.dev/`
- active runtime: **Cloudflare Pages + Modal**
- Vercel: deprecated transitional fallback / audit 중
- Netlify: Legacy Artifact Only / Removal Candidate / Issue #119 runtime routing audit 대상
- 브라우저는 가능하면 **same-origin `/api`** 만 사용
- `PRODUCT_IDENTITY / BRAND_EXPERIENCE / UI_DESIGN_SYSTEM` 은 source of truth
- browse display filter 와 publication guard 는 다른 문제

리뷰 전에는 아래 문서를 먼저 확인합니다.

1. `../../AGENTS.md`
2. `../doc_index.md`
3. `../ops/OPERATIONS.md`
4. `./API_CONTRACT.md`
5. `./BROWSE_FILTER_VS_PUBLICATION_GUARD.md`

---

## 반복 false positive 금지 항목

### 1. Firebase Web `apiKey`

- `js/firebase-config.js`의 Firebase Web config는 브라우저 초기화용 설정입니다.
- 값이 코드에 보인다는 사실만으로 **즉시 blocker**로 분류하지 않습니다.
- 이 항목은 보통 **운영 점검 항목**으로 분리합니다.

점검 방향:
- Firebase authorized domains
- Auth provider 설정
- Security Rules
- abuse 방지 설정

금지:
- "apiKey가 보이므로 즉시 배포 불가" 식의 단정
- 서버 secret과 동일한 성격으로 취급

### 2. `vercel.json`

- 현재 `vercel.json`은 deprecated transitional fallback / audit 대상입니다.
- 공식 사용자-facing entry는 Cloudflare Pages `https://lovebud.pages.dev/` 기준입니다.

금지:
- `vercel.json`을 자동으로 삭제/정리 후보로 분류
- “Netlify가 있으니 Vercel 설정은 불필요” 식의 추정
- Vercel을 현재 공식 프론트 엔트리로 단정

### 3. Netlify route gap

- Netlify route gaps are not automatic blockers for Cloudflare production.
- Netlify is Legacy Artifact Only / Removal Candidate, not an active fallback implementation target.
- Route gaps in `netlify.toml` or `netlify/functions/*` should be routed to Issue #119 runtime routing audit unless CTO explicitly reactivates Netlify runtime.

금지:
- CTO 승인 없이 Netlify route parity를 맞추기 위해 신규 API route 추가
- 신규 backend policy를 `netlify/functions/*`에 구현
- Cloudflare production route gap과 Netlify legacy route gap을 같은 문제로 취급

### 4. browse vs search

- `pages/search.html`은 구현 경로명입니다.
- `browse`, `둘러보기`, `감상 허브`는 제품 경험 표현입니다.

금지:
- search와 browse를 같은 층위 개념으로 혼동
- 경로명만 보고 제품 카피가 틀렸다고 단정

### 5. browse display filter vs publication guard

- browse display filter: read/display 정책
- publication guard: write/state transition 정책

금지:
- 둘을 같은 기능 또는 같은 버그 범주로 취급

### 6. 파일 크기 / 번들러 / 컴포넌트화

- 파일이 크다는 사실만으로 현재 blocker라고 단정하지 않습니다.
- 번들러 도입, 전면 컴포넌트화, monolith 제거는 장기 과제일 수 있습니다.

금지:
- 실제 현재 증상과 연결 없이 “파일이 크니 심각” 판정
- generic 프론트엔드 교과서식 리뷰를 최우선 이슈로 분류

### 7. 이름만 보고 위험 단정

- 파일명만 보고 runtime 구조를 단정하지 않습니다.
- 반드시 현재 파일 내용과 실제 호출 구조를 확인합니다.

금지:
- 예: `postgres-client.js`라는 이름만 보고 브라우저가 DB에 직접 붙는다고 단정

---

## 리뷰 작성 규칙

리뷰는 아래 형식을 따릅니다.

1. 현재 `origin/main` 기준인지 명시
2. 실제로 문제인 항목만 5개 이하
3. 각 항목별 파일 경로 명시
4. 왜 문제인지 현재 증상과 연결
5. 이미 반영된 것 / 아직 문제인 것 구분
6. 최소 수정 방향 우선
7. 장기 과제는 맨 마지막에 별도 분리

---

## 좋은 리뷰 예시

- my-trees 첫 진입 지연을 auth polling, boot 중복과 연결해서 설명
- browse 느림을 summary read path, 캐시 miss, degraded response 구조와 연결해서 설명
- editor/my-trees write path가 same-origin `/api` 계약을 지키는지 점검

## 나쁜 리뷰 예시

- “파일이 크다 → 심각”
- “vercel.json은 혼란스럽다 → 삭제”
- “Netlify route gap이 있다 → active fallback parity 구현 필요”
- “번들러가 없으니 지금 당장 도입 필요”
- “Firebase apiKey가 보인다 → 즉시 blocker”

---

## 한 줄 요약

LoveBud 리뷰는 **현재 `main` 기준 + 현재 운영 계약 + 실제 증상 연결 + 최소 수정 우선**으로 수행합니다.
