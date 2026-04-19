# 테스트 시나리오 문서화 시스템

이 폴더는 LoveBud / LoveTree의 수동 테스트 시나리오, 테스트 데이터, 결과 문서를 같은 위치에서 관리하기 위한 운영 폴더입니다.

이번 정비의 원칙은 **폴더 분리보다 역할 분리**입니다.
즉, 기존 문서를 버리지 않고 `docs/test-scenarios/` 안에서 다음을 구분합니다.

- 현재 제품 기준으로 먼저 실행해야 하는 **대표 시나리오**
- 과거 이슈 재발 여부를 확인하는 **회귀 시나리오**
- 계정, 실행, 결과 저장을 돕는 **운영 가이드 문서**

---

## 1. 먼저 읽을 문서

### 가장 먼저 볼 문서
1. `CURRENT_SCENARIOS.md`
2. `QUICKSTART.md`
3. 필요한 대표 시나리오 문서

### 현재 대표 시나리오
- `core_newuser_001.md`
- `core_returning_001.md`
- `core_browse_001.md`
- `access_public_private_001.md`
- `persistence_001.md`

### 회귀 시나리오
- `repeatability-node-creation-test.md`

이 문서는 유지하지만, 현재 제품 전체를 대표하는 메인 시나리오가 아니라 **회귀용 보조 시나리오**로 사용합니다.

---

## 2. 폴더 구조

```text
docs/test-scenarios/
├── README.md
├── QUICKSTART.md
├── CURRENT_SCENARIOS.md
├── ACCOUNT_RULES.md
├── repeatability-node-creation-test.md
├── core_newuser_001.md
├── core_returning_001.md
├── core_browse_001.md
├── access_public_private_001.md
├── persistence_001.md
├── test_scenario_todo_2026_04_20.md
├── data/
│   ├── ive-data.json
│   ├── bts-data.json
│   ├── hearts2hearts-data.json
│   └── {group}-data.json
└── results/
    ├── common-test-TEMPLATE.md
    └── {scenario}-{group}-YYYY-MM-DD-HHMM/
        ├── test-result.md
        └── screenshots/
```

---

## 3. 문서 역할 설명

### A. 대표 시나리오
현재 제품 상태를 기준으로 가장 먼저 수행해야 하는 문서입니다.

| 파일 | 목적 |
|------|------|
| `core_newuser_001.md` | 첫 방문 사용자의 이해, 로그인, 첫 트리, 첫 저장 검증 |
| `core_returning_001.md` | 기존 사용자의 재방문, 기존 트리 탐색, 추가 작업 검증 |
| `core_browse_001.md` | search → detail 공개 탐색 흐름 검증 |
| `access_public_private_001.md` | 공개/비공개 및 소유자 권한 경계 검증 |
| `persistence_001.md` | 저장 후 새로고침/재진입/목록-에디터 일관성 검증 |

### B. 회귀 시나리오
과거에 중요했던 실패 지점이 다시 나타나는지 확인하기 위한 문서입니다.

| 파일 | 역할 |
|------|------|
| `repeatability-node-creation-test.md` | 반복 생성, 잘못된 URL, 뒤로가기, 새로고침, 로그인 가드 등 회귀 확인 |

### C. 운영 가이드 문서
실제 테스트를 시작하고 결과를 남기는 데 도움을 주는 문서입니다.

| 파일 | 역할 |
|------|------|
| `QUICKSTART.md` | 빠른 시작 안내 |
| `ACCOUNT_RULES.md` | 계정 관리 규칙 |
| `CURRENT_SCENARIOS.md` | 어떤 문서를 먼저 써야 하는지 정리 |
| `results/common-test-TEMPLATE.md` | 결과 기록 템플릿 |

---

## 4. 추천 실행 순서

### 릴리스 전 최소 세트
1. `core_newuser_001.md`
2. `core_browse_001.md`
3. `persistence_001.md`

### 일반 수동 QA 기본 세트
1. `core_newuser_001.md`
2. `core_returning_001.md`
3. `core_browse_001.md`
4. `access_public_private_001.md`
5. `persistence_001.md`
6. `repeatability-node-creation-test.md` (회귀 확인 필요 시)

### 인증/권한 변경 후
1. `access_public_private_001.md`
2. `core_newuser_001.md`
3. `core_returning_001.md`
4. `persistence_001.md`

### 저장/캐시 변경 후
1. `core_newuser_001.md`
2. `core_returning_001.md`
3. `persistence_001.md`
4. `repeatability-node-creation-test.md`

---

## 5. 결과 저장 규칙

결과는 계속 `docs/test-scenarios/results/` 아래에 저장합니다.

권장 폴더명 예시:
- `core-newuser-001-ive-2026-04-20-1930/`
- `core-returning-001-bts-2026-04-20-2010/`
- `core-browse-001-riize-2026-04-20-2105/`
- `access-public-private-001-2026-04-20-2140/`
- `persistence-001-xg-2026-04-20-2230/`
- `repeat-node-regression-zb1-2026-04-20-2310/`

각 결과 폴더에는 아래 구성을 권장합니다.

```text
results/{scenario}-{group}-YYYY-MM-DD-HHMM/
├── test-result.md
└── screenshots/
    ├── 01-home.png
    ├── 02-login.png
    ├── 03-my-trees.png
    └── ...
```

스크린샷은 필수가 아닙니다.
다만 오류, 혼란, 화면 불일치, 권한 문제, 저장 유실이 보일 때는 남기는 것을 권장합니다.

---

## 6. known blocker / 과거 이슈 취급 원칙

이 폴더에 과거 문제 설명이 남아 있더라도, 아래 원칙을 따릅니다.

- **현재도 재현되는 문제**: known issue 또는 blocker로 유지
- **이미 고쳐진 문제**: 삭제보다 히스토리 또는 회귀 포인트로 남김
- **대표 시나리오와 무관한 과거 이슈**: 회귀 문서 또는 결과 기록으로 이동

즉, 오래된 문제 설명을 그대로 메인 안내에 두지 않습니다.
현재 상태와 맞는지 항상 다시 확인합니다.

---

## 7. 새 그룹 데이터 추가 방법

1. `data/{group}-data.json` 생성
2. 적절한 대표 시나리오 선택
3. 결과를 `results/{scenario}-{group}-YYYY-MM-DD-HHMM/`에 저장
4. 필요 시 이 README의 그룹 목록을 갱신

---

## 8. 체크리스트

테스트 시작 전:
- [ ] `CURRENT_SCENARIOS.md`를 확인했는가
- [ ] 어떤 대표 시나리오를 돌릴지 정했는가
- [ ] 데이터 파일을 정했는가
- [ ] 결과 폴더명을 정했는가

테스트 중:
- [ ] 각 단계 결과를 즉시 기록했는가
- [ ] 혼란 지점을 그대로 남겼는가
- [ ] 오류 또는 상태 불일치 시 스크린샷을 남겼는가

테스트 후:
- [ ] 최종 판정을 기록했는가
- [ ] 가장 먼저 고쳐야 할 문제 1개를 뽑았는가
- [ ] 대표 시나리오인지 회귀 시나리오인지 문맥을 유지했는가

---

## 9. 현재 상태 요약

현재 폴더는 다음 상태를 목표로 운영합니다.

- 대표 시나리오와 회귀 시나리오가 명확히 구분됨
- 같은 폴더 안에서 어떤 문서를 먼저 써야 하는지 알 수 있음
- 결과 템플릿이 새 시나리오 체계를 따라감
- 과거 이슈는 삭제보다 회귀 포인트로 관리됨

---

*마지막 업데이트: 2026-04-20*
