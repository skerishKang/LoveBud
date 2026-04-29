# 브라우저 검증 URL 정책

상태: Active operating policy  
적용 범위: LoveBud 브라우저 smoke, PR Preview 검증, Branch Preview 검증, fixed test slot 검증, 로컬/웹 에이전트 검증 보고

---

## 1. 목적

LoveBud는 여러 로컬/웹 모델이 병렬로 PR을 만들고 검증합니다. 이때 검증 대상 URL을 모델이 임의로 추정하면 아래 문제가 발생합니다.

```text
- closed/superseded PR preview를 재사용
- branch name 기반 preview URL을 추정
- PR Preview와 Branch Preview를 혼동
- Auth/API/DB/runtime 검증을 fixed slot 없이 임의 preview에서 수행
- 검증 보고의 URL provenance가 불명확해짐
```

따라서 브라우저 검증은 URL 출처가 명확할 때만 인정합니다.

---

## 2. 기본 원칙

```text
모델은 preview URL을 만들거나 추정하지 않는다.
모델은 이전 PR/closed PR/superseded PR의 preview URL을 재사용하지 않는다.
모델은 test1~test5 fixed slot을 CTO 배정 없이 사용하지 않는다.
URL provenance가 불명확하면 browser verification은 PASS가 아니라 BLOCKED 또는 not run이다.
```

---

## 3. 허용 URL

브라우저 검증에는 아래 URL만 사용할 수 있습니다.

### 3.1 CTO가 명시한 URL

CTO가 작업 지시문에 직접 적은 URL은 사용할 수 있습니다.

```text
URL source: CTO-provided
```

### 3.2 현재 PR의 실제 PR Preview URL

GitHub PR checks 또는 Cloudflare Pages deployment status에서 현재 PR 번호와 연결된 실제 PR Preview URL을 확인한 경우 사용할 수 있습니다.

```text
URL source: GitHub/Cloudflare PR deployment confirmed
PR number matched to URL: yes
```

단, URL이 현재 PR과 연결되어 있음을 보고해야 합니다.

### 3.3 CTO가 PR 단위로 배정한 fixed test slot

Auth/API/DB/runtime 검증은 원칙적으로 fixed test slot을 사용합니다.

```text
test1: https://test1.lovebud.pages.dev
test2: https://test2.lovebud.pages.dev
test3: https://test3.lovebud.pages.dev
test4: https://test4.lovebud.pages.dev
test5: https://test5.lovebud.pages.dev
```

fixed slot은 CTO가 PR 단위로 배정해야 합니다. 모델은 임의 선택할 수 없습니다.

---

## 4. 금지 URL

아래 URL은 브라우저 검증 근거로 인정하지 않습니다.

```text
- 브랜치명을 보고 추정한 Branch Preview URL
- 이전 PR에서 사용한 Preview URL
- closed PR 또는 superseded PR의 Preview URL
- 다른 PR에 붙은 Preview URL
- CTO가 배정하지 않은 test1~test5 fixed slot
- 모델이 임의로 만든 preview 도메인
- URL 출처가 보고되지 않은 모든 브라우저 검증 URL
```

Branch Preview URL은 CTO가 명시적으로 제공했거나 Cloudflare에서 해당 브랜치 배포를 확인한 경우에만 사용할 수 있습니다. 단순히 브랜치명으로 URL을 조합하는 것은 금지합니다.

---

## 5. 검증 유형별 URL 기준

### 5.1 공개/정적 화면 검증

공개 read/render 중심 화면은 PR Preview 우선입니다.

예시:

```text
- Home
- Intro
- Search/Browse public read
- Detail public read
- 정적 layout smoke
```

허용:

```text
- CTO가 지정한 PR Preview URL
- 현재 PR checks에서 확인한 실제 PR Preview URL
```

### 5.2 Auth/API/DB/runtime 검증

로그인, 로그아웃, Firebase Auth, owner/private data, Modal/Neon runtime, write/update/delete 경로는 fixed test slot을 사용합니다.

예시:

```text
- login/logout
- protected route
- my-trees owner view
- private tree/memory
- create/update/delete
- same-origin /api write path
```

허용:

```text
- CTO가 해당 PR에 배정한 test1~test5 fixed slot
```

금지:

```text
- 임의 PR Preview에서 Auth/API/DB/runtime PASS 보고
- fixed slot을 모델이 직접 선택
```

### 5.3 Production 검증

Production 검증은 CTO가 명시적으로 요청한 경우에만 수행합니다.

```text
production: https://lovebud.pages.dev/
```

Production에서 직접 검증할 때도 변경 PR과 production 배포 상태를 혼동하지 않도록 보고해야 합니다.

### 5.4 CSS split / stylesheet import verification

CSS split, stylesheet import hub, or shared stylesheet changes are visual verification tasks and must still follow the URL provenance rules in this document.

For CSS split PRs, browser verification should include:

```text
- Network check: no CSS import returns 404.
- global styles 변경 시 css/global.css import order 보존 확인.
- css/global/header.css 변경 시 shared header smoke:
  - desktop header
  - mobile nav toggle
  - language dropdown
  - auth/user dropdown visual state where applicable
- page stylesheet hub 변경 시 page-specific smoke:
  - css/my-trees.css 변경 시 /pages/my-trees.html desktop/mobile layout 확인
- invented preview URL로 visual PASS 보고 금지.
```

Notes:

- `css/global.css` is the global import hub. Its import order is documented in `../engineering/CSS_ARCHITECTURE.md`.
- `css/my-trees.css` is a page-specific import hub. A change there requires My Trees page smoke rather than unrelated page smoke.
- If no CTO-provided URL or confirmed current PR Preview URL is available, report browser verification as `not run` or `BLOCKED`, not PASS.

---

## 6. 필수 보고 형식

모든 브라우저 검증 보고에는 아래를 포함합니다.

```text
browser verification:
- URL used:
- URL type: production / PR Preview / Branch Preview / fixed test slot / local
- URL source: CTO-provided / GitHub PR checks confirmed / Cloudflare dashboard confirmed / local only
- PR number matched to URL: yes/no/not applicable
- CTO-assigned fixed slot: yes/no/not applicable
- fixed slot name: test1/test2/test3/test4/test5/none
- arbitrary preview URL used: yes/no
- browser verification result: PASS / PARTIAL / FAIL / BLOCKED / not run
```

URL source가 불명확하면 아래처럼 보고합니다.

```text
browser verification: not run
reason: no CTO-provided URL or confirmed current PR Preview URL
arbitrary preview URL used: no
```

---

## 7. PASS 처리 금지 조건

아래 중 하나라도 해당하면 브라우저 검증은 PASS가 아닙니다.

```text
- URL이 현재 PR에 연결되어 있는지 확인하지 못함
- closed/superseded PR preview를 사용함
- 브랜치명 기반으로 추정한 URL을 사용함
- Auth/API/DB/runtime 검증을 CTO-assigned fixed slot 없이 수행함
- console/network/pageerror 로그 본문이 필요한데 확보하지 못함
- 검증 URL과 보고 대상 PR head SHA가 연결되지 않음
```

이 경우 결과는 `PARTIAL`, `BLOCKED`, 또는 `not run`으로 보고합니다.

---

## 8. 작업자 프롬프트 삽입 블록

브라우저 검증이 포함된 모든 작업자 지시문에는 아래 블록을 붙입니다.

```text
[Browser verification URL rule]

Do not invent, infer, or reuse preview URLs.

For browser verification, use only one of the following:
1. A URL explicitly provided by CTO in this prompt.
2. A PR Preview URL copied from the current PR's actual Cloudflare/GitHub deployment status.
3. A fixed test slot explicitly assigned by CTO for this PR.

Forbidden:
- Do not use branch-name-based preview URLs unless CTO explicitly provides that URL.
- Do not use a preview URL from another PR.
- Do not use a closed/superseded PR preview URL.
- Do not use test1~test5 unless CTO assigns the slot to this exact PR.
- Do not report browser verification as PASS if URL provenance is unclear.

Report format:
- URL used:
- URL type:
- URL source:
- CTO-assigned fixed slot:
- PR number matched to URL:
- Browser verification result:
```

---

## 9. 한 줄 요약

```text
브라우저 검증 URL은 CTO 제공, 현재 PR deployment에서 확인, 또는 CTO 배정 fixed slot만 허용한다. 모델이 추정한 preview URL은 검증 근거가 아니다.
```
