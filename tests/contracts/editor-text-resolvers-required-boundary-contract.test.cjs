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
  // safeI18nText still has local alias
  assert.match(editorSource, /const\s+safeI18nText\s*=\s*deps\.safeI18nText/);
  assert.doesNotMatch(editorSource, /const\s+safeI18nText\s*=\s*deps\.safeI18nText\s*\|\|/);
  assert.doesNotMatch(editorSource, /typeof\s+safeI18nText\s*!==\s*'function'/);

  // resolveHintText, resolveTreeTitleText, resolveInfoText: used directly at call site
  assert.match(editorSource, /deps\.resolveHintText/);
  assert.match(editorSource, /deps\.resolveTreeTitleText/);
  assert.match(editorSource, /deps\.resolveInfoText/);
  // No local aliases for these three
  assert.doesNotMatch(editorSource, /const\s+resolveHintText\s*=\s*deps\.resolveHintText/);
  assert.doesNotMatch(editorSource, /const\s+resolveTreeTitleText\s*=\s*deps\.resolveTreeTitleText/);
  assert.doesNotMatch(editorSource, /const\s+resolveInfoText\s*=\s*deps\.resolveInfoText/);

  // No fallback via || for any of them
  const fallbackPatterns = [
    /const\s+safeI18nText\s*=\s*deps\.safeI18nText\s*\|\|/,
    /const\s+resolveHintText\s*=\s*deps\.resolveHintText\s*\|\|/,
    /const\s+resolveTreeTitleText\s*=\s*deps\.resolveTreeTitleText\s*\|\|/,
    /const\s+resolveInfoText\s*=\s*deps\.resolveInfoText\s*\|\|/
  ];

  fallbackPatterns.forEach((pattern) => {
    assert.doesNotMatch(editorSource, pattern);
  });

  // No typeof guards for text resolvers (they come through deps now)
  const typeOfGuardPatterns = [
    /typeof\s+safeI18nText\s*!==\s*'function'/,
    /typeof\s+resolveHintText\s*!==\s*'function'/,
    /typeof\s+resolveTreeTitleText\s*!==\s*'function'/,
    /typeof\s+resolveInfoText\s*!==\s*'function'/
  ];

  typeOfGuardPatterns.forEach((pattern) => {
    assert.doesNotMatch(editorSource, pattern);
  });
});

test('editor.js removes createInlineTextResolversFallbacks and inlineTextResolvers adapter', () => {
  assert.doesNotMatch(editorSource, /createInlineTextResolversFallbacks/);
  assert.doesNotMatch(editorSource, /inlineTextResolvers/);
});

test('editor.js no longer has missing-text-resolvers aggregate guard (guard removed in favor of direct deps)', () => {
  assert.doesNotMatch(editorSource, /missingTextResolvers/);
  assert.doesNotMatch(editorSource, /LoveBudEditorHelpers\.safeI18nText/);
  assert.doesNotMatch(editorSource, /LoveBudEditorHelpers\.resolveHintText/);
  assert.doesNotMatch(editorSource, /LoveBudEditorHelpers\.resolveTreeTitleText/);
  assert.doesNotMatch(editorSource, /LoveBudEditorHelpers\.resolveInfoText/);
  assert.doesNotMatch(editorSource, /reportEditorBootstrapMissingList\(missingTextResolvers\)/);
});

test('editor.js requires media resolver helpers through required boundaries', () => {
  // escapeHtml now via inline deps pattern, resolveMemoryThumbnail via deps pattern
  assert.match(editorSource, /deps\.escapeHtml/);
  assert.match(editorSource, /const\s+resolveMemoryThumbnail\s*=\s*deps\.resolveMemoryThumbnail/);
  // safeUrl is no longer directly referenced in editor.js (used internally by editor-helpers.js)
  assert.doesNotMatch(editorSource, /safeUrl/);

  // No more fallback via ||
  assert.doesNotMatch(editorSource, /escapeHtml\s*=\s*deps\.escapeHtml\s*\|\|/);
  assert.doesNotMatch(editorSource, /resolveMemoryThumbnail\s*=\s*deps\.resolveMemoryThumbnail\s*\|\|/);

  // Adapter pattern removed
  assert.doesNotMatch(editorSource, /createInlineMediaResolversFallbacks/);
  assert.doesNotMatch(editorSource, /resolverFallbacks\.createInlineMediaResolversFallbacks/);
  assert.doesNotMatch(editorSource, /inlineMediaResolvers/);

  // No aggregate missing-media-resolvers guard (removed in favor of direct deps)
  assert.doesNotMatch(editorSource, /missingMediaResolvers/);
  assert.doesNotMatch(editorSource, /LoveBudEditorHelpers\.escapeHtml/);
  assert.doesNotMatch(editorSource, /LoveBudEditorHelpers\.safeUrl/);
  assert.doesNotMatch(editorSource, /LoveBudEditorHelpers\.resolveMemoryThumbnail/);

  // No typeof guards for media resolvers
  assert.doesNotMatch(editorSource, /typeof\s+escapeHtml\s*!==\s*'function'/);
  assert.doesNotMatch(editorSource, /typeof\s+safeUrl\s*!==\s*'function'/);
  assert.doesNotMatch(editorSource, /typeof\s+resolveMemoryThumbnail\s*!==\s*'function'/);
});

test('editor.js keeps text resolver required boundaries intact', () => {
  assert.match(editorSource, /const\s+safeI18nText\s*=\s*deps\.safeI18nText/);
  assert.doesNotMatch(editorSource, /const\s+resolveHintText\s*=\s*deps\.resolveHintText/);
  assert.doesNotMatch(editorSource, /const\s+resolveTreeTitleText\s*=\s*deps\.resolveTreeTitleText/);
  assert.doesNotMatch(editorSource, /const\s+resolveInfoText\s*=\s*deps\.resolveInfoText/);
  assert.match(editorSource, /deps\.resolveHintText/);
  assert.match(editorSource, /deps\.resolveTreeTitleText/);
  assert.match(editorSource, /deps\.resolveInfoText/);
  assert.doesNotMatch(editorSource, /missingTextResolvers/);
  assert.doesNotMatch(editorSource, /typeof\s+safeI18nText/);
});
