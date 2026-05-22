const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const vm = require('vm');

function loadHooks() {
    const dtScript = fs.readFileSync('js/viewer/viewer-data-transform.js', 'utf8');
    const script = fs.readFileSync('js/viewer/tree-viewer.js', 'utf8');
    const window = {
        __LOVE_BUD_TREE_VIEWER_TEST_HOOKS__: true,
        __LOVE_BUD_TREE_VIEWER_SKIP_INIT__: true,
        i18nViewer: {},
        i18n: { currentLang: 'en' },
        location: { href: 'https://example.test/pages/tree.html', search: '?treeId=public-route-ref' }
    };
    window.window = window;

    var routeScript = fs.readFileSync('js/viewer/viewer-route.js', 'utf8');
    vm.runInNewContext(routeScript, {
        URLSearchParams,
        window,
        console,
        setTimeout,
        clearTimeout
    });
    vm.runInNewContext(dtScript, {
        window,
        console,
        setTimeout,
        clearTimeout
    });
    var rsScript = fs.readFileSync('js/viewer/viewer-render-state.js', 'utf8');
    vm.runInNewContext(rsScript, {
        window,
        console,
        setTimeout,
        clearTimeout
    });
    var shellScript = fs.readFileSync('js/viewer/viewer-shell-render.js', 'utf8');
    vm.runInNewContext(shellScript, {
        window,
        console,
        setTimeout,
        clearTimeout
    });
    var hooksScript = fs.readFileSync('js/viewer/viewer-test-hooks.js', 'utf8');
    vm.runInNewContext(hooksScript, {
        window,
        console,
        setTimeout,
        clearTimeout
    });
    var initScript = fs.readFileSync('js/viewer/viewer-init-flow.js', 'utf8');
    vm.runInNewContext(initScript, {
        window,
        console,
        setTimeout,
        clearTimeout
    });
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

test('viewer route helper is exposed for route tests', () => {
    const hooks = loadHooks();
    assert.equal(typeof hooks.getTreeId, 'function');
    assert.equal(hooks.getTreeId({ search: '?treeId=public-route-ref' }), 'public-route-ref');
});

test('viewer shell render helper is exposed for route tests', () => {
    const hooks = loadHooks();
    assert.equal(typeof hooks.renderShell, 'function');
});