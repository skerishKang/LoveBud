(function() {
    'use strict';

    const COPY = {
        linkModeLabel: {
            ko: '영상·채널로 시작',
            en: 'Start with video or channel'
        },
        textModeLabel: {
            ko: '텍스트로 시작',
            en: 'Start with text'
        },
        linkPlaceholder: {
            ko: 'YouTube 영상 또는 채널 링크를 붙여넣으세요',
            en: 'Paste a YouTube video or channel link'
        },
        videoOrChannelLink: {
            ko: 'YouTube 영상 또는 채널 링크',
            en: 'YouTube video or channel link'
        },
        linkModeHelp: {
            ko: '영상 링크는 순간 미리보기로, 채널 링크는 순간의 출처 미리보기로 확인할 수 있어요. 제목과 메모는 직접 다듬어 주세요.',
            en: 'Video links open a moment preview, while channel links open a source preview. Please refine the title and note yourself.'
        },
        optionalLinkPlaceholder: {
            ko: '링크는 나중에 붙여도 괜찮아요',
            en: 'You can add a link later.'
        },
        optionalLink: {
            ko: '참고 링크 (선택)',
            en: 'Reference link (optional)'
        },
        textModeHelp: {
            ko: '링크가 없어도 제목과 메모만으로 저장할 수 있어요. 카드에는 텍스트형 대표 순간이 표시돼요.',
            en: 'You can save with only a title and note. The card will show a text-based representative moment.'
        },
        confirmAddFirst: {
            ko: '첫 순간 심기',
            en: 'Plant first moment'
        },
        confirmAddNext: {
            ko: '이 순간에서 이어가기',
            en: 'Continue from this moment'
        },
        confirmAddFirstText: {
            ko: '이 마음으로 시작하기',
            en: 'Start with this feeling'
        },
        confirmAddNextText: {
            ko: '이 메모 이어붙이기',
            en: 'Continue with this note'
        }
    };

    function setText(el, text) {
        if (el) el.textContent = text;
    }

    function getCurrentLang() {
        try {
            if (typeof window.getCurrentLang === 'function') {
                const lang = window.getCurrentLang();
                return lang === 'en' ? 'en' : 'ko';
            }
        } catch (err) {
            // Keep copy fallback safe even if the i18n runtime is unavailable.
        }
        return 'ko';
    }

    function pickCopy(copy) {
        return copy[getCurrentLang()] || copy.ko;
    }

    function translatedCopy(i18n, key, fallbackCopy) {
        const value = typeof i18n === 'function' ? i18n(key) : '';
        return value && value !== key ? value : pickCopy(fallbackCopy);
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
        if (linkModeText) linkModeText.textContent = pickCopy(COPY.linkModeLabel);
        const textModeText = refs?.modeTextBtn?.querySelector('span:last-child');
        if (textModeText) textModeText.textContent = pickCopy(COPY.textModeLabel);

        if (refs?.urlInput) {
            refs.urlInput.placeholder = linkMode
                ? pickCopy(COPY.linkPlaceholder)
                : translatedCopy(i18n, 'editor_link_optional_placeholder', COPY.optionalLinkPlaceholder);
        }

        setText(refs?.urlLabel, linkMode
            ? translatedCopy(i18n, 'editor_youtube_video_or_channel_link', COPY.videoOrChannelLink)
            : translatedCopy(i18n, 'editor_optional_link', COPY.optionalLink));

        if (refs?.formIntro) {
            refs.formIntro.textContent = '';
            refs.formIntro.style.display = 'none';
        }

        setText(refs?.supportNoteText, linkMode
            ? translatedCopy(i18n, 'editor_link_mode_video_or_channel_help', COPY.linkModeHelp)
            : translatedCopy(i18n, 'editor_text_mode_help', COPY.textModeHelp));

        if (refs?.confirmBtn) {
            if (linkMode) {
                refs.confirmBtn.textContent = isFirstMoment
                    ? translatedCopy(i18n, 'editor_confirm_add_first', COPY.confirmAddFirst)
                    : translatedCopy(i18n, 'editor_confirm_add_next', COPY.confirmAddNext);
            } else {
                refs.confirmBtn.textContent = isFirstMoment
                    ? translatedCopy(i18n, 'editor_confirm_add_first_text', COPY.confirmAddFirstText)
                    : translatedCopy(i18n, 'editor_confirm_add_next_text', COPY.confirmAddNextText);
            }
        }

        if (!linkMode && typeof hidePreview === 'function') hidePreview();
        return currentMode;
    }

    window.LoveBudEditorMemoryFormMode = {
        setInputMode
    };
})();
