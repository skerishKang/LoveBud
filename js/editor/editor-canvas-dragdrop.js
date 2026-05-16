(function() {
    'use strict';

    function getDragUrl(dataTransfer) {
        if (!dataTransfer) return '';
        return (
            dataTransfer.getData('text/uri-list') ||
            dataTransfer.getData('text/plain') ||
            dataTransfer.getData('text') ||
            ''
        ).trim();
    }

    function getYouTubeVideoId(url) {
        const media = window.LoveBudMedia || {};
        const helpers = window.LoveBudEditorHelpers || {};
        if (typeof media.extractYouTubeId === 'function') {
            return media.extractYouTubeId(url);
        }
        if (typeof helpers.extractYouTubeIdFallback === 'function') {
            return helpers.extractYouTubeIdFallback(url);
        }
        const match = String(url || '').match(/(?:v=|\/|youtu\.be\/)([0-9A-Za-z_-]{11})/);
        return match ? match[1] : null;
    }

    function getCanvasWorldPosition(canvas, editorCanvas, event) {
        const viewportState = editorCanvas && editorCanvas.viewportState;
        if (!canvas || !viewportState) return null;
        const rect = canvas.getBoundingClientRect();
        const scale = Number(viewportState.scale) || 1;
        return {
            x: Math.round((event.clientX - rect.left - (viewportState.offsetX || 0)) / scale),
            y: Math.round((event.clientY - rect.top - (viewportState.offsetY || 0)) / scale)
        };
    }

    function setDropZoneVisible(dropZone, isVisible) {
        if (!dropZone) return;
        dropZone.classList.toggle('editor-canvas-drop-zone-hidden', !isVisible);
        dropZone.setAttribute('aria-hidden', isVisible ? 'false' : 'true');
    }

    function bindCanvasDragDrop(options) {
        const {
            canvas,
            dropZone,
            editorCanvas,
            createMemoryFromUrl,
            showToast,
            i18n
        } = options || {};

        if (!canvas || typeof createMemoryFromUrl !== 'function') return;

        let dragDepth = 0;

        canvas.addEventListener('dragenter', (event) => {
            dragDepth += 1;
            if (getDragUrl(event.dataTransfer)) {
                setDropZoneVisible(dropZone, true);
            }
        });

        canvas.addEventListener('dragover', (event) => {
            const rawUrl = getDragUrl(event.dataTransfer);
            if (!rawUrl) return;
            event.preventDefault();
            if (event.dataTransfer) event.dataTransfer.dropEffect = 'copy';
            setDropZoneVisible(dropZone, true);
        });

        canvas.addEventListener('dragleave', () => {
            dragDepth = Math.max(0, dragDepth - 1);
            if (dragDepth === 0) setDropZoneVisible(dropZone, false);
        });

        canvas.addEventListener('drop', async (event) => {
            const rawUrl = getDragUrl(event.dataTransfer);
            if (!rawUrl) return;
            event.preventDefault();
            dragDepth = 0;
            setDropZoneVisible(dropZone, false);

            const videoId = getYouTubeVideoId(rawUrl);
            if (!videoId) {
                if (typeof showToast === 'function') {
                    showToast(i18n('editor_drop_youtube_invalid') || 'YouTube 링크를 놓아 주세요.', 'warn');
                }
                return;
            }

            await createMemoryFromUrl({
                rawUrl,
                videoId,
                position: getCanvasWorldPosition(canvas, editorCanvas, event)
            });
        });
    }

    window.LoveBudEditorCanvasDragDrop = {
        bindCanvasDragDrop
    };
})();
