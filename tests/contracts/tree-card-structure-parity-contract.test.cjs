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

// ── 1) Shared composition provides the card structure ────────────────
test('Shared composition uses tree-card-body (legacy) and love-tree-card-body', () => {
    assert.match(
        treeCardComposition,
        /tree-card-body/,
        'Shared composition must use tree-card-body class'
    );
    assert.match(
        treeCardComposition,
        /love-tree-card-body/,
        'Shared composition must use love-tree-card-body class'
    );
});

test('Shared composition places meta-row inside card body', () => {
    const bodyIdx = treeCardComposition.indexOf('love-tree-card-body');
    const metaRowIdx = treeCardComposition.indexOf('love-tree-card-meta-row');
    assert.ok(bodyIdx !== -1, 'love-tree-card-body must exist');
    assert.ok(metaRowIdx !== -1, 'love-tree-card-meta-row must exist');
    assert.ok(
        metaRowIdx > bodyIdx,
        'love-tree-card-meta-row must live inside love-tree-card-body'
    );
});

test('Shared composition uses tree-meta-left + tree-meta-right (legacy) and love-tree-card-meta-left/right', () => {
    assert.match(treeCardComposition, /tree-meta-left/);
    assert.match(treeCardComposition, /tree-meta-right/);
    assert.match(treeCardComposition, /love-tree-card-meta-left/);
    assert.match(treeCardComposition, /love-tree-card-meta-right/);
});

test('Shared composition uses tree-card-reaction-metrics wrapper at runtime (Browse parity)', () => {
    // tree-card-reaction-metrics is produced by tree-card-metrics.js at runtime,
    // not as a literal string in the composition source. Verify it's in the
    // metrics module which the composition requires.
    const metricsSrc = fs.readFileSync(
        path.join(ROOT, 'js/shared/tree-card-metrics.js'),
        'utf8'
    );
    assert.match(
        metricsSrc,
        /tree-card-reaction-metrics/,
        'Metrics module must produce the tree-card-reaction-metrics wrapper'
    );
    // Confirm the composition calls the metrics module
    assert.match(
        treeCardComposition,
        /renderTreeReactionMetrics/,
        'Shared composition must call metrics module'
    );
});

test('Browse renderer delegates to shared composition (no inline HTML templates)', () => {
    assert.match(searchCardRenderer, /comp\.buildTreeCard\(/,
        'Browse renderer must call shared composition');
    assert.match(searchCardRenderer, /requireComposition/,
        'Browse renderer must require composition (fail-closed)');
});

test('My Trees adapter delegates to shared composition', () => {
    assert.match(myTreesCardUi, /Composer\.buildTreeCard\(/,
        'My Trees adapter must call shared composition');
    assert.match(myTreesCardUi, /surface:\s*'my-trees'/,
        'My Trees adapter must set surface to my-trees');
});

// ── 2) Composition source has correct slot element classes ──────────
test('Shared composition creates .tree-card: root element', () => {
    assert.match(treeCardComposition, /tree-card/);
    assert.match(treeCardComposition, /love-tree-card/);
});

test('Shared composition creates .tree-title / .love-tree-card-title', () => {
    assert.match(treeCardComposition, /tree-title/);
    assert.match(treeCardComposition, /love-tree-card-title/);
});

test('Shared composition creates .tree-subtitle / .love-tree-card-subtitle', () => {
    assert.match(treeCardComposition, /tree-subtitle/);
    assert.match(treeCardComposition, /love-tree-card-subtitle/);
});

test('Shared composition creates .tree-card-open-link / .love-tree-card-open-link', () => {
    assert.match(treeCardComposition, /tree-card-open-link/);
    assert.match(treeCardComposition, /love-tree-card-open-link/);
});

test('Shared composition creates .tree-card-media / .love-tree-card-media', () => {
    assert.match(treeCardComposition, /tree-card-media/);
    assert.match(treeCardComposition, /love-tree-card-media/);
});

// ── 3) Legacy two-block split must not return on My Trees ────────────
test('My Trees adapter does NOT build legacy .tree-card-info or .tree-card-footer', () => {
    assert.equal(
        myTreesCardUi.indexOf('.tree-card-info'),
        -1,
        'Legacy .tree-card-info block must not appear — unified single-block'
    );
    assert.equal(
        myTreesCardUi.indexOf('.tree-card-footer'),
        -1,
        'Legacy .tree-card-footer block must not appear — unified single-block'
    );
});

// ── 4) Click-handler selector parity ─────────────────────────────────
test('My Trees click handler selector no longer references .tree-card-footer a', () => {
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
    assert.match(
        searchTreeCardCss,
        /\.tree-card-body\s*\{[^}]*grid-template-rows:\s*2\.98rem\s+2\.46rem\s+auto/s,
        'Browse .tree-card-body must use the locked grid row template'
    );
});

// ── 6) No border-top divider on a separate footer block ──────────────
test('My Trees cards.css does not style a separate .tree-card-footer block', () => {
    const rule = /\.tree-card-footer\s*\{[^}]*\}/;
    const match = myTreesCardsCss.match(rule);
    if (match) {
        assert.ok(
            !/border-top/.test(match[0]),
            '.tree-card-footer rule must not contain border-top (legacy separator)'
        );
    }
});

// ── 7) Browse no longer has inline legacy template (fail-closed) ─────
test('Browse renderer has no legacy fallback HTML template', () => {
    // The old template started with '<div class="tree-card ${... }"'.
    // Now the template is gone and only shared composition is used.
    assert.equal(
        searchCardRenderer.indexOf('tree-card-featured'),
        -1,
        'Browse renderer should not have inline legacy template classes'
    );
});
