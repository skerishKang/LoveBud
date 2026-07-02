/**
 * LoveBud Editor Knowledge Link UI Module.
 *
 * Renders the entity search UI in the editor detail panel, including
 * an autocomplete input with fixture-backed entity lookup and
 * selected entity chips with remove capability.
 *
 * Refs #3078
 * Refs #3079
 */

(function () {
  'use strict';

  var FIXTURE_PATH = '../data/knowledge/curated-knowledge-fixtures.v1.json';

  /** In-memory cache of loaded fixture */
  var _fixtureCache = null;

  /**
   * Load the curated knowledge fixture data.
   * Returns a promise that resolves to the fixture object.
   * Uses an in-memory cache to avoid repeated fetches.
   *
   * @returns {Promise<Object>}
   */
  function loadFixture() {
    if (_fixtureCache) {
      return Promise.resolve(_fixtureCache);
    }
    return fetch(FIXTURE_PATH)
      .then(function (res) {
        if (!res.ok) {
          throw new Error('Failed to load knowledge fixture: ' + res.status);
        }
        return res.json();
      })
      .then(function (data) {
        _fixtureCache = data;
        return data;
      });
  }

  /**
   * Create the entity search container element.
   *
   * @returns {HTMLElement} The search container div
   */
  function createSearchContainer() {
    var container = document.createElement('div');
    container.className = 'entity-search-container';
    container.innerHTML =
      '<div class="entity-search-input-wrap">' +
        '<input type="text" class="entity-search-input" placeholder="지식 검색..." autocomplete="off" />' +
        '<div class="entity-search-dropdown" style="display:none;"></div>' +
      '</div>' +
      '<div class="entity-search-chips" aria-label="선택된 지식"></div>';
    return container;
  }

  /**
   * Render the entity search UI into a given container element.
   * Binds autocomplete, chip management, and keyboard events.
   *
   * @param {HTMLElement} mountEl - The DOM element to mount into
   * @param {Function} onEntitySelect - Callback when entity is selected (receives entity object)
   * @param {Function} onEntityRemove - Callback when entity chip is removed (receives entity id)
   */
  function renderEntitySearch(mountEl, onEntitySelect, onEntityRemove) {
    if (!mountEl) return;

    mountEl.innerHTML = '';
    var container = createSearchContainer();
    mountEl.appendChild(container);

    var input = container.querySelector('.entity-search-input');
    var dropdown = container.querySelector('.entity-search-dropdown');
    var chipsContainer = container.querySelector('.entity-search-chips');

    /** Currently selected entities as an array of objects */
    var selectedEntities = [];

    /** Current autocomplete results */
    var currentResults = [];

    /** Currently highlighted dropdown index */
    var highlightIndex = -1;

    /**
     * Add an entity to the selected list, render chip, clear input.
     */
    function selectEntity(entity) {
      if (!entity) return;

      // Prevent duplicates
      var exists = selectedEntities.some(function (e) { return e.id === entity.id; });
      if (exists) return;

      selectedEntities.push(entity);
      renderChips();

      // Clear input
      input.value = '';
      hideDropdown();

      if (typeof onEntitySelect === 'function') {
        onEntitySelect(entity);
      }
    }

    /**
     * Remove an entity chip by id.
     */
    function removeEntity(entityId) {
      selectedEntities = selectedEntities.filter(function (e) { return e.id !== entityId; });
      renderChips();

      if (typeof onEntityRemove === 'function') {
        onEntityRemove(entityId);
      }
    }

    /**
     * Render all entity chips in the chips container.
     */
    function renderChips() {
      chipsContainer.innerHTML = '';
      selectedEntities.forEach(function (entity) {
        var chip = document.createElement('span');
        chip.className = 'entity-search-chip';
        chip.dataset.entityId = entity.id;
        chip.innerHTML =
          '<span class="entity-search-chip-label">' + escapeHtml(entity.canonicalName) + '</span>' +
          '<button type="button" class="entity-search-chip-remove" aria-label="' + escapeHtml(entity.canonicalName) + ' 제거">&times;</button>';

        var removeBtn = chip.querySelector('.entity-search-chip-remove');
        removeBtn.addEventListener('click', function (e) {
          e.stopPropagation();
          removeEntity(entity.id);
        });

        chipsContainer.appendChild(chip);
      });
    }

    /**
     * Show dropdown with given results.
     */
    function showDropdown(results) {
      dropdown.innerHTML = '';
      dropdown.style.display = '';

      if (!results || results.length === 0) {
        dropdown.innerHTML = '<div class="entity-search-dropdown-empty">일치하는 지식이 없습니다</div>';
        highlightIndex = -1;
        return;
      }

      currentResults = results;
      highlightIndex = -1;

      results.forEach(function (entity, index) {
        var item = document.createElement('div');
        item.className = 'entity-search-dropdown-item';
        item.dataset.index = index;

        var typeLabel = getTypeLabel(entity.type);

        item.innerHTML =
          '<span class="entity-search-dropdown-name">' + escapeHtml(entity.canonicalName) + '</span>' +
          '<span class="entity-search-dropdown-type">' + escapeHtml(typeLabel) + '</span>';

        item.addEventListener('click', function () {
          selectEntity(entity);
        });

        item.addEventListener('mouseenter', function () {
          setHighlight(index);
        });

        dropdown.appendChild(item);
      });
    }

    /**
     * Hide the dropdown.
     */
    function hideDropdown() {
      dropdown.style.display = 'none';
      highlightIndex = -1;
    }

    /**
     * Set the highlighted item at a given index.
     */
    function setHighlight(index) {
      var items = dropdown.querySelectorAll('.entity-search-dropdown-item');
      items.forEach(function (item, i) {
        item.classList.toggle('is-highlighted', i === index);
      });
      highlightIndex = index;
    }

    /**
     * Perform the entity lookup and show results.
     */
    function performSearch(query) {
      if (!query || !query.trim()) {
        hideDropdown();
        return;
      }

      loadFixture().then(function (fixture) {
        var core = window.LoveBudEditorKnowledgeLinkCore;
        if (!core || typeof core.lookupPublishedEntities !== 'function') {
          return;
        }

        var results = core.lookupPublishedEntities(fixture, query, { limit: 10 });
        showDropdown(results);
      });
    }

    // ── Input event binding ──────────────────────────────────────

    input.addEventListener('input', function () {
      performSearch(input.value);
    });

    input.addEventListener('focus', function () {
      if (input.value.trim()) {
        performSearch(input.value);
      }
    });

    // Close dropdown on blur (with delay to allow click)
    input.addEventListener('blur', function () {
      setTimeout(hideDropdown, 200);
    });

    // Keyboard navigation
    input.addEventListener('keydown', function (e) {
      var items = dropdown.querySelectorAll('.entity-search-dropdown-item');
      var itemCount = items.length;

      switch (e.key) {
        case 'ArrowDown':
          e.preventDefault();
          if (itemCount > 0) {
            var nextIndex = highlightIndex < itemCount - 1 ? highlightIndex + 1 : 0;
            setHighlight(nextIndex);
          }
          break;

        case 'ArrowUp':
          e.preventDefault();
          if (itemCount > 0) {
            var prevIndex = highlightIndex > 0 ? highlightIndex - 1 : itemCount - 1;
            setHighlight(prevIndex);
          }
          break;

        case 'Enter':
          e.preventDefault();
          if (highlightIndex >= 0 && highlightIndex < currentResults.length) {
            selectEntity(currentResults[highlightIndex]);
          }
          break;

        case 'Escape':
          e.preventDefault();
          hideDropdown();
          break;
      }
    });
  }

  /**
   * Get all currently selected entities from the search UI.
   *
   * @param {HTMLElement} mountEl - The mount element
   * @returns {Array} Array of selected entity objects
   */
  function getSelectedEntities(mountEl) {
    if (!mountEl) return [];
    var chips = mountEl.querySelectorAll('.entity-search-chip');
    return Array.prototype.map.call(chips, function (chip) {
      return {
        id: chip.dataset.entityId,
        canonicalName: chip.querySelector('.entity-search-chip-label').textContent
      };
    });
  }

  // ── Helpers ───────────────────────────────────────────────────

  function escapeHtml(str) {
    if (typeof str !== 'string') return '';
    var div = document.createElement('div');
    div.appendChild(document.createTextNode(str));
    return div.innerHTML;
  }

  function getTypeLabel(type) {
    var labels = {
      'person': '인물',
      'group_or_organization': '그룹/단체',
      'work': '작품',
      'video_or_source': '영상/출처',
      'place': '장소',
      'event': '이벤트',
      'concept': '컨셉'
    };
    return labels[type] || type || '기타';
  }

  // ── Public API ────────────────────────────────────────────────

  var ui = {
    renderEntitySearch: renderEntitySearch,
    getSelectedEntities: getSelectedEntities,
    loadFixture: loadFixture
  };

  if (typeof window !== 'undefined') {
    window.LoveBudEditorKnowledgeLinkUI = ui;
  }
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = ui;
  }
})();
