# 로컬 비밀값 및 테스트 계정 운영 메모

이 문서는 LoveBud 프로젝트의 로컬 비밀값과 테스트 계정에 대한 운영 메모입니다.

## 중요: 비밀값 취급 원칙

### AGENTS.md에 비밀값 원문 쓰지 않기
`AGENTS.md`는 로컬 작업 사본에서 gitignore 대상일 수 있으므로 운영 메모를 남길 수 있습니다.
다만 `AGENTS.md`에는 비밀값 원문을 직접 쓰지 않고, **비밀값이 저장된 로컬 파일 경로와 출처만 기록**합니다.

---

## 컴2 작업 사본의 로컬 비밀값 파일

컴2 작업 사본의 로컬 비밀값 파일 위치:

| 파일 | 설명 |
|------|------|
| `.env` | 환경 변수 (DB URL 등) |
| `.local/test-accounts.json` | 테스트 계정 정보 |
| `.secrets/source-secrets.md` | 비밀 메모 |

---

## 주요 비밀값 출처 (2026-04-16 기준)

### DB 연결
- **DB URL source**: `G:\다른 컴퓨터\내 컴퓨터\133-relovetree\.env`
- `.env`에서 확인: `NETLIFY_DATABASE_URL` 또는 `DATABASE_URL`

### 테스트 계정
- **테스트 계정 source**: `G:\다른 컴퓨터\내 컴퓨터\133-relovetree\scripts\create-test-accounts.js`
- 테스트 계정 기본값은 보통 `.local/test-accounts.json`에서 확인합니다.

---

## 새 세션 시작 시 확인

새 세션에서 시드/DB 작업 전에 반드시 확인:

1. `.env` 파일 존재 여부
2. `.local/test-accounts.json` 존재 여부
3. 파일 내용 확인 (빈 값이 없는지)

---

## 비밀값 확인 원칙

- `.env`와 `.secrets/`는 절대로 git에 커밋하지 마세요.
- `AGENTS.md`에는 비밀 파일 경로만 기록하고, 값은 쓰지 마세요.
- 테스트 계정이 필요하면 `.local/test-accounts.json`을 참조하세요.
- 새로운 비밀값을 추가할 때는 파일 위치를 명확히 기록하세요.