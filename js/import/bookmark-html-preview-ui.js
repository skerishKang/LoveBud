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
 * #4076 contract (added):
 *   - Tree title input: deterministic trim; empty / whitespace-only rejected;
 *     canonical Tree-title max length (200, reused from
 *     modal_compute/validation.py::validate_tree_title) enforced; the title is
 *     plain text/data only (never trusted markup).
 *   - private-first pre-write import intent: buildBookmarkImportIntent(draft,
 *     normalizedTreeTitle) returns a detached, frozen, NOT_PERSISTED intent with
 *     visibility always 'private'. No public toggle / import-and-publish
 *     shortcut is produced (IMPORT != PUBLICATION).
 *   - pre-write review summary (bounded, role=status / aria-live) declares the
 *     normalized title, selected count, visibility=private, and that no Tree has
 *     been created yet. It becomes stale/non-actionable the moment any authority
 *     input changes (new file / READING / ERROR / EMPTY / reset / selection
 *     change / select-all / clear / title change).
 *   - #4075 async lifecycle (readGeneration supersession, stale fulfillment /
 *     rejection suppression, reset supersede) is preserved: a superseded late
 *     File.text() fulfillment/rejection can never restore an old review or
 *     destroy the current one.
 *   - the rendered review/intent carries NO raw bookmark HTML, raw rejected
 *     href, credential-bearing raw URL, browser filesystem path, local absolute
 *     path, file contents, credentials, token, or secret.
 *
 * Refs: #4076, #4074, #4072, #4065, #3897, #3903, #1882.
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

  // #4076 — private-first pre-write import intent review.
  var TREE_TITLE_INPUT_ID = 'bookmarkHtmlTreeTitleInput';
  var TREE_TITLE_ERROR_ID = 'bookmarkHtmlTreeTitleError';
  var REVIEW_BUILD_ID = 'bookmarkHtmlReviewBtn';
  var INTENT_REVIEW_ID = 'bookmarkHtmlImportReview';

  // Canonical Tree-title validation authority reused from
  // modal_compute/validation.py::validate_tree_title (default max_length=200):
  // trim(); reject empty/whitespace-only; reject over-length. No new persisted
  // or schema limit is invented here — 200 is the existing canonical bound.
  var TREE_TITLE_MAX_LENGTH = 200;

  var state = 'IDLE';

  // #4076 — user-entered Tree title is plain text/data only (never trusted
  // markup). Stored raw; normalized on demand. Never persisted.
  var treeTitleRaw = '';
  // The current pre-write import intent/review. Null = stale / non-actionable.
  var currentReview = null;

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
    invalidateReview(); // #4076 review authority invalidates with selection
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

  /**
   * Defensive URL-safety gate for the #4076 intent builder. The ordered draft
   * already contains only eligible occurrences, but the intent builder is the
   * final authority and must refuse to carry any unsupported-scheme,
   * credential-bearing, or null/empty URL even if a caller passes one.
   * Only plain http(s) URLs without userinfo (credentials) are allowed. This is
   * a minimal URL check, NOT a second HTML bookmark parser.
   */
  function isIntentSafeUrl(url) {
    if (typeof url !== 'string' || url.length === 0) return false;
    var m = /^https?:\/\/([^/@]+@)?/i.exec(url);
    if (!m) return false;
    if (m[1]) return false; // userinfo / credentials present
    return true;
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
    if (cb) cb.checked = selectedSet.has(Number(sourceIndex));
    updateSelectedCount();
    invalidateReview(); // #4076 review authority invalidates on selection change
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
    invalidateReview(); // #4076 review authority invalidates on select-all change
  }

  /** Clear the entire selection. */
  function clearSelection() {
    selectedSet = new Set();
    applySelectionToDom();
    updateSelectedCount();
    invalidateReview(); // #4076 review authority invalidates on clear-selection
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

  /**
   * Canonical Tree-title normalization, reused from
   * modal_compute/validation.py::validate_tree_title(max_length=200):
   *   - non-string value -> fail (INVALID_TYPE)
   *   - trim deterministic surrounding whitespace
   *   - empty / whitespace-only -> fail (EMPTY)
   *   - over TREE_TITLE_MAX_LENGTH -> fail (TOO_LONG)
   *   - otherwise -> trimmed text
   *
   * No new persisted/schema limit is invented; 200 is the existing canonical
   * bound. Returns { ok, value } on success or { ok:false, reason } on failure.
   *
   * @param {*} raw — user-entered title (string expected)
   */
  function normalizeBookmarkImportTreeTitle(raw) {
    if (typeof raw !== 'string') {
      return { ok: false, reason: 'INVALID_TYPE' };
    }
    var text = raw.trim();
    if (text.length === 0) {
      return { ok: false, reason: 'EMPTY' };
    }
    if (text.length > TREE_TITLE_MAX_LENGTH) {
      return { ok: false, reason: 'TOO_LONG' };
    }
    return { ok: true, value: text };
  }

  /**
   * Pure, deterministic, detached pre-write import intent builder.
   *
   *   buildBookmarkImportIntent(orderedDraft, normalizedTreeTitle)
   *
   * Contract:
   *   - consumes ONLY the existing #4074 ordered draft (selected eligible
   *     occurrences) plus the canonical normalized Tree title
   *   - selected eligible occurrences only (re-filtered by eligibility;
   *     unsupported / rejected / credential-bearing / null-url entries cannot
   *     re-enter even if a caller passes them)
   *   - exact canonical source order (ascending sourceIndex)
   *   - duplicate identical URLs remain independent occurrences
   *   - detached result: never references or mutates the draft/preview/parser
   *     result, and never mutates internal selection/title state
   *   - visibility is ALWAYS 'private' (IMPORT != PUBLICATION); no public
   *     toggle, no import-and-publish shortcut is produced
   *   - carries ONLY: treeTitle, visibility, source, entries
   *     (occurrenceKey/sourceIndex/title/url/folderPath), count, and explicit
   *     NOT_PERSISTED markers (persisted:false, created:false)
   *   - NO Tree/Memory/Moment/Connection ID, owner/account ID, persisted
   *     sortOrder, DB row identity, server acknowledgement
   *   - NO raw bookmark HTML, raw rejected href, credential-bearing raw URL,
   *     browser filesystem path, local absolute path, file contents,
   *     credentials, token, or secret
   *
   * Fails closed (returns null) when the title is not normalized-valid or the
   * draft is missing/invalid.
   *
   * @param {Object} orderedDraft — output of buildOrderedBookmarkImportDraft
   * @param {string} normalizedTreeTitle — already normalized/validated title
   */
  function buildBookmarkImportIntent(orderedDraft, normalizedTreeTitle) {
    var norm = normalizeBookmarkImportTreeTitle(normalizedTreeTitle);
    if (!norm.ok) return null;
    if (!orderedDraft || !Array.isArray(orderedDraft.entries)) return null;

    // Final authority: selected eligible occurrences only, canonical source
    // order, duplicate URLs preserved as independent occurrences.
    var picked = [];
    for (var i = 0; i < orderedDraft.entries.length; i++) {
      var entry = orderedDraft.entries[i];
      if (!entry) continue;
      // Draft entries omit `supported`, so re-gate on URL safety: exclude
      // unsupported-scheme / credential-bearing / null-url entries that must
      // never re-enter the intent.
      if (!isIntentSafeUrl(entry.url)) continue;
      picked.push(entry);
    }
    picked.sort(function (a, b) { return a.sourceIndex - b.sourceIndex; });

    var intentEntries = picked.map(function (entry) {
      return Object.freeze({
        occurrenceKey: entry.occurrenceKey,
        sourceIndex: entry.sourceIndex,
        title: entry.title,
        url: entry.url,
        folderPath: Object.freeze((entry.folderPath || []).slice()),
      });
    });

    return Object.freeze({
      treeTitle: norm.value,
      visibility: 'private',
      source: 'bookmark-html-local',
      entries: Object.freeze(intentEntries),
      count: intentEntries.length,
      persisted: false,
      created: false,
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
      invalidateReview(); // #4076 review authority invalidates on EMPTY
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
    invalidateReview(); // #4076 review authority invalidates on new file / READING
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
    invalidateReview(); // #4076 review authority invalidates on explicit reset
    var input = $id(FILE_INPUT_ID);
    if (input) input.value = '';
    clearPreview();
    setError('');
    setState('IDLE', '');
  }

  // ── #4076 private-first pre-write import intent review ────────────────────

  /** Drop the current review/intent authority (stale on any input change). */
  function invalidateReview() {
    currentReview = null;
    var el = $id(INTENT_REVIEW_ID);
    if (el) {
      el.textContent = '';
      el.hidden = true;
    }
  }

  function setTreeTitleError(message) {
    var el = $id(TREE_TITLE_ERROR_ID);
    if (!el) return;
    el.textContent = message || '';
    el.hidden = !message;
  }

  function clearTreeTitleError() {
    setTreeTitleError('');
  }

  /** Live validation feedback for the title input (no error before typing). */
  function updateTreeTitleErrorState() {
    var trimmed = (typeof treeTitleRaw === 'string') ? treeTitleRaw.trim() : '';
    if (trimmed.length === 0) {
      clearTreeTitleError();
      return;
    }
    var norm = normalizeBookmarkImportTreeTitle(treeTitleRaw);
    if (!norm.ok && norm.reason === 'TOO_LONG') {
      setTreeTitleError('트리 제목이 너무 길어요. 최대 ' + TREE_TITLE_MAX_LENGTH + '자까지 가능해요.');
    } else if (!norm.ok) {
      setTreeTitleError('트리 제목을 입력해 주세요.');
    } else {
      clearTreeTitleError();
    }
  }

  /**
   * Set the user-entered Tree title (plain text only). Any change invalidates
   * the current review/intent immediately (OLD_REVIEW != ACTIONABLE_AFTER_INPUT_CHANGE).
   * @param {*} raw
   */
  function setTreeTitle(raw) {
    treeTitleRaw = (raw === null || raw === undefined) ? '' : String(raw);
    invalidateReview();
    updateTreeTitleErrorState();
  }

  function getTreeTitle() {
    return treeTitleRaw;
  }

  /** Current normalized title result: { ok, value } or { ok:false, reason }. */
  function getNormalizedTreeTitle() {
    return normalizeBookmarkImportTreeTitle(treeTitleRaw);
  }

  /** Render the bounded review summary with textContent only (zero innerHTML). */
  function renderReview(intent) {
    var el = $id(INTENT_REVIEW_ID);
    if (!el) return;
    el.textContent = '';
    var title = document.createElement('p');
    title.textContent = '트리 제목: ' + intent.treeTitle;
    el.appendChild(title);
    var count = document.createElement('p');
    count.textContent = '가져올 북마크: ' + intent.count + '개';
    el.appendChild(count);
    var vis = document.createElement('p');
    vis.textContent = '공개 범위: 비공개';
    el.appendChild(vis);
    var note = document.createElement('p');
    note.textContent = '아직 저장되지 않았어요. 이 단계는 검토용이에요.';
    el.appendChild(note);
    el.hidden = false;
  }

  /**
   * Build the pre-write import intent from the current UI authority (title +
   * selection). Returns the detached intent, or null when the current authority
   * cannot produce an actionable intent (fails closed). The returned intent is
   * the only review payload; it never persists anything.
   */
  function buildImportIntent() {
    var norm = normalizeBookmarkImportTreeTitle(treeTitleRaw);
    if (!norm.ok) {
      if (norm.reason === 'TOO_LONG') {
        setTreeTitleError('트리 제목이 너무 길어요. 최대 ' + TREE_TITLE_MAX_LENGTH + '자까지 가능해요.');
      } else {
        setTreeTitleError('트리 제목을 입력해 주세요.');
      }
      invalidateReview();
      return null;
    }
    var preview = getPreview();
    var draft = buildOrderedBookmarkImportDraft(preview, getSelectedOccurrences());
    if (!draft || draft.count === 0) {
      clearTreeTitleError();
      invalidateReview();
      return null;
    }
    clearTreeTitleError();
    var intent = buildBookmarkImportIntent(draft, norm.value);
    currentReview = intent;
    renderReview(intent);
    return intent;
  }

  /** Current review/intent, or null when stale / non-actionable. */
  function getImportIntent() {
    return currentReview;
  }

  /** Whether a review/intent is currently actionable (not stale). */
  function hasActionableReview() {
    return currentReview !== null;
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
    var titleInput = $id(TREE_TITLE_INPUT_ID);
    if (titleInput && typeof titleInput.addEventListener === 'function') {
      titleInput.addEventListener('input', function () {
        setTreeTitle(titleInput.value);
      });
    }
    var reviewBtn = $id(REVIEW_BUILD_ID);
    if (reviewBtn && typeof reviewBtn.addEventListener === 'function') {
      reviewBtn.addEventListener('click', buildImportIntent);
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
    TREE_TITLE_MAX_LENGTH: TREE_TITLE_MAX_LENGTH,
    normalizeBookmarkImportTreeTitle: normalizeBookmarkImportTreeTitle,
    setTreeTitle: setTreeTitle,
    getTreeTitle: getTreeTitle,
    getNormalizedTreeTitle: getNormalizedTreeTitle,
    buildBookmarkImportIntent: buildBookmarkImportIntent,
    buildImportIntent: buildImportIntent,
    getImportIntent: getImportIntent,
    hasActionableReview: hasActionableReview,
    invalidateReview: invalidateReview,
  };
  if (typeof window !== 'undefined') {
    window.LoveBudBookmarkHtmlPreviewUI = publicApi;
  }
  if (typeof module !== 'undefined' && module && module.exports) {
    module.exports = publicApi;
  }
  init();
})();
