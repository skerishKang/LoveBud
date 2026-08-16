/**
 * LoveBud — local-only browser bookmark HTML preview parser.
 *
 * Boundary:
 * exported bookmark HTML text -> bounded detached preview model
 *
 * No DOM execution, network, persistence, backend call, or Product write.
 * Refs #4065, #3897, #3903, #1882.
 */
(function (root, factory) {
  'use strict';

  var api = factory();
  if (typeof module !== 'undefined' && module && module.exports) {
    module.exports = api;
  }
  if (root) {
    root.LoveBudBookmarkHtmlPreviewParser = api;
  }
})(typeof window !== 'undefined' ? window : null, function () {
  'use strict';

  var HARD_LIMITS = Object.freeze({
    maxInputBytes: 1024 * 1024,
    maxItems: 2000,
    maxFolderDepth: 64,
    maxTitleChars: 512,
    maxUrlChars: 4096,
  });

  var REASON_CODES = Object.freeze({
    MISSING_HREF: 'MISSING_HREF',
    INVALID_URL: 'INVALID_URL',
    UNSUPPORTED_SCHEME: 'UNSUPPORTED_SCHEME',
    URL_CREDENTIALS_FORBIDDEN: 'URL_CREDENTIALS_FORBIDDEN',
    URL_TOO_LONG: 'URL_TOO_LONG',
  });

  function BookmarkHtmlPreviewError(code, message) {
    this.name = 'BookmarkHtmlPreviewError';
    this.code = code;
    this.message = message || code;
    if (Error.captureStackTrace) Error.captureStackTrace(this, BookmarkHtmlPreviewError);
  }
  BookmarkHtmlPreviewError.prototype = Object.create(Error.prototype);
  BookmarkHtmlPreviewError.prototype.constructor = BookmarkHtmlPreviewError;

  function fail(code, message) {
    throw new BookmarkHtmlPreviewError(code, message);
  }

  function boundedLimit(value, hardMaximum) {
    if (value === undefined || value === null) return hardMaximum;
    var number = Number(value);
    if (!Number.isInteger(number) || number <= 0) fail('INVALID_OPTIONS', 'Parser limits must be positive integers.');
    return Math.min(number, hardMaximum);
  }

  function resolveLimits(options) {
    var input = options || {};
    return Object.freeze({
      maxInputBytes: boundedLimit(input.maxInputBytes, HARD_LIMITS.maxInputBytes),
      maxItems: boundedLimit(input.maxItems, HARD_LIMITS.maxItems),
      maxFolderDepth: boundedLimit(input.maxFolderDepth, HARD_LIMITS.maxFolderDepth),
      maxTitleChars: boundedLimit(input.maxTitleChars, HARD_LIMITS.maxTitleChars),
      maxUrlChars: boundedLimit(input.maxUrlChars, HARD_LIMITS.maxUrlChars),
    });
  }

  function utf8ByteLength(value) {
    if (typeof TextEncoder !== 'undefined') return new TextEncoder().encode(value).length;
    return unescape(encodeURIComponent(value)).length;
  }

  function decodeEntity(entity) {
    var lower = entity.toLowerCase();
    if (lower === '&amp;') return '&';
    if (lower === '&lt;') return '<';
    if (lower === '&gt;') return '>';
    if (lower === '&quot;') return '"';
    if (lower === '&#39;' || lower === '&apos;') return "'";
    if (lower === '&nbsp;') return '\u00a0';

    var numeric = entity.match(/^&#(x[0-9a-f]+|[0-9]+);$/i);
    if (!numeric) return entity;
    var raw = numeric[1];
    var point = raw.charAt(0).toLowerCase() === 'x' ? parseInt(raw.slice(1), 16) : parseInt(raw, 10);
    if (!Number.isFinite(point) || point < 0 || point > 0x10ffff || (point >= 0xd800 && point <= 0xdfff)) {
      return '\ufffd';
    }
    try {
      return String.fromCodePoint(point);
    } catch (_error) {
      return '\ufffd';
    }
  }

  function decodeHtmlEntities(value) {
    return String(value || '').replace(/&(?:amp|lt|gt|quot|apos|nbsp|#39|#x[0-9a-f]+|#[0-9]+);/gi, decodeEntity);
  }

  function normalizePlainText(value, limits, fieldName) {
    var text = decodeHtmlEntities(value).replace(/\s+/g, ' ').trim();
    if (text.length > limits.maxTitleChars) {
      fail('TEXT_FIELD_TOO_LARGE', fieldName + ' exceeds the bounded preview text limit.');
    }
    return text;
  }

  function parseAttributes(tagText) {
    var attributes = Object.create(null);
    var body = String(tagText || '')
      .replace(/^<\s*\/?\s*[a-z0-9:-]+/i, '')
      .replace(/\/?>\s*$/, '');
    var pattern = /([^\s=/>]+)(?:\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s"'=<>`]+)))?/g;
    var match;
    while ((match = pattern.exec(body))) {
      var name = String(match[1] || '').toLowerCase();
      if (!name || Object.prototype.hasOwnProperty.call(attributes, name)) continue;
      var rawValue = match[2] !== undefined ? match[2] : match[3] !== undefined ? match[3] : match[4] !== undefined ? match[4] : '';
      attributes[name] = decodeHtmlEntities(rawValue);
    }
    return attributes;
  }

  function normalizeUrl(rawHref, limits) {
    var href = String(rawHref || '').trim();
    if (!href) return Object.freeze({ supported: false, url: null, reasonCode: REASON_CODES.MISSING_HREF });
    if (href.length > limits.maxUrlChars) {
      return Object.freeze({ supported: false, url: null, reasonCode: REASON_CODES.URL_TOO_LONG });
    }

    var schemeMatch = href.match(/^([a-z][a-z0-9+.-]*):/i);
    if (!schemeMatch) return Object.freeze({ supported: false, url: null, reasonCode: REASON_CODES.INVALID_URL });
    var scheme = schemeMatch[1].toLowerCase();
    if (scheme !== 'http' && scheme !== 'https') {
      return Object.freeze({ supported: false, url: null, reasonCode: REASON_CODES.UNSUPPORTED_SCHEME });
    }

    var parsed;
    try {
      parsed = new URL(href);
    } catch (_error) {
      return Object.freeze({ supported: false, url: null, reasonCode: REASON_CODES.INVALID_URL });
    }
    if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
      return Object.freeze({ supported: false, url: null, reasonCode: REASON_CODES.UNSUPPORTED_SCHEME });
    }
    if (parsed.username || parsed.password) {
      return Object.freeze({ supported: false, url: null, reasonCode: REASON_CODES.URL_CREDENTIALS_FORBIDDEN });
    }
    return Object.freeze({ supported: true, url: parsed.href, reasonCode: null });
  }

  function parseAddDate(rawValue) {
    if (rawValue === undefined || rawValue === null || rawValue === '') return null;
    if (!/^[0-9]+$/.test(String(rawValue))) return null;
    var value = Number(rawValue);
    if (!Number.isSafeInteger(value) || value < 0) return null;
    return value;
  }

  function freezeEntry(entry) {
    entry.folderPath = Object.freeze(entry.folderPath.slice());
    return Object.freeze(entry);
  }

  function parseBookmarkHtmlPreview(html, options) {
    if (typeof html !== 'string') fail('INVALID_INPUT', 'Bookmark HTML input must be a string.');

    var limits = resolveLimits(options);
    if (utf8ByteLength(html) > limits.maxInputBytes) {
      fail('INPUT_TOO_LARGE', 'Bookmark HTML exceeds the bounded local preview input limit.');
    }

    var entries = [];
    var folderStack = [];
    var dlFrames = [];
    var pendingFolder = null;
    var capture = null;
    var sawStructure = false;
    var sourceIndex = 0;

    function startCapture(type, tagText) {
      if (capture) fail('MALFORMED_BOOKMARK_HTML', 'Nested bookmark title elements are not accepted.');
      capture = { type: type, text: [], attributes: type === 'bookmark' ? parseAttributes(tagText) : null };
    }

    function finishFolderCapture() {
      if (!capture || capture.type !== 'folder') fail('MALFORMED_BOOKMARK_HTML', 'Unexpected folder title closure.');
      pendingFolder = normalizePlainText(capture.text.join(''), limits, 'Folder title');
      capture = null;
    }

    function finishBookmarkCapture() {
      if (!capture || capture.type !== 'bookmark') fail('MALFORMED_BOOKMARK_HTML', 'Unexpected bookmark closure.');
      if (entries.length >= limits.maxItems) fail('ITEM_LIMIT_EXCEEDED', 'Bookmark item count exceeds the bounded preview limit.');

      var attrs = capture.attributes || Object.create(null);
      var normalized = normalizeUrl(attrs.href, limits);
      var title = normalizePlainText(capture.text.join(''), limits, 'Bookmark title');
      var entry = {
        occurrenceKey: 'bookmark:' + sourceIndex,
        sourceIndex: sourceIndex,
        title: title,
        url: normalized.url,
        folderPath: folderStack.slice(),
        addDateUnixSeconds: parseAddDate(attrs.add_date),
        supported: normalized.supported,
        reasonCode: normalized.reasonCode,
      };
      entries.push(freezeEntry(entry));
      sourceIndex += 1;
      capture = null;
      sawStructure = true;
    }

    var tokenPattern = /<!--[\s\S]*?-->|<![^>]*>|<\/?[A-Za-z][^>]*>|[^<]+|</g;
    var token;
    while ((token = tokenPattern.exec(html))) {
      var value = token[0];
      if (!value) continue;

      if (value.charAt(0) !== '<') {
        if (capture) capture.text.push(value);
        continue;
      }
      if (/^<!--/.test(value) || /^<!/.test(value)) continue;
      if (value === '<') {
        if (capture) capture.text.push(value);
        continue;
      }

      var tagMatch = value.match(/^<\s*(\/?)\s*([A-Za-z0-9:-]+)/);
      if (!tagMatch) continue;
      var closing = tagMatch[1] === '/';
      var tagName = tagMatch[2].toLowerCase();

      if (capture) {
        if (!closing && ((capture.type === 'bookmark' && tagName === 'a') || (capture.type === 'folder' && tagName === 'h3'))) {
          fail('MALFORMED_BOOKMARK_HTML', 'Nested bookmark title elements are not accepted.');
        }
        if (closing && capture.type === 'bookmark' && tagName === 'a') {
          finishBookmarkCapture();
        } else if (closing && capture.type === 'folder' && tagName === 'h3') {
          finishFolderCapture();
        }
        continue;
      }

      if (!closing && tagName === 'h3') {
        if (pendingFolder !== null) fail('MALFORMED_BOOKMARK_HTML', 'Folder title must be followed by its bookmark list.');
        startCapture('folder', value);
        sawStructure = true;
        continue;
      }
      if (!closing && tagName === 'a') {
        if (pendingFolder !== null) fail('MALFORMED_BOOKMARK_HTML', 'Folder title must be followed by its bookmark list.');
        startCapture('bookmark', value);
        continue;
      }
      if (closing && (tagName === 'h3' || tagName === 'a')) {
        fail('MALFORMED_BOOKMARK_HTML', 'Unexpected bookmark title closure.');
      }

      if (!closing && tagName === 'dl') {
        sawStructure = true;
        var pushedFolder = false;
        if (pendingFolder !== null) {
          if (folderStack.length >= limits.maxFolderDepth) {
            fail('FOLDER_DEPTH_EXCEEDED', 'Bookmark folder depth exceeds the bounded preview limit.');
          }
          folderStack.push(pendingFolder);
          pendingFolder = null;
          pushedFolder = true;
        }
        dlFrames.push(pushedFolder);
        continue;
      }
      if (closing && tagName === 'dl') {
        if (pendingFolder !== null || dlFrames.length === 0) {
          fail('MALFORMED_BOOKMARK_HTML', 'Bookmark folder/list structure is malformed.');
        }
        var didPushFolder = dlFrames.pop();
        if (didPushFolder) folderStack.pop();
      }
    }

    if (capture || pendingFolder !== null || dlFrames.length !== 0 || folderStack.length !== 0 || !sawStructure) {
      fail('MALFORMED_BOOKMARK_HTML', 'Bookmark HTML structure is incomplete or malformed.');
    }

    var supportedCount = 0;
    for (var i = 0; i < entries.length; i++) {
      if (entries[i].supported) supportedCount += 1;
    }

    return Object.freeze({
      entries: Object.freeze(entries.slice()),
      itemCount: entries.length,
      supportedCount: supportedCount,
      unsupportedCount: entries.length - supportedCount,
      limits: limits,
    });
  }

  return Object.freeze({
    HARD_LIMITS: HARD_LIMITS,
    REASON_CODES: REASON_CODES,
    BookmarkHtmlPreviewError: BookmarkHtmlPreviewError,
    parseBookmarkHtmlPreview: parseBookmarkHtmlPreview,
    decodeHtmlEntities: decodeHtmlEntities,
    normalizeUrl: function (value, options) {
      return normalizeUrl(value, resolveLimits(options));
    },
  });
});
