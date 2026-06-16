/**
 * LoveBud AI Editor Suggestion Review Flow
 * v20260616-ai-editor-review-1
 *
 * Requirements:
 * - window.LoveBudAIEditorReview export
 * - Listen for 'lovebud-ai-local-draft-review-requested' on window
 * - Strict normalization of event detail parameters (allowlist only)
 * - Render suggestions in a review card inside a tray
 * - No innerHTML used (createElement / textContent only)
 * - Safety copy: 'AI 제안 검토', 'local_stub', '자동 저장되지 않음', '저장 전 직접 확인 필요'
 * - Dismiss button with data-lovebud-ai-draft-review-dismiss marker
 * - No memory mutations, auto-saves, or live networks
 */

(function () {
  'use strict';

  if (typeof window === 'undefined' || typeof document === 'undefined') {
    return;
  }

  var trayEl = null;

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
      }
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
