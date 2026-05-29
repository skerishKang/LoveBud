const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');

const treeMetaSrc = fs.readFileSync('js/viewer/public-viewer-detail-tree-meta.js', 'utf8').replace(/\r/g, '');
const buildersSrc = fs.readFileSync('js/viewer/public-viewer-detail-builders.js', 'utf8').replace(/\r/g, '');
const detailUiSrc = fs.readFileSync('js/viewer/public-viewer-detail-ui.js', 'utf8').replace(/\r/g, '');

test('public viewer detail tree meta exposes viewer-named helper with legacy alias', () => {
  assert.ok(
    treeMetaSrc.includes('function createPublicViewerDetailTreeMetaBoundary'),
    'public viewer tree meta helper must use a viewer-named factory'
  );
  assert.ok(
    treeMetaSrc.includes('window.createPublicViewerDetailTreeMetaBoundary = createPublicViewerDetailTreeMetaBoundary'),
    'public viewer tree meta helper must expose the viewer-named global factory'
  );
  assert.ok(
    treeMetaSrc.includes('const createEditorDetailTreeMetaBoundary = createPublicViewerDetailTreeMetaBoundary'),
    'legacy editor-named tree meta factory must delegate to the viewer-named factory'
  );
  assert.ok(
    treeMetaSrc.includes('createPublicViewerDetailTreeMetaBoundary,\n        createEditorDetailTreeMetaBoundary'),
    'public viewer tree meta namespace must expose both viewer and legacy factory aliases'
  );
});

test('public viewer detail builders expose viewer-named helper with legacy alias', () => {
  assert.ok(
    buildersSrc.includes('function createPublicViewerDetailUIBuilders'),
    'public viewer detail builders must use a viewer-named factory'
  );
  assert.ok(
    buildersSrc.includes('window.createPublicViewerDetailUIBuilders = createPublicViewerDetailUIBuilders'),
    'public viewer detail builders must expose the viewer-named global factory'
  );
  assert.ok(
    buildersSrc.includes('const createEditorDetailUIBuilders = createPublicViewerDetailUIBuilders'),
    'legacy editor-named builder factory must delegate to the viewer-named factory'
  );
  assert.ok(
    buildersSrc.includes('createPublicViewerDetailUIBuilders,\n        createEditorDetailUIBuilders'),
    'public viewer detail builder namespace must expose both viewer and legacy factory aliases'
  );
});

test('public viewer detail UI remains viewer-owned and does not delegate to editor detail UI', () => {
  assert.ok(
    detailUiSrc.includes('window.createPublicViewerDetailUI = createPublicViewerDetailUI'),
    'public viewer detail UI must continue to expose its viewer-owned entrypoint'
  );
  assert.ok(
    detailUiSrc.includes('delegatesToEditorDetailUI: false'),
    'public viewer detail UI must remain detached from editor detail UI delegation'
  );
});

test('public viewer detail UI prefers viewer-named helper aliases before legacy aliases', () => {
  assert.ok(
    detailUiSrc.includes('window.createPublicViewerDetailUIBuilders'),
    'public viewer detail UI should prefer the viewer-named detail builder factory'
  );
  assert.ok(
    detailUiSrc.includes('window.createPublicViewerDetailTreeMetaBoundary'),
    'public viewer detail UI should prefer the viewer-named tree meta factory'
  );
  assert.ok(
    detailUiSrc.includes('window.createEditorDetailUIBuilders'),
    'public viewer detail UI should keep the legacy builder fallback while compatibility alias remains'
  );
  assert.ok(
    detailUiSrc.includes('window.createEditorDetailTreeMetaBoundary'),
    'public viewer detail UI should keep the legacy tree meta fallback while compatibility alias remains'
  );
});
