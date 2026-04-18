/**
 * LoveBud - Document Store
 *
 * ADAPTED for production schema v1 (001_initial_schema.sql):
 *   trees: id, owner_id, title, visibility, created_at, updated_at
 *   memories: id, tree_id, parent_id, title, memo, artist, source, source_url,
 *              source_type, thumbnail, emotion_tags, timestamp, visibility,
 *              created_at, updated_at
 *
 * This matches the ACTUAL production schema (no payload, no name columns).
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
    data: {
      id: row.id,
      owner_id: row.owner_id,
      title: row.title,
      visibility: row.visibility,
      created_at: row.created_at,
      updated_at: row.updated_at,
    }
  };
}

const getTreeById = getTree;

async function deleteTree(treeId) {
  await query('DELETE FROM trees WHERE id = $1', [treeId]);
}

async function queryTrees(filters = {}) {
  console.log('[queryTrees] start', { filters });
  const p = [], w = [];
  if (filters.ownerId) { p.push(filters.ownerId); w.push(`owner_id = $${p.length}`); }
  if (filters.visibility) { p.push(filters.visibility); w.push(`visibility = $${p.length}`); }
  
  let sql = `SELECT id, owner_id, title, visibility, created_at, updated_at FROM trees`;
  if (w.length) sql += ` WHERE ${w.join(' AND ')}`;
  sql += ' ORDER BY created_at DESC';
  if (filters.limit) { p.push(Number(filters.limit)); sql += ` LIMIT $${p.length}`; }
  
  try {
    console.log('[queryTrees] executing SQL', { sql: sql.substring(0, 100), paramCount: p.length });
    const r = await query(sql, p);
    console.log('[queryTrees] success', { count: r.rows.length });
    return r.rows.map(row => ({
      id: row.id,
      data: {
        id: row.id,
        owner_id: row.owner_id,
        title: row.title,
        visibility: row.visibility,
        created_at: row.created_at,
        updated_at: row.updated_at,
      }
    }));
  } catch (err) {
    console.error('[queryTrees] failed', { error: err.message, code: err.code, stack: err.stack?.substring(0, 200) });
    throw err;
  }
}

async function createTree(data) {
  console.log('[createTree] start', { ownerId: data.ownerId, title: data.title, visibility: data.visibility });
  
  // Auto-provision user if not exists (lazy provisioning for new sign-ups).
  try {
    console.log('[createTree] ensuring user row', { ownerId: data.ownerId });
    await query(
      `INSERT INTO users (id, created_at, updated_at) VALUES ($1, NOW(), NOW())
       ON CONFLICT (id) DO NOTHING`,
      [data.ownerId]
    );
    console.log('[createTree] user row ensured');
  } catch (userErr) {
    console.error('[createTree] user provisioning failed', { 
      error: userErr.message, 
      code: userErr.code,
      stack: userErr.stack?.substring(0, 200)
    });
    throw userErr;
  }

  const id = require('crypto').randomUUID();
  
  try {
    console.log('[createTree] inserting tree', { id, ownerId: data.ownerId });
    const r = await query(
      `INSERT INTO trees (id, owner_id, title, visibility, created_at, updated_at)
       VALUES ($1, $2, $3, $4, NOW(), NOW())
       RETURNING id, owner_id, title, visibility, created_at, updated_at`,
      [id, data.ownerId, data.title || '나의 Lovetree', data.visibility || 'private']
    );
    const row = r.rows[0];
    console.log('[createTree] tree inserted successfully', { treeId: row.id });
    return {
      id: row.id,
      data: {
        id: row.id,
        owner_id: row.owner_id,
        title: row.title,
        visibility: row.visibility,
        created_at: row.created_at,
        updated_at: row.updated_at,
      }
    };
  } catch (treeErr) {
    console.error('[createTree] tree insert failed', {
      error: treeErr.message,
      code: treeErr.code,
      detail: treeErr.detail,
      stack: treeErr.stack?.substring(0, 200)
    });
    throw treeErr;
  }
}

async function updateTree(treeId, patch) {
  const f = [], p = [];
  if (patch.title !== undefined) { p.push(patch.title); f.push(`title = $${p.length}`); }
  if (patch.visibility !== undefined) { p.push(patch.visibility); f.push(`visibility = $${p.length}`); }
  if (!f.length) return getTree(treeId);
  p.push(treeId);
  f.push('updated_at = NOW()');
  const r = await query(
    `UPDATE trees SET ${f.join(', ')} WHERE id = $${p.length} RETURNING id, owner_id, title, visibility, created_at, updated_at`,
    p
  );
  if (!r.rows.length) return null;
  const row = r.rows[0];
  return {
    id: row.id,
    data: {
      id: row.id,
      owner_id: row.owner_id,
      title: row.title,
      visibility: row.visibility,
      created_at: row.created_at,
      updated_at: row.updated_at,
    }
  };
}

// ── Memories (separate table) ────────────────────────────────────────────

async function getMemory(memoryId) {
  const r = await query(
    `SELECT id, tree_id, parent_id, title, memo, artist, source, source_url, source_type,
            thumbnail, emotion_tags, timestamp, visibility, created_at, updated_at
     FROM memories WHERE id = $1`,
    [memoryId]
  );
  if (!r.rows.length) return null;
  const row = r.rows[0];
  return {
    id: row.id,
    data: {
      id: row.id,
      tree_id: row.tree_id,
      parent_id: row.parent_id,
      title: row.title,
      memo: row.memo,
      artist: row.artist,
      source: row.source,
      source_url: row.source_url,
      source_type: row.source_type,
      thumbnail: row.thumbnail,
      emotion_tags: row.emotion_tags,
      timestamp: row.timestamp,
      visibility: row.visibility,
      created_at: row.created_at,
      updated_at: row.updated_at,
    }
  };
}

async function queryMemories(filters = {}) {
  const p = [], w = [];
  
  if (filters.treeId) { p.push(filters.treeId); w.push(`tree_id = $${p.length}`); }
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
  
  try {
    console.log('[queryMemories] executing SQL', { sql: sql.substring(0, 100), paramCount: p.length });
    const r = await query(sql, p);
    console.log('[queryMemories] success', { count: r.rows.length });
    return r.rows.map(row => ({
      id: row.id,
      data: {
        id: row.id,
        tree_id: row.tree_id,
        parent_id: row.parent_id,
        title: row.title,
        memo: row.memo,
        artist: row.artist,
        source: row.source,
        source_url: row.source_url,
        source_type: row.source_type,
        thumbnail: row.thumbnail,
        emotion_tags: row.emotion_tags,
        timestamp: row.timestamp,
        visibility: row.visibility,
        created_at: row.created_at,
        updated_at: row.updated_at,
      }
    }));
  } catch (err) {
    console.error('[queryMemories] failed', { error: err.message, code: err.code, stack: err.stack?.substring(0, 200) });
    throw err;
  }
}

async function createMemory(data) {
  const id = require('crypto').randomUUID();
  const tree = await getTree(data.treeId);
  if (!tree) throw httpError(404, 'Tree not found');
  
  try {
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
        data.sourceUrl || data.source_url || '',
        data.sourceType || data.source_type || 'youtube',
        data.thumbnail || '',
        JSON.stringify(data.emotionTags || data.emotion_tags || []),
        data.timestamp || '',
        data.visibility || 'private'
      ]
    );
    const row = r.rows[0];
    return {
      id: row.id,
      data: {
        id: row.id,
        tree_id: row.tree_id,
        parent_id: row.parent_id,
        title: row.title,
        memo: row.memo,
        artist: row.artist,
        source: row.source,
        source_url: row.source_url,
        source_type: row.source_type,
        thumbnail: row.thumbnail,
        emotion_tags: row.emotion_tags,
        timestamp: row.timestamp,
        visibility: row.visibility,
        created_at: row.created_at,
        updated_at: row.updated_at,
      }
    };
  } catch (err) {
    console.error('[createMemory] failed', { error: err.message, code: err.code, stack: err.stack?.substring(0, 200) });
    throw err;
  }
}

async function updateMemory(memoryId, patch) {
  const f = [], p = [];
  const fieldMap = {
    title: 'title',
    memo: 'memo',
    artist: 'artist',
    source: 'source',
    sourceUrl: 'source_url',
    sourceType: 'source_type',
    thumbnail: 'thumbnail',
    emotionTags: 'emotion_tags',
    timestamp: 'timestamp',
    visibility: 'visibility'
  };
  
  Object.keys(patch).forEach(k => {
    const col = fieldMap[k];
    if (col) {
      p.push(k === 'emotionTags' ? JSON.stringify(patch[k]) : patch[k]);
      f.push(`${col} = $${p.length}`);
    }
  });
  
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
  if (!r.rows.length) return null;
  const row = r.rows[0];
  return {
    id: row.id,
    data: {
      id: row.id,
      tree_id: row.tree_id,
      parent_id: row.parent_id,
      title: row.title,
      memo: row.memo,
      artist: row.artist,
      source: row.source,
      source_url: row.source_url,
      source_type: row.source_type,
      thumbnail: row.thumbnail,
      emotion_tags: row.emotion_tags,
      timestamp: row.timestamp,
      visibility: row.visibility,
      created_at: row.created_at,
      updated_at: row.updated_at,
    }
  };
}

async function deleteMemory(memoryId) {
  const r = await query(
    `DELETE FROM memories WHERE id = $1 RETURNING id, tree_id`,
    [memoryId]
  );
  if (!r.rows.length) return null;
  return {
    deleted: true,
    id: r.rows[0].id,
    treeId: r.rows[0].tree_id,
  };
}

module.exports = {
  getTree, getTreeById, queryTrees, createTree, updateTree, deleteTree,
  getMemory, queryMemories, createMemory, updateMemory, deleteMemory,
  validateRequired, validateOptionalString, validateVisibility,
  validateSourceType, validateUuid, validateLimit
};