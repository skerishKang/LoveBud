/**
 * Contract test: My Trees normalizeTree preserves owner social counts
 *
 * Issue #3258 — [Data/UI][My Trees] Preserve owner tree social counts
 * through normalization.
 *
 * Validates that LoveBudNormalize.normalizeTree() explicitly preserves
 * likeCount and viewCount from owner-tree API responses, with correct
 * semantics for positive values, genuine zero, and absent fields.
 *
 * VM-sandbox pattern: loads the IIFE source into a Node vm context and
 * exercises the exported LoveBudNormalize global without a browser.
 */

const vm = require('vm');
const fs = require('fs');
const path = require('path');
const assert = require('node:assert/strict');
const { test } = require('node:test');

// ---------------------------------------------------------------------------
// Load the normalizer module into a VM sandbox
// ---------------------------------------------------------------------------

const NORMALIZER_PATH = path.join(__dirname, '..', '..', 'js', 'utils', 'normalize.js');

function loadNormalizer() {
    const source = fs.readFileSync(NORMALIZER_PATH, 'utf8');
    const sandbox = {
        console: console,
        window: {}
    };
    const context = vm.createContext(sandbox);
    vm.runInContext(source, context, { filename: 'normalize.js' });
    return sandbox.window.LoveBudNormalize;
}

// ---------------------------------------------------------------------------
// Helper: minimal valid tree object
// ---------------------------------------------------------------------------

function baseTree(overrides) {
    return Object.assign({ id: 't1', title: 'Test' }, overrides);
}

// ===========================================================================
// Contract: likeCount preservation
// ===========================================================================

test('normalizeTree preserves likeCount — positive integer', () => {
    const N = loadNormalizer();
    const out = N.normalizeTree(baseTree({ likeCount: 7 }));
    assert.ok(Object.prototype.hasOwnProperty.call(out, 'likeCount'),
        'likeCount key must exist when input provides it');
    assert.strictEqual(out.likeCount, 7);
});

test('normalizeTree preserves likeCount — genuine zero', () => {
    const N = loadNormalizer();
    const out = N.normalizeTree(baseTree({ likeCount: 0 }));
    assert.ok(Object.prototype.hasOwnProperty.call(out, 'likeCount'),
        'likeCount key must exist when input provides 0');
    assert.strictEqual(out.likeCount, 0);
});

test('normalizeTree omits likeCount when absent from input', () => {
    const N = loadNormalizer();
    const out = N.normalizeTree(baseTree({}));
    assert.ok(!Object.prototype.hasOwnProperty.call(out, 'likeCount'),
        'likeCount key must be absent when input has no likeCount');
});

// ===========================================================================
// Contract: viewCount preservation
// ===========================================================================

test('normalizeTree preserves viewCount — positive integer', () => {
    const N = loadNormalizer();
    const out = N.normalizeTree(baseTree({ viewCount: 3 }));
    assert.ok(Object.prototype.hasOwnProperty.call(out, 'viewCount'),
        'viewCount key must exist when input provides it');
    assert.strictEqual(out.viewCount, 3);
});

test('normalizeTree preserves viewCount — genuine zero', () => {
    const N = loadNormalizer();
    const out = N.normalizeTree(baseTree({ viewCount: 0 }));
    assert.ok(Object.prototype.hasOwnProperty.call(out, 'viewCount'),
        'viewCount key must exist when input provides 0');
    assert.strictEqual(out.viewCount, 0);
});

test('normalizeTree omits viewCount when absent from input', () => {
    const N = loadNormalizer();
    const out = N.normalizeTree(baseTree({}));
    assert.ok(!Object.prototype.hasOwnProperty.call(out, 'viewCount'),
        'viewCount key must be absent when input has no viewCount');
});

// ===========================================================================
// Contract: non-negative integer constraint
// ===========================================================================

test('normalizeTree rejects negative likeCount', () => {
    const N = loadNormalizer();
    const out = N.normalizeTree(baseTree({ likeCount: -5 }));
    assert.ok(!Object.prototype.hasOwnProperty.call(out, 'likeCount'),
        'negative likeCount must be rejected (absent from output)');
});

test('normalizeTree rejects negative viewCount', () => {
    const N = loadNormalizer();
    const out = N.normalizeTree(baseTree({ viewCount: -1 }));
    assert.ok(!Object.prototype.hasOwnProperty.call(out, 'viewCount'),
        'negative viewCount must be rejected (absent from output)');
});

test('normalizeTree rejects fractional likeCount', () => {
    const N = loadNormalizer();
    const out = N.normalizeTree(baseTree({ likeCount: 3.14 }));
    assert.ok(!Object.prototype.hasOwnProperty.call(out, 'likeCount'),
        'fractional likeCount must be rejected');
});

test('normalizeTree rejects NaN viewCount', () => {
    const N = loadNormalizer();
    const out = N.normalizeTree(baseTree({ viewCount: NaN }));
    assert.ok(!Object.prototype.hasOwnProperty.call(out, 'viewCount'),
        'NaN viewCount must be rejected');
});

test('normalizeTree rejects Infinity likeCount', () => {
    const N = loadNormalizer();
    const out = N.normalizeTree(baseTree({ likeCount: Infinity }));
    assert.ok(!Object.prototype.hasOwnProperty.call(out, 'likeCount'),
        'Infinity likeCount must be rejected');
});

test('normalizeTree rejects non-numeric types — string "abc"', () => {
    const N = loadNormalizer();
    const out = N.normalizeTree(baseTree({ likeCount: 'abc', viewCount: 'abc' }));
    assert.ok(!Object.prototype.hasOwnProperty.call(out, 'likeCount'));
    assert.ok(!Object.prototype.hasOwnProperty.call(out, 'viewCount'));
});

test('normalizeTree rejects boolean true', () => {
    const N = loadNormalizer();
    const out = N.normalizeTree(baseTree({ likeCount: true }));
    assert.ok(!Object.prototype.hasOwnProperty.call(out, 'likeCount'));
});

test('normalizeTree rejects null social count', () => {
    const N = loadNormalizer();
    const out = N.normalizeTree(baseTree({ likeCount: null, viewCount: null }));
    assert.ok(!Object.prototype.hasOwnProperty.call(out, 'likeCount'));
    assert.ok(!Object.prototype.hasOwnProperty.call(out, 'viewCount'));
});

// ===========================================================================
// Contract: valid string representation accepted
// ===========================================================================

test('normalizeTree accepts numeric string "42" for viewCount', () => {
    const N = loadNormalizer();
    const out = N.normalizeTree(baseTree({ viewCount: '42' }));
    assert.strictEqual(out.viewCount, 42);
});

test('normalizeTree accepts numeric string "0" for likeCount', () => {
    const N = loadNormalizer();
    const out = N.normalizeTree(baseTree({ likeCount: '0' }));
    assert.strictEqual(out.likeCount, 0);
});

test('normalizeTree rejects string with leading zero "01"', () => {
    const N = loadNormalizer();
    const out = N.normalizeTree(baseTree({ likeCount: '01' }));
    assert.ok(!Object.prototype.hasOwnProperty.call(out, 'likeCount'));
});

test('normalizeTree rejects string with plus sign "+3"', () => {
    const N = loadNormalizer();
    const out = N.normalizeTree(baseTree({ viewCount: '+3' }));
    assert.ok(!Object.prototype.hasOwnProperty.call(out, 'viewCount'));
});

test('normalizeTree rejects string with decimal "3.5"', () => {
    const N = loadNormalizer();
    const out = N.normalizeTree(baseTree({ likeCount: '3.5' }));
    assert.ok(!Object.prototype.hasOwnProperty.call(out, 'likeCount'));
});

// ===========================================================================
// Contract: no commentCount or shareCount introduced
// ===========================================================================

test('normalizeTree does not introduce commentCount', () => {
    const N = loadNormalizer();
    const out = N.normalizeTree(baseTree({ likeCount: 5, viewCount: 10 }));
    assert.ok(!Object.prototype.hasOwnProperty.call(out, 'commentCount'),
        'commentCount must never appear in normalized output');
});

test('normalizeTree does not introduce shareCount', () => {
    const N = loadNormalizer();
    const out = N.normalizeTree(baseTree({ likeCount: 5, viewCount: 10 }));
    assert.ok(!Object.prototype.hasOwnProperty.call(out, 'shareCount'),
        'shareCount must never appear in normalized output');
});

// ===========================================================================
// Contract: both fields work simultaneously
// ===========================================================================

test('normalizeTree preserves both likeCount and viewCount together', () => {
    const N = loadNormalizer();
    const out = N.normalizeTree(baseTree({ likeCount: 5, viewCount: 3 }));
    assert.strictEqual(out.likeCount, 5);
    assert.strictEqual(out.viewCount, 3);
});

test('normalizeTree preserves likeCount but omits absent viewCount', () => {
    const N = loadNormalizer();
    const out = N.normalizeTree(baseTree({ likeCount: 2 }));
    assert.strictEqual(out.likeCount, 2);
    assert.ok(!Object.prototype.hasOwnProperty.call(out, 'viewCount'));
});

test('normalizeTree preserves viewCount but omits absent likeCount', () => {
    const N = loadNormalizer();
    const out = N.normalizeTree(baseTree({ viewCount: 8 }));
    assert.strictEqual(out.viewCount, 8);
    assert.ok(!Object.prototype.hasOwnProperty.call(out, 'likeCount'));
});

// ===========================================================================
// Contract: other normalization behavior unchanged
// ===========================================================================

test('normalizeTree still normalizes other fields correctly with social counts', () => {
    const N = loadNormalizer();
    const out = N.normalizeTree({
        id: 'tree-abc',
        ownerId: 'user-1',
        title: 'My Tree',
        visibility: 'public',
        groupName: '  K-pop  ',
        keywords: ['love', '  ', 'music'],
        memoryCount: 10,
        isArchived: true,
        likeCount: 42,
        viewCount: 100
    });
    assert.strictEqual(out.id, 'tree-abc');
    assert.strictEqual(out.ownerId, 'user-1');
    assert.strictEqual(out.title, 'My Tree');
    assert.strictEqual(out.visibility, 'public');
    assert.strictEqual(out.groupName, 'K-pop');
    assert.deepEqual(out.keywords, ['love', 'music']);
    assert.strictEqual(out.memoryCount, 10);
    assert.strictEqual(out.isArchived, true);
    assert.strictEqual(out.likeCount, 42);
    assert.strictEqual(out.viewCount, 100);
});

// ===========================================================================
// Contract: normalizeTreeList preserves social counts and list semantics
// ===========================================================================

test('normalizeTreeList preserves likeCount: 5, viewCount: 3 in list item', () => {
    const N = loadNormalizer();
    const trees = [
        baseTree({ id: 'a', likeCount: 5, viewCount: 3 })
    ];
    const out = N.normalizeTreeList(trees);
    assert.strictEqual(out.length, 1);
    assert.strictEqual(out[0].likeCount, 5);
    assert.strictEqual(out[0].viewCount, 3);
});

test('normalizeTreeList preserves genuine zero likeCount and viewCount', () => {
    const N = loadNormalizer();
    const trees = [
        baseTree({ id: 'zero-tree', likeCount: 0, viewCount: 0 })
    ];
    const out = N.normalizeTreeList(trees);
    assert.strictEqual(out.length, 1);
    assert.ok(Object.prototype.hasOwnProperty.call(out[0], 'likeCount'),
        'likeCount key must exist for genuine zero');
    assert.ok(Object.prototype.hasOwnProperty.call(out[0], 'viewCount'),
        'viewCount key must exist for genuine zero');
    assert.strictEqual(out[0].likeCount, 0);
    assert.strictEqual(out[0].viewCount, 0);
});

test('normalizeTreeList omits absent likeCount and viewCount keys', () => {
    const N = loadNormalizer();
    const trees = [
        baseTree({ id: 'no-counts' })
    ];
    const out = N.normalizeTreeList(trees);
    assert.strictEqual(out.length, 1);
    assert.ok(!Object.prototype.hasOwnProperty.call(out[0], 'likeCount'));
    assert.ok(!Object.prototype.hasOwnProperty.call(out[0], 'viewCount'));
});

test('normalizeTreeList preserves list order and filters null entries', () => {
    const N = loadNormalizer();
    const trees = [
        baseTree({ id: 'first', likeCount: 1, viewCount: 10 }),
        null,
        baseTree({ id: 'third', likeCount: 2, viewCount: 20 })
    ];
    const out = N.normalizeTreeList(trees);
    assert.strictEqual(out.length, 2, 'null entries must be filtered');
    assert.strictEqual(out[0].id, 'first');
    assert.strictEqual(out[0].likeCount, 1);
    assert.strictEqual(out[0].viewCount, 10);
    assert.strictEqual(out[1].id, 'third');
    assert.strictEqual(out[1].likeCount, 2);
    assert.strictEqual(out[1].viewCount, 20);
});

test('normalizeTreeList does not introduce commentCount or shareCount', () => {
    const N = loadNormalizer();
    const trees = [
        baseTree({ id: 'a', likeCount: 5, viewCount: 3 }),
        baseTree({ id: 'b', likeCount: 0, viewCount: 0 }),
        baseTree({ id: 'c' })
    ];
    const out = N.normalizeTreeList(trees);
    out.forEach(function (item, i) {
        assert.ok(!Object.prototype.hasOwnProperty.call(item, 'commentCount'),
            'item[' + i + '] must not have commentCount');
        assert.ok(!Object.prototype.hasOwnProperty.call(item, 'shareCount'),
            'item[' + i + '] must not have shareCount');
    });
});

test('normalizeTreeList mixed social-count presence across items', () => {
    const N = loadNormalizer();
    const trees = [
        baseTree({ id: 'has-both', likeCount: 7, viewCount: 12 }),
        baseTree({ id: 'has-like-only', likeCount: 3 }),
        baseTree({ id: 'has-view-only', viewCount: 8 }),
        baseTree({ id: 'has-neither' })
    ];
    const out = N.normalizeTreeList(trees);
    assert.strictEqual(out.length, 4);
    // has-both
    assert.strictEqual(out[0].likeCount, 7);
    assert.strictEqual(out[0].viewCount, 12);
    // has-like-only
    assert.strictEqual(out[1].likeCount, 3);
    assert.ok(!Object.prototype.hasOwnProperty.call(out[1], 'viewCount'));
    // has-view-only
    assert.ok(!Object.prototype.hasOwnProperty.call(out[2], 'likeCount'));
    assert.strictEqual(out[2].viewCount, 8);
    // has-neither
    assert.ok(!Object.prototype.hasOwnProperty.call(out[3], 'likeCount'));
    assert.ok(!Object.prototype.hasOwnProperty.call(out[3], 'viewCount'));
});
