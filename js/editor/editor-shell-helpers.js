// Editor Shell Helpers - Entry-only shell utilities
// Provides fallbacks and utilities for editor initialization without affecting runtime behavior

window.LoveBudEditorShellHelpers = {
    // i18n utility
    getI18n: function() {
        return window.t || ((k) => k);
    },

    // Editor base path utilities
    getEditorBasePath: function() {
        return window.location.pathname.indexOf('/pages/') !== -1 ? '' : 'pages/';
    },

    buildEditorRedirectTarget: function() {
        return this.getEditorBasePath() + 'editor' + (window.location.search || '');
    },

    // HTTP status resolver
    getHttpStatus: function(error) {
        return Number(
            (error && error.status) ||
            (error && error.statusCode) ||
            (error && error.response && error.response.status) ||
            0
        );
    },

    // Canvas empty guide bridge utility
    exposeCanvasEmptyGuideUpdater: function(options) {
        var opts = options || {};
        var editorNamespace = opts.editorNamespace || (window.LoveBudEditor = window.LoveBudEditor || {});
        var updateCanvasEmptyGuide = opts.updateCanvasEmptyGuide;

        editorNamespace.updateCanvasEmptyGuide = updateCanvasEmptyGuide;

        return editorNamespace;
    },

    // Detail panel bridge utility
    exposeDetailPanelUpdater: function(options) {
        var opts = options || {};
        var windowRef = opts.windowRef || window;
        var updateDetailPanel = opts.updateDetailPanel;

        windowRef.updateDetailPanel = updateDetailPanel;

        return windowRef;
    },

    // Refresh memories bridge utility
    exposeRefreshMemoriesBridge: function(options) {
        var opts = options || {};
        var windowRef = opts.windowRef || window;
        var refreshMemories = opts.refreshMemories;

        windowRef.refreshMemories = refreshMemories;

        return windowRef;
    },

    // Save status time formatter resolution
    resolveSaveStatusTimeFormatter: function(options) {
        var opts = options || {};
        var editorSaveStatus = opts.editorSaveStatus || {};

        return editorSaveStatus.formatTimeAgo;
    },

    // Toast fallback
    createInlineShowToastFallback: function() {
        return (message, type = 'info') => {
            if (window.LoveBudUI?.showToast) {
                window.LoveBudUI.showToast(message, type, 3000);
            } else {
                if (!window.__editorToastWarningShown) {
                    console.warn('[editor] LoveBudUI not loaded, toast degraded to console');
                    window.__editorToastWarningShown = true;
                }
                console.log(`[Toast ${type}] ${message}`);
            }
        };
    },

    // Shell copy application
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
        setText('detailActionsPrimaryLabel', 'editor_actions_primary', '주요 행동');
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

    // Editor ready marker
    markEditorReady: function(options) {
        var opts = options || {};
        var body = opts.body || document.body;

        if (body && body.classList && typeof body.classList.remove === 'function') {
            body.classList.remove('editor-preload');
        }
    },

    // Editor editability shell state
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

    // Editor debug reporter factory
    createEditorDebugReporter: function(options) {
        var opts = options || {};
        var debugState = opts.debugState || (window.LoveBudEditorDebug = window.LoveBudEditorDebug || { logs: [], errors: [] });
        var consoleRef = opts.consoleRef || console;
        var now = opts.now || function() { return new Date(); };

        var log = function(msg) {
            var entry = '[editor-main] ' + now().toISOString().split('T')[1] + ' ' + msg;
            consoleRef.log(entry);
            debugState.logs.push(entry);
        };

        var reportError = function(msg, err) {
            consoleRef.error('[editor-main] ERROR: ' + msg, err);
            debugState.errors.push({ msg: msg, error: err && err.message ? err.message : err });
        };

        return {
            debugState: debugState,
            log: log,
            reportError: reportError
        };
    },

    // Editor start dependency guard factory
    createEditorStartDependencyGuard: function(options) {
        var opts = options || {};
        var reportError = opts.reportError || function() {};

        return function ensureStartEditorDependency(dependency, message) {
            if (typeof dependency === 'function') return true;
            reportError(message);
            return false;
        };
    },

    // Editor startup dependency waiter factory
    createEditorStartupDependencyWaiter: function(options) {
        var opts = options || {};
        var log = opts.log || function() {};
        var reportError = opts.reportError || function() {};
        var windowRef = opts.windowRef || window;
        var wait = opts.wait || function(ms) {
            return new Promise(function(resolve) {
                setTimeout(resolve, ms);
            });
        };
        var maxAttempts = opts.maxAttempts || 100;
        var intervalMs = opts.intervalMs || 50;

        return async function waitForGlobal(name) {
            log('Waiting for ' + name + '...');
            var count = 0;

            while (typeof windowRef[name] !== 'function' && count < maxAttempts) {
                await wait(intervalMs);
                count++;
            }

            if (typeof windowRef[name] !== 'function') {
                reportError(name + ' not found after 5s');
                return false;
            }

            log(name + ' found.');
            return true;
        };
    },

    // Editor canvas empty guide updater factory
    createEditorCanvasEmptyGuideUpdater: function(options) {
        var opts = options || {};
        var emptyGuideUIHelper = opts.emptyGuideUIHelper || {};
        var getTreeMemories = opts.getTreeMemories || function() { return []; };
        var log = opts.log || function() {};

        if (typeof emptyGuideUIHelper.createCanvasEmptyGuideUpdater === 'function') {
            return emptyGuideUIHelper.createCanvasEmptyGuideUpdater({
                getTreeMemories: getTreeMemories,
                log: log
            });
        }

        return function updateCanvasEmptyGuide() {
            log('WARNING: LoveBudEditorEmptyGuideUI.createCanvasEmptyGuideUpdater missing');
        };
    },

    // YouTube input validation fallback
    getYouTubeInputErrorMessageFallback: function(i18n, rawUrl) {
        var value = String(rawUrl || '').trim();

        if (!value) {
            return i18n('enter_youtube') || 'YouTube 링크를 입력해 주세요.';
        }

        if (!/^(https?:\/\/|www\.)/i.test(value)) {
            return i18n('invalid_youtube_format') || '전체 YouTube 링크를 붙여 넣어 주세요.';
        }

        if (!/(youtube\.com|youtu\.be|youtube\.com\/shorts\/)/i.test(value)) {
            return i18n('invalid_youtube_unsupported') || 'YouTube 링크만 지원합니다. youtube.com 또는 youtu.be 링크를 사용해 주세요.';
        }

        var match = value.match(/(?:v=|\/|youtu\.be\/|shorts\/)([0-9A-Za-z_-]+)/i);
        if (match && match[1].length !== 11) {
            return i18n('invalid_youtube_id_length') || '링크가 중간에 잘린 것 같아요. 전체 YouTube 링크를 다시 복사해 주세요.';
        }

        return i18n('invalid_youtube') || '유효한 YouTube 링크를 입력해 주세요.';
    },

    // Selected moment focus handler factory
    createSelectedMomentFocusHandler: function(options) {
        var opts = options || {};
        var getEditorCanvas = opts.getEditorCanvas || function() { return null; };
        var getSelectedNodeId = opts.getSelectedNodeId || function() { return null; };

        return function focusSelectedMoment() {
            var editorCanvas = getEditorCanvas();
            var selectedNodeId = getSelectedNodeId();

            if (editorCanvas && typeof editorCanvas.focusNodeById === 'function' && selectedNodeId) {
                editorCanvas.focusNodeById(selectedNodeId);
            }
        };
    },

    // Editor select node handler factory
    createEditorSelectNodeHandler: function(options) {
        var opts = options || {};
        var getEditorCanvas = opts.getEditorCanvas || function() { return null; };
        var getSaveStatusData = opts.getSaveStatusData || function() { return null; };
        var editorSelectionUI = opts.editorSelectionUI || {};
        var editorSaveStatus = opts.editorSaveStatus || {};
        var setSelectedNodeId = opts.setSelectedNodeId || function() {};
        var setCurrentEditingMemory = opts.setCurrentEditingMemory || function() {};
        var updateDetailPanel = opts.updateDetailPanel || function() {};
        var updateFocusSelectedBtn = opts.updateFocusSelectedBtn || function() {};
        var setDetailEmptyState = opts.setDetailEmptyState || function() {};
        var reportError = opts.reportError || function() {};

        return function selectNode(el, data) {
            if (!data) return;

            setSelectedNodeId(data.id);
            setCurrentEditingMemory(data);

            if (typeof editorSelectionUI.applySelectedMemoryNode === 'function') {
                editorSelectionUI.applySelectedMemoryNode(el);
            } else {
                reportError('LoveBudEditorSelectionUI.applySelectedMemoryNode missing');
            }

            if (typeof editorSaveStatus.hideSaveStatusIndicator === 'function') {
                editorSaveStatus.hideSaveStatusIndicator(getSaveStatusData());
            }

            updateDetailPanel(data);
            updateFocusSelectedBtn();
            setDetailEmptyState(false);

            var editorCanvas = getEditorCanvas();
            if (editorCanvas && typeof editorCanvas.updateAffordance === 'function') {
                editorCanvas.updateAffordance();
            }
        };
    },

    // Sidebar tree actions updater factory
    createSidebarTreeActionsUpdater: function(options) {
        var opts = options || {};
        var sidebarUIHelper = opts.sidebarUIHelper || {};
        var i18n = opts.i18n;
        var safeI18nText = opts.safeI18nText;
        var getTreeId = opts.getTreeId || function() { return null; };

        return function updateSidebarTreeActions() {
            if (sidebarUIHelper.updateSidebarTreeActions) {
                sidebarUIHelper.updateSidebarTreeActions({
                    i18n: i18n,
                    safeI18nText: safeI18nText,
                    getTreeId: getTreeId
                });
            }
        };
    },

    // Editor sidebar status updater factory
    createEditorSidebarStatusUpdater: function(options) {
        var opts = options || {};
        var updateSidebarStatusBase = opts.updateSidebarStatusBase || function() {};
        var updateCanvasEmptyGuide = opts.updateCanvasEmptyGuide || function() {};
        var updateSidebarTreeActions = opts.updateSidebarTreeActions || function() {};

        return function updateSidebarStatus() {
            updateSidebarStatusBase();
            updateCanvasEmptyGuide();
            updateSidebarTreeActions();
        };
    },

    // Memory actions readiness wrapper factory
    createMemoryActionsReadinessWrapper: function(options) {
        var opts = options || {};
        var getMemoryActions = opts.getMemoryActions || function() { return null; };
        var consoleRef = opts.consoleRef || console;

        return async function updateSelectedMemoryFields() {
            var memoryActions = getMemoryActions();
            var args = Array.prototype.slice.call(arguments);

            if (!memoryActions || typeof memoryActions.updateSelectedMemoryFields !== 'function') {
                consoleRef.warn('[editor] updateSelectedMemoryFields called before memory actions are ready');
                return false;
            }

            return memoryActions.updateSelectedMemoryFields.apply(memoryActions, args);
        };
    },

    // Current moment detail opener factory
    createCurrentMomentDetailOpener: function(options) {
        var opts = options || {};
        var getCurrentEditingMemory = opts.getCurrentEditingMemory || function() { return null; };
        var getTreeMemories = opts.getTreeMemories || function() { return []; };
        var getSelectedNodeId = opts.getSelectedNodeId || function() { return null; };
        var createInitialMemory = opts.createInitialMemory || function() { return null; };
        var getTreeId = opts.getTreeId || function() { return null; };
        var editorPageHelpers = opts.editorPageHelpers || {};
        var getEditorBasePath = opts.getEditorBasePath;
        var locationRef = opts.locationRef || window.location;
        var reportError = opts.reportError || function() {};

        return function openCurrentMomentDetail() {
            var selectedNodeId = getSelectedNodeId();
            var treeMemories = getTreeMemories();
            var activeMemory = getCurrentEditingMemory()
                || treeMemories.find(function(memory) { return memory.id === selectedNodeId; })
                || createInitialMemory();
            var treeId = getTreeId();

            if (!activeMemory || !activeMemory.id || !treeId) return;

            if (typeof editorPageHelpers.openMomentDetail === 'function') {
                editorPageHelpers.openMomentDetail({
                    memoryId: activeMemory.id,
                    treeId: treeId,
                    getEditorBasePath: getEditorBasePath,
                    locationRef: locationRef
                });
            } else {
                reportError('LoveBudEditorPageHelpers.openMomentDetail missing');
            }
        };
    },

    // Editor initial memory provider factory
    createEditorInitialMemoryProvider: function(options) {
        var opts = options || {};
        var editorTreeHelpers = opts.editorTreeHelpers || {};
        var getTreeMemories = opts.getTreeMemories || function() { return []; };
        var findRootMemory = opts.findRootMemory || function() { return null; };
        var canonicalRootId = opts.canonicalRootId;
        var treeId = opts.treeId;
        var i18n = opts.i18n || {};

        return function createInitialMemory() {
            return editorTreeHelpers.createInitialMemory({
                getTreeMemories: getTreeMemories,
                findRootMemory: findRootMemory,
                canonicalRootId: canonicalRootId,
                treeId: treeId,
                i18n: i18n
            });
        };
    },

    // Editor next memory id provider factory
    createEditorNextMemoryIdProvider: function(options) {
        var opts = options || {};
        var nextMemoryIdFromMemories = opts.nextMemoryIdFromMemories;
        var getTreeMemories = opts.getTreeMemories || function() { return []; };

        return function nextMemoryId() {
            return nextMemoryIdFromMemories(getTreeMemories());
        };
    },

    // Save status orchestration fallback factory
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
    }
};
