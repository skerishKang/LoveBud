(function () {
    function createDetailLoader({ refs, hrefs, tText, sortTreeMemories, inferTreeContext, resolveTreeMomentCount, getConnectedFlowMoments, renderMemoryBase, renderTreeContext, renderConnectedFragments, renderMissingMemoryState, applyViewingPageCopy }) {
        const { backButton } = refs;
        const { searchHref, myTreesHref, buildPageHref } = hrefs;

        const configureBackButton = (sourceContext, treeId) => {
            if (!backButton) return;
            const backConfig = {
                browse: { label: tText('back_to_browse_soft', '둘러보기로 돌아가기'), url: searchHref },
                'my-trees': { label: tText('back_to_my_trees_soft', '내 트리로 돌아가기'), url: myTreesHref },
                editor: { label: tText('back_to_editor_soft', '편집 화면으로 돌아가기'), url: buildPageHref('editor', treeId ? { treeId } : {}) }
            };
            const config = backConfig[sourceContext] || backConfig.browse;
            const isAnchorButton = backButton.tagName === 'A';

            backButton.innerHTML = `<span class="material-symbols-outlined">arrow_back</span><span>${config.label}</span>`;
            backButton.setAttribute('aria-label', config.label);
            backButton.dataset.backUrl = config.url;

            if (isAnchorButton) {
                backButton.setAttribute('href', config.url);
                return;
            }

            backButton.type = 'button';
            if (!backButton.__detailBackHandler) {
                backButton.__detailBackHandler = (event) => {
                    event.preventDefault();
                    const url = backButton.dataset.backUrl || searchHref;
                    window.location.assign(url);
                };
                backButton.addEventListener('click', backButton.__detailBackHandler);
            }
        };

        const loadCurrentDetail = async () => {
            const urlParams = new URLSearchParams(window.location.search);
            const memoryId = urlParams.get('id');
            if (!memoryId) {
                window.location.href = searchHref;
                return;
            }

            const fromParam = urlParams.get('from');
            const sourceContext = ['browse', 'my-trees', 'editor'].includes(fromParam) ? fromParam : 'browse';
            const requestedTreeId = urlParams.get('tree');
            configureBackButton(sourceContext, requestedTreeId);

            const cache = window.LoveBudCache;
            const MEMORY_CACHE_KEY = 'memory_' + memoryId;
            const TREE_CACHE_KEY = (tid) => 'tree_' + tid;
            const MEMORIES_CACHE_KEY = (tid) => 'memories_' + tid;

            let memory = null;
            const cachedMemory = cache ? cache.get(MEMORY_CACHE_KEY) : null;
            if (cachedMemory) memory = cachedMemory;

            const normalize = window.LoveBudNormalize?.normalizeMemory || ((m) => m);
            const findPublicMemoryInTree = async () => {
                if (!requestedTreeId || !window.apiClient || !window.apiClient.getCommunityMemories) return null;
                const publicMemories = await window.apiClient.getCommunityMemories({ treeId: requestedTreeId, limit: 100 });
                if (!Array.isArray(publicMemories)) return null;
                return publicMemories
                    .map(item => normalize(item))
                    .find(item => item && item.id === memoryId) || null;
            };

            try {
                if (window.apiClient && window.apiClient.getMemory) {
                    const apiMemory = await window.apiClient.getMemory(memoryId);
                    if (apiMemory) {
                        const normalizedMemory = normalize(apiMemory);
                        if (cache) cache.set(MEMORY_CACHE_KEY, normalizedMemory, 3 * 60 * 1000);
                        if (JSON.stringify(memory) !== JSON.stringify(normalizedMemory)) memory = normalizedMemory;
                    }
                }
            } catch (e) {
                if (!memory && typeof getMemory === 'function') memory = normalize(getMemory(memoryId));
            }

            if (!memory && sourceContext === 'browse') {
                try {
                    const publicMemory = await findPublicMemoryInTree();
                    if (publicMemory) {
                        memory = publicMemory;
                        if (cache) cache.set(MEMORY_CACHE_KEY, publicMemory, 3 * 60 * 1000);
                    }
                } catch (e) {
                    console.warn('[LoveBudDetail] public browse memory fallback failed', e);
                }
            }

            if (!memory) {
                renderMissingMemoryState();
                return;
            }

            const canonicalTreeId = memory.treeId || requestedTreeId || null;
            const hasTreeContext = !!canonicalTreeId;
            let degradedReason = null;
            if (!canonicalTreeId) degradedReason = 'missing-tree-id';

            const stagedMemories = [memory];
            const stagedTree = inferTreeContext({ treeId: canonicalTreeId, currentMemory: memory, mergedMemories: stagedMemories });
            const stagedMomentCount = resolveTreeMomentCount({ tree: stagedTree, memories: stagedMemories, currentMemory: memory });
            const stagedDegradedReason = hasTreeContext ? 'context-loading' : 'missing-tree-id';

            renderMemoryBase(memory);
            renderTreeContext({
                hasTreeContext,
                tree: stagedTree,
                memories: stagedMemories,
                sourceContext,
                degradedReason: stagedDegradedReason,
                currentMemory: memory
            });
            renderConnectedFragments({
                memory,
                memories: stagedMemories,
                treeId: canonicalTreeId,
                sourceContext,
                degradedReason: stagedDegradedReason,
                treeMomentCount: stagedMomentCount
            });

            const stagedTitle = memory.title || tText('tree_context_moment', '순간 상세');
            document.title = `${stagedTitle} — ${tText('lovetree_brand', '러브트리')}`;
            applyViewingPageCopy({
                sourceContext,
                treeTitle: String(stagedTree?.title || '').trim(),
                memoryTitleText: memory.title,
                treeMomentCount: stagedMomentCount,
                connectedCount: 0,
                memory,
                degradedReason: stagedDegradedReason
            });

            let tree = hasTreeContext && cache ? cache.get(TREE_CACHE_KEY(canonicalTreeId)) : null;
            let memories = hasTreeContext && cache ? cache.get(MEMORIES_CACHE_KEY(canonicalTreeId)) : null;
            let treeFetchState = tree ? 'cache' : 'idle';
            let memoriesFetchState = Array.isArray(memories) ? 'cache' : 'idle';
            const loadPromises = [];

            if (hasTreeContext) {
                if (!tree && window.apiClient && window.apiClient.getTree) {
                    const loadTreeDetail = sourceContext === 'browse' && window.apiClient.getPublicTree
                        ? () => window.apiClient.getPublicTree(canonicalTreeId)
                        : () => window.apiClient.getTree(canonicalTreeId);
                    treeFetchState = 'loading';
                    loadPromises.push(loadTreeDetail()
                        .then(apiTree => {
                            if (apiTree) {
                                tree = apiTree;
                                treeFetchState = 'loaded';
                                if (cache) cache.set(TREE_CACHE_KEY(canonicalTreeId), apiTree, 5 * 60 * 1000);
                            } else {
                                treeFetchState = 'empty';
                            }
                        })
                        .catch(() => {
                            treeFetchState = 'failed';
                        }));
                }

                if (!Array.isArray(memories) && window.apiClient && window.apiClient.getMemoriesByTree) {
                    const loadTreeMemories = sourceContext === 'browse' && window.apiClient.getCommunityMemories
                        ? () => window.apiClient.getCommunityMemories({ treeId: canonicalTreeId, limit: 100 })
                        : () => window.apiClient.getMemoriesByTree(canonicalTreeId);
                    memoriesFetchState = 'loading';
                    loadPromises.push(loadTreeMemories()
                        .then(apiMemories => {
                            if (Array.isArray(apiMemories)) {
                                memories = apiMemories;
                                memoriesFetchState = 'loaded';
                                if (cache) cache.set(MEMORIES_CACHE_KEY(canonicalTreeId), apiMemories, 3 * 60 * 1000);
                            } else {
                                memories = [];
                                memoriesFetchState = 'empty';
                            }
                        })
                        .catch(() => {
                            memories = [];
                            memoriesFetchState = 'failed';
                        }));
                }

                if (loadPromises.length > 0) await Promise.all(loadPromises);

                if (!Array.isArray(memories)) memories = [];
            } else {
                tree = null;
                memories = [];
            }

            const mergedMemories = sortTreeMemories(memories, memory);
            const displayTree = tree || inferTreeContext({ treeId: canonicalTreeId, currentMemory: memory, mergedMemories });
            const treeMomentCount = resolveTreeMomentCount({ tree: displayTree, memories: mergedMemories, currentMemory: memory });
            const connectedFlowMoments = getConnectedFlowMoments({ memory, memories: mergedMemories });

            if (hasTreeContext) {
                if (treeFetchState === 'failed' && memoriesFetchState === 'failed') {
                    degradedReason = 'tree-and-memories-load-failed';
                } else if (memoriesFetchState === 'failed') {
                    degradedReason = 'memories-load-failed';
                } else if (treeFetchState === 'failed' || !String(displayTree?.title || '').trim()) {
                    degradedReason = 'tree-load-partial';
                }
            }

            renderMemoryBase(memory);
            renderTreeContext({ hasTreeContext, tree: displayTree, memories: mergedMemories, sourceContext, degradedReason, currentMemory: memory });
            renderConnectedFragments({ memory, memories: mergedMemories, treeId: canonicalTreeId, sourceContext, degradedReason, treeMomentCount });

            const safeTitle = memory.title || tText('tree_context_moment', '순간 상세');
            const treeTitle = String(displayTree?.title || '').trim() || tText('lovetree_brand', '러브트리');
            const brandTitle = tText('lovetree_brand', '러브트리');
            document.title = (hasTreeContext && treeMomentCount > 0)
                ? `${safeTitle} | ${treeTitle} — ${brandTitle}`
                : `${safeTitle} — ${brandTitle}`;

            applyViewingPageCopy({
                sourceContext,
                treeTitle: String(displayTree?.title || '').trim(),
                memoryTitleText: memory.title,
                treeMomentCount,
                connectedCount: connectedFlowMoments.length,
                memory,
                degradedReason
            });

            configureBackButton(sourceContext, canonicalTreeId);
            loadDetailReactions(memoryId);
        };

        function loadDetailReactions(memoryId) {
            const bar = document.getElementById('detailReactionsBar');
            const likeBtn = document.getElementById('detailLikeBtn');
            const likeCount = document.getElementById('detailLikeCount');
            const commentCount = document.getElementById('detailCommentCount');
            if (!bar || !likeBtn || !likeCount || !commentCount) return;

            // 1. 인증 여부 확인
            const isAuthed = window.LoveTreeAuthPolicy?.hasConfirmedAuthSession?.() ?? false;

            // 2. 리액션 요약 로드
            if (!window.apiClient?.fetchReactionSummary) return;
            window.apiClient.fetchReactionSummary(memoryId)
                .then(summary => {
                    if (!summary) return;
                    likeCount.textContent = summary.like_count ?? summary.likeCount ?? 0;
                    commentCount.textContent = summary.comment_count ?? summary.commentCount ?? 0;

                    const userReacted = summary.user_reacted ?? summary.userReacted ?? false;
                    likeBtn.dataset.reacted = userReacted ? 'true' : 'false';
                    likeBtn.querySelector('.detail-reaction-like-icon').textContent = userReacted ? '❤️' : '🤍';

                    // 3. 인증된 사용자만 좋아요 버튼 활성화
                    if (isAuthed) {
                        likeBtn.disabled = false;
                        likeBtn.onclick = async () => {
                            const wasReacted = likeBtn.dataset.reacted === 'true';
                            const prevCount = parseInt(likeCount.textContent) || 0;
                            const nextReacted = !wasReacted;
                            const nextCount = nextReacted ? prevCount + 1 : Math.max(0, prevCount - 1);

                            // 낙관적 업데이트
                            likeBtn.dataset.reacted = nextReacted ? 'true' : 'false';
                            likeBtn.querySelector('.detail-reaction-like-icon').textContent = nextReacted ? '❤️' : '🤍';
                            likeCount.textContent = nextCount;

                            try {
                                const result = await window.apiClient.toggleReaction(memoryId, 'like');
                                if (result) {
                                    likeCount.textContent = result.like_count ?? result.likeCount ?? nextCount;
                                    const serverReacted = result.user_reacted ?? result.userReacted ?? nextReacted;
                                    likeBtn.dataset.reacted = serverReacted ? 'true' : 'false';
                                    likeBtn.querySelector('.detail-reaction-like-icon').textContent = serverReacted ? '❤️' : '🤍';
                                }
                            } catch (e) {
                                // 롤백
                                likeBtn.dataset.reacted = wasReacted ? 'true' : 'false';
                                likeBtn.querySelector('.detail-reaction-like-icon').textContent = wasReacted ? '❤️' : '🤍';
                                likeCount.textContent = prevCount;
                            }
                        };
                    } else {
                        // 비인증 — 카운트만 표시, 버튼 비활성
                        likeBtn.disabled = true;
                        likeBtn.title = '로그인 후 좋아요를 남길 수 있어요';
                    }

                    // 4. 데이터 준비 완료 후 표시
                    bar.style.display = '';
                })
                .catch(() => {
                    // 리액션 로드 실패 — bar 숨김 유지, 조용히 처리
                });
        }

        return {
            configureBackButton,
            loadCurrentDetail
        };
    }

    window.LoveBudDetailLoader = { createDetailLoader };
})();
