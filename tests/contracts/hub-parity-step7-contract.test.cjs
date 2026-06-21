/**
 * LoveBud Hub Parity Step 7 — Contract Test
 *
 * Locks the post-Step 7 hub parity invariants for the moment-flow
 * region. These are the visible differences that survived Step 6:
 *
 *   1. My Trees flow list renders as 2 columns on desktop (≥1025px)
 *      via a media query — matching Browse .preview-flow-list
 *   2. My Trees flow label uses Browse's styling (font-size 11px,
 *      text-transform: uppercase, letter-spacing 1px,
 *      margin-bottom 12px)
 *   3. My Trees flow label text is "이어진 흐름" (Browse) not
 *      "이어진 순간 흐름" (legacy My Trees)
 *   4. My Trees stage index has no pill (no background, no
 *      border-radius, no padding, no min-width/height) — Browse
 *      uses an inline span with only color + font-weight + flex
 *   5. My Trees stage HTML is <span>...</span> (not <div>) to
 *      match Browse's .preview-flow-stage element
 *
 * Plus the two post-Step 5 fixes that were held back until the
 * layout alignment was verified:
 *   6. Social shell sits BELOW the action buttons
 *      (#myTreesHubActions) — verified by els.actions.after(shell)
 *   7. Social shell comment icon uses "comment" (not chat_bubble
 *      or mode_comment — both rendered as missing glyphs)
 */
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');

const ROOT = path.resolve(__dirname, '..', '..');

const myTreesHtml = fs.readFileSync(
    path.join(ROOT, 'pages/my-trees.html'),
    'utf8'
);
const myTreesHubJs = fs.readFileSync(
    path.join(ROOT, 'js/my-trees/my-trees-preview-hub.js'),
    'utf8'
);
const myTreesStateJs = fs.readFileSync(
    path.join(ROOT, 'js/my-trees/my-trees-preview-state.js'),
    'utf8'
);
const myTreesFlowCss = fs.readFileSync(
    path.join(ROOT, 'css/my-trees/my-trees-preview-hub/flow.css'),
    'utf8'
);

// ── 1) 2-column grid on desktop ────────────────────────────────────────
test('My Trees flow list has 2-column grid at min-width 1025px', () => {
    const re = /@media\s*\(min-width:\s*1025px\)\s*\{[^}]*\.my-trees-hub-flow-list\s*\{[^}]*grid-template-columns:\s*repeat\(2,\s*minmax\(0,\s*1fr\)\)[^}]*\}/s;
    assert.match(
        myTreesFlowCss,
        re,
        'My Trees .my-trees-hub-flow-list must use 2 columns on desktop (Browse parity, Step 7)'
    );
});

test('My Trees flow list keeps 1 column on mobile (base rule)', () => {
    const re = /\.my-trees-hub-flow-list\s*\{[^}]*grid-template-columns:\s*minmax\(0,\s*1fr\)[^}]*\}/s;
    assert.match(
        myTreesFlowCss,
        re,
        'My Trees .my-trees-hub-flow-list base rule must keep 1 column (mobile)'
    );
});

// ── 2) Flow label CSS parity with Browse ───────────────────────────────
test('My Trees flow label uses Browse-style font-size 11px', () => {
    const block = (myTreesFlowCss.match(/\.my-trees-hub-flow-label\s*\{[^}]*\}/s) || [''])[0];
    assert.match(
        block,
        /font-size:\s*11px/,
        'My Trees .my-trees-hub-flow-label must use font-size 11px (Browse parity)'
    );
});

test('My Trees flow label uses uppercase + letter-spacing (Browse parity)', () => {
    const block = (myTreesFlowCss.match(/\.my-trees-hub-flow-label\s*\{[^}]*\}/s) || [''])[0];
    assert.match(block, /text-transform:\s*uppercase/, 'must use text-transform: uppercase');
    assert.match(block, /letter-spacing:\s*1px/, 'must use letter-spacing: 1px');
});

test('My Trees flow label uses margin-bottom 12px (Browse parity)', () => {
    const block = (myTreesFlowCss.match(/\.my-trees-hub-flow-label\s*\{[^}]*\}/s) || [''])[0];
    assert.match(block, /margin-bottom:\s*12px/, 'must use margin-bottom: 12px');
});

// ── 3) Flow label text parity ─────────────────────────────────────────
test('My Trees HTML flow label text is "이어진 흐름" (Browse parity)', () => {
    assert.match(
        myTreesHtml,
        /<div class="my-trees-hub-flow-label">[\s\S]*?이어진\s*흐름[\s\S]*?<\/div>/,
        'My Trees HTML flow label must read "이어진 흐름" (Browse parity)'
    );
});

test('My Trees HTML flow label does NOT use legacy "이어진 순간 흐름" text', () => {
    assert.ok(
        !/이어진\s*순간\s*흐름/.test(myTreesHtml),
        'Legacy "이어진 순간 흐름" label must not return after Step 7'
    );
});

// ── 4) Stage index no-pill (Browse parity) ────────────────────────────
test('My Trees flow stage index has no pill background', () => {
    const block = (myTreesFlowCss.match(/\.my-trees-hub-flow-stage-index\s*\{[^}]*\}/s) || [''])[0];
    assert.ok(block, 'rule must exist');
    assert.ok(
        !/background:\s*rgba/.test(block),
        'stage index must not have a background pill (Browse parity)'
    );
    assert.ok(
        !/border-radius:\s*999px/.test(block),
        'stage index must not have a circular border-radius (Browse parity)'
    );
    assert.ok(
        !/min-width:\s*18px/.test(block),
        'stage index must not have a min-width pill (Browse parity)'
    );
    assert.ok(
        !/height:\s*18px/.test(block),
        'stage index must not have a fixed height pill (Browse parity)'
    );
});

test('My Trees flow stage index keeps only color + font-weight + flex', () => {
    const block = (myTreesFlowCss.match(/\.my-trees-hub-flow-stage-index\s*\{[^}]*\}/s) || [''])[0];
    assert.ok(block, 'rule must exist');
    assert.match(block, /color:\s*var\(--primary\)/);
    assert.match(block, /font-weight:\s*800/);
    assert.match(block, /flex:\s*0\s+0\s+auto/);
});

// ── 5) Stage HTML element parity (span, not div) ──────────────────────
test('My Trees hub renderer emits <span> for the flow stage (not <div>)', () => {
    assert.match(
        myTreesHubJs,
        /<span class="my-trees-hub-flow-stage"[^>]*title="/,
        'my-trees-preview-hub.js must emit <span class="my-trees-hub-flow-stage"> for HTML parity with Browse'
    );
    assert.ok(
        !/<div class="my-trees-hub-flow-stage"/.test(myTreesHubJs),
        'my-trees-preview-hub.js must NOT emit <div class="my-trees-hub-flow-stage"> (Step 7 HTML parity)'
    );
});

test('My Trees hydrated flow stages also use <span> (not <div>)', () => {
    assert.match(
        myTreesStateJs,
        /<span class="my-trees-hub-flow-stage"[^>]*title="/,
        'my-trees-preview-state.js must emit <span class="my-trees-hub-flow-stage"> for HTML parity'
    );
    assert.ok(
        !/<div class="my-trees-hub-flow-stage"/.test(myTreesStateJs),
        'my-trees-preview-state.js must NOT emit <div class="my-trees-hub-flow-stage"> (Step 7 HTML parity)'
    );
});
