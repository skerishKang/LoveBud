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

        const linkModeText = refs?.modeLinkBtn?.querySelector('span:last-child');
        if (linkModeText) linkModeText.textContent = '영상·채널로 시작';
        const textModeText = refs?.modeTextBtn?.querySelector('span:last-child');
        if (textModeText) textModeText.textContent = '텍스트로 시작';

        if (refs?.urlInput) {
            refs.urlInput.placeholder = linkMode
                ? 'YouTube 영상 또는 채널 링크를 붙여넣으세요'
                : (i18n('editor_link_optional_placeholder') || '링크는 나중에 붙여도 괜찮아요');
        }

        setText(refs?.urlLabel, linkMode
            ? (i18n('editor_youtube_video_or_channel_link') || 'YouTube 영상 또는 채널 링크')
            : (i18n('editor_optional_link') || '참고 링크 (선택)'));

        if (refs?.formIntro) {
            refs.formIntro.textContent = '';
            refs.formIntro.style.display = 'none';
        }

        setText(refs?.supportNoteText, linkMode
            ? (i18n('editor_link_mode_video_or_channel_help') || '영상 링크는 순간 미리보기로, 채널 링크는 순간의 출처 미리보기로 확인할 수 있어요. 제목과 메모는 직접 다듬어 주세요.')
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