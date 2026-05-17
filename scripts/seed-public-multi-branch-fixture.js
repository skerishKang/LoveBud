#!/usr/bin/env node
/**
 * QA-safe public multi-branch fixture seeder.
 *
 * Refs #1034, #1031, #976
 *
 * This script matches the current runtime read path:
 * - public trees are read from trees.visibility
 * - public moments are read from memories.visibility and memories.parent_id
 *
 * Safety:
 * - dry-run is default
 * - no credentials are stored here
 * - owner/operator must provide the runtime owner id through env
 */

const { Pool } = require('pg');

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
  visibility: 'public',
  memories: [
    { id: ROOT_ID, parentId: null, title: 'Seed moment', memo: 'QA-safe root moment.', tags: ['qa', 'seed'] },
    { id: LEFT_ID, parentId: ROOT_ID, title: 'Left branch', memo: 'QA-safe left branch moment.', tags: ['qa', 'left'] },
    { id: RIGHT_ID, parentId: ROOT_ID, title: 'Right branch', memo: 'QA-safe right branch moment.', tags: ['qa', 'right'] },
    { id: '10340000-0000-4000-8000-000000000104', parentId: LEFT_ID, title: 'Left child', memo: 'QA-safe child under left branch.', tags: ['qa', 'left-child'] },
    { id: '10340000-0000-4000-8000-000000000105', parentId: RIGHT_ID, title: 'Right child', memo: 'QA-safe child under right branch.', tags: ['qa', 'right-child'] }
  ]
};

function validateEnv() {
  if (!DB_URL) throw new Error('LOVEBUD_FIXTURE_DB_URL is required.');
  if (!OWNER_ID) throw new Error('LOVEBUD_FIXTURE_OWNER_ID is required.');
}

async function seed(client) {
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

async function verify(client) {
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

async function main() {
  validateEnv();
  console.log(`Fixture tree: ${TREE.title}`);
  console.log(`Execute: ${EXECUTE ? 'YES' : 'NO'}`);

  if (!EXECUTE) {
    console.log('Dry-run only. Set LOVEBUD_FIXTURE_EXECUTE=true to mutate an approved test DB.');
    return;
  }

  const pool = new Pool({ connectionString: DB_URL, ssl: { rejectUnauthorized: false } });
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    await seed(client);
    const result = await verify(client);
    await client.query('COMMIT');
    console.log(`Tree count: ${result.treeCount}`);
    console.log(`Memory count: ${result.memoryCount}`);
    console.log(`Multi-branch parent groups: ${result.branchGroupCount}`);
    console.log(`Route: /pages/tree.html?treeId=${TREE.id}`);
  } catch (error) {
    await client.query('ROLLBACK');
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
