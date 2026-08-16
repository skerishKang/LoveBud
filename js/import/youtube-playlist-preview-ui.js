/**
 * LoveBud — Minimal UI: authenticated read-only YouTube playlist preview.
 *
 * Entry point: My Trees page (`/pages/my-trees.html`) — Issue #3914.
 *
 * Flow (read-only preview + ordered selection, no persistence):
 *   public playlist URL/ID
 *   -> authenticated same-origin preview request (js/api/import-youtube-playlist-preview.js)
 *   -> ordered read-only preview
 *   -> per-occurrence item selection (occurrence identity = position, NOT videoId)
 *   -> ordered import draft builder (source order preserved, no DB write)
 *   -> private-first import intent review (#4069): Tree title input + bounded
 *      deterministic private import intent, no Tree/Moment/Connection write
 *
 * #4069 import-intent review contract:
 *   - canonical Tree-title bound = 200 (validate_tree_title max_length, #3935)
 *   - trim deterministic; empty/whitespace-only and over-limit fail closed
 *   - prepared intent visibility is exactly 'private' — no public/import-and-
 *     publish shortcut; a public YouTube playlist is not publication authority
 *   - buildPrivateImportIntent() is pure/deterministic: preview + #4062
 *     selection + normalized title -> detached private intent; source order
 *     preserved, duplicate occurrences distinct, unavailable excluded
 *   - review state is never cached: every preview/selection/title change
 *     re-derives it, so a stale intent can never remain silently actionable
 *   - intent carries only bounded fields; no persisted IDs invented, no
 *     semantic Connections, no client-side persistence claim
 *
 * #4062 selection contract:
 *   - selection identity is the preview occurrence (position), so duplicate
 *     videoId occurrences are independently selectable
 *   - the ordered import draft is always in playlist source order, never the
 *     user's click order
 *   - eligibility is derived from the canonical #3914 item state vocabulary:
 *       PRIVATE_OR_UNAVAILABLE / UNKNOWN  -> not selectable (fail closed)
 *       AVAILABLE_METADATA / METADATA_PARTIAL / THUMBNAIL_UNAVAILABLE -> selectable
 *   - THUMBNAIL_UNAVAILABLE is NOT MEDIA_UNAVAILABLE: a missing thumbnail does
 *     not make an otherwise eligible item unselectable
 *   - selection is never persisted (no localStorage/sessionStorage/cookie/
 *     IndexedDB); it resets on new preview request, success, error, and close
 *   - buildOrderedImportDraft() is pure/deterministic and never mutates the
 *     preview object
 *
 * Rules enforced here:
 *   - URL-looking input is always sent as `source`; only genuine bare IDs
 *     become `playlistId` (watch/youtu.be/music URLs can never smuggle a
 *     bare list value past the accepted-source restrictions).
 *   - A provider thumbnail that fails to load swaps to ONE deterministic
 *     LoveBud placeholder — no multi-host retry chain — and the row shows the
 *     explicit THUMBNAIL_UNAVAILABLE state.
 *   - The trigger is a real focusable button (no permanent aria-hidden), the
 *     popover is a non-modal dialog, and the results region scrolls so all 50
 *     preview items are reachable.
 *
 * Refs: #3914, #3906, #3897, #3903, #1882.
 */

(function () {
  'use strict';

  function $id(id) {
    return typeof document !== 'undefined' && document ? document.getElementById(id) : null;
  }

  function escapeHtml(value) {
    if (value === null || value === undefined) return '';
    return String(value)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  var OPEN_BTN_ID = 'youtubePlaylistPreviewOpenBtn';
  var POPOVER_ID = 'youtubePlaylistPreviewPopover';
  var INPUT_ID = 'youtubePlaylistPreviewInput';
  var SUBMIT_ID = 'youtubePlaylistPreviewSubmitBtn';
  var RESULT_ID = 'youtubePlaylistPreviewResult';
  var SELECTION_BAR_ID = 'youtubePlaylistSelectionBar';
  var SELECTED_COUNT_ID = 'youtubePlaylistSelectedCount';

  // #4062 selection state. Occurrence identity is the preview `position`
  // (0-based), never videoId: the same video can appear at multiple playlist
  // positions and each occurrence must be independently selectable.
  var selection = {}; // { position: true } — module-local, never persisted
  var lastPreviewData = null; // latest successful preview (for draft building)

  var PLACEHOLDER_THUMB =
    'data:image/svg+xml;charset=utf-8,%3Csvg xmlns="http://www.w3.org/2000/svg" width="72" height="54" viewBox="0 0 72 54"%3E%3Crect width="72" height="54" fill="rgba(144,73,81,0.08)"/%3E%3Ctext x="50%25" y="50%25" dominant-baseline="middle" text-anchor="middle" fill="rgba(144,73,81,0.45)" font-size="12" font-family="system-ui"%3E%EC%9E%AC%EC%83%9D%EB%AA%A9%EB%A1%9D %EC%8D%B8%EB%84%A4%EC%9D%B4%EB%B8%94%3C/text%3E%3C/svg%3E';

  function localizeState(state) {
    switch (state) {
      case 'AVAILABLE_METADATA':
        return '메타데이터 있음';
      case 'PRIVATE_OR_UNAVAILABLE':
        return '비공개 또는 삭제됨';
      case 'METADATA_PARTIAL':
        return '메타데이터 일부만 있음';
      case 'THUMBNAIL_UNAVAILABLE':
        return '썸네일 없음';
      case 'UNKNOWN':
      default:
        return '상태 알 수 없음';
    }
  }

  function stateClassName(state) {
    return 'ypp-state-' + String(state || 'UNKNOWN').toLowerCase().replace(/_/g, '-');
  }

  /**
   * buildRequest — accepted-source restriction (see file header).
   * URL-looking input stays `source`; only genuine bare IDs become
   * `playlistId`. The server is the authority that validates the source.
   */
  function buildRequest(inputValue) {
    var value = String(inputValue || '').trim();
    var hasScheme = /^[a-zA-Z][a-zA-Z0-9+.-]*:\/\//.test(value);
    var looksLikeUrl = hasScheme || /^www\./i.test(value) || value.indexOf('/') !== -1;
    if (looksLikeUrl) {
      return { source: value };
    }
    return { playlistId: value };
  }

  /**
   * #4062 eligibility — derived from the canonical #3914 item state vocabulary.
   * THUMBNAIL_UNAVAILABLE is NOT MEDIA_UNAVAILABLE: a missing thumbnail does
   * not make an otherwise eligible item unselectable. Unknown/unavailable
   * states fail closed.
   */
  function isItemSelectable(item) {
    if (!item || typeof item !== 'object') return false;
    var position = item.position;
    if (position === null || position === undefined || position === '') return false;
    var state = item.state || 'UNKNOWN';
    if (state === 'PRIVATE_OR_UNAVAILABLE' || state === 'UNKNOWN') return false;
    return true; // AVAILABLE_METADATA | METADATA_PARTIAL | THUMBNAIL_UNAVAILABLE
  }

  /**
   * #4062 pure ordered import draft builder.
   * preview result + selection -> ordered draft (source order, selected only).
   * Never mutates the preview object; the returned draft is detached from
   * internal selection state and carries only #3914 contract fields.
   */
  function buildOrderedImportDraft(previewData, selectedPositions) {
    var items = (previewData && Array.isArray(previewData.items)) ? previewData.items : [];
    var selected = {};
    if (selectedPositions && typeof selectedPositions === 'object') {
      var keys = Array.isArray(selectedPositions) ? selectedPositions : Object.keys(selectedPositions);
      for (var i = 0; i < keys.length; i++) {
        selected[keys[i]] = true;
      }
    }
    var draft = [];
    for (var j = 0; j < items.length; j++) {
      var item = items[j];
      if (!item || !isItemSelectable(item)) continue;
      var key = String(item.position);
      if (!selected[key]) continue;
      draft.push({
        position: item.position,
        videoId: item.videoId || '',
        title: item.title || '',
        channelTitle: item.channelTitle || '',
        state: item.state || 'UNKNOWN',
        thumbnailUrl: item.thumbnailUrl || null,
        sourceUrl: item.sourceUrl || '',
      });
    }
    // Canonical source order — never click order. Items are emitted in the
    // same order they appear in the preview (position ascending).
    draft.sort(function (a, b) {
      return Number(a.position) - Number(b.position);
    });
    return draft;
  }

  // #4069 — canonical Tree-title bound. Server authority:
  // modal_compute/validation.py validate_tree_title(max_length=200) (#3935).
  // Two distinct authorities, kept separate:
  //   (a) backend canonical = deterministic trim + max 200 Unicode CODE
  //       POINTS (Python len()); we count code points (Array.from) so
  //       emoji/non-BMP titles match the backend exactly.
  //   (b) #4069 product fail-closed requirement (NOT backend
  //       validate_tree_title behavior): reject non-string, empty, or
  //       whitespace-only title.
  // No new persisted limit invented; 200 is the existing canonical bound.
  var TREE_TITLE_MAX = 200;
  var PRIVATE_VISIBILITY = 'private';
  var TITLE_INPUT_ID = 'youtubePlaylistTreeTitle';
  var TITLE_ERROR_ID = 'youtubePlaylistTitleError';
  var REVIEW_ID = 'youtubePlaylistReview';

  /**
   * #4069 normalizeTreeTitle — deterministic trim + bounded length.
   *
   * Two distinct authorities, kept separate:
   *   (a) backend canonical (modal_compute/validation.py::validate_tree_title,
   *       max_length=200): deterministic trim + reject over 200 Unicode CODE
   *       POINTS. We count code points (Array.from) so emoji/non-BMP characters
   *       align with Python's len().
   *   (b) #4069 product fail-closed requirement (not part of the backend
   *       trim+max authority): reject non-string, empty, or whitespace-only.
   */
  function normalizeTreeTitle(raw) {
    if (typeof raw !== 'string') return { ok: false, code: 'TITLE_INVALID_TYPE' };
    var text = raw.trim();
    if (text.length === 0) return { ok: false, code: 'TITLE_REQUIRED' };
    // Code-point length (not UTF-16 units) to match backend len() exactly.
    if (Array.from(text).length > TREE_TITLE_MAX) return { ok: false, code: 'TITLE_TOO_LONG' };
    return { ok: true, value: text };
  }

  /**
   * #4069 buildPrivateImportIntent — pure/deterministic private-first import
   * intent builder.
   *   accepted preview identity + #4062 ordered selected occurrences +
   *   normalized Tree title -> detached private import intent.
   * Invariants:
   *   - source order preserved (never click order)
   *   - duplicate video occurrences remain distinct (occurrence identity)
   *   - unavailable/non-selectable occurrences cannot re-enter
   *   - caller preview/selection/title inputs are never mutated
   *   - returned intent is detached from internal selection state
   *   - no persisted Tree/Moment IDs invented; no semantic Connections
   *     generated from adjacency; no client-side persistence claim
   */
  function buildPrivateImportIntent(previewData, selectedPositions, rawTitle) {
    var titleResult = normalizeTreeTitle(rawTitle);
    if (!titleResult.ok) return { ok: false, error: titleResult };
    var orderedItems = buildOrderedImportDraft(previewData, selectedPositions);
    if (orderedItems.length === 0) {
      return { ok: false, error: { code: 'NO_SELECTED_ELIGIBLE_ITEMS' } };
    }
    var playlist = (previewData && previewData.playlist) || {};
    return {
      ok: true,
      intent: {
        source: {
          playlistId: typeof playlist.id === 'string' ? playlist.id : '',
          playlistTitle: typeof playlist.title === 'string' ? playlist.title : '',
          channelTitle: typeof playlist.channelTitle === 'string' ? playlist.channelTitle : '',
        },
        items: orderedItems,
        tree: {
          title: titleResult.value,
          visibility: PRIVATE_VISIBILITY,
        },
        pending: true, // no persisted entity — a later transactional write child creates it
      },
    };
  }

  function readTitleValue() {
    var input = $id(TITLE_INPUT_ID);
    return input ? String(input.value || '') : '';
  }

  function clearTitleInput() {
    var input = $id(TITLE_INPUT_ID);
    if (input) input.value = '';
    setTitleError('');
  }

  function setTitleError(message) {
    var err = $id(TITLE_ERROR_ID);
    if (!err) return;
    err.textContent = message || '';
    err.hidden = !message;
  }

  /** Eligible positions currently selected against the live preview. */
  function selectedEligiblePositions() {
    var items = (lastPreviewData && Array.isArray(lastPreviewData.items)) ? lastPreviewData.items : [];
    var result = {};
    for (var i = 0; i < items.length; i++) {
      var it = items[i];
      if (isItemSelectable(it) && selection[String(it.position)] === true) {
        result[String(it.position)] = true;
      }
    }
    return result;
  }

  /**
   * #4069 renderReview — re-derives the pre-write review from live state only.
   * The review/intent is never cached, so a stale intent can never remain
   * silently actionable: every preview/selection/title change re-renders it.
   */
  function renderReview() {
    var review = $id(REVIEW_ID);
    if (!review) return;
    if (!lastPreviewData) {
      review.innerHTML = '';
      setTitleError('');
      return;
    }
    var titleResult = normalizeTreeTitle(readTitleValue());
    var count = Object.keys(selectedEligiblePositions()).length;
    if (!titleResult.ok) {
      setTitleError(
        titleResult.code === 'TITLE_REQUIRED'
          ? 'Tree 제목을 입력해주세요.'
          : titleResult.code === 'TITLE_TOO_LONG'
            ? '제목은 ' + TREE_TITLE_MAX + '자 이하여야 해요.'
            : 'Tree 제목 형식을 확인해주세요.'
      );
      review.innerHTML = '<p class="ypp-review-muted">제목을 확인한 뒤 다시 확인해주세요.</p>';
      return;
    }
    setTitleError('');
    if (count === 0) {
      review.innerHTML = '<p class="ypp-review-muted">가져올 항목을 선택해주세요.</p>';
      return;
    }
    var intentResult = buildPrivateImportIntent(lastPreviewData, selectedEligiblePositions(), titleResult.value);
    if (!intentResult.ok) {
      review.innerHTML = '<p class="ypp-review-muted">가져올 항목을 다시 확인해주세요.</p>';
      return;
    }
    review.innerHTML =
      '<div class="ypp-review-ready" data-review-ready="true">' +
        '<p class="ypp-review-title">Tree 제목: <strong>' + escapeHtml(titleResult.value) + '</strong></p>' +
        '<p>선택 항목: ' + count + '개</p>' +
        '<p>공개 범위: 비공개</p>' +
        '<p>아직 Tree가 생성되지 않았어요. 이 검토는 저장 전 준비 단계예요.</p>' +
      '</div>';
  }

  /**
   * #4069 getPreparedImportIntent — current detached private intent from live
   * UI state, or null when no preview / invalid title / nothing selected.
   * Recomputes every call — never returns a stale cached intent.
   */
  function getPreparedImportIntent() {
    if (!lastPreviewData) return null;
    var result = buildPrivateImportIntent(lastPreviewData, selection, readTitleValue());
    if (!result.ok) return null;
    return result.intent;
  }

  function resetSelection() {
    selection = {};
    updateSelectionCount();
  }

  function updateSelectionCount() {
    var countEl = $id(SELECTED_COUNT_ID);
    if (countEl) {
      countEl.textContent = '선택 ' + Object.keys(selection).length + '개';
    }
    renderReview(); // #4069: any selection change re-derives the review
  }

  function selectionCount() {
    return Object.keys(selection).length;
  }

  /** Select every eligible occurrence. `itemsOverride` is for callers/tests
   *  that want deterministic selection without a preceding render; the UI
   *  path uses the last successful preview. */
  function selectAllEligible(itemsOverride) {
    var items = (itemsOverride && Array.isArray(itemsOverride))
      ? itemsOverride
      : ((lastPreviewData && Array.isArray(lastPreviewData.items)) ? lastPreviewData.items : []);
    var next = {};
    for (var i = 0; i < items.length; i++) {
      if (isItemSelectable(items[i])) {
        next[String(items[i].position)] = true;
      }
    }
    selection = next;
    syncSelectionUi();
  }

  function clearSelection() {
    selection = {};
    syncSelectionUi();
  }

  function toggleSelection(position) {
    if (position === null || position === undefined) return;
    var key = String(position);
    // Never allow selecting an item that is not eligible.
    var items = (lastPreviewData && Array.isArray(lastPreviewData.items)) ? lastPreviewData.items : [];
    var target = null;
    for (var i = 0; i < items.length; i++) {
      if (String(items[i].position) === key) {
        target = items[i];
        break;
      }
    }
    if (!target || !isItemSelectable(target)) return;
    if (selection[key]) {
      delete selection[key];
    } else {
      selection[key] = true;
    }
    updateSelectionCount();
  }

  /** Re-render only the selection UI (checkboxes + count) after a change,
   *  keeping the rest of the preview surface intact. */
  function syncSelectionUi() {
    var result = $id(RESULT_ID);
    if (!result) {
      updateSelectionCount();
      return;
    }
    var boxes = result.querySelectorAll('.ypp-select');
    for (var i = 0; i < boxes.length; i++) {
      var pos = boxes[i].getAttribute('data-position');
      boxes[i].checked = pos !== null && selection[pos] === true;
    }
    updateSelectionCount();
  }

  function renderRow(item) {
    var state = item.state || 'UNKNOWN';
    var stateClass = stateClassName(state);
    var label = localizeState(state);
    var selectable = isItemSelectable(item);
    var pos = item.position !== null && item.position !== undefined ? String(item.position) : '';
    var checked = pos !== '' && selection[pos] === true ? ' checked' : '';
    var disabled = selectable ? '' : ' disabled';
    var selectLabel = (item.position !== null && item.position !== undefined ? (Number(item.position) + 1) + '번 ' : '') +
      (item.title || '제목 없음') + (selectable ? ' 선택' : ' — 선택 불가');
    var thumbHtml;
    if (item.thumbnailUrl) {
      thumbHtml =
        '<img src="' + escapeHtml(item.thumbnailUrl) + '" alt="" class="ypp-thumb-img" data-state="' +
        escapeHtml(state) + '" loading="lazy" />';
    } else {
      thumbHtml = '<img src="' + PLACEHOLDER_THUMB + '" alt="썸네일 없음" class="ypp-thumb-placeholder" loading="lazy" />';
    }
    var sourceLink = item.sourceUrl
      ? '<a class="ypp-source" href="' + escapeHtml(item.sourceUrl) + '" target="_blank" rel="noopener" aria-label="YouTube에서 열기">YouTube</a>'
      : '';
    return (
      '<div class="ypp-row" data-position="' + (item.position != null ? item.position : '') + '" role="row">' +
        '<span class="ypp-select-cell">' +
          '<input type="checkbox" class="ypp-select" data-position="' + escapeHtml(pos) + '"' +
          ' aria-label="' + escapeHtml(selectLabel) + '"' + checked + disabled + ' />' +
        '</span>' +
        '<span class="ypp-order" aria-hidden="true">#' + escapeHtml(String(item.position != null ? item.position + 1 : '')) + '</span>' +
        '<span class="ypp-thumb">' + thumbHtml + '</span>' +
        '<span class="ypp-meta">' +
          '<span class="ypp-title">' + escapeHtml(item.title || '제목 없음') + '</span>' +
          '<span class="ypp-channel">' + escapeHtml(item.channelTitle || '') + '</span>' +
          '<span class="ypp-state ' + stateClass + '">' + escapeHtml(label) + '</span>' +
        '</span>' +
        sourceLink +
      '</div>'
    );
  }

  /**
   * Thumbnail load-failure fallback: swap to the deterministic LoveBud
   * placeholder and surface the explicit THUMBNAIL_UNAVAILABLE state.
   * No alternate YouTube host is ever retried.
   */
  function attachThumbnailFallback(img) {
    if (!img || img.classList.contains('ypp-thumb-placeholder')) return;
    img.addEventListener('error', function () {
      if (img.getAttribute('data-fallback') === '1') return;
      img.setAttribute('data-fallback', '1');
      img.src = PLACEHOLDER_THUMB;
      img.classList.remove('ypp-thumb-img');
      img.classList.add('ypp-thumb-placeholder');
      var row = img.closest ? img.closest('.ypp-row') : null;
      if (row) {
        var badge = row.querySelector('.ypp-state');
        var priorState = img.getAttribute('data-state') || '';
        if (badge && (priorState === 'AVAILABLE_METADATA' || priorState === 'METADATA_PARTIAL')) {
          badge.textContent = localizeState('THUMBNAIL_UNAVAILABLE');
          badge.className = 'ypp-state ' + stateClassName('THUMBNAIL_UNAVAILABLE');
        }
      }
    });
  }

  function buildPlaylistHtml(data) {
    var items = data && data.items ? data.items : [];
    var title = (data && data.playlist && data.playlist.title) || '재생목록';
    var channel = (data && data.playlist && data.playlist.channelTitle) || '';
    var parts = [];
    parts.push('<div class="ypp-head"><h4>' + escapeHtml(title) + '</h4>');
    if (channel) parts.push('<span class="ypp-channel-head">' + escapeHtml(channel) + '</span>');
    parts.push('</div>');
    // #4062 selection bar: select-all-eligible / clear / live count.
    parts.push(
      '<div class="ypp-selection-bar" id="' + SELECTION_BAR_ID + '">' +
        '<span class="ypp-selected-count" id="' + SELECTED_COUNT_ID + '" aria-live="polite">선택 0개</span>' +
        '<button type="button" class="ypp-select-all-btn" data-ypp-action="select-all">전체 선택</button>' +
        '<button type="button" class="ypp-clear-btn" data-ypp-action="clear">선택 해제</button>' +
      '</div>'
    );
    if (items.length === 0) {
      parts.push('<div class="ypp-empty">항목이 없어요.</div>');
    } else {
      parts.push('<ul class="ypp-list">');
      for (var i = 0; i < items.length; i++) {
        parts.push('<li>' + renderRow(items[i]) + '</li>');
      }
      parts.push('</ul>');
    }
    if (data && data.truncated) {
      parts.push('<div class="ypp-truncated">최대 50개까지 미리보기로 표시됩니다.</div>');
    }
    return parts.join('');
  }

  function renderPlaylist(data) {
    var result = $id(RESULT_ID);
    if (!result) return;
    result.innerHTML = buildPlaylistHtml(data);
    var images = result.querySelectorAll('.ypp-thumb-img');
    for (var i = 0; i < images.length; i++) {
      attachThumbnailFallback(images[i]);
    }
  }

  function renderError(message) {
    return '<p class="ypp-error" role="alert">' + escapeHtml(message || '예상치 못한 오류가 발생했어요.') + '</p>';
  }

  function renderLoading() {
    return '<div class="ypp-loading" role="status" aria-live="polite"><span class="material-symbols-outlined">hourglass_empty</span><span>미리보기를 불러오는 중...</span></div>';
  }

  var api = (typeof window !== 'undefined' && window.LoveTreeYouTubePlaylistPreview) || null;

  function setStateLoading() {
    lastPreviewData = null; // #4069: new preview request invalidates prior review
    resetSelection(); // new preview request: stale selection must not leak
    clearTitleInput(); // #4069: stale title/review must not survive a new request
    var result = $id(RESULT_ID);
    if (result) result.innerHTML = renderLoading();
    renderReview();
  }

  function setStateSuccess(data) {
    lastPreviewData = data;
    resetSelection(); // fresh success: stale selection must not leak
    renderPlaylist(data);
    clearTitleInput(); // #4069: new preview success invalidates prior review
    renderReview();
  }

  function setStateError(code, message) {
    lastPreviewData = null;
    resetSelection(); // error: stale selection must not leak
    clearTitleInput(); // #4069: error invalidates stale review
    var result = $id(RESULT_ID);
    if (result) result.innerHTML = renderError(message);
    renderReview();
  }

  function readIdentity() {
    var input = $id(INPUT_ID);
    return input ? input.value.trim() : '';
  }

  function closePopover(returnFocus) {
    var popover = $id(POPOVER_ID);
    var btn = $id(OPEN_BTN_ID);
    if (!popover || popover.hidden) return;
    popover.hidden = true;
    if (btn) btn.setAttribute('aria-expanded', 'false');
    var result = $id(RESULT_ID);
    if (result) result.innerHTML = '';
    lastPreviewData = null;
    resetSelection(); // close: stale selection must not be silently restored
    clearTitleInput(); // #4069: close invalidates review state
    var review = $id(REVIEW_ID);
    if (review) review.innerHTML = '';
    if (returnFocus && btn && typeof btn.focus === 'function') {
      btn.focus();
    }
  }

  function openPopover() {
    var popover = $id(POPOVER_ID);
    var btn = $id(OPEN_BTN_ID);
    if (!popover) return;
    popover.hidden = false;
    if (btn) btn.setAttribute('aria-expanded', 'true');
    var input = $id(INPUT_ID);
    if (input && typeof input.focus === 'function') {
      input.focus();
    }
    renderReview(); // #4069: reopen reflects current (cleared) review state
  }

  function onOpenButtonClick() {
    var popover = $id(POPOVER_ID);
    var btn = $id(OPEN_BTN_ID);
    if (!popover || !btn) return;
    var expanded = btn.getAttribute('aria-expanded') === 'true';
    if (expanded) {
      closePopover(true);
    } else {
      openPopover();
    }
  }

  function onSubmit() {
    if (!api || typeof api.requestPreview !== 'function') return;
    var inputValue = readIdentity();
    if (!inputValue) {
      setStateError('INVALID_PLAYLIST_SOURCE', '재생목록 URL 또는 ID를 입력해주세요.');
      return;
    }
    var request = buildRequest(inputValue);
    setStateLoading();
    api.requestPreview(request, { timeoutMs: 15000 })
      .then(function (result) {
        setStateSuccess(result);
      })
      .catch(function (err) {
        var code = (err && err.code) || 'INTERNAL_PREVIEW_ERROR';
        setStateError(code, (err && err.message) || '미리보기를 불러오지 못했어요.');
      });
  }

  function attachEvents() {
    var openBtn = $id(OPEN_BTN_ID);
    if (openBtn && typeof openBtn.addEventListener === 'function') {
      openBtn.addEventListener('click', onOpenButtonClick);
    }
    var submitBtn = $id(SUBMIT_ID);
    if (submitBtn && typeof submitBtn.addEventListener === 'function') {
      submitBtn.addEventListener('click', onSubmit);
    }
    var input = $id(INPUT_ID);
    if (input && typeof input.addEventListener === 'function') {
      input.addEventListener('keydown', function (event) {
        if (event.key === 'Enter') {
          event.preventDefault();
          onSubmit();
        } else if (event.key === 'Escape') {
          event.preventDefault();
          closePopover(true);
        }
      });
    }
    var titleInput = $id(TITLE_INPUT_ID);
    if (titleInput && typeof titleInput.addEventListener === 'function') {
      titleInput.addEventListener('input', function () {
        renderReview(); // #4069: title change re-derives review
      });
    }
    var popover = $id(POPOVER_ID);
    if (popover && typeof popover.addEventListener === 'function') {
      popover.addEventListener('keydown', function (event) {
        if (event.key === 'Escape') {
          event.preventDefault();
          closePopover(true);
        }
      });
    }
    // #4062 selection event delegation: checkboxes + select-all/clear.
    var result = $id(RESULT_ID);
    if (result && typeof result.addEventListener === 'function') {
      result.addEventListener('change', function (event) {
        var box = event && event.target;
        if (!box || box.classList === undefined || !box.classList.contains('ypp-select')) return;
        var pos = box.getAttribute('data-position');
        if (pos === null || pos === undefined) return;
        var key = String(pos);
        var items = (lastPreviewData && Array.isArray(lastPreviewData.items)) ? lastPreviewData.items : [];
        var target = null;
        for (var i = 0; i < items.length; i++) {
          if (String(items[i].position) === key) {
            target = items[i];
            break;
          }
        }
        if (!target || !isItemSelectable(target)) {
          box.checked = false;
          return;
        }
        if (box.checked) {
          selection[key] = true;
        } else {
          delete selection[key];
        }
        updateSelectionCount();
      });
      result.addEventListener('click', function (event) {
        var btn = event && event.target;
        if (!btn || btn.getAttribute === undefined) return;
        var action = btn.getAttribute('data-ypp-action');
        if (action === 'select-all') {
          selectAllEligible();
        } else if (action === 'clear') {
          clearSelection();
        }
      });
    }
  }

  function init() {
    api = (typeof window !== 'undefined' && window.LoveTreeYouTubePlaylistPreview) || null;
    if (typeof window !== 'undefined') {
      document.addEventListener('DOMContentLoaded', attachEvents);
    }
  }

  var publicApi = {
    init: init,
    buildRequest: buildRequest,
    isItemSelectable: isItemSelectable,
    buildOrderedImportDraft: buildOrderedImportDraft,
    buildPrivateImportIntent: buildPrivateImportIntent,
    normalizeTreeTitle: normalizeTreeTitle,
    getPreparedImportIntent: getPreparedImportIntent,
    renderReview: renderReview,
    clearTitleInput: clearTitleInput,
    setStateLoading: setStateLoading,
    setStateSuccess: setStateSuccess,
    setStateError: setStateError,
    renderRow: renderRow,
    renderPlaylist: renderPlaylist,
    buildPlaylistHtml: buildPlaylistHtml,
    localizeState: localizeState,
    escapeHtml: escapeHtml,
    resetSelection: resetSelection,
    selectAllEligible: selectAllEligible,
    clearSelection: clearSelection,
    selectionCount: selectionCount,
    TREE_TITLE_MAX: TREE_TITLE_MAX,
    PRIVATE_VISIBILITY: PRIVATE_VISIBILITY,
  };
  if (typeof window !== 'undefined') {
    window.LoveTreeYouTubePlaylistPreviewUI = publicApi;
  }
  if (typeof module !== 'undefined' && module && module.exports) {
    module.exports = publicApi;
  }
  init();
})();
