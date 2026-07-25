# Reporting Chain

> **Owner-approved role model:** Issue #3662  
> **Detailed contract:** `WEB_CTO_WEB_DEVELOPER_LOCAL_VALIDATION.md`

## 목적

이 문서는 LoveBud의 사용자/owner, Web CTO, Web Developer, Local Validation 사이의 보고선과 산출물 흐름을 고정 표현으로 정리합니다.

## 역할

### 사용자 / owner

- 제품 방향과 최종 의사결정을 담당합니다.
- 필요할 때 visual acceptance 또는 merge 승인을 제공합니다.
- 새로운 project-specific hard blocker가 필요하면 traceable approval을 제공합니다.

### Web CTO

- 최신 원격 상태를 직접 확인합니다.
- 작업 계약, 범위, 디자인, acceptance criteria, tests/evidence를 고정합니다.
- 구현과 로컬 검증 후 독립적으로 최종 재검토합니다.
- READY / CONDITIONALLY_READY / NOT_READY를 판정합니다.
- expected head SHA를 확인한 뒤 squash merge를 수행합니다.

### Web Developer

- 별도 web conversation/context에서 구현합니다.
- branch, code, tests, Draft PR, CI correction을 담당합니다.
- exact SHA/diff/test evidence를 제출합니다.
- 최종 merge나 제품 승인을 하지 않습니다.

### Local Validation

- exact PR head에서 local/environment/browser evidence를 수집합니다.
- test, build, auth, responsive, console, network, database, OS/provider 검증을 담당합니다.
- 기본적으로 production source를 설계하거나 broad rewrite하지 않습니다.
- raw evidence와 unverified areas를 보고합니다.

## 고정 보고선

```text
사용자 요구
→ Web CTO 작업 계약
→ Web Developer 구현 보고
→ Local Validation 실행 보고
→ Web CTO 최종 검토
→ 사용자 제품 판단 / expected-head squash merge
```

실패나 수정 필요 시:

```text
Local Validation failure evidence
→ Web Developer correction
→ Local Validation re-test
→ Web CTO final review
```

Web CTO review에서 blocker가 발견되면:

```text
Web CTO NOT_READY
→ Web Developer correction contract
→ CI / Local Validation
→ Web CTO re-review
```

## Workstream 분류

문서, UI, 기능/데이터/백엔드는 workstream 분류입니다.

```text
문서 workstream
UI workstream
기능 / 데이터 / 백엔드 workstream
```

각 workstream마다 별도의 Lead 또는 Local coder 역할을 추가하지 않습니다. 동일한 세 역할을 사용합니다.

```text
Web CTO
Web Developer
Local Validation
```

## 산출물 흐름

### Web CTO → Web Developer

- exact base SHA;
- objective와 user-visible outcome;
- non-goals;
- allowed/forbidden paths;
- implementation shape;
- required tests/evidence;
- protected Issues;
- stop conditions;
- final report format.

### Web Developer → Local Validation

- PR와 remote branch;
- exact head SHA;
- test/build commands;
- browser/auth/viewports;
- expected pass/fail behavior;
- evidence requirements;
- authorized local changes;
- forbidden destructive commands.

### Local Validation → Web CTO

- exact tested SHA;
- clean/dirty state;
- executed commands and counts;
- pristine-main comparison;
- browser/auth/console/network evidence;
- screenshots/artifact references;
- unverified items and environment limitations.

### Web CTO → 사용자

- remote review result;
- CI classification;
- evidence strength;
- remaining risk;
- READY / CONDITIONALLY_READY / NOT_READY;
- merge/Issue disposition.

## 병렬 보고선

병렬 작업은 서로 다른 branches/worktrees/files를 사용합니다.

각 branch는 하나의 active writer만 가져야 합니다. 두 컴퓨터가 같은 remote branch에 동시에 push하지 않습니다.

병렬 작업 보고에는 다음을 포함합니다.

```text
branch
worktree
file ownership
active writer
upstream dependency
merge order
```

## 사용 원칙

- Web Developer 완료 보고는 최종 승인으로 간주하지 않습니다.
- Local Validation PASS는 제품 승인이나 merge 승인이 아닙니다.
- Web CTO는 보고 요약보다 remote SHA, diff, CI, raw evidence를 우선합니다.
- 같은 production change의 Web CTO와 Web Developer는 별도 대화/context를 사용합니다.
- #1882는 보고선과 관계없이 보호되며 `Refs #1882`만 사용합니다.

## 관련 문서

- [WEB_CTO_WEB_DEVELOPER_LOCAL_VALIDATION.md](./WEB_CTO_WEB_DEVELOPER_LOCAL_VALIDATION.md)
- [ROLE_SESSION_TEMPLATES.md](./ROLE_SESSION_TEMPLATES.md)
- [PROJECT_OPERATING_MODEL.md](./PROJECT_OPERATING_MODEL.md)
- [LOCAL_MODEL_WORKFLOW.md](./LOCAL_MODEL_WORKFLOW.md)
- [../ops/MVP_AGENT_GOVERNANCE.md](../ops/MVP_AGENT_GOVERNANCE.md)

Refs #3662.  
Refs #1882 — Keep OPEN.
