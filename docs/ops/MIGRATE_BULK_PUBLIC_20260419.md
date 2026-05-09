# [OPS] 전수 데이터 공개 마이그레이션 가이드 (2026-04-19)

현재 데이터베이스의 모든 트리와 메모리를 테스트 및 둘러보기 검증을 위해 `public`으로 일괄 전환합니다.

## SQL 마이그레이션

데이터베이스 관리 툴(pSQL, Neon Console 등)에서 아래 쿼리를 순서대로 실행하세요.

```sql
-- 1. 모든 트리를 공개 상태로 전환
UPDATE trees
SET visibility = 'public',
    updated_at = NOW();

-- 2. 모든 메모리를 공개 상태로 전환
UPDATE memories
SET visibility = 'public',
    updated_at = NOW();
```

> [!NOTE]
> `memories` 테이블에 `updated_at` 컬럼이 없는 경우, `updated_at = NOW()` 부분만 제외하고 실행하십시오.

## 검증 방법

1. 쿼리 실행 후 `search.html` 페이지에 접속합니다.
2. 기존에 보이지 않던 트리들이 카드 형태로 모두 노출되는지 확인합니다.
3. 각 트리의 '첫 순간 감상하기'를 클릭하여 상세 페이지 데이터가 정상적으로 나오는지 확인합니다.

---
**생성 일시**: 2026-04-19
**상태**: 실행 대기 (운영 관리자 확인 필요)
