/**
 * LoveBud Tree View Mode Parity — Contract Test
 *
 * Refs: Step 2 follow-up (after PR #2765)
 *
 * Locks the parity invariants between Browse (#resultsList) and
 * My LoveTree (.trees-grid) in `css/tree-view-mode.css`:
 *
 *   - per-mode grid gap values are token-driven (no hardcoded px literals
 *     that drift between pages)
 *   - mobile compact breakpoint is identical on both pages
 *   - list mode applies the same border-radius on the media container
 *     regardless of which inner class name (.tree-card-media vs
 *     .tree-card-thumb) each page uses
 *   - list mode applies the same body padding regardless of which inner
 *     class name (.tree-card-body vs .tree-card-info) each page uses
 *   - the dead token `--lovetree-card-media-height-mytrees` is not
 *     re-introduced in `css/global/tokens.css`
 */
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');

const ROOT = path.resolve(__dirname, '..', '..');

const viewModeCss = fs.readFileSync(
    path.join(ROOT, 'css/tree-view-mode.css'),
    'utf8'
);
const tokensCss = fs.readFileSync(
    path.join(ROOT, 'css/global/tokens.css'),
    'utf8'
);

// ── 1) Per-mode gap values are token-driven on both pages ────────────
test('Browse large mode gap uses --lovetree-card-grid-gap token', () => {
    const re = /#resultsList\[data-tree-view-mode="large"\][^{]*\{[^}]*gap:\s*var\(--lovetree-card-grid-gap\)/;
    assert.match(viewModeCss, re);
});

test('Browse compact mode gap uses --lovetree-card-grid-gap-compact token', () => {
    const re = /#resultsList\[data-tree-view-mode="compact"\][^{]*\{[^}]*gap:\s*var\(--lovetree-card-grid-gap-compact\)/;
    assert.match(viewModeCss, re);
});

test('My Trees large mode gap uses --lovetree-card-grid-gap token', () => {
    const re = /\.trees-grid\[data-tree-view-mode="large"\][^{]*\{[^}]*gap:\s*var\(--lovetree-card-grid-gap\)/;
    assert.match(viewModeCss, re);
});

test('My Trees compact mode gap uses --lovetree-card-grid-gap-compact token', () => {
    const re = /\.trees-grid\[data-tree-view-mode="compact"\][^{]*\{[^}]*gap:\s*var\(--lovetree-card-grid-gap-compact\)/;
    assert.match(viewModeCss, re);
});

test('No hardcoded 26px or 20px gap literals remain in view-mode CSS', () => {
    // Browse originally had `gap: 26px` (large) and `gap: 20px` (compact).
    // Both should now be token-driven. These px literals must not return.
    const largeLiteral = /\[data-tree-view-mode="large"\][^{]*\{[^}]*gap:\s*26px/;
    const compactLiteral = /\[data-tree-view-mode="compact"\][^{]*\{[^}]*gap:\s*20px/;
    assert.equal(
        largeLiteral.test(viewModeCss),
        false,
        'large mode must not hardcode gap: 26px'
    );
    assert.equal(
        compactLiteral.test(viewModeCss),
        false,
        'compact mode must not hardcode gap: 20px'
    );
});

// ── 2) Mobile compact breakpoint is identical on both pages ──────────
test('Browse compact 2-col breakpoint is ≤640px', () => {
    const re = /@media\s*\(max-width:\s*640px\)\s*\{[^}]*#resultsList\[data-tree-view-mode="compact"\][^{]*\{[^}]*grid-template-columns:\s*repeat\(2,/s;
    assert.match(viewModeCss, re);
});

test('My Trees compact 2-col breakpoint is ≤640px (parity with Browse)', () => {
    const re = /@media\s*\(max-width:\s*640px\)\s*\{[^}]*\.trees-grid\[data-tree-view-mode="compact"\][^{]*\{[^}]*grid-template-columns:\s*repeat\(2,/s;
    assert.match(viewModeCss, re);
});

test('No 900px compact breakpoint remains on My Trees', () => {
    // Old My Trees rule: @media (max-width: 900px) { .trees-grid[compact] → 2-col }
    // Was divergent from Browse (≤640). Re-introducing it would re-create the gap.
    assert.ok(
        !/@media\s*\(max-width:\s*900px\)/.test(viewModeCss),
        'My Trees must not reintroduce a 900px compact breakpoint'
    );
});

test('Compact desktop min-height 260px applies on both pages (combined selectors)', () => {
    // #3608 Phase 1: compact root rules use combined selectors.
    const combined = /#resultsList\[data-tree-view-mode="compact"\]\s+\.tree-card,\s*\.trees-grid\[data-tree-view-mode="compact"\]\s+\.tree-card\s*\{[^}]*min-height:\s*260px/;
    const browseOnly = /#resultsList\[data-tree-view-mode="compact"\][^{]*\{[^}]*min-height:\s*260px/;
    const myTreesOnly = /\.trees-grid\[data-tree-view-mode="compact"\][^{]*\{[^}]*min-height:\s*260px/;
    assert.ok(
        combined.test(viewModeCss) || (browseOnly.test(viewModeCss) && myTreesOnly.test(viewModeCss)),
        'compact min-height 260px must apply to Browse and My Trees'
    );
});

test('#3608 Phase 1: obsolete My Trees compact asymmetry rules are removed', () => {
    assert.doesNotMatch(
        viewModeCss,
        /\.trees-grid\[data-tree-view-mode="compact"\]\s+\.tree-card-thumb\s*\{[^}]*height:\s*140px/,
        'My Trees compact thumb 140px asymmetry removed'
    );
    assert.doesNotMatch(
        viewModeCss,
        /\.trees-grid\[data-tree-view-mode="compact"\]\s+\.tree-card-title\s*\{[^}]*font-size:\s*0\.95rem/,
        'My Trees compact title 0.95rem asymmetry removed'
    );
});

// ── 3) List mode parity on class-name divergence ─────────────────────
test('List mode border-radius applies to both .tree-card-media and .tree-card-thumb', () => {
    // Browse uses .tree-card-media, My Trees uses .tree-card-thumb.
    // Both must receive the same border-radius in list mode so the rounded
    // corner matches the card radius on either page.
    const re = /#resultsList\[data-tree-view-mode="list"\]\s+\.tree-card-media,\s*#resultsList\[data-tree-view-mode="list"\]\s+\.tree-card-thumb/;
    assert.match(viewModeCss, re);
    // Also applies via My Trees grid
    const re2 = /\.trees-grid\[data-tree-view-mode="list"\]\s+\.tree-card-thumb[^{]*\{[^}]*border-radius:/;
    assert.match(viewModeCss, re2);
});

test('List mode body padding applies to both .tree-card-body and .tree-card-info', () => {
    // Browse uses .tree-card-body, My Trees uses .tree-card-info.
    const re = /#resultsList\[data-tree-view-mode="list"\]\s+\.tree-card-body,\s*#resultsList\[data-tree-view-mode="list"\]\s+\.tree-card-info[^{]*\{[^}]*padding:\s*14px\s+16px/;
    assert.match(viewModeCss, re);
});

test('List mode border-radius uses --lovetree-card-radius-lg token (not hardcoded 1.85rem)', () => {
    // The list-mode rounded-left-corner rule should pull from the radius
    // token so it tracks any future radius change.
    // Each border-radius declaration inside a list-mode rule must use the token.
    // Find every border-radius declaration and confirm none are hardcoded 1.85rem
    // inside list-mode rules.
    const listBlockRe = /\[data-tree-view-mode="list"\]/g;
    let match;
    const radiusLines = [];
    while ((match = listBlockRe.exec(viewModeCss)) !== null) {
        // Grab 600 chars after the last list-mode marker to cover the rule body.
        const slice = viewModeCss.slice(match.index, match.index + 600);
        const radiusMatches = slice.match(/border-radius:\s*([^;]+);/g) || [];
        radiusMatches.forEach((r) => radiusLines.push(r));
    }
    assert.ok(
        radiusLines.length >= 3,
        'expected ≥3 border-radius declarations across list-mode rules'
    );
    const hardcoded = radiusLines.filter((line) => /1\.85rem/.test(line));
    assert.deepEqual(
        hardcoded,
        [],
        `list-mode border-radius must use --lovetree-card-radius-lg token; found hardcoded: ${hardcoded.join(', ')}`
    );
    const tokenized = radiusLines.filter((line) =>
        /var\(--lovetree-card-radius-lg\)/.test(line)
    );
    assert.ok(
        tokenized.length >= 3,
        `expected ≥3 list-mode border-radius declarations to use the token; got ${tokenized.length}`
    );
});

// ── 4) Token contract ────────────────────────────────────────────────
test('tokens.css defines --lovetree-card-grid-gap-compact = 18px', () => {
    assert.match(tokensCss, /--lovetree-card-grid-gap-compact:\s*18px;/);
});

test('tokens.css does not redefine the dead --lovetree-card-media-height-mytrees', () => {
    assert.ok(
        !/--lovetree-card-media-height-mytrees:/.test(tokensCss),
        'Dead token --lovetree-card-media-height-mytrees must not be reintroduced'
    );
});

// ── 5) Sanity: the file still defines all three modes on both pages ──
test('CSS still defines large/compact/list for both Browse and My Trees', () => {
    ['#resultsList', '.trees-grid'].forEach((selector) => {
        ['large', 'compact', 'list'].forEach((mode) => {
            const re = new RegExp(
                selector.replace('.', '\\.') +
                    '\\[data-tree-view-mode="' + mode + '"\\]'
            );
            assert.match(
                viewModeCss,
                re,
                `Missing ${selector}[data-tree-view-mode="${mode}"] rule`
            );
        });
    });
});
