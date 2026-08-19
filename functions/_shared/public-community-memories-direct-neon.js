// #4113 Phase-2 public Community Memories Cloudflare -> Neon Serverless HTTP adapter.
//
// The route remains Modal-backed unless the route-specific direct gate is
// explicitly selected. Direct mode is read-only, uses only the dedicated
// LOVE_PLATFORM_DATABASE_URL boundary, and fails closed without Modal fallback.

export const COMMUNITY_MEMORIES_RUNTIME_ENV = Object.freeze({
  GATE_FLAG: 'LB_COMMUNITY_MEMORIES_READ_RUNTIME',
  DIRECT_NEON_VALUE: 'direct_neon',
  DATABASE_URL: 'LOVE_PLATFORM_DATABASE_URL',
});

export const COMMUNITY_MEMORIES_DEFAULT_LIMIT = 100;
export const COMMUNITY_MEMORIES_MIN_LIMIT = 1;
export const COMMUNITY_MEMORIES_MAX_LIMIT = 200;

const POSTGRES_URL = /^postgres(?:ql)?:\/\//i;
const NEON_HOST = /(?:^|\.)neon\.tech$/i;
const LEGACY_SCHEMA_ERROR_CODES = new Set(['42P01', '42703']);

export function isPublicCommunityMemoriesRequest(request) {
  if (!request || request.method.toUpperCase() !== 'GET') return false;
  const path = new URL(request.url).pathname.replace(/\/+$/, '');
  return path === '/api/community/memories';
}

export function isPublicCommunityMemoriesDirectNeonSelected(env = {}) {
  const value = typeof env?.[COMMUNITY_MEMORIES_RUNTIME_ENV.GATE_FLAG] === 'string'
    ? env[COMMUNITY_MEMORIES_RUNTIME_ENV.GATE_FLAG].trim()
    : '';
  return value === COMMUNITY_MEMORIES_RUNTIME_ENV.DIRECT_NEON_VALUE;
}

export function isNeonDatabaseUrl(value) {
  if (typeof value !== 'string' || !POSTGRES_URL.test(value)) return false;
  try {
    return NEON_HOST.test(new URL(value).hostname);
  } catch {
    return false;
  }
}

export function readCommunityMemoriesDirectConfig(env = {}) {
  const raw = typeof env?.[COMMUNITY_MEMORIES_RUNTIME_ENV.DATABASE_URL] === 'string'
    ? env[COMMUNITY_MEMORIES_RUNTIME_ENV.DATABASE_URL].trim()
    : '';
  const configured = isNeonDatabaseUrl(raw);
  return Object.freeze({
    configured,
    connectionString: configured ? raw : '',
  });
}

// Preserve the existing Cloudflare edge coercion before the Modal FastAPI
// integer validator sees the value.
export function normalizeCommunityMemoriesLimit(rawLimit) {
  return Math.min(
    Math.max(Number(rawLimit || COMMUNITY_MEMORIES_DEFAULT_LIMIT) || COMMUNITY_MEMORIES_DEFAULT_LIMIT, COMMUNITY_MEMORIES_MIN_LIMIT),
    COMMUNITY_MEMORIES_MAX_LIMIT
  );
}

export function hasFractionalCommunityMemoriesLimit(rawLimit) {
  const normalized = normalizeCommunityMemoriesLimit(rawLimit);
  return Number.isFinite(normalized) && !Number.isInteger(normalized);
}

export function normalizeCommunityMemoriesTreeId(rawTreeId) {
  if (rawTreeId == null || rawTreeId === '') {
    return Object.freeze({ ok: true, value: null });
  }
  const trimmed = String(rawTreeId).trim();
  if (!trimmed) {
    return Object.freeze({ ok: false, value: null });
  }
  return Object.freeze({ ok: true, value: trimmed });
}

export function normalizeDirectNeonTimestamp(value) {
  if (value == null) return null;
  if (value instanceof Date) throw new TypeError('DIRECT_NEON_TIMESTAMP_PRECISION_LOST');
  if (typeof value !== 'string') return String(value);

  const text = value.trim();
  const offsetMatch = text.match(/([+-]\d{2}(?::?\d{2})?|Z)$/);
  let offset = '';
  let body = text;
  if (offsetMatch) {
    offset = offsetMatch[1];
    body = text.slice(0, offsetMatch.index);
  }
  body = body.replace(' ', 'T').replace(/(\.\d+)$/, (match) => {
    const digits = match.slice(1);
    return '.' + (digits + '000000').slice(0, 6);
  });
  if (offset === 'Z') return body + '+00:00';
  if (!offset) return body;
  const sign = offset[0];
  const rest = offset.slice(1);
  return body + (rest.includes(':') ? offset : `${sign}${rest}:00`);
}

export function normalizeCommunityMemoryTags(raw) {
  if (!raw) return [];
  if (Array.isArray(raw)) return raw.filter(Boolean).map((tag) => String(tag));
  if (typeof raw !== 'string') return [];
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.filter(Boolean).map((tag) => String(tag)) : [];
  } catch {
    return raw ? [raw] : [];
  }
}

function normalizeStoredVisibility(value) {
  if (value === 'public') return 'public';
  if (value === 'private') return 'private';
  return null;
}

export function projectCommunityMemoryRow(row) {
  if (!row || typeof row !== 'object') throw new TypeError('COMMUNITY_MEMORY_ROW_INVALID');
  return {
    id: String(row.id),
    treeId: row.tree_id ? String(row.tree_id) : null,
    parentId: row.parent_id ? String(row.parent_id) : null,
    title: row.title || '',
    memo: row.memo || '',
    artist: row.artist || '',
    source: row.source || '',
    sourceUrl: row.source_url || '',
    sourceType: row.source_type || 'youtube',
    thumbnail: row.thumbnail || '',
    emotionTags: normalizeCommunityMemoryTags(row.emotion_tags),
    timestamp: row.timestamp || '',
    visibility: normalizeStoredVisibility(row.visibility),
    channelId: row.channel_id || null,
    channelName: row.channel_name || null,
    channelUrl: row.channel_url || null,
    createdAt: normalizeDirectNeonTimestamp(row.created_at),
    updatedAt: normalizeDirectNeonTimestamp(row.updated_at),
  };
}

export const COMMUNITY_MEMORIES_SCHEMA_SQL = `
SELECT
  to_regclass('public.memories') IS NOT NULL AS has_memories,
  EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'trees' AND column_name = 'title'
  ) AS has_tree_title,
  EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'trees' AND column_name = 'visibility'
  ) AS has_tree_visibility,
  EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'trees' AND column_name = 'name'
  ) AS has_tree_name,
  EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'trees' AND column_name = 'is_public'
  ) AS has_tree_is_public;
`;

export const COMMUNITY_MEMORIES_MODERN_SQL = `
SELECT
  m.id::text AS id,
  m.tree_id::text AS tree_id,
  m.parent_id::text AS parent_id,
  m.title,
  m.memo,
  m.artist,
  m.source,
  m.source_url,
  m.source_type,
  m.thumbnail,
  m.emotion_tags,
  m.timestamp,
  m.visibility,
  m.channel_id,
  m.channel_name,
  m.channel_url,
  m.created_at::text AS created_at,
  m.updated_at::text AS updated_at
FROM memories m
INNER JOIN trees t
  ON t.id = m.tree_id
WHERE m.visibility = 'public'
  AND t.visibility = 'public'
  AND ($1::text IS NULL OR m.tree_id::text = $1)
ORDER BY m.created_at DESC
LIMIT $2;
`;

export const COMMUNITY_MEMORIES_LEGACY_MODERN_TREE_SQL = `
SELECT
  t.id::text AS id,
  t.title AS name,
  t.payload,
  t.created_at::text AS created_at,
  t.updated_at::text AS updated_at
FROM trees t
WHERE t.visibility = 'public'
  AND ($1::text IS NULL OR t.id::text = $1)
ORDER BY t.created_at DESC
LIMIT $2;
`;

export const COMMUNITY_MEMORIES_LEGACY_OLD_TREE_SQL = `
SELECT
  t.id::text AS id,
  t.name,
  t.payload,
  t.created_at::text AS created_at,
  t.updated_at::text AS updated_at
FROM trees t
WHERE t.is_public = true
  AND ($1::text IS NULL OR t.id::text = $1)
ORDER BY t.created_at DESC
LIMIT $2;
`;

function readSchemaCapabilities(rows) {
  const row = Array.isArray(rows) && rows.length ? rows[0] : {};
  return Object.freeze({
    hasMemories: row?.has_memories === true,
    hasTreeTitle: row?.has_tree_title === true,
    hasTreeVisibility: row?.has_tree_visibility === true,
    hasTreeName: row?.has_tree_name === true,
    hasTreeIsPublic: row?.has_tree_is_public === true,
  });
}

function isLegacySchemaError(error) {
  return LEGACY_SCHEMA_ERROR_CODES.has(String(error?.code || ''));
}

function selectLegacyQuery(capabilities) {
  if (capabilities.hasTreeTitle && capabilities.hasTreeVisibility) {
    return COMMUNITY_MEMORIES_LEGACY_MODERN_TREE_SQL;
  }
  if (capabilities.hasTreeName && capabilities.hasTreeIsPublic) {
    return COMMUNITY_MEMORIES_LEGACY_OLD_TREE_SQL;
  }
  return null;
}

function readLegacyPayload(rawPayload) {
  if (rawPayload && typeof rawPayload === 'object' && !Array.isArray(rawPayload)) return rawPayload;
  if (typeof rawPayload !== 'string' || !rawPayload) return {};
  try {
    const parsed = JSON.parse(rawPayload);
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed : {};
  } catch {
    return {};
  }
}

function isPublicLegacyNode(node) {
  return !!node && typeof node === 'object' && !Array.isArray(node)
    && (node.visibility === undefined || node.visibility === 'public');
}

function legacyNodeOrder(node) {
  return typeof node?.order === 'number' && Number.isFinite(node.order) ? node.order : 0;
}

function projectLegacyCommunityMemory(node, treeRow) {
  const parentId = node.parent_id || node.parentId;
  const channelId = node.channel_id || node.channelId;
  const channelName = node.channel_name || node.channelName;
  const channelUrl = node.channel_url || node.channelUrl;
  return {
    id: String(node.id ?? ''),
    treeId: treeRow.id ? String(treeRow.id) : null,
    parentId: parentId ? String(parentId) : null,
    title: node.title || node.label || 'Untitled Moment',
    memo: node.memo || node.description || '',
    artist: node.artist || '',
    source: node.source || '',
    sourceUrl: node.source_url || node.sourceUrl || '',
    sourceType: node.source_type || node.sourceType || 'youtube',
    thumbnail: node.thumbnail || '',
    emotionTags: normalizeCommunityMemoryTags(node.emotion_tags || node.emotionTags || []),
    timestamp: node.timestamp || '',
    visibility: 'public',
    channelId: channelId || null,
    channelName: channelName || null,
    channelUrl: channelUrl || null,
    createdAt: normalizeDirectNeonTimestamp(treeRow.created_at),
    updatedAt: normalizeDirectNeonTimestamp(treeRow.updated_at),
  };
}

export function projectLegacyCommunityMemories(treeRows, limit) {
  const result = [];
  for (const treeRow of Array.isArray(treeRows) ? treeRows : []) {
    const payload = readLegacyPayload(treeRow?.payload);
    const nodes = Array.isArray(payload.nodes) ? payload.nodes : [];
    const publicNodes = nodes
      .filter(isPublicLegacyNode)
      .map((node, index) => ({ node, index }))
      .sort((a, b) => {
        const delta = legacyNodeOrder(a.node) - legacyNodeOrder(b.node);
        return delta || a.index - b.index;
      })
      .slice(0, limit)
      .map(({ node }) => node);

    for (const node of publicNodes) {
      result.push(projectLegacyCommunityMemory(node, treeRow));
    }
  }

  result.sort((a, b) => {
    const left = a.createdAt || '';
    const right = b.createdAt || '';
    if (left === right) return 0;
    return left < right ? 1 : -1;
  });
  return result;
}

export async function createCommunityMemoriesDirectExecutor({ connectionString, executor } = {}) {
  if (typeof executor === 'function') return executor;
  if (!isNeonDatabaseUrl(connectionString)) {
    throw new TypeError('COMMUNITY_MEMORIES_DIRECT_NEON_CONFIG_INVALID');
  }
  const { neon } = await import('@neondatabase/serverless');
  const sql = neon(connectionString, { disableWarningInBrowsers: true });
  return async (text, values) => {
    const rows = await sql.query(text, Array.isArray(values) ? values : []);
    return Array.isArray(rows) ? rows : [];
  };
}

function responseHeaders(requestId, routeStatus = null) {
  const headers = {
    'content-type': 'application/json; charset=utf-8',
    'cache-control': 'no-store',
    'x-lovebud-upstream': 'direct-neon',
    'x-lovebud-runtime': 'direct_neon',
  };
  if (routeStatus) headers['x-lovebud-route-status'] = routeStatus;
  if (requestId) {
    headers['x-lovebud-request-id'] = requestId;
    headers['Access-Control-Expose-Headers'] = 'x-lovebud-request-id';
  }
  return headers;
}

function jsonResponse(body, status, requestId, routeStatus = null) {
  return new Response(JSON.stringify(body), {
    status,
    headers: responseHeaders(requestId, routeStatus),
  });
}

function buildIntegerLimitValidationBody(rawLimit) {
  return {
    detail: [{
      type: 'int_parsing',
      loc: ['query', 'limit'],
      msg: 'Input should be a valid integer, unable to parse string as an integer',
      input: String(rawLimit),
    }],
  };
}

export async function handlePublicCommunityMemoriesDirectNeon(
  request,
  env = {},
  requestId = null,
  { executorOverride = null } = {}
) {
  if (!isPublicCommunityMemoriesRequest(request) || !isPublicCommunityMemoriesDirectNeonSelected(env)) {
    return null;
  }

  const url = new URL(request.url);
  const rawLimit = url.searchParams.get('limit');
  if (hasFractionalCommunityMemoriesLimit(rawLimit)) {
    return jsonResponse(buildIntegerLimitValidationBody(rawLimit), 422, requestId, 'invalid-limit');
  }
  const limit = normalizeCommunityMemoriesLimit(rawLimit);

  const treeIdResult = normalizeCommunityMemoriesTreeId(url.searchParams.get('treeId'));
  if (!treeIdResult.ok) {
    return jsonResponse({ detail: 'Invalid treeId' }, 400, requestId, 'invalid-tree-id');
  }
  const treeId = treeIdResult.value;

  const config = readCommunityMemoriesDirectConfig(env);
  if (!config.configured && !executorOverride) {
    return jsonResponse({
      error: 'Community Memories direct-Neon runtime not configured',
      code: 'DIRECT_NEON_CONFIG_ABSENT',
    }, 503, requestId, 'config-absent');
  }

  try {
    const executor = await createCommunityMemoriesDirectExecutor({
      connectionString: config.connectionString,
      executor: executorOverride || undefined,
    });
    const capabilityRows = await executor(COMMUNITY_MEMORIES_SCHEMA_SQL, []);
    const capabilities = readSchemaCapabilities(capabilityRows);

    if (capabilities.hasMemories) {
      try {
        const rows = await executor(COMMUNITY_MEMORIES_MODERN_SQL, [treeId, limit]);
        return jsonResponse((Array.isArray(rows) ? rows : []).map(projectCommunityMemoryRow), 200, requestId);
      } catch (error) {
        if (!isLegacySchemaError(error)) throw error;
      }
    }

    const legacyQuery = selectLegacyQuery(capabilities);
    if (!legacyQuery) {
      return jsonResponse([], 200, requestId);
    }

    const treeReadLimit = treeId ? 1 : 20;
    const treeRows = await executor(legacyQuery, [treeId, treeReadLimit]);
    return jsonResponse(projectLegacyCommunityMemories(treeRows, limit), 200, requestId);
  } catch {
    return jsonResponse({
      error: 'Community Memories direct-Neon query failed',
      code: 'DIRECT_NEON_QUERY_FAILED',
    }, 500, requestId, 'query-failed');
  }
}

export const COMMUNITY_MEMORIES_DIRECT_NEON_CONTRACT = Object.freeze({
  method: 'GET',
  path: '/api/community/memories',
  gateEnv: COMMUNITY_MEMORIES_RUNTIME_ENV.GATE_FLAG,
  databaseEnv: COMMUNITY_MEMORIES_RUNTIME_ENV.DATABASE_URL,
  defaultLimit: COMMUNITY_MEMORIES_DEFAULT_LIMIT,
  minLimit: COMMUNITY_MEMORIES_MIN_LIMIT,
  maxLimit: COMMUNITY_MEMORIES_MAX_LIMIT,
  publicIntersection: 'memory-public-and-tree-public',
  legacyFallback: true,
  writes: false,
});
