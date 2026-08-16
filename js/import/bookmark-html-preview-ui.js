/**
 * LoveBud — Local Bookmark HTML Preview UI.
 *
 * Entry point: `/pages/bookmark-html-preview.html` — Issue #4072.
 *
 * Flow (client-only, no upload):
 *   user-selected exported bookmark HTML file
 *   -> File.text() (browser-local read)
 *   -> #4065 parser authority (window.LoveBudBookmarkHtmlPreviewParser)
 *   -> ordered safe preview (canonical sourceIndex order)
 *
 * BOOKMARK_FILE_UPLOAD = ZERO — the raw file is never sent anywhere:
 * no fetch, no XHR, no FormData, no backend route, no cloud storage, no
 * clipboard exfiltration, no persistence (localStorage/sessionStorage/
 * IndexedDB/cookie).
 *
 * #4072 contract:
 *   - parser authority is #4065 ONLY: window.LoveBudBookmarkHtmlPreviewParser
 *     .parseBookmarkHtmlPreview(...) is reused; no second HTML/bookmark parser
 *     is created here (no regex/DOMParser/iframe/srcdoc parsing)
 *   - UI-side size preflight uses the parser HARD_LIMITS.maxInputBytes
 *     (1 MiB) — never weaker than the parser bound; oversized files fail
 *     closed before File.text() read continuation
 *   - preview keeps exact canonical sourceIndex order; duplicate URLs stay
 *     independent occurrences (occurrence != URL)
 *   - a clickable link is rendered ONLY when the parser returned
 *     supported=true and a non-null normalized http(s) url; unsupported /
 *     credential-bearing / rejected entries are inert status only — the raw
 *     href is never reconstructed or displayed
 *   - rendering is textContent/createElement only (zero innerHTML sinks):
 *     bookmark title and folder path can never execute as HTML
 *   - states: IDLE / READING / READY / EMPTY / ERROR; selecting a new file
 *     invalidates the previous preview immediately; read/parser error clears
 *     stale preview; reset clears file input + preview + error
 *
 * Refs: #4072, #4065, #3897, #3903, #1882.
 */

(function () {
  'use strict';

  function $id(id) {
    return typeof document !== 'undefined' && document ? document.getElementById(id) : null;
  }

  var FILE_INPUT_ID = 'bookmarkHtmlFileInput';
  var STATUS_ID = 'bookmarkHtmlStatus';
  var ERROR_ID = 'bookmarkHtmlError';
  var PREVIEW_ID = 'bookmarkHtmlPreview';
  var RESET_ID = 'bookmarkHtmlResetBtn';

  var state = 'IDLE';

  var parserApi = (typeof window !== 'undefined' && window.LoveBudBookmarkHtmlPreviewParser) || null;

  function setParser(parser) {
    parserApi = parser || null;
  }

  /** Parser-owned hard input bound (HARD_LIMITS.maxInputBytes = 1 MiB). */
  function maxInputBytes() {
    return (parserApi && parserApi.HARD_LIMITS && parserApi.HARD_LIMITS.maxInputBytes) || 0;
  }

  function setState(next, statusText) {
    state = next;
    var statusEl = $id(STATUS_ID);
    if (statusEl) {
      statusEl.textContent = statusText || '';
      statusEl.hidden = !statusText;
    }
  }

  function getState() {
    return state;
  }

  function setError(message) {
    var err = $id(ERROR_ID);
    if (!err) return;
    err.textContent = message || '';
    err.hidden = !message;
  }

  function clearPreview() {
    var container = $id(PREVIEW_ID);
    if (container) container.textContent = '';
  }

  /** Bounded failure: clear stale preview, announce in the error region. */
  function failWith(message) {
    clearPreview();
    setError(message);
    setState('ERROR', '');
  }

  function reasonLabel(code) {
    switch (code) {
      case 'MISSING_HREF':
        return '링크 없음';
      case 'INVALID_URL':
        return '잘못된 주소';
      case 'UNSUPPORTED_SCHEME':
        return '지원하지 않는 주소 형식';
      case 'URL_CREDENTIALS_FORBIDDEN':
        return '주소에 자격 증명 포함';
      case 'URL_TOO_LONG':
        return '주소가 너무 김';
      default:
        return '지원하지 않는 항목';
    }
  }

  /** Bounded user-facing message; raw input/file contents are never echoed. */
  function mapParserError(err) {
    var code = (err && err.code) || 'INVALID_BOOKMARK_HTML';
    switch (code) {
      case 'INVALID_INPUT':
        return '북마크 HTML 형식이 아니에요.';
      case 'INPUT_TOO_LARGE':
        return '파일이 너무 커요. 최대 1MB까지 미리보기할 수 있어요.';
      case 'ITEM_LIMIT_EXCEEDED':
        return '북마크 항목이 너무 많아요.';
      case 'FOLDER_DEPTH_EXCEEDED':
        return '폴더 깊이가 너무 깊어요.';
      case 'MALFORMED_BOOKMARK_HTML':
        return '북마크 HTML 구조를 읽지 못했어요.';
      default:
        return '북마크를 미리보기할 수 없어요.';
    }
  }

  /** One ordered row. Link only when parser said supported + non-null url. */
  function buildRow(entry) {
    var row = document.createElement('div');
    row.className = 'bh-row' + (entry.supported ? '' : ' bh-row-unsupported');
    row.setAttribute('data-source-index', String(entry.sourceIndex));
    row.setAttribute('data-supported', entry.supported ? 'true' : 'false');

    var order = document.createElement('span');
    order.className = 'bh-order';
    order.setAttribute('aria-hidden', 'true');
    order.textContent = '#' + String(entry.sourceIndex + 1);
    row.appendChild(order);

    var meta = document.createElement('div');
    meta.className = 'bh-meta';

    var title = document.createElement('span');
    title.className = 'bh-title';
    title.textContent = entry.title || '제목 없음';
    meta.appendChild(title);

    var path = document.createElement('span');
    path.className = 'bh-path';
    var pathText = (entry.folderPath && entry.folderPath.length)
      ? entry.folderPath.join(' / ')
      : '최상위';
    path.textContent = pathText;
    meta.appendChild(path);

    row.appendChild(meta);

    if (entry.supported && typeof entry.url === 'string' && entry.url.length > 0) {
      var link = document.createElement('a');
      link.className = 'bh-link';
      link.href = entry.url;
      link.textContent = entry.url;
      link.target = '_blank';
      link.rel = 'noopener noreferrer';
      link.setAttribute('aria-label', (entry.title || '북마크') + ' 열기');
      row.appendChild(link);

      var ok = document.createElement('span');
      ok.className = 'bh-state bh-state-supported';
      ok.textContent = '지원됨';
      row.appendChild(ok);
    } else {
      // Inert status only — never a navigation target, never the raw href.
      var unsupported = document.createElement('span');
      unsupported.className = 'bh-state bh-state-unsupported';
      unsupported.textContent = '지원 안 함 — ' + reasonLabel(entry.reasonCode);
      row.appendChild(unsupported);
    }
    return row;
  }

  function renderEntries(entries) {
    var container = $id(PREVIEW_ID);
    if (!container) return;
    container.textContent = '';
    for (var i = 0; i < entries.length; i++) {
      container.appendChild(buildRow(entries[i]));
    }
  }

  function handleText(text) {
    if (!parserApi || typeof parserApi.parseBookmarkHtmlPreview !== 'function') {
      failWith('미리보기 기능을 불러오지 못했어요.');
      return;
    }
    var result;
    try {
      result = parserApi.parseBookmarkHtmlPreview(text);
    } catch (err) {
      failWith(mapParserError(err));
      return;
    }
    if (!result || !Array.isArray(result.entries) || result.entries.length === 0) {
      clearPreview();
      setState('EMPTY', '북마크 항목이 없어요.');
      return;
    }
    renderEntries(result.entries);
    setState('READY', '총 ' + result.itemCount + '개 항목 · 지원 ' + result.supportedCount + '개');
  }

  /**
   * Local file read path. A new file selection invalidates the previous
   * preview immediately; oversized files fail closed before File.text().
   */
  function handleFileSelected(file) {
    clearPreview(); // new file selection: previous preview is stale
    setError('');
    if (!file) {
      failWith('파일을 선택해주세요.');
      return Promise.resolve();
    }
    var bound = maxInputBytes();
    if (bound > 0 && file.size > bound) {
      failWith('파일이 너무 커요. 최대 1MB까지 미리보기할 수 있어요.');
      return Promise.resolve();
    }
    if (typeof file.text !== 'function') {
      failWith('이 브라우저에서는 파일을 읽을 수 없어요.');
      return Promise.resolve();
    }
    setState('READING', '파일을 읽는 중...');
    return file.text()
      .then(function (text) {
        handleText(text);
      })
      .catch(function () {
        failWith('파일을 읽지 못했어요.');
      });
  }

  function resetSurface() {
    var input = $id(FILE_INPUT_ID);
    if (input) input.value = '';
    clearPreview();
    setError('');
    setState('IDLE', '');
  }

  function attachEvents() {
    var input = $id(FILE_INPUT_ID);
    if (input && typeof input.addEventListener === 'function') {
      input.addEventListener('change', function () {
        var files = input.files;
        var file = (files && files.length > 0) ? files[0] : null;
        handleFileSelected(file);
      });
    }
    var resetBtn = $id(RESET_ID);
    if (resetBtn && typeof resetBtn.addEventListener === 'function') {
      resetBtn.addEventListener('click', resetSurface);
    }
  }

  function init() {
    parserApi = (typeof window !== 'undefined' && window.LoveBudBookmarkHtmlPreviewParser) || null;
    if (typeof window !== 'undefined') {
      document.addEventListener('DOMContentLoaded', attachEvents);
    }
  }

  var publicApi = {
    init: init,
    setParser: setParser,
    handleFileSelected: handleFileSelected,
    resetSurface: resetSurface,
    getState: getState,
    maxInputBytes: maxInputBytes,
    reasonLabel: reasonLabel,
    mapParserError: mapParserError,
    buildRow: buildRow,
    renderEntries: renderEntries,
  };
  if (typeof window !== 'undefined') {
    window.LoveBudBookmarkHtmlPreviewUI = publicApi;
  }
  if (typeof module !== 'undefined' && module && module.exports) {
    module.exports = publicApi;
  }
  init();
})();
