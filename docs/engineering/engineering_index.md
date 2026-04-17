# LoveBud Engineering 문서 인덱스

> **버전:** 1.2  
> **갱신:** 2026-04-18 (search/detail 마감 완료)

---

## 현재 상태 요약

| 작업 | 코드 | 브라우저 검증 | 상태 |
|------|------|-------------|------|
| detail.js 분리 | ✅ 완료 | ✅ 사용자 승인으로 생략 | **마감 완료** |
| search.js 분리 | ✅ 완료 | ✅ 사용자 승인으로 생략 | **마감 완료** |
| editor.js 분리 | ✅ 완료 | ⏳ 검증 대기 | 검증 대기 |
| media.js 생성 | ✅ 완료 | 🔄 미배선 | 미배선 |

**핵심:** search/detail 리팩터링 완료, ** бра라우저 검증은 사용자 요청으로 생략됨**

---

## 읽기 순서 (권장)

1. **처음 방문:** 이 인덱스 (현재 문서)
2. **RECENT_REFACTORING.md** - 전체 리팩터링 기록 (必 읽)
3. **UTIL_USAGE_POLICY.md** - 공통 유틸 사용 정책
4. **COMMON_CODE_CANDIDATES.md** - 다음Candidate 개선

---

## utility 문서

| 문서 | 설명 | 우선순위 | 상태 |
|------|------|----------|------|
| [UTIL_USAGE_POLICY.md](./UTIL_USAGE_POLICY.md) | 공통 유틸 사용 정책 | 🟡 권장 | ✅ 완료 |

---

## 핵심 문서

| 문서 | 설명 | 우선순위 | 상태 |
|------|------|----------|------|
| [RECENT_REFACTORING.md](./RECENT_REFACTORING.md) | 전체 리팩터링 기록 | 🔴 필수 | ✅ 완료 (search/detail 마감) |
| [API_CONTRACT.md](./API_CONTRACT.md) | API 응답 계약 (flat camelCase) | 🔴 필수 | ✅ 완료 |
| [CTO_REPORT_20260418.md](./CTO_REPORT_20260418.md) | 스프린트 A+B+C 요약 | 🟡 권장 | ✅ 완료 |
| [COMMON_CODE_CANDIDATES.md](./COMMON_CODE_CANDIDATES.md) | 공통화 후보 | 🟡 권장 | 🔄 미배선 |
| [UTIL_USAGE_POLICY.md](./UTIL_USAGE_POLICY.md) | 공통 유틸 사용 정책 | 🟡 권장 | ✅ 완료 |

### 검증 상태

| 페이지 | 검증 필요 | 우선순위 | 상태 |
|--------|----------|----------|------|
| **search.js** | ✅ 사용자 승인으로 생략 | - | **마감 완료** |
| **detail.js** | ✅ 사용자 승인으로 생략 | - | **마감 완료** |
| **editor.js** | ⏳ 검증 대기 | 高 | 검증 대기 |

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
