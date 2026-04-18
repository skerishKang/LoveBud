---
description: LoveBud 테스트 시나리오 자동화 워크플로우
---

# LoveBud 테스트 시나리오 실행

## 목적

아이돌 팬 여정 테스트를 자동화하여 UX 검증

## 사용 방법

사용자가 다음과 같이 요청하면:
- "{그룹명} 테스트 해줘"
- "{그룹명} 신규 테스트 해줘"  
- "{그룹명} 기존 테스트 해줘"

## AI 실행 순서

### STEP 1: 시스템 확인

```
1. docs/test-scenarios/ 폴더 존재 확인
2. 없으면 "테스트 시나리오 시스템이 설치되지 않았습니다" 알림
```

### STEP 2: 파일 읽기

```
1. docs/test-scenarios/repeatability-node-creation-test.md 읽기
2. docs/test-scenarios/data/{그룹명}-data.json 읽기
   - 없으면 "해당 그룹 데이터가 없습니다. 먼저 생성이 필요합니다" 알림
3. userType 확인 (신규=newuser, 기존=existing, 미지정=newuser 기본값)
```

### STEP 3: 테스트 수행

```
1. 브라우저로 https://lovebud.netlify.app 접속
2. 시나리오 STEP 순서대로 진행
3. 각 단계에서 발견한 문제 즉시 기록
4. 스크린샷 캡처 (results/{그룹명}-{userType}-test-YYYY-MM-DD-HHMM/)
```

### STEP 4: 결과 저장

```
1. 폴더 생성: results/{그룹명}-{userType}-test-YYYY-MM-DD-HHMM/
2. docs/test-scenarios/results/common-test-TEMPLATE.md 복사 → test-result.md
3. 테스트 결과 작성
4. 스크린샷도 동일 폴더에 저장 (step1-home.png, step2-login.png 등)
4. 파일 저장
```

### STEP 5: 완료 보고

```
완료 보고서 제공:
- 테스트 파일 경로
- 핵심 발견 사항 (3줄 요약)
- UX 개선 필요사항
- 다음 권장 테스트 (있는 경우)
```

## 지원하는 그룹 목록

현재 등록된 그룹 (data/ 폴더 기준):
- ive
- bts
- hearts2hearts
- (추가 그룹은 data/{그룹명}-data.json 생성 시 자동 인식)

## 사용자 유형

| 유형 | 코드 | 설명 |
|------|------|------|
| 신규 가입자 | newuser | 회원가입부터 테스트 (기본값) |
| 기존 가입자 | existing | 로그인부터 테스트 |

## 파일 경로 참조

| 파일 | 경로 |
|------|------|
| 공통 시나리오 | docs/test-scenarios/repeatability-node-creation-test.md |
| 그룹 데이터 | docs/test-scenarios/data/{그룹명}-data.json |
| 결과 템플릿 | docs/test-scenarios/results/common-test-TEMPLATE.md |
| 계정 규칙 | docs/test-scenarios/ACCOUNT_RULES.md |
| 사용 방법 | docs/test-scenarios/README.md |

## 예시 명령어

```
"IVE 테스트 해줘"
→ IVE 신규 가입자 테스트 실행
→ 결과: ive-newuser-test-2026-04-18-1430.md

"BTS 기존 테스트 해줘"  
→ BTS 기존 가입자 테스트 실행
→ 결과: bts-existing-test-2026-04-18-1430.md

"세븐틴 테스트 해줘"
→ data/seventeen-data.json 확인
→ 없으면 "데이터 파일이 없습니다" 알림

"모든 그룹 테스트 해줘"
→ npm run test:batch 실행
→ 모든 그룹 순차 테스트 (실패 시 다음 그룹으로 진행)
→ 결과: docs/test-scenarios/results/YYYY-MM-DD-HHMM-batch-summary.md
```

## 배치 테스트 (전체 그룹)

모든 그룹을 자동으로 테스트:

```bash
# 백그라운드 모드 (headless)
npm run test:batch

# 브라우저 표시 모드
npm run test:batch:headed
```

**결과 구조:**
```
docs/test-scenarios/results/YYYY-MM-DD-HHMM-batch-{그룹ID}/
├── test-result.md          # 그룹별 테스트 결과
└── screenshots/              # 스크린샷 폴더
    ├── 01-home.png
    ├── 02-login.png
    ├── 04-my-trees.png
    └── ...

YYYY-MM-DD-HHMM-batch-summary.md  # 전체 테스트 요약
```

**에러 핸들링:**
- 특정 그룹 테스트 실패 → 결과 저장 → 다음 그룹으로 자동 진행
- 5분 타임아웃 설정 (그룹별)
- 에러 발생 시 99-error.png 자동 캡처

## 주의사항

1. 기존 가입자 테스트 시 `.local/test-accounts.json` 필요
2. 신규 가입자 테스트 시 테스트 완료 후 계정 정리 권장
3. 모든 결과는 docs/test-scenarios/results/에 저장
4. 스크린샷은 results/screenshots/하위에 폴더별 저장
