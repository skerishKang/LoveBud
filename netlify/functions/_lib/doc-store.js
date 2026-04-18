/**
 * LoveBud - Document Store
 *
 * Canonical model: trees.payload.nodes (JSONB) stores memories as nested nodes.
 * The `memories` table (001_initial_schema.sql) is legacy — do not use.
 *
 * trees table schema (after 002_add_payload_columns migration):
 *   id, owner_id, name, is_public (bool), node_count (int),
 *   payload (JSONB — {"nodes": [...]}), title (compat), visibility (compat),
 *   created_at, updated_at
 *
 * doc-store.js reads/writes: name, is_public, node_count, payload
 * title/visibility columns are kept for backward compatibility with seed data.
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

// ── Payload helpers ─────────────────────────────────────────────────────────

// tree.data 에 섞여 있는 tree 메타 필드를 제거하고 payload 성격의 값만 남긴다.
// nodes는 별도로 주입하므로 여기서는 제외해도 되고, 남아 있어도 overwrite 된다.
function extractPayloadOnly(treeLike) {
  const source = treeLike?.data || treeLike || {};
  const payload = { ...source };

  delete payload.id;
  delete payload.owner_id;
  delete payload.ownerId;
  delete payload.title;
  delete payload.name;
  delete payload.visibility;
  delete payload.is_public;
  delete payload.created_at;
  delete payload.createdAt;
  delete payload.updated_at;
  delete payload.updatedAt;
  delete payload.node_count;
  delete payload.nodeCount;

  return payload;
}

// ── Trees ──────────────────────────────────────────────────────────────────

async function getTree(treeId) {
  const r = await query(
    `SELECT id, owner_id, name as title, is_public as visibility, created_at, updated_at, payload
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
      visibility: row.visibility ? 'public' : 'private',
      created_at: row.created_at,
      updated_at: row.updated_at,
      ...(row.payload || {})
    }
  };
}

// Alias for compatibility
const getTreeById = getTree;

async function deleteTree(treeId) {
  await query('DELETE FROM trees WHERE id = $1', [treeId]);
}

async function queryTrees(filters = {}) {
  const p = [], w = [];
  if (filters.ownerId) { p.push(filters.ownerId); w.push(`owner_id = $${p.length}`); }
  if (filters.visibility) {
    const pub = filters.visibility === 'public';
    p.push(pub);
    w.push(`is_public = $${p.length}`);
  }
  let sql = `SELECT id, owner_id, name as title, is_public as visibility, created_at, updated_at, payload FROM trees`;
  if (w.length) sql += ` WHERE ${w.join(' AND ')}`;
  sql += ' ORDER BY created_at DESC';
  if (filters.limit) { p.push(Number(filters.limit)); sql += ` LIMIT $${p.length}`; }
  const r = await query(sql, p);
  return r.rows.map(row => ({
    id: row.id,
    data: { id: row.id, owner_id: row.owner_id, title: row.title, visibility: row.visibility ? 'public' : 'private', created_at: row.created_at, updated_at: row.updated_at, ...(row.payload || {}) }
  }));
}

async function createTree(data) {
  const id = require('crypto').randomUUID();
  const isPublic = data.visibility === 'public';
  const r = await query(
    `INSERT INTO trees (id, owner_id, name, is_public, node_count, created_at, updated_at, payload)
     VALUES ($1,$2,$3,$4,0,NOW(),NOW(),$5)
     RETURNING id, owner_id, name as title, is_public as visibility, created_at, updated_at, payload`,
    [id, data.ownerId, data.title || '나의 Lovetree', isPublic, JSON.stringify({})]
  );
  const row = r.rows[0];
  return { id: row.id, data: { id: row.id, owner_id: row.owner_id, title: row.title, visibility: row.visibility ? 'public' : 'private', created_at: row.created_at, updated_at: row.updated_at, ...(row.payload || {}) } };
}

async function updateTree(treeId, patch) {
  const f = [], p = [];
  if (patch.title !== undefined) { p.push(patch.title); f.push(`name = $${p.length}`); }
  if (patch.visibility !== undefined) { p.push(patch.visibility === 'public'); f.push(`is_public = $${p.length}`); }
  if (!f.length) return getTree(treeId);
  p.push(treeId);
  f.push('updated_at = NOW()');
  const r = await query(
    `UPDATE trees SET ${f.join(', ')} WHERE id = $${p.length} RETURNING id, owner_id, name as title, is_public as visibility, created_at, updated_at, payload`,
    p
  );
  if (!r.rows.length) return null;
  const row = r.rows[0];
  return { id: row.id, data: { id: row.id, owner_id: row.owner_id, title: row.title, visibility: row.visibility ? 'public' : 'private', created_at: row.created_at, updated_at: row.updated_at, ...(row.payload || {}) } };
}

// ── Memories (payload.nodes) ───────────────────────────────────────────────

async function getMemory(memoryId) {
  const r = await query('SELECT id, payload FROM trees');
  for (const row of r.rows) {
    const nodes = Array.isArray(row.payload?.nodes) ? row.payload.nodes : [];
    const found = nodes.find(n => n.id === memoryId);
    if (found) {
      return {
        id: found.id,
        data: {
          id: found.id, tree_id: row.id, parent_id: found.parentId || null,
          title: found.title || '', memo: found.description || found.memo || '',
          artist: found.artist || '', source: found.source || '',
          source_url: found.sourceUrl || found.source_url || '',
          source_type: found.sourceType || found.source_type || 'youtube',
          thumbnail: found.thumbnail || '',
          emotion_tags: found.emotion_tags || found.emotionTags || [],
          timestamp: found.timestamp || '',
          visibility: found.visibility || 'public',
          created_at: found.createdAt || new Date().toISOString(),
          updated_at: found.updatedAt || new Date().toISOString()
        }
      };
    }
  }
  return null;
}

async function queryMemories(filters = {}) {
  let collected = [];

  if (filters.treeId) {
    const tree = await getTree(filters.treeId);
    if (!tree) return [];
    const nodes = Array.isArray(tree.data.nodes) ? tree.data.nodes : [];
    collected = nodes.map(n => ({ ...n, tree_id: filters.treeId }));
  } else {
    const r = await query('SELECT id, payload FROM trees');
    for (const row of r.rows) {
      const nodes = Array.isArray(row.payload?.nodes) ? row.payload.nodes : [];
      nodes.forEach(n => collected.push({ ...n, tree_id: row.id }));
    }
  }

  let results = collected;

  if (filters.parentId !== undefined) {
    results = results.filter(n => filters.parentId === null ? !n.parentId : n.parentId === filters.parentId);
  }
  if (filters.visibility) {
    results = results.filter(n => (n.visibility || 'public') === filters.visibility);
  }
  results.sort((a, b) => new Date(a.timestamp || a.createdAt || 0) - new Date(b.timestamp || b.createdAt || 0));
  if (filters.limit) results = results.slice(0, Number(filters.limit));

  return results.map(n => ({
    id: n.id,
    data: {
      id: n.id, tree_id: n.tree_id, parent_id: n.parentId || null,
      title: n.title || '', memo: n.description || n.memo || '',
      artist: n.artist || '', source: n.source || '',
      source_url: n.sourceUrl || '', source_type: n.sourceType || 'youtube',
      thumbnail: n.thumbnail || '',
      emotion_tags: n.emotion_tags || n.emotionTags || [],
      timestamp: n.timestamp || '',
      visibility: n.visibility || 'public',
      created_at: n.createdAt || new Date().toISOString(),
      updated_at: n.updatedAt || new Date().toISOString()
    }
  }));
}

async function createMemory(data) {
  const id = require('crypto').randomUUID();
  const tree = await getTree(data.treeId);
  if (!tree) throw httpError(404, 'Tree not found');

  const existing = Array.isArray(tree.data.nodes) ? tree.data.nodes : [];
  const newNode = {
    id, parentId: data.parentId || null, title: data.title || '',
    description: data.memo || '', artist: data.artist || '',
    source: data.source || '', sourceUrl: data.sourceUrl || '',
    sourceType: data.sourceType || 'youtube', thumbnail: data.thumbnail || '',
    emotion_tags: data.emotionTags || [], timestamp: data.timestamp || '',
    visibility: data.visibility || 'private',
    createdAt: new Date().toISOString(), updatedAt: new Date().toISOString()
  };

  const basePayload = extractPayloadOnly(tree);
  const newPayload = {
    ...basePayload,
    nodes: [...existing, newNode]
  };

  await query(
    `UPDATE trees SET payload = $1, node_count = $2, updated_at = NOW() WHERE id = $3`,
    [JSON.stringify(newPayload), existing.length + 1, data.treeId]
  );

  return {
    id,
    data: {
      id, tree_id: data.treeId, parent_id: newNode.parentId,
      title: newNode.title, memo: newNode.description,
      artist: newNode.artist, source: newNode.source,
      source_url: newNode.sourceUrl, source_type: newNode.sourceType,
      thumbnail: newNode.thumbnail, emotion_tags: newNode.emotion_tags,
      timestamp: newNode.timestamp, visibility: newNode.visibility,
      created_at: newNode.createdAt, updated_at: newNode.updatedAt
    }
  };
}

async function updateMemory(memoryId, patch) {
  const r = await query('SELECT id, payload FROM trees');
  let targetTreeId = null;
  let nodes = [];
  let nodeIdx = -1;

  for (const row of r.rows) {
    const payload = row.payload || {};
    const current = Array.isArray(payload.nodes) ? payload.nodes : [];
    const idx = current.findIndex(n => n.id === memoryId);
    if (idx !== -1) {
      targetTreeId = row.id;
      nodes = current;
      nodeIdx = idx;
      break;
    }
  }

  if (!targetTreeId) return null;

  const updated = { ...nodes[nodeIdx] };
  Object.keys(patch).forEach(k => {
    const v = patch[k];
    let key = k;
    if (k === 'emotionTags') key = 'emotion_tags';
    else if (k === 'parentId') key = 'parentId';
    else if (k === 'sourceUrl') key = 'sourceUrl';
    else if (k === 'sourceType') key = 'sourceType';
    updated[key] = v;
  });
  nodes[nodeIdx] = updated;

  const tree = await getTree(targetTreeId);
  const basePayload = extractPayloadOnly(tree);
  const newPayload = {
    ...basePayload,
    nodes
  };

  await query(
    `UPDATE trees SET payload = $1, updated_at = NOW() WHERE id = $2`,
    [JSON.stringify(newPayload), targetTreeId]
  );

  return {
    id: memoryId,
    data: {
      id: memoryId, tree_id: targetTreeId, parent_id: updated.parentId || null,
      title: updated.title || '', memo: updated.description || updated.memo || '',
      artist: updated.artist || '', source: updated.source || '',
      source_url: updated.sourceUrl || '', source_type: updated.sourceType || 'youtube',
      thumbnail: updated.thumbnail || '', emotion_tags: updated.emotion_tags || [],
      timestamp: updated.timestamp || '', visibility: updated.visibility || 'public',
      created_at: updated.createdAt || new Date().toISOString(),
      updated_at: new Date().toISOString()
    }
  };
}

async function deleteMemory(memoryId) {
  // JSONB 쿼리로 해당 메모리가 속한 트리만 효율적으로 검색
  const r = await query(
    `SELECT id, payload FROM trees WHERE payload->'nodes' @> $1::jsonb`,
    [JSON.stringify([{ id: memoryId }])]
  );
  
  let targetTreeId = null;
  let nodes = [];
  let nodeIdx = -1;
  let row; // 블록 밖에서도 접근 가능하도록 let으로 선언

  for (row of r.rows) {
    const payload = row.payload || {};
    const current = Array.isArray(payload.nodes) ? payload.nodes : [];
    const idx = current.findIndex(n => n.id === memoryId);
    if (idx !== -1) {
      targetTreeId = row.id;
      nodes = current;
      nodeIdx = idx;
      break;
    }
  }

  if (!targetTreeId) {
    console.log('[deleteMemory] Memory not found:', memoryId);
    return null; // 명시적 null 반환 (404 처리용)
  }

  nodes.splice(nodeIdx, 1);
  // 기존 payload의 다른 필드들을 보존하면서 nodes만 업데이트
  const tree = await getTree(targetTreeId);
  const basePayload = extractPayloadOnly(tree);
  const newPayload = {
    ...basePayload,
    nodes
  };

  await query(
    `UPDATE trees SET payload = $1, node_count = $2, updated_at = NOW() WHERE id = $3`,
    [JSON.stringify(newPayload), nodes.length, targetTreeId]
  );

  return {
    deleted: true,
    id: memoryId,
    treeId: targetTreeId,
    nodeCount: nodes.length
  };
}

module.exports = {
  getTree, getTreeById, queryTrees, createTree, updateTree, deleteTree,
  getMemory, queryMemories, createMemory, updateMemory, deleteMemory,
  validateRequired, validateOptionalString, validateVisibility,
  validateSourceType, validateUuid, validateLimit
};
