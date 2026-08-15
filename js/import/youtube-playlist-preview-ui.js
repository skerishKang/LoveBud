/**
 * LoveBud — Minimal UI: authenticated read-only YouTube playlist preview.
 *
 * Entry point: My Trees page (`/pages/my-trees.html`) — Issue #3914.
 *
 * Flow (read-only preview, no persistence):
 *   public playlist URL/ID
 *   -> authenticated same-origin preview request (js/api/import-youtube-playlist-preview.js)
 *   -> ordered read-only preview
 *   -> Tree write 0, Moment write 0, Connection write 0
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

  function renderRow(item) {
    var state = item.state || 'UNKNOWN';
    var stateClass = stateClassName(state);
    var label = localizeState(state);
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
    var result = $id(RESULT_ID);
    if (result) result.innerHTML = renderLoading();
  }

  function setStateSuccess(data) {
    renderPlaylist(data);
  }

  function setStateError(code, message) {
    var result = $id(RESULT_ID);
    if (result) result.innerHTML = renderError(message);
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
    var popover = $id(POPOVER_ID);
    if (popover && typeof popover.addEventListener === 'function') {
      popover.addEventListener('keydown', function (event) {
        if (event.key === 'Escape') {
          event.preventDefault();
          closePopover(true);
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

  if (typeof window !== 'undefined') {
    window.LoveTreeYouTubePlaylistPreviewUI = {
      init: init,
      buildRequest: buildRequest,
      renderRow: renderRow,
      renderPlaylist: renderPlaylist,
      localizeState: localizeState,
    };
  }
  if (typeof module !== 'undefined' && module && module.exports) {
    module.exports = {
      init: init,
      buildRequest: buildRequest,
      renderRow: renderRow,
      renderPlaylist: renderPlaylist,
      localizeState: localizeState,
      escapeHtml: escapeHtml,
    };
  }
  init();
})();
