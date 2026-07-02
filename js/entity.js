/**
 * LoveBud Entity Detail Page Module.
 *
 * Renders a public entity detail page from curated knowledge fixtures.
 * Reads the entity ID from the URL query parameter (?id=) and displays
 * canonicalName, type badge, summary, aliases, sourceRefs, and related
 * entities via fixture relations. Draft/private content is hidden.
 *
 * Refs #3079
 */

(function () {
  'use strict';

  var FIXTURE_PATH = '../data/knowledge/curated-knowledge-fixtures.v1.json';

  /** In-memory cache of the fixture */
  var _fixtureCache = null;

  /**
   * Load the curated knowledge fixture data.
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
   * Get the entity ID from URL search params.
   *
   * @returns {string|null}
   */
  function getEntityIdFromUrl() {
    var params = new URLSearchParams(window.location.search);
    return params.get('id') || null;
  }

  /**
   * Find an entity by ID in the fixture.
   *
   * @param {Object} fixture
   * @param {string} id
   * @returns {Object|null}
   */
  function findEntityById(fixture, id) {
    if (!fixture || !Array.isArray(fixture.entities)) return null;
    return fixture.entities.find(function (e) {
      return e && e.id === id;
    }) || null;
  }

  /**
   * Get related entities for a given entity ID from fixture relations.
   * Returns only published entities, and only public relations.
   *
   * @param {Object} fixture
   * @param {string} entityId
   * @returns {Array} Array of { relationType, entity } objects
   */
  function getRelatedEntities(fixture, entityId) {
    if (!fixture || !Array.isArray(fixture.relations) || !Array.isArray(fixture.entities)) {
      return [];
    }

    var related = [];

    fixture.relations.forEach(function (relation) {
      if (!relation) return;
      // Only public relations
      if (relation.visibility !== 'public') return;

      var relatedEntityId = null;

      if (relation.from === entityId) {
        relatedEntityId = relation.to;
      } else if (relation.to === entityId) {
        relatedEntityId = relation.from;
      }

      if (!relatedEntityId) return;

      // Find the related entity
      var entity = findEntityById(fixture, relatedEntityId);
      if (!entity) return;

      // Only show published entities
      if (entity.publicationState !== 'published') return;

      related.push({
        relationType: relation.relationType,
        entity: entity
      });
    });

    return related;
  }

  /**
   * Get a human-readable label for an entity type.
   *
   * @param {string} type
   * @returns {string}
   */
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

  /**
   * Get a human-readable label for a relation type.
   *
   * @param {string} relationType
   * @returns {string}
   */
  function getRelationTypeLabel(relationType) {
    var labels = {
      'member_of': '구성원',
      'created_by': '제작',
      'related_to': '관련',
      'released_on': '발매'
    };
    return labels[relationType] || relationType || '관련';
  }

  /**
   * Escape HTML special characters.
   *
   * @param {*} str
   * @returns {string}
   */
  function escapeHtml(str) {
    if (typeof str !== 'string') return '';
    var div = document.createElement('div');
    div.appendChild(document.createTextNode(str));
    return div.innerHTML;
  }

  /**
   * Render the entity page content.
   */
  function renderEntityPage() {
    var contentEl = document.getElementById('entityContent');
    if (!contentEl) return;

    var entityId = getEntityIdFromUrl();

    if (!entityId) {
      renderNotFound(contentEl, '지식 ID가 지정되지 않았습니다. URL에 ?id=... 를 추가해주세요.');
      return;
    }

    // Show loading state
    contentEl.innerHTML =
      '<div class="entity-loading">' +
        '<span class="material-symbols-outlined entity-not-found-icon">hourglass_empty</span>' +
        '<p>지식 정보를 불러오는 중...</p>' +
      '</div>';

    loadFixture().then(function (fixture) {
      var entity = findEntityById(fixture, entityId);

      if (!entity) {
        renderNotFound(contentEl, '지식을 찾을 수 없습니다. ID "' + escapeHtml(entityId) + '" 에 해당하는 지식이 없습니다.');
        return;
      }

      // Hide draft/private content — only published entities are displayed
      if (entity.publicationState !== 'published') {
        renderNotFound(contentEl, '이 지식은 아직 공개 준비 중입니다.');
        return;
      }

      renderEntityDetail(contentEl, entity, fixture);

      // Update page title
      document.title = escapeHtml(entity.canonicalName) + ' | LoveTree';
    }).catch(function (err) {
      renderNotFound(contentEl, '지식 데이터를 불러오지 못했습니다: ' + escapeHtml(err.message));
    });
  }

  /**
   * Render the "not found" or error state.
   *
   * @param {HTMLElement} contentEl
   * @param {string} message
   */
  function renderNotFound(contentEl, message) {
    contentEl.innerHTML =
      '<div class="entity-not-found">' +
        '<div class="entity-not-found-icon">' +
          '<span class="material-symbols-outlined" style="font-size:64px;">search_off</span>' +
        '</div>' +
        '<div class="entity-not-found-title">지식을 찾을 수 없습니다</div>' +
        '<p>' + escapeHtml(message || '') + '</p>' +
      '</div>';
  }

  /**
   * Render the full entity detail view.
   *
   * @param {HTMLElement} contentEl
   * @param {Object} entity
   * @param {Object} fixture
   */
  function renderEntityDetail(contentEl, entity, fixture) {
    var related = getRelatedEntities(fixture, entity.id);

    var html = '';

    // Header with type badge
    html += '<div class="entity-header">';
    html += '<span class="entity-type-badge type-' + escapeHtml(entity.type) + '">' + escapeHtml(getTypeLabel(entity.type)) + '</span>';
    html += '</div>';

    // Canonical name
    html += '<h1 class="entity-canonical-name">' + escapeHtml(entity.canonicalName) + '</h1>';

    // Summary
    if (entity.summary) {
      html += '<div class="entity-summary">' + escapeHtml(entity.summary) + '</div>';
    }

    // Aliases
    if (Array.isArray(entity.aliases) && entity.aliases.length > 0) {
      html += '<div class="entity-section">';
      html += '<div class="entity-section-title">다른 이름</div>';
      html += '<div class="entity-aliases">';
      entity.aliases.forEach(function (alias) {
        html += '<span class="entity-alias-tag">' + escapeHtml(alias) + '</span>';
      });
      html += '</div>';
      html += '</div>';
    }

    // Source references
    if (Array.isArray(entity.sourceRefs) && entity.sourceRefs.length > 0) {
      html += '<div class="entity-section">';
      html += '<div class="entity-section-title">출처</div>';
      html += '<ul class="entity-source-refs">';
      entity.sourceRefs.forEach(function (ref) {
        html += '<li class="entity-source-ref-item">';
        if (ref.url) {
          html += '<a class="entity-source-ref-link" href="' + escapeHtml(ref.url) + '" target="_blank" rel="noopener noreferrer">';
          html += escapeHtml(ref.label || ref.url);
          html += '</a>';
        } else {
          html += '<span>' + escapeHtml(ref.label || '참조') + '</span>';
        }
        html += '</li>';
      });
      html += '</ul>';
      html += '</div>';
    }

    // Related entities
    if (related.length > 0) {
      html += '<div class="entity-section">';
      html += '<div class="entity-section-title">관련 지식</div>';
      html += '<div class="entity-related-list">';
      related.forEach(function (rel) {
        var relEntity = rel.entity;
        var href = 'entity.html?id=' + encodeURIComponent(relEntity.id);
        html += '<a class="entity-related-item" href="' + href + '">';
        html += '<span class="entity-related-name">' + escapeHtml(relEntity.canonicalName) + '</span>';
        html += '<span class="entity-related-type">' + escapeHtml(getRelationTypeLabel(rel.relationType)) + '</span>';
        html += '<span class="material-symbols-outlined" style="font-size:18px;color:var(--on-surface-variant);">chevron_right</span>';
        html += '</a>';
      });
      html += '</div>';
      html += '</div>';
    }

    contentEl.innerHTML = html;
  }

  // ── Public API ────────────────────────────────────────────────

  var page = {
    renderEntityPage: renderEntityPage,
    // Expose internals for testing
    getEntityIdFromUrl: getEntityIdFromUrl,
    findEntityById: findEntityById,
    getRelatedEntities: getRelatedEntities,
    getTypeLabel: getTypeLabel,
    getRelationTypeLabel: getRelationTypeLabel,
    escapeHtml: escapeHtml,
    loadFixture: loadFixture
  };

  if (typeof window !== 'undefined') {
    window.LoveBudEntityPage = page;
  }
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = page;
  }
})();
