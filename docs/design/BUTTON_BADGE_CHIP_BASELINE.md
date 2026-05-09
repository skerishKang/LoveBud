# Button / Badge / Chip Baseline

## 목적

이 문서는 PR3 구현 전에 Home / Intro / Browse의 button, badge, chip 계열을 어떻게 통일할지 정리하는 기준 문서입니다.

PR3는 시각 tone 통일 작업입니다. 레이아웃, 카드 구조, JS/API, rendering logic, Search thumbnail 404 처리는 포함하지 않습니다.

## 전제

- PR #49는 layout rail / container / spacing unification을 완료한 단계입니다.
- PR #51은 typography / accent hierarchy unification 단계이며, merge 전 test1 visual verification이 필요합니다.
- PR3는 PR #51 검증 이후 button / badge / chip tone을 통일하는 후속 단계입니다.
- PR4는 Intro hero visual / whitespace balance 전담입니다.
- PR5는 Browse card / hub panel surface unification 전담입니다.

---

## 1. Home 기준

Home은 PR3의 button / badge / chip tone 기준점입니다.

### Primary CTA

Home의 primary CTA는 가장 강한 행동 유도 요소입니다.

기준:

- warm rose / primary 계열을 가장 강하게 사용합니다.
- 텍스트 대비가 충분해야 합니다.
- radius는 둥글고 부드럽되, chip보다 더 명확한 CTA로 보여야 합니다.
- shadow는 과장된 floating보다 낮고 따뜻한 depth를 사용합니다.
- hover는 색상 과장보다 미세한 lift / border / shadow 강화로 처리합니다.
- focus-visible은 명확해야 하며 잘리면 안 됩니다.

PR3 판단:

- Intro와 Browse의 primary action이 Home보다 더 차갑거나, 더 회색이거나, 반대로 과하게 튀면 Home 기준으로 맞춥니다.

### Secondary / ghost CTA

Home의 secondary / ghost CTA는 primary CTA를 보조합니다.

기준:

- background는 paper / cream / translucent white 계열을 사용합니다.
- border는 warm neutral 또는 rose-tinted neutral을 사용합니다.
- text color는 primary보다 한 단계 낮은 brown / muted primary 계열을 사용합니다.
- hover에서 primary CTA처럼 변하지 않아야 합니다.
- ghost CTA는 버튼으로 인식되되, 주요 action을 압도하지 않아야 합니다.

PR3 판단:

- secondary button이 단순 outline처럼 차갑게 보이거나, primary CTA와 위계가 뒤섞이면 조정합니다.

### Eyebrow / badge tone

Home의 eyebrow / badge는 브랜드 감정 톤을 전달하는 작은 label입니다.

기준:

- small pill 또는 compact text label로 사용합니다.
- 색은 primary / muted rose / warm brown 계열을 사용합니다.
- background가 있으면 낮은 opacity의 warm fill을 사용합니다.
- uppercase, letter spacing, icon 사용은 과도하지 않아야 합니다.
- badge는 CTA보다 덜 강해야 합니다.

PR3 판단:

- Intro/Browse의 badge가 Home보다 시스템 tag처럼 보이거나, 네온/강한 fill처럼 보이면 Home 기준으로 낮춥니다.

### Brand color hierarchy

기준 위계:

1. Primary CTA: 가장 강한 rose / primary fill
2. Secondary CTA: paper fill + warm border
3. Badge / eyebrow: low-contrast rose or warm label
4. Filter chip / tag: selected 상태만 명확히, unselected는 조용하게
5. Disabled / quiet state: low contrast, paper tone 유지

---

## 2. Intro 비교

Intro는 Home과 같은 브랜드 경험을 공유해야 하지만, hero visual / whitespace는 PR4 범위입니다.

### Intro CTA가 Home과 다르게 보일 수 있는 요소

검토 대상:

- CTA radius가 Home과 다르게 느껴지는지
- primary/secondary 버튼의 fill 강도가 Home과 다른지
- hover/focus tone이 Home보다 차갑거나 과한지
- button shadow가 Home보다 무겁거나 없는지
- CTA text weight가 Home hierarchy와 맞는지

PR3에서 맞출 항목:

- primary CTA tone
- secondary/ghost CTA tone
- CTA radius / border / shadow 계열
- hover / focus-visible tone
- CTA 간 위계

PR4로 넘길 항목:

- hero visual 크기
- hero visual 위치
- hero copy와 visual 사이 whitespace
- hero section의 전체 density
- Home hero와 Intro hero의 화면 점유율 조정
- Intro hero layout / structure 변경

### Intro badge / eyebrow가 Home과 다르게 보일 수 있는 요소

검토 대상:

- eyebrow가 Home보다 더 기능 라벨처럼 보이는지
- badge background가 너무 강하거나 차가운지
- icon / symbol 사용이 Home과 다른 시각 언어를 만드는지
- letter spacing, text transform, font weight가 Home과 맞는지

PR3에서 맞출 항목:

- Intro eyebrow 색상 tone
- badge/pill border와 background tone
- Home 기준의 small label hierarchy
- hover/focus가 필요한 badge형 control의 상태 tone

PR4로 넘길 항목:

- badge 위치가 hero visual balance에 미치는 문제
- hero 내부 vertical rhythm
- badge와 hero title 간 간격
- visual asset 자체 크기 또는 crop

---

## 3. Browse 비교

Browse는 Search/Browse 기능 화면이지만, public 감상 공간의 tone을 유지해야 합니다.

### Browse filter chip

검토 대상:

- selected chip이 Home primary CTA처럼 과하게 강하지 않은지
- unselected chip이 지나치게 회색/시스템 UI처럼 보이지 않는지
- hover/focus-visible 상태가 명확한지
- chip border와 fill이 Home의 warm paper tone과 맞는지

PR3에서 맞출 항목:

- selected / unselected chip tone
- filter chip radius / border / background
- hover / focus-visible tone
- active state visual contrast

PR5로 넘길 항목:

- filter area와 result card 사이 spacing
- Browse card layout density
- right hub panel hierarchy
- Browse card surface depth

### Browse tag / pill

검토 대상:

- tag/pill이 Home eyebrow/badge tone과 동떨어져 보이지 않는지
- tag가 content metadata인지 action control인지 구분되는지
- selected/active 상태가 있다면 chip과 tone이 맞는지

PR3에서 맞출 항목:

- tag/pill color family
- tag/pill border / background opacity
- metadata pill과 action chip의 시각 위계
- selected/unselected tone

PR5로 넘길 항목:

- card 내부 metadata 배치
- card content hierarchy
- card surface / shadow / radius
- hub panel 내 tag grouping 구조

### Browse action button

검토 대상:

- Browse action button이 Home primary/secondary CTA 체계와 연결되는지
- action button이 card text/link처럼 묻히지 않는지
- 반대로 card hierarchy를 압도하지 않는지

PR3에서 맞출 항목:

- action button tone
- quiet secondary action tone
- hover/focus-visible tone
- button/chip 간 시각 언어 통일

PR5로 넘길 항목:

- action button이 놓이는 card/hub layout
- card/hub panel surface hierarchy
- card 내부 CTA 위치 조정

---

## 4. PR3 범위

### 포함

PR3에 포함합니다.

- button tone
- badge / pill tone
- chip / tag tone
- selected / unselected 상태 tone
- hover / focus-visible tone
- primary / secondary / quiet CTA hierarchy
- Home / Intro / Browse 간 repeated control style alignment

### 제외

PR3에서 제외합니다.

- layout width / spacing
- card structure
- Browse hub panel
- Browse result card surface hierarchy
- Intro hero visual
- Intro hero whitespace balance
- JS / API / rendering logic
- Search thumbnail 404
- PR #7 prototype
- `pages/gpt-v2/`
- `assets/gpt-v2/`
- `pages/gpt-svg-tree/`
- runtime / API files
- package / lockfile

---

## 5. PR4 / PR5로 넘긴 항목

### PR4로 분리

- Intro hero visual balance
- Intro visual size
- Intro hero whitespace
- Home과 Intro의 hero density 조정
- Intro hero copy / visual / badge spacing
- Intro hero layout이 필요한 경우 별도 승인

### PR5로 분리

- Browse result card tone
- Browse right hub panel tone
- card / hub hierarchy
- Browse card surface depth
- Browse card metadata 배치
- hub panel grouping
- Search/Browse rendering logic은 PR5에서도 제외하고 별도 기능/bugfix로 분리

---

## 6. 검증 기준

### 기준 환경

- 병합 전 검증은 Cloudflare PR Preview 또는 지정 test/preview URL 기준으로 수행합니다.
- Browse/Search는 로컬 서버 단독 검증으로 승인하지 않습니다.
- production은 merge 후 확인합니다.

### 기본 viewport

- Home: 1440 / 1024 / 375
- Intro: 1440 / 1024 / 375
- Browse: 1440 / 1024 / 375

### Browse 필수 확인

- Browse data load 확인
- filter chip selected/unselected 확인
- result card 내 tag/pill 확인
- action button hover/focus 확인
- network/console 신규 오류 확인

### Warning vs blocker 분리

Blocker:

- CSS/HTML/JS/runtime/API/package/prototype 파일이 PR3 허용 범위 밖에서 변경됨
- Browse data load가 새 변경으로 깨짐
- button/focus 상태가 keyboard 사용을 방해함
- horizontal overflow 발생
- primary CTA와 secondary CTA 위계가 역전됨
- PR #7 또는 prototype/reference 파일을 수정/삭제/이동함

Warning:

- 기존 환경성 warning 또는 외부 asset warning
- PR3 변경과 무관한 기존 thumbnail 404
- 문구 길이에 따른 일부 chip wrap, 단 사용성 저해가 없어야 함
- 카드 surface hierarchy 문제는 PR5 범위로 분리 가능
- Intro hero density 문제는 PR4 범위로 분리 가능

검증 warning / blocker 분류가 필요하면 `docs/project/VERIFICATION_WARNING_CATALOG.md`를 함께 참조합니다.

## 운영 메모

PR3는 작은 control surface의 tone 정렬 작업입니다. Browse card/hub panel, Intro hero visual, Search thumbnail 404를 함께 처리하면 PR 범위가 커지므로 별도 PR로 분리합니다.
