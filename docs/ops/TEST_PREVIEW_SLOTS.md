# Fixed Test Preview Slots

**Status:** Active  
**Owner:** CTO / Ops Lead  
**Last Updated:** 2026-04-25  
**Branch:** docs/test-preview-slots

---

## 1. 목적

PR별 Cloudflare Preview URL은 Firebase Auth domain, login redirect, runtime/API 검증 과정에서 반복적인 제한이 발생할 수 있습니다. Fixed Test Preview Slots는 검증이 필요한 브랜치에 대해 고정된 도메인을 미리 할당하여, 아래 검증을 안정적으로 수행하기 위한 운영 체계입니다.

- 로그인이 필요한 화면 검증: editor/, my-trees/, settings/ 등 인증이 필요한 페이지
- API/backend/runtime 경로 확인: /api/, /runtime/ 경로의 smoke test
- DB read 검증: 데이터 조회 동작 검증
- UI production-like preview: 실제 프로덕션과 유사한 환경에서의 UI/UX 검증
- PR별 Preview URL 대체: Auth/domain 문제로 PR Preview가 정상 동작하지 않을 때의 대체 검증 수단

---

## 2. Fixed Test Preview Slots

| Slots | Domain | 용도 |
|-------|--------|------|
| test1 | https://test1.lovebud.pages.dev | UI PR 검증 |
| test2 | https://test2.lovebud.pages.dev | runtime/backend route 검증 |
| test3 | https://test3.lovebud.pages.dev | policy/visibility 검증 |
| test4 | https://test4.lovebud.pages.dev | QA CRUD (disposable data) 검증 |
| test5 | https://test5.lovebud.pages.dev | 예비/대체 슬롯 |

> ?? Cloudflare Pages에 연결된 고정 도메인으로, 각 슬롯은 특정 브랜치를 바라보도록 설정됩니다.

---

## 3. 사용 범위

다음 검증 작업에 Fixed Test Preview Slots를 사용합니다:

### 3.1 로그인 필요 화면
- editor/ ? 편집기 페이지 인증 흐름
- my-trees/ ? 내 트리 페이지
- settings/ ? 설정 페이지

### 3.2 API/backend/runtime
- /api/* 엔드포인트 smoke test
- /runtime/* 경로 동작 확인
- Firebase Functions (Modal) 연동 간접 검증

### 3.3 DB read 검증
- 트리 목록 조회
- 트리 상세 조회
- 공개 범위(public/private)에 따른 표시 필터링

### 3.4 UI 반응형 검증
- Desktop/Tablet/Mobile breakpoint
- 브라우저 개발자 도구와 실제 디바이스 환경

### 3.5 대체 검증
- PR별 Cloudflare Preview URL이 Firebase Auth domain 문제로 정상 동작하지 않을 때
- login redirect loop, domain mismatch 오류 발생 시

---

## 4. 사용 금지 / 제한

### 4.1 절대 금지
- production write 동작 (save/edit/delete/PUT/PATCH/DELETE) ? 별도 승인 전 금지
- 기존 사용자 데이터 수정/삭제 ? 실제 유저 데이터는 건들지 않음
- token/password/cookie 원문 기록 ? 로그에 민감 정보 남기기 금지
- main 직접 수정 ? main 브랜치에 직접 commit 금지
- main 직접 push ? main 브랜치에 직접 push 금지
- force push ? 어떤 브랜치에도 force push 금지
- 임의 slot branch 생성/push ? 미리 승인된 slot 브랜치만 사용

### 4.2 제한적허용
- write 테스트: test4 슬롯에서 QA disposable data (일회성 테스트 데이터)로만 수행
- api write 테스트: 테스트 계획에 명시된 경우에만 수행
- cache invalidation: Cloudflare Pages 캐시 무효화는 CTO 승인 후 수행

---

## 5. 슬롯 배정 규칙

| 슬롯 | 기본 용도 | 예시 |
|------|-----------|------|
| test1 | UI PR 검증 | PR#123 번 UI 변경 사항 프리뷰 |
| test2 | runtime/backend route 검증 | /api/health, /runtime/check smoke test |
| test3 | policy/visibility 검증 | 공개/비공개 표시 필터 검증 |
| test4 | QA CRUD disposable data 검증 | 테스트 데이터 create/read/update/delete |
| test5 | 예비/대체 슬롯 | 긴급 대체 또는 추가 검증 필요 시 |

> ?? 실제 배정은 CTO 또는 담당 Lead가 보고서에 명시해야 합니다. 본 규칙은 기본 가이드이며, 상황에 따라 조정 가능합니다.

---

## 6. 브랜치 운영 규칙

### 6.1 슬롯 브랜치 네이밍
slot/test1
slot/test2
slot/test3
slot/test4
slot/test5

### 6.2 동작 방식
각 슬롯 브랜치는 main을 직접 수정하는 것이 아닙니다. 검증 대상 브랜치의 변경을 임시로 반영하여 Cloudflare Pages가 고정 도메인에 배포하도록 사용합니다.

절차:
1. 검증 대상 브랜치 (예: feature/editor-auth-fix) 확인
2. 해당 브랜치를 slot/testX에 merge/rebase 하여 임시 반영
3. Cloudflare Pages가 testX.lovebud.pages.dev에 자동 배포
4. 검증 완료 후 slot/testX 브랜치를 원복 (reset to main) 또는 삭제

### 6.3 브랜치 관리 원칙
- slot/* 브랜치는 검증 슬롯 갱신 용도로만 사용
- 장기 운영 브랜치로 사용 금지
- 사용 후 즉시 main으로 revert 또는 삭제
- 동시 사용 시 충돌 방지를 위해 한 슬롯당 한 브랜치만 배정

---

## 7. Firebase/Auth 체크리스트

슬롯 사용 전 반드시 확인:

### 7.1 Firebase Authorized Domains
- [ ] test1.lovebud.pages.dev가 Firebase Console → Authentication → Settings → Authorized domains에 등록
- [ ] test2.lovebud.pages.dev 등록 확인
- [ ] test3.lovebud.pages.dev 등록 확인
- [ ] test4.lovebud.pages.dev 등록 확인
- [ ] test5.lovebud.pages.dev 등록 확인

### 7.2 Google Login Redirect
- [ ] Google OAuth consent screen의 Authorized redirect URIs에 각 test slot URL 포함
  - https://test1.lovebud.pages.dev/__/auth/handler
  - https://test2.lovebud.pages.dev/__/auth/handler
  - (나머지 슬롯 동일)
- [ ] Firebase Auth popup/redirect 방식 정상 동작

### 7.3 로그인 세션 유지
- [ ] 로그인 후 redirect target이 유지되는지 (현재 슬롯 도메인으로 유지)
- [ ] logout → login 반복 시 cookie/session 충돌 없음
- [ ] 여러 브라우저 탭에서 동시 로그인/로그아웃 문제 없음

---

## 8. Cloudflare 체크리스트

슬롯 배정 전 확인:

### 8.1 도메인 연결 상태
- [ ] Cloudflare Pages 프로젝트에 test1.lovebud.pages.dev 커스텀 도메인 연결 완료
- [ ] DNS 설정이 Pages 프로젝트를 가리키는지 확인
- [ ] SSL/TLS 인증서 발급 완료 (Always HTTPS)

### 8.2 브랜치 바라보는 상태
- [ ] test1 슬롯이 현재 어떤 git 브랜치를 배포 중인지 확인
- [ ] slot/test1 브랜치가 최신인지 확인
- [ ] 배포된 commit SHA 기록

### 8.3 배포 상태
- [ ] Cloudflare Pages 배포 상태: Success/Failed
- [ ] 최신 deploy 시간 확인
- [ ] 배포 로그 확인 (오류 없음)

### 8.4 캐시 무효화 (필요 시)
- [ ] Cloudflare Pages 캐시 무효화 필요 여부 판단
- [ ] 무효화 실행 (CTO 승인 후)
- [ ] 무효화 후 재배포 대기

---

## 9. 검증 보고 템플릿

[Slot Verification Report]
- Slot:
- Branch:
- Commit:
- Purpose:
- Pages URL:
- Firebase Auth result:
- API result:
- UI result:
- Console/network:
- Data mutation performed: yes/no
- Cleanup required: yes/no
- Final judgment:

---

## 10. 위험 관리

### 10.1 데이터 위험
- test slot은 production-like 환경이므로 실제 운영 데이터 변경 가능성이 있음
- write/delete 작업은 test4에서 disposable data로만 수행
- 테스트 데이터는 사후 삭제 또는 격리 상태 유지

### 10.2 보안 위험
- 슬롯 도메인에서의 인증 token/cookie는 로그 기록 금지
- 테스트 계정 사용 (실제 계정 아님)
- 외부 공유 금지 (slack/issue 공개 금지)

### 10.3 운영 위험
- slot 사용 후 반드시 배정 해제 및 슬롯 브랜치 원복
- 슬롯 점유 시간 최소화 (필요 이상으로 오래 유지 금지)
- 여러 에이전트/작업자 간 충돌 방지: slot 사용 여부 공유

### 10.4 모니터링
- Cloudflare Pages 배포 실패 알림
- Firebase Auth error rate 모니터링
- slot 사용 로그 (누가, 언제, 어떤 슬롯 사용했는지) 기록

---

## 11. 승인 및 보고 절차

### 11.1 slot 사용 요청
1. 검증 필요 브랜치와 목적을 기재하여 CTO 또는 Ops Lead에게 요청
2. slot 할당 받기 (test1~5 중 하나)
3. 슬롯 브랜치 생성/갱신 권한 부여 받기

### 11.2 검증 수행
1. Firebase/Auth, Cloudflare 체크리스트 실행
2. 검증 보고서 작성 (Section 9 템플릿)
3. 문제 발견 시 즉시 중단 및 보고

### 11.3 사용 후 처리
1. slot 브랜치를 main으로 revert 또는 삭제
2. 검증 보고서 완료본을 CTO/Ops Lead에게 제출
3. slot 해제 및 다음 사용자에게 양도

---

## 12. 금지선 요약 (절대 위반 금지)

- ? 실제 Cloudflare/Firebase 설정 변경 (도메인 등록, OAuth URI 추가 등)
- ? API/backend 코드 수정 (검증만 수행)
- ? main 브랜치 직접 수정/push
- ? force push
- ? 임의 slot branch 생성/push (미리 승인된 slot만)
- ? production 데이터 write/delete
- ? token/password/cookie 원본 기록
- ? 슬롯 점유 시간 초과 (필요 이상으로 오래 사용)

---

## 13. 참고 문서

- docs/ops/OPERATIONS.md ? 일반 운영 원칙
- docs/ops/DEPLOY_CHECKLIST.md ? 배포 검증 체크리스트
- docs/ops/RUNBOOK.md ? 장애 대응 실행서
- docs/engineering/API_CONTRACT.md ? API 계약
- docs/product/PRODUCT_IDENTITY.md ? 제품 정체성 (UI/UX 판단 기준)

---

문서 버전: 1.0  
다음 리뷰: CTO 승인 후
