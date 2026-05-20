(function () {
    function createSearchUI({ refs, state, renderers, callbacks }) {
        const {
            resultsList,
            previewMobileClose,
            previewContainer,
            previewTitle,
            previewDesc,
            previewEmotionTags
        } = refs;
        const { PreviewRenderer } = renderers;
        const ScrollLoad = window.LoveBudSearchScrollLoad || {};

        let scrollLoadSentinel = null;
        let scrollLoadObserver = null;
        let scrollCheckRaf = 0;
        let isScrollLoadQueued = false;
        let hasUserScrolledTowardFeed = false;
        let scrollLoadIntentBound = false;

        function getCurrentLocale() {
            var SearchCopy = window.LoveBudSearchCopy;
            if (SearchCopy && typeof SearchCopy.getCurrentLocale === 'function') {
                return SearchCopy.getCurrentLocale();
            }
            const locale = window.i18n?.currentLang || window.getCurrentLang?.() || document.documentElement?.lang || 'ko';
            return String(locale).toLowerCase().startsWith('en') ? 'en' : 'ko';
        }

        function getSearchCopy(key, fallbackKo, fallbackEn) {
            var SearchCopy = window.LoveBudSearchCopy;
            if (SearchCopy && typeof SearchCopy.getSearchCopy === 'function') {
                return SearchCopy.getSearchCopy(key, fallbackKo, fallbackEn);
            }
            const locale = getCurrentLocale();
            const dict = window.i18nSearch?.[key];
            if (dict && typeof dict === 'object') {
                return dict[locale] || dict.ko || dict.en || fallbackKo;
            }
            return locale === 'en' ? fallbackEn : fallbackKo;
        }

        const SORT_COPY = {
            latest: {
                title: () => getSearchCopy('search.resultsHeading', '둘러볼 러브트리', 'LoveTrees to browse')
            },
            popular: {
                title: () => getSearchCopy('search.resultsPopularHeading', '많이 감상한 러브트리', 'Popular LoveTrees')
            }
        };

        function syncStaticBrowseCopy() {
            if (typeof window.applyI18n === 'function') {
                window.applyI18n();
            }

            const eyebrow = document.querySelector('.search-panel-eyebrow span:last-child');
            if (eyebrow) {
                eyebrow.textContent = getSearchCopy('search.eyebrow', '러브트리 둘러보기', 'Browse LoveTrees');
            }

            if (refs.searchInput) {
                refs.searchInput.placeholder = getSearchCopy('search.placeholder', '예: 첫 설렘 · 아티스트명 · 감정 태그', 'e.g., first spark, artist, emotion tag');
            }

            const previewHeading = document.querySelector('.preview-panel-header h3');
            if (previewHeading) {
                previewHeading.textContent = getSearchCopy('search.previewTitle', '감상 허브', 'Viewing Hub');
            }

            const previewBadge = document.querySelector('.preview-badge');
            if (previewBadge) {
                previewBadge.textContent = getSearchCopy('search.previewBadge', '선택한 트리', 'Selected Tree');
            }

            if (previewMobileClose) {
                previewMobileClose.setAttribute(
                    'aria-label',
                    getSearchCopy('search.previewClose', '감상 닫기', 'Close preview')
                );
            }

            const previewKicker = document.querySelector('.preview-kicker');
            if (previewKicker) {
                previewKicker.textContent = getSearchCopy('search.previewKicker', '러브트리를 고르면 흐름이 열려요.', 'Choose a LoveTree to open its flow.');
            }

            const previewStatsPending = document.querySelector('#previewTreeStats .tree-meta-item:first-child span:last-child');
            if (previewStatsPending) {
                previewStatsPending.textContent = getSearchCopy('search.previewStatsPending', '첫 순간을 기다리는 중', 'Waiting for the first moment');
            }

            const emotionLabel = document.querySelector('.emotion-tags-label span:last-child');
            if (emotionLabel) {
                emotionLabel.textContent = getSearchCopy('search.previewEmotionTagsLabel', '이어진 감정', 'Connected Feelings');
            }

            if (previewEmotionTags && !previewEmotionTags.children.length) {
                previewEmotionTags.textContent = getSearchCopy('search.previewNoEmotionTags', '아직 선명한 감정의 결이 보이지 않아요.', 'No clear emotional thread has settled yet.');
            }
        }

        function syncBrowseHead() {
            const copy = SORT_COPY[state.currentSort] || SORT_COPY.latest;
            if (refs.resultsTitle) {
                refs.resultsTitle.textContent = typeof copy.title === 'function' ? copy.title() : copy.title;
            }
            if (refs.resultsBadge) {
                refs.resultsBadge.hidden = true;
                refs.resultsBadge.textContent = '';
            }
        }

        function ensureResultsHead() {
            if (refs.resultsHead) return;
            refs.resultsHead = document.createElement('div');
            refs.resultsHead.className = 'browse-results-head';

            const titleDiv = document.createElement('div');
            refs.resultsTitle = document.createElement('h3');
            const descP = document.createElement('p');

            refs.resultsBadge = document.createElement('span');
            refs.resultsBadge.className = 'browse-results-badge';

            titleDiv.appendChild(refs.resultsTitle);
            titleDiv.appendChild(descP);
            refs.resultsHead.appendChild(titleDiv);
            refs.resultsHead.appendChild(refs.resultsBadge);

            if (resultsList && resultsList.parentNode) {
                resultsList.parentNode.insertBefore(refs.resultsHead, resultsList);
            }
        }

        function syncControlsFromState() {
            const controls = document.getElementById('browseSortControls');
            if (!controls) return;

            controls.querySelectorAll('[data-browse-sort]').forEach((chip) => {
                chip.classList.toggle('active', chip.dataset.browseSort === state.currentSort);
            });

            syncScrollLoadSentinel();
        }

        function canLoadMorePublicTrees() {
            if (typeof ScrollLoad.canLoadMorePublicTrees === 'function') {
                return ScrollLoad.canLoadMorePublicTrees(state, callbacks, {
                    isQueued: isScrollLoadQueued
                });
            }

            return Boolean(
                callbacks.loadMorePublicTrees
                && state.apiTreesLoaded
                && state.hasMoreTrees
                && !state.isLoadingMore
                && !isScrollLoadQueued
                && state.currentLimit < 60
            );
        }

        function syncScrollLoadSentinel() {
            if (typeof ScrollLoad.syncScrollLoadSentinel === 'function') {
                ScrollLoad.syncScrollLoadSentinel(scrollLoadSentinel, state);
                return;
            }

            if (!scrollLoadSentinel) return;

            const isDone = !state.apiTreesLoaded || state.currentLimit >= 60 || !state.hasMoreTrees;
            scrollLoadSentinel.hidden = isDone;
            scrollLoadSentinel.classList.toggle('is-loading', Boolean(state.isLoadingMore));
            scrollLoadSentinel.classList.toggle('is-idle', !isDone && !state.isLoadingMore);
            scrollLoadSentinel.setAttribute('aria-hidden', isDone ? 'true' : 'false');

            const icon = scrollLoadSentinel.querySelector('.material-symbols-outlined');
            if (icon) {
                icon.hidden = !state.isLoadingMore;
            }

            const text = scrollLoadSentinel.querySelector('[data-scroll-load-label]');
            if (!text) return;
            text.textContent = state.isLoadingMore
                ? 'Loading more LoveTrees...'
                : '';
        }

        function isSentinelNearViewport() {
            if (typeof ScrollLoad.isSentinelNearViewport === 'function') {
                return ScrollLoad.isSentinelNearViewport(scrollLoadSentinel, window);
            }

            if (!scrollLoadSentinel || scrollLoadSentinel.hidden) return false;
            const rect = scrollLoadSentinel.getBoundingClientRect();
            return rect.top <= window.innerHeight + 720 && rect.bottom >= -240;
        }

        async function requestScrollLoadMore() {
            if (!hasUserScrolledTowardFeed || !isSentinelNearViewport() || !canLoadMorePublicTrees()) return;

            isScrollLoadQueued = true;
            syncScrollLoadSentinel();
            try {
                await callbacks.loadMorePublicTrees({ source: 'scroll' });
            } finally {
                isScrollLoadQueued = false;
                syncScrollLoadSentinel();
            }
        }

        function scheduleScrollLoadCheck() {
            if (scrollCheckRaf) return;
            scrollCheckRaf = window.requestAnimationFrame(() => {
                scrollCheckRaf = 0;
                if ((window.scrollY || window.pageYOffset || 0) > 80) {
                    hasUserScrolledTowardFeed = true;
                }
                requestScrollLoadMore();
            });
        }

        function markScrollLoadIntent() {
            hasUserScrolledTowardFeed = true;
            scheduleScrollLoadCheck();
        }

        function handleScrollLoadKeydown(event) {
            const isIntentKey = typeof ScrollLoad.isScrollIntentKey === 'function'
                ? ScrollLoad.isScrollIntentKey(event)
                : [' ', 'PageDown', 'End', 'ArrowDown'].includes(event.key);

            if (isIntentKey) {
                markScrollLoadIntent();
            }
        }

        function bindScrollLoadIntentHandlers() {
            if (scrollLoadIntentBound) return;
            scrollLoadIntentBound = true;

            window.addEventListener('scroll', scheduleScrollLoadCheck, { passive: true });
            window.addEventListener('wheel', markScrollLoadIntent, { passive: true });
            window.addEventListener('touchmove', markScrollLoadIntent, { passive: true });
            window.addEventListener('keydown', handleScrollLoadKeydown);
            window.addEventListener('resize', scheduleScrollLoadCheck, { passive: true });
            window.addEventListener('pageshow', scheduleScrollLoadCheck);
        }

        function ensureScrollLoadSentinel() {
            if (!resultsList || scrollLoadSentinel) return;

            if (typeof ScrollLoad.createScrollLoadSentinel === 'function') {
                scrollLoadSentinel = ScrollLoad.createScrollLoadSentinel(document);
            } else {
                scrollLoadSentinel = document.createElement('div');
                scrollLoadSentinel.id = 'browseScrollLoadSentinel';
                scrollLoadSentinel.className = 'browse-scroll-load-sentinel';
                scrollLoadSentinel.innerHTML = `
                <span class="material-symbols-outlined" aria-hidden="true">progress_activity</span>
                <span data-scroll-load-label></span>
            `;
            }

            resultsList.insertAdjacentElement('afterend', scrollLoadSentinel);
            syncScrollLoadSentinel();

            if ('IntersectionObserver' in window) {
                scrollLoadObserver = new IntersectionObserver((entries) => {
                    if (entries.some(entry => entry.isIntersecting)) {
                        scheduleScrollLoadCheck();
                    }
                }, {
                    root: null,
                    rootMargin: '720px 0px 720px 0px',
                    threshold: 0
                });
                scrollLoadObserver.observe(scrollLoadSentinel);
            }

            bindScrollLoadIntentHandlers();
            scheduleScrollLoadCheck();
        }

        function ensureBrowseControls() {
            ensureResultsHead();
            if (document.getElementById('browseSortControls')) {
                ensureScrollLoadSentinel();
                return;
            }

            const controls = document.createElement('div');
            controls.id = 'browseSortControls';
            controls.style.display = 'flex';
            controls.style.flexWrap = 'wrap';
            controls.style.alignItems = 'center';
            controls.style.justifyContent = 'flex-end';
            controls.style.gap = '10px';
            controls.innerHTML = `
                <div style="display:flex; gap:8px; flex-wrap:wrap;">
                    <button type="button" class="tag-chip" data-browse-sort="latest">${getCurrentLocale() === 'en' ? 'Latest' : '최신순'}</button>
                    <button type="button" class="tag-chip" data-browse-sort="popular">${getCurrentLocale() === 'en' ? 'Popular' : '많은 순간순'}</button>
                </div>
            `;

            let rightGroup = refs.resultsHead.querySelector('.browse-head-right');
            if (!rightGroup) {
                rightGroup = document.createElement('div');
                rightGroup.className = 'browse-head-right';
                rightGroup.style.display = 'flex';
                rightGroup.style.flexDirection = 'column';
                rightGroup.style.alignItems = 'flex-end';
                rightGroup.style.gap = '12px';

                if (refs.resultsBadge && refs.resultsBadge.parentNode === refs.resultsHead) {
                    refs.resultsHead.removeChild(refs.resultsBadge);
                    rightGroup.appendChild(refs.resultsBadge);
                }
                refs.resultsHead.appendChild(rightGroup);
            }
            rightGroup.appendChild(controls);

            controls.querySelectorAll('[data-browse-sort]').forEach((button) => {
                button.addEventListener('click', async () => {
                    const nextSort = button.dataset.browseSort || 'latest';
                    if (nextSort === state.currentSort) return;
                    state.currentSort = nextSort;
                    state.currentLimit = 6;
                    state.hasMoreTrees = true;
                    syncControlsFromState();
                    callbacks.updateUrlState();
                    await callbacks.loadPublicTrees({ resetSelection: true });
                });
            });

            ensureScrollLoadSentinel();
            syncControlsFromState();
        }

        function renderPreviewLoadingState(tree) {
            if (typeof PreviewRenderer.renderLoadingPreview === 'function') {
                PreviewRenderer.renderLoadingPreview(tree);
                return;
            }
            if (previewTitle) {
                previewTitle.textContent = tree?.title || getSearchCopy('search.previewDefaultTreeName', '러브트리', 'LoveTree');
            }
            if (previewDesc) {
                previewDesc.innerHTML = `<p style="margin-bottom:16px;">${getCurrentLocale() === 'en' ? 'Loading the featured moment of this tree.' : '대표 순간을 불러오는 중이에요.'}</p>`;
            }
            if (previewContainer) {
                previewContainer.innerHTML = `<div style="width:100%;height:100%;display:flex;flex-direction:column;align-items:center;justify-content:center;color:var(--on-surface-variant);font-size:14px;text-align:center;padding:20px;"><span class="material-symbols-outlined" style="font-size:40px;opacity:0.45;margin-bottom:12px;display:block;animation:spin 1s linear infinite;">progress_activity</span><p style="margin:0;line-height:1.5;">${getCurrentLocale() === 'en' ? 'Preparing the featured moment.' : '대표 순간을 준비하고 있어요.'}</p></div>`;
            }
        }

        return {
            getCurrentLocale,
            getSearchCopy,
            syncStaticBrowseCopy,
            syncBrowseHead,
            ensureResultsHead,
            syncControlsFromState,
            ensureBrowseControls,
            renderPreviewLoadingState
        };
    }

    window.LoveBudSearchUI = { createSearchUI };
})();
