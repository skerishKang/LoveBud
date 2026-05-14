document.addEventListener('DOMContentLoaded', () => {
    const dataLoaderFallbacks = window.LoveBudEditorDataLoaderFallbacks || {};
    const entryFallbacks = window.LoveBudEditorEntryFallbacks || {};
    const resolverFallbacks = window.LoveBudEditorResolverFallbacks || {};
    const shellHelpers = window.LoveBudEditorShellHelpers || {};

    let rootHelperWarningShown = false;
    const rootUtils = window.LoveBudEditorUtils || {};
    const editorHelpers = window.LoveBudEditorHelpers || {};

    const warnRootHelperFallback = () => {
        if (!rootHelperWarningShown) {
            console.warn('[editor] LoveBudEditorUtils not loaded, using local fallback for root helpers');
            rootHelperWarningShown = true;
        }
    };

    const findRootMemory = rootUtils.findRootMemory || function(memories) {
        warnRootHelperFallback();
        if (!Array.isArray(memories)) return null;

        const parentNullNodes = memories.filter(m => m.parentId === null || m.parentId === undefined);
        if (parentNullNodes.length === 1) {
            return parentNullNodes[0];
        }
        if (parentNullNodes.length > 1) {
            const oldest = parentNullNodes.sort((a, b) => {
                const aTime = a.createdAt || a.timestamp || '9999';
                const bTime = b.createdAt || b.timestamp || '9999';
                return new Date(aTime) - new Date(bTime);
            })[0];
            return oldest;
        }

        return memories.find(m => m.id === 'root') || null;
    };

    const getRootId = rootUtils.getRootId || function(memories) {
        warnRootHelperFallback();
        const root = findRootMemory(memories);
        return root ? root.id : 'root';
    };

    const getCanonicalRootId = rootUtils.getCanonicalRootId || function(memories) {
        warnRootHelperFallback();
        const root = findRootMemory(memories);
        return root ? root.id : 'root';
    };

    const isRootMemory = rootUtils.isRootMemory || function(mem, rootId) {
        warnRootHelperFallback();
        return !!(mem && rootId && mem.id === rootId);
    };

    const editorSaveStatus = window.LoveBudEditorSaveStatus || {};
    const editorPageHelpers = window.LoveBudEditorPageHelpers || {};
    const editorTreeHelpers = window.LoveBudEditorTreeHelpers || {};
    const editorBindings = window.LoveBudEditorBindings || {};
    const editorDataLoader = window.LoveBudEditorDataLoader || {};
    const editorAuthHelpers = window.LoveBudEditorAuthHelpers || {};
    const readConfirmedAuthCacheFromHelper = () => (
        window.LoveBudEditorAuthHelpers?.readConfirmedAuthCache?.() || null
    );
    const getConfirmedSessionUser = function() {
        try {
            if (window.LoveBudProtectedRoute) {
                var state = window.LoveBudProtectedRoute.getAuthState();
                if (state.ready && state.user) return state.user;
            }
            if (window.getConfirmedAuthUser) return window.getConfirmedAuthUser();
        } catch (e) {}
        return readConfirmedAuthCacheFromHelper();
    };
    const hasConfirmedSessionUser = editorAuthHelpers.hasConfirmedSessionUser || (() => !!getConfirmedSessionUser());

    const getHttpStatus = (error) => Number(error?.status || error?.statusCode || error?.response?.status || 0);



    const createInlineShowToastFallback = shellHelpers.createInlineShowToastFallback ||
        entryFallbacks.createInlineShowToastFallback;

    const showToast = editorHelpers.createToast
        ? editorHelpers.createToast({ warningKey: '__editorToastWarningShown' })
        : createInlineShowToastFallback();

    const getI18n = shellHelpers.getI18n || (() => window.t || ((k) => k));
    const i18n = getI18n();

    const getEditorBasePath = shellHelpers.getEditorBasePath || (() =>
        window.location.pathname.indexOf('/pages/') !== -1 ? '' : 'pages/');

    const buildEditorRedirectTarget = shellHelpers.buildEditorRedirectTarget || (() =>
        getEditorBasePath() + 'editor' + (window.location.search || ''));

    const createInlineRedirectToEditorLoginFallback = entryFallbacks.createInlineRedirectToEditorLoginFallback;

    const redirectToEditorLogin = editorPageHelpers.redirectToEditorLogin || createInlineRedirectToEditorLoginFallback({
        getEditorBasePath,
        buildEditorRedirectTarget
    });

    const createInlineTextResolversFallbacks = resolverFallbacks.createInlineTextResolversFallbacks || (() => ({}));
    const inlineTextResolvers = editorHelpers.safeI18nText
        ? editorHelpers
        : createInlineTextResolversFallbacks();

    const safeI18nText = editorHelpers.safeI18nText || inlineTextResolvers.safeI18nText;
    const resolveHintText = editorHelpers.resolveHintText || inlineTextResolvers.resolveHintText;
    const resolveTreeTitleText = editorHelpers.resolveTreeTitleText || inlineTextResolvers.resolveTreeTitleText;
    const resolveInfoText = editorHelpers.resolveInfoText || inlineTextResolvers.resolveInfoText;

    const syncCurrentTreeData = editorTreeHelpers.syncCurrentTreeData || ((tree) => {
        window.currentTreeData = {
            ...tree,
            visibility: tree.visibility || 'public'
        };
    });

    const resolveParentIdForCreate = editorTreeHelpers.resolveParentIdForCreate || ((selectedNodeId, canonicalRootId) => {
        if (!selectedNodeId || selectedNodeId === canonicalRootId) {
            return canonicalRootId === 'root' ? null : canonicalRootId;
        }
        return selectedNodeId;
    });

    const getMyTreesHref = editorPageHelpers.getMyTreesHref || (() => getEditorBasePath() + 'my-trees');
    const createInlineMediaResolversFallbacks = resolverFallbacks.createInlineMediaResolversFallbacks || (() => ({}));

    const escapeHtml = editorHelpers.escapeHtml || ((value) => String(value ?? '')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;'));

    const inlineMediaResolvers = editorHelpers.safeUrl
        ? editorHelpers
        : createInlineMediaResolversFallbacks();

    const resolveMemoryThumbnail = editorHelpers.resolveMemoryThumbnail || inlineMediaResolvers.resolveMemoryThumbnail;

    const getYouTubeInputErrorMessage = editorHelpers.getYouTubeInputErrorMessage || ((rawUrl) => {
        const value = String(rawUrl || '').trim();
        if (!value) return i18n('enter_youtube') || 'YouTube 링크를 입력해 주세요.';
        const looksLikeUrl = /^(https?:\/\/|www\.)/i.test(value);
        const hasYouTubeHint = /(youtube\.com|youtu\.be|youtube\.com\/shorts\/)/i.test(value);
        const idLikeMatch = value.match(/(?:v=|\/|youtu\.be\/|shorts\/)([0-9A-Za-z_-]+)/i);
        const candidateId = idLikeMatch ? idLikeMatch[1] : '';
        if (!looksLikeUrl) return i18n('invalid_youtube_format') || '전체 YouTube 링크를 붙여 넣어 주세요.';
        if (!hasYouTubeHint) return i18n('invalid_youtube_unsupported') || 'YouTube 링크만 지원합니다. youtube.com 또는 youtu.be 링크를 사용해 주세요.';
        if (candidateId && candidateId.length !== 11) return i18n('invalid_youtube_id_length') || '링크가 중간에 잘린 것 같아요. 전체 YouTube 링크를 다시 복사해 주세요.';
        return i18n('invalid_youtube') || '유효한 YouTube 링크를 입력해 주세요.';
    });

    const renderTreeLoadError = editorPageHelpers.renderTreeLoadError ||
        entryFallbacks.createInlineRenderTreeLoadErrorFallback({ getMyTreesHref });
    const createInlineNormalizeMemoryFallback = dataLoaderFallbacks.createInlineNormalizeMemoryFallback || (() => (mem) => mem);
    const createInlineLoadInitialTreeFallback = dataLoaderFallbacks.createInlineLoadInitialTreeFallback || (() => async () => ({}));
    const createInlineLoadEditorMemoriesFallback = dataLoaderFallbacks.createInlineLoadEditorMemoriesFallback || (() => async () => ({}));
    const createInlineCreateInitialMemoryFallback = dataLoaderFallbacks.createInlineCreateInitialMemoryFallback || ((options) => () => ({}));
    const createInlineNextMemoryIdFallback = dataLoaderFallbacks.createInlineNextMemoryIdFallback || ((options) => () => 'm1');
    const createInlineRefreshMemoriesFallback = dataLoaderFallbacks.createInlineRefreshMemoriesFallback || ((options) => async () => {});
    const createInlineFormatTimeAgoFallback = entryFallbacks.createInlineFormatTimeAgoFallback;

    const markEditorReady = () => document.body?.classList.remove('editor-preload');

    const createEditorShellCopyApplier = ({ safeI18nText, i18n }) => {
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

        const textBindings = [
            ['backToMyTreesLabel', 'editor_back_to_my_trees', '내 러브트리로 돌아가기'],
            ['editorFlowHeading', 'sidebar_flow_heading', '트리 정보'],
            ['editorFlowLead', 'sidebar_flow_lead', '트리 이름과 공개 상태를 여기서 정리하고, 가운데 캔버스에서는 흐름만 살펴보세요.'],
            ['sidebarVisibilityToggleBtnLabel', 'editor_make_public', '이 트리 공개하기'],
            ['recenterCanvasBtnLabel', 'sidebar_recenter_tree', '트리 한눈에 보기'],
            ['addMemoryEyebrow', 'editor_add_memory_eyebrow', '다음 순간 심기'],
            ['addMemoryIntro', 'editor_add_memory_intro', '지금 마음이 머문 다음 장면을 이어 심어 보세요. 첫 순간이라면 여기서 러브트리가 시작됩니다.'],
            ['saveStatusText', 'save_saved', '저장됨'],
            ['detailMoreBtn', 'editor_open_detail', '상세로 보기'],
            ['detailEmptyStartBtn', 'editor_add_first_memory', '첫 순간 심기'],
            ['canvasEmptyGuideEyebrow', 'editor_canvas_empty_eyebrow', '첫 순간 준비'],
            ['canvasEmptyGuideTitle', 'editor_canvas_empty_title', '이 장면에서 러브트리가 시작돼요'],
            ['canvasEmptyGuideDesc', 'editor_canvas_empty_desc', '첫 순간을 심으면 이 공간에 감정의 흐름이 천천히 뻗어나갑니다.'],
            ['canvasEmptyStartBtn', 'editor_add_first_memory', '첫 순간 심기'],
            ['addMemoryFormEyebrow', 'editor_add_first_memory', '첫 순간 심기'],
            ['addMemoryFormTitle', 'editor_new_memory', '어떤 순간이 이어졌나요?'],
            ['addMemoryFormIntro', 'editor_add_memory_intro', '지금 마음이 머문 다음 장면을 이어 심어 보세요. 첫 순간이라면 여기서 러브트리가 시작됩니다.'],
            ['memoryUrlLabel', 'editor_youtube_link', 'YouTube 장면 링크'],
            ['memoryTitleLabel', 'editor_memory_title', '순간 제목'],
            ['memoryMemoLabel', 'editor_memory_memo_optional', '감정 메모'],
            ['cancelAddMemory', 'editor_cancel', '취소'],
            ['confirmAddMemory', 'editor_confirm_add', '이 순간 심기'],
            ['detailEmptyTitle', 'detail_empty_title', '첫 순간이 트리를 깨워요'],
            ['detailEmptyDesc', 'detail_empty_desc', '첫 순간을 심으면 이 패널이 현재 순간 허브로 바뀝니다.'],
            ['detailCurrentMomentBadge', 'editor_current_moment_badge', '현재 순간'],
            ['detailCurrentMomentTitle', 'editor_current_moment_title', '지금 마음이 머문 장면'],
            ['detailCurrentMomentHint', 'editor_current_moment_hint', '선택한 순간을 중심으로 감정 메모와 다음 행동이 정리됩니다.'],
            ['detailMomentInfoLabel', 'editor_moment_info_label', '순간 정보'],
            ['detailTreeStatusLabel', 'current_tree', '현재 트리'],
            ['detailDateLabel', 'editor_date_label', '기억한 날'],
            ['detailTagsLabel', 'editor_tag_label', '감정 태그'],
            ['detailMemoLabel', 'editor_note_label', '감정 메모'],
            ['editMemoryBtn', 'editor_edit', '순간 수정'],
            ['editMemoryBtnLabel', 'editor_edit', '순간 수정'],
            ['viewMomentDetailBtnLabel', 'editor_view_moment_detail', '현재 순간 감상하기'],
            ['continueFromMomentBtnLabel', 'editor_continue_from_moment', '이 순간에서 이어가기'],
            ['detailActionsPrimaryLabel', 'editor_actions_primary', '주요 행동'],
            ['deleteMemoryBtn', 'editor_delete', '순간 삭제'],
            ['editTitleLabel', 'editor_memory_title', '제목'],
            ['editMemoLabel', 'editor_note_label', '감정 메모'],
            ['editTagsLabel', 'editor_edit_tag_label', '감정 태그 (쉼표로 구분)'],
            ['cancelEditBtn', 'editor_cancel', '취소'],
            ['saveEditBtn', 'editor_save', '저장하기'],
            ['detailSubmitBtn', 'editor_record_submit', '내 러브트리에 기록하기']
        ];

        const placeholderBindings = [
            ['memoryTitleInput', 'editor_memory_title_placeholder', '이 순간을 어떻게 기억하고 싶은지 적어보세요'],
            ['memoryMemoInput', 'editor_memory_memo_placeholder', '왜 이 장면이 이어졌는지, 지금 마음을 남겨보세요...'],
            ['editTitleInput', 'editor_edit_title_placeholder', '순간의 제목을 입력하세요'],
            ['editMemoInput', 'editor_memory_memo_placeholder', '이 순간의 감정을 남겨보세요...'],
            ['editTagsInput', 'editor_edit_tag_placeholder', '#감동, #행복, #그리움']
        ];

        return () => {
            textBindings.forEach(([id, key, fallback]) => setText(id, key, fallback));
            placeholderBindings.forEach(([id, key, fallback]) => setPlaceholder(id, key, fallback));
        };
    };

    const applyEditorShellCopy = shellHelpers.applyEditorShellCopy ||
        createEditorShellCopyApplier({ safeI18nText, i18n });

    applyEditorShellCopy(safeI18nText, i18n);

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

    const prepareEditorShell = () => {
        applyEditorShellCopy(safeI18nText, i18n);
        const backToMyTreesLink = document.getElementById('backToMyTreesLink');
        if (backToMyTreesLink) {
            backToMyTreesLink.setAttribute('href', getMyTreesHref());
            backToMyTreesLink.setAttribute('aria-label', safeI18nText(i18n, 'editor_back_to_my_trees', '내 러브트리로 돌아가기'));
        }
        const detailEmptyState = document.getElementById('detailEmptyState');
        const detailViewMode = document.getElementById('detailViewMode');
        const detailEditMode = document.getElementById('detailEditMode');
        if (detailEmptyState) detailEmptyState.style.display = 'block';
        if (detailViewMode) detailViewMode.style.display = 'none';
        if (detailEditMode) detailEditMode.style.display = 'none';
    };

    const startEditor = async () => {
        const { canvas, svg, detailPanel, addBtn } = createEditorDomRefs();
        const urlParams = new URLSearchParams(window.location.search);
        const urlTreeId = urlParams.get('treeId');

        prepareEditorShell();

        const cache = window.LoveBudCache || null;
        let MEMORIES_CACHE_KEY = 'memories_default';
        let isLocalSaveMode = false;

        const loadInitialTree = editorDataLoader.loadInitialEditorTree || createInlineLoadInitialTreeFallback();
        const treeLoadResult = await loadInitialTree({
            urlTreeId,
            apiClient: window.apiClient,
            createDefaultTreeTitle: () => safeI18nText(i18n, 'default_tree_title', '러브트리'),
            getConfirmedSessionUser
        });

        let tree = treeLoadResult.tree || null;
        if (!tree) {
            if (treeLoadResult.authRequired) {
                showToast(i18n('need_login'), 'error');
                redirectToEditorLogin(2000);
                return;
            }
            if (urlTreeId) {
                const treeLoadStatus = treeLoadResult.treeLoadStatus || 'not_found';
                const treeLoadErrorMessage = treeLoadResult.treeLoadErrorMessage || '';
                const errorTitle = treeLoadStatus === 'api_unavailable'
                    ? (i18n('tree_load_fail_title') || '트리를 불러올 수 없어요')
                    : /Access denied/i.test(treeLoadErrorMessage)
                        ? (i18n('tree_access_denied_title') || '이 러브트리를 열 권한이 없어요')
                        : treeLoadStatus === 'error'
                            ? (i18n('tree_load_error_title') || '트리를 여는 중 문제가 발생했어요')
                            : (i18n('tree_not_found_title') || '트리를 찾을 수 없어요');
                const errorDesc = treeLoadStatus === 'api_unavailable'
                    ? (i18n('tree_load_api_unavailable') || '트리 조회 API를 사용할 수 없는 상태입니다. 잠시 후 다시 시도해 주세요.')
                    : /Access denied/i.test(treeLoadErrorMessage)
                        ? (i18n('tree_access_denied_desc') || '비공개 러브트리이거나 내 계정에 권한이 없어요. 다시 확인하거나 다른 계정으로 로그인해 보세요.')
                        : treeLoadStatus === 'error'
                            ? (i18n('tree_load_error_desc') || '일시적인 서버 문제 또는 접근 권한 문제일 수 있습니다. 다시 시도하거나 트리 목록으로 돌아가 주세요.')
                            : (i18n('tree_load_not_found_desc') || '잘못된 링크이거나 접근 권한이 없는 트리입니다.');
                renderTreeLoadError({ canvas, addBtn, errorTitle, errorDesc, i18n, escapeHtml, setDetailEmptyState: null });
                markEditorReady();
                return;
            }
            markEditorReady();
            return;
        }

        syncCurrentTreeData(tree);
        const treeId = tree.id || null;
        MEMORIES_CACHE_KEY = 'memories_' + (treeId || 'default');

        const normalizeMemory = editorDataLoader.createNormalizeMemory
            ? editorDataLoader.createNormalizeMemory({ sharedNormalize: window.LoveBudNormalize?.normalizeMemory })
            : (window.LoveBudNormalize?.normalizeMemory || createInlineNormalizeMemoryFallback());

        await (editorDataLoader.loadEditorMemories || createInlineLoadEditorMemoriesFallback())({
            treeId,
            cache,
            cacheKey: MEMORIES_CACHE_KEY,
            apiClient: window.apiClient,
            showToast,
            i18n,
            normalizeMemory
        });

        const treeMemories = () => (window.currentTreeMemories || []).map(normalizeMemory).filter(Boolean);
        const canonicalRootId = getCanonicalRootId(treeMemories());
        let selectedNodeId = canonicalRootId;
        let currentEditingMemory = null;
        let editorCanvas = null;

        let memoryActions = null;
        const updateSelectedMemoryFields = async (...args) => {
            if (!memoryActions || typeof memoryActions.updateSelectedMemoryFields !== 'function') {
                console.warn('[editor] updateSelectedMemoryFields called before memory actions are ready');
                return false;
            }
            return memoryActions.updateSelectedMemoryFields(...args);
        };

        const createInitialMemory = editorTreeHelpers.createInitialMemory
            ? () => editorTreeHelpers.createInitialMemory({ getTreeMemories: () => treeMemories(), findRootMemory, canonicalRootId, treeId, i18n })
            : createInlineCreateInitialMemoryFallback({ treeMemories, findRootMemory, canonicalRootId, treeId, i18n });

        const nextMemoryId = editorTreeHelpers.nextMemoryIdFromMemories
            ? () => editorTreeHelpers.nextMemoryIdFromMemories(treeMemories())
            : createInlineNextMemoryIdFallback({ treeMemories });

        const updateCanvasEmptyGuide = () => {
            const guide = document.getElementById('canvasEmptyGuide');
            if (!guide) return;
            const hasMoments = treeMemories().length > 0;
            guide.classList.toggle('editor-canvas-empty-guide-hidden', hasMoments);
        };

        const selectNode = (el, data) => {
            if (!data) return;
            selectedNodeId = data.id;
            currentEditingMemory = data;
            document.querySelectorAll('.memory-node').forEach(n => n.classList.remove('selected'));
            if (el) el.classList.add('selected');

            const indicator = document.getElementById('saveStatusIndicator');
            if (indicator && saveStatusData.timer) {
                clearTimeout(saveStatusData.timer);
                saveStatusData.timer = null;
            }
            if (indicator) indicator.style.display = 'none';

            updateDetailPanel(data);
            updateFocusSelectedBtn();
            setDetailEmptyState(false);

            // Immediately update the + tip affordance for the newly selected node
            if (editorCanvas && typeof editorCanvas.updateAffordance === 'function') {
                editorCanvas.updateAffordance();
            }
        };

        const focusSelectedMoment = () => {
            if (editorCanvas && typeof editorCanvas.focusNodeById === 'function' && selectedNodeId) {
                editorCanvas.focusNodeById(selectedNodeId);
            }
        };

        const openCurrentMomentDetail = () => {
            const activeMemory = currentEditingMemory || treeMemories().find((m) => m.id === selectedNodeId) || createInitialMemory();
            if (!activeMemory || !activeMemory.id || !treeId) return;
            const detailHref = getEditorBasePath() + 'detail.html?id=' + encodeURIComponent(activeMemory.id) + '&tree=' + encodeURIComponent(treeId) + '&from=editor';
            window.location.href = detailHref;
        };

        const updateTreeVisibility = async (nextVisibility) => {
            if (!treeId || !window.apiClient || typeof window.apiClient.updateTree !== 'function') {
                throw new Error('updateTree not available');
            }
            const updatedTree = await window.apiClient.updateTree(treeId, { visibility: nextVisibility });
            window.currentTreeData = {
                ...(window.currentTreeData || {}),
                ...(updatedTree || {}),
                visibility: updatedTree?.visibility || nextVisibility
            };
            updateSidebarStatus();
            if (currentEditingMemory) updateDetailPanel(currentEditingMemory);
        };

        const detailUI = window.createEditorDetailUI({
            detailPanel,
            i18n,
            resolveTreeTitleText,
            resolveHintText,
            resolveInfoText,
            resolveMemoryThumbnail,
            escapeHtml,
            isRootMemory,
            getCanonicalRootId: () => canonicalRootId,
            getSelectedNodeId: () => selectedNodeId,
            getTreeMemories: () => treeMemories(),
            getCurrentTreeData: () => window.currentTreeData || {},
            getLocalSaveMode: () => isLocalSaveMode,
            showToast,
            updateTreeVisibility,
            openCurrentMomentDetail,
            focusSelectedMoment,
            updateSelectedMemoryFields
        });

        const { setDetailEmptyState, updateFocusSelectedBtn, updateSidebarStatus: updateSidebarStatusBase, updateDetailPanel } = detailUI;
        window.updateDetailPanel = updateDetailPanel;

        const updateSidebarTreeActions = () => {
            const visibilityToggleBtn = document.getElementById('sidebarVisibilityToggleBtn');
            const visibilityToggleLabel = document.getElementById('sidebarVisibilityToggleBtnLabel');
            const visibilityToggleIcon = document.getElementById('sidebarVisibilityToggleBtnIcon');
            if (!visibilityToggleBtn || !visibilityToggleLabel || !visibilityToggleIcon) return;

            const visibility = (window.currentTreeData?.visibility || 'public');
            const isPublic = visibility === 'public';
            const nextActionLabel = isPublic
                ? safeI18nText(i18n, 'editor_make_private', '이 트리 비공개로 전환')
                : safeI18nText(i18n, 'editor_make_public', '이 트리 공개하기');

            visibilityToggleLabel.textContent = nextActionLabel;
            visibilityToggleIcon.textContent = isPublic ? 'lock' : 'public';
            visibilityToggleBtn.setAttribute('aria-label', nextActionLabel);
            visibilityToggleBtn.setAttribute('title', nextActionLabel);
            visibilityToggleBtn.disabled = !treeId;
            visibilityToggleBtn.dataset.idleLabel = nextActionLabel;
            visibilityToggleBtn.dataset.loadingLabel = isPublic
                ? safeI18nText(i18n, 'editor_visibility_loading_private', '비공개로 전환하는 중...')
                : safeI18nText(i18n, 'editor_visibility_loading_public', '공개로 전환하는 중...');
        };

        const updateSidebarStatus = () => {
            updateSidebarStatusBase();
            updateCanvasEmptyGuide();
            updateSidebarTreeActions();
        };

        editorCanvas = window.createEditorCanvas({
            canvas,
            svg,
            getTreeMemories: () => treeMemories(),
            getCanonicalRootId: () => canonicalRootId,
            isRootMemory,
            resolveMemoryThumbnail,
            updateDetailPanel,
            setDetailEmptyState,
            updateFocusSelectedBtn,
            createInitialMemory,
            onNodeClick: selectNode,
            openAddMoment: () => showAddMemoryForm()
        });

        const { calcPosition, drawBranch, drawNode, initCanvas } = editorCanvas;

        const handleMemoriesUpdated = () => {
            initCanvas();
            updateSidebarStatus();
            if (currentEditingMemory) {
                const refreshedEditingMemory = treeMemories().find((memory) => memory.id === currentEditingMemory.id);
                if (refreshedEditingMemory) {
                    currentEditingMemory = refreshedEditingMemory;
                    updateDetailPanel(refreshedEditingMemory);
                }
            }
        };

        const refreshMemories = editorDataLoader.createRefreshMemories
            ? editorDataLoader.createRefreshMemories({ treeId, apiClient: window.apiClient, normalizeMemory, onMemoriesUpdated: handleMemoriesUpdated })
            : createInlineRefreshMemoriesFallback({ treeId, apiClient: window.apiClient, normalizeMemory, onMemoriesUpdated: handleMemoriesUpdated });
        window.refreshMemories = refreshMemories;

        let saveStatusData = editorSaveStatus.createSaveStatusState
            ? editorSaveStatus.createSaveStatusState()
            : { status: 'saved', lastSaved: null, timer: null };

        function updateSaveStatus(status, message) {
            if (editorSaveStatus.updateSaveStatus) {
                saveStatusData = editorSaveStatus.updateSaveStatus(saveStatusData, { status, message, i18n }) || saveStatusData;
                return;
            }
            const indicator = document.getElementById('saveStatusIndicator');
            const iconEl = document.getElementById('saveStatusIcon');
            const textEl = document.getElementById('saveStatusText');
            const timeEl = document.getElementById('lastSavedTime');
            if (!indicator || !iconEl || !textEl) return;
            if (saveStatusData.timer) {
                clearTimeout(saveStatusData.timer);
                saveStatusData.timer = null;
            }
            saveStatusData.status = status;
            const hideLater = (ms) => {
                saveStatusData.timer = setTimeout(() => { indicator.style.display = 'none'; }, ms);
            };
            if (status === 'saving') {
                iconEl.textContent = 'hourglass_empty';
                textEl.textContent = message || i18n('save_saving');
                indicator.className = 'save-status-indicator saving';
                indicator.style.display = 'flex';
                if (timeEl) timeEl.style.display = 'none';
                return;
            }
            if (status === 'saved') {
                iconEl.textContent = 'check_circle';
                textEl.textContent = message || i18n('save_saved');
                indicator.className = 'save-status-indicator saved';
                saveStatusData.lastSaved = new Date();
                if (timeEl) {
                    timeEl.style.display = 'inline';
                    timeEl.textContent = formatTimeAgo(saveStatusData.lastSaved);
                }
                hideLater(3000);
                return;
            }
            if (status === 'failed') {
                iconEl.textContent = 'error';
                textEl.textContent = message || i18n('save_failed');
                indicator.className = 'save-status-indicator failed';
                if (timeEl) timeEl.style.display = 'none';
                hideLater(5000);
            }
        }

        const formatTimeAgo = editorSaveStatus.formatTimeAgo || createInlineFormatTimeAgoFallback();

        memoryActions = window.createEditorMemoryActions({
            i18n,
            updateSaveStatus,
            updateDetailPanel,
            updateSidebarStatus,
            showToast,
            getCurrentEditingMemory: () => currentEditingMemory,
            setCurrentEditingMemory: (value) => { currentEditingMemory = value; },
            getTreeMemories: () => window.currentTreeMemories || [],
            setTreeMemories: (value) => { window.currentTreeMemories = value; },
            getSelectedNodeId: () => selectedNodeId,
            setSelectedNodeId: (value) => { selectedNodeId = value; },
            getCanonicalRootId: () => canonicalRootId,
            isRootMemory,
            findRootMemory,
            detailPanel,
            svg,
            calcPosition,
            setDetailEmptyState,
            rerenderCanvas: () => initCanvas(),
            getCurrentTreeData: () => window.currentTreeData || {},
            isLocalSaveMode: () => isLocalSaveMode
        });

        const { enterEditMode, exitEditMode, saveMemoryEdit, deleteMemory } = memoryActions;

        const memoryForm = window.createEditorMemoryForm({
            i18n,
            treeId,
            getSelectedNodeId: () => selectedNodeId,
            getCanonicalRootId: () => canonicalRootId,
            resolveParentIdForCreate,
            updateSaveStatus,
            showToast,
            getYouTubeInputErrorMessage: (rawUrl) => getYouTubeInputErrorMessage(i18n, rawUrl),
            nextMemoryId,
            normalizeMemory,
            getTreeMemories: () => window.currentTreeMemories || [],
            setTreeMemories: (value) => { window.currentTreeMemories = value; },
            setLocalSaveMode: (value) => { isLocalSaveMode = value; },
            getLocalSaveMode: () => isLocalSaveMode,
            drawNode,
            drawBranch,
            calcPosition,
            updateSidebarStatus,
            updateFocusSelectedBtn,
            setDetailEmptyState,
            selectNode,
            treeMemories,
            setCachedMemories: window.setCachedMemories,
            canvasArea: canvas,
            rerenderCanvas: () => initCanvas(),
            focusNodeById: (id) => editorCanvas.focusNodeById(id)
        });

        const { showAddMemoryForm, hideAddMemoryForm, addMemoryFromForm } = memoryForm;
        const { urlInput, titleInput, memoInput, cancelBtn, confirmBtn } = createEditorFormRefs();
        const sidebarVisibilityToggleBtn = document.getElementById('sidebarVisibilityToggleBtn');
        const sidebarVisibilityToggleBtnLabel = document.getElementById('sidebarVisibilityToggleBtnLabel');
        const sidebarVisibilityToggleBtnIcon = document.getElementById('sidebarVisibilityToggleBtnIcon');
        if (sidebarVisibilityToggleBtn && sidebarVisibilityToggleBtn.dataset.bound !== '1') {
            sidebarVisibilityToggleBtn.dataset.bound = '1';
            sidebarVisibilityToggleBtn.addEventListener('click', async () => {
                if (!treeId) return;
                const currentVisibility = window.currentTreeData?.visibility || 'public';
                const isCurrentlyPublic = currentVisibility === 'public';
                const idleLabel = sidebarVisibilityToggleBtn.dataset.idleLabel || sidebarVisibilityToggleBtnLabel?.textContent || '';
                const loadingLabel = sidebarVisibilityToggleBtn.dataset.loadingLabel || (isCurrentlyPublic
                    ? safeI18nText(i18n, 'editor_visibility_loading_private', '비공개로 전환하는 중...')
                    : safeI18nText(i18n, 'editor_visibility_loading_public', '공개로 전환하는 중...'));

                sidebarVisibilityToggleBtn.disabled = true;
                if (sidebarVisibilityToggleBtnLabel) {
                    sidebarVisibilityToggleBtnLabel.textContent = loadingLabel;
                }
                if (sidebarVisibilityToggleBtnIcon) {
                    sidebarVisibilityToggleBtnIcon.textContent = 'hourglass_empty';
                }
                try {
                    await updateTreeVisibility(isCurrentlyPublic ? 'private' : 'public');
                    showToast(
                        isCurrentlyPublic
                            ? (i18n('editor_visibility_updated_private') || '이 트리를 비공개로 전환했어요.')
                            : (i18n('editor_visibility_updated_public') || '이 트리를 공개로 전환했어요.'),
                        'success'
                    );
                } catch (error) {
                    console.error('[editor] Failed to toggle sidebar visibility:', error);
                    const status = getHttpStatus(error);
                    const message = String(error?.message || '');
                    const isPublicationGuard = status === 409 || /공개 순간이|at least 3 public moments/i.test(message);
                    showToast(
                        isPublicationGuard
                            ? (i18n('editor_visibility_guard_failed') || '공개 순간이 3개 이상일 때만 이 트리를 공개할 수 있어요.')
                            : (i18n('editor_visibility_update_failed') || '공개 상태를 바꾸지 못했어요.'),
                        'error'
                    );
                } finally {
                    if (sidebarVisibilityToggleBtnLabel) {
                        sidebarVisibilityToggleBtnLabel.textContent = idleLabel;
                    }
                    updateSidebarStatus();
                }
            });
        }

        if (editorBindings.bindMemoryCreateControls) {
            editorBindings.bindMemoryCreateControls({ addBtn, cancelBtn, confirmBtn, urlInput, titleInput, memoInput, showAddMemoryForm, hideAddMemoryForm, addMemoryFromForm, updateSaveStatus, showToast, i18n });
        }

        const detailEmptyStartBtn = document.getElementById('detailEmptyStartBtn');
        if (detailEmptyStartBtn) {
            detailEmptyStartBtn.addEventListener('click', () => {
                showAddMemoryForm();
            });
        }

        const canvasEmptyStartBtn = document.getElementById('canvasEmptyStartBtn');
        if (canvasEmptyStartBtn) {
            canvasEmptyStartBtn.addEventListener('click', () => {
                showAddMemoryForm();
            });
        }

        initCanvas();
        updateCanvasEmptyGuide();
        const initialSelection = treeMemories().find((memory) => memory.id === selectedNodeId) || createInitialMemory();
        if (initialSelection && !isRootMemory(initialSelection, canonicalRootId)) {
            currentEditingMemory = initialSelection;
            updateDetailPanel(initialSelection);
        }

        const editMemoryBtn = document.getElementById('editMemoryBtn');
        const deleteMemoryBtn = document.getElementById('deleteMemoryBtn');
        const cancelEditBtn = document.getElementById('cancelEditBtn');
        const saveEditBtn = document.getElementById('saveEditBtn');
        if (editorBindings.bindDetailActionButtons) {
            editorBindings.bindDetailActionButtons({ editMemoryBtn, deleteMemoryBtn, cancelEditBtn, saveEditBtn, enterEditMode, deleteMemory, exitEditMode, saveMemoryEdit });
        }

        updateSidebarStatus();
        markEditorReady();
    };

    var editorStarted = false;

    function tryStartEditor(user) {
        if (editorStarted) {
            if (user && (!window.currentTreeMemories || window.currentTreeMemories.length <= 1)) {
                if (window.refreshMemories) window.refreshMemories();
            }
            return;
        }
        if (!user) {
            var cachedUser = readConfirmedAuthCacheFromHelper();
            if (!cachedUser || !cachedUser.uid) {
                redirectToEditorLogin();
                return;
            }
        }
        editorStarted = true;
        startEditor();
    }

    if (typeof window.registerOnAuthReady === 'function') {
        window.registerOnAuthReady(tryStartEditor);
    } else {
        window.onAuthReady = tryStartEditor;
    }
});
