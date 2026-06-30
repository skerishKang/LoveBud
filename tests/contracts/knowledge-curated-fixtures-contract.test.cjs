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
const DOC_PATH = path.join(ROOT, 'docs/product/lovebud-curated-knowledge-fixtures-contract.md');

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function deepClone(obj) {
  return JSON.parse(JSON.stringify(obj));
}

function getPublicDiscoveryRelations(data) {
  const entitiesById = new Map(data.entities.map((entity) => [entity.id, entity]));
  return data.relations.filter((relation) => {
    if (relation.visibility !== 'public') return false;
    const from = entitiesById.get(relation.from);
    const to = entitiesById.get(relation.to);
    return from?.publicationState === 'published' && to?.publicationState === 'published';
  });
}

function validateFixtures(data) {
  // 0. Identifier Leakage Check (Highest Priority)
  const leakRegex = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}|(uid:|firebase_uid:|firebase-uid:|userId:|accountId:)[a-z0-9]{10,}|ownerLocalMetadata|token|password/i;
  const fullJson = JSON.stringify(data);
  const matches = fullJson.match(leakRegex);
  if (matches) {
    for (const match of matches) {
      const isAllowed = match.includes('editorial_fixture') || match.includes('knowledge_hub_editorial');
      assert.ok(isAllowed, `Security leak detected: forbidden identifier found in fixture: ${match}`);
    }
  }

  // Top-level validation
  assert.ok(data && typeof data === 'object' && !Array.isArray(data), 'Fixture must be an object');
  assert.strictEqual(data.version, 1, 'Fixture version must be 1');
  assert.ok(Array.isArray(data.entities), 'entities must be an array');
  assert.ok(Array.isArray(data.relations), 'relations must be an array');

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
    assert.ok(entity.id && typeof entity.id === 'string', `Entity missing id: ${JSON.stringify(entity)}`);
    assert.ok(entity.type && entityTypes.has(entity.type), `Invalid entity type: ${entity.type} in ${entity.id}`);
    assert.ok(entity.canonicalName && typeof entity.canonicalName === 'string', `Entity missing canonicalName: ${entity.id}`);
    assert.ok(Array.isArray(entity.aliases), `Entity aliases must be array: ${entity.id}`);
    assert.ok(entity.summary && typeof entity.summary === 'string', `Entity missing summary: ${entity.id}`);
    assert.ok(Array.isArray(entity.sourceRefs) && entity.sourceRefs.length > 0, `Entity must have at least one sourceRef: ${entity.id}`);
    assert.ok(pubStates.has(entity.publicationState), `Invalid publicationState: ${entity.publicationState} in ${entity.id}`);
    
    const dateRegex = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d+)?Z$/;
    assert.match(entity.createdAt, dateRegex, `Invalid createdAt ISO date: ${entity.createdAt} in ${entity.id}`);
    assert.ok(!isNaN(Date.parse(entity.createdAt)), `Invalid createdAt date value: ${entity.createdAt} in ${entity.id}`);
    assert.match(entity.updatedAt, dateRegex, `Invalid updatedAt ISO date: ${entity.updatedAt} in ${entity.id}`);
    assert.ok(!isNaN(Date.parse(entity.updatedAt)), `Invalid updatedAt date value: ${entity.updatedAt} in ${entity.id}`);

    for (const ref of entity.sourceRefs) {
      assert.ok(typeof ref.label === 'string' && ref.label.trim().length > 0, `sourceRef label must be non-empty string in ${entity.id}`);
      assert.ok(typeof ref.url === 'string' && ref.url.trim().length > 0, `sourceRef url must be non-empty string in ${entity.id}`);
    }

    assert.ok(!entityIds.has(entity.id), `Duplicate entity ID: ${entity.id}`);
    entityIds.add(entity.id);
    assert.ok(!canonicalNames.has(entity.canonicalName), `Duplicate canonicalName: ${entity.canonicalName}`);
    canonicalNames.add(entity.canonicalName);
    for (const alias of entity.aliases) {
      assert.ok(alias !== entity.canonicalName, `Alias ${alias} collides with own canonicalName in ${entity.id}`);
      assert.ok(!allAliases.has(alias), `Duplicate alias: ${alias}`);
      allAliases.add(alias);
    }
  }

  for (const entity of entities) {
    for (const alias of entity.aliases) {
      assert.ok(!canonicalNames.has(alias), `Alias ${alias} collides with a canonicalName in ${entity.id}`);
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
      assert.ok(typeof ref.label === 'string' && ref.label.trim().length > 0, `Relation sourceRef label must be non-empty string in ${rel.id}`);
      assert.ok(typeof ref.url === 'string' && ref.url.trim().length > 0, `Relation sourceRef url must be non-empty string in ${rel.id}`);
    }

    if (rel.visibility === 'public') {
      const fromEntity = entities.find((e) => e.id === rel.from);
      const toEntity = entities.find((e) => e.id === rel.to);
      assert.strictEqual(fromEntity.publicationState, 'published', `Public relation ${rel.id} from endpoint must be published`);
      assert.strictEqual(toEntity.publicationState, 'published', `Public relation ${rel.id} to endpoint must be published`);
    }

    assert.ok(!relationIds.has(rel.id), `Duplicate relation ID: ${rel.id}`);
    relationIds.add(rel.id);
  }
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

test('Fixture JSON parses and has valid top-level shape', () => {
  const data = JSON.parse(fs.readFileSync(FIXTURE_PATH, 'utf8'));
  assert.ok(data && typeof data === 'object', 'Fixture must be an object');
  assert.strictEqual(data.version, 1, 'Fixture version must be 1');
  assert.ok(Array.isArray(data.entities), 'entities must be an array');
  assert.ok(Array.isArray(data.relations), 'relations must be an array');
});

test('Fixture covers all 7 entity types', () => {
  const data = JSON.parse(fs.readFileSync(FIXTURE_PATH, 'utf8'));
  const types = new Set(data.entities.map((e) => e.type));
  const required = ['person', 'group_or_organization', 'work', 'video_or_source', 'place', 'event', 'concept'];
  for (const t of required) {
    assert.ok(types.has(t), `Missing entity type coverage: ${t}`);
  }
});

test('Fixture adheres to structural and identity contracts', () => {
  const data = JSON.parse(fs.readFileSync(FIXTURE_PATH, 'utf8'));
  validateFixtures(data);
});

test('Private/draft entities are excluded from public discovery', () => {
  const data = JSON.parse(fs.readFileSync(FIXTURE_PATH, 'utf8'));
  const publicRelations = getPublicDiscoveryRelations(data);

  const basePublicRels = data.relations.filter((r) => r.visibility === 'public');
  const expectedCount = basePublicRels.filter((r) => {
    const from = data.entities.find((e) => e.id === r.from);
    const to = data.entities.find((e) => e.id === r.to);
    return from.publicationState === 'published' && to.publicationState === 'published';
  }).length;

  assert.strictEqual(publicRelations.length, expectedCount, 'Public discovery relation count mismatch');

  const mutation = deepClone(data);
  mutation.relations.push({
    id: 'rel-private',
    from: mutation.entities[0].id,
    to: mutation.entities[1].id,
    relationType: 'related_to',
    sourceRefs: [{ label: 'l', url: 'u' }],
    visibility: 'private',
    createdBy: 'editorial_fixture',
    ownershipBoundary: 'knowledge_hub_editorial'
  });
  const resultsWithPrivate = getPublicDiscoveryRelations(mutation);
  assert.ok(!resultsWithPrivate.some((r) => r.id === 'rel-private'), 'Private relation must be excluded from public discovery');
});

test('Identifier leakage is forbidden', () => {
  const baseData = JSON.parse(fs.readFileSync(FIXTURE_PATH, 'utf8'));
  validateFixtures(baseData);

  const leakEmail = deepClone(baseData);
  leakEmail.relations[0].createdBy = 'qa.user@example.test';
  assert.throws(() => validateFixtures(leakEmail), /Security leak detected/);

  const leakUid = deepClone(baseData);
  leakUid.entities[0].sourceRefs[0].url = 'https://example.com/uid:AbCdEfGhIjKlMnOpQrStUv';
  assert.throws(() => validateFixtures(leakUid), /Security leak detected/);

  const leakMeta = deepClone(baseData);
  leakMeta.entities[0].ownerLocalMetadata = 'some-value';
  assert.throws(() => validateFixtures(leakMeta), /Security leak detected/);
});

test('Deterministic failures for invalid mutations', () => {
  const baseData = JSON.parse(fs.readFileSync(FIXTURE_PATH, 'utf8'));

  const badType = deepClone(baseData);
  badType.entities[0].type = 'unknown_type';
  assert.throws(() => validateFixtures(badType), /Invalid entity type/);

  const badRelType = deepClone(baseData);
  badRelType.relations[0].relationType = 'unknown_rel';
  assert.throws(() => validateFixtures(badRelType), /Invalid relation type/);

  const missingRef = deepClone(baseData);
  missingRef.entities[0].sourceRefs = [];
  assert.throws(() => validateFixtures(missingRef), /must have at least one sourceRef/);

  const danglingRel = deepClone(baseData);
  danglingRel.relations[0].to = 'non-existent-id';
  assert.throws(() => validateFixtures(danglingRel), /endpoint does not exist/);

  const draftEndpoint = deepClone(baseData);
  const draftEntity = draftEndpoint.entities.find((e) => e.publicationState === 'draft') || draftEndpoint.entities[0];
  draftEntity.publicationState = 'draft';
  draftEndpoint.relations[0].from = draftEntity.id;
  draftEndpoint.relations[0].visibility = 'public';
  assert.throws(() => validateFixtures(draftEndpoint), /from endpoint must be published/);

  const aliasCollision = deepClone(baseData);
  aliasCollision.entities[0].aliases.push(aliasCollision.entities[1].canonicalName);
  assert.throws(() => validateFixtures(aliasCollision), /collides with a canonicalName/);

  const badShape = deepClone(baseData);
  badShape.version = 2;
  assert.throws(() => validateFixtures(badShape), /Fixture version must be 1/);
});

test('No closing keywords for #1882 in files', () => {
  const files = [
    FIXTURE_PATH,
    DOC_PATH,
    path.join(ROOT, 'tests/contracts/knowledge-curated-fixtures-contract.test.cjs')
  ];
  const forbidden = [
    'Clo' + 'ses #1882',
    'Fix' + 'es #1882',
    'Res' + 'olves #1882'
  ];

  for (const f of files) {
    const content = fs.readFileSync(f, 'utf8');
    for (const pattern of forbidden) {
      assert.ok(!content.includes(pattern), `Forbidden keyword ${pattern} found in ${f}`);
    }
  }
});
