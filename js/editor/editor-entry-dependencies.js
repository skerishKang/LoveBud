(function() {
    'use strict';

    function bootstrapError(windowRef, message) {
        const debugState = windowRef.LoveBudEditorDebug = windowRef.LoveBudEditorDebug || { logs: [], errors: [] };
        console.error('[editor-main] ERROR: ' + message);
        debugState.errors.push({ msg: message, error: message });
        return { status: 'stopped' };
    }

    function stopMissing(windowRef, name) {
        return bootstrapError(windowRef, name + ' missing');
    }

    function stopMissingList(windowRef, missingHelpers) {
        return bootstrapError(windowRef, missingHelpers.map(([name]) => name + ' missing').join('; '));
    }

    function resolveEditorEntryDependencies(options) {
        const opts = options || {};
        const windowRef = opts.windowRef || window;

        const dataLoaderFallbacks = windowRef.LoveBudEditorDataLoaderFallbacks || {};
        const entryFallbacks = windowRef.LoveBudEditorEntryFallbacks || {};
        const shellHelpers = windowRef.LoveBudEditorShellHelpers || {};
        const rootUtils = windowRef.LoveBudEditorUtils || {};
        const editorHelpers = windowRef.LoveBudEditorHelpers || {};
        const editorSaveStatus = windowRef.LoveBudEditorSaveStatus || {};
        const editorPageHelpers = windowRef.LoveBudEditorPageHelpers || {};
        const editorTreeHelpers = windowRef.LoveBudEditorTreeHelpers || {};
        const editorSelectionUI = windowRef.LoveBudEditorSelectionUI || {};
        const editorBindings = windowRef.LoveBudEditorBindings || {};
        const editorPageEventBindings = windowRef.LoveBudEditorPageEventBindings || {};
        const editorDataLoader = windowRef.LoveBudEditorDataLoader || {};
        const editorInitialLoadFlow = windowRef.LoveBudEditorInitialLoadFlow || {};
        const editorRefreshSaveRuntime = windowRef.LoveBudEditorRefreshSaveRuntime || {};
        const editorStartupContext = windowRef.LoveBudEditorStartupContext || {};
        const editorAuthHelpers = windowRef.LoveBudEditorAuthHelpers || {};
        const editorShellCopyApplier = windowRef.LoveBudEditorShellCopyApplier || {};
        const editorDomRefsBuilder = windowRef.LoveBudEditorDomRefsBuilder || {};

        const findRootMemory = rootUtils.findRootMemory,
            getCanonicalRootId = rootUtils.getCanonicalRootId,
            isRootMemory = rootUtils.isRootMemory;

        const missingRootHelpers = [
            ['LoveBudEditorUtils.findRootMemory', findRootMemory],
            ['LoveBudEditorUtils.getCanonicalRootId', getCanonicalRootId],
            ['LoveBudEditorUtils.isRootMemory', isRootMemory]
        ].filter(([, helper]) => typeof helper !== 'function');

        if (missingRootHelpers.length) return stopMissingList(windowRef, missingRootHelpers);

        const createInlineShowToastFallback = shellHelpers.createInlineShowToastFallback;
        if (typeof createInlineShowToastFallback !== 'function') return stopMissing(windowRef, 'LoveBudEditorShellHelpers.createInlineShowToastFallback');

        const showToast = editorHelpers.createToast
            ? editorHelpers.createToast({ warningKey: '__editorToastWarningShown' })
            : createInlineShowToastFallback();

        const getI18n = shellHelpers.getI18n;
        if (typeof getI18n !== 'function') return stopMissing(windowRef, 'LoveBudEditorShellHelpers.getI18n');
        const i18n = getI18n();

        const getEditorBasePath = shellHelpers.getEditorBasePath;
        if (typeof getEditorBasePath !== 'function') return stopMissing(windowRef, 'LoveBudEditorShellHelpers.getEditorBasePath');

        const redirectToEditorLogin = editorPageHelpers.redirectToEditorLogin;
        if (typeof redirectToEditorLogin !== 'function') return stopMissing(windowRef, 'LoveBudEditorPageHelpers.redirectToEditorLogin');

        const safeI18nText = editorHelpers.safeI18nText;
        const resolveHintText = editorHelpers.resolveHintText;
        const resolveTreeTitleText = editorHelpers.resolveTreeTitleText;
        const resolveInfoText = editorHelpers.resolveInfoText;
        const missingTextResolvers = [
            ['LoveBudEditorHelpers.safeI18nText', safeI18nText],
            ['LoveBudEditorHelpers.resolveHintText', resolveHintText],
            ['LoveBudEditorHelpers.resolveTreeTitleText', resolveTreeTitleText],
            ['LoveBudEditorHelpers.resolveInfoText', resolveInfoText]
        ].filter(([, helper]) => typeof helper !== 'function');
        if (missingTextResolvers.length) return stopMissingList(windowRef, missingTextResolvers);

        const syncCurrentTreeData = editorTreeHelpers.syncCurrentTreeData;
        if (typeof syncCurrentTreeData !== 'function') return stopMissing(windowRef, 'LoveBudEditorTreeHelpers.syncCurrentTreeData');

        const resolveParentIdForCreate = editorTreeHelpers.resolveParentIdForCreate;
        if (typeof resolveParentIdForCreate !== 'function') return stopMissing(windowRef, 'LoveBudEditorTreeHelpers.resolveParentIdForCreate');

        const getMyTreesHref = editorPageHelpers.getMyTreesHref;
        if (typeof getMyTreesHref !== 'function') return stopMissing(windowRef, 'LoveBudEditorPageHelpers.getMyTreesHref');

        const escapeHtml = editorHelpers.escapeHtml;
        const resolveMemoryThumbnail = editorHelpers.resolveMemoryThumbnail;
        const missingMediaResolvers = [
            ['LoveBudEditorHelpers.escapeHtml', escapeHtml],
            ['LoveBudEditorHelpers.safeUrl', editorHelpers.safeUrl],
            ['LoveBudEditorHelpers.resolveMemoryThumbnail', resolveMemoryThumbnail]
        ].filter(([, helper]) => typeof helper !== 'function');
        if (missingMediaResolvers.length) return stopMissingList(windowRef, missingMediaResolvers);

        const getYouTubeInputErrorMessageFallback = shellHelpers.getYouTubeInputErrorMessageFallback;
        if (typeof getYouTubeInputErrorMessageFallback !== 'function') return stopMissing(windowRef, 'LoveBudEditorShellHelpers.getYouTubeInputErrorMessageFallback');
        const getYouTubeInputErrorMessage = typeof rootUtils.getYouTubeInputErrorMessage === 'function' ? rootUtils.getYouTubeInputErrorMessage : getYouTubeInputErrorMessageFallback;

        const renderTreeLoadError = editorPageHelpers.renderTreeLoadError;
        if (typeof renderTreeLoadError !== 'function') return stopMissing(windowRef, 'LoveBudEditorPageHelpers.renderTreeLoadError');

        const buildTreeLoadErrorCopy = editorPageHelpers.buildTreeLoadErrorCopy;
        if (typeof buildTreeLoadErrorCopy !== 'function') return stopMissing(windowRef, 'LoveBudEditorPageHelpers.buildTreeLoadErrorCopy');

        const applyEditorShellCopy = shellHelpers.applyEditorShellCopy;
        if (typeof applyEditorShellCopy !== 'function') return stopMissing(windowRef, 'LoveBudEditorShellHelpers.applyEditorShellCopy');

        const createPrepareEditorShell = editorShellCopyApplier.createPrepareEditorShell;
        if (typeof createPrepareEditorShell !== 'function') return stopMissing(windowRef, 'LoveBudEditorShellCopyApplier.createPrepareEditorShell');

        const createEditorDebugReporter = shellHelpers.createEditorDebugReporter;
        if (typeof createEditorDebugReporter !== 'function') return stopMissing(windowRef, 'LoveBudEditorShellHelpers.createEditorDebugReporter');

        const readConfirmedAuthCacheFromHelper = () => (
            windowRef.LoveBudEditorAuthHelpers?.readConfirmedAuthCache?.() || null
        );
        const getConfirmedSessionUser = function() {
            try {
                if (windowRef.LoveBudProtectedRoute) {
                    var state = windowRef.LoveBudProtectedRoute.getAuthState();
                    if (state.ready && state.user) return state.user;
                }
                if (windowRef.getConfirmedAuthUser) return windowRef.getConfirmedAuthUser();
            } catch (e) {}
            return readConfirmedAuthCacheFromHelper();
        };

        return {
            status: 'ready',
            deps: {
                dataLoaderFallbacks,
                entryFallbacks,
                shellHelpers,
                rootUtils,
                editorHelpers,
                editorSaveStatus,
                editorPageHelpers,
                editorTreeHelpers,
                editorSelectionUI,
                editorBindings,
                editorPageEventBindings,
                bindEditorPageEvents: editorPageEventBindings.bindEditorPageEvents,
                editorDataLoader,
                editorInitialLoadFlow,
                runEditorInitialLoadFlow: editorInitialLoadFlow.runEditorInitialLoadFlow,
                editorRefreshSaveRuntime,
                createEditorRefreshSaveRuntime: editorRefreshSaveRuntime.createEditorRefreshSaveRuntime,
                editorStartupContext,
                createEditorStartupContext: editorStartupContext.createEditorStartupContext,
                editorAuthHelpers,
                editorShellCopyApplier,
                editorDomRefsBuilder,
                getConfirmedSessionUser,
                readConfirmedAuthCache: readConfirmedAuthCacheFromHelper,
                hasConfirmedSessionUser: editorAuthHelpers.hasConfirmedSessionUser || (() => !!getConfirmedSessionUser()),
                getHttpStatus: shellHelpers.getHttpStatus,
                showToast,
                i18n,
                getEditorBasePath,
                redirectToEditorLogin,
                safeI18nText,
                resolveHintText,
                resolveTreeTitleText,
                resolveInfoText,
                syncCurrentTreeData,
                resolveParentIdForCreate,
                escapeHtml,
                resolveMemoryThumbnail,
                getYouTubeInputErrorMessage,
                renderTreeLoadError,
                buildTreeLoadErrorCopy,
                applyEditorShellCopy,
                createPrepareEditorShell,
                nextMemoryIdFromMemories: editorTreeHelpers.nextMemoryIdFromMemories,
                markEditorReady: shellHelpers.markEditorReady,
                applyEditorEditabilityState: shellHelpers.applyEditorEditabilityState,
                createEditorDomRefs: editorDomRefsBuilder.createEditorDomRefs,
                createEditorDebugReporter,
                createEditorStartupDependencyWaiter: shellHelpers.createEditorStartupDependencyWaiter,
                exposeCanvasEmptyGuideUpdater: shellHelpers.exposeCanvasEmptyGuideUpdater,
                exposeDetailPanelUpdater: shellHelpers.exposeDetailPanelUpdater,
                createSelectedMomentFocusHandler: shellHelpers.createSelectedMomentFocusHandler,
                createSidebarTreeActionsUpdater: shellHelpers.createSidebarTreeActionsUpdater,
                createMemoryActionsReadinessWrapper: shellHelpers.createMemoryActionsReadinessWrapper,
                createCurrentMomentDetailOpener: shellHelpers.createCurrentMomentDetailOpener,
                createSaveStatusOrchestrationFallback: shellHelpers.createSaveStatusOrchestrationFallback,
                exposeRefreshMemoriesBridge: shellHelpers.exposeRefreshMemoriesBridge,
                resolveSaveStatusTimeFormatter: shellHelpers.resolveSaveStatusTimeFormatter,
                findRootMemory,
                getCanonicalRootId,
                isRootMemory
            }
        };
    }

    if (typeof window !== 'undefined') {
        window.LoveBudEditorEntryDependencies = Object.freeze({
            resolveEditorEntryDependencies
        });
    }

    if (typeof module !== 'undefined' && module.exports) {
        module.exports = {
            resolveEditorEntryDependencies
        };
    }
})();
