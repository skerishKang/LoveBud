(function() {
  'use strict';

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

  function updateEditorDynamicSummary() {
    var memories = Array.isArray(window.currentTreeMemories) ? window.currentTreeMemories : [];
    var rootId = getCanonicalRootId(memories);
    var selectedNodeEl = document.querySelector('.memory-node.selected');
    var selectedId = selectedNodeEl ? selectedNodeEl.getAttribute('data-memory-id') : rootId;
    var selectedMemory = memories.find(function(m) { return m && m.id === selectedId; }) || memories.find(function(m) { return m && m.id === rootId; }) || null;
    var count = memories.filter(function(m) { return m && m.id !== rootId; }).length;

    var momentCountEl = document.getElementById('sidebarMomentCount');
    if (momentCountEl) {
      momentCountEl.textContent = tText('sidebar_moment_count', '순간 {count}개가 이어지고 있어요').replace('{count}', String(count));
    }

    var flowSummaryEl = document.getElementById('sidebarFlowSummary');
    if (flowSummaryEl) {
      if (!count) {
        flowSummaryEl.textContent = tText('sidebar_flow_summary_empty', '첫 기억이 심어지면 이곳에 감정의 흐름이 차곡차곡 쌓여요.');
      } else if (selectedMemory && selectedMemory.title) {
        flowSummaryEl.textContent = tText('sidebar_flow_summary_selected', '지금은 "{title}" 순간에 마음이 머물러 있어요.').replace('{title}', selectedMemory.title);
      } else {
        flowSummaryEl.textContent = tText('sidebar_flow_summary_connected', '{count}개의 순간이 하나의 러브트리로 차곡차곡 이어지고 있어요.').replace('{count}', String(count));
      }
    }

    var selectionHintEl = document.getElementById('sidebarSelectionHint');
    if (selectionHintEl) {
      if (!selectedMemory) {
        selectionHintEl.textContent = tText('sidebar_first_moment_hint', '첫 순간을 추가해 트리를 시작해 보세요.');
      } else if (selectedMemory.id === rootId) {
        selectionHintEl.textContent = tText('root_moment_hint', '이 순간은 현재 트리의 시작점입니다');
      } else {
        selectionHintEl.textContent = tText('path_moment_hint', '이 순간은 감정 경로 안에 연결되어 있습니다');
      }
    }
  }

  function refreshEditorLanguage() {
    if (typeof window.applyI18n === 'function') {
      window.applyI18n();
    }

    document.title = tText('nav.editor', '러브트리 편집') + ' | LoveTree';

    setText('editorFlowHeading', 'sidebar_flow_heading', '트리를 키워가요');
    setText('editorFlowLead', 'sidebar_flow_lead', '지금 마음이 머문 순간을 하나씩 이어 붙이며 나만의 흐름을 키워보세요.');
    setText('focusSelectedBtnLabel', 'sidebar_focus_selected', '선택한 순간 보기');
    setText('recenterCanvasBtnLabel', 'sidebar_recenter_tree', '트리 한눈에 보기');
    setText('addMemoryEyebrow', 'editor_add_memory_eyebrow', '다음 순간 심기');
    setText('addMemoryIntro', 'editor_add_memory_intro', '지금 선택한 순간 다음에 새로운 장면을 이어 심어 보세요. 첫 순간이라면 여기서 러브트리가 시작됩니다.');
    setText('addMemoryBtnLabel', 'editor_add_memory', '새 순간 이어가기');
    setText('addMemoryFormTitle', 'editor_new_memory', '어떤 순간이 이어졌나요?');
    setText('memoryUrlLabel', 'editor_youtube_link', 'YouTube 장면 링크');
    setText('memoryTitleLabel', 'editor_memory_title', '순간 제목');
    setText('memoryMemoLabel', 'editor_memory_memo_optional', '감정 메모');
    setText('cancelAddMemory', 'editor_cancel', '취소');
    setText('confirmAddMemory', 'editor_confirm_add', '이 순간 심기');
    setText('detailMoreBtn', 'more', '더보기');
    setText('detailEmptyTitle', 'detail_empty_title', '첫 순간이 트리를 깨워요');
    setText('detailEmptyDesc', 'detail_empty_desc', '왼쪽의 "새 순간 이어가기"로 첫 장면을 심으면, 이 패널이 현재 순간 허브로 바뀝니다.');
    setText('detailCurrentMomentBadge', 'editor_current_moment_badge', '현재 순간');
    setText('detailCurrentMomentHint', 'editor_current_moment_hint', '선택한 순간을 중심으로 감정 메모와 다음 행동이 정리됩니다.');
    setText('detailTreeStatusLabel', 'current_tree', '트리 상태');
    setText('detailMomentInfoLabel', 'editor_moment_info_label', '순간 정보');
    setText('detailDateLabel', 'editor_date_label', '기억한 날');
    setText('detailTagsLabel', 'editor_tag_label', '감정 태그');
    setText('detailMemoLabel', 'editor_note_label', '감정 메모');
    setText('detailActionLabel', 'editor_action_label', '이 순간에서 할 수 있는 일');
    setText('editMemoryBtn', 'editor_edit', '순간 수정');
    setText('deleteMemoryBtn', 'editor_delete', '순간 삭제');
    setText('editTitleLabel', 'editor_memory_title', '제목');
    setText('editMemoLabel', 'editor_note_label', '감정 메모');
    setText('editTagsLabel', 'editor_edit_tag_label', '감정 태그 (쉼표로 구분)');
    setText('cancelEditBtn', 'editor_cancel', '취소');
    setText('saveEditBtn', 'editor_save', '저장하기');
    setText('detailSubmitBtn', 'editor_record_submit', '내 러브트리에 기록하기');

    setAttr('renameTreeBtn', 'aria-label', 'rename_tree_prompt', '새 트리 제목을 입력해 주세요.');
    setAttr('renameTreeBtn', 'title', 'rename_tree_prompt', '새 트리 제목을 입력해 주세요.');
    setAttr('detailMoreBtn', 'aria-label', 'more', '더보기');

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
