# project 문서 인덱스

이 문서군은 LoveBud의 역할, 승인권, 실행 분리, 브랜치, 검증, 보고 체계를 빠르게 찾기 위한 project 허브입니다.

이 문서군은 아래 내용을 다룹니다.

- Web CTO, Web Developer, Local Validation 역할과 승인권
- 세션 시작과 역할별 handoff
- 브랜치 / 리뷰 / 완료 보고 원칙
- 문서·UI·기능 workstream 분류
- 상태 추적 문서 위치
- 검증 warning / blocker 분류 기준
- 에이전트 운영 가드레일과 구현 handoff 기준

장문 정책 본문은 이 인덱스에 두지 않습니다. 상세 기준은 아래 하위 문서로 이동합니다.

> **Governance precedence:** hard blocker, CI classification, browser permission, merge governance는 `../ops/MVP_AGENT_GOVERNANCE.md`가 우선합니다. 이 문서군은 역할 배분과 실행 흐름을 구체화하며 새로운 hard blocker를 추가하지 않습니다.

## 먼저 읽기

1. [WEB_CTO_WEB_DEVELOPER_LOCAL_VALIDATION.md](./WEB_CTO_WEB_DEVELOPER_LOCAL_VALIDATION.md)
2. [ROLE_SESSION_TEMPLATES.md](./ROLE_SESSION_TEMPLATES.md)
3. [PROJECT_OPERATING_MODEL.md](./PROJECT_OPERATING_MODEL.md)
4. [REPORTING_CHAIN.md](./REPORTING_CHAIN.md)
5. [BRANCHING_AND_REVIEW.md](./BRANCHING_AND_REVIEW.md)
6. [LOCAL_MODEL_WORKFLOW.md](./LOCAL_MODEL_WORKFLOW.md)
7. [AGENT_OPERATION_GUARDRAILS.md](./AGENT_OPERATION_GUARDRAILS.md)
8. [TASK_STATUS.md](./TASK_STATUS.md)
9. [VERIFICATION_AND_EVIDENCE.md](./VERIFICATION_AND_EVIDENCE.md)
10. [VERIFICATION_WARNING_CATALOG.md](./VERIFICATION_WARNING_CATALOG.md)

## 하위 문서 안내

- [WEB_CTO_WEB_DEVELOPER_LOCAL_VALIDATION.md](./WEB_CTO_WEB_DEVELOPER_LOCAL_VALIDATION.md)  
  Issue #3662에서 승인된 기본 실행 모델입니다. Web CTO 계약 → 별도 Web Developer 구현 → Local Validation → Web CTO 독립 최종 검토의 역할, 실행 모드, 증거, 병렬 작업, patch-package 기준을 정리합니다.

- [ROLE_SESSION_TEMPLATES.md](./ROLE_SESSION_TEMPLATES.md)  
  Web CTO, Web Developer, Local Validation 세션을 시작하거나 복구할 때 사용하는 copy-ready 템플릿을 제공합니다.

- [PROJECT_OPERATING_MODEL.md](./PROJECT_OPERATING_MODEL.md)  
  project workstream과 승인 구조, 4단계 실행 lifecycle, 독립 검토 원칙을 요약합니다.

- [REPORTING_CHAIN.md](./REPORTING_CHAIN.md)  
  사용자/owner, Web CTO, Web Developer, Local Validation 사이의 고정 보고선과 산출물 흐름을 정리합니다.

- [BRANCHING_AND_REVIEW.md](./BRANCHING_AND_REVIEW.md)  
  `main` 우선 확인, 직접 `main` 수정 금지, 병렬 작업 충돌 대응, 리뷰/검증/완료 보고 원칙을 정리합니다.

- [LOCAL_MODEL_WORKFLOW.md](./LOCAL_MODEL_WORKFLOW.md)  
  Local Validation이 exact PR head에서 테스트·브라우저·인증·환경 증거를 수집하는 기준과 허용된 최소 변경 범위를 정리합니다.

- [AGENT_OPERATION_GUARDRAILS.md](./AGENT_OPERATION_GUARDRAILS.md)  
  file inspection과 secret 노출의 경계, browser evidence level, parallel prompt hygiene, 범위 밖 입력, 역할별 handoff 기준을 정리합니다.

- [TASK_STATUS.md](./TASK_STATUS.md)  
  작업 상태를 추적하기 위한 상태 필드, 템플릿, 항목 관리 기준을 제공합니다.

- [VERIFICATION_AND_EVIDENCE.md](./VERIFICATION_AND_EVIDENCE.md)  
  검증 및 증빙 기준, 실도메인 우선 원칙, 보고서 작성 기준을 정리합니다.

- [VERIFICATION_WARNING_CATALOG.md](./VERIFICATION_WARNING_CATALOG.md)  
  UI/production/test preview 검증 중 반복 관찰되는 warning과 blocker의 분류 기준, 보고 형식, 환경 원칙을 정리합니다.

## 관련 허브 문서

- [../doc_index.md](../doc_index.md)
- [../ops/ops_index.md](../ops/ops_index.md)
- [../ops/MVP_AGENT_GOVERNANCE.md](../ops/MVP_AGENT_GOVERNANCE.md)
- [../ops/DOC_WORKFLOW.md](../ops/DOC_WORKFLOW.md)
- [../ops/PR_CHECKLIST.md](../ops/PR_CHECKLIST.md)

## 사용 원칙

- 이 문서는 project 문서군 진입 허브로 짧게 유지합니다.
- 역할 분리와 handoff source of truth는 `WEB_CTO_WEB_DEVELOPER_LOCAL_VALIDATION.md`를 따릅니다.
- copy-ready 시작 프롬프트는 `ROLE_SESSION_TEMPLATES.md`를 사용합니다.
- 전체 project 운영 요약은 `PROJECT_OPERATING_MODEL.md`를 따릅니다.
- 실행 체크리스트는 `../ops/PR_CHECKLIST.md`를 따릅니다.
- 문서 생산 흐름은 `../ops/DOC_WORKFLOW.md`를 따릅니다.
- 상태 관리 본문은 `TASK_STATUS.md`를 따릅니다.

Refs #3662.  
Refs #1882 — Keep OPEN.
