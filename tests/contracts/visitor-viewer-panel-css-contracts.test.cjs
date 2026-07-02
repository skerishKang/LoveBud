const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');

const ROOT = path.resolve(__dirname, '..', '..');
const MANIFEST_PATH = path.join(ROOT, 'css/visitor-viewer/visitor-viewer-panel.css');
const PARENT_MANIFEST_PATH = path.join(ROOT, 'css/visitor-viewer.css');

test('visitor viewer panel css — manifest is under 20 lines', () => {
    const content = fs.readFileSync(MANIFEST_PATH, 'utf8');
    const lines = content.split('\n').length;
    assert.ok(lines <= 20, `Manifest should be <= 20 lines, but is ${lines} lines`);
});

test('visitor viewer panel css — manifest contains expected imports', () => {
    const content = fs.readFileSync(MANIFEST_PATH, 'utf8');
    const expectedImports = [
        './visitor-viewer-panel/panel-base.css',
        './visitor-viewer-panel/panel-header.css',
        './visitor-viewer-panel/branch-moments.css',
        './visitor-viewer-panel/moment-details.css',
        './visitor-viewer-panel/moment-actions.css',
        './visitor-viewer-panel/comments.css',
        './visitor-viewer-panel/sharing.css',
        './visitor-viewer-panel/navigation.css',
        './visitor-viewer-panel/icons.css'
    ];

    for (const file of expectedImports) {
        assert.match(content, new RegExp(`@import url\\(['"]${file}['"]\\);`), `Manifest must import ${file}`);
    }
});

test('visitor viewer panel css — split files exist and contain core selectors', () => {
    const files = {
        'panel-base.css': ['.vv-panel', '.vv-panel-empty'],
        'panel-header.css': ['.vv-panel-header', '.vv-panel-title'],
        'branch-moments.css': ['.vv-branch-moment-grid', '.vv-branch-moment-item'],
        'moment-details.css': ['.vv-moment-media', '.vv-moment-caption'],
        'moment-actions.css': ['.vv-moment-actions', '.vv-moment-action-btn', '.vv-moment-action-stat'],
        'comments.css': ['.vv-comment-input', '.vv-comment-list'],
        'sharing.css': ['.vv-share-preview', '.vv-share-actions'],
        'navigation.css': ['.vv-moment-nav', '.vv-sort-tabs'],
        'icons.css': ['.vv-icon']
    };

    for (const [filename, selectors] of Object.entries(files)) {
        const filepath = path.join(ROOT, `css/visitor-viewer/visitor-viewer-panel/${filename}`);
        assert.ok(fs.existsSync(filepath), `Split file ${filename} must exist`);
        
        const content = fs.readFileSync(filepath, 'utf8');
        for (const selector of selectors) {
            assert.ok(content.includes(selector), `${filename} must contain selector ${selector}`);
        }
        assert.ok(content.endsWith('\n'), `${filename} must have an EOF newline`);
    }
});

test('visitor viewer panel css — parent manifest reference is preserved', () => {
    const parentContent = fs.readFileSync(PARENT_MANIFEST_PATH, 'utf8');
    assert.match(parentContent, /@import url\(['"]\.\/visitor-viewer\/visitor-viewer-panel\.css['"]\);/, 'Parent manifest must still import the panel manifest');
});

// ── #3075 read-only social affordance contracts ─────────────────────────────

const PANELS_PATH = path.join(ROOT, 'js/visitor-viewer/visitor-viewer-panels.js');
const MOMENT_ACTIONS_CSS_PATH = path.join(ROOT, 'css/visitor-viewer/visitor-viewer-panel/moment-actions.css');

test('visitor viewer — moment panel social actions are read-only spans', () => {
    const panelsSource = fs.readFileSync(PANELS_PATH, 'utf8');

    // renderMomentPanel must not emit interactive buttons for like/comment
    assert.ok(
        !panelsSource.includes('data-action="moment-like"'),
        'renderMomentPanel must not emit interactive moment-like button'
    );
    assert.ok(
        !panelsSource.includes('data-action="moment-comment"'),
        'renderMomentPanel must not emit interactive moment-comment button'
    );

    // moment-share is dead (no handler) — must not be emitted
    assert.ok(
        !panelsSource.includes('data-action="moment-share"'),
        'renderMomentPanel must not emit dead moment-share button'
    );

    // export-moment-card is a real feature — preserved
    assert.ok(
        panelsSource.includes('data-action="export-moment-card"'),
        'renderMomentPanel must preserve real export-moment-card button'
    );

    // read-only stat spans must be present (without role="status")
    assert.ok(
        panelsSource.includes('vv-moment-action-stat'),
        'renderMomentPanel must use vv-moment-action-stat (non-interactive) for social summary'
    );
    assert.ok(
        !panelsSource.includes('role="status"'),
        'renderMomentPanel must not use role="status" on static read-only stats'
    );

    // read-only notes must be present
    assert.ok(
        panelsSource.includes('vv-moment-reactions-readonly-note'),
        'renderMomentPanel must include read-only note for reaction summary'
    );
    assert.ok(
        panelsSource.includes('vv-moment-comment-readonly-note'),
        'renderMomentPanel must include read-only note for comment section'
    );

    // comment input + submit must not be emitted in renderMomentPanel
    // (tree-level renderTreeCommentsPanel is separate — preserved as-is)
    const momentPanelStart = panelsSource.indexOf('function renderMomentPanel');
    const momentPanelEnd = panelsSource.indexOf('function renderTreeCommentsPanel');
    const momentPanelBody = panelsSource.slice(momentPanelStart, momentPanelEnd);
    assert.ok(
        !momentPanelBody.includes('vv-comment-input-field'),
        'renderMomentPanel must not emit comment input field (no mutation)'
    );
    assert.ok(
        !momentPanelBody.includes('vv-comment-submit'),
        'renderMomentPanel must not emit comment submit button (no mutation)'
    );

    // tree-level panel must preserve comment input (existing functionality)
    assert.ok(
        panelsSource.includes('vv-comment-input-field') && panelsSource.includes('vv-comment-submit'),
        'renderTreeCommentsPanel must still have comment input (tree-level existing feature)'
    );

    // fake hardcoded memo text must be removed
    assert.ok(
        !panelsSource.includes('처음으로 이 트리에 꽂아둔'),
        'renderMomentPanel must not contain hardcoded fake memo sample'
    );

    // CommentRow must preserve interactive buttons (shared with tree-level)
    assert.ok(
        panelsSource.includes('vv-comment-like-btn'),
        'CommentRow must preserve interactive vv-comment-like-btn button (shared with tree-level comments)'
    );
    assert.ok(
        panelsSource.includes('vv-comment-replies-btn'),
        'CommentRow must preserve interactive vv-comment-replies-btn button (shared with tree-level comments)'
    );

    // CommentRow must NOT use vv-comment-likes-stat (that was the old incorrect change)
    assert.ok(
        !panelsSource.includes('vv-comment-likes-stat'),
        'CommentRow must not use read-only vv-comment-likes-stat (tree-level needs buttons)'
    );
});

test('visitor viewer — no forbidden social action handlers wired in visitor-viewer.js', () => {
    const visitorSource = fs.readFileSync(path.join(ROOT, 'js/visitor-viewer/visitor-viewer.js'), 'utf8');

    // moment-level social actions must not be handled
    assert.ok(
        !visitorSource.includes('moment-like'),
        'visitor-viewer.js must not handle moment-like action'
    );
    assert.ok(
        !visitorSource.includes('moment-comment'),
        'visitor-viewer.js must not handle moment-comment action'
    );
    assert.ok(
        !visitorSource.includes('moment-share'),
        'visitor-viewer.js must not handle moment-share action'
    );
    assert.ok(
        !visitorSource.includes('export-moment'),
        'visitor-viewer.js must not handle export-moment action'
    );

    // Comment-level actions — CommentRow buttons are kept but handlers should
    // not be wired in visitor-viewer.js (they're read-only in moment panel)
    assert.ok(
        !visitorSource.includes('comment-like'),
        'visitor-viewer.js must not handle comment-like action'
    );
    assert.ok(
        !visitorSource.includes('show-replies'),
        'visitor-viewer.js must not handle show-replies action'
    );

    // tree-level dock actions (toggle-like, open-tree-comments, open-share) are preserved
    assert.ok(
        visitorSource.includes('toggle-like'),
        'tree-level toggle-like must remain for tree-level like button'
    );
    assert.ok(
        visitorSource.includes('open-tree-comments'),
        'tree-level open-tree-comments must remain'
    );
    assert.ok(
        visitorSource.includes('open-share'),
        'tree-level open-share must remain'
    );
});

test('visitor viewer — moment-actions.css has read-only stat styles and no hidden comment-row buttons', () => {
    const cssContent = fs.readFileSync(MOMENT_ACTIONS_CSS_PATH, 'utf8');

    // read-only stat selector must exist
    assert.ok(
        cssContent.includes('.vv-moment-action-stat'),
        'moment-actions.css must have .vv-moment-action-stat read-only style'
    );

    // read-only note styles must exist
    assert.ok(
        cssContent.includes('.vv-moment-reactions-readonly-note'),
        'moment-actions.css must have .vv-moment-reactions-readonly-note style'
    );
    assert.ok(
        cssContent.includes('.vv-moment-comment-readonly-note'),
        'moment-actions.css must have .vv-moment-comment-readonly-note style'
    );

    // vv-moment-action-stat must not have cursor:pointer
    const statBlock = cssContent.match(/\.vv-moment-action-stat\s*\{[\s\S]*?\}/);
    if (statBlock) {
        assert.ok(
            !statBlock[0].includes('cursor:pointer'),
            '.vv-moment-action-stat must not have cursor:pointer (not interactive)'
        );
    }

    // CSS must NOT hide comment-row buttons (they are functional in tree-level comments)
    // Only the keeb comment-row-related styles that were in the original commit
    // but are NOT needed now since CommentRow preserves buttons.
    assert.ok(
        !cssContent.includes('.vv-comment-like-btn'),
        'moment-actions.css must not hide .vv-comment-like-btn (tree-level CommentRow needs visible buttons)'
    );
    assert.ok(
        !cssContent.includes('.vv-comment-replies-btn'),
        'moment-actions.css must not hide .vv-comment-replies-btn (tree-level CommentRow needs visible buttons)'
    );

    assert.ok(
        cssContent.endsWith('\n'),
        'moment-actions.css must have an EOF newline'
    );
});
