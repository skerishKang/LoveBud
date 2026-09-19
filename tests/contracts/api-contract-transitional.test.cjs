'use strict';

/**
 * API Contract Transitional Compatibility Tests
 *
 * Purpose:
 * - Verify that canonical flat camelCase responses normalize to the canonical shape.
 * - Verify that legacy snake_case inputs are still accepted during migration and
 *   converge to the SAME canonical output (transitional compatibility only).
 *
 * Target:
 * - js/utils/normalize.js, executed as the real production authority through the
 *   repository's existing node:vm browser-IIFE loader pattern.
 *
 * Out of scope:
 * - The legacy `{ id, data }` response wrapper. Wrapper extraction is owned by the
 *   response-adapter boundary (js/postgres-client.js), not by js/utils/normalize.js,
 *   so it is deliberately not asserted here.
 *
 * Removal trigger:
 * - When /community/trees, /community/memories return flat camelCase only.
 * - The snake_case convergence cases can then be removed; the camelCase cases stay.
 */

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const NORMALIZER_PATH = path.join(__dirname, '..', '..', 'js', 'utils', 'normalize.js');

// js/utils/normalize.js is a browser-style IIFE that assigns global.LoveBudNormalize.
// Load it with the same vm pattern used by the other executing normalize contracts.
function loadNormalizer() {
    const source = fs.readFileSync(NORMALIZER_PATH, 'utf8');
    const sandbox = { console: console, window: {} };
    const context = vm.createContext(sandbox);
    vm.runInContext(source, context, { filename: 'normalize.js' });
    return sandbox.window.LoveBudNormalize;
}

// The IIFE executes inside a vm realm, so the objects and arrays it returns do not
// share the host realm's prototypes, and a strict deep comparison against a host
// fixture would fail on prototype identity alone. Round-trip the vm result into the
// host realm first. Every fixture field below holds a defined JSON-safe value, so
// the round-trip is lossless for these shapes.
function toHostShape(value) {
    return JSON.parse(JSON.stringify(value));
}

const normalize = loadNormalizer();

// Every field carries a truthy canonical value, so a correct camelCase passthrough
// returns this object unchanged.
const CANONICAL_MEMORY = {
    id: 'mem_123',
    treeId: 'tree_456',
    parentId: 'mem_parent',
    title: 'Test Memory',
    memo: 'Memo text',
    quote: 'Quote text',
    timestamp: '00:01:02',
    thumbnail: 'https://img.example/thumb.jpg',
    visibility: 'public',
    artist: 'Test Artist',
    source: 'youtube',
    sourceUrl: 'https://youtube.com/watch?v=abc123',
    sourceType: 'youtube',
    emotionTags: ['happy', 'joy'],
    channelId: 'chan_1',
    channelName: 'Test Channel',
    channelUrl: 'https://youtube.com/@testchannel',
    createdAt: '2024-01-01T00:00:00Z',
    updatedAt: '2024-01-02T00:00:00Z',
    delay: 120,
    x: 0.5,
    y: 0.25
};

// The same logical memory expressed with legacy snake_case keys. `memo` is supplied
// through its `description` alias to exercise that fallback too.
const LEGACY_SNAKE_MEMORY = {
    id: 'mem_123',
    tree_id: 'tree_456',
    parent_id: 'mem_parent',
    title: 'Test Memory',
    description: 'Memo text',
    quote: 'Quote text',
    timestamp: '00:01:02',
    thumbnail: 'https://img.example/thumb.jpg',
    visibility: 'public',
    artist: 'Test Artist',
    source: 'youtube',
    source_url: 'https://youtube.com/watch?v=abc123',
    source_type: 'youtube',
    emotion_tags: ['happy', 'joy'],
    channel_id: 'chan_1',
    channel_name: 'Test Channel',
    channel_url: 'https://youtube.com/@testchannel',
    created_at: '2024-01-01T00:00:00Z',
    updated_at: '2024-01-02T00:00:00Z',
    delay: 120,
    x: 0.5,
    y: 0.25
};

const CANONICAL_TREE = {
    id: 'tree_456',
    ownerId: 'user_1',
    title: 'Test Tree',
    visibility: 'public',
    groupName: 'Family',
    keywords: ['alpha', 'beta'],
    createdAt: '2024-01-01T00:00:00Z',
    updatedAt: '2024-01-02T00:00:00Z',
    memoryCount: 3,
    isArchived: true
};

const LEGACY_SNAKE_TREE = {
    id: 'tree_456',
    owner_id: 'user_1',
    title: 'Test Tree',
    visibility: 'public',
    group_name: 'Family',
    keywords: ['alpha', 'beta'],
    created_at: '2024-01-01T00:00:00Z',
    updated_at: '2024-01-02T00:00:00Z',
    memory_count: 3,
    is_archived: true
};

test('exposes the canonical normalization contract', () => {
    assert.ok(normalize, 'js/utils/normalize.js must expose global.LoveBudNormalize');
    for (const name of [
        'normalizeMemory',
        'normalizeMemoryList',
        'normalizeTree',
        'normalizeTreeList',
        'normalizeEmotionTags'
    ]) {
        assert.equal(typeof normalize[name], 'function', name + ' must be a function');
    }
});

test('canonical camelCase memory input passes through unchanged', () => {
    assert.deepStrictEqual(toHostShape(normalize.normalizeMemory(CANONICAL_MEMORY)), CANONICAL_MEMORY);
});

test('legacy snake_case memory input converges to the same canonical shape', () => {
    const legacy = normalize.normalizeMemory(LEGACY_SNAKE_MEMORY);

    assert.deepStrictEqual(
        toHostShape(legacy),
        toHostShape(normalize.normalizeMemory(CANONICAL_MEMORY)),
        'snake_case input must converge to the canonical camelCase output'
    );
    assert.strictEqual(legacy.treeId, 'tree_456', 'snake_case tree_id must normalize to treeId');
    assert.strictEqual(legacy.parentId, 'mem_parent', 'snake_case parent_id must normalize to parentId');
    assert.strictEqual(legacy.memo, 'Memo text', 'snake_case description must normalize to memo');
    assert.strictEqual(legacy.sourceUrl, 'https://youtube.com/watch?v=abc123');
    assert.strictEqual(legacy.sourceType, 'youtube');
    assert.deepStrictEqual(toHostShape(legacy.emotionTags), ['happy', 'joy']);
    assert.strictEqual(legacy.channelId, 'chan_1');
    assert.strictEqual(legacy.channelName, 'Test Channel');
    assert.strictEqual(legacy.channelUrl, 'https://youtube.com/@testchannel');
    assert.strictEqual(legacy.createdAt, '2024-01-01T00:00:00Z');
    assert.strictEqual(legacy.updatedAt, '2024-01-02T00:00:00Z');
});

test('camelCase is preferred when both forms are present', () => {
    const mixed = normalize.normalizeMemory({
        id: 'mem_123',
        treeId: 'tree_camel',
        tree_id: 'tree_snake',
        parentId: 'parent_camel',
        parent_id: 'parent_snake',
        sourceUrl: 'https://camel.example/watch',
        source_url: 'https://snake.example/watch',
        sourceType: 'camel-type',
        source_type: 'snake-type',
        emotionTags: ['camel'],
        emotion_tags: ['snake']
    });

    assert.strictEqual(mixed.treeId, 'tree_camel', 'camelCase treeId must win');
    assert.strictEqual(mixed.parentId, 'parent_camel', 'camelCase parentId must win');
    assert.strictEqual(mixed.sourceUrl, 'https://camel.example/watch');
    assert.strictEqual(mixed.sourceType, 'camel-type');
    assert.deepStrictEqual(toHostShape(mixed.emotionTags), ['camel']);
});

test('an explicit null canonical parentId still falls back to snake_case parent_id', () => {
    // parentId uses nullish coalescing, so an explicit null is treated as absent.
    const out = normalize.normalizeMemory({ id: 'mem_1', parentId: null, parent_id: 'mem_parent' });
    assert.strictEqual(out.parentId, 'mem_parent');
});

test('absent optional memory fields fall back to the documented defaults', () => {
    const out = normalize.normalizeMemory({ id: 'mem_bare' });

    assert.strictEqual(out.id, 'mem_bare');
    assert.strictEqual(out.treeId, null);
    assert.strictEqual(out.parentId, null);
    assert.strictEqual(out.title, '');
    assert.strictEqual(out.memo, '');
    assert.strictEqual(out.quote, '');
    assert.strictEqual(out.timestamp, '');
    assert.strictEqual(out.thumbnail, '');
    assert.strictEqual(out.visibility, 'private');
    assert.strictEqual(out.artist, '');
    assert.strictEqual(out.source, '');
    assert.strictEqual(out.sourceUrl, '');
    assert.strictEqual(out.sourceType, 'youtube');
    assert.deepStrictEqual(toHostShape(out.emotionTags), []);
    assert.strictEqual(out.channelId, null);
    assert.strictEqual(out.channelName, null);
    assert.strictEqual(out.channelUrl, null);
    assert.strictEqual(out.createdAt, null);
    assert.strictEqual(out.updatedAt, null);
});

test('falsy input normalizes to null on both axes', () => {
    assert.strictEqual(normalize.normalizeMemory(null), null);
    assert.strictEqual(normalize.normalizeMemory(undefined), null);
    assert.strictEqual(normalize.normalizeTree(null), null);
    assert.strictEqual(normalize.normalizeTree(undefined), null);
});

test('canonical camelCase tree input normalizes to the canonical shape', () => {
    assert.deepStrictEqual(toHostShape(normalize.normalizeTree(CANONICAL_TREE)), {
        id: 'tree_456',
        ownerId: 'user_1',
        userId: 'user_1',
        title: 'Test Tree',
        visibility: 'public',
        groupName: 'Family',
        keywords: ['alpha', 'beta'],
        createdAt: '2024-01-01T00:00:00Z',
        updatedAt: '2024-01-02T00:00:00Z',
        memoryCount: 3,
        isArchived: true
    });
});

test('legacy snake_case tree input converges to the same canonical shape', () => {
    const legacy = normalize.normalizeTree(LEGACY_SNAKE_TREE);

    assert.deepStrictEqual(
        toHostShape(legacy),
        toHostShape(normalize.normalizeTree(CANONICAL_TREE)),
        'snake_case tree input must converge to the canonical camelCase output'
    );
    assert.strictEqual(legacy.ownerId, 'user_1');
    assert.strictEqual(legacy.userId, 'user_1', 'the resolved owner identity must be exposed on both aliases');
    assert.strictEqual(legacy.groupName, 'Family');
    assert.strictEqual(legacy.memoryCount, 3);
    assert.strictEqual(legacy.isArchived, true);
});

test('owner identity resolves from ownerId / owner_id / userId / user_id in order', () => {
    const viaCamelUserId = normalize.normalizeTree({ id: 't', userId: 'user_camel' });
    assert.strictEqual(viaCamelUserId.ownerId, 'user_camel');
    assert.strictEqual(viaCamelUserId.userId, 'user_camel');

    const viaSnakeUserId = normalize.normalizeTree({ id: 't', user_id: 'user_snake' });
    assert.strictEqual(viaSnakeUserId.ownerId, 'user_snake');
    assert.strictEqual(viaSnakeUserId.userId, 'user_snake');

    const precedence = normalize.normalizeTree({ id: 't', owner_id: 'owner_snake', user_id: 'user_snake' });
    assert.strictEqual(precedence.ownerId, 'owner_snake', 'owner_id must take precedence over user_id');
});

test('absent optional tree fields fall back to the documented defaults', () => {
    const out = normalize.normalizeTree({ id: 'tree_bare' });

    assert.strictEqual(out.ownerId, null);
    assert.strictEqual(out.userId, null);
    assert.strictEqual(out.title, '나의 러브트리');
    assert.strictEqual(out.visibility, 'private');
    assert.strictEqual(out.groupName, null);
    assert.deepStrictEqual(toHostShape(out.keywords), []);
    assert.strictEqual(out.createdAt, null);
    assert.strictEqual(out.updatedAt, null);
    assert.strictEqual(out.memoryCount, 0);
    assert.strictEqual(out.isArchived, false);
    assert.ok(!('likeCount' in out), 'an absent likeCount must stay omitted');
    assert.ok(!('viewCount' in out), 'an absent viewCount must stay omitted');
});

test('groupName is trimmed, blank-safe, and snake_case aware', () => {
    assert.strictEqual(normalize.normalizeTree({ id: 't', groupName: '  Family  ' }).groupName, 'Family');
    assert.strictEqual(normalize.normalizeTree({ id: 't', group_name: '  Family  ' }).groupName, 'Family');
    assert.strictEqual(normalize.normalizeTree({ id: 't', groupName: '   ' }).groupName, null);
    assert.strictEqual(
        normalize.normalizeTree({ id: 't', groupName: 5, group_name: 'Family' }).groupName,
        null,
        'an own non-string groupName wins over group_name and normalizes to null'
    );
});

test('list normalizers map entries and drop falsy ones', () => {
    const memories = normalize.normalizeMemoryList([CANONICAL_MEMORY, null, LEGACY_SNAKE_MEMORY]);
    assert.equal(memories.length, 2);
    assert.deepStrictEqual(toHostShape(memories[0]), CANONICAL_MEMORY);
    assert.deepStrictEqual(toHostShape(memories[1]), CANONICAL_MEMORY);

    const trees = normalize.normalizeTreeList([CANONICAL_TREE, null, LEGACY_SNAKE_TREE]);
    assert.equal(trees.length, 2);
    assert.deepStrictEqual(toHostShape(trees[0]), toHostShape(trees[1]));

    assert.deepStrictEqual(toHostShape(normalize.normalizeMemoryList(null)), []);
    assert.deepStrictEqual(toHostShape(normalize.normalizeTreeList('not-an-array')), []);
});

test('normalizeEmotionTags dedupes and drops empty values', () => {
    assert.deepStrictEqual(
        toHostShape(normalize.normalizeEmotionTags(['happy', 'happy', '', null, 'joy'])),
        ['happy', 'joy']
    );
    assert.deepStrictEqual(toHostShape(normalize.normalizeEmotionTags(null)), []);
});
