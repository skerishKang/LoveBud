(function() {
  'use strict';

  var VIEW_OPTIONS_STORAGE_KEY = 'lovebud_editor_view_options_v1';
  var DEFAULT_VIEW_OPTIONS = {
    labels: true,
    tips: true,
    bubbles: true
  };

  function tText(key, fallback) {
    if (typeof window.t === 'function') {
      var translated = window.t(key);
      if (typeof translated === 'string' && translated.trim() && translated !== key) {
        return translated;
      }
    }
    return fallback;
  }

  function setText(id, key, fallback) {
    var el = document.getElementById(id);
    if (!el) return;
    el.textContent = tText(key, fallback);
  }

  function setAttr(id, attr, key, fallback) {
    var el = document.getElementById(id);
    if (!el) return;
    el.setAttribute(attr, tText(key, fallback));
  }

  function getCanonicalRootId(memories) {
    if (!Array.isArray(memories) || !memories.length) return 'root';
    var explicitRoot = memories.find(function(m) { return m && (m.parentId === null || m.parentId === undefined); });
    return explicitRoot ? explicitRoot.id : ((memories.find(function(m) { return m && m.id === 'root'; }) || {}).id || 'root');
  }

  function readViewOptions() {
    try {
      var raw = localStorage.getItem(VIEW_OPTIONS_STORAGE_KEY);
      if (!raw || raw === 'null') return Object.assign({}, DEFAULT_VIEW_OPTIONS);
      var parsed = JSON.parse(raw);
      return Object.assign({}, DEFAULT_VIEW_OPTIONS, parsed || {});
    } catch (e) {
      return Object.assign({}, DEFAULT_VIEW_OPTIONS);
    }
  }

  function writeViewOptions(options) {
    try {
      localStorage.setItem(VIEW_OPTIONS_STORAGE_KEY, JSON.stringify(options));
    } catch (e) {}
  }

  function ensureViewOptionStyles() {
    if (document.getElementById('editorViewOptionsStyles')) return;
    var style = document.createElement('style');
    style.id = 'editorViewOptionsStyles';
    style.textContent = [
      '.editor-canvas-view-options-group{position:relative;}',
      '.editor-view-options-panel{position:absolute;right:0;top:44px;width:220px;padding:12px;border-radius:16px;background:rgba(255,250,244,0.98);border:1px solid rgba(230,207,194,0.86);box-shadow:0 18px 36px rgba(75,64,57,0.16);backdrop-filter:blur(10px);z-index:30;display:flex;flex-direction:column;gap:10px;}',
      '.editor-view-options-panel[hidden]{display:none!important;}',
      '.editor-view-options-title{font-size:12px;font-weight:800;color:var(--primary);letter-spacing:-0.02em;margin-bottom:2px;}',
      '.editor-view-option-row{display:flex;align-items:center;gap:8px;font-size:12px;font-weight:700;color:var(--on-surface);line-height:1.4;cursor:pointer;user-select:none;}',
      '.editor-view-option-row input{width:15px;height:15px;accent-color:var(--primary);}',
      '.editor-view-options-help{font-size:11px;line-height:1.5;color:var(--on-surface-variant);border-top:1px solid rgba(221,198,184,0.55);padding-top:9px;}',
      'body.editor-view-hide-labels .memory-node .node-info-label{display:none!important;}',
      'body.editor-view-hide-tips .memory-add-affordance,body.editor-view-hide-tips .branch-line-affordance{display:none!important;pointer-events:none!important;}',
      // body.editor-view-hide-bubbles rules moved to
      // css/editor/editor-canvas-affordance.css so the cascade order matches
      // the .affordance-expanded transition pipeline and the inline !important
      // override no longer fights the new width/height transitions (#2806).
      '.editor-view-option-row input:disabled{opacity:0.35;cursor:not-allowed;}',
      '.editor-view-option-row input:disabled~span{opacity:0.35;}',
      '@media (max-width:768px){.editor-view-options-panel{right:auto;left:0;top:42px;width:210px;}}'
    ].join('\n');
    document.head.appendChild(style);
  }

  function applyViewOptions(options) {
    var opts = Object.assign({}, DEFAULT_VIEW_OPTIONS, options || {});
    document.body.classList.toggle('editor-view-hide-labels', !opts.labels);
    document.body.classList.toggle('editor-view-hide-tips', !opts.tips);
    document.body.classList.toggle('editor-view-hide-bubbles', !opts.bubbles);

    var labelsInput = document.getElementById('editorViewOptionLabels');
    var tipsInput = document.getElementById('editorViewOptionTips');
    var bubblesInput = document.getElementById('editorViewOptionBubbles');
    var allInput = document.getElementById('editorViewOptionAll');

    if (labelsInput) labelsInput.checked = !!opts.labels;
    if (tipsInput) tipsInput.checked = !!opts.tips;
    if (bubblesInput) bubblesInput.checked = !!opts.bubbles;
    if (allInput) {
      allInput.checked = !!(opts.labels && opts.tips && opts.bubbles);
      allInput.indeterminate = !(opts.labels && opts.tips && opts.bubbles) && !!(opts.labels || opts.tips || opts.bubbles);
    }

    var viewBtn = document.getElementById('editorViewOptionsBtn');
    if (viewBtn) {
      var isDefault = !!(opts.labels && opts.tips && opts.bubbles);
      viewBtn.classList.toggle('is-active', !isDefault);
      viewBtn.setAttribute('aria-pressed', isDefault ? 'false' : 'true');
    }

    if (bubblesInput && tipsInput) {
      var tipsOff = !opts.tips;
      bubblesInput.disabled = tipsOff;
      if (tipsOff) bubblesInput.checked = false;
    }
  }

  function setViewOptions(nextOptions) {
    var options = Object.assign({}, DEFAULT_VIEW_OPTIONS, nextOptions || {});
    writeViewOptions(options);
    applyViewOptions(options);
  }

  function closeViewOptionsPanel() {
    var panel = document.getElementById('editorViewOptionsPanel');
    var button = document.getElementById('editorViewOptionsBtn');
    if (panel) panel.hidden = true;
    if (button) button.setAttribute('aria-expanded', 'false');
  }

  function ensureViewOptionsControl() {
    var toolbar = document.querySelector('.editor-canvas-toolbar');
    if (!toolbar || document.getElementById('editorViewOptionsBtn')) {
      applyViewOptions(readViewOptions());
      return;
    }

    ensureViewOptionStyles();

    var separator = document.createElement('div');
    separator.className = 'editor-canvas-toolbar-separator editor-view-options-separator';
    separator.setAttribute('aria-hidden', 'true');

    var group = document.createElement('div');
    group.className = 'editor-canvas-toolbar-group editor-canvas-view-options-group';
    group.setAttribute('aria-label', tText('editor_view_options_group', '보기 옵션'));

    var button = document.createElement('button');
    button.type = 'button';
    button.className = 'editor-canvas-tool-btn editor-canvas-tool-btn-wide';
    button.id = 'editorViewOptionsBtn';
    button.setAttribute('aria-label', tText('editor_view_options', '보기 옵션'));
    button.setAttribute('title', tText('editor_view_options', '보기 옵션'));
    button.setAttribute('aria-expanded', 'false');
    button.setAttribute('aria-controls', 'editorViewOptionsPanel');
    button.innerHTML = '<span class="material-symbols-outlined" aria-hidden="true">visibility</span><span class="editor-canvas-tool-label" id="editorViewOptionsBtnLabel">' + tText('editor_view_options_short', '보기') + '</span>';

    var panel = document.createElement('div');
    panel.id = 'editorViewOptionsPanel';
    panel.className = 'editor-view-options-panel';
    panel.hidden = true;
    panel.innerHTML = [
      '<div class="editor-view-options-title" id="editorViewOptionsTitle">' + tText('editor_view_options_title', '캔버스 표시') + '</div>',
      '<label class="editor-view-option-row"><input type="checkbox" id="editorViewOptionAll"> <span>' + tText('editor_view_option_all', '전체 표시') + '</span></label>',
      '<label class="editor-view-option-row"><input type="checkbox" id="editorViewOptionLabels"> <span>' + tText('editor_view_option_labels', '순간 제목·날짜') + '</span></label>',
      '<label class="editor-view-option-row"><input type="checkbox" id="editorViewOptionTips"> <span>' + tText('editor_view_option_tips', '이어가기 팁') + '</span></label>',
      '<label class="editor-view-option-row"><input type="checkbox" id="editorViewOptionBubbles"> <span>' + tText('editor_view_option_bubbles', '말풍선 설명') + '</span></label>',
      '<div class="editor-view-options-help">' + tText('editor_view_options_help', '표시 옵션은 에디터 화면에만 적용되고<br>트리 데이터는 바꾸지 않아요.') + '</div>'
    ].join('');

    group.appendChild(button);
    group.appendChild(panel);

    var compactGroup = document.getElementById('compactModeToggleBtn');
    var compactParent = compactGroup ? compactGroup.closest('.editor-canvas-toolbar-group') : null;
    if (compactParent) {
      toolbar.insertBefore(separator, compactParent);
      toolbar.insertBefore(group, compactParent);
    } else {
      toolbar.appendChild(separator);
      toolbar.appendChild(group);
    }

    button.addEventListener('click', function(event) {
      event.preventDefault();
      event.stopPropagation();
      var isOpen = panel.hidden;
      panel.hidden = !isOpen;
      button.setAttribute('aria-expanded', isOpen ? 'true' : 'false');
    });

    panel.addEventListener('click', function(event) {
      event.stopPropagation();
    });

    document.addEventListener('click', function(event) {
      if (!group.contains(event.target)) closeViewOptionsPanel();
    });

    document.addEventListener('keydown', function(event) {
      if (event.key === 'Escape') closeViewOptionsPanel();
    });

    var labelsInput = document.getElementById('editorViewOptionLabels');
    var tipsInput = document.getElementById('editorViewOptionTips');
    var bubblesInput = document.getElementById('editorViewOptionBubbles');
    var allInput = document.getElementById('editorViewOptionAll');

    function readInputs() {
      return {
        labels: !!(labelsInput && labelsInput.checked),
        tips: !!(tipsInput && tipsInput.checked),
        bubbles: !!(bubblesInput && bubblesInput.checked)
      };
    }

    if (tipsInput) {
      tipsInput.addEventListener('change', function() {
        setViewOptions(readInputs());
      });
    }

    if (bubblesInput) {
      bubblesInput.addEventListener('change', function() {
        if (tipsInput && !tipsInput.checked) {
          bubblesInput.checked = false;
          if (window.LoveBudUI && typeof window.LoveBudUI.showToast === 'function') {
            window.LoveBudUI.showToast('"이어가기 팁"을 먼저 켜주세요', 'warning', 3000);
          }
          return;
        }
        setViewOptions(readInputs());
      });
    }

    if (labelsInput) {
      labelsInput.addEventListener('change', function() {
        setViewOptions(readInputs());
      });
    }

    if (allInput) {
      allInput.addEventListener('change', function() {
        var checked = !!allInput.checked;
        setViewOptions({ labels: checked, tips: checked, bubbles: checked });
      });
    }

    // Initial sync: if tips is off, disable bubbles
    if (bubblesInput && tipsInput) {
      bubblesInput.disabled = !tipsInput.checked;
      if (!tipsInput.checked) bubblesInput.checked = false;
    }

    applyViewOptions(readViewOptions());
  }

  function updateViewOptionsLanguage() {
    var btnLabel = document.getElementById('editorViewOptionsBtnLabel');
    var btn = document.getElementById('editorViewOptionsBtn');
    if (btnLabel) btnLabel.textContent = tText('editor_view_options_short', '보기');
    if (btn) {
      btn.setAttribute('aria-label', tText('editor_view_options', '보기 옵션'));
      btn.setAttribute('title', tText('editor_view_options', '보기 옵션'));
    }
    var title = document.getElementById('editorViewOptionsTitle');
    if (title) title.textContent = tText('editor_view_options_title', '캔버스 표시');
  }

  function updateEditorDynamicSummary() {
    var memories = Array.isArray(window.currentTreeMemories) ? window.currentTreeMemories : [];
    var rootId = getCanonicalRootId(memories);
    var count = memories.filter(function(m) { return m && m.id !== rootId; }).length;

    var flowSummaryEl = document.getElementById('sidebarFlowSummary');
    if (flowSummaryEl) {
      var currentTreeData = window.currentTreeData || {};
      var timeRange = String(currentTreeData.timeRange || currentTreeData.time_range || '').trim();
      var titleText = String(currentTreeData.title || '').trim() || '러브트리';

      if (!count) {
        flowSummaryEl.textContent = tText('editor_tree_status_empty', '아직 첫 순간을 기다리고 있어요.');
      } else {
        if (timeRange) {
          flowSummaryEl.innerHTML = tText('sidebar_flow_summary_connected_with_range', '<span class="preview-summary-line"><strong>{title}</strong>에 담긴 <strong>{count}개의 순간</strong>이 <strong>{timeRange}</strong>에 걸쳐 이어졌어요.</span>')
            .replace('{title}', escapeHtml(titleText))
            .replace('{count}', String(count))
            .replace('{timeRange}', escapeHtml(timeRange));
        } else {
          flowSummaryEl.innerHTML = tText('sidebar_flow_summary_connected', '<span class="preview-summary-line"><strong>{title}</strong>에 담긴 <strong>{count}개의 순간</strong>이 이어졌어요.</span>')
            .replace('{title}', escapeHtml(titleText))
            .replace('{count}', String(count));
        }
      }
    }
  }

  function refreshEditorLanguage() {
    if (typeof window.applyI18n === 'function') {
      window.applyI18n();
    }

    document.title = tText('nav.editor', '러브트리 편집') + ' | LoveTree';

    setText('editorFlowHeading', 'sidebar_flow_heading', '트리 정보');
    setText('editorFlowLead', 'sidebar_flow_lead', '이 트리의 제목과 이어진 순간 흐름을 확인하고 있어요.');
    setText('focusSelectedBtnLabel', 'sidebar_focus_selected', '선택한 순간 보기');
    setText('recenterCanvasBtnLabel', 'sidebar_recenter_tree', '트리 한눈에 보기');
    setText('addMemoryEyebrow', 'editor_add_memory_eyebrow', '다음 순간 심기');
    setText('addMemoryIntro', 'editor_add_memory_intro', '지금 선택한 순간 다음에 새로운 장면을 이어 심어 보세요. 첫 순간이라면 여기서 러브트리가 시작됩니다.');
    setText('addMemoryBtnLabel', 'editor_add_memory', '새 순간 이어가기');
    setText('addMemoryFormTitle', 'editor_new_memory', '어떤 순간이 이어졌나요?');
    setText('memoryUrlLabel', 'editor_youtube_link', 'YouTube 장면 링크');
    setText('memoryTitleLabel', 'editor_memory_title', '순간 제목');
    setText('memoryTagsLabel', 'editor_edit_tag_label', '감정 태그 (쉼표로 구분)');
    setAttr('memoryTagsInput', 'placeholder', 'editor_edit_tag_placeholder', '#감동, #행복, #그리움');
    setText('memoryMemoLabel', 'editor_memory_memo_optional', '감정 메모');
    setText('cancelAddMemory', 'editor_cancel', '취소');
    setText('confirmAddMemory', 'editor_confirm_add', '이 순간 심기');
    setText('detailEmptyTitle', 'detail_empty_title', '첫 순간이 트리를 깨워요');
    setText('detailEmptyDesc', 'detail_empty_desc', '왼쪽 아래 버튼으로 첫 장면을 심으면, 이 패널이 현재 순간 허브로 바뀝니다.');
    setText('detailCurrentMomentBadge', 'editor_current_moment_badge', '현재 순간');
    setText('detailTreeStatusLabel', 'current_tree', '현재 트리');
    setText('detailMomentInfoLabel', 'editor_moment_info_label', '순간 정보');
    setText('detailDateLabel', 'editor_date_label', '기억한 날');
    setText('detailTagsLabel', 'editor_tag_label', '감정 태그');
    setText('detailMemoLabel', 'editor_note_label', '감정 메모');
    setText('detailActionLabel', 'editor_action_label', '이 순간에서 할 수 있는 일');
    setText('editMemoryBtn', 'editor_edit', '순간 수정');
    setText('editMemoryBtnLabel', 'editor_edit', '순간 수정');
    setText('viewMomentDetailBtnLabel', 'editor_view_moment_detail', '현재 순간 감상하기');
    setText('continueFromMomentBtnLabel', 'editor_continue_from_moment', '이 순간에서 이어가기');
    setText('detailActionsPrimaryLabel', 'editor_actions_primary', '주요 행동');
    setText('deleteMemoryBtn', 'editor_delete', '순간 삭제');
    setText('editTitleLabel', 'editor_memory_title', '순간 제목');
    setText('editMemoLabel', 'editor_note_label', '감정 메모');
    setText('editTagsLabel', 'editor_edit_tag_label', '감정 태그 (쉼표로 구분)');
    setText('cancelEditBtn', 'editor_cancel', '취소');
    setText('saveEditBtn', 'editor_save', '저장하기');

    setAttr('renameTreeBtn', 'aria-label', 'editor_rename_tree', '트리 제목 수정');
    setAttr('renameTreeBtn', 'title', 'editor_rename_tree', '트리 제목 수정');

    var playBtn = document.querySelector('.play-btn');
    if (playBtn) {
      playBtn.textContent = tText('play', '재생');
      playBtn.setAttribute('aria-label', tText('play', '재생'));
    }

    var saveStatusText = document.getElementById('saveStatusText');
    if (saveStatusText) {
      var raw = (saveStatusText.textContent || '').trim();
      if (!raw || raw === '저장됨' || raw === 'Saved') {
        saveStatusText.textContent = tText('save_saved', '저장됨');
      } else if (raw === '저장 중...' || raw === 'Saving...') {
        saveStatusText.textContent = tText('save_saving', '저장 중...');
      } else if (raw === '저장 실패' || raw === 'Save failed') {
        saveStatusText.textContent = tText('save_failed', '저장 실패');
      }
    }

    ensureViewOptionsControl();
    updateViewOptionsLanguage();
    updateEditorDynamicSummary();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', refreshEditorLanguage, { once: true });
  } else {
    refreshEditorLanguage();
  }

  if (!window.__lovebudEditorLangRefreshBound) {
    window.__lovebudEditorLangRefreshBound = true;
    window.addEventListener('lovebud-lang-change', function() {
      refreshEditorLanguage();
    });
  }
})();
