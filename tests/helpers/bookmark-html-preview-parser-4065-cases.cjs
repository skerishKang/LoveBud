'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const PARSER_FILE = path.resolve(__dirname, '../../js/import/bookmark-html-preview-parser.js');
const PARSER_SOURCE = fs.readFileSync(PARSER_FILE, 'utf8');

function loadParser() {
  const sandbox = {
    window: {},
    module: { exports: {} },
    exports: {},
    URL,
    TextEncoder,
    encodeURIComponent,
    unescape,
  };
  vm.runInNewContext(PARSER_SOURCE, sandbox, { filename: PARSER_FILE });
  return sandbox.module.exports;
}

const parser = loadParser();

function exportedHtml(body) {
  return [
    '<!DOCTYPE NETSCAPE-Bookmark-file-1>',
    '<META HTTP-EQUIV="Content-Type" CONTENT="text/html; charset=UTF-8">',
    '<TITLE>Bookmarks</TITLE>',
    '<H1>Bookmarks</H1>',
    '<DL><p>',
    body,
    '</DL><p>',
  ].join('\n');
}

function expectError(code, fn) {
  assert.throws(fn, (error) => error && error.name === 'BookmarkHtmlPreviewError' && error.code === code);
}

test('preserves nested folder path and source occurrence order', () => {
  const html = exportedHtml([
    '<DT><H3>Music</H3>',
    '<DL><p>',
    '<DT><A HREF="https://example.com/a" ADD_DATE="123">Alpha</A>',
    '<DT><H3>Live</H3>',
    '<DL><p>',
    '<DT><A HREF="https://example.com/b">Beta</A>',
    '</DL><p>',
    '</DL><p>',
    '<DT><A HREF="https://example.com/root">Root</A>',
  ].join('\n'));

  const result = parser.parseBookmarkHtmlPreview(html);
  assert.equal(result.itemCount, 3);
  assert.equal(result.supportedCount, 3);
  assert.deepEqual(Array.from(result.entries, (entry) => entry.sourceIndex), [0, 1, 2]);
  assert.deepEqual(Array.from(result.entries[0].folderPath), ['Music']);
  assert.deepEqual(Array.from(result.entries[1].folderPath), ['Music', 'Live']);
  assert.deepEqual(Array.from(result.entries[2].folderPath), []);
  assert.equal(result.entries[0].addDateUnixSeconds, 123);
  assert.equal(result.entries[0].url, 'https://example.com/a');
});

test('keeps duplicate URLs as independent occurrences', () => {
  const html = exportedHtml([
    '<DT><A HREF="https://example.com/repeat">First occurrence</A>',
    '<DT><A HREF="https://example.com/repeat">Second occurrence</A>',
  ].join('\n'));
  const result = parser.parseBookmarkHtmlPreview(html);
  assert.equal(result.itemCount, 2);
  assert.equal(result.entries[0].url, result.entries[1].url);
  assert.notEqual(result.entries[0].occurrenceKey, result.entries[1].occurrenceKey);
  assert.deepEqual(Array.from(result.entries, (entry) => entry.occurrenceKey), ['bookmark:0', 'bookmark:1']);
});

test('accepts only http/https and strips navigation authority from unsafe entries', () => {
  const html = exportedHtml([
    '<DT><A HREF="http://example.com/one">HTTP</A>',
    '<DT><A HREF="https://example.com/two?x=1&amp;y=2">HTTPS</A>',
    '<DT><A HREF="javascript:alert(1)">JS</A>',
    '<DT><A HREF="data:text/html,boom">Data</A>',
    '<DT><A HREF="file:///tmp/a">File</A>',
    '<DT><A HREF="chrome://settings">Chrome</A>',
    '<DT><A HREF="ftp://example.com/file">FTP</A>',
    '<DT><A HREF="relative/path">Relative</A>',
    '<DT><A>No href</A>',
    '<DT><A HREF="https://user:pass@example.com/private">Credentials</A>',
  ].join('\n'));
  const result = parser.parseBookmarkHtmlPreview(html);
  assert.equal(result.supportedCount, 2);
  assert.equal(result.unsupportedCount, 8);
  assert.equal(result.entries[1].url, 'https://example.com/two?x=1&y=2');
  assert.equal(result.entries[2].reasonCode, parser.REASON_CODES.UNSUPPORTED_SCHEME);
  assert.equal(result.entries[7].reasonCode, parser.REASON_CODES.INVALID_URL);
  assert.equal(result.entries[8].reasonCode, parser.REASON_CODES.MISSING_HREF);
  assert.equal(result.entries[9].reasonCode, parser.REASON_CODES.URL_CREDENTIALS_FORBIDDEN);
  for (const entry of Array.from(result.entries).slice(2)) {
    assert.equal(entry.supported, false);
    assert.equal(entry.url, null);
  }
});

test('treats HTML/script-like bookmark content as inert title data', () => {
  globalThis.__bookmarkParserExecuted = false;
  const html = exportedHtml(
    '<DT><A HREF="https://example.com/x"><img src=x onerror="globalThis.__bookmarkParserExecuted=true">Hello<script>globalThis.__bookmarkParserExecuted=true</script></A>'
  );
  const result = parser.parseBookmarkHtmlPreview(html);
  assert.equal(globalThis.__bookmarkParserExecuted, false);
  assert.equal(result.entries[0].supported, true);
  assert.equal(result.entries[0].title.includes('<'), false);
  delete globalThis.__bookmarkParserExecuted;
});

test('decodes bounded common and numeric HTML entities as plain text', () => {
  const html = exportedHtml('<DT><A HREF="https://example.com/a">Fish &amp; Chips &#x1f41f;</A>');
  const result = parser.parseBookmarkHtmlPreview(html);
  assert.equal(result.entries[0].title, 'Fish & Chips 🐟');
});

test('fails closed on invalid input/options and oversized input', () => {
  expectError('INVALID_INPUT', () => parser.parseBookmarkHtmlPreview(null));
  expectError('INVALID_OPTIONS', () => parser.parseBookmarkHtmlPreview(exportedHtml(''), { maxItems: 0 }));
  expectError('INPUT_TOO_LARGE', () =>
    parser.parseBookmarkHtmlPreview(exportedHtml('<DT><A HREF="https://example.com">x</A>'), { maxInputBytes: 20 })
  );
});

test('fails atomically when item count exceeds the bounded limit', () => {
  const html = exportedHtml([
    '<DT><A HREF="https://example.com/1">1</A>',
    '<DT><A HREF="https://example.com/2">2</A>',
  ].join('\n'));
  expectError('ITEM_LIMIT_EXCEEDED', () => parser.parseBookmarkHtmlPreview(html, { maxItems: 1 }));
});

test('fails closed when nested folder depth exceeds the bounded limit', () => {
  const html = exportedHtml([
    '<DT><H3>One</H3>',
    '<DL><p>',
    '<DT><H3>Two</H3>',
    '<DL><p>',
    '<DT><A HREF="https://example.com">x</A>',
    '</DL><p>',
    '</DL><p>',
  ].join('\n'));
  expectError('FOLDER_DEPTH_EXCEEDED', () => parser.parseBookmarkHtmlPreview(html, { maxFolderDepth: 1 }));
});

test('rejects malformed/incomplete bookmark structures without returning partial preview', () => {
  expectError('MALFORMED_BOOKMARK_HTML', () =>
    parser.parseBookmarkHtmlPreview(exportedHtml('<DT><A HREF="https://example.com/a">Alpha'))
  );
  expectError('MALFORMED_BOOKMARK_HTML', () =>
    parser.parseBookmarkHtmlPreview('<DL><p><DT><A HREF="https://example.com/a">Alpha</A>')
  );
  expectError('MALFORMED_BOOKMARK_HTML', () => parser.parseBookmarkHtmlPreview('<html><body>hello</body></html>'));
});

test('bounds title and URL fields deterministically', () => {
  expectError('TEXT_FIELD_TOO_LARGE', () =>
    parser.parseBookmarkHtmlPreview(exportedHtml('<DT><A HREF="https://example.com">abcdef</A>'), { maxTitleChars: 5 })
  );
  const result = parser.parseBookmarkHtmlPreview(
    exportedHtml('<DT><A HREF="https://example.com/abcdef">x</A>'),
    { maxUrlChars: 20 }
  );
  assert.equal(result.entries[0].supported, false);
  assert.equal(result.entries[0].reasonCode, parser.REASON_CODES.URL_TOO_LONG);
});

test('returns frozen detached preview state', () => {
  const result = parser.parseBookmarkHtmlPreview(exportedHtml('<DT><A HREF="https://example.com">Immutable</A>'));
  assert.equal(Object.isFrozen(result), true);
  assert.equal(Object.isFrozen(result.entries), true);
  assert.equal(Object.isFrozen(result.entries[0]), true);
  assert.equal(Object.isFrozen(result.entries[0].folderPath), true);
  assert.equal(Object.isFrozen(result.limits), true);
  assert.throws(() => {
    result.entries[0].title = 'changed';
  }, TypeError);
  assert.equal(result.entries[0].title, 'Immutable');
});

test('source boundary contains no network, DOM, or browser persistence capability', () => {
  assert.equal(/\bfetch\s*\(/.test(PARSER_SOURCE), false);
  assert.equal(/\bXMLHttpRequest\b/.test(PARSER_SOURCE), false);
  assert.equal(/\blocalStorage\b/.test(PARSER_SOURCE), false);
  assert.equal(/\bsessionStorage\b/.test(PARSER_SOURCE), false);
  assert.equal(/\bindexedDB\b/i.test(PARSER_SOURCE), false);
  assert.equal(/document\./.test(PARSER_SOURCE), false);
});
