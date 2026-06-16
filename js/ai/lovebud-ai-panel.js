/**
 * LoveBud Global AI Side Panel Controller
 * v20260616-ai-panel-1
 *
 * Requirements:
 * - window.LoveBudAIPanel export
 * - init/open/close/toggle functions
 * - Bind click to any data-lovebud-ai-trigger elements
 * - Manage aria-expanded on triggers / aria-hidden on panel
 * - Manage body class lovebud-ai-panel-open
 * - ESC key close / backdrop overlay close / close button close
 * - Use markers:
 *   - data-lovebud-ai-panel (on container/sheet)
 *   - data-lovebud-ai-overlay (on backdrop)
 *   - data-lovebud-ai-close (on close button)
 *   - data-lovebud-ai-trigger (on trigger buttons)
 * - Delegate simulation behavior only to window.LoveBudAILocalStub
 * - No fetch / no network / no API / no memory saving / no mutation
 */

(function () {
  'use strict';

  if (typeof window === 'undefined' || typeof document === 'undefined') {
    return;
  }

  var isOpen = false;
  var container = null;
  var backdrop = null;
  var sheet = null;
  var closeBtn = null;
  var inputEl = null;
  var sendBtn = null;
  var welcomeEl = null;
  var chatAreaEl = null;
  var messagesListEl = null;
  var loaderEl = null;

  var LoveBudAIPanel = {
    init: function () {
      if (document.getElementById('lovebud-ai-side-panel')) return;

      createDOM();
      bindEvents();
    },
    open: function () {
      if (isOpen) return;
      isOpen = true;
      updateState();
      if (inputEl) {
        setTimeout(function () {
          inputEl.focus();
        }, 100);
      }
    },
    close: function () {
      if (!isOpen) return;
      isOpen = false;
      updateState();
    },
    toggle: function () {
      if (isOpen) {
        this.close();
      } else {
        this.open();
      }
    },
    isOpen: function () {
      return isOpen;
    }
  };

  function createDOM() {
    // 1. Create main container
    container = document.createElement('div');
    container.className = 'lovebud-ai-panel-container';
    container.id = 'lovebud-ai-side-panel';
    container.setAttribute('aria-hidden', 'true');
    container.setAttribute('data-lovebud-ai-panel', 'true');

    // 2. Create backdrop overlay
    backdrop = document.createElement('div');
    backdrop.className = 'lovebud-ai-panel-backdrop';
    backdrop.setAttribute('data-lovebud-ai-overlay', 'true');
    container.appendChild(backdrop);

    // 3. Create sheet drawer
    sheet = document.createElement('div');
    sheet.className = 'lovebud-ai-panel-sheet';
    sheet.setAttribute('role', 'dialog');
    sheet.setAttribute('aria-modal', 'true');
    sheet.setAttribute('aria-labelledby', 'lovebud-ai-panel-title');

    // Header
    var header = document.createElement('div');
    header.className = 'lovebud-ai-panel-header';

    var headerTitle = document.createElement('div');
    headerTitle.className = 'lovebud-ai-panel-header-title';

    var headerIcon = document.createElement('span');
    headerIcon.className = 'material-symbols-outlined';
    headerIcon.textContent = 'smart_toy';
    headerTitle.appendChild(headerIcon);

    var titleH2 = document.createElement('h2');
    titleH2.id = 'lovebud-ai-panel-title';
    titleH2.textContent = 'LoveBud Scout AI';
    headerTitle.appendChild(titleH2);
    header.appendChild(headerTitle);

    closeBtn = document.createElement('button');
    closeBtn.className = 'lovebud-ai-panel-close-btn';
    closeBtn.setAttribute('data-lovebud-ai-close', 'true');
    closeBtn.setAttribute('aria-label', '닫기');

    var closeIcon = document.createElement('span');
    closeIcon.className = 'material-symbols-outlined';
    closeIcon.textContent = 'close';
    closeBtn.appendChild(closeIcon);
    header.appendChild(closeBtn);
    sheet.appendChild(header);

    // Content Scroll Area
    var content = document.createElement('div');
    content.className = 'lovebud-ai-panel-content';

    // Welcome block
    welcomeEl = document.createElement('div');
    welcomeEl.className = 'lovebud-ai-panel-welcome';
    welcomeEl.id = 'lovebudAIPanelWelcome';

    var welcomeIcon = document.createElement('div');
    welcomeIcon.className = 'lovebud-ai-panel-welcome-icon';
    welcomeIcon.textContent = '🌳';
    welcomeEl.appendChild(welcomeIcon);

    var welcomeH3 = document.createElement('h3');
    welcomeH3.textContent = '무엇을 도와드릴까요?';
    welcomeEl.appendChild(welcomeH3);

    var welcomeP = document.createElement('p');
    welcomeP.textContent = '기록하고 싶은 팬 활동 링크(YouTube, 기사 등)를 붙여넣으시거나, 대화로 순간을 엮어보세요.';
    welcomeEl.appendChild(welcomeP);

    // Suggestion Cards
    var suggestCards = document.createElement('div');
    suggestCards.className = 'lovebud-ai-panel-suggest-cards';

    var cardActionData = [
      { action: 'analyse-link', icon: 'link', title: '링크 분석하기', desc: 'YouTube나 뉴스 기사 링크 분석' },
      { action: 'suggest-tags', icon: 'sell', title: '감정 태그 추천', desc: '기록에 어울리는 감정 추천' },
      { action: 'new-tree', icon: 'add_circle', title: '새 트리 아이디어', desc: '러브트리 컨셉 시작하기' }
    ];

    cardActionData.forEach(function (data) {
      var card = document.createElement('div');
      card.className = 'lovebud-ai-panel-suggest-card';
      card.setAttribute('data-action', data.action);

      var cardIcon = document.createElement('span');
      cardIcon.className = 'material-symbols-outlined';
      cardIcon.textContent = data.icon;
      card.appendChild(cardIcon);

      var cardTitle = document.createElement('strong');
      cardTitle.textContent = data.title;
      card.appendChild(cardTitle);

      var cardDesc = document.createElement('span');
      cardDesc.textContent = data.desc;
      card.appendChild(cardDesc);

      suggestCards.appendChild(card);
    });

    welcomeEl.appendChild(suggestCards);
    content.appendChild(welcomeEl);

    // Chat Conversation Area
    chatAreaEl = document.createElement('div');
    chatAreaEl.className = 'lovebud-ai-panel-chat-area';
    chatAreaEl.id = 'lovebudAIPanelChatArea';
    chatAreaEl.style.display = 'none';

    messagesListEl = document.createElement('div');
    messagesListEl.className = 'lovebud-ai-messages-list';
    messagesListEl.id = 'lovebudAIMessagesList';
    chatAreaEl.appendChild(messagesListEl);

    // Loader Spinner
    loaderEl = document.createElement('div');
    loaderEl.className = 'lovebud-ai-panel-loader';
    loaderEl.id = 'lovebudAIPanelLoader';
    loaderEl.style.display = 'none';

    var spinner = document.createElement('div');
    spinner.className = 'lovebud-ai-spinner';
    var spinnerIcon = document.createElement('span');
    spinnerIcon.className = 'material-symbols-outlined';
    spinnerIcon.textContent = 'progress_activity';
    spinner.appendChild(spinnerIcon);
    loaderEl.appendChild(spinner);

    var loaderText = document.createElement('span');
    loaderText.className = 'lovebud-ai-loader-text';
    loaderText.textContent = 'LoveBud Scout이 제안을 준비하고 있습니다...';
    loaderEl.appendChild(loaderText);
    chatAreaEl.appendChild(loaderEl);

    content.appendChild(chatAreaEl);
    sheet.appendChild(content);

    // Footer/Input bar
    var inputContainer = document.createElement('div');
    inputContainer.className = 'lovebud-ai-panel-input-container';

    var inputWrapper = document.createElement('div');
    inputWrapper.className = 'lovebud-ai-panel-input-wrapper';

    inputEl = document.createElement('textarea');
    inputEl.className = 'lovebud-ai-panel-input';
    inputEl.id = 'lovebudAIPanelInput';
    inputEl.placeholder = '메시지 또는 링크를 입력하세요...';
    inputEl.setAttribute('rows', '1');
    inputEl.setAttribute('aria-label', '메시지 입력');
    inputWrapper.appendChild(inputEl);

    sendBtn = document.createElement('button');
    sendBtn.type = 'button';
    sendBtn.className = 'lovebud-ai-panel-send-btn';
    sendBtn.id = 'lovebudAIPanelSendBtn';
    sendBtn.setAttribute('aria-label', '전송');
    sendBtn.disabled = true;

    var sendIcon = document.createElement('span');
    sendIcon.className = 'material-symbols-outlined';
    sendIcon.textContent = 'arrow_upward';
    sendBtn.appendChild(sendIcon);
    inputWrapper.appendChild(sendBtn);

    inputContainer.appendChild(inputWrapper);

    var footerNote = document.createElement('div');
    footerNote.className = 'lovebud-ai-panel-footer-note';
    footerNote.textContent = 'LoveBud Scout은 실시간 답변 및 제안을 제공하며, 결과는 저장하기 전 언제든 편집할 수 있습니다.';
    inputContainer.appendChild(footerNote);

    sheet.appendChild(inputContainer);
    container.appendChild(sheet);
    document.body.appendChild(container);
  }

  function bindEvents() {
    // 1. Overlay click close
    if (backdrop) {
      backdrop.addEventListener('click', function () {
        LoveBudAIPanel.close();
      });
    }

    // 2. Close button click close
    if (closeBtn) {
      closeBtn.addEventListener('click', function () {
        LoveBudAIPanel.close();
      });
    }

    // 3. Delegate trigger clicks to any [data-lovebud-ai-trigger]
    document.addEventListener('click', function (e) {
      var trigger = e.target.closest('[data-lovebud-ai-trigger]');
      if (trigger) {
        e.preventDefault();
        e.stopPropagation();
        LoveBudAIPanel.toggle();
      }
    });

    // 4. Textarea auto-resize
    if (inputEl) {
      inputEl.addEventListener('input', function () {
        var hasText = inputEl.value.trim().length > 0;
        sendBtn.disabled = !hasText;

        inputEl.style.height = 'auto';
        inputEl.style.height = (inputEl.scrollHeight - 8) + 'px';
      });

      inputEl.addEventListener('keydown', function (e) {
        if (e.key === 'Enter' && !e.shiftKey) {
          e.preventDefault();
          submitMessage();
        }
      });
    }

    // 5. Send Button
    if (sendBtn) {
      sendBtn.addEventListener('click', function () {
        submitMessage();
      });
    }

    // 6. ESC close handler
    window.addEventListener('keydown', function (e) {
      if (e.key === 'Escape' && isOpen) {
        LoveBudAIPanel.close();
      }
    });

    // 7. Cards interaction
    var cards = container.querySelectorAll('.lovebud-ai-panel-suggest-card');
    cards.forEach(function (card) {
      card.addEventListener('click', function () {
        var action = card.getAttribute('data-action');
        var text = '';
        if (action === 'analyse-link') {
          text = '[링크 분석] https://youtube.com/watch?v=';
        } else if (action === 'suggest-tags') {
          text = '[태그 추천] 이 순간에 어울리는 태그 추천 요청';
        } else if (action === 'new-tree') {
          text = '[트리 제안] 새로운 러브트리 아이디어 추천 요청';
        }

        if (inputEl) {
          inputEl.value = text;
          inputEl.focus();
          sendBtn.disabled = false;
          inputEl.style.height = 'auto';
          inputEl.style.height = (inputEl.scrollHeight - 8) + 'px';
        }
      });
    });
  }

  function updateState() {
    if (isOpen) {
      if (container) {
        container.classList.add('active');
        container.setAttribute('aria-hidden', 'false');
      }
      document.body.classList.add('lovebud-ai-panel-open');
    } else {
      if (container) {
        container.classList.remove('active');
        container.setAttribute('aria-hidden', 'true');
      }
      document.body.classList.remove('lovebud-ai-panel-open');
    }

    // Update aria-expanded on all triggers
    var triggers = document.querySelectorAll('[data-lovebud-ai-trigger]');
    triggers.forEach(function (trigger) {
      trigger.setAttribute('aria-expanded', isOpen ? 'true' : 'false');
    });
  }

  function submitMessage() {
    if (!inputEl) return;
    var text = inputEl.value.trim();
    if (!text) return;

    // Reset input state
    inputEl.value = '';
    inputEl.style.height = 'auto';
    sendBtn.disabled = true;

    // Display user bubble
    appendMessage('user', text);

    // Switch view if welcome screen is active
    if (welcomeEl && welcomeEl.style.display !== 'none') {
      welcomeEl.style.display = 'none';
      if (chatAreaEl) {
        chatAreaEl.style.display = 'flex';
      }
    }

    // Show Loader
    if (loaderEl) {
      loaderEl.style.display = 'flex';
    }
    scrollToBottom();

    // Disable input during load
    inputEl.disabled = true;

    // Retrieve simulated answer via window.LoveBudAILocalStub ONLY
    setTimeout(function () {
      if (loaderEl) {
        loaderEl.style.display = 'none';
      }
      inputEl.disabled = false;
      inputEl.focus();

      if (window.LoveBudAILocalStub) {
        var reply = fetchStubResponse(text);
        appendStructuredMessage(reply);
      } else {
        appendMessage('assistant', '로컬 스텁 엔진이 로드되지 않았습니다.');
      }
      scrollToBottom();
    }, 1500);
  }

  function appendMessage(sender, text) {
    if (!messagesListEl) return;

    var bubble = document.createElement('div');
    bubble.className = 'lovebud-ai-msg ' + sender;
    bubble.textContent = text;

    messagesListEl.appendChild(bubble);
    scrollToBottom();
  }

  function fetchStubResponse(userInput) {
    var stub = window.LoveBudAILocalStub;
    var isLink = userInput.toLowerCase().indexOf('http') !== -1 || userInput.toLowerCase().indexOf('youtube') !== -1 || userInput.toLowerCase().indexOf('링크') !== -1;
    var isTags = userInput.indexOf('태그') !== -1 || userInput.indexOf('추천') !== -1;
    var isTree = userInput.indexOf('트리') !== -1 || userInput.indexOf('제안') !== -1;

    if (isLink) {
      return stub.createDraftFromLink('https://youtube.com/watch?v=mock');
    } else if (isTags) {
      return stub.suggestTags(userInput);
    } else if (isTree) {
      return stub.summarizeTreeFlow();
    }
    return stub.refineMemo(userInput);
  }

  function appendStructuredMessage(reply) {
    if (!messagesListEl) return;

    var bubble = document.createElement('div');
    bubble.className = 'lovebud-ai-msg assistant';

    var structuredContainer = document.createElement('div');
    structuredContainer.className = 'lovebud-ai-structured';

    // 1. Title/Header
    if (reply.title) {
      var titleDiv = document.createElement('div');
      titleDiv.className = 'lovebud-ai-structured-title';
      titleDiv.textContent = reply.title;
      structuredContainer.appendChild(titleDiv);
    }

    // 2. Body Text / Memo / Summary
    var mainText = reply.summary || reply.memo || reply.text || '';
    if (mainText) {
      var bodyField = createStructuredField('제안 내용', mainText);
      structuredContainer.appendChild(bodyField);
    }

    // 3. Source URL
    if (reply.sourceUrl) {
      var urlField = createStructuredField('출처 링크', reply.sourceUrl);
      structuredContainer.appendChild(urlField);
    }

    // 4. Tags
    if (reply.tags) {
      var tagLabel = document.createElement('span');
      tagLabel.className = 'lovebud-ai-structured-label';
      tagLabel.textContent = '제안 감정 태그 (클릭하여 선택)';
      structuredContainer.appendChild(tagLabel);

      var tagsContainer = document.createElement('div');
      tagsContainer.className = 'lovebud-ai-tags-container';

      var tagArray = Array.isArray(reply.tags) ? reply.tags : reply.tags.split(/\s+/);
      tagArray.forEach(function (tagName) {
        var chip = document.createElement('span');
        chip.className = 'lovebud-ai-tag-chip';
        chip.textContent = tagName;
        chip.addEventListener('click', function () {
          showToast('감정 태그 "' + tagName + '"가 복사되었습니다!');
        });
        tagsContainer.appendChild(chip);
      });
      structuredContainer.appendChild(tagsContainer);
    }

    // 5. Action Button (fills editor if editor exists)
    if (reply.title || reply.tags) {
      var actionBtn = document.createElement('button');
      actionBtn.type = 'button';
      actionBtn.className = 'lovebud-ai-action-btn';

      var actionIcon = document.createElement('span');
      actionIcon.className = 'material-symbols-outlined';
      actionIcon.textContent = 'auto_stories';
      actionBtn.appendChild(actionIcon);

      var actionText = document.createTextNode(' 내 에디터/트리에 제안 적용하기');
      actionBtn.appendChild(actionText);

      actionBtn.addEventListener('click', function () {
        if (window.LoveTreeEditor && typeof window.LoveTreeEditor.fillMomentDraft === 'function') {
          window.LoveTreeEditor.fillMomentDraft({
            title: reply.title || '제안된 순간',
            memo: reply.memo || reply.text || '',
            tags: Array.isArray(reply.tags) ? reply.tags.join(' ') : (reply.tags || ''),
            sourceUrl: reply.sourceUrl || ''
          });
          showToast('에디터에 AI 제안이 적용되었습니다!');
        } else {
          showToast('클립보드에 제안 내용이 복사되었습니다! 에디터 페이지로 이동해 입력해 보세요.');
        }
      });
      structuredContainer.appendChild(actionBtn);
    }

    // 6. Safety Warning Disclaimer
    if (reply.disclaimer) {
      var warningField = document.createElement('div');
      warningField.style.fontSize = '11px';
      warningField.style.color = 'var(--color-primary)';
      warningField.style.marginTop = '8px';
      warningField.style.fontStyle = 'italic';
      warningField.textContent = reply.disclaimer;
      structuredContainer.appendChild(warningField);
    }

    bubble.appendChild(structuredContainer);
    messagesListEl.appendChild(bubble);
  }

  function createStructuredField(label, value) {
    var field = document.createElement('div');
    field.className = 'lovebud-ai-structured-field';

    var labelSpan = document.createElement('span');
    labelSpan.className = 'lovebud-ai-structured-label';
    labelSpan.textContent = label;
    field.appendChild(labelSpan);

    var valueSpan = document.createElement('span');
    valueSpan.textContent = value;
    field.appendChild(valueSpan);

    return field;
  }

  function scrollToBottom() {
    var contentEl = container ? container.querySelector('.lovebud-ai-panel-content') : null;
    if (contentEl) {
      setTimeout(function () {
        contentEl.scrollTop = contentEl.scrollHeight;
      }, 50);
    }
  }

  function showToast(message) {
    var toast = document.getElementById('lovebud-ai-dynamic-toast');
    if (!toast) {
      toast = document.createElement('div');
      toast.id = 'lovebud-ai-dynamic-toast';
      toast.className = 'lovebud-ai-toast';
      document.body.appendChild(toast);
    }

    toast.textContent = message;
    toast.classList.add('show');

    setTimeout(function () {
      toast.classList.remove('show');
    }, 2500);
  }

  // Auto-run DOM initializer on ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', function () {
      LoveBudAIPanel.init();
    });
  } else {
    LoveBudAIPanel.init();
  }

  window.LoveBudAIPanel = LoveBudAIPanel;
})();
