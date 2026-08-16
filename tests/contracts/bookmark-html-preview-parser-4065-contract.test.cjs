'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const parserPath = path.resolve(__dirname, '../../js/import/bookmark-html-preview-parser.js');
const parser = require(parserPath);

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

{
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
  assert.deepEqual(result.entries.map((entry) => entry.sourceIndex), [0, 1, 2]);
  assert.deepEqual(result.entries[0].folderPath, ['Music']);
  assert.deepEqual(result.entries[1].folderPath, ['Music', 'Live']);
  assert.deepEqual(result.entries[2].folderPath, []);
  assert.equal(result.entries[0].addDateUnixSeconds, 123);
  assert.equal(result.entries[0].url, 'https://example.com/a');
  assert.equal(result.entries[1].title, 'Beta');
}

{
  const html = exportedHtml([
    '<DT><A HREF="https://example.com/repeat">First occurrence</A>',
    '<DT><A HREF="https://example.com/repeat">Second occurrence</A>',
  ].join('\n'));
  const result = parser.parseBookmarkHtmlPreview(html);
  assert.equal(result.itemCount, 2);
  assert.equal(result.entries[0].url, result.entries[1].url);
  assert.notEqual(result.entries[0].occurrenceKey, result.entries[1].occurrenceKey);
  assert.deepEqual(result.entries.map((entry) => entry.occurrenceKey), ['bookmark:0', 'bookmark:1']);
}

{
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
  for (const entry of result.entries.slice(2)) {
    assert.equal(entry.supported, false);
    assert.equal(entry.url, null);
  }
}

{
  globalThis.__bookmarkParserExecuted = false;
  const html = exportedHtml(
    '<DT><A HREF="https://example.com/x"><img src=x onerror="globalThis.__bookmarkParserExecuted=true">Hello<script>globalThis.__bookmarkParserExecuted=true</script></A>'
  );
  const result = parser.parseBookmarkHtmlPreview(html);
  assert.equal(globalThis.__bookmarkParserExecuted, false);
  assert.equal(result.entries[0].supported, true);
  assert.ok(!result.entries[0].title.includes('<'));
  assert.ok(!result.entries[0].title.includes('script'));
  delete globalThis.__bookmarkParserExecuted;
}

{
  const html = exportedHtml('<DT><A HREF="https://example.com/a">Fish &amp; Chips &#x1f41f;</A>');
  const result = parser.parseBookmarkHtmlPreview(html);
  assert.equal(result.entries[0].title, 'Fish & Chips 🐟');
}

{
  expectError('INVALID_INPUT', () => parser.parseBookmarkHtmlPreview(null));
  expectError('INVALID_OPTIONS', () => parser.parseBookmarkHtmlPreview(exportedHtml(''), { maxItems: 0 }));
  expectError('INPUT_TOO_LARGE', () => parser.parseBookmarkHtmlPreview(exportedHtml('<DT><A HREF="https://example.com">x</A>'), { maxInputBytes: 20 }));
}

{
  const html = exportedHtml([
    '<DT><A HREF="https://example.com/1">1</A>',
    '<DT><A HREF="https://example.com/2">2</A>',
  ].join('\n'));
  expectError('ITEM_LIMIT_EXCEEDED', () => parser.parseBookmarkHtmlPreview(html, { maxItems: 1 }));
}

{
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
}

{
  const malformedUnclosedAnchor = exportedHtml('<DT><A HREF="https://example.com/a">Alpha');
  expectError('MALFORMED_BOOKMARK_HTML', () => parser.parseBookmarkHtmlPreview(malformedUnclosedAnchor));

  const malformedList = '<DL><p><DT><A HREF="https://example.com/a">Alpha</A>';
  expectError('MALFORMED_BOOKMARK_HTML', () => parser.parseBookmarkHtmlPreview(malformedList));

  const notBookmarkHtml = '<html><body>hello</body></html>';
  expectError('MALFORMED_BOOKMARK_HTML', () => parser.parseBookmarkHtmlPreview(notBookmarkHtml));
}

{
  const tooLongTitle = exportedHtml('<DT><A HREF="https://example.com">abcdef</A>');
  expectError('TEXT_FIELD_TOO_LARGE', () => parser.parseBookmarkHtmlPreview(tooLongTitle, { maxTitleChars: 5 }));

  const tooLongUrl = exportedHtml('<DT><A HREF="https://example.com/abcdef">x</A>');
  const result = parser.parseBookmarkHtmlPreview(tooLongUrl, { maxUrlChars: 20 });
  assert.equal(result.entries[0].supported, false);
  assert.equal(result.entries[0].reasonCode, parser.REASON_CODES.URL_TOO_LONG);
}

{
  const html = exportedHtml('<DT><A HREF="https://example.com">Immutable</A>');
  const result = parser.parseBookmarkHtmlPreview(html);
  assert.equal(Object.isFrozen(result), true);
  assert.equal(Object.isFrozen(result.entries), true);
  assert.equal(Object.isFrozen(result.entries[0]), true);
  assert.equal(Object.isFrozen(result.entries[0].folderPath), true);
  assert.equal(Object.isFrozen(result.limits), true);
  assert.throws(() => {
    result.entries[0].title = 'changed';
  }, TypeError);
  assert.equal(result.entries[0].title, 'Immutable');
}

{
  const moduleSource = fs.readFileSync(parserPath, 'utf8');
  assert.equal(/\bfetch\s*\(/.test(moduleSource), false);
  assert.equal(/\bXMLHttpRequest\b/.test(moduleSource), false);
  assert.equal(/\blocalStorage\b/.test(moduleSource), false);
  assert.equal(/\bsessionStorage\b/.test(moduleSource), false);
  assert.equal(/\bindexedDB\b/i.test(moduleSource), false);
  assert.equal(/document\./.test(moduleSource), false);
}

console.log('bookmark-html-preview-parser #4065 contract: PASS');
