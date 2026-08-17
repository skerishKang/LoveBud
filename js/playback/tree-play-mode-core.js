/**
 * Tree Play Mode Queue Core
 * Issue #4064 — Reusable, provider / UI-independent "one active player" queue core
 *
 * This module is a PURE state machine + bounded command-descriptor producer.
 * It has ZERO browser / provider / runtime dependencies:
 *   - no window, document, window.YT
 *   - no Firebase, fetch, LoveBud API client
 *   - no Neon / Modal / Cloudflare env
 *   - no localStorage / sessionStorage
 *   - no network calls
 *
 * It is directly unit-testable in Node (CommonJS) and usable as a classic
 * <script> in the browser (it attaches to globalThis.TreePlayModeCore).
 *
 * Invariant (ONE_ACTIVE_PLAYER):
 *   The core never creates a media element or player. It only ever selects a
 *   SINGLE current occurrence and returns bounded command descriptors
 *   (LOAD / PLAY / PAUSE / SEEK / QUEUE_COMPLETE / MANUAL_CONTINUE_REQUIRED).
 *   The adapter decides HOW a concrete provider (e.g. YouTube IFrame) performs
 *   the command, using exactly one player instance.
 *
 * QUEUE OCCURRENCE IDENTITY != MEDIA ID:
 *   The same mediaId (e.g. a YouTube videoId) may appear as several distinct
 *   queue occurrences (different start/end bounds). Occurrences are identified
 *   by a canonical `occurrenceKey` derived from their canonical input order
 *   (sourceIndex), never by mediaId. Occurrences are never de-duplicated by
 *   mediaId and canonical input order is preserved. The caller's input array
 *   and item objects are never mutated.
 */

(function (global, factory) {
  'use strict';
  if (typeof module === 'object' && module.exports) {
    module.exports = factory();
  } else {
    var g = (typeof self !== 'undefined') ? self
      : (typeof globalThis !== 'undefined') ? globalThis
      : this;
    g.TreePlayModeCore = factory();
  }
})(this, function () {
  'use strict';

  // ---------------------------------------------------------------------------
  // Public constants
  // ---------------------------------------------------------------------------

  var STATES = {
    IDLE: 'IDLE',
    EMPTY: 'EMPTY',
    NO_PLAYABLE_ITEM: 'NO_PLAYABLE_ITEM',
    SELECTED_UNPLAYABLE: 'SELECTED_UNPLAYABLE',
    LOADED: 'LOADED',
    PLAYING: 'PLAYING',
    PAUSED: 'PAUSED',
    AUTO_PLAY_PENDING: 'AUTO_PLAY_PENDING',
    MANUAL_CONTINUE_REQUIRED: 'MANUAL_CONTINUE_REQUIRED',
    QUEUE_COMPLETE: 'QUEUE_COMPLETE',
    BEGINNING: 'BEGINNING'
  };

  var COMMANDS = {
    LOAD_OCCURRENCE: 'LOAD_OCCURRENCE',
    PLAY: 'PLAY',
    PAUSE: 'PAUSE',
    SEEK: 'SEEK',
    QUEUE_COMPLETE: 'QUEUE_COMPLETE',
    MANUAL_CONTINUE_REQUIRED: 'MANUAL_CONTINUE_REQUIRED',
    NO_OP: 'NO_OP'
  };

  var UNAVAILABLE_REASONS = {
    PRIVATE: 'PRIVATE',
    DELETED: 'DELETED',
    UNAVAILABLE: 'UNAVAILABLE',
    NON_EMBEDDABLE: 'NON_EMBEDDABLE',
    INVALID_SEGMENT: 'INVALID_SEGMENT',
    EXPLICITLY_UNPLAYABLE: 'EXPLICITLY_UNPLAYABLE'
  };

  // ---------------------------------------------------------------------------
  // Pure helpers
  // ---------------------------------------------------------------------------

  function isFiniteNumber(v) {
    return typeof v === 'number' && isFinite(v);
  }

  /**
   * Validate optional segment bounds. Fail-closed: any invalid bound makes the
   * segment invalid. Silent coercion is forbidden (non-number types are rejected).
   *
   * @param {*} startSeconds nullable start bound
   * @param {*} endSeconds   nullable end bound
   * @returns {{valid:boolean, reason:?string}}
   */
  function validateSegmentSeconds(startSeconds, endSeconds) {
    var hasStart = startSeconds !== null && startSeconds !== undefined;
    var hasEnd = endSeconds !== null && endSeconds !== undefined;

    if (hasStart && !isFiniteNumber(startSeconds)) {
      return { valid: false, reason: 'INVALID_START' };
    }
    if (hasEnd && !isFiniteNumber(endSeconds)) {
      return { valid: false, reason: 'INVALID_END' };
    }
    if (hasStart && startSeconds < 0) {
      return { valid: false, reason: 'NEGATIVE_START' };
    }
    if (hasStart && hasEnd) {
      if (!(endSeconds > startSeconds)) {
        return { valid: false, reason: 'END_NOT_AFTER_START' };
      }
    } else if (hasEnd && !hasStart) {
      if (!(endSeconds > 0)) {
        return { valid: false, reason: 'END_NOT_POSITIVE' };
      }
    }
    return { valid: true, reason: null };
  }

  function resolveMediaId(raw) {
    if (!raw) return null;
    if (raw.mediaId !== null && raw.mediaId !== undefined) return String(raw.mediaId);
    if (raw.videoId !== null && raw.videoId !== undefined) return String(raw.videoId);
    return null;
  }

  /**
   * Normalize one raw input item into an immutable occurrence descriptor.
   * Reads only — never mutates the caller's object.
   */
  function normalizeItem(raw, sourceIndex) {
    var mediaId = resolveMediaId(raw);
    var title = (raw && raw.title !== null && raw.title !== undefined) ? String(raw.title) : null;
    var provider = (raw && raw.provider !== null && raw.provider !== undefined) ? String(raw.provider) : null;
    var startSeconds = (raw && raw.startSeconds !== null && raw.startSeconds !== undefined) ? raw.startSeconds : null;
    var endSeconds = (raw && raw.endSeconds !== null && raw.endSeconds !== undefined) ? raw.endSeconds : null;
    var loop = !!(raw && raw.loop);

    var explicitUnplayable = !!(raw && raw.playable === false);
    var explicitReason = (raw && raw.unavailableReason !== null && raw.unavailableReason !== undefined)
      ? String(raw.unavailableReason) : null;

    var segment = validateSegmentSeconds(startSeconds, endSeconds);

    var playable = true;
    var unavailableReason = null;
    if (explicitUnplayable) {
      playable = false;
      unavailableReason = explicitReason || UNAVAILABLE_REASONS.EXPLICITLY_UNPLAYABLE;
    } else if (!segment.valid) {
      playable = false;
      unavailableReason = UNAVAILABLE_REASONS.INVALID_SEGMENT;
    }

    // Occurrence identity is derived from canonical input order (sourceIndex),
    // NOT from mediaId — so duplicate mediaIds remain distinct occurrences.
    var occurrenceKey = 'occ-' + sourceIndex;

    return {
      occurrenceKey: occurrenceKey,
      sourceIndex: sourceIndex,
      title: title,
      provider: provider,
      mediaId: mediaId,
      startSeconds: startSeconds,
      endSeconds: endSeconds,
      loop: loop,
      playable: playable,
      unavailableReason: unavailableReason
    };
  }

  function cloneOccurrence(o) {
    if (!o) return null;
    return {
      occurrenceKey: o.occurrenceKey,
      sourceIndex: o.sourceIndex,
      title: o.title,
      provider: o.provider,
      mediaId: o.mediaId,
      startSeconds: o.startSeconds,
      endSeconds: o.endSeconds,
      loop: o.loop,
      playable: o.playable,
      unavailableReason: o.unavailableReason
    };
  }

  function frozenOccurrence(o) {
    var c = cloneOccurrence(o);
    if (c) Object.freeze(c);
    return c;
  }

  // ---------------------------------------------------------------------------
  // Core factory
  // ---------------------------------------------------------------------------

  function createTreePlayModeCore(options) {
    options = options || {};
    var onCommand = (typeof options.onCommand === 'function') ? options.onCommand : null;

    // Internal mutable state (never leaked by reference).
    var occurrences = [];        // array of frozen normalized occurrences
    var currentIndex = -1;       // index into `occurrences`
    var playbackState = STATES.IDLE;
    var autoplayBlocked = false;
    var completionCount = 0;     // how many current items have been marked completed
    var lastSkipped = [];        // transient: occurrences skipped during last navigation/auto-advance

    // --- internal lookups -----------------------------------------------------
    function occAt(index) {
      if (index < 0 || index >= occurrences.length) return null;
      return occurrences[index];
    }

    function findIndexByKey(key) {
      for (var i = 0; i < occurrences.length; i++) {
        if (occurrences[i].occurrenceKey === key) return i;
      }
      return -1;
    }

    function firstPlayableIndex() {
      for (var i = 0; i < occurrences.length; i++) {
        if (occurrences[i].playable) return i;
      }
      return -1;
    }

    function countPlayable() {
      var n = 0;
      for (var i = 0; i < occurrences.length; i++) {
        if (occurrences[i].playable) n++;
      }
      return n;
    }

    // Scan forward from `fromIndex` (exclusive), collecting unplayable skips,
    // returning the next playable index or -1. Bounded by queue length.
    function scanNextPlayable(fromIndex) {
      var skipped = [];
      for (var i = fromIndex + 1; i < occurrences.length; i++) {
        if (occurrences[i].playable) {
          return { index: i, skipped: skipped };
        }
        skipped.push(frozenOccurrence(occurrences[i]));
      }
      return { index: -1, skipped: skipped };
    }

    // --- result builder -------------------------------------------------------
    function makeResult(o) {
      o = o || {};
      var command = null;
      if (o.commandType && o.commandType !== COMMANDS.NO_OP) {
        var occForCmd = occAt(currentIndex);
        command = { type: o.commandType, occurrence: frozenOccurrence(occForCmd), autoplay: !!o.autoplay };
        if (o.commandType === COMMANDS.SEEK && isFiniteNumber(o.seekSeconds)) {
          command.seekSeconds = o.seekSeconds;
        }
      }
      return {
        ok: (o.ok !== false),
        state: (o.state != null) ? o.state : playbackState,
        currentIndex: currentIndex,
        occurrence: frozenOccurrence(occAt(currentIndex)),
        command: command,
        skipped: (o.skipped || []).map(frozenOccurrence),
        autoplayBlocked: autoplayBlocked,
        queueComplete: (o.state === STATES.QUEUE_COMPLETE),
        noPlayableItem: (o.state === STATES.NO_PLAYABLE_ITEM),
        reason: o.reason || null
      };
    }

    function emit(result) {
      if (onCommand && result && result.command) {
        onCommand(result.command, result);
      }
      return result;
    }

    // --- queue lifecycle ------------------------------------------------------
    function resetTransient() {
      occurrences = [];
      currentIndex = -1;
      playbackState = STATES.IDLE;
      autoplayBlocked = false;
      completionCount = 0;
      lastSkipped = [];
    }

    /**
     * Load a queue (array of raw items) and select an initial occurrence.
     * @param {Array} rawQueue raw caller items (NOT mutated)
     * @param {Object} [opts] { selectedIndex, selectedOccurrenceKey, autoStart }
     */
    function load(rawQueue, opts) {
      opts = opts || {};
      resetTransient();

      if (!Array.isArray(rawQueue) || rawQueue.length === 0) {
        playbackState = STATES.EMPTY;
        return emit(makeResult({ state: STATES.EMPTY, commandType: COMMANDS.NO_OP, reason: 'EMPTY_QUEUE' }));
      }

      // Normalize + freeze a deep clone. Caller input is never mutated.
      for (var i = 0; i < rawQueue.length; i++) {
        var occ = normalizeItem(rawQueue[i], i);
        Object.freeze(occ);
        occurrences.push(occ);
      }

      var targetIndex = -1;
      if (opts.selectedOccurrenceKey != null) {
        targetIndex = findIndexByKey(opts.selectedOccurrenceKey);
      } else if (typeof opts.selectedIndex === 'number'
        && opts.selectedIndex >= 0
        && opts.selectedIndex < occurrences.length) {
        targetIndex = opts.selectedIndex;
      }

      if (targetIndex >= 0) {
        currentIndex = targetIndex;
        var occT = occurrences[targetIndex];
        if (occT.playable) {
          playbackState = STATES.LOADED;
          return emit(makeResult({
            state: STATES.LOADED,
            commandType: COMMANDS.LOAD_OCCURRENCE,
            autoplay: !!opts.autoStart,
            skipped: []
          }));
        }
        // Explicit non-playable result. We do NOT silently jump to a playable
        // item and pretend the selected one played.
        playbackState = STATES.SELECTED_UNPLAYABLE;
        return emit(makeResult({
          state: STATES.SELECTED_UNPLAYABLE,
          commandType: COMMANDS.NO_OP,
          reason: 'SELECTED_UNPLAYABLE',
          skipped: []
        }));
      }

      // No explicit selection -> start at the first playable occurrence.
      var fpi = firstPlayableIndex();
      if (fpi < 0) {
        playbackState = STATES.NO_PLAYABLE_ITEM;
        return emit(makeResult({
          state: STATES.NO_PLAYABLE_ITEM,
          commandType: COMMANDS.NO_OP,
          reason: 'NO_PLAYABLE_ITEM',
          skipped: []
        }));
      }
      currentIndex = fpi;
      playbackState = STATES.LOADED;
      return emit(makeResult({
        state: STATES.LOADED,
        commandType: COMMANDS.LOAD_OCCURRENCE,
        autoplay: !!opts.autoStart,
        skipped: []
      }));
    }

    function reset(rawQueue, opts) {
      // Full re-load. resetTransient() guarantees no leakage of prior playback
      // state (index, autoplay-block, completion, skip history, manual
      // continuation) into the new queue.
      return load(rawQueue, opts);
    }

    // --- navigation -----------------------------------------------------------
    function next() {
      if (occurrences.length === 0) {
        playbackState = STATES.EMPTY;
        return emit(makeResult({ state: STATES.EMPTY, commandType: COMMANDS.NO_OP, reason: 'EMPTY_QUEUE' }));
      }
      if (currentIndex < 0) {
        var fpi = firstPlayableIndex();
        if (fpi < 0) {
          playbackState = STATES.NO_PLAYABLE_ITEM;
          return emit(makeResult({ state: STATES.NO_PLAYABLE_ITEM, commandType: COMMANDS.NO_OP, reason: 'NO_PLAYABLE_ITEM' }));
        }
        currentIndex = fpi;
        playbackState = STATES.LOADED;
        return emit(makeResult({ state: STATES.LOADED, commandType: COMMANDS.LOAD_OCCURRENCE, skipped: [] }));
      }
      // NO WRAP: at last item -> queue complete.
      if (currentIndex >= occurrences.length - 1) {
        playbackState = STATES.QUEUE_COMPLETE;
        return emit(makeResult({ state: STATES.QUEUE_COMPLETE, commandType: COMMANDS.QUEUE_COMPLETE, skipped: [] }));
      }
      // Forward, skipping unplayable items (explicitly observable).
      var scan = scanNextPlayable(currentIndex);
      if (scan.index < 0) {
        playbackState = STATES.QUEUE_COMPLETE;
        lastSkipped = scan.skipped;
        return emit(makeResult({ state: STATES.QUEUE_COMPLETE, commandType: COMMANDS.QUEUE_COMPLETE, skipped: scan.skipped }));
      }
      currentIndex = scan.index;
      lastSkipped = scan.skipped;
      playbackState = STATES.LOADED;
      return emit(makeResult({ state: STATES.LOADED, commandType: COMMANDS.LOAD_OCCURRENCE, skipped: scan.skipped }));
    }

    function previous() {
      if (occurrences.length === 0) {
        playbackState = STATES.EMPTY;
        return emit(makeResult({ state: STATES.EMPTY, commandType: COMMANDS.NO_OP, reason: 'EMPTY_QUEUE' }));
      }
      if (currentIndex < 0) {
        var fpi = firstPlayableIndex();
        if (fpi < 0) {
          playbackState = STATES.NO_PLAYABLE_ITEM;
          return emit(makeResult({ state: STATES.NO_PLAYABLE_ITEM, commandType: COMMANDS.NO_OP, reason: 'NO_PLAYABLE_ITEM' }));
        }
        currentIndex = fpi;
        playbackState = STATES.LOADED;
        return emit(makeResult({ state: STATES.LOADED, commandType: COMMANDS.LOAD_OCCURRENCE, skipped: [] }));
      }
      // NO WRAP: at first item -> beginning state.
      if (currentIndex === 0) {
        var firstOcc = occurrences[0];
        playbackState = (firstOcc && !firstOcc.playable) ? STATES.SELECTED_UNPLAYABLE : STATES.BEGINNING;
        return emit(makeResult({ state: playbackState, commandType: COMMANDS.NO_OP, reason: 'AT_BEGINNING', skipped: [] }));
      }
      currentIndex = currentIndex - 1;
      lastSkipped = [];
      var occ = occAt(currentIndex);
      if (occ && occ.playable) {
        playbackState = STATES.LOADED;
        return emit(makeResult({ state: STATES.LOADED, commandType: COMMANDS.LOAD_OCCURRENCE, skipped: [] }));
      }
      playbackState = STATES.SELECTED_UNPLAYABLE;
      return emit(makeResult({ state: STATES.SELECTED_UNPLAYABLE, commandType: COMMANDS.NO_OP, reason: 'SELECTED_UNPLAYABLE', skipped: [] }));
    }

    // --- playback control -----------------------------------------------------
    function play() {
      if (currentIndex < 0) {
        return emit(makeResult({ ok: false, state: playbackState, commandType: COMMANDS.NO_OP, reason: 'NO_CURRENT' }));
      }
      var occ = occAt(currentIndex);
      if (!occ.playable) {
        playbackState = STATES.SELECTED_UNPLAYABLE;
        return emit(makeResult({ ok: false, state: STATES.SELECTED_UNPLAYABLE, commandType: COMMANDS.NO_OP, reason: 'UNPLAYABLE' }));
      }
      // Request play; await adapter confirmation. We do NOT claim PLAYING yet.
      playbackState = STATES.AUTO_PLAY_PENDING;
      lastSkipped = [];
      return emit(makeResult({ state: STATES.AUTO_PLAY_PENDING, commandType: COMMANDS.PLAY, autoplay: true, skipped: [] }));
    }

    function pause() {
      if (currentIndex < 0) {
        return emit(makeResult({ state: playbackState, commandType: COMMANDS.NO_OP }));
      }
      if (playbackState === STATES.PLAYING
        || playbackState === STATES.AUTO_PLAY_PENDING
        || playbackState === STATES.MANUAL_CONTINUE_REQUIRED
        || playbackState === STATES.PAUSED) {
        playbackState = STATES.PAUSED;
        return emit(makeResult({ state: STATES.PAUSED, commandType: COMMANDS.PAUSE, skipped: [] }));
      }
      return emit(makeResult({ state: playbackState, commandType: COMMANDS.NO_OP }));
    }

    function seek(seconds) {
      if (currentIndex < 0) {
        return emit(makeResult({ state: playbackState, commandType: COMMANDS.NO_OP, reason: 'NO_CURRENT' }));
      }
      if (!isFiniteNumber(seconds)) {
        return emit(makeResult({ ok: false, state: playbackState, commandType: COMMANDS.NO_OP, reason: 'INVALID_SEEK' }));
      }
      return emit(makeResult({ state: playbackState, commandType: COMMANDS.SEEK, seekSeconds: seconds, skipped: [] }));
    }

    // --- completion / autoplay boundary --------------------------------------
    /**
     * Adapter reports the current item finished. The core authoritatively
     * selects the next playable occurrence, but does NOT claim actual playback.
     */
    function markItemCompleted() {
      if (currentIndex < 0) {
        return emit(makeResult({ state: playbackState, commandType: COMMANDS.NO_OP, reason: 'NO_CURRENT' }));
      }
      var occ = occAt(currentIndex);
      if (!occ || !occ.playable) {
        return emit(makeResult({ state: playbackState, commandType: COMMANDS.NO_OP }));
      }
      completionCount++;
      var scan = scanNextPlayable(currentIndex);
      if (scan.index < 0) {
        playbackState = STATES.QUEUE_COMPLETE;
        lastSkipped = scan.skipped;
        return emit(makeResult({ state: STATES.QUEUE_COMPLETE, commandType: COMMANDS.QUEUE_COMPLETE, skipped: scan.skipped }));
      }
      currentIndex = scan.index;
      lastSkipped = scan.skipped;
      // Selected next, but PLAYING is NOT claimed until the adapter confirms.
      playbackState = STATES.AUTO_PLAY_PENDING;
      return emit(makeResult({ state: STATES.AUTO_PLAY_PENDING, commandType: COMMANDS.LOAD_OCCURRENCE, autoplay: true, skipped: scan.skipped }));
    }

    /** Adapter reports autoplay was blocked by the browser. */
    function markAutoplayBlocked() {
      if (currentIndex < 0) {
        return emit(makeResult({ state: playbackState, commandType: COMMANDS.NO_OP, reason: 'NO_CURRENT' }));
      }
      autoplayBlocked = true;
      playbackState = STATES.MANUAL_CONTINUE_REQUIRED;
      return emit(makeResult({ state: STATES.MANUAL_CONTINUE_REQUIRED, commandType: COMMANDS.MANUAL_CONTINUE_REQUIRED, skipped: [] }));
    }

    /** Adapter confirms playback actually started (clears blocked/pending). */
    function markPlaying() {
      if (currentIndex < 0) {
        return emit(makeResult({ ok: false, state: playbackState, commandType: COMMANDS.NO_OP, reason: 'NO_CURRENT' }));
      }
      var occ = occAt(currentIndex);
      if (!occ || !occ.playable) {
        return emit(makeResult({ ok: false, state: playbackState, commandType: COMMANDS.NO_OP, reason: 'UNPLAYABLE' }));
      }
      // Confirmed transition: blocked/pending state is cleared ONLY here.
      autoplayBlocked = false;
      playbackState = STATES.PLAYING;
      return emit(makeResult({ state: STATES.PLAYING, commandType: COMMANDS.NO_OP, skipped: [] }));
    }

    // --- snapshots ------------------------------------------------------------
    function getState() {
      var occ = occAt(currentIndex);
      var occurrence = frozenOccurrence(occ);
      var skipped = lastSkipped.map(frozenOccurrence);
      var snapshot = {
        playbackState: playbackState,
        currentIndex: currentIndex,
        occurrenceCount: occurrences.length,
        playableCount: countPlayable(),
        autoplayBlocked: autoplayBlocked,
        completionCount: completionCount,
        queueComplete: playbackState === STATES.QUEUE_COMPLETE,
        noPlayableItem: playbackState === STATES.NO_PLAYABLE_ITEM,
        hasCurrent: currentIndex >= 0 && currentIndex < occurrences.length,
        occurrence: occurrence,
        lastSkipped: skipped
      };
      Object.freeze(snapshot.lastSkipped);
      Object.freeze(snapshot);
      return snapshot;
    }

    function getQueue() {
      return occurrences.map(frozenOccurrence);
    }

    function getOccurrence(index) {
      return frozenOccurrence(occAt(index));
    }

    return {
      load: load,
      reset: reset,
      next: next,
      previous: previous,
      play: play,
      pause: pause,
      seek: seek,
      markItemCompleted: markItemCompleted,
      markAutoplayBlocked: markAutoplayBlocked,
      markPlaying: markPlaying,
      getState: getState,
      getQueue: getQueue,
      getOccurrence: getOccurrence,
      validateSegment: validateSegmentSeconds,
      STATES: STATES,
      COMMANDS: COMMANDS,
      UNAVAILABLE_REASONS: UNAVAILABLE_REASONS
    };
  }

  return {
    createTreePlayModeCore: createTreePlayModeCore,
    STATES: {
      IDLE: 'IDLE', EMPTY: 'EMPTY', NO_PLAYABLE_ITEM: 'NO_PLAYABLE_ITEM',
      SELECTED_UNPLAYABLE: 'SELECTED_UNPLAYABLE', LOADED: 'LOADED', PLAYING: 'PLAYING',
      PAUSED: 'PAUSED', AUTO_PLAY_PENDING: 'AUTO_PLAY_PENDING',
      MANUAL_CONTINUE_REQUIRED: 'MANUAL_CONTINUE_REQUIRED',
      QUEUE_COMPLETE: 'QUEUE_COMPLETE', BEGINNING: 'BEGINNING'
    },
    COMMANDS: {
      LOAD_OCCURRENCE: 'LOAD_OCCURRENCE', PLAY: 'PLAY', PAUSE: 'PAUSE', SEEK: 'SEEK',
      QUEUE_COMPLETE: 'QUEUE_COMPLETE', MANUAL_CONTINUE_REQUIRED: 'MANUAL_CONTINUE_REQUIRED',
      NO_OP: 'NO_OP'
    },
    UNAVAILABLE_REASONS: {
      PRIVATE: 'PRIVATE', DELETED: 'DELETED', UNAVAILABLE: 'UNAVAILABLE',
      NON_EMBEDDABLE: 'NON_EMBEDDABLE', INVALID_SEGMENT: 'INVALID_SEGMENT',
      EXPLICITLY_UNPLAYABLE: 'EXPLICITLY_UNPLAYABLE'
    }
  };
});
