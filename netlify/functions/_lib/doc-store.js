/**
 * LoveBud - Document Store (Simplified)
 *
 * Direct PostgreSQL access for LoveBud MVP.
 * - trees table: id, owner_id, title, created_at, updated_at
 * - memories table: id, tree_id, parent_id, title, memo, artist, source,
 *                   source_url, source_type, thumbnail, emotion_tags,
 *                   timestamp, visibility, created_at, updated_at
 *
 * NOT a Firestore shim — direct SQL, LoveBud-specific schema.
 */
const { query } = require('./db');
const { httpError } = require('./http');

// ── Validation Helpers ─────────────────────────────────────────────────────

const VISIBILITY_VALUES = ['public', 'private'];
const SOURCE_TYPE_VALUES = ['youtube', 'soundcloud', 'bandcamp', 'spotify', 'apple', 'other'];

/**
 * Validate required string field (non-empty after trim)
 */
function validateRequired(value, fieldName) {
  if (value === undefined || value === null || typeof value !== 'string') {
    throw httpError(400, `${fieldName} is required`);
  }
  if (value.trim().length === 0) {
    throw httpError(400, `${fieldName} cannot be empty`);
  }
  return value.trim();
}

/**
 * Validate optional string field (allow empty, but trim if provided)
 */
function validateOptionalString(value, maxLength = 5000) {
  if (value === undefined || value === null) return '';
  if (typeof value !== 'string') return '';
  const trimmed = value.trim();
  if (trimmed.length > maxLength) {
    throw httpError(400, `Field exceeds maximum length of ${maxLength}`);
  }
  return trimmed;
}

/**
 * Validate visibility value
 */
function validateVisibility(value, defaultValue = 'private') {
  if (value === undefined || value === null) return defaultValue;
  if (!VISIBILITY_VALUES.includes(value)) {
    throw httpError(400, `visibility must be one of: ${VISIBILITY_VALUES.join(', ')}`);
  }
  return value;
}

/**
 * Validate sourceType value
 */
function validateSourceType(value, defaultValue = 'youtube') {
  if (value === undefined || value === null) return defaultValue;
  if (!SOURCE_TYPE_VALUES.includes(value)) {
    throw httpError(400, `sourceType must be one of: ${SOURCE_TYPE_VALUES.join(', ')}`);
  }
  return value;
}

/**
 * Validate UUID format
 */
function validateUuid(value, fieldName) {
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  if (!value || typeof value !== 'string' || !uuidRegex.test(value)) {
    throw httpError(400, `Invalid ${fieldName} format`);
  }
  return value;
}

/**
 * Validate limit parameter
 */
function validateLimit(value, defaultValue = 20, maxValue = 100) {
  if (!value) return defaultValue;
  const num = Number(value);
  if (isNaN(num) || num < 1) return defaultValue;
  return Math.min(num, maxValue);
}

// ── Trees ──────────────────────────────────────────────────────────────────

/**
 * Get a single tree by ID.
 * @param {string} treeId
 * @returns {Promise<{id, data}|null>}
 */
async function getTree(treeId) {
  const result = await query(
    'SELECT id, owner_id, title, visibility, created_at, updated_at FROM trees WHERE id = $1',
    [treeId]
  );
  if (!result.rows.length) return null;
  const r = result.rows[0];
  return { id: r.id, data: r };
}

/**
 * List trees with optional filter.
 * @param {Object} filters - { ownerId, visibility, limit }
 * @returns {Promise<Array<{id, data}>>}
 */
async function queryTrees(filters = {}) {
  const params = [];
  const where = [];

  if (filters.ownerId) {
    params.push(filters.ownerId);
    where.push(`owner_id = $${params.length}`);
  }
  if (filters.visibility) {
    params.push(filters.visibility);
    where.push(`visibility = $${params.length}`);
  }

  let sql = `SELECT id, owner_id, title, visibility, created_at, updated_at FROM trees`;
  if (where.length) sql += ` WHERE ${where.join(' AND ')}`;
  sql += ' ORDER BY created_at DESC';

  if (filters.limit) {
    params.push(Number(filters.limit));
    sql += ` LIMIT $${params.length}`;
  }

  const result = await query(sql, params);
  return result.rows.map((r) => ({ id: r.id, data: r }));
}

/**
 * Create a new tree.
 * @param {Object} data - { ownerId, title, visibility }
 * @returns {Promise<{id, data}>}
 */
async function createTree(data) {
  const id = require('crypto').randomUUID();
  const result = await query(
    `INSERT INTO trees (id, owner_id, title, visibility, created_at, updated_at)
     VALUES ($1, $2, $3, $4, NOW(), NOW())
     RETURNING id, owner_id, title, visibility, created_at, updated_at`,
    [id, data.ownerId, data.title || '나의 Lovetree', data.visibility || 'private']
  );
  const r = result.rows[0];
  return { id: r.id, data: r };
}

/**
 * Update tree fields.
 * @param {string} treeId
 * @param {Object} patch - fields to update
 */
async function updateTree(treeId, patch) {
  const fields = [];
  const params = [];

  if (patch.title !== undefined) {
    params.push(patch.title);
    fields.push(`title = $${params.length}`);
  }
  if (patch.visibility !== undefined) {
    params.push(patch.visibility);
    fields.push(`visibility = $${params.length}`);
  }

  if (!fields.length) return getTree(treeId);

  params.push(treeId);
  fields.push('updated_at = NOW()');

  const result = await query(
    `UPDATE trees SET ${fields.join(', ')} WHERE id = $${params.length}
     RETURNING id, owner_id, title, visibility, created_at, updated_at`,
    params
  );
  if (!result.rows.length) return null;
  const r = result.rows[0];
  return { id: r.id, data: r };
}

// ── Memories ────────────────────────────────────────────────────────────────

/**
 * Get a single memory by ID.
 * @param {string} memoryId
 * @returns {Promise<{id, data}|null>}
 */
async function getMemory(memoryId) {
  const result = await query(
    `SELECT id, tree_id, parent_id, title, memo, artist, source,
            source_url, source_type, thumbnail, emotion_tags,
            timestamp, visibility, created_at, updated_at
     FROM memories WHERE id = $1`,
    [memoryId]
  );
  if (!result.rows.length) return null;
  return { id: result.rows[0].id, data: result.rows[0] };
}

/**
 * List memories with optional filters.
 * @param {Object} filters - { treeId, parentId, visibility, limit }
 * @returns {Promise<Array<{id, data}>>}
 */
async function queryMemories(filters = {}) {
  const params = [];
  const where = [];

  if (filters.treeId) {
    params.push(filters.treeId);
    where.push(`tree_id = $${params.length}`);
  }
  if (filters.parentId !== undefined) {
    if (filters.parentId === null) {
      where.push('parent_id IS NULL');
    } else {
      params.push(filters.parentId);
      where.push(`parent_id = $${params.length}`);
    }
  }
  if (filters.visibility) {
    params.push(filters.visibility);
    where.push(`visibility = $${params.length}`);
  }

  let sql = `SELECT id, tree_id, parent_id, title, memo, artist, source,
                    source_url, source_type, thumbnail, emotion_tags,
                    timestamp, visibility, created_at, updated_at
             FROM memories`;
  if (where.length) sql += ` WHERE ${where.join(' AND ')}`;
  sql += ' ORDER BY created_at ASC';

  if (filters.limit) {
    params.push(Number(filters.limit));
    sql += ` LIMIT $${params.length}`;
  }

  const result = await query(sql, params);
  return result.rows.map((r) => ({ id: r.id, data: r }));
}

/**
 * Create a new memory.
 * @param {Object} data - memory fields
 * @returns {Promise<{id, data}>}
 */
async function createMemory(data) {
  const id = require('crypto').randomUUID();
  const result = await query(
    `INSERT INTO memories
       (id, tree_id, parent_id, title, memo, artist, source,
        source_url, source_type, thumbnail, emotion_tags,
        timestamp, visibility, created_at, updated_at)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,NOW(),NOW())
     RETURNING id, tree_id, parent_id, title, memo, artist, source,
               source_url, source_type, thumbnail, emotion_tags,
               timestamp, visibility, created_at, updated_at`,
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
      data.visibility || 'private',
    ]
  );
  const r = result.rows[0];
  return { id: r.id, data: r };
}

/**
 * Update memory fields.
 * @param {string} memoryId
 * @param {Object} patch
 * @returns {Promise<{id, data}|null>}
 */
async function updateMemory(memoryId, patch) {
  const fields = [];
  const params = [];

  const stringFields = [
    'title', 'memo', 'artist', 'source', 'source_url', 'source_type',
    'thumbnail', 'timestamp', 'visibility', 'parent_id',
  ];
  stringFields.forEach((f) => {
    if (patch[f] !== undefined || patch[camelToSnake(f)] !== undefined) {
      const val = patch[f] ?? patch[camelToSnake(f)];
      params.push(val);
      fields.push(`${snakeOf(f)} = $${params.length}`);
    }
  });

  if (patch.emotionTags) {
    params.push(JSON.stringify(patch.emotionTags));
    fields.push(`emotion_tags = $${params.length}`);
  }

  if (!fields.length) return getMemory(memoryId);

  params.push(memoryId);
  fields.push('updated_at = NOW()');

  const result = await query(
    `UPDATE memories SET ${fields.join(', ')} WHERE id = $${params.length}
     RETURNING id, tree_id, parent_id, title, memo, artist, source,
               source_url, source_type, thumbnail, emotion_tags,
               timestamp, visibility, created_at, updated_at`,
    params
  );
  if (!result.rows.length) return null;
  const r = result.rows[0];
  return { id: r.id, data: r };
}

/**
 * Delete a memory.
 * @param {string} memoryId
 */
async function deleteMemory(memoryId) {
  await query('DELETE FROM memories WHERE id = $1', [memoryId]);
}

// ── Helpers ─────────────────────────────────────────────────────────────────

function camelToSnake(str) {
  return str.replace(/[A-Z]/g, (c) => '_' + c.toLowerCase());
}

function snakeOf(key) {
  // tree_id, parent_id, source_url, source_type, emotion_tags
  const map = {
    treeId: 'tree_id', parentId: 'parent_id',
    sourceUrl: 'source_url', sourceType: 'source_type',
    emotionTags: 'emotion_tags', visibility: 'visibility',
  };
  return map[key] || key.replace(/[A-Z]/g, (c) => '_' + c.toLowerCase());
}

module.exports = {
  // Trees
  getTree,
  queryTrees,
  createTree,
  updateTree,
  // Memories
  getMemory,
  queryMemories,
  createMemory,
  updateMemory,
  deleteMemory,
  // Validation helpers (for function-level use)
  validateRequired,
  validateOptionalString,
  validateVisibility,
  validateSourceType,
  validateUuid,
  validateLimit,
};