const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');

function getScriptSrcs() {
  const html = fs.readFileSync('pages/view.html', 'utf8');
  return [...html.matchAll(/<script(?:\s+type="module")?\s+src="([^"]+)"/g)].map((match) => match[1]);
}

function stripVersion(src) {
  return String(src || '').split('?')[0];
}

function scriptIncludes(scripts, needle) {
  return scripts.some((src) => stripVersion(src).includes(needle));
}

function scriptIndex(scripts, needle) {
  return scripts.findIndex((src) => stripVersion(src).includes(needle));
}

test('public view keeps root helpers but avoids editor form utility script', () => {
  const scripts = getScriptSrcs();

  assert.ok(
    scriptIncludes(scripts, 'js/editor/editor-root-helpers.js'),
    'view.html must keep editor-root-helpers while public canvas memory/root helpers still depend on LoveBudEditorUtils'
  );
  assert.equal(
    scriptIncludes(scripts, 'js/editor/editor-utils.js'),
    false,
    'view.html must not load editor-utils.js because it only contributes editor-form utility helpers to this route'
  );
  assert.ok(
    scriptIndex(scripts, 'js/editor/editor-root-helpers.js') < scriptIndex(scripts, 'js/viewer/public-canvas-init.js'),
    'editor-root-helpers must load before public canvas init'
  );
});

test('editor utils still owns only editor-specific youtube input helper', () => {
  const editorUtilsSrc = fs.readFileSync('js/editor/editor-utils.js', 'utf8');

  assert.ok(
    editorUtilsSrc.includes('getYouTubeInputErrorMessage'),
    'editor-utils.js should remain scoped to editor-form youtube input messaging'
  );
  assert.equal(
    editorUtilsSrc.includes('getCanonicalRootId'),
    false,
    'editor-utils.js must not own public canvas root selection helpers'
  );
  assert.equal(
    editorUtilsSrc.includes('isRootMemory'),
    false,
    'editor-utils.js must not own public canvas root memory checks'
  );
});
