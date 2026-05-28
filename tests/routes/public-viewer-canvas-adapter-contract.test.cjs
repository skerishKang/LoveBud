const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');

function getViewHtml() {
  return fs.readFileSync('pages/view.html', 'utf8');
}

function getScriptSrcs() {
  const html = getViewHtml();
  return [...html.matchAll(/<script(?:\s+type="module")?\s+src="([^"]+)"/g)].map((match) => match[1]);
}

function stripVersion(src) {
  return String(src || '').split('?')[0];
}

function scriptIndex(scripts, needle) {
  return scripts.findIndex((src) => stripVersion(src).includes(needle));
}

function assertScriptOrder(scripts, beforeNeedle, afterNeedle) {
  const beforeIndex = scriptIndex(scripts, beforeNeedle);
  const afterIndex = scriptIndex(scripts, afterNeedle);
  assert.notEqual(beforeIndex, -1, `missing script: ${beforeNeedle}`);
  assert.notEqual(afterIndex, -1, `missing script: ${afterNeedle}`);
  assert.ok(beforeIndex < afterIndex, `${beforeNeedle} must load before ${afterNeedle}`);
}

test('public viewer canvas adapter script order in view.html', () => {
  const scripts = getScriptSrcs();

  assertScriptOrder(scripts, 'js/viewer/public-viewer-canvas-entry.js', 'js/viewer/public-viewer-canvas-adapter.js');
  assertScriptOrder(scripts, 'js/viewer/public-viewer-canvas-adapter.js', 'js/viewer/public-canvas-init.js');
});

test('public viewer canvas adapter implementation contract', () => {
  const adapterSrc = fs.readFileSync('js/viewer/public-viewer-canvas-adapter.js', 'utf8');

  assert.ok(adapterSrc.includes('LoveBudPublicViewerCanvasAdapter'), 'adapter must define LoveBudPublicViewerCanvasAdapter namespace');
  assert.ok(adapterSrc.includes('createPublicViewerCanvas'), 'adapter must define createPublicViewerCanvas helper');
  assert.ok(adapterSrc.includes('Object.freeze'), 'adapter must freeze exported namespace');
  assert.equal(adapterSrc.includes('innerHTML'), false, 'adapter must not use innerHTML');
});

test('public canvas init references the viewer canvas adapter', () => {
  const initSrc = fs.readFileSync('js/viewer/public-canvas-init.js', 'utf8');

  assert.ok(initSrc.includes('LoveBudPublicViewerCanvasAdapter'), 'public canvas init must reference LoveBudPublicViewerCanvasAdapter');
  assert.ok(initSrc.includes('createPublicViewerCanvas'), 'public canvas init must call createPublicViewerCanvas');
  assert.ok(initSrc.includes('window.createEditorCanvas'), 'public canvas init must keep window.createEditorCanvas fallback');
});
