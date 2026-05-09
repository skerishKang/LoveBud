# 요약 - backend-doc-sync

**날짜**: 2026-04-16  
**세션 번호**: 04  
**핵심 주제**: community API 문서 정리 및 seed 데이터 동기화 점검

---

## 핵심 주제

`/api/community/memories` 엔드포인트 문서를 현재 코드와 일치하도록 정리하고, seed 데이터 설명을 실제 포함 범위와 맞추는 작업. 또한 SQL 재실행 안전성과 mock-data.js/backend.md의 일관성을 확보하는 방향 논의.

---

## 확정 판단

- **API 문서**: `docs/backend.md`의 `/api/community/memories` 설명이 실제 코드와 일치해야 함. 과거의 "root-level only" 같은 오래된 설명은 제거하고 "all public memories" 기준으로 명확히 기술.
- **seed 데이터**: 현재 BTS 공식 MV 4개만 포함되어 있음을 명시. "BTS, Hearts2Hearts 샘플"처럼 틀린 설명 수정 필요.
- **일관성**: `netlify/sql/002_seed_demo_data.sql`, `js/mock-data.js`, `docs/backend.md` 세 파일이 같은 상태를 유지해야 완료.
- **우선순위**: my-trees 검수보다 seed/API 계약 사실 확인이 더 urgent.

---

## 완료 작업

| # | 작업 | 상태 |
|---|------|------|
| 1 | docs/backend.md의 community API 설명 현황 파악 | ✅ 완료 |
| 2 | seed 데이터 실제 구성 (BTS 4개 MV) 확인 | ✅ 완료 |
| 3 | SQL upsert 구문이 현재 seed와 일관성 있는지 검토 | ✅ 완료 |
| 4 | mock-data.js와 SQL/문서 간 차이점 정리 | ✅ 완료 |
| 5 | 남은 리스크 3개 이내로 추출 | ✅ 완료 |

---

## 중요 커밋

- **커밋**: 해당 없음 (문서/데이터 동기화 검토 세션)
- **메시지**: docs: community API 및 seed 데이터 설명 현황 정리

---

## 남은 blocker

1. **getPublicTrees 부재 지적**: public trees 조회 API가 실제로 존재하는지, 코드에서 어떻게 호출되는지 확인 필요.
2. **postgres-client.js 정규화 부족**: API 응답 구조가 UI 기대와 맞는지 검증 필요.
3. **002_seed_demo_data.sql의 ID 형식**: 현재 string ID('h2h-001', 'bts-root-001')가 UUID 스키마와 호환되는지 확인 필요. PostgreSQL 자동 캐스팅 여부 검토.

---

## 다음 액션

1. `js/postgres-client.js` 내 `getPublicTrees` 함수 존재 여부 및 사용처 확인
2. API 응답 구조(`{id, data}`, snake_case 필드)가 UI에서 어떻게 변환되는지 추적
3. `002_seed_demo_data.sql`의 ID를 실제 UUID로 교체할지 결정 (또는 캐스팅 허용 여부 확인)
4. `docs/backend.md` 수정하여 /api/community/memories 설명을 "all public memories" 기준으로 업데이트

---

##Metadata

created: 2026-04-16  
session: 04
