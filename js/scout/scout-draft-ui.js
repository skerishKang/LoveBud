/**
 * LoveBud Scout Draft UI Module
 * Phase 1: Manual draft entrypoint UI
 * v20260605-1
 *
 * Provides the UI for:
 * - Public source URL input
 * - Excerpt/summary textarea
 * - Memo textarea
 * - Emotion tags input
 * - Save/preview actions
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
                previewBtn: document.getElementById('scoutDraftPreviewBtn')
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

        function resetForm() {
            refs.sourceUrlInput.value = '';
            refs.excerptTextarea.value = '';
            refs.memoTextarea.value = '';
            refs.emotionTagsInput.value = '';
            clearAllErrors();
        }

        function openModal() {
            refs = getRefs();
            if (!refs.modal) {
                scoutUIDebugLog('[ScoutDraftUI] Modal not found in DOM');
                return false;
            }
            resetForm();
            refs.modal.style.display = 'flex';
            refs.modal.classList.add('is-open');
            isOpen = true;

            // Focus first input
            setTimeout(() => {
                if (refs.sourceUrlInput) refs.sourceUrlInput.focus();
            }, 50);

            // ESC handler
            escHandler = (e) => {
                if (e.key === 'Escape') {
                    e.stopPropagation();
                    closeModal();
                }
            };
            document.addEventListener('keydown', escHandler);

            // Outside click handler
            outsideClickHandler = (e) => {
                if (refs.modal.contains(e.target)) return;
                if (e.target.closest('[data-scout-draft-trigger]')) return;
                closeModal();
            };
            setTimeout(() => document.addEventListener('click', outsideClickHandler, true), 0);

            // Bind save
            if (refs.saveBtn) {
                refs.saveBtn.onclick = handleSave;
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

            if (escHandler) {
                document.removeEventListener('keydown', escHandler);
                escHandler = null;
            }
            if (outsideClickHandler) {
                document.removeEventListener('click', outsideClickHandler, true);
                outsideClickHandler = null;
            }

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