const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const vm = require('vm');

function loadHooks() {
    const script = fs.readFileSync('js/viewer/tree-viewer.js', 'utf8');
    const window = {
        __LOVE_BUD_TREE_VIEWER_TEST_HOOKS__: true,
        __LOVE_BUD_TREE_VIEWER_SKIP_INIT__: true,
        i18nViewer: {},
        i18n: { currentLang: 'en' },
        location: { href: 'https://example.test/pages/tree.html' }
    };
    window.window = window;

    vm.runInNewContext(script, {
        window,
        console,
        setTimeout,
        clearTimeout
    });

    return window.LoveBudTreeViewerTestHooks;
}

function memory(id, parentId, title) {
    return {
        id,
        parentId,
        title,
        emotionMemo: title + ' memo',
        emotionTags: ['tag'],
        visibility: 'public'
    };
}

test('linear public parent chain remains one main branch', () => {
    const hooks = loadHooks();
    const viewerData = hooks.buildBranches([
        memory('seed', null, 'Seed'),
        memory('first', 'seed', 'First'),
        memory('second', 'first', 'Second')
    ]);

    assert.equal(viewerData.branches.length, 1);
    assert.equal(viewerData.branches[0].id, 'main');
    assert.equal(viewerData.branches[0].moments.length, 3);
});

test('forked public parent relation derives conservative branch groups', () => {
    const hooks = loadHooks();
    const viewerData = hooks.buildBranches([
        memory('seed', null, 'Seed'),
        memory('left', 'seed', 'Left start'),
        memory('right', 'seed', 'Right start'),
        memory('left-child', 'left', 'Left child'),
        memory('right-child', 'right', 'Right child')
    ]);

    assert.equal(viewerData.branches.length, 2);
    assert.deepEqual(Array.from(viewerData.branches, (branch) => branch.name), ['Branch 1', 'Branch 2']);
    assert.deepEqual(
        Array.from(viewerData.branches, (branch) => Array.from(branch.moments, (moment) => moment.title)),
        [['Left start', 'Left child'], ['Right start', 'Right child']]
    );
    assert.equal(viewerData.rootSeed.branchId, 'branch-1');
});

test('missing public parent relation falls back to one main branch', () => {
    const hooks = loadHooks();
    const viewerData = hooks.buildBranches([
        memory('first', 'missing-parent', 'First'),
        memory('second', 'first', 'Second')
    ]);

    assert.equal(viewerData.branches.length, 1);
    assert.equal(viewerData.branches[0].id, 'main');
});
