/**
 * LoveBud Hub Parity Step 8 ??Contract Test
 *
 * Locks the post-Step 8 hub parity invariants for the moment-flow
 * region. These are the production-only visual + interactive
 * differences that survived Step 7:
 *
 *   1. My Trees flow container has NO margin-top (Browse parity)
 *   2. My Trees toggle text is "... 洹몃━怨?N媛쒖쓽 ?쒓컙 ?? / "?묎린"
 *      (Browse parity), not "?붾낫湲?(N)"
 *   3. My Trees flow stages are interactive: role="button",
 *      tabindex="0", data-my-trees-moment-index
 *   4. My Trees stages toggle is-active class on click
 *   5. My Trees stages bind a click handler that swaps the video
 *      iframe to the clicked moment
 *   6. My Trees stage label has title + aria-label (hover tooltip +
 *      screen reader)
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
const myTreesStateJs = fs.readFileSync(
    path.join(ROOT, 'js/my-trees/my-trees-preview-state.js'),
    'utf8'
);
const myTreesFlowCss = fs.readFileSync(
    path.join(ROOT, 'css/my-trees/my-trees-preview-hub/flow.css'),
    'utf8'
);

// ?? 1) My Trees flow container has NO margin-top (Browse parity) ?????
test('My Trees flow container has no margin-top (Browse parity)', () => {
    const block = (myTreesFlowCss.match(/\.my-trees-hub-flow\s*\{[\s\S]*?\}/) || [''])[0];
    assert.ok(block, '.my-trees-hub-flow rule must exist');
    assert.ok(
        !/margin-top:\s*16px/.test(block),
        'My Trees .my-trees-hub-flow must NOT carry margin-top: 16px (Browse has no margin-top)'
    );
});

// ?? 2) My Trees toggle text uses Browse format ???????????????????????
test('My Trees hub renderer emits Browse-style toggle text', () => {
    assert.match(
        myTreesHubJs,
        /'\.\.\.\s*그리고\s*'\s*\+\s*hiddenCount\s*\+\s*'개의 순간 더'/,
        'My Trees hub renderer must use Browse-style "... 그리고 N개의 순간 더"'
    );
    assert.match(
        myTreesHubJs,
        /'접기'/,
        'My Trees hub renderer must use "접기" for the expanded toggle (Browse parity)'
    );
    assert.ok(
        !/'\s*더보기\s*\(\s*'\s*\+\s*hiddenCount/.test(myTreesHubJs),
        'Legacy "더보기 (N)" toggle text must not return after Step 8'
    );
});

test('My Trees hydrated flow toggle text uses Browse format', () => {
    assert.match(
        myTreesStateJs,
        /'\.\.\.\s*그리고\s*'\s*\+\s*hiddenCount\s*\+\s*'개의 순간 더'/,
        'My Trees state hydrated toggle must use Browse-style "... 그리고 N개의 순간 더"'
    );
    assert.ok(
        !/'\s*더보기\s*\(\s*'\s*\+\s*hiddenCount/.test(myTreesStateJs),
        'Legacy "더보기 (N)" toggle text must not return after Step 8'
    );
});

// ?? 3) Stage interactivity (role, tabindex, data attr) ???????????????
test('My Trees hub renderer binds role + tabindex + click handler on stages', () => {
    assert.match(
        myTreesHubJs,
        /enhanceMyTreesFlowStages\(\s*tree\s*\)/,
        'My Trees hub renderer must call enhanceMyTreesFlowStages(tree) after building the flow list'
    );
    assert.match(
        myTreesHubJs,
        /stage\.setAttribute\(\s*['"]role['"]\s*,\s*['"]button['"]\s*\)/,
        'enhanceMyTreesFlowStages must set role="button" on each stage (Browse parity)'
    );
    assert.match(
        myTreesHubJs,
        /stage\.setAttribute\(\s*['"]tabindex['"]\s*,\s*['"]0['"]\s*\)/,
        'enhanceMyTreesFlowStages must set tabindex="0" on each stage (Browse parity)'
    );
    assert.match(
        myTreesHubJs,
        /stage\.addEventListener\(\s*['"]click['"]/,
        'enhanceMyTreesFlowStages must bind a click handler on each stage (Browse parity)'
    );
    assert.match(
        myTreesHubJs,
        /stage\.addEventListener\(\s*['"]keydown['"]/,
        'enhanceMyTreesFlowStages must bind a keydown handler on each stage (Browse parity, Enter/Space)'
    );
});

test('My Trees hub renderer emits data-my-trees-moment-index on each stage', () => {
    assert.match(
        myTreesHubJs,
        /data-my-trees-moment-index="'\s*\+\s*stageIndex/,
        'My Trees hub renderer must emit data-my-trees-moment-index on each stage'
    );
    assert.match(
        myTreesStateJs,
        /data-my-trees-moment-index="'\s*\+\s*stageIndex/,
        'My Trees hydrated renderer must emit data-my-trees-moment-index on each stage'
    );
});

// ?? 4) is-active toggling on click ???????????????????????????????????
test('My Trees stage click toggles is-active class', () => {
    assert.match(
        myTreesHubJs,
        /stage\.classList\.toggle\(\s*['"]is-active['"]\s*,\s*index\s*===\s*selectedIndex\s*\)/,
        'First stage must get is-active class initially (selectedIndex default 0)'
    );
    assert.match(
        myTreesHubJs,
        /stages\.forEach\(function\(item\)\s*\{\s*item\.classList\.remove\(\s*['"]is-active['"]\s*\)/,
        'Click handler must remove is-active from all stages before adding to clicked one'
    );
    assert.match(
        myTreesHubJs,
        /stage\.classList\.add\(\s*['"]is-active['"]/,
        'Click handler must add is-active to clicked stage'
    );
});

// ?? 5) Click handler swaps video iframe ??????????????????????????????
test('My Trees stage click handler swaps the video iframe to that moment', () => {
    assert.match(
        myTreesHubJs,
        /function\s+swapToMomentIframe\s*\(\s*tree\s*,\s*momentIndex\s*\)/,
        'My Trees hub must define swapToMomentIframe(tree, momentIndex) ??Browse parity'
    );
    assert.match(
        myTreesHubJs,
        /iframe\.src\s*=\s*embedUrl/,
        'swapToMomentIframe must update iframe.src to the selected moment embed URL'
    );
    assert.match(
        myTreesHubJs,
        /iframe\.setAttribute\(\s*['"]title['"]/,
        'swapToMomentIframe must update the iframe title attribute (a11y)'
    );
    assert.match(
        myTreesHubJs,
        /swapToMomentIframe\(\s*tree\s*,\s*index\s*\)/,
        'activate() must call swapToMomentIframe(tree, index) on click'
    );
});

// ?? 6) Stage label has title + aria-label ????????????????????????????
test('My Trees stage label has title and aria-label attributes', () => {
    // The label HTML should include both title and aria-label.
    // Additional shared classes (preview-flow-stage-label) may be present in class value.
    assert.match(
        myTreesHubJs,
        /my-trees-hub-flow-stage-label[^"]*"\s+title="[^"]*"\s+aria-label="[^"]*"/,
        'My Trees stage label must include both title and aria-label (Browse parity)'
    );
    assert.match(
        myTreesStateJs,
        /my-trees-hub-flow-stage-label[^"]*"\s+title="[^"]*"\s+aria-label="[^"]*"/,
        'My Trees hydrated stage label must include both title and aria-label (Browse parity)'
    );
});

// ── 7) Social stats order (조회수 -> 좋아요 -> 댓글) ───────────────────────
test('My Trees hub renderer renders social metrics in the correct order', () => {
    const barHtmlMatch = myTreesHubJs.match(/shell\.innerHTML\s*=\s*\[([\s\S]*?)\]\.join/);
    assert.ok(barHtmlMatch, 'Social shell markup must exist in js');
    const barHtml = barHtmlMatch[1];

    const viewsIndex = barHtml.indexOf('aria-label="조회수"');
    const likesIndex = barHtml.indexOf('aria-label="좋아요"');
    const commentsIndex = barHtml.indexOf('aria-label="댓글"');

    assert.ok(viewsIndex !== -1, 'Views pill must exist');
    assert.ok(likesIndex !== -1, 'Likes pill must exist');
    assert.ok(commentsIndex !== -1, 'Comments pill must exist');

    assert.ok(viewsIndex < likesIndex, 'Views must come before Likes');
    assert.ok(likesIndex < commentsIndex, 'Likes must come before Comments');
});

// ── 8) Flow controls empty state hiding ──────────────────────────────
test('My Trees flow controls must be hidden when empty', () => {
    assert.match(
        myTreesFlowCss,
        /\.my-trees-hub-flow-controls:empty\s*{[\s\S]*?display:\s*none\s*!important;?[\s\S]*?}/,
        'flow controls:empty rule must hide empty wrapper'
    );
});

