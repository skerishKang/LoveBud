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
      { action: 'refine-memo', icon: 'edit_note', title: '메모 다듬기', desc: '작성 중인 메모를 아름답게 정돈합니다.' },
      { action: 'suggest-tags', icon: 'sell', title: '감정 태그 추천', desc: '이 순간에 어울리는 감정 분석 및 추천' },
      { action: 'draft-from-link', icon: 'link', title: '링크로 순간 초안 만들기', desc: '외부 URL 분석 예시 초안 생성' },
      { action: 'summarize-tree-flow', icon: 'account_tree', title: '이 트리 흐름 요약', desc: '전체적인 감정적 연결 구조 요약' }
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
    inputEl.placeholder = 'AI에게 부탁하기...';
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
    footerNote.textContent = 'LoveBud AI는 현재 local_stub 미리보기입니다. 결과는 자동 저장되지 않으며, 저장 전 직접 확인해 주세요.';
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
        if (action === 'refine-memo') {
          text = '메모 다듬기';
        } else if (action === 'suggest-tags') {
          text = '감정 태그 추천';
        } else if (action === 'draft-from-link') {
          text = '링크로 순간 초안 만들기';
        } else if (action === 'summarize-tree-flow') {
          text = '이 트리 흐름 요약';
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
    var cleanInput = userInput.trim();
    if (cleanInput === '메모 다듬기') {
      return stub.refineMemo('');
    } else if (cleanInput === '감정 태그 추천') {
      return stub.suggestTags('');
    } else if (cleanInput === '링크로 순간 초안 만들기') {
      return stub.createDraftFromLink('https://youtube.com/watch?v=mock');
    } else if (cleanInput === '이 트리 흐름 요약') {
      return stub.summarizeTreeFlow();
    }

    var isLink = userInput.toLowerCase().indexOf('http') !== -1 || userInput.toLowerCase().indexOf('youtube') !== -1;
    var isTags = userInput.indexOf('태그') !== -1 || userInput.indexOf('추천') !== -1;
    var isTree = userInput.indexOf('트리') !== -1 || userInput.indexOf('요약') !== -1;

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
      tagLabel.textContent = '제안 감정 태그';
      structuredContainer.appendChild(tagLabel);

      var tagsContainer = document.createElement('div');
      tagsContainer.className = 'lovebud-ai-tags-container';

      var tagArray = Array.isArray(reply.tags) ? reply.tags : reply.tags.split(/\s+/);
      tagArray.forEach(function (tagName) {
        var chip = document.createElement('span');
        chip.className = 'lovebud-ai-tag-chip';
        chip.textContent = tagName;
        tagsContainer.appendChild(chip);
      });
      structuredContainer.appendChild(tagsContainer);
    }

    // 4.5 Send to editor review action (only in editor page context)
    var isEditorPage = (window.location.pathname.indexOf('/pages/editor') !== -1 || document.querySelector('.editor-layout') !== null);
    if (isEditorPage) {
      var actionBtn = document.createElement('button');
      actionBtn.type = 'button';
      actionBtn.className = 'lovebud-ai-action-btn';
      actionBtn.setAttribute('data-lovebud-ai-send-to-editor-review', 'true');

      var actionIcon = document.createElement('span');
      actionIcon.className = 'material-symbols-outlined';
      actionIcon.textContent = 'send_to_mobile';
      actionBtn.appendChild(actionIcon);

      var actionText = document.createTextNode(' 에디터 검토함으로 보내기');
      actionBtn.appendChild(actionText);

      actionBtn.addEventListener('click', function () {
        var eventDetail = {
          title: reply.title || '',
          memo: reply.memo || reply.text || reply.summary || '',
          tags: Array.isArray(reply.tags) ? reply.tags.join(' ') : (reply.tags || ''),
          sourceUrl: reply.sourceUrl || '',
          disclaimer: reply.disclaimer || '',
          kind: reply.kind || ''
        };

        var customEvent = new CustomEvent('lovebud-ai-local-draft-review-requested', {
          detail: eventDetail,
          bubbles: true
        });
        window.dispatchEvent(customEvent);
      });
      structuredContainer.appendChild(actionBtn);
    }

    // 5. Safety Warning Disclaimer
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
