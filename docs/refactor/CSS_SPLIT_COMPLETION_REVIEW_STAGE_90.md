# CSS Split Completion Review — Stage 90

**Date:** 2026-05-24
**Main HEAD:** `0bc4e656a9ff0135b8779d3cdb82e2f55544c29f`
**#1505:** OPEN
**PR #1570:** 미접촉

---

## 1. Stage 72~89 CSS Split/Hold 흐름 요약

| Stage | 파일 | 경로 | 결과 |
|-------|------|------|------|
| 76 | editor-canvas-toolbar.css | split | ✅ 7개 파일로 분리 |
| 77 | visitor-viewer-shell.css | split | ✅ 7개 파일로 분리 |
| 79 | editor-overrides.css | hold | cascade override 위험 |
| 80 | editor-detail-edit.css | split | ✅ 4개 파일로 분리 |
| 81 | search-responsive.css | split | ✅ 4개 파일로 분리 |
| 82 | editor-detail-content.css | split | ✅ 4개 파일로 분리 |
| 83 | editor-floating-toolbar.css | split | ✅ 5개 파일로 분리 |
| 84 | editor-responsive.css | split | ✅ 2개 파일로 분리 |
| 85 | editor-status-settings.css | split | ✅ 4개 파일로 분리 |
| 86 | CSS tail audit | hold | 전체 현황 문서화 |
| 87 | editor-memory-form.css | hold | browser smoke 필요 |
| 88 | editor-memory-form.css | hold | smoke/audit 문서화 |
| 89 | gemini-v2/home.css | hold | prototype/variant 경로 |

---

## 2. Split 완료 파일 목록

### Editor CSS (Stages 76, 80, 82, 83, 84, 85)
- editor-canvas-toolbar.css → 7개 하위 파일
- editor-detail-edit.css → 4개 하위 파일
- editor-detail-content.css → 4개 하위 파일
- editor-floating-toolbar.css → 5개 하위 파일
- editor-responsive.css → 2개 하위 파일
- editor-status-settings.css → 4개 하위 파일

### Visitor Viewer CSS (Stage 77)
- visitor-viewer-shell.css → 7개 하위 파일

### Search CSS (Stage 81)
- search-responsive.css → 4개 하위 파일

**총 9개 파일 → 37개 하위 파일로 분리**

---

## 3. Hold 유지 파일 목록

### High Risk — Cascade/Runtime
- editor-overrides.css (385줄) — Stage 79 hold, cascade override 위험
- editor-memory-form.css (442줄) — Stage 87/88 hold, browser smoke 필요
- editor-canvas.css (298줄) — editor canvas core, runtime 연결

### Medium Risk — Prototype/Variant
- gemini-v2/home.css (263줄) — prototype/variant 경로
- gemini-v2/detail.css (200줄) — prototype/variant 경로
- gemini-v2/search.css (199줄) — prototype/variant 경로
- gemini-v3/index.css (207줄) — prototype/variant 경로
- gemini-v3/search.css (149줄) — prototype/variant 경로
- gemini-v3/detail.css (136줄) — prototype/variant 경로
- gpt-v2/common.css (370줄) — prototype/variant 경로

### Low Risk — Under 200 Lines
- 200줄 미만 파일은 원칙적으로 split하지 않음

---

## 4. Browser Smoke 필요한 파일 목록

| 파일 | 줄 수 | 사유 |
|------|-------|------|
| editor-memory-form.css | 442 | form open/close, canvas suppression, animation |
| editor-canvas.css | 298 | canvas state transitions |
| editor-overrides.css | 385 | cascade precedence |

---

## 5. Prototype/Variant 경로로 Hold한 파일 목록

| 파일 | 줄 수 | 경로 |
|------|-------|------|
| gemini-v2/home.css | 263 | css/gemini-v2/ |
| gemini-v2/detail.css | 200 | css/gemini-v2/ |
| gemini-v2/search.css | 199 | css/gemini-v2/ |
| gemini-v3/index.css | 207 | css/gemini-v3/ |
| gemini-v3/search.css | 149 | css/gemini-v3/ |
| gemini-v3/detail.css | 136 | css/gemini-v3/ |
| gpt-v2/common.css | 370 | css/gpt-v2/ |

---

## 6. 200줄 이하 과분리 금지 기준

- 100줄 미만: 원칙적으로 split하지 않음
- 100~200줄: 책임이 명확히 3개 이상일 때만 split
- 과분리 기준: 파일 수 증가 대비 가독성/유지보수 개선이 없는 경우

---

## 7. editor-overrides.css Hold 유지 사유

- Stage 79에서 hold 결정
- cascade override 성격 — split 시 우선순위 변경 위험
- multiple editor component overrides 포함
- CSS specificity chain 분석 필요

---

## 8. editor-memory-form.css Browser Smoke 필요 사유

- `.canvas-area.is-memory-form-open` — editor runtime state selector
- `.sidebar-memory-form-open .canvas-area` — body prefix selector
- `@keyframes skeleton-shimmer` — animation 의존성
- `@keyframes newNodePulse` — animation 의존성
- `!important` 1곳 — canvas suppression
- form modal open/close → canvas suppression behavior 연결

---

## 9. gemini-v2/gpt-v2 계열 Hold 사유

- prototype/reference/demo/variant 경로
- 운영 프로덕션과 분리된 실험 코드
- split 대상이 아닌 유지보수 대상

---

## 10. 남은 장기 과제

1. editor-memory-form.css browser smoke 테스트 후 split 검토
2. editor-overrides.css cascade specificity 분석
3. editor-canvas.css runtime 연결 분석
4. 200줄 이하 파일 최적화 (split이 아닌 consolidation 검토)

---

## 11. #1505 OPEN 유지 메모

#1505는 CSS split refactoring 이슈로, 현재 split 작업은 사실상 완료 단계.
남은 파일들은 hold/smoke 필요/prototype 경로로 분류되어 즉시 split 대상이 아님.
#1505는 OPEN 상태를 유지하되, 추가 split은 별도 판단 후 진행.

---

## 12. PR #1570 미접촉 메모

PR #1570은 별도 이슈로, CSS split refactoring과 무관.
이번 Stage에서 건드리지 않음.
