# 대화 전문 목록

이 폴더에는 LoveBud 대화 기록의 **전문(Full text)**이 저장됩니다.

## 용도
- 세션별 전체 대화 내용을 원본 그대로 보관
- 이후 분석, 재검토,审计용

## 파일 naming 규칙
실제 운영 파일명 형식:
- `YYYY-MM-DD-NN-짧은제목.md` (권장)
- 예: `2026-04-17-01-runtime-stabilization.md`
- `NN`은 해당 날짜의 세션 회차 (01부터 시작)

## 파일 목록

| 날짜 | 파일명 | 설명 |
|------|--------|------|
| 2026-04-18 | [2026-04-18-02-three-model-assignment.md](2026-04-18-02-three-model-assignment.md) | 3개 모델 병렬 작업 분배: editor/detail/search 작업 분할 및 운영 원칙 확정, media.js 확산 검토 |
| 2026-04-17 | [2026-04-17-01-runtime-stabilization.md](2026-04-17-01-runtime-stabilization.md) | 런타임 안정화: i18n 정리, shared-header 복구, API 502 진단, 에셋 버저닝, SSH/Git 연결, 문서 구조 생성 |
| 2026-04-17 | [2026-04-17-02-handoff.md](2026-04-17-02-handoff.md) | 버전 규칙 확정(20260417-31), DB 스키마 매핑 수정, browse 11개 트리 표시 복구 |
| 2026-04-17 | [2026-04-17-03-api-response-unification.md](2026-04-17-03-api-response-unification.md) | 1-2차 API 응답 통일: 백엔드 flat camelCase 표준화, serializers 적용, search.js flatten 로직 수정 |
| 2026-04-16 | [2026-04-16-01-codex-handoff-record.md](2026-04-16-01-codex-handoff-record.md) | Codex 인계 기록: 경로/커밋 규칙, 핵심 판단 정리, DB/public 데이터 상태 |
| 2026-04-16 | [2026-04-16-codex-handoff-rules.md](2026-04-16-codex-handoff-rules.md) | Codex 인계 규칙: 경로/커밋/판단 요약 (Derived) |
| 2026-04-16 | [2026-04-16-03-opencode-db-lock.md](2026-04-16-03-opencode-db-lock.md) | opencode sqlite database is locked 오류 조사 및 WSL/PowerShell 환경 문제 확인 |
| 2026-04-16 | [2026-04-16-04-backend-doc-sync.md](2026-04-16-04-backend-doc-sync.md) | community API 문서 정리 및 seed 데이터 동기화 점검, backend.md 업데이트 |
| 2026-04-16 | [2026-04-16-05-smoke-qa-guide.md](2026-04-16-05-smoke-qa-guide.md) | Netlify 배포본 스모크 QA 검증 가이드 (my-trees → editor → detail 루프) |
| 2026-04-15 | [2026-04-15-01-search-ui-polish.md](2026-04-15-01-search-ui-polish.md) | search/browse UI 개선 검증 및 copy/품질 마감 (카테고리, placeholder, mock 데이터) |
| 2026-04-15 | [2026-04-15-02-editor-night-validation.md](2026-04-15-02-editor-night-validation.md) | editor API 연결 검증 및 fallback 동작 확인, 데이터 구조 호환성 문제 파악 |
| 2026-04-07 | [2026-04-07-01-dispatch-parser-fix.md](2026-04-07-01-dispatch-parser-fix.md) | 배차일보 CSV 파서 구분자 감지 로직 개선 (따옴표 내 탭 문자 문제 해결) |

## 추가 방법
각 세션이 끝날 때마다 위 표에 행을 추가하고, 파일을 이 폴더에 저장하세요.
