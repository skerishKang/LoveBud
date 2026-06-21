/**
 * LoveBud Hub Parity Step 6 — Contract Test
 *
 * Locks two visual fixes from the Step 6 follow-up:
 *
 *   1. My Trees flow stages use the same compact, transparent inline-style
 *      treatment as Browse (.preview-flow-stage) — padding 2px 6px,
 *      border-radius 4px, font-size 13px, transparent background, no
 *      border, no shadow, no min-height. The legacy card-density
 *      overrides (min-height 42px, padding 8px 10px, border-radius
 *      12px, background, border, shadow) must not return.
 *
 *   2. My Trees owner-passive social shell uses `chat_bubble` for the
 *      comment icon (the `mode_comment` ligature fails to render in
 *      some Material Symbols font versions and shows as a missing
 *      glyph □). All other icons (favorite / share / visibility) are
 *      unchanged.
 */
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');

const ROOT = path.resolve(__dirname, '..', '..');

const myTreesHubJs = fs.readFileSync(
    path.join(ROOT, 'js/my-trees/my-trees-preview-hub.js'),
    'utf8'
);
const myTreesFlowCss = fs.readFileSync(
    path.join(ROOT, 'css/my-trees/my-trees-preview-hub/flow.css'),
    'utf8'
);

// ── 1) My Trees flow stage parity with Browse ─────────────────────────
test('My Trees flow stage uses Browse inline-style compact rhythm', () => {
    const re = /\.my-trees-hub-flow-stage\s*\{[^}]*padding:\s*2px\s+6px;[^}]*border-radius:\s*4px;[^}]*font-size:\s*13px;/s;
    assert.match(
        myTreesFlowCss,
        re,
        'My Trees .my-trees-hub-flow-stage must use Browse-style padding 2px 6px, border-radius 4px, font-size 13px (Step 6)'
    );
});

test('My Trees flow stage does NOT carry the legacy card-density overrides', () => {
    // The legacy rule had:
    //   min-height: 42px !important;
    //   padding: 8px 10px !important;
    //   border-radius: 12px !important;
    //   background: rgba(255, 255, 255, 0.56) !important;
    //   border: 1px solid rgba(144, 73, 81, 0.08);
    //   box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.66);
    //   font-size: 12.5px !important;
    // All of these must be gone.
    const block = (myTreesFlowCss.match(/\.my-trees-hub-flow-stage\s*\{[^}]*\}/s) || [''])[0];
    assert.ok(block, 'rule must exist');
    assert.ok(
        !/min-height:\s*42px\s*!important/.test(block),
        'legacy min-height 42px !important must not return'
    );
    assert.ok(
        !/padding:\s*8px\s+10px\s*!important/.test(block),
        'legacy padding 8px 10px !important must not return'
    );
    assert.ok(
        !/border-radius:\s*12px\s*!important/.test(block),
        'legacy border-radius 12px !important must not return'
    );
    assert.ok(
        !/background:\s*rgba\(255,\s*255,\s*255,\s*0\.56\)\s*!important/.test(block),
        'legacy background rgba(255,255,255,0.56) !important must not return'
    );
    assert.ok(
        !/box-shadow:/.test(block),
        'legacy box-shadow must not return on flow stage'
    );
    assert.ok(
        !/border:\s*1px solid/.test(block),
        'legacy 1px solid border must not return on flow stage'
    );
});

test('My Trees flow stage uses display: inline-flex (Browse parity)', () => {
    const block = (myTreesFlowCss.match(/\.my-trees-hub-flow-stage\s*\{[^}]*\}/s) || [''])[0];
    assert.match(
        block,
        /display:\s*inline-flex/,
        'My Trees .my-trees-hub-flow-stage must use display: inline-flex (Browse parity)'
    );
});

test('My Trees flow stage uses transparent background (Browse parity)', () => {
    const block = (myTreesFlowCss.match(/\.my-trees-hub-flow-stage\s*\{[^}]*\}/s) || [''])[0];
    assert.match(
        block,
        /background:\s*transparent/,
        'My Trees .my-trees-hub-flow-stage must use background: transparent (Browse parity)'
    );
});

// ── 2) My Trees social shell uses chat_bubble (not mode_comment) ──────
test('My Trees social shell uses chat_bubble for the comment icon', () => {
    assert.match(
        myTreesHubJs,
        /<span class="material-symbols-outlined"\s+aria-hidden="true">chat_bubble<\/span>/,
        'My Trees social shell must use chat_bubble icon for comments (Step 6)'
    );
});

test('My Trees social shell does NOT use the legacy mode_comment icon', () => {
    assert.ok(
        !/material-symbols-outlined["']\s*aria-hidden="true">mode_comment<\/span>/.test(myTreesHubJs),
        'Legacy mode_comment icon must not return (was failing to render in some Material Symbols font versions)'
    );
});

test('My Trees social shell keeps the other 3 icons unchanged', () => {
    // favorite (좋아요), share (공유), visibility (조회수) must remain
    const expectedIcons = ['favorite', 'share', 'visibility'];
    for (const icon of expectedIcons) {
        assert.match(
            myTreesHubJs,
            new RegExp(`<span class="material-symbols-outlined"\\s+aria-hidden="true">${icon}</span>`),
            `My Trees social shell must still include ${icon} icon`
        );
    }
});
