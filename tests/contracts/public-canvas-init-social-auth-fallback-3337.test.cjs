'use strict';

const { describe, it } = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const ROOT = path.resolve(__dirname, '../..');
const INIT_PATH = path.join(ROOT, 'js/viewer/public-canvas-init.js');
const ENTRY_PATH = path.join(ROOT, 'js/viewer/public-viewer-canvas-entry.js');
const AUTH_POLICY_PATH = path.join(ROOT, 'js/api/auth-policy.js');

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function readSrc(relPath) {
    const fullPath = path.resolve(ROOT, relPath);
    return fs.readFileSync(fullPath, 'utf-8');
}

// ---------------------------------------------------------------------------
// 1. No hardcoded false fallback
// ---------------------------------------------------------------------------

describe('1. public-canvas-init.js auth fallback', () => {
    it('does not hardcode hasConfirmedAuthSession to always-false', () => {
        const src = readSrc('js/viewer/public-canvas-init.js');
        // The old pattern was: hasConfirmedAuthSession: function() { return false; }
        // The new pattern delegates to authPolicy with a still-safe fallback-to-false
        // We must NOT find the ALWAYS-false static assignment
        const lines = src.split('\n');
        for (let i = 0; i < lines.length; i++) {
            const line = lines[i];
            if (line.includes('hasConfirmedAuthSession') && !line.includes('authPolicy')) {
                const isHardcodedFalse = /hasConfirmedAuthSession\s*:\s*function\s*\(\s*\)\s*\{\s*return\s*false/.test(line);
                assert.ok(!isHardcodedFalse,
                    'Line ' + (i + 1) + ' hardcodes hasConfirmedAuthSession to always-false: ' + line.trim());
            }
        }
    });
});

// ---------------------------------------------------------------------------
// 2. Delegates to real auth policy
// ---------------------------------------------------------------------------

describe('2. Delegation to real auth policy', () => {
    it('public-canvas-init.js reads LoveTreeAuthPolicy', () => {
        const src = readSrc('js/viewer/public-canvas-init.js');
        assert.ok(src.includes('LoveTreeAuthPolicy'), 'Must reference LoveTreeAuthPolicy');
    });

    it('matches the same pattern as public-viewer-canvas-entry.js', () => {
        const initSrc = readSrc('js/viewer/public-canvas-init.js');
        const entrySrc = readSrc('js/viewer/public-viewer-canvas-entry.js');
        // Both should contain a pattern like: typeof authPolicy.hasConfirmedAuthSession === 'function'
        assert.ok(
            initSrc.includes("typeof authPolicy.hasConfirmedAuthSession === 'function'"),
            'public-canvas-init must use typeof check before calling hasConfirmedAuthSession'
        );
        assert.ok(
            entrySrc.includes("typeof authPolicy.hasConfirmedAuthSession === 'function'"),
            'public-viewer-canvas-entry must use typeof check before calling hasConfirmedAuthSession'
        );
    });

    it('auth-policy.js exports hasConfirmedAuthSession function', () => {
        const src = readSrc('js/api/auth-policy.js');
        assert.ok(src.includes('hasConfirmedAuthSession'), 'auth-policy.js must define hasConfirmedAuthSession');
    });
});

// ---------------------------------------------------------------------------
// 3. Guest path remains read-only
// ---------------------------------------------------------------------------

describe('3. Guest path read-only guard', () => {
    it('public-canvas-init.js fallback still returns false when authPolicy unavailable', () => {
        const src = readSrc('js/viewer/public-canvas-init.js');
        // The fallback when authPolicy is absent must still be false
        assert.ok(
            src.includes(': function() { return false; }'),
            'Must have a fallback-to-false when authPolicy or hasConfirmedAuthSession is absent'
        );
    });

    it('authenticated-like.js guards on hasConfirmedAuthSession before toggling', () => {
        const src = readSrc('js/viewer/public-viewer-authenticated-like.js');
        assert.ok(
            src.includes('showGuestMode') || src.includes('hasConfirmedAuthSession'),
            'authenticated-like must gate on auth state'
        );
    });
});

// ---------------------------------------------------------------------------
// 4. No tree-level social activation
// ---------------------------------------------------------------------------

describe('4. No tree-level social writer activation', () => {
    it('public-canvas-init.js does not import tree-level likes/comments API', () => {
        const src = readSrc('js/viewer/public-canvas-init.js');
        // Tree-level API functions should NOT be referenced in detail UI options
        const treeLevelPatterns = [
            'likeTree',
            'unlikeTree',
            'fetchTreeLikes',
            'createTreeComment',
            'fetchTreeComments',
        ];
        for (const pattern of treeLevelPatterns) {
            assert.ok(!src.includes(pattern),
                'public-canvas-init.js must not reference tree-level social API: ' + pattern);
        }
    });

    it('public-canvas-init.js does not reference tree_likes table or migration', () => {
        const src = readSrc('js/viewer/public-canvas-init.js');
        assert.ok(!src.includes('tree_likes'), 'Must not reference tree_likes table');
        assert.ok(!src.includes('Migration B'), 'Must not reference Migration B');
        assert.ok(!src.includes('migration'), 'Must not reference migration in code');
    });
});

// ---------------------------------------------------------------------------
// 5. No Browse/My Trees/Scout scope change
// ---------------------------------------------------------------------------

describe('5. Scope isolation', () => {
    it('public-canvas-init.js does not change Browse or My Trees', () => {
        const src = readSrc('js/viewer/public-canvas-init.js');
        // navigation link to search/my-trees pages is allowed; browse-specific logic is not
        const browsePatterns = [
            'fetchLatestTrees', 'fetchPopularTrees',
            'renderCard', 'socialCount',
            'likeCount', 'commentCount',
            'fetchMyTrees', 'myTreeList', 'treeList',
        ];
        for (const p of browsePatterns) {
            assert.ok(!src.includes(p),
                'public-canvas-init.js must not contain Browse/My Trees specific code: "' + p + '"');
        }
    });

    it('public-canvas-init.js does not reference Scout', () => {
        const src = readSrc('js/viewer/public-canvas-init.js');
        assert.ok(!src.includes('Scout') && !src.includes('scout'), 'Must not reference Scout');
    });
});
