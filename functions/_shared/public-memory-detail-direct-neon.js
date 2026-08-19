import { normalizeMemoryId } from './memory-route-proxy.js';
import {
  buildInvalidPathEncodingResponse,
  isInvalidPathEncodingError
} from './path-segment.js';

export const PUBLIC_MEMORY_DETAIL_RUNTIME_ENV = Object.freeze({
  GATE_FLAG: 'LB_PUBLIC_MEMORY_DETAIL_RUNTIME',
  DIRECT_NEON_VALUE: 'direct_neon',
  DATABASE_URL: 'LOVE_PLATFORM_DATABASE_URL'
});

const POSTGRES_URL = /^postgres(?:ql)?:\/\//i;
const NEON_HOST = /(?:^|\.)neon\.tech$/i;

export const PUBLIC_MEMORY_DETAIL_SQL = `
SELECT
  m.id,
  m.tree_id,
  m.parent_id,
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
  m.updated_at::text AS updated_at,
  COALESCE((
    SELECT jsonb_object_agg(reaction_totals.type, reaction_totals.count)
    FROM (
      SELECT r.type, COUNT(*)::int AS count
      FROM reactions r
      WHERE r.memory_id = m.id
      GROUP BY r.type
      ORDER BY r.type
    ) reaction_totals
  ), '{}'::jsonb) AS reaction_counts
FROM memories m
INNER JOIN trees t
  ON t.id = m.tree_id
WHERE m.id = $1
  AND m.visibility = 'public'
  AND t.visibility = 'public'
LIMIT 1;
`;

export function isNeonDatabaseUrl(value) {
  if (typeof value !== 'string' || !POSTGRES_URL.test(value)) return false;
  try {
    const parsed = new URL(value);
    return NEON_HOST.test(parsed.hostname);
  } catch {
    return false;
  }
}

export function readPublicMemoryDetailConfig(env = {}) {
  const gateValue = typeof env[PUBLIC_MEMORY_DETAIL_RUNTIME_ENV.GATE_FLAG] === 'string'
    ? env[PUBLIC_MEMORY_DETAIL_RUNTIME_ENV.GATE_FLAG].trim()
    : '';
  const isDirect = gateValue === PUBLIC_MEMORY_DETAIL_RUNTIME_ENV.DIRECT_NEON_VALUE;
  const connectionString = typeof env[PUBLIC_MEMORY_DETAIL_RUNTIME_ENV.DATABASE_URL] === 'string'
    ? env[PUBLIC_MEMORY_DETAIL_RUNTIME_ENV.DATABASE_URL].trim()
    : '';
  const configured = isNeonDatabaseUrl(connectionString);

  return Object.freeze({
    gateValue,
    isDirect,
    configured,
    connectionString: configured ? connectionString : ''
  });
}

export function normalizeDirectNeonTimestamp(value) {
  if (value == null) return null;
  if (value instanceof Date) {
    throw new TypeError('PUBLIC_MEMORY_DETAIL_TIMESTAMP_PRECISION_LOST');
  }
  if (typeof value !== 'string') return String(value);

  const text = value.trim();
  const offsetMatch = text.match(/([+-]\d{2}(?::?\d{2})?|Z)$/);
  let offset = '';
  let body = text;
  if (offsetMatch) {
    offset = offsetMatch[1];
    body = text.slice(0, offsetMatch.index);
  }
  body = body.replace(' ', 'T');
  body = body.replace(/(\.\d+)$/, (match) => {
    const digits = match.slice(1);
    return '.' + (digits + '000000').slice(0, 6);
  });

  let normalizedOffset = '';
  if (offset === 'Z') {
    normalizedOffset = '+00:00';
  } else if (offset) {
    const sign = offset[0];
    const rest = offset.slice(1);
    normalizedOffset = rest.includes(':') ? offset : `${sign}${rest}:00`;
  }
  return body + normalizedOffset;
}

export function normalizeMemoryEmotionTags(raw) {
  if (!raw) return [];
  if (Array.isArray(raw)) return raw.filter(Boolean).map((tag) => String(tag));
  if (typeof raw === 'string') {
    try {
      const parsed = JSON.parse(raw);
      return Array.isArray(parsed) ? parsed.filter(Boolean).map((tag) => String(tag)) : [];
    } catch {
      return raw ? [raw] : [];
    }
  }
  return [];
}

function normalizeStoredVisibility(value) {
  if (value === 'public') return 'public';
  if (value === 'private') return 'private';
  return null;
}

export function normalizeReactionCounts(raw) {
  let source = raw;
  if (typeof source === 'string') {
    try {
      source = JSON.parse(source);
    } catch {
      throw new TypeError('PUBLIC_MEMORY_DETAIL_REACTION_COUNTS_INVALID');
    }
  }
  if (source == null) source = {};
  if (typeof source !== 'object' || Array.isArray(source)) {
    throw new TypeError('PUBLIC_MEMORY_DETAIL_REACTION_COUNTS_INVALID');
  }

  const counts = {};
  let total = 0;
  for (const [type, rawCount] of Object.entries(source)) {
    const count = Number(rawCount);
    if (!Number.isSafeInteger(count) || count < 0) {
      throw new TypeError('PUBLIC_MEMORY_DETAIL_REACTION_COUNTS_INVALID');
    }
    counts[String(type)] = count;
    total += count;
  }
  counts.total = total;
  return counts;
}

export function mapPublicMemoryDetailRow(row) {
  if (!row || typeof row !== 'object') {
    throw new TypeError('PUBLIC_MEMORY_DETAIL_ROW_INVALID');
  }

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
    emotionTags: normalizeMemoryEmotionTags(row.emotion_tags),
    timestamp: row.timestamp || '',
    visibility: normalizeStoredVisibility(row.visibility),
    channelId: row.channel_id || null,
    channelName: row.channel_name || null,
    channelUrl: row.channel_url || null,
    createdAt: normalizeDirectNeonTimestamp(row.created_at),
    updatedAt: normalizeDirectNeonTimestamp(row.updated_at),
    reactionCounts: normalizeReactionCounts(row.reaction_counts)
  };
}

export async function createPublicMemoryDetailNeonExecutor({ connectionString, neonOptions } = {}) {
  if (!isNeonDatabaseUrl(connectionString)) {
    throw new TypeError('PUBLIC_MEMORY_DETAIL_DIRECT_NEON_CONFIG_INVALID');
  }
  const { neon } = await import('@neondatabase/serverless');
  const sql = neon(connectionString, {
    disableWarningInBrowsers: true,
    ...(neonOptions && typeof neonOptions === 'object' ? neonOptions : {})
  });
  return async function publicMemoryDetailExecutor(text, values) {
    const rows = await sql.query(text, Array.isArray(values) ? values : []);
    if (!Array.isArray(rows)) {
      throw new TypeError('PUBLIC_MEMORY_DETAIL_DIRECT_NEON_RESULT_INVALID');
    }
    return rows;
  };
}

function directHeaders(requestId = null, routeStatus = null) {
  const headers = {
    'content-type': 'application/json; charset=utf-8',
    'cache-control': 'no-store',
    'x-lovebud-upstream': 'direct-neon'
  };
  if (routeStatus) headers['x-lovebud-route-status'] = routeStatus;
  if (requestId) headers['x-lovebud-request-id'] = requestId;
  return headers;
}

function jsonResponse(body, status, requestId = null, routeStatus = null) {
  return new Response(JSON.stringify(body), {
    status,
    headers: directHeaders(requestId, routeStatus)
  });
}

export async function handlePublicMemoryDetailDirectNeon(
  request,
  env = {},
  rawMemoryId = null,
  requestId = null,
  { executorOverride = null } = {}
) {
  const config = readPublicMemoryDetailConfig(env);
  if (!config.isDirect) return null;

  if (!config.configured && !executorOverride) {
    return jsonResponse({
      error: 'Public Memory detail direct-Neon runtime not configured',
      code: 'DIRECT_NEON_CONFIG_ABSENT'
    }, 503, requestId, 'config-absent');
  }

  let normalizedMemoryId;
  try {
    normalizedMemoryId = normalizeMemoryId(rawMemoryId);
  } catch (error) {
    if (isInvalidPathEncodingError(error)) {
      const response = buildInvalidPathEncodingResponse(requestId, 'x-lovebud-request-id');
      const headers = new Headers(response.headers);
      headers.set('cache-control', 'no-store');
      return new Response(response.body, {
        status: response.status,
        statusText: response.statusText,
        headers
      });
    }
    throw error;
  }

  if (!normalizedMemoryId) {
    return jsonResponse({ detail: 'memoryId is required' }, 400, requestId, 'invalid-memory-id');
  }

  const databaseMemoryId = decodeURIComponent(normalizedMemoryId);

  try {
    const executor = executorOverride || await createPublicMemoryDetailNeonExecutor({
      connectionString: config.connectionString
    });
    const rows = await executor(PUBLIC_MEMORY_DETAIL_SQL, [databaseMemoryId]);
    if (!Array.isArray(rows)) {
      throw new TypeError('PUBLIC_MEMORY_DETAIL_DIRECT_NEON_RESULT_INVALID');
    }

    if (rows.length === 0) {
      const response = jsonResponse({ detail: 'Memory not found' }, 404, requestId, 'not-found');
      const headers = new Headers(response.headers);
      headers.set('x-lovebud-runtime', 'direct_neon');
      return new Response(response.body, { status: response.status, headers });
    }

    const memory = mapPublicMemoryDetailRow(rows[0]);
    const response = jsonResponse(memory, 200, requestId);
    const headers = new Headers(response.headers);
    headers.set('x-lovebud-runtime', 'direct_neon');
    return new Response(response.body, { status: response.status, headers });
  } catch (_error) {
    const response = jsonResponse({
      error: 'Public Memory detail direct-Neon query failed',
      code: 'DIRECT_NEON_QUERY_FAILED'
    }, 500, requestId, 'query-failed');
    const headers = new Headers(response.headers);
    headers.set('x-lovebud-runtime', 'direct_neon');
    return new Response(response.body, { status: response.status, headers });
  }
}
