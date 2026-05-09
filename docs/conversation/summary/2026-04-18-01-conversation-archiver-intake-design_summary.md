# 2026-04-18-01-conversation-archiver-intake-design

## 핵심 주제
conversation-archiver 스킬의 intake 모드 설계 및 운영 규칙 수립

## 확정 판단
- 스킬을 하나로 유지하되, 내부적으로 2개 모드(intake/maintenance)로 분리运营
- intake 모드의 역할: 새 transcript 파일을 정식 conversation 문서 체계로 편입
  - 파일명 신뢰하지 않음, 본문 분석으로 제목 결정
  - `.txt` → `.md` 승격 허용
  - raw 본문은 수정하지 않음
  - summary 생성 필수
  - index 자동 갱신
- 제목 생성 원칙: 세션의 가장 큰 축 하나만 반영, 나머지 주제는 summary가 받음
- 여러 개 transcript 동시 처리 가능 (각 파일 독립 세션)

## 완료 작업
- [x] conversation-archiver 스킬 문서(SKILL.md)에 intake/maintenance 모드 구조 반영
- [x] `docs/ops/DOC_WORKFLOW.md` 생성 (대화 → 문서 → 구현 작업 흐름)
- [x] `docs/backend/README.md` 생성 (백엔드 문서군 안내)
- [x] `docs/doc_index.md` 갱신 (backend/README.md, DOC_WORKFLOW.md 반영)
- [x] `docs/backend/README.md` → `backend_index.md` rename (1차 검증에서 별도 처리)
- [x] 대화 기록 `260418_0632.txt` → `full/2026-04-18-01-conversation-archiver-intake-design.md` 이동

## 중요 커밋
없음 (현재 세션은 문서/스킬 설계 단계)

## 남은 blocker
- docs/ 하위 폴더 index 생성 필요 (product/, ops/, reports/, archive/)
- 루트 문서 7개 하위 폴더로 이동 필요 (ROADMAP.md, CTO_MVP_HANDOFF.md 등)
- `docs/identity/` 역할 불명확 (3개 파일, product/identity-source/와 중복 가능성)
- `engineering/` 폴더 내용 확인 필요

## 다음 액션
- `project-doc-sync` 스킬로 docs 전체 구조 감사 및 index 생성 계획 수립
- 새로 intake된 대화 파일 5개 처리 (실제 transcript 적용)
- pages/editor.md 문서 작성 (현재 MVP 우선순위 1위)
