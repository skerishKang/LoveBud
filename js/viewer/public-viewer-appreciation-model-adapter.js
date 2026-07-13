/**
 * LoveBud — Public Viewer appreciation model adapter
 * Issue #3491 / parent #3475
 *
 * Pure Public Viewer route-owned adapter only.
 * Projects explicit public-safe selected-memory fields, then delegates to
 * window.LoveBudAppreciationRenderModel. No DOM, network, Auth, Editor,
 * mutation handlers, or page wiring.
 */
(function () {
  'use strict';

  var ERROR_PREFIX = '[public-viewer-appreciation-model-adapter]';

  var SCALAR_KEYS = [
    'id',
    'memoryId',
    'memory_id',
    'title',
    'memoryTitle',
    'memory_title',
    'sourceUrl',
    'source_url',
    'videoUrl',
    'video_url',
    'url',
    'linkUrl',
    'link_url',
    'thumbnailUrl',
    'thumbnail_url',
    'thumbnail',
    'rememberedAt',
    'remembered_at',
    'timestamp',
    'memo',
    'emotionMemo',
    'emotion_memo',
    'likeCount',
    'like_count',
    'commentCount',
    'comment_count'
  ];

  var TAG_KEYS = [
    'emotionTags',
    'emotion_tags'
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

  function isLiteralTrue(value) {
    return value === true;
  }

  /**
   * Public Viewer capability policy:
   * - canReact / canComment / isPublicRoute: literal true only
   * - owner/editor capabilities: always false
   * - unknown keys: dropped
   */
  function normalizePublicViewerAppreciationCapabilities(capabilities) {
    var canReact = false;
    var canComment = false;
    var isPublicRoute = false;

    if (isPlainObject(capabilities)) {
      canReact = isLiteralTrue(capabilities.canReact);
      canComment = isLiteralTrue(capabilities.canComment);
      isPublicRoute = isLiteralTrue(capabilities.isPublicRoute);
    }

    return {
      canEdit: false,
      canContinue: false,
      canConnect: false,
      canReact: canReact,
      canComment: canComment,
      canDelete: false,
      canSwitchMode: false,
      isOwner: false,
      isPublicRoute: isPublicRoute
    };
  }

  function projectKnowledgeItem(raw) {
    if (!isPlainObject(raw)) {
      return raw;
    }

    // Detached own-property copy; never keep the raw item reference.
    // Functions and nested raw wrappers are not projected as handlers.
    var out = {};
    var keys = Object.keys(raw);
    var i;
    for (i = 0; i < keys.length; i += 1) {
      var key = keys[i];
      var value = raw[key];
      if (typeof value === 'function') continue;
      out[key] = value;
    }
    return out;
  }

  function projectKnowledgeList(value) {
    if (!Array.isArray(value)) {
      return value;
    }
    var out = [];
    var i;
    for (i = 0; i < value.length; i += 1) {
      out.push(projectKnowledgeItem(value[i]));
    }
    return out;
  }

  /**
   * Allowlisted public-safe projection only.
   * Does not preserve the raw source object reference.
   * Does not walk private/circular non-allowlisted graphs.
   */
  function projectPublicSafeSource(source) {
    if (!isPlainObject(source)) {
      return {};
    }

    var out = {};
    var i;
    var key;
    var value;

    for (i = 0; i < SCALAR_KEYS.length; i += 1) {
      key = SCALAR_KEYS[i];
      if (!hasOwn(source, key)) continue;
      value = source[key];
      if (typeof value === 'function') continue;
      out[key] = value;
    }

    for (i = 0; i < TAG_KEYS.length; i += 1) {
      key = TAG_KEYS[i];
      if (!hasOwn(source, key)) continue;
      value = source[key];
      if (typeof value === 'function') continue;
      if (Array.isArray(value)) {
        out[key] = value.slice();
      } else {
        out[key] = value;
      }
    }

    for (i = 0; i < PUBLIC_KNOWLEDGE_KEYS.length; i += 1) {
      key = PUBLIC_KNOWLEDGE_KEYS[i];
      if (!hasOwn(source, key)) continue;
      value = source[key];
      if (typeof value === 'function') continue;
      if (Array.isArray(value)) {
        out[key] = projectKnowledgeList(value);
      } else {
        out[key] = value;
      }
    }

    return out;
  }

  function requireCanonicalHelper() {
    var helper = window.LoveBudAppreciationRenderModel;
    if (!helper || typeof helper.createAppreciationRenderModel !== 'function') {
      throw new Error(
        ERROR_PREFIX +
          ' LoveBudAppreciationRenderModel.createAppreciationRenderModel is required'
      );
    }
    return helper;
  }

  /**
   * Build a public-route appreciation model from a selected-memory payload.
   * @param {*} source - Viewer selected-memory-like object
   * @param {*} capabilities - explicit Public Viewer route capabilities only
   */
  function createPublicViewerAppreciationModel(source, capabilities) {
    var helper = requireCanonicalHelper();
    var projected = projectPublicSafeSource(source);
    var normalizedCapabilities =
      normalizePublicViewerAppreciationCapabilities(capabilities);
    return helper.createAppreciationRenderModel(
      projected,
      normalizedCapabilities
    );
  }

  window.LoveBudPublicViewerAppreciationModelAdapter = Object.freeze({
    createPublicViewerAppreciationModel: createPublicViewerAppreciationModel,
    normalizePublicViewerAppreciationCapabilities:
      normalizePublicViewerAppreciationCapabilities
  });
})();
