# Verification Warning Catalog

이 문서는 LoveBud의 UI, production, test preview 검증 중 반복적으로 관찰되는 warning과 blocker를 구분하기 위한 기준입니다.

목표는 검증 보고에서 같은 현상을 매번 blocker로 오판하거나, 반대로 실제 사용자 흐름을 깨는 문제를 warning으로 축소하지 않도록 하는 것입니다.

---

## 1. Warning과 blocker 구분

### Warning

Warning은 검증 중 기록해야 하지만, 해당 PR의 merge blocker로 단정하지 않을 수 있는 항목입니다.

Warning으로 분류하려면 아래 조건을 함께 봅니다.

- 해당 PR의 변경 범위와 직접 관련성이 낮습니다.
- 사용자 주요 흐름을 즉시 깨지 않습니다.
- 기존 production 또는 이전 preview에서도 반복 관찰된 이력이 있습니다.
- 별도 수정 범위가 필요하지만, 현재 PR의 목적과 파일 범위에 포함되지 않습니다.

Warning은 숨기지 않습니다. 보고서에는 반드시 `기존 / 신규 / PR 관련 여부`를 구분해 기록합니다.

### Blocker

Blocker는 해당 PR의 merge를 막아야 할 수 있는 항목입니다.

Blocker로 분류하는 기준은 아래와 같습니다.

- 해당 PR 변경과 직접 관련됩니다.
- 사용자 주요 흐름을 깨뜨립니다.
- production 또는 preview에서 기능 접근, 데이터 로드, 인증, 화면 사용성을 중단시킵니다.
- 변경 파일 범위가 승인 범위를 벗어납니다.
- runtime, API, auth, search, editor canvas 등 위험 영역 변경이 있는데 smoke 검증이 없습니다.

Blocker는 endpoint, status, screenshot, viewport, 재현 경로 등 근거를 포함해 보고합니다.

---

## 2. 현재 반복 관찰 warning 후보

### YouTube thumbnail 404

YouTube thumbnail 404는 Search, Browse, Detail, preview card 등에서 반복적으로 관찰될 수 있습니다.

분류 기준:

- PR 변경 범위가 typography, layout, docs, copy, tone CSS인 경우에는 merge blocker로 단정하지 않습니다.
- 해당 PR이 thumbnail URL 생성, preview rendering, search result card, media fetch, fallback image 처리를 건드렸다면 blocker 후보로 재분류합니다.
- 사용자 흐름이 유지되고 카드/페이지 접근이 가능하면 warning으로 기록합니다.

보고 예시:

```text
Warning: YouTube thumbnail 404 observed.
Status: existing / unrelated to this PR.
Impact: card image fallback only; Browse/Search flow remains usable.
```

주의:

- `console error 없음`이라고 쓰면서 YouTube thumbnail 404를 숨기지 않습니다.
- console error와 network warning은 별도 항목으로 분리해 기록합니다.

### 기존 i18n missing warning

기존 i18n missing warning은 언어 키 누락 또는 fallback text 사용으로 나타날 수 있습니다.

분류 기준:

- 사용자 흐름을 깨지 않고 fallback copy가 표시되면 warning으로 둡니다.
- 해당 PR이 i18n 파일, copy key, locale mapping, page text rendering을 변경했다면 별도 판단합니다.
- 버튼명, 주요 CTA, 저장/삭제/공개 범위 등 의사결정 텍스트가 누락되면 blocker 후보입니다.

보고 예시:

```text
Warning: i18n missing key observed.
Status: existing / unrelated to this PR.
Impact: fallback text visible; core flow remains usable.
```

### 기존 Search/E2E setup blocker

Search/E2E setup 실패는 PR 변경 파일과 직접 관련성을 확인한 뒤 분류합니다.

분류 기준:

- Playwright 설치 누락, 테스트 환경 설정 누락, 기존 Search baseline 실패처럼 PR 범위 밖의 반복 실패는 `unrelated existing CI blocker`로 보고할 수 있습니다.
- Search, API, Modal, function, routing, auth, result rendering을 변경한 PR이면 관련성을 다시 판단합니다.
- E2E 실패가 현재 PR 변경 화면이나 사용자 흐름에서 재현되면 blocker입니다.

보고 예시:

```text
Check failure: CI E2E Smoke.
Classification: unrelated existing CI blocker.
Reason: failure matches existing Playwright/Search setup issue; this PR changes docs only.
```

---

## 3. Blocker 예시

아래 항목은 일반적으로 blocker 후보입니다. PR 변경 범위와 재현 근거를 함께 판단합니다.

### Browse data load failure

- Browse/Search 페이지에서 public tree data가 로드되지 않습니다.
- 빈 상태가 정상 데이터 없음인지 API 실패인지 구분해야 합니다.
- `/api` 응답 status, response body, console/network 로그를 함께 보고합니다.

### `/api` 5xx

- API endpoint가 500대 응답을 반환합니다.
- runtime/API/Modal/functions 변경 PR에서는 강한 blocker입니다.
- endpoint, status code, request path, upstream header를 기록합니다.

### Auth redirect loop

- 로그인 화면과 보호 페이지 사이에서 무한 redirect가 발생합니다.
- Editor/My Trees 등 auth-required flow 접근을 막으면 blocker입니다.
- 재현 계정 조건, URL 이동 순서, viewport를 기록합니다.

### Horizontal overflow

- 375px 또는 1024px 등 기준 viewport에서 가로 스크롤이 발생합니다.
- layout/CSS 변경 PR에서는 blocker 후보입니다.
- viewport, 페이지, overflow element selector, screenshot을 기록합니다.

### Mobile viewport broken

- 375px 등 모바일 기준에서 주요 CTA, card, editor control, nav가 잘리거나 겹칩니다.
- 사용자가 핵심 흐름을 진행할 수 없으면 blocker입니다.
- viewport와 affected flow를 기록합니다.

### CSS/JS 404

- 배포된 페이지에서 필요한 CSS 또는 JS가 404입니다.
- 정적 UI 변경 PR에서도 blocker가 될 수 있습니다.
- request URL, status, affected page를 기록합니다.

### Changed files 범위 위반

- 승인된 변경 파일 범위를 벗어난 파일이 PR에 포함됩니다.
- 예: docs-only PR에서 `css/`, `pages/`, `js/`, `modal_compute/`, `functions/`, package/lockfile이 변경된 경우.
- 즉시 blocker로 보고하고 수정 요청합니다.

### Runtime/API 변경인데 smoke 미검증

- `modal_compute/`, `functions/`, auth, API routing, search data contract 변경이 있는데 preview/production smoke 검증이 없습니다.
- endpoint status와 핵심 사용자 흐름 확인이 없으면 blocker 후보입니다.

---

## 4. 보고 원칙

검증 보고는 warning과 blocker를 분리해 씁니다.

### Warning 보고 필수 필드

- 항목명
- 기존 / 신규 여부
- PR 변경과 관련 있음 / 관련 낮음 / 판단 불가
- 사용자 영향
- 현재 PR merge blocker로 보는지 여부

권장 형식:

```text
Warning:
- item:
- status: existing / new / unknown
- PR relevance: related / unrelated / unknown
- user impact:
- merge blocker: yes/no
```

### Blocker 보고 필수 필드

- 항목명
- affected page 또는 flow
- endpoint와 status, API 문제가 있을 경우
- viewport, visual 문제일 경우
- screenshot 또는 재현 경로
- PR 변경과의 관련성
- 필요한 조치

권장 형식:

```text
Blocker:
- item:
- affected flow:
- endpoint/status:
- viewport:
- evidence:
- PR relevance:
- required action:
```

### Console / Network 기록 원칙

- `console error 없음`이라고 보고할 때도 network warning은 따로 적습니다.
- YouTube thumbnail 404, image fallback, external media 404는 console error와 분리합니다.
- `no console error`와 `network warning observed`는 동시에 성립할 수 있습니다.

---

## 5. 검증 환경 원칙

### Pre-merge

Pre-merge 검증은 Cloudflare Preview 또는 지정된 test URL을 우선합니다.

- PR preview URL
- 고정 test preview slot
- CTO가 지정한 test URL

Pre-merge에서 production만 확인하면 해당 PR 변경분이 반영되지 않았을 수 있으므로 주의합니다.

### Post-merge

Post-merge 검증은 production을 기준으로 합니다.

- 공식 production: `https://lovebud.pages.dev/`
- merge 이후 실제 사용자-facing 동작을 확인합니다.

### Local server

Local server는 정적 참고용입니다.

- HTML/CSS 레이아웃을 빠르게 보는 데 사용할 수 있습니다.
- Auth, Browse/Search API, Modal upstream, production routing, external media behavior를 대체하지 않습니다.
- local-only PASS를 production 또는 preview PASS로 보고하지 않습니다.

---

## 6. 분류 빠른 판단표

| 관찰 항목 | 기본 분류 | Blocker로 올리는 조건 |
| --- | --- | --- |
| YouTube thumbnail 404 | warning | thumbnail/media/search rendering PR이거나 card flow를 깨는 경우 |
| i18n missing warning | warning | 핵심 CTA/저장/공개/삭제 등 사용자 결정 텍스트가 깨지는 경우 |
| 기존 Search/E2E setup 실패 | unrelated existing CI blocker 가능 | PR이 Search/API/E2E 대상 파일을 변경했거나 실패가 변경 화면에서 재현되는 경우 |
| Browse data load failure | blocker 후보 | public data flow가 preview/production에서 실패하는 경우 |
| `/api` 5xx | blocker 후보 | runtime/API/auth/search/editor flow와 관련되는 경우 |
| Auth redirect loop | blocker | auth-required flow 접근이 불가능한 경우 |
| Horizontal overflow | blocker 후보 | 주요 viewport에서 사용자 흐름을 방해하는 경우 |
| CSS/JS 404 | blocker | 페이지 기능 또는 화면 렌더링을 깨는 경우 |
| Changed files 범위 위반 | blocker | 승인 범위 외 파일이 포함된 경우 |
| Runtime/API 변경 smoke 없음 | blocker 후보 | endpoint/status/flow 증빙이 없는 경우 |

---

## 7. 금지된 해석

- 반복 warning을 숨기고 `all clean`으로 보고하지 않습니다.
- 해당 PR과 무관한 기존 warning을 PR blocker로 단정하지 않습니다.
- production에서만 확인하고 pre-merge preview 검증으로 보고하지 않습니다.
- local server 결과를 production 또는 Cloudflare Preview 검증으로 대체하지 않습니다.
- CI 실패명을 보지 않고 단순히 `checks failed`만 보고하지 않습니다.
- 변경 파일 범위 위반을 minor issue로 축소하지 않습니다.
