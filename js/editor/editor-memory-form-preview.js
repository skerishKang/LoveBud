(function() {
    'use strict';

    function applyPreviewStyles(refs) {
        const preview = refs?.preview || document.getElementById('memoryLinkPreview');
        if (!preview) return;
        preview.classList.add('is-enhanced');
        preview.style.display = 'flex';
        preview.style.alignItems = 'stretch';
        preview.style.gap = '14px';
        preview.style.padding = '14px';
        preview.style.borderRadius = '20px';
        preview.style.background = 'linear-gradient(180deg, rgba(245, 241, 238, 0.98), rgba(255,255,255,0.98))';
        preview.style.border = '1px solid rgba(144,73,81,0.10)';
        preview.style.marginTop = '8px';
        preview.style.transition = 'opacity 0.2s ease, transform 0.2s ease';

        const thumbWrap = refs?.thumbWrap || preview.querySelector('.memory-link-preview__thumb-wrap');
        if (thumbWrap) {
            thumbWrap.style.position = 'relative';
            thumbWrap.style.width = '136px';
            thumbWrap.style.minWidth = '136px';
            thumbWrap.style.height = '76px';
            thumbWrap.style.borderRadius = '14px';
            thumbWrap.style.overflow = 'hidden';
            thumbWrap.style.background = 'var(--surface-container, #ece9e5)';
            thumbWrap.style.boxShadow = '0 8px 20px rgba(75,64,57,0.08)';
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
            refs.badge.style.display = 'inline-flex';
            refs.badge.style.alignItems = 'center';
            refs.badge.style.padding = '4px 9px';
            refs.badge.style.borderRadius = '999px';
            refs.badge.style.background = 'rgba(144, 73, 81, 0.1)';
            refs.badge.style.color = 'var(--primary, #904951)';
            refs.badge.style.fontSize = '10px';
            refs.badge.style.fontWeight = '700';
            refs.badge.style.letterSpacing = '0.03em';
            refs.badge.style.textTransform = 'uppercase';
            refs.badge.style.width = 'fit-content';
        }

        if (refs?.previewTitle) {
            refs.previewTitle.style.fontSize = '0.95rem';
            refs.previewTitle.style.fontWeight = '700';
            refs.previewTitle.style.color = 'var(--on-surface, #333)';
            refs.previewTitle.style.lineHeight = '1.4';
            refs.previewTitle.style.overflow = 'hidden';
            refs.previewTitle.style.textOverflow = 'ellipsis';
            refs.previewTitle.style.whiteSpace = 'nowrap';
        }

        if (refs?.previewHint) {
            refs.previewHint.style.fontSize = '0.8rem';
            refs.previewHint.style.color = 'var(--on-surface-variant, #666)';
            refs.previewHint.style.lineHeight = '1.6';
            refs.previewHint.style.margin = '0';
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
            refs.previewHint.textContent = i18n('editor_preview_hint') || '이 장면을 트리에 심기 전에 제목과 메모를 다듬어 주세요.';
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
