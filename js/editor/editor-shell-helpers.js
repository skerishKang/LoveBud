// Editor Shell Helpers - Entry-only shell utilities
// Provides fallbacks and utilities for editor initialization without affecting runtime behavior

window.LoveBudEditorShellHelpers = {
    // i18n utility
    getI18n: function() {
        return window.t || ((k) => k);
    },

    // Editor base path utilities
    getEditorBasePath: function() {
        return window.location.pathname.indexOf('/pages/') !== -1 ? '' : 'pages/';
    },

    buildEditorRedirectTarget: function() {
        return this.getEditorBasePath() + 'editor.html' + (window.location.search || '');
    },

    // Toast fallback
    createInlineShowToastFallback: function() {
        return (message, type = 'info') => {
            if (window.LoveBudUI?.showToast) {
                window.LoveBudUI.showToast(message, type, 3000);
            } else {
                if (!window.__editorToastWarningShown) {
                    console.warn('[editor] LoveBudUI not loaded, toast degraded to console');
                    window.__editorToastWarningShown = true;
                }
                console.log(`[Toast ${type}] ${message}`);
            }
        };
    },

    // Shell copy application
    applyEditorShellCopy: function(safeI18nText, i18n) {
        const setText = (id, key, fallback) => {
            const el = document.getElementById(id);
            if (!el) return;
            el.textContent = safeI18nText(i18n, key, fallback);
        };
        const setPlaceholder = (id, key, fallback) => {
            const el = document.getElementById(id);
            if (!el) return;
            el.setAttribute('placeholder', safeI18nText(i18n, key, fallback));
        };

        setText('backToMyTreesLabel', 'editor_back_to_my_trees', '내 러브트리로 돌아가기');
        setText('editorFlowHeading', 'sidebar_flow_heading', '트리 정보');
        setText('editorFlowLead', 'sidebar_flow_lead', '트리 이름과 공개 상태를 여기서 정리하고, 가운데 캔버스에서는 흐름만 살펴보세요.');
        setText('sidebarVisibilityToggleBtnLabel', 'editor_make_public', '이 트리 공개하기');
        setText('recenterCanvasBtnLabel', 'sidebar_recenter_tree', '트리 한눈에 보기');
        setText('addMemoryEyebrow', 'editor_add_memory_eyebrow', '다음 순간 심기');
        setText('addMemoryIntro', 'editor_add_memory_intro', '지금 마음이 머문 다음 장면을 이어 심어 보세요. 첫 순간이라면 여기서 러브트리가 시작됩니다.');
        setText('saveStatusText', 'save_saved', '저장됨');
        setText('detailMoreBtn', 'editor_open_detail', '상세로 보기');
        setText('detailEmptyStartBtn', 'editor_add_first_memory', '첫 순간 심기');
        setText('canvasEmptyGuideEyebrow', 'editor_canvas_empty_eyebrow', '첫 순간 준비');
        setText('canvasEmptyGuideTitle', 'editor_canvas_empty_title', '이 장면에서 러브트리가 시작돼요');
        setText('canvasEmptyGuideDesc', 'editor_canvas_empty_desc', '첫 순간을 심으면 이 공간에 감정의 흐름이 천천히 뻗어나갑니다.');
        setText('canvasEmptyStartBtn', 'editor_add_first_memory', '첫 순간 심기');
        setText('addMemoryFormEyebrow', 'editor_add_first_memory', '첫 순간 심기');
        setText('addMemoryFormTitle', 'editor_new_memory', '어떤 순간이 이어졌나요?');
        setText('addMemoryFormIntro', 'editor_add_memory_intro', '지금 마음이 머문 다음 장면을 이어 심어 보세요. 첫 순간이라면 여기서 러브트리가 시작됩니다.');
        setText('memoryUrlLabel', 'editor_youtube_link', 'YouTube 장면 링크');
        setText('memoryTitleLabel', 'editor_memory_title', '순간 제목');
        setText('memoryMemoLabel', 'editor_memory_memo_optional', '감정 메모');
        setText('cancelAddMemory', 'editor_cancel', '취소');
        setText('confirmAddMemory', 'editor_confirm_add', '이 순간 심기');
        setPlaceholder('memoryTitleInput', 'editor_memory_title_placeholder', '이 순간을 어떻게 기억하고 싶은지 적어보세요');
        setPlaceholder('memoryMemoInput', 'editor_memory_memo_placeholder', '왜 이 장면이 이어졌는지, 지금 마음을 남겨보세요...');
        setText('detailEmptyTitle', 'detail_empty_title', '첫 순간이 트리를 깨워요');
        setText('detailEmptyDesc', 'detail_empty_desc', '첫 순간을 심으면 이 패널이 현재 순간 허브로 바뀝니다.');
        setText('detailCurrentMomentBadge', 'editor_current_moment_badge', '현재 순간');
        setText('detailCurrentMomentTitle', 'editor_current_moment_title', '지금 마음이 머문 장면');
        setText('detailCurrentMomentHint', 'editor_current_moment_hint', '선택한 순간을 중심으로 감정 메모와 다음 행동이 정리됩니다.');
        setText('detailMomentInfoLabel', 'editor_moment_info_label', '순간 정보');
        setText('detailTreeStatusLabel', 'current_tree', '현재 트리');
        setText('detailDateLabel', 'editor_date_label', '기억한 날');
        setText('detailTagsLabel', 'editor_tag_label', '감정 태그');
        setText('detailMemoLabel', 'editor_note_label', '감정 메모');
        setText('editMemoryBtn', 'editor_edit', '순간 수정');
        setText('deleteMemoryBtn', 'editor_delete', '순간 삭제');
        setText('editTitleLabel', 'editor_memory_title', '제목');
        setText('editMemoLabel', 'editor_note_label', '감정 메모');
        setText('editTagsLabel', 'editor_edit_tag_label', '감정 태그 (쉼표로 구분)');
        setPlaceholder('editTitleInput', 'editor_edit_title_placeholder', '순간의 제목을 입력하세요');
        setPlaceholder('editMemoInput', 'editor_memory_memo_placeholder', '이 순간의 감정을 남겨보세요...');
        setPlaceholder('editTagsInput', 'editor_edit_tag_placeholder', '#감동, #행복, #그리움');
        setText('cancelEditBtn', 'editor_cancel', '취소');
        setText('saveEditBtn', 'editor_save', '저장하기');
        setText('detailSubmitBtn', 'editor_record_submit', '내 러브트리에 기록하기');
    }
};