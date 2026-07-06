/**
 * Contract: LoveBud Appreciation Order Guide (#3061)
 * v20260707-3278-runtime-recovery-1
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

const EDITOR_HTML_PATH = path.join(
    ROOT,
    'pages/editor.html'
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

    // 3. Editor canvas must not reference the orphan appreciation-order initializer
    await test('4. Editor canvas does not call missing appreciation order initializer', function () {
        const src = readSource(EDITOR_CANVAS_PATH);
        assert.doesNotMatch(
            src,
            /\binitAppreciationOrderManager\b/,
            'editor-canvas must not call the orphan appreciation-order initializer'
        );
        assert.doesNotMatch(
            src,
            /\bappreciationOrderManager\b/,
            'editor-canvas must not attach an appreciationOrderManager runtime without a provider'
        );
    });

    await test('5. No appreciation-order initializer provider is mounted by editor.html', function () {
        const html = readSource(EDITOR_HTML_PATH);
        assert.doesNotMatch(
            html,
            /appreciation-order/i,
            'editor.html must not claim to mount an appreciation-order initializer provider'
        );
    });

    await test('6. Repository contains no reachable appreciation-order initializer provider', function () {
        const editorCanvasSource = readSource(EDITOR_CANVAS_PATH);
        const editorHtmlSource = readSource(EDITOR_HTML_PATH);

        const reachableProviderSources = [
            editorCanvasSource,
            editorHtmlSource,
            readSource(VIEWER_HANDLER_FACTORY_PATH)
        ].join('\n');

        assert.doesNotMatch(
            reachableProviderSources,
            /\binitAppreciationOrderManager\b\s*[:=({]/,
            'no reachable editor runtime source defines initAppreciationOrderManager on current main'
        );
    });

    // 4. Acceptance criteria: appreciation order must be array of IDs
    await test('7. Contract document defines data structure', function () {
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
