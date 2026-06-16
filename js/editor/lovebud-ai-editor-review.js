/**
 * LoveBud AI Editor Suggestion Review Flow
 * v20260616-ai-editor-review-2
 *
 * Requirements:
 * - window.LoveBudAIEditorReview export
 * - Listen for 'lovebud-ai-local-draft-review-requested' on window
 * - Strict normalization of event detail parameters (allowlist only)
 * - Render suggestions in a review card inside a tray
 * - No innerHTML used (createElement / textContent only)
 * - Safety copy: 'AI 제안 검토', 'local_stub', '자동 저장되지 않음', '저장 전 직접 확인 필요'
 * - Dismiss button with data-lovebud-ai-draft-review-dismiss marker
 * - Explicit "copy to draft fields" button with data-lovebud-ai-copy-to-draft-fields marker
 * - Copy is triggered ONLY by user click on the copy button
 * - Copy uses allowlisted draft field selectors (DRAFT_FIELD_SELECTORS)
 * - No memory mutations, auto-saves, or live networks
 */

(function () {
  'use strict';

  if (typeof window === 'undefined' || typeof document === 'undefined') {
    return;
  }

  var trayEl = null;

  // Allowlisted draft field selectors for the explicit user-triggered copy action.
  // Copying from a review card into editor draft fields is only allowed for these
  // exact selector strings. Do NOT add broad or wildcard selectors here.
  // The actual repo selectors are listed first; generic/legacy fallbacks follow.
  var DRAFT_FIELD_SELECTORS = {
    title: [
      '#memoryTitleInput',
      '[data-memory-title-input]',
      '[data-editor-memory-title]',
      '#memoryTitle',
      '#momentTitle'
    ],
    memo: [
      '#memoryMemoInput',
      '[data-memory-memo-input]',
      '[data-editor-memory-memo]',
      '#memoryMemo',
      '#momentMemo'
    ],
    tags: [
      '[data-memory-tags-input]',
      '[data-editor-memory-tags]',
      '#memoryTags',
      '#momentTags'
    ],
    sourceUrl: [
      '#memoryUrlInput',
      '[data-memory-source-url-input]',
      '[data-editor-memory-source-url]',
      '#memorySourceUrl',
      '#momentSourceUrl'
    ]
  };

  var LoveBudAIEditorReview = {
    init: function () {
      window.removeEventListener('lovebud-ai-local-draft-review-requested', handleReviewRequest);
      window.addEventListener('lovebud-ai-local-draft-review-requested', handleReviewRequest);
    },
    isReady: function () {
      return true;
    },
    normalizeSuggestion: function (raw) {
      if (!raw) return null;
      return {
        title: raw.title || '',
        memo: raw.memo || '',
        tags: raw.tags || '',
        sourceUrl: raw.sourceUrl || '',
        disclaimer: raw.disclaimer || '',
        kind: raw.kind || ''
      };
    },
    renderSuggestion: function (rawSuggestion) {
      var suggestion = this.normalizeSuggestion(rawSuggestion);
      if (!suggestion) return;

      ensureTray();

      var container = trayEl.querySelector('.lovebud-ai-review-cards-container');
      if (container) {
        while (container.firstChild) {
          container.removeChild(container.firstChild);
        }
      } else {
        container = document.createElement('div');
        container.className = 'lovebud-ai-review-cards-container';
        trayEl.appendChild(container);
      }

      var card = document.createElement('div');
      card.className = 'lovebud-ai-review-card';
      card.setAttribute('data-lovebud-ai-draft-review-card', 'true');

      // Title
      if (suggestion.title) {
        var titleDiv = document.createElement('div');
        titleDiv.className = 'lovebud-ai-review-card-title';
        titleDiv.textContent = suggestion.title;
        card.appendChild(titleDiv);
      }

      // Memo
      if (suggestion.memo) {
        var memoDiv = document.createElement('div');
        memoDiv.className = 'lovebud-ai-review-card-memo';
        memoDiv.textContent = suggestion.memo;
        card.appendChild(memoDiv);
      }

      // Source Link
      if (suggestion.sourceUrl) {
        var linkDiv = document.createElement('div');
        linkDiv.className = 'lovebud-ai-review-card-link';
        
        var linkLabel = document.createElement('span');
        linkLabel.textContent = '출처: ';
        linkDiv.appendChild(linkLabel);

        var linkA = document.createElement('a');
        linkA.href = suggestion.sourceUrl;
        linkA.target = '_blank';
        linkA.rel = 'noopener noreferrer';
        linkA.textContent = suggestion.sourceUrl;
        linkDiv.appendChild(linkA);

        card.appendChild(linkDiv);
      }

      // Tags
      if (suggestion.tags) {
        var tagsDiv = document.createElement('div');
        tagsDiv.className = 'lovebud-ai-review-card-tags';
        var tagArray = Array.isArray(suggestion.tags) ? suggestion.tags : suggestion.tags.split(/\s+/);
        tagArray.forEach(function (tag) {
          if (tag) {
            var chip = document.createElement('span');
            chip.className = 'lovebud-ai-review-tag-chip';
            chip.textContent = tag;
            tagsDiv.appendChild(chip);
          }
        });
        card.appendChild(tagsDiv);
      }

      // Disclaimer
      if (suggestion.disclaimer) {
        var discDiv = document.createElement('div');
        discDiv.className = 'lovebud-ai-review-card-disclaimer';
        discDiv.textContent = suggestion.disclaimer;
        card.appendChild(discDiv);
      }

      // Copy to draft fields Button (explicit user-triggered copy only)
      var copyBtn = document.createElement('button');
      copyBtn.type = 'button';
      copyBtn.className = 'lovebud-ai-review-copy-to-draft-btn';
      copyBtn.setAttribute('data-lovebud-ai-copy-to-draft-fields', 'true');
      copyBtn.textContent = '초안 입력칸에 복사';
      copyBtn.addEventListener('click', function (ev) {
        if (ev && typeof ev.preventDefault === 'function') {
          ev.preventDefault();
        }
        // Only this user click triggers the copy; never auto-fire.
        LoveBudAIEditorReview.copySuggestionToDraftFields(suggestion);
      });
      card.appendChild(copyBtn);

      // Dismiss Button
      var dismissBtn = document.createElement('button');
      dismissBtn.type = 'button';
      dismissBtn.className = 'lovebud-ai-review-dismiss-btn';
      dismissBtn.setAttribute('data-lovebud-ai-draft-review-dismiss', 'true');
      dismissBtn.textContent = '지우기';
      dismissBtn.addEventListener('click', function () {
        LoveBudAIEditorReview.clear();
      });
      card.appendChild(dismissBtn);

      container.appendChild(card);

      trayEl.classList.add('active');
      trayEl.style.display = 'block';

      setTimeout(function () {
        trayEl.scrollIntoView({ behavior: 'smooth', block: 'end' });
      }, 100);
    },
    clear: function () {
      if (trayEl) {
        trayEl.classList.remove('active');
        trayEl.style.display = 'none';
        var container = trayEl.querySelector('.lovebud-ai-review-cards-container');
        if (container) {
          while (container.firstChild) {
            container.removeChild(container.firstChild);
          }
        }
        var notice = trayEl.querySelector('.lovebud-ai-review-copy-notice');
        if (notice && notice.parentNode) {
          notice.parentNode.removeChild(notice);
        }
      }
    },
    findFirstDraftField: function (selectors) {
      if (!Array.isArray(selectors)) return null;
      for (var i = 0; i < selectors.length; i++) {
        var sel = selectors[i];
        if (typeof sel === 'string' && sel.length > 0) {
          try {
            var el = document.querySelector(sel);
            if (el) return el;
          } catch (err) {
            // ignore invalid selector and continue
          }
        }
      }
      return null;
    },
    setDraftFieldValue: function (field, value) {
      if (!field) return false;
      var stringValue;
      if (typeof value === 'string') {
        stringValue = value;
      } else if (Array.isArray(value)) {
        stringValue = value
          .filter(function (t) { return t != null && t !== ''; })
          .map(function (t) { return String(t); })
          .join(', ');
      } else if (value == null) {
        stringValue = '';
      } else {
        stringValue = String(value);
      }
      try {
        field.value = stringValue;
        field.dispatchEvent(new Event('input', { bubbles: true }));
        field.dispatchEvent(new Event('change', { bubbles: true }));
        return true;
      } catch (err) {
        return false;
      }
    },
    showCopyNotice: function (message) {
      if (!trayEl) return;
      var existing = trayEl.querySelector('.lovebud-ai-review-copy-notice');
      if (existing && existing.parentNode) {
        existing.parentNode.removeChild(existing);
      }
      var notice = document.createElement('div');
      notice.className = 'lovebud-ai-review-copy-notice';
      notice.setAttribute('data-lovebud-ai-review-copy-notice', 'true');
      notice.textContent = message || '초안 입력칸에 복사되었습니다. 저장 전 직접 확인해 주세요.';
      trayEl.appendChild(notice);
    },
    copySuggestionToDraftFields: function (suggestion) {
      var normalized = this.normalizeSuggestion(suggestion);
      if (!normalized) {
        this.showCopyNotice('복사할 수 있는 제안이 없습니다.');
        return { title: false, memo: false, tags: false, sourceUrl: false };
      }
      var results = { title: false, memo: false, tags: false, sourceUrl: false };
      var keys = ['title', 'memo', 'tags', 'sourceUrl'];
      for (var i = 0; i < keys.length; i++) {
        var key = keys[i];
        var raw = normalized[key];
        if (raw == null) continue;
        if (typeof raw === 'string' && raw.length === 0) continue;
        if (Array.isArray(raw) && raw.length === 0) continue;
        var selectors = DRAFT_FIELD_SELECTORS[key];
        var field = this.findFirstDraftField(selectors);
        if (field) {
          results[key] = this.setDraftFieldValue(field, raw);
        }
      }
      this.showCopyNotice('초안 입력칸에 복사되었습니다. 저장 전 직접 확인해 주세요.');
      return results;
    }
  };

  function handleReviewRequest(e) {
    if (e && e.detail) {
      LoveBudAIEditorReview.renderSuggestion(e.detail);
    }
  }

  function ensureTray() {
    trayEl = document.querySelector('[data-lovebud-ai-draft-review-tray]');
    if (trayEl) return;

    trayEl = document.createElement('div');
    trayEl.className = 'lovebud-ai-review-tray';
    trayEl.setAttribute('data-lovebud-ai-draft-review-tray', 'true');

    // Header
    var header = document.createElement('div');
    header.className = 'lovebud-ai-review-tray-header';

    var titleSpan = document.createElement('span');
    titleSpan.className = 'lovebud-ai-review-tray-title';
    titleSpan.textContent = 'AI 제안 검토';
    header.appendChild(titleSpan);

    var badgeSpan = document.createElement('span');
    badgeSpan.className = 'lovebud-ai-review-tray-badge';
    badgeSpan.textContent = 'local_stub 미리보기';
    header.appendChild(badgeSpan);

    trayEl.appendChild(header);

    // Warning Info
    var warningDiv = document.createElement('div');
    warningDiv.className = 'lovebud-ai-review-tray-warning';
    warningDiv.textContent = '자동 저장되지 않음 / 저장 전 직접 확인 필요';
    trayEl.appendChild(warningDiv);

    // Cards container
    var container = document.createElement('div');
    container.className = 'lovebud-ai-review-cards-container';
    trayEl.appendChild(container);

    var layout = document.querySelector('.editor-layout') || document.querySelector('#canvasArea') || document.body;
    layout.appendChild(trayEl);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', function () {
      LoveBudAIEditorReview.init();
    });
  } else {
    LoveBudAIEditorReview.init();
  }

  window.LoveBudAIEditorReview = LoveBudAIEditorReview;
})();
