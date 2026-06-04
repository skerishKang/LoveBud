const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.resolve(__dirname, '..', '..');

function read(file) {
  return fs.readFileSync(path.join(ROOT, file), 'utf8');
}

/**
 * Contract-only inventory: duplicate bootstrap guards between
 * editor-entry-dependencies.js and editor.js.
 *
 * The entry dependency resolver already validates many required
 * dependencies before returning status: 'ready'. editor.js repeats
 * some of these same guards after receiving deps.
 *
 * This contract freezes the current state so a later production
 * cleanup can safely remove proven duplicate guards.
 */

const resolverGuardedSingles = [
  'LoveBudEditorShellHelpers.createInlineShowToastFallback',
  'LoveBudEditorShellHelpers.getI18n',
  'LoveBudEditorShellHelpers.getEditorBasePath',
  'LoveBudEditorPageHelpers.redirectToEditorLogin',
  'LoveBudEditorTreeHelpers.syncCurrentTreeData',
  'LoveBudEditorTreeHelpers.resolveParentIdForCreate',
  'LoveBudEditorPageHelpers.getMyTreesHref',
  'LoveBudEditorShellHelpers.getYouTubeInputErrorMessageFallback',
  'LoveBudEditorPageHelpers.renderTreeLoadError',
  'LoveBudEditorPageHelpers.buildTreeLoadErrorCopy',
  'LoveBudEditorShellHelpers.applyEditorShellCopy',
  'LoveBudEditorShellCopyApplier.createPrepareEditorShell',
  'LoveBudEditorShellHelpers.createEditorDebugReporter'
];

const resolverGuardedAggregates = [
  'LoveBudEditorUtils.findRootMemory',
  'LoveBudEditorUtils.getCanonicalRootId',
  'LoveBudEditorUtils.isRootMemory',
  'LoveBudEditorHelpers.safeI18nText',
  'LoveBudEditorHelpers.resolveHintText',
  'LoveBudEditorHelpers.resolveTreeTitleText',
  'LoveBudEditorHelpers.resolveInfoText',
  'LoveBudEditorHelpers.escapeHtml',
  'LoveBudEditorHelpers.safeUrl',
  'LoveBudEditorHelpers.resolveMemoryThumbnail'
];

const editorRepeatedSingles = [
  'LoveBudEditorShellHelpers.createInlineShowToastFallback missing',
  'LoveBudEditorShellHelpers.getI18n missing',
  'LoveBudEditorShellHelpers.getEditorBasePath missing',
  'LoveBudEditorPageHelpers.redirectToEditorLogin missing',
  'LoveBudEditorTreeHelpers.syncCurrentTreeData missing',
  'LoveBudEditorTreeHelpers.resolveParentIdForCreate missing',
  'LoveBudEditorPageHelpers.getMyTreesHref missing',
  'LoveBudEditorPageHelpers.renderTreeLoadError missing',
  'LoveBudEditorPageHelpers.buildTreeLoadErrorCopy missing',
  'LoveBudEditorShellHelpers.applyEditorShellCopy missing',
  'LoveBudEditorShellCopyApplier.createPrepareEditorShell missing',
  'LoveBudEditorShellHelpers.createEditorDebugReporter missing'
];

const editorExclusiveSingles = [
  'LoveBudEditorEntryDependencies.resolveEditorEntryDependencies missing',
  'LoveBudEditorPageHelpers.registerEditorAuthStart missing',
  'LoveBudEditorShellHelpers.createEditorStartDependencyGuard missing',
  'LoveBudEditorShellHelpers.createEditorStartDependencyChecker missing',
  'LoveBudEditorShellHelpers.createEditorRequiredGlobalWaiter missing',
  'LoveBudEditorShellHelpers.createEditorStartupShellApplier missing',
  'LoveBudEditorShellHelpers.createEditorCanvasEmptyGuideUpdater missing',
  'LoveBudEditorShellHelpers.createEditorSelectNodeHandler missing',
  'LoveBudEditorShellHelpers.createEditorSidebarStatusUpdater missing',
  'LoveBudEditorShellHelpers.createEditorInitialMemoryProvider missing',
  'LoveBudEditorShellHelpers.createEditorNextMemoryIdProvider missing',
  'LoveBudEditorShellHelpers.createEditorInitialSelectionApplier missing',
  'LoveBudEditorShellHelpers.createEditorReadyFinalizer missing'
];

test('entry dependency resolver guards individual bootstrap dependencies', () => {
  const resolver = read('js/editor/editor-entry-dependencies.js');

  for (const marker of resolverGuardedSingles) {
    assert.ok(resolver.includes(marker), `entry-dependencies must guard ${marker}`);
  }
});

test('entry dependency resolver guards aggregated bootstrap dependencies', () => {
  const resolver = read('js/editor/editor-entry-dependencies.js');

  for (const marker of resolverGuardedAggregates) {
    assert.ok(resolver.includes(marker), `entry-dependencies must guard ${marker}`);
  }
});

test('editor entry repeats resolver-owned individual bootstrap guards', () => {
  const editor = read('js/editor.js');

  for (const marker of editorRepeatedSingles) {
    assert.ok(editor.includes(marker), `editor.js still repeats ${marker}`);
  }
});

test('editor entry maintains editor-exclusive bootstrap guards', () => {
  const editor = read('js/editor.js');

  for (const marker of editorExclusiveSingles) {
    assert.ok(editor.includes(marker), `editor.js must keep ${marker}`);
  }
});

test('editor entry repeats aggregated resolver-owned guards via missingTextResolvers and missingMediaResolvers', () => {
  const editor = read('js/editor.js');

  assert.ok(editor.includes('const missingTextResolvers = ['));
  assert.ok(editor.includes('const missingMediaResolvers = ['));
  assert.ok(editor.includes('LoveBudEditorHelpers.safeI18nText'));
  assert.ok(editor.includes('LoveBudEditorHelpers.resolveHintText'));
  assert.ok(editor.includes('LoveBudEditorHelpers.resolveTreeTitleText'));
  assert.ok(editor.includes('LoveBudEditorHelpers.resolveInfoText'));
  assert.ok(editor.includes('LoveBudEditorHelpers.escapeHtml'));
  assert.ok(editor.includes('LoveBudEditorHelpers.safeUrl'));
  assert.ok(editor.includes('LoveBudEditorHelpers.resolveMemoryThumbnail'));
});

test('editor entry repeats aggregated root helper guards', () => {
  const editor = read('js/editor.js');

  assert.ok(editor.includes('const missingRootHelpers = ['));
  assert.ok(editor.includes('LoveBudEditorUtils.findRootMemory'));
  assert.ok(editor.includes('LoveBudEditorUtils.getCanonicalRootId'));
  assert.ok(editor.includes('LoveBudEditorUtils.isRootMemory'));
});

test('duplicate guard readiness contract does not remove runtime checks yet', () => {
  const editor = read('js/editor.js');

  assert.ok(editor.includes('reportEditorBootstrapMissingDependency'));
  assert.ok(editor.includes('reportEditorBootstrapMissingList'));
  assert.ok(editor.includes("entryDependenciesResult.status === 'stopped'"));
});

test('getYouTubeInputErrorMessageFallback guard is no longer repeated (removed in #2119)', () => {
  const editor = read('js/editor.js');

  assert.ok(!editor.includes('getYouTubeInputErrorMessageFallback'));
});
