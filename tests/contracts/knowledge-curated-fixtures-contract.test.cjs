/**
 * Contract test: Curated Knowledge Fixtures.
 *
 * Validates the structure and constraints of curated entity and relation fixtures.
 * This is a static contract test; it does not execute production runtime code.
 *
 * Refs #3077 / Refs #3068 / Refs #1882
 */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.resolve(__dirname, '..', '..');
const FIXTURE_PATH = path.join(ROOT, 'data/knowledge/curated-knowledge-fixtures.v1.json');

// ---------------------------------------------------------------------------
// Validation Helpers
// ---------------------------------------------------------------------------

function validateFixtures(data) {
  const entityTypes = new Set([
    'person', 'group_or_organization', 'work', 'video_or_source', 'place', 'event', 'concept'
  ]);
  const relationTypes = new Set([
    'member_of', 'part_of', 'created_by', 'released_on', 'related_to'
  ]);
  const pubStates = new Set(['draft', 'published']);
  const visibilities = new Set(['public', 'private']);

  const entities = data.entities || [];
  const relations = data.relations || [];

  const entityIds = new Set();
  const canonicalNames = new Set();
  const allAliases = new Set();

  // 1. Entity Validation
  for (const entity of entities) {
    // Required fields & basic types
    assert.ok(entity.id && typeof entity.id === 'string', `Entity missing id: ${JSON.stringify(entity)}`);
    assert.ok(entity.type && entityTypes.has(entity.type), `Invalid entity type: ${entity.type} in ${entity.id}`);
    assert.ok(entity.canonicalName && typeof entity.canonicalName === 'string', `Entity missing canonicalName: ${entity.id}`);
    assert.ok(Array.isArray(entity.aliases), `Entity aliases must be array: ${entity.id}`);
    assert.ok(entity.summary && typeof entity.summary === 'string', `Entity missing summary: ${entity.id}`);
    assert.ok(Array.isArray(entity.sourceRefs) && entity.sourceRefs.length > 0, `Entity must have at least one sourceRef: ${entity.id}`);
    assert.ok(pubStates.has(entity.publicationState), `Invalid publicationState: ${entity.publicationState} in ${entity.id}`);
    
    // ISO Date validation
    const dateRegex = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d+)?Z$/;
    assert.match(entity.createdAt, dateRegex, `Invalid createdAt ISO date: ${entity.createdAt} in ${entity.id}`);
    assert.match(entity.updatedAt, dateRegex, `Invalid updatedAt ISO date: ${entity.updatedAt} in ${entity.id}`);

    // sourceRefs validation
    for (const ref of entity.sourceRefs) {
      assert.ok(ref.label && ref.url, `sourceRef missing label or url in ${entity.id}`);
    }

    // Uniqueness
    assert.ok(!entityIds.has(entity.id), `Duplicate entity ID: ${entity.id}`);
    entityIds.add(entity.id);
    assert.ok(!canonicalNames.has(entity.canonicalName), `Duplicate canonicalName: ${entity.canonicalName}`);
    canonicalNames.add(entity.canonicalName);
    for (const alias of entity.aliases) {
      assert.ok(alias !== entity.canonicalName, `Alias ${alias} collides with canonicalName in ${entity.id}`);
      assert.ok(!allAliases.has(alias), `Duplicate alias: ${alias}`);
      allAliases.add(alias);
    }
  }

  // 2. Relation Validation
  const relationIds = new Set();
  for (const rel of relations) {
    assert.ok(rel.id && typeof rel.id === 'string', `Relation missing id: ${JSON.stringify(rel)}`);
    assert.ok(entityIds.has(rel.from), `Relation from endpoint does not exist: ${rel.from}`);
    assert.ok(entityIds.has(rel.to), `Relation to endpoint does not exist: ${rel.to}`);
    assert.ok(relationTypes.has(rel.relationType), `Invalid relation type: ${rel.relationType} in ${rel.id}`);
    assert.ok(Array.isArray(rel.sourceRefs) && rel.sourceRefs.length > 0, `Relation must have at least one sourceRef: ${rel.id}`);
    assert.ok(visibilities.has(rel.visibility), `Invalid visibility: ${rel.visibility} in ${rel.id}`);
    assert.strictEqual(rel.createdBy, 'editorial_fixture', `Forbidden createdBy: ${rel.createdBy} in ${rel.id}`);
    assert.strictEqual(rel.ownershipBoundary, 'knowledge_hub_editorial', `Invalid ownershipBoundary in ${rel.id}`);

    for (const ref of rel.sourceRefs) {
      assert.ok(ref.label && ref.url, `Relation sourceRef missing label or url in ${rel.id}`);
    }

    // Public relation endpoints must be published
    if (rel.visibility === 'public') {
      const fromEntity = entities.find(e => e.id === rel.from);
      const toEntity = entities.find(e => e.id === rel.to);
      assert.strictEqual(fromEntity.publicationState, 'published', `Public relation ${rel.id} from endpoint must be published`);
      assert.strictEqual(toEntity.publicationState, 'published', `Public relation ${rel.id} to endpoint must be published`);
    }

    assert.ok(!relationIds.has(rel.id), `Duplicate relation ID: ${rel.id}`);
    relationIds.add(rel.id);
  }

  // 3. Identifier Leakage Check
  const leakRegex = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}|uid:[a-z0-9]{20,}/i;
  const fullJson = JSON.stringify(data);
  assert.ok(!leakRegex.test(fullJson), `Security leak detected: account identifier found in fixture`);
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

test('Fixture JSON parses and has valid top-level shape', () => {
  const data = JSON.parse(fs.readFileSync(FIXTURE_PATH, 'utf8'));
  assert.ok(data.version, 'Fixture must have a version');
  assert.ok(Array.isArray(data.entities), 'entities must be an array');
  assert.ok(Array.isArray(data.relations), 'relations must be an array');
});

test('Fixture covers all 7 entity types', () => {
  const data = JSON.parse(fs.readFileSync(FIXTURE_PATH, 'utf8'));
  const types = new Set(data.entities.map(e => e.type));
  const required = ['person', 'group_or_organization', 'work', 'video_or_source', 'place', 'event', 'concept'];
  for (const t of required) {
    assert.ok(types.has(t), `Missing entity type coverage: ${t}`);
  }
});

test('Fixture adheres to structural and identity contracts', () => {
  const data = JSON.parse(fs.readFileSync(FIXTURE_PATH, 'utf8'));
  validateFixtures(data);
});

test('Private/draft entities are not public discovery endpoints', () => {
  const data = JSON.parse(fs.readFileSync(FIXTURE_PATH, 'utf8'));
  // This is implicitly tested in validateFixtures via the public relation check,
  // but we can add a specific check for discovery logic simulation.
  const publicRelations = data.relations.filter(r => r.visibility === 'public');
  for (const rel of publicRelations) {
    const from = data.entities.find(e => e.id === rel.from);
    const to = data.entities.find(e => e.id === rel.to);
    assert.strictEqual(from.publicationState, 'published');
    assert.strictEqual(to.publicationState, 'published');
  }
});

test('Identifier leakage is forbidden', () => {
  const data = JSON.parse(fs.readFileSync(FIXTURE_PATH, 'utf8'));
  validateFixtures(data);
});

test('Deterministic failures for invalid mutations', () => {
  const baseData = JSON.parse(fs.readFileSync(FIXTURE_PATH, 'utf8'));
  
  // 1. Unknown entity type
  const badType = JSON.parse(JSON.stringify(baseData));
  badType.entities[0].type = 'unknown_type';
  assert.throws(() => validateFixtures(badType), /Invalid entity type/);

  // 2. Unknown relation type
  const badRelType = JSON.parse(JSON.stringify(baseData));
  badRelType.relations[0].relationType = 'unknown_rel';
  assert.throws(() => validateFixtures(badRelType), /Invalid relation type/);

  // 3. Missing sourceRef
  const missingRef = JSON.parse(JSON.stringify(baseData));
  missingRef.entities[0].sourceRefs = [];
  assert.throws(() => validateFixtures(missingRef), /must have at least one sourceRef/);

  // 4. Dangling relation
  const danglingRel = JSON.parse(JSON.stringify(baseData));
  danglingRel.relations[0].to = 'non-existent-id';
  assert.throws(() => validateFixtures(danglingRel), /endpoint does not exist/);

  // 5. Public relation endpoint is draft
  const draftEndpoint = JSON.parse(JSON.stringify(baseData));
  // Make sure we have at least one draft entity to use
  const draftEntity = draftEndpoint.entities.find(e => e.publicationState === 'draft') || draftEndpoint.entities[0];
  draftEntity.publicationState = 'draft';
  draftEndpoint.relations[0].from = draftEntity.id;
  draftEndpoint.relations[0].visibility = 'public';
  assert.throws(() => validateFixtures(draftEndpoint), /from endpoint must be published/);
});
