(function () {
    const emptyGuideUI = window.LoveBudEditorEmptyGuideUI || {};

    emptyGuideUI.bindEmptyGuideEvents = function(options) {
        const getEditorCanvas = options.getEditorCanvas;
        const showAddMemoryForm = options.showAddMemoryForm;
        const addMemoryFromForm = options.addMemoryFromForm;
        const getTreeMemories = options.getTreeMemories;
        const showToast = options.showToast;
        const i18n = options.i18n;

        const canvasEmptyStartBtn = document.getElementById('canvasEmptyStartBtn');
        const canvasEmptyYoutubeInput = document.getElementById('canvasEmptyYoutubeInput');
        const canvasEmptyTextStartBtn = document.getElementById('canvasEmptyTextStartBtn');

        // 의존성 DOM (문자열 등 추출을 위해 직접 탐색)
        const memoryUrlInput = document.getElementById('memoryUrlInput');
        const memoryModeLinkBtn = document.getElementById('memoryModeLinkBtn');
        const memoryModeTextBtn = document.getElementById('memoryModeTextBtn');

        async function createMemoryFromCanvasUrl(createOptions) {
            const rawUrl = createOptions && createOptions.rawUrl;
            const position = createOptions && createOptions.position;
            if (!rawUrl) {
                if (typeof showAddMemoryForm === 'function') showAddMemoryForm();
                return;
            }
            if (typeof showAddMemoryForm === 'function') showAddMemoryForm();
            if (memoryUrlInput) {
                memoryUrlInput.value = rawUrl;
                memoryUrlInput.dispatchEvent(new Event('input', { bubbles: true }));
            }
            if (memoryModeLinkBtn) memoryModeLinkBtn.click();
            
            const memories = typeof getTreeMemories === 'function' ? getTreeMemories() : [];
            const beforeIds = new Set(memories.map((memory) => memory && memory.id));
            
            if (typeof addMemoryFromForm === 'function') await addMemoryFromForm();
            
            const updatedMemories = typeof getTreeMemories === 'function' ? getTreeMemories() : [];
            const createdMemory = updatedMemories.find((memory) => memory && !beforeIds.has(memory.id));
            
            const editorCanvas = typeof getEditorCanvas === 'function' ? getEditorCanvas() : null;
            if (createdMemory && position && editorCanvas) {
                if (typeof editorCanvas.addNodePosition === 'function') {
                    editorCanvas.addNodePosition(createdMemory.id, position);
                } else if (editorCanvas.viewportState && editorCanvas.viewportState.positions) {
                    editorCanvas.viewportState.positions[createdMemory.id] = position;
                }
                
                if (typeof editorCanvas.persistStoredPositions === 'function') editorCanvas.persistStoredPositions();
                if (typeof editorCanvas.initCanvas === 'function') editorCanvas.initCanvas();
                if (typeof editorCanvas.focusNodeById === 'function') editorCanvas.focusNodeById(createdMemory.id);
            }
        }

        if (canvasEmptyStartBtn && canvasEmptyStartBtn.dataset.bound !== '1') {
            canvasEmptyStartBtn.dataset.bound = '1';
            canvasEmptyStartBtn.addEventListener('click', () => {
                const rawUrl = canvasEmptyYoutubeInput ? canvasEmptyYoutubeInput.value.trim() : '';
                if (rawUrl) {
                    createMemoryFromCanvasUrl({ rawUrl });
                    return;
                }
                if (typeof showAddMemoryForm === 'function') showAddMemoryForm();
            });
        }

        if (canvasEmptyTextStartBtn && canvasEmptyTextStartBtn.dataset.bound !== '1') {
            canvasEmptyTextStartBtn.dataset.bound = '1';
            canvasEmptyTextStartBtn.addEventListener('click', () => {
                if (typeof showAddMemoryForm === 'function') showAddMemoryForm();
                if (memoryModeTextBtn) memoryModeTextBtn.click();
            });
        }

        if (canvasEmptyYoutubeInput && canvasEmptyYoutubeInput.dataset.bound !== '1') {
            canvasEmptyYoutubeInput.dataset.bound = '1';
            canvasEmptyYoutubeInput.addEventListener('keydown', (event) => {
                if (event.key !== 'Enter') return;
                event.preventDefault();
                createMemoryFromCanvasUrl({ rawUrl: canvasEmptyYoutubeInput.value.trim() });
            });
        }

        return { createMemoryFromCanvasUrl };
    };

    window.LoveBudEditorEmptyGuideUI = emptyGuideUI;
})();
