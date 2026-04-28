# Primary Color Token Cleanup Plan

LoveBud CSS에는 현재 primary color의 hex token은 있지만, 같은 색을 alpha 값과 함께 재사용하기 위한 RGB token이 아직 없습니다.

현재 기준:

```css
--primary: #904951;
```

반면 여러 CSS 파일에는 아래와 같은 하드코딩 RGB 패턴이 반복됩니다.

```css
rgba(144, 73, 81, 0.12)
rgba(144, 73, 81, 0.18)
rgba(144, 73, 81, 0.24)
```

이 문서는 `rgba(144, 73, 81, X)` 반복을 바로 대량 치환하지 않고, visual regression 위험을 줄이기 위한 단계별 정리 계획입니다.

---

## 1. 문제 정의

### 1.1 현재 상태

- `--primary: #904951` token은 존재합니다.
- `--primary-rgb` token은 아직 없습니다.
- primary color를 투명도와 함께 쓰는 곳에서 `rgba(144, 73, 81, X)`가 직접 반복됩니다.
- focus ring, shadow, surface tint, hover/pressed state, card glow 등 서로 다른 시각 역할이 같은 RGB 하드코딩으로 표현되어 있습니다.

### 1.2 왜 바로 전체 치환하면 안 되는가

`rgba(144, 73, 81, X)`를 일괄적으로 `rgba(var(--primary-rgb), X)`로 바꾸는 것은 겉으로는 단순하지만, LoveBud UI에서는 다음 위험이 있습니다.

- control/focus/shadow와 decorative glow의 시각 역할이 다름
- page별 CSS가 서로 다른 import order와 specificity를 가짐
- alpha 값이 같은 색상이라도 배경/컴포넌트에 따라 체감 대비가 다름
- visual CSS 작업과 섞이면 회귀 원인 추적이 어려움
- screenshot baseline 없이 치환하면 미세한 hover/focus/shadow 회귀를 놓칠 수 있음

따라서 token 추가와 실제 치환은 분리하고, 치환도 page family별로 작게 나누는 것이 안전합니다.

---

## 2. 목표

최종 목표는 primary color의 RGB 반복값을 하나의 token으로 통합하는 것입니다.

권장 목표 token:

```css
--primary-rgb: 144, 73, 81;
```

이후 CSS에서는 아래처럼 사용합니다.

```css
box-shadow: 0 0 0 3px rgba(var(--primary-rgb), 0.16);
background: rgba(var(--primary-rgb), 0.08);
```

단, 이 문서는 계획 문서입니다. 이 PR에서는 token 추가, CSS 수정, 실제 rgba 치환을 하지 않습니다.

---

## 3. 단계별 권장 계획

### Phase 1 — token 추가만 분리

대상 후보:

- `css/global/tokens.css`

작업:

```css
--primary-rgb: 144, 73, 81;
```

검증:

- token 추가만 수행
- 기존 CSS 사용처 치환 없음
- visual 변화 없어야 함
- `npm test`
- 최소 smoke: home / intro / search / detail / editor / login

주의:

- Phase 1은 token 추가만 합니다.
- `rgba(144, 73, 81, X)` 실제 치환은 하지 않습니다.

### Phase 2 — global control/focus/shadow부터 제한 치환

대상 후보:

- `css/global.css`
- global control/focus/shadow 관련 규칙

작업 원칙:

- focus ring, common button shadow, shared control hover처럼 전역 역할이 명확한 곳만 치환
- decorative hero glow, page-specific accent background는 제외
- before/after screenshot 비교 필수

검증:

- desktop 1920x1080
- mobile 390x844
- keyboard focus state
- hover/active 가능한 주요 버튼
- login/settings/search/editor 기본 흐름

### Phase 3 — page CSS를 개별 PR로 치환

page family별로 분리합니다.

권장 순서:

1. intro page CSS
2. search/browse page CSS
3. detail page CSS
4. editor/my-trees page CSS
5. login/settings page CSS

원칙:

- 한 PR에서 여러 page family를 섞지 않습니다.
- visual CSS 작업과 token cleanup을 결합하지 않습니다.
- alpha 값 의미를 바꾸지 않고 RGB tokenization만 수행합니다.

### Phase 4 — visual smoke 및 회귀 확인

필수 baseline:

- 실제 치환 전 screenshot baseline 확보
- desktop 1920x1080
- mobile 390x844
- light/dark 또는 available appearance mode 기준 확인
- 주요 hover/focus/selected state 확인

확인 페이지:

- `/`
- `/intro.html`
- `/search.html`
- `/detail.html`
- `/editor.html`
- `/my-trees.html`
- `/login.html`
- `/settings.html`

---

## 4. PR 분리 원칙

### 절대 섞지 않을 것

- visual CSS polish 작업
- button/badge/chip tone 변경
- layout spacing 변경
- typography 변경
- hover/focus alpha 조정
- Search empty/error copy/layout polish
- Auth/Login/Shared Header 작업
- Editor behavior 작업
- Modal/API/backend 작업

### 허용되는 최소 단위

- Phase 1: token 추가만
- Phase 2: global control/focus/shadow 치환만
- Phase 3: 한 page family의 rgba tokenization만
- Phase 4: visual verification documentation만

---

## 5. Screenshot baseline 필요성

실제 치환 전에는 screenshot baseline이 필요합니다.

이유:

- `rgba(var(--primary-rgb), X)`는 이론상 동일 색상이지만, 치환 과정에서 alpha 값이나 selector 범위가 함께 바뀌면 시각 회귀가 발생할 수 있음
- focus ring과 shadow는 작은 차이도 접근성과 체감 품질에 영향
- decorative glow는 alpha 값이 같아도 배경 위에서 더 도드라질 수 있음
- 여러 CSS import hub가 있는 상태에서 회귀 원인 추적을 쉽게 해야 함

baseline capture 후보:

- home hero CTA
- intro CTA/button area
- search controls and cards
- detail preview/media area
- editor controls
- my-trees cards/buttons
- login buttons/forms
- settings controls

---

## 6. 검증 체크리스트

각 치환 PR마다 아래를 확인합니다.

```bash
git diff --check
npm test
```

가능하면 추가 확인:

- CSS 파일 변경 범위가 해당 phase와 일치하는지
- `rgba(144, 73, 81, X)`가 의도한 범위에서만 줄었는지
- `--primary-rgb` 사용처가 해당 PR scope를 넘지 않는지
- screenshot baseline 대비 시각 변화가 없는지
- hover/focus/active state가 유지되는지
- mobile 390px에서 과한 shadow/glow가 생기지 않는지

---

## 7. 이번 문서 PR의 non-goals

이번 문서 PR에서는 아래를 하지 않습니다.

- `css/global/tokens.css` 수정
- `--primary-rgb` token 추가
- `rgba(144, 73, 81, X)` 실제 치환
- CSS 파일 수정
- UI 변경
- screenshot capture
- visual smoke 실행
- visual CSS 작업과 결합

---

## 8. 최종 권장

가장 안전한 다음 단계는 아래 순서입니다.

1. screenshot baseline 확보
2. Phase 1 token-only PR 생성
3. Phase 2 global control/focus/shadow 제한 치환 PR
4. Phase 3 page family별 치환 PR
5. Phase 4 visual smoke 결과 정리

primary color RGB cleanup은 단순 문자열 치환으로 보일 수 있지만, LoveBud의 감성 UI에서는 shadow, glow, focus, surface tint가 모두 제품 인상에 영향을 줍니다. 따라서 작은 PR, 명확한 phase, screenshot baseline을 기준으로 진행합니다.
