// ── Editor Detail Inline Edit Boundary Helper ───────────────────────────────────
// Responsible: encapsulate inline title/memo edit button creation and state binding.
// Does not affect tree meta rendering or other UI components.
// Preserves existing native prompt behavior and edit flows.

function createEditorDetailInlineEditBoundary(deps) {
    const {
        updateSelectedMemoryFields,
        showToast,
        formatI18nText,
        i18n,
        getMemoFallbackText
    } = deps;

    // ── Title edit boundary helper ──────────────────────────────────────────
    // Responsible: encapsulate inline title edit button creation and state binding.
    // Does not affect memo edit or current memory actions.
    const createTitleEditBoundary = (titleContainer, data, { updateSelectedMemoryFields, showToast, formatI18nText, i18n, isEmptyState }) => {
        if (isEmptyState || typeof updateSelectedMemoryFields !== 'function') return;

        const editBtn = document.createElement('button');
        editBtn.className = 'memory-edit-button';
        editBtn.innerHTML = '<span class="material-symbols-outlined" style="font-size:14px;vertical-align:middle;margin-right:2px;">edit</span>' + formatI18nText('editMemoryTitle', '제목 수정');

        editBtn.onclick = () => {
            titleContainer.innerHTML = '';

            const input = document.createElement('input');
            input.type = 'text';
            input.value = data.title || '';

            const actions = document.createElement('div');
            actions.className = 'memory-edit-actions';

            const saveBtn = document.createElement('button');
            saveBtn.className = 'btn-save';
            saveBtn.textContent = formatI18nText('saveMemoryTitle', '저장');

            const cancelBtn = document.createElement('button');
            cancelBtn.className = 'btn-cancel';
            cancelBtn.textContent = formatI18nText('cancelMemoryTitle', '취소');

            const errorMsg = document.createElement('div');
            errorMsg.className = 'memory-edit-error';

            actions.appendChild(cancelBtn);
            actions.appendChild(saveBtn);

            const wrap = document.createElement('div');
            wrap.style.width = '100%';
            wrap.appendChild(input);
            wrap.appendChild(errorMsg);
            wrap.appendChild(actions);
            titleContainer.appendChild(wrap);

            input.focus();

            const endEdit = () => { 
                // Trigger detail panel update through parent
                const event = new CustomEvent('memoryEditEnd', { detail: { type: 'title', data } });
                document.dispatchEvent(event);
            };

            const saveEdit = async () => {
                const newTitle = input.value.trim();
                if (!newTitle) {
                    errorMsg.textContent = formatI18nText('memoryTitleRequired', '순간 제목을 입력해 주세요');
                    return;
                }
                errorMsg.textContent = '';
                saveBtn.disabled = true;
                cancelBtn.disabled = true;
                if (await updateSelectedMemoryFields({ title: newTitle })) {
                    if (showToast) showToast(formatI18nText('memoryUpdateSaved', '순간을 수정했어요.'), 'success');
                    endEdit();
                } else {
                    if (showToast) showToast(formatI18nText('memoryUpdateFailed', '순간을 수정하지 못했어요.'), 'error');
                    saveBtn.disabled = false;
                    cancelBtn.disabled = false;
                }
            };

            cancelBtn.onclick = endEdit;
            saveBtn.onclick = saveEdit;

            input.addEventListener('keydown', (e) => {
                if (e.key === 'Enter') { e.preventDefault(); saveEdit(); }
                if (e.key === 'Escape') { e.preventDefault(); endEdit(); }
            });
        };

        titleContainer.appendChild(editBtn);
    };

    // ── Memo edit boundary helper ────────────────────────────────────────────
    // Responsible: encapsulate inline memo edit textarea, buttons, and state binding.
    // Does not affect title edit or current memory actions.
    const createMemoEditBoundary = (memoContainer, data, { updateSelectedMemoryFields, showToast, formatI18nText, getMemoFallbackText, isEmptyState, editButtonMount }) => {
        memoContainer.innerHTML = '';
        if (editButtonMount) editButtonMount.innerHTML = '';

        const memoBody = document.createElement('div');
        memoBody.style.lineHeight = '1.8';
        memoBody.style.fontSize = '0.95rem';
        memoBody.style.color = 'var(--on-surface)';
        memoBody.style.whiteSpace = 'pre-line';
        memoBody.textContent = isEmptyState
            ? getMemoFallbackText({ isEmptyState: true })
            : (data.memo || formatI18nText('emptyMemoryNote', '아직 메모가 남겨지지 않았어요'));
        memoContainer.appendChild(memoBody);

        if (isEmptyState || typeof updateSelectedMemoryFields !== 'function') return;

        const editBtn = document.createElement('button');
        editBtn.className = 'memory-edit-button editor-memo-heading-edit-button';
        editBtn.innerHTML = '<span class="material-symbols-outlined" style="font-size:14px;vertical-align:middle;margin-right:2px;">edit</span>' + formatI18nText('editMemoryNote', '메모 수정');

        editBtn.onclick = () => {
            memoContainer.innerHTML = '';
            if (editButtonMount) editButtonMount.innerHTML = '';

            const textarea = document.createElement('textarea');
            textarea.className = 'memory-edit-textarea';
            textarea.value = data.memo || '';

            const hintDiv = document.createElement('div');
            hintDiv.className = 'memory-edit-hint';
            hintDiv.textContent = formatI18nText('noteSaveHint', 'Ctrl+Enter로 저장할 수 있어요.');

            const errorMsg = document.createElement('div');
            errorMsg.className = 'memory-edit-error';
            errorMsg.setAttribute('role', 'status');

            const actions = document.createElement('div');
            actions.className = 'memory-edit-actions';

            const saveBtn = document.createElement('button');
            saveBtn.className = 'btn-save';
            saveBtn.textContent = formatI18nText('saveMemoryNote', '메모 저장');

            const cancelBtn = document.createElement('button');
            cancelBtn.className = 'btn-cancel';
            cancelBtn.textContent = formatI18nText('cancelMemoryNote', '취소');

            actions.appendChild(cancelBtn);
            actions.appendChild(saveBtn);

            memoContainer.appendChild(textarea);
            memoContainer.appendChild(hintDiv);
            memoContainer.appendChild(errorMsg);
            memoContainer.appendChild(actions);

            textarea.focus();

            const endEdit = () => { 
                // Trigger detail panel update through parent
                const event = new CustomEvent('memoryEditEnd', { detail: { type: 'memo', data } });
                document.dispatchEvent(event);
            };

            const saveEdit = async () => {
                const newMemo = textarea.value.trim();
                errorMsg.textContent = '';
                saveBtn.disabled = true;
                cancelBtn.disabled = true;
                if (await updateSelectedMemoryFields({ memo: newMemo })) {
                    if (showToast) showToast(formatI18nText('memoryUpdateSaved', '순간을 수정했어요.'), 'success');
                    endEdit();
                } else {
                    errorMsg.textContent = formatI18nText('memoryUpdateFailed', '순간을 수정하지 못했어요.');
                    if (showToast) showToast(formatI18nText('memoryUpdateFailed', '순간을 수정하지 못했어요.'), 'error');
                    saveBtn.disabled = false;
                    cancelBtn.disabled = false;
                }
            };

            cancelBtn.onclick = endEdit;
            saveBtn.onclick = saveEdit;

            textarea.addEventListener('keydown', (e) => {
                if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) { e.preventDefault(); saveEdit(); }
                if (e.key === 'Escape') { e.preventDefault(); endEdit(); }
            });
        };

        (editButtonMount || memoContainer).appendChild(editBtn);
    };

    return {
        createTitleEditBoundary,
        createMemoEditBoundary
    };
}

window.createEditorDetailInlineEditBoundary = createEditorDetailInlineEditBoundary;
