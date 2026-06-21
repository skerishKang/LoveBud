/**
 * LoveBud Hub Parity Step 5 — Contract Test
 *
 * Locks the post-Step 5 hub parity invariants between Browse preview
 * sidebar and My Trees hub panel:
 *
 *   - Video iframe renders WITHOUT the "영상은 이곳에서 바로 재생할 수 있어요"
 *     overlay on My Trees (parity with Browse via the embed-patch)
 *   - My Trees flow stages render with numeric index (no emoji icon)
 *   - My Trees flow toggle is an interactive <button
 *     data-my-trees-flow-toggle> (not a static <span>)
 *   - My Trees flow card uses the Browse flat surface
 *     (background: var(--surface-container-low)) — no gradient, no
 *     border, no box-shadow
 *   - My Trees primary action button uses "트리 열기" + account_tree icon
 *     (Browse parity)
 *   - My Trees hub renders the shared .preview-social-shell + social bar
 *     (4 passive stats: 좋아요 / 댓글 / 공유 / 조회수) for Browse parity
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
const myTreesHubManifest = fs.readFileSync(
    path.join(ROOT, 'css/my-trees/my-trees-preview-hub.css'),
    'utf8'
);
const searchSocialBarCss = fs.readFileSync(
    path.join(ROOT, 'css/search/search-preview-social-bar.css'),
    'utf8'
);

// ── 1) Video overlay removed (embed-patch loads on My Trees) ──────────
test('My Trees page loads search-preview-media-embed-patch.js (overlay removal)', () => {
    assert.match(
        myTreesHtml,
        /<script src=["']\.\.\/js\/search\/search-preview-media-embed-patch\.js/,
        'My Trees page must load the embed-patch that strips the overlay'
    );
});

test('My Trees page loads search-preview-media-embed-patch BEFORE my-trees-preview-media.js', () => {
    const patchIdx = myTreesHtml.indexOf('search-preview-media-embed-patch.js');
    const consumerIdx = myTreesHtml.indexOf('my-trees-preview-media.js');
    assert.ok(patchIdx !== -1, 'embed-patch must be referenced');
    assert.ok(consumerIdx !== -1, 'my-trees-preview-media.js must be referenced');
    assert.ok(
        patchIdx < consumerIdx,
        'embed-patch must load BEFORE my-trees-preview-media.js so the helper is patched before use'
    );
});

// ── 2) My Trees flow stage uses numeric index (no emoji) ──────────────
test('My Trees hub renderer uses .my-trees-hub-flow-stage-index (numeric)', () => {
    assert.match(
        myTreesHubJs,
        /<span class="my-trees-hub-flow-stage-index">\s*['"]?\s*\+\s*stageIndex\s*\+\s*['"]?\s*<\/span>/,
        'my-trees-preview-hub.js must render flow stages with a numeric stageIndex span'
    );
});

test('My Trees hydrated flow stages use numeric index (no emoji icon)', () => {
    assert.match(
        myTreesStateJs,
        /<span class="my-trees-hub-flow-stage-index">\s*'\s*\+\s*\w+\s*\+\s*'<\/span>/,
        'buildHydratedFlowStages must use the numeric index class (source uses string concatenation)'
    );
    assert.ok(
        !/my-trees-hub-flow-stage-icon/.test(myTreesStateJs),
        'buildHydratedFlowStages must NOT emit .my-trees-hub-flow-stage-icon (no emoji)'
    );
    assert.ok(
        !/\['🌱',\s*'🌿',\s*'🌳',\s*'🌸'\]/.test(myTreesStateJs),
        'buildHydratedFlowStages must NOT carry the legacy emoji array'
    );
});

// ── 3) Flow toggle is an interactive button (not a static span) ───────
test('My Trees hub renderer emits a <button data-my-trees-flow-toggle>', () => {
    assert.match(
        myTreesHubJs,
        /<button[^>]*class=["']my-trees-hub-flow-toggle["'][^>]*data-my-trees-flow-toggle/,
        'my-trees-preview-hub.js must emit an interactive button for the flow toggle'
    );
});

test('My Trees hydrated flow toggle is an interactive button (not static span)', () => {
    assert.match(
        myTreesStateJs,
        /<button[^>]*class=["']my-trees-hub-flow-toggle["'][^>]*data-my-trees-flow-toggle/,
        'my-trees-preview-state.js must emit an interactive button for the flow toggle'
    );
    assert.ok(
        !/my-trees-hub-flow-toggle is-static/.test(myTreesStateJs),
        'my-trees-preview-state.js must NOT emit the legacy static <span class="my-trees-hub-flow-toggle is-static">'
    );
});

// ── 4) Flow card uses Browse flat surface ─────────────────────────────
test('My Trees flow card uses Browse-style flat surface (no gradient/border/shadow)', () => {
    const re = /\.my-trees-hub-flow\s*\{[^}]*background:\s*var\(--surface-container-low\)[^}]*\}/s;
    assert.match(
        myTreesFlowCss,
        re,
        'My Trees .my-trees-hub-flow must use var(--surface-container-low) like Browse'
    );
});

test('My Trees flow card does NOT carry the legacy gradient/border/box-shadow', () => {
    // The legacy My Trees flow card rule had:
    //   background: linear-gradient(...)
    //   border: 1px solid rgba(144, 73, 81, 0.10)
    //   box-shadow: 0 14px 28px ...
    const rule = /\.my-trees-hub-flow\s*\{[^}]*\}/s;
    const match = myTreesFlowCss.match(rule);
    assert.ok(match, 'rule must exist');
    const block = match[0];
    assert.ok(
        !/linear-gradient/.test(block),
        'flow card must not use linear-gradient (legacy richer surface)'
    );
    assert.ok(
        !/border:\s*1px solid/.test(block),
        'flow card must not have a heavy 1px border (Browse parity)'
    );
    assert.ok(
        !/box-shadow:/.test(block),
        'flow card must not carry a heavy box-shadow (Browse parity)'
    );
});

// ── 5) Primary button label parity: 트리 열기 + account_tree ────────────
test('My Trees primary button HTML placeholder is "트리 열기" + account_tree', () => {
    assert.match(
        myTreesHtml,
        /id=["']myTreesHubOpenBtn["'][\s\S]*?account_tree[\s\S]*?트리\s*열기/,
        'My Trees primary action must show account_tree icon + "트리 열기" label in HTML placeholder'
    );
});

test('My Trees primary button JS sets "트리 열기" + account_tree icon', () => {
    // The runtime label is set via i18nHub('', '트리 열기', 'Open tree').
    // Both strings must appear together in the runtime-rendering snippet,
    // separated by the + concatenation operator. Match a permissive
    // pattern across line breaks / whitespace.
    const runtimeSnippet = /account_tree<\/span>'\s*\+\s*[\s\S]{0,500}?'트리\s*열기'/;
    assert.match(
        myTreesHubJs,
        runtimeSnippet,
        'My Trees primary action must render account_tree icon + "트리 열기" label at runtime (concatenated template)'
    );
    assert.ok(
        !/i18nHub\('',\s*'감상\s*열기'/.test(myTreesHubJs),
        'Legacy "감상 열기" label must not return after Step 5'
    );
});

// ── 6) Social shell parity on My Trees ─────────────────────────────────
test('My Trees hub manifest imports search-preview-social-bar.css', () => {
    assert.match(
        myTreesHubManifest,
        /@import url\(['"]\.\.\/\.\.\/search\/search-preview-social-bar\.css['"]\)/,
        'My Trees hub manifest must import the shared social-bar CSS'
    );
});

test('My Trees hub renders .preview-social-shell (owner passive) BELOW action buttons', () => {
    // Step 7 follow-up: the social shell must sit below the action buttons
    // (after #myTreesHubActions) so the primary "트리 열기" button is the
    // last interactive element above the social stats. The legacy placement
    // (appended to #myTreesHubDetails) is retired.
    assert.match(
        myTreesHubJs,
        /className\s*=\s*['"]preview-social-shell['"]/,
        'My Trees hub renderer must create a .preview-social-shell element'
    );
    assert.match(
        myTreesHubJs,
        /<div class="preview-social-bar"/,
        'My Trees hub renderer must emit a .preview-social-bar div in the template'
    );
    assert.match(
        myTreesHubJs,
        /els\.actions\.after\(\s*shell\s*\)/,
        'My Trees social shell must be inserted AFTER els.actions (#myTreesHubActions) so it sits below the 트리 열기 button'
    );
    assert.ok(
        !/els\.details\.appendChild\(\s*shell\s*\)/.test(myTreesHubJs),
        'Legacy appendChild to els.details must not return (was placing shell above the action buttons)'
    );
});

test('My Trees hub social bar renders all four Browse-parity stat items', () => {
    const shellBlockRe = /data-my-trees-social-shell[\s\S]*?preview-social-bar[\s\S]*?(좋아요|댓글|공유|조회수)/g;
    assert.match(myTreesHubJs, shellBlockRe);
    const expectedLabels = ['좋아요', '댓글', '공유', '조회수'];
    for (const label of expectedLabels) {
        assert.match(
            myTreesHubJs,
            new RegExp(label),
            `My Trees social shell must include "${label}" stat`
        );
    }
});

test('My Trees hub does not keep the legacy duplicate static meta row', () => {
    assert.doesNotMatch(
        myTreesHtml,
        /id=["']myTreesHubMeta["']/,
        'Legacy #myTreesHubMeta row must not render above the Browse-parity social shell'
    );
    assert.doesNotMatch(
        myTreesHubJs,
        /myTreesHubMeta(?:Views|Likes|Comments|Shares)?Count|metaBlock|metaViewsCount|metaLikesCount|metaCommentsCount|metaSharesCount/,
        'My Trees hub JS must not repopulate the removed duplicate static meta row'
    );
});

test('My Trees social shell uses Browse parity class .preview-social-stat', () => {
    // All four stats must be tagged with the shared .preview-social-stat class
    const occurrences = (myTreesHubJs.match(/preview-social-stat/g) || []).length;
    assert.ok(
        occurrences >= 4,
        `My Trees social shell must tag all 4 stats with .preview-social-stat (got ${occurrences})`
    );
});

test('Search preview-social-bar.css still defines shared .preview-social-shell + .preview-social-bar', () => {
    // Defensive: the imported CSS must still exist and define the shared classes
    assert.match(searchSocialBarCss, /\.preview-social-shell\s*\{/);
    assert.match(searchSocialBarCss, /\.preview-social-bar\s*\{/);
    assert.match(searchSocialBarCss, /\.preview-social-action\s*\{/);
    // preview-social-stat is a *modifier* class composed on .preview-social-action.
    // The class is declared by JS (search-preview-hub-dom-patch.js) and our
    // My Trees owner-passive render, then styled by the .preview-social-action
    // rule itself. Verify the import path is consistent and that the shared
    // CSS provides the action baseline.
    assert.ok(
        /\.preview-social-action/.test(searchSocialBarCss),
        'search-preview-social-bar.css must define the .preview-social-action baseline'
    );
    assert.match(
        searchSocialBarCss,
        /\[disabled\]/,
        'search-preview-social-bar.css must keep the disabled state styling'
    );
});
