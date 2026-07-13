/**
 * LoveBud — Canonical public-safe appreciation render model
 * Issue #3489 / parent #3475
 *
 * Pure selected-moment presentation projection only.
 * No DOM, network, Auth, Editor/Viewer state, or mutation handlers.
 *
 * Route adapters own permission and payload authorization.
 * This helper only allowlists fields from an already-supplied source object.
 */
(function () {
  'use strict';

  var CAPABILITY_KEYS = [
    'canEdit',
    'canContinue',
    'canConnect',
    'canReact',
    'canComment',
    'canDelete',
    'canSwitchMode',
    'isOwner',
    'isPublicRoute'
  ];

  var PUBLIC_KNOWLEDGE_KEYS = [
    'publicKnowledge',
    'public_knowledge',
    'publicKnowledgeItems',
    'public_knowledge_items'
  ];

  function hasOwn(obj, key) {
    return !!obj && Object.prototype.hasOwnProperty.call(obj, key);
  }

  function isPlainObject(value) {
    return !!value && typeof value === 'object' && !Array.isArray(value);
  }

  /**
   * Read first present key (including null) from allowlisted aliases.
   * Does not invent defaults; missing → undefined.
   * Used for non-string fields (ids, counts) where presence matters.
   */
  function pickFirst(source, keys) {
    if (!isPlainObject(source)) return undefined;
    var i;
    for (i = 0; i < keys.length; i += 1) {
      if (hasOwn(source, keys[i])) {
        return source[keys[i]];
      }
    }
    return undefined;
  }

  function normalizeTitle(value) {
    if (typeof value !== 'string') return '';
    return value.replace(/^\s+|\s+$/g, '');
  }

  function normalizeOptionalString(value) {
    if (typeof value !== 'string') return null;
    var trimmed = value.replace(/^\s+|\s+$/g, '');
    return trimmed ? trimmed : null;
  }

  /**
   * First usable trimmed non-empty string across presentation aliases.
   * Skips missing keys, null, empty/whitespace, and non-string values.
   * Does not invent defaults; all unusable → null.
   */
  function pickFirstUsableString(source, keys) {
    if (!isPlainObject(source)) return null;
    var i;
    for (i = 0; i < keys.length; i += 1) {
      if (!hasOwn(source, keys[i])) continue;
      var normalized = normalizeOptionalString(source[keys[i]]);
      if (normalized !== null) return normalized;
    }
    return null;
  }

  /**
   * Authoritative non-negative integer count, or null when unknown/invalid.
   * Preserves genuine 0. Never fabricates 0 from missing values.
   * Does not parse numeric strings (no evidence they are authoritative).
   */
  function normalizeAuthoritativeCount(value) {
    if (typeof value !== 'number') return null;
    if (!isFinite(value)) return null;
    if (value !== Math.floor(value)) return null;
    if (value < 0) return null;
    return value;
  }

  function normalizeEmotionTags(value) {
    if (!Array.isArray(value)) return [];
    var out = [];
    // Null-prototype map so tags like "constructor" / "toString" are not
    // treated as inherited Object.prototype properties.
    var seen = Object.create(null);
    var i;
    for (i = 0; i < value.length; i += 1) {
      var item = value[i];
      if (typeof item !== 'string') continue;
      var tag = item.replace(/^\s+|\s+$/g, '');
      if (!tag) continue;
      if (seen[tag]) continue;
      seen[tag] = true;
      out.push(tag);
    }
    return out;
  }

  function projectKnowledgeItem(raw) {
    if (!isPlainObject(raw)) return null;

    var label = normalizeOptionalString(
      pickFirst(raw, ['label', 'title', 'displayLabel', 'display_label'])
    );
    if (!label) return null;

    var type = normalizeOptionalString(
      pickFirst(raw, ['type', 'category'])
    );
    var sourceLabel = normalizeOptionalString(
      pickFirst(raw, ['sourceLabel', 'source_label', 'contextLabel', 'context_label'])
    );

    // Detached allowlist only — never copy raw item or private identifiers.
    return {
      label: label,
      type: type,
      sourceLabel: sourceLabel
    };
  }

  function normalizeKnowledgeItems(source) {
    var rawList = pickFirst(source, PUBLIC_KNOWLEDGE_KEYS);
    if (!Array.isArray(rawList)) return [];

    var out = [];
    var i;
    for (i = 0; i < rawList.length; i += 1) {
      var projected = projectKnowledgeItem(rawList[i]);
      if (projected) out.push(projected);
    }
    return out;
  }

  /**
   * Fail-closed capability normalization.
   * Only literal boolean true is true. Unknown keys are dropped.
   * Capabilities must come from the second argument only (never from source).
   */
  function normalizeAppreciationCapabilities(capabilities) {
    var out = {};
    var i;
    for (i = 0; i < CAPABILITY_KEYS.length; i += 1) {
      out[CAPABILITY_KEYS[i]] = false;
    }
    if (!isPlainObject(capabilities)) {
      return out;
    }
    for (i = 0; i < CAPABILITY_KEYS.length; i += 1) {
      var key = CAPABILITY_KEYS[i];
      // Literal true only — no Boolean()/!! coercion.
      out[key] = capabilities[key] === true;
    }
    return out;
  }

  function emptyModel(capabilities) {
    return {
      moment: {
        id: null,
        title: '',
        sourceUrl: null,
        thumbnailUrl: null,
        rememberedAt: null,
        emotionTags: [],
        memo: null,
        knowledgeItems: []
      },
      social: {
        likeCount: null,
        commentCount: null
      },
      availability: {
        knowledge: false,
        likeCount: false,
        commentCount: false
      },
      capabilities: normalizeAppreciationCapabilities(capabilities)
    };
  }

  /**
   * Build a detached public-safe selected-moment render model.
   * @param {*} source - plain object (memory-like display payload). Non-objects → empty model.
   * @param {*} capabilities - explicit route-owned capability flags object (optional).
   */
  function createAppreciationRenderModel(source, capabilities) {
    if (!isPlainObject(source)) {
      return emptyModel(capabilities);
    }

    var id = pickFirst(source, ['id', 'memoryId', 'memory_id']);
    var idOut = null;
    if (typeof id === 'string') {
      idOut = normalizeOptionalString(id);
    } else if (typeof id === 'number' && isFinite(id)) {
      // Numeric ids only when finite number (no object coercion).
      idOut = String(id);
    }

    var title = normalizeTitle(
      pickFirst(source, ['title', 'memoryTitle', 'memory_title'])
    );

    var sourceUrl = pickFirstUsableString(source, [
      'sourceUrl',
      'source_url',
      'videoUrl',
      'video_url',
      'url',
      'linkUrl',
      'link_url'
    ]);
    var thumbnailUrl = pickFirstUsableString(source, [
      'thumbnailUrl',
      'thumbnail_url',
      'thumbnail'
    ]);
    var rememberedAt = normalizeOptionalString(
      pickFirst(source, ['rememberedAt', 'remembered_at', 'timestamp'])
    );
    var memo = normalizeOptionalString(
      pickFirst(source, ['memo', 'emotionMemo', 'emotion_memo'])
    );

    var emotionTags = normalizeEmotionTags(
      pickFirst(source, ['emotionTags', 'emotion_tags'])
    );

    var knowledgeItems = normalizeKnowledgeItems(source);

    var likeCount = normalizeAuthoritativeCount(
      pickFirst(source, ['likeCount', 'like_count'])
    );
    var commentCount = normalizeAuthoritativeCount(
      pickFirst(source, ['commentCount', 'comment_count'])
    );

    // Generic owner/raw knowledge fields are intentionally ignored:
    // knowledge, entities, relations, entityLinks, etc.

    return {
      moment: {
        id: idOut,
        title: title,
        sourceUrl: sourceUrl,
        thumbnailUrl: thumbnailUrl,
        rememberedAt: rememberedAt,
        emotionTags: emotionTags,
        memo: memo,
        knowledgeItems: knowledgeItems
      },
      social: {
        likeCount: likeCount,
        commentCount: commentCount
      },
      availability: {
        knowledge: knowledgeItems.length > 0,
        likeCount: likeCount !== null,
        commentCount: commentCount !== null
      },
      capabilities: normalizeAppreciationCapabilities(capabilities)
    };
  }

  window.LoveBudAppreciationRenderModel = Object.freeze({
    createAppreciationRenderModel: createAppreciationRenderModel,
    normalizeAppreciationCapabilities: normalizeAppreciationCapabilities
  });
})();
