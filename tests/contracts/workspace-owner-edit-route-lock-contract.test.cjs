const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const ROOT = path.resolve(__dirname, '..', '..');

function loadScript(filePath) {
  const source = fs.readFileSync(path.join(ROOT, filePath), 'utf8');
  return source;
}

test('editor.js does not contain forced home redirect in auth callback', () => {
  const source = loadScript('js/editor.js');
  
  // Verify that the redirect to my-trees is gone
  assert.ok(!source.includes('window.location.href = myTreesHref'), 'Should not find forced redirect to myTreesHref in editor.js');
  
  // Verify that the callback registration for auth-ready redirect is gone
  assert.ok(!source.includes('_editorAuthEditabilityCallbackRegistered'), 'Should not find _editorAuthEditabilityCallbackRegistered in editor.js');
  assert.ok(!source.includes('window.registerOnAuthReady(function(authUser)'), 'Should not find auth-ready callback registration in editor.js');
});

test('login redirect preserves full editor target query', () => {
  const helpersSource = loadScript('js/editor/editor-page-helpers.js');
  const context = {
    window: {
      location: {
        pathname: '/pages/editor',
        search: '?treeId=tree123&memoryId=mem456&mode=edit',
        origin: 'http://localhost'
      }
    }
  };
  vm.runInNewContext(helpersSource, context);
  
  const target = context.window.LoveBudEditorPageHelpers.buildEditorRedirectTarget();
  assert.match(target, /editor\?treeId=tree123&memoryId=mem456&mode=edit/);
});

function extractNavigateToEditor(source) {
  const match = source.match(/var navigateToEditor = function\(\)\s*\{[\s\S]*?\n\s*\};/);
  assert.ok(match, 'navigateToEditor function should exist in public-canvas-init.js');
  return match[0];
}

function execNavigateToEditor({ pathname, origin, treeId, memoryId }) {
  const source = loadScript('js/viewer/public-canvas-init.js');
  const navSource = extractNavigateToEditor(source);
  const context = {
    window: {
      location: {
        pathname: pathname,
        origin: origin,
        href: ''
      }
    },
    treeData: treeId ? { id: treeId } : null,
    selectionState: {
      getSelectedNodeId: () => memoryId || ''
    },
    encodeURIComponent: encodeURIComponent
  };
  const factorySrc = '(function() { ' + navSource + ' return navigateToEditor; })';
  const factory = vm.runInNewContext(factorySrc, context);
  const navigateToEditor = factory();
  navigateToEditor();
  return context.window.location.href;
}

test('owner edit target resolves page-relative in /pages/ context', () => {
  const href = execNavigateToEditor({
    pathname: '/pages/view',
    origin: 'https://lovebud.pages.dev',
    treeId: 'tree123',
    memoryId: 'mem456'
  });
  assert.equal(href, 'editor?treeId=tree123&mode=edit&memoryId=mem456');
});

test('owner edit target resolves page-relative in root context', () => {
  const href = execNavigateToEditor({
    pathname: '/view',
    origin: 'https://lovebud.pages.dev',
    treeId: 'tree123',
    memoryId: 'mem456'
  });
  assert.equal(href, 'pages/editor?treeId=tree123&mode=edit&memoryId=mem456');
});

test('owner edit target is not origin-rooted /editor? form', () => {
  const source = loadScript('js/viewer/public-canvas-init.js');
  const navSource = extractNavigateToEditor(source);
  assert.ok(!/window\.location\.origin\s*\+\s*['"]\/['"]/.test(navSource),
    'navigateToEditor must not use window.location.origin + "/" prefix');
  assert.ok(!/\/editor\?/.test(navSource),
    'navigateToEditor must not target an absolute /editor? route');
  assert.ok(/basePath\s*\+\s*['"]editor\?['"]/.test(navSource),
    'navigateToEditor must use page-relative basePath + "editor?" form');
});

test('owner edit target omits memoryId when none selected', () => {
  const href = execNavigateToEditor({
    pathname: '/pages/view',
    origin: 'https://lovebud.pages.dev',
    treeId: 'tree123',
    memoryId: ''
  });
  assert.equal(href, 'editor?treeId=tree123&mode=edit');
});
