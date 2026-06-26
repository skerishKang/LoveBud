/**
 * LoveBud - My Trees continuation hub media
 *
 * Reuses Browse's safe media helper so a selected owner tree can show
 * a playable representative source without creating empty media frames.
 */
(function () {
  'use strict';

  function getHub() {
    return window.LoveBudMyTreesPreviewHub || window.LoveTreeMyTreesPreviewHub || null;
  }

  function getEls() {
    return {
      panel: document.getElementById('myTreesHubPanel'),
      container: document.getElementById('myTreesHubVideoContainer'),
      placeholder: document.getElementById('myTreesHubPlaceholder'),
      media: document.getElementById('myTreesHubMedia')
    };
  }

  function getLocale() {
    var locale = window.i18n && window.i18n.currentLang;
    if (locale) return String(locale).toLowerCase().indexOf('en') === 0 ? 'en' : 'ko';
    return String(document.documentElement && document.documentElement.lang || 'ko').toLowerCase().indexOf('en') === 0 ? 'en' : 'ko';
  }

  function copy(ko, en) {
    return getLocale() === 'en' ? en : ko;
  }

  function sanitizeUrl(value) {
    var security = window.LoveBudSecurity;
    if (!security || typeof security.sanitizeUrl !== 'function') return '';
    return security.sanitizeUrl(value || '');
  }

  function getMemories(tree) {
    if (Array.isArray(tree && tree.memories)) return tree.memories;
    if (Array.isArray(tree && tree.nodes)) return tree.nodes;
    return [];
  }

  function getThumbnail(memory) {
    if (!memory) return '';
    return String(memory.thumbnail || memory.thumbnailUrl || memory.thumbnail_url || memory.imageUrl || memory.image_url || memory.coverUrl || memory.cover_url || memory.posterUrl || memory.poster_url || '').trim();
  }

  function getMemorySourceUrl(memory) {
    if (!memory) return '';
    return String(
      memory.sourceUrl ||
      memory.source_url ||
      memory.videoUrl ||
      memory.video_url ||
      memory.mediaUrl ||
      memory.media_url ||
      memory.linkUrl ||
      memory.link_url ||
      memory.url ||
      ''
    ).trim();
  }

  function normalizePreviewMemory(rawMemory) {
    var memory = rawMemory && rawMemory.data ? rawMemory.data : (rawMemory || {});
    return Object.assign({}, memory, {
      sourceUrl: getMemorySourceUrl(memory),
      thumbnail: getThumbnail(memory)
    });
  }

  function hasPlayableMedia(tree) {
    return getMemories(tree).some(function(memory) {
      return !!getMemorySourceUrl(memory);
    });
  }

  var hydratedPreviewTreesById = Object.create(null);
  var previewHydrationRequestId = 0;

  function hydrateTreeForPreview(tree) {
    if (!tree || !tree.id || hasPlayableMedia(tree)) {
      return Promise.resolve(tree);
    }

    var treeId = String(tree.id);
    if (hydratedPreviewTreesById[treeId]) {
      return Promise.resolve(Object.assign({}, tree, hydratedPreviewTreesById[treeId]));
    }

    if (!window.apiClient || typeof window.apiClient.getMemoriesByTree !== 'function') {
      return Promise.resolve(tree);
    }

    return window.apiClient.getMemoriesByTree(tree.id).then(function(rawMemories) {
      var memories = (Array.isArray(rawMemories) ? rawMemories : [])
        .map(normalizePreviewMemory)
        .sort(function(a, b) {
          var left = new Date(a.createdAt || a.created_at || a.timestamp || 0).getTime();
          var right = new Date(b.createdAt || b.created_at || b.timestamp || 0).getTime();
          return left - right;
        });

      var hydrated = {
        memories: memories,
        memoryCount: Math.max(Number(tree.memoryCount || 0), memories.length)
      };

      hydratedPreviewTreesById[treeId] = hydrated;
      return Object.assign({}, tree, hydrated);
    });
  }

  function getMediaCandidates(tree) {
    return getMemories(tree).map(function (memory) {
      return Object.assign({}, memory || {}, {
        sourceUrl: getMemorySourceUrl(memory),
        thumbnail: getThumbnail(memory)
      });
    });
  }

  function getMomentTitle(memory) {
    var title = String(memory && memory.title || '').trim();
    return title ? title.replace(/\s*-\s*.*/, '').trim() || title : copy('대표 순간', 'Featured moment');
  }

  function replaceMediaMarkup(media, markup) {
    if (!media) return;
    media.replaceChildren();
    if (!markup) return;
    var range = document.createRange();
    range.selectNodeContents(media);
    media.appendChild(range.createContextualFragment(markup));
  }

  function clearMedia() {
    var els = getEls();
    if (!els.container) return;
    if (els.panel) els.panel.classList.remove('has-media', 'preview-state-media', 'preview-state-thumbnail');
    if (els.media) {
      replaceMediaMarkup(els.media, '');
      els.media.hidden = true;
    }
    els.container.hidden = true;
  }

  function showPlaceholder() {
    var els = getEls();
    if (!els.container) return;
    if (els.panel) {
      els.panel.classList.remove('has-media', 'preview-state-media', 'preview-state-thumbnail');
      els.panel.classList.add('preview-state-empty');
    }
    if (els.media) {
      replaceMediaMarkup(els.media, '');
      els.media.hidden = true;
    }
    if (els.placeholder) els.placeholder.hidden = false;
    els.container.hidden = false;
  }

  function renderMedia(tree, preferredMomentIndex) {
    var els = getEls();
    var helper = window.LoveBudSearchPreviewMediaHelper;
    if (!els.container || !els.media || !helper || typeof helper.getPreviewMediaMemory !== 'function') {
      clearMedia();
      return;
    }

    var mediaMemory;
    if (typeof preferredMomentIndex === 'number' && preferredMomentIndex >= 0
        && typeof helper.getPreviewMediaMemoryAt === 'function') {
      mediaMemory = helper.getPreviewMediaMemoryAt(getMediaCandidates(tree), preferredMomentIndex);
    } else {
      mediaMemory = helper.getPreviewMediaMemory(getMediaCandidates(tree));
    }
    if (!mediaMemory) {
      clearMedia();
      return;
    }

    var displayTitle = String(tree && tree.title || '').trim() || copy('나의 러브트리', 'My LoveTree');
    var mediaTitle = getMomentTitle(mediaMemory);
    var sourceUrl = sanitizeUrl(mediaMemory.sourceUrl);
    var thumbnail = sanitizeUrl(mediaMemory.thumbnail);
    var markup = '';
    var state = '';

    if (sourceUrl && typeof helper.renderPreviewIframe === 'function') {
      markup = helper.renderPreviewIframe(sourceUrl, displayTitle, mediaTitle);
      state = markup ? 'media' : '';
    }
    if (!markup && thumbnail && typeof helper.renderPreviewThumbnailMedia === 'function') {
      markup = helper.renderPreviewThumbnailMedia(thumbnail, mediaTitle, displayTitle);
      state = markup ? 'thumbnail' : '';
    }
    if (!markup) {
      clearMedia();
      return;
    }

    replaceMediaMarkup(els.media, markup);
    els.media.hidden = false;
    if (els.placeholder) els.placeholder.hidden = true;
    els.container.hidden = false;
    if (els.panel) {
      els.panel.classList.remove('preview-state-empty', 'preview-state-media', 'preview-state-thumbnail');
      els.panel.classList.add('has-media', state === 'media' ? 'preview-state-media' : 'preview-state-thumbnail');
    }

    if (typeof helper.bindPreviewThumbnailHandlers === 'function') helper.bindPreviewThumbnailHandlers(els.media);
    // fix #2836: bind click-to-play overlay so play button triggers autoplay iframe
    if (typeof helper.bindPreviewOverlayEvents === 'function') helper.bindPreviewOverlayEvents(els.media);
  }

  // Issue #2825: dedicated entry point for flow stage clicks. Delegates
  // to renderMedia(tree, preferredMomentIndex) so the active stage and
  // the rendered media preview always point to the same moment — for
  // both the compact 1-4 stages and the expanded 5+ stages.
  function renderMediaForMoment(tree, momentIndex) {
    return renderMedia(tree, momentIndex);
  }

  function patchHub() {
    var hub = getHub();
    if (!hub || hub.__playableMediaPatched) return;
    var originalInit = hub.init;
    var originalShowPlaceholder = hub.showPlaceholder;
    var originalShowContent = hub.showContent;
    var originalShowLoading = hub.showLoading;
    var originalOnCardClick = hub.onCardClick;

    if (typeof originalInit === 'function') {
      hub.init = function (options) {
        var result = originalInit.call(hub, options);
        showPlaceholder();
        return result;
      };
    }
    if (typeof originalShowPlaceholder === 'function') {
      hub.showPlaceholder = function () {
        var result = originalShowPlaceholder.call(hub);
        showPlaceholder();
        return result;
      };
    }
    if (typeof originalShowContent === 'function') {
      hub.showContent = function (tree) {
        var result = originalShowContent.call(hub, tree);
        renderMedia(tree);
        return result;
      };
    }
    if (typeof originalShowLoading === 'function') {
      hub.showLoading = function (tree) {
        var result = originalShowLoading.call(hub, tree);
        clearMedia();
        return result;
      };
    }
    if (typeof originalOnCardClick === 'function') {
      hub.onCardClick = function (tree, options) {
        var requestId = ++previewHydrationRequestId;

        if (typeof hub.showLoading === 'function') {
          hub.showLoading(tree);
        }

        hydrateTreeForPreview(tree).then(function(hydratedTree) {
          if (requestId !== previewHydrationRequestId) return;

          if (typeof hub.showContent === 'function') {
            hub.showContent(hydratedTree);
          } else {
            renderMedia(hydratedTree);
          }
        }).catch(function() {
          if (requestId !== previewHydrationRequestId) return;

          if (typeof hub.showContent === 'function') {
            hub.showContent(tree);
          } else {
            renderMedia(tree);
          }
        });

        var result = originalOnCardClick.call(hub, tree, options);
        return result;
      };
    }
    hub.__playableMediaPatched = true;
  }

  function patchRendererSelection() {
    var renderer = window.LoveBudMyTreesRender
      || window.LoveTreeMyTreesRender
      || window.LoveBudMyTreesBatchRender;
    if (!renderer || typeof renderer.renderTrees !== 'function' || renderer.__playableMediaSelectionPatched) return;
    var originalRenderTrees = renderer.renderTrees;

    renderer.renderTrees = function (trees, options) {
      var rawById = Object.create(null);
      (Array.isArray(trees) ? trees : []).forEach(function (tree) {
        if (tree && tree.id != null) rawById[String(tree.id)] = tree;
      });
      var originalOnSelect = options && options.onSelect;
      var patchedOptions = Object.assign({}, options || {}, {
        onSelect: function (selectedTree) {
          var selectedId = selectedTree && selectedTree.id != null ? String(selectedTree.id) : '';
          return typeof originalOnSelect === 'function'
            ? originalOnSelect(rawById[selectedId] || selectedTree)
            : undefined;
        }
      });
      return originalRenderTrees.call(renderer, trees, patchedOptions);
    };
    renderer.__playableMediaSelectionPatched = true;
  }

  patchHub();
  patchRendererSelection();
  window.LoveBudMyTreesPreviewMedia = {
    renderMedia: renderMedia,
    renderMediaForMoment: renderMediaForMoment,
    clearMedia: clearMedia,
    showPlaceholder: showPlaceholder,
    patchHub: patchHub,
    patchRendererSelection: patchRendererSelection
  };
})();
