-- ============================================
-- 테스트 데이터 전체 공개 전환
-- ============================================
-- ⚠️ 주의: 현재 DB가 전부 테스트 데이터일 때만 사용
-- 실행 전 반드시 백업 권장

-- 1) 모든 트리 public 전환
UPDATE trees
SET visibility = 'public',
    updated_at = NOW();

-- 2) 모든 메모리 public 전환  
UPDATE memories
SET visibility = 'public',
    updated_at = NOW();

-- ============================================
-- 확인 쿼리 (실행 후 검증)
-- ============================================

-- 전체 트리 상태 확인
SELECT visibility, COUNT(*) as count 
FROM trees 
GROUP BY visibility;

-- 전체 메모리 상태 확인
SELECT visibility, COUNT(*) as count 
FROM memories 
GROUP BY visibility;
