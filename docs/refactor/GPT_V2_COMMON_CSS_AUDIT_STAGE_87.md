# Stage 87 — gpt-v2/common.css Split Hold Audit

## 1. 대상 파일

```
css/gpt-v2/common.css
```

## 2. 현재 줄 수

**370 lines** (11,353 bytes)

## 3. Import / Link 구조

- **직접 `<link>` 방식** (5개 페이지에서 사용):

| 페이지 | 경로 |
|--------|------|
| `pages/gpt-v2/browse.html` | `<link rel="stylesheet" href="../../css/gpt-v2/common.css" />` |
| `pages/gpt-v2/editor.html` | 동일 |
| `pages/gpt-v2/home.html` | 동일 |
| `pages/gpt-v2/intro.html` | 동일 |
| `pages/gpt-v2/start.html` | 동일 |

- `@import` 체인 없음 — 각 HTML 페이지가 직접 로드
- 다른 CSS 파일과의 import/cascade 종속성 없음

## 4. 경로 성격 — Variant/Prototype

```
pages/gpt-v2/
├── TODO.md          ← prototype 작업 노트
├── home.md          ← 마크다운 설계 노트
├── home2.html       ← 복수 버전
├── browse.html
├── editor.html
├── home.html
├── intro.html
└── start.html
```

**판정: ✅ Prototype/Variant 경로**

디렉터리명 `gpt-v2` 자체가 Generation 2 실험 버전을 의미. `TODO.md`, `home.md` 등 비정규 파일 존재로 prototype 단계 확인. 현재 서비스되는 LoveBud 프로덕션 코드와 분리된 실험 경로.

## 5. Selector 책임 범위

| 카테고리 | 셀렉터 | 라인 | 비중 |
|----------|--------|:----:|:----:|
| CSS 변수 | `:root` (design tokens) | 1-21 | 5.7% |
| Base reset | `*`, `html`, `body`, `a`, `img` | 22-36 | 4.1% |
| Layout shell | `.site-shell`, `.topbar`, `.brand`, `.main-nav`, `.user-pill`, `.avatar` | 37-131 | 25.7% |
| Shared components | `.hero`, `.card`, `.panel`, `.eyebrow`, `.display`, `.lead` | 132-169 | 10.3% |
| Buttons | `.btn`, `.btn-primary`, `.btn-secondary` | 170-194 | 6.8% |
| Grid system | `.grid-2`, `.grid-3`, `.grid-hero`, `.grid-editor`, `.grid-browse` | 195-200 | 1.6% |
| Decorative collage | `.collage`, `.vine`, `.paper`, `.photo-card`, `.note`, `.mini-card`, `.tree-memory`, music bar | 201-290 | 24.3% |
| Photo backgrounds | `.photo-home-1` ~ `.photo-tree` | 291-301 | 3.0% |
| Card/input systems | `.card`, `.input`, `.textarea`, `.chip`, `.search-bar` | 302-346 | 12.2% |
| Responsive | `@media (max-width: 1280px)`, `@media (max-width: 860px)` | 347-370 | 6.5% |

## 6. Cascade Override 분석

| 위험 항목 | 발견 여부 | 설명 |
|-----------|:---------:|------|
| `body` prefix override | ❌ 없음 | 모든 셀렉터가 평면 선택자 |
| `!important` | ❌ 없음 | 단 1회도 사용하지 않음 |
| 동일 셀렉터 중복 정의 | ❌ 없음 | 각 셀렉터 1회씩만 정의 |
| `@media` 내 override | ✅ 있음 | 860px에서 `.collage`, `.photo-card` 등 position override (`!important`) |
| import 순서 의존성 | ❌ 없음 | 단일 파일 직접 링크 |

**결론: Cascade override 위험은 낮음.** 단일 파일 직접 링크 구조로 cascade 순서 의존성 없음. `!important`와 `body` prefix 미사용.

## 7. Split 가능성 평가

**긍정 요인:**
- Cascade override 위험 낮음
- 책임별 구분이 명확함 (변수 / 레이아웃 / 버튼 / 폼 / 반응형)
- 각 섹션 경계가 주석으로 구분되어 있음
- `!important` / `body` prefix 없음

**부정 요인 (Hold 결정 사유):**
- **Variant/prototype 경로** — 프로덕션 코드가 아님. 실험 단계에서 CSS 구조 변경은 불필요한 리스크.
- 각 페이지가 직접 `<link>`로 로드 — split 시 5개 HTML 파일을 모두 수정해야 함
- `pages/gpt-v2/`의 향후 방향성 불확실 (유지/폐기/통합)
- 370줄이지만 10개 이상의 작은 단위로 쪼개질 가능성 높음 → 과분리 위험
- Stage 86에서 "과분리 위험 높음" → 200줄 이하 CSS split 금지 결론. split 시 10개 파일 중 다수 100줄 미만.

## 8. Hold 판단

> **HOLD — 분리하지 않는다.**

**이유:**
1. Prototype/variant 경로 — 현재 리팩터링 대상 아님
2. 5개 HTML 페이지 직접 링크 — 변경 범위가 큼
3. 과분리 위험 (다수 서브파일이 100줄 미만)
4. 경로 자체가 프로덕션 정식 코드가 아님

## 9. Split 시 필요 사항 (향후)

만약 `gpt-v2` 경로가 정식 프로덕션으로 전환될 경우:
1. 각 카테고리별 파일로 무손실 분리 가능
2. Import 방식 결정: 단일 `gpt-v2.css` entrypoint의 `@import` 또는 HTML 직접 `<link>`
3. 각 split 파일 60-100줄 수준 예상 — 과분리 방지를 위해 카테고리 통합(예: forms+chips → forms.css, collage+photos → media.css)
4. 계약 테스트: `tests/contracts/gpt-v2-common-css-contracts.test.cjs`

## 10. 다음 Stage 추천

### 1순위: `css/editor/editor-memory-edit.css` (Stage 88)
- 62 lines
- 독립적인 memory edit 폼 스타일
- editor runtime 제한적 연결 (text field, button, tag 스타일)
- 작은 크기로 안전한 split 가능

### 2순위: `css/editor/editor-memory-form.css` smoke/audit (Stage 88-89)
- 442 lines
- Stage 86 hold → 이제 browser smoke checklist 문서화 진행
- editor runtime (5개 JS 파일)과 직접 연결
- editor browser smoke 필요

### 계속 보류:
- `css/editor/editor-overrides.css` (Stage 79 hold 유지)

## 11. #1505 OPEN 유지

- Issue #1505는 계속 OPEN 상태 유지
- close/fix/resolve keyword 사용하지 않음
