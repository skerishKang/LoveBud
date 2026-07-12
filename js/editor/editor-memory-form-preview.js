(function() {
    'use strict';

    const DEFAULT_START_TIME_HINT = '순간의 시작과 끝 시간을 입력하세요.';
    const SOURCE_PREVIEW_START_TIME_HINT = '채널은 영상 순간의 출처로만 미리 볼 수 있어요.';
    const SOURCE_PREVIEW_CONFIRM_TEXT = '출처 미리보기 중';

    function setPreviewConfirmState(refs, isSourcePreview) {
        const confirmBtn = refs?.confirmBtn;
        if (!confirmBtn) return;

        if (isSourcePreview) {
            if (!confirmBtn.dataset.sourcePreviewPreviousText) {
                confirmBtn.dataset.sourcePreviewPreviousText = confirmBtn.textContent || '';
            }
            confirmBtn.textContent = SOURCE_PREVIEW_CONFIRM_TEXT;
            confirmBtn.disabled = true;
            confirmBtn.setAttribute('aria-disabled', 'true');
            confirmBtn.classList.add('is-source-record-preview-disabled');
            return;
        }

        if (confirmBtn.dataset.sourcePreviewPreviousText) {
            confirmBtn.textContent = confirmBtn.dataset.sourcePreviewPreviousText;
            delete confirmBtn.dataset.sourcePreviewPreviousText;
        }
        confirmBtn.disabled = false;
        confirmBtn.removeAttribute('aria-disabled');
        confirmBtn.classList.remove('is-source-record-preview-disabled');
    }

    function restoreStartTimeHint(refs) {
        if (refs?.startTimeHint) refs.startTimeHint.textContent = DEFAULT_START_TIME_HINT;
    }

    function applyPreviewStyles(refs) {
        const preview = refs?.preview || document.getElementById('memoryLinkPreview');
        if (!preview) return;
        preview.classList.remove('is-hidden');
        preview.classList.add('is-enhanced');
        preview.classList.remove('is-source-record-preview');
        preview.style.display = 'flex';
        preview.style.alignItems = 'center';
        preview.style.gap = '9px';
        preview.style.padding = '8px 9px';
        preview.style.borderRadius = '14px';
        preview.style.background = 'rgba(144, 73, 81, 0.04)';
        preview.style.border = '1px solid rgba(144,73,81,0.075)';
        preview.style.marginTop = '0';
        setPreviewConfirmState(refs, false);
        restoreStartTimeHint(refs);

        const thumbWrap = refs?.thumbWrap || preview.querySelector('.memory-link-preview__thumb-wrap');
        if (thumbWrap) {
            thumbWrap.style.display = 'block';
            thumbWrap.style.position = 'relative';
            thumbWrap.style.width = '52px';
            thumbWrap.style.minWidth = '52px';
            thumbWrap.style.height = '34px';
            thumbWrap.style.borderRadius = '10px';
            thumbWrap.style.overflow = 'hidden';
            thumbWrap.style.background = 'var(--surface-container, #ece9e5)';
            thumbWrap.style.boxShadow = 'none';
        }

        if (refs?.thumb) {
            refs.thumb.style.display = 'block';
            refs.thumb.style.width = '100%';
            refs.thumb.style.height = '100%';
            refs.thumb.style.objectFit = 'cover';
        }

        const playIcon = refs?.playIcon || preview.querySelector('.memory-link-preview__play-icon');
        if (playIcon) {
            playIcon.style.display = 'block';
            playIcon.style.position = 'absolute';
            playIcon.style.top = '50%';
            playIcon.style.left = '50%';
            playIcon.style.transform = 'translate(-50%, -50%)';
            playIcon.style.fontSize = '23px';
            playIcon.style.color = '#fff';
            playIcon.style.opacity = '0.92';
            playIcon.style.textShadow = '0 2px 8px rgba(0,0,0,0.3)';
        }

        const body = refs?.previewBody || preview.querySelector('.memory-link-preview__body');
        if (body) {
            body.style.flex = '1';
            body.style.display = 'flex';
            body.style.flexDirection = 'column';
            body.style.gap = '2px';
            body.style.minWidth = '0';
            body.style.justifyContent = 'center';
        }

        if (refs?.badge) {
            refs.badge.style.display = 'none';
        }

        if (refs?.previewTitle) {
            refs.previewTitle.textContent = '영상 링크 확인됨';
            refs.previewTitle.style.fontSize = '0.78rem';
            refs.previewTitle.style.fontWeight = '700';
            refs.previewTitle.style.color = 'rgba(144, 73, 81, 0.72)';
            refs.previewTitle.style.lineHeight = '1.35';
            refs.previewTitle.style.overflow = 'hidden';
            refs.previewTitle.style.textOverflow = 'ellipsis';
            refs.previewTitle.style.whiteSpace = 'nowrap';
        }

        if (refs?.previewHint) {
            refs.previewHint.textContent = '제목과 메모를 다듬어 주세요.';
            refs.previewHint.style.display = 'block';
            refs.previewHint.style.margin = '0';
            refs.previewHint.style.fontSize = '0.72rem';
            refs.previewHint.style.fontWeight = '600';
            refs.previewHint.style.lineHeight = '1.25';
            refs.previewHint.style.color = 'rgba(75, 64, 57, 0.54)';
            refs.previewHint.style.whiteSpace = 'nowrap';
            refs.previewHint.style.overflow = 'hidden';
            refs.previewHint.style.textOverflow = 'ellipsis';
        }
    }

    function hide(refs) {
        const preview = refs?.preview || document.getElementById('memoryLinkPreview');
        if (!preview) return;
        preview.classList.add('is-hidden');
        preview.classList.remove('is-enhanced');
        preview.classList.remove('is-source-record-preview');
        preview.style.display = 'none';
        setPreviewConfirmState(refs, false);
        restoreStartTimeHint(refs);
    }

    function resolveChannelPreviewLabel(url, media) {
        if (!url || !media || typeof media.extractYouTubeChannelInfo !== 'function') return '';
        const channelInfo = media.extractYouTubeChannelInfo(url);
        const label = String(channelInfo?.channelName || channelInfo?.channelId || '').trim();
        if (!label) return '';
        return `from ${label}`;
    }

    function buildPreviewHintText(options = {}) {
        const formatted = options.formatted || '';
        const channelLabel = options.channelLabel || '';
        const baseText = formatted
            ? `${formatted}부터 재생돼요. 제목과 메모를 다듬어 주세요.`
            : '제목과 메모를 다듬어 주세요.';
        return channelLabel ? `${channelLabel} · ${baseText}` : baseText;
    }

    function resolveSourceRecordPreviewTitle(sourceRecord) {
        return String(
            sourceRecord?.sourceHandle ||
            sourceRecord?.sourceTitle ||
            sourceRecord?.sourceUrl ||
            'YouTube 채널'
        ).trim();
    }

    function buildSourceRecordPreviewHint(sourceRecord) {
        const provider = String(sourceRecord?.provider || sourceRecord?.source || 'YouTube').trim();
        const providerLabel = /youtube/i.test(provider) ? 'YouTube 채널' : `${provider} 출처`;
        return `${providerLabel} · 아직 심은 순간이 없어요`;
    }

    function updateSourceRecordPreview(refs, sourceRecord) {
        if (refs?.preview) refs.preview.classList.remove('is-hidden');
        applyPreviewStyles(refs);

        if (refs?.preview) refs.preview.classList.add('is-source-record-preview');
        if (refs?.thumbWrap) refs.thumbWrap.style.display = 'none';
        if (refs?.thumb) refs.thumb.style.display = 'none';
        if (refs?.playIcon) refs.playIcon.style.display = 'none';
        setPreviewConfirmState(refs, true);

        if (refs?.badge) {
            refs.badge.style.display = 'inline-flex';
            refs.badge.textContent = '순간의 출처';
        }

        if (refs?.previewTitle) {
            refs.previewTitle.textContent = resolveSourceRecordPreviewTitle(sourceRecord);
        }

        if (refs?.previewHint) {
            refs.previewHint.textContent = buildSourceRecordPreviewHint(sourceRecord);
        }

        if (refs?.startTimeHint) {
            refs.startTimeHint.textContent = SOURCE_PREVIEW_START_TIME_HINT;
        }
    }

    function update(options) {
        const {
            currentInputMode,
            refs,
            userHasEditedStartTime
        } = options || {};
        if (currentInputMode !== 'link') {
            hide(refs);
            return;
        }

        const url = refs?.urlInput ? refs.urlInput.value.trim() : '';
        const media = window.LoveBudMedia || {};
        const videoId = typeof media.extractYouTubeId === 'function'
            ? (media.extractYouTubeId(url) || '')
            : '';

        if (!videoId) {
            const sourceRecord = typeof media.createYouTubeChannelSourceRecord === 'function'
                ? media.createYouTubeChannelSourceRecord(url)
                : null;
            if (sourceRecord) {
                updateSourceRecordPreview(refs, sourceRecord);
                return;
            }
            hide(refs);
            return;
        }

        if (refs?.preview) refs.preview.classList.remove('is-hidden');
        applyPreviewStyles(refs);

        if (refs?.thumb) {
            refs.thumb.src = typeof media.getThumbnailUrl === 'function'
                ? (media.getThumbnailUrl(url) || `https://img.youtube.com/vi/${videoId}/mqdefault.jpg`)
                : `https://img.youtube.com/vi/${videoId}/mqdefault.jpg`;
        }

        const time = window.LoveBudEditorMemoryFormTime || {};
        const startSeconds = typeof time.resolveStartSeconds === 'function'
            ? time.resolveStartSeconds({
                rawUrl: url,
                startValue: refs?.startTimeInput?.value,
                userHasEditedStartTime
            })
            : null;
        const formatted = typeof time.formatStartTime === 'function'
            ? time.formatStartTime(startSeconds)
            : '';
        const channelLabel = resolveChannelPreviewLabel(url, media);

        if (refs?.previewHint) {
            refs.previewHint.textContent = buildPreviewHintText({ formatted, channelLabel });
        }

        if (refs?.startTimeHint) {
            refs.startTimeHint.textContent = DEFAULT_START_TIME_HINT;
        }
    }

    window.LoveBudEditorMemoryFormPreview = {
        applyPreviewStyles,
        hide,
        setPreviewConfirmState,
        restoreStartTimeHint,
        resolveChannelPreviewLabel,
        buildPreviewHintText,
        resolveSourceRecordPreviewTitle,
        buildSourceRecordPreviewHint,
        updateSourceRecordPreview,
        update
    };
})();
