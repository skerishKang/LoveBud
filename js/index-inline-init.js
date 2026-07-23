/* LoveBud home v3 - inline init
   Two responsibilities:
   1) Hero copy rhythm: two copy sets (3-line title + 2-line description),
      toggled by a single managed timer with an out-in transition (current
      set fades out fully before the next fades in, so two titles never
      overlap in the same cell). CTA, note, intro link never move.
    2) Hero growth cycle: JS state machine that rotates BTS -> BLACKPINK ->
       CORTIS -> RESCENE -> repeat. The node SHELLS and tree are fixed;
       on each artist change the four cards flip in sequence (rotateY to
       90deg -> data swaps at the edge-on point -> rotate back), so there
       is no opacity flicker and no old/new text overlap. Every card is
       click-to-play: clicking its thumbnail (or play button) opens that
       video in a large centered modal player (youtube-nocookie iframe)
       and pauses the cycle; each card also keeps a visible external
       "YouTube에서 보기" link that opens in a new tab (never the modal).
       Reduced motion shows the first artist's completed tree and stops.
       Hover, focus, document.hidden, and playback pause the cycle. A
       second init is a no-op.
*/
(function() {
  'use strict';

  // ============================================================
  // Public YouTube video dataset.
  // 4 artists x 4 official public MVs = 16 video IDs.
  // Channels verified by web search against artist/label channels.
  // Remote thumbnails: img.youtube.com/vi/<id>/maxresdefault.jpg (primary, 16:9)
  // Fallback: mqdefault.jpg (16:9). hqdefault.jpg is 4:3 and must NOT be used.
  // ============================================================

  var ARTIST_DATASETS = [
    {
      key: 'bts',
      labelKey: 'home.v3.artist.bts',
      channelKey: 'home.v3.artist.channel.bts',
      channelName: 'HYBE LABELS',
      videos: [
        { id: 'gdZLi9oWNZg', title: 'Dynamite' },
        { id: 'WMweEpGlu_U', title: 'Butter' },
        { id: 'XsX3ATc3FbA', title: 'Boy With Luv' },
        { id: 'hmE9f-TEutc', title: 'Blood Sweat & Tears' }
      ]
    },
    {
      key: 'blackpink',
      labelKey: 'home.v3.artist.blackpink',
      channelKey: 'home.v3.artist.channel.blackpink',
      channelName: 'BLACKPINK',
      videos: [
        { id: 'IHNzOHi8sJs', title: 'DDU-DU DDU-DU' },
        { id: 'ioNng23DkIM', title: 'How You Like That' },
        { id: '2S24-y0Ij3Y', title: 'Kill This Love' },
        { id: 'gQlMMD8auMs', title: 'Pink Venom' }
      ]
    },
    {
      key: 'cortis',
      labelKey: 'home.v3.artist.cortis',
      channelKey: 'home.v3.artist.channel.cortis',
      channelName: 'BIGHIT MUSIC',
      videos: [
        { id: 'WXS-o57VJ5w', title: 'GO!' },
        { id: 'kRpaqR5sbf0', title: 'TNT' },
        { id: 'hOIY3OhvD94', title: 'Blue Lips' },
        { id: 'U6BDbXIah-Y', title: 'REDRED' }
      ]
    },
    {
      key: 'rescene',
      labelKey: 'home.v3.artist.rescene',
      channelKey: 'home.v3.artist.channel.rescene',
      channelName: 'RESCENE',
      videos: [
        { id: 'rsZwrTNklos', title: 'Runaway' },
        { id: 'QNXeGm-Wkms', title: 'New World' },
        { id: 'bhgNiT3qQgU', title: 'YoYo' },
        { id: 'qZlu2j2SiBA', title: 'Pretty Girl' }
      ]
    }
  ];

  function youtubeWatchUrl(videoId) {
    return 'https://www.youtube.com/watch?v=' + encodeURIComponent(videoId);
  }

  function youtubeThumbUrl(videoId, preferMaxres) {
    var useMaxres = preferMaxres !== false;
    if (useMaxres) {
      return 'https://i.ytimg.com/vi/' + encodeURIComponent(videoId) + '/maxresdefault.jpg';
    }
    return 'https://i.ytimg.com/vi/' + encodeURIComponent(videoId) + '/mqdefault.jpg';
  }

  // Privacy-enhanced embed. autoplay=1 is only ever applied after an explicit
  // user click (a card's thumbnail / play button opens the modal), never on load.
  function youtubeEmbedUrl(videoId) {
    return 'https://www.youtube-nocookie.com/embed/' + encodeURIComponent(videoId) + '?autoplay=1&rel=0';
  }

  // ============================================================
  // Hero copy rhythm
  // ============================================================

  function initHeroCopyLoop() {
    var title = document.querySelector('.home-v3-title');
    var desc = document.querySelector('.home-v3-desc');
    var actions = document.querySelector('.home-v3-actions');
    if (!title || !desc || !actions) return;
    if (document.getElementById('home-hero-set-2')) return;

    var createI18nSpan = function(className, key, fallback) {
      var span = document.createElement('span');
      span.className = className;
      span.setAttribute('data-i18n', key);
      span.textContent = fallback;
      return span;
    };

    var createDescBlock = function(line1Key, line1Text, line2Key, line2Text) {
      var wrap = document.createElement('p');
      wrap.className = 'home-v3-desc';
      var line1 = document.createElement('span');
      line1.className = 'home-v3-desc-line';
      line1.setAttribute('data-i18n', line1Key);
      line1.textContent = line1Text;
      var line2 = document.createElement('span');
      line2.className = 'home-v3-desc-line';
      line2.setAttribute('data-i18n', line2Key);
      line2.textContent = line2Text;
      wrap.appendChild(line1);
      wrap.appendChild(line2);
      return wrap;
    };

    var set1 = document.createElement('div');
    set1.className = 'home-hero-copy-set active';
    set1.id = 'home-hero-set-1';
    set1.appendChild(title);
    set1.appendChild(createDescBlock(
      'home.v3.desc.line1.ko', '첫 장면과 다시 보고 싶은 순간을,',
      'home.v3.desc.line2.ko', '그때의 마음과 함께 하나의 흐름으로 남겨보세요.'
    ));

    var set2 = document.createElement('div');
    set2.className = 'home-hero-copy-set';
    set2.id = 'home-hero-set-2';

    var alternateTitle = document.createElement('h1');
    alternateTitle.className = 'home-v3-title';
    alternateTitle.appendChild(createI18nSpan('soft', 'home.v3.title2.line1.ko', '첫 순간이 하나의'));
    alternateTitle.appendChild(createI18nSpan('warm', 'home.v3.title2.line2.ko', '러브트리로'));
    alternateTitle.appendChild(createI18nSpan('accent', 'home.v3.title2.line3.ko', '이어져요'));

    set2.appendChild(alternateTitle);
    set2.appendChild(createDescBlock(
      'home.v3.desc2.line1.ko', '반했던 장면과 오래 남은 마음을,',
      'home.v3.desc2.line2.ko', '감정이 이어진 경로로 천천히 남겨보세요.'
    ));

    var loop = document.createElement('div');
    loop.className = 'home-hero-loop-container';
    loop.appendChild(set1);
    loop.appendChild(set2);
    actions.parentNode.insertBefore(loop, actions);

    // Remove the original .home-v3-desc to avoid orphan description.
    // Do NOT remove .home-v3-copy — it contains the loop, CTA, note, and intro link.
    if (desc) desc.remove();

    // Hold the loop height so the CTA/note/intro link do not move.
    var stabilizeHeight = function() {
      var h = Math.max(set1.offsetHeight, set2.offsetHeight);
      if (h > 0) loop.style.minHeight = h + 'px';
    };
    stabilizeHeight();
    if (window.requestAnimationFrame) {
      window.requestAnimationFrame(stabilizeHeight);
    }
    window.addEventListener('load', stabilizeHeight, { once: true });

    var reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (reducedMotion) return;

    // The headline no longer runs on its own clock. The growth cycle calls
    // window.__lovebudHeroCopyToggle() right after each artist card flip
    // completes, so the headline swaps out-in only while the cards are at
    // rest (never flickering mid-flip) and never while a video is playing
    // (playback pauses the cycle, so no flip — and no toggle — happens).
    // The transition is out-in: the active set fades out fully before the
    // other fades in, so two headlines never overlap in the same cell, and
    // the CTA/note/intro link never move (loop height is stabilized above).
    var activeSet = 1;
    var transitioning = false;
    var FADE_OUT_MS = 520;

    var showSet = function(num) {
      set1.classList.toggle('active', num === 1);
      set2.classList.toggle('active', num === 2);
      activeSet = num;
    };

    window.__lovebudHeroCopyToggle = function() {
      if (transitioning) return;
      transitioning = true;
      var nextSet = activeSet === 1 ? 2 : 1;
      showSet(0);
      window.setTimeout(function() {
        showSet(nextSet);
        transitioning = false;
      }, FADE_OUT_MS);
    };
  }

  // ============================================================
  // Hero growth cycle (rotating YouTube moments)
  // ============================================================

  function initHeroGrowthCycle() {
    if (document.getElementById('home-hero-cycle-marker')) return;
    if (window.__lovebudHeroCycleBootstrapped) return;
    window.__lovebudHeroCycleBootstrapped = true;

    var marker = document.createElement('meta');
    marker.id = 'home-hero-cycle-marker';
    marker.setAttribute('data-hero-cycle', '1');
    document.head.appendChild(marker);

    var collage = document.querySelector('.home-v3-collage');
    var stage = document.querySelector('.home-v3-growth-stage');
    if (!collage || !stage) return;

    var caption = stage.querySelector('.growth-stage-caption');
    var cards = Array.prototype.slice.call(stage.querySelectorAll('.growth-stage-card'));
    if (!cards.length) return;

    var reducedMotionQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
    var reducedMotion = reducedMotionQuery.matches;

    var PHASE = {
      PENDING: 'pending',
      CAPTION: 'caption-revealed',
      BRANCHES: 'branches-growing',
      CARDS: 'cards-revealing',
      COMPLETED: 'completed'
    };

    // Sequential card flip: featured starts, each supporting card follows
    // FLIP_STAGGER_MS later. Each card takes FLIP_HALF_MS to reach 90deg
    // (edge-on, invisible), swaps its data there, then FLIP_HALF_MS to
    // rotate back and reveal the new content. No opacity swap, no flicker.
    var FLIP_STAGGER_MS = 120;
    var FLIP_HALF_MS = 230;
    var FLIP_TOTAL_MS = (FLIP_STAGGER_MS * 3) + (FLIP_HALF_MS * 2) + 60;

    var TIMINGS = reducedMotion ? {
      caption: 0,
      branches: 0,
      cards: 0,
      hold: 60000, // effectively "do not advance"
      flip: 0
    } : {
      caption: 500,
      branches: 2800,
      cards: 1100,
      hold: 4000,
      flip: FLIP_TOTAL_MS
    };

    var state = {
      artistIndex: 0,
      videoIndices: [0, 1, 2, 3],
      phase: PHASE.PENDING,
      phaseStart: 0,
      flipping: false,
      pauseReasons: {
        hover: false,
        focus: false,
        hidden: false,
        pageLifecycle: false,
        playing: false
      },
      timeoutId: null
    };

    function isPaused() {
      for (var key in state.pauseReasons) {
        if (state.pauseReasons[key]) return true;
      }
      return false;
    }

    function pause(reason) {
      if (reason && state.pauseReasons.hasOwnProperty(reason)) {
        state.pauseReasons[reason] = true;
      }
    }

    function resume(reason) {
      if (reason && state.pauseReasons.hasOwnProperty(reason)) {
        state.pauseReasons[reason] = false;
      }
    }

    function setStageState(nextState) {
      if (state.phase === nextState) return;
      state.phase = nextState;
      state.phaseStart = Date.now();
      stage.setAttribute('data-stage-state', nextState);
    }

    function clearTimer() {
      if (state.timeoutId) {
        window.clearTimeout(state.timeoutId);
        state.timeoutId = null;
      }
    }

    function scheduleNext(delay) {
      clearTimer();
      state.timeoutId = window.setTimeout(step, Math.max(0, delay || 0));
    }

    function youtubeForArtist(artistIndex, videoIndex) {
      var artist = ARTIST_DATASETS[artistIndex];
      if (!artist) return null;
      return artist.videos[videoIndex] || null;
    }

    function thumbnailForArtistAt(artistIndex, videoIndex) {
      var v = youtubeForArtist(artistIndex, videoIndex);
      return v ? youtubeThumbUrl(v.id) : '';
    }

    function watchForArtistAt(artistIndex, videoIndex) {
      var v = youtubeForArtist(artistIndex, videoIndex);
      return v ? youtubeWatchUrl(v.id) : '';
    }

    function applyArtistToCard(card, videoIndex) {
      var media = card.querySelector('.growth-stage-card-media');
      if (!media) {
        // All cards ship with a media box in HTML. If it is somehow missing,
        // append into the inner content wrapper so the swap-fade still covers
        // the media (do not drop it outside the .growth-stage-card-content).
        media = document.createElement('div');
        media.className = 'growth-stage-card-media';
        var contentWrap = card.querySelector('.growth-stage-card-content') || card;
        contentWrap.appendChild(media);
      }
      var artistLabel = card.querySelector('.growth-stage-card-artist');
      var channelEl = card.querySelector('.growth-stage-card-channel');
      var link = card.querySelector('.growth-stage-card-link');
      var fallback = card.querySelector('.growth-stage-card-fallback');
      var titleEl = card.querySelector('strong');
      // Featured nodes carry a description copy span keyed home.v3.growth.cardN.copy.
      // Supporting nodes only have a visually-hidden attribution span keyed
      // home.v3.youtube.attribution; match by key prefix so we never overwrite it.
      var copyEl = card.querySelector('span[data-i18n^="home.v3.growth.card"]');

      var artist = ARTIST_DATASETS[state.artistIndex];
      if (!artist) return;
      var video = artist.videos[videoIndex] || artist.videos[0];
      if (!video) return;

      if (artistLabel) artistLabel.textContent = resolveI18n(artist.labelKey) || artist.key.toUpperCase();
      if (channelEl) channelEl.textContent = resolveI18n(artist.channelKey) || ('Official channel - ' + artist.channelName);
      if (link) {
        link.href = youtubeWatchUrl(video.id);
        var attribution = resolveI18n('home.v3.youtube.attribution') || 'Watch on YouTube';
        var linkText = link.querySelector('[data-i18n]');
        if (linkText) linkText.textContent = attribution;
        link.setAttribute('aria-label', attribution + ' - ' + video.title);
      }
      if (titleEl) titleEl.textContent = video.title;
      if (copyEl) copyEl.textContent = resolveI18n('home.v3.growth.card' + ((videoIndex || 0) + 1) + '.copy') || '';
      if (fallback) fallback.textContent = video.title;

      if (card) {
        card.setAttribute('data-artist-key', artist.key);
        card.setAttribute('data-video-id', video.id);
        card.setAttribute('data-youtube-watch-url', youtubeWatchUrl(video.id));
      }

      if (media) {
        media.classList.remove('has-thumbnail-error');
        var existingImg = media.querySelector('img');
        var img = document.createElement('img');
        img.alt = '';
        img.loading = 'lazy';
        img.decoding = 'async';
        img.width = 640;
        img.height = 360;
        img.setAttribute('data-video-id', video.id);
        img.addEventListener('load', function() {
          if (existingImg && media.contains(existingImg)) {
            existingImg.remove();
          }
          img.classList.add('is-loaded');
        });
        img.addEventListener('error', function() {
          if (img.src.indexOf('maxresdefault') !== -1) {
            img.src = youtubeThumbUrl(video.id, false);
            return;
          }
          if (media.contains(img)) {
            img.remove();
            if (!media.querySelector('img')) {
              media.classList.add('has-thumbnail-error');
            }
          }
        });
        media.appendChild(img);
        img.src = youtubeThumbUrl(video.id, true);
      }
    }

    function resolveI18n(key) {
      if (!key) return '';
      var shared = window.i18nShared || {};
      var entry = shared[key];
      if (!entry) return '';
      var lang = (document.documentElement.getAttribute('lang') || 'ko').toLowerCase();
      var resolved = entry[lang] || entry.ko || entry.en || '';
      return String(resolved);
    }

    function applyCurrentArtistToCards() {
      cards.forEach(function(card, idx) {
        var slot = idx; // 0 = featured, 1..3 = supporting
        applyArtistToCard(card, state.videoIndices[slot] || 0);
      });
    }

    function advanceArtist() {
      var prevArtistIndex = state.artistIndex;
      state.artistIndex = (state.artistIndex + 1) % ARTIST_DATASETS.length;
      var prevArtist = ARTIST_DATASETS[prevArtistIndex];
      for (var i = 0; i < state.videoIndices.length; i++) {
        state.videoIndices[i] = (state.videoIndices[i] + 1) % prevArtist.videos.length;
      }
      var artist = ARTIST_DATASETS[state.artistIndex];
      if (collage) collage.setAttribute('data-hero-artist', artist.key);
    }

    function preloadNextThumbnails() {
      var nextArtistIndex = (state.artistIndex + 1) % ARTIST_DATASETS.length;
      var nextArtist = ARTIST_DATASETS[nextArtistIndex];
      if (!nextArtist) return;
      for (var i = 0; i < state.videoIndices.length; i++) {
        var nextVideoIndex = (state.videoIndices[i] + 1) % nextArtist.videos.length;
        var pre = new Image();
        pre.src = thumbnailForArtistAt(nextArtistIndex, nextVideoIndex);
      }
    }

    // ------------------------------------------------------------
    // Sequential card flip (artist change). The shell position and the
    // tree stay fixed; only the inner .growth-stage-card-content rotates
    // on the Y axis. Data swaps exactly at the 90deg edge-on point, so
    // old and new content are never visible at the same time and no blank
    // white card is ever shown.
    // ------------------------------------------------------------
    function flipCard(card, applyFn) {
      var content = card.querySelector('.growth-stage-card-content');
      if (!content) {
        applyFn();
        return;
      }
      content.classList.add('is-flip-out');
      window.setTimeout(function() {
        applyFn();
        content.classList.remove('is-flip-out');
      }, FLIP_HALF_MS);
    }

    function flipToNextArtist() {
      advanceArtist();
      cards.forEach(function(card, idx) {
        window.setTimeout(function() {
          flipCard(card, function() {
            applyArtistToCard(card, state.videoIndices[idx] || 0);
          });
        }, idx * FLIP_STAGGER_MS);
      });
    }

    // ------------------------------------------------------------
    // Large modal player (youtube-nocookie iframe). Every card (featured
    // and supporting) opens its own video in a centered overlay instead of
    // playing inside the small card. Opening the modal pauses the cycle,
    // the card flip, and the headline rotation; closing it removes the
    // iframe entirely and resumes the cycle on the current artist.
    // ------------------------------------------------------------
    var modalEl = null;
    var modalReturnFocus = null;

    function onDocumentFocusIn(e) {
      if (!modalEl) return;
      if (modalEl.contains(e.target)) return;
      // Focus escaped the dialog (e.g. tabbing out of the cross-origin
      // iframe). Pull it back inside so focus stays trapped in the modal.
      var close = modalEl.querySelector('.hero-video-modal-close');
      if (close) close.focus();
    }

    function onModalKeydown(e) {
      if (e.key === 'Escape') {
        e.preventDefault();
        closeVideoModal();
        return;
      }
      if (e.key !== 'Tab' || !modalEl) return;
      // Keep focus cycling between the close button and the player iframe.
      var focusables = Array.prototype.slice.call(modalEl.querySelectorAll('button, iframe'));
      if (!focusables.length) return;
      var first = focusables[0];
      var last = focusables[focusables.length - 1];
      var active = document.activeElement;
      if (e.shiftKey) {
        if (active === first || !modalEl.contains(active)) {
          e.preventDefault();
          last.focus();
        }
      } else if (active === last || !modalEl.contains(active)) {
        e.preventDefault();
        first.focus();
      }
    }

    function closeVideoModal() {
      if (!modalEl) return;
      var el = modalEl;
      modalEl = null;
      document.removeEventListener('focusin', onDocumentFocusIn);
      el.removeEventListener('keydown', onModalKeydown);
      // Removing the overlay also removes the iframe, which stops playback.
      el.remove();
      resume('playing');
      if (modalReturnFocus && typeof modalReturnFocus.focus === 'function') {
        modalReturnFocus.focus();
      }
      modalReturnFocus = null;
    }

    function openVideoModal(video, card) {
      if (!video) return;
      closeVideoModal(); // only one player at a time
      modalEl = document.createElement('div');
      modalEl.className = 'hero-video-modal';
      modalEl.setAttribute('role', 'dialog');
      modalEl.setAttribute('aria-modal', 'true');
      modalEl.setAttribute('aria-label', video.title + ' - YouTube');

      var panel = document.createElement('div');
      panel.className = 'hero-video-modal-panel';

      var player = document.createElement('div');
      player.className = 'hero-video-modal-player';

      var iframe = document.createElement('iframe');
      iframe.src = youtubeEmbedUrl(video.id);
      iframe.title = video.title + ' - YouTube';
      iframe.setAttribute('allow', 'autoplay; encrypted-media; picture-in-picture');
      iframe.setAttribute('allowfullscreen', '');
      iframe.setAttribute('frameborder', '0');
      iframe.setAttribute('referrerpolicy', 'strict-origin-when-cross-origin');
      player.appendChild(iframe);

      var closeBtn = document.createElement('button');
      closeBtn.className = 'hero-video-modal-close';
      closeBtn.type = 'button';
      closeBtn.setAttribute('aria-label', '영상 재생 닫기');
      // Build the close icon with DOM APIs (never innerHTML) so this file
      // stays free of DOM XSS sinks.
      var SVG_NS = 'http://www.w3.org/2000/svg';
      var closeIcon = document.createElementNS(SVG_NS, 'svg');
      closeIcon.setAttribute('viewBox', '0 0 24 24');
      closeIcon.setAttribute('aria-hidden', 'true');
      closeIcon.setAttribute('focusable', 'false');
      var closeIconPath = document.createElementNS(SVG_NS, 'path');
      closeIconPath.setAttribute('d', 'M19 6.41 17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z');
      closeIconPath.setAttribute('fill', 'currentColor');
      closeIcon.appendChild(closeIconPath);
      closeBtn.appendChild(closeIcon);

      panel.appendChild(player);
      panel.appendChild(closeBtn);
      modalEl.appendChild(panel);

      modalReturnFocus = card ? (card.querySelector('.growth-stage-card-play') || card) : null;

      closeBtn.addEventListener('click', closeVideoModal);
      modalEl.addEventListener('click', function(e) {
        if (e.target === modalEl) closeVideoModal(); // backdrop click
      });
      modalEl.addEventListener('keydown', onModalKeydown);
      document.addEventListener('focusin', onDocumentFocusIn);

      document.body.appendChild(modalEl);
      pause('playing');
      closeBtn.focus();
    }

    // ------------------------------------------------------------
    // Card wiring: clicking a card's thumbnail (or its play button, whose
    // click bubbles up) opens that card's current video in the modal. The
    // "YouTube에서 보기" external link sits outside the media box, so it
    // opens in a new tab and never triggers the modal.
    // ------------------------------------------------------------
    cards.forEach(function(card) {
      var media = card.querySelector('.growth-stage-card-media');
      if (!media) return;
      media.addEventListener('click', function() {
        // Never open the player mid-flip: the card content is rotating and a
        // stagger timeout is already in flight, so a click here would race it.
        if (state.flipping) return;
        // The clicked card's own dataset is the source of truth for what is
        // currently on screen (written by applyArtistToCard) — not the global
        // artist state — so the modal always plays the video whose thumbnail
        // and title are actually displayed.
        var videoId = card.getAttribute('data-video-id');
        if (!videoId) return;
        var titleEl = card.querySelector('strong');
        openVideoModal({
          id: videoId,
          title: (titleEl && titleEl.textContent) || 'YouTube video'
        }, card);
      });
    });

    // Reflect the flip state onto the play buttons as an aria-disabled hint
    // while a stagger flip is in flight. The click handler above also
    // hard-guards on state.flipping; this only signals the state to assistive
    // tech and does not redesign any timer or state machine.
    function setPlayButtonsFlipState(flipping) {
      cards.forEach(function(card) {
        var play = card.querySelector('.growth-stage-card-play');
        if (!play) return;
        if (flipping) play.setAttribute('aria-disabled', 'true');
        else play.removeAttribute('aria-disabled');
      });
    }

    function step() {
      if (isPaused()) {
        scheduleNext(500);
        return;
      }

      switch (state.phase) {
        case PHASE.PENDING:
          applyCurrentArtistToCards();
          setStageState(PHASE.CAPTION);
          scheduleNext(TIMINGS.caption);
          break;
        case PHASE.CAPTION:
          setStageState(PHASE.BRANCHES);
          scheduleNext(TIMINGS.branches);
          break;
        case PHASE.BRANCHES:
          setStageState(PHASE.CARDS);
          scheduleNext(TIMINGS.cards);
          break;
        case PHASE.CARDS:
          setStageState(PHASE.COMPLETED);
          scheduleNext(TIMINGS.hold);
          break;
        case PHASE.COMPLETED:
          if (!state.flipping) {
            // Hold finished. Flip to the next artist in sequence. The stage
            // stays "completed" so the shells, tree, and caption remain
            // visible while only the card contents rotate. (The modal player
            // pauses the cycle, so a flip never starts while it is open.)
            preloadNextThumbnails();
            state.flipping = true;
            setPlayButtonsFlipState(true);
            flipToNextArtist();
            scheduleNext(TIMINGS.flip);
          } else {
            // Flip finished. Hold on the new artist, then swap the headline
            // out-in now that the cards are at rest (never mid-flip). The
            // toggle is a no-op while a video plays because playback pauses
            // the cycle so this branch is not reached.
            state.flipping = false;
            setPlayButtonsFlipState(false);
            if (typeof window.__lovebudHeroCopyToggle === 'function') {
              window.__lovebudHeroCopyToggle();
            }
            scheduleNext(TIMINGS.hold);
          }
          break;
        default:
          setStageState(PHASE.PENDING);
          scheduleNext(0);
      }
    }

    // Hover / focus pause - only the hero region, not the whole page.
    var onPointerEnter = function() { pause('hover'); };
    var onPointerLeave = function() {
      if (document.hidden) return;
      resume('hover');
    };
    var onFocusIn = function(e) {
      if (!collage) return;
      if (collage.contains(e.target)) pause('focus');
    };
    var onFocusOut = function(e) {
      if (!collage) return;
      var next = e.relatedTarget;
      if (next && collage.contains(next)) return;
      if (document.hidden) return;
      resume('focus');
    };

    if (!reducedMotion) {
      collage.addEventListener('mouseenter', onPointerEnter);
      collage.addEventListener('mouseleave', onPointerLeave);
      collage.addEventListener('focusin', onFocusIn);
      collage.addEventListener('focusout', onFocusOut);
    }

    var onVisibility = function() {
      if (document.hidden) {
        pause('hidden');
        closeVideoModal();
      } else {
        // Resume pageLifecycle so a BFCached page can restart its cycle.
        resume('pageLifecycle');
        resume('hidden');
        // Restart from pending so a new cycle begins cleanly.
        if (!isPaused()) {
          setStageState(PHASE.PENDING);
          scheduleNext(50);
        }
      }
    };
    document.addEventListener('visibilitychange', onVisibility);

    var onPageHide = function() {
      pause('pageLifecycle');
      clearTimer();
      closeVideoModal();
    };
    window.addEventListener('pagehide', onPageHide);

    // BFCache return: pageshow fires with persisted=true when the page is
    // restored from the back/forward cache. Resume pageLifecycle so the
    // cycle is not permanently stopped after pagehide.
    var onPageShow = function(event) {
      if (event.persisted) {
        resume('pageLifecycle');
        resume('hidden');
        if (!isPaused()) {
          setStageState(PHASE.PENDING);
          scheduleNext(50);
        }
      }
    };
    window.addEventListener('pageshow', onPageShow);

    if (reducedMotion) {
      // Static first-artist completed tree. No timer.
      applyCurrentArtistToCards();
      setStageState(PHASE.COMPLETED);
      return;
    }

    setStageState(PHASE.PENDING);
    scheduleNext(0);
  }

  // ============================================================
  // Bootstrap
  // ============================================================

  function bootstrap() {
    initHeroCopyLoop();
    initHeroGrowthCycle();

    if (window.LovetreePageShell && typeof window.LovetreePageShell.initSharedPage === 'function') {
      window.LovetreePageShell.initSharedPage({
        renderHeader: true,
        applyI18n: true
      });
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', bootstrap, { once: true });
  } else {
    bootstrap();
  }
})();
