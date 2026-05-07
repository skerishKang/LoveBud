const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.resolve(__dirname, '..', '..');

function read(file) {
  return fs.readFileSync(path.join(ROOT, file), 'utf8');
}

test('search runtime submodules load after existing search helpers and before search entrypoint', () => {
  const html = read('pages/search.html');
  const scripts = [...html.matchAll(/<script src="([^"]+)"/g)].map((match) => match[1]);
  const indexOf = (needle) => scripts.findIndex((src) => src.includes(needle));

  const helperModules = [
    '../js/search/search-title-helper.js',
    '../js/search/search-data-adapter.js',
    '../js/search/search-shared-utils.js',
  ];
  const helperIndexes = helperModules.map(indexOf);
  const previewRendererIndex = indexOf('../js/search/search-preview-renderer.js');
  const searchEntrypointIndex = indexOf('../js/search/index.js');
  const expectedModules = [
    '../js/search/search-preview-cache.js',
    '../js/search/search-ui.js',
    '../js/search/search-url-state.js',
  ];
  const moduleIndexes = expectedModules.map(indexOf);

  assert.ok(helperIndexes.every((index) => index >= 0));
  assert.ok(previewRendererIndex >= 0);
  assert.ok(searchEntrypointIndex >= 0);
  assert.deepEqual(helperIndexes, helperIndexes.toSorted((a, b) => a - b));
  assert.ok(helperIndexes.every((index) => index < previewRendererIndex));
  assert.equal(html.includes('../js/search-title-helper.js'), false);
  assert.equal(html.includes('../js/search-data-adapter.js'), false);
  assert.equal(html.includes('../js/search-shared-utils.js'), false);
  assert.deepEqual(moduleIndexes, moduleIndexes.toSorted((a, b) => a - b));
  assert.ok(moduleIndexes.every((index) => index > previewRendererIndex));
  assert.ok(moduleIndexes.every((index) => index < searchEntrypointIndex));
  assert.equal(html.includes('type="module"'), false);
});

test('search UI module preserves orchestrator contract methods', () => {
  const uiModule = read('js/search/search-ui.js');
  const requiredMethods = [
    'syncStaticBrowseCopy',
    'clearSelectedPreview',
    'markActiveCard',
    'setMobilePreviewOpen',
    'renderLoadErrorState',
    'ensureBrowseControls',
    'syncBrowseHead',
  ];

  for (const method of requiredMethods) {
    assert.match(uiModule, new RegExp(`\\b${method}\\b`));
  }
});

test('browse feed controls do not expose batch strategy as product UI', () => {
  const uiModule = read('js/search/search-ui.js');

  assert.doesNotMatch(uiModule, /지금 먼저 볼|to start with|More LoveTrees will appear as you scroll/);
  assert.doesNotMatch(uiModule, /이어지는 감상|Continuous feed|많이 이어진 감상|Most connected/);
  assert.doesNotMatch(uiModule, /id=["']browseLoadMoreBtn["']/);
  assert.doesNotMatch(uiModule, /getElementById\(['"]browseLoadMoreBtn['"]\)/);
  assert.match(uiModule, /refs\.resultsBadge\.hidden = true/);
  assert.match(uiModule, /refs\.resultsBadge\.textContent = ''/);
  assert.match(uiModule, /browseScrollLoadSentinel/);
  assert.match(uiModule, /callbacks\.loadMorePublicTrees/);
});

test('browse filter and sort changes reset pagination state without changing feed cards', () => {
  const uiModule = read('js/search/search-ui.js');
  const controlsModule = read('js/search/search-controls.js');

  assert.match(controlsModule, /const DEFAULT_LIMIT = 6/);
  assert.match(controlsModule, /function resetPaginationState\(\)/);
  assert.match(controlsModule, /state\.currentLimit = DEFAULT_LIMIT/);
  assert.match(controlsModule, /state\.hasMoreTrees = true/);
  assert.match(uiModule, /state\.currentLimit = 6/);
  assert.match(uiModule, /state\.hasMoreTrees = true/);
});

test('search UI module implements card accessibility and event delegation', () => {
  const uiModule = read('js/search/search-ui.js');
  
  // Verify accessibility attributes are set
  assert.match(uiModule, /card\.setAttribute\(['"]tabindex['"],\s*['"]0['"]\)/);
  assert.match(uiModule, /card\.setAttribute\(['"]role['"],\s*['"]button['"]\)/);
  
  // Verify event delegation pattern
  assert.match(uiModule, /container\.addEventListener\(['"]click['"]/);
  assert.match(uiModule, /container\.addEventListener\(['"]keydown['"]/);
  assert.match(uiModule, /event\.target\.closest\(['"]\.tree-card\[data-tree-id\]['"]\)/);
});

test('search preview summary omits range phrase for missing time range labels', () => {
  const previewRenderer = read('js/search/search-preview-renderer.js');
  const previewBuilders = read('js/search/search-preview-renderer-builders.js');
  const i18nSearch = read('js/i18n/i18n-search.js');

  assert.match(previewRenderer, /function getPreviewTimeRange\(tree\)/);
  assert.match(previewBuilders, /'기록 없음'/);
  assert.match(previewBuilders, /getSearchCopy\('search\.previewUnknownRange'/);
  assert.match(previewBuilders, /function getPreviewSummaryCopy\(/);
  assert.match(previewBuilders, /search\.previewSummaryThemeNoRange/);
  assert.match(previewBuilders, /search\.previewSummaryNoRange/);

  assert.match(i18nSearch, /'search\.previewSummaryThemeNoRange'/);
  assert.match(i18nSearch, /'search\.previewSummaryNoRange'/);
  assert.match(i18nSearch, /span style="color:var\(--primary\);font-weight:700;">\{count\}개의 순간<\/span>이 이어졌어요/);
});

test('browse selected hub primary CTA label matches detail viewing route', () => {
  const actionHelper = read('js/search/search-preview-action-helper.js');
  const previewRenderer = read('js/search/search-preview-renderer.js');
  const i18nSearch = read('js/i18n/i18n-search.js');

  assert.match(actionHelper, /detail\.html\?id=/);
  assert.match(actionHelper, /from=browse/);
  assert.match(actionHelper, /search\.previewOpenViewingCta/);
  assert.match(previewRenderer, /helper\?\.renderPreviewActionButton/);
  assert.match(previewRenderer, /return '';/);
  assert.match(i18nSearch, /'search\.previewOpenViewingCta'/);
  assert.match(i18nSearch, /ko:\s*'감상 열기'/);
  assert.doesNotMatch(actionHelper, /이 트리 열기|Open this tree|search\.previewOpenTreeCta/);
  assert.doesNotMatch(previewRenderer, /이 트리 열기|Open this tree|search\.previewOpenTreeCta/);
  assert.doesNotMatch(i18nSearch, /이 트리 열기|Open this tree|search\.previewOpenTreeCta/);


test('browse selected hub share button delegates to action helper', () => {
  const actionHelper = read('js/search/search-preview-action-helper.js');
  const previewRenderer = read('js/search/search-preview-renderer.js');

  assert.match(actionHelper, /renderShareButton:/);
  assert.match(actionHelper, /data-share-tree-link/);
  assert.match(actionHelper, /data-share-tree-link-label/);
  assert.match(previewRenderer, /helper\?\.renderShareButton/);
  assert.match(previewRenderer, /function renderShareButton\(tree\)/);
  const fallbackCount = (previewRenderer.match(/return '';/g) || []).length;
  assert.ok(fallbackCount >= 2, 'renderer should have at least 2 empty string fallbacks (action + share)');
  assert.doesNotMatch(previewRenderer, /data-share-tree-link="\+' \+ escapeHtml\(tree\.id\)/);
});
});
