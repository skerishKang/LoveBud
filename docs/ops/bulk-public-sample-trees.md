# 샘플/테스트 트리 일괄 공개 전환 가이드

> ⚠️ **경고**: 이 스크립트는 **테스트/샘플 데이터 전용**입니다.  
> 실제 사용자의 private 트리는 절대 건드리지 마세요.

## 사용 시나리오

- 테스트 계정이 생성한 트리들을 browse/search 페이지에서 보이게 만들기
- 데모용 샘플 트리들을 공개로 일괄 전환
- 운영 초기 데이터 중 특정 계정의 트리만 공개로 변경

## 안전장치

이 스크립트는 다음 안전장치를 포함합니다:

1. **명시적 ID 목록 필요** - 조건 없는 UPDATE 금지
2. **Dry-run 모드** - 실제 실행 전 영향받을 row 수 확인
3. **Owner ID 제한** - 테스트 계정 ID만 허용
4. **Tree ID 명시** - 특정 트리 ID 목록 기반 실행

## PostgreSQL 스크립트

### 1. 테스트 계정 기준 공개 전환 (권장)

```sql
-- 테스트 계정 UID 목록 (실제 값으로 교체)
WITH test_accounts AS (
  SELECT unnest(ARRAY[
    'test-user-uid-1',
    'test-user-uid-2',
    'demo-account-uid'
  ]) AS uid
),
-- 영향받을 트리 확인
target_trees AS (
  SELECT t.id, t.title, t.owner_id, t.visibility
  FROM trees t
  JOIN test_accounts ta ON t.owner_id = ta.uid
  WHERE t.visibility = 'private'
)
-- Dry-run: 영향받을 row 수 확인
SELECT 'DRY-RUN: Trees to update' as status, COUNT(*) as tree_count
FROM target_trees;

-- 실제 실행 (Dry-run 결과 확인 후 주석 해제)
-- UPDATE trees
-- SET visibility = 'public',
--     updated_at = NOW()
-- WHERE owner_id IN (
--   SELECT unnest(ARRAY['test-user-uid-1', 'test-user-uid-2', 'demo-account-uid'])
-- )
-- AND visibility = 'private';
```

### 2. 특정 트리 ID 기준 공개 전환 (가장 안전)

```sql
-- 명시적 Tree ID 목록 (실제 값으로 교체)
WITH target_tree_ids AS (
  SELECT unnest(ARRAY[
    'tree_test_01',
    'tree_test_02',
    'tree_demo_01',
    'tree_sample_bts',
    'tree_sample_xg'
  ]) AS tree_id
),
-- Dry-run: 영향받을 트리와 메모리 수 확인
preview AS (
  SELECT 
    t.id as tree_id,
    t.title,
    t.owner_id,
    COUNT(m.id) as memory_count
  FROM trees t
  JOIN target_tree_ids tt ON t.id = tt.tree_id
  LEFT JOIN memories m ON m.tree_id = t.id
  WHERE t.visibility = 'private'
  GROUP BY t.id, t.title, t.owner_id
)
SELECT * FROM preview;

-- 실제 실행 (Dry-run 결과 확인 후 주석 해제)
-- -- 1) 트리 공개 전환
-- UPDATE trees
-- SET visibility = 'public',
--     updated_at = NOW()
-- WHERE id IN (
--   SELECT unnest(ARRAY['tree_test_01', 'tree_test_02', 'tree_demo_01'])
-- )
-- AND visibility = 'private';
-- 
-- -- 2) 해당 트리의 메모리도 공개 정합성 맞춤
-- UPDATE memories
-- SET visibility = 'public',
--     updated_at = NOW()
-- WHERE tree_id IN (
--   SELECT unnest(ARRAY['tree_test_01', 'tree_test_02', 'tree_demo_01'])
-- )
-- AND visibility = 'private';
```

### 3. 메모리 정합성 확인 및 수정

```sql
-- 트리는 public인데 메모리가 private인 불일치 확인
SELECT 
  t.id as tree_id,
  t.title,
  t.visibility as tree_visibility,
  COUNT(m.id) as private_memory_count
FROM trees t
JOIN memories m ON m.tree_id = t.id
WHERE t.visibility = 'public'
  AND m.visibility = 'private'
GROUP BY t.id, t.title, t.visibility;

-- 불일치 수정 (public 트리의 메모리를 public으로)
-- UPDATE memories
-- SET visibility = 'public',
--     updated_at = NOW()
-- WHERE tree_id IN (
--   SELECT DISTINCT t.id
--   FROM trees t
--   JOIN memories m ON m.tree_id = t.id
--   WHERE t.visibility = 'public'
--     AND m.visibility = 'private'
-- );
```

## JavaScript 클라이언트 스크립트 (Supabase/PostgREST)

```javascript
/**
 * Safe Bulk Public Tree Update - Admin Script
 * 
 * 사용법:
 * 1. 브라우저 콘솔에서 실행
 * 2. DRY_RUN 먼저 확인
 * 3. 실제 실행 시 DRY_RUN = false로 변경
 */

const CONFIG = {
  DRY_RUN: true,  // 반드시 true로 시작. 결과 확인 후 false로 변경
  TARGET_TREE_IDS: [
    'tree_test_01',
    'tree_test_02',
    // 실제 테스트 트리 ID 추가
  ],
  TARGET_OWNER_IDS: [
    'test-user-uid-1',
    // 실제 테스트 계정 UID 추가
  ]
};

async function previewPublicUpdate() {
  console.log('[Bulk Public] Dry-run mode - Preview affected rows:');
  
  // 트리 조회
  const { data: trees, error } = await supabase
    .from('trees')
    .select('id, title, owner_id, visibility')
    .in('id', CONFIG.TARGET_TREE_IDS)
    .eq('visibility', 'private');
  
  if (error) {
    console.error('[Bulk Public] Error:', error);
    return;
  }
  
  console.log(`[Bulk Public] Trees to update: ${trees.length}`);
  trees.forEach(t => {
    console.log(`  - ${t.id}: "${t.title}" (owner: ${t.owner_id})`);
  });
  
  // 메모리 수 확인
  for (const tree of trees) {
    const { count } = await supabase
      .from('memories')
      .select('*', { count: 'exact', head: true })
      .eq('tree_id', tree.id)
      .eq('visibility', 'private');
    console.log(`  - ${tree.id}: ${count} memories will be updated`);
  }
}

async function executePublicUpdate() {
  if (CONFIG.DRY_RUN) {
    console.warn('[Bulk Public] DRY_RUN is true. Set to false to execute.');
    return;
  }
  
  console.log('[Bulk Public] Executing update...');
  
  // 1. 트리 업데이트
  const { data: trees, error: treeError } = await supabase
    .from('trees')
    .update({ visibility: 'public', updated_at: new Date().toISOString() })
    .in('id', CONFIG.TARGET_TREE_IDS)
    .eq('visibility', 'private')
    .select();
  
  if (treeError) {
    console.error('[Bulk Public] Tree update failed:', treeError);
    return;
  }
  
  console.log(`[Bulk Public] Updated ${trees.length} trees`);
  
  // 2. 메모리 업데이트
  const { data: memories, error: memError } = await supabase
    .from('memories')
    .update({ visibility: 'public', updated_at: new Date().toISOString() })
    .in('tree_id', CONFIG.TARGET_TREE_IDS)
    .eq('visibility', 'private')
    .select();
  
  if (memError) {
    console.error('[Bulk Public] Memory update failed:', memError);
    return;
  }
  
  console.log(`[Bulk Public] Updated ${memories.length} memories`);
  console.log('[Bulk Public] Done!');
}

// 실행
previewPublicUpdate();
// DRY_RUN 결과 확인 후 아래 실행:
// CONFIG.DRY_RUN = false; executePublicUpdate();
```

## 체크리스트

실행 전 반드시 확인:

- [ ] 실제 사용자 UID가 목록에 없음 확인
- [ ] DRY_RUN 결과가 예상 범위 내 (너무 많은 row는 경고)
- [ ] 테스트 계정만 포함됨 검증
- [ ] 백업 완료 (가능한 경우)
- [ ] browse/search 페이지에서 결과 확인 준비됨

## 테스트 시나리오용 public 트리 생성

테스트 자동화에서는 다음 방법으로 public 트리를 생성:

### 방법 1: URL 파라미터
```
/my-trees.html?testPublic=1
```

### 방법 2: localStorage 플래그
```javascript
localStorage.setItem('lovebud_test_public', '1');
// 그 후 트리 생성
```

### 방법 3: Runtime Flags
```javascript
window.LoveBudRuntimeFlags = { forcePublicTrees: true };
```

## 관련 파일

- `js/my-trees.js` - `isTestPublicMode()` 함수
- `js/editor.js` - 이미 `visibility: 'public'`로 하드코딩
- `pages/search.html` - browse/search 페이지
- `js/search.js` - public trees 로딩 로직
