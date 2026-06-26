'use strict';

/**
 * LoveBud Browse / My Trees — Structure Reconciliation Contract Test
 *
 * Phase 1 audit: locks the structure audit document existence, required
 * sections, reference keywords, shared structural invariants, and known
 * delta documentation.
 *
 * Phase 2 remains free to normalise results-head wrapper depth, container
 * geometry ownership, and hub rendering pattern.
 */

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.resolve(__dirname, '..', '..');

function read(file) {
    return fs.readFileSync(path.join(ROOT, file), 'utf8');
}

// ── 1) Audit document exists ─────────────────────────────────────────
test('Architecture audit document exists at expected path', () => {
    const stat = fs.statSync(path.join(ROOT, 'docs/engineering/BROWSE_MY_TREES_CANONICAL_STRUCTURE_AUDIT.md'));
    assert.ok(stat.isFile(), 'Audit document must exist');
    assert.ok(stat.size > 2000, 'Audit document must be substantial (>2000 bytes)');
});

// ── 2) Document contains all required sections ───────────────────────
test('Architecture audit document contains all required sections', () => {
    const doc = read('docs/engineering/BROWSE_MY_TREES_CANONICAL_STRUCTURE_AUDIT.md');

    const requiredSections = [
        'Purpose and scope',
        'Existing shared baseline',
        'Current structure map',
        'Duplication / divergence ledger',
        'Canonical target topology',
        'Allowed owner/public deltas',
        'Migration seams and proposed Phase 2 order',
        'Non-goals and regression risks',
        'Validation matrix',
    ];

    for (const section of requiredSections) {
        const escaped = section.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        const heading = new RegExp(`##\\s+(?:\\d+\\.\\s+)?${escaped}`, 'i');
        assert.match(doc, heading, `Document must contain section: "${section}"`);
    }
});

// ── 3) Document includes required Refs ───────────────────────────────
test('Architecture audit document includes required Refs lines', () => {
    const doc = read('docs/engineering/BROWSE_MY_TREES_CANONICAL_STRUCTURE_AUDIT.md');
    assert.match(doc, /Refs #2923/, 'Document must include Refs #2923');
    assert.match(doc, /Refs #2903/, 'Document must include Refs #2903');
    assert.match(doc, /Refs #1882/, 'Document must include Refs #1882');
});

test('Architecture audit document must not auto-close #1882', () => {
    const doc = read('docs/engineering/BROWSE_MY_TREES_CANONICAL_STRUCTURE_AUDIT.md');
    const forbidden = [/Closes #1882/i, /Fixes #1882/i, /Resolves #1882/i];
    for (const pattern of forbidden) {
        assert.ok(
            !pattern.test(doc),
            `Document must not contain closing pattern: ${pattern}`
        );
    }
});

// ── 4) Both pages retain shared calm shell classes ──────────────────
test('Both pages retain lovetree-calm-two-column-shell', () => {
    const searchHtml = read('pages/search.html');
    const myTreesHtml = read('pages/my-trees.html');
    assert.ok(searchHtml.includes('lovetree-calm-two-column-shell'), 'search.html must have lovetree-calm-two-column-shell');
    assert.ok(myTreesHtml.includes('lovetree-calm-two-column-shell'), 'my-trees.html must have lovetree-calm-two-column-shell');
});

test('Both pages retain lovetree-calm-main-column', () => {
    const searchHtml = read('pages/search.html');
    const myTreesHtml = read('pages/my-trees.html');
    assert.ok(searchHtml.includes('lovetree-calm-main-column'), 'search.html must have lovetree-calm-main-column');
    assert.ok(myTreesHtml.includes('lovetree-calm-main-column'), 'my-trees.html must have lovetree-calm-main-column');
});

test('Both pages retain lovetree-calm-right-rail', () => {
    const searchHtml = read('pages/search.html');
    const myTreesHtml = read('pages/my-trees.html');
    assert.ok(searchHtml.includes('lovetree-calm-right-rail'), 'search.html must have lovetree-calm-right-rail');
    assert.ok(myTreesHtml.includes('lovetree-calm-right-rail'), 'my-trees.html must have lovetree-calm-right-rail');
});

// ── 5) Both pages retain browse-curation-shell ──────────────────────
test('Both pages retain browse-curation-shell', () => {
    const searchHtml = read('pages/search.html');
    const myTreesHtml = read('pages/my-trees.html');
    assert.ok(searchHtml.includes('browse-curation-shell'), 'search.html must have browse-curation-shell for hero');
    assert.ok(myTreesHtml.includes('browse-curation-shell'), 'my-trees.html must have browse-curation-shell for hero');
});

// ── 6) Both pages retain search-panel-header ────────────────────────
test('Both pages retain search-panel-header', () => {
    const searchHtml = read('pages/search.html');
    const myTreesHtml = read('pages/my-trees.html');
    assert.ok(searchHtml.includes('search-panel-header'), 'search.html must have search-panel-header');
    assert.ok(myTreesHtml.includes('search-panel-header'), 'my-trees.html must have search-panel-header');
});

// ── 7) Both pages retain shared utility / results-head classes ───────
test('Both pages retain browse-utility-row + lovetree-calm-utility-row', () => {
    const searchHtml = read('pages/search.html');
    const myTreesHtml = read('pages/my-trees.html');
    assert.ok(searchHtml.includes('browse-utility-row'), 'search.html must have browse-utility-row');
    assert.ok(searchHtml.includes('lovetree-calm-utility-row'), 'search.html must have lovetree-calm-utility-row');
    assert.ok(myTreesHtml.includes('browse-utility-row'), 'my-trees.html must have browse-utility-row');
    assert.ok(myTreesHtml.includes('lovetree-calm-utility-row'), 'my-trees.html must have lovetree-calm-utility-row');
});

test('Both pages retain browse-results-head + lovetree-calm-results-head', () => {
    const searchHtml = read('pages/search.html');
    const myTreesHtml = read('pages/my-trees.html');
    assert.ok(searchHtml.includes('browse-results-head'), 'search.html must have browse-results-head');
    assert.ok(searchHtml.includes('lovetree-calm-results-head'), 'search.html must have lovetree-calm-results-head');
    assert.ok(myTreesHtml.includes('browse-results-head'), 'my-trees.html must have browse-results-head');
    assert.ok(myTreesHtml.includes('lovetree-calm-results-head'), 'my-trees.html must have lovetree-calm-results-head');
});

// ── 8) Both pages retain preview-hub class ───────────────────────────
test('Both pages retain preview-hub class', () => {
    const searchHtml = read('pages/search.html');
    const myTreesHtml = read('pages/my-trees.html');
    assert.match(searchHtml, /class="[^"]*preview-hub[^"]*"/, 'search.html aside must have preview-hub class');
    assert.match(myTreesHtml, /class="[^"]*preview-hub[^"]*"/, 'my-trees.html aside must have preview-hub class');
});

// ── 9) Allowed results-head deltas are documented ────────────────────
test('Browse results-head contains browseSortControls and browseViewModeMount', () => {
    const searchHtml = read('pages/search.html');
    assert.ok(searchHtml.includes('browseSortControls'), 'search.html must have browseSortControls');
    assert.ok(searchHtml.includes('browseViewModeMount'), 'search.html must have browseViewModeMount');
});

test('My Trees results-head contains headerCreateTreeBtn, sortTreesSelect, and myTreesViewModeMount', () => {
    const myTreesHtml = read('pages/my-trees.html');
    assert.ok(myTreesHtml.includes('headerCreateTreeBtn'), 'my-trees.html must have headerCreateTreeBtn');
    assert.ok(myTreesHtml.includes('sortTreesSelect'), 'my-trees.html must have sortTreesSelect');
    assert.ok(myTreesHtml.includes('myTreesViewModeMount'), 'my-trees.html must have myTreesViewModeMount');
});

// ── 10) Allowed hub rendering deltas are documented ──────────────────
test('Browse hub uses slot-based rendering (previewHubFlowSlot, previewHubSummarySlot, previewHubActionsSlot)', () => {
    const searchHtml = read('pages/search.html');
    assert.ok(searchHtml.includes('previewHubFlowSlot'), 'search.html must have previewHubFlowSlot');
    assert.ok(searchHtml.includes('previewHubSummarySlot'), 'search.html must have previewHubSummarySlot');
    assert.ok(searchHtml.includes('previewHubActionsSlot'), 'search.html must have previewHubActionsSlot');
});

test('My Trees hub uses static markup (myTreesHubFlow, myTreesHubSummary, myTreesHubActions)', () => {
    const myTreesHtml = read('pages/my-trees.html');
    assert.ok(myTreesHtml.includes('myTreesHubFlow'), 'my-trees.html must have myTreesHubFlow');
    assert.ok(myTreesHtml.includes('myTreesHubSummary'), 'my-trees.html must have myTreesHubSummary');
    assert.ok(myTreesHtml.includes('myTreesHubActions'), 'my-trees.html must have myTreesHubActions');
});

// ── 11) Both CSS entrypoints import shared preview-hub-scroll.css ────
test('search.css imports shared preview-hub-scroll.css', () => {
    const searchCss = read('css/search.css');
    assert.match(searchCss, /preview-hub-scroll\.css/, 'search.css must import preview-hub-scroll.css');
});

test('my-trees.css imports shared preview-hub-scroll.css', () => {
    const myTreesCss = read('css/my-trees.css');
    assert.match(myTreesCss, /preview-hub-scroll\.css/, 'my-trees.css must import preview-hub-scroll.css');
});

// ── 12) Results-head wrapper depth must NOT be locked as permanent ───
test('Document explicitly allows Phase 2 to normalise results-head topology', () => {
    const doc = read('docs/engineering/BROWSE_MY_TREES_CANONICAL_STRUCTURE_AUDIT.md');
    const allowsNormalise = /Phase 2 must remain free to normalize results-head topology/i.test(doc)
        || /Phase 2 should normalise/i.test(doc)
        || /normalis/i.test(doc);
    assert.ok(allowsNormalise, 'Document must acknowledge that results-head wrapper depth is not permanent architecture');
});

// ── 13) Audit document mentions key duplication topics ───────────────
test('Audit document mentions container geometry duplication', () => {
    const doc = read('docs/engineering/BROWSE_MY_TREES_CANONICAL_STRUCTURE_AUDIT.md');
    assert.match(doc, /container|geometry|search-container|my-trees-container/i,
        'Document must discuss container geometry duplication');
});

test('Audit document mentions results-head wrapper depth divergence', () => {
    const doc = read('docs/engineering/BROWSE_MY_TREES_CANONICAL_STRUCTURE_AUDIT.md');
    assert.match(doc, /results-head|wrapper.?depth|title-row/i,
        'Document must discuss results-head wrapper depth divergence');
});

test('Audit document mentions hub rendering pattern divergence (slot vs static)', () => {
    const doc = read('docs/engineering/BROWSE_MY_TREES_CANONICAL_STRUCTURE_AUDIT.md');
    assert.match(doc, /slot|static|injection|rendering pattern/i,
        'Document must discuss hub rendering pattern divergence');
});

test('Audit document mentions CSS ownership duplication', () => {
    const doc = read('docs/engineering/BROWSE_MY_TREES_CANONICAL_STRUCTURE_AUDIT.md');
    assert.match(doc, /CSS.*duplication|ownership|duplication.*CSS|preview-hub.*CSS/i,
        'Document must discuss CSS ownership duplication');
});
