# LoveBud AI 요청 패턴

이 문서는 사용자가 자연어로 요청했을 때, 에이전트가 어떤 스킬과 절차로 해석해야 하는지 정리합니다.

목표는 다음 두 가지입니다.

1. 사용자는 "스킬 이름"을 몰라도 자연스럽게 요청할 수 있어야 합니다.
2. 새 세션의 에이전트는 요청 문장을 보고 바로 적절한 스킬로 라우팅할 수 있어야 합니다.

## 해석 원칙

1. 사용자가 스킬 이름을 직접 말하지 않아도, 요청 의미가 분명하면 해당 스킬을 먼저 적용합니다.
2. 요청이 기록 보존, 정제 문서 반영, 구현, 검증, 배포 중 무엇인지 먼저 분류합니다.
3. 여러 단계가 섞인 요청이면 기록 보존 → 정제 문서 → 구현/검증 → 배포/커밋 순서로 처리합니다.
4. 사용자가 전체 대화나 파일을 주면, 먼저 raw transcript인지 판단합니다.
5. 사용자가 Codex에게 판단만 원하는지, 실행 에이전트용 구현 지시를 원하는지 함께 해석합니다.

## 요청 패턴 매핑

### 1. 대화 전문 / transcript 처리

이런 요청은 `conversation-archiver`를 먼저 읽습니다.

예시 문장:
- "이 대화 전문 처리해"
- "이 txt를 conversation 문서로 정리해"
- "summary 만들어서 index까지 갱신해"
- "이 세션 기록 archive 해줘"
- "raw transcript인지 보고 편입해줘"

기본 해석:
1. 입력이 raw transcript인지 판별
2. 기존 `docs/conversation/full/`과 중복 확인
3. `skills/conversation-archiver/SKILL.md` 기준으로 intake 또는 maintenance 결정
4. 필요 시 full/summary/index 갱신

### 2. 대화 내용을 정제 문서로 반영

이런 요청은 `project-doc-sync`를 먼저 읽습니다.

예시 문장:
- "이 대화를 docs에 반영해"
- "지금 논의한 내용을 pages 문서에 정리해"
- "product 문서 최신화해"
- "backend 문서 업데이트해"
- "ops 문서 기준으로 정리해"

기본 해석:
1. conversation은 근거 문서로 취급
2. 반영 대상이 `product/pages/backend/ops/reports/plans` 중 무엇인지 분류
3. `skills/project-doc-sync/SKILL.md` 기준으로 정제 문서 갱신
4. 필요 시 관련 인덱스 갱신

### 3. 페이지 문서 작성

이런 요청은 `page-doc-writer`를 먼저 읽습니다.

예시 문장:
- "editor 페이지 문서 써줘"
- "search 페이지 현재 상태 문서화해"
- "이 페이지 QA 결과 docs/pages에 남겨"
- "detail 페이지 구현 상태 정리해"

기본 해석:
1. 대상 페이지와 관련 파일 확인
2. 현재 구현/상태/리스크/데이터/API 연결 정리
3. `docs/pages/<page>.md`와 `pages_index.md` 갱신

### 4. 패치 리뷰 / 검증

이런 요청은 `runtime-patch-review`를 먼저 읽습니다.

예시 문장:
- "이 패치 리뷰해"
- "최근 변경 검증해"
- "deploy 전에 최소 점검해"
- "handoff 전에 문법이랑 링크만 확인해"

기본 해석:
1. 변경 파일이나 최근 커밋 범위 확인
2. `skills/runtime-patch-review/SKILL.md` 기준으로 최소 검증 수행
3. findings 중심으로 결과 정리

### 5. 자산 버전 갱신

이런 요청은 `asset-version-bump`를 먼저 읽습니다.

예시 문장:
- "자산 버전 올려"
- "JS/CSS 바뀌었으니 cache busting 해"
- "배포 전에 ?v= 갱신해"

기본 해석:
1. 변경된 JS/CSS 파일 확인
2. 현재 HTML의 `?v=` 값 확인
3. `skills/asset-version-bump/SKILL.md` 기준으로 갱신

### 6. staging / commit / push

이런 요청은 `git-publish`를 먼저 읽습니다.

예시 문장:
- "이 변경만 커밋해"
- "관련 파일만 stage 해"
- "commit 준비 상태 봐줘"
- "push 가능한지 판단해"

기본 해석:
1. 변경 범위를 명확히 식별
2. 관련 파일만 stage 대상으로 판단
3. `skills/git-publish/SKILL.md` 기준으로 커밋/푸시 절차 진행

### 7. Codex 판단 전용 / 실행 에이전트 전달용 요청

이런 요청은 먼저 `AGENTS.md`의 역할 분리를 확인합니다.

예시 문장:
- "CTO 기준으로만 판단해줘"
- "Codex 역할로 범위와 acceptance만 정해줘"
- "실행 에이전트에게 줄 프롬프트로 바꿔줘"
- "구현 말고 계획/검증만 해줘"
- "이 대화를 실행 모델용 작업 지시로 정리해줘"

기본 해석:
1. 사용자가 Codex의 CTO 판단을 원하는지 확인
2. 구현 자체가 아니라 범위, 우선순위, acceptance criteria, 검증 기준을 정리
3. 필요하면 실행 에이전트용 작업 지시문 형태로 재작성

중요:
- Codex 기본 역할은 계획/판단/검증/리뷰
- 구현/수정/실행의 기본 담당은 실행 에이전트
- 사용자가 명시적으로 요구한 경우에만 Codex가 직접 hands-on 작업 수행

## 복합 요청 패턴

사용자는 종종 여러 단계를 한 문장으로 묶어 요청합니다.

### 패턴 A

예시:
- "이 대화 전문 처리하고 summary 만들고 문서까지 반영해"

해석 순서:
1. `conversation-archiver`
2. `project-doc-sync`

### 패턴 B

예시:
- "이 대화를 기준으로 editor 문서 정리하고 필요한 패치 리뷰까지 해"

해석 순서:
1. `project-doc-sync`
2. `runtime-patch-review`

### 패턴 C

예시:
- "이 수정 끝났으면 자산 버전 올리고 커밋 준비해"

해석 순서:
1. `asset-version-bump`
2. `git-publish`

### 패턴 D

예시:
- "이 대화를 보고 CTO 판단 정리하고, 실행 에이전트용 프롬프트까지 만들어줘"

해석 순서:
1. `AGENTS.md` 역할 분리 확인
2. 필요한 경우 `project-doc-sync` 또는 `conversation-archiver`로 근거 정리
3. Codex 판단 요약
4. 실행 에이전트용 지시문 작성

## 사용자에게 권장할 수 있는 짧은 요청 예시

사용자가 명확하게 요청하고 싶을 때 아래 형태를 써도 됩니다.

- "이 대화 전문을 conversation-archiver 기준으로 처리해"
- "이 논의를 project-doc-sync 기준으로 docs/pages/editor.md에 반영해"
- "이 패치를 runtime-patch-review 기준으로 점검해"
- "JS/CSS 변경분을 asset-version-bump 기준으로 정리해"
- "관련 파일만 git-publish 기준으로 커밋 준비해"
- "Codex 기준으로 판단만 하고 실행 에이전트용 작업 지시로 바꿔줘"

## 에이전트 체크리스트

에이전트는 요청을 받으면 아래 질문으로 점검합니다.

1. 사용자가 파일/대화/문서/패치/배포 중 무엇을 주었는가?
2. 이 요청은 어떤 스킬에 가장 먼저 대응해야 하는가?
3. 스킬 이름을 말하지 않았더라도 의미상 강하게 매칭되는가?
4. 복합 요청이면 순서를 어떻게 나눠야 하는가?
5. 이 요청이 Codex 판단 단계인지, 실행 에이전트 단계인지 분리했는가?

특히 사용자가 "이 대화 처리해"라고만 말해도,
에이전트는 이를 모호한 일반 요청으로 넘기지 말고 먼저 아래를 판단합니다.

1. transcript 정리인가
2. summary 생성인가
3. 정제 문서 반영인가
4. 여러 단계를 함께 요청한 것인가
