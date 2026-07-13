/**
 * LoveBud — Public Viewer appreciation presentation-slot model
 * Issue #3495 / parent #3475
 *
 * Pure presentation-intent projection only.
 * Consumes an already-canonicalized appreciation render model
 * (window.LoveBudAppreciationRenderModel output shape).
 *
 * Does not re-sanitize raw API payloads, project public-safe fields,
 * or touch DOM / templates / CSS / Auth / network / storage.
 *
 * Fixed canonical slot order (always 7 slots, independent of availability):
 * 1. identity
 * 2. media
 * 3. rememberedDate
 * 4. emotionTags
 * 5. connectedKnowledge
 * 6. emotionMemo
 * 7. socialSummary
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

  var OWNER_EDITOR_CAPABILITY_KEYS = [
    'canEdit',
    'canContinue',
    'canConnect',
    'canDelete',
    'canSwitchMode',
    'isOwner'
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

  function copyKnowledgeItems(value) {
    if (!Array.isArray(value)) return [];
    var out = [];
    var i;
    for (i = 0; i < value.length; i += 1) {
      var raw = value[i];
      if (!isPlainObject(raw)) continue;
      // Display-only allowlist already owned upstream; re-emit only present
      // string display fields without nested private graphs.
      var item = {};
      if (typeof raw.label === 'string') item.label = raw.label;
      if (typeof raw.type === 'string') item.type = raw.type;
      if (typeof raw.sourceLabel === 'string') item.sourceLabel = raw.sourceLabel;
      if (!Object.prototype.hasOwnProperty.call(item, 'label')) continue;
      out.push(item);
    }
    return out;
  }

  /**
   * Authoritative count passthrough for presentation only.
   * Accepts non-negative finite integers (including 0).
   * Unknown / invalid → null (never fabricate 0).
   */
  function passAuthoritativeCount(value) {
    if (typeof value !== 'number') return null;
    if (!isFinite(value)) return null;
    if (value !== Math.floor(value)) return null;
    if (value < 0) return null;
    return value;
  }

  function readCanonicalCapabilities(rawCaps) {
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

    if (!isPlainObject(rawCaps)) {
      return out;
    }

    // Public Viewer presentation: owner/editor always unavailable.
    // Only public reaction/comment/route may pass as literal true.
    out.canReact = isLiteralTrue(rawCaps.canReact);
    out.canComment = isLiteralTrue(rawCaps.canComment);
    out.isPublicRoute = isLiteralTrue(rawCaps.isPublicRoute);

    var i;
    for (i = 0; i < OWNER_EDITOR_CAPABILITY_KEYS.length; i += 1) {
      out[OWNER_EDITOR_CAPABILITY_KEYS[i]] = false;
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

  function emptyPresentation() {
    var capabilities = readCanonicalCapabilities(null);
    return {
      slots: [
        unavailableSlot('identity', {
          value: { id: null, title: '' }
        }),
        unavailableSlot('media', {
          value: { sourceUrl: null, thumbnailUrl: null }
        }),
        unavailableSlot('rememberedDate', {
          value: null
        }),
        unavailableSlot('emotionTags', {
          items: []
        }),
        unavailableSlot('connectedKnowledge', {
          items: [],
          readOnly: true
        }),
        unavailableSlot('emotionMemo', {
          value: null
        }),
        unavailableSlot('socialSummary', {
          value: {
            likeCount: null,
            commentCount: null,
            likeCountAvailable: false,
            commentCountAvailable: false,
            canReact: false,
            canComment: false
          },
          readOnly: true
        })
      ],
      capabilities: capabilities
    };
  }

  function buildIdentitySlot(moment) {
    var id = null;
    if (typeof moment.id === 'string') {
      id = moment.id;
    } else if (moment.id === null || moment.id === undefined) {
      id = null;
    } else if (typeof moment.id === 'number' && isFinite(moment.id)) {
      id = String(moment.id);
    } else {
      id = null;
    }

    var title = typeof moment.title === 'string' ? moment.title : '';
    var available = id !== null || isNonEmptyString(title);

    return {
      key: 'identity',
      available: available,
      value: {
        id: available ? id : null,
        title: available ? title : ''
      }
    };
  }

  function buildMediaSlot(moment) {
    // Canonical model already normalizes empty strings to null; accept string only.
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
      }
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
      value: rememberedAt
    };
  }

  function buildEmotionTagsSlot(moment) {
    var items = copyStringArray(moment.emotionTags);
    return {
      key: 'emotionTags',
      available: items.length > 0,
      items: items
    };
  }

  function buildConnectedKnowledgeSlot(moment, availability) {
    var items = copyKnowledgeItems(moment.knowledgeItems);
    var availableFromFlag =
      isPlainObject(availability) && availability.knowledge === true;
    var available = items.length > 0 || availableFromFlag;
    // Prefer actual items; if flag says true but items empty after filter, unavailable.
    if (items.length === 0) available = false;
    return {
      key: 'connectedKnowledge',
      available: available,
      items: items,
      readOnly: true
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
      value: memo
    };
  }

  function buildSocialSummarySlot(social, availability, capabilities) {
    var likeCount = passAuthoritativeCount(
      isPlainObject(social) ? social.likeCount : null
    );
    var commentCount = passAuthoritativeCount(
      isPlainObject(social) ? social.commentCount : null
    );

    // Prefer explicit availability flags from canonical model when boolean;
    // otherwise derive from non-null authoritative counts.
    var likeCountAvailable = false;
    var commentCountAvailable = false;
    if (isPlainObject(availability)) {
      if (availability.likeCount === true) {
        likeCountAvailable = likeCount !== null;
      } else if (availability.likeCount === false) {
        likeCountAvailable = false;
        likeCount = null;
      } else {
        likeCountAvailable = likeCount !== null;
      }

      if (availability.commentCount === true) {
        commentCountAvailable = commentCount !== null;
      } else if (availability.commentCount === false) {
        commentCountAvailable = false;
        commentCount = null;
      } else {
        commentCountAvailable = commentCount !== null;
      }
    } else {
      likeCountAvailable = likeCount !== null;
      commentCountAvailable = commentCount !== null;
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
      readOnly: true
    };
  }

  /**
   * Build a detached ordered presentation-slot model from a canonical
   * appreciation render model.
   *
   * @param {*} canonicalModel - output of createAppreciationRenderModel
   * @returns {{ slots: Array, capabilities: Object }}
   */
  function createPublicViewerAppreciationPresentationModel(canonicalModel) {
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
    var capabilities = readCanonicalCapabilities(canonicalModel.capabilities);

    var slots = [
      buildIdentitySlot(moment),
      buildMediaSlot(moment),
      buildRememberedDateSlot(moment),
      buildEmotionTagsSlot(moment),
      buildConnectedKnowledgeSlot(moment, availability),
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

  window.LoveBudPublicViewerAppreciationPresentationModel = Object.freeze({
    createPublicViewerAppreciationPresentationModel:
      createPublicViewerAppreciationPresentationModel,
    getPresentationSlotOrder: getPresentationSlotOrder,
    SLOT_KEYS: Object.freeze(SLOT_KEYS.slice())
  });
})();
