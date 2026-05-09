/**
 * YouTube Segment Player PoC Runtime
 * Issue #366 — Prototype YouTube segment player for Moment Timeline
 *
 * This is a contained PoC. No production wiring, no persistence, no auth.
 * Hard-coded segment data only.
 */

(function () {
    'use strict';

    // === Hard-coded PoC segment data ===
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

    // === PoC state ===
    let player = null;
    let currentSegmentIndex = 0;
    let isPlaying = false;
    let checkInterval = null;
    let isHandlingBoundary = false;  // prevent duplicate boundary triggers

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
        elLog.textContent += line + '\n';
        console.log(line); // Also to browser console for debugging
    }

    // === Render segment queue ===
    function renderQueue() {
        elSegmentQueue.innerHTML = '';
        POC_SEGMENTS.forEach((seg, idx) => {
            const li = document.createElement('li');
            li.className = 'segment-item' + (idx === currentSegmentIndex ? ' active' : '');
            li.textContent = `${idx + 1}. ${seg.title} (${seg.videoId}: ${seg.startSeconds}s–${seg.endSeconds}s)`;
            elSegmentQueue.appendChild(li);
        });
    }

    // === Update controls ===
    function updateControls() {
        btnPrev.disabled = currentSegmentIndex === 0;
        btnNext.disabled = currentSegmentIndex >= POC_SEGMENTS.length - 1;
        btnPlay.disabled = isPlaying;
        btnPause.disabled = !isPlaying;
    }

    // === YouTube IFrame API ready callback ===
    window.onYouTubeIframeAPIReady = function () {
        pocLog('YouTube IFrame API ready — creating player...');
        try {
            player = new YT.Player('player', {
                height: '390',
                width: '640',
                videoId: '',  // Start empty; load on first segment
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
        pocLog('YouTube player ready — loading first segment...');
        loadSegment(0);
    }

    // === Player state change ===
    function onPlayerStateChange(event) {
        const stateNames = ['-1', 'ENDED', 'PLAYING', 'PAUSED', 'BUFFERING', 'CUED'];
        const state = stateNames[event.data + 1] || 'UNKNOWN';
        pocLog('Player state changed: ' + state);

        if (event.data === YT.PlayerState.ENDED) {
            handleSegmentEnd();
        }
    }

    // === Player error ===
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
    }

    // === Load a segment ===
    function loadSegment(index) {
        if (index < 0 || index >= POC_SEGMENTS.length) {
            pocLog('Invalid segment index: ' + index);
            return;
        }

        currentSegmentIndex = index;
        const seg = POC_SEGMENTS[index];

        // Validate segment data
        if (!seg.videoId || seg.startSeconds < 0 || seg.endSeconds <= seg.startSeconds) {
            pocLog('Segment validation FAILED — invalid data');
            elSegmentInfo.textContent = 'Invalid segment data';
            return;
        }

        pocLog('Loading segment ' + (index + 1) + ': ' + seg.title + ' [' + seg.videoId + ']');

        if (player && typeof player.loadVideoById === 'function') {
            player.loadVideoById({
                videoId: seg.videoId,
                startSeconds: seg.startSeconds
            });
        } else {
            pocLog('Player not ready yet — will retry');
        }

        updateSegmentInfo(seg);
        renderQueue();
        updateControls();
    }

    // === Update segment info display ===
    function updateSegmentInfo(seg) {
        // Clear using textContent to avoid innerHTML
        elSegmentInfo.textContent = '';

        const titleEl = document.createElement('strong');
        titleEl.textContent = seg.title;

        const br1 = document.createElement('br');
        const videoEl = document.createElement('span');
        videoEl.textContent = 'Video: ' + seg.videoId;

        const br2 = document.createElement('br');
        const rangeEl = document.createElement('span');
        rangeEl.textContent = 'Range: ' + seg.startSeconds + 's – ' + seg.endSeconds + 's';

        const br3 = document.createElement('br');
        const loopEl = document.createElement('span');
        loopEl.textContent = 'Loop: ' + (seg.loop ? 'ON' : 'OFF');

        elSegmentInfo.appendChild(titleEl);
        elSegmentInfo.appendChild(br1);
        elSegmentInfo.appendChild(videoEl);
        elSegmentInfo.appendChild(br2);
        elSegmentInfo.appendChild(rangeEl);
        elSegmentInfo.appendChild(br3);
        elSegmentInfo.appendChild(loopEl);
    }

    // === Handle segment end ===
    function handleSegmentEnd() {
        // Prevent duplicate boundary triggers
        if (isHandlingBoundary) {
            return;
        }
        isHandlingBoundary = true;

        const seg = POC_SEGMENTS[currentSegmentIndex];

        if (seg.loop) {
            pocLog('Segment ended with loop enabled — restarting from ' + seg.startSeconds + 's');
            player.seekTo(seg.startSeconds, true);
            player.playVideo();
            isHandlingBoundary = false;
        } else if (currentSegmentIndex < POC_SEGMENTS.length - 1) {
            pocLog('Segment ended — advancing to next');
            loadSegment(currentSegmentIndex + 1);
            isHandlingBoundary = false;
        } else {
            pocLog('All segments completed — stopping');
            isPlaying = false;
            updateControls();
            isHandlingBoundary = false;
        }
    }

    // === Start playback monitoring ===
    function startMonitoring() {
        if (checkInterval) clearInterval(checkInterval);
        checkInterval = setInterval(() => {
            if (!player || !player.getCurrentTime) return;

            const currentTime = player.getCurrentTime();
            const seg = POC_SEGMENTS[currentSegmentIndex];
            if (!seg) return;

            // Log keyframe drift observations
            if (Math.abs(currentTime - seg.endSeconds) < 0.5) {
                pocLog('Approaching endSeconds: current=' + currentTime.toFixed(2) + ' target=' + seg.endSeconds);
            }

            // Auto-advance or loop handled by onStateChange
        }, 500);
    }

    // === Event bindings ===
    btnPlay.addEventListener('click', () => {
        if (player && player.playVideo) {
            player.playVideo();
            isPlaying = true;
            updateControls();
            startMonitoring();
            pocLog('Playback started');
        }
    });

    btnPause.addEventListener('click', () => {
        if (player && player.pauseVideo) {
            player.pauseVideo();
            isPlaying = false;
            updateControls();
            pocLog('Playback paused');
        }
    });

    btnNext.addEventListener('click', () => {
        if (currentSegmentIndex < POC_SEGMENTS.length - 1) {
            isPlaying = false;
            loadSegment(currentSegmentIndex + 1);
        }
    });

    btnPrev.addEventListener('click', () => {
        if (currentSegmentIndex > 0) {
            isPlaying = false;
            loadSegment(currentSegmentIndex - 1);
        }
    });

    btnLoop.addEventListener('click', () => {
        const seg = POC_SEGMENTS[currentSegmentIndex];
        if (seg) {
            seg.loop = !seg.loop;
            btnLoop.textContent = 'Loop: ' + (seg.loop ? 'ON' : 'OFF');
            btnLoop.dataset.loop = seg.loop;
            pocLog('Loop toggled: ' + (seg.loop ? 'ON' : 'OFF'));
        }
    });

    // === Initialize UI on DOM ready ===
    document.addEventListener('DOMContentLoaded', () => {
        pocLog('PoC page loaded — waiting for YouTube API...');
        renderQueue();
        updateControls();
    });

})();
