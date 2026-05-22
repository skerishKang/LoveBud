/**
 * API Contract Transitional Compatibility Tests
 *
 * Purpose:
 * - Verify that flat camelCase responses pass through correctly
 * - Document that legacy snake_case / {id, data} inputs also currently pass
 *   (this is transitional compatibility, to be removed after migration)
 *
 * Target:
 * - js/utils/normalize.js
 * - js/postgres-client.js (indirectly via contract expectations)
 *
 * Removal trigger:
 * - When /community/trees, /community/memories return flat camelCase only
 * - This test file can be simplified or removed after migration
 */

const assert = require('assert');

// Simulate the normalize functions from js/utils/normalize.js
function normalizeMemory(mem) {
    if (!mem) return null;

    // Transitional fallback block:
    // Accept legacy snake_case fields during migration.
    // New code and server responses must prefer flat camelCase only.
    return {
        id: mem.id,
        treeId: mem.treeId || mem.tree_id || null,
        parentId: mem.parentId ?? mem.parent_id ?? null,
        title: mem.title || '',
        memo: mem.memo || mem.description || '',
        quote: mem.quote || '',
        timestamp: mem.timestamp || '',
        thumbnail: mem.thumbnail || '',
        visibility: mem.visibility || 'private',
        artist: mem.artist || '',
        source: mem.source || '',
        sourceUrl: mem.sourceUrl || mem.source_url || '',
        sourceType: mem.sourceType || mem.source_type || 'youtube',
        emotionTags: mem.emotionTags || mem.emotion_tags || [],
        createdAt: mem.createdAt || mem.created_at || null,
        updatedAt: mem.updatedAt || mem.updated_at || null
    };
}

function normalizeTree(tree) {
    if (!tree) return null;

    // Transitional fallback block:
    // Accept legacy snake_case fields during migration.
    // New code and server responses must prefer flat camelCase only.
    return {
        id: tree.id,
        userId: tree.userId || tree.user_id || null,
        title: tree.title || '나의 러브트리',
        visibility: tree.visibility || 'private',
        createdAt: tree.createdAt || tree.created_at || null,
        updatedAt: tree.updatedAt || tree.updated_at || null,
        memoryCount: tree.memoryCount || tree.memory_count || 0,
        isArchived: tree.isArchived || tree.is_archived || false
    };
}

// Test cases
console.log('Running API Contract Transitional Tests...\n');

// 1. Standard flat camelCase (target contract)
console.log('1. Testing standard flat camelCase (target contract)...');
const standardMemory = {
    id: 'mem_123',
    treeId: 'tree_456',
    parentId: 'mem_parent',
    title: 'Test Memory',
    sourceUrl: 'https://youtube.com/watch?v=abc123',
    sourceType: 'youtube',
    emotionTags: ['happy', 'joy'],
    createdAt: '2024-01-01T00:00:00Z',
    updatedAt: '2024-01-02T00:00:00Z'
};

const normalizedStandard = normalizeMemory(standardMemory);
assert.strictEqual(normalizedStandard.treeId, 'tree_456', 'flat camelCase treeId should pass');
assert.strictEqual(normalizedStandard.parentId, 'mem_parent', 'flat camelCase parentId should pass');
assert.deepStrictEqual(normalizedStandard.emotionTags, ['happy', 'joy'], 'flat camelCase emotionTags should pass');
console.log('   ✓ flat camelCase responses pass correctly\n');

// 2. Legacy snake_case (transitional compatibility)
console.log('2. Testing legacy snake_case (transitional compatibility)...');
const legacySnakeMemory = {
    id: 'mem_123',
    tree_id: 'tree_456',
    parent_id: 'mem_parent',
    title: 'Test Memory',
    source_url: 'https://youtube.com/watch?v=abc123',
    source_type: 'youtube',
    emotion_tags: ['happy', 'joy'],
    created_at: '2024-01-01T00:00:00Z',
    updated_at: '2024-01-02T00:00:00Z'
};

const normalizedLegacy = normalizeMemory(legacySnakeMemory);
assert.strictEqual(normalizedLegacy.treeId, 'tree_456', 'snake_case tree_id should be normalized to treeId');
assert.strictEqual(normalizedLegacy.parentId, 'mem_parent', 'snake_case parent_id should be normalized to parentId');
assert.deepStrictEqual(normalizedLegacy.emotionTags, ['happy', 'joy'], 'snake_case emotion_tags should be normalized to emotionTags');
console.log('   ✓ snake_case responses pass via transitional fallback (to be removed after migration)\n');

// 3. Legacy {id, data} wrapper (transitional compatibility)
console.log('3. Testing legacy {id, data} wrapper (postgres-client pattern)...');
const wrappedTree = {
    id: 'tree_123',
    data: {
        title: 'Wrapped Tree',
        visibility: 'public',
        created_at: '2024-01-01T00:00:00Z'
    }
};

// Simulate the extraction pattern in postgres-client.js
const extractTree = (tree) => tree?.data || tree || {};
const extracted = extractTree(wrappedTree);
const normalizedWrapped = normalizeTree(extracted);
assert.strictEqual(normalizedWrapped.title, 'Wrapped Tree', '{id,data} wrapper extraction should work');
assert.strictEqual(normalizedWrapped.visibility, 'public', '{id,data} wrapper extraction should work');
console.log('   ✓ {id, data} wrapper extraction passes (to be removed after migration)\n');

// 4. Mixed case (edge case - should prefer camelCase)
console.log('4. Testing mixed camelCase + snake_case (edge case)...');
const mixedMemory = {
    id: 'mem_123',
    treeId: 'tree_camel',
    tree_id: 'tree_snake',
    emotionTags: ['camel'],
    emotion_tags: ['snake']
};

const normalizedMixed = normalizeMemory(mixedMemory);
assert.strictEqual(normalizedMixed.treeId, 'tree_camel', 'camelCase should be preferred over snake_case');
assert.deepStrictEqual(normalizedMixed.emotionTags, ['camel'], 'camelCase emotionTags should be preferred');
console.log('   ✓ camelCase is preferred when both forms present\n');

console.log('========================================');
console.log('All transitional compatibility tests passed!');
console.log('');
console.log('Note: Legacy (snake_case, {id,data}) tests are transitional.');
console.log('Remove these test cases after API migration to flat camelCase only.');
console.log('========================================');
