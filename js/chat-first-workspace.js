/**
 * LoveBud — Chat-First Workspace Shell
 * =====================================
 * Isolated UX prototype for Issue #1321
 * 기준 문서: docs/product/CHAT_FIRST_TREE_WORKSPACE_CONTRACT.md
 *
 * ⚡ Mock data only — no DB/API/AI
 * ⚡ No editor/runtime modification
 * ⚡ No production route change
 *
 * v20260518-1
 */
(function () {
  'use strict';

  /* ── Mock Data ──────────────────────────────────────────── */
  var MOCK_TREE = {
    id: 'tree-mock-001',
    name: '봄날의 산책',
    created: '2026-03-15',
    momentCount: 5,
    branchCount: 2,
  };

  var MOCK_MOMENTS = [
    {
      id: 'mom-001',
      text: '처음 만난 날, 벚꽃이 흩날리던 공원 벤치에서 — 그날의 온도, 바람, 햇살이 아직도 선명해.',
      date: '2026-03-15',
      type: 'warm',
      tags: ['첫만남', '벚꽃', '공원'],
    },
    {
      id: 'mom-002',
      text: '함께 만든 첫 요리. 파스타는 소금을 너무 많이 넣었지만 웃음이 더 많았던 저녁.',
      date: '2026-03-22',
      type: 'rose',
      tags: ['요리', '첫경험', '웃음'],
    },
    {
      id: 'mom-003',
      text: '비 오는 날, 우산 없이 걸으며 했던 수다. 젖은 어깨보다 따뜻했던 말들.',
      date: '2026-04-02',
      type: 'warm',
      tags: ['비', '대화', '일상'],
    },
    {
      id: 'mom-004',
      text: '함께 본 첫 영화, 그리고 그날 밤 늦도록 이어진 전화 통화. 장르는 기억나지 않지만 네 목소리는 기억나.',
      date: '2026-04-10',
      type: 'green',
      tags: ['영화', '전화', '로맨스'],
    },
    {
      id: 'mom-005',
      text: '네가 나를 처음으로 "우리"라고 말한 순간. 아주 사소한 문장이었지만 가슴이 뛰었어.',
      date: '2026-04-18',
      type: 'rose',
      tags: ['말투', '특별한순간', '설렘'],
    },
  ];

  var MOCK_CHAT_HISTORY = [
    { role: 'system', text: '안녕하세요! 오늘은 어떤 순간을 기록하고 싶으신가요?' },
  ];

  /* ── State ──────────────────────────────────────────────── */
  var state = {
    screen: 'entry', // 'entry' | 'workspace'
    mobileTab: 'chat', // 'chat' | 'tree' | 'moments'
    selectedMomentId: 'mom-001',
    chatMessages: JSON.parse(JSON.stringify(MOCK_CHAT_HISTORY)),
    entryText: '',
    chatInputText: '',
    bottomSheetOpen: false,
  };

  /* ── DOM Cache ──────────────────────────────────────────── */
  var $ = function (sel) { return document.querySelector(sel); };
  var $$ = function (sel) { return document.querySelectorAll(sel); };

  var els = {};

  function cacheDom() {
    els.entry = $('.cfw-entry');
    els.workspace = $('.cfw-workspace');
    els.entryInput = $('.cfw-entry-input');
    els.entrySubmit = $('.cfw-entry-submit');
    els.entryActions = $('.cfw-entry-actions');
    els.chatMessages = $('.cfw-chat-messages');
    els.chatInput = $('.cfw-chat-input');
    els.chatSend = $('.cfw-chat-send');
    els.chatSuggestions = $('.cfw-chat-suggestions');
    els.momentList = $('.cfw-moment-list');
    els.treeName = $('.cfw-tree-name');
    els.treeMeta = $('.cfw-tree-meta');
    els.statMoments = $('.cfw-stat-moments');
    els.statBranches = $('.cfw-stat-branches');
    els.selectedMomentHeader = $('.cfw-selected-moment-header');
    els.selectedMomentBody = $('.cfw-selected-moment-body');
    els.selectedMomentTags = $('.cfw-selected-moment-tags');
    els.mobileTabs = $('.cfw-mobile-tabs');
    els.momentStripName = $('.cfw-moment-strip-name');
    els.momentStripExpand = $('.cfw-moment-strip-expand');
    els.bottomSheet = $('.cfw-bottom-sheet');
    els.bottomSheetOverlay = $('.cfw-bottom-sheet-overlay');
    els.bottomSheetContent = $('.cfw-bottom-sheet-content');
    els.mobileTabChat = $('.cfw-mobile-tab[data-tab="chat"]');
    els.mobileTabTree = $('.cfw-mobile-tab[data-tab="tree"]');
    els.mobileTabMoments = $('.cfw-mobile-tab[data-tab="moments"]');
    els.mobilePanelChat = $('.cfw-mobile-panel[data-panel="chat"]');
    els.mobilePanelTree = $('.cfw-mobile-panel[data-panel="tree"]');
    els.mobilePanelMoments = $('.cfw-mobile-panel[data-panel="moments"]');
  }

  /* ── Render Functions ───────────────────────────────────── */

  function renderTreeSummary() {
    if (els.treeName) els.treeName.textContent = MOCK_TREE.name;
    if (els.treeMeta) els.treeMeta.textContent = 'created ' + MOCK_TREE.created;
    if (els.statMoments) els.statMoments.textContent = MOCK_MOMENTS.length;
    if (els.statBranches) els.statBranches.textContent = MOCK_TREE.branchCount;
  }

  function renderMomentList() {
    if (!els.momentList) return;
    els.momentList.innerHTML = '';
    MOCK_MOMENTS.forEach(function (mom) {
      var item = document.createElement('div');
      item.className = 'cfw-moment-item' + (mom.id === state.selectedMomentId ? ' active' : '');
      item.dataset.momentId = mom.id;
      item.innerHTML =
        '<div class="cfw-moment-dot ' + mom.type + '"></div>' +
        '<div><div class="cfw-moment-text">' + mom.text + '</div>' +
        '<div class="cfw-moment-date">' + mom.date + '</div></div>';
      item.addEventListener('click', function () {
        selectMoment(mom.id);
      });
      els.momentList.appendChild(item);
    });
  }

  function renderSelectedMoment() {
    var mom = MOCK_MOMENTS.find(function (m) { return m.id === state.selectedMomentId; });
    if (!mom) return;
    if (els.selectedMomentHeader) els.selectedMomentHeader.textContent = formatDate(mom.date);
    if (els.selectedMomentBody) els.selectedMomentBody.textContent = mom.text;
    if (els.selectedMomentTags) {
      els.selectedMomentTags.innerHTML = '';
      mom.tags.forEach(function (tag) {
        var span = document.createElement('span');
        span.className = 'cfw-moment-tag';
        span.textContent = tag;
        els.selectedMomentTags.appendChild(span);
      });
    }
    if (els.momentStripName) els.momentStripName.textContent = mom.text.slice(0, 30) + '…';
  }

  function renderChatMessages() {
    if (!els.chatMessages) return;
    els.chatMessages.innerHTML = '';
    state.chatMessages.forEach(function (msg) {
      var div = document.createElement('div');
      div.className = 'cfw-chat-msg ' + msg.role;
      div.textContent = msg.text;
      els.chatMessages.appendChild(div);
    });
    els.chatMessages.scrollTop = els.chatMessages.scrollHeight;
  }

  function renderMobileTabs() {
    var tabs = [els.mobileTabChat, els.mobileTabTree, els.mobileTabMoments];
    var panels = [els.mobilePanelChat, els.mobilePanelTree, els.mobilePanelMoments];
    tabs.forEach(function (t) { if (t) t.classList.remove('active'); });
    panels.forEach(function (p) { if (p) p.classList.remove('active'); });
    var activeTab = document.querySelector('.cfw-mobile-tab[data-tab="' + state.mobileTab + '"]');
    var activePanel = document.querySelector('.cfw-mobile-panel[data-panel="' + state.mobileTab + '"]');
    if (activeTab) activeTab.classList.add('active');
    if (activePanel) activePanel.classList.add('active');
  }

  function renderAll() {
    renderTreeSummary();
    renderMomentList();
    renderSelectedMoment();
    renderChatMessages();
    renderMobileTabs();
  }

  /* ── Actions ────────────────────────────────────────────── */

  function selectMoment(momentId) {
    state.selectedMomentId = momentId;
    renderMomentList();
    renderSelectedMoment();
  }

  function transitionToWorkspace(triggerText) {
    if (state.screen === 'workspace') return;
    state.screen = 'workspace';

    // entry exit animation
    if (els.entry) els.entry.classList.add('cfw-entry-exit');

    var lovebudMsg = '좋아요! "' + triggerText + '"에 대해 이야기해볼까요?\n트리에 기록된 순간들을 보여드릴게요.';

    setTimeout(function () {
      if (els.entry) {
        els.entry.style.display = 'none';
        els.entry.classList.remove('cfw-entry-exit');
      }
      if (els.workspace) {
        els.workspace.classList.add('active', 'cfw-workspace-enter');
      }
      // initial chat message
      state.chatMessages = JSON.parse(JSON.stringify(MOCK_CHAT_HISTORY));
      addChatMessage('lovebud', lovebudMsg);
      renderAll();
    }, 300);
  }

  function addChatMessage(role, text) {
    state.chatMessages.push({ role: role, text: text });
    renderChatMessages();
  }

  function handleEntrySubmit(text) {
    var trimmed = (text || state.entryText || '').trim();
    if (!trimmed) return;

    addChatMessage('user', trimmed);
    transitionToWorkspace(trimmed);

    // Simulate lovebud response after transition
    setTimeout(function () {
      var lovebuds = [
        '이 순간을 트리에 어떻게 기록하면 좋을까요? 떠오른 감정이나 생각이 있나요?',
        '기억 속 비슷한 순간이 더 떠오르면 알려주세요. 함께 트리를 만들어가요.',
        '이 내용을 기반으로 관계 흐름을 분석해볼까요? 아니면 비슷한 순간을 더 찾아볼까요?',
      ];
      addChatMessage('lovebud', lovebuds[Math.floor(Math.random() * lovebuds.length)]);
    }, 600);
  }

  function handleChatSubmit(text) {
    var trimmed = (text || state.chatInputText || '').trim();
    if (!trimmed) return;
    addChatMessage('user', trimmed);
    if (els.chatInput) els.chatInput.value = '';
    state.chatInputText = '';

    // Simulated lovebud response
    setTimeout(function () {
      var lovebuds = [
        '그런 기억이 있었군요. 관련된 순간들을 트리에서 찾아볼게요.',
        '좋아요. 이 감정을 트리의 새 순간으로 기록해볼까요?',
        '흥미로운 점이네요. 이전 순간들과 연결되는 패턴을 발견했어요.',
      ];
      addChatMessage('lovebud', lovebuds[Math.floor(Math.random() * lovebuds.length)]);
    }, 500 + Math.random() * 800);
  }

  function openBottomSheet() {
    state.bottomSheetOpen = true;
    if (els.bottomSheet) {
      els.bottomSheet.classList.add('open');
      // Render moment detail in sheet
      var mom = MOCK_MOMENTS.find(function (m) { return m.id === state.selectedMomentId; });
      if (mom && els.bottomSheetContent) {
        els.bottomSheetContent.innerHTML =
          '<div style="font-weight:600;font-size:16px;margin-bottom:8px;">' + formatDate(mom.date) + '</div>' +
          '<div style="font-size:14px;color:var(--on-surface-variant);line-height:1.6;margin-bottom:12px;">' + mom.text + '</div>' +
          '<div style="display:flex;gap:6px;flex-wrap:wrap;">' +
          mom.tags.map(function (t) { return '<span class="cfw-moment-tag">' + t + '</span>'; }).join('') +
          '</div>' +
          '<div style="margin-top:16px;padding-top:16px;border-top:1px solid var(--lovetree-soft-surface-border);">' +
          '<div style="font-size:12px;color:var(--on-surface-note);margin-bottom:8px;">이 순간의 미니 트리</div>' +
          '<div style="display:flex;align-items:center;gap:6px;">' +
          '<div class="cfw-viz-node core"></div>' +
          '<div class="cfw-viz-edge"></div>' +
          '<div class="cfw-viz-node"></div>' +
          '<div class="cfw-viz-edge"></div>' +
          '<div class="cfw-viz-node branch"></div>' +
          '<div class="cfw-viz-edge"></div>' +
          '<div class="cfw-viz-node"></div>' +
          '</div></div>';
      }
    }
    if (els.bottomSheetOverlay) els.bottomSheetOverlay.classList.add('open');
  }

  function closeBottomSheet() {
    state.bottomSheetOpen = false;
    if (els.bottomSheet) els.bottomSheet.classList.remove('open');
    if (els.bottomSheetOverlay) els.bottomSheetOverlay.classList.remove('open');
  }

  function switchMobileTab(tab) {
    state.mobileTab = tab;
    renderMobileTabs();
  }

  function formatDate(dateStr) {
    var d = new Date(dateStr + 'T00:00:00');
    var months = ['1월', '2월', '3월', '4월', '5월', '6월', '7월', '8월', '9월', '10월', '11월', '12월'];
    return d.getFullYear() + '년 ' + months[d.getMonth()] + ' ' + d.getDate() + '일';
  }

  /* ── Event Binding ──────────────────────────────────────── */

  function bindEvents() {
    // Entry submit
    if (els.entrySubmit) {
      els.entrySubmit.addEventListener('click', function () {
        if (els.entryInput) {
          state.entryText = els.entryInput.value;
          handleEntrySubmit();
        }
      });
    }

    if (els.entryInput) {
      els.entryInput.addEventListener('keydown', function (e) {
        if (e.key === 'Enter') {
          state.entryText = els.entryInput.value;
          handleEntrySubmit();
          els.entryInput.value = '';
        }
      });
    }

    // Action chips
    if (els.entryActions) {
      els.entryActions.addEventListener('click', function (e) {
        var chip = e.target.closest('.cfw-action-chip');
        if (!chip) return;
        var text = chip.dataset.action || chip.textContent.trim();
        if (els.entryInput) els.entryInput.value = '';
        handleEntrySubmit(text);
      });
    }

    // Chat send
    if (els.chatSend) {
      els.chatSend.addEventListener('click', function () {
        if (els.chatInput) {
          state.chatInputText = els.chatInput.value;
          handleChatSubmit();
        }
      });
    }

    if (els.chatInput) {
      els.chatInput.addEventListener('keydown', function (e) {
        if (e.key === 'Enter') {
          state.chatInputText = els.chatInput.value;
          handleChatSubmit();
          els.chatInput.value = '';
        }
      });
    }

    // Chat suggestions
    if (els.chatSuggestions) {
      els.chatSuggestions.addEventListener('click', function (e) {
        var btn = e.target.closest('.cfw-chat-suggestion');
        if (!btn) return;
        handleChatSubmit(btn.textContent.trim());
      });
    }

    // Mobile tabs
    if (els.mobileTabs) {
      els.mobileTabs.addEventListener('click', function (e) {
        var tab = e.target.closest('.cfw-mobile-tab');
        if (!tab) return;
        switchMobileTab(tab.dataset.tab);
      });
    }

    // Bottom sheet
    if (els.momentStripExpand) {
      els.momentStripExpand.addEventListener('click', openBottomSheet);
    }
    if (els.bottomSheetOverlay) {
      els.bottomSheetOverlay.addEventListener('click', closeBottomSheet);
    }

    // Back to entry button in workspace
    var backBtn = document.getElementById('cfwBackToEntry');
    if (backBtn) {
      backBtn.addEventListener('click', function () {
        state.screen = 'entry';
        if (els.workspace) {
          els.workspace.classList.remove('active', 'cfw-workspace-enter');
        }
        if (els.entry) {
          els.entry.style.display = 'flex';
          els.entry.classList.add('cfw-fade-in');
        }
        state.chatMessages = JSON.parse(JSON.stringify(MOCK_CHAT_HISTORY));
        renderAll();
      });
    }

    // Keyboard close bottom sheet with Escape
    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape' && state.bottomSheetOpen) {
        closeBottomSheet();
      }
    });
  }

  /* ── Responsive tab auto-switch ─────────────────────────── */
  function handleResize() {
    var isMobile = window.innerWidth <= 768;
    if (!isMobile && state.mobileTab !== 'chat') {
      // On desktop, just show chat panel
      els.mobileTabChat = document.querySelector('.cfw-mobile-tab[data-tab="chat"]');
      state.mobileTab = 'chat';
      renderMobileTabs();
    }
  }

  /* ── Init ───────────────────────────────────────────────── */
  function init() {
    cacheDom();
    renderAll();
    bindEvents();
    window.addEventListener('resize', handleResize);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
