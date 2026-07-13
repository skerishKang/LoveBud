/**
 * LoveBud — Public Viewer appreciation model adapter
 * Issue #3491 / parent #3475
 *
 * Pure Public Viewer route-owned adapter only.
 * Projects explicit public-safe selected-memory fields, then delegates to
 * window.LoveBudAppreciationRenderModel. No DOM, network, Auth, Editor,
 * mutation handlers, or page wiring.
 *
 * Input boundary policy: only type-safe allowlisted primitives/fields are
 * forwarded to the canonical helper. Private keys, nested objects, raw
 * references, and invalid container types never cross this boundary.
 */
(function () {
  'use strict';

  var ERROR_PREFIX = '[public-viewer-appreciation-model-adapter]';

  var ID_KEYS = [
    'id',
    'memoryId',
    'memory_id'
  ];

  var TEXT_KEYS = [
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
    'emotion_memo'
  ];

  var COUNT_KEYS = [
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

  var KNOWLEDGE_LABEL_KEYS = [
    'label',
    'title',
    'displayLabel',
    'display_label'
  ];

  var KNOWLEDGE_TYPE_KEYS = [
    'type',
    'category'
  ];

  var KNOWLEDGE_SOURCE_LABEL_KEYS = [
    'sourceLabel',
    'source_label',
    'contextLabel',
    'context_label'
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

  function isAllowedIdValue(value) {
    if (typeof value === 'string') return true;
    if (typeof value === 'number') {
      return isFinite(value);
    }
    return false;
  }

  function isAllowedCountValue(value) {
    if (typeof value !== 'number') return false;
    if (!isFinite(value)) return false;
    if (value !== Math.floor(value)) return false;
    if (value < 0) return false;
    return true;
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

  function copyStringOwnFields(raw, keys, out) {
    var i;
    for (i = 0; i < keys.length; i += 1) {
      var key = keys[i];
      if (!hasOwn(raw, key)) continue;
      var value = raw[key];
      if (typeof value !== 'string') continue;
      out[key] = value;
    }
  }

  /**
   * Public knowledge item projection: display-field allowlist only.
   * Returns null when no display-label field is present.
   */
  function projectKnowledgeItem(raw) {
    if (!isPlainObject(raw)) {
      return null;
    }

    var out = {};
    copyStringOwnFields(raw, KNOWLEDGE_LABEL_KEYS, out);
    copyStringOwnFields(raw, KNOWLEDGE_TYPE_KEYS, out);
    copyStringOwnFields(raw, KNOWLEDGE_SOURCE_LABEL_KEYS, out);

    var hasLabel = false;
    var i;
    for (i = 0; i < KNOWLEDGE_LABEL_KEYS.length; i += 1) {
      if (hasOwn(out, KNOWLEDGE_LABEL_KEYS[i])) {
        hasLabel = true;
        break;
      }
    }
    if (!hasLabel) {
      return null;
    }
    return out;
  }

  function projectKnowledgeList(value) {
    if (!Array.isArray(value)) {
      return null;
    }
    var out = [];
    var i;
    for (i = 0; i < value.length; i += 1) {
      var projected = projectKnowledgeItem(value[i]);
      if (projected) out.push(projected);
    }
    return out;
  }

  function projectTagList(value) {
    if (!Array.isArray(value)) {
      return null;
    }
    var out = [];
    var i;
    for (i = 0; i < value.length; i += 1) {
      var item = value[i];
      if (typeof item !== 'string') continue;
      out.push(item);
    }
    return out;
  }

  /**
   * Allowlisted public-safe projection only.
   * Does not preserve the raw source object reference.
   * Does not walk private/circular non-allowlisted graphs.
   * Only type-safe primitives and string tag/knowledge display fields pass.
   */
  function projectPublicSafeSource(source) {
    if (!isPlainObject(source)) {
      return {};
    }

    var out = {};
    var i;
    var key;
    var value;

    for (i = 0; i < ID_KEYS.length; i += 1) {
      key = ID_KEYS[i];
      if (!hasOwn(source, key)) continue;
      value = source[key];
      if (!isAllowedIdValue(value)) continue;
      out[key] = value;
    }

    for (i = 0; i < TEXT_KEYS.length; i += 1) {
      key = TEXT_KEYS[i];
      if (!hasOwn(source, key)) continue;
      value = source[key];
      if (typeof value !== 'string') continue;
      out[key] = value;
    }

    for (i = 0; i < COUNT_KEYS.length; i += 1) {
      key = COUNT_KEYS[i];
      if (!hasOwn(source, key)) continue;
      value = source[key];
      if (!isAllowedCountValue(value)) continue;
      out[key] = value;
    }

    for (i = 0; i < TAG_KEYS.length; i += 1) {
      key = TAG_KEYS[i];
      if (!hasOwn(source, key)) continue;
      value = projectTagList(source[key]);
      if (value === null) continue;
      out[key] = value;
    }

    for (i = 0; i < PUBLIC_KNOWLEDGE_KEYS.length; i += 1) {
      key = PUBLIC_KNOWLEDGE_KEYS[i];
      if (!hasOwn(source, key)) continue;
      value = projectKnowledgeList(source[key]);
      if (value === null) continue;
      out[key] = value;
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
