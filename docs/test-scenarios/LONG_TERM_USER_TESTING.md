# 장기 사용자 테스트 구조 제안

> 현재 테스트 시스템은 "신규/기존 가입자" 중심입니다.
> 
> 시간이 지난 후 사용자 (예: 가입 30일 후, 100일 후)의 행동도 검증 필요합니다.

---

## 🎯 문제 의식

| 현재 테스트 | 부족한 점 |
|------------|----------|
| 신규 가입자 (Day 0) | 트리 0개, 첫 경험만 검증 |
| 기존 가입자 (Day 1+) | 트리 1~3개, 초기 사용만 검증 |
| ??? | **트리 10+개, 수십 개 노드** 보유 사용자는? |

→ **장기 사용자의 사용 패턴, 피로도, 기능 한계** 파악 필요

---

## 📊 사용자 생애주기별 테스트

```
[신규] → [초기] → [성장] → [장기] → [숙련]
 Day 0   Day 7    Day 30   Day 90   Day 365
  │        │        │        │        │
  ▼        ▼        ▼        ▼        ▼
회원가입  트리생성  노드증가  다중트리  고급기능
첫인상    적응기    반복사용  복잡도↑   최적화
```

---

## 🆕 제안: 사용자 단계별 시나리오

### 1. 신규 사용자 (New User)
**시나리오 파일**: `scenarios/new-user-journey.md`

| 항목 | 내용 |
|------|------|
| **시점** | 가입 직후 (Day 0) |
| **트리 수** | 0개 |
| **목표** | 첫 트리 생성, 첫 노드 3개 추가 |
| **핵심 질문** | "처음 사용하는데 막히는가?" |
| **결과 파일명** | `{그룹명}-newuser-test-YYYY-MM-DD.md` |

---

### 2. 초기 사용자 (Early User) - NEW! ⭐
**시나리오 파일**: `scenarios/early-user-journey.md` (제안)

| 항목 | 내용 |
|------|------|
| **시점** | 가입 1~7일 후 |
| **트리 수** | 1~2개 |
| **총 노드** | 5~15개 |
| **목표** | 추가 트리 생성, 기존 트리에 노드 추가 |
| **핵심 질문** | "여전히 흥미로운가? 포기하는가?" |
| **결과 파일명** | `{그룹명}-early-test-YYYY-MM-DD.md` |

**테스트 데이터**: `data/early-user-mock.json`
```json
{
  "userStage": "early",
  "daysSinceSignup": 7,
  "existingTrees": [
    {
      "treeId": "ive-tree-001",
      "treeName": "아이브 정리",
      "nodeCount": 12,
      "lastActivity": "2026-04-11"
    }
  ],
  "task": "기존 트리에 노드 3개 추가 + 새 트리 1개 생성"
}
```

---

### 3. 성장 사용자 (Growing User) - NEW! ⭐
**시나리오 파일**: `scenarios/growing-user-journey.md` (제안)

| 항목 | 내용 |
|------|------|
| **시점** | 가입 30일 후 |
| **트리 수** | 3~5개 |
| **총 노드** | 30~50개 |
| **목표** | 다중 트리 관리, 트리 간 이동, 검색/필터링 |
| **핵심 질문** | "복잡해지는데 기능이 버틸 수 있는가?" |
| **결과 파일명** | `{그룹명}-growing-test-YYYY-MM-DD.md` |

**테스트 데이터**: `data/growing-user-mock.json`
```json
{
  "userStage": "growing",
  "daysSinceSignup": 30,
  "existingTrees": [
    {"treeId": "t1", "treeName": "아이브", "nodeCount": 15},
    {"treeId": "t2", "treeName": "뉴진스", "nodeCount": 12},
    {"treeId": "t3", "treeName": "세븐틴", "nodeCount": 18}
  ],
  "task": "특정 노드 찾기, 트리 간 비교, 정리/정돈"
}
```

---

### 4. 장기 사용자 (Long-term User) - NEW! ⭐
**시나리오 파일**: `scenarios/longterm-user-journey.md` (제안)

| 항목 | 내용 |
|------|------|
| **시점** | 가입 90일 후 |
| **트리 수** | 5~10개 |
| **총 노드** | 100+ 개 |
| **목표** | 대규모 데이터 관리, 공유, 아카이빙 |
| **핵심 질문** | "100개 노드도 쾌적한가? 한계는?" |
| **결과 파일명** | `{그룹명}-longterm-test-YYYY-MM-DD.md` |

**테스트 데이터**: `data/longterm-user-mock.json`
```json
{
  "userStage": "longterm",
  "daysSinceSignup": 90,
  "existingTrees": [
    {"treeId": "t1", "treeName": "아이브", "nodeCount": 45},
    {"treeId": "t2", "treeName": "뉴진스", "nodeCount": 38},
    {"treeId": "t3", "treeName": "세븐틴", "nodeCount": 52},
    {"treeId": "t4", "treeName": "BTS", "nodeCount": 41}
  ],
  "task": "노드 100개 트리 열기, 검색, 필터, 공유"
}
```

---

### 5. 숙련 사용자 (Power User) - NEW! ⭐
**시나리오 파일**: `scenarios/power-user-journey.md` (제안)

| 항목 | 내용 |
|------|------|
| **시점** | 가입 1년 후 |
| **트리 수** | 10+ 개 |
| **총 노드** | 200+ 개 |
| **목표** | 고급 기능, 트리 템플릿, API 활용 |
| **핵심 질문** | "파워유저를 위한 기능이 있는가?" |
| **결과 파일명** | `{그룹명}-power-test-YYYY-MM-DD.md` |

---

## 📁 확장된 폴더 구조 (제안)

```
docs/test-scenarios/
├── scenarios/                    # ✅ 새 폴더
│   ├── new-user-journey.md      # (기존, 이름 변경)
│   ├── early-user-journey.md    # ✅ 제안
│   ├── growing-user-journey.md  # ✅ 제안
│   ├── longterm-user-journey.md # ✅ 제안
│   └── power-user-journey.md    # ✅ 제안
├── data/
│   ├── {그룹명}-data.json       # (기존과 동일)
│   ├── new-user-mock.json       # ✅ 제안 (신규용 데이터)
│   ├── early-user-mock.json     # ✅ 제안
│   ├── growing-user-mock.json   # ✅ 제안
│   └── longterm-user-mock.json  # ✅ 제안
└── results/
    └── ... (userType 확장)
```

---

## 🎤 명령어 예시 (확장)

| 사용자 유형 | 명령어 | 결과 파일명 |
|------------|--------|------------|
| 신규 | `"IVE 신규 테스트 해줘"` | `ive-newuser-test-...md` |
| 초기 | `"IVE 초기 테스트 해줘"` | `ive-early-test-...md` |
| 성장 | `"IVE 성장 테스트 해줘"` | `ive-growing-test-...md` |
| 장기 | `"IVE 장기 테스트 해줘"` | `ive-longterm-test-...md` |
| 숙련 | `"IVE 숙련 테스트 해줘"` | `ive-power-test-...md` |

---

## 🔧 구현 우선순위

| 우선순위 | 단계 | 이유 |
|----------|------|------|
| 🔴 **1순위** | 신규 (New) | MVP 통과 기준 |
| 🔴 **2순위** | 초기 (Early) | 이탈 방지 핵심 |
| 🟡 **3순위** | 성장 (Growing) | 확장성 검증 |
| 🟢 **4순위** | 장기 (Long-term) | 한계 파악 |
| 🟢 **5순위** | 숙련 (Power) | 고급 기능 |

---

## 💡 다음 단계 (제안)

### 지금 당장 가능
1. **현재 시스템으로 신규/기존 테스트 먼저 충분히 반복**
2. **Early User 시나리오부터 추가 구현**
3. **mock 데이터 생성 로직 개발**

### 추후 구현
4. **자동 mock 데이터 생성 도구** (스크립트)
5. **대용량 트리 시뮬레이션** (100+ 노드 자동 생성)
6. **사용자 단계별 성능 벤치마크**

---

## 🤔 고민 포인트

### Q: Early User 테스트는 어떻게 시뮬레이션할까?

**방법 1**: Mock 데이터로 가상 트리/노드 생성 (권장)
- 테스트 전 API로 가상 데이터 주입
- 실제처럼 보이지만 테스트용

**방법 2**: 테스트 전용 계정에 미리 데이터 쌓기
- 실제 서비스에서 30일간 활동한 계정
- 테스트 계정 풀 관리 필요

**방법 3**: 로컬/스테이징 환경에서 대량 데이터 생성
- 안전하게 테스트 가능
- 실제 프로덕션과 차이 있을 수 있음

---

## 📊 결론

| 현재 | 제안 |
|------|------|
| 2단계 (신규/기존) | **5단계로 확장** |
| 단순 반복 테스트 | **생애주기별 테스트** |
| 초기 UX 중심 | **장기 사용성까지** |

→ **점진적으로 확장하며 MVP 안정화 우선!**

---

*이 문서는 LoveBud 테스트 시나리오 시스템의 향후 확장 방향을 제안합니다.*
