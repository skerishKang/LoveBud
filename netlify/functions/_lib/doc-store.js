/**
 * netlify/functions/_lib/doc-store.js
 * 
 * Re-implemented for Document-based storage with defensive normalization.
 */

const { query } = require('./db');
const { httpError } = require('./http');

// ── Validation Helpers ──────────────────────────────────────────────────────

const VISIBILITY_VALUES = ['public', 'private'];

function validateRequired(v, n) {
  if (v === undefined || v === null) throw httpError(400, `${n} is required`);
  return v;
}
function validateOptionalString(v, max = 5000) {
  if (typeof v !== 'string') return '';
  return v.trim().substring(0, max);
}
function validateVisibility(v, def = 'private') {
  return VISIBILITY_VALUES.includes(v) ? v : def;
}
function validateSourceType(v, def = 'youtube') {
  return v || def;
}
function validateUuid(v, n) {
  return v;
}
function validateLimit(v, def = 20) {
  const n = parseInt(v);
  return isNaN(n) ? def : n;
}

// ── Users ──────────────────────────────────────────────────────────────────

async function ensureUserRecord(user) {
  if (!user || !user.uid) return;
  const r = await query('SELECT id FROM users WHERE id = $1', [user.uid]);
  if (!r.rows.length) {
    const dispName = user.displayName || (user.decoded && user.decoded.name) || '';
    console.log('[doc-store] Syncing new user:', user.uid);
    try {
      await query(
        `INSERT INTO users (id, email, display_name, created_at, updated_at)
         VALUES ($1, $2, $3, NOW(), NOW())`,
        [user.uid, user.email || '', dispName]
      );
    } catch (err) {
      console.error('[doc-store] Sync users table failed:', err.message);
      // We don't throw here to avoid blocking completely if user record exists but SELECT failed
    }
  }
}

// ── Trees ──────────────────────────────────────────────────────────────────

async function getTree(treeId) {
  if (!treeId) return null;
  const r = await query(`SELECT * FROM trees WHERE id = $1`, [treeId]);
  return r.rows[0] || null;
}

async function queryTrees(filters = {}) {
  const p = [], w = [];
  if (filters.ownerId) { p.push(filters.ownerId); w.push(`owner_id = $${p.length}`); }
  if (filters.visibility) { p.push(filters.visibility === 'public'); w.push(`is_public = $${p.length}`); }
  
  let sql = `SELECT * FROM trees`;
  if (w.length) sql += ` WHERE ${w.join(' AND ')}`;
  sql += ' ORDER BY created_at DESC';
  if (filters.limit) { p.push(Number(filters.limit)); sql += ` LIMIT $${p.length}`; }
  
  const r = await query(sql, p);
  return r.rows;
}

async function createTree(data, user = null) {
  if (user) await ensureUserRecord(user);
  
  const id = require('crypto').randomUUID();
  const payload = { nodes: [], edges: [] };
  try {
    console.log('[doc-store] INSERT trees:', { ownerId: data.ownerId, title: safeTitle });
    const r = await query(
      `INSERT INTO trees (id, owner_id, name, is_public, payload, node_count, created_at, updated_at)
       VALUES ($1, $2, $3, $4, $5, 0, NOW(), NOW()) RETURNING *`,
      [id, data.ownerId, safeTitle, data.visibility === 'public', JSON.stringify(payload)]
    );
    return r.rows[0];
  } catch (err) {
    console.error('[doc-store] createTree SQL failed:', err.message, err.stack);
    throw err;
  }
}

async function updateTree(treeId, patch) {
  const f = [], p = [];
  if (patch.title !== undefined) { p.push(patch.title); f.push(`name = $${p.length}`); }
  if (patch.visibility !== undefined) { p.push(patch.visibility === 'public'); f.push(`is_public = $${p.length}`); }
  if (!f.length) return getTree(treeId);
  
  p.push(treeId);
  f.push('updated_at = NOW()');
  const r = await query(`UPDATE trees SET ${f.join(', ')} WHERE id = $${p.length} RETURNING *`, p);
  return r.rows[0];
}

async function deleteTree(treeId) {
  await query('DELETE FROM trees WHERE id = $1', [treeId]);
}

// ── Memories (Embedded in trees.payload) ───────────────────────────────────

function normalizePayload(payload) {
  let p = payload;
  if (typeof p === 'string') {
    try { p = JSON.parse(p); } catch (e) { p = null; }
  }
  if (!p || typeof p !== 'object' || Array.isArray(p)) p = { nodes: [], edges: [] };
  if (!Array.isArray(p.nodes)) p.nodes = [];
  if (!Array.isArray(p.edges)) p.edges = [];
  return p;
}

async function queryMemories(filters = {}) {
  const treeId = typeof filters === 'object' ? filters.treeId : filters;
  
  // Final Safety Fix: Return empty list if treeId is missing
  if (!treeId) return [];

  const tree = await getTree(treeId);
  const p = normalizePayload(tree?.payload);
  let nodes = p.nodes.map(n => ({ ...n, treeId }));
  
  if (filters.parentId !== undefined) {
    nodes = nodes.filter(n => n.parentId === (filters.parentId === 'null' ? null : filters.parentId));
  }
  return nodes;
}

async function getMemory(memoryId, treeId = null) {
  if (treeId) {
    const list = await queryMemories({ treeId });
    return list.find(m => m.id === memoryId) || null;
  }
  const r = await query(`SELECT id, payload FROM trees WHERE payload->'nodes' @> $1 LIMIT 1`, [JSON.stringify([{id: memoryId}])]);
  if (!r.rows.length) return null;
  const p = normalizePayload(r.rows[0].payload);
  const node = p.nodes.find(n => n.id === memoryId);
  return node ? { ...node, treeId: r.rows[0].id } : null;
}

async function createMemory(data) {
  const tree = await getTree(data.treeId);
  if (!tree) throw httpError(404, 'Tree not found');

  const newNode = {
    id: require('crypto').randomUUID(),
    parentId: data.parentId || null,
    title: data.title || '',
    description: data.memo || '',
    thumbnail: data.thumbnail || '',
    timestamp: data.timestamp || new Date().toISOString().slice(0, 10),
    emotionTags: data.emotionTags || [],
    createdAt: new Date().toISOString()
  };

  const p = normalizePayload(tree.payload);
  p.nodes.push(newNode);

  await query(
    `UPDATE trees SET payload = $1, node_count = COALESCE(node_count, 0) + 1, updated_at = NOW() WHERE id = $2`,
    [JSON.stringify(p), data.treeId]
  );
  return { ...newNode, treeId: data.treeId };
}

async function updateMemory(memoryId, patch) {
  const treeRec = await query(`SELECT id, payload FROM trees WHERE payload->'nodes' @> $1 LIMIT 1`, [JSON.stringify([{id: memoryId}])]);
  if (!treeRec.rows.length) return null;

  const { id: treeId, payload } = treeRec.rows[0];
  const p = normalizePayload(payload);
  const idx = p.nodes.findIndex(n => n.id === memoryId);
  if (idx === -1) return null;

  if (patch.memo !== undefined) { patch.description = patch.memo; delete patch.memo; }
  p.nodes[idx] = { ...p.nodes[idx], ...patch, updatedAt: new Date().toISOString() };

  await query(`UPDATE trees SET payload = $1, updated_at = NOW() WHERE id = $2`, [JSON.stringify(p), treeId]);
  return { ...p.nodes[idx], treeId };
}

async function deleteMemory(memoryId) {
  const treeRec = await query(`SELECT id, payload, node_count FROM trees WHERE payload->'nodes' @> $1 LIMIT 1`, [JSON.stringify([{id: memoryId}])]);
  if (!treeRec.rows.length) return null;

  const { id: treeId, payload } = treeRec.rows[0];
  const p = normalizePayload(payload);
  p.nodes = p.nodes.filter(n => n.id !== memoryId);

  await query(
    `UPDATE trees SET payload = $1, node_count = GREATEST(0, COALESCE(node_count, 0) - 1), updated_at = NOW() WHERE id = $2`,
    [JSON.stringify(p), treeId]
  );
  return { id: memoryId, treeId };
}

module.exports = {
  getTree, getTreeById: getTree, queryTrees, createTree, updateTree, deleteTree,
  getMemory, queryMemories, createMemory, updateMemory, deleteMemory,
  ensureUserRecord,
  validateRequired, validateOptionalString, validateVisibility, validateSourceType, validateUuid, validateLimit
};