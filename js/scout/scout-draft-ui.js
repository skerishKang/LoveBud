/**
 * LoveBud Scout Draft UI Module
 * Phase 2: Stub suggestion provider wiring (manual save still required)
 * v20260615-1
 *
 * Provides the UI for:
 * - Public source URL input
 * - Excerpt/summary textarea
 * - Memo textarea
 * - Emotion tags input
 * - Save/preview actions
 * - AI 제안 받기 button wired to stub provider
 */

(function() {
    'use strict';

    function isScoutUIDebugEnabled() {
        return window.LOVEBUD_DEBUG === true || window.LOVEBUD_SCOUT_DEBUG === true;
    }

    function scoutUIDebugLog() {
        if (!isScoutUIDebugEnabled() || !window.console || typeof console.log !== 'function') return;
        console.log.apply(console, arguments);
    }

    const ScoutDraft = window.LoveBudScoutDraft;
    const i18n = window.t || function(key) { return key; };

    // Track suggestion state for UI
    let suggestionState = 'idle'; // idle, loading, success, error, unavailable, pending_configuration
    let suggestionAvailability = null; // cached availability check

    function createScoutDraftUI(deps) {
        const {
            treeId,
            getSelectedNodeId,
            getCanonicalRootId,
            resolveParentIdForCreate,
            showToast,
            i18n: localI18n,
            onDraftSave,
            onDraftCancel
        } = deps || {};

        const t = localI18n || i18n;

        // DOM refs
        let refs = {};
        let isOpen = false;
        let escHandler = null;
        let outsideClickHandler = null;
        let openingTrigger = null;

        // Shared accessibility lifecycle (js/shared/modal-a11y.js). Owns Tab
        // containment, Escape (exactly one close request), initial focus, and
        // guarded focus restoration to the real desktop/mobile trigger. The
        // controller keeps page-owned behavior: backdrop close and draft state.
        const modalA11y = (window.LoveBudModalA11y && typeof window.LoveBudModalA11y.createLifecycle === 'function')
            ? window.LoveBudModalA11y.createLifecycle({
                getModal: () => refs.modal,
                isOpen: () => isOpen,
                onRequestClose: () => closeModal(),
                canClose: () => true,
                getInitialFocus: () => refs.sourceUrlInput,
                getRestoreFocus: () => openingTrigger,
                onFallbackFocus: () => {
                    // Desktop trigger (#ftbScoutAction) lives inside the floating
                    // toolbar dropdown and is hidden after the modal opens; land
                    // focus on the visible floating-toolbar opener instead of BODY.
                    const more = document.getElementById('ftbMoreBtn');
                    if (more && more.isConnected && more.disabled !== true && more.hidden !== true) {
                        try { more.focus(); } catch (err) { /* no-op */ }
                    }
                },
                escapeStopPropagation: true,
                bindTarget: 'document'
            })
            : null;

        function getRefs() {
            return {
                modal: document.getElementById('scoutDraftModal'),
                sourceUrlInput: document.getElementById('scoutSourceUrlInput'),
                excerptTextarea: document.getElementById('scoutExcerptTextarea'),
                memoTextarea: document.getElementById('scoutMemoTextarea'),
                emotionTagsInput: document.getElementById('scoutEmotionTagsInput'),
                saveBtn: document.getElementById('scoutDraftSaveBtn'),
                cancelBtn: document.getElementById('scoutDraftCancelBtn'),
                closeBtn: document.getElementById('scoutDraftCloseBtn'),
                sourceUrlError: document.getElementById('scoutSourceUrlError'),
                previewBtn: document.getElementById('scoutDraftPreviewBtn'),
                suggestBtn: document.getElementById('scoutDraftSuggestBtn'),
                suggestFeedback: document.getElementById('scoutSuggestFeedback')
            };
        }

        function setError(field, message) {
            const errorEl = refs[field + 'Error'];
            if (errorEl) {
                errorEl.textContent = message;
                errorEl.style.display = message ? 'block' : 'none';
            }
            const inputEl = refs[field + 'Input'] || refs[field + 'Textarea'];
            if (inputEl) {
                inputEl.classList.toggle('has-error', !!message);
            }
        }

        function clearAllErrors() {
            ['sourceUrl', 'excerpt', 'memo', 'emotionTags'].forEach(field => {
                setError(field, '');
            });
        }

        function setSuggestionState(state, message) {
            suggestionState = state;
            if (refs.suggestBtn) {
                refs.suggestBtn.disabled = state === 'loading';
            }
            if (refs.suggestFeedback) {
                if (state === 'success' || state === 'error' || state === 'unavailable') {
                    refs.suggestFeedback.style.display = 'block';
                    refs.suggestFeedback.textContent = message || '';
                } else {
                    refs.suggestFeedback.style.display = 'none';
                    refs.suggestFeedback.textContent = '';
                }
            }
        }

        function resetForm() {
            refs.sourceUrlInput.value = '';
            refs.excerptTextarea.value = '';
            refs.memoTextarea.value = '';
            refs.emotionTagsInput.value = '';
            suggestionState = 'idle';
            setSuggestionState('idle', '');
            clearAllErrors();
        }

        function createModalInDOM() {
            const mount = document.body;

            // Overlay
            const overlay = document.createElement('div');
            overlay.className = 'scout-draft-modal-overlay';
            overlay.id = 'scoutDraftModal';
            overlay.setAttribute('role', 'dialog');
            overlay.setAttribute('aria-modal', 'true');
            overlay.setAttribute('aria-labelledby', 'scoutDraftTitle');

            // Modal
            const modal = document.createElement('div');
            modal.className = 'scout-draft-modal';

            // Header
            const header = document.createElement('div');
            header.className = 'scout-draft-header';
            const h2 = document.createElement('h2');
            h2.id = 'scoutDraftTitle';
            h2.textContent = t('scout_draft_title') || 'Scout 순간 저장';
            header.appendChild(h2);
            const closeBtn = document.createElement('button');
            closeBtn.type = 'button';
            closeBtn.className = 'scout-draft-close-btn';
            closeBtn.id = 'scoutDraftCloseBtn';
            closeBtn.setAttribute('aria-label', '닫기');
            closeBtn.textContent = '×';
            header.appendChild(closeBtn);
            modal.appendChild(header);

            // Intro helper — concrete Scout value (link → moment → review → save)
            const intro = document.createElement('p');
            intro.className = 'scout-draft-intro';
            intro.id = 'scoutDraftIntro';
            intro.textContent = t('scout_intro_help') || '';
            modal.appendChild(intro);

            // Form
            const form = document.createElement('form');
            form.className = 'scout-draft-form';

            // Source URL field
            const sourceField = document.createElement('div');
            sourceField.className = 'scout-field';
            const sourceLabel = document.createElement('label');
            sourceLabel.htmlFor = 'scoutSourceUrlInput';
            sourceLabel.textContent = t('scout_source_url_label') || '출처 링크';
            const sourceInput = document.createElement('input');
            sourceInput.type = 'url';
            sourceInput.id = 'scoutSourceUrlInput';
            sourceInput.className = 'scout-input';
            sourceInput.placeholder = 'https://';
            const sourceHint = document.createElement('div');
            sourceHint.className = 'field-hint';
            sourceHint.textContent = t('scout_source_url_hint') || 'URL 또는 발췌/메모 중 하나를 입력하세요';
            const sourceError = document.createElement('div');
            sourceError.className = 'scout-error';
            sourceError.id = 'scoutSourceUrlError';
            sourceField.appendChild(sourceLabel);
            sourceField.appendChild(sourceInput);
            sourceField.appendChild(sourceHint);
            sourceField.appendChild(sourceError);
            form.appendChild(sourceField);

            // Excerpt field
            const excerptField = document.createElement('div');
            excerptField.className = 'scout-field';
            const excerptLabel = document.createElement('label');
            excerptLabel.htmlFor = 'scoutExcerptTextarea';
            excerptLabel.textContent = t('scout_excerpt_label') || '발췌';
            const excerptTextarea = document.createElement('textarea');
            excerptTextarea.id = 'scoutExcerptTextarea';
            excerptTextarea.className = 'scout-textarea';
            excerptTextarea.placeholder = t('scout_excerpt_placeholder') || '핵심 내용을 발췌하세요';
            excerptTextarea.rows = 3;
            excerptField.appendChild(excerptLabel);
            excerptField.appendChild(excerptTextarea);
            form.appendChild(excerptField);

            // Memo field
            const memoField = document.createElement('div');
            memoField.className = 'scout-field';
            const memoLabel = document.createElement('label');
            memoLabel.htmlFor = 'scoutMemoTextarea';
            memoLabel.textContent = t('scout_memo_label') || '메모';
            const memoTextarea = document.createElement('textarea');
            memoTextarea.id = 'scoutMemoTextarea';
            memoTextarea.className = 'scout-textarea';
            memoTextarea.placeholder = t('scout_memo_placeholder') || '개인 메모를 입력하세요';
            memoTextarea.rows = 3;
            memoField.appendChild(memoLabel);
            memoField.appendChild(memoTextarea);
            form.appendChild(memoField);

            // Emotion tags field
            const tagsField = document.createElement('div');
            tagsField.className = 'scout-field';
            const tagsLabel = document.createElement('label');
            tagsLabel.htmlFor = 'scoutEmotionTagsInput';
            tagsLabel.textContent = t('scout_emotion_tags_label') || '감정 태그';
            const tagsInput = document.createElement('input');
            tagsInput.type = 'text';
            tagsInput.id = 'scoutEmotionTagsInput';
            tagsInput.className = 'scout-input';
            tagsInput.placeholder = t('scout_emotion_tags_placeholder') || '태그1, 태그2, 태그3';
            const tagsHint = document.createElement('div');
            tagsHint.className = 'field-hint';
            tagsHint.textContent = t('scout_emotion_tags_hint') || '최대 4개, 각 20자 이내';
            tagsField.appendChild(tagsLabel);
            tagsField.appendChild(tagsInput);
            tagsField.appendChild(tagsHint);
            form.appendChild(tagsField);

            // Suggestion feedback area
            const feedbackDiv = document.createElement('div');
            feedbackDiv.className = 'scout-field scout-suggest-feedback';
            feedbackDiv.id = 'scoutSuggestFeedback';
            feedbackDiv.style.display = 'none';
            form.appendChild(feedbackDiv);

            modal.appendChild(form);

            // Actions
            const actions = document.createElement('div');
            actions.className = 'scout-draft-actions';

            const suggestBtn = document.createElement('button');
            suggestBtn.type = 'button';
            suggestBtn.className = 'scout-btn scout-btn-secondary';
            suggestBtn.id = 'scoutDraftSuggestBtn';
            suggestBtn.textContent = t('scout_suggest_btn') || 'AI 제안 받기';
            actions.appendChild(suggestBtn);

            const cancelBtn = document.createElement('button');
            cancelBtn.type = 'button';
            cancelBtn.className = 'scout-btn scout-btn-outline';
            cancelBtn.id = 'scoutDraftCancelBtn';
            cancelBtn.textContent = t('cancel') || '취소';
            actions.appendChild(cancelBtn);

            const previewBtn = document.createElement('button');
            previewBtn.type = 'button';
            previewBtn.className = 'scout-btn scout-btn-outline';
            previewBtn.id = 'scoutDraftPreviewBtn';
            previewBtn.textContent = t('preview') || '미리보기';
            actions.appendChild(previewBtn);

            const saveBtn = document.createElement('button');
            saveBtn.type = 'button';
            saveBtn.className = 'scout-btn scout-btn-primary';
            saveBtn.id = 'scoutDraftSaveBtn';
            saveBtn.textContent = t('save') || '저장';
            actions.appendChild(saveBtn);

            modal.appendChild(actions);
            overlay.appendChild(modal);
            mount.appendChild(overlay);

            scoutUIDebugLog('[ScoutDraftUI] Modal rendered dynamically');
        }

        function openModal(trigger) {
            refs = getRefs();
            if (!refs.modal) {
                createModalInDOM();
                refs = getRefs();
                scoutUIDebugLog('[ScoutDraftUI] Modal created dynamically');
            }
            resetForm();

            // Store the real desktop/mobile opening trigger before focus moves.
            // Desktop invokes through #ftbScoutAction; mobile through #mobileScoutAction.
            const active = document.activeElement;
            openingTrigger = (trigger && trigger.nodeType === 1) ? trigger
                : (active && active !== document.body && active !== document.documentElement) ? active
                : null;

            refs.modal.style.display = 'flex';
            refs.modal.classList.add('is-open');
            isOpen = true;

            // Shared lifecycle owns Escape (exactly once), Tab containment, and
            // initial focus after visibility. No second custom Escape listener.
            if (modalA11y) {
                modalA11y.open();
            } else {
                // Helper-absent fallback: keep the previous minimal behavior.
                setTimeout(() => {
                    if (refs.sourceUrlInput) refs.sourceUrlInput.focus();
                }, 50);
                escHandler = (e) => {
                    if (e.key === 'Escape') {
                        e.stopPropagation();
                        closeModal();
                    }
                };
                document.addEventListener('keydown', escHandler);
            }

            // Outside click handler (backdrop close) stays controller-owned.
            // refs.modal is the full overlay; clicks on the dimmed overlay itself
            // (outside the inner panel) close the dialog, clicks inside the panel
            // are left to the form controls.
            //
            // Registered synchronously (not via setTimeout) so a backdrop click
            // immediately after opening is never missed. The opening trigger click
            // is safe: its capture phase already completed before openModal ran, and
            // the desktop dropdown additionally stops propagation.
            outsideClickHandler = (e) => {
                if (!isOpen) return;
                const panel = refs.modal ? refs.modal.querySelector('.scout-draft-modal') : null;
                if (panel && panel.contains(e.target)) return;
                if (e.target.closest('[data-scout-draft-trigger]')) return;
                closeModal();
            };
            document.addEventListener('click', outsideClickHandler, true);

            // Bind save
            if (refs.saveBtn) {
                refs.saveBtn.onclick = handleSave;
            }

            // Bind preview
            if (refs.previewBtn) {
                refs.previewBtn.onclick = handlePreview;
            }

            // Bind suggest button
            if (refs.suggestBtn) {
                refs.suggestBtn.onclick = handleSuggest;
            }

            // Bind cancel/close
            const closeHandler = () => closeModal();
            if (refs.cancelBtn) refs.cancelBtn.onclick = closeHandler;
            if (refs.closeBtn) refs.closeBtn.onclick = closeHandler;

            // Real-time validation on source URL
            if (refs.sourceUrlInput) {
                refs.sourceUrlInput.addEventListener('input', () => {
                    const result = ScoutDraft.validateSourceUrl(refs.sourceUrlInput.value);
                    setError('sourceUrl', result.ok ? '' : result.message);
                });
            }

            scoutUIDebugLog('[ScoutDraftUI] Modal opened');
            return true;
        }

        function closeModal() {
            if (!refs.modal || !isOpen) return;
            refs.modal.style.display = 'none';
            refs.modal.classList.remove('is-open');
            isOpen = false;

            if (modalA11y) {
                modalA11y.close();
            } else if (escHandler) {
                document.removeEventListener('keydown', escHandler);
                escHandler = null;
            }
            if (outsideClickHandler) {
                document.removeEventListener('click', outsideClickHandler, true);
                outsideClickHandler = null;
            }

            // Guarded focus restoration to the real opening trigger.
            if (modalA11y) {
                modalA11y.restoreFocus();
            } else if (openingTrigger && typeof openingTrigger.focus === 'function') {
                try { openingTrigger.focus(); } catch (err) { /* no-op */ }
            }
            openingTrigger = null;

            if (onDraftCancel) onDraftCancel();

            scoutUIDebugLog('[ScoutDraftUI] Modal closed');
        }

        function handleSave() {
            const sourceUrl = refs.sourceUrlInput?.value || '';
            const excerpt = refs.excerptTextarea?.value || '';
            const memo = refs.memoTextarea?.value || '';
            const emotionTagsInput = refs.emotionTagsInput?.value || '';
            const emotionTags = ScoutDraft.parseEmotionTagsInput(emotionTagsInput);

            clearAllErrors();

            // Build draft
            const draftResult = ScoutDraft.buildScoutDraft({
                sourceUrl,
                excerpt,
                memo,
                emotionTags,
                treeId: treeId || null
            });

            if (!draftResult.ok) {
                setError(draftResult.field || 'sourceUrl', draftResult.message);
                showToast?.(draftResult.message, 'error');
                return;
            }

            // Convert to memory payload
            const payloadResult = ScoutDraft.convertDraftToMemoryPayload(
                draftResult.data,
                resolveParentIdForCreate,
                getSelectedNodeId,
                getCanonicalRootId,
                t
            );

            if (!payloadResult.ok) {
                showToast?.(payloadResult.message, 'error');
                return;
            }

            // Close modal and trigger save callback
            closeModal();

            if (onDraftSave) {
                onDraftSave(payloadResult.data, draftResult.data);
            } else {
                // Default: show success toast
                showToast?.(t('save_saved') || '저장됨', 'success');
            }

            scoutUIDebugLog('[ScoutDraftUI] Draft saved', payloadResult.data);
        }

        async function handleSuggest() {
            // Lazy lookup at interaction time: the provider module loads after
            // this UI module, so the current global must be resolved per click.
            const ScoutSuggestionProvider = window.LoveBudScoutSuggestionProvider;

            // Check availability first
            if (!ScoutSuggestionProvider || !ScoutSuggestionProvider.getScoutSuggestionAvailability) {
                setSuggestionState('unavailable', t('scout_suggest_unavailable') || 'AI 제안을 사용할 수 없습니다. 직접 입력 후 저장할 수 있습니다.');
                return;
            }

            // Check availability - defaults to stub mode
            const availability = ScoutSuggestionProvider.getScoutSuggestionAvailability('stub');
            suggestionAvailability = availability;

            if (!availability.available) {
                const fallbackMsg = availability.mode === 'pending_configuration'
                    ? (t('scout_suggest_pending') || availability.message)
                    : (t('scout_suggest_unavailable') || availability.message);
                setSuggestionState(availability.mode, fallbackMsg);
                return;
            }

            const sourceUrl = refs.sourceUrlInput?.value || '';
            const excerpt = refs.excerptTextarea?.value || '';
            const memo = refs.memoTextarea?.value || '';

            setSuggestionState('loading');

            try {
                // Use source selector if available, otherwise direct stub provider
                const sourceSelector = window.LoveBudScoutSuggestionSourceSelector;
                const provider = sourceSelector
                    ? sourceSelector.createScoutSuggestionSourceProvider()
                    : ScoutSuggestionProvider.createScoutStubSuggestionProvider();
                const suggestion = await provider.suggest({
                    sourceUrl: sourceUrl,
                    excerpt: excerpt,
                    summary: excerpt,
                    memo: memo,
                    requestedLanguage: t.getLocale ? t.getLocale() : 'ko',
                    desiredTone: 'neutral',
                    maxOutputLength: 200
                });

                // Apply suggestions to editable fields (excerpt/memo only, no auto-save)
                if (suggestion.summarySuggestion && refs.excerptTextarea) {
                    refs.excerptTextarea.value = suggestion.summarySuggestion;
                }
                if (suggestion.memoSuggestion && refs.memoTextarea) {
                    refs.memoTextarea.value = suggestion.memoSuggestion;
                }
                if (suggestion.emotionTags && suggestion.emotionTags.length && refs.emotionTagsInput) {
                    refs.emotionTagsInput.value = suggestion.emotionTags.join(', ');
                }

                setSuggestionState('success', t('scout_suggest_applied') || '제안이 적용되었습니다.');
                scoutUIDebugLog('[ScoutDraftUI] Suggestion applied', suggestion);
            } catch (err) {
                setSuggestionState('error', t('scout_suggest_error') || 'AI 제안을 불러오지 못했습니다.');
                scoutUIDebugLog('[ScoutDraftUI] Suggestion error', err);
            }
        }

        function handlePreview() {
            const sourceUrl = refs.sourceUrlInput?.value || '';
            const excerpt = refs.excerptTextarea?.value || '';
            const memo = refs.memoTextarea?.value || '';
            const emotionTagsInput = refs.emotionTagsInput?.value || '';
            const emotionTags = ScoutDraft.parseEmotionTagsInput(emotionTagsInput);

            clearAllErrors();

            const draftResult = ScoutDraft.buildScoutDraft({
                sourceUrl,
                excerpt,
                memo,
                emotionTags,
                treeId: treeId || null
            });

            if (!draftResult.ok) {
                setError(draftResult.field || 'sourceUrl', draftResult.message);
                return;
            }

            // Show preview - could open a small preview panel
            const payloadResult = ScoutDraft.convertDraftToMemoryPayload(
                draftResult.data,
                resolveParentIdForCreate,
                getSelectedNodeId,
                getCanonicalRootId,
                t
            );

            if (payloadResult.ok) {
                showPreview(payloadResult.data);
            }
        }

        function showPreview(payload) {
            // Create preview overlay using safe DOM node assembly (no innerHTML)
            const overlay = document.createElement('div');
            overlay.className = 'scout-preview-overlay';
            overlay.id = 'scoutPreviewOverlay';

            const content = document.createElement('div');
            content.className = 'scout-preview-content';

            // Header
            const header = document.createElement('div');
            header.className = 'scout-preview-header';

            const h3 = document.createElement('h3');
            h3.textContent = t('scout_preview_title') || '저장 미리보기';
            header.appendChild(h3);

            const closeBtn = document.createElement('button');
            closeBtn.type = 'button';
            closeBtn.className = 'scout-preview-close';
            closeBtn.id = 'scoutPreviewCloseBtn';
            closeBtn.setAttribute('aria-label', '닫기');
            closeBtn.textContent = '×';
            header.appendChild(closeBtn);

            content.appendChild(header);

            // Body
            const body = document.createElement('div');
            body.className = 'scout-preview-body';

            function createField(labelText, valueText) {
                const field = document.createElement('div');
                field.className = 'preview-field';

                const label = document.createElement('label');
                label.textContent = labelText;
                field.appendChild(label);

                const span = document.createElement('span');
                span.textContent = valueText || '—';
                field.appendChild(span);

                return field;
            }

            body.appendChild(createField(t('scout_preview_title_label') || '제목', payload.title));
            body.appendChild(createField(t('scout_preview_source_label') || '출처', payload.sourceUrl || '—'));

            // Source URL as link if present
            if (payload.sourceUrl) {
                const sourceField = body.lastElementChild;
                const span = sourceField.querySelector('span');
                const link = document.createElement('a');
                link.href = payload.sourceUrl;
                link.target = '_blank';
                link.rel = 'noopener';
                link.textContent = payload.sourceUrl;
                span.textContent = '';
                span.appendChild(link);
            }

            body.appendChild(createField(t('scout_preview_excerpt_label') || '발췌', payload.memo));
            body.appendChild(createField(t('scout_preview_tags_label') || '감정 태그',
                payload.emotionTags && payload.emotionTags.length ? payload.emotionTags.join(', ') : '—'));

            content.appendChild(body);

            // Footer
            const footer = document.createElement('div');
            footer.className = 'scout-preview-footer';

            const editBtn = document.createElement('button');
            editBtn.type = 'button';
            editBtn.className = 'btn-round btn-outline';
            editBtn.id = 'scoutPreviewEditBtn';
            editBtn.textContent = t('scout_preview_edit') || '수정';
            footer.appendChild(editBtn);

            const confirmBtn = document.createElement('button');
            confirmBtn.type = 'button';
            confirmBtn.className = 'btn-round btn-primary';
            confirmBtn.id = 'scoutPreviewConfirmBtn';
            confirmBtn.textContent = t('save') || '저장';
            footer.appendChild(confirmBtn);

            content.appendChild(footer);
            overlay.appendChild(content);

            // Remove existing preview
            const existing = document.getElementById('scoutPreviewOverlay');
            if (existing) existing.remove();

            document.body.appendChild(overlay);

            const closePreview = () => {
                overlay.style.opacity = '0';
                setTimeout(() => overlay.remove(), 200);
            };

            // Event listeners - buttons already created above with IDs
            const closeBtnEl = document.getElementById('scoutPreviewCloseBtn');
            const editBtnEl = document.getElementById('scoutPreviewEditBtn');
            const confirmBtnEl = document.getElementById('scoutPreviewConfirmBtn');

            closeBtnEl?.addEventListener('click', closePreview);
            editBtnEl?.addEventListener('click', closePreview);
            confirmBtnEl?.addEventListener('click', () => {
                closePreview();
                if (onDraftSave) onDraftSave(payload, draftResult.data);
            });

            overlay.addEventListener('click', (e) => {
                if (e.target === overlay) closePreview();
            });

            // Animate in
            requestAnimationFrame(() => {
                overlay.style.opacity = '1';
            });
        }

        // Public API
        return {
            open: openModal,
            close: closeModal,
            isOpen: () => isOpen
        };
    }

    window.LoveBudScoutDraftUI = {
        createScoutDraftUI
    };
})();