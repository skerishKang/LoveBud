# Editor 아키텍처 및 운영 가이드

> 이 문서는 editor.html 과 editor-*.js 파일들의 아키텍처를 정리한 운영 문서입니다.
> 다음 스프린트의 editor 리팩터링工作时 참고용으로 사용하세요.

## 1. Editor 로드 순서

### 1.1 스크립트 로드 단계

```
editor.html (총 37개 스크립트 - 5개 Firebase SDK + 32개 src 파일)
│
├─ [1단계] Firebase SDK (4개, CDN)
│   ├─ firebase-app-compat.js
│   ├─ firebase-auth-compat.js
│   ├─ firebase-storage-compat.js
│   └─ firebase-app-check-compat.js
│
├─ [2단계] postgres-client (가장 먼저 로드됨, line 33)
│   └─ postgres-client-browser.js → window.postgresDB 초기화
│
├─ [3단계] youtube + runtime-config (2개)
│   ├─ youtube iframe_api
│   └─ runtime-config.js
│
├─ [4단계] shared-* (6개)
│   ├─ shared-storage.js
│   ├─ shared-dom.js
│   ├─ shared-theme.js
│   ├─ shared-layout.js
│   ├─ shared-utils.js
│   └─ shared.js
│
├─ [5단계] auth
│   └─ auth.js
│
├─ [6단계] editor-ai-* (6개)
│   ├─ editor-ai-utils.js
│   ├─ editor-ai-ui.js
│   ├─ editor-ai-logic.js
│   ├─ editor-ai-tree-editor.js
│   ├─ editor-ai-actions.js
│   └─ entries/editor_ai.js
│
├─ [7단계] editor-core (5개)
│   ├─ editor-header.js
│   ├─ editor-ui.js
│   ├─ editor-data.js
│   ├─ editor-comments.js
│   └─ editor-pointer.js
│
├─ [8단계] editor-detail + actions (3개)
│   ├─ editor-detail-media.js
│   ├─ editor-detail.js
│   └─ editor-actions.js
│
├─ [9단계] editor-visualization (3개)
│   ├─ editor-minimap.js
│   ├─ editor-tree-view.js
│   └─ editor-timeline.js
│
└─ [10단계] editor-bootstrap + runtime (6개)
    ├─ editor-bootstrap.js
    ├─ editor-orchestration.js
    ├─ editor-render-ui.js
    ├─ editor-render-main.js
    ├─ editor-runtime.js
    └─ editor-page-init.js
```

> **참고**: postgres-client-browser.js는 line 33에 위치하여 Firebase SDK 직후 가장 먼저 로드됩니다.
> 이 파일이 `window.postgresDB`를 초기화하므로 editor 전체의 데이터 접근 가능성을担합니다.

### 1.2 초기화 단계

```javascript
// editor-bootstrap.js 에서 수행
async function initApp(runtime) {
    // 1. 인증 대기
    runtime.currentUser = await waitForAuth();
    
    // 2. DB 연결 (핵심: window.postgresDB 할당)
    runtime.db = window.postgresDB;  // ⚠️ 이 줄은 절대 건드리면 안됨
    runtime.auth = firebase.auth();
    runtime.storage = firebase.storage();
    
    // 3. 트리 데이터 로드
    await window.EditorDataHelpers.loadData(runtime);
    
    // 4. UI 초기화
    window.EditorDataHelpers.updateUIForReadOnly(runtime);
}
```

---

## 2. Editor 데이터 읽기/쓰기 흐름

### 2.1 데이터 읽기 (READ)

```
editor-data.js: loadData(runtime)
    │
    ├─ runtime.db.collection('trees').doc(treeId).get()
    │       │
    │       ▼
    │   firebase-firestore-compat.js (shim)
    │       │
    │       ▼
    │   POST /api/firestore
    │       │
    │       ▼
    │   netlify/functions/firestore-api.js
    │       │
    │       ▼
    │   Neon/PostgreSQL (실제 데이터)
    │
    └─ runtime.currentTreeDocData = snapshot.data()
```

### 2.2 데이터 쓰기 (WRITE)

```
editor-data.js: saveData(runtime)
    │
    └─ runtime.db.collection('trees').doc(treeId).set(treeData)
            │
            ▼ (동일 경로로 PostgreSQL에 저장)
```

### 2.3 특수 연산 (FieldValue)

| 연산 | shim 처리 방식 |
|------|----------------|
| `FieldValue.increment(n)` | shim이 `{__firestoreTransform: true, type: 'increment', operand: n}` 객체로 변환하여 서버에서 처리 |
| `FieldValue.serverTimestamp()` | shim이 `{__firestoreTransform: true, type: 'serverTimestamp'}` 객체로 변환하여 서버에서 현재 시간으로 대체 |
| `FieldValue.delete()` | shim이 `{__firestoreTransform: true, type: 'delete'}` 객체로 변환하여 서버에서 해당 필드 제거 |

---

## 3. Shared 계층과 Editor 계층 경계

### 3.1 경계 다이어그램

```
┌─────────────────────────────────────────────────────────────────┐
│                        Shared 계층                              │
│  (index, community, my-trees, editor 공용)                      │
├─────────────────────────────────────────────────────────────────┤
│  shared-storage.js    │ 로컬 스토리지 접근                      │
│  shared-dom.js        │ DOM 조작 유틸                           │
│  shared-theme.js      │ 테마/다크모드                           │
│  shared-layout.js     │ GNB, Auth UI (initStandardAuthUI)     │
│  shared-utils.js      │ 공통 유틸리티                           │
│  shared.js            │ 핵심 공유 로직                          │
│  auth.js              │ Firebase Auth (로그인/세션)             │
│  postgres-client-browser.js │ window.postgresDB 초기화          │
└─────────────────────────────────────────────────────────────────┘
                              │
                    ⚠️ 경계: editor-bootstrap.js:18
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                        Editor 계층                              │
│  (editor.html 만 사용)                                          │
├─────────────────────────────────────────────────────────────────┤
│  editor-*-js 15개 파일                                         │
│  runtime.db = window.postgresDB (Shared에서 초기화)              │
│  window.EditorDataHelpers.* (editor-data.js)                    │
│  window.EditorUiHelpers.* (editor-ui.js)                         │
│  window.EditorDetailHelpers.* (editor-detail.js)               │
│  window.EditorActionsHelpers.* (editor-actions.js)             │
└─────────────────────────────────────────────────────────────────┘
```

### 3.2 경계 책임 분장

| 구분 | Shared 계층 | Editor 계층 |
|------|-------------|-------------|
| **역할** | 인증, 레이아웃, 테마, 공통 유틸 | 트리 편집, 렌더링, 저장 |
| **데이터 접근** | N/A | `runtime.db` |
| **주요 진입점** | `initStandardAuthUI()` | `editor-bootstrap.js:initApp()` |
| **변경 시 영향** | 모든 페이지 | editor만 영향 |

---

## 4. FieldValue 사용처 목록

| 파일 | 라인 | FieldValue 유형 | 용도 | shim 처리 |
|------|------|-----------------|------|-----------|
| `editor-data.js` | 38 | `.increment(1)` | viewCount 증가 | ✅ 처리됨 |
| `editor-data.js` | 39 | `.serverTimestamp()` | lastOpened 시간 | ✅ 처리됨 |
| `editor-comments.js` | 92 | `.serverTimestamp()` | 댓글 생성 시간 | ✅ 처리됨 |
| `editor-actions.js` | 68 | `.increment(1)` | shareCount 증가 | ✅ 처리됨 |

**총 4건** - 모두 shim이 PostgreSQL 연산으로 변환하여 처리하므로 현재는 정상 작동합니다.

---

## 5. ⚠️ 건드리면 위험한 핵심 파일

### 5.1 위험도 순위

| 순위 | 파일 | 라인 | 위험도 | 이유 |
|------|------|------|--------|------|
| 1 | `editor-bootstrap.js` | 18 | 🔴 **Extremely High** | `runtime.db = window.postgresDB` 핵심 할당. 모든 데이터 접근의 근본 |
| 2 | `editor-data.js` | 36-39 | 🔴 **High** | FieldValue 사용하여 viewCount, lastOpened 저장. shim 의존 |
| 3 | `editor-comments.js` | 92 | 🔴 **High** | 댓글 FieldValue 사용. 댓글 저장 실패 가능 |
| 4 | `editor-actions.js` | 66-68 | 🔴 **High** | shareCount FieldValue. 공유 카운트 오류 가능 |
| 5 | `editor-runtime.js` | 8-9 | 🟡 **Medium** | runtime.db getter/setter. 잘못 변경 시 모든 editor 데이터 접근 오류 |

### 5.2 절대 건드리면 안 되는 작업

```
❌ editor-bootstrap.js:18 라인 삭제 또는 이동
❌ runtime.db = window.postgresDB 를 다른 값으로 변경
❌ editor-data.js 에서 FieldValue 연산 제거 (shim 처리 의존)
❌ editor-comments.js 에서 FieldValue.serverTimestamp() 제거
❌ editor-runtime.js 에서 db getter/setter 시그니처 변경
```

### 5.3 변경 가능한 작업

```
✅ editor-ui.js 에서 UI 로직 수정
✅ editor-render-*.js 에서 렌더링 로직 수정
✅ editor-detail.js 에서 상세 모달 로직 수정
✅ editor-timeline.js 에서 타임라인 UI 수정
✅ editor-comments.js 에서 댓글 UI/로직 수정 (FieldValue 제외)
```

---

## 6. 다음 스프린트 선행조건

### 6.1 FieldValue 제거 작업

| 선행조건 | 설명 | 예상 시간 |
|----------|------|----------|
| shim FieldValue 구현机理 분석 | `firebase-firestore-compat.js`의 FieldValue 변환 로직 이해 | 2시간 |
| PostgreSQL 대안 연산 확인 | `__firestoreTransform` 처리 부분을 직접 구현할지 결정 | 1시간 |
| 테스트 환경 준비 | editor-basic.js 테스트 스위트 확인 | 1시간 |

### 6.2 shared 계층 분리 작업

| 선행조건 | 설명 | 예상 시간 |
|----------|------|----------|
| 15개 editor 파일 의존성 분석 | 각 editor-*.js 가 shared-* 를 어떻게 참조하는지 파악 | 2시간 |
| shared-* 파일 개별 분석 | 각 shared 파일이 editor에 미치는 영향 범위 파악 | 2시간 |
| 변경 영향 범위 파악 | shared 변경 시 editor 테스트 범위 결정 | 1시간 |

### 6.3 권고 진행 순서

```
1순위: editor-data.js 부터 점진적 FieldValue 제거
       (상대적으로 독립적所以서 위험도 낮음)

2순위: editor-bootstrap.js 안전하게 문서화
       (이 줄만 건드리면 안 된다는 것을 명확히 기록)

3순위: editor-runtime.js 테스트 커버리지 확대
       (runtime 접근 로직 검증)
```

---

## 7. 빠른 참조

### 7.1 필수 테스트 (Editor 작업 시)

| 상황 | 실행 테스트 | 확인 내용 |
|------|-------------|-----------|
| **Shared 로직 수정 시** | `npx playwright test tests/editor-smoke.spec.js` | 에디터 shell 무결성 |
| **FieldValue 관련 코드 수정 시** | `npx playwright test tests/editor-fieldvalue.spec.js` | shim 변환 검증 (아래 2개 레이어) |
| **에디터 초기화 변경 시** | `npx playwright test tests/editor-smoke.spec.js` + `tests/editor-fieldvalue.spec.js` | 전체 무결성 |

#### editor-fieldvalue.spec.js 검증 레이어 (Data Integrity)

| 레이어 | 검증 방식 | 검증 내용 | 목적 |
|--------|-----------|-----------|------|
| **Layer A: 소스 패턴** | Static Check (fetch) | `FieldValue.increment` 등의 호출이 소스에 있는지 확인 | 의도치 않은 코드 제거 방지 |
| **Layer B: 런타임 Payload** | Network Intercept | `__firestoreTransform` 객체가 포함된 POST 요청 캡처 | Shim 변환 및 소켓 무결성 보장 |

**보증 범위:**
- ✅ 소스에서 FieldValue 호출 존재 확인 (리팩터링 중 제거 방지)
- ✅ shim이 올바른 transform 객체를 생성하는지 확인
- ✅ POST /api/firestore 요청에 __firestoreTransform이 포함되는지 확인
- ❌ server-side applyTransform() in document-store.js는 검증하지 않음 (별도 테스트 필요)

**예시: FieldValue.increment(1) 제거 시**
- 레이어 A(Test 1): ❌ FAIL - 소스에서 패턴을 찾을 수 없음
- 레이어 B(Test 5-9): ❌ FAIL - transform 객체가 생성되지 않음

### 7.2 핵심 명령어

| 명령어 | 위치 | 용도 |
|--------|------|------|
| `window.postgresDB` | editor-bootstrap.js:18 | 데이터 접근 |
| `runtime.currentUser` | editor-bootstrap.js:10 | 현재 로그인 사용자 |
| `runtime.treeId` | editor-runtime.js | 편집 중인 트리 ID |
| `window.EditorDataHelpers.loadData()` | editor-data.js | 트리 데이터 로드 |
| `window.EditorDataHelpers.saveData()` | editor-data.js | 트리 데이터 저장 |

### 7.3 디버깅 포인트

| 포인트 | 파일 | 확인 방법 |
|--------|------|-----------|
| DB 연결 확인 | editor-bootstrap.js:18 | `console.log(runtime.db)` |
| 데이터 로드 확인 | editor-data.js | `console.log(runtime.currentTreeDocData)` |
| auth 상태 확인 | editor-bootstrap.js:10 | `console.log(runtime.currentUser)` |

---

## 8. 변경 이력

| 날짜 | 변경자 | 변경 내용 |
|------|--------|----------|
| 2026-04-13 | Sisyphus | 초기 문서 작성 (editor 아키텍처 분석 결과 기반) |

---

> **참고**: 이 문서는 다음 스프린트의 editor 리팩터링工作时 기준 문서로 사용됩니다.
> Shared 계층 변경 시 반드시 editor 테스트를 수행하세요.