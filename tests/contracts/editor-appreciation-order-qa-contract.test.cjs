/**
 * Contract: LoveBud Appreciation Order Guide (#3061)
 * v20260702-qa-verification-1
 *
 * Refs:
 *   - #3061 (appreciation order contract definition)
 *   - #3054 (separation boundaries)
 *   - #1882 (product umbrella)
 */

'use strict';

const path = require('path');
const assert = require('node:assert/strict');
const { test } = require('node:test');

const ROOT = path.resolve(__dirname, '../..');

// ─── Paths ───────────────────────────────────────────────────────────────────

const VIEWER_HANDLER_FACTORY_PATH = path.join(
    ROOT,
    'js/viewer/viewer-handler-factory.js'
);

const EDITOR_CANVAS_PATH = path.join(
    ROOT,
    'js/editor/editor-canvas.js'
);

// ─── Helpers ───────────────────────────────────────────────────────────────────

function readSource(filePath) {
    const fs = require('fs');
    return fs.readFileSync(filePath, 'utf-8');
}

function hasSource(filePath) {
    const fs = require('fs');
    return fs.existsSync(filePath);
}

// ─── Suites ───────────────────────────────────────────────────────────────────

async function run() {
    console.log(
        '\n[editor-appreciation-order] Starting QA verification\n'
    );

    // 1. File existence
    await test('1. Viewer handler factory exists', function () {
        assert.ok(
            hasSource(VIEWER_HANDLER_FACTORY_PATH),
            'viewer-handler-factory.js must exist'
        );
    });

    await test('2. Editor canvas file exists', function () {
        assert.ok(
            hasSource(EDITOR_CANVAS_PATH),
            'editor-canvas.js must exist'
        );
    });

    // 2. Source code contains appreciationOrder logic
    await test('3. Viewer handler exports appreciation order highlight logic', function () {
        const src = readSource(VIEWER_HANDLER_FACTORY_PATH);
        assert.ok(
            src.includes('appreciationOrder'),
            'viewer-handler-factory must reference appreciationOrder'
        );
        assert.ok(
            src.includes('next-in-order'),
            'viewer-handler-factory must set next-in-order class'
        );
        assert.ok(
            src.includes('aria-label'),
            'viewer-handler-factory must set aria-label for accessibility'
        );
    });

    // 3. Editor canvas initializes appreciation order manager
    await test('4. Editor canvas initializes appreciation order manager', function () {
        const src = readSource(EDITOR_CANVAS_PATH);
        assert.ok(
            src.includes('appreciationOrderManager'),
            'editor-canvas must reference appreciationOrderManager'
        );
        assert.ok(
            src.includes('initAppreciationOrderManager'),
            'editor-canvas must call initAppreciationOrderManager'
        );
        assert.ok(
            src.includes('canEdit !== false'),
            'Only owner can edit appreciation order (canEdit guard)'
        );
    });

    // 4. Acceptance criteria: appreciation order must be array of IDs
    await test('5. Contract document defines data structure', function () {
        const contractPath = path.join(
            ROOT,
            'docs/product/lovebud-appreciation-order-contract.md'
        );
        assert.ok(
            hasSource(contractPath),
            'Contract document must exist'
        );
        const doc = readSource(contractPath);
        assert.ok(
            doc.includes('ordered_ids'),
            'Contract must define ordered_ids data structure'
        );
        assert.ok(
            doc.includes('시퀀스'),
            'Contract must define sequence over topology'
        );
    });

    console.log('\n──────────────────────────────────────────────────────');
    console.log('[editor-appreciation-order] QA verification complete');
}

run().catch(function (err) {
    console.error('QA verification error:', err);
    process.exit(1);
});