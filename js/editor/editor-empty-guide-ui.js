(function () {
    const emptyGuideUI = window.LoveBudEditorEmptyGuideUI || {};

    emptyGuideUI.bindEmptyGuideEvents = function(options) {
        const getEditorCanvas = options.getEditorCanvas;
        const showAddMemoryForm = options.showAddMemoryForm;
        const addMemoryFromForm = options.addMemoryFromForm;
        const getTreeMemories = options.getTreeMemories;
        const showToast = options.showToast;
        const i18n = options.i18n;

        const canvasEmptyVideoBtn = document.getElementById('canvasEmptyVideoBtn');
        const canvasEmptyTextBtn = document.getElementById('canvasEmptyTextBtn');
        const canvasEmptyQuickInput = document.getElementById('canvasEmptyQuickInput');

        // 의존성 DOM
        const memoryUrlInput = document.getElementById('memoryUrlInput');
        const memoryTitleInput = document.getElementById('memoryTitleInput');
        const memoryModeLinkBtn = document.getElementById('memoryModeLinkBtn');
        const memoryModeTextBtn = document.getElementById('memoryModeTextBtn');

        async function fetchYoutubeTitle(url) {
            try {
                const oembedUrl = `https://www.youtube.com/oembed?url=${encodeURIComponent(url)}&format=json`;
                const response = await fetch(oembedUrl);
                if (response.ok) {
                    const data = await response.json();
                    return data.title || '';
                }
            } catch (e) {
                console.error('[editor] Failed to fetch YouTube title:', e);
            }
            return '';
        }

        async function createMemoryInstant(url) {
            if (!url) return;
            
            // YouTube URL 확인
            const isYoutube = /(youtube\.com|youtu\.be|youtube\.com\/shorts\/)/i.test(url);
            if (!isYoutube) {
                showToast(i18n('invalid_youtube') || '유효한 YouTube 링크를 입력해 주세요.', 'warn');
                return;
            }

            showToast(i18n('saving') || '기록 중...', 'info');

            // 제목 가져오기
            const title = await fetchYoutubeTitle(url);

            if (memoryUrlInput) {
                memoryUrlInput.value = url;
                memoryUrlInput.dispatchEvent(new Event('input', { bubbles: true }));
            }
            if (memoryTitleInput && title) {
                memoryTitleInput.value = title;
                memoryTitleInput.dispatchEvent(new Event('input', { bubbles: true }));
            }
            if (memoryModeLinkBtn) memoryModeLinkBtn.click();

            const memories = typeof getTreeMemories === 'function' ? getTreeMemories() : [];
            const beforeIds = new Set(memories.map((m) => m && m.id));

            if (typeof addMemoryFromForm === 'function') {
                await addMemoryFromForm();
            }

            const updatedMemories = typeof getTreeMemories === 'function' ? getTreeMemories() : [];
            const createdMemory = updatedMemories.find((m) => m && !beforeIds.has(m.id));

            const editorCanvas = typeof getEditorCanvas === 'function' ? getEditorCanvas() : null;
            if (createdMemory && editorCanvas) {
                if (typeof editorCanvas.initCanvas === 'function') editorCanvas.initCanvas();
                if (typeof editorCanvas.focusNodeById === 'function') editorCanvas.focusNodeById(createdMemory.id);
            }
        }

        if (canvasEmptyVideoBtn && canvasEmptyVideoBtn.dataset.bound !== '1') {
            canvasEmptyVideoBtn.dataset.bound = '1';
            canvasEmptyVideoBtn.addEventListener('click', () => {
                if (typeof showAddMemoryForm === 'function') showAddMemoryForm();
                if (memoryModeLinkBtn) memoryModeLinkBtn.click();
            });
        }

        if (canvasEmptyTextBtn && canvasEmptyTextBtn.dataset.bound !== '1') {
            canvasEmptyTextBtn.dataset.bound = '1';
            canvasEmptyTextBtn.addEventListener('click', () => {
                if (typeof showAddMemoryForm === 'function') showAddMemoryForm();
                if (memoryModeTextBtn) memoryModeTextBtn.click();
            });
        }

        if (canvasEmptyQuickInput && canvasEmptyQuickInput.dataset.bound !== '1') {
            canvasEmptyQuickInput.dataset.bound = '1';
            
            canvasEmptyQuickInput.addEventListener('paste', (event) => {
                const pasteData = (event.clipboardData || window.clipboardData).getData('text');
                if (pasteData) {
                    createMemoryInstant(pasteData.trim());
                }
            });

            canvasEmptyQuickInput.addEventListener('keydown', (event) => {
                if (event.key === 'Enter') {
                    event.preventDefault();
                    createMemoryInstant(canvasEmptyQuickInput.value.trim());
                }
            });
        }

        return { createMemoryInstant };
    };

    window.LoveBudEditorEmptyGuideUI = emptyGuideUI;
})();
