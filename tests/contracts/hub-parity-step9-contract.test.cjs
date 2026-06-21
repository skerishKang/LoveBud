/**
 * LoveBud Hub Parity Step 9 — Contract Test
 *
 * Locks the post-Step 9 hub parity invariants for the moment-flow
 * region + social bar:
 *
 *   1. My Trees flow stage HTML directly carries role="button" +
 *      tabindex="0" + is-active on the first stage (Browse parity
 *      from initial render, not just after enhance() runs)
 *   2. My Trees flow stage has cursor: pointer on hover (the JS
 *      already adds role/tabindex, but a CSS hover affordance
 *      makes it discoverable)
 *   3. Both Browse and My Trees flow stages have :hover and
 *      .is-active visual states (so the user can see which moment
 *      is currently selected in the video)
 *   4. My Trees social shell no longer carries the "공유" stat that
 *      Browse does not have. Browse has 3 stats (조회수 / 좋아요 /
 *      댓글); My Trees now matches.
 *   5. The legacy data-my-trees-social-shares selector is gone.
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
const browseFlowCss = fs.readFileSync(
    path.join(ROOT, 'css/search/search-preview-sidebar/flow.css'),
    'utf8'
);

// ── 1) Initial rendered HTML carries Browse-parity attributes ─────────
test('My Trees hub renderer emits role="button" + tabindex="0" on every stage', () => {
    // The stage tag is built via JS string concatenation. The contract
    // here checks the source template, not the runtime output.
    assert.match(
        myTreesHubJs,
        /<span class="my-trees-hub-flow-stage' \+ activeClass \+ '" role="button" tabindex="0" data-my-trees-moment-index="' \+ stageIndex \+ '">/,
        'buildFlowStages must include role="button" tabindex="0" data-my-trees-moment-index on every stage (initial HTML parity)'
    );
});

test('My Trees hub renderer applies is-active to the first stage', () => {
    // The class string concatenation is " + activeClass + '" where
    // activeClass is " is-active" for the first stage.
    assert.match(
        myTreesHubJs,
        /var\s+activeClass\s*=\s*\(stageIndex\s*===\s*1\)\s*\?\s*['"]\s*is-active['"]\s*:\s*['"]\s*['"]\s*;/,
        'buildFlowStages must set activeClass to " is-active" for the first stage'
    );
});

test('My Trees hydrated flow stages also emit role + tabindex + is-active', () => {
    assert.match(
        myTreesStateJs,
        /<span class="my-trees-hub-flow-stage' \+ activeClass \+ '" role="button" tabindex="0" data-my-trees-moment-index="' \+ stageIndex \+ '">/,
        'my-trees-preview-state.js hydrated stages must include role + tabindex'
    );
    assert.match(
        myTreesStateJs,
        /var\s+activeClass\s*=\s*\(index\s*===\s*0\)\s*\?\s*['"]\s*is-active['"]\s*:\s*['"]\s*['"]\s*;/,
        'my-trees-preview-state.js must apply is-active to the first stage (index === 0)'
    );
});

// ── 2) CSS hover affordance (Browse + My Trees) ───────────────────────
test('My Trees flow stage has cursor: pointer for click affordance', () => {
    const block = (myTreesFlowCss.match(/\.my-trees-hub-flow-stage\s*\{[^}]*\}/s) || [''])[0];
    assert.match(
        block,
        /cursor:\s*pointer/,
        'My Trees .my-trees-hub-flow-stage must have cursor: pointer to advertise clickability'
    );
});

test('My Trees flow stage has :hover visual state', () => {
    assert.match(
        myTreesFlowCss,
        /\.my-trees-hub-flow-stage:hover\s*\{/,
        'My Trees .my-trees-hub-flow-stage must have a :hover rule (visual affordance on hover)'
    );
});

test('My Trees flow stage has .is-active visual state', () => {
    assert.match(
        myTreesFlowCss,
        /\.my-trees-hub-flow-stage\.is-active\s*\{/,
        'My Trees .my-trees-hub-flow-stage must have a .is-active rule (so the currently-shown moment is visually indicated)'
    );
});

test('Browse flow stage has :hover and .is-active visual states', () => {
    assert.match(
        browseFlowCss,
        /\.preview-flow-stage:hover\s*\{/,
        'Browse .preview-flow-stage must have a :hover rule (Step 9 parity addition)'
    );
    assert.match(
        browseFlowCss,
        /\.preview-flow-stage\.is-active\s*\{/,
        'Browse .preview-flow-stage must have a .is-active rule (Step 9 parity addition)'
    );
});

// ── 3) Social bar parity: My Trees removed "공유" ──────────────────────
test('My Trees social shell no longer contains the "공유" (share) stat', () => {
    // The share stat block emitted a div with aria-label="공유" and a
    // share icon. Both must be gone.
    assert.ok(
        !/aria-label="공유"/.test(myTreesHubJs),
        'My Trees social shell must NOT carry aria-label="공유" (Browse parity — Browse does not have a share stat)'
    );
    assert.ok(
        !/data-my-trees-social-shares/.test(myTreesHubJs),
        'My Trees social shell must NOT carry the legacy data-my-trees-social-shares selector'
    );
    assert.ok(
        !/<span>공유<\/span>/.test(myTreesHubJs),
        'My Trees social shell must NOT emit the <span>공유</span> label'
    );
});

test('My Trees social shell keeps the 3 Browse-parity stats (좋아요 / 댓글 / 조회수)', () => {
    // The shell should still have 좋아요, 댓글, 조회수 — just not 공유.
    const requiredLabels = ['좋아요', '댓글', '조회수'];
    for (const label of requiredLabels) {
        assert.match(
            myTreesHubJs,
            new RegExp(`<span>${label}</span>`),
            `My Trees social shell must still include "${label}" stat`
        );
    }
});
