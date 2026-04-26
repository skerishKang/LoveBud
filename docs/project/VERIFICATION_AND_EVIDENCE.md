# Verification and Evidence

이 문서는 LoveBud 문서 TF의 검증 및 증빙 기준을 정리합니다.

검증과 증빙은 서로 다른 개념입니다. 검증은 작업의 정확성을 확인하는 활동이고, 증빙은 그 확인 결과를 기록하는 것입니다.

---

## 1. 목적

검증 기준 문서의 목적은 다음과 같습니다.

1. **검증의 범위와 책임 명확화**: 어느 수준의 검증이 필요한지 명확히 합니다.
2. **검증 환경 우선순위 명확화**: PR 병합 전, 병합 후, 로컬 검증의 역할을 구분합니다.
3. **증빙의 표준화**: 스크린샷, 캡처, 로그 등 증빙 자료의 저장 경로와 Naming을 표준화합니다.
4. **보고서의 신뢰성**: 보고서에서 검증 완료, 미검증, 추정을 명확히 구분하여 사실과 주장을 분리합니다.

---

## 2. 기본 원칙

LoveBud 문서 TF의 검증은 다음 원칙을 따릅니다.

### 2.1. 검증은 단계별 source of truth를 구분한다

LoveBud는 Cloudflare Pages, same-origin `/api/*`, Modal upstream, Firebase authentication/session state에 의존합니다.

따라서 검증 source of truth는 작업 단계에 따라 다릅니다.

| 단계 | 우선 검증 환경 | 설명 |
|------|----------------|------|
| PR 병합 전 | Cloudflare PR Preview 또는 준비된 테스트/프리뷰 URL | 아직 production main에 반영되지 않은 PR을 확인하는 기준 |
| PR 병합 전 fallback | 로컬 서버 | 정적 레이아웃 참고용. API/auth/runtime 의존 화면의 최종 판단 기준 아님 |
| PR 병합 후 | `https://lovebud.pages.dev/` | main 병합 및 배포 후 production 최종 확인 기준 |

중요:
- `https://lovebud.pages.dev/`는 병합 전 PR 검증 기준이 아닙니다. production 도메인은 현재 `main`을 반영합니다.
- 아직 병합되지 않은 PR branch의 UI를 production 도메인에서 확인했다고 보고하지 않습니다.
- 로컬 서버는 유용한 보조 검증이지만, Browse/Search/Auth/API 의존 화면의 최종 PASS/BLOCKER 근거가 될 수 없습니다.

### 2.2. 검증과 추정을 분리한다

보고서나 작업 결과에서 다음 세 가지 상태를 명확히 구분합니다.

| 상태 | 의미 | 사용 예시 |
|------|------|-----------|
| **검증 완료** | 실제 확인이 이루어진 것 | "search 페이지에서 카드 11개 표시됨" |
| **미검증** | 확인이 이루어지지 않은 것 | "editor API 연결은 미검증" |
| **추정** | 논리적으로 유추하지만 확인은 못한 것 | "코드 구조상 정상 동작할 것으로 추정" |

### 2.3. 검증 범위를 사전에 명확히 한다

작업 요청 시 다음과 같은 항목을 사전에 정리합니다.

1. 검증 대상 (페이지, 기능, API 등)
2. 검증 환경 (Cloudflare Preview, 테스트/프리뷰 URL, production, 로컬 등)
3. 검증 방법 (자동화 스크립트, 수동 확인 등)
4. 통과/실패 기준

---

## 3. UI 검증 환경 우선순위

### 3.1. PR 병합 전 UI 검증

PR 병합 전에는 production 도메인이 아니라 PR branch가 반영된 환경을 확인합니다.

우선순위는 아래와 같습니다.

1. **Cloudflare Pages PR Preview URL**
2. **작업을 위해 이미 확보한 테스트/프리뷰 페이지 URL**
3. **로컬 서버** — 정적 레이아웃 참고용 fallback

로컬 서버는 다음을 확인하는 데 사용할 수 있습니다.

- 정적 HTML/CSS 레이아웃
- 기본 viewport overflow
- 간단한 DOM/CSS 구조
- syntax 또는 asset path 확인

하지만 아래 항목의 최종 판단에는 사용할 수 없습니다.

- `/api/*` 응답
- Cloudflare Pages Functions 동작
- Modal upstream 동작
- Firebase auth/session 동작
- production-equivalent Browse/Search 데이터 로드

### 3.2. 로컬 정적 서버 단독 검증 금지 화면

아래 화면 또는 흐름은 로컬 정적 서버만으로 최종 PASS/BLOCKER를 판단하지 않습니다.

1. Browse / Search 페이지
2. Editor 페이지
3. My Trees 페이지
4. Auth-gated 페이지
5. `/api/*`를 호출하는 모든 페이지
6. Cloudflare Pages Functions에 의존하는 페이지
7. Modal upstream에 의존하는 페이지
8. Firebase authentication 또는 session state에 의존하는 페이지

이런 화면에서 로컬 서버에서 "불러오기 실패"가 나왔다면, 즉시 제품 회귀로 단정하지 않습니다. Preview/test URL에서 API, 인증, network status를 확인해야 합니다.

### 3.3. PR 병합 후 production 검증

PR이 `main`에 병합된 뒤에는 `https://lovebud.pages.dev/`에서 최종 production 검증을 수행합니다.

production 검증은 아래를 확인합니다.

1. 변경 사항이 배포에 반영되었는가
2. 기존 사용자 흐름이 깨지지 않았는가
3. Console/Network에 신규 blocker가 없는가
4. Desktop/Tablet/Mobile viewport에서 레이아웃이 유지되는가

---

## 4. 실도메인 검증의 위치

### 4.1. 왜 production 검증이 필요한가

브라우저 기반 서비스에서는 다음 이유로 production 검증이 필요합니다.

1. **캐시 영향**: 배포 후 캐시가 완전히 무효화되지 않을 수 있음
2. **런타임 환경**: 서버 사이드 코드와 클라이언트 사이드 코드의 동작이 다를 수 있음
3. **외부 의존성**: Firebase, Modal 등 외부 서비스의 현재 상태가 다를 수 있음
4. **사용자 환경**: 실제 사용자 브라우저에서만 확인할 수 있는 항목이 있음

### 4.2. production 검증의 역할

production 검증은 **병합 후 최종 확인**입니다.

| 우선순위 | 검증 단계 | 설명 |
|----------|----------|------|
| 1순위 | production 도메인 + production runtime | main 병합 후 최종 확인 |
| 2순위 | Cloudflare Preview / 테스트 URL | PR 병합 전 확인 |
| 3순위 | 로컬 개발 서버 | 정적 레이아웃/구문 참고 |
| 4순위 | 코드 분석 | 소스 코드만으로 검증 |

### 4.3. production 검증이 필요한 항목

production에서 최종 확인해야 하는 항목은 다음과 같습니다.

1. **UI 렌더링**: 카드, 버튼, 입력 필드 등 화면 표시
2. **사용자 흐름**: 페이지 간 이동, 모달 열기/닫기
3. **인증**: 로그인/로그아웃, 세션 유지
4. **외부 API**: YouTube 썸네일 로드, Firebase 인증
5. **캐시 영향**: 배포 후 새로고침으로 인한 표시 변화

---

## 5. 로컬 검증의 위치

로컬 검증은 보조 수단으로 사용하며, 다음 경우에 로컬 검증을 허용합니다.

### 5.1. 로컬 검증이 허용되는 경우

1. **구문 검증**: 파일 생성/수정 후 문법 오류 확인
2. **참조 검증**: 파일 경로, 링크 등 참조 구조 확인
3. **논리 분석**: 코드의 알고리즘적 분석 (외부 의존성이 없는 경우)
4. **구동 준비 확인**: 스크립트 실행 가능 여부 등 환경 준비 상태
5. **정적 레이아웃 참고**: Home/Intro 같은 정적 성격의 화면에서 preliminary layout 확인

### 5.2. 로컬 검증의 한계

로컬 검증만으로 다음 항목은 검증할 수 없습니다.

1. **API 응답**: 서버 사이드 로직의 실제 응답
2. **외부 서비스 연동**: Firebase, YouTube 등
3. **Cloudflare Functions**: same-origin `/api/*` runtime
4. **Modal upstream**: deployed Modal endpoint 동작
5. **인증 세션**: production/preview browser session behavior

로컬 검증만으로 "검증 완료"로 주장하지 않습니다. 반드시 "로컬 분석 기준", "정적 레이아웃 참고", 또는 "추정"으로 표기합니다.

---

## 6. UI / 기능 검증 기준

### 6.1. Desktop + Mobile 병행 원칙

UI 검증은 다음과 같은 기준을 따릅니다.

1. **Desktop 검증**: 최소 1024px 이상 너비에서 확인
2. **Mobile 검증**: 375px 너비에서 확인
3. **두 환경 모두 통과해야 검증 완료**로 함

### 6.2. 검증 항목 분류

| 분류 | 검증 대상 | 검증 환경 | 스크린샷 필요 |
|------|----------|-----------|---------------|
| 레이아웃 | 카드, 버튼, 입력 필드 위치 | Preview/test URL 또는 production | 필수 |
| 기능 | 데이터 표시, 필터, 정렬 | Preview/test URL 또는 production | 권장 |
| 흐름 | 페이지 이동, 모달, 양식 | Preview/test URL 또는 production | 권장 |
| 성능 | 로드 시간, 응답 속도 | Preview/test URL 또는 production | 선택 |

### 6.3. Browser DevTools 활용

검증 시 Browser DevTools를 활용합니다.

1. **Network 패널**: API 요청/응답 확인
2. **Console 패널**: JavaScript 에러 확인
3. **Elements 패널**: DOM 구조 확인
4. **Application 패널**: 캐시, 세션 확인

### 6.4. UI 검증 프롬프트 작성 전 확인 질문

UI 검증 지시를 만들기 전에 아래 질문에 답해야 합니다.

1. 이 화면은 정적-only 페이지인가?
2. `/api/*`를 호출하는가?
3. 인증 또는 세션 상태가 필요한가?
4. Cloudflare Functions 또는 Modal upstream에 의존하는가?
5. 이미 확보한 테스트/프리뷰 URL이 있는가?
6. Cloudflare PR Preview URL이 있는가?
7. production 도메인을 지금 검증 기준으로 써도 되는 단계인가?

---

## 7. 문서 TF 검증 기준

문서 TF의 일반 문서 작업에서 검증은 다음과 같이 구분합니다.

### 7.1. 문서 TF의 검증 범위

문서 TF의 주요 검증 대상은 다음과 같습니다.

1. **문서 렌더링**: GitHub UI에서 Markdown 렌더링 확인
2. **링크 참조**: 내부/외부 링크 동작 확인
3. **파일 구조**: 문서 계층 구조의 일관성
4. **표현 일관성**: 용어, 카피의 일관성

### 7.2. 스크린샷 필요 여부

문서 TF 일반 작업에서 스크린샷은 필수 아닙니다.

1. **링크/참조 검증**: 링크가 정상 동작하는지만 확인
2. **렌더링 검증**: GitHub Preview 또는 로컬 Markdown으로 확인
3. **일관성 검증**: 용어, 구조의 일관성 확인

단, **GitHub UI 렌더링**이나 **외부 링크 동작**을 증빙할 때는 캡처가 유용합니다.

### 7.3. 문서 검증 체크리스트

문서 완료 전 다음 항목을 확인합니다.

1. [ ] Markdown 문법 오류 없음
2. [ ] 내부 링크가 정상 동작함
3. [ ] 외부 링크가 유효함
4. [ ] 이미지/스크린샷이 정상 표시됨
5. [ ] 용어가 일관됨
6. [ ] Heading 구조가 논리적임

---

## 8. GitHub UI 렌더링 및 링크 검증

### 8.1. GitHub UI 렌더링 검증이 필요한 경우

문서 수정 후 다음 경우에 GitHub UI에서의 렌더링을 확인합니다.

1. **표 (Table) 포함 문서**: GitHub Markdown 표 렌더링 방식 확인
2. **코드 블록**: 언어 지정 및 syntax highlighting 확인
3. **이미지 참조**: Markdown 이미지 표시 확인
4. **목록 중첩**: 중첩 목록의 들여쓰기 확인

### 8.2. 링크 검증 기준

| 링크 유형 | 검증 방법 | 캡처 권장 |
|----------|-----------|----------|
| 내부 링크 (`./xxx.md`) | 존재 여부 + GitHub Preview 확인 | 권장 |
| 외부 링크 | 실제 URL 접근 확인 | 필수 |
| 이미지 링크 | 이미지 표시 여부 확인 | 필수 |

### 8.3. 캡처 증빙의 활용

GitHub UI 검증 시 캡처 증빙을 활용하는 경우는 다음과 같습니다.

1. **링크 무효**: 클릭 시 404 발생하는 경우
2. **렌더링 불일치**: Markdown Preview와 GitHub UI가 다른 경우
3. **이미지 로드 실패**: 이미지가 표시되지 않는 경우

캡처는 반드시 **날짜별로 구분**하여 저장합니다.

---

## 9. 증빙 저장 원칙

### 9.1. 저장 경로 표준

증빙 스크린샷은 다음 경로에 저장합니다.

```
docs/verification/YYYY-MM-DD/
```

- `YYYY`: 연도 (4자리)
- `MM`: 월 (2자리)
- `DD`: 일 (2자리)

예시: `docs/verification/2026-04-24/`

### 9.2. 파일 Naming 표준

파일 Naming은 다음 형식을 따릅니다.

```
{날짜}_{페이지 또는 기능}_{해상도 또는 환경}_{순번}.{확장자}
```

예시:
- `2026-04-24_search-page_desktop-1920.png`
- `2026-04-24_search-page_mobile-375.png`
- `2026-04-24_detail-cards_11-loaded.png`

### 9.3. screenshot script 사용 예시

로컬 스크린샷 캡처가 필요한 경우 현재 cross-platform script는 prefix 인자를 사용할 수 있습니다.

```bash
node scripts/capture-screenshots.js --prefix xg-test
```

동일한 npm script는 아래와 같습니다.

```bash
npm run test:screenshots:xg
```

이 명령은 증빙 저장 원칙을 대체하지 않습니다. 산출물은 여전히 날짜별 경로와 파일 naming 표준에 맞춰 PR 증빙으로 정리합니다.

### 9.4. screenshot-only Branch 분리 원칙

스크린샷만 추가하는 브랜치는 다음 규칙을 따릅니다.

1. **브랜치 명명**: `verification/*`
2. **용도**: 스크린샷 또는 캡처 증빙 전용
3. **main 직접 Push 금지**: 항상 별도 PR로 병합

### 9.5. screenshot-only의 main 직접 Push 금지

 다음과 같은 경우 main에 직접 Push하지 않습니다.

1. **스크린샷만 추가**하는 경우
2. **캡처 증빙만 추가**하는 경우
3. **코드/문서 수정이 포함되지 않은** 경우

반드시 별도 브랜치에서 작업 후 PR로 병합합니다.

---

## 10. 보고서 작성 기준

### 10.1. 보고서에 반드시 포함할 항목

보고서에는 다음 항목을 반드시 포함합니다.

1. **작업 개요**: 목적, 범위, 기준 커밋
2. **검증 환경**: Cloudflare Preview, 테스트/프리뷰 URL, production, 로컬 등
3. **검증 항목별 결과**: 항목별 통과/미통과/추정
4. **미검증 항목**: 확인하지 못한 항목 명시
5. **스크린샷/캡처**: 필요시 경로 포함

### 10.2. 검증 결과 표기 형식

검증 결과는 다음 형식으로 표기합니다.

```markdown
| 항목 | 검증 방법 | 결과 | 근거 |
|------|-----------|------|------|
| search 페이지 카드 표시 | Cloudflare Preview + Desktop | 통과 | 스크린샷 (1) |
| search 페이지 Mobile | Cloudflare Preview + Mobile 375px | 통과 | 스크린샷 (2) |
| editor API 연결 | 로컬 코드 분석 | 추정 | API 경로 존재 확인 |
```

### 10.3. 추정(Estimate) 표기

추정으로 표기하는 경우는 반드시 그 이유를 함께 표기합니다.

```markdown
- editor API 연결: 추정 (로컬에서 API 경로 존재 확인, preview/prod 미검증)
```

---

## 11. 금지 사항

### 11.1. 검증 관련 금지 사항

1. **로컬 검증만으로 "검증 완료" 주장 금지**
2. **PR 병합 전 production 도메인만 보고 PR 검증 완료 주장 금지**
3. **Browse/Search/Editor/Auth/API 관련 화면을 로컬 정적 서버 단독으로 최종 판정 금지**
4. **preview/prod 미검증 항목의 완료 주장 금지**
5. **추정을 검증으로 위장하여 보고 금지**
6. **UI/기능 검증 결과는 캡처, 로그, URL 등 확인 근거 없이 단정 금지**

### 11.2. 증빙 관련 금지 사항

1. **main 직접 Push 금지** (항상 별도 브랜치 사용)
2. **screenshots-only의 main 직접 병합 금지**
3. **날짜 없는 스크린샷 저장 금지**
4. **Naming 표준 없는 스크린샷 저장 금지**

### 11.3. 보고 관련 금지 사항

1. **검증/미검증/추정 혼합 보고 금지**
2. **근거 없는 완료 표기 금지**
3. **미검증 항목을 누락하여 보고 금지**

---

## 12. 관련 문서

검증 및 증빙과 관련된 문서는 다음과 같습니다.

### 12.1. Project 문서

- [project_index.md](./project_index.md) — project 문서 허브
- [REPORTING_CHAIN.md](./REPORTING_CHAIN.md) — 보고선과 역할
- [BRANCHING_AND_REVIEW.md](./BRANCHING_AND_REVIEW.md) — 브랜치 원칙
- [TASK_STATUS.md](./TASK_STATUS.md) — 작업 상태 관리

### 12.2. Ops 문서

- [ops_index.md](../ops/ops_index.md) — ops 문서 인덱스
- [DEPLOY_CHECKLIST.md](../ops/DEPLOY_CHECKLIST.md) — 배포 체크리스트
- [DOC_WORKFLOW.md](../ops/DOC_WORKFLOW.md) — 문서 작업 흐름

### 12.3. 이 문서에서 다루지 않는 항목

- **코드 검증**: [ops/DEPLOY_CHECKLIST.md](../ops/DEPLOY_CHECKLIST.md) 참조
- **브라우저 검증**: 브라우저 자동화 Playwright 기준
- **API 검증**: [engineering/API_CONTRACT.md](../engineering/API_CONTRACT.md) 참조
