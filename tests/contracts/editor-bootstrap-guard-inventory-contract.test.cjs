const assert = require('node:assert/strict');
const fs = require('node:fs');
const test = require('node:test');

const editorSource = fs.readFileSync('js/editor.js', 'utf8');

const expectedDirectMessages = [
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

  assert.equal(directMessages.length, 13);
});

test('editor bootstrap aggregated text resolver guard inventory is removed', () => {
  assert.doesNotMatch(editorSource, /const missingTextResolvers\s*=\s*\[/);
  assert.doesNotMatch(editorSource, /LoveBudEditorHelpers\.safeI18nText.*missing/);
});

test('editor bootstrap aggregated media resolver guard inventory is removed', () => {
  assert.doesNotMatch(editorSource, /const missingMediaResolvers\s*=\s*\[/);
  assert.doesNotMatch(editorSource, /LoveBudEditorHelpers\.escapeHtml.*missing/);
});

test('editor bootstrap aggregated root helper guard inventory is removed', () => {
  assert.doesNotMatch(editorSource, /const missingRootHelpers\s*=\s*\[/);
  assert.doesNotMatch(editorSource, /LoveBudEditorUtils\.findRootMemory.*missing/);
});

test('all editor bootstrap guard calls stay before startEditor', () => {
  const startEditorIndex = editorSource.indexOf('const startEditor = async () => {');
  assert.notEqual(startEditorIndex, -1, 'startEditor must exist');

  const allMatches = [...editorSource.matchAll(/reportEditorBootstrapMissingDependency\(/g)];
  const declarationIndex = editorSource.indexOf('reportEditorBootstrapMissingDependency(msg)');
  const callIndexes = allMatches
    .map((match) => match.index)
    .filter((index) => index !== declarationIndex);

  assert.equal(callIndexes.length, 14);

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
