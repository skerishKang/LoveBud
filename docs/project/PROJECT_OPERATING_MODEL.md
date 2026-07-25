# Project Operating Model

> **Role-separation source of truth:** `WEB_CTO_WEB_DEVELOPER_LOCAL_VALIDATION.md`  
> **Owner approval:** Issue #3662  
> **Hard-governance precedence:** `../ops/MVP_AGENT_GOVERNANCE.md`

## 목적

이 문서는 LoveBud 프로젝트의 workstream 분류, 승인 구조, 실행 lifecycle, 독립 검토 원칙을 요약합니다.

## Workstream 분류

LoveBud 작업은 필요에 따라 아래 세 workstream으로 분류할 수 있습니다.

- 문서
- UI
- 기능 / 데이터 / 백엔드

이 분류는 작업 내용을 구분하기 위한 것입니다. 별도의 Lead나 실행 모델을 추가하는 역할 체계가 아닙니다.

모든 workstream은 동일한 세 실행 역할을 사용합니다.

```text
Web CTO
Web Developer
Local Validation
```

## 기본 4단계 lifecycle

### 1. Web CTO 작업 계약

Web CTO는 최신 원격 상태를 직접 검증하고 아래를 구현 전에 고정합니다.

- exact base SHA;
- objective와 user-visible outcome;
- non-goals;
- allowed/forbidden paths;
- 구현 형태와 보존해야 할 계약;
- required tests;
- required local/browser/environment evidence;
- protected Issues와 linkage wording;
- stop conditions와 final report format.

### 2. Web Developer 구현

별도 web conversation/context의 Web Developer가:

- feature branch에서 코드와 테스트를 작성하고;
- additive commit을 생성하고;
- Draft PR을 만들거나 갱신하고;
- CI를 확인하며;
- exact SHA/diff/test evidence를 제출합니다.

Web Developer는 최종 제품 승인이나 merge 결정을 하지 않습니다.

### 3. Local Validation

Local Validation은 exact PR head에서:

- focused/regression test;
- build/typecheck/lint;
- Windows/PowerShell 또는 provider-specific 실행;
- database/Docker/local service;
- browser/auth/responsive/console/network 검증;
- pristine-main comparison;
- raw evidence 수집

을 수행합니다.

로컬은 기본 구현자가 아니며, 별도 승인 없는 production-source redesign이나 broad rewrite를 하지 않습니다.

### 4. Web CTO 독립 최종 검토

원래 Web CTO session으로 돌아와 다음을 다시 확인합니다.

- remote exact head;
- actual diff와 changed files;
- allowed scope;
- CI classification;
- local evidence와 tested SHA;
- 보안·개인정보·회귀·성능·UX 위험;
- PR body와 Issue disposition;
- merge 직전 expected head SHA.

최종 판정:

```text
READY
CONDITIONALLY_READY
NOT_READY
```

## 기본 실행 모드

### Mode A — Direct GitHub implementation

기본 모드입니다.

```text
Web CTO contract
→ Web Developer direct branch implementation
→ Draft PR / GitHub CI
→ Local Validation when required
→ Web CTO final review
```

### Mode B — Patch package

직접 GitHub 구현이 부적절하면 Web Developer가 다음을 준비합니다.

```text
files/
changes.patch
MANIFEST.json
APPLY.md
TEST_PLAN.md
REVIEW_NOTES.md
```

Local Validation은 이를 적용하고 실행 증거를 반환합니다.

### Mode C — Local-environment validation loop

로컬 secrets, database, Docker, OS, browser profile, GPU/device/provider tooling이 필요한 경우 사용합니다.

```text
Web Developer implementation
→ Local Validation execution
→ raw failure evidence
→ Web Developer correction
→ Local Validation re-execution
```

## 독립 검토 원칙

동일 production change에서 Web CTO와 Web Developer는 별도 대화/context를 사용합니다.

Web CTO가 prototype, target screenshot, exact copy, patch draft, design token, DOM 명세를 직접 만들 수는 있습니다. 다만 production implementation과 최종 승인 사이에는 별도 Web Developer 구현 또는 독립 검토가 있어야 합니다.

Acceptance criteria와 required tests는 구현 전에 고정하고, 구현 결과에 맞춰 조용히 낮추지 않습니다.

## UI 작업

UI 작업의 기본 흐름:

```text
Web CTO design/prototype
→ user visual-direction judgment
→ Web Developer production implementation
→ Local Validation desktop/mobile/auth/browser evidence
→ Web CTO remote and post-merge Production review
```

Web Developer에게 시각 방향을 임의로 발명하도록 맡기지 않습니다. Web CTO contract에는 필요한 경우 다음을 포함합니다.

- desktop/mobile structure;
- loading/empty/error/loaded states;
- exact copy;
- DOM ownership;
- spacing, token, motion, breakpoint values;
- target screenshot or standalone prototype.

## 병렬 작업

서로 다른 컴퓨터나 세션의 병렬 작업은 다음 조건에서 허용합니다.

- separate branches;
- separate worktrees;
- non-overlapping files 또는 명시적 responsibility boundary;
- remote branch당 active writer 1명;
- push 직전 remote head 확인;
- merge 직전 latest-main 관계 확인.

같은 remote branch를 두 컴퓨터가 동시에 push하지 않습니다.

## 승인권

- 사용자/owner: 제품 방향과 최종 의사결정
- Web CTO: 작업 계약, READY/NOT READY, expected-head merge 판단
- Web Developer: 구현과 CI correction
- Local Validation: 실행과 raw evidence

로컬 테스트 통과나 Web Developer 완료 보고만으로 merge 승인으로 간주하지 않습니다.

## Governance boundary

이 문서는 역할 배분을 정의하며 `MVP_AGENT_GOVERNANCE.md` 외의 새 hard blocker를 추가하지 않습니다.

CI, browser evidence, dirty worktree, expected-head squash merge, secret handling, #1882 보호는 canonical governance를 따릅니다.

## 관련 문서

- [WEB_CTO_WEB_DEVELOPER_LOCAL_VALIDATION.md](./WEB_CTO_WEB_DEVELOPER_LOCAL_VALIDATION.md)
- [ROLE_SESSION_TEMPLATES.md](./ROLE_SESSION_TEMPLATES.md)
- [REPORTING_CHAIN.md](./REPORTING_CHAIN.md)
- [LOCAL_MODEL_WORKFLOW.md](./LOCAL_MODEL_WORKFLOW.md)
- [AGENT_OPERATION_GUARDRAILS.md](./AGENT_OPERATION_GUARDRAILS.md)
- [../ops/MVP_AGENT_GOVERNANCE.md](../ops/MVP_AGENT_GOVERNANCE.md)

Refs #3662.  
Refs #1882 — Keep OPEN.
