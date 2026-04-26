# UI Polish Roadmap after PR63

## 목적

이 문서는 PR #49, PR #51, PR #62, PR #63 이후 남은 public UI polish와 후속 기능 개선 작업을 분리하기 위한 디자인 실행 로드맵입니다.

이 문서는 구현 지시서가 아니라 **범위 분리 기준**입니다. 실제 CSS/HTML/JS/API 변경은 각 PR에서 별도 승인 후 진행합니다.

## 완료된 UI 단계

| 단계 | 상태 | 범위 | 메모 |
|------|------|------|------|
| PR #49 `ui(layout): align landing browse rails` | 완료 | layout rail / container / spacing unification | Home, Intro, Browse의 큰 레이아웃 폭, rail, spacing 기준을 통일. production verification PASS |
| PR #51 `ui(style): align typography accent hierarchy` | 완료 | typography / accent hierarchy unification | Home 기준 typography / accent hierarchy 통일. production verification PASS |
| PR #62 `ui(style): align button badge chip tone` | 완료 | button / badge / chip tone unification | Home / Intro / Browse 버튼, 배지, 칩 tone 통일. production verification PASS |
| PR #63 `ui(intro): balance hero visual whitespace` | 완료 | Intro hero visual / whitespace balance | Intro hero visual column, scene height, tablet breakpoint, warm scrapbook tone 개선. production verification PASS |

## 다음 UI / 기능 순서

1. **PR5 Audit: Browse card / hub panel surface audit**
2. **PR5 Implementation: Browse card / hub panel surface unification**
3. **Search URL state: query / category / sort / limit URL sync**
4. **Selected tree deep link: `?tree=` preview selection**
5. **YouTube thumbnail fallback hardening**
6. **CI/E2E Playwright dependency stabilization**
7. **Runtime legacy clarification: Netlify legacy vs Cloudflare/Modal active runtime**
8. **Search CSS extraction / inline style reduction**

이 순서는 의도적으로 visual surface 정리 → 공유 가능한 Browse UX → known warning / CI 안정화 → 구조 정리 순서로 진행합니다.

---

## PR5 Audit: Browse card / hub panel surface audit

### 목표

Browse 화면의 result card, right hub panel, growing section이 Home / Intro와 같은 surface hierarchy 안에 보이는지 실도메인 기준으로 확인합니다.

### 포함 범위

- Browse result card tone 감사
- Browse right hub panel tone 감사
- `growing-trees-section` surface 감사
- card / hub hierarchy 관찰
- 1440 / 1024 / 375 viewport 관찰
- console / network warning vs blocker 확인
- Browse data load 확인

### 제외 범위

- 코드 수정 금지
- CSS 수정 금지
- JS 변경 금지
- API / runtime 변경 금지
- Search thumbnail 404 수정 금지
- rendering / filtering / sorting behavior 변경 금지

### 검증 포인트

- Browse/Search는 로컬 서버 단독 검증 금지
- production 또는 test/preview URL에서 실제 data load 확인
- result card와 right hub panel의 위계가 명확한지 확인
- 1440 / 1024 / 375에서 card density와 panel spacing 확인
- console/network 신규 오류 없음 확인

---

## PR5 Implementation: Browse card / hub panel surface unification

### 목표

Audit 결과를 바탕으로 Browse 화면의 card / hub surface를 정리합니다.

### 포함 범위

- Browse result card border / shadow / background / radius 정리
- Browse right hub panel border / shadow / background / radius 정리
- `growing-trees-section` 표면감 조정
- loading / empty / populated state의 surface consistency 확인
- Home / Intro와 연결되는 warm scrapbook tone 유지

### 제외 범위

- Search JS 변경 금지
- Search API 변경 금지
- renderer / adapter logic 변경 금지
- thumbnail fetch / 404 handling 변경 금지
- filtering / sorting / query behavior 변경 금지
- Home / Intro hero 변경 금지
- package / lockfile / workflow 수정 금지
- prototype/reference/demo 폴더 수정 금지

### 허용 후보 파일

- `pages/search.html` 우선
- CSS-only 또는 page-local style 변경으로 끝낼 수 있는지 먼저 판단

### 검증 포인트

- Cloudflare PR Preview 또는 지정 test/preview URL 필수
- Home / Intro / Browse 1440 / 1024 / 375 확인
- Browse data load 정상 확인
- horizontal overflow 없음 확인
- console/network 신규 blocker 없음 확인
- 기존 `ytimg.com` thumbnail 404는 unrelated warning으로만 기록

---

## Search URL state

### 목표

Browse 검색 상태를 URL query와 동기화하여 새로고침, 공유, 뒤로가기/앞으로가기 UX를 개선합니다.

### 포함 범위

- 검색어 `q`
- 카테고리 `category`
- 정렬 `sort`
- limit `limit`
- 초기 진입 시 URL query를 읽어 Browse 상태 복원
- 상태 변경 시 URL query 갱신

### 제외 범위

- card / hub panel visual 변경 금지
- API response shape 변경 금지
- thumbnail fallback 변경 금지
- runtime/backend 변경 금지

### 검증 포인트

- `/pages/search.html?q=...&category=...&sort=...&limit=...` 직접 진입 확인
- 검색/필터/정렬/더보기 후 URL 갱신 확인
- 뒤로가기/앞으로가기 동작 확인
- Browse data load 정상 확인

---

## Selected tree deep link

### 목표

공개 Browse에서 특정 트리 preview를 직접 열 수 있게 합니다.

### 포함 범위

- `?tree=<treeId>` 또는 동등한 query parameter 지원
- 직접 진입 시 해당 카드 활성화
- desktop에서 right hub panel preview hydrate
- mobile에서 preview panel open 처리
- tree가 없거나 비공개/삭제된 경우 안전한 fallback 처리

### 제외 범위

- 공개/비공개 정책 변경 금지
- private tree 노출 금지
- API 권한 정책 변경 금지
- visual surface 변경 금지

### 검증 포인트

- 존재하는 공개 tree id 직접 진입
- 존재하지 않는 tree id 직접 진입
- mobile 375에서 preview open/close 확인
- console/network 신규 blocker 없음 확인

---

## YouTube thumbnail fallback hardening

### 목표

반복 관찰되는 `ytimg.com` thumbnail 404 warning을 정식 bugfix로 분리합니다.

### 포함 범위

- YouTube thumbnail canonicalization 점검
- broken thumbnail fallback 점검
- card / preview thumbnail fallback 일관성 확인
- warning 감소 또는 사용자-visible fallback 안정화

### 제외 범위

- Browse surface polish와 혼합 금지
- API/runtime 변경 금지
- card layout 변경 금지
- unrelated renderer refactor 금지

---

## CI/E2E Playwright dependency stabilization

### 목표

반복 `Cannot find module 'playwright'` blocker를 CI/dependency/setup 차원에서 정리합니다.

### 포함 범위

- `package.json` / lockfile / workflow 변경 필요성 검토
- E2E smoke scripts와 CI 실행 조건 정리
- known blocker 문서와 실제 CI 상태 간 차이 축소

### 제외 범위

- UI polish PR과 혼합 금지
- runtime/API 기능 수정과 혼합 금지
- Preview 검증 기준 완화 금지

---

## Runtime legacy clarification

### 목표

Netlify legacy artifact와 active Cloudflare/Modal runtime을 계속 분리하여, 향후 backend 작업자가 잘못된 파일을 수정하지 않도록 합니다.

### 포함 범위

- active runtime truth 문서화
- Netlify legacy deprecation 문서화
- PR #36 / #38 계열 backend 방향 재정렬

### 제외 범위

- 즉시 Netlify archive/delete 금지
- runtime code 이동/삭제 금지
- Modal deploy 변경 금지

---

## Search CSS extraction / inline style reduction

### 목표

PR5 surface 정리 이후, `pages/search.html` 내부 style과 일부 inline style을 단계적으로 줄여 유지보수성을 개선합니다.

### 포함 범위

- search page CSS 분리 가능성 검토
- inline style을 class로 이동
- Browse controls markup/style 책임 분리 검토

### 제외 범위

- 기능 변경 금지
- API/runtime 변경 금지
- thumbnail fallback과 혼합 금지
- surface polish와 같은 PR에 섞지 않기

---

## 금지 / 보류 항목

아래 항목은 위 작업들에 임의 포함하지 않습니다.

- PR #7 prototype close 금지
- PR #7 branch 삭제 금지
- `pages/gpt-v2/` 보존
- `assets/gpt-v2/` 보존
- `pages/gpt-svg-tree/` 보존
- 실제 prototype/reference 파일 수정 금지
- runtime / API 수정 금지 unless 해당 PR의 명시 범위
- Modal / functions 수정 금지 unless 해당 PR의 명시 범위
- package / lockfile 수정 금지 unless CI/E2E stabilization PR의 명시 범위

## Prototype / reference 보존 기준

Prototype/reference 폴더는 cleanup 대상이 아니라 보존 대상입니다. 관련 판단은 [PROTOTYPE_REFERENCE_POLICY.md](PROTOTYPE_REFERENCE_POLICY.md)를 우선합니다.

특히 아래 경로는 UI polish 작업 범위가 아닙니다.

- `pages/gpt-v2/`
- `assets/gpt-v2/`
- `pages/gpt-svg-tree/`

## 검증 원칙

- 각 UI PR은 병합 전 Cloudflare PR Preview 또는 지정 test/preview URL에서 검증합니다.
- Browse/Search는 로컬 서버 단독 검증으로 승인하지 않습니다.
- production은 merge 후 확인합니다.
- 1440 / 1024 / 375 viewport를 기본 확인 범위로 둡니다.
- console error, network error, horizontal overflow를 함께 확인합니다.
- UI polish PR에서는 runtime/API/JS logic 변화가 없어야 합니다.
- 기능 PR에서는 visual polish를 섞지 않습니다.

## 운영 메모

- 문서/백로그는 전체를 잡아두되, 실제 PR은 한 번에 하나씩 엽니다.
- PR은 할 일 목록이 아니라 실제 diff 검수 단위입니다.
- 여러 구현 PR을 미리 열어두지 않습니다.
- 현재 열린 PR #7은 보존 prototype PR이며 main 병합 대상이 아닙니다.
