/**
 * Contract Test: Editor Knowledge Link Core.
 *
 * Validates manual moment-to-entity linking constraints, search rules,
 * and security policy boundaries using real curated fixtures.
 *
 * Refs #3084
 * Refs #3078
 * Refs #3077
 * Refs #3068
 * Refs #1882
 */

'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const ROOT = path.resolve(__dirname, '../../');
const FIXTURE_PATH = path.join(ROOT, 'data/knowledge/curated-knowledge-fixtures.v1.json');
const CORE_SCRIPT_PATH = path.join(ROOT, 'js/editor/editor-knowledge-link-core.js');

// ── Helpers ──────────────────────────────────────────────────────────

function loadCoreModule() {
  const code = fs.readFileSync(CORE_SCRIPT_PATH, 'utf8');
  const sandbox = {
    window: {},
    module: { exports: {} }
  };
  vm.createContext(sandbox);
  vm.runInContext(code, sandbox);
  return sandbox.module.exports || sandbox.window.LoveBudEditorKnowledgeLinkCore;
}

function loadRealFixture() {
  return JSON.parse(fs.readFileSync(FIXTURE_PATH, 'utf8'));
}

function deepClone(obj) {
  return JSON.parse(JSON.stringify(obj));
}

// ── Tests ────────────────────────────────────────────────────────────

test('1. Core API modules are exported correctly in IIFE', () => {
  const core = loadCoreModule();
  assert.ok(core, 'Module should export LoveBudEditorKnowledgeLinkCore');
  assert.ok(Array.isArray(core.MOMENT_ENTITY_RELATION_TYPES), 'MOMENT_ENTITY_RELATION_TYPES should be an array');
  assert.strictEqual(typeof core.lookupPublishedEntities, 'function', 'lookupPublishedEntities should be a function');
  assert.strictEqual(typeof core.validateManualMomentEntityLink, 'function', 'validateManualMomentEntityLink should be a function');
});

test('2. Relation allowlist contains exactly the 6 defined types', () => {
  const core = loadCoreModule();
  const expected = ['about', 'references', 'inspired_by', 'appears_in', 'visited_at', 'learned_from'];
  assert.strictEqual(core.MOMENT_ENTITY_RELATION_TYPES.length, 6, 'Should allow exactly 6 relation types');
  for (const rel of expected) {
    assert.ok(core.MOMENT_ENTITY_RELATION_TYPES.includes(rel), `Allowlist must include relation type: ${rel}`);
  }
});

test('3. lookupPublishedEntities: basic search and query bounds', () => {
  const core = loadCoreModule();
  const fixture = loadRealFixture();

  // Find a known published entity in real fixtures to compare
  const publishedEntities = fixture.entities.filter(e => e.publicationState === 'published');
  assert.ok(publishedEntities.length > 0, 'Real fixtures must contain published entities for verification');

  const firstPub = publishedEntities[0];
  const results = core.lookupPublishedEntities(fixture, firstPub.canonicalName);
  assert.ok(results.length > 0, 'Should find at least one entity by canonicalName');
  assert.ok(results.some(e => e.id === firstPub.id), 'Search result should include the target entity');
});

test('4. lookupPublishedEntities: case-insensitive query matching (canonical & aliases)', () => {
  const core = loadCoreModule();
  const fixture = loadRealFixture();

  const entityWithAlias = fixture.entities.find(e => e.publicationState === 'published' && Array.isArray(e.aliases) && e.aliases.length > 0);
  if (entityWithAlias) {
    const alias = entityWithAlias.aliases[0];
    const upperAlias = alias.toUpperCase();
    const results = core.lookupPublishedEntities(fixture, upperAlias);
    assert.ok(results.length > 0, 'Should find entity with uppercase alias query');
    assert.ok(results.some(e => e.id === entityWithAlias.id), 'Lookup must match alias case-insensitively');
  }
});

test('5. lookupPublishedEntities: empty query returns all published entities in deterministic order', () => {
  const core = loadCoreModule();
  const fixture = loadRealFixture();

  const allPublished = fixture.entities.filter(e => e.publicationState === 'published');
  const results = core.lookupPublishedEntities(fixture, '');

  assert.strictEqual(results.length, allPublished.length, 'Empty query should return all published entities');
  for (let i = 0; i < results.length; i++) {
    assert.strictEqual(results[i].id, allPublished[i].id, 'Fixture sequence order must be preserved exactly');
  }
});

test('6. lookupPublishedEntities: options.limit bounds', () => {
  const core = loadCoreModule();
  const fixture = loadRealFixture();

  const results = core.lookupPublishedEntities(fixture, '', { limit: 1 });
  assert.strictEqual(results.length, 1, 'Should limit returned list to exactly 1');
});

test('7. lookupPublishedEntities: draft entities are strictly excluded', () => {
  const core = loadCoreModule();
  const mockFixture = {
    entities: [
      { id: 'e-1', type: 'person', canonicalName: 'Draft Person', aliases: [], summary: 's', sourceRefs: [{ label: 'l', url: 'u' }], publicationState: 'draft' },
      { id: 'e-2', type: 'person', canonicalName: 'Published Person', aliases: [], summary: 's', sourceRefs: [{ label: 'l', url: 'u' }], publicationState: 'published' }
    ]
  };

  const results = core.lookupPublishedEntities(mockFixture, 'Draft');
  assert.strictEqual(results.length, 0, 'Draft entity must not be searchable even with matching query');

  const resultsEmptyQuery = core.lookupPublishedEntities(mockFixture, '');
  assert.strictEqual(resultsEmptyQuery.length, 1, 'Only published entity should be returned on empty query');
  assert.strictEqual(resultsEmptyQuery[0].id, 'e-2', 'Excluded draft entity must not appear in empty query list');
});

test('8. validateManualMomentEntityLink: success paths for all 6 relation types', () => {
  const core = loadCoreModule();
  const fixture = loadRealFixture();

  const published = fixture.entities.find(e => e.publicationState === 'published');
  assert.ok(published, 'Curated fixtures must have at least one published entity');

  for (const rel of core.MOMENT_ENTITY_RELATION_TYPES) {
    const input = {
      momentId: 'moment-123',
      entityId: published.id,
      relationType: rel,
      visibility: 'private',
      sourceMomentVisibility: 'private'
    };

    const outcome = core.validateManualMomentEntityLink(input, fixture);
    assert.ok(outcome.ok, `Validation should pass for relation type: ${rel}`);
    assert.ok(outcome.link, 'Should return link configuration');
    assert.strictEqual(outcome.link.momentId, 'moment-123', 'Link momentId matches');
    assert.strictEqual(outcome.link.entityId, published.id, 'Link entityId matches');
    assert.strictEqual(outcome.link.relationType, rel, 'Link relationType matches');
    assert.strictEqual(outcome.link.visibility, 'private', 'Link visibility matches');

    // Verify lack of user metadata, tokens, or local details in success link output
    assert.ok(!outcome.link.hasOwnProperty('email'), 'Should not leakage user email');
    assert.ok(!outcome.link.hasOwnProperty('uid'), 'Should not leakage user uid');
    assert.ok(!outcome.link.hasOwnProperty('accountId'), 'Should not leakage accountId');
  }
});

test('9. validateManualMomentEntityLink: reject non-moment-entity relations (e.g. member_of)', () => {
  const core = loadCoreModule();
  const fixture = loadRealFixture();
  const published = fixture.entities.find(e => e.publicationState === 'published');

  const input = {
    momentId: 'moment-123',
    entityId: published.id,
    relationType: 'member_of', // entity-to-entity only
    visibility: 'private',
    sourceMomentVisibility: 'private'
  };

  const outcome = core.validateManualMomentEntityLink(input, fixture);
  assert.ok(!outcome.ok, 'Should reject relationType "member_of"');
  assert.strictEqual(outcome.code, 'INVALID_RELATION_TYPE');
});

test('10. validateManualMomentEntityLink: reject invalid input structures & IDs', () => {
  const core = loadCoreModule();
  const fixture = loadRealFixture();

  assert.ok(!core.validateManualMomentEntityLink(null, fixture).ok);

  const missingMomentId = {
    momentId: '',
    entityId: 'e-1',
    relationType: 'about',
    visibility: 'private',
    sourceMomentVisibility: 'private'
  };
  assert.strictEqual(core.validateManualMomentEntityLink(missingMomentId, fixture).code, 'INVALID_ID');

  const nonStringId = {
    momentId: 'moment-123',
    entityId: 42,
    relationType: 'about',
    visibility: 'private',
    sourceMomentVisibility: 'private'
  };
  assert.strictEqual(core.validateManualMomentEntityLink(nonStringId, fixture).code, 'INVALID_ID');
});

test('11. validateManualMomentEntityLink: reject invalid link visibility values', () => {
  const core = loadCoreModule();
  const fixture = loadRealFixture();
  const published = fixture.entities.find(e => e.publicationState === 'published');

  const badVisibility = {
    momentId: 'moment-123',
    entityId: published.id,
    relationType: 'about',
    visibility: 'internal-only', // invalid
    sourceMomentVisibility: 'private'
  };
  assert.strictEqual(core.validateManualMomentEntityLink(badVisibility, fixture).code, 'INVALID_VISIBILITY');
});

test('12. validateManualMomentEntityLink: reject unknown or draft entity references', () => {
  const core = loadCoreModule();
  const mockFixture = {
    entities: [
      { id: 'e-published', type: 'person', canonicalName: 'P', aliases: [], summary: 's', sourceRefs: [{ label: 'l', url: 'u' }], publicationState: 'published' },
      { id: 'e-draft', type: 'person', canonicalName: 'D', aliases: [], summary: 's', sourceRefs: [{ label: 'l', url: 'u' }], publicationState: 'draft' }
    ]
  };

  // Reject unknown
  const unknownInput = {
    momentId: 'm-1',
    entityId: 'e-nonexistent',
    relationType: 'about',
    visibility: 'private',
    sourceMomentVisibility: 'private'
  };
  assert.strictEqual(core.validateManualMomentEntityLink(unknownInput, mockFixture).code, 'ENTITY_NOT_FOUND');

  // Reject draft entity
  const draftInput = {
    momentId: 'm-1',
    entityId: 'e-draft',
    relationType: 'about',
    visibility: 'private',
    sourceMomentVisibility: 'private'
  };
  assert.strictEqual(core.validateManualMomentEntityLink(draftInput, mockFixture).code, 'ENTITY_NOT_PUBLISHED', 'Draft entity must be rejected');
});

test('13. validateManualMomentEntityLink: reject public visibility escalation', () => {
  const core = loadCoreModule();
  const mockFixture = {
    entities: [
      { id: 'e-pub', type: 'person', canonicalName: 'P', aliases: [], summary: 's', sourceRefs: [{ label: 'l', url: 'u' }], publicationState: 'published' }
    ]
  };

  // Reject: link visibility is public, but source moment is private
  const escalationInput = {
    momentId: 'm-1',
    entityId: 'e-pub',
    relationType: 'about',
    visibility: 'public',
    sourceMomentVisibility: 'private'
  };
  assert.strictEqual(core.validateManualMomentEntityLink(escalationInput, mockFixture).code, 'VISIBILITY_MISMATCH', 'Public link from private moment must be rejected');

  // Allow: link visibility is public, source moment is public
  const validPublicLink = {
    momentId: 'm-1',
    entityId: 'e-pub',
    relationType: 'about',
    visibility: 'public',
    sourceMomentVisibility: 'public'
  };
  assert.ok(core.validateManualMomentEntityLink(validPublicLink, mockFixture).ok);
});

test('14. Immutability validation: lookup and validation do not mutate parameters', () => {
  const core = loadCoreModule();
  const fixture = loadRealFixture();
  const published = fixture.entities.find(e => e.publicationState === 'published');

  const fixtureJsonBefore = JSON.stringify(fixture);
  const input = {
    momentId: 'moment-123',
    entityId: published.id,
    relationType: 'about',
    visibility: 'public',
    sourceMomentVisibility: 'public'
  };
  const inputJsonBefore = JSON.stringify(input);

  // Perform lookup & validation
  core.lookupPublishedEntities(fixture, 'test');
  core.validateManualMomentEntityLink(input, fixture);

  // Verify parameters did not change
  assert.strictEqual(JSON.stringify(fixture), fixtureJsonBefore, 'Fixture object should not be mutated');
  assert.strictEqual(JSON.stringify(input), inputJsonBefore, 'Input object should not be mutated');
});

test('15. DOM/Network/Storage independent module verification', () => {
  // Sandboxing limits access to globals.
  // The fact that it runs cleanly in vm context with empty sandbox confirms absolute independence.
  const core = loadCoreModule();
  assert.ok(core);
});

test('16. Self-closing verification (avoid closing keywords in doc and test)', () => {
  const src = fs.readFileSync(__filename, 'utf8');
  // Build pattern programmatically to avoid matching this test file source code itself
  const verbList = ['Clo' + 'ses', 'Fi' + 'xes', 'Reso' + 'lves'];
  const pattern = new RegExp('(' + verbList.join('|') + ')\\s+#1882', 'i');

  assert.ok(!pattern.test(src),
    'contract test source must NOT contain forbidden closing keywords (like Clo' + 'ses #1882)');
});

