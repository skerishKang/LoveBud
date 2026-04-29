# QA 계정 사용 정책

이 문서는 LoveBud 브라우저 검증용 QA 계정 운영 정책을 정의합니다.

---

## 1. Purpose

- 브라우저 smoke 검증용 QA 계정 운영 기준
- 자동화된 브라우저 검증 테스트에서 사용되는 계정의 보안 및 운영 규칙 정의

---

## 2. Account Types

| 타입 | 이메일 | 용도 | 상태 |
|------|--------|------|
| Internal QA Admin | `admin.test@lovetree.dev` | 관리 기능 검증 | 활성 |
| Internal QA User | `user.test@lovetree.dev` | 일반 사용자 흐름 검증 | 활성 |
| Public Demo | 미정 | 외부 데모용 | **미활성** |

---

## 3. Credential Handling

### 절대 금지 사항

- password/token/session/cookie 값을 저장소에 커밋하지 않음
- GitHub Issue/PR comments에 credential 기록 금지
- ops/reports/screenshots/logs에 credential 기록 금지

### 허용된 저장 위치

- **로컬 gitignored 파일**만 허용
- secure vault (향후 도입 시)

---

## 4. Local Verifier File

### 예시 경로

```
D:\LoveBud-triage\.local\test-accounts.json
```

### 요구사항

- `.local/` 디렉토리는 반드시 `.gitignore`에 포함되어야 함
- JSON 예시는 placeholder 값만 사용

### 예시 JSON 형식

```json
{
  "accounts": {
    "admin": {
      "email": "admin.test@lovetree.dev",
      "password": "[PLACEHOLDER - 실제 값은 로컬에만 저장]"
    },
    "user": {
      "email": "user.test@lovetree.dev",
      "password": "[PLACEHOLDER - 실제 값은 로컬에만 저장]"
    }
  }
}
```

### 환경 변수 형식 (권장)

#### 예시 경로

```
D:\LoveBud-triage\.local\.env
```

#### env key 예시

```
LOVEBUD_QA_ADMIN_EMAIL=admin.test@lovetree.dev
LOVEBUD_QA_ADMIN_PASSWORD=[PLACEHOLDER]
LOVEBUD_QA_USER_EMAIL=user.test@lovetree.dev
LOVEBUD_QA_USER_PASSWORD=[PLACEHOLDER]
```

- 실제 값은 placeholder로만 표기
- `.env` 파일은 반드시 `.gitignore`에 포함

---

## 5. Browser Verification Workflow

### 작업 흐름

1. **CTO task**에서 QA 계정 타입 지정 (password는 명시하지 않음)
2. **verifier**는 로컬 secure source에서 password 읽음
3. **report**에는 email/account role만 기록

### 예시 작업 지정

```
[CTO → 원본]
작업: 로그인 흐름 smoke 검증
QA 계정: Internal QA User
```

---

## 6. Public Demo Account Status

### 현재 상태

- **미활성화됨** (not currently enabled)

### 활성화 시 고려사항

| 위험 | 설명 |
|------|------|
| spam | 외부 사용자의 악의적 데이터 생성 |
| data pollution | 데모 데이터가 실제 데이터와 혼재 |
| privacy confusion | 데모/실제 계정 구분 모호 |

### 활성화 필수 조건

- read/write restrictions 적용
- 주기적 reset policy 수립
- 별도 product/security decision 필요

---

## 7. Reporting Rules

### 절대 금지

- password paste 금지
- token/cookie/session 값 paste 금지

### 스크린샷 규칙

- credential 입력 필드 노출 금지
- password field는 반드시 마스킹 또는 제외

### 허용 기록 항목

- 계정 이메일
- 계정 역할 (admin/user)
- 검증 결과 (pass/fail)
- 타임스탬프

---

## 8. Immediate Operational Checklist

### Firebase Console

- [ ] QA 계정 생성 (human-only 작업)
- [ ] 비밀번호 설정 (human-only 작업)

### Local Setup

- [ ] 컴2 local `.local/test-accounts.json` 준비
- [ ] `.local/` gitignore 확인

### PR Preflight Scope Check (추가)

PR 생성 전 반드시 아래를 확인합니다. (#277 대응)

- [ ] `git diff --name-only origin/main...HEAD` 실행
- [ ] 예상 외 파일(screenshots, ops/inbox/reports/slots, work/, local-backup/)이 포함되어 있으면 즉시 중단
- [ ] root-level `*.png`, `*.jpg`, `*.jpeg`, `*.gif`, `*.webp` 파일이 staged되어 있으면 제거
- [ ] PR scope가 의도한 파일만 포함하는지 확인 후 push

---

## 9. Browser Verification URL Policy

### 금지 사항

| 항목 | 설명 |
|------|------|
| production URL 사용 금지 | PR branch 검증에 `https://lovebud.pages.dev/` 사용 금지 |
| 임의 URL 사용 금지 | `https://lovebud.pages.dev/pr/<PR번호>/...` 형태의 임의 URL 사용 금지 |

### 허용된 URL 출처

1. **Cloudflare Pages Preview URL** (우선)
   - Cloudflare Pages가 실제로 제공한 Preview URL 사용
   - PR에 자동으로 생성된 Preview URL이 있는 경우 해당 URL 사용

2. **Fixed Test Slot** (fallback)
   - Cloudflare Preview URL이 없거나 확인 불가능한 경우에만 사용
   - test1~test10 중 하나의 slot을 배정받아 사용

### 검증 범위별 허용 환경

| 검증 유형 | Local Static Server | Cloudflare Preview / Test Slot |
|-----------|---------------------|--------------------------------|
| Layout/Script smoke | ✅ 허용 | ✅ 허용 |
| Search/Browse 화면 | ⚠️ 참고용만 허용 | ✅ 최종 PASS 필수 |
| API/Data Load 화면 | ⚠️ 참고용만 허용 | ✅ 최종 PASS 필수 |
| Auth-gated 화면 | ⚠️ 참고용만 허용 | ✅ 최종 PASS 필수 |

### 중요

- **local static server만으로 최종 PASS 금지**
- Search/Browse/API/data load 화면은 반드시 Cloudflare Preview URL 또는 assigned test slot에서 검증

---

## 10. Fixed Test Slot Policy

### Slot 할당 원칙

- **1 PR = 1 Slot**: 하나의 PR에 하나의 test slot만 배정
- slot 상태는 운영 환경의 `ops/slots/test-slot-status.md`에서 관리
- 문서에는 slot 사용 원칙만 기록, 현재 배정 현황은 repo에 고정하지 않음

### Available Slots

| Slot | URL |
|------|-----|
| test1 | `https://test1.lovebud.pages.dev/` |
| test2 | `https://test2.lovebud.pages.dev/` |
| test3 | `https://test3.lovebud.pages.dev/` |
| test4 | `https://test4.lovebud.pages.dev/` |
| test5 | `https://test5.lovebud.pages.dev/` |
| test6 | `https://test6.lovebud.pages.dev/` |
| test7 | `https://test7.lovebud.pages.dev/` |
| test8 | `https://test8.lovebud.pages.dev/` |
| test9 | `https://test9.lovebud.pages.dev/` |
| test10 | `https://test10.lovebud.pages.dev/` |

### 사용 흐름

1. 작업 시작 시 slot 사용 가능 여부 확인
2. slot 배정 후 작업 진행
3. 작업 완료 후 slot 해제

### Shared Local Ops Paths

```
D:\LoveBud-triage\ops\inbox
D:\LoveBud-triage\ops\reports
D:\LoveBud-triage\ops\screenshots
D:\LoveBud-triage\ops\slots\test-slot-status.md
```

---

## 11. Local Workspace Separation

### Browser Verifier Workspace

| 항목 | 내용 |
|------|------|
| 경로 | `D:\LoveBud-triage\work\LoveBud-browser-verify` |
| 용도 | Browser/Playwright/visual verification only |
| 금지 | code modification, commit, push, PR edit, merge |

### Code Executor Workspace

| 항목 | 내용 |
|------|------|
| 경로 | `D:\LoveBud-triage\work\LoveBud-code-executor` (권장) |
| 용도 | code changes, branch work |
| 허용 | commit/push/PR update (명령된 경우에만) |
| 금지 | main direct push, merge, browser final PASS 선언 |

### 역할 분리 원칙

- **Browser verifier**: visual 검증만 수행, 코드 변경/최종 PASS 권한 없음
- **Code executor**: 코드 변경만 수행, browser 최종 PASS 선언 금지
- 각 workspace는 자신의 역할 범위 내에서만 작업 수행

---

## 관련 문서

- [TEST_PREVIEW_SLOTS.md](./TEST_PREVIEW_SLOTS.md) - 고정 테스트 Preview 슬롯 운영 기준
- [BROWSER_VERIFICATION_URL_POLICY.md](./BROWSER_VERIFICATION_URL_POLICY.md) - 브라우저 검증 URL 정책

---

Last updated: 2026-04-29
