// Editor Shell Startup - DOM and startup state helpers
// Provides DOM-level editor shell helpers for startup and editability
//
// Sub-module: imported by editor-shell-helpers.js (aggregator)

(function () {
    'use strict';

    window.LoveBudEditorShellStartup = {
    applyEditorShellCopy: function(safeI18nText, i18n) {
        const setText = (id, key, fallback) => {
            const el = document.getElementById(id);
            if (!el) return;
            el.textContent = safeI18nText(i18n, key, fallback);
        };
        const setPlaceholder = (id, key, fallback) => {
            const el = document.getElementById(id);
            if (!el) return;
            el.setAttribute('placeholder', safeI18nText(i18n, key, fallback));
        };

        setText('backToMyTreesLabel', 'editor_back_to_my_trees', '내 러브트리로 돌아가기');
        setText('editorFlowHeading', 'sidebar_flow_heading', '트리 정보');
        setText('editorFlowLead', 'sidebar_flow_lead', '트리 이름과 공개 상태를 여기서 정리하고, 가운데 캔버스에서는 흐름만 살펴보세요.');
        setText('recenterCanvasBtnLabel', 'sidebar_recenter_tree', '트리 한눈에 보기');
        setText('addMemoryEyebrow', 'editor_add_memory_eyebrow', '다음 순간 심기');
        setText('addMemoryIntro', 'editor_add_memory_intro', '지금 마음이 머문 다음 장면을 이어 심어 보세요. 첫 순간이라면 여기서 러브트리가 시작됩니다.');
        setText('saveStatusText', 'save_saved', '저장됨');
        setText('detailEmptyStartBtn', 'editor_add_first_memory', '첫 순간 심기');
        setText('canvasEmptyGuideEyebrow', 'editor_canvas_empty_eyebrow', '시작하기');
        setText('canvasEmptyGuideTitle', 'editor_canvas_empty_title', '이 트리의 첫 순간을 기록해볼까요?');
        setText('canvasEmptyYoutubeLabel', 'editor_youtube_link', 'YouTube 링크');
        setPlaceholder('canvasEmptyYoutubeInput', 'editor_canvas_empty_youtube_placeholder', 'YouTube 링크를 붙여넣어 첫 순간 심기');
        setText('canvasEmptyStartBtn', 'editor_add_first_memory', '첫 순간 심기');
        setText('canvasEmptyTextStartBtn', 'editor_canvas_empty_text_start', '텍스트로 시작하기');
        setText('canvasEmptyGuideHint', 'editor_canvas_empty_hint', '캔버스를 두 번 클릭해도 새 순간을 시작할 수 있어요.');
        setText('addMemoryFormEyebrow', 'editor_add_first_memory', '첫 순간 심기');
        setText('addMemoryFormTitle', 'editor_new_memory', '어떤 순간이 이어졌나요?');
        setText('addMemoryFormIntro', 'editor_add_memory_intro', '지금 마음이 머문 다음 장면을 이어 심어 보세요. 첫 순간이라면 여기서 러브트리가 시작됩니다.');
        setText('memoryUrlLabel', 'editor_youtube_link', 'YouTube 장면 링크');
        setText('memoryTitleLabel', 'editor_memory_title', '순간 제목');
        setText('memoryMemoLabel', 'editor_memory_memo_optional', '감정 메모');
        setText('cancelAddMemory', 'editor_cancel', '취소');
        setText('confirmAddMemory', 'editor_confirm_add', '이 순간 심기');
        setPlaceholder('memoryTitleInput', 'editor_memory_title_placeholder', '이 순간을 어떻게 기억하고 싶은지 적어보세요');
        setPlaceholder('memoryMemoInput', 'editor_memory_memo_placeholder', '왜 이 장면이 이어졌는지, 지금 마음을 남겨보세요...');
        setText('detailEmptyTitle', 'detail_empty_title', '첫 순간이 트리를 깨워요');
        setText('detailEmptyDesc', 'detail_empty_desc', '첫 순간을 심으면 이 패널이 현재 순간 허브로 바뀝니다.');
        setText('detailCurrentMomentBadge', 'editor_current_moment_badge', '현재 순간');
        setText('detailCurrentMomentTitle', 'editor_current_moment_title', '지금 마음이 머문 장면');
        setText('detailCurrentMomentHint', 'editor_current_moment_hint', '선택한 순간을 중심으로 감정 메모와 다음 행동이 정리됩니다.');
        setText('detailMomentInfoLabel', 'editor_moment_info_label', '순간 정보');
        setText('detailTreeStatusLabel', 'current_tree', '현재 트리');
        setText('detailDateLabel', 'editor_date_label', '기억한 날');
        setText('detailTagsLabel', 'editor_tag_label', '감정 태그');
        setText('detailMemoLabel', 'editor_note_label', '감정 메모');
        setText('editMemoryBtn', 'editor_edit', '순간 수정');
        setText('editMemoryBtnLabel', 'editor_edit', '순간 수정');
        setText('viewMomentDetailBtnLabel', 'editor_view_moment_detail', '현재 순간 감상하기');
        setText('continueFromMomentBtnLabel', 'editor_continue_from_moment', '이 순간에서 이어가기');
        setText('detailActionsPrimaryLabel', 'editor_actions_primary', '이 순간에서');
        setText('deleteMemoryBtn', 'editor_delete', '순간 삭제');
        setText('editTitleLabel', 'editor_memory_title', '제목');
        setText('editMemoLabel', 'editor_note_label', '감정 메모');
        setText('editTagsLabel', 'editor_edit_tag_label', '감정 태그 (쉼표로 구분)');
        setPlaceholder('editTitleInput', 'editor_edit_title_placeholder', '순간의 제목을 입력하세요');
        setPlaceholder('editMemoInput', 'editor_memory_memo_placeholder', '이 순간의 감정을 남겨보세요...');
        setPlaceholder('editTagsInput', 'editor_edit_tag_placeholder', '#감동, #행복, #그리움');
        setText('cancelEditBtn', 'editor_cancel', '취소');
        setText('saveEditBtn', 'editor_save', '저장하기');
    },

    markEditorReady: function(options) {
        var opts = options || {};
        var body = opts.body || document.body;

        if (body && body.classList && typeof body.classList.remove === 'function') {
            body.classList.remove('editor-preload');
        }
    },

    applyEditorEditabilityState: function(options) {
        var opts = options || {};
        var canEdit = opts.canEdit !== false;
        var editorNamespace = opts.editorNamespace || (window.LoveBudEditor = window.LoveBudEditor || {});
        var body = opts.body || document.body;

        editorNamespace.canEdit = canEdit;

        if (body && body.classList && typeof body.classList.toggle === 'function') {
            body.classList.toggle('editor-readonly', !canEdit);
        }

        return editorNamespace;
    },

    createEditorReadyFinalizer: function(options) {
        var opts = options || {};
        var updateSidebarStatus = opts.updateSidebarStatus || function() {};
        var markEditorReady = opts.markEditorReady || function() {};
        var log = opts.log || function() {};

        return function finalizeEditorReady() {
            updateSidebarStatus();
            markEditorReady();
            log('startEditor complete. Ready.');
        };
    },

    createEditorStartupShellApplier: function(options) {
        var opts = options || {};
        var prepareEditorShell = opts.prepareEditorShell || function() {};
        var applyEditorEditabilityState = opts.applyEditorEditabilityState || function() {};
        var canEdit = opts.canEdit;
        var log = opts.log || function() {};

        return function applyEditorStartupShell() {
            log('DOM refs and URL params prepared');
            prepareEditorShell();
            log('Editor shell mounted');
            applyEditorEditabilityState({ canEdit: canEdit });
        };
    },

    createSaveStatusOrchestrationFallback: function(options) {
        var opts = options || {};
        var consoleRef = opts.consoleRef || console;

        return function createEditorSaveStatusOrchestrationFallback() {
            consoleRef.warn('[editor] LoveBudEditorSaveStatusOrchestration not loaded, using minimal fallback');

            var saveStatusData = {
                status: 'saved',
                lastSaved: null,
                timer: null
            };

            return {
                saveStatusData: saveStatusData,
                updateSaveStatus: function(status, message) {
                    saveStatusData.status = status;
                }
            };
        };
    },
    };
})();
