const assert = require('node:assert/strict');
const fs = require('node:fs');
const test = require('node:test');

const editorSource = fs.readFileSync('js/editor.js', 'utf8');
const editorHelpersSource = fs.readFileSync('js/editor/editor-helpers.js', 'utf8');

test('editor helpers expose text resolver functions', () => {
  assert.match(editorHelpersSource, /safeI18nText:\s*safeI18nText/);
  assert.match(editorHelpersSource, /resolveHintText:\s*resolveHintText/);
  assert.match(editorHelpersSource, /resolveTreeTitleText:\s*resolveTreeTitleText/);
  assert.match(editorHelpersSource, /resolveInfoText:\s*resolveInfoText/);
  assert.match(editorHelpersSource, /function\s+safeI18nText\(i18nFn,\s*key,\s*fallback\)/);
  assert.match(editorHelpersSource, /function\s+resolveHintText\(i18nFn,\s*rawValue,\s*fallbackKey,\s*fallbackText\)/);
  assert.match(editorHelpersSource, /function\s+resolveTreeTitleText\(i18nFn,\s*rawTitle\)/);
  assert.match(editorHelpersSource, /function\s+resolveInfoText\(i18nFn,\s*rawValue,\s*fallbackKey,\s*fallbackText\)/);
});

test('editor.js delegates all four text resolvers through required helpers', () => {
  const requiredPattern = [
    /const\s+safeI18nText\s*=\s*editorHelpers\.safeI18nText/,
    /const\s+resolveHintText\s*=\s*editorHelpers\.resolveHintText/,
    /const\s+resolveTreeTitleText\s*=\s*editorHelpers\.resolveTreeTitleText/,
    /const\s+resolveInfoText\s*=\s*editorHelpers\.resolveInfoText/
  ];

  requiredPattern.forEach((pattern) => {
    assert.match(editorSource, pattern);
  });

  // No fallback via || for any of them
  const fallbackPatterns = [
    /const\s+safeI18nText\s*=\s*editorHelpers\.safeI18nText\s*\|\|/,
    /const\s+resolveHintText\s*=\s*editorHelpers\.resolveHintText\s*\|\|/,
    /const\s+resolveTreeTitleText\s*=\s*editorHelpers\.resolveTreeTitleText\s*\|\|/,
    /const\s+resolveInfoText\s*=\s*editorHelpers\.resolveInfoText\s*\|\|/
  ];

  fallbackPatterns.forEach((pattern) => {
    assert.doesNotMatch(editorSource, pattern);
  });
});

test('editor.js removes createInlineTextResolversFallbacks and inlineTextResolvers adapter', () => {
  assert.doesNotMatch(editorSource, /createInlineTextResolversFallbacks/);
  assert.doesNotMatch(editorSource, /inlineTextResolvers/);
});

test('editor.js adds missing-text-resolvers guard without reportError', () => {
  assert.match(editorSource, /missingTextResolvers/);
  // Array entries with helper names
  assert.match(editorSource, /LoveBudEditorHelpers\.safeI18nText/);
  assert.match(editorSource, /LoveBudEditorHelpers\.resolveHintText/);
  assert.match(editorSource, /LoveBudEditorHelpers\.resolveTreeTitleText/);
  assert.match(editorSource, /LoveBudEditorHelpers\.resolveInfoText/);
  // Dynamic join creates 'name missing' for each
  assert.match(editorSource, /name\s*\+\s*' missing'/);
  assert.match(editorSource, /missingTextResolvers\.map\(/);

  const guardStart = editorSource.indexOf('missingTextResolvers');
  assert.notEqual(guardStart, -1, 'guard must exist');
  const guardEnd = editorSource.indexOf('const syncCurrentTreeData', guardStart);
  assert.notEqual(guardEnd, -1, 'syncCurrentTreeData must follow guard');

  const guardBlock = editorSource.slice(guardStart, guardEnd);
  assert.doesNotMatch(guardBlock, /reportError\(/);
});

test('editor.js requires media resolver helpers through required boundaries', () => {
  // Three media resolvers now required via direct assignment
  assert.match(editorSource, /const\s+escapeHtml\s*=\s*editorHelpers\.escapeHtml\b[^|]/);
  assert.match(editorSource, /const\s+safeUrl\s*=\s*editorHelpers\.safeUrl\b[^|]/);
  assert.match(editorSource, /const\s+resolveMemoryThumbnail\s*=\s*editorHelpers\.resolveMemoryThumbnail\b[^|]/);

  // No more fallback via ||
  assert.doesNotMatch(editorSource, /escapeHtml\s*=\s*editorHelpers\.escapeHtml\s*\|\|/);
  assert.doesNotMatch(editorSource, /resolveMemoryThumbnail\s*=\s*editorHelpers\.resolveMemoryThumbnail\s*\|\|/);

  // Adapter pattern removed
  assert.doesNotMatch(editorSource, /createInlineMediaResolversFallbacks/);
  assert.doesNotMatch(editorSource, /resolverFallbacks\.createInlineMediaResolversFallbacks/);
  assert.doesNotMatch(editorSource, /inlineMediaResolvers/);

  // Missing-helper guard exists
  assert.match(editorSource, /missingMediaResolvers/);
  assert.match(editorSource, /LoveBudEditorHelpers\.escapeHtml/);
  assert.match(editorSource, /LoveBudEditorHelpers\.safeUrl/);
  assert.match(editorSource, /LoveBudEditorHelpers\.resolveMemoryThumbnail/);

  // Guard does not use reportError
  const guardStart = editorSource.indexOf('missingMediaResolvers');
  assert.notEqual(guardStart, -1, 'guard must exist');
  const guardEnd = editorSource.indexOf('const getYouTubeInputErrorMessageFallback', guardStart);
  assert.notEqual(guardEnd, -1, 'getYouTubeInputErrorMessageFallback must follow guard');
  const guardBlock = editorSource.slice(guardStart, guardEnd);
  assert.doesNotMatch(guardBlock, /reportError\(/);
});

test('editor.js keeps text resolver required boundaries intact', () => {
  assert.match(editorSource, /const\s+safeI18nText\s*=\s*editorHelpers\.safeI18nText/);
  assert.match(editorSource, /const\s+resolveHintText\s*=\s*editorHelpers\.resolveHintText/);
  assert.match(editorSource, /const\s+resolveTreeTitleText\s*=\s*editorHelpers\.resolveTreeTitleText/);
  assert.match(editorSource, /const\s+resolveInfoText\s*=\s*editorHelpers\.resolveInfoText/);
  assert.match(editorSource, /missingTextResolvers/);
});
