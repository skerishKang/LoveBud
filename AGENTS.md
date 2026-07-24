# LoveBud 에이전트 작업 기준

이 문서는 LoveBud 저장소에서 여러 작업자와 에이전트가 같은 기준으로 판단하고 협업하기 위한 운영 기준입니다.

문서 작업, 코드 작업, 검증 작업 모두 **현재 GitHub `main` 기준 확인**을 먼저 수행해야 합니다.

> **Agent guidance hierarchy**
>
> - `docs/ops/MVP_AGENT_GOVERNANCE.md`는 LoveBud 저장소의 **canonical MVP agent governance** source of truth다 (승인 provenance: #3442 comment `4947327550`; CI infrastructure-unavailable amendment: #3642).
> - `AGENTS.md`는 LoveBud 저장소의 **repository-wide canonical agent guidance**다. 단, governance/blocker 판단은 `MVP_AGENT_GOVERNANCE.md`가 우선한다. 충돌 시 canonical policy가 우선한다.
> - 별도 tool-specific instruction file은 **꼭 필요할 때만** 추가한다 (예: 특정 도구의 실제 설정/실행 방법이 필요한 경우).
> - tool-specific 문서는 본 문서의 안전·범위·검증 원칙을 약화시키거나 덮어쓸 수 없다. 충돌 시 본 문서가 우선한다.
> - 문서에 규칙이 존재한다는 사실만으로 owner approval이 증명되지 않는다. 새로운 project-specific 금지·승인·중단 조건은 승인 전까지 권고사항(RECOMMENDATION_ONLY)이다.
> - 현재 `CLAUDE.md`, `CODEX.md`는 **canonical repository instruction source가 아니다**. 새 agent 문서가 필요하면 본 문서 또는 `docs/ops/AGENT_INSTRUCTION_POLICY.md`를 갱신한다.

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

## Current local execution environment

LoveBud 로컬 작업의 **현재 기본 OS는 Windows**다.

1. **Primary OS:** Windows
2. **Primary shell:** PowerShell 7 (`pwsh.exe`). Windows PowerShell 5.1은 필요 시 명시적 fallback만 허용한다.
3. **Primary paths / tools:** Windows 드라이브 경로와 Windows-native executable (`git.exe`, `node.exe`, `npm`, `gh.exe`, `psql.exe`, `pg_dump.exe` 등).
4. 작업 시작 전 실제 shell과 tool resolution을 확인한다 (`Get-Location`, `$PSVersionTable`, `Get-Command`).
5. PowerShell, CMD, bash 문법을 한 작업에서 혼합하지 않는다.
6. 모델 종류(Codex, Kilo, Hermes 등)나 tool 이름만으로 WSL/bash를 추론하지 않는다.
7. **WSL은 현재 task 또는 operator가 명시적으로 승인한 경우에만** 사용한다. 기본 금지.
8. `wsl.exe`, `/mnt/*`, Linux 바이너리는 **implicit fallback이 아니다**.
9. 필수 Windows-native 도구가 없으면 **중단·보고**한다. WSL로 자동 우회하지 않는다.
10. historical WSL 문서(예: `docs/ops/REMOTE_ACCESS_AND_WSL.md`의 과거 기록)는 현재 root guidance를 override하지 않는다.

상세 path/shell source of truth: `docs/ops/PATHS_AND_SHELLS.md`.

이 섹션은 `docs/ops/MVP_AGENT_GOVERNANCE.md`의 governance 권한을 약화시키지 않는다. governance/blocker 판단 충돌 시 canonical policy가 우선한다.

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
- Netlify는 legacy artifact / removal candidate입니다. active production fallback이 아닙니다.

### 브라우저 API 원칙
- 사용자 브라우저는 가능하면 **same-origin `/api`**만 사용합니다.
- 프론트는 직접 특정 외부 호스트를 기본값으로 가정하지 않습니다.
- 공식 사용자-facing 주소는 `pages.dev` 기준으로 설명합니다.

### UI 검증 환경 우선순위

LoveBud의 UI 검증은 **Merge-First Production Verification** 워크플로우를 기본으로 합니다.
자세한 내용은 `docs/ops/MERGE_FIRST_PRODUCTION_VERIFICATION_WORKFLOW.md`를 참고하세요.

핵심 원칙:
- **Merge-first Production verification is the current default.** Pre-merge Preview/fixed-slot deployment is not normally performed (OPTIONAL, used only when explicitly assigned by CTO).
- **Pre-merge browser verification (fixed slot / PR Preview)**: 기본적으로 수행하지 않는다(NOT normally performed, OPTIONAL). CTO가 명시적으로 할당한 경우에만 선택적 추가 증거(optional supplementary evidence)로 활용하며, 부재 시 merge blocker가 아니다.
- 에이전트는 preview URL을 찾거나 Wrangler slot deploy를 시도하지 않는다. CTO가 명시적으로 지정한 경우에만 optional supplementary evidence로 사용한다.
- **Post-merge Production verification**: UI/Auth/runtime 동작의 최종 확인 단계이며, Cloudflare Pages가 main을 Production에 자동 반영한 뒤 https://lovebud.pages.dev/ 에서 로그인한 실제 화면으로 확인한다. 별도의 수동 Production deploy 명령을 실행하는 절차가 아니다.
- **로컬 정적 서버**: 정적 레이아웃 참고용 fallback으로만 사용한다.
- **GitHub CI + 로컬 자동 테스트**: 기본 pre-merge validation이다. 실제 검증 step이 실패한 `CI_EXECUTED_FAILURE`와 정상 실행 중인 `CI_PENDING_EXECUTION`은 merge blocker다. 반면 billing exhaustion, GitHub outage, runner allocation failure 등으로 relevant step이 전혀 실행되지 않은 `CI_UNAVAILABLE_INFRA`는 코드 실패가 아니며 `docs/ops/CI_UNAVAILABLE_INFRA_MERGE_POLICY.md`의 alternative-evidence path를 사용한다.
- `CI_UNAVAILABLE_INFRA`를 이유로 PR 범위와 무관한 Docker, PostgreSQL, browser, preview, production 검증을 기계적으로 추가하지 않는다. 검증은 실제 변경 범위와 위험도에 비례해야 한다.
- 향후 preview/staging-first 방식으로 전환할 때는 owner 승인과 canonical policy 변경이 먼저 필요하다.

Pre-merge browser 환경(Cloudflare Preview, fixed test slot)은 CTO가 명시적으로 할당한 경우에만 선택적 추가 증거로 활용합니다.
환경 부재 시 `NOT_AVAILABLE` / `NOT_USED`로 정직하게 기록하며, PASS로 추정하지 않습니다.

기존의 Wrangler fixed-slot 배포 절차와 브라우저 테스트 슬롯 사용 절차는 `docs/ops/`의 참고 문서로 유지되며,
CTO가 명시적으로 지정한 경우에만 optional supplementary evidence로 사용한다. 해당 절차는 기본적으로 수행하지 않으며, 부재는 merge blocker가 아니다.

아래 화면/흐름은 로컬 정적 서버 단독으로 최종 판단하지 않습니다.
- Browse / Search 페이지
- Editor 페이지
- My Trees 페이지
- Auth-gated 페이지
- `/api/*`를 호출하는 모든 페이지
- Cloudflare Pages Functions에 의존하는 페이지
- Modal upstream에 의존하는 페이지
- Firebase authentication 또는 session state에 의존하는 페이지

이런 화면에서는 로컬 서버 결과를 참고용으로만 사용하고, post-merge Production verification으로 최종 확인합니다.
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
