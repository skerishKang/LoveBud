const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const vm = require('node:vm');

const ROOT = path.resolve(__dirname, '..', '..');
const SHARED = 'js/shared/canonical-appreciation-detail-presentation.js';
const OWNER_WRAPPER = 'js/editor/templates/editor-detail-view-mode-template.js';

function buildOwnerHtml() {
  const ctx = { window: {}, globalThis: null };
  ctx.globalThis = ctx;
  vm.createContext(ctx);
  vm.runInContext(fs.readFileSync(path.join(ROOT, SHARED), 'utf8'), ctx);
  const api = ctx.window.LoveBudCanonicalAppreciationDetailPresentation;
  return api.buildDetailViewModeHtml({
    authority: 'owner',
    includeOwnerEditChip: true,
    includeOwnerActions: true,
    includeAtlasMount: true,
    knowledgeMode: 'owner',
    socialMode: 'owner-interactive',
    initialHidden: true
  });
}

test('Detail View Mode template helper exists and mounts via shared canonical builder', () => {
  assert.ok(fs.existsSync(OWNER_WRAPPER), 'template helper file must exist');
  assert.ok(fs.existsSync(SHARED), 'shared canonical presentation builder must exist');

  const helperCode = fs.readFileSync(OWNER_WRAPPER, 'utf8');
  assert.ok(helperCode.includes('LoveBudCanonicalAppreciationDetailPresentation'), 'must use shared builder');
  assert.ok(helperCode.includes('editorDetailViewModeTemplateMount'), 'must find mount element');
  assert.match(helperCode, /export\s+function buildDetailViewModeTemplate\(\)/);
  assert.match(helperCode, /mount\.outerHTML\s*=\s*buildDetailViewModeTemplate\(\)/);

  const html = buildOwnerHtml();
  assert.ok(html.includes('id="detailViewMode"'), 'must include detail view mode root id');
  assert.ok(html.includes('id="detailTreeMetaMount"'), 'must include detail tree meta mount id');
  assert.ok(html.includes('id="detailCurrentMomentBadge"'), 'must include badge id');
  assert.ok(html.includes('id="editMemoryBtn"'), 'must include edit btn id');
  assert.ok(html.includes('id="detailCurrentMomentTitle"'), 'must include title id');
  assert.ok(html.includes('id="detailCurrentMomentHint"'), 'must include hint id');
  assert.ok(html.includes('id="detailImg"'), 'must include image id');
  assert.ok(html.includes('id="viewMomentDetailBtn"'), 'must include view btn id');
  assert.ok(html.includes('id="continueFromMomentBtn"'), 'must include continue btn id');
  assert.ok(html.includes('id="detailTags"'), 'must include tags id');
  assert.ok(html.includes('id="detailMemo"'), 'must include memo id');

  assert.ok(html.includes('class="editor-hidden-initial"'), 'must include editor-hidden-initial class');
  assert.match(html, /id="detailViewMode"[^>]*style="display:\s*none;"/, 'detail view mode root must be initially hidden');
  assert.ok(html.includes('class="editor-current-moment-card"'), 'must include editor-current-moment-card class');
  assert.ok(html.includes('class="editor-moment-actions-card"'), 'must include editor-moment-actions-card class');
  assert.ok(html.includes('class="editor-moment-info-card"'), 'must include editor-moment-info-card class');
});

test('Detail View Mode template must NOT contain the shared save-status markup', () => {
  const helperCode = fs.readFileSync(OWNER_WRAPPER, 'utf8');
  const sharedCode = fs.readFileSync(SHARED, 'utf8');

  assert.ok(!helperCode.includes('id="saveStatusIndicator"'), 'view-mode template must not contain saveStatusIndicator');
  assert.ok(!helperCode.includes('id="saveStatusText"'), 'view-mode template must not contain saveStatusText');
  assert.ok(!helperCode.includes('id="saveStatusIcon"'), 'view-mode template must not contain saveStatusIcon');
  assert.ok(!helperCode.includes('id="lastSavedTime"'), 'view-mode template must not contain lastSavedTime');
  assert.ok(!helperCode.includes('class="editor-save-status-card"'), 'view-mode template must not contain editor-save-status-card');
  assert.ok(!sharedCode.includes('id="saveStatusIndicator"'), 'shared appreciation builder must not contain saveStatusIndicator');
});

test('Detail Panel Shell template must contain the shared save-status markup exactly once', () => {
  const helperCode = fs.readFileSync('js/editor/templates/editor-detail-panel-shell-template.js', 'utf8');

  assert.ok(helperCode.includes('id="saveStatusIndicator"'), 'shell template must contain saveStatusIndicator');
  assert.ok(helperCode.includes('id="saveStatusText"'), 'shell template must contain saveStatusText');
  assert.ok(helperCode.includes('id="saveStatusIcon"'), 'shell template must contain saveStatusIcon');
  assert.ok(helperCode.includes('id="lastSavedTime"'), 'shell template must contain lastSavedTime');
  assert.ok(helperCode.includes('aria-live="polite"'), 'shell template must contain the single aria-live region');
  assert.ok(helperCode.includes('class="editor-save-status-card"'), 'shell template must contain editor-save-status-card');

  const indicatorCount = (helperCode.match(/id="saveStatusIndicator"/g) || []).length;
  assert.strictEqual(indicatorCount, 1, 'saveStatusIndicator must appear exactly once in the shell template');

  const ariaLiveCount = (helperCode.match(/aria-live="polite"/g) || []).length;
  assert.strictEqual(ariaLiveCount, 1, 'aria-live polite region must appear exactly once in the shell template');

  const statusCardCount = (helperCode.match(/class="editor-save-status-card"/g) || []).length;
  assert.strictEqual(statusCardCount, 1, 'editor-save-status-card must appear exactly once in the shell template');
});

test('editor.html uses template mount and removes raw detail view mode markup', () => {
  const html = fs.readFileSync('pages/editor.html', 'utf8');

  assert.ok(!html.includes('id="detailCurrentMomentTitle"'), 'raw HTML should not contain detail current moment title');
  assert.ok(!html.includes('id="saveStatusIndicator"'), 'raw HTML should not contain save status indicator');
  assert.ok(!html.includes('id="detailViewMode"'), 'raw HTML should not contain detail view mode wrapper directly');
  assert.ok(html.includes('canonical-appreciation-detail-presentation.js'), 'editor must load shared presentation builder');
});

test('editor.html loads template helper before editor runtime in correct order', () => {
  const html = fs.readFileSync('pages/editor.html', 'utf8');

  const detailEmptyStateHelperIndex = html.indexOf('js/editor/templates/editor-detail-empty-state-template.js');
  const sharedBuilderIndex = html.indexOf('js/shared/canonical-appreciation-detail-presentation.js');
  const detailViewModeHelperIndex = html.indexOf('js/editor/templates/editor-detail-view-mode-template.js');
  const domSelectorsIndex = html.indexOf('js/editor/editor-dom-selectors.js');
  const editorJsIndex = html.indexOf('js/editor.js');

  assert.notEqual(detailEmptyStateHelperIndex, -1, 'editor.html must still load the detail empty state helper script');
  assert.notEqual(sharedBuilderIndex, -1, 'editor.html must load shared canonical presentation builder');
  assert.notEqual(detailViewModeHelperIndex, -1, 'editor.html must load the new detail view mode helper script');

  assert.ok(sharedBuilderIndex < detailViewModeHelperIndex, 'shared builder must load before owner view-mode wrapper');
  assert.ok(detailViewModeHelperIndex < domSelectorsIndex, 'detail view mode helper must load before dom selectors');
  assert.ok(detailViewModeHelperIndex < editorJsIndex, 'detail view mode helper must load before js/editor.js');
  assert.ok(detailEmptyStateHelperIndex < detailViewModeHelperIndex, 'detail empty state helper usually loads before detail view mode helper for consistency');
});
