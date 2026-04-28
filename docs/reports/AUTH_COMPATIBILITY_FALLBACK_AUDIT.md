# AUTH COMPATIBILITY FALLBACK AUDIT

> **Audit Date:** 2026-04-28  
> **Branch:** `audit/auth-compatibility-fallbacks`  
> **Related Issues:** #224 (primary), #220 (reference), #211 (Auth/Login stabilization baseline)  
> **Auditor:** Web Executor (Perplexity AI)  
> **Scope:** Audit-only. No code changes made to auth, login, or firebase files.

---

## 1. 현재 Script Loading Order

### pages/login.html (기준 페이지)

```
[1]  firebase-app.js          (CDN, v8.10.1)          — Firebase SDK
[2]  firebase-auth.js         (CDN, v8.10.1)          — Firebase Auth SDK
[3]  js/firebase-config.js    (local)                 — FIREBASE_CONFIG, initFirebase(), FIREBASE_INIT_FLAG
[4]  js/i18n/i18n-core.js
[5]  js/i18n/i18n-shared.js
[6]  ...i18n 파일들...
[7]  js/i18n.js
[8]  js/shared-header.js
[9]  js/auth/auth-state.js    — window.LoveBudAuthState
[10] js/auth/auth-callbacks.js— window.LoveBudAuthCallbacks
[11] js/auth/auth-cache.js    — window.LoveBudAuthCache
[12] js/auth/auth-ui.js       — window.LoveBudAuthUI
[13] js/auth/auth-session.js  — window.LoveBudAuthSession
[14] js/auth/auth-firebase.js — window.LoveBudAuthFirebase
[15] js/login/login-dom.js    — (DOM 바인딩 헬퍼)
[16] js/login/login-page.js   — window.LoveBudLoginPageController (또는 내부)
[17] js/auth/auth-login-page.js — window.LoveBudAuthLoginPage
[18] js/auth.js               — 진입점 / orchestrator / fallback monolith
[19] js/login-page.js         — window.LoveBudLoginPageController (최종 노출)
```

**핵심 패턴:**  
`js/auth/*` 모듈들이 먼저 로드되어 `window.LoveBudAuthXxx` globals를 설정하고,  
`js/auth.js`가 마지막에 로드되어 이 globals를 참조하며 orchestration을 수행한다.  
`js/auth.js`는 각 모듈이 없을 때를 위한 **inline fallback 구현**을 모두 내장하고 있다.

---

## 2. Window Global Contract 목록

| Global | 정의 파일 | 소비 파일 | 용도 |
|--------|-----------|-----------|------|
| `window.LoveBudAuthState` | `js/auth/auth-state.js` | `js/auth.js` | EMAIL_AUTH_MODE, flags, listener state |
| `window.LoveBudAuthCallbacks` | `js/auth/auth-callbacks.js` | `js/auth.js` | registerOnAuthReady, fireAuthReadyCallbacks |
| `window.LoveBudAuthCache` | `js/auth/auth-cache.js` | `js/auth.js` | localStorage 캐시 CRUD |
| `window.LoveBudAuthUI` | `js/auth/auth-ui.js` | `js/auth.js` | DOM 빌더, markAuthReady, updateNavUI |
| `window.LoveBudAuthSession` | `js/auth/auth-session.js` | `js/auth.js` | getRedirectTarget, preloadRedirectTargetData |
| `window.LoveBudAuthFirebase` | `js/auth/auth-firebase.js` | `js/auth.js` | initAuth, signInWithGoogle, signOut, initOfflineAuth |
| `window.LoveBudAuthLoginPage` | `js/auth/auth-login-page.js` | `js/auth.js` | login page form 위임 수신자 |
| `window.LoveBudLoginPageController` | `js/login/login-page.js` | `js/auth.js` | login page form 위임 수신자 (2nd priority) |
| `window.LoveBudAuthBootstrap` | `js/auth.js` | 모든 protected pages | whenReady(), resolve(), getSnapshot() |
| `window.registerOnAuthReady` | `js/auth.js` | editor, my-trees, search 등 | auth ready 콜백 등록 |
| `window.signInWithGoogle` | `js/auth.js` | login.html 인라인 / 다른 페이지 | Google 로그인 |
| `window.signOut` | `js/auth.js` | 드롭다운 버튼 | 로그아웃 |
| `window.initAuth` | `js/auth.js` | DOMContentLoaded (자동 실행) | Auth 초기화 진입점 |
| `window.getConfirmedAuthUser` | `js/auth.js` | protected pages | 캐시된 인증 유저 반환 |
| `window.hasConfirmedAuthSession` | `js/auth.js` | protected pages | 캐시 기반 세션 확인 |
| `window.getCachedAuthToken` | `js/auth.js` | API 클라이언트 | localStorage 토큰 반환 |
| `window.getBasePath` | `js/auth.js` | shared-header 등 | 경로 컨텍스트 |
| `window.__onAuthReadyCallbacks` | `js/auth.js` | 콜백 배열 패턴 | 배열 기반 콜백 컨테이너 |
| `window.__lovebudAuthInitialized` | `js/auth.js` | auth 중복 초기화 방지 | init flag |
| `window.__lovebudAuthReady` | `js/auth.js` | auth ready 상태 | ready flag |
| `window.initFirebase` | `js/firebase-config.js` | `js/auth.js`, pages | Firebase 초기화 |
| `FIREBASE_CONFIG` | `js/firebase-config.js` | `js/firebase-config.js` 내부 | Firebase 설정 객체 |
| `FIREBASE_INIT_FLAG` | `js/firebase-config.js` | `js/firebase-config.js` 내부 | Firebase 초기화 flag |

---

## 3. Fallback / Compatibility 목록 (auth.js 내 확인된 항목)

| # | 패턴 | 위치 (auth.js) | 소유 모듈 | 설명 |
|---|------|---------------|-----------|------|
| F-01 | `__authStateModule` null fallback | 상단 var 선언부 | `auth-state.js` | EMAIL_AUTH_MODE, AUTH_INIT_FLAG, AUTH_READY_FLAG, DROPDOWN_LISTENER_ATTACHED 로컬 재선언 |
| F-02 | `__authUiModule` null fallback | `markAuthLoading`, `markAuthReady`, `getBasePath`, `escapeHtml`, `buildLoginButton`, `getUserAvatarInitial`, `buildUserDropdown`, `updateNavUI`, `attachDropdownListener` | `auth-ui.js` | 9개 함수에 동일 패턴 |
| F-03 | `__authCacheModule` null fallback | `getCachedAuthUser`, `setConfirmedAuthCache`, `clearConfirmedAuthCache`, `getCachedAuthToken`, `persistConfirmedAuthSession`, `isInvalidAuthSessionError`, `clearStaleFirebaseAuthState` | `auth-cache.js` | 7개 함수에 동일 패턴 |
| F-04 | `__authSessionModule` null fallback | `preloadRedirectTargetData`, `getRedirectTarget` | `auth-session.js` | 2개 함수 |
| F-05 | `__authFirebaseModule` null fallback | `applyCachedAuthState`, `initAuth`, `initOfflineAuth`, `getEnvironmentCheckError`, `getFriendlyErrorMessage`, `signInWithGoogle`, `signOut` | `auth-firebase.js` | 7개 함수 |
| F-06 | `__authCallbacksModule` null fallback | `registerOnAuthReady`, `fireAuthReadyCallbacks` | `auth-callbacks.js` | 2개 함수 |
| F-07 | `callLoginPageModule` 이중 위임 | `setupGoogleBtn`, `setupEmailAuthForm`, `setupSignupForm`, `setupSignupGoogleBtn`, `syncEmailAuthModeUi`, `setupLoginPageAuthUi` | `auth-login-page.js` + `login-page.js` | `LoveBudAuthLoginPage` 없으면 `LoveBudLoginPageController` 시도, 둘 다 없으면 인라인 실행 |
| F-08 | `var EMAIL_AUTH_MODE` 이중 선언 | 상단 / `resolveEmailAuthMode()` 내부 | `auth-state.js` | 모듈 없을 때 URL params 재파싱 |
| F-09 | Firebase SDK 없음 fallback | `initAuth()` 내부 | N/A | `typeof firebase === 'undefined'` → `initOfflineAuth()` |
| F-10 | Firebase apps 미초기화 fallback | `initAuth()` 내부 | N/A | `firebase.apps.length === 0` → `initOfflineAuth()` |
| F-11 | 2초 auth timeout → offline fallback | `initAuth()` 내부 | N/A | Firebase onAuthStateChanged 무응답 시 오프라인 전환 |
| F-12 | `AUTH_INIT_FLAG` 중복 실행 방지 | `initAuth()` 내부 | `auth-state.js` | 이미 초기화된 경우 early return |
| F-13 | `isLoginPage` 로컬 재구현 | `applyCachedAuthState()` 내부 | `auth-state.js` | 함수 아닌 인라인 pathname 체크 |

**총 fallback 분기: 약 35+개 (13개 그룹, 함수 단위로는 29개)**

---

## 4. 각 Fallback의 소유 파일

| 소유 파일 | 관련 Fallback 그룹 | 모듈 window global |
|-----------|-------------------|--------------------|
| `js/auth/auth-state.js` | F-01, F-08, F-12, F-13 | `window.LoveBudAuthState` |
| `js/auth/auth-ui.js` | F-02 | `window.LoveBudAuthUI` |
| `js/auth/auth-cache.js` | F-03 | `window.LoveBudAuthCache` |
| `js/auth/auth-session.js` | F-04 | `window.LoveBudAuthSession` |
| `js/auth/auth-firebase.js` | F-05 | `window.LoveBudAuthFirebase` |
| `js/auth/auth-callbacks.js` | F-06 | `window.LoveBudAuthCallbacks` |
| `js/auth/auth-login-page.js` + `js/login/login-page.js` | F-07 | `window.LoveBudAuthLoginPage` / `window.LoveBudLoginPageController` |
| Firebase SDK (external) | F-09, F-10, F-11 | N/A |

---

## 5. 삭제/축소 가능 여부

| Fallback 그룹 | 삭제 가능? | 조건 |
|--------------|-----------|------|
| F-01 (auth-state fallback) | ✅ 가능 | `auth-state.js`가 항상 먼저 로드됨이 모든 HTML에서 보장되면 |
| F-02 (auth-ui fallback) | ✅ 가능 | `auth-ui.js` 로드 보장 시 |
| F-03 (auth-cache fallback) | ✅ 가능 | `auth-cache.js` 로드 보장 시 |
| F-04 (auth-session fallback) | ✅ 가능 | `auth-session.js` 로드 보장 시 |
| F-05 (auth-firebase fallback) | ✅ 가능 | `auth-firebase.js` 로드 보장 시 |
| F-06 (auth-callbacks fallback) | ✅ 가능 | `auth-callbacks.js` 로드 보장 시 |
| F-07 (login page 이중 위임) | ⚠️ 부분 가능 | `LoveBudLoginPageController` 경로 제거 후 `LoveBudAuthLoginPage` 단일화 필요 |
| F-08 (EMAIL_AUTH_MODE 이중 선언) | ✅ 가능 | F-01과 같이 처리 |
| F-09 (Firebase SDK 없음) | ❌ 보류 | 네트워크 장애 시 CDN 미로드 가능성 있음 — offline fallback 필수 |
| F-10 (firebase.apps 미초기화) | ❌ 보류 | 타이밍 race condition 방어 코드 — 제거 위험 |
| F-11 (2초 timeout) | ❌ 보류 | Firebase 무응답 대비 UX 안전장치 — 제거 금지 |
| F-12 (중복 초기화 방지) | ❌ 보류 | `DOMContentLoaded` 중복 바인딩 방어 |
| F-13 (isLoginPage 인라인 재구현) | ✅ 가능 | F-01과 함께 제거 — `auth-state.js`의 `isLoginPage()` 위임으로 통일 |

---

## 6. 삭제하면 위험한 이유

### F-09, F-10 — Firebase SDK / 앱 미초기화 방어
- Firebase는 CDN으로 로드됨. 네트워크 지연/차단 시 `firebase` 전역이 undefined일 수 있음
- `firebase.apps.length === 0` 체크 없이 `firebase.auth()` 호출하면 **런타임 crash**
- 삭제 시 로그인 페이지 white screen 발생 가능

### F-11 — 2초 auth timeout
- Firebase `onAuthStateChanged`는 네트워크 불량 환경에서 수초~수십초 지연 가능
- 타임아웃 없으면 사용자가 **auth-nav가 빈 상태로 무한 대기**
- 오프라인/저속 환경 UX 핵심 안전장치

### F-12 — AUTH_INIT_FLAG 중복 초기화 방지
- `DOMContentLoaded`가 복수 스크립트에서 바인딩될 경우 또는 SPA 네비게이션 시
- 제거 시 `firebase.auth().onAuthStateChanged` **다중 등록** → 콜백 중복 실행

### F-07 — login page 이중 위임
- `LoveBudLoginPageController`와 `LoveBudAuthLoginPage`가 동시에 존재
- 현재 `js/login-page.js`(루트)와 `js/auth/auth-login-page.js`의 역할 분리가 완전히 정리되지 않은 상태
- **한쪽을 지우면 다른 쪽 바인딩이 누락**될 수 있음 → form 이벤트 미등록

---

## 7. 권장 PR 순서

### PR-1: `refactor(auth): assert module loading contract in all HTML pages`
- **목표:** js/auth/* 모듈들이 auth.js보다 **항상 먼저** 로드됨을 모든 HTML에서 검증 및 정렬 확인
- **선결 조건:** PR-1 통과 후에만 F-01~F-06 fallback 제거 가능
- **허용 파일:** `pages/*.html`, `index.html` (script 태그 순서 검토 전용)
- **금지 파일:** `js/auth.js`, `js/auth/*`, `js/login/*`, `js/firebase-config.js`
- **검증:** 모든 페이지에서 auth-state → auth-callbacks → auth-cache → auth-ui → auth-session → auth-firebase → auth-login-page → auth.js 순서 확인

### PR-2: `refactor(auth): remove inline fallbacks for confirmed sub-modules`
- **목표:** F-01~F-06, F-08, F-13 — 서브 모듈이 존재하는 경우의 `if (__authXxxModule)` 분기 + 인라인 구현 제거
- **선결 조건:** PR-1 merged, 모든 페이지에서 로딩 순서 검증 완료
- **허용 파일:** `js/auth.js`만 수정
- **금지 파일:** `js/auth/*`, `js/login/*`, `js/firebase-config.js`
- **검증:** 기존 contract tests 전체 통과 + browser smoke (아래 항목)

### PR-3: `refactor(auth): unify login page controller to single module`
- **목표:** F-07 — `LoveBudLoginPageController` / `LoveBudAuthLoginPage` 이중 위임을 단일 경로로 정리
- **선결 조건:** PR-2 merged
- **허용 파일:** `js/auth/auth-login-page.js`, `js/login/login-page.js`, `js/auth.js` (callLoginPageModule 수정)
- **금지 파일:** `js/firebase-config.js`, `pages/login.html` (form 구조 변경 금지), `js/login-page.js` (루트, 별도 검토 필요)
- **검증:** login.html Google 로그인 / 이메일 로그인 / 회원가입 전체 smoke

> ⛔ **F-09, F-10, F-11, F-12는 3개 PR 모두에서 수정 금지**

---

## 8. 각 PR별 허용 파일 / 금지 파일 요약

| PR | 허용 수정 | 금지 수정 |
|----|-----------|----------|
| PR-1 | `pages/*.html`, `index.html` | `js/auth.js`, `js/auth/*`, `js/login/*`, `js/firebase-config.js` |
| PR-2 | `js/auth.js` | `js/auth/*`, `js/login/*`, `js/firebase-config.js`, `pages/*.html` |
| PR-3 | `js/auth/auth-login-page.js`, `js/login/login-page.js`, `js/auth.js` | `js/firebase-config.js`, login.html form, protected route behavior |

---

## 9. 필요한 Browser Smoke 항목

각 PR 이후 최소 수동 smoke 확인 항목:

### Auth 공통
- [ ] 로그인 상태에서 페이지 새로고침 → auth-nav 즉시 표시 (cached UI)
- [ ] 비로그인 상태에서 페이지 새로고침 → 로그인 버튼 표시
- [ ] 네트워크 오프라인 시 페이지 로드 → 캐시된 auth 상태 표시
- [ ] Firebase 2초 초과 무응답 시 → 오프라인 모드 진입 확인

### Login 페이지
- [ ] Google 로그인 버튼 동작
- [ ] 이메일 로그인 모달 열기
- [ ] 이메일 로그인 submit
- [ ] 이메일 회원가입 모달 전환
- [ ] 이메일 회원가입 submit
- [ ] 로그인 후 redirect 대상 이동

### Protected Pages (editor, my-trees, search)
- [ ] 비로그인 → login 페이지로 redirect
- [ ] 로그인 → 정상 진입
- [ ] `window.LoveBudAuthBootstrap.whenReady()` resolve 확인
- [ ] `window.registerOnAuthReady(cb)` 콜백 실행 확인
- [ ] 로그아웃 후 상태 초기화 확인

---

## 10. npm test 결과

> **참고:** npm test는 CI 환경에서 실행해야 하며, 이 audit 브랜치에서는 직접 실행 불가.  
> 기존 contract 테스트 파일 목록(GitHub 기준):

- `tests/contracts/auth-bootstrap-contract.test.js`
- `tests/contracts/auth-confirmed-session-retry.test.js`
- `tests/contracts/auth-offline-mode.test.js`
- `tests/contracts/auth-policy-module.test.js`
- `tests/contracts/auth-wait-policy.test.js`
- `tests/contracts/login-controller-skeleton-contract.test.js`

**PR-2 이전 조건:** 위 6개 테스트가 모두 green이어야 fallback 제거 진행 가능.

---

## 11. 다음 리팩터링 가능 여부

| 단계 | 가능 여부 | 사유 |
|------|-----------|------|
| PR-1 (HTML 순서 검증) | ✅ 즉시 가능 | audit-only에 준하는 비파괴 작업 |
| PR-2 (inline fallback 제거) | ⚠️ PR-1 이후 | HTML 로딩 보장 선행 필요 |
| PR-3 (login controller 단일화) | ⚠️ PR-2 이후 | auth.js fallback 제거 후 단일 경로 전제 |
| Firebase SDK 업그레이드 (v8→v9+) | ❌ 별도 이슈 | 네임스페이스 방식 변경 → 전체 auth.js 재작성 수준 |
| type="module" 전환 | ❌ 금지 | 현재 browser global 계약 전체를 무효화 |

---

*Generated by Web Executor audit pass. No production files modified.*
