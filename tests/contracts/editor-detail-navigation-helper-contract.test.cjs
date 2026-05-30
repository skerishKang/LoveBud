const assert = require('node:assert/strict');
const fs = require('node:fs');
const test = require('node:test');

const editorSource = fs.readFileSync('js/editor.js', 'utf8');
const pageHelpersSource = fs.readFileSync('js/editor/editor-page-helpers.js', 'utf8');
const editorHtml = fs.readFileSync('pages/editor.html', 'utf8');

function extractOpenCurrentMomentDetailBlock(source) {
  const marker = 'const openCurrentMomentDetail = () => {';
  const start = source.indexOf(marker);
  assert.notEqual(start, -1, 'openCurrentMomentDetail block must exist');

  const end = source.indexOf('            const updateTreeVisibility = async', start);
  assert.notEqual(end, -1, 'updateTreeVisibility marker must follow openCurrentMomentDetail');

  return source.slice(start, end);
}

test('editor page helpers expose moment detail navigation helpers', () => {
  assert.match(pageHelpersSource, /function buildMomentDetailHref\(options\)/);
  assert.match(pageHelpersSource, /function openMomentDetail\(options\)/);
  assert.match(pageHelpersSource, /buildMomentDetailHref:\s*buildMomentDetailHref/);
  assert.match(pageHelpersSource, /openMomentDetail:\s*openMomentDetail/);
});

test('moment detail href helper preserves editor detail url shape', () => {
  assert.match(pageHelpersSource, /'detail\.html\?id='/);
  assert.match(pageHelpersSource, /encodeURIComponent\(memoryId\)/);
  assert.match(pageHelpersSource, /'&tree='/);
  assert.match(pageHelpersSource, /encodeURIComponent\(treeId\)/);
  assert.match(pageHelpersSource, /'&from=editor'/);
  assert.match(pageHelpersSource, /basePathResolver\(\)/);
});

test('openMomentDetail delegates navigation through locationRef', () => {
  assert.match(pageHelpersSource, /var href\s*=\s*buildMomentDetailHref\(opts\)/);
  assert.match(pageHelpersSource, /var locationRef\s*=\s*opts\.locationRef\s*\|\|\s*window\.location/);
  assert.match(pageHelpersSource, /locationRef\.href\s*=\s*href/);
  assert.match(pageHelpersSource, /return href/);
});

test('editor openCurrentMomentDetail delegates href creation and navigation to page helper', () => {
  const block = extractOpenCurrentMomentDetailBlock(editorSource);

  assert.match(block, /editorPageHelpers\.openMomentDetail/);
  assert.match(block, /memoryId:\s*activeMemory\.id/);
  assert.match(block, /treeId,/);
  assert.match(block, /getEditorBasePath,/);
  assert.match(block, /locationRef:\s*window\.location/);
  assert.match(block, /LoveBudEditorPageHelpers\.openMomentDetail missing/);
});

test('editor openCurrentMomentDetail preserves active memory selection order', () => {
  const block = extractOpenCurrentMomentDetailBlock(editorSource);

  assert.match(
    block,
    /const activeMemory\s*=\s*currentEditingMemory\s*\|\|\s*treeMemories\(\)\.find\(\(m\)\s*=>\s*m\.id\s*===\s*selectedNodeId\)\s*\|\|\s*createInitialMemory\(\)/
  );

  assert.match(block, /if \(!activeMemory \|\| !activeMemory\.id \|\| !treeId\) return/);
});

test('editor no longer builds detail href inline in entrypoint', () => {
  const block = extractOpenCurrentMomentDetailBlock(editorSource);

  assert.doesNotMatch(block, /const detailHref\s*=/);
  assert.doesNotMatch(block, /window\.location\.href\s*=\s*detailHref/);
  assert.doesNotMatch(block, /'detail\.html\?id='/);
  assert.doesNotMatch(block, /'&from=editor'/);
});

test('editor page helpers load before editor entrypoint', () => {
  const pageHelpersIndex = editorHtml.indexOf('js/editor/editor-page-helpers.js');
  const editorJsIndex = editorHtml.indexOf('js/editor.js');

  assert.notEqual(pageHelpersIndex, -1, 'editor-page-helpers.js must be loaded');
  assert.notEqual(editorJsIndex, -1, 'editor.js must be loaded');
  assert.ok(pageHelpersIndex < editorJsIndex, 'editor-page-helpers.js must load before editor.js');
});
