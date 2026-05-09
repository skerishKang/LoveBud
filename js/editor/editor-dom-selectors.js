/**
 * LoveBud - Editor DOM Selector Registry
 *
 * Scaffold for centralizing editor DOM element selectors.
 * This file provides constants and helper functions for DOM element access
 * to support future editor module extraction and refactoring.
 *
 * Runtime behavior is unchanged - this is a registry scaffold only.
 */

(function() {
    'use strict';

    // DOM element ID constants
    const SELECTORS = {
        // Sidebar elements
        backToMyTreesLink: 'backToMyTreesLink',
        backToMyTreesLabel: 'backToMyTreesLabel',
        editorFlowHeading: 'editorFlowHeading',
        editorFlowLead: 'editorFlowLead',
        sidebarTreeTitle: 'sidebarTreeTitle',
        renameTreeBtn: 'renameTreeBtn',
        sidebarTitleEditBtn: 'sidebarTitleEditBtn',
        sidebarTitleEditBtnLabel: 'sidebarTitleEditBtnLabel',
        sidebarVisibilityToggleBtn: 'sidebarVisibilityToggleBtn',
        sidebarVisibilityToggleBtnIcon: 'sidebarVisibilityToggleBtnIcon',
        sidebarVisibilityToggleBtnLabel: 'sidebarVisibilityToggleBtnLabel',
        sidebarTreeVisibility: 'sidebarTreeVisibility',
        sidebarMomentCount: 'sidebarMomentCount',
        sidebarFlowSummary: 'sidebarFlowSummary',
        sidebarSelectionHint: 'sidebarSelectionHint',

        // Add memory section
        addMemoryEyebrow: 'addMemoryEyebrow',
        addMemoryIntro: 'addMemoryIntro',
        addMemoryBtn: 'addMemoryBtn',
        addMemoryBtnLabel: 'addMemoryBtnLabel',

        // Canvas area
        canvasArea: 'canvasArea',
        canvasSvg: 'canvasSvg',
        canvasEmptyGuide: 'canvasEmptyGuide',
        canvasEmptyGuideEyebrow: 'canvasEmptyGuideEyebrow',
        canvasEmptyGuideTitle: 'canvasEmptyGuideTitle',
        canvasEmptyGuideDesc: 'canvasEmptyGuideDesc',
        canvasEmptyStartBtn: 'canvasEmptyStartBtn',
        recenterCanvasBtn: 'recenterCanvasBtn',
        recenterCanvasBtnLabel: 'recenterCanvasBtnLabel',

        // Memory form
        addMemoryForm: 'addMemoryForm',
        addMemoryFormEyebrow: 'addMemoryFormEyebrow',
        addMemoryFormTitle: 'addMemoryFormTitle',
        addMemoryFormIntro: 'addMemoryFormIntro',
        memoryInputModeGroup: 'memoryInputModeGroup',
        memoryModeLinkBtn: 'memoryModeLinkBtn',
        memoryModeTextBtn: 'memoryModeTextBtn',
        memoryFormSupportNote: 'memoryFormSupportNote',
        memoryFormSupportNoteText: 'memoryFormSupportNoteText',
        memoryUrlField: 'memoryUrlField',
        memoryUrlLabel: 'memoryUrlLabel',
        memoryUrlInput: 'memoryUrlInput',
        memoryStartTimeField: 'memoryStartTimeField',
        memoryStartTimeLabel: 'memoryStartTimeLabel',
        memoryStartTimeInput: 'memoryStartTimeInput',
        memoryStartTimeHint: 'memoryStartTimeHint',
        memoryLinkPreview: 'memoryLinkPreview',
        memoryPreviewThumb: 'memoryPreviewThumb',
        memoryPreviewBadge: 'memoryPreviewBadge',
        memoryPreviewTitle: 'memoryPreviewTitle',
        memoryPreviewHint: 'memoryPreviewHint',
        memoryTitleLabel: 'memoryTitleLabel',
        memoryTitleInput: 'memoryTitleInput',
        memoryMemoLabel: 'memoryMemoLabel',
        memoryMemoInput: 'memoryMemoInput',
        cancelAddMemory: 'cancelAddMemory',
        confirmAddMemory: 'confirmAddMemory',

        // Detail panel
        detailPanel: 'detailPanel',
        detailMoreBtn: 'detailMoreBtn',
        detailEmptyState: 'detailEmptyState',
        detailEmptyTitle: 'detailEmptyTitle',
        detailEmptyDesc: 'detailEmptyDesc',
        detailEmptyStartBtn: 'detailEmptyStartBtn',
        detailViewMode: 'detailViewMode',
        detailEditMode: 'detailEditMode',
        detailTreeStatusLabel: 'detailTreeStatusLabel',
        detailTreeMetaMount: 'detailTreeMetaMount',
        detailCurrentMomentBadge: 'detailCurrentMomentBadge',
        detailCurrentMomentTitle: 'detailCurrentMomentTitle',
        detailCurrentMomentHint: 'detailCurrentMomentHint',
        editMemoryBtn: 'editMemoryBtn',
        deleteMemoryBtn: 'deleteMemoryBtn',
        detailImg: 'detailImg',
        detailMomentInfoLabel: 'detailMomentInfoLabel',
        detailDateLabel: 'detailDateLabel',
        detailDateText: 'detailDateText',
        detailTagsLabel: 'detailTagsLabel',
        detailTags: 'detailTags',
        detailMemoLabel: 'detailMemoLabel',
        detailMemo: 'detailMemo',
        editTitleLabel: 'editTitleLabel',
        editTitleInput: 'editTitleInput',
        editMemoLabel: 'editMemoLabel',
        editMemoInput: 'editMemoInput',
        editTagsLabel: 'editTagsLabel',
        editTagsInput: 'editTagsInput',
        cancelEditBtn: 'cancelEditBtn',
        saveEditBtn: 'saveEditBtn',
        detailPanelFooter: 'detailPanelFooter',
        detailSubmitBtn: 'detailSubmitBtn',

        // Save status
        saveStatusIndicator: 'saveStatusIndicator',
        saveStatusIcon: 'saveStatusIcon',
        saveStatusText: 'saveStatusText',
        lastSavedTime: 'lastSavedTime'
    };

    /**
     * Safe DOM element getter with null check
     * @param {string} elementId - The element ID to retrieve
     * @returns {HTMLElement|null} The DOM element or null if not found
     */
    function getElement(elementId) {
        try {
            return document.getElementById(elementId);
        } catch (error) {
            console.warn('[editor-dom-selectors] Failed to get element:', elementId, error);
            return null;
        }
    }

    /**
     * Get multiple editor elements as an object
     * @param {string[]} elementIds - Array of element IDs to retrieve
     * @returns {Object} Object with element IDs as keys and DOM elements as values
     */
    function getElements(elementIds) {
        const elements = {};
        elementIds.forEach(function(id) {
            elements[id] = getElement(id);
        });
        return elements;
    }

    /**
     * Get all commonly used editor elements
     * @returns {Object} Object containing all editor DOM elements
     */
    function getEditorElements() {
        const elementIds = Object.keys(SELECTORS);
        return getElements(elementIds);
    }

    /**
     * Check if an element exists in the DOM
     * @param {string} elementId - The element ID to check
     * @returns {boolean} True if element exists, false otherwise
     */
    function hasElement(elementId) {
        return !!getElement(elementId);
    }

    // Export the registry to global namespace
    window.LoveBudEditorDomSelectors = {
        SELECTORS: SELECTORS,
        getElement: getElement,
        getElements: getElements,
        getEditorElements: getEditorElements,
        hasElement: hasElement
    };

    // Log successful registration for debugging
    console.log('[editor-dom-selectors] DOM selector registry loaded');
})();
