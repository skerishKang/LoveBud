# Skill: Production Scenario Tester

## 목적
실운영 도메인(`https://lovebud.netlify.app`)에서 아이돌별 팬 여정 시나리오를 테스트하고, 그 결과를 문서화 및 증빙(스크린샷)하는 절차를 규정합니다.

## 입력 (Input)
- **대상 그룹 데이터**: `docs/test-scenarios/data/{group}-data.json`
- **테스트 환경**: `https://lovebud.netlify.app` (로컬 테스트 금지)

## 실행 절차 (Workflow)

### 1. 계정 준비
- 테스트마다 **새로운 이메일 계정**으로 회원가입을 수행합니다.
- 이메일 규칙: `test-{groupId}-{YYYYMMDDHHMM}@example.com`
- 비밀번호: `Test1234!` (통일)

### 2. 브라우저 수행 및 스크린샷 (Mandatory)
에이전트는 브라우저 서브에이전트를 사용하여 다음 단계를 수행하고 스크린샷을 남겨야 합니다.

- **STEP 1: 홈/랜딩**: 접속 직후 (`01-home.png`)
- **STEP 2: 회원가입/로그인**: 가입 성공 직후 (`02-login.png`)
- **STEP 3: 트리 생성**: 신규 트리 생성 완료 (`03-tree-created.png`)
- **STEP 4: 에디터 작업**: 메모리 노드 1개 이상 추가 및 렌더링 확인 (`04-editor-render.png`)
- **STEP 5: 공개 검색 검증**: `pages/search.html` 접속하여 내 트리가 리스트에 노출되는지 확인 (`05-search-visibility.png`)

### 3. 결과 정리
- `docs/test-scenarios/results/{groupId}-test-{YYYYMMDDHHMM}/` 폴더 생성.
- `test-result.md` 작성 (템플릿 준수).
- 스크린샷 파일을 해당 폴더의 `screenshots/` 서브폴더로 이동.

## PASS/FAIL 판정 기준
- **PASS**: 모든 노드가 렌더링되고, 검색(Browse) 페이지에서 내 트리가 정상적으로 노출됨.
- **FAIL**: 가입 실패, 트리 생성 실패, 검색 페이지 노출 누락 또는 렌더링 오류 발생 시.

## 주의사항
- **절대 주의**: 시나리오 테스트 시 `localhost:8888` 접속은 금지됩니다. 반드시 실운영 도메인을 사용하세요.
- 비인증 상태(Guest)에서 검색 페이지가 어떻게 보이는지도 함께 확인합니다.
