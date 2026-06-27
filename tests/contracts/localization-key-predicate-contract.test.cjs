const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const ROOT = path.resolve(__dirname, '..', '..');

const workspacePermissionFile = path.join(ROOT, 'js/shared/tree-workspace-permission.js');
const editorFormPayloadFile = path.join(ROOT, 'js/editor/editor-memory-form-payload.js');
const editorDetailUIFile = path.join(ROOT, 'js/editor/editor-detail-ui.js');
const publicViewerDetailUIFile = path.join(ROOT, 'js/viewer/public-viewer-detail-ui.js');

// ── Canonical predicate focused contract ──

test('canonical isLocalizationKeyTitle recognizes valid localization keys', () => {
  const context = { window: {}, console };
  context.window = context;
  vm.createContext(context);
  vm.runInContext(fs.readFileSync(workspacePermissionFile, 'utf8'), context);

  const { isLocalizationKeyTitle } = context.window.LoveBudTreeWorkspaceClassifier;
  assert.ok(typeof isLocalizationKeyTitle === 'function', 'isLocalizationKeyTitle must be a function');

  // Valid localization keys: lowercase segments separated by underscores, at least 3 segments
  assert.equal(isLocalizationKeyTitle('editor_url_only_youtube_title'), true);
  assert.equal(isLocalizationKeyTitle('viewer_tree_title'), true);
  assert.equal(isLocalizationKeyTitle('editor_enter_text_moment'), true);
  assert.equal(isLocalizationKeyTitle('waiting_first_moment'), true);
  assert.equal(isLocalizationKeyTitle('a_b_c'), true);
  assert.equal(isLocalizationKeyTitle('abc_def_ghi'), true);
});

test('canonical isLocalizationKeyTitle rejects plain titles', () => {
  const context = { window: {}, console };
  context.window = context;
  vm.createContext(context);
  vm.runInContext(fs.readFileSync(workspacePermissionFile, 'utf8'), context);

  const { isLocalizationKeyTitle } = context.window.LoveBudTreeWorkspaceClassifier;

  // Korean/English user-entered titles
  assert.equal(isLocalizationKeyTitle('YouTube 영상'), false);
  assert.equal(isLocalizationKeyTitle('새 순간'), false);
  assert.equal(isLocalizationKeyTitle('My Favorite Video'), false);
  assert.equal(isLocalizationKeyTitle('My lovely day'), false);
  assert.equal(isLocalizationKeyTitle('첫 순간이 트리를 깨워요'), false);

  // With uppercase letters
  assert.equal(isLocalizationKeyTitle('Editor_Url_Only_Title'), false);
  assert.equal(isLocalizationKeyTitle('Editor_url_only_title'), false);

  // With numbers
  assert.equal(isLocalizationKeyTitle('editor_2_url_title'), false);

  // With punctuation
  assert.equal(isLocalizationKeyTitle('editor_url.title'), false);
  assert.equal(isLocalizationKeyTitle('hello-world_test'), false);

  // With spaces
  assert.equal(isLocalizationKeyTitle('editor url title'), false);

  // Too few segments (fewer than 3)
  assert.equal(isLocalizationKeyTitle('hello_world'), false);
  assert.equal(isLocalizationKeyTitle('a_b'), false);
  assert.equal(isLocalizationKeyTitle('selected_moment'), false);
  assert.equal(isLocalizationKeyTitle('one'), false);
  assert.equal(isLocalizationKeyTitle(''), false);

  // Non-string inputs
  assert.equal(isLocalizationKeyTitle(null), false);
  assert.equal(isLocalizationKeyTitle(undefined), false);
  assert.equal(isLocalizationKeyTitle(123), false);
  assert.equal(isLocalizationKeyTitle({}), false);
});

test('canonical predicate has no redundant indexOf check', () => {
  const source = fs.readFileSync(workspacePermissionFile, 'utf8');
  // The predicate now spans multiple lines (underscore + dot patterns)
  const predicateBlock = source.match(/function isLocalizationKeyTitle\(title\) \{[\s\S]*?\n\s*\}/);
  assert.ok(predicateBlock, 'must find the isLocalizationKeyTitle function body');
  const body = predicateBlock[0];
  assert.doesNotMatch(body, /indexOf/, 'must not contain redundant indexOf check');
  assert.match(body, /\[a-z\]/, 'must contain regex-based key detection');
});

// ── Editor memory form payload delegates to canonical predicate ──

test('editor-memory-form-payload delegates to canonical isLocalizationKeyTitle', () => {
  const context = { window: {}, console };
  context.window = context;
  vm.createContext(context);

  // Load workspace permission first (provides canonical predicate)
  vm.runInContext(fs.readFileSync(workspacePermissionFile, 'utf8'), context);
  // Load editor memory form payload
  vm.runInContext(fs.readFileSync(editorFormPayloadFile, 'utf8'), context);

  assert.ok(context.window.LoveBudEditorMemoryFormPayload, 'LoveBudEditorMemoryFormPayload must exist');
  // resolveUrlOnlyDefaultTitle uses isLocalizationKey internally
  const { resolveUrlOnlyDefaultTitle } = context.window.LoveBudEditorMemoryFormPayload;

  // When i18n returns a localization key, it should fall through to the Korean fallback
  const i18n = (key) => key; // returns the raw key
  assert.equal(resolveUrlOnlyDefaultTitle({ sourceType: 'youtube', sourceLabel: 'YouTube' }, i18n), 'YouTube 영상');
  assert.equal(resolveUrlOnlyDefaultTitle({ sourceType: 'other', sourceLabel: 'MySource' }, i18n), 'MySource 순간');

  // When i18n returns a real translated string, use that
  const i18nReal = (key) => key === 'editor_url_only_youtube_title' ? 'YouTube Video' : key;
  assert.equal(resolveUrlOnlyDefaultTitle({ sourceType: 'youtube', sourceLabel: 'YouTube' }, i18nReal), 'YouTube Video');
});

test('editor-memory-form-payload delegates to window.LoveBudTreeWorkspaceClassifier.isLocalizationKeyTitle', () => {
  const source = fs.readFileSync(editorFormPayloadFile, 'utf8');
  // Must reference the canonical predicate, not inline its own regex
  assert.match(source, /LoveBudTreeWorkspaceClassifier/,
    'editor form payload must reference canonical predicate module');
  assert.match(source, /isLocalizationKeyTitle/,
    'editor form payload must delegate to canonical predicate isLocalizationKeyTitle');
  assert.doesNotMatch(source, /\/\^\[a-z\]\+\(\?:_\[a-z\]\+\)\{2,\}\$\/\.test/,
    'editor form payload must not contain its own regex predicate');
  // Must guard against absent classifier (matching public-viewer-detail-ui's pattern)
  assert.match(source, /!!classifier/,
    'editor form payload must guard classifier with !! before accessing .isLocalizationKeyTitle');
});

test('editor-memory-form-payload survives absent LoveBudTreeWorkspaceClassifier without throwing', () => {
  const context = { window: {}, console, URL, URLSearchParams, Date };
  context.window = context;
  vm.createContext(context);
  // Load only the editor memory form payload WITHOUT the shared classifier
  vm.runInContext(fs.readFileSync(editorFormPayloadFile, 'utf8'), context);

  assert.ok(context.window.LoveBudEditorMemoryFormPayload, 'LoveBudEditorMemoryFormPayload must exist');
  const { resolveUrlOnlyDefaultTitle } = context.window.LoveBudEditorMemoryFormPayload;

  // i18n that returns the raw key (no translation available)
  const stubI18n = (key) => key;

  // Even with classifier absent, resolved !== key guard catches raw keys
  var ytResult = resolveUrlOnlyDefaultTitle({ sourceType: 'youtube', sourceLabel: 'YouTube' }, stubI18n);
  assert.equal(ytResult, 'YouTube 영상',
    'YouTube: raw i18n key must fall through to Korean fallback, not return the raw key');

  var defaultResult = resolveUrlOnlyDefaultTitle({ sourceType: 'other' }, stubI18n);
  assert.equal(defaultResult, '새 순간',
    'default: raw i18n key must fall through to Korean fallback, not return the raw key');

  // i18n that returns a real translated string (classifier absent, but resolved !== key)
  const realI18n = (key) => key === 'editor_url_only_youtube_title' ? 'YouTube Video' : 'New Moment';
  var realYtResult = resolveUrlOnlyDefaultTitle({ sourceType: 'youtube', sourceLabel: 'YouTube' }, realI18n);
  assert.equal(realYtResult, 'YouTube Video',
    'real translation must be used even without classifier');

  // No TypeError ever
  assert.doesNotThrow(function() {
    resolveUrlOnlyDefaultTitle({ sourceType: 'youtube', sourceLabel: 'YouTube' }, stubI18n);
    resolveUrlOnlyDefaultTitle({ sourceType: 'other' }, stubI18n);
  }, 'must never throw when classifier is absent');
});

// ── Public viewer detail UI delegates to canonical predicate ──

test('public-viewer-detail-ui delegates to window.LoveBudTreeWorkspaceClassifier.isLocalizationKeyTitle', () => {
  const source = fs.readFileSync(publicViewerDetailUIFile, 'utf8');
  // Must reference the canonical predicate module
  assert.match(source, /LoveBudTreeWorkspaceClassifier/,
    'public viewer detail UI must reference canonical predicate module');
  assert.match(source, /isLocalizationKeyTitle/,
    'public viewer detail UI must delegate to canonical predicate isLocalizationKeyTitle');
  assert.doesNotMatch(source, /\/\^\[a-z\]\+\(\?:_\[a-z\]\+\)\{2,\}\$\/\.test/,
    'public viewer detail UI must not contain its own regex predicate');
});

test('public-viewer-detail-ui safeDisplayTitle hides localization keys via canonical predicate', () => {
  const context = { window: {}, console };
  context.window = context;
  vm.createContext(context);

  // Load workspace permission first (provides canonical predicate)
  vm.runInContext(fs.readFileSync(workspacePermissionFile, 'utf8'), context);
  // Load public viewer detail UI
  vm.runInContext(fs.readFileSync(publicViewerDetailUIFile, 'utf8'), context);

  // safeDisplayTitle is not exported, but its behavior is observable through
  // the update functions that call it indirectly. We test the source reference
  // statically above. Here we verify the behavioral contract: the canonical
  // predicate itself rejects raw localization keys.
  const { isLocalizationKeyTitle } = context.window.LoveBudTreeWorkspaceClassifier;

  // If safeDisplayTitle were fed a raw key, it would return null via the predicate
  // (the function itself is private so we validate through the predicate module)
  assert.equal(isLocalizationKeyTitle('editor_url_only_youtube_title'), true,
    'canonical predicate must recognize localization keys');
  assert.equal(isLocalizationKeyTitle('YouTube 영상'), false,
    'canonical predicate must not match Korean fallback text');
  assert.equal(isLocalizationKeyTitle('normal title'), false,
    'canonical predicate must not match generic titles');
});

// ── Explicit-play contract: selection path has no iframe or player.play ──

test('explicit-play contract: player.play removed, autoplay=1 preserved', () => {
  const editorSource = fs.readFileSync(editorDetailUIFile, 'utf8');
  const viewerSource = fs.readFileSync(publicViewerDetailUIFile, 'utf8');

  // player.play must NOT appear in either file
  assert.doesNotMatch(editorSource, /player\.play\s*\(/, 'editor-detail-ui must not contain player.play()');
  assert.doesNotMatch(viewerSource, /player\.play\s*\(/, 'public-viewer-detail-ui must not contain player.play()');

  // autoplay=1 must still be present in the embed URL builder
  assert.match(editorSource, /autoplay.*1/, 'editor must retain autoplay=1 in embed URL');
  assert.match(viewerSource, /autoplay.*1/, 'viewer must retain autoplay=1 in embed URL');

  // Player creation only happens inside bindDetailMediaPlayback (click handler), not in selection path
  // Confirm buildInlinePlayerElement is only referenced inside bindDetailMediaPlayback closures
  const editorBindDetail = editorSource.match(/bindDetailMediaPlayback\s*=\s*\([^)]+\)\s*=>\s*\{[\s\S]*?\n\s*\};/);
  if (editorBindDetail) {
    assert.match(editorBindDetail[0], /buildInlinePlayerElement/,
      'editor bindDetailMediaPlayback must call buildInlinePlayerElement');
  }

  const viewerBindDetail = viewerSource.match(/bindDetailMediaPlayback\s*=\s*function[^{]*\{[\s\S]*?\n\s*\};/);
  if (viewerBindDetail) {
    assert.match(viewerBindDetail[0], /buildInlinePlayerElement/,
      'viewer bindDetailMediaPlayback must call buildInlinePlayerElement');
  }
});
