# 테스트 시나리오 문서화 시스템

## 폴더 구조

```
docs/test-scenarios/
├── README.md                              # 이 파일 (사용 방법)
├── repeatability-node-creation-test.md    # 공통 시나리오 원본 (아이돌无关)
├── data/                                  # 아이돌별 테스트 데이터
│   ├── ive-data.json                      # IVE 테스트 데이터
│   ├── bts-data.json                      # BTS 테스트 데이터
│   ├── hearts2hearts-data.json            # 하츠투하츠 테스트 데이터
│   └── {group}-data.json                  # 새 그룹 데이터 추가
├── results/                               # 테스트 결과 저장소
│   ├── common-test-TEMPLATE.md            # 공통 결과 템플릿
│   └── {그룹명}-{userType}-test-YYYY-MM-DD-HHMM/     # 테스트별 폴더
│       ├── test-result.md                  # 테스트 결과 (markdown)
│       └── 📸 스크린샷 (필요시 촬영)
│           ├── step1-home.png              (선택)
│           ├── step2-login.png             (선택)
│           ├── error-popup.png             (문제 발생시)
│           ├── tree-created.png            (선택)
│           └── ... (상황에 따라 추가)..
```

---

## 사용 방법

### 1. 새 테스트 수행 시

**STEP 1**: 시나리오 파일 + 아이돌 데이터 파일 함께 참조
```
repeatability-node-creation-test.md    # 공통 시나리오
data/ive-data.json                      # 테스트할 그룹 데이터
```

**STEP 2**: 결과 템플릿 복사
```bash
# Windows PowerShell
copy docs\test-scenarios\results\ive-test-TEMPLATE.md docs\test-scenarios\results\ive-test-YYYY-MM-DD-HHMM.md

# 또는 직접 파일 생성
```

**STEP 3**: 테스트 결과 기록
- 각 STEP별로 결과 작성
- 스크린샷 캡처 시 `screenshots/ive-test-YYYY-MM-DD-HHMM/` 폴더에 저장

**STEP 4**: Git 커밋 (선택)
```bash
git add docs/test-scenarios/results/ive-test-YYYY-MM-DD-HHMM.md
git commit -m "test: IVE 팬 여정 반복 생성 테스트 결과 - YYYY-MM-DD"
```

---

## 테스트 결과 파일명 규칙

### 그룹별 시나리오 코드

| 그룹명 | 시나리오 코드 | 예시 파일명 |
|--------|--------------|-------------|
| IVE | `ive-test` | `ive-test-2026-04-18-1430.md` |
| BTS | `bts-test` | `bts-test-2026-04-18-1500.md` |
| 하츠투하츠 | `h2h-test` | `h2h-test-2026-04-18-1600.md` |
| 르세라핌 | `lesserafim-test` | `lesserafim-test-2026-04-19-1000.md` |
| 새로운 그룹 | `{그룹명}-test` | `{그룹명}-test-YYYY-MM-DD-HHMM.md` |

### 구성 요소

| 구성 요소 | 설명 | 예시 |
|-----------|------|------|
| 시나리오 코드 | 그룹별 접두사 | `ive-test`, `bts-test` |
| 날짜 | `YYYY-MM-DD` | 2026-04-18 |
| 시간 | `HHMM` | 1430 (14:30) |
| 확장자 | `.md` | .md |

**완성 예시**: `ive-test-2026-04-18-1430.md`

---

## 반복 테스트 추적

같은 시나리오를 여러 번 수행하면 시간/품질 개선 추적 가능:

| 테스트 회차 | 파일명 | 총 소요 시간 | 핵심 문제 | 개선 여부 |
|-------------|--------|--------------|-----------|-----------|
| 1차 | ive-test-2026-04-18-1430.md | 8분 | 로그인 헷갈림 | - |
| 2차 | ive-test-2026-04-19-0930.md | 5분 | - | ✅ 개선 |
| 3차 | ive-test-2026-04-20-1100.md | 4분 | - | ✅ 안정화 |

---

## 스크린샷 저장 규칙

```
docs/test-scenarios/results/screenshots/
└── ive-test-YYYY-MM-DD-HHMM/
    ├── step1-home.png          # 홈화면
    ├── step2-login.png         # 로그인
    ├── step3-tree.png          # 트리 생성
    ├── step4-node1.png         # 노드 1
    ├── step4-node2.png         # 노드 2
    ├── step4-node3.png         # 노드 3
    ├── step4-node4.png         # 노드 4
    ├── step5-node5.png         # 반복 테스트 노드 5
    ├── step5-node6.png         # 반복 테스트 노드 6
    └── step6-final.png         # 최종 트리 상태
```

---

## AI 에이전트 테스트 지침

AI가 테스트를 수행할 때는:

1. **시나리오 파일**을 먼저 읽음
2. **템플릿을 복사**하여 새 결과 파일 생성
3. 각 STEP마다 **즉시 기록**
4. **스크린샷**은 지정된 폴더에 저장
5. **최종 평가**까지 완료 후 파일 저장
6. **Git 커밋** (사용자 요청 시)

---

## 현재 등록된 시나리오

### 공통 시나리오

| 시나리오 ID | 파일명 | 목적 | 상태 |
|-------------|--------|------|------|
| REPEAT-NODE-001 | repeatability-node-creation-test.md | 노드 반복 생성 가능성 검증 (아이돌无关) | ✅ 등록 완료 |

### 그룹별 테스트 데이터

| 그룹명 | 데이터 파일 | 팬 페르소나 | 상태 |
|--------|------------|-------------|------|
| IVE | `data/ive-data.json` | 아이브 콘텐츠 정리 | ✅ 준비 완료 |
| BTS | `data/bts-data.json` | 방탄 콘텐츠 정리 | ✅ 준비 완료 |
| 하츠투하츠 | `data/hearts2hearts-data.json` | 하츠투하츠 콘텐츠 정리 | ✅ 준비 완료 |

### 테스트 결과 예시

| 테스트 회차 | 그룹 | 파일명 | 총 소요 시간 | 상태 |
|-------------|------|--------|--------------|------|
| 1차 | IVE | ive-test-2026-04-18-1430.md | 8분 | ⏳ 대기중 |
| 1차 | BTS | bts-test-2026-04-18-1500.md | - | ⏳ 대기중 |
| 1차 | 하츠투하츠 | h2h-test-2026-04-18-1600.md | - | ⏳ 대기중 |

---

## 새 아이돌 그룹 추가 방법

### 방법 1: 기존 시나리오 재사용 (권장)

1. `data/{그룹명}-data.json` 파일 생성
2. 테스트 수행
3. 결과를 `{그룹명}-test-YYYY-MM-DD-HHMM.md`로 저장

**예시**: 새로운 그룹 "NewJeans" 추가
```bash
# 1. 데이터 파일 생성
docs/test-scenarios/data/newjeans-data.json

# 2. 테스트 수행 (repeatability-node-creation-test.md 참조)

# 3. 결과 저장
docs/test-scenarios/results/newjeans-test-2026-04-18-1400.md
```

### 방법 2: 완전히 새로운 시나리오 생성

1. `docs/test-scenarios/`에 `{시나리오명}-test.md` 파일 생성
2. `docs/test-scenarios/results/`에 `{시나리오명}-test-TEMPLATE.md` 템플릿 생성
3. `data/`에 필요한 데이터 파일 추가
4. 이 README에 그룹 정보 추가
5. Git 커밋

---

## 체크리스트

새 테스트 수행 전:

- [ ] 시나리오 파일 읽었는가?
- [ ] 결과 파일명 결정 (날짜/시간 포함)
- [ ] 스크린샷 폴더 준비
- [ ] 테스트 데이터 준비 (IVE URL 4개)

테스트 수행 중:

- [ ] 각 STEP마다 즉시 기록
- [ ] 혼란/막힌 지점 즉시 메모
- [ ] 스크린샷 캡처

테스트 수행 후:

- [ ] 최종 평가 작성
- [ ] UX 개선 포인트 정리
- [ ] 파일 저장
- [ ] Git 커밋 (선택)

---

*마지막 업데이트: 2026-04-18*

---

## 테스트 자동화 관련 사항

### 인증/로그인
- **LoveBud는 이메일 인증이 없음** - 회원가입 후 바로 로그인됨
- 신규 가입자 테스트는 매번 **새로운 계정**으로 회원가입 필요
- 테스트 이메일 패턴: `test-{그룹ID}-{타임스탬프}@example.com`

### ⚠️ 테스트 계정 생성 (필수)
**모든 테스트 시작 전 반드시 실행**

1. **새 테스트 계정 생성** (LoveBud 로그인 페이지에서)
   - 이메일: `test-{그룹ID}-{YYYY-MM-DD-HHmm}@example.com`
   - 비밀번호: `Test1234!` (고정)
   - 닉네임: `{그룹ID} Fan` 또는 테스트용

2. **계정 정보 기록** (`.local/test-accounts.json`)
   ```json
   {
     "group": "xg",
     "testId": "xg-test-2026-04-18-2037",
     "email": "test-xg-2026-04-18-2037@example.com",
     "password": "Test1234!",
     "createdAt": "2026-04-18T20:37:00",
     "notes": "XG 그룹 테스트용"
   }
   ```

3. **테스트 실행** (로그인 상태에서 진행)

**⚡ 자동화 요구사항**: 테스트 시작 시 반드시 회원가입부터 진행. 계정 없이 테스트 불가.

### 계정 정보 저장
- 테스트 계정 정보는 `.local/test-accounts.json`에 **로컬만 저장** (Git 제외)
- 테스트 완료 후 계정은 **수동으로 삭제하거나 별도 관리**
- 예시: `test-xg-2026-04-18-1058@example.com`

### 자동화 제약사항
| 항목 | 문제 | 해결방법 |
|------|------|----------|
| **스크린샷 저장** | Playwright MCP가 상대경로 미지원 | Windsurf MCP 사용 (파일명만) + 수동 이동 |
| **입력 필드 접근** | 일부 input에 id/aria-label 없음 | HTML에 명확한 식별자 추가 필요 |
| **회원가입** | 자동화 가능 (이메일 인증 없음) | 새 이메일 패턴으로 자동 생성 |

### 스크린샷 캡처 방법 (MCP 사용)

**중요**: Windsurf MCP는 **파일명만** 지원, 전체 경로 미지원

#### 2단계 캡처 프로세스
1. **스크린샷 찍기** (파일명만, Windsurf 임시 폴더에 저장)
2. **파일 이동** (터미널에서 결과 폴더로 복사)

#### 예시
```javascript
// 1. MCP로 스크린샷 (파일명만!)
await page.screenshot({ path: "01-home.png" });

// 2. 터미널에서 이동
// copy 01-home.png G:\Ddrive\BatangD\task\workdiary\LoveBud\docs\test-scenarios\results\{폴더명}\screenshots\
```

#### 결과 폴더 구조
```
docs/test-scenarios/results/{그룹ID}-test-{YYYY-MM-DD-HHmm}/
├── test-result.md
└── screenshots/
    ├── 01-home.png
    ├── 02-login.png
    ├── 03-my-trees.png
    ├── 04-editor.png
    └── 05-search.png
```

### 개선 필요사항
- [ ] 검색 페이지 URL 입력 필드에 `id` 또는 `aria-label` 추가
- [ ] 스크린샷 저장을 위한 로컬 Playwright 설정 가이드
- [ ] 테스트 계정 자동 생성/삭제 스크립트
