/**
 * LoveBud Card Surface Parity — Contract Test
 *
 * Locks the post-Step 4 invariant that My Trees cards use the same
 * Browse surface treatment (warm gradient + heavy raised box-shadow +
 * accent ::before/::after bars + lift on hover + open-link darken
 * on selected) so cards read as a single visual family across pages.
 *
 * Before Step 4, My Trees used a flat cream surface and a light
 * box-shadow (--lovetree-card-shadow). The token comment in
 * tokens.css declared "Browse keeps its warm gradient feel. My Trees
 * keeps its stable surface." Step 4 retires that divergence: both
 * pages now share Browse's surface treatment.
 */
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');

const ROOT = path.resolve(__dirname, '..', '..');

const myTreesCardsCss = fs.readFileSync(
    path.join(ROOT, 'css/my-trees/my-trees-cards.css'),
    'utf8'
);
const browseLayoutCss = fs.readFileSync(
    path.join(ROOT, 'css/search/search-tree-card/layout.css'),
    'utf8'
);

// ── 1) Surface parity: both pages use --lovetree-card-surface-browse ─
test('Browse .tree-card uses --lovetree-card-surface-browse', () => {
    const re = /\.tree-card\s*{[^}]*background:\s*var\(--lovetree-card-surface-browse\)/;
    assert.match(browseLayoutCss, re);
});

test('My Trees .tree-card uses --lovetree-card-surface-browse (Step 4 parity)', () => {
    const re = /\.tree-card\s*{[^}]*background:\s*var\(--lovetree-card-surface-browse\)/;
    assert.match(
        myTreesCardsCss,
        re,
        'My Trees card surface must use --lovetree-card-surface-browse after Step 4'
    );
});

test('My Trees .tree-card does NOT use the legacy --lovetree-soft-surface as card background', () => {
    // The legacy rule (now retired) used --lovetree-soft-surface for the card
    // background. After Step 4 this must not return.
    const re = /\.tree-card\s*{[^}]*background:\s*var\(--lovetree-soft-surface\)/;
    assert.equal(
        re.test(myTreesCardsCss),
        false,
        'My Trees card background must not revert to --lovetree-soft-surface'
    );
});

// ── 2) Box-shadow parity: same heavy raised shadow on both pages ────
test('Browse .tree-card uses the heavy raised box-shadow', () => {
    const re = /\.tree-card\s*{[^}]*box-shadow:[^}]*0\s+20px\s+48px\s+rgba\(75,\s*64,\s*57,\s*0\.1\)/s;
    assert.match(browseLayoutCss, re);
});

test('My Trees .tree-card uses the same heavy raised box-shadow (Step 4 parity)', () => {
    const re = /\.tree-card\s*{[^}]*box-shadow:[^}]*0\s+20px\s+48px\s+rgba\(75,\s*64,\s*57,\s*0\.1\)/s;
    assert.match(
        myTreesCardsCss,
        re,
        'My Trees card box-shadow must match Browse (heavy raised card) after Step 4'
    );
});

test('My Trees .tree-card does NOT use --lovetree-card-shadow (legacy light shadow) for the card itself', () => {
    const re = /\.tree-card\s*{[^}]*box-shadow:\s*var\(--lovetree-card-shadow\)/;
    assert.equal(
        re.test(myTreesCardsCss),
        false,
        'My Trees .tree-card base rule must not use --lovetree-card-shadow (legacy lighter shadow); the token is still allowed for empty-state / hub usage'
    );
});

// ── 3) Accent bars parity: both pages define ::before and ::after ────
test('Browse .tree-card defines ::before accent bar', () => {
    assert.match(browseLayoutCss, /\.tree-card::before\s*{/);
});

test('Browse .tree-card defines ::after accent bar', () => {
    assert.match(browseLayoutCss, /\.tree-card::after\s*{/);
});

test('My Trees .tree-card defines ::before accent bar (Step 4 parity)', () => {
    assert.match(
        myTreesCardsCss,
        /\.tree-card::before\s*{/,
        'My Trees card must define the top accent bar (parity with Browse)'
    );
});

test('My Trees .tree-card defines ::after accent bar (Step 4 parity)', () => {
    assert.match(
        myTreesCardsCss,
        /\.tree-card::after\s*{/,
        'My Trees card must define the right accent bar (parity with Browse)'
    );
});

// ── 4) Hover lift parity: both pages lift on hover ──────────────────
test('My Trees .tree-card:hover lifts up (transform: translateY(-3px))', () => {
    const re = /\.tree-card:hover\s*{[^}]*transform:\s*translateY\(-3px\)/s;
    assert.match(
        myTreesCardsCss,
        re,
        'My Trees card hover must lift 3px to match Browse interaction'
    );
});

test('My Trees .tree-card:hover uses Browse-style hover shadow + inset', () => {
    const re = /\.tree-card:hover\s*{[^}]*box-shadow:[^}]*var\(--lovetree-card-shadow-hover\)[^}]*inset/s;
    assert.match(myTreesCardsCss, re);
});

// ── 5) Selected-state parity: both pages use active gradient + show
//        accent bars + darken the open-link button ────────────────────
test('My Trees selected state uses active gradient background', () => {
    const re = /\.tree-card\.is-selected,\s*\n\s*\.tree-card\[data-selected-tree-card="true"\]\s*{[^}]*background:[^}]*radial-gradient/s;
    assert.match(
        myTreesCardsCss,
        re,
        'My Trees selected card background must use the Browse active radial-gradient stack'
    );
});

test('My Trees selected state uses active shadow + ring', () => {
    const re = /\.tree-card\.is-selected,\s*\n\s*\.tree-card\[data-selected-tree-card="true"\]\s*{[^}]*box-shadow:[^}]*var\(--lovetree-card-shadow-active\)[^}]*var\(--lovetree-card-ring-active\)/s;
    assert.match(myTreesCardsCss, re);
});

test('My Trees selected state shows the ::before accent bar', () => {
    const re = /\.tree-card\.is-selected::before,\s*\n\s*\.tree-card\[data-selected-tree-card="true"\]::before\s*{[^}]*opacity:\s*1/s;
    assert.match(
        myTreesCardsCss,
        re,
        'My Trees selected card must show the top accent bar at full opacity'
    );
});

test('My Trees selected state shows the ::after accent bar', () => {
    const re = /\.tree-card\.is-selected::after,\s*\n\s*\.tree-card\[data-selected-tree-card="true"\]::after\s*{[^}]*opacity:\s*1/s;
    assert.match(
        myTreesCardsCss,
        re,
        'My Trees selected card must show the right accent bar at full opacity'
    );
});

test('My Trees selected card darkens the open-link button (Browse parity)', () => {
    const re = /\.tree-card\.is-selected\s+\.tree-card-open-link,\s*\n\s*\.tree-card\[data-selected-tree-card="true"\]\s+\.tree-card-open-link\s*{[^}]*background:\s*rgba\(144,\s*73,\s*81,\s*0\.92\)/s;
    assert.match(
        myTreesCardsCss,
        re,
        'My Trees selected card open-link must fill with the Browse dark-purple background'
    );
});

// ── 6) Border parity: both pages use the same border tokens ─────────
test('My Trees .tree-card uses --lovetree-soft-surface-border for border', () => {
    const re = /\.tree-card\s*{[^}]*border:\s*1px solid var\(--lovetree-soft-surface-border\)/;
    assert.match(myTreesCardsCss, re);
});

test('My Trees .tree-card uses --lovetree-card-radius-lg for border-radius', () => {
    const re = /\.tree-card\s*{[^}]*border-radius:\s*var\(--lovetree-card-radius-lg\)/;
    assert.match(myTreesCardsCss, re);
});
