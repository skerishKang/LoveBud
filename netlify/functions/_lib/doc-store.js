/**
 * LoveBud - Document Store
 *
 * PRODUCTION SCHEMA v1 (001_initial_schema.sql):
 *   trees: id, owner_id, title, visibility, created_at, updated_at
 *   memories: id, tree_id, parent_id, title, memo, artist, source, source_url,
 *              source_type, thumbnail, emotion_tags, timestamp, visibility,
 *              created_at, updated_at
 */

const { query } = require('./db');
const { httpError } = require('./http');

// ── Validation ────────────────────────────────────────────────────────────

const VISIBILITY_VALUES = ['public', 'private'];
const SOURCE_TYPE_VALUES = ['youtube', 'soundcloud', 'bandcamp', 'spotify', 'apple', 'other'];

function validateRequired(v, n) {
  if (v === undefined || v === null || typeof v !== 'string') throw httpError(400, `${n} is required`);
  if (v.trim().length === 0) throw httpError(400, `${n} cannot be empty`);
  return v.trim();
}
function validateOptionalString(v, max = 5000) {
  if (v === undefined || v === null) return '';
  if (typeof v !== 'string') return '';
  const t = v.trim();
  if (t.length > max) throw httpError(400, `Field exceeds max ${max}`);
  return t;
}
function validateVisibility(v, def = 'private') {
  if (v === undefined || v === null) return def;
  if (!VISIBILITY_VALUES.includes(v)) throw httpError(400, `visibility: ${VISIBILITY_VALUES.join(', ')}`);
  return v;
}
function validateSourceType(v, def = 'youtube') {
  if (v === undefined || v === null) return def;
  if (!SOURCE_TYPE_VALUES.includes(v)) throw httpError(400, `sourceType: ${SOURCE_TYPE_VALUES.join(', ')}`);
  return v;
}
function validateUuid(v, n) {
  const re = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  if (!v || typeof v !== 'string' || !re.test(v)) throw httpError(400, `Invalid ${n}`);
  return v;
}
function validateLimit(v, def = 20, max = 100) {
  if (!v) return def;
  const n = Number(v);
  if (isNaN(n) || n < 1) return def;
  return Math.min(n, max);
}

// ── Trees ──────────────────────────────────────────────────────────────────

async function getTree(treeId) {
  const r = await query(
    `SELECT id, owner_id, title, visibility, created_at, updated_at
     FROM trees WHERE id = $1`,
    [treeId]
  );
  if (!r.rows.length) return null;
  const row = r.rows[0];
  return {
    id: row.id,
    owner_id: row.owner_id,
    title: row.title,
    visibility: row.visibility,
    created_at: row.created_at,
    updated_at: row.updated_at,
  };
}

async function queryTrees(filters = {}) {
  const p = [];
  const w = [];

  if (filters.ownerId) {
    p.push(filters.ownerId);
    w.push(`owner_id = $${p.length}`);
  }

  if (filters.visibility) {
    p.push(filters.visibility);
    w.push(`visibility = $${p.length}`);
  }

  let sql = `
    SELECT id, owner_id, title, visibility, created_at, updated_at
    FROM trees
  `;

  if (w.length) {
    sql += ` WHERE ${w.join(' AND ')}`;
  }

  sql += ' ORDER BY created_at DESC';

  if (filters.limit) {
    p.push(Number(filters.limit));
    sql += ` LIMIT $${p.length}`;
  }

  try {
    const r = await query(sql, p);
    return r.rows;
  } catch (e) {
    const schema = await query(`
      SELECT column_name
      FROM information_schema.columns
      WHERE table_name = 'trees'
      ORDER BY ordinal_position
    `);
    console.error('Query failed. Current schema:', schema.rows);
    throw e;
  }
}

async function createTree(data) {
  const id = require('crypto').randomUUID();
  const title = data.title || '나의 Lovetree';
  const visibility = data.visibility || 'private';
  
  const r = await query(
    `INSERT INTO trees (id, owner_id, title, visibility, created_at, updated_at)
     VALUES ($1, $2, $3, $4, NOW(), NOW())
     RETURNING id, owner_id, title, visibility, created_at, updated_at`,
    [id, data.ownerId, title, visibility]
  );
  return r.rows[0];
}

async function updateTree(treeId, patch) {
  const f = [], p = [];
  if (patch.title !== undefined) { p.push(patch.title); f.push(`title = $${p.length}`); }
  if (patch.visibility !== undefined) { p.push(patch.visibility); f.push(`visibility = $${p.length}`); }
  if (!f.length) return getTree(treeId);
  p.push(treeId);
  f.push('updated_at = NOW()');
  
  const r = await query(
    `UPDATE trees SET ${f.join(', ')} WHERE id = $${p.length}
     RETURNING id, owner_id, title, visibility, created_at, updated_at`,
    p
  );
  return r.rows[0] || null;
}

async function deleteTree(treeId) {
  await query('DELETE FROM trees WHERE id = $1', [treeId]);
}

// ── Memories ────────────────────────────────────────────────────────────

async function getMemory(memoryId) {
  const r = await query(
    `SELECT id, tree_id, parent_id, title, memo, artist, source, source_url, source_type,
            thumbnail, emotion_tags, timestamp, visibility, created_at, updated_at
     FROM memories WHERE id = $1`,
    [memoryId]
  );
  return r.rows[0] || null;
}

async function queryMemories(filters = {}) {
  const p = [], w = [];

  if (Array.isArray(filters.treeIds)) {
    if (filters.treeIds.length === 0) {
      return [];
    }
    p.push(filters.treeIds);
    w.push(`tree_id = ANY($${p.length})`);
  } else if (filters.treeId) {
    p.push(filters.treeId);
    w.push(`tree_id = $${p.length}`);
  }
  if (filters.parentId !== undefined) {
    if (filters.parentId === null) {
      w.push(`parent_id IS NULL`);
    } else {
      p.push(filters.parentId); w.push(`parent_id = $${p.length}`);
    }
  }
  if (filters.visibility) { p.push(filters.visibility); w.push(`visibility = $${p.length}`); }

  let sql = `SELECT id, tree_id, parent_id, title, memo, artist, source, source_url,
                    source_type, thumbnail, emotion_tags, timestamp, visibility,
                    created_at, updated_at
             FROM memories`;
  if (w.length) sql += ` WHERE ${w.join(' AND ')}`;
  sql += ' ORDER BY created_at DESC';
  if (filters.limit) { p.push(Number(filters.limit)); sql += ` LIMIT $${p.length}`; }

  const r = await query(sql, p);
  return r.rows;
}

async function createMemory(data) {
  const id = require('crypto').randomUUID();
  
  const r = await query(
    `INSERT INTO memories (id, tree_id, parent_id, title, memo, artist, source, source_url,
                           source_type, thumbnail, emotion_tags, timestamp, visibility,
                           created_at, updated_at)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, NOW(), NOW())
     RETURNING id, tree_id, parent_id, title, memo, artist, source, source_url,
               source_type, thumbnail, emotion_tags, timestamp, visibility,
               created_at, updated_at`,
     [
       id,
       data.treeId,
       data.parentId || null,
       data.title || '',
       data.memo || '',
       data.artist || '',
       data.source || '',
       data.sourceUrl || '',
       data.sourceType || 'youtube',
       data.thumbnail || '',
       JSON.stringify(data.emotionTags || []),
       data.timestamp || '',
       data.visibility || 'private'
     ]
  );
  return r.rows[0];
}

async function updateMemory(memoryId, patch) {
  const f = [], p = [];
  
  if (patch.title !== undefined) { p.push(patch.title); f.push(`title = $${p.length}`); }
  if (patch.memo !== undefined) { p.push(patch.memo); f.push(`memo = $${p.length}`); }
  if (patch.artist !== undefined) { p.push(patch.artist); f.push(`artist = $${p.length}`); }
  if (patch.source !== undefined) { p.push(patch.source); f.push(`source = $${p.length}`); }
  if (patch.sourceUrl !== undefined) { p.push(patch.sourceUrl); f.push(`source_url = $${p.length}`); }
  if (patch.sourceType !== undefined) { p.push(patch.sourceType); f.push(`source_type = $${p.length}`); }
  if (patch.thumbnail !== undefined) { p.push(patch.thumbnail); f.push(`thumbnail = $${p.length}`); }
  if (patch.timestamp !== undefined) { p.push(patch.timestamp); f.push(`timestamp = $${p.length}`); }
  if (patch.visibility !== undefined) { p.push(patch.visibility); f.push(`visibility = $${p.length}`); }
  if (patch.parentId !== undefined) { p.push(patch.parentId); f.push(`parent_id = $${p.length}`); }
  if (patch.emotionTags !== undefined) { p.push(JSON.stringify(patch.emotionTags)); f.push(`emotion_tags = $${p.length}`); }
   
  if (!f.length) return getMemory(memoryId);
  p.push(memoryId);
  f.push('updated_at = NOW()');
   
  const r = await query(
    `UPDATE memories SET ${f.join(', ')} WHERE id = $${p.length}
     RETURNING id, tree_id, parent_id, title, memo, artist, source, source_url,
             source_type, thumbnail, emotion_tags, timestamp, visibility,
             created_at, updated_at`,
     p
   );
  return r.rows[0] || null;
}

async function deleteMemory(memoryId) {
  const r = await query(
    `DELETE FROM memories WHERE id = $1 RETURNING id`,
    [memoryId]
  );
  return r.rows.length > 0;
}

module.exports = {
  getTree, queryTrees, createTree, updateTree, deleteTree,
  getMemory, queryMemories, createMemory, updateMemory, deleteMemory,
  validateRequired, validateOptionalString, validateVisibility,
  validateSourceType, validateUuid, validateLimit
};
