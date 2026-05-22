#!/usr/bin/env node
/**
 * QA-safe public multi-branch fixture seeder.
 *
 * Refs #1034, #1031, #976
 *
 * Supports both known storage shapes:
 * - modern: trees.title / trees.visibility + memories table
 * - legacy: trees.name / trees.is_public + trees.payload.nodes
 *
 * Safety:
 * - dry-run is default and does not require credentials
 * - schema inspection mode never mutates data
 * - execution requires owner/operator-supplied runtime values
 */

const DB_URL = process.env.LOVEBUD_FIXTURE_DB_URL;
const OWNER_ID = process.env.LOVEBUD_FIXTURE_OWNER_ID;
const EXECUTE = process.env.LOVEBUD_FIXTURE_EXECUTE === 'true';

const TREE_ID = '10340000-0000-4000-8000-000000000001';
const ROOT_ID = '10340000-0000-4000-8000-000000000101';
const LEFT_ID = '10340000-0000-4000-8000-000000000102';
const RIGHT_ID = '10340000-0000-4000-8000-000000000103';

const TREE = {
  id: TREE_ID,
  title: 'QA Safe Multi-Branch Public Fixture',
  description: 'QA-safe multi-branch fixture for Public Viewer verification.',
  stage: 'growth',
  emotionTags: ['qa', 'fixture', 'multi-branch'],
  visibility: 'public',
  memories: [
    { id: ROOT_ID, parentId: null, title: 'Seed moment', memo: 'QA-safe root moment.', tags: ['qa', 'seed'], order: 0 },
    { id: LEFT_ID, parentId: ROOT_ID, title: 'Left branch', memo: 'QA-safe left branch moment.', tags: ['qa', 'left'], order: 1 },
    { id: RIGHT_ID, parentId: ROOT_ID, title: 'Right branch', memo: 'QA-safe right branch moment.', tags: ['qa', 'right'], order: 2 },
    { id: '10340000-0000-4000-8000-000000000104', parentId: LEFT_ID, title: 'Left child', memo: 'QA-safe child under left branch.', tags: ['qa', 'left-child'], order: 3 },
    { id: '10340000-0000-4000-8000-000000000105', parentId: RIGHT_ID, title: 'Right child', memo: 'QA-safe child under right branch.', tags: ['qa', 'right-child'], order: 4 }
  ]
};

function printPlan() {
  console.log(`Fixture tree: ${TREE.title}`);
  console.log(`Execute: ${EXECUTE ? 'YES' : 'NO'}`);
  console.log(`Memory count: ${TREE.memories.length}`);
  console.log('Expected branch groups: root has 2 public children.');
  console.log(`Route after approved seed: /pages/tree.html?treeId=${TREE.id}`);
}

function validateExecutionEnv() {
  if (!DB_URL) throw new Error('LOVEBUD_FIXTURE_DB_URL is required when execution is enabled.');
  if (!OWNER_ID) throw new Error('LOVEBUD_FIXTURE_OWNER_ID is required when execution is enabled.');
}

async function tableExists(client, tableName) {
  const result = await client.query(
    `SELECT EXISTS (
       SELECT 1 FROM information_schema.tables
       WHERE table_schema = 'public' AND table_name = $1
     ) AS exists`,
    [tableName]
  );
  return Boolean(result.rows[0]?.exists);
}

async function getColumns(client, tableName) {
  const result = await client.query(
    `SELECT column_name
       FROM information_schema.columns
      WHERE table_schema = 'public' AND table_name = $1`,
    [tableName]
  );
  return new Set(result.rows.map((row) => row.column_name));
}

async function detectSchema(client) {
  const hasTrees = await tableExists(client, 'trees');
  if (!hasTrees) return 'unsupported';

  const treeColumns = await getColumns(client, 'trees');
  const hasMemories = await tableExists(client, 'memories');

  if (
    treeColumns.has('title') &&
    treeColumns.has('visibility') &&
    treeColumns.has('owner_id') &&
    hasMemories
  ) {
    const memoryColumns = await getColumns(client, 'memories');
    if (
      memoryColumns.has('tree_id') &&
      memoryColumns.has('parent_id') &&
      memoryColumns.has('visibility')
    ) {
      return 'modern';
    }
  }

  if (
    treeColumns.has('name') &&
    treeColumns.has('is_public') &&
    treeColumns.has('owner_id') &&
    treeColumns.has('payload')
  ) {
    return 'legacy';
  }

  return 'unsupported';
}

async function seedModern(client) {
  await client.query(
    `INSERT INTO trees (id, owner_id, title, visibility, created_at, updated_at)
     VALUES ($1, $2, $3, $4, NOW(), NOW())
     ON CONFLICT (id) DO UPDATE SET
       owner_id = EXCLUDED.owner_id,
       title = EXCLUDED.title,
       visibility = EXCLUDED.visibility,
       updated_at = NOW()`,
    [TREE.id, OWNER_ID, TREE.title, TREE.visibility]
  );

  for (const memory of TREE.memories) {
    await client.query(
      `INSERT INTO memories (
         id, tree_id, parent_id, title, memo, artist, source, source_url,
         source_type, thumbnail, emotion_tags, timestamp, visibility,
         created_at, updated_at
       )
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11::jsonb, $12, $13, NOW(), NOW())
       ON CONFLICT (id) DO UPDATE SET
         tree_id = EXCLUDED.tree_id,
         parent_id = EXCLUDED.parent_id,
         title = EXCLUDED.title,
         memo = EXCLUDED.memo,
         artist = EXCLUDED.artist,
         source = EXCLUDED.source,
         source_url = EXCLUDED.source_url,
         source_type = EXCLUDED.source_type,
         thumbnail = EXCLUDED.thumbnail,
         emotion_tags = EXCLUDED.emotion_tags,
         timestamp = EXCLUDED.timestamp,
         visibility = EXCLUDED.visibility,
         updated_at = NOW()`,
      [
        memory.id,
        TREE.id,
        memory.parentId,
        memory.title,
        memory.memo,
        'QA Fixture',
        'QA Fixture',
        '',
        'youtube',
        '',
        JSON.stringify(memory.tags),
        '2026-05-18',
        'public'
      ]
    );
  }
}

function legacyPayload() {
  return {
    description: TREE.description,
    stage: TREE.stage,
    emotion_tags: TREE.emotionTags,
    nodes: TREE.memories.map((memory) => ({
      id: memory.id,
      title: memory.title,
      description: memory.memo,
      timestamp: '2026-05-18',
      videoId: '',
      thumbnail: '',
      artist: 'QA Fixture',
      emotion_tags: memory.tags,
      parent_id: memory.parentId,
      order: memory.order
    }))
  };
}

async function seedLegacy(client) {
  await client.query(
    `INSERT INTO trees (id, name, is_public, owner_id, node_count, created_at, updated_at, payload)
     VALUES ($1, $2, $3, $4, $5, NOW(), NOW(), $6::jsonb)
     ON CONFLICT (id) DO UPDATE SET
       name = EXCLUDED.name,
       is_public = EXCLUDED.is_public,
       owner_id = EXCLUDED.owner_id,
       node_count = EXCLUDED.node_count,
       payload = EXCLUDED.payload,
       updated_at = NOW()`,
    [TREE.id, TREE.title, true, OWNER_ID, TREE.memories.length, JSON.stringify(legacyPayload())]
  );
}

async function seed(client, schema) {
  if (schema === 'modern') return seedModern(client);
  if (schema === 'legacy') return seedLegacy(client);
  throw new Error('Unsupported schema for public multi-branch fixture seeding.');
}

async function verifyModern(client) {
  const treeResult = await client.query(
    `SELECT COUNT(*)::int AS count FROM trees WHERE id = $1 AND visibility = 'public'`,
    [TREE.id]
  );
  const memoryResult = await client.query(
    `SELECT COUNT(*)::int AS count FROM memories WHERE tree_id = $1 AND visibility = 'public'`,
    [TREE.id]
  );
  const branchResult = await client.query(
    `SELECT COUNT(*)::int AS count
       FROM (
         SELECT parent_id
         FROM memories
         WHERE tree_id = $1 AND visibility = 'public' AND parent_id IS NOT NULL
         GROUP BY parent_id
         HAVING COUNT(*) >= 2
       ) branch_groups`,
    [TREE.id]
  );
  return {
    treeCount: treeResult.rows[0].count,
    memoryCount: memoryResult.rows[0].count,
    branchGroupCount: branchResult.rows[0].count
  };
}

async function verifyLegacy(client) {
  const result = await client.query(
    `SELECT payload FROM trees WHERE id = $1 AND is_public = true`,
    [TREE.id]
  );
  const payload = result.rows[0]?.payload || {};
  const nodes = Array.isArray(payload.nodes) ? payload.nodes : [];
  const childCounts = new Map();
  for (const node of nodes) {
    if (!node.parent_id) continue;
    childCounts.set(node.parent_id, (childCounts.get(node.parent_id) || 0) + 1);
  }
  const branchGroupCount = Array.from(childCounts.values()).filter((count) => count >= 2).length;
  return {
    treeCount: result.rowCount,
    memoryCount: nodes.length,
    branchGroupCount
  };
}

async function verify(client, schema) {
  if (schema === 'modern') return verifyModern(client);
  if (schema === 'legacy') return verifyLegacy(client);
  throw new Error('Unsupported schema for fixture verification.');
}

async function main() {
  printPlan();

  if (!EXECUTE) {
    console.log('Dry-run only. No database connection or mutation performed.');
    return;
  }

  validateExecutionEnv();

  const { Pool } = require('pg');
  const pool = new Pool({ connectionString: DB_URL, ssl: { rejectUnauthorized: false } });
  const client = await pool.connect();
  try {
    const schema = await detectSchema(client);
    console.log(`Detected schema: ${schema}`);
    if (schema === 'unsupported') {
      throw new Error('Unsupported DB schema. No fixture mutation performed.');
    }

    await client.query('BEGIN');
    await seed(client, schema);
    const result = await verify(client, schema);
    await client.query('COMMIT');

    console.log(`Tree count: ${result.treeCount}`);
    console.log(`Memory count: ${result.memoryCount}`);
    console.log(`Multi-branch parent groups: ${result.branchGroupCount}`);
    console.log(`Route: /pages/tree.html?treeId=${TREE.id}`);
  } catch (error) {
    try {
      await client.query('ROLLBACK');
    } catch (_) {
      // No active transaction may exist if schema detection failed before BEGIN.
    }
    throw error;
  } finally {
    client.release();
    await pool.end();
  }
}

main().catch((error) => {
  console.error(error.message || error);
  process.exit(1);
});
