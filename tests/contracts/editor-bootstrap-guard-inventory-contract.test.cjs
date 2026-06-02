const assert = require('node:assert/strict');
const fs = require('node:fs');
const test = require('node:test');

const editorSource = fs.readFileSync('js/editor.js', 'utf8');

const expectedDirectMessages = [
  'LoveBudEditorEntryDependencies.resolveEditorEntryDependencies missing',
  'LoveBudEditorShellHelpers.createInlineShowToastFallback missing',
  'LoveBudEditorShellHelpers.getI18n missing',
  'LoveBudEditorShellHelpers.getEditorBasePath missing',
  'LoveBudEditorPageHelpers.redirectToEditorLogin missing',
  'LoveBudEditorTreeHelpers.syncCurrentTreeData missing',
  'LoveBudEditorTreeHelpers.resolveParentIdForCreate missing',
  'LoveBudEditorPageHelpers.getMyTreesHref missing',
  'LoveBudEditorShellHelpers.getYouTubeInputErrorMessageFallback missing',
  'LoveBudEditorPageHelpers.renderTreeLoadError missing',
  'LoveBudEditorPageHelpers.buildTreeLoadErrorCopy missing',
  'LoveBudEditorPageHelpers.registerEditorAuthStart missing',
  'LoveBudEditorShellHelpers.applyEditorShellCopy missing',
  'LoveBudEditorShellCopyApplier.createPrepareEditorShell missing',
  'LoveBudEditorShellHelpers.createEditorDebugReporter missing',
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

test('editor bootstrap missing dependency reporter exists and writes to debug errors', () => {
  const functionStart = editorSource.indexOf('function reportEditorBootstrapMissingDependency(msg)');
  const functionEnd = editorSource.indexOf('if (typeof resolveEditorEntryDependencies', functionStart);

  assert.notEqual(functionStart, -1, 'bootstrap missing dependency reporter must exist');
  assert.notEqual(functionEnd, -1, 'bootstrap reporter must be before first bootstrap guard');

  const functionBody = editorSource.slice(functionStart, functionEnd);

  assert.match(functionBody, /const debugState\s*=\s*window\.LoveBudEditorDebug/);
  assert.match(functionBody, /console\.error\('\[editor-main\] ERROR: ' \+ msg\)/);
  assert.match(functionBody, /debugState\.errors\.push\(\{ msg, error: msg \}\)/);
});

test('editor bootstrap direct guard message inventory is frozen', () => {
  const directMessages = [
    ...editorSource.matchAll(/reportEditorBootstrapMissingDependency\('([^']+)'\)/g)
  ].map((match) => match[1]);

  assert.deepEqual(directMessages, expectedDirectMessages);
});

test('editor bootstrap direct guard count remains frozen', () => {
  const directMessages = [
    ...editorSource.matchAll(/reportEditorBootstrapMissingDependency\('([^']+)'\)/g)
  ].map((match) => match[1]);

  assert.equal(directMessages.length, 26);
});

test('editor bootstrap aggregated text resolver guard inventory is frozen', () => {
  assert.match(editorSource, /const missingTextResolvers\s*=\s*\[/);
  assert.match(editorSource, /\['LoveBudEditorHelpers\.safeI18nText', safeI18nText\]/);
  assert.match(editorSource, /\['LoveBudEditorHelpers\.resolveHintText', resolveHintText\]/);
  assert.match(editorSource, /\['LoveBudEditorHelpers\.resolveTreeTitleText', resolveTreeTitleText\]/);
  assert.match(editorSource, /\['LoveBudEditorHelpers\.resolveInfoText', resolveInfoText\]/);
  assert.match(
    editorSource,
    /if \(missingTextResolvers\.length\) \{ reportEditorBootstrapMissingList\(missingTextResolvers\); return; \}/
  );
});

test('editor bootstrap aggregated media resolver guard inventory is frozen', () => {
  assert.match(editorSource, /const missingMediaResolvers\s*=\s*\[/);
  assert.match(editorSource, /\['LoveBudEditorHelpers\.escapeHtml', escapeHtml\]/);
  assert.match(editorSource, /\['LoveBudEditorHelpers\.safeUrl', safeUrl\]/);
  assert.match(editorSource, /\['LoveBudEditorHelpers\.resolveMemoryThumbnail', resolveMemoryThumbnail\]/);
  assert.match(
    editorSource,
    /if \(missingMediaResolvers\.length\) \{ reportEditorBootstrapMissingList\(missingMediaResolvers\); return; \}/
  );
});

test('editor bootstrap aggregated root helper guard inventory is frozen', () => {
  assert.match(editorSource, /const missingRootHelpers\s*=\s*\[/);
  assert.match(editorSource, /\['LoveBudEditorUtils\.findRootMemory', findRootMemory\]/);
  assert.match(editorSource, /\['LoveBudEditorUtils\.getCanonicalRootId', getCanonicalRootId\]/);
  assert.match(editorSource, /\['LoveBudEditorUtils\.isRootMemory', isRootMemory\]/);
  assert.match(
    editorSource,
    /if \(missingRootHelpers\.length\) \{ reportEditorBootstrapMissingList\(missingRootHelpers\); return; \}/
  );
});

test('all editor bootstrap guard calls stay before startEditor', () => {
  const startEditorIndex = editorSource.indexOf('const startEditor = async () => {');
  assert.notEqual(startEditorIndex, -1, 'startEditor must exist');

  const allMatches = [...editorSource.matchAll(/reportEditorBootstrapMissingDependency\(/g)];
  const declarationIndex = editorSource.indexOf('reportEditorBootstrapMissingDependency(msg)');
  const callIndexes = allMatches
    .map((match) => match.index)
    .filter((index) => index !== declarationIndex);

  assert.equal(callIndexes.length, 27);

  for (const index of callIndexes) {
    assert.ok(index < startEditorIndex, 'bootstrap guard call must be before startEditor');
  }
});

test('editor bootstrap inventory contract does not enter start dependency checker domain', () => {
  const startEditorIndex = editorSource.indexOf('const startEditor = async () => {');
  const startEditorBody = editorSource.slice(startEditorIndex);

  assert.doesNotMatch(startEditorBody, /reportEditorBootstrapMissingDependency\(/);
  assert.match(startEditorBody, /createEditorStartDependencyChecker\(\{/);
  assert.match(startEditorBody, /ensureStartEditorDependency,\s*dependencies:\s*\[/s);
});
