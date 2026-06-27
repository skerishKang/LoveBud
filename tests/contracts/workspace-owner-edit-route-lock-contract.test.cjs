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
