// Cache-bust marker for #3294 production no-change feedback rollout.
/**
 * LoveBud - Editor Save Status (State Machine)
 * v20260702-1
 *
 * State machine pattern for save status management.
 * Distinguishes between three save types:
 *   auto       — 임시 저장 (auto-save, inline field updates)
 *   manual     — 수동 저장 (manual save, explicit user action)
 *   checkpoint — 체크포인트 (tree structure changes: connect/disconnect)
 *
 * State machine states:
 *   idle                    — No save activity (indicator hidden)
 *   {type}_saving           — Save in progress
 *   {type}_saved            — Save completed successfully
 *   {type}_failed           — Save failed
 *
 * Transition rules:
 *   idle --begin(type)--> {type}_saving
 *   {type}_saving --success--> {type}_saved
 *   {type}_saving --failure--> {type}_failed
 *   {type}_saved --timeout--> idle
 *   {type}_failed --timeout--> idle
 *   ANY --begin(any)--> {new_type}_saving  (preempt)
 *
 * Save types:
 *   SaveType.AUTO       = 'auto'
 *   SaveType.MANUAL     = 'manual'
 *   SaveType.CHECKPOINT = 'checkpoint'
 *
 * Phase labels (Korean):
 *   auto:       '임시 저장 중...' / '임시 저장됨' / '임시 저장 실패'
 *   manual:     '저장 중...'     / '저장됨'     / '저장 실패'
 *   checkpoint: '연결 저장 중...'  / '연결 저장됨'  / '연결 저장 실패'
 *
 * Phase labels (English):
 *   auto:       'Auto-saving...' / 'Auto-saved' / 'Auto-save failed'
 *   manual:     'Saving...'      / 'Saved'      / 'Save failed'
 *   checkpoint: 'Checkpoint saving...' / 'Checkpoint saved' / 'Checkpoint save failed'
 */

(function() {
  'use strict';

  // ── State Machine Constants ────────────────────────────────────────────

  var SavePhase = {
    IDLE: 'idle',
    SAVING: 'saving',
    SAVED: 'saved',
    FAILED: 'failed',
    BLOCKED: 'blocked',
    NOCHANGE: 'nochange'
  };

  var SaveType = {
    AUTO: 'auto',
    MANUAL: 'manual',
    CHECKPOINT: 'checkpoint'
  };

  // All valid combined states: {type}_{phase}
  var VALID_STATES = {};
  (function buildValidStates() {
    var types = [SaveType.AUTO, SaveType.MANUAL, SaveType.CHECKPOINT];
    var phases = [SavePhase.SAVING, SavePhase.SAVED, SavePhase.FAILED, SavePhase.BLOCKED, SavePhase.NOCHANGE];
    for (var t = 0; t < types.length; t++) {
      for (var p = 0; p < phases.length; p++) {
        VALID_STATES[types[t] + '_' + phases[p]] = true;
      }
    }
    VALID_STATES[SavePhase.IDLE] = true;
  })();

  // i18n key mapping: {type}_{phase} -> i18n key suffix
  function getI18nKey(type, phase) {
    if (phase === SavePhase.IDLE) return '';
    var typeSuffix = '';
    if (type === SaveType.AUTO) typeSuffix = 'auto';
    else if (type === SaveType.MANUAL) typeSuffix = 'manual';
    else if (type === SaveType.CHECKPOINT) typeSuffix = 'checkpoint';

    var phaseSuffix = '';
    if (phase === SavePhase.SAVING) phaseSuffix = 'saving';
    else if (phase === SavePhase.SAVED) phaseSuffix = 'saved';
    else if (phase === SavePhase.FAILED) phaseSuffix = 'failed';

    return 'save_' + typeSuffix + '_' + phaseSuffix;
  }

  // Fallback message mapping (Korean)
  function getDefaultMessage(type, phase) {
    if (phase === SavePhase.SAVING) {
      if (type === SaveType.AUTO) return '임시 저장 중...';
      if (type === SaveType.MANUAL) return '저장 중...';
      if (type === SaveType.CHECKPOINT) return '연결 저장 중...';
    }
    if (phase === SavePhase.SAVED) {
      if (type === SaveType.AUTO) return '임시 저장됨';
      if (type === SaveType.MANUAL) return '저장됨';
      if (type === SaveType.CHECKPOINT) return '연결 저장됨';
    }
    if (phase === SavePhase.FAILED) {
      if (type === SaveType.AUTO) return '임시 저장 실패';
      if (type === SaveType.MANUAL) return '저장 실패';
      if (type === SaveType.CHECKPOINT) return '연결 저장 실패';
    }
    if (phase === SavePhase.BLOCKED) {
      if (type === SaveType.MANUAL) return '지금은 저장할 수 없어요';
    }
    if (phase === SavePhase.NOCHANGE) {
      if (type === SaveType.MANUAL) return '변경된 내용이 없어요';
    }
    return '';
  }

  // ── State Machine Constructor ──────────────────────────────────────────

  function createSaveStatusState() {
    return {
      // Current phase and type
      phase: SavePhase.IDLE,
      type: null,
      // Last saved timestamp
      lastSaved: null,
      // Auto-hide timer
      timer: null,
      // Constants
      SavePhase: SavePhase,
      SaveType: SaveType
    };
  }

  // ── Core State Transition ──────────────────────────────────────────────

  /**
   * Transition the state machine to a new state.
   * Returns the new state object (mutated in place).
   *
   * @param {Object} state       - Current save status state
   * @param {string} type        - SaveType (auto/manual/checkpoint) or null for idle
   * @param {string} phase       - SavePhase (saving/saved/failed/idle)
   * @param {Object} [options]
   * @param {string} [options.message] - Custom message (overrides i18n)
   * @param {Function} [options.i18n]  - i18n translation function
   * @returns {Object} The updated state
   */
  function transition(state, type, phase, options) {
    if (!state) return state;
    var opts = options || {};

    // Validate
    if (phase !== SavePhase.IDLE) {
      var combined = type + '_' + phase;
      if (!VALID_STATES[combined]) {
        console.warn('[editor-save-status] Invalid state transition: type=' + type + ', phase=' + phase);
        return state;
      }
    }

    // Clear any existing auto-hide timer
    if (state.timer) {
      clearTimeout(state.timer);
      state.timer = null;
    }

    // Set new phase and type
    state.phase = phase;
    state.type = phase === SavePhase.IDLE ? null : type;

    // On saved: record timestamp
    if (phase === SavePhase.SAVED) {
      state.lastSaved = new Date();
    }

    return state;
  }

  // ── UI Update ──────────────────────────────────────────────────────────

  /**
   * Update the DOM save status indicator based on current state.
   *
   * @param {Object} state      - Current save status state
   * @param {Object} [options]
   * @param {string} [options.message] - Custom message override
   * @param {Function} [options.i18n]  - i18n translation function
   * @returns {Object} The state (for chaining)
   */
  function updateUI(state, options) {
    if (!state) return state;
    var opts = options || {};

    var indicator = document.getElementById('saveStatusIndicator');
    var iconEl = document.getElementById('saveStatusIcon');
    var textEl = document.getElementById('saveStatusText');
    var timeEl = document.getElementById('lastSavedTime');

    if (!indicator || !iconEl || !textEl) return state;

    var phase = state.phase;
    var type = state.type;

    // ── Idle: hide indicator ─────────────────────────────────────────
    if (phase === SavePhase.IDLE) {
      indicator.style.display = 'none';
      if (timeEl) timeEl.style.display = 'none';
      return state;
    }

    // ── Determine message ────────────────────────────────────────────
    var message = opts.message;
    if (!message) {
      var i18nKey = getI18nKey(type, phase);
      var i18n = opts.i18n;
      if (i18nKey && typeof i18n === 'function') {
        message = i18n(i18nKey);
      }
      if (!message || message === i18nKey) {
        message = getDefaultMessage(type, phase);
      }
    }

    // ── Determine icon ───────────────────────────────────────────────
    var icon = '';
    var className = 'save-status-indicator';

    if (phase === SavePhase.SAVING) {
      icon = 'hourglass_empty';
      className += ' saving';
      if (type === SaveType.AUTO) className += ' saving-auto';
      else if (type === SaveType.MANUAL) className += ' saving-manual';
      else if (type === SaveType.CHECKPOINT) className += ' saving-checkpoint';
    } else if (phase === SavePhase.SAVED) {
      icon = 'check_circle';
      className += ' saved';
      if (type === SaveType.AUTO) className += ' saved-auto';
      else if (type === SaveType.MANUAL) className += ' saved-manual';
      else if (type === SaveType.CHECKPOINT) className += ' saved-checkpoint';
    } else if (phase === SavePhase.FAILED) {
      icon = 'error';
      className += ' failed';
      if (type === SaveType.AUTO) className += ' failed-auto';
      else if (type === SaveType.MANUAL) className += ' failed-manual';
      else if (type === SaveType.CHECKPOINT) className += ' failed-checkpoint';
    } else if (phase === SavePhase.BLOCKED || phase === SavePhase.NOCHANGE) {
      icon = 'info';
      className += ' info';
      if (type === SaveType.MANUAL) {
        className += phase === SavePhase.BLOCKED ? ' blocked-manual' : ' nochange-manual';
      }
    }

    // ── Update DOM ───────────────────────────────────────────────────
    setStatusIcon(iconEl, icon);
    textEl.textContent = message;
    indicator.className = className;
    indicator.style.display = 'flex';

    if (timeEl) {
      if (phase === SavePhase.SAVED) {
        timeEl.style.display = 'inline';
        timeEl.textContent = formatTimeAgo(state.lastSaved);
      } else {
        timeEl.style.display = 'none';
      }
    }

    // ── Auto-hide timer ──────────────────────────────────────────────
    if (phase === SavePhase.SAVED || phase === SavePhase.FAILED || phase === SavePhase.BLOCKED || phase === SavePhase.NOCHANGE) {
      var hideDelay = 5000;
      if (phase === SavePhase.SAVED) hideDelay = 3000;
      if (phase === SavePhase.NOCHANGE) hideDelay = 4000;
      state.timer = setTimeout(function() {
        indicator.style.display = 'none';
        state.phase = SavePhase.IDLE;
        state.type = null;
      }, hideDelay);
    }

    return state;
  }

  function setStatusIcon(iconEl, token) {
    if (!iconEl) return;
    iconEl.textContent = '';
    iconEl.setAttribute('aria-hidden', 'true');
    iconEl.dataset.statusIcon = token || '';
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

  // ── Convenience: One-shot Save Status Update ──────────────────────────

  /**
   * Complete flow: begin + success/failure + UI update.
   * This is a drop-in replacement for the old updateSaveStatus signature.
   *
   * Old API: updateSaveStatus(saveStatusData, { status, message, i18n })
   *   where status is 'saving'|'saved'|'failed'
   *
   * Backward-compatible: status string 'saving'/'saved'/'failed' uses manual type.
   * Typed API: status string 'auto_saving', 'manual_saving', 'checkpoint_saving', etc.
   */
  function updateSaveStatus(saveStatusData, options) {
    if (!saveStatusData) return saveStatusData;
    var opts = options || {};
    var status = opts.status;
    var message = opts.message;
    var i18n = opts.i18n;

    if (!status) return saveStatusData;

    // ── Parse status string ──────────────────────────────────────────
    // Supports both old format ('saving') and new typed format ('auto_saving')
    var type = null;
    var phase = null;

    if (status === 'saving' || status === 'saved' || status === 'failed' || status === 'idle') {
      // Legacy status — default to manual type
      type = SaveType.MANUAL;
      phase = status;
    } else {
      // Typed format: '{type}_{phase}' e.g. 'auto_saving', 'manual_saved'
      var parts = status.split('_');
      if (parts.length === 2) {
        var possibleType = parts[0];
        var possiblePhase = parts[1];
        // Validate
        if ((possibleType === 'auto' || possibleType === 'manual' || possibleType === 'checkpoint') &&
            (possiblePhase === 'saving' || possiblePhase === 'saved' || possiblePhase === 'failed' || possiblePhase === 'blocked' || possiblePhase === 'nochange')) {
          type = possibleType;
          phase = possiblePhase;
        }
      }

      // Fallback if parsing failed
      if (!type || !phase) {
        type = SaveType.MANUAL;
        phase = SavePhase.SAVED;
      }
    }

    // ── Transition state machine ─────────────────────────────────────
    transition(saveStatusData, type, phase, opts);

    // ── Update UI ────────────────────────────────────────────────────
    updateUI(saveStatusData, {
      message: message,
      i18n: i18n
    });

    return saveStatusData;
  }

  // ── Hide indicator ─────────────────────────────────────────────────────

  function hideSaveStatusIndicator(saveStatusData) {
    var indicator = document.getElementById('saveStatusIndicator');
    if (indicator && saveStatusData && saveStatusData.timer) {
      clearTimeout(saveStatusData.timer);
      saveStatusData.timer = null;
    }
    if (indicator) {
      indicator.style.display = 'none';
    }
    if (saveStatusData) {
      saveStatusData.phase = SavePhase.IDLE;
      saveStatusData.type = null;
    }
    return saveStatusData;
  }

  // ── State Inspector ────────────────────────────────────────────────────

  function getCurrentState(saveStatusData) {
    if (!saveStatusData) return { phase: SavePhase.IDLE, type: null };
    return {
      phase: saveStatusData.phase,
      type: saveStatusData.type
    };
  }

  // ── Export ─────────────────────────────────────────────────────────────

  window.LoveBudEditorSaveStatus = {
    // Constants
    SavePhase: SavePhase,
    SaveType: SaveType,

    // State machine
    createSaveStatusState: createSaveStatusState,
    transition: transition,
    updateUI: updateUI,

    // Legacy API (backward compatible)
    updateSaveStatus: updateSaveStatus,
    hideSaveStatusIndicator: hideSaveStatusIndicator,

    // Utilities
    formatTimeAgo: formatTimeAgo,
    getI18nKey: getI18nKey,
    getCurrentState: getCurrentState
  };
})();
