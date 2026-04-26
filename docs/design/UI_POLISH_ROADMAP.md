# UI Polish Roadmap after PR70

## 목적

이 문서는 PR #49, #51, #62, #63, #66, #67, #69, #70 이후 남은 public UI polish와 Search 후속 작업을 분리하기 위한 디자인 실행 로드맵입니다.

이 문서는 구현 지시서가 아니라 **범위 분리 기준**입니다. 실제 CSS/HTML/JS/API 변경은 각 PR에서 별도 승인 후 진행합니다.

## 완료된 UI / Search 단계

| 단계 | 상태 | 범위 | 메모 |
|------|------|------|------|
| PR #49 `ui(layout): align landing browse rails` | 완료 | layout rail / container / spacing unification | Home, Intro, Browse의 큰 레이아웃 폭, rail, spacing 기준을 통일. production verification PASS |
| PR #51 `ui(style): align typography accent hierarchy` | 완료 | typography / accent hierarchy unification | Home 기준 typography / accent hierarchy 통일. production verification PASS |
| PR #62 `ui(style): align button badge chip tone` | 완료 | button / badge / chip tone unification | Home / Intro / Browse 버튼, 배지, 칩 tone 통일. production verification PASS |
| PR #63 `ui(intro): balance hero visual whitespace` | 완료 | Intro hero visual / whitespace balance | Intro hero visual column, scene height, tablet breakpoint, warm scrapbook tone 개선. production verification PASS |
| PR #66 `ui(search): unify browse card and hub surfaces` | 완료 | Browse card / hub panel surface unification | Browse result card, preview sidebar, growing trees section, placeholder tone 정리 완료 |
| PR #67 상당 변경 | 완료 | Search URL state | `q`, `category`, `sort`, `limit` query sync main 반영 완료. PR #67은 중복 merge 방지를 위해 closed / unmerged 처리됨 |
| PR #69 `fix(search): harden YouTube thumbnail fallback` | 완료 | thumbnail fallback hardening | broken thumbnail image를 숨기고 fallback surface를 노출. preview fallback overlay obstruction 제거 완료 |
| PR #70 `docs(runtime): clarify active and legacy runtime paths` | 완료 | runtime truth clarification | Cloudflare Pages / Modal / Netlify 역할 분리 문서화 완료 |

## 현재 남은 Issue #65 Backlog

Issue #65는 open backlog tracker입니다. 현재 미완료 항목은 아래 3개뿐입니다.

1. **Selected tree deep link**
2. **Search JS responsibility split**
3. **Search CSS extraction / inline style reduction**

---

## Selected tree deep link

### 목표

공개 Browse에서 특정 트리 preview를 직접 열 수 있게 합니다.

### 포함 범위

- `?tree=<treeId>` 또는 동등한 query parameter 지원
- 직접 진입 시 해당 공개 tree 카드 선택
- desktop에서 preview sidebar hydrate
- mobile에서 preview panel open 처리
- tree가 없거나 비공개/삭제된 경우 안전한 fallback 처리

### 제외 범위

- 공개/비공개 정책 변경 금지
- private tree 노출 금지
- API 권한 정책 변경 금지
- visual surface 변경 금지
- thumbnail fallback 변경 금지
- Search CSS extraction과 혼합 금지

### 검증 포인트

- 존재하는 공개 tree id 직접 진입
- 존재하지 않는 tree id 직접 진입
- desktop preview hydrate 확인
- mobile 375에서 preview open/close 확인
- Browse data load 정상 확인
- console/network 신규 blocker 없음 확인

---

## Search JS responsibility split

### 목표

`js/search.js`의 URL state, controls, browse data loading, preview control 책임을 단계적으로 분리해 유지보수성을 개선합니다.

### 포함 범위

- URL state / controls module 분리 검토
- browse data loading module 분리 검토
- preview controller module 분리 검토
- 기존 behavior parity 유지
- 작은 단계별 refactor 우선

### 제외 범위

- 사용자-visible 기능 변경 금지
- API response shape 변경 금지
- runtime/backend 변경 금지
- visual surface 변경 금지
- thumbnail fallback 변경 금지
- CSS extraction과 혼합 금지

### 검증 포인트

- Search URL state regression 확인
- Browse data load 정상 확인
- latest / popular / load more 동작 확인
- selected preview 동작 확인
- desktop / mobile 기본 흐름 확인
- console/network 신규 blocker 없음 확인

---

## Search CSS extraction / inline style reduction

### 목표

PR #66 이후 남은 `pages/search.html` 내부 style과 JS-rendered inline style을 단계적으로 줄여 유지보수성을 개선합니다.

### 포함 범위

- search page CSS 분리 가능성 검토
- page-local `<style>`의 class 기반 정리
- JS-rendered inline style을 class로 이동할 수 있는지 검토
- Browse controls markup/style 책임 분리 검토
- behavior parity 유지

### 제외 범위

- 기능 변경 금지
- API/runtime 변경 금지
- thumbnail fallback 변경 금지
- Search URL state 변경 금지
- selected tree deep link 구현과 혼합 금지
- broad design retheme 금지

### 검증 포인트

- Cloudflare PR Preview 또는 지정 test/preview URL 확인
- Browse/Search data load 확인
- 1440 / 1024 / 375 viewport 확인
- horizontal overflow 없음 확인
- console/network 신규 blocker 없음 확인
- 기존 known warning은 warning catalog 기준으로 분리 보고

---

## 금지 / 보류 항목

아래 항목은 위 작업들에 임의 포함하지 않습니다.

- PR #7 prototype close 금지
- PR #7 branch 삭제 금지
- `pages/gpt-v2/` 보존
- `assets/gpt-v2/` 보존
- `pages/gpt-svg-tree/` 보존
- 실제 prototype/reference/demo 파일 수정 금지
- runtime / API 수정 금지 unless 해당 PR의 명시 범위
- Modal / functions 수정 금지 unless 해당 PR의 명시 범위
- package / lockfile 수정 금지 unless CI/E2E stabilization PR의 명시 범위
- Issue #65 close 금지

## Runtime truth 기준

- 공식 사용자-facing production / preview entry는 Cloudflare Pages입니다.
- Modal은 active compute/runtime 우선 경로입니다.
- Netlify 관련 파일과 `netlify/functions/*`는 legacy / fallback / artifact 성격으로 남아 있으며 현재 active production backend로 설명하지 않습니다.
- CI/E2E에서 `netlify dev`가 쓰이는 경우에도 이는 local harness이며 production runtime truth가 Netlify라는 뜻이 아닙니다.

## Prototype / reference 보존 기준

Prototype/reference 폴더는 cleanup 대상이 아니라 보존 대상입니다. 관련 판단은 [PROTOTYPE_REFERENCE_POLICY.md](PROTOTYPE_REFERENCE_POLICY.md)를 우선합니다.

특히 아래 경로는 UI polish / Search follow-up 작업 범위가 아닙니다.

- `pages/gpt-v2/`
- `assets/gpt-v2/`
- `pages/gpt-svg-tree/`

## 검증 원칙

- 각 UI/Search PR은 병합 전 Cloudflare PR Preview 또는 지정 test/preview URL에서 검증합니다.
- Browse/Search는 로컬 서버 단독 검증으로 승인하지 않습니다.
- production은 merge 후 확인합니다.
- 1440 / 1024 / 375 viewport를 기본 확인 범위로 둡니다.
- console error, network error, horizontal overflow를 함께 확인합니다.
- UI polish PR에서는 runtime/API/JS logic 변화가 없어야 합니다.
- 기능 PR에서는 visual polish를 섞지 않습니다.
- refactor PR에서는 behavior parity를 우선합니다.

## 운영 메모

- 현재 남은 Issue #65 작업은 3개입니다.
- 한 PR에서 selected tree deep link, JS responsibility split, CSS extraction을 동시에 처리하지 않습니다.
- PR #64는 stale docs PR로 closed / unmerged 처리되었습니다.
- 현재 열린 PR #7은 보존 prototype PR이며 main 병합 대상이 아닙니다.
