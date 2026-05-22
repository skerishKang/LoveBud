const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.resolve(__dirname, '..', '..');

function read(file) {
  return fs.readFileSync(path.join(ROOT, file), 'utf8');
}

test('editor detail UI builder boundary exposes the expected factory', () => {
  const builders = read('js/editor/editor-detail-ui-builders.js');

  assert.match(builders, /window\.createEditorDetailUIBuilders\s*=/);
  assert.match(builders, /createInlineIcon/);
  assert.match(builders, /getDisplayEmotionTags/);
  assert.match(builders, /getMemoFallbackText/);
});

test('editor detail UI delegates pure builders through the boundary', () => {
  const detailUi = read('js/editor/editor-detail-ui.js');

  assert.match(detailUi, /window\.createEditorDetailUIBuilders/);
  assert.match(detailUi, /createEditorDetailUIBuilders\(\{\s*formatI18nText\s*\}\)/);
});
