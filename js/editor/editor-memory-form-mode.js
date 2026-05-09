(function() {
    'use strict';

    function setText(el, text) {
        if (el) el.textContent = text;
    }

    function setInputMode(options) {
        const {
            mode,
            isFirstMoment,
            refs,
            i18n,
            hidePreview
        } = options || {};
        const currentMode = mode === 'text' ? 'text' : 'link';
        const linkMode = currentMode === 'link';

        if (refs?.modeLinkBtn) refs.modeLinkBtn.classList.toggle('is-active', linkMode);
        if (refs?.modeTextBtn) refs.modeTextBtn.classList.toggle('is-active', !linkMode);
        if (refs?.urlField) refs.urlField.classList.toggle('is-deemphasized', !linkMode);
        if (refs?.startTimeField) refs.startTimeField.style.display = linkMode ? 'block' : 'none';
        if (refs?.videoSegmentGrid) refs.videoSegmentGrid.style.display = linkMode ? 'grid' : 'none';

        if (refs?.urlInput) {
            refs.urlInput.placeholder = linkMode
                ? 'https://www.youtube.com/watch?v=...'
                : (i18n('editor_link_optional_placeholder') || '링크가 있다면 나중에 붙여도 괜찮아요');
        }

        setText(refs?.urlLabel, linkMode
            ? (i18n('editor_youtube_link') || 'YouTube 장면 링크')
            : (i18n('editor_optional_link') || '참고 링크 (선택)'));

        if (refs?.formIntro) {
            if (linkMode) {
                refs.formIntro.textContent = isFirstMoment
                    ? (i18n('editor_add_first_memory_intro') || '링크와 짧은 메모를 남기면 이 장면에서 러브트리가 시작돼요.')
                    : (i18n('editor_add_next_memory_intro') || '현재 마음에서 이어진 장면을 붙여 트리를 더 자라게 해보세요.');
            } else {
                refs.formIntro.textContent = isFirstMoment
                    ? (i18n('editor_add_first_memory_text_intro') || '링크 없이도 제목과 메모만으로 첫 순간을 심을 수 있어요.')
                    : (i18n('editor_add_next_memory_text_intro') || '짧은 제목과 메모만으로도 이어진 순간을 남길 수 있어요.');
            }
        }

        setText(refs?.supportNoteText, linkMode
            ? (i18n('editor_link_mode_help') || '링크가 있으면 대표 장면과 썸네일이 잡혀요. 제목은 자동 제안 후 직접 다듬을 수 있어요.')
            : (i18n('editor_text_mode_help') || '링크가 없어도 제목과 메모만으로 저장할 수 있어요. 카드에는 텍스트형 대표 순간이 표시돼요.'));

        if (refs?.confirmBtn) {
            if (linkMode) {
                refs.confirmBtn.textContent = isFirstMoment
                    ? (i18n('editor_confirm_add_first') || '첫 순간 심기')
                    : (i18n('editor_confirm_add_next') || '이 순간 이어가기');
            } else {
                refs.confirmBtn.textContent = isFirstMoment
                    ? (i18n('editor_confirm_add_first_text') || '이 마음으로 시작하기')
                    : (i18n('editor_confirm_add_next_text') || '이 메모 이어붙이기');
            }
        }

        if (!linkMode && typeof hidePreview === 'function') hidePreview();
        return currentMode;
    }

    window.LoveBudEditorMemoryFormMode = {
        setInputMode
    };
})();
