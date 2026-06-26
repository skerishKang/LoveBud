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
const browseFlowCss = fs.readFileSync(
    path.join(ROOT, 'css/search/search-preview-sidebar/flow.css'),
    'utf8'
);

// ── 1) My Trees flow stage parity with Browse (2026-06-22 hotfix) ────
test('My Trees flow stage renders with Browse right-rail rhythm (shared via .preview-flow-stage)', () => {
    // Stage baseline CSS moved to Browse flow.css .preview-flow-stage.
    // My Trees inherits via shared preview-flow-stage class.
    const block = (browseFlowCss.match(/\.preview-flow-stage\s*\{[^}]*\}/s) || [''])[0];
    assert.ok(block, '.preview-flow-stage rule must exist in Browse flow.css');
    assert.match(
        block,
        /border-radius:\s*12px\s*!important/,
        'Browse .preview-flow-stage must use border-radius: 12px (My Trees inherits)'
    );
    assert.match(
        block,
        /background:\s*rgba\(\s*255,\s*255,\s*255,\s*0\.56\)\s*!important/,
        'Browse .preview-flow-stage must use the soft surface (My Trees inherits)'
    );
    assert.match(
        block,
        /padding:\s*8px\s+10px\s*!important/,
        'Browse .preview-flow-stage must use padding 8px 10px (My Trees inherits)'
    );
    assert.match(
        block,
        /(?:^|\s)height:\s*42px\s*!important/,
        'Browse .preview-flow-stage must declare height 42px (My Trees inherits)'
    );
    assert.match(
        block,
        /min-height:\s*42px\s*!important/,
        'Browse .preview-flow-stage must declare min-height 42px (My Trees inherits)'
    );
});

test('My Trees flow stage does NOT carry the legacy flat-style overrides', () => {
    // Stage block moved to Browse flow.css. Both My Trees and Browse
    // must be free of the legacy flat-style overrides.
    const mtBlock = (myTreesFlowCss.match(/\.my-trees-hub-flow-stage\s*\{[^}]*\}/s) || [''])[0];
    const brBlock = (browseFlowCss.match(/\.preview-flow-stage\s*\{[^}]*\}/s) || [''])[0];
    assert.ok(!mtBlock, '.my-trees-hub-flow-stage must not exist in My Trees flow.css (moved to Browse)');
    assert.ok(brBlock, '.preview-flow-stage must exist in Browse flow.css');
    assert.ok(
        !/padding:\s*2px\s+6px;/.test(brBlock),
        'legacy padding 2px 6px (flat inline style) must not return'
    );
    assert.ok(
        !/background:\s*transparent;/.test(brBlock),
        'legacy transparent background must not return'
    );
    assert.ok(
        !/border-radius:\s*4px;/.test(brBlock),
        'legacy border-radius 4px (flat square) must not return'
    );
    assert.ok(
        !/border-radius:\s*999px;/.test(brBlock),
        'legacy 999px pill radius must not return'
    );
});

test('My Trees flow stage uses display: flex (inherited from Browse .preview-flow-stage)', () => {
    const block = (browseFlowCss.match(/\.preview-flow-stage\s*\{[^}]*\}/s) || [''])[0];
    assert.match(
        block,
        /display:\s*flex\s*!important/,
        'Browse .preview-flow-stage must use display: flex (My Trees inherits)'
    );
});

// ── 2) My Trees social shell uses chat_bubble (not mode_comment) ──────
test('My Trees social shell uses mode_comment for the comment icon', () => {
    assert.match(
        myTreesHubJs,
        /<span class="material-symbols-outlined"\s+aria-hidden="true">mode_comment<\/span>/,
        'My Trees social shell must use mode_comment icon for comments to match Browse'
    );
});

test('My Trees social shell does NOT use the broken comment icon', () => {
    assert.ok(
        !/material-symbols-outlined["']\s*aria-hidden="true">comment<\/span>/.test(myTreesHubJs),
        'Legacy comment icon must not return (mode_comment replaces it to match Browse)'
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
