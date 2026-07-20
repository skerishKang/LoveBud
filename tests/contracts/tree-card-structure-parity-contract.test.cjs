/**
 * LoveBud Tree Card Structure Parity — Contract Test
 *
 * Locks the single-block card structure invariant between Browse and
 * My LoveTree after Step 3 follow-up:
 *
 *   - Both pages render a single tree-card-body container (no
 *     .tree-card-info + .tree-card-footer two-block split)
 *   - Both pages render tree-meta-row > (tree-meta-left with reaction
 *     metrics + tree-meta-right with open link)
 *   - Both pages use tree-card-reaction-metrics as the metric wrapper
 *   - The legacy .tree-card-footer border-top separator must not return
 *
 * Complements tree-view-mode-parity-contract.test.cjs (view-mode parity)
 * and browse-my-trees-pattern-alignment-contract.test.cjs (template order).
 */
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');

const ROOT = path.resolve(__dirname, '..', '..');

const searchCardRenderer = fs.readFileSync(
    path.join(ROOT, 'js/search/search-card-renderer.js'),
    'utf8'
);
const myTreesCardUi = fs.readFileSync(
    path.join(ROOT, 'js/my-trees/my-trees-ui.js'),
    'utf8'
);
const myTreesCardEvents = fs.readFileSync(
    path.join(ROOT, 'js/my-trees/my-trees-card-events.js'),
    'utf8'
);
const treeCardComposition = fs.readFileSync(
    path.join(ROOT, 'js/shared/tree-card-composition.js'),
    'utf8'
);
const myTreesCardsCss = fs.readFileSync(
    path.join(ROOT, 'css/my-trees/my-trees-cards.css'),
    'utf8'
);
const searchTreeCardCss = fs.readFileSync(
    path.join(ROOT, 'css/search/search-tree-card/content.css'),
    'utf8'
);

// ── 1) Browse renderer uses the single-block structure ───────────────
test('Browse renderer uses .tree-card-body (single block)', () => {
    assert.match(
        searchCardRenderer,
        /<div class="tree-card-body">/,
        'Browse card-renderer must use <div class="tree-card-body">'
    );
});

test('Browse renderer places meta-row inside tree-card-body', () => {
    const bodyIdx = searchCardRenderer.indexOf('<div class="tree-card-body">');
    const metaRowIdx = searchCardRenderer.indexOf('<div class="tree-meta-row">');
    assert.ok(bodyIdx !== -1, 'tree-card-body must exist');
    assert.ok(metaRowIdx !== -1, 'tree-meta-row must exist');
    assert.ok(
        metaRowIdx > bodyIdx,
        'tree-meta-row must live inside tree-card-body, not as a sibling'
    );
});

test('Browse renderer uses tree-meta-left + tree-meta-right', () => {
    assert.match(searchCardRenderer, /<div class="tree-meta-left">/);
    assert.match(searchCardRenderer, /<div class="tree-meta-right">/);
});

test('Browse renderer uses tree-card-reaction-metrics wrapper', () => {
    assert.match(
        searchCardRenderer,
        /<div class="tree-card-reaction-metrics"/,
        'Browse must wrap reaction metrics in <div class="tree-card-reaction-metrics">'
    );
});

// ── 2) Shared composition provides the card structure ────────────────
test('Shared composition uses .love-tree-card-body (Browse parity)', () => {
    assert.match(
        treeCardComposition,
        /love-tree-card-body/,
        'Shared composition must use love-tree-card-body class'
    );
});

test('Shared composition places meta-row inside love-tree-card-body', () => {
    const bodyIdx = treeCardComposition.indexOf('love-tree-card-body');
    const metaRowIdx = treeCardComposition.indexOf('love-tree-card-meta-row');
    assert.ok(bodyIdx !== -1, 'love-tree-card-body must exist');
    assert.ok(metaRowIdx !== -1, 'love-tree-card-meta-row must exist');
    assert.ok(
        metaRowIdx > bodyIdx,
        'love-tree-card-meta-row must live inside love-tree-card-body'
    );
});

test('Shared composition uses love-tree-card-meta-left + love-tree-card-meta-right (Browse parity)', () => {
    assert.match(treeCardComposition, /love-tree-card-meta-left/);
    assert.match(treeCardComposition, /love-tree-card-meta-right/);
});

test('Shared composition uses tree-card-reaction-metrics wrapper (Browse parity)', () => {
    assert.match(
        treeCardComposition,
        /tree-card-reaction-metrics/
    );
});

test('My Trees adapter delegates to shared composition', () => {
    assert.match(myTreesCardUi, /Composer\.buildTreeCard\(/,
        'My Trees adapter must call shared composition');
    assert.match(myTreesCardUi, /surface:\s*'my-trees'/,
        'My Trees adapter must set surface to my-trees');
});

// ── 3) Legacy two-block split must not return on My Trees ────────────
test('My Trees renderer does NOT use legacy .tree-card-info block', () => {
    const cardFnStart = myTreesCardUi.indexOf('function buildTreeCard');
    const cardFnSection = myTreesCardUi.slice(cardFnStart);
    const templateStart = cardFnSection.indexOf('card.innerHTML = [');
    const templateSection = cardFnSection.slice(templateStart);
    assert.equal(
        templateSection.indexOf('tree-card-info'),
        -1,
        'Legacy .tree-card-info block must not return — Step 3 unification locked single-block parity'
    );
});

test('My Trees renderer does NOT use legacy .tree-card-footer block', () => {
    const cardFnStart = myTreesCardUi.indexOf('function buildTreeCard');
    const cardFnSection = myTreesCardUi.slice(cardFnStart);
    const templateStart = cardFnSection.indexOf('card.innerHTML = [');
    const templateSection = cardFnSection.slice(templateStart);
    assert.equal(
        templateSection.indexOf('tree-card-footer'),
        -1,
        'Legacy .tree-card-footer block must not return — Step 3 unification locked single-block parity'
    );
});

// ── 4) Click-handler selector parity ─────────────────────────────────
test('My Trees click handler selector no longer references .tree-card-footer a', () => {
    // The legacy selector `.tree-card-footer a` only existed because the
    // footer was a separate DOM block. After unification the open link
    // lives inside tree-meta-row > tree-meta-right, and the generic
    // `a[href]` selector already covers it.
    assert.equal(
        myTreesCardUi.indexOf('.tree-card-footer'),
        -1,
        'My Trees renderer must not reference .tree-card-footer anywhere'
    );
    assert.equal(
        myTreesCardEvents.indexOf('.tree-card-footer'),
        -1,
        'My Trees card-events.js must not reference .tree-card-footer anywhere'
    );
});

// ── 5) CSS parity: meta-row + reaction-metric rules exist on My Trees ─
test('My Trees CSS defines .tree-meta-row (Browse parity)', () => {
    assert.match(myTreesCardsCss, /\.tree-meta-row\s*\{/);
});

test('My Trees CSS defines .tree-meta-left + .tree-meta-right', () => {
    assert.match(myTreesCardsCss, /\.tree-meta-left,\s*\.tree-meta-right\s*\{/);
    assert.match(myTreesCardsCss, /\.tree-meta-right\s*\{[^}]*justify-content:\s*flex-end/s);
});

test('My Trees CSS defines .tree-card-reaction-metrics + .tree-card-reaction-metric', () => {
    assert.match(myTreesCardsCss, /\.tree-card-reaction-metrics\s*\{/);
    assert.match(myTreesCardsCss, /\.tree-card-reaction-metric\s*\{/);
});

test('Browse content CSS uses the same grid-template-rows for tree-card-body', () => {
    // My Trees must mirror this grid layout for visual parity.
    assert.match(
        searchTreeCardCss,
        /\.tree-card-body\s*\{[^}]*grid-template-rows:\s*2\.98rem\s+2\.46rem\s+auto/s,
        'Browse .tree-card-body must use the locked grid row template'
    );
});

// ── 6) No border-top divider on a separate footer block ──────────────
test('My Trees cards.css does not style a separate .tree-card-footer block', () => {
    // After unification there is no .tree-card-footer block to style.
    // The legacy rule had border-top which created the visible two-block look.
    // A no-op empty rule is allowed (defensive — keeps stale DOM from breaking).
    const rule = /\.tree-card-footer\s*\{[^}]*\}/;
    const match = myTreesCardsCss.match(rule);
    if (match) {
        // Allowed only as a no-op empty rule (no border-top, no padding).
        assert.ok(
            !/border-top/.test(match[0]),
            '.tree-card-footer rule must not contain border-top (legacy separator)'
        );
        assert.ok(
            !/padding:\s*12px\s+18px/.test(match[0]),
            '.tree-card-footer rule must not contain the legacy heavier padding'
        );
    }
});
