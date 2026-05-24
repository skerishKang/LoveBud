# Stage 79 — editor-overrides.css Split Audit / Hold Decision

## 1. 대상 파일

```
css/editor/editor-overrides.css
```

## 2. 현재 줄 수

**385 lines** (9,673 bytes)

## 3. Import / Link 구조

- 단일 지점: `css/editor.css` line 27 (`@import url("./editor/editor-overrides.css");`)
- HTML 직접 링크 없음 — `css/editor.css`가 `pages/editor.html`에서 `<link>`로 로드됨
- Import 순서: **18개 import 중 17번째 (2번째로 마지막)**

```
css/editor.css import chain:
  1. editor-base.css
  2. editor-layout.css
  3. editor-sidebar.css
  4. editor-canvas.css
  5. editor-canvas-toolbar.css
  6. editor-floating-toolbar.css
  7. editor-mobile-action-bar.css
  8. editor-memory-form.css
  9. editor-detail-panel.css
 10. editor-detail-content.css
 11. editor-detail-actions.css
 12. editor-detail-edit.css
 13. editor-responsive.css
 14. editor-mode-selection.css
 15. editor-status-settings.css
 16. editor-memory-edit.css
 17. editor-overrides.css  ← HERE (385 lines)
 18. editor-responsive-tail.css
```

## 4. Selector 책임 범위

파일 내 두 가지 그룹:

### Group A — Legacy Sidebar/Status Panel (lines 1-86, ~22%)
- `.sidebar-btn`, `.sidebar-btn-primary`, `.sidebar-btn-primary:hover`
- `.btn-icon`, `.btn-label`
- `.editor-status-card` (gradient background)
- user-select overrides: `.editor-status-card, .detail-panel, .memory-node`

### Group B — Editor Paper Tone Pass 3 (lines 88-385, ~78%)
- **1. Base Layout & Backgrounds**: `body .editor-layout`, `body .sidebar`, `body .detail-panel`, `body .canvas-area`
- **2. Left Status Card**: `body .editor-status-card`, `body .editor-tree-quiet-note`
- **3. Node Card**: `body .node-card`, `body .node-img-wrapper`
- **4. Right Detail Cards**: `body .editor-current-moment-card`, `body .diary-note`
- **5. Button/Chip/Pill**: `body .editor-tree-visibility-pill`, `body .editor-mini-setting-btn`
- **6. Mobile Polish**: `@media (max-width: 375px)` block
- **Presentation overrides** (extracted from `pages/editor.html`): `.editor-layout`, `.sidebar`, `.detail-panel`, `.canvas-area`, `.editor-status-card`, `.editor-rename-btn`, `.editor-title-settings-panel`, `.editor-tree-quiet-note`, `.editor-canvas-empty-guide__desc` 외

## 5. Cascade Override 성격

**이 파일의 본질은 "override" 그 자체입니다.**

| 패턴 | 예시 | 위험 |
|------|------|:----:|
| `body` prefix | `body .editor-layout { background: ... }` | 이전 import의 `.editor-layout` 정의를 덮어씀 |
| `!important` | `display: none !important` (6회), `display: inline-flex !important` (3회), `display: grid !important` | 분리 시 우선순위 충돌 |
| 동일 셀렉터 중복 | `.editor-status-card`가 Group A(line 63)와 Group B(line 287)에 각각 정의됨 | 같은 파일 내에서도 override chain이 있음 |
| `@media` 내 override | `@media (max-width: 375px)`에서 `.editor-layout`, `.sidebar` 재정의 | 반응형 브레이크포인트와 결합된 override |

## 6. Split Hold 판단

> **HOLD — 분리하지 않는다.**

## 7. Hold 이유

1. **Override 전용 파일**: 이름부터 "overrides"이며, 의도적으로 import chain 마지막에 배치됨. 분할된 파일로 쪼개면 cascade 순서 보장이 어려움.

2. **`body` prefix 패턴**: 다수의 셀렉터가 `body` 접두사로 특이도를 높여 이전 정의를 덮어씀. 원위치 분배 시 `.body .editor-layout`을 `editor-layout.css`로 옮기면 기존 정의와 충돌하거나 순서 의존성이 생김.

3. **`!important` 의존성**: 10회 이상의 `!important` 선언이 cascade override를 강제. 분리 시 어느 파일이 우선하는지 예측 불가능.

4. **동일 셀렉터의 파일 내 중복**: `.editor-status-card`가 같은 파일 안에서 두 번 정의됨(lines 63, 287). 두 번째 정의가 첫 번째를 override함. split 시 이 관계가 유지되지 않음.

5. **Paper tone pass 3는 cohesive theme**: 1~6번 섹션이 하나의 시각적 테마(종이/스크랩북 질감)를 구성. 분리 시 일관성이 깨질 위험.

6. **Editor 회귀 위험**: Editor는 LoveBud의 핵심 화면. CSS split 오류가 시각적 회귀를 일으키면 사용자 경험에 직접 영향.

## 8. Editor 회귀 위험

| 위험 항목 | 설명 | 심각도 |
|-----------|------|:------:|
| Layout 깨짐 | `.editor-layout` background/간격 override 분리 시 전체 레이아웃 변형 | 🔴 High |
| Node Card 시각적 회귀 | `.node-card`, `.node-img-wrapper` override 분리 시 카드 디자인 붕괴 | 🟠 Medium |
| Detail Panel UI 깨짐 | `.editor-rename-btn`, `.editor-title-settings-panel` 등 버튼/패널 스타일 | 🟠 Medium |
| Mobile 반응형 깨짐 | `@media (max-width: 375px)` override 분리 시 모바일 레이아웃 붕괴 | 🔴 High |
| user-select 동작 | `.memory-node`의 user-select: none 분실 시 드래그/선택 동작 변경 | 🟡 Low |
| Sidebar 버튼 스타일 | `.sidebar-btn` 계열 분리 시 sidebar 버튼 시각적 회귀 | 🟡 Low |

## 9. 분리 시 필요한 추가 계약 테스트

Hold 상태이므로 즉시 필요한 테스트는 없으나, 향후 분리를 고려할 경우 필요한 테스트:

1. **Cascade order contract**: 각 셀렉터가 어떤 import 순서에 의존하는지 문서화
2. **Specificity regression test**: `body` prefix 제거 후에도 시각적 동등성 보장
3. **!important audit**: 모든 `!important` 선언의 필요성과 대체 방안 문서화
4. **Visual regression test suite**: Editor 주요 영역(사이드바, 캔버스, 디테일 패널, 모바일)의 스크린샷 비교
5. **@media query isolation test**: 반응형 override 분리 시 브레이크포인트별 일관성 확인

## 10. 다음 Stage 추천

### 1순위: `css/editor/editor-memory-edit.css` (Stage 80)
- 62 lines (small)
- 독립적인 memory edit 기능 스타일
- override/cascade 의존성 낮음
- editor-memory-form-payload / editor-memory-form-preview 편집 관련 스타일

### 2순위: `css/editor/editor-detail-edit.css` (Stage 80-81)
- Editor detail 편집 모드 스타일
- editor-overrides.css와의 중복 셀렉터 가능성 확인 필요

### 3순위 (보류): `css/editor/editor-overrides.css`
- Stage 79 audit이 hold 판정한 파일
- 향후 분리 시 반드시 editor browser smoke verification 선행

## 11. #1505 OPEN 유지

- Issue #1505는 계속 OPEN 상태로 유지
- close/fix/resolve keyword 사용하지 않음
