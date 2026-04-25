# UI Polish Roadmap after PR51

## 목적

이 문서는 PR #49, PR #51 이후 남은 public UI polish 작업을 PR3 / PR4 / PR5 단위로 분리하기 위한 디자인 실행 로드맵입니다.

이 문서는 구현 지시서가 아니라 **범위 분리 기준**입니다. 실제 CSS/HTML/JS 변경은 각 UI PR에서 별도 승인 후 진행합니다.

## 완료된 UI 단계

| 단계 | 상태 | 범위 | 메모 |
|------|------|------|------|
| PR #49 `ui(layout): align landing browse rails` | 완료 | layout rail / container / spacing unification | Home, Intro, Browse의 큰 레이아웃 폭, rail, spacing 기준을 통일 |
| PR #51 `ui(style): align typography accent hierarchy` | 진행 중 | typography / accent hierarchy unification | test1 배포 트리거 완료. Gemini Local Verifier test1 검증 대기. merge 전 test1 visual verification 필요 |

## 다음 UI 순서

1. **PR3: button / badge / chip tone unification**
2. **PR4: intro hero visual / whitespace balance**
3. **PR5: browse card / hub panel surface unification**

이 순서는 의도적으로 작은 시각 단위에서 큰 surface 단위로 진행합니다. PR3에서 공통 interactive tone을 먼저 맞춘 뒤, PR4에서 Intro hero의 밀도를 조정하고, PR5에서 Browse card/hub surface를 정리합니다.

---

## PR3: button / badge / chip tone unification

### 목표

공개 화면의 버튼, badge, pill, chip, CTA가 같은 제품군으로 보이도록 tone을 통일합니다.

### 포함 범위

- button shape / radius / shadow / border tone
- badge, pill, chip style
- primary / secondary / quiet CTA visual consistency
- Home, Intro, Browse에서 반복되는 interactive surface tone 정리
- hover / focus-visible의 시각 강도 통일

### 제외 범위

- layout 변경 금지
- grid / container / spacing 재조정 금지
- JS 변경 금지
- API / runtime 변경 금지
- Search rendering logic 변경 금지
- card/hub panel hierarchy 변경은 PR5로 분리
- Intro hero visual density 조정은 PR4로 분리

### 검증 포인트

- Home / Intro / Browse 1440 / 1024 / 375 확인
- primary CTA와 secondary button의 위계가 명확한지 확인
- badge/pill/chip이 과하게 튀지 않고 Home tone과 맞는지 확인
- focus-visible이 잘림 없이 표시되는지 확인

---

## PR4: intro hero visual / whitespace balance

### 목표

Intro hero가 Home hero와 같은 브랜드 밀도 안에서 보이도록 visual size와 whitespace를 조정합니다.

### 포함 범위

- Intro hero visual balance
- Intro hero visual size 조정
- Intro hero whitespace 조정
- Home과 Intro의 hero density 비교 조정
- Intro hero heading / visual / supporting copy 간 체감 밀도 정리

### 제외 범위

- Browse 제외
- Search / Browse card 변경 금지
- button / badge / chip 전역 tone 변경 금지
- JS 변경 금지
- API / runtime 변경 금지
- DOM 구조 변경은 별도 승인 없이는 금지

### 검증 포인트

- Home hero와 Intro hero의 첫인상 밀도 비교
- Intro 1440 / 1024 / 375에서 visual이 과도하게 크거나 작지 않은지 확인
- mobile에서 hero visual이 copy를 밀어내지 않는지 확인
- horizontal overflow 없음 확인

---

## PR5: browse card / hub panel surface unification

### 목표

Browse 화면의 result card와 right hub panel이 같은 surface hierarchy 안에 보이도록 정리합니다.

### 포함 범위

- Browse result card tone
- Browse right hub panel tone
- card / hub hierarchy
- card border / shadow / background / radius 정리
- empty / loading / populated state의 surface consistency 확인

### 제외 범위

- Search JS 변경 금지
- Search API 변경 금지
- rendering logic 변경 금지
- thumbnail fetch / 404 handling 변경 금지
- filtering / sorting / query behavior 변경 금지
- Home / Intro hero 변경 금지

### 검증 포인트

- Browse/Search는 로컬 서버 단독 검증 금지
- test/preview URL에서 실제 data load 확인
- result card와 right hub panel의 위계가 명확한지 확인
- 1440 / 1024 / 375에서 card density와 panel spacing 확인
- console/network 신규 오류 없음 확인

---

## 금지 / 보류 항목

아래 항목은 UI polish PR3 / PR4 / PR5에 포함하지 않습니다.

- PR #7 prototype close 금지
- PR #7 branch 삭제 금지
- `pages/gpt-v2/` 보존
- `assets/gpt-v2/` 보존
- `pages/gpt-svg-tree/` 보존
- 실제 prototype/reference 파일 수정 금지
- runtime / API 수정 금지
- Modal / functions 수정 금지
- Search thumbnail 404 수정은 별도 기능/bugfix 이슈로 분리
- package / lockfile 수정 금지

## Prototype / reference 보존 기준

Prototype/reference 폴더는 cleanup 대상이 아니라 보존 대상입니다. 관련 판단은 [PROTOTYPE_REFERENCE_POLICY.md](PROTOTYPE_REFERENCE_POLICY.md)를 우선합니다.

특히 아래 경로는 PR3 / PR4 / PR5의 작업 범위가 아닙니다.

- `pages/gpt-v2/`
- `assets/gpt-v2/`
- `pages/gpt-svg-tree/`

## 검증 원칙

- 각 PR은 병합 전 Cloudflare PR Preview 또는 지정 test/preview URL에서 검증합니다.
- Browse/Search는 로컬 서버 단독 검증으로 승인하지 않습니다.
- production은 merge 후 확인합니다.
- 1440 / 1024 / 375 viewport를 기본 확인 범위로 둡니다.
- console error, network error, horizontal overflow를 함께 확인합니다.
- UI polish PR에서는 runtime/API/JS logic 변화가 없어야 합니다.

## 운영 메모

- PR3 / PR4 / PR5는 서로 다른 목적의 UI polish입니다.
- 한 PR에서 button tone, hero density, Browse card hierarchy를 동시에 처리하지 않습니다.
- PR #51 검증이 끝나기 전에는 PR3 구현 착수를 별도 승인 없이 진행하지 않습니다.
