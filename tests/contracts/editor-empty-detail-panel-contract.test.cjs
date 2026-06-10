const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');

const detailUiPath = path.join(__dirname, '..', '..', 'js', 'editor', 'editor-detail-ui.js');

test('editor detail panel hides selected-memory UI when no memory is selected', () => {
  const source = fs.readFileSync(detailUiPath, 'utf8');

  assert.match(source, /const selectedNodeId = getSelectedNodeId\(\);/);
  assert.match(source, /const hasSelectedMemory = !!\(data && data\.id && !data\.isNewTree && selectedNodeId\);/);
  assert.match(source, /const isEmptyState = !hasSelectedMemory \|\| !treeState\.hasMoments \|\| !!data\?\.isNewTree;/);
  assert.match(source, /if \(isEmptyState\) \{[\s\S]*?setDetailEmptyState\(true\);[\s\S]*?return;[\s\S]*?\}/);
  assert.match(source, /if \(reactionsCard && isEmpty\) reactionsCard\.style\.display = 'none';/);
  assert.match(source, /if \(isEmptyState \|\| !data\?\.id \|\| isRootMemory\(data, canonicalRootId\)\) \{[\s\S]*?reactionsCard\.style\.display = 'none';/);
  assert.match(source, /const thumbnail = resolveMemoryThumbnail\(data\);[\s\S]*?if \(thumbnail\) \{[\s\S]*?\} else \{[\s\S]*?clearDetailMedia\(\);[\s\S]*?\}/);
  assert.match(source, /id="detailEmptyStartBtn"/);
  assert.match(source, /formatI18nText\('create_first_moment', '첫 순간 만들기'\)/);
});
