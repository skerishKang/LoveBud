/**
 * YouTube Segment Player PoC Runtime — Tree Play Mode adapter demo
 * Issue #366 (PoC origin) / Issue #4064 (core extraction)
 *
 * This file is now a CONSUMER / ADAPTER of the provider-independent
 * Tree Play Mode queue core (js/playback/tree-play-mode-core.js).
 *
 *   tree-play-mode-core.js  -> queue / state authority (pure, no DOM/YT)
 *   this file               -> YouTube IFrame + DOM adapter demo
 *
 * It keeps the original PoC capabilities: Play, Pause, Previous, Next,
 * segment loading, and per-occurrence loop / end-boundary handling.
 * It does NOT create players on its own beyond the single YouTube iframe,
 * honouring the ONE_ACTIVE_PLAYER invariant of the core.
 */

(function () {
    'use strict';

    // === Hard-coded PoC segment data (canonical core input) ===
    const POC_SEGMENTS = [
        {
            videoId: '2lAe1tjCO0Y',  // Example: short video
            startSeconds: 10,
            endSeconds: 20,
            title: 'Test Segment 1 — Intro',
            order: 0,
            loop: false
        },
        {
            videoId: 'dQw4w9WgXcQ',  // Example: Rickroll
            startSeconds: 5,
            endSeconds: 15,
            title: 'Test Segment 2 — Hook',
            order: 1,
            loop: true
        },
        {
            videoId: '9bZkp7q19f0',  // Example: PSY Gangnam Style
            startSeconds: 30,
            endSeconds: 40,
            title: 'Test Segment 3 — Climax',
            order: 2,
            loop: false
        }
    ];

    // === Tree Play Mode core (queue / state authority) ===
    const TPMC = (typeof window !== 'undefined' && window.TreePlayModeCore) ? window.TreePlayModeCore : null;
    const STATES = TPMC ? TPMC.STATES : null;

    // Map PoC fixture into the core's raw item contract.
    const rawQueue = POC_SEGMENTS.map(function (seg, i) {
        return {
            mediaId: seg.videoId,
            title: seg.title,
            provider: 'youtube',
            startSeconds: seg.startSeconds,
            endSeconds: seg.endSeconds,
            loop: !!seg.loop,
            sourceIndex: i
        };
    });

    let core = null;
    if (TPMC && typeof TPMC.createTreePlayModeCore === 'function') {
        core = TPMC.createTreePlayModeCore({ onCommand: adapterCommand });
    }

    // Mirror of the current occurrence for adapter-side boundary/loop logic.
    let currentOccurrence = null;
    let currentSegmentIndex = 0;
    let segmentLoop = false;
    let isPlaying = false;
    let checkInterval = null;
    let isHandlingBoundary = false;  // prevent duplicate boundary triggers
    let player = null;               // assigned in onYouTubeIframeAPIReady

    // === DOM elements ===
    const elLog = document.getElementById('log-output');
    const elSegmentQueue = document.getElementById('segment-queue');
    const elSegmentInfo = document.getElementById('segment-info');
    const btnPlay = document.getElementById('btn-play');
    const btnPause = document.getElementById('btn-pause');
    const btnNext = document.getElementById('btn-next');
    const btnPrev = document.getElementById('btn-prev');
    const btnLoop = document.getElementById('btn-loop');

    // === Logging helper (console-safe) ===
    function pocLog(message) {
        const timestamp = new Date().toISOString();
        const line = `[${timestamp}] ${message}`;
        if (elLog) elLog.textContent += line + '\n';
        console.log(line); // Also to browser console for debugging
    }

    // === Adapter: turn core commands into YouTube IFrame API calls ===
    function adapterCommand(cmd) {
        if (!cmd) return;
        if (cmd.type === 'LOAD_OCCURRENCE') {
            loadOccurrence(cmd.occurrence);
            // autoplay hint: the adapter attempts to start playback when the
            // core requests it, but actual PLAYING is only confirmed via the
            // YT PLAYING state -> core.markPlaying().
            if (cmd.autoplay && player && player.playVideo) {
                player.playVideo();
            }
        } else if (cmd.type === 'PLAY') {
            if (player && player.playVideo) player.playVideo();
        } else if (cmd.type === 'PAUSE') {
            if (player && player.pauseVideo) player.pauseVideo();
        } else if (cmd.type === 'SEEK') {
            if (player && player.seekTo) player.seekTo(cmd.seekSeconds, true);
        }
    }

    // === Render segment queue (driven by core state) ===
    function renderQueue() {
        if (!elSegmentQueue) return;
        elSegmentQueue.innerHTML = '';
        const queue = core ? core.getQueue() : [];
        const currentIndex = core ? core.getState().currentIndex : -1;
        queue.forEach((occ, idx) => {
            const li = document.createElement('li');
            const label = occ.title || ('Occurrence ' + (idx + 1));
            li.className = 'segment-item' + (idx === currentIndex ? ' active' : (occ.playable ? '' : ' unavailable'));
            const status = occ.playable ? '' : ' [unavailable: ' + occ.unavailableReason + ']';
            li.textContent = `${idx + 1}. ${label} (${occ.mediaId}: ${occ.startSeconds}s–${occ.endSeconds}s)${status}`;
            elSegmentQueue.appendChild(li);
        });
    }

    // === Update controls (driven by core state) ===
    function updateControls() {
        if (!core) return;
        const s = core.getState();
        const atBeginning = s.currentIndex <= 0;
        const atEnd = s.currentIndex >= s.occurrenceCount - 1;
        const hasCurrentPlayable = s.hasCurrent && s.occurrence && s.occurrence.playable;

        if (btnPrev) btnPrev.disabled = atBeginning || !s.hasCurrent;
        if (btnNext) btnNext.disabled = atEnd || !s.hasCurrent;
        if (btnPlay) btnPlay.disabled = !hasCurrentPlayable || s.playbackState === STATES.PLAYING || s.playbackState === STATES.AUTO_PLAY_PENDING;
        if (btnPause) btnPause.disabled = s.playbackState !== STATES.PLAYING;
        if (btnLoop) {
            btnLoop.textContent = 'Loop: ' + (segmentLoop ? 'ON' : 'OFF');
            btnLoop.dataset.loop = segmentLoop ? 'true' : 'false';
        }
    }

    // === Show current status text ===
    function updateStatusText() {
        if (!elSegmentInfo) return;
        if (!core || !STATES) return;
        const s = core.getState();
        if (!s || !s.hasCurrent || !s.occurrence) {
            elSegmentInfo.textContent = 'No segment loaded';
            return;
        }
        const occ = s.occurrence;
        if (!occ.playable) {
            elSegmentInfo.textContent = `Unavailable: ${occ.unavailableReason} — cannot play this occurrence.`;
            return;
        }
        if (s.playbackState === STATES.MANUAL_CONTINUE_REQUIRED) {
            elSegmentInfo.textContent = `Autoplay blocked — press Play to continue (${occ.title}).`;
            return;
        }
        elSegmentInfo.textContent = `Now: ${occ.title} (${occ.mediaId}) — ${s.playbackState}`;
    }

    // === YouTube IFrame API ready callback ===
    window.onYouTubeIframeAPIReady = function () {
        pocLog('YouTube IFrame API ready — creating player...');
        try {
            player = new YT.Player('player', {
                height: '390',
                width: '640',
                videoId: '',  // Start empty; load on first occurrence
                playerVars: {
                    'playsinline': 1,
                    'controls': 1,
                    'disablekb': 0
                },
                events: {
                    'onReady': onPlayerReady,
                    'onStateChange': onPlayerStateChange,
                    'onError': onPlayerError
                }
            });
        } catch (e) {
            pocLog('ERROR creating YouTube player: ' + e.message);
        }
    };

    // === Player ready ===
    function onPlayerReady(event) {
        pocLog('YouTube player ready — loading queue via Tree Play Mode core...');
        if (core) {
            core.load(rawQueue, { autoStart: true });
            renderQueue();
            updateControls();
            updateStatusText();
        }
    }

    // === Player state change ===
    function onPlayerStateChange(event) {
        const stateNames = ['-1', 'ENDED', 'PLAYING', 'PAUSED', 'BUFFERING', 'CUED'];
        const state = stateNames[event.data + 1] || 'UNKNOWN';
        pocLog('Player state changed: ' + state);

        if (event.data === YT.PlayerState.PLAYING) {
            if (core) core.markPlaying();
            isPlaying = true;
            updateControls();
            updateStatusText();
            startMonitoring();
        } else if (event.data === YT.PlayerState.PAUSED) {
            isPlaying = false;
            updateControls();
        } else if (event.data === YT.PlayerState.ENDED) {
            handleSegmentEnd();
        }
    }

    // === Player error (treated as autoplay/load block signal for demo) ===
    function onPlayerError(event) {
        const errorCodes = {
            2: 'invalid parameter',
            5: 'HTML5 player error',
            100: 'video not found',
            101: 'embed not allowed',
            150: 'embed not allowed (similar)'
        };
        const msg = errorCodes[event.data] || 'unknown error';
        pocLog('Player ERROR: ' + msg + ' (code ' + event.data + ')');
        if (core) {
            core.markAutoplayBlocked();
            updateControls();
            updateStatusText();
        }
    }

    // === Load a single occurrence into the player (adapter responsibility) ===
    function loadOccurrence(occ) {
        if (!occ) return;
        currentOccurrence = occ;
        currentSegmentIndex = occ.sourceIndex;
        segmentLoop = !!occ.loop;

        if (!occ.playable) {
            pocLog('Occurrence ' + occ.occurrenceKey + ' is unavailable (' + occ.unavailableReason + ') — not loading player.');
            updateControls();
            updateStatusText();
            return;
        }

        pocLog('Core selected occurrence ' + occ.occurrenceKey + ': ' + (occ.title || '') + ' [' + occ.mediaId + ']');

        if (player && typeof player.loadVideoById === 'function') {
            player.loadVideoById({
                videoId: occ.mediaId,
                startSeconds: occ.startSeconds
            });
        } else {
            pocLog('Player not ready yet — will retry');
        }

        updateSegmentInfo(occ);
        renderQueue();
        updateControls();
        updateStatusText();
    }

    // === Update segment info display ===
    function updateSegmentInfo(occ) {
        if (!elSegmentInfo || !occ) return;
        elSegmentInfo.textContent = '';

        const titleEl = document.createElement('strong');
        titleEl.textContent = occ.title || 'Untitled';

        const br1 = document.createElement('br');
        const videoEl = document.createElement('span');
        videoEl.textContent = 'Video: ' + occ.mediaId;

        const br2 = document.createElement('br');
        const rangeEl = document.createElement('span');
        rangeEl.textContent = 'Range: ' + occ.startSeconds + 's – ' + occ.endSeconds + 's';

        const br3 = document.createElement('br');
        const loopEl = document.createElement('span');
        loopEl.textContent = 'Loop: ' + (occ.loop ? 'ON' : 'OFF');

        elSegmentInfo.appendChild(titleEl);
        elSegmentInfo.appendChild(br1);
        elSegmentInfo.appendChild(videoEl);
        elSegmentInfo.appendChild(br2);
        elSegmentInfo.appendChild(rangeEl);
        elSegmentInfo.appendChild(br3);
        elSegmentInfo.appendChild(loopEl);
    }

    // === Handle segment end (delegated to core for next selection) ===
    function handleSegmentEnd() {
        if (isHandlingBoundary) return;
        isHandlingBoundary = true;

        const occ = currentOccurrence;
        if (occ && segmentLoop) {
            pocLog('Segment ended with loop enabled — restarting from ' + occ.startSeconds + 's');
            if (player && player.seekTo) player.seekTo(occ.startSeconds, true);
            if (player && player.playVideo) player.playVideo();
            isHandlingBoundary = false;
        } else if (core) {
            pocLog('Segment ended — advancing via Tree Play Mode core');
            const r = core.markItemCompleted();
            if (r.state === STATES.QUEUE_COMPLETE) {
                pocLog('All segments completed — stopping');
                isPlaying = false;
            }
            updateControls();
            updateStatusText();
            isHandlingBoundary = false;
        } else {
            isHandlingBoundary = false;
        }
    }

    // === Start playback monitoring ===
    function startMonitoring() {
        if (checkInterval) clearInterval(checkInterval);
        checkInterval = setInterval(() => {
            if (!player || !player.getCurrentTime) return;
            const currentTime = player.getCurrentTime();
            const occ = currentOccurrence;
            if (!occ) return;
            // Log keyframe drift observations
            if (occ.endSeconds != null && Math.abs(currentTime - occ.endSeconds) < 0.5) {
                pocLog('Approaching endSeconds: current=' + currentTime.toFixed(2) + ' target=' + occ.endSeconds);
            }
        }, 500);
    }

    // === Event bindings ===
    btnPlay.addEventListener('click', () => {
        if (!core) return;
        const s = core.getState();
        // If autoplay was blocked, this click resumes manual continuation.
        if (s.playbackState === STATES.MANUAL_CONTINUE_REQUIRED) {
            if (player && player.playVideo) player.playVideo();
            core.markPlaying();
            updateControls();
            updateStatusText();
            return;
        }
        const r = core.play();
        isPlaying = (r.state === STATES.AUTO_PLAY_PENDING);
        updateControls();
        updateStatusText();
    });

    btnPause.addEventListener('click', () => {
        if (!core) return;
        core.pause();
        isPlaying = false;
        updateControls();
        updateStatusText();
    });

    btnNext.addEventListener('click', () => {
        if (!core) return;
        core.next();
        updateControls();
        updateStatusText();
    });

    btnPrev.addEventListener('click', () => {
        if (!core) return;
        core.previous();
        updateControls();
        updateStatusText();
    });

    btnLoop.addEventListener('click', () => {
        segmentLoop = !segmentLoop;
        if (currentOccurrence) currentOccurrence = Object.assign({}, currentOccurrence, { loop: segmentLoop });
        if (btnLoop) {
            btnLoop.textContent = 'Loop: ' + (segmentLoop ? 'ON' : 'OFF');
            btnLoop.dataset.loop = segmentLoop ? 'true' : 'false';
        }
        pocLog('Loop toggled: ' + (segmentLoop ? 'ON' : 'OFF'));
    });

    // === Initialize UI on DOM ready ===
    document.addEventListener('DOMContentLoaded', () => {
        pocLog('PoC page loaded — waiting for YouTube API...');
        renderQueue();
        updateControls();
        updateStatusText();
    });
})();
