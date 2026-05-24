# Issue #1505 Follow-up Backlog — Stage 92

**Date:** 2026-05-24
**Main HEAD:** `28d7ea9254040e2e1fbed0388479b47c71e84c3f`
**#1505:** OPEN
**PR #1570:** 별도 open PR, 미접촉

---

## 1. Stage 72~91 주요 완료 내역 요약

| Stage | 작업 | 결과 |
|-------|------|------|
| 72 | search-preview-sidebar.css split | ✅ |
| 73 | search-tree-card.css split | ✅ |
| 74 | CSS tail candidates audit | 문서화 |
| 75 | intro-how-to.css split | ✅ |
| 76 | editor-canvas-toolbar.css split | ✅ |
| 77 | visitor-viewer-shell.css split | ✅ |
| 79 | editor-overrides.css audit | hold |
| 80 | editor-detail-edit.css split | ✅ |
| 81 | search-responsive.css split | ✅ |
| 82 | editor-detail-content.css split | ✅ |
| 83 | editor-floating-toolbar.css split | ✅ |
| 84 | editor-responsive.css split | ✅ |
| 85 | editor-status-settings.css split | ✅ |
| 86 | CSS tail audit 문서화 | 문서화 |
| 87 | gpt-v2/common.css audit | hold |
| 88 | editor-memory-form.css smoke/audit | hold |
| 89 | gemini-v2/home.css + landscape audit | hold |
| 90 | CSS split completion review | 문서화 |
| 91 | completion readiness review | 문서화 |

---

## 2. CSS Split 완료 파일 목록 (11개)

| # | 파일 | Stage | 하위 파일 수 |
|---|------|-------|-------------|
| 1 | search-preview-sidebar.css | 72 | 분리 완료 |
| 2 | search-tree-card.css | 73 | 분리 완료 |
| 3 | intro-how-to.css | 75 | 분리 완료 |
| 4 | editor-canvas-toolbar.css | 76 | 7개 |
| 5 | visitor-viewer-shell.css | 77 | 7개 |
| 6 | editor-detail-edit.css | 80 | 4개 |
| 7 | search-responsive.css | 81 | 4개 |
| 8 | editor-detail-content.css | 82 | 4개 |
| 9 | editor-floating-toolbar.css | 83 | 5개 |
| 10 | editor-responsive.css | 84 | 2개 |
| 11 | editor-status-settings.css | 85 | 4개 |

---

## 3. Hold 유지 파일 목록

| 파일 | 줄 수 | hold 사유 |
|------|-------|-----------|
| editor-overrides.css | 385 | cascade override 위험 |
| editor-memory-form.css | 442 | browser smoke 필요 |
| editor-canvas.css | 298 | editor canvas core, runtime 연결 |
| gemini-v2/home.css | 263 | prototype/variant 경로 |
| gemini-v2/detail.css | 200 | prototype/variant 경로 |
| gemini-v2/search.css | 199 | prototype/variant 경로 |
| gemini-v3/index.css | 207 | prototype/variant 경로 |
| gemini-v3/search.css | 149 | prototype/variant 경로 |
| gemini-v3/detail.css | 136 | prototype/variant 경로 |
| gpt-v2/common.css | 370 | prototype/variant 경로 |
| global-header.css | 678 | 전역 헤더, 분리 대상 아님 |
| global.css | 556 | 전역 스타일, 분리 대상 아님 |

---

## 4. 후속 이슈 후보 1: editor-memory-form.css Browser Smoke and Split Readiness

### 제목 (초안)
`editor-memory-form.css browser smoke test and split readiness`

### 범위
- editor page auth-gated load 테스트
- form modal open/close 동작 확인
- canvas suppression state transition 확인
- animation 동작 확인 (skeleton-shimmer, newNodePulse)
- smoke 통과 시 split 검토
- smoke 실패 시 추가 hold 사유 문서화

### 금지 사항
- browser smoke 없이 split 금지
- canvas suppression behavior 변경 금지
- animation 동작 변경 금지
- form modal UX 변경 금지

### 우선순위
중 — #1505 종료 전 완료 권장

---

## 5. 후속 이슈 후보 2: editor-overrides.css Cascade Specificity Audit

### 제목 (초안)
`editor-overrides.css cascade specificity audit and split feasibility`

### 범위
- cascade specificity chain 분석
- override precedence 변경 없이 분리 가능한지 검증
- 분리 시 회귀 테스트 필수
- 분리 불가능 판단 시 hold 유지 사유 문서화

### 금지 사항
- cascade precedence 변경 금지
- specificity 변경 금지
- override 순서 변경 금지
- browser smoke 없이 split 금지

### 우선순위
저 — #1505 종료 후 검토 가능

---

## 6. 후속 이슈 후보 3: Remaining Editor CSS Browser-Smoke Backlog

### 제목 (초안)
`remaining editor CSS browser-smoke backlog`

### 범위
- editor-canvas.css (298줄) runtime 연결 분석
- 기타 editor CSS browser smoke 필요 파일 식별
- smoke 테스트 결과에 따라 split/hold 결정

### 금지 사항
- browser smoke 없이 split 금지
- editor runtime 변경 금지
- canvas behavior 변경 금지

### 우선순위
저 — 장기 과제

---

## 7. #1505 종료 전 체크리스트

- [ ] editor-memory-form.css browser smoke 통과
- [ ] editor-overrides.css cascade 분석 완료
- [ ] 분리된 11개 파일의 프로덕션 회귀 확인
- [ ] Cloudflare Pages 프로덕션 배포 후 안정성 확인
- [ ] PR #1570 정리 (별도 이슈)
- [ ] 후속 이슈 생성 및 분리

---

## 8. PR #1570 상태

PR #1570은 CSS split refactoring과 무관한 별도 이슈.
#1505 종료와 관계없이 별도 관리해야 함.
이번 Stage에서 건드리지 않음.

---

## 9. #1505 종료 전 readiness 판단

**현재 상태:** 종료 가능하나 보류

**종료 가능 조건 충족:**
- ✅ 11개 CSS 파일 split 완료
- ✅ 문서화 완료
- ✅ hold 파일 분류 완료
- ✅ 후속 이슈 후보 정리 완료

**종료 보류 사유:**
- ❌ editor-memory-form.css browser smoke 미완료
- ❌ editor-overrides.css cascade 분석 미완료

**권장:**
- #1505는 OPEN 유지
- 후속 이슈를 별도로 생성
- browser smoke 완료 후 종료 검토

---

## 10. 이번 Stage에서 #1505를 닫지 않는다는 메모

이 문서는 #1505의 후속 이슈 백로그와 종료 전 체크리스트를 정리하는 문서입니다.
#1505는 이 Stage에서 닫지 않습니다.
close/fix/resolve keyword를 사용하지 않습니다.
