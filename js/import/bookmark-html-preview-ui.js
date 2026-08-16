/**
 * LoveBud — Local Bookmark HTML Preview UI.
 *
 * Entry point: `/pages/bookmark-html-preview.html` — Issue #4072 / #4074.
 *
 * Flow (client-only, no upload):
 *   user-selected exported bookmark HTML file
 *   -> File.text() (browser-local read)
 *   -> #4065 parser authority (window.LoveBudBookmarkHtmlPreviewParser)
 *   -> ordered safe preview (canonical sourceIndex order)
 *   -> per-occurrence ordered selection (#4074)
 *   -> deterministic client-only ordered import draft (#4074)
 *
 * BOOKMARK_FILE_UPLOAD = ZERO — the raw file is never sent anywhere:
 * no fetch, no XHR, no FormData, no backend route, no cloud storage, no
 * clipboard exfiltration, no persistence (localStorage/sessionStorage/
 * IndexedDB/cookie).
 *
 * #4072 contract (preserved):
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
 * #4074 contract (added):
 *   - occurrence-based selection: every selectable preview occurrence is
 *     independently selectable by canonical occurrence identity
 *     (sourceIndex). Duplicate URLs at different source positions remain
 *     independently selectable; selection is never deduped by URL.
 *   - eligibility: only parser-supported safe http(s) occurrences
 *     (supported=true + non-null normalized url) may be selected. Unsupported
 *     scheme / rejected / credential-bearing / null-url occurrences are never
 *     selectable and never silently selected.
 *   - canonical source order: click order is NOT canonical import order.
 *     buildOrderedBookmarkImportDraft emits selected eligible occurrences in
 *     exact ascending sourceIndex order.
 *   - select all eligible / clear controls (keyboard reachable) operate only
 *     on eligible occurrences.
 *   - selected count is shown and announced via a bounded role=status /
 *     aria-live region; per-item controls have understandable accessible
 *     names even for duplicate titles/URLs.
 *   - selection resets on new file, READING, parser/read ERROR, EMPTY result,
 *     and explicit reset. No persistent storage of selection state.
 *   - buildOrderedBookmarkImportDraft(preview, selectedOccurrences) is a pure,
 *     deterministic, detached builder: it never mutates the parser/preview
 *     result or internal selection state and returns new frozen objects with
 *     only the minimum existing safe preview fields.
 *
 * Refs: #4074, #4072, #4065, #3897, #3903, #1882.
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
  var SELECT_ALL_ID = 'bookmarkHtmlSelectAllBtn';
  var CLEAR_ID = 'bookmarkHtmlClearBtn';
  var SELECTED_COUNT_ID = 'bookmarkHtmlSelectedCount';

  var state = 'IDLE';

  var parserApi = (typeof window !== 'undefined' && window.LoveBudBookmarkHtmlPreviewParser) || null;

  // #4074 selection state — module-local, never persisted.
  // Identity is the canonical occurrence identity (sourceIndex), not the URL.
  var selectedSet = typeof Set !== 'undefined' ? new Set() : null;
  var renderedCheckboxes = Object.create(null);
  var lastResult = null;

  // Monotonic read-generation token. Each file selection bumps it so that a
  // superseded (now-stale) File.text() completion can never reclaim preview
  // authority or trigger a failure against the current surface.
  var readGeneration = 0;

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
    resetSelection();
    lastResult = null; // preview authority invalidates with selection
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

  /**
   * Eligibility: an occurrence is selectable only when the #4065 parser
   * returned supported=true AND a non-null normalized http(s) url.
   * Unsupported scheme / rejected / credential-bearing / null-url occurrences
   * are never eligible and never silently selected.
   */
  function isEligible(entry) {
    return !!entry &&
      entry.supported === true &&
      typeof entry.url === 'string' &&
      entry.url.length > 0;
  }

  function updateSelectedCount() {
    var el = $id(SELECTED_COUNT_ID);
    if (!el) return;
    var count = selectedSet ? selectedSet.size : 0;
    el.textContent = count + ' selected';
    el.hidden = false;
  }

  /** Clear all selection state, registered checkbox handles, and count. */
  function resetSelection() {
    selectedSet = new Set();
    renderedCheckboxes = Object.create(null);
    updateSelectedCount();
  }

  /** Reflect current selection into every rendered checkbox (no re-render). */
  function applySelectionToDom() {
    Object.keys(renderedCheckboxes).forEach(function (key) {
      var cb = renderedCheckboxes[key];
      if (cb) cb.checked = selectedSet.has(Number(key));
    });
  }

  function findEntryBySourceIndex(sourceIndex) {
    if (!lastResult || !Array.isArray(lastResult.entries)) return null;
    var entries = lastResult.entries;
    for (var i = 0; i < entries.length; i++) {
      if (entries[i] && entries[i].sourceIndex === sourceIndex) return entries[i];
    }
    return null;
  }

  /** Set a single occurrence's selected state. No-op for ineligible rows. */
  function setOccurrenceSelected(sourceIndex, want) {
    var entry = findEntryBySourceIndex(sourceIndex);
    if (!isEligible(entry)) return false;
    if (want) {
      selectedSet.add(sourceIndex);
    } else {
      selectedSet.delete(sourceIndex);
    }
    var cb = renderedCheckboxes[sourceIndex];
    if (cb) cb.checked = selectedSet.has(sourceIndex);
    updateSelectedCount();
    return selectedSet.has(sourceIndex);
  }

  /** Toggle a single occurrence. Returns the resulting selected state. */
  function toggleOccurrence(sourceIndex) {
    return setOccurrenceSelected(sourceIndex, !selectedSet.has(sourceIndex));
  }

  /** Select only the eligible occurrences of the current preview. */
  function selectAllEligible() {
    if (!lastResult || !Array.isArray(lastResult.entries)) return;
    var entries = lastResult.entries;
    for (var i = 0; i < entries.length; i++) {
      if (isEligible(entries[i])) selectedSet.add(entries[i].sourceIndex);
    }
    applySelectionToDom();
    updateSelectedCount();
  }

  /** Clear the entire selection. */
  function clearSelection() {
    selectedSet = new Set();
    applySelectionToDom();
    updateSelectedCount();
  }

  function getSelectedCount() {
    return selectedSet ? selectedSet.size : 0;
  }

  /** Current selection as an array of canonical sourceIndex identities. */
  function getSelectedOccurrences() {
    return Array.from(selectedSet);
  }

  /** Current parser/preview result (frozen) or null when no preview. */
  function getPreview() {
    return lastResult;
  }

  /**
   * Pure, deterministic, detached ordered import draft builder.
   *
   *   buildOrderedBookmarkImportDraft(preview, selectedOccurrences)
   *
   * Contract:
   *   - includes only selected ELIGIBLE occurrences
   *   - exact canonical source order (ascending sourceIndex)
   *   - duplicate URLs preserved when separately selected
   *   - detached result — never references or mutates the parser/preview
   *     result, and never mutates internal selection state
   *   - only the minimum existing safe preview fields are carried forward
   *     (occurrenceKey, sourceIndex, title, url, folderPath); no raw href,
   *     no credentials, no DB/Tree/Moment/Connection IDs, no DTO authority
   *
   * @param {Object} preview — parser result with .entries (frozen entries)
   * @param {Array<number>|Set<number>} selectedOccurrences — selected sourceIndex identities
   */
  function buildOrderedBookmarkImportDraft(preview, selectedOccurrences) {
    var selectedSetLocal = new Set();
    if (selectedOccurrences instanceof Set) {
      selectedSetLocal = new Set(selectedOccurrences);
    } else if (Array.isArray(selectedOccurrences)) {
      for (var s = 0; s < selectedOccurrences.length; s++) {
        selectedSetLocal.add(selectedOccurrences[s]);
      }
    } else if (selectedOccurrences && typeof selectedOccurrences.forEach === 'function') {
      selectedOccurrences.forEach(function (v) { selectedSetLocal.add(v); });
    }

    var picked = [];
    if (preview && Array.isArray(preview.entries)) {
      var entries = preview.entries;
      for (var i = 0; i < entries.length; i++) {
        var entry = entries[i];
        if (!entry) continue;
        if (!isEligible(entry)) continue; // eligible only
        if (!selectedSetLocal.has(entry.sourceIndex)) continue; // selected only
        picked.push(entry);
      }
    }

    // Canonical source order — click order is NOT authoritative.
    picked.sort(function (a, b) { return a.sourceIndex - b.sourceIndex; });

    var draftEntries = picked.map(function (entry) {
      return Object.freeze({
        occurrenceKey: entry.occurrenceKey,
        sourceIndex: entry.sourceIndex,
        title: entry.title,
        url: entry.url,
        folderPath: Object.freeze((entry.folderPath || []).slice()),
      });
    });

    return Object.freeze({
      entries: Object.freeze(draftEntries),
      count: draftEntries.length,
      ordered: true,
      source: 'bookmark-html-local',
    });
  }

  /** Build the per-item selection checkbox for an eligible occurrence. */
  function buildSelectCheckbox(entry) {
    var cb = document.createElement('input');
    cb.type = 'checkbox';
    cb.className = 'bh-select';
    cb.setAttribute('data-source-index', String(entry.sourceIndex));
    cb.setAttribute('data-occurrence-key', String(entry.occurrenceKey));
    var ordinal = '#' + String(entry.sourceIndex + 1);
    var label = '북마크 ' + ordinal + ' 선택: ' + (entry.title || '제목 없음') + ' — ' + entry.url;
    cb.setAttribute('aria-label', label);
    cb.checked = selectedSet.has(entry.sourceIndex);
    cb.addEventListener('change', function () {
      setOccurrenceSelected(entry.sourceIndex, cb.checked);
    });
    renderedCheckboxes[entry.sourceIndex] = cb;
    return cb;
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

      // Eligible occurrences are independently selectable. The checkbox is the
      // LAST child so it never shifts the link (children[2]) the #4072 tests
      // rely on; ineligible rows get no checkbox at all.
      row.appendChild(buildSelectCheckbox(entry));
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
    renderedCheckboxes = Object.create(null);
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
      lastResult = null;
      resetSelection();
      clearPreview();
      setState('EMPTY', '북마크 항목이 없어요.');
      return;
    }
    lastResult = result;
    resetSelection();
    renderEntries(result.entries);
    setState('READY', '총 ' + result.itemCount + '개 항목 · 지원 ' + result.supportedCount + '개');
  }

  /**
   * Local file read path. A new file selection invalidates the previous
   * preview and selection immediately; oversized files fail closed before
   * File.text().
   */
  function handleFileSelected(file) {
    readGeneration++; // supersede any pending read from a previous selection
    resetSelection();
    clearPreview(); // new file selection: previous preview + selection are stale
    lastResult = null; // preview authority invalidates with selection (READING)
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
      failWith('이 브라우저에서는 파일을 읽을 수 있어요.');
      return Promise.resolve();
    }
    setState('READING', '파일을 읽는 중...'); // READING also resets selection
    var myGen = readGeneration; // capture this read's generation
    return file.text()
      .then(function (text) {
        if (myGen !== readGeneration) return; // superseded read: ignore stale completion
        handleText(text);
      })
      .catch(function () {
        if (myGen !== readGeneration) return; // stale rejection: do not fail the current surface
        failWith('파일을 읽지 못했어요.');
      });
  }

  function resetSurface() {
    readGeneration++; // supersede any pending read before clearing the surface
    resetSelection();
    lastResult = null; // preview authority invalidates with selection
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
    var selectAllBtn = $id(SELECT_ALL_ID);
    if (selectAllBtn && typeof selectAllBtn.addEventListener === 'function') {
      selectAllBtn.addEventListener('click', selectAllEligible);
    }
    var clearBtn = $id(CLEAR_ID);
    if (clearBtn && typeof clearBtn.addEventListener === 'function') {
      clearBtn.addEventListener('click', clearSelection);
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
    isEligible: isEligible,
    buildRow: buildRow,
    renderEntries: renderEntries,
    toggleOccurrence: toggleOccurrence,
    setOccurrenceSelected: setOccurrenceSelected,
    selectAllEligible: selectAllEligible,
    clearSelection: clearSelection,
    getSelectedCount: getSelectedCount,
    getSelectedOccurrences: getSelectedOccurrences,
    getPreview: getPreview,
    buildOrderedBookmarkImportDraft: buildOrderedBookmarkImportDraft,
  };
  if (typeof window !== 'undefined') {
    window.LoveBudBookmarkHtmlPreviewUI = publicApi;
  }
  if (typeof module !== 'undefined' && module && module.exports) {
    module.exports = publicApi;
  }
  init();
})();
