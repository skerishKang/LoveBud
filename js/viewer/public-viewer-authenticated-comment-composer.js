(function() {
    'use strict';

    // Exported namespace for composition by public-viewer-detail-ui.js
    window.LoveBudPublicViewerAuthenticatedCommentComposer = {
        createPublicViewerAuthenticatedCommentComposerBoundary: null
    };

    /**
     * createPublicViewerAuthenticatedCommentComposerBoundary — AUTHENTICATED comment composer
     *
     * Responsibilities:
     * - Gate on confirmed auth session + createComment availability
     * - Mount/unmount composer DOM on panel open/close
     * - Local whitespace/empty validation
     * - Cancel: clear draft, preserve panel, no API call
     * - Submit: pending guard, idempotency key, stale-instance guard
     * - Success: clear input, show feedback, reconcile public summary
     * - Failure: preserve input, show safe error, restore buttons
     *
     * NOTE: This boundary must NOT call .focus() or reference document.activeElement.
     */

    function createPublicViewerAuthenticatedCommentComposerBoundary(deps) {
        var hasConfirmedAuthSession = deps && typeof deps.hasConfirmedAuthSession === 'function'
            ? deps.hasConfirmedAuthSession
            : function() { return false; };
        var createComment = deps && typeof deps.createComment === 'function'
            ? deps.createComment
            : null;
        var reconcilePublicSummary = deps && typeof deps.reconcilePublicSummary === 'function'
            ? deps.reconcilePublicSummary
            : null;
        var sharedGenRef = deps && deps.sharedGenerationRef;

        var composerFormEl = null;
        var composerInputEl = null;
        var composerErrorEl = null;
        var composerSuccessEl = null;
        var composerCancelBtn = null;
        var composerDraftIdemKey = null;
        var composerDraftBody = null;
        var activeContext = null;
        var composerInstanceToken = 0;
        var composerValidationActive = false;
        var guestNoteEl = null;

        function getGeneration() {
            return sharedGenRef ? sharedGenRef.value : 0;
        }

        function removeComposerDom() {
            if (composerFormEl && composerFormEl.parentNode) {
                composerFormEl.parentNode.removeChild(composerFormEl);
            }
            composerFormEl = null;
            composerInputEl = null;
            composerErrorEl = null;
            composerSuccessEl = null;
            composerCancelBtn = null;
            composerValidationActive = false;
        }

        function removeGuestNoteDom() {
            if (guestNoteEl && guestNoteEl.parentNode) {
                guestNoteEl.parentNode.removeChild(guestNoteEl);
            }
            guestNoteEl = null;
        }

        function appendGuestNoteDom(panelEl) {
            if (!panelEl) return;
            removeGuestNoteDom();
            guestNoteEl = document.createElement('p');
            guestNoteEl.setAttribute('data-guest-comment-note', '1');
            guestNoteEl.textContent = '댓글은 읽을 수 있어요. 로그인하면 댓글을 남길 수 있어요.';
            guestNoteEl.setAttribute('aria-live', 'polite');
            guestNoteEl.style.margin = '8px 0 0';
            guestNoteEl.style.fontSize = '0.9em';
            guestNoteEl.style.color = '#555';
            panelEl.appendChild(guestNoteEl);
        }

        function deactivateComposer() {
            removeComposerDom();
            removeGuestNoteDom();
            activeContext = null;
            composerDraftIdemKey = null;
            composerDraftBody = null;
            composerInstanceToken++;
        }

        function appendComposerDom(panelEl, context, instanceToken) {
            if (!panelEl) return;
            removeComposerDom();

            composerInputEl = document.createElement('textarea');
            composerInputEl.setAttribute('aria-label', '댓글 입력');
            composerInputEl.placeholder = '댓글을 입력하세요...';
            composerInputEl.rows = 2;
            composerInputEl.maxLength = 5000;
            composerInputEl.style.width = '100%';
            composerInputEl.style.boxSizing = 'border-box';
            composerInputEl.addEventListener('input', function() {
                // Clear local validation only when trimmed non-empty correction is available
                if (composerValidationActive && (composerInputEl.value || '').trim() !== '') {
                    composerErrorEl.style.display = 'none';
                    composerErrorEl.textContent = '';
                    composerValidationActive = false;
                }
            });

            var submitBtn = document.createElement('button');
            submitBtn.textContent = '등록';
            submitBtn.type = 'button';

            composerCancelBtn = document.createElement('button');
            composerCancelBtn.textContent = '입력 취소';
            composerCancelBtn.type = 'button';
            composerCancelBtn.setAttribute('aria-label', '댓글 입력 취소');

            composerErrorEl = document.createElement('p');
            composerErrorEl.setAttribute('aria-live', 'polite');
            composerErrorEl.style.color = 'red';
            composerErrorEl.style.fontSize = '0.85em';
            composerErrorEl.style.margin = '4px 0 0';
            composerErrorEl.style.display = 'none';

            composerSuccessEl = document.createElement('p');
            composerSuccessEl.setAttribute('aria-live', 'polite');
            composerSuccessEl.textContent = '댓글이 등록되었습니다.';
            composerSuccessEl.style.color = 'green';
            composerSuccessEl.style.fontSize = '0.85em';
            composerSuccessEl.style.margin = '4px 0 0';
            composerSuccessEl.style.display = 'none';

            composerFormEl = document.createElement('div');
            composerFormEl.style.display = 'flex';
            composerFormEl.style.flexDirection = 'column';
            composerFormEl.style.gap = '4px';
            composerFormEl.style.marginTop = '8px';

            var inputRow = document.createElement('div');
            inputRow.style.display = 'flex';
            inputRow.style.gap = '8px';
            inputRow.style.alignItems = 'flex-start';
            inputRow.appendChild(composerInputEl);

            var btnGroup = document.createElement('div');
            btnGroup.style.display = 'flex';
            btnGroup.style.gap = '4px';
            btnGroup.style.flexShrink = '0';
            btnGroup.appendChild(submitBtn);
            btnGroup.appendChild(composerCancelBtn);
            inputRow.appendChild(btnGroup);

            composerFormEl.appendChild(inputRow);
            composerFormEl.appendChild(composerErrorEl);
            composerFormEl.appendChild(composerSuccessEl);

            // Reset draft for new composer instance
            composerDraftIdemKey = null;
            composerDraftBody = null;
            composerValidationActive = false;

            submitBtn.onclick = function() {
                if (submitBtn.disabled) return;
                var body = (composerInputEl.value || '').trim();
                // Clear any previous validation
                if (composerValidationActive) {
                    composerErrorEl.style.display = 'none';
                    composerErrorEl.textContent = '';
                    composerValidationActive = false;
                }
                if (!body) {
                    composerErrorEl.textContent = '댓글 내용을 입력해주세요.';
                    composerErrorEl.style.display = '';
                    composerValidationActive = true;
                    return;
                }
                if (body.length > 5000) {
                    composerErrorEl.textContent = '댓글은 5,000자 이하로 입력해주세요.';
                    composerErrorEl.style.display = '';
                    return;
                }
                if (!activeContext) return;

                // Capture immutable submission context for async race safety
                var subCtx = {
                    instanceToken: composerInstanceToken,
                    treeId: activeContext.treeId,
                    memoryId: activeContext.memoryId,
                    generation: getGeneration(),
                    data: activeContext.data
                };
                if (!subCtx.treeId || !subCtx.memoryId) return;

                if (body !== composerDraftBody) {
                    composerDraftIdemKey = 'c-' + Date.now().toString(36) + '-' + Math.random().toString(36).slice(2, 10);
                    composerDraftBody = body;
                }

                submitBtn.disabled = true;
                submitBtn.textContent = '등록 중...';
                composerCancelBtn.disabled = true;
                composerErrorEl.style.display = 'none';
                composerValidationActive = false;
                composerSuccessEl.style.display = 'none';

                createComment(subCtx.memoryId, body, composerDraftIdemKey).then(function() {
                    if (composerInstanceToken !== subCtx.instanceToken) return;
                    if (!activeContext || activeContext.treeId !== subCtx.treeId ||
                        activeContext.memoryId !== subCtx.memoryId) return;

                    submitBtn.disabled = false;
                    submitBtn.textContent = '등록';
                    composerCancelBtn.disabled = false;
                    composerInputEl.value = '';
                    composerDraftIdemKey = null;
                    composerDraftBody = null;
                    composerErrorEl.style.display = 'none';
                    composerSuccessEl.style.display = '';

                    if (subCtx.generation === getGeneration()) {
                        reconcilePublicSummary(subCtx.data, { force: true, preserveCommentsPanel: true });
                    }
                }).catch(function() {
                    if (composerInstanceToken !== subCtx.instanceToken) return;
                    if (!activeContext || activeContext.treeId !== subCtx.treeId ||
                        activeContext.memoryId !== subCtx.memoryId) return;

                    submitBtn.disabled = false;
                    submitBtn.textContent = '등록';
                    composerCancelBtn.disabled = false;
                    composerSuccessEl.style.display = 'none';
                    composerErrorEl.textContent = '댓글을 등록하지 못했습니다. 다시 시도해주세요.';
                    composerErrorEl.style.display = '';
                });
            };

            composerCancelBtn.onclick = function() {
                if (composerCancelBtn.disabled) return;
                // Stale guard: if instance token changed, this handler belongs to a removed composer instance
                if (composerInstanceToken !== instanceToken) return;
                composerInputEl.value = '';
                composerDraftIdemKey = null;
                composerDraftBody = null;
                composerErrorEl.style.display = 'none';
                composerErrorEl.textContent = '';
                composerSuccessEl.style.display = 'none';
                composerValidationActive = false;
            };

            panelEl.appendChild(composerFormEl);
        }

        return function updatePublicViewerAuthenticatedCommentComposer(state) {
            removeGuestNoteDom();
            if (!state || !state.open) {
                deactivateComposer();
                return;
            }
            var panelEl = document.getElementById('momentCommentsPanel');
            if (!panelEl || panelEl.hidden) {
                deactivateComposer();
                return;
            }
            // Guest path — panel is open but user is not authenticated
            if (!hasConfirmedAuthSession()) {
                deactivateComposer();
                appendGuestNoteDom(panelEl);
                return;
            }
            if (typeof createComment !== 'function') {
                deactivateComposer();
                return;
            }

            var newContext = {
                memoryId: state.memoryId,
                treeId: state.treeId,
                data: state.data,
                generation: state.generation !== undefined ? state.generation : (sharedGenRef ? sharedGenRef.value : 0)
            };

            // Mount order: remove old DOM → set new context → increment token → append new DOM
            removeComposerDom();
            activeContext = newContext;
            composerInstanceToken++;
            appendComposerDom(panelEl, activeContext, composerInstanceToken);
        };
    }

    // Export to namespace
    window.LoveBudPublicViewerAuthenticatedCommentComposer.createPublicViewerAuthenticatedCommentComposerBoundary =
        createPublicViewerAuthenticatedCommentComposerBoundary;
})();