/**
 * LoveBud - Editor Save Status
 * v20260420-1
 *
 * Responsibilities:
 * - manage save status state
 * - format relative saved time
 * - render save status indicator UI
 */

(function() {
  function createSaveStatusState() {
    return {
      status: 'saved',
      lastSaved: null,
      timer: null
    };
  }

  function formatTimeAgo(date) {
    if (!date) return '';
    var now = new Date();
    var diff = Math.floor((now - date) / 1000);

    if (diff < 60) return '방금';
    if (diff < 3600) return Math.floor(diff / 60) + '분 전';
    if (diff < 86400) return Math.floor(diff / 3600) + '시간 전';
    return Math.floor(diff / 86400) + '일 전';
  }

  function updateSaveStatus(saveStatusData, options) {
    var status = options && options.status;
    var message = options && options.message;
    var i18n = options && options.i18n;

    var indicator = document.getElementById('saveStatusIndicator');
    var iconEl = document.getElementById('saveStatusIcon');
    var textEl = document.getElementById('saveStatusText');
    var timeEl = document.getElementById('lastSavedTime');

    if (!indicator || !iconEl || !textEl || !saveStatusData) return saveStatusData;

    if (saveStatusData.timer) {
      clearTimeout(saveStatusData.timer);
      saveStatusData.timer = null;
    }

    saveStatusData.status = status;

    switch (status) {
      case 'saving':
        iconEl.textContent = 'hourglass_empty';
        textEl.textContent = message || (typeof i18n === 'function' ? i18n('save_saving') : '저장 중...');
        indicator.className = 'save-status-indicator saving';
        indicator.style.display = 'flex';
        if (timeEl) timeEl.style.display = 'none';
        break;

      case 'saved':
        iconEl.textContent = 'check_circle';
        textEl.textContent = message || (typeof i18n === 'function' ? i18n('save_saved') : '저장됨');
        indicator.className = 'save-status-indicator saved';
        saveStatusData.lastSaved = new Date();
        if (timeEl) {
          timeEl.style.display = 'inline';
          timeEl.textContent = formatTimeAgo(saveStatusData.lastSaved);
        }
        saveStatusData.timer = setTimeout(function() {
          indicator.style.display = 'none';
        }, 3000);
        break;

      case 'failed':
        iconEl.textContent = 'error';
        textEl.textContent = message || (typeof i18n === 'function' ? i18n('save_failed') : '저장 실패');
        indicator.className = 'save-status-indicator failed';
        if (timeEl) timeEl.style.display = 'none';
        saveStatusData.timer = setTimeout(function() {
          indicator.style.display = 'none';
        }, 5000);
        break;
    }

    return saveStatusData;
  }

  window.LoveBudEditorSaveStatus = {
    createSaveStatusState: createSaveStatusState,
    formatTimeAgo: formatTimeAgo,
    updateSaveStatus: updateSaveStatus
  };
})();
