const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const vm = require('vm');

function loadShareActions(options = {}) {
    const source = fs.readFileSync('js/viewer/share-actions.js', 'utf8');
    const state = {
        copied: null,
        opened: null,
        nativePayload: null,
        downloaded: null
    };
    const fakeContext = {
        createLinearGradient: function() {
            return { addColorStop: function() {} };
        },
        fillRect: function() {},
        beginPath: function() {},
        moveTo: function() {},
        lineTo: function() {},
        quadraticCurveTo: function() {},
        fill: function() {},
        stroke: function() {},
        fillText: function() {},
        arc: function() {},
        measureText: function(text) {
            return { width: String(text || '').length * 18 };
        }
    };
    const context = {
        URL,
        Promise,
        window: {
            location: { href: options.href || 'https://lovebud.pages.dev/pages/tree?treeId=public-route-ref#selected' },
            LoveBudVisitorViewerData: options.viewerData || {
                tree: { title: '공개 러브트리' }
            },
            URL: options.windowURL || URL,
            open: options.open || function(url) {
                state.opened = url;
                return {};
            }
        },
        navigator: {
            clipboard: options.clipboard === false ? null : {
                writeText: async function(value) {
                    state.copied = value;
                }
            },
            share: options.share || undefined
        },
        document: {
            title: '러브트리',
            createElement: function(tagName) {
                if (tagName === 'canvas' && options.canvasExport) {
                    return {
                        width: 0,
                        height: 0,
                        getContext: function() { return fakeContext; },
                        toBlob: function(callback) { callback({ size: 1, type: 'image/png' }); }
                    };
                }
                if (tagName === 'a') {
                    return {
                        href: '',
                        download: '',
                        click: function() { state.downloaded = this.download; }
                    };
                }
                return { style: {}, select: function() {} };
            },
            body: {
                appendChild: function() {},
                removeChild: function() {}
            },
            execCommand: function() {
                return true;
            }
        }
    };
    context.window.window = context.window;
    vm.runInNewContext(source, context);
    return { Share: context.window.LoveBudShareActions, state, context };
}

test('share actions module exists', () => {
    assert.ok(fs.existsSync('js/viewer/share-actions.js'), 'js/viewer/share-actions.js must exist');
});

test('share actions module has expected API', () => {
    const content = fs.readFileSync('js/viewer/share-actions.js', 'utf8');
    assert.ok(content.includes('LoveBudShareActions'), 'must expose LoveBudShareActions');
    assert.ok(content.includes('copyLink'), 'must expose copyLink');
    assert.ok(content.includes('nativeShare'), 'must expose nativeShare');
    assert.ok(content.includes('getPlatformIntent'), 'must expose platform intent builder');
    assert.ok(content.includes('shareToPlatform'), 'must expose platform share action');
    assert.ok(content.includes('getTreeCardPayload'), 'must expose tree image card payload builder');
    assert.ok(content.includes('exportTreeImageCard'), 'must expose tree image card export action');
    assert.ok(content.includes('navigator.clipboard') || content.includes('execCommand'), 'must handle clipboard');
});

test('share panel has actionable buttons', () => {
    const panels = fs.readFileSync('js/visitor-viewer/visitor-viewer-panels.js', 'utf8');
    assert.ok(panels.includes('data-action="copy-link"'), 'share panel must have copy-link button');
    assert.ok(panels.includes('data-action="export-tree-card"'), 'share panel must have tree image card export button');
    assert.ok(panels.includes('data-action="native-share"'), 'share panel must have native-share button');
    assert.ok(panels.includes('data-action="platform-share"'), 'share panel must have platform share buttons');
    assert.ok(panels.includes('data-platform="x"'), 'share panel must include X intent');
    assert.ok(panels.includes('data-platform="facebook"'), 'share panel must include Facebook intent');
    assert.ok(panels.includes('data-platform="email"'), 'share panel must include email intent');
    assert.ok(panels.includes('vvShareStatus'), 'share panel must have status area');
});

test('tree route loads share actions before tree viewer', () => {
    const html = fs.readFileSync('pages/tree.html', 'utf8');
    const shareActionsIndex = html.indexOf('../js/viewer/share-actions.js');
    const treeViewerIndex = html.indexOf('../js/viewer/tree-viewer.js');
    assert.notEqual(shareActionsIndex, -1, 'tree.html must load share-actions.js');
    assert.notEqual(treeViewerIndex, -1, 'tree.html must load tree-viewer.js');
    assert.ok(shareActionsIndex < treeViewerIndex, 'share-actions.js must load before tree-viewer.js');
});

test('tree-viewer handles share actions', () => {
    const viewer = fs.readFileSync('js/viewer/tree-viewer.js', 'utf8');
    assert.ok(viewer.includes('copy-link') || viewer.includes('copyLink'), 'tree-viewer must handle copy-link');
    assert.ok(viewer.includes('native-share') || viewer.includes('nativeShare'), 'tree-viewer must handle native-share');
    assert.ok(viewer.includes('platform-share') || viewer.includes('platformShare'), 'tree-viewer must handle platform-share');
    assert.ok(viewer.includes('export-tree-card') || viewer.includes('exportTreeImageCard'), 'tree-viewer must handle tree image card export');
    assert.ok(viewer.includes('showShareStatus'), 'tree-viewer must have share status feedback');
});

test('share actions module does not expose private identifiers', () => {
    const content = fs.readFileSync('js/viewer/share-actions.js', 'utf8');
    const privatePatterns = ['ownerId', 'owner_id', 'memoryId', 'memory_id', 'treeId', 'tree_id'];
    const matches = privatePatterns.filter(p => content.match(new RegExp(p, 'i')));
    assert.equal(matches.length, 0, 'share actions must not reference private identifiers: ' + matches.join(', '));
});

test('viewer route does not load Editor/Builder scripts', () => {
    const html = fs.readFileSync('pages/tree.html', 'utf8');
    const noEditorScript = !html.includes('js/editor.js') && !html.includes('pages/editor.html');
    assert.ok(noEditorScript, 'tree.html must not load editor entry script');
});

test('share module uses window.location.href without exposing raw values', () => {
    const content = fs.readFileSync('js/viewer/share-actions.js', 'utf8');
    assert.ok(content.includes('window.location.href'), 'share module must use current page URL');
    assert.ok(!content.includes('treeId='), 'share module must not hardcode treeId in source');
});

test('platform intent builder uses public viewer route shape', () => {
    const { Share } = loadShareActions();
    const intent = Share.getPlatformIntent('x');
    const target = new URL(intent.url);
    const shared = new URL(target.searchParams.get('url'));

    assert.equal(target.origin + target.pathname, 'https://twitter.com/intent/tweet');
    assert.equal(shared.origin, 'https://lovebud.pages.dev');
    assert.equal(shared.pathname, '/pages/tree');
    assert.equal(shared.hash, '');
    assert.ok(shared.searchParams.has('treeId'), 'shared URL keeps current public viewer route parameter');
});

test('platform intents are limited to route URL and title text', () => {
    const { Share } = loadShareActions();
    const facebook = new URL(Share.getPlatformIntent('facebook').url);
    const email = Share.getPlatformIntent('email').url;

    assert.equal(facebook.origin + facebook.pathname, 'https://www.facebook.com/sharer/sharer.php');
    assert.equal(new URL(facebook.searchParams.get('u')).pathname, '/pages/tree');
    assert.match(email, /^mailto:\?subject=/);
    assert.ok(email.includes(encodeURIComponent('/pages/tree')), 'email body should include public viewer route');
});

test('unsupported platform falls back to canonical link copy', async () => {
    const { Share, state } = loadShareActions();
    const result = await Share.shareToPlatform(null, 'unsupported');

    assert.equal(result.success, true);
    assert.equal(state.copied, 'https://lovebud.pages.dev/pages/tree?treeId=public-route-ref');
});

test('existing link copy is preserved', async () => {
    const { Share, state } = loadShareActions();
    const result = await Share.copyLink();

    assert.equal(result.success, true);
    assert.equal(state.copied, 'https://lovebud.pages.dev/pages/tree?treeId=public-route-ref');
});

test('native share behavior is preserved when available', async () => {
    let nativePayload = null;
    const { Share } = loadShareActions({
        share: async function(payload) {
            nativePayload = payload;
        }
    });
    const result = await Share.nativeShare();

    assert.equal(result.success, true);
    assert.equal(nativePayload.title, '공개 러브트리');
    assert.equal(nativePayload.url, 'https://lovebud.pages.dev/pages/tree?treeId=public-route-ref');
});

test('tree image card payload uses public-safe viewer content only', () => {
    const { Share } = loadShareActions({
        viewerData: {
            tree: {
                title: '공개 러브트리',
                meta: '3개의 순간 · 공개 러브트리',
                ownerId: 'must-not-use-owner',
                treeId: 'must-not-use-tree'
            },
            rootSeed: {
                title: '시작된 순간',
                caption: '처음 이어진 공개 순간의 짧은 메모 https://private.example/raw'
            },
            branches: [{
                caption: '3개의 순간이 이어져 있어요',
                moments: [{ title: 'one' }, { title: 'two' }]
            }]
        }
    });

    const payload = Share.getTreeCardPayload();
    const exportText = Object.values(payload).join(' ');

    assert.equal(payload.title, '공개 러브트리');
    assert.equal(payload.meta, '3 public moments');
    assert.equal(payload.brand, 'LoveBud / LoveTree');
    assert.doesNotMatch(exportText, /must-not-use/);
    assert.doesNotMatch(exportText, /private\.example/);
});

test('tree image card export falls back to canonical link copy when canvas is unavailable', async () => {
    const { Share, state } = loadShareActions();
    const result = await Share.exportTreeImageCard();

    assert.equal(result.success, true);
    assert.equal(result.message, '링크를 복사했어요');
    assert.equal(state.copied, 'https://lovebud.pages.dev/pages/tree?treeId=public-route-ref');
});

test('tree image card export can save a client-side png without copying a link', async () => {
    const { Share, state } = loadShareActions({
        canvasExport: true,
        windowURL: {
            createObjectURL: function() { return 'blob:lovetree-card'; },
            revokeObjectURL: function() {}
        }
    });
    const result = await Share.exportTreeImageCard();

    assert.equal(result.success, true);
    assert.equal(result.message, '이미지 카드를 저장했어요');
    assert.match(state.downloaded, /-card\.png$/);
    assert.equal(state.copied, null);
});

test('tree image card export does not draw external images into canvas', () => {
    const content = fs.readFileSync('js/viewer/share-actions.js', 'utf8');
    assert.equal(content.includes('drawImage'), false, 'first slice must avoid external image draw paths');
});
