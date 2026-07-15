/**
 * LoveBud — Editor appreciation model adapter
 * Issue #3519 / parent #3475
 *
 * Pure Editor route-owned adapter only.
 * Projects owner selected-memory display fields, then delegates to
 * window.LoveBudAppreciationRenderModel. No DOM, network, Auth handlers,
 * Public Viewer adapter usage, or mutation authority.
 *
 * Owner-visible knowledge aliases are mapped into the canonical publicKnowledge
 * display keys so owner display is not accidentally stripped by the shared
 * render-model knowledge gate. Private raw graphs are never forwarded.
 */
(function () {
  'use strict';

  var ERROR_PREFIX = '[editor-appreciation-model-adapter]';

  var ID_KEYS = ['id', 'memoryId', 'memory_id'];

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

  var TAG_KEYS = ['emotionTags', 'emotion_tags'];

  var PUBLIC_KNOWLEDGE_KEYS = [
    'publicKnowledge',
    'public_knowledge',
    'publicKnowledgeItems',
    'public_knowledge_items'
  ];

  var OWNER_KNOWLEDGE_KEYS = [
    'knowledgeItems',
    'knowledge_items',
    'connectedKnowledge',
    'connected_knowledge',
    'knowledge'
  ];

  var KNOWLEDGE_LABEL_KEYS = [
    'label',
    'title',
    'displayLabel',
    'display_label',
    'name'
  ];

  var KNOWLEDGE_TYPE_KEYS = ['type', 'category'];

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
   * Editor capability policy for appreciation display model only.
   * Handlers remain Editor-controller owned; this adapter never binds them.
   */
  function normalizeEditorAppreciationCapabilities(capabilities) {
    var out = {
      canEdit: false,
      canContinue: false,
      canConnect: false,
      canReact: false,
      canComment: false,
      canDelete: false,
      canSwitchMode: false,
      isOwner: false,
      isPublicRoute: false
    };

    if (!isPlainObject(capabilities)) {
      return out;
    }

    out.canEdit = isLiteralTrue(capabilities.canEdit);
    out.canContinue = isLiteralTrue(capabilities.canContinue);
    out.canConnect = isLiteralTrue(capabilities.canConnect);
    out.canReact = isLiteralTrue(capabilities.canReact);
    out.canComment = isLiteralTrue(capabilities.canComment);
    out.canDelete = isLiteralTrue(capabilities.canDelete);
    out.canSwitchMode = isLiteralTrue(capabilities.canSwitchMode);
    out.isOwner = isLiteralTrue(capabilities.isOwner);
    // Editor route is never a public route presentation surface.
    out.isPublicRoute = false;
    return out;
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

  function pickFirstKnowledgeList(source) {
    var i;
    var key;
    var projected;

    for (i = 0; i < PUBLIC_KNOWLEDGE_KEYS.length; i += 1) {
      key = PUBLIC_KNOWLEDGE_KEYS[i];
      if (!hasOwn(source, key)) continue;
      projected = projectKnowledgeList(source[key]);
      if (projected && projected.length) return projected;
    }

    for (i = 0; i < OWNER_KNOWLEDGE_KEYS.length; i += 1) {
      key = OWNER_KNOWLEDGE_KEYS[i];
      if (!hasOwn(source, key)) continue;
      projected = projectKnowledgeList(source[key]);
      if (projected && projected.length) return projected;
    }

    return null;
  }

  /**
   * Detached owner display projection.
   * Only type-safe display fields cross this boundary.
   */
  function projectEditorDisplaySource(source) {
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

    var knowledge = pickFirstKnowledgeList(source);
    if (knowledge) {
      // Canonical shared model only accepts publicKnowledge* keys.
      out.publicKnowledge = knowledge;
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
   * Build an Editor appreciation model from an owner selected-memory payload.
   * @param {*} source - Editor selected-memory-like object
   * @param {*} capabilities - explicit Editor route capabilities only
   */
  function createEditorAppreciationModel(source, capabilities) {
    var helper = requireCanonicalHelper();
    var projected = projectEditorDisplaySource(source);
    var normalizedCapabilities =
      normalizeEditorAppreciationCapabilities(capabilities);
    return helper.createAppreciationRenderModel(
      projected,
      normalizedCapabilities
    );
  }

  window.LoveBudEditorAppreciationModelAdapter = Object.freeze({
    createEditorAppreciationModel: createEditorAppreciationModel,
    normalizeEditorAppreciationCapabilities:
      normalizeEditorAppreciationCapabilities
  });
})();
