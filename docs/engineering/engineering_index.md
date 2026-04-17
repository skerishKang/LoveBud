# LoveBud Engineering 문서 인덱스

> **버전:** 1.1  
> **갱신:** 2026-04-18

---

## 현재 상태 요약

| 작업 | 코드 | 브라우저 검증 |
|------|------|----------|
| detail.js 분리 | ✅ 완료 | ⏳ 검증 대기 |
| search.js 분리 | ✅ 완료 | ⏳ **검증 대기** |
| editor.js 분리 | ✅ 완료 | ⏳ **검증 대기** |
| media.js 생성 | ✅ 완료 | 🔄 미배선 |

**핵심:** 모든 페이지 리팩터링 코드 변경 완료, **브라우저 검증이 남아 있음**

---

## 읽기 순서 (권장)

1. **처음 방문:** 이 인덱스 (현재 문서)
2. **RECENT_REFACTORING.md** - 전체 리팩터링 기록 (必 읽)
3. **CTO_REPORT_20260418.md** - 스프린트 요약
4. **COMMON_CODE_CANDIDATES.md** - 다음候选 개선

---

## 핵심 문서

| 문서 | 설명 | 우선순위 | 상태 |
|------|------|----------|------|
| [RECENT_REFACTORING.md](./RECENT_REFACTORING.md) | 전체 리팩터링 기록 | 🔴 필수 | ⏳ 검증 대기 |
| [API_CONTRACT.md](./API_CONTRACT.md) | API 응답 계약 (flat camelCase) | 🔴 필수 | ✅ 완료 |
| [CTO_REPORT_20260418.md](./CTO_REPORT_20260418.md) | 스프린트 A+B+C 요약 | 🟡 권장 | ✅ 완료 |
| [COMMON_CODE_CANDIDATES.md](./COMMON_CODE_CANDIDATES.md) | 공통화 후보 | 🟡 권장 | 🔄 미배선 |
| [MANUAL_TEST_CHECKLIST.md](./MANUAL_TEST_CHECKLIST.md) | 테스트 체크리스트 | 🟡 권장 | ⏳ 검증 대기 |

### 검증 대기 상태 (중요)

| 페이지 | 검증 필요 | 우선순위 |
|--------|----------|----------|
| **search.js** | ⏳ **검증 대기** | 高 |
| **editor.js** | ⏳ **검증 대기** | 高 |
| detail.js | ⏳ 검증 대기 | 低 |

---

## 작성 규칙

1. **새로운 기술 문서는 이 폴더에 생성**
2. **생성 후 `doc_index.md`에도 추가**
3. **API/구조 변경 시 관련 문서 동시 갱신**

---

## 관련 외부 문서

- [Backend](../backend/backend_index.md) - 백엔드 구현 상세
- [Ops](../ops/ops_index.md) - 운영 가이드
- [Product](../product/product_index.md) - 제품 정의
