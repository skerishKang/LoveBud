# LoveBud 에이전트 헌장

## 목적

`LoveBud`는 LoveBud 서비스 구축 및 운영을 위한 제품 중심 저장소입니다.

이 파일은 사용자와 여러 AI 코딩 에이전트 간의 책임 분담을 정의하여 작업이 세션 간에 일관되게 유지되도록 합니다.

**목표는 명확한 역할 분리입니다:**
- Codex가 기술 방향을 관할합니다.
- 실행 지향 에이전트가 구현 작업을 관할합니다.
- Git/Fossil 히스토리가 깨끗하고 복구 가능하게 유지됩니다.

## 저장소 성격

`LoveBud`는 빠른 속도로 움직이는 MVP 저장소입니다.

원본 프로젝트 참조: `G:\Ddrive\BatangD\task\workdiary\133-relovetree`

이 저장소를 원본 제품 전체를 다시 만드는 장소로 다루지 마십시오.
목표는 좁은 핵심 루프를 빠르게 검증하는 것입니다.

---

## 제품 정체성 가드레일

**이 제품은 다음과 같지 않습니다:**
- 일반 북마크 도구
- 관리자 대시보드
- 범용 커뮤니티 피드
- 기계적인 워크플로우 편집기
- 차가운 데이터 관리 툴

**핵심 정체성:**
- 팬 감정 러브트리
- 따뜻한 디지털 스크랩북
- 입덕의 첫 순간 우선
- 감정이 연결된 경로
- 비공개 우선, 공유는 그 다음

---

## 브랜드/UX 실행 가드레일

LoveTree / LoveBud는 팬페이지 기반 감성 서비스입니다.
주 사용자층은 **10~20대 여성 팬**을 우선 고려하되, 30~40대 여성 및 일부 남성 사용자도 배제하지 않습니다.

에이전트는 UI를 생산성 툴처럼 만들지 않습니다.
우선해야 하는 인상은 다음과 같습니다.

- 감성적
- 발랄함
- 부드러움
- 따뜻함
- 조용한 몰입감
- 팬 경험에 어울리는 관람성

세부 실행 원칙:
- 감상 페이지는 정보 나열보다 **감정 흐름을 따라가는 경험**을 우선합니다.
- 편집 페이지는 단순 입력 폼보다 **트리를 키워가는 경험**을 우선합니다.
- 랜딩은 기능 나열보다 **정체성과 감정 톤**을 먼저 전달해야 합니다.
- `노드 생성`, `워크플로우`, `관리`, `오브젝트 추가` 같은 툴 중심 표현을 남발하지 않습니다.
- 대신 `순간 이어가기`, `대표 순간`, `이어진 기억`, `감정 흐름`, `시작 순간` 같은 표현을 선호합니다.
- affordance는 필요하지만 n8n 같은 기계적 워크플로우 UI를 그대로 모사하지 않습니다.
- `+` 버튼, 연결선, 다음 행동 힌트는 허용되지만, LoveTree답게 더 부드럽고 감성적으로 번역합니다.
- 중복 CTA, 본문 중간의 어색한 전역 버튼, 의미 불명확한 레이블은 몰입을 깨므로 우선 제거 또는 재구성합니다.

상세 기준은 다음 문서를 함께 확인합니다.
- `docs/product/PRODUCT_IDENTITY.md`
- `docs/product/BRAND_EXPERIENCE.md`

---

## 현재 MVP 페이지

- `index.html`
- `search.html`
- `detail.html`
- `editor.html`
- `login.html`

---

## 먼저 읽기

제품 결정을 내리기 전에:

1. `docs/product/PRODUCT_IDENTITY.md`
2. `docs/product/BRAND_EXPERIENCE.md`
3. `docs/product/MVP_SCOPE.md`
4. `docs/product/USER_FLOW.md`

대화 기록을 빠르게 복원하려면:
1. `docs/doc_index.md`
2. `docs/conversation/summary/summary_index.md`
3. 최신 summary 파일

---

## 세션 시작 프로토콜

새 세션을 시작한 에이전트는 작업 전에 아래 순서를 기본으로 따릅니다.

1. `AGENTS.md`
2. `docs/doc_index.md`
3. `docs/conversation/summary/summary_index.md`
4. 최신 summary 파일
5. 제품 판단이 필요하면 `docs/product/PRODUCT_IDENTITY.md`, `docs/product/BRAND_EXPERIENCE.md`, `docs/product/MVP_SCOPE.md`, `docs/product/USER_FLOW.md`
6. 운영/문서/대화 정리 요청이면 `docs/ops/DOC_WORKFLOW.md`
7. 요청 유형이 특정 스킬과 맞으면 해당 `skills/*/SKILL.md`

중요:
- 에이전트는 새 세션에서 "관련 스킬이 있는지 먼저 확인"합니다.
- 스킬이 있으면 자체 추측보다 스킬 절차를 우선합니다.
- 관련 스킬 목록은 `docs/ops/SKILL_REGISTRY.md`에서 먼저 찾습니다.

---

## 스킬 사용 규칙

아래 요청이 들어오면 에이전트는 먼저 해당 스킬을 읽고 그 절차를 따릅니다.

- 대화 전문/raw transcript/세션 기록 정리/summary 생성/index 갱신:
  `skills/conversation-archiver/SKILL.md`
- 대화 내용을 `docs/product/`, `docs/pages/`, `docs/backend/`, `docs/ops/`, `docs/reports/`, `docs/plans/`에 반영:
  `skills/project-doc-sync/SKILL.md`
- 페이지 구현 상태를 페이지 문서로 정리:
  `skills/page-doc-writer/SKILL.md`
- 최근 패치 리뷰, 최소 런타임 검증, handoff 전 점검:
  `skills/runtime-patch-review/SKILL.md`
- JS/CSS 변경 후 정적 자산 버전 갱신:
  `skills/asset-version-bump/SKILL.md`
- 작업 완료 후 선택적 staging/commit/push 정리:
  `skills/git-publish/SKILL.md`

에이전트는 아래 방식으로 행동합니다.

1. 사용자의 요청을 작업 유형으로 분류합니다.
2. 해당 유형과 연결된 스킬이 있으면 먼저 읽습니다.
3. 스킬이 요구하는 입력/출력/검증 절차를 따릅니다.
4. 스킬이 없는 경우에만 일반 판단으로 진행합니다.

사용자가 자연어로 아래처럼 말해도 같은 규칙을 적용합니다.

- "이 대화 전문 처리해"
- "summary 만들어서 index까지 반영해"
- "이 대화 내용을 pages 문서에 반영해"
- "문서 최신화해"
- "이 패치 리뷰해"
- "자산 버전 올려"

자연어 요청 예시는 `docs/ops/AI_REQUEST_PATTERNS.md`를 먼저 확인합니다.

---

## Transcript Intake Protocol

사용자가 `.txt` 또는 `.md` 형태의 대화 전문 파일 처리를 요청하면, 에이전트는 먼저 "그대로 둬도 되는 파일"이라고 단정하지 않습니다.

에이전트는 반드시 아래 순서를 따릅니다.

1. 입력 파일이 실제 raw transcript / conversation 원문인지 판별합니다.
2. `docs/conversation/full/`에 이미 같은 내용이 있는지 중복 여부를 확인합니다.
3. `skills/conversation-archiver/SKILL.md`를 읽고 intake 또는 maintenance 모드를 결정합니다.
4. 필요하면 `.txt`를 `.md`로 승격하고 정식 파일명으로 편입합니다.
5. 필요하면 summary를 생성합니다.
6. 필요하면 `docs/conversation/full/full_index.md`와 `docs/conversation/summary/summary_index.md`를 갱신합니다.

중요:
- `docs/conversation/full/*.txt` 는 단순 보관 파일로 자동 간주하지 않습니다.
- 파일명이 임시 이름이어도 본문이 transcript면 archiver intake 후보로 먼저 봅니다.
- 원문 보존이 우선이며, summary/정제 문서는 별도로 만듭니다.
- conversation 문서군은 기록용이고, 구현 기준 문서는 `docs/pages/`, `docs/product/`, `docs/backend/`, `docs/ops/`에 둡니다.

---

## 핵심 역할

| 역할 | 책임 |
|------|------|
| **사용자** | 최종 의사결정자, 제품 오너 |
| **Codex** | CTO, 기술 리드, 아키텍처, 기획, 검증, 작업 경계 설정 |
| **실행 에이전트** | hands-on 구현, 코딩, 리팩터링, 실행 및 수정 |

### Codex 책임 범위

Codex는 기본적으로 CTO 역할을 수행합니다.

- 해야 하는 일:
  - 코드베이스와 문서를 읽고 현재 상태를 명확히 파악
  - 제품/기술 방향, 우선순위, 범위, acceptance criteria 정의
  - 어떤 문서와 스킬을 먼저 읽어야 하는지 라우팅
  - 구현 결과를 리뷰하고 검증 기준 충족 여부 판단
  - 커밋/푸시 준비 가능 여부 결정
- 기본적으로 하지 않는 일:
  - 직접 구현을 밀어붙이는 hands-on 코딩의 주 역할
  - 대규모 코드 수정의 실행 담당
  - 브라우저 조작, 수동 QA, 반복 수정의 실무 담당

중요:
- 구현, 수정, 실행, 리팩터링의 기본 담당은 **실행 에이전트**입니다.
- Codex는 원칙적으로 **계획/판단/검증/리뷰**를 우선합니다.
- 사용자가 Codex에게 직접 구현을 명시적으로 요청한 경우에만, Codex가 예외적으로 hands-on 작업을 수행할 수 있습니다.

### 실행 에이전트 책임 범위

실행 에이전트는 기본적으로 구현 담당입니다.

- 해야 하는 일:
  - Codex가 정의한 범위와 acceptance criteria를 바탕으로 코드 수정
  - 필요한 테스트, 실행, 리팩터링, UI 수정 수행
  - 구현 결과와 검증 결과를 Codex 또는 사용자에게 보고
- 하면 안 되는 일:
  - 제품 방향이나 아키텍처를 독단적으로 변경
  - 범위를 넓혀 unrelated 변경을 섞어 넣기
  - 검증 없이 완료로 간주하기

---

## 운영 모델

1. Codex가 코드베이스를 읽고 작업을 명확화
2. Codex가 플랜/수락 기준/검증 방법을 정의
3. 실행 에이전트가 코드 변경을 실행
4. Gemini/Codex가 결과 리뷰
5. Codex가 커밋 및 푸시 준비 여부 결정

기본 원칙:
- Codex는 "무엇을, 왜, 어디까지"를 정합니다.
- 실행 에이전트는 "어떻게 구현하고 검증할지"를 수행합니다.
- 사용자가 별도로 지정하지 않았다면, 구현 실행보다 역할 분리 원칙을 우선합니다.

---

## 변경 규칙

- 최소 수정 선호
- 현재 파일 구조 유지
- 명시적 요청 없으면 백엔드 함수 수정 금지
- 명시적 요청 없으면 `js/postgres-client.js` 수정 금지

---

## MVP 통과 기준

1. 집이 제품 정체성을 빠르게 전달합니다
2. `search`에서 메모리를 둘러볼 수 있습니다
3. `detail`이 null/빈 상태로 무너지지 않습니다
4. `editor`가 로그인 가드를 올바르게 적용합니다
5. `editor`가 그럴듯한 트리 상태를 보여줍니다
6. 메모리 생성 후 UI가 일관되게 갱신됩니다

---

## 리뷰 및 검증 규칙

1. 요청한 동작이 의도대로 변경되었는지
2. 관련 없는 동작이 명백히 깨지지 않았는지
3. 변경된 파일이 범위 지정되어 있는지
4. 테스트가 실행되었는지 (또는 이유 명시)
5. 팬 경험과 감정 톤을 해치지 않았는지
6. 감상 페이지 / 편집 페이지 / 랜딩의 역할이 더 명확해졌는지

**패치 검증**: `skills/runtime-patch-review/SKILL.md` 참고

---

## 완료 정의

작업은 다음일 때 완료됩니다:

- 요청된 결과가 구현되거나 블로커가 명확
- 검증이 수행되거나 명시적 건너뛰기
- diff가 범위 지정됨
- 커밋/푸시 상태가 명확히 명시됨
- 다음 에이전트에게 인계 노트가 충분함

---

## 안전 규칙

- 검토되지 않은 관련 없는 변경 푸시 금지
- 명시적 요청 없으면 공유 히스토리 재작성 금지
- 파괴적 git 명령어 무분별 사용 금지
- 명시적 지시 없으면 사용자의 변경 복구 금지

---

## 운영 참고 문서

세부 운영 내용은 다음 문서군을 참조하세요:

- **경로/셸**: `docs/ops/PATHS_AND_SHELLS.md`
- **원격/WSL**: `docs/ops/REMOTE_ACCESS_AND_WSL.md`
- **Git/SSH**: `docs/ops/GIT_SSH_SETUP.md`
- **비밀값**: `docs/ops/LOCAL_SECRETS.md`
- **문서 흐름**: `docs/ops/DOC_WORKFLOW.md`
- **스킬 레지스트리**: `docs/ops/SKILL_REGISTRY.md`
- **요청 패턴**: `docs/ops/AI_REQUEST_PATTERNS.md`
- **배포**: `docs/ops/DEPLOY_CHECKLIST.md`
- **자산 버전**: `skills/asset-version-bump/SKILL.md`

---

## 테스트 수행 원칙

에이전트는 작업 성격에 따라 테스트 환경을 다음과 같이 구분합니다.

1. **시나리오 테스트 (`docs/test-scenarios/`)**
   - **목적**: 실제 사용자 여정 검증, 제품 수준의 QA
311:    - **환경**: 실운영 도메인 (`https://lovebud.vercel.app`)
   - **주의**: 시나리오 문서에 명시된 URL을 최우선으로 따름

2. **개발 및 디버깅 테스트**
   - **목적**: 신규 기능 구현 확인, 500 에러 디버깅, 패치 영향도 평가
   - **환경**: 로컬 서버 (`http://localhost:8888`)
   - **주의**: `AGENTS.md`의 로컬 테스트 지침을 따름

3. **증빙 우선주의 (Evidence First)**
   - **원칙**: 스크린샷 증빙이 없는 PASS 리포트는 **미완성**으로 간주하며, 성공으로 판정하지 않는다.
   - **필수 포함**: 모든 시나리오 테스트 결과 폴더에는 `test-result.md`에서 참조하는 원본 스크린샷(`step-XX.png`)이 반드시 존재해야 한다.
   - **검증**: 에이전트는 리포트 생성 전 `scripts/sync-screenshots.ps1`을 실행하여 실제 파일 존재 여부를 최종 확인한다.

4. **시나리오 정밀도 및 격리 원칙**
   - **클린 스타트 (Clean Start)**: 신규 사용자 및 권한 관련 테스트 시, 에이전트는 반드시 기존 세션을 로그아웃하고 브라우저 저장소(LocalStorage, IndexedDB)를 초기화하여 '순수 신규 상태'임을 보장해야 한다. 가급적 인코그니토 모드를 사용한다.
   - **용어 일치 (Terminology Match)**: 시나리오 문서와 테스트 보고서는 반드시 실제 UI에 표시된 텍스트를 정확히 사용해야 하며, 임의의 요약 표현을 금지한다.

---

## Netlify Dev 로컬 테스트

Functions 500 에러 디버깅 및 로컬 테스트는 Netlify Dev를 사용합니다.

### 설정
- `netlify.toml`에 이미 Functions 디렉토리 설정됨: `netlify/functions`
- 환경변수는 `.env` 파일에서 자동 로드됨
- 사전 점검이 필요하면 `npm run verify:env`를 사용합니다.

### 실행 방법
```bash
# 로컬 개발 서버 실행
npx netlify-cli dev

# 또는
netlify dev
```

### 테스트 URL
- 사이트: `http://localhost:8888`
- Functions: `http://localhost:8888/.netlify/functions/community-memories`

### 디버깅 로그 확인
- 콘솔에서 `[community-memories]`, `[queryMemories]` 등 로그 출력 확인
- `.env`에 `DATABASE_URL`, `FIREBASE_SERVICE_ACCOUNT_JSON` 설정 필요

---

## 문서 규칙

- 인덱스 파일명은 `폴더명_index.md`를 기본으로 사용합니다.
  - 예: `docs/product/product_index.md`, `docs/ops/ops_index.md`
  - 예외: 최상위 인덱스는 `docs/doc_index.md`, conversation은 `full_index.md`/`summary_index.md`
- 상세 내용은 `docs/ops/DOC_WORKFLOW.md` 참고

---

*이 헌장은 저장소의 핵심 원칙을 간략히 정리합니다. 세부 운영은 docs/ops/ 및 관련 스킬 문서를 참조하세요.*
