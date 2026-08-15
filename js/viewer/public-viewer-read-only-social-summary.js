(function() {
    'use strict';

    // Exported namespace for composition by public-viewer-detail-ui.js
    window.LoveBudPublicViewerReadOnlySocialSummary = {
        createPublicViewerReadOnlyReactionSummaryBoundary: null
    };

    // Guard: fail-fast if loaded out-of-order with respect to required dependencies
    // (metadata-text is not strictly required by this module, but detail-ui needs it)
    function assertDeps() {
        if (typeof window.LoveBudPublicViewerDetailMetadataText === 'undefined') {
            throw new Error('[public-viewer-read-only-social-summary] Required dependency LoveBudPublicViewerDetailMetadataText not loaded');
        }
    }
    if (typeof window.LoveBudPublicViewerDetailMetadataText !== 'undefined') {
        assertDeps();
    }

    /**
     * createPublicViewerReadOnlyReactionSummaryBoundary — READ-ONLY public reaction summary
     *
     * Responsibilities:
     * - Fetch and validate public reaction + comment counts from the API
     * - Render loading / success / unavailable states
     * - Manage comments disclosure panel open/close
     * - Wire comment toggle with #3239 focus-return (capture BEFORE close, verify AFTER)
     * - Stale async guard via generation counter
     * - Post-write reconciliation via reconcilePublicSummary callback
     */
    function createPublicViewerReadOnlyReactionSummaryBoundary(deps) {
        var fetchReactionSummary = deps && typeof deps.fetchPublicMomentReactionSummary === 'function'
            ? deps.fetchPublicMomentReactionSummary
            : null;
        var fetchComments = deps && typeof deps.fetchPublicMomentComments === 'function'
            ? deps.fetchPublicMomentComments
            : null;
        var isRootMemory = deps && typeof deps.isRootMemory === 'function'
            ? deps.isRootMemory
            : function() { return false; };
        var getCanonicalRootId = deps && typeof deps.getCanonicalRootId === 'function'
            ? deps.getCanonicalRootId
            : function() { return null; };
        var resolveSocialContext = deps && typeof deps.resolveSocialContext === 'function'
            ? deps.resolveSocialContext
            : null;
        var onCommentsPanelStateChange = deps && typeof deps.onCommentsPanelStateChange === 'function'
            ? deps.onCommentsPanelStateChange
            : null;

        var sharedGenRef = deps && deps.sharedGenerationRef;
        var currentGeneration = sharedGenRef ? sharedGenRef.value : 0;
        var lastLoadedMemoryId = null;
        var lastData = null;
        var cardEl = null;
        var likeValueEl = null;
        var commentValueEl = null;
        var noteEl = null;
        var commentToggleEl = null;
        var commentPanelEl = null;
        var commentsListEl = null;
        var commentsPanelStatusEl = null;
        var commentMemoryMeta = null;

        function getGeneration() {
            return sharedGenRef ? sharedGenRef.value : currentGeneration;
        }

        function nextGeneration() {
            if (sharedGenRef) {
                sharedGenRef.value++;
                return sharedGenRef.value;
            }
            currentGeneration++;
            return currentGeneration;
        }

        function getElements() {
            if (!cardEl) cardEl = document.getElementById('momentReactionsCard');
            if (!likeValueEl) likeValueEl = document.getElementById('momentReactionLikeValue');
            if (!commentValueEl) commentValueEl = document.getElementById('momentReactionCommentValue');
            if (!noteEl) noteEl = document.getElementById('momentReactionNote');
            if (!commentToggleEl) commentToggleEl = document.getElementById('momentReactionCommentStatus');
            if (!commentPanelEl) commentPanelEl = document.getElementById('momentCommentsPanel');
            if (!commentsListEl) commentsListEl = document.getElementById('momentCommentsList');
            if (!commentsPanelStatusEl) commentsPanelStatusEl = document.getElementById('momentCommentsPanelStatus');
            return cardEl && likeValueEl && commentValueEl && noteEl
                && commentToggleEl && commentPanelEl && commentsListEl && commentsPanelStatusEl;
        }

        function setLoadingState(force, preservePanel) {
            if (!getElements()) return;
            cardEl.style.display = '';
            cardEl.dataset.socialLoading = 'true';
            if (!force) {
                cardEl.setAttribute('data-read-only-summary', 'true');
                cardEl.classList.add('is-read-only');
                cardEl.classList.add('is-public-readonly');
                cardEl.setAttribute('aria-label', '순간 반응 (읽기 전용)');
                likeValueEl.textContent = '⋯';
                commentValueEl.textContent = '⋯';
                var likeStatus = likeValueEl.parentElement;
                var commentStatus = commentValueEl.parentElement;
                if (likeStatus) likeStatus.setAttribute('aria-label', '좋아요 불러오는 중');
                if (commentToggleEl) commentToggleEl.setAttribute('aria-label', '댓글 불러오는 중');
                noteEl.textContent = '반응 기능은 준비 중이에요.';
                commentToggleEl.setAttribute('disabled', '');
                commentToggleEl.setAttribute('aria-expanded', 'false');
            }
            if (!preservePanel) {
                resetCommentsPanel();
            } else if (commentsPanelStatusEl) {
                // Panel stays open during reconciliation: show loading copy, clear stale items
                if (commentsListEl) commentsListEl.textContent = '';
                commentsPanelStatusEl.textContent = '댓글을 불러오는 중이에요.';
            }
            removeRetryButton();
        }

        function removeRetryButton() {
            if (!cardEl) return;
            var existingRetry = cardEl.querySelector('[data-social-retry="1"]');
            if (existingRetry && existingRetry.parentElement) {
                existingRetry.parentElement.removeChild(existingRetry);
            }
        }

        function validateSocialDTOs(reactionData, commentsData) {
            // Validate reaction DTO: { counts: { like: <non-negative integer> }, total: ... }
            var likeCount = -1;
            if (reactionData && typeof reactionData === 'object' && !Array.isArray(reactionData)) {
                var counts = reactionData.counts;
                if (counts && typeof counts === 'object' && !Array.isArray(counts)) {
                    var rawLike = counts.like;
                    if (rawLike === undefined || rawLike === null) {
                        likeCount = 0;
                    } else if (typeof rawLike === 'number' && Number.isFinite(rawLike) && rawLike >= 0 && Math.floor(rawLike) === rawLike) {
                        likeCount = rawLike;
                    }
                }
            }

            // Validate comments DTO: { comments: Array, nextCursor: string | null }
            // Each item must be an object with own string body.
            // Any malformed item invalidates the entire payload.
            var validComments = null;
            if (commentsData && typeof commentsData === 'object' && !Array.isArray(commentsData)) {
                if (Array.isArray(commentsData.comments) && (commentsData.nextCursor === null || (typeof commentsData.nextCursor === 'string' && commentsData.nextCursor.length > 0 && commentsData.comments.length > 0))) {
                    var items = commentsData.comments;
                    var allValid = true;
                    for (var i = 0; i < items.length; i++) {
                        var item = items[i];
                        if (!item || typeof item !== 'object' || Array.isArray(item) ||
                            !Object.prototype.hasOwnProperty.call(item, 'body') ||
                            typeof item.body !== 'string') {
                            allValid = false;
                            break;
                        }
                    }
                    if (allValid) {
                        validComments = items;
                    }
                }
            }

            if (likeCount >= 0 && validComments !== null) {
                return { likeCount: likeCount, commentCount: validComments.length, comments: validComments };
            }
            return null;
        }

        function renderSuccess(likeCount, commentCount, force) {
            if (!getElements()) return;
            delete cardEl.dataset.socialLoading;

            likeValueEl.textContent = String(likeCount);
            var likeStatus = likeValueEl.parentElement;
            if (likeStatus) likeStatus.setAttribute('aria-label', '좋아요 ' + likeCount + '개');

            if (commentCount === 0) {
                commentValueEl.textContent = '0';
                if (commentToggleEl) commentToggleEl.setAttribute('aria-label', '댓글 없음');
            } else {
                commentValueEl.textContent = commentCount + '개 표시';
                if (commentToggleEl) commentToggleEl.setAttribute('aria-label', '댓글 ' + commentCount + '개 보기');
            }

            removeRetryButton();
            commentToggleEl.removeAttribute('disabled');
        }

        function resetCommentsPanel() {
            if (commentToggleEl) {
                commentToggleEl.setAttribute('disabled', '');
                commentToggleEl.setAttribute('aria-expanded', 'false');
            }
            if (commentPanelEl) commentPanelEl.hidden = true;
            if (commentsListEl) commentsListEl.textContent = '';
            if (commentsPanelStatusEl) commentsPanelStatusEl.textContent = '';
            commentMemoryMeta = null;
            emitPanelState(false);
        }

        function openCommentPanel(commentItems) {
            if (!commentPanelEl || !commentsListEl || !commentsPanelStatusEl) return;
            commentsListEl.textContent = '';

            if (!commentItems || !Array.isArray(commentItems) || commentItems.length === 0) {
                commentsPanelStatusEl.textContent = '아직 댓글이 없어요. 이 순간에 첫 댓글을 남겨보세요.';
                commentPanelEl.hidden = false;
                emitPanelState(true);
                return;
            }

            for (var i = 0; i < commentItems.length; i++) {
                var li = document.createElement('li');
                li.textContent = commentItems[i].body;
                commentsListEl.appendChild(li);
            }
            commentsPanelStatusEl.textContent = '';
            commentPanelEl.hidden = false;
            emitPanelState(true);
        }

        function emitPanelState(open) {
            if (typeof onCommentsPanelStateChange !== 'function') return;
            var meta = commentMemoryMeta;
            if (open && meta) {
                onCommentsPanelStateChange({
                    open: true,
                    treeId: meta.treeId,
                    memoryId: meta.memoryId,
                    generation: meta.generation,
                    data: meta.data
                });
            } else {
                onCommentsPanelStateChange({ open: false });
            }
        }

        function renderUnavailable(treeId, memoryId, generation, force) {
            if (!getElements()) return;
            delete cardEl.dataset.socialLoading;
            resetCommentsPanel();

            if (!force) {
                likeValueEl.textContent = '—';
                var likeStatus = likeValueEl.parentElement;
                if (likeStatus) likeStatus.setAttribute('aria-label', '좋아요 정보 없음');
                commentValueEl.textContent = '—';
                var commentStatus = commentValueEl.parentElement;
                if (commentStatus) commentStatus.setAttribute('aria-label', '댓글 정보 없음');
                noteEl.textContent = '반응 정보를 불러올 수 없어요.';

                // Add real keyboard-accessible retry button only in unavailable state
                if (!cardEl.querySelector('[data-social-retry="1"]')) {
                    var retryBtn = document.createElement('button');
                    retryBtn.setAttribute('data-social-retry', '1');
                    retryBtn.className = 'editor-retry-button';
                    retryBtn.textContent = '다시 시도';
                    retryBtn.setAttribute('aria-label', '반응 정보 다시 불러오기');
                    retryBtn.type = 'button';
                    retryBtn.onclick = function() {
                        if (generation !== getGeneration()) return;
                        performFetch(treeId, memoryId, generation, false);
                    };
                    cardEl.appendChild(retryBtn);
                }
            } else {
                var statusRegion = document.getElementById('momentReactionLikeStatusRegion');
                if (statusRegion) {
                    statusRegion.textContent = '반응 동기화에 실패했습니다.';
                    statusRegion.style.display = '';
                    setTimeout(function() {
                        if (statusRegion) {
                            statusRegion.style.display = 'none';
                            statusRegion.textContent = '';
                        }
                    }, 4000);
                }
            }
        }

        function performFetch(treeId, memoryId, generation, force, preservePanel) {
            if (!fetchReactionSummary || !fetchComments) {
                if (generation === getGeneration()) {
                    if (sharedGenRef) {
                        sharedGenRef.publicSummaryValid = false;
                    }
                    renderUnavailable(treeId, memoryId, generation, force);
                    if (sharedGenRef && typeof sharedGenRef.onPublicSummarySettled === 'function') {
                        sharedGenRef.onPublicSummarySettled(generation);
                    }
                }
                return;
            }

            setLoadingState(force, preservePanel);

            Promise.all([
                fetchReactionSummary(treeId, memoryId).catch(function() { return null; }),
                fetchComments(treeId, memoryId).catch(function() { return null; })
            ]).then(function(results) {
                if (generation !== getGeneration()) return;
                var reactionData = results[0];
                var commentsData = results[1];
                if (reactionData !== null && commentsData !== null) {
                    var valid = validateSocialDTOs(reactionData, commentsData);
                    if (valid) {
                        if (sharedGenRef) {
                            sharedGenRef.publicSummaryValid = true;
                        }
                        commentMemoryMeta = {
                            memoryId: memoryId,
                            treeId: treeId,
                            generation: generation,
                            comments: valid.comments,
                            data: lastData
                        };
                        renderSuccess(valid.likeCount, valid.commentCount, force);
                        // Wire comment toggle only on success (non-force or first load)
                        if (!force || !commentToggleEl.onclick) {
                            wireCommentToggle(generation, memoryId);
                        }
                        // If preserving panel, re-render comments display
                        if (preservePanel && commentPanelEl && !commentPanelEl.hidden) {
                            if (commentsListEl) commentsListEl.textContent = '';
                            if (commentsPanelStatusEl) commentsPanelStatusEl.textContent = '';
                            if (!valid.comments || valid.comments.length === 0) {
                                commentsPanelStatusEl.textContent = '아직 댓글이 없어요. 이 순간에 첫 댓글을 남겨보세요.';
                            } else {
                                for (var i = 0; i < valid.comments.length; i++) {
                                    var li = document.createElement('li');
                                    li.textContent = valid.comments[i].body;
                                    commentsListEl.appendChild(li);
                                }
                            }
                        }
                    } else {
                        if (sharedGenRef) {
                            sharedGenRef.publicSummaryValid = false;
                        }
                        renderUnavailable(treeId, memoryId, generation, force);
                    }
                } else {
                    if (sharedGenRef) {
                        sharedGenRef.publicSummaryValid = false;
                    }
                    renderUnavailable(treeId, memoryId, generation, force);
                }
                if (sharedGenRef && typeof sharedGenRef.onPublicSummarySettled === 'function') {
                    sharedGenRef.onPublicSummarySettled(generation);
                }
            });
        }

        function hideCard() {
            if (!getElements()) return;
            cardEl.style.display = 'none';
            removeRetryButton();
            resetCommentsPanel();
        }

        // -------------------------------------------------------------------------
        // #3239 — focus return: capture BEFORE close, verify ALL conditions AFTER
        // Do NOT re-read document.activeElement after emitPanelState(false).
        // -------------------------------------------------------------------------
        function wireCommentToggle(gen, memId) {
            if (!commentToggleEl) return;
            commentToggleEl.onclick = function() {
                var currentMeta = commentMemoryMeta;
                if (getGeneration() !== gen) return;
                // A click may set aria-expanded=true only when metadata
                // exists and generation + memoryId both match the current wire.
                if (!currentMeta || currentMeta.generation !== gen || currentMeta.memoryId !== memId) {
                    return;
                }
                var isOpen = commentToggleEl.getAttribute('aria-expanded') === 'true';
                if (isOpen) {
                    // A. Capture focus state BEFORE any DOM mutation
                    var wasFocusInsideCurrentPanel = commentPanelEl &&
                        typeof document !== 'undefined' &&
                        document.activeElement &&
                        typeof commentPanelEl.contains === 'function' &&
                        commentPanelEl.contains(document.activeElement);

                    // B. Close
                    commentToggleEl.setAttribute('aria-expanded', 'false');
                    if (commentPanelEl) commentPanelEl.hidden = true;
                    emitPanelState(false);

                    // C. Restore focus only when ALL preconditions are met
                    if (wasFocusInsideCurrentPanel) {
                        try {
                            if (
                                // Generation and metadata still match
                                getGeneration() === gen &&
                                commentMemoryMeta &&
                                commentMemoryMeta.generation === gen &&
                                commentMemoryMeta.memoryId === memId &&
                                // Toggle exists and is actionable
                                commentToggleEl &&
                                typeof commentToggleEl.focus === 'function' &&
                                commentToggleEl['disabled'] !== true &&
                                // Toggle is visible (property and style)
                                commentToggleEl.hidden !== true &&
                                commentToggleEl.style.display !== 'none' &&
                                // Toggle is not detached from DOM
                                commentToggleEl.isConnected === true &&
                                // Card exists and is visible
                                cardEl &&
                                cardEl.hidden !== true &&
                                cardEl.style.display !== 'none' &&
                                cardEl.isConnected === true
                            ) {
                                commentToggleEl.focus();
                            }
                        } catch (e) {
                            // Defensive: ignore any DOM exceptions in mock or edge environments
                        }
                    }
                } else {
                    commentToggleEl.setAttribute('aria-expanded', 'true');
                    openCommentPanel(currentMeta.comments);
                }
            };
        }

        return function updatePublicViewerReadOnlyReactionSummary(data, force) {
            var preservePanel = false;
            if (force && typeof force === 'object') {
                preservePanel = !!force.preserveCommentsPanel;
                force = !!force.force;
            }
            var context = resolveSocialContext ? resolveSocialContext(data) : null;
            if (!context) {
                hideCard();
                var thisGen = nextGeneration();
                if (sharedGenRef) {
                    sharedGenRef.publicSummaryValid = false;
                }
                lastLoadedMemoryId = null;
                return;
            }

            lastData = data;

            var treeId = context.treeId;
            var memoryId = context.memoryId;

            // Avoid duplicate requests when same moment is rendered repeatedly (debounce window)
            // unless force=true (used for post-write reconciliation)
            if (memoryId === lastLoadedMemoryId && !force) {
                return;
            }

            var thisGen = getGeneration();
            if (!force) {
                thisGen = nextGeneration();
                if (sharedGenRef) {
                    sharedGenRef.publicSummaryValid = false;
                }
            }
            lastLoadedMemoryId = memoryId;

            performFetch(treeId, memoryId, thisGen, force, preservePanel);
        };
    }

    // Export to namespace
    window.LoveBudPublicViewerReadOnlySocialSummary.createPublicViewerReadOnlyReactionSummaryBoundary =
        createPublicViewerReadOnlyReactionSummaryBoundary;
})();