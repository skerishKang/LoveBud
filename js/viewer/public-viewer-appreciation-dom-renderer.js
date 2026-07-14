(function () {
  'use strict';

  var ERROR_PREFIX = '[public-viewer-appreciation-dom-renderer]';

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

  function getElement(id) {
    return typeof document !== 'undefined' ? document.getElementById(id) : null;
  }

  function clearChildren(el) {
    if (!el) return;
    while (el.firstChild) {
      el.removeChild(el.firstChild);
    }
  }

  function setGroupHidden(groupId, hidden) {
    var group = getElement(groupId);
    if (!group) return;
    group.hidden = !!hidden;
  }

  function renderIdentitySlot(slot) {
    var titleEl = getElement('detailCurrentMomentTitle');
    if (!titleEl) return;
    if (slot && slot.available && slot.value && typeof slot.value.title === 'string') {
      clearChildren(titleEl);
      var span = document.createElement('span');
      span.textContent = slot.value.title;
      titleEl.appendChild(span);
    } else {
      clearChildren(titleEl);
    }
  }

  function renderRememberedDateSlot(slot) {
    var dateEl = getElement('detailDateText');
    if (!dateEl) return;
    if (slot && slot.available && typeof slot.value === 'string') {
      dateEl.textContent = slot.value;
      setGroupHidden('detailDateGroup', false);
    } else {
      dateEl.textContent = '';
      setGroupHidden('detailDateGroup', true);
    }
  }

  function renderEmotionTagsSlot(slot) {
    var container = getElement('detailTags');
    if (!container) return;
    if (slot && slot.available && Array.isArray(slot.items) && slot.items.length > 0) {
      clearChildren(container);
      var i;
      for (i = 0; i < slot.items.length; i++) {
        var item = slot.items[i];
        if (typeof item !== 'string') continue;
        var chip = document.createElement('span');
        chip.className = 'tag tag-primary';
        chip.textContent = item;
        container.appendChild(chip);
      }
      setGroupHidden('detailTagsGroup', false);
    } else {
      clearChildren(container);
      setGroupHidden('detailTagsGroup', true);
    }
  }

  function renderEmotionMemoSlot(slot) {
    var memoEl = getElement('detailMemo');
    if (!memoEl) return;
    if (slot && slot.available && typeof slot.value === 'string') {
      clearChildren(memoEl);
      var wrapper = document.createElement('div');
      wrapper.style.width = '100%';
      var body = document.createElement('div');
      body.style.lineHeight = '1.8';
      body.style.fontSize = '0.95rem';
      body.style.color = 'var(--on-surface)';
      body.style.whiteSpace = 'pre-line';
      body.textContent = slot.value;
      wrapper.appendChild(body);
      memoEl.appendChild(wrapper);
      setGroupHidden('detailMemoGroup', false);
    } else {
      clearChildren(memoEl);
      setGroupHidden('detailMemoGroup', true);
    }
  }

  function renderConnectedKnowledgeSlot(slot) {
    var listEl = getElement('detailPublicKnowledgeList');
    var groupEl = getElement('detailPublicKnowledgeGroup');
    if (!listEl) return;
    if (
      slot && slot.available &&
      Array.isArray(slot.items) && slot.items.length > 0
    ) {
      clearChildren(listEl);
      var i;
      for (i = 0; i < slot.items.length; i++) {
        var item = slot.items[i];
        if (!isPlainObject(item)) continue;
        if (typeof item.label !== 'string' || !item.label) continue;
        var li = document.createElement('li');
        li.className = 'public-viewer-knowledge-item';
        var text = item.label;
        if (typeof item.type === 'string' && item.type) {
          text += ' · ' + item.type;
        }
        if (typeof item.sourceLabel === 'string' && item.sourceLabel) {
          text += ' (' + item.sourceLabel + ')';
        }
        li.textContent = text;
        listEl.appendChild(li);
      }
      if (groupEl) groupEl.hidden = false;
    } else {
      clearChildren(listEl);
      if (groupEl) groupEl.hidden = true;
    }
  }

  function renderPresentation(slotMap) {
    if (!isPlainObject(slotMap)) return;
    renderIdentitySlot(slotMap.identity);
    renderRememberedDateSlot(slotMap.rememberedDate);
    renderEmotionTagsSlot(slotMap.emotionTags);
    renderConnectedKnowledgeSlot(slotMap.connectedKnowledge);
    renderEmotionMemoSlot(slotMap.emotionMemo);
  }

  function createPublicViewerAppreciationDomRenderer(options) {
    return {
      render: function (presentation) {
        if (!isPlainObject(presentation) || !Array.isArray(presentation.slots)) {
          renderPresentation({});
          return;
        }
        var slotMap = {};
        var i;
        for (i = 0; i < presentation.slots.length; i++) {
          var slot = presentation.slots[i];
          if (!isPlainObject(slot)) continue;
          if (!ALLOWED_SLOT_KEYS[slot.key]) continue;
          slotMap[slot.key] = slot;
        }
        renderPresentation(slotMap);
      },
      reset: function () {
        renderPresentation({});
      }
    };
  }

  window.LoveBudPublicViewerAppreciationDomRenderer = Object.freeze({
    createPublicViewerAppreciationDomRenderer: createPublicViewerAppreciationDomRenderer
  });
})();
