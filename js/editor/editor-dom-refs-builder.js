(function() {
    const domSelectors = window.LoveBudEditorDomSelectors || {};
    const SELECTORS = domSelectors.SELECTORS || {};
    const getElement = typeof domSelectors.getElement === 'function'
        ? domSelectors.getElement
        : (id) => document.getElementById(id);

    const createEditorDomRefs = () => ({
        canvas: getElement(SELECTORS.canvasArea || 'canvasArea'),
        svg: getElement(SELECTORS.canvasSvg || 'canvasSvg'),
        detailPanel: getElement(SELECTORS.detailPanel || 'detailPanel'),
        addBtn: getElement(SELECTORS.addMemoryBtn || 'addMemoryBtn')
    });

    const createEditorFormRefs = () => ({
        urlInput: getElement(SELECTORS.memoryUrlInput || 'memoryUrlInput'),
        titleInput: getElement(SELECTORS.memoryTitleInput || 'memoryTitleInput'),
        memoInput: getElement(SELECTORS.memoryMemoInput || 'memoryMemoInput'),
        cancelBtn: getElement(SELECTORS.cancelAddMemory || 'cancelAddMemory'),
        confirmBtn: getElement(SELECTORS.confirmAddMemory || 'confirmAddMemory')
    });

    window.LoveBudEditorDomRefsBuilder = {
        createEditorDomRefs,
        createEditorFormRefs
    };
})();
