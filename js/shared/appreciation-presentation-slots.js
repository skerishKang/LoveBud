/**
 * LoveBud — Route-neutral appreciation presentation slots
 * Issue #3519 / parent #3475
 *
 * Pure presentation-intent projection only.
 * Consumes an already-canonicalized appreciation render model
 * (window.LoveBudAppreciationRenderModel output shape).
 *
 * Shareable:
 * - canonical semantic slot order
 * - slot availability representation
 * - unknown vs zero handling
 * - presentation-only visual grammar
 *
 * Not owned here:
 * - Public Viewer public-safe projection
 * - Editor owner payload authority
 * - Auth / handlers / navigation
 * - route-specific capability hard-close policies
 */
(function () {
  'use strict';

  var SLOT_KEYS = [
    'identity',
    'media',
    'rememberedDate',
    'emotionTags',
    'connectedKnowledge',
    'emotionMemo',
    'socialSummary'
  ];

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

  function isPlainObject(value) {
    return !!value && typeof value === 'object' && !Array.isArray(value);
  }

  function isLiteralTrue(value) {
    return value === true;
  }

  function isNonEmptyString(value) {
    return typeof value === 'string' && value.replace(/^\s+|\s+$/g, '') !== '';
  }

  function copyStringArray(value) {
    if (!Array.isArray(value)) return [];
    var out = [];
    var i;
    for (i = 0; i < value.length; i += 1) {
      if (typeof value[i] === 'string') out.push(value[i]);
    }
    return out;
  }

  function copyCanonicalKnowledgeItems(value) {
    if (!Array.isArray(value)) return [];
    var out = [];
    var i;
    for (i = 0; i < value.length; i += 1) {
      var raw = value[i];
      if (!isPlainObject(raw)) continue;
      if (typeof raw.label !== 'string') continue;
      var item = { label: raw.label };
      if (typeof raw.type === 'string') item.type = raw.type;
      if (typeof raw.sourceLabel === 'string') {
        item.sourceLabel = raw.sourceLabel;
      }
      out.push(item);
    }
    return out;
  }

  function acceptCanonicalCount(value) {
    if (typeof value !== 'number') return null;
    if (!isFinite(value)) return null;
    if (value !== Math.floor(value)) return null;
    if (value < 0) return null;
    return value;
  }

  /**
   * Pass through capability flags literally.
   * Only boolean true is true. Unknown keys are dropped.
   * Route adapters decide which flags may be true.
   */
  function readCapabilities(rawCaps) {
    var out = {};
    var i;
    for (i = 0; i < CAPABILITY_KEYS.length; i += 1) {
      out[CAPABILITY_KEYS[i]] = false;
    }
    if (!isPlainObject(rawCaps)) {
      return out;
    }
    for (i = 0; i < CAPABILITY_KEYS.length; i += 1) {
      var key = CAPABILITY_KEYS[i];
      out[key] = isLiteralTrue(rawCaps[key]);
    }
    return out;
  }

  function unavailableSlot(key, extra) {
    var slot = {
      key: key,
      available: false
    };
    if (extra) {
      var k;
      for (k in extra) {
        if (Object.prototype.hasOwnProperty.call(extra, k)) {
          slot[k] = extra[k];
        }
      }
    }
    return slot;
  }

  function emptySocialValue() {
    return {
      likeCount: null,
      commentCount: null,
      likeCountAvailable: false,
      commentCountAvailable: false,
      canReact: false,
      canComment: false
    };
  }

  function emptyPresentation() {
    var capabilities = readCapabilities(null);
    return {
      slots: [
        unavailableSlot('identity', {
          value: { id: null, title: '' },
          contentReadOnly: true
        }),
        unavailableSlot('media', {
          value: { sourceUrl: null, thumbnailUrl: null },
          contentReadOnly: true
        }),
        unavailableSlot('rememberedDate', {
          value: null,
          contentReadOnly: true
        }),
        unavailableSlot('emotionTags', {
          items: [],
          contentReadOnly: true
        }),
        unavailableSlot('connectedKnowledge', {
          items: [],
          contentReadOnly: true
        }),
        unavailableSlot('emotionMemo', {
          value: null,
          contentReadOnly: true
        }),
        unavailableSlot('socialSummary', {
          value: emptySocialValue(),
          contentReadOnly: true
        })
      ],
      capabilities: capabilities
    };
  }

  function buildIdentitySlot(moment) {
    var id = null;
    if (typeof moment.id === 'string' && moment.id) {
      id = moment.id;
    }

    var title = typeof moment.title === 'string' ? moment.title : '';
    var available = id !== null || isNonEmptyString(title);

    return {
      key: 'identity',
      available: available,
      value: {
        id: available ? id : null,
        title: available ? title : ''
      },
      contentReadOnly: true
    };
  }

  function buildMediaSlot(moment) {
    var sourceUrl = null;
    if (typeof moment.sourceUrl === 'string' && moment.sourceUrl) {
      sourceUrl = moment.sourceUrl;
    }

    var thumbnailUrl = null;
    if (typeof moment.thumbnailUrl === 'string' && moment.thumbnailUrl) {
      thumbnailUrl = moment.thumbnailUrl;
    }

    var available = sourceUrl !== null || thumbnailUrl !== null;
    return {
      key: 'media',
      available: available,
      value: {
        sourceUrl: sourceUrl,
        thumbnailUrl: thumbnailUrl
      },
      contentReadOnly: true
    };
  }

  function buildRememberedDateSlot(moment) {
    var rememberedAt = null;
    if (typeof moment.rememberedAt === 'string' && moment.rememberedAt) {
      rememberedAt = moment.rememberedAt;
    }
    return {
      key: 'rememberedDate',
      available: rememberedAt !== null,
      value: rememberedAt,
      contentReadOnly: true
    };
  }

  function buildEmotionTagsSlot(moment) {
    var items = copyStringArray(moment.emotionTags);
    return {
      key: 'emotionTags',
      available: items.length > 0,
      items: items,
      contentReadOnly: true
    };
  }

  function buildConnectedKnowledgeSlot(moment) {
    var items = copyCanonicalKnowledgeItems(moment.knowledgeItems);
    return {
      key: 'connectedKnowledge',
      available: items.length > 0,
      items: items,
      contentReadOnly: true
    };
  }

  function buildEmotionMemoSlot(moment) {
    var memo = null;
    if (typeof moment.memo === 'string' && moment.memo) {
      memo = moment.memo;
    }
    return {
      key: 'emotionMemo',
      available: memo !== null,
      value: memo,
      contentReadOnly: true
    };
  }

  function buildSocialSummarySlot(social, availability, capabilities) {
    var likeCount = null;
    var commentCount = null;
    var likeCountAvailable = false;
    var commentCountAvailable = false;

    if (isPlainObject(availability) && availability.likeCount === true) {
      likeCount = acceptCanonicalCount(
        isPlainObject(social) ? social.likeCount : null
      );
      likeCountAvailable = likeCount !== null;
      if (!likeCountAvailable) likeCount = null;
    }

    if (isPlainObject(availability) && availability.commentCount === true) {
      commentCount = acceptCanonicalCount(
        isPlainObject(social) ? social.commentCount : null
      );
      commentCountAvailable = commentCount !== null;
      if (!commentCountAvailable) commentCount = null;
    }

    var canReact = capabilities.canReact === true;
    var canComment = capabilities.canComment === true;

    var available =
      likeCountAvailable ||
      commentCountAvailable ||
      canReact ||
      canComment;

    return {
      key: 'socialSummary',
      available: available,
      value: {
        likeCount: likeCountAvailable ? likeCount : null,
        commentCount: commentCountAvailable ? commentCount : null,
        likeCountAvailable: likeCountAvailable,
        commentCountAvailable: commentCountAvailable,
        canReact: canReact,
        canComment: canComment
      },
      contentReadOnly: true
    };
  }

  /**
   * Build a detached ordered presentation-slot model from a canonical
   * appreciation render model.
   *
   * @param {*} canonicalModel - output of createAppreciationRenderModel
   * @returns {{ slots: Array, capabilities: Object }}
   */
  function createAppreciationPresentationSlots(canonicalModel) {
    if (!isPlainObject(canonicalModel)) {
      return emptyPresentation();
    }

    var moment = isPlainObject(canonicalModel.moment)
      ? canonicalModel.moment
      : {};
    var social = isPlainObject(canonicalModel.social)
      ? canonicalModel.social
      : {};
    var availability = isPlainObject(canonicalModel.availability)
      ? canonicalModel.availability
      : {};
    var capabilities = readCapabilities(canonicalModel.capabilities);

    var slots = [
      buildIdentitySlot(moment),
      buildMediaSlot(moment),
      buildRememberedDateSlot(moment),
      buildEmotionTagsSlot(moment),
      buildConnectedKnowledgeSlot(moment),
      buildEmotionMemoSlot(moment),
      buildSocialSummarySlot(social, availability, capabilities)
    ];

    return {
      slots: slots,
      capabilities: capabilities
    };
  }

  function getPresentationSlotOrder() {
    return SLOT_KEYS.slice();
  }

  window.LoveBudAppreciationPresentationSlots = Object.freeze({
    createAppreciationPresentationSlots: createAppreciationPresentationSlots,
    getPresentationSlotOrder: getPresentationSlotOrder,
    SLOT_KEYS: Object.freeze(SLOT_KEYS.slice()),
    CAPABILITY_KEYS: Object.freeze(CAPABILITY_KEYS.slice())
  });
})();
