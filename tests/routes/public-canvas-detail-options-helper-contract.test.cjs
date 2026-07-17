const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');

test('public canvas init keeps detail UI options behind a local helper', () => {
  const initSrc = fs.readFileSync('js/viewer/public-canvas-init.js', 'utf8');

  assert.ok(
    initSrc.includes('function createPublicCanvasDetailUIOptions(ctx)'),
    'public canvas init must expose a local detail UI options helper'
  );
  assert.ok(
    initSrc.includes('canvasEntry.createDetailUIOptions({'),
    'detail UI options helper must delegate to entry wrapper when available'
  );
  assert.ok(
    initSrc.includes('detailPanel: ctx.detailPanel'),
    'detail UI options helper must preserve detailPanel'
  );
  // #3586: identity i18n stub removed — must resolve via window.t so raw keys never reach DOM.
  assert.ok(
    initSrc.includes('function resolveI18n') || initSrc.includes('window.t'),
    'detail UI options helper must resolve i18n through window.t (not identity stub)'
  );
  assert.ok(
    initSrc.includes('i18n: resolveI18n'),
    'detail UI options helper must pass resolveI18n into entry/fallback options'
  );
  assert.equal(
    initSrc.includes('i18n: function(k) { return k; }'),
    false,
    'identity i18n fallback must not remain (exposes raw keys like visibility_public)'
  );
  assert.ok(
    initSrc.includes('publicCanvasConfig: ctx.publicCanvasConfig'),
    'detail UI options helper must pass publicCanvasConfig to entry wrapper'
  );
  assert.ok(
    initSrc.includes('readOnlyActions: ctx.readOnlyActions'),
    'detail UI options helper must pass readOnlyActions to entry wrapper'
  );
  assert.ok(
    initSrc.includes('selectionState: ctx.selectionState'),
    'detail UI options helper must pass selectionState to entry wrapper'
  );
  assert.ok(
    initSrc.includes('escapeHtml: ctx.escapeHtml'),
    'detail UI options helper must preserve escapeHtml'
  );
  assert.ok(
    initSrc.includes('isRootMemory: ctx.isRootMemory'),
    'detail UI options helper must preserve isRootMemory'
  );
  assert.ok(
    initSrc.includes('getCanonicalRootId: function() { return ctx.canonicalRootId; }'),
    'detail UI options helper must preserve canonical root getter'
  );
  assert.ok(
    initSrc.includes('resolveTreeTitleText: ctx.publicCanvasConfig.resolveTreeTitleText'),
    'detail UI options helper must preserve tree title resolver'
  );
  assert.ok(
    initSrc.includes('resolveHintText: ctx.publicCanvasConfig.resolveHintText'),
    'detail UI options helper must preserve hint resolver'
  );
  assert.ok(
    initSrc.includes('resolveInfoText: ctx.publicCanvasConfig.resolveInfoText'),
    'detail UI options helper must preserve info resolver'
  );
  assert.ok(
    initSrc.includes('resolveMemoryThumbnail: ctx.publicCanvasConfig.resolveMemoryThumbnail'),
    'detail UI options helper must preserve thumbnail resolver'
  );
  assert.ok(
    initSrc.includes('getSelectedNodeId: selectionState.getSelectedNodeId'),
    'detail UI options helper must preserve selected node accessor'
  );
  assert.ok(
    initSrc.includes('getTreeMemories: ctx.publicCanvasConfig.getTreeMemories'),
    'detail UI options helper must preserve tree memories accessor'
  );
  assert.ok(
    initSrc.includes('getCurrentTreeData: ctx.publicCanvasConfig.getCurrentTreeData'),
    'detail UI options helper must preserve current tree data accessor'
  );
  assert.ok(
    initSrc.includes('getLocalSaveMode: ctx.readOnlyActions.getLocalSaveMode'),
    'detail UI options helper must preserve local save mode accessor'
  );
  assert.ok(
    initSrc.includes('showToast: ctx.readOnlyActions.showToast'),
    'detail UI options helper must preserve showToast'
  );
  assert.ok(
    initSrc.includes('updateTreeVisibility: ctx.readOnlyActions.noopAsync'),
    'detail UI options helper must preserve updateTreeVisibility no-op'
  );
  assert.ok(
    initSrc.includes('openCurrentMomentDetail: ctx.readOnlyActions.noop'),
    'detail UI options helper must preserve open detail no-op'
  );
  assert.ok(
    initSrc.includes('focusSelectedMoment: ctx.readOnlyActions.noop'),
    'detail UI options helper must preserve focus selected no-op'
  );
  assert.ok(
    initSrc.includes('updateSelectedMemoryFields: ctx.readOnlyActions.noopFalseAsync'),
    'detail UI options helper must preserve update fields no-op'
  );
  assert.ok(
    initSrc.includes('var detailUIOptions = createPublicCanvasDetailUIOptions({'),
    'startCanvas must consume the local detail UI options helper'
  );
  assert.equal(
    initSrc.includes("var detailUIOptions = canvasEntry && typeof canvasEntry.createDetailUIOptions === 'function'"),
    false,
    'startCanvas should not inline detail UI options delegation'
  );
  assert.ok(
    initSrc.includes("var MARKER = 'LoveBudPublicCanvasInitLoaded';"),
    'public canvas init marker must remain unchanged'
  );
  assert.equal(
    initSrc.includes('LoveBudPublicCanvasInitLoaded_setupPublicRoute'),
    false,
    'marker must not contain contract-test strings'
  );
  assert.equal(
    initSrc.includes('var _seq'),
    false,
    'source must not contain test-only sequence variables'
  );
  assert.ok(
    initSrc.indexOf('function createPublicCanvasDetailUIOptions(ctx)') < initSrc.indexOf('function initPublicCanvas()'),
    'detail UI options helper must be defined before initPublicCanvas'
  );
  assert.ok(
    initSrc.indexOf('var selectionState = createPublicCanvasSelectionState(canonicalRootId);') < initSrc.indexOf('var detailUIOptions = createPublicCanvasDetailUIOptions({'),
    'detail UI options must remain after selection state setup'
  );
  assert.ok(
    initSrc.indexOf('var detailUIOptions = createPublicCanvasDetailUIOptions({') < initSrc.indexOf('var detailUI = window.createPublicViewerDetailUI(detailUIOptions);'),
    'detail UI options must remain before detail UI creation'
  );
  assert.ok(
    initSrc.indexOf('var detailUI = window.createPublicViewerDetailUI(detailUIOptions);') < initSrc.indexOf('var canvasOptions = createPublicCanvasOptions({'),
    'detail UI creation must remain before canvas options creation'
  );
});
