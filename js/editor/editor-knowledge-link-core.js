/**
 * LoveBud Editor Knowledge Link Core Module.
 *
 * Implements browser-safe, DOM-independent core algorithms for linking moments to entities.
 * Includes search lookup and manual verification rules.
 *
 * Refs #3084
 * Refs #3078
 * Refs #3077
 * Refs #3068
 * Refs #1882
 */

(function () {
  'use strict';

  const MOMENT_ENTITY_RELATION_TYPES = [
    'about',
    'references',
    'inspired_by',
    'appears_in',
    'visited_at',
    'learned_from'
  ];

  const ALLOWED_VISIBILITIES = ['public', 'private'];

  /**
   * Look up published entities from fixtures based on a query.
   *
   * @param {Object} fixture Curated fixtures object
   * @param {string} query Search query string
   * @param {Object} options Configuration options (limit)
   * @returns {Array} List of matched published entities
   */
  function lookupPublishedEntities(fixture, query, options) {
    if (!fixture || !Array.isArray(fixture.entities)) {
      return [];
    }

    const limit = options && Number.isInteger(options.limit) && options.limit > 0
      ? options.limit
      : null;

    const trimmedQuery = typeof query === 'string' ? query.trim().toLowerCase() : '';
    const results = [];

    for (const entity of fixture.entities) {
      if (!entity || entity.publicationState !== 'published') {
        continue;
      }

      let isMatch = false;
      if (trimmedQuery === '') {
        isMatch = true;
      } else {
        const canonical = typeof entity.canonicalName === 'string' ? entity.canonicalName.toLowerCase() : '';
        if (canonical.includes(trimmedQuery)) {
          isMatch = true;
        } else if (Array.isArray(entity.aliases)) {
          for (const alias of entity.aliases) {
            if (typeof alias === 'string' && alias.toLowerCase().includes(trimmedQuery)) {
              isMatch = true;
              break;
            }
          }
        }
      }

      if (isMatch) {
        results.push({
          id: entity.id,
          type: entity.type,
          canonicalName: entity.canonicalName,
          aliases: Array.isArray(entity.aliases) ? [...entity.aliases] : [],
          summary: entity.summary,
          sourceRefs: Array.isArray(entity.sourceRefs) ? JSON.parse(JSON.stringify(entity.sourceRefs)) : [],
          publicationState: entity.publicationState
        });

        if (limit && results.length >= limit) {
          break;
        }
      }
    }

    return results;
  }

  /**
   * Validate a manual linking payload between a Moment and an Entity.
   *
   * @param {Object} input Moment-Entity relation link request payload
   * @param {Object} fixture Curated fixtures object
   * @returns {Object} Validation outcome { ok: true, link } or { ok: false, code }
   */
  function validateManualMomentEntityLink(input, fixture) {
    if (!input || typeof input !== 'object') {
      return { ok: false, code: 'INVALID_INPUT' };
    }

    const { momentId, entityId, relationType, visibility, sourceMomentVisibility } = input;

    // 1. Verify momentId and entityId are non-empty strings
    if (typeof momentId !== 'string' || !momentId.trim()) {
      return { ok: false, code: 'INVALID_ID' };
    }
    if (typeof entityId !== 'string' || !entityId.trim()) {
      return { ok: false, code: 'INVALID_ID' };
    }

    // 2. Verify relationType is within the allowlist
    if (!MOMENT_ENTITY_RELATION_TYPES.includes(relationType)) {
      return { ok: false, code: 'INVALID_RELATION_TYPE' };
    }

    // 3. Verify visibility is either 'public' or 'private'
    if (!ALLOWED_VISIBILITIES.includes(visibility)) {
      return { ok: false, code: 'INVALID_VISIBILITY' };
    }

    // 4. Resolve target entity in fixtures
    if (!fixture || !Array.isArray(fixture.entities)) {
      return { ok: false, code: 'ENTITY_NOT_FOUND' };
    }
    const entity = fixture.entities.find((e) => e && e.id === entityId);
    if (!entity) {
      return { ok: false, code: 'ENTITY_NOT_FOUND' };
    }

    // 5. Target entity must be reviewed and published (Draft not allowed even for private links in v1)
    if (entity.publicationState !== 'published') {
      return { ok: false, code: 'ENTITY_NOT_PUBLISHED' };
    }

    // 6. Security & visibility consistency guardrails
    if (sourceMomentVisibility !== 'public' && sourceMomentVisibility !== 'private') {
      return { ok: false, code: 'INVALID_SOURCE_MOMENT_VISIBILITY' };
    }

    if (visibility === 'public') {
      // Public link requires public source moment
      if (sourceMomentVisibility !== 'public') {
        return { ok: false, code: 'VISIBILITY_MISMATCH' };
      }
    }

    // Return sanitized link payload without any user identities, metadata or tokens
    return {
      ok: true,
      link: {
        momentId: momentId.trim(),
        entityId: entityId.trim(),
        relationType,
        visibility
      }
    };
  }

  const core = {
    MOMENT_ENTITY_RELATION_TYPES,
    lookupPublishedEntities,
    validateManualMomentEntityLink
  };

  if (typeof window !== 'undefined') {
    window.LoveBudEditorKnowledgeLinkCore = core;
  }
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = core;
  }
})();
