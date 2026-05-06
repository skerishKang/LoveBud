# Lovetree PR 체크리스트

## 1. 공통 필수 체크리스트 (모든 PR)

### Before PR
- [ ] 변경된 파일이 의도한 범위인지 확인
- [ ] console.log / debug 코드 제거 여부 확인
- [ ] 커밋 메시지가 작업 내용을 명확히 설명하는가

### Description 필수 항목
```
## 변경 요약
- 무엇을 변경했는가

## 변경된 파일
- src/xxx.js
- pages/xxx.html

## 영향 범위
- 표준 페이지 (index, community, my-trees, lovetree)
- 에디터 (editor.html)
- shared 계층

## Member Journey QA 영향
- 적용 대상: AUTH / FIRST_TREE / MY_TREES / EDITOR / PUBLIC_VIEWER / MOBILE / ERROR_RECOVERY / N/A
- 필요한 journey: docs/ops/MEMBER_JOURNEY_QA_SUITE.md 기준으로 기재
- fixed slot 필요 여부: YES / NO
- 브라우저 검증 필요 여부: YES / NO

## 실행한 테스트
- [ ] tests/smoke.spec.js 통과
- [ ] tests/editor-smoke.spec.js 통과
- [ ] tests/editor-fieldvalue.spec.js 통과

## 남은 리스크
- 예상되는 문제점 (있다면)
```

---

## 2. Member Journey QA 매핑

PR이 Auth, My Trees, Editor, Public Viewer, Browse/Search, 모바일 레이아웃, loading/error 상태에 영향을 주면 [MEMBER_JOURNEY_QA_SUITE.md](MEMBER_JOURNEY_QA_SUITE.md)를 기준으로 필요한 journey를 PR 본문에 명시해야 합니다.

### 필수 판단 항목

- [ ] 이 PR이 회원가입/로그인/로그아웃/세션 유지/보호 라우트에 영향을 주는가?
- [ ] 이 PR이 첫 트리 또는 첫 순간 생성에 영향을 주는가?
- [ ] 이 PR이 My Trees 로드/카드/열기/빈 상태에 영향을 주는가?
- [ ] 이 PR이 Editor canvas/detail/add/edit/save/cancel에 영향을 주는가?
- [ ] 이 PR이 Public Viewer 또는 public/private boundary에 영향을 주는가?
- [ ] 이 PR이 모바일 375px 또는 wider mobile layout에 영향을 주는가?
- [ ] 이 PR이 loading/empty/error/degraded/back recovery 상태에 영향을 주는가?

### PR 유형별 기본 journey

| PR 영향 범위 | 기본 요구 journey |
|--------------|-------------------|
| Auth / protected route | `AUTH_SIGNUP_LOGIN_JOURNEY`, `LOGOUT_AND_PROTECTED_ROUTE_JOURNEY` |
| First-create / persistence | `FIRST_TREE_CREATION_JOURNEY` |
| My Trees | `MY_TREES_RETURNING_USER_JOURNEY` |
| Editor | `EDITOR_MOMENT_EDITING_JOURNEY` |
| Public Viewer / read-only route | `PUBLIC_VIEWER_READONLY_JOURNEY` |
| Mobile-visible UI | `MOBILE_375_FULL_JOURNEY` |
| Loading/empty/error/degraded states | `ERROR_RECOVERY_JOURNEY` |
| Docs-only with no runtime claim | `N/A` |

### fixed slot gate

아래 범위는 최종 PASS에 fixed test slot + deployed SHA match + real browser가 필요합니다.

```text
Auth
My Trees
Editor
Browse/Search runtime
Public/private boundary
회원 데이터 생성/수정/삭제/저장
모바일 runtime-sensitive UI
```

Production은 별도 승인 없이는 non-destructive smoke만 허용합니다.

---

## 3. Editor 변경 시 체크리스트

### 사전 준비
- [ ] [docs/ops/EDITOR_ARCHITECTURE.md](docs/ops/EDITOR_ARCHITECTURE.md) 숙독
- [ ] 변경할 파일이 위험 파일 목록에 있는지 확인
  - `src/editor-bootstrap.js` (DB 할당) - 가장 위험
  - `src/editor-data.js` (FieldValue 사용)
  - `src/editor-comments.js` (FieldValue 사용)
  - `src/editor-actions.js` (FieldValue 사용)
  - `src/editor-runtime.js` (DB 인터페이스)

### 필수 테스트 실행
```bash
# Editor smoke 테스트
npx playwright test tests/editor-smoke.spec.js

# FieldValue 패턴 검증
npx playwright test tests/editor-fieldvalue.spec.js

# 두 테스트 모두 통과 시에만 merge 권장
```

### Editor 변경 시 주의사항
- ⚠️ editor-bootstrap.js 변경 시: 절대-runtime.db 할당 변경 금지
- ⚠️ FieldValue 관련 변경 시: editor-fieldvalue.spec.js 테스트 확인
- ⚠️ shared-layout.js 의존 시: shared 변경 체크리스트도 확인

### 검수 포인트
- [ ] editor-shell 초기화 정상 동작 확인 (app-loaded class)
- [ ] 로그인/비로그인 시 권한 동작 확인 (읽기 전용 배지)
- [ ] 에디터 내비게이션 (home/back) 정상 동작 확인
- [ ] console error 없는지 확인

---

## 4. Shared/Standard Page 변경 시 체크리스트

### 필수 테스트 실행
```bash
# 표준 페이지 smoke 테스트
npx playwright test tests/smoke.spec.js

# 에디터 shell 무결성 확인 (공용 의존성 확인)
npx playwright test tests/editor-smoke.spec.js

# 아키텍처 검증
npx playwright test tests/architecture-v2.spec.js

# FieldValue 패턴 검증 (shared 변경이 editor에 영향을 미칠 경우)
npx playwright test tests/editor-fieldvalue.spec.js
```

### 영향받는 페이지
- index.html
- pages/lovetree.html
- pages/community.html
- pages/my-trees.html
- pages/editor.html (공용 의존성)

### 검수 포인트
- [ ] 모든 표준 페이지에서 auth UI 정상 동작
- [ ] "로그인" → "내 트리" 전환 정상
- [ ] 로그아웃 버튼 show/hide 정상
- [ ] initStandardAuthUI 옵션 변경 시 페이지별 동작 확인

---

## 5. Merge Gate 제안

### Merge 가능 조건 (모두 충족)
1. ✅ CI/CD 파이프라인 통과 (Smoke 테스트)
2. ✅ PR description 필수 항목 포함
3. ✅ 최소 1명 Approve 획득
4. ✅ 테스트 실패 관련 코멘트 해결 완료
5. ✅ runtime-sensitive PR은 필요한 Member Journey QA와 fixed slot/SHA evidence 포함

### 테스트 실패 시 처리 원칙

#### Merge 차단 (항상)
- ❌ `editor-smoke.spec.js` - shell initialization 실패
- ❌ `editor-smoke.spec.js` - permission/read-only badge 실패
- ❌ `editor-smoke.spec.js` - navigation 실패
- ❌ `smoke.spec.js` - UI element presence 실패 (선택자가 실제 HTML과 불일치)
- ❌ `architecture-v2.spec.js` - app-loaded 플래그 미설정
- ❌ `architecture-v2.spec.js` - auth UI 텍스트不正确 (로그인→내 트리 전환 안 됨)
- ❌ console.error 또는 pageerror 발생

#### 수동 확인 후 진행 가능 (조건부)
- ⚠️ `smoke.spec.js` - 시각적 표시 실패 (captured screenshot 확인 후 Approve)
- ⚠️ `editor-fieldvalue.spec.js` - 소스 패턴만 변경되고 shim runtime 정상 동작 시 (network payload 검증으로 확인)
- ⚠️ Flaky 판단: 같은 테스트가 2회 연속 실패 시 재진행 후 재평가

### Merge Gate 명령어
```bash
# 전체 테스트
npm run test

# Editor 전용 smoke
npx playwright test tests/editor-smoke.spec.js

# Editor FieldValue 검증
npx playwright test tests/editor-fieldvalue.spec.js

# 표준 페이지 smoke
npx playwright test tests/smoke.spec.js

# 아키텍처 검증
npx playwright test tests/architecture-v2.spec.js
```

---

## 6. 테스트 종류별 역할 구분

> ⚠️ smoke.spec.js와 architecture-v2.spec.js는 서로 다른 것을 검증합니다. 혼동하지 마세요.

| 파일 | 검증 대상 | 통과 기준 | 역할 구분 |
|------|-----------|-----------|-----------|
| `smoke.spec.js` | **표준 페이지 UI 존재 확인** | 모든 CSS 선택자가 실제 HTML과 일치 | E2E/UI Presence |
| `architecture-v2.spec.js` | **아키텍처/보안 검증** | app-loaded 플래그 + auth 중복 방지 + 에러 마스킹 | System Guard |
| `editor-smoke.spec.js` | **에디터 쉘 무결성** | 초기화 + 읽기전용 배지 + 상단 내비게이션 | Editor Shell Integrity |
| `editor-fieldvalue.spec.js` | **FieldValue Shim 변환** | 소스 패턴(Layer A) + 네트워크 Payload(Layer B) | Data Consistency Shim |

### 테스트 실행 시나리오별 분류

| 시나리오 | 실행할 테스트 | 확인 내용 |
|----------|---------------|-----------|
| Shared/표준 페이지 수정 | `smoke.spec.js` + `architecture-v2.spec.js` | UI presence + 아키텍처 준수 |
| Editor 공통 의존성 수정 | `smoke.spec.js` + `architecture-v2.spec.js` + `editor-smoke.spec.js` | 표준 페이지 + 에디터 쉘 모두 |
| FieldValue 코드 수정 | `editor-fieldvalue.spec.js` | shim 변환 정상 동작 |
| Shared + FieldValue 동시 수정 | 위 4개 모두 | 전체 무결성 |

---

## 7. 빠른 참조 명령어

```bash
# 전체 테스트
npm run test

# Editor 전용
npx playwright test tests/editor-smoke.spec.js
npx playwright test tests/editor-fieldvalue.spec.js

# Standard Page 전용
npx playwright test tests/smoke.spec.js

# 아키텍처 검증
npx playwright test tests/architecture-v2.spec.js
```