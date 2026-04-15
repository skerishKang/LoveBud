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

## 실행한 테스트
- [ ] tests/smoke.spec.js 통과
- [ ] tests/editor-smoke.spec.js 통과
- [ ] tests/editor-fieldvalue.spec.js 통과

## 남은 리스크
- 예상되는 문제점 (있다면)
```

---

## 2. Editor 변경 시 체크리스트

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

## 3. Shared/Standard Page 변경 시 체크리스트

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

## 4. Merge Gate 제안

### Merge 가능 조건 (모두 충족)
1. ✅ CI/CD 파이프라인 통과 (Smoke 테스트)
2. ✅ PR description 필수 항목 포함
3. ✅ 최소 1명 Approve 획득
4. ✅ 테스트 실패 관련 코멘트 해결 완료

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

## 5. 테스트 종류별 역할 구분

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

## 6. 빠른 참조 명령어

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