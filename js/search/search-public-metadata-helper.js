/**
 * LoveBud Search Public Metadata Helper
 * v20260616-2536-1
 *
 * Safe client-side metadata extraction and rendering for Browse cards and hub.
 */

(function () {
  'use strict';

  function escapeHtml(value) {
    var sec = window.LoveBudSecurity;
    if (sec && typeof sec.escapeHtml === 'function') return sec.escapeHtml(value);
    return String(value == null ? '' : value)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  function sanitizePublicLabel(val) {
    if (val == null) return '';
    return String(val).replace(/\s+/g, ' ').trim();
  }

  function isRawInternalIdentity(value) {
    var raw = String(value || '').trim();
    if (!raw) return true;
    if (raw.indexOf('@') !== -1) return true;
    if (/^[a-zA-Z0-9_-]{20,}$/.test(raw)) return true;
    if (/^(uid|user|owner)[_:]/i.test(raw)) return true;
    return false;
  }

  function getPublicUploaderName(tree) {
    if (!tree) return '';
    var candidates = [
      tree.ownerDisplayName,
      tree.authorName,
      tree.uploaderName,
      tree.displayName,
      tree.owner_name
    ];
    for (var i = 0; i < candidates.length; i++) {
      var val = sanitizePublicLabel(candidates[i]);
      if (val && !isRawInternalIdentity(val)) {
        return val;
      }
    }
    return '';
  }

  function getPublicTreeDescription(tree) {
    if (!tree) return '';
    var candidates = [
      tree.description,
      tree.memo,
      tree.summary,
      tree.shortDescription,
      tree.short_description
    ];
    for (var i = 0; i < candidates.length; i++) {
      var val = sanitizePublicLabel(candidates[i]);
      if (val) return val;
    }
    return '';
  }

  function getPublicTopicLabel(tree) {
    if (!tree) return '';
    var candidates = [
      tree.artist,
      tree.topic,
      tree.subjectName,
      tree.theme
    ];
    for (var i = 0; i < candidates.length; i++) {
      var val = sanitizePublicLabel(candidates[i]);
      if (val === 'LoveTree' || val === 'Mixed') continue;
      if (val) return val;
    }
    return '';
  }

  function getPublicTags(tree) {
    if (!tree) return [];
    var rawTags = [];
    if (Array.isArray(tree.emotionTags)) {
      rawTags = rawTags.concat(tree.emotionTags);
    }
    if (Array.isArray(tree.tags)) {
      rawTags = rawTags.concat(tree.tags);
    }

    var seen = {};
    var cleanTags = [];
    for (var i = 0; i < rawTags.length; i++) {
      var t = sanitizePublicLabel(rawTags[i]);
      if (!t) continue;

      if (t.charAt(0) === '#') {
        t = t.slice(1).trim();
      }
      if (!t) continue;

      if (isRawInternalIdentity(t)) continue;
      if (t.indexOf('__') === 0) continue;

      var lower = t.toLowerCase();
      if (!seen[lower]) {
        seen[lower] = true;
        cleanTags.push(t);
      }
    }
    return cleanTags;
  }

  function getPublicMetadata(tree) {
    if (!tree) return null;
    return {
      uploaderName: getPublicUploaderName(tree),
      description: getPublicTreeDescription(tree),
      topic: getPublicTopicLabel(tree),
      tags: getPublicTags(tree)
    };
  }

  function renderCardMetadata(tree) {
    var meta = getPublicMetadata(tree);
    var uploaderName = (meta && meta.uploaderName) ? meta.uploaderName : '';
    var description = (meta && meta.description) ? meta.description : '';
    var topic = (meta && meta.topic) ? meta.topic : '';
    var tags = (meta && meta.tags) ? meta.tags : [];

    var topicHtml = topic ? '<span class="tree-public-metadata-topic">' + escapeHtml(topic) + '</span>' : '';
    var descHtml = description ? '<span class="tree-public-metadata-desc">' + escapeHtml(description) + '</span>' : '';
    var uploaderHtml = uploaderName ? '<span class="tree-public-metadata-uploader">by ' + escapeHtml(uploaderName) + '</span>' : '';

    var metadataBlock = '';
    if (topicHtml || descHtml || uploaderHtml) {
      metadataBlock = '<div class="tree-public-metadata" data-public-tree-metadata>' +
        topicHtml +
        descHtml +
        uploaderHtml +
      '</div>';
    }

    var tagSpans = tags.map(function (tag) {
      return '<span class="tree-public-tag">#' + escapeHtml(tag) + '</span>';
    }).join('');

    if (tags.length > 2) {
      var overflowCount = tags.length - 2;
      tagSpans += '<span class="tree-public-tag-overflow">+' + overflowCount + '</span>';
    }

    var tagsBlock = '<div class="tree-public-tags">' + tagSpans + '</div>';

    return '<div class="tree-card-metadata-slot">' +
      metadataBlock +
      tagsBlock +
    '</div>';
  }

  function renderHubMetadata(tree) {
    var meta = getPublicMetadata(tree);
    if (!meta) return '';

    var rows = [];
    if (meta.uploaderName) {
      rows.push('<div class="hub-public-metadata-row"><span class="hub-public-metadata-label">공유한 사람:</span> <span class="hub-public-metadata-val">' + escapeHtml(meta.uploaderName) + '</span></div>');
    }
    if (meta.topic) {
      rows.push('<div class="hub-public-metadata-row"><span class="hub-public-metadata-label">주제:</span> <span class="hub-public-metadata-val">' + escapeHtml(meta.topic) + '</span></div>');
    }
    if (meta.description) {
      rows.push('<div class="hub-public-metadata-row"><span class="hub-public-metadata-label">소개:</span> <span class="hub-public-metadata-val">' + escapeHtml(meta.description) + '</span></div>');
    }
    if (meta.tags && meta.tags.length > 0) {
      var tagsStr = meta.tags.map(function (t) { return '#' + t; }).join(' ');
      rows.push('<div class="hub-public-metadata-row"><span class="hub-public-metadata-label">태그:</span> <span class="hub-public-metadata-val">' + escapeHtml(tagsStr) + '</span></div>');
    }

    if (rows.length === 0) return '';
    return '<div class="hub-public-metadata-block">' + rows.join('') + '</div>';
  }

  var api = {
    sanitizePublicLabel: sanitizePublicLabel,
    getPublicUploaderName: getPublicUploaderName,
    getPublicTreeDescription: getPublicTreeDescription,
    getPublicTopicLabel: getPublicTopicLabel,
    getPublicTags: getPublicTags,
    getPublicMetadata: getPublicMetadata,
    renderCardMetadata: renderCardMetadata,
    renderHubMetadata: renderHubMetadata
  };

  window.LoveBudSearchPublicMetadataHelper = api;
})();
