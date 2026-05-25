/**
 * Contract test for YouTube oEmbed title ingestion path in
 * js/editor/editor-empty-guide-ui.js.
 *
 * The oEmbed title is external metadata (from YouTube's API) and must be
 * treated as untrusted user-generated content. This contract verifies the
 * title only enters the DOM through `.value = title` (safe input field),
 * never through .innerHTML, .insertAdjacentHTML, or .outerHTML.
 *
 * XSS payload references:
 *   - `<img src=x onerror=alert(1)>`
 *   - `"><svg onload=alert(1)>`
 *   - `<a href="javascript:alert(1)">x</a>`
 *
 * Scope:
 *   - fetchYoutubeTitle encoding: encodeURIComponent(url) must be used
 *   - createMemoryFromQuickYoutube: title must only reach input.value
 *   - No DOM HTML sink in the title ingestion path
 *
 * Out of scope:
 *   - oEmbed fetch policy / network error handling
 *   - YouTube URL validation strength
 *   - Memory title renderer escaping (handled in #1649/#1651)
 */

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const FILE_PATH = path.resolve(__dirname, '../..', 'js/editor/editor-empty-guide-ui.js');

function readSource() {
  return fs.readFileSync(FILE_PATH, 'utf8');
}

/**
 * Extract the body of an async function by name, assuming standard
 * indentation and brace matching within the same file closure.
 *
 * Handles the pattern:
 *   async function funcName(args) {
 *      ...body...
 *   }
 */
function extractAsyncFunctionBlock(source, name) {
  // Match the start of the function including any preceding closure
  const pattern = `async function ${name}`;
  const start = source.indexOf(pattern);
  assert.notEqual(start, -1, `async function ${name} should exist in source`);

  // Fast-forward past the parameter list to find opening brace
  const openBrace = source.indexOf('{', start);
  assert.notEqual(openBrace, -1, `async function ${name} should have opening brace`);

  let depth = 0;
  let inString = null;
  for (let i = openBrace; i < source.length; i++) {
    const ch = source[i];
    // Track string literals to avoid counting braces inside strings
    if (inString) {
      if (ch === '\\') { i++; continue; }
      if (ch === inString) inString = null;
      continue;
    }
    if (ch === "'" || ch === '"' || ch === '`') inString = ch;
    if (ch === '{') depth++;
    if (ch === '}') depth--;
    if (depth === 0) return source.slice(openBrace, i + 1);
  }

  assert.fail(`async function ${name} body should be closed`);
}

// ─── XSS PAYLOAD CONSTANTS ─────────────────────────────────────────────────

const XSS_PAYLOADS = [
  '<img src=x onerror=alert(1)>',
  '"><svg onload=alert(1)>',
  '<a href="javascript:alert(1)">x</a>',
];

// ─── TEST 1: fetchYoutubeTitle uses encodeURIComponent ────────────────────

test('fetchYoutubeTitle builds oEmbed URL with encodeURIComponent(url)', () => {
  const source = readSource();
  const body = extractAsyncFunctionBlock(source, 'fetchYoutubeTitle');

  // Must use encodeURIComponent for YouTube URL → oEmbed URL
  assert.match(body, /encodeURIComponent\s*\(\s*url\s*\)/,
    'oEmbed URL must encode the YouTube URL with encodeURIComponent');

  // Must construct proper oEmbed URL
  assert.match(body, /https:\/\/www\.youtube\.com\/oembed\?url=/,
    'fetchYoutubeTitle must construct youtube.com/oembed URL');

  // Should NOT double-encode the URL
  assert.match(body, /encodeURIComponent\s*\(\s*url\s*\)/,
    'encodeURIComponent should wrap the raw url parameter');
  assert.doesNotMatch(body, /encodeURIComponent\s*\(\s*encodeURIComponent/,
    'must not double-encode the URL');
});

// ─── TEST 2: createMemoryFromQuickYoutube uses input.value, not innerHTML ──

test('createMemoryFromQuickYoutube sets title through memoryTitleInput.value only', () => {
  const source = readSource();
  const body = extractAsyncFunctionBlock(source, 'createMemoryFromQuickYoutube');

  // The title assignment must go through .value (safe input path)
  assert.match(body, /memoryTitleInput\.value\s*=\s*title/,
    'oEmbed title must be assigned to memoryTitleInput.value');
  assert.match(body, /memoryTitleInput\.value\s*=\s*title/,
    'the assignment should not be wrapped in escapeHtml (value assignment is safe and intentional)');

  // Must NOT assign title through innerHTML
  assert.doesNotMatch(body, /innerHTML\s*=.*title/,
    'must not assign title through innerHTML');

  // Must NOT assign title through insertAdjacentHTML
  assert.doesNotMatch(body, /insertAdjacentHTML.*\btitle\b/,
    'must not assign title through insertAdjacentHTML');

  // Must NOT assign title through outerHTML
  assert.doesNotMatch(body, /outerHTML\s*=.*\btitle\b/,
    'must not assign title through outerHTML');
});

// ─── TEST 3: oEmbed URL encoding pattern ──────────────────────────────────

test('fetchYoutubeTitle constructs oEmbed URL with format=json', () => {
  const source = readSource();
  const body = extractAsyncFunctionBlock(source, 'fetchYoutubeTitle');

  assert.match(body, /format=json/,
    'oEmbed request must request JSON format');

  // The exact pattern of the template literal URL construction
  const urlPattern = /https:\/\/www\.youtube\.com\/oembed\?url=\$\{encodeURIComponent\(url\)\}&format=json/;
  assert.match(body, urlPattern,
    'oEmbed URL must follow the exact pattern: `https://www.youtube.com/oembed?url=${encodeURIComponent(url)}&format=json`');
});

// ─── TEST 4: fetchYoutubeTitle returns data.title or '' ───────────────────

test('fetchYoutubeTitle returns data.title from oEmbed response', () => {
  const source = readSource();
  const body = extractAsyncFunctionBlock(source, 'fetchYoutubeTitle');

  // Must access data.title from the JSON response
  assert.match(body, /data\.title/,
    'fetchYoutubeTitle must access data.title from oEmbed response');

  // Must return empty string if data.title is falsy
  assert.match(body, /data\.title.*:.*''/,
    'fetchYoutubeTitle must return empty string when title is unavailable');

  // Should parse response as JSON
  assert.match(body, /response\.json\s*\(\)/,
    'fetchYoutubeTitle must parse oEmbed response as JSON');
});

// ─── TEST 5: fetchYoutubeTitle has error handling ─────────────────────────

test('fetchYoutubeTitle has try-catch for fetch/JSON errors', () => {
  const source = readSource();
  const body = extractAsyncFunctionBlock(source, 'fetchYoutubeTitle');

  // Must have try-catch for network errors
  assert.match(body, /catch\s*\(/, 'fetchYoutubeTitle must have error handling');
  assert.match(body, /return\s*''/, 'fetchYoutubeTitle must return empty string on error');
});

// ─── TEST 6: createMemoryFromQuickYoutube calls fetchYoutubeTitle for title─

test('createMemoryFromQuickYoutube awaits fetchYoutubeTitle for title ingestion', () => {
  const source = readSource();
  const body = extractAsyncFunctionBlock(source, 'createMemoryFromQuickYoutube');

  assert.match(body, /await\s+fetchYoutubeTitle\s*\(\s*url\s*\)/,
    'createMemoryFromQuickYoutube must await fetchYoutubeTitle(url) for title');

  // The title must be stored in a variable before assignment
  const titleAssign = body.match(/const\s+title\s*=\s*await\s+fetchYoutubeTitle/);
  assert.ok(titleAssign !== null,
    'createMemoryFromQuickYoutube must store the result of fetchYoutubeTitle in a variable');
});

// ─── TEST 7: URL is trimmed before processing ──────────────────────────────

test('createMemoryFromQuickYoutube trims the URL before processing', () => {
  const source = readSource();
  const body = extractAsyncFunctionBlock(source, 'createMemoryFromQuickYoutube');

  const trimmedAssign = body.match(/\burl\b.*=.*\btitle\b.*\.trim\s*\(/);
  // The URL should be trimmed: const url = (rawUrl || '').trim();
  assert.match(body, /\.trim\s*\(\s*\)/,
    'createMemoryFromQuickYoutube must trim the raw URL');
});

// ─── TEST 8: XSS payload injection through the value path is the
//            expected safe behavior. When XSS payloads reach title,
//            they enter an <input> element's value property which
//            the browser treats as plain text, not HTML.

test.skip('XSS payload through oEmbed title path is blocked by .value assignment', () => {
  // This is a runtime-like test that documents the safety property:
  //   memoryTitleInput.value = '<img src=x onerror=alert(1)>'
  // sets the input to literal text, not rendered HTML.
  //
  // Skipped because we only do static contract analysis in this file.
  // The property is enforced by the browser's input element behavior
  // and verified in Test 2 above (value assignment, not innerHTML).
  //
  // After the memory is saved, the title passes through the existing
  // editor/public viewer/search renderer escapeHtml paths covered by
  // tests in PR #1649/#1651.
});
