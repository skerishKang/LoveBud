(function() {
    const createEditorShellCopyApplier = ({ safeI18nText, i18n }) => {
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

        const textBindings = [
            ['backToMyTreesLabel', 'editor_back_to_my_trees', '내 러브트리로 돌아가기'],
            ['editorFlowHeading', 'sidebar_flow_heading', '트리 정보'],
            ['editorFlowLead', 'sidebar_flow_lead', '첫 순간부터 지금까지 이어진 마음을 확인하고 있어요.'],
            ['sidebarVisibilityToggleBtnLabel', 'editor_make_public', '이 트리 공개하기'],
            ['recenterCanvasBtnLabel', 'sidebar_recenter_tree', '트리 한눈에 보기'],
            ['addMemoryEyebrow', 'editor_add_memory_eyebrow', '다음 순간 심기'],
            ['addMemoryIntro', 'editor_add_memory_intro', '지금 마음이 머문 다음 장면을 이어 심어 보세요. 첫 순간이라면 여기서 러브트리가 시작됩니다.'],
            ['saveStatusText', 'save_saved', '저장됨'],
            ['detailMoreBtn', 'editor_open_detail', '상세로 보기'],
            ['detailEmptyStartBtn', 'editor_add_first_memory', '첫 순간 심기'],
            ['canvasEmptyGuideEyebrow', 'editor_canvas_empty_eyebrow', '첫 순간 준비'],
            ['canvasEmptyGuideTitle', 'editor_canvas_empty_title', '이 장면에서 러브트리가 시작돼요'],
            ['canvasEmptyGuideDesc', 'editor_canvas_empty_desc', '첫 순간을 심으면 이 공간에 감정의 흐름이 천천히 뻗어나갑니다.'],
            ['canvasEmptyStartBtn', 'editor_add_first_memory', '첫 순간 심기'],
            ['addMemoryFormEyebrow', 'editor_add_first_memory', '첫 순간 심기'],
            ['addMemoryFormTitle', 'editor_new_memory', '어떤 순간이 이어졌나요?'],
            ['addMemoryFormIntro', 'editor_add_memory_intro', '지금 마음이 머문 다음 장면을 이어 심어 보세요. 첫 순간이라면 여기서 러브트리가 시작됩니다.'],
            ['memoryUrlLabel', 'editor_youtube_link', 'YouTube 장면 링크'],
            ['memoryTitleLabel', 'editor_memory_title', '순간 제목'],
            ['memoryTagsLabel', 'editor_edit_tag_label', '감정 태그 (쉼표로 구분)'],
            ['memoryMemoLabel', 'editor_memory_memo_optional', '감정 메모'],
            ['cancelAddMemory', 'editor_cancel', '취소'],
            ['confirmAddMemory', 'editor_confirm_add', '이 순간 심기'],
            ['detailEmptyTitle', 'detail_empty_title', '첫 순간이 트리를 깨워요'],
            ['detailEmptyDesc', 'detail_empty_desc', '첫 순간을 심으면 이 패널이 현재 순간 허브로 바뀝니다.'],
            ['detailCurrentMomentBadge', 'editor_current_moment_badge', '현재 순간'],
            ['detailCurrentMomentTitle', 'editor_current_moment_title', '지금 마음이 머문 장면'],
            ['detailCurrentMomentHint', 'editor_current_moment_hint', '선택한 순간을 중심으로 감정 메모와 다음 행동이 정리됩니다.'],
            ['detailMomentInfoLabel', 'editor_moment_info_label', '순간 정보'],
            ['detailTreeStatusLabel', 'current_tree', '현재 트리'],
            ['detailDateLabel', 'editor_date_label', '기억한 날'],
            ['detailTagsLabel', 'editor_tag_label', '감정 태그'],
            ['detailMemoLabel', 'editor_note_label', '감정 메모'],
            ['editMemoryBtn', 'editor_edit', '순간 수정'],
            ['editMemoryBtnLabel', 'editor_edit', '순간 수정'],
            ['viewMomentDetailBtnLabel', 'editor_view_moment_detail', '현재 순간 감상하기'],
            ['continueFromMomentBtnLabel', 'editor_continue_from_moment', '이 순간에서 이어가기'],
            ['detailActionsPrimaryLabel', 'editor_actions_primary', '이 순간에서'],
            ['deleteMemoryBtn', 'editor_delete', '순간 삭제'],
            ['editTitleLabel', 'editor_memory_title', '제목'],
            ['editMemoLabel', 'editor_note_label', '감정 메모'],
            ['editTagsLabel', 'editor_edit_tag_label', '감정 태그 (쉼표로 구분)'],
            ['cancelEditBtn', 'editor_cancel', '취소'],
            ['saveEditBtn', 'editor_save', '저장하기']
        ];

        const placeholderBindings = [
            ['memoryTitleInput', 'editor_memory_title_placeholder', '이 순간을 어떻게 기억하고 싶은지 적어보세요'],
            ['memoryTagsInput', 'editor_edit_tag_placeholder', '#감동, #행복, #그리움'],
            ['memoryMemoInput', 'editor_memory_memo_placeholder', '왜 이 장면이 이어졌는지, 지금 마음을 남겨보세요...'],
            ['editTitleInput', 'editor_edit_title_placeholder', '순간의 제목을 입력하세요'],
            ['editMemoInput', 'editor_memory_memo_placeholder', '이 순간의 감정을 남겨보세요...'],
            ['editTagsInput', 'editor_edit_tag_placeholder', '#감동, #행복, #그리움']
        ];

        return () => {
            textBindings.forEach(([id, key, fallback]) => setText(id, key, fallback));
            placeholderBindings.forEach(([id, key, fallback]) => setPlaceholder(id, key, fallback));
        };
    };

    const createPrepareEditorShell = ({ applyEditorShellCopy, safeI18nText, i18n, getMyTreesHref }) => {
        return () => {
            applyEditorShellCopy(safeI18nText, i18n);
            const backToMyTreesLink = document.getElementById('backToMyTreesLink');
            if (backToMyTreesLink) {
                backToMyTreesLink.setAttribute('href', getMyTreesHref());
                backToMyTreesLink.setAttribute('aria-label', safeI18nText(i18n, 'editor_back_to_my_trees', '내 러브트리로 돌아가기'));
            }
            const detailEmptyState = document.getElementById('detailEmptyState');
            const detailViewMode = document.getElementById('detailViewMode');
            const detailEditMode = document.getElementById('detailEditMode');
            if (detailEmptyState) detailEmptyState.style.display = 'block';
            if (detailViewMode) detailViewMode.style.display = 'none';
            if (detailEditMode) detailEditMode.style.display = 'none';
        };
    };

    window.LoveBudEditorShellCopyApplier = {
        createEditorShellCopyApplier,
        createPrepareEditorShell
    };
})();
