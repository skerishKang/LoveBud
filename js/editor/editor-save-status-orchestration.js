(function() {
    const createEditorSaveStatusOrchestration = ({ editorSaveStatus, i18n, formatTimeAgo }) => {
        let saveStatusData = editorSaveStatus.createSaveStatusState
            ? editorSaveStatus.createSaveStatusState()
            : { status: 'saved', lastSaved: null, timer: null };

        const updateSaveStatus = (status, message) => {
            if (editorSaveStatus.updateSaveStatus) {
                saveStatusData = editorSaveStatus.updateSaveStatus(saveStatusData, { status, message, i18n }) || saveStatusData;
                return;
            }
            const indicator = document.getElementById('saveStatusIndicator');
            const iconEl = document.getElementById('saveStatusIcon');
            const textEl = document.getElementById('saveStatusText');
            const timeEl = document.getElementById('lastSavedTime');
            
            if (!indicator || !iconEl || !textEl) return;
            
            if (saveStatusData.timer) {
                clearTimeout(saveStatusData.timer);
                saveStatusData.timer = null;
            }
            
            saveStatusData.status = status;
            
            const hideLater = (ms) => {
                saveStatusData.timer = setTimeout(() => { indicator.style.display = 'none'; }, ms);
            };
            
            if (status === 'saving') {
                iconEl.textContent = 'hourglass_empty';
                textEl.textContent = message || i18n('save_saving');
                indicator.className = 'save-status-indicator saving';
                indicator.style.display = 'flex';
                if (timeEl) timeEl.style.display = 'none';
                return;
            }
            if (status === 'saved') {
                iconEl.textContent = 'check_circle';
                textEl.textContent = message || i18n('save_saved');
                indicator.className = 'save-status-indicator saved';
                saveStatusData.lastSaved = new Date();
                if (timeEl) {
                    timeEl.style.display = 'inline';
                    timeEl.textContent = formatTimeAgo(saveStatusData.lastSaved);
                }
                hideLater(3000);
                return;
            }
            if (status === 'failed') {
                iconEl.textContent = 'error';
                textEl.textContent = message || i18n('save_failed');
                indicator.className = 'save-status-indicator failed';
                if (timeEl) timeEl.style.display = 'none';
                hideLater(5000);
            }
        };

        return {
            saveStatusData,
            updateSaveStatus
        };
    };

    window.LoveBudEditorSaveStatusOrchestration = {
        createEditorSaveStatusOrchestration
    };
})();
