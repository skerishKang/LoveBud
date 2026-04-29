document.addEventListener('DOMContentLoaded', async () => {
    const refs = {
        videoMain: document.getElementById('videoMain'),
        memoryTitle: document.getElementById('memoryTitle'),
        diaryQuote: document.getElementById('diaryQuote'),
        diaryContent: document.getElementById('diaryContent'),
        detailArtist: document.getElementById('detailArtist'),
        detailDate: document.getElementById('detailDate'),
        detailSubtitle: document.getElementById('detailSubtitle'),
        tagsContainer: document.getElementById('tagsContainer'),
        connectedFragments: document.getElementById('connectedFragments'),
        treeContextEl: document.getElementById('treeContext'),
        backButton: document.getElementById('backButton'),
        detailHeroTitle: document.getElementById('detailHeroTitle'),
        detailHeroDesc: document.getElementById('detailHeroDesc'),
        detailHeroKicker: document.getElementById('detailHeroKicker'),
        detailViewChipLabel: document.getElementById('detailViewChipLabel'),
        detailSideSummary: document.getElementById('detailSideSummary'),
        connectedKicker: document.getElementById('connectedKicker'),
        connectedTitle: document.getElementById('connectedTitle'),
        connectedSummary: document.getElementById('connectedSummary'),
        growthLabel: document.getElementById('growthLabel')
    };

    const isPagesContext = window.location.pathname.indexOf('/pages/') !== -1;
    const utils = window.LoveBudDetailUtils.createUtils({ isPagesContext });
    const homeHref = isPagesContext ? '../index.html' : 'index.html';
    const searchHref = utils.buildPageHref('search');
    const myTreesHref = utils.buildPageHref('my-trees');

    const video = window.LoveBudDetailVideo.createVideoHelpers({
        tText: utils.tText,
        escapeHtml: utils.escapeHtml,
        normalizeVideoSourceUrl: utils.normalizeVideoSourceUrl
    });

    const render = window.LoveBudDetailRender.createRenderers({
        refs,
        tText: utils.tText,
        escapeHtml: utils.escapeHtml,
        getLocalizedTagLabel: utils.getLocalizedTagLabel,
        buildSoftPanelMarkup: video.buildSoftPanelMarkup,
        buildVideoMainMarkup: video.buildVideoMainMarkup,
        resolveTreeMomentCount: utils.resolveTreeMomentCount,
        homeHref,
        searchHref
    });

    const connected = window.LoveBudDetailConnected.createConnectedRenderer({
        refs,
        tText: utils.tText,
        escapeHtml: utils.escapeHtml,
        buildPageHref: utils.buildPageHref,
        sortTreeMemories: utils.sortTreeMemories,
        isStructuralRootMemory: utils.isStructuralRootMemory,
        buildSoftPanelMarkup: video.buildSoftPanelMarkup
    });

    const copy = window.LoveBudDetailCopy.createCopyHelpers({
        refs,
        tText: utils.tText
    });

    const loader = window.LoveBudDetailLoader.createDetailLoader({
        refs,
        hrefs: {
            homeHref,
            searchHref,
            myTreesHref,
            buildPageHref: utils.buildPageHref
        },
        tText: utils.tText,
        sortTreeMemories: utils.sortTreeMemories,
        inferTreeContext: utils.inferTreeContext,
        resolveTreeMomentCount: utils.resolveTreeMomentCount,
        getConnectedFlowMoments: connected.getConnectedFlowMoments,
        renderMemoryBase: render.renderMemoryBase,
        renderTreeContext: render.renderTreeContext,
        renderConnectedFragments: connected.renderConnectedFragments,
        renderMissingMemoryState: render.renderMissingMemoryState,
        applyViewingPageCopy: copy.applyViewingPageCopy
    });

    await loader.loadCurrentDetail();
});
