const assert = require('node:assert/strict');
const fs = require('node:fs');
const test = require('node:test');

const editorSource = fs.readFileSync('js/editor.js', 'utf8');
const rootUtilsSource = fs.readFileSync('js/editor/editor-utils.js', 'utf8');
const shellHelpersSource = fs.readFileSync('js/editor/editor-shell-utils.js', 'utf8');

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
  assert.match(shellHelpersSource, /i18n\('editor_channel_source_record_prompt'\)/);
  assert.match(shellHelpersSource, /이 채널을 순간의 출처로 기록할까요\?/);
  assert.match(shellHelpersSource, /앞으로 러브트리에 심을 순간들이 나오는 곳/);
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
  const channelIndex = block.indexOf("i18n('editor_channel_source_record_prompt')");
  const lengthIndex = block.indexOf("i18n('invalid_youtube_id_length')");
  const invalidIndex = block.indexOf("i18n('invalid_youtube')");

  assert.ok(emptyIndex < formatIndex, 'empty input check must happen before format check');
  assert.ok(formatIndex < unsupportedIndex, 'format check must happen before unsupported domain check');
  assert.ok(unsupportedIndex < channelIndex, 'unsupported domain check must happen before channel source prompt');
  assert.ok(channelIndex < lengthIndex, 'channel source prompt must happen before id length check');
  assert.ok(lengthIndex < invalidIndex, 'id length check must happen before generic invalid check');

  assert.match(block, /\^\(https\?:\\\/\\\/\|www\\\.\)/);
  assert.match(block, /youtube\\\.com\|youtu\\\.be\|youtube\\\.com\\\/shorts\\\//);
  assert.match(block, /youtube\\\.com\\\/\(@\|channel\\\/\|c\\\/\|user\\\/\)/);
  assert.match(block, /\(\[0-9A-Za-z_-\]\+\)/);
});

test('editor root utils keep channel source prompt aligned with fallback', () => {
  assert.match(rootUtilsSource, /utils\.getYouTubeInputErrorMessage\s*=\s*function\(i18n,\s*rawUrl\)/);
  assert.match(rootUtilsSource, /LoveBudMedia\?\.isYouTubeChannelUrl\?\.\(value\)/);
  assert.match(rootUtilsSource, /youtube\\\.com\\\/\(@\|channel\\\/\|c\\\/\|user\\\/\)/);
  assert.match(rootUtilsSource, /i18n\('editor_channel_source_record_prompt'\)/);
  assert.match(rootUtilsSource, /이 채널을 순간의 출처로 기록할까요\?/);

  const unsupportedIndex = rootUtilsSource.indexOf("i18n('invalid_youtube_unsupported')");
  const channelIndex = rootUtilsSource.indexOf("i18n('editor_channel_source_record_prompt')");
  const lengthIndex = rootUtilsSource.indexOf("i18n('invalid_youtube_id_length')");

  assert.ok(unsupportedIndex < channelIndex, 'root utils must reject non-YouTube URLs before channel prompt');
  assert.ok(channelIndex < lengthIndex, 'root utils must show channel prompt before video id length errors');
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
    /getYouTubeInputErrorMessage:\s*\(rawUrl\)\s*=>\s*deps\.getYouTubeInputErrorMessage\(deps\.i18n,\s*rawUrl\)/
  );
});
