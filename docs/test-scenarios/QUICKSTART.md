# LoveBud 테스트 빠른 시작 가이드

> 어떤 테스트를 해야 할지 빠르게 고르고, 바로 실행하기 위한 문서입니다.

---

## 1. 가장 빠른 시작 순서

1. `CURRENT_SCENARIOS.md`를 연다.
2. 이번에 필요한 테스트 목적을 고른다.
3. 아래 표에서 맞는 시나리오 문서를 연다.
4. `data/{group}-data.json`를 함께 본다.
5. 결과를 `results/{scenario}-{group}-YYYY-MM-DD-HHMM/test-result.md`에 기록한다.

---

## 2. 어떤 테스트를 해야 하나

| 내가 확인하고 싶은 것 | 먼저 열 문서 |
|----------------------|-------------|
| 처음 온 사용자가 바로 시작 가능한지 | `core_newuser_001.md` |
| 기존 사용자가 계속 쓸 수 있는지 | `core_returning_001.md` |
| 공개 탐색 흐름이 자연스러운지 | `core_browse_001.md` |
| 공개/비공개와 권한이 안 깨졌는지 | `access_public_private_001.md` |
| 저장 후 새로고침/재진입이 안정적인지 | `persistence_001.md` |
| 과거 반복 생성/새로고침 이슈가 다시 생겼는지 | `repeatability-node-creation-test.md` |

---

## 3. 추천 실행 세트

### 릴리스 전 최소 세트
- `core_newuser_001.md`
- `core_browse_001.md`
- `persistence_001.md`

### 일반 수동 QA 기본 세트
- `core_newuser_001.md`
- `core_returning_001.md`
- `core_browse_001.md`
- `access_public_private_001.md`
- `persistence_001.md`

### 저장/캐시 변경 후
- `core_newuser_001.md`
- `core_returning_001.md`
- `persistence_001.md`
- `repeatability-node-creation-test.md`

### 인증/권한 변경 후
- `access_public_private_001.md`
- `core_newuser_001.md`
- `core_returning_001.md`
- `persistence_001.md`

---

## 4. 한 줄 요청 예시

```text
"IVE 데이터로 core_newuser_001 테스트 해줘"
```

```text
"BTS 데이터로 core_returning_001 테스트 해줘"
```

```text
"RIIZE 데이터로 core_browse_001 테스트 해줘"
```

```text
"권한 경계 확인하려고 access_public_private_001 테스트 해줘"
```

```text
"저장 안정성 확인하려고 persistence_001 테스트 해줘"
```

```text
"예전 반복 생성 회귀 확인하려고 repeatability-node-creation-test.md 기준으로 테스트 해줘"
```

---

## 5. 사용자 유형 선택

| 유형 | 언제 사용? | 주로 연결되는 시나리오 |
|------|-----------|------------------------|
| 신규 | 처음 사용하는 사용자 흐름 확인 | `core_newuser_001.md` |
| 기존 | 이미 트리/메모리를 가진 사용자 흐름 확인 | `core_returning_001.md`, `persistence_001.md` |
| 비로그인 탐색 | browse / 공개 노출 확인 | `core_browse_001.md`, `access_public_private_001.md` |

---

## 6. 지원하는 그룹 데이터

현재 README 기준으로 등록되어 있는 데이터 예시는 아래와 같습니다.

- IVE
- BTS
- hearts2hearts
- RIIZE
- TWS
- ZEROBASEONE
- ILLIT
- MEOVV
- KickFlip
- KATSEYE
- Cortiz
- Santos Bravos

실제 사용 시에는 `docs/test-scenarios/data/` 아래의 JSON 파일 존재 여부를 기준으로 판단합니다.

새 그룹이 필요하면:
1. `data/{group}-data.json` 생성
2. 적절한 시나리오 문서 선택
3. 결과 저장

---

## 7. 결과 파일 위치

```text
docs/test-scenarios/results/
└── {scenario}-{group}-YYYY-MM-DD-HHMM/
    ├── test-result.md
    └── screenshots/
```

예시:
- `results/core-newuser-001-ive-2026-04-20-1930/test-result.md`
- `results/core-browse-001-riize-2026-04-20-2015/test-result.md`
- `results/persistence-001-bts-2026-04-20-2140/test-result.md`

스크린샷 규칙:
- 필수 아님
- 오류, 권한 문제, 저장 유실, 상태 불일치, UX 혼란 화면은 권장

---

## 8. 결과 기록 최소 항목

최소한 아래 항목은 남기는 것을 권장합니다.

- 테스트한 시나리오 문서명
- 사용한 데이터 파일
- 단계별 결과 요약
- 가장 큰 문제 1개
- 최종 판정: 통과 / 조건부 통과 / 실패

자세한 형식은 `results/common-test-TEMPLATE.md`를 사용합니다.

---

## 9. 문제 해결

### 어떤 문서를 먼저 써야 할지 모르겠다
→ `CURRENT_SCENARIOS.md` 먼저 확인

### 신규 사용자 흐름을 보고 싶다
→ `core_newuser_001.md`

### 기존 사용자 흐름을 보고 싶다
→ `core_returning_001.md`

### browse 흐름만 보고 싶다
→ `core_browse_001.md`

### 권한/공개 범위가 의심된다
→ `access_public_private_001.md`

### 저장 후 유실이 의심된다
→ `persistence_001.md`

### 예전 버그가 다시 생겼는지 확인하고 싶다
→ `repeatability-node-creation-test.md`

---

## 10. 더 읽을 문서

| 문서 | 설명 |
|------|------|
| `README.md` | 폴더 전체 구조와 운영 원칙 |
| `CURRENT_SCENARIOS.md` | 지금 기준 대표 시나리오 맵 |
| `ACCOUNT_RULES.md` | 계정 관리 규칙 |
| `results/common-test-TEMPLATE.md` | 결과 작성 템플릿 |

---

**바로 시작 예시**

> `"IVE 데이터로 core_newuser_001 테스트 해줘"`
