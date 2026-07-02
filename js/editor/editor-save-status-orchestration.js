(function() {
    const createEditorSaveStatusOrchestration = ({ editorSaveStatus, i18n, formatTimeAgo }) => {
        let saveStatusData = editorSaveStatus.createSaveStatusState
            ? editorSaveStatus.createSaveStatusState()
            : { phase: 'idle', type: null, lastSaved: null, timer: null };

        const updateSaveStatus = (status, message) => {
            if (editorSaveStatus.updateSaveStatus) {
                saveStatusData = editorSaveStatus.updateSaveStatus(saveStatusData, { status, message, i18n }) || saveStatusData;
                return;
            }
            // ── Fallback (direct DOM, no state machine module) ───────────
            const indicator = document.getElementById('saveStatusIndicator');
            const iconEl = document.getElementById('saveStatusIcon');
            const textEl = document.getElementById('saveStatusText');
            const timeEl = document.getElementById('lastSavedTime');

            if (!indicator || !iconEl || !textEl) return;

            if (saveStatusData.timer) {
                clearTimeout(saveStatusData.timer);
                saveStatusData.timer = null;
            }

            // Parse typed status (e.g. 'auto_saving', 'manual_saved') or legacy
            var phase = 'saved';
            var type = 'manual';
            if (status === 'saving' || status === 'saved' || status === 'failed' || status === 'idle') {
                phase = status;
                type = 'manual';
            } else {
                var parts = status.split('_');
                if (parts.length === 2) {
                    var possibleType = parts[0];
                    var possiblePhase = parts[1];
                    if ((possibleType === 'auto' || possibleType === 'manual' || possibleType === 'checkpoint') &&
                        (possiblePhase === 'saving' || possiblePhase === 'saved' || possiblePhase === 'failed')) {
                        type = possibleType;
                        phase = possiblePhase;
                    }
                }
            }

            saveStatusData.phase = phase;
            saveStatusData.type = type;

            const hideLater = (ms) => {
                saveStatusData.timer = setTimeout(() => { indicator.style.display = 'none'; }, ms);
            };

            // Determine message from i18n or fallback
            var i18nKey = 'save_' + type + '_' + phase;
            var displayMessage = message || (typeof i18n === 'function' ? i18n(i18nKey) : null);
            if (!displayMessage || displayMessage === i18nKey) {
                var fallbacks = {
                    'auto_saving': '임시 저장 중...',
                    'auto_saved': '임시 저장됨',
                    'auto_failed': '임시 저장 실패',
                    'manual_saving': '저장 중...',
                    'manual_saved': '저장됨',
                    'manual_failed': '저장 실패',
                    'checkpoint_saving': '연결 저장 중...',
                    'checkpoint_saved': '연결 저장됨',
                    'checkpoint_failed': '연결 저장 실패'
                };
                displayMessage = fallbacks[type + '_' + phase] || message || '저장 중...';
            }

            const classNameMap = {
                'auto_saving': 'save-status-indicator saving saving-auto',
                'auto_saved': 'save-status-indicator saved saved-auto',
                'auto_failed': 'save-status-indicator failed failed-auto',
                'manual_saving': 'save-status-indicator saving saving-manual',
                'manual_saved': 'save-status-indicator saved saved-manual',
                'manual_failed': 'save-status-indicator failed failed-manual',
                'checkpoint_saving': 'save-status-indicator saving saving-checkpoint',
                'checkpoint_saved': 'save-status-indicator saved saved-checkpoint',
                'checkpoint_failed': 'save-status-indicator failed failed-checkpoint'
            };

            if (phase === 'saving') {
                iconEl.textContent = 'hourglass_empty';
                textEl.textContent = displayMessage;
                indicator.className = classNameMap[type + '_' + phase] || 'save-status-indicator saving';
                indicator.style.display = 'flex';
                if (timeEl) timeEl.style.display = 'none';
                return;
            }
            if (phase === 'saved') {
                iconEl.textContent = 'check_circle';
                textEl.textContent = displayMessage;
                indicator.className = classNameMap[type + '_' + phase] || 'save-status-indicator saved';
                saveStatusData.lastSaved = new Date();
                if (timeEl) {
                    timeEl.style.display = 'inline';
                    timeEl.textContent = typeof formatTimeAgo === 'function' ? formatTimeAgo(saveStatusData.lastSaved) : '';
                }
                hideLater(3000);
                return;
            }
            if (phase === 'failed') {
                iconEl.textContent = 'error';
                textEl.textContent = displayMessage;
                indicator.className = classNameMap[type + '_' + phase] || 'save-status-indicator failed';
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
