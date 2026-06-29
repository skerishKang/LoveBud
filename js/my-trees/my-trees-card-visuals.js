(function () {
  'use strict';

  function getUtils() {
    return window.LoveBudMyTreesUtils || {};
  }

  function getI18nText(i18n, key, fallback) {
    if (typeof i18n !== 'function') return fallback;
    var value = i18n(key);
    if (!value || value === key || String(value).toLowerCase() === String(key).toLowerCase()) {
      return fallback;
    }
    return value;
  }

  function escapeHtml(str) {
    var Utils = getUtils();
    if (typeof Utils.escapeHtml === 'function') {
      return Utils.escapeHtml(str);
    }
    if (str == null) return '';
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/\"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  function hashSeed(value) {
    var Utils = getUtils();
    if (typeof Utils.hashSeed === 'function') {
      return Utils.hashSeed(value);
    }
    var source = String(value || 'lovetree');
    var hash = 0;
    for (var i = 0; i < source.length; i++) {
      hash = ((hash << 5) - hash) + source.charCodeAt(i);
      hash |= 0;
    }
    return Math.abs(hash);
  }

  function getTreeMomentCount(tree) {
    var Utils = getUtils();
    if (typeof Utils.getTreeMomentCount === 'function') {
      return Utils.getTreeMomentCount(tree);
    }
    if (!tree) return 0;
    var count =
      tree.memoryCount ??
      tree.memory_count ??
      tree.nodeCount ??
      tree.node_count ??
      (Array.isArray(tree.memories) ? tree.memories.length : undefined) ??
      (Array.isArray(tree.nodes) ? tree.nodes.length : undefined) ??
      0;
    count = Number(count);
    return Number.isFinite(count) ? count : 0;
  }

  function clipText(value, maxLength) {
    var Utils = getUtils();
    if (typeof Utils.clipText === 'function') {
      return Utils.clipText(value, maxLength);
    }
    var text = String(value || '').trim();
    if (!text) return '';
    if (text.length <= maxLength) return text;
    return text.slice(0, maxLength).trim() + '\u2026';
  }

  function firstStringValue(source, keys) {
    if (!source) return '';
    for (var i = 0; i < keys.length; i++) {
      var value = source[keys[i]];
      if (typeof value === 'string' && value.trim()) return value.trim();
    }
    return '';
  }

  function getFirstMemory(tree) {
    if (!tree) return null;
    var list = Array.isArray(tree.memories) ? tree.memories : (Array.isArray(tree.nodes) ? tree.nodes : []);
    if (!list.length) return null;
    return list.slice().sort(function (a, b) {
      var left = new Date((a && (a.createdAt || a.created_at || a.timestamp)) || 0).getTime();
      var right = new Date((b && (b.createdAt || b.created_at || b.timestamp)) || 0).getTime();
      return left - right;
    })[0] || null;
  }

  function canonicalizeThumbnailUrl(thumbnailUrl, fallbackSourceUrl) {
    var Adapter = window.LoveTreePublicTreeAdapter;
    if (Adapter && typeof Adapter.canonicalizeYouTubeThumbnailUrl === 'function') {
      return Adapter.canonicalizeYouTubeThumbnailUrl(thumbnailUrl, fallbackSourceUrl) || '';
    }
    return String(thumbnailUrl || '').trim();
  }

  function getVisibilityActionLabel(tree, i18n) {
    return tree && tree.visibility === 'public'
      ? getI18nText(i18n, 'visibility_make_private', '비공개로 전환')
      : getI18nText(i18n, 'visibility_make_public', '공개로 전환');
  }

  function getTreeCardMeta(tree, i18n) {
    var visibility = tree && tree.visibility === 'public' ? 'public' : 'private';
    var visibilityLabel = visibility === 'public'
      ? getI18nText(i18n, 'myTrees.summary_public', '공개')
      : getI18nText(i18n, 'myTrees.summary_private', '비공개');

    return {
      visibilityIcon: visibility === 'public' ? 'lock' : 'public',
      visibilityActionLabel: getVisibilityActionLabel(tree, i18n),
      title: tree && tree.title,
      mood: getTreeMomentCount(tree) > 0
        ? getI18nText(i18n, 'myTrees.card_growing', '차곡차곡 자라는 중')
        : getI18nText(i18n, 'myTrees.card_waiting', '첫 순간을 기다리는 중'),
      privateBadgeHtml: visibility === 'private' ? '<div class="tree-card-meta"><span class="tree-card-visibility private"><span class="material-symbols-outlined" style="font-size:12px;">lock</span>' + visibilityLabel + '</span></div>' : ''
    };
  }

  function getTreeMoodPalette(tree) {
    var seed = hashSeed((tree && tree.id) || (tree && tree.title) || 'lovetree');
    var palettes = [
      {
        background: 'linear-gradient(135deg, #fff3f6 0%, #f8e4ea 42%, #f6efe8 100%)',
        leaf: '#d8839a',
        leafSoft: 'rgba(216, 131, 154, 0.18)',
        accent: '#904951'
      },
      {
        background: 'linear-gradient(135deg, #fdf6ea 0%, #f7ebd7 46%, #f5f0f7 100%)',
        leaf: '#c79d68',
        leafSoft: 'rgba(199, 157, 104, 0.18)',
        accent: '#9d6b4d'
      },
      {
        background: 'linear-gradient(135deg, #f2f6ef 0%, #e4efe1 48%, #f8efe8 100%)',
        leaf: '#7a8b6e',
        leafSoft: 'rgba(122, 139, 110, 0.18)',
        accent: '#5d6f52'
      },
      {
        background: 'linear-gradient(135deg, #f6f0fb 0%, #ece4f7 42%, #fdf2f3 100%)',
        leaf: '#9f7ec2',
        leafSoft: 'rgba(159, 126, 194, 0.18)',
        accent: '#7d5ba6'
      }
    ];

    return palettes[seed % palettes.length];
  }

  function buildMiniTreeSVG(tree) {
    var palette = getTreeMoodPalette(tree);
    var momentCount = Math.max(0, Math.min(6, getTreeMomentCount(tree)));
    var leafDots = [];
    var positions = [
      { x: 58, y: 58, r: 10 },
      { x: 150, y: 50, r: 10 },
      { x: 72, y: 26, r: 8 },
      { x: 102, y: 58, r: 11 },
      { x: 132, y: 88, r: 8 },
      { x: 84, y: 104, r: 7 }
    ];

    for (var i = 0; i < positions.length; i++) {
      var pos = positions[i];
      var isFilled = i < momentCount;
      leafDots.push(
        '<circle cx="' + pos.x + '" cy="' + pos.y + '" r="' + pos.r + '" fill="' + (isFilled ? palette.leafSoft : 'rgba(255,255,255,0.82)') + '" stroke="' + palette.leaf + '" stroke-width="1.5"/>'
      );
    }

    return [
      '<svg viewBox="0 0 200 200" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">',
        '<defs>',
          '<linearGradient id="trunkGrad-' + hashSeed((tree && tree.id) || 'trunk') + '" x1="0%" y1="0%" x2="100%" y2="0%">',
            '<stop offset="0%" style="stop-color:#904951;stop-opacity:1" />',
            '<stop offset="50%" style="stop-color:#b85c66;stop-opacity:1" />',
            '<stop offset="100%" style="stop-color:#904951;stop-opacity:1" />',
          '</linearGradient>',
        '</defs>',
        '<path d="M 100 182 Q 98 142 100 112 Q 102 82 95 52" stroke="url(#trunkGrad-' + hashSeed((tree && tree.id) || 'trunk') + ')" stroke-width="6" fill="none" stroke-linecap="round"/>',
        '<path d="M 100 132 Q 72 122 56 98 Q 46 80 52 58" stroke="' + palette.leaf + '" stroke-width="3" fill="none" stroke-linecap="round" opacity="0.78"/>',
        '<path d="M 100 112 Q 128 102 145 84 Q 157 70 152 50" stroke="' + palette.leaf + '" stroke-width="3" fill="none" stroke-linecap="round" opacity="0.78"/>',
        '<path d="M 98 82 Q 78 72 68 52 Q 60 38 66 24" stroke="' + palette.leaf + '" stroke-width="2.2" fill="none" stroke-linecap="round" opacity="0.7"/>',
        leafDots.join(''),
        '<ellipse cx="100" cy="172" rx="34" ry="11" fill="none" stroke="' + palette.accent + '" stroke-width="1" opacity="0.15" stroke-dasharray="4,4"/>',
      '</svg>'
    ].join('');
  }

  function sanitizeUrl(value) {
    var sec = window.LoveBudSecurity;
    if (sec && typeof sec.sanitizeUrl === 'function') return sec.sanitizeUrl(value);
    var utils = getUtils();
    if (utils && typeof utils.sanitizeUrl === 'function') return utils.sanitizeUrl(value);
    if (!value) return '';
    var raw = String(value).trim();
    if (!raw) return '';
    try {
      var parsed = new URL(raw, window.location.origin);
      var protocol = parsed.protocol;
      if (protocol === 'http:' || protocol === 'https:') {
        return parsed.href;
      }
      return '';
    } catch (e) {
      return '';
    }
  }

  function getRepresentativeThumbnail(tree) {
    if (!tree) return '';
    var firstMemory = getFirstMemory(tree);
    var rawThumbnail = firstStringValue(tree, ['representativeThumbnail', 'representative_thumbnail', 'thumbnail', 'thumbnailUrl', 'thumbnail_url']) ||
      firstStringValue(firstMemory, ['thumbnail', 'thumbnailUrl', 'thumbnail_url', 'imageUrl', 'image_url']);
    var rawSourceUrl = firstStringValue(tree, ['representativeSourceUrl', 'representative_source_url', 'representativeMemorySourceUrl', 'representative_memory_source_url', 'sourceUrl', 'source_url']) ||
      firstStringValue(firstMemory, ['sourceUrl', 'sourceURL', 'source_url', 'videoUrl', 'video_url', 'url']);
    return sanitizeUrl(canonicalizeThumbnailUrl(rawThumbnail, rawSourceUrl));
  }

  function getRepresentativeTextMeta(tree, i18n) {
    if (!tree) return null;

    var firstMemory = getFirstMemory(tree);

    var repTitle = clipText(
      tree.representativeTitle || tree.representative_title || firstMemory?.title || '',
      40
    );
    var repMemo = clipText(
      tree.representativeMemo || tree.representative_memo ||
      firstMemory?.memo || firstMemory?.description || '',
      82
    );

    if (!repTitle && !repMemo) return null;

    return {
      title: repTitle || getI18nText(i18n, 'editor_default_first_title', '첫 순간'),
      memo: repMemo || getI18nText(i18n, 'myTrees.card_text_fallback', '처음 남긴 마음이 이 트리의 시작이 되었어요.')
    };
  }

  function buildRepresentativeTextVisual(tree, palette, i18n) {
    var textMeta = getRepresentativeTextMeta(tree, i18n);
    if (!textMeta) return '';

    return [
      '<div class="tree-card-text-visual" style="--tree-card-text-border:' + palette.leafSoft + ';--tree-card-text-accent:' + palette.accent + ';">',
        '<div class="tree-card-text-kicker">' + escapeHtml(getI18nText(i18n, 'card.representative.kicker', '첫 순간 기록')) + '</div>',
        '<div class="tree-card-text-title">' + escapeHtml(textMeta.title) + '</div>',
        '<div class="tree-card-text-memo">' + escapeHtml(textMeta.memo) + '</div>',
      '</div>'
    ].join('');
  }

  function buildPremiumFallbackSVG(tree, palette) {
    var seed = hashSeed((tree && tree.id) || (tree && tree.title) || 'lovetree');
    var trunkId = 'trunkGrad-' + seed;

    var branches = [
      '<path d="M 100 178 Q 98 142 100 112 Q 102 82 95 52" stroke="url(#' + trunkId + ')" stroke-width="5" fill="none" stroke-linecap="round"/>',
      '<path d="M 100 132 Q 72 122 56 98 Q 46 80 52 58" stroke="' + palette.leaf + '" stroke-width="2.5" fill="none" stroke-linecap="round" opacity="0.85"/>',
      '<path d="M 100 112 Q 128 102 145 84 Q 157 70 152 50" stroke="' + palette.leaf + '" stroke-width="2.5" fill="none" stroke-linecap="round" opacity="0.85"/>',
      '<path d="M 98 82 Q 78 72 68 52 Q 60 38 66 24" stroke="' + palette.leaf + '" stroke-width="2" fill="none" stroke-linecap="round" opacity="0.75"/>'
    ].join('');

    var nodePositions = [
      { x: 52, y: 58, type: 'heart', r: 8 },
      { x: 152, y: 50, type: 'pearl', r: 7 },
      { x: 66, y: 24, type: 'pearl', r: 6 },
      { x: 102, y: 52, type: 'heart', r: 8 },
      { x: 138, y: 84, type: 'pearl', r: 6 },
      { x: 80, y: 104, type: 'heart', r: 7 }
    ];

    var nodesHtml = [];
    for (var i = 0; i < nodePositions.length; i++) {
      var pos = nodePositions[i];
      if (pos.type === 'heart') {
        var scale = (pos.r / 10).toFixed(2);
        nodesHtml.push(
          '<g transform="translate(' + pos.x + ', ' + (pos.y - 5) + ') scale(' + scale + ')" opacity="0.95">' +
            '<path d="M0,3 C-3,-3 -10,-3 -10,3 C-10,9 0,16 0,18 C0,16 10,9 10,3 C10,-3 3,-3 0,3 Z" fill="' + palette.accent + '" opacity="0.85"/>' +
            '<path d="M0,3 C-3,-3 -10,-3 -10,3 C-10,9 0,16 0,18 C0,16 10,9 10,3 C10,-3 3,-3 0,3 Z" fill="#ffb4c1" transform="scale(0.85)"/>' +
          '</g>'
        );
      } else {
        nodesHtml.push(
          '<g opacity="0.95">' +
            '<circle cx="' + pos.x + '" cy="' + pos.y + '" r="' + pos.r + '" fill="' + palette.leafSoft + '" stroke="' + palette.leaf + '" stroke-width="1.5"/>' +
            '<circle cx="' + pos.x + '" cy="' + pos.y + '" r="' + (pos.r * 0.7).toFixed(1) + '" fill="rgba(255, 255, 255, 0.9)"/>' +
            '<circle cx="' + (pos.x - pos.r * 0.2).toFixed(1) + '" cy="' + (pos.y - pos.r * 0.2).toFixed(1) + '" r="' + (pos.r * 0.25).toFixed(1) + '" fill="#ffffff"/>' +
          '</g>'
        );
      }
    }

    return [
      '<svg viewBox="0 0 200 200" xmlns="http://www.w3.org/2000/svg" aria-hidden="true" style="width: 100%; height: 100%; max-height: 120px; display: block; margin: 0 auto;">',
        '<defs>',
          '<linearGradient id="' + trunkId + '" x1="0%" y1="0%" x2="100%" y2="0%">',
            '<stop offset="0%" style="stop-color:#904951;stop-opacity:1" />',
            '<stop offset="50%" style="stop-color:#c87480;stop-opacity:1" />',
            '<stop offset="100%" style="stop-color:#904951;stop-opacity:1" />',
          '</linearGradient>',
        '</defs>',
        branches,
        nodesHtml.join(''),
        '<ellipse cx="100" cy="176" rx="34" ry="8" fill="none" stroke="' + palette.accent + '" stroke-width="1" opacity="0.15" stroke-dasharray="4,4"/>',
      '</svg>'
    ].join('');
  }

  function buildTreeThumbVisual(tree, i18n) {
    var palette = getTreeMoodPalette(tree);
    var momentCount = getTreeMomentCount(tree);
    var title = (tree && tree.title) || getI18nText(i18n, 'default_tree_title', '나의 러브트리');
    var initial = escapeHtml(title.charAt(0).toUpperCase());
    var moodLabel = momentCount > 1
      ? getI18nText(i18n, 'myTrees.card_growing', '차곡차곡 자라는 중')
      : getI18nText(i18n, 'myTrees.card_waiting', '첫 순간을 기다리는 중');
    var thumbnail = getRepresentativeThumbnail(tree);
    var textCoverHtml = buildRepresentativeTextVisual(tree, palette, i18n);
    var hasTextCover = Boolean(textCoverHtml);

    var isEnglish = String(window.i18n?.currentLang || '').toLowerCase().startsWith('en');
    var pill1 = isEnglish ? 'First Moment' : '첫 순간';
    var pill2 = isEnglish ? 'Memory Note' : '마음 메모';
    var pill3 = isEnglish ? 'Favorite Scene' : '다시 보고 싶은 장면';

    var fallbackHtml = [
      '<div class="tree-card-media-fallback" style="width: 100%; height: 100%; display: flex; flex-direction: column; align-items: center; justify-content: center; overflow: hidden; padding: 16px; box-sizing: border-box;">',
        '<div class="fallback-svg-container">',
          buildPremiumFallbackSVG(tree, palette),
        '</div>',
        '<div class="fallback-pills">',
          '<span class="fallback-pill" style="color: ' + palette.accent + ';">' + pill1 + '</span>',
          '<span class="fallback-pill" style="color: ' + palette.accent + ';">' + pill2 + '</span>',
          '<span class="fallback-pill" style="color: ' + palette.accent + ';">' + pill3 + '</span>',
        '</div>',
        '<div class="fallback-title" style="display:none !important;"></div>',
      '</div>'
    ].join('');

    var errorFallbackHtml = hasTextCover ? textCoverHtml : fallbackHtml;

    return [
      '<div class="tree-card-thumb" style="background:' + palette.background + ';">',
        '<div class="tree-card-thumb-glow" style="background:' + palette.leafSoft + ';"></div>',
        '<div class="tree-card-thumb-initial" style="color:' + palette.accent + ';border-color:' + palette.leafSoft + ';">' + initial + '</div>',
        '<div class="tree-card-thumb-art">',
          thumbnail
            ? '<img class="tree-card-thumb-image" src="' + escapeHtml(thumbnail) + '" alt="' + escapeHtml(title) + '" loading="lazy">' +
              '<div data-media-fallback hidden style="width:100%;height:100%;display:none;align-items:center;justify-content:center;">' + errorFallbackHtml + '</div>'
            : errorFallbackHtml,
        '</div>',
        (momentCount > 0 ? '<div class="tree-card-thumb-topline"><span class="tree-card-moment-badge" data-count="' + momentCount + '">' + getI18nText(i18n, 'myTrees.moment_count_compact', '순간 {count}개').replace('{count}', String(momentCount)) + '</span></div>' : ''),
        (momentCount > 0 ? '<div class="tree-card-thumb-caption">' + moodLabel + '</div>' : ''),
      '</div>'
    ].join('');
  }

  window.LoveBudMyTreesCardVisuals = {
    getI18nText: getI18nText,
    getVisibilityActionLabel: getVisibilityActionLabel,
    getTreeCardMeta: getTreeCardMeta,
    getTreeMoodPalette: getTreeMoodPalette,
    buildMiniTreeSVG: buildMiniTreeSVG,
    buildPremiumFallbackSVG: buildPremiumFallbackSVG,
    getRepresentativeThumbnail: getRepresentativeThumbnail,
    getRepresentativeTextMeta: getRepresentativeTextMeta,
    buildRepresentativeTextVisual: buildRepresentativeTextVisual,
    buildTreeThumbVisual: buildTreeThumbVisual,
    _canonicalizeThumbnailUrl: canonicalizeThumbnailUrl,
    _sanitizeUrl: sanitizeUrl
  };
})();
