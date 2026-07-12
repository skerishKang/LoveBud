(function() {
    'use strict';

    // Exported namespace for composition by public-viewer-detail-ui.js
    window.LoveBudPublicViewerAuthenticatedLike = {
        createPublicViewerAuthenticatedLikeBoundary: null
    };

    /**
     * createPublicViewerAuthenticatedLikeBoundary — AUTHENTICATED private like state
     *
     * Responsibilities:
     * - Gate on confirmed auth session
     * - Fetch private reaction summary for user's like state
     * - Optimistic like/unlike toggle with rollback on failure
     * - Pending / duplicate-click guard
     * - Post-write public-summary reconciliation callback
     */
    function createPublicViewerAuthenticatedLikeBoundary(deps) {
        var hasConfirmedAuthSession = deps && typeof deps.hasConfirmedAuthSession === 'function'
            ? deps.hasConfirmedAuthSession
            : function() { return false; };
        var fetchReactionSummary = deps && typeof deps.fetchReactionSummary === 'function'
            ? deps.fetchReactionSummary
            : null;
        var toggleReaction = deps && typeof deps.toggleReaction === 'function'
            ? deps.toggleReaction
            : null;
        var isRootMemory = deps && typeof deps.isRootMemory === 'function'
            ? deps.isRootMemory
            : function() { return false; };
        var getCanonicalRootId = deps && typeof deps.getCanonicalRootId === 'function'
            ? deps.getCanonicalRootId
            : function() { return null; };
        var reconcilePublicSummary = deps && typeof deps.reconcilePublicSummary === 'function'
            ? deps.reconcilePublicSummary
            : null;
        var resolveSocialContext = deps && typeof deps.resolveSocialContext === 'function'
            ? deps.resolveSocialContext
            : null;
        var sharedGenRef = deps && deps.sharedGenerationRef;
        var currentGeneration = sharedGenRef ? sharedGenRef.value : 0;

        var lastLikeState = { pressed: false, count: 0 };
        var inFlight = false;
        var lastLoadedMemoryId = null;
        var currentSelectionValid = false;
        var currentSelectionEpoch = 0;
        var nextWriteToken = 0;
        var activeWriteToken = 0;

        var cardEl = null;
        var likeButtonEl = null;
        var guestNoteEl = null;
        var errorEl = null;
        var likeValueEl = null;
        var likeStatusEl = null;
        var commentStatusEl = null;
        var commentValueEl = null;
        var noteEl = null;
        var statusRegionEl = null;
        var treeId = null;

        function getGeneration() {
            return sharedGenRef ? sharedGenRef.value : currentGeneration;
        }

        function getElements() {
            if (!cardEl) cardEl = document.getElementById('momentReactionsCard');
            if (!likeButtonEl) likeButtonEl = document.getElementById('momentReactionLikeButton');
            if (!guestNoteEl) guestNoteEl = document.getElementById('momentReactionLikeGuestNote');
            if (!errorEl) errorEl = document.getElementById('momentReactionWriteError');
            if (!likeValueEl) likeValueEl = document.getElementById('momentReactionLikeValue');
            if (!likeStatusEl) likeStatusEl = document.getElementById('momentReactionLikeStatus');
            if (!commentStatusEl) commentStatusEl = document.getElementById('momentReactionCommentStatus');
            if (!commentValueEl) commentValueEl = document.getElementById('momentReactionCommentValue');
            if (!noteEl) noteEl = document.getElementById('momentReactionNote');
            if (!statusRegionEl) statusRegionEl = document.getElementById('momentReactionLikeStatusRegion');
            return cardEl && likeButtonEl && guestNoteEl && errorEl && likeValueEl && likeStatusEl
                && commentStatusEl && commentValueEl && noteEl && statusRegionEl;
        }

        function setCardReadOnly() {
            if (!getElements()) return;
            cardEl.setAttribute('data-read-only-summary', 'true');
            cardEl.classList.add('is-read-only');
            cardEl.classList.add('is-public-readonly');
            cardEl.setAttribute('aria-label', '순간 반응 (읽기 전용)');
        }

        function setCardActionable() {
            if (!getElements()) return;
            cardEl.removeAttribute('data-read-only-summary');
            cardEl.classList.remove('is-read-only');
            cardEl.classList.remove('is-public-readonly');
            cardEl.setAttribute('aria-label', '순간 반응');
        }

        function hideAuthElements() {
            if (!getElements()) return;
            likeButtonEl.style.display = 'none';
            likeButtonEl.disabled = true;
            likeButtonEl.setAttribute('aria-pressed', 'false');
            likeButtonEl.removeAttribute('aria-busy');
            likeButtonEl.classList.remove('is-pressed');
            likeButtonEl.textContent = '';
            guestNoteEl.style.display = 'none';
            errorEl.style.display = 'none';
            errorEl.textContent = '';
            statusRegionEl.style.display = 'none';
            statusRegionEl.textContent = '';
        }

        function showGuestMode() {
            if (!getElements()) return;
            setCardReadOnly();
            likeButtonEl.style.display = 'none';
            likeButtonEl.disabled = true;
            guestNoteEl.style.display = '';
            guestNoteEl.textContent = '로그인하면 이 순간에 반응하고 댓글을 남길 수 있어요.';
            errorEl.style.display = 'none';
            errorEl.textContent = '';
            statusRegionEl.style.display = 'none';
            statusRegionEl.textContent = '';
            noteEl.textContent = '댓글은 아래에서 바로 읽을 수 있어요.';
        }

        function updateLikeButtonUI(pressed) {
            if (!likeButtonEl) return;
            likeButtonEl.setAttribute('aria-pressed', pressed ? 'true' : 'false');
            likeButtonEl.classList.toggle('is-pressed', pressed);
            likeButtonEl.textContent = pressed ? '❤️ 좋아요 취소' : '❤️ 좋아요';
            likeButtonEl.setAttribute('aria-label', pressed ? '좋아요 취소' : '좋아요 누르기');
        }

        function syncButtonActionableState() {
            if (!getElements()) return;
            if (currentSelectionValid && sharedGenRef && sharedGenRef.publicSummaryValid) {
                likeButtonEl.disabled = inFlight;
            } else {
                likeButtonEl.disabled = true;
            }
            if (inFlight) {
                likeButtonEl.setAttribute('aria-busy', 'true');
            } else {
                likeButtonEl.removeAttribute('aria-busy');
            }
        }

        function showAuthActionable(pressed, count) {
            if (!getElements()) return;
            setCardActionable();
            likeButtonEl.style.display = '';
            updateLikeButtonUI(pressed);
            syncButtonActionableState();
            guestNoteEl.style.display = 'none';
            errorEl.style.display = 'none';
            errorEl.textContent = '';
            statusRegionEl.style.display = 'none';
            statusRegionEl.textContent = '';
            if (likeStatusEl) likeStatusEl.setAttribute('aria-label', '좋아요 ' + (parseInt(likeValueEl.textContent, 10) || 0) + '개');
            noteEl.textContent = '댓글을 바로 읽고 남길 수 있어요.';
        }

        function showAuthUnavailable() {
            if (!getElements()) return;
            setCardReadOnly();
            likeButtonEl.style.display = 'none';
            likeButtonEl.disabled = true;
            guestNoteEl.style.display = '';
            guestNoteEl.textContent = '좋아요 정보를 불러올 수 없어요.';
            errorEl.style.display = 'none';
            errorEl.textContent = '';
            statusRegionEl.style.display = 'none';
            statusRegionEl.textContent = '';
            noteEl.textContent = '좋아요를 불러오지 못했지만 댓글은 계속 확인할 수 있어요.';
        }

        function showPoliteNotice(message) {
            if (!getElements()) return;
            errorEl.textContent = message || '';
            errorEl.style.display = '';
            errorEl.setAttribute('role', 'status');
            errorEl.setAttribute('aria-live', 'polite');

            statusRegionEl.textContent = message || '';
            statusRegionEl.style.display = '';
            setTimeout(function() {
                if (errorEl) {
                    errorEl.style.display = 'none';
                    errorEl.textContent = '';
                }
                if (statusRegionEl) {
                    statusRegionEl.style.display = 'none';
                    statusRegionEl.textContent = '';
                }
            }, 4000);
        }

        function validatePrivateDTO(result) {
            if (!result || typeof result !== 'object' || Array.isArray(result)) {
                return null;
            }
            var userReactions = result.userReactions;
            if (!userReactions || typeof userReactions !== 'object' || Array.isArray(userReactions)) {
                return null;
            }
            var counts = result.counts;
            if (!counts || typeof counts !== 'object' || Array.isArray(counts)) {
                return null;
            }

            if (Object.prototype.hasOwnProperty.call(userReactions, 'like')) {
                if (typeof userReactions.like !== 'boolean') {
                    return null;
                }
            }

            if (Object.prototype.hasOwnProperty.call(counts, 'like')) {
                var like = counts.like;
                if (typeof like !== 'number' || !Number.isFinite(like) || like < 0 || Math.floor(like) !== like) {
                    return null;
                }
            }

            var pressed = false;
            if (Object.prototype.hasOwnProperty.call(userReactions, 'like')) {
                pressed = userReactions.like;
            }

            var count = null;
            if (Object.prototype.hasOwnProperty.call(counts, 'like')) {
                count = counts.like;
            }

            return {
                pressed: pressed,
                count: count
            };
        }

        function validateWriteResponse(response) {
            if (!response || typeof response !== 'object' || Array.isArray(response)) {
                return null;
            }
            if (response.type !== 'like') {
                return null;
            }
            if (typeof response.active !== 'boolean') {
                return null;
            }
            var counts = response.counts;
            if (!counts || typeof counts !== 'object' || Array.isArray(counts)) {
                return null;
            }
            var hasLikeCount = Object.prototype.hasOwnProperty.call(counts, 'like');
            if (response.active === false && !hasLikeCount) {
                return { active: false, count: 0 };
            }
            if (response.active === true && !hasLikeCount) {
                return null;
            }
            var like = counts.like;
            if (typeof like !== 'number' || !Number.isFinite(like) || like < 0 || Math.floor(like) !== like) {
                return null;
            }
            if (response.active === true && like < 1) {
                return null;
            }
            return { active: response.active, count: like };
        }

        function createClickHandler(memoryId, boundEpoch) {
            return function() {
                if (inFlight) return;
                if (!toggleReaction) return;
                if (boundEpoch !== currentSelectionEpoch) return;
                if (memoryId !== lastLoadedMemoryId) return;
                if (!currentSelectionValid) return;

                // Save current state for rollback
                var previousPressed = likeButtonEl.getAttribute('aria-pressed') === 'true';
                var previousCount = parseInt(likeValueEl.textContent, 10) || 0;

                // Optimistic toggle
                var newPressed = !previousPressed;
                var newCount = previousCount + (newPressed ? 1 : -1);
                if (newCount < 0) newCount = 0;

                lastLikeState.pressed = previousPressed;
                lastLikeState.count = previousCount;

                // Update UI optimistically
                updateLikeButtonUI(newPressed);
                likeValueEl.textContent = String(newCount);
                if (likeStatusEl) likeStatusEl.setAttribute('aria-label', '좋아요 ' + newCount + '개');

                var writeToken = ++nextWriteToken;
                activeWriteToken = writeToken;
                inFlight = true;
                syncButtonActionableState();

                var callEpoch = currentSelectionEpoch;

                toggleReaction(memoryId, 'like').then(function(response) {
                    var ownsActiveWrite = activeWriteToken === writeToken;
                    var stillCurrentSelection =
                        ownsActiveWrite &&
                        callEpoch === currentSelectionEpoch &&
                        memoryId === lastLoadedMemoryId &&
                        currentSelectionValid;

                    if (!ownsActiveWrite) {
                        return;
                    }

                    inFlight = false;
                    activeWriteToken = 0;

                    if (!stillCurrentSelection) {
                        syncButtonActionableState();
                        return;
                    }
                    if (!getElements()) return;

                    // Use response as immediate state
                    var validatedWrite = validateWriteResponse(response);
                    if (!validatedWrite) {
                        updateLikeButtonUI(lastLikeState.pressed);
                        likeValueEl.textContent = String(lastLikeState.count);
                        if (likeStatusEl) likeStatusEl.setAttribute('aria-label', '좋아요 ' + lastLikeState.count + '개');
                        showPoliteNotice('좋아요를 처리할 수 없어요. 다시 시도해 주세요.');
                        syncButtonActionableState();
                        return;
                    }

                    var active = validatedWrite.active;
                    var responseCount = validatedWrite.count;
                    updateLikeButtonUI(active);
                    likeValueEl.textContent = String(responseCount);
                    if (likeStatusEl) likeStatusEl.setAttribute('aria-label', '좋아요 ' + responseCount + '개');
                    lastLikeState.pressed = active;
                    lastLikeState.count = responseCount;

                    syncButtonActionableState();

                    // Public reconciliation after successful write
                    if (typeof reconcilePublicSummary === 'function') {
                        reconcilePublicSummary({ id: memoryId, treeId: treeId }, true);
                    }
                }).catch(function() {
                    var ownsActiveWrite = activeWriteToken === writeToken;
                    var stillCurrentSelection =
                        ownsActiveWrite &&
                        callEpoch === currentSelectionEpoch &&
                        memoryId === lastLoadedMemoryId &&
                        currentSelectionValid;

                    if (!ownsActiveWrite) {
                        return;
                    }

                    inFlight = false;
                    activeWriteToken = 0;

                    if (!stillCurrentSelection) {
                        syncButtonActionableState();
                        return;
                    }
                    if (!getElements()) return;

                    // Rollback to previous state
                    updateLikeButtonUI(lastLikeState.pressed);
                    likeValueEl.textContent = String(lastLikeState.count);
                    if (likeStatusEl) likeStatusEl.setAttribute('aria-label', '좋아요 ' + lastLikeState.count + '개');

                    showPoliteNotice('좋아요를 처리할 수 없어요. 다시 시도해 주세요.');
                    syncButtonActionableState();
                });
            };
        }

        function loadPrivateSummary(memoryId, boundEpoch) {
            if (!fetchReactionSummary) {
                showAuthUnavailable();
                return;
            }

            // Fetch private reaction summary to get user's like state
            fetchReactionSummary(memoryId).then(function(result) {
                if (boundEpoch !== currentSelectionEpoch) return;
                if (!getElements()) return;

                var validated = validatePrivateDTO(result);
                if (!validated) {
                    currentSelectionValid = false;
                    showAuthUnavailable();
                    return;
                }

                currentSelectionValid = true;
                lastLikeState.pressed = validated.pressed;

                if (validated.count === null) {
                    var parsedCount = 0;
                    if (likeValueEl && likeValueEl.textContent) {
                        var txt = likeValueEl.textContent.trim();
                        if (txt !== '' && txt !== '⋯' && txt !== '...' && txt !== '—') {
                            var num = parseInt(txt, 10);
                            if (!isNaN(num) && num >= 0) {
                                parsedCount = num;
                            }
                        }
                    }
                    lastLikeState.count = parsedCount;
                } else {
                    lastLikeState.count = validated.count;
                }

                // Wire up click handler for this memory
                likeButtonEl.onclick = createClickHandler(memoryId, boundEpoch);

                if (sharedGenRef && sharedGenRef.publicSummaryValid) {
                    showAuthActionable(validated.pressed, validated.count);
                } else {
                    showAuthUnavailable();
                }
            }).catch(function() {
                if (boundEpoch !== currentSelectionEpoch) return;
                currentSelectionValid = false;
                showAuthUnavailable();
            });
        }

        if (sharedGenRef) {
            sharedGenRef.onPublicSummarySettled = function(generation) {
                if (generation !== getGeneration()) return;
                if (!hasConfirmedAuthSession()) {
                    showGuestMode();
                    return;
                }
                if (sharedGenRef.publicSummaryValid) {
                    if (!currentSelectionValid) {
                        loadPrivateSummary(lastLoadedMemoryId, currentSelectionEpoch);
                    } else {
                        showAuthActionable(lastLikeState.pressed, lastLikeState.count);
                    }
                } else {
                    showAuthUnavailable();
                }
            };
        }

        return function updatePublicViewerAuthenticatedLike(data) {
            var context = resolveSocialContext ? resolveSocialContext(data) : null;
            if (!context) {
                currentSelectionEpoch++;
                hideAuthElements();
                lastLoadedMemoryId = null;
                treeId = null;
                currentSelectionValid = false;
                inFlight = false;
                activeWriteToken = 0;
                return;
            }

            var memTreeId = context.treeId;
            var memoryId = context.memoryId;

            // Memory changed: reset selection valid and save lastLoadedMemoryId
            if (memoryId !== lastLoadedMemoryId || memTreeId !== treeId) {
                currentSelectionEpoch++;
                lastLoadedMemoryId = memoryId;
                treeId = memTreeId;
                currentSelectionValid = false;
                inFlight = false;
                activeWriteToken = 0;
            }

            // Check auth
            var isAuthConfirmed = hasConfirmedAuthSession();

            if (!isAuthConfirmed) {
                showGuestMode();
                return;
            }

            // Auth confirmed: show button as disabled / loading initially
            if (!getElements()) return;
            likeButtonEl.style.display = '';
            updateLikeButtonUI(lastLikeState.pressed);
            syncButtonActionableState();
            guestNoteEl.style.display = 'none';
            guestNoteEl.textContent = '로그인하면 이 순간에 반응하고 댓글을 남길 수 있어요.';
            errorEl.style.display = 'none';
            statusRegionEl.style.display = 'none';

            if (sharedGenRef && sharedGenRef.publicSummaryValid) {
                loadPrivateSummary(memoryId, currentSelectionEpoch);
            } else {
                showAuthUnavailable();
            }
        };
    }

    // Export to namespace
    window.LoveBudPublicViewerAuthenticatedLike.createPublicViewerAuthenticatedLikeBoundary =
        createPublicViewerAuthenticatedLikeBoundary;
})();
