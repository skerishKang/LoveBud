# Issue #1505 Completion Readiness Review — Stage 91

**Date:** 2026-05-24
**Main HEAD:** `548c322a33cec0e31ddf26e7c0b0401aab65aa18`
**#1505:** OPEN
**PR #1570:** 별도 open PR, 미접촉

---

## 1. Stage 72~90 주요 완료 내역 요약

| Stage | 파일 | 결과 |
|-------|------|------|
| 72 | search-preview-sidebar.css | ✅ split |
| 73 | search-tree-card.css | ✅ split |
| 74 | CSS tail candidates | audit |
| 75 | intro-how-to.css | ✅ split |
| 76 | editor-canvas-toolbar.css | ✅ split |
| 77 | visitor-viewer-shell.css | ✅ split |
| 79 | editor-overrides.css | hold |
| 80 | editor-detail-edit.css | ✅ split |
| 81 | search-responsive.css | ✅ split |
| 82 | editor-detail-content.css | ✅ split |
| 83 | editor-floating-toolbar.css | ✅ split |
| 84 | editor-responsive.css | ✅ split |
| 85 | editor-status-settings.css | ✅ split |
| 86 | CSS tail audit | 문서화 |
| 87 | gpt-v2/common.css | hold |
| 88 | editor-memory-form.css | hold |
| 89 | gemini-v2/home.css + landscape | hold |
| 90 | completion review | 문서화 |

---

## 2. Split 완료 파일 목록 (11개)

### Search CSS (Stages 72, 73, 81)
- search-preview-sidebar.css → 하위 파일로 분리
- search-tree-card.css → 하위 파일로 분리
- search-responsive.css → 4개 하위 파일로 분리

### Intro CSS (Stage 75)
- intro-how-to.css → 하위 파일로 분리

### Editor CSS (Stages 76, 80, 82, 83, 84, 85)
- editor-canvas-toolbar.css → 7개 하위 파일로 분리
- editor-detail-edit.css → 4개 하위 파일로 분리
- editor-detail-content.css → 4개 하위 파일로 분리
- editor-floating-toolbar.css → 5개 하위 파일로 분리
- editor-responsive.css → 2개 하위 파일로 분리
- editor-status-settings.css → 4개 하위 파일로 분리

### Visitor Viewer CSS (Stage 77)
- visitor-viewer-shell.css → 7개 하위 파일로 분리

---

## 3. Hold 유지 파일 목록

| 파일 | 줄 수 | 사유 |
|------|-------|------|
| editor-overrides.css | 385 | cascade override 위험 |
| editor-memory-form.css | 442 | browser smoke 필요 |
| editor-canvas.css | 298 | editor canvas core, runtime 연결 |
| gemini-v2/home.css | 263 | prototype/variant 경로 |
| gpt-v2/common.css | 370 | prototype/variant 경로 |
| global-header.css | 678 | 전역 헤더, 분리 대상 아님 |
| global.css | 556 | 전역 스타일, 분리 대상 아님 |

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

## 6. editor-memory-form.css 후속 조건

- browser smoke 테스트 필수: editor page load → form open → canvas suppression → form close
- animation 동작 확인: skeleton-shimmer, newNodePulse
- canvas suppression state transition 확인
- smoke 통과 시 split 검토 가능
- smoke 실패 시 추가 hold

---

## 7. editor-overrides.css 후속 조건

- cascade specificity chain 분석 필요
- override precedence 변경 없이 분리 가능한지 검증
- 분리 시 회귀 테스트 필수
- 현재로서는 hold 유지 권장

---

## 8. 200줄 이하 과분리 금지 기준

- 100줄 미만: 원칙적으로 split하지 않음
- 100~200줄: 책임이 명확히 3개 이상, 각 50줄 이상일 때만 split
- 과분리: 파일 수 증가 대비 가독성/유지보수 개선이 없는 경우

---

## 9. PR #1570 별도 open PR

PR #1570은 CSS split refactoring과 무관한 별도 이슈.
#1505 종료와 관계없이 별도 관리해야 함.

---

## 10. #1505 종료 전 확인해야 할 항목

1. editor-memory-form.css browser smoke 통과 여부
2. editor-overrides.css cascade 분석 완료 여부
3. 분리된 11개 파일의 하위 파일 통합 테스트
4. Cloudflare Pages 프로덕션 배포 후 회귀 확인
5. PR #1570 정리 (별도 이슈)

---

## 11. 후속 이슈로 분리할 후보

| 이슈 | 내용 | 우선순위 |
|------|------|----------|
| #1505-A | editor-memory-form.css browser smoke + split | 중 |
| #1505-B | editor-overrides.css cascade 분석 | 저 |
| #1505-C | editor-canvas.css runtime 분리 검토 | 저 |
| 별도 | gemini-v2/gpt-v2 prototype 정리 | 비상업용 |

---

## 12. #1505 종료 판단

**현재 상태:** 종료 가능하나 추가 조건 있음

**종료 가능 조건:**
- 11개 파일 split 완료
- 문서화 완료
- hold 파일 분류 완료

**종료 보류 사유:**
- editor-memory-form.css browser smoke 미완료
- editor-overrides.css cascade 분석 미완료
- 프로덕션 회귀 확인 필요

**권장:**
- #1505는 OPEN 유지
- 후속 이슈를 별도로 분리
- browser smoke 완료 후 종료 검토

---

## 13. #1505를 이번 PR에서 닫지 않는다는 메모

이 문서는 #1505 종료 readiness를 검토하는 문서입니다.
#1505는 이 PR에서 닫지 않습니다.
close/fix/resolve keyword를 사용하지 않습니다.
