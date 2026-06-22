/**
 * LoveBud Hub Parity Step 6 — Contract Test
 *
 * Locks two visual fixes from the Step 6 follow-up + the 2026-06-22 hotfix:
 *
 *   1. My Trees flow stages render as a discrete pill button so each
 *      moment reads as an interactive marker in production. The
 *      2026-06-22 hotfix replaces the previous flat transparent style
 *      (padding 2px 6px, border-radius 4px, no border) with a pill
 *      surface (border-radius 999px, surface background, 1px border,
 *      min-height 34px) that survives the narrow column widths.
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

// ── 1) My Trees flow stage parity with Browse (2026-06-22 hotfix) ────
test('My Trees flow stage renders as a pill button (2026-06-22 hotfix)', () => {
    const block = (myTreesFlowCss.match(/\.my-trees-hub-flow-stage\s*\{[^}]*\}/s) || [''])[0];
    assert.ok(block, 'rule must exist');
    assert.match(
        block,
        /border-radius:\s*999px/,
        'My Trees .my-trees-hub-flow-stage must use border-radius: 999px (pill rhythm)'
    );
    assert.match(
        block,
        /background:\s*rgba\(\s*255,\s*250,\s*249/,
        'My Trees .my-trees-hub-flow-stage must use the soft surface pill background'
    );
    assert.match(
        block,
        /border:\s*1px solid\s+rgba\(144,\s*73,\s*81/,
        'My Trees .my-trees-hub-flow-stage must use the primary-tinted border'
    );
    assert.match(
        block,
        /min-height:\s*34px/,
        'My Trees .my-trees-hub-flow-stage must declare min-height 34px for tap-friendly target'
    );
});

test('My Trees flow stage does NOT carry the legacy flat-style overrides', () => {
    // The Step 6 flat rule had: padding 2px 6px + transparent background
    // + border-radius 4px + no border. The 2026-06-22 hotfix replaces it
    // with a pill surface. Lock the legacy flat-style overrides out.
    const block = (myTreesFlowCss.match(/\.my-trees-hub-flow-stage\s*\{[^}]*\}/s) || [''])[0];
    assert.ok(block, 'rule must exist');
    assert.ok(
        !/padding:\s*2px\s+6px;/.test(block),
        'legacy padding 2px 6px (flat inline style) must not return'
    );
    assert.ok(
        !/background:\s*transparent;/.test(block),
        'legacy transparent background must not return'
    );
    assert.ok(
        !/border-radius:\s*4px;/.test(block),
        'legacy border-radius 4px (flat square) must not return'
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

// ── 2) My Trees social shell uses chat_bubble (not mode_comment) ──────
test('My Trees social shell uses comment for the comment icon', () => {
    // Step 7 follow-up: chat_bubble was rendering as a missing glyph □ in
    // some Material Symbols font versions. "comment" is the universal
    // fallback that renders correctly across all font versions.
    assert.match(
        myTreesHubJs,
        /<span class="material-symbols-outlined"\s+aria-hidden="true">comment<\/span>/,
        'My Trees social shell must use comment icon for comments (Step 7)'
    );
});

test('My Trees social shell does NOT use the broken mode_comment or chat_bubble icons', () => {
    assert.ok(
        !/material-symbols-outlined["']\s*aria-hidden="true">mode_comment<\/span>/.test(myTreesHubJs),
        'Legacy mode_comment icon must not return (was rendering as missing glyph)'
    );
    assert.ok(
        !/material-symbols-outlined["']\s*aria-hidden="true">chat_bubble<\/span>/.test(myTreesHubJs),
        'Step 6 chat_bubble icon must not return (was rendering as missing glyph in some font versions)'
    );
});

test('My Trees social shell keeps the 2 non-comment icons unchanged', () => {
    // Step 9: Browse has 3 stats (favorite / mode_comment / visibility).
    // My Trees must keep favorite + visibility. The share icon was retired
    // to match Browse (which has no share stat).
    const expectedIcons = ['favorite', 'visibility'];
    for (const icon of expectedIcons) {
        assert.match(
            myTreesHubJs,
            new RegExp(`<span class="material-symbols-outlined"\\s+aria-hidden="true">${icon}</span>`),
            `My Trees social shell must still include ${icon} icon`
        );
    }
});
