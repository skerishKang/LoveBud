(function() {
    const createEditorDomRefs = () => ({
        canvas: document.getElementById('canvasArea'),
        svg: document.getElementById('canvasSvg'),
        detailPanel: document.getElementById('detailPanel'),
        addBtn: document.getElementById('addMemoryBtn')
    });

    const createEditorFormRefs = () => ({
        urlInput: document.getElementById('memoryUrlInput'),
        titleInput: document.getElementById('memoryTitleInput'),
        memoInput: document.getElementById('memoryMemoInput'),
        cancelBtn: document.getElementById('cancelAddMemory'),
        confirmBtn: document.getElementById('confirmAddMemory')
    });

    window.LoveBudEditorDomRefsBuilder = {
        createEditorDomRefs,
        createEditorFormRefs
    };
})();
