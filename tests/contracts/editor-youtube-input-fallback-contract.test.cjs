const assert = require('node:assert/strict');
const fs = require('node:fs');
const test = require('node:test');

const editorSource = fs.readFileSync('js/editor.js', 'utf8');
const shellHelpersSource = fs.readFileSync('js/editor/editor-shell-helpers.js', 'utf8');

test('editor shell helpers expose YouTube input error fallback helper', () => {
  assert.match(shellHelpersSource, /getYouTubeInputErrorMessageFallback:\s*function\(i18n,\s*rawUrl\)/);
  assert.match(shellHelpersSource, /String\(rawUrl \|\| ''\)\.trim\(\)/);
});

test('YouTube fallback preserves i18n keys and Korean fallback copy', () => {
  assert.match(shellHelpersSource, /i18n\('enter_youtube'\)/);
  assert.match(shellHelpersSource, /YouTube 링크를 입력해 주세요\./);
  assert.match(shellHelpersSource, /i18n\('invalid_youtube_format'\)/);
  assert.match(shellHelpersSource, /전체 YouTube 링크를 붙여 넣어 주세요\./);
  assert.match(shellHelpersSource, /i18n\('invalid_youtube_unsupported'\)/);
  assert.match(shellHelpersSource, /YouTube 링크만 지원합니다\. youtube\.com 또는 youtu\.be 링크를 사용해 주세요\./);
  assert.match(shellHelpersSource, /i18n\('invalid_youtube_id_length'\)/);
  assert.match(shellHelpersSource, /링크가 중간에 잘린 것 같아요\. 전체 YouTube 링크를 다시 복사해 주세요\./);
  assert.match(shellHelpersSource, /i18n\('invalid_youtube'\)/);
  assert.match(shellHelpersSource, /유효한 YouTube 링크를 입력해 주세요\./);
});

test('YouTube fallback preserves validation order and regex checks', () => {
  const helperStart = shellHelpersSource.indexOf('getYouTubeInputErrorMessageFallback');
  assert.notEqual(helperStart, -1, 'fallback helper must exist');

  const helperEnd = shellHelpersSource.indexOf('};', helperStart);
  assert.notEqual(helperEnd, -1, 'fallback helper must end');

  const block = shellHelpersSource.slice(helperStart, helperEnd);

  const emptyIndex = block.indexOf("i18n('enter_youtube')");
  const formatIndex = block.indexOf("i18n('invalid_youtube_format')");
  const unsupportedIndex = block.indexOf("i18n('invalid_youtube_unsupported')");
  const lengthIndex = block.indexOf("i18n('invalid_youtube_id_length')");
  const invalidIndex = block.indexOf("i18n('invalid_youtube')");

  assert.ok(emptyIndex < formatIndex, 'empty input check must happen before format check');
  assert.ok(formatIndex < unsupportedIndex, 'format check must happen before unsupported domain check');
  assert.ok(unsupportedIndex < lengthIndex, 'unsupported domain check must happen before id length check');
  assert.ok(lengthIndex < invalidIndex, 'id length check must happen before generic invalid check');

  assert.match(block, /\^\(https\?:\\\/\\\/\|www\\\.\)/);
  assert.match(block, /youtube\\\.com\|youtu\\\.be\|youtube\\\.com\\\/shorts\\\//);
  assert.match(block, /\(\[0-9A-Za-z_-\]\+\)/);
});

test('editor.js delegates getYouTubeInputErrorMessage directly from deps', () => {
  assert.match(
    editorSource,
    /deps\.getYouTubeInputErrorMessage/
  );
  assert.doesNotMatch(
    editorSource,
    /const\s+getYouTubeInputErrorMessage\s*=\s*deps\.getYouTubeInputErrorMessage;/
  );
  assert.doesNotMatch(
    editorSource,
    /const\s+getYouTubeInputErrorMessage\s*=\s*typeof rootUtils\.getYouTubeInputErrorMessage/
  );
  assert.doesNotMatch(
    editorSource,
    /getYouTubeInputErrorMessageFallback/
  );
});

test('editor.js no longer owns getYouTubeInputErrorMessageFallback guard or wrapper', () => {
  assert.doesNotMatch(editorSource, /getYouTubeInputErrorMessageFallback/);
  assert.doesNotMatch(editorSource, /typeof rootUtils\.getYouTubeInputErrorMessage/);
  assert.doesNotMatch(editorSource, /LoveBudEditorShellHelpers\.getYouTubeInputErrorMessageFallback missing/);
});

test('editor no longer owns local YouTube validation body inside wrapper', () => {
  assert.doesNotMatch(editorSource, /String\(rawUrl \|\| ''\)\.trim\(\)/);
  assert.doesNotMatch(editorSource, /invalid_youtube_unsupported/);
  assert.doesNotMatch(editorSource, /invalid_youtube_id_length/);
});

test('memory form keeps YouTube input error message injection intact', () => {
  assert.match(
    editorSource,
    /getYouTubeInputErrorMessage:\s*\(rawUrl\)\s*=>\s*deps\.getYouTubeInputErrorMessage\(i18n,\s*rawUrl\)/
  );
});
