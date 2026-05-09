(function() {
    'use strict';

    function applyPreviewStyles(refs) {
        const preview = refs?.preview || document.getElementById('memoryLinkPreview');
        if (!preview) return;
        preview.classList.add('is-enhanced');
        preview.style.display = 'flex';
        preview.style.alignItems = 'center';
        preview.style.gap = '10px';
        preview.style.padding = '8px 10px';
        preview.style.borderRadius = '14px';
        preview.style.background = 'rgba(144, 73, 81, 0.045)';
        preview.style.border = '1px solid rgba(144,73,81,0.08)';
        preview.style.marginTop = '6px';

        const thumbWrap = refs?.thumbWrap || preview.querySelector('.memory-link-preview__thumb-wrap');
        if (thumbWrap) {
            thumbWrap.style.position = 'relative';
            thumbWrap.style.width = '72px';
            thumbWrap.style.minWidth = '72px';
            thumbWrap.style.height = '40px';
            thumbWrap.style.borderRadius = '10px';
            thumbWrap.style.overflow = 'hidden';
            thumbWrap.style.background = 'var(--surface-container, #ece9e5)';
            thumbWrap.style.boxShadow = 'none';
        }

        if (refs?.thumb) {
            refs.thumb.style.width = '100%';
            refs.thumb.style.height = '100%';
            refs.thumb.style.objectFit = 'cover';
        }

        const playIcon = refs?.playIcon || preview.querySelector('.memory-link-preview__play-icon');
        if (playIcon) {
            playIcon.style.position = 'absolute';
            playIcon.style.top = '50%';
            playIcon.style.left = '50%';
            playIcon.style.transform = 'translate(-50%, -50%)';
            playIcon.style.fontSize = '32px';
            playIcon.style.color = '#fff';
            playIcon.style.opacity = '0.92';
            playIcon.style.textShadow = '0 2px 8px rgba(0,0,0,0.3)';
        }

        const body = refs?.previewBody || preview.querySelector('.memory-link-preview__body');
        if (body) {
            body.style.flex = '1';
            body.style.display = 'flex';
            body.style.flexDirection = 'column';
            body.style.gap = '6px';
            body.style.minWidth = '0';
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
            refs.previewHint.textContent = '';
            refs.previewHint.style.display = 'none';
        }
    }

    function hide(refs) {
        const preview = refs?.preview || document.getElementById('memoryLinkPreview');
        if (!preview) return;
        preview.classList.add('is-hidden');
        preview.classList.remove('is-enhanced');
    }

    function update(options) {
        const {
            currentInputMode,
            refs,
            i18n,
            isFirstMoment,
            userHasEditedTitle,
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

        if (!userHasEditedTitle && refs?.titleInput) {
            refs.titleInput.value = isFirstMoment
                ? (i18n('editor_default_first_title') || '첫 순간')
                : (i18n('editor_default_next_title') || '이어진 순간');
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

        if (refs?.previewHint && formatted) {
            refs.previewHint.textContent = `${formatted}부터 재생돼요. 제목과 메모를 다듬어 트리에 심어 주세요.`;
        } else if (refs?.previewHint) {
            refs.previewHint.textContent = '이 장면을 트리에 심기 전에 제목과 메모를 다듬어 주세요.';
        }

        if (refs?.startTimeHint) {
            refs.startTimeHint.textContent = formatted
                ? `${formatted}부터 재생돼요. 유튜브 공유에서 “시작 시간”을 체크한 링크도 자동으로 잡혀요.`
                : '유튜브 공유에서 “시작 시간”을 체크한 링크를 붙이면 자동으로 잡혀요.';
        }
    }

    window.LoveBudEditorMemoryFormPreview = {
        applyPreviewStyles,
        hide,
        update
    };
})();
