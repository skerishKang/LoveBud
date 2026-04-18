# 테스트 계정 관리 규칙

> ⚠️ **보안 주의**: 실제 계정 정보는 절대 저장소에 커밋하지 마세요!

---

## 테스트 계정 정보 위치

| 환경 | 파일 경로 | Git 포함 | 비고 |
|------|-----------|----------|------|
| **실제 계정** | `.local/test-accounts.json` | ❌ 무시 | 로컬에서만 관리 |
| **예시 형식** | `.local/test-accounts.example.json` | ✅ 포함 | 저장소 참조용 |
| **운영 규칙** | `docs/test-scenarios/ACCOUNT_RULES.md` | ✅ 포함 | 이 문서 |

---

## 테스트 시나리오별 계정 사용법

### 1. 신규 가입자 테스트 (New User)

**시나리오**: 처음 사용하는 사용자, 회원가입부터 시작

**계정 생성 방식**:
- 테스트용 이메일 주소 패턴: `test-{타임스탬프}-{랜덤4자리}@test.com`
  - 예: `test-20260418-143052-a7b3@test.com`
- 비밀번호: `TestPass123!` (고정)
- **중요**: 테스트 완료 후 테스트 계정은 삭제하거나 별도 관리

**⚠️ 브라우저 자동완성 대응**:
- 크롬/브라우저 자동완성으로 이전 계정이 뜨면 **무조건 새로 입력**
- 자동완성 값을 지우고 수동으로 새 이메일 타이핑
- 이메일 패턴: `test-{현재시간}@{도메인}`
  - 예시: `test-20260418090133@test.com`

**사용 데이터 파일**: `data/new-user-flow.json`
```json
{
  "scenarioType": "new-user",
  "accountCreation": {
    "emailPattern": "test-{timestamp}@test.com",
    "password": "TestPass123!",
    "deleteAfterTest": true
  }
}
```

**결과 파일명**: `{그룹명}-newuser-test-YYYY-MM-DD-HHMM.md`

---

### ⚠️ 신규 가입자 테스트 시 문제 해결

#### 문제 1: "이미 사용 중인 이메일 주소입니다" 팝업

**상황**: 회원가입 시 이미 가입된 이메일이라는 팝업이 뜸

**원인**:
- 이전 테스트에서 동일한 이메일로 가입됨
- 브라우저 자동완성으로 이전 값 입력됨

**해결 방법 (우선순위 순)**:

1. **이메일 변경 (1차 시도)**
   - 새로운 이메일 입력: `test-{현재시간}-{랜덤}@test.com`
   - 예: `test-202604180902-a7k9@test.com`

2. **기존 계정 사용 (2차 시도, 신규 테스트 실패 시)**
   - 로그인 화면으로 전환
   - `.local/test-accounts.json`의 계정으로 로그인
   - 테스트 목적 변경: "신규 가입 과정" → "기존 사용자 흐름"
   - 결과 파일명 변경: `newuser` → `existing`

3. **테스트 중단 (최후의 수단)**
   - 서비스 문제로 판단
   - 개발팀에 문의 필요
   - 결과 파일에 "회원가입 불가" 기록

**기록 방법**:
```markdown
**STEP 2: 회원가입**
- 시도 1: test-20260418-085000@test.com → "이미 사용 중인 이메일" 팝업
- 시도 2: test-20260418-085015@test.com → 동일 팝업
- 해결: 로그인으로 전환하여 기존 가입자 흐름으로 테스트 진행
- 최종 결과 파일명: h2h-existing-test-2026-04-18-0850.md
```

---

### 2. 기존 가입자 테스트 (Existing User)

**시나리오**: 이미 가입된 사용자, 로그인부터 시작

**계정 정보 출처**: `.local/test-accounts.json`

**사용 데이터 파일**: `data/existing-user-flow.json`
```json
{
  "scenarioType": "existing-user",
  "accountSource": ".local/test-accounts.json",
  "accountKey": "lovebud-test-v1"
}
```

**결과 파일명**: `{그룹명}-existing-test-YYYY-MM-DD-HHMM.md`

---

## `.local/test-accounts.json` 구조

```json
{
  "version": "1.0",
  "accounts": [
    {
      "id": "lovebud-test-v1",
      "type": "qa",
      "service": "lovebud",
      "email": "test-v1@example.com",
      "password": "실제_비밀번호",
      "createdAt": "2026-04-18",
      "lastUsed": "2026-04-18",
      "notes": "QA 테스트용 계정"
    }
  ]
}
```

---

## 테스트 시나리오 분류

### 완전한 사용자 여정 (Full Journey)

| 단계 | 신규 가입자 | 기존 가입자 |
|------|------------|------------|
| 1 | 홈페이지 접속 | 홈페이지 접속 |
| 2 | 회원가입 진행 | 로그인 진행 |
| 3 | 이메일 인증 (있는 경우) | 트리 목록 확인 |
| 4 | 첫 트리 생성 | 기존 트리 확인 |
| 5 | 노드 생성 | 노드 추가 |
| 6 | 반복 테스트 | 반복 테스트 |

---

## 결과 파일명 규칙 (확장)

### 기본 패턴
```
{그룹명}-{userType}-test-YYYY-MM-DD-HHMM.md
```

### userType 종류

| userType | 설명 | 예시 파일명 |
|----------|------|------------|
| `newuser` | 신규 가입자 | `ive-newuser-test-2026-04-18-1430.md` |
| `existing` | 기존 가입자 | `ive-existing-test-2026-04-18-1430.md` |
| `guest` | 비로그인 | `ive-guest-test-2026-04-18-1430.md` |

---

## 테스트 수행 전 체크리스트

### 신규 가입자 테스트

- [ ] 테스트용 이메일 패턴 준비
- [ ] 비밀번호 규칙 확인 (서비스 요구사항)
- [ ] 테스트 완료 후 계정 정리 계획

### 기존 가입자 테스트

- [ ] `.local/test-accounts.json` 존재 확인
- [ ] 계정 정보 유효성 확인 (로그인 테스트)
- [ ] 해당 계정에 테스트 데이터가 없는지 확인

---

## 계정 정보 보안 규칙

1. **절대 금지**: 실제 개인 계정 사용
2. **테스트 전용**: 테스트용 계정만 사용
3. **정기 갱신**: 비밀번호 주기적 변경
4. **접근 제한**: `.local/` 폴더는 개인 로컬에서만 관리

---

## 예시: 테스트 실행 시나리오

### 신규 가입자 테스트 (IVE)

```bash
# 1. 시나리오 파일 읽기
repeatability-node-creation-test.md

# 2. 신규 가입자 데이터 참조
data/new-user-flow.json

# 3. 새 계정 생성 (자동 또는 수동)
이메일: test-20260418-1430@test.com
비밀번호: TestPass123!

# 4. 테스트 수행
...

# 5. 결과 저장
docs/test-scenarios/results/ive-newuser-test-2026-04-18-1430.md
```

### 기존 가입자 테스트 (BTS)

```bash
# 1. 시나리오 파일 읽기
repeatability-node-creation-test.md

# 2. 기존 계정 정보 참조
.local/test-accounts.json → lovebud-test-v1

# 3. 로그인 (저장된 계정 사용)
이메일: (test-accounts.json에서)
비밀번호: (test-accounts.json에서)

# 4. 테스트 수행
...

# 5. 결과 저장
docs/test-scenarios/results/bts-existing-test-2026-04-18-1430.md
```

---

*마지막 업데이트: 2026-04-18*
