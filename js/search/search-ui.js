(function () {
    function createSearchUI({ refs, state, renderers, callbacks }) {
        const {
            resultsList,
            previewSidebar,
            previewMobileClose,
            previewContainer,
            previewTitle,
            previewDesc,
            previewEmotionTags,
            tagChips,
            growingList,
            mobilePreviewMediaQuery
        } = refs;
        const { PreviewRenderer } = renderers;
        const treeDataMap = new WeakMap();
        const boundContainers = new WeakSet();

        // overlay element reference + saved scroll position for lock/restore
        let sheetOverlay = null;
        let savedScrollY = 0;

        function getCurrentLocale() {
            const locale = window.i18n?.currentLang || window.getCurrentLang?.() || document.documentElement?.lang || 'ko';
            return String(locale).toLowerCase().startsWith('en') ? 'en' : 'ko';
        }

        function isMobilePreviewMode() {
            return Boolean(mobilePreviewMediaQuery?.matches);
        }

        function _showSheetOverlay() {
            // Guard: already open — do not re-lock or re-save scrollY
            if (sheetOverlay) return;

            // Save current scroll position BEFORE applying position:fixed
            savedScrollY = window.scrollY || window.pageYOffset || 0;

            // Apply scroll lock: position:fixed is set by CSS body.preview-sheet-open;
            // we set top so the viewport stays visually in place (iOS Safari pattern)
            document.body.style.top = '-' + savedScrollY + 'px';
            document.body.classList.add('preview-sheet-open');

            sheetOverlay = document.createElement('div');
            sheetOverlay.className = 'preview-sheet-overlay';
            sheetOverlay.setAttribute('aria-hidden', 'true');
            sheetOverlay.addEventListener('click', () => {
                clearSelectedPreview();
            });
            document.body.appendChild(sheetOverlay);
        }

        function _hideSheetOverlay() {
            // Remove overlay DOM
            if (sheetOverlay) {
                sheetOverlay.remove();
                sheetOverlay = null;
            }

            // Release scroll lock: clear class and inline top BEFORE scrollTo
            document.body.classList.remove('preview-sheet-open');
            document.body.style.top = '';

            // Restore original scroll position
            const restoreY = savedScrollY;
            savedScrollY = 0;
            if (restoreY > 0) {
                window.scrollTo(0, restoreY);
            }
        }

        function setMobilePreviewOpen(isOpen) {
            if (!previewSidebar || !isMobilePreviewMode()) return;
            previewSidebar.classList.toggle('is-open', Boolean(isOpen));

            if (isOpen) {
                _showSheetOverlay();
            } else {
                _hideSheetOverlay();
            }

            // scrollIntoView completely disabled for mobile to prevent scroll hijack
            // Preview opens as fixed bottom sheet without scrolling page to top
        }

        function syncPreviewVisibility() {
            if (!previewSidebar) return;
            if (isMobilePreviewMode()) {
                setMobilePreviewOpen(Boolean(state.selectedTreeId));
                return;
            }
            // Desktop / resize from mobile: clean up overlay + scroll lock safely
            _hideSheetOverlay();
            previewSidebar.classList.remove('is-open');
        }

        function clearSelectedPreview(options = {}) {
            const { preserveOpenState = false } = options;
            state.selectedTreeId = null;
            state.currentPreviewRequestId += 1;
            markActiveCard(null);
            PreviewRenderer.resetPreview();
            if (!preserveOpenState && isMobilePreviewMode()) {
                setMobilePreviewOpen(false);
            }
        }

        function getSearchCopy(key, fallbackKo, fallbackEn) {
            const locale = getCurrentLocale();
            const dict = window.i18nSearch?.[key];
            if (dict && typeof dict === 'object') {
                return dict[locale] || dict.ko || dict.en || fallbackKo;
            }
            return locale === 'en' ? fallbackEn : fallbackKo;
        }

        const SORT_COPY = {
            latest: {
                title: () => getSearchCopy('search.resultsHeading', '최근 러브트리', 'Recent LoveTrees'),
                badge: (count) => getCurrentLocale() === 'en' ? `${count} to start with` : `지금 먼저 볼 ${count}개`
            },
            popular: {
                title: () => getCurrentLocale() === 'en' ? 'Popular LoveTrees' : '인기 많은 러브트리',
                badge: (count) => getCurrentLocale() === 'en' ? `${count} trending now` : `지금 반응 좋은 ${count}개`
            }
        };

        function syncStaticBrowseCopy() {
            if (typeof window.applyI18n === 'function') {
                window.applyI18n();
            }

            const eyebrow = document.querySelector('.search-panel-eyebrow span:last-child');
            if (eyebrow) {
                eyebrow.textContent = getSearchCopy('search.eyebrow', '오늘의 공개 감상', 'Today\'s Public Picks');
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
                previewKicker.textContent = getSearchCopy('search.previewKicker', '대표 순간과 이어진 감정을 먼저 열어보세요.', 'Begin with the featured moment and connected feelings.');
            }

            const previewStatsPending = document.querySelector('#previewTreeStats .tree-meta-item:first-child span:last-child');
            if (previewStatsPending) {
                previewStatsPending.textContent = getSearchCopy('search.previewStatsPending', '대표 순간이 열리면 함께 보여드릴게요', 'This will appear once the featured moment opens.');
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
                refs.resultsBadge.innerHTML = `
                    <span class="material-symbols-outlined" style="font-size:15px;">auto_awesome</span>
                    ${copy.badge(Math.min(state.currentLimit, 60))}
                `;
            }
            const loadMoreBtn = document.getElementById('browseLoadMoreBtn');
            if (loadMoreBtn) {
                loadMoreBtn.disabled = state.currentLimit >= 60;
                loadMoreBtn.textContent = state.currentLimit >= 60
                    ? (getCurrentLocale() === 'en' ? 'Max 60' : '최대 60개')
                    : (getCurrentLocale() === 'en' ? 'Load more' : '더 보기');
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

            const loadMoreBtn = controls.querySelector('#browseLoadMoreBtn');
            if (loadMoreBtn) {
                loadMoreBtn.style.display = (state.currentLimit >= 60) ? 'none' : 'inline-flex';
            }
        }

        function ensureBrowseControls() {
            ensureResultsHead();
            if (document.getElementById('browseSortControls')) return;

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
                    <button type="button" class="tag-chip" data-browse-sort="popular">${getCurrentLocale() === 'en' ? 'Popular' : '인기순'}</button>
                </div>
                <button type="button" id="browseLoadMoreBtn" class="tag-chip">${getCurrentLocale() === 'en' ? 'Load more' : '더 보기'}</button>
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
                    state.currentLimit = 10;
                    syncControlsFromState();
                    callbacks.updateUrlState();
                    await callbacks.loadPublicTrees({ resetSelection: true });
                });
            });

            controls.querySelector('#browseLoadMoreBtn')?.addEventListener('click', async () => {
                state.currentLimit = Math.min(state.currentLimit + 10, 60);
                syncControlsFromState();
                callbacks.updateUrlState();
                await callbacks.loadPublicTrees({ resetSelection: false });
            });

            syncControlsFromState();
        }

        function markActiveCard(activeCard) {
            const allCardContainers = [resultsList, growingList].filter(Boolean);
            allCardContainers.forEach(container => {
                container.querySelectorAll('.tree-card.is-active').forEach((card) => {
                    card.classList.remove('is-active');
                    card.setAttribute('aria-pressed', 'false');
                });
            });
            if (activeCard) {
                activeCard.classList.add('is-active');
                activeCard.setAttribute('aria-pressed', 'true');
            }
        }

        function syncActiveCard() {
            const allCardContainers = [resultsList, growingList].filter(Boolean);
            let activeCard = null;
            for (const container of allCardContainers) {
                const cards = container.querySelectorAll('.tree-card');
                activeCard = Array.from(cards).find(card => card.dataset.treeId === state.selectedTreeId);
                if (activeCard) break;
            }
            markActiveCard(activeCard || null);
        }

        function renderLoadErrorState() {
            resultsList.innerHTML = `
                <div class="search-empty-state">
                    <span class="material-symbols-outlined search-error-icon" aria-hidden="true">cloud_off</span>
                    <h3 class="search-empty-heading">${getSearchCopy('search.errorHeading', '불러오지 못했어요', 'Could not load')}</h3>
                    <p class="search-empty-body">${getSearchCopy('search.errorBody', '네트워크 상태를 확인하고 다시 시도해 주세요.', 'Check your connection and try again.')}</p>
                    <div class="search-empty-actions">
                        <button type="button" id="retryLoadBtn" class="btn-round btn-primary">${getSearchCopy('search.retryButton', '다시 시도', 'Retry')}</button>
                    </div>
                </div>
            `;

            const retryBtn = document.getElementById('retryLoadBtn');
            if (retryBtn) {
                retryBtn.addEventListener('click', () => window.location.reload());
            }

            clearSelectedPreview();
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

        function bindDelegatedCardEvents(container) {
            if (!container || boundContainers.has(container)) return;
            boundContainers.add(container);

            container.addEventListener('click', (event) => {
                if (event.defaultPrevented) return;

                const card = event.target.closest('.tree-card[data-tree-id]');
                if (!card || !container.contains(card)) return;

                // Ignore clicks on nested interactive elements
                const interactiveSelector = 'a, button, input, select, textarea, [data-share-tree-link], [data-action], [role="button"]';
                const interactiveChild = event.target.closest(interactiveSelector);
                if (interactiveChild && interactiveChild !== card) return;

                const tree = treeDataMap.get(card);
                if (tree) {
                    callbacks.selectTree(tree, card);
                }
            });

            container.addEventListener('keydown', (event) => {
                if (event.defaultPrevented || (event.key !== 'Enter' && event.key !== ' ')) return;

                const card = event.target.closest('.tree-card[data-tree-id]');
                if (!card || !container.contains(card)) return;

                const interactiveSelector = 'a, button, input, select, textarea, [data-share-tree-link], [data-action], [role="button"]';
                const interactiveChild = event.target.closest(interactiveSelector);
                if (interactiveChild && interactiveChild !== card) return;

                event.preventDefault();
                const tree = treeDataMap.get(card);
                if (tree) {
                    callbacks.selectTree(tree, card);
                }
            });
        }

        function attachCardEvents(listElement, trees) {
            if (!listElement) return;
            const cards = listElement.querySelectorAll('.tree-card');
            cards.forEach((card) => {
                const treeId = card.dataset.treeId;
                const tree = trees.find(t => t.id === treeId);
                if (!tree) return;

                // Set accessibility attributes for delegation
                card.setAttribute('tabindex', '0');
                card.setAttribute('role', 'button');

                // Sync initial aria-pressed state
                card.setAttribute('aria-pressed', tree.id === state.selectedTreeId ? 'true' : 'false');

                // Map tree data for delegated event handler
                treeDataMap.set(card, tree);
            });

            // Ensure container listener is bound
            bindDelegatedCardEvents(listElement);
        }

        function bindShareCopyHandler() {
            document.addEventListener('click', async (event) => {
                const shareButton = event.target.closest('[data-share-tree-link]');
                if (!shareButton) return;

                event.preventDefault();

                const treeId = shareButton.dataset.shareTreeLink;
                if (!treeId) return;

                const labelSpan = shareButton.querySelector('[data-share-tree-link-label]');
                if (!labelSpan) return;

                const originalText = labelSpan.textContent;
                const copiedText = getSearchCopy('search.previewShareLinkCopied', '링크가 복사됐어요', 'Link copied');
                const failedText = getSearchCopy('search.previewShareLinkFailed', '복사하지 못했어요', 'Copy failed');

                try {
                    const url = new URL('/pages/search.html', window.location.origin);
                    url.searchParams.set('tree', treeId);
                    await navigator.clipboard.writeText(url.toString());
                    labelSpan.textContent = copiedText;
                    setTimeout(() => {
                        labelSpan.textContent = originalText;
                    }, 1500);
                } catch (error) {
                    console.warn('[search] clipboard copy failed:', error.message);
                    labelSpan.textContent = failedText;
                    setTimeout(() => {
                        labelSpan.textContent = originalText;
                    }, 1500);
                }
            });
        }

        function bindMobilePreviewHandlers() {
            if (refs.previewMobileClose) {
                refs.previewMobileClose.addEventListener('click', () => {
                    clearSelectedPreview();
                });
            }

            if (mobilePreviewMediaQuery?.addEventListener) {
                mobilePreviewMediaQuery.addEventListener('change', () => {
                    syncPreviewVisibility();
                });
            } else if (mobilePreviewMediaQuery?.addListener) {
                mobilePreviewMediaQuery.addListener(() => {
                    syncPreviewVisibility();
                });
            }
        }

        return {
            getCurrentLocale,
            getSearchCopy,
            isMobilePreviewMode,
            setMobilePreviewOpen,
            syncPreviewVisibility,
            clearSelectedPreview,
            syncStaticBrowseCopy,
            syncBrowseHead,
            ensureResultsHead,
            syncControlsFromState,
            ensureBrowseControls,
            markActiveCard,
            syncActiveCard,
            renderLoadErrorState,
            renderPreviewLoadingState,
            attachCardEvents,
            bindShareCopyHandler,
            bindMobilePreviewHandlers
        };
    }

    window.LoveBudSearchUI = { createSearchUI };
})();
