/* LoveBud home v3 - inline init
   Two responsibilities:
   1) Hero copy rhythm: two copy sets (3-line title + 2-line description),
      toggled by a single managed timer. CTA, note, intro link never move.
   2) Hero growth cycle: JS state machine that rotates BTS -> BLACKPINK ->
      CORTIS -> RESCENE -> repeat. Each cycle paints caption -> branches ->
      cards -> hold -> fade -> swap. Reduced motion shows the first
      artist's completed tree and stops. Hover, focus, and document.hidden
      pause the cycle. A second init is a no-op.
*/
(function() {
  'use strict';

  // ============================================================
  // Public YouTube video dataset.
  // 4 artists x 4 official public MVs = 16 video IDs.
  // Channels verified by web search against artist/label channels.
  // Remote thumbnails: img.youtube.com/vi/<id>/hqdefault.jpg
  // ============================================================

  var ARTIST_DATASETS = [
    {
      key: 'bts',
      labelKey: 'home.v3.artist.bts',
      channelKey: 'home.v3.artist.channel.bts',
      channelName: 'HYBE LABELS',
      videos: [
        { id: 'gdZLi9oWNZg', title: 'Dynamite' },
        { id: 'WMwePlGQuT8', title: 'Butter' },
        { id: 'XsX3ATc3FbA', title: 'Boy With Luv' },
        { id: '7wC20jghM2c', title: 'Blood Sweat & Tears' }
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

  function youtubeThumbUrl(videoId) {
    // YouTube's static thumbnail endpoint (hqdefault) - 480x360 16:9 crop.
    return 'https://i.ytimg.com/vi/' + encodeURIComponent(videoId) + '/hqdefault.jpg';
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

    // Single managed timer (no duplicates).
    var toggleInterval = null;
    var activeSet = 1;
    var startToggling = function() {
      if (toggleInterval) return;
      toggleInterval = window.setInterval(function() {
        if (activeSet === 1) {
          set1.classList.remove('active');
          set2.classList.add('active');
          activeSet = 2;
        } else {
          set2.classList.remove('active');
          set1.classList.add('active');
          activeSet = 1;
        }
      }, 4000);
    };
    var stopToggling = function() {
      if (toggleInterval) {
        window.clearInterval(toggleInterval);
        toggleInterval = null;
      }
    };
    startToggling();
    window.addEventListener('pagehide', stopToggling);
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
      COMPLETED: 'completed',
      FADE: 'fade-out'
    };

    var TIMINGS = reducedMotion ? {
      caption: 0,
      branches: 0,
      cards: 0,
      hold: 60000, // effectively "do not advance"
      fade: 0
    } : {
      caption: 500,
      branches: 2800,
      cards: 1100,
      hold: 4000,
      fade: 900
    };

    var state = {
      artistIndex: 0,
      videoIndices: [0, 0, 0, 0],
      phase: PHASE.PENDING,
      phaseStart: 0,
      isPaused: false,
      timeoutId: null
    };

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

    function youtubeFor(index) {
      var artist = ARTIST_DATASETS[state.artistIndex];
      if (!artist) return null;
      return artist.videos[state.videoIndices[index] || 0] || null;
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
      var artistLabel = card.querySelector('.growth-stage-card-artist');
      var channelEl = card.querySelector('.growth-stage-card-channel');
      var link = card.querySelector('.growth-stage-card-link');
      var fallback = card.querySelector('.growth-stage-card-fallback');
      var titleEl = card.querySelector('strong');
      var copyEl = card.querySelector('span[data-i18n]:not(.growth-stage-card-artist):not(.growth-stage-card-badge)');

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

      // Set up the <img> for thumbnail loading
      if (media) {
        media.classList.remove('has-thumbnail-error');
        var existingImg = media.querySelector('img');
        if (existingImg) {
          existingImg.classList.remove('is-loaded');
          existingImg.removeAttribute('src');
        }
        var img = document.createElement('img');
        img.alt = '';
        img.loading = 'lazy';
        img.decoding = 'async';
        img.width = 480;
        img.height = 360;
        img.addEventListener('load', function() {
          img.classList.add('is-loaded');
        });
        img.addEventListener('error', function() {
          // Keep gradient fallback visible; do not log.
          if (media.contains(img)) {
            media.classList.add('has-thumbnail-error');
            img.remove();
          }
        });
        media.insertBefore(img, media.firstChild);
        img.src = youtubeThumbUrl(video.id);
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
      state.artistIndex = (state.artistIndex + 1) % ARTIST_DATASETS.length;
      // For variety, rotate the four video indices by 1 each cycle.
      for (var i = 0; i < state.videoIndices.length; i++) {
        state.videoIndices[i] = (state.videoIndices[i] + 1) % ARTIST_DATASETS[state.artistIndex].videos.length;
      }
      var artist = ARTIST_DATASETS[state.artistIndex];
      if (collage) collage.setAttribute('data-hero-artist', artist.key);
    }

    function step() {
      if (state.isPaused) {
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
          setStageState(PHASE.FADE);
          scheduleNext(TIMINGS.fade);
          break;
        case PHASE.FADE:
          advanceArtist();
          setStageState(PHASE.PENDING);
          // Preload the next artist's first thumbnail quietly.
          var next = state.videoIndices[0];
          var pre = new Image();
          pre.src = thumbnailForArtistAt(state.artistIndex, next);
          scheduleNext(0);
          break;
        default:
          setStageState(PHASE.PENDING);
          scheduleNext(0);
      }
    }

    function pause() {
      state.isPaused = true;
    }

    function resume() {
      state.isPaused = false;
    }

    // Hover / focus pause - only the hero region, not the whole page.
    var onPointerEnter = function() { pause(); };
    var onPointerLeave = function() {
      if (document.hidden) return;
      resume();
    };
    var onFocusIn = function(e) {
      if (!collage) return;
      if (collage.contains(e.target)) pause();
    };
    var onFocusOut = function(e) {
      if (!collage) return;
      var next = e.relatedTarget;
      if (next && collage.contains(next)) return;
      if (document.hidden) return;
      resume();
    };

    if (!reducedMotion) {
      collage.addEventListener('mouseenter', onPointerEnter);
      collage.addEventListener('mouseleave', onPointerLeave);
      collage.addEventListener('focusin', onFocusIn);
      collage.addEventListener('focusout', onFocusOut);
    }

    var onVisibility = function() {
      if (document.hidden) {
        pause();
      } else {
        // Restart from pending so a new cycle begins cleanly.
        if (!state.isPaused) {
          setStageState(PHASE.PENDING);
          scheduleNext(50);
        }
        resume();
      }
    };
    document.addEventListener('visibilitychange', onVisibility);

    var onPageHide = function() {
      pause();
      clearTimer();
    };
    window.addEventListener('pagehide', onPageHide);

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
