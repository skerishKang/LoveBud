# Editor Overrides Relocation Audit

> **Status:** Audit-only document. No CSS implementation in this PR.
> **Related Issue:** #137 (`css/editor/overrides.css` cleanup)
> **Precursor:** PR #328 (formatting-only pass)

---

## 1. Purpose

이 문서는 `css/editor/overrides.css`의 role-based relocation **후보**를 구현 없이 문서화합니다.

- Issue #137의 `css/editor/overrides.css` cleanup 후속 audit입니다.
- 이 PR은 **구현 PR이 아닙니다.** relocation 판단 근거와 후보군을 기록하는 문서 PR입니다.
- CSS 파일 이동, selector 통합, property/value 변경은 이 PR 범위 밖입니다.
- PR #328 formatting-only 정리 이후 남은 `#137` editor overrides cleanup의 다음 단계입니다.

---

## 2. Current Known Risk

`css/editor/overrides.css`는 **final cascade override** 역할을 수행합니다. 이 파일을 무리하게 이동하거나 분산하면 editor 렌더링이 깨질 위험이 있습니다.

### 반복 정의 주의 대상 selectors

아래 selector들은 `overrides.css` 내에서 반복 정의되거나 다른 CSS 파일과 충돌 가능성이 있습니다. relocation 전 반드시 inventory 확인이 필요합니다.

| Selector | 주의 사항 |
|---|---|
| `.editor-status-card` | 반복 정의 가능성 |
| `.sidebar` | 전역 범위 충돌 위험 |
| `.detail-panel` | 반복 정의 가능성 |
| `.canvas-area` | layout 의존 cascade |
| `.editor-mini-setting-btn` | 반복 정의 가능성 |
| `.editor-tree-visibility-pill` | 반복 정의 가능성 |

> ⚠️ final cascade override 역할을 하므로 이동 전 반드시 cascade order 보존 검증이 필요합니다.

---

## 3. Candidate Relocation Groups

아래는 `css/editor/overrides.css` 내 규칙들의 **잠재적 역할 분류**입니다. 실제 이동은 이 audit 이후 별도 PR에서 진행합니다.

### A. Component-level rules
- Editor 내 특정 컴포넌트(`.editor-status-card`, `.editor-mini-setting-btn` 등)에만 적용되는 독립적인 스타일
- 후보 대상 파일: `css/editor/components/*.css` 또는 해당 컴포넌트 전용 파일
- 이동 전제 조건: selector inventory 완료, cascade 충돌 없음 확인

### B. Paper-tone / theme pass rules
- 에디터의 paper tone, background, theme 관련 규칙
- 후보 대상 파일: `css/editor/theme.css` 또는 `css/editor/paper.css`
- 이동 전제 조건: 다른 CSS와 theme token 공유 여부 확인

### C. Extracted inline presentation styles
- 원래 HTML inline style에서 추출된 것으로 추정되는 표현 스타일
- 후보 대상 파일: `css/editor/presentation.css` 또는 원 컴포넌트 파일
- 이동 전제 조건: 추출 출처 추적, regression 없음 확인

### D. Final cascade overrides
- **이동 금지 후보.** 다른 모든 CSS 이후 최종 적용되어야 하는 규칙들
- `overrides.css`에 유지하거나, 명확한 주석 표기 후 별도 `final-overrides.css`로만 이동 가능
- 이동 시 cascade order preservation 필수

### E. One-line extracted block formatting history
- 과거 formatting 정리 이력으로 남아 있는 단일 규칙 블록들
- 실제 적용 여부 확인 후 제거 또는 해당 컴포넌트 파일로 이동 가능
- 이동 전제 조건: editor browser smoke 테스트 통과

---

## 4. Non-Goals

이 PR 및 이 문서는 아래 작업을 **포함하지 않습니다.**

- ❌ CSS 파일 이동 없음
- ❌ selector consolidation 없음
- ❌ property/value 변경 없음
- ❌ `pages/editor.html` 변경 없음
- ❌ JS 변경 없음
- ❌ Issue #137 close 없음

---

## 5. Future Implementation Gate

이 audit 이후 실제 relocation을 진행하려면 아래 조건을 모두 충족해야 합니다.

- [ ] **Selector inventory 완료** — role별 이동 전 `overrides.css` 전체 selector 목록화 필요
- [ ] **Cascade order preservation 검증** — 이동 전후 cascade 순서가 동일함을 확인
- [ ] **Editor browser smoke 통과** — 에디터 페이지 전체 기능 브라우저 수동 검증 필요
- [ ] **Fixed slot 또는 Cloudflare Preview 검증** — 실 배포 환경에서 visual regression 없음 확인

> 위 조건 중 하나라도 미충족 시 relocation PR 진행 금지

---

## 6. Suggested Future PR Split

이 audit 이후 구현 단계는 아래와 같이 PR을 분리하여 진행하는 것을 권장합니다.

| PR | 작업 내용 |
|---|---|
| **PR A** | Selector inventory comment/docs — `overrides.css` 내 selector 역할 주석 추가 및 문서화 |
| **PR B** | Safe component relocation candidate — cascade 위험 없는 component-level rules 이동 |
| **PR C** | Final cascade override preservation audit — D 그룹 final overrides 보존 및 명시적 주석 |
| **PR D** | Visual verification pass — 에디터 브라우저 smoke 및 Cloudflare Preview 시각적 검증 |

> PR A 완료 전 PR B~D 진행 금지

---

## References

- Issue: [#137](https://github.com/skerishKang/LoveBud/issues/137)
- Precursor PR: #328 (formatting-only)
- Related: `docs/engineering/CSS_ARCHITECTURE.md`
- Related: `docs/engineering/EDITOR_DETAIL_UI_RESPONSIBILITY_AUDIT.md`
- Related: `docs/engineering/EDITOR_FALLBACK_GLOBAL_STATE_AUDIT.md`
