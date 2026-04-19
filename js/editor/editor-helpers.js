/**
 * LoveBud - Editor Helpers
 * v20260420-1
 *
 * Responsibilities:
 * - i18n-safe text resolution
 * - safe html/url helpers
 * - YouTube thumbnail/url helpers
 */

(function() {
  function safeI18nText(i18nFn, key, fallback) {
    var result = typeof i18nFn === 'function' ? i18nFn(key) : '';
    if (!result || result === key) return fallback;
    return result;
  }

  function resolveHintText(i18nFn, rawValue, fallbackKey, fallbackText) {
    var value = String(rawValue || '').trim();
    if (!value || value === fallbackKey) {
      return safeI18nText(i18nFn, fallbackKey, fallbackText);
    }
    return value;
  }

  function resolveTreeTitleText(i18nFn, rawTitle) {
    var value = String(rawTitle || '').trim();
    if (!value) {
      return safeI18nText(i18nFn, 'default_tree_title', '러브트리');
    }
    if (value === 'default_tree_title') {
      return safeI18nText(i18nFn, 'default_tree_title', '러브트리');
    }
    if (value === 'lovetree_brand') {
      return safeI18nText(i18nFn, 'lovetree_brand', '러브트리');
    }
    return value;
  }

  function resolveInfoText(i18nFn, rawValue, fallbackKey, fallbackText) {
    var value = String(rawValue || '').trim();
    if (!value || value === fallbackKey) {
      return safeI18nText(i18nFn, fallbackKey, fallbackText);
    }
    return value;
  }

  function escapeHtml(value) {
    return String(value ?? '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  function safeUrl(value, options) {
    var allowDataImage = !!(options && options.allowDataImage);
    var raw = String(value || '').trim();
    if (!raw) return '';

    if (allowDataImage && raw.indexOf('data:image/') === 0) {
      return raw;
    }

    try {
      var url = new URL(raw, window.location.origin);
      var protocol = String(url.protocol || '').toLowerCase();
      if (protocol === 'http:' || protocol === 'https:') {
        return url.toString();
      }
      return '';
    } catch (e) {
      return '';
    }
  }

  function extractYouTubeIdFallback(url) {
    var patterns = [
      /(?:v=|\/|youtu\.be\/|shorts\/)([0-9A-Za-z_-]{11})/i,
      /youtube\.com\/watch\?v=([0-9A-Za-z_-]{11})/i,
      /youtu\.be\/([0-9A-Za-z_-]{11})/i
    ];

    for (var i = 0; i < patterns.length; i += 1) {
      var match = String(url || '').match(patterns[i]);
      if (match) return match[1];
    }
    return null;
  }

  function resolveMemoryThumbnail(memory, quality) {
    var nextQuality = quality || 'hqdefault';
    var thumbnail = safeUrl(memory && memory.thumbnail, { allowDataImage: true });
    if (thumbnail) return thumbnail;

    var sourceUrl = safeUrl(memory && memory.sourceUrl);
    var sourceType =
      (memory && memory.sourceType) ||
      window.LoveBudMedia?.detectSourceType?.(sourceUrl) ||
      'youtube';

    if (sourceUrl && sourceType === 'youtube') {
      var videoId =
        window.LoveBudMedia?.extractYouTubeId?.(sourceUrl) ||
        extractYouTubeIdFallback(sourceUrl);

      if (videoId) {
        return 'https://img.youtube.com/vi/' + videoId + '/' + nextQuality + '.jpg';
      }
    }

    return '';
  }

  function getThumbnailFallbackChain(memory) {
    var qualities = ['hqdefault', 'mqdefault', 'default'];
    return qualities.map(function(q) {
      return resolveMemoryThumbnail(memory, q);
    });
  }

  function getYouTubeInputErrorMessage(i18nFn, rawUrl) {
    var value = String(rawUrl || '').trim();

    if (!value) {
      return i18nFn('enter_youtube') || 'YouTube 링크를 입력해 주세요.';
    }

    var looksLikeUrl = /^(https?:\/\/|www\.)/i.test(value);
    var hasYouTubeHint = /(youtube\.com|youtu\.be|youtube\.com\/shorts\/)/i.test(value);
    var idLikeMatch = value.match(/(?:v=|\/|youtu\.be\/|shorts\/)([0-9A-Za-z_-]+)/i);
    var candidateId = idLikeMatch ? idLikeMatch[1] : '';

    if (!looksLikeUrl) {
      return i18nFn('invalid_youtube_format') || '전체 YouTube 링크를 붙여 넣어 주세요.';
    }

    if (!hasYouTubeHint) {
      return i18nFn('invalid_youtube_unsupported') || 'YouTube 링크만 지원합니다. youtube.com 또는 youtu.be 링크를 사용해 주세요.';
    }

    if (candidateId && candidateId.length !== 11) {
      return i18nFn('invalid_youtube_id_length') || '링크가 중간에 잘린 것 같아요. 전체 YouTube 링크를 다시 복사해 주세요.';
    }

    return i18nFn('invalid_youtube') || '유효한 YouTube 링크를 입력해 주세요.';
  }

  function createToast(options) {
    var warningKey = (options && options.warningKey) || '__editorToastWarningShown';

    return function showToast(message, type) {
      var nextType = type || 'info';

      if (window.LoveBudUI?.showToast) {
        window.LoveBudUI.showToast(message, nextType, 3000);
        return;
      }

      if (!window[warningKey]) {
        console.warn('[editor] LoveBudUI not loaded, toast degraded to console');
        window[warningKey] = true;
      }

      console.log('[Toast ' + nextType + '] ' + message);
    };
  }

  function getI18n() {
    return window.t || function(k) { return k; };
  }

  window.LoveBudEditorHelpers = {
    safeI18nText: safeI18nText,
    resolveHintText: resolveHintText,
    resolveTreeTitleText: resolveTreeTitleText,
    resolveInfoText: resolveInfoText,
    escapeHtml: escapeHtml,
    safeUrl: safeUrl,
    extractYouTubeIdFallback: extractYouTubeIdFallback,
    resolveMemoryThumbnail: resolveMemoryThumbnail,
    getThumbnailFallbackChain: getThumbnailFallbackChain,
    getYouTubeInputErrorMessage: getYouTubeInputErrorMessage,
    createToast: createToast,
    getI18n: getI18n
  };
})();
