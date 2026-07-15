/**
 * LoveBud — Route-neutral appreciation slot DOM helpers
 * Issue #3519 / parent #3475
 *
 * Safe presentation-only DOM rendering for appreciation slots.
 * Uses textContent / createElement only for user content.
 *
 * Does NOT:
 * - decide route authority or capabilities
 * - own Auth / handlers / navigation
 * - project raw API payloads
 */
(function () {
  'use strict';

  var ALLOWED_SLOT_KEYS = {
    identity: true,
    media: true,
    rememberedDate: true,
    emotionTags: true,
    connectedKnowledge: true,
    emotionMemo: true,
    socialSummary: true
  };

  function isPlainObject(value) {
    return !!value && typeof value === 'object' && !Array.isArray(value);
  }

  function getDocument(doc) {
    if (doc) return doc;
    return typeof document !== 'undefined' ? document : null;
  }

  function getElement(doc, id) {
    if (!doc || !id) return null;
    return typeof doc.getElementById === 'function' ? doc.getElementById(id) : null;
  }

  function clearChildren(el) {
    if (!el) return;
    while (el.firstChild) {
      el.removeChild(el.firstChild);
    }
  }

  function setGroupHidden(groupEl, hidden) {
    if (!groupEl) return;
    groupEl.hidden = !!hidden;
  }

  function defaultIds() {
    return {
      title: 'detailCurrentMomentTitle',
      date: 'detailDateText',
      dateGroup: 'detailDateGroup',
      tags: 'detailTags',
      tagsGroup: 'detailTagsGroup',
      knowledgeList: 'detailPublicKnowledgeList',
      knowledgeGroup: 'detailPublicKnowledgeGroup',
      knowledgeItemClass: 'public-viewer-knowledge-item',
      memo: 'detailMemo',
      memoGroup: 'detailMemoGroup'
    };
  }

  function mergeIds(options) {
    var ids = defaultIds();
    var provided = options && options.ids;
    if (!isPlainObject(provided)) return ids;
    var key;
    for (key in provided) {
      if (Object.prototype.hasOwnProperty.call(provided, key) && provided[key] != null) {
        ids[key] = provided[key];
      }
    }
    return ids;
  }

  function renderIdentitySlot(doc, ids, slot) {
    var titleEl = getElement(doc, ids.title);
    if (!titleEl) return;
    clearChildren(titleEl);
    if (slot && slot.available && slot.value && typeof slot.value.title === 'string') {
      var span = doc.createElement('span');
      span.textContent = slot.value.title;
      titleEl.appendChild(span);
    }
  }

  function renderRememberedDateSlot(doc, ids, slot) {
    var dateEl = getElement(doc, ids.date);
    var groupEl = getElement(doc, ids.dateGroup);
    if (!dateEl) return;
    if (slot && slot.available && typeof slot.value === 'string') {
      dateEl.textContent = slot.value;
      setGroupHidden(groupEl, false);
    } else {
      dateEl.textContent = '';
      setGroupHidden(groupEl, true);
    }
  }

  function renderEmotionTagsSlot(doc, ids, slot) {
    var container = getElement(doc, ids.tags);
    var groupEl = getElement(doc, ids.tagsGroup);
    if (!container) return;
    clearChildren(container);
    if (slot && slot.available && Array.isArray(slot.items) && slot.items.length > 0) {
      var validCount = 0;
      var i;
      for (i = 0; i < slot.items.length; i += 1) {
        var item = slot.items[i];
        if (typeof item !== 'string') continue;
        var chip = doc.createElement('span');
        chip.className = 'tag tag-primary';
        chip.textContent = item;
        container.appendChild(chip);
        validCount += 1;
      }
      setGroupHidden(groupEl, validCount === 0);
    } else {
      setGroupHidden(groupEl, true);
    }
  }

  function renderEmotionMemoSlot(doc, ids, slot) {
    var memoEl = getElement(doc, ids.memo);
    var groupEl = getElement(doc, ids.memoGroup);
    if (!memoEl) return;
    clearChildren(memoEl);
    if (slot && slot.available && typeof slot.value === 'string') {
      var wrapper = doc.createElement('div');
      wrapper.style.width = '100%';
      var body = doc.createElement('div');
      body.style.lineHeight = '1.8';
      body.style.fontSize = '0.95rem';
      body.style.color = 'var(--on-surface)';
      body.style.whiteSpace = 'pre-line';
      body.textContent = slot.value;
      wrapper.appendChild(body);
      memoEl.appendChild(wrapper);
      setGroupHidden(groupEl, false);
    } else {
      setGroupHidden(groupEl, true);
    }
  }

  function renderConnectedKnowledgeSlot(doc, ids, slot) {
    var listEl = getElement(doc, ids.knowledgeList);
    var groupEl = getElement(doc, ids.knowledgeGroup);
    if (!listEl) return;
    clearChildren(listEl);
    if (slot && slot.available && Array.isArray(slot.items) && slot.items.length > 0) {
      var validCount = 0;
      var i;
      for (i = 0; i < slot.items.length; i += 1) {
        var item = slot.items[i];
        if (!isPlainObject(item)) continue;
        if (typeof item.label !== 'string' || !item.label) continue;
        var li = doc.createElement('li');
        li.className = ids.knowledgeItemClass || 'public-viewer-knowledge-item';
        var text = item.label;
        if (typeof item.type === 'string' && item.type) {
          text += ' · ' + item.type;
        }
        if (typeof item.sourceLabel === 'string' && item.sourceLabel) {
          text += ' (' + item.sourceLabel + ')';
        }
        li.textContent = text;
        listEl.appendChild(li);
        validCount += 1;
      }
      setGroupHidden(groupEl, validCount === 0);
    } else {
      setGroupHidden(groupEl, true);
    }
  }

  function renderPresentation(doc, ids, slotMap) {
    if (!isPlainObject(slotMap)) return;
    renderIdentitySlot(doc, ids, slotMap.identity);
    renderRememberedDateSlot(doc, ids, slotMap.rememberedDate);
    renderEmotionTagsSlot(doc, ids, slotMap.emotionTags);
    renderConnectedKnowledgeSlot(doc, ids, slotMap.connectedKnowledge);
    renderEmotionMemoSlot(doc, ids, slotMap.emotionMemo);
  }

  function slotsToMap(presentation) {
    var slotMap = {};
    if (!isPlainObject(presentation) || !Array.isArray(presentation.slots)) {
      return slotMap;
    }
    var i;
    for (i = 0; i < presentation.slots.length; i += 1) {
      var slot = presentation.slots[i];
      if (!isPlainObject(slot)) continue;
      if (!ALLOWED_SLOT_KEYS[slot.key]) continue;
      slotMap[slot.key] = slot;
    }
    return slotMap;
  }

  /**
   * Create a presentation DOM renderer bound to route element ids.
   * @param {{ document?: Document, ids?: Object }} options
   */
  function createAppreciationSlotDomRenderer(options) {
    var doc = getDocument(options && options.document);
    var ids = mergeIds(options || {});

    return {
      render: function (presentation) {
        if (!doc) return;
        renderPresentation(doc, ids, slotsToMap(presentation));
      },
      reset: function () {
        if (!doc) return;
        renderPresentation(doc, ids, {});
      }
    };
  }

  window.LoveBudAppreciationSlotDom = Object.freeze({
    createAppreciationSlotDomRenderer: createAppreciationSlotDomRenderer,
    ALLOWED_SLOT_KEYS: Object.freeze(Object.assign({}, ALLOWED_SLOT_KEYS))
  });
})();
