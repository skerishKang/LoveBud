# LoveBud 에이전트 작업 기준

이 문서는 LoveBud 저장소에서 여러 작업자와 에이전트가 같은 기준으로 판단하고 협업하기 위한 운영 기준입니다.

문서 작업, 코드 작업, 검증 작업 모두 **현재 GitHub `main` 기준 확인**을 먼저 수행해야 합니다.

---

## 1. 최상위 원칙

1. **현재 `main`을 먼저 읽습니다.**
2. **추정하지 않습니다.**
3. **최소 수정 원칙을 유지합니다.**
4. **요청 범위를 넘는 변경을 하지 않습니다.**
5. **문서와 코드의 source of truth를 구분합니다.**
6. **다른 에이전트와 병렬 작업 중일 수 있음을 전제로 행동합니다.**

중요:
- 사용자가 특정 파일, 특정 화면, 특정 역할만 지정하면 그 범위를 넘기지 않습니다.
- 충돌 가능성이 높으면 임의 확장보다 즉시 보고를 우선합니다.

---

## 2. 제품 / 브랜드 source of truth

제품과 UX 판단이 필요할 때 아래 문서를 최우선으로 봅니다.

1. `docs/product/PRODUCT_IDENTITY.md`
2. `docs/product/BRAND_EXPERIENCE.md`
3. `docs/design/UI_DESIGN_SYSTEM.md`

이 세 문서는 LoveBud / LoveTree의 **제품 정체성, 브랜드 감성, UI 판단 기준**의 source of truth입니다.

---

## 3. 현재 서비스 / 인프라 기준

### 실서비스 주소
- `https://lovebud.pages.dev/`

### 인프라 우선순위
1. **Modal**
2. **Cloudflare Pages**
3. **Vercel**
4. **Netlify**

### 운영 해석 원칙
- Modal은 browse summary, compute, read-heavy 처리의 최우선 계층입니다.
- Cloudflare Pages는 실서비스 프론트 및 same-origin `/api` 진입점입니다.
- Vercel은 upstream / secondary entry / 전이기 보조 계층입니다.
- Netlify는 주경로가 아니라 fallback 또는 단계적 제거 대상입니다.

### 브라우저 API 원칙
- 사용자 브라우저는 가능하면 **same-origin `/api`**만 사용합니다.
- 프론트는 직접 특정 외부 호스트를 기본값으로 가정하지 않습니다.
- 공식 사용자-facing 주소는 `pages.dev` 기준으로 설명합니다.

### UI 검증 환경 우선순위

LoveBud UI 작업에서는 로컬 정적 서버를 최종 검증 환경으로 자동 가정하지 않습니다.

PR 병합 전 UI 검증 우선순위는 아래와 같습니다.

1. **Cloudflare Pages PR Preview URL**
2. **해당 작업을 위해 이미 확보한 테스트/프리뷰 페이지 URL**
3. **로컬 서버** — 정적 레이아웃 참고용 fallback

중요:
- `https://lovebud.pages.dev/`는 병합 전 PR 검증 기준이 아닙니다. production 도메인은 현재 `main`을 반영하므로, 아직 병합되지 않은 PR branch의 source of truth가 될 수 없습니다.
- production 도메인 검증은 PR이 `main`에 병합되고 배포된 뒤 수행합니다.

아래 화면/흐름은 로컬 정적 서버 단독으로 최종 판단하지 않습니다.

- Browse / Search 페이지
- Editor 페이지
- My Trees 페이지
- Auth-gated 페이지
- `/api/*`를 호출하는 모든 페이지
- Cloudflare Pages Functions에 의존하는 페이지
- Modal upstream에 의존하는 페이지
- Firebase authentication 또는 session state에 의존하는 페이지

이런 화면에서는 로컬 서버 결과를 참고로만 사용하고, 병합 전 최종 판단은 Cloudflare Preview 또는 준비된 테스트/프리뷰 URL 기준으로 수행합니다.

UI 검증 프롬프트를 작성하기 전 반드시 아래를 먼저 판단하고 명시합니다.

- 정적-only 페이지인가?
- `/api/*`를 호출하는가?
- 인증 또는 세션 상태가 필요한가?
- Cloudflare Functions 또는 Modal에 의존하는가?
- 이미 확보한 테스트/프리뷰 URL이 있는가?
- Cloudflare PR Preview URL이 있는가?

---

## 4. 제품 / 용어 해석 가드레일

### LoveBud vs LoveTree
- **LoveBud**는 현재 저장소명과 운영 프로젝트명입니다.
- **LoveTree**는 사용자-facing 브랜드 경험과 서비스 맥락에서 함께 쓰일 수 있는 이름입니다.
- 문서와 보고에서는 두 이름을 섞어 쓰더라도, 저장소/운영 맥락인지 제품/브랜드 맥락인지 구분해서 씁니다.

### browse vs search
- 파일/페이지 경로명은 현재 실제 파일 기준으로 `pages/search.html`을 사용합니다.
- 사용자-facing 표현은 가능하면 `둘러보기`, `browse`, `감상 허브` 계열을 우선합니다.
- 즉, **search는 구현 경로명**, **browse는 제품 경험명**으로 다룹니다.

### 제품 해석 금지 대상
LoveBud / LoveTree는 다음과 같은 서비스가 아닙니다.

- 관리자 대시보드
- 일반 북마크 정리 툴
- 차가운 데이터 관리 시스템
- 기계적인 워크플로우 편집기
- 범용 커뮤니티 피드

핵심 해석은 아래를 따릅니다.

- 팬 감정 러브트리
- 따뜻한 디지털 스크랩북
- 입덕의 첫 순간 우선
- 감정이 이어진 경로
- public-first visibility와 Plus private storage
- public visibility와 Browse/Search eligibility 분리
- Browse/Search 노출은 `publicMomentCount` 등 별도 소개 기준을 따름

카피와 UI는 가능하면 아래 표현을 선호합니다.

- 순간 이어가기
- 대표 순간
- 이어진 기억
- 감정 흐름
- 첫 순간
- 현재 트리
- 현재 순간

---

## 5. browse display filter vs publication guard

이 둘은 같은 개념으로 취급하지 않습니다.

### browse display filter
- browse / search에서 무엇을 보여줄지 결정하는 **표시 정책**입니다.
- 감상 허브 구성, 공개 트리 노출 기준, 큐레이션 밀도와 관련됩니다.

### publication guard
- 트리를 public으로 전환할 수 있는지 결정하는 **쓰기 가드**입니다.
- 예: 공개 순간 수 부족으로 409를 반환하는 정책

즉:
- browse display filter는 **read / display 문제**
- publication guard는 **write / state transition 문제**

관련 판단은 `docs/engineering/BROWSE_FILTER_VS_PUBLICATION_GUARD.md`를 따릅니다.

---

## 6. 리뷰 가드레일

반복 오판이 많은 항목은 아래 기준을 먼저 적용합니다.

### Firebase Web `apiKey`
- `js/firebase-config.js`의 Firebase Web config는 브라우저 초기화용 설정입니다.
- 값이 코드에 보인다는 사실만으로 **즉시 blocker**로 분류하지 않습니다.
- 보통은 Firebase Console 설정 점검 항목으로 분리합니다.

### `vercel.json`
- 현재 `vercel.json`은 Vercel secondary entry / rewrite 계약의 일부입니다.
- 자동 삭제 후보나 단순 정리 대상으로 분류하지 않습니다.

### 파일 크기 / 번들러 / 컴포넌트화
- 실제 현재 증상과 연결되지 않으면 높은 우선순위로 분류하지 않습니다.
- generic 프론트엔드 교과서식 리뷰를 우선 과제로 올리지 않습니다.

### 이름만 보고 위험 단정 금지
- 파일명만 보고 DB direct access, secret leakage, inactive config를 단정하지 않습니다.
- 반드시 현재 파일 내용과 실제 호출 구조를 확인합니다.

### 참고 문서
- 반복 false positive와 리뷰 규칙은 `docs/engineering/REVIEW_GUARDRAILS.md`를 함께 봅니다.

---

## 7. 현재 페이지 / 경로 기준

문서의 페이지 경로 표기는 실제 저장소 파일 경로를 기준으로 합니다.

- `index.html`
- `pages/intro.html`
- `pages/search.html`
- `pages/detail.html`
- `pages/editor.html`
- `pages/my-trees.html`
- `pages/login.html`

실서비스 주소에서는 위 경로가 Cloudflare Pages를 통해 `/intro.html`, `/search.html`, `/detail.html`, `/editor.html`, `/my-trees.html`, `/login.html`로 노출될 수 있습니다.

---

## 8. 세션 시작 프로토콜

새 작업을 시작할 때 기본 순서는 아래와 같습니다.

1. `AGENTS.md`
2. `docs/doc_index.md`
3. 요청 범위와 직접 관련된 문서 인덱스
4. 제품 판단이 필요하면:
   - `docs/product/PRODUCT_IDENTITY.md`
   - `docs/product/BRAND_EXPERIENCE.md`
   - `docs/design/UI_DESIGN_SYSTEM.md`
5. 운영 판단이 필요하면:
   - `docs/ops/OPERATIONS.md`
   - `docs/migration/VERCEL_MODAL_MIGRATION_RUNBOOK.md`
6. 구현 판단이 필요하면:
   - `docs/engineering/API_CONTRACT.md`
   - 관련 페이지/ops/engineering 문서

대화 복원이 필요하면 아래를 추가로 읽습니다.

- `docs/conversation/summary/summary_index.md`
- 최신 summary 문서

상세한 project 운영 기준은 아래 문서를 따릅니다.

- [docs/project/PROJECT_OPERATING_MODEL.md](docs/project/PROJECT_OPERATING_MODEL.md)
- [docs/project/REPORTING_CHAIN.md](docs/project/REPORTING_CHAIN.md)
- [docs/project/BRANCHING_AND_REVIEW.md](docs/project/BRANCHING_AND_REVIEW.md)
- [docs/project/TASK_STATUS.md](docs/project/TASK_STATUS.md)
- [docs/project/VERIFICATION_AND_EVIDENCE.md](docs/project/VERIFICATION_AND_EVIDENCE.md)

문서 TF 내부 역할선은 `CTO → Document Lead → Document Web`로만 해석합니다.

---

## 9. 작업 방식

### 공통 원칙
- 항상 현재 파일 내용을 먼저 확인합니다.
- 완료 보고에서는 **직접 수정한 것**과 **이미 `main`에 반영돼 있던 것**을 구분합니다.
- 검증은 가능한 범위에서 수행하되, 수행 못한 것은 명시합니다.

### 코드 작업
- 최소 수정 원칙 유지
- 넓은 리팩터링 금지
- 요청 범위 밖 파일 수정 금지
- 코드 로직 변경이 필요하면 관련 문서 기준과 충돌하지 않는지 먼저 확인

### 파일 크기 / 분리 기준

LoveBud는 여러 에이전트가 동시에 검토하고 작업할 수 있도록 작고 검토 가능한 파일을 지향합니다.

권장 목표:
- HTML 파일은 가능하면 500줄 이하로 유지합니다.
- 페이지 전용 CSS 파일은 가능하면 500줄 이하로 유지합니다.
- 공통 CSS 파일은 공통 토큰, 공통 컴포넌트, 공통 레이아웃 기반만 담고 page-specific 스타일을 넣지 않습니다.

주의 기준:
- 500줄을 넘는 HTML/CSS 파일은 다음 작업 전에 분리 가능성을 검토합니다.
- 800줄 이상 파일은 extraction candidate로 분류합니다.
- 1,000줄 이상 파일은 GitHub API / 에이전트 출력이 잘릴 수 있으므로 직접 전체 덮어쓰기나 광범위 수정 대상으로 삼지 않습니다.

분리 원칙:
- 페이지 전용 CSS는 `css/<page>.css`로 분리합니다.
- 공통 스타일만 `css/global.css`에 둡니다.
- inline `<style>` 블록은 가능한 한 페이지 전용 CSS 파일로 이동합니다.
- inline `style="..."` 제거는 style block extraction과 별도 PR로 진행합니다.
- 줄 수를 줄이기 위해 무의미하게 파일을 쪼개지 않습니다. 소유권과 역할이 명확할 때만 분리합니다.
- JS 파일 이동이나 책임 분리는 Issue #72 기준에 따라 별도 audit/승인 후 진행합니다.

### 문서 작업
- 문서 체계, 운영 설명, 읽기 순서, source of truth를 우선 정리
- 오래된 도메인/운영 문구/폐기 경로는 최신 구조로 갱신
- 깨진 문자나 이상한 인코딩 흔적이 보이면 우선 수정 후보로 분류

### 에이전트 실행 위생 규칙

#### Secrets / credentials 취급 규칙

LoveBud 작업에는 배포, API 접근, 테스트 계정, 외부 서비스 연동을 위한 로컬 전용 secrets가 존재할 수 있습니다.

로컬 전용 경로는 아래 repo-relative path로만 언급합니다.

- `.secrets/`
- `.env`
- `.env.*`

이 경로들은 로컬 전용이며, 저장소에 커밋하거나 PR, issue, 문서, 로그, 스크린샷, 보고서에 값을 노출하지 않습니다.

에이전트는 필요한 secret의 **이름이나 위치 정책**은 언급할 수 있지만, 아래 값은 절대 출력하거나 요약하거나 복사하지 않습니다.

- raw token values
- passwords
- private keys
- Firebase Admin SDK JSON contents
- service account JSON contents
- Authorization headers
- cookies
- session tokens
- provider access tokens
- 마지막 8자리 등 token 식별 정보

작업에 secret이 필요하면 에이전트는 값을 요구하거나 출력하지 말고, 필요한 secret name만 말합니다. 실제 값 주입은 사용자가 로컬 환경, provider dashboard, GitHub Actions Secrets, Cloudflare/Vercel/Netlify dashboard 등 적절한 secret store를 통해 처리합니다.

**금지 예시:**

- `.secrets/` 내부 파일 내용을 읽어서 보고서에 붙여넣기
- `.env` 값을 issue/PR/comment에 복사하기
- Firebase Admin SDK JSON 내용을 요약하기
- token의 일부 또는 마지막 8자리를 문서화하기
- 테스트 계정 비밀번호를 AGENTS.md나 docs에 기록하기

**허용 예시:**

- "`.secrets/`는 로컬 전용이며 gitignored 상태여야 한다"고 안내
- "`VERCEL_TOKEN`이 필요하다"고 secret name만 안내
- "Firebase Admin SDK key file은 `.secrets/` 아래 로컬에만 둔다"고 위치 정책만 안내
- "secret 값은 provider dashboard에서 rotate한다"고 절차만 안내

`.secrets/` 또는 `.env*` 파일이 git 추적 대상에 올라온 정황이 있으면 즉시 작업을 중단하고 보고합니다.

#### 로컬 저장소 / 클론 / 프로세스 정리

- 조사만 필요한 작업은 우선 GitHub API, 파일 조회, 검색 기능으로 확인합니다.
- 코드 수정, 테스트, diff 확인, 커밋, push가 필요한 경우에만 로컬 저장소를 사용합니다.
- 로컬 작업 시 매번 새로 clone하지 말고, 가능하면 기존 LoveBud 작업 폴더를 재사용합니다.
- 새 clone이 필요한 경우에는 이유를 보고합니다.
- 작업 시작 전 현재 경로, git remote, 현재 브랜치, 기준 `main` SHA를 확인합니다.
- 작업 후 dev server, test watcher, `bun`, `node`, `playwright`, `vite`, MCP 관련 프로세스가 남지 않도록 종료합니다.
- 작업이 끝난 터미널 세션은 닫고, 불필요한 `node_modules` 재설치나 중복 clone을 피합니다.
- 로컬 환경이 꼬였거나 저장소 위치를 찾지 못하면, 무작정 새 clone을 반복하지 말고 현재 상황을 보고합니다.

#### 붙여넣은 보고서 / 로그 / 대화 처리

- 사용자가 다른 모델의 보고서, 로그, 명령 실행 결과, 대화 내용을 붙여넣으면 단순 요약하지 않습니다.
- 사용자가 “요약해줘”라고 명시하지 않는 한 요약으로 끝내지 않습니다.
- 현재 역할 기준으로 즉시 판단합니다.
- CTO 역할이면 접수, 승인/반려/보류, 근거, 다음 실행 프롬프트, 금지 사항을 제시합니다.
- UI Lead 역할이면 구현 범위, 영향 파일, 검증 항목, UI Web/UI Local 분배를 제시합니다.
- 실행 모델 역할이면 보고서 내용을 현재 작업 결과로 간주할 수 있는지 확인하고, 다음 작업을 수행하거나 금지 단계라면 중단 보고합니다.
- “보고”, “작업 완료”, “검증 완료”, “조사 완료” 같은 내용은 다음 판단을 요구하는 입력으로 봅니다.
- 첨부파일 형태의 마크다운, 로그, 코드도 사용자 메시지 일부로 취급합니다.

#### 이미지 생성 금지

- LoveBud 작업 중 사용자가 “이미지”, “화면”, “레퍼런스”, “캡처”, “디자인”이라는 말을 했다고 해서 이미지 생성을 실행하지 않습니다.
- 사용자가 명시적으로 “이미지를 생성해줘”, “그림을 만들어줘”, “시안을 이미지로 뽑아줘”라고 요청한 경우에만 이미지 생성을 고려합니다.
- 기본값은 이미지 생성이 아니라 분석, 구조화, 구현 범위 판단, 프롬프트 작성입니다.
- 사용자가 이미지를 첨부하면 생성 요청이 아니라 분석 자료로 취급합니다.
- 이미지 기반 요청에서는 화면 구조 분석, 현재 구현과 비교, 빠진 기능/디자인 요소 식별, 구현 우선순위 제안, 작업 프롬프트 작성을 우선합니다.
- 사용자가 명시하지 않은 이미지 생성, 스타일 변환, 새 배경 생성, UI mock 이미지 생성은 금지합니다.

---

## 10. 병렬 작업 안전 규칙

- 다른 에이전트가 동시에 같은 파일을 수정할 수 있습니다.
- 현재 `main`을 읽은 뒤에도 SHA 충돌이 나면, 다시 읽고 최소 범위로 재적용합니다.
- 다른 사람의 흔적을 자동으로 오류라고 단정하지 않습니다.
- 충돌 범위가 커지면 즉시 중단 후 보고합니다.

---

## 11. 변경 / 검증 / 완료 기준

### 변경 규칙
- 최소 수정 선호
- 현재 파일 구조 유지
- 요청 없는 백엔드/아키텍처 확장 금지
- 요청 없는 unrelated 파일 변경 금지

### 검증 규칙
아래를 기본으로 확인합니다.

1. 요청한 결과가 실제로 반영되었는가
2. 관련 없는 동작을 깨지 않았는가
3. 수정 파일이 요청 범위 안에 있는가
4. 검증한 것과 검증하지 못한 것이 분리되어 있는가
5. 제품 감성과 페이지 역할을 해치지 않았는가

UI 검증 환경은 `## 3. 현재 서비스 / 인프라 기준`의 **UI 검증 환경 우선순위**를 반드시 따릅니다. 특히 Browse/Search/Editor/Auth/API 관련 화면은 로컬 서버 단독 결과로 최종 PASS/BLOCKER를 판단하지 않습니다.

### 완료 정의
- 요청된 결과가 반영되었거나 블로커가 명확함
- 검증 여부가 명시됨
- 범위 밖 변경이 없음
- 다음 작업자가 이해할 수 있게 상태가 정리됨

---

## 12. 참고 문서

### 문서 인덱스
- `docs/doc_index.md`
- `docs/ops/ops_index.md`
- `docs/engineering/engineering_index.md`

### 운영 / 배포
- `docs/ops/OPERATIONS.md`
- `docs/ops/DEPLOY_CHECKLIST.md`
- `docs/ops/RUNBOOK.md`
- `docs/migration/VERCEL_MODAL_MIGRATION_RUNBOOK.md`

### 엔지니어링
- `docs/engineering/API_CONTRACT.md`
- `docs/engineering/BROWSE_FILTER_VS_PUBLICATION_GUARD.md`
- `docs/engineering/REVIEW_GUARDRAILS.md`

### 문서 작업 흐름
- `docs/ops/DOC_WORKFLOW.md`
- `docs/ops/SKILL_REGISTRY.md`
- `docs/ops/AI_REQUEST_PATTERNS.md`

---

## 13. 한 줄 요약

LoveBud 작업은 항상 **현재 `main` 확인 → source of truth 확인 → 최소 수정 → 범위 내 검증 → 직접 수정/기존 반영 구분 보고** 순서로 진행합니다.
